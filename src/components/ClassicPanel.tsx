import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Crosshair,
  DraftingCompass,
  Link2,
  Lightbulb,
  Lock,
  MapPin,
  MessageCircle,
  Pencil,
  Share2,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { MAX_SIGHTINGS, MIN_SIGHTINGS, fieldWorkLimit, useClassicStore, type PickTarget, type PointInput } from "../store/useClassicStore";
import { useMarkedAreaStore } from "../store/useMarkedAreaStore";
import { useSurveyStore } from "../store/useSurveyStore";
import { revokeFieldWorkLink, saveFieldWorkLink } from "../services/classicShareSync";
import { classicLinkUrl, clearClassicLink, whatsappShareUrl } from "../lib/shareLocation";
import { useMarkedLocationStore } from "../store/useMarkedLocationStore";
import { useTrackRecorderStore } from "../store/useTrackRecorderStore";
import { solveClassic, type ClassicSolution, type SightingState } from "../utils/classicSolve";
import {
  COMPASS_ERROR_DEG,
  COMPASS_POINTS,
  compassPoint,
  compassPointHint,
  fixRadius,
  emptyDms,
  formatCompass,
  type Check as Hint,
  type DmsInput,
} from "../utils/classicNav";
import { CompassDial } from "./CompassDial";
import { toDMS } from "../utils/surveyUtils";

const fieldClass =
  "shrink-0 bg-white border border-sand-200 rounded-lg px-1.5 py-1 text-base sm:text-xs text-ink text-right tabular-nums outline-none focus:border-gold-300 disabled:bg-sand-50";

// Three boxes: degrees ° minutes ' seconds "
const DmsFields = ({
  value,
  onChange,
  label,
  wide,
  disabled,
}: {
  value: DmsInput;
  onChange: (v: DmsInput) => void;
  label: string;
  wide?: boolean;
  disabled?: boolean;
}) => (
  <div className="flex items-center gap-0.5 shrink-0">
    {(["d", "m", "s"] as const).map((part, i) => (
      <label key={part} className="flex items-center gap-0.5">
        <input
          value={value[part]}
          onChange={(e) => onChange({ ...value, [part]: e.target.value })}
          inputMode="decimal"
          placeholder="0"
          disabled={disabled}
          aria-label={`${label} ${["degrees", "minutes", "seconds"][i]}`}
          className={`${fieldClass} ${part === "s" ? "w-16" : part === "d" && wide ? "w-11" : "w-9"}`}
        />
        <span className="text-[11px] text-sand-500 w-1.5">{["°", "'", '"'][i]}</span>
      </label>
    ))}
  </div>
);

const Toggle = ({ options, value, onChange, label }: { options: [string, string]; value: boolean; onChange: (v: boolean) => void; label: string }) => (
  <div className="flex rounded-lg border border-sand-200 overflow-hidden shrink-0" role="group" aria-label={label}>
    {options.map((o, i) => {
      const active = value === (i === 1);
      return (
        <button
          key={o}
          onClick={() => onChange(i === 1)}
          aria-pressed={active}
          className={`cursor-pointer px-1.5 py-1 text-[10px] font-bold ${active ? "bg-forest-800 text-white" : "bg-white text-sand-600 hover:bg-sand-50"}`}
        >
          {o}
        </button>
      );
    })}
  </div>
);

const HintLine = ({ hint }: { hint: Hint | { verdict: "off"; message: string } }) => {
  const style = hint.verdict === "ok" ? "text-forest-700" : hint.verdict === "close" ? "text-gold-800" : "text-brick-600";
  const Icon = hint.verdict === "ok" ? CheckCircle2 : hint.verdict === "close" ? Lightbulb : AlertTriangle;
  return (
    <p className={`flex gap-1 text-[10px] leading-snug font-semibold ${style}`}>
      <Icon size={11} className="shrink-0 mt-px" />
      <span>{hint.message}</span>
    </p>
  );
};

