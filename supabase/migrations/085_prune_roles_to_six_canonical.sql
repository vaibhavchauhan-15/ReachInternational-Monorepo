-- Migration 085: Prune System Roles to 6 Canonical Roles & Update Database Policies
-- Canonical Roles: 'super_admin', 'admin', 'manager', 'supervisor', 'hr', 'operator'

-- 1. Migrate existing users with 'hr_manager' to 'hr'
UPDATE public.users 
SET role = 'hr' 
WHERE role = 'hr_manager';

UPDATE auth.users 
SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', '"hr"')
WHERE raw_user_meta_data->>'role' = 'hr_manager';

-- 2. Update users_role_check constraint on public.users
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
  CHECK (role = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'supervisor'::text, 'hr'::text, 'operator'::text]));

-- 3. Update public.users RLS Policies
DROP POLICY IF EXISTS "users_select_management" ON public.users;
CREATE POLICY "users_select_management" ON public.users
  FOR SELECT USING (
    (SELECT current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'hr'::text])
  );

DROP POLICY IF EXISTS "users_select_supervisor_scoped" ON public.users;
CREATE POLICY "users_select_supervisor_scoped" ON public.users
  FOR SELECT USING (
    ((SELECT current_user_role()) = 'supervisor'::text)
    AND (role = 'operator'::text)
    AND ((supervisor_id = (SELECT auth.uid())) OR (supervisor_ids @> ARRAY[(SELECT auth.uid())]))
  );

-- 4. Update public.machines RLS Policies
DROP POLICY IF EXISTS "machines_delete_authorized" ON public.machines;
CREATE POLICY "machines_delete_authorized" ON public.machines
  FOR DELETE USING (
    (SELECT current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text])
  );

DROP POLICY IF EXISTS "machines_insert_authorized" ON public.machines;
CREATE POLICY "machines_insert_authorized" ON public.machines
  FOR INSERT WITH CHECK (
    (SELECT current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text])
  );

DROP POLICY IF EXISTS "machines_update_authorized" ON public.machines;
CREATE POLICY "machines_update_authorized" ON public.machines
  FOR UPDATE USING (
    ((SELECT current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'supervisor'::text]))
    OR (((SELECT current_user_role()) = 'operator'::text) AND (((SELECT auth.uid()) = ANY (operator_ids)) OR (current_operator_id = (SELECT auth.uid())) OR (current_operator_id IS NULL) OR (operator_ids = '{}'::uuid[])))
  ) WITH CHECK (true);

-- 5. Update public.clients RLS Policies
DROP POLICY IF EXISTS "clients_select_policy" ON public.clients;
CREATE POLICY "clients_select_policy" ON public.clients
  FOR SELECT USING (
    (deleted_at IS NULL) OR ((SELECT current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text]))
  );

DROP POLICY IF EXISTS "clients_insert_policy" ON public.clients;
CREATE POLICY "clients_insert_policy" ON public.clients
  FOR INSERT WITH CHECK (
    (SELECT current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text])
  );

DROP POLICY IF EXISTS "clients_update_policy" ON public.clients;
CREATE POLICY "clients_update_policy" ON public.clients
  FOR UPDATE USING (
    (SELECT current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text])
  );

DROP POLICY IF EXISTS "clients_delete_policy" ON public.clients;
CREATE POLICY "clients_delete_policy" ON public.clients
  FOR DELETE USING (
    (SELECT current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text])
  );

-- 6. Update public.profile_change_requests RLS Policies
DROP POLICY IF EXISTS "profile_change_requests_select" ON public.profile_change_requests;
CREATE POLICY "profile_change_requests_select" ON public.profile_change_requests
  FOR SELECT USING (
    (user_id = auth.uid()) OR (current_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'hr'::text]))
  );

DROP POLICY IF EXISTS "profile_change_requests_update_authorized" ON public.profile_change_requests;
CREATE POLICY "profile_change_requests_update_authorized" ON public.profile_change_requests
  FOR UPDATE USING (
    ((user_id = auth.uid()) AND (status = 'pending'::text)) OR (current_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'hr'::text]))
  ) WITH CHECK (
    (((user_id = auth.uid()) AND (status = ANY (ARRAY['pending'::text, 'cancelled'::text]))) OR (current_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'hr'::text])))
  );

