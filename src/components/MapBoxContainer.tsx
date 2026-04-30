import "mapbox-gl/dist/mapbox-gl.css";
import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  Suspense,
  useMemo,
} from "react";
import { BasemapManager } from "./BasemapManager";
import { GeoreferenceTool } from "./GeoreferenceTool"; // New component
import { useCustomBasemapStore } from "../store/useCustomBasemapStore";
import { useSurveyStore } from "../store/useSurveyStore";
import MapGL, { Source, Layer, Popup } from "react-map-gl/mapbox";
import type { MapRef, MapMouseEvent } from "react-map-gl/mapbox";
import { useMapStore } from "../store/useMapStore";
import { ControlPanel, TelemetryOverlay } from "./ControlPanel";
import { useRouteStore } from "../store/useRouteStore";
import { RegionSelectionLayer } from "./RegionSelectionLayer";
import { SurveyorPanel } from "./SurveyorPanel";
import { SearchPanel } from "./SearchPanel";
import { NavigationControls } from "./NavigationControls";
import { UserLocationMarker } from "./UserLocationMarker";
import { WeatherWidget } from "./WeatherWidget";
import { ErrorBoundary } from "./ErrorBoundary";
import myDataLocation from "../data/myDataLocation.json";

// Lazy Load LiveTrackerLayer
const LiveTrackerLayer = React.lazy(() =>
  import("./LiveTrackerLayer").then((module) => ({
    default: module.LiveTrackerLayer,
  })),
);

const ThreeScene = React.lazy(() =>
  import("./ThreeScene").then((module) => ({
    default: module.ThreeScene,
  })),
);

const ContourLayer = React.lazy(() =>
  import("./ContourLayer").then((module) => ({
    default: module.ContourLayer,
  })),
);

const GridDMSLayer = React.lazy(() =>
  import("./GridDMSLayer").then((module) => ({
    default: module.GridDMSLayer,
  })),
);

const PlottingLayer = React.lazy(() =>
  import("./PlottingLayer").then((module) => ({
    default: module.PlottingLayer,
  })),
);

const RoutePlannerLayer = React.lazy(() =>
  import("./RoutePlannerLayer").then((module) => ({
    default: module.RoutePlannerLayer,
  })),
);

const MAPBOX_TOKEN =
  import.meta.env.VITE_MAPBOX_TOKEN || "YOUR_MAPBOX_TOKEN_HERE";

interface MapBoxContainerProps {
  overrideViewMode?: "2D" | "3D";
  className?: string;
  showControls?: boolean;
  mapRef?: React.RefObject<MapRef | null>;
  initialLocation?: [number, number] | null;
}

