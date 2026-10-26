import { useEffect, useMemo } from "react";
import { Layer, Source, useMap } from "react-map-gl/mapbox";
import type { FeatureCollection, Point, Polygon, LineString } from "geojson";
import type { MapMouseEvent } from "mapbox-gl";
import { X } from "lucide-react";
import { useMarkedAreaStore } from "../store/useMarkedAreaStore";
import { useMarkedLocationStore } from "../store/useMarkedLocationStore";
import { useTrackRecorderStore } from "../store/useTrackRecorderStore";
import { areaFeature, focusMask, ringBounds, ringCenter } from "../utils/markedAreas";

const FILL_LAYER = "marked-areas-fill";

// Map rendering for Marked Areas: every saved area (light fill, coloured outline, name), the
// shape being drawn, and the focus view that darkens everything outside one area.
export const MarkedAreaLayer = () => {
  const { current: mapRef } = useMap();
  const areas = useMarkedAreaStore((s) => s.areas);
  const isDrawing = useMarkedAreaStore((s) => s.isDrawing);
  const draft = useMarkedAreaStore((s) => s.draft);
  const addPoint = useMarkedAreaStore((s) => s.addPoint);
  const focusId = useMarkedAreaStore((s) => s.focusId);
  const setFocus = useMarkedAreaStore((s) => s.setFocus);
  const focused = areas.find((a) => a.id === focusId) ?? null;

  const shapes = useMemo<FeatureCollection<Polygon>>(
    () => ({
      type: "FeatureCollection",
      features: areas.map((a) => areaFeature(a.ring, { id: a.id, color: a.color, focused: a.id === focusId })),
    }),
    [areas, focusId],
  );
  const labels = useMemo<FeatureCollection<Point>>(
    () => ({
      type: "FeatureCollection",
      features: areas.map((a) => ({
        type: "Feature",
        properties: { name: a.name },
        geometry: { type: "Point", coordinates: ringCenter(a.ring) },
      })),
    }),
    [areas],
  );
  const draftLine = useMemo<FeatureCollection<LineString | Point>>(
    () => ({
      type: "FeatureCollection",
      features: [
        ...(draft.length >= 2
          ? [
              {
                type: "Feature" as const,
                properties: {},
                geometry: {
                  type: "LineString" as const,
                  // Closed preview once it is a shape
                  coordinates: draft.length >= 3 ? [...draft, draft[0]] : draft,
                },
              },
            ]
          : []),
        ...draft.map((p, i) => ({
          type: "Feature" as const,
          properties: { first: i === 0 },
          geometry: { type: "Point" as const, coordinates: p },
        })),
      ],
    }),
    [draft],
  );

  // Drawing: each tap on the map adds a point
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map || !isDrawing) return;
    const canvas = map.getCanvas();
    canvas.style.cursor = "crosshair";
    const onClick = (e: MapMouseEvent) => addPoint([e.lngLat.lng, e.lngLat.lat]);
    map.on("click", onClick);
    // Double-click adds a point; it should not also zoom in
    map.doubleClickZoom.disable();
    return () => {
      map.off("click", onClick);
      map.doubleClickZoom.enable();
      canvas.style.cursor = "";
    };
  }, [mapRef, isDrawing, addPoint]);

  // Tap an area to open it in the panel
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map || isDrawing) return;
    const onClick = (e: MapMouseEvent) => {
      const id = e.features?.[0]?.properties?.id;
      if (!id) return;
      // Same spot on screen as the Marked Locations and Track Recorder panels
      useMarkedLocationStore.getState().setPanelOpen(false);
      useTrackRecorderStore.getState().setPanelOpen(false);
      const store = useMarkedAreaStore.getState();
      store.select(String(id));
      store.setPanelOpen(true);
    };
    const onEnter = () => (map.getCanvas().style.cursor = "pointer");
    const onLeave = () => (map.getCanvas().style.cursor = "");
    map.on("click", FILL_LAYER, onClick);
    map.on("mouseenter", FILL_LAYER, onEnter);
    map.on("mouseleave", FILL_LAYER, onLeave);
    return () => {
      map.off("click", FILL_LAYER, onClick);
      map.off("mouseenter", FILL_LAYER, onEnter);
      map.off("mouseleave", FILL_LAYER, onLeave);
    };
  }, [mapRef, isDrawing]);

  // Focus: fit the area on screen, above the Marked Areas panel when it is open
  const panelOpen = useMarkedAreaStore((s) => s.isPanelOpen);
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map || !focused) return;
    map.fitBounds(ringBounds(focused.ring), {
      padding: { top: 80, bottom: panelOpen ? 340 : 120, left: 40, right: 80 },
      duration: 1200,
      maxZoom: 17,
    });
    // Refit only when another area is focused, not each time the panel opens or closes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef, focused?.id]);

  return (
    <>
      {focused && (
        <Source id="marked-area-focus" type="geojson" data={focusMask(focused.ring)}>
          <Layer id="marked-area-focus-mask" type="fill" paint={{ "fill-color": "#0b0f08", "fill-opacity": 0.72 }} />
        </Source>
      )}

      <Source id="marked-areas" type="geojson" data={shapes}>
        <Layer
          id={FILL_LAYER}
          type="fill"
          paint={{
            "fill-color": ["get", "color"],
            "fill-opacity": ["case", ["get", "focused"], 0, 0.15],
          }}
        />
        <Layer
          id="marked-areas-outline"
          type="line"
          paint={{
            "line-color": ["get", "color"],
            "line-width": ["case", ["get", "focused"], 3.5, 2.5],
          }}
        />
      </Source>

      <Source id="marked-areas-labels" type="geojson" data={labels}>
        <Layer
          id="marked-areas-label"
          type="symbol"
          minzoom={10}
          layout={{
            "text-field": ["get", "name"],
            "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
            "text-size": 12,
            "text-max-width": 12,
          }}
          paint={{ "text-color": "#1a2214", "text-halo-color": "#ffffff", "text-halo-width": 1.5 }}
        />
      </Source>

      {isDrawing && (
        <Source id="marked-area-draft" type="geojson" data={draftLine}>
          <Layer
            id="marked-area-draft-line"
            type="line"
            filter={["==", ["geometry-type"], "LineString"]}
            paint={{ "line-color": "#d49b22", "line-width": 2.5, "line-dasharray": [2, 1.5] }}
          />
          <Layer
            id="marked-area-draft-points"
            type="circle"
            filter={["==", ["geometry-type"], "Point"]}
            paint={{
              "circle-radius": ["case", ["get", "first"], 7, 5],
              "circle-color": ["case", ["get", "first"], "#365b25", "#ffffff"],
              "circle-stroke-color": "#d49b22",
              "circle-stroke-width": 2.5,
            }}
          />
        </Source>
      )}

      {focused && (
        <div className="fixed z-40 top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 pl-3 pr-1 py-1 rounded-full bg-white/95 border border-sand-200 shadow-lg text-xs">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: focused.color }} />
          <span className="font-bold text-ink max-w-[45vw] truncate">{focused.name}</span>
          <button
            onClick={() => setFocus(null)}
            className="cursor-pointer shrink-0 whitespace-nowrap flex items-center gap-1 px-2 py-1 rounded-full bg-sand-100 hover:bg-sand-200 text-sand-700 font-bold"
          >
            <X size={12} /> Exit focus
          </button>
        </div>
      )}
    </>
  );
};
