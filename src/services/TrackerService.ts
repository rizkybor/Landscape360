import { useEffect, useRef } from 'react';
import { useTrackerStore } from '../store/useTrackerStore';
import { useSurveyStore } from '../store/useSurveyStore';
import { TRACKER_CONFIG } from '../types/tracker';
import type { TrackerPacket } from '../types/tracker';
import { supabase } from '../lib/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

/* ======================================================
   ROUTE CONFIG (MULTI WAYPOINT)
====================================================== */

const ROUTE = [
  { lat: -7.60416, lng: 110.46162 }, // START
  { lat: -7.59520, lng: 110.45800 }, // belok 1
  { lat: -7.58550, lng: 110.45420 }, // belok 2
  { lat: -7.57010, lng: 110.44980 }, // belok 3
  { lat: -7.54075, lng: 110.44649 }, // FINISH
];

// 10 menit untuk START → FINISH → START
const durationMs = 10 * 60 * 1000;

/* ======================================================
   BUILD BACK & FORTH ROUTE
====================================================== */

// bikin rute pergi + pulang
const FULL_ROUTE = [
  ...ROUTE,
  ...ROUTE.slice(1, -1).reverse()
];

const TOTAL_SEGMENTS = FULL_ROUTE.length - 1;

/* ======================================================
   GENERATOR MULTI SEGMENT
====================================================== */

const generateBackAndForthPacket = (
  userId: string,
  offset: number
): TrackerPacket => {

  const now = Date.now() + offset;
  const progress = (now % durationMs) / durationMs;

  // posisi global dalam total segment
  const segmentProgress = progress * TOTAL_SEGMENTS;

  const currentSegment = Math.floor(segmentProgress);
  const localT = segmentProgress - currentSegment;

  const startPoint = FULL_ROUTE[currentSegment];
  const endPoint = FULL_ROUTE[currentSegment + 1];

  if (!startPoint || !endPoint) {
    return {
      user_id: userId,
      lat: ROUTE[0].lat,
      lng: ROUTE[0].lng,
      alt: 1400,
      speed: 0,
      battery: 100,
      timestamp: new Date().toISOString(),
      status: 'active'
    };
  }

  // Linear interpolation antar waypoint
  const lat =
    startPoint.lat + (endPoint.lat - startPoint.lat) * localT;

  const lng =
    startPoint.lng + (endPoint.lng - startPoint.lng) * localT;

  return {
    user_id: userId,
    lat,
    lng,
    alt: 1400 + progress * 400,
    speed: 1.2 + Math.random() * 0.5,
    battery: 100 - Math.floor(progress * 30),
    timestamp: new Date().toISOString(),
    status: 'active'
  };
};



/* ======================================================
   HOOK
====================================================== */

export const useTrackerService = () => {
  const addOrUpdateTracker = useTrackerStore(s => s.addOrUpdateTracker);
  const isLiveTrackingEnabled = useTrackerStore(s => s.isLiveTrackingEnabled);
  const isSimulationEnabled = useTrackerStore(s => s.isSimulationEnabled);
  const isLocalBroadcastEnabled = useTrackerStore(s => s.isLocalBroadcastEnabled);
  const setConnectionStatus = useTrackerStore(s => s.setConnectionStatus);

  const { user, userRole, subscriptionStatus } = useSurveyStore();

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastBroadcastRef = useRef<number>(0);
  const latestPacketRef = useRef<TrackerPacket | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {

    /* ==============================
       DISCONNECT CLEANUP
    ============================== */

    if (!isLiveTrackingEnabled) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setConnectionStatus('disconnected');
      }
      return;
    }

    /* ==============================
       SUPABASE REALTIME
    ============================== */

    if (!channelRef.current) {
      setConnectionStatus('connecting');

      const channel = supabase.channel('tracking-room', {
        config: { broadcast: { self: false } }
      });

      // Monitor Mode
      if (userRole === 'monitor360' && subscriptionStatus === 'Enterprise') {
        channel.on(
          'broadcast',
          { event: 'location-update' },
          (payload) => {
            if (payload.payload) {
              const packet = payload.payload as TrackerPacket;
              const myTrackerId =
                user?.email?.split('@')[0].toUpperCase() ||
                user?.id.slice(0, 8).toUpperCase();

              if (packet.user_id !== myTrackerId) {
                addOrUpdateTracker(packet);
              }
            }
          }
        );
      }

      // Heartbeat Response
      channel.on(
        'broadcast',
        { event: 'heartbeat-request' },
        () => {
          if (isLocalBroadcastEnabled && user && latestPacketRef.current) {
            channel.send({
              type: 'broadcast',
              event: 'location-update',
              payload: latestPacketRef.current
            });
          }
        }
      );

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('error');
        }
      });

      channelRef.current = channel;
    }

    /* ==============================
       SIMULATION MODE
    ============================== */

    if (isSimulationEnabled) {

      const mockUsers = [
        { id: 'RANGER-01' },
        { id: 'CLIMBER-A' },
        { id: 'CLIMBER-B' },
        { id: 'RESCUE-01' },
        { id: 'LOGISTIC' },
      ];

      // Initial Render
      mockUsers.forEach((user, idx) => {
        const packet = generateBackAndForthPacket(user.id, idx * 20000);
        addOrUpdateTracker(packet);
      });

      intervalRef.current = setInterval(() => {
        mockUsers.forEach((user, idx) => {
          const packet = generateBackAndForthPacket(user.id, idx * 20000);
          addOrUpdateTracker(packet);
        });
      }, TRACKER_CONFIG.UPDATE_INTERVAL_MS);

    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    /* ==============================
       LOCAL GPS BROADCAST
    ============================== */

    if (isLocalBroadcastEnabled && navigator.geolocation && user) {

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {

          const { latitude, longitude, altitude, speed } = position.coords;

          const trackerId =
            user.email?.split('@')[0] ||
            user.id.slice(0, 8);

          const myPacket: TrackerPacket = {
            user_id: trackerId.toUpperCase(),
            lat: latitude,
            lng: longitude,
            alt: altitude || 0,
            speed: speed || 0,
            battery: 100,
            timestamp: new Date().toISOString(),
            status: 'active'
          };

          addOrUpdateTracker(myPacket);
          latestPacketRef.current = myPacket;

          const now = Date.now();

          if (channelRef.current && now - lastBroadcastRef.current > 3000) {
            channelRef.current.send({
              type: 'broadcast',
              event: 'location-update',
              payload: myPacket
            });
            lastBroadcastRef.current = now;
          }

        },
        (error) => {
          console.warn("GPS Error", error);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
    }

    /* ==============================
       CLEANUP
    ============================== */

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setConnectionStatus('disconnected');
      }
    };

  }, [
    isLiveTrackingEnabled,
    isSimulationEnabled,
    isLocalBroadcastEnabled,
    addOrUpdateTracker,
    user,
    userRole,
    setConnectionStatus,
    subscriptionStatus
  ]);
};
