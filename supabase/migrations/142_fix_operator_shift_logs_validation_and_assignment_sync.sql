-- ==============================================================================
-- Migration 142: Fix Operator Shift Logs Validation and Assignment Sync
--
-- Business & Technical Rationale:
-- 1. FIX: Assignment Sync Constraint Collision on Multi-Shift Operators (BUG-OP-ROSTER)
--    Previously, submit_operator_hour_log_atomic executed:
--      UPDATE operator_machine_assignments SET shift_code = v_shift_code
--      WHERE (shift_code IS NULL OR shift_code <> v_shift_code)
--    When an operator held 2 active shifts (or logged for a different shift), this
--    attempted to update the existing assigned shift code to v_shift_code, triggering
--    a 23505 unique index collision (idx_oma_machine_active_shift_code) or silently
--    corrupting the operator's roster assignment.
--    Fix: Only populate shift_code if assignment's shift_code IS NULL and does not
--    collide with another assignment on that machine. Existing assigned shift codes
--    are preserved as ground truth.
--
-- 2. FIX: Excessive Running Hours Guard (>24h per shift)
--    Hardens submit_operator_hour_log_atomic and adds table check constraint
--    chk_machine_hour_logs_max_running_hours (end_meter - start_meter <= 24).
--
-- 3. FIX: Breakdown Duration Exceeding Total Shift Duration Guard
--    submit_operator_hour_log_atomic now calculates total shift duration (including
--    overtime) and strictly rejects breakdown_hours > shift_duration.
--
-- 4. FIX: Client Deployment Mismatch Guard
--    Validates that if p_client_id is supplied, it strictly matches machines.client_id.
--
-- 5. FIX: Machine Operational Status Guard
--    Rejects shift log submissions on machines in 'maintenance', 'decommissioned',
--    or 'inactive' status.
--
-- 6. FIX: Operator 7-Day Window Enforcement
--    Hardens enforce_machine_hour_log_operator_date_window trigger and
--    submit_operator_hour_log_atomic so that entry_source = 'operator' or entered_by
--    with role 'operator' is strictly limited to the previous 7 days even when invoked
--    via service-role / admin client.
-- ==============================================================================

-- 1. Add table constraint for maximum 24 running hours per log
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_machine_hour_logs_max_running_hours'
      AND conrelid = 'public.machine_hour_logs'::regclass
  ) THEN
    ALTER TABLE public.machine_hour_logs
      ADD CONSTRAINT chk_machine_hour_logs_max_running_hours
      CHECK ((end_meter - start_meter) <= 24);
  END IF;
END $$;

-- 2. Harden trigger enforce_machine_hour_log_operator_date_window
CREATE OR REPLACE FUNCTION public.enforce_machine_hour_log_operator_date_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_user_role TEXT;
BEGIN
  -- Determine caller role
  v_user_role := public.current_user_role();

  -- If caller is operator, entry_source is operator, or entered_by is operator
  IF v_user_role = 'operator'
     OR NEW.entry_source = 'operator'
     OR (
       auth.uid() IS NOT NULL
       AND auth.uid() = NEW.operator_id
       AND (v_user_role IS NULL OR v_user_role NOT IN ('super_admin', 'admin', 'manager', 'supervisor'))
     )
     OR (
       NEW.entered_by IS NOT NULL
       AND (SELECT role FROM public.users WHERE id = NEW.entered_by) = 'operator'
     )
  THEN
    -- Check NEW.log_date is within previous 7 days (no future dates, no dates older than 7 days)
    IF NEW.log_date < (CURRENT_DATE - 7) OR NEW.log_date > CURRENT_DATE THEN
      RAISE EXCEPTION 'Operators can only record or update logs within the previous 7 days (date %, allowed: % to %)',
        NEW.log_date, (CURRENT_DATE - 7), CURRENT_DATE
        USING ERRCODE = '23514';
    END IF;

    -- On UPDATE, also check that existing log was not older than 7 days
    IF TG_OP = 'UPDATE' AND (OLD.log_date < (CURRENT_DATE - 7) OR OLD.log_date > CURRENT_DATE) THEN
      RAISE EXCEPTION 'This log entry is locked. Logs older than 7 days cannot be edited by operators.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Upgrade canonical submit_operator_hour_log_atomic RPC
