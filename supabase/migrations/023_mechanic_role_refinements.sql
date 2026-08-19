-- Migration: 022_mechanic_role_refinements.sql
-- Description: Refine Role 7 — Mechanic RBAC permissions, assigned workload scoping, complaint creation, FSR details entry, and part request workflows

-- 1. Ensure permissions exist in public.permissions table
INSERT INTO public.permissions (code, module, description) VALUES
  ('part_request.create', 'inventory', 'Create spare part requests for repair jobs'),
  ('part_request.view', 'inventory', 'View status of spare part requests')
ON CONFLICT (code) DO NOTHING;

-- 2. Clear previous permissions mapping for mechanic role
DELETE FROM public.role_permissions 
WHERE role_id IN (
  SELECT id FROM public.roles WHERE code = 'mechanic'
);

-- 3. Insert authorized permissions for mechanic
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'mechanic'
  AND p.code IN (
    -- Machines (View assigned machines only)
    'machine.view',

    -- Complaints (View assigned complaints, create new breakdown complaints, update diagnosis/notes)
    'complaint.view',
    'complaint.create',
    'complaint.update',

    -- Service & Repair Jobs (View assigned jobs, update status & completion recommendation)
    'service.view',
    'service.update',

    -- Field Service Reports (FSR) - View assigned FSR, add repair details & work completed
    'fsr.view',
    'fsr.create',
    'fsr.update',

    -- Inventory & Spare Parts (View spare parts catalog & create/track part requests)
    'inventory.view',
    'inventory.request',
    'part_request.create',
    'part_request.view',

    -- Operator Logs & Rental Context (View machine-related operating context)
    'operator.view',
    'rental.view',

    -- Personal Repair Notifications
    'notification.view',

    -- Personal Performance & Audit Activity
    'report.view',
    'audit.view'
  )
ON CONFLICT DO NOTHING;
