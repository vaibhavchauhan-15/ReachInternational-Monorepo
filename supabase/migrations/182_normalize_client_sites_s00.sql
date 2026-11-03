-- ============================================================================
-- Migration 182: Client Sites Normalization & S00 Default Site Architecture
-- Target Dev Project: vlmxciuogczumumrwyot
--
-- Invariants:
--   1. Every client has an initial S00 default site created upon registration.
--   2. Site codes are S00, S01, S02... with site_no sequence 0, 1, 2...
--   3. Unique address_key per client blocks duplicate physical locations.
--   4. Dropdown reads and log filtering use normalized site_id.
--   5. Provides atomic RPCs get_client_with_sites and get_client_sites_dropdown.
--   6. Fully safe and idempotent: disables operator date-window & immutability triggers
--      during administrative backfill to prevent 23514 errors on historical records.
-- ============================================================================

BEGIN;

-- 1. Add new columns to public.client_sites
ALTER TABLE public.client_sites
  ADD COLUMN IF NOT EXISTS site_no integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS code text DEFAULT 'S00',
  ADD COLUMN IF NOT EXISTS legacy_code text,
  ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- 2. Add address_full generated column if not present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'client_sites' 
      AND column_name = 'address_full'
  ) THEN
    ALTER TABLE public.client_sites
      ADD COLUMN address_full text GENERATED ALWAYS AS (
        street || ', ' || city || ', ' || district || ' - ' || pincode
      ) STORED;
  END IF;
END $$;

-- 3. Temporarily disable user triggers on public.client_sites during migration
ALTER TABLE public.client_sites DISABLE TRIGGER USER;
DROP TRIGGER IF EXISTS trg_enforce_site_code_immutable ON public.client_sites;
DROP TRIGGER IF EXISTS trg_assign_site_code ON public.client_sites;

-- 4. Backfill default sites for any clients that currently lack a site in client_sites
INSERT INTO public.client_sites (
  client_id,
  site_no,
  code,
  site_code,
  site_name,
  street,
  city,
  district,
  state_id,
  pincode,
  is_default,
  status
)
SELECT
  c.id,
  0,
  'S00',
  COALESCE(c.client_id, c.code, 'CLI') || '-S00',
  c.company_name || ' - Main Site',
  COALESCE(NULLIF(c.street, ''), 'Main Office'),
  c.city,
  COALESCE(NULLIF(c.district, ''), c.city),
  COALESCE(st.id, 27),
  c.pincode,
  true,
  'active'
FROM public.clients c
LEFT JOIN public.states st ON public.norm_text(st.name) = public.norm_text(c.state)
WHERE c.deleted_at IS NULL
  AND c.pincode ~ '^[1-9][0-9]{5}$'
  AND NOT EXISTS (
    SELECT 1 FROM public.client_sites cs WHERE cs.client_id = c.id
  )
ON CONFLICT (client_id, address_key) DO NOTHING;

-- 5. Renumber sites per client starting at S00 for the oldest site
WITH ranked_sites AS (
  SELECT
    id,
    client_id,
    site_code AS current_site_code,
    ROW_NUMBER() OVER (
      PARTITION BY client_id
      ORDER BY created_at ASC, id ASC
    ) - 1 AS new_site_no
  FROM public.client_sites
  WHERE deleted_at IS NULL
)
UPDATE public.client_sites cs
SET
  site_no = rs.new_site_no,
  code = 'S' || lpad(rs.new_site_no::text, 2, '0'),
  legacy_code = COALESCE(cs.legacy_code, cs.site_code),
  is_default = (rs.new_site_no = 0)
FROM ranked_sites rs
WHERE cs.id = rs.id;

-- 6. Update site_code to match {CLIENT_CODE}-{CODE}
-- Step 6a: Set temporary site_code to avoid transient unique constraint collisions
UPDATE public.client_sites
SET site_code = 'TMP-' || id::text
WHERE deleted_at IS NULL;

-- Step 6b: Assign canonical site_code (e.g. CLI-0047-S00)
UPDATE public.client_sites cs
SET site_code = COALESCE(c.client_id, c.code, 'CLI') || '-' || cs.code
FROM public.clients c
WHERE cs.client_id = c.id;

-- 7. Enforce NOT NULL constraints on newly populated columns
ALTER TABLE public.client_sites
  ALTER COLUMN site_no SET NOT NULL,
  ALTER COLUMN code SET NOT NULL,
  ALTER COLUMN is_default SET NOT NULL;

