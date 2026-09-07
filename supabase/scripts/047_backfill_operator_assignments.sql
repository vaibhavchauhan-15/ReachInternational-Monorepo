-- ==============================================================================
-- Script: 047_backfill_operator_assignments.sql
-- Description: Standalone Administrative Backfill for Operator–Machine Assignments
-- 
-- FEATURES:
-- 1. DRY-RUN REPORT MODE BY DEFAULT (v_dry_run := true)
--    Outputs detailed RAISE NOTICE messages without altering any database records.
-- 2. Respects Operator Profile Shifts:
--    Extracts public.users.shift_time when available (e.g. "08:00 AM - 04:00 PM"),
--    falling back to staggered 8-hour shift windows only when profile shift is null/invalid.
-- 3. Double-Booking Conflict Detection:
--    Detects if an operator already has an active assignment on another machine,
--    reporting the conflict and skipping rather than creating inconsistent data.
-- 4. Machine Capacity Guard:
--    Respects the max 3 distinct operators per machine limit.
-- 5. Safe & Idempotent:
--    Can be re-run safely multiple times.
-- 
-- TO RUN:
--   1. Dry-Run Mode (Default): Run as-is in the Supabase SQL Editor.
--   2. Live Execution Mode: Change `v_dry_run := false;` on line 28 and execute.
-- ==============================================================================

DO $$
DECLARE
  -- CONFIGURATION FLAG: Set to false to perform live database insertions
  v_dry_run           BOOLEAN := true;

  rec                 RECORD;
  v_admin_id          UUID;
  v_op_id             UUID;
  v_op_name           TEXT;
  v_op_role           TEXT;
  v_user_shift        TEXT;
  v_start             TIME;
  v_end               TIME;
  v_parts             TEXT[];
  v_shift_source      TEXT;
  v_idx               INT;
  v_planned_machine   INT;
  v_existing_active   RECORD;
  
  -- Statistics counters
  v_total_candidates  INT := 0;
  v_proposed_count    INT := 0;
  v_inserted_count    INT := 0;
  v_conflicts_count   INT := 0;
  v_capacity_skipped  INT := 0;
  v_already_assigned  INT := 0;
  v_new_assignment_id UUID;
  v_audit_meta        JSONB;
