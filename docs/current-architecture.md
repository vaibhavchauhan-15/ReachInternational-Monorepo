# ReachInternational — Current Architecture Audit

> **Phase 0 Deliverable**  
> **Last Updated:** 2026-08-19  
> **Status:** Verified & Baseline Established  

---

## 1. Executive Summary & Application Purpose

**ReachInternational** (`reachinternation.com`) is an enterprise-grade heavy machinery field-service, maintenance tracking, rental management, and operations platform. It serves 13 internal employee roles (from Super Admin and Branch Managers to Field Service Engineers, Mechanics, and Heavy Equipment Operators) plus Client access.

The system is built as a single Next.js web application designed for seamless monorepo evolution into a shared web + mobile (React Native/Expo) platform using a single Supabase PostgreSQL database, Supabase SSR Auth, and unified business rules.

---

## 2. Directory & File Structure Baseline

```text
ReachInternational-Monorepo/
├── app/                        # Next.js App Router (v16.2)
│   ├── (app)/                  # Main authenticated application shell & routes (25 modules)
│   ├── actions/                # Server Actions (18 files handling all mutations & validations)
│   ├── api/                    # API endpoints & background webhooks (Cron/QStash)
│   ├── login/                  # Authentication pages
│   ├── signup/                 # Signup flow
│   ├── forgot-password/        # Password reset flow
│   ├── globals.css             # Tailwind v4 theme & CSS variable definitions
│   └── layout.tsx              # Root HTML & Geist font provider layout
├── components/                 # React UI Components
│   ├── ui/                     # Shared UI primitives (29 reusable design system components)
│   ├── layout/                 # Layout shell (AppShellClient, AppSidebar, MobileBottomNav)
│   ├── animate-ui/             # Framer Motion animations & icons
│   └── [domain]/               # Domain components (machines, service, operations, finance, etc.)
├── lib/                        # Shared Business & Data Access Layer
│   ├── dal.ts                  # Server-side Data Access Layer & session authentication
│   ├── auth/                   # RBAC matrix (`rbac.ts`), Scoping (`scope.ts`), Server RBAC
│   ├── queries/                # Server DAL queries (19 domain files)
│   ├── supabase/               # Supabase client factories (browser, server, admin)
│   ├── notifications/          # Email (SendGrid), SMS/WhatsApp (Twilio), templates
│   ├── types/                  # TypeScript domain types & database schema types (`database.ts`)
│   └── audit-helpers.ts        # Centralized audit logging to `public.audit_logs`
├── supabase/                   # Database Infrastructure
│   ├── migrations/             # 35 SQL migration scripts (`001` to `032`)
│   ├── seed_dummy_data.mjs     # Complete seeding script (Delhi Branch single-branch model)
│   └── verify_seed.mjs         # Seed verification script (38+ tables checked)
├── docs/                       # Monorepo architecture & phase audit documentation
├── Mobile/                     # AI Agent execution plan (`phases.md`)
└── AI/                         # AI Persistent Project Memory System
```

---

## 3. Next.js Routes Inventory

The authenticated web application is organized under `app/(app)` into 25 operational route modules:

