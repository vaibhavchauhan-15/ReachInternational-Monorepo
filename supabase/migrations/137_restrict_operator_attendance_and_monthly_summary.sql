-- ============================================================================
-- Migration 137: Strict Operator Self Attendance and Summary Roster Lockdown
--
-- 1. Updates get_attendance_daily_detail RPC:
--    - Enforces at the database engine level that an operator (auth.uid())
--      can STRICTLY ONLY access their own attendance records (p_employee_id = auth.uid()).
--    - Rejects any query by an operator for another employee's attendance with 42501.
--    - Allows management roles (super_admin, admin, manager, hr, supervisor) to inspect attendance.
-- 2. Updates get_attendance_monthly_summary RPC:
--    - Strictly blocks operators from accessing the full-organization monthly summary roster (42501).
--    - Allows management roles (super_admin, admin, hr, manager, supervisor).
-- 3. Grants execute privileges to authenticated and service_role; revokes from PUBLIC and anon.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. get_attendance_daily_detail RPC
-- ----------------------------------------------------------------------------
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
  -- Strict Database-Level RBAC Enforcement:
  -- - super_admin, admin, manager, hr, supervisor can view any employee's attendance.
  -- - operator can STRICTLY ONLY view their own attendance (auth.uid() = p_employee_id).
  -- - Any attempt by an operator or unpermitted role to view another user's attendance raises 42501.
  IF auth.role() = 'authenticated' THEN
    SELECT role INTO v_caller_role FROM public.users WHERE id = auth.uid();
    IF v_caller_role = 'operator' AND auth.uid() <> p_employee_id THEN
      RAISE EXCEPTION 'Unauthorized: operators can only view their own attendance' USING ERRCODE = '42501';
    ELSIF v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'hr', 'supervisor', 'operator') THEN
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

