-- ==============================================================================
-- Migration 183: Fix Operator Shift Entry Equipment Authorization & Machine Trigger
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
-- Description:
-- 1. Updates public.enforce_supervisor_machine_update_restrictions() trigger function
--    on public.machines:
--    - Resolves bug where legitimate operators logging shift entries had their updates
--      blocked with 42501 ("Unauthorized: Operators cannot modify Machine Operator assignments.")
--      when changing current_operator_id from a previous operator to themselves.
--    - Removes non-existent column check "hourly_rate" on machines table.
--    - Strictly permits an operator to set NEW.current_operator_id = auth.uid() if and only
--      if they are actively assigned / authorized for that machine (check_user_can_access_machine).
--    - Retains strict guard blocking operators from altering operator_ids, changing current_operator_id
--      to third parties, or altering static machinery specifications.
-- 2. Updates public.sync_machine_personnel_arrays() trigger function on public.machines:
--    - When an operator is logging a shift and sets current_operator_id to themselves,
--      preserves the active current_operator_id if already present in operator_ids, rather
--      than blindly overwriting with operator_ids[1].
-- 3. Updates public.machines_update_authorized RLS policy on public.machines:
--    - Ensures actively assigned operators (via check_user_can_access_machine) can update
--      hour_meter, health_status, and current_operator_id during shift log recording.
-- 4. Upgrades public.submit_operator_hour_log_atomic(...) RPC:
--    - Adds authoritative database-level equipment assignment check:
--      Rejects operator self-entry on unassigned machinery with 42501:
--      "Operator is not authorized to submit shift logs for this equipment. You must be assigned to the machine to submit logs."
--    - Preserves supervisor assisted entry rules (can fill for operators under supervision
--      or machines they supervise, with emergency shift override).
--    - Enforces shift code validation against active operator assignments.
-- 5. Updates RLS policy insert_machine_hour_logs on public.machine_hour_logs:
--    - Ensures direct table inserts from operators also require active equipment assignment
--      via public.check_user_can_access_machine(machine_id, auth.uid()).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Fix trigger function: enforce_supervisor_machine_update_restrictions
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_supervisor_machine_update_restrictions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. Restrictions applying to both supervisor and operator
  IF (public.current_user_role() IN ('supervisor', 'operator')) THEN
    -- Check machine_id
    IF (OLD.machine_id IS DISTINCT FROM NEW.machine_id) THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change Machine ID.'
        USING ERRCODE = '42501';
    END IF;

    -- Check model
    IF (OLD.model IS DISTINCT FROM NEW.model) THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change Machine Model.'
        USING ERRCODE = '42501';
    END IF;

    -- Check serial_number
    IF (OLD.serial_number IS DISTINCT FROM NEW.serial_number) THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change Machine Serial Number.'
        USING ERRCODE = '42501';
    END IF;

    -- Check year_of_mfg
    IF (OLD.year_of_mfg IS DISTINCT FROM NEW.year_of_mfg) THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change Year of Manufacture.'
        USING ERRCODE = '42501';
    END IF;

    -- Check manufacturer
    IF (OLD.manufacturer IS DISTINCT FROM NEW.manufacturer) THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change Manufacturer.'
        USING ERRCODE = '42501';
    END IF;

    -- Check client assignment
    IF (OLD.client_id IS DISTINCT FROM NEW.client_id) THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change Machine Client Assignment.'
        USING ERRCODE = '42501';
    END IF;

    -- Check supervisor assignments
    IF (OLD.current_supervisor_id IS DISTINCT FROM NEW.current_supervisor_id OR OLD.supervisor_ids IS DISTINCT FROM NEW.supervisor_ids) THEN
      RAISE EXCEPTION 'Unauthorized: You cannot change or unassign Machine Supervisors.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 2. Additional strict restrictions applying to operator
  IF (public.current_user_role() = 'operator') THEN
    -- Operators cannot modify the fleet assignment array (operator_ids)
    IF (OLD.operator_ids IS DISTINCT FROM NEW.operator_ids) THEN
      RAISE EXCEPTION 'Unauthorized: Operators cannot modify Machine Operator assignments.'
        USING ERRCODE = '42501';
    END IF;

    -- When updating current_operator_id:
    -- If current_operator_id is being changed, an operator can ONLY record THEMSELVES (auth.uid()),
    -- and ONLY IF they are actively authorized/assigned to operate this machine.
    IF (OLD.current_operator_id IS DISTINCT FROM NEW.current_operator_id) THEN
      IF (NEW.current_operator_id IS DISTINCT FROM auth.uid() OR NOT public.check_user_can_access_machine(NEW.id, auth.uid())) THEN
        RAISE EXCEPTION 'Unauthorized: Operators cannot modify Machine Operator assignments.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_enforce_supervisor_machine_update_restrictions
  BEFORE UPDATE ON public.machines
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_supervisor_machine_update_restrictions();

