-- ==============================================================================
-- Migration 066: PostgreSQL Index Optimization, RLS InitPlan Tuning & Summary RPC
-- 1. Drops 6 redundant and duplicate B-tree indexes identified during performance audit:
--    - idx_clients_code (redundant with unique index clients_code_key)
--    - idx_machines_machine_id (redundant with unique index machines_machine_id_key)
--    - idx_users_email & idx_users_email_unique (redundant with unique index users_email_key)
--    - users_role_idx (duplicate of idx_users_role)
--    - users_status_idx (duplicate of idx_users_status)
-- 2. Tunes RLS policies on public.machine_hour_logs and public.machines to wrap
--    current_user_role() and auth.uid() in scalar subqueries (SELECT ...),
--    forcing Postgres to evaluate them once per query (InitPlan) rather than once per row.
-- 3. Adds high-performance RPC function public.get_operations_summary() to compute
--    operational KPI metrics entirely inside Postgres with zero row transfer.
-- ==============================================================================

-- 1. Drop redundant/duplicate B-tree indexes
DROP INDEX IF EXISTS public.idx_clients_code;
DROP INDEX IF EXISTS public.idx_machines_machine_id;
DROP INDEX IF EXISTS public.idx_users_email;
DROP INDEX IF EXISTS public.idx_users_email_unique;
DROP INDEX IF EXISTS public.users_role_idx;
DROP INDEX IF EXISTS public.users_status_idx;

-- 2. Optimize RLS on machine_hour_logs to use InitPlan
DROP POLICY IF EXISTS admins_delete_logs ON public.machine_hour_logs;
CREATE POLICY admins_delete_logs ON public.machine_hour_logs
  FOR DELETE
  USING ((SELECT public.current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text]));

DROP POLICY IF EXISTS operators_and_admins_insert_logs ON public.machine_hour_logs;
CREATE POLICY operators_and_admins_insert_logs ON public.machine_hour_logs
  FOR INSERT
  WITH CHECK (
    (operator_id = (SELECT auth.uid()))
    OR ((SELECT public.current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'supervisor'::text]))
  );

DROP POLICY IF EXISTS users_update_logs ON public.machine_hour_logs;
CREATE POLICY users_update_logs ON public.machine_hour_logs
  FOR UPDATE
  USING (
    (operator_id = (SELECT auth.uid()))
    OR ((SELECT public.current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'supervisor'::text]))
  )
  WITH CHECK (
    (operator_id = (SELECT auth.uid()))
    OR ((SELECT public.current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'supervisor'::text]))
  );

-- 3. Optimize RLS on machines to use InitPlan
DROP POLICY IF EXISTS machines_delete_authorized ON public.machines;
CREATE POLICY machines_delete_authorized ON public.machines
  FOR DELETE
  USING ((SELECT public.current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'service_manager'::text]));

DROP POLICY IF EXISTS machines_insert_authorized ON public.machines;
CREATE POLICY machines_insert_authorized ON public.machines
  FOR INSERT
  WITH CHECK ((SELECT public.current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'service_manager'::text]));

DROP POLICY IF EXISTS machines_update_authorized ON public.machines;
CREATE POLICY machines_update_authorized ON public.machines
  FOR UPDATE
  USING (
    ((SELECT public.current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'service_manager'::text, 'supervisor'::text]))
    OR (
      ((SELECT public.current_user_role()) = 'operator'::text)
      AND (
        ((SELECT auth.uid()) = ANY (operator_ids))
        OR (current_operator_id = (SELECT auth.uid()))
        OR (current_operator_id IS NULL)
        OR (operator_ids = '{}'::uuid[])
      )
    )
  )
  WITH CHECK (true);

-- 4. High-performance scalar KPI summary aggregator RPC
CREATE OR REPLACE FUNCTION public.get_operations_summary(
  p_client_id uuid DEFAULT NULL,
  p_machine_id uuid DEFAULT NULL,
  p_operator_id uuid DEFAULT NULL,
  p_site text DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_run_hours numeric := 0;
  v_ot_hours numeric := 0;
  v_breakdowns bigint := 0;
  v_days bigint := 0;
BEGIN
  SELECT
    COALESCE(SUM(COALESCE(running_hours, GREATEST(0, ROUND((COALESCE(end_meter, start_meter, 0) - COALESCE(start_meter, 0))::numeric, 1)))), 0),
    COALESCE(SUM(COALESCE(overtime_hours, 0)), 0),
    COALESCE(COUNT(*) FILTER (WHERE is_breakdown = true), 0),
    COALESCE(COUNT(DISTINCT log_date), 0)
  INTO
    v_run_hours,
    v_ot_hours,
    v_breakdowns,
    v_days
  FROM public.machine_hour_logs
  WHERE (p_client_id IS NULL OR client_id = p_client_id)
    AND (p_machine_id IS NULL OR machine_id = p_machine_id)
    AND (p_operator_id IS NULL OR operator_id = p_operator_id)
    AND (p_site IS NULL OR p_site = 'all' OR location ILIKE '%' || p_site || '%')
    AND (p_start_date IS NULL OR log_date >= p_start_date)
    AND (p_end_date IS NULL OR log_date <= p_end_date);

  RETURN jsonb_build_object(
    'total_run_hours', ROUND(v_run_hours::numeric, 1),
    'total_ot_hours', ROUND(v_ot_hours::numeric, 1),
    'total_breakdowns', v_breakdowns,
    'logged_days_count', v_days
  );
END;
$$;

-- Grant execution permission to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.get_operations_summary TO authenticated, service_role;
