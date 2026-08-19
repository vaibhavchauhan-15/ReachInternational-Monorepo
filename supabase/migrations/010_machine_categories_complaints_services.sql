-- Migration: 010_machine_categories_complaints_services.sql
-- Description: Machine categories table, complaints workflow, supervisor role, and service log extensions

-- 1. Create Machine Categories Table
CREATE TABLE IF NOT EXISTS public.machine_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial machine categories
INSERT INTO public.machine_categories (name, description) VALUES
  ('Forklift', 'Material handling equipment for lifting and moving heavy loads'),
  ('Scissor Lift', 'Aerial work platform with crossing scissor mechanism'),
  ('Boom Lift', 'Aerial work platform with articulated or telescopic boom'),
  ('Reach Truck', 'Narrow aisle warehouse electric forklift'),
  ('Pallet Truck', 'Manual or electric pallet jack equipment'),
  ('Generators', 'Industrial power generation equipment')
ON CONFLICT (name) DO NOTHING;

-- 2. Update Users role constraint to include 'supervisor'
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('super_admin', 'admin', 'supervisor', 'engineer'));

-- 3. Extend Machines table with category, hour_meter, and service_count
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.machine_categories(id) ON DELETE SET NULL;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS category_name TEXT DEFAULT 'Forklift';
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS hour_meter NUMERIC DEFAULT 0;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS service_count INT DEFAULT 0;

-- 4. Create Machine Complaints Table
CREATE TABLE IF NOT EXISTS public.machine_complaints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_no TEXT UNIQUE NOT NULL,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  supervisor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  engineer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  complaint_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  location TEXT,
  state_name TEXT,
  city TEXT,
  hour_meter NUMERIC DEFAULT 0,
  required_part TEXT,
  part_quantity INT DEFAULT 1,
  complaint TEXT NOT NULL,
  work_done TEXT,
  pending_work TEXT,
  images TEXT[] DEFAULT ARRAY[]::TEXT[],
  pdf_report_url TEXT,
  checklist_data JSONB,
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'pending_parts', 'resolved', 'closed')) DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Extend Service Records table with service log details
ALTER TABLE public.service_records ADD COLUMN IF NOT EXISTS service_category TEXT DEFAULT 'Engine Service';
ALTER TABLE public.service_records ADD COLUMN IF NOT EXISTS service_status TEXT CHECK (service_status IN ('scheduled', 'in_progress', 'completed', 'overdue')) DEFAULT 'completed';
ALTER TABLE public.service_records ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.service_records ADD COLUMN IF NOT EXISTS service_due_date DATE;
ALTER TABLE public.service_records ADD COLUMN IF NOT EXISTS service_completion_date DATE;
ALTER TABLE public.service_records ADD COLUMN IF NOT EXISTS hour_meter NUMERIC DEFAULT 0;
ALTER TABLE public.service_records ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.service_records ADD COLUMN IF NOT EXISTS pdf_report_url TEXT;

-- 6. Enable Row Level Security
ALTER TABLE public.machine_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_complaints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read machine_categories" ON public.machine_categories;
CREATE POLICY "Allow authenticated read machine_categories" ON public.machine_categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow admin manage machine_categories" ON public.machine_categories;
CREATE POLICY "Allow admin manage machine_categories" ON public.machine_categories FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated read machine_complaints" ON public.machine_complaints;
CREATE POLICY "Allow authenticated read machine_complaints" ON public.machine_complaints FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated write machine_complaints" ON public.machine_complaints;
CREATE POLICY "Allow authenticated write machine_complaints" ON public.machine_complaints FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated update machine_complaints" ON public.machine_complaints;
CREATE POLICY "Allow authenticated update machine_complaints" ON public.machine_complaints FOR UPDATE TO authenticated USING (true);

-- 7. Create Indexes
CREATE INDEX IF NOT EXISTS idx_machines_category_id ON public.machines(category_id);
CREATE INDEX IF NOT EXISTS idx_machine_complaints_machine_id ON public.machine_complaints(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_complaints_status ON public.machine_complaints(status);
CREATE INDEX IF NOT EXISTS idx_machine_complaints_engineer_id ON public.machine_complaints(engineer_id);
CREATE INDEX IF NOT EXISTS idx_machine_complaints_supervisor_id ON public.machine_complaints(supervisor_id);
