-- ============================================
-- Migration 003: Create public.clients table, auto-code sequence CLI-XXXX, RLS, and indexes
-- ============================================

-- 1. CLIENTS TABLE
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  client_name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  contact_person VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  gstin VARCHAR(50),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  pincode VARCHAR(20),
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  deleted_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Sequence for Client Codes (CLI-0001, CLI-0002, etc.)
CREATE SEQUENCE IF NOT EXISTS public.clients_code_seq START WITH 1 INCREMENT BY 1;

-- 3. Trigger Function for Auto-generating Client Code (CLI-XXXX)
CREATE OR REPLACE FUNCTION public.generate_client_code()
RETURNS TRIGGER AS $$
DECLARE
  seq_val BIGINT;
  candidate_code TEXT;
BEGIN
  IF NEW.code IS NULL OR TRIM(NEW.code) = '' THEN
    LOOP
      seq_val := nextval('public.clients_code_seq');
      candidate_code := 'CLI-' || lpad(seq_val::text, 4, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.clients WHERE code = candidate_code);
    END LOOP;
    NEW.code := candidate_code;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_client_code ON public.clients;
CREATE TRIGGER trg_generate_client_code
  BEFORE INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_client_code();

DROP TRIGGER IF EXISTS trigger_clients_updated_at ON public.clients;
CREATE TRIGGER trigger_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4. Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_deleted_at ON public.clients(deleted_at);
CREATE INDEX IF NOT EXISTS idx_clients_client_name ON public.clients(client_name);
CREATE INDEX IF NOT EXISTS idx_clients_code ON public.clients(code);

-- 5. ROW LEVEL SECURITY & POLICIES
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clients_select_policy" ON public.clients;
CREATE POLICY "clients_select_policy" ON public.clients
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL OR
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'admin', 'service_manager', 'rental_manager', 'sales_executive')
    )
  );

DROP POLICY IF EXISTS "clients_insert_policy" ON public.clients;
CREATE POLICY "clients_insert_policy" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'admin', 'service_manager', 'rental_manager', 'sales_executive')
    )
  );

DROP POLICY IF EXISTS "clients_update_policy" ON public.clients;
CREATE POLICY "clients_update_policy" ON public.clients
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'admin', 'service_manager', 'rental_manager', 'sales_manager')
    )
  );

DROP POLICY IF EXISTS "clients_delete_policy" ON public.clients;
CREATE POLICY "clients_delete_policy" ON public.clients
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'admin', 'service_manager')
    )
  );
