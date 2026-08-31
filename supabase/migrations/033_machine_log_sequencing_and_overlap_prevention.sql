-- ==============================================================================
-- Migration 033: Machine Log Sequencing & Overlap Prevention
-- Enforces timeline sequencing and overlap prevention across PostgreSQL database
-- Features:
-- 1. btree_gist extension & GiST exclusion constraint for zero-race-condition integrity
-- 2. start_datetime and end_datetime TIMESTAMPTZ columns with Asia/Kolkata timezone support
-- 3. Automatic overnight shift derivation and exact handover support [start, end)
-- 4. Transaction-level advisory locking for concurrent submission protection
-- 5. Updated atomic RPC function submit_operator_hour_log_atomic
-- ==============================================================================

-- 1. Enable btree_gist Extension
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Add Timeline Columns to public.machine_hour_logs
ALTER TABLE public.machine_hour_logs
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS start_datetime TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_datetime TIMESTAMPTZ;

-- 3. Backfill Existing Records with Precise TIMESTAMPTZ Values
UPDATE public.machine_hour_logs
SET
  end_date = CASE
    WHEN start_time IS NOT NULL AND end_time IS NOT NULL AND end_time <= start_time THEN (log_date + INTERVAL '1 day')::date
    ELSE COALESCE(end_date, log_date)
  END,
  start_datetime = CASE
    WHEN start_time IS NOT NULL THEN ((log_date::text || ' ' || start_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata')
    ELSE ((log_date::text || ' 08:00:00')::timestamp AT TIME ZONE 'Asia/Kolkata')
  END,
  end_datetime = CASE
    WHEN start_time IS NOT NULL AND end_time IS NOT NULL THEN
      CASE
        WHEN end_time <= start_time THEN (((log_date + INTERVAL '1 day')::date::text || ' ' || end_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata')
        ELSE ((log_date::text || ' ' || end_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata')
      END
    ELSE ((log_date::text || ' 16:00:00')::timestamp AT TIME ZONE 'Asia/Kolkata')
  END
WHERE start_datetime IS NULL OR end_datetime IS NULL OR end_date IS NULL;

-- 4. Set Defaults for Columns
ALTER TABLE public.machine_hour_logs
  ALTER COLUMN start_datetime SET DEFAULT (now() AT TIME ZONE 'Asia/Kolkata'),
  ALTER COLUMN end_datetime SET DEFAULT ((now() + INTERVAL '8 hours') AT TIME ZONE 'Asia/Kolkata'),
  ALTER COLUMN end_date SET DEFAULT (now() AT TIME ZONE 'Asia/Kolkata')::date;

-- 5. Add Datetime Order Check Constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'machine_hour_logs_datetime_order'
      AND conrelid = 'public.machine_hour_logs'::regclass
  ) THEN
    ALTER TABLE public.machine_hour_logs
      ADD CONSTRAINT machine_hour_logs_datetime_order
      CHECK (end_datetime > start_datetime);
  END IF;
END $$;

-- 6. Add GiST Exclusion Constraint for Zero Overlap per Machine Timeline
-- Note: [start_datetime, end_datetime) half-open interval allows exact handover (e.g. 06:00-18:00 and 18:00-22:00)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'machine_hour_logs_machine_timeline_overlap_excl'
      AND conrelid = 'public.machine_hour_logs'::regclass
  ) THEN
    ALTER TABLE public.machine_hour_logs
      ADD CONSTRAINT machine_hour_logs_machine_timeline_overlap_excl
      EXCLUDE USING gist (
        machine_id WITH =,
        tstzrange(start_datetime, end_datetime, '[)') WITH &&
      );
  END IF;
END $$;

-- 7. Create Performance Indexes for Machine Timeline Queries
CREATE INDEX IF NOT EXISTS idx_machine_hour_logs_machine_timeline
  ON public.machine_hour_logs(machine_id, start_datetime DESC, end_datetime DESC);

CREATE INDEX IF NOT EXISTS idx_machine_hour_logs_tstzrange
  ON public.machine_hour_logs USING gist (machine_id, tstzrange(start_datetime, end_datetime, '[)'));

-- 8. Enhanced Shift Overlap & Timeline Sequencing Trigger Function
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

-- 9. Enhanced Overtime & Normal Working Hours Trigger Function
CREATE OR REPLACE FUNCTION public.auto_calculate_machine_hour_log_overtime()
RETURNS TRIGGER AS $$
DECLARE
  v_duration_hours NUMERIC;
  v_break_hours NUMERIC := 1.0;
BEGIN
  IF NEW.start_datetime IS NOT NULL AND NEW.end_datetime IS NOT NULL THEN
    v_duration_hours := ROUND(EXTRACT(EPOCH FROM (NEW.end_datetime - NEW.start_datetime)) / 3600.0, 2);

    -- Auto-calculate overtime if not explicitly set
    IF NEW.overtime_hours IS NULL OR NEW.overtime_hours = 0 THEN
      IF v_duration_hours > (8.0 + v_break_hours) THEN
        NEW.overtime_hours := ROUND(v_duration_hours - (8.0 + v_break_hours), 2);
      ELSE
        NEW.overtime_hours := 0.0;
      END IF;
    END IF;

    -- Normal working hours: Total Duration - Overtime - Break (1.0h)
    NEW.normal_working_hours := GREATEST(0.0, ROUND((v_duration_hours - COALESCE(NEW.overtime_hours, 0.0) - v_break_hours), 2));
  ELSE
    NEW.normal_working_hours := 0.0;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_calculate_machine_hour_log_overtime ON public.machine_hour_logs;
CREATE TRIGGER trg_auto_calculate_machine_hour_log_overtime
  BEFORE INSERT OR UPDATE ON public.machine_hour_logs
  FOR EACH ROW EXECUTE FUNCTION public.auto_calculate_machine_hour_log_overtime();

-- 10. Atomic RPC Function for Machine Hour Log Submission
CREATE OR REPLACE FUNCTION public.submit_operator_hour_log_atomic(
  p_machine_id UUID,
  p_operator_id UUID,
  p_client_id UUID,
  p_log_date DATE,
  p_start_meter NUMERIC,
  p_end_meter NUMERIC,
  p_start_time TEXT,
  p_end_time TEXT,
  p_overtime_hours NUMERIC,
  p_is_breakdown BOOLEAN,
  p_shift TEXT,
  p_machine_condition TEXT,
  p_location TEXT,
  p_remarks TEXT,
  p_idempotency_key TEXT DEFAULT NULL,
  p_normal_working_hours NUMERIC DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_start_datetime TIMESTAMPTZ DEFAULT NULL,
  p_end_datetime TIMESTAMPTZ DEFAULT NULL
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
BEGIN
  -- 1. Meter Regression Guard
  IF p_end_meter < p_start_meter THEN
    RAISE EXCEPTION 'End meter reading (%) cannot be less than start meter reading (%)', p_end_meter, p_start_meter;
  END IF;

  -- Ensure idempotency key
  v_idempotency_key := COALESCE(
    NULLIF(TRIM(p_idempotency_key), ''),
    'ihl_' || replace(gen_random_uuid()::text, '-', '')
  );

  -- 2. Insert into machine_hour_logs (Overlap trigger, advisory lock & auto-calc execute atomically on BEFORE INSERT)
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
    shift,
    machine_condition,
    location,
    remarks,
    idempotency_key
  )
  VALUES (
    p_machine_id,
    p_operator_id,
    p_client_id,
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
    p_shift,
    COALESCE(p_machine_condition, 'good'),
    p_location,
    p_remarks,
    v_idempotency_key
  )
  RETURNING * INTO v_inserted_log;

  v_log_id := v_inserted_log.id;

  -- 3. Update Machine Current Meter & Operator
  IF p_machine_condition = 'breakdown' OR p_is_breakdown = true THEN
    UPDATE public.machines
    SET
      hour_meter = p_end_meter,
      current_operator_id = p_operator_id,
      status = 'under_maintenance',
      updated_at = NOW()
    WHERE id = p_machine_id;
  ELSE
    UPDATE public.machines
    SET
      hour_meter = p_end_meter,
      current_operator_id = p_operator_id,
      updated_at = NOW()
    WHERE id = p_machine_id;
  END IF;

  -- 4. Record Structured Audit Log Atomically
  v_audit_meta := jsonb_build_object(
    'logId', v_log_id,
    'startMeter', p_start_meter,
    'endMeter', p_end_meter,
    'runningHours', (p_end_meter - p_start_meter),
    'normalWorkingHours', v_inserted_log.normal_working_hours,
    'overtimeHours', v_inserted_log.overtime_hours,
    'startTime', p_start_time,
    'endTime', p_end_time,
    'startDate', p_log_date,
    'endDate', v_inserted_log.end_date,
    'startDatetime', v_inserted_log.start_datetime,
    'endDatetime', v_inserted_log.end_datetime,
    'condition', p_machine_condition,
    'idempotencyKey', v_idempotency_key
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
    'machine.hour_logged',
    'machine',
    p_machine_id,
    v_audit_meta,
    v_audit_meta,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'logId', v_log_id,
    'machineId', p_machine_id,
    'endMeter', p_end_meter,
    'normalWorkingHours', v_inserted_log.normal_working_hours,
    'startDatetime', v_inserted_log.start_datetime,
    'endDatetime', v_inserted_log.end_datetime,
    'idempotencyKey', v_idempotency_key
  );
END;
$$;
