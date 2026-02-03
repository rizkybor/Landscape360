import { useEffect, useState, useMemo } from 'react';
import { Source, Layer, useMap, Marker } from 'react-map-gl/mapbox';
import { useSurveyStore } from '../store/useSurveyStore';
import { getAzimuthData, formatDegrees, formatDistance, toDMS } from '../utils/surveyUtils';
import type { MapMouseEvent } from 'mapbox-gl';
import type { FeatureCollection } from 'geojson';

export const PlottingLayer = () => {
  const { current: mapRef } = useMap();
  const { isPlotMode, groups, activeGroupId, addPoint, updatePointPosition } = useSurveyStore();
  const [cursorLocation, setCursorLocation] = useState<[number, number] | null>(null);
  const [hoveredLabelId, setHoveredLabelId] = useState<string | null>(null);
  const [draggedPointId, setDraggedPointId] = useState<string | null>(null);

  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0];

  // Handle Map Click (Only if not dragging)
  useEffect(() => {
    if (!mapRef || !isPlotMode) return;
    const map = mapRef.getMap();

    const handleClick = (e: MapMouseEvent) => {
      // Prevent adding point if we just finished dragging
      if (draggedPointId) {
          setDraggedPointId(null);
          return;
      }
      
      const { lng, lat } = e.lngLat;
      
      // Query elevation
      let elevation = 0;
      try {
        if (map.isStyleLoaded()) {
            elevation = map.queryTerrainElevation(e.lngLat) || 0;
        }
      } catch (err) {
        console.warn("Elevation query failed", err);
      }

      addPoint({ lng, lat, elevation });
    };

    const handleMouseMove = (e: MapMouseEvent) => {
        if (!draggedPointId) {
            setCursorLocation([e.lngLat.lng, e.lngLat.lat]);
            map.getCanvas().style.cursor = 'crosshair';
        }
    };

    map.on('click', handleClick);
    map.on('mousemove', handleMouseMove);

    return () => {
      map.off('click', handleClick);
      map.off('mousemove', handleMouseMove);
      map.getCanvas().style.cursor = '';
    };
  }, [mapRef, isPlotMode, addPoint, draggedPointId]);

  const onMarkerDragStart = (id: string) => {
      setDraggedPointId(id);
      setCursorLocation(null); // Hide preview line while dragging
  };

  const onMarkerDrag = (id: string, event: { lngLat: { lng: number; lat: number } }) => {
      // Find which group this point belongs to
      const group = groups.find(g => g.points.some(p => p.id === id));
      if (group) {
          // Query new elevation during drag
          let elevation = undefined;
          if (mapRef) {
             const map = mapRef.getMap();
             if (map.isStyleLoaded()) {
                elevation = map.queryTerrainElevation(event.lngLat) || 0;
             }
          }
          updatePointPosition(group.id, id, event.lngLat.lat, event.lngLat.lng, elevation);
      }
  };

  const onMarkerDragEnd = () => {
      // Small timeout to prevent click event from firing immediately after drag
      setTimeout(() => setDraggedPointId(null), 100);
  };

  const isMobile = window.innerWidth < 768;

  // Prepare GeoJSON
  // pointsGeoJSON removed as we use Markers for interactivity
  
  const linesGeoJSON: FeatureCollection = {
    type: 'FeatureCollection',
    features: []
  };

  // Calculate labels for Points (Lat, Lng, Elev)
  const pointLabels = useMemo(() => {
    return groups.flatMap(g => g.points.map((p, idx) => ({
      id: p.id,
      lng: p.lng,
      lat: p.lat,
      elev: p.elevation,
      name: `Point ${idx + 1}`,
      color: g.color,
      isActive: g.id === activeGroupId
    })));
  }, [groups, activeGroupId]);

  // Calculate measurement labels for Markers
  const measurementLabels = useMemo(() => {
      const labels: Array<{
          id: string;
          lng: number;
          lat: number;
          text: string;
          subText: string;
          totalDist: string;
          color: string;
      }> = [];

      groups.forEach(g => {
          if (g.points.length >= 2) {
              // Continuous line for visual
              const coordinates = g.points.map(p => [p.lng, p.lat]);
              linesGeoJSON.features.push({
                  type: 'Feature',
                  geometry: { type: 'LineString', coordinates },
                  properties: { 
                      groupId: g.id, 
                      color: g.color,
                      isActive: g.id === activeGroupId 
                  }
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } as any);

              // Calculate labels and accumulated distance
              let accumulatedDistance = 0;

              for (let i = 0; i < g.points.length - 1; i++) {
                  const p1 = g.points[i];
                  const p2 = g.points[i+1];
                  const data = getAzimuthData(p1, p2);
                  
                  accumulatedDistance += data.horizontalDistance;

                  // Midpoint
                  const midLng = (p1.lng + p2.lng) / 2;
                  const midLat = (p1.lat + p2.lat) / 2;

                  labels.push({
                      id: `${g.id}-${i}`,
                      lng: midLng,
                      lat: midLat,
                      text: formatDistance(data.horizontalDistance),
                      subText: `${formatDegrees(data.forwardAzimuth)} • ${data.slope.toFixed(1)}%`,
                      totalDist: `Total: ${formatDistance(accumulatedDistance)}`,
                      color: g.color
                  });
              }
          }
      });
      return labels;
  }, [groups, activeGroupId, linesGeoJSON]);

  // Preview line from last point of active group to cursor
  if (isPlotMode && activeGroup && activeGroup.points.length > 0 && cursorLocation) {
      const lastPoint = activeGroup.points[activeGroup.points.length - 1];
      
      // Calculate preview data
      const tempPoint = { ...lastPoint, lng: cursorLocation[0], lat: cursorLocation[1], elevation: lastPoint.elevation }; 
      const data = getAzimuthData(lastPoint, tempPoint);
      
      // Calculate accumulated distance for preview
      let currentTotal = 0;
      for (let i = 0; i < activeGroup.points.length - 1; i++) {
          const p1 = activeGroup.points[i];
          const p2 = activeGroup.points[i+1];
          currentTotal += getAzimuthData(p1, p2).horizontalDistance;
      }
      const previewTotal = currentTotal + data.horizontalDistance;

      linesGeoJSON.features.push({
          type: 'Feature',
          geometry: { 
              type: 'LineString', 
              coordinates: [[lastPoint.lng, lastPoint.lat], cursorLocation] 
          },
          properties: { type: 'preview', color: activeGroup.color }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      // Add preview measurement label
      const midLng = (lastPoint.lng + cursorLocation[0]) / 2;
      const midLat = (lastPoint.lat + cursorLocation[1]) / 2;
      
      measurementLabels.push({
          id: 'preview-label',
          lng: midLng,
          lat: midLat,
          text: formatDistance(data.horizontalDistance),
          subText: `${formatDegrees(data.forwardAzimuth)} • ${data.slope.toFixed(1)}%`,
          totalDist: `Total: ${formatDistance(previewTotal)}`,
          color: activeGroup.color
      });
  }

  if (!groups.length && !isPlotMode) return null;

  return (
    <>
      <Source id="survey-lines" type="geojson" data={linesGeoJSON}>
        <Layer
          id="survey-lines-path"
          type="line"
          paint={{
            'line-color': ['get', 'color'],
            'line-width': ['case', ['match', ['get', 'type'], 'preview', true, false], 2, 3],
            'line-dasharray': ['case', ['match', ['get', 'type'], 'preview', true, false], [2, 2], [1]],
            'line-opacity': ['case', ['get', 'isActive'], 1, 0.6]
          }}
          layout={{
              'line-join': 'round',
              'line-cap': 'round'
          }}
        />
      </Source>

      {/* Professional Measurement Markers */}
      {measurementLabels.map((label) => {
          const isHovered = hoveredLabelId === label.id;
          return (
            <Marker
                key={label.id}
                longitude={label.lng}
                latitude={label.lat}
                anchor="center"
                style={{ zIndex: isHovered ? 50 : 1 }}
            >
                <div 
                  className={`
                    ${isMobile ? 'bg-white shadow-md' : 'bg-white/90 backdrop-blur-md shadow-lg'} rounded-lg border border-white/40 
                    flex flex-col items-center transform transition-all duration-200 cursor-default select-none
                    ${isHovered ? 'scale-110 px-3 py-2' : (isMobile ? 'scale-100 px-2 py-1' : 'scale-100 px-2 py-0.5 hover:scale-105')}
                  `}
                  onMouseEnter={() => setHoveredLabelId(label.id)}
                  onMouseLeave={() => setHoveredLabelId(null)}
                  onClick={() => isMobile && setHoveredLabelId(isHovered ? null : label.id)} // Toggle on mobile tap
                >
                    <span className={`${isMobile ? 'text-[11px]' : 'text-[10px]'} font-extrabold text-gray-800 leading-tight drop-shadow-sm whitespace-nowrap`}>{label.text}</span>
                    
                    {isHovered && (
                        <>
                            <div className="h-px w-full bg-gray-200 my-1"></div>
                            <span className="text-[9px] font-medium text-gray-500 leading-tight tracking-wide whitespace-nowrap">{label.subText}</span>
                            <div className="h-px w-full bg-gray-200 my-1"></div>
                            <span className="text-[9px] font-bold text-blue-600 leading-tight tracking-wide whitespace-nowrap">{label.totalDist}</span>
                        </>
                    )}
                </div>
            </Marker>
          );
      })}

      {/* Point Markers (Draggable) */}
      {pointLabels.map((label) => {
          const isHovered = hoveredLabelId === label.id;
          const isDragging = draggedPointId === label.id;
          
          return (
            <Marker
                key={label.id}
                longitude={label.lng}
                latitude={label.lat}
                anchor="center" // Changed to center so the dot is at the coordinate
                draggable={true}
                onDragStart={() => onMarkerDragStart(label.id)}
                onDrag={(e) => onMarkerDrag(label.id, e)}
                onDragEnd={onMarkerDragEnd}
                style={{ zIndex: isDragging ? 100 : (isHovered ? 60 : 2) }}
            >
                <div 
                    className="relative flex flex-col items-center group cursor-grab active:cursor-grabbing"
                    onMouseEnter={() => setHoveredLabelId(label.id)}
                    onMouseLeave={() => setHoveredLabelId(null)}
                    onClick={(e) => {
                        if (isMobile) {
                            e.stopPropagation();
                            setHoveredLabelId(isHovered ? null : label.id);
                        }
                    }}
                >
                    {/* The Dot Visual (Replaces the Circle Layer) */}
                    <div 
                        className={`
                            rounded-full border-2 border-black shadow-sm transition-all duration-200
                            ${label.isActive ? (isMobile ? 'w-6 h-6' : 'w-4 h-4') : (isMobile ? 'w-4 h-4' : 'w-3 h-3')} 
                            ${isHovered || isDragging ? 'scale-125' : 'scale-100'}
                        `}
                        style={{ backgroundColor: label.color }}
                    ></div>

                    {/* The Label (Positioned Above) */}
                    <div 
                      className={`
                        absolute bottom-full mb-2
                        flex flex-col ${isMobile ? 'bg-black/90' : 'bg-black/85 backdrop-blur-md'} rounded-lg shadow-2xl border border-yellow-500/30 
                        overflow-hidden transform transition-all duration-200 select-none
                        ${isHovered || isDragging ? 'scale-105 min-w-[140px] opacity-100' : 'scale-100 min-w-0 opacity-100'}
                        ${!isHovered && !isDragging ? 'pointer-events-none' : ''}
                      `}
                    >
                        {/* Header */}
                        <div className={`
                            bg-yellow-500/10 flex justify-between items-center border-yellow-500/20
                            ${isHovered || isDragging ? 'px-2.5 py-1.5 border-b' : 'px-2 py-1 gap-2'}
                        `}>
                            <span className="text-[10px] font-bold text-yellow-400 uppercase tracking-wider whitespace-nowrap">{label.name}</span>
                            <span className="text-[9px] font-mono text-yellow-200 font-bold whitespace-nowrap">{label.elev.toFixed(1)}m</span>
                        </div>
                        
                        {/* Body - Only visible on Hover/Drag */}
                        {(isHovered || isDragging) && (
                            <div className="p-2 flex flex-col gap-1">
                                <div className="flex justify-between items-center gap-3">
                                    <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">Lat</span>
                                    <span className="text-[9px] font-mono text-gray-300">{toDMS(label.lat, true)}</span>
                                </div>
                                <div className="flex justify-between items-center gap-3">
                                    <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider">Lng</span>
                                    <span className="text-[9px] font-mono text-gray-300">{toDMS(label.lng, false)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </Marker>
          );
      })}
    </>
  );
};
