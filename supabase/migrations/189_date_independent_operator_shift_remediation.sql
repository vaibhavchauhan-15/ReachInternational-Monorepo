-- Migration 189: Phase 7 — Remediation of Date-Independent Shift Assignments & Historical Context
-- Addresses:
--   1. get_operator_entry_context() accepts p_target_date DATE DEFAULT NULL.
--      Evaluates assignment, client shifts, last log, and logged shifts for that target date.
--      Removes fallback to machines.current_operator_id when no assignment covers target date.
--   2. end_assignment_range() intelligently defaults p_effective_date to yesterday (today_ist - 1)
--      when valid_from < today_ist and no log was entered today, eliminating today's overlap.
--   3. trg_fn_sync_oma_valid_range() trigger stamps valid_to = today_ist - 1 when is_active is set
--      to false on an older assignment with no logs today.
--   4. get_today_shift_monitor_summary(), get_today_shift_log_monitor(), and
--      get_today_shift_log_monitor_paginated() updated to support single-day assignments (valid_from <= valid_to)
--      so completed or concluded single-day assignments remain visible as pending/entered on that date.

-- ============================================================
-- 1. end_assignment_range — Intelligent Effective Date
-- ============================================================
CREATE OR REPLACE FUNCTION public.end_assignment_range(
  p_assignment_id UUID,
  p_caller_id     UUID,
  p_end_reason    TEXT    DEFAULT 'removed',
  p_effective_date DATE   DEFAULT NULL,
  p_notes         TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_assignment    RECORD;
  v_caller_role   TEXT;
  v_effective_date DATE;
  v_today_ist     DATE;
  v_has_log_today BOOLEAN;
BEGIN
  v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;

  -- Authorisation
  SELECT role INTO v_caller_role FROM public.users WHERE id = p_caller_id;
  IF v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'supervisor') THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN',
      'error', 'Only supervisors and above may close assignment ranges.');
  END IF;

  -- Lock the assignment row
  SELECT id, operator_id, machine_id, shift_code, valid_from, valid_to, is_active
  INTO v_assignment
  FROM public.operator_machine_assignments
  WHERE id = p_assignment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND',
      'error', 'Assignment not found.');
  END IF;

  IF v_assignment.is_active = false OR v_assignment.valid_to IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_ENDED',
      'error', 'Assignment range is already closed.');
  END IF;

  -- Determine effective date:
  -- If caller passed an explicit date, respect it.
  -- Otherwise, if the assignment started before today and has NO log today,
  -- it should close as of yesterday so that today's new assignment has zero overlap.
  IF p_effective_date IS NOT NULL THEN
    v_effective_date := p_effective_date;
  ELSE
    IF v_assignment.valid_from < v_today_ist THEN
      SELECT EXISTS (
        SELECT 1 FROM public.machine_hour_logs
        WHERE assignment_id = p_assignment_id AND log_date = v_today_ist
      ) INTO v_has_log_today;

      IF NOT v_has_log_today THEN
        v_effective_date := v_today_ist - 1;
      ELSE
        v_effective_date := v_today_ist;
      END IF;
    ELSE
      v_effective_date := v_today_ist;
    END IF;
  END IF;

  -- Cannot end a range before it started
  IF v_effective_date < v_assignment.valid_from THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_END_DATE',
      'error', format('Effective date (%s) cannot be before the assignment start (%s).',
        v_effective_date, v_assignment.valid_from));
  END IF;

  -- Close the range
  UPDATE public.operator_machine_assignments
  SET
    valid_to   = v_effective_date,
    is_active  = false,
    ended_at   = NOW(),
    ended_by   = p_caller_id,
    end_reason = p_end_reason,
    updated_at = NOW()
  WHERE id = p_assignment_id;

  -- Audit
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata, details, created_at)
  VALUES (
    p_caller_id,
    'assignment.range_ended',
    'operator_machine_assignment',
    p_assignment_id,
    jsonb_build_object(
      'assignmentId', p_assignment_id,
      'operatorId',   v_assignment.operator_id,
      'machineId',    v_assignment.machine_id,
      'shiftCode',    v_assignment.shift_code,
      'validFrom',    v_assignment.valid_from,
      'validTo',      v_effective_date,
      'endReason',    p_end_reason,
      'notes',        p_notes
    ),
    jsonb_build_object(
      'assignmentId', p_assignment_id,
      'operatorId',   v_assignment.operator_id,
      'machineId',    v_assignment.machine_id,
      'shiftCode',    v_assignment.shift_code,
      'validFrom',    v_assignment.valid_from,
      'validTo',      v_effective_date,
      'endReason',    p_end_reason
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success',       true,
    'assignment_id', p_assignment_id,
    'valid_from',    v_assignment.valid_from,
    'valid_to',      v_effective_date,
    'end_reason',    p_end_reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_assignment_range(UUID, UUID, TEXT, DATE, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.end_assignment_range(UUID, UUID, TEXT, DATE, TEXT) FROM anon, public;

-- ============================================================
-- 2. Range Synchronization Trigger Function
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_fn_sync_oma_valid_range()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_today_ist     date;
  v_has_log_today boolean;
BEGIN
  v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;

  -- Safety 1: If is_active is toggled to false and valid_to is not specified, stamp valid_to intelligently
  IF NEW.is_active = false AND (OLD.is_active = true OR OLD.is_active IS NULL) AND NEW.valid_to IS NULL THEN
    IF NEW.valid_from < v_today_ist THEN
      SELECT EXISTS (
        SELECT 1 FROM public.machine_hour_logs
        WHERE assignment_id = NEW.id AND log_date = v_today_ist
      ) INTO v_has_log_today;

      IF NOT v_has_log_today THEN
        NEW.valid_to := v_today_ist - 1;
      ELSE
        NEW.valid_to := v_today_ist;
      END IF;
    ELSE
      NEW.valid_to := NEW.valid_from;
    END IF;
  END IF;

  -- Safety 2: If valid_to is in the past, is_active must be false
  IF NEW.valid_to IS NOT NULL AND NEW.valid_to < v_today_ist THEN
    NEW.is_active := false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_oma_valid_range ON public.operator_machine_assignments;
CREATE TRIGGER trg_sync_oma_valid_range
  BEFORE INSERT OR UPDATE OF is_active, valid_to, valid_from
  ON public.operator_machine_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_sync_oma_valid_range();

-- ============================================================
-- 3. get_operator_entry_context — Date-Aware RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_operator_entry_context(
  p_operator_id uuid DEFAULT NULL::uuid,
  p_target_date date DEFAULT NULL::date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_target_date date;
  v_operator_id uuid;
  v_assigned_machine_id uuid;
  v_assignment_id uuid;
  v_oma_shift_start time;
  v_oma_shift_end time;
  v_oma_shift_code text;
  v_assigned_shift_codes jsonb := '[]'::jsonb;

  v_op_id uuid;
  v_op_name text;
  v_op_role text;
  v_op_shift_start time;
  v_op_shift_end time;

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
  v_today_logged_shift_codes text[] := '{}'::text[];
  v_today_logs jsonb := '[]'::jsonb;
BEGIN
  v_target_date := COALESCE(p_target_date, (NOW() AT TIME ZONE 'Asia/Kolkata')::date);
  v_operator_id := COALESCE(p_operator_id, auth.uid());

  IF v_operator_id IS NULL THEN
    RETURN jsonb_build_object(
      'target_date', v_target_date,
      'operator', NULL,
      'machine', NULL,
      'client', NULL,
      'last_hmr', 0,
      'last_log', NULL,
      'shift_codes', '[]'::jsonb,
      'assignment_id', NULL,
      'assigned_shift_code', NULL,
      'assigned_shift_codes', '[]'::jsonb,
      'today_logged_shift_codes', '[]'::jsonb,
      'today_logs', '[]'::jsonb
    );
  END IF;

  SELECT u.id, u.full_name, u.role, u.shift_start_time, u.shift_end_time
  INTO v_op_id, v_op_name, v_op_role, v_op_shift_start, v_op_shift_end
  FROM public.users u
  WHERE u.id = v_operator_id;

  IF v_op_id IS NULL THEN
    RETURN jsonb_build_object(
      'target_date', v_target_date,
      'operator', NULL,
      'machine', NULL,
      'client', NULL,
      'last_hmr', 0,
      'last_log', NULL,
      'shift_codes', '[]'::jsonb,
      'assignment_id', NULL,
      'assigned_shift_code', NULL,
      'assigned_shift_codes', '[]'::jsonb,
      'today_logged_shift_codes', '[]'::jsonb,
      'today_logs', '[]'::jsonb
    );
  END IF;

  -- 1. Resolve active assignment for TARGET DATE via valid_from / valid_to ranges
  SELECT oma.id, oma.machine_id, oma.shift_start_time, oma.shift_end_time, oma.shift_code
  INTO v_assignment_id, v_assigned_machine_id, v_oma_shift_start, v_oma_shift_end, v_oma_shift_code
  FROM public.operator_machine_assignments oma
  WHERE oma.operator_id = v_operator_id
    AND oma.valid_from <= v_target_date
    AND (oma.valid_to IS NULL OR oma.valid_to >= v_target_date)
  ORDER BY oma.valid_from DESC
  LIMIT 1;

  -- If NO assignment exists covering v_target_date:
  -- Contract Rule: An operator with no assignment on a target date has NO machine context.
  -- Zero fallback to static machines.current_operator_id for historical dates.
  IF v_assigned_machine_id IS NULL THEN
    RETURN jsonb_build_object(
      'target_date', v_target_date,
      'operator', jsonb_build_object(
        'id', v_op_id,
        'name', v_op_name,
        'role', v_op_role,
        'shift_code', NULL,
        'shift_name', 'No Assignment',
        'shift_start', COALESCE(to_char(v_op_shift_start, 'HH12:MI AM'), '06:00 AM'),
        'shift_end', COALESCE(to_char(v_op_shift_end, 'HH12:MI AM'), '02:00 PM'),
        'raw_shift_start', COALESCE(v_op_shift_start::text, '06:00:00'),
        'raw_shift_end', COALESCE(v_op_shift_end::text, '14:00:00')
      ),
      'machine', NULL,
      'client', NULL,
      'last_hmr', 0,
      'last_log', NULL,
      'shift_codes', '[]'::jsonb,
      'assignment_id', NULL,
      'assigned_shift_code', NULL,
      'assigned_shift_codes', '[]'::jsonb,
      'today_logged_shift_codes', '[]'::jsonb,
      'today_logs', '[]'::jsonb
    );
  END IF;

  -- Override operator shift timings from assignment
  IF v_oma_shift_start IS NOT NULL THEN
    v_op_shift_start := v_oma_shift_start;
  END IF;
  IF v_oma_shift_end IS NOT NULL THEN
    v_op_shift_end := v_oma_shift_end;
  END IF;

  -- Collect all assigned shift codes on this machine for the target date
  SELECT COALESCE(jsonb_agg(DISTINCT oma.shift_code) FILTER (WHERE oma.shift_code IS NOT NULL), '[]'::jsonb)
  INTO v_assigned_shift_codes
  FROM public.operator_machine_assignments oma
  WHERE oma.operator_id = v_operator_id
    AND oma.machine_id = v_assigned_machine_id
    AND oma.valid_from <= v_target_date
    AND (oma.valid_to IS NULL OR oma.valid_to >= v_target_date);

  -- Fetch machine details
  SELECT m.id, m.machine_id, m.model, m.serial_number, m.hour_meter, m.client_id
  INTO v_m_id, v_m_code, v_m_model, v_m_serial, v_m_hmr, v_m_client_id
  FROM public.machines m
  WHERE m.id = v_assigned_machine_id;

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

  -- Previous log on or before target date
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
    AND mhl.log_date <= v_target_date
    AND mhl.end_meter IS NOT NULL
  ORDER BY mhl.log_date DESC, mhl.created_at DESC
  LIMIT 1;

  IF v_last_hmr IS NULL THEN
    v_last_hmr := COALESCE(v_m_hmr, 0);
  END IF;

  -- Logs recorded on target date
  SELECT
    COALESCE(array_agg(mhl.shift_code) FILTER (WHERE mhl.shift_code IS NOT NULL), '{}'::text[]),
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', mhl.id,
          'shift_code', mhl.shift_code,
          'start_meter', mhl.start_meter,
          'end_meter', mhl.end_meter,
          'running_hours', mhl.running_hours,
          'start_time', mhl.start_time,
          'end_time', mhl.end_time,
          'is_breakdown', mhl.is_breakdown
        ) ORDER BY mhl.start_time ASC
      ),
      '[]'::jsonb
    )
  INTO v_today_logged_shift_codes, v_today_logs
  FROM public.machine_hour_logs mhl
  WHERE mhl.machine_id = v_assigned_machine_id
    AND mhl.log_date = v_target_date;

  IF v_shift_codes IS NULL OR jsonb_array_length(v_shift_codes) = 0 THEN
    v_shift_codes := '[
      {"code": "S1", "name": "Shift S1 (Morning)", "start_time": "06:00 AM", "end_time": "02:00 PM", "raw_start_time": "06:00:00", "raw_end_time": "14:00:00", "crosses_midnight": false, "scheduled_minutes": 480, "normal_minutes": 480, "default_ot_minutes": 0},
      {"code": "S2", "name": "Shift S2 (Evening)", "start_time": "02:00 PM", "end_time": "10:00 PM", "raw_start_time": "14:00:00", "raw_end_time": "22:00:00", "crosses_midnight": false, "scheduled_minutes": 480, "normal_minutes": 480, "default_ot_minutes": 0},
      {"code": "S3", "name": "Shift S3 (Night)", "start_time": "10:00 PM", "end_time": "06:00 AM", "raw_start_time": "22:00:00", "raw_end_time": "06:00:00", "crosses_midnight": true, "scheduled_minutes": 480, "normal_minutes": 480, "default_ot_minutes": 0}
    ]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'target_date', v_target_date,
    'operator', jsonb_build_object(
      'id', v_op_id,
      'name', v_op_name,
      'role', v_op_role,
      'shift_code', v_oma_shift_code,
      'shift_name', CASE WHEN v_oma_shift_code IS NOT NULL THEN 'Shift ' || v_oma_shift_code ELSE 'Standard Shift' END,
      'shift_start', COALESCE(to_char(v_op_shift_start, 'HH12:MI AM'), '06:00 AM'),
      'shift_end', COALESCE(to_char(v_op_shift_end, 'HH12:MI AM'), '02:00 PM'),
      'raw_shift_start', COALESCE(v_op_shift_start::text, '06:00:00'),
      'raw_shift_end', COALESCE(v_op_shift_end::text, '14:00:00')
    ),
    'machine', CASE WHEN v_m_id IS NOT NULL THEN jsonb_build_object(
      'id', v_m_id,
      'machine_id', v_m_code,
      'model', v_m_model,
      'serial_number', v_m_serial,
      'hour_meter', v_m_hmr
    ) ELSE NULL END,
    'client', CASE WHEN v_c_id IS NOT NULL THEN jsonb_build_object(
      'id', v_c_id,
      'company_name', v_c_name,
      'site', v_c_site
    ) ELSE NULL END,
    'last_hmr', COALESCE(v_last_hmr, 0),
    'last_log', v_last_log,
    'shift_codes', v_shift_codes,
    'assignment_id', v_assignment_id,
    'assigned_shift_code', v_oma_shift_code,
    'assigned_shift_codes', v_assigned_shift_codes,
    'today_logged_shift_codes', to_jsonb(v_today_logged_shift_codes),
    'today_logs', v_today_logs
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_operator_entry_context(uuid, date) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_operator_entry_context(uuid, date) FROM anon, public;

