-- ==============================================================================
-- Migration 064: Client Unified Address & Multi-Site Location Architecture
-- 1. Ensures street (lowercase) column exists on public.clients and syncs with "Street".
-- 2. Adds address text column to public.clients storing full unified address:
--    street + city + district + state + pincode.
-- 3. Creates trigger sync_client_address() ensuring "Street", street, and address
--    are automatically computed and synchronized on INSERT and UPDATE.
-- 4. Backfills public.clients with computed unified addresses.
-- 5. Backfills public.machine_hour_logs.location to match the client's unified address.
-- ==============================================================================

DO $$
BEGIN
  -- 1. Ensure street column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'street'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN street TEXT;
  END IF;

  -- 2. Ensure address column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'address'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN address TEXT;
  END IF;
END $$;

-- 3. Trigger function to synchronize street, "Street", and unified address
CREATE OR REPLACE FUNCTION public.sync_client_address()
RETURNS TRIGGER AS $$
DECLARE
  resolved_street TEXT;
BEGIN
  -- Resolve street from street, "Street", or address
  resolved_street := COALESCE(
    NULLIF(btrim(NEW.street), ''),
    NULLIF(btrim(NEW."Street"), ''),
    NULLIF(btrim(NEW.address), '')
  );

  -- Keep both street and "Street" synchronized
  NEW.street := resolved_street;
  NEW."Street" := resolved_street;

  -- Build unified address: street + city + district + state + pincode
  NEW.address := concat_ws(', ',
    NULLIF(btrim(resolved_street), ''),
    NULLIF(btrim(NEW.city), ''),
    NULLIF(btrim(NEW.district), ''),
    NULLIF(btrim(NEW.state), ''),
    NULLIF(btrim(NEW.pincode), '')
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS trg_sync_client_address ON public.clients;
CREATE TRIGGER trg_sync_client_address
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_client_address();

-- 4. Backfill existing clients
UPDATE public.clients
SET 
  street = COALESCE(NULLIF(btrim(street), ''), NULLIF(btrim("Street"), '')),
  "Street" = COALESCE(NULLIF(btrim("Street"), ''), NULLIF(btrim(street), '')),
  address = concat_ws(', ',
    NULLIF(btrim(COALESCE("Street", street)), ''),
    NULLIF(btrim(city), ''),
    NULLIF(btrim(district), ''),
    NULLIF(btrim(state), ''),
    NULLIF(btrim(pincode), '')
  );

-- 5. Backfill historical machine_hour_logs.location from client unified address
UPDATE public.machine_hour_logs mhl
SET location = c.address
FROM public.clients c
WHERE mhl.client_id = c.id
  AND c.address IS NOT NULL
  AND btrim(c.address) <> '';
