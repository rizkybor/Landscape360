import { useEffect, useMemo, useState } from "react";
import { Popup, Source, Layer } from "react-map-gl/mapbox";
import { useZbiotStore } from "../store/useZbiotStore";

const toFeatureCollection = (positionsBySimei: Record<string, any>) => {
  const features = Object.values(positionsBySimei)
    .filter((p: any) => p && typeof p.lng === "number" && typeof p.lat === "number")
    .map((p: any) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      properties: {
        simei: p.simei,
        time: p.time ?? null,
        power: p.power ?? null,
      },
    }));

  return { type: "FeatureCollection", features } as const;
};

export const ZbiotLayer = ({ mapRef }: { mapRef: React.RefObject<any> }) => {
  const sid = useZbiotStore((s) => s.sid);
  const activeFamilyId = useZbiotStore((s) => s.activeFamilyId);
  const positionsBySimei = useZbiotStore((s) => s.positionsBySimei);
  const isRunInfoLoading = useZbiotStore((s) => s.isRunInfoLoading);
  const selectedSimei = useZbiotStore((s) => s.selectedSimei);
  const setSelectedSimei = useZbiotStore((s) => s.setSelectedSimei);
  const devices = useZbiotStore((s) => s.devices);
  const trackGeoJSON = useZbiotStore((s) => s.trackGeoJSON);
  const trackMeta = useZbiotStore((s) => s.trackMeta);

  const [isPopupVisible, setIsPopupVisible] = useState(false);

  useEffect(() => {
    let rafId: number;
    if (selectedSimei) {
      rafId = requestAnimationFrame(() => setIsPopupVisible(true));
    } else {
      setIsPopupVisible(false);
    }
    return () => cancelAnimationFrame(rafId);
  }, [selectedSimei]);

  useEffect(() => {
    if (!sid || !activeFamilyId) return;
    let stopped = false;
    let intervalId: number | null = null;

    const tick = async () => {
      if (stopped) return;
      if (document.hidden) return;
      await useZbiotStore.getState().refreshRunInfo();
    };

    const setPoll = (ms: number) => {
      if (intervalId) window.clearInterval(intervalId);
      intervalId = window.setInterval(() => tick(), ms);
    };

    tick();
    setPoll(document.hidden ? 30_000 : 5_000);

    const onVisibility = () => {
      if (stopped) return;
      setPoll(document.hidden ? 30_000 : 5_000);
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      if (intervalId) window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [sid, activeFamilyId]);

  const geojson = useMemo(() => toFeatureCollection(positionsBySimei), [positionsBySimei]);

  const selectedPosition = selectedSimei ? positionsBySimei[selectedSimei] : null;
  const deviceBySimei = useMemo(
    () => new Map(devices.map((d) => [d.simei, d] as const)),
    [devices],
  );
  const selectedDevice = selectedSimei ? deviceBySimei.get(selectedSimei) ?? null : null;

  useEffect(() => {
    if (!trackGeoJSON || !mapRef.current) return;
    const map = mapRef.current.getMap?.() ?? mapRef.current;
    if (!map || !trackGeoJSON.features?.length) return;
    const geom: any = trackGeoJSON.features[0]?.geometry;
    const coords: any[] = geom?.coordinates ?? [];
    if (geom?.type !== "LineString" || coords.length < 2) return;
    const lons = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    const bounds = [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ] as any;
    try {
      map.fitBounds(bounds, { padding: 40, duration: 700 });
    } catch {
      // ignore
    }
  }, [trackGeoJSON, mapRef]);

  return (
    <>
      <Source
        id="zbiot-devices"
        type="geojson"
        data={geojson as any}
        cluster={true}
        clusterRadius={50}
        clusterMaxZoom={14}
      >
        <Layer
          id="zbiot-unclustered"
          type="circle"
          filter={["!", ["has", "point_count"]]}
          paint={{
            "circle-color": [
              "case",
              [
                "<=",
                ["-", ["to-number", ["get", "time"]], Math.floor(Date.now() / 1000)],
                300,
              ],
              "#22c55e",
              "#94a3b8",
            ],
            "circle-radius": 6,
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
            "circle-opacity": 0.95,
          }}
        />

        <Layer
          id="zbiot-clusters"
          type="circle"
          filter={["has", "point_count"]}
          paint={{
            "circle-color": [
              "step",
              ["get", "point_count"],
              "#06b6d4",
              50,
              "#0ea5e9",
              200,
              "#2563eb",
            ],
            "circle-radius": ["step", ["get", "point_count"], 16, 50, 22, 200, 28],
            "circle-opacity": 0.9,
          }}
        />

        <Layer
          id="zbiot-cluster-count"
          type="symbol"
          filter={["has", "point_count"]}
          layout={{
            "text-field": "{point_count_abbreviated}",
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            "text-size": 12,
          }}
          paint={{ "text-color": "#ffffff" }}
        />
      </Source>

      {trackGeoJSON && (
        <Source id="zbiot-track" type="geojson" data={trackGeoJSON as any}>
          <Layer
            id="zbiot-track-line"
            type="line"
            paint={{
              "line-color": "#38bdf8",
              "line-width": 4,
              "line-opacity": 0.9,
            }}
          />
        </Source>
      )}

      {selectedPosition && (
        <Popup
          longitude={selectedPosition.lng}
          latitude={selectedPosition.lat}
          anchor="bottom"
          offset={40}
          onClose={() => {
            setIsPopupVisible(false);
            setTimeout(() => setSelectedSimei(null), 300);
          }}
          closeOnClick={true}
          closeButton={true}
          className="z-50"
          maxWidth="320px"
        >
          <div
            className={`p-1 transition-all duration-300 ease-out transform ${
              isPopupVisible ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-4 scale-95"
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <div className="font-bold text-sm text-gray-900 leading-tight">
                  {selectedDevice?.name || selectedDevice?.car_number || "Device"}
                </div>
                <div className="text-[10px] text-gray-500 font-medium mt-0.5">
                  {selectedSimei}
                </div>
              </div>
              <div className="text-[10px] text-gray-500 font-semibold">
                {isRunInfoLoading ? "..." : ""}
              </div>
            </div>
            <div className="space-y-1 text-[11px] text-gray-700">
              <div>
                <span className="font-semibold">Koordinat:</span>{" "}
                {selectedPosition.lat.toFixed(6)}, {selectedPosition.lng.toFixed(6)}
              </div>
              {typeof selectedPosition.power === "number" ? (
                <div>
                  <span className="font-semibold">Baterai:</span>{" "}
                  {selectedPosition.power}%
                </div>
              ) : null}
              {typeof selectedPosition.time === "number" ? (
                <div>
                  <span className="font-semibold">Update:</span>{" "}
                  {new Date(selectedPosition.time * 1000).toLocaleString()}
                </div>
              ) : null}
              {selectedPosition.addr ? (
                <div className="pt-1 text-[10px] text-gray-500 leading-snug">
                  {selectedPosition.addr}
                </div>
              ) : null}
              {trackMeta?.simei === selectedSimei ? (
                <div className="pt-2 mt-2 border-t border-gray-100 text-[10px] text-gray-500">
                  Track: {trackMeta.pointCount} pts
                </div>
              ) : null}
            </div>
          </div>
        </Popup>
      )}
    </>
  );
};