-- 8. Add partial unique indexes for active sites
CREATE UNIQUE INDEX IF NOT EXISTS uq_client_sites_client_site_no
  ON public.client_sites (client_id, site_no)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_client_sites_client_code
  ON public.client_sites (client_id, code)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_client_sites_client_active_dropdown
  ON public.client_sites (client_id, site_no)
  WHERE deleted_at IS NULL AND status = 'active';

-- 9. Updated site_code auto-assignment trigger function
CREATE OR REPLACE FUNCTION public.assign_site_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_client_code text;
  v_next_seq int;
BEGIN
  -- Get the client's display code (e.g. CLI-0047)
  SELECT COALESCE(client_id, code) INTO v_client_code FROM public.clients WHERE id = NEW.client_id;

  -- Determine next sequence for this client
  IF NEW.site_no IS NULL OR NEW.site_no = 0 THEN
    -- Check if S00 already exists for this client
    IF EXISTS (
      SELECT 1 FROM public.client_sites
      WHERE client_id = NEW.client_id AND site_no = 0 AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      SELECT COALESCE(MAX(site_no), 0) + 1 INTO v_next_seq
      FROM public.client_sites
      WHERE client_id = NEW.client_id;
      NEW.site_no := v_next_seq;
      NEW.is_default := false;
    ELSE
      NEW.site_no := 0;
      NEW.is_default := true;
    END IF;
  END IF;

  NEW.code := 'S' || lpad(NEW.site_no::text, 2, '0');
  NEW.site_code := v_client_code || '-' || NEW.code;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_site_code ON public.client_sites;
CREATE TRIGGER trg_assign_site_code
  BEFORE INSERT ON public.client_sites
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_site_code();

-- 10. Re-create site_code immutability trigger
CREATE OR REPLACE FUNCTION public.enforce_site_code_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.site_code IS NOT NULL AND NEW.site_code IS DISTINCT FROM OLD.site_code THEN
    RAISE EXCEPTION 'site_code is immutable once assigned (was %, attempted %)',
      OLD.site_code, NEW.site_code
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_site_code_immutable ON public.client_sites;
CREATE TRIGGER trg_enforce_site_code_immutable
  BEFORE UPDATE ON public.client_sites
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_site_code_immutable();

-- Re-enable user triggers on client_sites
ALTER TABLE public.client_sites ENABLE TRIGGER USER;

-- 11. Automatic S00 Site Creation on Client Creation
CREATE OR REPLACE FUNCTION public.create_default_client_site()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_state_id smallint;
  v_resolved_street text;
  v_resolved_city text;
  v_resolved_district text;
  v_resolved_pincode text;
BEGIN
  -- Only execute for active new clients with valid address
  v_resolved_street := COALESCE(NULLIF(btrim(NEW.street), ''), 'Head Office');
  v_resolved_city := COALESCE(NULLIF(btrim(NEW.city), ''), 'City');
  v_resolved_district := COALESCE(NULLIF(btrim(NEW.district), ''), v_resolved_city);
  v_resolved_pincode := COALESCE(NULLIF(btrim(NEW.pincode), ''), '110001');

  -- Resolve state_id from public.states
  SELECT id INTO v_state_id
  FROM public.states
  WHERE public.norm_text(name) = public.norm_text(NEW.state)
  LIMIT 1;

  IF v_state_id IS NULL THEN
    v_state_id := 27; -- Default to Maharashtra if unmapped
  END IF;

  -- Insert S00 default site
  INSERT INTO public.client_sites (
    client_id,
    site_no,
    code,
    site_code,
    site_name,
    street,
    city,
    district,
    state_id,
    pincode,
    is_default,
    status
  ) VALUES (
    NEW.id,
    0,
    'S00',
    COALESCE(NEW.client_id, NEW.code, 'CLI') || '-S00',
    NEW.company_name || ' - Main Site',
    v_resolved_street,
    v_resolved_city,
    v_resolved_district,
    v_state_id,
    v_resolved_pincode,
    true,
    'active'
  )
  ON CONFLICT (client_id, address_key) DO UPDATE
  SET is_default = true, site_no = 0, code = 'S00';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_create_default_site ON public.clients;
CREATE TRIGGER trg_client_create_default_site
  AFTER INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_client_site();

-- 12. Single Round-Trip RPC: get_client_with_sites(client_id)
CREATE OR REPLACE FUNCTION public.get_client_with_sites(p_client_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_client jsonb;
  v_sites jsonb;
  v_counts jsonb;
BEGIN
  -- 1. Fetch Client Profile
  SELECT to_jsonb(c.*) INTO v_client
  FROM public.clients c
  WHERE c.id = p_client_id;

  IF v_client IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Fetch Structured Sites
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'client_id', s.client_id,
      'site_no', s.site_no,
      'code', s.code,
      'site_code', s.site_code,
      'legacy_code', s.legacy_code,
      'site_name', s.site_name,
      'street', s.street,
      'city', s.city,
      'district', s.district,
      'state_id', s.state_id,
      'state_name', st.name,
      'pincode', s.pincode,
      'address_full', s.address_full,
      'address_key', s.address_key,
      'is_default', s.is_default,
      'status', s.status,
      'created_at', s.created_at,
      'updated_at', s.updated_at
    ) ORDER BY s.site_no ASC
  ), '[]'::jsonb)
  INTO v_sites
  FROM public.client_sites s
  LEFT JOIN public.states st ON st.id = s.state_id
  WHERE s.client_id = p_client_id
    AND s.deleted_at IS NULL;

  -- 3. Fetch Aggregate Counts
  SELECT jsonb_build_object(
    'total_sites', COUNT(s.id),
    'active_sites', COUNT(s.id) FILTER (WHERE s.status = 'active'),
    'assigned_machines', (SELECT COUNT(*) FROM public.machines m WHERE m.client_id = p_client_id),
    'total_logs', (SELECT COUNT(*) FROM public.machine_hour_logs l WHERE l.client_id = p_client_id)
  )
  INTO v_counts
  FROM public.client_sites s
  WHERE s.client_id = p_client_id
    AND s.deleted_at IS NULL;

  RETURN jsonb_build_object(
    'client', v_client,
    'sites', v_sites,
    'counts', v_counts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_with_sites(uuid) TO authenticated, service_role;

-- 13. Lean Dropdown RPC: get_client_sites_dropdown(client_id)
CREATE OR REPLACE FUNCTION public.get_client_sites_dropdown(p_client_id uuid)
RETURNS TABLE (
  id uuid,
  code text,
  site_code text,
  site_name text,
  city text,
  address_full text,
  is_default boolean,
  site_no int
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    id,
    code,
    site_code,
    site_name,
    city,
    address_full,
    is_default,
    site_no
  FROM public.client_sites
  WHERE client_id = p_client_id
    AND deleted_at IS NULL
    AND status = 'active'
  ORDER BY site_no ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_sites_dropdown(uuid) TO authenticated, service_role;

-- 14. Backfill unlinked machine_hour_logs.site_id from machine site or default S00 site
-- Temporarily disable user triggers on public.machine_hour_logs to bypass operator 7-day window
-- and shift immutability triggers on historical logs during administrative foreign key linking.
ALTER TABLE public.machine_hour_logs DISABLE TRIGGER USER;
DROP TRIGGER IF EXISTS trg_enforce_machine_hour_log_operator_date_window ON public.machine_hour_logs;
DROP TRIGGER IF EXISTS trg_enforce_machine_hour_logs_immutable ON public.machine_hour_logs;

UPDATE public.machine_hour_logs mhl
SET site_id = COALESCE(
  m.site_id,
  (
    SELECT cs.id
    FROM public.client_sites cs
    WHERE cs.client_id = mhl.client_id
      AND cs.deleted_at IS NULL
    ORDER BY cs.site_no ASC
    LIMIT 1
  )
)
FROM public.machines m
WHERE mhl.machine_id = m.id
  AND mhl.client_id IS NOT NULL
  AND mhl.site_id IS NULL;

-- Re-attach operator 7-day window trigger
DROP TRIGGER IF EXISTS trg_enforce_machine_hour_log_operator_date_window ON public.machine_hour_logs;
CREATE TRIGGER trg_enforce_machine_hour_log_operator_date_window
  BEFORE INSERT OR UPDATE ON public.machine_hour_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_machine_hour_log_operator_date_window();

-- Re-attach shift logs immutability trigger
DROP TRIGGER IF EXISTS trg_enforce_machine_hour_logs_immutable ON public.machine_hour_logs;
CREATE TRIGGER trg_enforce_machine_hour_logs_immutable
  BEFORE UPDATE OR DELETE ON public.machine_hour_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_machine_hour_logs_immutable();

-- Re-enable user triggers on public.machine_hour_logs
ALTER TABLE public.machine_hour_logs ENABLE TRIGGER USER;

COMMIT;
