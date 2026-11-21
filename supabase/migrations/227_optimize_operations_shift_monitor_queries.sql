-- ==============================================================================
-- Migration 227: Operations Shift Monitor — Query Plan & Planning-Cost Optimization
-- ==============================================================================
-- PROBLEM (measured on the Development database: 6 machines / 54 logs / 100 assignments,
--          where a single real-table plan costs ~0.8-3.7 ms per relation because of
--          loaded planner hooks - pgaudit / plan_filter / plpgsql_check):
--
--   public.get_today_shift_log_monitor(uuid,date,text,uuid,text,text)   ~36 ms  (1 huge plan, ~99 ms inline)
--   public.get_today_shift_log_monitor_paginated(...)                   ~47 ms  (re-implemented the same query tree)
--   public.get_today_shift_monitor_summary(uuid,date,uuid)              ~22 ms  (re-implemented it a third time)
--
--   => one `/operations` roster load burned ~70-100 ms of pure PostgreSQL CPU
--      computing the SAME roster two/three times, with 6 separately planned statements.
--
-- ROOT CAUSES FIXED HERE
--   1. RBAC was re-evaluated with correlated EXISTS / hashed SubPlans inside EVERY CTE
--      (observed: InitPlan 7/14/23 + SubPlan 9/11/13/16/25/27). It is now a plain
--      predicate evaluated against scalar scope values resolved once per call.
--   2. "Has a log for this assignment on the target date" was a correlated EXISTS over
--      machine_hour_logs inside a bitmap-filtered scan (SubPlan 4/6/18/20). The target
--      day's logs are now read once (single log_date index scan) and every consumer
--      reuses that materialized CTE.
--   3. The log join used an OR-ed join condition, blocking hash/merge joins. It is now
--      anchored on the equality key (machine_id) so the planner picks a hash join while
--      the original match priority is still resolved by ROW_NUMBER().
--   4. `extra_entered_logs` anti-joined a 200-line CTE with an OR predicate; it now
--      anti-joins the small materialized `base` set on equality keys.
--   5. `machines` was opened three times by the planner (roster, unassigned, extra).
--      A single slim projection CTE is now referenced instead.
--   6. Everything runs as ONE planned statement per RPC call (previously 6 statements in
--      plpgsql, each paying full planning cost).
--   7. The paginated RPC no longer duplicates the roster query: it delegates to the
--      canonical monitor function and only filters/counts/pages the (bounded,
--      single-day) result set.
--
-- SEMANTICS: behaviour-preserving. Same signatures, same RETURN types and column order,
-- same defaults (shift 'S1', 06:00-14:00), same RBAC matrix, same active-assignment
-- scoping from migrations 223/225/226, same search fields, same shift-code
-- normalisation, and the same sort contracts.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. Remove the stale pre-225 overload.
--
-- `get_today_shift_log_monitor(uuid,date,text,uuid)` survived earlier signature changes
-- and duplicated the 6-parameter function with an OUTDATED body (pre date-independent
-- assignment scoping). Worse, because BOTH overloads default their trailing parameters,
-- ANY call that omitted `p_shift_code`/`p_sort` failed with 42725
-- "function ... is not unique" — e.g. the native app's
-- `useTodayShiftMonitor` ({ p_actor_id, p_log_date, p_client_id? }) could never resolve.
-- The 6-parameter function defaults every trailing argument, so a single candidate
-- resolves every call shape.
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_today_shift_log_monitor(uuid, date, text, uuid);

-- ------------------------------------------------------------------------------
-- 1. Canonical, optimized shift log monitor (single planned statement)
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
  -- Single scan of the target day's logs, pre-joined to the people columns every
  -- consumer needs (avoids opening `users` repeatedly during planning).
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
  -- Slim machine projection referenced by roster / unassigned / extra so the planner
  -- opens `machines` (17 indexes) exactly once per call.
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
  -- RBAC-free qualifying assignment ranges for the target date. Reused by the roster
  -- and by the "unassigned machine" anti-join (which must ignore actor scope).
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
        oma.valid_from = oma.valid_to
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
    ) ml
    CROSS JOIN params td
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
        oma.valid_from = oma.valid_to
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
-- 3. Paginated variant now delegates to the canonical monitor implementation
--    instead of duplicating a second 15 KB query tree.
-- ------------------------------------------------------------------------------
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
#variable_conflict use_column
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
  v_status text;
BEGIN
  v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
  v_target_date := COALESCE(p_log_date, v_today_ist);
  v_safe_page := GREATEST(1, COALESCE(p_page, 1));
  v_safe_page_size := GREATEST(1, LEAST(100, COALESCE(p_page_size, 12)));
  v_offset := (v_safe_page - 1) * v_safe_page_size;
  v_status := COALESCE(NULLIF(BTRIM(p_status), ''), 'all');

  v_summary := public.get_today_shift_monitor_summary(p_actor_id, v_target_date, p_client_id);

  WITH filtered_results AS MATERIALIZED (
    SELECT src.*
    FROM public.get_today_shift_log_monitor(
      p_actor_id,
      v_target_date,
      p_search,
      p_client_id,
      p_shift_code,
      p_sort
    ) src
    WHERE (v_status = 'all' OR src.status = v_status)
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
      CASE
        WHEN p_sort = 'machine_asc' THEN machine_code
        ELSE NULL
      END ASC,
      CASE
        WHEN p_sort = 'machine_desc' THEN machine_code
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
    (SELECT total FROM counted),
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
    )
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

GRANT EXECUTE ON FUNCTION public.get_today_shift_log_monitor_paginated(uuid, date, text, text, uuid, text, text, integer, integer)
  TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. Supporting index for single-day log scans grouped by machine/shift.
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_mhl_logdate_machine_shift
  ON public.machine_hour_logs (log_date, machine_id, shift_code, created_at DESC);

-- Refresh PostgREST schema cache so the new function bodies are used immediately.
NOTIFY pgrst, 'reload schema';
