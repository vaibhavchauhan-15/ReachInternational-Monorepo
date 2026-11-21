-- ==============================================================================
-- Migration 226: Fix Multi-Shift Assignment ID Collisions, Date Independence,
--               Unassigned Past-Date Guard & Hour Meter Non-Regression
-- ==============================================================================
-- 1. Upgrades submit_operator_hour_log_atomic():
--    - Adds p_assignment_id uuid DEFAULT NULL::uuid parameter (eliminating PGRST202 mobile fallback).
--    - Resolves authoritative assignment_id strictly matching machine_id, operator_id,
--      v_log_date, and normalized v_shift_code (preventing multi-shift ID collisions on the same machine).
--    - Protects machine hour meter from regressing backwards on historical past-date entry
--      using GREATEST(COALESCE(hour_meter, 0), p_end_meter).
--    - Strictly enforces that an operator self-entry requires an active assignment on v_log_date.
-- 2. Upgrades get_operator_entry_context():
--    - Drops single-argument overload to eliminate PGRST203 ambiguity.
--    - Canonical signature (p_operator_id uuid DEFAULT NULL::uuid, p_target_date date DEFAULT NULL::date).
--    - Returns structured assigned_shifts array mapping each assigned shift_code to its specific assignment_id.
--    - Returns assigned_machines array for multi-machine assigned operators.
-- 3. Adds trg_enforce_operator_assignment_exists trigger on machine_hour_logs:
--    - Blocks unassigned past-date direct inserts from operators (SQLSTATE 42501).
--    - Auto-corrects/populates assignment_id to match the exact shift_code being logged.
-- 4. Reloads PostgREST schema cache via NOTIFY pgrst.
-- ==============================================================================

