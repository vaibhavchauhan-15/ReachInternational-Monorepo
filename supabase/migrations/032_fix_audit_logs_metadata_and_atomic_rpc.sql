-- ==============================================================================
-- Migration 032: Fix audit_logs column reference in submit_operator_hour_log_atomic and drop obsolete overloaded RPC functions
-- ==============================================================================

-- 1. Drop obsolete overloaded functions with fuel/status parameters
DROP FUNCTION IF EXISTS public.submit_operator_hour_log_atomic(
  p_machine_id uuid, p_operator_id uuid, p_client_id uuid, p_log_date date, p_start_meter numeric, p_end_meter numeric, p_start_time text, p_end_time text, p_overtime_hours numeric, p_is_breakdown boolean, p_start_fuel_level numeric, p_fuel_consumed numeric, p_shift text, p_machine_condition text, p_location text, p_remarks text, p_status text, p_idempotency_key text
);
DROP FUNCTION IF EXISTS public.submit_operator_hour_log_atomic(
  p_machine_id uuid, p_operator_id uuid, p_client_id uuid, p_log_date date, p_start_meter numeric, p_end_meter numeric, p_start_time text, p_end_time text, p_overtime_hours numeric, p_is_breakdown boolean, p_start_fuel_level numeric, p_fuel_consumed numeric, p_shift text, p_machine_condition text, p_location text, p_remarks text, p_status text, p_idempotency_key text, p_normal_working_hours numeric
);

-- 2. Ensure public.audit_logs has both metadata and details column for backwards compatibility
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS details JSONB;

-- 3. Re-create the single, clean, canonical submit_operator_hour_log_atomic RPC function
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
  v_audit_meta JSONB;
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

  -- 4. Record Audit Log Entry Atomically (Writing to metadata and details for complete compatibility)
  v_audit_meta := jsonb_build_object(
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
    'normalWorkingHours', v_normal_working_hours,
    'idempotencyKey', v_idempotency_key
  );
END;
$$;
