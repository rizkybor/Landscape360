import { describe, it, expect, vi } from 'vitest';
import { headingFromEvent, watchDeviceHeading } from './deviceHeading';

const ev = (fields: Record<string, unknown>) => fields as unknown as DeviceOrientationEvent;

describe('headingFromEvent', () => {
  it('uses the iOS compass heading as is (clockwise from north)', () => {
    expect(headingFromEvent(ev({ webkitCompassHeading: 90, webkitCompassAccuracy: 10 }), 0)).toBe(90);
  });

  it('ignores an uncalibrated iOS compass', () => {
    expect(headingFromEvent(ev({ webkitCompassHeading: 90, webkitCompassAccuracy: -1 }), 0)).toBeNull();
  });

  it('turns the Android absolute alpha (counter-clockwise) into a clockwise heading', () => {
    expect(headingFromEvent(ev({ absolute: true, alpha: 90 }), 0)).toBe(270);
    expect(headingFromEvent(ev({ absolute: true, alpha: 0 }), 0)).toBe(0);
  });

  it('adds the screen rotation when the device is held sideways', () => {
    expect(headingFromEvent(ev({ webkitCompassHeading: 350 }), 90)).toBe(80);
    expect(headingFromEvent(ev({ absolute: true, alpha: 0 }), 270)).toBe(270);
  });

  it('returns null without compass data (relative orientation only)', () => {
    expect(headingFromEvent(ev({ absolute: false, alpha: 30 }), 0)).toBeNull();
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
    expect(onHeading.mock.calls.map((c) => c[0])).toEqual([45, 90]);
    stop();
  });

  it('prefers deviceorientationabsolute and skips readings without a compass', () => {
    const onHeading = vi.fn();
    const stop = watchDeviceHeading(onHeading);
    fire('deviceorientation', { absolute: false, alpha: 10 }); // relative: ignored
    fire('deviceorientationabsolute', { absolute: true, alpha: 300 });
    fire('deviceorientation', { absolute: true, alpha: 0 }); // absolute stream works: ignored
    expect(onHeading.mock.calls.map((c) => c[0])).toEqual([60]);
    stop();
    fire('deviceorientationabsolute', { absolute: true, alpha: 0 });
    expect(onHeading).toHaveBeenCalledTimes(1);
  });
});
