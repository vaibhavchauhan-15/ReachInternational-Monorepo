-- Migration: 026_hr_manager_role_refinements.sql
-- Description: Refine Role 10 — HR Manager RBAC permissions, employee status lifecycle, departments, designations, salary history, employee documents, and user account requests.

-- ============================================
-- 1. SEED GRANULAR HR PERMISSIONS
-- ============================================
INSERT INTO public.permissions (code, module, description)
VALUES 
  ('employee.onboard', 'hr', 'Onboard new employee and initiate system user setup'),
  ('employee.status_change', 'hr', 'Change employee status across onboarding, active, notice period, inactive, archived'),
  ('department.manage', 'hr', 'Create, edit, and manage departments'),
  ('designation.manage', 'hr', 'Create, edit, and manage designations'),
  ('user_request.create', 'hr', 'Request system user account creation or deactivation from Admin'),
  ('user_request.view', 'hr', 'View status of employee system account requests'),
  ('employee.document.manage', 'hr', 'Upload and manage employee joining, identity, and qualification documents'),
  ('employee.salary.create', 'hr', 'Create initial salary and compensation records'),
  ('employee.salary.edit', 'hr', 'Create salary revisions and compensation updates')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 2. UPDATE EMPLOYEES STATUS CONSTRAINT
-- ============================================
ALTER TABLE public.employees DROP CONSTRAINT IF EXISTS employees_status_check;
ALTER TABLE public.employees ADD CONSTRAINT employees_status_check 
  CHECK (status IN ('pending_onboarding', 'active', 'on_leave', 'notice_period', 'resigned', 'terminated', 'retired', 'inactive', 'archived'));

-- ============================================
-- 3. DEPARTMENTS MASTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.departments (code, name, description)
VALUES
  ('DEP-SERVICE', 'Service', 'Machine field service, maintenance, and technical repairs'),
  ('DEP-STORE', 'Store', 'Parts inventory, warehouse, procurement, and stock handling'),
  ('DEP-SALES', 'Sales', 'Client acquisition, quotations, machine sales, and account management'),
  ('DEP-FINANCE', 'Finance', 'Financial accounting, billing, invoicing, and revenue tracking'),
  ('DEP-HR', 'HR', 'Human resources, talent management, onboarding, and staff welfare'),
  ('DEP-OPS', 'Operations', 'Machine fleet dispatch, operator management, and site supervision'),
  ('DEP-ADMIN', 'Administration', 'General office management, compliance, and corporate facilities'),
  ('DEP-RENTAL', 'Rental', 'Machine rental contracts, leasing, and fleet allocation')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 4. DESIGNATIONS MASTER TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.designations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  department_code TEXT REFERENCES public.departments(code) ON DELETE SET NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.designations (code, title, department_code, description)
VALUES
  ('DES-SVC-ENG', 'Service Engineer', 'DEP-SERVICE', 'Field inspection, troubleshooting, service job execution'),
  ('DES-MCH', 'Mechanic', 'DEP-SERVICE', 'Hands-on equipment repairs and maintenance'),
  ('DES-OPR', 'Operator', 'DEP-OPS', 'Heavy equipment machine operation and meter logging'),
  ('DES-SUP', 'Supervisor', 'DEP-OPS', 'Site operation supervision and shift log verification'),
  ('DES-STR-MGR', 'Store Manager', 'DEP-STORE', 'Inventory master, stock operations, and procurement'),
  ('DES-BR-MGR', 'Branch Manager', 'DEP-ADMIN', 'Overall branch operational management and approvals'),
  ('DES-SLS-EXE', 'Sales Executive', 'DEP-SALES', 'Client relationship, sales lead, and quotation management'),
  ('DES-FIN-MGR', 'Finance Manager', 'DEP-FINANCE', 'Financial ledgers, payments, and invoice oversight'),
  ('DES-HR-MGR', 'HR Manager', 'DEP-HR', 'Employee lifecycle, onboarding, and salary administration')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 5. EMPLOYEE SALARY HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.employee_salary_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  salary NUMERIC NOT NULL,
  fixed_component NUMERIC DEFAULT 0,
  variable_component NUMERIC DEFAULT 0,
  ctc NUMERIC,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. EMPLOYEE DOCUMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('joining', 'identity', 'qualification', 'employment', 'offer_letter', 'appointment_letter', 'resignation', 'experience', 'other')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size_bytes INTEGER,
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. USER ACCOUNT REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_account_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('create_account', 'deactivate_account', 'role_change')),
  requested_role TEXT DEFAULT 'service_engineer',
  target_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS POLICIES FOR NEW TABLES
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.designations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_salary_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_account_requests ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view departments and designations
CREATE POLICY "Permit authenticated view departments" ON public.departments FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated view designations" ON public.designations FOR SELECT USING (auth.role() = 'authenticated');

-- Allow authenticated users to manage salary, documents, user requests
CREATE POLICY "Permit authenticated view salary history" ON public.employee_salary_history FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated insert salary history" ON public.employee_salary_history FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Permit authenticated view documents" ON public.employee_documents FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated insert documents" ON public.employee_documents FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Permit authenticated view user account requests" ON public.user_account_requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated insert user account requests" ON public.user_account_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated update user account requests" ON public.user_account_requests FOR UPDATE USING (auth.role() = 'authenticated');

-- ============================================
-- 8. RE-SYNC ROLE_PERMISSIONS FOR HR_MANAGER
-- ============================================
DELETE FROM public.role_permissions 
WHERE role_id = (SELECT id FROM public.roles WHERE code = 'hr_manager');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'hr_manager'
  AND p.code IN (
    -- Employee Directory & Onboarding
    'employee.view',
    'employee.create',
    'employee.edit',
    'employee.delete',
    'employee.onboard',
    'employee.status_change',
    
    -- Salary & Payroll Management
    'employee.salary.view',
    'employee.salary.create',
    'employee.salary.edit',

    -- Departments & Designations Master Data
    'department.manage',
    'designation.manage',

    -- Employee Documents
    'employee.document.manage',

    -- User Account Collaboration (Requesting user creation/deactivation)
    'user_request.create',
    'user_request.view',
    'user.view',

    -- Branch Context & Staff Allocation View
    'branch.view',

    -- HR Notifications
    'notification.view',
    'notification.send',

    -- Reports & HR Analytics
    'report.view',
    'report.export',

    -- Audit Logs (HR Scope)
    'audit.view',

    -- HR Specific Settings
    'settings.view',
    'settings.edit'
  );

-- Also ensure super_admin and admin have all new permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('super_admin', 'admin')
  AND p.code IN (
    'employee.onboard',
    'employee.status_change',
    'department.manage',
    'designation.manage',
    'user_request.create',
    'user_request.view',
    'employee.document.manage',
    'employee.salary.create',
    'employee.salary.edit'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;