| Route Path | Primary Purpose | Primary Component / Views | Role Access |
| :--- | :--- | :--- | :--- |
| `/dashboard` | Executive & Branch Overview | `DashboardClient.tsx` | All roles |
| `/my-work` | Actionable daily items for field staff & managers | `MyWorkClient.tsx` | Field Engineers, Mechanics, Operators, Managers |
| `/machines` | Machinery directory, meter logs, specs | `MachineListClient.tsx` | All internal roles |
| `/service` | Service Hub & Field Service Reports (FSR) | `ServiceHubClient.tsx` | Service Managers, Engineers, Mechanics |
| `/services` | Detailed scheduled service logs | `ServicesClient.tsx` | Service Managers, Engineers |
| `/complaints` | Breakdown complaints log & creation | `ComplaintsClient.tsx` | All roles |
| `/operations` | Hour meters, Operator assignments, Movements | `OperationsClient.tsx` | Supervisors, Operators, Operations staff |
| `/rentals` | Rental contracts, dispatches, returns, billing | `RentalManagementClient.tsx` | Rental Managers, Sales, Finance |
| `/crm` | Sales leads, deals, quotes, pipeline | `CRMClient.tsx` | Sales Executives, Managers |
| `/finance` | Invoices, payments, CN/DN, 3-way match, expenses | `FinanceClient.tsx` | Finance Managers, Admins |
| `/hr` | Employee directory, payroll summary, onboarding | `HRManagementClient.tsx` | HR Managers, Admins |
| `/inventory` | Spare parts stock, locations, issues, PO requests | `InventoryManagementClient.tsx` | Store Managers, Engineers |
| `/purchase-orders` | Procurement approvals & PO history | `PurchaseOrdersClient.tsx` | Store Managers, Finance, Admins |
| `/challans` | Transport delivery challans & logbook | `ChallansClient.tsx` | Operations, Logistics |
| `/documents` | Machine & compliance document library | `DocumentsClient.tsx` | Managers, Admins |
| `/branches` | Single Delhi Branch office directory | `BranchesClient.tsx` | All roles |
| `/vendors` | Supplier & vendor directory | `VendorsClient.tsx` | Store Managers, Procurement, Finance |
| `/clients` | Client accounts directory | `ClientsClient.tsx` | Sales, Service Managers |
| `/users` | User administration & account status | `UserAdminClient.tsx` | Admins |
| `/administration` | System settings & branch configuration | `AdminClient.tsx` | Super Admin, Admin |
| `/audit-logs` | System mutation audit trail | `AuditLogsClient.tsx` | Super Admin, Admin |
| `/reports` | Operations & financial reporting suite | `ReportsClient.tsx` | Managers, Admins |
| `/notifications` | User notification inbox & preferences | `NotificationsClient.tsx` | All roles |

---

## 4. Data Access Layer (DAL) & Server Actions Inventory

### Data Access Layer (`lib/dal.ts` + `lib/queries/*.ts`)
The server data fetching layer strictly prohibits raw, un-scoped Supabase client queries inside UI components. Data is queried using 19 dedicated query modules in `lib/queries/`:

1. `audit-logs.ts` — Fetches system audit logs with filters.
2. `branches.ts` — Fetches branch metadata and single-branch info.
3. `categories.ts` — Machine categories & manufacturers.
4. `challans.ts` — Delivery challans and items.
5. `clients.ts` — Client organization profiles.
6. `complaints.ts` — Breakdown complaint logs and machine status.
7. `dashboard.ts` — RPC execution (`get_dashboard_stats`) and KPI stats.
8. `documents.ts` — Machine compliance documents and renewals.
9. `finance.ts` — Invoices, payments, CN/DN, expenses, 3-way match reviews.
10. `hr.ts` — Employee profiles, operator rosters, payroll summaries.
11. `inventory.ts` — Products, stock levels, storage locations, stock ledger, part issues.
12. `machines.ts` — Machine directory, specs, running hour meter logs.
13. `my-work.ts` — Live user-assigned work items (`LIMIT 20`).
14. `notifications.ts` — User in-app notifications and preferences.
15. `purchase-orders.ts` — Purchase requests and PO line items.
16. `rentals.ts` — Rental customers, contracts, dispatches, return inspections, damage reports.
17. `sales.ts` — CRM leads, deals, quotes, activities.
18. `services.ts` — Completed service records & FSR summaries.
19. `vendors.ts` — Approved suppliers and vendor details.

### Server Actions (`app/actions/*.ts`)
All data mutations are handled asynchronously via 18 Server Action files with strict Zod validation, session verification (`verifySession()`), role permission authorization (`checkPermission()`), scope enforcement, and audit log generation:

