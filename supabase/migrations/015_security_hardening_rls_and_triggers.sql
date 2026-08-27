-- ============================================
-- Migration 015: Security Hardening — RLS Policy Restrictions & Self-Mutation Prevention
-- Fixes: F02 (machine_hour_logs open write), F03 (users self-privilege escalation)
-- ============================================

-- ==============================
-- F03: Prevent Self-Privilege Escalation on public.users
-- ==============================

-- Create trigger function that blocks any user from changing their own role or status
CREATE OR REPLACE FUNCTION public.prevent_self_role_status_mutation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only enforce for non-service-role connections (i.e., authenticated users via RLS)
  -- Service role (admin client) bypasses RLS and triggers remain needed for admin operations
  IF current_setting('request.jwt.claim.sub', true) IS NOT NULL 
     AND NEW.id = (current_setting('request.jwt.claim.sub', true))::uuid THEN
    -- Block self-mutation of role
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      RAISE EXCEPTION 'SECURITY VIOLATION: Users cannot change their own role. Contact an administrator.';
    END IF;
    -- Block self-mutation of status
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      RAISE EXCEPTION 'SECURITY VIOLATION: Users cannot change their own status. Contact an administrator.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_self_role_status_mutation ON public.users;
CREATE TRIGGER trg_prevent_self_role_status_mutation
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_status_mutation();

-- ==============================
-- F02: Restrict machine_hour_logs Write RLS Policies
-- ==============================

-- Drop the overly permissive "FOR ALL USING (true)" write policy
DROP POLICY IF EXISTS "Allow authenticated write machine_hour_logs" ON public.machine_hour_logs;

-- Operators can INSERT their own logs only
DROP POLICY IF EXISTS "operators_insert_own_logs" ON public.machine_hour_logs;
CREATE POLICY "operators_insert_own_logs" ON public.machine_hour_logs
  FOR INSERT TO authenticated
  WITH CHECK (operator_id = auth.uid());

-- Operators can UPDATE their own logs; supervisors/admins can update any log
DROP POLICY IF EXISTS "users_update_logs" ON public.machine_hour_logs;
CREATE POLICY "users_update_logs" ON public.machine_hour_logs
  FOR UPDATE TO authenticated
  USING (
    operator_id = auth.uid()
    OR public.current_user_role() IN ('super_admin', 'admin', 'supervisor')
  )
  WITH CHECK (
    operator_id = auth.uid()
    OR public.current_user_role() IN ('super_admin', 'admin', 'supervisor')
  );

-- Only admins and super_admins can DELETE logs
DROP POLICY IF EXISTS "admins_delete_logs" ON public.machine_hour_logs;
CREATE POLICY "admins_delete_logs" ON public.machine_hour_logs
  FOR DELETE TO authenticated
  USING (public.current_user_role() IN ('super_admin', 'admin'));

-- Keep the existing read policy (SELECT) — all authenticated users can read logs
-- (Already exists: "Allow authenticated read machine_hour_logs" FOR SELECT USING (true))