-- ----------------------------------------------------------------------------
-- 2. get_attendance_monthly_summary RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_attendance_monthly_summary(
  p_year int,
  p_month int,
  p_role text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 25,
  p_overtime text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_sort_by text DEFAULT NULL
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
  v_past_scheduled_days int;
  v_result jsonb;
  v_total int;
  v_kpis jsonb;
  v_offset int;
  v_today date := CURRENT_DATE;
  v_d date;
  v_caller_role text;
  v_clean_search text;
BEGIN
  -- Strict Database-Level RBAC Enforcement:
  -- - Only authorized management roles (super_admin, admin, hr, manager, supervisor)
  --   can query the organization-wide attendance monthly summary roster.
  -- - Operators are STRICTLY BLOCKED with 42501.
  IF auth.role() = 'authenticated' THEN
    SELECT role INTO v_caller_role FROM public.users WHERE id = auth.uid();
    IF v_caller_role = 'operator' THEN
      RAISE EXCEPTION 'Unauthorized: operators cannot access attendance summary roster' USING ERRCODE = '42501';
    ELSIF v_caller_role IS NULL OR v_caller_role NOT IN ('super_admin', 'admin', 'hr', 'manager', 'supervisor') THEN
      RAISE EXCEPTION 'Unauthorized: attendance access denied' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_month_start := make_date(p_year, p_month, 1);
  v_month_end := (v_month_start + interval '1 month' - interval '1 day')::date;
  v_offset := (GREATEST(p_page, 1) - 1) * p_page_size;
  v_clean_search := TRIM(COALESCE(p_search, ''));

  -- Count scheduled weekdays for the full month (exclude Sundays = DOW 0)
  v_scheduled_days := 0;
  v_d := v_month_start;
  WHILE v_d <= v_month_end LOOP
    IF EXTRACT(DOW FROM v_d) <> 0 THEN
      v_scheduled_days := v_scheduled_days + 1;
    END IF;
    v_d := v_d + 1;
  END LOOP;

  -- Count past scheduled weekdays strictly before today (for past absence calculation)
  v_past_scheduled_days := 0;
  IF v_today > v_month_start THEN
    v_d := v_month_start;
    WHILE v_d <= LEAST(v_month_end, (v_today - 1)::date) LOOP
      IF EXTRACT(DOW FROM v_d) <> 0 THEN
        v_past_scheduled_days := v_past_scheduled_days + 1;
      END IF;
      v_d := v_d + 1;
    END LOOP;
  END IF;

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
      LEAST(COALESCE(logs.present_days, 0), v_scheduled_days)::int AS present_days,
      COALESCE(logs.half_day_count, 0)::int AS half_days,
      -- Absent days only counts missed scheduled weekdays strictly in the past (before today)
      GREATEST(v_past_scheduled_days - COALESCE(logs.past_present_days, 0), 0)::int AS absent_days,
      COALESCE(logs.total_worked_minutes, 0)::int AS worked_minutes,
      COALESCE(logs.total_ot_minutes, 0)::int AS overtime_minutes,
      COALESCE(logs.total_breakdown_minutes, 0)::int AS breakdown_minutes,
      -- Derive display status
      CASE
        WHEN COALESCE(logs.present_days, 0) = 0 AND (v_today > v_month_start OR v_past_scheduled_days > 0) THEN 'ABSENT'
        WHEN COALESCE(logs.half_day_count, 0) > 0 THEN 'HALF_DAY'
        ELSE 'PRESENT'
      END AS attendance_status
    FROM public.users u
    LEFT JOIN LATERAL (
      SELECT
        -- Present days: distinct weekdays (DOW != 0) with at least 4 normal working hours
        COUNT(DISTINCT CASE
          WHEN EXTRACT(DOW FROM mhl.log_date) <> 0 AND day_hours.day_normal_hours >= 4
          THEN mhl.log_date
        END)::int AS present_days,
        -- Past logged days: distinct weekdays before today with logs (whether full or half day)
        COUNT(DISTINCT CASE
          WHEN EXTRACT(DOW FROM mhl.log_date) <> 0 AND mhl.log_date < v_today
          THEN mhl.log_date
        END)::int AS past_present_days,
        -- Half days: distinct weekdays with < 4 normal working hours
        COUNT(DISTINCT CASE
          WHEN EXTRACT(DOW FROM mhl.log_date) <> 0 AND day_hours.day_normal_hours < 4
          THEN mhl.log_date
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
      -- State filter
      AND (p_state IS NULL OR p_state = '' OR p_state = 'all' OR u.state = p_state)
      -- Search filter with whitespace and digit normalization
      AND (
        v_clean_search = '' OR
        u.full_name ILIKE '%' || v_clean_search || '%' OR
        REPLACE(u.full_name, ' ', '') ILIKE '%' || REPLACE(v_clean_search, ' ', '') || '%' OR
        u.email ILIKE '%' || v_clean_search || '%' OR
        u.phone ILIKE '%' || v_clean_search || '%' OR
        REPLACE(REPLACE(COALESCE(u.phone, ''), ' ', ''), '+', '') ILIKE '%' || REPLACE(REPLACE(REPLACE(v_clean_search, ' ', ''), '+', ''), '-', '') || '%' OR
        u.city ILIKE '%' || v_clean_search || '%' OR
        u.state ILIKE '%' || v_clean_search || '%'
      )
  ),
  filtered AS (
    SELECT *
    FROM employee_attendance ea
    WHERE (
      (p_status IS NULL OR p_status = '' OR p_status = 'all' OR
       (p_status = 'present' AND ea.present_days > 0 AND ea.half_days = 0) OR
       (p_status = 'absent' AND ea.present_days = 0) OR
       (p_status = 'half_day' AND ea.half_days > 0) OR
       (p_status = 'has_absences' AND ea.absent_days > 0) OR
       (p_status = 'perfect' AND ea.absent_days = 0 AND ea.present_days > 0))
      AND
      (p_overtime IS NULL OR p_overtime = '' OR p_overtime = 'all' OR
       (p_overtime = 'with_ot' AND ea.overtime_minutes > 0) OR
       (p_overtime = 'no_ot' AND ea.overtime_minutes = 0))
    )
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
          )
        )
        FROM (
          SELECT * FROM filtered f
          ORDER BY
            CASE WHEN p_sort_by = 'name_desc' THEN f.full_name END DESC,
            CASE WHEN p_sort_by = 'present_desc' THEN f.present_days END DESC,
            CASE WHEN p_sort_by = 'absent_desc' THEN f.absent_days END DESC,
            CASE WHEN p_sort_by = 'worked_desc' THEN f.worked_minutes END DESC,
            CASE WHEN p_sort_by = 'ot_desc' THEN f.overtime_minutes END DESC,
            f.full_name ASC
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

-- ----------------------------------------------------------------------------
-- 3. Privileges
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_attendance_daily_detail(uuid, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attendance_daily_detail(uuid, int, int) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_attendance_monthly_summary(int, int, text, text, text, int, int, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attendance_monthly_summary(int, int, text, text, text, int, int, text, text, text) TO authenticated, service_role;
