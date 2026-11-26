-- ============================================
-- Migration 242: Admin-only bulk machine logsheet (machine_hour_logs) Excel import
--
-- 1. public.machine_log_imports  — immutable import audit / history + idempotency anchor
-- 2. public.import_machine_hour_logs_bulk(jsonb) — atomic, admin-only, SECURITY DEFINER
--    bulk insert RPC (all-or-nothing, verified commit, idempotent by import token)
-- 3. Transaction-local notification suppression for bulk backfills (guards added to
--    the two log notification producers so historical imports do not storm inboxes)
--
-- Security model:
--   * The RPC re-verifies the caller's real role (active admin / super_admin) from
--     public.users — never a client-supplied claim.
--   * Machine identity is resolved server-side; spreadsheet values are never used
--     as trusted database identifiers.
--   * RLS stays enabled on machine_hour_logs; the definer function performs the
--     inserts under narrowly scoped privileges (no service-role key exposure).
-- ============================================

-- 1. IMPORT AUDIT / HISTORY TABLE --------------------------------------------

CREATE TABLE IF NOT EXISTS public.machine_log_imports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Client-generated token: repeated confirmations of the same prepared import
  -- are idempotent (unique index below) and can never double-insert records.
  import_token          TEXT NOT NULL UNIQUE,
  admin_user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  machine_id            UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  filename              TEXT,
  file_checksum         TEXT,
  template_version      TEXT,
  total_rows            INTEGER NOT NULL DEFAULT 0,
  imported_rows         INTEGER NOT NULL DEFAULT 0,
  skipped_duplicates    INTEGER NOT NULL DEFAULT 0,
  rejected_rows         INTEGER NOT NULL DEFAULT 0,
  total_running_hours   NUMERIC NOT NULL DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'completed'
                        CHECK (status IN ('completed', 'failed')),
  failure_details       JSONB,
  inserted_log_ids      UUID[] NOT NULL DEFAULT '{}',
  processing_duration_ms INTEGER,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_machine_log_imports_machine_created
  ON public.machine_log_imports (machine_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_machine_log_imports_admin_created
  ON public.machine_log_imports (admin_user_id, created_at DESC);

ALTER TABLE public.machine_log_imports ENABLE ROW LEVEL SECURITY;

-- Read-only for administrators. There are intentionally NO insert/update/delete
-- policies: rows are written exclusively by the SECURITY DEFINER RPC below.
DROP POLICY IF EXISTS "Admins can view logsheet imports" ON public.machine_log_imports;
CREATE POLICY "Admins can view logsheet imports" ON public.machine_log_imports
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('super_admin', 'admin'));

-- 2. BULK-IMPORT NOTIFICATION SUPPRESSION -------------------------------------
-- Historical backfills must not enqueue one notification per imported row.
-- The bulk import RPC sets reach.suppress_log_notifications for its transaction
-- only ('set_config(..., true)'); every other write path is completely unaffected.

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
  -- Bulk logsheet import backfill: suppress per-row notification noise.
  IF COALESCE(current_setting('reach.suppress_log_notifications', true), '') = '1' THEN
    RETURN NEW;
  END IF;

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
  -- Bulk logsheet import backfill: suppress per-row notification noise.
  IF COALESCE(current_setting('reach.suppress_log_notifications', true), '') = '1' THEN
    RETURN NEW;
  END IF;

  -- Only trigger if entered_by is distinct from operator_id (assisted entry on behalf of operator)
  IF NEW.entered_by IS NOT NULL AND NEW.operator_id IS NOT NULL AND NEW.entered_by <> NEW.operator_id THEN
    -- Resolve machine display code
    SELECT machine_id INTO v_machine_code FROM public.machines WHERE id = NEW.machine_id;

    -- Resolve supervisor / submitter display name
    SELECT full_name INTO v_supervisor_name FROM public.users WHERE id = NEW.entered_by;

    v_running_hrs := COALESCE(NEW.running_hours, GREATEST(0, ROUND((NEW.end_meter - NEW.start_meter)::numeric, 1)));

    -- Insert persistent notification for the target operator
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

