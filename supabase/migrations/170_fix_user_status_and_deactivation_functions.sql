-- ==============================================================================
-- Migration: 170_fix_user_status_and_deactivation_functions.sql
-- Description: Fixes toggle_user_status_atomic, deactivate_user_atomic,
-- and bulk_delete_or_deactivate_users_atomic by removing non-existent table
-- references (public.employees, public.machine_assignments), correcting
-- operator_machine_assignments column references (is_active, end_reason = 'removed'),
-- fixing profile_change_requests column (rejection_reason), and correcting
-- audit_logs columns (details as jsonb, metadata as jsonb).
-- Target Supabase Project: vlmxciuogczumumrwyot (Reach International Dev)
-- ==============================================================================

-- 1. Upgrade public.toggle_user_status_atomic
CREATE OR REPLACE FUNCTION public.toggle_user_status_atomic(
  p_target_user_id UUID,
  p_requested_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_caller_name TEXT;
  v_caller_email TEXT;
  v_target_user RECORD;
  v_new_status TEXT;
  v_ended_assignments_count INT := 0;
BEGIN
  -- 1. Authentication check
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  -- 2. Caller role check
  v_caller_role := public.current_user_role();
  IF v_caller_role NOT IN ('super_admin', 'admin', 'hr') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied. Only Super Admin, Admin, and HR can activate or deactivate accounts.');
  END IF;

  -- Fetch caller details for audit logging
  SELECT full_name, email INTO v_caller_name, v_caller_email
  FROM public.users WHERE id = v_caller_id;

  -- 3. Self-mutation guard: user cannot change their own status
  IF p_target_user_id = v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'You cannot change your own account status.');
  END IF;

  -- 4. Target user check
  SELECT id, full_name, email, role, status, employee_id
  INTO v_target_user
  FROM public.users
  WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found.');
  END IF;

  -- 5. Super Admin protection: Admin and HR cannot deactivate or activate a Super Admin
  IF v_caller_role <> 'super_admin' AND v_target_user.role = 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied. Only Super Admins can modify Super Admin accounts.');
  END IF;

  -- 6. Determine new status
  IF p_requested_status IS NOT NULL AND p_requested_status IN ('active', 'inactive') THEN
    v_new_status := p_requested_status;
  ELSE
    v_new_status := CASE WHEN v_target_user.status = 'active' THEN 'inactive' ELSE 'active' END;
  END IF;

  -- If status is already the requested status, return early
  IF v_target_user.status = v_new_status THEN
    RETURN jsonb_build_object(
      'success', true, 
      'already_set', true,
      'status', v_new_status,
      'message', format('User %s is already %s.', v_target_user.full_name, v_new_status)
    );
  END IF;

  -- 7. Update public.users status
  UPDATE public.users
  SET status = v_new_status,
      updated_at = NOW()
  WHERE id = p_target_user_id;

  -- 8. Handle Deactivation consequences
  IF v_new_status = 'inactive' THEN
    -- A. Deactivate all active operator machine assignments with valid end_reason 'removed'
    UPDATE public.operator_machine_assignments
    SET is_active = false,
        ended_at = NOW(),
        ended_by = v_caller_id,
        end_reason = 'removed',
        updated_at = NOW()
    WHERE operator_id = p_target_user_id AND is_active = true;
    GET DIAGNOSTICS v_ended_assignments_count = ROW_COUNT;

    -- B. Remove operator from machines.operator_ids and current_operator_id
    UPDATE public.machines
    SET operator_ids = array_remove(operator_ids, p_target_user_id),
        current_operator_id = CASE WHEN current_operator_id = p_target_user_id THEN NULL ELSE current_operator_id END,
        updated_at = NOW()
    WHERE p_target_user_id = ANY(operator_ids) OR current_operator_id = p_target_user_id;

    -- C. If user was a supervisor, remove from machines.supervisor_ids and current_supervisor_id
    UPDATE public.machines
    SET supervisor_ids = array_remove(supervisor_ids, p_target_user_id),
        current_supervisor_id = CASE WHEN current_supervisor_id = p_target_user_id THEN NULL ELSE current_supervisor_id END,
        updated_at = NOW()
    WHERE p_target_user_id = ANY(supervisor_ids) OR current_supervisor_id = p_target_user_id;

    -- D. Cancel any pending profile change requests with rejection reason
    UPDATE public.profile_change_requests
    SET status = 'cancelled',
        reviewed_by = v_caller_id,
        reviewed_at = NOW(),
        rejection_reason = 'Auto-cancelled: User account deactivated by administrator'
    WHERE user_id = p_target_user_id AND status = 'pending';
  END IF;

  -- 9. Write structured audit log
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    details,
    metadata,
    created_at
  ) VALUES (
    v_caller_id,
    CASE WHEN v_new_status = 'active' THEN 'user.activated' ELSE 'user.deactivated' END,
    'user',
    p_target_user_id::text,
    to_jsonb(format('User %s (%s) status changed from %s to %s by %s', v_target_user.full_name, v_target_user.role, v_target_user.status, v_new_status, v_caller_name)),
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'target_user_name', v_target_user.full_name,
      'target_user_email', v_target_user.email,
      'target_user_role', v_target_user.role,
      'previous_status', v_target_user.status,
      'new_status', v_new_status,
      'ended_assignments_count', v_ended_assignments_count,
      'performed_by_id', v_caller_id,
      'performed_by_name', v_caller_name,
      'performed_by_email', v_caller_email,
      'performed_by_role', v_caller_role
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'status', v_new_status,
    'ended_assignments_count', v_ended_assignments_count,
    'message', format('User %s has been %s.', v_target_user.full_name, CASE WHEN v_new_status = 'active' THEN 'activated' ELSE 'deactivated' END)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_user_status_atomic(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_user_status_atomic(UUID, TEXT) TO authenticated;

-- 2. Upgrade public.deactivate_user_atomic
CREATE OR REPLACE FUNCTION public.deactivate_user_atomic(
  p_target_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_target_user RECORD;
  v_hour_logs_count INT := 0;
  v_payrolls_count INT := 0;
  v_assignments_count INT := 0;
  v_has_historical_data BOOLEAN := FALSE;
  v_action_taken TEXT;
  v_result_message TEXT;
BEGIN
  -- A. Authentication Verification
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required. Please sign in.';
  END IF;

  -- B. Authorization Verification (super_admin or admin only)
  SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
  IF v_caller_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admins and Admins can delete or deactivate users.';
  END IF;

  -- C. Target User Existence
  SELECT * INTO v_target_user FROM public.users WHERE id = p_target_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target user not found.';
  END IF;

  -- D. Prevent Self-Deletion
  IF v_caller_id = p_target_user_id THEN
    RAISE EXCEPTION 'You cannot delete your own account.';
  END IF;

  -- E. Role Hierarchy: Admins cannot delete Super Admins
  IF v_caller_role = 'admin' AND v_target_user.role = 'super_admin' THEN
    RAISE EXCEPTION 'Only Super Admins can delete or deactivate Super Admin accounts.';
  END IF;

  -- F. Inspect Referential Integrity & Historical Operational Data
  SELECT COUNT(*) INTO v_hour_logs_count
  FROM public.machine_hour_logs
  WHERE operator_id = p_target_user_id
     OR entered_by = p_target_user_id
     OR supervisor_id = p_target_user_id;

  SELECT COUNT(*) INTO v_payrolls_count
  FROM public.operator_payrolls
  WHERE operator_id = p_target_user_id
     OR approved_by = p_target_user_id;

  SELECT COUNT(*) INTO v_assignments_count
  FROM public.operator_machine_assignments
  WHERE operator_id = p_target_user_id
     OR assigned_by = p_target_user_id
     OR ended_by = p_target_user_id;

  v_has_historical_data := (v_hour_logs_count > 0 OR v_payrolls_count > 0 OR v_assignments_count > 0);

  -- G. Deactivate user safely preserving compliance
  UPDATE public.users
  SET status = 'inactive',
      supervisor_id = NULL,
      updated_at = NOW()
  WHERE id = p_target_user_id;

  -- End active machine assignments with valid end_reason 'removed'
  UPDATE public.operator_machine_assignments
  SET is_active = false,
      ended_at = NOW(),
      ended_by = v_caller_id,
      end_reason = 'removed',
      updated_at = NOW()
  WHERE operator_id = p_target_user_id
    AND is_active = true;

  -- Detach current machinery pointers
  UPDATE public.machines
  SET current_operator_id = NULL
  WHERE current_operator_id = p_target_user_id;

  UPDATE public.machines
  SET operator_ids = array_remove(operator_ids, p_target_user_id)
  WHERE p_target_user_id = ANY(operator_ids);

  UPDATE public.machines
  SET current_supervisor_id = NULL
  WHERE current_supervisor_id = p_target_user_id;

  UPDATE public.machines
  SET supervisor_ids = array_remove(supervisor_ids, p_target_user_id)
  WHERE p_target_user_id = ANY(supervisor_ids);

  -- Structured Audit Log
  v_action_taken := 'deactivated';
  IF v_has_historical_data THEN
    v_result_message := 'Account safely deactivated. ' || v_target_user.full_name || ' has ' || v_hour_logs_count || ' shift log(s) and operational records that were preserved for compliance.';
  ELSE
    v_result_message := 'Account deactivated for ' || v_target_user.full_name || '.';
  END IF;

  INSERT INTO public.audit_logs (
    action,
    entity_type,
    entity_id,
    user_id,
    details,
    metadata,
    created_at
  ) VALUES (
    'user.deactivated_for_retention',
    'user',
    p_target_user_id::text,
    v_caller_id,
    to_jsonb(v_result_message),
    jsonb_build_object(
      'target_name', v_target_user.full_name,
      'target_email', v_target_user.email,
      'target_employee_id', v_target_user.employee_id,
      'reason', 'Safely deactivated to preserve statutory operational records and referential integrity',
      'hour_logs_count', v_hour_logs_count,
      'payrolls_count', v_payrolls_count,
      'assignments_count', v_assignments_count,
      'performed_by_id', v_caller_id,
      'performed_by_role', v_caller_role
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'action', v_action_taken,
    'user_id', p_target_user_id,
    'full_name', v_target_user.full_name,
    'preserved_records', v_has_historical_data,
    'hour_logs_count', v_hour_logs_count,
    'payrolls_count', v_payrolls_count,
    'message', v_result_message
  );
END;
$$;

REVOKE ALL ON FUNCTION public.deactivate_user_atomic(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deactivate_user_atomic(UUID) TO authenticated;

-- 3. Upgrade delete_or_deactivate_user_atomic
CREATE OR REPLACE FUNCTION public.delete_or_deactivate_user_atomic(
  p_target_user_id UUID,
  p_force_permanent BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  RETURN public.deactivate_user_atomic(p_target_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_or_deactivate_user_atomic(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_or_deactivate_user_atomic(UUID, BOOLEAN) TO authenticated;

-- 4. Upgrade bulk_delete_or_deactivate_users_atomic
CREATE OR REPLACE FUNCTION public.bulk_delete_or_deactivate_users_atomic(
  p_user_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_target_id UUID;
  v_res JSONB;
  v_success_count INT := 0;
  v_failed_count INT := 0;
  v_errors JSONB := '[]'::JSONB;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required. Please sign in.';
  END IF;

  SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
  IF v_caller_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: Only Super Admins and Admins can delete or deactivate users.';
  END IF;

  FOREACH v_target_id IN ARRAY p_user_ids
  LOOP
    BEGIN
      v_res := public.deactivate_user_atomic(v_target_id);
      IF (v_res->>'success')::BOOLEAN THEN
        v_success_count := v_success_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed_count := v_failed_count + 1;
      v_errors := v_errors || jsonb_build_object(
        'user_id', v_target_id,
        'error', SQLERRM
      );
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', (v_success_count > 0),
    'total_requested', array_length(p_user_ids, 1),
    'success_count', v_success_count,
    'failed_count', v_failed_count,
    'errors', v_errors,
    'message', 'Processed ' || v_success_count || ' account(s) safely deactivated.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_delete_or_deactivate_users_atomic(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_delete_or_deactivate_users_atomic(UUID[]) TO authenticated;
