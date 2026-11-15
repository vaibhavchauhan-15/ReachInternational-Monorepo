-- Migration 195: Push Notification Event Producers (BD1, AS1, EM1, SA1, REG1, ENQ1)
-- Author: ReachInternational AI Engineering Team
-- Date: 2026-11-14

-- ==============================================================================
-- 1. BD1: Breakdown Flagged on Machine Hour Log
-- Recipients: machines.supervisor_ids (+ current_supervisor_id) ∪ active managers/admins.
-- Skip push (inbox only) if log_date older than 24h.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.producer_bd1_breakdown()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_machine_code text;
  v_supervisor_id uuid;
  v_rec_id uuid;
  v_older_than_24h boolean;
  v_priority text;
  v_recipients uuid[] := '{}';
BEGIN
  -- Defensive wrapper: Notification trigger must NEVER abort business transaction
  BEGIN
    SELECT coalesce(machine_id, machine_name) INTO v_machine_code FROM public.machines WHERE id = NEW.machine_id;

    -- Check if log_date is older than 24 hours (offline sync catchup)
    v_older_than_24h := NEW.log_date < ((now() AT TIME ZONE 'Asia/Kolkata')::date - 1);
    v_priority := CASE WHEN v_older_than_24h THEN 'low' ELSE 'critical' END;

    -- Aggregate supervisors from machine
    SELECT ARRAY_AGG(DISTINCT s_id) INTO v_recipients
    FROM (
      SELECT unnest(supervisor_ids) AS s_id FROM public.machines WHERE id = NEW.machine_id
      UNION
      SELECT current_supervisor_id AS s_id FROM public.machines WHERE id = NEW.machine_id AND current_supervisor_id IS NOT NULL
      UNION
      SELECT id AS s_id FROM public.users WHERE role IN ('manager', 'admin', 'super_admin') AND status = 'active'
    ) sub
    WHERE s_id IS NOT NULL;

    IF v_recipients IS NOT NULL AND array_length(v_recipients, 1) > 0 THEN
      FOREACH v_rec_id IN ARRAY v_recipients LOOP
        PERFORM public.enqueue_notification(
          p_user_id := v_rec_id,
          p_category := 'breakdown',
          p_priority := v_priority,
          p_title := format('Breakdown Flagged: %s', coalesce(v_machine_code, 'Equipment')),
          p_body := format('Equipment %s flagged with breakdown during shift %s.', coalesce(v_machine_code, 'Equipment'), coalesce(NEW.shift_code, 'log')),
          p_deep_link := format('/machines?id=%s', NEW.machine_id),
          p_dedupe_key := format('breakdown:%s:%s', NEW.id, v_rec_id),
          p_source := 'producer:bd1'
        );
      END LOOP;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'producer_bd1_breakdown error on log %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_bd1_breakdown ON public.machine_hour_logs;
CREATE TRIGGER trg_notify_bd1_breakdown
  AFTER INSERT ON public.machine_hour_logs
  FOR EACH ROW
  WHEN (NEW.is_breakdown IS TRUE)
  EXECUTE FUNCTION public.producer_bd1_breakdown();

