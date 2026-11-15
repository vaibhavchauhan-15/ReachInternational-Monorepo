-- Migration 186: Phase 4 — Date-Independent Shift Log Monitor & Operator Entry Context
-- Updates:
--   1. get_today_shift_monitor_summary() — uses valid_from/valid_to date ranges instead of is_active = true
--   2. get_today_shift_log_monitor() — uses valid_from/valid_to date ranges for historical roster accuracy
--   3. get_today_shift_log_monitor_paginated() — uses valid_from/valid_to date ranges + assignment_id matching
--   4. get_operator_entry_context() — IST-aware today date + range-based active assignment + returns assignment_id

-- ============================================================
-- 1. get_today_shift_monitor_summary
-- ============================================================
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
  v_target_date date;
BEGIN
  v_target_date := COALESCE(p_log_date, (NOW() AT TIME ZONE 'Asia/Kolkata')::date);

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
           m.client_id
    FROM public.operator_machine_assignments oma
    JOIN public.machines m ON m.id = oma.machine_id
    WHERE oma.valid_from <= v_target_date
      AND (oma.valid_to IS NULL OR oma.valid_to >= v_target_date)
      AND (
        oma.valid_to IS NULL
        OR oma.valid_from < oma.valid_to
        OR EXISTS (
          SELECT 1 FROM public.machine_hour_logs mhl
          WHERE mhl.assignment_id = oma.id AND mhl.log_date = v_target_date
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
          AND (
            oma.valid_to IS NULL
            OR oma.valid_from < oma.valid_to
            OR EXISTS (
              SELECT 1 FROM public.machine_hour_logs mhl
              WHERE mhl.assignment_id = oma.id AND mhl.log_date = v_target_date
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

-- ============================================================
-- 2. get_today_shift_log_monitor
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_today_shift_log_monitor(
  p_actor_id uuid,
  p_log_date date DEFAULT CURRENT_DATE,
  p_search text DEFAULT NULL::text,
  p_client_id uuid DEFAULT NULL::uuid
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
      AND (
        oma.valid_to IS NULL
        OR oma.valid_from < oma.valid_to
        OR EXISTS (
          SELECT 1 FROM public.machine_hour_logs mhl
          WHERE mhl.assignment_id = oma.id AND mhl.log_date = td.d
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
          AND (
            oma.valid_to IS NULL
            OR oma.valid_from < oma.valid_to
            OR EXISTS (
              SELECT 1 FROM public.machine_hour_logs mhl
              WHERE mhl.assignment_id = oma.id AND mhl.log_date = td.d
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
  roster AS (
    SELECT a.*,
           COALESCE(matched_csc.code, a.oma_shift_code, 'S1') AS shift_code,
           COALESCE(matched_csc.name, 'Shift ' || COALESCE(matched_csc.code, a.oma_shift_code, 'S1')) AS shift_name,
           COALESCE(matched_csc.start_time, a.shift_start_time, '06:00:00'::time) AS shift_start,
           COALESCE(matched_csc.end_time, a.shift_end_time, '14:00:00'::time) AS shift_end
    FROM combined_roster_sources a
    LEFT JOIN LATERAL (
      SELECT csc.code, csc.name, csc.start_time, csc.end_time
      FROM public.client_shift_codes csc
      WHERE csc.client_id = a.client_id
        AND csc.is_active = true
      ORDER BY
        CASE
          WHEN a.oma_shift_code IS NOT NULL AND lower(trim(csc.code)) = lower(trim(regexp_replace(a.oma_shift_code, '^shift\s*', '', 'i'))) THEN 0
          WHEN a.oma_shift_code IS NOT NULL AND lower(trim(csc.code)) = lower(trim(a.oma_shift_code)) THEN 1
          WHEN upper(trim(a.oma_shift_code)) = 'S1' AND csc.display_order = 1 THEN 2
          WHEN upper(trim(a.oma_shift_code)) = 'S2' AND csc.display_order = 2 THEN 2
          WHEN upper(trim(a.oma_shift_code)) = 'S3' AND csc.display_order = 3 THEN 2
          WHEN a.shift_start_time IS NOT NULL AND csc.start_time = a.shift_start_time THEN 3
          ELSE 4
        END ASC,
        CASE
          WHEN a.shift_start_time IS NOT NULL THEN
            LEAST(
              ABS(EXTRACT(EPOCH FROM (csc.start_time - a.shift_start_time))),
              86400 - ABS(EXTRACT(EPOCH FROM (csc.start_time - a.shift_start_time)))
            )
          ELSE 0
        END ASC,
        csc.display_order ASC
      LIMIT 1
    ) matched_csc ON true
  ),
  matched_logs AS (
    SELECT r.operator_id,
           r.machine_id,
           l.id AS log_id,
           l.entered_by,
           l.entry_source,
           l.log_date,
           l.start_meter,
           l.end_meter,
           l.running_hours,
           l.remarks,
           l.shift_code AS log_shift_code,
           l.operator_id AS log_operator_id,
           l.site_id AS log_site_id,
           ROW_NUMBER() OVER (
             PARTITION BY r.machine_id, COALESCE(r.operator_id, '00000000-0000-0000-0000-000000000000'::uuid)
             ORDER BY
               CASE WHEN l.assignment_id = r.assignment_id THEN 0
                    WHEN l.shift_code = r.shift_code OR l.shift ILIKE '%' || r.shift_code || '%' THEN 1
                    ELSE 2 END,
               l.created_at DESC
           ) AS match_rank
    FROM roster r
    CROSS JOIN target_date td
    INNER JOIN public.machine_hour_logs l
      ON l.machine_id = r.machine_id
     AND l.log_date = td.d
     AND (
       (r.assignment_id IS NOT NULL AND l.assignment_id = r.assignment_id)
       OR (r.operator_id IS NOT NULL AND l.operator_id = r.operator_id)
       OR (r.operator_id IS NULL)
     )
  ),
  latest_machine_logs AS (
    SELECT DISTINCT ON (l.machine_id)
           l.machine_id,
           l.start_meter,
           l.end_meter
    FROM public.machine_hour_logs l
    CROSS JOIN target_date td
    WHERE l.machine_id IN (SELECT DISTINCT machine_id FROM combined_roster_sources)
    ORDER BY l.machine_id,
             CASE WHEN l.log_date <= td.d THEN 0 ELSE 1 END ASC,
             l.log_date DESC,
             l.created_at DESC
  ),
  roster_results AS (
    SELECT r.operator_id,
           COALESCE(u.full_name, log_op.full_name, 'Unassigned') AS operator_name,
           COALESCE(u.phone, log_op.phone) AS operator_phone,
           COALESCE(u.employee_id, log_op.employee_id) AS operator_employee_id,
           r.machine_id,
           r.machine_code,
           r.serial_number AS machine_serial_number,
           r.model AS machine_model,
           r.client_id,
           COALESCE(cl.client_id, cl.code) AS client_code,
           COALESCE(cl.company_name, 'Available / Unassigned') AS client_name,
           COALESCE(cs.city, cl.city, r.machine_city) AS client_city,
           COALESCE(cs.site_name, cs.city, cl.city, r.machine_city) AS site_name,
           r.current_meter,
           COALESCE(ml.log_shift_code, r.shift_code, 'S1') AS shift_code,
           r.shift_name,
           r.shift_start,
           r.shift_end,
           CASE
             WHEN ml.log_id IS NOT NULL THEN 'entered'
             WHEN r.operator_id IS NULL THEN 'unassigned'
             ELSE 'pending'
           END AS status,
           ml.log_id,
           ml.entered_by,
           eu.full_name AS entered_by_name,
           ml.entry_source,
           ml.log_date,
           COALESCE(ml.start_meter, lml.start_meter) AS start_meter,
           COALESCE(ml.end_meter, lml.end_meter, r.current_meter) AS end_meter,
           ml.running_hours,
           ml.remarks,
           r.machine_status,
           r.machine_health_status
    FROM roster r
    LEFT JOIN matched_logs ml
      ON ml.machine_id = r.machine_id
     AND (
       (r.operator_id IS NOT NULL AND ml.operator_id = r.operator_id)
       OR (r.operator_id IS NULL)
     )
     AND ml.match_rank = 1
    LEFT JOIN latest_machine_logs lml
      ON lml.machine_id = r.machine_id
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
  ORDER BY
    CASE
      WHEN log_id IS NOT NULL THEN 3
      WHEN machine_health_status IN ('breakdown', 'under_maintenance') THEN 0
      WHEN operator_id IS NULL THEN 1
      ELSE 2
    END,
    machine_code,
    shift_code;
$function$;

-- ============================================================
-- 3. get_today_shift_log_monitor_paginated
-- ============================================================
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
  v_shift_options jsonb;
  v_client_options jsonb;
  v_offset int;
  v_safe_page int;
  v_safe_page_size int;
  v_target_date date;
BEGIN
  v_target_date := COALESCE(p_log_date, (NOW() AT TIME ZONE 'Asia/Kolkata')::date);
  v_safe_page := GREATEST(1, COALESCE(p_page, 1));
  v_safe_page_size := GREATEST(1, LEAST(100, COALESCE(p_page_size, 12)));
  v_offset := (v_safe_page - 1) * v_safe_page_size;

  -- 1. Compute summary counts over all matching records for the day
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
      AND (
        oma.valid_to IS NULL
        OR oma.valid_from < oma.valid_to
        OR EXISTS (
          SELECT 1 FROM public.machine_hour_logs mhl
          WHERE mhl.assignment_id = oma.id AND mhl.log_date = v_target_date
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
          AND (
            oma.valid_to IS NULL
            OR oma.valid_from < oma.valid_to
            OR EXISTS (
              SELECT 1 FROM public.machine_hour_logs mhl
              WHERE mhl.assignment_id = oma.id AND mhl.log_date = v_target_date
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
             ORDER BY
               CASE WHEN l.assignment_id = r.assignment_id THEN 0 ELSE 1 END,
               l.created_at DESC
           ) as rn
    FROM combined_roster r
    LEFT JOIN public.machine_hour_logs l
      ON (
        (r.assignment_id IS NOT NULL AND l.assignment_id = r.assignment_id)
        OR (l.machine_id = r.machine_id AND (
          (r.operator_id IS NOT NULL AND l.operator_id = r.operator_id)
          OR (r.operator_id IS NULL AND l.log_date = v_target_date)
        ))
      )
      AND l.log_date = v_target_date
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
$function$;

-- ============================================================
-- 4. get_operator_entry_context (IST-aware + date range + assignment_id)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_operator_entry_context(p_operator_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_today_ist date;
  v_operator_id uuid;
  v_op_id uuid;
  v_op_name text;
  v_op_role text;
  v_op_shift_start time;
  v_op_shift_end time;

  v_assignment_id uuid;
  v_assigned_machine_id uuid;
  v_oma_shift_start time;
  v_oma_shift_end time;
  v_oma_shift_code text;
  v_assigned_shift_codes jsonb := '[]'::jsonb;

  v_m_id uuid;
  v_m_code text;
  v_m_model text;
  v_m_serial text;
  v_m_hmr numeric;
  v_m_client_id uuid;

  v_c_id uuid;
  v_c_name text;
  v_c_site text;

  v_last_hmr numeric;
  v_last_log jsonb;
  v_shift_codes jsonb := '[]'::jsonb;
  v_today_logged_shift_codes text[] := '{}'::text[];
  v_today_logs jsonb := '[]'::jsonb;
BEGIN
  v_today_ist   := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
  v_operator_id := COALESCE(p_operator_id, auth.uid());

  IF v_operator_id IS NULL THEN
    RETURN jsonb_build_object(
      'operator', NULL,
      'machine', NULL,
      'client', NULL,
      'last_hmr', 0,
      'last_log', NULL,
      'shift_codes', '[]'::jsonb,
      'assignment_id', NULL,
      'assigned_shift_code', NULL,
      'assigned_shift_codes', '[]'::jsonb,
      'today_logged_shift_codes', '[]'::jsonb,
      'today_logs', '[]'::jsonb
    );
  END IF;

  SELECT u.id, u.full_name, u.role, u.shift_start_time, u.shift_end_time
  INTO v_op_id, v_op_name, v_op_role, v_op_shift_start, v_op_shift_end
  FROM public.users u
  WHERE u.id = v_operator_id;

  IF v_op_id IS NULL THEN
    RETURN jsonb_build_object(
      'operator', NULL,
      'machine', NULL,
      'client', NULL,
      'last_hmr', 0,
      'last_log', NULL,
      'shift_codes', '[]'::jsonb,
      'assignment_id', NULL,
      'assigned_shift_code', NULL,
      'assigned_shift_codes', '[]'::jsonb,
      'today_logged_shift_codes', '[]'::jsonb,
      'today_logs', '[]'::jsonb
    );
  END IF;

  -- 1. Resolve active assignment for TODAY IST via valid_from / valid_to ranges
  SELECT oma.id, oma.machine_id, oma.shift_start_time, oma.shift_end_time, oma.shift_code
  INTO v_assignment_id, v_assigned_machine_id, v_oma_shift_start, v_oma_shift_end, v_oma_shift_code
  FROM public.operator_machine_assignments oma
  WHERE oma.operator_id = v_operator_id
    AND oma.valid_from <= v_today_ist
    AND (oma.valid_to IS NULL OR oma.valid_to >= v_today_ist)
  ORDER BY oma.valid_from DESC
  LIMIT 1;

  IF v_assigned_machine_id IS NOT NULL THEN
    IF v_oma_shift_start IS NOT NULL THEN
      v_op_shift_start := v_oma_shift_start;
    END IF;
    IF v_oma_shift_end IS NOT NULL THEN
      v_op_shift_end := v_oma_shift_end;
    END IF;

    SELECT COALESCE(jsonb_agg(DISTINCT oma.shift_code) FILTER (WHERE oma.shift_code IS NOT NULL), '[]'::jsonb)
    INTO v_assigned_shift_codes
    FROM public.operator_machine_assignments oma
    WHERE oma.operator_id = v_operator_id
      AND oma.machine_id = v_assigned_machine_id
      AND oma.valid_from <= v_today_ist
      AND (oma.valid_to IS NULL OR oma.valid_to >= v_today_ist);
  ELSE
    SELECT m.id
    INTO v_assigned_machine_id
    FROM public.machines m
    WHERE m.current_operator_id = v_operator_id
       OR v_operator_id = ANY(m.operator_ids)
    ORDER BY m.updated_at DESC
    LIMIT 1;
  END IF;

  IF v_assigned_machine_id IS NOT NULL THEN
    SELECT m.id, m.machine_id, m.model, m.serial_number, m.hour_meter, m.client_id
    INTO v_m_id, v_m_code, v_m_model, v_m_serial, v_m_hmr, v_m_client_id
    FROM public.machines m
    WHERE m.id = v_assigned_machine_id;

    IF v_m_client_id IS NULL THEN
      SELECT mhl.client_id
      INTO v_m_client_id
      FROM public.machine_hour_logs mhl
      WHERE mhl.machine_id = v_assigned_machine_id AND mhl.client_id IS NOT NULL
      ORDER BY mhl.log_date DESC, mhl.created_at DESC
      LIMIT 1;
    END IF;

    IF v_m_client_id IS NOT NULL THEN
      SELECT c.id, c.company_name,
             COALESCE(
               NULLIF(TRIM(CONCAT_WS(', ',
                 NULLIF(c.street, ''),
                 NULLIF(c.city, ''),
                 NULLIF(c.district, ''),
                 NULLIF(c.state, '')
               )), ''),
               'Base Yard'
             )
      INTO v_c_id, v_c_name, v_c_site
      FROM public.clients c
      WHERE c.id = v_m_client_id;

      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', sc.id,
            'client_id', sc.client_id,
            'code', sc.code,
            'name', sc.name,
            'start_time', to_char(sc.start_time, 'HH12:MI AM'),
            'end_time', to_char(sc.end_time, 'HH12:MI AM'),
            'raw_start_time', sc.start_time::text,
            'raw_end_time', sc.end_time::text,
            'crosses_midnight', sc.crosses_midnight,
            'scheduled_minutes', sc.scheduled_minutes,
            'normal_minutes', sc.normal_minutes,
            'default_ot_minutes', sc.scheduled_minutes - sc.normal_minutes
          ) ORDER BY sc.display_order ASC, sc.code ASC
        ),
        '[]'::jsonb
      )
      INTO v_shift_codes
      FROM public.client_shift_codes sc
      WHERE sc.client_id = v_m_client_id AND sc.is_active = true;
    END IF;

    IF (v_oma_shift_code IS NULL OR TRIM(v_oma_shift_code) = '') AND v_m_client_id IS NOT NULL AND v_op_shift_start IS NOT NULL THEN
      SELECT sc.code
      INTO v_oma_shift_code
      FROM public.client_shift_codes sc
      WHERE sc.client_id = v_m_client_id AND sc.is_active = true
      ORDER BY (sc.start_time = v_op_shift_start) DESC,
               ABS(EXTRACT(EPOCH FROM (sc.start_time - v_op_shift_start))) ASC,
               sc.display_order ASC
      LIMIT 1;
    END IF;

    SELECT jsonb_build_object(
      'id', mhl.id,
      'log_date', mhl.log_date,
      'start_meter', COALESCE(mhl.start_meter, 0),
      'end_meter', COALESCE(mhl.end_meter, 0),
      'start_time', mhl.start_time,
      'end_time', mhl.end_time,
      'running_hours', COALESCE(mhl.running_hours, GREATEST(0, ROUND((mhl.end_meter - mhl.start_meter) * 10) / 10)),
      'normal_working_hours', COALESCE(mhl.normal_working_hours, 8),
      'overtime_hours', COALESCE(mhl.overtime_hours, 0),
      'shift', mhl.shift,
      'shift_code', mhl.shift_code,
      'is_breakdown', COALESCE(mhl.is_breakdown, false),
      'breakdown_duration', mhl.breakdown_duration,
      'operator_id', mhl.operator_id,
      'operator_name', COALESCE(u.full_name, 'Operator'),
      'entered_by', mhl.entered_by,
      'entered_by_name', COALESCE(u_entered.full_name, u.full_name, 'Operator'),
      'entry_source', COALESCE(mhl.entry_source, 'operator')
    ), mhl.end_meter
    INTO v_last_log, v_last_hmr
    FROM public.machine_hour_logs mhl
    LEFT JOIN public.users u ON u.id = mhl.operator_id
    LEFT JOIN public.users u_entered ON u_entered.id = mhl.entered_by
    WHERE mhl.machine_id = v_assigned_machine_id
      AND mhl.end_meter IS NOT NULL
    ORDER BY mhl.log_date DESC, mhl.created_at DESC
    LIMIT 1;

    IF v_last_hmr IS NULL THEN
      v_last_hmr := COALESCE(v_m_hmr, 0);
    END IF;

    -- Today's logged shifts (using IST date)
    SELECT
      COALESCE(array_agg(mhl.shift_code) FILTER (WHERE mhl.shift_code IS NOT NULL), '{}'::text[]),
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', mhl.id,
            'shift_code', mhl.shift_code,
            'start_meter', mhl.start_meter,
            'end_meter', mhl.end_meter,
            'running_hours', mhl.running_hours,
            'start_time', mhl.start_time,
            'end_time', mhl.end_time,
            'is_breakdown', mhl.is_breakdown
          ) ORDER BY mhl.start_time ASC
        ),
        '[]'::jsonb
      )
    INTO v_today_logged_shift_codes, v_today_logs
    FROM public.machine_hour_logs mhl
    WHERE mhl.operator_id = v_operator_id
      AND mhl.machine_id = v_assigned_machine_id
      AND mhl.log_date = v_today_ist;
  END IF;

  IF (v_oma_shift_code IS NULL OR TRIM(v_oma_shift_code) = '') AND v_op_shift_start IS NOT NULL THEN
    IF v_op_shift_start >= '04:00:00'::time AND v_op_shift_start < '11:00:00'::time THEN
      v_oma_shift_code := 'S1';
    ELSIF v_op_shift_start >= '11:00:00'::time AND v_op_shift_start < '17:00:00'::time THEN
      v_oma_shift_code := 'S2';
    ELSE
      v_oma_shift_code := 'S3';
    END IF;
  END IF;

  IF v_shift_codes IS NULL OR jsonb_array_length(v_shift_codes) = 0 THEN
    v_shift_codes := '[
      {"code": "S1", "name": "Shift S1 (Morning)", "start_time": "06:00 AM", "end_time": "02:00 PM", "raw_start_time": "06:00:00", "raw_end_time": "14:00:00", "crosses_midnight": false, "scheduled_minutes": 480, "normal_minutes": 480, "default_ot_minutes": 0},
      {"code": "S2", "name": "Shift S2 (Evening)", "start_time": "02:00 PM", "end_time": "10:00 PM", "raw_start_time": "14:00:00", "raw_end_time": "22:00:00", "crosses_midnight": false, "scheduled_minutes": 480, "normal_minutes": 480, "default_ot_minutes": 0},
      {"code": "S3", "name": "Shift S3 (Night)", "start_time": "10:00 PM", "end_time": "06:00 AM", "raw_start_time": "22:00:00", "raw_end_time": "06:00:00", "crosses_midnight": true, "scheduled_minutes": 480, "normal_minutes": 480, "default_ot_minutes": 0}
    ]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'assignment_id', v_assignment_id,
    'operator', jsonb_build_object(
      'id', v_op_id,
      'name', v_op_name,
      'role', v_op_role,
      'shift_code', v_oma_shift_code,
      'shift_start', COALESCE(to_char(v_op_shift_start, 'HH12:MI AM'), '06:00 AM'),
      'shift_end', COALESCE(to_char(v_op_shift_end, 'HH12:MI AM'), '02:00 PM'),
      'raw_shift_start', COALESCE(v_op_shift_start::text, '06:00:00'),
      'raw_shift_end', COALESCE(v_op_shift_end::text, '14:00:00')
    ),
    'machine', CASE WHEN v_m_id IS NOT NULL THEN jsonb_build_object(
      'id', v_m_id,
      'machine_id', COALESCE(v_m_code, v_m_id::text),
      'model', v_m_model,
      'serial_number', v_m_serial
    ) ELSE NULL END,
    'client', CASE WHEN v_c_id IS NOT NULL THEN jsonb_build_object(
      'id', v_c_id,
      'company_name', v_c_name,
      'site', COALESCE(v_c_site, 'Base Yard')
    ) ELSE NULL END,
    'last_hmr', COALESCE(v_last_hmr, 0),
    'last_log', v_last_log,
    'shift_codes', v_shift_codes,
    'assigned_shift_code', v_oma_shift_code,
    'assigned_shift_codes', v_assigned_shift_codes,
    'today_logged_shift_codes', to_jsonb(v_today_logged_shift_codes),
    'today_logs', v_today_logs
  );
END;
$function$;
