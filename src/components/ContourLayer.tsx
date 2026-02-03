import { Source, Layer } from 'react-map-gl/mapbox';
import { useMapStore } from '../store/useMapStore';

export const ContourLayer = () => {
  const { contourInterval, opacity } = useMapStore();

  // Use Mapbox Terrain v2 Vector Tiles for reliable, fast contours in both 2D and 3D
  // This avoids the issue where 2D mode (without visual terrain) cannot generate client-side contours.
  // Standard metric intervals: 10m base resolution usually.
  
  // Logic for Index Contours (Major lines)
  // Usually every 5th line.
  const indexInterval = contourInterval * 5;

  return (
    <Source id="mapbox-terrain-vector" type="vector" url="mapbox://mapbox.mapbox-terrain-v2">
      {/* Intermediate Contours */}
      <Layer
        id="contour-intermediate"
        source-layer="contour"
        type="line"
        minzoom={12}
        // Filter: Show lines that match the interval, but exclude index lines (to avoid double drawing if needed, or just let them overlap)
        // Note: Mapbox Terrain v2 'ele' is in meters.
        filter={[
            'all',
            ['==', ['%', ['get', 'ele'], contourInterval], 0],
            ['!=', ['%', ['get', 'ele'], indexInterval], 0] 
        ]}
        paint={{
          'line-color': '#FFBF00',
          'line-width': 0.6,
          'line-opacity': opacity
        }}
      />

      {/* Index Contours (Major) */}
      <Layer
        id="contour-index"
        source-layer="contour"
        type="line"
        minzoom={10}
        filter={['==', ['%', ['get', 'ele'], indexInterval], 0]}
        paint={{
          'line-color': '#FFBF00',
          'line-width': 1.5,
          'line-opacity': opacity
        }}
      />

      {/* Index Contour Labels */}
      <Layer
        id="contour-labels"
        source-layer="contour"
        type="symbol"
        minzoom={11}
        filter={['==', ['%', ['get', 'ele'], indexInterval], 0]}
        layout={{
          'symbol-placement': 'line',
          'text-field': ['concat', ['get', 'ele'], 'm'],
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
