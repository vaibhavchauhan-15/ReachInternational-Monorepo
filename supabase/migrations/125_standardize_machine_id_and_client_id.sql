-- ==============================================================================
-- Migration 125: Standardize Machine ID (M/C-XXXX) and Client ID (CLI-XXXX)
-- 
-- 1. Updates machine ID format from RI-MC-XXXX to M/C-XXXX (e.g. M/C-0001, M/C-0002).
-- 2. Makes machine_id strictly unique, not-null, and immutable via database trigger.
-- 3. Updates generate_machine_id() sequence trigger to auto-assign M/C-XXXX format.
-- 4. Creates client_id column on public.clients, backfills existing clients (CLI-XXXX).
-- 5. Makes client_id strictly unique, not-null, and immutable via database trigger.
-- 6. Updates generate_client_code() to auto-assign and synchronize client_id and code.
-- 7. Upgrades get_today_shift_log_monitor RPC to project client_code (CLI-XXXX).
-- ==============================================================================

-- -----------------------------------------------------------------------------
-- 1. MACHINES: Update ID format to M/C-XXXX and enforce immutability & uniqueness
-- -----------------------------------------------------------------------------

-- 1.1 Update all existing machines from RI-MC-XXXX to M/C-XXXX
UPDATE public.machines
SET machine_id = REPLACE(machine_id, 'RI-MC-', 'M/C-'),
    updated_at = NOW()
WHERE machine_id LIKE 'RI-MC-%';

-- 1.2 Update the auto-generation trigger function for machine_id
CREATE OR REPLACE FUNCTION public.generate_machine_id()
RETURNS TRIGGER AS $$
DECLARE
  seq_val BIGINT;
  candidate_id TEXT;
BEGIN
  IF NEW.machine_id IS NULL OR TRIM(NEW.machine_id) = '' THEN
    LOOP
      seq_val := nextval('public.machines_id_seq');
      candidate_id := 'M/C-' || lpad(seq_val::text, 4, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.machines WHERE machine_id = candidate_id);
    END LOOP;
    NEW.machine_id := candidate_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1.3 Sync the sequence with the highest existing M/C-XXXX number
SELECT setval(
  'public.machines_id_seq',
  COALESCE(
    (SELECT MAX(SUBSTRING(machine_id FROM 5)::bigint)
     FROM public.machines
     WHERE machine_id ~ '^M/C-[0-9]+$'),
    1
  )
);

-- 1.4 Ensure unique constraint & not-null on machine_id
ALTER TABLE public.machines ALTER COLUMN machine_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_machines_machine_id_unique ON public.machines(machine_id);

-- 1.5 Enforce immutability of machine_id on UPDATE
CREATE OR REPLACE FUNCTION public.enforce_machine_id_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.machine_id IS NOT NULL AND NEW.machine_id IS DISTINCT FROM OLD.machine_id THEN
    RAISE EXCEPTION 'Machine ID is immutable and cannot be changed (current: %, attempted: %)', OLD.machine_id, NEW.machine_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_machine_id_immutable ON public.machines;
CREATE TRIGGER trg_enforce_machine_id_immutable
  BEFORE UPDATE ON public.machines
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_machine_id_immutable();

-- -----------------------------------------------------------------------------
-- 2. CLIENTS: Add client_id column, backfill, and enforce immutability & uniqueness
-- -----------------------------------------------------------------------------

-- 2.1 Add client_id column to public.clients if it does not exist
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS client_id TEXT;

-- 2.2 Backfill client_id from existing code (CLI-0001, CLI-0002, etc.)
UPDATE public.clients
SET client_id = code
WHERE client_id IS NULL OR client_id = '';

-- 2.3 Enforce NOT NULL and UNIQUE on client_id
ALTER TABLE public.clients ALTER COLUMN client_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_client_id_unique ON public.clients(client_id);

-- 2.4 Create sequence for client IDs if not exists and align to max assigned number
CREATE SEQUENCE IF NOT EXISTS public.clients_client_id_seq START WITH 1 INCREMENT BY 1;
SELECT setval(
  'public.clients_client_id_seq',
  COALESCE(
    (SELECT MAX(SUBSTRING(client_id FROM 5)::bigint)
     FROM public.clients
     WHERE client_id ~ '^CLI-[0-9]+$'),
    1
  )
);

-- 2.5 Synchronize generate_client_code() to auto-assign both code and client_id
CREATE OR REPLACE FUNCTION public.generate_client_code()
RETURNS TRIGGER AS $$
DECLARE
  seq_val BIGINT;
  candidate_code TEXT;
BEGIN
  IF (NEW.code IS NULL OR TRIM(NEW.code) = '') AND (NEW.client_id IS NULL OR TRIM(NEW.client_id) = '') THEN
    LOOP
      seq_val := nextval('public.clients_code_seq');
      candidate_code := 'CLI-' || lpad(seq_val::text, 4, '0');
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.clients 
        WHERE code = candidate_code OR client_id = candidate_code
      );
    END LOOP;
    NEW.code := candidate_code;
    NEW.client_id := candidate_code;
  ELSIF NEW.client_id IS NULL OR TRIM(NEW.client_id) = '' THEN
    NEW.client_id := NEW.code;
  ELSIF NEW.code IS NULL OR TRIM(NEW.code) = '' THEN
    NEW.code := NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2.6 Enforce immutability of client_id on UPDATE
