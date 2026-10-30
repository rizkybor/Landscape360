import { useEffect, useMemo, useState } from "react";
import { Layer, Marker, Source, useMap } from "react-map-gl/mapbox";
import type { MapMouseEvent } from "mapbox-gl";
import type { FeatureCollection, LineString, Point } from "geojson";
import { destination, point as turfPoint } from "@turf/turf";
import { useClassicStore } from "../store/useClassicStore";
import { solveClassic } from "../utils/classicSolve";
import { bearingTo, fixFromLines, fixRadius, formatCompass, lengthAlong, normalize360, type Fix } from "../utils/classicNav";
import type { LngLat } from "../types/markedArea";

const along = (from: LngLat, bearing: number, metres: number): LngLat =>
  destination(turfPoint(from), metres / 1000, bearing > 180 ? bearing - 360 : bearing, { units: "kilometers" }).geometry
    .coordinates as LngLat;

// Compass card drawn around a point: N in red, ticks every 30°
const CompassRose = () => (
  <svg width="76" height="76" viewBox="-38 -38 76 76" className="pointer-events-none" aria-hidden>
    <circle r="30" fill="rgba(255,255,255,0.35)" stroke="#1a2214" strokeWidth="1.2" strokeOpacity="0.7" />
    {Array.from({ length: 12 }, (_, i) => (
      <line key={i} y1={-30} y2={i % 3 === 0 ? -23 : -26.5} stroke="#1a2214" strokeWidth={i % 3 === 0 ? 1.6 : 1} transform={`rotate(${i * 30})`} />
    ))}
    {(["N", "E", "S", "W"] as const).map((c, i) => (
      <text
        key={c}
        x={[0, 34.5, 0, -34.5][i]}
        y={[-31.5, 3.5, 38, 3.5][i]}
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill={c === "N" ? "#b4302a" : "#1a2214"}
        stroke="#ffffff"
        strokeWidth="2.5"
        paintOrder="stroke"
      >
        {c}
      </text>
    ))}
  </svg>
);

