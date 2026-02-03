import "mapbox-gl/dist/mapbox-gl.css";
import React, { useRef, useState, useCallback, useEffect } from "react";
import Map, {
  Source,
  Layer,
  NavigationControl,
  GeolocateControl,
} from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import mapboxgl from "mapbox-gl";
import { useMapStore } from "../store/useMapStore";
import { ThreeScene } from "./ThreeScene";
import { ContourLayer } from "./ContourLayer";
import { ControlPanel, TelemetryOverlay } from "./ControlPanel";
import { PlottingLayer } from "./PlottingLayer";
import { RegionSelectionLayer } from "./RegionSelectionLayer";
import { SurveyorPanel } from "./SurveyorPanel";
import { SearchPanel } from "./SearchPanel";

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
    setCenter,
    setZoom,
    setPitch,
    setBearing,
    setBounds,
    flyToDestination,
    triggerFlyTo,
  } = useMapStore();

  const mode = overrideViewMode || activeView;

  // Use ref for telemetry data to avoid frequent re-renders of the map container
  // But TelemetryOverlay needs state to update.
  // Solution: Separate TelemetryOverlay state from MapContainer state or throttle it.
  const [telemetry, setTelemetry] = useState<{
    lng: number;
    lat: number;
    elev: number;
    slope: number;
    pitch: number;
    bearing: number;
  } | null>(null);

  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Ref to track if we are currently performing a programmatic flyTo
  // This prevents the sync effect from interfering with smooth animations
  const isFlying = useRef(false);

  // Handle flyTo requests
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (map && flyToDestination) {
        isFlying.current = true;
        map.flyTo({
            center: flyToDestination.center,
            zoom: flyToDestination.zoom,
            duration: flyToDestination.duration || 2000,
            essential: true
        });
        
        map.once('moveend', () => {
            isFlying.current = false;
        });

        // Clear destination after triggering
        triggerFlyTo(null);
    }
  }, [flyToDestination, triggerFlyTo]);

  const handleMove = useCallback(
    (evt: any) => {
      // Throttle store updates or use debouncing if needed, but for smooth camera sync we need updates.
      // However, for React rendering, we can optimize.
      if (evt.originalEvent) {
        setCenter([evt.viewState.longitude, evt.viewState.latitude]);
        setZoom(evt.viewState.zoom);
        setPitch(evt.viewState.pitch);
        setBearing(evt.viewState.bearing);
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
    },
    [setCenter, setZoom, setPitch, setBearing, setBounds],
  );

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

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
      
      // Don't interrupt programmatic animations
      if (isFlying.current) return;

      // Dynamic duration: fast updates (dragging) = immediate, big jumps = smooth
      const isSmallChange = centerDiff < 0.01 && zoomDiff < 0.1 && pitchDiff < 5 && bearingDiff < 5;
      const duration = isSmallChange ? 0 : 400;

      map.easeTo({
        center: center,
        zoom: zoom,
        pitch: mode === "3D" ? pitch : 0,
        bearing: bearing,
        duration: duration,
        easing: (t) => t * (2 - t) // EaseOutQuad for smoother landing
      });
    }
  }, [center, zoom, pitch, bearing, mode]);

  const handleMapClick = useCallback(
    (evt: mapboxgl.MapMouseEvent) => {
      if (interactionMode === "draw_region") {
        const { lng, lat } = evt.lngLat;
        addRegionPoint([lng, lat]);
      }
    },
    [interactionMode, addRegionPoint]
  );

  // Throttled Telemetry Update
  const lastTelemetryUpdate = useRef(0);
  
  const handleMouseMove = useCallback(
    (evt: mapboxgl.MapMouseEvent) => {
      const now = Date.now();
      // Throttle to 60fps (approx 16ms) or even less (30ms) to save CPU
      if (now - lastTelemetryUpdate.current < 50) return; // 20fps cap for telemetry UI
      lastTelemetryUpdate.current = now;

      const map = mapRef.current?.getMap();
      if (!map) return;

      const { lng, lat } = evt.lngLat;
      if (!map.isStyleLoaded()) return;

      const elevation = map.queryTerrainElevation
        ? map.queryTerrainElevation(evt.lngLat) || 0
        : 0;

      // Simple slope approximation
      const offset = 0.0001;
      const e1 = map.queryTerrainElevation
        ? map.queryTerrainElevation(new mapboxgl.LngLat(lng + offset, lat)) ||
          elevation
        : elevation;
      const e2 = map.queryTerrainElevation
        ? map.queryTerrainElevation(new mapboxgl.LngLat(lng, lat + offset)) ||
          elevation
        : elevation;

      const dist = 11.132;
      const slope1 = Math.atan((e1 - elevation) / dist);
      const slope2 = Math.atan((e2 - elevation) / dist);
      const slope =
        Math.max(Math.abs(slope1), Math.abs(slope2)) * (180 / Math.PI);

      setTelemetry({
        lng,
        lat,
        elev: elevation,
        slope,
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      });
    },
    [mapRef],
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
                zoom: 16
            });
            setCenter(initialLocation);
            setZoom(16);
        }
    }
  }, [initialLocation, setCenter, setZoom]);

  const handleMapLoad = useCallback(() => {
    console.log("Map loaded successfully");
    setMapError(null);

    const map = mapRef.current?.getMap();
    if (map) {
        // Optimize Zoom & Gestures
        // 1. Smoother Scroll Zoom (Lower rate = smoother/slower)
        // Default is ~1/450. We reduce it to 1/600 for precision.
        map.scrollZoom.setWheelZoomRate(1 / 600);
        
        // 2. Mobile Optimizations
        if (isMobile) {
             // Disable rotation gesture to focus on zoom (Pinch to Zoom only)
             map.touchZoomRotate.disableRotation();
             // Center pinch zoom for stability
             map.touchZoomRotate.enable({ around: 'center' });
        }
    }
    
    // If we already have an initial location from App.tsx, use it immediately
    if (initialLocation) {
        const map = mapRef.current?.getMap();
        if (map) {
            map.jumpTo({
                center: initialLocation,
                zoom: 16
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
                 zoom: 16
             });
          }
          
          setCenter([longitude, latitude]);
          setZoom(16);
        },
        (error) => {
          let errorMessage = "Unknown error";
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = "Location permission denied. Please enable location services.";
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
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
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
        const bearingDelta = dx * 0.4; // Reduced from 0.8
        const pitchDelta = dy * 0.25; // Reduced from 0.5

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

  const isMobile = window.innerWidth < 768;

  // Optimize pixel ratio for mobile to reduce GPU load
  // High DPI screens (3x) can kill performance on mid-range phones
  // But react-map-gl doesn't support pixelRatio prop directly, so we just remove the unused variable for now
  // or use it if we manually instantiated mapboxgl.Map, but here we use the component.
  // Ideally, this should be handled by the browser or meta tags, but we can't force it easily via props here.
  // const pixelRatio = isMobile ? Math.min(window.devicePixelRatio, 1.5) : window.devicePixelRatio;

  return (
    <div className={`relative w-full h-full ${className || ""}`}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        preserveDrawingBuffer={!isMobile} // Disable on mobile to improve performance (unless screenshot needed)
        initialViewState={{
          longitude: center[0],
          latitude: center[1],
          zoom: zoom,
          pitch: mode === "3D" ? pitch : 0,
          bearing: bearing,
        }}
        minZoom={2}
        maxZoom={20}
        onMove={handleMove}
        onMouseMove={handleMouseMove}
        onClick={handleMapClick}
        onLoad={handleMapLoad}
        onError={handleMapError}
        scrollZoom={true}
        dragPan={true}
        dragRotate={!isMobile} // Disable rotation on mobile to avoid accidental rotation while zooming
        touchZoomRotate={true} // Enable touch gestures but rotation component is disabled in onLoad
        doubleClickZoom={true}
        boxZoom={false}
        antialias={!isMobile} // Disable antialiasing on mobile for performance
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        terrain={
          mode === "3D"
            ? { source: "mapbox-dem", exaggeration: elevationExaggeration }
            : undefined
        }
        maxPitch={85}
        fog={
          mode === "3D"
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
        <Source
          id="mapbox-dem"
          type="raster-dem"
          url="mapbox://mapbox.mapbox-terrain-dem-v1"
          tileSize={512}
          maxzoom={14}
        />

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

        {showContours && <ContourLayer />}
        <PlottingLayer />
        <RegionSelectionLayer />
        {mode === "3D" && <ThreeScene />}

        <GeolocateControl
          position="top-right"
          trackUserLocation={true}
          showUserHeading={true}
          onGeolocate={(e) => {
            setCenter([e.coords.longitude, e.coords.latitude]);
          }}
        />
        <NavigationControl position="top-right" />
      </Map>

      {showControls && <ControlPanel />}
      {showControls && <TelemetryOverlay info={telemetry} />}
      
      {/* Map Error Indicator */}
      {mapError && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-red-900/90 text-white px-6 py-4 rounded-xl border border-red-500/50 shadow-2xl backdrop-blur-md max-w-sm text-center">
          <div className="text-red-200 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
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

      <SurveyorPanel />
      <SearchPanel />
    </div>
  );
};

export const MapBoxContainer = React.memo(MapBoxContainerComponent);
export default MapBoxContainer;