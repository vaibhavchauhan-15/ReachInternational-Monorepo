-- Migration 229: Assignment window = 7 past days + today + tomorrow (IST)
-- Replaces the previous "today .. today + 7 days" planning window.
--
-- Why:
--   * Supervisors need to CORRECT recent rosters (back-dating up to 7 days), which the
--     old window rejected outright with DATE_OUT_OF_WINDOW.
--   * Long-range future planning (today + 2 .. today + 7) is removed: the only future
--     date that can be edited is TOMORROW, so the open-ended carry-forward contract
--     cannot be silently overwritten weeks ahead.
--
-- What changes:
--   1. Window enforcement in both canonical write RPCs:
--        [today_IST - 7, today_IST + 1]  (9 assignable dates) -> DATE_OUT_OF_WINDOW outside.
--   2. Range semantics stay date-scoped:
--        target = today     -> valid_to = NULL   (open carry-forward, unchanged)
--        target = any other -> valid_to = target (single-day slice)
--   3. Rosters reconciled on a PAST date no longer deactivate the whole range:
--        - the covered range is truncated to the day before the edit,
--        - an open-ended carry-forward range is re-opened the day AFTER the edit, so
--          today's and tomorrow's assignments are provably untouched,
--        - a back-dated single-day row with no log is deleted (no empty history rows).
--   4. New public.end_assignment_on_date_atomic(...) — date-aware relief used by the
--      operator-centric flows (Web action + Native modal). The legacy end_assignment_range
--      closes a WHOLE range at the effective date and would therefore erase every day
--      after a back-dated edit; the new RPC splits the range instead.
--
-- Backward compatibility:
--   * Legacy date-less wrappers from migration 228 are untouched.
--   * end_assignment_range is left in place for historical/legacy callers.
--   * No table, column, index or constraint is altered; no historical row is rewritten.

