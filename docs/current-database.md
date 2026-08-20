# ReachInternational — Current Database Schema & Storage Audit

> **Phase 0 Deliverable**  
> **Last Updated:** 2026-08-19  
> **Status:** Verified & Baseline Established  

---

## 1. Supabase PostgreSQL Baseline

- **Database Engine**: Supabase PostgreSQL 15+.
- **Primary Schema**: `public`.
- **Row Level Security (RLS)**: Enforced on 100% of operational tables.
- **Seeding Pipeline**: `supabase/seed_dummy_data.mjs` (Consolidated single Delhi Branch `DEL-HQ` model).
- **Verification Script**: `supabase/verify_seed.mjs` (Checks row counts and column constraints across all 38+ system tables).

---

## 2. Database Migrations Inventory (35 Files)

The database schema is constructed through 35 sequential migration files in `supabase/migrations/`:

| Migration File | Description | Major Tables / Objects Created |
| :--- | :--- | :--- |
| `001_initial_schema.sql` | Core schema foundation | `profiles`, `machines`, `service_records`, `notifications` |
| `002_user_email_and_gmail_notifications.sql` | Email channels & user notification preferences | `notification_preferences`, `notification_templates` |
| `003_add_in_app_notifications.sql` | In-app notification tracking | In-app notification triggers |
| `003_performance_indexes.sql` | Foreign key & query performance indexes | B-tree indexes on `machine_id`, `user_id` |
| `004_dashboard_rpc.sql` | Postgres RPC stats function | `get_dashboard_stats()` RPC |
| `005_fix_dashboard_rpc_user_context.sql` | Scoped RPC execution for user context | Security definer fixes on RPC |
| `006_email_notifications.sql` | Email log triggers | `notification_logs` |
| `007_user_pending_status.sql` | Onboarding user pending state | Account approval workflow |
| `008_daily_summary_notifications.sql` | Cron summary email queue | Summary notification tables |
| `009_machine_extended_details.sql` | Extended machine specs | Hour meters, warranty dates |
| `010_machine_categories_complaints_services.sql` | Machine categories & breakdown complaints | `machine_categories`, `machine_complaints` |
| `011_enterprise_rbac_branches_inventory.sql` | Branches, inventory, and enterprise RBAC | `branches`, `roles`, `permissions`, `role_permissions`, `user_branches` |
| `012_multi_layer_performance_indexes.sql` | Multi-column performance indexes | Composite indexes on `(branch_id, status)` |
| `013_additional_performance_indexes.sql` | Operational table query indexes | Indexes on `created_at DESC` |
| `014_store_manager_inventory_erp.sql` | Store manager inventory & ERP module | `inventory_products`, `inventory_storage_locations`, `inventory_stock`, `inventory_stock_ledger`, `inventory_purchase_requests`, `purchase_orders`, `inventory_goods_receipts`, `inventory_part_issues`, `challans` |
| `015_seed_dummy_data.sql` | Historical seed SQL | Seed reference data |
| `016_add_manufacturer_to_inventory.sql` | Manufacturer tracking | `manufacturers` table |
| `017_comprehensive_13_roles_rbac.sql` | 13 enterprise system roles | Expanded permission mapping |
| `018_branch_manager_role_refinements.sql` | Branch Manager RBAC refinements | Branch scope permissions |
| `019_super_admin_role_refinements.sql` | Super Admin & Admin RBAC refinements | System settings permissions |
| `020_service_manager_role_refinements.sql` | Service Manager RBAC refinements | FSR & complaint handling |
| `021_service_engineer_role_refinements.sql` | Service Engineer RBAC refinements | Assigned service execution |
| `022_supervisor_role_refinements.sql` | Supervisor RBAC refinements | Meter logs & assignments |
| `023_mechanic_role_refinements.sql` | Mechanic RBAC refinements | Repair log permissions |
| `024_operator_role_refinements.sql` | Operator RBAC refinements | Shift meter log permissions |
| `025_store_manager_role_refinements.sql` | Store Manager RBAC refinements | Stock & PO permissions |
| `026_hr_manager_role_refinements.sql` | HR Manager RBAC refinements | `employees`, `operator_payouts` |
| `027_rental_manager_role_refinements.sql` | Rental Manager RBAC & Rental Hub | `rental_customers`, `rental_requests`, `rental_agreements`, `rental_delivery_challans`, `rental_return_inspections`, `rental_damage_reports`, `rental_extension_requests`, `rental_billing_requests`, `rental_accessories_log` |
| `028_sales_manager_role_refinements.sql` | Sales Executive RBAC & CRM Suite | `crm_leads`, `crm_opportunities`, `crm_quotes`, `crm_activities`, `crm_deals` |
| `029_finance_manager_role_refinements.sql` | Finance Manager RBAC & Accounting Suite | `finance_invoices`, `finance_invoice_items`, `finance_payments`, `finance_credit_debit_notes`, `finance_expense_categories`, `finance_expenses`, `finance_3way_matching_reviews`, `finance_vendor_payments`, `finance_receivable_followups`, `finance_settings` |
| `030_single_delhi_branch_consolidation.sql` | Single Delhi Branch migration | Delhi Branch (`DEL-HQ`) consolidation |
| `031_fix_machines_rls_scoping.sql` | Machine RLS scoping policy fix | Multi-role machine access policy |
| `032_supervisor_operations_enhancements.sql` | Supervisor Operations suite | `machine_site_movements`, operator payouts |

