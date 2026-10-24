import type { MarkedLocation, MarkedLocationCategory } from '../types/markedLocation';

// Plan rules. Keep in sync with marked_location_limit() and can_share_marked_locations()
// in 20261024000003_create_marked_locations.sql, which enforce them server-side.
export const MARKED_LOCATION_LIMITS: Record<string, number> = {
  Free: 10,
  Pro: 100,
  Enterprise: 1000,
};

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;

export interface MarkedLocationPolicy {
  canUse: boolean;
  maxLocations: number | null; // null = unlimited
  canShare: boolean;
}

export const getMarkedLocationPolicy = (params: {
  hasUser: boolean;
  subscriptionStatus: string;
  isAdmin: boolean;
}): MarkedLocationPolicy => {
  if (!params.hasUser) return { canUse: false, maxLocations: 0, canShare: false };
  if (params.isAdmin) return { canUse: true, maxLocations: null, canShare: true };
  return {
    canUse: true,
    maxLocations: MARKED_LOCATION_LIMITS[params.subscriptionStatus] ?? MARKED_LOCATION_LIMITS.Free,
    canShare: params.subscriptionStatus === 'Pro' || params.subscriptionStatus === 'Enterprise',
  };
};

export const CATEGORY_META: Record<MarkedLocationCategory, { label: string; color: string }> = {
  poi: { label: 'Point of Interest', color: '#d49b22' },
  camp: { label: 'Camp / Basecamp', color: '#365b25' },
  summit: { label: 'Summit', color: '#7c4a1e' },
  water: { label: 'Water Source', color: '#2563eb' },
  shelter: { label: 'Shelter / Pos', color: '#6b7280' },
  viewpoint: { label: 'Viewpoint', color: '#0e7490' },
  trailhead: { label: 'Trailhead', color: '#e46c24' },
  hazard: { label: 'Hazard', color: '#b4302a' },
  cave: { label: 'Cave', color: '#57534e' },
  parking: { label: 'Parking', color: '#4338ca' },
};

// "basecamp, water,  Basecamp" -> ["basecamp", "water"]
export const parseTags = (value: string): string[] => {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const raw of value.split(',')) {
    const tag = raw.trim().slice(0, MAX_TAG_LENGTH);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length === MAX_TAGS) break;
  }
  return tags;
};

export const isValidCoordinate = (lng: number, lat: number) =>
  Number.isFinite(lng) && Number.isFinite(lat) && lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;

export const formatLatLng = (lat: number, lng: number) => `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

export const directionsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

// GPX 1.1 waypoints, readable by Garmin, OsmAnd, Avenza and most GPS apps
export const toGpx = (locations: MarkedLocation[]): string => {
  const waypoints = locations
    .map((l) => {
      const desc = [l.description, l.address, l.contact && `Contact: ${l.contact}`, l.tags.length > 0 && `Tags: ${l.tags.join(', ')}`]
        .filter(Boolean)
        .join('\n');
      return [
        `  <wpt lat="${l.lat}" lon="${l.lng}">`,
        l.elevationM != null ? `    <ele>${l.elevationM.toFixed(1)}</ele>` : null,
        `    <name>${escapeXml(l.name)}</name>`,
        desc ? `    <desc>${escapeXml(desc)}</desc>` : null,
        `    <type>${escapeXml(CATEGORY_META[l.category]?.label ?? l.category)}</type>`,
        `  </wpt>`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Landscape360" xmlns="http://www.topografix.com/GPX/1/1">
${waypoints}
</gpx>
`;
};
