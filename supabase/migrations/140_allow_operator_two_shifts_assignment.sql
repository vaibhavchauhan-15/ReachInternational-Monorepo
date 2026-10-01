-- ==============================================================================
-- Migration 140: Allow Operator Up To Two Shifts Assignment (Max 2 Shifts Only)
--
-- Business Context:
-- In some client sites, an operator works on up to two shifts (e.g., Morning + Evening,
-- or across two machines). Supervisor or above roles (supervisor, manager, admin, super_admin)
-- can assign an operator to up to two shifts only (maximum 2 shifts per operator).
--
-- Technical Changes:
-- 1. Drop unique index public.idx_oma_one_active_per_operator which strictly limited
--    an operator to a single active assignment.
-- 2. Create trigger function public.enforce_max_shifts_per_operator() to enforce
--    that an operator cannot have more than 2 active assignments at any time.
-- 3. Upgrade sync_machine_assigned_operators() to aggregate DISTINCT operator IDs,
--    preventing duplicate entries in machines.operator_ids when an operator covers
--    two shifts on the same machine.
-- 4. Upgrade assign_operator_machine_atomic() RPC to:
--    - Verify caller has supervisor or above role.
--    - Allow an operator to hold up to 2 active shifts (same machine or different machines).
--    - Reject 3rd shift assignment with MAX_OPERATOR_SHIFTS_REACHED.
--    - Verify shift timings do not overlap across any of the operator's active shifts.
--    - Preserve existing active shift when adding a second non-overlapping shift.
--    - Enforce machine capacity (max 3 shifts per machine for 24h fleet coverage).
-- ==============================================================================

-- 1. Drop the legacy 1-shift-per-operator unique partial index
DROP INDEX IF EXISTS public.idx_oma_one_active_per_operator;

-- 2. Create trigger function to enforce maximum 2 active shifts per operator
CREATE OR REPLACE FUNCTION public.enforce_max_shifts_per_operator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_active_count INT;
BEGIN
  IF NEW.is_active THEN
    PERFORM pg_advisory_xact_lock(hashtext('op_shifts_' || NEW.operator_id::text));

    SELECT COUNT(*)
    INTO v_active_count
    FROM public.operator_machine_assignments
    WHERE operator_id = NEW.operator_id
      AND is_active = true
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    IF v_active_count >= 2 THEN
      RAISE EXCEPTION 'MAX_OPERATOR_SHIFTS_REACHED: Operator cannot be assigned to more than 2 active shifts (maximum 2 shifts allowed).'
        USING ERRCODE = 'P0002';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_max_shifts_per_operator ON public.operator_machine_assignments;
CREATE TRIGGER trg_enforce_max_shifts_per_operator
  BEFORE INSERT OR UPDATE OF is_active, operator_id ON public.operator_machine_assignments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_max_shifts_per_operator();

-- 3. Upgrade sync_machine_assigned_operators() to aggregate DISTINCT operator IDs
CREATE OR REPLACE FUNCTION public.sync_machine_assigned_operators()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_machine_id UUID;
  v_op_ids UUID[];
BEGIN
  v_machine_id := COALESCE(NEW.machine_id, OLD.machine_id);

  SELECT COALESCE(array_agg(operator_id ORDER BY min_assigned_at ASC), '{}')
  INTO v_op_ids
  FROM (
    SELECT operator_id, MIN(assigned_at) AS min_assigned_at
    FROM public.operator_machine_assignments
    WHERE machine_id = v_machine_id AND is_active = true
    GROUP BY operator_id
  ) sub;

  UPDATE public.machines
  SET operator_ids = v_op_ids,
      current_operator_id = CASE WHEN cardinality(v_op_ids) > 0 THEN v_op_ids[1] ELSE NULL END,
      updated_at = NOW()
  WHERE id = v_machine_id;

  RETURN NULL;
END;
$$;

