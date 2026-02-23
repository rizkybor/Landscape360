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
  setLiveTracking: (enabled: boolean) => void;
  isSimulationEnabled: boolean;
  toggleSimulation: () => void;
  isLocalBroadcastEnabled: boolean;
  toggleLocalBroadcast: () => void;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  setConnectionStatus: (status: 'disconnected' | 'connecting' | 'connected' | 'error') => void;
  
  // Session Playback
  viewingSession: TrackerPacket[] | null;
  setViewingSession: (packets: TrackerPacket[] | null) => void;
  isSessionVisible: boolean;
  setSessionVisible: (visible: boolean) => void;
}

export const useTrackerStore = create<TrackerStore>((set) => ({
  trackers: {},
  selectedTrackerId: null,
  isLiveTrackingEnabled: false,
  isSimulationEnabled: false,
  isLocalBroadcastEnabled: false,
  connectionStatus: 'disconnected',
  viewingSession: null,
  isSessionVisible: true,

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
  setLiveTracking: (enabled) => set({ isLiveTrackingEnabled: enabled }),
  toggleSimulation: () => set((state) => ({ isSimulationEnabled: !state.isSimulationEnabled })),
  toggleLocalBroadcast: () => set((state) => ({ isLocalBroadcastEnabled: !state.isLocalBroadcastEnabled })),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setViewingSession: (packets) => set({ viewingSession: packets, isSessionVisible: true }),
  setSessionVisible: (visible) => set({ isSessionVisible: visible }),
}));
