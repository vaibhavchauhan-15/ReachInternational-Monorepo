-- ==============================================================================
-- Migration 123: Persistent Notifications & Offline Resilience for Assisted Shifts
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
-- Description:
-- 1. Creates public.notifications table with user reference, read status, and metadata.
-- 2. Creates RLS policies ensuring users only view and mark as read their own notifications.
-- 3. Creates partial indexes optimized for fast retrieval of unread notifications.
-- 4. Creates get_unread_notifications() and mark_notifications_read() RPCs.
-- 5. Implements AFTER INSERT trigger on machine_hour_logs to guarantee persistent notification
--    storage whenever an assisted shift is logged (entered_by != operator_id).
-- ==============================================================================

-- 1. Create Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  category text NOT NULL DEFAULT 'log_entry',
  severity text NOT NULL DEFAULT 'info',
  metadata jsonb DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Performance Indexes (Following Supabase Partial Indexing Guidelines)
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id, created_at DESC)
  WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_user_all
  ON public.notifications (user_id, created_at DESC);

-- 3. Enable Row-Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert_authorized" ON public.notifications;
CREATE POLICY "notifications_insert_authorized"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('supervisor', 'manager', 'admin', 'super_admin')
    )
  );

-- 5. RPC Functions for Fast Client Retrieval and Bulk Dismissal
CREATE OR REPLACE FUNCTION public.get_unread_notifications(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  title text,
  message text,
  category text,
  severity text,
  metadata jsonb,
  is_read boolean,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    n.id,
    n.user_id,
    n.title,
    n.message,
    n.category,
    n.severity,
    n.metadata,
    n.is_read,
    n.created_at
  FROM public.notifications n
  WHERE n.user_id = COALESCE(p_user_id, auth.uid())
    AND n.is_read = false
  ORDER BY n.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_notification_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = true,
      read_at = now()
  WHERE id = ANY(p_notification_ids)
    AND (user_id = auth.uid() OR auth.uid() IS NULL);
END;
$$;

-- 6. Database Trigger: Guarantees Offline Persistence for Assisted Shift Logs
CREATE OR REPLACE FUNCTION public.trg_assisted_shift_notify_operator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_machine_code text;
  v_supervisor_name text;
  v_running_hrs numeric;
BEGIN
  -- Only trigger if entered_by is distinct from operator_id (assisted entry on behalf of operator)
  IF NEW.entered_by IS NOT NULL AND NEW.operator_id IS NOT NULL AND NEW.entered_by <> NEW.operator_id THEN
    -- Resolve machine display code
    SELECT machine_id INTO v_machine_code FROM public.machines WHERE id = NEW.machine_id;

    -- Resolve supervisor / submitter display name
    SELECT full_name INTO v_supervisor_name FROM public.users WHERE id = NEW.entered_by;

    v_running_hrs := COALESCE(NEW.running_hours, GREATEST(0, ROUND((NEW.end_meter - NEW.start_meter)::numeric, 1)));

    -- Insert persistent notification for the target operator
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      category,
      severity,
      metadata
    ) VALUES (
      NEW.operator_id,
      'Shift Logged on Your Behalf',
      format('Supervisor %s recorded your shift on equipment %s (%s hrs).',
        COALESCE(v_supervisor_name, 'A supervisor'),
        COALESCE(v_machine_code, 'Equipment'),
        v_running_hrs::text
      ),
      'log_entry',
      'info',
      jsonb_build_object(
        'logId', NEW.id,
        'machineId', NEW.machine_id,
        'machineCode', COALESCE(v_machine_code, 'Equipment'),
        'runningHours', v_running_hrs,
        'enteredBy', NEW.entered_by,
        'enteredByName', v_supervisor_name,
        'entrySource', NEW.entry_source,
        'logDate', NEW.log_date,
        'startTime', NEW.start_time,
        'endTime', NEW.end_time
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_after_insert_assisted_shift ON public.machine_hour_logs;
CREATE TRIGGER trg_after_insert_assisted_shift
  AFTER INSERT ON public.machine_hour_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_assisted_shift_notify_operator();

-- 7. Grant Permissions
REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon;
GRANT SELECT, UPDATE, INSERT ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;

REVOKE ALL ON FUNCTION public.get_unread_notifications(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_unread_notifications(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.mark_notifications_read(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_notifications_read(uuid[]) TO authenticated, service_role;
