import { useEffect, useState } from "react";
import { Marker } from "react-map-gl/mapbox";
import { ChevronDown, ChevronUp, MapPin, Navigation, X } from "lucide-react";
import { openLocationLink, type LinkedLocation } from "../services/markedLocationSync";
import { parsePlaceToken } from "../lib/shareLocation";
import { useMapStore } from "../store/useMapStore";
import { CATEGORY_META, directionsUrl } from "../utils/markedLocations";
import { CATEGORY_ICONS } from "../utils/markedLocationIcons";
import { toDMS } from "../utils/surveyUtils";

const clearLink = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete("place");
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
};

// A marked location opened from a share link (/?place=<token>), shown without signing in
export const SharedPlaceLayer = () => {
  const [token] = useState(() => parsePlaceToken(window.location.search));
  const [place, setPlace] = useState<LinkedLocation | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "gone" | "error">("loading");
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    openLocationLink(token)
      .then((p) => {
        if (cancelled) return;
        if (!p) {
          setStatus("gone");
          return;
        }
        setPlace(p);
        setStatus("ok");
        useMapStore.getState().triggerFlyTo({ center: [p.lng, p.lat], zoom: 16, duration: 1500 });
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) return null;

  const dismiss = () => {
    clearLink();
    setPlace(null);
    setStatus("gone");
    setOpen(false);
  };

  if (status === "gone" || status === "error") {
    if (!open) return null;
    return (
      <div className="fixed z-40 top-4 left-1/2 -translate-x-1/2 w-[min(320px,calc(100vw-2rem))] flex items-start gap-2 rounded-xl bg-white border border-sand-200 shadow-xl px-3 py-2.5 text-xs text-ink">
        <span className="flex-1">
          {status === "gone"
            ? "This shared location is no longer available. The owner may have turned the link off."
            : "Could not open the shared location. Check your connection and try again."}
        </span>
        <button onClick={dismiss} className="cursor-pointer p-0.5 rounded hover:bg-sand-100 text-sand-500" aria-label="Close">
          <X size={14} />
        </button>
      </div>
    );
  }

  if (!place) return null;
  const meta = CATEGORY_META[place.category];
  const Icon = CATEGORY_ICONS[place.category] ?? MapPin;

  return (
    <Marker longitude={place.lng} latitude={place.lat} anchor="bottom" style={{ zIndex: 45 }}>
      <div className="flex flex-col items-center">
        <div className="mb-1.5 w-64 rounded-2xl bg-white border border-sand-200 shadow-xl text-ink text-left">
          <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
            <span
              className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-white"
              style={{ backgroundColor: meta?.color }}
            >
              <Icon size={13} strokeWidth={2.5} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm leading-tight break-words">{place.name}</div>
              <div className="text-[10px] text-sand-500">
                {meta?.label}
                {place.ownerName && ` · shared by ${place.ownerName}`}
              </div>
            </div>
            <button
              onClick={() => setOpen((v) => !v)}
              className="cursor-pointer shrink-0 p-1 rounded-lg text-sand-600 hover:bg-sand-100"
              aria-label={open ? "Hide details" : "Show details"}
            >
              {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            <button onClick={dismiss} className="cursor-pointer shrink-0 p-1 rounded-lg text-sand-500 hover:bg-sand-100" aria-label="Close">
              <X size={14} />
            </button>
          </div>
          {open && (
            <div className="px-3 pb-2.5 space-y-1.5 text-[11px] text-sand-700">
              <div className="font-mono">
                {toDMS(place.lat, true)} {toDMS(place.lng, false)}
                <br />
                {place.lat.toFixed(5)}, {place.lng.toFixed(5)}
                {place.elevationM !== null && ` · ${Math.round(place.elevationM)} mdpl`}
              </div>
              {place.address && <p>{place.address}</p>}
              {place.description && <p className="whitespace-pre-wrap break-words max-h-24 overflow-y-auto">{place.description}</p>}
              {place.contact && <p>Contact: {place.contact}</p>}
              {place.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {place.tags.map((t) => (
                    <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-sand-100">{t}</span>
                  ))}
                </div>
              )}
              <a
                href={directionsUrl(place.lat, place.lng)}
                target="_blank"
                rel="noreferrer"
                className="mt-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-forest-800 hover:bg-forest-700 text-white text-[11px] font-bold"
              >
                <Navigation size={12} /> Directions
              </a>
            </div>
          )}
        </div>
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-white shadow-lg ring-2 ring-white"
          style={{ backgroundColor: meta?.color }}
        >
          <Icon size={15} strokeWidth={2.5} />
        </span>
      </div>
    </Marker>
  );
};
