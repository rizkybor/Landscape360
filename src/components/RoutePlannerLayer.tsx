import { useEffect, useMemo } from "react";
import { Layer, Marker, Source, useMap } from "react-map-gl/mapbox";
import type { MapMouseEvent, LngLatBoundsLike } from "mapbox-gl";
import mapboxgl from "mapbox-gl";
import { ArrowUpDown, Car, CarFront, Footprints, Loader2, RotateCw, Route as RouteIcon, Trash2, X } from "lucide-react";
import { useRouteStore, type RouteMode } from "../store/useRouteStore";
import { useSurveyStore } from "../store/useSurveyStore";

const formatKm = (m: number) => (m / 1000).toFixed(2);

const formatDuration = (s: number) => {
  const totalMin = Math.max(1, Math.round(s / 60));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
};

const formatPoint = (p: { lat: number; lng: number }) =>
  `${Math.abs(p.lat).toFixed(4)}° ${p.lat < 0 ? "S" : "N"}, ${Math.abs(p.lng).toFixed(4)}° ${p.lng < 0 ? "W" : "E"}`;

// Route line colors: vivid brand tones that stay readable on satellite imagery
const MODES: { value: RouteMode; label: string; hint: string; color: string; icon: typeof Car }[] = [
  { value: "driving_toll", label: "Vehicle", hint: "Via toll", color: "#e46c24", icon: Car },
  { value: "driving_no_toll", label: "Vehicle", hint: "No toll", color: "#d49b22", icon: CarFront },
  { value: "walking", label: "Walk", hint: "Footpath", color: "#22c55e", icon: Footprints },
];

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

  const activeMode = useMemo(() => MODES.find((m) => m.value === mode) ?? MODES[0], [mode]);
  const routeColor = activeMode.color;

  const selectMode = async (next: RouteMode) => {
    useRouteStore.getState().setMode(next);
    if (useRouteStore.getState().start && useRouteStore.getState().end) {
      await computeRoute(mapboxToken);
    }
  };

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

  const nextStep = !start ? "start" : !end ? "end" : null;

  return (
    <>
      {start && (
        <Marker longitude={start.lng} latitude={start.lat} anchor="center">
          <div className="w-5 h-5 rounded-full bg-white shadow-lg ring-1 ring-sand-300 flex items-center justify-center">
            <div className="w-2.5 h-2.5 rounded-full bg-forest-700" />
          </div>
        </Marker>
      )}
      {end && (
        <Marker longitude={end.lng} latitude={end.lat} anchor="center">
          <div className="w-5 h-5 rounded-full bg-ember-500 border-[3px] border-white shadow-lg" />
        </Marker>
      )}

      {routeGeoJSON && (
        <Source id="route-planner-source" type="geojson" data={routeGeoJSON as any}>
          <Layer
            id="route-planner-casing"
            type="line"
            paint={{ "line-color": "#ffffff", "line-width": 8, "line-opacity": 0.9 }}
            layout={{ "line-join": "round", "line-cap": "round" }}
          />
          <Layer
            id="route-planner-line"
            type="line"
            paint={{
              "line-color": routeColor,
              "line-width": 4.5,
            }}
            layout={{
              "line-join": "round",
              "line-cap": "round",
            }}
          />
        </Source>
      )}

      <div className="absolute left-4 top-24 md:left-[24rem] md:top-4 z-30 w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-sand-200 bg-white/95 backdrop-blur-md text-ink shadow-xl shadow-sand-900/10 overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-3.5 pb-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-forest-800 text-gold-300 flex items-center justify-center shrink-0">
            <RouteIcon size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold leading-tight">Route Planner</div>
            <div className="text-[11px] text-sand-500">Plan a route between two points</div>
          </div>
          <button
            onClick={() => useRouteStore.getState().setRoutePlannerEnabled(false)}
            className="cursor-pointer p-1.5 rounded-lg text-sand-500 hover:text-ink hover:bg-sand-100 transition-colors"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-4 pb-4 space-y-3">
          {/* Start / destination */}
          <div className="relative rounded-xl border border-sand-200 bg-sand-50">
            {(["start", "end"] as const).map((step) => {
              const point = step === "start" ? start : end;
              const isNext = nextStep === step;
              return (
                <div
                  key={step}
                  className={`flex items-center gap-3 pl-3 pr-12 py-2.5 ${step === "start" ? "border-b border-sand-200" : ""} ${
                    isNext ? "bg-forest-50/70" : ""
                  }`}
                >
                  {step === "start" ? (
                    <div className="w-4 h-4 rounded-full bg-white ring-1 ring-sand-300 flex items-center justify-center shrink-0">
                      <div className="w-2 h-2 rounded-full bg-forest-700" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-ember-500 border-2 border-white ring-1 ring-ember-200 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-sand-500">
                      {step === "start" ? "Start" : "Destination"}
                    </div>
                    <div className={`text-xs truncate ${point ? "font-mono text-ink" : isNext ? "text-forest-700 font-medium" : "text-sand-400"}`}>
                      {point ? formatPoint(point) : isNext ? "Click on the map to set this point" : "Waiting for start point"}
                    </div>
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => useRouteStore.getState().swapStartEnd()}
              disabled={!start || !end}
              className="cursor-pointer absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white border border-sand-200 text-sand-600 hover:text-forest-800 hover:border-forest-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Swap start and destination"
            >
              <ArrowUpDown size={14} />
            </button>
          </div>

          {/* Travel mode */}
          <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-sand-100">
            {MODES.map(({ value, label, hint, icon: Icon }) => {
              const isActive = mode === value;
              return (
                <button
                  key={value}
                  onClick={() => selectMode(value)}
                  className={`cursor-pointer flex flex-col items-center gap-0.5 py-2 rounded-lg transition-all ${
                    isActive ? "bg-white shadow-sm text-forest-800 ring-1 ring-sand-200" : "text-sand-600 hover:text-ink"
                  }`}
                >
                  <Icon size={16} />
                  <span className="text-[11px] font-bold leading-none mt-0.5">{label}</span>
                  <span className="text-[9px] leading-none opacity-80">{hint}</span>
                </button>
              );
            })}
          </div>

          {error && (
            <div className="text-[11px] text-brick-600 bg-brick-50 border border-brick-200 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {/* Result */}
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-sand-500">
              <Loader2 size={14} className="animate-spin text-forest-700" /> Calculating route...
            </div>
          ) : (
            Boolean(routeGeoJSON) && (
              <div className="rounded-xl border border-sand-200 overflow-hidden">
                <div className="h-1" style={{ backgroundColor: routeColor }} />
                <div className="grid grid-cols-2 divide-x divide-sand-200">
                  <div className="px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-sand-500">Distance</div>
                    <div className="text-lg font-bold font-mono text-ink">
                      {formatKm(distanceM)} <span className="text-xs font-sans font-medium text-sand-500">km</span>
                    </div>
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-sand-500">Est. time</div>
                    <div className="text-lg font-bold font-mono text-ink">{formatDuration(durationS)}</div>
                  </div>
                </div>
              </div>
            )
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-sand-500">
              {nextStep ? "" : "Click the map again to start a new route."}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => clearRoute()}
                disabled={!start && !end}
                className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-sand-600 hover:text-brick-600 hover:bg-brick-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 size={12} /> Clear
              </button>
              <button
                onClick={async () => computeRoute(mapboxToken)}
                disabled={!start || !end || isLoading}
                className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-forest-800 text-white hover:bg-forest-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RotateCw size={12} /> Recalculate
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
