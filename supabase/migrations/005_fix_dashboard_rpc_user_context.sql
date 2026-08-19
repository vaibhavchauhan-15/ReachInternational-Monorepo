-- ============================================
-- ServiceSentry — Performance Fix Migration 005
-- 1. Dashboard/notification RPCs now accept explicit p_user_id + p_role.
--    FIXES: functions called via service-role admin client had auth.uid() = NULL,
--    which made every dashboard section return empty/zero data.
-- 2. Optimizes get_dashboard_charts() overdue-trend: replaces the 30x
--    correlated subquery with a single aggregated scan (sorted-merging window).
-- 3. Adds missing indexes (service_records.service_date, pg_trgm search).
-- ============================================

-- ============================================
-- 1. get_dashboard_kpis(p_user_id, p_role)
--    Role is passed explicitly; no auth.uid() dependency.
-- ============================================
CREATE OR REPLACE FUNCTION public.get_dashboard_kpis(p_user_id uuid, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := p_user_id;
  v_role    text := p_role;
  v_today   date := CURRENT_DATE;
  v_tomorrow date := CURRENT_DATE + 1;
  v_result  jsonb;
BEGIN
  IF v_user_id IS NULL OR v_role IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_role = 'engineer' THEN
    SELECT jsonb_build_object(
      'total_machines', COUNT(*),
      'active_machines', COUNT(*) FILTER (WHERE status = 'active'),
      'today_due',       COUNT(*) FILTER (WHERE status = 'active' AND next_service_due_date = v_today),
      'tomorrow_due',    COUNT(*) FILTER (WHERE status = 'active' AND next_service_due_date = v_tomorrow),
      'overdue',         COUNT(*) FILTER (WHERE status = 'active' AND next_service_due_date < v_today),
      'completed_today', (SELECT COUNT(*) FROM public.service_records WHERE engineer_id = v_user_id AND service_date = v_today),
      'notifications_sent_today',   (SELECT COUNT(*) FROM public.notifications WHERE recipient_id = v_user_id AND alert_date = v_today AND status = 'sent'),
      'notifications_failed_today', (SELECT COUNT(*) FROM public.notifications WHERE recipient_id = v_user_id AND alert_date = v_today AND status = 'failed')
    )
    INTO v_result
    FROM public.machines
    WHERE engineer_id = v_user_id;
  ELSE
    SELECT jsonb_build_object(
      'total_machines', COUNT(*),
      'active_machines', COUNT(*) FILTER (WHERE status = 'active'),
      'today_due',       COUNT(*) FILTER (WHERE status = 'active' AND next_service_due_date = v_today),
      'tomorrow_due',    COUNT(*) FILTER (WHERE status = 'active' AND next_service_due_date = v_tomorrow),
      'overdue',         COUNT(*) FILTER (WHERE status = 'active' AND next_service_due_date < v_today),
      'completed_today', (SELECT COUNT(*) FROM public.service_records WHERE service_date = v_today),
      'notifications_sent_today',   (SELECT COUNT(*) FROM public.notifications WHERE alert_date = v_today AND status = 'sent'),
      'notifications_failed_today', (SELECT COUNT(*) FROM public.notifications WHERE alert_date = v_today AND status = 'failed')
    )
    INTO v_result
    FROM public.machines;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_kpis(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis(uuid, text) TO service_role;

-- ============================================
-- 2. get_dashboard_charts(p_user_id, p_role)
--    Overdue trend now computed with a single sorted pass + count window
--    instead of 30 correlated per-day subqueries.
-- ============================================
CREATE OR REPLACE FUNCTION public.get_dashboard_charts(p_user_id uuid, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := p_user_id;
  v_role    text := p_role;
  v_result  jsonb;
BEGIN
  IF v_user_id IS NULL OR v_role IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_role = 'engineer' THEN
    SELECT jsonb_build_object(
      'monthly_services', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('month', to_char(m, 'Mon'), 'count', c) ORDER BY m), '[]'::jsonb)
        FROM (
          SELECT date_trunc('month', generate_series(CURRENT_DATE - INTERVAL '11 months', CURRENT_DATE, INTERVAL '1 month'))::date AS m
        ) months
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS c
          FROM public.service_records
          WHERE engineer_id = v_user_id
            AND service_date >= m
            AND service_date < m + INTERVAL '1 month'
        ) s ON true
      ),
      'overdue_trend', (
        -- Set-based: aggregate machines into due-date buckets, then cross-join the
        -- 30-day window against those buckets (<= ~365 distinct dates) with a < join.
        -- Replaces the previous 30x correlated per-day subquery against the whole table.
        WITH machine_counts AS (
          SELECT next_service_due_date AS due_date, COUNT(*)::int AS c
          FROM public.machines
          WHERE engineer_id = v_user_id
            AND status = 'active'
            AND next_service_due_date < CURRENT_DATE
          GROUP BY next_service_due_date
        ),
        days AS (
          SELECT generate_series(CURRENT_DATE - 29, CURRENT_DATE, 1)::date AS day
        ),
        overdue_by_day AS (
          SELECT d.day, COUNT(mc.due_date)::int AS c
          FROM days d
          LEFT JOIN machine_counts mc ON mc.due_date < d.day
          GROUP BY d.day
        )
        SELECT COALESCE(jsonb_agg(jsonb_build_object('date', to_char(day, 'Mon DD'), 'count', c) ORDER BY day), '[]'::jsonb)
        FROM overdue_by_day
      )
    ) INTO v_result;
  ELSE
    SELECT jsonb_build_object(
      'monthly_services', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('month', to_char(m, 'Mon'), 'count', c) ORDER BY m), '[]'::jsonb)
        FROM (
          SELECT date_trunc('month', generate_series(CURRENT_DATE - INTERVAL '11 months', CURRENT_DATE, INTERVAL '1 month'))::date AS m
        ) months
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS c
          FROM public.service_records
          WHERE service_date >= m
            AND service_date < m + INTERVAL '1 month'
        ) s ON true
      ),
      'overdue_trend', (
        WITH machine_counts AS (
          SELECT next_service_due_date AS due_date, COUNT(*)::int AS c
          FROM public.machines
          WHERE status = 'active'
            AND next_service_due_date < CURRENT_DATE
          GROUP BY next_service_due_date
        ),
        days AS (
          SELECT generate_series(CURRENT_DATE - 29, CURRENT_DATE, 1)::date AS day
        ),
        overdue_by_day AS (
          SELECT d.day, COUNT(mc.due_date)::int AS c
          FROM days d
          LEFT JOIN machine_counts mc ON mc.due_date < d.day
          GROUP BY d.day
        )
        SELECT COALESCE(jsonb_agg(jsonb_build_object('date', to_char(day, 'Mon DD'), 'count', c) ORDER BY day), '[]'::jsonb)
        FROM overdue_by_day
      )
    ) INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_charts(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_charts(uuid, text) TO service_role;

-- ============================================
-- 3. get_dashboard_due_lists(p_user_id, p_role)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_dashboard_due_lists(p_user_id uuid, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid := p_user_id;
  v_role     text := p_role;
  v_today    date := CURRENT_DATE;
  v_tomorrow date := CURRENT_DATE + 1;
  v_result   jsonb;
BEGIN
  IF v_user_id IS NULL OR v_role IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_role = 'engineer' THEN
    SELECT jsonb_build_object(
      'due_today', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'machine_code', machine_code, 'customer_name', customer_name) ORDER BY next_service_due_date), '[]'::jsonb)
        FROM (
          SELECT id, machine_code, customer_name, next_service_due_date
          FROM public.machines
          WHERE engineer_id = v_user_id AND status = 'active' AND next_service_due_date = v_today
          LIMIT 5
        ) t
      ),
      'due_tomorrow', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'machine_code', machine_code, 'customer_name', customer_name) ORDER BY next_service_due_date), '[]'::jsonb)
        FROM (
          SELECT id, machine_code, customer_name, next_service_due_date
          FROM public.machines
          WHERE engineer_id = v_user_id AND status = 'active' AND next_service_due_date = v_tomorrow
          LIMIT 5
        ) t
      ),
      'overdue_machines', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'machine_code', machine_code, 'customer_name', customer_name) ORDER BY next_service_due_date), '[]'::jsonb)
        FROM (
          SELECT id, machine_code, customer_name, next_service_due_date
          FROM public.machines
          WHERE engineer_id = v_user_id AND status = 'active' AND next_service_due_date < v_today
          LIMIT 5
        ) t
      )
    ) INTO v_result;
  ELSE
    SELECT jsonb_build_object(
      'due_today', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'machine_code', machine_code, 'customer_name', customer_name) ORDER BY next_service_due_date), '[]'::jsonb)
        FROM (
          SELECT id, machine_code, customer_name, next_service_due_date
          FROM public.machines
          WHERE status = 'active' AND next_service_due_date = v_today
          LIMIT 5
        ) t
      ),
      'due_tomorrow', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'machine_code', machine_code, 'customer_name', customer_name) ORDER BY next_service_due_date), '[]'::jsonb)
        FROM (
          SELECT id, machine_code, customer_name, next_service_due_date
          FROM public.machines
          WHERE status = 'active' AND next_service_due_date = v_tomorrow
          LIMIT 5
        ) t
      ),
      'overdue_machines', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'machine_code', machine_code, 'customer_name', customer_name) ORDER BY next_service_due_date), '[]'::jsonb)
        FROM (
          SELECT id, machine_code, customer_name, next_service_due_date
          FROM public.machines
          WHERE status = 'active' AND next_service_due_date < v_today
          LIMIT 5
        ) t
      )
    ) INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_due_lists(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_due_lists(uuid, text) TO service_role;

-- ============================================
-- 4. get_recent_activity_slim(p_user_id, p_role)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_recent_activity_slim(p_user_id uuid, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := p_user_id;
  v_role    text := p_role;
  v_result  jsonb;
BEGIN
  IF v_user_id IS NULL OR v_role IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF v_role = 'engineer' THEN
    RETURN '[]'::jsonb; -- Engineers never see audit logs
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'action', a.action,
    'created_at', a.created_at,
    'user', jsonb_build_object('full_name', u.full_name, 'role', u.role)
  ) ORDER BY a.created_at DESC), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT id, action, created_at, user_id
    FROM public.audit_logs
    ORDER BY created_at DESC
    LIMIT 20
  ) a
  LEFT JOIN public.users u ON u.id = a.user_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_recent_activity_slim(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recent_activity_slim(uuid, text) TO service_role;

-- ============================================
-- 5. get_notification_stats(p_user_id, p_role)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_notification_stats(p_user_id uuid, p_role text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := p_user_id;
  v_role    text := p_role;
  v_today   date := CURRENT_DATE;
  v_result  jsonb;
BEGIN
  IF v_user_id IS NULL OR v_role IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_role = 'engineer' THEN
    SELECT jsonb_build_object(
      'total',       COUNT(*),
      'sent',        COUNT(*) FILTER (WHERE status = 'sent'),
      'failed',      COUNT(*) FILTER (WHERE status = 'failed'),
      'pending',     COUNT(*) FILTER (WHERE status = 'pending'),
      'sentToday',   COUNT(*) FILTER (WHERE status = 'sent' AND alert_date = v_today),
      'failedToday', COUNT(*) FILTER (WHERE status = 'failed' AND alert_date = v_today)
    )
    INTO v_result
    FROM public.notifications
    WHERE recipient_id = v_user_id;
  ELSE
    SELECT jsonb_build_object(
      'total',       COUNT(*),
      'sent',        COUNT(*) FILTER (WHERE status = 'sent'),
      'failed',      COUNT(*) FILTER (WHERE status = 'failed'),
      'pending',     COUNT(*) FILTER (WHERE status = 'pending'),
      'sentToday',   COUNT(*) FILTER (WHERE status = 'sent' AND alert_date = v_today),
      'failedToday', COUNT(*) FILTER (WHERE status = 'failed' AND alert_date = v_today)
    )
    INTO v_result
    FROM public.notifications;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_notification_stats(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_notification_stats(uuid, text) TO service_role;

-- ============================================
-- 6. MISSING INDEXES
-- ============================================

-- Admin "completed today" / monthly-chart aggregation on service_records
CREATE INDEX IF NOT EXISTS idx_service_records_service_date
  ON public.service_records (service_date DESC);

-- Full-text-ish search on machine_code / machine_name / customer_name
-- (enables ILIKE '%...%' prefix+infix searches via trigram GIN)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_machines_code_trgm
  ON public.machines USING gin (machine_code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_machines_name_trgm
  ON public.machines USING gin (machine_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_machines_customer_trgm
  ON public.machines USING gin (customer_name gin_trgm_ops);

-- Customer-sent notifications (recipient_id IS NULL) filtering by date/status
CREATE INDEX IF NOT EXISTS idx_notifications_customer_date_status
  ON public.notifications (alert_date, status)
  WHERE recipient_id IS NULL;

-- ============================================
-- End of Migration 005
-- ============================================