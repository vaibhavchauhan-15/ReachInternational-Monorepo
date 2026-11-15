-- ==============================================================================
-- Migration: 190_user_registration_and_profile_approval_rpcs.sql
-- Description: Atomic, secure RPCs for approving and rejecting pending user
--              registrations and profile change requests across Native Mobile & Web.
-- ==============================================================================

-- 1. Single User Registration Approval
CREATE OR REPLACE FUNCTION public.approve_user_registration_atomic(
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
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied. Only Super Admin, Admin, Manager, and HR can approve registrations.');
  END IF;

  SELECT full_name, email INTO v_caller_name, v_caller_email
  FROM public.users WHERE id = v_caller_id;

  -- 3. Target user check
  SELECT * INTO v_target_user
  FROM public.users WHERE id = p_target_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User not found.');
  END IF;

  -- Idempotency: if user is already active, return success
  IF v_target_user.status = 'active' THEN
    RETURN jsonb_build_object('success', true, 'already_active', true, 'message', format('User %s is already active.', v_target_user.full_name));
  END IF;

  IF v_target_user.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', format('User is not pending approval (current status: %s).', v_target_user.status));
  END IF;

  -- Role hierarchy: Manager and HR cannot approve admin or super_admin
  IF v_caller_role IN ('manager', 'hr') AND v_target_user.role IN ('super_admin', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied. Only Super Admin and Admin can approve administrative accounts.');
  END IF;

  IF v_caller_role = 'admin' AND v_target_user.role = 'super_admin' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied. Only Super Admin can approve Super Admin accounts.');
  END IF;

  -- 4. Atomically activate in public.users
  UPDATE public.users
  SET status = 'active',
      updated_at = NOW()
  WHERE id = p_target_user_id;

  -- 5. Confirm email in auth.users so user can log in
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      updated_at = NOW()
  WHERE id = p_target_user_id;

  -- 6. Insert structured audit log
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
    'user.approved',
    'user',
    p_target_user_id::text,
    to_jsonb(format('User %s (%s) registration approved by %s', v_target_user.full_name, v_target_user.role, v_caller_name)),
    jsonb_build_object(
      'target_user_id', p_target_user_id,
      'target_user_name', v_target_user.full_name,
      'target_user_email', v_target_user.email,
      'target_user_role', v_target_user.role,
      'approved_by_id', v_caller_id,
      'approved_by_name', v_caller_name,
      'approved_by_email', v_caller_email,
      'approved_by_role', v_caller_role
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', format('User %s has been approved.', v_target_user.full_name),
    'user_id', p_target_user_id
  );
END;
$$;

-- 2. Single User Registration Rejection
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

  -- 4. Deactivate safely
  UPDATE public.users
  SET status = 'inactive',
      updated_at = NOW()
  WHERE id = p_target_user_id;

  -- 5. Insert audit log
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

  RETURN jsonb_build_object(
    'success', true,
    'message', format('Registration for %s has been declined.', v_target_user.full_name),
    'user_id', p_target_user_id
  );
END;
$$;

-- 3. Bulk User Registration Approval
CREATE OR REPLACE FUNCTION public.bulk_approve_user_registrations_atomic(
  p_user_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_approved_count INT := 0;
  v_res JSONB;
BEGIN
  IF p_user_ids IS NULL OR array_length(p_user_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', true, 'approved_count', 0);
  END IF;

  FOREACH v_uid IN ARRAY p_user_ids LOOP
    v_res := public.approve_user_registration_atomic(v_uid);
    IF (v_res->>'success')::boolean = true THEN
      v_approved_count := v_approved_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'approved_count', v_approved_count,
    'total_requested', array_length(p_user_ids, 1)
  );
END;
$$;

-- 4. Bulk User Registration Rejection
CREATE OR REPLACE FUNCTION public.bulk_reject_user_registrations_atomic(
  p_user_ids UUID[],
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid UUID;
  v_rejected_count INT := 0;
  v_res JSONB;
BEGIN
  IF p_user_ids IS NULL OR array_length(p_user_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', true, 'rejected_count', 0);
  END IF;

  FOREACH v_uid IN ARRAY p_user_ids LOOP
    v_res := public.reject_user_registration_atomic(v_uid, p_reason);
    IF (v_res->>'success')::boolean = true THEN
      v_rejected_count := v_rejected_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'rejected_count', v_rejected_count,
    'total_requested', array_length(p_user_ids, 1)
  );
END;
$$;

-- 5. Single Profile Change Request Approval
CREATE OR REPLACE FUNCTION public.approve_profile_change_request_atomic(
  p_request_id UUID
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
  v_request RECORD;
  v_req_data JSONB;
  v_target_user_id UUID;
BEGIN
  -- 1. Authentication check
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  v_caller_role := public.current_user_role();
  IF v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'hr') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied. Only Super Admin, Admin, Manager, and HR can review profile change requests.');
  END IF;

  SELECT full_name, email INTO v_caller_name, v_caller_email
  FROM public.users WHERE id = v_caller_id;

  -- 2. Fetch the request
  SELECT * INTO v_request
  FROM public.profile_change_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile change request not found.');
  END IF;

  IF v_request.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', format('Request is no longer pending (current status: %s).', v_request.status));
  END IF;

  -- Hierarchy check
  IF v_caller_role = 'super_admin' THEN
    -- Super admin can approve all
  ELSIF v_caller_role = 'admin' THEN
    IF v_request.requester_role IN ('super_admin', 'admin') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Permission denied. Only Super Admins can approve profile changes for Admin accounts.');
    END IF;
  ELSIF v_caller_role IN ('manager', 'hr') THEN
    IF v_request.requester_role IN ('super_admin', 'admin', 'manager', 'hr') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Permission denied. You do not have authorization to approve profile changes for this role.');
    END IF;
  END IF;

  v_target_user_id := v_request.user_id;
  v_req_data := v_request.requested_data;

  -- 3. Atomically transition request status
  UPDATE public.profile_change_requests
  SET status = 'approved',
      reviewed_by = v_caller_id,
      reviewed_at = NOW(),
      updated_at = NOW()
  WHERE id = p_request_id AND status = 'pending';

  -- 4. Apply approved fields selectively to public.users
  UPDATE public.users
  SET
    full_name = COALESCE(v_req_data->>'full_name', full_name),
    phone = CASE WHEN v_req_data ? 'phone' THEN NULLIF(v_req_data->>'phone', '') ELSE phone END,
    street = CASE WHEN v_req_data ? 'street' THEN NULLIF(v_req_data->>'street', '')
                  WHEN v_req_data ? 'address' THEN NULLIF(v_req_data->>'address', '')
                  ELSE street END,
    city = COALESCE(v_req_data->>'city', city),
    district = COALESCE(v_req_data->>'district', district),
    state = COALESCE(v_req_data->>'state', state),
    state_id = CASE WHEN (v_req_data ? 'state_id') AND (v_req_data->>'state_id') IS NOT NULL AND (v_req_data->>'state_id') <> ''
                    THEN (v_req_data->>'state_id')::INT ELSE state_id END,
    aadhaar_number = CASE WHEN v_req_data ? 'aadhaar_number' THEN NULLIF(v_req_data->>'aadhaar_number', '') ELSE aadhaar_number END,
    license_number = CASE WHEN v_req_data ? 'license_number' THEN NULLIF(v_req_data->>'license_number', '') ELSE license_number END,
    bank_account_number = CASE WHEN v_req_data ? 'bank_account_number' THEN NULLIF(v_req_data->>'bank_account_number', '') ELSE bank_account_number END,
    bank_ifsc_code = CASE WHEN v_req_data ? 'bank_ifsc_code' THEN NULLIF(v_req_data->>'bank_ifsc_code', '') ELSE bank_ifsc_code END,
    shift_start_time = CASE WHEN v_req_data ? 'shift_start_time' THEN (v_req_data->>'shift_start_time')::TIME ELSE shift_start_time END,
    shift_end_time = CASE WHEN v_req_data ? 'shift_end_time' THEN (v_req_data->>'shift_end_time')::TIME ELSE shift_end_time END,
    updated_at = NOW()
  WHERE id = v_target_user_id;

  -- 5. Write audit log
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
    'profile.approved',
    'profile_change_request',
    p_request_id::text,
    to_jsonb(format('Profile change request for user %s approved by %s', v_target_user_id, v_caller_name)),
    jsonb_build_object(
      'request_id', p_request_id,
      'target_user_id', v_target_user_id,
      'reviewed_by_id', v_caller_id,
      'reviewed_by_name', v_caller_name,
      'reviewed_by_role', v_caller_role,
      'requested_data', v_req_data
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Profile changes have been approved and applied.',
    'request_id', p_request_id,
    'user_id', v_target_user_id
  );
END;
$$;

-- 6. Single Profile Change Request Rejection
CREATE OR REPLACE FUNCTION public.reject_profile_change_request_atomic(
  p_request_id UUID,
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
  v_request RECORD;
BEGIN
  -- 1. Authentication check
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required.');
  END IF;

  v_caller_role := public.current_user_role();
  IF v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'hr') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Permission denied. Only Super Admin, Admin, Manager, and HR can decline profile change requests.');
  END IF;

  SELECT full_name INTO v_caller_name
  FROM public.users WHERE id = v_caller_id;

  SELECT * INTO v_request
  FROM public.profile_change_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Profile change request not found.');
  END IF;

  IF v_request.status <> 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', format('Request is no longer pending (current status: %s).', v_request.status));
  END IF;

  -- 2. Update status
  UPDATE public.profile_change_requests
  SET status = 'rejected',
      reviewed_by = v_caller_id,
      reviewed_at = NOW(),
      rejection_reason = p_reason,
      updated_at = NOW()
  WHERE id = p_request_id AND status = 'pending';

  -- 3. Audit log
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
    'profile.rejected',
    'profile_change_request',
    p_request_id::text,
    to_jsonb(format('Profile change request for user %s declined by %s', v_request.user_id, v_caller_name)),
    jsonb_build_object(
      'request_id', p_request_id,
      'target_user_id', v_request.user_id,
      'reason', p_reason,
      'reviewed_by_id', v_caller_id,
      'reviewed_by_name', v_caller_name
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Profile change request has been declined.',
    'request_id', p_request_id
  );
END;
$$;

-- 7. Bulk Profile Change Requests Approval
CREATE OR REPLACE FUNCTION public.bulk_approve_profile_change_requests_atomic(
  p_request_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_rid UUID;
  v_approved_count INT := 0;
  v_res JSONB;
BEGIN
  IF p_request_ids IS NULL OR array_length(p_request_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', true, 'approved_count', 0);
  END IF;

  FOREACH v_rid IN ARRAY p_request_ids LOOP
    v_res := public.approve_profile_change_request_atomic(v_rid);
    IF (v_res->>'success')::boolean = true THEN
      v_approved_count := v_approved_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'approved_count', v_approved_count,
    'total_requested', array_length(p_request_ids, 1)
  );
END;
$$;

-- 8. Bulk Profile Change Requests Rejection
CREATE OR REPLACE FUNCTION public.bulk_reject_profile_change_requests_atomic(
  p_request_ids UUID[],
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_rid UUID;
  v_rejected_count INT := 0;
  v_res JSONB;
BEGIN
  IF p_request_ids IS NULL OR array_length(p_request_ids, 1) = 0 THEN
    RETURN jsonb_build_object('success', true, 'rejected_count', 0);
  END IF;

  FOREACH v_rid IN ARRAY p_request_ids LOOP
    v_res := public.reject_profile_change_request_atomic(v_rid, p_reason);
    IF (v_res->>'success')::boolean = true THEN
      v_rejected_count := v_rejected_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'rejected_count', v_rejected_count,
    'total_requested', array_length(p_request_ids, 1)
  );
END;
$$;

-- 9. Explicit Security Permissions
GRANT EXECUTE ON FUNCTION public.approve_user_registration_atomic(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_user_registration_atomic(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_approve_user_registrations_atomic(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_reject_user_registrations_atomic(UUID[], TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_profile_change_request_atomic(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_profile_change_request_atomic(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_approve_profile_change_requests_atomic(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bulk_reject_profile_change_requests_atomic(UUID[], TEXT) TO authenticated;
