-- ==============================================================================
-- MIGRATION: 022_atomic_mutations_and_rpc.sql
-- PURPOSE: Atomic RPC Function for Machine Hour Log Submission
-- Combines Log Insert, Machine Meter/Status Update, and Audit Log in ONE Atomic Transaction
-- ==============================================================================

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
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_log_id UUID;
  v_machine_status TEXT;
BEGIN
  -- 1. Meter Regression Guard
  IF p_end_meter < p_start_meter THEN
    RAISE EXCEPTION 'End meter reading (%) cannot be less than start meter reading (%)', p_end_meter, p_start_meter;
  END IF;

  -- 2. Insert into machine_hour_logs (Overlap trigger executes atomically on BEFORE INSERT)
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
    p_start_time,
    p_end_time,
    COALESCE(p_overtime_hours, 0),
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
    'endMeter', p_end_meter
  );
END;
$$;
