import { useEffect, useMemo } from 'react';
import { Source, Layer, Marker, useMap } from 'react-map-gl/mapbox';
import type { FeatureCollection, LineString, Point } from 'geojson';
import { useTrackRecorderStore } from '../store/useTrackRecorderStore';
import { getBounds, splitSegments } from '../utils/trackRecorderGeo';
import type { TrackPoint } from '../types/trackRecorder';

const toLines = (points: TrackPoint[]): FeatureCollection<LineString> => ({
  type: 'FeatureCollection',
  features: splitSegments(points)
    .filter((segment) => segment.length >= 2)
    .map((segment) => ({
      type: 'Feature',
      properties: {},
      geometry: { type: 'LineString', coordinates: segment.map((p) => [p.lng, p.lat]) },
    })),
});

const EMPTY_POINTS: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };

// Map rendering for the Track Recorder: the recording in progress, the current GPS fix,
// and a saved track opened from "My Tracks".
export const TrackRecorderLayer = () => {
  const { current: mapRef } = useMap();
  const activePoints = useTrackRecorderStore((s) => s.activePoints);
  const hasActiveTrack = useTrackRecorderStore((s) => !!s.activeTrack);
  const currentFix = useTrackRecorderStore((s) => s.currentFix);
  const viewing = useTrackRecorderStore((s) => s.viewing);

  const activeLines = useMemo(() => toLines(activePoints), [activePoints]);
  const viewingLines = useMemo(() => (viewing ? toLines(viewing.points) : null), [viewing]);

  const accuracyCircle = useMemo<FeatureCollection<Point>>(() => {
    if (!currentFix || !hasActiveTrack) return EMPTY_POINTS;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { accuracy: currentFix.accuracy },
          geometry: { type: 'Point', coordinates: [currentFix.lng, currentFix.lat] },
        },
      ],
    };
  }, [currentFix, hasActiveTrack]);

  // Zoom to a saved track when it is opened
  useEffect(() => {
    if (!mapRef || !viewing) return;
    const bounds = getBounds(viewing.points);
    if (bounds) mapRef.fitBounds(bounds, { padding: 80, maxZoom: 16, duration: 1200 });
  }, [mapRef, viewing]);

  const viewStart = viewing?.points[0];
  const viewEnd = viewing && viewing.points.length > 1 ? viewing.points[viewing.points.length - 1] : null;

  return (
    <>
      {viewingLines && (
        <Source id="track-recorder-viewing" type="geojson" data={viewingLines}>
          <Layer
            id="track-recorder-viewing-casing"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{ 'line-color': '#0f172a', 'line-width': 7, 'line-opacity': 0.6 }}
          />
          <Layer
            id="track-recorder-viewing-line"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{ 'line-color': '#22d3ee', 'line-width': 4 }}
          />
        </Source>
      )}

      {viewStart && (
        <Marker longitude={viewStart.lng} latitude={viewStart.lat} anchor="center">
          <div className="w-4 h-4 rounded-full bg-forest-700 border-2 border-white shadow-lg" title="Start" />
        </Marker>
      )}
      {viewEnd && (
        <Marker longitude={viewEnd.lng} latitude={viewEnd.lat} anchor="center">
          <div className="w-4 h-4 rounded-sm bg-brick-500 border-2 border-white shadow-lg" title="Finish" />
        </Marker>
      )}

      {hasActiveTrack && (
        <Source id="track-recorder-active" type="geojson" data={activeLines}>
          <Layer
            id="track-recorder-active-casing"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{ 'line-color': '#7c2d12', 'line-width': 7, 'line-opacity': 0.6 }}
          />
          <Layer
            id="track-recorder-active-line"
            type="line"
            layout={{ 'line-join': 'round', 'line-cap': 'round' }}
            paint={{ 'line-color': '#f97316', 'line-width': 4 }}
          />
        </Source>
      )}

      {hasActiveTrack && currentFix && (
        <>
          <Source id="track-recorder-fix" type="geojson" data={accuracyCircle}>
            <Layer
              id="track-recorder-fix-accuracy"
              type="circle"
              paint={{
                // Approximate accuracy radius in pixels (meters -> pixels at the current zoom)
                'circle-radius': [
                  'interpolate', ['exponential', 2], ['zoom'],
                  10, ['/', ['get', 'accuracy'], 150],
                  20, ['/', ['get', 'accuracy'], 0.15],
                ],
                'circle-color': '#f97316',
                'circle-opacity': 0.12,
                'circle-stroke-color': '#f97316',
                'circle-stroke-opacity': 0.4,
                'circle-stroke-width': 1,
              }}
            />
          </Source>
          <Marker longitude={currentFix.lng} latitude={currentFix.lat} anchor="center">
            <div className="relative w-4 h-4">
              <div className="absolute inset-0 rounded-full bg-ember-500 animate-ping opacity-60" />
              <div className="relative w-4 h-4 rounded-full bg-ember-500 border-2 border-white shadow-lg" />
            </div>
          </Marker>
        </>
      )}
    </>
  );
};
