-- ==============================================================================
-- Migration 112: Client Shift Codes and Centralized Shift-Based OT Calculation Engine
-- 1. Creates public.client_shift_codes master table.
-- 2. Seeds standard shift codes for all existing clients (Shift A, B, C for 24h coverage).
-- 3. Adds shift_code and shift_scheduled_minutes columns to public.machine_hour_logs.
-- 4. Extends public.submit_operator_hour_log_atomic with centralized OT calculation:
--    - 1st shift today = normal_minutes (plus built-in OT if scheduled > normal)
--    - 2nd+ shift today = 100% overtime
--    - Prevents duplicate submission for same operator + day + shift_code
-- 5. Extends public.get_operator_entry_context to return client's active shift codes.
-- 6. Extends public.get_operation_logs to project shift_code and shift_scheduled_minutes.
-- ==============================================================================

-- 1. Create client_shift_codes master table
CREATE TABLE IF NOT EXISTS public.client_shift_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  code text NOT NULL,                    -- 'A', 'B', 'C', etc.
  name text,                            -- 'Shift A', 'Morning Shift', etc.
  start_time time NOT NULL,
  end_time time NOT NULL,
  crosses_midnight boolean NOT NULL DEFAULT false,
  scheduled_minutes integer NOT NULL,   -- e.g. 480 for 8h, 720 for 12h
  normal_minutes integer NOT NULL,      -- e.g. 480 for normal 8h; remainder is built-in OT
  display_order smallint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_client_shift_codes_client_code UNIQUE (client_id, code),
  CONSTRAINT ck_client_shift_scheduled_positive CHECK (scheduled_minutes > 0),
  CONSTRAINT ck_client_shift_normal_valid CHECK (normal_minutes >= 0 AND normal_minutes <= scheduled_minutes)
);

CREATE INDEX IF NOT EXISTS idx_client_shift_codes_client_active
  ON public.client_shift_codes (client_id) WHERE is_active = true;

-- Enable RLS
ALTER TABLE public.client_shift_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "client_shift_codes_select" ON public.client_shift_codes;
CREATE POLICY "client_shift_codes_select"
  ON public.client_shift_codes
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "client_shift_codes_manage" ON public.client_shift_codes;
CREATE POLICY "client_shift_codes_manage"
  ON public.client_shift_codes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('super_admin', 'admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('super_admin', 'admin', 'manager')
    )
  );

-- 2. Additive columns on machine_hour_logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'machine_hour_logs' AND column_name = 'shift_code'
  ) THEN
    ALTER TABLE public.machine_hour_logs ADD COLUMN shift_code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'machine_hour_logs' AND column_name = 'shift_scheduled_minutes'
  ) THEN
    ALTER TABLE public.machine_hour_logs ADD COLUMN shift_scheduled_minutes integer;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_mhl_operator_log_date
  ON public.machine_hour_logs (operator_id, log_date);

-- 3. Seed standard default shifts (A, B, C) for all existing clients that do not yet have shifts
INSERT INTO public.client_shift_codes (client_id, code, name, start_time, end_time, crosses_midnight, scheduled_minutes, normal_minutes, display_order, is_active)
SELECT
  c.id,
  s.code,
  s.name,
  s.start_time::time,
  s.end_time::time,
  s.crosses_midnight,
  s.scheduled_minutes,
  s.normal_minutes,
  s.display_order,
  true
FROM public.clients c
CROSS JOIN (
  VALUES
    ('A', 'Shift A (Morning)', '06:00:00', '14:00:00', false, 480, 480, 1),
    ('B', 'Shift B (Evening)', '14:00:00', '22:00:00', false, 480, 480, 2),
    ('C', 'Shift C (Night)',   '22:00:00', '06:00:00', true,  480, 480, 3)
) AS s(code, name, start_time, end_time, crosses_midnight, scheduled_minutes, normal_minutes, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_shift_codes existing
  WHERE existing.client_id = c.id
)
ON CONFLICT (client_id, code) DO NOTHING;

