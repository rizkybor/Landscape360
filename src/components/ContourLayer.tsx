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
      const zoom = map.getZoom();

      // Performance Optimization: Only generate contours if zoom level is sufficient
      // Generating contours for the whole world at zoom 0 is extremely heavy
      if (bounds && zoom >= 11) {
        // Debounce: Clear previous timeout
        if ((window as any)._contourTimeout) clearTimeout((window as any)._contourTimeout);
        
        // Use a shorter debounce for responsiveness, but check moving state
        (window as any)._contourTimeout = setTimeout(() => {
            // Further optimization: Check if map is still moving
            if (map.isMoving() || map.isZooming()) return;

            // Generate contours in a non-blocking way if possible (using requestIdleCallback if available)
            const runGeneration = () => {
                const data = generateContours(map, bounds, contourInterval);
                if (data) setContours(data);
            };

            if ('requestIdleCallback' in window) {
                (window as any).requestIdleCallback(runGeneration);
            } else {
                setTimeout(runGeneration, 0);
            }
        }, 300); // 300ms is a good balance between responsiveness and performance
      } else {
        setContours(null); // Clear contours if zoomed out too far to save memory
      }
    };

    // Listen for source data loading (specifically DEM)
    const handleSourceData = (e: any) => {
        if (e.sourceId === 'mapbox-dem' && e.isSourceLoaded) {
            updateContours();
        }
    };

    // Update on moveend to avoid constant re-calculation
    map.on('moveend', updateContours);
    
    map.on('idle', updateContours);
    map.on('styledata', updateContours);
    map.on('sourcedata', handleSourceData);

    // Initial check
    if (map.isSourceLoaded('mapbox-dem')) {
        updateContours();
    }

    return () => {
      map.off('moveend', updateContours);
      map.off('idle', updateContours);
      map.off('styledata', updateContours);
      map.off('sourcedata', handleSourceData);
    };
  }, [mapRef, contourInterval]);

  if (!contours) return null;

  // Determine Index Interval based on Cartographic Standards (Scale 1:25k, 1:50k, etc.)
  // Logic: Index Interval is typically 4x or 5x the Contour Interval.
  // 12.5m (Scale 1:25,000) -> Index every 50m (4x) -> Intermediate: 12.5, 25.0, 37.5 (3 lines)
  // 25m   (Scale 1:50,000) -> Index every 100m (4x) -> Intermediate: 25, 50, 75 (3 lines)
  // 50m   (Scale 1:100,000) -> Index every 200m (4x) or 250m (5x)? Usually 250m in some standards, but 200m is common 1:4. Let's stick to 1:4 for consistency with user request (3 lines).
  // 125m  (Scale 1:250,000) -> Index every 500m (4x) -> Intermediate: 125, 250, 375 (3 lines)
  
  let indexInterval = contourInterval * 4; // Default 1:4 Ratio (3 intermediate lines)

  // Specific overrides to ensure strict adherence if needed
  if (contourInterval === 12.5) indexInterval = 50;    
  else if (contourInterval === 25) indexInterval = 100;
  else if (contourInterval === 50) indexInterval = 200; 
  else if (contourInterval === 125) indexInterval = 500;

  return (
    <Source id="contours" type="geojson" data={contours}>
      {/* Intermediate Contours - Thin, lighter, visible at appropriate zoom */}
      <Layer
        id="contour-intermediate"
        type="line"
        minzoom={13} // Increase minzoom for intermediate lines to reduce load
        filter={[
            'all',
            ['!=', ['%', ['get', 'elevation'], indexInterval], 0]
        ]}
        paint={{
          'line-color': '#FFBF00',
          'line-width': 0.8,
          'line-opacity': opacity * 0.5
        }}
      />

      {/* Index Contours - Thicker, darker/distinct */}
      <Layer
        id="contour-index"
        type="line"
        minzoom={11} // Index contours visible earlier
        filter={['==', ['%', ['get', 'elevation'], indexInterval], 0]}
        paint={{
          'line-color': '#FFBF00',
          'line-width': 1.5,
          'line-opacity': opacity
        }}
      />

      {/* Index Contour Labels - Only at higher zoom */}
      <Layer
        id="contour-labels"
        type="symbol"
        minzoom={14}
        filter={['==', ['%', ['get', 'elevation'], indexInterval], 0]}
        layout={{
          'symbol-placement': 'line',
          'text-field': ['concat', ['get', 'elevation'], 'm'],
          'text-size': 10,
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-max-angle': 30
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
