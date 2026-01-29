import React, { useState, useRef, useEffect } from 'react';
import { useSurveyStore } from '../store/useSurveyStore';
import type { SurveyGroup, SurveyPoint } from '../store/useSurveyStore';
import { getAzimuthData, formatDegrees, formatDistance, toDMS } from '../utils/surveyUtils';
import { Trash2, Copy, X, GripHorizontal, Plus, Edit2, Check } from 'lucide-react';

export const SurveyorPanel = () => {
  const { 
    groups, activeGroupId, isPlotMode, 
    togglePlotMode, createGroup, deleteGroup, 
    setActiveGroup, removePoint, clearPoints,
    updateGroupName 
  } = useSurveyStore();
  
  const [isMinimized, setIsMinimized] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [tempName, setEditName] = useState('');
  
  // Draggable State
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; panelX: number; panelY: number } | null>(null);

  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0];

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition({ x: dragRef.current.panelX + dx, y: dragRef.current.panelY + dy });
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, panelX: position.x, panelY: position.y };
  };

  const startEditing = (g: SurveyGroup) => {
    setEditingGroupId(g.id);
    setEditName(g.name);
  };

  const saveName = () => {
    if (editingGroupId && tempName.trim()) {
      updateGroupName(editingGroupId, tempName.trim());
    }
    setEditingGroupId(null);
  };

  if (groups.length === 0 && !isPlotMode) return null;

  const copyCoords = (p: SurveyPoint) => {
    const text = `Lat: ${p.lat.toFixed(6)} (${toDMS(p.lat, true)})\nLng: ${p.lng.toFixed(6)} (${toDMS(p.lng, false)})\nElev: ${p.elevation.toFixed(1)}m`;
    navigator.clipboard.writeText(text);
  };

  return (
    <div 
      className={`
        fixed z-20 transition-shadow duration-300
        ${position.x === 0 && position.y === 0 ? 'top-28 right-4 left-4 sm:left-auto w-auto sm:w-80' : 'w-80'}
        bg-black/80 backdrop-blur-md border border-yellow-500/30 rounded-xl text-white shadow-2xl overflow-hidden font-mono
      `}
      style={{
        transform: position.x !== 0 || position.y !== 0 ? `translate(${position.x}px, ${position.y}px)` : undefined,
        ...(position.x !== 0 || position.y !== 0 ? { top: '112px', right: '16px' } : {})
      }}
    >
      {/* Header */}
      <div 
        onMouseDown={onMouseDown}
        className="bg-yellow-600/20 p-3 flex justify-between items-center border-b border-yellow-500/20 cursor-move active:cursor-grabbing select-none"
      >
        <h3 className="font-bold text-yellow-400 flex items-center gap-2">
          <GripHorizontal size={14} className="opacity-50" />
          <span>📐</span> Navigator Tool
        </h3>
        <div className="flex gap-2">
            <button onClick={() => setIsMinimized(!isMinimized)} className="text-gray-400 hover:text-white">
                {isMinimized ? 'Show' : 'Hide'}
            </button>
            <button onClick={togglePlotMode} className="text-gray-400 hover:text-white">
                <X size={16} />
            </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex flex-col max-h-[70vh]">
          {/* Group Tabs/Selector */}
          <div className="bg-white/5 border-b border-white/10 p-2 overflow-x-auto flex gap-2 scrollbar-hide">
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => setActiveGroup(g.id)}
                className={`px-3 py-1 rounded-full text-[10px] whitespace-nowrap transition-colors flex items-center gap-1 border ${
                  g.id === activeGroupId 
                    ? 'bg-yellow-500 text-black border-yellow-400 font-bold' 
                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: g.color }}></span>
                {g.name}
              </button>
            ))}
            <button 
              onClick={createGroup}
              className="px-3 py-1 rounded-full text-[10px] bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/40 transition-colors flex items-center gap-1"
            >
              <Plus size={10} /> New
            </button>
          </div>

          {activeGroup ? (
            <div className="p-4 overflow-y-auto custom-scrollbar">
              {/* Active Group Header */}
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-white/5">
                <div className="flex items-center gap-2 flex-1 mr-2">
                  {editingGroupId === activeGroup.id ? (
                    <div className="flex gap-1 flex-1">
                      <input 
                        autoFocus
                        value={tempName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={saveName}
                        onKeyDown={(e) => e.key === 'Enter' && saveName()}
                        className="bg-white/10 border border-yellow-500/50 rounded px-2 py-0.5 text-xs w-full text-white outline-none"
                      />
                      <button onClick={saveName} className="text-green-400 p-1 hover:bg-white/10 rounded">
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-yellow-200 truncate">{activeGroup.name}</span>
                      <button onClick={() => startEditing(activeGroup)} className="text-gray-500 hover:text-white p-1">
                        <Edit2 size={10} />
                      </button>
                    </>
                  )}
                </div>
                <button 
                  onClick={() => deleteGroup(activeGroup.id)}
                  className="p-1.5 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                  title="Delete Survey"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Points List */}
              <div className="space-y-3 mb-4">
                {activeGroup.points.map((p, idx) => (
                  <div key={p.id} className="relative pl-4 border-l-2 border-yellow-500/50">
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] text-yellow-200/70 font-bold uppercase tracking-tighter">Point {idx + 1}</span>
                        <div className="flex gap-1">
                            <button onClick={() => copyCoords(p)} className="p-1 hover:bg-white/10 rounded text-gray-400" title="Copy Coordinates">
                                <Copy size={10} />
                            </button>
                            <button onClick={() => removePoint(activeGroup.id, p.id)} className="p-1 hover:bg-red-500/20 text-red-400/70 rounded" title="Remove Point">
                                <X size={10} />
                            </button>
                        </div>
                    </div>
                    <div className="text-[10px] text-gray-300 grid grid-cols-1 gap-1">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Lat:</span> 
                        <span>{p.lat.toFixed(5)} ({toDMS(p.lat, true)})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Lng:</span> 
                        <span>{p.lng.toFixed(5)} ({toDMS(p.lng, false)})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Elev:</span> 
                        <span>{p.elevation.toFixed(1)}m</span>
                      </div>
                    </div>

                    {idx < activeGroup.points.length - 1 && (
                        <div className="mt-2 bg-white/5 p-2 rounded border border-white/10 shadow-inner">
                            <DataCard p1={p} p2={activeGroup.points[idx+1]} />
                        </div>
                    )}
                  </div>
                ))}
              </div>

              {activeGroup.points.length > 0 ? (
                 <button 
                    onClick={() => clearPoints(activeGroup.id)}
                    className="w-full py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400/80 text-[10px] rounded border border-red-500/20 transition-colors mt-4"
                 >
                    Clear Points
                 </button>
              ) : (
                <div className="text-center text-[10px] text-gray-500 py-8 italic">
                  {isPlotMode ? 'Click on map to add points' : 'Start Plotting to add points'}
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-xs text-gray-500 mb-4">No surveys yet</p>
              <button 
                onClick={createGroup}
                className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-lg shadow-blue-600/30"
              >
                Create First Survey
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const DataCard = ({ p1, p2 }: { p1: SurveyPoint, p2: SurveyPoint }) => {
    const data = getAzimuthData(p1, p2);
    return (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
            <div>
                <div className="text-[8px] uppercase text-gray-500 font-bold">Fwd Azimuth</div>
                <div className="text-yellow-400 font-bold">{formatDegrees(data.forwardAzimuth)}</div>
            </div>
            <div>
                <div className="text-[8px] uppercase text-gray-500 font-bold">Back Azimuth</div>
                <div className="text-yellow-400 font-bold">{formatDegrees(data.backAzimuth)}</div>
            </div>
            <div>
                <div className="text-[8px] uppercase text-gray-500 font-bold">Horiz Dist</div>
                <div className="text-blue-300 font-bold">{formatDistance(data.horizontalDistance)}</div>
            </div>
            <div>
                <div className="text-[8px] uppercase text-gray-500 font-bold">Slope</div>
                <div className={`${Math.abs(data.slope) > 15 ? 'text-red-400' : 'text-green-400'} font-bold`}>
                    {data.slope.toFixed(1)}% <span className="text-gray-500 font-normal">({data.slopeDegrees.toFixed(1)}°)</span>
                </div>
            </div>
        </div>
    );
}
