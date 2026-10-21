-- Migration 173: Add authoritative administrative password reset RPC with strict RBAC and audit logging

CREATE OR REPLACE FUNCTION public.admin_reset_user_password(
  target_user_id uuid,
  new_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  caller_id uuid;
  caller_role text;
  caller_email text;
  caller_name text;
  target_record record;
BEGIN
  -- 1. Enforce authentication
  caller_id := auth.uid();
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 2. Enforce caller RBAC (super_admin or admin)
  SELECT role, email, full_name INTO caller_role, caller_email, caller_name
  FROM public.users WHERE id = caller_id;

  IF caller_role NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Forbidden: Insufficient permissions to reset passwords';
  END IF;

  -- 3. Resolve target user
  SELECT id, full_name, email, role INTO target_record
  FROM public.users WHERE id = target_user_id;

  IF target_record.id IS NULL THEN
    RAISE EXCEPTION 'Target user not found';
  END IF;

  -- 4. Protection: admin cannot reset super_admin password
  IF caller_role = 'admin' AND target_record.role = 'super_admin' THEN
    RAISE EXCEPTION 'Only Super Admins can reset passwords for Super Admin accounts';
  END IF;

  -- 5. Protection: cannot reset own password via admin reset
  IF target_record.id = caller_id THEN
    RAISE EXCEPTION 'Please use Change Password in Settings to change your own password';
  END IF;

  -- 6. Password complexity guard
  IF length(new_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters long';
  END IF;

  -- 7. Securely update password hash in auth.users
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = target_user_id;

  -- 8. Write centralized audit log
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  VALUES (caller_id, 'user.password_reset', 'user', target_user_id, jsonb_build_object(
    'user_id', target_user_id,
    'user_email', target_record.email,
    'user_name', target_record.full_name,
    'reset_by', caller_email,
    'reset_by_name', caller_name
  ));

  RETURN jsonb_build_object(
    'success', true,
    'userName', target_record.full_name,
    'message', format('Password for %s has been reset successfully.', target_record.full_name)
  );
END;
$$;

-- Grant execution to authenticated users (internal RBAC check protects authorization)
GRANT EXECUTE ON FUNCTION public.admin_reset_user_password(uuid, text) TO authenticated;
