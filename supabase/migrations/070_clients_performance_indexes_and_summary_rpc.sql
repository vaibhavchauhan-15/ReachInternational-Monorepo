-- ==============================================================================
-- Migration 070: Client Directory PostgreSQL Optimization, Trigram Indexes & KPI RPC
-- 1. Adds GIN trigram indexes on clients (company_name, code, contact_person, phone, city)
-- 2. Adds composite B-tree index on clients (status, company_name ASC)
-- 3. Adds B-tree index on clients (city)
-- 4. Optimizes RLS policies on public.clients with single-evaluation InitPlans
-- 5. Creates high-performance scalar KPI RPC get_clients_directory_summary()
-- ==============================================================================

-- 1. Ensure pg_trgm extension exists
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- 2. Create missing GIN Trigram indexes for sub-millisecond substring search
CREATE INDEX IF NOT EXISTS idx_clients_company_name_trgm 
  ON public.clients USING gin (company_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_clients_code_trgm 
  ON public.clients USING gin (code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_clients_contact_person_trgm 
  ON public.clients USING gin (contact_person gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_clients_phone_trgm 
  ON public.clients USING gin (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_clients_city_trgm 
  ON public.clients USING gin (city gin_trgm_ops);

-- 3. Create composite & covering indexes for status filtering and sorting
CREATE INDEX IF NOT EXISTS idx_clients_status_company_name 
  ON public.clients (status, company_name ASC);

CREATE INDEX IF NOT EXISTS idx_clients_city 
  ON public.clients (city) 
  WHERE city IS NOT NULL AND btrim(city) <> '';

-- 4. RLS InitPlan optimization on public.clients
DROP POLICY IF EXISTS "clients_select_policy" ON public.clients;
CREATE POLICY "clients_select_policy" ON public.clients
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL OR
    ((SELECT current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'service_manager'::text, 'rental_manager'::text, 'sales_executive'::text]))
  );

DROP POLICY IF EXISTS "clients_insert_policy" ON public.clients;
CREATE POLICY "clients_insert_policy" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    ((SELECT current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'service_manager'::text, 'rental_manager'::text, 'sales_executive'::text]))
  );

DROP POLICY IF EXISTS "clients_update_policy" ON public.clients;
CREATE POLICY "clients_update_policy" ON public.clients
  FOR UPDATE TO authenticated
  USING (
    ((SELECT current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'service_manager'::text, 'rental_manager'::text, 'sales_manager'::text]))
  );

DROP POLICY IF EXISTS "clients_delete_policy" ON public.clients;
CREATE POLICY "clients_delete_policy" ON public.clients
  FOR DELETE TO authenticated
  USING (
    ((SELECT current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'service_manager'::text]))
  );

-- 5. High-Performance Client Directory KPI Aggregator RPC
CREATE OR REPLACE FUNCTION public.get_clients_directory_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total', COUNT(*)::bigint,
    'active', COUNT(*) FILTER (WHERE status = 'active' AND deleted_at IS NULL)::bigint,
    'inactive', COUNT(*) FILTER (WHERE status = 'inactive' OR deleted_at IS NOT NULL)::bigint,
    'cities', COUNT(DISTINCT NULLIF(btrim(city), ''))::bigint
  )
  INTO v_result
  FROM public.clients;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_clients_directory_summary() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_clients_directory_summary() TO authenticated, service_role;
