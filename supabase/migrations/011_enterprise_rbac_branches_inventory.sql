-- Migration: 011_enterprise_rbac_branches_inventory.sql
-- Description: Comprehensive RBAC, Multi-Branch Scoping, Machine Master, Stock Ledger, Operator Logs, and HR Schema

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. BRANCHES MASTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Default Branches (Delhi HQ and Gurgaon Branch)
INSERT INTO public.branches (code, name, city, state, address, phone, email) VALUES
  ('DEL-HQ', 'Delhi HQ Main Branch', 'Delhi', 'Delhi', 'Plot 45 GIDC, Okhla Industrial Area Phase III', '+91 9876543210', 'delhi@reachinternational.com'),
  ('GGN-01', 'Gurgaon Branch', 'Gurgaon', 'Haryana', 'Sector 18, Electronic City, Gurgaon', '+91 9876543211', 'gurgaon@reachinternational.com')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 2. ROLES AND PERMISSIONS SYSTEM
-- ============================================
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.roles (code, name, description) VALUES
  ('super_admin', 'Super Admin', 'Entire company and system control across all branches'),
  ('branch_manager', 'Branch Manager', 'Manage specific branch fleet, staff, inventory and service'),
  ('service_engineer', 'Service Engineer', 'Manage field service operations, breakdown resolution and FSR reports'),
  ('supervisor', 'Supervisor', 'Monitor assigned machines, log complaints, and verify service completion'),
  ('store_manager', 'Store Manager', 'Manage inventory stock ledger, stock-in/out and inter-branch transfers'),
  ('operator', 'Operator', 'Operate assigned machines and submit daily running hour logs'),
  ('mechanic', 'Mechanic / Technician', 'Perform repair jobs, update job status, upload photos, and request spare parts'),
  ('hr_manager', 'HR Manager', 'Manage employee profiles, onboarding, attendance, leave and payroll'),
  ('finance_manager', 'Accounts / Finance Manager', 'Manage billing, payments, expenses and financial reports'),
  ('sales_executive', 'Sales Executive', 'Manage machine sales, customer inquiries and quotations'),
  ('rental_manager', 'Rental Manager', 'Manage rental fleet contracts, machine dispatches and returns')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  module TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.permissions (code, module, description) VALUES
  ('machine.view', 'machine', 'View machine directory and details'),
  ('machine.create', 'machine', 'Create new machine record'),
  ('machine.edit', 'machine', 'Edit machine details'),
  ('machine.delete', 'machine', 'Delete machine record'),
  ('machine.assign', 'machine', 'Assign operators and supervisors to machines'),
  
  ('complaint.view', 'complaint', 'View machine breakdown complaints'),
  ('complaint.create', 'complaint', 'Raise breakdown complaint'),
  ('complaint.assign', 'complaint', 'Assign mechanics and engineers to complaints'),
  ('complaint.update', 'complaint', 'Update complaint work status'),
  ('complaint.close', 'complaint', 'Verify and close breakdown complaints'),

  ('service.view', 'service', 'View service schedule and history'),
  ('service.create', 'service', 'Schedule service log'),
  ('service.update', 'service', 'Update service record and upload report'),

  ('inventory.view', 'inventory', 'View spare parts inventory stock'),
  ('inventory.create', 'inventory', 'Add new inventory product'),
  ('inventory.stock_in', 'inventory', 'Receive incoming stock'),
  ('inventory.stock_out', 'inventory', 'Issue spare parts for breakdown repairs'),
  ('inventory.adjust', 'inventory', 'Adjust inventory stock level'),
  ('inventory.transfer', 'inventory', 'Initiate and approve inter-branch transfers'),

  ('employee.view', 'employee', 'View employee directory'),
  ('employee.create', 'employee', 'Create employee record'),
  ('employee.edit', 'employee', 'Edit employee profile'),
  ('employee.salary.view', 'employee', 'View sensitive salary and payroll data'),

  ('report.view', 'report', 'View operational and branch reports'),
  ('report.export', 'report', 'Export PDF and Excel reports'),

  ('settings.view', 'settings', 'View platform settings'),
  ('settings.edit', 'settings', 'Modify global platform settings and roles')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Seed permissions for super_admin (All permissions)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p WHERE r.code = 'super_admin'
ON CONFLICT DO NOTHING;

