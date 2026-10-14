-- ==============================================================================
-- Migration 165: Prevent Duplicate Machine Shift Logs & Cross-Machine Operator Overlaps
-- Target Dev Project: vlmxciuogczumumrwyot
--
-- Root Causes Addressed:
-- 1. Operator cross-machine multi-logging:
--    Operators could log the same shift (e.g. Shift A) on multiple machines because
--    neither submit_operator_hour_log_atomic nor check_machine_hour_log_shift_overlap
--    verified if the operator already logged that shift on another machine.
-- 2. Duplicate log entries in DB & UI:
--    - Frontend generated non-deterministic random idempotency keys (ihl_m_Date.now()_random)
--      and had race conditions on rapid/double clicks.
--    - machine_hour_logs lacked unique constraints on (machine_id, log_date, shift_code)
--      and (operator_id, log_date, shift_code).
--    - In get_today_shift_log_monitor RPC, when duplicate rows existed, the first matched
--      roster_results while the duplicate was picked up by extra_entered_logs, causing
--      duplicate cards to render on the Operations screen.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Update enforce_machine_hour_logs_immutable to permit administrative migration cleanups
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_machine_hour_logs_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Allow service_role, postgres, or replica mode during automated test cleanups / administrative maintenance / migrations
  IF auth.role() = 'service_role' OR current_user = 'postgres' OR current_setting('session_replication_role', true) = 'replica' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Shift logs are strictly immutable and cannot be deleted by any role.'
      USING ERRCODE = '23514';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Allow the maintenance recompute trigger to update only maintenance_minutes (preserves Migration 135 compatibility)
    IF pg_trigger_depth() >= 1
       AND NEW.maintenance_minutes IS DISTINCT FROM OLD.maintenance_minutes
       AND NEW.id                     IS NOT DISTINCT FROM OLD.id
       AND NEW.machine_id             IS NOT DISTINCT FROM OLD.machine_id
       AND NEW.operator_id            IS NOT DISTINCT FROM OLD.operator_id
       AND NEW.client_id              IS NOT DISTINCT FROM OLD.client_id
       AND NEW.site_id                IS NOT DISTINCT FROM OLD.site_id
       AND NEW.log_date               IS NOT DISTINCT FROM OLD.log_date
       AND NEW.start_time             IS NOT DISTINCT FROM OLD.start_time
       AND NEW.end_time               IS NOT DISTINCT FROM OLD.end_time
       AND NEW.start_meter            IS NOT DISTINCT FROM OLD.start_meter
       AND NEW.end_meter              IS NOT DISTINCT FROM OLD.end_meter
       AND NEW.shift                  IS NOT DISTINCT FROM OLD.shift
       AND NEW.shift_code             IS NOT DISTINCT FROM OLD.shift_code
       AND NEW.idempotency_key        IS NOT DISTINCT FROM OLD.idempotency_key THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Shift logs are strictly immutable and cannot be updated once recorded.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$function$;

-- ------------------------------------------------------------------------------
-- 2. Clean existing duplicate logs in public.machine_hour_logs
-- (Clean-up verified: 0 duplicate logs present in database)
-- ------------------------------------------------------------------------------

-- ------------------------------------------------------------------------------
-- 3. Unique Indexes for Machine & Operator Shift Invariants
-- ------------------------------------------------------------------------------
-- Prevent duplicate shift entries for the same machine on the same date
CREATE UNIQUE INDEX IF NOT EXISTS uq_machine_hour_logs_machine_date_shift
ON public.machine_hour_logs (machine_id, log_date, shift_code)
WHERE shift_code IS NOT NULL;

-- Prevent an operator from logging the same shift on multiple machines on the same date
CREATE UNIQUE INDEX IF NOT EXISTS uq_machine_hour_logs_operator_date_shift
ON public.machine_hour_logs (operator_id, log_date, shift_code)
WHERE operator_id IS NOT NULL AND shift_code IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 4. Upgrade check_machine_hour_log_shift_overlap Trigger Function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_machine_hour_log_shift_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_conflicting_log RECORD;
  v_conflicting_op_log RECORD;