---

## 3. Core Database Tables (38+ System Tables by Domain)

### 3.1 Organization & User Administration
- **`public.branches`**: Branch offices (`DEL-HQ` Delhi Branch).
- **`public.profiles`**: Extended user profiles (`role`, `branch_id`, `full_name`, `phone`, `status`).
- **`public.user_branches`**: User to branch mapping.
- **`public.roles` & `public.permissions` & `public.role_permissions`**: Canonical RBAC tables.
- **`public.audit_logs`**: System audit trail.

### 3.2 Equipment & Field Operations
- **`public.manufacturers`**: Machinery manufacturers (CAT, JCB, Komatsu, Volvo, etc.).
- **`public.machine_categories`**: Excavator, Backhoe, Crane, Motor Grader, Wheel Loader, Dump Truck.
- **`public.machine_models`**: Spec models.
- **`public.machines`**: Core machine registry (hour meter, status, location, assigned engineer/operator).
- **`public.machine_assignments`**: Operator equipment assignments.
- **`public.machine_hour_logs`**: Daily shift hour meter logs.
- **`public.machine_site_movements`**: Equipment relocation, transport loading & unloading logs.

### 3.3 Service & Breakdown Management
- **`public.machine_complaints`**: Breakdown complaints log.
- **`public.service_records`**: Digital Field Service Reports (FSR) & maintenance logs.
- **`public.engineer_service_summaries`**: Engineer service analytics.

### 3.4 Inventory & Procurement
- **`public.inventory_products`**: Spare parts catalogue.
- **`public.inventory_storage_locations`**: Warehouse storage racks & bins.
- **`public.inventory_stock`**: Stock balances per location.
- **`public.inventory_stock_ledger`**: Immutable inventory transaction ledger.
- **`public.inventory_purchase_requests` & `items`**: Store manager purchase requisitions.
- **`public.purchase_orders` & `items`**: Vendor purchase orders.
- **`public.inventory_goods_receipts` & `items`**: Goods Receipt Notes (GRN).
- **`public.inventory_part_issues` & `items`**: Part issue slips for breakdown repairs.
- **`public.challans` & `items`**: Transport delivery challans.

### 3.5 HR & Operator Workforce
- **`public.employees`**: Employee master records (`EMP-DEL-001` through `EMP-DEL-012`).
- **`public.operator_payouts`**: Operator monthly salary payout log.

### 3.6 Rental Management Suite
- **`public.rental_customers`**: Rental customer directory.
- **`public.rental_requests`**: Inbound rental inquiries.
- **`public.rental_agreements`**: Rental contracts & terms.
- **`public.rental_delivery_challans`**: Rental machine dispatch challans.
- **`public.rental_return_inspections`**: Return condition check & meter reading.
- **`public.rental_damage_reports`**: Damage reports & auto-routed service/finance alerts.
- **`public.rental_extension_requests`**: Contract extension requests.
- **`public.rental_billing_requests`**: Pre-invoice billing calculations for Finance.
- **`public.rental_accessories_log`**: Attachment tracking.

### 3.7 Sales & CRM Suite
- **`public.crm_leads`**: Inbound leads.
- **`public.crm_opportunities`**: Sales deal opportunities.
- **`public.crm_quotes`**: Price quotations.
- **`public.crm_activities`**: Logged client calls, meetings, visits.
- **`public.crm_deals`**: Closed won/lost deals.

### 3.8 Finance & Accounting Suite
- **`public.finance_invoices` & `items`**: Operational invoices.
- **`public.finance_payments`**: Payment ledger (partial/full settlements).
- **`public.finance_credit_debit_notes`**: Credit & Debit notes.
- **`public.finance_expense_categories` & `expenses`**: Operational expense log.
- **`public.finance_3way_matching_reviews`**: PO ↔ GRN ↔ Supplier Invoice matching.
- **`public.finance_vendor_payments`**: Vendor payouts.
- **`public.finance_receivable_followups`**: AR aging follow-up logs.
- **`public.finance_settings`**: Financial configuration.

### 3.9 Notifications
- **`public.notifications`**: In-app notifications inbox.
- **`public.notification_preferences`**: Channel preferences (email, SMS, WhatsApp, in-app).
- **`public.notification_templates`**: Notification templates.
- **`public.notification_logs`**: Integration delivery log.

---

## 4. Supabase Storage Buckets Inventory

The system relies on 4 Supabase Storage buckets configured with public/authenticated access policies:

1. **`machine-photos`**: Machine photo gallery, inspection snapshots, damage images.
2. **`fsr-reports`**: Signed digital Field Service Report (FSR) PDFs.
3. **`attachments`**: Document library (RC, insurance, pollution certificates, invoices, PO PDFs).
4. **`challan-documents`**: Signed delivery challans and transport slips.
