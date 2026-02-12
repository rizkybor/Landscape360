
/**
 * Script to reset password for a user.
 * Useful when shell expansion messed up the password during creation.
 * 
 * Usage:
 * node scripts/reset_password.js <email> <new_password>
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase URL or Service Role Key in .env file');
  process.exit(1);
}

const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: node scripts/reset_password.js <email> <new_password>');
  process.exit(1);
}

const email = args[0];
const newPassword = args[1];

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function resetPassword() {
  console.log(`Resetting password for: ${email}`);

  // Get user ID first
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
      console.error('Error listing users:', listError.message);
      process.exit(1);
  }

  const user = users.find(u => u.email === email);
  
  if (!user) {
      console.error(`User with email ${email} not found.`);
      process.exit(1);
  }

  const { data, error } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: newPassword }
  );

  if (error) {
    console.error('Error updating password:', error.message);
    process.exit(1);
  }

  console.log('Password updated successfully for user:', data.user.email);
}

resetPassword();
