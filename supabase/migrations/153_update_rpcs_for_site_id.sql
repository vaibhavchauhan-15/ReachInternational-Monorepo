-- ============================================================================
-- Migration 153: Client Sites Normalization — Phase C: Update RPCs for site_id
-- Target Dev Project: vlmxciuogczumumrwyot
-- Idempotent & non-breaking
-- ============================================================================

-- 1. Update get_clients_directory_summary to return active sites count from public.client_sites
CREATE OR REPLACE FUNCTION public.get_clients_directory_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total', COUNT(*)::bigint,
    'active', COUNT(*) FILTER (WHERE status = 'active' AND deleted_at IS NULL)::bigint,
    'inactive', COUNT(*) FILTER (WHERE status = 'inactive' OR deleted_at IS NOT NULL)::bigint,
    'cities', COUNT(DISTINCT NULLIF(btrim(city), ''))::bigint,
    'cities_list', COALESCE(
      (
        SELECT jsonb_agg(city ORDER BY city ASC)
        FROM (
          SELECT DISTINCT btrim(city) AS city
          FROM public.clients
          WHERE deleted_at IS NULL AND city IS NOT NULL AND btrim(city) <> ''
        ) sub
      ),
      '[]'::jsonb
    ),
    'sites_count', (
      SELECT COUNT(*)::bigint FROM public.client_sites WHERE status = 'active'
    )::bigint
  )
  INTO v_result
  FROM public.clients;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_clients_directory_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_clients_directory_summary() TO service_role;

