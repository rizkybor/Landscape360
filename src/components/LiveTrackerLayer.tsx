import { useEffect, useState, useRef, useMemo, memo } from 'react';
import { Marker, Popup, Source, Layer } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import { useTrackerStore } from '../store/useTrackerStore';
import { useTrackerService } from '../services/TrackerService';
import { TRACKER_CONFIG } from '../types/tracker';
import type { TrackerPacket } from '../types/tracker';
import { Signal, WifiOff, MapPin, Mountain } from 'lucide-react';
import type { LineLayer } from 'mapbox-gl';
import { X } from 'lucide-react';
import { TrackerHistoryViewer } from './TrackerHistoryViewer';

// --- HELPER: Generate Consistent Color from String ---
const stringToColor = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const h = Math.abs(hash % 360);
  return `hsl(${h}, 70%, 50%)`;
};

// --- HELPER: Get Initials from User ID ---
const getInitials = (name: string) => {
  return name
    .split(/[\s._-]+/)
    .map(part => part[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
};

const toDMS = (deg: number, isLat: boolean): string => {
    const absolute = Math.abs(deg);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1);
    
    const dir = isLat 
        ? (deg >= 0 ? "N" : "S") 
        : (deg >= 0 ? "E" : "W");
        
    return `${degrees}° ${minutes}' ${seconds}" ${dir}`;
};

// --- HELPER: Interpolated Marker for Smooth Movement ---
const InterpolatedMarker = memo(({ packet, onClick }: { packet: TrackerPacket; onClick: () => void }) => {
  const [position, setPosition] = useState({ lat: packet.lat, lng: packet.lng });
  const [isHovered, setIsHovered] = useState(false); // State for hover visibility
  const [, setTick] = useState(0); // Force re-render for offline status check
  const requestRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const startPosRef = useRef({ lat: packet.lat, lng: packet.lng });
  const targetPosRef = useRef({ lat: packet.lat, lng: packet.lng });

  // Force re-render periodically to update 'isOffline' status
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Update target when packet changes
  useEffect(() => {
    startPosRef.current = position;
    targetPosRef.current = { lat: packet.lat, lng: packet.lng };
    startTimeRef.current = performance.now();
    
    const animate = (time: number) => {
      if (!startTimeRef.current) startTimeRef.current = time;
      const elapsed = time - startTimeRef.current;
      const duration = TRACKER_CONFIG.UPDATE_INTERVAL_MS; // Match update interval
      
      const progress = Math.min(elapsed / duration, 1);
      const ease = progress; // Linear or ease-out (t * (2 - t))

      const newLat = startPosRef.current.lat + (targetPosRef.current.lat - startPosRef.current.lat) * ease;
      const newLng = startPosRef.current.lng + (targetPosRef.current.lng - startPosRef.current.lng) * ease;

      setPosition({ lat: newLat, lng: newLng });

      if (progress < 1) {
        requestRef.current = requestAnimationFrame(animate);
      }
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [packet.lat, packet.lng]);

  // Determine status: Online, Idle (Stationary), Offline
  // 1. Offline: No update for > 5 minutes (Truly offline)
  // Optimization: Pre-calculate date object to avoid double instantiation
  // Fix: packet.timestamp can be undefined in simulation sometimes? Ensure it exists.
  // Optimization: Use ref for current time to avoid re-render loop, but we need re-render for status update.
  // 'setTick' handles the re-render trigger every 5s.
  
  const packetTime = useMemo(() => new Date(packet.timestamp || Date.now()).getTime(), [packet.timestamp]);
  // Use a 'now' state that updates less frequently? No, Date.now() is cheap.
  // But calculating status inside render is fine as long as we don't cause side effects.
  const timeDiff = Date.now() - packetTime;
  const isOffline = timeDiff > 5 * 60 * 1000; // 5 minutes threshold
  
  // 2. Idle: Online (recent update) BUT Speed < 1 km/h (Stationary)
  // Note: We use 1.0 km/h as a noise threshold for GPS drift
  const isIdle = !isOffline && (packet.speed || 0) < 1.0;
  
  // Unique Identity Color
  // Optimization: Memoize color and initials to prevent re-calculation on every render
  const userColor = useMemo(() => stringToColor(packet.user_id), [packet.user_id]);
  const userInitials = useMemo(() => getInitials(packet.user_id), [packet.user_id]);

  // Styling based on User Request
  // Online: Green Dot, Pulse
  // Idle: Amber Dot, Dashed Border
  // Offline: Red Dot, Gray Bg, WifiOff Icon

  let markerBg = userColor;
  let dotColor = '#22c55e'; // Green (Online)
  
  if (isOffline) {
      markerBg = '#6b7280'; // Gray
      dotColor = '#ef4444'; // Red
  } else if (isIdle) {
      markerBg = userColor; // Keep user color
      dotColor = '#f59e0b'; // Amber
  }

  return (
    <Marker
      longitude={position.lng}
      latitude={position.lat}
      anchor="center"
      onClick={(e: any) => {
        e.originalEvent.stopPropagation();
        onClick();
      }}
      style={{ cursor: 'pointer', zIndex: isHovered ? 50 : 10 }} // Elevate z-index on hover
    >
      <div 
        className="relative group transition-transform duration-300 hover:scale-110"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Status Ring (Online Pulse) */}
        {!isOffline && !isIdle && (
             <div 
               className="absolute -inset-3 rounded-full opacity-30 animate-ping"
               style={{ backgroundColor: markerBg }} 
             />
        )}
        
        {/* Idle Ring (Static Dashed Amber) */}
        {isIdle && (
             <div 
               className="absolute -inset-1 rounded-full border-2 border-dashed border-amber-500 opacity-80"
             />
        )}

        {/* Main Marker Body */}
        <div 
          className={`w-10 h-10 rounded-full shadow-xl border-[3px] flex items-center justify-center text-white font-bold backdrop-blur-sm transition-colors duration-300 ${isOffline ? 'border-gray-300' : 'border-white'}`}
          style={{ backgroundColor: markerBg }}
        >
          {isOffline ? (
            <WifiOff size={18} />
          ) : (
            <span className="text-xs tracking-tighter drop-shadow-md">{userInitials}</span>
          )}
        </div>

        {/* Status Dot Indicator (Bottom Right) */}
        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 shadow-md z-10">
           <div 
             className={`w-3 h-3 rounded-full border-2 border-white`}
             style={{ backgroundColor: dotColor }}
           />
        </div>

        {/* Hover Label */}
        {isHovered && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap z-50 border border-slate-700 animate-in fade-in zoom-in-95 duration-200">
              {packet.user_id}
              <div className="text-[9px] font-normal text-slate-400 mt-0.5 uppercase tracking-wide">
                  {isOffline ? 'OFFLINE' : (isIdle ? 'IDLE (STATIONARY)' : 'ONLINE (MOVING)')}
              </div>
              {/* Tooltip Arrow */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45 border-b border-r border-slate-700"></div>
            </div>
        )}
      </div>
    </Marker>
  );
});

export const LiveTrackerLayer = ({ mapRef }: { mapRef?: React.RefObject<MapRef | null> }) => {
  const { trackers, selectedTrackerId, selectTracker, isLiveTrackingEnabled } = useTrackerStore();
  const [terrainElevation, setTerrainElevation] = useState<number | null>(null);
  
  useEffect(() => {
    console.log("LiveTrackerLayer Mounted. Trackers count:", Object.keys(trackers).length);
  }, [trackers]);

  // Initialize Service (Start Simulation/Connection)
  useTrackerService();

  // Update elevation when selected tracker moves
  useEffect(() => {
    // Safety check for mapRef
    if (!mapRef || !mapRef.current) return;

    const map = mapRef.current.getMap();
    
    // Ensure map and tracker exist
    if (selectedTrackerId && trackers[selectedTrackerId] && map) {
        const { lat, lng } = trackers[selectedTrackerId].latestPacket;
        
        // Use type assertion to avoid TS errors if queryTerrainElevation is missing in types
        // queryTerrainElevation returns number | null. It might be undefined if map style has no terrain.
        const rawElev = (map as any).queryTerrainElevation ? (map as any).queryTerrainElevation({ lng, lat }) : null;
        
        if (rawElev !== null && rawElev !== undefined) {
             const terrain = map.getTerrain();
             const exaggeration = (terrain && typeof terrain.exaggeration === 'number') ? terrain.exaggeration : 1;
             // Protect against division by zero (unlikely but safe)
             const validExaggeration = exaggeration === 0 ? 1 : exaggeration;
             setTerrainElevation(rawElev / validExaggeration);
        } else {
             setTerrainElevation(null);
        }
    } else {
        setTerrainElevation(null);
    }
  }, [selectedTrackerId, trackers, mapRef]);

  // Generate GeoJSON for Trails (History)
  const trailsGeoJSON = useMemo(() => {
    if (!isLiveTrackingEnabled) return null;
    
    const activeTrackers = Object.values(trackers);
    
    return {
      type: 'FeatureCollection',
      features: activeTrackers.map(t => ({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: t.history.map(h => [h.lng, h.lat])
        },
        properties: {
          user_id: t.latestPacket.user_id,
          // Use unique user color if selected, otherwise standard gray
          color: t.latestPacket.user_id === selectedTrackerId ? stringToColor(t.latestPacket.user_id) : '#94a3b8',
          opacity: t.latestPacket.user_id === selectedTrackerId ? 1 : 0.4
        }
      }))
    };
  }, [trackers, selectedTrackerId, isLiveTrackingEnabled]);

  if (!isLiveTrackingEnabled) return null;

  const activeTrackers = Object.values(trackers);
  const selectedTracker = selectedTrackerId ? trackers[selectedTrackerId] : null;

  const trailLayerStyle: LineLayer = {
    id: 'tracker-trails',
    source: 'tracker-trails-source', // Added source to satisfy type
    type: 'line',
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['case', ['==', ['get', 'user_id'], selectedTrackerId || ''], 4, 2],
      'line-opacity': ['get', 'opacity'],
      'line-dasharray': [2, 1]
    },
    layout: {
      'line-cap': 'round',
      'line-join': 'round'
    }
  };

  return (
    <>
      {/* History Viewer Button & Panel */}
      <TrackerHistoryViewer />

      {/* 1. Trails Layer */}
      {trailsGeoJSON && (
        <Source id="tracker-trails-source" type="geojson" data={trailsGeoJSON as any}>
          <Layer {...trailLayerStyle} />
        </Source>
      )}

      {/* 2. Realtime Markers */}
      {activeTrackers.map((tracker) => (
        <InterpolatedMarker 
          key={tracker.latestPacket.user_id}
          packet={tracker.latestPacket}
          onClick={() => selectTracker(tracker.latestPacket.user_id)}
        />
      ))}

      {/* 3. Popup for Selected Tracker */}
      {selectedTracker && (
        <Popup
          longitude={selectedTracker.latestPacket.lng}
          latitude={selectedTracker.latestPacket.lat}
          anchor="bottom"
          offset={25}
          onClose={() => selectTracker(null)}
          closeButton={false}
          closeOnClick={false}
          className="z-50 tracker-popup"
          maxWidth="300px"
        >
          {/* Glassmorphism Container */}
          <div className="p-0 w-[260px] sm:w-[280px] overflow-hidden rounded-2xl bg-white/90 backdrop-blur-md shadow-2xl border border-white/40">
            <div className="p-4 relative">
                
                {/* Close Button (Absolute Top-Right) */}
                <button 
                    onClick={() => selectTracker(null)}
                    className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-black/5 transition-colors z-10"
                    title="Close"
                >
                    <X size={16} />
                </button>

                {/* Header Section */}
                <div className="flex items-start gap-3 mb-4">
                    {/* Avatar Badge */}
                    <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white text-lg font-bold shadow-lg ring-2 ring-white shrink-0" 
                        style={{ backgroundColor: '#ec4899' }} // Fixed Pink/Magenta as per request
                    >
                        {getInitials(selectedTracker.latestPacket.user_id)}
                    </div>
                    
                    {/* Title & Status */}
                    <div className="flex flex-col min-w-0 pt-0.5">
                        <h3 className="font-bold text-slate-800 text-lg leading-tight truncate pr-6 uppercase tracking-wide">
                            {selectedTracker.latestPacket.user_id}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${selectedTracker.isOffline ? 'bg-slate-400' : 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]'}`}></span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                {selectedTracker.isOffline ? 'OFFLINE' : 'LIVE TRACKING'}
                            </span>
                        </div>
                    </div>
                </div>
                
                {/* Coordinates Card (Translucent Inner Panel) */}
                <div className="bg-slate-100/50 p-3 rounded-xl border border-slate-200/50 mb-4 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                        <MapPin size={12} /> COORDINATES
                    </div>
                    <div className="font-mono text-sm font-semibold text-slate-700 leading-relaxed tracking-tight">
                        <div>{toDMS(selectedTracker.latestPacket.lat, true)}</div>
                        <div>{toDMS(selectedTracker.latestPacket.lng, false)}</div>
                    </div>
                </div>

                {/* Metrics Row */}
                <div className="grid grid-cols-2 gap-4 mb-4 px-1">
                    {/* Elevation */}
                    <div className="flex flex-col">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            <Mountain size={14} className="text-slate-400"/> ELEVATION
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className="font-bold text-slate-800 text-xl">
                                {terrainElevation !== null ? terrainElevation.toFixed(0) : (selectedTracker.latestPacket.alt?.toFixed(0) || '-')}
                            </span>
                            <span className="text-xs font-medium text-slate-500 lowercase">mdpl</span>
                        </div>
                    </div>
                    
                    {/* Speed */}
                    <div className="flex flex-col">
                        <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                            <Signal size={14} className="text-slate-400"/> SPEED
                        </span>
                        <div className="flex items-baseline gap-1">
                            <span className="font-bold text-slate-800 text-xl">
                                {selectedTracker.latestPacket.speed?.toFixed(1) || 0}
                            </span>
                            <span className="text-xs font-medium text-slate-500 lowercase">km/h</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-slate-200/60 pt-3 flex justify-between items-end">
                    <span className="text-[10px] text-slate-400 font-medium">Last update</span>
                    <div className="text-right flex flex-col items-end">
                      <span className="text-slate-700 font-bold text-xs font-mono">
                        {new Date(selectedTracker.latestPacket.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':')} WIB
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                        {new Date(selectedTracker.latestPacket.timestamp).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                </div>
            </div>
          </div>
        </Popup>
      )}
    </>
  );
};
