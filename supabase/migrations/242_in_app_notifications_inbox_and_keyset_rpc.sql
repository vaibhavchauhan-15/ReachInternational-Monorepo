-- ==============================================================================
-- Migration 242: In-App Notifications Inbox, Keyset Pagination RPCs & Security Hardening
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
-- Description:
-- 1. Additive columns: expires_at, route_key, route_params.
-- 2. Backfill existing notifications with expiration and typed routes from deep_link.
-- 3. Automatic route synchronization trigger (syncs route_key + params <-> deep_link).
-- 4. Keyset composite partial indexes for sub-millisecond inbox lists and unread count.
-- 5. Security hardening: drops notifications_update_own, revokes direct UPDATE/DELETE
--    from authenticated/anon, enforcing mutations strictly through SECURITY DEFINER RPCs.
-- 6. Canonical RPCs: notification_list (keyset pagination + unread_count),
--    notification_unread_count (O(min(N,100))), notification_mark_read, notification_mark_all_read.
-- 7. Automated retention cleaner routine.
-- 8. PostgREST schema cache reload.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Additive Columns to public.notifications
-- ------------------------------------------------------------------------------
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS expires_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS route_key text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS route_params jsonb DEFAULT '{}'::jsonb;

-- Backfill expires_at for existing notifications based on ttl_seconds
UPDATE public.notifications
   SET expires_at = created_at + (ttl_seconds || ' seconds')::interval
 WHERE expires_at IS NULL;

-- Backfill route_key and route_params from existing deep_link using scalar substring
UPDATE public.notifications
   SET route_key = CASE
         WHEN deep_link ~ '^/operations' THEN 'operations'
         WHEN deep_link ~ '^/machines'   THEN 'machines'
         WHEN deep_link ~ '^/users'      THEN 'users'
         WHEN deep_link ~ '^/approvals'  THEN 'approvals'
         WHEN deep_link ~ '^/payroll'    THEN 'payroll'
         WHEN deep_link ~ '^/attendance' THEN 'attendance'
         WHEN deep_link ~ '^/admin/sales/rfq' THEN 'rfq'
         WHEN deep_link ~ '^/settings'   THEN 'settings'
         ELSE 'dashboard'
       END,
       route_params = CASE
         WHEN deep_link ~ 'date=([0-9-]+)' THEN
           jsonb_build_object('date', substring(deep_link from 'date=([0-9-]+)'))
         WHEN deep_link ~ 'id=([0-9a-fA-F-]+)' THEN
           jsonb_build_object('id', substring(deep_link from 'id=([0-9a-fA-F-]+)'))
         ELSE '{}'::jsonb
       END
 WHERE route_key IS NULL AND deep_link IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 2. Trigger: Synchronize route_key + route_params with deep_link
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_sync_notification_route()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If route_key is provided but deep_link is missing, generate canonical deep_link
  IF NEW.route_key IS NOT NULL AND NEW.deep_link IS NULL THEN
    IF NEW.route_key = 'operations' AND NEW.route_params ? 'date' THEN
      NEW.deep_link := '/operations?date=' || (NEW.route_params->>'date');
    ELSIF NEW.route_key = 'machines' AND NEW.route_params ? 'id' THEN
      NEW.deep_link := '/machines?id=' || (NEW.route_params->>'id');
    ELSIF NEW.route_key = 'users' AND NEW.route_params ? 'id' THEN
      NEW.deep_link := '/users/' || (NEW.route_params->>'id');
    ELSIF NEW.route_key = 'rfq' THEN
      NEW.deep_link := '/admin/sales/rfq';
    ELSE
      NEW.deep_link := '/' || NEW.route_key;
    END IF;
  -- If deep_link is provided but route_key is missing, infer route_key and route_params
  ELSIF NEW.deep_link IS NOT NULL AND NEW.route_key IS NULL THEN
    IF NEW.deep_link ~ '^/operations' THEN
      NEW.route_key := 'operations';
      IF NEW.deep_link ~ 'date=([0-9-]+)' THEN
        NEW.route_params := jsonb_build_object('date', substring(NEW.deep_link from 'date=([0-9-]+)'));
      END IF;
    ELSIF NEW.deep_link ~ '^/machines' THEN
      NEW.route_key := 'machines';
      IF NEW.deep_link ~ 'id=([0-9a-fA-F-]+)' THEN
        NEW.route_params := jsonb_build_object('id', substring(NEW.deep_link from 'id=([0-9a-fA-F-]+)'));
      END IF;
    ELSIF NEW.deep_link ~ '^/users' THEN
      NEW.route_key := 'users';
      IF NEW.deep_link ~ 'id=([0-9a-fA-F-]+)' THEN
        NEW.route_params := jsonb_build_object('id', substring(NEW.deep_link from 'id=([0-9a-fA-F-]+)'));
      END IF;
    ELSIF NEW.deep_link ~ '^/approvals' THEN
      NEW.route_key := 'approvals';
    ELSIF NEW.deep_link ~ '^/payroll' THEN
      NEW.route_key := 'payroll';
    ELSIF NEW.deep_link ~ '^/attendance' THEN
      NEW.route_key := 'attendance';
    ELSIF NEW.deep_link ~ '^/admin/sales/rfq' THEN
      NEW.route_key := 'rfq';
    ELSE
      NEW.route_key := 'dashboard';
    END IF;
  END IF;

  -- Default expires_at if not explicitly set
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at := NEW.created_at + (COALESCE(NEW.ttl_seconds, 86400) || ' seconds')::interval;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_notification_route ON public.notifications;
CREATE TRIGGER trg_sync_notification_route
  BEFORE INSERT OR UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_notification_route();

