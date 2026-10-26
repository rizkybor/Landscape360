import { area as turfArea, polygon as turfPolygon } from '@turf/turf';
import type { Feature, Polygon } from 'geojson';
import { geodesicInverse } from './surveyUtils';
import type { LngLat } from '../types/markedArea';

// Plan rules (keep in sync with marked_area_limit() in 20261026000019_marked_areas.sql)
export const AREA_LIMITS = { Free: 5, Pro: 10, Enterprise: 20 } as const;

export const getMarkedAreaPolicy = (params: { hasUser: boolean; subscriptionStatus: string; isAdmin: boolean }) => {
  if (!params.hasUser) return { canUse: false, limit: 0, canShare: false };
  if (params.isAdmin) return { canUse: true, limit: null as number | null, canShare: true };
  const plan = params.subscriptionStatus as keyof typeof AREA_LIMITS;
  return {
    canUse: true,
    limit: AREA_LIMITS[plan] ?? AREA_LIMITS.Free,
    canShare: plan === 'Pro' || plan === 'Enterprise',
  };
};

// Outline colours to pick from (the brand palette, plus a few that stand out on satellite)
export const AREA_COLORS = ['#d49b22', '#365b25', '#2563eb', '#b4302a', '#e46c24', '#7c3aed', '#0e7490', '#ffffff'];

const closed = (ring: LngLat[]): LngLat[] => [...ring, ring[0]];

/** Area in m² on the WGS84 sphere */
export const ringArea = (ring: LngLat[]) => (ring.length < 3 ? 0 : turfArea(turfPolygon([closed(ring)])));

/** Perimeter in metres, each side measured on the WGS84 ellipsoid (like Navigator) */
export const ringPerimeter = (ring: LngLat[]) => {
  if (ring.length < 2) return 0;
  const pts = ring.length >= 3 ? closed(ring) : ring;
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += geodesicInverse(pts[i - 1][1], pts[i - 1][0], pts[i][1], pts[i][0]).distance;
  }
  return total;
};

export const formatArea = (m2: number) =>
  m2 >= 1_000_000 ? `${(m2 / 1_000_000).toFixed(2)} km²` : m2 >= 10_000 ? `${(m2 / 10_000).toFixed(2)} ha` : `${Math.round(m2)} m²`;

export const formatLength = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(1)} m`);

/** [[west, south], [east, north]] around the ring */
export const ringBounds = (ring: LngLat[]): [LngLat, LngLat] => {
  const lngs = ring.map((p) => p[0]);
  const lats = ring.map((p) => p[1]);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
};

/** Rough middle of the ring, for its name label */
export const ringCenter = (ring: LngLat[]): LngLat => {
  const [[w, s], [e, n]] = ringBounds(ring);
  return [(w + e) / 2, (s + n) / 2];
};

export const areaFeature = (ring: LngLat[], properties: Record<string, unknown> = {}): Feature<Polygon> => ({
  type: 'Feature',
  properties,
  geometry: { type: 'Polygon', coordinates: [closed(ring)] },
});

/**
 * Focus view: the whole world with the area cut out as a hole, filled dark, so only the
 * area stays bright. The hole runs the other way round from the outer ring, as GeoJSON wants.
 */
export const focusMask = (ring: LngLat[]): Feature<Polygon> => {
  const world: LngLat[] = [[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]];
  const hole = closed(ring);
  // Signed area (shoelace): make the hole clockwise when the world ring is counter-clockwise
  const signed = hole.reduce((sum, p, i) => (i === 0 ? 0 : sum + (hole[i - 1][0] * p[1] - p[0] * hole[i - 1][1])), 0);
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [world, signed > 0 ? [...hole].reverse() : hole] },
  };
};

/** First problem with a form, or null */
export const areaInputError = (input: { name: string; ring: LngLat[] }) => {
  if (!input.name.trim()) return 'Give the area a name';
  if (input.ring.length < 3) return 'Draw at least 3 points';
  if (input.ring.length > 500) return 'An area can have at most 500 points';
  return null;
};
