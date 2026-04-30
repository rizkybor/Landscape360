import { useEffect, useMemo } from "react";
import { Layer, Marker, Source, useMap } from "react-map-gl/mapbox";
import type { MapMouseEvent, LngLatBoundsLike } from "mapbox-gl";
import mapboxgl from "mapbox-gl";
import { useRouteStore } from "../store/useRouteStore";
import { useSurveyStore } from "../store/useSurveyStore";

const formatKm = (m: number) => (m / 1000).toFixed(2);
const formatMin = (s: number) => Math.round(s / 60);

export const RoutePlannerLayer = ({
  mapboxToken,
}: {
  mapboxToken: string;
}) => {
  const { current: mapRef } = useMap();
  const isPlotMode = useSurveyStore((s) => s.isPlotMode);
  const {
    isRoutePlannerEnabled,
    mode,
    start,
    end,
    routeGeoJSON,
    distanceM,
    durationS,
    isLoading,
    error,
    setStart,
    setEnd,
    clearRoute,
    computeRoute,
  } = useRouteStore();

  const routeColor = useMemo(() => {
    if (mode === "walking") return "#22c55e";
    if (mode === "driving_no_toll") return "#f59e0b";
    return "#3b82f6";
  }, [mode]);

  useEffect(() => {
    if (!mapRef) return;
    if (!isRoutePlannerEnabled || isPlotMode) return;
    const map = mapRef.getMap();

    const handleClick = async (e: MapMouseEvent) => {
      const p = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      const currentStart = useRouteStore.getState().start;
      const currentEnd = useRouteStore.getState().end;

      if (!currentStart) {
        setStart(p);
        return;
      }

      if (!currentEnd) {
        setEnd(p);
        await computeRoute(mapboxToken);
        return;
      }

      clearRoute();
      setStart(p);
    };

    map.on("click", handleClick);
    map.getCanvas().style.cursor = "crosshair";

    return () => {
      map.off("click", handleClick);
      map.getCanvas().style.cursor = "";
    };
  }, [
    mapRef,
    isRoutePlannerEnabled,
    isPlotMode,
    mapboxToken,
    setStart,
    setEnd,
    clearRoute,
    computeRoute,
  ]);

  useEffect(() => {
    if (!mapRef) return;
    if (!routeGeoJSON) return;
    const map = mapRef.getMap();
    const geom = routeGeoJSON.features?.[0]?.geometry as any;
    const coords: Array<[number, number]> | undefined = geom?.coordinates;
    if (!coords || coords.length < 2) return;

    const bounds = coords.reduce((b, c) => b.extend(c as any), new mapboxgl.LngLatBounds(coords[0] as any, coords[0] as any));
    map.fitBounds(bounds as unknown as LngLatBoundsLike, { padding: 64, duration: 800 });
  }, [mapRef, routeGeoJSON]);

  if (!isRoutePlannerEnabled) return null;

  return (
    <>
      {start && (
        <Marker longitude={start.lng} latitude={start.lat} anchor="bottom">
          <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white shadow-md" />
        </Marker>
      )}
      {end && (
        <Marker longitude={end.lng} latitude={end.lat} anchor="bottom">
          <div className="w-3.5 h-3.5 rounded-full bg-rose-500 border-2 border-white shadow-md" />
        </Marker>
      )}

      {routeGeoJSON && (
        <Source id="route-planner-source" type="geojson" data={routeGeoJSON as any}>
          <Layer
            id="route-planner-line"
            type="line"
            paint={{
              "line-color": routeColor,
              "line-width": 4,
              "line-opacity": 0.9,
            }}
            layout={{
              "line-join": "round",
              "line-cap": "round",
            }}
          />
        </Source>
      )}

      <div className="absolute left-4 top-24 md:left-[18rem] md:top-4 z-30 w-[min(360px,calc(100vw-2rem))] rounded-xl border border-white/10 bg-black/70 backdrop-blur-md text-white shadow-xl">
        <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
          <div className="text-xs font-bold">Route Planner</div>
          <button
            onClick={() => useRouteStore.getState().setRoutePlannerEnabled(false)}
            className="cursor-pointer text-xs px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            Close
          </button>
        </div>
        <div className="px-3 py-2 space-y-2">
          <div className="text-[11px] text-white/80">
            {!start
              ? "Click on the map to determine the starting point."
              : !end
                ? "Click on the map to determine the destination point."
                : "Click on the map again to start a new route."}
          </div>

          {error && (
            <div className="text-[11px] text-rose-200 bg-rose-500/10 border border-rose-400/20 px-2 py-1.5 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={async () => {
                useRouteStore.getState().setMode("driving_toll");
                if (useRouteStore.getState().start && useRouteStore.getState().end) {
                  await computeRoute(mapboxToken);
                }
              }}
              className={`cursor-pointer px-2 py-2 rounded-lg text-[11px] font-bold border transition-colors ${
                mode === "driving_toll"
                  ? "bg-blue-500/20 border-blue-400/40 text-blue-100"
                  : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
              }`}
            >
              Vehicle
              <div className="text-[10px] font-normal opacity-80">Via Tol</div>
            </button>
            <button
              onClick={async () => {
                useRouteStore.getState().setMode("driving_no_toll");
                if (useRouteStore.getState().start && useRouteStore.getState().end) {
                  await computeRoute(mapboxToken);
                }
              }}
              className={`cursor-pointer px-2 py-2 rounded-lg text-[11px] font-bold border transition-colors ${
                mode === "driving_no_toll"
                  ? "bg-amber-500/20 border-amber-400/40 text-amber-100"
                  : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
              }`}
            >
              Vehicle
              <div className="text-[10px] font-normal opacity-80">No Tol</div>
            </button>
            <button
              onClick={async () => {
                useRouteStore.getState().setMode("walking");
                if (useRouteStore.getState().start && useRouteStore.getState().end) {
                  await computeRoute(mapboxToken);
                }
              }}
              className={`cursor-pointer px-2 py-2 rounded-lg text-[11px] font-bold border transition-colors ${
                mode === "walking"
                  ? "bg-green-500/20 border-green-400/40 text-green-100"
                  : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
              }`}
            >
              Walk
              <div className="text-[10px] font-normal opacity-80">Footpath</div>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => useRouteStore.getState().swapStartEnd()}
              className="cursor-pointer px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-[11px]"
              disabled={!start || !end}
            >
              Swap
            </button>
            <button
              onClick={() => clearRoute()}
              className="cursor-pointer px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-[11px]"
            >
              Clear
            </button>
            <button
              onClick={async () => computeRoute(mapboxToken)}
              disabled={!start || !end || isLoading}
              className="cursor-pointer px-3 py-2 rounded-lg bg-white/10 border border-white/10 hover:bg-white/20 transition-colors text-[11px] font-bold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? "Routing..." : "Refresh"}
            </button>
          </div>

          {Boolean(routeGeoJSON) && (
            <div className="flex items-center justify-between text-[11px] text-white/80 bg-white/5 border border-white/10 px-2 py-2 rounded-lg">
              <div>Distance: {formatKm(distanceM)} km</div>
              <div>ETA: {formatMin(durationS)} min</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
