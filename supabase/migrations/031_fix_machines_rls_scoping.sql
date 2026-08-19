-- Migration: 031_fix_machines_rls_scoping.sql
-- Description: Update RLS policies on public.machines to grant select access to authenticated users based on organization, branch, or assignment scoping.

DROP POLICY IF EXISTS "machines_select_all_admin" ON public.machines;
DROP POLICY IF EXISTS "machines_select_assigned_engineer" ON public.machines;
DROP POLICY IF EXISTS "machines_select_authenticated" ON public.machines;

CREATE POLICY "machines_select_authenticated" ON public.machines
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('super_admin', 'admin', 'hr_manager', 'finance_manager')
    OR engineer_id = auth.uid()
    OR current_operator_id = auth.uid()
    OR public.auth_user_has_branch_access(branch_id)
  );
