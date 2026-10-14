-- ==============================================================================
-- Migration 167: Atomic User Status Management & Assignment Handling
-- 1. Creates public.toggle_user_status_atomic(p_target_user_id, p_requested_status)
--    - Enforces authentication and RBAC ('super_admin', 'admin', 'hr')
--    - Enforces self-mutation guard (cannot change own status)
--    - Enforces Super Admin hierarchy guard (only super_admin can modify super_admin)
--    - Updates public.users.status and public.employees.status
--    - When deactivating:
--      * Safely ends all active operator_machine_assignments (is_active = false, ended_at = NOW(), end_reason = 'user_deactivated')
--      * Ends active machine_assignments
--      * Cleans up machines.operator_ids and current_operator_id
--      * Cleans up machines.supervisor_ids and current_supervisor_id if supervisor
--      * Auto-cancels pending profile_change_requests
--      * Preserves 100% of historical shift logs (machine_hour_logs), attendance, payslips, and KYC docs
--    - Writes structured entry to public.audit_logs ('user.deactivated' / 'user.activated')
-- 2. Grants execute permissions to authenticated role and revokes from anon/public
-- ==============================================================================

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

  -- 8. Sync public.employees table status if linked
  UPDATE public.employees
  SET status = v_new_status,
      updated_at = NOW()
  WHERE user_id = p_target_user_id;

  -- 9. Handle Deactivation consequences
  IF v_new_status = 'inactive' THEN
    -- A. Deactivate all active operator machine assignments
    UPDATE public.operator_machine_assignments
    SET is_active = false,
        ended_at = NOW(),
        ended_by = v_caller_id,
        end_reason = 'user_deactivated',
        updated_at = NOW()
    WHERE operator_id = p_target_user_id AND is_active = true;
    GET DIAGNOSTICS v_ended_assignments_count = ROW_COUNT;

    -- B. Deactivate any active rows in machine_assignments
    UPDATE public.machine_assignments
    SET status = 'ended',
        end_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE operator_id = p_target_user_id AND status = 'active';

    -- C. Remove operator from machines.operator_ids and current_operator_id
    UPDATE public.machines
    SET operator_ids = array_remove(operator_ids, p_target_user_id),
        current_operator_id = CASE WHEN current_operator_id = p_target_user_id THEN NULL ELSE current_operator_id END,
        updated_at = NOW()
    WHERE p_target_user_id = ANY(operator_ids) OR current_operator_id = p_target_user_id;

    -- D. If user was a supervisor, remove from machines.supervisor_ids
    UPDATE public.machines
    SET supervisor_ids = array_remove(supervisor_ids, p_target_user_id),
        current_supervisor_id = CASE WHEN current_supervisor_id = p_target_user_id THEN NULL ELSE current_supervisor_id END,
        updated_at = NOW()
    WHERE p_target_user_id = ANY(supervisor_ids) OR current_supervisor_id = p_target_user_id;

    -- E. Cancel any pending profile change requests with audit note
    UPDATE public.profile_change_requests
    SET status = 'cancelled',
        reviewed_by = v_caller_id,
        reviewed_at = NOW(),
        review_notes = 'Auto-cancelled: User account deactivated by administrator'
    WHERE user_id = p_target_user_id AND status = 'pending';

  ELSIF v_new_status = 'active' THEN
    -- If user was pending or inactive, status is now active
    -- Ensure employees table designation and status are active
    UPDATE public.employees
    SET status = 'active',
        updated_at = NOW()
    WHERE user_id = p_target_user_id;
  END IF;

  -- 10. Write structured audit log
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
    p_target_user_id,
    format('User %s (%s) status changed from %s to %s by %s', v_target_user.full_name, v_target_user.role, v_target_user.status, v_new_status, v_caller_name),
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

-- Grant execution to authenticated role and revoke from public/anon
REVOKE ALL ON FUNCTION public.toggle_user_status_atomic(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_user_status_atomic(UUID, TEXT) TO authenticated;
