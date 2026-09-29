-- ==============================================================================
-- Migration 126: Include Unassigned Machines in Today's Shift Monitor & Support 1-Click Assignment
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
-- Description:
-- 1. Updates get_today_shift_log_monitor() to include active/rented machines that do
--    not currently have active operator assignments for the target supervisor or fleet.
-- 2. Marks them with status = 'unassigned', operator_name = 'Unassigned', and operator_id = NULL.
-- 3. Orders unassigned and pending shifts first so supervisors can immediately identify
--    unassigned equipment and 1-click assign operators.
-- ==============================================================================

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
           COALESCE(a.oma_shift_code, csc.code) AS shift_code,
           COALESCE(csc.start_time, a.shift_start_time) AS shift_start,
           COALESCE(csc.end_time, a.shift_end_time) AS shift_end
    FROM combined_roster_sources a
    LEFT JOIN public.client_shift_codes csc
      ON csc.client_id = a.client_id
     AND csc.is_active = true
     AND (
       (a.oma_shift_code IS NOT NULL AND csc.code = a.oma_shift_code)
       OR (a.oma_shift_code IS NULL AND csc.start_time = a.shift_start_time AND csc.end_time = a.shift_end_time)
     )
  )
  SELECT r.operator_id,
         COALESCE(u.full_name, 'Unassigned') AS operator_name,
         u.phone AS operator_phone,
         r.machine_id,
         r.machine_code,
         r.serial_number AS machine_serial_number,
         r.model AS machine_model,
         r.client_id,
         COALESCE(cl.client_id, cl.code) AS client_code,
         COALESCE(cl.company_name, 'Available / Unassigned') AS client_name,
         r.current_meter,
         COALESCE(r.shift_code, 'S1') AS shift_code,
         r.shift_start,
         r.shift_end,
         CASE
           WHEN r.operator_id IS NULL THEN 'unassigned'
           WHEN l.id IS NULL THEN 'pending'
           ELSE 'entered'
         END AS status,
         l.id AS log_id,
         l.entered_by,
         eu.full_name AS entered_by_name,
         l.entry_source,
         l.log_date,
         l.start_meter,
         l.end_meter,
         l.running_hours,
         l.remarks
  FROM roster r
  LEFT JOIN public.users u ON u.id = r.operator_id
  LEFT JOIN public.clients cl ON cl.id = r.client_id
  LEFT JOIN public.machine_hour_logs l
    ON l.machine_id = r.machine_id
   AND l.operator_id = r.operator_id
   AND l.shift_code = r.shift_code
   AND l.log_date = p_log_date
  LEFT JOIN public.users eu ON eu.id = l.entered_by
  WHERE (p_search IS NULL OR p_search = '' OR (
     COALESCE(u.full_name, '') ILIKE '%' || p_search || '%'
     OR COALESCE(u.phone, '') ILIKE '%' || p_search || '%'
     OR r.machine_code ILIKE '%' || p_search || '%'
     OR COALESCE(r.serial_number, '') ILIKE '%' || p_search || '%'
     OR COALESCE(r.model, '') ILIKE '%' || p_search || '%'
     OR COALESCE(cl.company_name, '') ILIKE '%' || p_search || '%'
     OR COALESCE(cl.client_id, '') ILIKE '%' || p_search || '%'
     OR COALESCE(cl.code, '') ILIKE '%' || p_search || '%'
  ))
  ORDER BY
    CASE
      WHEN r.operator_id IS NULL THEN 1
      WHEN l.id IS NULL THEN 2
      ELSE 3
    END ASC,
    r.shift_start ASC NULLS LAST,
    r.machine_code ASC,
    u.full_name ASC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.get_today_shift_log_monitor(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_today_shift_log_monitor(uuid, date, text) TO authenticated, service_role;
