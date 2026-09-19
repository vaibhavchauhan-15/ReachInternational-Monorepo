-- Migration 086: Operator RBAC Governance and Super Admin Exclusive Log Deletion
--
-- Objectives:
-- 1. Restrict machine_hour_logs DELETE exclusively to super_admin.
-- 2. Restrict machine_hour_logs SELECT so operators can ONLY view their own logs (operator_id = auth.uid()),
--    while supervisory/management roles can view according to company scope.
-- 3. Restrict machine_hour_logs UPDATE so operators can ONLY update their own logs within 7 days (log_date >= CURRENT_DATE - 7),
--    while supervisory/management roles can update logs anytime.
-- 4. Restrict audit_logs SELECT so operators are strictly blocked (returns false).

-- 1. DELETE Policy on machine_hour_logs: Super Admin Exclusive
DROP POLICY IF EXISTS "admins_delete_logs" ON public.machine_hour_logs;
DROP POLICY IF EXISTS "super_admin_delete_machine_hour_logs" ON public.machine_hour_logs;

CREATE POLICY "super_admin_delete_machine_hour_logs" ON public.machine_hour_logs
  FOR DELETE
  USING ((SELECT public.current_user_role()) = 'super_admin'::text);

-- 2. SELECT Policy on machine_hour_logs: Own Logs Only for Operators
DROP POLICY IF EXISTS "Allow authenticated read machine_hour_logs" ON public.machine_hour_logs;
DROP POLICY IF EXISTS "view_machine_hour_logs" ON public.machine_hour_logs;

CREATE POLICY "view_machine_hour_logs" ON public.machine_hour_logs
  FOR SELECT
  USING (
    ((SELECT public.current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'supervisor'::text, 'hr'::text]))
    OR (((SELECT public.current_user_role()) = 'operator'::text) AND (operator_id = (SELECT auth.uid())))
  );

-- 3. UPDATE Policy on machine_hour_logs: Own Logs within 7 Days for Operators
DROP POLICY IF EXISTS "users_update_logs" ON public.machine_hour_logs;
DROP POLICY IF EXISTS "update_machine_hour_logs" ON public.machine_hour_logs;

CREATE POLICY "update_machine_hour_logs" ON public.machine_hour_logs
  FOR UPDATE
  USING (
    ((SELECT public.current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'supervisor'::text]))
    OR (((SELECT public.current_user_role()) = 'operator'::text) AND (operator_id = (SELECT auth.uid())) AND (log_date >= (CURRENT_DATE - 7)))
  )
  WITH CHECK (
    ((SELECT public.current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'supervisor'::text]))
    OR (((SELECT public.current_user_role()) = 'operator'::text) AND (operator_id = (SELECT auth.uid())) AND (log_date >= (CURRENT_DATE - 7)))
  );

-- 4. INSERT Policy on machine_hour_logs: Ensure manager is included alongside super_admin, admin, supervisor
DROP POLICY IF EXISTS "operators_and_admins_insert_logs" ON public.machine_hour_logs;
DROP POLICY IF EXISTS "insert_machine_hour_logs" ON public.machine_hour_logs;

CREATE POLICY "insert_machine_hour_logs" ON public.machine_hour_logs
  FOR INSERT
  WITH CHECK (
    (operator_id = (SELECT auth.uid()))
    OR ((SELECT public.current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'supervisor'::text]))
  );

-- 5. Block Operators from Viewing Audit Logs
DROP POLICY IF EXISTS "audit_logs_select_hierarchical" ON public.audit_logs;

CREATE POLICY "audit_logs_select_hierarchical" ON public.audit_logs
  FOR SELECT USING (
    CASE current_user_role()
      WHEN 'super_admin'::text THEN true
      WHEN 'admin'::text THEN true
      WHEN 'manager'::text THEN ((category IS DISTINCT FROM 'security'::text) OR (severity IS DISTINCT FROM 'critical'::text))
      WHEN 'hr'::text THEN (category = ANY (ARRAY['auth'::text, 'user'::text, 'profile'::text]))
      WHEN 'supervisor'::text THEN (category = ANY (ARRAY['assignment'::text, 'machine'::text, 'operations'::text, 'auth'::text]))
      WHEN 'operator'::text THEN false
      ELSE false
    END
  );