-- ==============================================================================
-- 2. AS1: Assisted Shift Log Recorded by Supervisor on Operator's Behalf
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.producer_as1_assisted_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_machine_code text;
BEGIN
  BEGIN
    SELECT coalesce(machine_id, machine_name) INTO v_machine_code FROM public.machines WHERE id = NEW.machine_id;

    PERFORM public.enqueue_notification(
      p_user_id := NEW.operator_id,
      p_category := 'assignment',
      p_priority := 'normal',
      p_title := 'Shift Logged on Your Behalf',
      p_body := format('A supervisor recorded your shift on equipment %s (%s hrs).', coalesce(v_machine_code, 'Equipment'), coalesce(NEW.running_hours, 0)),
      p_deep_link := format('/operations?date=%s', NEW.log_date),
      p_dedupe_key := format('assisted:%s', NEW.id),
      p_source := 'producer:as1'
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'producer_as1_assisted_log error on log %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_as1_assisted_log ON public.machine_hour_logs;
CREATE TRIGGER trg_notify_as1_assisted_log
  AFTER INSERT ON public.machine_hour_logs
  FOR EACH ROW
  WHEN (NEW.entered_by IS NOT NULL AND NEW.entered_by IS DISTINCT FROM NEW.operator_id)
  EXECUTE FUNCTION public.producer_as1_assisted_log();

-- ==============================================================================
-- 3. EM1: Equipment Halted / Maintenance Stop
-- Operators + supervisors assigned covering today.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.producer_em1_machine_stop()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_epoch bigint := extract(epoch from coalesce(NEW.updated_at, now()))::bigint;
  v_rec_id uuid;
  v_recipients uuid[] := '{}';
BEGIN
  BEGIN
    -- Query active assignments covering today
    SELECT ARRAY_AGG(DISTINCT u_id) INTO v_recipients
    FROM (
      SELECT operator_id AS u_id FROM public.operator_machine_assignments
      WHERE machine_id = NEW.id AND is_active = true AND valid_from <= v_today AND (valid_to IS NULL OR valid_to >= v_today)
      UNION
      SELECT unnest(supervisor_ids) AS u_id FROM public.machines WHERE id = NEW.id
      UNION
      SELECT current_supervisor_id AS u_id FROM public.machines WHERE id = NEW.id AND current_supervisor_id IS NOT NULL
    ) sub
    WHERE u_id IS NOT NULL;

    IF v_recipients IS NOT NULL AND array_length(v_recipients, 1) > 0 THEN
      FOREACH v_rec_id IN ARRAY v_recipients LOOP
        PERFORM public.enqueue_notification(
          p_user_id := v_rec_id,
          p_category := 'breakdown',
          p_priority := 'high',
          p_title := format('Equipment Halted: %s', coalesce(NEW.machine_id, NEW.machine_name)),
          p_body := format('Machine %s health status changed to %s.', coalesce(NEW.machine_id, NEW.machine_name), coalesce(NEW.health_status, NEW.status)),
          p_deep_link := format('/machines?id=%s', NEW.id),
          p_dedupe_key := format('machine_stop:%s:%s:%s', NEW.id, v_rec_id, v_epoch),
          p_source := 'producer:em1'
        );
      END LOOP;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'producer_em1_machine_stop error on machine %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_em1_machine_stop ON public.machines;
CREATE TRIGGER trg_notify_em1_machine_stop
  AFTER UPDATE OF health_status, status ON public.machines
  FOR EACH ROW
  WHEN (
    (NEW.health_status = 'under_maintenance' AND (OLD.health_status IS DISTINCT FROM 'under_maintenance'))
    OR (NEW.status = 'inactive' AND (OLD.status IS DISTINCT FROM 'inactive'))
  )
  EXECUTE FUNCTION public.producer_em1_machine_stop();

-- ==============================================================================
-- 4. SA1: Shift / Machine Assignment Changes
-- Takes effect today or tomorrow. Respects SET LOCAL app.skip_notify = 'on'.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.producer_sa1_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_machine_code text;
BEGIN
  -- Check if bulk/seed operation disabled notification
  IF current_setting('app.skip_notify', true) = 'on' THEN
    RETURN NEW;
  END IF;

  BEGIN
    -- Only trigger if assignment takes effect today or tomorrow
    IF NEW.valid_from <= (v_today + 1) AND (NEW.valid_to IS NULL OR NEW.valid_to >= v_today) THEN
      SELECT coalesce(machine_id, machine_name) INTO v_machine_code FROM public.machines WHERE id = NEW.machine_id;

      PERFORM public.enqueue_notification(
        p_user_id := NEW.operator_id,
        p_category := 'assignment',
        p_priority := 'normal',
        p_title := 'Machine Assignment Update',
        p_body := format('Your assignment has been updated for equipment %s (Shift %s).', coalesce(v_machine_code, 'Equipment'), coalesce(NEW.shift_code, 'assigned')),
        p_deep_link := '/operations',
        p_dedupe_key := format('reassign:%s:%s:%s', NEW.id, TG_OP, coalesce(NEW.valid_from, v_today)),
        p_source := 'producer:sa1'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'producer_sa1_assignment error on assignment %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_sa1_assignment ON public.operator_machine_assignments;
CREATE TRIGGER trg_notify_sa1_assignment
  AFTER INSERT OR UPDATE ON public.operator_machine_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.producer_sa1_assignment();

-- ==============================================================================
-- 5. REG1: User Registration Pending Approval
-- Batching digest to admins, HR, and super_admins.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.producer_reg1_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id uuid;
  v_bucket bigint := (extract(epoch from now())::bigint / 900); -- 15-minute window bucket
BEGIN
  BEGIN
    FOR v_admin_id IN (
      SELECT id FROM public.users
      WHERE role IN ('admin', 'super_admin', 'hr') AND status = 'active'
    ) LOOP
      PERFORM public.enqueue_notification(
        p_user_id := v_admin_id,
        p_category := 'admin',
        p_priority := 'normal',
        p_title := 'New Registration Pending Approval',
        p_body := format('New user registration pending approval: %s (%s).', NEW.full_name, coalesce(NEW.role, 'operator')),
        p_deep_link := '/users',
        p_dedupe_key := format('reg:%s:%s:%s', NEW.id, v_admin_id, v_bucket),
        p_source := 'producer:reg1'
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'producer_reg1_registration error on user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_reg1_registration ON public.users;
CREATE TRIGGER trg_notify_reg1_registration
  AFTER INSERT ON public.users
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION public.producer_reg1_registration();

-- ==============================================================================
-- 6. ENQ1: RFQ & Equipment Contact Inquiry Received
-- Defensive check: Table public.quote_requests is defined in RFQ module.
-- Attaches trigger dynamically if and only if quote_requests exists.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.producer_enq1_rfq()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recipient_id uuid;
  v_contact_name text;
BEGIN
  BEGIN
    -- Safely resolve contact name if contacts table exists
    IF EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'contacts'
    ) THEN
      EXECUTE 'SELECT full_name FROM public.contacts WHERE id = $1'
        INTO v_contact_name
        USING NEW.contact_id;
    END IF;

    FOR v_recipient_id IN (
      SELECT id FROM public.users
      WHERE role IN ('admin', 'super_admin', 'manager') AND status = 'active'
    ) LOOP
      PERFORM public.enqueue_notification(
        p_user_id := v_recipient_id,
        p_category := 'admin',
        p_priority := 'normal',
        p_title := format('New RFQ Inquiry: %s', coalesce(NEW.rfq_number, 'Inquiry')),
        p_body := format('New equipment inquiry received from %s (%s).', coalesce(v_contact_name, 'Client'), coalesce(NEW.project_city, 'General')),
        p_deep_link := '/admin/sales/rfq',
        p_dedupe_key := format('enquiry:%s:%s', NEW.id, v_recipient_id),
        p_source := 'producer:enq1'
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'producer_enq1_rfq error on quote_request %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Conditionally attach trigger only if public.quote_requests exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'quote_requests'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_notify_enq1_rfq ON public.quote_requests';
    EXECUTE 'CREATE TRIGGER trg_notify_enq1_rfq
      AFTER INSERT ON public.quote_requests
      FOR EACH ROW
      EXECUTE FUNCTION public.producer_enq1_rfq()';
  END IF;
END $$;
