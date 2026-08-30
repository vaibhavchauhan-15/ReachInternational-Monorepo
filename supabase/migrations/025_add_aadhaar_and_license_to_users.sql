-- ==============================================================================
-- Migration 025: Add Aadhaar Number and Driving Licence Number to public.users
-- 1. Adds aadhaar_number and license_number columns to public.users table.
-- 2. Creates index on aadhaar_number and license_number for administrative lookups.
-- 3. Updates handle_new_user() trigger function to capture aadhaar_number and license_number
--    from registration metadata.
-- ==============================================================================

-- 1. Add columns to public.users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS aadhaar_number TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS license_number TEXT;

-- 2. Add performance index on identity columns
CREATE INDEX IF NOT EXISTS idx_users_aadhaar_number ON public.users(aadhaar_number) WHERE aadhaar_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_license_number ON public.users(license_number) WHERE license_number IS NOT NULL;

-- 3. Update handle_new_user() trigger function
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
    state,
    aadhaar_number,
    license_number
  )
  VALUES (
    NEW.id,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email),
    COALESCE(NEW.email, ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'phone', ''), ''),
    'operator', -- Enforce non-privileged default role
    'pending',  -- Strictly require administrator approval before activation
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'city', ''), ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'district', ''), ''),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'state', ''), ''),
    NULLIF(NEW.raw_user_meta_data->>'aadhaar_number', ''),
    NULLIF(NEW.raw_user_meta_data->>'license_number', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    city = EXCLUDED.city,
    district = EXCLUDED.district,
    state = EXCLUDED.state,
    aadhaar_number = COALESCE(EXCLUDED.aadhaar_number, public.users.aadhaar_number),
    license_number = COALESCE(EXCLUDED.license_number, public.users.license_number),
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
