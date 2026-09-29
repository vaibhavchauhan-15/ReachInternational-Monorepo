-- ==============================================================================
-- Migration 120: Fix Operator Single-Machine Enforcement & Shift Monitor
-- 1. Add unique partial index: one active assignment per operator (single machine)
-- 2. Clean up stale machines.operator_ids from ended/missing assignments
-- 3. Rewrite get_today_shift_log_monitor to use operator_machine_assignments
--    instead of machines.operator_ids × client_shift_codes Cartesian product
-- 4. Add duplicate shift guard to submit_operator_hour_log_atomic
-- ==============================================================================

-- 1. End duplicate active assignments (keep only the latest per operator)
-- Safety: deactivate all but the most recent active assignment per operator
WITH ranked AS (
  SELECT id, operator_id,
    ROW_NUMBER() OVER (PARTITION BY operator_id ORDER BY assigned_at DESC) AS rn
  FROM public.operator_machine_assignments
  WHERE is_active = true
)
UPDATE public.operator_machine_assignments
SET is_active = false,
    ended_at = NOW(),
    end_reason = 'reassigned',
    updated_at = NOW()
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2. Unique partial index: one active assignment per operator at a time
-- ponytail: DB constraint over app code — one line replaces hundreds of validation lines
CREATE UNIQUE INDEX IF NOT EXISTS idx_oma_one_active_per_operator
  ON public.operator_machine_assignments (operator_id)
  WHERE (is_active = true);

-- 3. Re-sync machines.operator_ids from authoritative operator_machine_assignments
-- Cleans stale entries where operator appears in operator_ids but has no active assignment
DO $$
DECLARE
  r RECORD;
  v_correct_ops UUID[];
BEGIN
  FOR r IN
    SELECT m.id AS machine_id
    FROM public.machines m
    WHERE m.operator_ids IS NOT NULL AND array_length(m.operator_ids, 1) > 0
  LOOP
    SELECT COALESCE(array_agg(oma.operator_id ORDER BY oma.assigned_at), '{}')
    INTO v_correct_ops
    FROM public.operator_machine_assignments oma
    WHERE oma.machine_id = r.machine_id AND oma.is_active = true;

    UPDATE public.machines
    SET operator_ids = v_correct_ops,
        current_operator_id = CASE WHEN cardinality(v_correct_ops) > 0 THEN v_correct_ops[1] ELSE NULL END,
        updated_at = NOW()
    WHERE id = r.machine_id
      AND operator_ids IS DISTINCT FROM v_correct_ops;
  END LOOP;
END $$;

