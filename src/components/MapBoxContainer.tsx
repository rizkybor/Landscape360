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
}

export const MapBoxContainer: React.FC<MapBoxContainerProps> = ({
  overrideViewMode,
  className,
  showControls = true,
  mapRef: externalRef,
}) => {
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

  const [telemetry, setTelemetry] = useState<{
    lng: number;
    lat: number;
    elev: number;
    slope: number;
    pitch: number;
    bearing: number;
  } | null>(null);

  // Handle flyTo requests
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (map && flyToDestination) {
        map.flyTo({
            center: flyToDestination.center,
            zoom: flyToDestination.zoom,
            duration: flyToDestination.duration || 2000,
            essential: true
        });
        // Clear destination after triggering
        triggerFlyTo(null);
    }
  }, [flyToDestination, triggerFlyTo]);

  const handleMove = useCallback(
    (evt: any) => {
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

      map.easeTo({
        center: center,
        zoom: zoom,
        pitch: mode === "3D" ? pitch : 0,
        bearing: bearing,
        duration: 400,
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

  const handleMouseMove = useCallback(
    (evt: mapboxgl.MapMouseEvent) => {
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

  // Auto-geolocate on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCenter([position.coords.longitude, position.coords.latitude]);
          setZoom(14);
        },
        (error) => {
          console.error("Error getting location:", error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
      );
    }
  }, [setCenter, setZoom]);

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

        // Sensitivity factors
        const bearingDelta = dx * 0.8;
        const pitchDelta = dy * 0.5;

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
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        preserveDrawingBuffer={true}
        initialViewState={{
          longitude: center[0],
          latitude: center[1],
          zoom: zoom,
          pitch: mode === "3D" ? pitch : 0,
          bearing: bearing,
        }}
        onMove={handleMove}
        onMouseMove={handleMouseMove}
        onClick={handleMapClick}
        onLoad={() => console.log("Map loaded")}
        onError={(e) => console.error("Map error:", e)}
        scrollZoom={true}
        dragPan={true}
        dragRotate={true}
        doubleClickZoom={true}
        boxZoom={false}
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
      <SurveyorPanel />
      <SearchPanel />
    </div>
  );
};