-- 2. Update submit_operator_hour_log_atomic to resolve and record site_id
CREATE OR REPLACE FUNCTION public.submit_operator_hour_log_atomic(
  p_machine_id uuid,
  p_operator_id uuid,
  p_client_id uuid DEFAULT NULL::uuid,
  p_shift_code text DEFAULT NULL::text,
  p_log_date date DEFAULT NULL::date,
  p_end_date date DEFAULT NULL::date,
  p_start_datetime timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_end_datetime timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_start_meter numeric DEFAULT 0,
  p_end_meter numeric DEFAULT 0,
  p_start_time text DEFAULT NULL::text,
  p_end_time text DEFAULT NULL::text,
  p_overtime_hours numeric DEFAULT 0,
  p_normal_working_hours numeric DEFAULT 8,
  p_is_breakdown boolean DEFAULT false,
  p_breakdown_start_time text DEFAULT NULL::text,
  p_breakdown_end_time text DEFAULT NULL::text,
  p_breakdown_duration text DEFAULT NULL::text,
  p_breakdown_hours numeric DEFAULT 0,
  p_shift text DEFAULT NULL::text,
  p_machine_condition text DEFAULT 'good'::text,
  p_location text DEFAULT NULL::text,
  p_remarks text DEFAULT NULL::text,
  p_idempotency_key text DEFAULT NULL::text,
  p_entered_by uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_actor_id UUID;
  v_entry_source TEXT;
  v_log_id UUID;
  v_audit_meta JSONB;
  v_resolved_client_id UUID;
  v_resolved_site_id UUID;
  v_resolved_location TEXT := p_location;
  v_idempotency_key TEXT;
  v_start_time TIME;
  v_end_time TIME;
  v_breakdown_start_time TIME;
  v_breakdown_end_time TIME;
  v_log_date DATE;
  v_end_date DATE;
  v_start_datetime TIMESTAMPTZ;
  v_end_datetime TIMESTAMPTZ;
  v_shift_code TEXT;
  v_shift_name TEXT;
  v_normal_hours NUMERIC;
  v_caller_role TEXT;
  v_breakdown_minutes INTEGER;
  v_maintenance_minutes INTEGER;
  v_shift_duration_hours NUMERIC;
  v_assigned_shift_codes TEXT[];
  v_is_assisted_override BOOLEAN := false;
BEGIN
  -- 1. Determine actor and entry attribution
  v_actor_id := COALESCE(p_entered_by, auth.uid(), p_operator_id);

  IF v_actor_id = p_operator_id THEN
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_actor_id;
    IF v_caller_role != 'operator' AND v_caller_role NOT IN ('super_admin', 'admin', 'manager') THEN
      RAISE EXCEPTION 'Not authorized to submit shift log'
        USING ERRCODE = '42501';
    END IF;
    v_entry_source := 'operator';
  ELSE
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_actor_id;
    IF v_caller_role NOT IN ('super_admin', 'admin', 'manager') THEN
      RAISE EXCEPTION 'Not authorized to enter shift logs. Only roles above supervisor (manager, admin, super_admin) are permitted.'
        USING ERRCODE = '42501';
    END IF;
    v_entry_source := v_caller_role;
  END IF;

  -- 2. Meter Regression & Maximum Running Hours Guard
  IF p_end_meter < p_start_meter THEN
    RAISE EXCEPTION 'End meter reading (%) cannot be less than start meter reading (%)', p_end_meter, p_start_meter
      USING ERRCODE = '23514';
  END IF;

  IF (p_end_meter - p_start_meter) > 24 THEN
    RAISE EXCEPTION 'Machine running hours (%) cannot exceed 24 hours in a single log', (p_end_meter - p_start_meter)
      USING ERRCODE = '23514';
  END IF;

  -- 3. Machine Operational Status Guard
  IF EXISTS (
    SELECT 1 FROM public.machines
    WHERE id = p_machine_id AND (status = 'inactive' OR health_status = 'under_maintenance')
  ) THEN
    RAISE EXCEPTION 'Cannot record machine log for equipment currently in maintenance or inactive status'
      USING ERRCODE = '23514';
  END IF;

  -- 4. Normalization
  v_log_date := COALESCE(p_log_date, (NOW() AT TIME ZONE 'Asia/Kolkata')::date);
  v_end_date := COALESCE(p_end_date, v_log_date);
  v_start_time := NULLIF(TRIM(p_start_time), '')::TIME;
  v_end_time := NULLIF(TRIM(p_end_time), '')::TIME;
  v_breakdown_start_time := NULLIF(TRIM(p_breakdown_start_time), '')::TIME;
  v_breakdown_end_time := NULLIF(TRIM(p_breakdown_end_time), '')::TIME;
  v_start_datetime := p_start_datetime;
  v_end_datetime := p_end_datetime;

  IF v_start_datetime IS NULL AND v_start_time IS NOT NULL THEN
    v_start_datetime := ((v_log_date::text || ' ' || v_start_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata');
  END IF;

  IF v_end_datetime IS NULL AND v_end_time IS NOT NULL THEN
    IF v_end_time < v_start_time AND v_end_date = v_log_date THEN
      v_end_date := (v_log_date + INTERVAL '1 day')::date;
    END IF;
    v_end_datetime := ((v_end_date::text || ' ' || v_end_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata');
  END IF;

  -- 5. Operator 7-Day Window Guard
  IF v_entry_source = 'operator' THEN
    IF v_log_date < (CURRENT_DATE - 7) OR v_log_date > CURRENT_DATE THEN
      RAISE EXCEPTION 'Operators can only record logs within the previous 7 days (date %, allowed: % to %)',
        v_log_date, (CURRENT_DATE - 7), CURRENT_DATE
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- 6. Shift Code and Name Resolution
  v_shift_code := NULLIF(TRIM(COALESCE(p_shift_code, p_shift)), '');
  IF v_shift_code IS NOT NULL THEN
    v_shift_code := regexp_replace(v_shift_code, '^shift\\s*', '', 'i');
  END IF;

  -- 7. Operator Machine Assignment & Shift Code Enforcement
  IF p_operator_id IS NOT NULL AND p_machine_id IS NOT NULL THEN
    SELECT ARRAY_AGG(DISTINCT shift_code)
    INTO v_assigned_shift_codes
    FROM public.operator_machine_assignments
    WHERE machine_id = p_machine_id
      AND operator_id = p_operator_id
      AND is_active = true
      AND shift_code IS NOT NULL;

    IF v_assigned_shift_codes IS NOT NULL AND array_length(v_assigned_shift_codes, 1) > 0 THEN
      IF v_shift_code IS NOT NULL THEN
        IF NOT (v_shift_code = ANY(v_assigned_shift_codes)) THEN
          IF v_entry_source = 'operator' THEN
            RAISE EXCEPTION 'Operator is assigned to Shift % on this equipment, but attempted to log for Shift %. Please select your assigned shift.',
              array_to_string(v_assigned_shift_codes, ', '), v_shift_code
              USING ERRCODE = '23514';
          ELSE
            v_is_assisted_override := true;
          END IF;
        END IF;
      ELSE
        IF array_length(v_assigned_shift_codes, 1) = 1 THEN
          v_shift_code := v_assigned_shift_codes[1];
        ELSE
          RAISE EXCEPTION 'Operator is assigned to shifts % on this equipment. Please select which assigned shift is being logged.',
            array_to_string(v_assigned_shift_codes, ', ')
            USING ERRCODE = '23514';
        END IF;
      END IF;
    END IF;
  END IF;

  v_shift_name := COALESCE(p_shift, CASE WHEN v_shift_code IS NOT NULL THEN 'Shift ' || v_shift_code ELSE 'Standard Shift' END);

  -- 8. Client, Site & Location Resolution
  IF p_client_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.machines
      WHERE id = p_machine_id AND client_id IS NOT NULL AND client_id <> p_client_id
    ) THEN
      RAISE EXCEPTION 'Client ID does not match assigned machine deployment'
        USING ERRCODE = '23503';
    END IF;
    v_resolved_client_id := p_client_id;
  ELSE
    SELECT client_id INTO v_resolved_client_id FROM public.machines WHERE id = p_machine_id;
  END IF;

  -- Resolve site_id from machine's current site
  SELECT site_id INTO v_resolved_site_id FROM public.machines WHERE id = p_machine_id;

  IF v_resolved_location IS NULL AND v_resolved_client_id IS NOT NULL THEN
    -- Try to get location from site first, fall back to client
    IF v_resolved_site_id IS NOT NULL THEN
      SELECT concat_ws(', ',
        NULLIF(btrim(cs.street), ''),
        NULLIF(btrim(cs.city), ''),
        NULLIF(btrim(cs.district), ''),
        NULLIF(btrim(st.name), ''),
        NULLIF(btrim(cs.pincode), '')
      )
      INTO v_resolved_location
      FROM public.client_sites cs
      JOIN public.states st ON st.id = cs.state_id
      WHERE cs.id = v_resolved_site_id;
    ELSE
      SELECT concat_ws(', ',
        NULLIF(btrim(street), ''),
        NULLIF(btrim(city), ''),
        NULLIF(btrim(district), ''),
        NULLIF(btrim(state), ''),
        NULLIF(btrim(pincode), '')
      )
      INTO v_resolved_location
      FROM public.clients
      WHERE id = v_resolved_client_id;
    END IF;
  END IF;

  -- 9. Normal Hours & Breakdown Bounds Guard
  v_normal_hours := COALESCE(p_normal_working_hours, 8);

  IF v_start_datetime IS NOT NULL AND v_end_datetime IS NOT NULL THEN
    v_shift_duration_hours := ROUND(EXTRACT(EPOCH FROM (v_end_datetime - v_start_datetime)) / 3600.0, 2) + COALESCE(p_overtime_hours, 0);
    IF COALESCE(p_is_breakdown, false) AND COALESCE(p_breakdown_hours, 0) > v_shift_duration_hours THEN
      RAISE EXCEPTION 'Breakdown duration (%h) cannot exceed total shift duration (%h)', p_breakdown_hours, v_shift_duration_hours
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- 10. Compute breakdown_minutes
  v_breakdown_minutes := ROUND(COALESCE(p_breakdown_hours, 0) * 60)::integer;

  -- 11. Ensure Idempotency Key
  v_idempotency_key := COALESCE(
    NULLIF(TRIM(p_idempotency_key), ''),
    'ihl_' || replace(gen_random_uuid()::text, '-', '')
  );

  -- 12. Insert machine_hour_log (now with site_id)
  INSERT INTO public.machine_hour_logs (
    machine_id, operator_id, client_id, site_id, log_date, end_date,
    start_datetime, end_datetime, start_meter, end_meter,
    start_time, end_time, overtime_hours, normal_working_hours,
    is_breakdown, breakdown_start_time, breakdown_end_time,
    breakdown_duration, breakdown_hours, breakdown_minutes,
    shift, shift_code, machine_condition, location, remarks,
    idempotency_key, entered_by, entry_source
  ) VALUES (
    p_machine_id, p_operator_id, v_resolved_client_id, v_resolved_site_id, v_log_date, v_end_date,
    v_start_datetime, v_end_datetime, p_start_meter, p_end_meter,
    v_start_time, v_end_time, COALESCE(p_overtime_hours, 0), v_normal_hours,
    COALESCE(p_is_breakdown, false), v_breakdown_start_time, v_breakdown_end_time,
    p_breakdown_duration, COALESCE(p_breakdown_hours, 0), v_breakdown_minutes,
    v_shift_name, v_shift_code, COALESCE(p_machine_condition, 'good'),
    v_resolved_location, p_remarks, v_idempotency_key, v_actor_id, v_entry_source
  )
  RETURNING id INTO v_log_id;

  -- 13. Read back trigger-computed maintenance_minutes
  SELECT maintenance_minutes INTO v_maintenance_minutes
    FROM public.machine_hour_logs WHERE id = v_log_id;
  v_maintenance_minutes := COALESCE(v_maintenance_minutes, 0);

  -- 14. Update Machine state
  UPDATE public.machines
  SET
    hour_meter = p_end_meter,
    current_operator_id = p_operator_id,
    health_status = CASE
      WHEN COALESCE(p_is_breakdown, false) = true OR p_machine_condition = 'breakdown' THEN 'breakdown'
      ELSE 'active'
    END,
    updated_at = NOW()
  WHERE id = p_machine_id;

  -- 15. Sync assignment shift_code
  IF v_shift_code IS NOT NULL AND p_operator_id IS NOT NULL AND NOT v_is_assisted_override THEN
    UPDATE public.operator_machine_assignments
    SET shift_code = v_shift_code, updated_at = NOW()
    WHERE id = (
      SELECT oma.id
      FROM public.operator_machine_assignments oma
      WHERE oma.machine_id = p_machine_id
        AND oma.operator_id = p_operator_id
        AND oma.is_active = true
        AND oma.shift_code IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.operator_machine_assignments ex
          WHERE ex.machine_id = p_machine_id
            AND ex.is_active = true
            AND ex.shift_code = v_shift_code
            AND ex.id <> oma.id
        )
      LIMIT 1
    );
  END IF;

  -- 16. Log Audit Trail
  v_audit_meta := jsonb_build_object(
    'log_id', v_log_id,
    'machine_id', p_machine_id,
    'operator_id', p_operator_id,
    'site_id', v_resolved_site_id,
    'start_meter', p_start_meter,
    'end_meter', p_end_meter,
    'running_hours', GREATEST(0, p_end_meter - p_start_meter),
    'normal_working_hours', v_normal_hours,
    'overtime_hours', COALESCE(p_overtime_hours, 0),
    'is_breakdown', COALESCE(p_is_breakdown, false),
    'breakdown_hours', COALESCE(p_breakdown_hours, 0),
    'breakdown_minutes', v_breakdown_minutes,
    'maintenance_minutes', v_maintenance_minutes,
    'shift', v_shift_name,
    'shift_code', v_shift_code,
    'idempotency_key', v_idempotency_key,
    'entered_by', v_actor_id,
    'entry_source', v_entry_source,
    'is_assisted_override', v_is_assisted_override
  );

  INSERT INTO public.audit_logs (
    entity_name, entity_type, entity_id, action, user_id, metadata, created_at
  ) VALUES (
    'machine_hour_logs', 'machine_hour_logs', v_log_id::text,
    CASE WHEN v_is_assisted_override THEN 'ASSISTED_OVERRIDE_ENTRY' ELSE 'INSERT' END,
    v_actor_id, v_audit_meta, NOW()
  );

  -- 17. Return clean payload (now with site_id)
  RETURN jsonb_build_object(
    'success', true,
    'id', v_log_id,
    'log_id', v_log_id,
    'machine_id', p_machine_id,
    'operator_id', p_operator_id,
    'site_id', v_resolved_site_id,
    'log_date', v_log_date,
    'start_meter', p_start_meter,
    'end_meter', p_end_meter,
    'running_hours', GREATEST(0, p_end_meter - p_start_meter),
    'normal_working_hours', v_normal_hours,
    'overtime_hours', COALESCE(p_overtime_hours, 0),
    'breakdown_minutes', v_breakdown_minutes,
    'maintenance_minutes', v_maintenance_minutes,
    'shift_code', v_shift_code,
    'entry_source', v_entry_source,
    'is_assisted_override', v_is_assisted_override,
    'idempotency_key', v_idempotency_key
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.submit_operator_hour_log_atomic(
  uuid, uuid, uuid, text, date, date, timestamp with time zone, timestamp with time zone,
  numeric, numeric, text, text, numeric, numeric, boolean, text, text, text, numeric,
  text, text, text, text, text, uuid
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_operator_hour_log_atomic(
  uuid, uuid, uuid, text, date, date, timestamp with time zone, timestamp with time zone,
  numeric, numeric, text, text, numeric, numeric, boolean, text, text, text, numeric,
  text, text, text, text, text, uuid
) TO service_role;
