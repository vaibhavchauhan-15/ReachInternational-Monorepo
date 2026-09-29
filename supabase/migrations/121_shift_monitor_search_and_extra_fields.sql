-- Migration 121: Shift Monitor Search and Extra Fields
-- Drops and recreates get_today_shift_log_monitor to add a search parameter and new output columns:
-- operator_phone, machine_serial_number, machine_model.

DROP FUNCTION IF EXISTS public.get_today_shift_log_monitor(uuid, date);

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
      )
  ),
  roster AS (
    SELECT a.*,
           csc.code AS shift_code,
           csc.start_time AS shift_start,
           csc.end_time AS shift_end
    FROM active_assignments a
    JOIN public.client_shift_codes csc
      ON csc.client_id = a.client_id
     AND csc.is_active = true
     AND csc.start_time = a.shift_start_time
     AND csc.end_time = a.shift_end_time
  )
  SELECT r.operator_id, u.full_name AS operator_name,
         u.phone AS operator_phone,
         r.machine_id, r.machine_code,
         r.serial_number AS machine_serial_number,
         r.model AS machine_model,
         r.client_id, cl.company_name AS client_name,
         r.current_meter,
         r.shift_code, r.shift_start, r.shift_end,
         CASE WHEN l.id IS NULL THEN 'pending' ELSE 'entered' END AS status,
         l.id AS log_id, l.entered_by, eu.full_name AS entered_by_name, l.entry_source,
         l.log_date, l.start_meter, l.end_meter, l.running_hours, l.remarks
  FROM roster r
  JOIN public.users u ON u.id = r.operator_id
  JOIN public.clients cl ON cl.id = r.client_id
  LEFT JOIN public.machine_hour_logs l
    ON l.machine_id = r.machine_id AND l.operator_id = r.operator_id
   AND l.shift_code = r.shift_code AND l.log_date = p_log_date
  LEFT JOIN public.users eu ON eu.id = l.entered_by
  WHERE (p_search IS NULL OR p_search = '' OR (
     u.full_name ILIKE '%' || p_search || '%'
     OR u.phone ILIKE '%' || p_search || '%'
     OR r.machine_code ILIKE '%' || p_search || '%'
     OR COALESCE(r.serial_number, '') ILIKE '%' || p_search || '%'
     OR COALESCE(r.model, '') ILIKE '%' || p_search || '%'
     OR cl.company_name ILIKE '%' || p_search || '%'
  ))
  ORDER BY CASE WHEN l.id IS NULL THEN 0 ELSE 1 END, u.full_name, r.shift_code;
$$;

GRANT EXECUTE ON FUNCTION public.get_today_shift_log_monitor(uuid, date, text) TO authenticated;
