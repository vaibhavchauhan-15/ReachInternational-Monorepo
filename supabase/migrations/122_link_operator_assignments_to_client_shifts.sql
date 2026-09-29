-- ==============================================================================
-- Migration 122: Link Operator Machine Assignments to Client Shift Codes
-- 1. Add shift_code column to public.operator_machine_assignments
-- 2. Backfill active assignments from matching client_shift_codes
-- 3. Upgrade assign_operator_machine_atomic to accept and persist p_shift_code
-- 4. Upgrade get_operator_entry_context to return assigned_shift_code
-- 5. Upgrade get_today_shift_log_monitor to link directly on shift_code
-- ==============================================================================

-- 1. Add shift_code column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'operator_machine_assignments' 
      AND column_name = 'shift_code'
  ) THEN
    ALTER TABLE public.operator_machine_assignments ADD COLUMN shift_code text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_oma_shift_code
  ON public.operator_machine_assignments (shift_code)
  WHERE is_active = true;

-- 2. Backfill active assignments where times match client_shift_codes
UPDATE public.operator_machine_assignments oma
SET shift_code = csc.code
FROM public.machines m, public.client_shift_codes csc
WHERE oma.machine_id = m.id
  AND csc.client_id = m.client_id
  AND csc.is_active = true
  AND csc.start_time = oma.shift_start_time
  AND csc.end_time = oma.shift_end_time
  AND oma.is_active = true
  AND oma.shift_code IS NULL;

-- 3. Upgrade assign_operator_machine_atomic
CREATE OR REPLACE FUNCTION public.assign_operator_machine_atomic(
  p_machine_id UUID,
  p_operator_id UUID,
  p_shift_start TIME DEFAULT NULL,
  p_shift_end TIME DEFAULT NULL,
  p_assigned_by UUID DEFAULT NULL,
  p_shift_start_time TIME DEFAULT NULL,
  p_shift_end_time TIME DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_shift_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_machine RECORD;
  v_operator RECORD;
  v_existing_active RECORD;
  v_new_assignment_id UUID;
  v_new_assignment RECORD;
  v_audit_meta JSONB;
  v_shift_start TIME;
  v_shift_end TIME;
  v_shift_code TEXT;
BEGIN
  v_shift_start := COALESCE(p_shift_start, p_shift_start_time);
  v_shift_end := COALESCE(p_shift_end, p_shift_end_time);
  v_shift_code := NULLIF(TRIM(p_shift_code), '');

  IF v_shift_start IS NULL OR v_shift_end IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Both shift start and end times must be provided.');
  END IF;

  -- 1. Validate Target Machine Exists
  SELECT id, machine_id, model, serial_number, client_id
  INTO v_machine
  FROM public.machines
  WHERE id = p_machine_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target machine not found.');
  END IF;

  -- 2. Validate Operator Exists & Is Active
  SELECT id, full_name, email, role, status
  INTO v_operator
  FROM public.users
  WHERE id = p_operator_id AND role = 'operator' AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Selected operator is not active or does not exist.');
  END IF;

  -- 3. Validate Shift
  IF v_shift_start = v_shift_end THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shift start time and end time cannot be identical.');
  END IF;

  -- 4. Check if operator already has same exact assignment on this machine
  SELECT id, machine_id, shift_start_time, shift_end_time, shift_code INTO v_existing_active
  FROM public.operator_machine_assignments
  WHERE operator_id = p_operator_id AND is_active = true;

  IF v_existing_active.id IS NOT NULL THEN
    -- Same machine, same shift = no-op
    IF v_existing_active.machine_id = p_machine_id
       AND v_existing_active.shift_start_time = v_shift_start
       AND v_existing_active.shift_end_time = v_shift_end
       AND COALESCE(v_existing_active.shift_code, '') = COALESCE(v_shift_code, '') THEN
      RETURN jsonb_build_object('success', false, 'error',
        v_operator.full_name || ' is already assigned to this machine on shift ' ||
        COALESCE(v_shift_code, '') || ' (' || v_shift_start::text || ' – ' || v_shift_end::text || ').');
    END IF;

    -- Different machine or shift: end previous assignment first (reassign)
    UPDATE public.operator_machine_assignments
    SET is_active = false,
        ended_at = NOW(),
        ended_by = p_assigned_by,
        end_reason = 'reassigned',
        updated_at = NOW()
    WHERE id = v_existing_active.id;
  END IF;

  -- 5. Insert new assignment (capacity trigger and unique index enforce constraints)
  BEGIN
    INSERT INTO public.operator_machine_assignments (
      machine_id,
      operator_id,
      shift_start_time,
      shift_end_time,
      shift_code,
      is_active,
      assigned_by,
      assigned_at
    )
    VALUES (
      p_machine_id,
      p_operator_id,
      v_shift_start,
      v_shift_end,
      v_shift_code,
      true,
      p_assigned_by,
      NOW()
    )
    RETURNING * INTO v_new_assignment;

    v_new_assignment_id := v_new_assignment.id;
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'MAX_OPERATORS_REACHED',
        'error', 'Machine ' || COALESCE(v_machine.machine_id, 'Selected machine') ||
                 ' has reached its maximum capacity of 3 active operators.'
      );
    WHEN unique_violation THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'ALREADY_ASSIGNED',
        'error', v_operator.full_name || ' is already assigned to another machine. End that assignment first.'
      );
  END;

  -- 6. Audit Log
  v_audit_meta := jsonb_build_object(
    'assignmentId', v_new_assignment_id,
    'machineId', p_machine_id,
    'machineCode', v_machine.machine_id,
    'operatorId', p_operator_id,
    'operatorName', v_operator.full_name,
    'shiftCode', v_shift_code,
    'shiftStart', v_shift_start,
    'shiftEnd', v_shift_end,
    'crossesMidnight', v_new_assignment.crosses_midnight,
    'previousAssignment', CASE WHEN v_existing_active.id IS NOT NULL
      THEN jsonb_build_object('id', v_existing_active.id, 'machine_id', v_existing_active.machine_id)
      ELSE NULL END,
    'notes', p_notes
  );

  INSERT INTO public.audit_logs (
    user_id, action, entity_type, entity_id, metadata, details, created_at
  )
  VALUES (
    p_assigned_by,
    'machine.operator_shift_assigned',
    'operator_machine_assignment',
    v_new_assignment_id,
    v_audit_meta,
    v_audit_meta,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_new_assignment_id,
    'machine_id', p_machine_id,
    'operator_id', p_operator_id,
    'shift_code', v_shift_code,
    'shift_start_time', v_shift_start,
    'shift_end_time', v_shift_end,
    'previous_ended', v_existing_active.id IS NOT NULL
  );