-- ==============================================================================
-- 1. Canonical date-aware single-assignment RPC (window updated)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.assign_operator_machine_on_date_atomic(
  p_machine_id uuid,
  p_operator_id uuid,
  p_shift_start time DEFAULT NULL,
  p_shift_end time DEFAULT NULL,
  p_assigned_by uuid DEFAULT NULL,
  p_shift_start_time time DEFAULT NULL,
  p_shift_end_time time DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_shift_code text DEFAULT NULL,
  p_assignment_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_machine               RECORD;
  v_operator              RECORD;
  v_assigned_by_user      RECORD;
  v_existing_same_shift   RECORD;
  v_operator_active_count INT;
  v_machine_active_count  INT;
  v_shift_conflict        RECORD;
  v_overlap_conflict      RECORD;
  v_new_assignment_id     UUID;
  v_audit_meta            JSONB;
  v_shift_start           TIME;
  v_shift_end             TIME;
  v_shift_code            TEXT;
  v_shift_code_norm       TEXT;
  v_caller_id             UUID;
  v_csc_record            RECORD;
  v_reactivate_id         UUID;
  v_today_ist             DATE;
  v_target_date           DATE;
  v_target_valid_to       DATE;
BEGIN
  v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
  v_target_date := COALESCE(p_assignment_date, v_today_ist);

  -- Canonical assignment window: 7 past days + today + tomorrow (IST) => 9 dates.
  -- Back-dating is allowed so supervisors can correct recent rosters; future planning is
  -- capped at TOMORROW so no long-range plan can overwrite the carry-forward contract.
  IF v_target_date < (v_today_ist - 7) OR v_target_date > (v_today_ist + 1) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'DATE_OUT_OF_WINDOW',
      'error', 'Assignment date must be between 7 days ago and tomorrow (IST).'
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('oma_op_' || p_operator_id::text));
  PERFORM pg_advisory_xact_lock(hashtext('oma_mach_' || p_machine_id::text));

  v_shift_start := COALESCE(p_shift_start, p_shift_start_time);
  v_shift_end   := COALESCE(p_shift_end, p_shift_end_time);
  v_shift_code  := NULLIF(TRIM(p_shift_code), '');
  v_shift_code_norm := CASE
    WHEN v_shift_code IS NOT NULL
    THEN UPPER(TRIM(REGEXP_REPLACE(v_shift_code, '^shift\s*', '', 'i')))
    ELSE NULL
  END;

  -- Caller resolution (auth.uid() wins; service_role may pass p_assigned_by)
  IF auth.uid() IS NOT NULL THEN
    v_caller_id := auth.uid();
  ELSIF (auth.role() = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role') THEN
    v_caller_id := p_assigned_by;
  ELSE
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
      'error', 'Authentication required to assign equipment.');
  END IF;

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
      'error', 'Authentication required to assign equipment.');
  END IF;

  SELECT id, machine_id, model, serial_number, client_id, current_supervisor_id, supervisor_ids, status
  INTO v_machine
  FROM public.machines
  WHERE id = p_machine_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'MACHINE_NOT_FOUND',
      'error', 'Target machine not found.');
  END IF;

  IF v_machine.status = 'decommissioned' THEN
    RETURN jsonb_build_object('success', false, 'code', 'MACHINE_DECOMMISSIONED',
      'error', 'Cannot assign operators to decommissioned machinery.');
  END IF;

  -- Resolve authoritative client shift timings
  IF v_machine.client_id IS NOT NULL AND v_shift_code IS NOT NULL THEN
    SELECT code, start_time, end_time
    INTO v_csc_record
    FROM public.client_shift_codes
    WHERE client_id = v_machine.client_id
      AND is_active = true
      AND (
        UPPER(TRIM(REGEXP_REPLACE(code, '^shift\s*', '', 'i'))) = v_shift_code_norm
        OR LOWER(TRIM(code)) = LOWER(TRIM(v_shift_code))
        OR LOWER(TRIM(name)) = LOWER(TRIM(v_shift_code))
      )
    ORDER BY display_order ASC
    LIMIT 1;

    IF v_csc_record.code IS NOT NULL THEN
      v_shift_code := v_csc_record.code;
      v_shift_code_norm := UPPER(TRIM(REGEXP_REPLACE(v_csc_record.code, '^shift\s*', '', 'i')));
      v_shift_start := v_csc_record.start_time;
      v_shift_end   := v_csc_record.end_time;
    END IF;
  END IF;

  IF v_shift_start IS NULL OR v_shift_end IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR',
      'error', 'Both shift start and end times must be provided or configured for this shift.');
  END IF;

  SELECT id, full_name, email, role, status
  INTO v_operator
  FROM public.users
  WHERE id = p_operator_id AND role = 'operator' AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'OPERATOR_NOT_FOUND',
      'error', 'Selected operator is not active or does not exist.');
  END IF;

  SELECT id, role, status INTO v_assigned_by_user
  FROM public.users WHERE id = v_caller_id;

  IF NOT FOUND OR v_assigned_by_user.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'code', 'CALLER_INACTIVE',
      'error', 'Caller user account is not active or does not exist.');
  END IF;

  IF v_assigned_by_user.role NOT IN ('super_admin', 'admin', 'manager', 'supervisor') THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN',
      'error', 'Only supervisors or above roles are permitted to assign operator shifts.');
  END IF;

  IF v_assigned_by_user.role = 'supervisor' THEN
    IF v_machine.client_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.client_supervisors cs
        JOIN public.clients c ON c.id = cs.client_id
        WHERE cs.client_id = v_machine.client_id
          AND cs.supervisor_id = v_caller_id
          AND c.deleted_at IS NULL AND c.status = 'active'
      ) THEN
        RETURN jsonb_build_object('success', false, 'code', 'CLIENT_ACCESS_DENIED',
          'error', 'Unauthorized: You are not assigned as a supervisor for the client owning this machinery.');
      END IF;
    ELSE
      IF NOT (
        v_machine.current_supervisor_id = v_caller_id
        OR (v_machine.supervisor_ids IS NOT NULL AND v_caller_id = ANY(v_machine.supervisor_ids))
      ) THEN
        RETURN jsonb_build_object('success', false, 'code', 'MACHINE_ACCESS_DENIED',
          'error', 'Unauthorized: You are not assigned to supervise this unallocated machinery.');
      END IF;
    END IF;
  END IF;

  IF v_shift_start = v_shift_end THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_SHIFT_HOURS',
      'error', 'Shift start time and end time cannot be identical.');
  END IF;

  -- Today keeps the open-ended carry-forward contract. Any other assignable date
  -- (past back-fill or tomorrow) is scoped to that single calendar date.
  v_target_valid_to := CASE WHEN v_target_date = v_today_ist THEN NULL ELSE v_target_date END;

  -- 1. Already covered for the target date? Idempotent (sync timings in place).
  SELECT id, machine_id, shift_start_time, shift_end_time, shift_code, valid_from, valid_to
  INTO v_existing_same_shift
  FROM public.operator_machine_assignments
  WHERE operator_id = p_operator_id
    AND machine_id  = p_machine_id
    AND (is_active = true OR v_target_date < v_today_ist)
    AND valid_from <= v_target_date
    AND (valid_to IS NULL OR valid_to >= v_target_date)
    AND (
      (v_shift_code_norm IS NOT NULL
        AND UPPER(TRIM(REGEXP_REPLACE(shift_code, '^shift\s*', '', 'i'))) = v_shift_code_norm)
      OR (v_shift_code_norm IS NULL AND shift_start_time = v_shift_start AND shift_end_time = v_shift_end)
    )
  LIMIT 1;

  IF v_existing_same_shift.id IS NOT NULL THEN
    UPDATE public.operator_machine_assignments
    SET shift_start_time = v_shift_start,
        shift_end_time   = v_shift_end,
        notes            = COALESCE(p_notes, notes),
        valid_to         = CASE
                             WHEN v_target_date = v_today_ist AND valid_to IS NOT NULL THEN NULL
                             ELSE valid_to
                           END,
        updated_at       = NOW()
    WHERE id = v_existing_same_shift.id;

    RETURN jsonb_build_object(
      'success',          true,
      'assignment_id',    v_existing_same_shift.id,
      'machine_id',       p_machine_id,
      'operator_id',      p_operator_id,
      'shift_code',       v_shift_code,
      'shift_start_time', v_shift_start,
      'shift_end_time',   v_shift_end,
      'valid_from',       v_existing_same_shift.valid_from,
      'valid_to',         CASE
                            WHEN v_target_date = v_today_ist AND v_existing_same_shift.valid_to IS NOT NULL THEN NULL
                            ELSE v_existing_same_shift.valid_to
                          END,
      'assignment_date',  v_target_date,
      'is_active',        true,
      'idempotent',       true
    );
  END IF;

  -- 2. Capacity + conflict validation, strictly scoped to the target date
  SELECT COUNT(*) INTO v_operator_active_count
  FROM public.operator_machine_assignments
  WHERE operator_id = p_operator_id
    AND (is_active = true OR v_target_date < v_today_ist)
    AND valid_from <= v_target_date
    AND (valid_to IS NULL OR valid_to >= v_target_date);

  IF v_operator_active_count >= 3 THEN
    RETURN jsonb_build_object('success', false, 'code', 'MAX_OPERATOR_SHIFTS_REACHED',
      'error', 'This operator is already assigned to the maximum allowed limit of 3 active shifts (24 hours) on this date.');
  END IF;

  SELECT COUNT(*) INTO v_machine_active_count
  FROM public.operator_machine_assignments
  WHERE machine_id = p_machine_id
    AND (is_active = true OR v_target_date < v_today_ist)
    AND valid_from <= v_target_date
    AND (valid_to IS NULL OR valid_to >= v_target_date);

  IF v_machine_active_count >= 3 THEN
    RETURN jsonb_build_object('success', false, 'code', 'MAX_OPERATORS_REACHED',
      'error', 'This machine already has the maximum capacity of 3 active operators assigned on this date.');
  END IF;

  SELECT oma.id, oma.machine_id, m.machine_id AS machine_code, oma.shift_code,
         oma.shift_start_time, oma.shift_end_time
  INTO v_overlap_conflict
  FROM public.operator_machine_assignments oma
  JOIN public.machines m ON m.id = oma.machine_id
  WHERE oma.operator_id = p_operator_id
    AND (oma.is_active = true OR v_target_date < v_today_ist)
    AND oma.valid_from <= v_target_date
    AND (oma.valid_to IS NULL OR oma.valid_to >= v_target_date)
    AND public.do_shifts_overlap(oma.shift_start_time, oma.shift_end_time, v_shift_start, v_shift_end)
  LIMIT 1;

  IF v_overlap_conflict.id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'SHIFT_OVERLAP_CONFLICT',
      'error', format('Operator is already assigned to machine %s (Shift %s, %s - %s) on %s.',
        v_overlap_conflict.machine_code,
        COALESCE(v_overlap_conflict.shift_code, 'assigned'),
        to_char(v_overlap_conflict.shift_start_time, 'HH12:MI AM'),
        to_char(v_overlap_conflict.shift_end_time, 'HH12:MI AM'),
        to_char(v_target_date, 'DD Mon YYYY')));
  END IF;

  SELECT oma.id, oma.operator_id, u.full_name AS operator_name, oma.shift_start_time, oma.shift_end_time
  INTO v_shift_conflict
  FROM public.operator_machine_assignments oma
  JOIN public.users u ON u.id = oma.operator_id
  WHERE oma.machine_id  = p_machine_id
    AND (oma.is_active = true OR v_target_date < v_today_ist)
    AND oma.operator_id <> p_operator_id
    AND oma.valid_from <= v_target_date
    AND (oma.valid_to IS NULL OR oma.valid_to >= v_target_date)
    AND public.do_shifts_overlap(oma.shift_start_time, oma.shift_end_time, v_shift_start, v_shift_end)
  LIMIT 1;

  IF v_shift_conflict.id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'MACHINE_SHIFT_OCCUPIED',
      'error', format('Machine is already operated by %s during this shift window (%s - %s) on %s.',
        v_shift_conflict.operator_name,
        to_char(v_shift_conflict.shift_start_time, 'HH12:MI AM'),
        to_char(v_shift_conflict.shift_end_time, 'HH12:MI AM'),
        to_char(v_target_date, 'DD Mon YYYY')));
  END IF;

  -- 3. Reuse a previously ended row that already starts on/after the target date
  SELECT id INTO v_reactivate_id
  FROM public.operator_machine_assignments
  WHERE machine_id = p_machine_id
    AND operator_id = p_operator_id
    AND is_active = false
    AND valid_from >= v_target_date
    AND valid_from <= v_target_date
    AND v_shift_code_norm IS NOT NULL
    AND UPPER(TRIM(REGEXP_REPLACE(shift_code, '^shift\s*', '', 'i'))) = v_shift_code_norm
  ORDER BY updated_at DESC
  LIMIT 1;

  IF v_reactivate_id IS NOT NULL THEN
    UPDATE public.operator_machine_assignments
    SET is_active        = true,
        valid_from       = v_target_date,
        valid_to         = v_target_valid_to,
        shift_start_time = v_shift_start,
        shift_end_time   = v_shift_end,
        shift_code       = COALESCE(v_shift_code, shift_code),
        notes            = COALESCE(p_notes, notes),
        ended_at         = NULL,
        ended_by         = NULL,
        end_reason       = NULL,
        updated_at       = NOW()
    WHERE id = v_reactivate_id
    RETURNING id INTO v_new_assignment_id;
  ELSE
    BEGIN
      INSERT INTO public.operator_machine_assignments (
        machine_id, operator_id,
        shift_start_time, shift_end_time,
        shift_code, is_active,
        assigned_by, assigned_at,
        valid_from, valid_to,
        notes,
        created_at, updated_at
      )
      VALUES (
        p_machine_id, p_operator_id,
        v_shift_start, v_shift_end,
        COALESCE(v_shift_code, v_shift_code_norm), true,
        v_caller_id, NOW(),
        v_target_date, v_target_valid_to,
        p_notes,
        NOW(), NOW()
      )
      RETURNING id INTO v_new_assignment_id;
    EXCEPTION
      WHEN SQLSTATE 'P0002' THEN
        RETURN jsonb_build_object('success', false, 'code', 'MAX_OPERATOR_SHIFTS_REACHED',
          'error', 'This operator is already assigned to 3 shifts. Maximum 3 shifts (24h) allowed per operator.');
      WHEN SQLSTATE 'P0001' THEN
        RETURN jsonb_build_object('success', false, 'code', 'MAX_OPERATORS_REACHED',
          'error', 'This machine already has the maximum capacity of 3 active operators assigned on this date.');
      WHEN SQLSTATE '23P01' THEN
        RETURN jsonb_build_object('success', false, 'code', 'SHIFT_OVERLAP_CONFLICT',
          'error', 'The selected date and shift overlap with an existing active assignment for this operator.');
      WHEN unique_violation THEN
        RETURN jsonb_build_object('success', false, 'code', 'ALREADY_ASSIGNED',
          'error', 'An assignment conflict occurred for this operator/shift/date.');
    END;
  END IF;

  v_audit_meta := jsonb_build_object(
    'assignmentId',   v_new_assignment_id,
    'machineId',      p_machine_id,
    'machineCode',    v_machine.machine_id,
    'operatorId',     p_operator_id,
    'operatorName',   v_operator.full_name,
    'shiftCode',      v_shift_code,
    'shiftStartTime', v_shift_start,
    'shiftEndTime',   v_shift_end,
    'assignmentDate', v_target_date,
    'validFrom',      v_target_date,
    'validTo',        v_target_valid_to,
    'assignedBy',     v_caller_id,
    'assignedAt',     NOW()
  );

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata, details, created_at)
  VALUES (
    v_caller_id,
    'machine.operator_assigned',
    'operator_machine_assignment',
    v_new_assignment_id,
    v_audit_meta, v_audit_meta,
    NOW()
  );

  RETURN jsonb_build_object(
    'success',          true,
    'assignment_id',    v_new_assignment_id,
    'machine_id',       p_machine_id,
    'operator_id',      p_operator_id,
    'shift_code',       v_shift_code,
    'shift_start_time', v_shift_start,
    'shift_end_time',   v_shift_end,
    'assignment_date',  v_target_date,
    'valid_from',       v_target_date,
    'valid_to',         v_target_valid_to,
    'is_active',        true,
    'assigned_by',      v_caller_id
  );
