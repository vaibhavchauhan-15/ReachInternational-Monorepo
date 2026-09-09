-- Migration 055: Add working_locations table, add working_location_id to users, update handle_new_user trigger, and add public RPC

-- 1. Create public.working_locations table
CREATE TABLE IF NOT EXISTS public.working_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'site' CHECK (type IN ('yard', 'workshop', 'office', 'warehouse', 'site')),
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Enable RLS and add read policy
ALTER TABLE public.working_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS working_locations_select_policy ON public.working_locations;
CREATE POLICY working_locations_select_policy ON public.working_locations
  FOR SELECT USING (true);

DROP POLICY IF EXISTS working_locations_admin_all_policy ON public.working_locations;
CREATE POLICY working_locations_admin_all_policy ON public.working_locations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE public.users.id = auth.uid()
      AND public.users.role IN ('admin', 'super_admin')
    )
  );

-- 3. Add working_location_id column to public.users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS working_location_id UUID REFERENCES public.working_locations(id) ON DELETE SET NULL;

-- 4. Add B-tree index on working_location_id
CREATE INDEX IF NOT EXISTS idx_users_working_location_id ON public.users(working_location_id);

-- 5. Seed initial default working locations if table is empty
INSERT INTO public.working_locations (name, type, address, city, state, pincode, status)
SELECT * FROM (VALUES
  ('Head Office - Mumbai', 'office', 'Nariman Point, Marine Drive', 'Mumbai', 'Maharashtra', '400021', 'active'),
  ('Pune MIDC Yard', 'yard', 'MIDC Phase II, Chakan', 'Pune', 'Maharashtra', '410501', 'active'),
  ('Ahmedabad Heavy Workshop', 'workshop', 'GIDC Vatva Industrial Estate', 'Ahmedabad', 'Gujarat', '382445', 'active'),
  ('Delhi NCR Hub', 'warehouse', 'Udyog Vihar Phase 4', 'Gurugram', 'Haryana', '122016', 'active'),
  ('Bengaluru Site Depot', 'site', 'Peenya Industrial Area 2nd Stage', 'Bengaluru', 'Karnataka', '560058', 'active'),
  ('Hyderabad Service Centre', 'workshop', 'Balanagar Industrial Area', 'Hyderabad', 'Telangana', '500037', 'active')
) AS v(name, type, address, city, state, pincode, status)
WHERE NOT EXISTS (SELECT 1 FROM public.working_locations LIMIT 1);

-- 6. Update handle_new_user() trigger function to persist working_location_id and supervisor_id
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
  v_working_location_id UUID := NULL;
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

  -- Parse working_location_id
  BEGIN
    IF NULLIF(NEW.raw_user_meta_data->>'working_location_id', '') IS NOT NULL THEN
      v_working_location_id := (NEW.raw_user_meta_data->>'working_location_id')::UUID;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_working_location_id := NULL;
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
    working_location_id,
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
    v_working_location_id,
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
    working_location_id = COALESCE(EXCLUDED.working_location_id, public.users.working_location_id),
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

-- 7. Create public RPC to fetch active working locations for registration without auth requirements
CREATE OR REPLACE FUNCTION public.get_active_working_locations_public()
RETURNS TABLE (
  id UUID,
  name TEXT,
  type TEXT,
  city TEXT,
  state TEXT,
  address TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  SELECT id, name, type, city, state, address
  FROM public.working_locations
  WHERE status = 'active'
  ORDER BY name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_working_locations_public() TO anon, authenticated;
COMMENT ON FUNCTION public.get_active_working_locations_public() IS 'Returns active working locations for signup and user profile selectors.';