-- ============================================================
-- 4. get_today_shift_monitor_summary (single-day assignment support)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_today_shift_monitor_summary(
  p_actor_id uuid,
  p_log_date date DEFAULT CURRENT_DATE,
  p_client_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_summary jsonb;
  v_target_date date;
BEGIN
  v_target_date := COALESCE(p_log_date, (NOW() AT TIME ZONE 'Asia/Kolkata')::date);

  WITH actor_info AS (
    SELECT role FROM public.users WHERE id = p_actor_id
  ),
  active_assignments AS (
    SELECT oma.id AS assignment_id,
           oma.operator_id,
           oma.machine_id,
           oma.shift_start_time,
           oma.shift_end_time,
           oma.shift_code AS oma_shift_code,
           m.client_id
    FROM public.operator_machine_assignments oma
    JOIN public.machines m ON m.id = oma.machine_id
    WHERE oma.valid_from <= v_target_date
      AND (oma.valid_to IS NULL OR oma.valid_to >= v_target_date)
      AND (oma.valid_to IS NULL OR oma.valid_from <= oma.valid_to)
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
        OR m.current_supervisor_id = p_actor_id
        OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
        OR (
          m.client_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.client_supervisors cs
            WHERE cs.client_id = m.client_id AND cs.supervisor_id = p_actor_id
          )
        )
      )
  ),
  unassigned_machines AS (
    SELECT NULL::uuid AS assignment_id,
           NULL::uuid AS operator_id,
           m.id AS machine_id,
           NULL::time AS shift_start_time,
           NULL::time AS shift_end_time,
           'S1'::text AS oma_shift_code,
           m.client_id
    FROM public.machines m
    WHERE (
        m.status IN ('active', 'rented', 'available', 'under_maintenance')
        OR m.health_status IN ('under_maintenance', 'breakdown')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.operator_machine_assignments oma
        WHERE oma.machine_id = m.id
          AND oma.valid_from <= v_target_date
          AND (oma.valid_to IS NULL OR oma.valid_to >= v_target_date)
          AND (oma.valid_to IS NULL OR oma.valid_from <= oma.valid_to)
      )
      AND (
        (SELECT role FROM actor_info) IN ('super_admin', 'admin', 'manager')
        OR m.current_supervisor_id = p_actor_id
        OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
        OR (
          m.client_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.client_supervisors cs
            WHERE cs.client_id = m.client_id AND cs.supervisor_id = p_actor_id
          )
        )
      )
  ),
  combined_roster_sources AS (
    SELECT * FROM active_assignments
    UNION ALL
    SELECT * FROM unassigned_machines
  ),
  matched_logs AS (
    SELECT r.operator_id,
           r.machine_id,
           l.id AS log_id,
           ROW_NUMBER() OVER (
             PARTITION BY r.machine_id, COALESCE(r.operator_id, '00000000-0000-0000-0000-000000000000'::uuid)
             ORDER BY l.created_at DESC
           ) as rn
    FROM combined_roster_sources r
    LEFT JOIN public.machine_hour_logs l
      ON (
        (r.assignment_id IS NOT NULL AND l.assignment_id = r.assignment_id)
        OR (l.machine_id = r.machine_id AND (
          (r.operator_id IS NOT NULL AND l.operator_id = r.operator_id)
          OR (r.operator_id IS NULL)
        ))
      )
      AND l.log_date = v_target_date
  ),
  unique_matched_logs AS (
    SELECT operator_id, machine_id, log_id
    FROM matched_logs
    WHERE rn = 1
  ),
  classified_roster AS (
    SELECT
      r.operator_id,
      r.machine_id,
      CASE
        WHEN r.operator_id IS NULL THEN 'unassigned'
        WHEN ml.log_id IS NOT NULL THEN 'entered'
        ELSE 'pending'
      END as status
    FROM combined_roster_sources r
    LEFT JOIN unique_matched_logs ml
      ON ml.machine_id = r.machine_id
      AND (
        (r.operator_id IS NOT NULL AND ml.operator_id = r.operator_id)
        OR (r.operator_id IS NULL AND ml.operator_id IS NULL)
      )
    WHERE (p_client_id IS NULL OR r.client_id = p_client_id)
  )
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'entered', COUNT(*) FILTER (WHERE status = 'entered'),
    'pending', COUNT(*) FILTER (WHERE status = 'pending'),
    'unassigned', COUNT(*) FILTER (WHERE status = 'unassigned')
  ) INTO v_summary
  FROM classified_roster;

  RETURN COALESCE(v_summary, '{"total": 0, "entered": 0, "pending": 0, "unassigned": 0}'::jsonb);
