import { supabase } from '../lib/supabaseClient';
import type { LinkedArea, LngLat, MarkedArea, MarkedAreaInput } from '../types/markedArea';
import { ringArea, ringPerimeter } from '../utils/markedAreas';

// Marked areas (table marked_areas + RPCs in 20261026000019_marked_areas.sql). Plan limits,
// storage and sharing rules are enforced by the database.

interface AreaRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
  notes: string | null;
  ring: LngLat[];
  area_m2: number;
  perimeter_m: number;
  created_at: string;
  updated_at: string;
}

// The table or functions are missing until the migration is run
const MISSING = /PGRST202|PGRST205|42P01|could not find the (function|table)|relation .* does not exist/i;
const setupError = (error: { message: string; code?: string }) =>
  new Error(
    MISSING.test(`${error.code ?? ''} ${error.message}`)
      ? 'Marked Areas are not set up yet (run the 20261026000019 migration)'
      : error.message,
  );

const fromRow = (r: AreaRow): MarkedArea => ({
  id: r.id,
  userId: r.user_id,
  name: r.name,
  color: r.color,
  notes: r.notes,
  ring: r.ring,
  areaM2: Number(r.area_m2),
  perimeterM: Number(r.perimeter_m),
  createdAt: Date.parse(r.created_at),
  updatedAt: Date.parse(r.updated_at),
});

// Size figures are computed here and stored, so lists and shared links show them at once
const toRow = (input: MarkedAreaInput) => ({
  name: input.name.trim(),
  color: input.color,
  notes: input.notes?.trim() || null,
  ring: input.ring.map(([lng, lat]) => [Number(lng.toFixed(7)), Number(lat.toFixed(7))]),
  area_m2: ringArea(input.ring),
  perimeter_m: ringPerimeter(input.ring),
});

export const fetchMyAreas = async (userId: string): Promise<MarkedArea[]> => {
  const { data, error } = await supabase
    .from('marked_areas')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw setupError(error);
  return ((data ?? []) as AreaRow[]).map(fromRow);
};

export const createArea = async (input: MarkedAreaInput): Promise<MarkedArea> => {
  const { data, error } = await supabase.from('marked_areas').insert(toRow(input)).select().single();
  if (error) throw setupError(error);
  return fromRow(data as AreaRow);
};

export const updateArea = async (id: string, input: MarkedAreaInput): Promise<MarkedArea> => {
  const { data, error } = await supabase.from('marked_areas').update(toRow(input)).eq('id', id).select().single();
  if (error) throw setupError(error);
  return fromRow(data as AreaRow);
};

export const deleteArea = async (id: string) => {
  const { error } = await supabase.from('marked_areas').delete().eq('id', id);
  if (error) throw setupError(error);
};

// --- Share links (anyone with the link can open the area, no sign-in)

export const createAreaLink = async (areaId: string): Promise<string> => {
  const { data, error } = await supabase.rpc('create_marked_area_link', { p_area_id: areaId });
  if (error) throw setupError(error);
  return data as string;
};

export const getAreaLink = async (areaId: string): Promise<string | null> => {
  const { data, error } = await supabase.rpc('get_marked_area_link', { p_area_id: areaId });
  if (error) throw setupError(error);
  return (data as string | null) ?? null;
};

export const revokeAreaLink = async (areaId: string) => {
  const { error } = await supabase.rpc('revoke_marked_area_link', { p_area_id: areaId });
  if (error) throw setupError(error);
};

export const openAreaLink = async (token: string): Promise<LinkedArea | null> => {
  const { data, error } = await supabase.rpc('open_marked_area_link', { p_token: token });
  if (error) throw setupError(error);
  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (!row) return null;
  return {
    name: row.name as string,
    color: row.color as string,
    notes: (row.notes as string | null) ?? null,
    ring: row.ring as LngLat[],
    areaM2: Number(row.area_m2),
    perimeterM: Number(row.perimeter_m),
    updatedAt: Date.parse(row.updated_at as string),
    ownerName: (row.owner_name as string | null) ?? null,
  };
};
