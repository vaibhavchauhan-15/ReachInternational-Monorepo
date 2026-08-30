-- ==============================================================================
-- Migration 024: Remove fuel tracking, remove status & approval system, and fix idempotency_key
-- 1. Remove fuel_consumed and start_fuel_level from public.machine_hour_logs
-- 2. Remove status column and status check constraint from public.machine_hour_logs
-- 3. Backfill NULL idempotency_key values and add default generator
-- 4. Update submit_operator_hour_log_atomic RPC function
-- ==============================================================================

-- 1. Drop fuel columns from machine_hour_logs
ALTER TABLE public.machine_hour_logs
  DROP COLUMN IF EXISTS fuel_consumed,
  DROP COLUMN IF EXISTS start_fuel_level;

-- 2. Drop status check constraint and status column
ALTER TABLE public.machine_hour_logs
  DROP CONSTRAINT IF EXISTS machine_hour_logs_status_check;

ALTER TABLE public.machine_hour_logs
  DROP COLUMN IF EXISTS status;

-- 3. Backfill all existing NULL idempotency_key values with unique generated keys
UPDATE public.machine_hour_logs
SET idempotency_key = ('ihl_' || replace(gen_random_uuid()::text, '-', ''))
WHERE idempotency_key IS NULL;

-- Set default generator for idempotency_key on machine_hour_logs
ALTER TABLE public.machine_hour_logs
  ALTER COLUMN idempotency_key SET DEFAULT ('ihl_' || replace(gen_random_uuid()::text, '-', ''));

-- 4. Re-create Atomic RPC Function for Machine Hour Log Submission
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
  v_idempotency_key TEXT;
BEGIN
  -- 1. Meter Regression Guard
  IF p_end_meter < p_start_meter THEN
    RAISE EXCEPTION 'End meter reading (%) cannot be less than start meter reading (%)', p_end_meter, p_start_meter;
  END IF;

  -- Ensure idempotency key is never null
  v_idempotency_key := COALESCE(
    NULLIF(TRIM(p_idempotency_key), ''),
    'ihl_' || replace(gen_random_uuid()::text, '-', '')
  );

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
    p_start_meter,
    p_end_meter,
    p_start_time::TIME,
    p_end_time::TIME,
    COALESCE(p_overtime_hours, 0),
    COALESCE(v_normal_working_hours, 0),
    COALESCE(p_is_breakdown, false),
    p_shift,
    COALESCE(p_machine_condition, 'good'),
    p_location,
    p_remarks,
    v_idempotency_key
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
      'condition', p_machine_condition,
      'idempotencyKey', v_idempotency_key
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'logId', v_log_id,
    'machineId', p_machine_id,
    'endMeter', p_end_meter,
    'normalWorkingHours', v_normal_working_hours,
    'idempotencyKey', v_idempotency_key
  );
END;
$$;
