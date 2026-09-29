-- ==============================================================================
-- Migration 124: Support 3-Shift Operator Machine Assignment (24h Fleet Coverage)
-- 1. Deactivate active operator assignments specifically on the 4th shift (S4)
--    and synchronize machine operator arrays.
-- 2. Remove obsolete 4th shift codes (S4) from client_shift_codes.
-- 3. Upgrade enforce_max_operators_per_machine() to allow up to 3 operators per machine
--    (supporting three 8-hour daily shifts: S1, S2, S3 for 24h fleet coverage).
-- 4. Upgrade assign_operator_machine_atomic() to handle re-saving existing active
--    assignments on the same shift as idempotent success without throwing an error,
--    and ensure v_assigned_by is guaranteed non-null.
-- ==============================================================================

-- 1. Deactivate active operator assignments specifically from the 4th shift
UPDATE public.operator_machine_assignments
SET is_active = false,
    ended_at = NOW(),
    end_reason = '4th_shift_deprecated',
    updated_at = NOW()
WHERE is_active = true 
  AND (shift_code = 'S4' OR shift_code ILIKE '%s4%' OR shift_code ILIKE '%shift 4%');

-- 2. Synchronize machines.operator_ids and current_operator_id for affected machines
UPDATE public.machines m
SET operator_ids = ARRAY(
  SELECT DISTINCT oma.operator_id
  FROM public.operator_machine_assignments oma
  WHERE oma.machine_id = m.id AND oma.is_active = true
),
current_operator_id = (
  SELECT oma.operator_id
  FROM public.operator_machine_assignments oma
  WHERE oma.machine_id = m.id AND oma.is_active = true
  ORDER BY oma.assigned_at ASC
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM public.operator_machine_assignments oma
  WHERE oma.machine_id = m.id AND oma.end_reason = '4th_shift_deprecated'
);

-- 3. Remove 4th shift code (S4) from client_shift_codes
DELETE FROM public.client_shift_codes 
WHERE code = 'S4' OR code ILIKE '%s4%' OR name ILIKE '%shift 4%' OR name ILIKE '%shift s4%';

-- 4. Upgrade enforce_max_operators_per_machine() to maximum 3 operators per machine
CREATE OR REPLACE FUNCTION public.enforce_max_operators_per_machine()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_distinct_operators INT;
  v_already_assigned BOOLEAN;
BEGIN
  IF NEW.is_active THEN
    PERFORM pg_advisory_xact_lock(hashtext('machine_cap_' || NEW.machine_id::text));

    -- Check if this operator already has another active assignment on this machine
    SELECT EXISTS (
      SELECT 1
      FROM public.operator_machine_assignments
      WHERE machine_id = NEW.machine_id
        AND operator_id = NEW.operator_id
        AND is_active = true
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) INTO v_already_assigned;

    -- Count current distinct operators excluding NEW.id
    SELECT COUNT(DISTINCT operator_id) INTO v_distinct_operators
    FROM public.operator_machine_assignments
    WHERE machine_id = NEW.machine_id 
      AND is_active = true 
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    -- Allow up to 3 distinct operators for 3-shift (8h) 24h fleet coverage
    IF NOT v_already_assigned AND v_distinct_operators >= 3 THEN
      RAISE EXCEPTION 'MAX_OPERATORS_REACHED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Upgrade assign_operator_machine_atomic()
CREATE OR REPLACE FUNCTION public.assign_operator_machine_atomic(
  p_machine_id UUID,
  p_operator_id UUID,
  p_shift_start TIME DEFAULT NULL,
  p_shift_end TIME DEFAULT NULL,
  p_assigned_by UUID DEFAULT NULL,
  p_shift_start_time TIME DEFAULT NULL,
  p_shift_end_time TIME DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_shift_code TEXT DEFAULT NULL
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
  v_shift_code TEXT;
  v_assigned_by UUID;
BEGIN
  v_shift_start := COALESCE(p_shift_start, p_shift_start_time);
  v_shift_end := COALESCE(p_shift_end, p_shift_end_time);
  v_shift_code := NULLIF(TRIM(p_shift_code), '');
  v_assigned_by := COALESCE(
    p_assigned_by,
    auth.uid(),
    (SELECT id FROM public.users WHERE role IN ('admin', 'super_admin') LIMIT 1),
    p_operator_id
  );

  IF v_shift_start IS NULL OR v_shift_end IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Both shift start and end times must be provided.');
  END IF;

  -- 1. Validate Target Machine Exists
  SELECT id, machine_id, model, serial_number, client_id
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

  -- 4. Check if operator already has an active assignment
  SELECT id, machine_id, shift_start_time, shift_end_time, shift_code INTO v_existing_active
  FROM public.operator_machine_assignments
  WHERE operator_id = p_operator_id AND is_active = true;

  IF v_existing_active.id IS NOT NULL THEN
    -- Same machine, same shift code, same timings = idempotent success (update notes if needed)
    IF v_existing_active.machine_id = p_machine_id
       AND v_existing_active.shift_start_time = v_shift_start
       AND v_existing_active.shift_end_time = v_shift_end
       AND COALESCE(v_existing_active.shift_code, '') = COALESCE(v_shift_code, '') THEN
      
      IF p_notes IS NOT NULL THEN
        UPDATE public.operator_machine_assignments
        SET updated_at = NOW()
        WHERE id = v_existing_active.id;
      END IF;

      RETURN jsonb_build_object(
        'success', true,
        'assignment_id', v_existing_active.id,
        'machine_id', p_machine_id,
        'operator_id', p_operator_id,
        'shift_code', v_shift_code,
        'shift_start_time', v_shift_start,
        'shift_end_time', v_shift_end,
        'already_active', true
      );
    END IF;

    -- Different machine or shift: end previous assignment first (reassign)
    UPDATE public.operator_machine_assignments
    SET is_active = false,
        ended_at = NOW(),
        ended_by = v_assigned_by,
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
      shift_code,
      is_active,
      assigned_by,
      assigned_at
    )
    VALUES (
      p_machine_id,
      p_operator_id,
      v_shift_start,
      v_shift_end,
      v_shift_code,
      true,
      v_assigned_by,
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
    'shiftCode', v_shift_code,
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
    v_assigned_by,
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
    'shift_code', v_shift_code,
    'shift_start_time', v_shift_start,
    'shift_end_time', v_shift_end,
    'previous_ended', v_existing_active.id IS NOT NULL
  );
END;
$$;
