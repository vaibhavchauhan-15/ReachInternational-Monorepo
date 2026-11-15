-- ==============================================================================
-- Migration 192: Push Notifications Schema, Outbox Queue & Delivery Pipeline
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
-- Description:
-- 1. Enables pg_net and pg_cron extensions.
-- 2. Extends public.notifications as an integrated inbox + transactional outbox:
--    - priority, deep_link, dedupe_key, push_status, push_status_reason,
--      send_after, ttl_seconds, push_attempts, claimed_at, recheck, source, body.
--    - Synchronizes message and body columns for seamless backward compatibility.
-- 3. Creates public.push_devices with global token uniqueness for shared phone handovers.
-- 4. Creates public.push_tickets for asynchronous Expo receipt reconciliation.
-- 5. Creates public.user_notification_preferences with RLS and quiet hours.
-- 6. Implements shift_entry_deadline, get_pending_shift_slots, and notification_still_relevant.
-- 7. Implements atomic enqueue_notification, claim_push_batch (SKIP LOCKED), and finish_push_batch.
-- 8. Implements retention cleanup routine.
-- ==============================================================================

-- 1. Required Extensions
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Extend public.notifications (Integrated Inbox + Transactional Outbox)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS body text,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal'
      CHECK (priority IN ('critical','high','normal','low')),
  ADD COLUMN IF NOT EXISTS deep_link text,
  ADD COLUMN IF NOT EXISTS dedupe_key text,
  ADD COLUMN IF NOT EXISTS push_status text NOT NULL DEFAULT 'none'
      CHECK (push_status IN ('none','pending','sending','sent','skipped','failed')),
  ADD COLUMN IF NOT EXISTS push_status_reason text,
  ADD COLUMN IF NOT EXISTS send_after timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ttl_seconds integer NOT NULL DEFAULT 86400,
  ADD COLUMN IF NOT EXISTS push_attempts smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS recheck jsonb,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'event';

-- Ensure message and body remain 100% synchronized across legacy and new callers
CREATE OR REPLACE FUNCTION public.trg_sync_notification_body_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.body IS NULL AND NEW.message IS NOT NULL THEN
    NEW.body := NEW.message;
  ELSIF NEW.message IS NULL AND NEW.body IS NOT NULL THEN
    NEW.message := NEW.body;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_notification_body_message ON public.notifications;
CREATE TRIGGER trg_sync_notification_body_message
  BEFORE INSERT OR UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_notification_body_message();

-- Backfill body for existing notifications
UPDATE public.notifications
   SET body = message
 WHERE body IS NULL AND message IS NOT NULL;

-- Outbox Indexes
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_dedupe
  ON public.notifications (dedupe_key)
  WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_push_queue
  ON public.notifications (send_after)
  WHERE push_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_notifications_push_stuck
  ON public.notifications (claimed_at)
  WHERE push_status = 'sending';

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_readat
  ON public.notifications (user_id, created_at DESC)
  WHERE is_read = false;

-- 3. Push Devices Table
CREATE TABLE IF NOT EXISTS public.push_devices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  platform        text NOT NULL CHECK (platform IN ('android','ios','web')),
  provider        text NOT NULL CHECK (provider IN ('expo','webpush')),
  token           text NOT NULL,
  web_keys        jsonb,
  app_version     text,
  device_label    text,
  is_active       boolean NOT NULL DEFAULT true,
  fail_count      smallint NOT NULL DEFAULT 0,
  disabled_reason text,
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Global token uniqueness: physical device belongs to exactly one user at a time
CREATE UNIQUE INDEX IF NOT EXISTS uq_push_devices_token
  ON public.push_devices (token);

CREATE INDEX IF NOT EXISTS idx_push_devices_user_active
  ON public.push_devices (user_id)
  WHERE is_active = true;

ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

-- No direct client table access: mutations strictly handled via SECURITY DEFINER RPCs
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

