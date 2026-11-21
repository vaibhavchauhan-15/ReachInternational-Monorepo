-- ==============================================================================
-- Migration 225: Optimize Today Shift Monitor, Realtime Active Roster & Time Sorting
-- ==============================================================================
-- 1. Upgrades get_today_shift_log_monitor() RPC:
--    - Scopes active_assignments to CURRENT active assignments (is_active = true) or
--      assignments that have an actual shift log entered on that date.
--    - Filters out cancelled, relieved, or superseded same-day assignments (valid_from = valid_to
--      AND is_active = false AND log_id IS NULL), preventing historical data from polluting
--      today's active shift monitor.
--    - Adds optional p_shift_code text DEFAULT NULL and p_sort text DEFAULT 'default'.
--    - Orders rows chronologically by shift start time (shift_start ASC NULLS LAST).
-- 2. Upgrades get_today_shift_monitor_summary() with identical active assignment scoping
--    and keeps canonical parameter name p_log_date for 100% cross-platform parity.
-- 3. Upgrades get_today_shift_log_monitor_paginated() with identical active assignment scoping,
--    normalized shift code filtering, and time_asc / time_desc sorting.
-- 4. Reloads PostgREST schema cache via NOTIFY pgrst.
-- ==============================================================================

-- 1. Drop existing functions to allow signature upgrade without 42P13 parameter conflict
DROP FUNCTION IF EXISTS public.get_today_shift_log_monitor(uuid, date, text, uuid);
DROP FUNCTION IF EXISTS public.get_today_shift_log_monitor(uuid, date, text, uuid, text, text);

