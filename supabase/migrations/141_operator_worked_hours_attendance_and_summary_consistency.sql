-- ============================================================================
-- Migration 141: Operator Worked Hours Consistency across Attendance, Logs Summary & Triggers
--
-- 1. Updates auto_calculate_machine_hour_log_overtime() Trigger Function:
--    - Guarantees that for standard 8-hour shifts (e.g. 06:00 AM to 02:00 PM),
--      normal_working_hours is 8.00 (lunch, pre-check, and normal work time are included).
--    - Overtime hours are added in addition to the 8.0h shift and do NOT deduct
--      from the 8.0h normal working hours.
-- 2. Backfills existing machine_hour_logs:
--    - Safely bypasses immutability trigger to fix any logs where normal_working_hours
--      was recorded as < 8.0 for 06:00 AM - 02:00 PM shifts, restoring immutability immediately.
-- 3. Updates get_attendance_daily_detail RPC:
--    - In daily_logs CTE, sets worked_hours to the operator's working hours
--      (COALESCE(NULLIF(mhl.normal_working_hours, 0), 8.0)) instead of machine running_hours (meter HMR).
--    - Ensures worked_minutes in days JSON and totalWorkedMinutes in summary represent
--      the operator's true working hours (480 mins = 8h 00m for a standard shift).
-- 4. Updates get_attendance_monthly_summary RPC:
--    - Ensures total_worked_minutes and day_normal_hours consistently use
--      COALESCE(NULLIF(mhl.normal_working_hours, 0), 8.0).
-- 5. Updates get_operations_summary RPC:
--    - Ensures total_working_hours accounts for normal working hours + overtime hours.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. auto_calculate_machine_hour_log_overtime Trigger Function
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_calculate_machine_hour_log_overtime()
RETURNS TRIGGER AS $$
DECLARE
  v_duration_hours NUMERIC;
BEGIN
  -- Derive start_datetime and end_datetime from log_date, start_time, end_time if missing
  IF (NEW.start_datetime IS NULL OR NEW.end_datetime IS NULL) AND NEW.start_time IS NOT NULL AND NEW.end_time IS NOT NULL THEN
    NEW.start_datetime := COALESCE(NEW.start_datetime, (COALESCE(NEW.log_date, CURRENT_DATE)::text || ' ' || NEW.start_time::text)::timestamptz);
    IF NEW.end_time < NEW.start_time THEN
      NEW.end_datetime := COALESCE(NEW.end_datetime, ((COALESCE(NEW.log_date, CURRENT_DATE) + interval '1 day')::date::text || ' ' || NEW.end_time::text)::timestamptz);
    ELSE
      NEW.end_datetime := COALESCE(NEW.end_datetime, (COALESCE(NEW.log_date, CURRENT_DATE)::text || ' ' || NEW.end_time::text)::timestamptz);
    END IF;
  END IF;

  IF NEW.start_datetime IS NOT NULL AND NEW.end_datetime IS NOT NULL THEN
    v_duration_hours := ROUND(EXTRACT(EPOCH FROM (NEW.end_datetime - NEW.start_datetime)) / 3600.0, 2);

    -- Auto-calculate overtime if not explicitly set (overtime after 8.0 hours of shift; lunch included in shift time)
    IF NEW.overtime_hours IS NULL OR NEW.overtime_hours = 0 THEN
      IF v_duration_hours > 8.0 THEN
        NEW.overtime_hours := ROUND(v_duration_hours - 8.0, 2);
      ELSE
        NEW.overtime_hours := 0.0;
      END IF;
    END IF;

    -- Normal working hours: For full shifts (>= 7.95h e.g. 06:00 to 14:00), normal_working_hours is 8.0.
    -- Overtime does NOT subtract from the 8.0h normal work time.
    IF v_duration_hours >= 7.95 THEN
      NEW.normal_working_hours := 8.0;
    ELSIF v_duration_hours > 0 THEN
      NEW.normal_working_hours := GREATEST(0.0, ROUND((v_duration_hours - COALESCE(NEW.overtime_hours, 0.0)), 2));
    ELSE
      NEW.normal_working_hours := COALESCE(NULLIF(NEW.normal_working_hours, 0), 8.0);
    END IF;
  ELSE
    NEW.normal_working_hours := COALESCE(NULLIF(NEW.normal_working_hours, 0), 8.0);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_calculate_machine_hour_log_overtime ON public.machine_hour_logs;
