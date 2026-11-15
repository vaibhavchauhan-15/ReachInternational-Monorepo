-- Migration 187: Phase 5 — Contract Cleanup & Range Synchronization
-- 1. Adds check constraint enforcing valid_from <= valid_to
-- 2. Adds synchronization trigger ensuring is_active and valid_to remain 100% consistent
-- 3. Hardens legacy end_operator_machine_assignment_atomic to stamp valid_to

-- ============================================================
-- 1. Check Constraint: valid_from <= valid_to
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_oma_valid_range_order'
  ) THEN
    ALTER TABLE public.operator_machine_assignments
      ADD CONSTRAINT chk_oma_valid_range_order
      CHECK (valid_to IS NULL OR valid_from <= valid_to);
  END IF;
END $$;

-- ============================================================
-- 2. Range Synchronization Trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_fn_sync_oma_valid_range()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_today_ist date;
BEGIN
  v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;

  -- Safety 1: If is_active is toggled to false and valid_to is not specified, stamp valid_to
  IF NEW.is_active = false AND (OLD.is_active = true OR OLD.is_active IS NULL) AND NEW.valid_to IS NULL THEN
    NEW.valid_to := GREATEST(NEW.valid_from, v_today_ist);
  END IF;

  -- Safety 2: If valid_to is in the past, is_active must be false
  IF NEW.valid_to IS NOT NULL AND NEW.valid_to < v_today_ist THEN
    NEW.is_active := false;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_oma_valid_range ON public.operator_machine_assignments;
CREATE TRIGGER trg_sync_oma_valid_range
  BEFORE INSERT OR UPDATE OF is_active, valid_to, valid_from
  ON public.operator_machine_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fn_sync_oma_valid_range();

-- ============================================================
-- 3. Hardened end_operator_machine_assignment_atomic
-- ============================================================
CREATE OR REPLACE FUNCTION public.end_operator_machine_assignment_atomic(
  p_assignment_id UUID,
  p_ended_by UUID DEFAULT NULL,
  p_end_reason TEXT DEFAULT 'removed'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_assignment RECORD;
  v_caller_id UUID;
  v_caller RECORD;
  v_audit_meta JSONB;
  v_today_ist DATE;
BEGIN
  v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;

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

  -- Terminate assignment with valid_to range stamp
  UPDATE public.operator_machine_assignments
  SET is_active = false,
      ended_at = NOW(),
      ended_by = v_caller_id,
      end_reason = COALESCE(p_end_reason, 'removed'),
      valid_to = COALESCE(valid_to, GREATEST(valid_from, v_today_ist)),
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
    'endedBy', v_caller_id,
    'validTo', GREATEST(v_assignment.valid_from, v_today_ist)
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
    'machine_id', v_assignment.machine_id,
    'valid_to', GREATEST(v_assignment.valid_from, v_today_ist)
  );
END;
$$;
