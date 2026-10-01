-- ============================================================================
-- Migration 151: Client Sites Normalization — Phase A: Expand (Idempotent)
-- Target Dev Project: vlmxciuogczumumrwyot
-- Safe, additive-only, idempotent (re-runnable without errors)
-- ============================================================================

-- 1. norm_text: one definition of "same text" used everywhere
CREATE OR REPLACE FUNCTION public.norm_text(t text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS $$
  SELECT btrim(regexp_replace(lower(coalesce(t, '')), '[^[:alnum:]]+', ' ', 'g'))
$$;

-- Parity assertion: TypeScript normText must produce the same output
DO $$ BEGIN
  ASSERT public.norm_text('CPM |PO : CP Mills,') = public.norm_text('cpm po cp  mills'),
    'norm_text parity check failed';
  ASSERT public.norm_text('  Fort Songadh  ') = 'fort songadh',
    'norm_text trim check failed';
  ASSERT public.norm_text(NULL) = '',
    'norm_text null check failed';
END $$;

-- 2. client_sites table (idempotent with IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.client_sites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  site_code   text NOT NULL,
  site_name   text NOT NULL,
  street      text NOT NULL,
  city        text NOT NULL,
  district    text NOT NULL,
  state_id    smallint NOT NULL REFERENCES public.states(id),
  pincode     text NOT NULL CHECK (pincode ~ '^[1-9][0-9]{5}$'),
  address_key text GENERATED ALWAYS AS (
                pincode || '|' || public.norm_text(street) || '|' || public.norm_text(city)
              ) STORED,
  status      text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- Composite unique for FK targets
  UNIQUE (id, client_id),

  -- THE duplicate guard: same client + same physical place = blocked
  UNIQUE (client_id, address_key)
);

-- Unique site_code
CREATE UNIQUE INDEX IF NOT EXISTS client_sites_code_uq ON public.client_sites (site_code);

-- Unique site_name per client (normalized)
CREATE UNIQUE INDEX IF NOT EXISTS client_sites_name_uq
  ON public.client_sites (client_id, (public.norm_text(site_name)));

-- Partial index: active sites per client (used by dropdowns)
CREATE INDEX IF NOT EXISTS client_sites_client_active_idx
  ON public.client_sites (client_id) WHERE status = 'active';

-- 3. updated_at trigger (reuse existing function, drop first if exists)
DROP TRIGGER IF EXISTS trg_client_sites_updated_at ON public.client_sites;
CREATE TRIGGER trg_client_sites_updated_at
  BEFORE UPDATE ON public.client_sites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4. site_code auto-assignment trigger
-- Pattern: {CLIENT_CODE}-S{NN} e.g. CLI-0032-S01
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
  -- Get the client's display code
  SELECT client_id INTO v_client_code FROM public.clients WHERE id = NEW.client_id;

  -- Count existing sites for this client + 1
  SELECT COALESCE(MAX(
    CASE
      WHEN site_code ~ ('^' || v_client_code || '-S[0-9]+$')
      THEN CAST(regexp_replace(site_code, '^.*-S', '') AS int)
      ELSE 0
    END
  ), 0) + 1
  INTO v_next_seq
  FROM public.client_sites
  WHERE client_id = NEW.client_id;

  NEW.site_code := v_client_code || '-S' || lpad(v_next_seq::text, 2, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_site_code ON public.client_sites;
CREATE TRIGGER trg_assign_site_code
  BEFORE INSERT ON public.client_sites
  FOR EACH ROW
  WHEN (NEW.site_code IS NULL OR NEW.site_code = '')
  EXECUTE FUNCTION public.assign_site_code();

-- 5. site_code immutability trigger
CREATE OR REPLACE FUNCTION public.enforce_site_code_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
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
  FOR EACH ROW EXECUTE FUNCTION public.enforce_site_code_immutable();

-- 6. RLS — same pattern as clients table
ALTER TABLE public.client_sites ENABLE ROW LEVEL SECURITY;

-- Authorized roles for client site operations (same as clients)
DROP POLICY IF EXISTS client_sites_select_policy ON public.client_sites;
CREATE POLICY client_sites_select_policy ON public.client_sites
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS client_sites_insert_policy ON public.client_sites;
CREATE POLICY client_sites_insert_policy ON public.client_sites
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid())
    IN ('super_admin', 'admin', 'manager')
  );

DROP POLICY IF EXISTS client_sites_update_policy ON public.client_sites;
CREATE POLICY client_sites_update_policy ON public.client_sites
  FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid())
    IN ('super_admin', 'admin', 'manager')
  )
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = auth.uid())
    IN ('super_admin', 'admin', 'manager')
  );

-- 7. find_similar_sites: near-duplicate warning (not a block)
CREATE OR REPLACE FUNCTION public.find_similar_sites(
  p_client_id uuid,
  p_street text,
  p_pincode text
)
RETURNS TABLE (id uuid, site_name text, street text, similarity real)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT s.id, s.site_name, s.street,
         similarity(public.norm_text(s.street), public.norm_text(p_street))
  FROM public.client_sites s
  WHERE s.client_id = p_client_id
    AND s.pincode = p_pincode
    AND similarity(public.norm_text(s.street), public.norm_text(p_street)) > 0.5
  ORDER BY 4 DESC
  LIMIT 5
$$;

GRANT EXECUTE ON FUNCTION public.find_similar_sites(uuid, text, text)
  TO authenticated, service_role;

-- 8. Add nullable site_id to machines (composite FK: site must belong to same client)
ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS site_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'machines_site_fk'
  ) THEN
    ALTER TABLE public.machines
      ADD CONSTRAINT machines_site_fk
        FOREIGN KEY (site_id, client_id)
        REFERENCES public.client_sites (id, client_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'machines_site_needs_client'
  ) THEN
    ALTER TABLE public.machines
      ADD CONSTRAINT machines_site_needs_client
        CHECK (site_id IS NULL OR client_id IS NOT NULL);
  END IF;
END $$;

-- 9. Add nullable site_id to machine_hour_logs (composite FK)
ALTER TABLE public.machine_hour_logs
  ADD COLUMN IF NOT EXISTS site_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mhl_site_fk'
  ) THEN
    ALTER TABLE public.machine_hour_logs
      ADD CONSTRAINT mhl_site_fk
        FOREIGN KEY (site_id, client_id)
        REFERENCES public.client_sites (id, client_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mhl_site_needs_client'
  ) THEN
    ALTER TABLE public.machine_hour_logs
      ADD CONSTRAINT mhl_site_needs_client
        CHECK (site_id IS NULL OR client_id IS NOT NULL);
  END IF;
END $$;

-- Index for log queries filtered by site
CREATE INDEX IF NOT EXISTS idx_mhl_site_date_created
  ON public.machine_hour_logs (site_id, log_date DESC, created_at DESC, id DESC);

-- 10. Grant permissions
GRANT SELECT ON public.client_sites TO authenticated;
GRANT INSERT, UPDATE ON public.client_sites TO authenticated;
GRANT ALL ON public.client_sites TO service_role;
GRANT EXECUTE ON FUNCTION public.norm_text(text) TO authenticated, service_role, anon;
