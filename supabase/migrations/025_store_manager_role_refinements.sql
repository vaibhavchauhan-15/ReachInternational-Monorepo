-- Migration: 025_store_manager_role_refinements.sql
-- Description: Refine Role 9 — Store Manager RBAC permissions, physical inventory, procurement, PO threshold approvals, challans, GRN, purchase returns, and stock adjustments

-- ============================================
-- 1. SEED ADDITIONAL INVENTORY & PROCUREMENT PERMISSIONS
-- ============================================
INSERT INTO public.permissions (code, module, description)
VALUES 
  ('inventory.edit', 'inventory', 'Edit inventory product specifications and reorder levels'),
  ('inventory.archive', 'inventory', 'Archive or deactivate inventory product master'),
  ('part_request.approve', 'inventory', 'Approve part request from field technicians/supervisors'),
  ('part_request.reject', 'inventory', 'Reject part request from field technicians/supervisors'),
  ('part_request.issue', 'inventory', 'Issue stock against approved part request'),
  ('po.view', 'inventory', 'View purchase orders list and details'),
  ('po.create', 'inventory', 'Create purchase order for required parts'),
  ('po.edit', 'inventory', 'Edit draft or pending purchase order'),
  ('po.approve', 'inventory', 'Approve purchase order within authorized limit'),
  ('po.cancel', 'inventory', 'Cancel purchase order'),
  ('challan.view', 'inventory', 'View material issue, transfer, return, and receipt challans'),
  ('challan.create', 'inventory', 'Create material issue or transfer delivery challan'),
  ('challan.edit', 'inventory', 'Edit draft delivery challan'),
  ('challan.approve', 'inventory', 'Confirm and finalize delivery challan'),
  ('challan.cancel', 'inventory', 'Cancel or amend delivery challan with audit trail'),
  ('supplier.view', 'inventory', 'View supplier directory and purchase history'),
  ('supplier.create', 'inventory', 'Add new parts vendor/supplier'),
  ('supplier.edit', 'inventory', 'Update supplier contact details and payment terms'),
  ('supplier.archive', 'inventory', 'Archive/deactivate supplier record'),
  ('grn.view', 'inventory', 'View Goods Receipt Notes (GRN)'),
  ('grn.create', 'inventory', 'Create Goods Receipt Note (GRN) upon receiving stock'),
  ('purchase_return.view', 'inventory', 'View purchase returns log'),
  ('purchase_return.create', 'inventory', 'Create purchase return for defective/damaged items')
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 2. RE-SYNC ROLE_PERMISSIONS FOR STORE_MANAGER
-- ============================================
-- Clear previous store_manager permissions mapping to ensure strict alignment
DELETE FROM public.role_permissions 
WHERE role_id = (SELECT id FROM public.roles WHERE code = 'store_manager');

-- Insert exact authorized permissions for store_manager
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.code = 'store_manager'
  AND p.code IN (
    -- Machines (View assigned branch machines only)
    'machine.view',

    -- Breakdown Complaints & Service (View parts requirements context only)
    'complaint.view',
    'service.view',
    'fsr.view',

    -- Physical Inventory Master & Stock Ledger
    'inventory.view',
    'inventory.create',
    'inventory.edit',
    'inventory.archive',
    'inventory.stock_in',
    'inventory.stock_out',
    'inventory.adjust',
    'inventory.transfer',
    'inventory.approve_transfer',
    'inventory.request',

    -- Part Requests Management
    'part_request.create',
    'part_request.view',
    'part_request.approve',
    'part_request.reject',
    'part_request.issue',

    -- Purchase Orders (PO) & Procurement
    'po.view',
    'po.create',
    'po.edit',
    'po.approve',
    'po.cancel',

    -- Challan Management
    'challan.view',
    'challan.create',
    'challan.edit',
    'challan.approve',
    'challan.cancel',

    -- Supplier / Vendor Management
    'supplier.view',
    'supplier.create',
    'supplier.edit',
    'supplier.archive',

    -- Goods Receipt Note (GRN) & Purchase Returns
    'grn.view',
    'grn.create',
    'purchase_return.view',
    'purchase_return.create',

    -- Employee Directory (Basic operational info for part issue/challan creation only)
    'employee.view',

    -- Rental (View parts context for rental machines)
    'rental.view',

    -- Finance (Procurement-related view: PO amounts, unit price, tax, discount)
    'finance.view',

    -- Branch Access (Own Branch)
    'branch.view',

    -- Inventory Notifications & Alerts
    'notification.view',
    'notification.send',

    -- Inventory Reports & Audit Logs
    'report.view',
    'report.export',
    'audit.view',

    -- Inventory-Specific Settings (Reorder levels, categories, units, warehouse settings)
    'settings.view',
    'settings.edit'
  );
