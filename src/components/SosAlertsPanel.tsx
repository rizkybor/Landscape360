import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Battery, Check, Loader2, MessageCircle, Navigation, Phone, RefreshCw, Siren, X } from "lucide-react";
import { listSosAlerts, resolveSosAlert, type SosAlert } from "../lib/sosAlerts";
import { useSosAlertsStore } from "../store/useSosAlertsStore";
import { useMapStore } from "../store/useMapStore";
import { toDMS, toUTM } from "../utils/surveyUtils";
import { whatsappUrl } from "../lib/profileContact";
import { timeAgo } from "../lib/loginHistory";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

// Admin: S.O.S alerts with the message, full location, battery and times
export const SosAlertsPanel = ({ onClose }: { onClose: () => void }) => {
  const [tab, setTab] = useState<"active" | "all">("active");
  const [alerts, setAlerts] = useState<SosAlert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const reloadActive = useSosAlertsStore((s) => s.loadActive);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setAlerts(await listSosAlerts(tab === "active"));
      setError(null);
    } catch (err) {
      const message = (err as Error).message;
      setError(
        /admin_sos_alerts|could not find the function/i.test(message)
          ? "Run the 20261024000015_sos_alerts migration to receive S.O.S alerts."
          : message,
      );
    } finally {
      setIsLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const resolve = async (a: SosAlert) => {
    setBusyId(a.id);
    try {
      await resolveSosAlert(a.id, note);
      setResolvingId(null);
      setNote("");
      await Promise.all([refresh(), reloadActive()]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const showOnMap = (a: SosAlert) => {
    if (a.lat === null || a.lng === null) return;
    useMapStore.getState().triggerFlyTo({ center: [a.lng, a.lat], zoom: 15, duration: 1500 });
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center md:p-4 bg-ink/40 backdrop-blur-sm md:backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full h-dvh md:h-auto md:max-w-2xl bg-white border-0 md:border md:border-sand-200 rounded-none md:rounded-2xl overflow-hidden flex flex-col md:max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="S.O.S alerts"
      >
        <div className="flex items-center justify-between gap-3 p-4 border-b border-sand-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brick-50 text-brick-600">
              <Siren size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-ink">S.O.S Alerts</h2>
              <p className="text-[10px] text-sand-500">Message, location, battery and times sent by the person</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={refresh}
              disabled={isLoading}
              className="cursor-pointer p-2 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            </button>
            <button onClick={onClose} className="cursor-pointer p-2 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink" title="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex gap-1 p-3 border-b border-sand-100 shrink-0">
          {(["active", "all"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`cursor-pointer px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                tab === t ? "bg-brick-600 text-white" : "bg-sand-50 text-sand-600 hover:bg-sand-100"
              }`}
            >
              {t === "active" ? "Active" : "All (history)"}
            </button>
          ))}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-3">
          {error && <div className="text-[11px] p-2 rounded-lg border bg-brick-50 border-brick-200 text-brick-600">{error}</div>}
          {alerts === null ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-sand-500">
              <Loader2 size={16} className="animate-spin" /> Loading alerts...
            </div>
          ) : alerts.length === 0 ? (
            <div className="py-12 text-center text-xs text-sand-500">
              {tab === "active" ? "No active S.O.S" : "No S.O.S alerts yet"}
            </div>
          ) : (
            alerts.map((a) => {
              const isActive = a.status === "active";
              const wa = a.phone ? whatsappUrl(a.phone) : null;
              return (
                <article
                  key={a.id}
                  className={`p-4 rounded-xl border ${isActive ? "border-brick-300 bg-brick-50/60" : "border-sand-200 bg-sand-50"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${isActive ? "bg-brick-600 text-white" : "bg-sand-200 text-sand-700"}`}>
                          {isActive ? "ACTIVE" : "RESOLVED"}
                        </span>
                        <span className="text-sm font-bold text-ink truncate">{a.name || a.email}</span>
                      </div>
                      <div className="text-[11px] text-sand-600 truncate">
                        {a.email}
                        {a.organization && ` · ${a.organization}`}
                        {a.phone && ` · ${a.phone}`}
                      </div>
                    </div>
                    {a.battery !== null && (
                      <span className={`shrink-0 inline-flex items-center gap-1 text-[11px] font-bold ${a.battery <= 20 ? "text-brick-600" : "text-sand-600"}`}>
                        <Battery size={13} /> {a.battery}%
                      </span>
                    )}
                  </div>

                  {a.message && (
                    <p className="mt-2 text-sm text-ink bg-white border border-sand-200 rounded-lg p-2 whitespace-pre-wrap break-words">“{a.message}”</p>
                  )}

                  <div className="mt-2 rounded-lg bg-white border border-sand-200 p-2 font-mono text-[11px] text-ink">
                    {a.lat !== null && a.lng !== null ? (
                      <>
                        <div className="font-bold">
                          {toDMS(a.lat, true)} {toDMS(a.lng, false)}
                        </div>
                        <div>
                          {a.lat.toFixed(5)}, {a.lng.toFixed(5)} · UTM {toUTM(a.lat, a.lng)}
                        </div>
                        <div className="text-sand-600">
                          {a.elevation !== null && `Elev ${Math.round(a.elevation)} m · `}
                          {a.accuracy !== null && `±${Math.round(a.accuracy)} m · `}
                          fix {a.locatedAt ? timeAgo(a.locatedAt) : "—"} · {a.pointCount} positions
                        </div>
                      </>
                    ) : (
                      <span className="text-sand-600">No GPS position received yet</span>
                    )}
                  </div>

                  <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-sand-600">
                    <dt>S.O.S raised</dt>
                    <dd className="text-ink text-right">{fmt(a.startedAt)}</dd>
                    <dt>Received</dt>
                    <dd className="text-ink text-right">{fmt(a.receivedAt)}</dd>
                    <dt>Last update</dt>
                    <dd className="text-ink text-right">
                      {fmt(a.updatedAt)} ({timeAgo(a.updatedAt)})
                    </dd>
                    {a.resolvedAt && (
                      <>
                        <dt>Resolved</dt>
                        <dd className="text-ink text-right">{fmt(a.resolvedAt)}</dd>
                      </>
                    )}
                  </dl>
                  {a.resolvedNote && <p className="mt-1 text-[11px] text-sand-600">Note: {a.resolvedNote}</p>}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => showOnMap(a)}
                      disabled={a.lat === null}
                      className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-xs font-bold disabled:opacity-40"
                    >
                      <Navigation size={13} /> Show on map
                    </button>
                    {a.phone && (
                      <a href={`tel:${a.phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-sand-200 hover:bg-sand-100 text-sand-700 text-xs font-bold">
                        <Phone size={13} /> Call
                      </a>
                    )}
                    {wa && (
                      <a href={wa} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-sand-200 hover:bg-sand-100 text-sand-700 text-xs font-bold">
                        <MessageCircle size={13} /> WhatsApp
                      </a>
                    )}
                    {isActive && resolvingId !== a.id && (
                      <button
                        onClick={() => {
                          setResolvingId(a.id);
                          setNote("");
                        }}
                        className="cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-brick-200 hover:bg-brick-50 text-brick-600 text-xs font-bold"
                      >
                        <Check size={13} /> Mark resolved
                      </button>
                    )}
                  </div>

                  {resolvingId === a.id && (
                    <div className="mt-2 flex gap-2">
                      <input
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        maxLength={500}
                        placeholder="Note (optional), e.g. found safe by the SAR team"
                        aria-label="Resolution note"
                        className="min-w-0 flex-1 bg-white border border-sand-200 rounded-lg px-3 py-2 text-base sm:text-xs text-ink outline-none focus:border-forest-300"
                      />
                      <button
                        onClick={() => resolve(a)}
                        disabled={busyId === a.id}
                        className="cursor-pointer shrink-0 px-3 rounded-lg bg-brick-600 hover:bg-brick-700 text-white text-xs font-bold disabled:opacity-50"
                      >
                        {busyId === a.id ? <Loader2 size={14} className="animate-spin" /> : "Resolve"}
                      </button>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};
