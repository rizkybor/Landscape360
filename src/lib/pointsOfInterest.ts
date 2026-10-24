import { supabase } from './supabaseClient';
import bundledLocations from '../data/myDataLocation.json';

// Points of interest on the map (table points_of_interest, 20261024000012). Anyone reads the
// published ones; only the admin writes (RLS).

export const POI_CATEGORIES = ['poi', 'mountain', 'basecamp', 'water', 'river', 'cliff', 'cave'] as const;
export type PoiCategory = (typeof POI_CATEGORIES)[number];

export const POI_CATEGORY_LABELS: Record<PoiCategory, string> = {
  poi: 'Place',
  mountain: 'Summit',
  basecamp: 'Basecamp / trailhead',
  water: 'Water source',
  river: 'River',
  cliff: 'Cliff',
  cave: 'Cave',
};

export interface PointOfInterest {
  id: string;
  name: string;
  subtitle: string | null; // e.g. "2.958 mdpl", "Permanent"
  description: string | null;
  category: PoiCategory;
  lng: number;
  lat: number;
  isPublished: boolean;
  updatedAt: string | null;
}

export type PoiInput = Pick<PointOfInterest, 'name' | 'subtitle' | 'description' | 'category' | 'lng' | 'lat' | 'isPublished'>;

// Shape the map popup, markers and search already use (from the old bundled JSON)
export interface MapLocation {
  id: string;
  text: string;
  place_name: string;
  center: [number, number];
  place_type: string[];
  type: string;
  properties: { wikidata: string | null };
}

export const toMapLocation = (p: PointOfInterest): MapLocation => ({
  id: p.id,
  text: p.subtitle ?? '',
  place_name: p.name,
  center: [p.lng, p.lat],
  // The category drives the marker colour and the popup icon
  place_type: ['poi', p.category, 'custom'],
  // Search leaves water sources out
  type: p.category === 'water' ? 'Water' : 'Feature',
  properties: { wikidata: p.description },
});

// Same rules as the seed in the migration, for the bundled offline fallback
export const guessCategory = (name: string, subtitle = '', type = ''): PoiCategory => {
  const n = name.toLowerCase();
  if (type.toLowerCase() === 'water' || n.startsWith('mata air')) return 'water';
  if (n.startsWith('bc ') || n.includes('basecamp') || subtitle.toLowerCase().includes('pos tiket')) return 'basecamp';
  if (n.startsWith('sungai')) return 'river';
  if (n.startsWith('tebing')) return 'cliff';
  if (n.startsWith('gua')) return 'cave';
  if (n.startsWith('gunung')) return 'mountain';
  return 'poi';
};

export const BUNDLED_POIS: PointOfInterest[] = (
  bundledLocations as { id: string; text: string; place_name: string; center: number[]; type?: string; properties?: { wikidata?: string | null } }[]
).map((l) => ({
  id: `bundled-${l.id}`,
  name: l.place_name,
  subtitle: l.text && l.text !== '-' ? l.text : null,
  description: l.properties?.wikidata ?? null,
  category: guessCategory(l.place_name, l.text, l.type),
  lng: l.center[0],
  lat: l.center[1],
  isPublished: true,
  updatedAt: null,
}));

const COLUMNS = 'id, name, subtitle, description, category, lng, lat, is_published, updated_at';

const fromRow = (r: Record<string, unknown>): PointOfInterest => ({
  id: r.id as string,
  name: r.name as string,
  subtitle: (r.subtitle as string | null) ?? null,
  description: (r.description as string | null) ?? null,
  category: (POI_CATEGORIES as readonly string[]).includes(r.category as string) ? (r.category as PoiCategory) : 'poi',
  lng: Number(r.lng),
  lat: Number(r.lat),
  isPublished: r.is_published !== false,
  updatedAt: (r.updated_at as string | null) ?? null,
});

const toRow = (p: PoiInput) => ({
  name: p.name.trim(),
  subtitle: p.subtitle?.trim() || null,
  description: p.description?.trim() || null,
  category: p.category,
  lng: p.lng,
  lat: p.lat,
  is_published: p.isPublished,
});

/** First problem with the form, or null when it can be saved */
export const poiInputError = (p: PoiInput): string | null => {
  if (!p.name.trim()) return 'Name is required';
  if (p.name.trim().length > 120) return 'Name must be at most 120 characters';
  if ((p.subtitle ?? '').trim().length > 120) return 'Subtitle must be at most 120 characters';
  if ((p.description ?? '').trim().length > 2000) return 'Description must be at most 2000 characters';
  if (!Number.isFinite(p.lat) || p.lat < -90 || p.lat > 90) return 'Latitude must be between -90 and 90';
  if (!Number.isFinite(p.lng) || p.lng < -180 || p.lng > 180) return 'Longitude must be between -180 and 180';
  return null;
};

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

/** Published points for the map (a missing table, before the migration, is an error) */
export const listPublishedPois = async (): Promise<PointOfInterest[]> => {
  const { data, error } = await supabase.from('points_of_interest').select(COLUMNS).eq('is_published', true).order('name');
  fail(error);
  return (data ?? []).map(fromRow);
};

/** Every point, hidden ones too (admin) */
export const listAllPois = async (): Promise<PointOfInterest[]> => {
  const { data, error } = await supabase.from('points_of_interest').select(COLUMNS).order('name');
  fail(error);
  return (data ?? []).map(fromRow);
};

export const createPoi = async (input: PoiInput): Promise<PointOfInterest> => {
  const { data, error } = await supabase.from('points_of_interest').insert(toRow(input)).select(COLUMNS).single();
  fail(error);
  return fromRow(data as Record<string, unknown>);
};

export const updatePoi = async (id: string, input: PoiInput): Promise<PointOfInterest> => {
  const { data, error } = await supabase.from('points_of_interest').update(toRow(input)).eq('id', id).select(COLUMNS).single();
  fail(error);
  return fromRow(data as Record<string, unknown>);
};

export const deletePoi = async (id: string) => {
  const { error } = await supabase.from('points_of_interest').delete().eq('id', id);
  fail(error);
};
