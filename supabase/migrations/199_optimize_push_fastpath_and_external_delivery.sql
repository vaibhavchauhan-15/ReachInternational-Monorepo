-- Migration 199: Optimize Push Fast-Path for Sub-Second Delivery of Immediate Notifications
-- Author: ReachInternational AI Engineering Team
-- Date: 2026-11-15
-- Target: Reach International Dev (vlmxciuogczumumrwyot)

-- 1. Fast-Path Trigger Definition: Expand to include 'normal' priority whenever send_after <= now()
-- Ensures immediate delivery for operational events (BD1, EM1, AS1, SA1, REG1, PAY1, SEC1)
-- without waiting for 1-minute pg_cron sweeper.
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
  'Dispatches sub-second external push notifications via pg_net HTTP POST to /api/notify/dispatch for all immediate critical, high, and normal priority notifications.';
