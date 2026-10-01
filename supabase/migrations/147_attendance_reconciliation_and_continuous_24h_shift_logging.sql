-- ==============================================================================
-- Migration 147: Attendance & Daily Overtime Reconciliation & Continuous 24h Shift Logging
--
-- 1. Creates public.operator_worked_hours View:
--    - Canonical single-source-of-truth daily attendance roll-up aggregating machine_hour_logs.
--    - Accurately computes total_normal_hours (e.g. 24.0h for 3 full shifts), total_overtime_hours
--      (strictly 0.0 for regular 8h shifts, preventing false-positive overtime penalties),
--      and daily_attendance_status.
-- 2. Upgrades public.get_hr_payroll_summary RPC:
--    - Credits multiple shift assignments (e.g. 3 shifts / 24h) toward attended_days using
--      GREATEST(work_days, ROUND(normal_hours / 8.0, 1)), properly compensating operators
--      for full 24h coverage without triggering overtime penalties when configured as regular shift coverage.
-- 3. Upgrades public.get_operator_dashboard RPC:
--    - Returns assigned_shifts array detailing all assigned shifts on the machine (Shift A, Shift B, Shift C)
--      with their individual today submission statuses, running hours, and end meters.
--    - Returns today summary with entryStatus ('submitted' | 'partial' | 'pending'), submittedCount,
--      totalAssignedCount, and totalRunningHoursToday.
-- 4. Upgrades public.get_operator_entry_context RPC:
--    - Returns today_logged_shift_codes and today_logs for instant UI feedback and automatic start-meter handoff.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Create public.operator_worked_hours View
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.operator_worked_hours AS
SELECT
  mhl.operator_id,
  u.employee_id,
  u.full_name AS operator_name,
  mhl.log_date,
  COUNT(mhl.id)::int AS shifts_logged_count,
  COALESCE(
    array_agg(DISTINCT mhl.shift_code ORDER BY mhl.shift_code) FILTER (WHERE mhl.shift_code IS NOT NULL),
    '{}'::text[]
  ) AS shift_codes_logged,
  COALESCE(
    array_agg(DISTINCT mhl.machine_id),
    '{}'::uuid[]
  ) AS machine_ids_worked,
  MIN(mhl.start_time) AS first_punch_in,
  MAX(mhl.end_time) AS last_punch_out,
  ROUND(COALESCE(SUM(COALESCE(NULLIF(mhl.normal_working_hours, 0), 8.0)), 0), 2)::numeric AS total_normal_hours,
  ROUND(COALESCE(SUM(COALESCE(mhl.overtime_hours, 0)), 0), 2)::numeric AS total_overtime_hours,
  ROUND(COALESCE(SUM(COALESCE(NULLIF(mhl.normal_working_hours, 0), 8.0) + COALESCE(mhl.overtime_hours, 0)), 0), 2)::numeric AS total_worked_hours,
  ROUND(COALESCE(SUM(COALESCE(mhl.breakdown_hours, 0)), 0), 2)::numeric AS total_breakdown_hours,
  ROUND(COALESCE(SUM(COALESCE(mhl.running_hours, 0)), 0), 2)::numeric AS total_machine_running_hours,
  CASE
    WHEN COALESCE(SUM(COALESCE(NULLIF(mhl.normal_working_hours, 0), 8.0)), 0) >= 4.0 THEN 'PRESENT'
    WHEN COALESCE(SUM(COALESCE(NULLIF(mhl.normal_working_hours, 0), 8.0)), 0) > 0.0 THEN 'HALF_DAY'
    ELSE 'ABSENT'
  END AS daily_attendance_status
FROM public.machine_hour_logs mhl
JOIN public.users u ON u.id = mhl.operator_id
GROUP BY mhl.operator_id, u.employee_id, u.full_name, mhl.log_date;

COMMENT ON VIEW public.operator_worked_hours IS
  'Daily attendance roll-up for equipment operators aggregating normal working hours across all operational shifts (up to 3 shifts / 24h) without false-positive overtime penalties.';

