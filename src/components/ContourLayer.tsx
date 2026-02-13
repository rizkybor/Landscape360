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
        // Debounce: Clear previous timeout
        if ((window as any)._contourTimeout) clearTimeout((window as any)._contourTimeout);
        
        (window as any)._contourTimeout = setTimeout(() => {
            const data = generateContours(map, bounds, contourInterval);
            if (data) setContours(data);
        }, 200); // Increased debounce to 200ms to prevent lag during rapid movement
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
        minzoom={12}
        filter={[
            'all',
            ['!=', ['%', ['get', 'elevation'], indexInterval], 0],
            ['==', ['%', ['get', 'elevation'], contourInterval], 0]
        ]}
        paint={{
          'line-color': '#FFBF00',
          'line-width': 0.8,
          'line-opacity': opacity * 0.6
        }}
      />

      {/* Index Contours - Thicker, darker/distinct */}
      <Layer
        id="contour-index"
        type="line"
        minzoom={10} // Index contours visible earlier
        filter={['==', ['%', ['get', 'elevation'], indexInterval], 0]}
        paint={{
          'line-color': '#FFBF00',
          'line-width': 2.0,
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
