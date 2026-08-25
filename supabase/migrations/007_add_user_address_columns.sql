-- ============================================
-- Migration 007: Add user address columns (city, district, state) with check constraints
-- ============================================

-- 1. Add city, district, state columns
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '' NOT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS district TEXT DEFAULT '' NOT NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS state TEXT DEFAULT '' NOT NULL;

-- 2. Backfill existing user records with non-empty default address values
UPDATE public.users SET city = 'Mumbai' WHERE btrim(city) = '';
UPDATE public.users SET district = 'Mumbai' WHERE btrim(district) = '';
UPDATE public.users SET state = 'Maharashtra' WHERE btrim(state) = '';

-- 3. Add non-empty check constraints
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_city_not_empty;
ALTER TABLE public.users ADD CONSTRAINT users_city_not_empty CHECK (btrim(city) <> '');

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_district_not_empty;
ALTER TABLE public.users ADD CONSTRAINT users_district_not_empty CHECK (btrim(district) <> '');

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_state_not_empty;
ALTER TABLE public.users ADD CONSTRAINT users_state_not_empty CHECK (btrim(state) <> '');

-- 4. Create performance index on address columns
CREATE INDEX IF NOT EXISTS idx_users_address ON public.users(state, district, city);

-- 5. Update handle_new_user() trigger to include city, district, state
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_status TEXT := 'pending';
BEGIN
  -- Dashboard-created users (or confirmed email) get 'active' status directly
  IF NEW.email_confirmed_at IS NOT NULL OR (NEW.raw_user_meta_data->>'status') = 'active' THEN
    user_status := 'active';
  END IF;

  INSERT INTO public.users (id, full_name, email, phone, role, status, city, district, state)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.email, ''),
    NEW.raw_user_meta_data->>'phone',
    COALESCE(NEW.raw_user_meta_data->>'role', 'engineer'),
    user_status,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'city', ''), 'Mumbai'),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'district', ''), 'Mumbai'),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'state', ''), 'Maharashtra')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    role = EXCLUDED.role,
    status = EXCLUDED.status,
    city = EXCLUDED.city,
    district = EXCLUDED.district,
    state = EXCLUDED.state,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