-- ------------------------------------------------------------------------------
-- 2. Upgrade trigger function: sync_machine_personnel_arrays
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_machine_personnel_arrays()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Normalize null arrays to empty arrays
  IF NEW.supervisor_ids IS NULL THEN
    NEW.supervisor_ids := '{}';
  END IF;

  IF NEW.operator_ids IS NULL THEN
    NEW.operator_ids := '{}';
  END IF;

  -- Remove duplicate and null UUIDs from arrays preserving order
  SELECT COALESCE(array_agg(elem), '{}')
  INTO NEW.supervisor_ids
  FROM (
    SELECT DISTINCT ON (elem) elem, ord
    FROM unnest(NEW.supervisor_ids) WITH ORDINALITY AS t(elem, ord)
    WHERE elem IS NOT NULL
    ORDER BY elem, ord
  ) s;

  SELECT COALESCE(array_agg(elem), '{}')
  INTO NEW.operator_ids
  FROM (
    SELECT DISTINCT ON (elem) elem, ord
    FROM unnest(NEW.operator_ids) WITH ORDINALITY AS t(elem, ord)
    WHERE elem IS NOT NULL
    ORDER BY elem, ord
  ) s;

  -- Handle single IDs:
  IF TG_OP = 'INSERT' THEN
    IF cardinality(NEW.supervisor_ids) = 0 AND NEW.current_supervisor_id IS NOT NULL THEN
      NEW.supervisor_ids := ARRAY[NEW.current_supervisor_id];
    END IF;
    IF cardinality(NEW.operator_ids) = 0 AND NEW.current_operator_id IS NOT NULL THEN
      NEW.operator_ids := ARRAY[NEW.current_operator_id];
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.supervisor_ids = OLD.supervisor_ids AND NEW.current_supervisor_id IS DISTINCT FROM OLD.current_supervisor_id THEN
      IF NEW.current_supervisor_id IS NOT NULL THEN
        IF NOT (NEW.current_supervisor_id = ANY(NEW.supervisor_ids)) THEN
          NEW.supervisor_ids := array_prepend(NEW.current_supervisor_id, NEW.supervisor_ids);
        END IF;
      END IF;
    END IF;

    IF NEW.operator_ids = OLD.operator_ids AND NEW.current_operator_id IS DISTINCT FROM OLD.current_operator_id THEN
      IF NEW.current_operator_id IS NOT NULL THEN
        IF NOT (NEW.current_operator_id = ANY(NEW.operator_ids)) THEN
          NEW.operator_ids := array_prepend(NEW.current_operator_id, NEW.operator_ids);
        END IF;
      END IF;
    END IF;
  END IF;

  -- Authoritatively synchronize current single-lookup columns:
  -- If current single column is valid and present in array, keep it; otherwise default to array[1].
  IF cardinality(NEW.supervisor_ids) > 0 THEN
    IF NEW.current_supervisor_id IS NULL OR NOT (NEW.current_supervisor_id = ANY(NEW.supervisor_ids)) THEN
      NEW.current_supervisor_id := NEW.supervisor_ids[1];
    END IF;
  ELSE
    NEW.current_supervisor_id := NULL;
  END IF;

  IF cardinality(NEW.operator_ids) > 0 THEN
    IF NEW.current_operator_id IS NULL OR NOT (NEW.current_operator_id = ANY(NEW.operator_ids)) THEN
      NEW.current_operator_id := NEW.operator_ids[1];
    END IF;
  ELSE
    NEW.current_operator_id := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. Update RLS policy: machines_update_authorized