-- 1. Upgrade submit_operator_hour_log_atomic
DROP FUNCTION IF EXISTS public.submit_operator_hour_log_atomic(uuid, uuid, uuid, text, date, date, timestamp with time zone, timestamp with time zone, numeric, numeric, text, text, numeric, numeric, boolean, text, text, text, numeric, text, text, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.submit_operator_hour_log_atomic(uuid, uuid, uuid, text, date, date, timestamp with time zone, timestamp with time zone, numeric, numeric, text, text, numeric, numeric, boolean, text, text, text, numeric, text, text, text, text, text, uuid, uuid);

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
  p_entered_by uuid DEFAULT NULL::uuid,
  p_assignment_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_actor_id               UUID;
  v_entry_source           TEXT;
  v_log_id                 UUID;
  v_audit_meta             JSONB;
  v_resolved_client_id     UUID;
  v_resolved_site_id       UUID;
  v_resolved_location      TEXT := p_location;
  v_idempotency_key        TEXT;
  v_start_time             TIME;
  v_end_time               TIME;
  v_breakdown_start_time   TIME;
  v_breakdown_end_time     TIME;
  v_log_date               DATE;
  v_end_date               DATE;
  v_start_datetime         TIMESTAMPTZ;
  v_end_datetime           TIMESTAMPTZ;
  v_shift_code             TEXT;
  v_shift_name             TEXT;
  v_normal_hours           NUMERIC;
  v_caller_role            TEXT;
  v_breakdown_minutes      INTEGER;
  v_maintenance_minutes    INTEGER;
  v_assigned_shift_codes   TEXT[];
  v_is_assisted_override   BOOLEAN := false;
  v_existing_machine_log   RECORD;
  v_existing_op_log        RECORD;
  v_resolved_assignment_id UUID;
  v_today_ist              DATE;
BEGIN
  v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
  v_log_date  := COALESCE(p_log_date, v_today_ist);

  -- 1. Determine actor and entry attribution
  v_actor_id := COALESCE(p_entered_by, auth.uid(), p_operator_id);

  IF v_actor_id = p_operator_id THEN
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_actor_id;
    IF v_caller_role != 'operator' AND v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'supervisor') THEN
      RAISE EXCEPTION 'Not authorized to submit shift log' USING ERRCODE = '42501';
    END IF;
    v_entry_source := 'operator';
  ELSE
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_actor_id;
    IF v_caller_role IN ('super_admin', 'admin', 'manager') THEN
      v_entry_source := v_caller_role;
    ELSIF v_caller_role = 'supervisor' THEN
      IF NOT (
        public.is_operator_under_supervisor(v_actor_id, p_operator_id)
        OR EXISTS (
          SELECT 1 FROM public.machines m
          WHERE m.id = p_machine_id
            AND (
              m.current_supervisor_id = v_actor_id
              OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[v_actor_id])
              OR (
                m.client_id IS NOT NULL AND EXISTS (
                  SELECT 1 FROM public.client_supervisors cs
                  WHERE cs.client_id = m.client_id AND cs.supervisor_id = v_actor_id
                )
              )
            )
        )
      ) THEN
        RAISE EXCEPTION 'Not authorized: Supervisors can only fill shift entries for operators or machinery assigned under their supervision.'
          USING ERRCODE = '42501';
      END IF;
      v_entry_source := 'supervisor';
    ELSE
      RAISE EXCEPTION 'Not authorized to enter shift logs on behalf of operators. Only authorized supervisors, managers, and administrators are permitted.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 1b. Equipment Assignment Enforcement for Operator Self-Entry
  IF v_entry_source = 'operator' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.operator_machine_assignments oma
      WHERE oma.machine_id  = p_machine_id
        AND oma.operator_id = p_operator_id
        AND oma.valid_from <= v_log_date
        AND (oma.valid_to IS NULL OR oma.valid_to >= v_log_date)
    ) THEN
      RAISE EXCEPTION 'Operator is not authorized to submit shift logs for this equipment on date %. You must have a valid assignment covering this work date.',
        v_log_date
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 2. Meter Range & Maximum Running Hours Guard
  IF p_start_meter < 0 OR p_end_meter < 0 THEN
    RAISE EXCEPTION 'Hour meter readings cannot be negative (start: %, end: %)', p_start_meter, p_end_meter
      USING ERRCODE = '23514';
  END IF;

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

  -- 4. Shift Code and Name Resolution
  v_shift_code := NULLIF(TRIM(COALESCE(p_shift_code, p_shift)), '');
  IF v_shift_code IS NOT NULL THEN
    v_shift_code := regexp_replace(v_shift_code, '^shift\\s*', '', 'i');
  END IF;

  -- 5. Normalization of Dates and Times
  v_end_date   := COALESCE(p_end_date, v_log_date);
  v_start_time := NULLIF(TRIM(p_start_time), '')::TIME;
  v_end_time   := NULLIF(TRIM(p_end_time), '')::TIME;
  v_breakdown_start_time := NULLIF(TRIM(p_breakdown_start_time), '')::TIME;
  v_breakdown_end_time   := NULLIF(TRIM(p_breakdown_end_time), '')::TIME;
  v_start_datetime := p_start_datetime;
  v_end_datetime   := p_end_datetime;

  -- Default times from shift code when omitted
  IF v_start_time IS NULL THEN
    v_start_time := CASE v_shift_code
      WHEN 'A'  THEN '06:00:00'::TIME
      WHEN 'B'  THEN '14:00:00'::TIME
      WHEN 'C'  THEN '22:00:00'::TIME
      WHEN 'S1' THEN '08:00:00'::TIME
      ELSE           '08:00:00'::TIME
    END;
  END IF;

  IF v_end_time IS NULL THEN
    v_end_time := CASE v_shift_code
      WHEN 'A'  THEN '14:00:00'::TIME
      WHEN 'B'  THEN '22:00:00'::TIME
      WHEN 'C'  THEN '06:00:00'::TIME
      WHEN 'S1' THEN '16:00:00'::TIME
      ELSE           '16:00:00'::TIME
    END;
  END IF;

  IF v_start_datetime IS NULL THEN
    v_start_datetime := ((v_log_date::text || ' ' || v_start_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata');
  END IF;

  IF v_end_datetime IS NULL THEN
    IF v_end_time <= v_start_time AND v_end_date = v_log_date THEN
      v_end_date := (v_log_date + INTERVAL '1 day')::date;
    END IF;
    v_end_datetime := ((v_end_date::text || ' ' || v_end_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata');
  END IF;

  -- 6. Operator 7-Day Window Guard
  IF v_entry_source = 'operator' THEN
    IF v_log_date < (v_today_ist - 7) OR v_log_date > v_today_ist THEN
      RAISE EXCEPTION 'Operators can only record logs within the previous 7 days IST (date %, allowed: % to %)',
        v_log_date, (v_today_ist - 7), v_today_ist
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- 7. Authoritative resolution of assignment_id strictly matching shift_code
  -- Priority A: Find assignment strictly matching the normalized shift_code
  IF v_shift_code IS NOT NULL THEN
    SELECT oma.id INTO v_resolved_assignment_id
    FROM public.operator_machine_assignments oma
    WHERE oma.machine_id  = p_machine_id
      AND oma.operator_id = p_operator_id
      AND oma.valid_from <= v_log_date
      AND (oma.valid_to IS NULL OR oma.valid_to >= v_log_date)
      AND lower(trim(regexp_replace(oma.shift_code, '^shift\\s*', '', 'i'))) = lower(trim(v_shift_code))
    ORDER BY oma.valid_from DESC
    LIMIT 1;
  END IF;

  -- Priority B: Check if client passed p_assignment_id is valid for this machine, operator, and shift
  IF v_resolved_assignment_id IS NULL AND p_assignment_id IS NOT NULL THEN
    SELECT oma.id INTO v_resolved_assignment_id
    FROM public.operator_machine_assignments oma
    WHERE oma.id = p_assignment_id
      AND oma.machine_id  = p_machine_id
      AND oma.operator_id = p_operator_id
      AND oma.valid_from <= v_log_date
      AND (oma.valid_to IS NULL OR oma.valid_to >= v_log_date);
  END IF;

  -- Priority C: Fall back to any active assignment on that machine & date
  IF v_resolved_assignment_id IS NULL THEN
    SELECT oma.id INTO v_resolved_assignment_id
    FROM public.operator_machine_assignments oma
    WHERE oma.machine_id  = p_machine_id
      AND oma.operator_id = p_operator_id
      AND oma.valid_from <= v_log_date
      AND (oma.valid_to IS NULL OR oma.valid_to >= v_log_date)
    ORDER BY oma.valid_from DESC
    LIMIT 1;
  END IF;

  -- 7b. Assigned Shift Code Enforcement
  IF p_operator_id IS NOT NULL AND p_machine_id IS NOT NULL THEN
    SELECT ARRAY_AGG(DISTINCT shift_code)
    INTO v_assigned_shift_codes
    FROM public.operator_machine_assignments
    WHERE machine_id  = p_machine_id
      AND operator_id = p_operator_id
      AND valid_from <= v_log_date
      AND (valid_to IS NULL OR valid_to >= v_log_date)
      AND shift_code IS NOT NULL;

    IF v_assigned_shift_codes IS NOT NULL AND array_length(v_assigned_shift_codes, 1) > 0 THEN
      IF v_shift_code IS NOT NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM unnest(v_assigned_shift_codes) c
          WHERE lower(trim(regexp_replace(c, '^shift\\s*', '', 'i'))) = lower(trim(v_shift_code))
        ) THEN
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

  -- 8. Duplicate Machine Shift Guard
  IF v_resolved_assignment_id IS NOT NULL THEN
    SELECT id, start_meter, end_meter, operator_id, normal_working_hours, breakdown_minutes, maintenance_minutes
    INTO v_existing_machine_log
    FROM public.machine_hour_logs
    WHERE assignment_id = v_resolved_assignment_id
      AND log_date = v_log_date
    LIMIT 1;
  ELSIF v_shift_code IS NOT NULL THEN
    SELECT id, start_meter, end_meter, operator_id, normal_working_hours, breakdown_minutes, maintenance_minutes
    INTO v_existing_machine_log
    FROM public.machine_hour_logs
    WHERE machine_id = p_machine_id
      AND log_date = v_log_date
      AND shift_code = v_shift_code
    LIMIT 1;
  END IF;

  IF v_existing_machine_log.id IS NOT NULL THEN
    IF v_existing_machine_log.operator_id = p_operator_id
       AND v_existing_machine_log.start_meter = p_start_meter
       AND v_existing_machine_log.end_meter = p_end_meter THEN
      RETURN jsonb_build_object(
        'success',               true,
        'id',                    v_existing_machine_log.id,
        'log_id',                v_existing_machine_log.id,
        'machine_id',            p_machine_id,
        'operator_id',           p_operator_id,
        'site_id',               v_resolved_site_id,
        'log_date',              v_log_date,
        'start_meter',           p_start_meter,
        'end_meter',             p_end_meter,
        'running_hours',         GREATEST(0, p_end_meter - p_start_meter),
        'normal_working_hours',  v_existing_machine_log.normal_working_hours,
        'overtime_hours',        COALESCE(p_overtime_hours, 0),
        'breakdown_minutes',     v_existing_machine_log.breakdown_minutes,
        'maintenance_minutes',   v_existing_machine_log.maintenance_minutes,
        'shift_code',            v_shift_code,
        'entry_source',          v_entry_source,
        'is_assisted_override',  v_is_assisted_override,
        'already_logged',        true
      );
    ELSE
      RAISE EXCEPTION 'A log for Shift % on date % has already been recorded for this equipment (Start: %, End: %). Duplicate entries are not permitted.',
        v_shift_code, v_log_date, v_existing_machine_log.start_meter, v_existing_machine_log.end_meter
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- 9. Cross-Machine Operator Shift Guard
  IF p_operator_id IS NOT NULL AND v_shift_code IS NOT NULL THEN
    SELECT l.id, l.machine_id, m.machine_id AS machine_code, l.start_meter, l.end_meter
    INTO v_existing_op_log
    FROM public.machine_hour_logs l
    LEFT JOIN public.machines m ON m.id = l.machine_id
    WHERE l.operator_id = p_operator_id
      AND l.log_date = v_log_date
      AND l.shift_code = v_shift_code
      AND l.machine_id <> p_machine_id
    LIMIT 1;

    IF v_existing_op_log.id IS NOT NULL THEN
      RAISE EXCEPTION 'Operator has already submitted a log for Shift % on machine % on %. An operator cannot operate two machines during the same shift.',
        v_shift_code, COALESCE(v_existing_op_log.machine_code, 'other equipment'), v_log_date
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- 10. Client, Site & Location Resolution
  IF p_client_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.client_sites WHERE id = p_client_id) THEN
      v_resolved_site_id := p_client_id;
      SELECT client_id INTO v_resolved_client_id FROM public.client_sites WHERE id = v_resolved_site_id;
    ELSE
      v_resolved_client_id := p_client_id;
    END IF;
  ELSE
    SELECT client_id, site_id INTO v_resolved_client_id, v_resolved_site_id FROM public.machines WHERE id = p_machine_id;
  END IF;

  IF v_resolved_location IS NULL AND v_resolved_site_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(btrim(site_name), ''), NULLIF(btrim(city), ''))
    INTO v_resolved_location FROM public.client_sites WHERE id = v_resolved_site_id;
  END IF;

  IF v_resolved_location IS NULL AND v_resolved_client_id IS NOT NULL THEN
    SELECT concat_ws(', ', NULLIF(btrim(city), ''), NULLIF(btrim(district), ''), NULLIF(btrim(state), ''))
    INTO v_resolved_location FROM public.clients WHERE id = v_resolved_client_id;
  END IF;

  -- 11. Normal Hours
  v_normal_hours := COALESCE(p_normal_working_hours, 8);

  -- 12. Ensure Idempotency Key
  v_idempotency_key := COALESCE(
    NULLIF(TRIM(p_idempotency_key), ''),
    'ihl_' || replace(gen_random_uuid()::text, '-', '')
  );

  -- 13. Compute Breakdown Minutes
  v_breakdown_minutes := 0;
  IF p_is_breakdown = true THEN
    IF p_breakdown_hours > 0 THEN
      v_breakdown_minutes := ROUND(p_breakdown_hours * 60);
    ELSIF v_breakdown_start_time IS NOT NULL AND v_breakdown_end_time IS NOT NULL THEN
      IF v_breakdown_end_time >= v_breakdown_start_time THEN
        v_breakdown_minutes := ROUND(EXTRACT(EPOCH FROM (v_breakdown_end_time - v_breakdown_start_time)) / 60);
      ELSE
        v_breakdown_minutes := ROUND(EXTRACT(EPOCH FROM ((v_breakdown_end_time + INTERVAL '24 hours') - v_breakdown_start_time)) / 60);
      END IF;
    END IF;
  END IF;

  -- 14. Compute Maintenance Allowance
  v_maintenance_minutes := 0;
  IF v_resolved_client_id IS NOT NULL THEN
    SELECT COALESCE(maintenance_allowance_minutes, 0)
    INTO v_maintenance_minutes FROM public.clients WHERE id = v_resolved_client_id;
  END IF;

  -- 15. Insert into machine_hour_logs
  INSERT INTO public.machine_hour_logs (
    machine_id, operator_id, client_id, site_id,
    assignment_id,
    log_date, end_date, start_datetime, end_datetime,
    start_meter, end_meter, start_time, end_time,
    overtime_hours, normal_working_hours,
    is_breakdown, breakdown_start_time, breakdown_end_time,
    breakdown_duration, breakdown_hours, breakdown_minutes, maintenance_minutes,
    shift, shift_code, machine_condition, location, remarks,
    idempotency_key, entered_by, entry_source
  ) VALUES (
    p_machine_id, p_operator_id, v_resolved_client_id, v_resolved_site_id,
    v_resolved_assignment_id,
    v_log_date, v_end_date, v_start_datetime, v_end_datetime,
    p_start_meter, p_end_meter, v_start_time, v_end_time,
    COALESCE(p_overtime_hours, 0), v_normal_hours,
    COALESCE(p_is_breakdown, false), v_breakdown_start_time, v_breakdown_end_time,
    p_breakdown_duration, COALESCE(p_breakdown_hours, 0),
    COALESCE(v_breakdown_minutes, 0), COALESCE(v_maintenance_minutes, 0),
    v_shift_name, v_shift_code,
    COALESCE(p_machine_condition, 'good'),
    v_resolved_location, p_remarks,
    v_idempotency_key, v_actor_id, v_entry_source
  )
  RETURNING id INTO v_log_id;

  -- 16. Update Machine hour_meter (NON-REGRESSING GREATEST), current_operator_id, health_status
  UPDATE public.machines
  SET
    hour_meter          = GREATEST(COALESCE(hour_meter, 0), p_end_meter),
    current_operator_id = p_operator_id,
    health_status       = CASE
      WHEN COALESCE(p_is_breakdown, false) = true OR p_machine_condition = 'breakdown' THEN 'breakdown'
      ELSE 'active'
    END,
    updated_at = NOW()
  WHERE id = p_machine_id;

  -- 17. Record Structured Audit Log
  v_audit_meta := jsonb_build_object(
    'logId',              v_log_id,
    'assignmentId',       v_resolved_assignment_id,
    'startMeter',         p_start_meter,
    'endMeter',           p_end_meter,
    'runningHours',       (p_end_meter - p_start_meter),
    'normalWorkingHours', v_normal_hours,
    'overtimeHours',      p_overtime_hours,
    'startTime',          p_start_time,
    'endTime',            p_end_time,
    'shiftCode',          v_shift_code,
    'condition',          p_machine_condition,
    'idempotencyKey',     v_idempotency_key,
    'enteredBy',          v_actor_id,
    'entrySource',        v_entry_source,
    'isAssistedOverride', v_is_assisted_override
  );

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata, details, created_at)
  VALUES (
    v_actor_id, 'machine.hour_logged', 'machine', p_machine_id::text,
    v_audit_meta, v_audit_meta, NOW()
  );

  RETURN jsonb_build_object(
    'success',              true,
    'id',                   v_log_id,
    'log_id',               v_log_id,
    'assignment_id',        v_resolved_assignment_id,
    'machine_id',           p_machine_id,
    'operator_id',          p_operator_id,
    'site_id',              v_resolved_site_id,
    'log_date',             v_log_date,
    'start_meter',          p_start_meter,
    'end_meter',            p_end_meter,
    'running_hours',        (p_end_meter - p_start_meter),
    'normal_working_hours', v_normal_hours,
    'overtime_hours',       COALESCE(p_overtime_hours, 0),
    'breakdown_minutes',    v_breakdown_minutes,
    'maintenance_minutes',  v_maintenance_minutes,
    'shift_code',           v_shift_code,
    'entry_source',         v_entry_source,
    'is_assisted_override', v_is_assisted_override
  );
