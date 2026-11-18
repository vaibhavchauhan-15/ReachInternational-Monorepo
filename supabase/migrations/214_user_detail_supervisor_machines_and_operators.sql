-- Migration 205: User Detail Supervisor Machines and Operators RPC Optimization
-- Supports role-aware user detail views across Web and Native Mobile:
-- 1. get_user_assigned_machines: Returns all machines directly or indirectly under a user/supervisor/operator
-- 2. get_supervisor_operators: Returns all operators reporting to a supervisor with active machine assignments
-- 3. get_user_summary_kpis: Role-aware KPI metrics (Fleet, Operators, Shifts, Documents for supervisor; Fleet, Running Hours, Work Days, Documents for operator)

-- 1. Function: public.get_user_assigned_machines
CREATE OR REPLACE FUNCTION public.get_user_assigned_machines(
  target_user_id UUID,
  user_role TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  machine_id TEXT,
  machine_name TEXT,
  model TEXT,
  status TEXT,
  serial_number TEXT,
  manufacturer TEXT,
  year_of_mfg INTEGER,
  hour_meter NUMERIC,
  assigned_operator_name TEXT,
  assigned_operator_code TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := user_role;
BEGIN
  IF v_role IS NULL THEN
    SELECT users.role INTO v_role FROM public.users WHERE users.id = target_user_id;
  END IF;

  IF v_role = 'supervisor' THEN
    RETURN QUERY
    WITH sup_operators AS (
      SELECT DISTINCT u.id
      FROM public.users u
      LEFT JOIN public.user_supervisors us ON us.user_id = u.id
      WHERE (u.supervisor_id = target_user_id OR us.supervisor_id = target_user_id)
        AND u.role = 'operator'
    ),
    operator_machines AS (
      SELECT oma.machine_id
      FROM public.operator_machine_assignments oma
      WHERE oma.operator_id IN (SELECT sup_operators.id FROM sup_operators)
        AND oma.is_active = true
        AND oma.valid_from <= CURRENT_DATE
        AND (oma.valid_to IS NULL OR oma.valid_to >= CURRENT_DATE)
      UNION
      SELECT m.id
      FROM public.machines m
      WHERE m.current_operator_id IN (SELECT sup_operators.id FROM sup_operators)
         OR m.operator_ids && ARRAY(SELECT sup_operators.id FROM sup_operators)
    )
    SELECT DISTINCT ON (m.id)
      m.id,
      m.machine_id,
      m.machine_name,
      m.model,
      m.status,
      m.serial_number,
      m.manufacturer,
      m.year_of_mfg,
      m.hour_meter,
      COALESCE(u.full_name, op_assigned.full_name)::TEXT AS assigned_operator_name,
      COALESCE(u.employee_id, op_assigned.employee_id)::TEXT AS assigned_operator_code
    FROM public.machines m
    LEFT JOIN public.users u ON u.id = m.current_operator_id
    LEFT JOIN LATERAL (
      SELECT u2.full_name, u2.employee_id
      FROM public.operator_machine_assignments oma2
      JOIN public.users u2 ON u2.id = oma2.operator_id
      WHERE oma2.machine_id = m.id
        AND oma2.is_active = true
        AND oma2.valid_from <= CURRENT_DATE
        AND (oma2.valid_to IS NULL OR oma2.valid_to >= CURRENT_DATE)
      ORDER BY oma2.assigned_at DESC
      LIMIT 1
    ) op_assigned ON true
    WHERE m.current_supervisor_id = target_user_id
       OR target_user_id = ANY(m.supervisor_ids)
       OR m.id IN (SELECT operator_machines.machine_id FROM operator_machines)
    ORDER BY m.id, m.machine_id;
  ELSE
    -- Operator or standard user view
    RETURN QUERY
    WITH active_assignments AS (
      SELECT oma.machine_id
      FROM public.operator_machine_assignments oma
      WHERE oma.operator_id = target_user_id
        AND oma.is_active = true
        AND oma.valid_from <= CURRENT_DATE
        AND (oma.valid_to IS NULL OR oma.valid_to >= CURRENT_DATE)
    )
    SELECT DISTINCT ON (m.id)
      m.id,
      m.machine_id,
      m.machine_name,
      m.model,
      m.status,
      m.serial_number,
      m.manufacturer,
      m.year_of_mfg,
      m.hour_meter,
      NULL::TEXT AS assigned_operator_name,
      NULL::TEXT AS assigned_operator_code
    FROM public.machines m
    WHERE m.current_operator_id = target_user_id
       OR target_user_id = ANY(m.operator_ids)
       OR m.current_supervisor_id = target_user_id
       OR target_user_id = ANY(m.supervisor_ids)
       OR m.id IN (SELECT active_assignments.machine_id FROM active_assignments)
    ORDER BY m.id, m.machine_id;
  END IF;
END;
$$;

-- 2. Function: public.get_supervisor_operators
CREATE OR REPLACE FUNCTION public.get_supervisor_operators(
  target_supervisor_id UUID
)
RETURNS TABLE (
  id UUID,
  employee_id TEXT,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  role TEXT,
  status TEXT,
  machine_category TEXT,
  city TEXT,
  state TEXT,
  shift_start_time TIME,
  shift_end_time TIME,
  doj DATE,
  created_at TIMESTAMPTZ,
  active_machine_id UUID,
  active_machine_code TEXT,
  active_machine_name TEXT,
  active_machine_model TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH sup_operators AS (
    SELECT DISTINCT u.id
    FROM public.users u
    LEFT JOIN public.user_supervisors us ON us.user_id = u.id
    WHERE (u.supervisor_id = target_supervisor_id OR us.supervisor_id = target_supervisor_id)
      AND u.role = 'operator'
  ),
  active_assignments AS (
    SELECT DISTINCT ON (oma.operator_id)
      oma.operator_id,
      m.id AS machine_id,
      m.machine_id AS machine_code,
      m.machine_name,
      m.model AS machine_model
    FROM public.operator_machine_assignments oma
    JOIN public.machines m ON m.id = oma.machine_id
    WHERE oma.operator_id IN (SELECT sup_operators.id FROM sup_operators)
      AND oma.is_active = true
      AND oma.valid_from <= CURRENT_DATE
      AND (oma.valid_to IS NULL OR oma.valid_to >= CURRENT_DATE)
    ORDER BY oma.operator_id, oma.assigned_at DESC
  )
  SELECT DISTINCT ON (u.id)
    u.id,
    u.employee_id,
    u.full_name,
    u.email,
    u.phone,
    u.role,
    u.status,
    u.machine_category,
    u.city,
    u.state,
    u.shift_start_time,
    u.shift_end_time,
    u.doj,
    u.created_at,
    COALESCE(aa.machine_id, dm.id) AS active_machine_id,
    COALESCE(aa.machine_code, dm.machine_id) AS active_machine_code,
    COALESCE(aa.machine_name, dm.machine_name) AS active_machine_name,
    COALESCE(aa.machine_model, dm.model) AS active_machine_model
  FROM public.users u
  JOIN sup_operators so ON so.id = u.id
  LEFT JOIN active_assignments aa ON aa.operator_id = u.id
  LEFT JOIN public.machines dm ON (dm.current_operator_id = u.id OR u.id = ANY(dm.operator_ids))
  ORDER BY u.id, u.full_name;
END;
$$;

-- 3. Function: public.get_user_summary_kpis
CREATE OR REPLACE FUNCTION public.get_user_summary_kpis(
  target_user_id UUID,
  user_role TEXT DEFAULT NULL
)
RETURNS TABLE (
  assigned_machines_count BIGINT,
  total_running_hours NUMERIC,
  total_days_worked BIGINT,
  documents_count BIGINT,
  supervised_operators_count BIGINT,
  supervised_shifts_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role TEXT := user_role;
  v_machines_count BIGINT := 0;
  v_running_hours NUMERIC := 0;
  v_days_worked BIGINT := 0;
  v_docs_count BIGINT := 0;
  v_operators_count BIGINT := 0;
  v_shifts_count BIGINT := 0;
BEGIN
  IF v_role IS NULL THEN
    SELECT users.role INTO v_role FROM public.users WHERE users.id = target_user_id;
  END IF;

  -- 1. Documents count for this user
  SELECT count(*) INTO v_docs_count
  FROM public.user_documents
  WHERE user_documents.user_id = target_user_id;

  IF v_role = 'supervisor' THEN
    -- A. Supervised operators count
    SELECT count(DISTINCT u.id) INTO v_operators_count
    FROM public.users u
    LEFT JOIN public.user_supervisors us ON us.user_id = u.id
    WHERE (u.supervisor_id = target_user_id OR us.supervisor_id = target_user_id)
      AND u.role = 'operator';

    -- B. Machines count under supervisor
    SELECT count(*) INTO v_machines_count
    FROM public.get_user_assigned_machines(target_user_id, 'supervisor');

    -- C. Supervised shifts/logs count
    SELECT count(*) INTO v_shifts_count
    FROM public.machine_hour_logs mhl
    WHERE mhl.supervisor_id = target_user_id
       OR mhl.operator_id IN (
         SELECT DISTINCT u.id
         FROM public.users u
         LEFT JOIN public.user_supervisors us ON us.user_id = u.id
         WHERE (u.supervisor_id = target_user_id OR us.supervisor_id = target_user_id)
           AND u.role = 'operator'
       );

    RETURN QUERY SELECT
      v_machines_count,
      0::NUMERIC,
      0::BIGINT,
      v_docs_count,
      v_operators_count,
      v_shifts_count;
  ELSE
    -- Operator or other roles
    -- Machines count
    SELECT count(*) INTO v_machines_count
    FROM public.get_user_assigned_machines(target_user_id, v_role);

    -- Running hours & days worked
    SELECT
      COALESCE(SUM(running_hours), 0),
      count(DISTINCT log_date)
    INTO v_running_hours, v_days_worked
    FROM public.machine_hour_logs
    WHERE machine_hour_logs.operator_id = target_user_id;

    RETURN QUERY SELECT
      v_machines_count,
      ROUND(v_running_hours, 1),
      v_days_worked,
      v_docs_count,
      0::BIGINT,
      0::BIGINT;
  END IF;
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION public.get_user_assigned_machines TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_supervisor_operators TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_summary_kpis TO authenticated, service_role;
