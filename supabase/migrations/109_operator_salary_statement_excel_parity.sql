-- ==============================================================================
-- Migration 109: Operator Monthly Salary Statement — Full Excel Reference Parity
-- Implements complete industrial salary statement calculations across all operators:
-- Basic, Earned, W/D, A/D, OT Days, PL Adjusted, Total Days, Attended Amount,
-- PL Amount, Night/Travel Allowance, Loan Deductions, Advance Deductions,
-- Gross Pay, Net Pay, Payout Disbursements (Reach, S&S, Quess), Unpaid Balance,
-- Leave Quota & Remaining Balance Ledger, Bank Account & IFSC Code details.
-- ==============================================================================

-- 1. Add salary statement baseline columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS doj DATE DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_ifsc_code TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS total_pl_quota NUMERIC NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS pl_used_as_on_date NUMERIC NOT NULL DEFAULT 0;

-- Backfill users doj from created_at
UPDATE public.users
SET doj = created_at::date
WHERE doj IS NULL;

-- Backfill default bank account & IFSC for operators
UPDATE public.users
SET
  bank_account_number = COALESCE(bank_account_number, 'XXXXXXXX1234'),
  bank_ifsc_code = COALESCE(bank_ifsc_code, 'BANK0001234')
WHERE role = 'operator';

-- 2. Add full salary statement breakdown columns to operator_payrolls table
ALTER TABLE public.operator_payrolls
  ADD COLUMN IF NOT EXISTS basic_salary NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS earned_basic NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS working_days INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS attended_days NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ot_days NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pl_adjusted NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_days NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attended_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pl_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS night_travel_days NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS night_travel_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_earned NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS loan_deduction NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_balance_salary NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance_deduction NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS advance_balance NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_deductions NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pl_used_as_on_date NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ot_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_pay NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_pay NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_reach NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_ss NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_quess NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_pay NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_pl_quota NUMERIC NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS pl_balance NUMERIC NOT NULL DEFAULT 12,
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS bank_ifsc_code TEXT DEFAULT NULL;

-- 3. Comprehensive HR Payroll Summary RPC
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
      COALESCE(SUM(mhl.normal_working_hours), 0)::numeric AS normal_hours,
      COALESCE(SUM(mhl.overtime_hours), 0)::numeric AS ot_hours
    FROM public.machine_hour_logs mhl
    WHERE mhl.operator_id = u.id
      AND mhl.log_date >= v_month_start
      AND mhl.log_date <= v_month_end
  ) r_cur ON true
  LEFT JOIN LATERAL (
    SELECT
      COUNT(DISTINCT mhl2.log_date)::numeric AS work_days,
      COALESCE(SUM(mhl2.normal_working_hours), 0)::numeric AS normal_hours,
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
      CASE 
        WHEN COALESCE(op_existing.attended_days, 0) > 0 THEN op_existing.attended_days 
        WHEN COALESCE(r_cur.work_days, 0) > 0 THEN r_cur.work_days 
        WHEN COALESCE(r_prev.work_days, 0) > 0 THEN r_prev.work_days 
        ELSE 0 
      END::numeric AS attended_days,
      CASE 
        WHEN COALESCE(op_existing.ot_days, 0) > 0 THEN op_existing.ot_days 
        WHEN COALESCE(r_cur.ot_hours, 0) > 0 THEN ROUND(r_cur.ot_hours / 8.0, 1) 
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
      (ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.attended_days, 2)
       + ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.pl_adjusted, 2))::numeric AS regular_pay,
      ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.ot_days, 2)::numeric AS ot_pay,
      (ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.attended_days, 2)
       + ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.pl_adjusted, 2)
       + raw_vals.night_travel_amount
       + ROUND((raw_vals.basic_salary / raw_vals.working_days) * raw_vals.ot_days, 2)
       + raw_vals.additional_balance_salary)::numeric AS total_pay
  ) calc
  WHERE u.role = 'operator'
    AND u.status = 'active'
  ON CONFLICT (operator_id, payroll_month) DO UPDATE SET
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

  -- Build ordered output result matching exact Excel columns using CTE
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

  RETURN jsonb_build_object(
    'payrollMonth',   to_char(v_month_start, 'YYYY-MM'),
    'regularPeriod',  to_char(v_month_start, 'YYYY-MM-DD') || ' to ' || to_char(v_month_end, 'YYYY-MM-DD'),
    'otPeriod',       to_char(v_ot_start, 'YYYY-MM-DD') || ' to ' || to_char(v_ot_end, 'YYYY-MM-DD'),
    'operators',      COALESCE(v_result, '[]'::jsonb)
  );
END;
$$;