END;
$function$;

-- ==============================================================================
-- 2. Canonical date-aware roster RPC (window + past-date reconciliation)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.save_machine_roster_on_date_atomic(
  p_machine_id        UUID,
  p_operators         JSONB    DEFAULT NULL,
  p_supervisor_ids    UUID[]   DEFAULT NULL,
  p_activate_machine  BOOLEAN  DEFAULT FALSE,
  p_caller_id         UUID     DEFAULT NULL,
  p_assignment_date   DATE     DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller_id          UUID;
  v_caller_role        TEXT;
  v_machine            RECORD;
  v_today_ist          DATE;
  v_target_date        DATE;
  v_target_valid_to    DATE;
  v_op_elem            JSONB;
  v_op_id              UUID;
  v_shift_code         TEXT;
  v_shift_code_norm    TEXT;
  v_shift_start        TIME;
  v_shift_end          TIME;
  v_notes              TEXT;
  v_csc_record         RECORD;
  v_user_record        RECORD;
  v_has_log_target     BOOLEAN;
  v_close_date         DATE;
  v_keep_range_active  BOOLEAN;
  v_new_assignment_id  UUID;
  v_ended_today_id     UUID;
  v_unique_op_ids      UUID[] := '{}';
  v_final_sups         UUID[];
  v_supervisors_json   JSONB  := '[]'::jsonb;
  v_operators_json     JSONB  := '[]'::jsonb;
  v_op_count_here      INT;
  v_op_count_other     INT;
  v_other_assignment   RECORD;
  v_existing_ass       RECORD;
  v_curr               RECORD;
  v_seen_shifts        TEXT[] := '{}';
  v_normalized_ops     JSONB  := '[]'::jsonb;
  v_idx                INT;
  v_jdx                INT;
  v_op1                JSONB;
  v_op2                JSONB;
BEGIN
  -- 1. Advisory concurrency lock on the machine
  PERFORM pg_advisory_xact_lock(hashtext('oma_mach_' || p_machine_id::text));

  -- 2. Resolve caller & role
  IF auth.uid() IS NOT NULL THEN
    v_caller_id := auth.uid();
  ELSIF (auth.role() = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role') THEN
    v_caller_id := p_caller_id;
  ELSE
    v_caller_id := p_caller_id;
  END IF;

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'UNAUTHENTICATED',
      'error', 'Authentication required to update machine personnel roster.'
    );
  END IF;

  SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'supervisor') THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'FORBIDDEN',
      'error', 'Insufficient permissions: Only managers, supervisors, and admins can assign machinery personnel.'
    );
  END IF;

  -- 3. Lock machine record
  SELECT id, machine_id, model, serial_number, client_id, current_supervisor_id, supervisor_ids, status, health_status, operator_ids
  INTO v_machine
  FROM public.machines
  WHERE id = p_machine_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'MACHINE_NOT_FOUND',
      'error', 'Target machine not found.'
    );
  END IF;

  IF v_machine.status = 'decommissioned' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'MACHINE_DECOMMISSIONED',
      'error', 'Cannot assign personnel to decommissioned machinery.'
    );
  END IF;

  -- Supervisor scope validation
  IF v_caller_role = 'supervisor' THEN
    IF p_supervisor_ids IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'FORBIDDEN',
        'error', 'Permission denied: Supervisors cannot reassign machine supervisors.'
      );
    END IF;

    IF v_machine.current_supervisor_id <> v_caller_id
       AND NOT (v_machine.supervisor_ids IS NOT NULL AND v_machine.supervisor_ids @> ARRAY[v_caller_id])
       AND NOT (v_machine.client_id IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.client_supervisors cs
         WHERE cs.client_id = v_machine.client_id AND cs.supervisor_id = v_caller_id
       )) THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'FORBIDDEN',
        'error', 'Permission denied: You do not have supervisory authority over this equipment.'
      );
    END IF;
  END IF;

  v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
  v_target_date := COALESCE(p_assignment_date, v_today_ist);

  -- Canonical assignment window: 7 past days + today + tomorrow (IST) => 9 dates.
  -- Back-dating is allowed so supervisors can correct recent rosters; future planning is
  -- capped at TOMORROW so no long-range plan can overwrite the carry-forward contract.
  IF v_target_date < (v_today_ist - 7) OR v_target_date > (v_today_ist + 1) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'DATE_OUT_OF_WINDOW',
      'error', 'Assignment date must be between 7 days ago and tomorrow (IST).'
    );
  END IF;

  -- Today keeps the open-ended carry-forward contract. Any other assignable date
  -- (past back-fill or tomorrow) is scoped to that single calendar date.
  v_target_valid_to := CASE WHEN v_target_date = v_today_ist THEN NULL ELSE v_target_date END;

  -- 4. Machine status activation if requested
  IF p_activate_machine THEN
    UPDATE public.machines
    SET health_status = 'active',
        status = CASE WHEN client_id IS NOT NULL THEN 'rented' ELSE 'active' END,
        updated_at = NOW()
    WHERE id = p_machine_id;
    v_machine.health_status := 'active';
    v_machine.status := CASE WHEN v_machine.client_id IS NOT NULL THEN 'rented' ELSE 'active' END;
  END IF;

  -- 5. Machine supervisor assignment if provided
  IF p_supervisor_ids IS NOT NULL AND v_caller_role IN ('super_admin', 'admin', 'manager') THEN
    v_final_sups := p_supervisor_ids;
    UPDATE public.machines
    SET supervisor_ids = v_final_sups,
        current_supervisor_id = v_final_sups[1],
        updated_at = NOW()
    WHERE id = p_machine_id;
    v_machine.supervisor_ids := v_final_sups;
    v_machine.current_supervisor_id := v_final_sups[1];
  ELSE
    v_final_sups := v_machine.supervisor_ids;
  END IF;

  -- 6. Validate operators array length (max 3 shifts per machine)
  IF p_operators IS NOT NULL AND jsonb_typeof(p_operators) = 'array' THEN
    IF jsonb_array_length(p_operators) > 3 THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'MAX_CAPACITY_EXCEEDED',
        'error', 'A machine can have at most 3 assigned shifts for 24h fleet coverage.'
      );
    END IF;

    -- Normalize and validate each operator entry
    FOR v_op_elem IN (SELECT * FROM jsonb_array_elements(p_operators))
    LOOP
      v_op_id := COALESCE(
        NULLIF(v_op_elem->>'operatorId', '')::uuid,
        NULLIF(v_op_elem->>'operator_id', '')::uuid,
        NULLIF(v_op_elem->>'id', '')::uuid
      );

      IF v_op_id IS NULL THEN
        CONTINUE;
      END IF;

      -- Verify user is an active operator
      SELECT id, full_name, email, phone, role, status
      INTO v_user_record
      FROM public.users
      WHERE id = v_op_id;

      IF NOT FOUND OR v_user_record.role <> 'operator' OR v_user_record.status <> 'active' THEN
        RETURN jsonb_build_object(
          'success', false,
          'code', 'INVALID_OPERATOR',
          'error', 'Invalid assignment: Only active users with role "operator" can be assigned to shifts.'
        );
      END IF;

      v_shift_code := TRIM(COALESCE(v_op_elem->>'shiftCode', v_op_elem->>'shift_code', 'S1'));
      v_shift_code_norm := UPPER(TRIM(REGEXP_REPLACE(v_shift_code, '^shift\s*', '', 'i')));
      v_notes := COALESCE(v_op_elem->>'notes', 'Assigned via personnel dialog');

      -- Check duplicate shift codes on this machine
      IF v_shift_code_norm = ANY(v_seen_shifts) THEN
        RETURN jsonb_build_object(
          'success', false,
          'code', 'DUPLICATE_SHIFT_CODE',
          'error', 'Shift ' || v_shift_code || ' is assigned multiple times. Each operator assignment on this machine must have a distinct shift.'
        );
      END IF;
      v_seen_shifts := array_append(v_seen_shifts, v_shift_code_norm);

      -- Resolve authoritative client shift timings
      v_shift_start := NULL;
      v_shift_end   := NULL;

      IF v_machine.client_id IS NOT NULL THEN
        SELECT code, start_time, end_time
        INTO v_csc_record
        FROM public.client_shift_codes
        WHERE client_id = v_machine.client_id
          AND is_active = true
          AND (
            UPPER(TRIM(REGEXP_REPLACE(code, '^shift\s*', '', 'i'))) = v_shift_code_norm
            OR UPPER(TRIM(REGEXP_REPLACE(name, '^shift\s*', '', 'i'))) = v_shift_code_norm
          )
        ORDER BY display_order ASC
        LIMIT 1;

        IF v_csc_record.code IS NOT NULL THEN
          v_shift_code  := v_csc_record.code;
          v_shift_start := v_csc_record.start_time;
          v_shift_end   := v_csc_record.end_time;
        END IF;
      END IF;

      IF v_shift_start IS NULL OR v_shift_end IS NULL THEN
        IF v_op_elem->>'shiftStartTime' IS NOT NULL AND v_op_elem->>'shiftEndTime' IS NOT NULL THEN
          v_shift_start := (v_op_elem->>'shiftStartTime')::time;
          v_shift_end   := (v_op_elem->>'shiftEndTime')::time;
        ELSIF v_op_elem->>'shift_start_time' IS NOT NULL AND v_op_elem->>'shift_end_time' IS NOT NULL THEN
          v_shift_start := (v_op_elem->>'shift_start_time')::time;
          v_shift_end   := (v_op_elem->>'shift_end_time')::time;
        ELSE
          -- Fallback default shifts
          IF v_shift_code_norm IN ('S1', 'A') THEN
            v_shift_start := '06:00:00'::time;
            v_shift_end   := '14:00:00'::time;
          ELSIF v_shift_code_norm IN ('S2', 'B') THEN
            v_shift_start := '14:00:00'::time;
            v_shift_end   := '22:00:00'::time;
          ELSIF v_shift_code_norm IN ('S3', 'C') THEN
            v_shift_start := '22:00:00'::time;
            v_shift_end   := '06:00:00'::time;
          ELSE
            v_shift_start := '08:00:00'::time;
            v_shift_end   := '16:00:00'::time;
          END IF;
        END IF;
      END IF;

      IF v_shift_start = v_shift_end THEN
        RETURN jsonb_build_object(
          'success', false,
          'code', 'INVALID_SHIFT_INTERVAL',
          'error', 'Shift start and end times cannot be equal for Shift ' || v_shift_code || '.'
        );
      END IF;

      v_normalized_ops := v_normalized_ops || jsonb_build_object(
        'operatorId', v_op_id,
        'operatorName', v_user_record.full_name,
        'shiftCode', v_shift_code,
        'shiftCodeNorm', v_shift_code_norm,
        'shiftStart', v_shift_start,
        'shiftEnd', v_shift_end,
        'notes', v_notes
      );
    END LOOP;

    -- Validate internal shift overlap on this machine
    IF jsonb_array_length(v_normalized_ops) > 1 THEN
      FOR v_idx IN 0 .. (jsonb_array_length(v_normalized_ops) - 2)
      LOOP
        v_op1 := v_normalized_ops->v_idx;
        FOR v_jdx IN (v_idx + 1) .. (jsonb_array_length(v_normalized_ops) - 1)
        LOOP
          v_op2 := v_normalized_ops->v_jdx;
          IF public.do_shifts_overlap(
            (v_op1->>'shiftStart')::time, (v_op1->>'shiftEnd')::time,
            (v_op2->>'shiftStart')::time, (v_op2->>'shiftEnd')::time
          ) THEN
            RETURN jsonb_build_object(
              'success', false,
              'code', 'SHIFT_OVERLAP_CONFLICT',
              'error', 'Shift window overlapping: ' || (v_op1->>'operatorName') || '''s Shift ' || (v_op1->>'shiftCode') || ' (' || to_char((v_op1->>'shiftStart')::time, 'HH12:MI AM') || '–' || to_char((v_op1->>'shiftEnd')::time, 'HH12:MI AM') || ') overlaps with ' || (v_op2->>'operatorName') || '''s Shift ' || (v_op2->>'shiftCode') || ' (' || to_char((v_op2->>'shiftStart')::time, 'HH12:MI AM') || '–' || to_char((v_op2->>'shiftEnd')::time, 'HH12:MI AM') || ').'
            );
          END IF;
        END LOOP;
      END LOOP;
    END IF;

    -- Validate cross-fleet capacity & interval non-overlap ON THE TARGET DATE
    FOR v_op_elem IN (SELECT * FROM jsonb_array_elements(v_normalized_ops))
    LOOP
      v_op_id := (v_op_elem->>'operatorId')::uuid;
      v_shift_start := (v_op_elem->>'shiftStart')::time;
      v_shift_end := (v_op_elem->>'shiftEnd')::time;
      v_shift_code := v_op_elem->>'shiftCode';

      SELECT COUNT(*) INTO v_op_count_here
      FROM jsonb_array_elements(v_normalized_ops) elem
      WHERE (elem->>'operatorId')::uuid = v_op_id;

      SELECT COUNT(*) INTO v_op_count_other
      FROM public.operator_machine_assignments oma
      WHERE oma.operator_id = v_op_id
        AND oma.machine_id <> p_machine_id
        AND (oma.is_active = true OR v_target_date < v_today_ist)
        AND oma.valid_from <= v_target_date
        AND (oma.valid_to IS NULL OR oma.valid_to >= v_target_date);

      IF (v_op_count_here + v_op_count_other) > 3 THEN
        RETURN jsonb_build_object(
          'success', false,
          'code', 'OPERATOR_CAPACITY_EXCEEDED',
          'error', (v_op_elem->>'operatorName') || ' is already assigned to ' || v_op_count_other || ' active shift(s) on other machines on ' || to_char(v_target_date, 'DD Mon YYYY') || '. Maximum 3 shifts (24h) allowed per operator.'
        );
      END IF;

      FOR v_other_assignment IN (
        SELECT oma.shift_code, oma.shift_start_time, oma.shift_end_time, m.machine_id AS other_machine_code
        FROM public.operator_machine_assignments oma
        JOIN public.machines m ON m.id = oma.machine_id
        WHERE oma.operator_id = v_op_id
          AND oma.machine_id <> p_machine_id
          AND (oma.is_active = true OR v_target_date < v_today_ist)
          AND oma.valid_from <= v_target_date
          AND (oma.valid_to IS NULL OR oma.valid_to >= v_target_date)
      )
      LOOP
        IF public.do_shifts_overlap(
          v_shift_start, v_shift_end,
          v_other_assignment.shift_start_time, v_other_assignment.shift_end_time
        ) THEN
          RETURN jsonb_build_object(
            'success', false,
            'code', 'SHIFT_OVERLAP_CONFLICT',
            'error', format('%s''s Shift %s (%s–%s) collides with an active shift on %s (%s–%s) on %s. Please relieve them from %s for this date before assigning them to this machine.',
              v_op_elem->>'operatorName',
              v_shift_code,
              to_char(v_shift_start, 'HH12:MI AM'),
              to_char(v_shift_end, 'HH12:MI AM'),
              COALESCE(v_other_assignment.other_machine_code, 'another machine'),
              to_char(v_other_assignment.shift_start_time, 'HH12:MI AM'),
              to_char(v_other_assignment.shift_end_time, 'HH12:MI AM'),
              to_char(v_target_date, 'DD Mon YYYY'),
              COALESCE(v_other_assignment.other_machine_code, 'the other unit')
            )
          );
        END IF;
      END LOOP;
    END LOOP;

    -- 7. RECONCILIATION: Relieve assignments that no longer appear for the TARGET DATE
    FOR v_curr IN (
      SELECT id, operator_id, shift_code, shift_start_time, shift_end_time, notes, valid_from, valid_to
      FROM public.operator_machine_assignments
      WHERE machine_id = p_machine_id
        AND (is_active = true OR v_target_date < v_today_ist)
        AND valid_from <= v_target_date
        AND (valid_to IS NULL OR valid_to >= v_target_date)
    )
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_normalized_ops) elem
        WHERE (elem->>'operatorId')::uuid = v_curr.operator_id
          AND UPPER(TRIM(REGEXP_REPLACE(elem->>'shiftCode', '^shift\s*', '', 'i'))) = UPPER(TRIM(REGEXP_REPLACE(v_curr.shift_code, '^shift\s*', '', 'i')))
      ) THEN
        SELECT EXISTS (
          SELECT 1 FROM public.machine_hour_logs
          WHERE assignment_id = v_curr.id AND log_date = v_target_date
        ) INTO v_has_log_target;

        -- A planned FUTURE single-day row with no logs carries no history: remove it cleanly
        IF v_target_date > v_today_ist
           AND v_curr.valid_from >= v_target_date
           AND NOT v_has_log_target THEN
          DELETE FROM public.operator_machine_assignments WHERE id = v_curr.id;

          INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata, details, created_at)
          VALUES (
            v_caller_id,
            'assignment.planned_removed',
            'operator_machine_assignment',
            v_curr.id,
            jsonb_build_object(
              'assignmentId', v_curr.id,
              'operatorId', v_curr.operator_id,
              'machineId', p_machine_id,
              'shiftCode', v_curr.shift_code,
              'assignmentDate', v_target_date,
              'validFrom', v_curr.valid_from,
              'validTo', v_curr.valid_to,
              'endReason', 'removed'
            ),
            jsonb_build_object(
              'assignmentId', v_curr.id,
              'operatorId', v_curr.operator_id,
              'machineId', p_machine_id,
              'shiftCode', v_curr.shift_code,
              'assignmentDate', v_target_date,
              'endReason', 'removed'
            ),
            NOW()
          );
          CONTINUE;
        END IF;

        -- A back-dated single-day row with no log carries no history at all: drop it
        -- instead of leaving an empty one-day record behind.
        IF v_target_date < v_today_ist
           AND v_curr.valid_from = v_target_date
           AND v_curr.valid_to IS NOT NULL
           AND v_curr.valid_to = v_target_date
           AND NOT v_has_log_target THEN
          DELETE FROM public.operator_machine_assignments WHERE id = v_curr.id;

          INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata, details, created_at)
          VALUES (
            v_caller_id,
            'assignment.backfill_removed',
            'operator_machine_assignment',
            v_curr.id,
            jsonb_build_object(
              'assignmentId', v_curr.id,
              'operatorId', v_curr.operator_id,
              'machineId', p_machine_id,
              'shiftCode', v_curr.shift_code,
              'assignmentDate', v_target_date,
              'validFrom', v_curr.valid_from,
              'validTo', v_curr.valid_to,
              'endReason', 'removed'
            ),
            jsonb_build_object(
              'assignmentId', v_curr.id,
              'operatorId', v_curr.operator_id,
              'machineId', p_machine_id,
              'shiftCode', v_curr.shift_code,
              'assignmentDate', v_target_date,
              'endReason', 'removed'
            ),
            NOW()
          );
          CONTINUE;
        END IF;

        IF v_curr.valid_from < v_target_date AND NOT v_has_log_target THEN
          v_close_date := v_target_date - 1;
        ELSE
          v_close_date := v_target_date;
        END IF;

        -- Only TODAY's removal keeps the legacy contract of deactivating the row
        -- immediately. Past back-fill edits and future planning only truncate the range,
        -- so the row must stay active to preserve history and the remaining coverage.
        v_keep_range_active := (v_target_date <> v_today_ist AND v_close_date >= v_curr.valid_from);

        UPDATE public.operator_machine_assignments
        SET valid_to = v_close_date,
            is_active = CASE WHEN v_keep_range_active THEN true ELSE false END,
            ended_at = CASE WHEN v_keep_range_active THEN NULL ELSE NOW() END,
            ended_by = CASE WHEN v_keep_range_active THEN NULL ELSE v_caller_id END,
            end_reason = CASE WHEN v_keep_range_active THEN end_reason ELSE 'removed' END,
            updated_at = NOW()
        WHERE id = v_curr.id;

        -- Preserve the range continuation after the edited date:
        --   * bounded ranges keep their planned end date,
        --   * open-ended carry-forward ranges are re-opened the day AFTER a PAST edit so
        --     today/tomorrow coverage is never disturbed by back-dating (today's own
        --     removal still ends the carry-forward, and future planning still supersedes).
        IF (v_curr.valid_to IS NOT NULL AND v_curr.valid_to > v_target_date)
           OR (v_curr.valid_to IS NULL AND v_target_date < v_today_ist) THEN
          INSERT INTO public.operator_machine_assignments (
            machine_id, operator_id,
            shift_start_time, shift_end_time,
            shift_code, is_active,
            assigned_by, assigned_at,
            valid_from, valid_to,
            notes, created_at, updated_at
          )
          VALUES (
            p_machine_id, v_curr.operator_id,
            v_curr.shift_start_time, v_curr.shift_end_time,
            v_curr.shift_code, true,
            v_caller_id, NOW(),
            v_target_date + 1, v_curr.valid_to,
            v_curr.notes, NOW(), NOW()
          );
        END IF;

        INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata, details, created_at)
        VALUES (
          v_caller_id,
          'assignment.range_ended',
          'operator_machine_assignment',
          v_curr.id,
          jsonb_build_object(
            'assignmentId', v_curr.id,
            'operatorId', v_curr.operator_id,
            'machineId', p_machine_id,
            'shiftCode', v_curr.shift_code,
            'assignmentDate', v_target_date,
            'validFrom', v_curr.valid_from,
            'validTo', v_close_date,
            'endReason', 'removed'
          ),
          jsonb_build_object(
            'assignmentId', v_curr.id,
            'operatorId', v_curr.operator_id,
            'machineId', p_machine_id,
            'shiftCode', v_curr.shift_code,
            'assignmentDate', v_target_date,
            'validFrom', v_curr.valid_from,
            'validTo', v_close_date,
            'endReason', 'removed'
          ),
          NOW()
        );
      END IF;
    END LOOP;

    -- 8. RECONCILIATION: Activate, promote or update target assignments
    FOR v_op_elem IN (SELECT * FROM jsonb_array_elements(v_normalized_ops))
    LOOP
      v_op_id := (v_op_elem->>'operatorId')::uuid;
      v_shift_code := v_op_elem->>'shiftCode';
      v_shift_code_norm := v_op_elem->>'shiftCodeNorm';
      v_shift_start := (v_op_elem->>'shiftStart')::time;
      v_shift_end := (v_op_elem->>'shiftEnd')::time;
      v_notes := v_op_elem->>'notes';

      IF NOT (v_op_id = ANY(v_unique_op_ids)) THEN
        v_unique_op_ids := array_append(v_unique_op_ids, v_op_id);
      END IF;

      SELECT id, shift_start_time, shift_end_time, valid_to
      INTO v_existing_ass
      FROM public.operator_machine_assignments
      WHERE machine_id = p_machine_id
        AND operator_id = v_op_id
        AND UPPER(TRIM(REGEXP_REPLACE(shift_code, '^shift\s*', '', 'i'))) = v_shift_code_norm
        AND (is_active = true OR v_target_date < v_today_ist)
        AND valid_from <= v_target_date
        AND (valid_to IS NULL OR valid_to >= v_target_date)
      LIMIT 1;

      IF v_existing_ass.id IS NOT NULL THEN
        IF v_target_date = v_today_ist AND v_existing_ass.valid_to IS NOT NULL THEN
          -- Promote a single-day row to the open-ended carry-forward contract
          UPDATE public.operator_machine_assignments
          SET valid_to = NULL,
              shift_start_time = v_shift_start,
              shift_end_time = v_shift_end,
              notes = v_notes,
              updated_at = NOW()
          WHERE id = v_existing_ass.id;
        ELSIF v_existing_ass.shift_start_time <> v_shift_start OR v_existing_ass.shift_end_time <> v_shift_end THEN
          UPDATE public.operator_machine_assignments
          SET shift_start_time = v_shift_start,
              shift_end_time = v_shift_end,
              notes = v_notes,
              updated_at = NOW()
          WHERE id = v_existing_ass.id;
        END IF;
      ELSE
        -- Reuse a previously ended row that already starts on the target date
        SELECT id INTO v_ended_today_id
        FROM public.operator_machine_assignments
        WHERE machine_id = p_machine_id
          AND operator_id = v_op_id
          AND UPPER(TRIM(REGEXP_REPLACE(shift_code, '^shift\s*', '', 'i'))) = v_shift_code_norm
          AND is_active = false
          AND valid_from >= v_target_date
          AND valid_from <= v_target_date
        ORDER BY updated_at DESC
        LIMIT 1;

        IF v_ended_today_id IS NOT NULL THEN
          UPDATE public.operator_machine_assignments
          SET is_active = true,
              valid_to = v_target_valid_to,
              ended_at = NULL,
              ended_by = NULL,
              end_reason = NULL,
              shift_start_time = v_shift_start,
              shift_end_time = v_shift_end,
              shift_code = v_shift_code,
              notes = v_notes,
              updated_at = NOW()
          WHERE id = v_ended_today_id;
        ELSE
          INSERT INTO public.operator_machine_assignments (
            machine_id,
            operator_id,
            shift_code,
            shift_start_time,
            shift_end_time,
            is_active,
            assigned_by,
            assigned_at,
            valid_from,
            valid_to,
            notes,
            created_at,
            updated_at
          )
          VALUES (
            p_machine_id,
            v_op_id,
            v_shift_code,
            v_shift_start,
            v_shift_end,
            true,
            v_caller_id,
            NOW(),
            v_target_date,
            v_target_valid_to,
            v_notes,
            NOW(),
            NOW()
          )
          RETURNING id INTO v_new_assignment_id;

          INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata, details, created_at)
          VALUES (
            v_caller_id,
            'assignment.created',
            'operator_machine_assignment',
            v_new_assignment_id,
            jsonb_build_object(
              'assignmentId', v_new_assignment_id,
              'operatorId', v_op_id,
              'machineId', p_machine_id,
              'shiftCode', v_shift_code,
              'assignmentDate', v_target_date,
              'validFrom', v_target_date,
              'validTo', v_target_valid_to
            ),
            jsonb_build_object(
              'assignmentId', v_new_assignment_id,
              'operatorId', v_op_id,
              'machineId', p_machine_id,
              'shiftCode', v_shift_code,
              'assignmentDate', v_target_date,
              'validFrom', v_target_date,
              'validTo', v_target_valid_to
            ),
            NOW()
          );
        END IF;
      END IF;
    END LOOP;

    -- 9. Mirror into the legacy machine array ONLY for today's roster
    IF v_target_date = v_today_ist THEN
      UPDATE public.machines
      SET operator_ids = v_unique_op_ids,
          current_operator_id = v_unique_op_ids[1],
          updated_at = NOW()
      WHERE id = p_machine_id;
    END IF;
  ELSE
    v_unique_op_ids := v_machine.operator_ids;
  END IF;

  -- 10. Assemble and return the verified snapshot for the TARGET DATE
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', u.id,
      'assignment_id', oma.id,
      'operator_id', oma.operator_id,
      'full_name', u.full_name,
      'employee_id', u.employee_id,
      'phone', u.phone,
      'email', u.email,
      'shift_code', oma.shift_code,
      'shift_name', 'Shift ' || oma.shift_code,
      'shift_start_time', oma.shift_start_time::text,
      'shift_end_time', oma.shift_end_time::text,
      'shift_time', to_char(oma.shift_start_time, 'HH12:MI AM') || ' - ' || to_char(oma.shift_end_time, 'HH12:MI AM'),
      'valid_from', oma.valid_from,
      'valid_to', oma.valid_to,
      'role', 'operator',
      'notes', oma.notes
    )
    ORDER BY oma.shift_code
  ), '[]'::jsonb)
  INTO v_operators_json
  FROM public.operator_machine_assignments oma
  JOIN public.users u ON u.id = oma.operator_id
  WHERE oma.machine_id = p_machine_id
    AND (oma.is_active = true OR v_target_date < v_today_ist)
    AND oma.valid_from <= v_target_date
    AND (oma.valid_to IS NULL OR oma.valid_to >= v_target_date);

  IF v_final_sups IS NOT NULL AND array_length(v_final_sups, 1) > 0 THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', u.id,
        'full_name', u.full_name,
        'employee_id', u.employee_id,
        'phone', u.phone,
        'email', u.email,
        'role', u.role
      )
    ), '[]'::jsonb)
    INTO v_supervisors_json
    FROM public.users u
    WHERE u.id = ANY(v_final_sups);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'machine_id', p_machine_id,
    'assignment_date', v_target_date,
    'health_status', v_machine.health_status,
    'status', v_machine.status,
    'operator_ids', v_unique_op_ids,
    'current_operator_id', v_unique_op_ids[1],
    'operators', v_operators_json,
    'supervisor_ids', v_final_sups,
    'current_supervisor_id', v_final_sups[1],
    'supervisors', v_supervisors_json
  );

