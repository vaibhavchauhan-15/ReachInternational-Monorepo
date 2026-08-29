-- ==============================================================================
-- Migration 023: Add normal_working_hours to public.machine_hour_logs
-- Calculation: Normal Working Time = Total Shift Duration - Overtime Hours - 1.0 hr (Break Time)
-- Examples:
--   6:00 AM to 6:00 PM (12h duration), OT = 3h -> Normal Working Time = 12 - 3 - 1 = 8h
--   6:00 AM to 3:00 PM (9h duration), OT = 0h -> Normal Working Time = 9 - 0 - 1 = 8h
-- ==============================================================================

-- 1. Add column normal_working_hours to public.machine_hour_logs
ALTER TABLE public.machine_hour_logs
  ADD COLUMN IF NOT EXISTS normal_working_hours NUMERIC NOT NULL DEFAULT 0;

-- 2. Update Overtime & Normal Working Hours Auto-Calculation Trigger Function
CREATE OR REPLACE FUNCTION public.auto_calculate_machine_hour_log_overtime()
RETURNS TRIGGER AS $$
DECLARE
  v_start_t TIME;
  v_end_t TIME;
  v_duration_hours NUMERIC;
  v_break_hours NUMERIC := 1.0;
BEGIN
  IF NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL AND TRIM(NEW.start_time::text) <> '' AND TRIM(NEW.end_time::text) <> '' THEN
    BEGIN
      v_start_t := NEW.start_time::TIME;
      v_end_t := NEW.end_time::TIME;
    EXCEPTION WHEN OTHERS THEN
      RETURN NEW;
    END;

    IF v_end_t < v_start_t THEN
      v_duration_hours := ROUND(EXTRACT(EPOCH FROM ((v_end_t - v_start_t) + INTERVAL '24 hours')) / 3600.0, 2);
    ELSE
      v_duration_hours := ROUND(EXTRACT(EPOCH FROM (v_end_t - v_start_t)) / 3600.0, 2);
    END IF;

    -- Overtime auto-calculation (considering 1h break + 8h standard = 9h shift span before OT)
    IF NEW.overtime_hours IS NULL OR NEW.overtime_hours = 0 THEN
      IF v_duration_hours > (8.0 + v_break_hours) THEN
        NEW.overtime_hours := ROUND(v_duration_hours - (8.0 + v_break_hours), 2);
      ELSE
        NEW.overtime_hours := 0.0;
      END IF;
    END IF;

    -- Always: total shift duration - OT - 1h break = normal working time
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

-- 3. Update Atomic RPC Function for Machine Hour Log Submission
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
  p_start_fuel_level NUMERIC,
  p_fuel_consumed NUMERIC,
  p_shift TEXT,
  p_machine_condition TEXT,
  p_location TEXT,
  p_remarks TEXT,
  p_status TEXT,
  p_idempotency_key TEXT,
  p_normal_working_hours NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_log_id UUID;
  v_machine_status TEXT;
  v_start_t TIME;
  v_end_t TIME;
  v_duration_hours NUMERIC;
  v_normal_working_hours NUMERIC;
