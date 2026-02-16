export interface TrackerPacket {
    user_id: string;      // Unique ID of the tracker/climber
    lat: number;          // Latitude
    lng: number;          // Longitude
    alt?: number;         // Altitude (meters) - Optional from GPS
    speed?: number;       // Speed (m/s) - Optional
    battery: number;      // Battery percentage (0-100)
    timestamp: string;    // ISO8601 string
    status: 'active' | 'idle' | 'sos' | 'offline'; // Derived status
  }
  
  export interface TrackerHistoryPoint {
    lat: number;
    lng: number;
    timestamp: string;
  }
  
  export interface TrackerState {
    latestPacket: TrackerPacket;
    history: TrackerHistoryPoint[];
    lastUpdate: number;   // Unix timestamp of last received packet
    isOffline: boolean;   // Derived from timeout
  }
  
  // Configuration Constants for LoRa/Packet Optimization
  export const TRACKER_CONFIG = {
    // PACKET INTERVAL: Adjust based on LoRa bandwidth & battery life
    // 5s = Realtime (High battery usage)
    // 30s = Standard Hiking
    // 60s+ = Power Saving / Long Range
    UPDATE_INTERVAL_MS: 5000, 
  
    // OFFLINE TIMEOUT: Time before marking user as 'offline' or 'signal lost'
    OFFLINE_THRESHOLD_MS: 60000, // 60 seconds
  
    // HISTORY BUFFER: Max points to keep in memory for trail rendering
    MAX_HISTORY_POINTS: 500,
    
    // INTERPOLATION: Enable for smooth movement between updates
    ENABLE_INTERPOLATION: true,
  };
