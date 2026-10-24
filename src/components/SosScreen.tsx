import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Battery, Check, CloudOff, Lightbulb, Loader2, MessageSquare, Phone, Plus, Send, Share2, Trash2, Users, Volume2, X } from "lucide-react";
import {
  EMERGENCY_NUMBERS,
  MAX_EMERGENCY_CONTACTS,
  SOS_LIGHT_PATTERN,
  buildSosMessage,
  emergencyContactError,
  loadEmergencyContacts,
  saveEmergencyContacts,
  smsUrl,
  type EmergencyContact,
  type SosFix,
} from "../lib/sos";
import { toDMS, toUTM } from "../utils/surveyUtils";
import { fetchTerrainRgbElevation } from "../utils/elevationUtils";
import { flushSosOutbox, queueSosReport, type SosReport } from "../lib/sosAlerts";

const REPORT_EVERY_MS = 30_000;

type Delivery =
  | { state: "idle" }
  | { state: "sending" }
  | { state: "sent"; at: number }
  | { state: "waiting" } // offline: kept on the phone, sent when the signal is back
  | { state: "error"; message: string };

const COUNTDOWN_S = 5;

interface Props {
  userId: string;
  userName: string;
  onClose: () => void;
}

const ago = (ms: number) => {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  return s < 60 ? `${s} s ago` : `${Math.round(s / 60)} min ago`;
};

// Emergency whistle: three long rising tones, repeated, made with Web Audio (works offline)
const useSiren = () => {
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const [on, setOn] = useState(false);

  const stop = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    ctxRef.current?.close().catch(() => undefined);
    ctxRef.current = null;
    setOn(false);
  }, []);

  const start = useCallback(() => {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    ctxRef.current = ctx;
    const blast = () => {
      for (let i = 0; i < 3; i++) {
        const t = ctx.currentTime + i * 1.1;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(900, t);
        osc.frequency.linearRampToValueAtTime(1500, t + 0.8);
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.6, t + 0.05);
        gain.gain.setValueAtTime(0.6, t + 0.8);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.95);
      }
    };
    blast();
    timerRef.current = window.setInterval(blast, 4500);
    setOn(true);
  }, []);

  useEffect(() => stop, [stop]);
  return { on, toggle: () => (on ? stop() : start()), stop };
};

