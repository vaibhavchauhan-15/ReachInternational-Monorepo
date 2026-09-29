-- ==============================================================================
-- Migration 118: Assisted Shift Entry & Today's Shift Log Monitor
-- 1. Adds entered_by + entry_source columns to machine_hour_logs
-- 2. Creates can_manage_operator_shift_log() authorization function
-- 3. Extends submit_operator_hour_log_atomic() with entry attribution
-- 4. Creates get_today_shift_log_monitor() read-model RPC
-- 5. Backfills existing rows
-- ==============================================================================

-- 1. Add entry attribution columns
ALTER TABLE public.machine_hour_logs
  ADD COLUMN IF NOT EXISTS entered_by uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS entry_source text CHECK (entry_source IN
    ('operator', 'supervisor', 'manager', 'admin', 'super_admin'));

-- 2. Backfill: every existing row was operator self-entry
UPDATE public.machine_hour_logs
SET entered_by = operator_id,
    entry_source = 'operator'
WHERE entered_by IS NULL;

-- 3. Authorization function: can this actor submit/edit on behalf of this operator?
CREATE OR REPLACE FUNCTION public.can_manage_operator_shift_log(
  p_actor_id uuid, p_operator_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE (SELECT role FROM public.users WHERE id = p_actor_id)
    WHEN 'super_admin' THEN true
    WHEN 'admin' THEN true
    WHEN 'manager' THEN true
    WHEN 'supervisor' THEN (
      EXISTS (
        SELECT 1 FROM public.user_supervisors
        WHERE supervisor_id = p_actor_id AND user_id = p_operator_id
      )
      OR EXISTS (
        SELECT 1 FROM public.users
        WHERE id = p_operator_id AND supervisor_id = p_actor_id
      )
    )
    ELSE false
  END;
$$;

-- 4. Extend submit_operator_hour_log_atomic with entry attribution
-- ponytail: extending existing function in-place, not forking
CREATE OR REPLACE FUNCTION public.submit_operator_hour_log_atomic(
  p_machine_id uuid,
  p_operator_id uuid,
  p_client_id uuid,
  p_log_date date,
  p_start_meter numeric,
  p_end_meter numeric,
  p_start_time text,
  p_end_time text,
  p_overtime_hours numeric,
  p_is_breakdown boolean,
  p_shift text,
  p_machine_condition text,
  p_location text,
  p_remarks text,
  p_idempotency_key text DEFAULT NULL,
  p_normal_working_hours numeric DEFAULT NULL,
  p_entered_by uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public', 'pg_temp'
AS $function$
DECLARE
  v_log_id UUID;
  v_machine_status TEXT;
  v_start_t TIME;
  v_end_t TIME;
  v_duration_hours NUMERIC;
  v_normal_working_hours NUMERIC;
  v_idempotency_key TEXT;
  v_audit_meta JSONB;
  v_entry_source TEXT;
  v_actor_id UUID;
BEGIN
  -- Determine who is actually submitting
  v_actor_id := COALESCE(p_entered_by, p_operator_id);

  -- Entry attribution: self-entry vs assisted
  IF v_actor_id = p_operator_id THEN
    v_entry_source := 'operator';
  ELSE
    IF NOT can_manage_operator_shift_log(v_actor_id, p_operator_id) THEN
      RAISE EXCEPTION 'Not authorized to submit shift log for this operator';
    END IF;
    v_entry_source := (SELECT role FROM public.users WHERE id = v_actor_id);
  END IF;

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

  -- 2. Insert into machine_hour_logs with entry attribution
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
    idempotency_key,
    entered_by,
    entry_source
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
    v_idempotency_key,
    v_actor_id,
    v_entry_source
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
    'idempotencyKey', v_idempotency_key,
    'enteredBy', v_actor_id,
    'entrySource', v_entry_source
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
    v_actor_id,
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
    'idempotencyKey', v_idempotency_key,
    'enteredBy', v_actor_id,
    'entrySource', v_entry_source
  );
END;
$function$;

-- 5. Today's Shift Log Monitor — read-model RPC
DROP FUNCTION IF EXISTS public.get_today_shift_log_monitor(uuid, date);

CREATE OR REPLACE FUNCTION public.get_today_shift_log_monitor(
  p_actor_id uuid,
  p_log_date date DEFAULT CURRENT_DATE
) RETURNS TABLE (
  operator_id uuid,
  operator_name text,
  machine_id uuid,
  machine_code text,
  client_id uuid,
  client_name text,
  current_meter numeric,
  shift_code text,
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
  remarks text
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH actor_info AS (
    SELECT role FROM public.users WHERE id = p_actor_id
  ),
  scope AS (
    SELECT m.id AS machine_id, m.machine_id AS machine_code, m.client_id, m.hour_meter AS current_meter,
           unnest(m.operator_ids) AS operator_id
    FROM public.machines m
    WHERE m.status IN ('active', 'rented')
      AND m.operator_ids IS NOT NULL AND array_length(m.operator_ids, 1) > 0
      AND (
        (SELECT role FROM actor_info) IN ('super_admin', 'admin', 'manager')
        OR EXISTS (
          SELECT 1 FROM public.user_supervisors us
          WHERE us.supervisor_id = p_actor_id AND us.user_id = ANY(m.operator_ids)
        )
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = ANY(m.operator_ids) AND u.supervisor_id = p_actor_id
        )
      )
  ),
  roster AS (
    SELECT s.*, c.code AS shift_code, c.start_time AS shift_start, c.end_time AS shift_end
    FROM scope s
    JOIN public.client_shift_codes c ON c.client_id = s.client_id AND c.is_active
  )
  SELECT r.operator_id, u.full_name AS operator_name,
         r.machine_id, r.machine_code, r.client_id, cl.company_name AS client_name,
         r.current_meter,
         r.shift_code, r.shift_start, r.shift_end,
         CASE WHEN l.id IS NULL THEN 'pending' ELSE 'entered' END AS status,
         l.id AS log_id, l.entered_by, eu.full_name AS entered_by_name, l.entry_source,
         l.log_date, l.start_meter, l.end_meter, l.running_hours, l.remarks
  FROM roster r
  JOIN public.users u ON u.id = r.operator_id
  JOIN public.clients cl ON cl.id = r.client_id
  LEFT JOIN public.machine_hour_logs l
    ON l.machine_id = r.machine_id AND l.operator_id = r.operator_id
   AND l.shift_code = r.shift_code AND l.log_date = p_log_date
  LEFT JOIN public.users eu ON eu.id = l.entered_by
  ORDER BY CASE WHEN l.id IS NULL THEN 0 ELSE 1 END, u.full_name, r.shift_code;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.can_manage_operator_shift_log(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_today_shift_log_monitor(uuid, date) TO authenticated;
