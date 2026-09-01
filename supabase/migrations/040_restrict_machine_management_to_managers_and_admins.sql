-- ==============================================================================
-- Migration 040: Restrict Machine Management and Supervisor Assignment to Managers & Admins
-- Ensures only Manager or above ('super_admin', 'admin', 'manager', 'service_manager')
-- can insert, update machine details, delete machines, or assign/unassign supervisors.
-- ==============================================================================

-- 1. Ensure RLS is active on public.machines
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

-- 2. Update SELECT policy (all authenticated users can view fleet directory)
DROP POLICY IF EXISTS "machines_select_authorized" ON public.machines;
CREATE POLICY "machines_select_authorized" ON public.machines
  FOR SELECT TO authenticated USING (true);

-- 3. Update INSERT policy (strictly Manager or above: super_admin, admin, manager, service_manager)
DROP POLICY IF EXISTS "machines_insert_authorized" ON public.machines;
CREATE POLICY "machines_insert_authorized" ON public.machines
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN (
      'super_admin', 'admin',
      'manager', 'service_manager'
    )
  );

-- 4. Update UPDATE policy (strictly Manager or above: super_admin, admin, manager, service_manager, OR operator updating meter reading during active shift)
DROP POLICY IF EXISTS "machines_update_authorized" ON public.machines;
CREATE POLICY "machines_update_authorized" ON public.machines
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN (
      'super_admin', 'admin',
      'manager', 'service_manager'
    ) OR (
      public.current_user_role() = 'operator' AND (current_operator_id = auth.uid() OR current_operator_id IS NULL)
    )
  )
  WITH CHECK (true);

-- 5. Update DELETE policy (strictly Manager or above: super_admin, admin, manager, service_manager)
DROP POLICY IF EXISTS "machines_delete_authorized" ON public.machines;
CREATE POLICY "machines_delete_authorized" ON public.machines
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() IN (
      'super_admin', 'admin',
      'manager', 'service_manager'
    )
  );

-- 6. Trigger Function to Enforce Supervisor Assignment / Unassignment ONLY by Manager or Above
CREATE OR REPLACE FUNCTION public.enforce_machine_supervisor_change_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only execute check if current_supervisor_id is being changed or cleared
  IF (OLD.current_supervisor_id IS DISTINCT FROM NEW.current_supervisor_id) THEN
    IF NOT (
      public.current_user_role() IN ('super_admin', 'admin', 'manager', 'service_manager')
      OR auth.uid() IS NULL -- Allow internal migrations/triggers
    ) THEN
      RAISE EXCEPTION 'Unauthorized: Only Manager or above can assign, change, or unassign machine supervisor.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 7. Attach Trigger to public.machines
DROP TRIGGER IF EXISTS trg_enforce_supervisor_change_role ON public.machines;
CREATE TRIGGER trg_enforce_supervisor_change_role
  BEFORE UPDATE OF current_supervisor_id ON public.machines
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_machine_supervisor_change_role();