END;
$function$;


-- 2. Upgrade get_operator_entry_context()
DROP FUNCTION IF EXISTS public.get_operator_entry_context(uuid);
DROP FUNCTION IF EXISTS public.get_operator_entry_context(uuid, date);

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
  v_target_date           date;
  v_operator_id           uuid;
  v_assigned_machine_id   uuid;
  v_assignment_id         uuid;
  v_oma_shift_start       time;
  v_oma_shift_end         time;
  v_oma_shift_code        text;
  v_assigned_shift_codes  jsonb := '[]'::jsonb;
  v_assigned_shifts       jsonb := '[]'::jsonb;
  v_assigned_machines     jsonb := '[]'::jsonb;

  v_op_id                 uuid;
  v_op_name               text;
  v_op_role               text;
  v_op_shift_start        time;
  v_op_shift_end          time;

  v_m_id                  uuid;
  v_m_code                text;
  v_m_model               text;
  v_m_serial              text;
  v_m_hmr                 numeric;
  v_m_client_id           uuid;

  v_c_id                  uuid;
  v_c_name                text;
  v_c_site                text;

  v_last_hmr              numeric;
  v_last_log              jsonb;
  v_shift_codes           jsonb := '[]'::jsonb;
  v_today_logged_shift_codes text[] := '{}'::text[];
  v_today_logs            jsonb := '[]'::jsonb;
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
      'assigned_shifts', '[]'::jsonb,
      'assigned_machines', '[]'::jsonb,
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
      'assigned_shifts', '[]'::jsonb,
      'assigned_machines', '[]'::jsonb,
      'today_logged_shift_codes', '[]'::jsonb,
      'today_logs', '[]'::jsonb
    );
  END IF;

  -- 1. Collect all assigned shifts and machines for TARGET DATE via valid_from / valid_to
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'assignment_id', oma.id,
      'machine_id', oma.machine_id,
      'machine_code', m.machine_id,
      'shift_code', oma.shift_code,
      'shift_start', to_char(oma.shift_start_time, 'HH12:MI AM'),
      'shift_end', to_char(oma.shift_end_time, 'HH12:MI AM'),
      'raw_shift_start', oma.shift_start_time::text,
      'raw_shift_end', oma.shift_end_time::text
    )
    ORDER BY oma.shift_start_time ASC, oma.shift_code ASC
  ), '[]'::jsonb)
  INTO v_assigned_shifts
  FROM public.operator_machine_assignments oma
  JOIN public.machines m ON m.id = oma.machine_id
  WHERE oma.operator_id = v_operator_id
    AND oma.valid_from <= v_target_date
    AND (oma.valid_to IS NULL OR oma.valid_to >= v_target_date);

  -- 2. Resolve primary assignment for TARGET DATE
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
      'assigned_shifts', '[]'::jsonb,
      'assigned_machines', '[]'::jsonb,
      'today_logged_shift_codes', '[]'::jsonb,
      'today_logs', '[]'::jsonb
    );
  END IF;

  -- Distinct assigned machines for target date
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'machine_id', m.machine_id,
      'model', m.model,
      'serial_number', m.serial_number
    )
  ), '[]'::jsonb)
  INTO v_assigned_machines
  FROM (
    SELECT DISTINCT oma.machine_id
    FROM public.operator_machine_assignments oma
    WHERE oma.operator_id = v_operator_id
      AND oma.valid_from <= v_target_date
      AND (oma.valid_to IS NULL OR oma.valid_to >= v_target_date)
  ) sub
  JOIN public.machines m ON m.id = sub.machine_id;

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
    'assigned_shifts', v_assigned_shifts,
    'assigned_machines', v_assigned_machines,
    'today_logged_shift_codes', to_jsonb(v_today_logged_shift_codes),
    'today_logs', v_today_logs
  );
