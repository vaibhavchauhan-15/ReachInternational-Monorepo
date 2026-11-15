-- Migration 184: Date-Independent Operator Shift Assignments & Shift Entry Schema
-- Purpose: Add valid_from, valid_to to operator_machine_assignments and assignment_id to machine_hour_logs.
-- Non-destructive, additive, and backward compatible.

-- Step 1: Add date-range columns to operator_machine_assignments
ALTER TABLE public.operator_machine_assignments
  ADD COLUMN IF NOT EXISTS valid_from DATE NOT NULL DEFAULT ((NOW() AT TIME ZONE 'Asia/Kolkata')::date),
  ADD COLUMN IF NOT EXISTS valid_to DATE NULL;

COMMENT ON COLUMN public.operator_machine_assignments.valid_to IS 
  'Inclusive end date in IST. NULL indicates open-ended carry-forward.';

-- Step 2: Backfill valid_from and valid_to on existing assignments
-- Baseline assignment dates directly from assignment timestamps
UPDATE public.operator_machine_assignments
SET
  valid_from = (assigned_at AT TIME ZONE 'Asia/Kolkata')::date,
  valid_to = CASE
    WHEN is_active = false AND ended_at IS NOT NULL THEN
      GREATEST(
        (ended_at AT TIME ZONE 'Asia/Kolkata')::date,
        (assigned_at AT TIME ZONE 'Asia/Kolkata')::date
      )
    WHEN is_active = false AND ended_at IS NULL THEN
      (assigned_at AT TIME ZONE 'Asia/Kolkata')::date
    ELSE NULL
  END;

-- For historical seed assignments (assigned on or before 2026-10-03), if machine_hour_logs
-- exist with earlier log_dates within this assignment's window, backfill valid_from to the earliest log.
-- Note: Subquery strictly bounds log_date so it never steals logs from prior completed assignments.
UPDATE public.operator_machine_assignments o
SET valid_from = sub.min_log
FROM (
  SELECT
    o2.id,
    MIN(m.log_date) AS min_log
  FROM public.operator_machine_assignments o2
  JOIN public.machine_hour_logs m
    ON m.operator_id = o2.operator_id
   AND m.machine_id = o2.machine_id
   AND lower(trim(m.shift_code)) = lower(trim(o2.shift_code))
  WHERE o2.assigned_at <= '2026-10-03 16:00:00+05:30'
    AND (o2.valid_to IS NULL OR m.log_date <= o2.valid_to)
    AND NOT EXISTS (
      SELECT 1 FROM public.operator_machine_assignments prior
      WHERE prior.operator_id = o2.operator_id
        AND prior.machine_id = o2.machine_id
        AND lower(trim(prior.shift_code)) = lower(trim(o2.shift_code))
        AND prior.id <> o2.id
        AND prior.assigned_at < o2.assigned_at
        AND prior.ended_at IS NOT NULL
        AND m.log_date <= (prior.ended_at AT TIME ZONE 'Asia/Kolkata')::date
    )
  GROUP BY o2.id
) sub
WHERE o.id = sub.id
  AND sub.min_log < o.valid_from;

-- Step 2b: Automated overlap reconciliation for contiguous and historical assignments
-- Dynamically eliminates overlapping windows across all operators and shifts (replaces hardcoded IDs).
DO $$
DECLARE
  v_changed BOOLEAN := TRUE;
  v_pass INT := 0;
  r RECORD;
  v_prev_op UUID;
  v_prev_shift TEXT;
  v_prev_id UUID;
  v_prev_valid_from DATE;
  v_prev_valid_to DATE;
