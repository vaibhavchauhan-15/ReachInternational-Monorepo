-- ==============================================================================
-- Migration 176: Enhance Directory Summary & Dashboard RPCs for Client Supervisors
-- Milestone: Propagate Client-Based RBAC inheritance across Directory Summaries & Dashboard
-- ==============================================================================

-- ──────────────────────────────────────────────────────────────────────────
-- 1. get_machines_directory_summary RPC with Client Supervisor Inheritance
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_machines_directory_summary(
  p_supervisor_id uuid DEFAULT NULL,
  p_operator_id uuid DEFAULT NULL,
  p_client_id uuid DEFAULT NULL
)
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
    'available', COUNT(*) FILTER (WHERE status = 'available')::bigint,
    'rented', COUNT(*) FILTER (WHERE status = 'rented')::bigint,
    'breakdown', COUNT(*) FILTER (WHERE health_status = 'breakdown')::bigint,
    'maintenance', COUNT(*) FILTER (WHERE health_status IN ('maintenance', 'under_maintenance'))::bigint,
    'spare', COUNT(*) FILTER (WHERE health_status = 'spare')::bigint,
    'active', COUNT(*) FILTER (WHERE health_status = 'active')::bigint
  )
  INTO v_result
  FROM public.machines m
  WHERE
    (
      p_supervisor_id IS NULL
      OR m.current_supervisor_id = p_supervisor_id
      OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_supervisor_id])
      OR (
        m.client_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.client_supervisors cs
          WHERE cs.client_id = m.client_id AND cs.supervisor_id = p_supervisor_id
        )
      )
    )
    AND
    (
      p_operator_id IS NULL
      OR m.current_operator_id = p_operator_id
      OR (m.operator_ids IS NOT NULL AND m.operator_ids @> ARRAY[p_operator_id])
      OR EXISTS (
        SELECT 1
        FROM public.operator_machine_assignments oma
        WHERE oma.machine_id = m.id
          AND oma.operator_id = p_operator_id
          AND oma.is_active = true
      )
    )
    AND
    (p_client_id IS NULL OR m.client_id = p_client_id);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_machines_directory_summary(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_machines_directory_summary(uuid, uuid, uuid) TO authenticated, service_role;

-- ──────────────────────────────────────────────────────────────────────────
-- 2. get_supervisor_dashboard RPC with Client Supervisor Inheritance
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

  -- Machines supervised by this supervisor (direct machine assignment or inherited via client_supervisors)
  SELECT count(*) INTO v_assigned_machines
  FROM public.machines m
  WHERE m.current_supervisor_id = v_sid
     OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[v_sid])
     OR (
       m.client_id IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM public.client_supervisors cs
         WHERE cs.client_id = m.client_id AND cs.supervisor_id = v_sid
       )
     );

  -- Operators assigned to this supervisor (via users.supervisor_id, user_supervisors junction, or active deployments on supervised client machines)
  SELECT count(*) INTO v_assigned_ops
  FROM public.users u
  WHERE u.role = 'operator' AND u.status = 'active'
    AND (
      u.supervisor_id = v_sid
      OR EXISTS (
        SELECT 1 FROM public.user_supervisors us
        WHERE us.user_id = u.id AND us.supervisor_id = v_sid
      )
      OR EXISTS (
        SELECT 1 FROM public.client_supervisors cs
        JOIN public.machines m ON m.client_id = cs.client_id
        JOIN public.operator_machine_assignments oma ON oma.machine_id = m.id
        WHERE cs.supervisor_id = v_sid
          AND oma.operator_id = u.id
          AND oma.is_active = true
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
      OR EXISTS (
        SELECT 1 FROM public.client_supervisors cs
        JOIN public.machines m ON m.client_id = cs.client_id
        JOIN public.operator_machine_assignments oma ON oma.machine_id = m.id
        WHERE cs.supervisor_id = v_sid
          AND oma.operator_id = u.id
          AND oma.is_active = true
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

REVOKE ALL ON FUNCTION public.get_supervisor_dashboard(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_supervisor_dashboard(uuid) TO authenticated, service_role;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. get_users_directory_summary RPC with Client Supervisor Inheritance
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
                  OR EXISTS (
                    SELECT 1 FROM public.client_supervisors cs
                    JOIN public.machines m ON m.client_id = cs.client_id
                    JOIN public.operator_machine_assignments oma ON oma.machine_id = m.id
                    WHERE cs.supervisor_id = p_supervisor_id
                      AND oma.operator_id = u.id
                      AND oma.is_active = true
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
        OR EXISTS (
          SELECT 1 FROM public.client_supervisors cs
          JOIN public.machines m ON m.client_id = cs.client_id
          JOIN public.operator_machine_assignments oma ON oma.machine_id = m.id
          WHERE cs.supervisor_id = p_supervisor_id
            AND oma.operator_id = u.id
            AND oma.is_active = true
        )
      )
      AND u.role = 'operator'
    )
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_users_directory_summary(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_users_directory_summary(uuid) TO authenticated, service_role;

-- ──────────────────────────────────────────────────────────────────────────
-- 4. get_today_shift_monitor_summary & get_today_shift_log_monitor_paginated RPCs
-- ──────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_today_shift_monitor_summary(
  p_actor_id uuid,
  p_log_date date DEFAULT CURRENT_DATE,
  p_client_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_summary jsonb;
BEGIN
  WITH actor_info AS (
    SELECT role FROM public.users WHERE id = p_actor_id
  ),
  active_assignments AS (
    SELECT oma.operator_id,
           oma.machine_id,
           oma.shift_start_time,
           oma.shift_end_time,
           oma.shift_code AS oma_shift_code,
           m.client_id
    FROM public.operator_machine_assignments oma
    JOIN public.machines m ON m.id = oma.machine_id
    WHERE oma.is_active = true
      AND (
        (SELECT role FROM actor_info) IN ('super_admin', 'admin', 'manager')
        OR EXISTS (
          SELECT 1 FROM public.user_supervisors us
          WHERE us.supervisor_id = p_actor_id AND us.user_id = oma.operator_id
        )
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = oma.operator_id AND u.supervisor_id = p_actor_id
        )
        OR m.current_supervisor_id = p_actor_id
        OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
        OR (
          m.client_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.client_supervisors cs
            WHERE cs.client_id = m.client_id AND cs.supervisor_id = p_actor_id
          )
        )
      )
  ),
  unassigned_machines AS (
    SELECT NULL::uuid AS operator_id,
           m.id AS machine_id,
           NULL::time AS shift_start_time,
           NULL::time AS shift_end_time,
           'S1'::text AS oma_shift_code,
           m.client_id
    FROM public.machines m
    WHERE (
        m.status IN ('active', 'rented', 'available', 'under_maintenance')
        OR m.health_status IN ('under_maintenance', 'breakdown')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.operator_machine_assignments oma
        WHERE oma.machine_id = m.id AND oma.is_active = true
      )
      AND (
        (SELECT role FROM actor_info) IN ('super_admin', 'admin', 'manager')
        OR m.current_supervisor_id = p_actor_id
        OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
        OR (
          m.client_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.client_supervisors cs
            WHERE cs.client_id = m.client_id AND cs.supervisor_id = p_actor_id
          )
        )
      )
  ),
  combined_roster_sources AS (
    SELECT * FROM active_assignments
    UNION ALL
    SELECT * FROM unassigned_machines
  ),
  matched_logs AS (
    SELECT r.operator_id,
           r.machine_id,
           l.id AS log_id,
           ROW_NUMBER() OVER (
             PARTITION BY r.machine_id, COALESCE(r.operator_id, '00000000-0000-0000-0000-000000000000'::uuid)
             ORDER BY l.created_at DESC
           ) as rn
    FROM combined_roster_sources r
    LEFT JOIN public.machine_hour_logs l
      ON l.machine_id = r.machine_id
      AND (
        (r.operator_id IS NOT NULL AND l.operator_id = r.operator_id)
        OR (r.operator_id IS NULL AND l.log_date = p_log_date)
      )
      AND l.log_date = p_log_date
  ),
  unique_matched_logs AS (
    SELECT operator_id, machine_id, log_id
    FROM matched_logs
    WHERE rn = 1
  ),
  classified_roster AS (
    SELECT
      r.operator_id,
      r.machine_id,
      CASE
        WHEN r.operator_id IS NULL THEN 'unassigned'
        WHEN ml.log_id IS NOT NULL THEN 'entered'
        ELSE 'pending'
      END as status
    FROM combined_roster_sources r
    LEFT JOIN unique_matched_logs ml
      ON ml.machine_id = r.machine_id
      AND (
        (r.operator_id IS NOT NULL AND ml.operator_id = r.operator_id)
        OR (r.operator_id IS NULL AND ml.operator_id IS NULL)
      )
    WHERE (p_client_id IS NULL OR r.client_id = p_client_id)
  )
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'entered', COUNT(*) FILTER (WHERE status = 'entered'),
    'pending', COUNT(*) FILTER (WHERE status = 'pending'),
    'unassigned', COUNT(*) FILTER (WHERE status = 'unassigned')
  ) INTO v_summary
  FROM classified_roster;

  RETURN COALESCE(v_summary, '{"total": 0, "entered": 0, "pending": 0, "unassigned": 0}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_today_shift_monitor_summary(uuid, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_today_shift_monitor_summary(uuid, date, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_today_shift_log_monitor_paginated(
  p_actor_id uuid,
  p_log_date date DEFAULT CURRENT_DATE,
  p_search text DEFAULT NULL,
  p_status text DEFAULT 'all',
  p_client_id uuid DEFAULT NULL,
  p_shift_code text DEFAULT NULL,
  p_sort text DEFAULT 'default',
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_summary jsonb;
  v_rows jsonb;
  v_total_count int;
  v_has_more boolean;
  v_shift_options jsonb;
  v_client_options jsonb;
  v_offset int;
  v_safe_page int;
  v_safe_page_size int;
BEGIN
  v_safe_page := GREATEST(1, COALESCE(p_page, 1));
  v_safe_page_size := GREATEST(1, LEAST(100, COALESCE(p_page_size, 12)));
  v_offset := (v_safe_page - 1) * v_safe_page_size;

  -- 1. Compute summary counts over all matching records for the day
  v_summary := public.get_today_shift_monitor_summary(p_actor_id, p_log_date, p_client_id);

  WITH actor_info AS (
    SELECT role FROM public.users WHERE id = p_actor_id
  ),
  active_assignments AS (
    SELECT oma.operator_id,
           oma.machine_id,
           oma.shift_start_time,
           oma.shift_end_time,
           oma.shift_code AS oma_shift_code,
           m.machine_id AS machine_code,
           m.serial_number,
           m.model,
           m.client_id,
           m.site_id,
           m.city AS machine_city,
           m.hour_meter AS current_meter,
           m.status AS machine_status,
           m.health_status AS machine_health_status
    FROM public.operator_machine_assignments oma
    JOIN public.machines m ON m.id = oma.machine_id
    WHERE oma.is_active = true
      AND (
        (SELECT role FROM actor_info) IN ('super_admin', 'admin', 'manager')
        OR EXISTS (
          SELECT 1 FROM public.user_supervisors us
          WHERE us.supervisor_id = p_actor_id AND us.user_id = oma.operator_id
        )
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = oma.operator_id AND u.supervisor_id = p_actor_id
        )
        OR m.current_supervisor_id = p_actor_id
        OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
        OR (
          m.client_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.client_supervisors cs
            WHERE cs.client_id = m.client_id AND cs.supervisor_id = p_actor_id
          )
        )
      )
  ),
  unassigned_machines AS (
    SELECT NULL::uuid AS operator_id,
           m.id AS machine_id,
           NULL::time AS shift_start_time,
           NULL::time AS shift_end_time,
           'S1'::text AS oma_shift_code,
           m.machine_id AS machine_code,
           m.serial_number,
           m.model,
           m.client_id,
           m.site_id,
           m.city AS machine_city,
           m.hour_meter AS current_meter,
           m.status AS machine_status,
           m.health_status AS machine_health_status
    FROM public.machines m
    WHERE (
        m.status IN ('active', 'rented', 'available', 'under_maintenance')
        OR m.health_status IN ('under_maintenance', 'breakdown')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.operator_machine_assignments oma
        WHERE oma.machine_id = m.id AND oma.is_active = true
      )
      AND (
        (SELECT role FROM actor_info) IN ('super_admin', 'admin', 'manager')
        OR m.current_supervisor_id = p_actor_id
        OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
        OR (
          m.client_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM public.client_supervisors cs
            WHERE cs.client_id = m.client_id AND cs.supervisor_id = p_actor_id
          )
        )
      )
  ),
  combined_roster AS (
    SELECT * FROM active_assignments
    UNION ALL
    SELECT * FROM unassigned_machines
  ),
  matched_logs AS (
    SELECT r.operator_id,
           r.machine_id,
           l.id AS log_id,
           l.start_meter,
           l.end_meter,
           l.running_hours,
           l.is_breakdown,
           l.remarks,
           l.created_at AS log_created_at,
           ROW_NUMBER() OVER (
             PARTITION BY r.machine_id, COALESCE(r.operator_id, '00000000-0000-0000-0000-000000000000'::uuid)
             ORDER BY l.created_at DESC
           ) as rn
    FROM combined_roster r
    LEFT JOIN public.machine_hour_logs l
      ON l.machine_id = r.machine_id
      AND (
        (r.operator_id IS NOT NULL AND l.operator_id = r.operator_id)
        OR (r.operator_id IS NULL AND l.log_date = p_log_date)
      )
      AND l.log_date = p_log_date
  ),
  unique_matched_logs AS (
    SELECT *
    FROM matched_logs
    WHERE rn = 1
  ),
  enriched_roster AS (
    SELECT
      r.operator_id,
      r.machine_id,
      r.machine_code,
      r.serial_number,
      r.model,
      r.client_id,
      r.site_id,
      r.machine_city,
      r.current_meter,
      r.machine_status,
      r.machine_health_status,
      r.shift_start_time,
      r.shift_end_time,
      COALESCE(r.oma_shift_code, 'S1') as shift_code,
      u.full_name as operator_name,
      u.employee_id as operator_employee_id,
      u.phone as operator_phone,
      c.company_name as client_name,
      cs.site_name,
      ml.log_id,
      ml.start_meter,
      ml.end_meter,
      ml.running_hours,
      ml.is_breakdown,
      ml.remarks,
      ml.log_created_at,
      CASE
        WHEN r.operator_id IS NULL THEN 'unassigned'
        WHEN ml.log_id IS NOT NULL THEN 'entered'
        ELSE 'pending'
      END as status
    FROM combined_roster r
    LEFT JOIN unique_matched_logs ml
      ON ml.machine_id = r.machine_id
      AND (
        (r.operator_id IS NOT NULL AND ml.operator_id = r.operator_id)
        OR (r.operator_id IS NULL AND ml.operator_id IS NULL)
      )
    LEFT JOIN public.users u ON u.id = r.operator_id
    LEFT JOIN public.clients c ON c.id = r.client_id
    LEFT JOIN public.client_sites cs ON cs.id = r.site_id
    WHERE
      (p_client_id IS NULL OR r.client_id = p_client_id)
      AND (p_shift_code IS NULL OR COALESCE(r.oma_shift_code, 'S1') = p_shift_code)
      AND (
        p_search IS NULL OR p_search = ''
        OR r.machine_code ILIKE '%' || p_search || '%'
        OR r.model ILIKE '%' || p_search || '%'
        OR r.serial_number ILIKE '%' || p_search || '%'
        OR u.full_name ILIKE '%' || p_search || '%'
        OR u.employee_id ILIKE '%' || p_search || '%'
        OR c.company_name ILIKE '%' || p_search || '%'
      )
  ),
  filtered_roster AS (
    SELECT *
    FROM enriched_roster
    WHERE (p_status = 'all' OR status = p_status)
  ),
  counted_roster AS (
    SELECT COUNT(*) as cnt FROM filtered_roster
  ),
  sorted_roster AS (
    SELECT *
    FROM filtered_roster
    ORDER BY
      CASE WHEN p_sort = 'machine_code_asc' THEN machine_code END ASC,
      CASE WHEN p_sort = 'machine_code_desc' THEN machine_code END DESC,
      CASE WHEN p_sort = 'operator_name_asc' THEN operator_name END ASC,
      CASE WHEN p_sort = 'operator_name_desc' THEN operator_name END DESC,
      CASE WHEN p_sort = 'status_asc' THEN status END ASC,
      CASE WHEN p_sort = 'status_desc' THEN status END DESC,
      CASE WHEN p_sort = 'default' THEN
        CASE status
          WHEN 'pending' THEN 1
          WHEN 'unassigned' THEN 2
          WHEN 'entered' THEN 3
          ELSE 4
        END
      END ASC,
      machine_code ASC
    OFFSET v_offset
    LIMIT v_safe_page_size
  )
  SELECT
    (SELECT cnt FROM counted_roster),
    jsonb_agg(
      jsonb_build_object(
        'operator_id', sr.operator_id,
        'machine_id', sr.machine_id,
        'machine_code', sr.machine_code,
        'serial_number', sr.serial_number,
        'model', sr.model,
        'client_id', sr.client_id,
        'client_name', sr.client_name,
        'site_id', sr.site_id,
        'site_name', sr.site_name,
        'machine_city', sr.machine_city,
        'current_meter', sr.current_meter,
        'machine_status', sr.machine_status,
        'machine_health_status', sr.machine_health_status,
        'shift_start_time', sr.shift_start_time,
        'shift_end_time', sr.shift_end_time,
        'shift_code', sr.shift_code,
        'operator_name', sr.operator_name,
        'operator_employee_id', sr.operator_employee_id,
        'operator_phone', sr.operator_phone,
        'log_id', sr.log_id,
        'start_meter', sr.start_meter,
        'end_meter', sr.end_meter,
        'running_hours', sr.running_hours,
        'is_breakdown', sr.is_breakdown,
        'remarks', sr.remarks,
        'log_created_at', sr.log_created_at,
        'status', sr.status
      )
    )
  INTO v_total_count, v_rows
  FROM sorted_roster sr;

  v_total_count := COALESCE(v_total_count, 0);
  v_has_more := (v_offset + v_safe_page_size) < v_total_count;

  -- Build available shifts and clients for filtering
  SELECT jsonb_agg(DISTINCT jsonb_build_object('code', shift_code, 'label', shift_code))
  INTO v_shift_options
  FROM enriched_roster
  WHERE shift_code IS NOT NULL;

  SELECT jsonb_agg(DISTINCT jsonb_build_object('id', client_id, 'name', client_name))
  INTO v_client_options
  FROM enriched_roster
  WHERE client_id IS NOT NULL AND client_name IS NOT NULL;

  RETURN jsonb_build_object(
    'page', v_safe_page,
    'pageSize', v_safe_page_size,
    'totalCount', v_total_count,
    'hasMore', v_has_more,
    'summary', v_summary,
    'shiftOptions', COALESCE(v_shift_options, '[]'::jsonb),
    'clientOptions', COALESCE(v_client_options, '[]'::jsonb),
    'rows', COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_today_shift_log_monitor_paginated(uuid, date, text, text, uuid, text, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_today_shift_log_monitor_paginated(uuid, date, text, text, uuid, text, text, int, int) TO authenticated, service_role;
