-- ==============================================================================
-- Migration 129: Fix Assisted Shift Log Entry RPC & Today's Shift Log Monitor Sync
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
-- Description:
-- 1. Unifies submit_operator_hour_log_atomic into a single canonical 25-argument
--    function, dropping all obsolete and ambiguous overloads to resolve PostgREST PGRST203.
-- 2. Fully supports supervisor assisted entry (p_entered_by, entry_source, shift_code).
-- 3. Synchronizes operator_machine_assignments.shift_code upon log submission.
-- 4. Upgrades get_today_shift_log_monitor() with robust matched_logs ranking to
--    accurately reflect entered shift logs, HMR, entered_by, and pending/entered counts.
-- ==============================================================================

-- 1. Drop all obsolete overloads of submit_operator_hour_log_atomic
DROP FUNCTION IF EXISTS public.submit_operator_hour_log_atomic(uuid, uuid, uuid, date, numeric, numeric, text, text, numeric, boolean, text, text, text, text, text, numeric);
DROP FUNCTION IF EXISTS public.submit_operator_hour_log_atomic(uuid, uuid, uuid, date, numeric, numeric, text, text, numeric, boolean, text, text, text, text, text, numeric, uuid);
DROP FUNCTION IF EXISTS public.submit_operator_hour_log_atomic(uuid, uuid, uuid, date, numeric, numeric, text, text, numeric, boolean, text, text, text, text, text, numeric, date, timestamptz, timestamptz, text, text, text, numeric);
DROP FUNCTION IF EXISTS public.submit_operator_hour_log_atomic(uuid, uuid, uuid, date, date, timestamptz, timestamptz, numeric, numeric, text, text, numeric, numeric, boolean, text, text, text, numeric, text, text, text, text, text, text);

-- 2. Create canonical unified submit_operator_hour_log_atomic
CREATE OR REPLACE FUNCTION public.submit_operator_hour_log_atomic(
  p_machine_id uuid,
  p_operator_id uuid,
  p_client_id uuid DEFAULT NULL,
  p_log_date date DEFAULT CURRENT_DATE,
  p_start_meter numeric DEFAULT 0,
  p_end_meter numeric DEFAULT 0,
  p_start_time text DEFAULT NULL,
  p_end_time text DEFAULT NULL,
  p_overtime_hours numeric DEFAULT 0,
  p_is_breakdown boolean DEFAULT false,
  p_shift text DEFAULT NULL,
  p_machine_condition text DEFAULT 'good',
  p_location text DEFAULT NULL,
  p_remarks text DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL,
  p_normal_working_hours numeric DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_start_datetime timestamptz DEFAULT NULL,
  p_end_datetime timestamptz DEFAULT NULL,
  p_breakdown_start_time text DEFAULT NULL,
  p_breakdown_end_time text DEFAULT NULL,
  p_breakdown_duration text DEFAULT NULL,
  p_breakdown_hours numeric DEFAULT 0,
  p_shift_code text DEFAULT NULL,
  p_entered_by uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
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
    v_entry_source := 'operator';
  ELSE
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_actor_id;
    IF v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'supervisor') THEN
      IF NOT public.can_manage_operator_shift_log(v_actor_id, p_operator_id) THEN
        RAISE EXCEPTION 'Not authorized to submit shift log for this operator'
          USING ERRCODE = '42501';
      END IF;
    END IF;
    v_entry_source := COALESCE(v_caller_role, 'supervisor');
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
) TO authenticated, service_role;


-- 3. Upgrade get_today_shift_log_monitor RPC
DROP FUNCTION IF EXISTS public.get_today_shift_log_monitor(uuid, date, text);

