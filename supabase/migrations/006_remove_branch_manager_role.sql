-- ============================================
-- Migration 006: Remove branch_manager role check constraints & update RLS policies
-- ============================================

-- 1. Update public.users role check constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (
  role IN (
    'super_admin', 'admin', 'company_admin', 'service_manager',
    'rental_manager', 'sales_manager', 'store_manager', 'hr_manager', 'finance_manager',
    'supervisor', 'service_engineer', 'engineer', 'mechanic', 'operator'
  )
);

-- Migrate any existing branch_manager users to service_manager (or admin if applicable)
UPDATE public.users SET role = 'service_manager' WHERE role = 'branch_manager';

-- 2. Update Machines RLS Policies
DROP POLICY IF EXISTS "machines_insert_authorized" ON public.machines;
CREATE POLICY "machines_insert_authorized" ON public.machines
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN (
      'super_admin', 'admin', 'company_admin',
      'service_manager', 'rental_manager', 'store_manager'
    )
  );

DROP POLICY IF EXISTS "machines_update_authorized" ON public.machines;
CREATE POLICY "machines_update_authorized" ON public.machines
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN (
      'super_admin', 'admin', 'company_admin',
      'service_manager', 'rental_manager', 'store_manager', 'supervisor', 'service_engineer'
    ) OR current_supervisor_id = auth.uid() OR current_operator_id = auth.uid()
  )
  WITH CHECK (true);

-- 3. Update Clients RLS Policies
DROP POLICY IF EXISTS "clients_select_policy" ON public.clients;
CREATE POLICY "clients_select_policy" ON public.clients
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'admin', 'service_manager', 'rental_manager', 'sales_executive')
    )
  );

DROP POLICY IF EXISTS "clients_insert_policy" ON public.clients;
CREATE POLICY "clients_insert_policy" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'admin', 'service_manager', 'rental_manager', 'sales_executive')
    )
  );

DROP POLICY IF EXISTS "clients_update_policy" ON public.clients;
CREATE POLICY "clients_update_policy" ON public.clients
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'admin', 'service_manager', 'rental_manager', 'sales_manager')
    )
  );

DROP POLICY IF EXISTS "clients_delete_policy" ON public.clients;
CREATE POLICY "clients_delete_policy" ON public.clients
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'admin', 'service_manager')
    )
  );