END;
$function$;

-- ============================================================
-- 5. get_today_shift_log_monitor (single-day assignment support)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_today_shift_log_monitor(
  p_actor_id uuid,
  p_log_date date DEFAULT CURRENT_DATE,
  p_search text DEFAULT NULL::text,
  p_client_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  operator_id uuid,
  operator_name text,
  operator_phone text,
  operator_employee_id text,
  machine_id uuid,
  machine_code text,
  machine_serial_number text,
  machine_model text,
  client_id uuid,
  client_code text,
  client_name text,
  client_city text,
  site_name text,
  current_meter numeric,
  shift_code text,
  shift_name text,
  shift_start time without time zone,
  shift_end time without time zone,
  status text,
  log_id uuid,
  entered_by uuid,
  entered_by_name text,
  entry_source text,
  log_date date,
  start_meter numeric,
  end_meter numeric,
  running_hours numeric,
  remarks text,
  machine_status text,
  machine_health_status text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH target_date AS (
    SELECT COALESCE(p_log_date, (NOW() AT TIME ZONE 'Asia/Kolkata')::date) AS d
  ),
  actor_info AS (
    SELECT role FROM public.users WHERE id = p_actor_id
  ),
  active_assignments AS (
    SELECT oma.id AS assignment_id,
           oma.operator_id,
           oma.machine_id,
           oma.shift_start_time,
           oma.shift_end_time,
           oma.shift_code AS oma_shift_code,
           m.machine_id AS machine_code,
           m.serial_number,
           m.model,
           m.client_id,
           m.site_id,
           m.city AS machine_city,
           m.hour_meter AS current_meter,
           m.status AS machine_status,
           m.health_status AS machine_health_status
    FROM public.operator_machine_assignments oma
    JOIN public.machines m ON m.id = oma.machine_id
    CROSS JOIN target_date td
    WHERE oma.valid_from <= td.d
      AND (oma.valid_to IS NULL OR oma.valid_to >= td.d)
      AND (oma.valid_to IS NULL OR oma.valid_from <= oma.valid_to)
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
        OR m.current_supervisor_id = p_actor_id
        OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
        OR (
          m.client_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.client_supervisors cs
            WHERE cs.client_id = m.client_id AND cs.supervisor_id = p_actor_id
          )
        )
      )
  ),
  unassigned_machines AS (
    SELECT NULL::uuid AS assignment_id,
           NULL::uuid AS operator_id,
           m.id AS machine_id,
           NULL::time AS shift_start_time,
           NULL::time AS shift_end_time,
           'S1'::text AS oma_shift_code,
           m.machine_id AS machine_code,
           m.serial_number,
           m.model,
           m.client_id,
           m.site_id,
           m.city AS machine_city,
           m.hour_meter AS current_meter,
           m.status AS machine_status,
           m.health_status AS machine_health_status
    FROM public.machines m
    CROSS JOIN target_date td
    WHERE (
        m.status IN ('active', 'rented', 'available', 'under_maintenance')
        OR m.health_status IN ('under_maintenance', 'breakdown')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.operator_machine_assignments oma
        WHERE oma.machine_id = m.id
          AND oma.valid_from <= td.d
          AND (oma.valid_to IS NULL OR oma.valid_to >= td.d)
          AND (oma.valid_to IS NULL OR oma.valid_from <= oma.valid_to)
      )
      AND (
        (SELECT role FROM actor_info) IN ('super_admin', 'admin', 'manager')
        OR m.current_supervisor_id = p_actor_id
        OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
        OR (
          m.client_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.client_supervisors cs
            WHERE cs.client_id = m.client_id AND cs.supervisor_id = p_actor_id
          )
        )
      )
  ),
  combined_roster_sources AS (
    SELECT * FROM active_assignments
    UNION ALL
    SELECT * FROM unassigned_machines
  ),
  matched_logs AS (
    SELECT r.operator_id,
           r.machine_id,
           r.oma_shift_code,
           r.assignment_id,
           l.id AS log_id,
           l.entered_by,
           l.entry_source,
           l.log_date,
           l.start_meter,
           l.end_meter,
           l.running_hours,
           l.remarks,
           l.operator_id as log_operator_id,
           l.site_id as log_site_id,
           l.shift_code as log_shift_code,
           ROW_NUMBER() OVER (
             PARTITION BY r.machine_id, COALESCE(r.operator_id, '00000000-0000-0000-0000-000000000000'::uuid), r.oma_shift_code
             ORDER BY
               CASE
                 WHEN r.assignment_id IS NOT NULL AND l.assignment_id = r.assignment_id THEN 0
                 WHEN l.shift_code = r.oma_shift_code THEN 1
                 ELSE 2
               END,
               l.created_at DESC
           ) as rn
    FROM combined_roster_sources r
    CROSS JOIN target_date td
    LEFT JOIN public.machine_hour_logs l
      ON (
        (r.assignment_id IS NOT NULL AND l.assignment_id = r.assignment_id)
        OR (l.machine_id = r.machine_id AND (
          (r.operator_id IS NOT NULL AND l.operator_id = r.operator_id)
          OR (r.operator_id IS NULL)
        ))
      )
      AND l.log_date = td.d
  ),
  unique_matched_logs AS (
    SELECT * FROM matched_logs WHERE rn = 1
  ),
  roster_results AS (
    SELECT
      r.operator_id,
      COALESCE(u.full_name, log_op.full_name, 'Unassigned') AS operator_name,
      COALESCE(u.phone, log_op.phone) AS operator_phone,
      COALESCE(u.employee_id, log_op.employee_id) AS operator_employee_id,
      r.machine_id,
      r.machine_code,
      r.serial_number AS machine_serial_number,
      r.model AS machine_model,
      r.client_id,
      COALESCE(cl.client_id, cl.code) AS client_code,
      COALESCE(cl.company_name, 'Direct Client') AS client_name,
      COALESCE(cs.city, cl.city, r.machine_city) AS client_city,
      COALESCE(cs.site_name, cs.city, cl.city, r.machine_city) AS site_name,
      COALESCE(ml.end_meter, r.current_meter) AS current_meter,
      COALESCE(ml.log_shift_code, r.oma_shift_code, 'S1') AS shift_code,
      COALESCE('Shift ' || ml.log_shift_code, 'Shift ' || r.oma_shift_code, 'Shift S1') AS shift_name,
      COALESCE(r.shift_start_time, '06:00:00'::time) AS shift_start,
      COALESCE(r.shift_end_time, '14:00:00'::time) AS shift_end,
      CASE
        WHEN r.operator_id IS NULL THEN 'unassigned'
        WHEN ml.log_id IS NOT NULL THEN 'entered'
        ELSE 'pending'
      END AS status,
      ml.log_id,
      ml.entered_by,
      eu.full_name AS entered_by_name,
      ml.entry_source,
      COALESCE(ml.log_date, td.d) AS log_date,
      ml.start_meter,
      ml.end_meter,
      ml.running_hours,
      ml.remarks,
      r.machine_status,
      r.machine_health_status
    FROM combined_roster_sources r
    CROSS JOIN target_date td
    LEFT JOIN unique_matched_logs ml
      ON ml.machine_id = r.machine_id
      AND ml.oma_shift_code = r.oma_shift_code
      AND (
        (r.operator_id IS NOT NULL AND ml.operator_id = r.operator_id)
        OR (r.operator_id IS NULL AND ml.operator_id IS NULL)
      )
    LEFT JOIN public.users u ON u.id = r.operator_id
    LEFT JOIN public.users log_op ON log_op.id = ml.log_operator_id
    LEFT JOIN public.clients cl ON cl.id = r.client_id
    LEFT JOIN public.client_sites cs ON cs.id = COALESCE(ml.log_site_id, r.site_id)
    LEFT JOIN public.users eu ON eu.id = ml.entered_by
  ),
  extra_entered_logs AS (
    SELECT DISTINCT ON (l.machine_id, l.shift_code)
           l.operator_id,
           COALESCE(u.full_name, 'Unassigned') AS operator_name,
           u.phone AS operator_phone,
           u.employee_id AS operator_employee_id,
           l.machine_id,
           COALESCE(m.machine_id, 'M/C') AS machine_code,
           m.serial_number AS machine_serial_number,
           m.model AS machine_model,
           l.client_id,
           COALESCE(cl.client_id, cl.code) AS client_code,
           COALESCE(cl.company_name, 'Direct Client') AS client_name,
           COALESCE(cs.city, cl.city, m.city) AS client_city,
           COALESCE(cs.site_name, cs.city, cl.city, m.city) AS site_name,
           m.hour_meter AS current_meter,
           COALESCE(l.shift_code, 'S1') AS shift_code,
           COALESCE('Shift ' || l.shift_code, 'Shift S1') AS shift_name,
           COALESCE(l.start_time, '06:00:00'::time) AS shift_start,
           COALESCE(l.end_time, '14:00:00'::time) AS shift_end,
           'entered'::text AS status,
           l.id AS log_id,
           l.entered_by,
           eu.full_name AS entered_by_name,
           l.entry_source,
           l.log_date,
           l.start_meter,
           l.end_meter,
           l.running_hours,
           l.remarks,
           m.status AS machine_status,
           m.health_status AS machine_health_status
    FROM public.machine_hour_logs l
    CROSS JOIN target_date td
    JOIN public.machines m ON m.id = l.machine_id
    LEFT JOIN public.users u ON u.id = l.operator_id
    LEFT JOIN public.clients cl ON cl.id = l.client_id
    LEFT JOIN public.client_sites cs ON cs.id = COALESCE(l.site_id, m.site_id)
    LEFT JOIN public.users eu ON eu.id = l.entered_by
    WHERE l.log_date = td.d
      AND (p_client_id IS NULL OR l.client_id = p_client_id OR m.client_id = p_client_id)
      AND NOT EXISTS (
        SELECT 1 FROM roster_results rr
        WHERE rr.log_id = l.id
           OR (rr.machine_id = l.machine_id AND rr.shift_code = l.shift_code AND rr.status = 'entered')
      )
      AND (
        (SELECT role FROM actor_info) IN ('super_admin', 'admin', 'manager')
        OR (l.operator_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.user_supervisors us
          WHERE us.supervisor_id = p_actor_id AND us.user_id = l.operator_id
        ))
        OR (l.operator_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.users op_u
          WHERE op_u.id = l.operator_id AND op_u.supervisor_id = p_actor_id
        ))
        OR m.current_supervisor_id = p_actor_id
        OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
      )
    ORDER BY l.machine_id, l.shift_code, l.created_at DESC
  ),
  all_results AS (
    SELECT * FROM roster_results
    UNION ALL
    SELECT * FROM extra_entered_logs
  )
  SELECT * FROM all_results
  WHERE (p_search IS NULL OR p_search = '' OR (
     operator_name ILIKE '%' || p_search || '%'
     OR COALESCE(operator_phone, '') ILIKE '%' || p_search || '%'
     OR COALESCE(operator_employee_id, '') ILIKE '%' || p_search || '%'
     OR machine_code ILIKE '%' || p_search || '%'
     OR COALESCE(machine_serial_number, '') ILIKE '%' || p_search || '%'
     OR COALESCE(machine_model, '') ILIKE '%' || p_search || '%'
     OR COALESCE(client_name, '') ILIKE '%' || p_search || '%'
     OR COALESCE(client_code, '') ILIKE '%' || p_search || '%'
     OR COALESCE(client_city, '') ILIKE '%' || p_search || '%'
     OR COALESCE(site_name, '') ILIKE '%' || p_search || '%'
  ))
  AND (p_client_id IS NULL OR client_id = p_client_id)
  ORDER BY
    CASE
      WHEN log_id IS NOT NULL THEN 3
      WHEN machine_health_status IN ('breakdown', 'under_maintenance') THEN 0
      WHEN operator_id IS NULL THEN 1
      ELSE 2
    END,
    machine_code,
    shift_code;
