import React, { useEffect, useState } from 'react';
import { Source, Layer, useMap } from 'react-map-gl/mapbox';
import { useMapStore } from '../store/useMapStore';
import type { FeatureCollection } from 'geojson';

// Helper to format decimal degrees to DMS string
const formatDMS = (val: number, isLat: boolean): string => {
  const absVal = Math.abs(val);
  const d = Math.floor(absVal);
  const m = Math.floor((absVal - d) * 60);
  // Round seconds to integer to avoid decimals like "60.0"
  const s = Math.round(((absVal - d - m / 60) * 3600));
  
  // Handle case where seconds round up to 60
  let finalS = s;
  let finalM = m;
  let finalD = d;

  if (finalS === 60) {
      finalS = 0;
      finalM += 1;
  }
  if (finalM === 60) {
      finalM = 0;
      finalD += 1;
  }
  
  const dir = isLat 
    ? (val >= 0 ? 'N' : 'S') 
    : (val >= 0 ? 'E' : 'W');

  // Always show seconds as 00" if 0, and ensure 2 digits padding if needed?
  // User asked to "add 00" if vertical" and "don't use 60 but 00" for horizontal".
  // User also said "no decimals".
  // Let's standardise: always show D° M' S" format with integer seconds.
  
  const sStr = finalS < 10 ? `0${finalS}` : `${finalS}`;
  
  return `${finalD}° ${finalM}' ${sStr}" ${dir}`;
};