const SubStep = ({ n, done, title, children, disabled }: { n: string; done: boolean; title: string; children: ReactNode; disabled?: boolean }) => (
  <div className={`space-y-1.5 ${disabled ? "opacity-45 pointer-events-none" : ""}`} aria-disabled={disabled}>
    <div className="flex items-center gap-1.5 text-[11px] font-bold">
      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${done ? "bg-forest-700 text-white" : "bg-sand-100 text-sand-700"}`}>
        {done ? <Check size={9} /> : n}
      </span>
      {title}
    </div>
    <div className="pl-5 space-y-1.5">{children}</div>
  </div>
);

const CheckButton = ({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-label={label}
    className="cursor-pointer shrink-0 px-2.5 py-1 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-[10px] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
  >
    Check
  </button>
);

const metresText = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

// A bearing with its compass point; the point explains itself (in Indonesian) on hover / tap
const Bearing = ({ deg }: { deg: number }) => {
  const point = compassPoint(deg);
  return (
    <>
      {formatCompass(deg)}{" "}
      <abbr title={compassPointHint(point)} className="no-underline cursor-help border-b border-dotted border-current">
        {point}
      </abbr>
    </>
  );
};

// Classic: practise resection and intersection with a map and compass, every coordinate and
// bearing typed by hand in degrees, minutes and seconds. Website only.
// Each sighting goes position -> azimuth -> back azimuth, then the next sighting opens.
export const ClassicPanel = () => {
  const store = useClassicStore();
  const { isPanelOpen, setPanelOpen, mode, setMode, sightings, origin, declination, picking, lineLengths, fieldWorks, activeFieldWork } = store;
  const isTrackRecorderOpen = useTrackRecorderStore((s) => s.isPanelOpen);
  const isMarkedLocationsOpen = useMarkedLocationStore((s) => s.isPanelOpen);
  const isMarkedAreasOpen = useMarkedAreaStore((s) => s.isPanelOpen);
  const [copied, setCopied] = useState(false);
  const [showDeclination, setShowDeclination] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  // Field Work being renamed, and the one waiting for "delete?" to be confirmed
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [confirmDeleteFw, setConfirmDeleteFw] = useState<string | null>(null);
  // Sighting cards the user has hidden (by index); all are shown at first
  const [hiddenCards, setHiddenCards] = useState<Record<number, boolean>>({});
  const [originHidden, setOriginHidden] = useState(false);
  const [showPointsHint, setShowPointsHint] = useState(false);

  // Phone: a bottom sheet. Dragging it down lowers it to its header so the map (and the
  // lines) can be seen; a tap or a drag up brings it back. Desktop: a floating panel.
  const [isPhone, setIsPhone] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsPhone(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  // Minimized (desktop and phone): only the header shows
  const [lowered, setLowered] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const dragStart = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    dragStart.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (dragStart.current === null) return;
    const dy = e.touches[0].clientY - dragStart.current;
    // Down while open, up while lowered
    if ((!lowered && dy > 6) || (lowered && dy < -6)) setDrag(dy);
  };
  const onTouchEnd = () => {
    if (drag !== null) {
      if (!lowered && drag > 60) setLowered(true);
      else if (lowered && drag < -40) setLowered(false);
    }
    dragStart.current = null;
    setDrag(null);
  };

  // The Track Recorder, Marked Locations and Marked Areas panels use the same spot on screen
  useEffect(() => {
    if (isTrackRecorderOpen || isMarkedLocationsOpen || isMarkedAreasOpen) setPanelOpen(false);
  }, [isTrackRecorderOpen, isMarkedLocationsOpen, isMarkedAreasOpen, setPanelOpen]);

  const sol = useMemo(
    () => solveClassic({ mode, sightings, origin, declination }),
    [mode, sightings, origin, declination],
  );

  // More than one Field Work per mode: Pro, Enterprise and admin
  const { user, subscriptionStatus, isAdmin } = useSurveyStore();
  const fwLimit = fieldWorkLimit({ hasUser: !!user, subscriptionStatus, isAdmin });
  const canAddFieldWork = fwLimit === null || fieldWorks[mode].length < fwLimit;

  // A shared Field Work opened from its link: shown read only instead of the user's own
  const viewing = store.viewing;
  const viewSol = useMemo(
    () => (viewing ? solveClassic({ mode: viewing.mode, sightings: viewing.sightings, origin: viewing.origin, declination: viewing.declination }) : null),
    [viewing],
  );

  // Sharing the open Field Work (every signed-in account). The link always shows the latest
  // version: once shared, each change is saved to it shortly after typing stops.
  const activeFw = fieldWorks[mode].find((f) => f.id === activeFieldWork[mode]);
  const shareToken = activeFw?.shareToken ?? null;
  const [shareOpen, setShareOpen] = useState(false);
  const [shareStatus, setShareStatus] = useState<{ kind: "saving" | "saved" | "error"; text?: string } | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const shareData = () => ({ sightings, origin, lineLengths, declination });
  useEffect(() => {
    if (!shareToken || !user || !activeFw) return;
    const timer = setTimeout(() => {
      setShareStatus({ kind: "saving" });
      saveFieldWorkLink({ token: shareToken, mode, name: activeFw.name, data: { sightings, origin, lineLengths, declination } })
        .then((token) => {
          // A link turned off elsewhere comes back as a new one
          if (token !== shareToken) store.setShareToken(activeFw.id, token);
          setShareStatus({ kind: "saved" });
        })
        .catch((err: Error) => setShareStatus({ kind: "error", text: err.message }));
    }, 1200);
    return () => clearTimeout(timer);
    // Save when the shared Field Work's content or name changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareToken, user, sightings, origin, lineLengths, declination, activeFw?.name, mode]);

  if (!isPanelOpen) return null;

  const resection = mode === "resection";
  const modeFieldWorks = fieldWorks[mode];
  const activeName = viewing?.name ?? modeFieldWorks.find((f) => f.id === activeFieldWork[mode])?.name ?? "Field Work";

  const startSharing = async () => {
    if (!user || !activeFw) return;
    setShareStatus({ kind: "saving" });
    try {
      const token = await saveFieldWorkLink({ token: null, mode, name: activeFw.name, data: shareData() });
      store.setShareToken(activeFw.id, token);
      setShareStatus({ kind: "saved" });
    } catch (err) {
      setShareStatus({ kind: "error", text: (err as Error).message });
    }
  };
  const stopSharing = async () => {
    if (!activeFw || !shareToken) return;
    await revokeFieldWorkLink(shareToken).catch(() => undefined);
    store.setShareToken(activeFw.id, null);
    setShareStatus(null);
  };
  const shareUrl = shareToken ? classicLinkUrl(shareToken) : null;
  const closeViewing = () => {
    clearClassicLink();
    store.setViewing(null);
  };

  // A shared Field Work, read only: who shared it, the bearings and (intersection) the answer
  const viewBody = (v: ClassicSolution) => {
    if (!viewing) return null;
    const isResection = viewing.mode === "resection";
    return (
      <div className="space-y-2">
        <section aria-label="Shared Field Work" className="rounded-lg border border-gold-200 bg-gold-50/40 p-2.5 space-y-0.5">
          <div className="text-[9px] uppercase tracking-wider font-bold text-gold-700">Shared Field Work · view only</div>
          <h4 className="text-sm font-bold">{viewing.name}</h4>
          <p className="text-[10px] text-sand-600">
            {cap(viewing.mode)} · shared by {viewing.ownerName ?? "a Landscape 360 user"} · updated{" "}
            {new Date(viewing.updatedAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
        </section>
        {isResection && v.origin && (
          <p className="text-[11px] text-sand-700 tabular-nums">
            <strong>Position (estimate):</strong> {toDMS(v.origin[1], true)} · {toDMS(v.origin[0], false)}
          </p>
        )}
        <ul className="space-y-1">
          {v.sightings.map((sg, i) => (
            <li key={i} className="rounded-lg bg-white border border-sand-200 px-2 py-1.5 text-[11px] space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">{cap(sg.label)}</span>
                <span className="tabular-nums text-sand-700">
                  Az <strong className="text-brick-600">{sg.azimuth.value !== null ? <Bearing deg={sg.azimuth.value} /> : "—"}</strong>
                  {" · "}Back <strong className="text-gold-800">{sg.complete && sg.back.value !== null ? <Bearing deg={sg.back.value} /> : "—"}</strong>
                </span>
              </div>
              {!isResection && sg.point && (
                <div className="text-[10px] text-sand-500 tabular-nums">
                  {toDMS(sg.point[1], true)} · {toDMS(sg.point[0], false)}
                </div>
              )}
            </li>
          ))}
        </ul>
        {!isResection && v.fix && (
          <div className="rounded-lg bg-white border border-gold-200 p-2 text-center">
            <div className="text-[10px] font-bold text-sand-600">X: the object's position</div>
            <div className="text-sm font-bold tabular-nums">
              {toDMS(v.fix.point[1], true)} · {toDMS(v.fix.point[0], false)}
            </div>
            <div className="text-[10px] font-bold text-brick-600">Most likely within ±{metresText(fixRadius(v.fix))}</div>
          </div>
        )}
        {v.review.map((h) => (
          <HintLine key={h.message} hint={h} />
        ))}
        {pointsHint}
        <button
          onClick={closeViewing}
          className="cursor-pointer w-full py-1.5 rounded-lg border border-sand-300 hover:bg-sand-50 text-[11px] font-bold text-sand-700"
        >
          Close and open my own Classic
        </button>
      </div>
    );
  };

  if (picking !== null) {
    const what = picking === "origin" ? "your position" : sol.sightings[picking]?.label;
    return (
      <div className="fixed z-[60] bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 rounded-full bg-white/95 backdrop-blur-md border border-gold-300 text-ink text-xs shadow-2xl">
        <Crosshair size={14} className="text-gold-700 animate-pulse" />
        <span className="font-bold">Tap the map to place {what}</span>
        <button onClick={store.stopPicking} className="cursor-pointer px-2 py-0.5 rounded-full bg-sand-100 hover:bg-sand-200 text-sand-700 font-bold">
          Cancel
        </button>
      </div>
    );
  }

  // Render helpers, not components: a component defined here would remount (and lose focus) on every keystroke
  const pointFields = (
    title: string,
    p: PointInput,
    onChange: (patch: Partial<PointInput>) => void,
    target: PickTarget,
    error: string | null,
    onClear: () => void,
  ) => (
    <div className="space-y-1">
      <div className="flex items-center justify-end gap-1">
        <button
          onClick={() => store.startPicking(target)}
          className="cursor-pointer flex items-center gap-1 px-2 py-0.5 rounded-lg bg-sand-100 hover:bg-sand-200 text-[10px] font-bold"
        >
          <MapPin size={11} /> Pick on map
        </button>
        <button onClick={onClear} className="cursor-pointer p-1 rounded-lg hover:bg-sand-100 text-sand-500" aria-label={`Clear ${title}`} title="Clear">
          <X size={11} />
        </button>
      </div>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-1.5 gap-y-1">
        <span className="text-[10px] text-sand-600 w-7">Lat</span>
        <DmsFields value={p.lat} onChange={(lat) => onChange({ lat })} label={`${title} latitude`} />
        <Toggle options={["N", "S"]} value={p.south} onChange={(south) => onChange({ south })} label="North or south" />
        <span className="text-[10px] text-sand-600 w-7">Long</span>
        <DmsFields value={p.lng} onChange={(lng) => onChange({ lng })} label={`${title} longitude`} wide />
        <Toggle options={["E", "W"]} value={p.west} onChange={(west) => onChange({ west })} label="East or west" />
      </div>
      {error && <HintLine hint={{ verdict: "off", message: error }} />}
    </div>
  );

  // Compass degrees, 0–360
  const degreeField = (value: string, onChange: (v: string) => void, label: string, disabled: boolean) => (
    <label className="flex items-center gap-1">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        placeholder="0–360"
        disabled={disabled}
        aria-label={label}
        className={`${fieldClass} w-24 text-sm sm:text-sm font-bold`}
      />
      <span className="text-sm text-sand-600">°</span>
    </label>
  );

  const answer = (value: number | null) =>
    value !== null && (
      <p className="text-[10px] text-sand-600">
        Answer: <strong className="tabular-nums">{formatCompass(value)}</strong>
      </p>
    );

  const sightingCard = (s: SightingState, i: number) => {
    const raw = sightings[i];
    const title = cap(s.label);
    const azLabel = resection ? `From you to ${s.label}` : `From ${s.label} to the object`;
    const backLabel = resection ? `From ${s.label} back to you` : `From the object back to ${s.label}`;
    return (
      <section
        key={i}
        aria-label={title}
        aria-disabled={!s.open}
        className={`rounded-lg border p-2.5 space-y-2.5 ${!s.open ? "opacity-50 pointer-events-none" : ""} ${
          s.complete ? "border-forest-200 bg-forest-50/40" : "border-sand-200 bg-white"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold ${s.complete ? "bg-forest-700 text-white" : "bg-gold-100 text-gold-800"}`}>
            {s.complete ? <Check size={12} /> : String.fromCharCode(65 + i)}
          </span>
          <h4 className="flex-1 min-w-0 text-xs font-bold">
            {title}
            <span className="block text-[10px] font-normal text-sand-500">
              {resection
                ? `Sight ${s.label} with the compass from your position, then work out its back azimuth`
                : i === 0
                  ? "Where you stand, known exactly on the map"
                  : "Another place, far enough away, with the same object still in sight"}
            </span>
          </h4>
          <button
            onClick={() => setHiddenCards((h) => ({ ...h, [i]: !h[i] }))}
            aria-expanded={!hiddenCards[i]}
            className="cursor-pointer p-1 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink"
            title={hiddenCards[i] ? "Show" : "Hide"}
            aria-label={`${hiddenCards[i] ? "Show" : "Hide"} ${s.label}`}
          >
            {hiddenCards[i] ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
          {sightings.length > MIN_SIGHTINGS && (
            <button
              onClick={() => {
                store.removeSighting(i);
                // The cards after it move up a letter
                setHiddenCards({});
              }}
              className="cursor-pointer p-1 rounded-lg hover:bg-brick-50 text-brick-600"
              aria-label={`Remove ${s.label}`}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>

        {hiddenCards[i] ? (
          // Hidden: one line with what has been entered
          <p className="text-[10px] text-sand-600 tabular-nums">
            {!resection && (s.point ? `${toDMS(s.point[1], true)} · ${toDMS(s.point[0], false)} · ` : "No position yet · ")}
            Az {s.azimuth.value !== null ? <Bearing deg={s.azimuth.value} /> : "—"} · Back{" "}
            {s.complete && s.back.value !== null ? <Bearing deg={s.back.value} /> : "—"}
          </p>
        ) : (
          <>
            {/* Resection finds every reference point in the first step; intersection here, as you move */}
            {!resection && (
              <SubStep n="1" title={`Find ${s.label} on the map`} done={!!s.point}>
                {pointFields(title, raw.point, (patch) => store.setSightingPoint(i, patch), i, s.pointError, () =>
                  store.setSightingPoint(i, { lat: emptyDms(), lng: emptyDms() }),
                )}
              </SubStep>
            )}

            <SubStep n={resection ? "1" : "2"} title="Azimuth" done={s.backOpen} disabled={!s.azOpen}>
              <div className="flex gap-3">
                <CompassDial
                  value={s.azimuth.value}
                  onChange={(deg) => store.updateSighting(i, { azimuth: String(deg) })}
                  label={`${title} azimuth compass`}
                  disabled={!s.azOpen}
                />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <span className="block text-[10px] text-sand-600">{azLabel}</span>
                  {degreeField(raw.azimuth, (azimuth) => store.updateSighting(i, { azimuth }), `${title} azimuth`, !s.azOpen)}
                  <p className="text-[10px] text-sand-500 leading-snug">
                    {resection
                      ? `Drawn as a red line from your position toward ${s.label}.`
                      : `Drawn as a red line from ${s.label} toward the object.`}
                  </p>
                </div>
              </div>
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  {s.azimuth.error && <HintLine hint={{ verdict: "off", message: s.azimuth.error }} />}
                </div>
                <CheckButton onClick={() => store.check(i, "azChecks")} disabled={s.azimuth.value === null} label={`Check ${s.label} azimuth`} />
              </div>
            </SubStep>

            <SubStep n={resection ? "2" : "3"} title="Back azimuth" done={s.complete} disabled={!s.backOpen}>
              <div className="flex gap-3">
                {/* The azimuth stays on the dial, faint, so the half turn between them shows */}
                <CompassDial
                  value={s.back.value}
                  ghost={s.backOpen ? s.azimuth.value : null}
                  onChange={(deg) => store.updateSighting(i, { back: String(deg) })}
                  label={`${title} back azimuth compass`}
                  disabled={!s.backOpen}
                />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <span className="block text-[10px] text-sand-600">{backLabel}</span>
                  {degreeField(raw.back, (back) => store.updateSighting(i, { back }), `${title} back azimuth`, !s.backOpen)}
                  <p className="text-[10px] text-sand-500 leading-snug">
                    {`Drawn as a gold dashed line from ${resection ? "your position" : s.label}, the opposite way.`}
                  </p>
                </div>
              </div>
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1 min-w-0">
                  {s.back.error ? <HintLine hint={{ verdict: "off", message: s.back.error }} /> : s.backCheck && <HintLine hint={s.backCheck} />}
                  {answer(s.backAnswer)}
                  {!s.backCheck && !s.back.error && (
                    <p className="text-[10px] text-sand-500 leading-snug">
                      The opposite direction on the compass: add 180° to an azimuth under 180°, subtract 180° from one of 180° or more.
                    </p>
                  )}
                </div>
                <CheckButton onClick={() => store.check(i, "backChecks")} disabled={s.back.value === null} label={`Check ${s.label} back azimuth`} />
              </div>
            </SubStep>
          </>
        )}
      </section>
    );
  };

  const allComplete = sol.sightings.every((s) => s.complete);
  const fix = sol.fix;

  // The map lines can be made longer or shorter by dragging their ends
  const hasHandSetLengths = Object.keys(lineLengths).length > 0;
  const lengthNote = (
    <p className="flex flex-wrap items-center gap-x-2 text-[10px] text-sand-500 leading-snug">
      <span>Drag the dot at the end of a line on the map to make it longer or shorter.</span>
      {hasHandSetLengths && (
        <button onClick={store.resetLineLengths} className="cursor-pointer font-bold text-gold-700 hover:underline">
          Reset line lengths
        </button>
      )}
    </p>
  );

  // What N, ENE, WSW… after a bearing mean, in Indonesian (title tooltips do not show on phones)
  const pointsHint = (
    <>
      <button
        onClick={() => setShowPointsHint((v) => !v)}
        aria-expanded={showPointsHint}
        className="cursor-pointer flex items-center gap-1 text-[10px] font-bold text-gold-700 hover:underline"
      >
        <Lightbulb size={11} /> Apa arti ENE, WSW…?
      </button>
      {showPointsHint && (
        <div className="rounded-lg bg-white border border-gold-200 p-2 space-y-1.5" lang="id">
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            {COMPASS_POINTS.map((p) => {
              const used = (viewSol ?? sol).sightings.some(
                (s) => (s.azimuth.value !== null && compassPoint(s.azimuth.value) === p.abbr) || (s.complete && s.back.value !== null && compassPoint(s.back.value) === p.abbr),
              );
              return (
                <div key={p.abbr} className={`flex items-baseline gap-1.5 text-[10px] leading-tight rounded px-1 py-px ${used ? "bg-gold-100 text-ink" : "text-sand-600"}`}>
                  <span className="w-8 shrink-0 font-bold tabular-nums">{p.abbr}</span>
                  <span className="w-9 shrink-0 tabular-nums">{p.deg}°</span>
                  <span className="min-w-0">{p.id}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );

  const copyResult = async () => {
    if (!fix) return;
    const [lng, lat] = fix.point;
    await navigator.clipboard?.writeText(`${toDMS(lat, true)} ${toDMS(lng, false)}`).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      data-classic-panel
      style={isPhone && drag !== null ? { transform: `translateY(${lowered ? 0 : Math.max(0, drag)}px)`, transition: "none" } : undefined}
      className={`fixed z-[60] flex flex-col bg-white/95 backdrop-blur-md text-ink shadow-2xl overflow-hidden transition-transform duration-300 ${
        isPhone
          ? "inset-x-0 bottom-0 rounded-t-2xl border-t border-sand-300 max-h-[75dvh] pb-[env(safe-area-inset-bottom)]"
          : "left-1/2 -translate-x-1/2 bottom-6 w-[440px] max-h-[75vh] max-h-[75dvh] border border-gold-200 rounded-xl animate-in fade-in slide-in-from-bottom-4 duration-200"
      }`}
    >
      {/* Phone: handle and header, drag here to lower or raise the sheet */}
      {isPhone && (
        <button
          onClick={() => setLowered((v) => !v)}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="cursor-grab touch-none w-full flex justify-center pt-2.5 pb-1 shrink-0"
          aria-label={lowered ? "Raise the Classic sheet" : "Lower the Classic sheet"}
          aria-expanded={!lowered}
        >
          <span className="w-10 h-1.5 bg-sand-200 rounded-full" />
        </button>
      )}
      <div
        onTouchStart={isPhone ? onTouchStart : undefined}
        onTouchMove={isPhone ? onTouchMove : undefined}
        onTouchEnd={isPhone ? onTouchEnd : undefined}
        className={`flex items-center justify-between gap-2 px-3 shrink-0 ${isPhone ? "pb-2" : "py-2"} ${lowered ? "" : "border-b border-sand-200"}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <DraftingCompass size={16} className="text-gold-700 shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-bold truncate">Classic</h3>
            {lowered && (
              <p className="text-[10px] text-sand-600 truncate">
                {activeName} · {fix ? `${toDMS(fix.point[1], true)} · ${toDMS(fix.point[0], false)}` : `${cap(mode)} · ${isPhone ? "swipe up" : "expand"} to continue`}
              </p>
            )}
          </div>
          {!lowered && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full border bg-gold-50 text-gold-700 border-gold-200 shrink-0">
              {viewing ? "Shared · view only" : "Practice"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setLowered((v) => !v)}
            className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink"
            title={lowered ? "Expand" : "Minimize"}
            aria-label={lowered ? "Expand Classic" : "Minimize Classic"}
            aria-expanded={!lowered}
          >
            {lowered ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {!viewing && (
            <button onClick={store.resetExercise} className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink" title="Start over" aria-label="Start over">
              <RotateCcw size={14} />
            </button>
          )}
          <button
            onClick={() => {
              if (viewing) closeViewing();
              setPanelOpen(false);
            }}
            className="cursor-pointer p-1.5 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink"
            title="Close"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-2 ${lowered ? "hidden" : ""}`}>
        {viewing && viewSol ? (
          viewBody(viewSol)
        ) : (
        <>
        <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-sand-100" role="tablist" aria-label="Exercise">
          {(["resection", "intersection"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setRenaming(null);
                setConfirmDeleteFw(null);
                setHiddenCards({});
              }}
              className={`cursor-pointer py-1.5 rounded-md text-xs font-bold ${mode === m ? "bg-white shadow text-ink" : "text-sand-600 hover:text-ink"}`}
            >
              <span className="capitalize">{m}</span>
              <span className="block text-[10px] font-normal text-sand-500">
                {m === "resection" ? "Where am I on the map?" : "Where is the object I see?"}
              </span>
            </button>
          ))}
        </div>
        {/* Field Works: separate exercises in this mode; the open one is on the map */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5" role="tablist" aria-label="Field Works">
            {modeFieldWorks.map((f) => {
              const active = f.id === activeFieldWork[mode];
              return (
                <button
                  key={f.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    store.selectFieldWork(f.id);
                    setShareOpen(false);
                    setShareStatus(null);
                    setRenaming(null);
                    setConfirmDeleteFw(null);
                    setHiddenCards({});
                  }}
                  className={`cursor-pointer shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap ${
                    active ? "bg-forest-800 text-white border-forest-800" : "bg-white text-sand-700 border-sand-200 hover:border-gold-300"
                  }`}
                >
                  {f.name}
                </button>
              );
            })}
            <button
              onClick={() => {
                store.addFieldWork(fwLimit);
                setRenaming(null);
                setConfirmDeleteFw(null);
                setHiddenCards({});
                setShareOpen(false);
              }}
              disabled={!canAddFieldWork}
              title={canAddFieldWork ? "New Field Work" : "Field Work limit reached"}
              className="cursor-pointer shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border border-dashed border-sand-300 text-sand-700 hover:bg-sand-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {canAddFieldWork ? <Plus size={12} /> : <Lock size={11} />} New
            </button>
          </div>
          {renaming ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                store.renameFieldWork(renaming.id, renaming.name);
                setRenaming(null);
              }}
              className="flex items-center gap-1.5"
            >
              <input
                autoFocus
                value={renaming.name}
                maxLength={40}
                onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
                aria-label="Field Work name"
                className="flex-1 min-w-0 bg-white border border-sand-200 rounded-lg px-2 py-1 text-base sm:text-xs outline-none focus:border-gold-300"
              />
              <button type="submit" className="cursor-pointer px-2.5 py-1 rounded-lg bg-forest-800 text-white text-[11px] font-bold">
                Save
              </button>
              <button type="button" onClick={() => setRenaming(null)} className="cursor-pointer px-2 py-1 rounded-lg bg-sand-100 text-sand-700 text-[11px] font-bold">
                Cancel
              </button>
            </form>
          ) : (
            <div className="flex items-center gap-1.5 text-[10px] text-sand-600">
              <span className="flex-1 min-w-0 truncate">
                <strong className="text-ink">{activeName}</strong> · {modeFieldWorks.length}
                {fwLimit === null ? "" : `/${fwLimit}`} Field Work{modeFieldWorks.length === 1 && fwLimit === 1 ? "" : "s"} in {cap(mode)}
              </span>
              <button
                onClick={() => setShareOpen((v) => !v)}
                aria-expanded={shareOpen}
                className={`cursor-pointer p-1 rounded-lg ${shareToken ? "text-forest-700 bg-forest-50" : "text-sand-600 hover:bg-sand-100 hover:text-ink"}`}
                title={shareToken ? "Shared: link" : "Share"}
                aria-label={`Share ${activeName}`}
              >
                <Share2 size={12} />
              </button>
              <button
                onClick={() => setRenaming({ id: activeFieldWork[mode], name: activeName })}
                className="cursor-pointer p-1 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink"
                title="Rename"
                aria-label={`Rename ${activeName}`}
              >
                <Pencil size={12} />
              </button>
              {confirmDeleteFw === activeFieldWork[mode] ? (
                <span className="flex items-center gap-1 text-brick-600 font-bold">
                  {modeFieldWorks.length > 1 ? "Delete?" : "Clear it?"}
                  <button
                    onClick={() => {
                      if (shareToken && modeFieldWorks.length > 1) revokeFieldWorkLink(shareToken).catch(() => undefined);
                      store.deleteFieldWork(activeFieldWork[mode]);
                      setShareOpen(false);
                      setShareStatus(null);
                      setConfirmDeleteFw(null);
                      setHiddenCards({});
                    }}
                    className="cursor-pointer px-2 py-0.5 rounded-lg bg-brick-600 text-white"
                  >
                    Yes
                  </button>
                  <button onClick={() => setConfirmDeleteFw(null)} className="cursor-pointer px-2 py-0.5 rounded-lg bg-sand-100 text-sand-700">
                    No
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmDeleteFw(activeFieldWork[mode])}
                  className="cursor-pointer p-1 rounded-lg hover:bg-brick-50 text-brick-600"
                  title={modeFieldWorks.length > 1 ? "Delete" : "Clear"}
                  aria-label={`Delete ${activeName}`}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          )}
          {!canAddFieldWork && (
            <p className="text-[10px] text-sand-500">
              {fwLimit === 1
                ? "Pro (5) and Enterprise (10) accounts can keep several Field Works in each mode; admin has no limit."
                : `Your ${subscriptionStatus} plan allows ${fwLimit} Field Works in each mode. Delete one to add another.`}
            </p>
          )}
          {shareOpen && (
            <div className="rounded-lg border border-gold-200 bg-gold-50/50 p-2.5 space-y-2 text-[11px]">
              <p className="text-[10px] text-sand-700 leading-snug">
                Anyone with the link can look at this Field Work, with or without an account. They cannot change it. The link
                always shows your latest version.
              </p>
              {!user ? (
                <p className="text-[10px] font-bold text-sand-700">Sign in to share this Field Work.</p>
              ) : !shareUrl ? (
                <button
                  onClick={startSharing}
                  disabled={shareStatus?.kind === "saving"}
                  className="cursor-pointer w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-forest-800 hover:bg-forest-700 text-white font-bold disabled:opacity-50"
                >
                  <Link2 size={12} /> {shareStatus?.kind === "saving" ? "Creating link…" : "Create link"}
                </button>
              ) : (
                <>
                  <input
                    readOnly
                    value={shareUrl}
                    onFocus={(e) => e.target.select()}
                    aria-label="Share link"
                    className="w-full bg-white border border-sand-200 rounded-lg px-2 py-1 text-[11px] text-ink font-mono"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={async () => {
                        await navigator.clipboard?.writeText(shareUrl).catch(() => undefined);
                        setLinkCopied(true);
                        setTimeout(() => setLinkCopied(false), 1500);
                      }}
                      className="cursor-pointer flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-sand-200 hover:border-gold-300 font-bold"
                    >
                      {linkCopied ? <Check size={12} /> : <Copy size={12} />} {linkCopied ? "Copied" : "Copy link"}
                    </button>
                    <a
                      href={whatsappShareUrl(
                        `🧭 ${activeName} (${cap(mode)} practice)\nOpen on Landscape 360 (no sign-in needed): ${shareUrl}`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#25D366] text-white font-bold"
                    >
                      <MessageCircle size={12} /> WhatsApp
                    </a>
                    <button
                      onClick={stopSharing}
                      className="cursor-pointer ml-auto px-2.5 py-1 rounded-lg bg-sand-100 hover:bg-brick-50 text-brick-600 font-bold"
                    >
                      Stop sharing
                    </button>
                  </div>
                </>
              )}
              {shareStatus && (
                <p
                  role={shareStatus.kind === "error" ? "alert" : "status"}
                  className={`text-[10px] font-bold ${shareStatus.kind === "error" ? "text-brick-600" : "text-forest-700"}`}
                >
                  {shareStatus.kind === "saving" ? "Saving…" : shareStatus.kind === "saved" ? "Saved: the link shows this version." : shareStatus.text}
                </p>
              )}
            </div>
          )}
        </div>

        {/* How it works: the method, step by step (hidden until asked for) */}
        <div className="rounded-lg border border-sand-200 bg-sand-50">
          <button
            onClick={() => setShowSteps((v) => !v)}
            aria-expanded={showSteps}
            className="cursor-pointer w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left"
          >
            <span className="text-[11px] font-bold">How it works</span>
            {showSteps ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showSteps && (
            <div className="px-2.5 pb-2.5 space-y-1.5">
            <p className="text-[11px] text-sand-700 leading-relaxed text-justify">
              {resection
                ? "Set your position on the map once, then sight each point with the compass. Its azimuth and back azimuth are drawn as lines from where you stand."
                : "Find where an object you see is on the map, by sighting it from two positions you know."}
            </p>
            <ol className="space-y-1 text-[10px] text-sand-700 leading-snug list-decimal pl-4 marker:font-bold marker:text-gold-700">
              {(resection
                ? [
                    "Find your position on the map, once (pick it or type degrees, minutes and seconds).",
                    "Sight point A with the compass and note the azimuth (e.g. 60°).",
                    "Work out the back azimuth: under 180° add 180°, over 180° subtract 180° (60° + 180° = 240°).",
                    "Both are drawn from your position: the azimuth toward point A, the back azimuth the opposite way.",
                    "Repeat steps 2–4 for point B (and C, D… if you like): only the azimuth and back azimuth.",
                  ]
                : [
                    "Make sure your position (position A) is known exactly on the map.",
                    "Sight the object from position A with the compass and note the azimuth.",
                    "Work out the back azimuth: under 180° add 180°, over 180° subtract 180°.",
                    "Both are drawn from position A: the azimuth toward the object, the back azimuth the opposite way.",
                    "Move to another position (position B), far enough away but with the object still in sight, and find it exactly on the map.",
                    "Sight the object again from position B, note the azimuth and work out its back azimuth.",
                    "Where the azimuth lines from A and B cross (X) is the object.",
                  ]
              ).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            </div>
          )}
        </div>

        {/* Resection: your position, set once; every line starts from it */}
        {resection && (
          <section
            aria-label="Your position"
            className={`rounded-lg border p-2.5 space-y-2 ${sol.origin ? "border-forest-200 bg-forest-50/40" : "border-sand-200 bg-white"}`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold ${sol.origin ? "bg-forest-700 text-white" : "bg-gold-100 text-gold-800"}`}>
                {sol.origin ? <Check size={12} /> : <MapPin size={12} />}
              </span>
              <h4 className="flex-1 min-w-0 text-xs font-bold">
                Your position on the map <span className="font-normal text-sand-500">(estimate)</span>
                {originHidden && (
                  <span className="block text-[10px] font-normal text-sand-600 tabular-nums">
                    {sol.origin ? `${toDMS(sol.origin[1], true)} · ${toDMS(sol.origin[0], false)}` : "Not set yet"}
                  </span>
                )}
                {!originHidden && (
                  <span className="block text-[10px] font-normal text-sand-500">
                    Set once: every point's azimuth and back azimuth start here. It is only an estimate of where you
                    stand (from the map or GPS), so the lines are only as accurate as this point.
                  </span>
                )}
              </h4>
              <button
                onClick={() => setOriginHidden((v) => !v)}
                aria-expanded={!originHidden}
                className="cursor-pointer p-1 rounded-lg hover:bg-sand-100 text-sand-600 hover:text-ink"
                title={originHidden ? "Show" : "Hide"}
                aria-label={`${originHidden ? "Show" : "Hide"} your position`}
              >
                {originHidden ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
            </div>
            {!originHidden && pointFields("Your position", origin, store.setOrigin, "origin", sol.originError, store.clearOrigin)}
          </section>
        )}

        <div className="px-0.5">
          <button onClick={() => setShowDeclination((v) => !v)} aria-expanded={showDeclination} className="cursor-pointer text-[10px] text-gold-700 font-bold hover:underline">
            Magnetic declination: {sol.declination.value ?? "?"}°
          </button>
          {showDeclination && (
            <div className="mt-1 space-y-1">
              <label className="flex items-center gap-2 text-[10px] text-sand-700">
                Declination (east +, west −)
                <input value={declination} onChange={(e) => store.setDeclination(e.target.value)} inputMode="decimal" className={`${fieldClass} w-14`} aria-label="Magnetic declination in degrees" />°
              </label>
              <p className="text-[10px] text-sand-500 leading-snug">
                A compass points to magnetic north. True bearing = compass reading + declination. Across Indonesia it is within about 1°, so 0 is fine for practice; leave it at 0 if you read bearings off the map.
              </p>
              {sol.declination.error && <HintLine hint={{ verdict: "off", message: sol.declination.error }} />}
            </div>
          )}
        </div>

        {sol.sightings.map(sightingCard)}

        {sightings.length < MAX_SIGHTINGS && (
          <button
            onClick={store.addSighting}
            disabled={!allComplete}
            className="cursor-pointer w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-sand-300 hover:bg-sand-50 text-xs font-bold text-sand-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={13} /> {`Add ${resection ? "point" : "position"} ${String.fromCharCode(65 + sightings.length)}`}
          </button>
        )}

        {resection && (
          <section aria-label="Result" className={`rounded-lg border p-2.5 space-y-2 ${allComplete ? "border-gold-200 bg-gold-50/40" : "border-sand-200 bg-white"}`}>
            <h4 className="text-xs font-bold">Your sightings</h4>
            {sol.origin && (
              <p className="text-[10px] text-sand-600 tabular-nums">
                From {toDMS(sol.origin[1], true)} · {toDMS(sol.origin[0], false)}
              </p>
            )}
            <ul className="space-y-1">
              {sol.sightings.map((s, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-white border border-sand-200 px-2 py-1.5 text-[11px]">
                  <span className="font-bold">{cap(s.label)}</span>
                  <span className="tabular-nums text-sand-700">
                    Az <strong className="text-brick-600">{s.azimuth.value !== null ? <Bearing deg={s.azimuth.value} /> : "—"}</strong>
                    {" · "}Back <strong className="text-gold-800">{s.complete && s.back.value !== null ? <Bearing deg={s.back.value} /> : "—"}</strong>
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-[10px] text-sand-500 leading-snug">
              {allComplete
                ? "Every line starts at your position: red toward each point, gold the opposite way."
                : "Complete each point (azimuth, then back azimuth) to draw its lines."}
            </p>
            {lengthNote}
            {pointsHint}
          </section>
        )}

        {!resection && (
        <section aria-label="Result" className={`rounded-lg border p-2.5 space-y-2 ${fix ? "border-gold-200 bg-gold-50/40" : "border-sand-200 bg-white"}`}>
          <h4 className="text-xs font-bold">X: the object's position</h4>
          {sol.problem && <HintLine hint={{ verdict: "off", message: sol.problem }} />}
          {fix ? (
            <div className="space-y-2">
              <div className="rounded-lg bg-white border border-gold-200 p-2 text-center">
                <div className="text-sm font-bold tabular-nums">
                  {toDMS(fix.point[1], true)} · {toDMS(fix.point[0], false)}
                </div>
                <div className="text-[10px] text-sand-600 tabular-nums">
                  {fix.point[1].toFixed(6)}, {fix.point[0].toFixed(6)} · {sol.lines.length} lines · best cut {Math.round(fix.cutAngle)}°
                </div>
                <div className="mt-1 text-[10px] font-bold text-brick-600">
                  Most likely within ±{metresText(fixRadius(fix))} (the red circle, for a compass error of ±{COMPASS_ERROR_DEG}°)
                </div>
                <button onClick={copyResult} className="cursor-pointer mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-gold-700 hover:underline">
                  {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? "Copied" : "Copy coordinates"}
                </button>
              </div>
              {sol.review.map((h) => (
                <HintLine key={h.message} hint={h} />
              ))}
              {lengthNote}
              {pointsHint}
            </div>
          ) : (
            !sol.problem && (
              <p className="text-[10px] text-sand-500">
                Complete at least two positions (position, azimuth and back azimuth): one line alone cannot tell where on it the object is; two lines cross at one point, X.
              </p>
            )
          )}
        </section>
        )}
        </>
        )}
      </div>
    </div>
  );
};
