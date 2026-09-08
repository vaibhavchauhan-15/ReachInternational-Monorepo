-- ==============================================================================
-- Migration 050: Fix Shift End Future Validation, Timezone Invariance & Overnight Derivation
-- 1. Updates check_machine_hour_log_shift_overlap trigger on public.machine_hour_logs
--    - Timezone-pinned (Asia/Kolkata) derivation of start_datetime and end_datetime.
--    - Overnight shift detection: end_date auto-derived as log_date + 1 day when end_time <= start_time.
--    - Enforces future shift end guard: NEW.end_datetime > NOW() + INTERVAL '1 minute' raises 'Cannot log before shift end.'
-- 2. Updates submit_operator_hour_log_atomic RPC function
--    - Fixes client/site location resolution: resolves client address from public.clients (eliminating column "customer_address" does not exist).
--    - Derives v_end_date (+1 day for overnight shifts) and v_end_datetime in Asia/Kolkata when null.
--    - Enforces future shift end guard: v_end_datetime > NOW() + INTERVAL '1 minute' raises 'Cannot log before shift end.'
--    - Inserts fully-resolved datetimes into public.machine_hour_logs.
-- ==============================================================================

-- 1. Shift Overlap & Future End Validation Trigger Function
CREATE OR REPLACE FUNCTION public.check_machine_hour_log_shift_overlap()
RETURNS TRIGGER AS $$
DECLARE
  v_conflicting_log RECORD;
