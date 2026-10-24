-- Deleting an account failed with "Database error deleting user" when it still had a
-- survey or an offline map: both tables referenced auth.users without ON DELETE, so the
-- database refused to remove the user. Every other user table already cascades. Recreate
-- the two foreign keys with ON DELETE CASCADE, so an account's surveys and offline maps
-- are removed with it. Safe to re-run.

DO $$
DECLARE
  t TEXT;
  c RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY['surveys', 'offline_maps'] LOOP
    -- Drop the existing user_id -> auth.users constraint, whatever it is named
    FOR c IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY (con.conkey)
      WHERE con.contype = 'f'
        AND con.conrelid = format('public.%I', t)::regclass
        AND con.confrelid = 'auth.users'::regclass
        AND att.attname = 'user_id'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t, c.conname);
    END LOOP;

    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE',
      t,
      t || '_user_id_fkey'
    );
  END LOOP;
END $$;
