-- ==============================================================================
-- Migration 027: Preserve Selected User Role on Signup & Approval
-- 1. Updates handle_new_user() trigger function to extract and assign the user's
--    selected role from registration metadata (raw_user_meta_data->>'role').
-- 2. Enforces canonical non-admin roles during self-registration:
--    'manager', 'service_manager', 'service_engineer', 'engineer',
--    'supervisor', 'store_manager', 'operator', 'mechanic', 'hr_manager'.
-- 3. Backfills existing pending user records in public.users to match their
--    requested signup role in auth.users.
-- ==============================================================================

-- 1. Update handle_new_user() trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_status TEXT;
BEGIN
  -- Extract requested role from raw_user_meta_data
  v_role := NULLIF(NEW.raw_user_meta_data->>'role', '');
  
  -- Validate against canonical allowed self-registration roles
  -- Note: admin and super_admin cannot be self-assigned; if attempted during self-signup, fallback to 'operator'
  IF v_role IS NULL OR v_role NOT IN (
    'manager',
    'service_manager',
    'service_engineer',
    'engineer',
    'supervisor',
    'store_manager',
    'operator',
    'mechanic',
    'hr_manager'
  ) THEN
    -- If created by admin via admin API with status 'active', allow admin / super_admin
    IF v_role IN ('admin', 'super_admin') AND (NEW.raw_user_meta_data->>'status') = 'active' THEN
      -- Keep admin role for direct admin creation
      NULL;
    ELSE
      v_role := 'operator';
    END IF;
  END IF;

  v_status := COALESCE(NULLIF(NEW.raw_user_meta_data->>'status', ''), 'pending');

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
    v_role,
    v_status,
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
    role = CASE 
      WHEN public.users.status = 'pending' THEN EXCLUDED.role 
      ELSE public.users.role 
    END,
    city = EXCLUDED.city,
    district = EXCLUDED.district,
    state = EXCLUDED.state,
    aadhaar_number = COALESCE(EXCLUDED.aadhaar_number, public.users.aadhaar_number),
    license_number = COALESCE(EXCLUDED.license_number, public.users.license_number),
    updated_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Re-attach trigger to auth.users
DROP TRIGGER IF EXISTS trigger_on_auth_user_created ON auth.users;
CREATE TRIGGER trigger_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill any existing pending users whose role was set to 'operator' while their auth metadata had another valid role
UPDATE public.users u
SET role = a.raw_user_meta_data->>'role',
    updated_at = NOW()
FROM auth.users a
WHERE u.id = a.id
  AND u.status = 'pending'
  AND a.raw_user_meta_data->>'role' IS NOT NULL
  AND a.raw_user_meta_data->>'role' IN (
    'manager',
    'service_manager',
    'service_engineer',
    'engineer',
    'supervisor',
    'store_manager',
    'operator',
    'mechanic',
    'hr_manager'
  )
  AND u.role != (a.raw_user_meta_data->>'role');
