import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMapStore } from "../store/useMapStore";
import { useSurveyStore } from "../store/useSurveyStore";
import { useTrackerStore } from "../store/useTrackerStore"; // Import Tracker Store
import { useCustomBasemapStore } from "../store/useCustomBasemapStore";
import { AuthControl } from "./AuthControl";
import mapboxgl from "mapbox-gl";
import type { MapRef } from "react-map-gl/mapbox";
import {
  Activity,
  Monitor,
  Ruler,
  ChevronDown,
  ChevronUp,
  Search,
  BookOpen,
  Download,
  Columns,
  Wifi,
  X,
  CloudSun,
  Navigation,
  Lock,
  Binoculars,
  MapPin,
  Layers,
} from "lucide-react";
import geoportalLogo from "../assets/geoportal360.png";
import streetsView from "../assets/Street-View.png";
import outdoorsView from "../assets/Outdoors-View.png";
import satelliteView from "../assets/Satellite-View.png";

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
    showCustomLocations,
    setShowCustomLocations,
    mapStyle,
    setMapStyle,
  } = useMapStore();

  const { isPlotMode, togglePlotMode, user, subscriptionStatus, userRole } =
    useSurveyStore(); // Get userRole
  const {
    isLiveTrackingEnabled,
    toggleLiveTracking,
    setLiveTracking,
    isSimulationEnabled,
    toggleSimulation,
    isLocalBroadcastEnabled,
    toggleLocalBroadcast,
    connectionStatus,
    trackers,
  } = useTrackerStore();

  const { isManagerOpen, toggleManager } = useCustomBasemapStore();

  // Auto-stop tracking/monitoring when user logs out or role changes to incompatible state
  useEffect(() => {
    if (!user) {
      if (isLiveTrackingEnabled) setLiveTracking(false);
      return;
    }

    // If Monitor but not Enterprise -> Stop
    if (
      userRole === "monitor360" &&
      subscriptionStatus !== "Enterprise" &&
      isLiveTrackingEnabled
    ) {
      setLiveTracking(false);
    }

    // If User but Free -> Stop
    if (
      userRole === "pengguna360" &&
      subscriptionStatus === "Free" &&
      isLiveTrackingEnabled
    ) {
      setLiveTracking(false);
    }
  }, [
    user,
    userRole,
    subscriptionStatus,
    isLiveTrackingEnabled,
    setLiveTracking,
  ]);

  const [showGetStarted, setShowGetStarted] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [isJoystickDragging, setIsJoystickDragging] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [isTerrainScrolled, setIsTerrainScrolled] = useState(false);
  const [isTerrainControlsOpen, setIsTerrainControlsOpen] = useState(false);

  // Swipe Down to Close Logic (Mobile)
  const touchStart = useRef<number | null>(null);
  const [touchOffset, setTouchOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  // const toolsScrollRef = useRef<HTMLDivElement | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isMobile) return;

    // Check if the target is a range slider or its container
    const target = e.target as HTMLElement;
    if (
      target.closest('input[type="range"]') ||
      target.closest(".overflow-x-auto")
    )
      return;

    touchStart.current = e.targetTouches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isMobile || touchStart.current === null || !isDragging) return;

    const target = e.target as HTMLElement;
    if (
      target.closest('input[type="range"]') ||
      target.closest(".overflow-x-auto")
    )
      return;

    const currentY = e.targetTouches[0].clientY;
    const diff = currentY - touchStart.current;

    // Only allow dragging downwards (closing) and prevent default scroll if dragging
    if (diff > 0) {
      setTouchOffset(diff);
      // e.preventDefault(); // Don't prevent default blindly to allow scrolling if needed, but here we want to capture the drag
    }
  };

  const handleTouchEnd = () => {
    if (!isMobile || touchStart.current === null) return;

    if (touchOffset > 50) {
      // Reduced threshold for easier closing
      setIsOpen(false);
    }

    setTouchOffset(0);
    setIsDragging(false);
    touchStart.current = null;
  };

  // const handleToolsScroll = useCallback(() => {
  //   // This is used for mobile scroll hint logic (removed for now but kept for future use if needed)
  //   if (!toolsScrollRef.current) return;
  //   if (toolsScrollRef.current.scrollLeft > 12 && showToolsSwipeHint) {
  //     setShowToolsSwipeHint(false);
  //   }
  // }, [showToolsSwipeHint]);

  const mapStyles = [
    {
      name: "Streets",
      style: "mapbox://styles/mapbox/streets-v12",
      image: streetsView,
      gradient: "from-blue-100/50 to-gray-100/50",
      textColor: "text-gray-800",
    },
    {
      name: "Outdoors",
      style: "mapbox://styles/mapbox/outdoors-v12",
      image: outdoorsView,
      gradient: "from-green-100/50 to-emerald-200/50",
      textColor: "text-green-900",
    },
    {
      name: "Satellite",
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      image: satelliteView,
      gradient: "from-gray-800/50 to-black/50",
      textColor: "text-white",
    },
  ];

  // Optimize Image Preloading (Only once)
  useEffect(() => {
    mapStyles.forEach((style) => {
      const img = new Image();
      img.src = style.image;
    });
  }, []);

  // Optimize Event Listeners (Passive)
  useEffect(() => {
    if (!isJoystickDragging) return;

    let rafId: number;

    const handleMove = (e: MouseEvent) => {
      // Throttle joystick updates
      if (rafId) cancelAnimationFrame(rafId);

      rafId = requestAnimationFrame(() => {
        const sensitivity = 0.2;
        setBearing(bearing + e.movementX * sensitivity);
        setPitch(Math.min(85, Math.max(0, pitch + e.movementY * sensitivity)));
      });
    };

    const handleUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
      setIsJoystickDragging(false);
      document.body.style.cursor = "";
    };

    window.addEventListener("mousemove", handleMove, { passive: true });
    window.addEventListener("mouseup", handleUp);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isJoystickDragging, bearing, pitch, setBearing, setPitch]);

  useEffect(() => {
    // Debounce resize
    let timeoutId: NodeJS.Timeout;
    const onResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => setIsMobile(window.innerWidth < 768), 100);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <>
      {!isOpen && (
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
          <span className="absolute inset-0 rounded-full bg-gradient-to-br from-white/30 via-transparent to-transparent opacity-60 pointer-events-none" />
          <img
            src={geoportalLogo}
            alt="Landscape 360"
            className="w-8 h-8 object-contain relative z-10"
          />
        </button>
      )}

      <div
        style={{
          transform:
            isMobile && isOpen && isDragging
              ? `translateY(${touchOffset}px)`
              : isOpen
                ? "translateY(0)"
                : "translateY(100%)",
          transition: isDragging
            ? "none"
            : "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        }}
        className={`
        fixed z-50 
        bottom-0 left-0 right-0 max-h-[90vh] rounded-t-2xl
        md:top-4 md:left-4 md:bottom-auto md:right-auto md:w-64 md:rounded-xl
        bg-black/80 md:bg-black/60 backdrop-blur-md md:backdrop-blur-xl border-t md:border border-white/20 text-white shadow-2xl flex flex-col
        ${!isOpen ? "md:opacity-0 md:pointer-events-none" : ""}
      `}
      >
        <div
          className="md:hidden w-full flex items-center justify-center pt-3 pb-1 shrink-0 z-30 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1.5 bg-white/20 rounded-full shadow-sm"></div>
        </div>

        <div
          className="relative shrink-0 z-20 touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="absolute inset-0 rounded-t-2xl md:rounded-t-xl overflow-hidden pointer-events-none border-b border-white/20 bg-white/5 backdrop-blur-sm md:backdrop-blur-md">
            <div className="absolute top-0 right-0 w-20 h-20 bg-blue-500/10 blur-2xl rounded-full -translate-y-1/2 translate-x-1/2"></div>
          </div>

          <div className="relative p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
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
                    v2.0.0
                  </span>
                </div>
              </div>

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

            <div className="mt-3 border-white/10 p-1">
              <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-2 block">
                Tools & Exploration
              </label>

              {/* Tools Carousel for Mobile, Grid for Desktop */}
              <div
                className={`gap-3 ${isMobile ? "flex overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory scrollbar-hide" : "grid grid-cols-1"}`}
              >
                
                {/* Search Toggle */}
                <button
                  onClick={() => setShowSearch(!showSearch)}
                  className={`${isMobile ? "flex-none w-28 snap-center h-full" : "col-span-1 w-full"} flex items-center rounded-xl border transition-all duration-200 cursor-pointer group ${
                    showSearch
                      ? "bg-blue-900/20 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                      : "bg-white/5 border-white/10 hover:bg-white/10"
                  } ${isMobile ? "flex-col justify-center text-center p-2 h-full gap-1.5" : "flex-row gap-3 p-2.5"}`}
                >
                  <div
                    className={`p-2 rounded-lg transition-colors ${
                      showSearch
                        ? "bg-blue-500 text-white shadow-lg shadow-blue-500/40"
                        : "bg-white/10 text-gray-400 group-hover:text-white"
                    } ${isMobile ? "mb-1" : ""}`}
                  >
                    <Search size={isMobile ? 18 : 16} />
                  </div>

                  <div className="flex-1">
                    <div
                      className={`font-bold transition-colors ${
                        showSearch ? "text-white" : "text-gray-300"
                      } ${isMobile ? "text-[10px] leading-tight" : "text-xs"}`}
                    >
                      Search
                    </div>

                    {!isMobile && (
                      <div
                        className={`text-[10px] ${
                          showSearch ? "text-blue-200" : "text-gray-500"
                        }`}
                      >
                        {showSearch ? "Active" : "Location"}
                      </div>
                    )}
                  </div>
                </button>

                {/* Navigator Mode */}
                <button
                  onClick={togglePlotMode}
                  className={`${isMobile ? "flex-none w-28 snap-center h-full" : "col-span-1 w-full"} flex items-center rounded-xl border transition-all duration-200 cursor-pointer group ${
                    isPlotMode
                      ? "bg-yellow-900/20 border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.1)]"
                      : "bg-white/5 border-white/10 hover:bg-white/10"
                  } ${isMobile ? "flex-col justify-center text-center p-2 h-full gap-1.5" : "flex-row gap-3 p-2.5"}`}
                >
                  <div
                    className={`p-2 rounded-lg transition-colors ${
                      isPlotMode
                        ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/40"
                        : "bg-white/10 text-gray-400 group-hover:text-white"
                    } ${isMobile ? "mb-1" : ""}`}
                  >
                    <Ruler size={isMobile ? 18 : 16} />
                  </div>
                  <div className="flex-1">
                    <div
                      className={`font-bold transition-colors ${isPlotMode ? "text-white" : "text-gray-300"} ${isMobile ? "text-[10px] leading-tight" : "text-xs"}`}
                    >
                      Navigator
                    </div>
                    {!isMobile && (
                      <div
                        className={`text-[10px] ${isPlotMode ? "text-yellow-200" : "text-gray-500"}`}
                      >
                        {isPlotMode ? "Active" : "Tools"}
                      </div>
                    )}
                  </div>
                </button>

                {/* Weather Toggle */}
                <button
                  onClick={() => setShowWeather(!showWeather)}
                  className={`${isMobile ? "flex-none w-28 snap-center h-full" : "col-span-1 w-full"} flex items-center rounded-xl border transition-all duration-200 cursor-pointer group ${
                    showWeather
                      ? "bg-cyan-900/20 border-cyan-500/30 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
                      : "bg-white/5 border-white/10 hover:bg-white/10"
                  } ${isMobile ? "flex-col justify-center text-center p-2 h-full gap-1.5" : "flex-row gap-3 p-2.5"}`}
                >
                  <div
                    className={`p-2 rounded-lg transition-colors ${
                      showWeather
                        ? "bg-cyan-600 text-white shadow-lg shadow-cyan-500/40"
                        : "bg-white/10 text-gray-400 group-hover:text-white"
                    } ${isMobile ? "mb-1" : ""}`}
                  >
                    <CloudSun size={isMobile ? 18 : 16} />
                  </div>
                  <div className="flex-1">
                    <div
                      className={`font-bold transition-colors ${showWeather ? "text-white" : "text-gray-300"} ${isMobile ? "text-[10px] leading-tight" : "text-xs"}`}
                    >
                      Weather
                    </div>
                    {!isMobile && (
                      <div
                        className={`text-[10px] ${showWeather ? "text-cyan-200" : "text-gray-500"}`}
                      >
                        {showWeather ? "Visible" : "Hidden"}
                      </div>
                    )}
                  </div>
                </button>

                {/* Show Locations Toggle */}
                <button
                  onClick={() => setShowCustomLocations(!showCustomLocations)}
                  className={`${isMobile ? "flex-none w-28 snap-center h-full" : "col-span-1 w-full"} flex items-center rounded-xl border transition-all duration-200 cursor-pointer group ${
                    showCustomLocations
                      ? "bg-purple-900/20 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)]"
                      : "bg-white/5 border-white/10 hover:bg-white/10"
                  } ${isMobile ? "flex-col justify-center text-center p-2 h-full gap-1.5" : "flex-row gap-3 p-2.5"}`}
                >
                  <div
                    className={`p-2 rounded-lg transition-colors ${
                      showCustomLocations
                        ? "bg-purple-600 text-white shadow-lg shadow-purple-500/40"
                        : "bg-white/10 text-gray-400 group-hover:text-white"
                    } ${isMobile ? "mb-1" : ""}`}
                  >
                    <MapPin size={isMobile ? 18 : 16} />
                  </div>
                  <div className="flex-1">
                    <div
                      className={`font-bold transition-colors ${showCustomLocations ? "text-white" : "text-gray-300"} ${isMobile ? "text-[10px] leading-tight" : "text-xs"}`}
                    >
                      {isMobile ? "POIs" : "Point of Interest"}
                    </div>
                    {!isMobile && (
                      <div
                        className={`text-[10px] ${showCustomLocations ? "text-purple-200" : "text-gray-500"}`}
                      >
                        {showCustomLocations ? "Visible" : "Hidden"}
                      </div>
                    )}
                  </div>
                </button>

                {/* Custom Basemaps Toggle (Pro/Enterprise Only) */}
                {(subscriptionStatus === "Pro" || subscriptionStatus === "Enterprise") && (
                  <button
                    onClick={toggleManager}
                    className={`${isMobile ? "flex-none w-28 snap-center h-full" : "col-span-1 w-full"} flex items-center rounded-xl border transition-all duration-200 cursor-pointer group ${
                      isManagerOpen
                        ? "bg-indigo-900/20 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                    } ${isMobile ? "flex-col justify-center text-center p-2 h-full gap-1.5" : "flex-row gap-3 p-2.5"}`}
                  >
                    <div
                      className={`p-2 rounded-lg transition-colors ${
                        isManagerOpen
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/40"
                          : "bg-white/10 text-gray-400 group-hover:text-white"
                      } ${isMobile ? "mb-1" : ""}`}
                    >
                      <Layers size={isMobile ? 18 : 16} />
                    </div>
                    <div className="flex-1">
                      <div
                        className={`font-bold transition-colors ${
                          isManagerOpen ? "text-white" : "text-gray-300"
                        } ${isMobile ? "text-[10px] leading-tight" : "text-xs"}`}
                      >
                        Basemaps
                      </div>
                      {!isMobile && (
                        <div
                          className={`text-[10px] ${
                            isManagerOpen ? "text-indigo-200" : "text-gray-500"
                          }`}
                        >
                          {isManagerOpen ? "Managing" : "Custom Layers"}
                        </div>
                      )}
                    </div>
                  </button>
                )}

                {/* Live Tracking Toggle */}
                {import.meta.env.VITE_ENABLE_GPS_TRACKER === "true" && user && (
                  <div
                    className={`${isMobile ? "flex-none w-28 snap-center" : "w-full col-span-1"}`}
                  >
                    {subscriptionStatus === "Free" ? (
                      <button
                        disabled
                        className={`w-full flex items-center ${isMobile ? "flex-col justify-center text-center p-2 h-full gap-1.5" : "flex-row gap-3 p-2.5"} rounded-xl border border-white/5 bg-white/5 opacity-60 cursor-not-allowed group`}
                      >
                        <div
                          className={`p-2 rounded-lg bg-gray-500/10 text-gray-500 ${isMobile ? "mb-1" : ""}`}
                        >
                          <Lock size={isMobile ? 18 : 16} />
                        </div>
                        <div className="flex-1">
                          <div
                            className={`font-bold text-gray-400 ${isMobile ? "text-[10px] leading-tight" : "text-xs"}`}
                          >
                            {isMobile ? "GPS" : "GPS Tracking"}
                          </div>
                          {!isMobile && (
                            <div className="text-[10px] text-gray-600">
                              Upgrade to Pro
                            </div>
                          )}
                        </div>
                      </button>
                    ) : (
                      <div
                        className={`rounded-xl border transition-all duration-300 h-full ${
                          isLiveTrackingEnabled
                            ? userRole === "monitor360" &&
                              subscriptionStatus === "Enterprise"
                              ? "bg-blue-900/20 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                              : "bg-green-900/20 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.15)]"
                            : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                        }`}
                      >
                        <button
                          onClick={toggleLiveTracking}
                          className={`w-full flex items-center cursor-pointer ${isMobile ? "flex-col justify-center text-center p-2 h-full gap-1.5" : "flex-row gap-3 p-2.5"}`}
                        >
                          <div
                            className={`p-2 rounded-lg transition-colors ${
                              isLiveTrackingEnabled
                                ? userRole === "monitor360"
                                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/40"
                                  : "bg-green-500 text-white shadow-lg shadow-green-500/40"
                                : "bg-white/10 text-gray-400 group-hover:text-white"
                            } ${isMobile ? "mb-1" : ""}`}
                          >
                            {userRole === "monitor360" &&
                            subscriptionStatus === "Enterprise" ? (
                              <Binoculars
                                size={isMobile ? 18 : 16}
                                className={
                                  isLiveTrackingEnabled ? "animate-pulse" : ""
                                }
                              />
                            ) : (
                              <Navigation
                                size={isMobile ? 18 : 16}
                                className={
                                  isLiveTrackingEnabled ? "animate-spin" : ""
                                }
                              />
                            )}
                          </div>

                          <div className="flex-1">
                            <div
                              className={`font-bold transition-colors ${isLiveTrackingEnabled ? "text-white" : "text-gray-300"} ${isMobile ? "text-[10px] leading-tight" : "text-xs"}`}
                            >
                              {userRole === "monitor360" &&
                              subscriptionStatus === "Enterprise"
                                ? isMobile
                                  ? "Monitor"
                                  : "Team Monitor"
                                : isMobile
                                  ? "GPS"
                                  : "GPS Tracking"}
                            </div>
                            {!isMobile && (
                              <div
                                className={`text-[10px] flex items-center gap-1.5 ${isLiveTrackingEnabled ? "text-blue-200" : "text-gray-500"}`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${isLiveTrackingEnabled ? "bg-green-400 animate-pulse" : "bg-gray-600"}`}
                                />
                                {isLiveTrackingEnabled ? "Active" : "Inactive"}
                              </div>
                            )}
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Advanced Controls (Simulation/Broadcast) - Moved outside grid for better mobile layout */}
              {isLiveTrackingEnabled && !isMobile && (
                <div className="px-3 pb-3 pt-1 space-y-2 border-t border-white/5 mt-1">
                  {/* Monitor Status */}
                  {userRole === "monitor360" &&
                    subscriptionStatus === "Enterprise" && (
                      <div
                        className={`text-[10px] py-1.5 px-2 rounded-lg flex items-center justify-between ${
                          connectionStatus === "connected"
                            ? "bg-green-500/10 text-green-300"
                            : "bg-red-500/10 text-red-300"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${connectionStatus === "connected" ? "bg-green-400" : "bg-red-400"}`}
                          />
                          {connectionStatus === "connected"
                            ? "Online"
                            : "Offline"}
                        </span>
                        <span>{Object.keys(trackers).length} Users</span>
                      </div>
                    )}

                  {/* Simulation Toggle */}
                  {userRole === "monitor360" && (
                    <div
                      className="flex items-center justify-between group cursor-pointer"
                      onClick={toggleSimulation}
                    >
                      <label className="text-[10px] text-gray-400 cursor-pointer group-hover:text-gray-300">
                        Simulate Data
                      </label>
                      <div
                        className={`w-7 h-3.5 rounded-full p-0.5 transition-colors ${isSimulationEnabled ? "bg-blue-500" : "bg-gray-700"}`}
                      >
                        <div
                          className={`w-2.5 h-2.5 bg-white rounded-full shadow-sm transition-transform ${isSimulationEnabled ? "translate-x-3.5" : ""}`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Broadcast Toggle */}
                  {userRole === "pengguna360" && (
                    <div
                      className="flex items-center justify-between group cursor-pointer"
                      onClick={toggleLocalBroadcast}
                    >
                      <label className="text-[10px] text-gray-400 cursor-pointer group-hover:text-gray-300 flex items-center gap-1.5">
                        Broadcast Location
                        {isLocalBroadcastEnabled && (
                          <Wifi
                            size={10}
                            className="text-green-400 animate-pulse"
                          />
                        )}
                      </label>
                      <div
                        className={`w-7 h-3.5 rounded-full p-0.5 transition-colors ${isLocalBroadcastEnabled ? "bg-green-500" : "bg-gray-700"}`}
                      >
                        <div
                          className={`w-2.5 h-2.5 bg-white rounded-full shadow-sm transition-transform ${isLocalBroadcastEnabled ? "translate-x-3.5" : ""}`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mobile-optimized Advanced Controls Container */}
              {isLiveTrackingEnabled && isMobile && (
                <div className="mt-2 px-3 py-2 rounded-lg border border-white/5 bg-white/5 space-y-2">
                  {/* Monitor Status */}
                  {userRole === "monitor360" &&
                    subscriptionStatus === "Enterprise" && (
                      <div
                        className={`text-[10px] py-1.5 px-2 rounded-lg flex items-center justify-between ${
                          connectionStatus === "connected"
                            ? "bg-green-500/10 text-green-300"
                            : "bg-red-500/10 text-red-300"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${connectionStatus === "connected" ? "bg-green-400" : "bg-red-400"}`}
                          />
                          {connectionStatus === "connected"
                            ? "Online"
                            : "Offline"}
                        </span>
                        <span>{Object.keys(trackers).length} Users</span>
                      </div>
                    )}

                  {/* Simulation Toggle */}
                  {userRole === "monitor360" && (
                    <div
                      className="flex items-center justify-between group cursor-pointer"
                      onClick={toggleSimulation}
                    >
                      <label className="text-[10px] text-gray-400 cursor-pointer group-hover:text-gray-300">
                        Simulate Data
                      </label>
                      <div
                        className={`w-7 h-3.5 rounded-full p-0.5 transition-colors ${isSimulationEnabled ? "bg-blue-500" : "bg-gray-700"}`}
                      >
                        <div
                          className={`w-2.5 h-2.5 bg-white rounded-full shadow-sm transition-transform ${isSimulationEnabled ? "translate-x-3.5" : ""}`}
                        />
                      </div>
                    </div>
                  )}

                  {/* Broadcast Toggle */}
                  {userRole === "pengguna360" && (
                    <div
                      className="flex items-center justify-between group cursor-pointer"
                      onClick={toggleLocalBroadcast}
                    >
                      <label className="text-[10px] text-gray-400 cursor-pointer group-hover:text-gray-300 flex items-center gap-1.5">
                        Broadcast Location
                        {isLocalBroadcastEnabled && (
                          <Wifi
                            size={10}
                            className="text-green-400 animate-pulse"
                          />
                        )}
                      </label>
                      <div
                        className={`w-7 h-3.5 rounded-full p-0.5 transition-colors ${isLocalBroadcastEnabled ? "bg-green-500" : "bg-gray-700"}`}
                      >
                        <div
                          className={`w-2.5 h-2.5 bg-white rounded-full shadow-sm transition-transform ${isLocalBroadcastEnabled ? "translate-x-3.5" : ""}`}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className={`p-3 flex justify-between items-center border-b border-white/30 transition-all duration-300 touch-none cursor-pointer ${
            isTerrainScrolled
              ? "bg-yellow-500 shadow-lg shadow-black/50"
              : "bg-yellow-500/70"
          }`}
          onClick={() => {
            // Toggle terrain controls visibility (Mobile & Desktop)
            setIsTerrainControlsOpen(!isTerrainControlsOpen);
          }}
        >
          <h6 className="font-bold flex items-center gap-1 text-xs text-black-400 tracking-wider">
            <Activity size={12} className="text-black-400" />
            TERRAIN CONTROLS{" "}
            {isTerrainControlsOpen && (
              <small className="opacity-70 font-normal normal-case">
                (Scroll for more)
              </small>
            )}
          </h6>

          {/* Chevron Indicator for Minimize/Expand */}
          <div className="text-black-400 bg-black/10 rounded p-0.5">
            {isTerrainControlsOpen ? (
              isMobile ? <ChevronDown size={16} /> : <ChevronUp size={16} />
            ) : (
              isMobile ? <ChevronUp size={16} /> : <ChevronDown size={16} />
            )}
          </div>
        </div>

        {/* Scrollable Content Container with Collapsible State */}
        <div
          className={`overflow-y-auto custom-scrollbar transition-all duration-300 ease-in-out ${
            !isTerrainControlsOpen
              ? "max-h-0 opacity-0 overflow-hidden"
              : "max-h-[60vh] md:max-h-[50vh] opacity-100 p-4 space-y-4"
          }`}
          onScroll={(e) => {
            const target = e.target as HTMLDivElement;
            setIsTerrainScrolled(target.scrollTop > 10);
          }}
        >
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
                    setPitch(0);
                    setBearing(0);
                  }}
                  className={`flex-1 py-1 text-xs rounded transition-colors cursor-pointer ${activeView === "2D" ? "bg-blue-600 text-white shadow-sm" : "text-gray-400 hover:text-white"}`}
                >
                  2D Topo
                </button>
                <button
                  onClick={() => {
                    setActiveView("3D");
                    setPitch(75);
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
              <div>
                <a
                  href="https://instagram.com/jendelacakradigital"
                  target="_blank"
                  className="font-bold text-gray-400 hover:text-blue-400 transition-colors uppercase tracking-wider"
                >
                  Jendela Cakra Digital
                </a>
              </div>

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
      const throttleLimit = mode === "3D" ? 100 : 50;

      if (now - lastUpdate.current < throttleLimit) return;
      lastUpdate.current = now;

      if (rafId.current) cancelAnimationFrame(rafId.current);

      rafId.current = requestAnimationFrame(() => {
        if (!map.isStyleLoaded()) return;

        const { lng, lat } = evt.lngLat;
        const terrain = map.getTerrain();
        const exaggeration =
          terrain && typeof terrain.exaggeration === "number"
            ? terrain.exaggeration
            : 1;

        const rawElevation = map.queryTerrainElevation
          ? map.queryTerrainElevation(evt.lngLat) || 0
          : 0;

        const elevation = rawElevation / exaggeration;

        const offset = 0.0001;
        const e1Raw = map.queryTerrainElevation
          ? map.queryTerrainElevation(new mapboxgl.LngLat(lng + offset, lat)) ||
            rawElevation
          : rawElevation;
        const e2Raw = map.queryTerrainElevation
          ? map.queryTerrainElevation(new mapboxgl.LngLat(lng, lat + offset)) ||
            rawElevation
          : rawElevation;

        const e1 = e1Raw / exaggeration;
        const e2 = e2Raw / exaggeration;

        const dist = 11.132;
        const slope1 = Math.atan((e1 - elevation) / dist);
        const slope2 = Math.atan((e2 - elevation) / dist);
        const slope =
          Math.max(Math.abs(slope1), Math.abs(slope2)) * (180 / Math.PI);

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

    const onMove = () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        setInfo((prev) =>
          prev
            ? {
                ...prev,
                pitch: map.getPitch(),
                bearing: map.getBearing(),
              }
            : null,
        );
      });
    };

    map.on("mousemove", onMouseMove);
    map.on("move", onMove);

    return () => {
      map.off("mousemove", onMouseMove);
      map.off("move", onMove);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, [mapRef, mode]);

  if (!info) return null;

  return (
    <div className="fixed bottom-6 right-4 md:absolute md:bottom-8 md:right-8 z-30 md:z-10 bg-black/80 md:bg-white/5 backdrop-blur-md md:backdrop-blur-xl border border-white/10 p-3 md:p-4 rounded-xl text-white text-xs font-mono pointer-events-none shadow-2xl overflow-hidden group max-w-[180px] md:max-w-none">
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
      <div className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>

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
                icon: <Download size={18} />,
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
                icon: <Columns size={18} />,
                title: "Split Screen View",
                desc: "Compare two different map layers or perspectives side-by-side. Sync or unsync camera movements to analyze temporal or thematic changes in the terrain.",
              },
              {
                icon: <Ruler size={18} />,
                title: "Survey Tools",
                desc: "Enter Navigator Mode to plot points and measure Azimuth/Back-Azimuth.",
              },
              {
                icon: <Navigation size={18} />,
                title: "GPS Tracking & Monitoring",
                desc: "Click the GPS button to broadcast your location or monitor teams (Enterprise). Features Smart Reconnect for signal loss.",
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

          <div className="pt-4">
            <button
              onClick={onClose}
              className="cursor-pointer w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-400 hover:text-white transition-all active:scale-[0.98] shadow-lg"
            >
              Let's Go
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 cursor-pointer p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white z-[60]"
          title="Close"
        >
          <X size={20} />
        </button>

        <div className="p-4 bg-black/40 border-t border-white/5 text-center text-[10px] text-gray-600 font-mono">
          Landscape 360 v2.0.0
        </div>
      </div>
    </div>
  );
};
