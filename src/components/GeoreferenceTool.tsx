
import { useState, useEffect } from 'react';
import { Source, Layer, Marker, useMap } from 'react-map-gl/mapbox';
import { useCustomBasemapStore } from '../store/useCustomBasemapStore';
import { Move, Check, X, RotateCw, Maximize } from 'lucide-react';
// import * as turf from '@turf/turf';

export const GeoreferenceTool = () => {
  const { current: map } = useMap();
  const { 
    isGeoreferencing, 
    georeferenceTarget, 
    stopGeoreferencing, 
    setTempBounds,
    startGeoreferencing,
    initialGeoreferenceBounds,
    editingBasemapId,
    updateBasemapBounds,
    setEditingBasemapId
  } = useCustomBasemapStore();

  const [center, setCenter] = useState<[number, number] | null>(null);
  const [scale, setScale] = useState(1); // Scale factor
  // const [rotation, setRotation] = useState(0); // Rotation in degrees - Future feature
  
  // Initialize center when tool starts
  useEffect(() => {
    if (isGeoreferencing && map) {
      if (initialGeoreferenceBounds) {
          // Initialize from existing bounds
          const { north, south, east, west } = initialGeoreferenceBounds;
          const lat = (north + south) / 2;
          const lng = (east + west) / 2;
          setCenter([lng, lat]);
          
          // Calculate scale from width
          // baseWidth = 0.005 * scale
          // width = east - west
          // scale = width / 0.005
          const width = east - west;
          const newScale = width / 0.005;
          setScale(newScale);
          
      } else {
          // Default initialization (center of screen)
          const c = map.getCenter();
          setCenter([c.lng, c.lat]);
          setScale(1);
      }
      // setRotation(0);
    }
  }, [isGeoreferencing, map, initialGeoreferenceBounds]);

  if (!isGeoreferencing || !center || !map) return null;

  // Calculate Box Coordinates based on A4 aspect ratio OR Initial Bounds Ratio
  // A4 is 210 x 297 mm.
  // Ratio: 1.4142
  
  let ratio = georeferenceTarget === 'A4_LANDSCAPE' ? 1.4142 : 0.7071;
  
  // If editing existing, override ratio to match initial bounds
  if (initialGeoreferenceBounds) {
      const w = initialGeoreferenceBounds.east - initialGeoreferenceBounds.west;
      const h = initialGeoreferenceBounds.north - initialGeoreferenceBounds.south;
      if (h !== 0) ratio = w / h;
  }
  
  // Base size in degrees (approximate, changes with latitude but good enough for visual placement)
  // Let's start with a reasonable size visible on current zoom
  // We can adjust "baseSize" dynamically based on zoom level if we wanted, 
  // but simpler is to let user resize.
  // Let's say base width is 0.005 degrees.
  const baseWidth = 0.005 * scale;
  // const baseHeight = (baseWidth / ratio);
  
  const halfW = baseWidth / 2;
  const halfH = (baseWidth / ratio) / 2;

  // Create Polygon
  // We use turf to generate a rotated rectangle properly
  // const centerPoint = turf.point(center);
  // We need km for turf? No, degrees is easier manually if no rotation.
  // But for rotation we need turf or manual math.
  // Let's use simple manual math for unrotated box first, mapbox handles rotation?
  // No, we need to rotate the coordinates.
  
  // Simple Box (unrotated)
  // [minX, minY, maxX, maxY]
  // west, south, east, north
  const west = center[0] - halfW;
  const east = center[0] + halfW;
  const south = center[1] - halfH;
  const north = center[1] + halfH;
  
  const coordinates = [
    [west, north], // TL
    [east, north], // TR
    [east, south], // BR
    [west, south], // BL
    [west, north]  // Close
  ];
  
  // If we want rotation, we rotate points around center.
  // ... omitting rotation implementation for MVP unless requested, 
  // user just asked for "geser geser" (drag) and "measure".
  // But maps are usually North-Up.
  
  const geojson = {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coordinates]
    }
  };

  const handleConfirm = () => {
    // If editing existing, we update directly.
    if (editingBasemapId) {
         updateBasemapBounds(editingBasemapId, {
            north, south, east, west
         });
         setEditingBasemapId(null);
    } else {
        setTempBounds({
            north, south, east, west
        });
    }
    stopGeoreferencing();
  };

  const onDragCenter = (e: any) => {
    setCenter([e.lngLat.lng, e.lngLat.lat]);
  };

  const onDragResize = (e: any) => {
    // Calculate distance from center to new mouse position to determine scale
    // Simple heuristic: distance in x
    const dx = Math.abs(e.lngLat.lng - center[0]);
    // current halfW is 0.005 * scale / 2
    // new halfW is dx
    // scale = (dx * 2) / 0.005
    const newScale = (dx * 2) / 0.005;
    setScale(Math.max(0.1, newScale));
  };

  return (
    <>
      {/* The Box */}
      <Source type="geojson" data={geojson as any}>
        <Layer
          id="georef-fill"
          type="fill"
          paint={{
            'fill-color': '#3b82f6',
            'fill-opacity': 0.2
          }}
        />
        <Layer
          id="georef-outline"
          type="line"
          paint={{
            'line-color': '#2563eb',
            'line-width': 2,
            'line-dasharray': [2, 1]
          }}
        />
      </Source>

      {/* Center Handle (Move) */}
      <Marker
        longitude={center[0]}
        latitude={center[1]}
        draggable
        onDrag={onDragCenter}
        pitchAlignment="map"
      >
        <div className="p-3 md:p-2 bg-blue-600 rounded-full shadow-lg cursor-move hover:scale-110 transition-transform active:scale-125 touch-none">
          <Move size={20} className="text-white md:w-4 md:h-4" />
        </div>
      </Marker>

      {/* Resize Handle (Bottom Right) */}
      <Marker
        longitude={east}
        latitude={south}
        draggable
        onDrag={onDragResize}
        pitchAlignment="map"
      >
        <div className="p-2.5 md:p-1.5 bg-white border-2 border-blue-600 rounded-full shadow-lg cursor-nwse-resize hover:scale-110 transition-transform active:scale-125 touch-none">
          <Maximize size={18} className="text-blue-600 md:w-3.5 md:h-3.5" />
        </div>
      </Marker>

      {/* UI Controls */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-xl p-2 flex items-center gap-2 z-50 w-[90%] md:w-auto justify-center">
          <button 
            onClick={() => startGeoreferencing(georeferenceTarget === 'A4_LANDSCAPE' ? 'A4_PORTRAIT' : 'A4_LANDSCAPE')}
            className="flex-1 md:flex-none px-3 py-2 md:py-1 border-r border-gray-200 flex items-center justify-center gap-2 hover:bg-gray-50 rounded transition-colors"
            title="Rotate Orientation"
          >
              <RotateCw size={16} className="text-blue-500" />
              <span className="text-xs font-bold text-gray-600 uppercase">
                  {georeferenceTarget.replace('A4_', '')}
              </span>
          </button>
          <button 
            onClick={handleConfirm}
            className="flex-1 md:flex-none flex items-center justify-center gap-1 px-4 py-2 md:py-1.5 bg-green-500 hover:bg-green-600 text-white rounded text-sm font-bold transition-colors shadow-sm active:bg-green-700"
          >
              <Check size={18} /> Apply
          </button>
          <button 
            onClick={stopGeoreferencing}
            className="flex-none px-3 py-2 md:py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-sm font-medium transition-colors active:bg-gray-300"
          >
              <X size={18} />
          </button>
      </div>
      
      {/* Instructions */}
      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-xs backdrop-blur-sm pointer-events-none">
          Drag center to move • Drag corner to resize
      </div>
    </>
  );
};