-- Seed permissions for branch_manager
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p 
WHERE r.code = 'branch_manager' AND p.code IN ('machine.view', 'machine.edit', 'machine.assign', 'complaint.view', 'complaint.create', 'complaint.close', 'service.view', 'service.create', 'inventory.view', 'inventory.transfer', 'employee.view', 'report.view', 'report.export')
ON CONFLICT DO NOTHING;

-- Seed permissions for operator
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p 
WHERE r.code = 'operator' AND p.code IN ('machine.view', 'complaint.create', 'service.view')
ON CONFLICT DO NOTHING;

-- Seed permissions for mechanic
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p 
WHERE r.code = 'mechanic' AND p.code IN ('machine.view', 'complaint.view', 'complaint.update', 'inventory.view', 'service.view')
ON CONFLICT DO NOTHING;

-- Seed permissions for store_manager
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p 
WHERE r.code = 'store_manager' AND p.code IN ('inventory.view', 'inventory.create', 'inventory.stock_in', 'inventory.stock_out', 'inventory.adjust', 'inventory.transfer', 'machine.view', 'report.view')
ON CONFLICT DO NOTHING;

-- Seed permissions for hr_manager
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p 
WHERE r.code = 'hr_manager' AND p.code IN ('employee.view', 'employee.create', 'employee.edit', 'employee.salary.view', 'report.view')
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. UPDATE USERS & USER_BRANCHES TABLE
-- ============================================
-- Drop old constraint first
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;

-- Migrate legacy 'engineer' role rows to 'service_engineer'
UPDATE public.users SET role = 'service_engineer' WHERE role = 'engineer';

-- Fallback safety update for any unexpected role values
UPDATE public.users SET role = 'admin' WHERE role NOT IN (
  'super_admin', 'admin', 'branch_manager', 'engineer', 'service_engineer',
  'supervisor', 'store_manager', 'operator', 'mechanic',
  'hr_manager', 'finance_manager', 'sales_executive', 'rental_manager'
);

-- Add updated check constraint including 'engineer' as legacy fallback
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (
  role IN (
    'super_admin', 'admin', 'branch_manager', 'engineer', 'service_engineer',
    'supervisor', 'store_manager', 'operator', 'mechanic',
    'hr_manager', 'finance_manager', 'sales_executive', 'rental_manager'
  )
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.user_branches (
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, branch_id)
);

-- Set default branch for existing users
UPDATE public.users SET branch_id = (SELECT id FROM public.branches WHERE code = 'DEL-HQ' LIMIT 1) WHERE branch_id IS NULL;

-- ============================================
-- 4. EMPLOYEES DIRECTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  designation TEXT NOT NULL,
  department TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  joining_date DATE DEFAULT CURRENT_DATE,
  employment_type TEXT DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'contract', 'part_time')),
  reporting_manager_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  salary NUMERIC,
  bank_name TEXT,
  account_number TEXT,
  ifsc_code TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'resigned', 'terminated')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. MANUFACTURERS AND MACHINE MODELS TAXONOMY
