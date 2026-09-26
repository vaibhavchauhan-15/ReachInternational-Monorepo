-- ============================================================================
-- Migration 110: Enhance Attendance Search and Normalization
-- 0 new tables. Updates get_attendance_monthly_summary RPC.
-- Supports normalized search across full_name (with or without spaces, e.g. 'operator100' -> 'Operator 100'),
-- email, phone digits (ignoring spaces, dashes, +91), city, and state.
-- ============================================================================

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
  v_clean_search := TRIM(COALESCE(p_search, ''));

  -- Count scheduled weekdays up to today (for total scheduled progress)
  v_scheduled_days := 0;
  v_past_scheduled_days := 0;
  v_d := v_month_start;
  WHILE v_d <= LEAST(v_month_end, v_today) LOOP
    IF EXTRACT(DOW FROM v_d) <> 0 THEN
      v_scheduled_days := v_scheduled_days + 1;
      IF v_d < v_today THEN
        v_past_scheduled_days := v_past_scheduled_days + 1;
      END IF;
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
      -- Absent days only counts missed days strictly in the past (before today)
      GREATEST(v_past_scheduled_days - COALESCE(logs.past_present_days, 0), 0)::int AS absent_days,
      COALESCE(logs.total_worked_minutes, 0)::int AS worked_minutes,
      COALESCE(logs.total_ot_minutes, 0)::int AS overtime_minutes,
      COALESCE(logs.total_breakdown_minutes, 0)::int AS breakdown_minutes,
      -- Derive display status
      CASE
        WHEN COALESCE(logs.present_days, 0) = 0 AND v_today > v_month_start THEN 'ABSENT'
        WHEN COALESCE(logs.half_day_count, 0) > 0 THEN 'HALF_DAY'
        ELSE 'PRESENT'
      END AS attendance_status
    FROM public.users u
    LEFT JOIN LATERAL (
      SELECT
        COUNT(DISTINCT mhl.log_date)::int AS present_days,
        COUNT(DISTINCT CASE WHEN mhl.log_date < v_today THEN mhl.log_date END)::int AS past_present_days,
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
