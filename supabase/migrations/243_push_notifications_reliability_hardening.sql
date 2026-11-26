-- ==============================================================================
-- Migration 243: Push Notifications Reliability & Security Hardening
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
-- Source of truth: AI/FEATURES/push-notifications.md (Phase 0 audit, 2026-11-26)
-- Rollback: supabase/rollbacks/243_rollback_push_notifications_reliability_hardening.sql
--
-- All changes are ADDITIVE or behavior fixes inside SECURITY DEFINER functions.
-- NO RLS, grant, or role-permission semantics are changed (G-S5 is gated and NOT
-- part of this migration).
--
-- Contents:
--  1. push_devices: installation_id + vapid_version columns (additive).
--  2. push_tickets: per-(notification x device) delivery state for ALL providers
--     (provider/outcome columns, nullable ticket_id, idempotent unique key).
--  3. notifications: provider timing columns (send_started_at, provider_accepted_at).
--  4. register_push_device v2: provider derivation, endpoint/token validation
--     (SSRF guard, G-S2), installation dedupe, per-user/per-platform cap with
--     LRU deactivation + redacted audit event (G-C9). Signature gains defaulted
--     parameters only; all callers use named arguments.
--  5. begin_push_send: marks provider request start (latency instrumentation).
--  6. claim_push_batch v2: preference CASE fixed to canonical category spellings
--     (G-C3), TTL/deadline expiry enforcement (G-C10), per-device delivered
--     guard (verdict A), effective TTL capped by business deadline.
--  7. finish_push_batch v2: 'skip' outcome (no device mutation, G-C4),
--     permanent vs transient semantics, per-device delivery rows for all
--     providers, mixed-outcome aggregation so one device's success never
--     cancels another device's retry (verdict A).
--  8. Fast-path trigger WHEN aligned with migration 199 intent (include 'normal').
--  9. push_receipts_poller cron (G-C7: /api/notify/receipts was never scheduled).
-- 10. push_delivery_health view (queue depth, oldest pending, provider failure
--     rate, invalid-token rate).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. push_devices: installation identity + VAPID key version (additive)
-- ------------------------------------------------------------------------------
ALTER TABLE public.push_devices
  ADD COLUMN IF NOT EXISTS installation_id text,
  ADD COLUMN IF NOT EXISTS vapid_version text;

CREATE INDEX IF NOT EXISTS idx_push_devices_installation
  ON public.push_devices (installation_id)
  WHERE installation_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. push_tickets: per-(notification x device) delivery state, all providers
-- ------------------------------------------------------------------------------
ALTER TABLE public.push_tickets
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'expo',
  ADD COLUMN IF NOT EXISTS outcome text,
  ALTER COLUMN ticket_id DROP NOT NULL;

ALTER TABLE public.push_tickets DROP CONSTRAINT IF EXISTS push_tickets_status_check;
ALTER TABLE public.push_tickets
  ADD CONSTRAINT push_tickets_status_check
  CHECK (status IN ('ticketed','ok','error'));

ALTER TABLE public.push_tickets DROP CONSTRAINT IF EXISTS push_tickets_outcome_check;
ALTER TABLE public.push_tickets
  ADD CONSTRAINT push_tickets_outcome_check
  CHECK (outcome IN ('accepted','retry','dead','skipped'));

-- Idempotent delivery target: one delivery record per (notification, device)
CREATE UNIQUE INDEX IF NOT EXISTS uq_push_tickets_notif_device
  ON public.push_tickets (notification_id, device_id);

-- ------------------------------------------------------------------------------
-- 3. notifications: provider timing (additive; latency instrumentation G-L1)
-- ------------------------------------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS send_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_accepted_at timestamptz;

-- ------------------------------------------------------------------------------
-- 4. register_push_device v2
--    - provider derived from platform when omitted (fixes G-C1 for old clients)
--    - endpoint/token validation (G-S2 SSRF guard)
--    - installation dedupe (no stale duplicate tokens per physical install)
--    - configurable per-user/per-platform cap, LRU deactivation, redacted audit
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.register_push_device(text, text, text, jsonb, text, text);

