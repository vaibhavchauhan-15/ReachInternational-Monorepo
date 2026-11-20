-- Migration 223: Fix Operator Shift Assignment Overlap & Machine Roster Resilience
-- Addresses:
--   1. Drops existing function signature explicitly to avoid PostgreSQL 42P13
--      ("cannot change name of input parameter") errors when upgrading.
--   2. Exclusion constraint oma_no_active_operator_shift_overlap previously included inactive/ended
--      assignments (WHERE is_active = true OR valid_to IS NULL OR valid_from < valid_to) with closed
--      '[]' bounds. When an assignment ended today (valid_to = today) and a new assignment was created
--      today (valid_from = today), PostgreSQL raised 23P01 (exclusion_violation) because both ranges
--      included today's date. Scopes the constraint strictly to active assignments (WHERE is_active = true)
--      and normalizes shift codes uniformly.
--   3. shift_to_ranges(TIME, TIME) returned unbounded ranges spanning the entire 24h day when either
--      time was NULL, causing do_shifts_overlap() to return TRUE on NULL inputs. Adds explicit NULL guards.
--   4. Cleans and resyncs operator_shift_ranges table to eliminate any legacy orphaned/unbounded ranges.
--   5. Re-creates public.save_machine_roster_atomic() RPC with canonical parameter names:
--      (p_machine_id, p_operators, p_supervisor_ids, p_activate_machine, p_caller_id)
--      - Uniform shift code normalization: regexp_replace(shift_code, '^shift\s*', '', 'i')
--      - Intelligent re-activation of assignments ended today, preventing collision and duplicate history
--      - Informative collision errors identifying the conflicting machine code and shift timings
--      - Immediate PostgREST schema cache reload via NOTIFY pgrst
--   6. Hardens public.assign_operator_machine_atomic() with identical shift normalization and re-activation resilience.