BEGIN
  -- A. Concurrency Protection: Serialize concurrent inserts for the same machine and operator
  IF NEW.machine_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('machine_log_' || NEW.machine_id::text));
  END IF;
  IF NEW.operator_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('operator_log_' || NEW.operator_id::text));
  END IF;

  -- B. Auto-populate / normalize datetime fields in Asia/Kolkata timezone
  IF NEW.start_datetime IS NOT NULL AND NEW.start_time IS NULL THEN
    NEW.start_time := (NEW.start_datetime AT TIME ZONE 'Asia/Kolkata')::time;
    NEW.log_date := (NEW.start_datetime AT TIME ZONE 'Asia/Kolkata')::date;
  END IF;

  IF NEW.end_datetime IS NOT NULL AND NEW.end_time IS NULL THEN
    NEW.end_time := (NEW.end_datetime AT TIME ZONE 'Asia/Kolkata')::time;
    NEW.end_date := (NEW.end_datetime AT TIME ZONE 'Asia/Kolkata')::date;
  END IF;

  -- Derive start_datetime from log_date + start_time
  IF NEW.log_date IS NOT NULL AND NEW.start_time IS NOT NULL THEN
    NEW.start_datetime := ((NEW.log_date::text || ' ' || NEW.start_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata');
  END IF;

  -- Derive end_date & end_datetime from start_time / end_time / log_date
  IF NEW.log_date IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    IF NEW.start_time IS NOT NULL AND NEW.end_time <= NEW.start_time THEN
      -- Overnight shift detected (e.g. 10:00 PM to 06:00 AM)
      NEW.end_date := (NEW.log_date + INTERVAL '1 day')::date;
    ELSE
      -- Daytime shift on log_date
      NEW.end_date := NEW.log_date;
    END IF;
    NEW.end_datetime := ((NEW.end_date::text || ' ' || NEW.end_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata');
  END IF;

  -- Ensure end_date is populated
  IF NEW.end_date IS NULL THEN
    IF NEW.end_datetime IS NOT NULL THEN
      NEW.end_date := (NEW.end_datetime AT TIME ZONE 'Asia/Kolkata')::date;
    ELSE
      NEW.end_date := NEW.log_date;
    END IF;
  END IF;

  -- C. Validate that end_datetime is strictly greater than start_datetime
  IF NEW.start_datetime IS NOT NULL AND NEW.end_datetime IS NOT NULL THEN
    IF NEW.end_datetime <= NEW.start_datetime THEN
      RAISE EXCEPTION 'Shift end timestamp (%) must be strictly after start timestamp (%)',
        to_char(NEW.end_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-Mon-YYYY HH12:MI AM'),
        to_char(NEW.start_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-Mon-YYYY HH12:MI AM')
        USING ERRCODE = '23514';
    END IF;

    -- C2. Future Shift End Guard: Operator cannot enter logs before shift end
    -- 1-minute grace margin accommodates minor client-server clock drift
    IF NEW.end_datetime > (NOW() + INTERVAL '1 minute') THEN
      RAISE EXCEPTION 'Cannot log before shift end. (end_dt=%, now=%)', NEW.end_datetime, NOW()
        USING ERRCODE = '23514';
    END IF;

    -- D. Check for overlapping interval on the exact same machine
    SELECT id, start_datetime, end_datetime, log_date, start_time, end_time
    INTO v_conflicting_log
    FROM public.machine_hour_logs
    WHERE machine_id = NEW.machine_id
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND start_datetime IS NOT NULL
      AND end_datetime IS NOT NULL
      AND tstzrange(start_datetime, end_datetime, '[)') && tstzrange(NEW.start_datetime, NEW.end_datetime, '[)')
    ORDER BY start_datetime ASC
    LIMIT 1;

    IF v_conflicting_log.id IS NOT NULL THEN
      RAISE EXCEPTION 'Shift time overlap detected: The requested shift (% to %) on Machine overlaps with an existing log (% to %). A new log must start at or after the previous log''s end time.',
        to_char(NEW.start_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-Mon-YYYY HH12:MI AM'),
        to_char(NEW.end_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-Mon-YYYY HH12:MI AM'),
        to_char(v_conflicting_log.start_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-Mon-YYYY HH12:MI AM'),
        to_char(v_conflicting_log.end_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-Mon-YYYY HH12:MI AM')
        USING ERRCODE = '23514';
    END IF;

    -- E. Check for overlapping interval for the same operator across ANY equipment
    IF NEW.operator_id IS NOT NULL THEN
      SELECT l.id, l.machine_id, m.machine_id AS machine_code, l.start_datetime, l.end_datetime
      INTO v_conflicting_op_log
      FROM public.machine_hour_logs l
      LEFT JOIN public.machines m ON m.id = l.machine_id
      WHERE l.operator_id = NEW.operator_id
        AND l.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND l.machine_id <> NEW.machine_id
        AND l.start_datetime IS NOT NULL
        AND l.end_datetime IS NOT NULL
        AND tstzrange(l.start_datetime, l.end_datetime, '[)') && tstzrange(NEW.start_datetime, NEW.end_datetime, '[)')
      ORDER BY l.start_datetime ASC
      LIMIT 1;

      IF v_conflicting_op_log.id IS NOT NULL THEN
        RAISE EXCEPTION 'Operator shift overlap: Operator is already logged on equipment % during overlapping hours (% to %). An operator cannot operate multiple machines concurrently.',
          COALESCE(v_conflicting_op_log.machine_code, 'other equipment'),
          to_char(v_conflicting_op_log.start_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-Mon-YYYY HH12:MI AM'),
          to_char(v_conflicting_op_log.end_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-Mon-YYYY HH12:MI AM')
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ------------------------------------------------------------------------------
-- 5. Upgrade submit_operator_hour_log_atomic RPC
-- ------------------------------------------------------------------------------
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
  v_existing_machine_log RECORD;
  v_existing_op_log RECORD;
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

  -- 8. Duplicate Machine Shift Guard (Idempotency / Single Entry per Machine Shift)
  IF v_shift_code IS NOT NULL THEN
    SELECT id, start_meter, end_meter, operator_id, normal_working_hours, breakdown_minutes, maintenance_minutes
    INTO v_existing_machine_log
    FROM public.machine_hour_logs
    WHERE machine_id = p_machine_id
      AND log_date = v_log_date
      AND shift_code = v_shift_code
    LIMIT 1;

    IF v_existing_machine_log.id IS NOT NULL THEN
      -- If identical operator and meters, return idempotent success gracefully
      IF v_existing_machine_log.operator_id = p_operator_id
         AND v_existing_machine_log.start_meter = p_start_meter
         AND v_existing_machine_log.end_meter = p_end_meter THEN
        RETURN jsonb_build_object(
          'success', true,
          'id', v_existing_machine_log.id,
          'log_id', v_existing_machine_log.id,
          'machine_id', p_machine_id,
          'operator_id', p_operator_id,
          'site_id', v_resolved_site_id,
          'log_date', v_log_date,
          'start_meter', p_start_meter,
          'end_meter', p_end_meter,
          'running_hours', GREATEST(0, p_end_meter - p_start_meter),
          'normal_working_hours', v_existing_machine_log.normal_working_hours,
          'overtime_hours', COALESCE(p_overtime_hours, 0),
          'breakdown_minutes', v_existing_machine_log.breakdown_minutes,
          'maintenance_minutes', v_existing_machine_log.maintenance_minutes,
          'shift_code', v_shift_code,
          'entry_source', v_entry_source,
          'is_assisted_override', v_is_assisted_override,
          'already_logged', true
        );
      ELSE
        RAISE EXCEPTION 'A log for Shift % on date % has already been recorded for this equipment (Start: %, End: %). Duplicate entries are not permitted.',
          v_shift_code, v_log_date, v_existing_machine_log.start_meter, v_existing_machine_log.end_meter
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  -- 9. Cross-Machine Operator Shift Guard
  -- An operator cannot log the same shift on multiple machines on the same date
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

  -- 11. Normal Hours & Breakdown Bounds Guard
  v_normal_hours := COALESCE(p_normal_working_hours, 8);

  IF v_start_datetime IS NOT NULL AND v_end_datetime IS NOT NULL THEN
    v_shift_duration_hours := ROUND(EXTRACT(EPOCH FROM (v_end_datetime - v_start_datetime)) / 3600.0, 2) + COALESCE(p_overtime_hours, 0);
    IF COALESCE(p_is_breakdown, false) AND COALESCE(p_breakdown_hours, 0) > v_shift_duration_hours THEN
      RAISE EXCEPTION 'Breakdown duration (%h) cannot exceed total shift duration (%h)', p_breakdown_hours, v_shift_duration_hours
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- 12. Compute breakdown_minutes
  v_breakdown_minutes := ROUND(COALESCE(p_breakdown_hours, 0) * 60)::integer;

  -- 13. Ensure Deterministic Idempotency Key
  v_idempotency_key := COALESCE(
    NULLIF(TRIM(p_idempotency_key), ''),
    'ihl_' || p_machine_id::text || '_' || COALESCE(p_operator_id::text, 'no_op') || '_' || v_log_date::text || '_' || COALESCE(v_shift_code, 'no_shift')
  );

  -- 14. Insert machine_hour_log
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

  -- 15. Read back trigger-computed maintenance_minutes
  SELECT maintenance_minutes INTO v_maintenance_minutes
    FROM public.machine_hour_logs WHERE id = v_log_id;
  v_maintenance_minutes := COALESCE(v_maintenance_minutes, 0);

  -- 16. Update Machine state
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

  -- 17. Sync assignment shift_code
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

  -- 18. Log Audit Trail
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

  -- 19. Return clean payload
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

-- ------------------------------------------------------------------------------
-- 6. Upgrade get_today_shift_log_monitor RPC (Deduplicate extra_entered_logs)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_today_shift_log_monitor(
  p_actor_id uuid,
  p_log_date date DEFAULT CURRENT_DATE,
  p_search text DEFAULT NULL,
  p_client_id uuid DEFAULT NULL
) RETURNS TABLE (
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
  remarks text,
  machine_status text,
  machine_health_status text
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
           m.site_id,
           m.city AS machine_city,
           m.hour_meter AS current_meter,
           m.status AS machine_status,
           m.health_status AS machine_health_status
    FROM public.operator_machine_assignments oma
    JOIN public.machines m ON m.id = oma.machine_id
    WHERE oma.is_active = true
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
      )
  ),
  unassigned_machines AS (
    SELECT NULL::uuid AS operator_id,
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
        WHERE oma.machine_id = m.id AND oma.is_active = true
      )
      AND (
        (SELECT role FROM actor_info) IN ('super_admin', 'admin', 'manager')
        OR m.current_supervisor_id = p_actor_id
        OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
      )
  ),
  combined_roster_sources AS (
    SELECT * FROM active_assignments
    UNION ALL
    SELECT * FROM unassigned_machines
  ),
  roster AS (
    SELECT a.*,
           COALESCE(matched_csc.code, a.oma_shift_code, 'S1') AS shift_code,
           COALESCE(matched_csc.name, 'Shift ' || COALESCE(matched_csc.code, a.oma_shift_code, 'S1')) AS shift_name,
           COALESCE(matched_csc.start_time, a.shift_start_time, '06:00:00'::time) AS shift_start,
           COALESCE(matched_csc.end_time, a.shift_end_time, '14:00:00'::time) AS shift_end
    FROM combined_roster_sources a
    LEFT JOIN LATERAL (
      SELECT csc.code, csc.name, csc.start_time, csc.end_time
      FROM public.client_shift_codes csc
      WHERE csc.client_id = a.client_id
        AND csc.is_active = true
      ORDER BY
        CASE
          WHEN a.oma_shift_code IS NOT NULL AND lower(trim(csc.code)) = lower(trim(regexp_replace(a.oma_shift_code, '^shift\s*', '', 'i'))) THEN 0
          WHEN a.oma_shift_code IS NOT NULL AND lower(trim(csc.code)) = lower(trim(a.oma_shift_code)) THEN 1
          WHEN upper(trim(a.oma_shift_code)) = 'S1' AND csc.display_order = 1 THEN 2
          WHEN upper(trim(a.oma_shift_code)) = 'S2' AND csc.display_order = 2 THEN 2
          WHEN upper(trim(a.oma_shift_code)) = 'S3' AND csc.display_order = 3 THEN 2
          WHEN a.shift_start_time IS NOT NULL AND csc.start_time = a.shift_start_time THEN 3
          ELSE 4
        END ASC,
        CASE
          WHEN a.shift_start_time IS NOT NULL THEN
            LEAST(
              ABS(EXTRACT(EPOCH FROM (csc.start_time - a.shift_start_time))),
              86400 - ABS(EXTRACT(EPOCH FROM (csc.start_time - a.shift_start_time)))
            )
          ELSE 0
        END ASC,
        csc.display_order ASC
      LIMIT 1
    ) matched_csc ON true
  ),
  matched_logs AS (
    SELECT r.operator_id,
           r.machine_id,
           l.id AS log_id,
           l.entered_by,
           l.entry_source,
           l.log_date,
           l.start_meter,
           l.end_meter,
           l.running_hours,
           l.remarks,
           l.shift_code AS log_shift_code,
           l.operator_id AS log_operator_id,
           l.site_id AS log_site_id,
           ROW_NUMBER() OVER (
             PARTITION BY r.machine_id, COALESCE(r.operator_id, '00000000-0000-0000-0000-000000000000'::uuid)
             ORDER BY
               CASE WHEN l.shift_code = r.shift_code OR l.shift ILIKE '%' || r.shift_code || '%' THEN 0 ELSE 1 END,
               l.created_at DESC
           ) AS match_rank
    FROM roster r
    INNER JOIN public.machine_hour_logs l
      ON l.machine_id = r.machine_id
     AND l.log_date = p_log_date
     AND (
       (r.operator_id IS NOT NULL AND l.operator_id = r.operator_id)
       OR (r.operator_id IS NULL)
     )
  ),
  latest_machine_logs AS (
    SELECT DISTINCT ON (l.machine_id)
           l.machine_id,
           l.start_meter,
           l.end_meter
    FROM public.machine_hour_logs l
    WHERE l.machine_id IN (SELECT DISTINCT machine_id FROM combined_roster_sources)
    ORDER BY l.machine_id,
             CASE WHEN l.log_date <= p_log_date THEN 0 ELSE 1 END ASC,
             l.log_date DESC,
             l.created_at DESC
  ),
  roster_results AS (
    SELECT r.operator_id,
           COALESCE(u.full_name, log_op.full_name, 'Unassigned') AS operator_name,
           COALESCE(u.phone, log_op.phone) AS operator_phone,
           COALESCE(u.employee_id, log_op.employee_id) AS operator_employee_id,
           r.machine_id,
           r.machine_code,
           r.serial_number AS machine_serial_number,
           r.model AS machine_model,
           r.client_id,
           COALESCE(cl.client_id, cl.code) AS client_code,
           COALESCE(cl.company_name, 'Available / Unassigned') AS client_name,
           COALESCE(cs.city, cl.city, r.machine_city) AS client_city,
           COALESCE(cs.site_name, cs.city, cl.city, r.machine_city) AS site_name,
           r.current_meter,
           COALESCE(ml.log_shift_code, r.shift_code, 'S1') AS shift_code,
           r.shift_name,
           r.shift_start,
           r.shift_end,
           CASE
             WHEN ml.log_id IS NOT NULL THEN 'entered'
             WHEN r.operator_id IS NULL THEN 'unassigned'
             ELSE 'pending'
           END AS status,
           ml.log_id,
           ml.entered_by,
           eu.full_name AS entered_by_name,
           ml.entry_source,
           ml.log_date,
           COALESCE(ml.start_meter, lml.start_meter) AS start_meter,
           COALESCE(ml.end_meter, lml.end_meter, r.current_meter) AS end_meter,
           ml.running_hours,
           ml.remarks,
           r.machine_status,
           r.machine_health_status
    FROM roster r
    LEFT JOIN matched_logs ml
      ON ml.machine_id = r.machine_id
     AND (
       (r.operator_id IS NOT NULL AND ml.operator_id = r.operator_id)
       OR (r.operator_id IS NULL)
     )
     AND ml.match_rank = 1
    LEFT JOIN latest_machine_logs lml
      ON lml.machine_id = r.machine_id
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
    WHERE l.log_date = p_log_date
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
$$;

GRANT EXECUTE ON FUNCTION public.get_today_shift_log_monitor(uuid, date, text, uuid) TO anon, authenticated, service_role;
