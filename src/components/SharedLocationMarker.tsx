import { useState } from "react";
import { Marker } from "react-map-gl/mapbox";
import { MapPin, X } from "lucide-react";
import { parseSharedPoint } from "../lib/shareLocation";
import { toDMS } from "../utils/surveyUtils";

// Pin for a location someone shared (/?at=lat,lng); closing it removes it and the link
export const SharedLocationMarker = () => {
  const [point, setPoint] = useState(() => parseSharedPoint(window.location.search));
  if (!point) return null;

  const close = () => {
    setPoint(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("at");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  };

  return (
    <Marker longitude={point.lng} latitude={point.lat} anchor="bottom" style={{ zIndex: 40 }}>
      <div className="flex flex-col items-center">
        <div className="mb-1 flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full bg-white border border-brick-200 shadow-lg text-[10px] whitespace-nowrap">
          <span className="font-bold text-ink">Shared location</span>
          <span className="font-mono text-sand-600">
            {toDMS(point.lat, true)} {toDMS(point.lng, false)}
          </span>
          <button
            onClick={close}
            className="cursor-pointer p-0.5 rounded-full hover:bg-sand-100 text-sand-500 hover:text-ink"
            aria-label="Remove shared location"
            title="Remove"
          >
            <X size={11} />
          </button>
        </div>
        <MapPin size={34} className="text-brick-600 fill-brick-100 drop-shadow-lg" />
      </div>
    </Marker>
  );
};