-- 4. Upgrade assign_operator_machine_atomic to end previous assignment before creating new one
CREATE OR REPLACE FUNCTION public.assign_operator_machine_atomic(
  p_machine_id UUID,
  p_operator_id UUID,
  p_shift_start TIME DEFAULT NULL,
  p_shift_end TIME DEFAULT NULL,
  p_assigned_by UUID DEFAULT NULL,
  p_shift_start_time TIME DEFAULT NULL,
  p_shift_end_time TIME DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_machine RECORD;
  v_operator RECORD;
  v_existing_active RECORD;
  v_new_assignment_id UUID;
  v_new_assignment RECORD;
  v_audit_meta JSONB;
  v_shift_start TIME;
  v_shift_end TIME;
BEGIN
  v_shift_start := COALESCE(p_shift_start, p_shift_start_time);
  v_shift_end := COALESCE(p_shift_end, p_shift_end_time);

  IF v_shift_start IS NULL OR v_shift_end IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Both shift start and end times must be provided.');
  END IF;

  -- 1. Validate Target Machine Exists
  SELECT id, machine_id, model, serial_number
  INTO v_machine
  FROM public.machines
  WHERE id = p_machine_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target machine not found.');
  END IF;

  -- 2. Validate Operator Exists & Is Active
  SELECT id, full_name, email, role, status
  INTO v_operator
  FROM public.users
  WHERE id = p_operator_id AND role = 'operator' AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Selected operator is not active or does not exist.');
  END IF;

  -- 3. Validate Shift
  IF v_shift_start = v_shift_end THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shift start time and end time cannot be identical.');
  END IF;

  -- 4. Check if operator already has same exact assignment on this machine
  SELECT id, machine_id, shift_start_time, shift_end_time INTO v_existing_active
  FROM public.operator_machine_assignments
  WHERE operator_id = p_operator_id AND is_active = true;

  IF v_existing_active.id IS NOT NULL THEN
    -- Same machine, same shift = no-op
    IF v_existing_active.machine_id = p_machine_id
       AND v_existing_active.shift_start_time = v_shift_start
       AND v_existing_active.shift_end_time = v_shift_end THEN
      RETURN jsonb_build_object('success', false, 'error',
        v_operator.full_name || ' is already assigned to this machine on shift ' ||
        v_shift_start::text || ' – ' || v_shift_end::text || '.');
    END IF;

    -- Different machine or shift: end previous assignment first (reassign)
    UPDATE public.operator_machine_assignments
    SET is_active = false,
        ended_at = NOW(),
        ended_by = p_assigned_by,
        end_reason = 'reassigned',
        updated_at = NOW()
    WHERE id = v_existing_active.id;
  END IF;

  -- 5. Insert new assignment (capacity trigger and unique index enforce constraints)
  BEGIN
    INSERT INTO public.operator_machine_assignments (
      machine_id,
      operator_id,
      shift_start_time,
      shift_end_time,
      is_active,
      assigned_by,
      assigned_at
    )
    VALUES (
      p_machine_id,
      p_operator_id,
      v_shift_start,
      v_shift_end,
      true,
      p_assigned_by,
      NOW()
    )
    RETURNING * INTO v_new_assignment;

    v_new_assignment_id := v_new_assignment.id;
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'MAX_OPERATORS_REACHED',
        'error', 'Machine ' || COALESCE(v_machine.machine_id, 'Selected machine') ||
                 ' has reached its maximum capacity of 3 active operators.'
      );
    WHEN unique_violation THEN
      -- Should not happen since we ended existing above, but safety net
      RETURN jsonb_build_object(
        'success', false,
        'code', 'ALREADY_ASSIGNED',
        'error', v_operator.full_name || ' is already assigned to another machine. End that assignment first.'
      );
  END;

  -- 6. Audit Log
  v_audit_meta := jsonb_build_object(
    'assignmentId', v_new_assignment_id,
    'machineId', p_machine_id,
    'machineCode', v_machine.machine_id,
    'operatorId', p_operator_id,
    'operatorName', v_operator.full_name,
    'shiftStart', v_shift_start,
    'shiftEnd', v_shift_end,
    'crossesMidnight', v_new_assignment.crosses_midnight,
    'previousAssignment', CASE WHEN v_existing_active.id IS NOT NULL
      THEN jsonb_build_object('id', v_existing_active.id, 'machine_id', v_existing_active.machine_id)
      ELSE NULL END,
    'notes', p_notes
  );

  INSERT INTO public.audit_logs (
    user_id, action, entity_type, entity_id, metadata, details, created_at
  )
  VALUES (
    p_assigned_by,
    'machine.operator_shift_assigned',
    'operator_machine_assignment',
    v_new_assignment_id,
    v_audit_meta,
    v_audit_meta,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_new_assignment_id,
    'machine_id', p_machine_id,
    'operator_id', p_operator_id,
    'shift_start_time', v_shift_start,
    'shift_end_time', v_shift_end,
    'previous_ended', v_existing_active.id IS NOT NULL
  );
END;
$$;

-- 5. Rewrite get_today_shift_log_monitor to use operator_machine_assignments
--    instead of machines.operator_ids × client_shift_codes Cartesian product.
--    Each operator shows ONLY for their actually assigned machine + matching shift code.
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
  -- Use authoritative operator_machine_assignments instead of machines.operator_ids
  active_assignments AS (
    SELECT oma.operator_id,
           oma.machine_id,
           oma.shift_start_time,
           oma.shift_end_time,
           m.machine_id AS machine_code,
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
      )
  ),
  -- Match each assignment to the client shift code whose time window matches
  roster AS (
    SELECT a.*,
           csc.code AS shift_code,
           csc.start_time AS shift_start,
           csc.end_time AS shift_end
    FROM active_assignments a
    JOIN public.client_shift_codes csc
      ON csc.client_id = a.client_id
     AND csc.is_active = true
     AND csc.start_time = a.shift_start_time
     AND csc.end_time = a.shift_end_time
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

GRANT EXECUTE ON FUNCTION public.get_today_shift_log_monitor(uuid, date) TO authenticated;
