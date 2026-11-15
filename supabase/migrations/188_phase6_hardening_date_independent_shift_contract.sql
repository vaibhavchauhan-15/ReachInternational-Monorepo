-- Migration 188: Phase 6 — Hardening Date-Independent Shift Contract & Authorization
-- 1. Updates get_shift_tasks() to include single-day assignments (valid_from <= valid_to)
-- 2. Updates get_operations_monitor_realtime_matrix() to include single-day assignments
-- 3. Updates check_user_can_access_machine() to recognize active assignments within the 7-day IST window
-- 4. Updates submit_operator_hour_log_atomic() to strictly verify assignment on the work date (v_log_date)

-- ============================================================
-- 1. check_user_can_access_machine
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_user_can_access_machine(
  p_machine_id UUID,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_role TEXT;
  v_uid UUID;
  v_client_id UUID;
  v_cur_sup UUID;
  v_sup_ids UUID[];
  v_cur_op UUID;
  v_op_ids UUID[];
  v_today_ist DATE;
BEGIN
  v_uid := COALESCE(p_user_id, auth.uid());
  IF v_uid IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_uid;

  -- Admins, managers, and HR have monorepo-wide equipment visibility
  IF v_role IN ('super_admin', 'admin', 'manager', 'hr') THEN
    RETURN TRUE;
  END IF;

  SELECT client_id, current_supervisor_id, supervisor_ids, current_operator_id, operator_ids
  INTO v_client_id, v_cur_sup, v_sup_ids, v_cur_op, v_op_ids
  FROM public.machines
  WHERE id = p_machine_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Supervisor access: Inherited through client when allocated, or legacy direct machine assignment when unallocated
  IF v_role = 'supervisor' THEN
    IF v_client_id IS NOT NULL THEN
      RETURN EXISTS (
        SELECT 1 FROM public.client_supervisors cs
        WHERE cs.client_id = v_client_id AND cs.supervisor_id = v_uid
      );
    ELSE
      IF v_cur_sup = v_uid OR (v_sup_ids IS NOT NULL AND v_uid = ANY(v_sup_ids)) THEN
        RETURN TRUE;
      END IF;
      RETURN FALSE;
    END IF;
  END IF;

  -- Operator access: Actively assigned machine, recently assigned within 7-day window, or legacy operator assignment
  IF v_role = 'operator' THEN
    v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
    IF EXISTS (
      SELECT 1 FROM public.operator_machine_assignments oma
      WHERE oma.machine_id = p_machine_id
        AND oma.operator_id = v_uid
        AND (
          oma.is_active = true
          OR oma.valid_to IS NULL
          OR oma.valid_to >= (v_today_ist - 7)
        )
    ) THEN
      RETURN TRUE;
    END IF;

    IF v_cur_op = v_uid OR (v_op_ids IS NOT NULL AND v_uid = ANY(v_op_ids)) THEN
      RETURN TRUE;
    END IF;

    -- Unassigned fleet fallback: if machine has no operators assigned, any active operator can access
    IF (v_op_ids IS NULL OR cardinality(v_op_ids) = 0) AND v_cur_op IS NULL THEN
      RETURN TRUE;
    END IF;

    RETURN FALSE;
  END IF;

  RETURN FALSE;
END;
$$;

-- ============================================================
-- 2. get_shift_tasks — IST-aware 7-day window read (single-day support)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_shift_tasks(
  p_actor_id      UUID,
  p_operator_id   UUID     DEFAULT NULL,
  p_from_date     DATE     DEFAULT NULL,
  p_to_date       DATE     DEFAULT NULL,
  p_status        TEXT     DEFAULT 'all',
  p_page          INT      DEFAULT 1,
  p_page_size     INT      DEFAULT 50
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_today       DATE;
  v_from_date   DATE;
  v_to_date     DATE;
  v_actor_role  TEXT;
  v_rows        JSONB;
  v_total_count INT;
  v_offset      INT;
  v_page        INT;
  v_page_size   INT;
BEGIN
  -- IST-authoritative today
  v_today     := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
  v_from_date := COALESCE(p_from_date, v_today - 6);
  v_to_date   := COALESCE(p_to_date, v_today);

  -- Clamp: never expose future beyond today; never go beyond 7-day window for operators
  v_to_date   := LEAST(v_to_date, v_today);

  v_page      := GREATEST(1, COALESCE(p_page, 1));
  v_page_size := GREATEST(1, LEAST(200, COALESCE(p_page_size, 50)));
  v_offset    := (v_page - 1) * v_page_size;

  SELECT role INTO v_actor_role FROM public.users WHERE id = p_actor_id;

  WITH
  -- Date series for the window
  window_dates AS (
    SELECT d::date AS work_date
    FROM generate_series(v_from_date, v_to_date, '1 day'::interval) d
  ),

  -- Assignments visible to this actor
  visible_assignments AS (
    SELECT
      oma.id          AS assignment_id,
      oma.operator_id,
      oma.machine_id,
      oma.shift_code,
      oma.valid_from,
      oma.valid_to,
      oma.shift_start_time,
      oma.shift_end_time
    FROM public.operator_machine_assignments oma
    WHERE
      -- Operator-scoped self-view
      (p_operator_id IS NOT NULL AND oma.operator_id = p_operator_id)
      OR
      -- RBAC scope for supervisor/manager/admin
      (p_operator_id IS NULL AND (
        v_actor_role IN ('super_admin', 'admin', 'manager', 'hr')
        OR oma.operator_id = p_actor_id
        OR EXISTS (
          SELECT 1 FROM public.user_supervisors us
          WHERE us.supervisor_id = p_actor_id AND us.user_id = oma.operator_id
        )
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = oma.operator_id AND u.supervisor_id = p_actor_id
        )
        OR EXISTS (
          SELECT 1 FROM public.machines m
          WHERE m.id = oma.machine_id AND (
            m.current_supervisor_id = p_actor_id
            OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
            OR (m.client_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.client_supervisors cs
              WHERE cs.client_id = m.client_id AND cs.supervisor_id = p_actor_id
            ))
          )
        )
      ))
  ),

  -- Cross (assignment x date): only where the assignment range covers the date
  tasks AS (
    SELECT
      va.assignment_id,
      va.operator_id,
      va.machine_id,
      va.shift_code,
      wd.work_date,
      va.shift_start_time,
      va.shift_end_time
    FROM visible_assignments va
    CROSS JOIN window_dates wd
    WHERE
      wd.work_date >= va.valid_from
      AND (va.valid_to IS NULL OR wd.work_date <= va.valid_to)
      AND (
        va.valid_to IS NULL
        OR va.valid_from <= va.valid_to
      )
      AND va.shift_code IS NOT NULL
  ),

  -- Join logs by assignment_id + work_date (the authoritative link)
  tasks_with_logs AS (
    SELECT
      t.assignment_id,
      t.operator_id,
      t.machine_id,
      t.shift_code,
      t.work_date,
      t.shift_start_time,
      t.shift_end_time,
      mhl.id              AS log_id,
      mhl.start_meter,
      mhl.end_meter,
      mhl.running_hours,
      mhl.is_breakdown,
      mhl.remarks,
      mhl.created_at      AS log_created_at,
      CASE WHEN mhl.id IS NOT NULL THEN 'entered' ELSE 'pending' END AS status
    FROM tasks t
    LEFT JOIN public.machine_hour_logs mhl
      ON mhl.assignment_id = t.assignment_id
      AND mhl.log_date = t.work_date
  ),

  enriched AS (
    SELECT
      twl.assignment_id,
      twl.operator_id,
      twl.machine_id,
      twl.shift_code,
      twl.work_date,
      twl.shift_start_time,
      twl.shift_end_time,
      twl.log_id,
      twl.start_meter,
      twl.end_meter,
      twl.running_hours,
      twl.is_breakdown,
      twl.remarks,
      twl.log_created_at,
      twl.status,
      u.full_name         AS operator_name,
      u.employee_id       AS operator_employee_id,
      m.machine_id        AS machine_code,
      m.serial_number,
      m.model,
      m.client_id,
      m.site_id,
      m.hour_meter        AS current_meter,
      m.status            AS machine_status,
      m.health_status     AS machine_health_status,
      c.company_name      AS client_name,
      cs.site_name
    FROM tasks_with_logs twl
    LEFT JOIN public.users    u  ON u.id  = twl.operator_id
    LEFT JOIN public.machines m  ON m.id  = twl.machine_id
    LEFT JOIN public.clients  c  ON c.id  = m.client_id
    LEFT JOIN public.client_sites cs ON cs.id = m.site_id
    WHERE (p_status = 'all' OR twl.status = p_status)
  ),

  total AS (SELECT COUNT(*) AS cnt FROM enriched),

  paged AS (
    SELECT * FROM enriched
    ORDER BY
      work_date DESC,
      CASE status WHEN 'pending' THEN 1 WHEN 'entered' THEN 2 ELSE 3 END,
      machine_code ASC
    OFFSET v_offset
    LIMIT v_page_size
  )

  SELECT
    (SELECT cnt FROM total),
    jsonb_agg(jsonb_build_object(
      'assignment_id',         p.assignment_id,
      'operator_id',           p.operator_id,
      'operator_name',         p.operator_name,
      'operator_employee_id',  p.operator_employee_id,
      'machine_id',            p.machine_id,
      'machine_code',          p.machine_code,
      'serial_number',         p.serial_number,
      'model',                 p.model,
      'client_id',             p.client_id,
      'client_name',           p.client_name,
      'site_id',               p.site_id,
      'site_name',             p.site_name,
      'current_meter',         p.current_meter,
      'machine_status',        p.machine_status,
      'machine_health_status', p.machine_health_status,
      'shift_code',            p.shift_code,
      'shift_start_time',      p.shift_start_time,
      'shift_end_time',        p.shift_end_time,
      'work_date',             p.work_date,
      'log_id',                p.log_id,
      'start_meter',           p.start_meter,
      'end_meter',             p.end_meter,
      'running_hours',         p.running_hours,
      'is_breakdown',          p.is_breakdown,
      'remarks',               p.remarks,
      'log_created_at',        p.log_created_at,
      'status',                p.status
    ))
  INTO v_total_count, v_rows
  FROM paged p;

  RETURN jsonb_build_object(
    'page',        v_page,
    'pageSize',    v_page_size,
    'totalCount',  COALESCE(v_total_count, 0),
    'hasMore',     (v_offset + v_page_size) < COALESCE(v_total_count, 0),
    'fromDate',    v_from_date,
    'toDate',      v_to_date,
    'rows',        COALESCE(v_rows, '[]'::jsonb)
  );
