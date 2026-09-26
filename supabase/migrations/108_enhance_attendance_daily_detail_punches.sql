-- ============================================================================
-- Migration 108: Enhance Attendance Daily Detail RPC with Punch Timings & User Meta
-- 0 new tables. Updates get_attendance_daily_detail to return first_punch_in,
-- last_punch_out, and employee metadata (email, district) for detailed ledger views.
-- ============================================================================

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
  -- RBAC: only hr, admin, super_admin (or service_role)
  IF auth.role() = 'authenticated' THEN
    SELECT role INTO v_caller_role FROM public.users WHERE id = auth.uid();
    IF v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'hr') THEN
      RAISE EXCEPTION 'Unauthorized: attendance access denied' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_month_start := make_date(p_year, p_month, 1);
  v_month_end := (v_month_start + interval '1 month' - interval '1 day')::date;

  -- Employee info with email & district
  SELECT jsonb_build_object(
    'id', u.id,
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

  -- Generate all days in the month and left join with log data
  WITH calendar AS (
    SELECT d::date AS cal_date
    FROM generate_series(v_month_start, v_month_end, '1 day'::interval) d
  ),
  daily_logs AS (
    SELECT
      mhl.log_date,
      SUM(mhl.normal_working_hours)::numeric AS worked_hours,
      SUM(mhl.overtime_hours)::numeric AS ot_hours,
      SUM(mhl.breakdown_hours)::numeric AS breakdown_hours,
      COUNT(*)::int AS log_count,
      MIN(mhl.start_time) AS first_punch_in,
      MAX(mhl.end_time) AS last_punch_out,
      jsonb_agg(
        jsonb_build_object(
          'id', mhl.id,
          'machine_id', mhl.machine_id,
          'machine_code', COALESCE(m.machine_id, mhl.machine_id::text),
          'machine_name', COALESCE(m.machine_name, 'Machine'),
          'model', COALESCE(m.model, ''),
          'serial_number', COALESCE(m.serial_number, ''),
          'manufacturer', COALESCE(m.manufacturer, ''),
          'start_time', mhl.start_time,
          'end_time', mhl.end_time,
          'start_meter', mhl.start_meter,
          'end_meter', mhl.end_meter,
          'running_hours', mhl.running_hours,
          'normal_working_hours', mhl.normal_working_hours,
          'overtime_hours', mhl.overtime_hours,
          'is_breakdown', mhl.is_breakdown,
          'location', mhl.location
        ) ORDER BY mhl.start_time
      ) AS entries
    FROM public.machine_hour_logs mhl
    LEFT JOIN public.machines m ON m.id = mhl.machine_id
    WHERE mhl.operator_id = p_employee_id
      AND mhl.log_date >= v_month_start
      AND mhl.log_date <= v_month_end
    GROUP BY mhl.log_date
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', c.cal_date,
      'dow', EXTRACT(DOW FROM c.cal_date)::int,
      'status', CASE
        WHEN EXTRACT(DOW FROM c.cal_date) = 0 THEN 'WEEK_OFF'
        WHEN dl.log_date IS NULL AND c.cal_date >= CURRENT_DATE THEN 'DISABLED'
        WHEN dl.log_date IS NULL THEN 'ABSENT'
        WHEN dl.worked_hours < 4 THEN 'HALF_DAY'
        ELSE 'PRESENT'
      END,
      'worked_minutes', COALESCE(dl.worked_hours * 60, 0)::int,
      'overtime_minutes', COALESCE(dl.ot_hours * 60, 0)::int,
      'breakdown_minutes', COALESCE(dl.breakdown_hours * 60, 0)::int,
      'log_count', COALESCE(dl.log_count, 0),
      'punch_in', dl.first_punch_in,
      'punch_out', dl.last_punch_out,
      'entries', COALESCE(dl.entries, '[]'::jsonb)
    ) ORDER BY c.cal_date
  )
  INTO v_days
  FROM calendar c
  LEFT JOIN daily_logs dl ON dl.log_date = c.cal_date;

  -- Day-of-week rollup (same data, grouped by DOW)
  WITH day_data AS (
    SELECT
      EXTRACT(DOW FROM d.cal_date)::int AS dow,
      CASE
        WHEN EXTRACT(DOW FROM d.cal_date) = 0 THEN 'WEEK_OFF'
        WHEN (dl.log_count IS NULL OR dl.log_count = 0) AND d.cal_date >= CURRENT_DATE THEN 'DISABLED'
        WHEN dl.log_count IS NULL OR dl.log_count = 0 THEN 'ABSENT'
        WHEN dl.worked_hours < 4 THEN 'HALF_DAY'
        ELSE 'PRESENT'
      END AS day_status,
      COALESCE(dl.worked_hours, 0) AS worked_hours,
      COALESCE(dl.ot_hours, 0) AS ot_hours
    FROM (
      SELECT d::date AS cal_date
      FROM generate_series(v_month_start, v_month_end, '1 day'::interval) d
    ) d
    LEFT JOIN (
      SELECT
        mhl.log_date,
        SUM(mhl.normal_working_hours)::numeric AS worked_hours,
        SUM(mhl.overtime_hours)::numeric AS ot_hours,
        COUNT(*)::int AS log_count
      FROM public.machine_hour_logs mhl
      WHERE mhl.operator_id = p_employee_id
        AND mhl.log_date >= v_month_start
        AND mhl.log_date <= v_month_end
      GROUP BY mhl.log_date
    ) dl ON dl.log_date = d.cal_date
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'dow', dd.dow,
      'total_days', dd.total_days,
      'present_days', dd.present_days,
      'absent_days', dd.absent_days,
      'half_days', dd.half_days,
      'week_offs', dd.week_offs,
      'disabled_days', dd.disabled_days,
      'avg_worked_minutes', dd.avg_worked_minutes
    ) ORDER BY dd.dow
  )
  INTO v_weekday_rollup
  FROM (
    SELECT
      dow,
      COUNT(*)::int AS total_days,
      COUNT(*) FILTER (WHERE day_status = 'PRESENT')::int AS present_days,
      COUNT(*) FILTER (WHERE day_status = 'ABSENT')::int AS absent_days,
      COUNT(*) FILTER (WHERE day_status = 'HALF_DAY')::int AS half_days,
      COUNT(*) FILTER (WHERE day_status = 'WEEK_OFF')::int AS week_offs,
      COUNT(*) FILTER (WHERE day_status = 'DISABLED')::int AS disabled_days,
      ROUND(COALESCE(AVG(worked_hours) FILTER (WHERE day_status <> 'DISABLED'), 0) * 60)::int AS avg_worked_minutes
    FROM day_data
    GROUP BY dow
  ) dd;

  -- Summary totals (calculating actual past absent, half day, week offs, and disabled)
  SELECT jsonb_build_object(
    'presentDays', COUNT(*) FILTER (WHERE s = 'PRESENT'),
    'absentDays', COUNT(*) FILTER (WHERE s = 'ABSENT'),
    'halfDays', COUNT(*) FILTER (WHERE s = 'HALF_DAY'),
    'weekOffs', COUNT(*) FILTER (WHERE s = 'WEEK_OFF'),
    'disabledDays', COUNT(*) FILTER (WHERE s = 'DISABLED'),
    'totalWorkedMinutes', COALESCE(SUM(wm), 0),
    'totalOtMinutes', COALESCE(SUM(om), 0),
    'totalBreakdownMinutes', COALESCE(SUM(bm), 0)
  )
  INTO v_summary
  FROM (
    SELECT
      CASE
        WHEN EXTRACT(DOW FROM c.cal_date) = 0 THEN 'WEEK_OFF'
        WHEN dl.log_date IS NULL AND c.cal_date >= CURRENT_DATE THEN 'DISABLED'
        WHEN dl.log_date IS NULL THEN 'ABSENT'
        WHEN dl.worked_hours < 4 THEN 'HALF_DAY'
        ELSE 'PRESENT'
      END AS s,
      COALESCE(dl.worked_hours * 60, 0)::int AS wm,
      COALESCE(dl.ot_hours * 60, 0)::int AS om,
      COALESCE(dl.breakdown_hours * 60, 0)::int AS bm
    FROM (
      SELECT d::date AS cal_date
      FROM generate_series(v_month_start, v_month_end, '1 day'::interval) d
    ) c
    LEFT JOIN (
      SELECT
        mhl.log_date,
        SUM(mhl.normal_working_hours)::numeric AS worked_hours,
        SUM(mhl.overtime_hours)::numeric AS ot_hours,
        SUM(mhl.breakdown_hours)::numeric AS breakdown_hours
      FROM public.machine_hour_logs mhl
      WHERE mhl.operator_id = p_employee_id
        AND mhl.log_date >= v_month_start
        AND mhl.log_date <= v_month_end
      GROUP BY mhl.log_date
    ) dl ON dl.log_date = c.cal_date
  ) x;

  RETURN jsonb_build_object(
    'employee', v_employee,
    'year', p_year,
    'month', p_month,
    'days', COALESCE(v_days, '[]'::jsonb),
    'weekdayRollup', COALESCE(v_weekday_rollup, '[]'::jsonb),
    'summary', v_summary
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_attendance_daily_detail(uuid, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attendance_daily_detail(uuid, int, int) TO authenticated, service_role;