- `auth.ts` — Login, logout, signup, password reset.
- `branches.ts` — Branch profile updates.
- `categories.ts` — Category and manufacturer management.
- `complaints.ts` — Raise, assign, update, and resolve breakdown complaints.
- `finance.ts` — Invoice creation/finalization, payment recording, credit/debit notes, expense approvals, 3-way match.
- `hr.ts` — Onboard employees, update status, record salary payouts.
- `inventory.ts` — Product management, stock transactions (stock in/out/adjust/transfer), purchase requests, GRNs, part issues.
- `machine-import.ts` — Bulk CSV import of machinery and spec fields.
- `machines.ts` — Create, update, assign machines, log hour meter readings.
- `manual-reminder.ts` — Manual trigger for service and compliance reminders.
- `notifications.ts` — Mark notifications as read, update preferences.
- `operators.ts` — Hire operators, assign equipment, log running hours, record operator payouts.
- `refresh.ts` — Cache tag revalidation helper (`revalidateTag()`).
- `rentals.ts` — Customer directory, rental agreements, dispatch, return inspections, damage reports, extensions, billing requests.
- `sales.ts` — Manage leads, opportunities, quotes, deals, activities.
- `send-reminders.ts` — Automated reminder dispatch logic.
- `services.ts` — Log completed field service reports (FSR) and scheduled services.
- `users.ts` — User onboarding, role updates, account approval/suspension.

---

## 5. Module Categorization & Boundaries

### 5.1 Server-Only Modules
These modules depend on server environments, secret API keys, Node.js runtime, cookies, or direct Supabase Service Role access:
- `lib/dal.ts`
- `lib/server.ts`
- `lib/supabase/server.ts`
- `lib/supabase/admin.ts`
- `app/actions/*.ts`
- `lib/queries/*.ts`
- `app/api/cron/send-reminders/route.ts`
- `@sendgrid/mail`, `twilio`, `@upstash/qstash`

### 5.2 Browser-Only & Hybrid Modules
These modules contain interactive UI state, hooks, event listeners, DOM elements, dynamic animations, or browser-side Supabase client initialization:
- `lib/supabase/browser.ts`
- `components/ui/*` (Button, Input, EnterpriseTable, Modal, Toast, SearchableSelect, CommandPalette)
- `components/layout/AppShellClient.tsx`, `AppSidebar.tsx`, `MobileBottomNav.tsx`
- Interactive domain clients (`*Client.tsx`)
- `framer-motion` animations, `lucide-react` icons, `recharts` graphs

### 5.3 Reusable Business Logic (Mobile Expansion Candidate)
These modules contain zero server/DOM dependencies and are 100% reusable across Web and Mobile:
- `lib/auth/rbac.ts` — Core permission matrix for all 13 roles + client access.
- `lib/auth/scope.ts` — Scope calculations (`ORGANIZATION`, `BRANCH`, `ASSIGNED`).
- `lib/types/database.ts` — Canonical Supabase TypeScript data types.
- Zod validation schemas across Server Actions.
- `lib/notifications/templates.ts` — Message payload formatters.

---

## 6. Shared Design System & UI Baseline

The UI uses a modern, enterprise dark/light theme built with **Tailwind CSS v4**, **shadcn/ui**, and **Base UI** primitives:
- **Color Tokens**: CSS variables in `app/globals.css` defining `--color-canvas`, `--color-canvas-elevated`, `--color-hairline`, `--color-text-primary`, `--color-text-secondary`, `--color-brand-primary` (indigo/cyan glow accents).
- **Typography**: Modern font stack with high legibility for industrial data tables, KPI metrics, and log timelines.
- **Mobile Navigation**: Desktop uses `AppSidebar.tsx` (collapsible left menu); Mobile touch viewports automatically switch to `MobileBottomNav.tsx` with optimized touch targets, safe area padding, and bottom sheet dialogs.
