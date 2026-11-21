-- Migration 230: Fix past-date operator assignment visibility in shift log monitor and summary RPCs
--
-- Problem:
--   When an operator is assigned to a past date (within the [today-7, today+1] window),
--   the assignment record is created with valid_from = target_date, valid_to = target_date.
--   Because valid_to < today_ist, trg_fn_sync_oma_valid_range sets is_active = false.
--   In get_today_shift_log_monitor and get_today_shift_monitor_summary, the filter:
--     AND NOT (
--       oma.valid_from = oma.valid_to
--       AND oma.is_active = false
--       AND NOT EXISTS (SELECT 1 FROM logs lg WHERE lg.assignment_id = oma.id)
--     )
--   was intended only for SAME-DAY RELIEVED operators on TODAY (target_date >= today_ist)
--   so relieved operators without logs don't show as pending on today's monitor.
--   However, omitting "p.target_date >= p.today_ist" caused ALL valid past-date assignments
--   without logs to be silently excluded from the monitor, rendering them as "Unassigned".
--
-- Solution:
--   Scope the exclusion guard with "p.target_date >= p.today_ist" so that valid past-date
--   assignments (valid_from <= target_date AND valid_to >= target_date) properly appear
--   with status = 'pending' (or 'entered' if logs exist) on their assigned past date.

