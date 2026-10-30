import { describe, expect, it } from 'vitest';
import {
  angleDiff,
  backAzimuthOf,
  bearingTo,
  checkBackAzimuth,
  fixFromLines,
  fixRadius,
  lengthAlong,
  compassPoint,
  formatCompass,
  parseCompass,
  parseDms,
  reviewFix,
  toDmsInput,
} from './classicNav';
import type { LngLat } from '../types/markedArea';

const dms = (d: string, m = '', s = '') => ({ d, m, s });

describe('parseDms', () => {
  it('turns degrees, minutes and seconds into decimal degrees', () => {
    expect(parseDms(dms('6', '47', '24'), 90, 'latitude').value).toBeCloseTo(6.79, 6);
    expect(parseDms(dms('106', '58', '48.5'), 180, 'longitude').value).toBeCloseTo(106.980139, 6);
    expect(parseDms(dms('', '', ''), 90, 'latitude')).toEqual({ value: null, error: null });
    expect(parseDms(dms('45', '30', '0,5'), 360, 'azimuth').value).toBeCloseTo(45.500139, 6);
  });

  it('explains what is wrong', () => {
    expect(parseDms(dms('6', '60'), 90, 'latitude').error).toMatch(/Minutes go from 0 to 59/);
    expect(parseDms(dms('6', '5', '60'), 90, 'latitude').error).toMatch(/Seconds go from 0 to 59.99/);
    expect(parseDms(dms('91'), 90, 'latitude').error).toMatch(/cannot be more than 90/);
    expect(parseDms(dms('360'), 360, 'azimuth').error).toMatch(/write 0°/);
    expect(parseDms(dms('6.5'), 90, 'latitude').error).toMatch(/whole numbers/);
    expect(parseDms(dms('-6'), 90, 'latitude').error).toMatch(/No minus/);
    expect(parseDms(dms('', '5'), 90, 'latitude').error).toMatch(/Enter the degrees/);
    expect(parseDms(dms('x'), 90, 'latitude').error).toMatch(/numbers only/);
  });

  it('round-trips through the input fields', () => {
    expect(toDmsInput(-6.789999999)).toEqual({ d: '6', m: '47', s: '24' });
  });

  it('reads compass degrees 0–360', () => {
    expect(parseCompass('114', 'azimuth').value).toBe(114);
    expect(parseCompass(' 114,5° ', 'azimuth').value).toBe(114.5);
    expect(parseCompass('360', 'azimuth').value).toBe(0);
    expect(parseCompass('', 'azimuth')).toEqual({ value: null, error: null });
    expect(parseCompass('361', 'azimuth').error).toMatch(/0° to 360°/);
    expect(parseCompass('-5', 'azimuth').error).toMatch(/no negative degrees/);
    expect(parseCompass('11 4', 'azimuth').error).toMatch(/compass degrees/);
    expect(formatCompass(114.54)).toBe('114.5°');
    expect(formatCompass(359.97)).toBe('0°');
    expect(compassPoint(0)).toBe('N');
    expect(compassPoint(114)).toBe('ESE');
    expect(compassPoint(350)).toBe('N');
  });
});

describe('bearings', () => {
  it('back azimuth adds or subtracts 180°', () => {
    expect(backAzimuthOf(65)).toBe(245);
    expect(backAzimuthOf(245)).toBe(65);
    expect(angleDiff(10, 350)).toBe(20);
    expect(angleDiff(350, 10)).toBe(-20);
  });
});

// Gede (summit), Pangrango (summit), a hiker at Kandang Badak
const gede: LngLat = [106.9806, -6.7845];
const pangrango: LngLat = [106.9618, -6.7704];
const hiker: LngLat = [106.9726, -6.7808];

