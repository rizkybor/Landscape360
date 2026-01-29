import { useEffect, useState } from 'react';
import { Source, Layer, useMap } from 'react-map-gl/mapbox';
import { generateContours } from '../utils/TurfContourProvider';
import { useMapStore } from '../store/useMapStore';
import type { FeatureCollection, LineString, MultiLineString } from 'geojson';

export const ContourLayer = () => {
  const { current: mapRef } = useMap();
  const { contourInterval } = useMapStore();
  const [contours, setContours] = useState<FeatureCollection<LineString | MultiLineString> | null>(null);

  useEffect(() => {
    if (!mapRef) return;

    const map = mapRef.getMap();
    if (!map) return;

    const updateContours = () => {
      // Check if map style is loaded
      if (!map.isStyleLoaded()) return;

      // Check if terrain is loaded or we can get elevation
      // Also check bounds
      const bounds = map.getBounds();
      if (bounds) {
        // Run in a timeout to avoid blocking UI too much, or ideally use a worker
        // For now, simple execution
        setTimeout(() => {
            const data = generateContours(map, bounds, contourInterval);
            if (data) setContours(data);
        }, 100);
      }
    };

    // Update on moveend to avoid constant re-calculation
    map.on('moveend', updateContours);
    
    // Also try initial update
    if (map.loaded()) {
        updateContours();
    } else {
        map.once('load', updateContours);
    }
    
    // Also update when idle (terrain might load late)
    map.on('idle', updateContours);

    return () => {
      map.off('moveend', updateContours);
      map.off('idle', updateContours);
    };
  }, [mapRef, contourInterval]);

  if (!contours) return null;

  return (
    <Source id="contours" type="geojson" data={contours}>
      <Layer
        id="contour-lines"
        type="line"
        paint={{
          'line-color': [
            'interpolate',
            ['linear'],
            ['get', 'elevation'],
            0, '#0000FF',       // Sea level - Blue
            500, '#00FF00',     // Lowlands - Green
            1000, '#FFFF00',    // Mid - Yellow
            2000, '#FF0000',    // High - Red
            3000, '#FFFFFF'     // Peaks - White
          ],
          'line-width': 1.5,
          'line-opacity': 0.8
        }}
      />
    </Source>
  );
};
