-- ============================================
-- Migration 034: Allow Managers, Service Managers, and Admins to Add, Edit, and Delete Machines
-- ============================================

-- 1. Ensure RLS is active on public.machines
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

-- 2. Update SELECT policy
DROP POLICY IF EXISTS "machines_select_authorized" ON public.machines;
CREATE POLICY "machines_select_authorized" ON public.machines
  FOR SELECT TO authenticated USING (true);

-- 3. Update INSERT policy (allow super_admin, admin, manager, service_manager, store_manager)
DROP POLICY IF EXISTS "machines_insert_authorized" ON public.machines;
CREATE POLICY "machines_insert_authorized" ON public.machines
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN (
      'super_admin', 'admin',
      'manager', 'service_manager', 'store_manager'
    )
  );

-- 4. Update UPDATE policy (allow super_admin, admin, manager, service_manager, store_manager, supervisor, service_engineer, or assigned supervisor/operator)
DROP POLICY IF EXISTS "machines_update_authorized" ON public.machines;
CREATE POLICY "machines_update_authorized" ON public.machines
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN (
      'super_admin', 'admin',
      'manager', 'service_manager', 'store_manager',
      'supervisor', 'service_engineer'
    ) OR current_supervisor_id = auth.uid() OR current_operator_id = auth.uid()
  )
  WITH CHECK (true);

-- 5. Update DELETE policy (allow super_admin, admin, manager, service_manager, company_admin)
DROP POLICY IF EXISTS "machines_delete_authorized" ON public.machines;
CREATE POLICY "machines_delete_authorized" ON public.machines
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() IN (
      'super_admin', 'admin',
      'manager', 'service_manager'
    )
  );
