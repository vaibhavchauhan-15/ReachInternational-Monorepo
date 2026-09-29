-- ==============================================================================
-- Migration 133: Pre-normalize Client Site Addresses and Optimize Operations Summary RPC
-- 1. Drops legacy overloaded signatures and standardizes on single get_operations_summary.
-- 2. Performs exact b-tree equality matches on either the provided site string or the
--    client's registered street address without substring/ILIKE checks.
-- ==============================================================================

DROP FUNCTION IF EXISTS public.get_operations_summary(uuid, uuid, uuid, date, date, text);
DROP FUNCTION IF EXISTS public.get_operations_summary(uuid, uuid, uuid, text, date, date);

CREATE OR REPLACE FUNCTION public.get_operations_summary(
  p_client_id UUID DEFAULT NULL,
  p_machine_id UUID DEFAULT NULL,
  p_operator_id UUID DEFAULT NULL,
  p_site TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
  v_query TEXT;
  v_where TEXT := 'WHERE 1=1';
  v_site_clean TEXT;
BEGIN
  IF p_client_id IS NOT NULL THEN
    v_where := v_where || ' AND mhl.client_id = ' || quote_literal(p_client_id);
  END IF;

  IF p_machine_id IS NOT NULL THEN
    v_where := v_where || ' AND mhl.machine_id = ' || quote_literal(p_machine_id);
  END IF;

  IF p_operator_id IS NOT NULL THEN
    v_where := v_where || ' AND mhl.operator_id = ' || quote_literal(p_operator_id);
  END IF;

  IF p_start_date IS NOT NULL THEN
    v_where := v_where || ' AND mhl.log_date >= ' || quote_literal(p_start_date);
  END IF;

  IF p_end_date IS NOT NULL THEN
    v_where := v_where || ' AND mhl.log_date <= ' || quote_literal(p_end_date);
  END IF;

  IF p_site IS NOT NULL AND p_site <> '' AND p_site <> 'all' THEN
    v_site_clean := btrim(p_site);
    IF p_client_id IS NOT NULL THEN
      -- Exact match on either the provided site string or client registered street address (0ms b-tree index scan, no substring check)
      v_where := v_where || ' AND (mhl.location = ' || quote_literal(v_site_clean) ||
                            ' OR mhl.location = (SELECT street FROM public.clients WHERE id = ' || quote_literal(p_client_id) || '))';
    ELSE
      v_where := v_where || ' AND mhl.location = ' || quote_literal(v_site_clean);
    END IF;
  END IF;

  v_query := 'SELECT jsonb_build_object(
    ''total_logs'', COUNT(*),
    ''total_run_hours'', ROUND(COALESCE(SUM(mhl.running_hours), 0)::numeric, 1),
    ''total_ot_hours'', ROUND(COALESCE(SUM(mhl.overtime_hours), 0)::numeric, 1),
    ''total_working_hours'', ROUND(COALESCE(SUM(COALESCE(mhl.normal_working_hours, 8)), 0)::numeric, 1),
    ''total_breakdowns'', COUNT(*) FILTER (WHERE mhl.is_breakdown = true),
    ''logged_days_count'', COUNT(DISTINCT mhl.log_date)
  ) FROM public.machine_hour_logs mhl ' || v_where;

  EXECUTE v_query INTO v_result;
  RETURN v_result;
END;
$$;
