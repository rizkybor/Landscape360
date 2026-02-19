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
  const lastDbLogRef = useRef<number>(0); // NEW: Separate throttle for DB logging
  const latestPacketRef = useRef<TrackerPacket | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- SMART RECONNECT: OFFLINE BUFFER HANDLING ---
  const flushBuffer = async () => {
      if (!navigator.onLine) return;
      
      const bufferStr = localStorage.getItem('TRACKER_OFFLINE_BUFFER');
      if (!bufferStr) return;

      try {
        const buffer = JSON.parse(bufferStr);
        if (!Array.isArray(buffer) || buffer.length === 0) {
            localStorage.removeItem('TRACKER_OFFLINE_BUFFER');
            return;
        }

        console.log(`Smart Reconnect: Flushing ${buffer.length} buffered logs...`);
        
        // Insert in batches if needed, but Supabase handles small batches fine
        const { error } = await supabase.from('tracker_logs').insert(buffer);
        
        if (!error) {
          console.log("Offline buffer flushed successfully.");
          localStorage.removeItem('TRACKER_OFFLINE_BUFFER');
        } else {
          console.error("Failed to flush offline buffer:", error);
        }
      } catch (e) {
        console.error("Error processing offline buffer:", e);
      }
  };

  // Listen for online status to trigger flush
  useEffect(() => {
    const handleOnline = () => {
        console.log("Network Online: Triggering buffer flush...");
        flushBuffer();
    };

    window.addEventListener('online', handleOnline);
    
    // Initial check on mount
    if (navigator.onLine) flushBuffer();

    return () => window.removeEventListener('online', handleOnline);
  }, []);

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

      // Create new channel (or rejoin)
      // Note: We might want to use a unique channel per user-group in production, but 'tracking-room' is fine for demo.
      const channel = supabase.channel('tracking-room', {
        config: { broadcast: { self: false } }
      });

      // Monitor Mode: Listen for updates
      // Allow monitor to listen if they are 'monitor360' OR 'Enterprise' (Relaxed check)
      if (userRole === 'monitor360' || subscriptionStatus === 'Enterprise') {
        channel.on(
          'broadcast',
          { event: 'location-update' },
          (payload) => {
            if (payload.payload) {
              const packet = payload.payload as TrackerPacket;
              const myTrackerId =
                user?.email?.split('@')[0].toUpperCase() ||
                user?.id.slice(0, 8).toUpperCase();

              // Prevent self-update echo
              if (packet.user_id !== myTrackerId) {
                addOrUpdateTracker(packet);
              }
            }
          }
        );
      }

      // Heartbeat Response (Broadcasters respond to this)
      channel.on(
        'broadcast',
        { event: 'heartbeat-request' },
        () => {
          if (isLocalBroadcastEnabled && user && latestPacketRef.current) {
            console.log("Received Heartbeat Request - Sending Location Immediately");
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
          
          // If I am a Monitor, ask everyone to report immediately
          if (userRole === 'monitor360' || subscriptionStatus === 'Enterprise') {
              console.log("Monitor Joined - Requesting Heartbeat...");
              channel.send({
                  type: 'broadcast',
                  event: 'heartbeat-request',
                  payload: {}
              });
          }

        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('error');
        }
      });

      channelRef.current = channel;
    } else {
        // Channel already exists, but check if we need to re-subscribe due to role change?
        // Actually, the useEffect cleanup handles channel destruction on dependency change.
        // So if we are here, it means channelRef.current is TRULY missing (first run).
        // BUT, wait! If useEffect re-runs, cleanup runs first, setting channelRef.current = null.
        // So we are safe. The logic above "if (!channelRef.current)" will execute correctly on re-run.
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
      console.log("Starting Local GPS Broadcast..."); // Debug Log

      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          console.log("GPS Position Received:", position.coords); // Debug Log

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
            battery: 100, // In a real app, use navigator.getBattery() if available
            timestamp: new Date().toISOString(),
            status: 'active'
          };

          addOrUpdateTracker(myPacket);
          latestPacketRef.current = myPacket;

          // --- LOGGING TO DATABASE ---
          // Save every 10 seconds to avoid flooding database, BUT only if moved > 100 meters
          // IMPORTANT: Check if user exists
          const isAccuracyGood = position.coords.accuracy < 1000;
          const isTimeThresholdMet = (Date.now() - lastDbLogRef.current > 10000); // 10s for testing
          
          // Distance Check Optimization (Lightweight)
          // Haversine formula approximation or simple Euclidean for short distances
          // 1 degree lat approx 111km. 0.00001 deg approx 1.1m.
          // 100 meters approx 0.0009 deg difference.
          const lastLogPos = (window as any)._lastLogPos || { lat: 0, lng: 0 };
          const distLat = Math.abs(latitude - lastLogPos.lat);
          const distLng = Math.abs(longitude - lastLogPos.lng);
          const hasMoved = (distLat > 0.0009 || distLng > 0.0009); // Approx 100 meters

          if (user && isAccuracyGood && isTimeThresholdMet && hasMoved) {
             const logData = {
                user_id: user.id,
                lat: latitude,
                lng: longitude,
                elevation: altitude,
                speed: speed,
                battery: 100, 
                timestamp: myPacket.timestamp
             };

             // 1. If Offline, Buffer Immediately
             if (!navigator.onLine) {
                 console.log("Device Offline: Buffering GPS log locally...");
                 const buffer = JSON.parse(localStorage.getItem('TRACKER_OFFLINE_BUFFER') || '[]');
                 buffer.push(logData);
                 // Limit buffer size to prevent storage issues (e.g. 1000 points)
                 if (buffer.length > 1000) buffer.shift(); 
                 localStorage.setItem('TRACKER_OFFLINE_BUFFER', JSON.stringify(buffer));
                 
                 // Update local refs to prevent duplicate buffering of same point
                 (window as any)._lastLogPos = { lat: latitude, lng: longitude };
                 lastDbLogRef.current = Date.now();
                 return;
             }

             console.log("Attempting to log GPS to DB (Moved > 100m)...", { lat: latitude, lng: longitude }); 
             
             supabase.from('tracker_logs').insert(logData).then(({ error }) => {
                if (error) {
                    console.error("Failed to log GPS to DB, buffering locally:", error);
                    // 2. Buffer on API Error
                    const buffer = JSON.parse(localStorage.getItem('TRACKER_OFFLINE_BUFFER') || '[]');
                    buffer.push(logData);
                    if (buffer.length > 1000) buffer.shift();
                    localStorage.setItem('TRACKER_OFFLINE_BUFFER', JSON.stringify(buffer));
                } else {
                    console.log("GPS Logged to DB:", myPacket.timestamp);
                    // Update last log position and time only on success
                    (window as any)._lastLogPos = { lat: latitude, lng: longitude };
                    lastDbLogRef.current = Date.now();

                    // 3. Piggyback Flush: If success, check if we have other logs to flush
                    flushBuffer();
                }
             });
          }

          const now = Date.now();

          // Realtime Broadcast (Every 3s)
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
          // Retry with lower accuracy if needed or notify user
          if (error.code === 1) {
              alert("GPS Permission Denied. Please enable location access.");
          } else if (error.code === 3) {
              console.log("GPS Timeout - Retrying...");
          }
        },
        // Relaxed options for better stability
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
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
