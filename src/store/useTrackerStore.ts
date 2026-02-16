import { create } from 'zustand';
import { TRACKER_CONFIG } from '../types/tracker';
import type { TrackerPacket, TrackerState } from '../types/tracker';

interface TrackerStore {
  trackers: Record<string, TrackerState>;
  addOrUpdateTracker: (packet: TrackerPacket) => void;
  removeTracker: (userId: string) => void;
  clearAll: () => void;
  selectedTrackerId: string | null;
  selectTracker: (userId: string | null) => void;
  isLiveTrackingEnabled: boolean;
  toggleLiveTracking: () => void;
  isSimulationEnabled: boolean;
  toggleSimulation: () => void;
}

export const useTrackerStore = create<TrackerStore>((set) => ({
  trackers: {},
  selectedTrackerId: null,
  isLiveTrackingEnabled: false,
  isSimulationEnabled: false, // Default to false so user must toggle it

  addOrUpdateTracker: (packet) => {
    set((state) => {
      const now = Date.now();
      const userId = packet.user_id;
      const existing = state.trackers[userId];

      let history = existing ? [...existing.history] : [];
      
      // Add new point to history
      history.push({
        lat: packet.lat,
        lng: packet.lng,
        timestamp: packet.timestamp
      });

      // Maintain buffer limit
      if (history.length > TRACKER_CONFIG.MAX_HISTORY_POINTS) {
        history = history.slice(-TRACKER_CONFIG.MAX_HISTORY_POINTS);
      }

      return {
        trackers: {
          ...state.trackers,
          [userId]: {
            latestPacket: packet,
            history,
            lastUpdate: now,
            isOffline: false,
          }
        }
      };
    });
  },

  removeTracker: (userId) => {
    set((state) => {
      const { [userId]: _, ...rest } = state.trackers;
      return { trackers: rest };
    });
  },

  clearAll: () => set({ trackers: {} }),

  selectTracker: (userId) => set({ selectedTrackerId: userId }),

  toggleLiveTracking: () => set((state) => ({ isLiveTrackingEnabled: !state.isLiveTrackingEnabled })),
  toggleSimulation: () => set((state) => ({ isSimulationEnabled: !state.isSimulationEnabled })),
}));
