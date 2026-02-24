import React, { useState, useRef, useEffect } from "react";
import { useSurveyStore } from "../store/useSurveyStore";
import type { SurveyGroup, SurveyPoint } from "../store/useSurveyStore";
import {
  getAzimuthData,
  formatDegrees,
  formatDistance,
  toDMS,
} from "../utils/surveyUtils";
import {
  Trash2,
  Copy,
  X,
  GripHorizontal,
  Plus,
  Edit2,
  Check,
  Save,
  Loader2,
} from "lucide-react";

export const SurveyorPanel = () => {
  const {
    groups,
    activeGroupId,
    isPlotMode,
    createGroup,
    deleteGroup,
    setActiveGroup,
    removePoint,
    clearPoints,
    updateGroupName,
    updatePointName,
    setPlotMode,
    saveCurrentSurvey,
    isSyncing,
    user,
    errorMessage,
    clearError,
  } = useSurveyStore();

  const [isMinimized, setIsMinimized] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [tempName, setEditName] = useState("");

  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [tempPointName, setTempPointName] = useState("");

  // Close Handler (Exits Plot Mode)
  const handleClose = () => {
    setPlotMode(false);
  };

  // Draggable State
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    panelX: number;
    panelY: number;
  } | null>(null);

  const activeGroup = groups.find((g) => g.id === activeGroupId) || groups[0];

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPosition({
        x: dragRef.current.panelX + dx,
        y: dragRef.current.panelY + dy,
      });
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

  const onMouseDown = (e: React.MouseEvent) => {
    // Disable drag on mobile
    if (window.innerWidth < 768) return;
    if ((e.target as HTMLElement).closest("button")) return;
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      panelX: position.x,
      panelY: position.y,
    };
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

  const startEditingPoint = (p: SurveyPoint, idx: number) => {
    setEditingPointId(p.id);
    setTempPointName(p.name || `Point ${idx + 1}`);
  };

  const savePointName = (groupId: string, pointId: string) => {
    if (tempPointName.trim()) {
      updatePointName(groupId, pointId, tempPointName.trim());
    }
    setEditingPointId(null);
  };

  if (groups.length === 0 && !isPlotMode) return null;

  const copyCoords = (p: SurveyPoint) => {
    const text = `Lat: ${p.lat.toFixed(6)} (${toDMS(p.lat, true)})\nLng: ${p.lng.toFixed(6)} (${toDMS(p.lng, false)})\nElev: ${p.elevation.toFixed(1)} mdpl`;
    navigator.clipboard.writeText(text);
  };

  return (
    <div
      className={`
        fixed z-[60] transition-all duration-300
        ${
          position.x === 0 && position.y === 0
            ? "bottom-4 right-4 w-[180px] max-w-[85vw] md:bottom-auto md:top-28 md:right-4 md:w-80"
            : "w-auto md:w-80"
        }
        bg-black/90 md:bg-black/80 backdrop-blur-md border border-yellow-500/30 rounded-xl text-white shadow-2xl overflow-hidden font-mono
        max-h-[60vh] md:max-h-[75vh] flex flex-col
      `}
      style={{
        transform:
          window.innerWidth >= 768 && (position.x !== 0 || position.y !== 0)
            ? `translate(${position.x}px, ${position.y}px)`
            : undefined,
        ...(window.innerWidth >= 768 && (position.x !== 0 || position.y !== 0)
          ? { top: "112px", right: "16px" }
          : {}),
      }}
    >
      {/* Header */}
      <div
        onMouseDown={onMouseDown}
        className="
          bg-yellow-600/20
          p-2 md:p-3
          flex justify-between items-center
          border-b border-yellow-500/20
          select-none shrink-0
          cursor-default md:cursor-move md:active:cursor-grabbing
        "
      >
        <h3 className="font-bold text-yellow-400 flex items-center gap-1 md:gap-2 text-xs md:text-sm">
          <GripHorizontal size={12} className="opacity-40 hidden md:block" />
          <span className="hidden md:inline">📐</span>
          <span className="md:hidden">Nav Tool</span>
          <span className="hidden md:inline">Navigator Tool</span>
        </h3>

        <div className="flex gap-1 md:gap-2 items-center">
        

          {user && (
            <button
              onClick={() => saveCurrentSurvey()}
              disabled={isSyncing}
              className="cursor-pointer text-green-400 hover:text-green-300 px-2 flex items-center gap-1 text-[10px] md:text-xs"
              title="Save Survey"
            >
              {isSyncing ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              <span className="hidden md:inline">Save</span>
            </button>
          )}

          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="cursor-pointer text-gray-400 hover:text-white text-[10px] md:text-sm px-1"
          >
            {isMinimized ? "Show" : "Hide"}
          </button>

          <button
            onClick={() => {
              handleClose();
            }}
            className="cursor-pointer text-gray-400 hover:text-white p-1"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mx-3 my-2 bg-red-500/10 border border-red-500/30 text-red-300 text-[10px] p-2 rounded flex justify-between items-center">
          <span>{errorMessage}</span>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-white"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {!isMinimized && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Group Tabs/Selector */}
          <div className="bg-white/5 border-b border-white/10 p-2 overflow-x-auto flex gap-2 scrollbar-hide shrink-0">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setActiveGroup(g.id)}
                className={`cursor-pointer px-3 py-1 rounded-full text-[10px] whitespace-nowrap transition-colors flex items-center gap-1 border ${
                  g.id === activeGroupId
                    ? "bg-yellow-500 text-black border-yellow-400 font-bold"
                    : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: g.color }}
                ></span>
                {g.name}
              </button>
            ))}
            <button
              onClick={createGroup}
              className="cursor-pointer px-3 py-1 rounded-full text-[10px] bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600/40 transition-colors flex items-center gap-1"
            >
              <Plus size={10} /> New
            </button>
          </div>

          {activeGroup ? (
            <div className="p-4 overflow-y-auto custom-scrollbar flex-1 min-h-0">
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
                        onKeyDown={(e) => e.key === "Enter" && saveName()}
                        className="bg-white/10 border border-yellow-500/50 rounded px-2 py-0.5 text-xs w-full text-white outline-none"
                      />
                      <button
                        onClick={saveName}
                        className="text-green-400 p-1 hover:bg-white/10 rounded cursor-pointer"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-yellow-200 truncate">
                        {activeGroup.name}
                      </span>
                      <button
                        onClick={() => startEditing(activeGroup)}
                        className="cursor-pointer text-gray-500 hover:text-white p-1"
                      >
                        <Edit2 size={10} />
                      </button>
                    </>
                  )}
                </div>
                <button
                  onClick={() => deleteGroup(activeGroup.id)}
                  className="cursor-pointer p-1.5 hover:bg-red-500/20 text-red-400 rounded transition-colors"
                  title="Delete Survey"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Section Header */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-3 bg-blue-500 rounded"></div>
                <h2 className="font-bold text-xs text-white uppercase tracking-wider">
                  Survey Data Points
                </h2>
              </div>

              {/* Table Header */}
              <div className="flex bg-gray-800/80 text-[8px] text-gray-400 p-2 rounded-t border-b border-gray-700 uppercase tracking-wider font-semibold">
                <div className="w-4">#</div>
                <div className="flex-1 pl-2">Point Name</div>
                <div className="w-16 text-right">Coords</div>
              </div>

              {/* Table Body */}
              <div className="bg-black/20 rounded-b min-h-[100px] border border-white/5 border-t-0 p-1">
                {activeGroup.points.length > 0 ? (
                  <div className="space-y-3">
                    {activeGroup.points.map((p, idx) => (
                      <div
                        key={p.id}
                        className="relative pl-3 border-l-2 border-yellow-500/50 pt-1"
                      >
                        <div className="flex justify-between items-start">
                          <div className="text-[10px] text-gray-500 font-mono w-4 shrink-0">
                            {idx + 1}
                          </div>
                          {editingPointId === p.id ? (
                            <div className="flex gap-1 flex-1 mr-2 min-w-0">
                              <input
                                autoFocus
                                value={tempPointName}
                                onChange={(e) =>
                                  setTempPointName(e.target.value)
                                }
                                onBlur={() =>
                                  savePointName(activeGroup.id, p.id)
                                }
                                onKeyDown={(e) =>
                                  e.key === "Enter" &&
                                  savePointName(activeGroup.id, p.id)
                                }
                                className="bg-white/10 border border-yellow-500/50 rounded px-1 py-0.5 text-[10px] w-full text-white outline-none"
                              />
                              <button
                                onClick={() =>
                                  savePointName(activeGroup.id, p.id)
                                }
                                className="text-green-400 p-1 hover:bg-white/10 rounded cursor-pointer shrink-0"
                              >
                                <Check size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 group/point-name flex-1 min-w-0">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-tighter truncate ${p.name ? "text-indigo-300" : "text-yellow-200/70"}`}
                              >
                                {p.name || `Point ${idx + 1}`}
                              </span>
                              <button
                                onClick={() => startEditingPoint(p, idx)}
                                className="text-gray-500 hover:text-white transition-colors shrink-0"
                              >
                                <Edit2 size={10} />
                              </button>
                            </div>
                          )}

                          <div className="flex gap-1 shrink-0 ml-1">
                            <button
                              onClick={() => copyCoords(p)}
                              className="cursor-pointer p-1 rounded text-gray-400 hover:bg-white/10 active:scale-70 transition-all"
                              title="Copy Coordinates"
                            >
                              <Copy size={10} />
                            </button>
                            <button
                              onClick={() => removePoint(activeGroup.id, p.id)}
                              className="cursor-pointer p-1 hover:bg-red-500/20 text-red-400/70 rounded"
                              title="Remove Point"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        </div>
                        <div className="text-[9px] text-gray-400 font-mono mt-1 pl-4">
                          <div>
                            {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                          </div>
                          <div className="text-yellow-500/80">
                            {p.elevation.toFixed(1)} m
                          </div>
                        </div>

                        {idx < activeGroup.points.length - 1 && (
                          <div className="mt-2 ml-4 bg-white/5 p-1.5 rounded border border-white/10 shadow-inner">
                            <DataCard
                              p1={p}
                              p2={activeGroup.points[idx + 1]}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 opacity-60">
                    <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-3 border border-gray-700">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-gray-400"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <h4 className="text-white font-bold text-xs mb-1">
                        No Survey Data Available
                      </h4>
                      <p className="text-[10px] text-gray-500 max-w-[150px] mx-auto leading-tight">
                        {isPlotMode
                          ? "Click anywhere on the map to add your first point"
                          : "Start Plotting to begin your survey"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {activeGroup.points.length > 0 && (
                <button
                  onClick={() => clearPoints(activeGroup.id)}
                  className="w-full py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400/80 text-[10px] rounded border border-red-500/20 transition-colors mt-4"
                >
                  Clear Points
                </button>
              )}
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-xs text-gray-500 mb-4">No surveys/markers yet</p>
              <button
                onClick={createGroup}
                className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold shadow-lg shadow-blue-600/30"
              >
                Create First Survey/Markers
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const DataCard = ({ p1, p2 }: { p1: SurveyPoint; p2: SurveyPoint }) => {
  const data = getAzimuthData(p1, p2);
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
      <div>
        <div className="text-[8px] uppercase text-gray-500 font-bold">
          Azimuth
        </div>
        <div className="text-yellow-400 font-bold">
          {formatDegrees(data.forwardAzimuth)}
        </div>
      </div>
      <div>
        <div className="text-[8px] uppercase text-gray-500 font-bold">
          Back Azimuth
        </div>
        <div className="text-yellow-400 font-bold">
          {formatDegrees(data.backAzimuth)}
        </div>
      </div>
      <div>
        <div className="text-[8px] uppercase text-gray-500 font-bold">
          Horiz Dist
        </div>
        <div className="text-blue-300 font-bold">
          {formatDistance(data.horizontalDistance)}
        </div>
      </div>
      <div>
        <div className="text-[8px] uppercase text-gray-500 font-bold">
          Slope
        </div>
        <div
          className={`${Math.abs(data.slope) > 15 ? "text-red-400" : "text-green-400"} font-bold`}
        >
          {data.slope.toFixed(1)}%{" "}
          <span className="text-gray-500 font-normal">
            ({data.slopeDegrees.toFixed(1)}°)
          </span>
        </div>
      </div>
    </div>
  );
};