-- 4. Single Operator Full Statement Update RPC
CREATE OR REPLACE FUNCTION public.update_operator_salary_statement(
  p_operator_id uuid,
  p_payroll_month date,
  p_fields jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role text;
  v_month_start date;
  v_basic numeric;
  v_wd integer;
  v_ad numeric;
  v_ot_days numeric;
  v_pl_adj numeric;
  v_nt_days numeric;
  v_nt_amt numeric;
  v_loan numeric;
  v_add_bal numeric;
  v_adv_ded numeric;
  v_adv_bal numeric;
  v_other_ded numeric;
  v_pl_used numeric;
  v_paid_reach numeric;
  v_paid_ss numeric;
  v_paid_quess numeric;
  v_total_pl numeric;
  v_ac_no text;
  v_ifsc text;
  v_status text;
  v_notes text;

  -- Computed
  v_tot_days numeric;
  v_att_amt numeric;
  v_pl_amt numeric;
  v_tot_earned numeric;
  v_ot_amt numeric;
  v_gross numeric;
  v_net numeric;
  v_bal numeric;
  v_pl_bal numeric;
BEGIN
  -- Caller role validation
  IF auth.role() = 'authenticated' THEN
    SELECT role INTO v_caller_role
    FROM public.users
    WHERE id = auth.uid()
      AND status = 'active';

    IF v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'hr') THEN
      RAISE EXCEPTION 'Access denied: Salary statement updates are restricted to super_admin, admin, manager, and hr.';
    END IF;
  END IF;

  IF p_operator_id IS NULL THEN
    RAISE EXCEPTION 'Operator ID is required.';
  END IF;

  v_month_start := date_trunc('month', p_payroll_month)::date;

  -- Load existing or defaults
  SELECT
    COALESCE((p_fields->>'basic_salary')::numeric, p.basic_salary, u.monthly_salary, 28000),
    COALESCE((p_fields->>'working_days')::integer, p.working_days, 30),
    COALESCE((p_fields->>'attended_days')::numeric, p.attended_days, 0),
    COALESCE((p_fields->>'ot_days')::numeric, p.ot_days, 0),
    COALESCE((p_fields->>'pl_adjusted')::numeric, p.pl_adjusted, 0),
    COALESCE((p_fields->>'night_travel_days')::numeric, p.night_travel_days, 0),
    COALESCE((p_fields->>'night_travel_amount')::numeric, p.night_travel_amount, 0),
    COALESCE((p_fields->>'loan_deduction')::numeric, p.loan_deduction, 0),
    COALESCE((p_fields->>'additional_balance_salary')::numeric, p.additional_balance_salary, 0),
    COALESCE((p_fields->>'advance_deduction')::numeric, p.advance_deduction, 0),
    COALESCE((p_fields->>'advance_balance')::numeric, p.advance_balance, 0),
    COALESCE((p_fields->>'other_deductions')::numeric, p.other_deductions, 0),
    COALESCE((p_fields->>'pl_used_as_on_date')::numeric, p.pl_used_as_on_date, u.pl_used_as_on_date, 0),
    COALESCE((p_fields->>'paid_reach')::numeric, p.paid_reach, 0),
    COALESCE((p_fields->>'paid_ss')::numeric, p.paid_ss, 0),
    COALESCE((p_fields->>'paid_quess')::numeric, p.paid_quess, 0),
    COALESCE((p_fields->>'total_pl_quota')::numeric, p.total_pl_quota, u.total_pl_quota, 12),
    COALESCE(p_fields->>'bank_account_number', p.bank_account_number, u.bank_account_number, 'XXXXXXXX1234'),
    COALESCE(p_fields->>'bank_ifsc_code', p.bank_ifsc_code, u.bank_ifsc_code, 'BANK0001234'),
    COALESCE(p_fields->>'status', p.status, 'draft'),
    COALESCE(p_fields->>'notes', p.notes)
  INTO
    v_basic, v_wd, v_ad, v_ot_days, v_pl_adj, v_nt_days, v_nt_amt, v_loan, v_add_bal,
    v_adv_ded, v_adv_bal, v_other_ded, v_pl_used, v_paid_reach, v_paid_ss, v_paid_quess,
    v_total_pl, v_ac_no, v_ifsc, v_status, v_notes
  FROM public.users u
  LEFT JOIN public.operator_payrolls p
    ON p.operator_id = u.id AND p.payroll_month = v_month_start
  WHERE u.id = p_operator_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Operator not found.';
  END IF;

  -- Ensure working days > 0
  v_wd := GREATEST(1, v_wd);

  -- Perform exact calculations
  v_tot_days   := v_ad + v_pl_adj + v_ot_days;
  v_att_amt    := ROUND((v_basic / v_wd) * v_ad, 2);
  v_pl_amt     := ROUND((v_basic / v_wd) * v_pl_adj, 2);
  v_tot_earned := v_att_amt + v_pl_amt + v_nt_amt;
  v_ot_amt     := ROUND((v_basic / v_wd) * v_ot_days, 2);
  v_gross      := v_tot_earned + v_ot_amt + v_add_bal;
  v_net        := v_gross - (v_loan + v_adv_ded + v_other_ded);
  v_bal        := v_net - (v_paid_reach + v_paid_ss + v_paid_quess);
  v_pl_bal     := GREATEST(0, v_total_pl - (v_pl_used + v_pl_adj));

  -- Upsert operator_payrolls record
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
    notes,
    updated_at
  )
  VALUES (
    p_operator_id,
    v_month_start,
    v_basic,
    v_basic,
    v_wd,
    v_ad,
    v_ot_days,
    v_pl_adj,
    v_tot_days,
    v_att_amt,
    v_pl_amt,
    v_nt_days,
    v_nt_amt,
    v_tot_earned,
    v_loan,
    v_add_bal,
    v_adv_ded,
    v_adv_bal,
    v_other_ded,
    v_pl_used,
    v_ot_amt,
    v_gross,
    v_net,
    v_paid_reach,
    v_paid_ss,
    v_paid_quess,
    v_bal,
    v_total_pl,
    v_pl_bal,
    v_ac_no,
    v_ifsc,
    ROUND(v_basic / v_wd, 2),
    ROUND((v_basic / v_wd) / 8.0, 2),
    v_ad::integer,
    ROUND(v_ad * 8.0, 1),
    ROUND(v_ot_days * 8.0, 1),
    v_att_amt + v_pl_amt,
    v_ot_amt,
    v_gross,
    v_status,
    v_notes,
    clock_timestamp()
  )
  ON CONFLICT (operator_id, payroll_month) DO UPDATE SET
    basic_salary              = EXCLUDED.basic_salary,
    earned_basic              = EXCLUDED.earned_basic,
    working_days              = EXCLUDED.working_days,
    attended_days             = EXCLUDED.attended_days,
    ot_days                   = EXCLUDED.ot_days,
    pl_adjusted               = EXCLUDED.pl_adjusted,
    total_days                = EXCLUDED.total_days,
    attended_amount           = EXCLUDED.attended_amount,
    pl_amount                 = EXCLUDED.pl_amount,
    night_travel_days         = EXCLUDED.night_travel_days,
    night_travel_amount       = EXCLUDED.night_travel_amount,
    total_earned              = EXCLUDED.total_earned,
    loan_deduction            = EXCLUDED.loan_deduction,
    additional_balance_salary = EXCLUDED.additional_balance_salary,
    advance_deduction         = EXCLUDED.advance_deduction,
    advance_balance           = EXCLUDED.advance_balance,
    other_deductions          = EXCLUDED.other_deductions,
    pl_used_as_on_date        = EXCLUDED.pl_used_as_on_date,
    ot_amount                 = EXCLUDED.ot_amount,
    gross_pay                 = EXCLUDED.gross_pay,
    net_pay                   = EXCLUDED.net_pay,
    paid_reach                = EXCLUDED.paid_reach,
    paid_ss                   = EXCLUDED.paid_ss,
    paid_quess                = EXCLUDED.paid_quess,
    balance_pay               = EXCLUDED.balance_pay,
    total_pl_quota            = EXCLUDED.total_pl_quota,
    pl_balance                = EXCLUDED.pl_balance,
    bank_account_number       = EXCLUDED.bank_account_number,
    bank_ifsc_code            = EXCLUDED.bank_ifsc_code,
    daily_rate                = EXCLUDED.daily_rate,
    ot_hourly_rate            = EXCLUDED.ot_hourly_rate,
    work_days                 = EXCLUDED.work_days,
    normal_hours              = EXCLUDED.normal_hours,
    ot_hours                  = EXCLUDED.ot_hours,
    regular_pay               = EXCLUDED.regular_pay,
    ot_pay                    = EXCLUDED.ot_pay,
    total_pay                 = EXCLUDED.total_pay,
    status                    = EXCLUDED.status,
    notes                     = EXCLUDED.notes,
    updated_at                = clock_timestamp();

  -- Update baseline profile on users table
  UPDATE public.users
  SET
    bank_account_number = COALESCE(v_ac_no, bank_account_number),
    bank_ifsc_code      = COALESCE(v_ifsc, bank_ifsc_code),
    monthly_salary      = v_basic,
    daily_rate          = ROUND(v_basic / v_wd, 2),
    ot_hourly_rate      = ROUND((v_basic / v_wd) / 8.0, 2),
    total_pl_quota      = v_total_pl,
    pl_used_as_on_date  = v_pl_used,
    updated_at          = clock_timestamp()
  WHERE id = p_operator_id;

  RETURN jsonb_build_object(
    'success', true,
    'operator_id', p_operator_id,
    'payroll_month', to_char(v_month_start, 'YYYY-MM'),
    'gross_pay', v_gross,
    'net_pay', v_net,
    'balance_pay', v_bal
  );
END;
$$;

-- 5. Permissions
REVOKE ALL ON FUNCTION public.get_hr_payroll_summary(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_hr_payroll_summary(date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_operator_salary_statement(uuid, date, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_operator_salary_statement(uuid, date, jsonb) TO authenticated, service_role;