-- ------------------------------------------------------------------------------
-- 3. High-Performance Composite Keyset Indexes
-- ------------------------------------------------------------------------------
-- Partial index for unread inbox queries and unread count: (user_id, created_at desc, id desc) WHERE read_at IS NULL
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_keyset
  ON public.notifications (user_id, created_at DESC, id DESC)
  WHERE (read_at IS NULL);

-- Full keyset index for general inbox list: (user_id, created_at desc, id desc)
CREATE INDEX IF NOT EXISTS idx_notifications_user_all_keyset
  ON public.notifications (user_id, created_at DESC, id DESC);

-- ------------------------------------------------------------------------------
-- 4. Row Level Security Hardening
-- ------------------------------------------------------------------------------
-- Drop insecure direct update policy that previously allowed arbitrary updates
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;

-- Revoke direct UPDATE and DELETE permissions from authenticated and anon
REVOKE UPDATE, DELETE ON TABLE public.notifications FROM authenticated, anon, PUBLIC;

-- Recipient-only SELECT
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT ON TABLE public.notifications TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. Drop Stale RPC Overloads to Prevent PostgREST Ambiguity
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.notification_list(timestamptz, uuid, integer, text);
DROP FUNCTION IF EXISTS public.notification_list(timestamptz, uuid, integer, text, uuid);
DROP FUNCTION IF EXISTS public.notification_unread_count();
DROP FUNCTION IF EXISTS public.notification_unread_count(uuid);
DROP FUNCTION IF EXISTS public.notification_mark_read(uuid[]);
DROP FUNCTION IF EXISTS public.notification_mark_read(uuid[], uuid);
DROP FUNCTION IF EXISTS public.notification_mark_all_read();
DROP FUNCTION IF EXISTS public.notification_mark_all_read(timestamptz);
DROP FUNCTION IF EXISTS public.notification_mark_all_read(timestamptz, uuid);