// Fullscreen S.O.S: countdown, then location, calls, SMS, share, siren and light. Phase 1:
// everything runs on the phone; nothing is sent to the server.
export const SosScreen = ({ userId, userName, onClose }: Props) => {
  const [countdown, setCountdown] = useState(COUNTDOWN_S);
  const active = countdown <= 0;
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [fix, setFix] = useState<SosFix | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [battery, setBattery] = useState<number | null>(null);
  const [, setTick] = useState(0);
  const [contacts, setContacts] = useState<EmergencyContact[]>(() => loadEmergencyContacts(userId));
  const [showContacts, setShowContacts] = useState(false);
  const [draft, setDraft] = useState<EmergencyContact>({ name: "", phone: "" });
  const [contactError, setContactError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [light, setLight] = useState(false);
  const [lightOn, setLightOn] = useState(false);
  const siren = useSiren();

  // --- Report to the admin ---
  const clientId = useRef(crypto.randomUUID());
  const [messageDraft, setMessageDraft] = useState("");
  const [sentMessage, setSentMessage] = useState("");
  const [delivery, setDelivery] = useState<Delivery>({ state: "idle" });
  // Latest values for the timer, without restarting it on every GPS fix
  const latest = useRef({ fix: null as SosFix | null, battery: null as number | null, message: "", startedAt: null as number | null });
  useEffect(() => {
    latest.current = { fix, battery, message: sentMessage, startedAt };
  });

  const report = useCallback(
    async (status: SosReport["status"] = "active", message = latest.current.message) => {
      const { fix: f, battery: b, startedAt: started } = latest.current;
      if (started === null) return;
      if (!navigator.onLine) setDelivery({ state: "waiting" });
      else setDelivery((d) => (d.state === "sent" ? d : { state: "sending" }));
      try {
        const done = await queueSosReport({
          clientId: clientId.current,
          startedAt: new Date(started).toISOString(),
          status,
          message,
          fix: f,
          battery: b,
        });
        setDelivery(done ? { state: "sent", at: Date.now() } : { state: "waiting" });
      } catch (err) {
        // No connection: the report stays in the outbox and goes out later
        setDelivery(
          !navigator.onLine || /fetch|network/i.test((err as Error).message)
            ? { state: "waiting" }
            : { state: "error", message: (err as Error).message },
        );
      }
    },
    [],
  );

  // Countdown before the S.O.S screen activates (a last chance to cancel)
  useEffect(() => {
    if (active) return;
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [countdown, active]);

  useEffect(() => {
    if (active && startedAt === null) setStartedAt(Date.now());
  }, [active, startedAt]);

  // Precise GPS while the screen is open (separate from the normal location dot)
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("This device has no GPS access");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGpsError(null);
        setFix((prev) => ({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
          // GPS altitude when the phone has it, otherwise keep the last terrain value
          elevation: pos.coords.altitude ?? prev?.elevation ?? null,
          time: pos.timestamp || Date.now(),
        }));
      },
      (err) => setGpsError(err.code === err.PERMISSION_DENIED ? "Location permission is off" : "Searching for GPS…"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Elevation from the terrain when the GPS gives none (needs signal; best effort)
  const fixKey = fix ? `${fix.lat.toFixed(4)},${fix.lng.toFixed(4)}` : "";
  useEffect(() => {
    if (!fix || fix.elevation !== null || !navigator.onLine) return;
    let alive = true;
    fetchTerrainRgbElevation(fix.lng, fix.lat)
      .then((elevation) => alive && setFix((f) => (f ? { ...f, elevation } : f)))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixKey]);

  // Keep the screen on while S.O.S is active
  useEffect(() => {
    if (!active) return;
    let lock: { release: () => Promise<void> } | null = null;
    const request = () => {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock;
      wl?.request("screen").then((l) => (lock = l)).catch(() => undefined);
    };
    request();
    const onVisible = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => undefined);
    };
  }, [active]);

  // Battery level where the browser shares it (Chrome on Android)
  useEffect(() => {
    const getBattery = (navigator as unknown as { getBattery?: () => Promise<{ level: number }> }).getBattery;
    getBattery?.call(navigator).then((b) => setBattery(Math.round(b.level * 100))).catch(() => undefined);
  }, []);

  // Clock for "x s ago" and the elapsed time
  useEffect(() => {
    if (!active) return;
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [active]);

  // S.O.S light: Morse ··· ——— ··· on a white screen
  useEffect(() => {
    if (!light) {
      setLightOn(false);
      return;
    }
    let i = 0;
    let timer: number;
    const step = () => {
      const [on, off] = SOS_LIGHT_PATTERN[i % SOS_LIGHT_PATTERN.length];
      setLightOn(true);
      timer = window.setTimeout(() => {
        setLightOn(false);
        timer = window.setTimeout(() => {
          i++;
          step();
        }, off);
      }, on);
    };
    step();
    return () => window.clearTimeout(timer);
  }, [light]);

  // Report when S.O.S starts, then every 30 s with the latest location, and again as soon
  // as the connection comes back
  useEffect(() => {
    if (!active || startedAt === null) return;
    report();
    const timer = window.setInterval(() => report(), REPORT_EVERY_MS);
    const onOnline = () => {
      flushSosOutbox().catch(() => undefined);
      report();
    };
    window.addEventListener("online", onOnline);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [active, startedAt, report]);

  const sendMessage = () => {
    const text = messageDraft.trim();
    if (!text) return;
    setSentMessage(text);
    report("active", text);
  };

  const close = () => {
    siren.stop();
    // Tell the admin the user is safe (sent later if there is no signal right now)
    if (active && startedAt !== null) report("resolved").catch(() => undefined);
    onClose();
  };

  const flash = (text: string) => {
    setNote(text);
    window.setTimeout(() => setNote(null), 3500);
  };

  const message = buildSosMessage(userName, fix);

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: "S.O.S", text: message });
      else {
        await navigator.clipboard.writeText(message);
        flash("Location message copied");
      }
    } catch {
      // closed the share sheet
    }
  };

  const addContact = () => {
    const problem = emergencyContactError(draft, contacts);
    if (problem) {
      setContactError(problem);
      return;
    }
    const next = [...contacts, { name: draft.name.trim(), phone: draft.phone.trim() }];
    setContacts(next);
    saveEmergencyContacts(userId, next);
    setDraft({ name: "", phone: "" });
    setContactError(null);
  };

  const removeContact = (index: number) => {
    const next = contacts.filter((_, i) => i !== index);
    setContacts(next);
    saveEmergencyContacts(userId, next);
  };

  const elapsed = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
  const clock = `${String(Math.floor(elapsed / 3600)).padStart(2, "0")}:${String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`;
  const actionClass =
    "flex items-center justify-center gap-2 min-h-14 px-3 rounded-2xl font-bold text-sm transition-colors active:scale-[0.98]";

  return createPortal(
    <div className="fixed inset-0 z-[300] bg-brick-700 text-white flex flex-col h-dvh" role="alertdialog" aria-modal="true" aria-label="S.O.S">
      {lightOn && <div className="fixed inset-0 z-[310] bg-white pointer-events-none" />}

      {!active ? (
        // Countdown
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6 text-center">
          <div className="text-xs font-bold tracking-[0.3em] uppercase opacity-80">
            Starting S.O.S
          </div>
          <div className="text-8xl font-black tabular-nums">{countdown}</div>
          <p className="text-sm opacity-90 max-w-xs">Opening the emergency screen. Cancel if this was a mistake.</p>
          <button
            onClick={close}
            className="cursor-pointer w-full max-w-xs py-4 rounded-2xl bg-white text-brick-700 text-lg font-black"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-3">
            <div className="flex items-center gap-2 font-black tracking-widest">
              <span className="w-3 h-3 rounded-full bg-white animate-pulse" />
              S.O.S ACTIVE
            </div>
            <span className="font-mono tabular-nums text-sm opacity-90">{clock}</span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 space-y-4">
            {/* Location, large enough to read out over a radio */}
            <div className="rounded-2xl bg-black/20 p-4">
              {fix ? (
                <>
                  <div className="font-mono font-bold text-xl leading-snug">
                    {toDMS(fix.lat, true)}
                    <br />
                    {toDMS(fix.lng, false)}
                  </div>
                  <div className="mt-1 font-mono text-sm opacity-90">
                    {fix.lat.toFixed(5)}, {fix.lng.toFixed(5)}
                  </div>
                  <div className="font-mono text-sm opacity-90">UTM {toUTM(fix.lat, fix.lng)}</div>
                  <div className="mt-2 text-xs opacity-90 flex flex-wrap gap-x-3 gap-y-1">
                    {fix.elevation !== null && <span>Elev {Math.round(fix.elevation)} m</span>}
                    {fix.accuracy !== null && <span>±{Math.round(fix.accuracy)} m</span>}
                    <span>{ago(fix.time)}</span>
                    {battery !== null && (
                      <span className="inline-flex items-center gap-1">
                        <Battery size={12} /> {battery}%
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-sm font-bold">{gpsError ?? "Searching for GPS…"}</div>
              )}
            </div>

            {/* Report to the admin */}
            <div className="rounded-2xl bg-black/15 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 text-sm font-bold">
                <span>Admin</span>
                <span className="flex items-center gap-1.5 text-xs font-bold" aria-live="polite">
                  {delivery.state === "sent" ? (
                    <>
                      <Check size={14} /> Sent to the admin{" "}
                      {new Date(delivery.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </>
                  ) : delivery.state === "waiting" ? (
                    <>
                      <CloudOff size={14} /> Waiting for signal, sends automatically
                    </>
                  ) : delivery.state === "error" ? (
                    <span className="text-right">Not sent: {delivery.message}</span>
                  ) : (
                    <>
                      <Loader2 size={14} className="animate-spin" /> Sending to the admin…
                    </>
                  )}
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  value={messageDraft}
                  onChange={(e) => setMessageDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  maxLength={500}
                  placeholder="Message, e.g. sprained ankle at post 3, 2 people"
                  aria-label="Message to the admin"
                  className="min-w-0 flex-1 rounded-lg bg-white text-ink px-3 py-2 text-base outline-none"
                />
                <button
                  onClick={sendMessage}
                  disabled={!messageDraft.trim()}
                  className="cursor-pointer shrink-0 px-3 rounded-lg bg-white text-brick-700 disabled:opacity-50"
                  title="Send the message to the admin"
                  aria-label="Send message"
                >
                  <Send size={18} />
                </button>
              </div>
              {sentMessage && <p className="text-[11px] opacity-90">Message sent: “{sentMessage}”</p>}
              <p className="text-[11px] opacity-80">
                Your location, battery and time go to the admin every 30 s while this screen is open.
              </p>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              {EMERGENCY_NUMBERS.map((n) => (
                <a
                  key={n.number}
                  href={`tel:${n.number}`}
                  className={`${actionClass} bg-white text-brick-700`}
                >
                  <Phone size={18} /> {n.label}
                </a>
              ))}
              <a
                href={contacts.length ? smsUrl(contacts.map((c) => c.phone), message) : undefined}
                onClick={(e) => {
                  if (!contacts.length) {
                    e.preventDefault();
                    setShowContacts(true);
                  }
                }}
                className={`${actionClass} bg-white/15 border border-white/30`}
              >
                <MessageSquare size={18} /> {contacts.length ? `SMS (${contacts.length})` : "Add SMS contacts"}
              </a>
              <button onClick={share} className={`cursor-pointer ${actionClass} bg-white/15 border border-white/30`}>
                <Share2 size={18} /> Share location
              </button>
              <button
                onClick={siren.toggle}
                aria-pressed={siren.on}
                className={`cursor-pointer ${actionClass} ${siren.on ? "bg-white text-brick-700" : "bg-white/15 border border-white/30"}`}
              >
                <Volume2 size={18} /> {siren.on ? "Stop siren" : "Siren"}
              </button>
              <button
                onClick={() => setLight((v) => !v)}
                aria-pressed={light}
                className={`cursor-pointer ${actionClass} ${light ? "bg-white text-brick-700" : "bg-white/15 border border-white/30"}`}
              >
                <Lightbulb size={18} /> {light ? "Stop light" : "S.O.S light"}
              </button>
            </div>

            {note && <div className="rounded-xl bg-black/25 px-3 py-2 text-xs font-bold">{note}</div>}

            {/* Emergency contacts (kept on this device) */}
            <div className="rounded-2xl bg-black/15 p-4">
              <button
                onClick={() => setShowContacts((v) => !v)}
                className="cursor-pointer w-full flex items-center justify-between text-sm font-bold"
                aria-expanded={showContacts}
              >
                <span className="flex items-center gap-2">
                  <Users size={16} /> Emergency contacts ({contacts.length}/{MAX_EMERGENCY_CONTACTS})
                </span>
                <span className="text-xs opacity-80">{showContacts ? "Hide" : "Edit"}</span>
              </button>
              {showContacts && (
                <div className="mt-3 space-y-2">
                  {contacts.map((c, i) => (
                    <div key={`${c.phone}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">
                        <strong>{c.name}</strong> · <span className="font-mono">{c.phone}</span>
                      </span>
                      <button onClick={() => removeContact(i)} className="cursor-pointer p-1 rounded hover:bg-white/15" title={`Remove ${c.name}`}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {contacts.length < MAX_EMERGENCY_CONTACTS && (
                    <div className="flex gap-2">
                      <input
                        value={draft.name}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        placeholder="Name"
                        aria-label="Contact name"
                        maxLength={40}
                        className="min-w-0 flex-1 rounded-lg bg-white text-ink px-3 py-2 text-base outline-none"
                      />
                      <input
                        value={draft.phone}
                        onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                        placeholder="Phone"
                        aria-label="Contact phone"
                        type="tel"
                        maxLength={20}
                        className="min-w-0 flex-1 rounded-lg bg-white text-ink px-3 py-2 text-base outline-none"
                      />
                      <button onClick={addContact} className="cursor-pointer shrink-0 px-3 rounded-lg bg-white text-brick-700" title="Add contact">
                        <Plus size={18} />
                      </button>
                    </div>
                  )}
                  {contactError && <p className="text-xs font-bold">{contactError}</p>}
                  <p className="text-[11px] opacity-80">Saved on this phone, so they work without signal.</p>
                </div>
              )}
            </div>

            <p className="text-[11px] leading-relaxed opacity-80">
              Calls and SMS open in your phone apps: press Call / Send there. SMS needs mobile signal but no
              internet. Without any signal, read your coordinates over a radio, use the siren and light, and stay
              where you are if it is safe. This does not replace a satellite messenger or PLB.
            </p>
          </div>

          <div className="shrink-0 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2">
            <button
              onClick={close}
              className="cursor-pointer w-full py-4 rounded-2xl bg-white text-brick-700 text-lg font-black flex items-center justify-center gap-2"
            >
              <X size={20} /> I'm safe
            </button>
          </div>
        </>
      )}
    </div>,
    document.body,
  );
};