CREATE OR REPLACE FUNCTION public.unregister_push_device(p_token text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  DELETE FROM public.push_devices
  WHERE token = p_token AND user_id = auth.uid();
$$;

REVOKE ALL ON TABLE public.push_devices FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.push_devices TO service_role;

REVOKE ALL ON FUNCTION public.register_push_device(text, text, text, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_push_device(text, text, text, jsonb, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.unregister_push_device(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unregister_push_device(text) TO authenticated, service_role;

-- 4. Push Tickets Table (Expo asynchronous receipt reconciliation)
CREATE TABLE IF NOT EXISTS public.push_tickets (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  notification_id uuid NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  device_id       uuid NOT NULL REFERENCES public.push_devices(id) ON DELETE CASCADE,
  ticket_id       text NOT NULL,
  status          text NOT NULL DEFAULT 'ticketed' CHECK (status IN ('ticketed','ok','error')),
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_tickets_pending
  ON public.push_tickets (created_at)
  WHERE status = 'ticketed';

ALTER TABLE public.push_tickets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.push_tickets FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.push_tickets TO service_role;

-- 5. User Notification Preferences Table
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  user_id             uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  push_enabled        boolean NOT NULL DEFAULT true,
  shift_reminders     boolean NOT NULL DEFAULT true,
  breakdown_alerts    boolean NOT NULL DEFAULT true,
  assignment_alerts   boolean NOT NULL DEFAULT true,
  admin_alerts        boolean NOT NULL DEFAULT true,
  payroll_alerts      boolean NOT NULL DEFAULT true,
  quiet_hours_enabled boolean NOT NULL DEFAULT false,
  quiet_hours_start   time NOT NULL DEFAULT '22:00',
  quiet_hours_end     time NOT NULL DEFAULT '06:00',
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS own_prefs ON public.user_notification_preferences;
CREATE POLICY own_prefs ON public.user_notification_preferences
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON TABLE public.user_notification_preferences TO authenticated;
GRANT ALL ON TABLE public.user_notification_preferences TO service_role;

-- 6. Core Deadline & Slot Detection Functions
CREATE OR REPLACE FUNCTION public.shift_entry_deadline(p_work_date date)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ((p_work_date + 7)::timestamp) AT TIME ZONE 'Asia/Kolkata';
$$;

CREATE OR REPLACE FUNCTION public.get_pending_shift_slots(p_operator_id uuid DEFAULT NULL)
RETURNS TABLE (
  operator_id    uuid,
  work_date      date,
  machine_id     uuid,
  machine_code   text,
  shift_code     text,
  shift_end_at   timestamptz,
  deadline_at    timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH days AS (
    SELECT ((now() AT TIME ZONE 'Asia/Kolkata')::date - n) AS work_date
    FROM generate_series(0, 6) AS n
  ), slots AS (
    SELECT
      a.operator_id,
      d.work_date,
      a.machine_id,
      a.shift_code,
      (((d.work_date + a.shift_end_time)
        + CASE WHEN COALESCE(a.crosses_midnight, false) THEN interval '1 day' ELSE interval '0' END)
       AT TIME ZONE 'Asia/Kolkata') AS shift_end_at
    FROM days d
    JOIN public.operator_machine_assignments a
      ON d.work_date >= a.valid_from
     AND (a.valid_to IS NULL OR d.work_date <= a.valid_to)
    WHERE a.shift_code IS NOT NULL
      AND (p_operator_id IS NULL OR a.operator_id = p_operator_id)
  )
  SELECT
    s.operator_id,
    s.work_date,
    s.machine_id,
    m.machine_id AS machine_code,
    s.shift_code,
    s.shift_end_at,
    public.shift_entry_deadline(s.work_date) AS deadline_at
  FROM slots s
  JOIN public.users u
    ON u.id = s.operator_id
   AND u.status = 'active'
  JOIN public.machines m
    ON m.id = s.machine_id
   AND m.status <> 'inactive'
   AND m.health_status <> 'under_maintenance'
  WHERE s.shift_end_at <= now()
    AND NOT EXISTS (
      SELECT 1 FROM public.machine_hour_logs l
      WHERE l.operator_id = s.operator_id
        AND l.machine_id = s.machine_id
        AND l.log_date = s.work_date
        AND lower(trim(l.shift_code)) = lower(trim(s.shift_code))
    );
$$;

REVOKE ALL ON FUNCTION public.shift_entry_deadline(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shift_entry_deadline(date) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_pending_shift_slots(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_pending_shift_slots(uuid) TO service_role;

-- 7. Send-Time Relevance Function
CREATE OR REPLACE FUNCTION public.notification_still_relevant(p jsonb)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE p->>'kind'
    WHEN 'shift_pending' THEN NOT EXISTS (
      SELECT 1 FROM public.machine_hour_logs l
      WHERE l.operator_id = (p->>'operator_id')::uuid
        AND l.machine_id = (p->>'machine_id')::uuid
        AND l.log_date = (p->>'work_date')::date
        AND lower(trim(l.shift_code)) = lower(trim(p->>'shift_code'))
    )
    WHEN 'pending_digest' THEN EXISTS (
      SELECT 1 FROM public.get_pending_shift_slots((p->>'operator_id')::uuid)
      WHERE work_date < (now() AT TIME ZONE 'Asia/Kolkata')::date
    )
    WHEN 'final_lock' THEN EXISTS (
      SELECT 1 FROM public.get_pending_shift_slots((p->>'operator_id')::uuid)
      WHERE work_date = (now() AT TIME ZONE 'Asia/Kolkata')::date - 6
    )
    ELSE true
  END;
$$;

REVOKE ALL ON FUNCTION public.notification_still_relevant(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notification_still_relevant(jsonb) TO service_role;

-- 8. Enqueue Helper (Atomic Transactional Producer)
CREATE OR REPLACE FUNCTION public.enqueue_notification(
  p_user_id uuid,
  p_category text,
  p_priority text,
  p_title text,
  p_body text,
  p_deep_link text DEFAULT NULL,
  p_dedupe_key text DEFAULT NULL,
  p_push boolean DEFAULT true,
  p_send_after timestamptz DEFAULT now(),
  p_ttl int DEFAULT 86400,
  p_recheck jsonb DEFAULT NULL,
  p_source text DEFAULT 'event'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Strict validation on deep_link
  IF p_deep_link IS NOT NULL AND p_deep_link !~ '^/[A-Za-z0-9/_\-?=&%.]*$' THEN
    RAISE EXCEPTION 'Invalid deep_link: must be a relative URL matching allowlist'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.notifications (
    user_id,
    category,
    priority,
    title,
    body,
    message,
    deep_link,
    dedupe_key,
    push_status,
    send_after,
    ttl_seconds,
    recheck,
    source
  ) VALUES (
    p_user_id,
    p_category,
    p_priority,
    p_title,
    p_body,
    p_body,
    p_deep_link,
    p_dedupe_key,
    CASE WHEN p_push THEN 'pending' ELSE 'none' END,
    p_send_after,
    p_ttl,
    p_recheck,
    p_source
  )
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.enqueue_notification(uuid, text, text, text, text, text, text, boolean, timestamptz, int, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_notification(uuid, text, text, text, text, text, text, boolean, timestamptz, int, jsonb, text) TO service_role;

-- 9. Claim Push Batch (FOR UPDATE SKIP LOCKED + Full Rule Pipeline)
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
  -- 1. Claim up to p_limit rows with SKIP LOCKED
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

  -- 2. Relevance Check (send-time verification)
  UPDATE public.notifications
  SET push_status = 'skipped',
      push_status_reason = 'irrelevant'
  WHERE id = ANY(v_ids)
    AND recheck IS NOT NULL
    AND NOT public.notification_still_relevant(recheck);

  -- 3. Preferences Check (missing row = all enabled defaults; security has no toggle)
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

  -- 4. Quiet Hours (Asia/Kolkata), non-critical: defer rather than drop
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

  -- 5. Daily Cap Enforcement (max 5 non-critical pushes in past 24 hours)
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

  -- 6. No Active Device Registered
  UPDATE public.notifications n
  SET push_status = 'skipped',
      push_status_reason = 'no_active_device'
  WHERE n.id = ANY(v_ids)
    AND n.push_status = 'sending'
    AND NOT EXISTS (
      SELECT 1 FROM public.push_devices d
      WHERE d.user_id = n.user_id AND d.is_active = true
    );

  -- 7. Fan out to active devices
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

-- 10. Finish Push Batch Function (Ticket Recording, Backoff, Pruning)
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

-- 11. Retention Routine
CREATE OR REPLACE FUNCTION public.cleanup_push_notifications_retention()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. Delete push tickets older than 14 days
  DELETE FROM public.push_tickets
  WHERE created_at < now() - interval '14 days';

  -- 2. Delete resolved read notifications older than 90 days
  DELETE FROM public.notifications
  WHERE push_status IN ('sent', 'skipped', 'failed')
    AND is_read = true
    AND created_at < now() - interval '90 days';

  -- 3. Prune inactive push devices unseen for 60 days
  DELETE FROM public.push_devices
  WHERE is_active = false
    AND last_seen_at < now() - interval '60 days';
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_push_notifications_retention() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_push_notifications_retention() TO service_role;
