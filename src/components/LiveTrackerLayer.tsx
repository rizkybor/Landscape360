import { useEffect, useState, useRef, useMemo, memo } from 'react';
import { Marker, Popup, Source, Layer } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import { useTrackerStore } from '../store/useTrackerStore';
import { useTrackerService } from '../services/TrackerService';
import { TRACKER_CONFIG } from '../types/tracker';
import type { TrackerPacket } from '../types/tracker';
import { Battery, Signal, WifiOff, MapPin, Mountain } from 'lucide-react';
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

  // Determine color based on status/battery
  const isLowBattery = packet.battery < 20;
  
  // FIXED: isOffline should NOT be affected by local UI state (like hover)
  // It is purely based on time difference.
  // The 'setTick' force re-render ensures this value updates even if no new props come in.
  const isOffline = (Date.now() - new Date(packet.timestamp).getTime()) > TRACKER_CONFIG.OFFLINE_THRESHOLD_MS;
  
  // Unique Identity Color
  const userColor = stringToColor(packet.user_id);
  const userInitials = getInitials(packet.user_id);

  // Marker Color Logic: Gray (Offline) -> Red (Low Battery) -> Unique User Color (Active)
  // When Hovered, we force it to show COLOR (Active style) so user can see who it is, unless it's truly offline?
  // Wait, user said "why does it change to offline when hovered?".
  // This implies the hover action caused a re-render which triggered the offline check.
  // If the packet is old, it IS offline.
  // BUT maybe the user means "it looks like the offline icon appears on hover"?
  // Let's check the render logic below.
  
  // Ah, the issue might be that on hover, we want to see the USER, not the offline icon if possible?
  // Or maybe the 'isOffline' calc was buggy?
  // Actually, let's strictly follow the rule:
  // Offline = Gray + WifiOff Icon
  // Online = Color + Initials
  // Hover should NOT change this state.
  
  const markerColor = isOffline ? '#64748b' : (isLowBattery ? '#ef4444' : userColor);

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
        {/* Status Ring - Adjusted Opacity */}
        <div 
          className="absolute -inset-3 rounded-full opacity-30 animate-ping"
          style={{ backgroundColor: markerColor, display: isOffline ? 'none' : 'block' }} 
        />
        
        {/* Main Marker - Shows Initials for Identity or Icon for Offline */}
        <div 
          className="w-10 h-10 rounded-full shadow-xl border-[3px] border-white flex items-center justify-center text-white font-bold backdrop-blur-sm transition-colors duration-300"
          style={{ backgroundColor: markerColor }}
        >
          {isOffline ? (
            <WifiOff size={18} />
          ) : (
            <span className="text-xs tracking-tighter drop-shadow-md">{userInitials}</span>
          )}
        </div>

        {/* Mini Battery Indicator - Enhanced Visibility */}
        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 border-2 border-gray-100 shadow-md">
           <div 
             className={`w-2 h-2 rounded-full ${packet.battery < 20 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} 
           />
        </div>

        {/* Hover Label - Shows Full Name (Always visible if isHovered is true) */}
        {isHovered && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap z-50 border border-slate-700 animate-in fade-in zoom-in-95 duration-200">
              {packet.user_id}
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
          closeButton={false} // Custom close button used instead
          closeOnClick={false}
          className="z-50 tracker-popup" // Added class for custom styling if needed
          maxWidth="300px" // Slightly reduced for mobile optimization
        >
          <div className="p-0 w-[260px] sm:w-[280px] overflow-hidden rounded-lg"> {/* Responsive width: 260px on mobile, 280px on desktop */}
            <div className="p-3 sm:p-4 bg-white"> {/* Reduced padding on mobile */}
                {/* Header with Close Button */}
                <div className="flex items-start justify-between mb-3 border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2.5 sm:gap-3">
                    <div 
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white text-base sm:text-lg font-bold shadow-md ring-2 ring-white shrink-0" 
                        style={{ backgroundColor: stringToColor(selectedTracker.latestPacket.user_id) }}
                    >
                        {getInitials(selectedTracker.latestPacket.user_id)}
                    </div>
                    <div className="flex flex-col min-w-0"> {/* min-w-0 for truncation */}
                        <h3 className="font-bold text-gray-900 text-base sm:text-lg leading-none truncate pr-2">{selectedTracker.latestPacket.user_id}</h3>
                        <div className="flex items-center gap-1.5 mt-1 sm:mt-1.5">
                            <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 ${selectedTracker.isOffline ? 'bg-slate-400' : 'bg-green-500 animate-pulse'}`}></span>
                            <span className="text-[9px] sm:text-[10px] font-bold text-gray-500 uppercase tracking-widest truncate">
                                {selectedTracker.isOffline ? 'OFFLINE' : 'LIVE TRACKING'}
                            </span>
                        </div>
                    </div>
                </div>
                
                {/* Professional Close Button */}
                <button 
                    onClick={() => selectTracker(null)}
                    className="cursor-pointer text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-1 rounded-full transition-colors -mt-1 -mr-1 shrink-0"
                    title="Close"
                >
                    <X size={16} />
                </button>
                </div>
                
                <div className="space-y-3 sm:space-y-4">
                {/* Coordinates Section */}
                <div className="bg-slate-50 p-2.5 sm:p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2 text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                        <MapPin size={10} className="text-slate-400 sm:w-3 sm:h-3" /> COORDINATES
                    </div>
                    <div className="font-mono text-xs sm:text-sm font-medium text-slate-700 leading-relaxed break-all"> {/* break-all ensures long coords wrap */}
                        <div>{toDMS(selectedTracker.latestPacket.lat, true)}</div>
                        <div>{toDMS(selectedTracker.latestPacket.lng, false)}</div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div className="flex flex-col">
                        <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5"><Mountain size={12} className="sm:w-[14px] sm:h-[14px]"/> ELEVATION</span>
                        <div className="flex items-baseline gap-1">
                            <span className="font-bold text-gray-900 text-lg sm:text-xl">
                                {terrainElevation !== null ? terrainElevation.toFixed(0) : (selectedTracker.latestPacket.alt?.toFixed(0) || '-')}
                            </span>
                            <span className="text-[10px] sm:text-xs font-medium text-gray-500">mdpl</span>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5"><Signal size={12} className="sm:w-[14px] sm:h-[14px]"/> SPEED</span>
                        <div className="flex items-baseline gap-1">
                            <span className="font-bold text-gray-900 text-lg sm:text-xl">{selectedTracker.latestPacket.speed?.toFixed(1) || 0}</span>
                            <span className="text-[10px] sm:text-xs font-medium text-gray-500">km/h</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-500">
                        <Battery size={14} className="text-gray-400 sm:w-4 sm:h-4"/> Battery Level
                    </div>
                    <span className={`font-bold text-xs sm:text-sm ${selectedTracker.latestPacket.battery < 20 ? 'text-red-600' : 'text-green-600'}`}>
                    {selectedTracker.latestPacket.battery}%
                    </span>
                </div>

                <div className="border-t border-gray-100 pt-2.5 sm:pt-3 flex justify-between items-start text-[10px] sm:text-xs text-gray-400">
                    <span>Last update</span>
                    <span className="font-mono text-right flex flex-col items-end">
                      <span className="text-gray-600 font-medium">
                        {new Date(selectedTracker.latestPacket.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\./g, ':')} WIB
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5">
                        {new Date(selectedTracker.latestPacket.timestamp).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
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