BEGIN
  -- Run iterative reconciliation passes until zero overlapping ranges remain
  WHILE v_changed AND v_pass < 10 LOOP
    v_changed := FALSE;
    v_pass := v_pass + 1;
    v_prev_op := NULL;
    v_prev_shift := NULL;
    v_prev_id := NULL;
    v_prev_valid_from := NULL;
    v_prev_valid_to := NULL;

    FOR r IN
      SELECT id, operator_id, lower(trim(shift_code)) AS shift_code,
             valid_from, valid_to, is_active, assigned_at, ended_at
      FROM public.operator_machine_assignments
      WHERE operator_id IS NOT NULL AND shift_code IS NOT NULL
      ORDER BY operator_id, lower(trim(shift_code)), valid_from ASC,
               COALESCE(valid_to, '9999-12-31'::date) ASC, assigned_at ASC, id ASC
    LOOP
      IF v_prev_op IS NOT NULL 
         AND v_prev_op = r.operator_id 
         AND v_prev_shift = r.shift_code THEN

        -- Check overlap: previous assignment extends into or past current assignment's valid_from
        IF v_prev_valid_to IS NULL OR v_prev_valid_to >= r.valid_from THEN
          IF r.valid_from > v_prev_valid_from THEN
            -- Handover on same date or overlapping: previous assignment ends day before current starts
            UPDATE public.operator_machine_assignments
            SET valid_to = r.valid_from - 1,
                is_active = false
            WHERE id = v_prev_id;

            v_prev_valid_to := r.valid_from - 1;
            v_changed := TRUE;
          ELSE
            -- Both rows have the same valid_from!
            -- Push current assignment's valid_from to start after previous valid_to
            IF v_prev_valid_to IS NOT NULL AND v_prev_valid_to >= r.valid_from THEN
              r.valid_from := v_prev_valid_to + 1;
              IF r.valid_to IS NOT NULL AND r.valid_to < r.valid_from THEN
                r.valid_to := r.valid_from;
              END IF;

              UPDATE public.operator_machine_assignments
              SET valid_from = r.valid_from,
                  valid_to = r.valid_to
              WHERE id = r.id;

              v_changed := TRUE;
            ELSIF v_prev_valid_to IS NULL THEN
              -- Previous row was open-ended on same start date: close previous at valid_from
              UPDATE public.operator_machine_assignments
              SET valid_to = v_prev_valid_from,
                  is_active = false
              WHERE id = v_prev_id;

              v_prev_valid_to := v_prev_valid_from;
              r.valid_from := v_prev_valid_to + 1;
              IF r.valid_to IS NOT NULL AND r.valid_to < r.valid_from THEN
                r.valid_to := r.valid_from;
              END IF;

              UPDATE public.operator_machine_assignments
              SET valid_from = r.valid_from,
                  valid_to = r.valid_to
              WHERE id = r.id;

              v_changed := TRUE;
            END IF;
          END IF;
        END IF;
      END IF;

      v_prev_op := r.operator_id;
      v_prev_shift := r.shift_code;
      v_prev_id := r.id;
      v_prev_valid_from := r.valid_from;
      v_prev_valid_to := r.valid_to;
    END LOOP;
  END LOOP;

  -- Safety: Ensure valid_from <= valid_to everywhere for ended assignments
  UPDATE public.operator_machine_assignments
  SET valid_to = valid_from
  WHERE valid_to IS NOT NULL AND valid_to < valid_from;
END $$;

-- Step 3: Performance B-Tree indexes for date-range window reads
CREATE INDEX IF NOT EXISTS idx_oma_operator_date_range 
  ON public.operator_machine_assignments (operator_id, valid_from, valid_to);

CREATE INDEX IF NOT EXISTS idx_oma_machine_date_range 
  ON public.operator_machine_assignments (machine_id, valid_from, valid_to);

-- Step 4: Overlap Prevention Constraint (btree_gist)
CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'oma_no_active_operator_shift_overlap'
  ) THEN
    ALTER TABLE public.operator_machine_assignments
      ADD CONSTRAINT oma_no_active_operator_shift_overlap
      EXCLUDE USING gist (
        operator_id WITH =,
        lower(trim(shift_code)) WITH =,
        daterange(valid_from, COALESCE(valid_to, '9999-12-31'::date), '[]') WITH &&
      )
      WHERE (is_active = true OR valid_to IS NULL OR valid_from < valid_to);
  END IF;
END $$;

-- Step 5: Add assignment_id to machine_hour_logs
ALTER TABLE public.machine_hour_logs
  ADD COLUMN IF NOT EXISTS assignment_id UUID 
  REFERENCES public.operator_machine_assignments(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_mhl_assignment_id 
  ON public.machine_hour_logs (assignment_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_mhl_assignment_log_date_unique 
  ON public.machine_hour_logs (assignment_id, log_date) 
  WHERE assignment_id IS NOT NULL;

-- Step 6: Evidence-based backfill linking machine_hour_logs to assignments
DO $$
BEGIN
  -- Temporarily disable date window trigger to allow historical column backfill
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_machine_hour_log_operator_date_window'
  ) THEN
    ALTER TABLE public.machine_hour_logs 
      DISABLE TRIGGER trg_enforce_machine_hour_log_operator_date_window;
  END IF;

  UPDATE public.machine_hour_logs mhl
  SET assignment_id = oma.id
  FROM public.operator_machine_assignments oma
  WHERE mhl.assignment_id IS NULL
    AND oma.operator_id = mhl.operator_id
    AND oma.machine_id = mhl.machine_id
    AND lower(trim(oma.shift_code)) = lower(trim(mhl.shift_code))
    AND mhl.log_date >= oma.valid_from
    AND (oma.valid_to IS NULL OR mhl.log_date <= oma.valid_to);

  -- Re-enable date window trigger
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_machine_hour_log_operator_date_window'
  ) THEN
    ALTER TABLE public.machine_hour_logs 
      ENABLE TRIGGER trg_enforce_machine_hour_log_operator_date_window;
  END IF;
END $$;
