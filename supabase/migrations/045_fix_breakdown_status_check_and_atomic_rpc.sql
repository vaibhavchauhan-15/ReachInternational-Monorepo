-- ==============================================================================
-- Migration 045: Fix submit_operator_hour_log_atomic breakdown status check constraint
-- Fixes check constraint violation 'machines_status_check' by updating health_status = 'breakdown'
-- instead of status = 'under_maintenance' on public.machines.
-- Drops legacy overloaded function signatures to prevent PGRST203 Multiple Choices error.
-- ==============================================================================

-- 1. Drop previous function overloads to prevent PostgREST ambiguous signature resolution (PGRST203)
DROP FUNCTION IF EXISTS public.submit_operator_hour_log_atomic(
  UUID, UUID, UUID, DATE, NUMERIC, NUMERIC, TEXT, TEXT, NUMERIC, BOOLEAN,
  TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, DATE, TIMESTAMPTZ, TIMESTAMPTZ
);

DROP FUNCTION IF EXISTS public.submit_operator_hour_log_atomic(
  UUID, UUID, UUID, DATE, NUMERIC, NUMERIC, TEXT, TEXT, NUMERIC, BOOLEAN,
  NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
);

-- 2. Define the Canonical Atomic RPC Function with Correct Health Status Mapping
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

  -- 2. Ensure idempotency key
  v_idempotency_key := COALESCE(
    NULLIF(TRIM(p_idempotency_key), ''),
    'ihl_' || replace(gen_random_uuid()::text, '-', '')
  );

  -- 3. Resolve client_id and location if missing from machine details
  v_resolved_client_id := p_client_id;
  v_resolved_location := p_location;

  IF v_resolved_client_id IS NULL OR v_resolved_location IS NULL THEN
    SELECT client_id, COALESCE(v_resolved_location, customer_address, city, '')
    INTO v_resolved_client_id, v_resolved_location
    FROM public.machines
    WHERE id = p_machine_id;
  END IF;

  -- 4. Insert into machine_hour_logs
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

  -- 5. Update Machine Current Meter, Operator & Health Status
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

  -- 6. Record Structured Audit Log Atomically
  v_audit_meta := jsonb_build_object(
    'logId', v_log_id,
    'machineId', p_machine_id,
    'operatorId', p_operator_id,
    'clientId', v_resolved_client_id,
    'location', v_resolved_location,
    'startMeter', p_start_meter,
    'endMeter', p_end_meter,
    'runningHours', (p_end_meter - p_start_meter),
    'normalWorkingHours', COALESCE(p_normal_working_hours, 0),
    'overtimeHours', COALESCE(p_overtime_hours, 0),
    'isBreakdown', COALESCE(p_is_breakdown, false),
    'breakdownDuration', p_breakdown_duration,
    'breakdownHours', COALESCE(p_breakdown_hours, 0),
    'logDate', p_log_date,
    'idempotencyKey', v_idempotency_key
  );

  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  VALUES (
    p_operator_id,
    'machine.hour_logged',
    'machine',
    p_machine_id,
    v_audit_meta
  );

  RETURN jsonb_build_object(
    'success', true,
    'logId', v_log_id,
    'machineId', p_machine_id,
    'operatorId', p_operator_id,
    'clientId', v_resolved_client_id,
    'location', v_resolved_location,
    'idempotencyKey', v_idempotency_key
  );
END;
$$;
