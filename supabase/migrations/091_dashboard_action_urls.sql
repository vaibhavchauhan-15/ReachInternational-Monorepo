-- ==============================================================================
-- Migration 091: Canonical Dashboard RPC Action URLs Hardening
--
-- Ensures all dashboard alert action URLs point to valid active routes across all roles:
-- 1. get_super_admin_dashboard: /operations?tab=logs
-- 2. get_admin_dashboard: /operations?tab=logs
-- 3. get_manager_dashboard: /machines
-- 4. get_supervisor_dashboard: /operations?tab=logs
-- 5. get_hr_dashboard: /users (since profile change requests live on /users)
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
  FROM public.machines WHERE status = 'active';

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


-- ──────────────────────────────────────────────────────────────────────────
-- 2. Admin Dashboard RPC
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_admin_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_total_machines  int;
  v_active_users    int;
  v_total_clients   int;
  v_active_assign   int;
  v_today_logs      int;
  v_breakdowns      int;
  v_overtime        int;
  v_alerts          jsonb := '[]'::jsonb;
  v_today           date := CURRENT_DATE;
BEGIN
  SELECT count(*) INTO v_total_machines
  FROM public.machines;

  SELECT count(*) INTO v_active_users
  FROM public.users WHERE status = 'active';

  SELECT count(*) INTO v_total_clients
  FROM public.clients WHERE status = 'active';

  SELECT count(*) INTO v_active_assign
  FROM public.operator_machine_assignments WHERE is_active = true;

  SELECT count(*) INTO v_today_logs
  FROM public.machine_hour_logs WHERE log_date = v_today;

  SELECT count(*) INTO v_breakdowns
  FROM public.machine_hour_logs
  WHERE log_date = v_today AND is_breakdown = true;

  SELECT count(*) INTO v_overtime
  FROM public.machine_hour_logs
  WHERE log_date = v_today AND overtime_hours > 0;

  IF v_breakdowns > 0 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'active-breakdowns',
      'severity', 'critical',
      'title', format('%s machine breakdown(s) reported today', v_breakdowns),
      'description', 'Inspect operations logs to view breakdown details and technician notes.',
      'actionUrl', '/operations?tab=logs'
    );
  END IF;

  IF v_overtime > 0 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'today-overtime',
      'severity', 'info',
      'title', format('%s overtime shift entry(ies) today', v_overtime),
      'description', 'Overtime running hours recorded on site.',
      'actionUrl', '/operations?tab=logs'
    );
  END IF;

  RETURN jsonb_build_object(
    'totalMachines',     v_total_machines,
    'activeUsers',       v_active_users,
    'totalClients',      v_total_clients,
    'activeAssignments', v_active_assign,
    'todayLogs',         v_today_logs,
    'operationalKpis',   jsonb_build_object(
      'breakdowns',       v_breakdowns,
      'overlappingLogs',  0,
      'overtimeEntries',  v_overtime,
      'incompleteEntries', 0
    ),
    'alerts',            v_alerts
  );
END;
$$;


-- ──────────────────────────────────────────────────────────────────────────
-- 3. Supervisor Dashboard RPC
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_supervisor_dashboard(p_supervisor_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_sid               uuid;
  v_assigned_machines int;
  v_assigned_ops      int;
  v_submitted         int;
  v_pending           int;
  v_breakdowns        int;
  v_overtime          int;
  v_alerts            jsonb := '[]'::jsonb;
  v_today             date := CURRENT_DATE;
BEGIN
  v_sid := COALESCE(p_supervisor_id, auth.uid());

  -- Machines supervised by this supervisor
  SELECT count(*) INTO v_assigned_machines
  FROM public.machines
  WHERE current_supervisor_id = v_sid
     OR supervisor_ids @> ARRAY[v_sid];

  -- Operators assigned to this supervisor (via users.supervisor_id or supervisor_ids)
  SELECT count(*) INTO v_assigned_ops
  FROM public.users
  WHERE role = 'operator' AND status = 'active'
    AND (supervisor_id = v_sid OR (supervisor_ids IS NOT NULL AND supervisor_ids @> ARRAY[v_sid]));

  -- Today's logs from supervised operators
  SELECT
    count(*) FILTER (WHERE mhl.id IS NOT NULL),
    count(*) FILTER (WHERE mhl.is_breakdown = true),
    count(*) FILTER (WHERE mhl.overtime_hours > 0)
  INTO v_submitted, v_breakdowns, v_overtime
  FROM public.users u
  LEFT JOIN public.machine_hour_logs mhl
    ON mhl.operator_id = u.id AND mhl.log_date = v_today
  WHERE u.role = 'operator' AND u.status = 'active'
    AND (u.supervisor_id = v_sid OR (u.supervisor_ids IS NOT NULL AND u.supervisor_ids @> ARRAY[v_sid]));

  -- Pending = assigned operators minus those who submitted today
  v_pending := GREATEST(v_assigned_ops - v_submitted, 0);

  IF v_pending > 0 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'pending-submissions',
      'severity', 'warning',
      'title', format('%s operator(s) have pending logs today', v_pending),
      'description', 'Daily log submissions not yet completed by all assigned operators.',
      'actionUrl', '/operations?tab=logs'
    );
  END IF;

  IF v_breakdowns > 0 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'supervisor-breakdowns',
      'severity', 'critical',
      'title', format('%s breakdown(s) reported in your fleet today', v_breakdowns),
      'description', 'Check operations log history for reported breakdown causes.',
      'actionUrl', '/operations?tab=logs'
    );
  END IF;

  RETURN jsonb_build_object(
    'assignedMachines',  v_assigned_machines,
    'assignedOperators', v_assigned_ops,
    'todayLogs', jsonb_build_object(
      'submitted', v_submitted,
      'pending',   v_pending
    ),
    'breakdowns',      v_breakdowns,
    'overtimeEntries', v_overtime,
    'alerts',          v_alerts
  );
END;
$$;


-- ──────────────────────────────────────────────────────────────────────────
-- 4. HR Dashboard RPC
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_hr_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_total_employees      int;
  v_active_operators     int;
  v_pending_changes      int;
  v_today_logs           int;
  v_alerts               jsonb := '[]'::jsonb;
  v_today                date := CURRENT_DATE;
BEGIN
  SELECT count(*) INTO v_total_employees
  FROM public.users WHERE status = 'active';

  SELECT count(*) INTO v_active_operators
  FROM public.users WHERE role = 'operator' AND status = 'active';

  SELECT count(*) INTO v_pending_changes
  FROM public.profile_change_requests WHERE status = 'pending';

  SELECT count(*) INTO v_today_logs
  FROM public.machine_hour_logs WHERE log_date = v_today;

  IF v_pending_changes > 0 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'pending-profile-requests',
      'severity', 'warning',
      'title', format('%s pending profile change request(s)', v_pending_changes),
      'description', 'Staff requested updates to personal information or documents.',
      'actionUrl', '/users'
    );
  END IF;

  RETURN jsonb_build_object(
    'totalEmployees',       v_total_employees,
    'activeOperators',      v_active_operators,
    'pendingProfileChanges', v_pending_changes,
    'todayLogsCount',       v_today_logs,
    'alerts',               v_alerts
  );
END;
$$;


-- ──────────────────────────────────────────────────────────────────────────
-- Permissions Hardening
-- ──────────────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.get_super_admin_dashboard FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_super_admin_dashboard TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_admin_dashboard FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_supervisor_dashboard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_supervisor_dashboard(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_hr_dashboard FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_hr_dashboard TO authenticated, service_role;
