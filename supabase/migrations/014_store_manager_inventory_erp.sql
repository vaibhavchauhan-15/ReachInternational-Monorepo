-- Migration: 014_store_manager_inventory_erp.sql
-- Description: Complete Store Manager Inventory ERP Schema — Part Master, Bin/Rack Storage, Purchase Requests, Purchase Orders, Goods Receipts (GRN), Part Issuance, Returnable Tracking, Delivery Challans, and Audit Ledger.

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. EXTEND INVENTORY PRODUCTS (PART MASTER)
-- ============================================
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS manufacturer TEXT;
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS oem_part_number TEXT;
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS alternate_part_number TEXT;
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS reorder_level INT DEFAULT 5;
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS reorder_quantity INT DEFAULT 10;
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS max_stock_level INT DEFAULT 100;
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS reserved_quantity INT DEFAULT 0;
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS last_purchase_price NUMERIC DEFAULT 0;
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS average_purchase_price NUMERIC DEFAULT 0;
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS default_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS warehouse_zone TEXT DEFAULT 'ZONE-A';
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS rack_number TEXT DEFAULT 'R-01';
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS shelf_number TEXT DEFAULT 'S-01';
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS bin_number TEXT DEFAULT 'B-01';
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS storage_location TEXT;
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS compatible_machines TEXT;
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS compatible_models TEXT;
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS part_type TEXT DEFAULT 'spare' CHECK (part_type IN ('spare', 'consumable', 'tool', 'assembly', 'lubricant'));
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS criticality TEXT DEFAULT 'normal' CHECK (criticality IN ('normal', 'high', 'critical'));
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'discontinued'));
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.inventory_products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================
-- 2. PHYSICAL STORAGE LOCATIONS (RACK / BIN HIERARCHY)
-- ============================================
CREATE TABLE IF NOT EXISTS public.inventory_storage_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  store_name TEXT DEFAULT 'Main Store',
  zone TEXT NOT NULL,
  rack TEXT NOT NULL,
  shelf TEXT NOT NULL,
  bin TEXT NOT NULL,
  capacity INT DEFAULT 100,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, store_name, zone, rack, shelf, bin)
);

