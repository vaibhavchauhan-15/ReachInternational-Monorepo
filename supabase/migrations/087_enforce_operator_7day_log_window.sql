-- Migration 087: Enforce 7-Day Window on Machine Hour Logs for Operators
--
-- Objectives:
-- 1. Create trigger on public.machine_hour_logs to enforce that operators can only
--    insert or update logs within the previous 7 days (CURRENT_DATE - 7 to CURRENT_DATE).
--    Any log older than 7 days is locked against operator edits.
-- 2. Update RLS policies on public.machine_hour_logs to strictly enforce log_date <= CURRENT_DATE
--    and log_date >= CURRENT_DATE - 7 for operator INSERT and UPDATE operations.

-- 1. Trigger Function to enforce 7-day window for operators
CREATE OR REPLACE FUNCTION public.enforce_machine_hour_log_operator_date_window()
RETURNS TRIGGER AS $$
DECLARE
  v_user_role TEXT;
BEGIN
  -- Determine caller role
  v_user_role := public.current_user_role();

  -- If the caller is an operator (or if auth.uid() matches operator_id and user is not managerial)
  IF v_user_role = 'operator' OR (
    auth.uid() IS NOT NULL 
    AND auth.uid() = NEW.operator_id 
    AND (v_user_role IS NULL OR v_user_role NOT IN ('super_admin', 'admin', 'manager', 'supervisor'))
  ) THEN
    -- Check NEW.log_date is within previous 7 days (no future dates, no dates older than 7 days)
    IF NEW.log_date < (CURRENT_DATE - 7) OR NEW.log_date > CURRENT_DATE THEN
      RAISE EXCEPTION 'Operators can only record or update logs within the previous 7 days (date %, allowed: % to %)',
        NEW.log_date, (CURRENT_DATE - 7), CURRENT_DATE
        USING ERRCODE = '23514';
    END IF;

    -- On UPDATE, also check that the existing log was not older than 7 days (locked record)
    IF TG_OP = 'UPDATE' AND (OLD.log_date < (CURRENT_DATE - 7) OR OLD.log_date > CURRENT_DATE) THEN
      RAISE EXCEPTION 'This log entry is locked. Logs older than 7 days cannot be edited by operators.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Revoke public execution
REVOKE EXECUTE ON FUNCTION public.enforce_machine_hour_log_operator_date_window() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_machine_hour_log_operator_date_window() TO authenticated;

-- Attach trigger BEFORE INSERT OR UPDATE on machine_hour_logs
DROP TRIGGER IF EXISTS trg_enforce_machine_hour_log_operator_date_window ON public.machine_hour_logs;
CREATE TRIGGER trg_enforce_machine_hour_log_operator_date_window
  BEFORE INSERT OR UPDATE ON public.machine_hour_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_machine_hour_log_operator_date_window();

-- 2. Update RLS UPDATE Policy on machine_hour_logs:
DROP POLICY IF EXISTS "update_machine_hour_logs" ON public.machine_hour_logs;

CREATE POLICY "update_machine_hour_logs" ON public.machine_hour_logs
  FOR UPDATE
  USING (
    ((SELECT public.current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'supervisor'::text]))
    OR (
      ((SELECT public.current_user_role()) = 'operator'::text)
      AND (operator_id = (SELECT auth.uid()))
      AND (log_date >= (CURRENT_DATE - 7))
      AND (log_date <= CURRENT_DATE)
    )
  )
  WITH CHECK (
    ((SELECT public.current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'supervisor'::text]))
    OR (
      ((SELECT public.current_user_role()) = 'operator'::text)
      AND (operator_id = (SELECT auth.uid()))
      AND (log_date >= (CURRENT_DATE - 7))
      AND (log_date <= CURRENT_DATE)
    )
  );

-- 3. Update RLS INSERT Policy on machine_hour_logs:
DROP POLICY IF EXISTS "insert_machine_hour_logs" ON public.machine_hour_logs;

CREATE POLICY "insert_machine_hour_logs" ON public.machine_hour_logs
  FOR INSERT
  WITH CHECK (
    (
      (operator_id = (SELECT auth.uid()))
      AND (log_date >= (CURRENT_DATE - 7))
      AND (log_date <= CURRENT_DATE)
    )
    OR ((SELECT public.current_user_role()) = ANY (ARRAY['super_admin'::text, 'admin'::text, 'manager'::text, 'supervisor'::text]))
  );
