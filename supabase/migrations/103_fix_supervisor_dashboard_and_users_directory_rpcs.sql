-- ==============================================================================
-- Migration 103: Update get_supervisor_dashboard and get_users_directory_summary
--
-- Migration 100 dropped column supervisor_ids from public.users and normalized supervisor
-- assignments into public.user_supervisors junction table.
-- This migration updates get_supervisor_dashboard() and get_users_directory_summary()
-- to query user_supervisors instead of the dropped users.supervisor_ids column.
-- ==============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Supervisor Dashboard RPC
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_supervisor_dashboard(p_supervisor_id uuid DEFAULT NULL::uuid)
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

  -- Machines supervised by this supervisor (machines has current_supervisor_id and supervisor_ids UUID[])
  SELECT count(*) INTO v_assigned_machines
  FROM public.machines
  WHERE current_supervisor_id = v_sid
     OR (supervisor_ids IS NOT NULL AND supervisor_ids @> ARRAY[v_sid]);

  -- Operators assigned to this supervisor (via users.supervisor_id or user_supervisors junction table)
  SELECT count(*) INTO v_assigned_ops
  FROM public.users u
  WHERE u.role = 'operator' AND u.status = 'active'
    AND (
      u.supervisor_id = v_sid
      OR EXISTS (
        SELECT 1 FROM public.user_supervisors us
        WHERE us.user_id = u.id AND us.supervisor_id = v_sid
      )
    );

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
    AND (
      u.supervisor_id = v_sid
      OR EXISTS (
        SELECT 1 FROM public.user_supervisors us
        WHERE us.user_id = u.id AND us.supervisor_id = v_sid
      )
    );

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
      'actionUrl', '/operations'
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
-- 2. Users Directory Summary RPC
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_users_directory_summary(p_supervisor_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total', COUNT(*)::bigint,
    'active', COUNT(*) FILTER (WHERE status = 'active')::bigint,
    'engineers', COUNT(*) FILTER (WHERE role = 'operator')::bigint,
    'operators', COUNT(*) FILTER (WHERE role = 'operator')::bigint,
    'new_registrations', COUNT(*) FILTER (WHERE status = 'pending')::bigint,
    'states', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', sub.state_key,
            'label', sub.state_label
          )
          ORDER BY sub.state_label ASC
        )
        FROM (
          SELECT DISTINCT ON (COALESCE(state_id::text, lower(trim(state))))
            COALESCE(state_id::text, lower(trim(state))) AS state_key,
            trim(state) AS state_label
          FROM public.users u
          WHERE u.state IS NOT NULL AND trim(u.state) <> ''
            AND (
              p_supervisor_id IS NULL
              OR (
                (
                  u.supervisor_id = p_supervisor_id
                  OR EXISTS (
                    SELECT 1 FROM public.user_supervisors us
                    WHERE us.user_id = u.id AND us.supervisor_id = p_supervisor_id
                  )
                )
                AND u.role = 'operator'
              )
            )
          ORDER BY COALESCE(state_id::text, lower(trim(state))), trim(state)
        ) sub
      ),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM public.users u
  WHERE (
    p_supervisor_id IS NULL
    OR (
      (
        u.supervisor_id = p_supervisor_id
        OR EXISTS (
          SELECT 1 FROM public.user_supervisors us
          WHERE us.user_id = u.id AND us.supervisor_id = p_supervisor_id
        )
      )
      AND u.role = 'operator'
    )
  );

  RETURN v_result;
END;
$$;


-- ──────────────────────────────────────────────────────────────────────────
-- Permissions Hardening
-- ──────────────────────────────────────────────────────────────────────────

REVOKE ALL ON FUNCTION public.get_supervisor_dashboard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_supervisor_dashboard(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_users_directory_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_users_directory_summary(uuid) TO authenticated, service_role;