CREATE OR REPLACE FUNCTION public.get_today_shift_log_monitor(
  p_actor_id uuid,
  p_log_date date DEFAULT CURRENT_DATE,
  p_search text DEFAULT NULL::text,
  p_client_id uuid DEFAULT NULL::uuid,
  p_shift_code text DEFAULT NULL::text,
  p_sort text DEFAULT 'default'::text
)
RETURNS TABLE(
  operator_id uuid,
  operator_name text,
  operator_phone text,
  operator_employee_id text,
  machine_id uuid,
  machine_code text,
  machine_serial_number text,
  machine_model text,
  client_id uuid,
  client_code text,
  client_name text,
  client_city text,
  site_name text,
  current_meter numeric,
  shift_code text,
  shift_name text,
  shift_start time without time zone,
  shift_end time without time zone,
  status text,
  log_id uuid,
  entered_by uuid,
  entered_by_name text,
  entry_source text,
  log_date date,
  start_meter numeric,
  end_meter numeric,
  running_hours numeric,
  remarks text,
  machine_status text,
  machine_health_status text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH target_date AS (
    SELECT COALESCE(p_log_date, (NOW() AT TIME ZONE 'Asia/Kolkata')::date) AS d
  ),
  actor_info AS (
    SELECT role FROM public.users WHERE id = p_actor_id
  ),
  active_assignments AS (
    SELECT oma.id AS assignment_id,
           oma.operator_id,
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
    CROSS JOIN target_date td
    WHERE oma.valid_from <= td.d
      AND (oma.valid_to IS NULL OR oma.valid_to >= td.d)
      AND (oma.valid_to IS NULL OR oma.valid_from <= oma.valid_to)
      -- Authoritative: Only consider active assignments or those with an actual log entered today
      AND (
        oma.is_active = true
        OR td.d < (NOW() AT TIME ZONE 'Asia/Kolkata')::date
        OR EXISTS (
          SELECT 1 FROM public.machine_hour_logs l
          WHERE l.assignment_id = oma.id AND l.log_date = td.d
        )
      )
      -- Exclude same-day ended assignments with 0 logs (cancelled or superseded)
      AND NOT (
        oma.valid_from = oma.valid_to
        AND oma.is_active = false
        AND NOT EXISTS (
          SELECT 1 FROM public.machine_hour_logs l
          WHERE l.assignment_id = oma.id AND l.log_date = td.d
        )
      )
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
    SELECT NULL::uuid AS assignment_id,
           NULL::uuid AS operator_id,
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
    CROSS JOIN target_date td
    WHERE (
        m.status IN ('active', 'rented', 'available', 'under_maintenance')
        OR m.health_status IN ('under_maintenance', 'breakdown')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.operator_machine_assignments oma
        WHERE oma.machine_id = m.id
          AND oma.valid_from <= td.d
          AND (oma.valid_to IS NULL OR oma.valid_to >= td.d)
          AND (oma.valid_to IS NULL OR oma.valid_from <= oma.valid_to)
          AND (
            oma.is_active = true
            OR td.d < (NOW() AT TIME ZONE 'Asia/Kolkata')::date
            OR EXISTS (
              SELECT 1 FROM public.machine_hour_logs l
              WHERE l.assignment_id = oma.id AND l.log_date = td.d
            )
          )
          AND NOT (
            oma.valid_from = oma.valid_to
            AND oma.is_active = false
            AND NOT EXISTS (
              SELECT 1 FROM public.machine_hour_logs l
              WHERE l.assignment_id = oma.id AND l.log_date = td.d
            )
          )
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
           r.oma_shift_code,
           r.assignment_id,
           l.id AS log_id,
           l.entered_by,
           l.entry_source,
           l.log_date,
           l.start_meter,
           l.end_meter,
           l.running_hours,
           l.remarks,
           l.operator_id as log_operator_id,
           l.site_id as log_site_id,
           l.shift_code as log_shift_code,
           ROW_NUMBER() OVER (
             PARTITION BY r.machine_id, COALESCE(r.operator_id, '00000000-0000-0000-0000-000000000000'::uuid), r.oma_shift_code
             ORDER BY
               CASE
                 WHEN r.assignment_id IS NOT NULL AND l.assignment_id = r.assignment_id THEN 0
                 WHEN l.shift_code = r.oma_shift_code THEN 1
                 ELSE 2
               END,
               l.created_at DESC
           ) as rn
    FROM combined_roster_sources r
    CROSS JOIN target_date td
    LEFT JOIN public.machine_hour_logs l
      ON (
        (r.assignment_id IS NOT NULL AND l.assignment_id = r.assignment_id)
        OR (l.machine_id = r.machine_id AND (
          (r.operator_id IS NOT NULL AND l.operator_id = r.operator_id)
          OR (r.operator_id IS NULL)
        ))
      )
      AND l.log_date = td.d
  ),
  unique_matched_logs AS (
    SELECT * FROM matched_logs WHERE rn = 1
  ),
  roster_results AS (
    SELECT
      r.operator_id,
      COALESCE(u.full_name, log_op.full_name, 'Unassigned') AS operator_name,
      COALESCE(u.phone, log_op.phone) AS operator_phone,
      COALESCE(u.employee_id, log_op.employee_id) AS operator_employee_id,
      r.machine_id,
      r.machine_code,
      r.serial_number AS machine_serial_number,
      r.model AS machine_model,
      r.client_id,
      COALESCE(cl.client_id, cl.code) AS client_code,
      COALESCE(cl.company_name, 'Direct Client') AS client_name,
      COALESCE(cs.city, cl.city, r.machine_city) AS client_city,
      COALESCE(cs.site_name, cs.city, cl.city, r.machine_city) AS site_name,
      COALESCE(ml.end_meter, r.current_meter) AS current_meter,
      COALESCE(ml.log_shift_code, r.oma_shift_code, 'S1') AS shift_code,
      COALESCE('Shift ' || ml.log_shift_code, 'Shift ' || r.oma_shift_code, 'Shift S1') AS shift_name,
      COALESCE(r.shift_start_time, '06:00:00'::time) AS shift_start,
      COALESCE(r.shift_end_time, '14:00:00'::time) AS shift_end,
      CASE
        WHEN r.operator_id IS NULL THEN 'unassigned'
        WHEN ml.log_id IS NOT NULL THEN 'entered'
        ELSE 'pending'
      END AS status,
      ml.log_id,
      ml.entered_by,
      eu.full_name AS entered_by_name,
      ml.entry_source,
      COALESCE(ml.log_date, td.d) AS log_date,
      ml.start_meter,
      ml.end_meter,
      ml.running_hours,
      ml.remarks,
      r.machine_status,
      r.machine_health_status
    FROM combined_roster_sources r
    CROSS JOIN target_date td
    LEFT JOIN unique_matched_logs ml
      ON ml.machine_id = r.machine_id
      AND ml.oma_shift_code = r.oma_shift_code
      AND (
        (r.operator_id IS NOT NULL AND ml.operator_id = r.operator_id)
        OR (r.operator_id IS NULL AND ml.operator_id IS NULL)
      )
    LEFT JOIN public.users u ON u.id = r.operator_id
    LEFT JOIN public.users log_op ON log_op.id = ml.log_operator_id
    LEFT JOIN public.clients cl ON cl.id = r.client_id
    LEFT JOIN public.client_sites cs ON cs.id = COALESCE(ml.log_site_id, r.site_id)
    LEFT JOIN public.users eu ON eu.id = ml.entered_by
  ),
  extra_entered_logs AS (
    SELECT DISTINCT ON (l.machine_id, l.shift_code)
           l.operator_id,
           COALESCE(u.full_name, 'Unassigned') AS operator_name,
           u.phone AS operator_phone,
           u.employee_id AS operator_employee_id,
           l.machine_id,
           COALESCE(m.machine_id, 'M/C') AS machine_code,
           m.serial_number AS machine_serial_number,
           m.model AS machine_model,
           l.client_id,
           COALESCE(cl.client_id, cl.code) AS client_code,
           COALESCE(cl.company_name, 'Direct Client') AS client_name,
           COALESCE(cs.city, cl.city, m.city) AS client_city,
           COALESCE(cs.site_name, cs.city, cl.city, m.city) AS site_name,
           m.hour_meter AS current_meter,
           COALESCE(l.shift_code, 'S1') AS shift_code,
           COALESCE('Shift ' || l.shift_code, 'Shift S1') AS shift_name,
           COALESCE(l.start_time, '06:00:00'::time) AS shift_start,
           COALESCE(l.end_time, '14:00:00'::time) AS shift_end,
           'entered'::text AS status,
           l.id AS log_id,
           l.entered_by,
           eu.full_name AS entered_by_name,
           l.entry_source,
           l.log_date,
           l.start_meter,
           l.end_meter,
           l.running_hours,
           l.remarks,
           m.status AS machine_status,
           m.health_status AS machine_health_status
    FROM public.machine_hour_logs l
    CROSS JOIN target_date td
    JOIN public.machines m ON m.id = l.machine_id
    LEFT JOIN public.users u ON u.id = l.operator_id
    LEFT JOIN public.clients cl ON cl.id = l.client_id
    LEFT JOIN public.client_sites cs ON cs.id = COALESCE(l.site_id, m.site_id)
    LEFT JOIN public.users eu ON eu.id = l.entered_by
    WHERE l.log_date = td.d
      AND (p_client_id IS NULL OR l.client_id = p_client_id OR m.client_id = p_client_id)
      AND NOT EXISTS (
        SELECT 1 FROM roster_results rr
        WHERE rr.log_id = l.id
           OR (rr.machine_id = l.machine_id AND rr.shift_code = l.shift_code AND rr.status = 'entered')
      )
      AND (
        (SELECT role FROM actor_info) IN ('super_admin', 'admin', 'manager')
        OR (l.operator_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.user_supervisors us
          WHERE us.supervisor_id = p_actor_id AND us.user_id = l.operator_id
        ))
        OR (l.operator_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.users op_u
          WHERE op_u.id = l.operator_id AND op_u.supervisor_id = p_actor_id
        ))
        OR m.current_supervisor_id = p_actor_id
        OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
      )
    ORDER BY l.machine_id, l.shift_code, l.created_at DESC
  ),
  all_results AS (
    SELECT * FROM roster_results
    UNION ALL
    SELECT * FROM extra_entered_logs
  )
  SELECT * FROM all_results
  WHERE (p_search IS NULL OR p_search = '' OR (
     operator_name ILIKE '%' || p_search || '%'
     OR COALESCE(operator_phone, '') ILIKE '%' || p_search || '%'
     OR COALESCE(operator_employee_id, '') ILIKE '%' || p_search || '%'
     OR machine_code ILIKE '%' || p_search || '%'
     OR COALESCE(machine_serial_number, '') ILIKE '%' || p_search || '%'
     OR COALESCE(machine_model, '') ILIKE '%' || p_search || '%'
     OR COALESCE(client_name, '') ILIKE '%' || p_search || '%'
     OR COALESCE(client_code, '') ILIKE '%' || p_search || '%'
     OR COALESCE(client_city, '') ILIKE '%' || p_search || '%'
     OR COALESCE(site_name, '') ILIKE '%' || p_search || '%'
  ))
  AND (p_client_id IS NULL OR client_id = p_client_id)
  AND (
    p_shift_code IS NULL
    OR p_shift_code = ''
    OR p_shift_code = 'all'
    OR UPPER(TRIM(REGEXP_REPLACE(shift_code, '^shift\s*', '', 'i'))) = UPPER(TRIM(REGEXP_REPLACE(p_shift_code, '^shift\s*', '', 'i')))
  )
  ORDER BY
    CASE
      WHEN p_sort = 'time_desc' THEN NULL
      ELSE shift_start
    END ASC NULLS LAST,
    CASE
      WHEN p_sort = 'time_desc' THEN shift_start
      ELSE NULL
    END DESC NULLS LAST,
    machine_code ASC,
    shift_code ASC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_today_shift_log_monitor(uuid, date, text, uuid, text, text) TO authenticated, service_role;

