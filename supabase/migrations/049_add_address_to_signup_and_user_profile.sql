-- ==============================================================================
-- Migration 049: Add Address To Signup & User Profile Completeness Evaluation
-- 1. Ensures address column exists on public.users.
-- 2. Updates handle_new_user() trigger to capture address from registration metadata
--    and evaluate address presence for complete_profile = 'yes' determination.
-- 3. Synchronizes trigger on auth.users.
-- ==============================================================================

-- 1. Ensure address column exists on public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS address TEXT;

-- 2. Update handle_new_user() trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_full_name TEXT;
  v_phone TEXT;
  v_role TEXT;
  v_city TEXT;
  v_district TEXT;
  v_state TEXT;
  v_aadhaar TEXT;
  v_license TEXT;
  v_address TEXT;
  v_shift_time TEXT;
  v_complete_profile TEXT := 'no';
BEGIN
  v_full_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  v_phone := COALESCE(NULLIF(NEW.raw_user_meta_data->>'phone', ''), '');
  v_role := COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'operator');
  v_city := COALESCE(NULLIF(NEW.raw_user_meta_data->>'city', ''), '');
  v_district := COALESCE(NULLIF(NEW.raw_user_meta_data->>'district', ''), '');
  v_state := COALESCE(NULLIF(NEW.raw_user_meta_data->>'state', ''), '');
  v_aadhaar := NULLIF(NEW.raw_user_meta_data->>'aadhaar_number', '');
  v_license := NULLIF(NEW.raw_user_meta_data->>'license_number', '');
  v_address := NULLIF(NEW.raw_user_meta_data->>'address', '');
  v_shift_time := NULLIF(NEW.raw_user_meta_data->>'shift_time', '');

  -- Check if profile is complete upon registration (including mandatory address)
  IF btrim(v_full_name) <> '' 
     AND v_full_name <> NEW.email
     AND btrim(v_phone) <> ''
     AND btrim(v_city) <> ''
     AND btrim(v_district) <> ''
     AND btrim(v_state) <> ''
     AND v_address IS NOT NULL AND btrim(v_address) <> ''
     AND v_shift_time IS NOT NULL AND btrim(v_shift_time) <> ''
     AND v_aadhaar IS NOT NULL AND btrim(v_aadhaar) <> '' THEN
    v_complete_profile := 'yes';
  ELSE
    v_complete_profile := 'no';
  END IF;

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
    license_number,
    address,
    shift_time,
    complete_profile
  )
  VALUES (
    NEW.id,
    v_full_name,
    COALESCE(NEW.email, ''),
    v_phone,
    v_role,
    'pending',
    v_city,
    v_district,
    v_state,
    v_aadhaar,
    v_license,
    v_address,
    v_shift_time,
    v_complete_profile
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
    address = COALESCE(EXCLUDED.address, public.users.address),
    shift_time = COALESCE(EXCLUDED.shift_time, public.users.shift_time),
    complete_profile = CASE
      WHEN public.users.complete_profile = 'yes' THEN 'yes'
      ELSE EXCLUDED.complete_profile
    END,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 3. Ensure trigger is attached to auth.users
DROP TRIGGER IF EXISTS trigger_on_auth_user_created ON auth.users;
CREATE TRIGGER trigger_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Atomic RPC: complete_user_onboarding_atomic with valid JSONB audit details
CREATE OR REPLACE FUNCTION public.complete_user_onboarding_atomic(
  p_user_id UUID,
  p_full_name TEXT,
  p_phone TEXT,
  p_role TEXT,
  p_shift_time TEXT,
  p_address TEXT,
  p_city TEXT,
  p_district TEXT,
  p_state TEXT,
  p_state_id INT DEFAULT NULL,
  p_aadhaar_number TEXT DEFAULT NULL,
  p_license_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_clean_aadhaar TEXT;
  v_clean_phone TEXT;
  v_clean_name TEXT;
  v_updated_user RECORD;
  v_audit_meta JSONB;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  -- Only self or administrators can complete onboarding for a user
  IF v_caller_id <> p_user_id AND public.current_user_role() NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized to complete onboarding for this user.' USING ERRCODE = '42501';
  END IF;

  v_clean_name := btrim(COALESCE(p_full_name, ''));
  v_clean_phone := btrim(COALESCE(p_phone, ''));
  v_clean_aadhaar := regexp_replace(COALESCE(p_aadhaar_number, ''), '\D', '', 'g');

  IF length(v_clean_name) < 2 THEN
    RAISE EXCEPTION 'Full name is required (minimum 2 characters).' USING ERRCODE = '23514';
  END IF;

  IF length(v_clean_phone) < 10 THEN
    RAISE EXCEPTION 'Valid 10-digit mobile phone number is required.' USING ERRCODE = '23514';
  END IF;

  IF btrim(COALESCE(p_shift_time, '')) = '' THEN
    RAISE EXCEPTION 'Shift timing is required.' USING ERRCODE = '23514';
  END IF;

  IF btrim(COALESCE(p_city, '')) = '' OR btrim(COALESCE(p_district, '')) = '' OR btrim(COALESCE(p_state, '')) = '' THEN
    RAISE EXCEPTION 'Work location (City, District, State) is required.' USING ERRCODE = '23514';
  END IF;

  IF length(v_clean_aadhaar) <> 12 THEN
    RAISE EXCEPTION 'Valid 12-digit Aadhaar number is required.' USING ERRCODE = '23514';
  END IF;

  UPDATE public.users
  SET
    full_name = v_clean_name,
    phone = v_clean_phone,
    role = COALESCE(NULLIF(btrim(p_role), ''), public.users.role),
    shift_time = btrim(p_shift_time),
    address = NULLIF(btrim(p_address), ''),
    city = btrim(p_city),
    district = btrim(p_district),
    state = btrim(p_state),
    state_id = p_state_id,
    aadhaar_number = v_clean_aadhaar,
    license_number = NULLIF(btrim(p_license_number), ''),
    complete_profile = 'yes',
    updated_at = NOW()
  WHERE id = p_user_id
  RETURNING * INTO v_updated_user;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found.' USING ERRCODE = 'P0002';
  END IF;

  v_audit_meta := jsonb_build_object(
    'complete_profile', 'yes',
    'role', v_updated_user.role,
    'shift_time', v_updated_user.shift_time,
    'state', v_updated_user.state,
    'address', v_updated_user.address,
    'city', v_updated_user.city,
    'district', v_updated_user.district,
    'aadhaar_number', v_updated_user.aadhaar_number
  );

  -- Structured audit log (passing valid JSONB to metadata and details)
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    details,
    created_at
  ) VALUES (
    v_caller_id,
    'user.onboarding_completed',
    'users',
    p_user_id,
    v_audit_meta,
    v_audit_meta,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_updated_user.id,
    'complete_profile', v_updated_user.complete_profile,
    'role', v_updated_user.role
  );
END;
$$;
