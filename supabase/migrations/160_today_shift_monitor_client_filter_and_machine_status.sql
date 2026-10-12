-- ==============================================================================
-- Migration 160: Enhance Today Shift Monitor with Client Filter & Machine Health Status
-- Target Dev Project: vlmxciuogczumumrwyot
-- Description:
-- 1. Upgrades get_today_shift_log_monitor RPC:
--    - Returns machine_status and machine_health_status for all roster and extra log rows.
--    - Adds optional p_client_id parameter for server-side optimized client filtering.
--    - Extends unassigned_machines to include machines that are unassigned due to
--      maintenance or breakdown so supervisors and admins have full operational visibility.
-- 2. Introduces atomic public.activate_machine_for_assignment RPC allowing supervisors
--    and administrators to safely reactivate a machine from breakdown or maintenance
--    and proceed with operator assignment.
-- ==============================================================================

DROP FUNCTION IF EXISTS public.get_today_shift_log_monitor(uuid, date, text);
DROP FUNCTION IF EXISTS public.get_today_shift_log_monitor(uuid, date, text, uuid);

CREATE OR REPLACE FUNCTION public.get_today_shift_log_monitor(
  p_actor_id uuid,
  p_log_date date DEFAULT CURRENT_DATE,
  p_search text DEFAULT NULL,
  p_client_id uuid DEFAULT NULL
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
  remarks text,
  machine_status text,
  machine_health_status text
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
  ),
  roster_results AS (
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
    LEFT JOIN public.users u ON u.id = r.operator_id
    LEFT JOIN public.users log_op ON log_op.id = ml.log_operator_id
    LEFT JOIN public.clients cl ON cl.id = r.client_id
    LEFT JOIN public.users eu ON eu.id = ml.entered_by
  ),
  extra_entered_logs AS (
    SELECT l.operator_id,
           COALESCE(u.full_name, 'Unassigned') AS operator_name,
           u.phone AS operator_phone,
           l.machine_id,
           COALESCE(m.machine_id, 'M/C') AS machine_code,
           m.serial_number AS machine_serial_number,
           m.model AS machine_model,
           l.client_id,
           COALESCE(cl.client_id, cl.code) AS client_code,
           COALESCE(cl.company_name, 'Direct Client') AS client_name,
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
    LEFT JOIN public.users eu ON eu.id = l.entered_by
    WHERE l.log_date = p_log_date
      AND l.id NOT IN (SELECT log_id FROM roster_results WHERE log_id IS NOT NULL)
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
     OR machine_code ILIKE '%' || p_search || '%'
     OR COALESCE(machine_serial_number, '') ILIKE '%' || p_search || '%'
     OR COALESCE(machine_model, '') ILIKE '%' || p_search || '%'
     OR COALESCE(client_name, '') ILIKE '%' || p_search || '%'
     OR COALESCE(client_code, '') ILIKE '%' || p_search || '%'
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
$$;

GRANT EXECUTE ON FUNCTION public.get_today_shift_log_monitor(uuid, date, text, uuid) TO anon, authenticated, service_role;

-- 2. Atomic Machine Activation for Operator Assignment
CREATE OR REPLACE FUNCTION public.activate_machine_for_assignment(
  p_machine_id uuid,
  p_actor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id uuid;
  v_actor_role text;
  v_machine RECORD;
  v_new_status text;
BEGIN
  v_actor_id := COALESCE(p_actor_id, auth.uid());
  
  IF v_actor_id IS NOT NULL THEN
    SELECT role INTO v_actor_role FROM public.users WHERE id = v_actor_id;
    IF v_actor_role IS NOT NULL AND v_actor_role NOT IN ('super_admin', 'admin', 'manager', 'supervisor') THEN
      RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Only supervisors and administrators can activate machines.');
    END IF;
  END IF;

  SELECT id, machine_id, status, health_status, client_id
  INTO v_machine
  FROM public.machines
  WHERE id = p_machine_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Machine not found.');
  END IF;

  -- If machine has a client assigned, set to 'rented', else 'active'
  IF v_machine.client_id IS NOT NULL THEN
    v_new_status := 'rented';
  ELSE
    v_new_status := 'active';
  END IF;

  UPDATE public.machines
  SET health_status = 'active',
      status = CASE WHEN status = 'inactive' OR status = 'under_maintenance' THEN v_new_status ELSE status END,
      updated_at = NOW()
  WHERE id = p_machine_id;

  -- Insert audit log
  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    metadata,
    details,
    created_at
  )
  VALUES (
    v_actor_id,
    'machine.health_status_changed',
    'machine',
    p_machine_id,
    jsonb_build_object(
      'previous_health_status', v_machine.health_status,
      'new_health_status', 'active',
      'previous_status', v_machine.status,
      'new_status', CASE WHEN v_machine.status = 'inactive' OR v_machine.status = 'under_maintenance' THEN v_new_status ELSE v_machine.status END,
      'reason', 'activated_for_operator_assignment'
    ),
    jsonb_build_object(
      'machine_id', v_machine.machine_id,
      'activated_by', v_actor_id
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'machine_id', p_machine_id,
    'health_status', 'active',
    'status', CASE WHEN v_machine.status = 'inactive' OR v_machine.status = 'under_maintenance' THEN v_new_status ELSE v_machine.status END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_machine_for_assignment(uuid, uuid) TO authenticated, service_role;
