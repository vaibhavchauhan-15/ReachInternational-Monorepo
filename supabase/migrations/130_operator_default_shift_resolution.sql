-- ==============================================================================
-- Migration 130: Operator Default Shift Resolution & Pre-Selection Parity
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
-- Description:
-- 1. Upgrades get_operator_entry_context() to deterministically resolve and return
--    the operator's assigned shift code:
--    a. Uses active operator_machine_assignments.shift_code if present.
--    b. If shift_code is null on assignment, matches operator's shift_start_time
--       against the machine's client_shift_codes.
--    c. If unassigned or no client shift templates, maps operator's users.shift_start_time
--       to canonical shift codes (S1: morning, S2: evening/afternoon, S3: night).
--    d. Ensures shift_codes fallback contains standard S1/S2/S3 shift templates.
--    e. Projects assigned_shift_code and operator.shift_code monorepo-wide.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_operator_entry_context(p_operator_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
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
      'assigned_shift_code', NULL
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
      'assigned_shift_code', NULL
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
    'assigned_shift_code', v_oma_shift_code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_operator_entry_context(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_operator_entry_context(uuid) TO authenticated, service_role;
