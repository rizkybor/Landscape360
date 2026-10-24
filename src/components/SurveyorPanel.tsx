import React, { useState, useRef, useEffect } from "react";
import { useSurveyStore } from "../store/useSurveyStore";
import { ANGLE_STEPS } from "../store/useSurveyStore";
import type { AngleStep, SurveyGroup, SurveyPoint } from "../store/useSurveyStore";
import {
  getAzimuthData,
  formatDegrees,
  formatDistance,
  toDMS,
  toUTM
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
  CornerDownRight,
  Spline,
  Info,
} from "lucide-react";

const LINE_HINT =
  "Drag a point to move it. Press and hold a point, then drag, to bend the line (desktop: Alt + drag). Tap a point to show its curve handles.";

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
    isStraightMode,
    angleStep,
    toggleStraightMode,
    setAngleStep,
    setPointCorner,
    setGroupCorners,
  } = useSurveyStore();

  const [isMinimized, setIsMinimized] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [tempName, setEditName] = useState("");

  const [editingPointId, setEditingPointId] = useState<string | null>(null);
  const [tempPointName, setTempPointName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showLineHint, setShowLineHint] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);
  const prevGroupCount = useRef(groups.length);

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

  // Keep the newest sheet tab visible after creating one
  useEffect(() => {
    if (groups.length > prevGroupCount.current && tabsRef.current) {
      tabsRef.current.scrollTo({ left: tabsRef.current.scrollWidth, behavior: "smooth" });
    }
    prevGroupCount.current = groups.length;
  }, [groups.length]);

  // Shortcut: press N in Navigator Mode to create a new sheet
  useEffect(() => {
    if (!isPlotMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.repeat) return;
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      e.preventDefault();
      createGroup();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlotMode, createGroup]);

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

  // Panel follows the Navigator toggle; plotted lines stay on the map via PlottingLayer
  if (!isPlotMode) return null;

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
            ? "left-2 right-2 bottom-[calc(0.5rem+env(safe-area-inset-bottom))] md:left-auto md:bottom-auto md:top-28 md:right-4 md:w-80"
            : "w-auto md:w-80"
        }
        bg-white/95 md:bg-white/95 backdrop-blur-md border border-gold-200 rounded-2xl md:rounded-xl text-ink shadow-2xl overflow-hidden font-mono
        max-h-[45vh] md:max-h-[75vh] flex flex-col
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
        onClick={(e) => {
          // Mobile bottom sheet: tap the header to collapse or expand it
          if (window.innerWidth >= 768 || (e.target as HTMLElement).closest("button")) return;
          setIsMinimized((v) => !v);
        }}
        className="
          relative bg-gold-50
          px-3 pt-3 pb-2 md:p-3
          flex justify-between items-center
          border-b border-gold-200
          select-none shrink-0
          cursor-default md:cursor-move md:active:cursor-grabbing
        "
      >
        <div className="md:hidden absolute top-1 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-gold-200"></div>
        <h3 className="font-bold text-gold-700 flex items-center gap-2 text-sm min-w-0">
          <GripHorizontal size={12} className="opacity-40 hidden md:block" />
          <span>📐</span>
          <span className="truncate">Navigator Tool</span>
          {activeGroup && (
            <span className="md:hidden text-[10px] font-normal text-sand-600 truncate">
              · {activeGroup.points.length} pts
            </span>
          )}
        </h3>

        <div className="flex gap-1 md:gap-2 items-center">
          {user && (
            <button
              onClick={() => saveCurrentSurvey()}
              disabled={isSyncing}
              className="cursor-pointer text-forest-700 hover:text-forest-700 px-2 py-1.5 md:py-0 flex items-center gap-1 text-xs"
              title="Save Survey"
            >
              {isSyncing ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              <span>Save</span>
            </button>
          )}

          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="cursor-pointer text-sand-600 hover:text-ink text-xs md:text-sm px-2 py-1.5 md:px-1 md:py-0"
          >
            {isMinimized ? "Show" : "Hide"}
          </button>

          <button
            onClick={() => {
              handleClose();
            }}
            className="cursor-pointer text-sand-600 hover:text-ink p-1.5 md:p-1"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="mx-3 my-2 bg-brick-50 border border-brick-200 text-brick-600 text-[10px] p-2 rounded flex justify-between items-center">
          <span>{errorMessage}</span>
          <button
            onClick={clearError}
            className="text-brick-600 hover:text-ink"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {!isMinimized && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Group Tabs/Selector */}
          <div className="bg-sand-50 border-b border-sand-200 p-2 flex items-center gap-2 shrink-0">
           <div ref={tabsRef} className="flex-1 min-w-0 overflow-x-auto flex gap-2 scrollbar-hide">
            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => {
                  setActiveGroup(g.id);
                  setConfirmDeleteId(null);
                }}
                className={`cursor-pointer px-3 py-1.5 md:py-1 rounded-full text-[11px] md:text-[10px] whitespace-nowrap transition-colors flex items-center gap-1 border ${
                  g.id === activeGroupId
                    ? "bg-gold-400 text-ink border-gold-400 font-bold"
                    : "bg-sand-50 text-sand-600 border-sand-200 hover:bg-sand-100"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: g.color }}
                ></span>
                {g.name}
              </button>
            ))}
           </div>
            <button
              onClick={createGroup}
              title="New sheet (N)"
              className="cursor-pointer shrink-0 px-3 py-1.5 md:py-1 rounded-full text-[11px] md:text-[10px] bg-forest-50 text-forest-700 border border-forest-200 hover:bg-forest-100 transition-colors flex items-center gap-1"
            >
              <Plus size={10} /> New
            </button>
          </div>

          {activeGroup ? (
            <div className="p-3 md:p-4 overflow-y-auto custom-scrollbar flex-1 min-h-0 overscroll-contain">
              {/* Active Group Header */}
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-sand-100">
                <div className="flex items-center gap-2 flex-1 mr-2">
                  {editingGroupId === activeGroup.id ? (
                    <div className="flex gap-1 flex-1">
                      <input
                        autoFocus
                        value={tempName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={saveName}
                        onKeyDown={(e) => e.key === "Enter" && saveName()}
                        className="bg-sand-100 border border-gold-300 rounded px-2 py-0.5 text-xs w-full text-ink outline-none"
                      />
                      <button
                        onClick={saveName}
                        className="text-forest-700 p-1 hover:bg-sand-100 rounded cursor-pointer"
                      >
                        <Check size={14} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="text-xs font-bold text-gold-700 truncate">
                        {activeGroup.name}
                      </span>
                      <button
                        onClick={() => startEditing(activeGroup)}
                        className="cursor-pointer text-sand-500 hover:text-ink p-1"
                      >
                        <Edit2 size={10} />
                      </button>
                    </>
                  )}
                </div>
                {confirmDeleteId === activeGroup.id ? (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-brick-600 mr-1">Delete?</span>
                    <button
                      onClick={() => {
                        deleteGroup(activeGroup.id);
                        setConfirmDeleteId(null);
                      }}
                      className="cursor-pointer p-1 bg-brick-50 hover:bg-brick-100 text-brick-600 rounded transition-colors"
                      title="Confirm delete"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="cursor-pointer p-1 hover:bg-sand-100 text-sand-600 rounded transition-colors"
                      title="Cancel"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDeleteId(activeGroup.id)}
                    className="cursor-pointer p-1.5 hover:bg-brick-50 text-brick-600 rounded transition-colors"
                    title="Delete Survey"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {/* Line tools: how new points join, angle snap, all corners, gesture hint */}
              <div className="flex items-center gap-1 mb-4 text-[10px]">
                <div className="flex shrink-0 rounded-lg border border-sand-200 bg-sand-50 p-0.5" role="group" aria-label="New lines">
                  {([
                    { straight: false, label: "Curve", icon: Spline, title: "New points continue the curve" },
                    { straight: true, label: "Straight", icon: CornerDownRight, title: "New points join with a straight line and a sharp corner (desktop: hold Shift for straight + 90°)" },
                  ] as const).map(({ straight, label, icon: Icon, title }) => (
                    <button
                      key={label}
                      onClick={() => isStraightMode !== straight && toggleStraightMode()}
                      aria-pressed={isStraightMode === straight}
                      title={title}
                      className={`cursor-pointer flex items-center gap-1 px-1.5 py-1.5 md:py-1 rounded-md transition-colors ${
                        isStraightMode === straight ? "bg-gold-400 text-ink font-bold shadow-sm" : "text-sand-600 hover:text-ink"
                      }`}
                    >
                      <Icon size={11} /> {label}
                    </button>
                  ))}
                </div>

                {isStraightMode && (
                  <select
                    value={angleStep}
                    onChange={(e) => setAngleStep(Number(e.target.value) as AngleStep)}
                    aria-label="Angle snap"
                    title="Snap the direction of new lines"
                    className="cursor-pointer shrink-0 px-1 py-1.5 md:py-1 rounded-lg border border-sand-200 bg-sand-50 text-sand-700 outline-none focus:border-gold-300"
                  >
                    {ANGLE_STEPS.map((step) => (
                      <option key={step} value={step} className="bg-white">
                        {step === 0 ? "Free" : `${step}°`}
                      </option>
                    ))}
                  </select>
                )}

                <div className="ml-auto flex items-center gap-1 shrink-0">
                  {activeGroup.points.length >= 3 && (
                    <div className="flex rounded-lg border border-sand-200 bg-sand-50 p-0.5" role="group" aria-label="All corners">
                      <button
                        onClick={() => setGroupCorners(activeGroup.id, "smooth")}
                        title="Curve the line through every point"
                        className="cursor-pointer p-1.5 md:p-1 rounded-md text-sand-600 hover:text-ink hover:bg-white transition-colors"
                      >
                        <Spline size={12} />
                      </button>
                      <button
                        onClick={() => setGroupCorners(activeGroup.id, "sharp")}
                        title="Sharp corner at every point"
                        className="cursor-pointer p-1.5 md:p-1 rounded-md text-sand-600 hover:text-ink hover:bg-white transition-colors"
                      >
                        <CornerDownRight size={12} />
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => setShowLineHint((v) => !v)}
                    aria-expanded={showLineHint}
                    title={LINE_HINT}
                    className={`cursor-pointer p-1.5 md:p-1 rounded-full transition-colors ${
                      showLineHint ? "text-gold-700 bg-gold-50" : "text-sand-500 hover:text-ink"
                    }`}
                    aria-label="How to edit the line"
                  >
                    <Info size={13} />
                  </button>
                </div>
              </div>

              {showLineHint && (
                <p className="-mt-2 mb-4 px-2.5 py-2 rounded-lg bg-gold-50 border border-gold-200 text-[10px] text-sand-700 leading-snug">
                  {LINE_HINT}
                </p>
              )}

              {/* Section Header */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-1 h-3 bg-forest-700 rounded"></div>
                <h2 className="font-bold text-xs text-ink uppercase tracking-wider">
                  Survey Data Points
                </h2>
              </div>

              {/* Table Header */}
              <div className="flex bg-sand-100 text-[8px] text-sand-600 p-2 rounded-t border-b border-sand-200 uppercase tracking-wider font-semibold">
                <div className="w-4">#</div>
                <div className="flex-1 pl-2">Point Name</div>
                <div className="w-16 text-right">Coords</div>
              </div>

              {/* Table Body */}
              <div className="bg-white/90 rounded-b min-h-[100px] border border-sand-100 border-t-0 p-1">
                {activeGroup.points.length > 0 ? (
                  <div className="space-y-3">
                    {activeGroup.points.map((p, idx) => (
                      <div
                        key={p.id}
                        className="relative pl-3 border-l-2 border-gold-300 pt-1"
                      >
                        <div className="flex justify-between items-start">
                          <div className="text-[10px] text-sand-500 font-mono w-4 shrink-0">
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
                                className="bg-sand-100 border border-gold-300 rounded px-1 py-0.5 text-[10px] w-full text-ink outline-none"
                              />
                              <button
                                onClick={() =>
                                  savePointName(activeGroup.id, p.id)
                                }
                                className="text-forest-700 p-1 hover:bg-sand-100 rounded cursor-pointer shrink-0"
                              >
                                <Check size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 group/point-name flex-1 min-w-0">
                              <span
                                className={`text-[10px] font-bold uppercase tracking-tighter truncate ${p.name ? "text-forest-700" : "text-gold-700"}`}
                              >
                                {p.name || `Point ${idx + 1}`}
                              </span>
                              <button
                                onClick={() => startEditingPoint(p, idx)}
                                className="text-sand-500 hover:text-ink transition-colors shrink-0"
                              >
                                <Edit2 size={10} />
                              </button>
                            </div>
                          )}

                          <div className="flex gap-1 shrink-0 ml-1">
                            {idx > 0 && idx < activeGroup.points.length - 1 && (
                              <button
                                onClick={() =>
                                  setPointCorner(activeGroup.id, p.id, p.corner === "sharp" ? "smooth" : "sharp")
                                }
                                className={`cursor-pointer p-1.5 md:p-1 rounded transition-colors ${
                                  p.corner === "sharp" ? "text-gold-700 bg-gold-50" : "text-sand-600 hover:bg-sand-100"
                                }`}
                                title={p.corner === "sharp" ? "Sharp corner (tap to curve)" : "Curve (tap for a sharp corner)"}
                                aria-label={p.corner === "sharp" ? "Sharp corner" : "Curved"}
                              >
                                {p.corner === "sharp" ? (
                                  <CornerDownRight size={12} className="md:w-2.5 md:h-2.5" />
                                ) : (
                                  <Spline size={12} className="md:w-2.5 md:h-2.5" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => copyCoords(p)}
                              className="cursor-pointer p-1.5 md:p-1 rounded text-sand-600 hover:bg-sand-100 active:scale-70 transition-all"
                              title="Copy Coordinates"
                            >
                              <Copy size={12} className="md:w-2.5 md:h-2.5" />
                            </button>
                            <button
                              onClick={() => removePoint(activeGroup.id, p.id)}
                              className="cursor-pointer p-1.5 md:p-1 hover:bg-brick-50 text-brick-600 rounded"
                              title="Remove Point"
                            >
                              <X size={12} className="md:w-2.5 md:h-2.5" />
                            </button>
                          </div>
                        </div>
                        <div className="text-[10px] md:text-[9px] text-sand-600 font-mono mt-1 pl-4">
                          {/* <div>
                            {p.lat.toFixed(5)} ({toDMS(p.lat, true)}), {p.lng.toFixed(5)} ({toDMS(p.lng, false)})
                          </div>
                          <div className="text-gold-700">
                            {p.elevation.toFixed(1)} m
                          </div> */}
                          {/* Koordinat Geografis */}
                          <div className="flex justify-between items-start">
                            <span className="text-forest-700 uppercase tracking-wide">
                              DMS
                            </span>
                            <span className="text-forest-700 text-right">
                              {toDMS(p.lat, true)}, {toDMS(p.lng, false)}
                            </span>
                          </div>

                          {/* Koordinat UTM (Decimal) */}
                          <div className="flex justify-between items-start">
                            <span className="text-forest-700 uppercase tracking-wide">
                              UTM
                            </span>
                            <span className="text-forest-700 text-right">
                              {toUTM(p.lat, p.lng)}
                            </span>
                          </div>

                          {/* Koordinat UTM (Decimal) */}
                          <div className="flex justify-between items-start">
                            <span className="text-gold-700 uppercase tracking-wide">
                              DD
                            </span>
                            <span className="text-gold-700 text-right">
                              {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                            </span>
                          </div>

                          {/* Elevation */}
                          <div className="flex justify-between items-center">
                            <span className="text-sand-600 uppercase tracking-wide">
                              Elev
                            </span>
                            <span className="text-sand-600 font-semibold text-right">
                              {p.elevation.toFixed(1)} m
                            </span>
                          </div>
                        </div>

                        {idx < activeGroup.points.length - 1 && (
                          <div className="mt-2 ml-4 bg-sand-50 p-1.5 rounded border border-sand-200 shadow-inner">
                            <DataCard p1={p} p2={activeGroup.points[idx + 1]} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 opacity-60">
                    <div className="w-12 h-12 rounded-full bg-sand-100 flex items-center justify-center mb-3 border border-sand-200">
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
                        className="text-sand-600"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <h4 className="text-ink font-bold text-xs mb-1">
                        No Survey Data Available
                      </h4>
                      <p className="text-[10px] text-sand-500 max-w-[150px] mx-auto leading-tight">
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
                  className="cursor-pointer w-full py-2.5 md:py-2 bg-brick-50 hover:bg-brick-50 text-brick-600 text-xs md:text-[10px] rounded border border-brick-200 transition-colors mt-4"
                >
                  Clear Points
                </button>
              )}
            </div>
          ) : (
            <div className="p-8 text-center">
              <p className="text-xs text-sand-500 mb-4">
                No surveys/markers yet
              </p>
              <button
                onClick={createGroup}
                className="w-full py-2 bg-forest-800 text-white rounded-lg text-xs font-bold shadow-lg "
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
        <div className="text-[8px] uppercase text-sand-500 font-bold">
          Azimuth
        </div>
        <div className="text-gold-700 font-bold">
          {formatDegrees(data.forwardAzimuth)}
        </div>
      </div>
      <div>
        <div className="text-[8px] uppercase text-sand-500 font-bold">
          Back Azimuth
        </div>
        <div className="text-gold-700 font-bold">
          {formatDegrees(data.backAzimuth)}
        </div>
      </div>
      <div>
        <div className="text-[8px] uppercase text-sand-500 font-bold">
          Horiz Dist
        </div>
        <div className="text-forest-700 font-bold">
          {formatDistance(data.horizontalDistance)}
        </div>
      </div>
      <div>
        <div className="text-[8px] uppercase text-sand-500 font-bold">
          Slope
        </div>
        <div
          className={`${Math.abs(data.slope) > 15 ? "text-brick-600" : "text-forest-700"} font-bold`}
        >
          {data.slope.toFixed(1)}%{" "}
          <span className="text-sand-500 font-normal">
            ({data.slopeDegrees.toFixed(1)}°)
          </span>
        </div>
      </div>
    </div>
  );
};
