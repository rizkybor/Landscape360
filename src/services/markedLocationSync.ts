import { supabase } from '../lib/supabaseClient';
import type {
  AdminMarkedLocation,
  MarkedLocation,
  MarkedLocationInput,
  MarkedLocationShare,
  SharedMarkedLocation,
  ShareResult,
  ShareSuggestion,
} from '../types/markedLocation';

// Marked locations (tables marked_locations / marked_location_shares + RPCs in
// 20261024000003_create_marked_locations.sql). Plan limits and sharing rules are enforced
// by the database; these calls just surface its errors.

interface MarkedLocationRow {
  id: string;
  user_id: string;
  name: string;
  category: MarkedLocation['category'];
  lng: number;
  lat: number;
  elevation_m: number | null;
  description: string | null;
  address: string | null;
  contact: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
}

const COLUMNS =
  'id, user_id, name, category, lng, lat, elevation_m, description, address, contact, tags, created_at, updated_at';

const fromRow = (row: MarkedLocationRow): MarkedLocation => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  category: row.category,
  lng: row.lng,
  lat: row.lat,
  elevationM: row.elevation_m,
  description: row.description,
  address: row.address,
  contact: row.contact,
  tags: row.tags ?? [],
  createdAt: Date.parse(row.created_at),
  updatedAt: Date.parse(row.updated_at),
});

const toRow = (input: MarkedLocationInput) => ({
  name: input.name.trim(),
  category: input.category,
  lng: input.lng,
  lat: input.lat,
  elevation_m: input.elevationM,
  description: input.description?.trim() || null,
  address: input.address?.trim() || null,
  contact: input.contact?.trim() || null,
  tags: input.tags,
});

export const fetchMyLocations = async (userId: string): Promise<MarkedLocation[]> => {
  const { data, error } = await supabase
    .from('marked_locations')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as MarkedLocationRow[]).map(fromRow);
};

export const createLocation = async (input: MarkedLocationInput): Promise<MarkedLocation> => {
  const { data, error } = await supabase.from('marked_locations').insert(toRow(input)).select(COLUMNS).single();
  if (error) throw new Error(error.message);
  return fromRow(data as MarkedLocationRow);
};

export const updateLocation = async (id: string, input: MarkedLocationInput): Promise<MarkedLocation> => {
  const { data, error } = await supabase
    .from('marked_locations')
    .update(toRow(input))
    .eq('id', id)
    .select(COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return fromRow(data as MarkedLocationRow);
};

export const deleteLocation = async (id: string) => {
  const { error } = await supabase.from('marked_locations').delete().eq('id', id);
  if (error) throw new Error(error.message);
};

// --- Sharing

interface ShareRow {
  shared_with: string;
  name: string | null;
  email_masked: string | null;
  created_at: string;
}

export const shareLocations = async (locationIds: string[], recipient: string): Promise<ShareResult> => {
  const { data, error } = await supabase.rpc('share_marked_locations', {
    p_location_ids: locationIds,
    p_recipient: recipient,
  });
  if (error) throw new Error(error.message);
  const row = (data as (Omit<ShareRow, 'created_at'> & { shared_count: number })[] | null)?.[0];
  if (!row) throw new Error('Share failed');
  return { userId: row.shared_with, name: row.name, emailMasked: row.email_masked, sharedCount: row.shared_count };
};

export const fetchShareSuggestions = async (query: string): Promise<ShareSuggestion[]> => {
  const { data, error } = await supabase.rpc('marked_location_share_suggestions', { p_query: query });
  if (error) throw new Error(error.message);
  return ((data ?? []) as { user_id: string; name: string | null; email_masked: string | null; recent: boolean }[]).map(
    (row) => ({ userId: row.user_id, name: row.name, emailMasked: row.email_masked, recent: row.recent }),
  );
};

export const listShares = async (locationId: string): Promise<MarkedLocationShare[]> => {
  const { data, error } = await supabase.rpc('list_marked_location_shares', { p_location_id: locationId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ShareRow[]).map((row) => ({
    userId: row.shared_with,
    name: row.name,
    emailMasked: row.email_masked,
    sharedAt: Date.parse(row.created_at),
  }));
};

// Owner revokes one recipient, or a recipient removes a location from their own list
export const removeShare = async (locationId: string, recipientId: string) => {
  const { error } = await supabase
    .from('marked_location_shares')
    .delete()
    .eq('location_id', locationId)
    .eq('shared_with', recipientId);
  if (error) throw new Error(error.message);
};

export const fetchSharedWithMe = async (): Promise<SharedMarkedLocation[]> => {
  const { data, error } = await supabase.rpc('list_marked_locations_shared_with_me');
  if (error) throw new Error(error.message);
  return (
    (data ?? []) as (MarkedLocationRow & { owner_name: string | null; owner_email_masked: string | null; shared_at: string })[]
  ).map((row) => ({
    ...fromRow(row),
    ownerName: row.owner_name,
    ownerEmailMasked: row.owner_email_masked,
    sharedAt: Date.parse(row.shared_at),
  }));
};

export const fetchAllLocations = async (): Promise<AdminMarkedLocation[]> => {
  const { data, error } = await supabase.rpc('admin_list_marked_locations');
  if (error) throw new Error(error.message);
  return ((data ?? []) as (MarkedLocationRow & { owner_name: string | null; owner_email: string | null })[]).map(
    (row) => ({ ...fromRow(row), ownerName: row.owner_name, ownerEmail: row.owner_email }),
  );
};
