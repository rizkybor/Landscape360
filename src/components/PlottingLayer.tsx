import { useEffect, useState, useMemo, useRef, type ReactNode } from 'react';
import { Source, Layer, useMap, Marker } from 'react-map-gl/mapbox';
import { useSurveyStore } from '../store/useSurveyStore';
import { getAzimuthData, formatDegrees, formatDistance, toDMS, snapToAngle, buildSurveyLine, segmentMidpoints, handleFromDrag, handleEnds } from '../utils/surveyUtils';
import { getElevationAtPoint } from '../utils/elevationUtils';
import type { LngLat, Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';
import type { SurveyHandle } from '../store/useSurveyStore';
import type { FeatureCollection } from 'geojson';

// Straight mode (or Shift held, which also snaps to 90°): a new point of the active sheet
// joins with a straight line, a sharp corner at the point it turns from, and its direction
// snapped to the chosen angle step (any angle when the step is 0).
const placeNewPoint = (target: [number, number], shiftKey: boolean): { coords: [number, number]; straight: boolean } => {
  const { groups, activeGroupId, isStraightMode, angleStep } = useSurveyStore.getState();
  if (!isStraightMode && !shiftKey) return { coords: target, straight: false };
  const step = shiftKey ? 90 : angleStep;
  const points = (groups.find((g) => g.id === activeGroupId) || groups[0])?.points ?? [];
  if (!step || points.length === 0) return { coords: target, straight: true };
  const last = points[points.length - 1];
  const prev = points.length >= 2 ? points[points.length - 2] : null;
  return {
    coords: snapToAngle(prev && [prev.lng, prev.lat], [last.lng, last.lat], target, step),
    straight: true,
  };
};

export const PlottingLayer = () => {
  const { current: mapRef } = useMap();
  const { isPlotMode, groups, activeGroupId, addPoint, updatePointPosition, setPointHandle } = useSurveyStore();
  const [cursorLocation, setCursorLocation] = useState<[number, number] | null>(null);
  const [hoveredLabelId, setHoveredLabelId] = useState<string | null>(null);
  const [draggedPointId, setDraggedPointId] = useState<string | null>(null);
  // Bezier handle being dragged (shown live, saved when the drag ends)
  const [curveDraft, setCurveDraftState] = useState<{ pointId: string; handle: SurveyHandle } | null>(null);
  // Also kept in a ref so ending a drag always saves the latest handle
  const curveDraftRef = useRef<{ pointId: string; handle: SurveyHandle } | null>(null);
  const setCurveDraft = (draft: { pointId: string; handle: SurveyHandle } | null) => {
      curveDraftRef.current = draft;
      setCurveDraftState(draft);
  };
  // Point whose Bezier handles are shown for editing
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0];

  // Pan helpers: dragging the map or holding Space pans instead of plotting
  const isSpaceHeldRef = useRef(false);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const didDragRef = useRef(false);
  const DRAG_THRESHOLD_PX = 4;

  // Handle Map Click (Only if not dragging)
  useEffect(() => {
    if (!mapRef || !isPlotMode) return;
    const map = mapRef.getMap();
    const canvas = map.getCanvas();

    const updateCursor = () => {
      if (pointerDownRef.current && (didDragRef.current || isSpaceHeldRef.current)) {
          canvas.style.cursor = 'grabbing';
      } else if (isSpaceHeldRef.current) {
          canvas.style.cursor = 'grab';
      } else {
          canvas.style.cursor = 'crosshair';
      }
    };

    const handleClick = async (e: MapMouseEvent) => {
      // Prevent adding point if we just finished dragging
      if (draggedPointId) {
          setDraggedPointId(null);
          return;
      }
      // Ignore clicks that ended a map pan or happened in Space-pan mode
      if (didDragRef.current || isSpaceHeldRef.current) return;
      
      const { coords: [lng, lat], straight } = placeNewPoint([e.lngLat.lng, e.lngLat.lat], e.originalEvent.shiftKey);
      
      // Query elevation using robust utility
      const elevation = await getElevationAtPoint(map, lng, lat);

      // In straight mode the line turns with a sharp corner at the previous point
      addPoint({ lng, lat, elevation }, { sharpenLast: straight });
    };

    const handleMouseMove = (e: MapMouseEvent) => {
        if (draggedPointId) return;

        const down = pointerDownRef.current;
        if (down && !didDragRef.current) {
            const { clientX, clientY } = e.originalEvent;
            if (Math.hypot(clientX - down.x, clientY - down.y) > DRAG_THRESHOLD_PX) {
                didDragRef.current = true;
            }
        }

        if (didDragRef.current || isSpaceHeldRef.current) {
            // Panning: hide the preview line and keep the hand cursor
            setCursorLocation(null);
        } else {
            setCursorLocation(placeNewPoint([e.lngLat.lng, e.lngLat.lat], e.originalEvent.shiftKey).coords);
        }
        updateCursor();
    };

    const handleMouseDown = (e: MouseEvent) => {
        pointerDownRef.current = { x: e.clientX, y: e.clientY };
        didDragRef.current = false;
        updateCursor();
    };

    const handleMouseUp = () => {
        if (!pointerDownRef.current) return;
        pointerDownRef.current = null;
        // Run after other mouseup handlers that reset the cursor
        requestAnimationFrame(updateCursor);
    };

    const handleMouseOut = () => {
        if (!pointerDownRef.current) setCursorLocation(null);
    };

    const isTypingTarget = (target: EventTarget | null) => {
        const el = target as HTMLElement | null;
        return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code !== 'Space' || isTypingTarget(e.target)) return;
        e.preventDefault(); // Avoid page scroll
        if (isSpaceHeldRef.current) return;
        isSpaceHeldRef.current = true;
        setCursorLocation(null);
        updateCursor();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.code !== 'Space') return;
        isSpaceHeldRef.current = false;
        updateCursor();
    };

    const handleBlur = () => {
        isSpaceHeldRef.current = false;
        pointerDownRef.current = null;
        updateCursor();
    };

    updateCursor();
    map.on('click', handleClick);
    map.on('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseout', handleMouseOut);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      map.off('click', handleClick);
      map.off('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseout', handleMouseOut);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      canvas.style.cursor = '';
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
          // Fast local query for realtime feedback (might be 0, but that's ok during drag)
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

  const onMarkerDragEnd = async (id: string, event: { lngLat: { lng: number; lat: number } }) => {
      // Final robust elevation check after drag ends
      const group = groups.find(g => g.points.some(p => p.id === id));
      if (group && mapRef) {
          const { lng, lat } = event.lngLat;
          const map = mapRef.getMap();
          
          // Use robust async query to ensure accuracy at final position
          const elevation = await getElevationAtPoint(map, lng, lat);
          
          updatePointPosition(group.id, id, lat, lng, elevation);
      }

      // Small timeout to prevent click event from firing immediately after drag
      setTimeout(() => setDraggedPointId(null), 100);
  };

  const isMobile = window.innerWidth < 768;

  // Prepare GeoJSON
  // pointsGeoJSON removed as we use Markers for interactivity
  
  // Calculate labels for Points (Lat, Lng, Elev)
  const pointLabels = useMemo(() => {
    return groups.flatMap(g => g.points.map((p, idx) => {
      const pointName = p.name || `Point ${idx + 1}`;
      return {
        id: p.id,
        groupId: g.id,
        lng: p.lng,
        lat: p.lat,
        elev: p.elevation,
        name: pointName,
        hasCustomName: !!p.name,
        color: g.color,
        isActive: g.id === activeGroupId
      };
    }));
  }, [groups, activeGroupId]);

  // Groups as drawn: with the handle being dragged applied
  const renderGroups = useMemo(
      () => curveDraft
          ? groups.map(g => ({
              ...g,
              points: g.points.map(p => p.id === curveDraft.pointId ? { ...p, corner: 'smooth' as const, handle: curveDraft.handle } : p)
            }))
          : groups,
      [groups, curveDraft]
  );

  const findPoint = (pointId: string) => {
      for (const g of renderGroups) {
          const point = g.points.find(p => p.id === pointId);
          if (point) return { group: g, point };
      }
      return null;
  };

  const startCurve = (pointId: string) => {
      setSelectedPointId(pointId);
      setCursorLocation(null);
  };

  const dragCurve = (pointId: string, lngLat: LngLat) => {
      const found = findPoint(pointId);
      if (found) setCurveDraft({ pointId, handle: handleFromDrag(found.point, [lngLat.lng, lngLat.lat]) });
  };

  const endCurve = () => {
      const draft = curveDraftRef.current;
      if (!draft) return;
      const found = findPoint(draft.pointId);
      // A tiny drag removes the handle (back to an automatic curve)
      const tooShort = Math.hypot(draft.handle.east, draft.handle.north) < 0.5;
      if (found) setPointHandle(found.group.id, draft.pointId, tooShort ? null : draft.handle);
      setCurveDraft(null);
  };

  // Calculate lines and measurement labels for Markers
  const { baseLines, baseLabels } = useMemo(() => {
      const lines: FeatureCollection = {
          type: 'FeatureCollection',
          features: []
      };
      const labels: Array<{
          id: string;
          lng: number;
          lat: number;
          text: string;
          subText: string;
          totalDist: string;
          color: string;
      }> = [];

      renderGroups.forEach(g => {
          if (g.points.length >= 2) {
              const midpoints = segmentMidpoints(g.points);
              // Curves through smooth points, sharp corners at sharp points (e.g. 90° turns)
              lines.features.push({
                  type: 'Feature',
                  geometry: { type: 'LineString', coordinates: buildSurveyLine(g.points) },
                  properties: { 
                      groupId: g.id, 
                      color: g.color,
                      isActive: g.id === activeGroupId 
                  }
              });

              // Calculate labels and accumulated distance
              let accumulatedDistance = 0;

              for (let i = 0; i < g.points.length - 1; i++) {
                  const p1 = g.points[i];
                  const p2 = g.points[i+1];
                  const data = getAzimuthData(p1, p2);
                  
                  accumulatedDistance += data.horizontalDistance;

                  // Middle of the drawn segment (on the curve when it bends)
                  const [midLng, midLat] = midpoints[i];

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
      return { baseLines: lines, baseLabels: labels };
  }, [renderGroups, activeGroupId]);

  // Bezier handles of the selected point (active sheet only)
  const selected = selectedPointId && isPlotMode ? findPoint(selectedPointId) : null;
  const selectedHandle = selected && selected.group.id === activeGroup?.id && selected.point.handle
      ? { point: selected.point, groupId: selected.group.id, ends: handleEnds(selected.point, selected.point.handle) }
      : null;
  const handleLines: FeatureCollection = {
      type: 'FeatureCollection',
      features: selectedHandle
          ? [{
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: [selectedHandle.ends.in, [selectedHandle.point.lng, selectedHandle.point.lat], selectedHandle.ends.out] },
              properties: { color: selected!.group.color }
            }]
          : []
  };

  // Copy so the preview below never mutates the memoized results
  const linesGeoJSON: FeatureCollection = { ...baseLines, features: [...baseLines.features] };
  const measurementLabels = [...baseLabels];

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
            // Thinner on phones, so the line does not hide the map under it
            'line-width': ['case', ['match', ['get', 'type'], 'preview', true, false], isMobile ? 1.5 : 2, isMobile ? 2 : 3],
            'line-dasharray': ['case', ['match', ['get', 'type'], 'preview', true, false], [2, 2], [1]],
            'line-opacity': ['case', ['get', 'isActive'], 1, 0.6]
          }}
          layout={{
              'line-join': 'miter',
              'line-cap': 'round'
          }}
        />
      </Source>

      {/* Bezier handles of the selected point */}
      <Source id="survey-handles" type="geojson" data={handleLines}>
        <Layer
          id="survey-handles-path"
          type="line"
          paint={{ 'line-color': ['get', 'color'], 'line-width': 1.5, 'line-dasharray': [2, 1.5] }}
        />
      </Source>
      {selectedHandle && (['out', 'in'] as const).map(side => (
          <Marker
              key={side}
              longitude={selectedHandle.ends[side][0]}
              latitude={selectedHandle.ends[side][1]}
              anchor="center"
              draggable
              onDragStart={() => setDraggedPointId(`handle-${side}`)}
              onDrag={(e) => {
                  const p = selectedHandle.point;
                  const h = handleFromDrag(p, [e.lngLat.lng, e.lngLat.lat]);
                  // The two handles stay opposite each other, like a smooth pen-tool point
                  setCurveDraft({ pointId: p.id, handle: side === 'out' ? h : { east: -h.east, north: -h.north } });
              }}
              onDragEnd={() => {
                  endCurve();
                  setTimeout(() => setDraggedPointId(null), 100);
              }}
              style={{ zIndex: 120 }}
          >
              <div
                  className={`${isMobile ? 'w-4 h-4' : 'w-3 h-3'} rounded-full bg-white border-2 shadow cursor-move`}
                  style={{ borderColor: selected!.group.color }}
                  title="Drag to shape the curve"
              />
          </Marker>
      ))}

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
                    ${isMobile ? 'bg-white/85 shadow-sm rounded-md' : 'bg-white/90 backdrop-blur-md shadow-lg rounded-lg'} border border-sand-200 
                    flex flex-col items-center transform transition-all duration-200 cursor-default select-none
                    ${isHovered ? 'scale-110 px-3 py-2' : (isMobile ? 'scale-100 px-1.5 py-px' : 'scale-100 px-2 py-0.5 hover:scale-105')}
                  `}
                  onMouseEnter={() => setHoveredLabelId(label.id)}
                  onMouseLeave={() => setHoveredLabelId(null)}
                  onClick={() => isMobile && setHoveredLabelId(isHovered ? null : label.id)} // Toggle on mobile tap
                >
                    <span className={`${isMobile ? 'text-[9px] text-sand-600' : 'text-[10px] text-sand-300'} font-extrabold leading-tight drop-shadow-sm whitespace-nowrap`}>{label.text}</span>
                    
                    {/* Always show subtext (Azimuth) if requested, or keep it hover only? User asked for "reactive azimuth near + icon" */}
                    {/* But this is for existing lines. Let's keep hover logic here but maybe enhance style? */}
                    {isHovered && (
                        <>
                            <div className="h-px w-full bg-sand-700 my-1"></div>
                            <span className="text-[9px] font-medium text-sand-500 leading-tight tracking-wide whitespace-nowrap">{label.subText}</span>
                            <div className="h-px w-full bg-sand-700 my-1"></div>
                            <span className="text-[9px] font-bold text-forest-700 leading-tight tracking-wide whitespace-nowrap">{label.totalDist}</span>
                        </>
                    )}
                </div>
            </Marker>
          );
      })}

      {/* Reactive Cursor Preview Label (Near + Icon / Mouse Cursor) */}
      {isPlotMode && cursorLocation && activeGroup && activeGroup.points.length > 0 && (
          <Marker
              longitude={cursorLocation[0]}
              latitude={cursorLocation[1]}
              anchor="left"
              offset={[15, 0]} // Offset to right of cursor
              style={{ pointerEvents: 'none', zIndex: 1000 }}
          >
             <div className="bg-white/90 backdrop-blur-md text-ink text-[10px] rounded px-2 py-1.5 shadow-xl border border-sand-200 flex flex-col gap-0.5">
                {(() => {
                    const lastPoint = activeGroup.points[activeGroup.points.length - 1];
                    const tempPoint = { ...lastPoint, lng: cursorLocation[0], lat: cursorLocation[1], elevation: lastPoint.elevation }; 
                    const data = getAzimuthData(lastPoint, tempPoint);
                    
                    return (
                        <>
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-sand-700 font-bold uppercase text-[8px]">Azim</span>
                                <span className="font-bold font-mono text-ink">{formatDegrees(data.forwardAzimuth)}</span>
                            </div>
                            {!isMobile && (
                                <div className="text-sand-600 text-[8px] pt-0.5">Hold Space or drag to pan</div>
                            )}
                        </>
                    );
                })()}
             </div>
          </Marker>
      )}

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
                style={{ zIndex: isDragging ? 100 : (isHovered ? 60 : 2) }}
            >
                <PointGesture
                    map={mapRef?.getMap() ?? null}
                    // On phones the dot is small; the padding keeps a finger-sized touch target
                    className={`relative flex flex-col items-center group cursor-grab active:cursor-grabbing ${isMobile ? 'p-2' : ''}`}
                    onMouseEnter={() => setHoveredLabelId(label.id)}
                    onMouseLeave={() => setHoveredLabelId(null)}
                    onTap={() => {
                        setSelectedPointId(label.id);
                        if (isMobile) setHoveredLabelId(isHovered ? null : label.id);
                    }}
                    onMoveStart={() => onMarkerDragStart(label.id)}
                    onMove={(lngLat) => onMarkerDrag(label.id, { lngLat })}
                    onMoveEnd={(lngLat) => onMarkerDragEnd(label.id, { lngLat })}
                    onCurveStart={() => startCurve(label.id)}
                    onCurve={(lngLat) => dragCurve(label.id, lngLat)}
                    onCurveEnd={endCurve}
                >
                    {/* The Dot/Square Visual */}
                    <div 
                        className={`
                            ${isMobile ? 'border-[1.5px]' : 'border-2'} border-black shadow-sm transition-all duration-200
                            ${label.hasCustomName ? 'rounded-[1px] rotate-45' : 'rounded-full'}
                            ${label.isActive ? (isMobile ? 'w-3.5 h-3.5' : 'w-4 h-4') : (isMobile ? 'w-2.5 h-2.5' : 'w-3 h-3')} 
                            ${isHovered || isDragging ? 'scale-125' : 'scale-100'}
                        `}
                        style={{ backgroundColor: label.hasCustomName ? '#6366f1' : label.color }}
                    ></div>

                    {/* The Label (Positioned Above). On phones it shows the name only (details on
                        tap or drag) and only for the active sheet, to keep the map visible */}
                    {(!isMobile || label.isActive || isHovered || isDragging) && (
                    <div 
                      className={`
                        absolute bottom-full ${isMobile ? 'mb-0' : 'mb-2'}
                        flex flex-col ${isMobile ? 'bg-white/95 rounded-md shadow-md' : 'bg-white/95 backdrop-blur-md rounded-lg shadow-2xl'} 
                        ${label.hasCustomName ? 'border-forest-300' : 'border-gold-200'} 
                        border overflow-hidden transform transition-all duration-200 select-none
                        ${isHovered || isDragging ? 'scale-105 min-w-[140px] opacity-100' : 'scale-100 min-w-0 opacity-100'}
                        ${!isHovered && !isDragging ? 'pointer-events-none' : ''}
                      `}
                    >
                        {/* Header */}
                        <div className={`
                            ${label.hasCustomName ? 'bg-forest-50 border-forest-200' : 'bg-gold-50 border-gold-200'} 
                            flex justify-between items-center
                            ${isHovered || isDragging ? 'px-2.5 py-1.5 border-b gap-2' : (isMobile ? 'px-1.5 py-px' : 'px-2 py-1 gap-2')}
                        `}>
                            <span className={`${isMobile && !isHovered && !isDragging ? 'text-[8px] tracking-wide' : 'text-[10px] tracking-wider'} font-bold ${label.hasCustomName ? 'text-forest-700' : 'text-gold-700'} uppercase whitespace-nowrap`}>{label.name}</span>
                            {(!isMobile || isHovered || isDragging) && (
                              <span className={`text-[9px] font-mono ${label.hasCustomName ? 'text-forest-700' : 'text-gold-700'} font-bold whitespace-nowrap`}>{label.elev.toFixed(1)} mdpl</span>
                            )}
                        </div>
                        
                        {/* Body - Only visible on Hover/Drag */}
                        {(isHovered || isDragging) && (
                            <div className="p-2 flex flex-col gap-1">
                                <div className="flex justify-between items-center gap-3">
                                    <span className="text-[8px] text-sand-500 font-bold uppercase tracking-wider">Lat</span>
                                    <span className="text-[9px] font-mono text-sand-700">{toDMS(label.lat, true)}</span>
                                </div>
                                <div className="flex justify-between items-center gap-3">
                                    <span className="text-[8px] text-sand-500 font-bold uppercase tracking-wider">Lng</span>
                                    <span className="text-[9px] font-mono text-sand-700">{toDMS(label.lng, false)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    )}
                </PointGesture>
            </Marker>
          );
      })}
    </>
  );
};

const LONG_PRESS_MS = 350;
const MOVE_TOLERANCE_PX = 5;

interface PointGestureProps {
  map: MapboxMap | null;
  className?: string;
  children: ReactNode;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onTap: () => void;
  onMoveStart: () => void;
  onMove: (lngLat: LngLat) => void;
  onMoveEnd: (lngLat: LngLat) => void;
  onCurveStart: () => void;
  onCurve: (lngLat: LngLat) => void;
  onCurveEnd: () => void;
}

// Gestures on a survey point, like a pen tool: drag right away to move the point;
// press and hold (or Alt + drag) and then drag to pull out a Bezier handle and bend
// the line; tap to select it. Events are stopped here so the map neither pans nor
// adds a point underneath.
const PointGesture = ({ map, className, children, onMouseEnter, onMouseLeave, ...handlers }: PointGestureProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const handlersRef = useRef(handlers);
  useEffect(() => {
    handlersRef.current = handlers;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !map) return;

    const stop = (e: Event) => e.stopPropagation();
    const stopped = ['mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'touchmove', 'touchend', 'contextmenu'];
    stopped.forEach(type => el.addEventListener(type, stop));

    let gesture: { pointerId: number; x: number; y: number; mode: 'pending' | 'move' | 'curve'; timer?: number } | null = null;

    const toLngLat = (e: PointerEvent) => {
      const rect = map.getCanvasContainer().getBoundingClientRect();
      return map.unproject([e.clientX - rect.left, e.clientY - rect.top]);
    };

    const enterCurve = () => {
      if (!gesture) return;
      gesture.mode = 'curve';
      navigator.vibrate?.(15);
      handlersRef.current.onCurveStart();
    };

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || gesture) return;
      e.stopPropagation();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // Some browsers refuse capture for an inactive pointer; the gesture still works
      }
      gesture = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, mode: 'pending' };
      if (e.altKey) enterCurve();
      else gesture.timer = window.setTimeout(() => gesture?.mode === 'pending' && enterCurve(), LONG_PRESS_MS);
    };

    const onMove = (e: PointerEvent) => {
      if (!gesture || e.pointerId !== gesture.pointerId) return;
      if (gesture.mode === 'pending') {
        if (Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) <= MOVE_TOLERANCE_PX) return;
        clearTimeout(gesture.timer);
        gesture.mode = 'move';
        handlersRef.current.onMoveStart();
      }
      if (gesture.mode === 'move') handlersRef.current.onMove(toLngLat(e));
      else handlersRef.current.onCurve(toLngLat(e));
    };

    const onUp = (e: PointerEvent) => {
      if (!gesture || e.pointerId !== gesture.pointerId) return;
      clearTimeout(gesture.timer);
      const { mode } = gesture;
      gesture = null;
      if (mode === 'move') handlersRef.current.onMoveEnd(toLngLat(e));
      else if (mode === 'curve') handlersRef.current.onCurveEnd();
      else if (e.type === 'pointerup') handlersRef.current.onTap();
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      if (gesture) clearTimeout(gesture.timer);
      stopped.forEach(type => el.removeEventListener(type, stop));
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, [map]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ touchAction: 'none' }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>
  );
};
