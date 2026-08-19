-- Migration: 020_service_engineer_role_refinements.sql
-- Description: Refine Role 5 — Service Engineer RBAC permissions, assigned workload scoping, FSR creation/editing, and part request workflows

-- 1. Ensure permissions exist in public.permissions table
INSERT INTO public.permissions (code, module, description) VALUES
  ('fsr.create', 'fsr', 'Create new field service report'),
  ('fsr.update', 'fsr', 'Update field service report details before approval')
ON CONFLICT (code) DO NOTHING;

-- 2. Clear previous permissions mapping for service_engineer and engineer roles
DELETE FROM public.role_permissions 
WHERE role_id IN (
  SELECT id FROM public.roles WHERE code IN ('service_engineer', 'engineer')
);

-- 3. Insert authorized permissions for service_engineer and engineer
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('service_engineer', 'engineer')
  AND p.code IN (
    -- Machines (View Only for assigned machines)
    'machine.view',

    -- Complaints (Assigned complaints view, update status, diagnosis & close request)
    'complaint.view',
    'complaint.update',
    'complaint.close',

    -- Services (Assigned service jobs view, update work progress & completion)
    'service.view',
    'service.update',
    'service.close',

    -- Field Service Reports (FSR) - Create & Edit assigned FSRs
    'fsr.view',
    'fsr.create',
    'fsr.update',

    -- Inventory & Spare Parts (View catalog & Request parts)
    'inventory.view',
    'inventory.request',

    -- Operator Logs & Daily Meter Readings
    'operator.view',

    -- Notifications & Alerts
    'notification.view',

    -- Personal Performance & Workload Reports
    'report.view',
    'audit.view'
  )
ON CONFLICT DO NOTHING;