-- 2b. CANONICAL SHIFT-CODE EQUIVALENCE KEY -----------------------------------
-- Mirrors `shiftCodeKey()` in @reachinternational/validation: strips a leading
-- "shift" word, then maps human-readable aliases to the same equivalence classes
-- the Operations UI uses (A↔S1, B↔S2, C↔S3, D↔S4, bare digits 1-4). Keeps the
-- RPC's duplicate pre-check consistent with preview-time duplicate detection
-- ("A" and "S1" are the same shift identity).
CREATE OR REPLACE FUNCTION public.logsheet_shift_key(p_code text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = 'public', 'pg_temp'
AS $function$
  SELECT CASE
    WHEN v ~ '^[A-D]$' THEN 's' || (ascii(v) - ascii('A') + 1)::text
    WHEN v ~ '^[1-4]$' THEN 's' || v
    ELSE lower(v)
  END
  FROM (SELECT upper(trim(regexp_replace(COALESCE(p_code, ''), '^shift\s*', '', 'i'))) AS v) s;
$function$;
REVOKE EXECUTE ON FUNCTION public.logsheet_shift_key(text) FROM PUBLIC, anon;

-- 3. ATOMIC ADMIN-ONLY BULK IMPORT RPC ---------------------------------------
-- p_import payload:
-- {
--   "import_token":   "client-generated idempotency token",
--   "machine_id":     "uuid of the machine selected in the UI (server-verified)",
--   "filename":       "original upload filename (audit only)",
--   "file_checksum":  "sha256 of the uploaded workbook (audit only)",
--   "template_version": "1.0",
--   "rows": [ { "row_number", "operator_id", "log_date", "shift_code",
--               "start_time", "end_time", "start_meter", "end_meter",
--               "overtime_hours", "normal_working_hours", "machine_condition",
--               "is_breakdown", "breakdown_start_time", "breakdown_end_time",
--               "breakdown_duration", "breakdown_hours", "remarks", "location" } ]
-- }
-- Behaviour: one transaction — either every row is inserted and verified, or
-- nothing is. Retries with the same import_token return the original result.

CREATE OR REPLACE FUNCTION public.import_machine_hour_logs_bulk(p_import jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_actor_id       uuid;
  v_actor_role     text;
  v_machine_id     uuid;
  v_machine_row    RECORD;
  v_import_token   text;
  v_filename       text;
  v_checksum       text;
  v_template_ver   text;
  v_rows           jsonb;
  v_row_count      integer;
  v_total_file_rows integer;
  v_skipped_dupes  integer;
  v_rejected_rows  integer;
  v_import_id      uuid;
  v_inserted_ids   uuid[] := '{}';
  v_log_id         uuid;
  v_total_hours    numeric := 0;
  v_started_ms     bigint;
  v_existing       RECORD;
  r                RECORD;
  v_log_date       date;
  v_end_date       date;
  v_start_time     time;
  v_end_time       time;
  v_start_meter    numeric;
  v_end_meter      numeric;
  v_shift_code     text;
  v_operator_id    uuid;
  v_client_id      uuid;
  v_site_id        uuid;
  v_location       text;
  v_assignment_id  uuid;
  v_overtime       numeric;
  v_normal_hours   numeric;
  v_is_breakdown   boolean;
  v_bkd_start      time;
  v_bkd_end        time;
  v_bkd_duration   text;
  v_bkd_hours      numeric;
  v_condition      text;
  v_remarks        text;
  v_running_hours  numeric;
BEGIN
  v_started_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint;

  -- A. Authorize the ACTUAL caller role from public.users (never client claims)
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized to import machine logs.' USING ERRCODE = '42501';
  END IF;
  SELECT role INTO v_actor_role FROM public.users WHERE id = v_actor_id AND status = 'active';
  IF v_actor_role IS NULL OR v_actor_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Not authorized: only administrators can bulk import machine logs.' USING ERRCODE = '42501';
  END IF;

  -- B. Validate envelope
  v_import_token := TRIM(COALESCE(p_import->>'import_token', ''));
  v_machine_id   := NULLIF(TRIM(COALESCE(p_import->>'machine_id', '')), '')::uuid;
  v_filename     := LEFT(COALESCE(p_import->>'filename', ''), 255);
  v_checksum     := LEFT(COALESCE(p_import->>'file_checksum', ''), 128);
  v_template_ver := LEFT(COALESCE(p_import->>'template_version', ''), 20);
  v_rows         := COALESCE(p_import->'rows', '[]'::jsonb);

  IF v_import_token = '' OR length(v_import_token) > 120 THEN
    RAISE EXCEPTION 'Import token is required.' USING ERRCODE = '22023';
  END IF;
  IF v_machine_id IS NULL THEN
    RAISE EXCEPTION 'A valid machine must be selected for the import.' USING ERRCODE = '22023';
  END IF;

  -- C. Idempotency: a repeated confirmation returns the original committed result
  SELECT * INTO v_existing FROM public.machine_log_imports WHERE import_token = v_import_token;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_imported', true,
      'import_id', v_existing.id,
      'machine_id', v_existing.machine_id,
      'imported_rows', v_existing.imported_rows,
      'inserted_log_ids', to_jsonb(v_existing.inserted_log_ids),
      'total_running_hours', v_existing.total_running_hours
    );
  END IF;

  SELECT id, client_id, site_id, hour_meter INTO v_machine_row FROM public.machines WHERE id = v_machine_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected machine no longer exists.' USING ERRCODE = '23503';
  END IF;
  v_client_id := v_machine_row.client_id;

  v_row_count := jsonb_array_length(v_rows);
  IF v_row_count < 1 OR v_row_count > 1000 THEN
    RAISE EXCEPTION 'Import must contain between 1 and 1000 rows (received %).', v_row_count
      USING ERRCODE = '22023';
  END IF;

  -- File-level audit counts (rows excluded as duplicates / rejected before import)
  v_total_file_rows := COALESCE((p_import->>'total_file_rows')::integer, v_row_count);
  v_skipped_dupes   := COALESCE((p_import->>'skipped_duplicates')::integer, 0);
  v_rejected_rows   := COALESCE((p_import->>'rejected_rows')::integer, 0);

  -- D. Pass 1 — validate every row before inserting anything
  FOR r IN SELECT elem FROM jsonb_array_elements(v_rows) AS t(elem) LOOP
    BEGIN
      v_operator_id := NULLIF(TRIM(COALESCE(r.elem->>'operator_id', '')), '')::uuid;
      v_log_date    := (r.elem->>'log_date')::date;
      v_start_time  := (r.elem->>'start_time')::time;
      v_end_time    := (r.elem->>'end_time')::time;
      v_start_meter := (r.elem->>'start_meter')::numeric;
      v_end_meter   := (r.elem->>'end_meter')::numeric;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Row %: contains an invalid date, time or meter value.', COALESCE(r.elem->>'row_number', '?')
        USING ERRCODE = '22023';
    END;

    IF v_operator_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.users u WHERE u.id = v_operator_id AND u.status = 'active'
    ) THEN
      RAISE EXCEPTION 'Row %: operator could not be resolved to an active user.', COALESCE(r.elem->>'row_number', '?')
        USING ERRCODE = '23503';
    END IF;

    IF v_log_date IS NULL OR v_log_date > (NOW() AT TIME ZONE 'Asia/Kolkata')::date THEN
      RAISE EXCEPTION 'Row %: log date is missing or in the future.', COALESCE(r.elem->>'row_number', '?')
        USING ERRCODE = '22023';
    END IF;

    IF v_start_meter < 0 OR v_end_meter < 0 OR v_end_meter < v_start_meter
       OR (v_end_meter - v_start_meter) > 24 THEN
      RAISE EXCEPTION 'Row %: hour meter readings are invalid (negative, regressing, or over 24 running hours).',
        COALESCE(r.elem->>'row_number', '?') USING ERRCODE = '22003';
    END IF;

    -- Duplicate guards matching the database uniqueness rules (all-or-nothing abort)
    v_shift_code := COALESCE(NULLIF(TRIM(COALESCE(r.elem->>'shift_code', '')), ''), 'S1');
    IF EXISTS (
      SELECT 1 FROM public.machine_hour_logs l
      WHERE l.machine_id = v_machine_id
        AND l.log_date = v_log_date
        AND public.logsheet_shift_key(COALESCE(l.shift_code, ''))
            = public.logsheet_shift_key(v_shift_code)
    ) THEN
      RAISE EXCEPTION 'Row %: a log for shift % on % already exists for this machine.',
        COALESCE(r.elem->>'row_number', '?'), v_shift_code, v_log_date USING ERRCODE = '23505';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.machine_hour_logs l
      WHERE l.operator_id = v_operator_id
        AND l.log_date = v_log_date
        AND public.logsheet_shift_key(COALESCE(l.shift_code, ''))
            = public.logsheet_shift_key(v_shift_code)
    ) THEN
      RAISE EXCEPTION 'Row %: the operator already has a log for shift % on %.',
        COALESCE(r.elem->>'row_number', '?'), v_shift_code, v_log_date USING ERRCODE = '23505';
    END IF;
  END LOOP;

  -- E. Pass 2 — insert all rows in this single transaction
  PERFORM set_config('reach.suppress_log_notifications', '1', true);

  FOR r IN SELECT elem FROM jsonb_array_elements(v_rows) AS t(elem) LOOP
    v_operator_id  := NULLIF(TRIM(COALESCE(r.elem->>'operator_id', '')), '')::uuid;
    v_log_date     := (r.elem->>'log_date')::date;
    v_start_time   := (r.elem->>'start_time')::time;
    v_end_time     := (r.elem->>'end_time')::time;
    v_start_meter  := (r.elem->>'start_meter')::numeric;
    v_end_meter    := (r.elem->>'end_meter')::numeric;
    v_shift_code   := COALESCE(NULLIF(TRIM(COALESCE(r.elem->>'shift_code', '')), ''), 'S1');
    v_overtime     := COALESCE((r.elem->>'overtime_hours')::numeric, 0);
    v_normal_hours := COALESCE((r.elem->>'normal_working_hours')::numeric, 8);
    v_is_breakdown := COALESCE((r.elem->>'is_breakdown')::boolean, false);
    v_bkd_start    := NULLIF(TRIM(COALESCE(r.elem->>'breakdown_start_time', '')), '')::time;
    v_bkd_end      := NULLIF(TRIM(COALESCE(r.elem->>'breakdown_end_time', '')), '')::time;
    v_bkd_duration := NULLIF(LEFT(COALESCE(r.elem->>'breakdown_duration', ''), 100), '');
    v_bkd_hours    := COALESCE((r.elem->>'breakdown_hours')::numeric, 0);
    v_condition    := COALESCE(NULLIF(TRIM(COALESCE(r.elem->>'machine_condition', '')), ''), 'good');
    v_remarks      := NULLIF(LEFT(COALESCE(r.elem->>'remarks', ''), 500), '');
    v_location     := NULLIF(LEFT(COALESCE(r.elem->>'location', ''), 255), '');
    v_running_hours := v_end_meter - v_start_meter;

    -- End date: overnight shifts roll into the next day (same rule as the manual flow)
    IF v_end_time <= v_start_time THEN
      v_end_date := v_log_date + 1;
    ELSE
      v_end_date := v_log_date;
    END IF;

    -- Location fallback from the machine's client address (same as manual entry)
    IF v_location IS NULL AND v_client_id IS NOT NULL THEN
      SELECT NULLIF(BTRIM(CONCAT_WS(', ', c.city, c.district, c.state)), '')
      INTO v_location
      FROM public.clients c WHERE c.id = v_client_id;
    END IF;

    -- Site resolution: the machine's site when it belongs to the same client
    v_site_id := NULL;
    IF v_machine_row.site_id IS NOT NULL AND v_client_id IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.client_sites cs
        WHERE cs.id = v_machine_row.site_id AND cs.client_id = v_client_id
      ) THEN
        v_site_id := v_machine_row.site_id;
      END IF;
    END IF;
    IF v_site_id IS NULL AND v_client_id IS NOT NULL THEN
      SELECT cs.id INTO v_site_id
      FROM public.client_sites cs
      WHERE cs.client_id = v_client_id
      ORDER BY cs.created_at ASC
      LIMIT 1;
    END IF;

    -- Assignment linkage: only link an EXACT shift-matched assignment range so the
    -- shift monitor recognises the imported record; otherwise leave NULL
    -- (historical gaps without assignments are the reason for this import).
    SELECT oma.id INTO v_assignment_id
    FROM public.operator_machine_assignments oma
    WHERE oma.machine_id = v_machine_id
      AND oma.operator_id = v_operator_id
      AND oma.valid_from <= v_log_date
      AND (oma.valid_to IS NULL OR oma.valid_to >= v_log_date)
      AND public.logsheet_shift_key(COALESCE(oma.shift_code, ''))
          = public.logsheet_shift_key(v_shift_code)
    ORDER BY oma.valid_from DESC
    LIMIT 1;

    -- running_hours is a GENERATED column (end_meter - start_meter): never inserted directly
    INSERT INTO public.machine_hour_logs (
      machine_id, operator_id, client_id, site_id, assignment_id,
      log_date, end_date, start_time, end_time,
      start_meter, end_meter,
      shift, shift_code, normal_working_hours, overtime_hours,
      is_breakdown, breakdown_start_time, breakdown_end_time,
      breakdown_duration, breakdown_hours, breakdown_minutes,
      machine_condition, location, remarks,
      entered_by, entry_source, idempotency_key
    ) VALUES (
      v_machine_id, v_operator_id, v_client_id, v_site_id, v_assignment_id,
      v_log_date, v_end_date, v_start_time, v_end_time,
      v_start_meter, v_end_meter,
      'Shift ' || v_shift_code, v_shift_code, v_normal_hours, v_overtime,
      v_is_breakdown, v_bkd_start, v_bkd_end,
      v_bkd_duration, v_bkd_hours,
      CASE WHEN v_is_breakdown THEN ROUND(v_bkd_hours * 60)::integer ELSE 0 END,
      v_condition, v_location, v_remarks,
      v_actor_id,
      CASE WHEN v_actor_role = 'super_admin' THEN 'super_admin' ELSE 'admin' END,
      format('imp_%s_%s', v_import_token, COALESCE(r.elem->>'row_number', '0'))
    ) RETURNING id INTO v_log_id;

    v_inserted_ids := v_inserted_ids || v_log_id;
    v_total_hours  := v_total_hours + v_running_hours;
  END LOOP;

  -- F. Machine hour meter: non-regressing advance only (never current operator/health)
  UPDATE public.machines
  SET hour_meter = GREATEST(COALESCE(hour_meter, 0),
                            (SELECT MAX((elem->>'end_meter')::numeric)
                             FROM jsonb_array_elements(v_rows) AS t(elem))),
      updated_at = NOW()
  WHERE id = v_machine_id;

  -- G. Verify the committed records inside the same transaction
  IF (SELECT COUNT(*) FROM public.machine_hour_logs l WHERE l.id = ANY(v_inserted_ids)) <> v_row_count THEN
    RAISE EXCEPTION 'Import verification failed: not all records were committed.' USING ERRCODE = 'P0001';
  END IF;

  -- H. Audit record (machine_log_imports is written only here)
  INSERT INTO public.machine_log_imports (
    import_token, admin_user_id, machine_id, filename, file_checksum, template_version,
    total_rows, imported_rows, skipped_duplicates, rejected_rows, total_running_hours,
    status, inserted_log_ids, processing_duration_ms
  ) VALUES (
    v_import_token, v_actor_id, v_machine_id, v_filename, v_checksum, v_template_ver,
    v_total_file_rows, v_row_count, v_skipped_dupes, v_rejected_rows, v_total_hours,
    'completed', v_inserted_ids,
    ((EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::bigint - v_started_ms)::integer
  ) RETURNING id INTO v_import_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_imported', false,
    'import_id', v_import_id,
    'machine_id', v_machine_id,
    'imported_rows', v_row_count,
    'inserted_log_ids', to_jsonb(v_inserted_ids),
    'total_running_hours', v_total_hours
  );
END;
$function$;

-- Only authenticated sessions may execute; the function itself re-checks the role.
REVOKE EXECUTE ON FUNCTION public.import_machine_hour_logs_bulk(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.import_machine_hour_logs_bulk(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.import_machine_hour_logs_bulk(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.import_machine_hour_logs_bulk(jsonb) TO service_role;
