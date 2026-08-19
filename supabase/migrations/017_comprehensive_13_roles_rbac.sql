-- Migration: 017_comprehensive_13_roles_rbac.sql
-- Description: Comprehensive 13-Role RBAC System, Permissions Seed, Check Constraints, and Multi-Branch RLS Policies

-- ============================================
-- 1. SEED ALL 13 SYSTEM ROLES IN ROLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.roles (code, name, description) VALUES
  ('super_admin', 'Super Admin', 'Entire platform and multi-branch company control'),
  ('admin', 'Admin', 'Day-to-day platform administration and user onboarding'),
  ('branch_manager', 'Branch Manager', 'Complete operational control of assigned branch fleet, inventory, and staff'),
  ('service_manager', 'Service Manager', 'Complete machine service schedule planning, breakdown assignment, and FSR review'),
  ('service_engineer', 'Service Engineer', 'Field service execution, breakdown diagnosis, component inspection, and FSR submission'),
  ('supervisor', 'Supervisor', 'Field operations monitoring, breakdown complaint logging, and daily log verification'),
  ('mechanic', 'Mechanic', 'Workshop repairs, minor maintenance, photo upload, and spare parts requests'),
  ('operator', 'Operator', 'Machine operation, daily start/end meter readings, and breakdown reporting'),
  ('store_manager', 'Store Manager', 'Branch inventory ledger, receiving/issuing stock, GRN, and inter-branch transfers'),
  ('hr_manager', 'HR Manager', 'Workforce directory, employee onboarding, attendance, leave, and payroll'),
  ('rental_manager', 'Rental Manager', 'Machinery rental agreements, customer assignments, contract dispatches, and returns'),
  ('sales_executive', 'Sales Executive', 'Customer leads, equipment quotations, opportunities, and sales pipeline'),
  ('finance_manager', 'Finance Manager', 'Invoices, payment processing, revenue breakdown, and financial reports')
