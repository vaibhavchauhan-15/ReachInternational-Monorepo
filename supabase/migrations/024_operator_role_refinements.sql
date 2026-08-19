-- Migration: 024_operator_role_refinements.sql
-- Description: Refine Role 8 — Operator RBAC permissions, shift & hour meter logging, breakdown reporting, part request creation, and self-log corrections

-- ============================================
-- 1. EXTEND MACHINE HOUR LOGS FOR OPERATOR SHIFT & CONDITION
-- ============================================
ALTER TABLE public.machine_hour_logs 
  ADD COLUMN IF NOT EXISTS start_fuel_level NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS machine_condition TEXT DEFAULT 'good' CHECK (machine_condition IN ('good', 'fair', 'needs_attention', 'breakdown')),
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'under_verification', 'approved', 'rejected', 'correction_required'));

-- Ensure permissions table includes operator log actions if missing
INSERT INTO public.permissions (code, module, description)
VALUES 
  ('operator.log_create', 'operator', 'Log daily machine shift starting/ending meter and fuel'),
  ('operator.log_edit', 'operator', 'Edit draft or rejected meter log and resubmit')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 2. RE-SYNC ROLE_PERMISSIONS FOR OPERATOR
-- ============================================
-- Clear previous operator permissions mapping to ensure strict alignment
DELETE FROM public.role_permissions 
WHERE role_id = (SELECT id FROM public.roles WHERE code = 'operator');

-- Insert exact authorized permissions for operator
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'operator'
  AND p.code IN (
    -- Machines (View assigned machine context only)
    'machine.view',

    -- Breakdown Complaints (Report breakdown & follow-up comments on own complaints)
    'complaint.view',
    'complaint.create',
    'complaint.update',

    -- Service & FSR (View service alerts & FSR reports for assigned machine)
    'service.view',
    'fsr.view',

    -- Operator Logs & Daily Shift
    'operator.view',
    'operator.log_create',
    'operator.log_edit',

    -- Inventory Part Requests (Request consumables / parts only)
    'part_request.create',
    'part_request.view',

    -- Rental (View machine context if rented)
    'rental.view',

    -- Notifications & Personal Reports / Audit Activity
    'notification.view',
    'notification.send',
    'report.view',
    'audit.view'
  );
