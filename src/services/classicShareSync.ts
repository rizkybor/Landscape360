import { supabase } from '../lib/supabaseClient';
import type { ClassicMode, FieldWorkData } from '../store/useClassicStore';

// Shared Classic Field Works (table classic_field_work_links + RPCs in
// 20261030000022_classic_field_work_links.sql). Every signed-in account can share; anyone with
// the link can look, without signing in. The link always shows the latest version.

export interface SharedFieldWorkData extends FieldWorkData {
  declination: string;
}

export interface SharedFieldWork {
  mode: ClassicMode;
  name: string;
  data: SharedFieldWorkData;
  updatedAt: number;
  ownerName: string | null;
}

const MISSING = /PGRST202|PGRST205|42P01|could not find the (function|table)|relation .* does not exist/i;
const shareError = (error: { message: string; code?: string }) =>
  new Error(
    MISSING.test(`${error.code ?? ''} ${error.message}`)
      ? 'Sharing Field Works is not set up yet (run the 20261030000022 migration)'
      : error.message,
  );

/** Creates the link (token null) or saves the latest version to it; returns the token */
export const saveFieldWorkLink = async (input: {
  token: string | null;
  mode: ClassicMode;
  name: string;
  data: SharedFieldWorkData;
}): Promise<string> => {
  const { data, error } = await supabase.rpc('save_classic_field_work_link', {
    p_token: input.token,
    p_mode: input.mode,
    p_name: input.name,
    p_data: input.data,
  });
  if (error) throw shareError(error);
  return data as string;
};

export const revokeFieldWorkLink = async (token: string) => {
  const { error } = await supabase.rpc('revoke_classic_field_work_link', { p_token: token });
  if (error) throw shareError(error);
};

/** The shared Field Work, or null when the link is off or unknown */
export const openFieldWorkLink = async (token: string): Promise<SharedFieldWork | null> => {
  const { data, error } = await supabase.rpc('open_classic_field_work_link', { p_token: token });
  if (error) throw shareError(error);
  const row = ((data ?? []) as Record<string, unknown>[])[0];
  if (!row) return null;
  return {
    mode: row.mode as ClassicMode,
    name: row.name as string,
    data: row.data as SharedFieldWorkData,
    updatedAt: Date.parse(row.updated_at as string),
    ownerName: (row.owner_name as string | null) ?? null,
  };
};
