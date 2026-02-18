import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTrackerStore } from './useTrackerStore';
import { TRACKER_CONFIG } from '../types/tracker';

describe('useTrackerStore', () => {
  beforeEach(() => {
    useTrackerStore.setState({
      trackers: {},
      selectedTrackerId: null,
      isLiveTrackingEnabled: false,
      isSimulationEnabled: false,
      isLocalBroadcastEnabled: false,
      connectionStatus: 'disconnected',
    });
    vi.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const state = useTrackerStore.getState();
    expect(state.trackers).toEqual({});
    expect(state.isLiveTrackingEnabled).toBe(false);
    expect(state.connectionStatus).toBe('disconnected');
  });

  it('should add a new tracker', () => {
    const packet = {
      user_id: 'USER-1',
      lat: -6.2,
      lng: 106.8,
      timestamp: new Date().toISOString(),
      alt: 100,
      speed: 10,
      battery: 90,
      status: 'active' as const
    };

    useTrackerStore.getState().addOrUpdateTracker(packet);

    const state = useTrackerStore.getState();
    expect(state.trackers['USER-1']).toBeDefined();
    expect(state.trackers['USER-1'].latestPacket).toEqual(packet);
    expect(state.trackers['USER-1'].history).toHaveLength(1);
  });

  it('should update an existing tracker and append history', () => {
    const packet1 = {
      user_id: 'USER-1',
      lat: -6.2,
      lng: 106.8,
      timestamp: '2023-01-01T10:00:00Z',
      alt: 100,
      speed: 10,
      battery: 90,
      status: 'active' as const
    };

    const packet2 = {
      user_id: 'USER-1',
      lat: -6.21,
      lng: 106.81,
      timestamp: '2023-01-01T10:00:05Z',
      alt: 102,
      speed: 12,
      battery: 89,
      status: 'active' as const
    };

    useTrackerStore.getState().addOrUpdateTracker(packet1);
    useTrackerStore.getState().addOrUpdateTracker(packet2);

    const state = useTrackerStore.getState();
    expect(state.trackers['USER-1'].latestPacket).toEqual(packet2);
    expect(state.trackers['USER-1'].history).toHaveLength(2);
    expect(state.trackers['USER-1'].history[0].lat).toBe(packet1.lat);
    expect(state.trackers['USER-1'].history[1].lat).toBe(packet2.lat);
  });

  it('should maintain history buffer limit', () => {
    const limit = TRACKER_CONFIG.MAX_HISTORY_POINTS;
    const userId = 'USER-TEST';

    // Add (limit + 5) points
    for (let i = 0; i < limit + 5; i++) {
      useTrackerStore.getState().addOrUpdateTracker({
        user_id: userId,
        lat: i,
        lng: i,
        timestamp: new Date().toISOString(),
        alt: 0,
        speed: 0,
        battery: 100,
        status: 'active'
      });
    }

    const state = useTrackerStore.getState();
    expect(state.trackers[userId].history).toHaveLength(limit);
    // The last point should be the most recent one (limit + 4)
    expect(state.trackers[userId].history[limit - 1].lat).toBe(limit + 4);
  });

  it('should remove a tracker', () => {
    const packet = {
      user_id: 'USER-1',
      lat: 0,
      lng: 0,
      timestamp: new Date().toISOString(),
      alt: 0,
      speed: 0,
      battery: 100,
      status: 'active' as const
    };

    useTrackerStore.getState().addOrUpdateTracker(packet);
    useTrackerStore.getState().removeTracker('USER-1');

    const state = useTrackerStore.getState();
    expect(state.trackers['USER-1']).toBeUndefined();
  });

  it('should clear all trackers', () => {
    useTrackerStore.getState().addOrUpdateTracker({
        user_id: 'U1', lat: 0, lng: 0, timestamp: '', alt: 0, speed: 0, battery: 0, status: 'active'
    });
    useTrackerStore.getState().addOrUpdateTracker({
        user_id: 'U2', lat: 0, lng: 0, timestamp: '', alt: 0, speed: 0, battery: 0, status: 'active'
    });

    useTrackerStore.getState().clearAll();

    const state = useTrackerStore.getState();
    expect(Object.keys(state.trackers)).toHaveLength(0);
  });

  it('should toggle live tracking', () => {
    const store = useTrackerStore.getState();
    expect(store.isLiveTrackingEnabled).toBe(false);

    store.toggleLiveTracking();
    expect(useTrackerStore.getState().isLiveTrackingEnabled).toBe(true);

    store.toggleLiveTracking();
    expect(useTrackerStore.getState().isLiveTrackingEnabled).toBe(false);
  });

  it('should set live tracking explicitly', () => {
    const store = useTrackerStore.getState();
    store.setLiveTracking(true);
    expect(useTrackerStore.getState().isLiveTrackingEnabled).toBe(true);
    
    store.setLiveTracking(false);
    expect(useTrackerStore.getState().isLiveTrackingEnabled).toBe(false);
  });

  it('should toggle simulation and broadcast', () => {
    const store = useTrackerStore.getState();
    
    store.toggleSimulation();
    expect(useTrackerStore.getState().isSimulationEnabled).toBe(true);

    store.toggleLocalBroadcast();
    expect(useTrackerStore.getState().isLocalBroadcastEnabled).toBe(true);
  });

  it('should set connection status', () => {
    const store = useTrackerStore.getState();
    store.setConnectionStatus('connected');
    expect(useTrackerStore.getState().connectionStatus).toBe('connected');
  });
});
