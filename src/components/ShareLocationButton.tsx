import { useEffect, useRef, useState } from "react";
import type { MapRef } from "react-map-gl/mapbox";
import { Check, Copy, Loader2, MessageCircle, Share2, X } from "lucide-react";
import { useSurveyStore } from "../store/useSurveyStore";
import { accountDisplayName } from "../lib/profileContact";
import { getElevationAtPoint } from "../utils/elevationUtils";
import { toDMS } from "../utils/surveyUtils";
import { buildShareLocationText, whatsappShareUrl, type LocationFix } from "../lib/shareLocation";

// Share Location: takes one GPS fix (where you are now, not live) and sends it to WhatsApp,
// another app, or the clipboard
export const ShareLocationButton = ({ mapRef }: { mapRef: React.RefObject<MapRef | null> }) => {
  const user = useSurveyStore((s) => s.user);
  const [state, setState] = useState<"idle" | "locating" | "ready" | "error">("idle");
  const [fix, setFix] = useState<LocationFix | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Close the menu when tapping elsewhere
  useEffect(() => {
    if (state === "idle") return;
    const onDown = (e: PointerEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setState("idle");
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [state]);

  const locate = () => {
    if (state !== "idle") {
      setState("idle");
      return;
    }
    if (!navigator.geolocation) {
      setError("This device has no GPS / location service.");
      setState("error");
      return;
    }
    setState("locating");
    setCopied(false);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, accuracy, altitude } = pos.coords;
        let elevation: number | null = typeof altitude === "number" ? altitude : null;
        const map = mapRef.current?.getMap();
        if (map) {
          // Terrain height is steadier than the phone's GPS altitude
          const terrain = await getElevationAtPoint(map, lng, lat).catch(() => null);
          if (terrain) elevation = terrain;
        }
        setFix({ lat, lng, elevation, accuracy: accuracy ?? null, time: pos.timestamp || Date.now() });
        setState("ready");
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission is off. Allow it in the browser settings."
            : "Could not get your location. Try again in the open sky.",
        );
        setState("error");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    );
  };

  const text = fix ? buildShareLocationText(fix, accountDisplayName(user)) : "";

  const shareOther = async () => {
    try {
      await navigator.share({ title: "My location", text });
      setState("idle");
    } catch {
      // Cancelled by the user: keep the menu open
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (http or permissions)
    }
  };

  const itemClass =
    "cursor-pointer w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-colors";

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={locate}
        className={`backdrop-blur-sm p-2.5 rounded-xl shadow-lg border border-white/20 transition-all active:scale-95 group cursor-pointer ${
          state === "idle" ? "bg-white/90 hover:bg-white" : "bg-forest-800 text-white"
        }`}
        title="Share Location"
        aria-label="Share Location"
        aria-expanded={state !== "idle"}
      >
        {state === "locating" ? (
          <Loader2 size={20} className="animate-spin" />
        ) : (
          <Share2
            size={20}
            className={state === "idle" ? "text-sand-700 group-hover:text-forest-800 transition-colors" : ""}
          />
        )}
      </button>

      {state !== "idle" && (
        <div className="absolute top-0 right-14 w-64 rounded-xl border border-sand-200 bg-white shadow-2xl p-2 z-30 animate-in fade-in slide-in-from-right-4">
          <div className="flex items-center justify-between px-2 pt-1 pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-sand-500">Share Location</span>
            <button
              onClick={() => setState("idle")}
              className="cursor-pointer p-1 rounded hover:bg-sand-100 text-sand-500"
              aria-label="Close"
            >
              <X size={12} />
            </button>
          </div>

          {state === "locating" && <p className="px-2 pb-2 text-xs text-sand-600">Getting your location…</p>}
          {state === "error" && <p className="px-2 pb-2 text-xs text-brick-600">{error}</p>}

          {state === "ready" && fix && (
            <>
              <div className="mx-1 mb-2 rounded-lg bg-sand-50 border border-sand-200 px-2.5 py-2 font-mono text-[11px] text-ink">
                <div className="font-bold">
                  {toDMS(fix.lat, true)} {toDMS(fix.lng, false)}
                </div>
                <div className="text-sand-600">
                  {fix.elevation !== null && `${Math.round(fix.elevation)} mdpl · `}
                  {fix.accuracy !== null && `±${Math.round(fix.accuracy)} m`}
                </div>
              </div>
              <a
                href={whatsappShareUrl(text)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setState("idle")}
                className={`${itemClass} bg-[#25D366] hover:bg-[#1ebe5a] text-white`}
              >
                <MessageCircle size={15} /> Send to WhatsApp
              </a>
              <div className="mt-1 grid grid-cols-2 gap-1">
                {typeof navigator.share === "function" && (
                  <button onClick={shareOther} className={`${itemClass} justify-center bg-sand-50 hover:bg-sand-100 text-ink`}>
                    <Share2 size={13} /> Other apps
                  </button>
                )}
                <button
                  onClick={copy}
                  className={`${itemClass} justify-center bg-sand-50 hover:bg-sand-100 text-ink ${typeof navigator.share === "function" ? "" : "col-span-2"}`}
                >
                  {copied ? <Check size={13} className="text-forest-700" /> : <Copy size={13} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
