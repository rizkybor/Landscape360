import { describe, it, expect } from 'vitest';
import { headingFromEvent } from './deviceHeading';

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
