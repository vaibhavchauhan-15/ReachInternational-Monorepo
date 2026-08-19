-- ============================================
-- ServiceSentry — Performance Optimization Migration 004
-- Modular Dashboard RPC Functions for Independent Streaming
-- 1. get_dashboard_kpis()
-- 2. get_dashboard_charts()
-- 3. get_dashboard_due_lists()
-- 4. get_recent_activity_slim()
-- 5. get_dashboard_payload() — fallback wrapper
-- 6. get_notification_stats()
-- All functions are SECURITY DEFINER and role-aware via auth.uid().
-- ============================================

-- ============================================
-- 1. get_dashboard_kpis()
-- ============================================
CREATE OR REPLACE FUNCTION public.get_dashboard_kpis()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role    text;
  v_today   date := CURRENT_DATE;
  v_tomorrow date := CURRENT_DATE + 1;
  v_result  jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_user_id;
  IF v_role IS NULL THEN
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

REVOKE ALL ON FUNCTION public.get_dashboard_kpis() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_kpis() TO authenticated;

-- ============================================
-- 2. get_dashboard_charts()
-- ============================================
CREATE OR REPLACE FUNCTION public.get_dashboard_charts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role    text;
  v_result  jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_user_id;
  IF v_role IS NULL THEN
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
        SELECT COALESCE(jsonb_agg(jsonb_build_object('date', to_char(d, 'Mon DD'), 'count', c) ORDER BY d), '[]'::jsonb)
        FROM (
          SELECT generate_series(CURRENT_DATE - 29, CURRENT_DATE, 1)::date AS d
        ) days
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS c
          FROM public.machines
          WHERE engineer_id = v_user_id
            AND status = 'active'
            AND next_service_due_date < d
        ) m ON true
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
        SELECT COALESCE(jsonb_agg(jsonb_build_object('date', to_char(d, 'Mon DD'), 'count', c) ORDER BY d), '[]'::jsonb)
        FROM (
          SELECT generate_series(CURRENT_DATE - 29, CURRENT_DATE, 1)::date AS d
        ) days
        LEFT JOIN LATERAL (
          SELECT COUNT(*) AS c
          FROM public.machines
          WHERE status = 'active'
            AND next_service_due_date < d
        ) m ON true
      )
    ) INTO v_result;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_charts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_charts() TO authenticated;

-- ============================================
-- 3. get_dashboard_due_lists()
-- ============================================
CREATE OR REPLACE FUNCTION public.get_dashboard_due_lists()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id  uuid := auth.uid();
  v_role     text;
  v_today    date := CURRENT_DATE;
  v_tomorrow date := CURRENT_DATE + 1;
  v_result   jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_user_id;
  IF v_role IS NULL THEN
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

REVOKE ALL ON FUNCTION public.get_dashboard_due_lists() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_due_lists() TO authenticated;

-- ============================================
-- 4. get_recent_activity_slim()
-- ============================================
CREATE OR REPLACE FUNCTION public.get_recent_activity_slim()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role    text;
  v_result  jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_user_id;
  IF v_role IS NULL OR v_role = 'engineer' THEN
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

REVOKE ALL ON FUNCTION public.get_recent_activity_slim() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recent_activity_slim() TO authenticated;

-- ============================================
-- 5. get_dashboard_payload() — combined fallback wrapper
-- ============================================
CREATE OR REPLACE FUNCTION public.get_dashboard_payload()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kpis     jsonb := public.get_dashboard_kpis();
  v_charts   jsonb := public.get_dashboard_charts();
  v_dues     jsonb := public.get_dashboard_due_lists();
  v_activity jsonb := public.get_recent_activity_slim();
BEGIN
  IF v_kpis IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'kpis', v_kpis,
    'monthly_services', COALESCE(v_charts->'monthly_services', '[]'::jsonb),
    'overdue_trend',    COALESCE(v_charts->'overdue_trend', '[]'::jsonb),
    'due_today',        COALESCE(v_dues->'due_today', '[]'::jsonb),
    'due_tomorrow',     COALESCE(v_dues->'due_tomorrow', '[]'::jsonb),
    'overdue_machines', COALESCE(v_dues->'overdue_machines', '[]'::jsonb),
    'recent_activity',  COALESCE(v_activity, '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_payload() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_payload() TO authenticated;

-- ============================================
-- 6. get_notification_stats()
-- ============================================
CREATE OR REPLACE FUNCTION public.get_notification_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_role    text;
  v_today   date := CURRENT_DATE;
  v_result  jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_user_id;
  IF v_role IS NULL THEN
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

REVOKE ALL ON FUNCTION public.get_notification_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_notification_stats() TO authenticated;

-- ============================================
-- End of Migration 004
-- ============================================