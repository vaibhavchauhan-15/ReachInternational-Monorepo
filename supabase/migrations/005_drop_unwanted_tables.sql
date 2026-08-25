-- ============================================
-- Migration 005: Drop all non-essential & unwanted tables, retaining strictly 4 core tables:
-- 1. public.users
-- 2. public.machines
-- 3. public.machine_hour_logs
-- 4. public.clients
-- ============================================

-- Unlink orphan branch & model columns
ALTER TABLE IF EXISTS public.users DROP CONSTRAINT IF EXISTS users_branch_id_fkey CASCADE;
ALTER TABLE IF EXISTS public.users DROP COLUMN IF EXISTS branch_id;

ALTER TABLE IF EXISTS public.machines DROP CONSTRAINT IF EXISTS machines_branch_id_fkey CASCADE;
ALTER TABLE IF EXISTS public.machines DROP CONSTRAINT IF EXISTS machines_category_id_fkey CASCADE;
ALTER TABLE IF EXISTS public.machines DROP CONSTRAINT IF EXISTS machines_manufacturer_id_fkey CASCADE;
ALTER TABLE IF EXISTS public.machines DROP CONSTRAINT IF EXISTS machines_model_id_fkey CASCADE;
ALTER TABLE IF EXISTS public.machines DROP COLUMN IF EXISTS branch_id;
ALTER TABLE IF EXISTS public.machines DROP COLUMN IF EXISTS category_id;
ALTER TABLE IF EXISTS public.machines DROP COLUMN IF EXISTS manufacturer_id;
ALTER TABLE IF EXISTS public.machines DROP COLUMN IF EXISTS model_id;

ALTER TABLE IF EXISTS public.clients DROP CONSTRAINT IF EXISTS clients_branch_id_fkey CASCADE;
ALTER TABLE IF EXISTS public.clients DROP COLUMN IF EXISTS branch_id;

-- Drop legacy service & system tables
DROP TABLE IF EXISTS public.service_records CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.import_batches CASCADE;
DROP TABLE IF EXISTS public.import_errors CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.system_settings CASCADE;
DROP TABLE IF EXISTS public.machine_categories CASCADE;
DROP TABLE IF EXISTS public.machine_complaints CASCADE;

-- Drop RBAC & Organization tables
DROP TABLE IF EXISTS public.branches CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;
DROP TABLE IF EXISTS public.permissions CASCADE;
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS public.user_branches CASCADE;
DROP TABLE IF EXISTS public.employees CASCADE;
DROP TABLE IF EXISTS public.manufacturers CASCADE;
DROP TABLE IF EXISTS public.machine_models CASCADE;
DROP TABLE IF EXISTS public.machine_assignments CASCADE;

-- Drop Inventory ERP tables
DROP TABLE IF EXISTS public.inventory_products CASCADE;
DROP TABLE IF EXISTS public.inventory_stock CASCADE;
DROP TABLE IF EXISTS public.inventory_transactions CASCADE;
DROP TABLE IF EXISTS public.stock_transfers CASCADE;
DROP TABLE IF EXISTS public.inventory_storage_locations CASCADE;
DROP TABLE IF EXISTS public.vendors CASCADE;
DROP TABLE IF EXISTS public.inventory_purchase_requests CASCADE;
DROP TABLE IF EXISTS public.inventory_purchase_request_items CASCADE;
DROP TABLE IF EXISTS public.purchase_orders CASCADE;
DROP TABLE IF EXISTS public.inventory_purchase_order_items CASCADE;
DROP TABLE IF EXISTS public.inventory_goods_receipts CASCADE;
DROP TABLE IF EXISTS public.inventory_goods_receipt_items CASCADE;
DROP TABLE IF EXISTS public.inventory_part_issues CASCADE;
DROP TABLE IF EXISTS public.inventory_part_issue_items CASCADE;
DROP TABLE IF EXISTS public.inventory_part_returns CASCADE;
DROP TABLE IF EXISTS public.inventory_part_return_items CASCADE;
DROP TABLE IF EXISTS public.challans CASCADE;
DROP TABLE IF EXISTS public.inventory_delivery_challan_items CASCADE;

-- Drop HR & Organization tables
DROP TABLE IF EXISTS public.departments CASCADE;
DROP TABLE IF EXISTS public.designations CASCADE;
DROP TABLE IF EXISTS public.employee_salary_history CASCADE;
DROP TABLE IF EXISTS public.employee_documents CASCADE;
DROP TABLE IF EXISTS public.user_account_requests CASCADE;

-- Drop Rental Management tables
DROP TABLE IF EXISTS public.rental_customers CASCADE;
DROP TABLE IF EXISTS public.rental_requests CASCADE;
DROP TABLE IF EXISTS public.rental_agreements CASCADE;
DROP TABLE IF EXISTS public.rental_delivery_challans CASCADE;
DROP TABLE IF EXISTS public.rental_return_inspections CASCADE;
DROP TABLE IF EXISTS public.rental_damage_reports CASCADE;
DROP TABLE IF EXISTS public.rental_extension_requests CASCADE;
DROP TABLE IF EXISTS public.rental_billing_requests CASCADE;
DROP TABLE IF EXISTS public.rental_accessories_log CASCADE;

-- Drop CRM & Sales Pipeline tables
DROP TABLE IF EXISTS public.sales_leads CASCADE;
DROP TABLE IF EXISTS public.sales_customers CASCADE;
DROP TABLE IF EXISTS public.sales_customer_interactions CASCADE;
DROP TABLE IF EXISTS public.sales_opportunities CASCADE;
DROP TABLE IF EXISTS public.sales_quotations CASCADE;
DROP TABLE IF EXISTS public.sales_orders CASCADE;
DROP TABLE IF EXISTS public.sales_machine_reservations CASCADE;
DROP TABLE IF EXISTS public.sales_delivery_coordinations CASCADE;
DROP TABLE IF EXISTS public.sales_settings CASCADE;

-- Drop Task Management & Logistics tables
DROP TABLE IF EXISTS public.machine_site_movements CASCADE;
DROP TABLE IF EXISTS public.operator_payouts CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.task_assignees CASCADE;
DROP TABLE IF EXISTS public.task_attachments CASCADE;
DROP TABLE IF EXISTS public.task_comments CASCADE;
DROP TABLE IF EXISTS public.task_activity_logs CASCADE;
