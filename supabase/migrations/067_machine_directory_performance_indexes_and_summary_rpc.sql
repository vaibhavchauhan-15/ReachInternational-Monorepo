-- ==============================================================================
-- Migration 067: Machine Directory PostgreSQL Optimization, Trigram Indexes & KPI RPC
-- 1. Drops 9 duplicate/redundant indexes across machines, machine_hour_logs, users, oma
-- 2. Adds GIN trigram search indexes on machines (machine_id, model, serial_number, manufacturer)
-- 3. Adds B-tree index on machines (hour_meter DESC NULLS LAST)
-- 4. Adds composite partial index on operator_machine_assignments (machine_id, shift_start_time ASC)
-- 5. Converts operator_machine_assignments RLS policies to single-evaluation InitPlans
-- 6. Creates high-performance scalar KPI RPC get_machines_directory_summary()
-- ==============================================================================

-- 1. Drop redundant / duplicate indexes
DROP INDEX IF EXISTS public.idx_machines_status;
DROP INDEX IF EXISTS public.idx_machines_operator_active;
DROP INDEX IF EXISTS public.idx_machine_hour_logs_tstzrange;
DROP INDEX IF EXISTS public.idx_machine_hour_logs_machine_id;
DROP INDEX IF EXISTS public.idx_machine_hour_logs_client_id;
DROP INDEX IF EXISTS public.idx_machine_hour_logs_operator_id;
DROP INDEX IF EXISTS public.idx_machine_hour_logs_supervisor_id;
DROP INDEX IF EXISTS public.idx_users_role;
DROP INDEX IF EXISTS public.idx_oma_machine_active;

-- 2. Create missing high-impact indexes
CREATE INDEX IF NOT EXISTS idx_machines_machine_id_trgm 
  ON public.machines USING gin (machine_id gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_machines_model_trgm 
  ON public.machines USING gin (model gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_machines_serial_number_trgm 
  ON public.machines USING gin (serial_number gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_machines_manufacturer_trgm 
  ON public.machines USING gin (manufacturer gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_machines_hour_meter 
  ON public.machines USING btree (hour_meter DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_oma_machine_active_shift
  ON public.operator_machine_assignments USING btree (machine_id, shift_start_time ASC)
  WHERE is_active = true;

-- 3. RLS InitPlan optimization on operator_machine_assignments
DROP POLICY IF EXISTS oma_select_policy ON public.operator_machine_assignments;
CREATE POLICY oma_select_policy ON public.operator_machine_assignments
  FOR SELECT
  TO authenticated
  USING (
    ((SELECT current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'service_manager'::text, 'supervisor'::text]))
    OR (operator_id = (SELECT auth.uid()))
  );

DROP POLICY IF EXISTS oma_manage_policy ON public.operator_machine_assignments;
CREATE POLICY oma_manage_policy ON public.operator_machine_assignments
  FOR ALL
  TO authenticated
  USING ((SELECT current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'service_manager'::text, 'supervisor'::text]))
  WITH CHECK ((SELECT current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'service_manager'::text, 'supervisor'::text]));

-- 4. High-Performance Machine Directory KPI Aggregator RPC
CREATE OR REPLACE FUNCTION public.get_machines_directory_summary(
  p_supervisor_id uuid DEFAULT NULL,
  p_operator_id uuid DEFAULT NULL
)
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
    'available', COUNT(*) FILTER (WHERE status = 'available')::bigint,
    'rented', COUNT(*) FILTER (WHERE status = 'rented')::bigint,
    'breakdown', COUNT(*) FILTER (WHERE health_status = 'breakdown')::bigint,
    'maintenance', COUNT(*) FILTER (WHERE health_status = 'maintenance')::bigint,
    'spare', COUNT(*) FILTER (WHERE health_status = 'spare')::bigint,
    'active', COUNT(*) FILTER (WHERE health_status = 'active')::bigint
  )
  INTO v_result
  FROM public.machines
  WHERE
    (p_supervisor_id IS NULL OR current_supervisor_id = p_supervisor_id OR supervisor_ids @> ARRAY[p_supervisor_id])
    AND
    (p_operator_id IS NULL OR current_operator_id = p_operator_id OR operator_ids @> ARRAY[p_operator_id]);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_machines_directory_summary(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_machines_directory_summary(uuid, uuid) TO authenticated, service_role;
