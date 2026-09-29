-- ==============================================================================
-- Migration 131: Client Created Shift Resolution & Name Projection in Today's Monitor
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
-- Description:
-- 1. Upgrades get_today_shift_log_monitor RPC:
--    a. Uses lateral join on public.client_shift_codes to deterministically match
--       and project the client's actual shift code, shift name, start_time, and end_time.
--    b. Preserves exact client shift codes ('A', 'B', 'C', 'S1', etc.) instead of
--       falling back blindly to hardcoded 'S1'.
--    c. Projects shift_name (e.g. 'Shift A (Morning)', 'Shift B (Evening)', 'Shift C (Night)').
--    d. Aligns shift timings with client shift code definitions.
-- ==============================================================================

DROP FUNCTION IF EXISTS public.get_today_shift_log_monitor(uuid, date, text);

CREATE OR REPLACE FUNCTION public.get_today_shift_log_monitor(
  p_actor_id uuid,
  p_log_date date DEFAULT CURRENT_DATE,
  p_search text DEFAULT NULL
) RETURNS TABLE (
  operator_id uuid,
  operator_name text,
  operator_phone text,
  machine_id uuid,
  machine_code text,
  machine_serial_number text,
  machine_model text,
  client_id uuid,
  client_code text,
  client_name text,
  current_meter numeric,
  shift_code text,
  shift_name text,
  shift_start time,
  shift_end time,
  status text,
  log_id uuid,
  entered_by uuid,
  entered_by_name text,
  entry_source text,
  log_date date,
  start_meter numeric,
  end_meter numeric,
  running_hours numeric,
  remarks text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
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
           m.hour_meter AS current_meter
    FROM public.operator_machine_assignments oma
    JOIN public.machines m ON m.id = oma.machine_id
    WHERE oma.is_active = true
      AND m.status IN ('active', 'rented')
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
           m.hour_meter AS current_meter
    FROM public.machines m
    WHERE m.status IN ('active', 'rented')
      AND NOT EXISTS (
        SELECT 1 FROM public.operator_machine_assignments oma
        WHERE oma.machine_id = m.id AND oma.is_active = true
      )
      AND (
        (SELECT role FROM actor_info) IN ('super_admin', 'admin', 'manager')
        OR m.current_supervisor_id = p_actor_id
        OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
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
           ROW_NUMBER() OVER (
             PARTITION BY r.machine_id, COALESCE(r.operator_id, '00000000-0000-0000-0000-000000000000'::uuid)
             ORDER BY
               CASE WHEN l.shift_code = r.shift_code OR l.shift ILIKE '%' || r.shift_code || '%' THEN 0 ELSE 1 END,
               l.created_at DESC
           ) AS match_rank
    FROM roster r
    INNER JOIN public.machine_hour_logs l
      ON l.machine_id = r.machine_id
     AND l.log_date = p_log_date
     AND (
       (r.operator_id IS NOT NULL AND l.operator_id = r.operator_id)
       OR (r.operator_id IS NULL)
     )
  )
  SELECT r.operator_id,
         COALESCE(u.full_name, log_op.full_name, 'Unassigned') AS operator_name,
         COALESCE(u.phone, log_op.phone) AS operator_phone,
         r.machine_id,
         r.machine_code,
         r.serial_number AS machine_serial_number,
         r.model AS machine_model,
         r.client_id,
         COALESCE(cl.client_id, cl.code) AS client_code,
         COALESCE(cl.company_name, 'Available / Unassigned') AS client_name,
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
         ml.start_meter,
         ml.end_meter,
         ml.running_hours,
         ml.remarks
  FROM roster r
  LEFT JOIN matched_logs ml
    ON ml.machine_id = r.machine_id
   AND (
     (r.operator_id IS NOT NULL AND ml.operator_id = r.operator_id)
     OR (r.operator_id IS NULL AND ml.operator_id IS NULL)
   )
   AND ml.match_rank = 1
  LEFT JOIN public.users u ON u.id = r.operator_id
  LEFT JOIN public.users log_op ON log_op.id = ml.log_operator_id
  LEFT JOIN public.clients cl ON cl.id = r.client_id
  LEFT JOIN public.users eu ON eu.id = ml.entered_by
  WHERE (p_search IS NULL OR p_search = '' OR (
     COALESCE(u.full_name, log_op.full_name, '') ILIKE '%' || p_search || '%'
     OR COALESCE(u.phone, log_op.phone, '') ILIKE '%' || p_search || '%'
     OR r.machine_code ILIKE '%' || p_search || '%'
     OR COALESCE(r.serial_number, '') ILIKE '%' || p_search || '%'
     OR COALESCE(r.model, '') ILIKE '%' || p_search || '%'
     OR COALESCE(cl.company_name, '') ILIKE '%' || p_search || '%'
     OR COALESCE(cl.client_id, cl.code, '') ILIKE '%' || p_search || '%'
  ))
  ORDER BY
    CASE
      WHEN ml.log_id IS NOT NULL THEN 2
      WHEN r.operator_id IS NULL THEN 0
      ELSE 1
    END,
    r.machine_code,
    r.shift_code;
$$;

GRANT EXECUTE ON FUNCTION public.get_today_shift_log_monitor(uuid, date, text) TO authenticated, service_role;
