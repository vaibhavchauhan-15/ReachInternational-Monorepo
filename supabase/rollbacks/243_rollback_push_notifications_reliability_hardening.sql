-- ==============================================================================
-- Rollback for Migration 243: Push Notifications Reliability & Security Hardening
-- Restores the pre-243 function bodies (192/193 semantics), drops added columns,
-- the receipts cron, the health view and the added indexes.
-- Target: Reach International Dev (vlmxciuogczumumrwyot). Never run against Prod.
-- ==============================================================================

-- 10. Health view
DROP VIEW IF EXISTS public.push_delivery_health;

-- 9. Receipts poller cron
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'push_receipts_poller') THEN
    PERFORM cron.unschedule('push_receipts_poller');
  END IF;
END $$;

-- 8. Fast-path trigger: restore 193 WHEN clause (critical/high only)
DROP TRIGGER IF EXISTS trg_notifications_fastpath ON public.notifications;
CREATE TRIGGER trg_notifications_fastpath
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  WHEN (NEW.push_status = 'pending' AND NEW.send_after <= now() AND NEW.priority IN ('critical', 'high'))
  EXECUTE FUNCTION public.notify_fastpath_trigger();

-- 7. finish_push_batch: restore migration 192 body
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

-- 6. claim_push_batch: restore migration 192 body (pre-243 semantics)
DROP FUNCTION IF EXISTS public.claim_push_batch(int, uuid[]);

