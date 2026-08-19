-- ============================================
-- ServiceCentric — Multi-Layer Performance Architecture Migration 012
-- 1. Composite & foreign key indexes for multi-branch scoping & RLS speedup
-- 2. Fast search indexes for directory listings
-- 3. Branch Dashboard Summary View for aggregate KPI fetching
-- ============================================

-- ============================================
-- PART 1: COMPOSITE INDEXES FOR MULTI-BRANCH SCOPING & FILTERING
-- ============================================

-- User branch scoping & role lookups
CREATE INDEX IF NOT EXISTS idx_users_branch_role_status
  ON public.users (branch_id, role, status);

CREATE INDEX IF NOT EXISTS idx_user_branches_composite
  ON public.user_branches (user_id, branch_id);

-- Machine directory branch status & creation sorting
CREATE INDEX IF NOT EXISTS idx_machines_branch_status_created
  ON public.machines (branch_id, status, created_at DESC);

-- Complaints branch status & creation sorting
CREATE INDEX IF NOT EXISTS idx_complaints_branch_status_created
  ON public.machine_complaints (branch_id, status, created_at DESC);

-- Service records branch date ordering
CREATE INDEX IF NOT EXISTS idx_service_records_branch_date
  ON public.service_records (branch_id, service_date DESC);

-- Inventory stock branch & quantity lookup
CREATE INDEX IF NOT EXISTS idx_inventory_stock_branch_quantity
  ON public.inventory_stock (branch_id, product_id, quantity);

-- Inventory transactions branch history
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_branch_created
  ON public.inventory_transactions (branch_id, created_at DESC);

-- Operator machine hour logs date sorting
CREATE INDEX IF NOT EXISTS idx_machine_hour_logs_machine_date
  ON public.machine_hour_logs (machine_id, log_date DESC);

-- Documents branch status & expiry filtering
CREATE INDEX IF NOT EXISTS idx_documents_branch_status_expiry
  ON public.documents (branch_id, status, expiry_date);

-- Employees branch designation lookup
CREATE INDEX IF NOT EXISTS idx_employees_branch_designation
  ON public.employees (branch_id, designation, status);


-- ============================================
-- PART 2: DATABASE VIEW FOR DASHBOARD AGGREGATION
-- Avoids 15 sequential table queries by grouping metrics per branch
-- ============================================

CREATE OR REPLACE VIEW public.v_branch_dashboard_summary AS
SELECT
  b.id AS branch_id,
  b.code AS branch_code,
  b.name AS branch_name,
  COALESCE(m.total_machines, 0) AS total_machines,
  COALESCE(m.active_machines, 0) AS active_machines,
  COALESCE(m.maintenance_machines, 0) AS maintenance_machines,
  COALESCE(c.open_complaints, 0) AS open_complaints,
  COALESCE(c.urgent_complaints, 0) AS urgent_complaints,
  COALESCE(s.services_this_month, 0) AS services_this_month,
  COALESCE(i.low_stock_items, 0) AS low_stock_items
FROM public.branches b
LEFT JOIN (
  SELECT
    branch_id,
    COUNT(*) AS total_machines,
    COUNT(*) FILTER (WHERE status = 'active') AS active_machines,
    COUNT(*) FILTER (WHERE status IN ('maintenance', 'breakdown')) AS maintenance_machines
  FROM public.machines
  GROUP BY branch_id
) m ON m.branch_id = b.id
LEFT JOIN (
  SELECT
    branch_id,
    COUNT(*) FILTER (WHERE status IN ('open', 'assigned', 'in_progress')) AS open_complaints,
    COUNT(*) FILTER (WHERE priority = 'urgent' AND status IN ('open', 'assigned', 'in_progress')) AS urgent_complaints
  FROM public.machine_complaints
  GROUP BY branch_id
) c ON c.branch_id = b.id
LEFT JOIN (
  SELECT
    branch_id,
    COUNT(*) AS services_this_month
  FROM public.service_records
  WHERE service_date >= date_trunc('month', CURRENT_DATE)
  GROUP BY branch_id
) s ON s.branch_id = b.id
LEFT JOIN (
  SELECT
    s.branch_id,
    COUNT(*) AS low_stock_items
  FROM public.inventory_stock s
  JOIN public.inventory_products p ON p.id = s.product_id
  WHERE s.quantity <= p.min_stock_level
  GROUP BY s.branch_id
) i ON i.branch_id = b.id;

-- Grant read access on the summary view to authenticated users
GRANT SELECT ON public.v_branch_dashboard_summary TO authenticated;
