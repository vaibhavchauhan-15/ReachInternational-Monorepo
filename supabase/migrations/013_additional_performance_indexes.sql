-- ============================================
-- ServiceCentric — Multi-Layer Performance Architecture Migration 013
-- Additional Composite & Foreign Key Indexes for Operational Tables
-- ============================================

-- Purchase Orders composite index
CREATE INDEX IF NOT EXISTS idx_purchase_orders_branch_status_created
  ON public.purchase_orders (branch_id, status, created_at DESC);

-- Challans date & status index
CREATE INDEX IF NOT EXISTS idx_challans_status_date
  ON public.challans (status, issue_date DESC);

-- Clients branch & status index
CREATE INDEX IF NOT EXISTS idx_clients_branch_status
  ON public.clients (branch_id, status);

-- Vendors status & creation index
CREATE INDEX IF NOT EXISTS idx_vendors_status_created
  ON public.vendors (status, created_at DESC);

-- Documents entity & branch index
CREATE INDEX IF NOT EXISTS idx_documents_entity_branch
  ON public.documents (entity_type, entity_id, branch_id);

-- Inventory product part number index
CREATE INDEX IF NOT EXISTS idx_inventory_products_part_no
  ON public.inventory_products (part_number);
