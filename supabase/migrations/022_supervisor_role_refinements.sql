-- Migration: 022_supervisor_role_refinements.sql
-- Description: Refine Role 6 — Supervisor RBAC permissions, branch-scoped monitoring, meter log verification, breakdown reporting, and part request creation

-- ============================================
-- 1. EXTEND MACHINE HOUR LOGS FOR VERIFICATION
-- ============================================
ALTER TABLE public.machine_hour_logs 
  ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected', 'correction_requested')),
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS verification_remarks TEXT,
  ADD COLUMN IF NOT EXISTS fuel_consumed NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shift TEXT DEFAULT 'day';

-- ============================================
-- 2. RE-SYNC ROLE_PERMISSIONS FOR SUPERVISOR
-- ============================================
-- Clear previous supervisor permissions mapping to ensure strict alignment
DELETE FROM public.role_permissions 
WHERE role_id = (SELECT id FROM public.roles WHERE code = 'supervisor');

-- Insert exact authorized permissions for supervisor
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'supervisor'
  AND p.code IN (
    -- Machines (View assigned machines + Limited operational updates: status, remarks, hour meter)
    'machine.view',
    'machine.edit',

    -- Breakdown Complaints (Full reporting access & status/observation updates)
    'complaint.view',
    'complaint.create',
    'complaint.update',

    -- Services (View service schedule & engineer progress)
    'service.view',

    -- Field Service Reports (View FSR for assigned machines)
    'fsr.view',

    -- Inventory & Spare Parts (View catalog & Request parts for breakdowns)
    'inventory.view',
    'inventory.request',
    'part_request.create',
    'part_request.view',

    -- Operator Oversight & Daily Meter Log Verification
    'operator.view',
    'operator.log_approve',

    -- Employee Supervision (Limited employee directory view: name, ID, branch, designation, work assignment)
    'employee.view',

    -- Rental Management (Machine operational status view only)
    'rental.view',

    -- Operational Notifications & Alerts
    'notification.view',
    'notification.send',

    -- Operational Reports & Audit Logs
    'report.view',
    'report.export',
    'audit.view'
  )
ON CONFLICT DO NOTHING;
