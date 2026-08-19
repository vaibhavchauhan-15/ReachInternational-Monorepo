-- Migration: 028_sales_manager_role_refinements.sql
-- Description: Refine Role 12 — Sales Manager / Sales Executive RBAC permissions, leads, customers, interactions, opportunities, versioned quotations, discount approval thresholds, sales orders, machine reservations, delivery coordinations, and sales settings.

-- ============================================
-- 1. SEED GRANULAR SALES PERMISSIONS
-- ============================================
INSERT INTO public.permissions (code, module, description)
VALUES 
  ('sales.lead_manage', 'sales', 'Create, edit, assign, change status, and convert sales leads'),
  ('sales.customer_manage', 'sales', 'Create, edit, archive sales customers and contacts'),
  ('sales.interaction_log', 'sales', 'Log phone calls, meetings, site visits, and follow-ups'),
  ('sales.opportunity_manage', 'sales', 'Create and manage sales opportunities and pipeline'),
  ('sales.quotation_manage', 'sales', 'Create, edit draft, send, duplicate, and revise quotations'),
  ('sales.discount_approve', 'sales', 'Approve quotation discounts within authorized limits'),
  ('sales.order_manage', 'sales', 'Create and manage sales orders'),
  ('sales.order_approve', 'sales', 'Approve high-value or special-term sales orders'),
  ('sales.machine_reserve', 'sales', 'Request and reserve machine for confirmed sales order'),
  ('sales.delivery_coordinate', 'sales', 'Request delivery and provide customer delivery instructions'),
  ('sales.handover_coordinate', 'sales', 'Coordinate customer handover and upload signed documents'),
  ('sales.settings_manage', 'sales', 'Manage sales stages, lead sources, and approved pricing lists')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 2. CREATE SALES LEADS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.sales_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_number TEXT UNIQUE NOT NULL,
  lead_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  location TEXT,
  city TEXT NOT NULL DEFAULT 'Delhi',
  state TEXT NOT NULL DEFAULT 'Delhi',
  requirement TEXT,
  machine_model TEXT,
  category_id UUID REFERENCES public.machine_categories(id) ON DELETE SET NULL,
  expected_quantity INTEGER NOT NULL DEFAULT 1,
  expected_purchase_date DATE,
  lead_source TEXT DEFAULT 'Direct Inquiry',
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Qualified', 'Requirement Identified', 'Quotation', 'Negotiation', 'Won', 'Lost')),
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. CREATE SALES CUSTOMERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.sales_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code TEXT UNIQUE NOT NULL,
  company_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  billing_address TEXT,
  shipping_address TEXT,
  city TEXT NOT NULL DEFAULT 'Delhi',
  state TEXT NOT NULL DEFAULT 'Delhi',
  gstin TEXT,
  credit_limit NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. CREATE SALES CUSTOMER INTERACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.sales_customer_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES public.sales_customers(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.sales_leads(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('Phone Call', 'Meeting', 'Email', 'Site Visit', 'Requirement Note', 'Negotiation Note', 'Customer Feedback')),
  summary TEXT NOT NULL,
  notes TEXT,
  follow_up_date TIMESTAMPTZ,
  salesperson_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. CREATE SALES OPPORTUNITIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.sales_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opp_number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  customer_id UUID REFERENCES public.sales_customers(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES public.sales_leads(id) ON DELETE SET NULL,
  machine_model TEXT NOT NULL,
  category_id UUID REFERENCES public.machine_categories(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  expected_value NUMERIC NOT NULL DEFAULT 0,
  expected_closing_date DATE,
  probability INTEGER DEFAULT 50 CHECK (probability >= 0 AND probability <= 100),
  stage TEXT NOT NULL DEFAULT 'Qualified' CHECK (stage IN ('Lead', 'Qualified', 'Opportunity', 'Quotation', 'Negotiation', 'Order Won', 'Order Lost')),
  competitor TEXT,
  requirement_notes TEXT,
  salesperson_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. CREATE SALES QUOTATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.sales_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number TEXT UNIQUE NOT NULL,
  revision_number INTEGER NOT NULL DEFAULT 1,
  parent_quotation_id UUID REFERENCES public.sales_quotations(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES public.sales_opportunities(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.sales_customers(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  machine_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
  machine_model TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  tax_percent NUMERIC DEFAULT 18,
  tax_amount NUMERIC DEFAULT 0,
  delivery_charges NUMERIC DEFAULT 0,
  transport_charges NUMERIC DEFAULT 0,
  subtotal NUMERIC DEFAULT 0,
  grand_total NUMERIC DEFAULT 0,
  warranty_terms TEXT DEFAULT '1 Year Standard Manufacturer Warranty',
  payment_terms TEXT DEFAULT '100% Advance against PI',
  delivery_terms TEXT DEFAULT 'Within 7 Business Days',
  validity_period DATE,
  remarks TEXT,
  discount_approval_status TEXT NOT NULL DEFAULT 'auto_approved' CHECK (discount_approval_status IN ('auto_approved', 'pending_approval', 'approved', 'rejected')),
  discount_approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'sent', 'accepted', 'rejected', 'revised', 'cancelled', 'expired')),
  salesperson_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. CREATE SALES ORDERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL,
  quotation_id UUID REFERENCES public.sales_quotations(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.sales_customers(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  machine_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
  machine_model TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  final_unit_price NUMERIC NOT NULL DEFAULT 0,
  final_discount_percent NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  delivery_location TEXT NOT NULL,
  delivery_date DATE,
  payment_terms TEXT,
  warranty_terms TEXT,
  approval_status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (approval_status IN ('pending_approval', 'sales_manager_approved', 'admin_approved', 'finance_approved', 'rejected')),
  sales_manager_approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  admin_approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  finance_approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'machine_reserved', 'delivery_requested', 'dispatched', 'delivered', 'handover_completed', 'cancelled')),
  machine_reserved BOOLEAN DEFAULT FALSE,
  delivery_instruction TEXT,
  salesperson_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. CREATE SALES MACHINE RESERVATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.sales_machine_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_number TEXT UNIQUE NOT NULL,
  sales_order_id UUID REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.sales_customers(id) ON DELETE CASCADE,
  reserved_until DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'fulfilled', 'cancelled', 'expired')),
  reserved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. CREATE SALES DELIVERY COORDINATIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.sales_delivery_coordinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordination_number TEXT UNIQUE NOT NULL,
  sales_order_id UUID NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.sales_customers(id) ON DELETE CASCADE,
  machine_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
  delivery_location TEXT NOT NULL,
  special_instructions TEXT,
  requested_delivery_date DATE NOT NULL,
  store_challan_id UUID,
  delivery_status TEXT NOT NULL DEFAULT 'requested' CHECK (delivery_status IN ('requested', 'store_confirmed', 'in_transit', 'delivered', 'handover_completed')),
  handover_signed_doc_url TEXT,
  handover_date TIMESTAMPTZ,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. CREATE SALES SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.sales_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_limit_sales NUMERIC DEFAULT 5,
  discount_limit_manager NUMERIC DEFAULT 10,
  discount_limit_admin NUMERIC DEFAULT 15,
  sales_stages JSONB DEFAULT '["New", "Contacted", "Qualified", "Requirement Identified", "Quotation", "Negotiation", "Won", "Lost"]'::jsonb,
  lead_sources JSONB DEFAULT '["Website", "Referral", "Exhibition", "Cold Call", "Social Media", "Direct Inquiry", "Partner"]'::jsonb,
  document_templates JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed initial sales settings row if missing
INSERT INTO public.sales_settings (discount_limit_sales, discount_limit_manager, discount_limit_admin)
SELECT 5, 10, 15
WHERE NOT EXISTS (SELECT 1 FROM public.sales_settings);

-- ============================================
-- 11. ENABLE RLS POLICIES
-- ============================================
ALTER TABLE public.sales_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_customer_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_machine_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_delivery_coordinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permit authenticated view sales_leads" ON public.sales_leads FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated insert sales_leads" ON public.sales_leads FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated update sales_leads" ON public.sales_leads FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Permit authenticated view sales_customers" ON public.sales_customers FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated insert sales_customers" ON public.sales_customers FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated update sales_customers" ON public.sales_customers FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Permit authenticated view sales_customer_interactions" ON public.sales_customer_interactions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated insert sales_customer_interactions" ON public.sales_customer_interactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Permit authenticated view sales_opportunities" ON public.sales_opportunities FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated insert sales_opportunities" ON public.sales_opportunities FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated update sales_opportunities" ON public.sales_opportunities FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Permit authenticated view sales_quotations" ON public.sales_quotations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated insert sales_quotations" ON public.sales_quotations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated update sales_quotations" ON public.sales_quotations FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Permit authenticated view sales_orders" ON public.sales_orders FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated insert sales_orders" ON public.sales_orders FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated update sales_orders" ON public.sales_orders FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Permit authenticated view sales_machine_reservations" ON public.sales_machine_reservations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated insert sales_machine_reservations" ON public.sales_machine_reservations FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Permit authenticated view sales_delivery_coordinations" ON public.sales_delivery_coordinations FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated insert sales_delivery_coordinations" ON public.sales_delivery_coordinations FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated update sales_delivery_coordinations" ON public.sales_delivery_coordinations FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Permit authenticated view sales_settings" ON public.sales_settings FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Permit authenticated update sales_settings" ON public.sales_settings FOR UPDATE USING (auth.role() = 'authenticated');

-- ============================================
-- 12. RE-SYNC ROLE_PERMISSIONS FOR SALES_EXECUTIVE
-- ============================================
DELETE FROM public.role_permissions 
WHERE role_id = (SELECT id FROM public.roles WHERE code = 'sales_executive');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'sales_executive'
  AND p.code IN (
    'machine.view',
    'sales.view',
    'sales.create',
    'sales.edit',
    'sales.quotation',
    'sales.lead_manage',
    'sales.customer_manage',
    'sales.interaction_log',
    'sales.opportunity_manage',
    'sales.quotation_manage',
    'sales.discount_approve',
    'sales.order_manage',
    'sales.order_approve',
    'sales.machine_reserve',
    'sales.delivery_coordinate',
    'sales.handover_coordinate',
    'rental.view',
    'inventory.view',
    'report.view',
    'audit.view'
  );

-- Ensure super_admin, admin, branch_manager have all new sales permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code IN ('super_admin', 'admin', 'branch_manager')
  AND p.code IN (
    'sales.lead_manage',
    'sales.customer_manage',
    'sales.interaction_log',
    'sales.opportunity_manage',
    'sales.quotation_manage',
    'sales.discount_approve',
    'sales.order_manage',
    'sales.order_approve',
    'sales.machine_reserve',
    'sales.delivery_coordinate',
    'sales.handover_coordinate',
    'sales.settings_manage'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;