-- 4. Update Atomic RPC Function: submit_operator_hour_log_atomic
DROP FUNCTION IF EXISTS public.submit_operator_hour_log_atomic(
  UUID, UUID, UUID, DATE, DATE, TIMESTAMPTZ, TIMESTAMPTZ, NUMERIC, NUMERIC, TEXT, TEXT, NUMERIC, NUMERIC, BOOLEAN, TEXT, TEXT, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION public.submit_operator_hour_log_atomic(
  p_machine_id UUID,
  p_operator_id UUID,
  p_client_id UUID DEFAULT NULL,
  p_log_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL,
  p_start_datetime TIMESTAMPTZ DEFAULT NULL,
  p_end_datetime TIMESTAMPTZ DEFAULT NULL,
  p_start_meter NUMERIC DEFAULT 0,
  p_end_meter NUMERIC DEFAULT 0,
  p_start_time TEXT DEFAULT NULL,
  p_end_time TEXT DEFAULT NULL,
  p_overtime_hours NUMERIC DEFAULT 0,
  p_normal_working_hours NUMERIC DEFAULT 8,
  p_is_breakdown BOOLEAN DEFAULT false,
  p_breakdown_start_time TEXT DEFAULT NULL,
  p_breakdown_end_time TEXT DEFAULT NULL,
  p_breakdown_duration TEXT DEFAULT NULL,
  p_breakdown_hours NUMERIC DEFAULT 0,
  p_shift TEXT DEFAULT NULL,
  p_machine_condition TEXT DEFAULT 'good',
  p_location TEXT DEFAULT NULL,
  p_remarks TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_shift_code TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_log_id UUID;
  v_idempotency_key TEXT;
  v_audit_meta JSONB;
  v_inserted_log RECORD;
  v_log_date DATE;
  v_end_date DATE;
  v_start_datetime TIMESTAMPTZ;
  v_end_datetime TIMESTAMPTZ;
  v_start_time TIME;
  v_end_time TIME;
  v_shift_duration_hours NUMERIC;
  v_machine_client_id UUID;
  v_resolved_client_id UUID;
  v_resolved_location TEXT := p_location;

  -- Overtime conflict detection variables
  v_conflict_flag BOOLEAN := false;
  v_conflict_reason TEXT := NULL;
  v_conflict_status TEXT := NULL;
  v_ot_start_time TIME;
  v_log_end_time TIME;
  v_ot_ranges INT4RANGE[];
  v_conflicting_machine RECORD;
  v_caller_role TEXT;
  v_op_name TEXT;

  -- Shift template resolution & centralized OT engine variables
  v_shift RECORD;
  v_shift_input TEXT := NULLIF(TRIM(COALESCE(p_shift_code, p_shift)), '');
  v_shift_code TEXT := NULL;
  v_shift_scheduled_minutes INT := NULL;
  v_prior_shifts INT := 0;
  v_normal_hours NUMERIC;
  v_ot_hours NUMERIC;
BEGIN
  -- 0. Authorization Guard
  IF auth.role() = 'authenticated' AND auth.uid() <> p_operator_id THEN
    SELECT role INTO v_caller_role FROM public.users WHERE id = auth.uid();
    IF v_caller_role NOT IN ('super_admin', 'admin', 'manager', 'supervisor') THEN
      RAISE EXCEPTION 'Unauthorized operator assignment submission'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT full_name INTO v_op_name FROM public.users WHERE id = p_operator_id;

  -- 0b. Equipment Lifecycle Guard
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

  -- 2. Client and Location Resolution & Mismatch Guard
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

  -- 3. Centralized Shift Code Lookup & OT Engine
  -- Match p_shift against client_shift_codes by code ('A', 'B', 'C') or name ('Shift A')
  IF v_resolved_client_id IS NOT NULL AND p_shift IS NOT NULL AND TRIM(p_shift) <> '' THEN
    SELECT code, name, start_time, end_time, crosses_midnight, scheduled_minutes, normal_minutes
    INTO v_shift
    FROM public.client_shift_codes
    WHERE client_id = v_resolved_client_id
      AND is_active = true
      AND (
        UPPER(TRIM(code)) = UPPER(TRIM(p_shift))
        OR UPPER(TRIM('Shift ' || code)) = UPPER(TRIM(p_shift))
        OR UPPER(TRIM(name)) = UPPER(TRIM(p_shift))
      )
    ORDER BY display_order ASC
    LIMIT 1;

    IF v_shift.code IS NOT NULL THEN
      v_shift_code := v_shift.code;
      v_shift_scheduled_minutes := v_shift.scheduled_minutes;

      -- If operator did not supply explicit custom start/end time, snapshot shift defaults
      IF v_start_time IS NULL THEN
        v_start_time := v_shift.start_time;
      END IF;
      IF v_end_time IS NULL THEN
        v_end_time := v_shift.end_time;
      END IF;

      -- Duplicate Shift Submission Check:
      -- Prevent same operator from submitting the exact same shift code on the same operational date
      IF EXISTS (
        SELECT 1 FROM public.machine_hour_logs
        WHERE operator_id = p_operator_id
          AND log_date = v_log_date
          AND shift_code = v_shift.code
      ) THEN
        RAISE EXCEPTION 'Operator has already submitted a log for Shift % on %', v_shift.code, v_log_date
          USING ERRCODE = '23514';
      END IF;

      -- Check prior shifts logged by this operator on this operational date
      SELECT count(*) INTO v_prior_shifts
      FROM public.machine_hour_logs
      WHERE operator_id = p_operator_id
        AND log_date = v_log_date;

      -- Centralized OT Calculation Rule:
      -- 1st Shift today: normal portion is v_shift.normal_minutes; remainder is built-in OT
      -- 2nd+ Shift today: 0 normal minutes; entire shift scheduled duration is OVERTIME
      IF v_prior_shifts = 0 THEN
        v_normal_hours := ROUND((v_shift.normal_minutes / 60.0)::numeric, 2);
        v_ot_hours := ROUND(((v_shift.scheduled_minutes - v_shift.normal_minutes) / 60.0)::numeric, 2);
      ELSE
        v_normal_hours := 0;
        v_ot_hours := ROUND((v_shift.scheduled_minutes / 60.0)::numeric, 2);
      END IF;

      -- Auto-derive overnight end_date if template crosses midnight
      IF v_shift.crosses_midnight = true AND (v_end_date IS NULL OR v_end_date = v_log_date) THEN
        v_end_date := (v_log_date + INTERVAL '1 day')::date;
      END IF;
    END IF;
  END IF;

  -- Fallback to provided/manual values if not calculated by shift engine
  IF v_normal_hours IS NULL THEN
    v_normal_hours := COALESCE(p_normal_working_hours, 8);
  END IF;
  IF v_ot_hours IS NULL THEN
    v_ot_hours := COALESCE(p_overtime_hours, 0);
  END IF;

  -- Auto-derive end_date if overnight shift and end_date is null
  IF v_end_date IS NULL AND v_start_time IS NOT NULL AND v_end_time IS NOT NULL THEN
    IF v_end_time <= v_start_time THEN
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

  -- Breakdown Duration Bounds Guard (BUG-OP-03)
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

  -- Future Shift End Guard: Operator cannot enter logs before shift end
  -- Allows 1-minute grace margin for server/client clock skew
  IF v_end_datetime IS NOT NULL AND v_end_datetime > (NOW() + INTERVAL '1 minute') THEN
    RAISE EXCEPTION 'Cannot log before shift end.'
      USING ERRCODE = '23514';
  END IF;

  -- Idempotency Key
  v_idempotency_key := COALESCE(
    NULLIF(TRIM(p_idempotency_key), ''),
    'ihl_' || replace(gen_random_uuid()::text, '-', '')
  );

  -- Soft Overtime Conflict Detection:
  -- If overtime > 0, check if this operator's overtime tail crosses another active assignment on a different machine
  IF v_ot_hours > 0 AND v_end_time IS NOT NULL THEN
    v_log_end_time := v_end_time;
    v_ot_start_time := (v_log_end_time - (v_ot_hours || ' hours')::interval)::TIME;

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

  -- Insert into machine_hour_logs with snapshot fields
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
    shift_code,
    shift_scheduled_minutes,
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
    v_ot_hours,
    v_normal_hours,
    COALESCE(p_is_breakdown, false),
    NULLIF(TRIM(p_breakdown_start_time), '')::TIME,
    NULLIF(TRIM(p_breakdown_end_time), '')::TIME,
    p_breakdown_duration,
    COALESCE(p_breakdown_hours, 0),
    COALESCE(p_shift, CASE WHEN v_shift_code IS NOT NULL THEN 'Shift ' || v_shift_code ELSE NULL END),
    v_shift_code,
    v_shift_scheduled_minutes,
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

  -- Update Machine Current Meter, Operator & Health Status
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

  -- Audit Logging
  v_audit_meta := jsonb_build_object(
    'action', 'operator_hour_log_submitted',
    'log_id', v_log_id,
    'machine_id', p_machine_id,
    'operator_id', p_operator_id,
    'client_id', v_resolved_client_id,
    'shift_code', v_shift_code,
    'shift_scheduled_minutes', v_shift_scheduled_minutes,
    'meter_progression', p_start_meter || ' -> ' || p_end_meter,
    'running_hours', p_end_meter - p_start_meter,
    'shift_interval', v_log_date || ' ' || COALESCE(v_start_time::text, '') || ' -> ' || v_end_date || ' ' || COALESCE(v_end_time::text, ''),
    'normal_working_hours', v_normal_hours,
    'overtime_hours', v_ot_hours,
    'prior_shifts_today', v_prior_shifts,
    'start_datetime', v_start_datetime,
    'end_datetime', v_end_datetime,
    'is_breakdown', p_is_breakdown,
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
    'shift_code', v_shift_code,
    'shift', v_inserted_log.shift,
    'hour_meter', p_end_meter,
    'running_hours', p_end_meter - p_start_meter,
    'normal_working_hours', v_normal_hours,
    'overtime_hours', v_ot_hours,
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 5. Update get_operator_entry_context to include client's active shift codes
CREATE OR REPLACE FUNCTION public.get_operator_entry_context(p_operator_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_operator_id uuid;
  v_op_id uuid;
  v_op_name text;
  v_op_role text;
  v_op_shift_start time;
  v_op_shift_end time;

  v_assigned_machine_id uuid;
  v_oma_shift_start time;
  v_oma_shift_end time;

  v_m_id uuid;
  v_m_code text;
  v_m_model text;
  v_m_serial text;
  v_m_hmr numeric;
  v_m_client_id uuid;

  v_c_id uuid;
  v_c_name text;
  v_c_site text;

  v_last_hmr numeric;
  v_last_log jsonb;
  v_shift_codes jsonb := '[]'::jsonb;
BEGIN
  v_operator_id := COALESCE(p_operator_id, auth.uid());

  IF v_operator_id IS NULL THEN
    RETURN jsonb_build_object(
      'operator', NULL,
      'machine', NULL,
      'client', NULL,
      'last_hmr', 0,
      'last_log', NULL,
      'shift_codes', '[]'::jsonb
    );
  END IF;

  -- 1. Fetch Operator Info
  SELECT u.id, u.full_name, u.role, u.shift_start_time, u.shift_end_time
  INTO v_op_id, v_op_name, v_op_role, v_op_shift_start, v_op_shift_end
  FROM public.users u
  WHERE u.id = v_operator_id;

  IF v_op_id IS NULL THEN
    RETURN jsonb_build_object(
      'operator', NULL,
      'machine', NULL,
      'client', NULL,
      'last_hmr', 0,
      'last_log', NULL,
      'shift_codes', '[]'::jsonb
    );
  END IF;

  -- 2. Resolve Active Machine Assignment
  SELECT oma.machine_id, oma.shift_start_time, oma.shift_end_time
  INTO v_assigned_machine_id, v_oma_shift_start, v_oma_shift_end
  FROM public.operator_machine_assignments oma
  WHERE oma.operator_id = v_operator_id AND oma.is_active = true
  ORDER BY oma.assigned_at DESC
  LIMIT 1;

  IF v_assigned_machine_id IS NOT NULL THEN
    IF v_oma_shift_start IS NOT NULL THEN
      v_op_shift_start := v_oma_shift_start;
    END IF;
    IF v_oma_shift_end IS NOT NULL THEN
      v_op_shift_end := v_oma_shift_end;
    END IF;
  ELSE
    SELECT m.id
    INTO v_assigned_machine_id
    FROM public.machines m
    WHERE m.current_operator_id = v_operator_id
       OR v_operator_id = ANY(m.operator_ids)
    ORDER BY m.updated_at DESC
    LIMIT 1;
  END IF;

  -- 3. Resolve Machine Specifications
  IF v_assigned_machine_id IS NOT NULL THEN
    SELECT m.id, m.machine_id, m.model, m.serial_number, m.hour_meter, m.client_id
    INTO v_m_id, v_m_code, v_m_model, v_m_serial, v_m_hmr, v_m_client_id
    FROM public.machines m
    WHERE m.id = v_assigned_machine_id;

    -- 4. Resolve Client and Site
    IF v_m_client_id IS NULL THEN
      SELECT mhl.client_id
      INTO v_m_client_id
      FROM public.machine_hour_logs mhl
      WHERE mhl.machine_id = v_assigned_machine_id AND mhl.client_id IS NOT NULL
      ORDER BY mhl.log_date DESC, mhl.created_at DESC
      LIMIT 1;
    END IF;

    IF v_m_client_id IS NOT NULL THEN
      SELECT c.id, c.company_name,
             COALESCE(
               NULLIF(TRIM(CONCAT_WS(', ',
                 NULLIF(c.street, ''),
                 NULLIF(c.city, ''),
                 NULLIF(c.district, ''),
                 NULLIF(c.state, '')
               )), ''),
               'Base Yard'
             )
      INTO v_c_id, v_c_name, v_c_site
      FROM public.clients c
      WHERE c.id = v_m_client_id;

      -- Fetch active shift codes for this client
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'id', sc.id,
            'client_id', sc.client_id,
            'code', sc.code,
            'name', sc.name,
            'start_time', to_char(sc.start_time, 'HH12:MI AM'),
            'end_time', to_char(sc.end_time, 'HH12:MI AM'),
            'raw_start_time', sc.start_time::text,
            'raw_end_time', sc.end_time::text,
            'crosses_midnight', sc.crosses_midnight,
            'scheduled_minutes', sc.scheduled_minutes,
            'normal_minutes', sc.normal_minutes,
            'default_ot_minutes', sc.scheduled_minutes - sc.normal_minutes
          ) ORDER BY sc.display_order ASC, sc.code ASC
        ),
        '[]'::jsonb
      )
      INTO v_shift_codes
      FROM public.client_shift_codes sc
      WHERE sc.client_id = v_m_client_id AND sc.is_active = true;
    END IF;

    -- 5. Resolve Last Machine Log & HMR
    SELECT jsonb_build_object(
      'id', mhl.id,
      'log_date', mhl.log_date,
      'start_meter', COALESCE(mhl.start_meter, 0),
      'end_meter', COALESCE(mhl.end_meter, 0),
      'start_time', mhl.start_time,
      'end_time', mhl.end_time,
      'running_hours', COALESCE(mhl.running_hours, GREATEST(0, ROUND((mhl.end_meter - mhl.start_meter) * 10) / 10)),
      'normal_working_hours', COALESCE(mhl.normal_working_hours, 8),
      'overtime_hours', COALESCE(mhl.overtime_hours, 0),
      'shift', mhl.shift,
      'shift_code', mhl.shift_code,
      'is_breakdown', COALESCE(mhl.is_breakdown, false),
      'breakdown_duration', mhl.breakdown_duration,
      'operator_id', mhl.operator_id,
      'operator_name', COALESCE(u.full_name, 'Operator')
    ), mhl.end_meter
    INTO v_last_log, v_last_hmr
    FROM public.machine_hour_logs mhl
    LEFT JOIN public.users u ON u.id = mhl.operator_id
    WHERE mhl.machine_id = v_assigned_machine_id
      AND mhl.end_meter IS NOT NULL
    ORDER BY mhl.log_date DESC, mhl.created_at DESC
    LIMIT 1;

    IF v_last_hmr IS NULL THEN
      v_last_hmr := COALESCE(v_m_hmr, 0);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'operator', jsonb_build_object(
      'id', v_op_id,
      'name', v_op_name,
      'role', v_op_role,
      'shift_start', COALESCE(to_char(v_op_shift_start, 'HH12:MI AM'), '06:00 AM'),
      'shift_end', COALESCE(to_char(v_op_shift_end, 'HH12:MI AM'), '02:00 PM'),
      'raw_shift_start', COALESCE(v_op_shift_start::text, '06:00:00'),
      'raw_shift_end', COALESCE(v_op_shift_end::text, '14:00:00')
    ),
    'machine', CASE WHEN v_m_id IS NOT NULL THEN jsonb_build_object(
      'id', v_m_id,
      'machine_id', COALESCE(v_m_code, v_m_id::text),
      'model', v_m_model,
      'serial_number', v_m_serial
    ) ELSE NULL END,
    'client', CASE WHEN v_c_id IS NOT NULL THEN jsonb_build_object(
      'id', v_c_id,
      'company_name', v_c_name,
      'site', COALESCE(v_c_site, 'Base Yard')
    ) ELSE NULL END,
    'last_hmr', COALESCE(v_last_hmr, 0),
    'last_log', v_last_log,
    'shift_codes', v_shift_codes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_operator_entry_context(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_operator_entry_context(uuid) TO authenticated, service_role;

-- 6. Update get_operation_logs to project shift_code and shift_scheduled_minutes
CREATE OR REPLACE FUNCTION public.get_operation_logs(
  "view" text DEFAULT 'machine',
  machine_id uuid DEFAULT NULL,
  client_id uuid DEFAULT NULL,
  operator_id uuid DEFAULT NULL,
  start_date date DEFAULT NULL,
  end_date date DEFAULT NULL,
  search text DEFAULT NULL,
  cursor text DEFAULT NULL,
  "limit" integer DEFAULT 20,
  site text DEFAULT NULL,
  shift text DEFAULT NULL,
  breakdown_only boolean DEFAULT FALSE,
  page integer DEFAULT NULL,
  p_view text DEFAULT NULL,
  p_machine_id uuid DEFAULT NULL,
  p_client_id uuid DEFAULT NULL,
  p_operator_id uuid DEFAULT NULL,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_cursor text DEFAULT NULL,
  p_limit integer DEFAULT NULL,
  p_site text DEFAULT NULL,
  p_shift text DEFAULT NULL,
  p_breakdown_only boolean DEFAULT NULL,
  p_page integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_effective_view text;
  v_effective_machine_id uuid;
  v_effective_client_id uuid;
  v_effective_operator_id uuid;
  v_effective_start_date date;
  v_effective_end_date date;
  v_effective_search text;
  v_effective_cursor text;
  v_effective_limit integer;
  v_effective_site text;
  v_effective_shift text;
  v_effective_breakdown boolean;
  v_effective_page integer;

  v_b64 text;
  v_cursor_json jsonb;
  v_cursor_date date;
  v_cursor_created timestamptz;
  v_cursor_id uuid;
  v_offset integer := 0;

  v_total bigint := 0;
  v_next_cursor text := NULL;
  v_rows jsonb := '[]'::jsonb;
  v_rec_count integer := 0;

  v_last_log_date date;
  v_last_created_at timestamptz;
  v_last_id uuid;
BEGIN
  -- 1. Harmonize parameter aliases
  v_effective_view := lower(trim(COALESCE(p_view, "view", 'machine')));
  v_effective_machine_id := COALESCE(p_machine_id, machine_id);
  v_effective_client_id := COALESCE(p_client_id, client_id);
  v_effective_operator_id := COALESCE(p_operator_id, operator_id);
  v_effective_start_date := COALESCE(p_start_date, start_date);
  v_effective_end_date := COALESCE(p_end_date, end_date);
  v_effective_search := NULLIF(trim(COALESCE(p_search, search)), '');
  v_effective_cursor := NULLIF(trim(COALESCE(p_cursor, cursor)), '');
  v_effective_limit := GREATEST(1, LEAST(100, COALESCE(p_limit, "limit", 20)));
  v_effective_site := NULLIF(trim(COALESCE(p_site, site)), '');
  v_effective_shift := NULLIF(trim(COALESCE(p_shift, shift)), '');
  v_effective_breakdown := COALESCE(p_breakdown_only, breakdown_only, FALSE);
  v_effective_page := COALESCE(p_page, page);

  -- 2. Decode cursor if provided
  IF v_effective_cursor IS NOT NULL THEN
    BEGIN
      IF v_effective_cursor LIKE '{%' THEN
        v_cursor_json := v_effective_cursor::jsonb;
        v_cursor_date := (v_cursor_json->>'d')::date;
        v_cursor_created := (v_cursor_json->>'c')::timestamptz;
        v_cursor_id := (v_cursor_json->>'id')::uuid;
      ELSIF v_effective_cursor NOT LIKE '%|%' THEN
        BEGIN
          v_b64 := replace(replace(replace(replace(v_effective_cursor, E'\n', ''), E'\r', ''), '-', '+'), '_', '/');
          WHILE length(v_b64) % 4 <> 0 LOOP
            v_b64 := v_b64 || '=';
          END LOOP;
          v_cursor_json := convert_from(decode(v_b64, 'base64'), 'UTF8')::jsonb;
          v_cursor_date := (v_cursor_json->>'d')::date;
          v_cursor_created := (v_cursor_json->>'c')::timestamptz;
          v_cursor_id := (v_cursor_json->>'id')::uuid;
        EXCEPTION WHEN OTHERS THEN
          v_cursor_date := split_part(v_effective_cursor, '|', 1)::date;
          v_cursor_created := split_part(v_effective_cursor, '|', 2)::timestamptz;
          v_cursor_id := split_part(v_effective_cursor, '|', 3)::uuid;
        END;
      ELSE
        v_cursor_date := split_part(v_effective_cursor, '|', 1)::date;
        v_cursor_created := split_part(v_effective_cursor, '|', 2)::timestamptz;
        v_cursor_id := split_part(v_effective_cursor, '|', 3)::uuid;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_cursor_date := NULL;
      v_cursor_created := NULL;
      v_cursor_id := NULL;
    END;
  END IF;

  IF v_effective_page IS NOT NULL AND v_effective_page > 1 AND v_effective_cursor IS NULL THEN
    v_offset := (v_effective_page - 1) * v_effective_limit;
  END IF;

  -- 3. Calculate filtered count
  SELECT COUNT(*)
  INTO v_total
  FROM public.machine_hour_logs mhl
  LEFT JOIN public.machines m ON m.id = mhl.machine_id
  LEFT JOIN public.clients c ON c.id = mhl.client_id
  LEFT JOIN public.users u ON u.id = mhl.operator_id
  WHERE (v_effective_machine_id IS NULL OR mhl.machine_id = v_effective_machine_id)
    AND (v_effective_client_id IS NULL OR mhl.client_id = v_effective_client_id)
    AND (v_effective_operator_id IS NULL OR mhl.operator_id = v_effective_operator_id)
    AND (v_effective_start_date IS NULL OR mhl.log_date >= v_effective_start_date)
    AND (v_effective_end_date IS NULL OR mhl.log_date <= v_effective_end_date)
    AND (v_effective_shift IS NULL OR mhl.shift = v_effective_shift OR mhl.shift_code = v_effective_shift)
    AND (v_effective_breakdown IS FALSE OR mhl.is_breakdown = TRUE)
    AND (v_effective_site IS NULL OR mhl.location ILIKE '%' || v_effective_site || '%')
    AND (
      v_effective_search IS NULL OR
      m.machine_id ILIKE '%' || v_effective_search || '%' OR
      m.model ILIKE '%' || v_effective_search || '%' OR
      c.company_name ILIKE '%' || v_effective_search || '%' OR
      u.full_name ILIKE '%' || v_effective_search || '%'
    );

  -- 4. Paged keyset query
  WITH paged_ids AS (
    SELECT mhl.id
    FROM public.machine_hour_logs mhl
    LEFT JOIN public.machines m ON m.id = mhl.machine_id
    LEFT JOIN public.clients c ON c.id = mhl.client_id
    LEFT JOIN public.users u ON u.id = mhl.operator_id
    WHERE (v_effective_machine_id IS NULL OR mhl.machine_id = v_effective_machine_id)
      AND (v_effective_client_id IS NULL OR mhl.client_id = v_effective_client_id)
      AND (v_effective_operator_id IS NULL OR mhl.operator_id = v_effective_operator_id)
      AND (v_effective_start_date IS NULL OR mhl.log_date >= v_effective_start_date)
      AND (v_effective_end_date IS NULL OR mhl.log_date <= v_effective_end_date)
      AND (v_effective_shift IS NULL OR mhl.shift = v_effective_shift OR mhl.shift_code = v_effective_shift)
      AND (v_effective_breakdown IS FALSE OR mhl.is_breakdown = TRUE)
      AND (v_effective_site IS NULL OR mhl.location ILIKE '%' || v_effective_site || '%')
      AND (
        v_effective_search IS NULL OR
        m.machine_id ILIKE '%' || v_effective_search || '%' OR
        m.model ILIKE '%' || v_effective_search || '%' OR
        c.company_name ILIKE '%' || v_effective_search || '%' OR
        u.full_name ILIKE '%' || v_effective_search || '%'
      )
      AND (
        v_cursor_date IS NULL OR
        (mhl.log_date, mhl.created_at, mhl.id) < (v_cursor_date, v_cursor_created, v_cursor_id)
      )
    ORDER BY mhl.log_date DESC, mhl.created_at DESC, mhl.id DESC
    OFFSET v_offset
    LIMIT (v_effective_limit + 1)
  ),
  hydrated_results AS (
    SELECT
      mhl.id,
      mhl.machine_id,
      mhl.client_id,
      mhl.operator_id,
      mhl.log_date,
      mhl.start_time,
      mhl.end_time,
      mhl.start_meter,
      mhl.end_meter,
      mhl.running_hours,
      mhl.normal_working_hours,
      mhl.overtime_hours,
      mhl.is_breakdown,
      mhl.shift,
      mhl.shift_code,
      mhl.shift_scheduled_minutes,
      mhl.location,
      mhl.remarks,
      mhl.conflict_flag,
      mhl.conflict_reason,
      mhl.conflict_status,
      mhl.created_at,
      COALESCE(m.machine_id, '') AS machine_code,
      COALESCE(m.model, '') AS machine_model,
      COALESCE(m.serial_number, '') AS machine_serial,
      COALESCE(c.company_name, '') AS client_name,
      COALESCE(u.full_name, '') AS operator_name,
      COALESCE(u.phone, '') AS operator_phone,
      ROW_NUMBER() OVER () AS page_row_num
    FROM paged_ids p
    JOIN public.machine_hour_logs mhl ON mhl.id = p.id
    LEFT JOIN public.machines m ON m.id = mhl.machine_id
    LEFT JOIN public.clients c ON c.id = mhl.client_id
    LEFT JOIN public.users u ON u.id = mhl.operator_id
    ORDER BY mhl.log_date DESC, mhl.created_at DESC, mhl.id DESC
  )
  SELECT
    (SELECT COUNT(*) FROM hydrated_results),
    (SELECT log_date FROM hydrated_results WHERE page_row_num = v_effective_limit),
    (SELECT created_at FROM hydrated_results WHERE page_row_num = v_effective_limit),
    (SELECT id FROM hydrated_results WHERE page_row_num = v_effective_limit),
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', h.id,
            'machine_id', h.machine_id,
            'client_id', h.client_id,
            'operator_id', h.operator_id,
            'log_date', h.log_date,
            'start_time', h.start_time,
            'end_time', h.end_time,
            'start_meter', h.start_meter,
            'end_meter', h.end_meter,
            'running_hours', h.running_hours,
            'normal_working_hours', h.normal_working_hours,
            'overtime_hours', h.overtime_hours,
            'is_breakdown', h.is_breakdown,
            'shift', h.shift,
            'shift_code', h.shift_code,
            'shift_scheduled_minutes', h.shift_scheduled_minutes,
            'location', h.location,
            'remarks', h.remarks,
            'conflict_flag', h.conflict_flag,
            'conflict_reason', h.conflict_reason,
            'conflict_status', h.conflict_status,
            'created_at', h.created_at,
            'machine_code', h.machine_code,
            'machine_model', h.machine_model,
            'machine_serial', h.machine_serial,
            'client_name', h.client_name,
            'operator_name', h.operator_name,
            'operator_phone', h.operator_phone,
            'machine', jsonb_build_object(
              'id', h.machine_id,
              'machine_code', h.machine_code,
              'model', h.machine_model,
              'serial_number', h.machine_serial
            ),
            'client', jsonb_build_object(
              'id', h.client_id,
              'company_name', h.client_name,
              'client_name', h.client_name
            ),
            'operator', jsonb_build_object(
              'id', h.operator_id,
              'full_name', h.operator_name,
              'phone', h.operator_phone
            )
          )
          ORDER BY h.page_row_num
        )
        FROM hydrated_results h
        WHERE h.page_row_num <= v_effective_limit
      ),
      '[]'::jsonb
    )
  INTO
    v_rec_count,
    v_last_log_date,
    v_last_created_at,
    v_last_id,
    v_rows;

  -- 5. Format nextCursor if there is an extra row
  IF v_rec_count > v_effective_limit AND v_last_id IS NOT NULL THEN
    v_next_cursor := rtrim(replace(replace(replace(replace(encode(convert_to(jsonb_build_object(
      'd', v_last_log_date,
      'c', to_char(v_last_created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'id', v_last_id
    )::text, 'UTF8'), 'base64'), E'\n', ''), E'\r', ''), '+', '-'), '/', '_'), '=');
  ELSE
    v_next_cursor := NULL;
  END IF;

  RETURN jsonb_build_object(
    'rows', v_rows,
    'nextCursor', v_next_cursor,
    'total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_operation_logs TO authenticated, anon, service_role;

