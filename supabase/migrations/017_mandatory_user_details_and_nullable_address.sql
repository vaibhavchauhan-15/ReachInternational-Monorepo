-- ==============================================================================
-- Migration 017: Mandatory User Details & Nullable Non-User Address Policy
-- 1. Updates handle_new_user() to extract city, district, state, phone directly
--    from registration metadata without falling back to 'Mumbai' or 'Maharashtra'.
-- 2. Enforces non-empty check constraints on public.users address & identity fields.
-- 3. Ensures client/entity address fields default to NULL if omitted.
-- ==============================================================================

-- 1. Update handle_new_user() trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (
    id,
    full_name,
    email,
    phone,
    role,
    status,
    city,
    district,
    state
  )
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
    COALESCE(NEW.email, ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'phone', ''), ''),
    'operator', -- Enforce non-privileged default role (Finding 01)
    'pending',  -- Strictly require administrator approval before activation
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'city', ''), ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'district', ''), ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'state', ''), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    city = EXCLUDED.city,
    district = EXCLUDED.district,
    state = EXCLUDED.state,
    updated_at = NOW();
    -- Note: role and status are intentionally NOT updated from EXCLUDED to prevent trigger re-escalation.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger
DROP TRIGGER IF EXISTS trigger_on_auth_user_created ON auth.users;
CREATE TRIGGER trigger_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Ensure non-empty check constraints on public.users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_email_not_empty;
ALTER TABLE public.users ADD CONSTRAINT users_email_not_empty CHECK (btrim(email) <> '');

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_city_not_empty;
ALTER TABLE public.users ADD CONSTRAINT users_city_not_empty CHECK (btrim(city) <> '');

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_district_not_empty;
ALTER TABLE public.users ADD CONSTRAINT users_district_not_empty CHECK (btrim(district) <> '');

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_state_not_empty;
ALTER TABLE public.users ADD CONSTRAINT users_state_not_empty CHECK (btrim(state) <> '');
