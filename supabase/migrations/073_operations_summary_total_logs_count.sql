-- Migration 073: Add total_logs count to get_operations_summary RPC
-- Enables instant summary-only loading without scanning machine_hour_logs row data.

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
  v_total_logs bigint := 0;
BEGIN
  SELECT
    COALESCE(SUM(COALESCE(running_hours, GREATEST(0, ROUND((COALESCE(end_meter, start_meter, 0) - COALESCE(start_meter, 0))::numeric, 1)))), 0),
    COALESCE(SUM(COALESCE(overtime_hours, 0)), 0),
    COALESCE(COUNT(*) FILTER (WHERE is_breakdown = true), 0),
    COALESCE(COUNT(DISTINCT log_date), 0),
    COALESCE(COUNT(*), 0)
  INTO
    v_run_hours,
    v_ot_hours,
    v_breakdowns,
    v_days,
    v_total_logs
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
    'logged_days_count', v_days,
    'total_logs', v_total_logs
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_operations_summary TO authenticated, service_role;