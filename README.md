# ServiceCentric — Enterprise Heavy Machinery, Field Service & Operations Platform

> **ServiceCentric** — Enterprise-grade industrial machine tracking, multi-branch operations, field service maintenance, breakdown complaint handling, rental fleet management, CRM & sales pipelines, finance & accounting governance, HR lifecycle management, and automated notification system.

ServiceCentric transforms heavy machinery fleet management and end-to-end industrial operations into an automated, multi-tenant capable, branch-aware enterprise platform. Built for Service Managers, Branch Managers, Field Engineers, Mechanics, Supervisors, Operators, Store Managers, HR Managers, Rental Managers, Sales Executives, Finance Managers, and Admins, it automatically tracks machinery lifecycles, processes digital Field Service Reports (FSR), manages breakdown complaints, orchestrates rental agreements and sales pipelines, handles multi-way financial matching & invoicing, logs daily operator hour meters & site movements, and dispatches multi-channel alerts via SendGrid and Twilio.

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Key Features](#-key-features)
- [Monorepo System Architecture & Boundary Rules](#-monorepo-system-architecture--boundary-rules)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Environment Variables](#-environment-variables)
- [13-Role RBAC & Data Scoping Architecture](#-13-role-rbac--data-scoping-architecture)
- [Database Schema](#-database-schema)
- [Breakdown Complaints & Digital FSR System](#-breakdown-complaints--digital-fsr-system)
- [Notification Engine](#-notification-engine)
- [Project Structure](#-project-structure)
- [Server Actions & API Routes](#-server-actions--api-routes)
- [Dashboard & Analytics](#-dashboard--analytics)
- [Deployment](#-deployment)
- [Documentation](#-documentation)
- [Roadmap](#-roadmap)
- [License](#-license)

---

## 🚀 Project Overview

**ServiceCentric** is an enterprise platform engineered to manage large-scale heavy machinery fleets, field service operations, multi-branch inventory, rental fleet workflows, customer relationships, corporate finance, and workforce lifecycle management. Designed to scale seamlessly from 500+ machines to 50,000+ units across regional branches without architectural friction.

### Key Operational Challenges Solved

- ❌ **Fragmented Operational Spreadsheets**: Replaces manual spreadsheets with a unified PostgreSQL database protected by Row Level Security (RLS).
- ❌ **Unmonitored Machine Hours & Breakdown Downtime**: Replaces paper logs with daily operator hour meter tracking, shift condition checks, fuel logs, and real-time breakdown complaint dispatch.
- ❌ **Unstructured Field Reports**: Standardizes field service documentation with digital Field Service Reports (FSR) featuring interactive checklists, replacement parts tables, and 1-click A4 PDF export.
- ❌ **Uncontrolled Rental & Sales Lifecycle**: Integrates agreement creation with automated discount approval thresholds (>15% discounts flag for manager approval), delivery challan generation, return inspection logs, and damage auto-routing.
- ❌ **Opaque Financials & Manual Matching**: Provides an 11-tab Finance Suite featuring 3-Way Matching (PO ↔ GRN ↔ Supplier Invoice), receivables aging breakdown, partial payment ledgers, and expense approvals (>₹50,000 flagged).
- ❌ **Lack of Role & Scope Isolation**: Enforces a 13-Role RBAC permissions matrix with data scoping levels (`ORGANIZATION`, `BRANCH`, `ASSIGNED`).

---

## ✨ Key Features

### 🏢 13-Role RBAC & Granular Security Matrix
- **13 Operational Roles + Client**: `super_admin`, `admin`, `branch_manager`, `service_manager`, `service_engineer` (and `engineer`), `supervisor`, `mechanic`, `operator`, `store_manager`, `hr_manager`, `rental_manager`, `sales_executive` (Sales Manager/Exec), `finance_manager`, and `client`.
- **Data Access Scoping**: Strict scoping levels (`ORGANIZATION` global scope, `BRANCH` single-branch scope, and `ASSIGNED` user-specific scope) enforced in Data Access Layer (`lib/dal.ts`) and RLS policies.
- **Single Branch Consolidation**: Consolidated multi-node operations into Delhi Branch HQ (`DEL-HQ`), managing users, employees, machinery catalog, stock ledger, purchase requests, POs, GRNs, and delivery challans.
- **Top-Bar Branch Selector**: Instant global vs. branch-specific data scoping via `<BranchSelector />` in `AppHeader`.

### ⚡ My Work — Live Task & Assignment Hub (`/my-work`)
- **Role-Scoped Workload Workspace**: Personalized task hub for field engineers, mechanics, operators, store managers, and admins querying live data from Supabase.
- **Assigned Items Scoping**: Scopes assigned breakdown complaints (`machine_complaints`), assigned service jobs (`service_records`), assigned equipment cards (`machines`), role-specific approval tasks (`purchase_orders`), and daily meter log tasks.
- **Permission-Gated UI Controls**: Integrated `roleHasPermission()` access controls on task actions and clean empty states ("No Assigned Work Items Today") for field staff with zero active tasks.

### 📋 To-Do & Task Management System (`/tasks`)
- **Boss → Employee Task Delegation**: Boss/Managers create and assign daily or scheduled tasks to single or multiple employees with due dates, due times, priority levels (`low`, `medium`, `high`, `critical`), and reminder offsets (`10m`, `30m`, `1h`, `1d`).
- **Full Task Lifecycle & Statuses**: Complete tracking through `pending`, `in_progress`, `completed`, `overdue`, `cancelled`, and `reopened` states.
- **Employee Task Execution & Completion Proof**: Employees view assigned tasks, update progress, add completion notes, and upload completion proof attachments (photos/documents).
- **Manager Verification & Reopening**: Managers review submitted task completion details and proof attachments with options to **Approve & Verify** or **Reject & Reopen** with revision feedback.
- **Task Discussions & Audit Timeline**: Threaded comments between employees and managers per task, accompanied by complete audit activity logs (`task_activity_logs`).
- **Unified Web & Mobile Experience**: Full feature parity between Next.js Web App (List View, Kanban Board, Multi-Filter toolbar, KPI stats) and Expo Mobile App matching native wireframe designs.


### 🏭 Machine Directory & Compliance Master (`/machines`)
- **Machine Taxonomy**: Dynamic categories (`machine_categories`) including Forklifts, Scissor Lifts, Boom Lifts, Reach Trucks, Pallet Trucks, and Industrial Generators.
- **Extended Technical Specifications**: Tracks equipment specs, model details, serial numbers, manufacturer, year of mfg, engine serial number, and engine MOT number.
- **Compliance & Insurance Tracking**: Monitors Insurance Policy numbers & expiry dates, Third-Party Certificates & expiry dates, and RTO Tax registrations & expiry dates.
- **Machine Lifecycle**: `active`, `inactive`, `on_rent`, and `under_maintenance`.
- **Universal Table Selection & CSV Export**: Row checkboxes enabled for all employee roles viewing the directory with CSV export capturing Category, Machine Code, Name, Model, Serial Number, Hour Meter, Total Services, Status, Customer Name, City, State, Assigned Engineer, Assigned Operator, and Next Service Due Date.

### 🛠 Breakdown Complaints & Digital Field Service Report (FSR) (`/service`)
- **Direct Malfunction Reporting**: Breakdown complaint logging (`machine_complaints`) by Supervisors, Service Engineers, Mechanics, and Admins with complaint tracking numbers, hour meter readings, required parts, and location.
- **Digital FSR Checklist**: Interactive field service report with 1-click **"Mark All Passed (Y)"** helpers, component inspections, and work completed/pending logs.
- **Replacement Parts Ledger**: In-report parts table tracking replacement part names, quantities, statuses, and replacement dates.
- **Crisp A4 PDF & Print Engine**: Purpose-built iframe printer generating clean single-page A4 PDF documents (`210mm x 297mm`) with input sanitization and browser header/footer stripping.
- **FSR Manager Review & Approval**: Dual read-only and edit modes with approval buttons ("Approve FSR", "Send Back for Revision") for Service Managers and Branch Managers.

### 🚜 Operations & Workforce Directory (`/operations`)
- **4-Tab Operations Suite**:
  1. *Daily Running Hour Logs*: Daily start/end hour meter readings, fuel consumed (liters), shift details, condition checks, and anomaly warning badges.
  2. *Operator Assignments*: Assign and track operators assigned to specific machinery units.
  3. *Loading/Unloading Ledger*: Record rental machine loading at yard, transport vehicle numbers, dispatch, and client site unloading/relocation (`machine_site_movements`).
  4. *Operator Workforce Directory & Payroll*: Direct operator hiring workflow (`hireOperatorAction`), workforce directory under branch, and monthly salary payout recorder (`recordOperatorPayoutAction`).

### 🔑 Rental Operations Hub (`/rentals`)
- **Customer Directory & Rental Requests**: Track rental customer profiles, soft-delete archiving, and rental requests.
- **Agreements & Discount Threshold Governance**: Contract creation with automatic discount approval thresholds (discounts > 15% require higher Admin/Sales approval).
- **Dispatch & Delivery Challans**: Pre-dispatch inspection, automated delivery challan generation, and machine status transition to `on_rent`.
- **Return Inspections & Damage Routing**: Record return meter, fuel level, and condition; auto-creates Damage Reports and notifies Service & Finance modules if damaged.
- **Contract Extensions & Billing Requests**: Check machine reservation availability for contract extensions, and auto-calculate base rental, extra hours, transport, damage charges, and deposit adjustments for Finance.

### 📈 Sales & CRM Management Suite (`/crm`)
- **10-Tab Sales Operations Hub**:
  1. *Sales Dashboard*: 14 KPI metric cards and sales activity toolbar.
  2. *Lead Pipeline*: Track leads with multi-stage deal statuses and 1-click lead-to-customer conversion wizard.
  3. *Customer Directory*: Complete customer profiles with soft-delete archiving.
  4. *Interaction Logger*: Record client calls, site visits, emails, and meetings.
  5. *Opportunity Management*: Track sales deal pipelines, values, and probability.
  6. *Multi-Version Quotations*: Create versioned quotations (`V1` $\rightarrow$ `V2`) without overwriting sent quotes, with discount approval guardrails (0–5% auto-approved, >5% manager approval required).
  7. *Sales Orders*: Convert accepted quotes into confirmed sales orders.
  8. *Machine Sales & Reservations*: Reserve machines for sales orders without physical stock dispatch.
  9. *Delivery & Handover*: Request delivery and upload signed handover proof documents.
  10. *Sales Settings*: Configure sales defaults and thresholds.

### 💰 Finance & Financial Governance Suite (`/finance`)
- **11-Tab Enterprise Finance Hub**:
  1. *Financial KPIs & Cash Flow*: Live metrics on total revenue, outstanding receivables, accounts payable, and cash-flow summaries.
  2. *Sales & Rental Billing*: Unified review of incoming billing requests from Sales and Rentals.
  3. *Invoices & Notes Directory*: Multi-filter invoice directory, draft/finalized states, and Credit/Debit Note generation for finalized invoices.
  4. *Payment Ledger*: Record client payments supporting partial payments with auto-calculated remaining balances.
  5. *Receivables Aging Report*: Aging analysis categorized into 0–30, 31–60, 61–90, and 90+ days aging buckets with follow-up tracking.
  6. *Payables & Supplier Settlements*: Manage vendor payables and supplier payment disbursements.
  7. *3-Way Match Verification Matrix*: Verifies PO ↔ GRN ↔ Supplier Invoice with payment hold triggers on discrepancies.
  8. *Expense Tracker*: Record operational expenses with auto-approval thresholds (expenses > ₹50,000 flagged for manager review).
  9. *HR Payroll Summaries*: Aggregated salary and payroll summary views.
  10. *Financial Reports*: Exportable financial summary reports with 1-click CSV download.
  11. *Finance Settings*: Manage default tax rates, payment terms, and invoicing configurations.

### 👥 HR & Employee Lifecycle Suite (`/hr`)
- **7-Tab Workforce Management Suite**:
  1. *Workforce Dashboard*: 12 KPI metric cards, department/designation breakdowns, and employee distribution charts.
  2. *Employee Directory*: Complete staff profiles with status lifecycle tracking (`pending_onboarding`, `active`, `on_leave`, `notice_period`, `resigned`, `terminated`, `retired`, `inactive`, `archived`). Soft-delete protection prevents hard deletion of staff with historical records.
  3. *Onboarding*: Onboard new employees with structured details.
  4. *Departments & Designations*: Master creation and management of organizational departments and designations.
  5. *Salary & Payroll History*: Fixed, variable, and CTC breakdown with auditable revision entry history to prevent overwriting past salary records.
  6. *User Account Requests*: Internal requests for provisioning system user accounts.
  7. *Document Repository*: Upload and manage employee document attachments.

### 📦 Multi-Branch Inventory & Stock Ledger (`/inventory`)
- **Multi-Branch Stock Balances**: Real-time product inventory ledger per storage location.
- **Stock Movements**: Stock In, Stock Out, Purchase Receipts (GRN), and Stock Adjustments (`ADJUSTMENT`, `DAMAGE`, `LOSS`) with document references.
- **PO Approval Thresholds**: Purchase orders $\le ₹10,000$ auto-approve; POs $> ₹10,000$ flag as `pending_approval` requiring manager authorization.
- **Inter-Branch Stock Transfers**: Orchestrate inter-branch transfers (`stock_transfers`) with status tracking (`draft`, `in_transit`, `completed`, `cancelled`).
- **Product Archiving**: Soft-archive inactive products preventing deletion of items with historical stock ledger entries.

### 📢 Multi-Channel Notification Engine
- **Email (via SendGrid)**: Daily consolidated summary emails for Super Admins and individualized task emails for Service Engineers; transactional auth & password reset emails.
- **WhatsApp & SMS (via Twilio)**: Real-time service due alerts for assigned engineers and customer contacts.
- **In-App Alerts**: Real-time toast notifications and notification center history with date filters and alert type tags.
- **Automated Daily Reminders**: Scheduled QStash cron endpoint (`/api/cron/send-reminders`) dispatching daily reminders at 08:00 AM.

### 🎨 Vercel Geist Design System & App Shell
- **App Shell & 2-Column Layout**: Smooth 2-column workspace shell with Framer Motion spring transitions (`280px` expanded / `72px` collapsed).
- **ChatGPT-Style Collapsed Logo Toggle**: Hovering over the collapsed sidebar logo smoothly morphs into the expand button (`PanelLeftOpen`).
- **Vercel Geist Day/Night Theme Switch**: Animated dark/light toggle switch (`ThemeToggle`) with spring physics and sun/moon micro-animations.
- **Universal Reusable Custom Dropdown (`Select.tsx`)**: Reusable custom dropdown component built with Framer Motion popover slide & fade animations, dark/light theme tokens, checkmark indicators (`AnimatedCheck`), search filtering for long option lists (> 6 items), and full keyboard navigation (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`), replacing 100% of native browser `<select>` dropdowns across the web application.
- **Reusable FilterToolbar & Table Primitives**: Standardized search input with filter toggle button, active filter count badge, and expandable multi-field filter panel.
- **Platform-Aware Command Palette (`⌘K` / `Ctrl+K`)**: Weighted relevance search engine mapping commands and alias keywords.

---

## 🏗 Monorepo System Architecture & Boundary Rules

ServiceCentric is orchestrated as a high-performance pnpm workspace with Turborepo task pipeline management (`turbo.json`).

```
              [ apps/* ]
     (apps/web [@servicecentric/web], 
      apps/mobile [@servicecentric/mobile])
                    │
                    ▼
        [ shared/domain packages ]
   (@servicecentric/api-client, @servicecentric/validation, 
    @servicecentric/permissions, @servicecentric/design-tokens)
                    │
                    ▼
         [ foundation packages ]
     (@servicecentric/types, @servicecentric/utils)
```

### Layer & Boundary Enforcement Rules
1. **One-Way Dependency Flow**: Dependencies flow strictly from `apps/*` → `shared domain packages` → `foundation packages`.
2. **Forbidden Dependencies**:
   - ❌ `packages/*` → `apps/*` (Packages MUST NOT import from applications)
   - ❌ `foundation packages` → `shared domain packages`
   - ❌ `apps/web` ↔ `apps/mobile` (No cross-app imports)
   - ❌ Circular dependencies (Direct or indirect)
   - ❌ Deep internal imports (Import strictly through canonical package export barrels `index.ts`)
3. **Workspace Packages**:
   - **`@servicecentric/types`**: Pure TypeScript interfaces, DTOs, and Supabase Database Types (zero runtime dependencies).
   - **`@servicecentric/validation`**: Canonical Zod schemas shared across forms, API handlers, and Server Actions.
   - **`@servicecentric/permissions`**: Universal 14-role RBAC matrix, permissions, and 3-tier scoping rules.
   - **`@servicecentric/design-tokens`**: Visual tokens with Web (CSS custom variables) and Mobile (React Native theme objects) adapters.
   - **`@servicecentric/api-client`**: Standardized response envelopes (`ApiResponse<T>`), endpoint contracts, and error handlers.
   - **`@servicecentric/utils`**: Platform-neutral helper functions (date formatters `"en-GB"`, INR currency, string formatters).
   - **`@servicecentric/config`**: Tooling and linting configurations.

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | [Next.js 16.2](https://nextjs.org) (App Router) | React Server Components, Server Actions, API Routes |
| **UI Library** | [React 19.2](https://react.dev) | Modern component-based UI |
| **Language** | [TypeScript 5](https://www.typescriptlang.org) | Strict type safety across DAL, actions, and UI |
| **Database** | [Supabase PostgreSQL](https://supabase.com) | PostgreSQL database with Row Level Security (RLS) |
| **Auth** | [Supabase Auth (SSR)](https://supabase.com/docs/guides/auth) | Server-side cookie sessions, auth flow, JWT |
| **Email** | [SendGrid Mail API](https://sendgrid.com) | Transactional, daily summary, and task notification emails |
| **SMS & WhatsApp**| [Twilio API](https://www.twilio.com) | Direct SMS and WhatsApp message dispatch |
| **Scheduler** | [Upstash QStash](https://upstash.com/qstash) | Cron scheduling for daily reminder automation |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com) | Utility-first styling with Geist design tokens |
| **UI Components** | [shadcn/ui](https://ui.shadcn.com) + [Base UI](https://base-ui.com) | Accessible interactive UI primitives |
| **Animations** | [Framer Motion 12](https://www.framer.com/motion/) | Layout transitions, spring physics, flyouts, and modals |
| **Charts** | [Recharts 3](https://recharts.org) | Responsive dashboard charts |
| **Validation** | [Zod 4](https://zod.dev) | Schema validation for forms and server actions |

---

## 🚦 Getting Started

### Prerequisites

- **Node.js** 20+ (LTS recommended)
- **pnpm** (Required monorepo package manager)
- **Supabase** account & project
- **SendGrid** API Key (for transactional & daily summary emails)
- **Twilio** Account SID & Auth Token (optional for SMS/WhatsApp)
- **Upstash QStash** token (optional for automated cron trigger)

### 1. Clone the Repository

```bash
git clone https://github.com/vaibhavchauhan-15/reachinternation.com.git
cd reachinternation.com
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the project root (see [Environment Variables](#-environment-variables)).

### 4. Run Database Migrations

Execute the SQL migration files in sequence in your Supabase SQL Editor or via Supabase CLI:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_update_notifications_channel.sql`
3. `supabase/migrations/002_user_email_and_gmail_notifications.sql`
4. `supabase/migrations/003_add_in_app_notifications.sql`
5. `supabase/migrations/003_performance_indexes.sql`
6. `supabase/migrations/004_dashboard_rpc.sql`
7. `supabase/migrations/005_fix_dashboard_rpc_user_context.sql`
8. `supabase/migrations/006_email_notifications.sql`
9. `supabase/migrations/007_user_pending_status.sql`
10. `supabase/migrations/008_daily_summary_notifications.sql`
11. `supabase/migrations/009_machine_extended_details.sql`
12. `supabase/migrations/010_machine_categories_complaints_services.sql`
13. `supabase/migrations/011_enterprise_rbac_branches_inventory.sql`
14. `supabase/migrations/012_multi_layer_performance_indexes.sql`
15. `supabase/migrations/013_additional_performance_indexes.sql`
16. `supabase/migrations/014_store_manager_inventory_erp.sql`
17. `supabase/migrations/015_seed_dummy_data.sql`
18. `supabase/migrations/016_add_manufacturer_to_inventory.sql`
19. `supabase/migrations/017_comprehensive_13_roles_rbac.sql`
20. `supabase/migrations/018_branch_manager_role_refinements.sql`
21. `supabase/migrations/019_admin_role_refinements.sql`
22. `supabase/migrations/019_super_admin_role_refinements.sql`
23. `supabase/migrations/020_service_manager_role_refinements.sql`
24. `supabase/migrations/021_service_engineer_role_refinements.sql`
25. `supabase/migrations/022_supervisor_role_refinements.sql`
26. `supabase/migrations/023_mechanic_role_refinements.sql`
27. `supabase/migrations/024_operator_role_refinements.sql`
28. `supabase/migrations/025_store_manager_role_refinements.sql`
29. `supabase/migrations/026_hr_manager_role_refinements.sql`
30. `supabase/migrations/027_rental_manager_role_refinements.sql`
31. `supabase/migrations/028_sales_manager_role_refinements.sql`
32. `supabase/migrations/029_finance_manager_role_refinements.sql`
33. `supabase/migrations/030_single_delhi_branch_consolidation.sql`
34. `supabase/migrations/031_fix_machines_rls_scoping.sql`
35. `supabase/migrations/032_supervisor_operations_enhancements.sql`

### 5. Run Development Server

```bash
pnpm dev
```

Navigate to `http://localhost:3000` in your browser.

---

## 🔑 Environment Variables

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
SUPABASE_SECRET_KEY=your_service_role_key

# Application Settings
NEXT_PUBLIC_APP_URL=http://localhost:3000

# SendGrid Email Integration
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=notifications@yourdomain.com
SENDGRID_FROM_NAME=ServiceCentric

# Twilio Messaging (WhatsApp / SMS)
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
TWILIO_SMS_NUMBER=+14155238886

# Upstash QStash Cron Security
QSTASH_CURRENT_SIGNING_KEY=your_qstash_key
QSTASH_NEXT_SIGNING_KEY=your_next_qstash_key
```

---

## 🔐 13-Role RBAC & Data Scoping Architecture

ServiceCentric implements a granular permission matrix enforced across Server Actions (`lib/auth/rbac.ts`), Data Access Layer (`lib/dal.ts`), database RLS policies, and UI elements.

### Supported System Roles

| Role | Scope | Primary Responsibilities |
|------|-------|--------------------------|
| `super_admin` | Global (`ORGANIZATION`) | Unrestricted global governance, branch configuration, audit log protection, user role management. |
| `admin` | Global / Branch | User onboarding, machine master operations, breakdown handling, system oversight. |
| `branch_manager` | Branch (`BRANCH`) | Branch operational control, equipment catalog, service planning, inventory oversight, FSR review. |
| `service_manager` | Branch (`BRANCH`) | Service schedule planning, breakdown assignment, engineer dispatch, FSR review & approvals. |
| `service_engineer` | Assigned (`ASSIGNED`) | Field service execution, breakdown resolution, digital FSR creation, parts usage logging. |
| `supervisor` | Branch (`BRANCH`) | Machinery breakdown complaint logging, daily operator hour meter log verification, site movements. |
| `mechanic` | Assigned (`ASSIGNED`) | Equipment maintenance, repair detail logging, part requests, breakdown assistance. |
| `operator` | Assigned (`ASSIGNED`) | Daily machine hour meter entries, shift condition checks, start/end fuel level tracking. |
| `store_manager` | Branch (`BRANCH`) | Inventory stock ledger, stock receiving/dispatch, PO creation/approvals, inter-branch transfers. |
| `hr_manager` | Global (`ORGANIZATION`) | Employee directory, staff onboarding, department/designation management, salary history, user requests. |
| `rental_manager` | Branch (`BRANCH`) | Rental customer directory, contract agreements, dispatch challans, return inspections, damage routing. |
| `sales_executive` | Branch (`BRANCH`) | Lead pipeline, customer interactions, opportunities, versioned quotations, sales orders, delivery requests. |
| `finance_manager` | Global (`ORGANIZATION`) | Billing review, multi-filter invoicing, payment ledgers, receivables aging, 3-way PO matching, expenses. |
| `client` | Customer Portal | View owned machinery fleet, service history, compliance certificates, and contract status. |

---

## 🗄 Database Schema

The platform relies on Supabase PostgreSQL with **38+ core tables**, all protected by Row Level Security (RLS) policies and triggers.

```
                           +-------------------+
                           |     branches      |
                           +---------+---------+
                                     | 1:N
     +-------------------------------+-------------------------------+
     |                               |                               |
+----v----+                     +----v----+                     +----v----+
|  users  |                     |employees|                     |inventory|
+----+----+                     +----+----+                     +---------+
     | 1:N                           | 1:N
+----v----+                     +----v----+
|machines |<----+ 1:N           |  salary |
+----+----+     |               +---------+
     | 1:N      |
     +----------+----------+-----------------+-----------------+
     |                     |                 |                 |
+----v----+           +----v----+       +----v----+       +----v----+
|services |           |complaint|       |meter log|       | rentals |
+---------+           +---------+       +---------+       +---------+
```

### Core Domain Tables Summary

- **Core & Org**: `branches`, `user_branches`, `users`, `employees`, `departments`, `designations`, `employee_salary_history`, `employee_documents`, `user_account_requests`.
- **Machinery Master**: `machines`, `machine_categories`, `machine_assignments`, `machine_hour_logs`, `machine_site_movements`.
- **Field Service**: `machine_complaints`, `service_records`, `field_service_reports`, `service_part_usage`.
- **Inventory & Procurement**: `inventory_products`, `inventory_stock`, `inventory_transactions`, `stock_transfers`, `purchase_orders`, `purchase_order_items`, `vendors`, `delivery_challans`.
- **Rental Operations**: `rental_customers`, `rental_requests`, `rental_agreements`, `rental_delivery_challans`, `rental_return_inspections`, `rental_damage_reports`, `rental_extension_requests`, `rental_billing_requests`, `rental_accessories_log`.
- **Sales & CRM**: `sales_leads`, `sales_customers`, `sales_customer_interactions`, `sales_opportunities`, `sales_quotations`, `sales_orders`, `sales_machine_reservations`, `sales_delivery_coordinations`, `sales_settings`.
- **Finance & Accounting**: `finance_invoices`, `finance_invoice_items`, `finance_payments`, `finance_credit_debit_notes`, `finance_expense_categories`, `finance_expenses`, `finance_3way_matching_reviews`, `finance_vendor_payments`, `finance_receivable_followups`, `finance_settings`.
- **System & Security**: `permissions`, `role_permissions`, `notifications`, `audit_logs`.

---

## 🛠 Breakdown Complaints & Digital FSR System

ServiceCentric features a complete field service workflow for breakdown complaints:

1. **Malfunction Reporting**: A Supervisor, Admin, Service Manager, or Field Engineer logs a breakdown complaint via `<MachineComplaintModal />` on `/machines?tab=complaints` or via `action=create_complaint`.
2. **Engineer Dispatch & Multi-Option Filtering**: The complaint is assigned to a Service Engineer or Mechanic with status set to `open`, `in_progress`, or `pending_parts`. The `/machines?tab=complaints` view provides multi-option filters for Status, Machine/Model, Assigned Engineer, and Spare Parts Required.
3. **Interactive Complaint Detail Modal**: Clicking any row in the complaints table opens `<ComplaintDetailModal />`, providing comprehensive machine specs, reported malfunction details, required spare parts & quantities, hour meter reading, assigned personnel, work log, and direct action triggers.
4. **Field Service Report (FSR)**: The engineer opens `<FieldServiceReportModal />` via the compact icon-only FSR button, completes component checklists, records work completed/pending, specifies replacement parts, and resolves the issue.
5. **Managerial Governance & Deletion**: Service Managers and Admins can perform complaint management, editing, or deletion via `deleteComplaint` server action with automatic machine status restoration.
6. **Digital A4 PDF Generation**: Clicking **"Print / Save PDF"** invokes an iframe print handler generating an exact A4 portrait PDF output with clean text inputs and zero browser header/footer artifacts.

---

## 📢 Notification Engine

The system supports automated multi-channel messaging:

- **Daily Operations Summary (Super Admins)**: Automated email containing key operational metrics (total active machines, machines added/completed today, due tomorrow, overdue list, and notification delivery stats).
- **Personalized Engineer Daily Summary**: Individualized email sent to each active Service Engineer with their assigned machines due tomorrow, overdue items, and recent completion log.
- **Service Due Reminders**: Automated WhatsApp/SMS/Email notifications dispatched for machines due today, due tomorrow, or overdue.

---

## 📁 Monorepo Structure & Shared Packages

```
reachinternation.com/
├── apps/
│   ├── web/                          # Next.js App Router Application (@servicecentric/web)
│   │   ├── app/                      # Next.js App Router (25 route modules, actions, API routes)
│   │   ├── components/               # Geist design system UI components & feature modules
│   │   └── lib/                      # Data Access Layer (DAL), query helpers, & auth re-exports
│   └── mobile/                       # Expo / React Native Application (@servicecentric/mobile)
│       ├── app/                      # Expo Router navigation ((auth)/login, (app)/dashboard, my-work, machines)
│       ├── components/ui/            # Native design system primitives (Button, Input, Card, Badge, ThemeProvider)
│       ├── components/work/          # My Work field task modals (MeterLogModal, ComplaintStatusModal)
│       ├── components/machines/      # Fleet machine detail modals (MachineDetailModal)
│       ├── components/complaints/    # Breakdown complaint reporting modals (CreateComplaintModal)
│       ├── components/fsr/           # Field Service Report modals (CreateFsrModal)
│       ├── components/operations/    # Operations & site relocation modals (SiteMovementModal)
│       ├── components/inventory/     # Inventory part requisition modals (PartRequestModal)
│       ├── components/rentals/       # Rental return inspection modals (RentalReturnModal)
│       ├── components/crm/           # CRM lead & activity modals (CreateLeadModal, LogInteractionModal)
│       ├── components/finance/       # Finance expense claim modals (ExpenseClaimModal)
│       ├── components/hr/            # HR employee & request modals (EmployeeDetailModal, AccountRequestModal)
│       ├── components/ui/            # Native design system primitives, OfflineSyncBanner & OptimizedList
│       └── lib/                      # Supabase client, useAuth, notifications, media, offline-sync, realtime, performance, accessibility, security, testing & environment manager
├── packages/                         # Canonical Shared Monorepo Packages
│   ├── types/                        # @servicecentric/types — 22 domain category TypeScript definitions
│   ├── validation/                   # @servicecentric/validation — Zod schemas across 12 domain categories
│   ├── permissions/                  # @servicecentric/permissions — 14 roles, 100+ permissions & 3-tier scoping
│   ├── design-tokens/                # @servicecentric/design-tokens — Light/Dark tokens & Web/RN theme adapters
│   ├── api-client/                   # @servicecentric/api-client — Shared API response envelopes, error classes & 11 domain endpoint contracts
│   ├── config/                       # @servicecentric/config — Shared TypeScript/ESLint workspace configs
│   └── utils/                        # @servicecentric/utils — Platform-neutral date, currency, string, and object helpers
├── supabase/migrations/              # SQL schema migration scripts (001 - 032)
├── pnpm-workspace.yaml               # pnpm workspace package declaration
└── turbo.json                        # Turborepo task pipeline orchestration
```
│   ├── layout/                       # AppSidebar, AppHeader, AppShellClient, PublicNavbar
│   ├── my-work/                      # MyWorkClient task cards & action buttons
│   ├── machines/                     # MachineListClient, MachineModal, MobileMachineCard
│   ├── complaints/                   # ComplaintsClient, FieldServiceReportModal, MachineComplaintModal
│   ├── crm/                          # CrmClient sales suite & quotation builder
│   ├── rentals/                      # RentalManagementClient hub & delivery modals
│   ├── finance/                      # FinanceClient 11-tab accounting suite
│   ├── hr/                           # HRClient employee lifecycle & salary modals
│   ├── operations/                   # OperationsClient meter logs, site movement & hiring
│   ├── inventory/                    # StockLedgerClient, StockTransferModal
│   ├── theme/                        # ThemeToggle (Day/Night & Geist switch)
│   └── ui/                           # Reusable UI primitives (FilterToolbar, SearchableSelect, etc.)
├── lib/
│   ├── auth/rbac.ts                  # Central 13-role permission matrix & capability checks
│   ├── auth/scope.ts                 # Data access scoping rules (ORGANIZATION, BRANCH, ASSIGNED)
│   ├── dal.ts                        # Data Access Layer & cached currentUser()
│   ├── notifications/                # Multi-channel notification engine (SendGrid, Twilio)
│   ├── queries/                      # Batched database query helpers (finance, sales, rentals, hr, etc.)
│   └── types/database.ts             # TypeScript database schemas & interface types
└── supabase/migrations/              # SQL schema migration scripts (001 - 032)
```

---

## ⚙️ Server Actions & API Routes

| Domain | Action File | Core Server Actions |
|--------|-------------|---------------------|
| **Machines** | `app/actions/machines.ts` | `createMachine`, `updateMachine`, `deleteMachine`, `reassignMachine` |
| **Complaints & FSR**| `app/actions/complaints.ts` | `createComplaint`, `updateComplaintStatus`, `resolveComplaintFSR` |
| **Services** | `app/actions/services.ts` | `completeService`, `updateServiceLog` |
| **Rentals** | `app/actions/rentals.ts` | `createRentalCustomerAction`, `createRentalAgreementAction`, `dispatchRentalMachineAction`, `recordMachineReturnAction`, `extendRentalContractAction`, `createRentalBillingRequestAction` |
| **Sales & CRM** | `app/actions/sales.ts` | `createSalesLeadAction`, `convertLeadAction`, `createSalesQuotationAction`, `reviseSalesQuotationAction`, `createSalesOrderAction`, `reserveMachineForSalesAction`, `completeSalesHandoverAction` |
| **Finance** | `app/actions/finance.ts` | `createInvoiceAction`, `finalizeInvoiceAction`, `recordPaymentAction`, `review3WayMatchAction`, `createExpenseAction`, `approveExpenseAction` |
| **HR & Payroll** | `app/actions/hr.ts` | `createEmployeeAction`, `changeEmployeeStatusAction`, `createSalaryRevisionAction`, `manageDepartmentAction`, `requestUserAccountAction` |
| **Operators & Fleet**| `app/actions/operators.ts` | `submitOperatorHourLogAction`, `updateOperatorHourLogAction`, `hireOperatorAction`, `recordOperatorPayoutAction` |
| **Inventory** | `app/actions/inventory.ts` | `createInventoryProduct`, `recordStockTransaction`, `createStockTransfer`, `approvePurchaseOrderAction`, `archiveProductAction` |
| **Branches** | `app/actions/branches.ts` | `updateBranchAction`, `deactivateBranchAction`, `getBranches` |
| **Users & RBAC** | `app/actions/users.ts` | `getAllUsers`, `getPendingUsers`, `createUser`, `editUser`, `approveUser`, `rejectUser` |
| **Cron API** | `app/api/cron/send-reminders` | Automated daily reminder dispatch (08:00 AM) |

---

## 📊 Dashboard & Analytics

Role-tailored home dashboards (`app/(app)/dashboard/page.tsx`):

- **Super Admin / Admin**: Global machinery counts, overdue trend area chart, monthly services completed bar chart, notification delivery stats, and recent activity log.
- **Finance Manager**: Outstanding receivables aging summary, accounts payable, monthly sales & rental revenues, cash flow overview.
- **Sales Manager / Executive**: Lead conversion pipeline funnel, open opportunities total value, monthly quotations sent vs. orders won.
- **Rental Manager**: Rental fleet availability matrix, active rental contracts, machines on rent, pending return inspections.
- **Store Manager**: Total inventory items, low stock warnings, pending PO approvals (>₹10k), pending inter-branch stock transfers.
- **HR Manager**: Total employee count, workforce department & designation breakdowns, recent onboardings.
- **Service Engineer & Mechanic**: Assigned machines due today/tomorrow, overdue service list, assigned breakdown complaints, and quick FSR Launcher.
- **Operator**: Assigned machine details, current hour meter reading, shift log shortcut.

---

## 🚀 Deployment

### Vercel Deployment

1. Connect repository to [Vercel](https://vercel.com).
2. Configure all environment variables in Vercel project settings.
3. Deploy build.

### Scheduled Cron Automation

Configure Upstash QStash or Vercel Cron to invoke `POST /api/cron/send-reminders` daily at `08:00 AM`.

---

## 📚 Documentation

- [`AGENTS.md`](AGENTS.md) — AI Software Engineer protocol & codebase guidelines.
- [`Mobile/phases.md`](Mobile/phases.md) — AI Agent Execution Plan for Web + Mobile Monorepo Migration.
- [`docs/current-architecture.md`](docs/current-architecture.md) — Phase 0 Architecture Audit & System Inventory.
- [`docs/current-dependencies.md`](docs/current-dependencies.md) — Phase 0 Package Manager, Dependency & Environment Audit.
- [`docs/current-security.md`](docs/current-security.md) — Phase 0 RBAC Matrix, Security Boundaries & RLS Audit.
- [`docs/current-database.md`](docs/current-database.md) — Phase 0 Database Schema, 35 Migrations & Storage Bucket Audit.
- [`AI/PROJECT_MEMORY.md`](AI/PROJECT_MEMORY.md) — High-level architecture overview and stack rules.
- [`AI/STATE.md`](AI/STATE.md) — Persistent project state, health status, and feature completion index.
- [`AI/CHANGELOG_AI.md`](AI/CHANGELOG_AI.md) — Detailed feature implementation logs.

---

## 🗺 Roadmap

### Web + Mobile Monorepo Plan 🚀
- [x] **Phase 0 — Repository and Production Audit Baseline**: Full inventory of 25 web routes, 18 Server Actions, 19 DAL queries, 35 database migrations, 38+ tables, 13 system roles, and environment secrets protection rules.
- [x] **Phase 1 — Monorepo Foundation**: Convert repository into pnpm workspace (`apps/web`, `apps/mobile`, `packages/*`) with Turborepo task pipeline orchestration (`turbo.json`).
- [x] **Phase 2 — Shared Type System**: Modularize canonical domain types into `@servicecentric/types` covering all 22 domain categories.
- [x] **Phase 3 — Shared Validation Package**: Modularize Zod validation schemas into `@servicecentric/validation` covering all 12 domain categories.
- [x] **Phase 4 — Shared Permissions Package**: Modularize RBAC matrix & scope definitions into `@servicecentric/permissions` covering 14 roles, 100+ permissions, and 3-tier scoping rules.
- [x] **Phase 5 — Shared Design Tokens Package**: Modularize brand colors, semantic tokens, typography, and bimodal radius into `@servicecentric/design-tokens` with Web CSS variables and React Native adapters.
- [x] **Phase 6 — Shared API / Data Contracts**: Create shared API client package `@servicecentric/api-client`.
- [x] **Phase 7 — Mobile App Foundation**: Initialize Expo React Native application (`apps/mobile`) with Expo Router & Supabase Auth.
- [x] **Phase 8 — Mobile Shared Layer Integration**: Wire mobile client to shared types, Zod schemas, and design tokens.
- [x] **Phase 9 — Mobile UI System**: Build mobile design primitives (`Button`, `Card`, `Badge`, `Input`, `MobileHeader`), top/bottom navigation, cards, and bottom sheets.
- [x] **Phase 10 — Mobile Auth & Profile**: Implement mobile login (mesh gradient hero bloom, platform metrics), password reset, and profile management.
- [x] **Phase 11 — Mobile Core Role Workflows**: Implement mobile Field Service FSRs, Operator hour meter logs, Breakdown Complaints, Sales, Rentals, HR, and Finance.
- [x] **Phase 12–33 — Mobile Alignment & Production Distribution**: Web-identical Vercel Geist theme system alignment (`#0a0a0a` canvas, `#171717` cards, `#262626` / `#ebebeb` hairlines, micro-dot status badges, pill CTAs, uppercase Geist Mono eyebrows, branded top header bar) + EAS Internal APK build distribution.

### Completed Features ✅
- [x] Mobile Navigation System: 3-Line Hamburger Menu Icon Modal (all 13 main pages) & Contextual Bottom Navbar Submenus (`@servicecentric/mobile`)
- [x] Comprehensive 13-Role RBAC & Data Access Scoping Architecture (`super_admin`, `admin`, `branch_manager`, `service_manager`, `service_engineer`, `supervisor`, `mechanic`, `operator`, `store_manager`, `hr_manager`, `rental_manager`, `sales_executive`, `finance_manager`, `client`)
- [x] Live Task & Assignment Workspace (`/my-work`)
- [x] Breakdown Complaints Management & Malfunction Logging (`/service?tab=complaints`)
- [x] Digital Field Service Report (FSR) with interactive checklists & A4 PDF / Print export
- [x] Machine Categories taxonomy & Extended Technical / Compliance tracking (Insurance, RTO Tax, 3rd Party Cert)
- [x] Multi-Branch Inventory Stock Ledger, PO approval thresholds (>₹10k), & Inter-Branch Stock Transfers (`/inventory`)
- [x] 7-Tab HR Employee Lifecycle Suite, Payroll Revision History, & Document Repository (`/hr`)
- [x] 4-Tab Operations Hub, Meter Logbook, Site Movement Ledger, & Operator Hiring (`/operations`)
- [x] 9-Tab Rental Fleet Hub, Agreements, Delivery Challans, Return Inspections, & Damage Routing (`/rentals`)
- [x] 10-Tab Sales & CRM Suite, Lead Pipeline, Versioned Quotations, & Discount Approvals (`/crm`)
- [x] 11-Tab Finance Management Suite, 3-Way PO Matching, Receivables Aging, Payments, & Expenses (`/finance`)
- [x] Vercel Geist Day/Night Theme Switch & 2-Column App Shell with smooth collapsed sidebar
- [x] Reusable `FilterToolbar` & `SearchableSelect` animated popovers
- [x] SendGrid multi-channel summary email dispatch & Twilio integration

---

## 📄 License

This is an internal enterprise application for **ServiceCentric**. All rights reserved.