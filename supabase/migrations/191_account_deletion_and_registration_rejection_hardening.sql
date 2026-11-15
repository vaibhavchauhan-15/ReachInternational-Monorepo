-- ==============================================================================
-- Migration: 191_account_deletion_and_registration_rejection_hardening.sql
-- Description:
--   1. Adds atomic RPCs for Account Deletion Requests:
--      - public.approve_account_deletion_request_atomic(p_request_id UUID, p_admin_notes TEXT)
--      - public.reject_account_deletion_request_atomic(p_request_id UUID, p_admin_notes TEXT)
--   2. Hardens public.reject_user_registration_atomic to clean up unapproved pending auth/user rows,
--      preventing duplicate / zombie records in Supabase and allowing clean re-registration.
-- ==============================================================================

-- 1. Approve Account Deletion Request Atomic
CREATE OR REPLACE FUNCTION public.approve_account_deletion_request_atomic(
  p_request_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_caller_name TEXT;
  v_caller_email TEXT;
  v_del_req RECORD;
  v_target_user_id UUID;
  v_target_user RECORD;
  v_final_notes TEXT;
BEGIN
  -- 1. Authentication check
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required. Please sign in.');
  END IF;

  -- 2. Caller role check
  v_caller_role := public.current_user_role();
  IF v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'hr') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied. Only Super Admin, Admin, Manager, and HR can authorize account deletions.');
  END IF;

  SELECT full_name, email INTO v_caller_name, v_caller_email
  FROM public.users WHERE id = v_caller_id;

  -- 3. Resolve deletion request from account_deletion_requests or profile_change_requests fallback
  SELECT * INTO v_del_req
  FROM public.account_deletion_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    -- Check profile_change_requests fallback
    SELECT id, user_id, requester_role as role, status,
           (requested_data->>'email') as email,
           (requested_data->>'full_name') as full_name,
           (requested_data->>'phone') as phone,
           (requested_data->>'reason') as reason
    INTO v_del_req
    FROM public.profile_change_requests
    WHERE id = p_request_id;
  END IF;

  IF v_del_req.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account deletion request not found.');
  END IF;

  IF v_del_req.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', format('Request is already %s.', v_del_req.status));
  END IF;

  -- 4. Target user resolution
  v_target_user_id := v_del_req.user_id;
  IF v_target_user_id IS NULL AND v_del_req.email IS NOT NULL THEN
    SELECT id INTO v_target_user_id FROM public.users WHERE LOWER(email) = LOWER(v_del_req.email) LIMIT 1;
  END IF;

  IF v_target_user_id IS NOT NULL THEN
    SELECT * INTO v_target_user FROM public.users WHERE id = v_target_user_id;

    -- Guard: Cannot delete Super Admin accounts
    IF v_target_user.role = 'super_admin' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Super Administrator accounts cannot be deleted.');
    END IF;

    -- Prevent self-deletion via approval
    IF v_target_user_id = v_caller_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'You cannot approve your own account deletion request.');
    END IF;

    -- Hierarchy check: admin cannot delete super_admin (already checked), manager/hr cannot delete admin
    IF v_caller_role IN ('manager', 'hr') AND v_target_user.role IN ('super_admin', 'admin') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Permission denied. Only Super Admins and Admins can authorize deletions for management accounts.');
    END IF;
  END IF;

  v_final_notes := COALESCE(NULLIF(TRIM(p_admin_notes), ''), 'Approved by administrator. Account de-provisioned.');

  -- 5. Update account_deletion_requests
  UPDATE public.account_deletion_requests
  SET status = 'approved',
      admin_notes = v_final_notes,
      reviewed_by = v_caller_id,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_request_id;

  -- Also update profile_change_requests if it exists there
  UPDATE public.profile_change_requests
  SET status = 'approved',
      reviewed_by = v_caller_id,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_request_id;

  -- 6. Deactivate user account & purge personal KYC identifiers while preserving statutory logs
  IF v_target_user_id IS NOT NULL THEN
    UPDATE public.users
    SET status = 'inactive',
        aadhaar_number = NULL,
        license_number = NULL,
        supervisor_id = NULL,
        updated_at = NOW()
    WHERE id = v_target_user_id;

    -- End active machine assignments
    UPDATE public.operator_machine_assignments
    SET is_active = false,
        ended_at = NOW(),
        ended_by = v_caller_id,
        end_reason = 'account_deleted',
        updated_at = NOW()
    WHERE operator_id = v_target_user_id
      AND is_active = true;

    -- Detach from machines
    UPDATE public.machines
    SET current_operator_id = NULL
    WHERE current_operator_id = v_target_user_id;

    UPDATE public.machines
    SET operator_ids = array_remove(operator_ids, v_target_user_id)
    WHERE v_target_user_id = ANY(operator_ids);

    UPDATE public.machines
    SET current_supervisor_id = NULL
    WHERE current_supervisor_id = v_target_user_id;

    UPDATE public.machines
    SET supervisor_ids = array_remove(supervisor_ids, v_target_user_id)
    WHERE v_target_user_id = ANY(supervisor_ids);
  END IF;

  -- 7. Insert Audit Log
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
    'user.account_deleted',
    'account_deletion_request',
    p_request_id::text,
    to_jsonb(format('Account deletion for %s (%s) approved by %s', COALESCE(v_del_req.full_name, v_del_req.email), COALESCE(v_del_req.role, 'user'), v_caller_name)),
    jsonb_build_object(
      'request_id', p_request_id,
      'target_user_id', v_target_user_id,
      'target_email', v_del_req.email,
      'target_name', v_del_req.full_name,
      'admin_notes', v_final_notes,
      'approved_by_id', v_caller_id,
      'approved_by_name', v_caller_name,
      'approved_by_email', v_caller_email,
      'approved_by_role', v_caller_role
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Account deletion for %s has been approved.', COALESCE(v_del_req.full_name, v_del_req.email)),
    'user_id', v_target_user_id
  );
