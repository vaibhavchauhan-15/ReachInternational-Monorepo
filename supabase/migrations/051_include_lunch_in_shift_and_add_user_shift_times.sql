-- ==============================================================================
-- Migration 051: Include Lunch In Shift Duration & Add User Shift Start/End Columns
-- 1. Adds shift_start_time and shift_end_time (TIME) columns to public.users.
-- 2. Updates handle_new_user() trigger to persist shift_start_time and shift_end_time.
-- 3. Resiliently backfills shift_start_time and shift_end_time from existing users.shift_time.
-- 4. Updates auto_calculate_machine_hour_log_overtime() trigger on public.machine_hour_logs:
--    - Removes the -1.0 hour lunch break deduction (lunch is included in the shift duration).
--    - Overtime begins after 8.0 hours of shift time (e.g. 6:00 AM - 2:00 PM yields 8.0 hours normal work).
--    - Normal working hours = Total Duration - Overtime.
-- 5. Recalculates normal_working_hours for existing machine_hour_logs with valid timestamps.
-- ==============================================================================

-- 1. Add shift_start_time and shift_end_time columns to public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS shift_start_time TIME;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS shift_end_time TIME;

-- 2. Resilient backfill for existing users
DO $$
DECLARE
  r RECORD;
  v_parts TEXT[];
  v_start TIME;
  v_end TIME;
BEGIN
  FOR r IN 
    SELECT id, shift_time 
    FROM public.users 
    WHERE shift_time IS NOT NULL 
      AND btrim(shift_time) <> '' 
      AND (shift_start_time IS NULL OR shift_end_time IS NULL)
  LOOP
    BEGIN
      -- Split on dash variants
      v_parts := regexp_split_to_array(r.shift_time, '\s*[-–—]\s*');
      IF array_length(v_parts, 1) = 2 THEN
        v_start := v_parts[1]::TIME;
        v_end := v_parts[2]::TIME;
        UPDATE public.users 
        SET shift_start_time = COALESCE(shift_start_time, v_start),
            shift_end_time = COALESCE(shift_end_time, v_end)
        WHERE id = r.id;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Silently skip unparseable text
      NULL;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 3. Update handle_new_user() trigger function
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
    shift_start_time,
    shift_end_time,
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

-- 4. Update auto_calculate_machine_hour_log_overtime() (Removing -1.0h lunch break deduction)
CREATE OR REPLACE FUNCTION public.auto_calculate_machine_hour_log_overtime()
RETURNS TRIGGER AS $$
DECLARE
  v_duration_hours NUMERIC;
BEGIN
  IF NEW.start_datetime IS NOT NULL AND NEW.end_datetime IS NOT NULL THEN
    v_duration_hours := ROUND(EXTRACT(EPOCH FROM (NEW.end_datetime - NEW.start_datetime)) / 3600.0, 2);

    -- Auto-calculate overtime if not explicitly set (overtime after 8.0 hours of shift; lunch included in shift time)
    IF NEW.overtime_hours IS NULL OR NEW.overtime_hours = 0 THEN
      IF v_duration_hours > 8.0 THEN
        NEW.overtime_hours := ROUND(v_duration_hours - 8.0, 2);
      ELSE
        NEW.overtime_hours := 0.0;
      END IF;
    END IF;

    -- Normal working hours: Total Duration - Overtime (lunch time included in shift, no -1h break deduction)
    NEW.normal_working_hours := GREATEST(0.0, ROUND((v_duration_hours - COALESCE(NEW.overtime_hours, 0.0)), 2));
  ELSE
    NEW.normal_working_hours := 0.0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_calculate_machine_hour_log_overtime ON public.machine_hour_logs;
CREATE TRIGGER trg_auto_calculate_machine_hour_log_overtime
  BEFORE INSERT OR UPDATE ON public.machine_hour_logs
  FOR EACH ROW EXECUTE FUNCTION public.auto_calculate_machine_hour_log_overtime();

-- 5. Recalculate normal_working_hours for existing machine hour logs
UPDATE public.machine_hour_logs
SET normal_working_hours = GREATEST(0.0, ROUND((EXTRACT(EPOCH FROM (end_datetime - start_datetime)) / 3600.0 - COALESCE(overtime_hours, 0.0)), 2))
WHERE start_datetime IS NOT NULL AND end_datetime IS NOT NULL;
