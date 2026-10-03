-- ==============================================================================
-- Migration 156: Grant EXECUTE on RLS Helper Functions to anon, authenticated, service_role
-- Fixes PostgreSQL error 42501 (permission denied for function current_user_role)
-- when RLS policies evaluate current_user_role(), is_admin(), is_supervisor_or_admin()
-- during unauthenticated, initial hydration, or role-checking queries.
-- ==============================================================================

GRANT EXECUTE ON FUNCTION public.current_user_role() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_supervisor_or_admin() TO anon, authenticated, service_role;
