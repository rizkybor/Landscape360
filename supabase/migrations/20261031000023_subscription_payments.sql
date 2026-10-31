-- Paid plans through Midtrans (web), prepaid per period: a payment adds days to the plan;
-- nothing renews on its own. Plans set by the admin by hand have no end date and are never
-- touched by this. Everything here is written by the server (service role, /api/payments):
-- clients can only read their own payments. Safe to re-run.

-- 1. When a paid plan ends (NULL: no end, e.g. Free or set by the admin) -------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- 2. Payments ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.subscription_payments (
  order_id TEXT PRIMARY KEY CHECK (order_id ~ '^L360-[A-Za-z0-9-]{8,40}$'),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product TEXT NOT NULL,                       -- e.g. pro-1m, ent-monitor-1y (api/payments.ts)
  plan TEXT NOT NULL CHECK (plan IN ('Pro', 'Enterprise')),
  role TEXT NOT NULL CHECK (role IN ('pengguna360', 'monitor360')),
  period_days INTEGER NOT NULL CHECK (period_days BETWEEN 1 AND 3660),
  amount INTEGER NOT NULL CHECK (amount > 0),  -- Rupiah
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'expired', 'refunded')),
  provider TEXT NOT NULL DEFAULT 'midtrans',
  payment_type TEXT,                           -- qris, gopay, bank_transfer, credit_card…
  transaction_id TEXT,
  -- Days added to the plan once paid
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  last_notification JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS subscription_payments_user_idx
  ON public.subscription_payments (user_id, created_at DESC);

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read their payments, admin all" ON public.subscription_payments;
CREATE POLICY "Users read their payments, admin all" ON public.subscription_payments
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());

REVOKE INSERT, UPDATE, DELETE ON public.subscription_payments FROM anon, authenticated;
GRANT SELECT ON public.subscription_payments TO authenticated;

-- 3. Apply a paid payment to the plan (once) -----------------------------------------------
-- The same plan and role extends from the current end date; another plan starts today
-- (what is left of the old one is not carried over). The admin keeps full access: only the
-- payment is recorded.

CREATE OR REPLACE FUNCTION public.apply_subscription_payment(p_order_id TEXT)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pay public.subscription_payments%ROWTYPE;
  prof RECORD;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
BEGIN
  SELECT * INTO pay FROM public.subscription_payments WHERE order_id = p_order_id FOR UPDATE;
  IF NOT FOUND OR pay.status <> 'paid' THEN
    RETURN NULL;
  END IF;
  IF pay.applied_at IS NOT NULL THEN
    RETURN pay.period_end; -- already applied (Midtrans sends notifications more than once)
  END IF;

  SELECT status_subscribe, status_user, subscription_expires_at, is_admin
  INTO prof FROM public.profiles WHERE id = pay.user_id FOR UPDATE;

  v_start := CASE
    WHEN prof.status_subscribe = pay.plan AND prof.status_user = pay.role
      AND prof.subscription_expires_at IS NOT NULL AND prof.subscription_expires_at > now()
    THEN prof.subscription_expires_at
    ELSE now()
  END;
  v_end := v_start + make_interval(days => pay.period_days);

  IF NOT COALESCE(prof.is_admin, false) THEN
    UPDATE public.profiles
    SET status_subscribe = pay.plan, status_user = pay.role, subscription_expires_at = v_end, updated_at = now()
    WHERE id = pay.user_id;
  END IF;

  UPDATE public.subscription_payments
  SET applied_at = now(), period_start = v_start, period_end = v_end, updated_at = now()
  WHERE order_id = p_order_id;
  RETURN v_end;
END;
$$;

-- 4. Paid plans that ran out go back to Free (run daily by /api/payments?cron) ------------

CREATE OR REPLACE FUNCTION public.expire_subscriptions()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH ended AS (
    UPDATE public.profiles
    SET status_subscribe = 'Free', status_user = 'pengguna360', subscription_expires_at = NULL, updated_at = now()
    WHERE subscription_expires_at IS NOT NULL AND subscription_expires_at <= now() AND NOT is_admin
    RETURNING 1
  )
  SELECT count(*)::INTEGER FROM ended;
$$;

-- Server only (service role); not callable from the browser
REVOKE ALL ON FUNCTION public.apply_subscription_payment(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_subscriptions() FROM PUBLIC, anon, authenticated;
