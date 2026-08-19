-- Migration: 018_branch_manager_role_refinements.sql
-- Description: Precise Permission Matrix, Branch Scoping, FSR Review, Part Request Approval, and Deactivation Workflows for Branch Manager

-- ============================================
-- 1. ADD MISSING GRANULAR PERMISSIONS IF NOT EXISTS
-- ============================================
INSERT INTO public.permissions (code, module, description) VALUES
  ('fsr.review', 'fsr', 'Review submitted field service reports'),
  ('part_request.approve', 'inventory', 'Approve or reject inventory part requests'),
  ('machine.request_deactivation', 'machine', 'Request machine deactivation or archival'),
  ('machine.transfer_request', 'machine', 'Request inter-branch machine transfer')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 2. RE-SYNC ROLE_PERMISSIONS FOR BRANCH MANAGER
-- ============================================
-- Clear previous branch_manager permissions mapping to ensure strict alignment
DELETE FROM public.role_permissions 
WHERE role_id = (SELECT id FROM public.roles WHERE code = 'branch_manager');

-- Insert exact authorized permissions for branch_manager
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'branch_manager'
  AND p.code IN (
    -- Machines
    'machine.view',
    'machine.create',
    'machine.edit',
    'machine.assign',
    'machine.request_deactivation',
    'machine.transfer_request',
    
    -- Complaints
    'complaint.view',
    'complaint.create',
    'complaint.assign',
    'complaint.update',
    'complaint.close',

    -- Services & Planning
    'service.view',
    'service.plan',
    'service.create',
    'service.assign',
    'service.update',
    'service.close',

    -- Field Service Reports (FSR) - View + Review Only (No fsr.create or fsr.update directly)
    'fsr.view',
    'fsr.review',

    -- Inventory & Part Requests - View + Approve Requests (No direct stock_in/stock_out/adjust)
    'inventory.view',
    'inventory.transfer',
    'inventory.approve_transfer',
    'inventory.request',
    'part_request.approve',

    -- Employee Supervision (View only, No employee.create, employee.edit, employee.delete, or employee.salary.view)
    'employee.view',

    -- Domain View Access
    'rental.view',
    'sales.view',
    'finance.view',
    'user.view',

    -- Operational Reports & Audit Logs
    'report.view',
    'report.export',
    'audit.view'
  )
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. ENSURE BRANCH MANAGER RLS SCOPING
-- ============================================
-- Helper to check if a user is a branch manager or branch-scoped user
CREATE OR REPLACE FUNCTION public.auth_user_get_branch_ids()
RETURNS TABLE (branch_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT u.branch_id FROM public.users u WHERE u.id = auth.uid() AND u.branch_id IS NOT NULL
  UNION
  SELECT ub.branch_id FROM public.user_branches ub WHERE ub.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Index performance boost for user branch lookups
CREATE INDEX IF NOT EXISTS idx_user_branches_user_id ON public.user_branches(user_id);
CREATE INDEX IF NOT EXISTS idx_user_branches_branch_id ON public.user_branches(branch_id);
