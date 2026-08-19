-- Migration 029: Finance Manager Role Refinements, Tables, RLS & Seed Data
-- Enables granular permissions for Role 13 — Finance Manager

-- 1. Create Finance System Tables

-- Finance Invoices Table
CREATE TABLE IF NOT EXISTS public.finance_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) UNIQUE NOT NULL,
  invoice_type VARCHAR(30) NOT NULL CHECK (invoice_type IN ('sales', 'rental', 'service', 'custom')),
  customer_id UUID,
  customer_name TEXT NOT NULL,
  customer_gstin TEXT,
  billing_address TEXT,
  reference_type VARCHAR(50) DEFAULT 'manual', -- 'sales_order', 'rental_agreement', 'service_ticket', 'manual'
  reference_id UUID,
  branch_id UUID REFERENCES public.branches(id),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  payment_terms TEXT DEFAULT 'Net 30',
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  amount_paid NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  amount_due NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'finalized', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled', 'disputed')),
  is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  finalized_by UUID REFERENCES auth.users(id),
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Finance Invoice Items Table
CREATE TABLE IF NOT EXISTS public.finance_invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.finance_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  item_type VARCHAR(30) DEFAULT 'item',
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1.00,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  discount_percent NUMERIC(5,2) DEFAULT 0.00,
  tax_rate NUMERIC(5,2) DEFAULT 18.00,
  tax_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Finance Payments Ledger Table
CREATE TABLE IF NOT EXISTS public.finance_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number VARCHAR(50) UNIQUE NOT NULL,
  invoice_id UUID REFERENCES public.finance_invoices(id) ON DELETE SET NULL,
  customer_name TEXT,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('bank_transfer', 'upi', 'cheque', 'cash', 'card', 'other')),
  transaction_reference TEXT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  remarks TEXT,
  proof_document_url TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded', 'disputed')),
  recorded_by UUID REFERENCES auth.users(id),
  branch_id UUID REFERENCES public.branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Finance Credit/Debit Notes Table
CREATE TABLE IF NOT EXISTS public.finance_credit_debit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_number VARCHAR(50) UNIQUE NOT NULL,
  note_type VARCHAR(20) NOT NULL CHECK (note_type IN ('credit_note', 'debit_note')),
  invoice_id UUID REFERENCES public.finance_invoices(id) ON DELETE RESTRICT,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  tax_amount NUMERIC(15,2) DEFAULT 0.00,
  reason TEXT NOT NULL,
  status VARCHAR(30) DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'applied', 'cancelled')),
  issued_by UUID REFERENCES auth.users(id),
  branch_id UUID REFERENCES public.branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expense Categories Master Table
CREATE TABLE IF NOT EXISTS public.finance_expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Finance Expenses Table
CREATE TABLE IF NOT EXISTS public.finance_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_number VARCHAR(50) UNIQUE NOT NULL,
  category VARCHAR(50) NOT NULL,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  branch_id UUID REFERENCES public.branches(id),
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  vendor_name TEXT,
  vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  payment_method VARCHAR(50) DEFAULT 'bank_transfer',
  supporting_document_url TEXT,
  remarks TEXT,
  approval_status VARCHAR(30) DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'on_hold', 'escalated_higher_approval')),
  approval_limit_exceeded BOOLEAN DEFAULT FALSE,
  requires_higher_approval BOOLEAN DEFAULT FALSE,
  approved_by UUID REFERENCES auth.users(id),
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3-Way Matching Reviews Table (PO ↔ GRN ↔ Supplier Invoice)
CREATE TABLE IF NOT EXISTS public.finance_3way_matching_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES public.purchase_orders(id),
  po_number VARCHAR(50) NOT NULL,
  grn_id UUID REFERENCES public.inventory_goods_receipts(id) ON DELETE SET NULL,
  grn_number VARCHAR(50),
  supplier_invoice_number VARCHAR(50),
  supplier_invoice_amount NUMERIC(15,2),
  po_amount NUMERIC(15,2),
  grn_quantity NUMERIC(10,2),
  po_quantity NUMERIC(10,2),
  invoice_quantity NUMERIC(10,2),
  match_status VARCHAR(30) NOT NULL DEFAULT 'matched' CHECK (match_status IN ('matched', 'mismatch_quantity', 'mismatch_amount', 'mismatch_both', 'pending_verification', 'on_hold', 'approved_for_payment')),
  hold_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendor Payments Table