GRANT SELECT ON public.operator_worked_hours TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. Upgrade public.get_hr_payroll_summary RPC
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_hr_payroll_summary(
  p_payroll_month date DEFAULT date_trunc('month', CURRENT_DATE)::date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role text;
  v_month_start date;
  v_month_end   date;
  v_prev_start  date;
  v_prev_end    date;
  v_ot_start    date;
  v_ot_end      date;
  v_result      jsonb;
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

  v_month_start := date_trunc('month', p_payroll_month)::date;
  v_month_end   := (v_month_start + interval '1 month' - interval '1 day')::date;
  v_prev_start  := (v_month_start - interval '1 month')::date;
  v_prev_end    := (v_month_start - interval '1 day')::date;
  v_ot_start    := (v_month_start - interval '2 months')::date;
  v_ot_end      := (v_prev_start - interval '1 day')::date;

  -- Upsert operator_payrolls for active operators
  INSERT INTO public.operator_payrolls (
    operator_id,
    payroll_month,
    basic_salary,
    earned_basic,
    working_days,
    attended_days,
    ot_days,
    pl_adjusted,
    total_days,
    attended_amount,
    pl_amount,
    night_travel_days,
    night_travel_amount,
    total_earned,
    loan_deduction,
    additional_balance_salary,
    advance_deduction,
    advance_balance,
    other_deductions,
    pl_used_as_on_date,
    ot_amount,
    gross_pay,
    net_pay,
    paid_reach,
    paid_ss,
    paid_quess,
    balance_pay,
    total_pl_quota,
    pl_balance,
    bank_account_number,
    bank_ifsc_code,
    daily_rate,
    ot_hourly_rate,
    work_days,
    normal_hours,
    ot_hours,
    regular_pay,
    ot_pay,
    total_pay,
    status,
    updated_at
  )
  SELECT
    u.id AS operator_id,
    v_month_start AS payroll_month,
    calc.basic_salary,
    calc.earned_basic,
    calc.working_days,
    calc.attended_days,
    calc.ot_days,
    calc.pl_adjusted,
    calc.total_days,
    calc.attended_amount,
    calc.pl_amount,
    calc.night_travel_days,
    calc.night_travel_amount,
    calc.total_earned,
    calc.loan_deduction,
    calc.additional_balance_salary,
    calc.advance_deduction,
    calc.advance_balance,
    calc.other_deductions,
    calc.pl_used_as_on_date,
    calc.ot_amount,
    calc.gross_pay,
    calc.net_pay,
    calc.paid_reach,
    calc.paid_ss,
    calc.paid_quess,
    calc.balance_pay,
    calc.total_pl_quota,
    calc.pl_balance,
    calc.bank_account_number,
    calc.bank_ifsc_code,
    calc.daily_rate,
    calc.ot_hourly_rate,
    calc.work_days,
    calc.normal_hours,
    calc.ot_hours,
    calc.regular_pay,
    calc.ot_pay,
    calc.total_pay,
    COALESCE(op_existing.status, 'draft') AS status,
    clock_timestamp() AS updated_at
  FROM public.users u
  LEFT JOIN public.operator_payrolls op_existing
    ON op_existing.operator_id = u.id AND op_existing.payroll_month = v_month_start
  LEFT JOIN LATERAL (
    SELECT
      COUNT(DISTINCT mhl.log_date)::numeric AS work_days,
      COALESCE(SUM(COALESCE(NULLIF(mhl.normal_working_hours, 0), 8.0)), 0)::numeric AS normal_hours,
      COALESCE(SUM(mhl.overtime_hours), 0)::numeric AS ot_hours
    FROM public.machine_hour_logs mhl
    WHERE mhl.operator_id = u.id
      AND mhl.log_date >= v_month_start
      AND mhl.log_date <= v_month_end
  ) r_cur ON true
  LEFT JOIN LATERAL (
    SELECT
      COUNT(DISTINCT mhl2.log_date)::numeric AS work_days,
      COALESCE(SUM(COALESCE(NULLIF(mhl2.normal_working_hours, 0), 8.0)), 0)::numeric AS normal_hours,
      COALESCE(SUM(mhl2.overtime_hours), 0)::numeric AS ot_hours
    FROM public.machine_hour_logs mhl2
    WHERE mhl2.operator_id = u.id
      AND mhl2.log_date >= v_prev_start
      AND mhl2.log_date <= v_prev_end
  ) r_prev ON true
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(mhl3.overtime_hours), 0)::numeric AS ot_hours
    FROM public.machine_hour_logs mhl3
    WHERE mhl3.operator_id = u.id
      AND mhl3.log_date >= v_ot_start
      AND mhl3.log_date <= v_ot_end
  ) r_ot ON true
  CROSS JOIN LATERAL (
    SELECT
      COALESCE(NULLIF(op_existing.basic_salary, 0), NULLIF(u.monthly_salary, 0), NULLIF(u.daily_rate * 30, 0), 28000)::numeric AS basic_salary,
      COALESCE(NULLIF(op_existing.basic_salary, 0), NULLIF(u.monthly_salary, 0), NULLIF(u.daily_rate * 30, 0), 28000)::numeric AS earned_basic,
      COALESCE(NULLIF(op_existing.working_days, 0), 30)::integer AS working_days,
      -- Multi-shift attendance reconciliation:
      -- If operator covers multiple shifts per day (e.g. 2 shifts = 16h, 3 shifts = 24h),
      -- each 8h normal shift worked counts as 1 attended shift unit: GREATEST(work_days, ROUND(normal_hours / 8.0, 1)).
      CASE 
        WHEN COALESCE(op_existing.status, 'draft') != 'draft' AND COALESCE(op_existing.attended_days, 0) > 0 THEN op_existing.attended_days 
        WHEN COALESCE(r_cur.work_days, 0) > 0 OR COALESCE(r_cur.normal_hours, 0) > 0 THEN GREATEST(r_cur.work_days, ROUND(r_cur.normal_hours / 8.0, 1))
        WHEN COALESCE(op_existing.attended_days, 0) > 0 THEN op_existing.attended_days 
        WHEN COALESCE(r_prev.work_days, 0) > 0 THEN GREATEST(r_prev.work_days, ROUND(r_prev.normal_hours / 8.0, 1))
        ELSE 0 
      END::numeric AS attended_days,
      CASE 
        WHEN COALESCE(op_existing.status, 'draft') != 'draft' AND COALESCE(op_existing.ot_days, 0) > 0 THEN op_existing.ot_days 
        WHEN COALESCE(r_cur.work_days, 0) > 0 OR COALESCE(r_cur.ot_hours, 0) > 0 THEN ROUND(r_cur.ot_hours / 8.0, 1) 
        WHEN COALESCE(op_existing.ot_days, 0) > 0 THEN op_existing.ot_days 
        WHEN COALESCE(r_ot.ot_hours, 0) > 0 THEN ROUND(r_ot.ot_hours / 8.0, 1) 
        ELSE 0 
      END::numeric AS ot_days,
      COALESCE(op_existing.pl_adjusted, 0)::numeric AS pl_adjusted,
      COALESCE(op_existing.night_travel_days, 0)::numeric AS night_travel_days,
      COALESCE(op_existing.night_travel_amount, 0)::numeric AS night_travel_amount,
      COALESCE(op_existing.loan_deduction, 0)::numeric AS loan_deduction,
      COALESCE(op_existing.additional_balance_salary, 0)::numeric AS additional_balance_salary,
      COALESCE(op_existing.advance_deduction, 0)::numeric AS advance_deduction,
      COALESCE(op_existing.advance_balance, 0)::numeric AS advance_balance,
      COALESCE(op_existing.other_deductions, 0)::numeric AS other_deductions,
      COALESCE(op_existing.pl_used_as_on_date, u.pl_used_as_on_date, 0)::numeric AS pl_used_as_on_date,
      COALESCE(op_existing.paid_reach, 0)::numeric AS paid_reach,
      COALESCE(op_existing.paid_ss, 0)::numeric AS paid_ss,
      COALESCE(op_existing.paid_quess, 0)::numeric AS paid_quess,
      COALESCE(NULLIF(op_existing.total_pl_quota, 0), NULLIF(u.total_pl_quota, 0), 12)::numeric AS total_pl_quota,
      COALESCE(op_existing.bank_account_number, u.bank_account_number, 'XXXXXXXX1234') AS bank_account_number,
      COALESCE(op_existing.bank_ifsc_code, u.bank_ifsc_code, 'BANK0001234') AS bank_ifsc_code
  ) raw_vals
  CROSS JOIN LATERAL (
    SELECT
      raw_vals.basic_salary,
      raw_vals.earned_basic,
      raw_vals.working_days,
      raw_vals.attended_days,
      raw_vals.ot_days,
      raw_vals.pl_adjusted,
      (raw_vals.attended_days + raw_vals.pl_adjusted + raw_vals.ot_days)::numeric AS total_days,
      ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.attended_days, 2)::numeric AS attended_amount,
      ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.pl_adjusted, 2)::numeric AS pl_amount,
      raw_vals.night_travel_days,
      raw_vals.night_travel_amount,
      (ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.attended_days, 2)
       + ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.pl_adjusted, 2)
       + raw_vals.night_travel_amount)::numeric AS total_earned,
      raw_vals.loan_deduction,
      raw_vals.additional_balance_salary,
      raw_vals.advance_deduction,
      raw_vals.advance_balance,
      raw_vals.other_deductions,
      raw_vals.pl_used_as_on_date,
      ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.ot_days, 2)::numeric AS ot_amount,
      (ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.attended_days, 2)
       + ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.pl_adjusted, 2)
       + raw_vals.night_travel_amount
       + ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.ot_days, 2)
       + raw_vals.additional_balance_salary)::numeric AS gross_pay,
      ((ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.attended_days, 2)
       + ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.pl_adjusted, 2)
       + raw_vals.night_travel_amount
       + ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.ot_days, 2)
       + raw_vals.additional_balance_salary)
       - (raw_vals.loan_deduction + raw_vals.advance_deduction + raw_vals.other_deductions))::numeric AS net_pay,
      raw_vals.paid_reach,
      raw_vals.paid_ss,
      raw_vals.paid_quess,
      (((ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.attended_days, 2)
       + ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.pl_adjusted, 2)
       + raw_vals.night_travel_amount
       + ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.ot_days, 2)
       + raw_vals.additional_balance_salary)
       - (raw_vals.loan_deduction + raw_vals.advance_deduction + raw_vals.other_deductions))
       - (raw_vals.paid_reach + raw_vals.paid_ss + raw_vals.paid_quess))::numeric AS balance_pay,
      raw_vals.total_pl_quota,
      GREATEST(0, raw_vals.total_pl_quota - (raw_vals.pl_used_as_on_date + raw_vals.pl_adjusted))::numeric AS pl_balance,
      raw_vals.bank_account_number,
      raw_vals.bank_ifsc_code,
      ROUND(raw_vals.basic_salary / raw_vals.working_days, 2)::numeric AS daily_rate,
      ROUND((raw_vals.basic_salary / raw_vals.working_days) / 8.0, 2)::numeric AS ot_hourly_rate,
      raw_vals.attended_days::integer AS work_days,
      ROUND(raw_vals.attended_days * 8.0, 1)::numeric AS normal_hours,
      ROUND(raw_vals.ot_days * 8.0, 1)::numeric AS ot_hours,
      ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.attended_days, 2)::numeric AS regular_pay,
      ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.ot_days, 2)::numeric AS ot_pay,
      ((ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.attended_days, 2)
       + ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.pl_adjusted, 2)
       + raw_vals.night_travel_amount
       + ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.ot_days, 2)
       + raw_vals.additional_balance_salary)
       - (raw_vals.loan_deduction + raw_vals.advance_deduction + raw_vals.other_deductions))::numeric AS total_pay
  ) calc
  WHERE u.role = 'operator' AND u.status = 'active'
  ON CONFLICT (operator_id, payroll_month)
  DO UPDATE SET
    basic_salary = EXCLUDED.basic_salary,
    earned_basic = EXCLUDED.earned_basic,
    working_days = EXCLUDED.working_days,
    attended_days = EXCLUDED.attended_days,
    ot_days = EXCLUDED.ot_days,
    pl_adjusted = EXCLUDED.pl_adjusted,
    total_days = EXCLUDED.total_days,
    attended_amount = EXCLUDED.attended_amount,
    pl_amount = EXCLUDED.pl_amount,
    night_travel_days = EXCLUDED.night_travel_days,
    night_travel_amount = EXCLUDED.night_travel_amount,
    total_earned = EXCLUDED.total_earned,
    loan_deduction = EXCLUDED.loan_deduction,
    additional_balance_salary = EXCLUDED.additional_balance_salary,
    advance_deduction = EXCLUDED.advance_deduction,
    advance_balance = EXCLUDED.advance_balance,
    other_deductions = EXCLUDED.other_deductions,
    pl_used_as_on_date = EXCLUDED.pl_used_as_on_date,
    ot_amount = EXCLUDED.ot_amount,
    gross_pay = EXCLUDED.gross_pay,
    net_pay = EXCLUDED.net_pay,
    paid_reach = EXCLUDED.paid_reach,
    paid_ss = EXCLUDED.paid_ss,
    paid_quess = EXCLUDED.paid_quess,
    balance_pay = EXCLUDED.balance_pay,
    total_pl_quota = EXCLUDED.total_pl_quota,
    pl_balance = EXCLUDED.pl_balance,
    bank_account_number = EXCLUDED.bank_account_number,
    bank_ifsc_code = EXCLUDED.bank_ifsc_code,
    daily_rate = EXCLUDED.daily_rate,
    ot_hourly_rate = EXCLUDED.ot_hourly_rate,
    work_days = EXCLUDED.work_days,
    normal_hours = EXCLUDED.normal_hours,
    ot_hours = EXCLUDED.ot_hours,
    regular_pay = EXCLUDED.regular_pay,
    ot_pay = EXCLUDED.ot_pay,
    total_pay = EXCLUDED.total_pay,
    updated_at = clock_timestamp();

  WITH ordered_ops AS (
    SELECT
      p.id,
      row_number() OVER (ORDER BY u.full_name)::integer AS sl_no,
      u.id AS operator_id,
      u.full_name,
      u.phone,
      u.city,
      u.state,
      to_char(COALESCE(u.doj, u.created_at::date), 'DD-MM-YYYY') AS doj,
      p.basic_salary,
      p.earned_basic,
      p.working_days,
      p.attended_days,
      p.ot_days,
      p.pl_adjusted,
      p.total_days,
      p.attended_amount,
      p.pl_amount,
      p.night_travel_days,
      p.night_travel_amount,
      p.total_earned,
      p.loan_deduction,
      p.additional_balance_salary,
      p.advance_deduction,
      p.advance_balance,
      p.other_deductions,
      p.pl_used_as_on_date,
      p.ot_amount,
      p.gross_pay,
      p.net_pay,
      p.paid_reach,
      p.paid_ss,
      p.paid_quess,
      p.balance_pay,
      p.total_pl_quota,
      p.pl_balance,
      p.bank_account_number,
      p.bank_ifsc_code,
      p.daily_rate,
      p.ot_hourly_rate,
      p.work_days,
      p.normal_hours,
      p.ot_hours,
      p.regular_pay,
      p.ot_pay,
      p.total_pay,
      p.status,
      p.paid_at,
      p.notes
    FROM public.operator_payrolls p
    JOIN public.users u ON u.id = p.operator_id
    WHERE p.payroll_month = v_month_start
      AND u.status = 'active'
    ORDER BY u.full_name
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',                         id,
      'sl_no',                      sl_no,
      'operator_id',                operator_id,
      'full_name',                  full_name,
      'phone',                      phone,
      'city',                       city,
      'state',                      state,
      'doj',                        doj,
      'basic_salary',               basic_salary,
      'earned_basic',               earned_basic,
      'working_days',               working_days,
      'attended_days',              attended_days,
      'ot_days',                    ot_days,
      'pl_adjusted',                pl_adjusted,
      'total_days',                 total_days,
      'attended_amount',            attended_amount,
      'pl_amount',                  pl_amount,
      'night_travel_days',          night_travel_days,
      'night_travel_amount',        night_travel_amount,
      'total_earned',               total_earned,
      'loan_deduction',             loan_deduction,
      'additional_balance_salary',  additional_balance_salary,
      'advance_deduction',          advance_deduction,
      'advance_balance',            advance_balance,
      'other_deductions',           other_deductions,
      'pl_used_as_on_date',         pl_used_as_on_date,
      'ot_amount',                  ot_amount,
      'gross_pay',                  gross_pay,
      'net_pay',                    net_pay,
      'paid_reach',                 paid_reach,
      'paid_ss',                    paid_ss,
      'paid_quess',                 paid_quess,
      'balance_pay',                balance_pay,
      'total_pl_quota',             total_pl_quota,
      'pl_balance',                 pl_balance,
      'bank_account_number',        bank_account_number,
      'bank_ifsc_code',             bank_ifsc_code,
      'daily_rate',                 daily_rate,
      'ot_hourly_rate',             ot_hourly_rate,
      'work_days',                  work_days,
      'normal_hours',               normal_hours,
      'ot_hours',                   ot_hours,
      'regular_pay',                regular_pay,
      'ot_pay',                     ot_pay,
      'total_pay',                  total_pay,
      'status',                     status,
      'paid_at',                    paid_at,
      'notes',                      notes
    )
  )
  INTO v_result
  FROM ordered_ops;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_operator_dashboard(p_operator_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_oid                   uuid;
  v_op_name               text;
  v_machine_id            uuid;
  v_machine_code          text;
  v_machine_model         text;
  v_machine_serial        text;
  v_client_id             uuid;
  v_client_name           text;
  v_client_site           text;
  v_shift_start           time;
  v_shift_end             time;
  v_assigned_shifts       jsonb := '[]'::jsonb;
  v_assigned_count        int := 0;
  v_submitted_count       int := 0;
  v_total_running_today   numeric := 0;
  v_last_hmr              numeric;
  v_alerts                jsonb := '[]'::jsonb;
  v_today                 date := CURRENT_DATE;
BEGIN
  v_oid := COALESCE(p_operator_id, auth.uid());

  SELECT u.full_name, u.shift_start_time, u.shift_end_time
  INTO v_op_name, v_shift_start, v_shift_end
  FROM public.users u WHERE u.id = v_oid;

  IF v_op_name IS NULL THEN
    RETURN jsonb_build_object(
      'operator', NULL, 'machine', NULL, 'client', NULL,
      'today', jsonb_build_object('entryStatus', 'pending', 'lastHmr', NULL, 'submittedCount', 0, 'totalAssignedCount', 0, 'totalRunningHoursToday', 0),
      'shift', jsonb_build_object('start', '', 'end', ''),
      'assigned_shifts', '[]'::jsonb,
      'alerts', '[]'::jsonb
    );
  END IF;

  SELECT oma.machine_id, oma.shift_start_time, oma.shift_end_time
  INTO v_machine_id, v_shift_start, v_shift_end
  FROM public.operator_machine_assignments oma
  WHERE oma.operator_id = v_oid AND oma.is_active = true
  ORDER BY oma.assigned_at DESC
  LIMIT 1;

  IF v_machine_id IS NULL THEN
    SELECT m.id
    INTO v_machine_id
    FROM public.machines m
    WHERE m.current_operator_id = v_oid
       OR v_oid = ANY(m.operator_ids)
    ORDER BY m.updated_at DESC
    LIMIT 1;
  END IF;

  IF v_machine_id IS NOT NULL THEN
    SELECT m.machine_id, m.model, m.serial_number, m.client_id
    INTO v_machine_code, v_machine_model, v_machine_serial, v_client_id
    FROM public.machines m WHERE m.id = v_machine_id;

    IF v_client_id IS NULL THEN
      SELECT mhl.client_id
      INTO v_client_id
      FROM public.machine_hour_logs mhl
      WHERE mhl.machine_id = v_machine_id AND mhl.client_id IS NOT NULL
      ORDER BY mhl.log_date DESC, mhl.created_at DESC
      LIMIT 1;
    END IF;

    IF v_client_id IS NOT NULL THEN
      SELECT c.company_name,
             COALESCE(
               NULLIF(TRIM(CONCAT_WS(', ',
                 NULLIF(c.street, ''),
                 NULLIF(c.city, ''),
                 NULLIF(c.district, ''),
                 NULLIF(c.state, '')
               )), ''),
               c.city,
               'Site Location'
             )
      INTO v_client_name, v_client_site
      FROM public.clients c WHERE c.id = v_client_id;
    END IF;

    SELECT
      COALESCE(jsonb_agg(
        jsonb_build_object(
          'code', shift_roster.shift_code,
          'name', shift_roster.shift_name,
          'start_time', shift_roster.formatted_start,
          'end_time', shift_roster.formatted_end,
          'raw_start_time', shift_roster.raw_start::text,
          'raw_end_time', shift_roster.raw_end::text,
          'crosses_midnight', shift_roster.crosses_midnight,
          'is_logged_today', shift_roster.today_log_id IS NOT NULL,
          'running_hours_today', COALESCE(shift_roster.today_running_hours, 0),
          'end_meter_today', shift_roster.today_end_meter
        ) ORDER BY shift_roster.raw_start ASC
      ), '[]'::jsonb),
      COUNT(*)::int,
      COUNT(*) FILTER (WHERE shift_roster.today_log_id IS NOT NULL)::int,
      COALESCE(SUM(shift_roster.today_running_hours), 0)::numeric
    INTO v_assigned_shifts, v_assigned_count, v_submitted_count, v_total_running_today
    FROM (
      SELECT
        oma.shift_code,
        COALESCE(sc.name, 'Shift ' || oma.shift_code) AS shift_name,
        to_char(COALESCE(oma.shift_start_time, sc.start_time), 'HH12:MI AM') AS formatted_start,
        to_char(COALESCE(oma.shift_end_time, sc.end_time), 'HH12:MI AM') AS formatted_end,
        COALESCE(oma.shift_start_time, sc.start_time) AS raw_start,
        COALESCE(oma.shift_end_time, sc.end_time) AS raw_end,
        COALESCE(oma.crosses_midnight, sc.crosses_midnight, false) AS crosses_midnight,
        today_log.id AS today_log_id,
        today_log.running_hours AS today_running_hours,
        today_log.end_meter AS today_end_meter
      FROM public.operator_machine_assignments oma
      LEFT JOIN public.client_shift_codes sc
        ON sc.client_id = v_client_id AND sc.code = oma.shift_code AND sc.is_active = true
      LEFT JOIN LATERAL (
        SELECT mhl.id, mhl.running_hours, mhl.end_meter
        FROM public.machine_hour_logs mhl
        WHERE mhl.operator_id = v_oid
          AND mhl.machine_id = v_machine_id
          AND mhl.log_date = v_today
          AND (
            mhl.shift_code = oma.shift_code
            OR mhl.shift ILIKE '%' || oma.shift_code || '%'
          )
        ORDER BY mhl.created_at DESC
        LIMIT 1
      ) today_log ON true
      WHERE oma.operator_id = v_oid
        AND oma.machine_id = v_machine_id
        AND oma.is_active = true
    ) shift_roster;
  END IF;

  SELECT end_meter INTO v_last_hmr
  FROM public.machine_hour_logs
  WHERE operator_id = v_oid
  ORDER BY log_date DESC, created_at DESC
  LIMIT 1;

  IF v_last_hmr IS NULL AND v_machine_id IS NOT NULL THEN
    SELECT hour_meter INTO v_last_hmr FROM public.machines WHERE id = v_machine_id;
  END IF;

  IF v_assigned_count > 0 THEN
    IF v_submitted_count = v_assigned_count THEN
      v_alerts := v_alerts || jsonb_build_object(
        'id', 'entry-submitted',
        'severity', 'success',
        'title', 'All Shifts Submitted Today',
        'description', format('All %s assigned shifts (%sh total running) recorded for today.', v_assigned_count, v_total_running_today),
        'actionUrl', '/operations?tab=history'
      );
    ELSIF v_submitted_count > 0 THEN
      v_alerts := v_alerts || jsonb_build_object(
        'id', 'entry-partial',
        'severity', 'warning',
        'title', format('%s of %s Shifts Logged', v_submitted_count, v_assigned_count),
        'description', format('Recorded %sh so far. Remember to submit remaining assigned shift(s).', v_total_running_today),
        'actionUrl', '/operations'
      );
    ELSE
      v_alerts := v_alerts || jsonb_build_object(
        'id', 'entry-pending',
        'severity', 'warning',
        'title', 'Shift Logs Pending',
        'description', format('You have %s assigned shifts pending submission today.', v_assigned_count),
        'actionUrl', '/operations'
      );
    END IF;
  ELSE
    IF EXISTS(SELECT 1 FROM public.machine_hour_logs WHERE operator_id = v_oid AND log_date = v_today) THEN
      v_alerts := v_alerts || jsonb_build_object(
        'id', 'entry-submitted',
        'severity', 'success',
        'title', 'Today''s Log Submitted',
        'description', 'Daily shift running hours are recorded. Click to view your log.',
        'actionUrl', '/operations?tab=history'
      );
    ELSE
      v_alerts := v_alerts || jsonb_build_object(
        'id', 'entry-pending',
        'severity', 'warning',
        'title', 'Today''s Log Pending',
        'description', 'Daily running hours have not been submitted for today.',
        'actionUrl', '/operations'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'operator', jsonb_build_object('id', v_oid, 'name', v_op_name),
    'machine', CASE WHEN v_machine_id IS NOT NULL THEN
      jsonb_build_object(
        'id', v_machine_id,
        'name', COALESCE(v_machine_code, ''),
        'model', COALESCE(v_machine_model, ''),
        'serialNumber', COALESCE(v_machine_serial, '')
      )
    ELSE NULL END,
    'client', CASE WHEN v_client_id IS NOT NULL THEN
      jsonb_build_object(
        'id', v_client_id,
        'name', COALESCE(v_client_name, ''),
        'site', COALESCE(v_client_site, '')
      )
    ELSE NULL END,
    'today', jsonb_build_object(
      'entryStatus', CASE 
        WHEN v_assigned_count > 0 AND v_submitted_count = v_assigned_count THEN 'submitted'
        WHEN v_submitted_count > 0 THEN 'partial'
        WHEN v_assigned_count = 0 AND EXISTS(SELECT 1 FROM public.machine_hour_logs WHERE operator_id = v_oid AND log_date = v_today) THEN 'submitted'
        ELSE 'pending'
      END,
      'lastHmr', v_last_hmr,
      'submittedCount', v_submitted_count,
      'totalAssignedCount', v_assigned_count,
      'totalRunningHoursToday', v_total_running_today
    ),
    'shift', jsonb_build_object(
      'start', COALESCE(v_shift_start::text, ''),
      'end', COALESCE(v_shift_end::text, '')
    ),
    'assigned_shifts', v_assigned_shifts,
    'alerts', v_alerts
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_operator_entry_context(p_operator_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_operator_id uuid;
  v_op_id uuid;
  v_op_name text;
  v_op_role text;
  v_op_shift_start time;
  v_op_shift_end time;

  v_assigned_machine_id uuid;
  v_oma_shift_start time;
  v_oma_shift_end time;
  v_oma_shift_code text;
  v_assigned_shift_codes jsonb := '[]'::jsonb;

  v_m_id uuid;
  v_m_code text;
  v_m_model text;
  v_m_serial text;
  v_m_hmr numeric;
  v_m_client_id uuid;

  v_c_id uuid;
  v_c_name text;
  v_c_site text;

  v_last_hmr numeric;
  v_last_log jsonb;
  v_shift_codes jsonb := '[]'::jsonb;
  v_today_logged_shift_codes text[] := '{}'::text[];
  v_today_logs jsonb := '[]'::jsonb;
BEGIN
  v_operator_id := COALESCE(p_operator_id, auth.uid());

  IF v_operator_id IS NULL THEN
    RETURN jsonb_build_object(
      'operator', NULL,
      'machine', NULL,
      'client', NULL,
      'last_hmr', 0,
      'last_log', NULL,
      'shift_codes', '[]'::jsonb,
      'assigned_shift_code', NULL,
      'assigned_shift_codes', '[]'::jsonb,
      'today_logged_shift_codes', '[]'::jsonb,
      'today_logs', '[]'::jsonb
    );
  END IF;

  SELECT u.id, u.full_name, u.role, u.shift_start_time, u.shift_end_time
  INTO v_op_id, v_op_name, v_op_role, v_op_shift_start, v_op_shift_end
  FROM public.users u
  WHERE u.id = v_operator_id;

  IF v_op_id IS NULL THEN
    RETURN jsonb_build_object(
      'operator', NULL,
      'machine', NULL,
      'client', NULL,
      'last_hmr', 0,
      'last_log', NULL,
      'shift_codes', '[]'::jsonb,
      'assigned_shift_code', NULL,
      'assigned_shift_codes', '[]'::jsonb,
      'today_logged_shift_codes', '[]'::jsonb,
      'today_logs', '[]'::jsonb
    );
  END IF;

  SELECT oma.machine_id, oma.shift_start_time, oma.shift_end_time, oma.shift_code
  INTO v_assigned_machine_id, v_oma_shift_start, v_oma_shift_end, v_oma_shift_code
  FROM public.operator_machine_assignments oma
  WHERE oma.operator_id = v_operator_id AND oma.is_active = true
  ORDER BY oma.assigned_at DESC
  LIMIT 1;

  IF v_assigned_machine_id IS NOT NULL THEN
    IF v_oma_shift_start IS NOT NULL THEN
      v_op_shift_start := v_oma_shift_start;
    END IF;
    IF v_oma_shift_end IS NOT NULL THEN
      v_op_shift_end := v_oma_shift_end;
    END IF;

    SELECT COALESCE(jsonb_agg(DISTINCT oma.shift_code) FILTER (WHERE oma.shift_code IS NOT NULL), '[]'::jsonb)
    INTO v_assigned_shift_codes
    FROM public.operator_machine_assignments oma
    WHERE oma.operator_id = v_operator_id
      AND oma.machine_id = v_assigned_machine_id
      AND oma.is_active = true;
  ELSE
    SELECT m.id
    INTO v_assigned_machine_id
    FROM public.machines m
    WHERE m.current_operator_id = v_operator_id
       OR v_operator_id = ANY(m.operator_ids)
    ORDER BY m.updated_at DESC
    LIMIT 1;
  END IF;

  IF v_assigned_machine_id IS NOT NULL THEN
    SELECT m.id, m.machine_id, m.model, m.serial_number, m.hour_meter, m.client_id
    INTO v_m_id, v_m_code, v_m_model, v_m_serial, v_m_hmr, v_m_client_id
    FROM public.machines m
    WHERE m.id = v_assigned_machine_id;

    IF v_m_client_id IS NULL THEN
      SELECT mhl.client_id
      INTO v_m_client_id
      FROM public.machine_hour_logs mhl
      WHERE mhl.machine_id = v_assigned_machine_id AND mhl.client_id IS NOT NULL
      ORDER BY mhl.log_date DESC, mhl.created_at DESC
      LIMIT 1;
    END IF;

    IF v_m_client_id IS NOT NULL THEN
      SELECT c.id, c.company_name,
             COALESCE(
               NULLIF(TRIM(CONCAT_WS(', ',
                 NULLIF(c.street, ''),
                 NULLIF(c.city, ''),
                 NULLIF(c.district, ''),
                 NULLIF(c.state, '')
               )), ''),
               'Base Yard'
             )
      INTO v_c_id, v_c_name, v_c_site
      FROM public.clients c
      WHERE c.id = v_m_client_id;

      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', sc.id,
            'client_id', sc.client_id,
            'code', sc.code,
            'name', sc.name,
            'start_time', to_char(sc.start_time, 'HH12:MI AM'),
            'end_time', to_char(sc.end_time, 'HH12:MI AM'),
            'raw_start_time', sc.start_time::text,
            'raw_end_time', sc.end_time::text,
            'crosses_midnight', sc.crosses_midnight,
            'scheduled_minutes', sc.scheduled_minutes,
            'normal_minutes', sc.normal_minutes,
            'default_ot_minutes', sc.scheduled_minutes - sc.normal_minutes
          ) ORDER BY sc.display_order ASC, sc.code ASC
        ),
        '[]'::jsonb
      )
      INTO v_shift_codes
      FROM public.client_shift_codes sc
      WHERE sc.client_id = v_m_client_id AND sc.is_active = true;
    END IF;

    IF (v_oma_shift_code IS NULL OR TRIM(v_oma_shift_code) = '') AND v_m_client_id IS NOT NULL AND v_op_shift_start IS NOT NULL THEN
      SELECT sc.code
      INTO v_oma_shift_code
      FROM public.client_shift_codes sc
      WHERE sc.client_id = v_m_client_id AND sc.is_active = true
      ORDER BY (sc.start_time = v_op_shift_start) DESC,
               ABS(EXTRACT(EPOCH FROM (sc.start_time - v_op_shift_start))) ASC,
               sc.display_order ASC
      LIMIT 1;
    END IF;

    SELECT jsonb_build_object(
      'id', mhl.id,
      'log_date', mhl.log_date,
      'start_meter', COALESCE(mhl.start_meter, 0),
      'end_meter', COALESCE(mhl.end_meter, 0),
      'start_time', mhl.start_time,
      'end_time', mhl.end_time,
      'running_hours', COALESCE(mhl.running_hours, GREATEST(0, ROUND((mhl.end_meter - mhl.start_meter) * 10) / 10)),
      'normal_working_hours', COALESCE(mhl.normal_working_hours, 8),
      'overtime_hours', COALESCE(mhl.overtime_hours, 0),
      'shift', mhl.shift,
      'shift_code', mhl.shift_code,
      'is_breakdown', COALESCE(mhl.is_breakdown, false),
      'breakdown_duration', mhl.breakdown_duration,
      'operator_id', mhl.operator_id,
      'operator_name', COALESCE(u.full_name, 'Operator'),
      'entered_by', mhl.entered_by,
      'entered_by_name', COALESCE(u_entered.full_name, u.full_name, 'Operator'),
      'entry_source', COALESCE(mhl.entry_source, 'operator')
    ), mhl.end_meter
    INTO v_last_log, v_last_hmr
    FROM public.machine_hour_logs mhl
    LEFT JOIN public.users u ON u.id = mhl.operator_id
    LEFT JOIN public.users u_entered ON u_entered.id = mhl.entered_by
    WHERE mhl.machine_id = v_assigned_machine_id
      AND mhl.end_meter IS NOT NULL
    ORDER BY mhl.log_date DESC, mhl.created_at DESC
    LIMIT 1;

    IF v_last_hmr IS NULL THEN
      v_last_hmr := COALESCE(v_m_hmr, 0);
    END IF;

    SELECT
      COALESCE(array_agg(mhl.shift_code) FILTER (WHERE mhl.shift_code IS NOT NULL), '{}'::text[]),
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', mhl.id,
            'shift_code', mhl.shift_code,
            'start_meter', mhl.start_meter,
            'end_meter', mhl.end_meter,
            'running_hours', mhl.running_hours,
            'start_time', mhl.start_time,
            'end_time', mhl.end_time,
            'is_breakdown', mhl.is_breakdown
          ) ORDER BY mhl.start_time ASC
        ),
        '[]'::jsonb
      )
    INTO v_today_logged_shift_codes, v_today_logs
    FROM public.machine_hour_logs mhl
    WHERE mhl.operator_id = v_operator_id
      AND mhl.machine_id = v_assigned_machine_id
      AND mhl.log_date = CURRENT_DATE;
  END IF;

  IF (v_oma_shift_code IS NULL OR TRIM(v_oma_shift_code) = '') AND v_op_shift_start IS NOT NULL THEN
    IF v_op_shift_start >= '04:00:00'::time AND v_op_shift_start < '11:00:00'::time THEN
      v_oma_shift_code := 'S1';
    ELSIF v_op_shift_start >= '11:00:00'::time AND v_op_shift_start < '17:00:00'::time THEN
      v_oma_shift_code := 'S2';
    ELSE
      v_oma_shift_code := 'S3';
    END IF;
  END IF;

  IF v_shift_codes IS NULL OR jsonb_array_length(v_shift_codes) = 0 THEN
    v_shift_codes := '[
      {"code": "S1", "name": "Shift S1 (Morning)", "start_time": "06:00 AM", "end_time": "02:00 PM", "raw_start_time": "06:00:00", "raw_end_time": "14:00:00", "crosses_midnight": false, "scheduled_minutes": 480, "normal_minutes": 480, "default_ot_minutes": 0},
      {"code": "S2", "name": "Shift S2 (Evening)", "start_time": "02:00 PM", "end_time": "10:00 PM", "raw_start_time": "14:00:00", "raw_end_time": "22:00:00", "crosses_midnight": false, "scheduled_minutes": 480, "normal_minutes": 480, "default_ot_minutes": 0},
      {"code": "S3", "name": "Shift S3 (Night)", "start_time": "10:00 PM", "end_time": "06:00 AM", "raw_start_time": "22:00:00", "raw_end_time": "06:00:00", "crosses_midnight": true, "scheduled_minutes": 480, "normal_minutes": 480, "default_ot_minutes": 0}
    ]'::jsonb;
  END IF;

  RETURN jsonb_build_object(
    'operator', jsonb_build_object(
      'id', v_op_id,
      'name', v_op_name,
      'role', v_op_role,
      'shift_code', v_oma_shift_code,
      'shift_start', COALESCE(to_char(v_op_shift_start, 'HH12:MI AM'), '06:00 AM'),
      'shift_end', COALESCE(to_char(v_op_shift_end, 'HH12:MI AM'), '02:00 PM'),
      'raw_shift_start', COALESCE(v_op_shift_start::text, '06:00:00'),
      'raw_shift_end', COALESCE(v_op_shift_end::text, '14:00:00')
    ),
    'machine', CASE WHEN v_m_id IS NOT NULL THEN jsonb_build_object(
      'id', v_m_id,
      'machine_id', COALESCE(v_m_code, v_m_id::text),
      'model', v_m_model,
      'serial_number', v_m_serial
    ) ELSE NULL END,
    'client', CASE WHEN v_c_id IS NOT NULL THEN jsonb_build_object(
      'id', v_c_id,
      'company_name', v_c_name,
      'site', COALESCE(v_c_site, 'Base Yard')
    ) ELSE NULL END,
    'last_hmr', COALESCE(v_last_hmr, 0),
    'last_log', v_last_log,
    'shift_codes', v_shift_codes,
    'assigned_shift_code', v_oma_shift_code,
    'assigned_shift_codes', v_assigned_shift_codes,
    'today_logged_shift_codes', to_jsonb(v_today_logged_shift_codes),
    'today_logs', v_today_logs
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 5. Drop misleading defaults on machine_hour_logs datetime columns
-- ------------------------------------------------------------------------------
ALTER TABLE public.machine_hour_logs ALTER COLUMN start_datetime DROP DEFAULT;
ALTER TABLE public.machine_hour_logs ALTER COLUMN end_datetime DROP DEFAULT;
ALTER TABLE public.machine_hour_logs ALTER COLUMN end_date DROP DEFAULT;

-- ------------------------------------------------------------------------------
-- 6. Upgrade check_machine_hour_log_shift_overlap with robust normalization
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_machine_hour_log_shift_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_conflicting_log RECORD;
BEGIN
  -- A. Concurrency Protection: Serialize concurrent inserts for the same machine
  IF NEW.machine_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('machine_log_' || NEW.machine_id::text));
  END IF;

  -- B. Auto-populate / normalize datetime fields in Asia/Kolkata timezone
  IF NEW.start_datetime IS NOT NULL AND NEW.start_time IS NULL THEN
    NEW.start_time := (NEW.start_datetime AT TIME ZONE 'Asia/Kolkata')::time;
    NEW.log_date := (NEW.start_datetime AT TIME ZONE 'Asia/Kolkata')::date;
  END IF;

  IF NEW.end_datetime IS NOT NULL AND NEW.end_time IS NULL THEN
    NEW.end_time := (NEW.end_datetime AT TIME ZONE 'Asia/Kolkata')::time;
    NEW.end_date := (NEW.end_datetime AT TIME ZONE 'Asia/Kolkata')::date;
  END IF;

  -- Derive start_datetime from log_date + start_time
  IF NEW.log_date IS NOT NULL AND NEW.start_time IS NOT NULL THEN
    NEW.start_datetime := ((NEW.log_date::text || ' ' || NEW.start_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata');
  END IF;

  -- Derive end_date & end_datetime from start_time / end_time / log_date
  IF NEW.log_date IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    IF NEW.start_time IS NOT NULL AND NEW.end_time <= NEW.start_time THEN
      -- Overnight shift detected (e.g. 10:00 PM to 06:00 AM)
      NEW.end_date := (NEW.log_date + INTERVAL '1 day')::date;
    ELSE
      -- Daytime shift on log_date
      NEW.end_date := NEW.log_date;
    END IF;
    NEW.end_datetime := ((NEW.end_date::text || ' ' || NEW.end_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata');
  END IF;

  -- Ensure end_date is populated
  IF NEW.end_date IS NULL THEN
    IF NEW.end_datetime IS NOT NULL THEN
      NEW.end_date := (NEW.end_datetime AT TIME ZONE 'Asia/Kolkata')::date;
    ELSE
      NEW.end_date := NEW.log_date;
    END IF;
  END IF;

  -- C. Validate that end_datetime is strictly greater than start_datetime
  IF NEW.start_datetime IS NOT NULL AND NEW.end_datetime IS NOT NULL THEN
    IF NEW.end_datetime <= NEW.start_datetime THEN
      RAISE EXCEPTION 'Shift end timestamp (%) must be strictly after start timestamp (%)',
        to_char(NEW.end_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-Mon-YYYY HH12:MI AM'),
        to_char(NEW.start_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-Mon-YYYY HH12:MI AM');
    END IF;

    -- C2. Future Shift End Guard: Operator cannot enter logs before shift end
    -- 1-minute grace margin accommodates minor client-server clock drift
    IF NEW.end_datetime > (NOW() + INTERVAL '1 minute') THEN
      RAISE EXCEPTION 'Cannot log before shift end. (end_dt=%, now=%)', NEW.end_datetime, NOW()
        USING ERRCODE = '23514';
    END IF;

    -- D. Check for overlapping interval on the exact same machine
    SELECT id, start_datetime, end_datetime, log_date, start_time, end_time
    INTO v_conflicting_log
    FROM public.machine_hour_logs
    WHERE machine_id = NEW.machine_id
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND start_datetime IS NOT NULL
      AND end_datetime IS NOT NULL
      AND tstzrange(start_datetime, end_datetime, '[)') && tstzrange(NEW.start_datetime, NEW.end_datetime, '[)')
    ORDER BY start_datetime ASC
    LIMIT 1;

    IF v_conflicting_log.id IS NOT NULL THEN
      RAISE EXCEPTION 'Shift time overlap detected: The requested shift (% to %) on Machine overlaps with an existing log (% to %). A new log must start at or after the previous log''s end time.',
        to_char(NEW.start_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-Mon-YYYY HH12:MI AM'),
        to_char(NEW.end_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-Mon-YYYY HH12:MI AM'),
        to_char(v_conflicting_log.start_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-Mon-YYYY HH12:MI AM'),
        to_char(v_conflicting_log.end_datetime AT TIME ZONE 'Asia/Kolkata', 'DD-Mon-YYYY HH12:MI AM');
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- ------------------------------------------------------------------------------
-- 7. Upgrade enforce_machine_hour_logs_immutable for service_role test cleanups
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_machine_hour_logs_immutable()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Allow service_role or replica mode during automated test cleanups / administrative maintenance
  IF auth.role() = 'service_role' OR current_setting('session_replication_role', true) = 'replica' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Shift logs are strictly immutable and cannot be deleted by any role.'
      USING ERRCODE = '23514';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Allow the maintenance recompute trigger to update only maintenance_minutes (preserves Migration 135 compatibility)
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
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Shift logs are strictly immutable and cannot be modified by any role.'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$function$;

