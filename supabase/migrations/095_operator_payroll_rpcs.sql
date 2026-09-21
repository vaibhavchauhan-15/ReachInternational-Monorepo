-- ==============================================================================
-- Migration 095: HR Payroll RPC Security Hardening & Rate Mutation Functions
-- Grants super_admin, admin, manager, and hr authoritative access to view & mutate
-- operator compensation rates with SECURITY DEFINER and built-in RBAC verification.
-- ==============================================================================

-- 1. Hardened HR Payroll Summary RPC with explicit role authorization check
CREATE OR REPLACE FUNCTION public.get_hr_payroll_summary(
  p_payroll_month date DEFAULT date_trunc('month', CURRENT_DATE)::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_caller_role text;
  v_regular_start date;
  v_regular_end   date;
  v_ot_start      date;
  v_ot_end        date;
  v_result        jsonb;
BEGIN
  -- Caller role validation: restricted to super_admin, admin, manager, hr
  IF auth.role() = 'authenticated' THEN
    SELECT role INTO v_caller_role
    FROM public.users
    WHERE id = auth.uid()
      AND status = 'active';

    IF v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'hr') THEN
      RAISE EXCEPTION 'Access denied: HR Payroll is restricted to super_admin, admin, manager, and hr.';
    END IF;
  END IF;

  -- Previous month = regular work period
  v_regular_start := (p_payroll_month - interval '1 month')::date;
  v_regular_end   := (p_payroll_month - interval '1 day')::date;

  -- Month before that = OT period (1-month lag for client confirmation)
  v_ot_start := (p_payroll_month - interval '2 months')::date;
  v_ot_end   := (v_regular_start - interval '1 day')::date;

  SELECT jsonb_agg(
    jsonb_build_object(
      'operator_id',    u.id,
      'full_name',      u.full_name,
      'phone',          u.phone,
      'city',           u.city,
      'state',          u.state,
      'daily_rate',     u.daily_rate,
      'ot_hourly_rate', u.ot_hourly_rate,
      'work_days',      COALESCE(r.work_days, 0),
      'normal_hours',   COALESCE(r.normal_hours, 0),
      'ot_hours',       COALESCE(o.ot_hours, 0),
      'regular_pay',    COALESCE(r.work_days, 0) * u.daily_rate,
      'ot_pay',         COALESCE(o.ot_hours, 0) * u.ot_hourly_rate,
      'total_pay',      (COALESCE(r.work_days, 0) * u.daily_rate)
                       + (COALESCE(o.ot_hours, 0) * u.ot_hourly_rate)
    ) ORDER BY u.full_name
  )
  INTO v_result
  FROM public.users u
  LEFT JOIN LATERAL (
    SELECT
      COUNT(DISTINCT mhl.log_date)::int AS work_days,
      COALESCE(SUM(mhl.normal_working_hours), 0)::numeric AS normal_hours
    FROM public.machine_hour_logs mhl
    WHERE mhl.operator_id = u.id
      AND mhl.log_date >= v_regular_start
      AND mhl.log_date <= v_regular_end
  ) r ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(mhl2.overtime_hours), 0)::numeric AS ot_hours
    FROM public.machine_hour_logs mhl2
    WHERE mhl2.operator_id = u.id
      AND mhl2.log_date >= v_ot_start
      AND mhl2.log_date <= v_ot_end
  ) o ON true
  WHERE u.role = 'operator'
    AND u.status = 'active';

  RETURN jsonb_build_object(
    'payrollMonth',   to_char(p_payroll_month, 'YYYY-MM'),
    'regularPeriod',  to_char(v_regular_start, 'YYYY-MM-DD') || ' to ' || to_char(v_regular_end, 'YYYY-MM-DD'),
    'otPeriod',       to_char(v_ot_start, 'YYYY-MM-DD') || ' to ' || to_char(v_ot_end, 'YYYY-MM-DD'),
    'operators',      COALESCE(v_result, '[]'::jsonb)
  );
END;
$$;

-- 2. Single Operator Rate Update RPC (Accessible to super_admin, admin, manager, hr)
CREATE OR REPLACE FUNCTION public.update_operator_payroll_rates(
  p_operator_id uuid,
  p_daily_rate numeric,
  p_ot_hourly_rate numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role text;
  v_clean_daily numeric := GREATEST(0, COALESCE(p_daily_rate, 0));
  v_clean_ot numeric := GREATEST(0, COALESCE(p_ot_hourly_rate, 0));
BEGIN
  -- Verify caller role
  IF auth.role() = 'authenticated' THEN
    SELECT role INTO v_caller_role
    FROM public.users
    WHERE id = auth.uid()
      AND status = 'active';

    IF v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'hr') THEN
      RAISE EXCEPTION 'Access denied: Rate updates are restricted to super_admin, admin, manager, and hr.';
    END IF;
  END IF;

  IF p_operator_id IS NULL THEN
    RAISE EXCEPTION 'Operator ID is required.';
  END IF;

  UPDATE public.users
  SET
    daily_rate = v_clean_daily,
    ot_hourly_rate = v_clean_ot,
    updated_at = clock_timestamp()
  WHERE id = p_operator_id
    AND role = 'operator';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operator not found or user is not an active operator.';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'operator_id', p_operator_id,
    'daily_rate', v_clean_daily,
    'ot_hourly_rate', v_clean_ot
  );
END;
$$;

-- 3. Bulk Operator Rates Update RPC (Atomic multi-row update in single transaction)
CREATE OR REPLACE FUNCTION public.bulk_update_operator_payroll_rates(
  p_updates jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role text;
  v_item jsonb;
  v_count integer := 0;
  v_daily numeric;
  v_ot numeric;
BEGIN
  -- Verify caller role
  IF auth.role() = 'authenticated' THEN
    SELECT role INTO v_caller_role
    FROM public.users
    WHERE id = auth.uid()
      AND status = 'active';

    IF v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'hr') THEN
      RAISE EXCEPTION 'Access denied: Bulk rate updates are restricted to super_admin, admin, manager, and hr.';
    END IF;
  END IF;

  IF p_updates IS NULL OR jsonb_typeof(p_updates) <> 'array' OR jsonb_array_length(p_updates) = 0 THEN
    RETURN jsonb_build_object('success', false, 'count', 0, 'error', 'No updates provided');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    v_daily := NULL;
    v_ot := NULL;

    IF v_item ? 'daily_rate' AND v_item->>'daily_rate' IS NOT NULL THEN
      v_daily := GREATEST(0, (v_item->>'daily_rate')::numeric);
    END IF;

    IF v_item ? 'ot_hourly_rate' AND v_item->>'ot_hourly_rate' IS NOT NULL THEN
      v_ot := GREATEST(0, (v_item->>'ot_hourly_rate')::numeric);
    END IF;

    UPDATE public.users
    SET
      daily_rate = COALESCE(v_daily, daily_rate),
      ot_hourly_rate = COALESCE(v_ot, ot_hourly_rate),
      updated_at = clock_timestamp()
    WHERE id = (v_item->>'operator_id')::uuid
      AND role = 'operator';

    IF FOUND THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'count', v_count
  );
END;
$$;

-- 4. Permissions & Function Grants
REVOKE ALL ON FUNCTION public.get_hr_payroll_summary(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_hr_payroll_summary(date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_operator_payroll_rates(uuid, numeric, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_operator_payroll_rates(uuid, numeric, numeric) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.bulk_update_operator_payroll_rates(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_update_operator_payroll_rates(jsonb) TO authenticated, service_role;
