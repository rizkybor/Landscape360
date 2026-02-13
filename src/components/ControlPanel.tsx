import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMapStore } from "../store/useMapStore";
import { useSurveyStore } from "../store/useSurveyStore";
import { AuthControl } from "./AuthControl";
import mapboxgl from "mapbox-gl";
import type { MapRef } from "react-map-gl/mapbox";
import {
  Activity,
  // Eye,
  Monitor,
  Ruler,
  ChevronDown,
  ChevronUp,
  Search,
  BookOpen,
  // ArrowUp,
  Download,
  Columns,
  Wifi,
  X,
  CloudSun,
  // Plus,
  // Minus,
  // Map as MapIcon,
  // MousePointer2,
  // RotateCw,
  // Settings,
  // Layers,
  // MoreVertical,
} from "lucide-react";
import geoportalLogo from "../assets/geoportal360.png";
import streetsView from "../assets/Street-View.png";
import outdoorsView from "../assets/Outdoors-View.png";
import satelliteView from "../assets/Satellite-View.png";

export const ControlPanel = () => {
  const navigate = useNavigate();
  const {
    // zoom,
    // setZoom,
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
    showGridDMS,
    setShowGridDMS,
    gridOpacity,
    setGridOpacity,
    gridStep,
    setGridStep,
    showSearch,
    setShowSearch,
    showWeather,
    setShowWeather,
    mapStyle,
    setMapStyle,
  } = useMapStore();

  const { isPlotMode, togglePlotMode } = useSurveyStore();
  const [showGetStarted, setShowGetStarted] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  // const joystickRef = useRef<HTMLDivElement>(null);
  const [isJoystickDragging, setIsJoystickDragging] = useState(false);
  const [isOpen, setIsOpen] = useState(true); // Default open but will be manageable on mobile

  // Swipe Down to Close Logic (Mobile)
  const touchStart = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;
    touchStart.current = e.targetTouches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isMobile || touchStart.current === null) return;
    const touchEnd = e.changedTouches[0].clientY;
    const distance = touchEnd - touchStart.current;
    
    // Swipe down threshold > 50px
    if (distance > 50) {
      setIsOpen(false);
    }
    touchStart.current = null;
  };

  const mapStyles = [
    {
      name: "Streets",
      style: "mapbox://styles/mapbox/streets-v12",
      image: streetsView,
      gradient: "from-blue-100/50 to-gray-100/50", // Light/Blueish
      textColor: "text-gray-800",
    },
    {
      name: "Outdoors",
      style: "mapbox://styles/mapbox/outdoors-v12",
      image: outdoorsView,
      gradient: "from-green-100/50 to-emerald-200/50", // Greenish
      textColor: "text-green-900",
    },
    {
      name: "Satellite",
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      image: satelliteView,
      gradient: "from-gray-800/50 to-black/50", // Dark
      textColor: "text-white",
    },
  ];

  // Preload images for offline support
  useEffect(() => {
    mapStyles.forEach((style) => {
      const img = new Image();
      img.src = style.image;
    });
  }, []);

  // Virtual Joystick Logic
  useEffect(() => {
    if (!isJoystickDragging) return;

    const handleMove = (e: MouseEvent) => {
      const sensitivity = 0.2; // Reduced from 0.5 for smoother joystick control
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

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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
        //           alt="Landscape 360"
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
    backdrop-blur-md md:backdrop-blur-xl backdrop-saturate-150

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
            alt="Landscape 360"
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
        bg-black/80 md:bg-black/60 backdrop-blur-md md:backdrop-blur-xl border-t md:border border-white/20 text-white shadow-2xl flex flex-col
        ${!isOpen ? "translate-y-full md:translate-y-0 md:opacity-0 md:pointer-events-none" : "translate-y-0"}
      `}
      >
        {/* Mobile Drag Handle Indicator */}
        <div 
          className="md:hidden w-full flex items-center justify-center pt-3 pb-1 shrink-0 z-30 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1.5 bg-white/20 rounded-full shadow-sm"></div>
        </div>

        {/* Branding Header (Glassmorphism) - FIXED POSITIONING */}
        <div 
          className="relative shrink-0 z-20"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Background Decor - Clipped */}
          <div className="absolute inset-0 rounded-t-2xl md:rounded-t-xl overflow-hidden pointer-events-none border-b border-white/10 bg-white/5 backdrop-blur-sm md:backdrop-blur-md">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 blur-2xl rounded-full -translate-y-1/2 translate-x-1/2"></div>
          </div>

          {/* Content - Visible Overflow for Dropdowns */}
          <div className="relative p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {/* <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Activity size={14} />
                  </div> */}
                <img
                  src={geoportalLogo}
                  alt="360"
                  className="w-12 h-12 object-contain"
                />

                <div>
                  <h2 className="font-bold text-sm tracking-tight leading-none">
                    Landscape 360
                  </h2>
                  <span className="text-[10px] text-blue-300 font-mono tracking-wider">
                    v1.2.0
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

            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setShowGetStarted(true)}
                className="cursor-pointer flex-1 py-1.5 bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 border border-yellow-500/30 rounded text-[10px] font-medium text-yellow-200 hover:bg-yellow-500/20 transition-colors flex items-center justify-center gap-1"
              >
                Quick Guide
              </button>
              <button
                onClick={() => navigate("/docs")}
                className="cursor-pointer flex-1 py-1.5 bg-white/5 border border-white/10 rounded text-[10px] font-medium text-gray-300 hover:bg-white/10 transition-colors flex items-center justify-center gap-1"
              >
                <BookOpen size={10} /> Docs
              </button>
            </div>
            <div className="flex justify-center relative z-50">
              <AuthControl />
            </div>
          </div>
        </div>

        {/* Header / Drag Handle for Mobile - NOW JUST A SUB-HEADER FOR CONTROLS */}
        <div
          className="p-3 flex justify-between items-center border-b border-white/10 cursor-pointer md:cursor-default bg-black/20"
          onClick={() => {
            if (isMobile) setIsOpen(false);
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <h3 className="font-bold flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider">
            <Activity size={14} className="text-blue-400" />
            Terrain Controls
          </h3>
          <button className="cursor-pointer md:hidden p-1 hover:bg-white/10 rounded">
            <ChevronDown size={20} />
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar">
          {/* Weather Toggle */}
          <button
            onClick={() => setShowWeather(!showWeather)}
            className={`cursor-pointer w-full flex items-center justify-center gap-2 py-3 md:py-2 text-xs font-bold rounded transition-colors ${showWeather ? "bg-cyan-600 text-white shadow-lg" : "bg-white/20 hover:bg-white/30 text-cyan-200 border border-cyan-500/30"}`}
          >
            <CloudSun size={14} />
            {showWeather ? "Hide Weather Info" : "Show Weather Info"}
          </button>

          {/* Search Toggle */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`cursor-pointer w-full flex items-center justify-center gap-2 py-3 md:py-2 text-xs font-bold rounded transition-colors ${showSearch ? "bg-blue-500 text-white shadow-lg shadow-blue-500/50" : "bg-white/20 hover:bg-white/30 text-blue-200 border border-blue-500/30"}`}
          >
            <Search size={14} />
            {showSearch ? "Hide Search" : "Search Location"}
          </button>

          {/* Map Style Selector */}
          <div>
            <label className="text-xs text-gray-300 mb-2 block font-semibold border-b border-white/10 pb-1">
              Map Style
            </label>
            <div className="grid grid-cols-3 gap-2">
              {mapStyles.map((style) => (
                <button
                  key={style.name}
                  onClick={() => setMapStyle(style.style)}
                  className={`
                    cursor-pointer relative rounded-lg overflow-hidden h-16 flex flex-col justify-end p-1 transition-all duration-200 group
                    ${mapStyle === style.style ? "ring-2 ring-blue-500 scale-105 shadow-lg" : "opacity-80 hover:opacity-100 hover:scale-105"}
                  `}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${style.gradient} z-10`}
                  ></div>

                  {/* Image Background */}
                  <img
                    src={style.image}
                    alt={style.name}
                    className="absolute inset-0 w-full h-full object-cover z-0 transition-transform duration-500 group-hover:scale-110"
                  />

                  <span
                    className={`relative z-20 text-[9px] font-bold ${style.textColor} text-center w-full leading-tight drop-shadow-md`}
                  >
                    {style.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Surveyor Toggle */}
          <button
            onClick={togglePlotMode}
            className={`cursor-pointer w-full flex items-center justify-center gap-2 py-3 md:py-2 text-xs font-bold rounded transition-colors ${isPlotMode ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/50" : "bg-white/20 hover:bg-white/30 text-yellow-200 border border-yellow-500/30"}`}
          >
            <Ruler size={14} />
            {isPlotMode ? "Exit Navigator Mode" : "Start Navigator Mode"}
          </button>

          {/* Mouse Mode Toggle - Desktop Only */}
          <div className="bg-blue-600/20 p-2 rounded text-[10px] text-blue-100 mb-2 space-y-2 hidden md:block">
            <p className="font-semibold border-b border-blue-500/30 pb-1 mb-1">
              Mouse Interaction Mode
            </p>
            <div className="flex bg-black/20 rounded p-1">
              <button
                onClick={() => setMouseControlMode("map")}
                className={`cursor-pointer flex-1 py-1 rounded transition-colors ${mouseControlMode === "map" ? "bg-blue-500 text-white" : "hover:bg-white/10"}`}
              >
                Map Mode (Move)
              </button>
              <button
                onClick={() => setMouseControlMode("camera")}
                className={`cursor-pointer flex-1 py-1 rounded transition-colors ${mouseControlMode === "camera" ? "bg-blue-500 text-white" : "hover:bg-white/10"}`}
              >
                Camera Mode (Rotate)
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
                  onClick={() => {
                    setActiveView("2D");
                    setPitch(0); // Auto Top View
                    setBearing(0); // Reset Rotation
                  }}
                  className={`flex-1 py-1 text-xs rounded transition-colors cursor-pointer ${activeView === "2D" ? "bg-blue-600 text-white shadow-sm" : "text-gray-400 hover:text-white"}`}
                >
                  2D Topo
                </button>
                <button
                  onClick={() => {
                    setActiveView("3D");
                    setPitch(75); // Auto Side View (Optimized Angle)
                  }}
                  className={`flex-1 py-1 text-xs rounded transition-colors cursor-pointer ${activeView === "3D" ? "bg-blue-600 text-white shadow-sm" : "text-gray-400 hover:text-white"}`}
                >
                  3D Terrain
                </button>
              </div>
            </div>

            <label className="text-xs text-gray-300 block font-semibold border-b border-white/10 pb-1">
              Contours Config
            </label>
            {/* Contour Toggle */}
            <div
              className={`flex items-center justify-between transition-opacity duration-300 ${activeView === "2D" ? "opacity-50 pointer-events-none grayscale" : ""}`}
            >
              <label className="text-xs text-gray-300">Show Contours</label>
              <button
                onClick={() => setShowContours(!showContours)}
                disabled={activeView === "2D"}
                className={`cursor-pointer w-10 h-5 rounded-full p-1 transition-colors ${showContours ? "bg-blue-600" : "bg-white/10"}`}
              >
                <div
                  className={`w-3 h-3 bg-white rounded-full shadow transition-transform ${showContours ? "translate-x-5" : "translate-x-0"}`}
                />
              </button>
            </div>

            {/* Opacity */}
            <div
              className={`transition-opacity duration-300 ${activeView === "2D" || !showContours ? "opacity-50 pointer-events-none grayscale" : ""}`}
            >
              <label className="text-xs text-gray-300 mb-1 flex justify-between">
                <span>Opacity Contours</span>
                <span>{(opacity * 100).toFixed(0)}%</span>
              </label>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round(opacity * 100)}
                onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                disabled={activeView === "2D" || !showContours}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Contour Interval */}
            <div
              className={`
                transition-opacity duration-300
                ${!showContours || activeView === "2D" ? "opacity-50 pointer-events-none grayscale" : "opacity-100"}
              `}
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
                disabled={activeView === "2D"}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between mt-2 gap-1">
                {[12.5, 25, 50, 125].map((val) => (
                  <button
                    key={val}
                    onClick={() => setContourInterval(val)}
                    disabled={activeView === "2D"}
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
            <div
              className={`transition-opacity duration-300 ${activeView === "2D" || !showContours ? "opacity-50 pointer-events-none grayscale" : ""}`}
            >
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
                disabled={activeView === "2D" || !showContours}
                className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            <label className="text-xs text-gray-300 block font-semibold border-b border-white/10 pb-1">
              Grid Config
            </label>
            {/* Grid DMS Toggle */}
            <div className="flex flex-col gap-2 transition-opacity duration-300">
              <div className="flex items-center justify-between">
                <label className="text-xs text-gray-300">Show Grid DMS</label>
                <button
                  onClick={() => setShowGridDMS(!showGridDMS)}
                  className={`cursor-pointer w-10 h-5 rounded-full p-1 transition-colors ${showGridDMS ? "bg-blue-600" : "bg-white/10"}`}
                >
                  <div
                    className={`w-3 h-3 bg-white rounded-full shadow transition-transform ${showGridDMS ? "translate-x-5" : "translate-x-0"}`}
                  />
                </button>
              </div>

              {/* Grid Opacity Slider (Only visible when Grid is ON) */}
              {showGridDMS && (
                <div className="animate-in fade-in slide-in-from-top-2 space-y-3">
                  {/* Opacity */}
                  <div>
                    <label className="text-[10px] text-gray-400 mb-1 flex justify-between">
                      <span>Grid Opacity</span>
                      <span>{(gridOpacity * 100).toFixed(0)}%</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={Math.round(gridOpacity * 100)}
                      onChange={(e) =>
                        setGridOpacity(Number(e.target.value) / 100)
                      }
                      className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>

                  {/* Grid Interval Selection */}
                  <div>
                    <label className="text-[10px] text-gray-400 mb-1 block">
                      Grid Interval
                    </label>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => setGridStep("auto")}
                        className={`cursor-pointer px-2 py-1 text-[10px] rounded border transition-colors col-span-2 ${
                          gridStep === "auto"
                            ? "bg-blue-600 border-blue-500 text-white font-bold"
                            : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                        }`}
                      >
                        Auto (Dynamic)
                      </button>

                      <button
                        onClick={() => setGridStep(15 / 3600)}
                        className={`cursor-pointer px-2 py-1 text-[10px] rounded border transition-colors ${
                          gridStep === 15 / 3600
                            ? "bg-blue-600 border-blue-500 text-white font-bold"
                            : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                        }`}
                        title="~15 Detik (Skala 1:10.000)"
                      >
                        15" (~450m)
                      </button>

                      <button
                        onClick={() => setGridStep(30 / 3600)}
                        className={`cursor-pointer px-2 py-1 text-[10px] rounded border transition-colors ${
                          gridStep === 30 / 3600
                            ? "bg-blue-600 border-blue-500 text-white font-bold"
                            : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                        }`}
                        title="~30 Detik (Skala 1:25.000)"
                      >
                        30" (~900m)
                      </button>

                      <button
                        onClick={() => setGridStep(1 / 60)}
                        className={`cursor-pointer px-2 py-1 text-[10px] rounded border transition-colors ${
                          gridStep === 1 / 60
                            ? "bg-blue-600 border-blue-500 text-white font-bold"
                            : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                        }`}
                        title="~1 Menit (Skala 1:50.000)"
                      >
                        1' (~1.8km)
                      </button>

                      <button
                        onClick={() => setGridStep(5 / 60)}
                        className={`cursor-pointer px-2 py-1 text-[10px] rounded border transition-colors ${
                          Math.abs(Number(gridStep) - 5 / 60) < 0.0000001
                            ? "bg-blue-600 border-blue-500 text-white font-bold"
                            : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10"
                        }`}
                        title="~5 Menit (Skala 1:250.000)"
                      >
                        5' (~9km)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-6 mt-8 border-t border-white/10 text-[10px] text-center text-gray-500 font-mono">
            <div className="uppercase tracking-[0.2em] mb-1 text-[9px] text-gray-600">
              In Collaboration With
            </div>

            <div className="flex flex-col gap-1">
              {/* Kolaborasi 1: JC Digital */}
              <div>
                <a
                  href="https://instagram.com/jendelacakradigital"
                  target="_blank"
                  className="font-bold text-gray-400 hover:text-blue-400 transition-colors uppercase tracking-wider"
                >
                  Jendela Cakra Digital
                </a>
              </div>

              {/* Kolaborasi 2: Makopala */}
              <div className="flex flex-col gap-1">
                <a
                  href="https://instagram.com/makopala_ubl"
                  target="_blank"
                  className="font-bold text-gray-400 hover:text-emerald-400 transition-colors uppercase tracking-wider"
                >
                  Makopala Univ. Budi Luhur
                </a>
              </div>

              <div className="opacity-50">@2026</div>
            </div>
          </div>
        </div>
      </div>

      <GetStartedModal
        isOpen={showGetStarted}
        onClose={() => setShowGetStarted(false)}
      />
    </>
  );
};

export const TelemetryOverlay = ({
  mapRef,
}: {
  mapRef: React.RefObject<MapRef | null>;
}) => {
  const [info, setInfo] = useState<{
    lng: number;
    lat: number;
    elev: number;
    slope: number;
    pitch: number;
    bearing: number;
  } | null>(null);

  const { activeView: mode } = useMapStore();
  const lastUpdate = useRef(0);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const onMouseMove = (evt: mapboxgl.MapMouseEvent) => {
      const now = Date.now();
      // Adaptive throttle: 100ms for 3D, 50ms for 2D
      const throttleLimit = mode === '3D' ? 100 : 50;
      
      if (now - lastUpdate.current < throttleLimit) return;
      lastUpdate.current = now;

      if (rafId.current) cancelAnimationFrame(rafId.current);

      rafId.current = requestAnimationFrame(() => {
          if (!map.isStyleLoaded()) return;
          
          const { lng, lat } = evt.lngLat;
          const terrain = map.getTerrain();
          const exaggeration = (terrain && typeof terrain.exaggeration === 'number') ? terrain.exaggeration : 1;
          
          const rawElevation = map.queryTerrainElevation
            ? map.queryTerrainElevation(evt.lngLat) || 0
            : 0;
          
          const elevation = rawElevation / exaggeration;

          // Simple slope approximation
          const offset = 0.0001;
          const e1Raw = map.queryTerrainElevation
            ? map.queryTerrainElevation(new mapboxgl.LngLat(lng + offset, lat)) || rawElevation
            : rawElevation;
          const e2Raw = map.queryTerrainElevation
            ? map.queryTerrainElevation(new mapboxgl.LngLat(lng, lat + offset)) || rawElevation
            : rawElevation;
            
          const e1 = e1Raw / exaggeration;
          const e2 = e2Raw / exaggeration;

          const dist = 11.132;
          const slope1 = Math.atan((e1 - elevation) / dist);
          const slope2 = Math.atan((e2 - elevation) / dist);
          const slope = Math.max(Math.abs(slope1), Math.abs(slope2)) * (180 / Math.PI);

          setInfo({
            lng,
            lat,
            elev: elevation,
            slope,
            pitch: map.getPitch(),
            bearing: map.getBearing(),
          });
      });
    };

    // Also update on move/rotate to keep pitch/bearing sync if mouse doesn't move but map does
    const onMove = () => {
        // Only update camera props if we already have info (mouse is on map)
        if (rafId.current) cancelAnimationFrame(rafId.current);
        rafId.current = requestAnimationFrame(() => {
            setInfo(prev => prev ? ({
                ...prev,
                pitch: map.getPitch(),
                bearing: map.getBearing()
            }) : null);
        });
    };
    
    // We attach to the map instance directly
    map.on('mousemove', onMouseMove);
    map.on('move', onMove); // Optional: sync bearing/pitch during auto-flight

    return () => {
      map.off('mousemove', onMouseMove);
      map.off('move', onMove);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [mapRef, mode]); // Re-bind if mode changes (for throttle limit)

  if (!info) return null;

  return (
    <div className="fixed bottom-6 right-4 md:absolute md:bottom-8 md:right-8 z-30 md:z-10 bg-black/80 md:bg-white/5 backdrop-blur-md md:backdrop-blur-xl border border-white/10 p-3 md:p-4 rounded-xl text-white text-xs font-mono pointer-events-none shadow-2xl overflow-hidden group max-w-[180px] md:max-w-none">
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
            {info.elev.toFixed(1)} mdpl
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
        Powered by Landscape 360
      </div>
    </div>
  );
};

const GetStartedModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm md:backdrop-blur-md">
      {/* Container Modal */}
      <div className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        {/* Glow Decor */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>

        {/* Header */}
        <div className="p-6 border-b border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <img
              src={geoportalLogo}
              alt="Logo"
              className="w-10 h-10 object-contain"
            />
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Quick Start Guide
              </h2>
              <p className="text-xs text-blue-400 font-mono tracking-widest">
                Initialization
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col h-[calc(80vh-88px-60px)]">
          <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
            {[
              {
                icon: <Monitor size={18} />,
                title: "Interaction Modes",
                desc: "Switch between Map Mode (Left-Click to Pan) and Camera Mode (Left-Click to Rotate). Use the new on-screen Zoom buttons for precise navigation.",
              },
              {
                icon: <Activity size={18} />,
                title: "Terrain Analysis",
                desc: "Toggle contours and adjust exaggeration to visualize elevation details.",
              },
              {
                icon: <Wifi size={18} />,
                title: "Offline Maps",
                desc: "Download map areas for use without internet connection. Perfect for remote field surveys.",
              },
              {
                icon: <Download size={18} />, // Pastikan icon Download sudah di-import dari library Anda (misal: Lucide)
                title: "Export & Capture",
                desc: (
                  <>
                    Capture high-resolution snapshots for reports.
                    <div className="mt-2 grid grid-cols-1 gap-1 text-xs opacity-80">
                      <span>
                        • <strong>PNG:</strong> High-quality for digital
                        presentations.
                      </span>
                      <span>
                        • <strong>JPG:</strong> Compressed for easy sharing.
                      </span>
                      <span>
                        • <strong>PDF:</strong> Document-ready (UI overlays
                        excluded).
                      </span>
                    </div>
                  </>
                ),
              },
              {
                icon: <Columns size={18} />, // Atau gunakan icon Layout/Square
                title: "Split Screen View",
                desc: "Compare two different map layers or perspectives side-by-side. Sync or unsync camera movements to analyze temporal or thematic changes in the terrain.",
              },
              {
                icon: <Ruler size={18} />,
                title: "Survey Tools",
                desc: "Enter Navigator Mode to plot points and measure Azimuth/Back-Azimuth.",
              },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 group">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                  {item.icon}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-200">
                    {item.title}
                  </h4>
                  <div className="text-xs text-gray-400 leading-relaxed">
                    {item.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action Call */}
          <div className="pt-4">
            <button
              onClick={onClose}
              className="cursor-pointer w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-400 hover:text-white transition-all active:scale-[0.98] shadow-lg"
            >
              Let's Go
            </button>
          </div>
        </div>

        {/* Close Button - Added absolute close button for better UX */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 cursor-pointer p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white z-[60]"
          title="Close"
        >
          <X size={20} />
        </button>

        {/* Footer */}
        <div className="p-4 bg-black/40 border-t border-white/5 text-center text-[10px] text-gray-600 font-mono">
          Landscape 360 v1.2.0
        </div>
      </div>
    </div>
  );
};
