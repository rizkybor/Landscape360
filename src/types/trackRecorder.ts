// Track Recorder: personal GPS track recording (separate from live tracking/monitoring).
// See TrackRecorder.md for the concept and data flow.

// online  -> recorded on device and auto-synced to the cloud while recording and on stop
// offline -> recorded on device only; can be uploaded manually later
export type TrackMode = 'online' | 'offline';

export type TrackStatus = 'recording' | 'paused' | 'completed';

// local   -> only on this device (offline mode, never uploaded)
// pending -> has changes that still need uploading (online mode, or upload requested)
// synced  -> cloud copy is up to date
// error   -> last upload failed (will be retried for online mode)
// remote  -> only in the cloud (e.g. recorded on another device)
export type TrackSyncStatus = 'local' | 'pending' | 'synced' | 'error' | 'remote';

export type GpsStatus = 'idle' | 'searching' | 'ok' | 'denied' | 'unavailable' | 'error';

export interface TrackPoint {
  lat: number;
  lng: number;
  alt: number | null;      // meters, null when the device gives no altitude
  accuracy: number;        // horizontal accuracy in meters
  speed: number | null;    // m/s reported by the device
  timestamp: number;       // epoch ms
  segment: number;         // increments on every resume after a pause
}

export interface TrackStats {
  distanceM: number;
  movingTimeMs: number;
  elevationGainM: number;
  elevationLossM: number;
  maxAltM: number | null;
  minAltM: number | null;
  pointCount: number;
}

export interface RecordedTrack extends TrackStats {
  id: string;
  userId: string;
  name: string;
  mode: TrackMode;
  status: TrackStatus;
  startedAt: number;
  endedAt: number | null;
  elapsedMs: number;              // recording time accumulated before the current run
  lastResumedAt: number | null;   // start of the current run while recording
  syncStatus: TrackSyncStatus;
  syncError: string | null;
  syncedAt: number | null;
  updatedAt: number;
}

export const TRACK_RECORDER_CONFIG = {
  // Ignore fixes worse than this (meters)
  MAX_ACCURACY_M: 50,
  // Ignore movement smaller than this to avoid GPS jitter while standing still (meters)
  MIN_DISTANCE_M: 5,
  // Reject jumps faster than this between two fixes (m/s, ~250 km/h)
  MAX_SPEED_MS: 70,
  // Altitude change needed before it counts as gain/loss (meters, filters GPS noise)
  ELEVATION_THRESHOLD_M: 3,
  // Slower than this between two points counts as standing still (m/s)
  MOVING_SPEED_MS: 0.3,
  // Gaps longer than this between points do not count as moving time (ms)
  MAX_MOVING_GAP_MS: 120_000,
  // Online mode: upload progress at most this often while recording (ms)
  AUTO_SYNC_INTERVAL_MS: 60_000,
};