BEGIN
  RAISE NOTICE '==============================================================================';
  RAISE NOTICE '🚀 OPERATOR-MACHINE ASSIGNMENT BACKFILL SCRIPT';
  RAISE NOTICE 'Mode: %', CASE WHEN v_dry_run THEN 'DRY-RUN (REPORT ONLY — NO DATA CHANGES)' ELSE 'LIVE EXECUTION' END;
  RAISE NOTICE '==============================================================================';

  -- 1. Resolve Admin / System user ID for audit and assigned_by references
  SELECT id INTO v_admin_id FROM public.users WHERE role IN ('super_admin', 'admin') LIMIT 1;
  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id FROM public.users LIMIT 1;
  END IF;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No valid admin or system user found in public.users. Backfill cannot proceed.';
  END IF;

  -- 2. Iterate through all machines having legacy personnel arrays or current_operator_id
  FOR rec IN (
    SELECT id AS m_id, machine_id AS m_code, model, operator_ids, current_operator_id
    FROM public.machines
    WHERE (cardinality(operator_ids) > 0 OR current_operator_id IS NOT NULL)
    ORDER BY created_at ASC
  ) LOOP
    v_idx := 0;

    -- Count active assignments already in database for this machine
    SELECT COUNT(DISTINCT operator_id) INTO v_planned_machine
    FROM public.operator_machine_assignments
    WHERE machine_id = rec.m_id AND is_active = true;

    -- Collect distinct candidate operator IDs for this machine
    FOR v_op_id IN (
      SELECT DISTINCT op_id FROM unnest(
        CASE 
          WHEN cardinality(rec.operator_ids) > 0 THEN rec.operator_ids 
          ELSE ARRAY[rec.current_operator_id] 
        END
      ) AS op_id WHERE op_id IS NOT NULL
    ) LOOP
      v_total_candidates := v_total_candidates + 1;

      -- Fetch candidate operator info
      SELECT full_name, role, shift_time
      INTO v_op_name, v_op_role, v_user_shift
      FROM public.users
      WHERE id = v_op_id;

      IF NOT FOUND THEN
        RAISE NOTICE '⚠️ [SKIP] Operator ID % referenced on Machine % does not exist in public.users.', v_op_id, COALESCE(rec.m_code, rec.m_id::text);
        CONTINUE;
      END IF;

      -- 3. Check if operator is already active on THIS machine
      IF EXISTS (
        SELECT 1 FROM public.operator_machine_assignments
        WHERE machine_id = rec.m_id AND operator_id = v_op_id AND is_active = true
      ) THEN
        v_already_assigned := v_already_assigned + 1;
        RAISE NOTICE 'ℹ️ [ALREADY ACTIVE] Operator "%" (%) is already assigned to Machine %.', v_op_name, v_op_id, COALESCE(rec.m_code, rec.m_id::text);
        CONTINUE;
      END IF;

      -- 4. Check for Double-Booking: Does operator have an active assignment on ANOTHER machine?
      SELECT oma.id, m.machine_id AS other_code, oma.shift_start_time, oma.shift_end_time
      INTO v_existing_active
      FROM public.operator_machine_assignments oma
      JOIN public.machines m ON m.id = oma.machine_id
      WHERE oma.operator_id = v_op_id AND oma.is_active = true
      LIMIT 1;

      IF v_existing_active.id IS NOT NULL THEN
        v_conflicts_count := v_conflicts_count + 1;
        RAISE NOTICE '⚠️ [CONFLICT / SKIP] Operator "%" (%) is already assigned to Machine "%" on shift % – %. Skipping assignment to Machine "%".',
          v_op_name,
          v_op_id,
          COALESCE(v_existing_active.other_code, 'Other'),
          v_existing_active.shift_start_time,
          v_existing_active.shift_end_time,
          COALESCE(rec.m_code, rec.m_id::text);
        CONTINUE;
      END IF;

      -- 5. Check Machine Capacity: Limit to 3 distinct operators
      IF v_planned_machine >= 3 THEN
        v_capacity_skipped := v_capacity_skipped + 1;
        RAISE NOTICE '⚠️ [CAPACITY EXCEEDED / SKIP] Machine "%" has reached max capacity of 3 active operators. Skipping Operator "%" (%).',
          COALESCE(rec.m_code, rec.m_id::text),
          v_op_name,
          v_op_id;
        CONTINUE;
      END IF;

      -- 6. Determine Shift Window: Respect profile shift_time if parseable, else use staggered default
      v_start := NULL;
      v_end := NULL;
      v_shift_source := 'staggered_default';

      IF v_user_shift IS NOT NULL AND btrim(v_user_shift) <> '' THEN
        v_parts := regexp_split_to_array(btrim(v_user_shift), '\s*[-–—]\s*');
        IF array_length(v_parts, 1) = 2 THEN
          BEGIN
            v_start := v_parts[1]::TIME;
            v_end := v_parts[2]::TIME;
            IF v_start <> v_end THEN
              v_shift_source := 'profile ("' || v_user_shift || '")';
            ELSE
              v_start := NULL;
              v_end := NULL;
            END IF;
          EXCEPTION WHEN OTHERS THEN
            v_start := NULL;
            v_end := NULL;
          END;
        END IF;
      END IF;

      -- Fallback to staggered 8-hour shift windows if profile shift was null or unparseable
      IF v_start IS NULL OR v_end IS NULL THEN
        IF v_idx = 0 THEN
          v_start := '08:00:00'::TIME;
          v_end := '16:00:00'::TIME;
          v_shift_source := 'staggered_slot_1 (08:00-16:00)';
        ELSIF v_idx = 1 THEN
          v_start := '16:00:00'::TIME;
          v_end := '00:00:00'::TIME;
          v_shift_source := 'staggered_slot_2 (16:00-00:00)';
        ELSE
          v_start := '00:00:00'::TIME;
          v_end := '08:00:00'::TIME;
          v_shift_source := 'staggered_slot_3 (00:00-08:00)';
        END IF;
      END IF;

      -- 7. Execute or Report
      IF v_dry_run THEN
        v_proposed_count := v_proposed_count + 1;
        v_planned_machine := v_planned_machine + 1;
        v_idx := v_idx + 1;
        RAISE NOTICE '📋 [PROPOSAL] Machine "%" <- Operator "%" (%) on shift % – % [Source: %]',
          COALESCE(rec.m_code, rec.m_id::text),
          v_op_name,
          v_op_id,
          v_start,
          v_end,
          v_shift_source;
      ELSE
        -- LIVE INSERTION
        INSERT INTO public.operator_machine_assignments (
          machine_id,
          operator_id,
          shift_start_time,
          shift_end_time,
          is_active,
          assigned_by,
          end_reason,
          assigned_at
        )
        VALUES (
          rec.m_id,
          v_op_id,
          v_start,
          v_end,
          true,
          v_admin_id,
          'migrated',
          NOW()
        )
        RETURNING id INTO v_new_assignment_id;

        -- Write structured audit record
        v_audit_meta := jsonb_build_object(
          'assignmentId', v_new_assignment_id,
          'machineId', rec.m_id,
          'machineCode', rec.m_code,
          'operatorId', v_op_id,
          'operatorName', v_op_name,
          'shiftStart', v_start,
          'shiftEnd', v_end,
          'shiftSource', v_shift_source,
          'migrated', true
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
          v_admin_id,
          'machine.operator_shift_migrated',
          'operator_machine_assignment',
          v_new_assignment_id::text,
          v_audit_meta,
          v_audit_meta,
          NOW()
        );

        v_inserted_count := v_inserted_count + 1;
        v_planned_machine := v_planned_machine + 1;
        v_idx := v_idx + 1;

        RAISE NOTICE '✅ [INSERTED] Machine "%" <- Operator "%" on shift % – % [ID: %]',
          COALESCE(rec.m_code, rec.m_id::text),
          v_op_name,
          v_start,
          v_end,
          v_new_assignment_id;
      END IF;

    END LOOP;
  END LOOP;

  -- 8. Output Final Execution Summary
  RAISE NOTICE '==============================================================================';
  RAISE NOTICE '📊 BACKFILL EXECUTION SUMMARY';
  RAISE NOTICE 'Mode:                          %', CASE WHEN v_dry_run THEN 'DRY-RUN (NO DATA CHANGED)' ELSE 'LIVE APPLIED' END;
  RAISE NOTICE 'Total Candidate Operators:     %', v_total_candidates;
  RAISE NOTICE 'Already Assigned on Machine:   %', v_already_assigned;
  RAISE NOTICE 'Double-Booking Conflicts:      %', v_conflicts_count;
  RAISE NOTICE 'Capacity Exceeded (>3/machine):%', v_capacity_skipped;
  IF v_dry_run THEN
    RAISE NOTICE 'Assignments Proposed:          %', v_proposed_count;
    RAISE NOTICE '👉 To apply these assignments, change "v_dry_run := false;" on line 28 and run again.';
  ELSE
    RAISE NOTICE 'Assignments Created:           %', v_inserted_count;
    RAISE NOTICE 'Triggers executed: capacity guard, shift ranges synced, machines array mirrored.';
  END IF;
  RAISE NOTICE '==============================================================================';
END;
$$;
