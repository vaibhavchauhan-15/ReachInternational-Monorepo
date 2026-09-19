-- Migration 093: Operator Dashboard Submitted Alert
-- When today's log has been submitted, return success alert for operator dashboard

CREATE OR REPLACE FUNCTION public.get_operator_dashboard(p_operator_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_oid          uuid;
  v_op_name      text;
  v_machine_id   uuid;
  v_machine_code text;
  v_machine_model text;
  v_machine_serial text;
  v_client_id    uuid;
  v_client_name  text;
  v_client_site  text;
  v_shift_start  time;
  v_shift_end    time;
  v_entry_exists boolean;
  v_last_hmr     numeric;
  v_alerts       jsonb := '[]'::jsonb;
  v_today        date := CURRENT_DATE;
BEGIN
  v_oid := COALESCE(p_operator_id, auth.uid());

  -- Operator info + shift
  SELECT u.full_name, u.shift_start_time, u.shift_end_time
  INTO v_op_name, v_shift_start, v_shift_end
  FROM public.users u WHERE u.id = v_oid;

  IF v_op_name IS NULL THEN
    RETURN jsonb_build_object(
      'operator', NULL, 'machine', NULL, 'client', NULL,
      'today', jsonb_build_object('entryStatus', 'pending', 'lastHmr', NULL),
      'shift', jsonb_build_object('start', '', 'end', ''),
      'alerts', '[]'::jsonb
    );
  END IF;

  -- Current active machine assignment: Priority A (active assignment)
  SELECT oma.machine_id, oma.shift_start_time, oma.shift_end_time
  INTO v_machine_id, v_shift_start, v_shift_end
  FROM public.operator_machine_assignments oma
  WHERE oma.operator_id = v_oid AND oma.is_active = true
  ORDER BY oma.assigned_at DESC
  LIMIT 1;

  -- Priority B fallback: direct machine table assignment
  IF v_machine_id IS NULL THEN
    SELECT m.id
    INTO v_machine_id
    FROM public.machines m
    WHERE m.current_operator_id = v_oid
       OR v_oid = ANY(m.operator_ids)
    ORDER BY m.updated_at DESC
    LIMIT 1;
  END IF;

  IF v_machine_id IS NOT NULL THEN
    SELECT m.machine_id, m.model, m.serial_number, m.client_id
    INTO v_machine_code, v_machine_model, v_machine_serial, v_client_id
    FROM public.machines m WHERE m.id = v_machine_id;

    -- If machine doesn't have a direct client_id, check most recent log
    IF v_client_id IS NULL THEN
      SELECT mhl.client_id
      INTO v_client_id
      FROM public.machine_hour_logs mhl
      WHERE mhl.machine_id = v_machine_id AND mhl.client_id IS NOT NULL
      ORDER BY mhl.log_date DESC, mhl.created_at DESC
      LIMIT 1;
    END IF;

    IF v_client_id IS NOT NULL THEN
      SELECT c.company_name,
             COALESCE(
               NULLIF(TRIM(CONCAT_WS(', ',
                 NULLIF(c.street, ''),
                 NULLIF(c.city, ''),
                 NULLIF(c.district, ''),
                 NULLIF(c.state, '')
               )), ''),
               c.city,
               'Site Location'
             )
      INTO v_client_name, v_client_site
      FROM public.clients c WHERE c.id = v_client_id;
    END IF;
  END IF;

  -- Today's entry status
  SELECT EXISTS(
    SELECT 1 FROM public.machine_hour_logs
    WHERE operator_id = v_oid AND log_date = v_today
  ) INTO v_entry_exists;

  -- Last HMR
  SELECT end_meter INTO v_last_hmr
  FROM public.machine_hour_logs
  WHERE operator_id = v_oid
  ORDER BY log_date DESC, created_at DESC
  LIMIT 1;

  IF NOT v_entry_exists THEN
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'entry-pending',
      'severity', 'warning',
      'title', 'Today''s Log Pending',
      'description', 'Daily running hours have not been submitted for today.',
      'actionUrl', '/operations?tab=entry'
    );
  ELSE
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'entry-submitted',
      'severity', 'success',
      'title', 'Today''s Log Submitted',
      'description', 'Daily shift running hours are recorded. Click to view or update your log.',
      'actionUrl', '/operations?tab=history'
    );
  END IF;

  RETURN jsonb_build_object(
    'operator', jsonb_build_object('id', v_oid, 'name', v_op_name),
    'machine', CASE WHEN v_machine_id IS NOT NULL THEN
      jsonb_build_object(
        'id', v_machine_id,
        'name', COALESCE(v_machine_code, ''),
        'model', COALESCE(v_machine_model, ''),
        'serialNumber', COALESCE(v_machine_serial, '')
      )
    ELSE NULL END,
    'client', CASE WHEN v_client_id IS NOT NULL THEN
      jsonb_build_object(
        'id', v_client_id,
        'name', COALESCE(v_client_name, ''),
        'site', COALESCE(v_client_site, '')
      )
    ELSE NULL END,
    'today', jsonb_build_object(
      'entryStatus', CASE WHEN v_entry_exists THEN 'submitted' ELSE 'pending' END,
      'lastHmr', v_last_hmr
    ),
    'shift', jsonb_build_object(
      'start', COALESCE(v_shift_start::text, ''),
      'end', COALESCE(v_shift_end::text, '')
    ),
    'alerts', v_alerts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_operator_dashboard FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_operator_dashboard TO authenticated, service_role;
