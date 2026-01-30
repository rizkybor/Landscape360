import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useMapStore } from "../store/useMapStore";
import { useSurveyStore } from "../store/useSurveyStore";
import {
  Activity,
  Eye,
  Monitor,
  Ruler,
  ChevronDown,
  ChevronUp,
  Search,
  BookOpen,
} from "lucide-react";
import geoportalLogo from "../assets/geoportal360.png";

export const ControlPanel = () => {
  const navigate = useNavigate();
  const {
    contourInterval,
    setContourInterval,
    elevationExaggeration,
    setElevationExaggeration,
    opacity,
    setOpacity,
    activeView,
    setActiveView,
    pitch,
    bearing,
    setPitch,
    setBearing,
    mouseControlMode,
    setMouseControlMode,
    showContours,
    setShowContours,
    showSearch,
    setShowSearch,
  } = useMapStore();

  const { isPlotMode, togglePlotMode } = useSurveyStore();

  const joystickRef = useRef<HTMLDivElement>(null);
  const [isJoystickDragging, setIsJoystickDragging] = useState(false);
  const [isOpen, setIsOpen] = useState(true); // Default open but will be manageable on mobile

  // Virtual Joystick Logic
  useEffect(() => {
    if (!isJoystickDragging) return;

    const handleMove = (e: MouseEvent) => {
      const sensitivity = 0.5;
      setBearing(bearing + e.movementX * sensitivity);
      setPitch(Math.min(85, Math.max(0, pitch + e.movementY * sensitivity)));
    };

    const handleUp = () => {
      setIsJoystickDragging(false);
      document.body.style.cursor = "";
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [isJoystickDragging, bearing, pitch, setBearing, setPitch]);

  return (
    <>
      {/* FAB for Mobile/Desktop when closed */}
      {!isOpen && (
        // <button
        //   onClick={() => setIsOpen(true)}
        //   className="fixed top-4 left-6 z-30 p-4 bg-black/60 md:bg-white/5 backdrop-blur-xl text-white rounded-full shadow-2xl border-2 border-white/20 active:scale-95 transition-transform hover:bg-blue-900"
        //   title="Open Controls"
        // >
        //   <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
        //   {/* <Activity size={18} /> */}
        //   <img
        //           src={geoportalLogo}
        //           alt="GeoPortal 360"
        //           className="w-8 h-8 object-contain"
        //         />
        // </button>
        <button
          onClick={() => setIsOpen(true)}
          title="Open Controls"
          className="
    fixed top-4 left-6 z-30
    w-14 h-14
    flex items-center justify-center
    rounded-full

    bg-white/10
    backdrop-blur-xl backdrop-saturate-150

    border border-white/20
    shadow-lg shadow-black/30

    hover:bg-white/20
    hover:shadow-blue-500/30

        cursor-pointer
    active:scale-95
    transition-all duration-300
  "
        >
          {/* glass highlight */}
          <span className="absolute inset-0 rounded-full bg-gradient-to-br from-white/30 via-transparent to-transparent opacity-60 pointer-events-none" />

          {/* logo */}
          <img
            src={geoportalLogo}
            alt="GeoPortal 360"
            className="w-8 h-8 object-contain relative z-10"
          />
        </button>
      )}

      <div
        className={`
        fixed z-50 transition-all duration-300 ease-in-out
        /* Mobile: Bottom Sheet style */
        bottom-0 left-0 right-0 max-h-[70vh] rounded-t-2xl
        /* Desktop: Floating style */
        md:top-4 md:left-4 md:bottom-auto md:right-auto md:w-64 md:rounded-xl
        bg-black/80 backdrop-blur-xl border-t md:border border-white/20 text-white shadow-2xl flex flex-col
        ${!isOpen ? "translate-y-full md:translate-y-0 md:opacity-0 md:pointer-events-none" : "translate-y-0"}
      `}
      >
        {/* Branding Header (Glassmorphism) - FIXED POSITIONING */}
        <div className="p-4 border-b border-white/10 bg-white/5 backdrop-blur-md rounded-t-2xl md:rounded-t-xl relative overflow-hidden shrink-0">
          <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 blur-2xl rounded-full -translate-y-1/2 translate-x-1/2"></div>

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {/* <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Activity size={14} />
                </div> */}
              <img
                src={geoportalLogo}
                alt="GeoPortal 360"
                className="w-12 h-12 object-contain"
              />

              <div>
                <h2 className="font-bold text-sm tracking-tight leading-none">
                  GeoPortal 360
                </h2>
                <span className="text-[10px] text-blue-300 font-mono tracking-wider">
                  v1.0 Pro
                </span>
              </div>
            </div>

            {/* Desktop Close/Minimize Button moved here for better layout */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
              className="cursor-pointer hidden md:block p-1 hover:bg-white/10 rounded text-gray-400"
            >
              <ChevronUp size={16} />
            </button>
          </div>

          <div className="flex gap-2">
            <button className="flex-1 py-1.5 bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 border border-yellow-500/30 rounded text-[10px] font-medium text-yellow-200 hover:bg-yellow-500/20 transition-colors flex items-center justify-center gap-1">
              Get Started
            </button>
            <button
              onClick={() => navigate("/docs")}
              className="cursor-pointer flex-1 py-1.5 bg-white/5 border border-white/10 rounded text-[10px] font-medium text-gray-300 hover:bg-white/10 transition-colors flex items-center justify-center gap-1"
            >
              <BookOpen size={10} /> Docs
            </button>
          </div>
        </div>

        {/* Header / Drag Handle for Mobile - NOW JUST A SUB-HEADER FOR CONTROLS */}
        <div
          className="p-3 flex justify-between items-center border-b border-white/10 cursor-pointer md:cursor-default bg-black/20"
          onClick={() => {
            if (window.innerWidth < 768) setIsOpen(false);
          }}
        >
          <h3 className="font-bold flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider">
            <Activity size={14} className="text-blue-400" />
            Terrain Controls
          </h3>
          <button className="md:hidden p-1 hover:bg-white/10 rounded">
            <ChevronDown size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Search Toggle */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`cursor-pointer w-full flex items-center justify-center gap-2 py-3 md:py-2 text-xs font-bold rounded transition-colors ${showSearch ? "bg-blue-500 text-white shadow-lg shadow-blue-500/50" : "bg-white/20 hover:bg-white/30 text-blue-200 border border-blue-500/30"}`}
          >
            <Search size={14} />
            {showSearch ? "Hide Search" : "Show Search"}
          </button>

          {/* Surveyor Toggle */}
          <button
            onClick={togglePlotMode}
            className={`cursor-pointer w-full flex items-center justify-center gap-2 py-3 md:py-2 text-xs font-bold rounded transition-colors ${isPlotMode ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/50" : "bg-white/20 hover:bg-white/30 text-yellow-200 border border-yellow-500/30"}`}
          >
            <Ruler size={14} />
            {isPlotMode ? "Exit Navigator Mode" : "Start Navigator Mode"}
          </button>

          {/* On-Screen Virtual Joystick */}
          <div
            ref={joystickRef}
            className="bg-black/40 p-3 rounded-lg cursor-move select-none active:bg-blue-600/20 transition-colors border border-white/5"
            onMouseDown={() => {
              setIsJoystickDragging(true);
              document.body.style.cursor = "grabbing";
            }}
          >
            {/* <p className="text-[10px] text-gray-400 mb-2 text-center uppercase tracking-wider font-bold pointer-events-none">
              🖱️ Drag Here to Rotate/Tilt
            </p> */}
            {/* <div className="h-24 rounded bg-white/5 flex items-center justify-center relative overflow-hidden group">
               <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-20 pointer-events-none">
                  <div className="border-r border-b border-white/20"></div>
                  <div className="border-r border-b border-white/20"></div>
                  <div className="border-b border-white/20"></div>
                  <div className="border-r border-b border-white/20"></div>
                  <div className="border-r border-b border-white/20"></div>
                  <div className="border-b border-white/20"></div>
               </div>
               <RotateCw size={32} className="opacity-50 group-hover:opacity-80 transition-opacity" />
               {isJoystickDragging && <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center text-xs font-bold text-blue-200">Active</div>}
            </div> */}

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPitch(0);
                  setBearing(0);
                }}
                className="cursor-pointer flex-1 py-1 text-[10px] bg-white/10 hover:bg-white/20 rounded flex items-center justify-center gap-1"
              >
                <Monitor size={12} /> Reset Top
              </button>
              <button
                onClick={() => {
                  setPitch(80);
                }}
                className="cursor-pointer flex-1 py-1 text-[10px] bg-white/10 hover:bg-white/20 rounded flex items-center justify-center gap-1"
              >
                <Eye size={12} /> Side View
              </button>
            </div>
          </div>

          {/* Mouse Mode Toggle */}
          <div className="bg-blue-600/20 p-2 rounded text-[10px] text-blue-100 mb-2 space-y-2">
            <p className="font-semibold border-b border-blue-500/30 pb-1 mb-1">
              Mouse Interaction Mode
            </p>
            <div className="flex bg-black/20 rounded p-1">
              <button
                onClick={() => setMouseControlMode("camera")}
                className={`cursor-pointer flex-1 py-1 rounded transition-colors ${mouseControlMode === "camera" ? "bg-blue-500 text-white" : "hover:bg-white/10"}`}
              >
                Camera (Left=Rot)
              </button>
              <button
                onClick={() => setMouseControlMode("map")}
                className={`cursor-pointer flex-1 py-1 rounded transition-colors ${mouseControlMode === "map" ? "bg-blue-500 text-white" : "hover:bg-white/10"}`}
              >
                Map (Left=Pan)
              </button>
            </div>
          </div>

          {/* Grid Layout for sliders on Mobile to save space */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-4">
            {/* View Mode */}
            <div>
              <label className="text-xs text-gray-300 mb-1 block">
                View Mode
              </label>
              <div className="flex bg-black/30 rounded p-1">
                <button
                  onClick={() => setActiveView("2D")}
                  className={`flex-1 py-1 text-xs rounded transition-colors cursor-pointer ${activeView === "2D" ? "bg-blue-600 text-white shadow-sm" : "text-gray-400 hover:text-white"}`}
                >
                  2D Topo
                </button>
                <button
                  onClick={() => setActiveView("3D")}
                  className={`flex-1 py-1 text-xs rounded transition-colors cursor-pointer ${activeView === "3D" ? "bg-blue-600 text-white shadow-sm" : "text-gray-400 hover:text-white"}`}
                >
                  3D Terrain
                </button>
              </div>
            </div>

            {/* Contour Toggle */}
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-300">Show Contours</label>
              <button
                onClick={() => setShowContours(!showContours)}
                className={`cursor-pointer w-10 h-5 rounded-full p-1 transition-colors ${showContours ? "bg-blue-600" : "bg-white/10"}`}
              >
                <div
                  className={`w-3 h-3 bg-white rounded-full shadow transition-transform ${showContours ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>

            {/* Contour Interval */}
            <div
              className={
                showContours
                  ? "opacity-100 transition-opacity"
                  : "opacity-50 pointer-events-none transition-opacity"
              }
            >
              <label className="text-xs text-gray-300 mb-1 flex justify-between">
                <span>Contour Interval</span>
                <span>{contourInterval}m</span>
              </label>
              <input
                type="range"
                min="10"
                max="500"
                step="2.5"
                value={contourInterval}
                onChange={(e) => setContourInterval(Number(e.target.value))}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between mt-2 gap-1">
                {[12.5, 25, 50, 100].map((val) => (
                  <button
                    key={val}
                    onClick={() => setContourInterval(val)}
                    className={`cursor-pointer flex-1 text-[10px] py-1 rounded border transition-colors ${
                      contourInterval === val
                        ? "bg-blue-600 border-blue-500 text-white font-bold"
                        : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                    }`}
                  >
                    {val}m
                  </button>
                ))}
              </div>
            </div>

            {/* Elevation Exaggeration */}
            <div>
              <label className="text-xs text-gray-300 mb-1 flex justify-between">
                <span>Exaggeration (Height)</span>
                <span>{elevationExaggeration.toFixed(1)}x</span>
              </label>
              <input
                type="range"
                min="0"
                max="10"
                step="0.1"
                value={elevationExaggeration}
                onChange={(e) =>
                  setElevationExaggeration(Number(e.target.value))
                }
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Opacity */}
            <div>
              <label className="text-xs text-gray-300 mb-1 flex justify-between">
                <span>Opacity</span>
                <span>{(opacity * 100).toFixed(0)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
          </div>

          <div className="pt-4 mt-2 border-t border-white/10 text-[10px] text-center text-gray-500 font-mono">
            <p className="font-bold text-gray-400">
              Makopala Universitas Budi Luhur
            </p>
            <p>Div. Gunung Hutan | MKP.33-532-KRB</p>
          </div>
        </div>
      </div>
    </>
  );
};

export const TelemetryOverlay = ({
  info,
}: {
  info: {
    lng: number;
    lat: number;
    elev: number;
    slope: number;
    pitch: number;
    bearing: number;
  } | null;
}) => {
  if (!info) return null;

  return (
    <div className="fixed bottom-6 right-4 md:absolute md:bottom-8 md:right-8 z-30 md:z-10 bg-black/60 md:bg-white/5 backdrop-blur-xl border border-white/10 p-3 md:p-4 rounded-xl text-white text-xs font-mono pointer-events-none shadow-2xl overflow-hidden group max-w-[180px] md:max-w-none">
      {/* Glass reflection effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 md:gap-y-2 relative z-10">
        <div className="flex justify-between items-center">
          <span className="text-blue-300/70">Lng</span>
          <span className="font-bold">{info.lng.toFixed(5)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-blue-300/70">Lat</span>
          <span className="font-bold">{info.lat.toFixed(5)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-blue-300/70">Elev</span>
          <span className="font-bold text-yellow-300">
            {info.elev.toFixed(1)}m
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-blue-300/70">Slope</span>
          <span className="font-bold">{info.slope.toFixed(1)}°</span>
        </div>

        <div className="md:col-span-2 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent my-1"></div>

        <div className="flex justify-between items-center">
          <span className="text-blue-300/70">Pitch</span>
          <span>{info.pitch.toFixed(1)}°</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-blue-300/70">Bearing</span>
          <span>{info.bearing.toFixed(1)}°</span>
        </div>
      </div>

      <div className="hidden md:block mt-3 pt-2 border-t border-white/5 text-[8px] text-center text-gray-500 uppercase tracking-widest opacity-50 group-hover:opacity-100 transition-opacity">
        Powered by GeoPortal 360
      </div>
    </div>
  );
};
