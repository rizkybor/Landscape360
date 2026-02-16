import { useEffect, useState, useRef, useMemo, memo } from 'react';
import { Marker, Popup, Source, Layer } from 'react-map-gl/mapbox';
import { useTrackerStore } from '../store/useTrackerStore';
import { useTrackerService } from '../services/TrackerService';
import { TRACKER_CONFIG } from '../types/tracker';
import type { TrackerPacket } from '../types/tracker';
import { Navigation2, Battery, Signal, WifiOff } from 'lucide-react';
import type { LineLayer } from 'mapbox-gl';

// --- HELPER: Interpolated Marker for Smooth Movement ---
const InterpolatedMarker = memo(({ packet, onClick }: { packet: TrackerPacket; onClick: () => void }) => {
  const [position, setPosition] = useState({ lat: packet.lat, lng: packet.lng });
  const requestRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const startPosRef = useRef({ lat: packet.lat, lng: packet.lng });
  const targetPosRef = useRef({ lat: packet.lat, lng: packet.lng });

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
  const isOffline = (Date.now() - new Date(packet.timestamp).getTime()) > TRACKER_CONFIG.OFFLINE_THRESHOLD_MS;
  const markerColor = isOffline ? '#9ca3af' : (isLowBattery ? '#ef4444' : '#22c55e');

  return (
    <Marker
      longitude={position.lng}
      latitude={position.lat}
      anchor="center"
      onClick={(e) => {
        e.originalEvent.stopPropagation();
        onClick();
      }}
      style={{ cursor: 'pointer', zIndex: 10 }} // Ensure clickable
    >
      <div className="relative group transition-transform duration-300 hover:scale-110">
        {/* Status Ring */}
        <div 
          className="absolute -inset-2 rounded-full opacity-20 animate-ping"
          style={{ backgroundColor: markerColor, display: isOffline ? 'none' : 'block' }} 
        />
        
        {/* Main Icon */}
        <div 
          className="w-8 h-8 rounded-full shadow-lg border-2 border-white flex items-center justify-center text-white text-[10px] font-bold"
          style={{ backgroundColor: markerColor }}
        >
          {isOffline ? <WifiOff size={14} /> : <Navigation2 size={14} className="transform -rotate-45" />}
        </div>

        {/* Mini Battery Indicator */}
        <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5 border border-gray-200 shadow-sm">
           <div 
             className={`w-1.5 h-1.5 rounded-full ${packet.battery < 20 ? 'bg-red-500' : 'bg-green-500'}`} 
           />
        </div>

        {/* Hover Label */}
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
          {packet.user_id}
        </div>
      </div>
    </Marker>
  );
});

export const LiveTrackerLayer = () => {
  const { trackers, selectedTrackerId, selectTracker, isLiveTrackingEnabled } = useTrackerStore();
  
  // Initialize Service (Start Simulation/Connection)
  useTrackerService();

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
          color: t.latestPacket.user_id === selectedTrackerId ? '#3b82f6' : '#9ca3af',
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
          closeButton={true}
          closeOnClick={false}
          className="z-50"
        >
          <div className="p-2 min-w-[200px]">
            <div className="flex items-center justify-between mb-2 border-b pb-2">
              <h3 className="font-bold text-gray-900">{selectedTracker.latestPacket.user_id}</h3>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${selectedTracker.isOffline ? 'bg-gray-100 text-gray-500' : 'bg-green-100 text-green-700'}`}>
                {selectedTracker.isOffline ? 'OFFLINE' : 'ACTIVE'}
              </span>
            </div>
            
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1"><Battery size={14}/> Battery</span>
                <span className={`font-mono font-bold ${selectedTracker.latestPacket.battery < 20 ? 'text-red-600' : 'text-gray-900'}`}>
                  {selectedTracker.latestPacket.battery}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1"><Signal size={14}/> Speed</span>
                <span className="font-mono">{selectedTracker.latestPacket.speed?.toFixed(1) || 0} km/h</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1"><Navigation2 size={14}/> Alt</span>
                <span className="font-mono">{selectedTracker.latestPacket.alt?.toFixed(0) || '-'} m</span>
              </div>
              <div className="text-xs text-gray-400 mt-2 pt-1 border-t">
                Last update: {new Date(selectedTracker.latestPacket.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </Popup>
      )}
    </>
  );
};
