-- Migration 185: Phase 3 — Date-Independent Assignment RPCs
-- Adds:
--   1. get_shift_tasks()          — IST-aware 7-day pending/entered window RPC (replaces is_active lookup)
--   2. assign_operator_machine_atomic() updated — stamps valid_from/valid_to on new assignments
--   3. submit_operator_hour_log_atomic() updated — resolves assignment_id by range; stamps it on insert
--   4. end_assignment_range()     — closes a range (sets valid_to); used by endAssignmentAction
-- All changes are ADDITIVE. Old signatures/callers continue to work unchanged.

-- ============================================================
-- 1. get_shift_tasks — IST-aware 7-day window read
--    Returns one row per (operator_id, machine_id, shift_code, work_date)
--    with state = 'pending' | 'entered' | 'unassigned'
--    Filtering:
--      - p_actor_id: restricts rows via same RBAC as monitor
--      - p_operator_id: when set, returns only that operator (operator self-view)
--      - p_from_date/p_to_date: defaults to last 7 days IST
--      - p_status: 'all'|'pending'|'entered'
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

  -- Cross (assignment × date): only where the assignment range covers the date
  -- Excludes zero-duration aborted assignments (valid_from = valid_to, no log)
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
      -- Exclude zero-duration slots unless they have an actual log
      AND (
        va.valid_to IS NULL
        OR va.valid_from < va.valid_to
        OR EXISTS (
          SELECT 1 FROM public.machine_hour_logs mhl
          WHERE mhl.assignment_id = va.assignment_id
            AND mhl.log_date = wd.work_date
        )
      )
      AND va.shift_code IS NOT NULL
  ),

  -- Join logs by assignment_id + work_date (the new authoritative link)
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

  -- Enrich with user, machine, client details
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

