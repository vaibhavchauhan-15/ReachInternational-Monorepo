-- ==============================================================================
-- Migration 143: Enforce Operator Assigned Shift Logs & Real-Time Context Alignment
--
-- 1. Updates submit_operator_hour_log_atomic to strictly validate that when an
--    operator has assigned shift(s) on a machine, they can ONLY log for their
--    assigned shift code(s). If they attempt to log for an unassigned shift
--    (e.g. assigned Shift A, but logs for Shift B), the server REJECTS with an error.
-- 2. Updates get_operator_entry_context RPC to return all active assigned shift
--    codes (assigned_shift_codes) for the operator on that machine.
-- ==============================================================================

-- 1. Drop obsolete overload if exists to prevent duplicate function signature collision
DROP FUNCTION IF EXISTS public.submit_operator_hour_log_atomic(uuid, uuid, uuid, date, numeric, numeric, text, text, numeric, boolean, text, text, text, text, text, numeric, date, timestamp with time zone, timestamp with time zone, text, text, text, numeric, text, uuid);

-- 2. Update submit_operator_hour_log_atomic
CREATE OR REPLACE FUNCTION public.submit_operator_hour_log_atomic(
  p_machine_id UUID,
  p_operator_id UUID,
  p_client_id UUID DEFAULT NULL,
  p_shift_code TEXT DEFAULT NULL,
  p_log_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_start_datetime TIMESTAMPTZ DEFAULT NULL,
  p_end_datetime TIMESTAMPTZ DEFAULT NULL,
  p_start_meter NUMERIC DEFAULT 0,
  p_end_meter NUMERIC DEFAULT 0,
  p_start_time TEXT DEFAULT NULL,
  p_end_time TEXT DEFAULT NULL,
  p_overtime_hours NUMERIC DEFAULT 0,
  p_normal_working_hours NUMERIC DEFAULT 8,
  p_is_breakdown BOOLEAN DEFAULT FALSE,
  p_breakdown_start_time TEXT DEFAULT NULL,
  p_breakdown_end_time TEXT DEFAULT NULL,
  p_breakdown_duration TEXT DEFAULT NULL,
  p_breakdown_hours NUMERIC DEFAULT 0,
  p_shift TEXT DEFAULT NULL,
  p_machine_condition TEXT DEFAULT 'good',
  p_location TEXT DEFAULT NULL,
  p_remarks TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_entered_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_log_id UUID;
  v_actor_id UUID;
  v_entry_source TEXT;
  v_idempotency_key TEXT;
  v_audit_meta JSONB;
  v_resolved_client_id UUID;
  v_resolved_location TEXT := p_location;
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
    v_shift_code := regexp_replace(v_shift_code, '^shift\s*', '', 'i');
  END IF;

  -- 7. Operator Machine Assignment & Shift Code Enforcement
  -- If operator has active assignment(s) with specific shift code(s) on this machine,
  -- they can strictly ONLY log for their assigned shift code(s).
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
          RAISE EXCEPTION 'Operator is assigned to Shift % on this equipment, but attempted to log for Shift %. Please select your assigned shift.',
            array_to_string(v_assigned_shift_codes, ', '), v_shift_code
            USING ERRCODE = '23514';
        END IF;
      ELSE
        -- Manual entry without explicit shift_code:
        -- If operator has exactly 1 assigned shift, auto-bind to their assigned shift
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

  -- 8. Client & Location Resolution (with Deployment Verification)
  IF p_client_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.machines
      WHERE id = p_machine_id
        AND client_id IS NOT NULL
        AND client_id <> p_client_id
    ) THEN
      RAISE EXCEPTION 'Client ID does not match assigned machine deployment'
        USING ERRCODE = '23503';
    END IF;
    v_resolved_client_id := p_client_id;
  ELSE
    SELECT client_id INTO v_resolved_client_id FROM public.machines WHERE id = p_machine_id;
  END IF;

  IF v_resolved_location IS NULL AND v_resolved_client_id IS NOT NULL THEN
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

  -- 9. Normal Hours & Breakdown Bounds Guard
  v_normal_hours := COALESCE(p_normal_working_hours, 8);

  IF v_start_datetime IS NOT NULL AND v_end_datetime IS NOT NULL THEN
    v_shift_duration_hours := ROUND(EXTRACT(EPOCH FROM (v_end_datetime - v_start_datetime)) / 3600.0, 2) + COALESCE(p_overtime_hours, 0);
    IF COALESCE(p_is_breakdown, false) AND COALESCE(p_breakdown_hours, 0) > v_shift_duration_hours THEN
      RAISE EXCEPTION 'Breakdown duration (%h) cannot exceed total shift duration (%h)', p_breakdown_hours, v_shift_duration_hours
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- 10. Compute breakdown_minutes (stored integer minutes)
  v_breakdown_minutes := ROUND(COALESCE(p_breakdown_hours, 0) * 60)::integer;

  -- 11. Ensure Idempotency Key
  v_idempotency_key := COALESCE(
    NULLIF(TRIM(p_idempotency_key), ''),
    'ihl_' || replace(gen_random_uuid()::text, '-', '')
  );

  -- 12. Insert machine_hour_log
  INSERT INTO public.machine_hour_logs (
    machine_id, operator_id, client_id, log_date, end_date,
    start_datetime, end_datetime, start_meter, end_meter,
    start_time, end_time, overtime_hours, normal_working_hours,
    is_breakdown, breakdown_start_time, breakdown_end_time,
    breakdown_duration, breakdown_hours, breakdown_minutes,
    shift, shift_code, machine_condition, location, remarks,
    idempotency_key, entered_by, entry_source
  ) VALUES (
    p_machine_id, p_operator_id, v_resolved_client_id, v_log_date, v_end_date,
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

  -- 15. Sync assignment shift_code ONLY if unassigned (shift_code IS NULL)
  -- and does not conflict with existing active assignment on this machine
  IF v_shift_code IS NOT NULL AND p_operator_id IS NOT NULL THEN
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
    'entry_source', v_entry_source
  );

  INSERT INTO public.audit_logs (
    entity_name,
    entity_type,
    entity_id,
    action,
    user_id,
    metadata,
    created_at
  ) VALUES (
    'machine_hour_logs',
    'machine_hour_logs',
    v_log_id::text,
    'SUBMIT_OPERATOR_HOUR_LOG',
    v_actor_id,
    v_audit_meta,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'log_id', v_log_id,
    'running_hours', GREATEST(0, p_end_meter - p_start_meter),
    'normal_working_hours', v_normal_hours,
    'overtime_hours', COALESCE(p_overtime_hours, 0),
    'breakdown_minutes', v_breakdown_minutes,
    'maintenance_minutes', v_maintenance_minutes,
    'idempotency_key', v_idempotency_key,
    'entry_source', v_entry_source
  );
