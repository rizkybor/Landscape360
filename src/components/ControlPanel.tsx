import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useMapStore } from "../store/useMapStore";
import { useShallow } from "zustand/react/shallow";
import { useSurveyStore } from "../store/useSurveyStore";
import { useTrackerStore } from "../store/useTrackerStore"; // Import Tracker Store
import { useRouteStore } from "../store/useRouteStore";
import { useCustomBasemapStore } from "../store/useCustomBasemapStore";
import { AuthControl } from "./AuthControl";
import { SiteLinks } from "./SitePageLayout";
import { CONTACT_ADMIN_LABEL } from "../config";
import { canRecordTracks, useTrackRecorderStore } from "../store/useTrackRecorderStore";
import { useMarkedLocationStore } from "../store/useMarkedLocationStore";
import mapboxgl from "mapbox-gl";
import type { MapRef } from "react-map-gl/mapbox";
import {
  Activity,
  Monitor,
  Ruler,
  Route,
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
  Play,
  Square,
  Footprints,
  MapPinned,
  UserPlus,
  HardDrive,
} from "lucide-react";
import landscapeLogo from "../assets/LandscapeLogo.svg";
import { toDMS } from "../utils/surveyUtils";
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
    setInteractionMode,
  } = useMapStore(
    useShallow((s) => ({ contourInterval: s.contourInterval, setContourInterval: s.setContourInterval, elevationExaggeration: s.elevationExaggeration, setElevationExaggeration: s.setElevationExaggeration, opacity: s.opacity, setOpacity: s.setOpacity, activeView: s.activeView, setActiveView: s.setActiveView, pitch: s.pitch, bearing: s.bearing, setPitch: s.setPitch, setBearing: s.setBearing, mouseControlMode: s.mouseControlMode, setMouseControlMode: s.setMouseControlMode, showContours: s.showContours, setShowContours: s.setShowContours, showGridDMS: s.showGridDMS, setShowGridDMS: s.setShowGridDMS, gridOpacity: s.gridOpacity, setGridOpacity: s.setGridOpacity, gridStep: s.gridStep, setGridStep: s.setGridStep, showSearch: s.showSearch, setShowSearch: s.setShowSearch, showWeather: s.showWeather, setShowWeather: s.setShowWeather, showCustomLocations: s.showCustomLocations, setShowCustomLocations: s.setShowCustomLocations, mapStyle: s.mapStyle, setMapStyle: s.setMapStyle, setInteractionMode: s.setInteractionMode })),
  );

  const { isPlotMode, togglePlotMode, setPlotMode, user, subscriptionStatus, userRole, isAdmin } =
    useSurveyStore(); // Get userRole
  const isTrackRecorderOpen = useTrackRecorderStore((s) => s.isPanelOpen);
  const isTrackRecording = useTrackRecorderStore((s) => s.activeTrack?.status === "recording");
  const toggleTrackRecorder = useTrackRecorderStore((s) => s.togglePanel);
  const canRecordTrack = canRecordTracks({ hasUser: !!user, subscriptionStatus, isAdmin });
  // Any signed-in account can open it to view own and shared tracks; recording needs canRecordTrack
  const canOpenTrackRecorder = !!user;
  const isMarkedLocationsOpen = useMarkedLocationStore((s) => s.isPanelOpen);
  const markedLocationCount = useMarkedLocationStore((s) => s.locations.length);
  // Both panels use the same spot on screen; the Marked Locations panel closes itself when
  // the Track Recorder opens
  const toggleMarkedLocations = () => {
    if (!isMarkedLocationsOpen) useTrackRecorderStore.getState().setPanelOpen(false);
    useMarkedLocationStore.getState().togglePanel();
  };
  const { isRoutePlannerEnabled, setRoutePlannerEnabled } = useRouteStore();
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
    isActivityRecording,
    activitySessionId,
    activityStartedAt,
    activityEndedAt,
    activityDistanceM,
    activityPointCount,
    startActivity,
    stopActivity,
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
  const [activityNow, setActivityNow] = useState(() => Date.now());
  const [isJoystickDragging, setIsJoystickDragging] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const [isTerrainControlsOpen, setIsTerrainControlsOpen] = useState(false);

  const canRecordActivity =
    Boolean(user) &&
    userRole === "pengguna360" &&
    subscriptionStatus === "Pro";
  const isActivityPendingSave =
    !isActivityRecording && Boolean(activitySessionId && activityEndedAt);

  const formatDuration = (seconds: number) => {
    const s = Math.max(0, Math.floor(seconds));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    if (hh > 0) return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
    return `${mm}:${String(ss).padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!isActivityRecording) return;
    const id = setInterval(() => setActivityNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isActivityRecording]);

  // Mobile: Navigator Mode opens its own bottom sheet, so lower this one out of the way
  // and bring it back when Navigator Mode ends (only if it was open before)
  const reopenAfterNavigator = useRef(false);
  useEffect(() => {
    if (!isMobile) return;
    if (isPlotMode) {
      setIsOpen((open) => {
        reopenAfterNavigator.current = open;
        return false;
      });
    } else if (reopenAfterNavigator.current) {
      reopenAfterNavigator.current = false;
      setIsOpen(true);
    }
  }, [isPlotMode, isMobile]);

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
      gradient: "from-white/40 to-sand-100/40",
      textColor: "text-ink",
    },
    {
      name: "Outdoors",
      style: "mapbox://styles/mapbox/outdoors-v12",
      image: outdoorsView,
      gradient: "from-forest-100/40 to-forest-200/40",
      textColor: "text-forest-900",
    },
    {
      name: "Satellite",
      style: "mapbox://styles/mapbox/satellite-streets-v12",
      image: satelliteView,
      gradient: "from-ink/10 to-ink/60",
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
    bg-sand-100
    backdrop-blur-md md:backdrop-blur-xl backdrop-saturate-150
    border border-sand-300
    shadow-lg shadow-sand-900/10
    hover:bg-sand-200
    
    cursor-pointer
    active:scale-95
    transition-all duration-300
  "
        >
          <span className="absolute inset-0 rounded-full bg-gradient-to-br from-white/30 via-transparent to-transparent opacity-60 pointer-events-none" />
          <img
            src={landscapeLogo}
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
        bg-white/95 md:bg-white/95 backdrop-blur-md md:backdrop-blur-xl border-t md:border border-sand-300 text-ink shadow-2xl flex flex-col
        ${!isOpen ? "md:opacity-0 md:pointer-events-none" : ""}
      `}
      >
        <div
          className="md:hidden w-full flex items-center justify-center pt-3 pb-1 shrink-0 z-30 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-12 h-1.5 bg-sand-200 rounded-full shadow-sm"></div>
        </div>

        <div
          className="relative shrink-0 z-20 touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="absolute inset-0 rounded-t-2xl md:rounded-t-xl overflow-hidden pointer-events-none border-b border-sand-300 bg-sand-50 backdrop-blur-sm md:backdrop-blur-md">
            <div className="absolute top-0 right-0 w-20 h-20 bg-forest-50 blur-2xl rounded-full -translate-y-1/2 translate-x-1/2"></div>
          </div>

          <div className="relative p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <img
                  src={landscapeLogo}
                  alt="360"
                  className="w-12 h-12 object-contain"
                />

                <div>
                  <h2 className="font-bold text-sm tracking-tight leading-none">
                    Landscape 360
                  </h2>
                  <span className="text-[10px] text-forest-700 font-mono tracking-wider">
                    v3.3.0
                  </span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
                className="cursor-pointer hidden md:block p-1 hover:bg-sand-100 rounded text-sand-600"
              >
                <ChevronUp size={16} />
              </button>
            </div>

            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setShowGetStarted(true)}
                className="cursor-pointer flex-1 py-1.5 bg-gold-50 border border-gold-200 rounded text-[10px] font-medium text-gold-700 hover:bg-gold-50 transition-colors flex items-center justify-center gap-1"
              >
                Quick Guide
              </button>
              <button
                onClick={() => navigate("/docs")}
                className="cursor-pointer flex-1 py-1.5 bg-sand-50 border border-sand-200 rounded text-[10px] font-medium text-sand-700 hover:bg-sand-100 transition-colors flex items-center justify-center gap-1"
              >
                <BookOpen size={10} /> Docs
              </button>
            </div>
            <div className="flex justify-center relative z-50">
              <AuthControl />
            </div>

            <div className="mt-3 border-sand-200 p-1">
              <label className="text-[10px] uppercase tracking-widest text-sand-500 font-bold mb-2 block">
                Tools & Exploration
              </label>

              {/* Tools Carousel for Mobile, Grid for Desktop */}
              <ScrollShadowArea
                horizontal={isMobile}
                // On phones the carousel runs edge to edge; the wrapper takes the negative
                // margin so the side shadows sit on the visible edges
                wrapperClassName={isMobile ? "-mx-4" : ""}
                className={`gap-3 ${
                  isMobile
                    ? "flex overflow-x-auto pb-4 px-4 snap-x snap-mandatory scrollbar-hide"
                    : "grid grid-cols-1 max-h-55 overflow-y-auto pr-1"
                }`}
              >
                
                {/* Search Toggle */}
                <button
                  onClick={() => setShowSearch(!showSearch)}
                  className={`${isMobile ? "flex-none w-28 snap-center h-full" : "col-span-1 w-full"} flex items-center rounded-xl border transition-all duration-200 cursor-pointer group ${
                    showSearch
                      ? "bg-forest-50 border-forest-200 "
                      : "bg-sand-50 border-sand-200 hover:bg-sand-100"
                  } ${isMobile ? "flex-col justify-center text-center p-2 h-full gap-1.5" : "flex-row gap-3 p-2.5"}`}
                >
                  <div
                    className={`p-2 rounded-lg transition-colors ${
                      showSearch
                        ? "bg-forest-700 text-white shadow-lg "
                        : "bg-sand-100 text-sand-600 group-hover:text-ink"
                    } ${isMobile ? "mb-1" : ""}`}
                  >
                    <Search size={isMobile ? 18 : 16} />
                  </div>

                  <div className="flex-1">
                    <div
                      className={`font-bold transition-colors ${
                        showSearch ? "text-ink" : "text-sand-700"
                      } ${isMobile ? "text-[10px] leading-tight" : "text-xs"}`}
                    >
                      Search
                    </div>

                    {!isMobile && (
                      <div
                        className={`text-[10px] ${
                          showSearch ? "text-forest-700" : "text-sand-500"
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
                      ? "bg-gold-50 border-gold-200 "
                      : "bg-sand-50 border-sand-200 hover:bg-sand-100"
                  } ${isMobile ? "flex-col justify-center text-center p-2 h-full gap-1.5" : "flex-row gap-3 p-2.5"}`}
                >
                  <div
                    className={`p-2 rounded-lg transition-colors ${
                      isPlotMode
                        ? "bg-gold-400 text-ink shadow-lg "
                        : "bg-sand-100 text-sand-600 group-hover:text-ink"
                    } ${isMobile ? "mb-1" : ""}`}
                  >
                    <Ruler size={isMobile ? 18 : 16} />
                  </div>
                  <div className="flex-1">
                    <div
                      className={`font-bold transition-colors ${isPlotMode ? "text-ink" : "text-sand-700"} ${isMobile ? "text-[10px] leading-tight" : "text-xs"}`}
                    >
                      Navigator
                    </div>
                    {!isMobile && (
                      <div
                        className={`text-[10px] ${isPlotMode ? "text-gold-700" : "text-sand-500"}`}
                      >
                        {isPlotMode ? "Active" : "Tools"}
                      </div>
                    )}
                  </div>
                </button>

                {/* Route Planner */}
                <button
                  onClick={() => {
                    if (!isRoutePlannerEnabled) {
                      if (isPlotMode) setPlotMode(false);
                      setInteractionMode("default");
                      setRoutePlannerEnabled(true);
                      return;
                    }
                    setRoutePlannerEnabled(false);
                  }}
                  className={`${isMobile ? "flex-none w-28 snap-center h-full" : "col-span-1 w-full"} flex items-center rounded-xl border transition-all duration-200 cursor-pointer group ${
                    isRoutePlannerEnabled
                      ? "bg-forest-50 border-forest-200 "
                      : "bg-sand-50 border-sand-200 hover:bg-sand-100"
                  } ${isMobile ? "flex-col justify-center text-center p-2 h-full gap-1.5" : "flex-row gap-3 p-2.5"}`}
                >
                  <div
                    className={`p-2 rounded-lg transition-colors ${
                      isRoutePlannerEnabled
                        ? "bg-forest-700 text-white shadow-lg "
                        : "bg-sand-100 text-sand-600 group-hover:text-ink"
                    } ${isMobile ? "mb-1" : ""}`}
                  >
                    <Route size={isMobile ? 18 : 16} />
                  </div>
                  <div className="flex-1">
                    <div
                      className={`font-bold transition-colors ${
                        isRoutePlannerEnabled ? "text-ink" : "text-sand-700"
                      } ${isMobile ? "text-[10px] leading-tight" : "text-xs"}`}
                    >
                      Route
                    </div>
                    {!isMobile && (
                      <div
                        className={`text-[10px] ${
                          isRoutePlannerEnabled ? "text-forest-700" : "text-sand-500"
                        }`}
                      >
                        {isRoutePlannerEnabled ? "Select 2 Points" : "Directions"}
                      </div>
                    )}
                  </div>
                </button>

                {/* Weather Toggle */}
                <button
                  onClick={() => setShowWeather(!showWeather)}
                  className={`${isMobile ? "flex-none w-28 snap-center h-full" : "col-span-1 w-full"} flex items-center rounded-xl border transition-all duration-200 cursor-pointer group ${
                    showWeather
                      ? "bg-forest-50 border-forest-200 "
                      : "bg-sand-50 border-sand-200 hover:bg-sand-100"
                  } ${isMobile ? "flex-col justify-center text-center p-2 h-full gap-1.5" : "flex-row gap-3 p-2.5"}`}
                >
                  <div
                    className={`p-2 rounded-lg transition-colors ${
                      showWeather
                        ? "bg-forest-800 text-white shadow-lg "
                        : "bg-sand-100 text-sand-600 group-hover:text-ink"
                    } ${isMobile ? "mb-1" : ""}`}
                  >
                    <CloudSun size={isMobile ? 18 : 16} />
                  </div>
                  <div className="flex-1">
                    <div
                      className={`font-bold transition-colors ${showWeather ? "text-ink" : "text-sand-700"} ${isMobile ? "text-[10px] leading-tight" : "text-xs"}`}
                    >
                      Weather
                    </div>
                    {!isMobile && (
                      <div
                        className={`text-[10px] ${showWeather ? "text-forest-700" : "text-sand-500"}`}
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
                      ? "bg-gold-50 border-gold-200 "
                      : "bg-sand-50 border-sand-200 hover:bg-sand-100"
                  } ${isMobile ? "flex-col justify-center text-center p-2 h-full gap-1.5" : "flex-row gap-3 p-2.5"}`}
                >
                  <div
                    className={`p-2 rounded-lg transition-colors ${
                      showCustomLocations
                        ? "bg-gold-500 text-white shadow-lg "
                        : "bg-sand-100 text-sand-600 group-hover:text-ink"
                    } ${isMobile ? "mb-1" : ""}`}
                  >
                    <MapPin size={isMobile ? 18 : 16} />
                  </div>
                  <div className="flex-1">
                    <div
                      className={`font-bold transition-colors ${showCustomLocations ? "text-ink" : "text-sand-700"} ${isMobile ? "text-[10px] leading-tight" : "text-xs"}`}
                    >
                      {isMobile ? "POIs" : "Point of Interest"}
                    </div>
                    {!isMobile && (
                      <div
                        className={`text-[10px] ${showCustomLocations ? "text-gold-700" : "text-sand-500"}`}
                      >
                        {showCustomLocations ? "Visible" : "Hidden"}
                      </div>
                    )}
                  </div>
                </button>

                {/* Track Recorder (record: Enterprise & Admin; view/shared: all signed-in) */}
                <button
                  onClick={canOpenTrackRecorder ? toggleTrackRecorder : undefined}
                  disabled={!canOpenTrackRecorder}
                  className={`${isMobile ? "flex-none w-28 snap-center h-full" : "col-span-1 w-full"} flex items-center rounded-xl border transition-all duration-200 group ${
                    !canOpenTrackRecorder
                      ? "border-sand-100 bg-sand-50 opacity-60 cursor-not-allowed"
                      : isTrackRecorderOpen || isTrackRecording
                        ? "cursor-pointer bg-ember-50 border-ember-200 "
                        : "cursor-pointer bg-sand-50 border-sand-200 hover:bg-sand-100"
                  } ${isMobile ? "flex-col justify-center text-center p-2 h-full gap-1.5" : "flex-row gap-3 p-2.5"}`}
                >
                  <div
                    className={`p-2 rounded-lg transition-colors ${
                      !canOpenTrackRecorder
                        ? "bg-sand-100 text-sand-500"
                        : isTrackRecorderOpen || isTrackRecording
                          ? "bg-ember-500 text-white shadow-lg "
                          : "bg-sand-100 text-sand-600 group-hover:text-ink"
                    } ${isMobile ? "mb-1" : ""}`}
                  >
                    {canOpenTrackRecorder ? (
                      <Footprints size={isMobile ? 18 : 16} />
                    ) : (
                      <Lock size={isMobile ? 18 : 16} />
                    )}
                  </div>
                  <div className="flex-1">
                    <div
                      className={`font-bold transition-colors ${
                        !canOpenTrackRecorder
                          ? "text-sand-600"
                          : isTrackRecorderOpen || isTrackRecording
                            ? "text-ink"
                            : "text-sand-700"
                      } ${isMobile ? "text-[10px] leading-tight" : "text-xs"}`}
                    >
                      {isMobile ? "Track" : "Track Recorder"}
                    </div>
                    {!isMobile && (
                      <div
                        className={`text-[10px] ${
                          !canOpenTrackRecorder
                            ? "text-sand-400"
                            : isTrackRecording
                              ? "text-ember-700"
                              : "text-sand-500"
                        }`}
                      >
                        {!canOpenTrackRecorder
                          ? "Login required"
                          : isTrackRecording
                            ? "Recording"
                            : canRecordTrack
                              ? "Online / Offline"
                              : "View & Shared"}
                      </div>
                    )}
                  </div>
                </button>

                {/* Marked Locations (all signed-in accounts; limits & sharing per plan) */}
                <button
                  onClick={user ? toggleMarkedLocations : undefined}
                  disabled={!user}
                  className={`${isMobile ? "flex-none w-28 snap-center h-full" : "col-span-1 w-full"} flex items-center rounded-xl border transition-all duration-200 group ${
                    !user
                      ? "border-sand-100 bg-sand-50 opacity-60 cursor-not-allowed"
                      : isMarkedLocationsOpen
                        ? "cursor-pointer bg-gold-50 border-gold-200 "
                        : "cursor-pointer bg-sand-50 border-sand-200 hover:bg-sand-100"
                  } ${isMobile ? "flex-col justify-center text-center p-2 h-full gap-1.5" : "flex-row gap-3 p-2.5"}`}
                >
                  <div
                    className={`p-2 rounded-lg transition-colors ${
                      !user
                        ? "bg-sand-100 text-sand-500"
                        : isMarkedLocationsOpen
                          ? "bg-gold-500 text-white shadow-lg "
                          : "bg-sand-100 text-sand-600 group-hover:text-ink"
                    } ${isMobile ? "mb-1" : ""}`}
                  >
                    {user ? <MapPinned size={isMobile ? 18 : 16} /> : <Lock size={isMobile ? 18 : 16} />}
                  </div>
                  <div className="flex-1">
                    <div
                      className={`font-bold transition-colors ${
                        !user ? "text-sand-600" : isMarkedLocationsOpen ? "text-ink" : "text-sand-700"
                      } ${isMobile ? "text-[10px] leading-tight" : "text-xs"}`}
                    >
                      {isMobile ? "Marked" : "Marked Locations"}
                    </div>
                    {!isMobile && (
                      <div className={`text-[10px] ${!user ? "text-sand-400" : "text-sand-500"}`}>
                        {!user ? "Login required" : `${markedLocationCount} saved`}
                      </div>
                    )}
                  </div>
                </button>

                {/* Custom Basemaps Toggle (Enterprise + Monitor360 Only) */}
                {(userRole === "monitor360" && subscriptionStatus === "Enterprise") && (
                  <button
                    onClick={toggleManager}
                    className={`${isMobile ? "flex-none w-28 snap-center h-full" : "col-span-1 w-full"} flex items-center rounded-xl border transition-all duration-200 cursor-pointer group ${
                      isManagerOpen
                        ? "bg-forest-50 border-forest-200 "
                        : "bg-sand-50 border-sand-200 hover:bg-sand-100"
                    } ${isMobile ? "flex-col justify-center text-center p-2 h-full gap-1.5" : "flex-row gap-3 p-2.5"}`}
                  >
                    <div
                      className={`p-2 rounded-lg transition-colors ${
                        isManagerOpen
                          ? "bg-forest-800 text-white shadow-lg "
                          : "bg-sand-100 text-sand-600 group-hover:text-ink"
                      } ${isMobile ? "mb-1" : ""}`}
                    >
                      <Layers size={isMobile ? 18 : 16} />
                    </div>
                    <div className="flex-1">
                      <div
                        className={`font-bold transition-colors ${
                          isManagerOpen ? "text-ink" : "text-sand-700"
                        } ${isMobile ? "text-[10px] leading-tight" : "text-xs"}`}
                      >
                        Basemaps
                      </div>
                      {!isMobile && (
                        <div
                          className={`text-[10px] ${
                            isManagerOpen ? "text-forest-700" : "text-sand-500"
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
                        className={`w-full flex items-center ${isMobile ? "flex-col justify-center text-center p-2 h-full gap-1.5" : "flex-row gap-3 p-2.5"} rounded-xl border border-sand-100 bg-sand-50 opacity-60 cursor-not-allowed group`}
                      >
                        <div
                          className={`p-2 rounded-lg bg-sand-100 text-sand-500 ${isMobile ? "mb-1" : ""}`}
                        >
                          <Lock size={isMobile ? 18 : 16} />
                        </div>
                        <div className="flex-1">
                          <div
                            className={`font-bold text-sand-600 ${isMobile ? "text-[10px] leading-tight" : "text-xs"}`}
                          >
                            {isMobile ? "GPS" : "GPS Tracking"}
                          </div>
                          {!isMobile && (
                            <div className="text-[10px] text-sand-400">
                              {CONTACT_ADMIN_LABEL}
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
                              ? "bg-forest-50 border-forest-200 "
                              : "bg-forest-50 border-forest-200 "
                            : "bg-sand-50 border-sand-200 hover:bg-sand-100 hover:border-sand-300"
                        }`}
                      >
                        <button
                          onClick={toggleLiveTracking}
                          disabled={userRole === "pengguna360" && isActivityRecording}
                          className={`w-full flex items-center cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${isMobile ? "flex-col justify-center text-center p-2 h-full gap-1.5" : "flex-row gap-3 p-2.5"}`}
                        >
                          <div
                            className={`p-2 rounded-lg transition-colors ${
                              isLiveTrackingEnabled
                                ? userRole === "monitor360"
                                  ? "bg-forest-700 text-white shadow-lg "
                                  : "bg-forest-700 text-white shadow-lg "
                                : "bg-sand-100 text-sand-600 group-hover:text-ink"
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
                              className={`font-bold transition-colors ${isLiveTrackingEnabled ? "text-ink" : "text-sand-700"} ${isMobile ? "text-[10px] leading-tight" : "text-xs"}`}
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
                                className={`text-[10px] flex items-center gap-1.5 ${isLiveTrackingEnabled ? "text-forest-700" : "text-sand-500"}`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${isLiveTrackingEnabled ? "bg-forest-500 animate-pulse" : "bg-sand-300"}`}
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
              </ScrollShadowArea>

              {/* Advanced Controls (Simulation/Broadcast) - Moved outside grid for better mobile layout */}
              {isLiveTrackingEnabled && !isMobile && (
                <div className="px-3 pb-3 pt-1 space-y-2 border-t border-sand-100 mt-1">
                  {/* Monitor Status */}
                  {userRole === "monitor360" &&
                    subscriptionStatus === "Enterprise" && (
                      <div
                        className={`text-[10px] py-1.5 px-2 rounded-lg flex items-center justify-between ${
                          connectionStatus === "connected"
                            ? "bg-forest-50 text-forest-700"
                            : "bg-brick-50 text-brick-600"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${connectionStatus === "connected" ? "bg-forest-500" : "bg-brick-500"}`}
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
                      <label className="text-[10px] text-sand-600 cursor-pointer group-hover:text-sand-700">
                        Simulate Data
                      </label>
                      <div
                        className={`w-7 h-3.5 rounded-full p-0.5 transition-colors ${isSimulationEnabled ? "bg-forest-700" : "bg-sand-200"}`}
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
                      <label className="text-[10px] text-sand-600 cursor-pointer group-hover:text-sand-700 flex items-center gap-1.5">
                        Broadcast Location
                        {isLocalBroadcastEnabled && (
                          <Wifi
                            size={10}
                            className="text-forest-700 animate-pulse"
                          />
                        )}
                      </label>
                      <div
                        className={`w-7 h-3.5 rounded-full p-0.5 transition-colors ${isLocalBroadcastEnabled ? "bg-forest-700" : "bg-sand-200"}`}
                      >
                        <div
                          className={`w-2.5 h-2.5 bg-white rounded-full shadow-sm transition-transform ${isLocalBroadcastEnabled ? "translate-x-3.5" : ""}`}
                        />
                      </div>
                    </div>
                  )}

                  {canRecordActivity && (
                    <div className="rounded-lg border border-sand-200 bg-sand-50 p-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-sand-700 font-bold">
                            Record Activity
                          </span>
                          <span
                            className={`text-[10px] ${
                              isActivityRecording
                                ? "text-forest-700"
                                : isActivityPendingSave
                                  ? "text-gold-700"
                                  : "text-sand-500"
                            }`}
                          >
                            {isActivityRecording
                              ? "Recording"
                              : isActivityPendingSave
                                ? "Saving..."
                                : "Ready"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 rounded-md bg-white/90 text-[10px] text-sand-800 font-mono tabular-nums">
                            {activityStartedAt
                              ? formatDuration((activityNow - activityStartedAt) / 1000)
                              : "0:00"}
                          </span>
                          <span className="px-2 py-1 rounded-md bg-white/90 text-[10px] text-sand-700 tabular-nums">
                            {(activityDistanceM / 1000).toFixed(2)} km
                          </span>
                          <span className="px-2 py-1 rounded-md bg-white/90 text-[10px] text-sand-600 tabular-nums">
                            {activityPointCount} pts
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end">
                        {!isActivityRecording ? (
                          <button
                            disabled={isActivityPendingSave}
                            onClick={() => {
                              if (!isLiveTrackingEnabled) setLiveTracking(true);
                              startActivity();
                            }}
                            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-forest-50 text-forest-700 border border-forest-200 hover:bg-forest-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            title="Start Activity"
                          >
                            <Play size={12} />
                            <span className="text-[10px] font-bold">Start</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => stopActivity()}
                            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brick-50 text-brick-600 border border-brick-200 hover:bg-brick-100 transition-colors"
                            title="Stop Activity"
                          >
                            <Square size={12} />
                            <span className="text-[10px] font-bold">Stop</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mobile-optimized Advanced Controls Container */}
              {isLiveTrackingEnabled && isMobile && (
                <div className="mt-2 px-3 py-2 rounded-lg border border-sand-100 bg-sand-50 space-y-2">
                  {/* Monitor Status */}
                  {userRole === "monitor360" &&
                    subscriptionStatus === "Enterprise" && (
                      <div
                        className={`text-[10px] py-1.5 px-2 rounded-lg flex items-center justify-between ${
                          connectionStatus === "connected"
                            ? "bg-forest-50 text-forest-700"
                            : "bg-brick-50 text-brick-600"
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${connectionStatus === "connected" ? "bg-forest-500" : "bg-brick-500"}`}
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
                      <label className="text-[10px] text-sand-600 cursor-pointer group-hover:text-sand-700">
                        Simulate Data
                      </label>
                      <div
                        className={`w-7 h-3.5 rounded-full p-0.5 transition-colors ${isSimulationEnabled ? "bg-forest-700" : "bg-sand-200"}`}
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
                      <label className="text-[10px] text-sand-600 cursor-pointer group-hover:text-sand-700 flex items-center gap-1.5">
                        Broadcast Location
                        {isLocalBroadcastEnabled && (
                          <Wifi
                            size={10}
                            className="text-forest-700 animate-pulse"
                          />
                        )}
                      </label>
                      <div
                        className={`w-7 h-3.5 rounded-full p-0.5 transition-colors ${isLocalBroadcastEnabled ? "bg-forest-700" : "bg-sand-200"}`}
                      >
                        <div
                          className={`w-2.5 h-2.5 bg-white rounded-full shadow-sm transition-transform ${isLocalBroadcastEnabled ? "translate-x-3.5" : ""}`}
                        />
                      </div>
                    </div>
                  )}

                  {canRecordActivity && (
                    <div className="rounded-lg border border-sand-200 bg-sand-50 p-2">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-sand-700 font-bold">
                            Record Activity
                          </span>
                          <span
                            className={`text-[10px] ${
                              isActivityRecording
                                ? "text-forest-700"
                                : isActivityPendingSave
                                  ? "text-gold-700"
                                  : "text-sand-500"
                            }`}
                          >
                            {isActivityRecording
                              ? "Recording"
                              : isActivityPendingSave
                                ? "Saving..."
                                : "Ready"}
                          </span>
                        </div>
                        <span className="px-2 py-1 rounded-md bg-white/90 text-[10px] text-sand-800 font-mono tabular-nums">
                          {activityStartedAt
                            ? formatDuration((activityNow - activityStartedAt) / 1000)
                            : "0:00"}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 rounded-md bg-white/90 text-[10px] text-sand-700 tabular-nums">
                            {(activityDistanceM / 1000).toFixed(2)} km
                          </span>
                          <span className="px-2 py-1 rounded-md bg-white/90 text-[10px] text-sand-600 tabular-nums">
                            {activityPointCount} pts
                          </span>
                        </div>
                        {!isActivityRecording ? (
                          <button
                            disabled={isActivityPendingSave}
                            onClick={() => {
                              if (!isLiveTrackingEnabled) setLiveTracking(true);
                              startActivity();
                            }}
                            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-forest-50 text-forest-700 border border-forest-200 hover:bg-forest-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            title="Start Activity"
                          >
                            <Play size={12} />
                            <span className="text-[10px] font-bold">Start</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => stopActivity()}
                            className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brick-50 text-brick-600 border border-brick-200 hover:bg-brick-100 transition-colors"
                            title="Stop Activity"
                          >
                            <Square size={12} />
                            <span className="text-[10px] font-bold">Stop</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className="p-3 flex justify-between items-center gap-2 border-b border-forest-950 transition-all duration-300 touch-none cursor-pointer bg-forest-900 hover:bg-forest-800"
          onClick={() => {
            // Toggle terrain controls visibility (Mobile & Desktop)
            setIsTerrainControlsOpen(!isTerrainControlsOpen);
          }}
        >
          <h6 className="min-w-0 font-bold flex items-center gap-1.5 text-xs text-gold-300 tracking-wider whitespace-nowrap">
            <Activity size={12} className="text-gold-300 shrink-0" />
            TERRAIN CONTROLS
            {isTerrainControlsOpen && (
              <small className="truncate opacity-70 font-normal normal-case tracking-normal text-[9px]">
                · scroll
              </small>
            )}
          </h6>

          {/* Chevron Indicator for Minimize/Expand */}
          <div className="text-gold-200 bg-white/10 rounded p-0.5">
            {isTerrainControlsOpen ? (
              isMobile ? <ChevronDown size={16} /> : <ChevronUp size={16} />
            ) : (
              isMobile ? <ChevronUp size={16} /> : <ChevronDown size={16} />
            )}
          </div>
        </div>

        {/* Scrollable Content Container with Collapsible State */}
        <ScrollShadowArea
          className={`overflow-y-auto custom-scrollbar transition-all duration-300 ease-in-out ${
            !isTerrainControlsOpen
              ? "max-h-0 opacity-0 overflow-hidden"
              : "max-h-[60vh] md:max-h-[50vh] opacity-100 p-4 space-y-4"
          }`}
        >
          {/* Map Style Selector */}
          <div>
            <label className="text-xs text-sand-700 mb-2 block font-semibold border-b border-sand-200 pb-1">
              Map Style
            </label>
            <div className="grid grid-cols-3 gap-2">
              {mapStyles.map((style) => (
                <button
                  key={style.name}
                  onClick={() => setMapStyle(style.style)}
                  className={`
                    cursor-pointer relative rounded-lg overflow-hidden h-16 flex flex-col justify-end p-1 transition-all duration-200 group
                    ${mapStyle === style.style ? "ring-2 ring-forest-600 scale-105 shadow-lg" : "opacity-80 hover:opacity-100 hover:scale-105"}
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
          <div className="bg-forest-50 p-2 rounded text-[10px] text-forest-700 mb-2 space-y-2 hidden md:block">
            <p className="font-semibold border-b border-forest-200 pb-1 mb-1">
              Mouse Interaction Mode
            </p>
            <div className="flex bg-white/90 rounded p-1">
              <button
                onClick={() => setMouseControlMode("map")}
                className={`cursor-pointer flex-1 py-1 rounded transition-colors ${mouseControlMode === "map" ? "bg-forest-700 text-white" : "hover:bg-sand-100"}`}
              >
                Map Mode (Move)
              </button>
              <button
                onClick={() => setMouseControlMode("camera")}
                className={`cursor-pointer flex-1 py-1 rounded transition-colors ${mouseControlMode === "camera" ? "bg-forest-700 text-white" : "hover:bg-sand-100"}`}
              >
                Camera Mode (Rotate)
              </button>
            </div>
          </div>

          {/* Grid Layout for sliders on Mobile to save space */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-1 gap-4">
            {/* View Mode */}
            <div>
              <label className="text-xs text-sand-700 mb-1 block">
                View Mode
              </label>
              <div className="flex bg-white/90 rounded p-1">
                <button
                  onClick={() => {
                    setActiveView("2D");
                    setPitch(0);
                    setBearing(0);
                  }}
                  className={`flex-1 py-1 text-xs rounded transition-colors cursor-pointer ${activeView === "2D" ? "bg-forest-800 text-white shadow-sm" : "text-sand-600 hover:text-ink"}`}
                >
                  2D Topo
                </button>
                <button
                  onClick={() => {
                    setActiveView("3D");
                    setPitch(75);
                  }}
                  className={`flex-1 py-1 text-xs rounded transition-colors cursor-pointer ${activeView === "3D" ? "bg-forest-800 text-white shadow-sm" : "text-sand-600 hover:text-ink"}`}
                >
                  3D Terrain
                </button>
              </div>
            </div>

            <label className="text-xs text-sand-700 block font-semibold border-b border-sand-200 pb-1">
              Contours Config
            </label>
            {/* Contour Toggle */}
            <div
              className={`flex items-center justify-between transition-opacity duration-300 ${activeView === "2D" ? "opacity-50 pointer-events-none grayscale" : ""}`}
            >
              <label className="text-xs text-sand-700">Show Contours</label>
              <button
                onClick={() => setShowContours(!showContours)}
                disabled={activeView === "2D"}
                className={`cursor-pointer w-10 h-5 rounded-full p-1 transition-colors ${showContours ? "bg-forest-800" : "bg-sand-100"}`}
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
              <label className="text-xs text-sand-700 mb-1 flex justify-between">
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
                className="w-full h-1 bg-sand-300 rounded-lg appearance-none cursor-pointer accent-forest-600"
              />
            </div>

            {/* Contour Interval */}
            <div
              className={`
                transition-opacity duration-300
                ${!showContours || activeView === "2D" ? "opacity-50 pointer-events-none grayscale" : "opacity-100"}
              `}
            >
              <label className="text-xs text-sand-700 mb-1 flex justify-between">
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
                className="w-full h-1 bg-sand-300 rounded-lg appearance-none cursor-pointer accent-forest-600"
              />
              <div className="flex justify-between mt-2 gap-1">
                {[12.5, 25, 50, 125].map((val) => (
                  <button
                    key={val}
                    onClick={() => setContourInterval(val)}
                    disabled={activeView === "2D"}
                    className={`cursor-pointer flex-1 text-[10px] py-1 rounded border transition-colors ${
                      contourInterval === val
                        ? "bg-forest-800 border-forest-600 text-white font-bold"
                        : "bg-sand-50 border-sand-200 text-sand-600 hover:bg-sand-100"
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
              <label className="text-xs text-sand-700 mb-1 flex justify-between">
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
                className="w-full h-1 bg-sand-300 rounded-lg appearance-none cursor-pointer accent-forest-600"
              />
            </div>

            <label className="text-xs text-sand-700 block font-semibold border-b border-sand-200 pb-1">
              Grid Config
            </label>
            {/* Grid DMS Toggle */}
            <div className="flex flex-col gap-2 transition-opacity duration-300">
              <div className="flex items-center justify-between">
                <label className="text-xs text-sand-700">Show Grid DMS</label>
                <button
                  onClick={() => setShowGridDMS(!showGridDMS)}
                  className={`cursor-pointer w-10 h-5 rounded-full p-1 transition-colors ${showGridDMS ? "bg-forest-800" : "bg-sand-100"}`}
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
                    <label className="text-[10px] text-sand-600 mb-1 flex justify-between">
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
                      className="w-full h-1 bg-sand-300 rounded-lg appearance-none cursor-pointer accent-forest-600"
                    />
                  </div>

                  {/* Grid Interval Selection */}
                  <div>
                    <label className="text-[10px] text-sand-600 mb-1 block">
                      Grid Interval
                    </label>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => setGridStep("auto")}
                        className={`cursor-pointer px-2 py-1 text-[10px] rounded border transition-colors col-span-2 ${
                          gridStep === "auto"
                            ? "bg-forest-800 border-forest-600 text-white font-bold"
                            : "bg-sand-50 border-sand-200 text-sand-600 hover:bg-sand-100"
                        }`}
                      >
                        Auto (Dynamic)
                      </button>

                      <button
                        onClick={() => setGridStep(15 / 3600)}
                        className={`cursor-pointer px-2 py-1 text-[10px] rounded border transition-colors ${
                          gridStep === 15 / 3600
                            ? "bg-forest-800 border-forest-600 text-white font-bold"
                            : "bg-sand-50 border-sand-200 text-sand-600 hover:bg-sand-100"
                        }`}
                        title="~15 Detik (Skala 1:10.000)"
                      >
                        15" (~450m)
                      </button>

                      <button
                        onClick={() => setGridStep(30 / 3600)}
                        className={`cursor-pointer px-2 py-1 text-[10px] rounded border transition-colors ${
                          gridStep === 30 / 3600
                            ? "bg-forest-800 border-forest-600 text-white font-bold"
                            : "bg-sand-50 border-sand-200 text-sand-600 hover:bg-sand-100"
                        }`}
                        title="~30 Detik (Skala 1:25.000)"
                      >
                        30" (~900m)
                      </button>

                      <button
                        onClick={() => setGridStep(1 / 60)}
                        className={`cursor-pointer px-2 py-1 text-[10px] rounded border transition-colors ${
                          gridStep === 1 / 60
                            ? "bg-forest-800 border-forest-600 text-white font-bold"
                            : "bg-sand-50 border-sand-200 text-sand-600 hover:bg-sand-100"
                        }`}
                        title="~1 Menit (Skala 1:50.000)"
                      >
                        1' (~1.8km)
                      </button>

                      <button
                        onClick={() => setGridStep(5 / 60)}
                        className={`cursor-pointer px-2 py-1 text-[10px] rounded border transition-colors ${
                          Math.abs(Number(gridStep) - 5 / 60) < 0.0000001
                            ? "bg-forest-800 border-forest-600 text-white font-bold"
                            : "bg-sand-50 border-sand-200 text-sand-600 hover:bg-sand-100"
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

          <div className="pt-6 mt-8 border-t border-sand-200 text-[10px] text-center text-sand-500 font-mono">
            <div className="uppercase tracking-[0.2em] mb-1 text-[9px] text-sand-400">
              In Collaboration With
            </div>

            <div className="flex flex-col gap-1">
              <div>
                <a
                  href="https://instagram.com/jendelacakradigital"
                  target="_blank"
                  className="font-bold text-sand-600 hover:text-forest-700 transition-colors uppercase tracking-wider"
                >
                  Jendela Cakra Digital
                </a>
              </div>

              <div className="flex flex-col gap-1">
                <a
                  href="https://instagram.com/makopala_ubl"
                  target="_blank"
                  className="font-bold text-sand-600 hover:text-forest-700 transition-colors uppercase tracking-wider"
                >
                  Makopala Univ. Budi Luhur
                </a>
              </div>

              <div className="opacity-50">@2026</div>
            </div>

            <SiteLinks compact omit={["/docs"]} className="mt-3 font-sans" />
          </div>
        </ScrollShadowArea>
      </div>

      <GetStartedModal
        isOpen={showGetStarted}
        onClose={() => setShowGetStarted(false)}
      />
    </>
  );
};

// Scroll container with a soft shadow at each edge that still has content to scroll to,
// so the edge of the scroll area is visible. `horizontal` watches left/right instead of
// top/bottom (e.g. the tools carousel on phones).
const ScrollShadowArea = ({
  className,
  wrapperClassName = "",
  horizontal = false,
  children,
}: {
  className: string;
  wrapperClassName?: string;
  horizontal?: boolean;
  children: ReactNode;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const [pos, size, total] = horizontal
      ? [el.scrollLeft, el.clientWidth, el.scrollWidth]
      : [el.scrollTop, el.clientHeight, el.scrollHeight];
    const start = pos > 2;
    const end = pos + size < total - 2;
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, [horizontal]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    if (typeof ResizeObserver === "undefined") return;
    // Re-check when the area or its content changes size (opening, collapsing, new items)
    const observer = new ResizeObserver(update);
    observer.observe(el);
    Array.from(el.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [update, children]);

  const shadow = `pointer-events-none absolute z-10 transition-opacity duration-200 ${horizontal ? "inset-y-0 w-4" : "inset-x-0 h-3"}`;
  const [startEdge, endEdge] = horizontal
    ? ["left-0 bg-gradient-to-r", "right-0 bg-gradient-to-l"]
    : ["top-0 bg-gradient-to-b", "bottom-0 bg-gradient-to-t"];
  // The wrapper can shrink inside the panel's flex column (min-h-0), like the scroll area
  // itself did before it was wrapped; otherwise its content spills out of the panel
  return (
    <div className={`relative flex flex-col min-h-0 ${wrapperClassName}`}>
      <div ref={ref} className={`min-h-0 ${className}`} onScroll={update}>
        {children}
      </div>
      <div aria-hidden className={`${shadow} ${startEdge} from-ink/15 to-transparent ${edges.start ? "opacity-100" : "opacity-0"}`} />
      <div aria-hidden className={`${shadow} ${endEdge} from-ink/15 to-transparent ${edges.end ? "opacity-100" : "opacity-0"}`} />
    </div>
  );
};

const COORD_FORMAT_KEY = "l360-telemetry-coord-format";

export const TelemetryOverlay = ({
  mapRef,
}: {
  mapRef: React.RefObject<MapRef | null>;
}) => {
  // Decimal degrees or degrees-minutes-seconds, remembered per browser
  const [coordFormat, setCoordFormat] = useState<"dd" | "dms">(() => {
    try {
      return localStorage.getItem(COORD_FORMAT_KEY) === "dms" ? "dms" : "dd";
    } catch {
      return "dd";
    }
  });
  const changeCoordFormat = (format: "dd" | "dms") => {
    setCoordFormat(format);
    try {
      localStorage.setItem(COORD_FORMAT_KEY, format);
    } catch {
      // Storage blocked: the choice lasts for this visit only
    }
  };
  const [info, setInfo] = useState<{
    lng: number;
    lat: number;
    elev: number;
    slope: number;
    pitch: number;
    bearing: number;
  } | null>(null);

  const { activeView: mode } = useMapStore(
    useShallow((s) => ({ activeView: s.activeView })),
  );
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
    <div className="fixed bottom-6 right-4 md:absolute md:bottom-8 md:right-8 z-30 md:z-10 bg-white/95 md:bg-sand-50 backdrop-blur-md md:backdrop-blur-xl border border-sand-200 p-3 md:p-4 rounded-xl text-ink text-xs font-mono pointer-events-none shadow-2xl overflow-hidden group max-w-[180px] md:max-w-none">
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>

      <div className="relative z-10 flex items-center justify-between gap-3 mb-2">
        <span className="text-[9px] uppercase tracking-widest text-sand-500">Position</span>
        <div className="pointer-events-auto flex rounded-md border border-sand-200 bg-white p-0.5 text-[9px]" role="group" aria-label="Coordinate format">
          {(["dd", "dms"] as const).map((format) => (
            <button
              key={format}
              onClick={() => changeCoordFormat(format)}
              aria-pressed={coordFormat === format}
              title={format === "dd" ? "Decimal degrees" : "Degrees, minutes, seconds"}
              className={`cursor-pointer px-1.5 py-0.5 rounded font-bold uppercase transition-colors ${
                coordFormat === format ? "bg-forest-800 text-white" : "text-sand-600 hover:text-ink"
              }`}
            >
              {format}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 md:gap-y-2 relative z-10">
        <div className="flex justify-between items-center gap-3">
          <span className="text-forest-700">Lng</span>
          <span className="font-bold whitespace-nowrap">
            {coordFormat === "dms" ? toDMS(info.lng, false) : info.lng.toFixed(5)}
          </span>
        </div>
        <div className="flex justify-between items-center gap-3">
          <span className="text-forest-700">Lat</span>
          <span className="font-bold whitespace-nowrap">
            {coordFormat === "dms" ? toDMS(info.lat, true) : info.lat.toFixed(5)}
          </span>
        </div>
        <div className="flex justify-between items-center gap-3">
          <span className="text-forest-700">Elev</span>
          <span className="font-bold text-gold-700 whitespace-nowrap">
            {info.elev.toFixed(1)} mdpl
          </span>
        </div>
        <div className="flex justify-between items-center gap-3">
          <span className="text-forest-700">Slope</span>
          <span className="font-bold">{info.slope.toFixed(1)}°</span>
        </div>

        <div className="md:col-span-2 h-px bg-gradient-to-r from-transparent via-sand-200 to-transparent my-1"></div>

        <div className="flex justify-between items-center gap-3">
          <span className="text-forest-700">Pitch</span>
          <span>{info.pitch.toFixed(1)}°</span>
        </div>
        <div className="flex justify-between items-center gap-3">
          <span className="text-forest-700">Bearing</span>
          <span>{info.bearing.toFixed(1)}°</span>
        </div>
      </div>

      <div className="hidden md:block mt-3 pt-2 border-t border-sand-100 text-[8px] text-center text-sand-500 uppercase tracking-widest opacity-50 group-hover:opacity-100 transition-opacity">
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm md:backdrop-blur-md">
      <div className="relative w-full max-w-lg bg-white border border-sand-200 rounded-2xl overflow-hidden ">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-forest-700 to-transparent"></div>

        <div className="p-6 border-b border-sand-100 bg-sand-50">
          <div className="flex items-center gap-3">
            <img
              src={landscapeLogo}
              alt="Logo"
              className="w-10 h-10 object-contain"
            />
            <div>
              <h2 className="text-xl font-bold text-ink tracking-tight">
                Quick Start Guide
              </h2>
              <p className="text-xs text-forest-700 font-mono tracking-widest">
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
                icon: <Wifi size={18} />,
                title: "Offline Maps [Pro Account]",
                desc: "Download map areas for use without internet connection. Perfect for remote field surveys.",
              },
              {
                icon: <Navigation size={18} />,
                title: "GPS Tracking & Monitoring [Enterprise Account]",
                desc: "Click the GPS button to broadcast your location or monitor teams (Enterprise). Features Smart Reconnect for signal loss.",
              },
              {
                icon: <Layers size={18} />,
                title: "Custom Basemaps [Enterprise Account]",
                desc: "Upload your own GeoTIFF/GeoPDF maps as overlays. Supports manual georeferencing and opacity control. (Enterprise & Monitor360 only)",
              },
              {
                icon: <MapPinned size={18} />,
                title: "Marked Locations [All Accounts]",
                desc: (
                  <>
                    Save camps, water sources, summits and more with full details, pick
                    them on the map, and export as GPX. Share one or several locations with
                    other users by email or name.
                    <div className="mt-2 grid grid-cols-1 gap-1 text-xs opacity-80">
                      <span>
                        • <strong>Free:</strong> 10 locations, receive shares
                      </span>
                      <span>
                        • <strong>Pro:</strong> 100 locations, share
                      </span>
                      <span>
                        • <strong>Enterprise:</strong> 1,000 locations, share
                      </span>
                    </div>
                  </>
                ),
              },
              {
                icon: <Footprints size={18} />,
                title: "Track Recorder [Enterprise Account]",
                desc: "Record personal GPS tracks online or offline with distance, duration and elevation. Share tracks by email and export GPX. Every signed-in account can view its own and shared tracks; Pro accounts can also rename their cloud tracks.",
              },
              {
                icon: <HardDrive size={18} />,
                title: "Cloud Storage",
                desc: "Tracks, marked locations, surveys and custom basemaps share your account's storage: Free 10 MB, Pro 100 MB, Enterprise 1 GB. Check your usage in the User Account menu; contact us if you need more space.",
              },
              {
                icon: <UserPlus size={18} />,
                title: "Request an Account",
                desc: "No account yet? Open Sign In / Register, choose Request Account and fill in the form. We will email your login details after approval.",
              },
            ].map((item, i) => (
              <div key={i} className="flex gap-4 group">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-forest-50 border border-forest-200 flex items-center justify-center text-forest-700 group-hover:bg-forest-700 group-hover:text-white transition-all">
                  {item.icon}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-sand-800">
                    {item.title}
                  </h4>
                  <div className="text-xs text-sand-600 leading-relaxed">
                    {item.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4">
            <button
              onClick={onClose}
              className="cursor-pointer w-full py-3 bg-forest-800 text-white font-bold rounded-xl hover:bg-forest-500 hover:text-white transition-all active:scale-[0.98] shadow-lg"
            >
              Let's Go
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="absolute top-4 right-4 cursor-pointer p-2 hover:bg-sand-100 rounded-full transition-colors text-sand-600 hover:text-ink z-[60]"
          title="Close"
        >
          <X size={20} />
        </button>

        <div className="p-4 bg-white/90 border-t border-sand-100 text-center text-[10px] text-sand-400 font-mono">
          Landscape360 v3.3.0
        </div>
      </div>
    </div>
  );
};