-- 2. Upgrade get_today_shift_monitor_summary with identical active-assignment scoping and canonical parameter name p_log_date
CREATE OR REPLACE FUNCTION public.get_today_shift_monitor_summary(
  p_actor_id uuid,
  p_log_date date DEFAULT CURRENT_DATE,
  p_client_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_summary jsonb;
  v_today_ist date;
  v_target_date date;
BEGIN
  v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
  v_target_date := COALESCE(p_log_date, v_today_ist);

  WITH actor_info AS (
    SELECT role FROM public.users WHERE id = p_actor_id
  ),
  active_assignments AS (
    SELECT oma.id AS assignment_id,
           oma.operator_id,
           oma.machine_id,
           oma.shift_code AS oma_shift_code,
           m.client_id
    FROM public.operator_machine_assignments oma
    JOIN public.machines m ON m.id = oma.machine_id
    WHERE oma.valid_from <= v_target_date
      AND (oma.valid_to IS NULL OR oma.valid_to >= v_target_date)
      AND (oma.valid_to IS NULL OR oma.valid_from <= oma.valid_to)
      AND (
        oma.is_active = true
        OR v_target_date < v_today_ist
        OR EXISTS (
          SELECT 1 FROM public.machine_hour_logs l
          WHERE l.assignment_id = oma.id AND l.log_date = v_target_date
        )
      )
      AND NOT (
        oma.valid_from = oma.valid_to
        AND oma.is_active = false
        AND NOT EXISTS (
          SELECT 1 FROM public.machine_hour_logs l
          WHERE l.assignment_id = oma.id AND l.log_date = v_target_date
        )
      )
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
    SELECT NULL::uuid AS assignment_id,
           NULL::uuid AS operator_id,
           m.id AS machine_id,
           'S1'::text AS oma_shift_code,
           m.client_id
    FROM public.machines m
    WHERE (
        m.status IN ('active', 'rented', 'available', 'under_maintenance')
        OR m.health_status IN ('under_maintenance', 'breakdown')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.operator_machine_assignments oma
        WHERE oma.machine_id = m.id
          AND oma.valid_from <= v_target_date
          AND (oma.valid_to IS NULL OR oma.valid_to >= v_target_date)
          AND (oma.valid_to IS NULL OR oma.valid_from <= oma.valid_to)
          AND (
            oma.is_active = true
            OR v_target_date < v_today_ist
            OR EXISTS (
              SELECT 1 FROM public.machine_hour_logs l
              WHERE l.assignment_id = oma.id AND l.log_date = v_target_date
            )
          )
          AND NOT (
            oma.valid_from = oma.valid_to
            AND oma.is_active = false
            AND NOT EXISTS (
              SELECT 1 FROM public.machine_hour_logs l
              WHERE l.assignment_id = oma.id AND l.log_date = v_target_date
            )
          )
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
      ON (
        (r.assignment_id IS NOT NULL AND l.assignment_id = r.assignment_id)
        OR (l.machine_id = r.machine_id AND (
          (r.operator_id IS NOT NULL AND l.operator_id = r.operator_id)
          OR (r.operator_id IS NULL)
        ))
      )
      AND l.log_date = v_target_date
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
$function$;

GRANT EXECUTE ON FUNCTION public.get_today_shift_monitor_summary(uuid, date, uuid) TO authenticated, service_role;

-- 3. Upgrade get_today_shift_log_monitor_paginated with identical active-assignment scoping,
--    normalized shift code filtering, and time sorting
CREATE OR REPLACE FUNCTION public.get_today_shift_log_monitor_paginated(
  p_actor_id uuid,
  p_log_date date DEFAULT CURRENT_DATE,
  p_search text DEFAULT NULL::text,
  p_status text DEFAULT 'all'::text,
  p_client_id uuid DEFAULT NULL::uuid,
  p_shift_code text DEFAULT NULL::text,
  p_sort text DEFAULT 'default'::text,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 12
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_summary jsonb;
  v_rows jsonb;
  v_total_count int;
  v_has_more boolean;
  v_offset int;
  v_safe_page int;
  v_safe_page_size int;
  v_target_date date;
  v_today_ist date;
BEGIN
  v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
  v_target_date := COALESCE(p_log_date, v_today_ist);
  v_safe_page := GREATEST(1, COALESCE(p_page, 1));
  v_safe_page_size := GREATEST(1, LEAST(100, COALESCE(p_page_size, 12)));
  v_offset := (v_safe_page - 1) * v_safe_page_size;

  v_summary := public.get_today_shift_monitor_summary(p_actor_id, v_target_date, p_client_id);

  WITH actor_info AS (
    SELECT role FROM public.users WHERE id = p_actor_id
  ),
  active_assignments AS (
    SELECT oma.id AS assignment_id,
           oma.operator_id,
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
    WHERE oma.valid_from <= v_target_date
      AND (oma.valid_to IS NULL OR oma.valid_to >= v_target_date)
      AND (oma.valid_to IS NULL OR oma.valid_from <= oma.valid_to)
      AND (
        oma.is_active = true
        OR v_target_date < v_today_ist
        OR EXISTS (
          SELECT 1 FROM public.machine_hour_logs l
          WHERE l.assignment_id = oma.id AND l.log_date = v_target_date
        )
      )
      AND NOT (
        oma.valid_from = oma.valid_to
        AND oma.is_active = false
        AND NOT EXISTS (
          SELECT 1 FROM public.machine_hour_logs l
          WHERE l.assignment_id = oma.id AND l.log_date = v_target_date
        )
      )
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
    SELECT NULL::uuid AS assignment_id,
           NULL::uuid AS operator_id,
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
        WHERE oma.machine_id = m.id
          AND oma.valid_from <= v_target_date
          AND (oma.valid_to IS NULL OR oma.valid_to >= v_target_date)
          AND (oma.valid_to IS NULL OR oma.valid_from <= oma.valid_to)
          AND (
            oma.is_active = true
            OR v_target_date < v_today_ist
            OR EXISTS (
              SELECT 1 FROM public.machine_hour_logs l
              WHERE l.assignment_id = oma.id AND l.log_date = v_target_date
            )
          )
          AND NOT (
            oma.valid_from = oma.valid_to
            AND oma.is_active = false
            AND NOT EXISTS (
              SELECT 1 FROM public.machine_hour_logs l
              WHERE l.assignment_id = oma.id AND l.log_date = v_target_date
            )
          )
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
           r.oma_shift_code,
           r.assignment_id,
           l.id AS log_id,
           l.entered_by,
           l.entry_source,
           l.log_date,
           l.start_meter,
           l.end_meter,
           l.running_hours,
           l.remarks,
           l.operator_id as log_operator_id,
           l.site_id as log_site_id,
           l.shift_code as log_shift_code,
           ROW_NUMBER() OVER (
             PARTITION BY r.machine_id, COALESCE(r.operator_id, '00000000-0000-0000-0000-000000000000'::uuid), r.oma_shift_code
             ORDER BY
               CASE
                 WHEN r.assignment_id IS NOT NULL AND l.assignment_id = r.assignment_id THEN 0
                 WHEN l.shift_code = r.oma_shift_code THEN 1
                 ELSE 2
               END,
               l.created_at DESC
           ) as rn
    FROM combined_roster_sources r
    LEFT JOIN public.machine_hour_logs l
      ON (
        (r.assignment_id IS NOT NULL AND l.assignment_id = r.assignment_id)
        OR (l.machine_id = r.machine_id AND (
          (r.operator_id IS NOT NULL AND l.operator_id = r.operator_id)
          OR (r.operator_id IS NULL)
        ))
      )
      AND l.log_date = v_target_date
  ),
  unique_matched_logs AS (
    SELECT * FROM matched_logs WHERE rn = 1
  ),
  roster_results AS (
    SELECT
      r.operator_id,
      COALESCE(u.full_name, log_op.full_name, 'Unassigned') AS operator_name,
      COALESCE(u.phone, log_op.phone) AS operator_phone,
      COALESCE(u.employee_id, log_op.employee_id) AS operator_employee_id,
      r.machine_id,
      r.machine_code,
      r.serial_number AS machine_serial_number,
      r.model AS machine_model,
      r.client_id,
      COALESCE(cl.client_id, cl.code) AS client_code,
      COALESCE(cl.company_name, 'Direct Client') AS client_name,
      COALESCE(cs.city, cl.city, r.machine_city) AS client_city,
      COALESCE(cs.site_name, cs.city, cl.city, r.machine_city) AS site_name,
      COALESCE(ml.end_meter, r.current_meter) AS current_meter,
      COALESCE(ml.log_shift_code, r.oma_shift_code, 'S1') AS shift_code,
      COALESCE('Shift ' || ml.log_shift_code, 'Shift ' || r.oma_shift_code, 'Shift S1') AS shift_name,
      COALESCE(r.shift_start_time, '06:00:00'::time) AS shift_start,
      COALESCE(r.shift_end_time, '14:00:00'::time) AS shift_end,
      CASE
        WHEN r.operator_id IS NULL THEN 'unassigned'
        WHEN ml.log_id IS NOT NULL THEN 'entered'
        ELSE 'pending'
      END AS status,
      ml.log_id,
      ml.entered_by,
      eu.full_name AS entered_by_name,
      ml.entry_source,
      COALESCE(ml.log_date, v_target_date) AS log_date,
      ml.start_meter,
      ml.end_meter,
      ml.running_hours,
      ml.remarks,
      r.machine_status,
      r.machine_health_status
    FROM combined_roster_sources r
    LEFT JOIN unique_matched_logs ml
      ON ml.machine_id = r.machine_id
      AND ml.oma_shift_code = r.oma_shift_code
      AND (
        (r.operator_id IS NOT NULL AND ml.operator_id = r.operator_id)
        OR (r.operator_id IS NULL AND ml.operator_id IS NULL)
      )
    LEFT JOIN public.users u ON u.id = r.operator_id
    LEFT JOIN public.users log_op ON log_op.id = ml.log_operator_id
    LEFT JOIN public.clients cl ON cl.id = r.client_id
    LEFT JOIN public.client_sites cs ON cs.id = COALESCE(ml.log_site_id, r.site_id)
    LEFT JOIN public.users eu ON eu.id = ml.entered_by
  ),
  extra_entered_logs AS (
    SELECT DISTINCT ON (l.machine_id, l.shift_code)
           l.operator_id,
           COALESCE(u.full_name, 'Unassigned') AS operator_name,
           u.phone AS operator_phone,
           u.employee_id AS operator_employee_id,
           l.machine_id,
           COALESCE(m.machine_id, 'M/C') AS machine_code,
           m.serial_number AS machine_serial_number,
           m.model AS machine_model,
           l.client_id,
           COALESCE(cl.client_id, cl.code) AS client_code,
           COALESCE(cl.company_name, 'Direct Client') AS client_name,
           COALESCE(cs.city, cl.city, m.city) AS client_city,
           COALESCE(cs.site_name, cs.city, cl.city, m.city) AS site_name,
           m.hour_meter AS current_meter,
           COALESCE(l.shift_code, 'S1') AS shift_code,
           COALESCE('Shift ' || l.shift_code, 'Shift S1') AS shift_name,
           COALESCE(l.start_time, '06:00:00'::time) AS shift_start,
           COALESCE(l.end_time, '14:00:00'::time) AS shift_end,
           'entered'::text AS status,
           l.id AS log_id,
           l.entered_by,
           eu.full_name AS entered_by_name,
           l.entry_source,
           l.log_date,
           l.start_meter,
           l.end_meter,
           l.running_hours,
           l.remarks,
           m.status AS machine_status,
           m.health_status AS machine_health_status
    FROM public.machine_hour_logs l
    JOIN public.machines m ON m.id = l.machine_id
    LEFT JOIN public.users u ON u.id = l.operator_id
    LEFT JOIN public.clients cl ON cl.id = l.client_id
    LEFT JOIN public.client_sites cs ON cs.id = COALESCE(l.site_id, m.site_id)
    LEFT JOIN public.users eu ON eu.id = l.entered_by
    WHERE l.log_date = v_target_date
      AND (p_client_id IS NULL OR l.client_id = p_client_id OR m.client_id = p_client_id)
      AND NOT EXISTS (
        SELECT 1 FROM roster_results rr
        WHERE rr.log_id = l.id
           OR (rr.machine_id = l.machine_id AND rr.shift_code = l.shift_code AND rr.status = 'entered')
      )
      AND (
        (SELECT role FROM actor_info) IN ('super_admin', 'admin', 'manager')
        OR (l.operator_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.user_supervisors us
          WHERE us.supervisor_id = p_actor_id AND us.user_id = l.operator_id
        ))
        OR (l.operator_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.users op_u
          WHERE op_u.id = l.operator_id AND op_u.supervisor_id = p_actor_id
        ))
        OR m.current_supervisor_id = p_actor_id
        OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
      )
    ORDER BY l.machine_id, l.shift_code, l.created_at DESC
  ),
  all_results AS (
    SELECT * FROM roster_results
    UNION ALL
    SELECT * FROM extra_entered_logs
  ),
  filtered_results AS (
    SELECT * FROM all_results
    WHERE (p_search IS NULL OR p_search = '' OR (
       operator_name ILIKE '%' || p_search || '%'
       OR COALESCE(operator_phone, '') ILIKE '%' || p_search || '%'
       OR COALESCE(operator_employee_id, '') ILIKE '%' || p_search || '%'
       OR machine_code ILIKE '%' || p_search || '%'
       OR COALESCE(machine_serial_number, '') ILIKE '%' || p_search || '%'
       OR COALESCE(machine_model, '') ILIKE '%' || p_search || '%'
       OR COALESCE(client_name, '') ILIKE '%' || p_search || '%'
       OR COALESCE(client_code, '') ILIKE '%' || p_search || '%'
       OR COALESCE(client_city, '') ILIKE '%' || p_search || '%'
       OR COALESCE(site_name, '') ILIKE '%' || p_search || '%'
    ))
    AND (p_status = 'all' OR status = p_status)
    AND (p_client_id IS NULL OR client_id = p_client_id)
    AND (
      p_shift_code IS NULL
      OR p_shift_code = ''
      OR p_shift_code = 'all'
      OR UPPER(TRIM(REGEXP_REPLACE(shift_code, '^shift\s*', '', 'i'))) = UPPER(TRIM(REGEXP_REPLACE(p_shift_code, '^shift\s*', '', 'i')))
    )
  ),
  counted AS (
    SELECT COUNT(*) AS total FROM filtered_results
  ),
  paginated_results AS (
    SELECT * FROM filtered_results
    ORDER BY
      CASE
        WHEN p_sort = 'time_desc' THEN shift_start
        ELSE NULL
      END DESC NULLS LAST,
      CASE
        WHEN p_sort = 'time_asc' THEN shift_start
        WHEN p_sort = 'time_desc' THEN NULL
        ELSE NULL
      END ASC NULLS LAST,
      CASE p_sort
        WHEN 'machine_asc' THEN machine_code
        ELSE NULL
      END ASC,
      CASE p_sort
        WHEN 'machine_desc' THEN machine_code
        ELSE NULL
      END DESC,
      CASE
        WHEN p_sort = 'default' AND log_id IS NOT NULL THEN 3
        WHEN p_sort = 'default' AND machine_health_status IN ('breakdown', 'under_maintenance') THEN 0
        WHEN p_sort = 'default' AND operator_id IS NULL THEN 1
        WHEN p_sort = 'default' THEN 2
        ELSE 0
      END,
      shift_start ASC NULLS LAST,
      machine_code,
      shift_code
    OFFSET v_offset
    LIMIT v_safe_page_size
  )
  SELECT
    (SELECT total FROM counted) AS total_count,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'operator_id', pr.operator_id,
          'operator_name', pr.operator_name,
          'operator_phone', pr.operator_phone,
          'operator_employee_id', pr.operator_employee_id,
          'machine_id', pr.machine_id,
          'machine_code', pr.machine_code,
          'machine_serial_number', pr.machine_serial_number,
          'machine_model', pr.machine_model,
          'client_id', pr.client_id,
          'client_code', pr.client_code,
          'client_name', pr.client_name,
          'client_city', pr.client_city,
          'site_name', pr.site_name,
          'current_meter', pr.current_meter,
          'shift_code', pr.shift_code,
          'shift_name', pr.shift_name,
          'shift_start', pr.shift_start,
          'shift_end', pr.shift_end,
          'status', pr.status,
          'log_id', pr.log_id,
          'entered_by', pr.entered_by,
          'entered_by_name', pr.entered_by_name,
          'entry_source', pr.entry_source,
          'log_date', pr.log_date,
          'start_meter', pr.start_meter,
          'end_meter', pr.end_meter,
          'running_hours', pr.running_hours,
          'remarks', pr.remarks,
          'machine_status', pr.machine_status,
          'machine_health_status', pr.machine_health_status
        )
      ),
      '[]'::jsonb
    ) AS rows
  INTO v_total_count, v_rows
  FROM paginated_results pr;

  v_has_more := (v_offset + v_safe_page_size) < COALESCE(v_total_count, 0);

  RETURN jsonb_build_object(
    'summary', v_summary,
    'rows', COALESCE(v_rows, '[]'::jsonb),
    'total_count', COALESCE(v_total_count, 0),
    'has_more', v_has_more,
    'page', v_safe_page,
    'page_size', v_safe_page_size
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_today_shift_log_monitor_paginated(uuid, date, text, text, uuid, text, text, int, int) TO authenticated, service_role;

-- 4. Reload schema cache immediately
NOTIFY pgrst, 'reload schema';
