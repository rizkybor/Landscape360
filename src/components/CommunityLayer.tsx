import { useEffect, useMemo } from "react";
import { Layer, Source, useMap } from "react-map-gl/mapbox";
import type { MapMouseEvent } from "mapbox-gl";
import type { Feature, FeatureCollection, Geometry, Point } from "geojson";
import { useCommunityStore } from "../store/useCommunityStore";
import { attachmentCoords, conditionOf, fetchFeed, isOldReport, REPORT_FRESH_DAYS } from "../lib/community";

const POINTS_LAYER = "community-posts-dot";

// Community on the map, while its panel is open: the posts in view from the last 30 days
// (coloured by their first condition; stories in gold), the open post with its attachment, and
// the point being chosen for a new post.
export const CommunityLayer = () => {
  const { current: mapRef } = useMap();
  const isPanelOpen = useCommunityStore((s) => s.isPanelOpen);
  const mapPosts = useCommunityStore((s) => s.mapPosts);
  const focused = useCommunityStore((s) => s.focused);
  const shownItem = useCommunityStore((s) => s.shownItem);
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
    map.on("click", POINTS_LAYER, onClick);
    map.on("mouseenter", POINTS_LAYER, onEnter);
    map.on("mouseleave", POINTS_LAYER, onLeave);
    return () => {
      map.off("click", POINTS_LAYER, onClick);
      map.off("mouseenter", POINTS_LAYER, onEnter);
      map.off("mouseleave", POINTS_LAYER, onLeave);
    };
  }, [mapRef, isPanelOpen, picking]);

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
