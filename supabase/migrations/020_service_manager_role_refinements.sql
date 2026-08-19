-- Migration: 020_service_manager_role_refinements.sql
-- Description: Precise Permission Matrix, Service Planning, Complaint Management, FSR Review, Part Request Approval, and Branch Scoping for Service Manager

-- ============================================
-- 1. ADD MISSING GRANULAR PERMISSIONS IF NOT EXISTS
-- ============================================
INSERT INTO public.permissions (code, module, description) VALUES
  ('fsr.review', 'fsr', 'Review submitted field service reports'),
  ('fsr.approve', 'fsr', 'Approve reviewed field service reports'),
  ('part_request.approve', 'inventory', 'Approve or reject inventory part requests'),
  ('part_request.approve_service_req', 'inventory', 'Approve service requirement on part requests'),
  ('part_request.escalate', 'inventory', 'Escalate part request procurement'),
  ('complaint.escalate', 'complaint', 'Escalate critical breakdown complaints'),
  ('complaint.update_status', 'complaint', 'Update complaint lifecycle status'),
  ('service.cancel', 'service', 'Cancel or postpone service jobs'),
  ('service.reschedule', 'service', 'Reschedule service jobs'),
  ('service.complete', 'service', 'Complete service job execution'),
  ('service.approve', 'service', 'Approve service job completion'),
  ('mechanic.assign', 'service', 'Assign mechanic to workshop repairs'),
  ('engineer.workload.view', 'employee', 'View engineer workload and active assignments'),
  ('mechanic.workload.view', 'employee', 'View mechanic workload and workshop assignments')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 2. RE-SYNC ROLE_PERMISSIONS FOR SERVICE MANAGER
-- ============================================
-- Clear previous service_manager permissions mapping to ensure strict alignment
DELETE FROM public.role_permissions 
WHERE role_id = (SELECT id FROM public.roles WHERE code = 'service_manager');

-- Insert exact authorized permissions for service_manager
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'service_manager'
  AND p.code IN (
    -- Machines (View + Service Edit Only, No machine.create or machine.delete)
    'machine.view',
    'machine.edit',
    
    -- Complaints (Full Breakdown & Status Management)
    'complaint.view',
    'complaint.create',
    'complaint.assign',
    'complaint.update',
    'complaint.close',
    'complaint.escalate',
    'complaint.update_status',

    -- Services & Planning (Full Lifecycle)
    'service.view',
    'service.plan',
    'service.create',
    'service.assign',
    'service.update',
    'service.close',
    'service.cancel',
    'service.reschedule',
    'service.complete',
    'service.approve',

    -- Field Service Reports (FSR) - View + Review + Approve (No direct fsr.create or fsr.update overwrite)
    'fsr.view',
    'fsr.review',
    'fsr.approve',

    -- Inventory & Part Requests - View + Request + Service Requirement Approval (No direct stock_in/stock_out/adjust)
    'inventory.view',
    'inventory.request',
    'part_request.create',
    'part_request.view',
    'part_request.edit',
    'part_request.approve',
    'part_request.approve_service_req',
    'part_request.reject',
    'part_request.escalate',

    -- Employee Supervision & Workload (Service Staff View only, No employee.create, employee.edit, employee.delete, or employee.salary.view)
    'employee.view',
    'engineer.workload.view',
    'mechanic.workload.view',
    'mechanic.assign',

    -- Domain View Access (Operator logs & Rental status)
    'operator.view',
    'rental.view',

    -- Service Notifications
    'notification.view',
    'notification.send',

    -- Operational Reports & Audit Logs
    'report.view',
    'report.export',
    'audit.view'
  )
ON CONFLICT DO NOTHING;