ON CONFLICT (code) DO UPDATE SET 
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- ============================================
-- 2. GRANULAR SYSTEM PERMISSIONS SEED
-- ============================================
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  module TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.permissions (code, module, description) VALUES
  -- Machines
  ('machine.view', 'machine', 'View machine directory and details'),
  ('machine.create', 'machine', 'Create new machine record'),
  ('machine.edit', 'machine', 'Edit machine details and specifications'),
  ('machine.delete', 'machine', 'Delete machine record'),
  ('machine.assign', 'machine', 'Assign operators and supervisors to machines'),

  -- Breakdown Complaints
  ('complaint.view', 'complaint', 'View machine breakdown complaints'),
  ('complaint.create', 'complaint', 'Raise breakdown complaint'),
  ('complaint.assign', 'complaint', 'Assign mechanics and engineers to complaints'),
  ('complaint.update', 'complaint', 'Update complaint work status'),
  ('complaint.close', 'complaint', 'Verify and resolve breakdown complaints'),

  -- Service & Planning
  ('service.view', 'service', 'View service schedule and history'),
  ('service.plan', 'service', 'Create and modify service schedule'),
  ('service.create', 'service', 'Log service record'),
  ('service.assign', 'service', 'Assign engineers to service jobs'),
  ('service.update', 'service', 'Update service status and details'),
  ('service.close', 'service', 'Complete service schedule'),

  -- Field Service Reports (FSR)
  ('fsr.view', 'fsr', 'View field service reports'),
  ('fsr.create', 'fsr', 'Create new field service report'),
  ('fsr.update', 'fsr', 'Update field service report'),
  ('fsr.review', 'fsr', 'Review submitted FSR'),
  ('fsr.approve', 'fsr', 'Approve or reject FSR'),

  -- Inventory & Stock Ledger
  ('inventory.view', 'inventory', 'View spare parts inventory stock'),
  ('inventory.create', 'inventory', 'Add new inventory product'),
  ('inventory.stock_in', 'inventory', 'Receive incoming stock / GRN'),
  ('inventory.stock_out', 'inventory', 'Issue spare parts for breakdown repairs'),
  ('inventory.adjust', 'inventory', 'Adjust inventory stock level'),
  ('inventory.transfer', 'inventory', 'Initiate inter-branch transfers'),
  ('inventory.approve_transfer', 'inventory', 'Approve inter-branch transfers'),
  ('inventory.request', 'inventory', 'Request spare parts from store'),

  -- Employee & HR
  ('employee.view', 'employee', 'View employee directory'),
  ('employee.create', 'employee', 'Create employee record'),
  ('employee.edit', 'employee', 'Edit employee profile'),
  ('employee.delete', 'employee', 'Deactivate employee record'),
  ('employee.salary.view', 'employee', 'View sensitive salary and payroll data'),

  -- Rental Management
  ('rental.view', 'rental', 'View rental contracts and dispatches'),
  ('rental.create', 'rental', 'Create rental agreement'),
  ('rental.edit', 'rental', 'Edit rental agreement'),
  ('rental.approve', 'rental', 'Approve rental agreement'),
  ('rental.dispatch', 'rental', 'Dispatch rental machine'),
  ('rental.return', 'rental', 'Process machine rental return'),

  -- Sales & CRM
  ('sales.view', 'sales', 'View customer leads and sales pipeline'),
  ('sales.create', 'sales', 'Create new customer lead'),
  ('sales.edit', 'sales', 'Edit customer lead and opportunity'),
  ('sales.quotation', 'sales', 'Generate equipment sales quotation'),

  -- Finance & Billing
  ('finance.view', 'finance', 'View invoices and payment ledgers'),
  ('finance.invoice', 'finance', 'Create and send billing invoice'),
  ('finance.payment', 'finance', 'Record payment transaction'),
  ('finance.report', 'finance', 'View financial revenue reports'),

  -- User & RBAC
  ('user.view', 'user', 'View system users and status'),
  ('user.create', 'user', 'Create new user account'),
  ('user.edit', 'user', 'Edit user details and status'),
  ('user.delete', 'user', 'Deactivate user account'),
  ('user.assign_role', 'user', 'Assign or change user RBAC role'),

  -- Branches
  ('branch.view', 'branch', 'View branches'),
  ('branch.create', 'branch', 'Create new branch'),
  ('branch.edit', 'branch', 'Edit branch details'),

  -- Audit & Settings
  ('report.view', 'report', 'View operational reports'),
  ('report.export', 'report', 'Export PDF and Excel reports'),
  ('audit.view', 'audit', 'View system audit logs'),
  ('settings.view', 'settings', 'View platform settings'),
  ('settings.edit', 'settings', 'Modify global platform settings')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 3. ENSURE USER ROLE CHECK CONSTRAINTS
-- ============================================
DO $$ 
BEGIN
  -- Update check constraint on users table if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_role_check' AND table_name = 'users'
  ) THEN
    ALTER TABLE public.users DROP CONSTRAINT users_role_check;
  END IF;

  ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (
    role IN (
      'super_admin', 'admin', 'branch_manager', 'service_manager', 
      'service_engineer', 'engineer', 'supervisor', 'store_manager', 
      'operator', 'mechanic', 'hr_manager', 'finance_manager', 
      'sales_executive', 'rental_manager'
    )
  );
END $$;

-- ============================================
-- 4. MULTI-BRANCH & SCOPED ROW LEVEL SECURITY
-- ============================================
-- Ensure user_branches junction table exists
CREATE TABLE IF NOT EXISTS public.user_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, branch_id)
);

-- Enable RLS on core tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_complaints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_products ENABLE ROW LEVEL SECURITY;

-- Helper RLS function to check user branch access
CREATE OR REPLACE FUNCTION public.auth_user_has_branch_access(target_branch_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  u_role TEXT;
  u_id UUID;
BEGIN
  u_id := auth.uid();
  IF u_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT role INTO u_role FROM public.users WHERE id = u_id;
  
  -- Super admin & Admin access all branches
  IF u_role IN ('super_admin', 'admin') THEN
    RETURN TRUE;
  END IF;

  -- Null branch on target is accessible to logged in users
  IF target_branch_id IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Check direct branch assignment or user_branches junction
  RETURN EXISTS (
    SELECT 1 FROM public.users WHERE id = u_id AND branch_id = target_branch_id
    UNION
    SELECT 1 FROM public.user_branches WHERE user_id = u_id AND branch_id = target_branch_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