CREATE TRIGGER trg_auto_calculate_machine_hour_log_overtime
  BEFORE INSERT OR UPDATE ON public.machine_hour_logs
  FOR EACH ROW EXECUTE FUNCTION public.auto_calculate_machine_hour_log_overtime();

-- ----------------------------------------------------------------------------
-- 2. Backfill existing machine_hour_logs records
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Safely drop immutability trigger during backfill
  DROP TRIGGER IF EXISTS trg_enforce_machine_hour_logs_immutable ON public.machine_hour_logs;

  -- Backfill: For all shifts with 06:00 AM to 02:00 PM (8h duration), ensure normal_working_hours is 8.00
  UPDATE public.machine_hour_logs
  SET normal_working_hours = 8.00
  WHERE start_time = '06:00:00'
    AND end_time = '14:00:00'
    AND (normal_working_hours IS NULL OR normal_working_hours < 8.0);

  -- Re-attach immutability trigger immediately
  CREATE TRIGGER trg_enforce_machine_hour_logs_immutable
    BEFORE UPDATE OR DELETE ON public.machine_hour_logs
    FOR EACH ROW EXECUTE FUNCTION public.enforce_machine_hour_logs_immutable();
END $$;

-- ----------------------------------------------------------------------------
-- 3. Update get_attendance_daily_detail RPC
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
  -- - Only enforce when caller is authenticated session
  -- - Operators can strictly ONLY view their own attendance (auth.uid() = p_employee_id)
  -- - Service role and administrative contexts bypass without restriction
  IF auth.role() = 'authenticated' THEN
    SELECT role INTO v_caller_role FROM public.users WHERE id = auth.uid();
    IF v_caller_role = 'operator' AND auth.uid() <> p_employee_id THEN
      RAISE EXCEPTION 'Unauthorized: operators can only view their own attendance' USING ERRCODE = '42501';
    ELSIF v_caller_role IS NOT NULL AND v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'hr', 'supervisor', 'operator') THEN
      RAISE EXCEPTION 'Unauthorized: attendance access denied' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_month_start := make_date(p_year, p_month, 1);
  v_month_end := (v_month_start + interval '1 month' - interval '1 day')::date;

  -- 1. Primary: Lookup employee in public.users with complete null safety
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

  -- 2. Secondary fallback: Check auth.users if public.users is syncing/missing
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

  -- 3. Tertiary fallback: Guaranteed non-null employee object
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
      -- Operator worked hours (lunch, normal work time included = total work hours, NOT machine running_hours HMR)
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
          'machine_name', COALESCE(m.machine_name, ''),
          'model', COALESCE(m.model, ''),
          'serial_number', COALESCE(m.serial_number, ''),
          'manufacturer', COALESCE(m.manufacturer, ''),
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

