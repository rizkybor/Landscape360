import { useEffect, useRef } from 'react';
import { useTrackerStore } from '../store/useTrackerStore';
import { TRACKER_CONFIG } from '../types/tracker';
import type { TrackerPacket } from '../types/tracker';

// Mock Data Generator for Simulation
const generateMockPacket = (userId: string, baseLat: number, baseLng: number, timeOffset: number): TrackerPacket => {
  const now = Date.now();
  const angle = (now / 10000) + timeOffset; // Circular movement
  const radius = 0.005; // ~500m radius
  
  return {
    user_id: userId,
    lat: baseLat + Math.sin(angle) * radius,
    lng: baseLng + Math.cos(angle) * radius,
    alt: 1500 + Math.random() * 50,
    speed: 1.2 + Math.random() * 0.5,
    battery: Math.max(0, 100 - Math.floor((now % 3600000) / 36000)), // Drain over an hour
    timestamp: new Date().toISOString(),
    status: 'active'
  };
};

export const useTrackerService = () => {
  const addOrUpdateTracker = useTrackerStore(s => s.addOrUpdateTracker);
  const isLiveTrackingEnabled = useTrackerStore(s => s.isLiveTrackingEnabled);
  const isSimulationEnabled = useTrackerStore(s => s.isSimulationEnabled);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // SIMULATE WEBSOCKET CONNECTION
  useEffect(() => {
    if (!isLiveTrackingEnabled) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // In a real app, this would be:
    // const ws = new WebSocket('wss://api.landscape360.com/trackers');
    // ws.onmessage = (event) => { const packet = JSON.parse(event.data); addOrUpdateTracker(packet); };

    // MOCK SIMULATION: Generate updates for 5 users
    // Only run if Simulation Mode is enabled
    if (isSimulationEnabled) {
      const mockUsers = [
        { id: 'RANGER-01', baseLat: -7.565, baseLng: 110.455 },
        { id: 'CLIMBER-A', baseLat: -7.562, baseLng: 110.458 },
        { id: 'CLIMBER-B', baseLat: -7.568, baseLng: 110.452 },
        { id: 'RESCUE-01', baseLat: -7.564, baseLng: 110.460 },
        { id: 'LOGISTIC', baseLat: -7.566, baseLng: 110.450 },
      ];

      console.log("Tracker Service: Connected to Mock LoRa Gateway...");

      // Initial data push so we don't wait for the first interval
      mockUsers.forEach((user, idx) => {
        const packet = generateMockPacket(user.id, user.baseLat, user.baseLng, idx);
        addOrUpdateTracker(packet);
      });

      intervalRef.current = setInterval(() => {
        mockUsers.forEach((user, idx) => {
          // Simulate packet arrival with slight jitter
          setTimeout(() => {
            const packet = generateMockPacket(user.id, user.baseLat, user.baseLng, idx);
            addOrUpdateTracker(packet);
          }, Math.random() * 1000);
        });
      }, TRACKER_CONFIG.UPDATE_INTERVAL_MS);
    } else {
      console.log("Tracker Service: Simulation Paused (Waiting for Real Data...)");
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isLiveTrackingEnabled, isSimulationEnabled, addOrUpdateTracker]);
};
