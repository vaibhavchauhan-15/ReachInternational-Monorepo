-- Migration 194: Shift Reminder Ladder Scanners & Cron Schedules
-- Author: ReachInternational AI Engineering Team
-- Date: 2026-11-14

-- ==============================================================================
-- 1. SP1-s1 and SP1-s2: Shift End Reminders (runs every 15 min)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.enqueue_shift_end_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now timestamptz := now();
  v_rec record;
  v_enqueued integer := 0;
  v_nid uuid;
BEGIN
  -- SP1-s1: Shift ended 15-25 min ago
  FOR v_rec IN (
    SELECT
      s.operator_id,
      s.work_date,
      s.machine_id,
      s.machine_code,
      s.shift_code,
      s.shift_end_at
    FROM public.get_pending_shift_slots() s
    WHERE s.shift_end_at >= (v_now - interval '25 minutes')
      AND s.shift_end_at <= (v_now - interval '15 minutes')
  ) LOOP
    v_nid := public.enqueue_notification(
      p_user_id := v_rec.operator_id,
      p_category := 'shift_reminder',
      p_priority := 'high',
      p_title := 'Shift Ended — Log Closing Meter',
      p_body := format('Shift %s on %s ended. Log your closing meter.',
        v_rec.shift_code,
        coalesce(v_rec.machine_code, 'your assigned equipment')
      ),
      p_deep_link := format('/operations?date=%s&machine=%s&shift=%s', v_rec.work_date, v_rec.machine_id, v_rec.shift_code),
      p_dedupe_key := format('remind:sp1:s1:%s:%s:%s:%s', v_rec.operator_id, v_rec.machine_id, v_rec.work_date, v_rec.shift_code),
      p_recheck := jsonb_build_object(
        'kind', 'shift_pending',
        'operator_id', v_rec.operator_id,
        'machine_id', v_rec.machine_id,
        'work_date', v_rec.work_date,
        'shift_code', v_rec.shift_code
      ),
      p_source := 'scanner:sp1:s1'
    );

    IF v_nid IS NOT NULL THEN
      v_enqueued := v_enqueued + 1;
    END IF;
  END LOOP;

  -- SP1-s2: Shift ended 90-100 min ago (firmer reminder)
  FOR v_rec IN (
    SELECT
      s.operator_id,
      s.work_date,
      s.machine_id,
      s.machine_code,
      s.shift_code,
      s.shift_end_at
    FROM public.get_pending_shift_slots() s
    WHERE s.shift_end_at >= (v_now - interval '100 minutes')
      AND s.shift_end_at <= (v_now - interval '90 minutes')
  ) LOOP
    v_nid := public.enqueue_notification(
      p_user_id := v_rec.operator_id,
      p_category := 'shift_reminder',
      p_priority := 'high',
      p_title := 'Shift Log Pending',
      p_body := format('Shift %s on %s ended 90 minutes ago. Please submit your closing meter.',
        v_rec.shift_code,
        coalesce(v_rec.machine_code, 'your assigned equipment')
      ),
      p_deep_link := format('/operations?date=%s&machine=%s&shift=%s', v_rec.work_date, v_rec.machine_id, v_rec.shift_code),
      p_dedupe_key := format('remind:sp1:s2:%s:%s:%s:%s', v_rec.operator_id, v_rec.machine_id, v_rec.work_date, v_rec.shift_code),
      p_recheck := jsonb_build_object(
        'kind', 'shift_pending',
        'operator_id', v_rec.operator_id,
        'machine_id', v_rec.machine_id,
        'work_date', v_rec.work_date,
        'shift_code', v_rec.shift_code
      ),
      p_source := 'scanner:sp1:s2'
    );

    IF v_nid IS NOT NULL THEN
      v_enqueued := v_enqueued + 1;
    END IF;
  END LOOP;

  RETURN v_enqueued;
END;
$$;

-- ==============================================================================
-- 2. SP2: Daily 09:00 IST Morning Pending Shift Digest
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.enqueue_pending_digest()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today_ist date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_rec record;
  v_enqueued integer := 0;
  v_nid uuid;
  v_title text;
  v_body text;
  v_is_urgent boolean;
BEGIN
  FOR v_rec IN (
    SELECT
      s.operator_id,
      count(*)::int AS pending_count,
      min(s.work_date) AS oldest_date
    FROM public.get_pending_shift_slots() s
    WHERE s.work_date < v_today_ist
    GROUP BY s.operator_id
  ) LOOP
    v_is_urgent := v_rec.oldest_date <= (v_today_ist - 5);
    v_title := CASE WHEN v_is_urgent THEN 'Pending Shift Entries — Locks Soon' ELSE 'Pending Shift Entries' END;
    v_body := format('%s shift %s pending (oldest %s). Tap to submit.',
      v_rec.pending_count,
      CASE WHEN v_rec.pending_count = 1 THEN 'entry' ELSE 'entries' END,
      to_char(v_rec.oldest_date, 'Mon DD')
    );

    v_nid := public.enqueue_notification(
      p_user_id := v_rec.operator_id,
      p_category := 'shift_reminder',
      p_priority := 'high',
      p_title := v_title,
      p_body := v_body,
      p_deep_link := format('/operations?date=%s', v_rec.oldest_date),
      p_dedupe_key := format('remind:sp2:%s:%s', v_rec.operator_id, v_today_ist),
      p_recheck := jsonb_build_object('kind', 'pending_digest', 'operator_id', v_rec.operator_id),
      p_source := 'scanner:sp2'
    );

    IF v_nid IS NOT NULL THEN
      v_enqueued := v_enqueued + 1;
    END IF;
  END LOOP;

  RETURN v_enqueued;
