-- ==============================================================================
-- Migration 065: Remove Duplicate Street and Address Column from Public Clients
-- 1. Preserves all address data into standard lowercase "street" column.
-- 2. Drops trigger trg_sync_client_address and function sync_client_address().
-- 3. Drops check constraint on "Street" and enforces NOT NULL check on street.
-- 4. Drops duplicate column "Street" (quoted, uppercase S).
-- 5. Drops column address from public.clients (address is computed dynamically on the fly).
-- 6. Updates submit_operator_hour_log_atomic to resolve location from street + city + district + state + pincode.
-- ==============================================================================

-- 1. Ensure street has all data from "Street"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'Street'
  ) THEN
    UPDATE public.clients
    SET street = btrim("Street")
    WHERE (street IS NULL OR btrim(street) = '') 
      AND "Street" IS NOT NULL 
      AND btrim("Street") <> '';
  END IF;
END $$;

-- 2. Drop trigger and function for sync_client_address
DROP TRIGGER IF EXISTS trg_sync_client_address ON public.clients;
DROP FUNCTION IF EXISTS public.sync_client_address();

-- 3. Drop constraint on "Street" if exists
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_address_not_empty;

-- 4. Enforce NOT NULL on street and create check constraint
ALTER TABLE public.clients ALTER COLUMN street SET NOT NULL;
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_street_not_empty;
ALTER TABLE public.clients ADD CONSTRAINT clients_street_not_empty CHECK (btrim(street) <> '');

-- 5. Drop duplicate column "Street"
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'Street'
  ) THEN
    ALTER TABLE public.clients DROP COLUMN "Street";
  END IF;
END $$;

-- 6. Drop column address from public.clients
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'address'
  ) THEN
    ALTER TABLE public.clients DROP COLUMN address;
  END IF;
END $$;