-- ============================================
CREATE TABLE IF NOT EXISTS public.manufacturers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  country TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.manufacturers (name, country) VALUES
  ('JCB', 'United Kingdom'),
  ('Hyundai', 'South Korea'),
  ('ACE', 'India'),
  ('Genie', 'United States'),
  ('Larsen & Toubro', 'India')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.machine_models (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manufacturer_id UUID NOT NULL REFERENCES public.manufacturers(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  category_id UUID REFERENCES public.machine_categories(id) ON DELETE SET NULL,
  specs JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(manufacturer_id, model_name)
);

INSERT INTO public.machine_models (manufacturer_id, model_name)
SELECT m.id, model.name
FROM public.manufacturers m
CROSS JOIN (VALUES ('3DX'), ('4DX'), ('JS210'), ('AX124'), ('GS-1930')) AS model(name)
WHERE m.name IN ('JCB', 'ACE', 'Genie')
ON CONFLICT DO NOTHING;

-- ============================================
-- 6. EXTEND MACHINES & ASSIGNMENT TABLES
-- ============================================
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS manufacturer_id UUID REFERENCES public.manufacturers(id) ON DELETE SET NULL;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS model_id UUID REFERENCES public.machine_models(id) ON DELETE SET NULL;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS ownership_type TEXT DEFAULT 'company_owned' CHECK (ownership_type IN ('company_owned', 'customer_owned', 'rental_fleet'));
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS current_operator_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS current_supervisor_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS purchase_date DATE;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS purchase_cost NUMERIC;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS warranty_end_date DATE;

-- Update existing machines with default Delhi HQ branch
UPDATE public.machines SET branch_id = (SELECT id FROM public.branches WHERE code = 'DEL-HQ' LIMIT 1) WHERE branch_id IS NULL;

-- Machine Assignments (Historical Tracking)
CREATE TABLE IF NOT EXISTS public.machine_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Machine Hour Logs (Operator Work Logs)
CREATE TABLE IF NOT EXISTS public.machine_hour_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_meter NUMERIC NOT NULL,
  end_meter NUMERIC NOT NULL,
  running_hours NUMERIC GENERATED ALWAYS AS (end_meter - start_meter) STORED,
  location TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. INVENTORY STOCK LEDGER & TRANSACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.inventory_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_number TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT DEFAULT 'Pcs',
  min_stock_level INT DEFAULT 5,
  unit_cost NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.inventory_products (part_number, name, category, unit_cost) VALUES
  ('HYD-FLT-001', 'Hydraulic Oil Filter', 'Filters', 1250),
  ('ENG-FLT-002', 'Engine Oil Filter', 'Filters', 850),
  ('AIR-FLT-003', 'Air Cleaner Element', 'Filters', 2100),
  ('HYD-SEAL-01', 'Hydraulic Cylinder Seal Kit', 'Seals', 3400),
  ('ORING-KIT-01', 'High Pressure O-Ring Set', 'Seals', 950)
ON CONFLICT (part_number) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.inventory_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.inventory_products(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, branch_id)
);

-- Seed stock for Delhi HQ and Gurgaon
INSERT INTO public.inventory_stock (product_id, branch_id, quantity)
SELECT p.id, b.id, 50
FROM public.inventory_products p
CROSS JOIN public.branches b
ON CONFLICT (product_id, branch_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_no TEXT UNIQUE NOT NULL,
  product_id UUID NOT NULL REFERENCES public.inventory_products(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('PURCHASE', 'STOCK_IN', 'STOCK_OUT', 'SERVICE_ISSUE', 'RETURN', 'TRANSFER', 'ADJUSTMENT', 'DAMAGE')),
  quantity INT NOT NULL,
  reference_id TEXT,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inter-Branch Stock Transfers
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_no TEXT UNIQUE NOT NULL,
  from_branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  to_branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.inventory_products(id) ON DELETE CASCADE,
  quantity INT NOT NULL CHECK (quantity > 0),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  accepted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. INDEXES & RLS POLICIES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON public.users(branch_id);
CREATE INDEX IF NOT EXISTS idx_machines_branch_id ON public.machines(branch_id);
CREATE INDEX IF NOT EXISTS idx_machine_assignments_machine_id ON public.machine_assignments(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_assignments_operator_id ON public.machine_assignments(operator_id);
CREATE INDEX IF NOT EXISTS idx_machine_hour_logs_machine_id ON public.machine_hour_logs(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_hour_logs_operator_id ON public.machine_hour_logs(operator_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_branch ON public.inventory_stock(branch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_branch ON public.inventory_transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_from_branch ON public.stock_transfers(from_branch_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_to_branch ON public.stock_transfers(to_branch_id);

-- Enable RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_hour_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

-- Allow authenticated read/write on new tables
CREATE POLICY "Allow authenticated read branches" ON public.branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read roles" ON public.roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read permissions" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read employees" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write employees" ON public.employees FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated read manufacturers" ON public.manufacturers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read machine_models" ON public.machine_models FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read machine_assignments" ON public.machine_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write machine_assignments" ON public.machine_assignments FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated read machine_hour_logs" ON public.machine_hour_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write machine_hour_logs" ON public.machine_hour_logs FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated read inventory_products" ON public.inventory_products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read inventory_stock" ON public.inventory_stock FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write inventory_stock" ON public.inventory_stock FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated read inventory_transactions" ON public.inventory_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write inventory_transactions" ON public.inventory_transactions FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated read stock_transfers" ON public.stock_transfers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated write stock_transfers" ON public.stock_transfers FOR ALL TO authenticated USING (true);
