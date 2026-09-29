-- ==============================================================================
-- Migration 135: Client Monthly Maintenance Allowance
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
-- Description:
--   1. Adds maintenance_allowance_minutes to public.clients.
--   2. Adds breakdown_minutes and maintenance_minutes to machine_hour_logs.
--   3. Updates the immutability trigger to allow internal maintenance_minutes
--      writes (only when called from within a trigger, i.e. pg_trigger_depth() > 0,
--      AND only when the sole changed column is maintenance_minutes).
--   4. Creates recompute_maintenance() function.
--   5. Creates BEFORE guard trigger (zeros maintenance_minutes on insert/update).
--   6. Creates AFTER recompute trigger.
--   7. Adds a partial index.
--   8. Updates submit_operator_hour_log_atomic to set breakdown_minutes
--      and return maintenance split in the result JSON.
-- ==============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add allowance column to clients
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS maintenance_allowance_minutes integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_clients_maintenance_allowance'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT chk_clients_maintenance_allowance
      CHECK (maintenance_allowance_minutes BETWEEN 0 AND 44640);
  END IF;
END $$;

COMMENT ON COLUMN public.clients.maintenance_allowance_minutes IS
  'Monthly maintenance allowance in minutes per machine. 0 = no allowance. '
  'Max 44640 = 31 full days. Resets on 1st of each month (per machine+client+month pool).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add breakdown_minutes and maintenance_minutes to machine_hour_logs
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.machine_hour_logs
  ADD COLUMN IF NOT EXISTS breakdown_minutes integer,
  ADD COLUMN IF NOT EXISTS maintenance_minutes integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.machine_hour_logs.breakdown_minutes IS
  'Total breakdown duration in integer minutes for this log. Backfilled from breakdown_hours.';
COMMENT ON COLUMN public.machine_hour_logs.maintenance_minutes IS
  'Portion of breakdown_minutes covered by the client monthly allowance. '
  'Set ONLY by the recompute_maintenance trigger — never by callers.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Update immutability trigger to permit internal maintenance_minutes writes
--    The recompute_maintenance() function runs at pg_trigger_depth() >= 1 (from
--    the AFTER trigger). We allow it to update ONLY maintenance_minutes by
--    checking that maintenance_minutes is the sole changed column.
--    All other columns remain strictly immutable.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_machine_hour_logs_immutable()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Shift logs are strictly immutable and cannot be deleted by any role.'
      USING ERRCODE = '23514';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Allow the maintenance recompute trigger to update only maintenance_minutes.
    -- This is safe because recompute_maintenance() is called from within an AFTER
    -- trigger (pg_trigger_depth() >= 1) and only modifies maintenance_minutes.
    IF pg_trigger_depth() >= 1
       AND NEW.maintenance_minutes IS DISTINCT FROM OLD.maintenance_minutes
       AND NEW.id                     IS NOT DISTINCT FROM OLD.id
       AND NEW.machine_id             IS NOT DISTINCT FROM OLD.machine_id
       AND NEW.operator_id            IS NOT DISTINCT FROM OLD.operator_id
       AND NEW.client_id              IS NOT DISTINCT FROM OLD.client_id
       AND NEW.log_date               IS NOT DISTINCT FROM OLD.log_date
       AND NEW.start_meter            IS NOT DISTINCT FROM OLD.start_meter
       AND NEW.end_meter              IS NOT DISTINCT FROM OLD.end_meter
       AND NEW.is_breakdown           IS NOT DISTINCT FROM OLD.is_breakdown
       AND NEW.breakdown_minutes      IS NOT DISTINCT FROM OLD.breakdown_minutes
       AND NEW.breakdown_hours        IS NOT DISTINCT FROM OLD.breakdown_hours
       AND NEW.start_datetime         IS NOT DISTINCT FROM OLD.start_datetime
       AND NEW.end_datetime           IS NOT DISTINCT FROM OLD.end_datetime
    THEN
      -- Permit: only maintenance_minutes changed, from within a trigger
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Shift logs are strictly immutable and cannot be modified by any role.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Backfill breakdown_minutes from breakdown_hours & ensure immutability trigger
--    Drop trigger safely IF EXISTS prior to backfill so UPDATE is never blocked,
--    perform the backfill, then (re)create the trigger cleanly.
--    This avoids ERROR 42704 when the trigger does not yet exist on the target DB.
-- ─────────────────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_enforce_machine_hour_logs_immutable ON public.machine_hour_logs;

