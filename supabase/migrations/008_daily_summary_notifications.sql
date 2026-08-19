-- ============================================
-- Reach Internationa — Migration 008
-- Daily Summary Email Notification System
-- 1. Make notifications.machine_id nullable (summary emails are not tied to a single machine)
-- 2. Add 'engineer_summary' alert type
-- 3. Add payload + provider_response jsonb columns for retry & audit
-- 4. Add partial unique index for daily summary idempotency
-- ============================================

-- ============================================
-- PART A: notifications.machine_id — make nullable
-- ============================================
ALTER TABLE public.notifications ALTER COLUMN machine_id DROP NOT NULL;

-- ============================================
-- PART B: notifications.alert_type — add 'engineer_summary'
-- ============================================
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_alert_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_alert_type_check
  CHECK (alert_type IN (
    'today',
    'tomorrow',
    'overdue',
    'new_machine',
    'machine_updated',
    'machine_deleted',
    'excel_import',
    'system_error',
    'reminder_failed',
    'daily_summary',
    'engineer_summary',
    'weekly_report',
    'monthly_report'
  ));

-- ============================================
-- PART C: payload + provider_response columns
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'payload'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN payload jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'provider_response'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN provider_response jsonb;
  END IF;
END $$;

-- ============================================
-- PART D: Idempotency for daily/engineer summary emails
-- One summary email per recipient per alert_type per alert_date per channel
-- (machine_id is NULL for summaries, so the existing unique constraint on
--  (machine_id, recipient_id, alert_type, alert_date, channel) does not enforce
--  uniqueness when machine_id is NULL — Postgres treats NULLs as distinct.)
-- ============================================
DROP INDEX IF EXISTS public.idx_notifications_summary_idempotency;
CREATE UNIQUE INDEX idx_notifications_summary_idempotency
  ON public.notifications (recipient_id, alert_type, alert_date, channel)
  WHERE machine_id IS NULL
    AND alert_type IN ('daily_summary', 'engineer_summary', 'weekly_report', 'monthly_report');

-- ============================================
-- PART E: Helpful index for notification center date + recipient filtering
-- ============================================
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id
  ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_alert_type
  ON public.notifications(alert_type);

-- ============================================
-- End of Migration 008
-- ============================================