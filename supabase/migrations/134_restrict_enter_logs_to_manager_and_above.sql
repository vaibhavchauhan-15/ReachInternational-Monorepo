-- ==============================================================================
-- Migration 134: Restrict Enter Logs to Roles Above Supervisor (Manager, Admin, Super Admin)
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
-- Description:
-- 1. Updates can_manage_operator_shift_log() to strictly permit only manager,
--    admin, and super_admin (excluding supervisor and hr).
-- 2. Hardens submit_operator_hour_log_atomic() RPC to enforce that assisted shift
--    entry on behalf of operators is strictly restricted to manager, admin,
--    and super_admin.
-- 3. Updates RLS policy insert_machine_hour_logs on public.machine_hour_logs to remove
--    supervisor role from direct insert permissions.
-- ==============================================================================

-- 1. Update authorization function: can_manage_operator_shift_log
CREATE OR REPLACE FUNCTION public.can_manage_operator_shift_log(
  p_actor_id uuid,
  p_operator_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT CASE (SELECT role FROM public.users WHERE id = p_actor_id)
    WHEN 'super_admin' THEN true
    WHEN 'admin' THEN true
    WHEN 'manager' THEN true
    -- Supervisor and other roles are strictly disallowed from managing/entering operator logs
    ELSE false
  END;
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_operator_shift_log(uuid, uuid) TO authenticated;

-- 2. Update canonical submit_operator_hour_log_atomic RPC
CREATE OR REPLACE FUNCTION public.submit_operator_hour_log_atomic(
  p_machine_id uuid,
  p_operator_id uuid,
  p_client_id uuid DEFAULT NULL::uuid,
  p_log_date date DEFAULT CURRENT_DATE,
  p_start_meter numeric DEFAULT 0,
  p_end_meter numeric DEFAULT 0,
  p_start_time text DEFAULT NULL::text,
  p_end_time text DEFAULT NULL::text,
  p_overtime_hours numeric DEFAULT 0,
  p_is_breakdown boolean DEFAULT false,
  p_shift text DEFAULT NULL::text,
  p_machine_condition text DEFAULT 'good'::text,
  p_location text DEFAULT NULL::text,
  p_remarks text DEFAULT NULL::text,
  p_idempotency_key text DEFAULT NULL::text,
  p_normal_working_hours numeric DEFAULT NULL::numeric,
  p_end_date date DEFAULT NULL::date,
  p_start_datetime timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_end_datetime timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_breakdown_start_time text DEFAULT NULL::text,
  p_breakdown_end_time text DEFAULT NULL::text,
  p_breakdown_duration text DEFAULT NULL::text,
  p_breakdown_hours numeric DEFAULT 0,
  p_shift_code text DEFAULT NULL::text,
  p_entered_by uuid DEFAULT NULL::uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_log_id UUID;
  v_actor_id UUID;
  v_entry_source TEXT;
  v_idempotency_key TEXT;
  v_audit_meta JSONB;
  v_resolved_client_id UUID;
  v_resolved_location TEXT := p_location;
  v_start_time TIME;
  v_end_time TIME;
  v_breakdown_start_time TIME;
  v_breakdown_end_time TIME;
  v_log_date DATE;
  v_end_date DATE;
  v_start_datetime TIMESTAMPTZ;
  v_end_datetime TIMESTAMPTZ;
  v_shift_code TEXT;
  v_shift_name TEXT;
  v_normal_hours NUMERIC;
  v_caller_role TEXT;
BEGIN
  -- 1. Determine actor and entry attribution
  v_actor_id := COALESCE(p_entered_by, auth.uid(), p_operator_id);

  IF v_actor_id = p_operator_id THEN
    -- Operator logging own shift
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_actor_id;
    IF v_caller_role != 'operator' AND v_caller_role NOT IN ('super_admin', 'admin', 'manager') THEN
      RAISE EXCEPTION 'Not authorized to submit shift log'
        USING ERRCODE = '42501';
    END IF;
    v_entry_source := 'operator';
  ELSE
    -- Assisted entry on behalf of operator: strictly only manager and above (super_admin, admin, manager)
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_actor_id;
    IF v_caller_role NOT IN ('super_admin', 'admin', 'manager') THEN
      RAISE EXCEPTION 'Not authorized to enter shift logs. Only roles above supervisor (manager, admin, super_admin) are permitted.'
        USING ERRCODE = '42501';
    END IF;
    v_entry_source := v_caller_role;
  END IF;

  -- 2. Meter Regression Guard
  IF p_end_meter < p_start_meter THEN
    RAISE EXCEPTION 'End meter reading (%) cannot be less than start meter reading (%)', p_end_meter, p_start_meter
      USING ERRCODE = '23514';
  END IF;

  -- 3. Normalization of Dates & Times
  v_log_date := COALESCE(p_log_date, (NOW() AT TIME ZONE 'Asia/Kolkata')::date);
  v_end_date := COALESCE(p_end_date, v_log_date);
  v_start_time := NULLIF(TRIM(p_start_time), '')::TIME;
  v_end_time := NULLIF(TRIM(p_end_time), '')::TIME;
  v_breakdown_start_time := NULLIF(TRIM(p_breakdown_start_time), '')::TIME;
  v_breakdown_end_time := NULLIF(TRIM(p_breakdown_end_time), '')::TIME;
  v_start_datetime := p_start_datetime;
  v_end_datetime := p_end_datetime;

  IF v_start_datetime IS NULL AND v_start_time IS NOT NULL THEN
    v_start_datetime := ((v_log_date::text || ' ' || v_start_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata');
  END IF;

  IF v_end_datetime IS NULL AND v_end_time IS NOT NULL THEN
    IF v_end_time < v_start_time AND v_end_date = v_log_date THEN
      v_end_date := (v_log_date + INTERVAL '1 day')::date;
    END IF;
    v_end_datetime := ((v_end_date::text || ' ' || v_end_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata');
  END IF;

  -- 4. Shift Code and Name Resolution
  v_shift_code := NULLIF(TRIM(COALESCE(p_shift_code, p_shift)), '');
  IF v_shift_code IS NOT NULL THEN
    v_shift_code := regexp_replace(v_shift_code, '^shift\s*', '', 'i');
  END IF;
  v_shift_name := COALESCE(p_shift, CASE WHEN v_shift_code IS NOT NULL THEN 'Shift ' || v_shift_code ELSE 'Standard Shift' END);

  -- 5. Client & Location Resolution
  IF p_client_id IS NOT NULL THEN
    v_resolved_client_id := p_client_id;
  ELSE
    SELECT client_id INTO v_resolved_client_id FROM public.machines WHERE id = p_machine_id;
  END IF;

  IF v_resolved_location IS NULL AND v_resolved_client_id IS NOT NULL THEN
    SELECT concat_ws(', ',
      NULLIF(btrim(street), ''),
      NULLIF(btrim(city), ''),
      NULLIF(btrim(district), ''),
      NULLIF(btrim(state), ''),
      NULLIF(btrim(pincode), '')
    )
    INTO v_resolved_location
    FROM public.clients
    WHERE id = v_resolved_client_id;
  END IF;

  -- 6. Normal Hours
  v_normal_hours := COALESCE(p_normal_working_hours, 8);

  -- 7. Ensure Idempotency Key
  v_idempotency_key := COALESCE(
    NULLIF(TRIM(p_idempotency_key), ''),
    'ihl_' || replace(gen_random_uuid()::text, '-', '')
  );

  -- 8. Insert into machine_hour_logs
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
    shift_code,
    machine_condition,
    location,
    remarks,
    idempotency_key,
    entered_by,
    entry_source
  ) VALUES (
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
    v_normal_hours,
    COALESCE(p_is_breakdown, false),
    v_breakdown_start_time,
    v_breakdown_end_time,
    p_breakdown_duration,
    COALESCE(p_breakdown_hours, 0),
    v_shift_name,
    v_shift_code,
    COALESCE(p_machine_condition, 'good'),
    v_resolved_location,
    p_remarks,
    v_idempotency_key,
    v_actor_id,
    v_entry_source
  )
  RETURNING id INTO v_log_id;

  -- 9. Update Machine hour_meter, current_operator_id, and health_status
  UPDATE public.machines
  SET
    hour_meter = p_end_meter,
    current_operator_id = p_operator_id,
    health_status = CASE
      WHEN COALESCE(p_is_breakdown, false) = true OR p_machine_condition = 'breakdown' THEN 'breakdown'
      ELSE 'active'
    END,
    updated_at = NOW()
  WHERE id = p_machine_id;

  -- 10. Sync active assignment shift_code if provided
  IF v_shift_code IS NOT NULL AND p_operator_id IS NOT NULL THEN
    UPDATE public.operator_machine_assignments
    SET shift_code = v_shift_code,
        updated_at = NOW()
    WHERE machine_id = p_machine_id
      AND operator_id = p_operator_id
      AND is_active = true
      AND (shift_code IS NULL OR shift_code <> v_shift_code);
  END IF;

  -- 11. Record Audit Log Entry Atomically
  v_audit_meta := jsonb_build_object(
    'logId', v_log_id,
    'startMeter', p_start_meter,
    'endMeter', p_end_meter,
    'runningHours', (p_end_meter - p_start_meter),
    'normalWorkingHours', v_normal_hours,
    'overtimeHours', p_overtime_hours,
    'startTime', p_start_time,
    'endTime', p_end_time,
    'shiftCode', v_shift_code,
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
    'normalWorkingHours', v_normal_hours,
    'idempotencyKey', v_idempotency_key,
    'enteredBy', v_actor_id,
    'entrySource', v_entry_source
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.submit_operator_hour_log_atomic(
  uuid, uuid, uuid, date, numeric, numeric, text, text, numeric, boolean,
  text, text, text, text, text, numeric, date, timestamptz, timestamptz,
  text, text, text, numeric, text, uuid
) TO authenticated;

-- 3. Update RLS policy insert_machine_hour_logs to remove supervisor
DROP POLICY IF EXISTS "insert_machine_hour_logs" ON public.machine_hour_logs;
CREATE POLICY "insert_machine_hour_logs" ON public.machine_hour_logs
  FOR INSERT
  WITH CHECK (
    ((operator_id = auth.uid()) AND (log_date >= (CURRENT_DATE - 7)) AND (log_date <= CURRENT_DATE))
    OR
    ((SELECT current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text]))
  );