BEGIN
  -- 1. Meter Regression Guard
  IF p_end_meter < p_start_meter THEN
    RAISE EXCEPTION 'End meter reading (%) cannot be less than start meter reading (%)', p_end_meter, p_start_meter;
  END IF;

  -- Compute normal working hours if not provided
  IF p_normal_working_hours IS NOT NULL THEN
    v_normal_working_hours := p_normal_working_hours;
  ELSIF p_start_time IS NOT NULL AND p_end_time IS NOT NULL AND TRIM(p_start_time) <> '' AND TRIM(p_end_time) <> '' THEN
    BEGIN
      v_start_t := p_start_time::TIME;
      v_end_t := p_end_time::TIME;
      IF v_end_t < v_start_t THEN
        v_duration_hours := ROUND(EXTRACT(EPOCH FROM ((v_end_t - v_start_t) + INTERVAL '24 hours')) / 3600.0, 2);
      ELSE
        v_duration_hours := ROUND(EXTRACT(EPOCH FROM (v_end_t - v_start_t)) / 3600.0, 2);
      END IF;
      v_normal_working_hours := GREATEST(0.0, ROUND((v_duration_hours - COALESCE(p_overtime_hours, 0.0) - 1.0), 2));
    EXCEPTION WHEN OTHERS THEN
      v_normal_working_hours := 0.0;
    END;
  ELSE
    v_normal_working_hours := 0.0;
  END IF;

  -- 2. Insert into machine_hour_logs (Overlap trigger & auto-calc trigger execute atomically on BEFORE INSERT)
  INSERT INTO public.machine_hour_logs (
    machine_id,
    operator_id,
    client_id,
    log_date,
    start_meter,
    end_meter,
    start_time,
    end_time,
    overtime_hours,
    normal_working_hours,
    is_breakdown,
    start_fuel_level,
    fuel_consumed,
    shift,
    machine_condition,
    location,
    remarks,
    status,
    idempotency_key
  )
  VALUES (
    p_machine_id,
    p_operator_id,
    p_client_id,
    p_log_date,
    p_start_meter,
    p_end_meter,
    p_start_time::TIME,
    p_end_time::TIME,
    COALESCE(p_overtime_hours, 0),
    COALESCE(v_normal_working_hours, 0),
    COALESCE(p_is_breakdown, false),
    COALESCE(p_start_fuel_level, 0),
    COALESCE(p_fuel_consumed, 0),
    p_shift,
    COALESCE(p_machine_condition, 'good'),
    p_location,
    p_remarks,
    COALESCE(p_status, 'submitted'),
    p_idempotency_key
  )
  RETURNING id INTO v_log_id;

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

  -- 4. Record Audit Log Entry Atomically
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    details,
    created_at
  )
  VALUES (
    p_operator_id,
    'machine.hour_logged',
    'machine',
    p_machine_id,
    jsonb_build_object(
      'logId', v_log_id,
      'startMeter', p_start_meter,
      'endMeter', p_end_meter,
      'runningHours', (p_end_meter - p_start_meter),
      'normalWorkingHours', v_normal_working_hours,
      'overtimeHours', p_overtime_hours,
      'startTime', p_start_time,
      'endTime', p_end_time,
      'condition', p_machine_condition
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'logId', v_log_id,
    'machineId', p_machine_id,
    'endMeter', p_end_meter,
    'normalWorkingHours', v_normal_working_hours
  );
END;
$$;

-- 4. Backfill existing records in public.machine_hour_logs
UPDATE public.machine_hour_logs
SET
  overtime_hours = CASE
    WHEN start_time IS NOT NULL AND end_time IS NOT NULL THEN
      CASE
        WHEN end_time < start_time THEN
          GREATEST(0.0, ROUND((EXTRACT(EPOCH FROM ((end_time - start_time) + INTERVAL '24 hours')) / 3600.0) - 9.0, 2))
        ELSE
          GREATEST(0.0, ROUND((EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0) - 9.0, 2))
      END
    ELSE COALESCE(overtime_hours, 0.0)
  END,
  normal_working_hours = CASE
    WHEN start_time IS NOT NULL AND end_time IS NOT NULL THEN
      CASE
        WHEN end_time < start_time THEN
          GREATEST(0.0, ROUND((EXTRACT(EPOCH FROM ((end_time - start_time) + INTERVAL '24 hours')) / 3600.0) - 
            CASE
              WHEN end_time < start_time THEN GREATEST(0.0, ROUND((EXTRACT(EPOCH FROM ((end_time - start_time) + INTERVAL '24 hours')) / 3600.0) - 9.0, 2))
              ELSE GREATEST(0.0, ROUND((EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0) - 9.0, 2))
            END - 1.0, 2))
        ELSE
          GREATEST(0.0, ROUND((EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0) - 
            GREATEST(0.0, ROUND((EXTRACT(EPOCH FROM (end_time - start_time)) / 3600.0) - 9.0, 2)) - 1.0, 2))
      END
    ELSE 0.0
  END;
