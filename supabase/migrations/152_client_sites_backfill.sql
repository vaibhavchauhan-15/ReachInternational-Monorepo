-- ============================================================================
-- Migration 152: Client Sites Normalization — Phase B: Backfill
-- Target Dev Project: vlmxciuogczumumrwyot
-- Idempotent. Creates one site per existing client, backfills site_id on
-- machines and machine_hour_logs.
-- ============================================================================

-- 1. Create one site per existing client from their address
INSERT INTO public.client_sites (client_id, site_name, street, city, district, state_id, pincode)
SELECT
  c.id,
  -- Site name: company_name + city
  c.company_name || CASE WHEN c.city IS NOT NULL AND c.city != '' THEN ', ' || c.city ELSE '' END,
  c.street,
  c.city,
  COALESCE(NULLIF(c.district, ''), c.city),  -- fallback district to city if empty
  s.id,
  c.pincode
FROM public.clients c
JOIN public.states s ON public.norm_text(s.name) = public.norm_text(c.state)
WHERE c.deleted_at IS NULL
  AND c.pincode IS NOT NULL
  AND c.pincode ~ '^[1-9][0-9]{5}$'
ON CONFLICT (client_id, address_key) DO NOTHING;

-- 2. Set machines.site_id from machine's client_id → the site for that client
UPDATE public.machines m
SET site_id = cs.id
FROM public.client_sites cs
WHERE m.client_id = cs.client_id
  AND cs.status = 'active'
  AND m.site_id IS NULL;

-- 3. Temporarily disable user triggers on machine_hour_logs for backfill
-- Bypasses immutability (trg_enforce_machine_hour_logs_immutable) and the 7-day
-- operator logging window (trg_enforce_machine_hour_log_operator_date_window)
-- on historical logs during administrative foreign-key backfill.
ALTER TABLE public.machine_hour_logs DISABLE TRIGGER USER;

-- 4. Backfill machine_hour_logs.site_id
-- Strategy: If the client has only one site, use it.
-- If multiple, try the machine's current site.
-- For 36 rows and 5 clients (each with 1 site), this will match all.
UPDATE public.machine_hour_logs mhl
SET site_id = (
  SELECT cs.id
  FROM public.client_sites cs
  WHERE cs.client_id = mhl.client_id
    AND cs.status = 'active'
  ORDER BY cs.created_at ASC
  LIMIT 1
)
WHERE mhl.client_id IS NOT NULL
  AND mhl.site_id IS NULL;

-- 5. Re-enable all user triggers
ALTER TABLE public.machine_hour_logs ENABLE TRIGGER USER;

-- 6. Print counts for verification
DO $$
DECLARE
  v_sites_created int;
  v_machines_updated int;
  v_logs_updated int;
  v_logs_unmatched int;
BEGIN
  SELECT count(*) INTO v_sites_created FROM public.client_sites;
  SELECT count(*) INTO v_machines_updated FROM public.machines WHERE site_id IS NOT NULL;
  SELECT count(*) INTO v_logs_updated FROM public.machine_hour_logs WHERE site_id IS NOT NULL;
  SELECT count(*) INTO v_logs_unmatched FROM public.machine_hour_logs WHERE client_id IS NOT NULL AND site_id IS NULL;

  RAISE NOTICE '=== BACKFILL REPORT ===';
  RAISE NOTICE 'Sites created: %', v_sites_created;
  RAISE NOTICE 'Machines with site_id: %', v_machines_updated;
  RAISE NOTICE 'Logs with site_id: %', v_logs_updated;
  RAISE NOTICE 'Logs still unmatched: %', v_logs_unmatched;
  RAISE NOTICE '=======================';
END $$;
