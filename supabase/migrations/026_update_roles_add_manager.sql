-- ============================================
-- Migration 026: Consolidate User Roles (Remove rental_manager, sales_executive, finance_manager; Add manager)
-- ============================================

-- 1. Drop the old check constraint first so 'manager' is accepted
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Migrate any existing deprecated roles in public.users to 'manager'
UPDATE public.users 
SET role = 'manager', updated_at = NOW()
WHERE role IN ('rental_manager', 'sales_executive', 'finance_manager', 'branch_manager', 'sales_manager', 'company_admin');

-- 3. Add updated public.users role check constraint
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (
  role IN (
    'super_admin',
    'admin',
    'manager',
    'service_manager',
    'service_engineer',
    'engineer',
    'supervisor',
    'store_manager',
    'operator',
    'mechanic',
    'hr_manager'
  )
);

-- 4. Update Machines RLS Policies
DROP POLICY IF EXISTS "machines_insert_authorized" ON public.machines;
CREATE POLICY "machines_insert_authorized" ON public.machines
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN (
      'super_admin', 'admin', 'manager',
      'service_manager', 'store_manager'
    )
  );

DROP POLICY IF EXISTS "machines_update_authorized" ON public.machines;
CREATE POLICY "machines_update_authorized" ON public.machines
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN (
      'super_admin', 'admin', 'manager',
      'service_manager', 'store_manager', 'supervisor', 'service_engineer'
    ) OR current_supervisor_id = auth.uid() OR current_operator_id = auth.uid()
  )
  WITH CHECK (true);

-- 5. Update Clients RLS Policies
DROP POLICY IF EXISTS "clients_select_policy" ON public.clients;
CREATE POLICY "clients_select_policy" ON public.clients
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'admin', 'manager', 'service_manager')
    )
  );

DROP POLICY IF EXISTS "clients_insert_policy" ON public.clients;
CREATE POLICY "clients_insert_policy" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'admin', 'manager', 'service_manager')
    )
  );

DROP POLICY IF EXISTS "clients_update_policy" ON public.clients;
CREATE POLICY "clients_update_policy" ON public.clients
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'admin', 'manager', 'service_manager')
    )
  );

DROP POLICY IF EXISTS "clients_delete_policy" ON public.clients;
CREATE POLICY "clients_delete_policy" ON public.clients
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'admin', 'manager', 'service_manager')
    )
  );
