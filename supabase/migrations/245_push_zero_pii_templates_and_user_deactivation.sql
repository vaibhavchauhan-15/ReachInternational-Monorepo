-- ==============================================================================
-- Migration 245: Push Template Zero-PII Fixes + Deactivate Devices on User Deactivation
-- Target Database: Reach International Dev (vlmxciuogczumumrwyot)
-- Source of truth: AI/FEATURES/push-notifications.md (G-P/zero-PII finding §7)
-- Rollback: supabase/rollbacks/245_rollback_push_zero_pii_and_user_deactivation.sql
--
-- 1. REG1 and ENQ1 push bodies contained personal data (registrant full name,
--    RFQ contact name, project city). Lock-screen text must be zero-PII.
--    Bodies now carry only non-identifying business context.
-- 2. Push devices are deactivated when a user's account is deactivated
--    (brief: deactivate on logout, account switch, account deletion, user
--    deactivation). Deletion is already covered by ON DELETE CASCADE.
-- ==============================================================================

-- 1a. REG1 — zero-PII body (no names; role is organizational, not personal)
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
        p_body := format('A new %s registration is pending approval.', coalesce(NEW.role, 'operator')),
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

-- 1b. ENQ1 — zero-PII body (no contact name, no city)
CREATE OR REPLACE FUNCTION public.producer_enq1_rfq()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recipient_id uuid;
BEGIN
  BEGIN
    FOR v_recipient_id IN (
      SELECT id FROM public.users
      WHERE role IN ('admin', 'super_admin', 'manager') AND status = 'active'
    ) LOOP
      PERFORM public.enqueue_notification(
        p_user_id := v_recipient_id,
        p_category := 'admin',
        p_priority := 'normal',
        p_title := format('New RFQ Inquiry: %s', coalesce(NEW.rfq_number, 'Inquiry')),
        p_body := 'A new equipment inquiry has been received.',
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

-- 2. Deactivate push devices when a user is deactivated
CREATE OR REPLACE FUNCTION public.trg_deactivate_push_devices_on_user_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'active' THEN
    UPDATE public.push_devices
       SET is_active = false,
           disabled_reason = 'user_' || NEW.status
     WHERE user_id = NEW.id
       AND is_active = true;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'trg_deactivate_push_devices_on_user_status error on user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deactivate_push_devices_on_user_status ON public.users;
CREATE TRIGGER trg_deactivate_push_devices_on_user_status
  AFTER UPDATE OF status ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_deactivate_push_devices_on_user_status();
