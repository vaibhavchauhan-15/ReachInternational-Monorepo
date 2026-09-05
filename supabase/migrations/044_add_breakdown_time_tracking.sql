-- ==============================================================================
-- Migration 044: Add Breakdown Time Tracking to public.machine_hour_logs
-- Adds breakdown_start_time, breakdown_end_time, breakdown_duration, and breakdown_hours
-- Enables tracking exact breakdown timestamps (e.g. 02:30 PM - 03:25 PM) and formatted durations (55min, 3h:55min)
-- Updates submit_operator_hour_log_atomic to store breakdown columns atomically.
-- ==============================================================================

-- 1. Add Breakdown Columns to public.machine_hour_logs
ALTER TABLE public.machine_hour_logs
  ADD COLUMN IF NOT EXISTS breakdown_start_time TIME WITHOUT TIME ZONE,
  ADD COLUMN IF NOT EXISTS breakdown_end_time TIME WITHOUT TIME ZONE,
  ADD COLUMN IF NOT EXISTS breakdown_duration TEXT,
  ADD COLUMN IF NOT EXISTS breakdown_hours NUMERIC DEFAULT 0;

-- 2. Backfill Existing Breakdown Records with parsed duration from remarks where available
UPDATE public.machine_hour_logs
SET
  breakdown_duration = SUBSTRING(remarks FROM '\[Breakdown Duration:\s*([^\]]+)\]'),
  breakdown_hours = CASE
    WHEN remarks ~ '\[Breakdown Duration:\s*(\d+)h\s*(\d+)m\]' THEN
      (SUBSTRING(remarks FROM '\[Breakdown Duration:\s*(\d+)h')::NUMERIC +
       SUBSTRING(remarks FROM '\[Breakdown Duration:\s*\d+h\s*(\d+)m\]')::NUMERIC / 60.0)
    WHEN remarks ~ '\[Breakdown Duration:\s*(\d+)h\]' THEN
      (SUBSTRING(remarks FROM '\[Breakdown Duration:\s*(\d+)h\]'))::NUMERIC
    WHEN remarks ~ '\[Breakdown Duration:\s*(\d+)m\]' THEN
      ((SUBSTRING(remarks FROM '\[Breakdown Duration:\s*(\d+)m\]'))::NUMERIC / 60.0)
    ELSE 0
  END
WHERE (is_breakdown = TRUE OR machine_condition = 'breakdown')
  AND breakdown_duration IS NULL
  AND remarks LIKE '%[Breakdown Duration:%';

-- 3. Create Index for Breakdown Status & Duration lookups
CREATE INDEX IF NOT EXISTS idx_machine_hour_logs_breakdown
  ON public.machine_hour_logs(machine_id, is_breakdown, log_date DESC)
  WHERE is_breakdown = TRUE;

-- 4. Update Atomic RPC Function: submit_operator_hour_log_atomic
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

  -- 2. Insert into machine_hour_logs
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
    NULLIF(TRIM(p_breakdown_start_time), '')::TIME,
    NULLIF(TRIM(p_breakdown_end_time), '')::TIME,
    p_breakdown_duration,
    COALESCE(p_breakdown_hours, 0),
    p_shift,
    COALESCE(p_machine_condition, 'good'),
    p_location,
    p_remarks,
    v_idempotency_key
  )
  RETURNING * INTO v_inserted_log;

  v_log_id := v_inserted_log.id;

  -- 3. Update Machine Current Meter, Operator & Health Status
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

  -- 4. Record Structured Audit Log Atomically
  v_audit_meta := jsonb_build_object(
    'logId', v_log_id,
    'machineId', p_machine_id,
    'operatorId', p_operator_id,
    'startMeter', p_start_meter,
    'endMeter', p_end_meter,
    'runningHours', (p_end_meter - p_start_meter),
    'normalWorkingHours', COALESCE(p_normal_working_hours, 0),
    'overtimeHours', COALESCE(p_overtime_hours, 0),
    'isBreakdown', COALESCE(p_is_breakdown, false),
    'breakdownDuration', p_breakdown_duration,
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
    'idempotencyKey', v_idempotency_key
  );
END;
$$;