-- 7. Update submit_operator_hour_log_atomic to construct location dynamically
CREATE OR REPLACE FUNCTION public.submit_operator_hour_log_atomic(
  p_machine_id UUID,
  p_operator_id UUID,
  p_client_id UUID,
  p_log_date DATE,
  p_end_date DATE,
  p_start_datetime TIMESTAMPTZ,
  p_end_datetime TIMESTAMPTZ,
  p_start_meter NUMERIC,
  p_end_meter NUMERIC,
  p_start_time TEXT,
  p_end_time TEXT,
  p_overtime_hours NUMERIC,
  p_normal_working_hours NUMERIC,
  p_is_breakdown BOOLEAN,
  p_breakdown_start_time TEXT,
  p_breakdown_end_time TEXT,
  p_breakdown_duration TEXT,
  p_breakdown_hours NUMERIC,
  p_shift TEXT,
  p_machine_condition TEXT,
  p_location TEXT,
  p_remarks TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_log_id UUID;
  v_idempotency_key TEXT;
  v_audit_meta JSONB;
  v_inserted_log RECORD;
  v_machine_client_id UUID;
  v_resolved_client_id UUID;
  v_resolved_location TEXT;
  v_conflict_flag BOOLEAN := false;
  v_conflict_reason TEXT := NULL;
  v_conflict_status TEXT := NULL;
  v_conflicting_machine RECORD;
  v_log_end_time TIME;
  v_ot_start_time TIME;
  v_ot_ranges int4range[];
  v_log_date DATE;
  v_end_date DATE;
  v_start_datetime TIMESTAMPTZ;
  v_end_datetime TIMESTAMPTZ;
  v_start_time TIME;
  v_end_time TIME;
  v_shift_duration_hours NUMERIC;
BEGIN
  -- 0a. Operator Authorization & Identity Spoofing Guard (BUG-OP-07)
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_operator_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
        AND role IN ('admin', 'super_admin', 'supervisor', 'service_manager')
    ) THEN
      RAISE EXCEPTION 'Unauthorized operator attribution: you cannot submit logs on behalf of another operator.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- 0b. Inactive / Maintenance Machine Guard (BUG-OP-08)
  IF EXISTS (
    SELECT 1 FROM public.machines 
    WHERE id = p_machine_id 
      AND status IN ('maintenance', 'decommissioned', 'inactive')
  ) THEN
    RAISE EXCEPTION 'Cannot record operational hours for equipment currently in maintenance or decommissioned status.'
      USING ERRCODE = '23514';
  END IF;

  -- 1. Meter Regression Guard
  IF p_end_meter < p_start_meter THEN
    RAISE EXCEPTION 'End meter reading (%) cannot be less than start meter reading (%)', p_end_meter, p_start_meter
      USING ERRCODE = '23514';
  END IF;

  -- 1b. Timezone-Pinned Datetime Normalization & Overnight Shift Derivation (Asia/Kolkata)
  v_log_date := COALESCE(p_log_date, (NOW() AT TIME ZONE 'Asia/Kolkata')::date);
  v_end_date := p_end_date;
  v_start_datetime := p_start_datetime;
  v_end_datetime := p_end_datetime;
  v_start_time := NULLIF(TRIM(p_start_time), '')::TIME;
  v_end_time := NULLIF(TRIM(p_end_time), '')::TIME;

  -- Auto-derive end_date if overnight shift and end_date is null
  IF v_end_date IS NULL AND v_start_time IS NOT NULL AND v_end_time IS NOT NULL THEN
    IF v_end_time <= v_start_time THEN
      -- Overnight shift detected (e.g. 10:00 PM to 06:00 AM)
      v_end_date := (v_log_date + INTERVAL '1 day')::date;
    ELSE
      v_end_date := v_log_date;
    END IF;
  ELSIF v_end_date IS NULL THEN
    v_end_date := v_log_date;
  END IF;

  -- Derive start_datetime from log_date + start_time in Asia/Kolkata if missing
  IF v_start_datetime IS NULL AND v_start_time IS NOT NULL THEN
    v_start_datetime := ((v_log_date::text || ' ' || v_start_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata');
  END IF;

  -- Derive end_datetime from end_date + end_time in Asia/Kolkata if missing
  IF v_end_datetime IS NULL AND v_end_time IS NOT NULL THEN
    v_end_datetime := ((v_end_date::text || ' ' || v_end_time::text)::timestamp AT TIME ZONE 'Asia/Kolkata');
  END IF;

  -- 1c. Breakdown Duration Bounds Guard (BUG-OP-03)
  IF COALESCE(p_is_breakdown, false) = true AND COALESCE(p_breakdown_hours, 0) > 0 THEN
    IF v_start_datetime IS NOT NULL AND v_end_datetime IS NOT NULL THEN
      v_shift_duration_hours := EXTRACT(EPOCH FROM (v_end_datetime - v_start_datetime)) / 3600.0;
      IF p_breakdown_hours > v_shift_duration_hours THEN
        RAISE EXCEPTION 'Breakdown duration (%) cannot exceed total shift duration (%)',
          p_breakdown_hours, ROUND(v_shift_duration_hours::numeric, 2)
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  -- 2. Future Shift End Guard: Operator cannot enter logs before shift end
  -- Allows 1-minute grace margin for server/client clock skew
  IF v_end_datetime IS NOT NULL AND v_end_datetime > (NOW() + INTERVAL '1 minute') THEN
    RAISE EXCEPTION 'Cannot log before shift end.'
      USING ERRCODE = '23514';
  END IF;

  -- 3. Idempotency Key
  v_idempotency_key := COALESCE(
    NULLIF(TRIM(p_idempotency_key), ''),
    'ihl_' || replace(gen_random_uuid()::text, '-', '')
  );

  -- 4. Client and Location Resolution & Mismatch Guard (BUG-OP-05)
  SELECT client_id INTO v_machine_client_id FROM public.machines WHERE id = p_machine_id;
  IF v_machine_client_id IS NOT NULL THEN
    IF p_client_id IS NOT NULL AND p_client_id <> v_machine_client_id THEN
      RAISE EXCEPTION 'Client ID does not match assigned machine client deployment'
        USING ERRCODE = '23503';
    END IF;
    v_resolved_client_id := v_machine_client_id;
  ELSE
    v_resolved_client_id := p_client_id;
  END IF;

  IF v_resolved_location IS NULL AND v_resolved_client_id IS NOT NULL THEN
    SELECT concat_ws(', ',
      NULLIF(btrim(street), ''),
      NULLIF(btrim(city), ''),
      NULLIF(btrim(district), ''),
      NULLIF(btrim(state), ''),
      NULLIF(btrim(pincode), '')
    )
    INTO v_resolved_location
    FROM public.clients
    WHERE id = v_resolved_client_id;
  END IF;

  -- 5. Soft Overtime Conflict Detection:
  -- If overtime > 0, check if this operator's overtime tail crosses another active assignment on a different machine
  IF COALESCE(p_overtime_hours, 0) > 0 AND v_end_time IS NOT NULL THEN
    v_log_end_time := v_end_time;
    v_ot_start_time := (v_log_end_time - (p_overtime_hours || ' hours')::interval)::TIME;

    IF v_ot_start_time <> v_log_end_time THEN
      -- Map overtime window to circular 0-1440 int4range[]
      v_ot_ranges := public.shift_to_ranges(v_ot_start_time, v_log_end_time);

      -- Check if any part of the overtime range overlaps with any active shift range of this operator on ANOTHER machine
      SELECT oma.id, m.machine_id AS conflicting_code
      INTO v_conflicting_machine
      FROM public.operator_machine_assignments oma
      JOIN public.machines m ON m.id = oma.machine_id
      JOIN public.operator_shift_ranges osr ON osr.assignment_id = oma.id
      WHERE oma.operator_id = p_operator_id 
        AND oma.machine_id <> p_machine_id 
        AND oma.is_active = true
        AND osr.is_active = true
        AND EXISTS (
          SELECT 1 
          FROM unnest(v_ot_ranges) AS ot_r 
          WHERE ot_r && osr.minute_range
        )
      LIMIT 1;

      IF v_conflicting_machine.id IS NOT NULL THEN
        v_conflict_flag := true;
        v_conflict_status := 'pending';
        v_conflict_reason := 'overtime_overlaps_assignment:' || COALESCE(v_conflicting_machine.conflicting_code, 'other_machine');
      END IF;
    END IF;
  END IF;

  -- 6. Insert into machine_hour_logs with fully-resolved timestamps
  INSERT INTO public.machine_hour_logs (
    machine_id,
    operator_id,
    client_id,
    log_date,
    end_date,
    start_datetime,
    end_datetime,
    start_meter,
    end_meter,
    start_time,
    end_time,
    overtime_hours,
    normal_working_hours,
    is_breakdown,
    breakdown_start_time,
    breakdown_end_time,
    breakdown_duration,
    breakdown_hours,
    shift,
    machine_condition,
    location,
    remarks,
    idempotency_key,
    conflict_flag,
    conflict_reason,
    conflict_status
  )
  VALUES (
    p_machine_id,
    p_operator_id,
    v_resolved_client_id,
    v_log_date,
    v_end_date,
    v_start_datetime,
    v_end_datetime,
    p_start_meter,
    p_end_meter,
    v_start_time,
    v_end_time,
    COALESCE(p_overtime_hours, 0),
    COALESCE(p_normal_working_hours, 0),
    COALESCE(p_is_breakdown, false),
    NULLIF(TRIM(p_breakdown_start_time), '')::TIME,
    NULLIF(TRIM(p_breakdown_end_time), '')::TIME,
    p_breakdown_duration,
    COALESCE(p_breakdown_hours, 0),
    p_shift,
    COALESCE(p_machine_condition, 'good'),
    v_resolved_location,
    p_remarks,
    v_idempotency_key,
    v_conflict_flag,
    v_conflict_reason,
    v_conflict_status
  )
  RETURNING * INTO v_inserted_log;

  v_log_id := v_inserted_log.id;

  -- 7. Update Machine Current Meter, Operator & Health Status
  IF p_machine_condition = 'breakdown' OR p_is_breakdown = true THEN
    UPDATE public.machines
    SET
      hour_meter = p_end_meter,
      current_operator_id = p_operator_id,
      health_status = 'breakdown',
      updated_at = NOW()
    WHERE id = p_machine_id;
  ELSE
    UPDATE public.machines
    SET
      hour_meter = p_end_meter,
      current_operator_id = p_operator_id,
      health_status = 'active',
      updated_at = NOW()
    WHERE id = p_machine_id;
  END IF;

  -- 8. Audit Logging
  v_audit_meta := jsonb_build_object(
    'action', 'operator_hour_log_submitted',
    'log_id', v_log_id,
    'machine_id', p_machine_id,
    'operator_id', p_operator_id,
    'client_id', v_resolved_client_id,
    'meter_progression', p_start_meter || ' -> ' || p_end_meter,
    'running_hours', p_end_meter - p_start_meter,
    'shift_interval', v_log_date || ' ' || COALESCE(p_start_time, '') || ' -> ' || v_end_date || ' ' || COALESCE(p_end_time, ''),
    'start_datetime', v_start_datetime,
    'end_datetime', v_end_datetime,
    'is_breakdown', p_is_breakdown,
    'breakdown_duration', p_breakdown_duration,
    'breakdown_hours', p_breakdown_hours,
    'idempotency_key', v_idempotency_key,
    'conflict_flag', v_conflict_flag,
    'conflict_reason', v_conflict_reason
  );

  INSERT INTO public.audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    details
  )
  VALUES (
    p_operator_id,
    'machine.hour_logged',
    'machine_hour_logs',
    v_log_id,
    v_audit_meta
  );

  RETURN jsonb_build_object(
    'success', true,
    'log_id', v_log_id,
    'machine_id', p_machine_id,
    'operator_id', p_operator_id,
    'hour_meter', p_end_meter,
    'running_hours', p_end_meter - p_start_meter,
    'normal_working_hours', p_normal_working_hours,
    'overtime_hours', p_overtime_hours,
    'is_breakdown', p_is_breakdown,
    'conflict_flag', v_conflict_flag,
    'conflict_reason', v_conflict_reason,
    'conflict_status', v_conflict_status,
    'start_datetime', v_start_datetime,
    'end_datetime', v_end_datetime,
    'log_date', v_log_date,
    'end_date', v_end_date
  );
END;
$$ LANGUAGE plpgsql;
