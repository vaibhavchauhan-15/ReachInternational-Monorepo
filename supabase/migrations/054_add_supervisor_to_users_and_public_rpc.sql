-- Migration 054: Add supervisor_id to public.users, update handle_new_user trigger, and add public get_active_supervisors RPC

-- 1. Add supervisor_id column to public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. Add B-tree index on supervisor_id for fast joins and filtering
CREATE INDEX IF NOT EXISTS idx_users_supervisor_id ON public.users(supervisor_id);

-- 3. Update handle_new_user() trigger function to persist supervisor_id
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
  v_shift_start_time TIME := NULL;
  v_shift_end_time TIME := NULL;
  v_supervisor_id UUID := NULL;
  v_complete_profile TEXT := 'no';
  v_parts TEXT[];
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

  -- Parse supervisor_id
  BEGIN
    IF NULLIF(NEW.raw_user_meta_data->>'supervisor_id', '') IS NOT NULL THEN
      v_supervisor_id := (NEW.raw_user_meta_data->>'supervisor_id')::UUID;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_supervisor_id := NULL;
  END;

  -- Parse shift_start_time & shift_end_time
  BEGIN
    IF NULLIF(NEW.raw_user_meta_data->>'shift_start_time', '') IS NOT NULL THEN
      v_shift_start_time := (NEW.raw_user_meta_data->>'shift_start_time')::TIME;
    END IF;
    IF NULLIF(NEW.raw_user_meta_data->>'shift_end_time', '') IS NOT NULL THEN
      v_shift_end_time := (NEW.raw_user_meta_data->>'shift_end_time')::TIME;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_shift_start_time := NULL;
    v_shift_end_time := NULL;
  END;

  -- Fallback parse from shift_time if direct fields are unset
  IF (v_shift_start_time IS NULL OR v_shift_end_time IS NULL) AND v_shift_time IS NOT NULL THEN
    BEGIN
      v_parts := regexp_split_to_array(v_shift_time, '\s*[-–—]\s*');
      IF array_length(v_parts, 1) = 2 THEN
        IF v_shift_start_time IS NULL THEN v_shift_start_time := v_parts[1]::TIME; END IF;
        IF v_shift_end_time IS NULL THEN v_shift_end_time := v_parts[2]::TIME; END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  -- Check if profile is complete upon registration
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
    shift_start_time,
    shift_end_time,
    supervisor_id,
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
    v_shift_start_time,
    v_shift_end_time,
    v_supervisor_id,
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
    shift_start_time = COALESCE(EXCLUDED.shift_start_time, public.users.shift_start_time),
    shift_end_time = COALESCE(EXCLUDED.shift_end_time, public.users.shift_end_time),
    supervisor_id = COALESCE(EXCLUDED.supervisor_id, public.users.supervisor_id),
    complete_profile = CASE
      WHEN public.users.complete_profile = 'yes' THEN 'yes'
      ELSE EXCLUDED.complete_profile
    END,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Create public RPC to fetch active supervisors for registration without exposing PII
CREATE OR REPLACE FUNCTION public.get_active_supervisors_public()
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  email TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT id, full_name, email
  FROM public.users
  WHERE role = 'supervisor' AND status = 'active'
  ORDER BY full_name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_supervisors_public() TO anon, authenticated;
COMMENT ON FUNCTION public.get_active_supervisors_public() IS 'Returns non-sensitive list of active supervisors for signup and user assignment selectors.';