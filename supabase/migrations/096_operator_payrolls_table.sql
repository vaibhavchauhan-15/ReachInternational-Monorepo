-- ==============================================================================
-- Migration 096: Normalized Operator Payrolls Table & Relational Architecture
-- Creates public.operator_payrolls linking to public.users(id) via foreign key
-- eliminating duplicate operator information and providing optimized data structures.
-- ==============================================================================

-- 1. Create normalized operator_payrolls table
CREATE TABLE IF NOT EXISTS public.operator_payrolls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  payroll_month DATE NOT NULL,
  daily_rate NUMERIC NOT NULL DEFAULT 0 CHECK (daily_rate >= 0),
  ot_hourly_rate NUMERIC NOT NULL DEFAULT 0 CHECK (ot_hourly_rate >= 0),
  work_days INTEGER NOT NULL DEFAULT 0 CHECK (work_days >= 0),
  normal_hours NUMERIC NOT NULL DEFAULT 0 CHECK (normal_hours >= 0),
  ot_hours NUMERIC NOT NULL DEFAULT 0 CHECK (ot_hours >= 0),
  regular_pay NUMERIC NOT NULL DEFAULT 0 CHECK (regular_pay >= 0),
  ot_pay NUMERIC NOT NULL DEFAULT 0 CHECK (ot_pay >= 0),
  total_pay NUMERIC NOT NULL DEFAULT 0 CHECK (total_pay >= 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'approved', 'paid')),
  paid_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT uq_operator_payrolls_operator_month UNIQUE (operator_id, payroll_month)
);

-- 2. Optimize queries with dedicated B-tree indexes
CREATE INDEX IF NOT EXISTS idx_operator_payrolls_month 
  ON public.operator_payrolls(payroll_month);

CREATE INDEX IF NOT EXISTS idx_operator_payrolls_operator_id 
  ON public.operator_payrolls(operator_id);

CREATE INDEX IF NOT EXISTS idx_operator_payrolls_status 
  ON public.operator_payrolls(status);

CREATE INDEX IF NOT EXISTS idx_operator_payrolls_approved_by 
  ON public.operator_payrolls(approved_by) 
  WHERE approved_by IS NOT NULL;

-- 3. Row Level Security (RLS)
ALTER TABLE public.operator_payrolls ENABLE ROW LEVEL SECURITY;

-- Management policy: super_admin, admin, manager, hr have full access
DROP POLICY IF EXISTS "operator_payrolls_management_all" ON public.operator_payrolls;
CREATE POLICY "operator_payrolls_management_all"
  ON public.operator_payrolls
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid())
        AND role IN ('super_admin', 'admin', 'manager', 'hr')
        AND status = 'active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (SELECT auth.uid())
        AND role IN ('super_admin', 'admin', 'manager', 'hr')
        AND status = 'active'
    )
  );

-- Operator self policy: operators can view their own payroll records
DROP POLICY IF EXISTS "operator_payrolls_self_select" ON public.operator_payrolls;
CREATE POLICY "operator_payrolls_self_select"
  ON public.operator_payrolls
  FOR SELECT
  TO authenticated
  USING (
    operator_id = (SELECT auth.uid())
  );

-- 4. High-Performance Relational HR Payroll Summary RPC
-- Computes days and hours, syncs persistent records into public.operator_payrolls,
-- and imports operator identity details dynamically via JOIN with public.users.
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

  -- Sync / upsert operator_payrolls rows for active operators for this payroll month
  INSERT INTO public.operator_payrolls (
    operator_id,
    payroll_month,
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
    p_payroll_month AS payroll_month,
    COALESCE(op_existing.daily_rate, u.daily_rate, 0) AS daily_rate,
    COALESCE(op_existing.ot_hourly_rate, u.ot_hourly_rate, 0) AS ot_hourly_rate,
    COALESCE(r.work_days, 0) AS work_days,
    COALESCE(r.normal_hours, 0) AS normal_hours,
    COALESCE(o.ot_hours, 0) AS ot_hours,
    (COALESCE(r.work_days, 0) * COALESCE(op_existing.daily_rate, u.daily_rate, 0)) AS regular_pay,
    (COALESCE(o.ot_hours, 0) * COALESCE(op_existing.ot_hourly_rate, u.ot_hourly_rate, 0)) AS ot_pay,
    ((COALESCE(r.work_days, 0) * COALESCE(op_existing.daily_rate, u.daily_rate, 0))
      + (COALESCE(o.ot_hours, 0) * COALESCE(op_existing.ot_hourly_rate, u.ot_hourly_rate, 0))) AS total_pay,
    COALESCE(op_existing.status, 'draft') AS status,
    clock_timestamp() AS updated_at
  FROM public.users u
  LEFT JOIN public.operator_payrolls op_existing
    ON op_existing.operator_id = u.id AND op_existing.payroll_month = p_payroll_month
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
    AND u.status = 'active'
  ON CONFLICT (operator_id, payroll_month) DO UPDATE SET
    work_days = EXCLUDED.work_days,
    normal_hours = EXCLUDED.normal_hours,
    ot_hours = EXCLUDED.ot_hours,
    regular_pay = EXCLUDED.work_days * public.operator_payrolls.daily_rate,
    ot_pay = EXCLUDED.ot_hours * public.operator_payrolls.ot_hourly_rate,
    total_pay = (EXCLUDED.work_days * public.operator_payrolls.daily_rate) + (EXCLUDED.ot_hours * public.operator_payrolls.ot_hourly_rate),
    updated_at = clock_timestamp();

  -- Build result by JOINING operator_payrolls with public.users (dynamic linking, zero duplication)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',             p.id,
      'operator_id',    u.id,
      'full_name',      u.full_name,
      'phone',          u.phone,
      'city',           u.city,
      'state',          u.state,
      'daily_rate',     p.daily_rate,
      'ot_hourly_rate', p.ot_hourly_rate,
      'work_days',      p.work_days,
      'normal_hours',   p.normal_hours,
      'ot_hours',       p.ot_hours,
      'regular_pay',    p.regular_pay,
      'ot_pay',         p.ot_pay,
      'total_pay',      p.total_pay,
      'status',         p.status,
      'paid_at',        p.paid_at,
      'notes',          p.notes
    ) ORDER BY u.full_name
  )
  INTO v_result
  FROM public.operator_payrolls p
  JOIN public.users u ON u.id = p.operator_id
  WHERE p.payroll_month = p_payroll_month
    AND u.status = 'active';

  RETURN jsonb_build_object(
    'payrollMonth',   to_char(p_payroll_month, 'YYYY-MM'),
    'regularPeriod',  to_char(v_regular_start, 'YYYY-MM-DD') || ' to ' || to_char(v_regular_end, 'YYYY-MM-DD'),
    'otPeriod',       to_char(v_ot_start, 'YYYY-MM-DD') || ' to ' || to_char(v_ot_end, 'YYYY-MM-DD'),
    'operators',      COALESCE(v_result, '[]'::jsonb)
  );
