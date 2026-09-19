-- ==============================================================================
-- Migration 092: Fix Active Machines Dashboard KPIs for Super Admin & Manager
--
-- Resolves issue where active machinery was filtered on status = 'active'
-- instead of health_status = 'active' (or status = 'active') while excluding
-- inactive machines, causing active fleet metrics to report 0.
-- ==============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Super Admin Dashboard RPC
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_super_admin_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_total_users     int;
  v_active_machines int;
  v_total_clients   int;
  v_active_assign   int;
  v_today_logs      int;
  v_audit_actions   int;
  v_alerts          jsonb := '[]'::jsonb;
  v_today           date := CURRENT_DATE;
BEGIN
  SELECT count(*) INTO v_total_users
  FROM public.users WHERE status = 'active';

  SELECT count(*) INTO v_active_machines
  FROM public.machines
  WHERE (health_status = 'active' OR status = 'active')
    AND (status IS NULL OR status != 'inactive');

  SELECT count(*) INTO v_total_clients
  FROM public.clients WHERE status = 'active';

  SELECT count(*) INTO v_active_assign
  FROM public.operator_machine_assignments WHERE is_active = true;

  SELECT count(*) INTO v_today_logs
  FROM public.machine_hour_logs WHERE log_date = v_today;

  SELECT count(*) INTO v_audit_actions
  FROM public.audit_logs WHERE created_at >= v_today::timestamptz;

  IF v_today_logs = 0 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'no-logs-today',
      'severity', 'info',
      'title', 'No logs recorded yet today',
      'description', 'Operators have not submitted any machine running logs for today.',
      'actionUrl', '/operations?tab=logs'
    );
  END IF;

  RETURN jsonb_build_object(
    'totalUsers',          v_total_users,
    'activeMachines',      v_active_machines,
    'totalClients',        v_total_clients,
    'activeAssignments',   v_active_assign,
    'todayLogs',           v_today_logs,
    'recentAuditActions',  v_audit_actions,
    'alerts',              v_alerts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_super_admin_dashboard FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_super_admin_dashboard TO authenticated, service_role;


-- ──────────────────────────────────────────────────────────────────────────
-- 2. Manager Dashboard RPC
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_manager_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_total      int;
  v_active     int;
  v_rented     int;
  v_spare      int;
  v_breakdown  int;
  v_today_logs int;
  v_today_hrs  numeric;
  v_active_assign int;
  v_alerts     jsonb := '[]'::jsonb;
  v_today      date := CURRENT_DATE;
BEGIN
  -- Machine utilization breakdown
  SELECT
    count(*),
    count(*) FILTER (WHERE (health_status = 'active' OR status = 'active') AND (status IS NULL OR status != 'inactive')),
    count(*) FILTER (WHERE status = 'rented'),
    count(*) FILTER (WHERE health_status = 'spare'),
    count(*) FILTER (WHERE health_status = 'breakdown')
  INTO v_total, v_active, v_rented, v_spare, v_breakdown
  FROM public.machines;

  -- Today's operations
  SELECT count(*), COALESCE(sum(running_hours), 0)
  INTO v_today_logs, v_today_hrs
  FROM public.machine_hour_logs WHERE log_date = v_today;

  SELECT count(*) INTO v_active_assign
  FROM public.operator_machine_assignments WHERE is_active = true;

  IF v_breakdown > 0 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'manager-breakdowns',
      'severity', 'critical',
      'title', format('%s machine(s) in breakdown state', v_breakdown),
      'description', 'Requires operational inspection and maintenance assignment.',
      'actionUrl', '/machines'
    );
  END IF;

  RETURN jsonb_build_object(
    'machineUtilization', jsonb_build_object(
      'total',     v_total,
      'active',    v_active,
      'rented',    v_rented,
      'spare',     v_spare,
      'breakdown', v_breakdown
    ),
    'operationsToday', jsonb_build_object(
      'totalLogs',  v_today_logs,
      'totalHours', round(v_today_hrs, 1)
    ),
    'activeAssignments', v_active_assign,
    'alerts',            v_alerts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_manager_dashboard FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_manager_dashboard TO authenticated, service_role;
