-- Migration: 027_rental_manager_role_refinements.sql
-- Description: Refine Role 11 — Rental Manager RBAC permissions, rental customers, rental requests, rental agreements, delivery challans, return inspections, damage reports, extensions, billing requests, and accessories.

-- ============================================
-- 1. SEED GRANULAR RENTAL PERMISSIONS
-- ============================================
INSERT INTO public.permissions (code, module, description)
VALUES 
  ('rental.inspect', 'rental', 'Perform return inspection and record machine condition'),
  ('rental.damage_report', 'rental', 'Create damage report and forward to Service and Finance'),
  ('rental.extend', 'rental', 'Request or approve rental contract extension'),
  ('rental.cancel', 'rental', 'Cancel rental request or request contract cancellation'),
  ('rental.billing_request', 'rental', 'Generate operational rental billing request for Finance'),
  ('rental.customer_manage', 'rental', 'Create and edit rental customers and contact sites'),
  ('rental.accessory_manage', 'rental', 'Assign and track rental attachments and accessories')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 2. CREATE RENTAL CUSTOMERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.rental_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  contact_mobile TEXT NOT NULL,
  contact_email TEXT,
  billing_address TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  gstin TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. CREATE RENTAL REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.rental_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES public.rental_customers(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  contact_mobile TEXT NOT NULL,
  category_id UUID REFERENCES public.machine_categories(id) ON DELETE SET NULL,
  category_name TEXT NOT NULL,
  machine_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
  required_quantity INTEGER NOT NULL DEFAULT 1,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  site_location TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  operator_required BOOLEAN DEFAULT FALSE,
  delivery_required BOOLEAN DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'converted_to_contract')),
  remarks TEXT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. CREATE RENTAL AGREEMENTS / CONTRACTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.rental_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_number TEXT UNIQUE NOT NULL,
  rental_request_id UUID REFERENCES public.rental_requests(id) ON DELETE SET NULL,
  customer_id UUID NOT NULL REFERENCES public.rental_customers(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  actual_return_date DATE,
  rental_rate NUMERIC NOT NULL DEFAULT 0,
  rate_unit TEXT NOT NULL DEFAULT 'monthly' CHECK (rate_unit IN ('daily', 'weekly', 'monthly')),
  allowed_hours_per_day NUMERIC DEFAULT 8,
  extra_hour_rate NUMERIC DEFAULT 0,
  security_deposit NUMERIC DEFAULT 0,
  delivery_charges NUMERIC DEFAULT 0,
  operator_provided BOOLEAN DEFAULT FALSE,
  discount_percentage NUMERIC DEFAULT 0,
  requires_discount_approval BOOLEAN DEFAULT FALSE,
  discount_approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  terms_conditions TEXT,
  dispatch_date TIMESTAMPTZ,
  return_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'active', 'extended', 'returned', 'closed', 'cancelled', 'rejected', 'expired')),
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. CREATE RENTAL DELIVERY CHALLANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.rental_delivery_challans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_number TEXT UNIQUE NOT NULL,
  rental_agreement_id UUID NOT NULL REFERENCES public.rental_agreements(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.rental_customers(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  dispatch_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  site_location TEXT NOT NULL,
  transport_details TEXT,
  driver_name TEXT,
  driver_contact TEXT,
  operator_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  start_hour_meter NUMERIC NOT NULL DEFAULT 0,
  start_fuel_level NUMERIC DEFAULT 100,
  accessories_dispatched JSONB DEFAULT '[]'::jsonb,
  machine_condition TEXT DEFAULT 'Excellent',
  remarks TEXT,
  dispatch_signature TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'cancelled')),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. CREATE RENTAL RETURN INSPECTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.rental_return_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_number TEXT UNIQUE NOT NULL,
  rental_agreement_id UUID NOT NULL REFERENCES public.rental_agreements(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.rental_customers(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  return_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_hour_meter NUMERIC NOT NULL DEFAULT 0,
  end_fuel_level NUMERIC DEFAULT 100,
  exterior_condition TEXT DEFAULT 'Good',
  tyres_condition TEXT DEFAULT 'Good',
  engine_condition TEXT DEFAULT 'Good',
  hydraulics_condition TEXT DEFAULT 'Good',
  attachments_condition TEXT DEFAULT 'Good',
  safety_equipment_condition TEXT DEFAULT 'Good',
  missing_accessories JSONB DEFAULT '[]'::jsonb,
  has_damage BOOLEAN DEFAULT FALSE,
  damage_description TEXT,
  damage_photo_urls JSONB DEFAULT '[]'::jsonb,
  estimated_repair_cost NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'passed' CHECK (status IN ('passed', 'failed_damaged', 'under_inspection')),
  inspected_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. CREATE RENTAL DAMAGE REPORTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.rental_damage_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number TEXT UNIQUE NOT NULL,
  inspection_id UUID REFERENCES public.rental_return_inspections(id) ON DELETE CASCADE,
  rental_agreement_id UUID NOT NULL REFERENCES public.rental_agreements(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.rental_customers(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  damage_details TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor', 'moderate', 'severe')),
  service_manager_notified BOOLEAN DEFAULT TRUE,
  service_request_id UUID REFERENCES public.machine_complaints(id) ON DELETE SET NULL,
  finance_notified BOOLEAN DEFAULT TRUE,
  damage_charge_amount NUMERIC DEFAULT 0,
  customer_notified BOOLEAN DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'under_assessment', 'charged', 'resolved')),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. CREATE RENTAL EXTENSION REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.rental_extension_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT UNIQUE NOT NULL,
  rental_agreement_id UUID NOT NULL REFERENCES public.rental_agreements(id) ON DELETE CASCADE,
  current_end_date DATE NOT NULL,
  proposed_end_date DATE NOT NULL,
  extension_days INTEGER NOT NULL,
  additional_amount NUMERIC DEFAULT 0,
  availability_status TEXT NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available', 'conflict_reserved')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. CREATE RENTAL BILLING REQUESTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.rental_billing_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT UNIQUE NOT NULL,
  rental_agreement_id UUID NOT NULL REFERENCES public.rental_agreements(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.rental_customers(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  billing_period_start DATE NOT NULL,
  billing_period_end DATE NOT NULL,
  base_rental_amount NUMERIC NOT NULL DEFAULT 0,
  additional_hours_amount NUMERIC DEFAULT 0,
  transport_charges NUMERIC DEFAULT 0,
  damage_charges NUMERIC DEFAULT 0,
  security_deposit_adjusted NUMERIC DEFAULT 0,
  total_billable_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'submitted_to_finance' CHECK (status IN ('submitted_to_finance', 'invoiced', 'paid', 'rejected')),
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. CREATE RENTAL ACCESSORIES LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.rental_accessories_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rental_agreement_id UUID NOT NULL REFERENCES public.rental_agreements(id) ON DELETE CASCADE,
  accessory_name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  dispatch_condition TEXT DEFAULT 'Good',
  return_condition TEXT,
  is_returned BOOLEAN DEFAULT FALSE,
  is_damaged BOOLEAN DEFAULT FALSE,
  damage_remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. ENABLE RLS POLICIES FOR NEW TABLES
-- ============================================
ALTER TABLE public.rental_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_delivery_challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_return_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_damage_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_extension_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_billing_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_accessories_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permit authenticated view rental_customers" ON public.rental_customers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated insert rental_customers" ON public.rental_customers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated update rental_customers" ON public.rental_customers FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Permit authenticated view rental_requests" ON public.rental_requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated insert rental_requests" ON public.rental_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated update rental_requests" ON public.rental_requests FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Permit authenticated view rental_agreements" ON public.rental_agreements FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated insert rental_agreements" ON public.rental_agreements FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated update rental_agreements" ON public.rental_agreements FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Permit authenticated view rental_delivery_challans" ON public.rental_delivery_challans FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated insert rental_delivery_challans" ON public.rental_delivery_challans FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated update rental_delivery_challans" ON public.rental_delivery_challans FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Permit authenticated view rental_return_inspections" ON public.rental_return_inspections FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated insert rental_return_inspections" ON public.rental_return_inspections FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Permit authenticated view rental_damage_reports" ON public.rental_damage_reports FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated insert rental_damage_reports" ON public.rental_damage_reports FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Permit authenticated view rental_extension_requests" ON public.rental_extension_requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated insert rental_extension_requests" ON public.rental_extension_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Permit authenticated view rental_billing_requests" ON public.rental_billing_requests FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated insert rental_billing_requests" ON public.rental_billing_requests FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Permit authenticated view rental_accessories_log" ON public.rental_accessories_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated insert rental_accessories_log" ON public.rental_accessories_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- 12. RE-SYNC ROLE_PERMISSIONS FOR RENTAL_MANAGER
-- ============================================
DELETE FROM public.role_permissions 
WHERE role_id = (SELECT id FROM public.roles WHERE code = 'rental_manager');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'rental_manager'
  AND p.code IN (
    -- Machine Management (View & Limited Rental Edit)
    'machine.view',
    'machine.edit',

    -- Complete Rental Operations
    'rental.view',
    'rental.create',
    'rental.edit',
    'rental.approve',
    'rental.dispatch',
    'rental.return',
    'rental.inspect',
    'rental.damage_report',
    'rental.extend',
    'rental.cancel',
    'rental.billing_request',
    'rental.customer_manage',
    'rental.accessory_manage',

    -- Service & Breakdown Coordination
    'complaint.create',
    'complaint.view',
    'service.view',
    'fsr.view',

    -- Inventory & Accessories View/Request
    'inventory.view',
    'inventory.request',
    'part_request.create',
    'part_request.view',

    -- Challan Creation
    'challan.view',
    'challan.create',
    'challan.edit',

    -- Employee Directory (Assigned operators, drivers, coordinators)
    'employee.view',

    -- Sales & CRM Context (Rental Enquiries & Opportunities)
    'sales.view',
    'sales.create',
    'sales.edit',

    -- Finance View (Rental amounts, deposits, billing requests, revenue)
    'finance.view',

    -- Branch Context (Assigned Branch)
    'branch.view',

    -- Rental Notifications & Reminders
    'notification.view',
    'notification.send',

    -- Reports & Analytics
    'report.view',
    'report.export',

    -- Audit Logs (Rental Scope)
    'audit.view',

    -- Rental System Settings
    'settings.view',
    'settings.edit'
  );

-- Ensure super_admin and admin have all new rental permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('super_admin', 'admin')
  AND p.code IN (
    'rental.inspect',
    'rental.damage_report',
    'rental.extend',
    'rental.cancel',
    'rental.billing_request',
    'rental.customer_manage',
    'rental.accessory_manage'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;
