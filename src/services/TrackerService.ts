import { useEffect, useRef } from 'react';
import { useTrackerStore } from '../store/useTrackerStore';
import { useSurveyStore } from '../store/useSurveyStore'; // Access user profile
import { TRACKER_CONFIG } from '../types/tracker';
import type { TrackerPacket } from '../types/tracker';
import { supabase } from '../lib/supabaseClient'; // Import Supabase
import { RealtimeChannel } from '@supabase/supabase-js';

// Mock Data Generator for Simulation
const generateMockPacket = (userId: string, baseLat: number, baseLng: number, timeOffset: number): TrackerPacket => {
  const now = Date.now();
  const angle = (now / 10000) + timeOffset; // Circular movement
  const radius = 0.005; // ~500m radius
  
  return {
    user_id: userId,
    lat: baseLat + Math.sin(angle) * radius,
    lng: baseLng + Math.cos(angle) * radius,
    alt: 1500 + Math.random() * 50,
    speed: 1.2 + Math.random() * 0.5,
    battery: Math.max(0, 100 - Math.floor((now % 3600000) / 36000)), // Drain over an hour
    timestamp: new Date().toISOString(),
    status: 'active'
  };
};

export const useTrackerService = () => {
  const addOrUpdateTracker = useTrackerStore(s => s.addOrUpdateTracker);
  const isLiveTrackingEnabled = useTrackerStore(s => s.isLiveTrackingEnabled);
  const isSimulationEnabled = useTrackerStore(s => s.isSimulationEnabled);
  const isLocalBroadcastEnabled = useTrackerStore(s => s.isLocalBroadcastEnabled);
  const setConnectionStatus = useTrackerStore(s => s.setConnectionStatus);
  
  const { user, userRole, subscriptionStatus } = useSurveyStore(); // Get User Role

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastBroadcastRef = useRef<number>(0);
  const latestPacketRef = useRef<TrackerPacket | null>(null); // Store latest packet for heartbeat response
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // SIMULATE WEBSOCKET CONNECTION & LOCAL GPS
  useEffect(() => {
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

    // --- 0. SUPABASE REALTIME SETUP (For Monitor & Broadcast) ---
    if (!channelRef.current) {
      console.log(`Tracker Service: Connecting to Realtime Channel (Role: ${userRole})...`);
      setConnectionStatus('connecting');
      
      const channel = supabase.channel('tracking-room', {
        config: {
          broadcast: { self: false }
        }
      });

      // LISTEN: If user is MONITOR, listen for location updates
      if (userRole === 'monitor360' && subscriptionStatus === 'Enterprise') {
        console.log("Tracker Service: Monitoring Mode Active. Listening for updates...");
        channel.on(
          'broadcast',
          { event: 'location-update' },
          (payload) => {
              if (payload.payload) {
                const packet = payload.payload as TrackerPacket;
                const myTrackerId = user?.email?.split('@')[0].toUpperCase() || user?.id.slice(0, 8).toUpperCase();
                if (packet.user_id !== myTrackerId) {
                    addOrUpdateTracker(packet);
                }
              }
          }
        );
      }
      
      // --- RESPOND TO HEARTBEAT (If Broadcaster) ---
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

      // Define heartbeat sender (but don't call yet)
      const sendHeartbeatRequest = () => {
          // Check if channel is ready (state is 'joined')
          if (channel && channel.state === 'joined') {
             channel.send({
                type: 'broadcast',
                event: 'heartbeat-request',
                payload: { requester: user?.id }
            }).catch(err => console.warn("Heartbeat failed", err));
          }
      };

      try {
        channel.subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log(`Tracker Service: Subscribed to 'tracking-room'`);
            setConnectionStatus('connected');
            
            // --- START HEARTBEAT (Monitor Only) ---
            if (userRole === 'monitor360' && subscriptionStatus === 'Enterprise') {
                sendHeartbeatRequest(); // Initial request
                if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
                heartbeatIntervalRef.current = setInterval(sendHeartbeatRequest, 10000); // Repeat
            }

            // FLUSH LATEST PACKET ON RECONNECT (Broadcaster Only)
            if (isLocalBroadcastEnabled && latestPacketRef.current) {
                const packetAge = Date.now() - new Date(latestPacketRef.current.timestamp).getTime();
                if (packetAge < 60000) {
                     channel.send({
                        type: 'broadcast',
                        event: 'location-update',
                        payload: latestPacketRef.current
                    });
                }
            }
            
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error(`Tracker Service: Channel Error - ${status}`);
            setConnectionStatus('error');
            // Stop heartbeat if connection lost
            if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
          }
        });
      } catch (err) {
        console.error("Tracker Service: Failed to subscribe", err);
        setConnectionStatus('error');
      }

      channelRef.current = channel;
    }


    // --- 1. MOCK SIMULATION (Only if enabled manually) ---
    if (isSimulationEnabled) {
      // ... existing simulation code ...
      const mockUsers = [
        { id: 'RANGER-01', baseLat: -7.565, baseLng: 110.455 },
        { id: 'CLIMBER-A', baseLat: -7.562, baseLng: 110.458 },
        { id: 'CLIMBER-B', baseLat: -7.568, baseLng: 110.452 },
        { id: 'RESCUE-01', baseLat: -7.564, baseLng: 110.460 },
        { id: 'LOGISTIC', baseLat: -7.566, baseLng: 110.450 },
      ];

      console.log("Tracker Service: Connected to Mock LoRa Gateway...");

      mockUsers.forEach((user, idx) => {
        const packet = generateMockPacket(user.id, user.baseLat, user.baseLng, idx);
        addOrUpdateTracker(packet);
      });

      intervalRef.current = setInterval(() => {
        mockUsers.forEach((user, idx) => {
          setTimeout(() => {
            const packet = generateMockPacket(user.id, user.baseLat, user.baseLng, idx);
            addOrUpdateTracker(packet);
          }, Math.random() * 1000);
        });
      }, TRACKER_CONFIG.UPDATE_INTERVAL_MS);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    // --- 2. LOCAL GPS BROADCAST (Phone GPS -> Supabase) ---
    // Only broadcast if enabled AND user is logged in
    if (isLocalBroadcastEnabled && navigator.geolocation && user) {
      console.log("Tracker Service: Watching Local GPS & Broadcasting...");
      
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, altitude, speed } = position.coords;
          
          // Use user's email or ID as the tracker ID
          const trackerId = user.email?.split('@')[0] || user.id.slice(0, 8);
          
          const myPacket: TrackerPacket = {
            user_id: trackerId.toUpperCase(), 
            lat: latitude,
            lng: longitude,
            alt: altitude || 0,
            speed: speed || 0,
            battery: 100, // Assume 100% or use Battery API if available
            timestamp: new Date().toISOString(),
            status: 'active'
          };
          
          // Update local map
          addOrUpdateTracker(myPacket);
          latestPacketRef.current = myPacket; // Store for heartbeat

          // BROADCAST to Supabase (Throttled: Max once per 3s)
          const now = Date.now();
          if (channelRef.current && (now - lastBroadcastRef.current > 3000)) {
             channelRef.current.send({
                type: 'broadcast',
                event: 'location-update',
                payload: myPacket
             }).then((resp) => {
                if (resp === 'ok') {
                    // console.log('Broadcast sent');
                }
             });
             lastBroadcastRef.current = now;
          }
        },
        (error) => {
          console.warn("Tracker Service: Local GPS Error", error);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
    } else {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    }

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
  }, [isLiveTrackingEnabled, isSimulationEnabled, isLocalBroadcastEnabled, addOrUpdateTracker, user, userRole, setConnectionStatus, subscriptionStatus]); // Added subscriptionStatus
};