const MapBoxContainerComponent = ({
  overrideViewMode,
  className,
  showControls = true,
  mapRef: externalRef,
  initialLocation,
}: MapBoxContainerProps) => {
  const internalRef = useRef<MapRef>(null);
  const mapRef = externalRef || internalRef;

  const {
    center,
    zoom,
    pitch,
    bearing,
    activeView,
    elevationExaggeration,
    mouseControlMode,
    interactionMode,
    addRegionPoint,
    showContours,
    showCustomLocations,
    mapStyle,
    setCenter,
    setZoom,
    setPitch,
    setBearing,
    setBounds,
    triggerFlyTo,
    flyToDestination,
  } = useMapStore();

  const mode = overrideViewMode || activeView;
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [selectedLocation, setSelectedLocation] = useState<any | null>(null);
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const { basemaps, loadBasemaps, layerOpacities, isManagerOpen, toggleManager } = useCustomBasemapStore();
  const { user, isPlotMode } = useSurveyStore();
  const isRoutePlannerEnabled = useRouteStore((s) => s.isRoutePlannerEnabled);

  useEffect(() => {
    if (user) {
        loadBasemaps();
    }
  }, [loadBasemaps, user]);

  // Handle popup visibility animation
  useEffect(() => {
    let rafId: number;
    if (selectedLocation) {
      // Small delay to allow mounting before fading in
      rafId = requestAnimationFrame(() => setIsPopupVisible(true));
    } else {
      setIsPopupVisible(false);
    }
    return () => cancelAnimationFrame(rafId);
  }, [selectedLocation]);

  const shouldShowMarkers = showCustomLocations && zoom >= 10;

  const locationById = useMemo(() => {
    return new Map(myDataLocation.map((l) => [l.id, l] as const));
  }, []);

  const closeSelectedLocation = useCallback(() => {
    setIsPopupVisible(false);
    setTimeout(() => setSelectedLocation(null), 300);
  }, []);

  const customLocationsGeoJSON = useMemo(() => {
    return {
      type: "FeatureCollection",
      features: myDataLocation.map((location) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: location.center,
        },
        properties: {
          id: location.id,
          name: location.place_name,
          kind: location.place_type.includes("mountain")
            ? "mountain"
            : location.place_type.includes("cliff")
              ? "cliff"
              : location.place_type.includes("cave")
                ? "cave"
                : location.place_type.includes("river")
                  ? "river"
                  : location.place_type.includes("water")
                    ? "water"
                    : "poi",
        },
      })),
    } as const;
  }, []);

  const shouldHandlePOIClick = showCustomLocations && shouldShowMarkers;

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Ref to track if we are currently performing a programmatic flyTo
  const isFlying = useRef(false);

  // Ref to track user interaction to decouple gesture from store updates
  const isInteracting = useRef(false);

  // Handle FlyTo (Restored from MapSync)
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (map && flyToDestination) {
      isFlying.current = true;
      map.flyTo({
        center: flyToDestination.center,
        zoom: flyToDestination.zoom,
        duration: flyToDestination.duration || 2000,
        essential: true,
      });

      map.once("moveend", () => {
        isFlying.current = false;
      });

      triggerFlyTo(null);
    }
  }, [flyToDestination, triggerFlyTo, mapRef]);

  const handleMoveStart = useCallback(() => {
    isInteracting.current = true;
  }, []);

  const handleMoveEnd = useCallback(() => {
    // Force a final sync to ensure store matches map exactly
    // This prevents "snap back" or "zoom out" glitches when inertia ends
    const map = mapRef.current?.getMap();
    if (map) {
      setCenter(map.getCenter().toArray() as [number, number]);
      setZoom(map.getZoom());

      // Sync bearing in all modes
      setBearing(map.getBearing());

      // Only sync pitch in 3D mode (keep 2D flat)
      if (mode === "3D") {
        setPitch(map.getPitch());
      }

      // Update bounds
      const bounds = map.getBounds();
      if (bounds) {
        setBounds({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        });
      }
    }

    // Add a small delay to ensure we don't snap back immediately after a fling
    setTimeout(() => {
      isInteracting.current = false;
    }, 100);
  }, [setCenter, setZoom, setPitch, setBearing, setBounds, mode, mapRef]);

  // Detect mobile device for initial configuration
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Throttle store updates to prevent UI lag on mobile
  const lastStoreUpdate = useRef(0);

  const handleMove = useCallback(
    (evt: any) => {
      // If originalEvent is present, it's a user interaction
      if (evt.originalEvent) {
        isInteracting.current = true;
      }

      // Throttle store updates
      // On mobile 3D, we limit state sync to 30fps (approx 33ms) to save CPU for the map renderer
      const now = Date.now();
      const throttleLimit = isMobile && mode === "3D" ? 33 : 0; // 0 = sync every frame on desktop

      if (now - lastStoreUpdate.current >= throttleLimit) {
        lastStoreUpdate.current = now;

        if (evt.originalEvent) {
          setCenter([evt.viewState.longitude, evt.viewState.latitude]);
          setZoom(evt.viewState.zoom);
          setBearing(evt.viewState.bearing); // Always sync bearing (rotation is allowed in 2D)

          // Only update pitch if in 3D mode
          if (mode === "3D") {
            setPitch(evt.viewState.pitch);
          }
        }

        const bounds = evt.target.getBounds();
        if (bounds) {
          setBounds({
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest(),
          });
        }
      }
    },
    [setCenter, setZoom, setPitch, setBearing, setBounds, isMobile, mode],
  );

  // Sync Store -> Map (Imperative) - RESTORED to fix view behavior
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Use requestAnimationFrame to sync visual updates without blocking main thread
    let rafId: number;

    const syncMap = () => {
      const c = map.getCenter();
      const z = map.getZoom();
      const p = map.getPitch();
      const b = map.getBearing();

      // Epsilon for float comparison
      const EPS = 0.001;
      const centerDiff =
        Math.abs(c.lng - center[0]) + Math.abs(c.lat - center[1]);
      const zoomDiff = Math.abs(z - zoom);
      const pitchDiff = Math.abs(p - pitch);
      const bearingDiff = Math.abs(b - bearing);

      if (
        centerDiff > EPS ||
        zoomDiff > EPS ||
        pitchDiff > EPS ||
        bearingDiff > EPS
      ) {
        if (!map.isStyleLoaded()) return;

        // CRITICAL: Don't interrupt programmatic animations or user interactions
        if (isFlying.current || isInteracting.current) return;

        // Dynamic duration logic
        const isModeSwitch = Math.abs(pitchDiff) > 40;
        const isSmallChange =
          centerDiff < 0.01 &&
          zoomDiff < 0.1 &&
          pitchDiff < 5 &&
          bearingDiff < 5;
        const duration = isModeSwitch ? 1500 : isSmallChange ? 0 : 400;

        map.easeTo({
          center: center,
          zoom: zoom,
          pitch: mode === "3D" ? pitch : 0,
          bearing: bearing,
          duration: duration,
          easing: (t) =>
            isModeSwitch
              ? t < 0.5
                ? 4 * t * t * t
                : 1 - Math.pow(-2 * t + 2, 3) / 2
              : t * (2 - t),
        });
      }
    };

    rafId = requestAnimationFrame(syncMap);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [center, zoom, pitch, bearing, mode, mapRef]);

  // Sync Terrain Exaggeration (Restored)
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    if (map.getSource("mapbox-dem")) {
      map.setTerrain({
        source: "mapbox-dem",
        exaggeration: mode === "3D" ? elevationExaggeration : 0.0001,
      });
    }
  }, [elevationExaggeration, mode, mapRef]);

  const handleMapClick = useCallback(
    (evt: MapMouseEvent) => {
      if (interactionMode === "draw_region") {
        // Check limit directly from store state to avoid subscribing component to regionPoints
        if (useMapStore.getState().regionPoints.length >= 4) {
          return;
        }
        const { lng, lat } = evt.lngLat;
        addRegionPoint([lng, lat]);
        return;
      }

      if (!shouldHandlePOIClick) return;

      const features = evt.features ?? [];
      const unclustered = features.find(
        (f) => (f as any)?.layer?.id === "custom-unclustered",
      ) as any | undefined;
      if (unclustered?.properties?.id) {
        const loc = locationById.get(String(unclustered.properties.id));
        if (loc) {
          setSelectedLocation(loc);
        }
        return;
      }

      const clustered = features.find((f) => {
        const id = (f as any)?.layer?.id;
        return id === "custom-clusters" || id === "custom-cluster-count";
      }) as any | undefined;
      if (clustered?.properties?.cluster_id != null) {
        const map = mapRef.current?.getMap();
        const source: any = map?.getSource("custom-locations");
        if (map && source?.getClusterExpansionZoom) {
          const clusterId = Number(clustered.properties.cluster_id);
          const [lng, lat] = (clustered.geometry?.coordinates ?? []) as [
            number,
            number,
          ];
          source.getClusterExpansionZoom(
            clusterId,
            (err: any, expansionZoom: number) => {
              if (err) return;
              map.easeTo({
                center: [lng, lat],
                zoom: expansionZoom,
                duration: 500,
              });
            },
          );
        }
        return;
      }

      if (selectedLocation) {
        closeSelectedLocation();
      }
    },
    [
      interactionMode,
      addRegionPoint,
      shouldHandlePOIClick,
      locationById,
      mapRef,
      selectedLocation,
      closeSelectedLocation,
    ],
  );

  // Auto-geolocate on mount (moved to onLoad for reliability)
  // useEffect(() => { ... }, []); removed

  const [mapError, setMapError] = useState<string | null>(null);

  // Handle late-arriving initialLocation (e.g. from App.tsx geolocation)
  useEffect(() => {
    if (initialLocation) {
      const map = mapRef.current?.getMap();
      if (map && map.isStyleLoaded()) {
        map.jumpTo({
          center: initialLocation,
          zoom: 16,
        });
        setCenter(initialLocation);
        setZoom(16);
      }
    }
  }, [initialLocation, setCenter, setZoom]);

  const handleGeolocate = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;
          // Use triggerFlyTo to avoid conflict with state synchronization
          triggerFlyTo({
            center: [longitude, latitude],
            zoom: 16,
            duration: 2000,
          });
        },
        (error) => {
          let errorMessage = "Unknown error";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage =
                "Location permission denied. Please enable location services.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location information is unavailable.";
              break;
            case error.TIMEOUT:
              errorMessage = "The request to get user location timed out.";
              break;
          }
          console.warn("Geolocation error:", errorMessage, error);
          alert(errorMessage);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  }, [triggerFlyTo]);

  const handleMapLoad = useCallback(() => {
    console.log("Map loaded successfully");
    setMapError(null);

    const map = mapRef.current?.getMap();
    if (map) {
      // Optimize Zoom & Gestures

      // 1. Desktop Optimizations
      // Increase smoothness for panning and zooming
      // Default scrollZoom rate is ~1/450. Adjusted for precision.
      map.scrollZoom.setWheelZoomRate(1 / 450);

      // Enhance inertia for smoother 'throw' effect when panning
      map.dragPan.enable({
        linearity: mode === "3D" ? 0.3 : 0.1, // Reduced linearity for more fluid "throw" feel (0.3 in 3D, 0.1 in 2D)
        easing: (t) => t * (2 - t), // Standard easeOutQuad
        deceleration: mode === "3D" ? 2500 : 3000, // Increased deceleration for longer glide (3000ms in 2D)
      });

      // 2. Mobile Optimizations
      if (isMobile) {
        // Enable rotation but center pinch zoom for stability
        map.touchZoomRotate.enable({ around: "center" });

        // Disable pitch (tilt) via touch in 2D mode to prevent accidental tilting
        // Only allow pitch in 3D mode
        if (mode === "3D") {
          map.touchPitch.enable();
        } else {
          map.touchPitch.disable();
        }

        // Improve touch pan responsiveness
        // Note: Mapbox GL JS defaults are usually good, but ensuring handlers are active
        // Enhanced dragPan for mobile
        map.dragPan.enable({
          linearity: 0.1, // Very low linearity for responsive touch tracking
          easing: (t) => t * (2 - t),
          deceleration: 3000, // Long glide on mobile swipe
        });
      }
    }

    // If we already have an initial location from App.tsx, use it immediately
    if (initialLocation) {
      const map = mapRef.current?.getMap();
      if (map) {
        map.jumpTo({
          center: initialLocation,
          zoom: 16,
        });
      }
      setCenter(initialLocation);
      setZoom(16);
      return;
    }

    // Otherwise fallback to normal geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { longitude, latitude } = position.coords;

          // Use jumpTo for instant transition
          const map = mapRef.current?.getMap();
          if (map) {
            map.jumpTo({
              center: [longitude, latitude],
              zoom: 16,
            });
          }

          setCenter([longitude, latitude]);
          setZoom(16);
        },
        (error) => {
          let errorMessage = "Unknown error";
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage =
                "Location permission denied. Please enable location services.";
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = "Location information is unavailable.";
              break;
            case error.TIMEOUT:
              errorMessage = "The request to get user location timed out.";
              break;
          }
          console.warn("Geolocation error:", errorMessage, error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    } else {
      console.warn("Geolocation is not supported by this browser.");
    }
  }, [setCenter, setZoom]);

  const handleMapError = useCallback((e: any) => {
    console.error("MapBox Error:", e);
    if (e?.error?.status === 401 || e?.error?.message?.includes("forbidden")) {
      setMapError("Invalid Mapbox Token. Please check your configuration.");
    } else if (e?.error?.status === 404) {
      setMapError("Map style not found. Using fallback.");
    }
  }, []);

  // Custom Mouse Interaction Handler (Left=Rotate, Right=Pan)
  useEffect(() => {
    // Disable custom mouse handler on mobile to prevent conflict with touch gestures
    if (window.innerWidth < 768) return;

    const map = mapRef.current?.getMap();
    if (!map) return;

    const canvas = map.getCanvas();

    let isRotateDragging = false;
    let isPanDragging = false;
    let lastPos = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      if (mouseControlMode === "camera") {
        if (e.button === 0) {
          isRotateDragging = true;
          isPanDragging = false;
          canvas.style.cursor = "grabbing";
        } else if (e.button === 2) {
          isPanDragging = true;
          isRotateDragging = false;
          canvas.style.cursor = "move";
        }
      } else {
        if (e.button === 0) {
          isPanDragging = true;
          isRotateDragging = false;
          canvas.style.cursor = "move";
        } else if (e.button === 2) {
          isRotateDragging = true;
          isPanDragging = false;
          canvas.style.cursor = "grabbing";
        }
      }

      lastPos = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isRotateDragging && !isPanDragging) return;
      e.preventDefault();

      const dx = e.clientX - lastPos.x;
      const dy = e.clientY - lastPos.y;
      lastPos = { x: e.clientX, y: e.clientY };

      if (isRotateDragging) {
        const bearing = map.getBearing();
        const pitch = map.getPitch();

        // Sensitivity factors (Optimized for smoother control)
        // Adaptive sensitivity for 3D mode
        const sensitivity = mode === "3D" ? 0.6 : 0.4;
        const bearingDelta = dx * sensitivity;
        const pitchDelta = dy * (sensitivity * 0.6); // Pitch usually needs less sensitivity

        // Perform mutation directly on map without waiting for react render
        map.setBearing(bearing + bearingDelta);
        map.setPitch(Math.min(85, Math.max(0, pitch - pitchDelta)));
      } else if (isPanDragging) {
        // Pan map
        map.panBy([-dx, -dy], { animate: false });
      }
    };

    const onMouseUp = () => {
      isRotateDragging = false;
      isPanDragging = false;
      canvas.style.cursor = "";

      // Sync final state to store ONCE when drag ends
      const c = map.getCenter();
      setCenter([c.lng, c.lat]);
      setBearing(map.getBearing());
      setPitch(map.getPitch());
    };

    // Prevent context menu on right click to allow panning
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("contextmenu", onContextMenu);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("contextmenu", onContextMenu);
    };
  }, [mouseControlMode, setBearing, setPitch, setCenter]);

  // Handle Shift + Scroll for Pitch (Tilt)
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.shiftKey) {
        e.preventDefault();
        const currentPitch = map.getPitch();
        const delta = e.deltaY * 0.1;
        map.setPitch(Math.min(85, Math.max(0, currentPitch + delta)));
      }
    };

    const canvas = map.getCanvas();
    canvas.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, []);

  return (
    <div className={`relative w-full h-full ${className || ""}`}>
      <MapGL
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        // PERFORMANCE: Disable preserveDrawingBuffer on mobile to save memory (prevents force close)
        // Trade-off: Screenshot/Canvas export won't work on mobile, but native OS screenshot works fine.
        preserveDrawingBuffer={!isMobile} 
        initialViewState={{
          longitude: center[0],
          latitude: center[1],
          zoom: zoom,
          pitch: mode === "3D" ? pitch : 0,
          bearing: bearing,
        }}
        // PERFORMANCE: Limit pixel ratio on high-DPI mobile screens (Retina/OLED)
        // Rendering 3x/4x on mobile kills GPU. Cap at 2x or 1.5x.
        // Note: react-map-gl passes extra props to mapbox-gl constructor if not in its prop types? 
        // Actually, we might need to handle this carefully.
        // Mapbox GL JS default is window.devicePixelRatio.
        // We can't easily change it via prop in react-map-gl v7 without 'mapLib' or custom logic, 
        // but let's try setting it if supported, otherwise rely on CSS scaling.
        // actually, react-map-gl doesn't expose pixelRatio in MapProps. 
        // We can force it via style or just rely on disabling heavy features.
        
        minZoom={2}
        maxZoom={20}
        onMoveStart={handleMoveStart}
        onMoveEnd={handleMoveEnd}
        onMove={handleMove}
        onClick={handleMapClick}
        onLoad={handleMapLoad}
        onError={handleMapError}
        interactiveLayerIds={
          shouldHandlePOIClick
            ? ["custom-unclustered", "custom-clusters", "custom-cluster-count"]
            : undefined
        }
        scrollZoom={true}
        dragPan={true}
        dragRotate={true} // Enable rotation on mobile
        touchZoomRotate={true} // Enable touch rotation
        touchPitch={mode === "3D"} // Only allow pitch (tilt) in 3D mode to keep 2D view stable
        bearingSnap={0} // Disable snapping to North to allow 180/360 degree free rotation
        pitchWithRotate={true} // Allow pitching while rotating
        doubleClickZoom={true}
        boxZoom={false}
        antialias={!isMobile} // Disable antialiasing on mobile for performance
        style={{ width: "100%", height: "100%" }}
        mapStyle={mapStyle}
        terrain={
          // PERFORMANCE: Only load terrain source if strictly needed (3D mode) or on Desktop
          // Mobile 2D mode should avoid loading terrain tiles to save bandwidth/memory
          (mode === "3D" || !isMobile) ? {
            source: "mapbox-dem",
            exaggeration: mode === "3D" ? elevationExaggeration : 0.0001, 
          } : undefined
        }
        maxPitch={85}
        fog={
          mode === "3D" && !isMobile // Disable fog on mobile for performance
            ? ({
                range: [0.5, 10],
                color: "white",
                "horizon-blend": 0.3,
                "high-color": "#add8e6",
                "space-color": "#d8f2ff",
                "star-intensity": 0.0,
              } as any)
            : undefined
        }
        reuseMaps
      >
        {/* Mapbox 3D Terrain & Sky */}

        {(mode === "3D" || !isMobile) && (
          <Source
            id="mapbox-dem"
            type="raster-dem"
            url="mapbox://mapbox.mapbox-terrain-dem-v1"
            tileSize={512}
            maxzoom={14}
          />
        )}

        {/* Sky for 3D */}
        {mode === "3D" && (
          <Layer
            id="sky"
            type="sky"
            paint={{
              "sky-type": "atmosphere",
              "sky-atmosphere-sun": [0.0, 0.0],
              "sky-atmosphere-sun-intensity": 15,
            }}
          />
        )}

        {showContours && (
          <Suspense fallback={null}>
            <ContourLayer />
          </Suspense>
        )}

        <Suspense fallback={null}>
          <GridDMSLayer />
        </Suspense>

        {isPlotMode && (
          <Suspense fallback={null}>
            <PlottingLayer />
          </Suspense>
        )}

        {isRoutePlannerEnabled && (
          <Suspense fallback={null}>
            <RoutePlannerLayer mapboxToken={MAPBOX_TOKEN} />
          </Suspense>
        )}

        <RegionSelectionLayer />

        {mode === "3D" && (
          <Suspense fallback={null}>
            <ThreeScene />
          </Suspense>
        )}

        {/* Map Synchronization Logic (Restored to component) */}

        {/* NEW: Live GPS Tracker Layer (Lazy Loaded & Feature Flagged) */}
        {import.meta.env.VITE_ENABLE_GPS_TRACKER === "true" && (
          <ErrorBoundary fallback={null}>
            <Suspense fallback={null}>
              <LiveTrackerLayer mapRef={mapRef} />
            </Suspense>
          </ErrorBoundary>
        )}

        {/* User Location Indicator */}
        <UserLocationMarker initialLocation={initialLocation} />

        {/* Custom Location Markers - GeoJSON + Cluster */}
        {showCustomLocations && shouldShowMarkers && (
          <Source
            id="custom-locations"
            type="geojson"
            data={customLocationsGeoJSON as any}
            cluster={true}
            clusterRadius={50}
            clusterMaxZoom={14}
          >
            <Layer
              id="custom-unclustered"
              type="circle"
              filter={["!", ["has", "point_count"]]}
              paint={{
                "circle-color": [
                  "match",
                  ["get", "kind"],
                  "mountain",
                  "#16a34a",
                  "cliff",
                  "#f97316",
                  "cave",
                  "#a855f7",
                  "river",
                  "#0ea5e9",
                  "water",
                  "#2563eb",
                  "#7c3aed",
                ],
                "circle-radius": 6,
                "circle-stroke-width": 2,
                "circle-stroke-color": "#ffffff",
                "circle-opacity": 0.95,
              }}
            />
            {/* Cluster circles */}
            <Layer
              id="custom-clusters"
              type="circle"
              filter={["has", "point_count"]}
              paint={{
                "circle-color": [
                  "step",
                  ["get", "point_count"],
                  "#60a5fa",
                  50,
                  "#2563eb",
                  200,
                  "#1d4ed8",
                ],
                "circle-radius": [
                  "step",
                  ["get", "point_count"],
                  16,
                  50,
                  22,
                  200,
                  28,
                ],
                "circle-opacity": 0.9,
              }}
            />
            {/* Cluster labels */}
            <Layer
              id="custom-cluster-count"
              type="symbol"
              filter={["has", "point_count"]}
              layout={{
                "text-field": "{point_count_abbreviated}",
                "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
                "text-size": 12,
              }}
              paint={{
                "text-color": "#ffffff",
              }}
            />
          </Source>
        )}

        {/* Selected Location Popup */}
        {selectedLocation && (
          <Popup
            longitude={selectedLocation.center[0]}
            latitude={selectedLocation.center[1]}
            anchor="bottom"
            offset={50}
            onClose={closeSelectedLocation}
            closeOnClick={true}
            closeButton={true}
            className="z-50"
            maxWidth="300px"
          >
            <div
              className={`p-1 transition-all duration-300 ease-out transform ${
                isPopupVisible
                  ? "opacity-100 translate-y-0 scale-100"
                  : "opacity-0 translate-y-4 scale-95"
              }`}
            >
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={closeSelectedLocation}
                  className="text-[11px] font-semibold text-gray-600 hover:text-gray-900"
                >
                  Close
                </button>
              </div>
              <div className="flex items-start gap-3 mb-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    selectedLocation.place_type.includes("mountain")
                      ? "bg-green-100 text-green-600"
                      : selectedLocation.place_type.includes("water")
                        ? "bg-blue-100 text-blue-600"
                        : "bg-purple-100 text-purple-600"
                  }`}
                >
                  <img
                    src={
                      selectedLocation.place_type.includes("mountain")
                        ? "/mountain.svg"
                        : selectedLocation.place_type.includes("cliff")
                          ? "/cliff.svg"
                          : selectedLocation.place_type.includes("cave")
                            ? "/cave.svg"
                            : selectedLocation.place_type.includes("river")
                              ? "/river.svg"
                              : selectedLocation.place_type.includes("water")
                                ? "/water.svg"
                                : "/house.svg"
                    }
                    className="w-5 h-5 object-contain"
                    alt=""
                  />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 leading-tight">
                    {selectedLocation.place_name}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-medium mt-0.5 uppercase tracking-wide">
                    {selectedLocation.text}
                  </p>
                </div>
              </div>

              {selectedLocation.properties?.wikidata && (
                <div className="mt-2 pt-2 border-t border-gray-100 text-center">
                  <p className="text-[10px] text-gray-400 tracking-wide line-clamp-8">
                    Data source: Wikipedia
                  </p>
                  <p className="text-[11px] text-gray-500 leading-tight">
                    {selectedLocation.properties.wikidata}
                  </p>
                </div>
              )}
            </div>
          </Popup>
        )}

      {/* Custom Basemaps Layers - Rendered last to be ON TOP */}
      {basemaps.map((map) => {
        if (!map.is_active || !map.image_url || !map.bounds) return null;

        return (
          <Source
            key={map.id}
            id={`source-${map.id}`}
            type="image"
            url={map.image_url}
            coordinates={[
              [map.bounds.west, map.bounds.north], // Top Left
              [map.bounds.east, map.bounds.north], // Top Right
              [map.bounds.east, map.bounds.south], // Bottom Right
              [map.bounds.west, map.bounds.south], // Bottom Left
            ]}
          >
            <Layer
              id={`layer-${map.id}`}
              type="raster"
              paint={{ 
                "raster-opacity": layerOpacities[map.id] ?? 1,
                "raster-fade-duration": 300 
              }}
            />
          </Source>
        );
      })}

      {/* Georeferencing Tool */}
      <GeoreferenceTool />

      {/* Custom Navigation Controls */}
        {showControls && (
          <NavigationControls
            mapRef={mapRef}
            onGeolocate={handleGeolocate}
            bearing={bearing}
            pitch={pitch}
          />
        )}
      </MapGL>

      {showControls && <ControlPanel />}
      {showControls && <TelemetryOverlay mapRef={mapRef} />}

      {/* Map Error Indicator */}
      {mapError && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-red-900/90 text-white px-6 py-4 rounded-xl border border-red-500/50 shadow-2xl backdrop-blur-md max-w-sm text-center">
          <div className="text-red-200 mb-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-8 w-8 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="font-bold text-lg mb-1">Map Error</h3>
          <p className="text-sm opacity-90">{mapError}</p>
        </div>
      )}

      {/* Offline Indicator */}
      {isOffline && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-lg flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-top-4">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          OFFLINE MODE
        </div>
      )}

      {showControls && <SurveyorPanel />}
      {showControls && <SearchPanel />}
      {showControls && <WeatherWidget />}
      {/* Custom Basemap Manager */}
      {isManagerOpen && (
        <BasemapManager 
          onClose={toggleManager} 
          onZoomToLayer={(bounds) => {
            const map = mapRef.current?.getMap();
            if (map && bounds) {
              map.fitBounds(
                [
                  [bounds.west, bounds.south],
                  [bounds.east, bounds.north]
                ],
                { padding: 50, animate: true, duration: 1500 }
              );
            }
          }}
        />
      )}
    </div>
  );
};

export const MapBoxContainer = React.memo(MapBoxContainerComponent);
export default MapBoxContainer;
