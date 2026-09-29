-- ==============================================================================
-- Migration 128: Prevent Operator Overlapping Machine Assignments
-- Upgrade assign_operator_machine_atomic() to validate if an operator is already
-- actively assigned to ANOTHER machine during an overlapping shift window.
-- If overlapping, immediately rejects with a concise, actionable error message.
-- If non-overlapping, permits safe reassignment without collision.
-- ==============================================================================

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
  v_other_assignment RECORD;
  v_shift_conflict RECORD;
  v_overlap_conflict RECORD;
  v_current_op_count INT;
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
    RETURN jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR', 'error', 'Both shift start and end times must be provided.');
  END IF;

  -- 1. Validate Target Machine Exists
  SELECT id, machine_id, model, serial_number, client_id
  INTO v_machine
  FROM public.machines
  WHERE id = p_machine_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'MACHINE_NOT_FOUND', 'error', 'Target machine not found.');
  END IF;

  -- 2. Validate Operator Exists & Is Active
  SELECT id, full_name, email, role, status
  INTO v_operator
  FROM public.users
  WHERE id = p_operator_id AND role = 'operator' AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'OPERATOR_NOT_FOUND', 'error', 'Selected operator is not active or does not exist.');
  END IF;

  -- 3. Validate Shift Timings
  IF v_shift_start = v_shift_end THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_SHIFT_HOURS', 'error', 'Shift start time and end time cannot be identical.');
  END IF;

  -- 4. Check if the same operator is already active on this machine
  SELECT id, machine_id, shift_start_time, shift_end_time, shift_code INTO v_existing_active
  FROM public.operator_machine_assignments
  WHERE operator_id = p_operator_id AND machine_id = p_machine_id AND is_active = true;

  IF v_existing_active.id IS NOT NULL THEN
    -- If exact same shift code and timings, idempotent success
    IF v_existing_active.shift_start_time = v_shift_start
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
  END IF;

  -- 5. Shift Code Collision Check: Another operator on this machine cannot have the same shift code
  IF v_shift_code IS NOT NULL THEN
    SELECT oma.operator_id, u.full_name, oma.shift_code
    INTO v_shift_conflict
    FROM public.operator_machine_assignments oma
    JOIN public.users u ON u.id = oma.operator_id
    WHERE oma.machine_id = p_machine_id
      AND oma.is_active = true
      AND oma.operator_id <> p_operator_id
      AND LOWER(TRIM(oma.shift_code)) = LOWER(TRIM(v_shift_code))
    LIMIT 1;

    IF v_shift_conflict.operator_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'SHIFT_CODE_CONFLICT',
        'error', 'Shift ' || v_shift_code || ' is already assigned to ' || v_shift_conflict.full_name || ' on machine ' || COALESCE(v_machine.machine_id, '') || '. Each operator must be assigned to a different shift.'
      );
    END IF;
  END IF;

  -- 6. Shift Window Overlap Check on the Same Machine
  SELECT oma.operator_id, u.full_name, oma.shift_code, oma.shift_start_time, oma.shift_end_time
  INTO v_overlap_conflict
  FROM public.operator_shift_ranges osr
  JOIN public.operator_machine_assignments oma ON oma.id = osr.assignment_id
  JOIN public.users u ON u.id = oma.operator_id
  WHERE oma.machine_id = p_machine_id
    AND oma.is_active = true
    AND oma.operator_id <> p_operator_id
    AND osr.minute_range && ANY(public.shift_to_ranges(v_shift_start, v_shift_end))
  LIMIT 1;

  IF v_overlap_conflict.operator_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'SHIFT_OVERLAP_CONFLICT',
      'error', 'Shift window overlapping: Requested shift (' || v_shift_start::text || ' – ' || v_shift_end::text || ') overlaps with ' || v_overlap_conflict.full_name || '''s Shift ' || COALESCE(v_overlap_conflict.shift_code, '') || ' (' || v_overlap_conflict.shift_start_time::text || ' – ' || v_overlap_conflict.shift_end_time::text || ') on machine ' || COALESCE(v_machine.machine_id, '') || '.'
    );
  END IF;

  -- 7. Capacity Check: Maximum 3 distinct operators per machine
  SELECT COUNT(DISTINCT operator_id) INTO v_current_op_count
  FROM public.operator_machine_assignments
  WHERE machine_id = p_machine_id
    AND is_active = true
    AND operator_id <> p_operator_id;

  IF v_current_op_count >= 3 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'MAX_OPERATORS_REACHED',
      'error', 'Machine ' || COALESCE(v_machine.machine_id, 'Selected machine') || ' has reached its maximum capacity of 3 active operators.'
    );
  END IF;

  -- 8. Other Machine Assignment & Overlap Check
  SELECT oma.id, oma.machine_id, m.machine_id AS other_machine_code, oma.shift_code, oma.shift_start_time, oma.shift_end_time
  INTO v_other_assignment
  FROM public.operator_machine_assignments oma
  JOIN public.machines m ON m.id = oma.machine_id
  WHERE oma.operator_id = p_operator_id
    AND oma.is_active = true
    AND oma.machine_id <> p_machine_id;

  IF v_other_assignment.id IS NOT NULL THEN
    -- Check if the requested shift window overlaps with the active assignment on the other machine
    IF EXISTS (
      SELECT 1 FROM public.operator_shift_ranges osr
      WHERE osr.assignment_id = v_other_assignment.id
        AND osr.is_active = true
        AND osr.minute_range && ANY(public.shift_to_ranges(v_shift_start, v_shift_end))
    ) THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'OPERATOR_ALREADY_ASSIGNED_OTHER_MACHINE',
        'error', COALESCE(v_operator.full_name, 'Operator') || ' is already assigned to ' || COALESCE(v_other_assignment.other_machine_code, 'another machine') || ' (' || to_char(v_other_assignment.shift_start_time, 'HH12:MI AM') || ' – ' || to_char(v_other_assignment.shift_end_time, 'HH12:MI AM') || ').'
      );
    END IF;

    -- If non-overlapping, safely end the prior assignment
    UPDATE public.operator_machine_assignments
    SET is_active = false,
        ended_at = NOW(),
        ended_by = v_assigned_by,
        end_reason = 'reassigned',
        updated_at = NOW()
    WHERE id = v_other_assignment.id;
  END IF;

  -- If operator was active on this machine with a different shift/time, end previous
  IF v_existing_active.id IS NOT NULL THEN
    UPDATE public.operator_machine_assignments
    SET is_active = false,
        ended_at = NOW(),
        ended_by = v_assigned_by,
        end_reason = 'shift_changed',
        updated_at = NOW()
    WHERE id = v_existing_active.id;
  END IF;

  -- 9. Insert new assignment
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
    WHEN SQLSTATE '23P01' THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'SHIFT_OVERLAP_CONFLICT',
        'error', 'Shift window overlapping error: The selected shift timings overlap with an existing active assignment.'
      );
    WHEN SQLSTATE 'P0001' THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'MAX_OPERATORS_REACHED',
        'error', 'Machine ' || COALESCE(v_machine.machine_id, 'Selected machine') || ' has reached its maximum capacity of 3 active operators.'
      );
    WHEN unique_violation THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'ALREADY_ASSIGNED',
        'error', 'An assignment conflict occurred for this operator/shift. Please verify existing active shifts.'
      );
  END;

  -- 10. Audit Log
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
    'previous_ended', v_existing_active.id IS NOT NULL OR v_other_assignment.id IS NOT NULL
  );
END;
$$;
