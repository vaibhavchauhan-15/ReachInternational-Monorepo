-- ==============================================================================
-- MIGRATION: 021_optimize_rls_functions.sql
-- PURPOSE: Optimize RLS Helper Functions (STABLE caching & secure search_path)
-- ==============================================================================

-- Optimize public.current_user_role():
-- 1. Mark as STABLE: Tells PostgreSQL query planner the function returns the same value
--    within a single statement/transaction for the same auth.uid(). Eliminates per-row
--    re-execution across multi-row RLS queries (e.g. 500 logs = 1 lookup instead of 500).
-- 2. Explicit SET search_path = public, pg_temp: Prevents search_path hijacking in SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid();
  RETURN user_role;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Helper: Check if current authenticated user is super_admin or admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (public.current_user_role() IN ('super_admin', 'admin'));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- Helper: Check if current authenticated user is supervisor or above
CREATE OR REPLACE FUNCTION public.is_supervisor_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (public.current_user_role() IN ('super_admin', 'admin', 'supervisor'));
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
