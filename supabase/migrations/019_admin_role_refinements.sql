-- Migration: 019_admin_role_refinements.sql
-- Description: Refine Role 2 — Admin RBAC permissions, branch creation restrictions, machine deactivation, and Super Admin guardrails

-- 1. Ensure permissions exist in public.permissions table
INSERT INTO public.permissions (code, module, description) VALUES
  ('branch.delete', 'branch', 'Delete company branch record')
ON CONFLICT (code) DO NOTHING;

-- 2. Clear & update role_permissions mapping table for Admin role
DELETE FROM public.role_permissions 
WHERE role_id = (SELECT id FROM public.roles WHERE code = 'admin');

-- 3. Insert authorized permissions for admin role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'admin'
  AND p.code IN (
    -- Machines (No machine.delete)
    'machine.view',
    'machine.create',
    'machine.edit',
    'machine.assign',
    
    -- Complaints
    'complaint.view',
    'complaint.create',
    'complaint.assign',
    'complaint.update',
    'complaint.close',

    -- Service & Planning
    'service.view',
    'service.plan',
    'service.create',
    'service.assign',
    'service.update',
    'service.close',

    -- Field Service Reports (FSR)
    'fsr.view',
    'fsr.create',
    'fsr.update',
    'fsr.review',
    'fsr.approve',

    -- Inventory & Part Requests
    'inventory.view',
    'inventory.create',
    'inventory.stock_in',
    'inventory.stock_out',
    'inventory.adjust',
    'inventory.transfer',
    'inventory.approve_transfer',
    'inventory.request',
    'part_request.approve',

    -- Employee & HR Supervision
    'employee.view',
    'employee.create',
    'employee.edit',
    'employee.salary.view',

    -- Rental Operations
    'rental.view',
    'rental.create',
    'rental.edit',
    'rental.approve',
    'rental.dispatch',
    'rental.return',

    -- Sales & CRM
    'sales.view',
    'sales.create',
    'sales.edit',

    -- Finance (View Only - No finance.invoice or finance.payment)
    'finance.view',

    -- Operator Logs & Notifications
    'operator.view',
    'operator.assign',
    'operator.log_approve',
    'notification.view',
    'notification.send',

    -- User Management
    'user.view',
    'user.create',
    'user.edit',
    'user.assign_role',

    -- Branch Operations (No branch.create or branch.delete)
    'branch.view',
    'branch.edit',

    -- Reports & Audit Logs (No audit.delete)
    'report.view',
    'report.export',
    'audit.view',
    'settings.view'
  )
ON CONFLICT DO NOTHING;