END;
$$;

-- 5. Updated Single Operator Rate Update RPC (Updates operator_payrolls and syncs users baseline)
CREATE OR REPLACE FUNCTION public.update_operator_payroll_rates(
  p_operator_id uuid,
  p_daily_rate numeric,
  p_ot_hourly_rate numeric,
  p_payroll_month date DEFAULT date_trunc('month', CURRENT_DATE)::date
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

  -- 1. Update persistent operator_payrolls record for targeted month
  UPDATE public.operator_payrolls
  SET
    daily_rate = v_clean_daily,
    ot_hourly_rate = v_clean_ot,
    regular_pay = work_days * v_clean_daily,
    ot_pay = ot_hours * v_clean_ot,
    total_pay = (work_days * v_clean_daily) + (ot_hours * v_clean_ot),
    updated_at = clock_timestamp()
  WHERE operator_id = p_operator_id
    AND payroll_month = p_payroll_month;

  -- 2. Also update baseline rates on users table
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

-- 6. Updated Bulk Operator Rates Update RPC
CREATE OR REPLACE FUNCTION public.bulk_update_operator_payroll_rates(
  p_updates jsonb,
  p_payroll_month date DEFAULT date_trunc('month', CURRENT_DATE)::date
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
  v_op_id uuid;
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
    v_op_id := (v_item->>'operator_id')::uuid;
    v_daily := NULL;
    v_ot := NULL;

    IF v_item ? 'daily_rate' AND v_item->>'daily_rate' IS NOT NULL THEN
      v_daily := GREATEST(0, (v_item->>'daily_rate')::numeric);
    END IF;

    IF v_item ? 'ot_hourly_rate' AND v_item->>'ot_hourly_rate' IS NOT NULL THEN
      v_ot := GREATEST(0, (v_item->>'ot_hourly_rate')::numeric);
    END IF;

    -- Update operator_payrolls record
    UPDATE public.operator_payrolls
    SET
      daily_rate = COALESCE(v_daily, daily_rate),
      ot_hourly_rate = COALESCE(v_ot, ot_hourly_rate),
      regular_pay = work_days * COALESCE(v_daily, daily_rate),
      ot_pay = ot_hours * COALESCE(v_ot, ot_hourly_rate),
      total_pay = (work_days * COALESCE(v_daily, daily_rate)) + (ot_hours * COALESCE(v_ot, ot_hourly_rate)),
      updated_at = clock_timestamp()
    WHERE operator_id = v_op_id
      AND payroll_month = p_payroll_month;

    -- Update baseline in public.users
    UPDATE public.users
    SET
      daily_rate = COALESCE(v_daily, daily_rate),
      ot_hourly_rate = COALESCE(v_ot, ot_hourly_rate),
      updated_at = clock_timestamp()
    WHERE id = v_op_id
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

-- 7. Permissions & Grants
REVOKE ALL ON TABLE public.operator_payrolls FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.operator_payrolls TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_hr_payroll_summary(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_hr_payroll_summary(date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_operator_payroll_rates(uuid, numeric, numeric, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_operator_payroll_rates(uuid, numeric, numeric, date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.bulk_update_operator_payroll_rates(jsonb, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bulk_update_operator_payroll_rates(jsonb, date) TO authenticated, service_role;