-- ============================================
-- 3. VENDORS & PURCHASE REQUESTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_name TEXT NOT NULL,
  code TEXT UNIQUE,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  gstin TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  category TEXT,
  rating NUMERIC DEFAULT 5.0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_no TEXT UNIQUE NOT NULL,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sent_to_manager_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'high', 'urgent')),
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending_approval' CHECK (status IN ('draft', 'submitted', 'pending_approval', 'approved', 'partially_approved', 'rejected', 'converted_to_po', 'cancelled')),
  manager_remarks TEXT,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_purchase_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.inventory_purchase_requests(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.inventory_products(id) ON DELETE CASCADE,
  current_stock INT NOT NULL DEFAULT 0,
  min_stock INT NOT NULL DEFAULT 5,
  requested_quantity INT NOT NULL CHECK (requested_quantity > 0),
  approved_quantity INT,
  unit TEXT DEFAULT 'Pcs',
  estimated_unit_cost NUMERIC DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. CREATE & EXTEND PURCHASE ORDERS SCHEMA
-- ============================================
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT UNIQUE NOT NULL,
  request_id UUID REFERENCES public.inventory_purchase_requests(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_name TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT DEFAULT 'draft',
  due_date DATE,
  requested_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop old purchase_orders table status constraint if exists to update statuses
ALTER TABLE public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES public.inventory_purchase_requests(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS vendor_id_ref UUID REFERENCES public.vendors(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS billing_address TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS shipping_address TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS vendor_gstin TEXT;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT '30 Days Net';
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS delivery_terms TEXT DEFAULT 'Door Delivery';
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC DEFAULT 0;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS grand_total NUMERIC DEFAULT 0;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.inventory_purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.inventory_products(id) ON DELETE SET NULL,
  part_number TEXT NOT NULL,
  product_description TEXT NOT NULL,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit TEXT DEFAULT 'Pcs',
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount_percent NUMERIC DEFAULT 0,
  gst_percent NUMERIC DEFAULT 18,
  gst_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. GOODS RECEIPTS (INCOMING PARTS / GRN)
-- ============================================
CREATE TABLE IF NOT EXISTS public.inventory_goods_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number TEXT UNIQUE NOT NULL,
  po_id UUID REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  supplier_name TEXT NOT NULL,
  supplier_gstin TEXT,
  bill_number TEXT NOT NULL,
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE DEFAULT CURRENT_DATE,
  transport_details TEXT,
  bill_document_url TEXT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  received_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_goods_receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id UUID NOT NULL REFERENCES public.inventory_goods_receipts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.inventory_products(id) ON DELETE CASCADE,
  quantity_ordered INT NOT NULL DEFAULT 0,
  quantity_received INT NOT NULL CHECK (quantity_received > 0),
  unit_price NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  rack TEXT DEFAULT 'R-01',
  shelf TEXT DEFAULT 'S-01',
  bin TEXT DEFAULT 'B-01',
  batch_number TEXT,
  serial_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. PART ISSUANCE & PARTS ISSUE CHALLAN
-- ============================================
CREATE TABLE IF NOT EXISTS public.inventory_part_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_number TEXT UNIQUE NOT NULL,
  challan_number TEXT UNIQUE NOT NULL,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  machine_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
  complaint_id UUID REFERENCES public.machine_complaints(id) ON DELETE SET NULL,
  service_record_id UUID REFERENCES public.service_records(id) ON DELETE SET NULL,
  issued_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  issued_to_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  issued_to_name TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_returnable BOOLEAN DEFAULT FALSE,
  expected_return_date DATE,
  status TEXT DEFAULT 'issued' CHECK (status IN ('issued', 'partially_returned', 'fully_returned', 'cancelled')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_part_issue_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES public.inventory_part_issues(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.inventory_products(id) ON DELETE CASCADE,
  quantity_issued INT NOT NULL CHECK (quantity_issued > 0),
  quantity_returned INT DEFAULT 0,
  unit TEXT DEFAULT 'Pcs',
  machine_code TEXT,
  is_returnable BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. PART RETURNS (RETURNABLE TRACKING)
-- ============================================
CREATE TABLE IF NOT EXISTS public.inventory_part_returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_number TEXT UNIQUE NOT NULL,
  issue_id UUID NOT NULL REFERENCES public.inventory_part_issues(id) ON DELETE CASCADE,
  returned_by_name TEXT NOT NULL,
  received_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  return_date DATE NOT NULL DEFAULT CURRENT_DATE,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_part_return_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id UUID NOT NULL REFERENCES public.inventory_part_returns(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.inventory_products(id) ON DELETE CASCADE,
  quantity_returned INT NOT NULL CHECK (quantity_returned > 0),
  condition TEXT DEFAULT 'good' CHECK (condition IN ('good', 'damaged', 'scrap')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. CREATE & EXTEND DELIVERY CHALLANS SCHEMA
-- ============================================
CREATE TABLE IF NOT EXISTS public.challans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_number TEXT UNIQUE NOT NULL,
  type TEXT DEFAULT 'DELIVERY',
  status TEXT DEFAULT 'ISSUED',
  issue_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS issue_id UUID REFERENCES public.inventory_part_issues(id) ON DELETE SET NULL;
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS from_branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS from_address TEXT;
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS from_gstin TEXT DEFAULT '07AALFR3906M1ZS';
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS to_customer_name TEXT;
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS to_address TEXT;
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS destination TEXT;
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS to_gstin TEXT;
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS approx_value NUMERIC DEFAULT 0;
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS expected_delivery DATE;
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS note_declaration TEXT DEFAULT 'This item is not for sale; it is use for in our own machine.';
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS authorised_signatory TEXT DEFAULT 'Authorized Signatory';
ALTER TABLE public.challans ADD COLUMN IF NOT EXISTS pan_no TEXT DEFAULT 'AALFR3906M';

CREATE TABLE IF NOT EXISTS public.inventory_delivery_challan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_id UUID NOT NULL REFERENCES public.challans(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.inventory_products(id) ON DELETE SET NULL,
  part_number TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit TEXT DEFAULT 'Pcs',
  machine_number TEXT,
  issue_to TEXT,
  returnable_status TEXT DEFAULT 'NON-RETURNABLE',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_inv_prod_category ON public.inventory_products(category);
CREATE INDEX IF NOT EXISTS idx_inv_prod_rack_bin ON public.inventory_products(rack_number, bin_number);
CREATE INDEX IF NOT EXISTS idx_inv_pr_requested_by ON public.inventory_purchase_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_inv_pr_sent_to ON public.inventory_purchase_requests(sent_to_manager_id);
CREATE INDEX IF NOT EXISTS idx_inv_pr_status ON public.inventory_purchase_requests(status);
CREATE INDEX IF NOT EXISTS idx_inv_po_vendor ON public.purchase_orders(vendor_id_ref);
CREATE INDEX IF NOT EXISTS idx_inv_grn_po ON public.inventory_goods_receipts(po_id);
CREATE INDEX IF NOT EXISTS idx_inv_grn_branch ON public.inventory_goods_receipts(branch_id);
CREATE INDEX IF NOT EXISTS idx_inv_issue_machine ON public.inventory_part_issues(machine_id);
CREATE INDEX IF NOT EXISTS idx_inv_issue_issued_to ON public.inventory_part_issues(issued_to_user_id);
CREATE INDEX IF NOT EXISTS idx_inv_return_issue ON public.inventory_part_returns(issue_id);

-- ============================================
-- 10. ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_storage_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_purchase_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_purchase_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_goods_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_goods_receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_part_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_part_issue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_part_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_part_return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_delivery_challan_items ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated read vendors" ON public.vendors FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow authenticated write vendors" ON public.vendors FOR ALL TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated read purchase_orders" ON public.purchase_orders FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow authenticated write purchase_orders" ON public.purchase_orders FOR ALL TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated read challans" ON public.challans FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow authenticated write challans" ON public.challans FOR ALL TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated read storage_locations" ON public.inventory_storage_locations FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow authenticated write storage_locations" ON public.inventory_storage_locations FOR ALL TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated read purchase_requests" ON public.inventory_purchase_requests FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow authenticated write purchase_requests" ON public.inventory_purchase_requests FOR ALL TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated read purchase_request_items" ON public.inventory_purchase_request_items FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow authenticated write purchase_request_items" ON public.inventory_purchase_request_items FOR ALL TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated read purchase_order_items" ON public.inventory_purchase_order_items FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow authenticated write purchase_order_items" ON public.inventory_purchase_order_items FOR ALL TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated read goods_receipts" ON public.inventory_goods_receipts FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow authenticated write goods_receipts" ON public.inventory_goods_receipts FOR ALL TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated read goods_receipt_items" ON public.inventory_goods_receipt_items FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow authenticated write goods_receipt_items" ON public.inventory_goods_receipt_items FOR ALL TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated read part_issues" ON public.inventory_part_issues FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow authenticated write part_issues" ON public.inventory_part_issues FOR ALL TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated read part_issue_items" ON public.inventory_part_issue_items FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow authenticated write part_issue_items" ON public.inventory_part_issue_items FOR ALL TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated read part_returns" ON public.inventory_part_returns FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow authenticated write part_returns" ON public.inventory_part_returns FOR ALL TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated read part_return_items" ON public.inventory_part_return_items FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow authenticated write part_return_items" ON public.inventory_part_return_items FOR ALL TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Allow authenticated read delivery_challan_items" ON public.inventory_delivery_challan_items FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Allow authenticated write delivery_challan_items" ON public.inventory_delivery_challan_items FOR ALL TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