END;
$function$;


-- 3. Trigger on machine_hour_logs to enforce assignment existence and auto-link assignment_id
CREATE OR REPLACE FUNCTION public.trg_fn_enforce_operator_assignment_exists()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller_role TEXT;
  v_matched_ass_id UUID;
  v_shift_code_norm TEXT;
BEGIN
  -- Determine caller role
  v_caller_role := public.current_user_role();

  -- Only enforce on operator self-entries (not supervisor / admin assisted entries)
  IF NEW.entry_source = 'operator'
     OR v_caller_role = 'operator'
     OR (
       auth.uid() IS NOT NULL
       AND auth.uid() = NEW.operator_id
       AND (v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'supervisor'))
     )
  THEN
    -- Verify assignment exists covering log_date
    IF NOT EXISTS (
      SELECT 1 FROM public.operator_machine_assignments oma
      WHERE oma.machine_id = NEW.machine_id
        AND oma.operator_id = NEW.operator_id
        AND oma.valid_from <= NEW.log_date
        AND (oma.valid_to IS NULL OR oma.valid_to >= NEW.log_date)
    ) THEN
      RAISE EXCEPTION 'Operator is not authorized to submit shift logs for this equipment on date %. You must have a valid assignment covering this work date.',
        NEW.log_date
        USING ERRCODE = '42501';
    END IF;

    -- Auto-resolve or correct assignment_id to match the exact shift_code
    v_shift_code_norm := lower(trim(regexp_replace(COALESCE(NEW.shift_code, ''), '^shift\\s*', '', 'i')));
    
    IF v_shift_code_norm <> '' THEN
      SELECT oma.id INTO v_matched_ass_id
      FROM public.operator_machine_assignments oma
      WHERE oma.machine_id = NEW.machine_id
        AND oma.operator_id = NEW.operator_id
        AND oma.valid_from <= NEW.log_date
        AND (oma.valid_to IS NULL OR oma.valid_to >= NEW.log_date)
        AND lower(trim(regexp_replace(oma.shift_code, '^shift\\s*', '', 'i'))) = v_shift_code_norm
      ORDER BY oma.valid_from DESC
      LIMIT 1;

      IF v_matched_ass_id IS NOT NULL THEN
        NEW.assignment_id := v_matched_ass_id;
      ELSIF NEW.assignment_id IS NULL THEN
        SELECT oma.id INTO NEW.assignment_id
        FROM public.operator_machine_assignments oma
        WHERE oma.machine_id = NEW.machine_id
          AND oma.operator_id = NEW.operator_id
          AND oma.valid_from <= NEW.log_date
          AND (oma.valid_to IS NULL OR oma.valid_to >= NEW.log_date)
        ORDER BY oma.valid_from DESC
        LIMIT 1;
      END IF;
    ELSIF NEW.assignment_id IS NULL THEN
      SELECT oma.id INTO NEW.assignment_id
      FROM public.operator_machine_assignments oma
      WHERE oma.machine_id = NEW.machine_id
        AND oma.operator_id = NEW.operator_id
        AND oma.valid_from <= NEW.log_date
        AND (oma.valid_to IS NULL OR oma.valid_to >= NEW.log_date)
      ORDER BY oma.valid_from DESC
      LIMIT 1;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_operator_assignment_exists ON public.machine_hour_logs;
CREATE TRIGGER trg_enforce_operator_assignment_exists
  BEFORE INSERT OR UPDATE ON public.machine_hour_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_enforce_operator_assignment_exists();

-- 4. Harden trg_fn_sync_oma_valid_range to populate ended_at when setting is_active = false
CREATE OR REPLACE FUNCTION public.trg_fn_sync_oma_valid_range()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_today_ist     date;
  v_has_log_today boolean;
BEGIN
  v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;

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

  IF NEW.valid_to IS NOT NULL AND NEW.valid_to < v_today_ist THEN
    NEW.is_active := false;
    IF NEW.ended_at IS NULL THEN
      NEW.ended_at := NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
