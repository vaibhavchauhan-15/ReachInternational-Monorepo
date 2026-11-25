-- Rollback for 233_set_based_machines_rls.sql
-- Restores the 231 predicates (helper for every non-manager row).

DROP POLICY IF EXISTS "machines_select_authorized" ON public.machines;
CREATE POLICY "machines_select_authorized" ON public.machines
  FOR SELECT TO authenticated
  USING (
    (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
    OR public.check_user_can_access_machine(id, auth.uid())
  );

DROP POLICY IF EXISTS "machines_update_authorized" ON public.machines;
CREATE POLICY "machines_update_authorized" ON public.machines
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
    OR (
      (SELECT public.current_user_role()) IN ('supervisor', 'operator')
      AND public.check_user_can_access_machine(id, auth.uid())
    )
  )
  WITH CHECK (
    (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager')
    OR (
      (SELECT public.current_user_role()) IN ('supervisor', 'operator')
      AND public.check_user_can_access_machine(id, auth.uid())
    )
  );