-- ------------------------------------------------------------------------------
ALTER POLICY "machines_update_authorized" ON public.machines
  USING (
    ((SELECT current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'supervisor'::text]))
    OR
    (
      ((SELECT current_user_role()) = 'operator'::text)
      AND (
        public.check_user_can_access_machine(id, auth.uid())
        OR (auth.uid() = ANY(operator_ids))
        OR (current_operator_id = auth.uid())
        OR (current_operator_id IS NULL)
        OR (operator_ids = '{}'::uuid[])
      )
    )
  )
  WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 4. Upgrade submit_operator_hour_log_atomic RPC
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
      -- Strict RBAC: Supervisor can enter shift logs if:
      -- 1. Operator comes under their supervision (is_operator_under_supervisor)
      -- OR 2. Machine or client is supervised by this supervisor
      IF NOT (
        public.is_operator_under_supervisor(v_actor_id, p_operator_id)
        OR EXISTS (
          SELECT 1 FROM public.machines m
          WHERE m.id = p_machine_id
            AND (
              m.current_supervisor_id = v_actor_id
              OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[v_actor_id])
              OR (
                m.client_id IS NOT NULL AND EXISTS (
                  SELECT 1 FROM public.client_supervisors cs
                  WHERE cs.client_id = m.client_id AND cs.supervisor_id = v_actor_id
                )
              )
            )
        )
      ) THEN
        RAISE EXCEPTION 'Not authorized: Supervisors can only fill shift entries for operators or machinery assigned under their supervision.'
          USING ERRCODE = '42501';
      END IF;
      v_entry_source := 'supervisor';
    ELSE
      RAISE EXCEPTION 'Not authorized to enter shift logs on behalf of operators. Only authorized supervisors, managers, and administrators are permitted.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 1b. Equipment Assignment Enforcement for Operator Self-Entry
  IF v_entry_source = 'operator' THEN
    IF NOT public.check_user_can_access_machine(p_machine_id, p_operator_id) THEN
      RAISE EXCEPTION 'Operator is not authorized to submit shift logs for this equipment. You must be assigned to the machine to submit logs.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 2. Meter Range & Maximum Running Hours Guard
  IF p_start_meter < 0 OR p_end_meter < 0 THEN
    RAISE EXCEPTION 'Hour meter readings cannot be negative (start: %, end: %)', p_start_meter, p_end_meter
      USING ERRCODE = '23514';
  END IF;

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
    SELECT COALESCE(NULLIF(btrim(site_name), ''), NULLIF(btrim(city), '')) INTO v_resolved_location FROM public.client_sites WHERE id = v_resolved_site_id;
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

  -- 17. Sync assignment shift_code
  IF v_shift_code IS NOT NULL AND p_operator_id IS NOT NULL AND NOT v_is_assisted_override THEN
    UPDATE public.operator_machine_assignments
    SET shift_code = v_shift_code, updated_at = NOW()
    WHERE id = (
      SELECT oma.id
      FROM public.operator_machine_assignments oma
      WHERE oma.machine_id = p_machine_id
        AND oma.operator_id = p_operator_id
        AND oma.is_active = true
        AND oma.shift_code IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.operator_machine_assignments ex
          WHERE ex.machine_id = p_machine_id
            AND ex.is_active = true
            AND ex.shift_code = v_shift_code
            AND ex.id <> oma.id
        )
      LIMIT 1
    );
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
    p_machine_id::text,
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
-- 5. Update RLS policy: insert_machine_hour_logs
-- ------------------------------------------------------------------------------
ALTER POLICY "insert_machine_hour_logs" ON public.machine_hour_logs
  WITH CHECK (
    -- Operator self logging (allowed up to 7 days in the past, strictly for assigned machinery)
    (
      (operator_id = auth.uid())
      AND (log_date >= (CURRENT_DATE - 7))
      AND (log_date <= CURRENT_DATE)
      AND public.check_user_can_access_machine(machine_id, auth.uid())
    )
    OR
    -- Management roles (super_admin, admin, manager)
    ((SELECT current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text]))
    OR
    -- Supervisor: strictly for operators who come under their supervision or machines they supervise
    (
      ((SELECT current_user_role()) = 'supervisor'::text)
      AND (
        public.is_operator_under_supervisor(auth.uid(), operator_id)
        OR EXISTS (
          SELECT 1 FROM public.machines m
          WHERE m.id = machine_hour_logs.machine_id
            AND (
              m.current_supervisor_id = auth.uid()
              OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[auth.uid()])
              OR (
                m.client_id IS NOT NULL AND EXISTS (
                  SELECT 1 FROM public.client_supervisors cs
                  WHERE cs.client_id = m.client_id AND cs.supervisor_id = auth.uid()
                )
              )
            )
        )
      )
    )
  );


