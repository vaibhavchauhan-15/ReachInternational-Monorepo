-- Migration 196: Push Notification Observability Views
-- Author: ReachInternational AI Engineering Team
-- Date: 2026-11-14

-- 1. Ensure sent_at column exists on public.notifications
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS sent_at timestamptz;

-- 2. Daily Push Delivery Metrics View (latency, status distribution, failure reasons)
CREATE OR REPLACE VIEW public.v_push_delivery_metrics AS
SELECT
  (created_at AT TIME ZONE 'Asia/Kolkata')::date AS date_ist,
  coalesce(category, 'general') AS category,
  priority,
  push_status,
  coalesce(push_status_reason, 'none') AS push_status_reason,
  count(*)::bigint AS notification_count,
  round(avg(extract(epoch from (sent_at - created_at)))::numeric, 2) AS avg_delivery_latency_sec,
  round(percentile_cont(0.95) within group (order by extract(epoch from (sent_at - created_at)))::numeric, 2) AS p95_delivery_latency_sec
FROM public.notifications
WHERE created_at >= (now() - interval '30 days')
GROUP BY 1, 2, 3, 4, 5
ORDER BY 1 DESC, 2, 3;

-- 3. Device Fleet Health View (platform distribution, active vs deactivated, churn)
CREATE OR REPLACE VIEW public.v_push_device_health AS
SELECT
  platform,
  is_active,
  coalesce(app_version, 'unknown') AS app_version,
  count(*)::bigint AS device_count,
  min(created_at) AS oldest_registration,
  max(last_seen_at) AS latest_activity
FROM public.push_devices
GROUP BY platform, is_active, app_version
ORDER BY platform, is_active DESC;

-- 4. Ensure finish_push_batch populates sent_at on delivery success
CREATE OR REPLACE FUNCTION public.finish_push_batch(p_results jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_res jsonb;
  v_notif_id uuid;
  v_device_id uuid;
  v_outcome text;
  v_ticket_id text;
  v_error text;
BEGIN
  IF p_results IS NULL OR jsonb_array_length(p_results) = 0 THEN
    RETURN;
  END IF;

  -- 1. Device updates and ticket storage
  FOR v_res IN SELECT * FROM jsonb_array_elements(p_results)
  LOOP
    v_notif_id  := (v_res->>'notification_id')::uuid;
    v_device_id := (v_res->>'device_id')::uuid;
    v_outcome   := v_res->>'outcome';
    v_ticket_id := v_res->>'ticket_id';
    v_error     := v_res->>'error';

    IF v_outcome = 'ok' THEN
      UPDATE public.push_devices
         SET fail_count = 0, last_seen_at = now()
       WHERE id = v_device_id;

      IF v_ticket_id IS NOT NULL THEN
        INSERT INTO public.push_tickets (notification_id, device_id, ticket_id, status)
        VALUES (v_notif_id, v_device_id, v_ticket_id, 'ticketed');
      END IF;

    ELSIF v_outcome = 'dead' THEN
      UPDATE public.push_devices
         SET is_active = false,
             disabled_reason = COALESCE(v_error, 'device_unregistered'),
             fail_count = fail_count + 1
       WHERE id = v_device_id;

    ELSIF v_outcome = 'retry' THEN
      UPDATE public.push_devices
         SET fail_count = fail_count + 1,
             is_active = CASE WHEN fail_count + 1 >= 5 THEN false ELSE is_active END,
             disabled_reason = CASE WHEN fail_count + 1 >= 5 THEN 'consecutive_failures' ELSE disabled_reason END
       WHERE id = v_device_id;
    END IF;
  END LOOP;

  -- 2. Aggregate outcomes per notification
  WITH batch_items AS (
    SELECT
      (r->>'notification_id')::uuid AS notif_id,
      r->>'outcome' AS outcome
    FROM jsonb_array_elements(p_results) r
    WHERE r->>'notification_id' IS NOT NULL
  ),
  aggregated AS (
    SELECT
      notif_id,
      bool_or(outcome = 'ok') AS has_ok,
      bool_or(outcome = 'retry') AS has_retry,
      bool_and(outcome = 'dead') AS all_dead
    FROM batch_items
    GROUP BY notif_id
  )
  UPDATE public.notifications n
     SET push_status = CASE
           WHEN a.has_ok THEN 'sent'
           WHEN a.has_retry AND n.push_attempts < 5 THEN 'pending'
           WHEN a.has_retry AND n.push_attempts >= 5 THEN 'failed'
           WHEN a.all_dead THEN 'skipped'
           ELSE 'failed'
         END,
         push_status_reason = CASE
           WHEN a.has_ok THEN NULL
           WHEN a.has_retry AND n.push_attempts >= 5 THEN 'max_retries_exceeded'
           WHEN a.all_dead THEN 'all_devices_dead'
           ELSE 'push_failed'
         END,
         sent_at = CASE
           WHEN a.has_ok THEN COALESCE(n.sent_at, now())
           ELSE n.sent_at
         END,
         send_after = CASE
           WHEN NOT a.has_ok AND a.has_retry AND n.push_attempts < 5
           THEN now() + (interval '30 seconds' * power(2, GREATEST(0, n.push_attempts - 1)))
           ELSE n.send_after
         END
    FROM aggregated a
   WHERE n.id = a.notif_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finish_push_batch(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_push_batch(jsonb) TO service_role;

-- 5. Grant SELECT permissions to authenticated admins/super_admins
GRANT SELECT ON public.v_push_delivery_metrics TO authenticated;
GRANT SELECT ON public.v_push_device_health TO authenticated;
