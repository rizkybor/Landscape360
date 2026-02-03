import { useEffect, useState } from 'react';
import { Source, Layer, useMap } from 'react-map-gl/mapbox';
import { generateContours } from '../utils/TurfContourProvider';
import { useMapStore } from '../store/useMapStore';
import type { FeatureCollection, LineString, MultiLineString } from 'geojson';

export const ContourLayer = () => {
  const { current: mapRef } = useMap();
  const { contourInterval, opacity } = useMapStore();
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
    
    // Listen for source data loading (specifically DEM)
    const handleSourceData = (e: any) => {
        if (e.sourceId === 'mapbox-dem' && e.isSourceLoaded) {
            updateContours();
        }
    };

    map.on('idle', updateContours);
    map.on('styledata', updateContours); // Re-generate when style changes
    map.on('sourcedata', handleSourceData);

    return () => {
      map.off('moveend', updateContours);
      map.off('idle', updateContours);
      map.off('styledata', updateContours);
      map.off('sourcedata', handleSourceData);
    };
  }, [mapRef, contourInterval]);

  if (!contours) return null;

  // Determine Index Interval based on Base Interval (Readability Priority)
  // Logic: 
  // 12.5m -> Index 50m (Ratio 4:1)
  // 25m   -> Index 100m (Ratio 4:1)
  // 50m   -> Index 200m (Ratio 4:1) - simplified to 250m or 200m? Let's use 250m for cleaner 500m/1000m steps? 
  //          Actually standard map scales:
  //          1:25k (10m/50m or 12.5m/50m or 62.5m)
  //          1:50k (20m/100m)
  //          Let's stick to a clean 4x or 5x multiplier that results in "round" numbers like 50, 100, 200, 250, 500.
  
  let indexInterval = contourInterval * 5; // Default fallback (standard 5x)

  // Custom overrides for readability
  if (contourInterval === 12.5) indexInterval = 50;   // 4x
  else if (contourInterval === 25) indexInterval = 100; // 4x
  else if (contourInterval === 50) indexInterval = 200; // 4x or 250? 200 is cleaner (200, 400, 600)
  else if (contourInterval === 100) indexInterval = 500; // 5x (Standard 100, 200, 300, 400, 500)

  return (
    <Source id="contours" type="geojson" data={contours}>
      {/* Intermediate Contours - Thin, lighter, zoom > 14 only */}
      <Layer
        id="contour-intermediate"
        type="line"
        minzoom={14}
        filter={['!=', ['%', ['get', 'elevation'], indexInterval], 0]}
        paint={{
          'line-color': '#FFBF00',
          'line-width': 0.6,
          'line-opacity': opacity * 1
        }}
      />

      {/* Index Contours - Thicker, distinct, always visible (or minzoom adjusted) */}
      <Layer
        id="contour-index"
        type="line"
        filter={['==', ['%', ['get', 'elevation'], indexInterval], 0]}
        paint={{
          'line-color': '#FFBF00',
          'line-width': 1.5,
          'line-opacity': opacity
        }}
      />

      {/* Index Contour Labels */}
      <Layer
        id="contour-labels"
        type="symbol"
        filter={['==', ['%', ['get', 'elevation'], indexInterval], 0]}
        layout={{
          'symbol-placement': 'line',
          'text-field': ['concat', ['get', 'elevation'], 'm'],
          'text-size': 10,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': false,
          'text-ignore-placement': false
        }}
        paint={{
          'text-color': '#FFFFFF',
          'text-halo-color': '#000000',
          'text-halo-width': 1,
          'text-opacity': opacity
        }}
      />
    </Source>
  );
};
