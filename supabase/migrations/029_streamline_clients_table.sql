-- ==============================================================================
-- Migration 029: Streamline Clients Table
-- 1. Conditionally backfills company_name from client_name if client_name exists.
-- 2. Enforces NOT NULL and non-empty check constraint on company_name.
-- 3. Drops obsolete index on client_name and creates index on company_name.
-- 4. Drops unwanted/redundant columns: client_name, email, gstin, notes.
-- ==============================================================================

DO $$
BEGIN
  -- 1. Ensure company_name column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN company_name VARCHAR(100);
  END IF;

  -- 2. If client_name column still exists, backfill company_name from client_name using dynamic SQL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'client_name'
  ) THEN
    EXECUTE 'UPDATE public.clients SET company_name = client_name WHERE (company_name IS NULL OR btrim(company_name) = '''') AND client_name IS NOT NULL';
  END IF;

  -- 3. Default any remaining null/empty company_name so NOT NULL constraint succeeds
  UPDATE public.clients SET company_name = 'Unnamed Client' WHERE company_name IS NULL OR btrim(company_name) = '';

  -- 4. Enforce NOT NULL on company_name
  ALTER TABLE public.clients ALTER COLUMN company_name SET NOT NULL;

  -- 5. Enforce non-empty check constraint
  ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_company_name_not_empty;
  ALTER TABLE public.clients ADD CONSTRAINT clients_company_name_not_empty CHECK (btrim(company_name) <> '');

  -- 6. Update Indexes for Fast Lookups
  DROP INDEX IF EXISTS idx_clients_client_name;
  CREATE INDEX IF NOT EXISTS idx_clients_company_name ON public.clients(company_name);

  -- 7. Safely drop unwanted/redundant columns if they exist
  ALTER TABLE public.clients
    DROP COLUMN IF EXISTS client_name,
    DROP COLUMN IF EXISTS email,
    DROP COLUMN IF EXISTS gstin,
    DROP COLUMN IF EXISTS notes;

END $$;
