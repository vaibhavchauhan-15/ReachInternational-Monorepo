-- ==============================================================================
-- Migration: 169_safe_user_deletion_and_referential_integrity.sql
-- Description: Atomic procedures for user deletion and safe deactivation.
-- Enforces backend RBAC, referential integrity, and statutory operational
-- data preservation (Factories Act 1948) for employees with historical shift logs,
-- payroll records, or equipment assignments.
-- Target Supabase Project: vlmxciuogczumumrwyot (Reach International Dev)
-- ==============================================================================

-- 1. Atomic User Safe Deactivation / Soft-Deletion Procedure
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

  -- End active machine assignments
  UPDATE public.operator_machine_assignments
  SET status = 'ended',
      ended_at = NOW(),
      ended_by = v_caller_id,
      notes = COALESCE(notes, '') || ' [Ended upon account deactivation]'
  WHERE operator_id = p_target_user_id
    AND status = 'active';

  -- Detach current machinery pointers
  UPDATE public.machines
  SET current_operator_id = NULL
  WHERE current_operator_id = p_target_user_id;

  UPDATE public.machines
  SET current_supervisor_id = NULL
  WHERE current_supervisor_id = p_target_user_id;

  -- Sync employees directory
  UPDATE public.employees
  SET status = 'inactive',
      updated_at = NOW()
  WHERE user_id = p_target_user_id;

  -- Structured Audit Log
  INSERT INTO public.audit_logs (
    action,
    entity_type,
    entity_id,
    user_id,
    new_values
  ) VALUES (
    'user.deactivated_for_retention',
    'user',
    p_target_user_id,
    v_caller_id,
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
    )
  );

  v_action_taken := 'deactivated';
  IF v_has_historical_data THEN
    v_result_message := 'Account safely deactivated. ' || v_target_user.full_name || ' has ' || v_hour_logs_count || ' shift log(s) and operational records that were preserved for compliance.';
  ELSE
    v_result_message := 'Account deactivated for ' || v_target_user.full_name || '.';
  END IF;

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

-- 2. Wrapper Function for Backward and Cross-Platform Compatibility
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

-- 3. Bulk Deactivation Procedure
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

-- 4. Permissions Grant
GRANT EXECUTE ON FUNCTION public.deactivate_user_atomic(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_or_deactivate_user_atomic(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_delete_or_deactivate_users_atomic(UUID[]) TO authenticated;
