import { TRACK_RECORDER_CONFIG } from '../types/trackRecorder';
import type { RecordedTrack, TrackPoint, TrackStats } from '../types/trackRecorder';

type Config = typeof TRACK_RECORDER_CONFIG;

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export const haversineDistance = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number => {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
};

export type RejectReason = 'accuracy' | 'too-close' | 'too-fast' | 'out-of-order';

// Decide whether a new GPS fix should be stored, given the last stored point.
export const shouldRejectPoint = (
  prev: TrackPoint | null,
  next: TrackPoint,
  config: Config = TRACK_RECORDER_CONFIG,
): RejectReason | null => {
  if (next.accuracy > config.MAX_ACCURACY_M) return 'accuracy';
  // First point of a track or of a new segment is always kept
  if (!prev || prev.segment !== next.segment) return null;
  if (next.timestamp <= prev.timestamp) return 'out-of-order';

  const distance = haversineDistance(prev, next);
  if (distance < config.MIN_DISTANCE_M) return 'too-close';

  const seconds = (next.timestamp - prev.timestamp) / 1000;
  if (distance / seconds > config.MAX_SPEED_MS) return 'too-fast';

  return null;
};

export interface StatsAccumulator {
  stats: TrackStats;
  lastPoint: TrackPoint | null;
  elevationRef: number | null; // last altitude that counted toward gain/loss
}

export const emptyStats = (): TrackStats => ({
  distanceM: 0,
  movingTimeMs: 0,
  elevationGainM: 0,
  elevationLossM: 0,
  maxAltM: null,
  minAltM: null,
  pointCount: 0,
});

export const createAccumulator = (): StatsAccumulator => ({
  stats: emptyStats(),
  lastPoint: null,
  elevationRef: null,
});

// Add an accepted point to the running stats (pure).
export const accumulatePoint = (
  acc: StatsAccumulator,
  point: TrackPoint,
  config: Config = TRACK_RECORDER_CONFIG,
): StatsAccumulator => {
  const stats = { ...acc.stats, pointCount: acc.stats.pointCount + 1 };
  const prev = acc.lastPoint;
  let elevationRef = acc.elevationRef;

  // Distance and moving time never bridge a pause (different segments)
  if (prev && prev.segment === point.segment) {
    const distance = haversineDistance(prev, point);
    const dt = point.timestamp - prev.timestamp;
    stats.distanceM += distance;
    if (dt > 0 && dt <= config.MAX_MOVING_GAP_MS && distance / (dt / 1000) >= config.MOVING_SPEED_MS) {
      stats.movingTimeMs += dt;
    }
  }

  if (point.alt !== null) {
    stats.maxAltM = stats.maxAltM === null ? point.alt : Math.max(stats.maxAltM, point.alt);
    stats.minAltM = stats.minAltM === null ? point.alt : Math.min(stats.minAltM, point.alt);

    // Hysteresis: only count climbs/descents larger than the threshold
    if (elevationRef === null) {
      elevationRef = point.alt;
    } else if (point.alt - elevationRef >= config.ELEVATION_THRESHOLD_M) {
      stats.elevationGainM += point.alt - elevationRef;
      elevationRef = point.alt;
    } else if (elevationRef - point.alt >= config.ELEVATION_THRESHOLD_M) {
      stats.elevationLossM += elevationRef - point.alt;
      elevationRef = point.alt;
    }
  }

  return { stats, lastPoint: point, elevationRef };
};

// Rebuild the accumulator from stored points (used when recovering or viewing a track).
export const accumulatePoints = (points: TrackPoint[], config: Config = TRACK_RECORDER_CONFIG) =>
  points.reduce((acc, p) => accumulatePoint(acc, p, config), createAccumulator());

export const getElapsedMs = (track: Pick<RecordedTrack, 'elapsedMs' | 'lastResumedAt' | 'status'>, now = Date.now()) =>
  track.elapsedMs + (track.status === 'recording' && track.lastResumedAt ? Math.max(0, now - track.lastResumedAt) : 0);

// Split points into continuous lines, one per segment (pauses break the line).
export const splitSegments = (points: TrackPoint[]): TrackPoint[][] => {
  const segments: TrackPoint[][] = [];
  for (const p of points) {
    const current = segments[segments.length - 1];
    if (current && current[current.length - 1].segment === p.segment) current.push(p);
    else segments.push([p]);
  }
  return segments;
};

export const getBounds = (points: TrackPoint[]): [[number, number], [number, number]] | null => {
  if (points.length === 0) return null;
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const p of points) {
    minLng = Math.min(minLng, p.lng);
    minLat = Math.min(minLat, p.lat);
    maxLng = Math.max(maxLng, p.lng);
    maxLat = Math.max(maxLat, p.lat);
  }
  return [[minLng, minLat], [maxLng, maxLat]];
};

const escapeXml = (value: string) =>
  value.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] as string);

export const buildGpx = (track: Pick<RecordedTrack, 'name' | 'startedAt'>, points: TrackPoint[]): string => {
  const segments = splitSegments(points)
    .map((segment) => {
      const pts = segment
        .map((p) => {
          const ele = p.alt !== null ? `<ele>${p.alt.toFixed(1)}</ele>` : '';
          return `      <trkpt lat="${p.lat.toFixed(7)}" lon="${p.lng.toFixed(7)}">${ele}<time>${new Date(p.timestamp).toISOString()}</time></trkpt>`;
        })
        .join('\n');
      return `    <trkseg>\n${pts}\n    </trkseg>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Landscape360" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(track.name)}</name>
    <time>${new Date(track.startedAt).toISOString()}</time>
  </metadata>
  <trk>
    <name>${escapeXml(track.name)}</name>
${segments}
  </trk>
</gpx>
`;
};

export const formatDistance = (meters: number) =>
  meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`;

export const formatDuration = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};
