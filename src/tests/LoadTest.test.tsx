import { describe, it, expect, beforeEach } from 'vitest';
import { useTrackerStore } from '../store/useTrackerStore';
import type { TrackerPacket } from '../types/tracker';

describe('Tracker Store Load Test', () => {
  beforeEach(() => {
    useTrackerStore.getState().clearAll();
  });

  it('should handle more than 200 users', () => {
    const store = useTrackerStore.getState();
    const USER_COUNT = 250;
    const startTime = performance.now();

    // 1. Inject 250 users
    for (let i = 0; i < USER_COUNT; i++) {
      const packet: TrackerPacket = {
        user_id: `USER-${i}`,
        lat: -7.60 + (Math.random() * 0.1),
        lng: 110.46 + (Math.random() * 0.1),
        alt: 100,
        speed: 5,
        battery: 80,
        timestamp: new Date().toISOString(),
        status: 'active'
      };
      store.addOrUpdateTracker(packet);
    }

    const injectionTime = performance.now() - startTime;
    console.log(`Time to inject ${USER_COUNT} users: ${injectionTime.toFixed(2)}ms`);

    // 2. Verify count
    const trackers = useTrackerStore.getState().trackers;
    expect(Object.keys(trackers).length).toBe(USER_COUNT);

    // 3. Update all users (Simulation cycle)
    const updateStartTime = performance.now();
    for (let i = 0; i < USER_COUNT; i++) {
        const packet: TrackerPacket = {
            user_id: `USER-${i}`,
            lat: -7.60 + (Math.random() * 0.1),
            lng: 110.46 + (Math.random() * 0.1),
            alt: 100,
            speed: 5,
            battery: 79,
            timestamp: new Date().toISOString(),
            status: 'active'
        };
        store.addOrUpdateTracker(packet);
    }
    const updateTime = performance.now() - updateStartTime;
    console.log(`Time to update ${USER_COUNT} users: ${updateTime.toFixed(2)}ms`);

    // Ensure it's reasonably fast (e.g., < 100ms for 250 updates is acceptable for JS execution, though React rendering is separate)
    expect(updateTime).toBeLessThan(500); 
  });
});
