-- ============================================
-- Migration 002: Create public.machines table, sequence RI-MC-XXXX, RLS policies, and indexes
-- ============================================

-- 1. MACHINES TABLE
CREATE TABLE IF NOT EXISTS public.machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id TEXT UNIQUE NOT NULL,
  machine_name TEXT NOT NULL,
  model TEXT,
  manufacturer TEXT,
  serial_number TEXT UNIQUE,
  year_of_mfg INT,
  hour_meter NUMERIC DEFAULT 0,
  service_count INT DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'rented', 'active', 'inactive')),
  health_status TEXT NOT NULL DEFAULT 'active' CHECK (health_status IN ('active', 'under_maintenance', 'breakdown')),
  ownership_type TEXT DEFAULT 'company_owned' CHECK (ownership_type IN ('company_owned', 'customer_owned', 'rental_fleet')),
  current_supervisor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  current_operator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  engineer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_mobile TEXT,
  customer_address TEXT,
  city TEXT,
  state TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Sequence for Machine IDs (RI-MC-0001, RI-MC-0002, etc.)
CREATE SEQUENCE IF NOT EXISTS public.machines_id_seq START WITH 1 INCREMENT BY 1;

-- 3. Trigger Function for Auto-generating Machine ID (RI-MC-XXXX)
CREATE OR REPLACE FUNCTION public.generate_machine_id()
RETURNS TRIGGER AS $$
DECLARE
  seq_val BIGINT;
  candidate_id TEXT;
BEGIN
  IF NEW.machine_id IS NULL OR TRIM(NEW.machine_id) = '' THEN
    LOOP
      seq_val := nextval('public.machines_id_seq');
      candidate_id := 'RI-MC-' || lpad(seq_val::text, 4, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.machines WHERE machine_id = candidate_id);
    END LOOP;
    NEW.machine_id := candidate_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_machine_id ON public.machines;
CREATE TRIGGER trg_generate_machine_id
  BEFORE INSERT ON public.machines
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_machine_id();

DROP TRIGGER IF EXISTS trigger_machines_updated_at ON public.machines;
CREATE TRIGGER trigger_machines_updated_at
  BEFORE UPDATE ON public.machines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4. Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_machines_machine_id ON public.machines(machine_id);
CREATE INDEX IF NOT EXISTS idx_machines_status ON public.machines(status);
CREATE INDEX IF NOT EXISTS idx_machines_health_status ON public.machines(health_status);
CREATE INDEX IF NOT EXISTS idx_machines_current_supervisor ON public.machines(current_supervisor_id);
CREATE INDEX IF NOT EXISTS idx_machines_current_operator ON public.machines(current_operator_id);

-- 5. ROW LEVEL SECURITY & POLICIES
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "machines_select_authorized" ON public.machines;
CREATE POLICY "machines_select_authorized" ON public.machines
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "machines_insert_authorized" ON public.machines;
CREATE POLICY "machines_insert_authorized" ON public.machines
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() IN (
      'super_admin', 'admin', 'company_admin',
      'service_manager', 'rental_manager', 'store_manager'
    )
  );

DROP POLICY IF EXISTS "machines_update_authorized" ON public.machines;
CREATE POLICY "machines_update_authorized" ON public.machines
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() IN (
      'super_admin', 'admin', 'company_admin',
      'service_manager', 'rental_manager', 'store_manager', 'supervisor', 'service_engineer'
    ) OR current_supervisor_id = auth.uid() OR current_operator_id = auth.uid()
  )
  WITH CHECK (true);

DROP POLICY IF EXISTS "machines_delete_authorized" ON public.machines;
CREATE POLICY "machines_delete_authorized" ON public.machines
  FOR DELETE TO authenticated
  USING (
    public.current_user_role() IN ('super_admin', 'admin', 'company_admin')
  );