END;
$$;

-- ==============================================================================
-- 3. SL1: Daily 18:00 IST Final Midnight Lock Warning
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.enqueue_final_lock_warning()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today_ist date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_target_date date := v_today_ist - 6;
  v_rec record;
  v_enqueued integer := 0;
  v_nid uuid;
BEGIN
  FOR v_rec IN (
    SELECT DISTINCT
      s.operator_id,
      s.work_date
    FROM public.get_pending_shift_slots() s
    WHERE s.work_date = v_target_date
  ) LOOP
    v_nid := public.enqueue_notification(
      p_user_id := v_rec.operator_id,
      p_category := 'shift_reminder',
      p_priority := 'critical',
      p_title := 'Action Required: Shift Entry Locks Tonight',
      p_body := format('Shift on %s locks tonight at midnight. Submit now.', to_char(v_rec.work_date, 'Mon DD')),
      p_deep_link := format('/operations?date=%s', v_rec.work_date),
      p_dedupe_key := format('remind:sl1:%s:%s', v_rec.operator_id, v_today_ist),
      p_recheck := jsonb_build_object('kind', 'final_lock', 'operator_id', v_rec.operator_id),
      p_source := 'scanner:sl1'
    );

    IF v_nid IS NOT NULL THEN
      v_enqueued := v_enqueued + 1;
    END IF;
  END LOOP;

  RETURN v_enqueued;
END;
$$;

-- ==============================================================================
-- 4. SUP1: Daily 09:30 IST Supervisor Pending Escalation Digest
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.enqueue_supervisor_digest()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today_ist date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_threshold_date date := v_today_ist - 3;
  v_rec record;
  v_enqueued integer := 0;
  v_nid uuid;
BEGIN
  FOR v_rec IN (
    WITH pending_near_lock AS (
      SELECT
        s.operator_id,
        min(s.work_date) AS oldest_date
      FROM public.get_pending_shift_slots() s
      WHERE s.work_date <= v_threshold_date
      GROUP BY s.operator_id
    )
    SELECT
      us.supervisor_id,
      count(DISTINCT pnl.operator_id)::int AS operator_count,
      min(pnl.oldest_date) AS oldest_date
    FROM pending_near_lock pnl
    JOIN public.user_supervisors us ON us.user_id = pnl.operator_id
    JOIN public.users u ON u.id = us.supervisor_id AND u.status = 'active'
    GROUP BY us.supervisor_id
  ) LOOP
    v_nid := public.enqueue_notification(
      p_user_id := v_rec.supervisor_id,
      p_category := 'shift_reminder',
      p_priority := 'normal',
      p_title := 'Operator Shift Entries Nearing Lock',
      p_body := format('%s %s unlogged shifts nearing lock (oldest %s). Review now.',
        v_rec.operator_count,
        CASE WHEN v_rec.operator_count = 1 THEN 'operator has' ELSE 'operators have' END,
        to_char(v_rec.oldest_date, 'Mon DD')
      ),
      p_deep_link := '/operations',
      p_dedupe_key := format('remind:sup1:%s:%s', v_rec.supervisor_id, v_today_ist),
      p_source := 'scanner:sup1'
    );

    IF v_nid IS NOT NULL THEN
      v_enqueued := v_enqueued + 1;
    END IF;
  END LOOP;

  RETURN v_enqueued;
END;
$$;

-- ==============================================================================
-- 5. Schedule Scanner Cron Jobs (pg_cron)
-- ==============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reminder_sp1_shift_end') THEN
    PERFORM cron.unschedule('reminder_sp1_shift_end');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reminder_sp2_morning_digest') THEN
    PERFORM cron.unschedule('reminder_sp2_morning_digest');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reminder_sup1_supervisor_digest') THEN
    PERFORM cron.unschedule('reminder_sup1_supervisor_digest');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'reminder_sl1_final_lock_warning') THEN
    PERFORM cron.unschedule('reminder_sl1_final_lock_warning');
  END IF;
END $$;

-- SP1: Every 15 minutes
SELECT cron.schedule('reminder_sp1_shift_end', '*/15 * * * *', 'SELECT public.enqueue_shift_end_reminders();');

-- SP2: 09:00 IST = 03:30 UTC
SELECT cron.schedule('reminder_sp2_morning_digest', '30 3 * * *', 'SELECT public.enqueue_pending_digest();');

-- SUP1: 09:30 IST = 04:00 UTC
SELECT cron.schedule('reminder_sup1_supervisor_digest', '0 4 * * *', 'SELECT public.enqueue_supervisor_digest();');

-- SL1: 18:00 IST = 12:30 UTC
SELECT cron.schedule('reminder_sl1_final_lock_warning', '30 12 * * *', 'SELECT public.enqueue_final_lock_warning();');