CREATE TABLE IF NOT EXISTS public.finance_vendor_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_number VARCHAR(50) UNIQUE NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id),
  po_id UUID REFERENCES public.purchase_orders(id),
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  payment_method VARCHAR(50) NOT NULL,
  transaction_reference TEXT,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  approval_status VARCHAR(30) DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'on_hold')),
  approved_by UUID REFERENCES auth.users(id),
  remarks TEXT,
  branch_id UUID REFERENCES public.branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Receivable Follow-ups Log
CREATE TABLE IF NOT EXISTS public.finance_receivable_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.finance_invoices(id) ON DELETE CASCADE,
  followup_date TIMESTAMPTZ DEFAULT NOW(),
  action_type VARCHAR(50) NOT NULL, -- 'reminder_sent', 'disputed', 'escalated', 'note_added'
  notes TEXT NOT NULL,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Finance Settings Table
CREATE TABLE IF NOT EXISTS public.finance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_finance_invoices_branch ON public.finance_invoices(branch_id);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_status ON public.finance_invoices(status);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_customer ON public.finance_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_finance_invoices_due ON public.finance_invoices(due_date);

CREATE INDEX IF NOT EXISTS idx_finance_payments_invoice ON public.finance_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_finance_payments_branch ON public.finance_payments(branch_id);

CREATE INDEX IF NOT EXISTS idx_finance_expenses_branch ON public.finance_expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_finance_expenses_category ON public.finance_expenses(category);

CREATE INDEX IF NOT EXISTS idx_finance_3way_po ON public.finance_3way_matching_reviews(po_id);
CREATE INDEX IF NOT EXISTS idx_finance_3way_status ON public.finance_3way_matching_reviews(match_status);

-- 3. Enable RLS and define policies
ALTER TABLE public.finance_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_credit_debit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_3way_matching_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_vendor_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_receivable_followups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_settings ENABLE ROW LEVEL SECURITY;

-- Permissive RLS Policies for authenticated users with role checks in DAL
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated read finance_invoices') THEN
    CREATE POLICY "Allow authenticated read finance_invoices" ON public.finance_invoices FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated write finance_invoices') THEN
    CREATE POLICY "Allow authenticated write finance_invoices" ON public.finance_invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated read finance_invoice_items') THEN
    CREATE POLICY "Allow authenticated read finance_invoice_items" ON public.finance_invoice_items FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated write finance_invoice_items') THEN
    CREATE POLICY "Allow authenticated write finance_invoice_items" ON public.finance_invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated read finance_payments') THEN
    CREATE POLICY "Allow authenticated read finance_payments" ON public.finance_payments FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated write finance_payments') THEN
    CREATE POLICY "Allow authenticated write finance_payments" ON public.finance_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated read finance_credit_debit_notes') THEN
    CREATE POLICY "Allow authenticated read finance_credit_debit_notes" ON public.finance_credit_debit_notes FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated write finance_credit_debit_notes') THEN
    CREATE POLICY "Allow authenticated write finance_credit_debit_notes" ON public.finance_credit_debit_notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated read finance_expense_categories') THEN
    CREATE POLICY "Allow authenticated read finance_expense_categories" ON public.finance_expense_categories FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated write finance_expense_categories') THEN
    CREATE POLICY "Allow authenticated write finance_expense_categories" ON public.finance_expense_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated read finance_expenses') THEN
    CREATE POLICY "Allow authenticated read finance_expenses" ON public.finance_expenses FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated write finance_expenses') THEN
    CREATE POLICY "Allow authenticated write finance_expenses" ON public.finance_expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated read finance_3way_matching_reviews') THEN
    CREATE POLICY "Allow authenticated read finance_3way_matching_reviews" ON public.finance_3way_matching_reviews FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated write finance_3way_matching_reviews') THEN
    CREATE POLICY "Allow authenticated write finance_3way_matching_reviews" ON public.finance_3way_matching_reviews FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated read finance_vendor_payments') THEN
    CREATE POLICY "Allow authenticated read finance_vendor_payments" ON public.finance_vendor_payments FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated write finance_vendor_payments') THEN
    CREATE POLICY "Allow authenticated write finance_vendor_payments" ON public.finance_vendor_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated read finance_receivable_followups') THEN
    CREATE POLICY "Allow authenticated read finance_receivable_followups" ON public.finance_receivable_followups FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated write finance_receivable_followups') THEN
    CREATE POLICY "Allow authenticated write finance_receivable_followups" ON public.finance_receivable_followups FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated read finance_settings') THEN
    CREATE POLICY "Allow authenticated read finance_settings" ON public.finance_settings FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated write finance_settings') THEN
    CREATE POLICY "Allow authenticated write finance_settings" ON public.finance_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. Seed Permissions for Finance Manager Role