-- ==============================================================================
-- 1. Prerequisites: Immutable Range Helper Functions with NULL Guards
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.shift_to_ranges(p_start TIME, p_end TIME)
RETURNS int4range[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_start IS NULL OR p_end IS NULL THEN
      ARRAY[]::int4range[]
    WHEN p_end > p_start THEN
      ARRAY[
        int4range(
          (EXTRACT(HOUR FROM p_start)*60 + EXTRACT(MINUTE FROM p_start))::int,
          (EXTRACT(HOUR FROM p_end)*60   + EXTRACT(MINUTE FROM p_end))::int,
          '[)'
        )
      ]
    ELSE
      ARRAY[
        int4range((EXTRACT(HOUR FROM p_start)*60 + EXTRACT(MINUTE FROM p_start))::int, 1440, '[)'),
        int4range(0, (EXTRACT(HOUR FROM p_end)*60 + EXTRACT(MINUTE FROM p_end))::int, '[)')
      ]
  END;
$$;

GRANT EXECUTE ON FUNCTION public.shift_to_ranges(TIME, TIME) TO authenticated, service_role, anon;

CREATE OR REPLACE FUNCTION public.do_shifts_overlap(
  p_start1 TIME,
  p_end1 TIME,
  p_start2 TIME,
  p_end2 TIME
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_start1 IS NULL OR p_end1 IS NULL OR p_start2 IS NULL OR p_end2 IS NULL THEN
      FALSE
    ELSE
      EXISTS (
        SELECT 1
        FROM unnest(public.shift_to_ranges(p_start1, p_end1)) r1,
             unnest(public.shift_to_ranges(p_start2, p_end2)) r2
        WHERE r1 && r2
      )
  END;
$$;

GRANT EXECUTE ON FUNCTION public.do_shifts_overlap(TIME, TIME, TIME, TIME) TO authenticated, service_role, anon;

-- ==============================================================================
-- 2. Harden Exclusion Constraint on operator_machine_assignments
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'oma_no_active_operator_shift_overlap'
  ) THEN
    ALTER TABLE public.operator_machine_assignments
      DROP CONSTRAINT oma_no_active_operator_shift_overlap;
  END IF;

  ALTER TABLE public.operator_machine_assignments
    ADD CONSTRAINT oma_no_active_operator_shift_overlap
    EXCLUDE USING gist (
      operator_id WITH =,
      lower(trim(regexp_replace(shift_code, '^shift\s*', '', 'i'))) WITH =,
      daterange(valid_from, COALESCE(valid_to, '9999-12-31'::date), '[]') WITH &&
    )
    WHERE (is_active = true);
END $$;

-- ==============================================================================
-- 3. Clean and Resync operator_shift_ranges Table
-- ==============================================================================
DELETE FROM public.operator_shift_ranges osr
WHERE osr.assignment_id NOT IN (
  SELECT oma.id FROM public.operator_machine_assignments oma WHERE oma.is_active = true
);

DELETE FROM public.operator_shift_ranges;
INSERT INTO public.operator_shift_ranges (assignment_id, operator_id, machine_id, minute_range, is_active)
SELECT oma.id, oma.operator_id, oma.machine_id, r, true
FROM public.operator_machine_assignments oma,
     LATERAL unnest(public.shift_to_ranges(oma.shift_start_time, oma.shift_end_time)) r
WHERE oma.is_active = true
  AND oma.shift_start_time IS NOT NULL
  AND oma.shift_end_time IS NOT NULL;

-- ==============================================================================
-- 4. Production-Grade save_machine_roster_atomic() RPC
-- ==============================================================================
-- Explicit DROP avoids PostgreSQL 42P13 ("cannot change name of input parameter")
DROP FUNCTION IF EXISTS public.save_machine_roster_atomic(UUID, JSONB, UUID[], BOOLEAN, UUID);

CREATE OR REPLACE FUNCTION public.save_machine_roster_atomic(
  p_machine_id        UUID,
  p_operators         JSONB    DEFAULT NULL,
  p_supervisor_ids    UUID[]   DEFAULT NULL,
  p_activate_machine  BOOLEAN  DEFAULT FALSE,
  p_caller_id         UUID     DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_id          UUID;
  v_caller_role        TEXT;
  v_machine            RECORD;
  v_today_ist          DATE;
  v_yesterday_ist      DATE;
  v_op_elem            JSONB;
  v_op_id              UUID;
  v_shift_code         TEXT;
  v_shift_code_norm    TEXT;
  v_shift_start        TIME;
  v_shift_end          TIME;
  v_notes              TEXT;
  v_csc_record         RECORD;
  v_user_record        RECORD;
  v_has_log_today      BOOLEAN;
  v_close_date         DATE;
  v_new_assignment_id  UUID;
  v_ended_today_id     UUID;
  v_unique_op_ids      UUID[] := '{}';
  v_final_sups         UUID[];
  v_supervisors_json   JSONB  := '[]'::jsonb;
  v_operators_json     JSONB  := '[]'::jsonb;
  v_op_count_here      INT;
  v_op_count_other     INT;
  v_other_assignment   RECORD;
  v_existing_ass       RECORD;
  v_curr               RECORD;
  v_seen_shifts        TEXT[] := '{}';
  v_normalized_ops     JSONB  := '[]'::jsonb;
  v_idx                INT;
  v_jdx                INT;
  v_op1                JSONB;
  v_op2                JSONB;
BEGIN
  -- 1. Advisory concurrency lock on the machine
  PERFORM pg_advisory_xact_lock(hashtext('oma_mach_' || p_machine_id::text));

  -- 2. Resolve caller & role
  IF auth.uid() IS NOT NULL THEN
    v_caller_id := auth.uid();
  ELSIF (auth.role() = 'service_role' OR current_setting('request.jwt.claim.role', true) = 'service_role') THEN
    v_caller_id := p_caller_id;
  ELSE
    v_caller_id := p_caller_id;
  END IF;

  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'UNAUTHENTICATED',
      'error', 'Authentication required to update machine personnel roster.'
    );
  END IF;

  SELECT role INTO v_caller_role FROM public.users WHERE id = v_caller_id;
  IF v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'supervisor') THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'FORBIDDEN',
      'error', 'Insufficient permissions: Only managers, supervisors, and admins can assign machinery personnel.'
    );
  END IF;

  -- 3. Lock machine record
  SELECT id, machine_id, model, serial_number, client_id, current_supervisor_id, supervisor_ids, status, health_status, operator_ids
  INTO v_machine
  FROM public.machines
  WHERE id = p_machine_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'MACHINE_NOT_FOUND',
      'error', 'Target machine not found.'
    );
  END IF;

  IF v_machine.status = 'decommissioned' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'MACHINE_DECOMMISSIONED',
      'error', 'Cannot assign personnel to decommissioned machinery.'
    );
  END IF;

  -- Supervisor scope validation
  IF v_caller_role = 'supervisor' THEN
    IF p_supervisor_ids IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'FORBIDDEN',
        'error', 'Permission denied: Supervisors cannot reassign machine supervisors.'
      );
    END IF;

    IF v_machine.current_supervisor_id <> v_caller_id
       AND NOT (v_machine.supervisor_ids IS NOT NULL AND v_machine.supervisor_ids @> ARRAY[v_caller_id])
       AND NOT (v_machine.client_id IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.client_supervisors cs
         WHERE cs.client_id = v_machine.client_id AND cs.supervisor_id = v_caller_id
       )) THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'FORBIDDEN',
        'error', 'Permission denied: You do not have supervisory authority over this equipment.'
      );
    END IF;
  END IF;

  v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
  v_yesterday_ist := v_today_ist - 1;

  -- 4. Machine status activation if requested
  IF p_activate_machine THEN
    UPDATE public.machines
    SET health_status = 'active',
        status = CASE WHEN client_id IS NOT NULL THEN 'rented' ELSE 'active' END,
        updated_at = NOW()
    WHERE id = p_machine_id;
    v_machine.health_status := 'active';
    v_machine.status := CASE WHEN v_machine.client_id IS NOT NULL THEN 'rented' ELSE 'active' END;
  END IF;

  -- 5. Machine supervisor assignment if provided
  IF p_supervisor_ids IS NOT NULL AND v_caller_role IN ('super_admin', 'admin', 'manager') THEN
    v_final_sups := p_supervisor_ids;
    UPDATE public.machines
    SET supervisor_ids = v_final_sups,
        current_supervisor_id = v_final_sups[1],
        updated_at = NOW()
    WHERE id = p_machine_id;
    v_machine.supervisor_ids := v_final_sups;
    v_machine.current_supervisor_id := v_final_sups[1];
  ELSE
    v_final_sups := v_machine.supervisor_ids;
  END IF;

  -- 6. Validate operators array length (max 3 shifts per machine)
  IF p_operators IS NOT NULL AND jsonb_typeof(p_operators) = 'array' THEN
    IF jsonb_array_length(p_operators) > 3 THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'MAX_CAPACITY_EXCEEDED',
        'error', 'A machine can have at most 3 assigned shifts for 24h fleet coverage.'
      );
    END IF;

    -- Normalize and validate each operator entry
    FOR v_op_elem IN (SELECT * FROM jsonb_array_elements(p_operators))
    LOOP
      v_op_id := COALESCE(
        NULLIF(v_op_elem->>'operatorId', '')::uuid,
        NULLIF(v_op_elem->>'operator_id', '')::uuid,
        NULLIF(v_op_elem->>'id', '')::uuid
      );

      IF v_op_id IS NULL THEN
        CONTINUE;
      END IF;

      -- Verify user is an active operator
      SELECT id, full_name, email, phone, role, status
      INTO v_user_record
      FROM public.users
      WHERE id = v_op_id;

      IF NOT FOUND OR v_user_record.role <> 'operator' OR v_user_record.status <> 'active' THEN
        RETURN jsonb_build_object(
          'success', false,
          'code', 'INVALID_OPERATOR',
          'error', 'Invalid assignment: Only active users with role "operator" can be assigned to shifts.'
        );
      END IF;

      v_shift_code := TRIM(COALESCE(v_op_elem->>'shiftCode', v_op_elem->>'shift_code', 'S1'));
      v_shift_code_norm := UPPER(TRIM(REGEXP_REPLACE(v_shift_code, '^shift\s*', '', 'i')));
      v_notes := COALESCE(v_op_elem->>'notes', 'Assigned via personnel dialog');

      -- Check duplicate shift codes on this machine
      IF v_shift_code_norm = ANY(v_seen_shifts) THEN
        RETURN jsonb_build_object(
          'success', false,
          'code', 'DUPLICATE_SHIFT_CODE',
          'error', 'Shift ' || v_shift_code || ' is assigned multiple times. Each operator assignment on this machine must have a distinct shift.'
        );
      END IF;
      v_seen_shifts := array_append(v_seen_shifts, v_shift_code_norm);

      -- Resolve authoritative client shift timings
      v_shift_start := NULL;
      v_shift_end   := NULL;

      IF v_machine.client_id IS NOT NULL THEN
        SELECT code, start_time, end_time
        INTO v_csc_record
        FROM public.client_shift_codes
        WHERE client_id = v_machine.client_id
          AND is_active = true
          AND (
            UPPER(TRIM(REGEXP_REPLACE(code, '^shift\s*', '', 'i'))) = v_shift_code_norm
            OR UPPER(TRIM(REGEXP_REPLACE(name, '^shift\s*', '', 'i'))) = v_shift_code_norm
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
        IF v_op_elem->>'shiftStartTime' IS NOT NULL AND v_op_elem->>'shiftEndTime' IS NOT NULL THEN
          v_shift_start := (v_op_elem->>'shiftStartTime')::time;
          v_shift_end   := (v_op_elem->>'shiftEndTime')::time;
        ELSIF v_op_elem->>'shift_start_time' IS NOT NULL AND v_op_elem->>'shift_end_time' IS NOT NULL THEN
          v_shift_start := (v_op_elem->>'shift_start_time')::time;
          v_shift_end   := (v_op_elem->>'shift_end_time')::time;
        ELSE
          -- Fallback default shifts
          IF v_shift_code_norm IN ('S1', 'A') THEN
            v_shift_start := '06:00:00'::time;
            v_shift_end   := '14:00:00'::time;
          ELSIF v_shift_code_norm IN ('S2', 'B') THEN
            v_shift_start := '14:00:00'::time;
            v_shift_end   := '22:00:00'::time;
          ELSIF v_shift_code_norm IN ('S3', 'C') THEN
            v_shift_start := '22:00:00'::time;
            v_shift_end   := '06:00:00'::time;
          ELSE
            v_shift_start := '08:00:00'::time;
            v_shift_end   := '16:00:00'::time;
          END IF;
        END IF;
      END IF;

      IF v_shift_start = v_shift_end THEN
        RETURN jsonb_build_object(
          'success', false,
          'code', 'INVALID_SHIFT_INTERVAL',
          'error', 'Shift start and end times cannot be equal for Shift ' || v_shift_code || '.'
        );
      END IF;

      v_normalized_ops := v_normalized_ops || jsonb_build_object(
        'operatorId', v_op_id,
        'operatorName', v_user_record.full_name,
        'shiftCode', v_shift_code,
        'shiftCodeNorm', v_shift_code_norm,
        'shiftStart', v_shift_start,
        'shiftEnd', v_shift_end,
        'notes', v_notes
      );
    END LOOP;

    -- Validate internal shift overlap on this machine
    IF jsonb_array_length(v_normalized_ops) > 1 THEN
      FOR v_idx IN 0 .. (jsonb_array_length(v_normalized_ops) - 2)
      LOOP
        v_op1 := v_normalized_ops->v_idx;
        FOR v_jdx IN (v_idx + 1) .. (jsonb_array_length(v_normalized_ops) - 1)
        LOOP
          v_op2 := v_normalized_ops->v_jdx;
          IF public.do_shifts_overlap(
            (v_op1->>'shiftStart')::time, (v_op1->>'shiftEnd')::time,
            (v_op2->>'shiftStart')::time, (v_op2->>'shiftEnd')::time
          ) THEN
            RETURN jsonb_build_object(
              'success', false,
              'code', 'SHIFT_OVERLAP_CONFLICT',
              'error', 'Shift window overlapping: ' || (v_op1->>'operatorName') || '''s Shift ' || (v_op1->>'shiftCode') || ' (' || to_char((v_op1->>'shiftStart')::time, 'HH12:MI AM') || '–' || to_char((v_op1->>'shiftEnd')::time, 'HH12:MI AM') || ') overlaps with ' || (v_op2->>'operatorName') || '''s Shift ' || (v_op2->>'shiftCode') || ' (' || to_char((v_op2->>'shiftStart')::time, 'HH12:MI AM') || '–' || to_char((v_op2->>'shiftEnd')::time, 'HH12:MI AM') || ').'
            );
          END IF;
        END LOOP;
      END LOOP;
    END IF;

    -- Validate cross-fleet capacity & interval non-overlap
    FOR v_op_elem IN (SELECT * FROM jsonb_array_elements(v_normalized_ops))
    LOOP
      v_op_id := (v_op_elem->>'operatorId')::uuid;
      v_shift_start := (v_op_elem->>'shiftStart')::time;
      v_shift_end := (v_op_elem->>'shiftEnd')::time;
      v_shift_code := v_op_elem->>'shiftCode';

      SELECT COUNT(*) INTO v_op_count_here
      FROM jsonb_array_elements(v_normalized_ops) elem
      WHERE (elem->>'operatorId')::uuid = v_op_id;

      SELECT COUNT(*) INTO v_op_count_other
      FROM public.operator_machine_assignments oma
      WHERE oma.operator_id = v_op_id
        AND oma.machine_id <> p_machine_id
        AND oma.is_active = true
        AND oma.valid_from <= v_today_ist
        AND (oma.valid_to IS NULL OR oma.valid_to >= v_today_ist);

      IF (v_op_count_here + v_op_count_other) > 3 THEN
        RETURN jsonb_build_object(
          'success', false,
          'code', 'OPERATOR_CAPACITY_EXCEEDED',
          'error', (v_op_elem->>'operatorName') || ' is already assigned to ' || v_op_count_other || ' active shift(s) on other machines. Maximum 3 shifts (24h) allowed per operator.'
        );
      END IF;

      FOR v_other_assignment IN (
        SELECT oma.shift_code, oma.shift_start_time, oma.shift_end_time, m.machine_id AS other_machine_code
        FROM public.operator_machine_assignments oma
        JOIN public.machines m ON m.id = oma.machine_id
        WHERE oma.operator_id = v_op_id
          AND oma.machine_id <> p_machine_id
          AND oma.is_active = true
          AND oma.valid_from <= v_today_ist
          AND (oma.valid_to IS NULL OR oma.valid_to >= v_today_ist)
      )
      LOOP
        IF public.do_shifts_overlap(
          v_shift_start, v_shift_end,
          v_other_assignment.shift_start_time, v_other_assignment.shift_end_time
        ) THEN
          RETURN jsonb_build_object(
            'success', false,
            'code', 'SHIFT_OVERLAP_CONFLICT',
            'error', format('%s''s Shift %s (%s–%s) collides with active shift on %s (%s–%s). Please relieve them from %s before assigning them to this machine.',
              v_op_elem->>'operatorName',
              v_shift_code,
              to_char(v_shift_start, 'HH12:MI AM'),
              to_char(v_shift_end, 'HH12:MI AM'),
              COALESCE(v_other_assignment.other_machine_code, 'another machine'),
              to_char(v_other_assignment.shift_start_time, 'HH12:MI AM'),
              to_char(v_other_assignment.shift_end_time, 'HH12:MI AM'),
              COALESCE(v_other_assignment.other_machine_code, 'the other unit')
            )
          );
        END IF;
      END LOOP;
    END LOOP;

    -- 7. RECONCILIATION: Relieve removed assignments
    FOR v_curr IN (
      SELECT id, operator_id, shift_code, valid_from
      FROM public.operator_machine_assignments
      WHERE machine_id = p_machine_id
        AND is_active = true
        AND valid_from <= v_today_ist
        AND (valid_to IS NULL OR valid_to >= v_today_ist)
    )
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_normalized_ops) elem
        WHERE (elem->>'operatorId')::uuid = v_curr.operator_id
          AND UPPER(TRIM(REGEXP_REPLACE(elem->>'shiftCode', '^shift\s*', '', 'i'))) = UPPER(TRIM(REGEXP_REPLACE(v_curr.shift_code, '^shift\s*', '', 'i')))
      ) THEN
        SELECT EXISTS (
          SELECT 1 FROM public.machine_hour_logs
          WHERE assignment_id = v_curr.id AND log_date = v_today_ist
        ) INTO v_has_log_today;

        IF v_curr.valid_from < v_today_ist AND NOT v_has_log_today THEN
          v_close_date := v_yesterday_ist;
        ELSE
          v_close_date := v_today_ist;
        END IF;

        UPDATE public.operator_machine_assignments
        SET valid_to = v_close_date,
            is_active = false,
            ended_at = NOW(),
            ended_by = v_caller_id,
            end_reason = 'removed',
            updated_at = NOW()
        WHERE id = v_curr.id;

        INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata, details, created_at)
        VALUES (
          v_caller_id,
          'assignment.range_ended',
          'operator_machine_assignment',
          v_curr.id,
          jsonb_build_object(
            'assignmentId', v_curr.id,
            'operatorId', v_curr.operator_id,
            'machineId', p_machine_id,
            'shiftCode', v_curr.shift_code,
            'validFrom', v_curr.valid_from,
            'validTo', v_close_date,
            'endReason', 'removed'
          ),
          jsonb_build_object(
            'assignmentId', v_curr.id,
            'operatorId', v_curr.operator_id,
            'machineId', p_machine_id,
            'shiftCode', v_curr.shift_code,
            'validFrom', v_curr.valid_from,
            'validTo', v_close_date,
            'endReason', 'removed'
          ),
          NOW()
        );
      END IF;
    END LOOP;

    -- 8. RECONCILIATION: Activate or update target assignments
    FOR v_op_elem IN (SELECT * FROM jsonb_array_elements(v_normalized_ops))
    LOOP
      v_op_id := (v_op_elem->>'operatorId')::uuid;
      v_shift_code := v_op_elem->>'shiftCode';
      v_shift_code_norm := v_op_elem->>'shiftCodeNorm';
      v_shift_start := (v_op_elem->>'shiftStart')::time;
      v_shift_end := (v_op_elem->>'shiftEnd')::time;
      v_notes := v_op_elem->>'notes';

      IF NOT (v_op_id = ANY(v_unique_op_ids)) THEN
        v_unique_op_ids := array_append(v_unique_op_ids, v_op_id);
      END IF;

      SELECT id, shift_start_time, shift_end_time
      INTO v_existing_ass
      FROM public.operator_machine_assignments
      WHERE machine_id = p_machine_id
        AND operator_id = v_op_id
        AND UPPER(TRIM(REGEXP_REPLACE(shift_code, '^shift\s*', '', 'i'))) = v_shift_code_norm
        AND is_active = true
        AND valid_from <= v_today_ist
        AND (valid_to IS NULL OR valid_to >= v_today_ist)
      LIMIT 1;

      IF v_existing_ass.id IS NOT NULL THEN
        IF v_existing_ass.shift_start_time <> v_shift_start OR v_existing_ass.shift_end_time <> v_shift_end THEN
          UPDATE public.operator_machine_assignments
          SET shift_start_time = v_shift_start,
              shift_end_time = v_shift_end,
              notes = v_notes,
              updated_at = NOW()
          WHERE id = v_existing_ass.id;
        END IF;
      ELSE
        -- Check if there is an assignment ended today that can be safely reactivated
        SELECT id INTO v_ended_today_id
        FROM public.operator_machine_assignments
        WHERE machine_id = p_machine_id
          AND operator_id = v_op_id
          AND UPPER(TRIM(REGEXP_REPLACE(shift_code, '^shift\s*', '', 'i'))) = v_shift_code_norm
          AND is_active = false
          AND (valid_to = v_today_ist OR (ended_at AT TIME ZONE 'Asia/Kolkata')::date = v_today_ist)
        ORDER BY updated_at DESC
        LIMIT 1;

        IF v_ended_today_id IS NOT NULL THEN
          UPDATE public.operator_machine_assignments
          SET is_active = true,
              valid_to = NULL,
              ended_at = NULL,
              ended_by = NULL,
              end_reason = NULL,
              shift_start_time = v_shift_start,
              shift_end_time = v_shift_end,
              shift_code = v_shift_code,
              notes = v_notes,
              updated_at = NOW()
          WHERE id = v_ended_today_id;
        ELSE
          INSERT INTO public.operator_machine_assignments (
            machine_id,
            operator_id,
            shift_code,
            shift_start_time,
            shift_end_time,
            is_active,
            assigned_by,
            assigned_at,
            valid_from,
            valid_to,
            notes,
            created_at,
            updated_at
          )
          VALUES (
            p_machine_id,
            v_op_id,
            v_shift_code,
            v_shift_start,
            v_shift_end,
            true,
            v_caller_id,
            NOW(),
            v_today_ist,
            NULL,
            v_notes,
            NOW(),
            NOW()
          )
          RETURNING id INTO v_new_assignment_id;

          INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata, details, created_at)
          VALUES (
            v_caller_id,
            'assignment.created',
            'operator_machine_assignment',
            v_new_assignment_id,
            jsonb_build_object(
              'assignmentId', v_new_assignment_id,
              'operatorId', v_op_id,
              'machineId', p_machine_id,
              'shiftCode', v_shift_code,
              'validFrom', v_today_ist
            ),
            jsonb_build_object(
              'assignmentId', v_new_assignment_id,
              'operatorId', v_op_id,
              'machineId', p_machine_id,
              'shiftCode', v_shift_code,
              'validFrom', v_today_ist
            ),
            NOW()
          );
        END IF;
      END IF;
    END LOOP;

    -- 9. Update machine record with synchronized operator IDs
    UPDATE public.machines
    SET operator_ids = v_unique_op_ids,
        current_operator_id = v_unique_op_ids[1],
        updated_at = NOW()
    WHERE id = p_machine_id;
  ELSE
    v_unique_op_ids := v_machine.operator_ids;
  END IF;

  -- 10. Assemble and return complete verified snapshot
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', oma.id,
      'operator_id', oma.operator_id,
      'machine_id', oma.machine_id,
      'shift_code', oma.shift_code,
      'shift_name', 'Shift ' || oma.shift_code,
      'shift_start_time', oma.shift_start_time::text,
      'shift_end_time', oma.shift_end_time::text,
      'shift_time', to_char(oma.shift_start_time, 'HH12:MI AM') || ' - ' || to_char(oma.shift_end_time, 'HH12:MI AM'),
      'role', 'operator'
    )
    ORDER BY oma.shift_code
  ), '[]'::jsonb)
  INTO v_operators_json
  FROM public.operator_machine_assignments oma
  JOIN public.users u ON u.id = oma.operator_id
  WHERE oma.machine_id = p_machine_id
    AND oma.is_active = true
    AND oma.valid_from <= v_today_ist
    AND (oma.valid_to IS NULL OR oma.valid_to >= v_today_ist);

  IF v_final_sups IS NOT NULL AND array_length(v_final_sups, 1) > 0 THEN
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', u.id,
        'full_name', u.full_name,
        'employee_id', u.employee_id,
        'phone', u.phone,
        'email', u.email,
        'role', u.role
      )
    ), '[]'::jsonb)
    INTO v_supervisors_json
    FROM public.users u
    WHERE u.id = ANY(v_final_sups);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'machine_id', p_machine_id,
    'health_status', v_machine.health_status,
    'status', v_machine.status,
    'operator_ids', v_unique_op_ids,
    'current_operator_id', v_unique_op_ids[1],
    'operators', v_operators_json,
    'supervisor_ids', v_final_sups,
    'current_supervisor_id', v_final_sups[1],
    'supervisors', v_supervisors_json
  );