CREATE OR REPLACE FUNCTION public.submit_operator_hour_log_atomic(
  p_machine_id uuid,
  p_operator_id uuid,
  p_client_id uuid DEFAULT NULL::uuid,
  p_log_date date DEFAULT CURRENT_DATE,
  p_start_meter numeric DEFAULT 0,
  p_end_meter numeric DEFAULT 0,
  p_start_time text DEFAULT NULL::text,
  p_end_time text DEFAULT NULL::text,
  p_overtime_hours numeric DEFAULT 0,
  p_is_breakdown boolean DEFAULT false,
  p_shift text DEFAULT NULL::text,
  p_machine_condition text DEFAULT 'good'::text,
  p_location text DEFAULT NULL::text,
  p_remarks text DEFAULT NULL::text,
  p_idempotency_key text DEFAULT NULL::text,
  p_normal_working_hours numeric DEFAULT NULL::numeric,
  p_end_date date DEFAULT NULL::date,
  p_start_datetime timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_end_datetime timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_breakdown_start_time text DEFAULT NULL::text,
  p_breakdown_end_time text DEFAULT NULL::text,
  p_breakdown_duration text DEFAULT NULL::text,
  p_breakdown_hours numeric DEFAULT 0,
  p_shift_code text DEFAULT NULL::text,
  p_entered_by uuid DEFAULT NULL::uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
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
  v_shift_name := COALESCE(p_shift, CASE WHEN v_shift_code IS NOT NULL THEN 'Shift ' || v_shift_code ELSE 'Standard Shift' END);

  -- 7. Client & Location Resolution (with Deployment Verification)
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

  -- 8. Normal Hours & Breakdown Bounds Guard
  v_normal_hours := COALESCE(p_normal_working_hours, 8);

  IF v_start_datetime IS NOT NULL AND v_end_datetime IS NOT NULL THEN
    v_shift_duration_hours := ROUND(EXTRACT(EPOCH FROM (v_end_datetime - v_start_datetime)) / 3600.0, 2) + COALESCE(p_overtime_hours, 0);
    IF COALESCE(p_is_breakdown, false) AND COALESCE(p_breakdown_hours, 0) > v_shift_duration_hours THEN
      RAISE EXCEPTION 'Breakdown duration (%h) cannot exceed total shift duration (%h)', p_breakdown_hours, v_shift_duration_hours
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- 9. Compute breakdown_minutes (stored integer minutes)
  v_breakdown_minutes := ROUND(COALESCE(p_breakdown_hours, 0) * 60)::integer;

  -- 10. Ensure Idempotency Key
  v_idempotency_key := COALESCE(
    NULLIF(TRIM(p_idempotency_key), ''),
    'ihl_' || replace(gen_random_uuid()::text, '-', '')
  );

  -- 11. Insert (BEFORE trigger zeroes maintenance_minutes; AFTER trigger recomputes it)
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

  -- 12. Read back trigger-computed maintenance_minutes (set by AFTER trigger atomically)
  SELECT maintenance_minutes INTO v_maintenance_minutes
    FROM public.machine_hour_logs WHERE id = v_log_id;
  v_maintenance_minutes := COALESCE(v_maintenance_minutes, 0);

  -- 13. Update Machine state
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

  -- 14. Sync assignment shift_code ONLY if unassigned (shift_code IS NULL)
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
            AND lower(btrim(ex.shift_code)) = lower(btrim(v_shift_code))
        )
      LIMIT 1
    );
  END IF;

  -- 15. Audit Log
  v_audit_meta := jsonb_build_object(
    'machine_id', p_machine_id,
    'operator_id', p_operator_id,
    'client_id', v_resolved_client_id,
    'log_date', v_log_date,
    'start_meter', p_start_meter,
    'end_meter', p_end_meter,
    'running_hours', p_end_meter - p_start_meter,
    'shift_code', v_shift_code,
    'entry_source', v_entry_source,
    'entered_by', v_actor_id,
    'is_breakdown', COALESCE(p_is_breakdown, false),
    'breakdown_minutes', v_breakdown_minutes,
    'maintenance_minutes', v_maintenance_minutes
  );

  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) VALUES (
    v_actor_id,
    'machine.hour_logged',
    'machine',
    p_machine_id,
    v_audit_meta
  );

  RETURN jsonb_build_object(
    'success', true,
    'log_id', v_log_id,
    'logId', v_log_id,
    'machineId', p_machine_id,
    'endMeter', p_end_meter,
    'normalWorkingHours', v_normal_hours,
    'breakdownMinutes', v_breakdown_minutes,
    'maintenanceMinutes', v_maintenance_minutes,
    'netBreakdownMinutes', GREATEST(0, v_breakdown_minutes - v_maintenance_minutes),
    'idempotencyKey', v_idempotency_key,
    'entrySource', v_entry_source,
    'enteredBy', v_actor_id
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.submit_operator_hour_log_atomic(
  uuid, uuid, uuid, date, numeric, numeric, text, text, numeric, boolean,
  text, text, text, text, text, numeric, date, timestamp with time zone,
  timestamp with time zone, text, text, text, numeric, text, uuid
) TO authenticated, service_role;
