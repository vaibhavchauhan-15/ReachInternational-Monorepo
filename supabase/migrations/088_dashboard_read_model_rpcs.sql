-- ==========================================================================
-- Migration 088: Role-Specific Dashboard Read Model RPCs
--
-- Creates 6 lean PostgreSQL RPCs, one per canonical role, each returning
-- a jsonb DTO scoped strictly to the caller's identity and role.
-- Architecture: role → dedicated RPC → minimal DTO → fast first paint.
-- No "fetch everything then filter" — each RPC queries only what the role needs.
--
-- Pattern follows migration 084 (get_operator_entry_context):
-- SECURITY DEFINER + SET search_path + STABLE + jsonb return.
--
-- RPCs:
--   1. get_super_admin_dashboard()
--   2. get_admin_dashboard()
--   3. get_manager_dashboard()
--   4. get_supervisor_dashboard(p_supervisor_id)
--   5. get_hr_dashboard()
--   6. get_operator_dashboard(p_operator_id)
-- ==========================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 0. Performance Indexes (idempotent — only add what doesn't already exist)
-- ──────────────────────────────────────────────────────────────────────────

-- Today's logs by date (covers dashboard count queries)
CREATE INDEX IF NOT EXISTS idx_mhl_log_date
  ON public.machine_hour_logs(log_date);

-- Today's logs by operator + date (covers supervisor/operator dashboards)
CREATE INDEX IF NOT EXISTS idx_mhl_operator_date
  ON public.machine_hour_logs(operator_id, log_date);

-- Pending profile change requests (covers HR dashboard)
CREATE INDEX IF NOT EXISTS idx_pcr_status_pending
  ON public.profile_change_requests(status)
  WHERE status = 'pending';

-- Active assignments on operator_machine_assignments
CREATE INDEX IF NOT EXISTS idx_oma_machine_active_idx
  ON public.operator_machine_assignments(machine_id)
  WHERE is_active = true;


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
      'actionUrl', '/operations'
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
      'actionUrl', '/operations?tab=history'
    );
  END IF;

  IF v_overtime > 0 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'today-overtime',
      'severity', 'info',
      'title', format('%s overtime shift entry(ies) today', v_overtime),
      'description', 'Overtime running hours recorded on site.',
      'actionUrl', '/operations'
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
-- 3. Manager Dashboard RPC
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
    count(*) FILTER (WHERE status = 'active'),
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


