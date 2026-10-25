import { describe, it, expect, vi } from 'vitest';
import { createCompassQualityTracker, headingFromEvent, watchDeviceHeading } from './deviceHeading';

const ev = (fields: Record<string, unknown>) => fields as unknown as DeviceOrientationEvent;

describe('headingFromEvent', () => {
  it('uses the iOS compass heading as is (clockwise from north)', () => {
    expect(headingFromEvent(ev({ webkitCompassHeading: 90, webkitCompassAccuracy: 10 }))).toBe(90);
  });

  it('ignores an uncalibrated iOS compass', () => {
    expect(headingFromEvent(ev({ webkitCompassHeading: 90, webkitCompassAccuracy: -1 }))).toBeNull();
  });

  it('turns the Android absolute alpha (counter-clockwise) into a clockwise heading', () => {
    expect(headingFromEvent(ev({ absolute: true, alpha: 90 }))).toBe(270);
    expect(headingFromEvent(ev({ absolute: true, alpha: 0 }))).toBe(0);
  });

  it('follows the top edge of the phone: turning it flat turns the heading', () => {
    // Phone lying flat, top edge turned from north to east (Android alpha goes 0 -> 270)
    expect(headingFromEvent(ev({ absolute: true, alpha: 270 }))).toBe(90);
    expect(headingFromEvent(ev({ absolute: true, alpha: 180 }))).toBe(180);
    expect(headingFromEvent(ev({ webkitCompassHeading: 359.5 }))).toBe(359.5);
  });

  it('returns null without compass data (relative orientation only)', () => {
    expect(headingFromEvent(ev({ absolute: false, alpha: 30 }))).toBeNull();
  });
});

const fire = (type: string, fields: Record<string, unknown>) => {
  const e = new Event(type);
  Object.assign(e, fields);
  window.dispatchEvent(e);
};

describe('watchDeviceHeading', () => {
  it('reads the compass from deviceorientation (iOS, Samsung Internet, Firefox)', () => {
    const onHeading = vi.fn();
    const stop = watchDeviceHeading(onHeading);
    fire('deviceorientation', { webkitCompassHeading: 45, webkitCompassAccuracy: 5 });
    fire('deviceorientation', { absolute: true, alpha: 270 });
    expect(onHeading.mock.calls.map((c) => c[0].heading)).toEqual([45, 90]);
    stop();
  });

  it('prefers deviceorientationabsolute and skips readings without a compass', () => {
    const onHeading = vi.fn();
    const stop = watchDeviceHeading(onHeading);
    fire('deviceorientation', { absolute: false, alpha: 10 }); // relative: ignored
    fire('deviceorientationabsolute', { absolute: true, alpha: 300 });
    fire('deviceorientation', { absolute: true, alpha: 0 }); // absolute stream works: ignored
    expect(onHeading.mock.calls.map((c) => c[0].heading)).toEqual([60]);
    stop();
    fire('deviceorientationabsolute', { absolute: true, alpha: 0 });
    expect(onHeading).toHaveBeenCalledTimes(1);
  });
});

describe('createCompassQualityTracker', () => {
  it('iOS: poor while uncalibrated or inaccurate, ok otherwise', () => {
    const q = createCompassQualityTracker();
    expect(q.push({ heading: null, accuracy: -1 })).toBe('poor');
    expect(q.push({ heading: 10, accuracy: 45 })).toBe('poor');
    expect(q.push({ heading: 10, accuracy: 12 })).toBe('ok');
  });

  it('Android: poor after three impossible jumps within a few seconds, then recovers', () => {
    const q = createCompassQualityTracker();
    let t = 1000;
    const r = (heading: number) => q.push({ heading, accuracy: null }, t);
    expect(r(10)).toBe('ok');
    t += 16; expect(r(100)).toBe('ok'); // jump 1
    t += 16; expect(r(10)).toBe('ok'); // jump 2
    t += 16; expect(r(200)).toBe('poor'); // jump 3
    t += 2000; expect(r(201)).toBe('poor'); // still held
    t += 3000; expect(r(202)).toBe('ok'); // settled
  });

  it('Android: turning by hand is not a jump', () => {
    const q = createCompassQualityTracker();
    let t = 0;
    for (let h = 0; h <= 180; h += 30) { t += 200; expect(q.push({ heading: h, accuracy: null }, t)).toBe('ok'); }
  });
});