-- ------------------------------------------------------------------------------
-- 6. Upgrade check_user_can_access_machine to prioritize explicit p_user_id
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_user_can_access_machine(
  p_machine_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT;
  v_uid UUID;
  v_client_id UUID;
  v_cur_sup UUID;
  v_sup_ids UUID[];
  v_cur_op UUID;
  v_op_ids UUID[];
BEGIN
  -- When p_user_id is passed explicitly, evaluate for that user; otherwise evaluate for auth.uid()
  v_uid := COALESCE(p_user_id, auth.uid());
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_uid;

  -- Admins, managers, and HR have monorepo-wide equipment visibility
  IF v_role IN ('super_admin', 'admin', 'manager', 'hr') THEN
    RETURN TRUE;
  END IF;

  SELECT client_id, current_supervisor_id, supervisor_ids, current_operator_id, operator_ids
  INTO v_client_id, v_cur_sup, v_sup_ids, v_cur_op, v_op_ids
  FROM public.machines
  WHERE id = p_machine_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Supervisor access: Inherited through client when allocated, or legacy direct machine assignment when unallocated
  IF v_role = 'supervisor' THEN
    IF v_client_id IS NOT NULL THEN
      RETURN EXISTS (
        SELECT 1 FROM public.client_supervisors cs
        WHERE cs.client_id = v_client_id AND cs.supervisor_id = v_uid
      );
    ELSE
      -- Unallocated machine fallback: direct machine supervisor
      IF v_cur_sup = v_uid OR (v_sup_ids IS NOT NULL AND v_uid = ANY(v_sup_ids)) THEN
        RETURN TRUE;
      END IF;
      RETURN FALSE;
    END IF;
  END IF;

  -- Operator access: Actively assigned machine or legacy operator assignment
  IF v_role = 'operator' THEN
    IF EXISTS (
      SELECT 1 FROM public.operator_machine_assignments oma
      WHERE oma.machine_id = p_machine_id
        AND oma.operator_id = v_uid
        AND oma.is_active = true
    ) THEN
      RETURN TRUE;
    END IF;

    IF v_cur_op = v_uid OR (v_op_ids IS NOT NULL AND v_uid = ANY(v_op_ids)) THEN
      RETURN TRUE;
    END IF;

    -- Unassigned fleet fallback: if machine has no operators assigned, any active operator can access
    IF cardinality(v_op_ids) = 0 AND v_cur_op IS NULL THEN
      RETURN TRUE;
    END IF;

    RETURN FALSE;
  END IF;

  RETURN FALSE;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_user_can_access_machine(p_machine_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT public.check_user_can_access_machine(p_machine_id, auth.uid());
$$;
