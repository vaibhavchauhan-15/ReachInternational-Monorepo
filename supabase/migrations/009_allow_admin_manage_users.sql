-- Migration 009: Grant Admin and Super Admin full User Management RLS Permissions
-- Allows both 'admin' and 'super_admin' roles to insert, update, and delete user records in public.users.

-- Drop existing user management policies if present
DROP POLICY IF EXISTS "users_insert_super_admin" ON public.users;
DROP POLICY IF EXISTS "users_update_super_admin" ON public.users;
DROP POLICY IF EXISTS "users_delete_super_admin" ON public.users;
DROP POLICY IF EXISTS "users_insert_admin" ON public.users;
DROP POLICY IF EXISTS "users_update_admin" ON public.users;
DROP POLICY IF EXISTS "users_delete_admin" ON public.users;

-- Create unified RLS policies for admin & super_admin
CREATE POLICY "users_insert_admin"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() IN ('super_admin', 'admin'));

CREATE POLICY "users_update_admin"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (public.current_user_role() IN ('super_admin', 'admin') OR id = auth.uid())
  WITH CHECK (public.current_user_role() IN ('super_admin', 'admin') OR id = auth.uid());

CREATE POLICY "users_delete_admin"
  ON public.users
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() IN ('super_admin', 'admin'));