-- 4. Upgrade canonical assign_operator_machine_atomic() RPC to support up to 2 shifts per operator
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
  v_assigned_by_user RECORD;
  v_existing_same_shift RECORD;
  v_operator_active_count INT;
  v_machine_active_count INT;
  v_shift_conflict RECORD;
  v_overlap_conflict RECORD;
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

  -- 3. Authorization Check: Assigned by must be supervisor or above role
  SELECT id, role INTO v_assigned_by_user
  FROM public.users
  WHERE id = v_assigned_by;

  IF v_assigned_by_user.id IS NOT NULL AND v_assigned_by_user.role NOT IN ('super_admin', 'admin', 'manager', 'supervisor') THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN', 'error', 'Only supervisors or above roles (supervisor, manager, admin, super_admin) are permitted to assign operator shifts.');
  END IF;

  -- 4. Validate Shift Timings
  IF v_shift_start = v_shift_end THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_SHIFT_HOURS', 'error', 'Shift start time and end time cannot be identical.');
  END IF;

  -- 5. Check if the exact same assignment on this machine with this shift code already exists
  SELECT id, machine_id, shift_start_time, shift_end_time, shift_code
  INTO v_existing_same_shift
  FROM public.operator_machine_assignments
  WHERE operator_id = p_operator_id
    AND machine_id = p_machine_id
    AND is_active = true
    AND (
      (v_shift_code IS NOT NULL AND LOWER(TRIM(shift_code)) = LOWER(TRIM(v_shift_code)))
      OR (v_shift_code IS NULL AND shift_start_time = v_shift_start AND shift_end_time = v_shift_end)
    )
  LIMIT 1;

  IF v_existing_same_shift.id IS NOT NULL THEN
    -- If timings match, idempotent success
    IF v_existing_same_shift.shift_start_time = v_shift_start
       AND v_existing_same_shift.shift_end_time = v_shift_end THEN
      UPDATE public.operator_machine_assignments
      SET updated_at = NOW()
      WHERE id = v_existing_same_shift.id;

      RETURN jsonb_build_object(
        'success', true,
        'assignment_id', v_existing_same_shift.id,
        'machine_id', p_machine_id,
        'operator_id', p_operator_id,
        'shift_code', v_shift_code,
        'shift_start_time', v_shift_start,
        'shift_end_time', v_shift_end,
        'already_active', true
      );
    ELSE
      -- Deactivate old timing record so the updated timings can be inserted cleanly
      UPDATE public.operator_machine_assignments
      SET is_active = false,
          ended_at = NOW(),
          ended_by = v_assigned_by,
          end_reason = 'shift_changed',
          updated_at = NOW()
      WHERE id = v_existing_same_shift.id;
    END IF;
  END IF;

  -- 6. Operator Capacity Check: Maximum 2 active shifts allowed across entire platform
  SELECT COUNT(*)
  INTO v_operator_active_count
  FROM public.operator_machine_assignments
  WHERE operator_id = p_operator_id
    AND is_active = true
    AND (v_existing_same_shift.id IS NULL OR id <> v_existing_same_shift.id);

  IF v_operator_active_count >= 2 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'MAX_OPERATOR_SHIFTS_REACHED',
      'error', COALESCE(v_operator.full_name, 'Operator') || ' is already assigned to 2 shifts. An operator can be assigned to a maximum of 2 shifts only.'
    );
  END IF;

  -- 7. Operator Self Shift Overlap Check (Cannot overlap with other active shifts for this operator)
  SELECT oma.id, oma.machine_id, m.machine_id AS other_machine_code, oma.shift_code, oma.shift_start_time, oma.shift_end_time
  INTO v_overlap_conflict
  FROM public.operator_shift_ranges osr
  JOIN public.operator_machine_assignments oma ON oma.id = osr.assignment_id
  JOIN public.machines m ON m.id = oma.machine_id
  WHERE oma.operator_id = p_operator_id
    AND oma.is_active = true
    AND (v_existing_same_shift.id IS NULL OR oma.id <> v_existing_same_shift.id)
    AND osr.minute_range && ANY(public.shift_to_ranges(v_shift_start, v_shift_end))
  LIMIT 1;

  IF v_overlap_conflict.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'SHIFT_OVERLAP_CONFLICT',
      'error', 'Shift window collision: Requested shift (' || to_char(v_shift_start, 'HH12:MI AM') || ' – ' || to_char(v_shift_end, 'HH12:MI AM') || ') overlaps with ' || COALESCE(v_operator.full_name, 'this operator') || '''s existing Shift ' || COALESCE(v_overlap_conflict.shift_code, '') || ' on ' || COALESCE(v_overlap_conflict.other_machine_code, 'machine') || ' (' || to_char(v_overlap_conflict.shift_start_time, 'HH12:MI AM') || ' – ' || to_char(v_overlap_conflict.shift_end_time, 'HH12:MI AM') || ').'
    );
  END IF;

  -- 8. Machine Shift Code Collision Check: Another operator on this machine cannot have the same shift code
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

  -- 9. Machine Shift Window Overlap Check (Cannot overlap with any other active shift on this machine)
  SELECT oma.operator_id, u.full_name, oma.shift_code, oma.shift_start_time, oma.shift_end_time
  INTO v_overlap_conflict
  FROM public.operator_shift_ranges osr
  JOIN public.operator_machine_assignments oma ON oma.id = osr.assignment_id
  JOIN public.users u ON u.id = oma.operator_id
  WHERE oma.machine_id = p_machine_id
    AND oma.is_active = true
    AND (v_existing_same_shift.id IS NULL OR oma.id <> v_existing_same_shift.id)
    AND osr.minute_range && ANY(public.shift_to_ranges(v_shift_start, v_shift_end))
  LIMIT 1;

  IF v_overlap_conflict.operator_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'SHIFT_OVERLAP_CONFLICT',
      'error', 'Shift window overlapping on machine ' || COALESCE(v_machine.machine_id, '') || ': Requested shift (' || to_char(v_shift_start, 'HH12:MI AM') || ' – ' || to_char(v_shift_end, 'HH12:MI AM') || ') overlaps with ' || v_overlap_conflict.full_name || '''s Shift ' || COALESCE(v_overlap_conflict.shift_code, '') || ' (' || to_char(v_overlap_conflict.shift_start_time, 'HH12:MI AM') || ' – ' || to_char(v_overlap_conflict.shift_end_time, 'HH12:MI AM') || ').'
    );
  END IF;

  -- 10. Machine Capacity Check: Maximum 3 active shifts per machine (24h coverage)
  SELECT COUNT(*)
  INTO v_machine_active_count
  FROM public.operator_machine_assignments
  WHERE machine_id = p_machine_id
    AND is_active = true
    AND (v_existing_same_shift.id IS NULL OR id <> v_existing_same_shift.id);

  IF v_machine_active_count >= 3 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'MAX_OPERATORS_REACHED',
      'error', 'Machine ' || COALESCE(v_machine.machine_id, 'Selected machine') || ' has reached its maximum capacity of 3 active shifts.'
    );
  END IF;

  -- 11. Insert new assignment (Advisory lock acquired via enforce_max_shifts_per_operator trigger)
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
    WHEN SQLSTATE 'P0002' THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'MAX_OPERATOR_SHIFTS_REACHED',
        'error', COALESCE(v_operator.full_name, 'Operator') || ' is already assigned to 2 shifts. Maximum 2 shifts allowed per operator.'
      );
    WHEN SQLSTATE 'P0001' THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'MAX_OPERATORS_REACHED',
        'error', 'Machine ' || COALESCE(v_machine.machine_id, 'Selected machine') || ' has reached its maximum capacity of 3 active shifts.'
      );
    WHEN SQLSTATE '23P01' THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'SHIFT_OVERLAP_CONFLICT',
        'error', 'Shift window overlapping error: The selected shift timings overlap with an existing active assignment.'
      );
    WHEN unique_violation THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'ALREADY_ASSIGNED',
        'error', 'An assignment conflict occurred for this operator/shift. Please verify existing active shifts.'
      );
  END;

  -- 12. Audit Log
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
    'shift_end_time', v_shift_end
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_operator_machine_atomic(
  UUID, UUID, TIME, TIME, UUID, TIME, TIME, TEXT, TEXT
) TO authenticated, service_role;
