# ReachInternational — Industrial Machine Running Logs & Fleet Operations Platform

> **ReachInternational** — Enterprise platform engineered to automate daily machine running hour logs, operator shift entries, operator-to-machine assignments, machinery fleet management (add/edit/delete), user role governance, and PDF/Excel report exports.

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Active Core Modules](#-active-core-modules)
- [Monorepo Architecture](#-monorepo-architecture)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [User Roles & RBAC](#-user-roles--rbac)
- [Database Schema](#-database-schema)
- [Verification & Quality Gate](#-verification--quality-gate)

---

## 🚀 Project Overview

**ReachInternational** automates daily industrial machine running hour logs and operator workflow management across India. Built for Service Managers, Supervisors, Operators, and Admins, it eliminates paper logbooks, enforces non-overlapping shift validations, tracks operator machine assignments, and generates instant PDF print reports and Excel exports for monthly client billing.

### Core Problems Solved

- ❌ **Manual & Error-Prone Paper Logbooks**: Replaces paper logs with daily operator hour meter tracking, automated HMR calculation, overtime computation, and breakdown duration logging.
- ❌ **Overlapping Operator Shifts**: Enforces database-level PostgreSQL trigger validations preventing shift time overlaps.
- ❌ **Uncontrolled Fleet Catalog**: Provides centralized Machine Management (`/machines`) for adding, editing, and deleting heavy machinery units with detailed specs (Model, Serial No, YUM, HMR, Client).
- ❌ **Manual Report Preparation**: Generates 1-click A4 PDF reports (Machine Running Hours Report, Site Machine Report, Operator Daily Report) and formatted Excel spreadsheet exports.

---

## ✨ Active Core Modules

### 1. 🚜 Machine Management (`/machines`)
- **Fleet Directory & Specifications**: Track machinery fleet details including Model Name, Serial Number, Manufacturer, Year of Manufacture (YUM), Current HMR (Hour Meter Reading), Assigned Supervisor, Assigned Operator, and Client details.
- **Full Machine Lifecycle**: Add new machines, edit machine parameters, and delete machines with admin authorization.
- **Search & Filters**: Multi-option filters by Model Name, Serial Number, Manufacturer, and Client Name.

### 2. 👥 User & Employee Management (`/users`)
- **System Accounts Directory**: Unified management of system users and staff accounts with active status tracking.
- **Mandatory Profile Fields**: Strictly enforces Full Name, Email Address, 10-digit Mobile Phone Number, System Role, and Complete Address (City, District, State) across all user profiles and self-registration.
- **Role Assignment**: Assign system roles (`super_admin`, `admin`, `service_manager`, `supervisor`, `operator`, etc.).
- **Account Actions**: Create new user accounts, edit employee profiles, and delete user accounts with full audit logging.

### 3. ⏱️ Operations Hub (`/operations`)
- **Running Hours Logs (`tab=logs`)**:
  - **3 View Modes**: Machine View (group by equipment), Client View (group by client site), and Operator View (group by operator).
  - **A4 PDF Reports**: 1-click printable PDF report exports featuring official top-left company branding, centered titles (`MACHINE RUNNING HOURS REPORT`), and client location sub-headers (`CLIENT: SAINT GOBAIN | LOCATION: JHAJJAR, HARYANA`).
  - **Excel Exports**: Export formatted Excel spreadsheets capturing daily logs, HMR totals, operating hours, overtime, and breakdown durations.
- **Operator Machine Assignments (`tab=assignments`)**:
  - Reassign operators to machinery units and inspect historical operator assignment logs.

### 4. 📝 Operator Daily Machine Logs & Log History (`/operations` for operators)
- **Daily Machine Log Entry (`tab=entry`)**:
  - **Section A (Machine & Client Info)**: Auto-populates Machine Model, Serial Number, Client Name, and Client Site Location.
  - **Section B (Time, Meter Readings & Normal Working Time)**: Interactive `CustomTimePicker` for Start/End times, quick shift action pills (`06:00 AM`, `08:00 AM`, `02:00 PM`, `08:00 PM`), automatic 1-hour break deduction, live shift duration breakdown, Overtime computation, Normal Working Time calculation ($\text{Duration} - \text{OT} - 1.0\text{h}$), starting/ending HMR, breakdown duration toggle, and remarks.
- **Log History (`tab=history`)**:
  - Operators inspect past submitted daily machine logs with real-time shift timings alongside normal working time (excl. OT), overtime badges, and breakdown duration indicators.

### 5. 🏢 Client Directory & Address Policy (`/clients`)
- **Mandatory Client Address Policy**: Every client record strictly requires complete address parameters (Office/Site Street Address, City, and State) across PostgreSQL constraints, Zod schemas, web dialogs, and mobile apps.
- **Client Lifecycle Management**: Add new clients, update client parameters, inspect machine fleet counts, and manage contact persons.

### 6. 🔑 Login & Access Control (`/login`, `/signup`, `/forgot-password`)
- Secure authentication flow backed by Supabase SSR Auth and Next.js 16 Edge proxy security middleware with mandatory City, District, State registration fields.

---

## 🏗 Monorepo Architecture

ReachInternational is structured as a pnpm workspace managed by Turborepo (`turbo.json`).

```
ReachInternational-Monorepo/
├── apps/
│   ├── web/                          # Next.js 16 App Router Web Application (@reachinternational/web)
│   │   ├── app/                      # App Router routes (/machines, /operations, /users, /login, /signup)
│   │   ├── components/               # Geist system UI components, forms & print modals
│   │   └── lib/                      # Data Access Layer (DAL), query helpers & server actions
│   └── mobile/                       # Expo / React Native Mobile Application (@reachinternational/mobile)
│       ├── app/                      # Expo Router screens ((auth)/login, (auth)/signup, (app)/machines, (app)/operations, (app)/users, (app)/profile)
│       ├── components/               # Native design system primitives, action sheets & modal dialogs
│       └── lib/                      # Supabase client, secure storage adapter, auth hooks & nav registry
├── packages/                         # Canonical Shared Monorepo Packages
│   ├── types/                        # @reachinternational/types — TypeScript interfaces & database types
│   ├── validation/                   # @reachinternational/validation — Zod validation schemas
│   ├── permissions/                  # @reachinternational/permissions — RBAC matrix & scoping rules
│   ├── design-tokens/                # @reachinternational/design-tokens — Geist visual tokens & adapters
│   ├── api-client/                   # @reachinternational/api-client — Shared API client contracts
│   ├── config/                       # @reachinternational/config — Shared TypeScript/ESLint configs
│   └── utils/                        # @reachinternational/utils — Platform-neutral date, INR currency & string helpers
├── supabase/migrations/              # Idempotent PostgreSQL schema migration scripts
├── pnpm-workspace.yaml               # pnpm workspace declaration
└── turbo.json                        # Turborepo task pipeline orchestration
```

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 16.2 (App Router) | React Server Components, Server Actions, Edge Proxy |
| **Mobile** | Expo React Native | iOS & Android Cross-Platform Mobile Application |
| **Language** | TypeScript 5 (Strict Mode) | End-to-end type safety across web, mobile, and packages |
| **Database** | Supabase PostgreSQL | Relational database with Row Level Security (RLS) & Triggers |
| **Auth** | Supabase Auth (SSR) | Server-side cookie sessions & JWT authentication |
| **Styling** | Tailwind CSS v4 | Utility-first styling with Geist design system tokens |
| **Animations** | Framer Motion 12 | Fluid UI transitions, modals, and drawers |
| **PDF & Export**| HTML5 Print Engine / XLSX | Single-page A4 PDF documents & formatted Excel exports |

---

## 🚦 Getting Started

### Prerequisites

- **Node.js**: 20+ (LTS)
- **pnpm**: `pnpm@11.21.0` (Required monorepo package manager)
- **Supabase**: Account & PostgreSQL database project

### Installation & Run

1. **Clone repository**:
   ```bash
   git clone https://github.com/vaibhavchauhan-15/reachinternation.com.git
   cd reachinternation.com
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Configure Environment Variables**:
   Copy `.env.example` to `.env` in the project root:
   ```env
   # Public / Publishable Keys (Safe for Web Browser & Mobile App)
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_your_key_here

   # Server-Only Secrets (STRICTLY RESTRICTED TO SERVER RUNTIMES — NEVER EXPOSE TO FRONTEND/MOBILE)
   SUPABASE_SECRET_KEY=your_service_role_key_here
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Run Development Server**:
   ```bash
   pnpm dev
   ```
   Open `http://localhost:3000` in your browser.

---

## 🔐 User Roles & RBAC

| Role | Operational Scope | Access Rights |
|------|-------------------|---------------|
| `super_admin` | Global System | Full control over machines, operations, user accounts, and system configuration. |
| `admin` | Global Operations | Add/edit/delete machines, manage users, review all running hour logs, reassign operators. |
| `service_manager` | Fleet Operations | Oversee machine directory, review running hour logs, export PDF/Excel reports. |
| `supervisor` | Site Operations | Monitor daily running hour logs, track operator machine assignments, record logs. |
| `operator` | Field Operations | Submit daily machine running hour logs (`/operations?tab=entry`) and view log history (`/operations?tab=history`). |

---

## 🗄 Database Schema

The core database is built on 6 central tables in Supabase PostgreSQL:

1. `public.users`: System user accounts (email, phone, role, city, district, state, status).
2. `public.machines`: Machine fleet master (machine_code, model, serial_number, manufacturer, year_of_manufacture, hour_meter, customer_name, status).
3. `public.machine_hour_logs`: Daily running hour logs (machine_id, client_id, operator_id, supervisor_id, log_date, start_time, end_time, start_meter, end_meter, running_hours, normal_working_hours, overtime_hours, is_breakdown, location, remarks, idempotency_key).
4. `public.clients`: Registered clients & customer sites (client_code, client_name, contact_person, phone, email, address, city, state).
5. `public.idempotency_keys`: Replay attack protection & state mutation deduplication key ledger (idempotency_key, user_id, action_name, request_hash, status, response_payload, created_at, expires_at).
6. `public.audit_logs`: Immutable, append-only security & compliance audit trail (id, user_id, action, entity_type, entity_id, metadata, ip_address, created_at).

---

## 🛡️ Enterprise Security & Defense-in-Depth Architecture

ReachInternational enforces a multi-layered security architecture conforming to **OWASP ASVS 5.0** and **OWASP Top 10** baselines:

1. **Self-Registration Privilege Escalation Guard (`handle_new_user()` trigger & `016_enterprise_security_hardening.sql`)**: PostgreSQL trigger ignores untrusted client metadata, forcing all self-signups to `role = 'operator'` and `status = 'pending'`, requiring explicit administrator dashboard approval before activation.
2. **Tamper-Proof Append-Only Audit Logging (`public.audit_logs`)**: Security events, state mutations, and replay attack blocks are recorded in an append-only PostgreSQL table protected by RLS (no UPDATE or DELETE policies exist).
3. **Restricted Machine Mutation RLS (`machines_update_authorized`)**: Operators cannot update machine master records directly via PostgREST; all running hour logs are submitted through audited Server Actions.
4. **Server-Side Template Injection (SSTI) Defense (`packages/utils/src/ssti.ts`)**: Single-pass, non-evaluating template substitution (`renderSafeTemplate`) with zero dynamic code execution (`eval()`, `new Function()`) and non-recursive replacement.
5. **Context-Aware HTML Entity Escaping (`apps/web/lib/email.ts` & `email-templates.tsx`)**: All dynamic fields in server HTML email and notification templates pass through `escapeHtml()` to neutralize script and tag injection vectors.
6. **Spoof-Proof Edge Rate Limiting (`apps/web/proxy.ts` & `lib/security/rate-limiter.ts`)**: Sliding-window rate limiter inspecting canonical platform headers (`cf-connecting-ip`, `x-real-ip`, `true-client-ip`) and extracting rightmost proxy IPs to prevent header-rotation rate limit bypasses.
7. **Payload & Timeout Bounds (`apps/web/next.config.ts` & `lib/security/timeout.ts`)**: Enforces 1MB Server Action payload limit, 10MB file upload limits on bulk spreadsheets with MIME/extension validation, and 10-second `AbortController` request execution timeout guard (`withExecutionTimeout`).
8. **OWASP ReDoS Hardening (`packages/validation`)**: Enforces `User Input ↓ Max Length Check ↓ Simple Validation ↓ Safe Linear Regex ↓ Business Validation`. String length bounds (`.max(...)`) are applied on ALL Zod schema fields (`email: max 255`, `password: max 128`, `full_name: max 100`, etc.) before executing non-backtracking linear regexes.
9. **PostgreSQL Statement Timeouts (`014_set_statement_timeouts_and_dos_guards.sql`)**: Configures `statement_timeout = '10000ms'` (10s), `lock_timeout = '5000ms'`, and `idle_in_transaction_session_timeout = '10000ms'` on PostgreSQL to prevent database connection pool starvation.
10. **Mobile Client Security & Role Synchronization (`apps/mobile/lib/auth/useAuth.tsx` & `lib/security.ts`)**: Authoritatively verifies user role/status from `public.users` (eliminating insecure role fallbacks), and enforces 15-second client fetch timeouts (`fetchWithTimeout`).
11. **Server-Only Build Boundaries & Action De-exposure (`lib/notifications/send-reminders.ts`)**: System cron batch jobs are quarantined in internal server modules guarded with `import "server-only"` rather than public `"use server"` Server Action boundaries, preventing unauthorized external HTTP RPC execution.
12. **Cache Purge Authorization Guard (`apps/web/app/actions/refresh.ts`)**: All cache purging and page revalidation actions strictly enforce `await verifySession()`, neutralizing unauthenticated LPDoS cache invalidation attacks.
13. **DOM XSS Sanitization (`packages/utils/src/sanitize.ts` & `NotificationPreviewModal.tsx`)**: Raw HTML email previews pass through `sanitizeHtml()` before DOM injection, stripping script tags, iframe embeds, event handlers (`onerror`, `onload`), and pseudo-protocols (`javascript:`).
14. **Hardware-Backed Mobile Session Persistence (`apps/mobile/lib/supabase.ts`)**: Mobile auth storage utilizes `expo-secure-store` on native iOS (Keychain) and Android (Keystore) for hardware-encrypted token persistence across app lifecycles.
15. **Strict Content-Security-Policy (`apps/web/next.config.ts`)**: Production CSP enforces `upgrade-insecure-requests`, `form-action 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, and `base-uri 'self'`.

---

## 🧪 Verification & Quality Gate

Run full typecheck across all 9 monorepo workspace packages:

```bash
pnpm typecheck
```
Guarantees 0 TypeScript errors across `apps/web`, `apps/mobile`, and `packages/*`.