import { useEffect, useState } from "react";
import { Layer, Source, useMap } from "react-map-gl/mapbox";
import { ChevronDown, ChevronUp, Hexagon, X } from "lucide-react";
import { openAreaLink, openAreaLinkContours } from "../services/markedAreaSync";
import { parseAreaToken } from "../lib/shareLocation";
import { areaFeature, focusMask, formatArea, formatLength, ringBounds } from "../utils/markedAreas";
import type { LinkedArea } from "../types/markedArea";
import { AreaContourLines, type ContourSet } from "./AreaContourLines";

const clearLink = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete("area");
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
};

// A marked area opened from its share link (/?area=<token>), without signing in: the map
// fits the area and darkens everything outside it
export const SharedAreaLayer = () => {
  const { current: mapRef } = useMap();
  const [token] = useState(() => parseAreaToken(window.location.search));
  const [area, setArea] = useState<LinkedArea | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "gone" | "error" | "closed">("loading");
  const [open, setOpen] = useState(true);
  const [contours, setContours] = useState<ContourSet | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    openAreaLink(token)
      .then((a) => {
        if (cancelled) return;
        if (!a) {
          setStatus("gone");
          return;
        }
        setArea(a);
        setStatus("ok");
        // Contours uploaded to the area, if any (website only)
        openAreaLinkContours(token).then((c) => !cancelled && c && setContours({ data: c.data, intervalM: c.intervalM }));
      })
      .catch(() => !cancelled && setStatus("error"));
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Fit the area once the map and the area are both ready
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map || !area) return;
    const fit = () =>
      map.fitBounds(ringBounds(area.ring), { padding: { top: 90, bottom: 220, left: 40, right: 80 }, duration: 1200, maxZoom: 17 });
    if (map.loaded()) fit();
    else map.once("load", fit);
  }, [mapRef, area]);

  if (!token || status === "closed" || status === "loading") return null;

  const close = () => {
    clearLink();
    setStatus("closed");
  };

  if (status === "gone" || status === "error" || !area) {
    return (
      <div className="fixed z-40 top-4 left-1/2 -translate-x-1/2 w-[min(320px,calc(100vw-2rem))] flex items-start gap-2 rounded-xl bg-white border border-sand-200 shadow-xl px-3 py-2.5 text-xs text-ink">
        <span className="flex-1">
          {status === "gone"
            ? "This shared area is no longer available. The owner may have turned the link off."
            : "Could not open the shared area. Check your connection and try again."}
        </span>
        <button onClick={close} className="cursor-pointer p-0.5 rounded hover:bg-sand-100 text-sand-500" aria-label="Close">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <>
      <Source id="shared-area-mask" type="geojson" data={focusMask(area.ring)}>
        <Layer id="shared-area-mask-fill" type="fill" paint={{ "fill-color": "#0b0f08", "fill-opacity": 0.72 }} />
      </Source>
      {contours && <AreaContourLines id="shared-area-contours" sets={[contours]} />}
      <Source id="shared-area" type="geojson" data={areaFeature(area.ring)}>
        <Layer id="shared-area-outline" type="line" paint={{ "line-color": area.color, "line-width": 3.5 }} />
      </Source>

      <div className="fixed z-40 top-4 left-1/2 -translate-x-1/2 w-[min(340px,calc(100vw-2rem))] rounded-2xl bg-white/95 border border-sand-200 shadow-xl text-ink">
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-2">
          <span className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-white" style={{ backgroundColor: area.color === "#ffffff" ? "#7a7561" : area.color }}>
            <Hexagon size={14} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm leading-tight truncate">{area.name}</div>
            <div className="text-[10px] text-sand-500">
              {formatArea(area.areaM2)} · perimeter {formatLength(area.perimeterM)}
              {area.ownerName && ` · shared by ${area.ownerName}`}
            </div>
          </div>
          {area.notes && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="cursor-pointer shrink-0 p-1 rounded-lg text-sand-600 hover:bg-sand-100"
              aria-label={open ? "Hide notes" : "Show notes"}
            >
              {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          )}
          <button onClick={close} className="cursor-pointer shrink-0 p-1 rounded-lg text-sand-500 hover:bg-sand-100" aria-label="Close">
            <X size={14} />
          </button>
        </div>
        {open && area.notes && (
          <p className="px-3 pb-2.5 text-[11px] text-sand-700 whitespace-pre-wrap break-words max-h-28 overflow-y-auto">{area.notes}</p>
        )}
      </div>
    </>
  );
};
