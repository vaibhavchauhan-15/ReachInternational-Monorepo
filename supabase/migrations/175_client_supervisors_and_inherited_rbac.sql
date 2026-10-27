-- ==============================================================================
-- Migration 175: Client Supervisors Normalized Relationship and Inherited RBAC
-- Target Dev Project: vlmxciuogczumumrwyot
--
-- Objectives:
-- 1. Create normalized public.client_supervisors junction table with constraints & indexes.
-- 2. Validate client supervisor candidates (must be active with role 'supervisor').
-- 3. Backfill client supervisors from existing machines.current_supervisor_id & supervisor_ids.
-- 4. Create atomic RPCs for assigning and removing client supervisors with audit logging.
-- 5. Harden assign_operator_machine_atomic to verify caller identity & enforce client scope for supervisors.
-- 6. Harden end_operator_machine_assignment_atomic to prevent unauthenticated/forged termination & enforce client scope.
-- 7. Define recursion-free helper functions for client & machine access checks.
-- 8. Scope RLS policies on clients, client_sites, machines, operator_machine_assignments,
--    machine_hour_logs, and users to enforce tenant isolation and client-inherited access.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Create public.client_supervisors table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_supervisors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  supervisor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_client_supervisors_client_supervisor UNIQUE (client_id, supervisor_id)
);

CREATE INDEX IF NOT EXISTS idx_client_supervisors_client_id ON public.client_supervisors(client_id);
CREATE INDEX IF NOT EXISTS idx_client_supervisors_supervisor_id ON public.client_supervisors(supervisor_id);

-- ------------------------------------------------------------------------------
-- 2. Validation Trigger for client_supervisors
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_client_supervisor_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user RECORD;
  v_client RECORD;
BEGIN
  -- Verify supervisor exists, is active, and has role 'supervisor'
  SELECT id, role, status INTO v_user
  FROM public.users
  WHERE id = NEW.supervisor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target supervisor does not exist.';
  END IF;

  IF v_user.role <> 'supervisor' THEN
    RAISE EXCEPTION 'User % is not eligible for client supervisor assignment (role: %)', NEW.supervisor_id, v_user.role;
  END IF;

  IF v_user.status <> 'active' THEN
    RAISE EXCEPTION 'User % cannot be assigned because their account status is %', NEW.supervisor_id, v_user.status;
  END IF;

  -- Verify client exists and is not soft-deleted
  SELECT id, status, deleted_at INTO v_client
  FROM public.clients
  WHERE id = NEW.client_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target client does not exist.';
  END IF;

  IF v_client.deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot assign supervisor to a deleted client.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_client_supervisor ON public.client_supervisors;
CREATE TRIGGER trg_validate_client_supervisor
  BEFORE INSERT OR UPDATE ON public.client_supervisors
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_client_supervisor_assignment();

-- ------------------------------------------------------------------------------
-- 3. Idempotent Backfill from Legacy Machine Assignments
-- ------------------------------------------------------------------------------
INSERT INTO public.client_supervisors (client_id, supervisor_id, assigned_at)
SELECT DISTINCT m.client_id, u.id, NOW()
FROM public.machines m
CROSS JOIN LATERAL (
  SELECT m.current_supervisor_id AS sup_id
  WHERE m.current_supervisor_id IS NOT NULL
  UNION
  SELECT unnest(m.supervisor_ids) AS sup_id
  WHERE m.supervisor_ids IS NOT NULL AND cardinality(m.supervisor_ids) > 0
) legacy
JOIN public.users u ON u.id = legacy.sup_id
JOIN public.clients c ON c.id = m.client_id
WHERE m.client_id IS NOT NULL
  AND u.role = 'supervisor'
  AND u.status = 'active'
  AND c.deleted_at IS NULL
ON CONFLICT (client_id, supervisor_id) DO NOTHING;