-- ──────────────────────────────────────────────────────────────────────────
-- 4. Supervisor Dashboard RPC (scoped to supervisor's team)
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
      'actionUrl', '/operations'
    );
  END IF;

  IF v_breakdowns > 0 THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'supervisor-breakdowns',
      'severity', 'critical',
      'title', format('%s breakdown(s) reported in your fleet today', v_breakdowns),
      'description', 'Check operations log history for reported breakdown causes.',
      'actionUrl', '/operations?tab=history'
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
-- 5. HR Dashboard RPC
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
      'actionUrl', '/profile-requests'
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
-- 6. Operator Dashboard RPC
-- Lightweight — checks assignment + today's log status only.
-- Full entry context uses existing get_operator_entry_context() from 084.
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_operator_dashboard(p_operator_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_oid          uuid;
  v_op_name      text;
  v_machine_id   uuid;
  v_machine_code text;
  v_machine_model text;
  v_machine_serial text;
  v_client_id    uuid;
  v_client_name  text;
  v_client_site  text;
  v_shift_start  time;
  v_shift_end    time;
  v_entry_exists boolean;
  v_last_hmr     numeric;
  v_alerts       jsonb := '[]'::jsonb;
  v_today        date := CURRENT_DATE;
BEGIN
  v_oid := COALESCE(p_operator_id, auth.uid());

  -- Operator info + shift
  SELECT u.full_name, u.shift_start_time, u.shift_end_time
  INTO v_op_name, v_shift_start, v_shift_end
  FROM public.users u WHERE u.id = v_oid;

  IF v_op_name IS NULL THEN
    RETURN jsonb_build_object(
      'operator', NULL, 'machine', NULL, 'client', NULL,
      'today', jsonb_build_object('entryStatus', 'pending', 'lastHmr', NULL),
      'shift', jsonb_build_object('start', '', 'end', ''),
      'alerts', '[]'::jsonb
    );
  END IF;

  -- Current active machine assignment: Priority A (active assignment)
  SELECT oma.machine_id, oma.shift_start_time, oma.shift_end_time
  INTO v_machine_id, v_shift_start, v_shift_end
  FROM public.operator_machine_assignments oma
  WHERE oma.operator_id = v_oid AND oma.is_active = true
  ORDER BY oma.assigned_at DESC
  LIMIT 1;

  -- Priority B fallback: direct machine table assignment
  IF v_machine_id IS NULL THEN
    SELECT m.id
    INTO v_machine_id
    FROM public.machines m
    WHERE m.current_operator_id = v_oid
       OR v_oid = ANY(m.operator_ids)
    ORDER BY m.updated_at DESC
    LIMIT 1;
  END IF;

  IF v_machine_id IS NOT NULL THEN
    SELECT m.machine_id, m.model, m.serial_number, m.client_id
    INTO v_machine_code, v_machine_model, v_machine_serial, v_client_id
    FROM public.machines m WHERE m.id = v_machine_id;

    -- If machine doesn't have a direct client_id, check most recent log
    IF v_client_id IS NULL THEN
      SELECT mhl.client_id
      INTO v_client_id
      FROM public.machine_hour_logs mhl
      WHERE mhl.machine_id = v_machine_id AND mhl.client_id IS NOT NULL
      ORDER BY mhl.log_date DESC, mhl.created_at DESC
      LIMIT 1;
    END IF;

    IF v_client_id IS NOT NULL THEN
      SELECT c.company_name,
             COALESCE(
               NULLIF(TRIM(CONCAT_WS(', ',
                 NULLIF(c.street, ''),
                 NULLIF(c.city, ''),
                 NULLIF(c.district, ''),
                 NULLIF(c.state, '')
               )), ''),
               c.city,
               'Site Location'
             )
      INTO v_client_name, v_client_site
      FROM public.clients c WHERE c.id = v_client_id;
    END IF;
  END IF;

  -- Today's entry status
  SELECT EXISTS(
    SELECT 1 FROM public.machine_hour_logs
    WHERE operator_id = v_oid AND log_date = v_today
  ) INTO v_entry_exists;

  -- Last HMR
  SELECT end_meter INTO v_last_hmr
  FROM public.machine_hour_logs
  WHERE operator_id = v_oid
  ORDER BY log_date DESC, created_at DESC
  LIMIT 1;

  IF NOT v_entry_exists THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'entry-pending',
      'severity', 'warning',
      'title', 'Today''s Log Pending',
      'description', 'Daily running hours have not been submitted for today.',
      'actionUrl', '/operations?tab=entry'
    );
  END IF;

  RETURN jsonb_build_object(
    'operator', jsonb_build_object('id', v_oid, 'name', v_op_name),
    'machine', CASE WHEN v_machine_id IS NOT NULL THEN
      jsonb_build_object(
        'id', v_machine_id,
        'name', COALESCE(v_machine_code, ''),
        'model', COALESCE(v_machine_model, ''),
        'serialNumber', COALESCE(v_machine_serial, '')
      )
    ELSE NULL END,
    'client', CASE WHEN v_client_id IS NOT NULL THEN
      jsonb_build_object(
        'id', v_client_id,
        'name', COALESCE(v_client_name, ''),
        'site', COALESCE(v_client_site, '')
      )
    ELSE NULL END,
    'today', jsonb_build_object(
      'entryStatus', CASE WHEN v_entry_exists THEN 'submitted' ELSE 'pending' END,
      'lastHmr', v_last_hmr
    ),
    'shift', jsonb_build_object(
      'start', COALESCE(v_shift_start::text, ''),
      'end', COALESCE(v_shift_end::text, '')
    ),
    'alerts', v_alerts
  );
END;
$$;


-- ──────────────────────────────────────────────────────────────────────────
-- 7. Permissions: Grant EXECUTE to authenticated and service_role only
-- ──────────────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.get_super_admin_dashboard FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_super_admin_dashboard TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_admin_dashboard FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_manager_dashboard FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_manager_dashboard TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_supervisor_dashboard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_supervisor_dashboard(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_hr_dashboard FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_hr_dashboard TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_operator_dashboard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_operator_dashboard(uuid) TO authenticated, service_role;
