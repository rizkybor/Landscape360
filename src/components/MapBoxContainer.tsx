import 'mapbox-gl/dist/mapbox-gl.css';
import React, { useRef, useState, useCallback, useEffect } from 'react';
import Map, { Source, Layer, NavigationControl, GeolocateControl } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import mapboxgl from 'mapbox-gl';
import { useMapStore } from '../store/useMapStore';
import { ThreeScene } from './ThreeScene';
import { ContourLayer } from './ContourLayer';
import { ControlPanel, TelemetryOverlay } from './ControlPanel';
import { PlottingLayer } from './PlottingLayer';
import { SurveyorPanel } from './SurveyorPanel';
import { SearchPanel } from './SearchPanel';

// Placeholder token - User needs to replace this
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1Ijoicml6a3lhamllIiwiYSI6ImNsZ2J4bDQ4bjA0Z2wzZHF5c3J2aGZ3eWcifQ.8-lIqB1r8P9S3p3Q2j4xQw';

console.log('Mapbox Token:', MAPBOX_TOKEN); // Debugging token

interface Props {
  overrideViewMode?: '2D' | '3D';
  className?: string;
  showControls?: boolean;
}

export const MapBoxContainer: React.FC<Props> = ({ overrideViewMode, className, showControls = true }) => {
  const mapRef = useRef<MapRef>(null);
  const { 
    center, zoom, pitch, bearing, 
    activeView, elevationExaggeration,
    mouseControlMode,
    setCenter, setZoom, setPitch, setBearing
  } = useMapStore();

  const mode = overrideViewMode || activeView;

  const [telemetry, setTelemetry] = useState<{ lng: number, lat: number, elev: number, slope: number, pitch: number, bearing: number } | null>(null);

  const handleMove = useCallback((evt: any) => {
    // Update global state ONLY if triggered by user interaction (avoids loops with programmatic updates)
    if (evt.originalEvent) { 
      setCenter([evt.viewState.longitude, evt.viewState.latitude]);
      setZoom(evt.viewState.zoom);
      setPitch(evt.viewState.pitch);
      setBearing(evt.viewState.bearing);
    }
  }, [setCenter, setZoom, setPitch, setBearing]);

  // Sync Store -> Map (Imperative) for external controls (Buttons, D-Pad)
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // We compare current map state with store state to decide if we need to update
    const c = map.getCenter();
    const z = map.getZoom();
    const p = map.getPitch();
    const b = map.getBearing();

    // Epsilon for float comparison
    const EPS = 0.001;
    
    const centerDiff = Math.abs(c.lng - center[0]) + Math.abs(c.lat - center[1]);
    const zoomDiff = Math.abs(z - zoom);
    const pitchDiff = Math.abs(p - pitch);
    const bearingDiff = Math.abs(b - bearing);

    // Only update map if store is significantly different
    if (centerDiff > EPS || zoomDiff > EPS || pitchDiff > EPS || bearingDiff > EPS) {
       // Ensure style is ready before easing
       if (!map.isStyleLoaded()) return;

       map.easeTo({
         center: center,
         zoom: zoom,
         pitch: mode === '3D' ? pitch : 0,
         bearing: bearing,
         duration: 400 // Smooth transition for button clicks
       });
    }
  }, [center, zoom, pitch, bearing, mode]);

  const handleMouseMove = useCallback((evt: mapboxgl.MapMouseEvent) => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const { lng, lat } = evt.lngLat;
    
    // Check if terrain is enabled/loaded before querying
    // Ensure style is loaded to prevent "Style is not done loading" error
    if (!map.isStyleLoaded()) return;

    const elevation = map.queryTerrainElevation ? (map.queryTerrainElevation(evt.lngLat) || 0) : 0;
    
    // Simple slope approximation
    const offset = 0.0001; // ~10m
    const e1 = map.queryTerrainElevation ? (map.queryTerrainElevation(new mapboxgl.LngLat(lng + offset, lat)) || elevation) : elevation;
    const e2 = map.queryTerrainElevation ? (map.queryTerrainElevation(new mapboxgl.LngLat(lng, lat + offset)) || elevation) : elevation;
    
    const dist = 11.132; // meters approx for 0.0001 deg at equator (rough approx)
    // Actually dist depends on latitude, but for visual telemetry it's okay
    
    const slope1 = Math.atan((e1 - elevation) / dist);
    const slope2 = Math.atan((e2 - elevation) / dist);
    const slope = Math.max(Math.abs(slope1), Math.abs(slope2)) * (180 / Math.PI);

    setTelemetry({ 
        lng, lat, elev: elevation, slope,
        pitch: map.getPitch(),
        bearing: map.getBearing()
    });
  }, []);

  // Auto-geolocate on mount
  useEffect(() => {
    // Only run if we haven't moved yet (optional check, but good for UX)
    // For now, force it on mount as requested
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCenter([position.coords.longitude, position.coords.latitude]);
          // Also set zoom to a closer level when locating
          setZoom(14); 
        },
        (error) => {
          console.error("Error getting location:", error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    }
  }, []); // Empty dependency array to run only once on mount

  // Custom Mouse Interaction Handler (Left=Rotate, Right=Pan)
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const canvas = map.getCanvas();
    
    let isRotateDragging = false; // Left Click
    let isPanDragging = false;    // Right Click
    let lastPos = { x: 0, y: 0 };

    const onMouseDown = (e: MouseEvent) => {
      // Prevent default to stop text selection or standard mapbox behavior if needed
      // But we need to allow standard clicks? 
      // e.preventDefault(); 
      
      if (mouseControlMode === 'camera') {
        if (e.button === 0) { // Left Button
          isRotateDragging = true;
          isPanDragging = false;
          canvas.style.cursor = 'grabbing';
        } else if (e.button === 2) { // Right Button
          isPanDragging = true;
          isRotateDragging = false;
          canvas.style.cursor = 'move';
        }
      } else {
        // Map Mode (Standard Mapbox)
        // We actually want to let Mapbox handle it natively, BUT since we disabled dragPan/dragRotate props
        // we have to simulate standard behavior here OR re-enable props.
        // Re-enabling props is cleaner but requires re-render.
        // Let's implement inverse logic here for consistency
        if (e.button === 0) { // Left Button -> Pan
          isPanDragging = true;
          isRotateDragging = false;
          canvas.style.cursor = 'move';
        } else if (e.button === 2) { // Right Button -> Rotate
          isRotateDragging = true;
          isPanDragging = false;
          canvas.style.cursor = 'grabbing';
        }
      }
      
      lastPos = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isRotateDragging && !isPanDragging) return;
      e.preventDefault(); // Stop default browser dragging

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
        
        // NO React State update here to avoid stutter
      } else if (isPanDragging) {
         // Pan map
         map.panBy([-dx, -dy], { animate: false });
         
         // NO React State update here
      }
    };

    const onMouseUp = () => {
      isRotateDragging = false;
      isPanDragging = false;
      canvas.style.cursor = '';
      
      // Sync final state to store ONCE when drag ends
      const c = map.getCenter();
      setCenter([c.lng, c.lat]);
      setBearing(map.getBearing());
      setPitch(map.getPitch());
    };

    // Prevent context menu on right click to allow panning
    const onContextMenu = (e: MouseEvent) => {
        // Only prevent context menu if we are in a mode that uses Right Click for interaction
        // Otherwise let it show (optional)
        e.preventDefault();
    };

    // Use requestAnimationFrame for smoother updates if needed, 
    // but standard DOM events are usually 60fps anyway.
    // However, we ensure we don't block the main thread.
    
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove); // Window to catch drags outside canvas
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('contextmenu', onContextMenu);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('contextmenu', onContextMenu);
    };
  }, [mouseControlMode, setBearing, setPitch, setCenter]); // Re-bind if mode changes

  // Handle Shift + Scroll for Pitch (Tilt)
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.shiftKey) {
        e.preventDefault();
        const currentPitch = map.getPitch();
        // Adjust sensitivity as needed
        const delta = e.deltaY * 0.1; 
        map.setPitch(Math.min(85, Math.max(0, currentPitch + delta)));
      }
    };

    // We need to attach to the canvas container to intercept properly
    const canvas = map.getCanvas();
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  return (
    <div className={`relative w-full h-full ${className || ''}`}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{
          longitude: center[0],
          latitude: center[1],
          zoom: zoom,
          pitch: mode === '3D' ? pitch : 0,
          bearing: bearing
        }}
        // Remove controlled props to allow free movement without state lag
        // longitude={center[0]}
        // latitude={center[1]}
        // zoom={zoom}
        // pitch={mode === '3D' ? pitch : 0} 
        // bearing={bearing}
        
        onMove={handleMove}
        onMouseMove={handleMouseMove}
        onLoad={() => console.log('Map loaded')}
        onError={(e) => console.error('Map error:', e)}
        scrollZoom={true}
        dragPan={true}
        dragRotate={true}
        doubleClickZoom={true}
        boxZoom={false} // Disable box zoom to allow Shift+Drag to be used for other things if needed (or just avoid confusion)
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        terrain={mode === '3D' ? { source: 'mapbox-dem', exaggeration: elevationExaggeration } : undefined}
        maxPitch={85} // Allow steeper pitch for "horizon" view
        fog={mode === '3D' ? {
          "range": [0.5, 10],
          "color": "white",
          "horizon-blend": 0.3,
          "high-color": "#add8e6",
          "space-color": "#d8f2ff",
          "star-intensity": 0.0
        } as any : undefined}
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
        {mode === '3D' && (
           <Layer
            id="sky"
            type="sky"
            paint={{
              'sky-type': 'atmosphere',
              'sky-atmosphere-sun': [0.0, 0.0],
              'sky-atmosphere-sun-intensity': 15
            }}
          />
        )}

        <ContourLayer />
        <PlottingLayer />
        {mode === '3D' && <ThreeScene />}

        <GeolocateControl 
          position="top-right" 
          trackUserLocation={true}
          showUserHeading={true}
          onGeolocate={(e) => {
            // Sync with store when geolocate control is used
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
