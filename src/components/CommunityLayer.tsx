import { useEffect, useMemo } from "react";
import { Layer, Source, useMap } from "react-map-gl/mapbox";
import type { MapMouseEvent } from "mapbox-gl";
import type { Feature, FeatureCollection, Geometry, Point } from "geojson";
import { useCommunityStore } from "../store/useCommunityStore";
import {
  annotationPoints,
  attachmentCoords,
  conditionOf,
  fetchFeed,
  isOldReport,
  LIVE_STALE_MIN,
  minutesAgo,
  REPORT_FRESH_DAYS,
} from "../lib/community";
import { useMapStore } from "../store/useMapStore";

const POINTS_LAYER = "community-posts-dot";
const ANNOTATION_LAYERS = ["community-ann-fill", "community-ann-line", "community-ann-point"];

// Community on the map, while its panel is open: the posts in view from the last 30 days
// (coloured by their first condition; stories in gold), the open post with its attachment, and
// the point being chosen for a new post.
export const CommunityLayer = () => {
  const { current: mapRef } = useMap();
  const isPanelOpen = useCommunityStore((s) => s.isPanelOpen);
  const mapPosts = useCommunityStore((s) => s.mapPosts);
  const focused = useCommunityStore((s) => s.focused);
  const shownItem = useCommunityStore((s) => s.shownItem);
  const live = useCommunityStore((s) => s.live);
  const clubMap = useCommunityStore((s) => s.clubMap);
  const draw = useCommunityStore((s) => s.draw);
  const cameraTo = useCommunityStore((s) => s.cameraTo);
  // Only whether drawing is on matters for the click handlers (the points are read on each tap)
  const isDrawing = draw !== null;
  const picking = useCommunityStore((s) => s.picking);
  const picked = useCommunityStore((s) => s.picked);
  const version = useCommunityStore((s) => s.version);
  const viewBounds = useCommunityStore((s) => s.viewBounds);
  const feedClub = useCommunityStore((s) => s.feedClub);

  // Keep the visible box in the store (the feed's "Near the map" uses it too)
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map || !isPanelOpen) return;
    const update = () => {
      const b = map.getBounds();
      if (b) useCommunityStore.getState().setViewBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    };
    update();
    map.on("moveend", update);
    return () => {
      map.off("moveend", update);
    };
  }, [mapRef, isPanelOpen]);

  // Posts in view, read again when the view settles or something changed
  useEffect(() => {
    if (!isPanelOpen || !viewBounds) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetchFeed({ bounds: viewBounds, since: Date.now() - REPORT_FRESH_DAYS * 86400000, limit: 300, club: feedClub })
        .then((posts) => !cancelled && useCommunityStore.getState().setMapPosts(posts))
        .catch(() => undefined);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isPanelOpen, viewBounds, version, feedClub]);

  // Tap a post to open it; while choosing a place, the tap sets it
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map || !isPanelOpen) return;
    const canvas = map.getCanvas();
    if (isDrawing) {
      canvas.style.cursor = "crosshair";
      const onDraw = (e: MapMouseEvent) => {
        const d = useCommunityStore.getState().draw;
        if (!d) return;
        const pt: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        const one = d.kind === "pin" || d.kind === "note";
        useCommunityStore.getState().setDraw({ ...d, points: one ? [pt] : [...d.points, pt] });
      };
      map.on("click", onDraw);
      return () => {
        map.off("click", onDraw);
        canvas.style.cursor = "";
      };
    }
    if (picking) {
      canvas.style.cursor = "crosshair";
      const onPick = (e: MapMouseEvent) => useCommunityStore.getState().setPicked([e.lngLat.lng, e.lngLat.lat]);
      map.on("click", onPick);
      return () => {
        map.off("click", onPick);
        canvas.style.cursor = "";
      };
    }
    const onClick = (e: MapMouseEvent) => {
      const id = e.features?.[0]?.properties?.id;
      if (id) useCommunityStore.getState().openPost(String(id));
    };
    const onEnter = () => (canvas.style.cursor = "pointer");
    const onLeave = () => (canvas.style.cursor = "");
    const onAnnotation = (e: MapMouseEvent) => {
      const id = e.features?.[0]?.properties?.id;
      const m = useCommunityStore.getState().clubMap;
      if (id && m) useCommunityStore.getState().setClubMap({ ...m, selectedId: String(id) });
    };
    for (const l of ANNOTATION_LAYERS) map.on("click", l, onAnnotation);
    map.on("click", POINTS_LAYER, onClick);
    map.on("mouseenter", POINTS_LAYER, onEnter);
    map.on("mouseleave", POINTS_LAYER, onLeave);
    return () => {
      for (const l of ANNOTATION_LAYERS) map.off("click", l, onAnnotation);
      map.off("click", POINTS_LAYER, onClick);
      map.off("mouseenter", POINTS_LAYER, onEnter);
      map.off("mouseleave", POINTS_LAYER, onLeave);
    };
  }, [mapRef, isPanelOpen, picking, isDrawing]);

  // The open post: fit it (and its attachment) in view
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map || !focused) return;
    const coords = [[focused.lng, focused.lat] as [number, number], ...attachmentCoords(focused.attachment)];
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    if (coords.length === 1) map.flyTo({ center: coords[0], zoom: Math.max(map.getZoom(), 14), duration: 900 });
    else
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: { top: 80, bottom: 340, left: 60, right: 80 }, duration: 900, maxZoom: 16 },
      );
    // Only when another post opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef, focused?.id]);

  const points = useMemo<FeatureCollection<Point>>(() => {
    const posts = mapPosts.filter((p) => !isOldReport(p));
    if (focused && !posts.some((p) => p.id === focused.id)) posts.push({ ...focused, truncated: false, attachmentKind: null });
    return {
      type: "FeatureCollection",
      features: posts.map((p) => ({
        type: "Feature",
        properties: {
          id: p.id,
          color: p.kind === "story" ? "#d49b22" : conditionOf(p.conditions[0] ?? "other").color,
          open: p.id === focused?.id,
        },
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      })),
    };
  }, [mapPosts, focused]);

  const attachment = useMemo<FeatureCollection>(() => {
    const features: Feature<Geometry>[] = [];
    for (const a of [focused?.attachment, shownItem]) {
      if (a && a.kind !== "classic") features.push({ type: "Feature", properties: { kind: a.kind }, geometry: a.geometry as Geometry });
    }
    return { type: "FeatureCollection", features };
  }, [focused, shownItem]);

  // A workspace item shown from a club: fit it in view
  useEffect(() => {
    const map = mapRef?.getMap();
    const coords = attachmentCoords(shownItem);
    if (!map || coords.length === 0) return;
    if (coords.length === 1) {
      map.flyTo({ center: coords[0], zoom: Math.max(map.getZoom(), 15), duration: 900 });
      return;
    }
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    map.fitBounds(
      [
        [Math.min(...lngs), Math.min(...lats)],
        [Math.max(...lngs), Math.max(...lats)],
      ],
      { padding: { top: 80, bottom: 340, left: 60, right: 80 }, duration: 900, maxZoom: 16 },
    );
  }, [mapRef, shownItem]);

  const pickedPoint = useMemo<FeatureCollection<Point>>(
    () => ({ type: "FeatureCollection", features: picked ? [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: picked } }] : [] }),
    [picked],
  );

  // Fit everyone sharing in view when asked (the event page's "Show on map")
  const liveFit = live?.fit ?? 0;
  useEffect(() => {
    const map = mapRef?.getMap();
    const pts = useCommunityStore.getState().live?.positions ?? [];
    if (!map || !liveFit || pts.length === 0) return;
    if (pts.length === 1) {
      map.flyTo({ center: [pts[0].lng, pts[0].lat], zoom: Math.max(map.getZoom(), 14), duration: 900 });
      return;
    }
    map.fitBounds(
      [
        [Math.min(...pts.map((p) => p.lng)), Math.min(...pts.map((p) => p.lat))],
        [Math.max(...pts.map((p) => p.lng)), Math.max(...pts.map((p) => p.lat))],
      ],
      { padding: { top: 80, bottom: 340, left: 60, right: 80 }, duration: 900, maxZoom: 16 },
    );
  }, [mapRef, liveFit]);

  // An event's participants: last positions (faded when not seen for a while) and one trail
  const livePoints = useMemo<FeatureCollection<Point>>(
    () => ({
      type: "FeatureCollection",
      features: (live?.positions ?? []).map((p) => ({
        type: "Feature",
        properties: {
          name: p.isMe ? `${p.name} (you)` : p.name,
          stale: !p.sharing || minutesAgo(p.recordedAt) > LIVE_STALE_MIN,
          selected: live?.trail?.userId === p.userId,
        },
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
      })),
    }),
    [live],
  );
  const liveTrail = useMemo<FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features:
        live?.trail && live.trail.coords.length > 1
          ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: live.trail.coords } }]
          : [],
    }),
    [live],
  );

  // The club map's drawings, and the one being drawn
  const annotations = useMemo<FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: (clubMap?.annotations ?? []).map((a) => ({
        type: "Feature",
        properties: { id: a.id, label: a.label, color: a.color, note: a.kind === "note", selected: a.id === clubMap?.selectedId },
        geometry: a.geometry as Geometry,
      })),
    }),
    [clubMap],
  );
  const drawing = useMemo<FeatureCollection>(() => {
    const pts = draw?.points ?? [];
    const features: Feature<Geometry>[] = pts.map((p) => ({ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: p } }));
    if (draw && pts.length >= 2 && draw.kind !== "pin" && draw.kind !== "note")
      features.push({
        type: "Feature",
        properties: {},
        geometry: draw.kind === "area" && pts.length >= 3 ? { type: "Polygon", coordinates: [[...pts, pts[0]]] } : { type: "LineString", coordinates: pts },
      });
    return { type: "FeatureCollection", features };
  }, [draw]);

  // Fit the selected drawing (or all of them) when asked
  const annFit = clubMap?.fit ?? 0;
  useEffect(() => {
    const map = mapRef?.getMap();
    const m = useCommunityStore.getState().clubMap;
    if (!map || !annFit || !m) return;
    const shown = m.selectedId ? m.annotations.filter((a) => a.id === m.selectedId) : m.annotations;
    const coords = shown.flatMap((a) => annotationPoints(a.geometry));
    if (coords.length === 0) return;
    if (coords.length === 1) {
      map.flyTo({ center: coords[0], zoom: Math.max(map.getZoom(), 15), duration: 900 });
      return;
    }
    map.fitBounds(
      [
        [Math.min(...coords.map((c) => c[0])), Math.min(...coords.map((c) => c[1]))],
        [Math.max(...coords.map((c) => c[0])), Math.max(...coords.map((c) => c[1]))],
      ],
      { padding: { top: 80, bottom: 340, left: 60, right: 80 }, duration: 900, maxZoom: 16 },
    );
  }, [mapRef, annFit]);

  // A saved view: 2D or 3D first, then the camera
  useEffect(() => {
    const map = mapRef?.getMap();
    if (!map || !cameraTo) return;
    const v = cameraTo.view;
    useMapStore.getState().setActiveView(v.terrain ? "3D" : "2D");
    const t = setTimeout(
      () => map.flyTo({ center: [v.lng, v.lat], zoom: v.zoom, pitch: v.terrain ? v.pitch : 0, bearing: v.bearing, duration: 1400 }),
      150,
    );
    return () => clearTimeout(t);
  }, [mapRef, cameraTo]);

  if (!isPanelOpen) return null;

  return (
    <>
      <Source id="community-attachment" type="geojson" data={attachment}>
        <Layer id="community-attachment-fill" type="fill" filter={["==", ["geometry-type"], "Polygon"]} paint={{ "fill-color": "#d49b22", "fill-opacity": 0.15 }} />
        <Layer
          id="community-attachment-line"
          type="line"
          filter={["!=", ["geometry-type"], "Point"]}
          paint={{ "line-color": "#d49b22", "line-width": 3 }}
        />
        <Layer
          id="community-attachment-point"
          type="circle"
          filter={["==", ["geometry-type"], "Point"]}
          paint={{ "circle-radius": 6, "circle-color": "#ffffff", "circle-stroke-color": "#d49b22", "circle-stroke-width": 3 }}
        />
      </Source>
      <Source id="community-posts" type="geojson" data={points}>
        <Layer
          id={POINTS_LAYER}
          type="circle"
          paint={{
            "circle-radius": ["case", ["get", "open"], 10, 7],
            "circle-color": ["get", "color"],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": ["case", ["get", "open"], 3, 2],
          }}
        />
      </Source>
      <Source id="community-annotations" type="geojson" data={annotations}>
        <Layer
          id="community-ann-fill"
          type="fill"
          filter={["==", ["geometry-type"], "Polygon"]}
          paint={{ "fill-color": ["get", "color"], "fill-opacity": ["case", ["get", "selected"], 0.3, 0.15] }}
        />
        <Layer
          id="community-ann-line"
          type="line"
          filter={["!=", ["geometry-type"], "Point"]}
          paint={{ "line-color": ["get", "color"], "line-width": ["case", ["get", "selected"], 5, 3] }}
        />
        <Layer
          id="community-ann-point"
          type="circle"
          filter={["==", ["geometry-type"], "Point"]}
          paint={{
            "circle-radius": ["case", ["get", "selected"], 9, ["get", "note"], 5, 7],
            "circle-color": ["case", ["get", "note"], "#ffffff", ["get", "color"]],
            "circle-stroke-color": ["case", ["get", "note"], ["get", "color"], "#ffffff"],
            "circle-stroke-width": ["case", ["get", "note"], 3, 2],
          }}
        />
        <Layer
          id="community-ann-label"
          type="symbol"
          layout={{
            "text-field": ["get", "label"],
            "text-size": ["case", ["get", "note"], 12, 11],
            "text-offset": [0, 1.3],
            "text-anchor": "top",
            "symbol-placement": "point",
            "text-max-width": 12,
          }}
          paint={{ "text-color": "#1a2214", "text-halo-color": "#ffffff", "text-halo-width": 1.5 }}
        />
      </Source>
      <Source id="community-drawing" type="geojson" data={drawing}>
        <Layer id="community-draw-fill" type="fill" filter={["==", ["geometry-type"], "Polygon"]} paint={{ "fill-color": draw?.color ?? "#d49b22", "fill-opacity": 0.2 }} />
        <Layer
          id="community-draw-line"
          type="line"
          filter={["!=", ["geometry-type"], "Point"]}
          paint={{ "line-color": draw?.color ?? "#d49b22", "line-width": 3, "line-dasharray": [2, 1] }}
        />
        <Layer
          id="community-draw-point"
          type="circle"
          filter={["==", ["geometry-type"], "Point"]}
          paint={{ "circle-radius": 5, "circle-color": "#ffffff", "circle-stroke-color": draw?.color ?? "#d49b22", "circle-stroke-width": 3 }}
        />
      </Source>
      <Source id="community-live-trail" type="geojson" data={liveTrail}>
        <Layer id="community-live-trail-line" type="line" paint={{ "line-color": "#1f6feb", "line-width": 3, "line-opacity": 0.85 }} />
      </Source>
      <Source id="community-live" type="geojson" data={livePoints}>
        <Layer
          id="community-live-dot"
          type="circle"
          paint={{
            "circle-radius": ["case", ["get", "selected"], 9, 7],
            "circle-color": ["case", ["get", "stale"], "#9aa0a6", "#1f6feb"],
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2.5,
          }}
        />
        <Layer
          id="community-live-label"
          type="symbol"
          layout={{ "text-field": ["get", "name"], "text-size": 11, "text-offset": [0, 1.4], "text-anchor": "top", "text-allow-overlap": false }}
          paint={{ "text-color": "#1a2214", "text-halo-color": "#ffffff", "text-halo-width": 1.5 }}
        />
      </Source>
      <Source id="community-picked" type="geojson" data={pickedPoint}>
        <Layer
          id="community-picked-dot"
          type="circle"
          paint={{ "circle-radius": 8, "circle-color": "#b4302a", "circle-stroke-color": "#ffffff", "circle-stroke-width": 3 }}
        />
      </Source>
    </>
  );
};