$function$;

-- ============================================================
-- 6. get_today_shift_log_monitor_paginated
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_today_shift_log_monitor_paginated(
  p_actor_id uuid,
  p_log_date date DEFAULT CURRENT_DATE,
  p_search text DEFAULT NULL::text,
  p_status text DEFAULT 'all'::text,
  p_client_id uuid DEFAULT NULL::uuid,
  p_shift_code text DEFAULT NULL::text,
  p_sort text DEFAULT 'default'::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_summary jsonb;
  v_rows jsonb;
  v_total_count int;
  v_has_more boolean;
  v_shift_options jsonb;
  v_client_options jsonb;
  v_offset int;
  v_safe_page int;
  v_safe_page_size int;
  v_target_date date;
BEGIN
  v_target_date := COALESCE(p_log_date, (NOW() AT TIME ZONE 'Asia/Kolkata')::date);
  v_safe_page := GREATEST(1, COALESCE(p_page, 1));
  v_safe_page_size := GREATEST(1, LEAST(100, COALESCE(p_page_size, 12)));
  v_offset := (v_safe_page - 1) * v_safe_page_size;

  v_summary := public.get_today_shift_monitor_summary(p_actor_id, v_target_date, p_client_id);

  WITH actor_info AS (
    SELECT role FROM public.users WHERE id = p_actor_id
  ),
  active_assignments AS (
    SELECT oma.id AS assignment_id,
           oma.operator_id,
           oma.machine_id,
           oma.shift_start_time,
           oma.shift_end_time,
           oma.shift_code AS oma_shift_code,
           m.machine_id AS machine_code,
           m.serial_number,
           m.model,
           m.client_id,
           m.site_id,
           m.city AS machine_city,
           m.hour_meter AS current_meter,
           m.status AS machine_status,
           m.health_status AS machine_health_status
    FROM public.operator_machine_assignments oma
    JOIN public.machines m ON m.id = oma.machine_id
    WHERE oma.valid_from <= v_target_date
      AND (oma.valid_to IS NULL OR oma.valid_to >= v_target_date)
      AND (oma.valid_to IS NULL OR oma.valid_from <= oma.valid_to)
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
        OR m.current_supervisor_id = p_actor_id
        OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
        OR (
          m.client_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.client_supervisors cs
            WHERE cs.client_id = m.client_id AND cs.supervisor_id = p_actor_id
          )
        )
      )
  ),
  unassigned_machines AS (
    SELECT NULL::uuid AS assignment_id,
           NULL::uuid AS operator_id,
           m.id AS machine_id,
           NULL::time AS shift_start_time,
           NULL::time AS shift_end_time,
           'S1'::text AS oma_shift_code,
           m.machine_id AS machine_code,
           m.serial_number,
           m.model,
           m.client_id,
           m.site_id,
           m.city AS machine_city,
           m.hour_meter AS current_meter,
           m.status AS machine_status,
           m.health_status AS machine_health_status
    FROM public.machines m
    WHERE (
        m.status IN ('active', 'rented', 'available', 'under_maintenance')
        OR m.health_status IN ('under_maintenance', 'breakdown')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.operator_machine_assignments oma
        WHERE oma.machine_id = m.id
          AND oma.valid_from <= v_target_date
          AND (oma.valid_to IS NULL OR oma.valid_to >= v_target_date)
          AND (oma.valid_to IS NULL OR oma.valid_from <= oma.valid_to)
      )
      AND (
        (SELECT role FROM actor_info) IN ('super_admin', 'admin', 'manager')
        OR m.current_supervisor_id = p_actor_id
        OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
        OR (
          m.client_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.client_supervisors cs
            WHERE cs.client_id = m.client_id AND cs.supervisor_id = p_actor_id
          )
        )
      )
  ),
  combined_roster_sources AS (
    SELECT * FROM active_assignments
    UNION ALL
    SELECT * FROM unassigned_machines
  ),
  matched_logs AS (
    SELECT r.operator_id,
           r.machine_id,
           r.oma_shift_code,
           r.assignment_id,
           l.id AS log_id,
           l.entered_by,
           l.entry_source,
           l.log_date,
           l.start_meter,
           l.end_meter,
           l.running_hours,
           l.remarks,
           l.operator_id as log_operator_id,
           l.site_id as log_site_id,
           l.shift_code as log_shift_code,
           ROW_NUMBER() OVER (
             PARTITION BY r.machine_id, COALESCE(r.operator_id, '00000000-0000-0000-0000-000000000000'::uuid), r.oma_shift_code
             ORDER BY
               CASE
                 WHEN r.assignment_id IS NOT NULL AND l.assignment_id = r.assignment_id THEN 0
                 WHEN l.shift_code = r.oma_shift_code THEN 1
                 ELSE 2
               END,
               l.created_at DESC
           ) as rn
    FROM combined_roster_sources r
    LEFT JOIN public.machine_hour_logs l
      ON (
        (r.assignment_id IS NOT NULL AND l.assignment_id = r.assignment_id)
        OR (l.machine_id = r.machine_id AND (
          (r.operator_id IS NOT NULL AND l.operator_id = r.operator_id)
          OR (r.operator_id IS NULL)
        ))
      )
      AND l.log_date = v_target_date
  ),
  unique_matched_logs AS (
    SELECT * FROM matched_logs WHERE rn = 1
  ),
  roster_results AS (
    SELECT
      r.operator_id,
      COALESCE(u.full_name, log_op.full_name, 'Unassigned') AS operator_name,
      COALESCE(u.phone, log_op.phone) AS operator_phone,
      COALESCE(u.employee_id, log_op.employee_id) AS operator_employee_id,
      r.machine_id,
      r.machine_code,
      r.serial_number AS machine_serial_number,
      r.model AS machine_model,
      r.client_id,
      COALESCE(cl.client_id, cl.code) AS client_code,
      COALESCE(cl.company_name, 'Direct Client') AS client_name,
      COALESCE(cs.city, cl.city, r.machine_city) AS client_city,
      COALESCE(cs.site_name, cs.city, cl.city, r.machine_city) AS site_name,
      COALESCE(ml.end_meter, r.current_meter) AS current_meter,
      COALESCE(ml.log_shift_code, r.oma_shift_code, 'S1') AS shift_code,
      COALESCE('Shift ' || ml.log_shift_code, 'Shift ' || r.oma_shift_code, 'Shift S1') AS shift_name,
      COALESCE(r.shift_start_time, '06:00:00'::time) AS shift_start,
      COALESCE(r.shift_end_time, '14:00:00'::time) AS shift_end,
      CASE
        WHEN r.operator_id IS NULL THEN 'unassigned'
        WHEN ml.log_id IS NOT NULL THEN 'entered'
        ELSE 'pending'
      END AS status,
      ml.log_id,
      ml.entered_by,
      eu.full_name AS entered_by_name,
      ml.entry_source,
      COALESCE(ml.log_date, v_target_date) AS log_date,
      ml.start_meter,
      ml.end_meter,
      ml.running_hours,
      ml.remarks,
      r.machine_status,
      r.machine_health_status
    FROM combined_roster_sources r
    LEFT JOIN unique_matched_logs ml
      ON ml.machine_id = r.machine_id
      AND ml.oma_shift_code = r.oma_shift_code
      AND (
        (r.operator_id IS NOT NULL AND ml.operator_id = r.operator_id)
        OR (r.operator_id IS NULL AND ml.operator_id IS NULL)
      )
    LEFT JOIN public.users u ON u.id = r.operator_id
    LEFT JOIN public.users log_op ON log_op.id = ml.log_operator_id
    LEFT JOIN public.clients cl ON cl.id = r.client_id
    LEFT JOIN public.client_sites cs ON cs.id = COALESCE(ml.log_site_id, r.site_id)
    LEFT JOIN public.users eu ON eu.id = ml.entered_by
  ),
  extra_entered_logs AS (
    SELECT DISTINCT ON (l.machine_id, l.shift_code)
           l.operator_id,
           COALESCE(u.full_name, 'Unassigned') AS operator_name,
           u.phone AS operator_phone,
           u.employee_id AS operator_employee_id,
           l.machine_id,
           COALESCE(m.machine_id, 'M/C') AS machine_code,
           m.serial_number AS machine_serial_number,
           m.model AS machine_model,
           l.client_id,
           COALESCE(cl.client_id, cl.code) AS client_code,
           COALESCE(cl.company_name, 'Direct Client') AS client_name,
           COALESCE(cs.city, cl.city, m.city) AS client_city,
           COALESCE(cs.site_name, cs.city, cl.city, m.city) AS site_name,
           m.hour_meter AS current_meter,
           COALESCE(l.shift_code, 'S1') AS shift_code,
           COALESCE('Shift ' || l.shift_code, 'Shift S1') AS shift_name,
           COALESCE(l.start_time, '06:00:00'::time) AS shift_start,
           COALESCE(l.end_time, '14:00:00'::time) AS shift_end,
           'entered'::text AS status,
           l.id AS log_id,
           l.entered_by,
           eu.full_name AS entered_by_name,
           l.entry_source,
           l.log_date,
           l.start_meter,
           l.end_meter,
           l.running_hours,
           l.remarks,
           m.status AS machine_status,
           m.health_status AS machine_health_status
    FROM public.machine_hour_logs l
    JOIN public.machines m ON m.id = l.machine_id
    LEFT JOIN public.users u ON u.id = l.operator_id
    LEFT JOIN public.clients cl ON cl.id = l.client_id
    LEFT JOIN public.client_sites cs ON cs.id = COALESCE(l.site_id, m.site_id)
    LEFT JOIN public.users eu ON eu.id = l.entered_by
    WHERE l.log_date = v_target_date
      AND (p_client_id IS NULL OR l.client_id = p_client_id OR m.client_id = p_client_id)
      AND NOT EXISTS (
        SELECT 1 FROM roster_results rr
        WHERE rr.log_id = l.id
           OR (rr.machine_id = l.machine_id AND rr.shift_code = l.shift_code AND rr.status = 'entered')
      )
      AND (
        (SELECT role FROM actor_info) IN ('super_admin', 'admin', 'manager')
        OR (l.operator_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.user_supervisors us
          WHERE us.supervisor_id = p_actor_id AND us.user_id = l.operator_id
        ))
        OR (l.operator_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.users op_u
          WHERE op_u.id = l.operator_id AND op_u.supervisor_id = p_actor_id
        ))
        OR m.current_supervisor_id = p_actor_id
        OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
      )
    ORDER BY l.machine_id, l.shift_code, l.created_at DESC
  ),
  all_results AS (
    SELECT * FROM roster_results
    UNION ALL
    SELECT * FROM extra_entered_logs
  ),
  filtered_results AS (
    SELECT * FROM all_results
    WHERE (p_search IS NULL OR p_search = '' OR (
       operator_name ILIKE '%' || p_search || '%'
       OR COALESCE(operator_phone, '') ILIKE '%' || p_search || '%'
       OR COALESCE(operator_employee_id, '') ILIKE '%' || p_search || '%'
       OR machine_code ILIKE '%' || p_search || '%'
       OR COALESCE(machine_serial_number, '') ILIKE '%' || p_search || '%'
       OR COALESCE(machine_model, '') ILIKE '%' || p_search || '%'
       OR COALESCE(client_name, '') ILIKE '%' || p_search || '%'
       OR COALESCE(client_code, '') ILIKE '%' || p_search || '%'
       OR COALESCE(client_city, '') ILIKE '%' || p_search || '%'
       OR COALESCE(site_name, '') ILIKE '%' || p_search || '%'
    ))
    AND (p_status = 'all' OR status = p_status)
    AND (p_client_id IS NULL OR client_id = p_client_id)
    AND (p_shift_code IS NULL OR shift_code = p_shift_code)
  ),
  counted AS (
    SELECT COUNT(*) AS total FROM filtered_results
  ),
  paginated_results AS (
    SELECT * FROM filtered_results
    ORDER BY
      CASE p_sort
        WHEN 'machine_asc' THEN machine_code
        ELSE NULL
      END ASC,
      CASE p_sort
        WHEN 'machine_desc' THEN machine_code
        ELSE NULL
      END DESC,
      CASE
        WHEN p_sort = 'default' AND log_id IS NOT NULL THEN 3
        WHEN p_sort = 'default' AND machine_health_status IN ('breakdown', 'under_maintenance') THEN 0
        WHEN p_sort = 'default' AND operator_id IS NULL THEN 1
        WHEN p_sort = 'default' THEN 2
        ELSE 0
      END,
      machine_code,
      shift_code
    OFFSET v_offset
    LIMIT v_safe_page_size
  )
  SELECT
    (SELECT total FROM counted) AS total_count,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'operator_id', pr.operator_id,
          'operator_name', pr.operator_name,
          'operator_phone', pr.operator_phone,
          'operator_employee_id', pr.operator_employee_id,
          'machine_id', pr.machine_id,
          'machine_code', pr.machine_code,
          'machine_serial_number', pr.machine_serial_number,
          'machine_model', pr.machine_model,
          'client_id', pr.client_id,
          'client_code', pr.client_code,
          'client_name', pr.client_name,
          'client_city', pr.client_city,
          'site_name', pr.site_name,
          'current_meter', pr.current_meter,
          'shift_code', pr.shift_code,
          'shift_name', pr.shift_name,
          'shift_start', pr.shift_start,
          'shift_end', pr.shift_end,
          'status', pr.status,
          'log_id', pr.log_id,
          'entered_by', pr.entered_by,
          'entered_by_name', pr.entered_by_name,
          'entry_source', pr.entry_source,
          'log_date', pr.log_date,
          'start_meter', pr.start_meter,
          'end_meter', pr.end_meter,
          'running_hours', pr.running_hours,
          'remarks', pr.remarks,
          'machine_status', pr.machine_status,
          'machine_health_status', pr.machine_health_status
        )
      ),
      '[]'::jsonb
    ) AS rows
  INTO v_total_count, v_rows
  FROM paginated_results pr;

  v_has_more := (v_offset + v_safe_page_size) < COALESCE(v_total_count, 0);

  RETURN jsonb_build_object(
    'summary', v_summary,
    'rows', COALESCE(v_rows, '[]'::jsonb),
    'total_count', COALESCE(v_total_count, 0),
    'has_more', v_has_more,
    'page', v_safe_page,
    'page_size', v_safe_page_size
  );
END;
$function$;