GRANT EXECUTE ON FUNCTION public.get_shift_tasks(UUID, UUID, DATE, DATE, TEXT, INT, INT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_shift_tasks(UUID, UUID, DATE, DATE, TEXT, INT, INT) FROM anon, public;

-- ============================================================
-- 2. end_assignment_range — close an active assignment range
--    Sets valid_to = effective_date and is_active = false
--    Called by: endAssignmentAction (web) + reassign flow (before new range opens)
--    Respects: cannot retroactively close a range before its valid_from
-- ============================================================
CREATE OR REPLACE FUNCTION public.end_assignment_range(
  p_assignment_id UUID,
  p_caller_id     UUID,
  p_end_reason    TEXT    DEFAULT 'removed',
  p_effective_date DATE   DEFAULT NULL,
  p_notes         TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_assignment    RECORD;
  v_caller_role   TEXT;
  v_effective_date DATE;
  v_today_ist     DATE;
BEGIN
  v_today_ist      := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
  v_effective_date := COALESCE(p_effective_date, v_today_ist);

  -- Authorisation
  SELECT role INTO v_caller_role FROM public.users WHERE id = p_caller_id;
  IF v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'supervisor') THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN',
      'error', 'Only supervisors and above may close assignment ranges.');
  END IF;

  -- Lock the assignment row
  SELECT id, operator_id, machine_id, shift_code, valid_from, valid_to, is_active
  INTO v_assignment
  FROM public.operator_machine_assignments
  WHERE id = p_assignment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND',
      'error', 'Assignment not found.');
  END IF;

  IF v_assignment.is_active = false OR v_assignment.valid_to IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'ALREADY_ENDED',
      'error', 'Assignment range is already closed.');
  END IF;

  -- Cannot end a range before it started
  IF v_effective_date < v_assignment.valid_from THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_END_DATE',
      'error', format('Effective date (%s) cannot be before the assignment start (%s).',
        v_effective_date, v_assignment.valid_from));
  END IF;

  -- Close the range
  UPDATE public.operator_machine_assignments
  SET
    valid_to   = v_effective_date,
    is_active  = false,
    ended_at   = NOW(),
    ended_by   = p_caller_id,
    end_reason = p_end_reason,
    updated_at = NOW()
  WHERE id = p_assignment_id;

  -- Audit
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata, details, created_at)
  VALUES (
    p_caller_id,
    'assignment.range_ended',
    'operator_machine_assignment',
    p_assignment_id,
    jsonb_build_object(
      'assignmentId', p_assignment_id,
      'operatorId',   v_assignment.operator_id,
      'machineId',    v_assignment.machine_id,
      'shiftCode',    v_assignment.shift_code,
      'validFrom',    v_assignment.valid_from,
      'validTo',      v_effective_date,
      'endReason',    p_end_reason,
      'notes',        p_notes
    ),
    jsonb_build_object(
      'assignmentId', p_assignment_id,
      'operatorId',   v_assignment.operator_id,
      'machineId',    v_assignment.machine_id,
      'shiftCode',    v_assignment.shift_code,
      'validFrom',    v_assignment.valid_from,
      'validTo',      v_effective_date,
      'endReason',    p_end_reason
    ),
    NOW()
  );

  RETURN jsonb_build_object(
    'success',      true,
    'assignment_id', p_assignment_id,
    'valid_from',   v_assignment.valid_from,
    'valid_to',     v_effective_date,
    'end_reason',   p_end_reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.end_assignment_range(UUID, UUID, TEXT, DATE, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.end_assignment_range(UUID, UUID, TEXT, DATE, TEXT) FROM anon, public;

-- ============================================================
-- 3. Update assign_operator_machine_atomic to stamp valid_from/valid_to
--    Additive: only the INSERT block gains valid_from = today IST; valid_to stays NULL (open).
--    The GiST exclusion constraint added in migration 184 will block genuine overlaps.
--    Idempotent re-assigns (same operator+machine+shift already active): no-op as before.
-- ============================================================
CREATE OR REPLACE FUNCTION public.assign_operator_machine_atomic(
  p_machine_id        UUID,
  p_operator_id       UUID,
  p_shift_start       TIME     DEFAULT NULL,
  p_shift_end         TIME     DEFAULT NULL,
  p_assigned_by       UUID     DEFAULT NULL,
  p_shift_start_time  TIME     DEFAULT NULL,
  p_shift_end_time    TIME     DEFAULT NULL,
  p_notes             TEXT     DEFAULT NULL,
  p_shift_code        TEXT     DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_machine              RECORD;
  v_operator             RECORD;
  v_assigned_by_user     RECORD;
  v_existing_same_shift  RECORD;
  v_operator_active_count INT;
  v_machine_active_count  INT;
  v_shift_conflict        RECORD;
  v_overlap_conflict      RECORD;
  v_new_assignment_id     UUID;
  v_new_assignment        RECORD;
  v_audit_meta            JSONB;
  v_shift_start           TIME;
  v_shift_end             TIME;
  v_shift_code            TEXT;
  v_caller_id             UUID;
  v_csc_record            RECORD;
  v_today_ist             DATE;
BEGIN
  -- Concurrency serialization
  PERFORM pg_advisory_xact_lock(hashtext('oma_op_'   || p_operator_id::text));
  PERFORM pg_advisory_xact_lock(hashtext('oma_mach_' || p_machine_id::text));

  v_today_ist  := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
  v_shift_start := COALESCE(p_shift_start, p_shift_start_time);
  v_shift_end   := COALESCE(p_shift_end, p_shift_end_time);
  v_shift_code  := NULLIF(TRIM(p_shift_code), '');

  -- Derive caller
  IF auth.uid() IS NOT NULL THEN
    v_caller_id := auth.uid();
  ELSIF (auth.role() = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role') THEN
    v_caller_id := p_assigned_by;
  ELSE
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
      'error', 'Authentication required to assign equipment.');
  END IF;

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
      'error', 'Authentication required to assign equipment.');
  END IF;

  -- 1. Validate Machine
  SELECT id, machine_id, model, serial_number, client_id, current_supervisor_id, supervisor_ids, status
  INTO v_machine
  FROM public.machines
  WHERE id = p_machine_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'MACHINE_NOT_FOUND',
      'error', 'Target machine not found.');
  END IF;

  IF v_machine.status = 'decommissioned' THEN
    RETURN jsonb_build_object('success', false, 'code', 'MACHINE_DECOMMISSIONED',
      'error', 'Cannot assign operators to decommissioned machinery.');
  END IF;

  -- 2. Authoritative Client Shift Resolution
  IF v_machine.client_id IS NOT NULL AND v_shift_code IS NOT NULL THEN
    SELECT code, start_time, end_time
    INTO v_csc_record
    FROM public.client_shift_codes
    WHERE client_id = v_machine.client_id
      AND is_active = true
      AND (
        lower(trim(code)) = lower(trim(v_shift_code))
        OR lower(trim(name)) = lower(trim(v_shift_code))
        OR lower(trim(code)) = lower(trim(regexp_replace(v_shift_code, '^shift\s*', '', 'i')))
      )
    ORDER BY display_order ASC
    LIMIT 1;

    IF v_csc_record.code IS NOT NULL THEN
      v_shift_code  := v_csc_record.code;
      v_shift_start := v_csc_record.start_time;
      v_shift_end   := v_csc_record.end_time;
    END IF;
  END IF;

  IF v_shift_start IS NULL OR v_shift_end IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR',
      'error', 'Both shift start and end times must be provided or configured for this shift.');
  END IF;

  -- 3. Validate Operator
  SELECT id, full_name, email, role, status
  INTO v_operator
  FROM public.users
  WHERE id = p_operator_id AND role = 'operator' AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'OPERATOR_NOT_FOUND',
      'error', 'Selected operator is not active or does not exist.');
  END IF;

  -- 4. Authorization
  SELECT id, role, status INTO v_assigned_by_user
  FROM public.users WHERE id = v_caller_id;

  IF NOT FOUND OR v_assigned_by_user.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'code', 'CALLER_INACTIVE',
      'error', 'Caller user account is not active or does not exist.');
  END IF;

  IF v_assigned_by_user.role NOT IN ('super_admin', 'admin', 'manager', 'supervisor') THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN',
      'error', 'Only supervisors or above roles are permitted to assign operator shifts.');
  END IF;

  -- Supervisor scope
  IF v_assigned_by_user.role = 'supervisor' THEN
    IF v_machine.client_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.client_supervisors cs
        JOIN public.clients c ON c.id = cs.client_id
        WHERE cs.client_id = v_machine.client_id
          AND cs.supervisor_id = v_caller_id
          AND c.deleted_at IS NULL AND c.status = 'active'
      ) THEN
        RETURN jsonb_build_object('success', false, 'code', 'CLIENT_ACCESS_DENIED',
          'error', 'Unauthorized: You are not assigned as a supervisor for the client owning this machinery.');
      END IF;
    ELSE
      IF NOT (
        v_machine.current_supervisor_id = v_caller_id
        OR (v_machine.supervisor_ids IS NOT NULL AND v_caller_id = ANY(v_machine.supervisor_ids))
      ) THEN
        RETURN jsonb_build_object('success', false, 'code', 'MACHINE_ACCESS_DENIED',
          'error', 'Unauthorized: You are not assigned to supervise this unallocated machinery.');
      END IF;
    END IF;
  END IF;

  -- 5. Validate Shift Timings
  IF v_shift_start = v_shift_end THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_SHIFT_HOURS',
      'error', 'Shift start time and end time cannot be identical.');
  END IF;

  -- 6. Idempotency: same active assignment already exists
  SELECT id, machine_id, shift_start_time, shift_end_time, shift_code
  INTO v_existing_same_shift
  FROM public.operator_machine_assignments
  WHERE operator_id = p_operator_id
    AND machine_id  = p_machine_id
    AND is_active   = true
    AND valid_to IS NULL
    AND (
      (v_shift_code IS NOT NULL AND LOWER(TRIM(shift_code)) = LOWER(TRIM(v_shift_code)))
      OR (v_shift_code IS NULL AND shift_start_time = v_shift_start AND shift_end_time = v_shift_end)
    )
  LIMIT 1;

  IF v_existing_same_shift.id IS NOT NULL THEN
    IF v_existing_same_shift.shift_start_time = v_shift_start
       AND v_existing_same_shift.shift_end_time = v_shift_end THEN
      UPDATE public.operator_machine_assignments
      SET updated_at = NOW()
      WHERE id = v_existing_same_shift.id;

      RETURN jsonb_build_object(
        'success',          true,
        'assignment_id',    v_existing_same_shift.id,
        'machine_id',       p_machine_id,
        'operator_id',      p_operator_id,
        'shift_code',       v_shift_code,
        'shift_start_time', v_shift_start,
        'shift_end_time',   v_shift_end,
        'is_active',        true,
        'idempotent',       true
      );
    END IF;
  END IF;

  -- 7. Enforce Maximum 3 Active Shifts per Operator
  SELECT COUNT(*) INTO v_operator_active_count
  FROM public.operator_machine_assignments
  WHERE operator_id = p_operator_id AND is_active = true;

  IF v_operator_active_count >= 3 THEN
    RETURN jsonb_build_object('success', false, 'code', 'MAX_OPERATOR_SHIFTS_REACHED',
      'error', 'This operator is already assigned to the maximum allowed limit of 3 active shifts (24 hours).');
  END IF;

  -- 8. Enforce Maximum 3 Active Operators per Machine
  SELECT COUNT(*) INTO v_machine_active_count
  FROM public.operator_machine_assignments
  WHERE machine_id = p_machine_id AND is_active = true;

  IF v_machine_active_count >= 3 THEN
    RETURN jsonb_build_object('success', false, 'code', 'MAX_OPERATORS_REACHED',
      'error', 'This machine already has the maximum capacity of 3 active operators assigned.');
  END IF;

  -- 9. Check Overlapping Shift Conflict on Operator Across Fleet
  SELECT oma.id, oma.machine_id, m.machine_id AS machine_code, oma.shift_start_time, oma.shift_end_time
  INTO v_overlap_conflict
  FROM public.operator_machine_assignments oma
  JOIN public.machines m ON m.id = oma.machine_id
  WHERE oma.operator_id = p_operator_id
    AND oma.is_active = true
    AND public.do_shifts_overlap(oma.shift_start_time, oma.shift_end_time, v_shift_start, v_shift_end)
  LIMIT 1;

  IF v_overlap_conflict.id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'SHIFT_OVERLAP_CONFLICT',
      'error', format('Operator is already assigned to machine %s during an overlapping shift (%s - %s).',
        v_overlap_conflict.machine_code,
        v_overlap_conflict.shift_start_time::text,
        v_overlap_conflict.shift_end_time::text));
  END IF;

  -- 10. Check Overlapping Shift Conflict on Machine
  SELECT oma.id, oma.operator_id, u.full_name AS operator_name, oma.shift_start_time, oma.shift_end_time
  INTO v_shift_conflict
  FROM public.operator_machine_assignments oma
  JOIN public.users u ON u.id = oma.operator_id
  WHERE oma.machine_id  = p_machine_id
    AND oma.is_active   = true
    AND oma.operator_id <> p_operator_id
    AND public.do_shifts_overlap(oma.shift_start_time, oma.shift_end_time, v_shift_start, v_shift_end)
  LIMIT 1;

  IF v_shift_conflict.id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'MACHINE_SHIFT_OCCUPIED',
      'error', format('Machine is already operated by %s during this shift window (%s - %s).',
        v_shift_conflict.operator_name,
        v_shift_conflict.shift_start_time::text,
        v_shift_conflict.shift_end_time::text));
  END IF;

  -- 11. Insert Assignment — now stamps valid_from = today IST; valid_to = NULL (carry-forward)
  INSERT INTO public.operator_machine_assignments (
    machine_id, operator_id,
    shift_start_time, shift_end_time,
    shift_code, is_active,
    assigned_by, assigned_at,
    valid_from, valid_to,
    created_at, updated_at
  )
  VALUES (
    p_machine_id, p_operator_id,
    v_shift_start, v_shift_end,
    v_shift_code, true,
    v_caller_id, NOW(),
    v_today_ist, NULL,       -- carry-forward from today
    NOW(), NOW()
  )
  RETURNING id INTO v_new_assignment_id;

  -- 12. Audit Logging
  v_audit_meta := jsonb_build_object(
    'assignmentId',   v_new_assignment_id,
    'machineId',      p_machine_id,
    'machineCode',    v_machine.machine_id,
    'operatorId',     p_operator_id,
    'operatorName',   v_operator.full_name,
    'shiftCode',      v_shift_code,
    'shiftStartTime', v_shift_start,
    'shiftEndTime',   v_shift_end,
    'validFrom',      v_today_ist,
    'validTo',        NULL,
    'assignedBy',     v_caller_id,
    'assignedAt',     NOW()
  );

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata, details, created_at)
  VALUES (
    v_caller_id,
    'machine.operator_assigned',
    'operator_machine_assignment',
    v_new_assignment_id,
    v_audit_meta, v_audit_meta,
    NOW()
  );

  RETURN jsonb_build_object(
    'success',          true,
    'assignment_id',    v_new_assignment_id,
    'machine_id',       p_machine_id,
    'operator_id',      p_operator_id,
    'shift_code',       v_shift_code,
    'shift_start_time', v_shift_start,
    'shift_end_time',   v_shift_end,
    'valid_from',       v_today_ist,
    'valid_to',         NULL,
    'is_active',        true,
    'assigned_by',      v_caller_id
  );
END;
$$;

-- ============================================================
-- 4. Update submit_operator_hour_log_atomic to:
--    a) Resolve assignment_id by range (valid_from <= log_date <= valid_to/open) instead of is_active
--    b) Stamp assignment_id on the new MHL row
--    c) Fix ROOT-03: 7-day window uses IST date, not UTC CURRENT_DATE
--    d) Remove Step 17 retroactive shift_code mutation on OMA
--    All 25 existing parameters preserved; zero callers broken.
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
  IF v_entry_source = 'operator' THEN
    IF NOT public.check_user_can_access_machine(p_machine_id, p_operator_id) THEN
      RAISE EXCEPTION 'Operator is not authorized to submit shift logs for this equipment. You must be assigned to the machine to submit logs.'
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
  v_today_ist  := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
  v_log_date   := COALESCE(p_log_date, v_today_ist);
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

  -- 15. Insert into machine_hour_logs — now includes assignment_id
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

  -- Step 17 (REMOVED): No longer retroactively mutates shift_code on OMA.
  --   The assignment carries its shift_code at time of creation. Logs link to assignments
  --   via assignment_id; shift identity is preserved historically without mutation.

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