END;
$$;

-- 4. Upgrade get_operator_entry_context to include assigned_shift_code
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

-- 5. Upgrade get_today_shift_log_monitor
DROP FUNCTION IF EXISTS public.get_today_shift_log_monitor(uuid, date, text);

CREATE OR REPLACE FUNCTION public.get_today_shift_log_monitor(
  p_actor_id uuid,
  p_log_date date DEFAULT CURRENT_DATE,
  p_search text DEFAULT NULL
) RETURNS TABLE (
  operator_id uuid,
  operator_name text,
  operator_phone text,
  machine_id uuid,
  machine_code text,
  machine_serial_number text,
  machine_model text,
  client_id uuid,
  client_name text,
  current_meter numeric,
  shift_code text,
  shift_start time,
  shift_end time,
  status text,
  log_id uuid,
  entered_by uuid,
  entered_by_name text,
  entry_source text,
  log_date date,
  start_meter numeric,
  end_meter numeric,
  running_hours numeric,
  remarks text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH actor_info AS (
    SELECT role FROM public.users WHERE id = p_actor_id
  ),
  active_assignments AS (
    SELECT oma.operator_id,
           oma.machine_id,
           oma.shift_start_time,
           oma.shift_end_time,
           oma.shift_code AS oma_shift_code,
           m.machine_id AS machine_code,
           m.serial_number,
           m.model,
           m.client_id,
           m.hour_meter AS current_meter
    FROM public.operator_machine_assignments oma
    JOIN public.machines m ON m.id = oma.machine_id
    WHERE oma.is_active = true
      AND m.status IN ('active', 'rented')
      AND (
        (SELECT role FROM actor_info) IN ('super_admin', 'admin', 'manager')
        OR EXISTS (
          SELECT 1 FROM public.user_supervisors us
          WHERE us.supervisor_id = p_actor_id AND us.user_id = oma.operator_id
        )
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = oma.operator_id AND u.supervisor_id = p_actor_id
        )
      )
  ),
  roster AS (
    SELECT a.operator_id,
           a.machine_id,
           a.machine_code,
           a.serial_number,
           a.model,
           a.client_id,
           a.current_meter,
           COALESCE(a.oma_shift_code, csc.code, 'S1') AS shift_code,
           COALESCE(csc.start_time, a.shift_start_time) AS shift_start,
           COALESCE(csc.end_time, a.shift_end_time) AS shift_end
    FROM active_assignments a
    LEFT JOIN public.client_shift_codes csc
      ON csc.client_id = a.client_id
     AND csc.is_active = true
     AND (
       (a.oma_shift_code IS NOT NULL AND csc.code = a.oma_shift_code)
       OR (a.oma_shift_code IS NULL AND csc.start_time = a.shift_start_time AND csc.end_time = a.shift_end_time)
     )
  )
  SELECT r.operator_id, u.full_name AS operator_name,
         u.phone AS operator_phone,
         r.machine_id, r.machine_code,
         r.serial_number AS machine_serial_number,
         r.model AS machine_model,
         r.client_id, COALESCE(cl.company_name, 'Base Yard') AS client_name,
         r.current_meter,
         r.shift_code, r.shift_start, r.shift_end,
         CASE WHEN l.id IS NULL THEN 'pending' ELSE 'entered' END AS status,
         l.id AS log_id, l.entered_by, eu.full_name AS entered_by_name, l.entry_source,
         l.log_date, l.start_meter, l.end_meter, l.running_hours, l.remarks
  FROM roster r
  JOIN public.users u ON u.id = r.operator_id
  LEFT JOIN public.clients cl ON cl.id = r.client_id
  LEFT JOIN public.machine_hour_logs l
    ON l.machine_id = r.machine_id AND l.operator_id = r.operator_id
   AND l.shift_code = r.shift_code AND l.log_date = p_log_date
  LEFT JOIN public.users eu ON eu.id = l.entered_by
  WHERE (p_search IS NULL OR p_search = '' OR (
     u.full_name ILIKE '%' || p_search || '%'
     OR u.phone ILIKE '%' || p_search || '%'
     OR r.machine_code ILIKE '%' || p_search || '%'
     OR COALESCE(r.serial_number, '') ILIKE '%' || p_search || '%'
     OR COALESCE(r.model, '') ILIKE '%' || p_search || '%'
     OR COALESCE(cl.company_name, '') ILIKE '%' || p_search || '%'
  ))
  ORDER BY CASE WHEN l.id IS NULL THEN 0 ELSE 1 END, u.full_name, r.shift_code;
$$;

GRANT EXECUTE ON FUNCTION public.get_today_shift_log_monitor(uuid, date, text) TO authenticated;
