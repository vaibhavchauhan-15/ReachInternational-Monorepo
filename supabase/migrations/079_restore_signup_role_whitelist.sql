-- ==============================================================================
-- Migration 079: Restore Signup Role Whitelist in handle_new_user() Trigger
-- Security Fix: REV-H01 (CWE-269) — Prevent self-privilege escalation during registration.
-- Restores the canonical role allowlist from Migration 027 that was omitted in
-- Migration 056, guaranteeing that unapproved roles (such as 'admin' and 'super_admin')
-- cannot be self-assigned via Supabase Auth signup metadata (mobile client or direct API).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
  v_supervisor_ids UUID[] := '{}';
  v_working_location_id UUID := NULL;
  v_complete_profile TEXT := 'no';
  v_parts TEXT[];
  v_sup_raw JSONB;
  v_sup_elem TEXT;
BEGIN
  v_full_name := COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  v_phone := COALESCE(NULLIF(NEW.raw_user_meta_data->>'phone', ''), '');

  -- SECURITY (REV-H01): Enforce canonical non-admin roles during self-registration.
  -- 'admin' and 'super_admin' cannot be self-assigned via signup metadata.
  v_role := NULLIF(NEW.raw_user_meta_data->>'role', '');
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
    v_role := 'operator';
  END IF;

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

  -- Parse supervisor_ids if passed as JSON array
  BEGIN
    v_sup_raw := NEW.raw_user_meta_data->'supervisor_ids';
    IF v_sup_raw IS NOT NULL AND jsonb_typeof(v_sup_raw) = 'array' THEN
      FOR v_sup_elem IN SELECT jsonb_array_elements_text(v_sup_raw)
      LOOP
        IF v_sup_elem ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
          v_supervisor_ids := array_append(v_supervisor_ids, v_sup_elem::UUID);
        END IF;
      END LOOP;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_supervisor_ids := '{}';
  END;

  -- If supervisor_id exists but supervisor_ids is empty, initialize array
  IF v_supervisor_id IS NOT NULL AND cardinality(v_supervisor_ids) = 0 THEN
    v_supervisor_ids := ARRAY[v_supervisor_id];
  ELSIF cardinality(v_supervisor_ids) > 0 AND v_supervisor_id IS NULL THEN
    v_supervisor_id := v_supervisor_ids[1];
  END IF;

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
    supervisor_ids,
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
    v_supervisor_ids,
    v_working_location_id,
    v_complete_profile
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    -- SECURITY (REV-H01): Do NOT overwrite role from EXCLUDED on conflict to prevent re-escalation
    city = EXCLUDED.city,
    district = EXCLUDED.district,
    state = EXCLUDED.state,
    aadhaar_number = EXCLUDED.aadhaar_number,
    license_number = EXCLUDED.license_number,
    address = EXCLUDED.address,
    shift_time = EXCLUDED.shift_time,
    shift_start_time = EXCLUDED.shift_start_time,
    shift_end_time = EXCLUDED.shift_end_time,
    supervisor_id = EXCLUDED.supervisor_id,
    supervisor_ids = EXCLUDED.supervisor_ids,
    working_location_id = EXCLUDED.working_location_id,
    complete_profile = EXCLUDED.complete_profile;

  RETURN NEW;
END;
$$;