export const GridDMSLayer = React.memo(() => {
  const { current: map } = useMap();
  const showGridDMS = useMapStore(state => state.showGridDMS);
  const gridOpacity = useMapStore(state => state.gridOpacity);
  const gridStep = useMapStore(state => state.gridStep);
  const [gridData, setGridData] = useState<FeatureCollection>({ type: 'FeatureCollection', features: [] });

  useEffect(() => {
    if (!map || !showGridDMS) {
        if (gridData.features.length > 0) {
             setGridData({ type: 'FeatureCollection', features: [] });
        }
        return;
    }

    const updateGrid = () => {
      const bounds = map.getBounds();
      const zoom = map.getZoom();

      if (!bounds) return;

      const south = bounds.getSouth();
      const north = bounds.getNorth();
      const west = bounds.getWest();
      const east = bounds.getEast();

      // Determine grid spacing based on zoom level or manual setting
      let step = 1.0; // Default 1 degree

      if (gridStep !== 'auto' && typeof gridStep === 'number') {
          // Manual setting
          step = gridStep;
      } else {
          // Auto scaling based on provided scale reference
          // 1:250.000 (5' / ~9km) -> Zoom ~8-10
          // 1:50.000 (1' / ~1.8km) -> Zoom ~11-13
          // 1:25.000 (30" / ~900m) -> Zoom ~14
          // 1:10.000 (15" / ~450m) -> Zoom ~15+
          
          if (zoom >= 15) step = 15 / 3600; // 15" (~450m - 1:10.000)
          else if (zoom >= 14) step = 30 / 3600; // 30" (~900m - 1:25.000)
          else if (zoom >= 12) step = 1 / 60; // 1' (~1.8km - 1:50.000)
          else if (zoom >= 10) step = 5 / 60; // 5' (~9km - 1:250.000)
          else if (zoom >= 8) step = 10 / 60; // 10'
          else if (zoom >= 6) step = 0.5; // 30'
          else step = 1.0; // 1 degree
      }

      const features: any[] = [];

      // Generate Latitude Lines (Horizontal)
      const startLat = Math.floor(south / step) * step;
      for (let lat = startLat; lat <= north + step; lat += step) {
        // Fix floating point errors
        const cleanLat = Math.round(lat * 360000) / 360000;
        if (cleanLat < -90 || cleanLat > 90) continue;

        // Line
        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [[west - 1, cleanLat], [east + 1, cleanLat]] // Extend slightly beyond view
          },
          properties: {
            type: 'grid-line',
            value: cleanLat,
            axis: 'lat'
          }
        });

        // Label (placed at the center or edges)
        // Let's place labels along the left and right edges of the view, clamped to the line
        // Actually, placing it at the center longitude is easiest for visibility
        features.push({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [(west + east) / 2, cleanLat]
            },
            properties: {
                type: 'grid-label',
                text: formatDMS(cleanLat, true),
                axis: 'lat'
            }
        });
      }

      // Generate Longitude Lines (Vertical)
      const startLng = Math.floor(west / step) * step;
      for (let lng = startLng; lng <= east + step; lng += step) {
        const cleanLng = Math.round(lng * 360000) / 360000;
        
        // Line
        features.push({
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [[cleanLng, south - 1], [cleanLng, north + 1]]
          },
          properties: {
            type: 'grid-line',
            value: cleanLng,
            axis: 'lng'
          }
        });

        // Label
        features.push({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [cleanLng, (south + north) / 2]
            },
            properties: {
                type: 'grid-label',
                text: formatDMS(cleanLng, false),
                axis: 'lng'
            }
        });
      }

      setGridData({ type: 'FeatureCollection', features });
    };

    // Initial update
    updateGrid();

    // Listen for move events
    // Optimization: We use 'moveend' to only update AFTER drag/zoom is finished.
    // This prevents lag during interaction (drag/pinch).
    // The previous grid remains visible during drag, then snaps to new bounds after stop.
    map.on('moveend', updateGrid);
    
    // Also update on zoom to change density
    // Mapbox fires 'moveend' after zoom too, but explicit 'zoomend' ensures coverage.
    // 'moveend' usually covers 'zoomend' in GL JS, but redundant listener is safe/cheap here.
    map.on('zoomend', updateGrid);

    return () => {
      map.off('moveend', updateGrid);
      map.off('zoomend', updateGrid);
    };
  }, [map, showGridDMS, gridStep]); // Added gridStep dependency

  if (!showGridDMS) return null;

  return (
    <Source id="dms-grid-source" type="geojson" data={gridData}>
      {/* Grid Lines */}
      <Layer
        id="dms-grid-lines"
        type="line"
        paint={{
          'line-color': 'rgba(59, 130, 246, 1)', // Base color, opacity handled separately
          'line-opacity': gridOpacity,
          'line-width': 1,
          'line-dasharray': [2, 2]
        }}
      />
      
      {/* Grid Labels - Latitude (Horizontal) */}
      <Layer
        id="dms-grid-labels-lat"
        type="symbol"
        layout={{
          'text-field': ['get', 'text'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 13,
          'text-justify': 'center',
          'text-anchor': 'center',
          'symbol-placement': 'point',
          'text-allow-overlap': true,
          'text-ignore-placement': true
        }}
        paint={{
          'text-color': '#3b82f6', // Blue color (blue-500 equivalent)
          'text-halo-color': '#ffffff', // White halo for contrast
          'text-halo-width': 1,
          'text-halo-blur': 0.5,
          'text-opacity': gridOpacity // Direct sync with grid opacity
        }}
        filter={['all', ['==', 'type', 'grid-label'], ['==', 'axis', 'lat']]}
      />

      {/* Grid Labels - Longitude (Vertical) */}
      <Layer
        id="dms-grid-labels-lng"
        type="symbol"
        layout={{
          'text-field': ['get', 'text'],
          'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
          'text-size': 13,
          'text-justify': 'center',
          'text-anchor': 'center',
          'symbol-placement': 'point',
          'text-rotate': -90, // Vertical text
          'text-allow-overlap': true,
          'text-ignore-placement': true
        }}
        paint={{
          'text-color': '#3b82f6', // Blue color
          'text-halo-color': '#ffffff', // White halo
          'text-halo-width': 1,
          'text-halo-blur': 0.5,
          'text-opacity': gridOpacity // Direct sync with grid opacity
        }}
        filter={['all', ['==', 'type', 'grid-label'], ['==', 'axis', 'lng']]}
      />
    </Source>
  );
});
