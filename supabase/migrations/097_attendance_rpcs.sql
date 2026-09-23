-- ============================================
-- Migration 097: Attendance RPCs — derived from machine_hour_logs
-- 0 new tables. 2 read-only SECURITY DEFINER / STABLE RPCs.
-- Uses existing idx_mhl_operator_date_created index.
-- ============================================

-- 1. Monthly Attendance Summary (paginated, filterable)
CREATE OR REPLACE FUNCTION public.get_attendance_monthly_summary(
  p_year int,
  p_month int,
  p_role text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 25
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
  v_scheduled_days int;
  v_result jsonb;
  v_total int;
  v_kpis jsonb;
  v_offset int;
  v_today date := CURRENT_DATE;
  v_d date;
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
  v_offset := (GREATEST(p_page, 1) - 1) * p_page_size;

  -- Count scheduled weekdays (exclude Sundays = DOW 0)
  -- ponytail: fixed Sunday weekly-off, add public.users.week_off_day smallint when a role needs a different one
  v_scheduled_days := 0;
  v_d := v_month_start;
  WHILE v_d <= LEAST(v_month_end, v_today) LOOP
    IF EXTRACT(DOW FROM v_d) <> 0 THEN
      v_scheduled_days := v_scheduled_days + 1;
    END IF;
    v_d := v_d + 1;
  END LOOP;

  -- Build attendance per employee via CTE
  WITH employee_attendance AS (
    SELECT
      u.id AS employee_id,
      u.full_name,
      u.phone,
      u.role,
      u.city,
      u.state,
      u.shift_start_time,
      u.shift_end_time,
      u.status AS user_status,
      COALESCE(logs.present_days, 0)::int AS present_days,
      COALESCE(logs.half_day_count, 0)::int AS half_days,
      GREATEST(v_scheduled_days - COALESCE(logs.present_days, 0), 0)::int AS absent_days,
      COALESCE(logs.total_worked_minutes, 0)::int AS worked_minutes,
      COALESCE(logs.total_ot_minutes, 0)::int AS overtime_minutes,
      COALESCE(logs.total_breakdown_minutes, 0)::int AS breakdown_minutes,
      -- Derive display status
      CASE
        WHEN COALESCE(logs.present_days, 0) = 0 THEN 'ABSENT'
        WHEN COALESCE(logs.half_day_count, 0) > 0 THEN 'HALF_DAY'
        ELSE 'PRESENT'
      END AS attendance_status
    FROM public.users u
    LEFT JOIN LATERAL (
      SELECT
        COUNT(DISTINCT mhl.log_date)::int AS present_days,
        COUNT(DISTINCT CASE
          WHEN day_hours.day_normal_hours < 4 THEN mhl.log_date
        END)::int AS half_day_count,
        COALESCE(SUM(mhl.normal_working_hours) * 60, 0)::int AS total_worked_minutes,
        COALESCE(SUM(mhl.overtime_hours) * 60, 0)::int AS total_ot_minutes,
        COALESCE(SUM(mhl.breakdown_hours) * 60, 0)::int AS total_breakdown_minutes
      FROM public.machine_hour_logs mhl
      LEFT JOIN LATERAL (
        SELECT SUM(mhl2.normal_working_hours) AS day_normal_hours
        FROM public.machine_hour_logs mhl2
        WHERE mhl2.operator_id = u.id
          AND mhl2.log_date = mhl.log_date
      ) day_hours ON true
      WHERE mhl.operator_id = u.id
        AND mhl.log_date >= v_month_start
        AND mhl.log_date <= v_month_end
    ) logs ON true
    WHERE u.role = 'operator'
      AND u.status = 'active'
      -- Role filter
      AND (p_role IS NULL OR u.role = p_role)
      -- Search filter
      AND (p_search IS NULL OR p_search = '' OR
           u.full_name ILIKE '%' || p_search || '%' OR
           u.phone ILIKE '%' || p_search || '%')
  ),
  filtered AS (
    SELECT *
    FROM employee_attendance ea
    WHERE (p_status IS NULL OR p_status = '' OR
           (p_status = 'present' AND ea.present_days > 0 AND ea.half_days = 0) OR
           (p_status = 'absent' AND ea.present_days = 0) OR
           (p_status = 'half_day' AND ea.half_days > 0))
  )
  SELECT
    jsonb_build_object(
      'rows', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'employee_id', f.employee_id,
            'full_name', f.full_name,
            'phone', f.phone,
            'role', f.role,
            'city', f.city,
            'state', f.state,
            'shift_start_time', f.shift_start_time,
            'shift_end_time', f.shift_end_time,
            'scheduled_days', v_scheduled_days,
            'present_days', f.present_days,
            'half_days', f.half_days,
            'absent_days', f.absent_days,
            'worked_minutes', f.worked_minutes,
            'overtime_minutes', f.overtime_minutes,
            'breakdown_minutes', f.breakdown_minutes,
            'status', f.attendance_status
          ) ORDER BY f.full_name
        )
        FROM (
          SELECT * FROM filtered
          ORDER BY full_name
          LIMIT p_page_size OFFSET v_offset
        ) f
      ), '[]'::jsonb),
      'total', (SELECT COUNT(*) FROM filtered),
      'page', p_page,
      'pageSize', p_page_size,
      'scheduledDays', v_scheduled_days,
      'kpis', jsonb_build_object(
        'totalEmployees', (SELECT COUNT(*) FROM filtered),
        'presentCount', (SELECT COUNT(*) FROM filtered WHERE present_days > 0 AND half_days = 0),
        'absentCount', (SELECT COUNT(*) FROM filtered WHERE present_days = 0),
        'halfDayCount', (SELECT COUNT(*) FROM filtered WHERE half_days > 0),
        'totalWorkedMinutes', (SELECT COALESCE(SUM(worked_minutes), 0) FROM filtered),
        'totalOtMinutes', (SELECT COALESCE(SUM(overtime_minutes), 0) FROM filtered)
      )
    )
  INTO v_result;

  RETURN v_result;
