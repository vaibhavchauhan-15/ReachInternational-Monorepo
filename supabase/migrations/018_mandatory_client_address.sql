-- ==============================================================================
-- Migration 018: Mandatory Client Address Policy
-- 1. Backfills any existing clients with address details if missing.
-- 2. Sets NOT NULL on address, city, and state columns in public.clients.
-- 3. Adds non-empty check constraints on public.clients address fields.
-- ==============================================================================

-- 1. Backfill existing records
UPDATE public.clients
SET address = 'Plot 51, Industrial Growth Centre'
WHERE address IS NULL OR btrim(address) = '';

UPDATE public.clients
SET city = 'Bhiwadi'
WHERE city IS NULL OR btrim(city) = '';

UPDATE public.clients
SET state = 'Rajasthan'
WHERE state IS NULL OR btrim(state) = '';

-- 2. Enforce NOT NULL
ALTER TABLE public.clients ALTER COLUMN address SET NOT NULL;
ALTER TABLE public.clients ALTER COLUMN city SET NOT NULL;
ALTER TABLE public.clients ALTER COLUMN state SET NOT NULL;

-- 3. Enforce Non-Empty Check Constraints
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_address_not_empty;
ALTER TABLE public.clients ADD CONSTRAINT clients_address_not_empty CHECK (btrim(address) <> '');

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_city_not_empty;
ALTER TABLE public.clients ADD CONSTRAINT clients_city_not_empty CHECK (btrim(city) <> '');

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_state_not_empty;
ALTER TABLE public.clients ADD CONSTRAINT clients_state_not_empty CHECK (btrim(state) <> '');
