-- ==============================================================================
-- Migration 171: Attendance Daily Detail Pagination & Performance Optimization
-- Target: Development (vlmxciuogczumumrwyot) & Production (dhbbgfzbyatzvqafnsqp)
-- Description:
-- 1. Creates 5-argument get_attendance_daily_detail(uuid, int, int, int, int)
--    with server-side daily record pagination, full month summary computation,
--    and DOW aggregations.
-- 2. Maintains 3-argument get_attendance_daily_detail(uuid, int, int) delegating
--    to page=1, page_size=31 for 100% backward compatibility.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_attendance_daily_detail(
  p_employee_id uuid,
  p_year int,
  p_month int,
  p_page int,
  p_page_size int
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
  v_safe_page int;
  v_safe_page_size int;
  v_offset int;
  v_total_days int;
BEGIN
  -- Strict Database-Level RBAC Enforcement
  IF auth.role() = 'authenticated' THEN
    SELECT role INTO v_caller_role FROM public.users WHERE id = auth.uid();
    IF v_caller_role = 'operator' AND auth.uid() <> p_employee_id THEN
      RAISE EXCEPTION 'Unauthorized: operators can only view their own attendance' USING ERRCODE = '42501';
    ELSIF v_caller_role IS NOT NULL AND v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'hr', 'supervisor', 'operator') THEN
      RAISE EXCEPTION 'Unauthorized: attendance access denied' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_safe_page := GREATEST(1, COALESCE(p_page, 1));
  v_safe_page_size := GREATEST(1, LEAST(60, COALESCE(p_page_size, 31)));
  v_offset := (v_safe_page - 1) * v_safe_page_size;

  v_month_start := make_date(p_year, p_month, 1);
  v_month_end := (v_month_start + interval '1 month' - interval '1 day')::date;
  v_total_days := EXTRACT(DAY FROM v_month_end)::int;

  -- 1. Lookup employee in public.users
  SELECT jsonb_build_object(
    'id', u.id,
    'employee_id', COALESCE(u.employee_id, 'EMP-' || SUBSTRING(u.id::text, 1, 8)),
    'full_name', COALESCE(u.full_name, 'Operator'),
    'email', u.email,
    'phone', u.phone,
    'role', COALESCE(u.role, 'operator'),
    'city', u.city,
    'district', u.district,
    'state', u.state,
    'shift_start_time', COALESCE(u.shift_start_time, '06:00:00'::time),
    'shift_end_time', COALESCE(u.shift_end_time, '14:00:00'::time)
  )
  INTO v_employee
  FROM public.users u
  WHERE u.id = p_employee_id;

  -- Fallback if public.users is missing/syncing
  IF v_employee IS NULL THEN
    SELECT jsonb_build_object(
      'id', au.id,
      'employee_id', COALESCE(au.raw_user_meta_data->>'employee_id', 'EMP-' || SUBSTRING(au.id::text, 1, 8)),
      'full_name', COALESCE(au.raw_user_meta_data->>'full_name', au.email, 'Operator'),
      'email', au.email,
      'phone', COALESCE(au.raw_user_meta_data->>'phone', au.phone),
      'role', COALESCE(au.raw_user_meta_data->>'role', 'operator'),
      'city', au.raw_user_meta_data->>'city',
      'district', au.raw_user_meta_data->>'district',
      'state', au.raw_user_meta_data->>'state',
      'shift_start_time', '06:00:00'::time,
      'shift_end_time', '14:00:00'::time
    )
    INTO v_employee
    FROM auth.users au
    WHERE au.id = p_employee_id;
  END IF;

  IF v_employee IS NULL THEN
    v_employee := jsonb_build_object(
      'id', p_employee_id,
      'employee_id', 'EMP-' || SUBSTRING(p_employee_id::text, 1, 8),
      'full_name', 'Operator',
      'email', NULL,
      'phone', NULL,
      'role', 'operator',
      'city', NULL,
      'district', NULL,
      'state', NULL,
      'shift_start_time', '06:00:00'::time,
      'shift_end_time', '14:00:00'::time
    );
  END IF;

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
      COALESCE(SUM(COALESCE(NULLIF(mhl.normal_working_hours, 0), 8.0)), 0) AS worked_hours,
      COALESCE(SUM(COALESCE(NULLIF(mhl.normal_working_hours, 0), 8.0)), 0) AS normal_hours,
      COALESCE(SUM(mhl.overtime_hours), 0) AS overtime_hours,
      COALESCE(SUM(COALESCE(mhl.breakdown_hours, 0)), 0) AS breakdown_hours,
      COUNT(mhl.id) AS log_count,
      bool_or(mhl.is_breakdown) AS has_breakdown,
      jsonb_agg(
        jsonb_build_object(
          'id', mhl.id,
          'machine_id', mhl.machine_id,
          'machine_code', COALESCE(m.machine_id, ''),
          'machine_name', COALESCE(m.machine_name, m.model, ''),
          'model', COALESCE(m.model, ''),
          'serial_number', COALESCE(m.serial_number, ''),
          'manufacturer', COALESCE(m.manufacturer, ''),
          'shift_code', mhl.shift_code,
          'start_time', mhl.start_time,
          'end_time', mhl.end_time,
          'running_hours', mhl.running_hours,
          'normal_working_hours', COALESCE(NULLIF(mhl.normal_working_hours, 0), 8.0),
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
        WHEN dl.normal_hours >= 4 THEN 'PRESENT'
        WHEN dl.normal_hours > 0 THEN 'HALF_DAY'
        WHEN c.dow = 0 THEN 'WEEK_OFF'
        WHEN dl.log_date IS NULL AND c.cal_date >= CURRENT_DATE THEN 'DISABLED'
        ELSE 'ABSENT'
      END AS status
    FROM calendar c
    LEFT JOIN daily_logs dl ON dl.log_date = c.cal_date
  ),
  paged_day_details AS (
    SELECT dd.*
    FROM day_details dd
    ORDER BY dd.cal_date ASC
    LIMIT v_safe_page_size
    OFFSET v_offset
  ),
  aggregated_days AS (
    SELECT jsonb_agg(
      jsonb_build_object(
        'date', to_char(pdd.cal_date, 'YYYY-MM-DD'),
        'dow', pdd.dow,
        'status', pdd.status,
        'punch_in', pdd.punch_in,
        'punch_out', pdd.punch_out,
        'worked_minutes', ROUND(pdd.worked_hours * 60)::int,
        'normal_minutes', ROUND(pdd.normal_hours * 60)::int,
        'overtime_minutes', ROUND(pdd.overtime_hours * 60)::int,
        'breakdown_minutes', ROUND(pdd.breakdown_hours * 60)::int,
        'log_count', pdd.log_count,
        'has_breakdown', pdd.has_breakdown,
        'entries', pdd.entries
      ) ORDER BY pdd.cal_date ASC
    ) AS days_json
    FROM paged_day_details pdd
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
    'page', v_safe_page,
    'pageSize', v_safe_page_size,
    'totalDays', v_total_days,
    'hasMore', (v_safe_page * v_safe_page_size < v_total_days),
    'days', COALESCE(v_days, '[]'::jsonb),
    'weekdayRollup', COALESCE(v_weekday_rollup, '[]'::jsonb),
    'summary', v_summary
  );

  RETURN v_result;
END;
$$;

-- Backward-compatible 3-argument overload
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
BEGIN
  RETURN public.get_attendance_daily_detail(p_employee_id, p_year, p_month, 1, 31);
END;
$$;

REVOKE ALL ON FUNCTION public.get_attendance_daily_detail(uuid, int, int, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attendance_daily_detail(uuid, int, int, int, int) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_attendance_daily_detail(uuid, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attendance_daily_detail(uuid, int, int) TO authenticated, service_role;