END;
$$;

-- 2. Daily Attendance Detail (per employee, per month)
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

  -- Employee info
  SELECT jsonb_build_object(
    'id', u.id,
    'full_name', u.full_name,
    'phone', u.phone,
    'role', u.role,
    'city', u.city,
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
      jsonb_agg(
        jsonb_build_object(
          'id', mhl.id,
          'machine_id', mhl.machine_id,
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
        WHEN dl.log_date IS NULL THEN 'ABSENT'
        WHEN dl.worked_hours < 4 THEN 'HALF_DAY'
        ELSE 'PRESENT'
      END,
      'worked_minutes', COALESCE(dl.worked_hours * 60, 0)::int,
      'overtime_minutes', COALESCE(dl.ot_hours * 60, 0)::int,
      'breakdown_minutes', COALESCE(dl.breakdown_hours * 60, 0)::int,
      'log_count', COALESCE(dl.log_count, 0),
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
      ROUND(AVG(worked_hours) * 60)::int AS avg_worked_minutes
    FROM day_data
    GROUP BY dow
  ) dd;

  -- Summary totals
  SELECT jsonb_build_object(
    'presentDays', COUNT(*) FILTER (WHERE s = 'PRESENT'),
    'absentDays', COUNT(*) FILTER (WHERE s = 'ABSENT'),
    'halfDays', COUNT(*) FILTER (WHERE s = 'HALF_DAY'),
    'weekOffs', COUNT(*) FILTER (WHERE s = 'WEEK_OFF'),
    'totalWorkedMinutes', COALESCE(SUM(wm), 0),
    'totalOtMinutes', COALESCE(SUM(om), 0),
    'totalBreakdownMinutes', COALESCE(SUM(bm), 0)
  )
  INTO v_summary
  FROM (
    SELECT
      CASE
        WHEN EXTRACT(DOW FROM c.cal_date) = 0 THEN 'WEEK_OFF'
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

-- 3. Permissions
REVOKE ALL ON FUNCTION public.get_attendance_monthly_summary(int, int, text, text, text, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attendance_monthly_summary(int, int, text, text, text, int, int) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_attendance_daily_detail(uuid, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attendance_daily_detail(uuid, int, int) TO authenticated, service_role;
