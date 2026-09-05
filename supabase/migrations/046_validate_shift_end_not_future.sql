-- ==============================================================================
-- Migration 046: Validate Shift End Time Not In The Future
-- Enforces that operators cannot enter logs before their shift has concluded.
-- 1. Updates check_machine_hour_log_shift_overlap trigger function on public.machine_hour_logs.
-- 2. Updates submit_operator_hour_log_atomic RPC function.
-- Allows 1-minute grace margin for client-server clock drift.
-- ==============================================================================

-- 1. Update Shift Overlap & Future End Validation Trigger Function
CREATE OR REPLACE FUNCTION public.check_machine_hour_log_shift_overlap()
RETURNS TRIGGER AS $$
DECLARE
  v_conflicting_log RECORD;
BEGIN
  -- A. Concurrency Protection: Serialize concurrent inserts for the same machine
  IF NEW.machine_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('machine_log_' || NEW.machine_id::text));
  END IF;

  -- B. Auto-populate / normalize datetime fields if not fully supplied
  -- Extract start_time / end_time if start_datetime / end_datetime provided
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
        -- Overnight shift detected
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

-- 2. Update the Canonical Atomic RPC Function with Future Shift End Guard
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
BEGIN
  -- 1. Meter Regression Guard
  IF p_end_meter < p_start_meter THEN
    RAISE EXCEPTION 'End meter reading (%) cannot be less than start meter reading (%)', p_end_meter, p_start_meter
      USING ERRCODE = '23514';
  END IF;

  -- 2. Future Shift End Guard: Operator cannot enter logs before shift end
  IF p_end_datetime IS NOT NULL AND p_end_datetime > (NOW() + INTERVAL '1 minute') THEN
    RAISE EXCEPTION 'Cannot log before shift end.'
      USING ERRCODE = '23514';
  END IF;

  -- 3. Ensure idempotency key
  v_idempotency_key := COALESCE(
    NULLIF(TRIM(p_idempotency_key), ''),
    'ihl_' || replace(gen_random_uuid()::text, '-', '')
  );

  -- 4. Resolve client_id and location if missing from machine details
  v_resolved_client_id := p_client_id;
  v_resolved_location := p_location;

  IF v_resolved_client_id IS NULL OR v_resolved_location IS NULL THEN
    SELECT client_id, COALESCE(v_resolved_location, customer_address, city, '')
    INTO v_resolved_client_id, v_resolved_location
    FROM public.machines
    WHERE id = p_machine_id;
  END IF;

  -- 5. Insert into machine_hour_logs
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
    idempotency_key
  )
  VALUES (
    p_machine_id,
    p_operator_id,
    v_resolved_client_id,
    p_log_date,
    p_end_date,
    p_start_datetime,
    p_end_datetime,
    p_start_meter,
    p_end_meter,
    NULLIF(TRIM(p_start_time), '')::TIME,
    NULLIF(TRIM(p_end_time), '')::TIME,
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
    v_idempotency_key
  )
  RETURNING * INTO v_inserted_log;

  v_log_id := v_inserted_log.id;

  -- 6. Update Machine Current Meter, Operator & Health Status
  -- NOTE: Updates health_status ('breakdown' / 'active'), NEVER rental status ('available' / 'rented')!
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

  -- 7. Audit Logging
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
    'idempotency_key', v_idempotency_key
  );

  INSERT INTO public.audit_logs (
    entity_name,
    entity_id,
    action,
    performed_by,
    metadata
  )
  VALUES (
    'machine_hour_logs',
    v_log_id,
    'create',
    p_operator_id,
    v_audit_meta
  );

  RETURN jsonb_build_object(
    'success', true,
    'log_id', v_log_id,
    'machine_id', p_machine_id,
    'operator_id', p_operator_id,
    'start_meter', p_start_meter,
    'end_meter', p_end_meter,
    'is_breakdown', p_is_breakdown,
    'breakdown_duration', p_breakdown_duration
  );
END;
$$;