-- ------------------------------------------------------------------------------
-- 1. Canonical, optimized shift log monitor
-- ------------------------------------------------------------------------------
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
  WITH params AS MATERIALIZED (
    SELECT
      (NOW() AT TIME ZONE 'Asia/Kolkata')::date AS today_ist,
      COALESCE(p_log_date, (NOW() AT TIME ZONE 'Asia/Kolkata')::date) AS target_date,
      COALESCE(
        (SELECT u.role::text FROM public.users u WHERE u.id = p_actor_id)
          IN ('super_admin', 'admin', 'manager'),
        false
      ) AS privileged,
      COALESCE((
        SELECT array_agg(DISTINCT t.operator_id)
        FROM (
          SELECT us.user_id AS operator_id
          FROM public.user_supervisors us
          WHERE us.supervisor_id = p_actor_id
          UNION
          SELECT u2.id
          FROM public.users u2
          WHERE u2.supervisor_id = p_actor_id
        ) t
      ), ARRAY[]::uuid[]) AS scope_operators,
      COALESCE((
        SELECT array_agg(DISTINCT cs.client_id)
        FROM public.client_supervisors cs
        WHERE cs.supervisor_id = p_actor_id
      ), ARRAY[]::uuid[]) AS scope_clients,
      NULLIF(BTRIM(COALESCE(p_search, '')), '') AS search_term,
      CASE
        WHEN NULLIF(BTRIM(COALESCE(p_shift_code, '')), '') IS NULL THEN NULL
        WHEN LOWER(BTRIM(p_shift_code)) = 'all' THEN NULL
        ELSE UPPER(TRIM(REGEXP_REPLACE(BTRIM(p_shift_code), '^shift\s*', '', 'i')))
      END AS shift_term
  ),
  logs AS MATERIALIZED (
    SELECT
      l.id,
      l.assignment_id,
      l.machine_id,
      l.operator_id,
      l.shift_code,
      l.entered_by,
      l.entry_source,
      l.log_date,
      l.start_meter,
      l.end_meter,
      l.running_hours,
      l.remarks,
      l.site_id,
      l.client_id,
      l.created_at,
      l.start_time,
      l.end_time,
      lu.full_name AS log_operator_name,
      lu.phone AS log_operator_phone,
      lu.employee_id AS log_operator_employee_id,
      eu.full_name AS entered_by_name
    FROM public.machine_hour_logs l
    CROSS JOIN params p
    LEFT JOIN public.users lu ON lu.id = l.operator_id
    LEFT JOIN public.users eu ON eu.id = l.entered_by
    WHERE l.log_date = p.target_date
  ),
  machines_slim AS MATERIALIZED (
    SELECT
      m.id,
      m.machine_id,
      m.serial_number,
      m.model,
      m.client_id,
      m.site_id,
      m.city,
      m.hour_meter,
      m.status,
      m.health_status,
      m.current_supervisor_id,
      m.supervisor_ids
    FROM public.machines m
  ),
  assignments_on_date AS MATERIALIZED (
    SELECT
      oma.id AS assignment_id,
      oma.operator_id,
      oma.machine_id,
      oma.shift_code AS oma_shift_code,
      oma.shift_start_time,
      oma.shift_end_time
    FROM public.operator_machine_assignments oma
    CROSS JOIN params p
    WHERE oma.valid_from <= p.target_date
      AND (oma.valid_to IS NULL OR oma.valid_to >= p.target_date)
      AND (oma.valid_to IS NULL OR oma.valid_from <= oma.valid_to)
      AND (
        oma.is_active = true
        OR p.target_date < p.today_ist
        OR EXISTS (SELECT 1 FROM logs lg WHERE lg.assignment_id = oma.id)
      )
      AND NOT (
        p.target_date >= p.today_ist
        AND oma.valid_from = oma.valid_to
        AND oma.is_active = false
        AND NOT EXISTS (SELECT 1 FROM logs lg WHERE lg.assignment_id = oma.id)
      )
  ),
  roster AS MATERIALIZED (
    SELECT
      a.assignment_id,
      a.operator_id,
      a.machine_id,
      a.shift_start_time,
      a.shift_end_time,
      a.oma_shift_code,
      m.machine_id AS machine_code,
      m.serial_number,
      m.model,
      m.client_id,
      m.site_id,
      m.city AS machine_city,
      m.hour_meter AS current_meter,
      m.status AS machine_status,
      m.health_status AS machine_health_status
    FROM assignments_on_date a
    JOIN machines_slim m ON m.id = a.machine_id
    CROSS JOIN params p
    WHERE (
      p.privileged
      OR a.operator_id = ANY (p.scope_operators)
      OR m.current_supervisor_id = p_actor_id
      OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
      OR m.client_id = ANY (p.scope_clients)
    )
    UNION ALL
    SELECT
      NULL::uuid,
      NULL::uuid,
      m.id,
      NULL::time,
      NULL::time,
      'S1'::text,
      m.machine_id,
      m.serial_number,
      m.model,
      m.client_id,
      m.site_id,
      m.city,
      m.hour_meter,
      m.status,
      m.health_status
    FROM machines_slim m
    CROSS JOIN params p
    WHERE (
        m.status IN ('active', 'rented', 'available', 'under_maintenance')
        OR m.health_status IN ('under_maintenance', 'breakdown')
      )
      AND NOT EXISTS (
        SELECT 1 FROM assignments_on_date a WHERE a.machine_id = m.id
      )
      AND (
        p.privileged
        OR m.current_supervisor_id = p_actor_id
        OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
        OR m.client_id = ANY (p.scope_clients)
      )
  ),
  base AS MATERIALIZED (
    SELECT
      ml.operator_id,
      COALESCE(u.full_name, ml.log_operator_name, 'Unassigned') AS operator_name,
      COALESCE(u.phone, ml.log_operator_phone) AS operator_phone,
      COALESCE(u.employee_id, ml.log_operator_employee_id) AS operator_employee_id,
      ml.machine_id,
      ml.machine_code,
      ml.serial_number AS machine_serial_number,
      ml.model AS machine_model,
      ml.client_id,
      COALESCE(cl.client_id, cl.code) AS client_code,
      COALESCE(cl.company_name, 'Direct Client') AS client_name,
      COALESCE(cs.city, cl.city, ml.machine_city) AS client_city,
      COALESCE(cs.site_name, cs.city, cl.city, ml.machine_city) AS site_name,
      COALESCE(ml.end_meter, ml.current_meter) AS current_meter,
      COALESCE(ml.log_shift_code, ml.oma_shift_code, 'S1') AS shift_code,
      COALESCE('Shift ' || ml.log_shift_code, 'Shift ' || ml.oma_shift_code, 'Shift S1') AS shift_name,
      COALESCE(ml.shift_start_time, '06:00:00'::time) AS shift_start,
      COALESCE(ml.shift_end_time, '14:00:00'::time) AS shift_end,
      CASE
        WHEN ml.operator_id IS NULL THEN 'unassigned'
        WHEN ml.log_id IS NOT NULL THEN 'entered'
        ELSE 'pending'
      END AS status,
      ml.log_id,
      ml.entered_by,
      ml.entered_by_name,
      ml.log_entry_source AS entry_source,
      COALESCE(ml.log_date, td.target_date) AS log_date,
      ml.start_meter,
      ml.end_meter,
      ml.running_hours,
      ml.remarks,
      ml.machine_status,
      ml.machine_health_status
    FROM (
      SELECT
        r.operator_id,
        r.machine_id,
        r.oma_shift_code,
        r.assignment_id,
        r.shift_start_time,
        r.shift_end_time,
        r.machine_code,
        r.serial_number,
        r.model,
        r.client_id,
        r.site_id,
        r.machine_city,
        r.current_meter,
        r.machine_status,
        r.machine_health_status,
        l.id AS log_id,
        l.entered_by,
        l.entry_source AS log_entry_source,
        l.log_date,
        l.start_meter,
        l.end_meter,
        l.running_hours,
        l.remarks,
        l.operator_id AS log_operator_id,
        l.site_id AS log_site_id,
        l.shift_code AS log_shift_code,
        l.log_operator_name,
        l.log_operator_phone,
        l.log_operator_employee_id,
        l.entered_by_name,
        ROW_NUMBER() OVER (
          PARTITION BY r.machine_id, COALESCE(r.operator_id, '00000000-0000-0000-0000-000000000000'::uuid), r.oma_shift_code
          ORDER BY
            CASE
              WHEN l.assignment_id = r.assignment_id THEN 0
              WHEN l.shift_code = r.oma_shift_code THEN 1
              ELSE 2
            END,
            l.created_at DESC
        ) AS rn
      FROM roster r
      LEFT JOIN logs l
        ON l.machine_id = r.machine_id
        AND (
          l.assignment_id = r.assignment_id
          OR (r.operator_id IS NOT NULL AND l.operator_id = r.operator_id)
          OR r.operator_id IS NULL
        )
      WHERE (p_client_id IS NULL OR r.client_id = p_client_id)
    ) ml
    CROSS JOIN (SELECT target_date FROM params) td
    LEFT JOIN public.users u ON u.id = ml.operator_id
    LEFT JOIN public.clients cl ON cl.id = ml.client_id
    LEFT JOIN public.client_sites cs ON cs.id = COALESCE(ml.log_site_id, ml.site_id)
    WHERE ml.rn = 1
  ),
  extra AS (
    SELECT DISTINCT ON (l.machine_id, l.shift_code)
      l.operator_id,
      COALESCE(l.log_operator_name, 'Unassigned') AS operator_name,
      l.log_operator_phone AS operator_phone,
      l.log_operator_employee_id AS operator_employee_id,
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
      l.entered_by_name,
      l.entry_source,
      l.log_date,
      l.start_meter,
      l.end_meter,
      l.running_hours,
      l.remarks,
      m.status AS machine_status,
      m.health_status AS machine_health_status
    FROM logs l
    JOIN machines_slim m ON m.id = l.machine_id
    CROSS JOIN params p
    LEFT JOIN public.clients cl ON cl.id = l.client_id
    LEFT JOIN public.client_sites cs ON cs.id = COALESCE(l.site_id, m.site_id)
    WHERE (p_client_id IS NULL OR l.client_id = p_client_id OR m.client_id = p_client_id)
      AND NOT EXISTS (
        SELECT 1 FROM base b WHERE b.log_id = l.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM base b
        WHERE b.machine_id = l.machine_id
          AND b.shift_code = l.shift_code
          AND b.log_id IS NOT NULL
      )
      AND (
        p.privileged
        OR l.operator_id = ANY (p.scope_operators)
        OR m.current_supervisor_id = p_actor_id
        OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
      )
    ORDER BY l.machine_id, l.shift_code, l.created_at DESC
  ),
  roster_union AS (
    SELECT * FROM base
    UNION ALL
    SELECT * FROM extra
  )
  SELECT
    ru.operator_id,
    ru.operator_name::text,
    ru.operator_phone::text,
    ru.operator_employee_id::text,
    ru.machine_id,
    ru.machine_code::text,
    ru.machine_serial_number::text,
    ru.machine_model::text,
    ru.client_id,
    ru.client_code::text,
    ru.client_name::text,
    ru.client_city::text,
    ru.site_name::text,
    ru.current_meter,
    ru.shift_code::text,
    ru.shift_name::text,
    ru.shift_start,
    ru.shift_end,
    ru.status::text,
    ru.log_id,
    ru.entered_by,
    ru.entered_by_name::text,
    ru.entry_source::text,
    ru.log_date,
    ru.start_meter,
    ru.end_meter,
    ru.running_hours,
    ru.remarks::text,
    ru.machine_status::text,
    ru.machine_health_status::text
  FROM roster_union ru
  CROSS JOIN params p
  WHERE (
      p.search_term IS NULL
      OR ru.operator_name ILIKE '%' || p.search_term || '%'
      OR COALESCE(ru.operator_phone, '') ILIKE '%' || p.search_term || '%'
      OR COALESCE(ru.operator_employee_id, '') ILIKE '%' || p.search_term || '%'
      OR ru.machine_code ILIKE '%' || p.search_term || '%'
      OR COALESCE(ru.machine_serial_number, '') ILIKE '%' || p.search_term || '%'
      OR COALESCE(ru.machine_model, '') ILIKE '%' || p.search_term || '%'
      OR COALESCE(ru.client_name, '') ILIKE '%' || p.search_term || '%'
      OR COALESCE(ru.client_code, '') ILIKE '%' || p.search_term || '%'
      OR COALESCE(ru.client_city, '') ILIKE '%' || p.search_term || '%'
      OR COALESCE(ru.site_name, '') ILIKE '%' || p.search_term || '%'
    )
    AND (p_client_id IS NULL OR ru.client_id = p_client_id)
    AND (
      p.shift_term IS NULL
      OR UPPER(TRIM(REGEXP_REPLACE(ru.shift_code::text, '^shift\s*', '', 'i'))) = p.shift_term
    )
  ORDER BY
    CASE WHEN p_sort = 'time_desc' THEN NULL ELSE ru.shift_start END ASC NULLS LAST,
    CASE WHEN p_sort = 'time_desc' THEN ru.shift_start ELSE NULL END DESC NULLS LAST,
    ru.machine_code ASC,
    ru.shift_code ASC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_today_shift_log_monitor(uuid, date, text, uuid, text, text)
  TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. Optimized summary (same shared roster definition, single planned statement)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_today_shift_monitor_summary(
  p_actor_id uuid,
  p_log_date date DEFAULT CURRENT_DATE,
  p_client_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH params AS MATERIALIZED (
    SELECT
      (NOW() AT TIME ZONE 'Asia/Kolkata')::date AS today_ist,
      COALESCE(p_log_date, (NOW() AT TIME ZONE 'Asia/Kolkata')::date) AS target_date,
      COALESCE(
        (SELECT u.role::text FROM public.users u WHERE u.id = p_actor_id)
          IN ('super_admin', 'admin', 'manager'),
        false
      ) AS privileged,
      COALESCE((
        SELECT array_agg(DISTINCT t.operator_id)
        FROM (
          SELECT us.user_id AS operator_id
          FROM public.user_supervisors us
          WHERE us.supervisor_id = p_actor_id
          UNION
          SELECT u2.id
          FROM public.users u2
          WHERE u2.supervisor_id = p_actor_id
        ) t
      ), ARRAY[]::uuid[]) AS scope_operators,
      COALESCE((
        SELECT array_agg(DISTINCT cs.client_id)
        FROM public.client_supervisors cs
        WHERE cs.supervisor_id = p_actor_id
      ), ARRAY[]::uuid[]) AS scope_clients
  ),
  logs AS MATERIALIZED (
    SELECT l.id, l.assignment_id, l.machine_id, l.operator_id, l.shift_code, l.created_at
    FROM public.machine_hour_logs l
    CROSS JOIN params p
    WHERE l.log_date = p.target_date
  ),
  machines_slim AS MATERIALIZED (
    SELECT m.id, m.status, m.health_status, m.client_id, m.current_supervisor_id, m.supervisor_ids
    FROM public.machines m
  ),
  assignments_on_date AS MATERIALIZED (
    SELECT
      oma.id AS assignment_id,
      oma.operator_id,
      oma.machine_id,
      oma.shift_code AS oma_shift_code
    FROM public.operator_machine_assignments oma
    CROSS JOIN params p
    WHERE oma.valid_from <= p.target_date
      AND (oma.valid_to IS NULL OR oma.valid_to >= p.target_date)
      AND (oma.valid_to IS NULL OR oma.valid_from <= oma.valid_to)
      AND (
        oma.is_active = true
        OR p.target_date < p.today_ist
        OR EXISTS (SELECT 1 FROM logs lg WHERE lg.assignment_id = oma.id)
      )
      AND NOT (
        p.target_date >= p.today_ist
        AND oma.valid_from = oma.valid_to
        AND oma.is_active = false
        AND NOT EXISTS (SELECT 1 FROM logs lg WHERE lg.assignment_id = oma.id)
      )
  ),
  roster AS MATERIALIZED (
    SELECT a.assignment_id, a.operator_id, a.machine_id, a.oma_shift_code, m.client_id
    FROM assignments_on_date a
    JOIN machines_slim m ON m.id = a.machine_id
    CROSS JOIN params p
    WHERE (
      p.privileged
      OR a.operator_id = ANY (p.scope_operators)
      OR m.current_supervisor_id = p_actor_id
      OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
      OR m.client_id = ANY (p.scope_clients)
    )
    UNION ALL
    SELECT NULL::uuid, NULL::uuid, m.id, 'S1'::text, m.client_id
    FROM machines_slim m
    CROSS JOIN params p
    WHERE (
        m.status IN ('active', 'rented', 'available', 'under_maintenance')
        OR m.health_status IN ('under_maintenance', 'breakdown')
      )
      AND NOT EXISTS (
        SELECT 1 FROM assignments_on_date a WHERE a.machine_id = m.id
      )
      AND (
        p.privileged
        OR m.current_supervisor_id = p_actor_id
        OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
        OR m.client_id = ANY (p.scope_clients)
      )
  ),
  matched AS MATERIALIZED (
    SELECT
      r.operator_id,
      r.machine_id,
      r.assignment_id,
      r.oma_shift_code,
      l.id AS log_id,
      ROW_NUMBER() OVER (
        PARTITION BY r.machine_id, COALESCE(r.operator_id, '00000000-0000-0000-0000-000000000000'::uuid)
        ORDER BY
          CASE
            WHEN l.assignment_id = r.assignment_id THEN 0
            WHEN l.shift_code = r.oma_shift_code THEN 1
            ELSE 2
          END,
          l.created_at DESC
      ) AS rn
    FROM roster r
    LEFT JOIN logs l
      ON l.machine_id = r.machine_id
      AND (
        l.assignment_id = r.assignment_id
        OR (r.operator_id IS NOT NULL AND l.operator_id = r.operator_id)
        OR r.operator_id IS NULL
      )
    WHERE (p_client_id IS NULL OR r.client_id = p_client_id)
  )
  SELECT COALESCE(
    jsonb_build_object(
      'total', COUNT(*),
      'entered', COUNT(*) FILTER (WHERE status = 'entered'),
      'pending', COUNT(*) FILTER (WHERE status = 'pending'),
      'unassigned', COUNT(*) FILTER (WHERE status = 'unassigned')
    ),
    '{"total": 0, "entered": 0, "pending": 0, "unassigned": 0}'::jsonb
  )
  FROM (
    SELECT
      CASE
        WHEN m.operator_id IS NULL THEN 'unassigned'
        WHEN m.log_id IS NOT NULL THEN 'entered'
        ELSE 'pending'
      END AS status
    FROM matched m
    WHERE m.rn = 1
  ) classified;
$function$;

GRANT EXECUTE ON FUNCTION public.get_today_shift_monitor_summary(uuid, date, uuid)
  TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. Reload schema cache for PostgREST
-- ------------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
