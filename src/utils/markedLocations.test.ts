import { describe, it, expect } from 'vitest';
import { getMarkedLocationPolicy, isValidCoordinate, parseTags, toGpx } from './markedLocations';
import type { MarkedLocation } from '../types/markedLocation';

const location = (overrides: Partial<MarkedLocation> = {}): MarkedLocation => ({
  id: 'l1',
  userId: 'u1',
  name: 'Pos 1',
  category: 'camp',
  lng: 107.6,
  lat: -6.9,
  elevationM: 1500,
  description: null,
  address: null,
  contact: null,
  tags: [],
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

describe('getMarkedLocationPolicy', () => {
  it.each([
    ['Free', 10, false],
    ['Pro', 100, true],
    ['Enterprise', 1000, true],
  ])('%s plan: %i locations, share=%s', (plan, maxLocations, canShare) => {
    expect(getMarkedLocationPolicy({ hasUser: true, subscriptionStatus: plan, isAdmin: false })).toEqual({
      canUse: true,
      maxLocations,
      canShare,
    });
  });

  it('gives admins unlimited locations and sharing regardless of plan', () => {
    expect(getMarkedLocationPolicy({ hasUser: true, subscriptionStatus: 'Free', isAdmin: true })).toEqual({
      canUse: true,
      maxLocations: null,
      canShare: true,
    });
  });

  it('treats an unknown plan as Free and blocks signed-out visitors', () => {
    expect(getMarkedLocationPolicy({ hasUser: true, subscriptionStatus: 'Ultimate', isAdmin: false }).maxLocations).toBe(10);
    expect(getMarkedLocationPolicy({ hasUser: false, subscriptionStatus: 'Pro', isAdmin: false }).canUse).toBe(false);
  });
});

describe('parseTags', () => {
  it('trims, drops empties and case-insensitive duplicates', () => {
    expect(parseTags(' basecamp, water,, Basecamp ,  ')).toEqual(['basecamp', 'water']);
  });

  it('keeps at most 10 tags of 30 characters', () => {
    const tags = parseTags(Array.from({ length: 15 }, (_, i) => `tag${i}`).join(','));
    expect(tags).toHaveLength(10);
    expect(parseTags('x'.repeat(50))[0]).toHaveLength(30);
  });
});

describe('isValidCoordinate', () => {
  it('accepts valid ranges and rejects the rest', () => {
    expect(isValidCoordinate(107.6, -6.9)).toBe(true);
    expect(isValidCoordinate(181, 0)).toBe(false);
    expect(isValidCoordinate(0, -91)).toBe(false);
    expect(isValidCoordinate(Number.NaN, 0)).toBe(false);
  });
});

describe('toGpx', () => {
  it('writes waypoints with elevation, type and escaped text', () => {
    const gpx = toGpx([
      location({ name: 'Pos <1> & "A"', description: 'Water ok', tags: ['camp'], contact: 'Ranger' }),
      location({ id: 'l2', name: 'Puncak', category: 'summit', elevationM: null }),
    ]);
    expect(gpx).toContain('<wpt lat="-6.9" lon="107.6">');
    expect(gpx).toContain('<ele>1500.0</ele>');
    expect(gpx).toContain('<name>Pos &lt;1&gt; &amp; &quot;A&quot;</name>');
    expect(gpx).toContain('<desc>Water ok\nContact: Ranger\nTags: camp</desc>');
    expect(gpx).toContain('<type>Camp / Basecamp</type>');
    expect(gpx).toContain('<type>Summit</type>');
    expect(gpx.match(/<ele>/g)).toHaveLength(1);
  });
});