-- ----------------------------------------------------------------------------
-- 4. Update get_attendance_monthly_summary RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_attendance_monthly_summary(
  p_year int,
  p_month int,
  p_role text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 50,
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
  v_today date := (NOW() AT TIME ZONE 'Asia/Kolkata')::date;
  v_scheduled_days int;
  v_past_scheduled_days int;
  v_d date;
  v_offset int;
  v_total_count int;
  v_clean_search text;
  v_rows jsonb;
  v_kpis jsonb;
  v_result jsonb;
  v_caller_role text;
BEGIN
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

  v_scheduled_days := 0;
  v_d := v_month_start;
  WHILE v_d <= v_month_end LOOP
    IF EXTRACT(DOW FROM v_d) <> 0 THEN
      v_scheduled_days := v_scheduled_days + 1;
    END IF;
    v_d := v_d + 1;
  END LOOP;

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
      GREATEST(v_past_scheduled_days - COALESCE(logs.past_present_days, 0), 0)::int AS absent_days,
      COALESCE(logs.total_worked_minutes, 0)::int AS worked_minutes,
      COALESCE(logs.total_ot_minutes, 0)::int AS overtime_minutes,
      COALESCE(logs.total_breakdown_minutes, 0)::int AS breakdown_minutes,
      CASE
        WHEN COALESCE(logs.present_days, 0) = 0 AND (v_today > v_month_start OR v_past_scheduled_days > 0) THEN 'ABSENT'
        WHEN COALESCE(logs.half_day_count, 0) > 0 THEN 'HALF_DAY'
        ELSE 'PRESENT'
      END AS attendance_status
    FROM public.users u
    LEFT JOIN LATERAL (
      SELECT
        COUNT(DISTINCT CASE
          WHEN EXTRACT(DOW FROM mhl.log_date) <> 0 AND day_hours.day_normal_hours >= 4
          THEN mhl.log_date
        END)::int AS present_days,
        COUNT(DISTINCT CASE
          WHEN EXTRACT(DOW FROM mhl.log_date) <> 0 AND mhl.log_date < v_today
          THEN mhl.log_date
        END)::int AS past_present_days,
        COUNT(DISTINCT CASE
          WHEN EXTRACT(DOW FROM mhl.log_date) <> 0 AND day_hours.day_normal_hours < 4
          THEN mhl.log_date
        END)::int AS half_day_count,
        COALESCE(SUM(COALESCE(NULLIF(mhl.normal_working_hours, 0), 8.0)) * 60, 0)::int AS total_worked_minutes,
        COALESCE(SUM(mhl.overtime_hours) * 60, 0)::int AS total_ot_minutes,
        COALESCE(SUM(mhl.breakdown_hours) * 60, 0)::int AS total_breakdown_minutes
      FROM public.machine_hour_logs mhl
      LEFT JOIN LATERAL (
        SELECT SUM(COALESCE(NULLIF(mhl2.normal_working_hours, 0), 8.0)) AS day_normal_hours
        FROM public.machine_hour_logs mhl2
        WHERE mhl2.operator_id = mhl.operator_id
          AND mhl2.log_date = mhl.log_date
      ) day_hours ON true
      WHERE mhl.operator_id = u.id
        AND mhl.log_date BETWEEN v_month_start AND v_month_end
    ) logs ON true
    WHERE (p_role IS NULL OR u.role = p_role)
      AND (
        v_clean_search = '' OR
        u.full_name ILIKE '%' || v_clean_search || '%' OR
        u.phone ILIKE '%' || v_clean_search || '%' OR
        u.employee_id ILIKE '%' || v_clean_search || '%'
      )
      AND (p_state IS NULL OR p_state = '' OR p_state = 'all' OR u.state = p_state)
  ),
  filtered_attendance AS (
    SELECT *
    FROM employee_attendance ea
    WHERE (p_status IS NULL OR p_status = '' OR p_status = 'all' OR ea.attendance_status = p_status)
      AND (
        p_overtime IS NULL OR p_overtime = '' OR p_overtime = 'all' OR
        (p_overtime = 'with_ot' AND ea.overtime_minutes > 0) OR
        (p_overtime = 'without_ot' AND ea.overtime_minutes = 0)
      )
  ),
  kpis_calc AS (
    SELECT
      COUNT(*)::int AS total_employees,
      COALESCE(SUM(fa.present_days), 0)::int AS present_count,
      COALESCE(SUM(fa.absent_days), 0)::int AS absent_count,
      COALESCE(SUM(fa.half_days), 0)::int AS half_day_count,
      COALESCE(SUM(fa.worked_minutes), 0)::int AS total_worked_minutes,
      COALESCE(SUM(fa.overtime_minutes), 0)::int AS total_ot_minutes
    FROM filtered_attendance fa
  )
  SELECT
    (SELECT COUNT(*) FROM filtered_attendance) INTO v_total_count;

  SELECT jsonb_build_object(
    'totalEmployees', kc.total_employees,
    'presentCount', kc.present_count,
    'absentCount', kc.absent_count,
    'halfDayCount', kc.half_day_count,
    'totalWorkedMinutes', kc.total_worked_minutes,
    'totalOtMinutes', kc.total_ot_minutes
  )
  INTO v_kpis
  FROM kpis_calc kc;

  SELECT jsonb_agg(row_to_json(r))
  INTO v_rows
  FROM (
    SELECT
      fa.employee_id,
      fa.full_name,
      fa.phone,
      fa.role,
      fa.city,
      fa.state,
      fa.shift_start_time,
      fa.shift_end_time,
      v_scheduled_days AS scheduled_days,
      fa.present_days,
      fa.half_days,
      fa.absent_days,
      fa.worked_minutes,
      fa.overtime_minutes,
      fa.breakdown_minutes,
      fa.attendance_status AS status
    FROM filtered_attendance fa
    ORDER BY
      CASE WHEN p_sort_by = 'name_asc' THEN fa.full_name END ASC,
      CASE WHEN p_sort_by = 'name_desc' THEN fa.full_name END DESC,
      CASE WHEN p_sort_by = 'present_desc' THEN fa.present_days END DESC,
      CASE WHEN p_sort_by = 'absent_desc' THEN fa.absent_days END DESC,
      CASE WHEN p_sort_by = 'worked_desc' THEN fa.worked_minutes END DESC,
      fa.full_name ASC
    LIMIT p_page_size
    OFFSET v_offset
  ) r;

  v_result := jsonb_build_object(
    'rows', COALESCE(v_rows, '[]'::jsonb),
    'total', v_total_count,
    'page', p_page,
    'pageSize', p_page_size,
    'scheduledDays', v_scheduled_days,
    'kpis', v_kpis
  );

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_attendance_monthly_summary(int, int, text, text, text, int, int, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_attendance_monthly_summary(int, int, text, text, text, int, int, text, text, text) TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 5. Update get_operations_summary RPC
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_operations_summary(
  p_client_id UUID DEFAULT NULL,
  p_machine_id UUID DEFAULT NULL,
  p_operator_id UUID DEFAULT NULL,
  p_site TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
  v_query TEXT;
  v_where TEXT := 'WHERE 1=1';
  v_site_clean TEXT;
BEGIN
  IF p_client_id IS NOT NULL THEN
    v_where := v_where || ' AND mhl.client_id = ' || quote_literal(p_client_id);
  END IF;

  IF p_machine_id IS NOT NULL THEN
    v_where := v_where || ' AND mhl.machine_id = ' || quote_literal(p_machine_id);
  END IF;

  IF p_operator_id IS NOT NULL THEN
    v_where := v_where || ' AND mhl.operator_id = ' || quote_literal(p_operator_id);
  END IF;

  IF p_start_date IS NOT NULL THEN
    v_where := v_where || ' AND mhl.log_date >= ' || quote_literal(p_start_date);
  END IF;

  IF p_end_date IS NOT NULL THEN
    v_where := v_where || ' AND mhl.log_date <= ' || quote_literal(p_end_date);
  END IF;

  IF p_site IS NOT NULL AND p_site <> '' AND p_site <> 'all' THEN
    v_site_clean := btrim(p_site);
    IF p_client_id IS NOT NULL THEN
      v_where := v_where || ' AND (mhl.location = ' || quote_literal(v_site_clean) ||
                            ' OR mhl.location = (SELECT street FROM public.clients WHERE id = ' || quote_literal(p_client_id) || '))';
    ELSE
      v_where := v_where || ' AND mhl.location = ' || quote_literal(v_site_clean);
    END IF;
  END IF;

  v_query := 'SELECT jsonb_build_object(
    ''total_logs'', COUNT(*),
    ''total_run_hours'', ROUND(COALESCE(SUM(mhl.running_hours), 0)::numeric, 1),
    ''total_ot_hours'', ROUND(COALESCE(SUM(mhl.overtime_hours), 0)::numeric, 1),
    ''total_working_hours'', ROUND(COALESCE(SUM(COALESCE(NULLIF(mhl.normal_working_hours, 0), 8.0) + COALESCE(mhl.overtime_hours, 0)), 0)::numeric, 1),
    ''total_breakdowns'', COUNT(*) FILTER (WHERE mhl.is_breakdown = true),
    ''logged_days_count'', COUNT(DISTINCT mhl.log_date)
  ) FROM public.machine_hour_logs mhl ' || v_where;

  EXECUTE v_query INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_operations_summary(uuid, uuid, uuid, text, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_operations_summary(uuid, uuid, uuid, text, date, date) TO authenticated, service_role;
