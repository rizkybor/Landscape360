-- Account requests: visitors ask for an account from the Sign In modal, the admin
-- approves (which creates the account) or rejects them.
-- All reads and writes go through /api/account-requests with the service role, so RLS
-- is enabled with no policies: the browser can never read or write this table directly.

CREATE TABLE IF NOT EXISTS public.account_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL CHECK (char_length(email) BETWEEN 3 AND 254),
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 120),
  organization TEXT CHECK (char_length(organization) <= 120),
  phone TEXT CHECK (char_length(phone) <= 30),
  requested_plan TEXT NOT NULL DEFAULT 'Free' CHECK (requested_plan IN ('Free', 'Pro', 'Enterprise')),
  message TEXT CHECK (char_length(message) <= 1000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT CHECK (char_length(admin_note) <= 500),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One open request per email address
CREATE UNIQUE INDEX IF NOT EXISTS account_requests_pending_email_idx
  ON public.account_requests (lower(email))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS account_requests_status_created_idx
  ON public.account_requests (status, created_at DESC);

ALTER TABLE public.account_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.account_requests FROM anon, authenticated;
