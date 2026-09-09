-- ==============================================================================
-- Migration 061: Supervisor Scoped Read-Only Access & Tightened Users RLS
-- 1. Tightens public.users SELECT RLS from permissive USING (true) to role-aware boundaries:
--    - Management roles: Full SELECT across all users
--    - Self-row: Every authenticated user can read their own profile
--    - Supervisor: Scoped SELECT strictly for assigned operators, mechanics, and engineers
-- 2. Maintains zero-mutation boundary for supervisors (INSERT/UPDATE/DELETE denied)
-- 3. Adds composite indexes for high-speed supervisor scope filtering and pagination
-- ==============================================================================

-- 1. Drop old permissive SELECT policy
DROP POLICY IF EXISTS "users_select_authenticated" ON public.users;
DROP POLICY IF EXISTS "users_select_management" ON public.users;
DROP POLICY IF EXISTS "users_select_self" ON public.users;
DROP POLICY IF EXISTS "users_select_supervisor_scoped" ON public.users;

-- 2. Management roles full SELECT policy
-- Uses cached (SELECT public.current_user_role()) per Supabase RLS performance guidelines
CREATE POLICY "users_select_management" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.current_user_role()) IN (
      'super_admin', 'admin', 'manager', 'service_manager', 'hr_manager', 'store_manager'
    )
  );

-- 3. Self-row SELECT policy (every authenticated user can read their own account profile)
CREATE POLICY "users_select_self" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
  );

-- 4. Supervisor Scoped SELECT policy
-- Supervisors can view only field personnel assigned to them (via supervisor_id or supervisor_ids array)
CREATE POLICY "users_select_supervisor_scoped" ON public.users
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.current_user_role()) = 'supervisor'
    AND role IN ('operator', 'mechanic', 'service_engineer', 'engineer')
    AND (
      supervisor_id = (SELECT auth.uid())
      OR supervisor_ids @> ARRAY[(SELECT auth.uid())]
    )
  );

-- 5. Performance Indexes for Scoped Lookups
CREATE INDEX IF NOT EXISTS idx_users_supervisor_id
  ON public.users(supervisor_id);

CREATE INDEX IF NOT EXISTS idx_users_role_supervisor_id
  ON public.users(role, supervisor_id);

CREATE INDEX IF NOT EXISTS idx_users_supervisor_ids
  ON public.users USING GIN (supervisor_ids);
