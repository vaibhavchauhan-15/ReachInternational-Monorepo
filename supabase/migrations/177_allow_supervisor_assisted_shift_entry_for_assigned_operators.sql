-- ==============================================================================
-- Migration 177: Allow Supervisor Assisted Shift Entry for Assigned Operators
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
-- Description:
-- 1. Creates public.is_operator_under_supervisor(p_supervisor_id, p_operator_id)
--    evaluating all canonical supervisor-operator relationship pathways:
--    - Direct user assignment (users.supervisor_id = p_supervisor_id)
--    - Array user assignment (p_supervisor_id = ANY(users.supervisor_ids))
--    - Junction table (user_supervisors)
--    - Client supervisor inheritance (client_supervisors -> machines -> active oma)
--    - Direct machine supervision (machines.current_supervisor_id / supervisor_ids -> active oma)
--    - Direct machine current operator (machines.current_operator_id / operator_ids)
-- 2. Updates public.can_manage_operator_shift_log(p_actor_id, p_operator_id) to permit
--    supervisors strictly for operators who come under their supervision.
-- 3. Updates public.submit_operator_hour_log_atomic(...) RPC:
--    - Permits caller role 'supervisor' when public.is_operator_under_supervisor(v_actor_id, p_operator_id) is true.
--    - Rejects unauthorized supervisors attempting to log for operators not under them.
--    - Records v_entry_source := 'supervisor' and attribution.
-- 4. Updates RLS policy insert_machine_hour_logs on public.machine_hour_logs:
--    - Allows supervisors to insert when public.is_operator_under_supervisor(auth.uid(), operator_id) is true.
-- 5. Updates RLS policy view_machine_hour_logs on public.machine_hour_logs:
--    - Allows supervisors to view logs they entered or for operators under their supervision.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Create helper: is_operator_under_supervisor
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_operator_under_supervisor(
  p_supervisor_id uuid,
  p_operator_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = p_operator_id
      AND (
        -- Pathway A: Direct single supervisor_id column
        u.supervisor_id = p_supervisor_id
        -- Pathway B: Multi-supervisor supervisor_ids array
        OR (u.supervisor_ids IS NOT NULL AND u.supervisor_ids @> ARRAY[p_supervisor_id])
        -- Pathway C: user_supervisors junction table
        OR EXISTS (
          SELECT 1 FROM public.user_supervisors us
          WHERE us.user_id = u.id AND us.supervisor_id = p_supervisor_id
        )
        -- Pathway D: Client supervisor inheritance via deployed machine assignment
        OR EXISTS (
          SELECT 1 FROM public.client_supervisors cs
          JOIN public.machines m ON m.client_id = cs.client_id
          JOIN public.operator_machine_assignments oma ON oma.machine_id = m.id
          WHERE cs.supervisor_id = p_supervisor_id
            AND oma.operator_id = u.id
            AND oma.is_active = true
        )
        -- Pathway E: Machine supervisor assignment via active operator assignment
        OR EXISTS (
          SELECT 1 FROM public.machines m
          JOIN public.operator_machine_assignments oma ON oma.machine_id = m.id
          WHERE (
            m.current_supervisor_id = p_supervisor_id
            OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_supervisor_id])
          )
          AND oma.operator_id = u.id
          AND oma.is_active = true
        )
        -- Pathway F: Direct machine current operator fallback
        OR EXISTS (
          SELECT 1 FROM public.machines m
          WHERE (
            m.current_supervisor_id = p_supervisor_id
            OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_supervisor_id])
            OR (
              m.client_id IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.client_supervisors cs
                WHERE cs.client_id = m.client_id AND cs.supervisor_id = p_supervisor_id
              )
            )
          )
          AND (
            m.current_operator_id = u.id
            OR (m.operator_ids IS NOT NULL AND m.operator_ids @> ARRAY[u.id])
          )
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.is_operator_under_supervisor(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_operator_under_supervisor(uuid, uuid) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. Update authorization function: can_manage_operator_shift_log
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_operator_shift_log(
  p_actor_id uuid,
  p_operator_id uuid
) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_role text;
BEGIN
  IF p_actor_id IS NULL OR p_operator_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = p_actor_id;

  IF v_role IN ('super_admin', 'admin', 'manager') THEN
    RETURN true;
  ELSIF v_role = 'supervisor' THEN
    RETURN public.is_operator_under_supervisor(p_actor_id, p_operator_id);
  ELSIF v_role = 'operator' AND p_actor_id = p_operator_id THEN
    RETURN true;
  ELSE
    RETURN false;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.can_manage_operator_shift_log(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_operator_shift_log(uuid, uuid) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. Upgrade submit_operator_hour_log_atomic RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_operator_hour_log_atomic(
  p_machine_id uuid,
  p_operator_id uuid,
  p_client_id uuid DEFAULT NULL::uuid,
  p_shift_code text DEFAULT NULL::text,
  p_log_date date DEFAULT NULL::date,
  p_end_date date DEFAULT NULL::date,
  p_start_datetime timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_end_datetime timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_start_meter numeric DEFAULT 0,
  p_end_meter numeric DEFAULT 0,
  p_start_time text DEFAULT NULL::text,
  p_end_time text DEFAULT NULL::text,
  p_overtime_hours numeric DEFAULT 0,
  p_normal_working_hours numeric DEFAULT 8,
  p_is_breakdown boolean DEFAULT false,
  p_breakdown_start_time text DEFAULT NULL::text,
  p_breakdown_end_time text DEFAULT NULL::text,
  p_breakdown_duration text DEFAULT NULL::text,
  p_breakdown_hours numeric DEFAULT 0,
  p_shift text DEFAULT NULL::text,
  p_machine_condition text DEFAULT 'good'::text,
  p_location text DEFAULT NULL::text,
  p_remarks text DEFAULT NULL::text,
  p_idempotency_key text DEFAULT NULL::text,
  p_entered_by uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_actor_id UUID;
  v_entry_source TEXT;
  v_log_id UUID;
  v_audit_meta JSONB;
  v_resolved_client_id UUID;
  v_resolved_site_id UUID;
  v_resolved_location TEXT := p_location;
  v_idempotency_key TEXT;
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
  v_breakdown_minutes INTEGER;
  v_maintenance_minutes INTEGER;
  v_shift_duration_hours NUMERIC;
  v_assigned_shift_codes TEXT[];
  v_is_assisted_override BOOLEAN := false;
  v_existing_machine_log RECORD;
  v_existing_op_log RECORD;
BEGIN
  -- 1. Determine actor and entry attribution
  v_actor_id := COALESCE(p_entered_by, auth.uid(), p_operator_id);

  IF v_actor_id = p_operator_id THEN
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_actor_id;
    IF v_caller_role != 'operator' AND v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'supervisor') THEN
      RAISE EXCEPTION 'Not authorized to submit shift log'
        USING ERRCODE = '42501';
    END IF;
    v_entry_source := 'operator';
  ELSE
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_actor_id;
    IF v_caller_role IN ('super_admin', 'admin', 'manager') THEN
      v_entry_source := v_caller_role;
    ELSIF v_caller_role = 'supervisor' THEN
      -- Strict RBAC: Supervisor can ONLY enter shift logs for operators who come under them
      IF NOT public.is_operator_under_supervisor(v_actor_id, p_operator_id) THEN
        RAISE EXCEPTION 'Not authorized: Supervisors can only fill shift entries for operators assigned under their supervision.'
          USING ERRCODE = '42501';
      END IF;
      v_entry_source := 'supervisor';
    ELSE
      RAISE EXCEPTION 'Not authorized to enter shift logs on behalf of operators. Only authorized supervisors, managers, and administrators are permitted.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 2. Meter Regression & Maximum Running Hours Guard
  IF p_end_meter < p_start_meter THEN
    RAISE EXCEPTION 'End meter reading (%) cannot be less than start meter reading (%)', p_end_meter, p_start_meter
      USING ERRCODE = '23514';
  END IF;

  IF (p_end_meter - p_start_meter) > 24 THEN
    RAISE EXCEPTION 'Machine running hours (%) cannot exceed 24 hours in a single log', (p_end_meter - p_start_meter)
      USING ERRCODE = '23514';
  END IF;

  -- 3. Machine Operational Status Guard
  IF EXISTS (
    SELECT 1 FROM public.machines
    WHERE id = p_machine_id AND (status = 'inactive' OR health_status = 'under_maintenance')
  ) THEN
    RAISE EXCEPTION 'Cannot record machine log for equipment currently in maintenance or inactive status'
      USING ERRCODE = '23514';
  END IF;

  -- 4. Normalization
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

  -- 5. Operator 7-Day Window Guard (Operators self-logging restricted to 7 days)
  IF v_entry_source = 'operator' THEN
    IF v_log_date < (CURRENT_DATE - 7) OR v_log_date > CURRENT_DATE THEN
      RAISE EXCEPTION 'Operators can only record logs within the previous 7 days (date %, allowed: % to %)',
        v_log_date, (CURRENT_DATE - 7), CURRENT_DATE
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- 6. Shift Code and Name Resolution
  v_shift_code := NULLIF(TRIM(COALESCE(p_shift_code, p_shift)), '');
  IF v_shift_code IS NOT NULL THEN
    v_shift_code := regexp_replace(v_shift_code, '^shift\s*', '', 'i');
  END IF;

  -- 7. Operator Machine Assignment & Shift Code Enforcement
  IF p_operator_id IS NOT NULL AND p_machine_id IS NOT NULL THEN
    SELECT ARRAY_AGG(DISTINCT shift_code)
    INTO v_assigned_shift_codes
    FROM public.operator_machine_assignments
    WHERE machine_id = p_machine_id
      AND operator_id = p_operator_id
      AND is_active = true
      AND shift_code IS NOT NULL;

    IF v_assigned_shift_codes IS NOT NULL AND array_length(v_assigned_shift_codes, 1) > 0 THEN
      IF v_shift_code IS NOT NULL THEN
        IF NOT (v_shift_code = ANY(v_assigned_shift_codes)) THEN
          IF v_entry_source = 'operator' THEN
            RAISE EXCEPTION 'Operator is assigned to Shift % on this equipment, but attempted to log for Shift %. Please select your assigned shift.',
              array_to_string(v_assigned_shift_codes, ', '), v_shift_code
              USING ERRCODE = '23514';
          ELSE
            -- Assisted entry by supervisor, manager, admin allows override for emergency site coverage
            v_is_assisted_override := true;
          END IF;
        END IF;
      ELSE
        IF array_length(v_assigned_shift_codes, 1) = 1 THEN
          v_shift_code := v_assigned_shift_codes[1];
        ELSE
          RAISE EXCEPTION 'Operator is assigned to shifts % on this equipment. Please select which assigned shift is being logged.',
            array_to_string(v_assigned_shift_codes, ', ')
            USING ERRCODE = '23514';
        END IF;
      END IF;
    END IF;
  END IF;

  v_shift_name := COALESCE(p_shift, CASE WHEN v_shift_code IS NOT NULL THEN 'Shift ' || v_shift_code ELSE 'Standard Shift' END);

  -- 8. Duplicate Machine Shift Guard (Idempotency / Single Entry per Machine Shift)
  IF v_shift_code IS NOT NULL THEN
    SELECT id, start_meter, end_meter, operator_id, normal_working_hours, breakdown_minutes, maintenance_minutes
    INTO v_existing_machine_log
    FROM public.machine_hour_logs
    WHERE machine_id = p_machine_id
      AND log_date = v_log_date
      AND shift_code = v_shift_code
    LIMIT 1;

    IF v_existing_machine_log.id IS NOT NULL THEN
      IF v_existing_machine_log.operator_id = p_operator_id
         AND v_existing_machine_log.start_meter = p_start_meter
         AND v_existing_machine_log.end_meter = p_end_meter THEN
        RETURN jsonb_build_object(
          'success', true,
          'id', v_existing_machine_log.id,
          'log_id', v_existing_machine_log.id,
          'machine_id', p_machine_id,
          'operator_id', p_operator_id,
          'site_id', v_resolved_site_id,
          'log_date', v_log_date,
          'start_meter', p_start_meter,
          'end_meter', p_end_meter,
          'running_hours', GREATEST(0, p_end_meter - p_start_meter),
          'normal_working_hours', v_existing_machine_log.normal_working_hours,
          'overtime_hours', COALESCE(p_overtime_hours, 0),
          'breakdown_minutes', v_existing_machine_log.breakdown_minutes,
          'maintenance_minutes', v_existing_machine_log.maintenance_minutes,
          'shift_code', v_shift_code,
          'entry_source', v_entry_source,
          'is_assisted_override', v_is_assisted_override,
          'already_logged', true
        );
      ELSE
        RAISE EXCEPTION 'A log for Shift % on date % has already been recorded for this equipment (Start: %, End: %). Duplicate entries are not permitted.',
          v_shift_code, v_log_date, v_existing_machine_log.start_meter, v_existing_machine_log.end_meter
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  -- 9. Cross-Machine Operator Shift Guard
  IF p_operator_id IS NOT NULL AND v_shift_code IS NOT NULL THEN
    SELECT l.id, l.machine_id, m.machine_id AS machine_code, l.start_meter, l.end_meter
    INTO v_existing_op_log
    FROM public.machine_hour_logs l
    LEFT JOIN public.machines m ON m.id = l.machine_id
    WHERE l.operator_id = p_operator_id
      AND l.log_date = v_log_date
      AND l.shift_code = v_shift_code
      AND l.machine_id <> p_machine_id
    LIMIT 1;

    IF v_existing_op_log.id IS NOT NULL THEN
      RAISE EXCEPTION 'Operator has already submitted a log for Shift % on machine % on %. An operator cannot operate two machines during the same shift.',
        v_shift_code, COALESCE(v_existing_op_log.machine_code, 'other equipment'), v_log_date
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- 10. Client, Site & Location Resolution
  IF p_client_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.client_sites WHERE id = p_client_id) THEN
      v_resolved_site_id := p_client_id;
      SELECT client_id INTO v_resolved_client_id FROM public.client_sites WHERE id = v_resolved_site_id;
    ELSE
      v_resolved_client_id := p_client_id;
    END IF;
  ELSE
    SELECT client_id, site_id INTO v_resolved_client_id, v_resolved_site_id FROM public.machines WHERE id = p_machine_id;
  END IF;

  IF v_resolved_location IS NULL AND v_resolved_site_id IS NOT NULL THEN
    SELECT name INTO v_resolved_location FROM public.client_sites WHERE id = v_resolved_site_id;
  END IF;

  IF v_resolved_location IS NULL AND v_resolved_client_id IS NOT NULL THEN
    SELECT concat_ws(', ',
      NULLIF(btrim(city), ''),
      NULLIF(btrim(district), ''),
      NULLIF(btrim(state), '')
    )
    INTO v_resolved_location
    FROM public.clients
    WHERE id = v_resolved_client_id;
  END IF;

  -- 11. Normal Hours
  v_normal_hours := COALESCE(p_normal_working_hours, 8);

  -- 12. Ensure Idempotency Key
  v_idempotency_key := COALESCE(
    NULLIF(TRIM(p_idempotency_key), ''),
    'ihl_' || replace(gen_random_uuid()::text, '-', '')
  );

  -- 13. Compute Breakdown Minutes
  v_breakdown_minutes := 0;
  IF p_is_breakdown = true THEN
    IF p_breakdown_hours > 0 THEN
      v_breakdown_minutes := ROUND(p_breakdown_hours * 60);
    ELSIF v_breakdown_start_time IS NOT NULL AND v_breakdown_end_time IS NOT NULL THEN
      IF v_breakdown_end_time >= v_breakdown_start_time THEN
        v_breakdown_minutes := ROUND(EXTRACT(EPOCH FROM (v_breakdown_end_time - v_breakdown_start_time)) / 60);
      ELSE
        v_breakdown_minutes := ROUND(EXTRACT(EPOCH FROM ((v_breakdown_end_time + INTERVAL '24 hours') - v_breakdown_start_time)) / 60);
      END IF;
    END IF;
  END IF;

  -- 14. Compute Maintenance Allowance
  v_maintenance_minutes := 0;
  IF v_resolved_client_id IS NOT NULL THEN
    SELECT COALESCE(maintenance_allowance_minutes, 0)
    INTO v_maintenance_minutes
    FROM public.clients
    WHERE id = v_resolved_client_id;
  END IF;

  -- 15. Insert into machine_hour_logs
  INSERT INTO public.machine_hour_logs (
    machine_id,
    operator_id,
    client_id,
    site_id,
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
    breakdown_minutes,
    maintenance_minutes,
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
    v_resolved_site_id,
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
    COALESCE(v_breakdown_minutes, 0),
    COALESCE(v_maintenance_minutes, 0),
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

  -- 16. Update Machine hour_meter, current_operator_id, health_status
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

  -- 17. Sync active assignment shift_code if provided
  IF v_shift_code IS NOT NULL AND p_operator_id IS NOT NULL THEN
    UPDATE public.operator_machine_assignments
    SET shift_code = v_shift_code,
        updated_at = NOW()
    WHERE machine_id = p_machine_id
      AND operator_id = p_operator_id
      AND is_active = true
      AND (shift_code IS NULL OR shift_code <> v_shift_code);
  END IF;

  -- 18. Record Structured Audit Log Atomically
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
    'entrySource', v_entry_source,
    'isAssistedOverride', v_is_assisted_override
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
    'id', v_log_id,
    'log_id', v_log_id,
    'machine_id', p_machine_id,
    'operator_id', p_operator_id,
    'site_id', v_resolved_site_id,
    'log_date', v_log_date,
    'start_meter', p_start_meter,
    'end_meter', p_end_meter,
    'running_hours', (p_end_meter - p_start_meter),
    'normal_working_hours', v_normal_hours,
    'overtime_hours', COALESCE(p_overtime_hours, 0),
    'breakdown_minutes', v_breakdown_minutes,
    'maintenance_minutes', v_maintenance_minutes,
    'shift_code', v_shift_code,
    'entry_source', v_entry_source,
    'is_assisted_override', v_is_assisted_override
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_operator_hour_log_atomic(
  uuid, uuid, uuid, text, date, date, timestamptz, timestamptz, numeric, numeric,
  text, text, numeric, numeric, boolean, text, text, text, numeric, text,
  text, text, text, text, uuid
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.submit_operator_hour_log_atomic(
  uuid, uuid, uuid, text, date, date, timestamptz, timestamptz, numeric, numeric,
  text, text, numeric, numeric, boolean, text, text, text, numeric, text,
  text, text, text, text, uuid
) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. Update RLS policy insert_machine_hour_logs
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "insert_machine_hour_logs" ON public.machine_hour_logs;
CREATE POLICY "insert_machine_hour_logs" ON public.machine_hour_logs
  FOR INSERT
  WITH CHECK (
    -- Operator self logging (allowed up to 7 days in the past)
    ((operator_id = auth.uid()) AND (log_date >= (CURRENT_DATE - 7)) AND (log_date <= CURRENT_DATE))
    OR
    -- Management roles (super_admin, admin, manager)
    ((SELECT current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text]))
    OR
    -- Supervisor: strictly for operators who come under their supervision
    (
      ((SELECT current_user_role()) = 'supervisor'::text)
      AND public.is_operator_under_supervisor(auth.uid(), operator_id)
    )
  );

-- ------------------------------------------------------------------------------
-- 5. Update RLS policy view_machine_hour_logs
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "view_machine_hour_logs" ON public.machine_hour_logs;
CREATE POLICY "view_machine_hour_logs" ON public.machine_hour_logs
  FOR SELECT TO authenticated
  USING (
    ((SELECT current_user_role()) = ANY (ARRAY['super_admin', 'admin', 'manager', 'hr']))
    OR operator_id = auth.uid()
    OR entered_by = auth.uid()
    OR public.check_user_can_access_machine(machine_id)
    OR (
      (SELECT current_user_role()) = 'supervisor'
      AND public.is_operator_under_supervisor(auth.uid(), operator_id)
    )
  );