END;
$$;

-- 2. Reject Account Deletion Request Atomic
CREATE OR REPLACE FUNCTION public.reject_account_deletion_request_atomic(
  p_request_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_caller_name TEXT;
  v_caller_email TEXT;
  v_del_req RECORD;
  v_final_notes TEXT;
BEGIN
  -- 1. Authentication check
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required. Please sign in.');
  END IF;

  -- 2. Caller role check
  v_caller_role := public.current_user_role();
  IF v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'hr') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied. Only Super Admin, Admin, Manager, and HR can decline deletion requests.');
  END IF;

  SELECT full_name, email INTO v_caller_name, v_caller_email
  FROM public.users WHERE id = v_caller_id;

  -- 3. Resolve deletion request
  SELECT * INTO v_del_req
  FROM public.account_deletion_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    SELECT id, user_id, requester_role as role, status,
           (requested_data->>'email') as email,
           (requested_data->>'full_name') as full_name,
           (requested_data->>'phone') as phone,
           (requested_data->>'reason') as reason
    INTO v_del_req
    FROM public.profile_change_requests
    WHERE id = p_request_id;
  END IF;

  IF v_del_req.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account deletion request not found.');
  END IF;

  IF v_del_req.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', format('Request is already %s.', v_del_req.status));
  END IF;

  v_final_notes := COALESCE(NULLIF(TRIM(p_admin_notes), ''), 'Request declined by administrator.');

  -- 4. Update request status
  UPDATE public.account_deletion_requests
  SET status = 'rejected',
      admin_notes = v_final_notes,
      reviewed_by = v_caller_id,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_request_id;

  UPDATE public.profile_change_requests
  SET status = 'rejected',
      rejection_reason = v_final_notes,
      reviewed_by = v_caller_id,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_request_id;

  -- 5. Insert Audit Log
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
    'user.account_deletion_rejected',
    'account_deletion_request',
    p_request_id::text,
    to_jsonb(format('Account deletion for %s declined by %s', COALESCE(v_del_req.full_name, v_del_req.email), v_caller_name)),
    jsonb_build_object(
      'request_id', p_request_id,
      'target_email', v_del_req.email,
      'target_name', v_del_req.full_name,
      'admin_notes', v_final_notes,
      'rejected_by_id', v_caller_id,
      'rejected_by_name', v_caller_name,
      'rejected_by_email', v_caller_email,
      'rejected_by_role', v_caller_role
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Account deletion request for %s has been declined.', COALESCE(v_del_req.full_name, v_del_req.email))
  );
END;
$$;

-- 3. Hardened reject_user_registration_atomic
CREATE OR REPLACE FUNCTION public.reject_user_registration_atomic(
  p_target_user_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_caller_role TEXT;
  v_caller_name TEXT;
  v_caller_email TEXT;
  v_target_user RECORD;
BEGIN
  -- 1. Authentication check
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  -- 2. Caller role check
  v_caller_role := public.current_user_role();
  IF v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'hr') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied. Only Super Admin, Admin, Manager, and HR can decline registrations.');
  END IF;

  SELECT full_name, email INTO v_caller_name, v_caller_email
  FROM public.users WHERE id = v_caller_id;

  -- 3. Target user check
  SELECT * INTO v_target_user
  FROM public.users WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found.');
  END IF;

  IF v_target_user.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', format('Only pending registrations can be declined (current status: %s).', v_target_user.status));
  END IF;

  IF v_caller_role IN ('manager', 'hr') AND v_target_user.role IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied. Only Super Admin and Admin can decline administrative accounts.');
  END IF;

  IF v_caller_role = 'admin' AND v_target_user.role = 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied. Only Super Admin can decline Super Admin accounts.');
  END IF;

  -- 4. Insert audit log BEFORE cleanup to preserve immutable audit trail
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
    'user.rejected',
    'user',
    p_target_user_id::text,
    to_jsonb(format('Registration for %s (%s) declined by %s', v_target_user.full_name, v_target_user.role, v_caller_name)),
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'target_user_name', v_target_user.full_name,
      'target_user_email', v_target_user.email,
      'target_user_role', v_target_user.role,
      'reason', p_reason,
      'rejected_by_id', v_caller_id,
      'rejected_by_name', v_caller_name,
      'rejected_by_email', v_caller_email,
      'rejected_by_role', v_caller_role
    ),
    NOW()
  );

  -- 5. Safe cleanup: Remove unapproved pending user from auth.users (cascades to public.users)
  -- This prevents duplicate/stale inactive accounts in Supabase
  BEGIN
    DELETE FROM auth.users WHERE id = p_target_user_id;
  EXCEPTION WHEN OTHERS THEN
    -- Fallback: mark inactive if auth deletion encounters constraint
    UPDATE public.users
    SET status = 'inactive',
        updated_at = NOW()
    WHERE id = p_target_user_id;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Registration for %s has been declined and removed.', v_target_user.full_name),
    'user_id', p_target_user_id
  );
END;
$$;

-- Grant permissions to authenticated
GRANT EXECUTE ON FUNCTION public.approve_account_deletion_request_atomic(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_account_deletion_request_atomic(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_user_registration_atomic(UUID, TEXT) TO authenticated;
