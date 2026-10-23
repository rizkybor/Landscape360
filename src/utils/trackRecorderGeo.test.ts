import { describe, it, expect } from 'vitest';
import {
  accumulatePoints,
  buildGpx,
  getElapsedMs,
  haversineDistance,
  shouldRejectPoint,
  splitSegments,
} from './trackRecorderGeo';
import type { TrackPoint } from '../types/trackRecorder';

const point = (overrides: Partial<TrackPoint> = {}): TrackPoint => ({
  lat: -7.6,
  lng: 110.45,
  alt: 1000,
  accuracy: 5,
  speed: null,
  timestamp: 0,
  segment: 0,
  ...overrides,
});

describe('trackRecorderGeo', () => {
  it('computes haversine distance (~111 km per degree of latitude)', () => {
    const d = haversineDistance({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(111_000);
    expect(d).toBeLessThan(111_400);
  });

  describe('shouldRejectPoint', () => {
    it('rejects inaccurate fixes, even as the first point', () => {
      expect(shouldRejectPoint(null, point({ accuracy: 80 }))).toBe('accuracy');
    });

    it('keeps the first point of a track or segment', () => {
      expect(shouldRejectPoint(null, point())).toBeNull();
      expect(shouldRejectPoint(point(), point({ segment: 1, timestamp: 1000 }))).toBeNull();
    });

    it('rejects jitter, out-of-order fixes and impossible jumps', () => {
      const prev = point({ timestamp: 10_000 });
      expect(shouldRejectPoint(prev, point({ lat: -7.60001, timestamp: 15_000 }))).toBe('too-close');
      expect(shouldRejectPoint(prev, point({ lat: -7.601, timestamp: 9_000 }))).toBe('out-of-order');
      // ~11 km in 5 seconds
      expect(shouldRejectPoint(prev, point({ lat: -7.7, timestamp: 15_000 }))).toBe('too-fast');
      // ~11 m in 5 seconds (walking)
      expect(shouldRejectPoint(prev, point({ lat: -7.6001, timestamp: 15_000 }))).toBeNull();
    });
  });

  describe('accumulatePoints', () => {
    it('sums distance and moving time within a segment', () => {
      const acc = accumulatePoints([
        point({ lat: -7.6, timestamp: 0 }),
        point({ lat: -7.6001, timestamp: 5_000 }),
        point({ lat: -7.6002, timestamp: 10_000 }),
      ]);
      expect(acc.stats.pointCount).toBe(3);
      expect(acc.stats.distanceM).toBeCloseTo(22.2, 0);
      expect(acc.stats.movingTimeMs).toBe(10_000);
    });

    it('does not bridge distance across a pause (new segment)', () => {
      const acc = accumulatePoints([
        point({ lat: -7.6, timestamp: 0 }),
        point({ lat: -7.6001, timestamp: 5_000 }),
        point({ lat: -7.7, timestamp: 600_000, segment: 1 }),
      ]);
      expect(acc.stats.distanceM).toBeCloseTo(11.1, 0);
      expect(acc.stats.movingTimeMs).toBe(5_000);
    });

    it('does not count standing still as moving time', () => {
      const acc = accumulatePoints([
        point({ lat: -7.6, timestamp: 0 }),
        // ~11 m in 100 s = 0.11 m/s, below the moving threshold
        point({ lat: -7.6001, timestamp: 100_000 }),
      ]);
      expect(acc.stats.movingTimeMs).toBe(0);
    });

    it('filters altitude noise below the threshold for gain/loss', () => {
      const alts = [1000, 1002, 1001, 1004, 1010, 1008, 1003];
      const acc = accumulatePoints(alts.map((alt, i) => point({ alt, timestamp: i * 5_000, lat: -7.6 - i * 0.0001 })));
      // 1000 -> 1004 (+4), 1004 -> 1010 (+6), 1010 -> 1003 (-7); small wiggles ignored
      expect(acc.stats.elevationGainM).toBe(10);
      expect(acc.stats.elevationLossM).toBe(7);
      expect(acc.stats.maxAltM).toBe(1010);
      expect(acc.stats.minAltM).toBe(1000);
    });

    it('handles points without altitude', () => {
      const acc = accumulatePoints([point({ alt: null }), point({ alt: null, timestamp: 5_000, lat: -7.6001 })]);
      expect(acc.stats.elevationGainM).toBe(0);
      expect(acc.stats.maxAltM).toBeNull();
    });
  });

  it('adds the running time only while recording', () => {
    expect(getElapsedMs({ elapsedMs: 60_000, lastResumedAt: 100_000, status: 'recording' }, 130_000)).toBe(90_000);
    expect(getElapsedMs({ elapsedMs: 60_000, lastResumedAt: null, status: 'paused' }, 130_000)).toBe(60_000);
  });

  it('splits points into segments', () => {
    const segments = splitSegments([point(), point({ timestamp: 1 }), point({ segment: 1, timestamp: 2 })]);
    expect(segments.map((s) => s.length)).toEqual([2, 1]);
  });

  it('builds GPX with one trkseg per segment and escaped names', () => {
    const gpx = buildGpx({ name: 'Merbabu <Summit> & back', startedAt: 0 }, [
      point({ timestamp: 0 }),
      point({ timestamp: 5_000, lat: -7.6001 }),
      point({ timestamp: 60_000, lat: -7.61, segment: 1, alt: null }),
    ]);
    expect(gpx).toContain('<name>Merbabu &lt;Summit&gt; &amp; back</name>');
    expect(gpx.match(/<trkseg>/g)).toHaveLength(2);
    expect(gpx.match(/<trkpt /g)).toHaveLength(3);
    expect(gpx).toContain('<ele>1000.0</ele>');
    expect(gpx).toContain('<time>1970-01-01T00:00:05.000Z</time>');
  });
});
