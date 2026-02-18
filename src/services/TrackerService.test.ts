import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTrackerService } from './TrackerService';
import { useTrackerStore } from '../store/useTrackerStore';
import { useSurveyStore } from '../store/useSurveyStore';
import { supabase } from '../lib/supabaseClient';

// Mock Stores
vi.mock('../store/useTrackerStore');
vi.mock('../store/useSurveyStore');

// Mock Supabase
vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}));

describe('useTrackerService', () => {
  let mockChannel: any;
  let mockAddOrUpdateTracker: any;
  let mockSetConnectionStatus: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup Store Mocks
    mockAddOrUpdateTracker = vi.fn();
    mockSetConnectionStatus = vi.fn();

    (useTrackerStore as any).mockImplementation((selector: any) => {
        // Mock selectors
        const state = {
            addOrUpdateTracker: mockAddOrUpdateTracker,
            isLiveTrackingEnabled: true, // Default enabled for test
            isSimulationEnabled: false,
            isLocalBroadcastEnabled: false,
            setConnectionStatus: mockSetConnectionStatus,
        };
        return selector(state);
    });

    (useSurveyStore as any).mockReturnValue({
        user: { id: 'test-user', email: 'test@example.com' },
        userRole: 'monitor360',
        subscriptionStatus: 'Enterprise'
    });

    // Setup Supabase Mock
    mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn((cb) => {
            cb('SUBSCRIBED');
            return mockChannel;
        }),
        send: vi.fn().mockResolvedValue('ok'),
        state: 'joined'
    };
    (supabase.channel as any).mockReturnValue(mockChannel);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should connect to supabase channel when enabled', () => {
    renderHook(() => useTrackerService());

    expect(supabase.channel).toHaveBeenCalledWith('tracking-room', expect.any(Object));
    expect(mockSetConnectionStatus).toHaveBeenCalledWith('connecting');
    expect(mockChannel.subscribe).toHaveBeenCalled();
    // Since mock calls back immediately
    expect(mockSetConnectionStatus).toHaveBeenCalledWith('connected');
  });

  it('should subscribe to location-update if Monitor + Enterprise', () => {
    (useSurveyStore as any).mockReturnValue({
        user: { id: 'monitor', email: 'monitor@app.com' },
        userRole: 'monitor360',
        subscriptionStatus: 'Enterprise'
    });

    renderHook(() => useTrackerService());

    expect(mockChannel.on).toHaveBeenCalledWith(
        'broadcast',
        { event: 'location-update' },
        expect.any(Function)
    );
  });

  it('should NOT subscribe to location-update if Monitor but NOT Enterprise', () => {
    (useSurveyStore as any).mockReturnValue({
        user: { id: 'monitor', email: 'monitor@app.com' },
        userRole: 'monitor360',
        subscriptionStatus: 'Pro' // Not Enterprise
    });

    renderHook(() => useTrackerService());

    // Should not call .on for location-update (except for heartbeat maybe, but main logic is guarded)
    // Actually, the code calls .on for 'heartbeat-request' unconditionally, but 'location-update' is conditional.
    // Let's check the specific call arguments.
    
    const calls = mockChannel.on.mock.calls;
    const locationUpdateCall = calls.find((call: any[]) => call[1]?.event === 'location-update');
    
    expect(locationUpdateCall).toBeUndefined();
  });

  it('should send heartbeat request if Monitor + Enterprise', () => {
    (useSurveyStore as any).mockReturnValue({
        user: { id: 'monitor', email: 'monitor@app.com' },
        userRole: 'monitor360',
        subscriptionStatus: 'Enterprise'
    });

    // Mock setInterval
    vi.useFakeTimers();

    renderHook(() => useTrackerService());

    // Initial heartbeat
    expect(mockChannel.send).toHaveBeenCalledWith(expect.objectContaining({
        event: 'heartbeat-request'
    }));

    vi.useRealTimers();
  });

  it('should cleanup channel on unmount', () => {
    const { unmount } = renderHook(() => useTrackerService());
    unmount();
    
    expect(supabase.removeChannel).toHaveBeenCalled();
    expect(mockSetConnectionStatus).toHaveBeenCalledWith('disconnected');
  });
});
