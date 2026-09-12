-- ============================================================
-- Operations Hub QA — Ground-Truth Query Pack (v1.0, 2026-09-12)
-- Companion to AI/TESTING/OPERATIONS-TEST-PLAN.md
-- Usage: replace @params (or :params) with the exact UI filter
-- values, run in Supabase SQL editor / psql, and compare the
-- result set 1:1 against UI rows, Excel export and PDF export.
-- ============================================================

-- Q1. Master filtered result set (exact AND semantics mirror of /operations)
SELECT l.id, l.log_date, l.start_time, l.end_time, l.hmr_reading,
       l.running_hours, l.normal_hours, l.overtime_hours,
       l.breakdown_duration, l.location, l.remarks,
       m.machine_id, m.serial_number, m.status AS machine_status, m.health_status,
       u.id AS operator_id, u.full_name AS operator,
       c.id AS client_id, c.company_name
FROM machine_hour_logs l
JOIN machines m   ON m.id = l.machine_id
LEFT JOIN users u   ON u.id = l.operator_id
LEFT JOIN clients c ON c.id = l.client_id
WHERE (@machineId IS NULL OR l.machine_id = @machineId::uuid)
  AND (@clientId   IS NULL OR l.client_id  = @clientId::uuid)
  AND (@operatorId IS NULL OR l.operator_id = @operatorId::uuid)
  AND (@site       IS NULL OR l.location ILIKE '%' || @site || '%' OR @site ILIKE '%' || l.location || '%')
  AND (@month      IS NULL OR @month = 'all' OR to_char(l.log_date, 'MM') = @month)
  AND (@start      IS NULL OR l.log_date >= @start::date)
  AND (@end        IS NULL OR l.log_date <= @end::date)
  AND (@search     IS NULL OR m.machine_id ILIKE '%' || @search || '%'
                         OR m.serial_number ILIKE '%' || @search || '%'
                         OR u.full_name ILIKE '%' || @search || '%'
                         OR l.remarks ILIKE '%' || @search || '%'
                         OR l.location ILIKE '%' || @search || '%')
ORDER BY l.log_date DESC;

-- Q2. Operator KPI card aggregates (Total Run Hours, OT, Breakdown Events, Matching Logs)
SELECT count(*) AS matching_logs,
       COALESCE(sum(l.running_hours), 0)  AS total_run_hours,
       COALESCE(sum(l.overtime_hours), 0) AS total_overtime,
       count(*) FILTER (WHERE l.breakdown_duration > 0) AS breakdown_events
FROM machine_hour_logs l
WHERE (@operatorId IS NULL OR l.operator_id = @operatorId::uuid)
  AND (@month      IS NULL OR @month = 'all' OR to_char(l.log_date, 'MM') = @month)
  AND (@start      IS NULL OR l.log_date >= @start::date)
  AND (@end        IS NULL OR l.log_date <= @end::date);

-- Q3. Client overview card aggregates (rented machines, active sites, working hours, active days)
SELECT count(DISTINCT m.id) FILTER (WHERE m.status = 'rented') AS rented_machines,
       count(DISTINCT l.location)      AS active_sites,
       COALESCE(sum(l.running_hours), 0) AS working_hours,
       count(DISTINCT l.log_date)      AS active_working_days
FROM machine_hour_logs l
JOIN machines m ON m.id = l.machine_id
WHERE (@clientId IS NULL OR l.client_id = @clientId::uuid)
  AND (@month    IS NULL OR @month = 'all' OR to_char(l.log_date, 'MM') = @month);

-- Q4. Duplicate log detection (should return 0 rows)
SELECT machine_id, operator_id, log_date, start_time, end_time, count(*)
FROM machine_hour_logs
GROUP BY machine_id, operator_id, log_date, start_time, end_time
HAVING count(*) > 1;

-- Q5. Machine status matrix (seed audit)
SELECT m.id, m.machine_id, m.serial_number, m.status, m.health_status,
       count(l.id) AS log_count
FROM machines m
LEFT JOIN machine_hour_logs l ON l.machine_id = m.id
GROUP BY m.id, m.machine_id, m.serial_number, m.status, m.health_status
ORDER BY m.machine_id;

-- Q6. Clients by log coverage (1 machine / multi machine / multi site / zero logs)
SELECT c.id, c.company_name,
       count(DISTINCT l.machine_id) AS machines,
       count(DISTINCT l.location)   AS sites,
       count(l.id)                  AS logs
FROM clients c
LEFT JOIN machine_hour_logs l ON l.client_id = c.id
GROUP BY c.id, c.company_name
ORDER BY logs DESC;

-- Q7. Operators by log coverage (zero-log / multi-shift detection)
SELECT u.id, u.full_name,
       count(DISTINCT l.machine_id) AS machines,
       count(l.id)                  AS logs,
       count(DISTINCT l.start_time) AS distinct_shift_starts
FROM users u
LEFT JOIN machine_hour_logs l ON l.operator_id = u.id
WHERE u.role IN ('operator', 'driver', 'helper')
GROUP BY u.id, u.full_name
ORDER BY logs DESC;

-- Q8. Monthly record volume (find zero-record and max-record months)
SELECT to_char(log_date, 'YYYY-MM') AS ym, count(*) AS logs
FROM machine_hour_logs
GROUP BY 1 ORDER BY 2 DESC;

-- Q9. Export integrity check: full export row count for a given filter combo
SELECT count(*) FROM machine_hour_logs l
WHERE (@machineId IS NULL OR l.machine_id = @machineId::uuid)
  AND (@month IS NULL OR @month = 'all' OR to_char(l.log_date, 'MM') = @month);