-- 7. Update operator_shift_ranges and operator_machine_assignments RLS Policies
DROP POLICY IF EXISTS "osr_manage_policy" ON public.operator_shift_ranges;
CREATE POLICY "osr_manage_policy" ON public.operator_shift_ranges
  FOR ALL USING (
    current_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'supervisor'::text])
  ) WITH CHECK (
    current_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'supervisor'::text])
  );

DROP POLICY IF EXISTS "osr_select_policy" ON public.operator_shift_ranges;
CREATE POLICY "osr_select_policy" ON public.operator_shift_ranges
  FOR SELECT USING (
    (current_user_role() = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'supervisor'::text])) OR (operator_id = auth.uid())
  );

DROP POLICY IF EXISTS "oma_select_policy" ON public.operator_machine_assignments;
CREATE POLICY "oma_select_policy" ON public.operator_machine_assignments
  FOR SELECT USING (
    ((SELECT current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'supervisor'::text])) OR (operator_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "oma_manage_policy" ON public.operator_machine_assignments;
CREATE POLICY "oma_manage_policy" ON public.operator_machine_assignments
  FOR ALL USING (
    (SELECT current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'supervisor'::text])
  ) WITH CHECK (
    (SELECT current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'supervisor'::text])
  );

-- 8. Update public.audit_logs RLS Policy
DROP POLICY IF EXISTS "audit_logs_select_hierarchical" ON public.audit_logs;
CREATE POLICY "audit_logs_select_hierarchical" ON public.audit_logs
  FOR SELECT USING (
    CASE current_user_role()
      WHEN 'super_admin'::text THEN true
      WHEN 'admin'::text THEN true
      WHEN 'manager'::text THEN ((category IS DISTINCT FROM 'security'::text) OR (severity IS DISTINCT FROM 'critical'::text))
      WHEN 'hr'::text THEN (category = ANY (ARRAY['auth'::text, 'user'::text, 'profile'::text]))
      WHEN 'supervisor'::text THEN (category = ANY (ARRAY['assignment'::text, 'machine'::text, 'operations'::text, 'auth'::text]))
      ELSE (user_id = auth.uid())
    END
  );

-- 9. Update Database Functions & Triggers

-- enforce_machine_supervisor_change_role
CREATE OR REPLACE FUNCTION public.enforce_machine_supervisor_change_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (OLD.current_supervisor_id IS DISTINCT FROM NEW.current_supervisor_id) THEN
    IF NOT (
      public.current_user_role() IN ('super_admin', 'admin', 'manager')
      OR auth.uid() IS NULL
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Only Manager or above can assign, change, or unassign machine supervisor.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- handle_new_user (self-registration)
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

  -- Canonical non-admin signup roles: 'manager', 'supervisor', 'hr', 'operator'
  v_role := NULLIF(NEW.raw_user_meta_data->>'role', '');
  IF v_role IS NULL OR v_role NOT IN ('manager', 'supervisor', 'hr', 'operator') THEN
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

-- get_users_directory_summary
CREATE OR REPLACE FUNCTION public.get_users_directory_summary(p_supervisor_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total', COUNT(*)::bigint,
    'active', COUNT(*) FILTER (WHERE status = 'active')::bigint,
    'engineers', COUNT(*) FILTER (WHERE role = 'operator')::bigint,
    'operators', COUNT(*) FILTER (WHERE role = 'operator')::bigint,
    'new_registrations', COUNT(*) FILTER (WHERE status = 'pending')::bigint,
    'states', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', sub.state_key,
            'label', sub.state_label
          )
          ORDER BY sub.state_label ASC
        )
        FROM (
          SELECT DISTINCT ON (COALESCE(state_id::text, lower(trim(state))))
            COALESCE(state_id::text, lower(trim(state))) AS state_key,
            trim(state) AS state_label
          FROM public.users
          WHERE state IS NOT NULL AND trim(state) <> ''
            AND (
              p_supervisor_id IS NULL
              OR (
                (supervisor_id = p_supervisor_id OR supervisor_ids @> ARRAY[p_supervisor_id])
                AND role = 'operator'
              )
            )
          ORDER BY COALESCE(state_id::text, lower(trim(state))), trim(state)
        ) sub
      ),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM public.users
  WHERE (
    p_supervisor_id IS NULL
    OR (
      (supervisor_id = p_supervisor_id OR supervisor_ids @> ARRAY[p_supervisor_id])
      AND role = 'operator'
    )
  );

  RETURN v_result;
END;
$$;