END;
$$;

-- 2. Update get_operator_entry_context to include assigned_shift_codes array
CREATE OR REPLACE FUNCTION public.get_operator_entry_context(p_operator_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_operator_id uuid;
  v_op_id uuid;
  v_op_name text;
  v_op_role text;
  v_op_shift_start time;
  v_op_shift_end time;

  v_assigned_machine_id uuid;
  v_oma_shift_start time;
  v_oma_shift_end time;
  v_oma_shift_code text;
  v_assigned_shift_codes jsonb := '[]'::jsonb;

  v_m_id uuid;
  v_m_code text;
  v_m_model text;
  v_m_serial text;
  v_m_hmr numeric;
  v_m_client_id uuid;

  v_c_id uuid;
  v_c_name text;
  v_c_site text;

  v_last_hmr numeric;
  v_last_log jsonb;
  v_shift_codes jsonb := '[]'::jsonb;
BEGIN
  v_operator_id := COALESCE(p_operator_id, auth.uid());

  IF v_operator_id IS NULL THEN
    RETURN jsonb_build_object(
      'operator', NULL,
      'machine', NULL,
      'client', NULL,
      'last_hmr', 0,
      'last_log', NULL,
      'shift_codes', '[]'::jsonb,
      'assigned_shift_code', NULL,
      'assigned_shift_codes', '[]'::jsonb
    );
  END IF;

  -- 1. Fetch Operator Info
  SELECT u.id, u.full_name, u.role, u.shift_start_time, u.shift_end_time
  INTO v_op_id, v_op_name, v_op_role, v_op_shift_start, v_op_shift_end
  FROM public.users u
  WHERE u.id = v_operator_id;

  IF v_op_id IS NULL THEN
    RETURN jsonb_build_object(
      'operator', NULL,
      'machine', NULL,
      'client', NULL,
      'last_hmr', 0,
      'last_log', NULL,
      'shift_codes', '[]'::jsonb,
      'assigned_shift_code', NULL,
      'assigned_shift_codes', '[]'::jsonb
    );
  END IF;

  -- 2. Resolve Active Machine Assignment with shift_code
  SELECT oma.machine_id, oma.shift_start_time, oma.shift_end_time, oma.shift_code
  INTO v_assigned_machine_id, v_oma_shift_start, v_oma_shift_end, v_oma_shift_code
  FROM public.operator_machine_assignments oma
  WHERE oma.operator_id = v_operator_id AND oma.is_active = true
  ORDER BY oma.assigned_at DESC
  LIMIT 1;

  IF v_assigned_machine_id IS NOT NULL THEN
    IF v_oma_shift_start IS NOT NULL THEN
      v_op_shift_start := v_oma_shift_start;
    END IF;
    IF v_oma_shift_end IS NOT NULL THEN
      v_op_shift_end := v_oma_shift_end;
    END IF;

    -- Fetch ALL active assigned shift codes for this operator on this machine
    SELECT COALESCE(jsonb_agg(DISTINCT oma.shift_code) FILTER (WHERE oma.shift_code IS NOT NULL), '[]'::jsonb)
    INTO v_assigned_shift_codes
    FROM public.operator_machine_assignments oma
    WHERE oma.operator_id = v_operator_id
      AND oma.machine_id = v_assigned_machine_id
      AND oma.is_active = true;
  ELSE
    SELECT m.id
    INTO v_assigned_machine_id
    FROM public.machines m
    WHERE m.current_operator_id = v_operator_id
       OR v_operator_id = ANY(m.operator_ids)
    ORDER BY m.updated_at DESC
    LIMIT 1;
  END IF;

  -- 3. Resolve Machine Specifications
  IF v_assigned_machine_id IS NOT NULL THEN
    SELECT m.id, m.machine_id, m.model, m.serial_number, m.hour_meter, m.client_id
    INTO v_m_id, v_m_code, v_m_model, v_m_serial, v_m_hmr, v_m_client_id
    FROM public.machines m
    WHERE m.id = v_assigned_machine_id;

    -- 4. Resolve Client and Site
    IF v_m_client_id IS NULL THEN
      SELECT mhl.client_id
      INTO v_m_client_id
      FROM public.machine_hour_logs mhl
      WHERE mhl.machine_id = v_assigned_machine_id AND mhl.client_id IS NOT NULL
      ORDER BY mhl.log_date DESC, mhl.created_at DESC
      LIMIT 1;
    END IF;

    IF v_m_client_id IS NOT NULL THEN
      SELECT c.id, c.company_name,
             COALESCE(
               NULLIF(TRIM(CONCAT_WS(', ',
                 NULLIF(c.street, ''),
                 NULLIF(c.city, ''),
                 NULLIF(c.district, ''),
                 NULLIF(c.state, '')
               )), ''),
               'Base Yard'
             )
      INTO v_c_id, v_c_name, v_c_site
      FROM public.clients c
      WHERE c.id = v_m_client_id;

      -- Fetch active shift codes for this client
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', sc.id,
            'client_id', sc.client_id,
            'code', sc.code,
            'name', sc.name,
            'start_time', to_char(sc.start_time, 'HH12:MI AM'),
            'end_time', to_char(sc.end_time, 'HH12:MI AM'),
            'raw_start_time', sc.start_time::text,
            'raw_end_time', sc.end_time::text,
            'crosses_midnight', sc.crosses_midnight,
            'scheduled_minutes', sc.scheduled_minutes,
            'normal_minutes', sc.normal_minutes,
            'default_ot_minutes', sc.scheduled_minutes - sc.normal_minutes
          ) ORDER BY sc.display_order ASC, sc.code ASC
        ),
        '[]'::jsonb
      )
      INTO v_shift_codes
      FROM public.client_shift_codes sc
      WHERE sc.client_id = v_m_client_id AND sc.is_active = true;
    END IF;

    -- Auto-resolve shift_code from client_shift_codes if oma_shift_code was not populated
    IF (v_oma_shift_code IS NULL OR TRIM(v_oma_shift_code) = '') AND v_m_client_id IS NOT NULL AND v_op_shift_start IS NOT NULL THEN
      SELECT sc.code
      INTO v_oma_shift_code
      FROM public.client_shift_codes sc
      WHERE sc.client_id = v_m_client_id AND sc.is_active = true
      ORDER BY (sc.start_time = v_op_shift_start) DESC,
               ABS(EXTRACT(EPOCH FROM (sc.start_time - v_op_shift_start))) ASC,
               sc.display_order ASC
      LIMIT 1;
    END IF;

    -- 5. Resolve Last Machine Log & HMR with Submitter Attribution
    SELECT jsonb_build_object(
      'id', mhl.id,
      'log_date', mhl.log_date,
      'start_meter', COALESCE(mhl.start_meter, 0),
      'end_meter', COALESCE(mhl.end_meter, 0),
      'start_time', mhl.start_time,
      'end_time', mhl.end_time,
      'running_hours', COALESCE(mhl.running_hours, GREATEST(0, ROUND((mhl.end_meter - mhl.start_meter) * 10) / 10)),
      'normal_working_hours', COALESCE(mhl.normal_working_hours, 8),
      'overtime_hours', COALESCE(mhl.overtime_hours, 0),
      'shift', mhl.shift,
      'shift_code', mhl.shift_code,
      'is_breakdown', COALESCE(mhl.is_breakdown, false),
      'breakdown_duration', mhl.breakdown_duration,
      'operator_id', mhl.operator_id,
      'operator_name', COALESCE(u.full_name, 'Operator'),
      'entered_by', mhl.entered_by,
      'entered_by_name', COALESCE(u_entered.full_name, u.full_name, 'Operator'),
      'entry_source', COALESCE(mhl.entry_source, 'operator')
    ), mhl.end_meter
    INTO v_last_log, v_last_hmr
    FROM public.machine_hour_logs mhl
    LEFT JOIN public.users u ON u.id = mhl.operator_id
    LEFT JOIN public.users u_entered ON u_entered.id = mhl.entered_by
    WHERE mhl.machine_id = v_assigned_machine_id
      AND mhl.end_meter IS NOT NULL
    ORDER BY mhl.log_date DESC, mhl.created_at DESC
    LIMIT 1;

    IF v_last_hmr IS NULL THEN
      v_last_hmr := COALESCE(v_m_hmr, 0);
    END IF;
  END IF;

  -- 6. Canonical fallback: If shift_code is still unset, derive standard shift code S1/S2/S3 from v_op_shift_start
  IF (v_oma_shift_code IS NULL OR TRIM(v_oma_shift_code) = '') AND v_op_shift_start IS NOT NULL THEN
    IF v_op_shift_start >= '04:00:00'::time AND v_op_shift_start < '11:00:00'::time THEN
      v_oma_shift_code := 'S1';
    ELSIF v_op_shift_start >= '11:00:00'::time AND v_op_shift_start < '17:00:00'::time THEN
      v_oma_shift_code := 'S2';
    ELSE
      v_oma_shift_code := 'S3';
    END IF;
  END IF;

  -- 7. Ensure shift_codes array is populated with standard 3-shift templates if client had no custom shift codes
  IF v_shift_codes IS NULL OR jsonb_array_length(v_shift_codes) = 0 THEN
    v_shift_codes := '[
      {"code": "S1", "name": "Shift S1 (Morning)", "start_time": "06:00 AM", "end_time": "02:00 PM", "raw_start_time": "06:00:00", "raw_end_time": "14:00:00", "crosses_midnight": false, "scheduled_minutes": 480, "normal_minutes": 480, "default_ot_minutes": 0},
      {"code": "S2", "name": "Shift S2 (Evening)", "start_time": "02:00 PM", "end_time": "10:00 PM", "raw_start_time": "14:00:00", "raw_end_time": "22:00:00", "crosses_midnight": false, "scheduled_minutes": 480, "normal_minutes": 480, "default_ot_minutes": 0},
      {"code": "S3", "name": "Shift S3 (Night)", "start_time": "10:00 PM", "end_time": "06:00 AM", "raw_start_time": "22:00:00", "raw_end_time": "06:00:00", "crosses_midnight": true, "scheduled_minutes": 480, "normal_minutes": 480, "default_ot_minutes": 0}
    ]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'operator', jsonb_build_object(
      'id', v_op_id,
      'name', v_op_name,
      'role', v_op_role,
      'shift_code', v_oma_shift_code,
      'shift_start', COALESCE(to_char(v_op_shift_start, 'HH12:MI AM'), '06:00 AM'),
      'shift_end', COALESCE(to_char(v_op_shift_end, 'HH12:MI AM'), '02:00 PM'),
      'raw_shift_start', COALESCE(v_op_shift_start::text, '06:00:00'),
      'raw_shift_end', COALESCE(v_op_shift_end::text, '14:00:00')
    ),
    'machine', CASE WHEN v_m_id IS NOT NULL THEN jsonb_build_object(
      'id', v_m_id,
      'machine_id', COALESCE(v_m_code, v_m_id::text),
      'model', v_m_model,
      'serial_number', v_m_serial
    ) ELSE NULL END,
    'client', CASE WHEN v_c_id IS NOT NULL THEN jsonb_build_object(
      'id', v_c_id,
      'company_name', v_c_name,
      'site', COALESCE(v_c_site, 'Base Yard')
    ) ELSE NULL END,
    'last_hmr', COALESCE(v_last_hmr, 0),
    'last_log', v_last_log,
    'shift_codes', v_shift_codes,
    'assigned_shift_code', v_oma_shift_code,
    'assigned_shift_codes', v_assigned_shift_codes
  );
END;
$$;
