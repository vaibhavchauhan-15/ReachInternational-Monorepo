-- ==============================================================================
-- Migration 047: Operator–Machine Assignments, Shift Timings & Overtime Conflict Resolution
-- 1. Creates public.operator_machine_assignments table for authoritative multi-shift assignments
-- 2. Creates helper function shift_to_ranges (0-1440 circular minute mapping)
-- 3. Creates public.operator_shift_ranges table with GiST exclusion constraint
-- 4. Triggers: Capacity guard (max 3), Range sync, and machines personnel array mirror
-- 5. Extends public.machine_hour_logs with overtime conflict tracking fields
-- 6. Atomic RPCs: assign_operator_machine_atomic, end_operator_machine_assignment_atomic, resolve_hour_log_conflict_atomic
-- 7. Updates submit_operator_hour_log_atomic to soft-flag overtime assignment overlaps
-- 8. Configures Row Level Security (RLS) policies
-- Note: Historical assignment backfill is decoupled into standalone script:
--       supabase/scripts/047_backfill_operator_assignments.sql
-- ==============================================================================

-- 1. Ensure btree_gist extension is available for scalar UUIDs in GiST exclusion
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2. Create Authoritative Assignments Table
CREATE TABLE IF NOT EXISTS public.operator_machine_assignments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id          UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  operator_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  shift_start_time    TIME NOT NULL,
  shift_end_time      TIME NOT NULL,
  crosses_midnight    BOOLEAN GENERATED ALWAYS AS (shift_end_time < shift_start_time) STORED,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  assigned_by         UUID NOT NULL REFERENCES public.users(id),
  assigned_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at            TIMESTAMPTZ,
  ended_by            UUID REFERENCES public.users(id),
  end_reason          TEXT CHECK (end_reason IS NULL OR end_reason IN ('reassigned', 'removed', 'shift_changed', 'migrated')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_shift_not_equal CHECK (shift_start_time <> shift_end_time),
  CONSTRAINT chk_active_has_no_end CHECK (
    (is_active = true  AND ended_at IS NULL) OR
    (is_active = false AND ended_at IS NOT NULL)
  )
);

