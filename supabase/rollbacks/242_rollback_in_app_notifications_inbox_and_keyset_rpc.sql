-- ==============================================================================
-- Rollback Migration 242: In-App Notifications Inbox, Keyset Pagination RPCs
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
-- ==============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.notification_list(timestamptz, uuid, integer, text, uuid);
DROP FUNCTION IF EXISTS public.notification_unread_count(uuid);
DROP FUNCTION IF EXISTS public.notification_mark_read(uuid[], uuid);
DROP FUNCTION IF EXISTS public.notification_mark_all_read(timestamptz, uuid);
DROP FUNCTION IF EXISTS public.cleanup_inbox_notifications_retention();

DROP TRIGGER IF EXISTS trg_sync_notification_route ON public.notifications;
DROP FUNCTION IF EXISTS public.trg_sync_notification_route();

DROP INDEX IF EXISTS public.idx_notifications_user_unread_keyset;
DROP INDEX IF EXISTS public.idx_notifications_user_all_keyset;

ALTER TABLE public.notifications
  DROP COLUMN IF EXISTS expires_at,
  DROP COLUMN IF EXISTS route_key,
  DROP COLUMN IF EXISTS route_params;

-- Restore previous RLS policies
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, UPDATE ON TABLE public.notifications TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';