BEGIN
  -- A. Concurrency Protection: Serialize concurrent inserts for the same machine
  IF NEW.machine_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('machine_log_' || NEW.machine_id::text));
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

  -- Derive start_datetime from log_date + start_time if missing
  IF NEW.start_datetime IS NULL AND NEW.log_date IS NOT NULL AND NEW.start_time IS NOT NULL THEN
    NEW.start_datetime := ((NEW.log_date::text || ' ' || NEW.start_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata');
  END IF;

  -- Derive end_date & end_datetime from start_time / end_time / log_date if missing
  IF NEW.end_datetime IS NULL AND NEW.log_date IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    IF NEW.end_date IS NULL THEN
      IF NEW.start_time IS NOT NULL AND NEW.end_time <= NEW.start_time THEN
        -- Overnight shift detected (e.g. 10:00 PM to 06:00 AM)
        NEW.end_date := (NEW.log_date + INTERVAL '1 day')::date;
      ELSE
        NEW.end_date := NEW.log_date;
      END IF;
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
        to_char(NEW.start_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-Mon-YYYY HH12:MI AM');
    END IF;

    -- C2. Future Shift End Guard: Operator cannot enter logs before shift end
    -- 1-minute grace margin accommodates minor client-server clock drift
    IF NEW.end_datetime > (NOW() + INTERVAL '1 minute') THEN
      RAISE EXCEPTION 'Cannot log before shift end.'
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
        to_char(v_conflicting_log.end_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-Mon-YYYY HH12:MI AM');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_machine_hour_log_shift_overlap ON public.machine_hour_logs;
CREATE TRIGGER trg_check_machine_hour_log_shift_overlap
  BEFORE INSERT OR UPDATE ON public.machine_hour_logs
  FOR EACH ROW EXECUTE FUNCTION public.check_machine_hour_log_shift_overlap();


-- 2. Update submit_operator_hour_log_atomic RPC Function
CREATE OR REPLACE FUNCTION public.submit_operator_hour_log_atomic(
  p_machine_id UUID,
  p_operator_id UUID,
  p_client_id UUID DEFAULT NULL,
  p_log_date DATE DEFAULT CURRENT_DATE,
  p_start_meter NUMERIC DEFAULT 0,
  p_end_meter NUMERIC DEFAULT 0,
  p_start_time TEXT DEFAULT NULL,
  p_end_time TEXT DEFAULT NULL,
  p_overtime_hours NUMERIC DEFAULT 0,
  p_is_breakdown BOOLEAN DEFAULT FALSE,
  p_shift TEXT DEFAULT NULL,
  p_machine_condition TEXT DEFAULT 'good',
  p_location TEXT DEFAULT NULL,
  p_remarks TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_normal_working_hours NUMERIC DEFAULT 0,
  p_end_date DATE DEFAULT NULL,
  p_start_datetime TIMESTAMPTZ DEFAULT NULL,
  p_end_datetime TIMESTAMPTZ DEFAULT NULL,
  p_breakdown_start_time TEXT DEFAULT NULL,
  p_breakdown_end_time TEXT DEFAULT NULL,
  p_breakdown_duration TEXT DEFAULT NULL,
  p_breakdown_hours NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_log_id UUID;
  v_idempotency_key TEXT;
  v_audit_meta JSONB;
  v_inserted_log RECORD;
  v_resolved_client_id UUID;
  v_resolved_location TEXT;
  v_conflict_flag BOOLEAN := false;
  v_conflict_reason TEXT := NULL;
  v_conflict_status TEXT := NULL;
  v_conflicting_machine RECORD;
  v_log_end_time TIME;
  v_ot_start_time TIME;
  v_ot_ranges int4range[];
  v_log_date DATE;
  v_end_date DATE;
  v_start_datetime TIMESTAMPTZ;
  v_end_datetime TIMESTAMPTZ;
  v_start_time TIME;
  v_end_time TIME;
  v_shift_duration_hours NUMERIC;
BEGIN
  -- 0a. Operator Authorization & Identity Spoofing Guard (BUG-OP-07)
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_operator_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin', 'supervisor', 'service_manager')
    ) THEN
      RAISE EXCEPTION 'Unauthorized operator attribution: you cannot submit logs on behalf of another operator.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 0b. Inactive / Maintenance Machine Guard (BUG-OP-08)
  IF EXISTS (
    SELECT 1 FROM public.machines 
    WHERE id = p_machine_id 
      AND status IN ('maintenance', 'decommissioned', 'inactive')
  ) THEN
    RAISE EXCEPTION 'Cannot record operational hours for equipment currently in maintenance or decommissioned status.'
      USING ERRCODE = '23514';
  END IF;

  -- 1. Meter Regression Guard
  IF p_end_meter < p_start_meter THEN
    RAISE EXCEPTION 'End meter reading (%) cannot be less than start meter reading (%)', p_end_meter, p_start_meter
      USING ERRCODE = '23514';
  END IF;

  -- 1b. Timezone-Pinned Datetime Normalization & Overnight Shift Derivation (Asia/Kolkata)
  v_log_date := COALESCE(p_log_date, (NOW() AT TIME ZONE 'Asia/Kolkata')::date);
  v_end_date := p_end_date;
  v_start_datetime := p_start_datetime;
  v_end_datetime := p_end_datetime;
  v_start_time := NULLIF(TRIM(p_start_time), '')::TIME;
  v_end_time := NULLIF(TRIM(p_end_time), '')::TIME;

  -- Auto-derive end_date if overnight shift and end_date is null
  IF v_end_date IS NULL AND v_start_time IS NOT NULL AND v_end_time IS NOT NULL THEN
    IF v_end_time <= v_start_time THEN
      -- Overnight shift detected (e.g. 10:00 PM to 06:00 AM)
      v_end_date := (v_log_date + INTERVAL '1 day')::date;
    ELSE
      v_end_date := v_log_date;
    END IF;
  ELSIF v_end_date IS NULL THEN
    v_end_date := v_log_date;
  END IF;

  -- Derive start_datetime from log_date + start_time in Asia/Kolkata if missing
  IF v_start_datetime IS NULL AND v_start_time IS NOT NULL THEN
    v_start_datetime := ((v_log_date::text || ' ' || v_start_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata');
  END IF;

  -- Derive end_datetime from end_date + end_time in Asia/Kolkata if missing
  IF v_end_datetime IS NULL AND v_end_time IS NOT NULL THEN
    v_end_datetime := ((v_end_date::text || ' ' || v_end_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata');
  END IF;

  -- 1c. Breakdown Duration Bounds Guard (BUG-OP-03)
  IF COALESCE(p_is_breakdown, false) = true AND COALESCE(p_breakdown_hours, 0) > 0 THEN
    IF v_start_datetime IS NOT NULL AND v_end_datetime IS NOT NULL THEN
      v_shift_duration_hours := EXTRACT(EPOCH FROM (v_end_datetime - v_start_datetime)) / 3600.0;
      IF p_breakdown_hours > v_shift_duration_hours THEN
        RAISE EXCEPTION 'Breakdown duration (%) cannot exceed total shift duration (%)',
          p_breakdown_hours, ROUND(v_shift_duration_hours::numeric, 2)
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  -- 2. Future Shift End Guard: Operator cannot enter logs before shift end
  -- Allows 1-minute grace margin for server/client clock skew
  IF v_end_datetime IS NOT NULL AND v_end_datetime > (NOW() + INTERVAL '1 minute') THEN
    RAISE EXCEPTION 'Cannot log before shift end.'
      USING ERRCODE = '23514';
  END IF;

  -- 3. Idempotency Key
  v_idempotency_key := COALESCE(
    NULLIF(TRIM(p_idempotency_key), ''),
    'ihl_' || replace(gen_random_uuid()::text, '-', '')
  );

  -- 4. Client and Location Resolution & Mismatch Guard (BUG-OP-05)
  SELECT client_id INTO v_machine_client_id FROM public.machines WHERE id = p_machine_id;
  IF v_machine_client_id IS NOT NULL THEN
    IF p_client_id IS NOT NULL AND p_client_id <> v_machine_client_id THEN
      RAISE EXCEPTION 'Client ID does not match assigned machine client deployment'
        USING ERRCODE = '23503';
    END IF;
    v_resolved_client_id := v_machine_client_id;
  ELSE
    v_resolved_client_id := p_client_id;
  END IF;

  IF v_resolved_location IS NULL AND v_resolved_client_id IS NOT NULL THEN
    SELECT COALESCE(address, city, '')
    INTO v_resolved_location
    FROM public.clients
    WHERE id = v_resolved_client_id;
  END IF;

  -- 5. Soft Overtime Conflict Detection:
  -- If overtime > 0, check if this operator's overtime tail crosses another active assignment on a different machine
  IF COALESCE(p_overtime_hours, 0) > 0 AND v_end_time IS NOT NULL THEN
    v_log_end_time := v_end_time;
    v_ot_start_time := (v_log_end_time - (p_overtime_hours || ' hours')::interval)::TIME;

    IF v_ot_start_time <> v_log_end_time THEN
      -- Map overtime window to circular 0-1440 int4range[]
      v_ot_ranges := public.shift_to_ranges(v_ot_start_time, v_log_end_time);

      -- Check if any part of the overtime range overlaps with any active shift range of this operator on ANOTHER machine
      SELECT oma.id, m.machine_id AS conflicting_code
      INTO v_conflicting_machine
      FROM public.operator_machine_assignments oma
      JOIN public.machines m ON m.id = oma.machine_id
      JOIN public.operator_shift_ranges osr ON osr.assignment_id = oma.id
      WHERE oma.operator_id = p_operator_id 
        AND oma.machine_id <> p_machine_id 
        AND oma.is_active = true
        AND osr.is_active = true
        AND EXISTS (
          SELECT 1 
          FROM unnest(v_ot_ranges) AS ot_r 
          WHERE ot_r && osr.minute_range
        )
      LIMIT 1;

      IF v_conflicting_machine.id IS NOT NULL THEN
        v_conflict_flag := true;
        v_conflict_status := 'pending';
        v_conflict_reason := 'overtime_overlaps_assignment:' || COALESCE(v_conflicting_machine.conflicting_code, 'other_machine');
      END IF;
    END IF;
  END IF;

  -- 6. Insert into machine_hour_logs with fully-resolved timestamps
  INSERT INTO public.machine_hour_logs (
    machine_id,
    operator_id,
    client_id,
    log_date,
    end_date,
    start_datetime,
    end_datetime,
    start_meter,
    end_meter,
    start_time,
    end_time,
    overtime_hours,
    normal_working_hours,
    is_breakdown,
    breakdown_start_time,
    breakdown_end_time,
    breakdown_duration,
    breakdown_hours,
    shift,
    machine_condition,
    location,
    remarks,
    idempotency_key,
    conflict_flag,
    conflict_reason,
    conflict_status
  )
  VALUES (
    p_machine_id,
    p_operator_id,
    v_resolved_client_id,
    v_log_date,
    v_end_date,
    v_start_datetime,
    v_end_datetime,
    p_start_meter,
    p_end_meter,
    v_start_time,
    v_end_time,
    COALESCE(p_overtime_hours, 0),
    COALESCE(p_normal_working_hours, 0),
    COALESCE(p_is_breakdown, false),
    NULLIF(TRIM(p_breakdown_start_time), '')::TIME,
    NULLIF(TRIM(p_breakdown_end_time), '')::TIME,
    p_breakdown_duration,
    COALESCE(p_breakdown_hours, 0),
    p_shift,
    COALESCE(p_machine_condition, 'good'),
    v_resolved_location,
    p_remarks,
    v_idempotency_key,
    v_conflict_flag,
    v_conflict_reason,
    v_conflict_status
  )
  RETURNING * INTO v_inserted_log;

  v_log_id := v_inserted_log.id;

  -- 7. Update Machine Current Meter, Operator & Health Status
  IF p_machine_condition = 'breakdown' OR p_is_breakdown = true THEN
    UPDATE public.machines
    SET
      hour_meter = p_end_meter,
      current_operator_id = p_operator_id,
      health_status = 'breakdown',
      updated_at = NOW()
    WHERE id = p_machine_id;
  ELSE
    UPDATE public.machines
    SET
      hour_meter = p_end_meter,
      current_operator_id = p_operator_id,
      health_status = 'active',
      updated_at = NOW()
    WHERE id = p_machine_id;
  END IF;

  -- 8. Audit Logging
  v_audit_meta := jsonb_build_object(
    'action', 'operator_hour_log_submitted',
    'log_id', v_log_id,
    'machine_id', p_machine_id,
    'operator_id', p_operator_id,
    'client_id', v_resolved_client_id,
    'meter_progression', p_start_meter || ' -> ' || p_end_meter,
    'condition', p_machine_condition,
    'is_breakdown', p_is_breakdown,
    'breakdown_duration', p_breakdown_duration,
    'shift_interval', p_start_time || ' -> ' || p_end_time,
    'start_datetime', v_start_datetime,
    'end_datetime', v_end_datetime,
    'idempotency_key', v_idempotency_key,
    'conflict_flag', v_conflict_flag,
    'conflict_reason', v_conflict_reason
  );

  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    details,
    created_at
  )
  VALUES (
    p_operator_id,
    'machine_hour_logs.created',
    'machine_hour_logs',
    v_log_id,
    v_audit_meta,
    v_audit_meta,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'log_id', v_log_id,
    'machine_id', p_machine_id,
    'operator_id', p_operator_id,
    'start_meter', p_start_meter,
    'end_meter', p_end_meter,
    'is_breakdown', p_is_breakdown,
    'breakdown_duration', p_breakdown_duration,
    'conflict_flag', v_conflict_flag,
    'conflict_reason', v_conflict_reason,
    'start_datetime', v_start_datetime,
    'end_datetime', v_end_datetime
  );
END;
$$;
