import type { User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

// Name of an account. `display_name` is the one name field: the request form, the admin
// and the user's own Edit Profile all write it. Older accounts may only have `full_name`
// or `name`, which are read as a fallback.
export const accountDisplayName = (user: Pick<User, 'user_metadata'> | null | undefined): string => {
  const meta = user?.user_metadata ?? {};
  return (meta.display_name || meta.full_name || meta.name || '') as string;
};

export interface ProfileContact {
  organization: string | null;
  phone: string | null;
}

// The signed-in user's organization and phone, or null until the profile contact migration
// (20261024000009) has been run
export const fetchMyContact = async (userId: string): Promise<ProfileContact | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('organization, phone')
    .eq('id', userId)
    .maybeSingle();
  if (error) return null;
  return { organization: data?.organization ?? null, phone: data?.phone ?? null };
};

export const updateMyContact = async ({ organization, phone }: ProfileContact) => {
  const { error } = await supabase.rpc('update_my_contact', {
    p_organization: organization ?? '',
    p_phone: phone ?? '',
  });
  if (error) throw new Error(error.message);
};

// Same rule as the account request form
export const isValidPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '').length;
  return phone.trim() === '' || (digits >= 8 && digits <= 15);
};

// wa.me link for an Indonesian or international number ("0812..." becomes "62812...")
export const whatsappUrl = (phone: string): string | null => {
  let digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  if (digits.startsWith('0')) digits = `62${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
};