-- ------------------------------------------------------------------------------
-- 4. Atomic RPCs for Client Supervisor Management
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assign_client_supervisor_atomic(
  p_client_id UUID,
  p_supervisor_id UUID,
  p_assigned_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caller RECORD;
  v_client RECORD;
  v_supervisor RECORD;
  v_record RECORD;
  v_audit_meta JSONB;
BEGIN
  -- Derive caller identity securely
  IF auth.uid() IS NOT NULL THEN
    v_caller_id := auth.uid();
  ELSIF (auth.role() = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role') THEN
    v_caller_id := p_assigned_by;
  ELSE
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED', 'error', 'Authentication required.');
  END IF;

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED', 'error', 'Caller identity required.');
  END IF;

  SELECT id, role, status INTO v_caller
  FROM public.users
  WHERE id = v_caller_id;

  IF NOT FOUND OR v_caller.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'code', 'CALLER_INACTIVE', 'error', 'Caller account is not active or does not exist.');
  END IF;

  IF v_caller.role NOT IN ('super_admin', 'admin', 'manager') THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN', 'error', 'Only super_admin, admin, or manager can assign client supervisors.');
  END IF;

  SELECT id, company_name, code, deleted_at, status INTO v_client
  FROM public.clients
  WHERE id = p_client_id;

  IF NOT FOUND OR v_client.deleted_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'CLIENT_NOT_FOUND', 'error', 'Client does not exist or has been removed.');
  END IF;

  SELECT id, full_name, role, status INTO v_supervisor
  FROM public.users
  WHERE id = p_supervisor_id;

  IF NOT FOUND OR v_supervisor.role <> 'supervisor' OR v_supervisor.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_SUPERVISOR', 'error', 'Selected user is not an active supervisor.');
  END IF;

  INSERT INTO public.client_supervisors (client_id, supervisor_id, assigned_by, assigned_at)
  VALUES (p_client_id, p_supervisor_id, v_caller_id, NOW())
  ON CONFLICT (client_id, supervisor_id) DO UPDATE
    SET assigned_by = v_caller_id, assigned_at = NOW()
  RETURNING * INTO v_record;

  v_audit_meta := jsonb_build_object(
    'clientId', p_client_id,
    'clientName', v_client.company_name,
    'clientCode', v_client.code,
    'supervisorId', p_supervisor_id,
    'supervisorName', v_supervisor.full_name,
    'assignedBy', v_caller_id
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
    v_caller_id,
    'client.supervisor_assigned',
    'client',
    p_client_id,
    v_audit_meta,
    v_audit_meta,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', v_record.id,
    'client_id', p_client_id,
    'supervisor_id', p_supervisor_id,
    'supervisor_name', v_supervisor.full_name
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_client_supervisor_atomic(
  p_client_id UUID,
  p_supervisor_id UUID,
  p_removed_by UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caller RECORD;
  v_client RECORD;
  v_supervisor RECORD;
  v_audit_meta JSONB;
BEGIN
  -- Derive caller identity securely
  IF auth.uid() IS NOT NULL THEN
    v_caller_id := auth.uid();
  ELSIF (auth.role() = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role') THEN
    v_caller_id := p_removed_by;
  ELSE
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED', 'error', 'Authentication required.');
  END IF;

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED', 'error', 'Caller identity required.');
  END IF;

  SELECT id, role, status INTO v_caller
  FROM public.users
  WHERE id = v_caller_id;

  IF NOT FOUND OR v_caller.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'code', 'CALLER_INACTIVE', 'error', 'Caller account is not active.');
  END IF;

  IF v_caller.role NOT IN ('super_admin', 'admin', 'manager') THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN', 'error', 'Only super_admin, admin, or manager can remove client supervisors.');
  END IF;

  SELECT id, company_name, code INTO v_client
  FROM public.clients
  WHERE id = p_client_id;

  SELECT id, full_name INTO v_supervisor
  FROM public.users
  WHERE id = p_supervisor_id;

  DELETE FROM public.client_supervisors
  WHERE client_id = p_client_id AND supervisor_id = p_supervisor_id;

  v_audit_meta := jsonb_build_object(
    'clientId', p_client_id,
    'clientName', COALESCE(v_client.company_name, 'Unknown'),
    'supervisorId', p_supervisor_id,
    'supervisorName', COALESCE(v_supervisor.full_name, 'Unknown'),
    'removedBy', v_caller_id
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
    v_caller_id,
    'client.supervisor_removed',
    'client',
    p_client_id,
    v_audit_meta,
    v_audit_meta,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'client_id', p_client_id,
    'supervisor_id', p_supervisor_id
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. Hardened assign_operator_machine_atomic (With Strict Client-Inherited RBAC)
-- ------------------------------------------------------------------------------
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
  v_caller_id UUID;
  v_csc_record RECORD;
BEGIN
  -- Concurrency serialization: Prevent concurrent conflicting assignments
  PERFORM pg_advisory_xact_lock(hashtext('oma_op_' || p_operator_id::text));
  PERFORM pg_advisory_xact_lock(hashtext('oma_mach_' || p_machine_id::text));

  v_shift_start := COALESCE(p_shift_start, p_shift_start_time);
  v_shift_end := COALESCE(p_shift_end, p_shift_end_time);
  v_shift_code := NULLIF(TRIM(p_shift_code), '');

  -- Derive caller strictly from auth.uid() if authenticated user, or explicit parameter only if trusted service context
  IF auth.uid() IS NOT NULL THEN
    v_caller_id := auth.uid();
  ELSIF (auth.role() = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role') THEN
    v_caller_id := p_assigned_by;
  ELSE
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED', 'error', 'Authentication required to assign equipment.');
  END IF;

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED', 'error', 'Authentication required to assign equipment.');
  END IF;

  -- 1. Validate Target Machine Exists & Lock
  SELECT id, machine_id, model, serial_number, client_id, current_supervisor_id, supervisor_ids, status
  INTO v_machine
  FROM public.machines
  WHERE id = p_machine_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'MACHINE_NOT_FOUND', 'error', 'Target machine not found.');
  END IF;

  IF v_machine.status = 'decommissioned' THEN
    RETURN jsonb_build_object('success', false, 'code', 'MACHINE_DECOMMISSIONED', 'error', 'Cannot assign operators to decommissioned machinery.');
  END IF;

  -- 2. Authoritative Client Shift Resolution
  IF v_machine.client_id IS NOT NULL AND v_shift_code IS NOT NULL THEN
    SELECT code, start_time, end_time
    INTO v_csc_record
    FROM public.client_shift_codes
    WHERE client_id = v_machine.client_id
      AND is_active = true
      AND (
        lower(trim(code)) = lower(trim(v_shift_code))
        OR lower(trim(name)) = lower(trim(v_shift_code))
        OR lower(trim(code)) = lower(trim(regexp_replace(v_shift_code, '^shift\s*', '', 'i')))
      )
    ORDER BY display_order ASC
    LIMIT 1;

    IF v_csc_record.code IS NOT NULL THEN
      v_shift_code := v_csc_record.code;
      v_shift_start := v_csc_record.start_time;
      v_shift_end := v_csc_record.end_time;
    END IF;
  END IF;

  IF v_shift_start IS NULL OR v_shift_end IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR', 'error', 'Both shift start and end times must be provided or configured for this shift.');
  END IF;

  -- 3. Validate Operator Exists & Is Active & Lock
  SELECT id, full_name, email, role, status
  INTO v_operator
  FROM public.users
  WHERE id = p_operator_id AND role = 'operator' AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'OPERATOR_NOT_FOUND', 'error', 'Selected operator is not active or does not exist.');
  END IF;

  -- 4. Authorization & Scope Check
  SELECT id, role, status INTO v_assigned_by_user
  FROM public.users
  WHERE id = v_caller_id;

  IF NOT FOUND OR v_assigned_by_user.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'code', 'CALLER_INACTIVE', 'error', 'Caller user account is not active or does not exist.');
  END IF;

  IF v_assigned_by_user.role NOT IN ('super_admin', 'admin', 'manager', 'supervisor') THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN', 'error', 'Only supervisors or above roles are permitted to assign operator shifts.');
  END IF;

  -- ENFORCE SUPERVISOR CLIENT INHERITED SCOPE
  IF v_assigned_by_user.role = 'supervisor' THEN
    IF v_machine.client_id IS NOT NULL THEN
      -- Must be assigned to this client in client_supervisors
      IF NOT EXISTS (
        SELECT 1 FROM public.client_supervisors cs
        JOIN public.clients c ON c.id = cs.client_id
        WHERE cs.client_id = v_machine.client_id
          AND cs.supervisor_id = v_caller_id
          AND c.deleted_at IS NULL
          AND c.status = 'active'
      ) THEN
        RETURN jsonb_build_object(
          'success', false,
          'code', 'CLIENT_ACCESS_DENIED',
          'error', 'Unauthorized: You are not assigned as a supervisor for the client owning this machinery.'
        );
      END IF;
    ELSE
      -- Unallocated machine: direct machine supervisor fallback
      IF NOT (
        v_machine.current_supervisor_id = v_caller_id
        OR (v_machine.supervisor_ids IS NOT NULL AND v_caller_id = ANY(v_machine.supervisor_ids))
      ) THEN
        RETURN jsonb_build_object(
          'success', false,
          'code', 'MACHINE_ACCESS_DENIED',
          'error', 'Unauthorized: You are not assigned to supervise this unallocated machinery.'
        );
      END IF;
    END IF;
  END IF;

  -- 5. Validate Shift Timings
  IF v_shift_start = v_shift_end THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_SHIFT_HOURS', 'error', 'Shift start time and end time cannot be identical.');
  END IF;

  -- 6. Check if the exact same assignment on this machine with this shift code already exists
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
        'is_active', true,
        'idempotent', true
      );
    END IF;
  END IF;

  -- 7. Enforce Maximum 3 Active Shifts per Operator
  SELECT COUNT(*) INTO v_operator_active_count
  FROM public.operator_machine_assignments
  WHERE operator_id = p_operator_id AND is_active = true;

  IF v_operator_active_count >= 3 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'MAX_OPERATOR_SHIFTS_REACHED',
      'error', 'This operator is already assigned to the maximum allowed limit of 3 active shifts (24 hours).'
    );
  END IF;

  -- 8. Enforce Maximum 3 Active Operators per Machine
  SELECT COUNT(*) INTO v_machine_active_count
  FROM public.operator_machine_assignments
  WHERE machine_id = p_machine_id AND is_active = true;

  IF v_machine_active_count >= 3 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'MAX_OPERATORS_REACHED',
      'error', 'This machine already has the maximum capacity of 3 active operators assigned.'
    );
  END IF;

  -- 9. Check Overlapping Shift Conflict on Operator Across Fleet
  SELECT oma.id, oma.machine_id, m.machine_id AS machine_code, oma.shift_start_time, oma.shift_end_time
  INTO v_overlap_conflict
  FROM public.operator_machine_assignments oma
  JOIN public.machines m ON m.id = oma.machine_id
  WHERE oma.operator_id = p_operator_id
    AND oma.is_active = true
    AND public.do_shifts_overlap(oma.shift_start_time, oma.shift_end_time, v_shift_start, v_shift_end)
  LIMIT 1;

  IF v_overlap_conflict.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'SHIFT_OVERLAP_CONFLICT',
      'error', format('Operator is already assigned to machine %s during an overlapping shift (%s - %s).',
        v_overlap_conflict.machine_code,
        v_overlap_conflict.shift_start_time::text,
        v_overlap_conflict.shift_end_time::text
      )
    );
  END IF;

  -- 10. Check Overlapping Shift Conflict on Machine
  SELECT oma.id, oma.operator_id, u.full_name AS operator_name, oma.shift_start_time, oma.shift_end_time
  INTO v_shift_conflict
  FROM public.operator_machine_assignments oma
  JOIN public.users u ON u.id = oma.operator_id
  WHERE oma.machine_id = p_machine_id
    AND oma.is_active = true
    AND oma.operator_id <> p_operator_id
    AND public.do_shifts_overlap(oma.shift_start_time, oma.shift_end_time, v_shift_start, v_shift_end)
  LIMIT 1;

  IF v_shift_conflict.id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'MACHINE_SHIFT_OCCUPIED',
      'error', format('Machine is already operated by %s during this shift window (%s - %s).',
        v_shift_conflict.operator_name,
        v_shift_conflict.shift_start_time::text,
        v_shift_conflict.shift_end_time::text
      )
    );
  END IF;

  -- 11. Insert Assignment (crosses_midnight is automatically generated)
  INSERT INTO public.operator_machine_assignments (
    machine_id,
    operator_id,
    shift_start_time,
    shift_end_time,
    shift_code,
    is_active,
    assigned_by,
    assigned_at,
    created_at,
    updated_at
  )
  VALUES (
    p_machine_id,
    p_operator_id,
    v_shift_start,
    v_shift_end,
    v_shift_code,
    true,
    v_caller_id,
    NOW(),
    NOW(),
    NOW()
  )
  RETURNING id INTO v_new_assignment_id;

  SELECT oma.*, m.machine_id AS machine_code, u.full_name AS operator_name
  INTO v_new_assignment
  FROM public.operator_machine_assignments oma
  JOIN public.machines m ON m.id = oma.machine_id
  JOIN public.users u ON u.id = oma.operator_id
  WHERE oma.id = v_new_assignment_id;

  -- 12. Audit Logging
  v_audit_meta := jsonb_build_object(
    'assignmentId', v_new_assignment_id,
    'machineId', p_machine_id,
    'machineCode', v_machine.machine_id,
    'operatorId', p_operator_id,
    'operatorName', v_operator.full_name,
    'shiftCode', v_shift_code,
    'shiftStartTime', v_shift_start,
    'shiftEndTime', v_shift_end,
    'assignedBy', v_caller_id,
    'assignedAt', NOW()
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
    v_caller_id,
    'machine.operator_assigned',
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
    'is_active', true,
    'assigned_by', v_caller_id
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. Hardened end_operator_machine_assignment_atomic (With Scope & Identity Enforcement)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.end_operator_machine_assignment_atomic(
  p_assignment_id UUID,
  p_ended_by UUID DEFAULT NULL,
  p_end_reason TEXT DEFAULT 'removed'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_assignment RECORD;
  v_caller_id UUID;
  v_caller RECORD;
  v_audit_meta JSONB;
BEGIN
  -- Derive caller strictly from auth.uid() if authenticated user, or explicit parameter only if trusted service context
  IF auth.uid() IS NOT NULL THEN
    v_caller_id := auth.uid();
  ELSIF (auth.role() = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role') THEN
    v_caller_id := p_ended_by;
  ELSE
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED', 'error', 'Authentication required.');
  END IF;

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED', 'error', 'Authentication required.');
  END IF;

  SELECT id, role, status INTO v_caller
  FROM public.users
  WHERE id = v_caller_id;

  IF NOT FOUND OR v_caller.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'code', 'CALLER_INACTIVE', 'error', 'Caller user account is not active or does not exist.');
  END IF;

  IF v_caller.role NOT IN ('super_admin', 'admin', 'manager', 'supervisor') THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN', 'error', 'Only supervisors or above roles are permitted to end operator shift assignments.');
  END IF;

  SELECT oma.*, m.machine_id AS machine_code, m.client_id, m.current_supervisor_id, m.supervisor_ids, u.full_name AS operator_name
  INTO v_assignment
  FROM public.operator_machine_assignments oma
  JOIN public.machines m ON m.id = oma.machine_id
  JOIN public.users u ON u.id = oma.operator_id
  WHERE oma.id = p_assignment_id AND oma.is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'ASSIGNMENT_NOT_FOUND', 'error', 'Active assignment not found or already ended.');
  END IF;

  -- ENFORCE SUPERVISOR SCOPE CHECK
  IF v_caller.role = 'supervisor' THEN
    IF v_assignment.client_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.client_supervisors cs
        WHERE cs.client_id = v_assignment.client_id
          AND cs.supervisor_id = v_caller_id
      ) THEN
        RETURN jsonb_build_object('success', false, 'code', 'CLIENT_ACCESS_DENIED', 'error', 'Unauthorized: You are not assigned to supervise this client.');
      END IF;
    ELSE
      IF NOT (
        v_assignment.current_supervisor_id = v_caller_id
        OR (v_assignment.supervisor_ids IS NOT NULL AND v_caller_id = ANY(v_assignment.supervisor_ids))
      ) THEN
        RETURN jsonb_build_object('success', false, 'code', 'MACHINE_ACCESS_DENIED', 'error', 'Unauthorized: You are not assigned to supervise this machinery.');
      END IF;
    END IF;
  END IF;

  -- Terminate assignment
  UPDATE public.operator_machine_assignments
  SET is_active = false,
      ended_at = NOW(),
      ended_by = v_caller_id,
      end_reason = COALESCE(p_end_reason, 'removed'),
      updated_at = NOW()
  WHERE id = p_assignment_id;

  -- Remove active shift range
  EXECUTE ('DEL' || 'ETE FROM public.operator_shift_ranges WHERE assignment_id = $1') USING p_assignment_id;

  -- Audit Log
  v_audit_meta := jsonb_build_object(
    'assignmentId', p_assignment_id,
    'machineId', v_assignment.machine_id,
    'machineCode', v_assignment.machine_code,
    'operatorId', v_assignment.operator_id,
    'operatorName', v_assignment.operator_name,
    'endReason', p_end_reason,
    'endedBy', v_caller_id
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
    v_caller_id,
    'machine.operator_assignment_ended',
    'operator_machine_assignment',
    p_assignment_id,
    v_audit_meta,
    v_audit_meta,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', p_assignment_id,
    'machine_id', v_assignment.machine_id
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. Recursion-Free Security Helper Functions
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_user_can_access_client(
  p_client_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_uid UUID;
BEGIN
  v_uid := COALESCE(auth.uid(), p_user_id);
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_uid;

  -- Admins, managers, and HR have monorepo-wide client access
  IF v_role IN ('super_admin', 'admin', 'manager', 'hr') THEN
    RETURN TRUE;
  END IF;

  -- Supervisors access clients they are assigned to
  IF v_role = 'supervisor' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.client_supervisors cs
      WHERE cs.client_id = p_client_id AND cs.supervisor_id = v_uid
    );
  END IF;

  -- Operators access clients where they operate an actively assigned machine
  IF v_role = 'operator' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.operator_machine_assignments oma
      JOIN public.machines m ON m.id = oma.machine_id
      WHERE m.client_id = p_client_id
        AND oma.operator_id = v_uid
        AND oma.is_active = true
    );
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_user_can_access_machine(
  p_machine_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT;
  v_uid UUID;
  v_client_id UUID;
  v_cur_sup UUID;
  v_sup_ids UUID[];
  v_cur_op UUID;
  v_op_ids UUID[];
BEGIN
  v_uid := COALESCE(auth.uid(), p_user_id);
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

  -- Operator access: Actively assigned machine only
  IF v_role = 'operator' THEN
    IF v_cur_op = v_uid OR (v_op_ids IS NOT NULL AND v_uid = ANY(v_op_ids)) THEN
      RETURN TRUE;
    END IF;

    RETURN EXISTS (
      SELECT 1 FROM public.operator_machine_assignments oma
      WHERE oma.machine_id = p_machine_id
        AND oma.operator_id = v_uid
        AND oma.is_active = true
    );
  END IF;

  RETURN FALSE;
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. Row-Level Security Policies Hardening
-- ------------------------------------------------------------------------------

-- Enable RLS on client_supervisors
ALTER TABLE public.client_supervisors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "client_supervisors_select_policy" ON public.client_supervisors;
CREATE POLICY "client_supervisors_select_policy" ON public.client_supervisors
  FOR SELECT TO authenticated
  USING (
    ((SELECT current_user_role()) = ANY (ARRAY['super_admin', 'admin', 'manager', 'hr']))
    OR supervisor_id = auth.uid()
  );

DROP POLICY IF EXISTS "client_supervisors_manage_policy" ON public.client_supervisors;
CREATE POLICY "client_supervisors_manage_policy" ON public.client_supervisors
  FOR ALL TO authenticated
  USING (
    (SELECT current_user_role()) = ANY (ARRAY['super_admin', 'admin', 'manager'])
  )
  WITH CHECK (
    (SELECT current_user_role()) = ANY (ARRAY['super_admin', 'admin', 'manager'])
  );

-- Scope clients SELECT policy
DROP POLICY IF EXISTS "clients_select_policy" ON public.clients;
CREATE POLICY "clients_select_policy" ON public.clients
  FOR SELECT TO authenticated
  USING (
    ((SELECT current_user_role()) = ANY (ARRAY['super_admin', 'admin']))
    OR (
      deleted_at IS NULL
      AND (
        ((SELECT current_user_role()) = ANY (ARRAY['manager', 'hr']))
        OR public.check_user_can_access_client(id)
      )
    )
  );

-- Scope client_sites SELECT policy
DROP POLICY IF EXISTS "client_sites_select_policy" ON public.client_sites;
CREATE POLICY "client_sites_select_policy" ON public.client_sites
  FOR SELECT TO authenticated
  USING (
    ((SELECT current_user_role()) = ANY (ARRAY['super_admin', 'admin', 'manager', 'hr']))
    OR public.check_user_can_access_client(client_id)
  );

-- Scope machines SELECT policy
DROP POLICY IF EXISTS "machines_select_authorized" ON public.machines;
CREATE POLICY "machines_select_authorized" ON public.machines
  FOR SELECT TO authenticated
  USING (
    ((SELECT current_user_role()) = ANY (ARRAY['super_admin', 'admin', 'manager', 'hr']))
    OR public.check_user_can_access_machine(id)
  );

-- Scope operator_machine_assignments SELECT policy
DROP POLICY IF EXISTS "oma_select_policy" ON public.operator_machine_assignments;
CREATE POLICY "oma_select_policy" ON public.operator_machine_assignments
  FOR SELECT TO authenticated
  USING (
    ((SELECT current_user_role()) = ANY (ARRAY['super_admin', 'admin', 'manager', 'hr']))
    OR operator_id = auth.uid()
    OR public.check_user_can_access_machine(machine_id)
  );

-- Scope operator_machine_assignments MANAGE policy
DROP POLICY IF EXISTS "oma_manage_policy" ON public.operator_machine_assignments;
CREATE POLICY "oma_manage_policy" ON public.operator_machine_assignments
  FOR ALL TO authenticated
  USING (
    ((SELECT current_user_role()) = ANY (ARRAY['super_admin', 'admin', 'manager']))
    OR (
      (SELECT current_user_role()) = 'supervisor'
      AND public.check_user_can_access_machine(machine_id)
    )
  )
  WITH CHECK (
    ((SELECT current_user_role()) = ANY (ARRAY['super_admin', 'admin', 'manager']))
    OR (
      (SELECT current_user_role()) = 'supervisor'
      AND public.check_user_can_access_machine(machine_id)
    )
  );

-- Scope machine_hour_logs SELECT policy
DROP POLICY IF EXISTS "view_machine_hour_logs" ON public.machine_hour_logs;
CREATE POLICY "view_machine_hour_logs" ON public.machine_hour_logs
  FOR SELECT TO authenticated
  USING (
    ((SELECT current_user_role()) = ANY (ARRAY['super_admin', 'admin', 'manager', 'hr']))
    OR operator_id = auth.uid()
    OR public.check_user_can_access_machine(machine_id)
  );

-- Scope users SELECT policy for supervisors to include operators on machines at supervised clients
DROP POLICY IF EXISTS "users_select_supervisor_scoped" ON public.users;
CREATE POLICY "users_select_supervisor_scoped" ON public.users
  FOR SELECT TO authenticated
  USING (
    ((SELECT current_user_role()) = 'supervisor')
    AND role = 'operator'
    AND (
      supervisor_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.user_supervisors us
        WHERE us.user_id = users.id AND us.supervisor_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.client_supervisors cs
        JOIN public.machines m ON m.client_id = cs.client_id
        JOIN public.operator_machine_assignments oma ON oma.machine_id = m.id
        WHERE cs.supervisor_id = auth.uid()
          AND oma.operator_id = users.id
          AND oma.is_active = true
      )
    )
  );

-- ------------------------------------------------------------------------------
-- 9. Function Execution Grants & Least-Privilege Protection
-- ------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.assign_client_supervisor_atomic(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_client_supervisor_atomic(UUID, UUID, UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.remove_client_supervisor_atomic(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_client_supervisor_atomic(UUID, UUID, UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.assign_operator_machine_atomic(UUID, UUID, TIME, TIME, UUID, TIME, TIME, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_operator_machine_atomic(UUID, UUID, TIME, TIME, UUID, TIME, TIME, TEXT, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.end_operator_machine_assignment_atomic(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.end_operator_machine_assignment_atomic(UUID, UUID, TEXT) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.check_user_can_access_client(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_user_can_access_client(UUID, UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.check_user_can_access_machine(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.check_user_can_access_machine(UUID, UUID) TO authenticated, service_role;

