import { describe, it, expect } from 'vitest';
import { area as turfArea } from '@turf/turf';
import { areaInputError, focusMask, formatArea, getMarkedAreaPolicy, ringArea, ringBounds, ringPerimeter } from './markedAreas';
import type { LngLat } from '../types/markedArea';

// About 100 m x 100 m near Gunung Gede
const square: LngLat[] = [
  [106.98, -6.79],
  [106.980904, -6.79],
  [106.980904, -6.789096],
  [106.98, -6.789096],
];

describe('marked areas', () => {
  it('measures area and perimeter', () => {
    expect(ringArea(square)).toBeGreaterThan(9_900);
    expect(ringArea(square)).toBeLessThan(10_100);
    expect(ringPerimeter(square)).toBeGreaterThan(398);
    expect(ringPerimeter(square)).toBeLessThan(402);
    expect(formatArea(ringArea(square))).toBe('1.00 ha');
    expect(formatArea(450)).toBe('450 m²');
    expect(formatArea(2_500_000)).toBe('2.50 km²');
  });

  it('focus mask: the world with the area cut out, whichever way the area was drawn', () => {
    for (const ring of [square, [...square].reverse()]) {
      const mask = focusMask(ring);
      const [outer, hole] = mask.geometry.coordinates;
      expect(outer).toHaveLength(5);
      expect(hole).toHaveLength(ring.length + 1);
      // The mask covers the world minus the area
      const world = turfArea({ type: 'Polygon', coordinates: [outer] });
      expect(world - turfArea(mask)).toBeCloseTo(ringArea(ring), -2);
    }
  });

  it('bounds, validation and plan limits', () => {
    expect(ringBounds(square)).toEqual([[106.98, -6.79], [106.980904, -6.789096]]);
    expect(areaInputError({ name: '', ring: square })).toBe('Give the area a name');
    expect(areaInputError({ name: 'Camp', ring: square.slice(0, 2) })).toBe('Draw at least 3 points');
    expect(areaInputError({ name: 'Camp', ring: square })).toBeNull();
    expect(getMarkedAreaPolicy({ hasUser: true, subscriptionStatus: 'Free', isAdmin: false })).toEqual({ canUse: true, limit: 5, canShare: false });
    expect(getMarkedAreaPolicy({ hasUser: true, subscriptionStatus: 'Pro', isAdmin: false })).toEqual({ canUse: true, limit: 10, canShare: true });
    expect(getMarkedAreaPolicy({ hasUser: true, subscriptionStatus: 'Enterprise', isAdmin: false }).limit).toBe(20);
    expect(getMarkedAreaPolicy({ hasUser: true, subscriptionStatus: 'Free', isAdmin: true })).toEqual({ canUse: true, limit: null, canShare: true });
    expect(getMarkedAreaPolicy({ hasUser: false, subscriptionStatus: 'Pro', isAdmin: false }).canUse).toBe(false);
  });
});
