-- S.O.S button permission per account, granted by the admin in Manage Users (or when
-- approving a request / adding a user). Users cannot change it themselves: profiles rows
-- are not writable from the browser (20261023000000_restrict_profile_self_update.sql). The
-- admin always has S.O.S. Safe to re-run.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_use_sos BOOLEAN NOT NULL DEFAULT false;