UPDATE public.machine_hour_logs
SET breakdown_minutes = ROUND(COALESCE(breakdown_hours, 0) * 60)::integer
WHERE breakdown_minutes IS NULL;

CREATE TRIGGER trg_enforce_machine_hour_logs_immutable
  BEFORE UPDATE OR DELETE ON public.machine_hour_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_machine_hour_logs_immutable();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Add check constraint (NOT VALID — validated after backfill)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.machine_hour_logs
  DROP CONSTRAINT IF EXISTS chk_mhl_maintenance_bounds;

ALTER TABLE public.machine_hour_logs
  ADD CONSTRAINT chk_mhl_maintenance_bounds
  CHECK (maintenance_minutes >= 0 AND maintenance_minutes <= COALESCE(breakdown_minutes, 0))
  NOT VALID;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Recompute function: allocate maintenance for one machine+client+month
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recompute_maintenance(
  p_machine uuid,
  p_client  uuid,
  p_month   date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_allowance integer;
BEGIN
  -- Serialize concurrent writes for the same machine to avoid races
  PERFORM pg_advisory_xact_lock(hashtext(p_machine::text || ':' || COALESCE(p_client::text, 'null')));

  -- Fetch current allowance (0 if client not found)
  SELECT COALESCE(maintenance_allowance_minutes, 0)
    INTO v_allowance
    FROM public.clients
   WHERE id = p_client;

  v_allowance := COALESCE(v_allowance, 0);

  -- Update maintenance_minutes for all breakdown logs in this machine+client+month.
  -- Running window sum (ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) computes
  -- the cumulative breakdown_minutes of all earlier logs in the month.
  -- Only writes rows whose value actually changed.
  UPDATE public.machine_hour_logs l
     SET maintenance_minutes = x.new_maint
    FROM (
      SELECT
        id,
        LEAST(
          COALESCE(breakdown_minutes, 0),
          GREATEST(
            0,
            v_allowance - COALESCE(
              SUM(COALESCE(breakdown_minutes, 0)) OVER (
                ORDER BY start_datetime ASC NULLS LAST, id ASC
                ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
              ),
              0
            )
          )
        )::integer AS new_maint
      FROM public.machine_hour_logs
     WHERE machine_id  = p_machine
       AND client_id   = p_client
       AND is_breakdown = true
       AND log_date   >= p_month
       AND log_date    < (p_month + INTERVAL '1 month')::date
    ) x
   WHERE l.id = x.id
     AND l.maintenance_minutes IS DISTINCT FROM x.new_maint;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_maintenance(uuid, uuid, date) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7a. BEFORE trigger guard: zero out any caller-supplied maintenance_minutes
--     This fires before the immutability check on INSERT (INSERT is not blocked).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_mhl_maintenance_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Always reset to 0 on insert; the AFTER trigger + recompute sets the real value.
  NEW.maintenance_minutes := 0;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mhl_maintenance_guard ON public.machine_hour_logs;
CREATE TRIGGER trg_mhl_maintenance_guard
BEFORE INSERT
ON public.machine_hour_logs
FOR EACH ROW
EXECUTE FUNCTION public.trg_mhl_maintenance_guard();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7b. AFTER trigger recompute: fires after INSERT to allocate maintenance pool
--     UPDATE/DELETE are blocked by the immutability trigger, so we only need
--     the INSERT path. The recompute function's internal UPDATE is allowed
--     by the updated immutability trigger above.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_mhl_maintenance_recompute()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only fire once; the UPDATE inside recompute_maintenance will not re-fire
  -- this trigger because it only changes maintenance_minutes (not a watched column).
  IF pg_trigger_depth() > 1 THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.is_breakdown AND NEW.client_id IS NOT NULL THEN
      PERFORM public.recompute_maintenance(
        NEW.machine_id,
        NEW.client_id,
        date_trunc('month', NEW.log_date)::date
      );
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_mhl_maintenance_recompute ON public.machine_hour_logs;
CREATE TRIGGER trg_mhl_maintenance_recompute
AFTER INSERT
ON public.machine_hour_logs
FOR EACH ROW
EXECUTE FUNCTION public.trg_mhl_maintenance_recompute();

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Partial index to accelerate recompute queries
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mhl_breakdown_machine_client_date
  ON public.machine_hour_logs (machine_id, client_id, log_date, start_datetime, id)
  WHERE is_breakdown = true;

COMMENT ON INDEX public.idx_mhl_breakdown_machine_client_date IS
  'Partial index over breakdown-only rows; accelerates recompute_maintenance window queries.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Update submit_operator_hour_log_atomic to:
--    a) populate breakdown_minutes from breakdown_hours
--    b) read back trigger-computed maintenance_minutes
--    c) return breakdown split in the result JSON
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.submit_operator_hour_log_atomic(
  p_machine_id uuid,
  p_operator_id uuid,
  p_client_id uuid DEFAULT NULL::uuid,
  p_log_date date DEFAULT CURRENT_DATE,
  p_start_meter numeric DEFAULT 0,
  p_end_meter numeric DEFAULT 0,
  p_start_time text DEFAULT NULL::text,
  p_end_time text DEFAULT NULL::text,
  p_overtime_hours numeric DEFAULT 0,
  p_is_breakdown boolean DEFAULT false,
  p_shift text DEFAULT NULL::text,
  p_machine_condition text DEFAULT 'good'::text,
  p_location text DEFAULT NULL::text,
  p_remarks text DEFAULT NULL::text,
  p_idempotency_key text DEFAULT NULL::text,
  p_normal_working_hours numeric DEFAULT NULL::numeric,
  p_end_date date DEFAULT NULL::date,
  p_start_datetime timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_end_datetime timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_breakdown_start_time text DEFAULT NULL::text,
  p_breakdown_end_time text DEFAULT NULL::text,
  p_breakdown_duration text DEFAULT NULL::text,
  p_breakdown_hours numeric DEFAULT 0,
  p_shift_code text DEFAULT NULL::text,
  p_entered_by uuid DEFAULT NULL::uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_log_id UUID;
  v_actor_id UUID;
  v_entry_source TEXT;
  v_idempotency_key TEXT;
  v_audit_meta JSONB;
  v_resolved_client_id UUID;
  v_resolved_location TEXT := p_location;
  v_start_time TIME;
  v_end_time TIME;
  v_breakdown_start_time TIME;
  v_breakdown_end_time TIME;
  v_log_date DATE;
  v_end_date DATE;
  v_start_datetime TIMESTAMPTZ;
  v_end_datetime TIMESTAMPTZ;
  v_shift_code TEXT;
  v_shift_name TEXT;
  v_normal_hours NUMERIC;
  v_caller_role TEXT;
  v_breakdown_minutes INTEGER;
  v_maintenance_minutes INTEGER;
BEGIN
  -- 1. Determine actor and entry attribution
  v_actor_id := COALESCE(p_entered_by, auth.uid(), p_operator_id);

  IF v_actor_id = p_operator_id THEN
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_actor_id;
    IF v_caller_role != 'operator' AND v_caller_role NOT IN ('super_admin', 'admin', 'manager') THEN
      RAISE EXCEPTION 'Not authorized to submit shift log'
        USING ERRCODE = '42501';
    END IF;
    v_entry_source := 'operator';
  ELSE
    SELECT role INTO v_caller_role FROM public.users WHERE id = v_actor_id;
    IF v_caller_role NOT IN ('super_admin', 'admin', 'manager') THEN
      RAISE EXCEPTION 'Not authorized to enter shift logs. Only roles above supervisor (manager, admin, super_admin) are permitted.'
        USING ERRCODE = '42501';
    END IF;
    v_entry_source := v_caller_role;
  END IF;

  -- 2. Meter Regression Guard
  IF p_end_meter < p_start_meter THEN
    RAISE EXCEPTION 'End meter reading (%) cannot be less than start meter reading (%)', p_end_meter, p_start_meter
      USING ERRCODE = '23514';
  END IF;

  -- 3. Normalization
  v_log_date := COALESCE(p_log_date, (NOW() AT TIME ZONE 'Asia/Kolkata')::date);
  v_end_date := COALESCE(p_end_date, v_log_date);
  v_start_time := NULLIF(TRIM(p_start_time), '')::TIME;
  v_end_time := NULLIF(TRIM(p_end_time), '')::TIME;
  v_breakdown_start_time := NULLIF(TRIM(p_breakdown_start_time), '')::TIME;
  v_breakdown_end_time := NULLIF(TRIM(p_breakdown_end_time), '')::TIME;
  v_start_datetime := p_start_datetime;
  v_end_datetime := p_end_datetime;

  IF v_start_datetime IS NULL AND v_start_time IS NOT NULL THEN
    v_start_datetime := ((v_log_date::text || ' ' || v_start_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata');
  END IF;

  IF v_end_datetime IS NULL AND v_end_time IS NOT NULL THEN
    IF v_end_time < v_start_time AND v_end_date = v_log_date THEN
      v_end_date := (v_log_date + INTERVAL '1 day')::date;
    END IF;
    v_end_datetime := ((v_end_date::text || ' ' || v_end_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata');
  END IF;

  -- 4. Shift Code and Name Resolution
  v_shift_code := NULLIF(TRIM(COALESCE(p_shift_code, p_shift)), '');
  IF v_shift_code IS NOT NULL THEN
    v_shift_code := regexp_replace(v_shift_code, '^shift\s*', '', 'i');
  END IF;
  v_shift_name := COALESCE(p_shift, CASE WHEN v_shift_code IS NOT NULL THEN 'Shift ' || v_shift_code ELSE 'Standard Shift' END);

  -- 5. Client & Location Resolution
  IF p_client_id IS NOT NULL THEN
    v_resolved_client_id := p_client_id;
  ELSE
    SELECT client_id INTO v_resolved_client_id FROM public.machines WHERE id = p_machine_id;
  END IF;

  IF v_resolved_location IS NULL AND v_resolved_client_id IS NOT NULL THEN
    SELECT concat_ws(', ',
      NULLIF(btrim(street), ''),
      NULLIF(btrim(city), ''),
      NULLIF(btrim(district), ''),
      NULLIF(btrim(state), ''),
      NULLIF(btrim(pincode), '')
    )
    INTO v_resolved_location
    FROM public.clients
    WHERE id = v_resolved_client_id;
  END IF;

  -- 6. Normal Hours
  v_normal_hours := COALESCE(p_normal_working_hours, 8);

  -- 7. Compute breakdown_minutes (stored integer minutes)
  v_breakdown_minutes := ROUND(COALESCE(p_breakdown_hours, 0) * 60)::integer;

  -- 8. Ensure Idempotency Key
  v_idempotency_key := COALESCE(
    NULLIF(TRIM(p_idempotency_key), ''),
    'ihl_' || replace(gen_random_uuid()::text, '-', '')
  );

  -- 9. Insert (BEFORE trigger zeroes maintenance_minutes; AFTER trigger recomputes it)
  INSERT INTO public.machine_hour_logs (
    machine_id, operator_id, client_id, log_date, end_date,
    start_datetime, end_datetime, start_meter, end_meter,
    start_time, end_time, overtime_hours, normal_working_hours,
    is_breakdown, breakdown_start_time, breakdown_end_time,
    breakdown_duration, breakdown_hours, breakdown_minutes,
    shift, shift_code, machine_condition, location, remarks,
    idempotency_key, entered_by, entry_source
  ) VALUES (
    p_machine_id, p_operator_id, v_resolved_client_id, v_log_date, v_end_date,
    v_start_datetime, v_end_datetime, p_start_meter, p_end_meter,
    v_start_time, v_end_time, COALESCE(p_overtime_hours, 0), v_normal_hours,
    COALESCE(p_is_breakdown, false), v_breakdown_start_time, v_breakdown_end_time,
    p_breakdown_duration, COALESCE(p_breakdown_hours, 0), v_breakdown_minutes,
    v_shift_name, v_shift_code, COALESCE(p_machine_condition, 'good'),
    v_resolved_location, p_remarks, v_idempotency_key, v_actor_id, v_entry_source
  )
  RETURNING id INTO v_log_id;

  -- 10. Read back trigger-computed maintenance_minutes (set by AFTER trigger atomically)
  SELECT maintenance_minutes INTO v_maintenance_minutes
    FROM public.machine_hour_logs WHERE id = v_log_id;
  v_maintenance_minutes := COALESCE(v_maintenance_minutes, 0);

  -- 11. Update Machine state
  UPDATE public.machines
  SET
    hour_meter = p_end_meter,
    current_operator_id = p_operator_id,
    health_status = CASE
      WHEN COALESCE(p_is_breakdown, false) = true OR p_machine_condition = 'breakdown' THEN 'breakdown'
      ELSE 'active'
    END,
    updated_at = NOW()
  WHERE id = p_machine_id;

  -- 12. Sync assignment shift_code
  IF v_shift_code IS NOT NULL AND p_operator_id IS NOT NULL THEN
    UPDATE public.operator_machine_assignments
    SET shift_code = v_shift_code, updated_at = NOW()
    WHERE machine_id = p_machine_id
      AND operator_id = p_operator_id
      AND is_active = true
      AND (shift_code IS NULL OR shift_code <> v_shift_code);
  END IF;

  -- 13. Audit log
  v_audit_meta := jsonb_build_object(
    'logId', v_log_id,
    'startMeter', p_start_meter,
    'endMeter', p_end_meter,
    'runningHours', (p_end_meter - p_start_meter),
    'normalWorkingHours', v_normal_hours,
    'overtimeHours', p_overtime_hours,
    'startTime', p_start_time,
    'endTime', p_end_time,
    'shiftCode', v_shift_code,
    'condition', p_machine_condition,
    'breakdownMinutes', v_breakdown_minutes,
    'maintenanceMinutes', v_maintenance_minutes,
    'netBreakdownMinutes', (v_breakdown_minutes - v_maintenance_minutes),
    'idempotencyKey', v_idempotency_key,
    'enteredBy', v_actor_id,
    'entrySource', v_entry_source
  );

  INSERT INTO public.audit_logs (
    user_id, action, entity_type, entity_id, metadata, details, created_at
  )
  VALUES (
    v_actor_id, 'machine.hour_logged', 'machine', p_machine_id,
    v_audit_meta, v_audit_meta, NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'logId', v_log_id,
    'machineId', p_machine_id,
    'endMeter', p_end_meter,
    'normalWorkingHours', v_normal_hours,
    'breakdownMinutes', v_breakdown_minutes,
    'maintenanceMinutes', v_maintenance_minutes,
    'netBreakdownMinutes', (v_breakdown_minutes - v_maintenance_minutes),
    'idempotencyKey', v_idempotency_key,
    'enteredBy', v_actor_id,
    'entrySource', v_entry_source
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.submit_operator_hour_log_atomic(
  uuid, uuid, uuid, date, numeric, numeric, text, text, numeric, boolean,
  text, text, text, text, text, numeric, date, timestamptz, timestamptz,
  text, text, text, numeric, text, uuid
) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Validate constraint
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.machine_hour_logs
  VALIDATE CONSTRAINT chk_mhl_maintenance_bounds;