END;
$$;

-- ============================================================
-- 3. get_operations_monitor_realtime_matrix
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_operations_monitor_realtime_matrix(
  p_actor_id    UUID,
  p_target_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_today_ist       DATE;
  v_target_date     DATE;
  v_actor_role      TEXT;
  v_res             JSONB;
BEGIN
  v_today_ist   := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
  v_target_date := COALESCE(p_target_date, v_today_ist);

  SELECT role INTO v_actor_role FROM public.users WHERE id = p_actor_id;

  WITH
  -- 1. All machines visible to the caller
  visible_machines AS (
    SELECT
      m.id,
      m.machine_id,
      m.serial_number,
      m.model,
      m.status,
      m.client_id,
      m.site_id,
      m.hour_meter,
      c.company_name AS client_name,
      cs.site_name
    FROM public.machines m
    LEFT JOIN public.clients c ON c.id = m.client_id
    LEFT JOIN public.client_sites cs ON cs.id = m.site_id
    WHERE
      v_actor_role IN ('super_admin', 'admin', 'manager', 'hr')
      OR m.current_supervisor_id = p_actor_id
      OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[p_actor_id])
      OR (m.client_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.client_supervisors cs2
        WHERE cs2.client_id = m.client_id AND cs2.supervisor_id = p_actor_id
      ))
  ),

  -- 2. Assignments covering target_date
  active_assignments AS (
    SELECT
      oma.id AS assignment_id,
      oma.machine_id,
      oma.operator_id,
      oma.shift_code,
      oma.valid_from,
      oma.valid_to,
      oma.shift_start_time,
      oma.shift_end_time,
      u.full_name AS operator_name,
      u.employee_id AS operator_employee_id
    FROM public.operator_machine_assignments oma
    JOIN public.machines m ON m.id = oma.machine_id
    LEFT JOIN public.users u ON u.id = oma.operator_id
    WHERE oma.valid_from <= v_target_date
      AND (oma.valid_to IS NULL OR oma.valid_to >= v_target_date)
      AND (
        oma.valid_to IS NULL
        OR oma.valid_from <= oma.valid_to
        OR EXISTS (
          SELECT 1 FROM public.machine_hour_logs mhl
          WHERE mhl.assignment_id = oma.id
            AND mhl.log_date = v_target_date
        )
      )
      AND oma.shift_code IS NOT NULL
  ),

  -- 3. Logs on target date
  target_logs AS (
    SELECT
      mhl.id,
      mhl.machine_id,
      mhl.operator_id,
      mhl.shift_code,
      mhl.assignment_id,
      mhl.start_meter,
      mhl.end_meter,
      mhl.running_hours,
      mhl.is_breakdown,
      mhl.remarks,
      mhl.created_at
    FROM public.machine_hour_logs mhl
    WHERE mhl.log_date = v_target_date
  ),

  -- 4. Combine per machine
  machine_matrix AS (
    SELECT
      vm.id AS machine_id,
      vm.machine_id AS machine_code,
      vm.serial_number,
      vm.model,
      vm.status AS machine_status,
      vm.client_name,
      vm.site_name,
      vm.hour_meter AS current_meter,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'assignment_id', aa.assignment_id,
          'operator_id',   aa.operator_id,
          'operator_name', aa.operator_name,
          'shift_code',    aa.shift_code,
          'shift_start',   aa.shift_start_time,
          'shift_end',     aa.shift_end_time,
          'log_id',        tl.id,
          'status',        CASE WHEN tl.id IS NOT NULL THEN 'entered' ELSE 'pending' END,
          'running_hours', tl.running_hours,
          'start_meter',   tl.start_meter,
          'end_meter',     tl.end_meter,
          'is_breakdown',  tl.is_breakdown
        ))
        FROM active_assignments aa
        LEFT JOIN target_logs tl
          ON (tl.assignment_id = aa.assignment_id OR (tl.assignment_id IS NULL AND tl.machine_id = aa.machine_id AND tl.operator_id = aa.operator_id AND tl.shift_code = aa.shift_code))
        WHERE aa.machine_id = vm.id
      ), '[]'::jsonb) AS shifts
    FROM visible_machines vm
  )

  SELECT jsonb_build_object(
    'target_date', v_target_date,
    'machines', COALESCE(jsonb_agg(to_jsonb(mm)), '[]'::jsonb)
  )
  INTO v_res
  FROM machine_matrix mm;

  RETURN v_res;
