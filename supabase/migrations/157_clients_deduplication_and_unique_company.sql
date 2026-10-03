-- ============================================================================
-- Migration 157: Client Deduplication, Unique Company Constraint & Cascade Fix
-- Target Dev Project: vlmxciuogczumumrwyot
-- Purpose:
--   1. Clean up duplicate client records safely.
--   2. Update client_sites FK constraint to ON DELETE CASCADE.
--   3. Add partial unique index on lower(trim(company_name)) for active clients.
--   4. Update clean_dev_seed_data RPC to purge client_sites before clients.
-- ============================================================================

BEGIN;

-- 1. Remove audit logs pointing to duplicate clients
DELETE FROM public.audit_logs
WHERE entity_type IN ('clients', 'client')
  AND entity_id IN (
    SELECT c2.id::text
    FROM public.clients c1
    JOIN public.clients c2 ON lower(trim(c1.company_name)) = lower(trim(c2.company_name)) AND c1.id <> c2.id
    WHERE (c2.created_at > c1.created_at OR (c2.created_at = c1.created_at AND c2.id > c1.id))
      AND NOT EXISTS (SELECT 1 FROM public.client_sites cs WHERE cs.client_id = c2.id)
      AND NOT EXISTS (SELECT 1 FROM public.machines m WHERE m.client_id = c2.id)
  );

-- 2. Remove shift codes for duplicate clients
DELETE FROM public.client_shift_codes
WHERE client_id IN (
  SELECT c2.id
  FROM public.clients c1
  JOIN public.clients c2 ON lower(trim(c1.company_name)) = lower(trim(c2.company_name)) AND c1.id <> c2.id
  WHERE (c2.created_at > c1.created_at OR (c2.created_at = c1.created_at AND c2.id > c1.id))
    AND NOT EXISTS (SELECT 1 FROM public.client_sites cs WHERE cs.client_id = c2.id)
    AND NOT EXISTS (SELECT 1 FROM public.machines m WHERE m.client_id = c2.id)
);

-- 3. Delete the duplicate client records
DELETE FROM public.clients c2
USING public.clients c1
WHERE lower(trim(c1.company_name)) = lower(trim(c2.company_name))
  AND c1.id <> c2.id
  AND (c2.created_at > c1.created_at OR (c2.created_at = c1.created_at AND c2.id > c1.id))
  AND NOT EXISTS (SELECT 1 FROM public.client_sites cs WHERE cs.client_id = c2.id)
  AND NOT EXISTS (SELECT 1 FROM public.machines m WHERE m.client_id = c2.id);

-- 4. Fix client_sites FK to CASCADE on client deletion
ALTER TABLE public.client_sites
  DROP CONSTRAINT IF EXISTS client_sites_client_id_fkey;

ALTER TABLE public.client_sites
  ADD CONSTRAINT client_sites_client_id_fkey
  FOREIGN KEY (client_id)
  REFERENCES public.clients(id)
  ON DELETE CASCADE;

-- 5. Add unique index preventing duplicate active clients by company name
CREATE UNIQUE INDEX IF NOT EXISTS uq_clients_company_name_active
  ON public.clients (lower(trim(company_name)))
  WHERE deleted_at IS NULL;

-- 6. Update clean_dev_seed_data RPC to clean client_sites
CREATE OR REPLACE FUNCTION public.clean_dev_seed_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Disable immutable trigger during entire purge
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_machine_hour_logs_immutable'
  ) THEN
    ALTER TABLE public.machine_hour_logs DISABLE TRIGGER trg_enforce_machine_hour_logs_immutable;
  END IF;

  DELETE FROM public.machine_hour_logs WHERE true;
  DELETE FROM public.operator_machine_assignments WHERE true;
  DELETE FROM public.operator_shift_ranges WHERE true;
  DELETE FROM public.operator_payrolls WHERE true;
  DELETE FROM public.profile_change_requests WHERE true;
  DELETE FROM public.account_deletion_requests WHERE true;
  DELETE FROM public.user_documents WHERE true;
  DELETE FROM public.user_supervisors WHERE true;
  DELETE FROM public.notifications WHERE true;
  DELETE FROM public.audit_logs WHERE true;
  DELETE FROM public.idempotency_keys WHERE true;
  DELETE FROM public.machines WHERE true;
  DELETE FROM public.client_shift_codes WHERE true;
  DELETE FROM public.client_sites WHERE true;
  DELETE FROM public.clients WHERE true;

  -- Delete non-admin users in auth.users (cascades to public.users)
  DELETE FROM auth.users 
  WHERE email NOT IN ('superadmin@reachinternational.co.in', 'admin@reachinternational.co.in');

  DELETE FROM public.users 
  WHERE email NOT IN ('superadmin@reachinternational.co.in', 'admin@reachinternational.co.in');

  -- Re-enable immutable trigger at the very end
  IF EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_enforce_machine_hour_logs_immutable'
  ) THEN
    ALTER TABLE public.machine_hour_logs ENABLE TRIGGER trg_enforce_machine_hour_logs_immutable;
  END IF;
END;
$function$;

COMMIT;
