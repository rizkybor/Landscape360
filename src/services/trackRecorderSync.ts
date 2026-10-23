import { supabase } from '../lib/supabaseClient';
import type { RecordedTrack, SharedTrack, TrackPoint, TrackShare } from '../types/trackRecorder';

// Cloud copy of recorded tracks (table: recorded_tracks). One row per track; points are
// stored compactly as [lng, lat, alt, timestamp, accuracy, segment] so an upsert of the
// whole track is idempotent and safe to retry after a lost connection.

type CompactPoint = [number, number, number | null, number, number, number];

interface RecordedTrackRow {
  id: string;
  user_id: string;
  name: string;
  mode: RecordedTrack['mode'];
  status: RecordedTrack['status'];
  started_at: string;
  ended_at: string | null;
  elapsed_ms: number;
  distance_m: number;
  moving_time_ms: number;
  elevation_gain_m: number;
  elevation_loss_m: number;
  max_alt_m: number | null;
  min_alt_m: number | null;
  point_count: number;
  updated_at: string;
}

const METADATA_COLUMNS =
  'id, user_id, name, mode, status, started_at, ended_at, elapsed_ms, distance_m, moving_time_ms, elevation_gain_m, elevation_loss_m, max_alt_m, min_alt_m, point_count, updated_at';

const toCompact = (p: TrackPoint): CompactPoint => [p.lng, p.lat, p.alt, p.timestamp, p.accuracy, p.segment];

const fromCompact = ([lng, lat, alt, timestamp, accuracy, segment]: CompactPoint): TrackPoint => ({
  lng, lat, alt, timestamp, accuracy, segment, speed: null,
});

const toRow = (track: RecordedTrack): RecordedTrackRow => ({
  id: track.id,
  user_id: track.userId,
  name: track.name,
  mode: track.mode,
  status: track.status,
  started_at: new Date(track.startedAt).toISOString(),
  ended_at: track.endedAt ? new Date(track.endedAt).toISOString() : null,
  elapsed_ms: Math.round(track.elapsedMs),
  distance_m: track.distanceM,
  moving_time_ms: Math.round(track.movingTimeMs),
  elevation_gain_m: track.elevationGainM,
  elevation_loss_m: track.elevationLossM,
  max_alt_m: track.maxAltM,
  min_alt_m: track.minAltM,
  point_count: track.pointCount,
  updated_at: new Date(track.updatedAt).toISOString(),
});

const fromRow = (row: RecordedTrackRow): RecordedTrack => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  mode: row.mode,
  status: row.status,
  startedAt: Date.parse(row.started_at),
  endedAt: row.ended_at ? Date.parse(row.ended_at) : null,
  elapsedMs: row.elapsed_ms,
  lastResumedAt: null,
  distanceM: row.distance_m,
  movingTimeMs: row.moving_time_ms,
  elevationGainM: row.elevation_gain_m,
  elevationLossM: row.elevation_loss_m,
  maxAltM: row.max_alt_m,
  minAltM: row.min_alt_m,
  pointCount: row.point_count,
  syncStatus: 'remote',
  syncError: null,
  syncedAt: Date.parse(row.updated_at),
  updatedAt: Date.parse(row.updated_at),
});

export const uploadTrack = async (track: RecordedTrack, points: TrackPoint[]) => {
  const { error } = await supabase
    .from('recorded_tracks')
    .upsert({ ...toRow(track), points: points.map(toCompact) }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
};

export const fetchRemoteTracks = async (userId: string): Promise<RecordedTrack[]> => {
  const { data, error } = await supabase
    .from('recorded_tracks')
    .select(METADATA_COLUMNS)
    .eq('user_id', userId)
    .order('started_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as RecordedTrackRow[]).map(fromRow);
};

export const fetchRemotePoints = async (trackId: string): Promise<TrackPoint[]> => {
  const { data, error } = await supabase
    .from('recorded_tracks')
    .select('points')
    .eq('id', trackId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return ((data?.points ?? []) as CompactPoint[]).map(fromCompact);
};

export const renameRemoteTrack = async (trackId: string, name: string) => {
  const { error } = await supabase.from('recorded_tracks').update({ name }).eq('id', trackId);
  if (error) throw new Error(error.message);
};

export const deleteRemoteTrack = async (trackId: string) => {
  const { error } = await supabase.from('recorded_tracks').delete().eq('id', trackId);
  if (error) throw new Error(error.message);
};

// --- Sharing (table recorded_track_shares + RPCs in 20261024000001_track_recorder_sharing.sql)

interface ShareRow {
  shared_with: string;
  email: string;
  created_at: string;
}

const fromShareRow = (row: ShareRow): TrackShare => ({
  userId: row.shared_with,
  email: row.email,
  sharedAt: Date.parse(row.created_at),
});

export const shareTrack = async (trackId: string, email: string): Promise<TrackShare> => {
  const { data, error } = await supabase.rpc('share_recorded_track', { p_track_id: trackId, p_email: email });
  if (error) throw new Error(error.message);
  const row = (data as ShareRow[] | null)?.[0];
  if (!row) throw new Error('Share failed');
  return fromShareRow(row);
};

export const listShares = async (trackId: string): Promise<TrackShare[]> => {
  const { data, error } = await supabase.rpc('list_recorded_track_shares', { p_track_id: trackId });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ShareRow[]).map(fromShareRow);
};

// Owner revokes one recipient
export const revokeShare = async (trackId: string, recipientId: string) => {
  const { error } = await supabase
    .from('recorded_track_shares')
    .delete()
    .eq('track_id', trackId)
    .eq('shared_with', recipientId);
  if (error) throw new Error(error.message);
};

// Recipient removes a shared track from their own list
export const leaveSharedTrack = async (trackId: string, myUserId: string) => revokeShare(trackId, myUserId);

export const fetchSharedWithMe = async (): Promise<SharedTrack[]> => {
  const { data, error } = await supabase.rpc('list_tracks_shared_with_me');
  if (error) throw new Error(error.message);
  return ((data ?? []) as (RecordedTrackRow & { owner_email: string | null; shared_at: string })[]).map((row) => ({
    ...fromRow(row),
    ownerEmail: row.owner_email,
    sharedAt: Date.parse(row.shared_at),
  }));
};
