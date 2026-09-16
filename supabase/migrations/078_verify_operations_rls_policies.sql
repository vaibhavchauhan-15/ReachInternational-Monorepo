-- Migration 078: Operations Security & RLS Policy Verification Function
-- Provides public.verify_operations_rls_policies for automated security & RLS auditing

CREATE OR REPLACE FUNCTION public.verify_operations_rls_policies()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
STABLE
AS $$
  SELECT jsonb_build_object(
    'tables', (
      SELECT jsonb_agg(jsonb_build_object('tablename', tablename, 'rowsecurity', rowsecurity))
      FROM pg_tables
      WHERE schemaname = 'public' AND tablename IN ('machine_hour_logs', 'operator_machine_assignments', 'machines', 'clients')
    ),
    'policies', (
      SELECT jsonb_agg(policyname)
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename IN ('machine_hour_logs', 'operator_machine_assignments', 'machines', 'clients')
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.verify_operations_rls_policies() TO authenticated, anon, service_role;
