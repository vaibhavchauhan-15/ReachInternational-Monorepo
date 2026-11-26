-- ==============================================================================
-- Rollback for Migration 245: Push Template Zero-PII Fixes + User Deactivation
-- Restores the pre-245 REG1/ENQ1 bodies (WITH PII — restore only if explicitly
-- required) and drops the user-status deactivation trigger.
-- Target: Reach International Dev (vlmxciuogczumumrwyot). Never run against Prod.
-- ==============================================================================

DROP TRIGGER IF EXISTS trg_deactivate_push_devices_on_user_status ON public.users;
DROP FUNCTION IF EXISTS public.trg_deactivate_push_devices_on_user_status();

CREATE OR REPLACE FUNCTION public.producer_reg1_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id uuid;
  v_bucket bigint := (extract(epoch from now())::bigint / 900);
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