CREATE OR REPLACE FUNCTION public.get_today_shift_log_monitor(
  p_actor_id uuid,
  p_log_date date DEFAULT CURRENT_DATE,
  p_search text DEFAULT NULL
) RETURNS TABLE (
  operator_id uuid,
  operator_name text,
  operator_phone text,
  machine_id uuid,
  machine_code text,
  machine_serial_number text,
  machine_model text,
  client_id uuid,
  client_code text,
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
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH actor_info AS (
    SELECT role FROM public.users WHERE id = p_actor_id
  ),
  active_assignments AS (
    SELECT oma.operator_id,
           oma.machine_id,
           oma.shift_start_time,
           oma.shift_end_time,
           oma.shift_code AS oma_shift_code,
           m.machine_id AS machine_code,
           m.serial_number,
           m.model,
           m.client_id,
           m.hour_meter AS current_meter
    FROM public.operator_machine_assignments oma
    JOIN public.machines m ON m.id = oma.machine_id
    WHERE oma.is_active = true
      AND m.status IN ('active', 'rented')
      AND (
        (SELECT role FROM actor_info) IN ('super_admin', 'admin', 'manager')
        OR EXISTS (
          SELECT 1 FROM public.user_supervisors us
          WHERE us.supervisor_id = p_actor_id AND us.user_id = oma.operator_id
        )
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = oma.operator_id AND u.supervisor_id = p_actor_id
        )
        OR m.current_supervisor_id = p_actor_id
        OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
      )
  ),
  unassigned_machines AS (
    SELECT NULL::uuid AS operator_id,
           m.id AS machine_id,
           NULL::time AS shift_start_time,
           NULL::time AS shift_end_time,
           'S1'::text AS oma_shift_code,
           m.machine_id AS machine_code,
           m.serial_number,
           m.model,
           m.client_id,
           m.hour_meter AS current_meter
    FROM public.machines m
    WHERE m.status IN ('active', 'rented')
      AND NOT EXISTS (
        SELECT 1 FROM public.operator_machine_assignments oma
        WHERE oma.machine_id = m.id AND oma.is_active = true
      )
      AND (
        (SELECT role FROM actor_info) IN ('super_admin', 'admin', 'manager')
        OR m.current_supervisor_id = p_actor_id
        OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
      )
  ),
  combined_roster_sources AS (
    SELECT * FROM active_assignments
    UNION ALL
    SELECT * FROM unassigned_machines
  ),
  roster AS (
    SELECT a.*,
           COALESCE(a.oma_shift_code, csc.code, 'S1') AS shift_code,
           COALESCE(csc.start_time, a.shift_start_time) AS shift_start,
           COALESCE(csc.end_time, a.shift_end_time) AS shift_end
    FROM combined_roster_sources a
    LEFT JOIN public.client_shift_codes csc
      ON csc.client_id = a.client_id
     AND csc.is_active = true
     AND (
       (a.oma_shift_code IS NOT NULL AND csc.code = a.oma_shift_code)
       OR (a.oma_shift_code IS NULL AND csc.start_time = a.shift_start_time AND csc.end_time = a.shift_end_time)
     )
  ),
  -- For each roster entry, find matching machine_hour_log for today
  matched_logs AS (
    SELECT r.operator_id,
           r.machine_id,
           l.id AS log_id,
           l.entered_by,
           l.entry_source,
           l.log_date,
           l.start_meter,
           l.end_meter,
           l.running_hours,
           l.remarks,
           l.shift_code AS log_shift_code,
           l.operator_id AS log_operator_id,
           ROW_NUMBER() OVER (
             PARTITION BY r.machine_id, COALESCE(r.operator_id, '00000000-0000-0000-0000-000000000000'::uuid)
             ORDER BY
               -- Prefer exact shift_code match first, then most recently entered log
               CASE WHEN l.shift_code = r.shift_code OR l.shift ILIKE '%' || r.shift_code || '%' THEN 0 ELSE 1 END,
               l.created_at DESC
           ) AS match_rank
    FROM roster r
    INNER JOIN public.machine_hour_logs l
      ON l.machine_id = r.machine_id
     AND l.log_date = p_log_date
     AND (
       (r.operator_id IS NOT NULL AND l.operator_id = r.operator_id)
       OR (r.operator_id IS NULL)
     )
  )
  SELECT r.operator_id,
         COALESCE(u.full_name, log_op.full_name, 'Unassigned') AS operator_name,
         COALESCE(u.phone, log_op.phone) AS operator_phone,
         r.machine_id,
         r.machine_code,
         r.serial_number AS machine_serial_number,
         r.model AS machine_model,
         r.client_id,
         COALESCE(cl.client_id, cl.code) AS client_code,
         COALESCE(cl.company_name, 'Available / Unassigned') AS client_name,
         r.current_meter,
         COALESCE(ml.log_shift_code, r.shift_code, 'S1') AS shift_code,
         r.shift_start,
         r.shift_end,
         CASE
           WHEN ml.log_id IS NOT NULL THEN 'entered'
           WHEN r.operator_id IS NULL THEN 'unassigned'
           ELSE 'pending'
         END AS status,
         ml.log_id,
         ml.entered_by,
         eu.full_name AS entered_by_name,
         ml.entry_source,
         ml.log_date,
         ml.start_meter,
         ml.end_meter,
         ml.running_hours,
         ml.remarks
  FROM roster r
  LEFT JOIN matched_logs ml
    ON ml.machine_id = r.machine_id
   AND (
     (r.operator_id IS NOT NULL AND ml.operator_id = r.operator_id)
     OR (r.operator_id IS NULL AND ml.operator_id IS NULL)
   )
   AND ml.match_rank = 1
  LEFT JOIN public.users u ON u.id = r.operator_id
  LEFT JOIN public.users log_op ON log_op.id = ml.log_operator_id
  LEFT JOIN public.clients cl ON cl.id = r.client_id
  LEFT JOIN public.users eu ON eu.id = ml.entered_by
  WHERE (p_search IS NULL OR p_search = '' OR (
     COALESCE(u.full_name, log_op.full_name, '') ILIKE '%' || p_search || '%'
     OR COALESCE(u.phone, log_op.phone, '') ILIKE '%' || p_search || '%'
     OR r.machine_code ILIKE '%' || p_search || '%'
     OR COALESCE(r.serial_number, '') ILIKE '%' || p_search || '%'
     OR COALESCE(r.model, '') ILIKE '%' || p_search || '%'
     OR COALESCE(cl.company_name, '') ILIKE '%' || p_search || '%'
     OR COALESCE(cl.client_id, cl.code, '') ILIKE '%' || p_search || '%'
  ))
  ORDER BY
    CASE
      WHEN ml.log_id IS NOT NULL THEN 2
      WHEN r.operator_id IS NULL THEN 0
      ELSE 1
    END,
    r.machine_code,
    r.shift_code;
$$;

GRANT EXECUTE ON FUNCTION public.get_today_shift_log_monitor(uuid, date, text) TO authenticated, service_role;