INSERT INTO public.permissions (code, name, category, description)
VALUES
  ('finance.invoice.create', 'Create Invoice', 'finance', 'Create new sales, rental, or service invoices'),
  ('finance.invoice.edit', 'Edit Invoice', 'finance', 'Modify draft invoice details prior to finalization'),
  ('finance.invoice.finalize', 'Finalize Invoice', 'finance', 'Finalize invoice and generate immutable financial status'),
  ('finance.invoice.cancel', 'Cancel Invoice', 'finance', 'Cancel draft or under review invoices'),
  ('finance.credit_note', 'Issue Credit Note', 'finance', 'Issue credit note adjustments for finalized invoices'),
  ('finance.debit_note', 'Issue Debit Note', 'finance', 'Issue debit note adjustments for finalized invoices'),
  ('finance.payment.record', 'Record Payment', 'finance', 'Record full or partial customer payments against invoices'),
  ('finance.receivable.manage', 'Manage Receivables', 'finance', 'Track aging reports, reminders, and disputed accounts'),
  ('finance.payable.manage', 'Manage Payables', 'finance', 'Manage supplier invoices and vendor payments'),
  ('finance.3way_match', '3-Way Matching Verification', 'finance', 'Perform PO vs GRN vs Supplier Invoice verification'),
  ('finance.expense.manage', 'Manage Expenses', 'finance', 'Create and track operational and vendor expenses'),
  ('finance.expense.approve', 'Approve Expenses', 'finance', 'Approve or reject operational expenses'),
  ('finance.approval', 'Financial Approvals', 'finance', 'Approve high-value transactions and payment holds'),
  ('finance.settings.manage', 'Finance Settings', 'finance', 'Configure invoice prefixes, payment methods, tax parameters')
ON CONFLICT (code) DO NOTHING;

-- Map full permission suite to finance_manager
DO $$
DECLARE
  v_role_id UUID;
  v_perm_id UUID;
  v_code TEXT;
  v_codes TEXT[] := ARRAY[
    'finance.view', 'finance.invoice', 'finance.invoice.create', 'finance.invoice.edit',
    'finance.invoice.finalize', 'finance.invoice.cancel', 'finance.credit_note', 'finance.debit_note',
    'finance.payment', 'finance.payment.record', 'finance.receivable.manage', 'finance.payable.manage',
    'finance.3way_match', 'finance.expense.manage', 'finance.expense.approve', 'finance.approval',
    'finance.report', 'finance.settings.manage', 'machine.view', 'inventory.view', 'employee.view',
    'employee.salary.view', 'rental.view', 'sales.view', 'po.view', 'grn.view', 'supplier.view',
    'challan.view', 'service.view', 'complaint.view', 'fsr.view', 'branch.view', 'notification.view',
    'notification.send', 'report.view', 'report.export', 'audit.view', 'settings.view', 'settings.edit'
  ];
BEGIN
  SELECT id INTO v_role_id FROM public.roles WHERE code = 'finance_manager';
  IF v_role_id IS NOT NULL THEN
    FOREACH v_code IN ARRAY v_codes LOOP
      SELECT id INTO v_perm_id FROM public.permissions WHERE code = v_code;
      IF v_perm_id IS NOT NULL THEN
        INSERT INTO public.role_permissions (role_id, permission_id)
        VALUES (v_role_id, v_perm_id)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
  END IF;
END $$;

-- 5. Seed Initial Expense Categories & Settings
INSERT INTO public.finance_expense_categories (name, description) VALUES
  ('Fuel', 'Machine fuel, diesel, and generator refilling costs'),
  ('Transport', 'Freight, towing, machine mobilization and logistics'),
  ('Maintenance', 'Workshop tools, lubricants, spare parts and repairs'),
  ('Office expenses', 'Stationery, office supplies, pantry and administration'),
  ('Utilities', 'Electricity, water, internet, and communication bills'),
  ('Rent', 'Branch office, workshop yard, and warehouse rentals'),
  ('Procurement', 'Part purchases and consumable acquisitions'),
  ('Employee-related expense', 'Staff welfare, field allowances, safety gear and training'),
  ('Travel', 'Engineer travel allowance, lodging, and field conveyance'),
  ('Other', 'Miscellaneous authorized operational expenses')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.finance_settings (key, value) VALUES
  ('invoice_prefix', '"INV-2026-"'::jsonb),
  ('payment_methods', '["bank_transfer", "upi", "cheque", "cash", "card"]'::jsonb),
  ('expense_approval_limit', '50000'::jsonb),
  ('default_gst_rate', '18'::jsonb)
ON CONFLICT (key) DO NOTHING;
