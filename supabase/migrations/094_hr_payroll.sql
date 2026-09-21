-- ============================================
-- Migration 094: HR Payroll — operator rate columns + payroll summary RPC
-- ============================================

-- 1. Add daily_rate and ot_hourly_rate to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS daily_rate NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ot_hourly_rate NUMERIC NOT NULL DEFAULT 0;

-- 2. Index for payroll queries (operator logs by date range)
CREATE INDEX IF NOT EXISTS idx_machine_hour_logs_operator_logdate
  ON public.machine_hour_logs(operator_id, log_date);

-- 3. Payroll summary RPC
-- p_payroll_month: first day of the payroll run month (e.g. '2026-09-01')
-- Formula: regular_pay = work_days(prev month) × daily_rate
--          ot_pay      = ot_hours(prev-prev month) × ot_hourly_rate
--          total_pay   = regular_pay + ot_pay
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
  v_regular_start date;
  v_regular_end   date;
  v_ot_start      date;
  v_ot_end        date;
  v_result        jsonb;
BEGIN
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

-- 4. Permissions
REVOKE ALL ON FUNCTION public.get_hr_payroll_summary(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_hr_payroll_summary(date) TO authenticated, service_role;
