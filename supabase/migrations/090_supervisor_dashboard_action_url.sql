-- ==============================================================================
-- Migration 090: Update Supervisor Dashboard RPC Alert Action Link
-- Point breakdown alert action URL to /operations?tab=logs instead of tab=history
-- ==============================================================================

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