const metres = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`);

// The area the object most likely lies in: a circle of `radiusM` metres around the crossing,
// with a ring pulsing outward. Drawn as a marker, so it is resized to metres on every zoom.
const EstimateCircle = ({ center, radiusM }: { center: LngLat; radiusM: number }) => {
  const { current: mapRef } = useMap();
  const [px, setPx] = useState(0);
  const lat = center[1];
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map) return;
    const update = () => {
      // Web Mercator, 512 px tiles: metres per pixel at this latitude and zoom
      const metresPerPx = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
      setPx(radiusM / metresPerPx);
    };
    update();
    map.on("zoom", update);
    return () => {
      map.off("zoom", update);
    };
  }, [mapRef, radiusM, lat]);
  const size = Math.max(24, Math.min(px * 2, 3000));
  return (
    <Marker longitude={center[0]} latitude={center[1]} anchor="center" pitchAlignment="map">
      <div className="relative pointer-events-none" style={{ width: size, height: size }} aria-hidden>
        <span className="absolute inset-0 rounded-full bg-brick-500/15 border-2 border-dashed border-brick-500/80" />
        <span className="absolute inset-0 rounded-full border-2 border-brick-500 animate-ping [animation-duration:1.8s]" />
      </div>
    </Marker>
  );
};

// Map drawing for Classic: the points you set, a line from each finished sighting, and where
// the lines cross. Also places a point when "Pick on map" is active.
export const ClassicLayer = () => {
  const { current: mapRef } = useMap();
  const isPanelOpen = useClassicStore((s) => s.isPanelOpen);
  // A shared Field Work being looked at replaces the user's own, read only
  const viewing = useClassicStore((s) => s.viewing);
  const ownMode = useClassicStore((s) => s.mode);
  const ownSightings = useClassicStore((s) => s.sightings);
  const ownOrigin = useClassicStore((s) => s.origin);
  const ownDeclination = useClassicStore((s) => s.declination);
  const ownLineLengths = useClassicStore((s) => s.lineLengths);
  const picking = useClassicStore((s) => s.picking);
  const mode = viewing?.mode ?? ownMode;
  const sightings = viewing?.sightings ?? ownSightings;
  const origin = viewing?.origin ?? ownOrigin;
  const declination = viewing?.declination ?? ownDeclination;
  const lineLengths = viewing?.lineLengths ?? ownLineLengths;
  const readOnly = !!viewing;

  // Pick on map: the next tap sets the point
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map || picking === null) return;
    const canvas = map.getCanvas();
    canvas.style.cursor = "crosshair";
    const onClick = (e: MapMouseEvent) => useClassicStore.getState().placePicked([e.lngLat.lng, e.lngLat.lat]);
    map.on("click", onClick);
    return () => {
      map.off("click", onClick);
      canvas.style.cursor = "";
    };
  }, [mapRef, picking]);

  const sol = useMemo(
    () => solveClassic({ mode, sightings, origin, declination }),
    [mode, sightings, origin, declination],
  );
  const resection = mode === "resection";
  const short = mode === "resection" ? "" : "Pos ";

  const dots = useMemo<FeatureCollection<Point>>(() => {
    // Resection: your one position. Intersection: each position you sight from.
    if (resection) {
      return {
        type: "FeatureCollection",
        features: sol.origin ? [{ type: "Feature", properties: { label: "You" }, geometry: { type: "Point", coordinates: sol.origin } }] : [],
      };
    }
    const features: FeatureCollection<Point>["features"] = sol.sightings.flatMap((s, i) =>
      s.point
        ? [{ type: "Feature" as const, properties: { label: `${short}${String.fromCharCode(65 + i)}` }, geometry: { type: "Point" as const, coordinates: s.point } }]
        : [],
    );
    return { type: "FeatureCollection", features };
  }, [sol, resection, short]);

  // Compass lines, drawn as soon as a bearing is typed:
  // resection, from your position: the azimuth toward each point (red), its back azimuth the
  // opposite way (gold); intersection, from each position: the azimuth toward the object
  // (red, these cross at X) and its back azimuth the opposite way (gold).
  const d = sol.declination.value ?? 0;
  const compassLines = useMemo(
    () =>
      sol.sightings.flatMap((s, index) => {
        if (!s.point || !s.open) return [];
        const letter = String.fromCharCode(65 + index);
        const out: { index: number; from: LngLat; bearing: number; kind: "main" | "back"; text: string }[] = [];
        if (s.azimuth.value !== null) {
          out.push({
            index,
            from: s.point,
            bearing: normalize360(s.azimuth.value + d),
            kind: "main",
            text: resection ? `${letter} · Az ${formatCompass(s.azimuth.value)}` : `Az ${formatCompass(s.azimuth.value)}`,
          });
        }
        if (s.backOpen && s.back.value !== null) {
          out.push({
            index,
            from: s.point,
            bearing: normalize360(s.back.value + d),
            kind: "back",
            text: resection ? `${letter} · Back ${formatCompass(s.back.value)}` : `Back ${formatCompass(s.back.value)}`,
          });
        }
        return out;
      }),
    [sol, d, resection],
  );

  // Where the lines cross (X), as typed; once every step is checked it is the answer.
  // Resection lines all start at your position, so there is no crossing to find.
  const liveCrossing = useMemo(() => {
    // Only the azimuth lines meet at the object; the back azimuths point away from it
    const toObject = compassLines.filter((l) => l.kind === "main");
    if (resection || toObject.length < 2) return null;
    const fix = fixFromLines(toObject);
    return fix && fix.along.every((a) => a > 0) ? fix : null;
  }, [compassLines, resection]);

  // Each line with its length: set by hand (dragging its end), or one that fits the exercise
  const drawn = useMemo(() => {
    // Not the real point: how far the lines reach must not hint where the answer is
    const known = sol.sightings.map((s) => s.point).filter((p): p is LngLat => !!p);
    const spread = Math.max(1000, ...known.flatMap((a) => known.map((b) => bearingTo(a, b).distance)));
    const crossing = sol.fix?.point ?? liveCrossing?.point ?? null;
    return compassLines.map((l) => {
      const key = `${l.index}:${l.kind}`;
      // Intersection lines run well past the crossing (about twice as far), so the cut reads
      // clearly; resection lines and lines before any crossing reach about the spread of the points
      const toCrossing = crossing ? bearingTo(l.from, crossing).distance * (resection ? 1.3 : 2.2) : 0;
      const auto = Math.max(resection ? 300 : 800, toCrossing || spread * (resection ? 1.5 : 2.5)) * (l.kind === "back" ? 0.6 : 1);
      const length = lineLengths[key] ?? auto;
      return { ...l, key, length, end: along(l.from, l.bearing, length) };
    });
  }, [sol, compassLines, liveCrossing, resection, lineLengths]);

  const lines = useMemo<FeatureCollection<LineString>>(
    () => ({
      type: "FeatureCollection",
      features: drawn.map((l) => ({
        type: "Feature",
        properties: { kind: l.kind, text: l.text },
        geometry: { type: "LineString", coordinates: [l.from, l.end] },
      })),
    }),
    [drawn],
  );

  // Dragging a line's end makes it longer or shorter: the end is kept on the line, so the
  // direction and the start never change
  const dragEnd = (l: (typeof drawn)[number], to: LngLat) => {
    const length = lengthAlong(l.from, l.bearing, to);
    useClassicStore.getState().setLineLength(l.key, Math.min(200000, Math.max(50, length)));
  };

  // The checked answer, or the crossing as typed
  const shownFix: Fix | null = sol.fix ?? liveCrossing;

  const cross = useMemo<FeatureCollection<Point>>(
    () => ({
      type: "FeatureCollection",
      features: shownFix
        ? [{ type: "Feature", properties: { label: `X · ±${metres(fixRadius(shownFix))}`, checked: !!sol.fix }, geometry: { type: "Point", coordinates: shownFix.point } }]
        : [],
    }),
    [shownFix, sol.fix],
  );

  // Keep every point and the crossing in view beside the panel. Waits a moment after the last
  // change, so typing a coordinate digit by digit does not throw the map around.
  const crossingPoint = sol.fix?.point ?? liveCrossing?.point ?? null;
  // (resection: also when a line is added, so its far end is in view)
  const viewKey =
    [...sol.sightings.map((s) => s.point), crossingPoint].map((p) => (p ? `${p[0].toFixed(5)},${p[1].toFixed(5)}` : "-")).join("|") +
    (resection ? `|${compassLines.length}` : "");
  // The phone sheet can be lowered or raised: refit to the space it leaves
  const [panelHeight, setPanelHeight] = useState(0);
  useEffect(() => {
    if (!isPanelOpen) return;
    let observer: ResizeObserver | null = null;
    const frame = requestAnimationFrame(() => {
      const panel = document.querySelector("[data-classic-panel]");
      if (!panel || typeof ResizeObserver === "undefined") return;
      observer = new ResizeObserver(([entry]) => setPanelHeight(Math.round(entry.contentRect.height / 40)));
      observer.observe(panel);
    });
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [isPanelOpen, picking]);

  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map || !isPanelOpen) return;
    const lineEnds = resection ? lines.features.map((f) => f.geometry.coordinates[1] as LngLat) : [];
    const all = [...sol.sightings.map((s) => s.point), crossingPoint, ...lineEnds].filter((p): p is LngLat => !!p);
    if (!all.length) return;
    const timer = setTimeout(() => {
      const lngs = all.map((p) => p[0]);
      const lats = all.map((p) => p[1]);
      const panel = document.querySelector("[data-classic-panel]")?.getBoundingClientRect();
      const padding = { top: 90, bottom: 80, left: 80, right: 100 };
      // Desktop: the panel sits in the middle, so use the map to its right; phone: above it
      // (minimized, it is only a bar at the bottom)
      if (panel && panel.width < window.innerWidth * 0.6 && panel.height > 140) padding.left = Math.min(panel.right + 60, window.innerWidth - 300);
      // Desktop: keep clear of the sidebar (the rail, and its panel when it is open)
      const sidebar = document.querySelector('aside[aria-hidden="false"]') ?? document.querySelector('nav[aria-label="Sidebar"]');
      if (sidebar && window.innerWidth >= 768) padding.left = Math.max(padding.left, Math.min(sidebar.getBoundingClientRect().right + 40, window.innerWidth - 300));
      else if (panel) padding.bottom = Math.min(window.innerHeight - panel.top + 40, window.innerHeight - 180);
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding, duration: 900, maxZoom: all.length > 1 ? 16 : 14 },
      );
    }, 900);
    return () => clearTimeout(timer);
    // Only when a point or the crossing moves, or the panel changes size
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef, viewKey, isPanelOpen, panelHeight]);

  if (!isPanelOpen) return null;

  return (
    <>
      <Source id="classic-lines" type="geojson" data={lines}>
        <Layer id="classic-rays" type="line" filter={["==", ["get", "kind"], "main"]} paint={{ "line-color": "#b4302a", "line-width": 2.5 }} />
        <Layer
          id="classic-rays-back"
          type="line"
          filter={["==", ["get", "kind"], "back"]}
          paint={{ "line-color": "#d49b22", "line-width": 2, "line-dasharray": [2, 1.5] }}
        />
        <Layer
          id="classic-rays-label"
          type="symbol"
          layout={{
            "symbol-placement": "line-center",
            "text-field": ["get", "text"],
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            "text-size": 11,
            "text-offset": [0, -0.8],
            "text-allow-overlap": true,
          }}
          paint={{
            "text-color": ["case", ["==", ["get", "kind"], "back"], "#7a4e0e", "#7a201c"],
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.5,
          }}
        />
      </Source>
      {/* Where the object most likely is: a pulsing circle around X */}
      {shownFix && <EstimateCircle center={shownFix.point} radiusM={fixRadius(shownFix)} />}

      {/* Line ends: drag along the line to make it longer or shorter (not on a shared, read-only Field Work) */}
      {!readOnly && drawn.map((l) => (
        <Marker
          key={l.key}
          longitude={l.end[0]}
          latitude={l.end[1]}
          anchor="center"
          draggable
          onDrag={(e) => dragEnd(l, [e.lngLat.lng, e.lngLat.lat])}
          onDragEnd={(e) => dragEnd(l, [e.lngLat.lng, e.lngLat.lat])}
        >
          <span
            title="Drag to make the line longer or shorter"
            aria-label={`Length of ${l.text}`}
            className={`block w-4 h-4 rounded-full bg-white border-[3px] shadow-md cursor-grab active:cursor-grabbing hover:scale-125 transition-transform ${
              l.kind === "main" ? "border-brick-600" : "border-gold-500"
            }`}
          />
        </Marker>
      ))}

      {/* A compass rose on every point: north follows the map, the lines leave from its centre */}
      {(resection ? [sol.origin] : sol.sightings.map((s) => s.point)).map((p, i) =>
        p ? (
          <Marker key={i} longitude={p[0]} latitude={p[1]} anchor="center" rotationAlignment="map" pitchAlignment="map">
            <CompassRose />
          </Marker>
        ) : null,
      )}
      <Source id="classic-points" type="geojson" data={dots}>
        <Layer
          id="classic-points-dot"
          type="circle"
          paint={{
            "circle-radius": 6,
            "circle-color": "#365b25",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          }}
        />
        <Layer
          id="classic-points-label"
          type="symbol"
          layout={{
            "text-field": ["get", "label"],
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            "text-size": 12,
            // Above the compass rose
            "text-offset": [0, -3.6],
            "text-allow-overlap": true,
          }}
          paint={{ "text-color": "#1a2214", "text-halo-color": "#ffffff", "text-halo-width": 1.5 }}
        />
      </Source>
      <Source id="classic-cross" type="geojson" data={cross}>
        <Layer
          id="classic-cross-dot"
          type="circle"
          paint={{
            "circle-radius": ["case", ["get", "checked"], 8, 6],
            "circle-color": ["case", ["get", "checked"], "#d49b22", "#ffffff"],
            "circle-stroke-color": ["case", ["get", "checked"], "#1a2214", "#b4302a"],
            "circle-stroke-width": 2.5,
          }}
        />
        <Layer
          id="classic-cross-label"
          type="symbol"
          layout={{
            "text-field": ["get", "label"],
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            "text-size": 12,
            "text-offset": [0, 1.5],
            "text-allow-overlap": true,
          }}
          paint={{ "text-color": "#7a4e0e", "text-halo-color": "#ffffff", "text-halo-width": 1.5 }}
        />
      </Source>
    </>
  );
};