EXCEPTION
  WHEN SQLSTATE '23P01' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'SHIFT_OVERLAP_CONFLICT',
      'error', 'Shift window overlapping error: The selected shift timings overlap with an existing active assignment for this operator on this date.'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', SQLSTATE,
      'error', SQLERRM
    );
END;
$function$;

-- ==============================================================================
-- 3. Date-aware relief: split an assignment range around one edited date
-- ==============================================================================
-- Drop the earlier 5-argument overload so PostgREST never sees two candidates.
DROP FUNCTION IF EXISTS public.end_assignment_on_date_atomic(uuid, date, uuid, text, text);
CREATE OR REPLACE FUNCTION public.end_assignment_on_date_atomic(
  p_assignment_id uuid,
  p_effective_date date DEFAULT NULL,
  p_caller_id uuid DEFAULT NULL,
  p_end_reason text DEFAULT 'removed',
  p_notes text DEFAULT NULL,
  -- When false the range is closed at the edited date without re-opening a continuation
  -- (used for shift-timing changes, where the caller immediately writes the new range).
  p_reopen_continuation boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_assignment      RECORD;
  v_caller_id       UUID;
  v_caller_role     TEXT;
  v_today_ist       DATE;
  v_target_date     DATE;
  v_close_date      DATE;
  v_has_log_target  BOOLEAN := false;
  v_continuation_id UUID;
  v_keep_active     BOOLEAN;
BEGIN
  v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;

  -- Caller resolution (auth.uid() wins; service_role may pass p_caller_id)
  IF auth.uid() IS NOT NULL THEN
    v_caller_id := auth.uid();
  ELSIF (auth.role() = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role') THEN
    v_caller_id := p_caller_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
      'error', 'Authentication required to relieve an operator.');
  END IF;

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
      'error', 'Authentication required to relieve an operator.');
  END IF;

  SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id AND status = 'active';
  IF v_caller_role IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'CALLER_INACTIVE',
      'error', 'Caller user account is not active or does not exist.');
  END IF;
  IF v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'supervisor') THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN',
      'error', 'Only supervisors or above roles are permitted to relieve operator shifts.');
  END IF;

  SELECT id, operator_id, machine_id, shift_code, shift_start_time, shift_end_time,
         valid_from, valid_to, is_active, notes
  INTO v_assignment
  FROM public.operator_machine_assignments
  WHERE id = p_assignment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND',
      'error', 'Assignment not found.');
  END IF;

  -- The legacy sync trigger force-deactivates any row whose valid_to < today, so past
  -- slices arrive here already inactive: only truly finished ranges are rejected.
  IF v_assignment.is_active = false
     AND v_assignment.valid_to IS NOT NULL
     AND (COALESCE(p_effective_date, v_today_ist) > v_assignment.valid_to) THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_ENDED',
      'error', 'Assignment range is already closed.');
  END IF;

  v_target_date := COALESCE(p_effective_date, v_today_ist);

  IF v_target_date < (v_today_ist - 7) OR v_target_date > (v_today_ist + 1) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'DATE_OUT_OF_WINDOW',
      'error', 'Assignment date must be between 7 days ago and tomorrow (IST).'
    );
  END IF;

  IF v_target_date < v_assignment.valid_from THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_END_DATE',
      'error', format('Effective date (%s) cannot be before the assignment start (%s).',
        v_target_date, v_assignment.valid_from));
  END IF;

  IF v_assignment.valid_to IS NOT NULL AND v_target_date > v_assignment.valid_to THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_ENDED',
      'error', 'Assignment range does not cover the requested date.');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('oma_mach_' || v_assignment.machine_id::text));

  SELECT EXISTS (
    SELECT 1 FROM public.machine_hour_logs
    WHERE assignment_id = v_assignment.id AND log_date = v_target_date
  ) INTO v_has_log_target;

  -- A single-day slice that starts on the edited date: relieve the whole slice.
  IF v_assignment.valid_from = v_target_date THEN
    IF v_target_date <> v_today_ist AND NOT v_has_log_target THEN
      DELETE FROM public.operator_machine_assignments WHERE id = v_assignment.id;

      INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata, details, created_at)
      VALUES (
        v_caller_id, 'assignment.planned_removed', 'operator_machine_assignment', v_assignment.id,
        jsonb_build_object('assignmentId', v_assignment.id, 'operatorId', v_assignment.operator_id,
          'machineId', v_assignment.machine_id, 'shiftCode', v_assignment.shift_code,
          'assignmentDate', v_target_date, 'endReason', p_end_reason),
        jsonb_build_object('assignmentId', v_assignment.id, 'operatorId', v_assignment.operator_id,
          'machineId', v_assignment.machine_id, 'shiftCode', v_assignment.shift_code,
          'assignmentDate', v_target_date, 'endReason', p_end_reason),
        NOW()
      );

      RETURN jsonb_build_object('success', true, 'deleted', true,
        'assignment_date', v_target_date, 'valid_to', v_target_date);
    END IF;

    UPDATE public.operator_machine_assignments
    SET valid_to   = v_target_date,
        is_active  = false,
        ended_at   = NOW(),
        ended_by   = v_caller_id,
        end_reason = p_end_reason,
        notes      = COALESCE(p_notes, notes),
        updated_at = NOW()
    WHERE id = v_assignment.id;

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata, details, created_at)
    VALUES (
      v_caller_id, 'assignment.range_ended', 'operator_machine_assignment', v_assignment.id,
      jsonb_build_object('assignmentId', v_assignment.id, 'operatorId', v_assignment.operator_id,
        'machineId', v_assignment.machine_id, 'shiftCode', v_assignment.shift_code,
        'assignmentDate', v_target_date, 'validFrom', v_assignment.valid_from,
        'validTo', v_target_date, 'endReason', p_end_reason),
      jsonb_build_object('assignmentId', v_assignment.id, 'operatorId', v_assignment.operator_id,
        'machineId', v_assignment.machine_id, 'shiftCode', v_assignment.shift_code,
        'assignmentDate', v_target_date, 'endReason', p_end_reason),
      NOW()
    );

    RETURN jsonb_build_object('success', true, 'deleted', false,
      'assignment_date', v_target_date, 'valid_to', v_target_date);
  END IF;

  -- Multi-day / open-ended range that covers the edited date: split it.
  v_close_date := CASE WHEN v_has_log_target THEN v_target_date ELSE v_target_date - 1 END;
  v_keep_active := (v_target_date <> v_today_ist AND v_close_date >= v_assignment.valid_from);

  UPDATE public.operator_machine_assignments
  SET valid_to   = v_close_date,
      is_active  = v_keep_active,
      ended_at   = CASE WHEN v_keep_active THEN NULL ELSE NOW() END,
      ended_by   = CASE WHEN v_keep_active THEN NULL ELSE v_caller_id END,
      end_reason = CASE WHEN v_keep_active THEN end_reason ELSE p_end_reason END,
      updated_at = NOW()
  WHERE id = v_assignment.id;

  -- Re-open the continuation the day AFTER the edited date (keeps today/tomorrow intact).
  -- Today's own relief intentionally ends the carry-forward (product contract).
  IF p_reopen_continuation
     AND v_target_date <> v_today_ist
     AND (v_assignment.valid_to IS NULL OR v_assignment.valid_to > v_target_date) THEN
    INSERT INTO public.operator_machine_assignments (
      machine_id, operator_id, shift_code, shift_start_time, shift_end_time,
      is_active, assigned_by, assigned_at, valid_from, valid_to, notes, created_at, updated_at
    )
    VALUES (
      v_assignment.machine_id, v_assignment.operator_id, v_assignment.shift_code,
      v_assignment.shift_start_time, v_assignment.shift_end_time,
      true, v_caller_id, NOW(), v_target_date + 1, v_assignment.valid_to,
      v_assignment.notes, NOW(), NOW()
    )
    RETURNING id INTO v_continuation_id;
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata, details, created_at)
  VALUES (
    v_caller_id, 'assignment.range_ended', 'operator_machine_assignment', v_assignment.id,
    jsonb_build_object('assignmentId', v_assignment.id, 'operatorId', v_assignment.operator_id,
      'machineId', v_assignment.machine_id, 'shiftCode', v_assignment.shift_code,
      'assignmentDate', v_target_date, 'validFrom', v_assignment.valid_from,
      'validTo', v_close_date, 'continuationId', v_continuation_id, 'endReason', p_end_reason),
    jsonb_build_object('assignmentId', v_assignment.id, 'operatorId', v_assignment.operator_id,
      'machineId', v_assignment.machine_id, 'shiftCode', v_assignment.shift_code,
      'assignmentDate', v_target_date, 'endReason', p_end_reason),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'deleted', false,
    'assignment_date', v_target_date,
    'valid_to', v_close_date,
    'continuation_id', v_continuation_id
  );
END;
$function$;

-- Schema cache refresh for PostgREST
NOTIFY pgrst, 'reload schema';
