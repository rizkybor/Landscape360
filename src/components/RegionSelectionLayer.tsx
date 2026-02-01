import { useMemo } from 'react';
import { Source, Layer, Marker } from 'react-map-gl/mapbox';
import { useMapStore } from '../store/useMapStore';

export const RegionSelectionLayer = () => {
  const { regionPoints, interactionMode } = useMapStore();

  const geoJsonData = useMemo(() => {
    if (regionPoints.length === 0) return null;

    // Create a feature collection
    const features: any[] = [];

    // Add lines connecting points
    if (regionPoints.length > 1) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [...regionPoints, regionPoints.length >= 4 ? regionPoints[0] : []].filter(p => p.length > 0)
        }
      });
    }

    // Add polygon if we have at least 3 points
    if (regionPoints.length >= 3) {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[...regionPoints, regionPoints[0]]]
        }
      });
    }

    return {
      type: 'FeatureCollection',
      features
    } as any;
  }, [regionPoints]);

  if (interactionMode !== 'draw_region' && regionPoints.length === 0) return null;

  return (
    <>
      {/* Render Markers for each point */}
      {regionPoints.map((point, index) => (
        <Marker 
            key={index} 
            longitude={point[0]} 
            latitude={point[1]} 
            anchor="center"
        >
            <div className="w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-md flex items-center justify-center text-[8px] font-bold text-blue-600">
                {index + 1}
            </div>
        </Marker>
      ))}

      {/* Render Polygon and Lines */}
      {geoJsonData && (
        <Source id="region-selection" type="geojson" data={geoJsonData}>
          <Layer
            id="region-fill"
            type="fill"
            paint={{
              'fill-color': '#3b82f6',
              'fill-opacity': 0.2
            }}
          />
          <Layer
            id="region-outline"
            type="line"
            paint={{
              'line-color': '#2563eb',
              'line-width': 2,
              'line-dasharray': [2, 1]
            }}
          />
        </Source>
      )}
    </>
  );
};
