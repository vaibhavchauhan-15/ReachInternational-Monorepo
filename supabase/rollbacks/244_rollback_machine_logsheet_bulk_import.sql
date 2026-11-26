-- ============================================
-- Rollback for Migration 242: Admin-only bulk machine logsheet Excel import
-- Removes import_machine_hour_logs_bulk, the machine_log_imports audit table,
-- and restores the two log notification producers to their pre-242 bodies.
-- ============================================

DROP FUNCTION IF EXISTS public.import_machine_hour_logs_bulk(jsonb);

DROP TABLE IF EXISTS public.machine_log_imports;

-- Restore notification producers without the bulk-import suppression guard
CREATE OR REPLACE FUNCTION public.producer_bd1_breakdown()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_machine_code text;
  v_rec_id uuid;
  v_older_than_24h boolean;
  v_priority text;
  v_recipients uuid[] := '{}';
BEGIN
  BEGIN
    SELECT coalesce(machine_id, machine_name) INTO v_machine_code FROM public.machines WHERE id = NEW.machine_id;

    v_older_than_24h := NEW.log_date < ((now() AT TIME ZONE 'Asia/Kolkata')::date - 1);
    v_priority := CASE WHEN v_older_than_24h THEN 'low' ELSE 'critical' END;

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
$function$;

CREATE OR REPLACE FUNCTION public.trg_assisted_shift_notify_operator()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_machine_code text;
  v_supervisor_name text;
  v_running_hrs numeric;
BEGIN
  -- Only trigger if entered_by is distinct from operator_id (assisted entry on behalf of operator)
  IF NEW.entered_by IS NOT NULL AND NEW.operator_id IS NOT NULL AND NEW.entered_by <> NEW.operator_id THEN
    SELECT machine_id INTO v_machine_code FROM public.machines WHERE id = NEW.machine_id;
    SELECT full_name INTO v_supervisor_name FROM public.users WHERE id = NEW.entered_by;

    v_running_hrs := COALESCE(NEW.running_hours, GREATEST(0, ROUND((NEW.end_meter - NEW.start_meter)::numeric, 1)));

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
$function$;
