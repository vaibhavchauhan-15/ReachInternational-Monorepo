-- Migration 193: Push Notifications Fast-Path Trigger and Sweeper Cron
-- Author: ReachInternational AI Engineering Team
-- Date: 2026-11-14

-- 1. Fast-Path Trigger Function
CREATE OR REPLACE FUNCTION public.notify_fastpath_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  -- Read endpoint and secret from vault if available
  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'notify_url' LIMIT 1;
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'notify_secret' LIMIT 1;

  IF v_url IS NOT NULL AND v_secret IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_secret
      ),
      body := jsonb_build_object('ids', jsonb_build_array(NEW.id::text))
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Fast-path must NEVER abort transaction or rollback parent insertion
  RAISE WARNING 'notify_fastpath_trigger failed for notification %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- 2. Fast-Path Trigger Definition
DROP TRIGGER IF EXISTS trg_notifications_fastpath ON public.notifications;
CREATE TRIGGER trg_notifications_fastpath
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  WHEN (NEW.push_status = 'pending' AND NEW.send_after <= now() AND NEW.priority IN ('critical', 'high', 'normal'))
  EXECUTE FUNCTION public.notify_fastpath_trigger();

-- 3. Sweeper Cron Job (pg_cron) - Drains pending notifications every minute
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'push_notifications_sweeper') THEN
    PERFORM cron.unschedule('push_notifications_sweeper');
  END IF;
END $$;

SELECT cron.schedule(
  'push_notifications_sweeper',
  '* * * * *',
  $cron$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'notify_url'),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'notify_secret')
      ),
      body := '{}'::jsonb
    );
  $cron$
);
