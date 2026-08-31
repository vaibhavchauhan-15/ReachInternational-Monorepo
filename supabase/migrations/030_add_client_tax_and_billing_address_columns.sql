-- ==============================================================================
-- Migration 030: Add Client Tax Parameters, District, and Billing Address
-- 1. Adds gstin, pan_number, district to public.clients.
-- 2. Adds is_billing_address_different flag and separate billing address columns:
--    billing_address, billing_city, billing_district, billing_state, billing_pincode.
-- 3. Creates partial indexes for fast querying on tax identifiers & location.
-- ==============================================================================

DO $$
BEGIN
  -- 1. Add gstin column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'gstin'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN gstin VARCHAR(50);
  END IF;

  -- 2. Add pan_number column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'pan_number'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN pan_number VARCHAR(50);
  END IF;

  -- 3. Add district column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'district'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN district VARCHAR(100);
  END IF;

  -- 4. Add is_billing_address_different column if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'is_billing_address_different'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN is_billing_address_different BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  -- 5. Add billing address columns if not exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'billing_address'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN billing_address TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'billing_city'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN billing_city VARCHAR(100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'billing_district'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN billing_district VARCHAR(100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'billing_state'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN billing_state VARCHAR(100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'billing_pincode'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN billing_pincode VARCHAR(20);
  END IF;

  -- 6. Indexes for fast querying
  CREATE INDEX IF NOT EXISTS idx_clients_gstin ON public.clients(gstin) WHERE gstin IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_clients_pan_number ON public.clients(pan_number) WHERE pan_number IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_clients_district ON public.clients(district) WHERE district IS NOT NULL;

END $$;
