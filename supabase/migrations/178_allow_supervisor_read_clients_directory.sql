-- ==============================================================================
-- Migration 178: Allow Supervisor Role Read-Only Access to Clients Directory
-- Target Dev Project: vlmxciuogczumumrwyot
--
-- Objectives:
-- 1. Update public.clients SELECT policy to allow 'supervisor' role read access
--    to active (non-deleted) client records in the client directory.
-- 2. Maintain strict write boundaries: ensure INSERT, UPDATE, and DELETE policies
--    on public.clients remain exclusively restricted to ('super_admin', 'admin', 'manager').
-- ==============================================================================

-- 1. Update public.clients SELECT policy to grant supervisor view access to active clients
DROP POLICY IF EXISTS "clients_select_policy" ON public.clients;
CREATE POLICY "clients_select_policy" ON public.clients
  FOR SELECT TO authenticated
  USING (
    ((SELECT current_user_role()) = ANY (ARRAY['super_admin', 'admin']))
    OR (
      deleted_at IS NULL
      AND (
        ((SELECT current_user_role()) = ANY (ARRAY['manager', 'hr', 'supervisor']))
        OR public.check_user_can_access_client(id, auth.uid())
      )
    )
  );

-- 2. Strictly enforce that INSERT is restricted to super_admin, admin, and manager
DROP POLICY IF EXISTS "clients_insert_policy" ON public.clients;
CREATE POLICY "clients_insert_policy" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT current_user_role()) = ANY (ARRAY['super_admin', 'admin', 'manager'])
  );

-- 3. Strictly enforce that UPDATE is restricted to super_admin, admin, and manager
DROP POLICY IF EXISTS "clients_update_policy" ON public.clients;
CREATE POLICY "clients_update_policy" ON public.clients
  FOR UPDATE TO authenticated
  USING (
    (SELECT current_user_role()) = ANY (ARRAY['super_admin', 'admin', 'manager'])
  );

-- 4. Strictly enforce that DELETE is restricted to super_admin, admin, and manager
DROP POLICY IF EXISTS "clients_delete_policy" ON public.clients;
CREATE POLICY "clients_delete_policy" ON public.clients
  FOR DELETE TO authenticated
  USING (
    (SELECT current_user_role()) = ANY (ARRAY['super_admin', 'admin', 'manager'])
  );

