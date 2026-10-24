import { supabase } from './supabaseClient';
import { MIN_PASSWORD_LENGTH } from './adminUsers';

export interface PasswordChangeInput {
  current: string;
  next: string;
  confirm: string;
}

// First problem with the form, or null when it can be submitted
export const passwordChangeError = ({ current, next, confirm }: PasswordChangeInput): string | null => {
  if (!current) return 'Enter your current password';
  if (next.length < MIN_PASSWORD_LENGTH) return `New password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  if (next === current) return 'The new password must be different from the current one';
  if (next !== confirm) return 'The new passwords do not match';
  return null;
};

// Changes the signed-in user's password. The current password is checked first (by signing
// in with it), so someone holding an unlocked, signed-in device cannot change it.
export const changeMyPassword = async (
  email: string,
  { current, next }: Pick<PasswordChangeInput, 'current' | 'next'>,
  { signOutOtherDevices = true }: { signOutOtherDevices?: boolean } = {},
) => {
  const { error: checkError } = await supabase.auth.signInWithPassword({ email, password: current });
  if (checkError) {
    throw new Error(
      /invalid login credentials/i.test(checkError.message) ? 'Your current password is not correct' : checkError.message,
    );
  }

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) throw new Error(error.message);

  // Other phones / browsers signed in to this account have to sign in again
  if (signOutOtherDevices) await supabase.auth.signOut({ scope: 'others' });
};