EXCEPTION
  WHEN SQLSTATE '23P01' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'SHIFT_OVERLAP_CONFLICT',
      'error', 'Shift window overlapping error: The selected shift timings overlap with an existing active assignment for this operator or machine.'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', SQLSTATE,
      'error', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_machine_roster_atomic(UUID, JSONB, UUID[], BOOLEAN, UUID) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.save_machine_roster_atomic(UUID, JSONB, UUID[], BOOLEAN, UUID) FROM anon, public;

-- ==============================================================================
-- 5. Harden assign_operator_machine_atomic()
-- ==============================================================================
DROP FUNCTION IF EXISTS public.assign_operator_machine_atomic(
  UUID, UUID, TIME, TIME, UUID, TIME, TIME, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION public.assign_operator_machine_atomic(
  p_machine_id UUID,
  p_operator_id UUID,
  p_shift_start TIME DEFAULT NULL,
  p_shift_end TIME DEFAULT NULL,
  p_assigned_by UUID DEFAULT NULL,
  p_shift_start_time TIME DEFAULT NULL,
  p_shift_end_time TIME DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_shift_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_machine RECORD;
  v_operator RECORD;
  v_assigned_by_user RECORD;
  v_existing_same_shift RECORD;
  v_operator_active_count INT;
  v_machine_active_count INT;
  v_shift_conflict RECORD;
  v_overlap_conflict RECORD;
  v_new_assignment_id UUID;
  v_new_assignment RECORD;
  v_audit_meta JSONB;
  v_shift_start TIME;
  v_shift_end TIME;
  v_raw_shift_code TEXT;
  v_shift_code TEXT;
  v_assigned_by UUID;
  v_csc_record RECORD;
  v_ended_today_id UUID;
  v_today_ist DATE;
BEGIN
  v_today_ist := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;

  PERFORM pg_advisory_xact_lock(hashtext('oma_op_' || p_operator_id::text));
  PERFORM pg_advisory_xact_lock(hashtext('oma_mach_' || p_machine_id::text));

  v_shift_start := COALESCE(p_shift_start, p_shift_start_time);
  v_shift_end := COALESCE(p_shift_end, p_shift_end_time);
  v_raw_shift_code := NULLIF(TRIM(p_shift_code), '');
  v_shift_code := CASE 
    WHEN v_raw_shift_code IS NOT NULL 
    THEN lower(trim(regexp_replace(v_raw_shift_code, '^shift\s*', '', 'i')))
    ELSE NULL
  END;

  v_assigned_by := COALESCE(
    p_assigned_by,
    auth.uid(),
    (SELECT id FROM public.users WHERE role IN ('admin', 'super_admin') LIMIT 1),
    p_operator_id
  );

  SELECT id, machine_id, model, serial_number, client_id, status, health_status
  INTO v_machine
  FROM public.machines
  WHERE id = p_machine_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'MACHINE_NOT_FOUND', 'error', 'Target machine not found.');
  END IF;

  IF v_machine.client_id IS NOT NULL AND v_raw_shift_code IS NOT NULL THEN
    SELECT code, start_time, end_time
    INTO v_csc_record
    FROM public.client_shift_codes
    WHERE client_id = v_machine.client_id
      AND is_active = true
      AND (
        lower(trim(code)) = lower(trim(v_raw_shift_code))
        OR lower(trim(name)) = lower(trim(v_raw_shift_code))
        OR lower(trim(regexp_replace(code, '^shift\s*', '', 'i'))) = v_shift_code
      )
    ORDER BY display_order ASC
    LIMIT 1;

    IF v_csc_record.code IS NOT NULL THEN
      v_raw_shift_code := v_csc_record.code;
      v_shift_code := lower(trim(regexp_replace(v_csc_record.code, '^shift\s*', '', 'i')));
      v_shift_start := COALESCE(v_shift_start, v_csc_record.start_time);
      v_shift_end := COALESCE(v_shift_end, v_csc_record.end_time);
    END IF;
  END IF;

  IF v_shift_start IS NULL OR v_shift_end IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'VALIDATION_ERROR', 'error', 'Both shift start and end times must be provided or configured for this shift.');
  END IF;

  SELECT id, full_name, email, role, status
  INTO v_operator
  FROM public.users
  WHERE id = p_operator_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'OPERATOR_NOT_FOUND', 'error', 'Assigned user does not exist.');
  END IF;

  IF v_operator.status <> 'active' THEN
    RETURN jsonb_build_object('success', false, 'code', 'OPERATOR_INACTIVE', 'error', 'Cannot assign inactive operator ' || COALESCE(v_operator.full_name, '') || '.');
  END IF;

  SELECT id, full_name
  INTO v_assigned_by_user
  FROM public.users
  WHERE id = v_assigned_by;

  IF v_shift_start = v_shift_end THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_SHIFT_HOURS', 'error', 'Shift start time and end time cannot be identical.');
  END IF;

  SELECT id, machine_id, shift_start_time, shift_end_time, shift_code
  INTO v_existing_same_shift
  FROM public.operator_machine_assignments
  WHERE operator_id = p_operator_id
    AND machine_id = p_machine_id
    AND is_active = true
    AND (
      (v_shift_code IS NOT NULL AND lower(trim(regexp_replace(shift_code, '^shift\s*', '', 'i'))) = v_shift_code)
      OR (v_shift_code IS NULL AND shift_start_time = v_shift_start AND shift_end_time = v_shift_end)
    )
  LIMIT 1;

  IF v_existing_same_shift.id IS NOT NULL THEN
    IF v_existing_same_shift.shift_start_time = v_shift_start
       AND v_existing_same_shift.shift_end_time = v_shift_end THEN
      UPDATE public.operator_machine_assignments
      SET updated_at = NOW(),
          notes = COALESCE(p_notes, notes)
      WHERE id = v_existing_same_shift.id;

      RETURN jsonb_build_object(
        'success', true,
        'assignment_id', v_existing_same_shift.id,
        'machine_id', p_machine_id,
        'operator_id', p_operator_id,
        'shift_code', v_raw_shift_code,
        'shift_start_time', v_shift_start,
        'shift_end_time', v_shift_end,
        'already_active', true
      );
    ELSE
      UPDATE public.operator_machine_assignments
      SET shift_start_time = v_shift_start,
          shift_end_time = v_shift_end,
          notes = COALESCE(p_notes, notes),
          updated_at = NOW()
      WHERE id = v_existing_same_shift.id
      RETURNING * INTO v_new_assignment;

      v_new_assignment_id := v_new_assignment.id;
    END IF;
  END IF;

  IF v_new_assignment_id IS NULL THEN
    SELECT COUNT(*)
    INTO v_operator_active_count
    FROM public.operator_machine_assignments
    WHERE operator_id = p_operator_id
      AND is_active = true;

    IF v_operator_active_count >= 3 THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'MAX_OPERATOR_SHIFTS_REACHED',
        'error', COALESCE(v_operator.full_name, 'Operator') || ' is already assigned to 3 shifts. An operator can be assigned to a maximum of 3 shifts (24h) only.'
      );
    END IF;

    SELECT oma.id, oma.machine_id, m.machine_id AS other_machine_code, oma.shift_code,
           COALESCE(csc.start_time, oma.shift_start_time) AS other_start,
           COALESCE(csc.end_time, oma.shift_end_time) AS other_end
    INTO v_overlap_conflict
    FROM public.operator_machine_assignments oma
    JOIN public.machines m ON m.id = oma.machine_id
    LEFT JOIN public.client_shift_codes csc ON csc.client_id = m.client_id
      AND csc.is_active = true
      AND lower(trim(regexp_replace(csc.code, '^shift\s*', '', 'i'))) = lower(trim(regexp_replace(oma.shift_code, '^shift\s*', '', 'i')))
    WHERE oma.operator_id = p_operator_id
      AND oma.is_active = true
      AND public.do_shifts_overlap(
        v_shift_start,
        v_shift_end,
        COALESCE(csc.start_time, oma.shift_start_time),
        COALESCE(csc.end_time, oma.shift_end_time)
      )
    LIMIT 1;

    IF v_overlap_conflict.id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'SHIFT_OVERLAP_CONFLICT',
        'error', 'Shift window collision: Requested shift ' || COALESCE(v_raw_shift_code, '') || ' (' || to_char(v_shift_start, 'HH12:MI AM') || ' – ' || to_char(v_shift_end, 'HH12:MI AM') || ') on machine ' || COALESCE(v_machine.machine_id, '') || ' overlaps with ' || COALESCE(v_operator.full_name, 'this operator') || '''s active Shift ' || COALESCE(v_overlap_conflict.shift_code, '') || ' on machine ' || COALESCE(v_overlap_conflict.other_machine_code, '') || ' (' || to_char(v_overlap_conflict.other_start, 'HH12:MI AM') || ' – ' || to_char(v_overlap_conflict.other_end, 'HH12:MI AM') || '). An operator cannot be assigned to overlapping shifts.'
      );
    END IF;

    IF v_shift_code IS NOT NULL THEN
      SELECT oma.operator_id, u.full_name, oma.shift_code
      INTO v_shift_conflict
      FROM public.operator_machine_assignments oma
      JOIN public.users u ON u.id = oma.operator_id
      WHERE oma.machine_id = p_machine_id
        AND oma.is_active = true
        AND oma.operator_id <> p_operator_id
        AND lower(trim(regexp_replace(oma.shift_code, '^shift\s*', '', 'i'))) = v_shift_code
      LIMIT 1;

      IF v_shift_conflict.operator_id IS NOT NULL THEN
        RETURN jsonb_build_object(
          'success', false,
          'code', 'SHIFT_CODE_CONFLICT',
          'error', 'Shift ' || COALESCE(v_raw_shift_code, v_shift_code) || ' is already assigned to ' || v_shift_conflict.full_name || ' on machine ' || COALESCE(v_machine.machine_id, '') || '. Each operator must be assigned to a different shift.'
        );
      END IF;
    END IF;

    SELECT COUNT(*)
    INTO v_machine_active_count
    FROM public.operator_machine_assignments
    WHERE machine_id = p_machine_id
      AND is_active = true;

    IF v_machine_active_count >= 3 THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'MAX_OPERATORS_REACHED',
        'error', 'Machine ' || COALESCE(v_machine.machine_id, 'Selected machine') || ' has reached its maximum capacity of 3 active shifts.'
      );
    END IF;

    SELECT id INTO v_ended_today_id
    FROM public.operator_machine_assignments
    WHERE machine_id = p_machine_id
      AND operator_id = p_operator_id
      AND lower(trim(regexp_replace(shift_code, '^shift\s*', '', 'i'))) = v_shift_code
      AND is_active = false
      AND (valid_to = v_today_ist OR (ended_at AT TIME ZONE 'Asia/Kolkata')::date = v_today_ist)
    ORDER BY updated_at DESC
    LIMIT 1;

    IF v_ended_today_id IS NOT NULL THEN
      UPDATE public.operator_machine_assignments
      SET is_active = true,
          shift_start_time = v_shift_start,
          shift_end_time = v_shift_end,
          shift_code = COALESCE(v_raw_shift_code, shift_code),
          notes = COALESCE(p_notes, notes),
          valid_to = NULL,
          ended_at = NULL,
          ended_by = NULL,
          end_reason = NULL,
          updated_at = NOW()
      WHERE id = v_ended_today_id
      RETURNING * INTO v_new_assignment;

      v_new_assignment_id := v_new_assignment.id;
    ELSE
      BEGIN
        INSERT INTO public.operator_machine_assignments (
          machine_id,
          operator_id,
          shift_start_time,
          shift_end_time,
          shift_code,
          is_active,
          assigned_by,
          assigned_at,
          valid_from,
          valid_to,
          notes
        )
        VALUES (
          p_machine_id,
          p_operator_id,
          v_shift_start,
          v_shift_end,
          COALESCE(v_raw_shift_code, v_shift_code),
          true,
          v_assigned_by,
          NOW(),
          v_today_ist,
          NULL,
          p_notes
        )
        RETURNING * INTO v_new_assignment;

        v_new_assignment_id := v_new_assignment.id;
      EXCEPTION
        WHEN SQLSTATE 'P0002' THEN
          RETURN jsonb_build_object(
            'success', false,
            'code', 'MAX_OPERATOR_SHIFTS_REACHED',
            'error', COALESCE(v_operator.full_name, 'Operator') || ' is already assigned to 3 shifts. Maximum 3 shifts (24h) allowed per operator.'
          );
        WHEN SQLSTATE 'P0001' THEN
          RETURN jsonb_build_object(
            'success', false,
            'code', 'MAX_OPERATORS_REACHED',
            'error', 'Machine ' || COALESCE(v_machine.machine_id, 'Selected machine') || ' has reached its maximum capacity of 3 active shifts.'
          );
        WHEN SQLSTATE '23P01' THEN
          RETURN jsonb_build_object(
            'success', false,
            'code', 'SHIFT_OVERLAP_CONFLICT',
            'error', 'Shift window overlapping error: The selected shift timings overlap with an existing active assignment.'
          );
        WHEN unique_violation THEN
          RETURN jsonb_build_object(
            'success', false,
            'code', 'ALREADY_ASSIGNED',
            'error', 'An assignment conflict occurred for this operator/shift. Please verify existing active shifts.'
          );
      END;
    END IF;
  END IF;

  v_audit_meta := jsonb_build_object(
    'assignmentId', v_new_assignment_id,
    'machineId', p_machine_id,
    'machineCode', v_machine.machine_id,
    'operatorId', p_operator_id,
    'operatorName', v_operator.full_name,
    'shiftCode', v_raw_shift_code,
    'shiftStart', v_shift_start,
    'shiftEnd', v_shift_end,
    'notes', p_notes
  );

  INSERT INTO public.audit_logs (
    user_id, action, entity_type, entity_id, metadata, details, created_at
  )
  VALUES (
    v_assigned_by,
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
    'shift_code', v_raw_shift_code,
    'shift_start_time', v_shift_start,
    'shift_end_time', v_shift_end
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_operator_machine_atomic(
  UUID, UUID, TIME, TIME, UUID, TIME, TIME, TEXT, TEXT
) TO authenticated, service_role;

-- ==============================================================================
-- 6. Explicitly trigger PostgREST schema cache reload
-- ==============================================================================
NOTIFY pgrst, 'reload schema';