describe('fixFromLines', () => {
  it('resection: back azimuths from two objects meet at the hiker (within 1 m)', () => {
    const lines = [gede, pangrango].map((from) => ({ from, bearing: backAzimuthOf(bearingTo(hiker, from).bearing) }));
    const fix = fixFromLines(lines)!;
    expect(bearingTo(fix.point, hiker).distance).toBeLessThan(1);
    expect(fix.along.every((a) => a > 0)).toBe(true);
    expect(fix.misses.every((m) => m < 0.01)).toBe(true);
  });

  it('intersection over 20 km stays within a few metres', () => {
    const p1: LngLat = [106.8, -6.6];
    const p2: LngLat = [107.0, -6.65];
    const target: LngLat = [106.93, -6.78];
    const fix = fixFromLines([p1, p2].map((from) => ({ from, bearing: bearingTo(from, target).bearing })))!;
    expect(bearingTo(fix.point, target).distance).toBeLessThan(3);
  });

  it('three lines: a best fit and the triangle of error; four lines name the slip', () => {
    const third: LngLat = [106.99, -6.765];
    const fourth: LngLat = [106.975, -6.80];
    const objects = [gede, pangrango, third, fourth];
    const good = objects.map((from) => ({ from, bearing: backAzimuthOf(bearingTo(hiker, from).bearing) }));
    const labels = ['object 1', 'object 2', 'object 3', 'object 4'];
    const three = good.slice(0, 3);
    expect(bearingTo(fixFromLines(three)!.point, hiker).distance).toBeLessThan(1);
    expect(reviewFix(fixFromLines(three)!, three, 'resection', labels)[0].message).toMatch(/tight triangle of error/);

    const off = (lines: typeof good) => lines.map((l, i) => (i === 2 ? { ...l, bearing: l.bearing + 8 } : l));
    const badThree = off(three);
    expect(reviewFix(fixFromLines(badThree)!, badThree, 'resection', labels).at(-1)!.message).toMatch(/triangle of error\)\. One reading is off/);
    const badFour = off(good);
    expect(reviewFix(fixFromLines(badFour)!, badFour, 'resection', labels).at(-1)!.message).toMatch(/line from object 3 misses the others/);
  });

  it('parallel lines give no fix; lines behind give a negative distance', () => {
    expect(fixFromLines([{ from: gede, bearing: 90 }, { from: pangrango, bearing: 270 }])).toBeNull();
    expect(fixFromLines([{ from: gede, bearing: 90 }])).toBeNull();
    const ahead = fixFromLines([{ from: [0, 0], bearing: 0 }, { from: [0.01, 0], bearing: 315 }])!;
    expect(ahead.along[0]).toBeGreaterThan(0);
    const behind = fixFromLines([{ from: [0, 0], bearing: 180 }, { from: [0.01, 0], bearing: 135 }])!;
    expect(behind.along[0]).toBeLessThan(0);
  });
});

describe('hints', () => {
  it('explains the back azimuth rule without giving the number', () => {
    expect(checkBackAzimuth(245.5, 65.5).verdict).toBe('ok');
    expect(checkBackAzimuth(65.5, 65.5).message).toMatch(/azimuth itself/);
    expect(checkBackAzimuth(255, 65).message).toMatch(/less than 180°, so add 180°/);
    expect(checkBackAzimuth(25, 245).message).toMatch(/180° or more, so subtract 180°/);
    expect(checkBackAzimuth(245.25, 65.5).message).toMatch(/Keep the decimals/);
  });

  it('reviews the cut', () => {
    const fix = fixFromLines([gede, pangrango].map((from) => ({ from, bearing: backAzimuthOf(bearingTo(hiker, from).bearing) })))!;
    const lines2 = [gede, pangrango].map((from) => ({ from, bearing: backAzimuthOf(bearingTo(hiker, from).bearing) }));
    const review = reviewFix(fix, lines2, 'resection', ['object 1', 'object 2']);
    // Seen from the hiker, Gede and Pangrango are only ~19° apart: the only hint is the shallow cut
    expect(review.map((r) => r.verdict)).toEqual(['close']);
    expect(review[0].message).toMatch(/shallow 19°/);
    expect(reviewFix({ ...fix, cutAngle: 12 }, lines2, 'resection', [])[0].message).toMatch(/shallow 12°/);
  });
});

describe('fixRadius', () => {
  it('grows with distance and with a shallow cut', () => {
    const square = { point: [0, 0] as LngLat, along: [1000, 1000], misses: [0, 0], cutAngle: 90 };
    // 1 km at a right angle: 1000 × tan 2° ≈ 35 m
    expect(fixRadius(square)).toBeCloseTo(34.9, 0);
    expect(fixRadius({ ...square, along: [2000, 500] })).toBeCloseTo(69.8, 0);
    expect(fixRadius({ ...square, cutAngle: 30 })).toBeCloseTo(69.8, 0);
    // Never tiny, never huge; a wide triangle of error wins
    expect(fixRadius({ ...square, along: [10, 10] })).toBe(15);
    expect(fixRadius({ ...square, along: [1e6, 1e6] })).toBe(5000);
    expect(fixRadius({ ...square, misses: [100, 20, 30], along: [1000, 1000, 1000] })).toBe(150);
  });
});

describe('lengthAlong', () => {
  it('projects a dragged point onto the line, so only the length changes', () => {
    const from: LngLat = [106.97, -6.78];
    const onLine = bearingTo(from, [106.98, -6.78]); // due east
    expect(lengthAlong(from, onLine.bearing, [106.98, -6.78])).toBeCloseTo(onLine.distance, 0);
    // Dragged off to the side: the same length along the line
    expect(lengthAlong(from, onLine.bearing, [106.98, -6.785])).toBeCloseTo(onLine.distance, -1);
    // Dragged behind the start: negative (the layer keeps a minimum length)
    expect(lengthAlong(from, onLine.bearing, [106.96, -6.78])).toBeLessThan(0);
  });
});
