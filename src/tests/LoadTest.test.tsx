
import { describe, it, expect } from 'vitest';
import { useTrackerStore } from '../store/useTrackerStore';
import { act } from '@testing-library/react';

describe('Load Test: 200+ Simultaneous Users', () => {
  it('should handle adding 200+ trackers to the store without crashing', () => {
    const store = useTrackerStore.getState();
    const trackerCount = 250; // Simulate 250 users

    // Simulate adding 250 users
    act(() => {
      for (let i = 0; i < trackerCount; i++) {
        store.addOrUpdateTracker({
          user_id: `user-${i}`,
          lat: -6.200000 + (Math.random() * 0.1),
          lng: 106.816666 + (Math.random() * 0.1),
          timestamp: Date.now(),
          altitude: 100,
          speed: 10,
          heading: 0,
          battery: 100,
          accuracy: 5
        });
      }
    });

    // Verify store state
    const updatedState = useTrackerStore.getState();
    expect(Object.keys(updatedState.trackers).length).toBe(trackerCount);
    expect(updatedState.trackers['user-0']).toBeDefined();
    expect(updatedState.trackers['user-249']).toBeDefined();
  });

  it('should handle updates for existing users correctly (Performance Check)', () => {
    const store = useTrackerStore.getState();
    const trackerCount = 200;
    
    // Initialize
    act(() => {
        store.clearAll();
        for (let i = 0; i < trackerCount; i++) {
            store.addOrUpdateTracker({
                user_id: `user-${i}`,
                lat: 0,
                lng: 0,
                timestamp: Date.now()
            });
        }
    });

    // Measure update time for batch update
    const start = performance.now();
    
    act(() => {
        // Update all 200 users positions
        for (let i = 0; i < trackerCount; i++) {
            store.addOrUpdateTracker({
                user_id: `user-${i}`,
                lat: 1,
                lng: 1,
                timestamp: Date.now() + 1000
            });
        }
    });

    const end = performance.now();
    const duration = end - start;

    // Verify updates
    const state = useTrackerStore.getState();
    expect(state.trackers['user-0'].latestPacket.lat).toBe(1);
    expect(Object.keys(state.trackers).length).toBe(trackerCount);

    console.log(`Time to update ${trackerCount} trackers: ${duration.toFixed(2)}ms`);
    
    // Ensure it's reasonably fast (e.g., under 100ms for state updates is good for 200 items, though React rendering is separate)
    // Pure store update should be very fast
    expect(duration).toBeLessThan(500); 
  });
});