-- Partial performance indexes for active assignment lookups
CREATE INDEX IF NOT EXISTS idx_oma_operator_active ON public.operator_machine_assignments(operator_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_oma_machine_active ON public.operator_machine_assignments(machine_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_oma_created_at ON public.operator_machine_assignments(created_at DESC);

-- 3. Circular 0-1440 Minute Range Mapping Function
CREATE OR REPLACE FUNCTION public.shift_to_ranges(p_start TIME, p_end TIME)
RETURNS int4range[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_end > p_start THEN
      ARRAY[
        int4range(
          (EXTRACT(HOUR FROM p_start)*60 + EXTRACT(MINUTE FROM p_start))::int,
          (EXTRACT(HOUR FROM p_end)*60   + EXTRACT(MINUTE FROM p_end))::int,
          '[)'
        )
      ]
    ELSE -- crosses midnight: split into [start, 1440) and [0, end)
      ARRAY[
        int4range(
          (EXTRACT(HOUR FROM p_start)*60 + EXTRACT(MINUTE FROM p_start))::int,
          1440, '[)'
        ),
        int4range(
          0,
          (EXTRACT(HOUR FROM p_end)*60 + EXTRACT(MINUTE FROM p_end))::int,
          '[)'
        )
      ]
  END;
$$;

-- 4. Normalized Shift Ranges Table with GiST Exclusion Constraint
CREATE TABLE IF NOT EXISTS public.operator_shift_ranges (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.operator_machine_assignments(id) ON DELETE CASCADE,
  operator_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  minute_range  int4range NOT NULL,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  EXCLUDE USING GIST (operator_id WITH =, minute_range WITH &&) WHERE (is_active)
);

CREATE INDEX IF NOT EXISTS idx_osr_assignment_id ON public.operator_shift_ranges(assignment_id);

-- 5. Trigger Functions

-- A. Capacity Guard (Max 3 distinct active operators per machine with transaction advisory lock)
CREATE OR REPLACE FUNCTION public.enforce_max_operators_per_machine()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_distinct_operators INT;
  v_already_assigned BOOLEAN;
BEGIN
  IF NEW.is_active THEN
    PERFORM pg_advisory_xact_lock(hashtext('machine_cap_' || NEW.machine_id::text));

    -- Check if this operator already has another active assignment on this machine
    SELECT EXISTS (
      SELECT 1
      FROM public.operator_machine_assignments
      WHERE machine_id = NEW.machine_id
        AND operator_id = NEW.operator_id
        AND is_active = true
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) INTO v_already_assigned;

    -- Count current distinct operators excluding NEW.id
    SELECT COUNT(DISTINCT operator_id) INTO v_distinct_operators
    FROM public.operator_machine_assignments
    WHERE machine_id = NEW.machine_id 
      AND is_active = true 
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

    -- If this is a new distinct operator on this machine and there are already 3 distinct operators
    IF NOT v_already_assigned AND v_distinct_operators >= 3 THEN
      RAISE EXCEPTION 'MAX_OPERATORS_REACHED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_max_operators_per_machine ON public.operator_machine_assignments;
CREATE TRIGGER trg_enforce_max_operators_per_machine
  BEFORE INSERT OR UPDATE ON public.operator_machine_assignments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_max_operators_per_machine();

-- B. Atomically sync shift ranges for GiST exclusion
CREATE OR REPLACE FUNCTION public.sync_operator_shift_ranges()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  r int4range;
  ranges int4range[];
BEGIN
  -- Always purge previous ranges for this assignment to prevent self-collision
  DELETE FROM public.operator_shift_ranges WHERE assignment_id = NEW.id;

  IF NEW.is_active THEN
    ranges := public.shift_to_ranges(NEW.shift_start_time, NEW.shift_end_time);
    FOREACH r IN ARRAY ranges LOOP
      INSERT INTO public.operator_shift_ranges (assignment_id, operator_id, minute_range, is_active)
      VALUES (NEW.id, NEW.operator_id, r, true);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_operator_shift_ranges ON public.operator_machine_assignments;
CREATE TRIGGER trg_sync_operator_shift_ranges
  AFTER INSERT OR UPDATE ON public.operator_machine_assignments
  FOR EACH ROW EXECUTE FUNCTION public.sync_operator_shift_ranges();

-- C. Trigger to sync machines.operator_ids and machines.current_operator_id
CREATE OR REPLACE FUNCTION public.sync_machine_assigned_operators()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_machine_id UUID;
  v_op_ids UUID[];
BEGIN
  v_machine_id := COALESCE(NEW.machine_id, OLD.machine_id);

  SELECT COALESCE(array_agg(operator_id ORDER BY assigned_at ASC), '{}')
  INTO v_op_ids
  FROM public.operator_machine_assignments
  WHERE machine_id = v_machine_id AND is_active = true;

  UPDATE public.machines
  SET operator_ids = v_op_ids,
      current_operator_id = CASE WHEN cardinality(v_op_ids) > 0 THEN v_op_ids[1] ELSE NULL END,
      updated_at = NOW()
  WHERE id = v_machine_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_machine_assigned_operators ON public.operator_machine_assignments;
CREATE TRIGGER trg_sync_machine_assigned_operators
  AFTER INSERT OR UPDATE OR DELETE ON public.operator_machine_assignments
  FOR EACH ROW EXECUTE FUNCTION public.sync_machine_assigned_operators();

-- 6. Extend public.machine_hour_logs with Overtime Conflict Tracking Columns
ALTER TABLE public.machine_hour_logs
  ADD COLUMN IF NOT EXISTS conflict_flag BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conflict_reason TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS conflict_status TEXT DEFAULT NULL CHECK (conflict_status IS NULL OR conflict_status IN ('pending', 'acknowledged', 'adjusted')),
  ADD COLUMN IF NOT EXISTS conflict_resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conflict_resolved_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS conflict_resolution_notes TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_mhl_unresolved_conflicts 
  ON public.machine_hour_logs(machine_id, log_date DESC) 
  WHERE conflict_flag = true AND conflict_status = 'pending';

-- 7. Atomic RPC: assign_operator_machine_atomic
CREATE OR REPLACE FUNCTION public.assign_operator_machine_atomic(
  p_machine_id UUID,
  p_operator_id UUID,
  p_shift_start TIME DEFAULT NULL,
  p_shift_end TIME DEFAULT NULL,
  p_assigned_by UUID DEFAULT NULL,
  p_shift_start_time TIME DEFAULT NULL,
  p_shift_end_time TIME DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_machine RECORD;
  v_operator RECORD;
  v_existing_active_id UUID;
  v_conflicting_assignment RECORD;
  v_new_assignment_id UUID;
  v_new_assignment RECORD;
  v_audit_meta JSONB;
  v_shift_start TIME;
  v_shift_end TIME;
BEGIN
  v_shift_start := COALESCE(p_shift_start, p_shift_start_time);
  v_shift_end := COALESCE(p_shift_end, p_shift_end_time);

  IF v_shift_start IS NULL OR v_shift_end IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Both shift start and end times must be provided.');
  END IF;

  -- 1. Validate Target Machine Exists
  SELECT id, machine_id, model, serial_number
  INTO v_machine
  FROM public.machines
  WHERE id = p_machine_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Target machine not found.');
  END IF;

  -- 2. Validate Operator Exists & Is Active
  SELECT id, full_name, email, role, status
  INTO v_operator
  FROM public.users
  WHERE id = p_operator_id AND role = 'operator' AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Selected operator is not active or does not exist.');
  END IF;

  -- 3. Validate Shift
  IF v_shift_start = v_shift_end THEN
    RETURN jsonb_build_object('success', false, 'error', 'Shift start time and end time cannot be identical.');
  END IF;

  -- 4. Check if operator is already active on THIS machine with the EXACT same shift
  SELECT id INTO v_existing_active_id
  FROM public.operator_machine_assignments
  WHERE machine_id = p_machine_id 
    AND operator_id = p_operator_id 
    AND shift_start_time = v_shift_start 
    AND shift_end_time = v_shift_end 
    AND is_active = true;

  IF v_existing_active_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', v_operator.full_name || ' is already assigned to this machine on shift ' || v_shift_start::text || ' – ' || v_shift_end::text || '.');
  END IF;

  -- 5. Insert assignment (GiST exclusion and capacity triggers enforce constraints atomically)
  BEGIN
    INSERT INTO public.operator_machine_assignments (
      machine_id,
      operator_id,
      shift_start_time,
      shift_end_time,
      is_active,
      assigned_by,
      assigned_at
    )
    VALUES (
      p_machine_id,
      p_operator_id,
      v_shift_start,
      v_shift_end,
      true,
      p_assigned_by,
      NOW()
    )
    RETURNING * INTO v_new_assignment;

    v_new_assignment_id := v_new_assignment.id;
  EXCEPTION
    WHEN SQLSTATE 'P0001' THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'MAX_OPERATORS_REACHED',
        'error', 'Machine ' || COALESCE(v_machine.machine_id, 'Selected machine') || ' has reached its maximum capacity of 3 active operators.'
      );
    WHEN SQLSTATE '23P01' THEN
      -- Exclusion violation: find the conflicting machine and shift for friendly messaging
      SELECT oma.shift_start_time, oma.shift_end_time, m.machine_id AS conflicting_code
      INTO v_conflicting_assignment
      FROM public.operator_machine_assignments oma
      JOIN public.machines m ON m.id = oma.machine_id
      WHERE oma.operator_id = p_operator_id 
        AND oma.is_active = true
      LIMIT 1;

      RETURN jsonb_build_object(
        'success', false,
        'code', 'SHIFT_OVERLAP_CONFLICT',
        'error', v_operator.full_name || ' is already assigned to ' || 
                 COALESCE(v_conflicting_assignment.conflicting_code, 'another machine') || 
                 ' during an overlapping shift window (' || 
                 COALESCE(v_conflicting_assignment.shift_start_time::text, '') || ' – ' || 
                 COALESCE(v_conflicting_assignment.shift_end_time::text, '') || ').'
      );
  END;

  -- 6. Structured Audit Log
  v_audit_meta := jsonb_build_object(
    'assignmentId', v_new_assignment_id,
    'machineId', p_machine_id,
    'machineCode', v_machine.machine_id,
    'operatorId', p_operator_id,
    'operatorName', v_operator.full_name,
    'shiftStart', v_shift_start,
    'shiftEnd', v_shift_end,
    'crossesMidnight', v_new_assignment.crosses_midnight,
    'notes', p_notes
  );

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
    p_assigned_by,
    'machine.operator_shift_assigned',
    'operator_machine_assignment',
    v_new_assignment_id,
    v_audit_meta,
    v_audit_meta,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_new_assignment_id,
    'machine_id', p_machine_id,
    'operator_id', p_operator_id,
    'shift_start_time', v_shift_start,
    'shift_end_time', v_shift_end
  );
END;
$$;

-- 8. Atomic RPC: end_operator_machine_assignment_atomic
CREATE OR REPLACE FUNCTION public.end_operator_machine_assignment_atomic(
  p_assignment_id UUID,
  p_ended_by UUID,
  p_end_reason TEXT DEFAULT 'removed'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_assignment RECORD;
  v_audit_meta JSONB;
BEGIN
  SELECT oma.*, m.machine_id AS machine_code, u.full_name AS operator_name
  INTO v_assignment
  FROM public.operator_machine_assignments oma
  JOIN public.machines m ON m.id = oma.machine_id
  JOIN public.users u ON u.id = oma.operator_id
  WHERE oma.id = p_assignment_id AND oma.is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Active assignment not found or already ended.');
  END IF;

  UPDATE public.operator_machine_assignments
  SET is_active = false,
      ended_at = NOW(),
      ended_by = p_ended_by,
      end_reason = COALESCE(p_end_reason, 'removed'),
      updated_at = NOW()
  WHERE id = p_assignment_id;

  v_audit_meta := jsonb_build_object(
    'assignmentId', p_assignment_id,
    'machineId', v_assignment.machine_id,
    'machineCode', v_assignment.machine_code,
    'operatorId', v_assignment.operator_id,
    'operatorName', v_assignment.operator_name,
    'endReason', p_end_reason,
    'endedBy', p_ended_by
  );

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
    p_ended_by,
    'machine.operator_assignment_ended',
    'operator_machine_assignment',
    p_assignment_id,
    v_audit_meta,
    v_audit_meta,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', p_assignment_id,
    'machine_id', v_assignment.machine_id,
    'operator_id', v_assignment.operator_id
  );
END;
$$;

-- 9. Atomic RPC: resolve_hour_log_conflict_atomic
CREATE OR REPLACE FUNCTION public.resolve_hour_log_conflict_atomic(
  p_log_id UUID,
  p_action TEXT, -- 'acknowledge' | 'adjust'
  p_resolved_by UUID DEFAULT NULL,
  p_adjusted_end_time TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_resolver_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_log RECORD;
  v_audit_meta JSONB;
  v_resolved_by UUID;
BEGIN
  v_resolved_by := COALESCE(p_resolved_by, p_resolver_id);

  SELECT * INTO v_log
  FROM public.machine_hour_logs
  WHERE id = p_log_id AND conflict_flag = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Flagged conflict log not found.');
  END IF;

  IF p_action = 'acknowledge' THEN
    UPDATE public.machine_hour_logs
    SET conflict_status = 'acknowledged',
        conflict_resolved_by = v_resolved_by,
        conflict_resolved_at = NOW(),
        conflict_resolution_notes = p_notes
    WHERE id = p_log_id;
  ELSIF p_action = 'adjust' THEN
    UPDATE public.machine_hour_logs
    SET conflict_status = 'adjusted',
        conflict_resolved_by = v_resolved_by,
        conflict_resolved_at = NOW(),
        end_time = COALESCE(NULLIF(TRIM(p_adjusted_end_time), '')::TIME, end_time),
        conflict_resolution_notes = p_notes
    WHERE id = p_log_id;
  ELSE
    RETURN jsonb_build_object('success', false, 'error', 'Invalid resolution action. Choose acknowledge or adjust.');
  END IF;

  v_audit_meta := jsonb_build_object(
    'logId', p_log_id,
    'action', p_action,
    'resolvedBy', v_resolved_by,
    'adjustedEndTime', p_adjusted_end_time,
    'notes', p_notes
  );

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
    v_resolved_by,
    'machine_hour_logs.conflict_resolved',
    'machine_hour_logs',
    p_log_id,
    v_audit_meta,
    v_audit_meta,
    NOW()
  );

  RETURN jsonb_build_object('success', true, 'log_id', p_log_id, 'action', p_action);
END;
$$;

-- 10. Update submit_operator_hour_log_atomic to Soft-Flag Overtime Overlaps
CREATE OR REPLACE FUNCTION public.submit_operator_hour_log_atomic(
  p_machine_id UUID,
  p_operator_id UUID,
  p_client_id UUID DEFAULT NULL,
  p_log_date DATE DEFAULT CURRENT_DATE,
  p_start_meter NUMERIC DEFAULT 0,
  p_end_meter NUMERIC DEFAULT 0,
  p_start_time TEXT DEFAULT NULL,
  p_end_time TEXT DEFAULT NULL,
  p_overtime_hours NUMERIC DEFAULT 0,
  p_is_breakdown BOOLEAN DEFAULT FALSE,
  p_shift TEXT DEFAULT NULL,
  p_machine_condition TEXT DEFAULT 'good',
  p_location TEXT DEFAULT NULL,
  p_remarks TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_normal_working_hours NUMERIC DEFAULT 0,
  p_end_date DATE DEFAULT NULL,
  p_start_datetime TIMESTAMPTZ DEFAULT NULL,
  p_end_datetime TIMESTAMPTZ DEFAULT NULL,
  p_breakdown_start_time TEXT DEFAULT NULL,
  p_breakdown_end_time TEXT DEFAULT NULL,
  p_breakdown_duration TEXT DEFAULT NULL,
  p_breakdown_hours NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_log_id UUID;
  v_idempotency_key TEXT;
  v_audit_meta JSONB;
  v_inserted_log RECORD;
  v_resolved_client_id UUID;
  v_resolved_location TEXT;
  v_conflict_flag BOOLEAN := false;
  v_conflict_reason TEXT := NULL;
  v_conflict_status TEXT := NULL;
  v_conflicting_machine RECORD;
  v_log_end_time TIME;
  v_ot_start_time TIME;
  v_ot_ranges int4range[];
BEGIN
  -- 1. Meter Regression Guard
  IF p_end_meter < p_start_meter THEN
    RAISE EXCEPTION 'End meter reading (%) cannot be less than start meter reading (%)', p_end_meter, p_start_meter
      USING ERRCODE = '23514';
  END IF;

  -- 2. Future Shift End Guard
  IF p_end_datetime IS NOT NULL AND p_end_datetime > (NOW() + INTERVAL '1 minute') THEN
    RAISE EXCEPTION 'Cannot log before shift end.'
      USING ERRCODE = '23514';
  END IF;

  -- 3. Idempotency Key
  v_idempotency_key := COALESCE(
    NULLIF(TRIM(p_idempotency_key), ''),
    'ihl_' || replace(gen_random_uuid()::text, '-', '')
  );

  -- 4. Client and Location Resolution
  v_resolved_client_id := p_client_id;
  v_resolved_location := p_location;

  IF v_resolved_client_id IS NULL OR v_resolved_location IS NULL THEN
    SELECT client_id, COALESCE(v_resolved_location, customer_address, city, '')
    INTO v_resolved_client_id, v_resolved_location
    FROM public.machines
    WHERE id = p_machine_id;
  END IF;

  -- 5. Soft Overtime Conflict Detection:
  -- If overtime > 0, check if this operator's overtime tail crosses another active assignment on a different machine
  IF COALESCE(p_overtime_hours, 0) > 0 AND p_end_time IS NOT NULL THEN
    v_log_end_time := NULLIF(TRIM(p_end_time), '')::TIME;
    v_ot_start_time := (v_log_end_time - (p_overtime_hours || ' hours')::interval)::TIME;

    IF v_ot_start_time <> v_log_end_time THEN
      -- Map overtime window to circular 0-1440 int4range[]
      v_ot_ranges := public.shift_to_ranges(v_ot_start_time, v_log_end_time);

      -- Check if any part of the overtime range overlaps with any active shift range of this operator on ANOTHER machine
      SELECT oma.id, m.machine_id AS conflicting_code
      INTO v_conflicting_machine
      FROM public.operator_machine_assignments oma
      JOIN public.machines m ON m.id = oma.machine_id
      JOIN public.operator_shift_ranges osr ON osr.assignment_id = oma.id
      WHERE oma.operator_id = p_operator_id 
        AND oma.machine_id <> p_machine_id 
        AND oma.is_active = true
        AND osr.is_active = true
        AND EXISTS (
          SELECT 1 
          FROM unnest(v_ot_ranges) AS ot_r 
          WHERE ot_r && osr.minute_range
        )
      LIMIT 1;

      IF v_conflicting_machine.id IS NOT NULL THEN
        v_conflict_flag := true;
        v_conflict_status := 'pending';
        v_conflict_reason := 'overtime_overlaps_assignment:' || COALESCE(v_conflicting_machine.conflicting_code, 'other_machine');
      END IF;
    END IF;
  END IF;

  -- 6. Insert into machine_hour_logs
  INSERT INTO public.machine_hour_logs (
    machine_id,
    operator_id,
    client_id,
    log_date,
    end_date,
    start_datetime,
    end_datetime,
    start_meter,
    end_meter,
    start_time,
    end_time,
    overtime_hours,
    normal_working_hours,
    is_breakdown,
    breakdown_start_time,
    breakdown_end_time,
    breakdown_duration,
    breakdown_hours,
    shift,
    machine_condition,
    location,
    remarks,
    idempotency_key,
    conflict_flag,
    conflict_reason,
    conflict_status
  )
  VALUES (
    p_machine_id,
    p_operator_id,
    v_resolved_client_id,
    p_log_date,
    p_end_date,
    p_start_datetime,
    p_end_datetime,
    p_start_meter,
    p_end_meter,
    NULLIF(TRIM(p_start_time), '')::TIME,
    NULLIF(TRIM(p_end_time), '')::TIME,
    COALESCE(p_overtime_hours, 0),
    COALESCE(p_normal_working_hours, 0),
    COALESCE(p_is_breakdown, false),
    NULLIF(TRIM(p_breakdown_start_time), '')::TIME,
    NULLIF(TRIM(p_breakdown_end_time), '')::TIME,
    p_breakdown_duration,
    COALESCE(p_breakdown_hours, 0),
    p_shift,
    COALESCE(p_machine_condition, 'good'),
    v_resolved_location,
    p_remarks,
    v_idempotency_key,
    v_conflict_flag,
    v_conflict_reason,
    v_conflict_status
  )
  RETURNING * INTO v_inserted_log;

  v_log_id := v_inserted_log.id;

  -- 7. Update Machine Current Meter & Health Status
  IF p_machine_condition = 'breakdown' OR p_is_breakdown = true THEN
    UPDATE public.machines
    SET
      hour_meter = p_end_meter,
      health_status = 'breakdown',
      updated_at = NOW()
    WHERE id = p_machine_id;
  ELSE
    UPDATE public.machines
    SET
      hour_meter = p_end_meter,
      health_status = 'active',
      updated_at = NOW()
    WHERE id = p_machine_id;
  END IF;

  -- 8. Structured Audit Log
  v_audit_meta := jsonb_build_object(
    'action', 'operator_hour_log_submitted',
    'log_id', v_log_id,
    'machine_id', p_machine_id,
    'operator_id', p_operator_id,
    'client_id', v_resolved_client_id,
    'meter_progression', p_start_meter || ' -> ' || p_end_meter,
    'condition', p_machine_condition,
    'is_breakdown', p_is_breakdown,
    'breakdown_duration', p_breakdown_duration,
    'shift_interval', p_start_time || ' -> ' || p_end_time,
    'idempotency_key', v_idempotency_key,
    'conflict_flag', v_conflict_flag,
    'conflict_reason', v_conflict_reason
  );

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
    p_operator_id,
    'machine.hour_logged',
    'machine_hour_logs',
    v_log_id::text,
    v_audit_meta,
    v_audit_meta,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'log_id', v_log_id,
    'machine_id', p_machine_id,
    'operator_id', p_operator_id,
    'start_meter', p_start_meter,
    'end_meter', p_end_meter,
    'is_breakdown', p_is_breakdown,
    'breakdown_duration', p_breakdown_duration,
    'conflict_flag', v_conflict_flag,
    'conflict_reason', v_conflict_reason
  );
END;
$$;

-- 11. Row Level Security Policies
ALTER TABLE public.operator_machine_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_shift_ranges ENABLE ROW LEVEL SECURITY;

-- Assignments: Select
DROP POLICY IF EXISTS "oma_select_policy" ON public.operator_machine_assignments;
CREATE POLICY "oma_select_policy" ON public.operator_machine_assignments
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('super_admin', 'admin', 'manager', 'service_manager', 'supervisor')
    OR operator_id = auth.uid()
  );

-- Assignments: Insert / Update
DROP POLICY IF EXISTS "oma_manage_policy" ON public.operator_machine_assignments;
CREATE POLICY "oma_manage_policy" ON public.operator_machine_assignments
  FOR ALL TO authenticated
  USING (
    public.current_user_role() IN ('super_admin', 'admin', 'manager', 'service_manager', 'supervisor')
  )
  WITH CHECK (
    public.current_user_role() IN ('super_admin', 'admin', 'manager', 'service_manager', 'supervisor')
  );

-- Shift Ranges: Select
DROP POLICY IF EXISTS "osr_select_policy" ON public.operator_shift_ranges;
CREATE POLICY "osr_select_policy" ON public.operator_shift_ranges
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() IN ('super_admin', 'admin', 'manager', 'service_manager', 'supervisor')
    OR operator_id = auth.uid()
  );

-- Shift Ranges: Managed via trigger (security definer), allow admin/manager fallback
DROP POLICY IF EXISTS "osr_manage_policy" ON public.operator_shift_ranges;
CREATE POLICY "osr_manage_policy" ON public.operator_shift_ranges
  FOR ALL TO authenticated
  USING (
    public.current_user_role() IN ('super_admin', 'admin', 'manager', 'service_manager', 'supervisor')
  )
  WITH CHECK (
    public.current_user_role() IN ('super_admin', 'admin', 'manager', 'service_manager', 'supervisor')
  );

-- Note: Step 12 (Data Backfill) has been intentionally decoupled from this migration file.
-- To review and execute the backfill with dry-run reporting mode, execute:
--   supabase/scripts/047_backfill_operator_assignments.sql

