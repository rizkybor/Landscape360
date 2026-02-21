import { useEffect, useRef, useCallback } from 'react';
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
  const lastDbLogRef = useRef<number>(0);
  const latestPacketRef = useRef<TrackerPacket | null>(null);
  const lastLogPosRef = useRef<{ lat: number; lng: number } | null>(null);

  // --- HELPER: SAVE TO LOCAL BUFFER ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saveToBuffer = useCallback((logData: any) => {
    try {
        const bufferStr = localStorage.getItem('TRACKER_OFFLINE_BUFFER');
        const buffer = bufferStr ? JSON.parse(bufferStr) : [];
        
        // Check for duplicate (last item) to avoid spamming buffer
        const last = buffer[buffer.length - 1];
        if (!last || last.timestamp !== logData.timestamp) {
            buffer.push(logData);
            // Limit buffer size
            if (buffer.length > 1000) buffer.shift(); 
            localStorage.setItem('TRACKER_OFFLINE_BUFFER', JSON.stringify(buffer));
            console.log("Buffered GPS log locally. Count:", buffer.length);
        }
    } catch (e) {
        console.error("Error saving to buffer:", e);
    }
  }, []);

  // --- SMART RECONNECT: FLUSH BUFFER ---
  const flushBuffer = useCallback(async () => {
      if (!navigator.onLine) return;
      
      const bufferStr = localStorage.getItem('TRACKER_OFFLINE_BUFFER');
      if (!bufferStr) return;

      try {
        const buffer = JSON.parse(bufferStr);
        if (!Array.isArray(buffer) || buffer.length === 0) {
            localStorage.removeItem('TRACKER_OFFLINE_BUFFER');
            return;
        }

        // Deduplicate based on timestamp + user_id
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const uniqueBuffer = Array.from(new Map(buffer.map((item: any) => [item.timestamp + item.user_id, item])).values());

        console.log(`Smart Reconnect: Flushing ${uniqueBuffer.length} buffered logs...`);
        
        const { error } = await supabase.from('tracker_logs').insert(uniqueBuffer);
        
        if (!error) {
          console.log("Offline buffer flushed successfully.");
          localStorage.removeItem('TRACKER_OFFLINE_BUFFER');
        } else {
          console.error("Failed to flush offline buffer:", error);
        }
      } catch (e) {
        console.error("Error processing offline buffer:", e);
      }
  }, []);

  // --- HELPER: LOG TO DB ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const logLocationToDb = useCallback(async (packet: TrackerPacket, user: any) => {
      if (!user) return;

      const logData = {
        user_id: user.id,
        lat: packet.lat,
        lng: packet.lng,
        elevation: packet.alt,
        speed: packet.speed,
        battery: packet.battery, 
        timestamp: packet.timestamp
      };

      if (!navigator.onLine) {
          saveToBuffer(logData);
          return;
      }

      const { error } = await supabase.from('tracker_logs').insert(logData);
      
      if (error) {
          console.warn("DB Insert failed, buffering:", error);
          saveToBuffer(logData);
      } else {
          // Success: Attempt to flush any pending buffer too
          flushBuffer();
      }
  }, [saveToBuffer, flushBuffer]);

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
  }, [flushBuffer]);

  useEffect(() => {

    /* ==============================
       DISCONNECT CLEANUP
    ============================== */

    if (!isLiveTrackingEnabled) {
      if (intervalRef.current) clearInterval(intervalRef.current);
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
        config: { 
          broadcast: { self: false },
          presence: { key: user?.id || 'anon' }
        }
      });

      // Monitor Mode: Listen for updates
      // Allow monitor to listen if they are 'monitor360' AND 'Enterprise'
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
          
          // Track presence
          channel.track({
            user_id: user?.id,
            role: userRole,
            online_at: new Date().toISOString()
          });

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
          const isAccuracyGood = position.coords.accuracy < 1000;
          const isTimeThresholdMet = (Date.now() - lastDbLogRef.current > 10000); // 10s throttle
          
          // Distance Check
          const lastPos = lastLogPosRef.current || { lat: 0, lng: 0 };
          const distLat = Math.abs(latitude - lastPos.lat);
          const distLng = Math.abs(longitude - lastPos.lng);
          const hasMoved = (distLat > 0.0009 || distLng > 0.0009); // Approx 100 meters

          if (user && isAccuracyGood && isTimeThresholdMet && hasMoved) {
             // Update refs
             lastLogPosRef.current = { lat: latitude, lng: longitude };
             lastDbLogRef.current = Date.now();
             
             // Log to DB (or Buffer)
             logLocationToDb(myPacket, user);
          }

          // --- REALTIME BROADCAST ---
          const now = Date.now();
          const ch = channelRef.current;
          
          // Check if channel is ready. 'joined' state check is tricky in JS client, 
          // usually we trust the 'SUBSCRIBED' status callback we handled earlier.
          // We can also check if the socket is open.
          if (ch && now - lastBroadcastRef.current > 3000) {
            // Use display ID for broadcast if needed, or just send packet with full ID
            // Ideally we send myPacket which has user.id. 
            // The frontend receiver splits email/id for display.
            // Let's create a display-friendly packet if needed, or just send raw.
            // Existing code used trackerId (short). Let's stick to full ID for consistency 
            // but if other components expect short ID, we might break them.
            // TrackerService receiver: `packet.user_id !== myTrackerId`
            // `myTrackerId` is derived from email/short ID.
            // If we change packet.user_id to full UUID, this check might fail if not updated.
            // Let's check the receiver logic again.
            // Receiver: `const myTrackerId = user?.email?.split('@')[0].toUpperCase() || ...`
            // So if I send full UUID, `packet.user_id !== myTrackerId` will be true (which is good, it's not me).
            // BUT, the receiver ADDS it to store. The store likely uses user_id as key.
            // If I change to UUID, the UI will show UUID as name unless it maps it.
            // ControlPanel/Map uses `tracker.user_id` to display name.
            // So I should probably send the SHORT ID for `user_id` in the packet for display purposes,
            // OR update the UI to handle UUIDs and map to names.
            // Given the timeframe, I will send the SHORT ID in the broadcast packet for display compatibility,
            // but the DB log MUST use the UUID.
            
            const broadcastPacket = { ...myPacket, user_id: trackerId.toUpperCase() };

            ch.send({
              type: 'broadcast',
              event: 'location-update',
              payload: broadcastPacket
            }).catch(err => console.warn("Broadcast failed", err));
            
            lastBroadcastRef.current = now;
          }
        },
        (error) => {
          console.warn("GPS Error", error);
          if (error.code === 1) {
              // alert("GPS Permission Denied."); // Don't spam alert
          }
        },
        { enableHighAccuracy: true, maximumAge: 10000, timeout: 20000 }
      );
    }

    /* ==============================
       CLEANUP
    ============================== */

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
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
    subscriptionStatus,
    logLocationToDb
  ]);
};
