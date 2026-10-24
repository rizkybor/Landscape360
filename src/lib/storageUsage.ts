import { supabase } from './supabaseClient';
import type { StorageBreakdown } from './adminUsers';

// Cloud storage used by the signed-in account (my_storage_usage() in
// 20261024000004_storage_quotas.sql): tracks, marked locations, surveys and basemaps.

export interface MyStorageUsage {
  usedBytes: number;
  limitBytes: number | null; // null = unlimited
  breakdown: StorageBreakdown;
}

export const STORAGE_CATEGORY_LABELS: Record<keyof StorageBreakdown, string> = {
  tracks: 'Tracks',
  locations: 'Marked Locations',
  surveys: 'Surveys',
  basemaps: 'Custom Basemaps',
};

export const fetchMyStorageUsage = async (): Promise<MyStorageUsage | null> => {
  const { data, error } = await supabase.rpc('my_storage_usage');
  if (error) throw new Error(error.message);
  const row = (data as Record<string, number | null>[] | null)?.[0];
  if (!row) return null;
  return {
    usedBytes: Number(row.used_bytes),
    limitBytes: row.limit_bytes === null ? null : Number(row.limit_bytes),
    breakdown: {
      tracks: Number(row.tracks_bytes),
      locations: Number(row.locations_bytes),
      surveys: Number(row.surveys_bytes),
      basemaps: Number(row.basemaps_bytes),
    },
  };
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 2 : 1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

export const formatMb = (mb: number): string => (mb >= 1024 ? `${+(mb / 1024).toFixed(2)} GB` : `${+mb.toFixed(2)} MB`);

// 0..100, or null when unlimited
export const usagePercent = (usedBytes: number, limitBytes: number | null): number | null => {
  if (limitBytes === null) return null;
  if (limitBytes <= 0) return 100;
  return Math.min(100, (usedBytes / limitBytes) * 100);
};

export const usageBarClass = (percent: number | null) =>
  percent === null ? 'bg-forest-700' : percent >= 90 ? 'bg-brick-500' : percent >= 70 ? 'bg-gold-400' : 'bg-forest-700';