CREATE OR REPLACE FUNCTION public.claim_push_batch(
  p_limit int DEFAULT 200,
  p_ids uuid[] DEFAULT NULL
)
RETURNS TABLE (
  notification_id uuid,
  user_id         uuid,
  title           text,
  body            text,
  deep_link       text,
  category        text,
  priority        text,
  ttl_seconds     int,
  device_id       uuid,
  provider        text,
  platform        text,
  token           text,
  web_keys        jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  WITH picked AS (
    SELECT n.id
    FROM public.notifications n
    WHERE (
      n.push_status = 'pending'
      AND n.send_after <= now()
      AND (p_ids IS NULL OR n.id = ANY(p_ids))
    ) OR (
      n.push_status = 'sending'
      AND n.claimed_at < now() - interval '2 minutes'
      AND n.push_attempts < 5
    )
    ORDER BY
      CASE n.priority
        WHEN 'critical' THEN 0
        WHEN 'high'     THEN 1
        WHEN 'normal'   THEN 2
        ELSE 3
      END,
      n.send_after ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ),
  upd AS (
    UPDATE public.notifications n
    SET push_status = 'sending',
        claimed_at = now(),
        push_attempts = n.push_attempts + 1
    FROM picked
    WHERE n.id = picked.id
    RETURNING n.id
  )
  SELECT array_agg(id) INTO v_ids FROM upd;

  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.notifications
  SET push_status = 'skipped',
      push_status_reason = 'irrelevant'
  WHERE id = ANY(v_ids)
    AND recheck IS NOT NULL
    AND NOT public.notification_still_relevant(recheck);

  UPDATE public.notifications n
  SET push_status = 'skipped',
      push_status_reason = 'preferences_disabled'
  FROM public.user_notification_preferences p
  WHERE n.id = ANY(v_ids)
    AND n.push_status = 'sending'
    AND p.user_id = n.user_id
    AND n.category <> 'security'
    AND (
      NOT p.push_enabled OR NOT CASE n.category
        WHEN 'shift_reminders'   THEN p.shift_reminders
        WHEN 'breakdown_alerts'  THEN p.breakdown_alerts
        WHEN 'assignment_alerts' THEN p.assignment_alerts
        WHEN 'admin_alerts'      THEN p.admin_alerts
        WHEN 'payroll_alerts'    THEN p.payroll_alerts
        ELSE true
      END
    );

  UPDATE public.notifications n
  SET push_status = 'pending',
      push_attempts = n.push_attempts - 1,
      push_status_reason = 'quiet_hours_deferred',
      send_after = (
        (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata')
         + CASE
             WHEN p.quiet_hours_start > p.quiet_hours_end
                  AND (now() AT TIME ZONE 'Asia/Kolkata')::time >= p.quiet_hours_start
             THEN interval '1 day'
             ELSE interval '0'
           END
         + p.quiet_hours_end) AT TIME ZONE 'Asia/Kolkata'
      )
  FROM public.user_notification_preferences p
  WHERE n.id = ANY(v_ids)
    AND n.push_status = 'sending'
    AND n.priority <> 'critical'
    AND p.user_id = n.user_id
    AND p.quiet_hours_enabled
    AND CASE
      WHEN p.quiet_hours_start > p.quiet_hours_end
      THEN (now() AT TIME ZONE 'Asia/Kolkata')::time >= p.quiet_hours_start
        OR (now() AT TIME ZONE 'Asia/Kolkata')::time <  p.quiet_hours_end
      ELSE (now() AT TIME ZONE 'Asia/Kolkata')::time BETWEEN p.quiet_hours_start AND p.quiet_hours_end
    END;

  UPDATE public.notifications n
  SET push_status = 'skipped',
      push_status_reason = 'daily_cap_exceeded'
  WHERE n.id = ANY(v_ids)
    AND n.push_status = 'sending'
    AND n.priority <> 'critical'
    AND (
      SELECT count(*)
      FROM public.notifications s
      WHERE s.user_id = n.user_id
        AND s.push_status = 'sent'
        AND s.priority <> 'critical'
        AND s.created_at > now() - interval '24 hours'
    ) >= 5;

  UPDATE public.notifications n
  SET push_status = 'skipped',
      push_status_reason = 'no_active_device'
  WHERE n.id = ANY(v_ids)
    AND n.push_status = 'sending'
    AND NOT EXISTS (
      SELECT 1 FROM public.push_devices d
      WHERE d.user_id = n.user_id AND d.is_active = true
    );

  RETURN QUERY
  SELECT
    n.id AS notification_id,
    n.user_id,
    n.title,
    COALESCE(n.body, n.message) AS body,
    n.deep_link,
    n.category,
    n.priority,
    n.ttl_seconds,
    d.id AS device_id,
    d.provider,
    d.platform,
    d.token,
    d.web_keys
  FROM public.notifications n
  JOIN public.push_devices d
    ON d.user_id = n.user_id
   AND d.is_active = true
  WHERE n.id = ANY(v_ids)
    AND n.push_status = 'sending';
END;
$$;

REVOKE ALL ON FUNCTION public.claim_push_batch(int, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_batch(int, uuid[]) TO service_role;

-- 5. begin_push_send
DROP FUNCTION IF EXISTS public.begin_push_send(uuid[]);

-- 4. register_push_device: restore original signature and body
DROP FUNCTION IF EXISTS public.register_push_device(text, text, text, jsonb, text, text, text, text);

CREATE OR REPLACE FUNCTION public.register_push_device(
  p_platform text,
  p_provider text,
  p_token text,
  p_web_keys jsonb DEFAULT NULL,
  p_app_version text DEFAULT NULL,
  p_label text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.push_devices (
    user_id, platform, provider, token, web_keys, app_version, device_label
  ) VALUES (
    auth.uid(), p_platform, p_provider, p_token, p_web_keys, p_app_version, p_label
  )
  ON CONFLICT (token) DO UPDATE
     SET user_id = auth.uid(),
         web_keys = EXCLUDED.web_keys,
         app_version = EXCLUDED.app_version,
         device_label = COALESCE(EXCLUDED.device_label, push_devices.device_label),
         is_active = true,
         fail_count = 0,
         disabled_reason = NULL,
         last_seen_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_device(text, text, text, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_device(text, text, text, jsonb, text, text) TO authenticated, service_role;

-- 3. notifications timing columns
ALTER TABLE public.notifications DROP COLUMN IF EXISTS send_started_at;
ALTER TABLE public.notifications DROP COLUMN IF EXISTS provider_accepted_at;

-- 2. push_tickets columns/index/constraints
DROP INDEX IF EXISTS public.uq_push_tickets_notif_device;
ALTER TABLE public.push_tickets DROP COLUMN IF EXISTS provider;
ALTER TABLE public.push_tickets DROP COLUMN IF EXISTS outcome;
ALTER TABLE public.push_tickets DROP CONSTRAINT IF EXISTS push_tickets_outcome_check;
ALTER TABLE public.push_tickets ALTER COLUMN ticket_id SET NOT NULL;

-- 1. push_devices columns/index
DROP INDEX IF EXISTS public.idx_push_devices_installation;
ALTER TABLE public.push_devices DROP COLUMN IF EXISTS installation_id;
ALTER TABLE public.push_devices DROP COLUMN IF EXISTS vapid_version;