-- ------------------------------------------------------------------------------
-- 6. Canonical Keyset Pagination RPC: notification_list
-- Returns { items, next_cursor, has_more, unread_count }
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notification_list(
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_filter text DEFAULT 'all',
  p_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_limit int;
  v_unread_count int := 0;
  v_items jsonb := '[]'::jsonb;
  v_next_cursor jsonb := NULL;
  v_has_more boolean := false;
  v_last_created_at timestamptz;
  v_last_id uuid;
BEGIN
  -- Strict caller resolution: authenticated users ALWAYS evaluate to auth.uid()
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    IF current_setting('role', true) IN ('service_role', 'postgres')
       OR current_user = 'postgres' THEN
      v_user_id := p_user_id;
      IF v_user_id IS NULL THEN
        SELECT id INTO v_user_id FROM public.users WHERE status = 'active' ORDER BY created_at LIMIT 1;
      END IF;
    ELSE
      RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);

  -- 1. Compute unread_count in the same round-trip (capped at 100)
  SELECT count(*)::int
  INTO v_unread_count
  FROM (
    SELECT 1 FROM public.notifications
    WHERE user_id = v_user_id
      AND read_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 100
  ) sub;

  -- 2. Keyset fetch (v_limit + 1 rows to detect has_more)
  WITH filtered AS (
    SELECT
      n.id,
      n.title,
      COALESCE(n.body, n.message) AS body,
      n.category,
      n.priority,
      n.severity,
      (n.read_at IS NOT NULL) AS is_read,
      n.read_at,
      n.created_at,
      n.route_key,
      n.route_params,
      n.deep_link,
      n.metadata
    FROM public.notifications n
    WHERE n.user_id = v_user_id
      AND (n.expires_at IS NULL OR n.expires_at > now())
      AND (
        p_filter = 'all'
        OR (p_filter = 'unread' AND n.read_at IS NULL)
      )
      AND (
        p_cursor_created_at IS NULL
        OR (n.created_at, n.id) < (p_cursor_created_at, p_cursor_id)
      )
    ORDER BY n.created_at DESC, n.id DESC
    LIMIT (v_limit + 1)
  ),
  counted AS (
    SELECT f.*, ROW_NUMBER() OVER () as rn
    FROM filtered f
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'title', c.title,
        'body', c.body,
        'category', c.category,
        'priority', c.priority,
        'severity', c.severity,
        'is_read', c.is_read,
        'read_at', c.read_at,
        'created_at', c.created_at,
        'route_key', c.route_key,
        'route_params', c.route_params,
        'deep_link', c.deep_link,
        'metadata', c.metadata
      )
    ) FILTER (WHERE c.rn <= v_limit), '[]'::jsonb),
    EXISTS (SELECT 1 FROM counted WHERE rn > v_limit)
  INTO v_items, v_has_more
  FROM counted c;

  -- Keyset cursor resolution from row at index v_limit
  IF v_has_more THEN
    SELECT c2.created_at, c2.id
    INTO v_last_created_at, v_last_id
    FROM (
      SELECT
        n2.id,
        n2.created_at,
        ROW_NUMBER() OVER (ORDER BY n2.created_at DESC, n2.id DESC) as rn
      FROM public.notifications n2
      WHERE n2.user_id = v_user_id
        AND (n2.expires_at IS NULL OR n2.expires_at > now())
        AND (
          p_filter = 'all'
          OR (p_filter = 'unread' AND n2.read_at IS NULL)
        )
        AND (
          p_cursor_created_at IS NULL
          OR (n2.created_at, n2.id) < (p_cursor_created_at, p_cursor_id)
        )
      LIMIT (v_limit + 1)
    ) c2
    WHERE c2.rn = v_limit;

    IF v_last_created_at IS NOT NULL AND v_last_id IS NOT NULL THEN
      v_next_cursor := jsonb_build_object(
        'created_at', v_last_created_at,
        'id', v_last_id
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'items', v_items,
    'next_cursor', v_next_cursor,
    'has_more', v_has_more,
    'unread_count', v_unread_count
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. Cheap O(min(N,100)) Unread Count RPC: notification_unread_count
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notification_unread_count(p_user_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_count int := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    IF current_setting('role', true) IN ('service_role', 'postgres')
       OR current_user = 'postgres' THEN
      v_user_id := p_user_id;
      IF v_user_id IS NULL THEN
        RETURN 0;
      END IF;
    ELSE
      RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT count(*)::int
  INTO v_count
  FROM (
    SELECT 1 FROM public.notifications
    WHERE user_id = v_user_id
      AND read_at IS NULL
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 100
  ) sub;

  RETURN v_count;
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. Atomic Mutation RPC: notification_mark_read
-- Enforces caller ownership, caps array size <= 100
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notification_mark_read(
  p_notification_ids uuid[],
  p_user_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_updated int := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    IF current_setting('role', true) IN ('service_role', 'postgres')
       OR current_user = 'postgres' THEN
      v_user_id := p_user_id;
      IF v_user_id IS NULL THEN
        RETURN 0;
      END IF;
    ELSE
      RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_notification_ids IS NULL OR array_length(p_notification_ids, 1) IS NULL THEN
    RETURN 0;
  END IF;

  IF array_length(p_notification_ids, 1) > 100 THEN
    RAISE EXCEPTION 'Cannot mark more than 100 notifications as read in a single batch.'
      USING ERRCODE = '22023';
  END IF;

  WITH upd AS (
    UPDATE public.notifications
       SET read_at = now(),
           is_read = true
     WHERE id = ANY(p_notification_ids)
       AND user_id = v_user_id
       AND read_at IS NULL
    RETURNING id
  )
  SELECT count(*)::int INTO v_updated FROM upd;

  RETURN v_updated;
END;
$$;

-- ------------------------------------------------------------------------------
-- 9. Atomic Mutation RPC: notification_mark_all_read
-- Enforces caller ownership, marks all unread prior to cursor as read
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notification_mark_all_read(
  p_before_cursor timestamptz DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_updated int := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    IF current_setting('role', true) IN ('service_role', 'postgres')
       OR current_user = 'postgres' THEN
      v_user_id := p_user_id;
      IF v_user_id IS NULL THEN
        RETURN 0;
      END IF;
    ELSE
      RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
    END IF;
  END IF;

  WITH upd AS (
    UPDATE public.notifications
       SET read_at = now(),
           is_read = true
     WHERE user_id = v_user_id
       AND read_at IS NULL
       AND created_at <= COALESCE(p_before_cursor, now())
    RETURNING id
  )
  SELECT count(*)::int INTO v_updated FROM upd;

  RETURN v_updated;
END;
$$;

-- ------------------------------------------------------------------------------
-- 10. Automated Retention Routine for In-App Notifications
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cleanup_inbox_notifications_retention()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- 1. Prune read notifications older than 90 days in small safe batches
  DELETE FROM public.notifications
  WHERE id IN (
    SELECT id FROM public.notifications
    WHERE read_at IS NOT NULL
      AND read_at < now() - interval '90 days'
      AND priority <> 'critical'
    LIMIT 500
  );

  -- 2. Prune expired rows past their expires_at date by 14 days
  DELETE FROM public.notifications
  WHERE id IN (
    SELECT id FROM public.notifications
    WHERE expires_at IS NOT NULL
      AND expires_at < now() - interval '14 days'
      AND priority <> 'critical'
    LIMIT 500
  );
END;
$$;

-- ------------------------------------------------------------------------------
-- 11. Security Grants & PostgREST Schema Reload
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.notification_list(timestamptz, uuid, integer, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notification_list(timestamptz, uuid, integer, text, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.notification_unread_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notification_unread_count(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.notification_mark_read(uuid[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notification_mark_read(uuid[], uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.notification_mark_all_read(timestamptz, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notification_mark_all_read(timestamptz, uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.cleanup_inbox_notifications_retention() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_inbox_notifications_retention() TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