CREATE OR REPLACE FUNCTION public.register_push_device(
  p_platform text,
  p_token text,
  p_provider text DEFAULT NULL,
  p_web_keys jsonb DEFAULT NULL,
  p_app_version text DEFAULT NULL,
  p_label text DEFAULT NULL,
  p_installation_id text DEFAULT NULL,
  p_vapid_version text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider text;
  v_host text;
  v_cap int;
  v_user uuid := auth.uid();
  v_lru record;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '42501';
  END IF;

  IF p_platform IS NULL OR p_platform NOT IN ('android','ios','web') THEN
    RAISE EXCEPTION 'invalid_platform' USING ERRCODE = '22023';
  END IF;

  IF p_token IS NULL OR length(p_token) < 10 OR length(p_token) > 4096 THEN
    RAISE EXCEPTION 'invalid_token_format' USING ERRCODE = '22023';
  END IF;

  v_provider := COALESCE(NULLIF(p_provider, ''),
                         CASE WHEN p_platform = 'web' THEN 'webpush' ELSE 'expo' END);

  IF v_provider NOT IN ('expo','webpush') THEN
    RAISE EXCEPTION 'invalid_provider' USING ERRCODE = '22023';
  END IF;

  IF v_provider = 'webpush' THEN
    -- SSRF guard (G-S2): HTTPS endpoints on known push-service hosts only
    IF p_token !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?/' THEN
      RAISE EXCEPTION 'invalid_endpoint_host' USING ERRCODE = '22023';
    END IF;
    v_host := substring(p_token from '^https://([^/:]+)');
    IF v_host NOT IN (
      'fcm.googleapis.com',
      'android.googleapis.com',
      'updates.push.services.mozilla.com',
      'web.push.apple.com',
      'push.apple.com',
      'wns.windows.com'
    ) THEN
      RAISE EXCEPTION 'invalid_endpoint_host' USING ERRCODE = '22023';
    END IF;
  ELSE
    -- Expo token shapes: ExponentPushToken[...], ExpoPushToken[...], or bare UUID
    IF p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9._:-]+\]$'
       AND p_token !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' THEN
      RAISE EXCEPTION 'invalid_token_format' USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.push_devices (
    user_id, platform, provider, token, web_keys, app_version, device_label,
    installation_id, vapid_version
  ) VALUES (
    v_user, p_platform, v_provider, p_token, p_web_keys, p_app_version, p_label,
    NULLIF(p_installation_id, ''), NULLIF(p_vapid_version, '')
  )
  ON CONFLICT (token) DO UPDATE
     SET user_id = v_user,
         platform = EXCLUDED.platform,
         provider = EXCLUDED.provider,
         web_keys = EXCLUDED.web_keys,
         app_version = EXCLUDED.app_version,
         device_label = COALESCE(EXCLUDED.device_label, push_devices.device_label),
         installation_id = COALESCE(EXCLUDED.installation_id, push_devices.installation_id),
         vapid_version = COALESCE(EXCLUDED.vapid_version, push_devices.vapid_version),
         is_active = true,
         fail_count = 0,
         disabled_reason = NULL,
         last_seen_at = now();

  -- Installation dedupe: one physical install keeps exactly one live token
  IF p_installation_id IS NOT NULL THEN
    UPDATE public.push_devices
       SET is_active = false,
           disabled_reason = 'superseded_token'
     WHERE installation_id = p_installation_id
       AND token <> p_token
       AND is_active = true;
  END IF;

  -- Configurable per-user, per-platform cap (G-C9):
  -- never reject the new device; deactivate least-recently-seen instead.
  v_cap := COALESCE(NULLIF(current_setting('app.push_device_cap', true), ''), '10')::int;

  WHILE (SELECT count(*) FROM public.push_devices d
          WHERE d.user_id = v_user AND d.platform = p_platform AND d.is_active) > v_cap
  LOOP
    SELECT d.id INTO v_lru
      FROM public.push_devices d
     WHERE d.user_id = v_user AND d.platform = p_platform AND d.is_active
     ORDER BY d.last_seen_at ASC, d.created_at ASC
     LIMIT 1;

    EXIT WHEN v_lru.id IS NULL;

    UPDATE public.push_devices
       SET is_active = false,
           disabled_reason = 'device_cap_lru'
     WHERE id = v_lru.id;

    -- Redacted audit event: no token, no endpoint, no keys
    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, metadata, category, severity)
    VALUES (v_user, 'push.device_cap_lru_deactivated', 'push_device', v_lru.id::text,
            jsonb_build_object('platform', p_platform, 'cap', v_cap), 'security', 'info');
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.register_push_device(text, text, text, jsonb, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_device(text, text, text, jsonb, text, text, text, text) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. begin_push_send: provider request start marker (latency instrumentation)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.begin_push_send(p_ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.notifications
     SET send_started_at = COALESCE(send_started_at, now())
   WHERE id = ANY(p_ids)
     AND push_status = 'sending';
$$;

REVOKE ALL ON FUNCTION public.begin_push_send(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_push_send(uuid[]) TO service_role;

-- ------------------------------------------------------------------------------
-- 6. claim_push_batch v2
-- ------------------------------------------------------------------------------
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
  -- 1. Claim up to p_limit rows with SKIP LOCKED (lease: 2 minutes on 'sending')
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

  -- 2. Expiry (G-C10): never dispatch expired notifications.
  --    Generic TTL from creation, and business deadline for shift reminders.
  --    All references qualified: the RETURNS TABLE out-parameters shadow
  --    same-named columns (notably ttl_seconds) inside the body.
  UPDATE public.notifications n
  SET push_status = 'skipped',
      push_status_reason = 'ttl_expired'
  WHERE n.id = ANY(v_ids)
    AND n.push_status = 'sending'
    AND (
      n.created_at + make_interval(secs => n.ttl_seconds) < now()
      OR (
        n.recheck IS NOT NULL
        AND n.recheck->>'kind' = 'shift_pending'
        AND n.recheck ? 'work_date'
        AND now() > public.shift_entry_deadline((n.recheck->>'work_date')::date)
      )
    );

  -- 3. Relevance Check (send-time verification)
  UPDATE public.notifications n
  SET push_status = 'skipped',
      push_status_reason = 'irrelevant'
  WHERE n.id = ANY(v_ids)
    AND n.recheck IS NOT NULL
    AND NOT public.notification_still_relevant(n.recheck);

  -- 4. Preferences Check (missing row = all enabled defaults; security bypasses).
  --    Canonical category spellings (registry) plus legacy aliases (G-C3).
  UPDATE public.notifications n
  SET push_status = 'skipped',
      push_status_reason = 'preferences_disabled'
  FROM public.user_notification_preferences p
  WHERE n.id = ANY(v_ids)
    AND n.push_status = 'sending'
    AND p.user_id = n.user_id
    AND n.category <> 'security'
    AND (
      NOT p.push_enabled OR NOT CASE
        WHEN n.category IN ('shift_reminder', 'shift_reminders')  THEN p.shift_reminders
        WHEN n.category IN ('breakdown', 'breakdown_alerts')      THEN p.breakdown_alerts
        WHEN n.category IN ('assignment', 'assignment_alerts')    THEN p.assignment_alerts
        WHEN n.category IN ('admin', 'admin_alerts')              THEN p.admin_alerts
        WHEN n.category IN ('payroll', 'payroll_alerts')          THEN p.payroll_alerts
        ELSE true
      END
    );

  -- 5. Quiet Hours (Asia/Kolkata), non-critical: defer rather than drop
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

  -- 6. Daily Cap Enforcement (max 5 non-critical pushes in past 24 hours)
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

  -- 7. No Active Device Registered
  UPDATE public.notifications n
  SET push_status = 'skipped',
      push_status_reason = 'no_active_device'
  WHERE n.id = ANY(v_ids)
    AND n.push_status = 'sending'
    AND NOT EXISTS (
      SELECT 1 FROM public.push_devices d
      WHERE d.user_id = n.user_id AND d.is_active = true
    );

  -- 8. All active devices already delivered to (e.g. sibling device deactivated
  --    after partial success) => complete the notification.
  UPDATE public.notifications n
  SET push_status = 'sent',
      sent_at = COALESCE(n.sent_at, now())
  WHERE id = ANY(v_ids)
    AND n.push_status = 'sending'
    AND NOT EXISTS (
      SELECT 1 FROM public.push_devices d
      WHERE d.user_id = n.user_id
        AND d.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM public.push_tickets pt
          WHERE pt.notification_id = n.id
            AND pt.device_id = d.id
            AND pt.outcome = 'accepted'
        )
    );

  -- 9. Fan out to active devices not yet delivered to (verdict A: per-device
  --    delivery independence — a delivered device is never re-sent to, while
  --    undelivered siblings keep their retry).
  RETURN QUERY
  SELECT
    n.id AS notification_id,
    n.user_id,
    n.title,
    COALESCE(n.body, n.message) AS body,
    n.deep_link,
    n.category,
    n.priority,
    LEAST(
      n.ttl_seconds,
      CASE
        WHEN n.recheck->>'kind' = 'shift_pending' AND n.recheck ? 'work_date'
        THEN GREATEST(60, EXTRACT(EPOCH FROM (
               public.shift_entry_deadline((n.recheck->>'work_date')::date) - now()
             ))::int)
        ELSE n.ttl_seconds
      END
    ) AS ttl_seconds,
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
    AND n.push_status = 'sending'
    AND NOT EXISTS (
      SELECT 1 FROM public.push_tickets pt
      WHERE pt.notification_id = n.id
        AND pt.device_id = d.id
        AND pt.outcome = 'accepted'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_push_batch(int, uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_push_batch(int, uuid[]) TO service_role;

-- ------------------------------------------------------------------------------
-- 7. finish_push_batch v2
-- ------------------------------------------------------------------------------
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

  -- 1. Per-device outcome handling + idempotent delivery records (all providers)
  FOR v_res IN SELECT * FROM jsonb_array_elements(p_results)
  LOOP
    v_notif_id  := (v_res->>'notification_id')::uuid;
    v_device_id := (v_res->>'device_id')::uuid;
    v_outcome   := v_res->>'outcome';
    v_ticket_id := v_res->>'ticket_id';
    v_error     := v_res->>'error';

    IF v_outcome IS NULL OR v_notif_id IS NULL OR v_device_id IS NULL THEN
      CONTINUE;
    END IF;

    IF v_outcome = 'ok' THEN
      UPDATE public.push_devices
         SET fail_count = 0, last_seen_at = now()
       WHERE id = v_device_id;

      -- Provider accepted. With a ticket_id (Expo) the row stays 'ticketed'
      -- for asynchronous receipt reconciliation; web push is terminal 'ok'.
      INSERT INTO public.push_tickets
        (notification_id, device_id, provider, ticket_id, status, outcome, error)
      SELECT v_notif_id, v_device_id, COALESCE(d.provider, 'expo'), v_ticket_id,
             CASE WHEN v_ticket_id IS NOT NULL THEN 'ticketed' ELSE 'ok' END,
             'accepted', NULL
        FROM public.push_devices d WHERE d.id = v_device_id
      ON CONFLICT (notification_id, device_id) DO UPDATE
         SET ticket_id = COALESCE(EXCLUDED.ticket_id, push_tickets.ticket_id),
             status = CASE WHEN push_tickets.outcome = 'accepted' THEN push_tickets.status ELSE EXCLUDED.status END,
             outcome = CASE WHEN push_tickets.outcome = 'accepted' THEN push_tickets.outcome ELSE EXCLUDED.outcome END,
             error = CASE WHEN push_tickets.outcome = 'accepted' THEN push_tickets.error ELSE EXCLUDED.error END;

      UPDATE public.notifications
         SET provider_accepted_at = COALESCE(provider_accepted_at, now())
       WHERE id = v_notif_id;

    ELSIF v_outcome = 'dead' THEN
      UPDATE public.push_devices
         SET is_active = false,
             disabled_reason = COALESCE(v_error, 'device_unregistered'),
             fail_count = fail_count + 1
       WHERE id = v_device_id;

      INSERT INTO public.push_tickets
        (notification_id, device_id, provider, ticket_id, status, outcome, error)
      SELECT v_notif_id, v_device_id, COALESCE(d.provider, 'expo'), v_ticket_id, 'error', 'dead', v_error
        FROM public.push_devices d WHERE d.id = v_device_id
      ON CONFLICT (notification_id, device_id) DO UPDATE
         SET status = CASE WHEN push_tickets.outcome = 'accepted' THEN push_tickets.status ELSE 'error' END,
             outcome = CASE WHEN push_tickets.outcome = 'accepted' THEN push_tickets.outcome ELSE 'dead' END,
             error = CASE WHEN push_tickets.outcome = 'accepted' THEN push_tickets.error ELSE EXCLUDED.error END;

    ELSIF v_outcome = 'retry' THEN
      UPDATE public.push_devices
         SET fail_count = fail_count + 1,
             is_active = CASE WHEN fail_count + 1 >= 5 THEN false ELSE is_active END,
             disabled_reason = CASE WHEN fail_count + 1 >= 5 THEN 'consecutive_failures' ELSE disabled_reason END
       WHERE id = v_device_id;

      INSERT INTO public.push_tickets
        (notification_id, device_id, provider, ticket_id, status, outcome, error)
      SELECT v_notif_id, v_device_id, COALESCE(d.provider, 'expo'), v_ticket_id, 'error', 'retry', v_error
        FROM public.push_devices d WHERE d.id = v_device_id
      ON CONFLICT (notification_id, device_id) DO UPDATE
         SET status = CASE WHEN push_tickets.outcome = 'accepted' THEN push_tickets.status ELSE 'error' END,
             outcome = CASE WHEN push_tickets.outcome = 'accepted' THEN push_tickets.outcome ELSE 'retry' END,
             error = CASE WHEN push_tickets.outcome = 'accepted' THEN push_tickets.error ELSE EXCLUDED.error END;

    ELSIF v_outcome = 'skip' THEN
      -- Sender-side permanent condition (kill switch, oversized payload,
      -- permanently invalid message). Never mutates the device (G-C4).
      INSERT INTO public.push_tickets
        (notification_id, device_id, provider, ticket_id, status, outcome, error)
      SELECT v_notif_id, v_device_id, COALESCE(d.provider, 'expo'), NULL, 'error', 'skipped', v_error
        FROM public.push_devices d WHERE d.id = v_device_id
      ON CONFLICT (notification_id, device_id) DO UPDATE
         SET status = CASE WHEN push_tickets.outcome = 'accepted' THEN push_tickets.status ELSE 'error' END,
             outcome = CASE WHEN push_tickets.outcome = 'accepted' THEN push_tickets.outcome ELSE 'skipped' END,
             error = CASE WHEN push_tickets.outcome = 'accepted' THEN push_tickets.error ELSE EXCLUDED.error END;
    END IF;
  END LOOP;

  -- 2. Aggregate outcomes per notification (verdict A: a sibling device's
  --    success never cancels another device's retry).
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
      bool_or(outcome = 'skip') AS has_skip,
      bool_and(outcome IN ('dead','skip')) AS all_terminal_no_delivery
    FROM batch_items
    GROUP BY notif_id
  )
  UPDATE public.notifications n
     SET push_status = CASE
           WHEN a.has_retry AND n.push_attempts < 5 THEN 'pending'
           WHEN a.has_retry AND n.push_attempts >= 5 THEN 'failed'
           WHEN a.has_ok THEN 'sent'
           WHEN a.all_terminal_no_delivery AND NOT a.has_skip THEN 'skipped'
           WHEN a.has_skip AND NOT a.has_ok THEN 'skipped'
           ELSE 'failed'
         END,
         push_status_reason = CASE
           WHEN a.has_retry AND n.push_attempts < 5 THEN 'device_retry_pending'
           WHEN a.has_retry AND n.push_attempts >= 5 THEN 'max_retries_exceeded'
           WHEN a.has_ok THEN NULL
           WHEN a.all_terminal_no_delivery AND NOT a.has_skip THEN 'all_devices_dead'
           WHEN a.has_skip AND NOT a.has_ok THEN 'skipped_sender_side'
           ELSE 'push_failed'
         END,
         sent_at = CASE
           WHEN a.has_ok THEN COALESCE(n.sent_at, now())
           ELSE n.sent_at
         END,
         send_after = CASE
           WHEN a.has_retry AND n.push_attempts < 5
           THEN now() + (interval '30 seconds' * power(2, GREATEST(0, n.push_attempts - 1)))
                * (0.75 + random() * 0.5)  -- jittered backoff (storm protection)
           ELSE n.send_after
         END
    FROM aggregated a
   WHERE n.id = a.notif_id;
END;
$$;

REVOKE ALL ON FUNCTION public.finish_push_batch(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finish_push_batch(jsonb) TO service_role;

-- ------------------------------------------------------------------------------
-- 8. Fast-path trigger: include 'normal' (align with migration 199 intent)
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_notifications_fastpath ON public.notifications;
CREATE TRIGGER trg_notifications_fastpath
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  WHEN (
    NEW.push_status = 'pending'
    AND NEW.send_after <= now()
    AND NEW.priority IN ('critical', 'high', 'normal')
  )
  EXECUTE FUNCTION public.notify_fastpath_trigger();

COMMENT ON TRIGGER trg_notifications_fastpath ON public.notifications IS
  'Fast-path dispatch via pg_net for immediate critical/high/normal pushes; low waits for the sweeper.';

-- ------------------------------------------------------------------------------
-- 9. Receipts poller cron (G-C7): reconcile Expo tickets -> receipts every 15 min
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'push_receipts_poller') THEN
    PERFORM cron.unschedule('push_receipts_poller');
  END IF;

  IF EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'notify_url')
     AND EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'notify_secret') THEN
    PERFORM cron.schedule(
      'push_receipts_poller',
      '*/15 * * * *',
      $cron$
        SELECT net.http_post(
          url := regexp_replace(
                   (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'notify_url'),
                   '/dispatch$', '/receipts'),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'notify_secret')
          ),
          body := '{}'::jsonb
        );
      $cron$
    );
  ELSE
    RAISE WARNING 'push_receipts_poller not scheduled: vault notify_url/notify_secret missing';
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 10. Health view (aggregate, non-PII) for runbook + alerting
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.push_delivery_health AS
SELECT
  (SELECT count(*) FROM public.notifications WHERE push_status = 'pending')                          AS queue_depth,
  (SELECT count(*) FROM public.notifications WHERE push_status = 'sending')                          AS in_flight,
  (SELECT EXTRACT(EPOCH FROM (now() - min(created_at)))::int
     FROM public.notifications WHERE push_status = 'pending')                                        AS oldest_pending_seconds,
  (SELECT count(*) FROM public.notifications
     WHERE push_status = 'pending' AND created_at < now() - interval '10 minutes')                    AS pending_over_10m,
  (SELECT count(*) FROM public.notifications
     WHERE push_status = 'failed' AND created_at > now() - interval '24 hours')                       AS failed_24h,
  (SELECT count(*) FROM public.notifications
     WHERE push_status = 'sent' AND created_at > now() - interval '24 hours')                         AS sent_24h,
  (SELECT count(*) FROM public.push_tickets WHERE status = 'ticketed')                               AS tickets_pending_receipt,
  (SELECT count(*) FROM public.push_tickets WHERE status = 'error')                                  AS tickets_error,
  (SELECT count(*) FROM public.push_tickets WHERE outcome = 'dead')                                  AS devices_dead_outcomes,
  (SELECT count(*) FROM public.push_devices WHERE is_active)                                         AS active_devices,
  (SELECT count(*) FROM public.push_devices
     WHERE is_active = false AND disabled_reason IN ('invalid_token_format','invalid_endpoint_host')) AS invalid_token_devices;

REVOKE ALL ON TABLE public.push_delivery_health FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.push_delivery_health TO service_role;