CREATE OR REPLACE FUNCTION public.enforce_client_id_immutable()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.client_id IS NOT NULL AND NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    RAISE EXCEPTION 'Client ID is immutable and cannot be changed (current: %, attempted: %)', OLD.client_id, NEW.client_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_client_id_immutable ON public.clients;
CREATE TRIGGER trg_enforce_client_id_immutable
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_client_id_immutable();

-- -----------------------------------------------------------------------------
-- 3. UPGRADE get_today_shift_log_monitor RPC TO RETURN client_code
-- -----------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.get_today_shift_log_monitor(uuid, date, text);
DROP FUNCTION IF EXISTS public.get_today_shift_log_monitor(uuid, date);

CREATE OR REPLACE FUNCTION public.get_today_shift_log_monitor(
  p_actor_id uuid,
  p_log_date date DEFAULT CURRENT_DATE,
  p_search text DEFAULT NULL
) RETURNS TABLE (
  operator_id uuid,
  operator_name text,
  operator_phone text,
  machine_id uuid,
  machine_code text,
  machine_serial_number text,
  machine_model text,
  client_id uuid,
  client_code text,
  client_name text,
  current_meter numeric,
  shift_code text,
  shift_start time,
  shift_end time,
  status text,
  log_id uuid,
  entered_by uuid,
  entered_by_name text,
  entry_source text,
  log_date date,
  start_meter numeric,
  end_meter numeric,
  running_hours numeric,
  remarks text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH actor_info AS (
    SELECT role FROM public.users WHERE id = p_actor_id
  ),
  active_assignments AS (
    SELECT oma.operator_id,
           oma.machine_id,
           oma.shift_start_time,
           oma.shift_end_time,
           oma.shift_code AS oma_shift_code,
           m.machine_id AS machine_code,
           m.serial_number,
           m.model,
           m.client_id,
           m.hour_meter AS current_meter
    FROM public.operator_machine_assignments oma
    JOIN public.machines m ON m.id = oma.machine_id
    WHERE oma.is_active = true
      AND m.status IN ('active', 'rented')
      AND (
        (SELECT role FROM actor_info) IN ('super_admin', 'admin', 'manager')
        OR EXISTS (
          SELECT 1 FROM public.user_supervisors us
          WHERE us.supervisor_id = p_actor_id AND us.user_id = oma.operator_id
        )
        OR EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = oma.operator_id AND u.supervisor_id = p_actor_id
        )
      )
  ),
  roster AS (
    SELECT a.*,
           COALESCE(a.oma_shift_code, csc.code) AS shift_code,
           COALESCE(csc.start_time, a.shift_start_time) AS shift_start,
           COALESCE(csc.end_time, a.shift_end_time) AS shift_end
    FROM active_assignments a
    LEFT JOIN public.client_shift_codes csc
      ON csc.client_id = a.client_id
     AND csc.is_active = true
     AND (
       (a.oma_shift_code IS NOT NULL AND csc.code = a.oma_shift_code)
       OR (a.oma_shift_code IS NULL AND csc.start_time = a.shift_start_time AND csc.end_time = a.shift_end_time)
     )
  )
  SELECT r.operator_id, u.full_name AS operator_name,
         u.phone AS operator_phone,
         r.machine_id, r.machine_code,
         r.serial_number AS machine_serial_number,
         r.model AS machine_model,
         r.client_id,
         COALESCE(cl.client_id, cl.code) AS client_code,
         cl.company_name AS client_name,
         r.current_meter,
         COALESCE(r.shift_code, 'S1') AS shift_code,
         r.shift_start, r.shift_end,
         CASE WHEN l.id IS NULL THEN 'pending' ELSE 'entered' END AS status,
         l.id AS log_id, l.entered_by, eu.full_name AS entered_by_name, l.entry_source,
         l.log_date, l.start_meter, l.end_meter, l.running_hours, l.remarks
  FROM roster r
  JOIN public.users u ON u.id = r.operator_id
  JOIN public.clients cl ON cl.id = r.client_id
  LEFT JOIN public.machine_hour_logs l
    ON l.machine_id = r.machine_id AND l.operator_id = r.operator_id
   AND l.shift_code = r.shift_code AND l.log_date = p_log_date
  LEFT JOIN public.users eu ON eu.id = l.entered_by
  WHERE (p_search IS NULL OR p_search = '' OR (
     u.full_name ILIKE '%' || p_search || '%'
     OR u.phone ILIKE '%' || p_search || '%'
     OR r.machine_code ILIKE '%' || p_search || '%'
     OR COALESCE(r.serial_number, '') ILIKE '%' || p_search || '%'
     OR COALESCE(r.model, '') ILIKE '%' || p_search || '%'
     OR cl.company_name ILIKE '%' || p_search || '%'
     OR cl.client_id ILIKE '%' || p_search || '%'
     OR cl.code ILIKE '%' || p_search || '%'
  ))
  ORDER BY status ASC, r.shift_start ASC, u.full_name ASC;
$$;

REVOKE ALL ON FUNCTION public.get_today_shift_log_monitor(uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_today_shift_log_monitor(uuid, date, text) TO authenticated, service_role;
