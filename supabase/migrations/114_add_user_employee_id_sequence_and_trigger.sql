-- Migration 114: Add User Employee ID Sequence, Column, and Trigger
-- Ensures every employee in the system has a unique, sequential ID like EMP-0001, EMP-0002, etc.

-- 1. Create sequence for user employee IDs
CREATE SEQUENCE IF NOT EXISTS public.user_employee_id_seq START WITH 1;

-- 2. Add employee_id column to public.users if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'employee_id'
  ) THEN
    ALTER TABLE public.users ADD COLUMN employee_id text;
  END IF;
END $$;

-- 3. Backfill all existing users with clean sequential EMP-xxxx IDs
-- Management roles receive EMP-0001 through EMP-0005, then operators receive EMP-0006 through EMP-0105
WITH ranked_users AS (
  SELECT id,
         ROW_NUMBER() OVER (
           ORDER BY 
             CASE 
               WHEN role = 'super_admin' THEN 1 
               WHEN role = 'admin' THEN 2 
               WHEN role = 'manager' THEN 3 
               WHEN role = 'hr' THEN 4 
               WHEN role = 'supervisor' THEN 5 
               ELSE 6 
             END,
             full_name ASC,
             created_at ASC
         ) as rn
  FROM public.users
  WHERE employee_id IS NULL OR employee_id = ''
)
UPDATE public.users u
SET employee_id = 'EMP-' || LPAD(ru.rn::text, 4, '0')
FROM ranked_users ru
WHERE u.id = ru.id;

-- 4. Advance the sequence to the highest assigned number
SELECT setval(
  'public.user_employee_id_seq', 
  COALESCE(
    (SELECT MAX(SUBSTRING(employee_id FROM 5)::integer) 
     FROM public.users 
     WHERE employee_id ~ '^EMP-[0-9]+$'), 
    1
  )
);

