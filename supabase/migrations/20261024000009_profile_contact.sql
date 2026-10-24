-- Organization and phone / WhatsApp from the account request form, kept on the account.
-- Approving a request copies them (api/account-requests.ts); users edit their own through
-- update_my_contact(), since the browser cannot update profiles rows directly (see
-- 20261023000000_restrict_profile_self_update.sql). Safe to re-run.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization TEXT CHECK (char_length(organization) <= 120),
  ADD COLUMN IF NOT EXISTS phone TEXT CHECK (char_length(phone) <= 30);

-- Accounts approved before this migration: take the details from their latest approved
-- request, without overwriting anything already set
UPDATE public.profiles p
SET
  organization = COALESCE(p.organization, r.organization),
  phone = COALESCE(p.phone, r.phone)
FROM (
  SELECT DISTINCT ON (user_id) user_id, organization, phone
  FROM public.account_requests
  WHERE status = 'approved' AND user_id IS NOT NULL
  ORDER BY user_id, reviewed_at DESC NULLS LAST
) r
WHERE p.id = r.user_id
  AND (p.organization IS NULL OR p.phone IS NULL);

-- Lets a signed-in user change only their own organization and phone. Empty values clear
-- them; a phone must have 8 to 15 digits, like on the request form.
CREATE OR REPLACE FUNCTION public.update_my_contact(p_organization TEXT, p_phone TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_organization TEXT := NULLIF(trim(COALESCE(p_organization, '')), '');
  v_phone TEXT := NULLIF(trim(COALESCE(p_phone, '')), '');
  v_digits INT := char_length(regexp_replace(COALESCE(v_phone, ''), '\D', '', 'g'));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  IF char_length(v_organization) > 120 THEN
    RAISE EXCEPTION 'Organization must be at most 120 characters';
  END IF;
  IF v_phone IS NOT NULL AND (char_length(v_phone) > 30 OR v_digits < 8 OR v_digits > 15) THEN
    RAISE EXCEPTION 'Phone / WhatsApp number must have 8 to 15 digits';
  END IF;

  UPDATE public.profiles
  SET organization = v_organization, phone = v_phone, updated_at = now()
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_contact(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_contact(TEXT, TEXT) TO authenticated;