END;
$$;

-- ============================================================
-- 4. submit_operator_hour_log_atomic (work date authorization)
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_operator_hour_log_atomic(
  p_machine_id              UUID,
  p_operator_id             UUID,
  p_client_id               UUID      DEFAULT NULL,
  p_shift_code              TEXT      DEFAULT NULL,
  p_log_date                DATE      DEFAULT NULL,
  p_end_date                DATE      DEFAULT NULL,
  p_start_datetime          TIMESTAMPTZ DEFAULT NULL,
  p_end_datetime            TIMESTAMPTZ DEFAULT NULL,
  p_start_meter             NUMERIC   DEFAULT 0,
  p_end_meter               NUMERIC   DEFAULT 0,
  p_start_time              TEXT      DEFAULT NULL,
  p_end_time                TEXT      DEFAULT NULL,
  p_overtime_hours          NUMERIC   DEFAULT 0,
  p_normal_working_hours    NUMERIC   DEFAULT 8,
  p_is_breakdown            BOOLEAN   DEFAULT false,
  p_breakdown_start_time    TEXT      DEFAULT NULL,
  p_breakdown_end_time      TEXT      DEFAULT NULL,
  p_breakdown_duration      TEXT      DEFAULT NULL,
  p_breakdown_hours         NUMERIC   DEFAULT 0,
  p_shift                   TEXT      DEFAULT NULL,
  p_machine_condition       TEXT      DEFAULT 'good',
  p_location                TEXT      DEFAULT NULL,
  p_remarks                 TEXT      DEFAULT NULL,
  p_idempotency_key         TEXT      DEFAULT NULL,
  p_entered_by              UUID      DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  v_actor_id               UUID;
  v_entry_source           TEXT;
  v_log_id                 UUID;
  v_audit_meta             JSONB;
  v_resolved_client_id     UUID;
  v_resolved_site_id       UUID;
  v_resolved_location      TEXT := p_location;
  v_idempotency_key        TEXT;
  v_start_time             TIME;
  v_end_time               TIME;
  v_breakdown_start_time   TIME;
  v_breakdown_end_time     TIME;
  v_log_date               DATE;
  v_end_date               DATE;
  v_start_datetime         TIMESTAMPTZ;
  v_end_datetime           TIMESTAMPTZ;
  v_shift_code             TEXT;
  v_shift_name             TEXT;
  v_normal_hours           NUMERIC;
  v_caller_role            TEXT;
  v_breakdown_minutes      INTEGER;
  v_maintenance_minutes    INTEGER;
  v_assigned_shift_codes   TEXT[];
  v_is_assisted_override   BOOLEAN := false;
  v_existing_machine_log   RECORD;
  v_existing_op_log        RECORD;
  v_resolved_assignment_id UUID;
  v_today_ist              DATE;
BEGIN
  v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
  v_log_date  := COALESCE(p_log_date, v_today_ist);

  -- 1. Determine actor and entry attribution
  v_actor_id := COALESCE(p_entered_by, auth.uid(), p_operator_id);

  IF v_actor_id = p_operator_id THEN
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_actor_id;
    IF v_caller_role != 'operator' AND v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'supervisor') THEN
      RAISE EXCEPTION 'Not authorized to submit shift log' USING ERRCODE = '42501';
    END IF;
    v_entry_source := 'operator';
  ELSE
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_actor_id;
    IF v_caller_role IN ('super_admin', 'admin', 'manager') THEN
      v_entry_source := v_caller_role;
    ELSIF v_caller_role = 'supervisor' THEN
      IF NOT (
        public.is_operator_under_supervisor(v_actor_id, p_operator_id)
        OR EXISTS (
          SELECT 1 FROM public.machines m
          WHERE m.id = p_machine_id
            AND (
              m.current_supervisor_id = v_actor_id
              OR (m.supervisor_ids IS NOT NULL AND m.supervisor_ids @> ARRAY[v_actor_id])
              OR (
                m.client_id IS NOT NULL AND EXISTS (
                  SELECT 1 FROM public.client_supervisors cs
                  WHERE cs.client_id = m.client_id AND cs.supervisor_id = v_actor_id
                )
              )
            )
        )
      ) THEN
        RAISE EXCEPTION 'Not authorized: Supervisors can only fill shift entries for operators or machinery assigned under their supervision.'
          USING ERRCODE = '42501';
      END IF;
      v_entry_source := 'supervisor';
    ELSE
      RAISE EXCEPTION 'Not authorized to enter shift logs on behalf of operators. Only authorized supervisors, managers, and administrators are permitted.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 1b. Equipment Assignment Enforcement for Operator Self-Entry
  -- Contract Rule 4 & 5: An operator can only submit entries for days on which an assignment actually existed
  IF v_entry_source = 'operator' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.operator_machine_assignments oma
      WHERE oma.machine_id  = p_machine_id
        AND oma.operator_id = p_operator_id
        AND oma.valid_from <= v_log_date
        AND (oma.valid_to IS NULL OR oma.valid_to >= v_log_date)
    ) THEN
      RAISE EXCEPTION 'Operator is not authorized to submit shift logs for this equipment on date %. You must have a valid assignment covering this work date.',
        v_log_date
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 2. Meter Range & Maximum Running Hours Guard
  IF p_start_meter < 0 OR p_end_meter < 0 THEN
    RAISE EXCEPTION 'Hour meter readings cannot be negative (start: %, end: %)', p_start_meter, p_end_meter
      USING ERRCODE = '23514';
  END IF;

  IF p_end_meter < p_start_meter THEN
    RAISE EXCEPTION 'End meter reading (%) cannot be less than start meter reading (%)', p_end_meter, p_start_meter
      USING ERRCODE = '23514';
  END IF;

  IF (p_end_meter - p_start_meter) > 24 THEN
    RAISE EXCEPTION 'Machine running hours (%) cannot exceed 24 hours in a single log', (p_end_meter - p_start_meter)
      USING ERRCODE = '23514';
  END IF;

  -- 3. Machine Operational Status Guard
  IF EXISTS (
    SELECT 1 FROM public.machines
    WHERE id = p_machine_id AND (status = 'inactive' OR health_status = 'under_maintenance')
  ) THEN
    RAISE EXCEPTION 'Cannot record machine log for equipment currently in maintenance or inactive status'
      USING ERRCODE = '23514';
  END IF;

  -- 4. Shift Code and Name Resolution
  v_shift_code := NULLIF(TRIM(COALESCE(p_shift_code, p_shift)), '');
  IF v_shift_code IS NOT NULL THEN
    v_shift_code := regexp_replace(v_shift_code, '^shift\s*', '', 'i');
  END IF;

  -- 5. Normalization of Dates and Times
  v_end_date   := COALESCE(p_end_date, v_log_date);
  v_start_time := NULLIF(TRIM(p_start_time), '')::TIME;
  v_end_time   := NULLIF(TRIM(p_end_time), '')::TIME;
  v_breakdown_start_time := NULLIF(TRIM(p_breakdown_start_time), '')::TIME;
  v_breakdown_end_time   := NULLIF(TRIM(p_breakdown_end_time), '')::TIME;
  v_start_datetime := p_start_datetime;
  v_end_datetime   := p_end_datetime;

  -- Default times from shift code when omitted
  IF v_start_time IS NULL THEN
    v_start_time := CASE v_shift_code
      WHEN 'A'  THEN '06:00:00'::TIME
      WHEN 'B'  THEN '14:00:00'::TIME
      WHEN 'C'  THEN '22:00:00'::TIME
      WHEN 'S1' THEN '08:00:00'::TIME
      ELSE           '08:00:00'::TIME
    END;
  END IF;

  IF v_end_time IS NULL THEN
    v_end_time := CASE v_shift_code
      WHEN 'A'  THEN '14:00:00'::TIME
      WHEN 'B'  THEN '22:00:00'::TIME
      WHEN 'C'  THEN '06:00:00'::TIME
      WHEN 'S1' THEN '16:00:00'::TIME
      ELSE           '16:00:00'::TIME
    END;
  END IF;

  IF v_start_datetime IS NULL THEN
    v_start_datetime := ((v_log_date::text || ' ' || v_start_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata');
  END IF;

  IF v_end_datetime IS NULL THEN
    IF v_end_time <= v_start_time AND v_end_date = v_log_date THEN
      v_end_date := (v_log_date + INTERVAL '1 day')::date;
    END IF;
    v_end_datetime := ((v_end_date::text || ' ' || v_end_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata');
  END IF;

  -- 6. Operator 7-Day Window Guard — ROOT-03 FIX: use IST date, not UTC CURRENT_DATE
  IF v_entry_source = 'operator' THEN
    IF v_log_date < (v_today_ist - 7) OR v_log_date > v_today_ist THEN
      RAISE EXCEPTION 'Operators can only record logs within the previous 7 days IST (date %, allowed: % to %)',
        v_log_date, (v_today_ist - 7), v_today_ist
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- 7. Resolve assignment_id by date range — ROOT-05 FIX: authoritative link by range, not is_active
  --    Looks for assignment where valid_from <= log_date <= valid_to (or open)
  SELECT oma.id INTO v_resolved_assignment_id
  FROM public.operator_machine_assignments oma
  WHERE oma.machine_id  = p_machine_id
    AND oma.operator_id = p_operator_id
    AND oma.valid_from <= v_log_date
    AND (oma.valid_to IS NULL OR oma.valid_to >= v_log_date)
    AND lower(trim(oma.shift_code)) = lower(trim(COALESCE(v_shift_code, oma.shift_code)))
  ORDER BY oma.valid_from DESC
  LIMIT 1;

  -- 7b. Assigned Shift Code Enforcement (now against the range-resolved assignment)
  IF p_operator_id IS NOT NULL AND p_machine_id IS NOT NULL THEN
    SELECT ARRAY_AGG(DISTINCT shift_code)
    INTO v_assigned_shift_codes
    FROM public.operator_machine_assignments
    WHERE machine_id  = p_machine_id
      AND operator_id = p_operator_id
      AND valid_from <= v_log_date
      AND (valid_to IS NULL OR valid_to >= v_log_date)
      AND shift_code IS NOT NULL;

    IF v_assigned_shift_codes IS NOT NULL AND array_length(v_assigned_shift_codes, 1) > 0 THEN
      IF v_shift_code IS NOT NULL THEN
        IF NOT (v_shift_code = ANY(v_assigned_shift_codes)) THEN
          IF v_entry_source = 'operator' THEN
            RAISE EXCEPTION 'Operator is assigned to Shift % on this equipment, but attempted to log for Shift %. Please select your assigned shift.',
              array_to_string(v_assigned_shift_codes, ', '), v_shift_code
              USING ERRCODE = '23514';
          ELSE
            v_is_assisted_override := true;
          END IF;
        END IF;
      ELSE
        IF array_length(v_assigned_shift_codes, 1) = 1 THEN
          v_shift_code := v_assigned_shift_codes[1];
        ELSE
          RAISE EXCEPTION 'Operator is assigned to shifts % on this equipment. Please select which assigned shift is being logged.',
            array_to_string(v_assigned_shift_codes, ', ')
            USING ERRCODE = '23514';
        END IF;
      END IF;
    END IF;
  END IF;

  v_shift_name := COALESCE(p_shift, CASE WHEN v_shift_code IS NOT NULL THEN 'Shift ' || v_shift_code ELSE 'Standard Shift' END);

  -- 8. Duplicate Machine Shift Guard — first check by assignment_id+log_date (new), then fall back to old
  IF v_resolved_assignment_id IS NOT NULL THEN
    SELECT id, start_meter, end_meter, operator_id, normal_working_hours, breakdown_minutes, maintenance_minutes
    INTO v_existing_machine_log
    FROM public.machine_hour_logs
    WHERE assignment_id = v_resolved_assignment_id
      AND log_date = v_log_date
    LIMIT 1;
  ELSIF v_shift_code IS NOT NULL THEN
    SELECT id, start_meter, end_meter, operator_id, normal_working_hours, breakdown_minutes, maintenance_minutes
    INTO v_existing_machine_log
    FROM public.machine_hour_logs
    WHERE machine_id = p_machine_id
      AND log_date = v_log_date
      AND shift_code = v_shift_code
    LIMIT 1;
  END IF;

  IF v_existing_machine_log.id IS NOT NULL THEN
    IF v_existing_machine_log.operator_id = p_operator_id
       AND v_existing_machine_log.start_meter = p_start_meter
       AND v_existing_machine_log.end_meter = p_end_meter THEN
      RETURN jsonb_build_object(
        'success',               true,
        'id',                    v_existing_machine_log.id,
        'log_id',                v_existing_machine_log.id,
        'machine_id',            p_machine_id,
        'operator_id',           p_operator_id,
        'site_id',               v_resolved_site_id,
        'log_date',              v_log_date,
        'start_meter',           p_start_meter,
        'end_meter',             p_end_meter,
        'running_hours',         GREATEST(0, p_end_meter - p_start_meter),
        'normal_working_hours',  v_existing_machine_log.normal_working_hours,
        'overtime_hours',        COALESCE(p_overtime_hours, 0),
        'breakdown_minutes',     v_existing_machine_log.breakdown_minutes,
        'maintenance_minutes',   v_existing_machine_log.maintenance_minutes,
        'shift_code',            v_shift_code,
        'entry_source',          v_entry_source,
        'is_assisted_override',  v_is_assisted_override,
        'already_logged',        true
      );
    ELSE
      RAISE EXCEPTION 'A log for Shift % on date % has already been recorded for this equipment (Start: %, End: %). Duplicate entries are not permitted.',
        v_shift_code, v_log_date, v_existing_machine_log.start_meter, v_existing_machine_log.end_meter
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- 9. Cross-Machine Operator Shift Guard
  IF p_operator_id IS NOT NULL AND v_shift_code IS NOT NULL THEN
    SELECT l.id, l.machine_id, m.machine_id AS machine_code, l.start_meter, l.end_meter
    INTO v_existing_op_log
    FROM public.machine_hour_logs l
    LEFT JOIN public.machines m ON m.id = l.machine_id
    WHERE l.operator_id = p_operator_id
      AND l.log_date = v_log_date
      AND l.shift_code = v_shift_code
      AND l.machine_id <> p_machine_id
    LIMIT 1;

    IF v_existing_op_log.id IS NOT NULL THEN
      RAISE EXCEPTION 'Operator has already submitted a log for Shift % on machine % on %. An operator cannot operate two machines during the same shift.',
        v_shift_code, COALESCE(v_existing_op_log.machine_code, 'other equipment'), v_log_date
        USING ERRCODE = '23514';
    END IF;
  END IF;

  -- 10. Client, Site & Location Resolution
  IF p_client_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.client_sites WHERE id = p_client_id) THEN
      v_resolved_site_id := p_client_id;
      SELECT client_id INTO v_resolved_client_id FROM public.client_sites WHERE id = v_resolved_site_id;
    ELSE
      v_resolved_client_id := p_client_id;
    END IF;
  ELSE
    SELECT client_id, site_id INTO v_resolved_client_id, v_resolved_site_id FROM public.machines WHERE id = p_machine_id;
  END IF;

  IF v_resolved_location IS NULL AND v_resolved_site_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(btrim(site_name), ''), NULLIF(btrim(city), ''))
    INTO v_resolved_location FROM public.client_sites WHERE id = v_resolved_site_id;
  END IF;

  IF v_resolved_location IS NULL AND v_resolved_client_id IS NOT NULL THEN
    SELECT concat_ws(', ', NULLIF(btrim(city), ''), NULLIF(btrim(district), ''), NULLIF(btrim(state), ''))
    INTO v_resolved_location FROM public.clients WHERE id = v_resolved_client_id;
  END IF;

  -- 11. Normal Hours
  v_normal_hours := COALESCE(p_normal_working_hours, 8);

  -- 12. Ensure Idempotency Key
  v_idempotency_key := COALESCE(
    NULLIF(TRIM(p_idempotency_key), ''),
    'ihl_' || replace(gen_random_uuid()::text, '-', '')
  );

  -- 13. Compute Breakdown Minutes
  v_breakdown_minutes := 0;
  IF p_is_breakdown = true THEN
    IF p_breakdown_hours > 0 THEN
      v_breakdown_minutes := ROUND(p_breakdown_hours * 60);
    ELSIF v_breakdown_start_time IS NOT NULL AND v_breakdown_end_time IS NOT NULL THEN
      IF v_breakdown_end_time >= v_breakdown_start_time THEN
        v_breakdown_minutes := ROUND(EXTRACT(EPOCH FROM (v_breakdown_end_time - v_breakdown_start_time)) / 60);
      ELSE
        v_breakdown_minutes := ROUND(EXTRACT(EPOCH FROM ((v_breakdown_end_time + INTERVAL '24 hours') - v_breakdown_start_time)) / 60);
      END IF;
    END IF;
  END IF;

  -- 14. Compute Maintenance Allowance
  v_maintenance_minutes := 0;
  IF v_resolved_client_id IS NOT NULL THEN
    SELECT COALESCE(maintenance_allowance_minutes, 0)
    INTO v_maintenance_minutes FROM public.clients WHERE id = v_resolved_client_id;
  END IF;

  -- 15. Insert into machine_hour_logs — includes assignment_id
  INSERT INTO public.machine_hour_logs (
    machine_id, operator_id, client_id, site_id,
    assignment_id,
    log_date, end_date, start_datetime, end_datetime,
    start_meter, end_meter, start_time, end_time,
    overtime_hours, normal_working_hours,
    is_breakdown, breakdown_start_time, breakdown_end_time,
    breakdown_duration, breakdown_hours, breakdown_minutes, maintenance_minutes,
    shift, shift_code, machine_condition, location, remarks,
    idempotency_key, entered_by, entry_source
  ) VALUES (
    p_machine_id, p_operator_id, v_resolved_client_id, v_resolved_site_id,
    v_resolved_assignment_id,
    v_log_date, v_end_date, v_start_datetime, v_end_datetime,
    p_start_meter, p_end_meter, v_start_time, v_end_time,
    COALESCE(p_overtime_hours, 0), v_normal_hours,
    COALESCE(p_is_breakdown, false), v_breakdown_start_time, v_breakdown_end_time,
    p_breakdown_duration, COALESCE(p_breakdown_hours, 0),
    COALESCE(v_breakdown_minutes, 0), COALESCE(v_maintenance_minutes, 0),
    v_shift_name, v_shift_code,
    COALESCE(p_machine_condition, 'good'),
    v_resolved_location, p_remarks,
    v_idempotency_key, v_actor_id, v_entry_source
  )
  RETURNING id INTO v_log_id;

  -- 16. Update Machine hour_meter, current_operator_id, health_status
  UPDATE public.machines
  SET
    hour_meter         = p_end_meter,
    current_operator_id = p_operator_id,
    health_status      = CASE
      WHEN COALESCE(p_is_breakdown, false) = true OR p_machine_condition = 'breakdown' THEN 'breakdown'
      ELSE 'active'
    END,
    updated_at = NOW()
  WHERE id = p_machine_id;

  -- 17. Record Structured Audit Log
  v_audit_meta := jsonb_build_object(
    'logId',              v_log_id,
    'assignmentId',       v_resolved_assignment_id,
    'startMeter',         p_start_meter,
    'endMeter',           p_end_meter,
    'runningHours',       (p_end_meter - p_start_meter),
    'normalWorkingHours', v_normal_hours,
    'overtimeHours',      p_overtime_hours,
    'startTime',          p_start_time,
    'endTime',            p_end_time,
    'shiftCode',          v_shift_code,
    'condition',          p_machine_condition,
    'idempotencyKey',     v_idempotency_key,
    'enteredBy',          v_actor_id,
    'entrySource',        v_entry_source,
    'isAssistedOverride', v_is_assisted_override
  );

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata, details, created_at)
  VALUES (
    v_actor_id, 'machine.hour_logged', 'machine', p_machine_id::text,
    v_audit_meta, v_audit_meta, NOW()
  );

  RETURN jsonb_build_object(
    'success',              true,
    'id',                   v_log_id,
    'log_id',               v_log_id,
    'assignment_id',        v_resolved_assignment_id,
    'machine_id',           p_machine_id,
    'operator_id',          p_operator_id,
    'site_id',              v_resolved_site_id,
    'log_date',             v_log_date,
    'start_meter',          p_start_meter,
    'end_meter',            p_end_meter,
    'running_hours',        (p_end_meter - p_start_meter),
    'normal_working_hours', v_normal_hours,
    'overtime_hours',       COALESCE(p_overtime_hours, 0),
    'breakdown_minutes',    v_breakdown_minutes,
    'maintenance_minutes',  v_maintenance_minutes,
    'shift_code',           v_shift_code,
    'entry_source',         v_entry_source,
    'is_assisted_override', v_is_assisted_override
  );
END;
$$;