-- 5. Trigger function to auto-assign EMP-xxxx on user insertion
CREATE OR REPLACE FUNCTION public.set_user_employee_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_id IS NULL OR TRIM(NEW.employee_id) = '' THEN
    NEW.employee_id := 'EMP-' || LPAD(nextval('public.user_employee_id_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_user_employee_id ON public.users;
CREATE TRIGGER trg_set_user_employee_id
BEFORE INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_user_employee_id();

-- 6. Enforce NOT NULL and UNIQUE constraint on public.users(employee_id)
ALTER TABLE public.users ALTER COLUMN employee_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_employee_id ON public.users(employee_id);

-- 7. Update get_attendance_daily_detail RPC to include employee_id
CREATE OR REPLACE FUNCTION public.get_attendance_daily_detail(
  p_employee_id uuid,
  p_year int,
  p_month int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_month_start date;
  v_month_end date;
  v_result jsonb;
  v_employee jsonb;
  v_days jsonb;
  v_weekday_rollup jsonb;
  v_summary jsonb;
  v_caller_role text;
BEGIN
  -- RBAC: only hr, admin, super_admin, supervisor, or self
  IF auth.role() = 'authenticated' THEN
    SELECT role INTO v_caller_role FROM public.users WHERE id = auth.uid();
    IF v_caller_role IS NULL OR (v_caller_role NOT IN ('super_admin', 'admin', 'hr', 'supervisor') AND auth.uid() <> p_employee_id) THEN
      RAISE EXCEPTION 'Unauthorized: attendance access denied' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_month_start := make_date(p_year, p_month, 1);
  v_month_end := (v_month_start + interval '1 month' - interval '1 day')::date;

  -- Employee info with authoritative employee_id
  SELECT jsonb_build_object(
    'id', u.id,
    'employee_id', u.employee_id,
    'full_name', u.full_name,
    'email', u.email,
    'phone', u.phone,
    'role', u.role,
    'city', u.city,
    'district', u.district,
    'state', u.state,
    'shift_start_time', u.shift_start_time,
    'shift_end_time', u.shift_end_time
  )
  INTO v_employee
  FROM public.users u
  WHERE u.id = p_employee_id;

  IF v_employee IS NULL THEN
    RETURN jsonb_build_object('error', 'Employee not found');
  END IF;

  -- Generate all days and aggregate in a single unified CTE statement
  WITH calendar AS (
    SELECT d::date AS cal_date,
           EXTRACT(DOW FROM d)::int AS dow
    FROM generate_series(v_month_start, v_month_end, interval '1 day') AS d
  ),
  daily_logs AS (
    SELECT
      mhl.log_date,
      MIN(mhl.start_time) AS punch_in,
      MAX(mhl.end_time) AS punch_out,
      COALESCE(SUM(mhl.running_hours), 0) AS worked_hours,
      COALESCE(SUM(mhl.normal_working_hours), 0) AS normal_hours,
      COALESCE(SUM(mhl.overtime_hours), 0) AS overtime_hours,
      COALESCE(SUM(COALESCE(mhl.breakdown_hours, 0)), 0) AS breakdown_hours,
      COUNT(mhl.id) AS log_count,
      bool_or(mhl.is_breakdown) AS has_breakdown,
      jsonb_agg(
        jsonb_build_object(
          'id', mhl.id,
          'machine_id', mhl.machine_id,
          'machine_code', COALESCE(m.machine_id, ''),
          'machine_name', COALESCE(m.machine_name, ''),
          'model', COALESCE(m.model, ''),
          'serial_number', COALESCE(m.serial_number, ''),
          'manufacturer', COALESCE(m.manufacturer, ''),
          'start_time', mhl.start_time,
          'end_time', mhl.end_time,
          'running_hours', mhl.running_hours,
          'normal_working_hours', mhl.normal_working_hours,
          'overtime_hours', mhl.overtime_hours,
          'start_meter', mhl.start_meter,
          'end_meter', mhl.end_meter,
          'is_breakdown', mhl.is_breakdown,
          'location', mhl.location,
          'remarks', mhl.remarks
        ) ORDER BY mhl.start_time ASC
      ) AS entries
    FROM public.machine_hour_logs mhl
    LEFT JOIN public.machines m ON m.id = mhl.machine_id
    WHERE mhl.operator_id = p_employee_id
      AND mhl.log_date BETWEEN v_month_start AND v_month_end
    GROUP BY mhl.log_date
  ),
  day_details AS (
    SELECT
      c.cal_date,
      c.dow,
      dl.punch_in,
      dl.punch_out,
      COALESCE(dl.worked_hours, 0) AS worked_hours,
      COALESCE(dl.normal_hours, 0) AS normal_hours,
      COALESCE(dl.overtime_hours, 0) AS overtime_hours,
      COALESCE(dl.breakdown_hours, 0) AS breakdown_hours,
      COALESCE(dl.log_count, 0) AS log_count,
      COALESCE(dl.has_breakdown, false) AS has_breakdown,
      COALESCE(dl.entries, '[]'::jsonb) AS entries,
      CASE
        WHEN c.dow = 0 THEN 'WEEK_OFF'
        WHEN dl.log_date IS NULL AND c.cal_date >= CURRENT_DATE THEN 'DISABLED'
        WHEN dl.log_date IS NULL THEN 'ABSENT'
        WHEN dl.normal_hours >= 4 THEN 'PRESENT'
        WHEN dl.normal_hours > 0 THEN 'HALF_DAY'
        ELSE 'ABSENT'
      END AS status
    FROM calendar c
    LEFT JOIN daily_logs dl ON dl.log_date = c.cal_date
  ),
  aggregated_days AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'date', to_char(dd.cal_date, 'YYYY-MM-DD'),
        'dow', dd.dow,
        'status', dd.status,
        'punch_in', dd.punch_in,
        'punch_out', dd.punch_out,
        'worked_minutes', ROUND(dd.worked_hours * 60)::int,
        'normal_minutes', ROUND(dd.normal_hours * 60)::int,
        'overtime_minutes', ROUND(dd.overtime_hours * 60)::int,
        'breakdown_minutes', ROUND(dd.breakdown_hours * 60)::int,
        'log_count', dd.log_count,
        'has_breakdown', dd.has_breakdown,
        'entries', dd.entries
      ) ORDER BY dd.cal_date ASC
    ) AS days_json
    FROM day_details dd
  ),
  aggregated_rollup AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'dow', roll.dow,
        'total_days', roll.total_days,
        'present_days', roll.present_days,
        'absent_days', roll.absent_days,
        'half_days', roll.half_days,
        'week_offs', roll.week_offs,
        'disabled_days', roll.disabled_days,
        'avg_worked_minutes', roll.avg_worked_minutes
      ) ORDER BY roll.dow ASC
    ) AS rollup_json
    FROM (
      SELECT
        dd.dow,
        COUNT(*)::int AS total_days,
        COUNT(*) FILTER (WHERE dd.status = 'PRESENT')::int AS present_days,
        COUNT(*) FILTER (WHERE dd.status = 'ABSENT' AND dd.cal_date < CURRENT_DATE)::int AS absent_days,
        COUNT(*) FILTER (WHERE dd.status = 'HALF_DAY')::int AS half_days,
        COUNT(*) FILTER (WHERE dd.status = 'WEEK_OFF')::int AS week_offs,
        COUNT(*) FILTER (WHERE dd.status = 'DISABLED')::int AS disabled_days,
        COALESCE(ROUND(AVG(dd.worked_hours * 60) FILTER (WHERE dd.status NOT IN ('WEEK_OFF', 'DISABLED')))::int, 0) AS avg_worked_minutes
      FROM day_details dd
      GROUP BY dd.dow
    ) roll
  ),
  aggregated_summary AS (
    SELECT jsonb_build_object(
      'payableDays', COALESCE(SUM(CASE WHEN dd.status = 'PRESENT' THEN 1 WHEN dd.status = 'HALF_DAY' THEN 0.5 WHEN dd.status = 'WEEK_OFF' THEN 1 ELSE 0 END), 0),
      'presentDays', COUNT(*) FILTER (WHERE dd.status = 'PRESENT')::int,
      'absentDays', COUNT(*) FILTER (WHERE dd.status = 'ABSENT' AND dd.cal_date < CURRENT_DATE)::int,
      'halfDays', COUNT(*) FILTER (WHERE dd.status = 'HALF_DAY')::int,
      'weekOffs', COUNT(*) FILTER (WHERE dd.status = 'WEEK_OFF')::int,
      'disabledDays', COUNT(*) FILTER (WHERE dd.status = 'DISABLED')::int,
      'totalWorkedMinutes', COALESCE(ROUND(SUM(dd.worked_hours * 60))::int, 0),
      'totalOtMinutes', COALESCE(ROUND(SUM(dd.overtime_hours * 60))::int, 0),
      'totalBreakdownMinutes', COALESCE(ROUND(SUM(dd.breakdown_hours * 60))::int, 0)
    ) AS summary_json
    FROM day_details dd
  )
  SELECT
    ad.days_json,
    ar.rollup_json,
    asu.summary_json
  INTO v_days, v_weekday_rollup, v_summary
  FROM aggregated_days ad
  CROSS JOIN aggregated_rollup ar
  CROSS JOIN aggregated_summary asu;

  v_result := jsonb_build_object(
    'employee', v_employee,
    'year', p_year,
    'month', p_month,
    'days', COALESCE(v_days, '[]'::jsonb),
    'weekdayRollup', COALESCE(v_weekday_rollup, '[]'::jsonb),
    'summary', v_summary
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_attendance_daily_detail(uuid, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attendance_daily_detail(uuid, int, int) TO authenticated, service_role;
