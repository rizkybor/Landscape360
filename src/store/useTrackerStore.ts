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
  isTrackingListsOpen: boolean;
  setTrackingListsOpen: (open: boolean) => void;
  toggleTrackingLists: () => void;

  isActivityRecording: boolean;
  activitySessionId: string | null;
  activityStartedAt: number | null;
  activityEndedAt: number | null;
  activityDistanceM: number;
  activityPointCount: number;
  startActivity: () => { sessionId: string; startedAt: number };
  stopActivity: () => void;
  clearActivity: () => void;
  setActivityStats: (distanceM: number, pointCount: number) => void;
  hydrateActivity: () => void;
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
  isTrackingListsOpen: false,
  isActivityRecording: false,
  activitySessionId: null,
  activityStartedAt: null,
  activityEndedAt: null,
  activityDistanceM: 0,
  activityPointCount: 0,

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

  toggleLiveTracking: () =>
    set((state) => {
      const next = !state.isLiveTrackingEnabled;
      if (next) return { isLiveTrackingEnabled: true };

      if (state.isActivityRecording) {
        return { isLiveTrackingEnabled: false, isTrackingListsOpen: false };
      }

      return {
        isLiveTrackingEnabled: false,
        isTrackingListsOpen: false,
        isLocalBroadcastEnabled: false,
        isSimulationEnabled: false,
      };
    }),
  setLiveTracking: (enabled) =>
    set((state) => {
      if (enabled) return { isLiveTrackingEnabled: true };

      if (state.isActivityRecording) {
        return { isLiveTrackingEnabled: false, isTrackingListsOpen: false };
      }

      return {
        isLiveTrackingEnabled: false,
        isTrackingListsOpen: false,
        isLocalBroadcastEnabled: false,
        isSimulationEnabled: false,
      };
    }),
  toggleSimulation: () => set((state) => ({ isSimulationEnabled: !state.isSimulationEnabled })),
  toggleLocalBroadcast: () => set((state) => ({ isLocalBroadcastEnabled: !state.isLocalBroadcastEnabled })),
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setViewingSession: (packets) => set({ viewingSession: packets, isSessionVisible: true }),
  setSessionVisible: (visible) => set({ isSessionVisible: visible }),
  setTrackingListsOpen: (open) => set({ isTrackingListsOpen: open }),
  toggleTrackingLists: () => set((state) => ({ isTrackingListsOpen: !state.isTrackingListsOpen })),

  startActivity: () => {
    const sessionId = crypto.randomUUID();
    const startedAt = Date.now();
    const payload = JSON.stringify({ sessionId, startedAt });
    localStorage.setItem('L360_ACTIVITY_ACTIVE', payload);
    set({
      isActivityRecording: true,
      activitySessionId: sessionId,
      activityStartedAt: startedAt,
      activityEndedAt: null,
      activityDistanceM: 0,
      activityPointCount: 0
    });
    return { sessionId, startedAt };
  },

  stopActivity: () => {
    const endedAt = Date.now();
    set((state) => {
      if (!state.activitySessionId || !state.activityStartedAt) {
        localStorage.removeItem('L360_ACTIVITY_ACTIVE');
        localStorage.removeItem('L360_ACTIVITY_PENDING_END');
        return {
          isActivityRecording: false,
          activitySessionId: null,
          activityStartedAt: null,
          activityEndedAt: null
        };
      }

      localStorage.removeItem('L360_ACTIVITY_ACTIVE');
      localStorage.setItem(
        'L360_ACTIVITY_PENDING_END',
        JSON.stringify({
          sessionId: state.activitySessionId,
          startedAt: state.activityStartedAt,
          endedAt,
          distanceM: state.activityDistanceM,
          pointCount: state.activityPointCount
        })
      );

      return {
        isActivityRecording: false,
        activityEndedAt: endedAt
      };
    });
  },

  clearActivity: () => {
    localStorage.removeItem('L360_ACTIVITY_ACTIVE');
    localStorage.removeItem('L360_ACTIVITY_PENDING_END');
    set({
      isActivityRecording: false,
      activitySessionId: null,
      activityStartedAt: null,
      activityEndedAt: null,
      activityDistanceM: 0,
      activityPointCount: 0
    });
  },

  setActivityStats: (distanceM, pointCount) => set({ activityDistanceM: distanceM, activityPointCount: pointCount }),

  hydrateActivity: () => {
    try {
      const raw = localStorage.getItem('L360_ACTIVITY_ACTIVE');
      if (raw) {
        const parsed = JSON.parse(raw) as { sessionId?: string; startedAt?: number };
        if (parsed?.sessionId && parsed?.startedAt) {
          set({
            isActivityRecording: true,
            activitySessionId: parsed.sessionId,
            activityStartedAt: parsed.startedAt,
            activityEndedAt: null
          });
        }
      }

      const pending = localStorage.getItem('L360_ACTIVITY_PENDING_END');
      if (pending) {
        const parsed = JSON.parse(pending) as {
          sessionId?: string;
          startedAt?: number;
          endedAt?: number;
          distanceM?: number;
          pointCount?: number;
        };
        if (parsed?.sessionId && parsed?.startedAt && parsed?.endedAt) {
          set({
            isActivityRecording: false,
            activitySessionId: parsed.sessionId,
            activityStartedAt: parsed.startedAt,
            activityEndedAt: parsed.endedAt,
            activityDistanceM: typeof parsed.distanceM === 'number' ? parsed.distanceM : 0,
            activityPointCount: typeof parsed.pointCount === 'number' ? parsed.pointCount : 0
          });
        }
      }
    } catch {
      localStorage.removeItem('L360_ACTIVITY_ACTIVE');
      localStorage.removeItem('L360_ACTIVITY_PENDING_END');
    }
  }
}));
