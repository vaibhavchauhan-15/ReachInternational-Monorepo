# ReachInternational

**Industrial machine running-log and fleet-operations platform** for aerial work platforms,
material-handling equipment, and site machinery rental.

ReachInternational replaces paper logbooks with shift-based hour-meter logging, date-scoped
operator-to-machine rosters, client shift schedules, automated payroll/attendance, document-gated
onboarding, approvals, hiring, quote handling, and a public equipment-marketing site — all backed
by Supabase Postgres with row-level security.

| Item | Value |
| :--- | :--- |
| **Web app** | `apps/web` — Next.js `16.2.12` (App Router), React `19.2.4`, TypeScript 5 |
| **Native app** | `apps/mobile` — Expo SDK 58 (`expo ~58.0.22`), React Native `0.88.1`, React `19.3.0` |
| **Shared packages** | `packages/design-tokens`, `permissions`, `types`, `utils`, `validation` |
| **Database & auth** | Supabase Postgres, Auth, Storage, Realtime, `pg_cron`, `pg_net`, RLS |
| **Repo tooling** | pnpm `11.21.0` workspaces + Turborepo `2.11.7`, Node 22 LTS |
| **Mobile release** | App version `1.5.0`, runtime version `1.5.0`, EAS `appVersionSource: remote` |
| **Dev database** | `vlmxciuogczumumrwyot` — *Reach International Dev* |
| **Production database** | `dhbbgfzbyatzvqafnsqp` — *Reach International Production* |

> **Documentation status:** verified against source code, migrations, and config on **2026-11-23**.
> This README describes the *current* system. History lives in [`AI/CHANGELOG_AI.md`](AI/CHANGELOG_AI.md);
> architecture and visual rules are authoritative in [`ARCHITECTURE.md`](ARCHITECTURE.md) and
> [`DESIGN.md`](DESIGN.md).

---

## Contents

1. [What the platform does](#1-what-the-platform-does)
2. [Roles and access](#2-roles-and-access)
3. [Feature map (Web & Native)](#3-feature-map-web--native)
   - [3.1 Web route inventory](#31-web-route-inventory)
   - [3.2 Native screen inventory](#32-native-screen-inventory)
   - [3.3 Dashboard](#33-dashboard)
   - [3.4 Operations](#34-operations)
   - [3.5 Running Logs](#35-running-logs)
   - [3.6 Machines](#36-machines)
   - [3.7 Clients](#37-clients)
   - [3.8 Users, documents, profile](#38-users-documents-profile)
   - [3.9 Approvals](#39-approvals)
   - [3.10 Payroll](#310-payroll)
   - [3.11 Attendance](#311-attendance)
   - [3.12 Hiring and careers](#312-hiring-and-careers)
   - [3.13 RFQ and quotations](#313-rfq-and-quotations)
   - [3.14 Marketing site and equipment catalogue](#314-marketing-site-and-equipment-catalogue)
   - [3.15 Notifications](#315-notifications)
   - [3.16 Audit, settings, account deletion](#316-audit-settings-account-deletion)
4. [Authoritative business rules](#4-authoritative-business-rules)
   - [4.1 Shift logs are immutable](#41-shift-logs-are-immutable)
   - [4.2 Date-scoped assignments](#42-date-scoped-assignments)
   - [4.3 Operator 7-day logging window](#43-operator-7-day-logging-window)
   - [4.4 Shift limits and overlap prevention](#44-shift-limits-and-overlap-prevention)
   - [4.5 Machine and serial-number rules](#45-machine-and-serial-number-rules)
   - [4.6 Approval and profile-change routing](#46-approval-and-profile-change-routing)
   - [4.7 Notification rules](#47-notification-rules)
5. [Architecture](#5-architecture)
   - [5.1 Repository layout](#51-repository-layout)
   - [5.2 Dependency direction and shared packages](#52-dependency-direction-and-shared-packages)
   - [5.3 Web architecture](#53-web-architecture)
   - [5.4 Native architecture](#54-native-architecture)
   - [5.5 Web-to-mobile parity contract](#55-web-to-mobile-parity-contract)
6. [Tech stack](#6-tech-stack)
7. [Data and environments](#7-data-and-environments)
   - [7.1 Environments and access policy](#71-environments-and-access-policy)
   - [7.2 Migrations](#72-migrations)
   - [7.3 Core tables](#73-core-tables)
   - [7.4 Row-level security](#74-row-level-security)
   - [7.5 Seed data and development accounts](#75-seed-data-and-development-accounts)
8. [Security](#8-security)
9. [Design system](#9-design-system)
10. [Getting started](#10-getting-started)
    - [Prerequisites](#prerequisites)
    - [Install](#install)
    - [Environment](#environment)
    - [Run](#run)
    - [Database](#database)
11. [Commands](#11-commands)
12. [Testing and quality gates](#12-testing-and-quality-gates)
13. [Deployment](#13-deployment)
    - [Web — three supported targets](#web--three-supported-targets)
    - [Native — EAS](#native--eas)
14. [Documentation map](#14-documentation-map)
15. [Conventions for contributors and AI agents](#15-conventions-for-contributors-and-ai-agents)
16. [Troubleshooting](#16-troubleshooting)

---

## 1. What the platform does

- **Shift-based machine logging** — operators submit start/end hour-meter readings, running hours,
  breakdown and overtime minutes per shift. Logs feed attendance, payroll, and client reports.
- **Date-aware rosters** — operators are assigned to machines and shifts through effective-dated
  ranges, not daily rows. Past days stay immutable; today carries forward; tomorrow can be planned.
- **Fleet management** — machine specs, health (`active`, `spare`, `under_maintenance`, `breakdown`),
  rental status, client assignment, supervisors, operators, and a full audit trail.
- **Client operations** — client directory, sites, supervisors, and client-defined shift codes and
  timings that drive rosters, log forms, and overtime calculation.
- **People operations** — registration, admin approval, KYC document vault, profile edits,
  attendance, payroll, and hiring pipelines.
- **Business operations** — unified approvals, RFQ/quotations for sales, equipment catalogue admin,
  and the public marketing site.
- **One system, two clients** — the web app and native app share types, validation, permissions,
  design tokens, and database contracts. Native adds offline queuing, SecureStore, haptics, and
  touch ergonomics without visual or behavioral drift.

---

## 2. Roles and access

Eight roles are registered in `@reachinternational/permissions`. Six are canonical operational
roles; `sales` and `marketing` are extended business roles.

| Role | Purpose | Main areas |
| :--- | :--- | :--- |
| `super_admin` | Full platform control; bypasses role checks | All modules, approvals, audit, settings |
| `admin` | Organization-wide administration | Dashboard, operations, running logs, machines, clients, users, approvals, audit, payroll, attendance, hiring, RFQ, catalogue |
| `manager` | Fleet and operations management | Dashboard, operations, running logs, machines, clients, users, audit, attendance, hiring, catalogue |
| `supervisor` | Site-level supervision | Dashboard, operations, running logs, machines, clients, users (read-only), attendance |
| `hr` | People operations | Dashboard, operations, running logs, users, payroll, attendance, hiring |
| `operator` | Shift execution | Dashboard, shift entry/history, assigned-machine view, own attendance |
| `sales` | Quote-request pipeline | Dashboard, `/admin/sales/rfq`, clients navigation |
| `marketing` | Catalogue/content role | Registered in the role registry; current route guards reach dashboard, profile, settings |

Access is enforced at three layers, and **the stricter layer wins**:

1. **Route guards** — `requireRole()` / `requirePermission()` in `apps/web/lib/dal.ts`
   (`super_admin` always passes).
2. **Server Actions / API** — mutations re-check the session user (and record ownership where the
   record is user- or client-scoped).
3. **PostgreSQL RLS** — the final authority; UI gating is never treated as security.

Shared permission matrix: [`packages/permissions/src/matrix.ts`](packages/permissions/src/matrix.ts).
Route/navigation rules: [`packages/permissions/src/navigation.ts`](packages/permissions/src/navigation.ts).

---

## 3. Feature map (Web & Native)

### 3.1 Web route inventory

Primary routes (authenticated):

| Route | Purpose | Guard (verified) |
| :--- | :--- | :--- |
| `/dashboard` | Role-specific home and KPIs | Any active user |
| `/operations` | Shift monitor (staff) or shift entry/history (operator) | Any active user |
| `/running-logs` | Daily running-log directory: machine / client / operator views | `super_admin`, `admin`, `manager`, `supervisor`, `hr` |
| `/machines`, `/machines/[id]` | Fleet directory and detail (`/[id]/edit` redirects to detail; editing is in-page) | Any active user (operator sees assigned machine only) |
| `/clients`, `/clients/[id]` | Client directory, sites, supervisors, shift codes | `super_admin`, `admin`, `manager`, `supervisor` |
| `/users`, `/users/[id]` | Employee directory and full profile | `super_admin`, `admin`, `manager`, `hr`, `supervisor` (read-only for supervisor) |
| `/approvals` | Unified approval queue | `super_admin`, `admin` |
| `/audit`, `/audit/[id]` | Audit trail and event detail | `super_admin`, `admin`, `manager` |
| `/payroll` | Monthly operator payroll | `super_admin`, `admin`, `hr` |
| `/attendance`, `/attendance/[userId]` | Monthly attendance (self view for operators) | Management roles + operator self |
| `/hiring`, `/hiring/jobs`, `/hiring/jobs/new`, `/hiring/jobs/[id]`, `/hiring/jobs/[id]/edit`, `/hiring/applications` | Jobs and applications pipeline | `super_admin`, `admin`, `hr`, `manager` |
| `/admin/sales/rfq`, `/admin/sales/rfq/new`, `/admin/sales/rfq/[id]`, `/admin/sales/rfq/clients`, `/admin/sales/rfq/settings` | RFQ pipeline, quotations, sales settings | `super_admin`, `admin`, `sales` |
| `/marketing/equipment`, `/marketing/equipment/new`, `/marketing/equipment/[id]`, `/marketing/equipment/enquiries`, `/marketing/equipment/settings` | Marketing catalogue admin | `super_admin`, `admin`, `manager` |
| `/profile`, `/profile/edit`, `/profile/documents` | Self-service profile and document vault | Any active user |
| `/settings`, `/settings/account`, `/settings/notification`, `/settings/preference`, `/settings/aboutapp` | Account, security, notifications, preferences | Any active user |

**Public and auth:**

| Route | Purpose |
| :--- | :--- |
| `/` | Marketing home (AWP/material-handling rental and sales) |
| `/about`, `/contact`, `/equipment`, `/equipment/[...slug]`, `/request-a-quote`, `/request-a-quote/thank-you` | Public catalogue and enquiry funnel |
| `/careers`, `/careers/[slug]`, `/careers/[slug]/apply`, `/careers/apply/success`, `/careers/preview/[token]` | Public careers, applications, and draft preview |
| `/login`, `/signup`, `/onboarding`, `/forgot-password`, `/reset-password` | Authentication (`/signin` redirects to `/login`) |
| `/privacy`, `/terms`, `/delete-account`, `/account-deletion`, `/account-deletion-guide`, `/account-deletion/guide` | Legal and account-erasure portals |

Aliases: `/dashboard/logs` → `/operations`, `/rfq` → `/admin/sales/rfq`, `/hiring` → `/hiring/jobs`,
`/marketing` → `/marketing/equipment`, `/signin` → `/login`.

### 3.2 Native screen inventory

Native screens live in `apps/mobile/app` with Expo Router. The default shell mode is `native`
(`EXPO_PUBLIC_SHELL_MODE=native`); `app/index.tsx` is the splash/auth gateway. The WebView shell
(`apps/mobile/shell/AppWebView.tsx`) is an alternative mode, not the default.

| Area | Screens |
| :--- | :--- |
| Auth | `(auth)/login`, `signup`, `onboarding`, `forgot-password` |
| Home | `(app)/dashboard` |
| Operations | `(app)/operations` — tabs `Shift`, `History`, `Today` (native screen) |
| Running logs | `(app)/running-logs` |
| Machines | `(app)/machines` |
| Clients | `(app)/clients`, `(app)/clients/[id]` |
| People | `(app)/users`, `(app)/users/[id]`, `(app)/approvals`, `(app)/payroll`, `(app)/attendance` (`(app)/hr` redirects to payroll) |
| Audit | `(app)/audit` |
| Profile | `(app)/profile`, `profile/edit`, `profile/documents` |
| Settings | `(app)/settings`, `account/*`, `notifications`, `preferences/*`, `about/*` |
| Legal | `(app)/account-deletion`, `account-deletion/guide`, `privacy`, `terms` |

### 3.3 Dashboard

- Each role receives a dedicated read model (fleet counts, utilization, pending shifts, overtime and
  breakdown alerts, HR pending approvals, operator next-shift card) from PostgreSQL read-model RPCs.
- Server-rendered KPI primitives with client-side animated counters; skeletons and error states are
  shared between web and native.
- Mobile uses the same RPCs with pull-to-refresh, haptics, and a 2-column KPI grid.

### 3.4 Operations

**Staff view — shift monitor (`/operations`)**

- Lists the day's roster: machine, client/site, shift code and timing, operator, assignment source,
  and log status (`pending`, `entered`, `unassigned`, `superseded`).
- Date navigation across the editable window; assign/replace/relieve personnel through the shared
  assignment modal (by equipment or by operator).
- Search, client/shift filters, and timing sort are computed in memory over the loaded day roster.
- Realtime + optimistic updates patch only affected rows after an assignment mutation.
- Assisted entry lets supervisors and above file a log on behalf of an assigned operator.

**Operator view — shift entry and history**

- `Shift` tab renders the operator's assignment context for the selected day: machine, client,
  worksite, shift timing, last meter reading, and pending/entered state.
- `History` tab shows the operator's logs with a session cache and server pagination.
- Offline submissions are queued on mobile and reconciled when connectivity returns.

### 3.5 Running Logs

- `/running-logs` is the read-oriented daily running-log directory with three views:
  **Machine**, **Client**, and **Operator**.
- Page-bounded server pagination, server sorting (date, hours, meter), month/site/shift filters,
  breakdown-only filter, and trigram search.
- Logs are grouped by day with a day summary (meter span, total hours, shifts logged).
- Every log is immutable once recorded; corrections are new entries, not edits (see §4.1).

### 3.6 Machines

- **Directory** — searchable fleet table/cards with KPI aggregates, health and rental badges,
  supervisor/operator chips, multi-format exports (Excel, CSV, PDF/print), and bulk selection.
- **Detail** (`/machines/[id]`) — hero identity, 24-hour shift coverage, client block, HMR history,
  audit trail, and contextual actions.
- **Assignments** — one operator may hold up to three non-overlapping shifts (including all three
  shifts on one machine); supervisors are assigned many-to-many; client shift codes drive the labels
  and times.
- **Lifecycle** — create, edit, and delete are manager-tier; supervisors can update operational
  status, rental status, client, and operators. Master specs remain manager-tier.
- **Operator scope** — operators see only their assigned machine's operating details and CTAs to
  shift entry/history.
- **RBAC single source of truth** — every Machines capability is declared once in
  `@reachinternational/permissions` (`packages/permissions/src/machines.ts`: `MACHINE_CAPABILITIES`,
  `MACHINE_ROLE_CAPABILITIES`, `hasMachineCapability`, `getMachineScope`). Web, native, DB policy
  comments and tests read from it; HR has no machine access at all, operators only the assigned view,
  and supervisors are scoped to supervised work sites.
- **DB parity** — migrations 231/233 make RLS, the operational-update trigger and the KPI RPC enforce
  the same matrix (HR gets zero rows and `42501`; out-of-scope updates affect zero rows; the supervisor
  predicate is set-based rather than per-row).
- Serial numbers are unique (case-insensitive) across database, actions, imports, and both UIs.

### 3.7 Clients

- Client directory with company identity, GSTIN/PAN, contacts, addresses, and operational status.
- **Sites** (`client_sites`) and **client supervisors** (`client_supervisors`) support multi-site
  operations and inherited supervisor visibility.
- **Shift codes** (`client_shift_codes`) define the client's shift names, codes, timings, and night
  flags. Updating a client shift cascades timing changes to active assignments.
- Soft delete preserves historical logs and audit records.

### 3.8 Users, documents, profile

- **Directory** — role/status/state/KYC filters, URL-persisted filter state, supervisor column,
  multi-select exports, bulk actions with self-delete guards.
- **Profile** (`/users/[id]`) — identity hero, contact/employment/location details, assignment,
  logs, attendance, document vault, and audit trail.
- **Employee IDs** — permanent `EMP-xxxx` sequence assigned by trigger, searchable and exportable.
- **Documents** — private `user_files` bucket, typed document catalogue, server-authorized 120-second
  signed URLs, audit-logged views, image/PDF in-app viewer, replacement flow.
- **Profile edits** — validated with Zod and routed through approval rules (§4.6).
- **Signup** — role-aware registration with shift timings, address/state, bank details, mandatory
  document uploads, MIME whitelisting, and role-tampering/DoS protections.

### 3.9 Approvals

- Unified approval engine (`approval_requests`, `approval_events`, `approval_decisions`,
  `approval_outbox`, `approval_types`) with configurable approver roles, dual-control votes, and atomic transactions.
- Seeded types: `registration`, `document_verify`, `document_replace`, `profile_change`,
  `account_deletion`, `shift_conflict`.
- **Database-Level Grouping & Atomic Decisions**: User registrations and all attached document verifications form a single approval item linked via `parent_id`, grouped and decided atomically at the database layer (Migration 235).
- **Keyset-Cursor Pagination & Infinite Scroll**: Queue powered by `public.approval_list` returning `{ items, next_cursor, has_more, pending_total }` using `(created_at, id)` keyset pagination (page size 20, zero `OFFSET`).
- **Server-Enforced RBAC (Migrations 236-238)**: every `approval_*` RPC denies by default — unresolvable/NULL roles are refused, `p_actor_id` can only be supplied by a service-role session, self-approval is blocked, dual-control and version checks run under a row lock, and `anon`/`PUBLIC` hold `EXECUTE` on none of the functions. Negative coverage lives in `supabase/tests/test_approvals_rbac_negatives.mjs` (22 assertions: anon, operator, supervisor, wrong-role, self-approval, double-decision race, forged ids, forged actor id, group atomicity, queue/count parity).
- **Reviewer Experience**: Infinite scroll with `IntersectionObserver` look-ahead buffering, optimistic removal with bottom buffer append, debounced grouped counts, and realtime non-shifting `"N new"` notifications.
- `/approvals` route guard dynamically derived from approver pools in `@reachinternational/permissions`.
- Every decision writes an approval event and an audit record attributed to the real acting administrator; outbox entries dispatch notifications asynchronously off the request path.

### 3.10 Payroll

- Monthly operator payroll derived from logged shifts, worked hours, overtime, and configured rates.
- Manager-tier-and-above review; `super_admin`, `admin`, and `hr` can access the module.
- Payroll statement updates emit zero-PII notifications.

### 3.11 Attendance

- Monthly attendance derived from machine hour logs (present/absent/half-day style statuses), with
  per-employee drill-down at `/attendance/[userId]`.
- Operators see their own attendance; management roles see the full roster.

### 3.12 Hiring and careers

- Public careers site: job listing, job detail, application form, success page, draft preview tokens.
- Admin pipeline: job CRUD with publishing states, application list/detail, ratings, HR notes,
  status transitions, resume access controls, and consent capture.
- Applications are validated and rate-limited; resumes are stored privately with authorized access.

### 3.13 RFQ and quotations

- `/admin/sales/rfq` dashboard: incoming quote requests, commercial feasibility, quotation versions,
  counters, events, and status transitions.
- Attachment uploads, PDF download, public request-a-quote funnel, and sales-user assignment.
- Export pipeline uses explicit column projections and audit logging.

### 3.14 Marketing site and equipment catalogue

- **Public site** (`app/(marketing)`) — home, about, equipment catalogue by segment, contact,
  request-a-quote, and careers. SEO metadata, JSON-LD, sitemap, and robots rules live in
  `apps/web/lib/seo`.
- **Catalogue admin** (`/marketing/equipment`) — equipment models, media, documents, specification
  definitions/values, publishing state, enquiries, and settings (manager-tier).
- Marketing pages are public and indexable; private operational routes (for example `/dashboard` and `/running-logs`) set `noindex`.

### 3.15 Notifications

- `public.notifications` is the single source for in-app inbox notifications and the transactional push outbox.
- **In-App Inbox & Header Bell (100% Web & Native Parity)**: Real-time notification inbox and header bell with unread badge counter (capped at `"99+"`).
  - **Keyset-Cursor Pagination**: Powered by `notification_list` RPC using `(created_at, id)` keyset pagination (page size 20, zero `OFFSET`).
  - **O(Index) Unread Count**: Powered by `notification_unread_count` partial count capped at 100 (<0.08 ms execution time, zero lock contention).
  - **Hardened Security & RLS**: Recipient-only SELECT; direct UPDATE/DELETE revoked. State mutations strictly handled by SECURITY DEFINER RPCs (`notification_mark_read`, `notification_mark_all_read`).
  - **Zero-PII Payload**: Notification titles and bodies contain zero personal identifiers, salary amounts, or sensitive data.
  - **Web UI**: Header bell with accessible live aria count; Desktop popover (≥1024px) vs Tablet/Mobile bottom drawer (<1024px); infinite scroll with `IntersectionObserver`; non-shifting "N new alerts" pill.
  - **Native UI**: Header bell with min 44px touch target & haptics; `(app)/notifications` inbox screen with FlatList, pull-to-refresh, TanStack Query keyset caching, and offline-queue mutation resilience.
- **Web push** via `web-push`/VAPID and `public/sw.js`; **native push** via `expo-server-sdk`.
- Fast-path dispatch uses a database trigger + `pg_net`; a `pg_cron` sweeper reclaims abandoned
  batches and retries with backoff. Invalid device tokens are deactivated on receipt errors.
- Shift-reminder ladder: shift-end prompts, morning digest, final lock warning, and supervisor digest
  for aged pending shifts (Asia/Kolkata).
- Role-aware preferences (`user_notification_preferences`) with quiet hours and daily non-critical
  caps; native honors the OS permission state and a settings toggle.

### 3.16 Audit, settings, account deletion

- **Audit** — append-only `audit_logs` with actor, action, entity, metadata, and before/after diffs;
  category tabs, search, and detail inspection.
- **Settings** — account/security, password change, notification preferences, font size, reduced
  motion, and legal/about pages.
- **Account deletion** — self-service request from web or native, admin review, KYC scrubbing,
  status deactivation, and audit logging.

---

## 4. Authoritative business rules

### 4.1 Shift logs are immutable

**Current rule: no application role can edit or delete a completed shift log** — not operator,
supervisor, manager, admin, or super admin.

Enforced in three places:

- PostgreSQL trigger `trg_enforce_machine_hour_logs_immutable` on `public.machine_hour_logs`
  (`BEFORE UPDATE OR DELETE`) raises `23514`.
  See [`132_enforce_shift_logs_immutable_and_optimize_queries.sql`](supabase/migrations/132_enforce_shift_logs_immutable_and_optimize_queries.sql)
  and the refined function in [`165_prevent_duplicate_and_cross_machine_operator_shift_logs.sql`](supabase/migrations/165_prevent_duplicate_and_cross_machine_operator_shift_logs.sql).
- `deleteOperatorHourLogAction` and `updateOperatorHourLogAction`
  (`apps/web/app/actions/operators.ts`) return “Shift logs are strictly immutable…” for every role.
- `UPDATE`/`DELETE` RLS policies on the table were dropped in migration 132.

Only `service_role`, `postgres`, and maintenance-mode sessions may bypass the trigger, and only for
migrations, test cleanup, or the narrow `maintenance_minutes` recompute path.

> **Current rule for native (and web): shift logs are immutable for every role.** The native
> `handleDeleteLog` Super-Admin gate in `apps/mobile/app/(app)/operations.tsx` is legacy UI; its
> direct `DELETE` is rejected by the database trigger. The web edit modal passes `canDelete={false}`.
> There is **no** Manager-tier log deletion path anywhere, so do not “fix” one old claim to match
> the other — both were retired by migration 132.
>
> If the policy ever changes, change the trigger, the Server Actions, and this section together.
> Do not “harmonize” the old Super-Admin-only and Manager-tier claims — both were removed by
> migration 132.

### 4.2 Date-scoped assignments

- Table `operator_machine_assignments` uses `valid_from` / `valid_to` (`NULL` = open-ended
  carry-forward).
- An open range carries forward automatically; no daily rows are generated.
- Editing a past day truncates the covered range and re-opens a continuation, so today and tomorrow
  are never interrupted.
- The editable assignment window is **`[today_IST − 7, today_IST + 1]`** — 9 dates (7 past days,
  today, tomorrow). Out-of-window dates are rejected with `DATE_OUT_OF_WINDOW`.
- Choosing today keeps the open-ended range; choosing another date writes a single-day `[D, D]` row.
- Overlaps are blocked by the GiST exclusion constraint `oma_no_active_machine_shift_overlap`
  (`btree_gist`) and the RPC `SHIFT_OVERLAP_CONFLICT` check.
- `machine_hour_logs.assignment_id` points at the assignment range covering the log date.
- Shared IST window helpers live in `packages/utils/src/date.ts`.

### 4.3 Operator 7-day logging window

- Operators may view and submit entries for **`[today_IST − 6, today_IST]`** only.
- Pending/entered state is derived at read time by joining assignment ranges with logs — synthetic
  pending rows are never stored.
- Offline entries older than the window fail cleanly on sync without retry loops.
- Database trigger `trg_enforce_machine_hour_log_operator_date_window` enforces the window, and
  `trg_enforce_operator_assignment_exists` rejects logs for machines/shifts the operator was never
  assigned to (`42501`).

### 4.4 Shift limits and overlap prevention

- An operator may hold **at most three active shifts (24 hours)** platform-wide, enforced by
  `trg_enforce_max_shifts_per_operator` (`MAX_OPERATOR_SHIFTS_REACHED`), the atomic assignment RPCs,
  Server Actions, and both UIs.
- Shifts assigned to one operator must not overlap in time, including across different machines
  (circular 24-hour minute comparison in `packages/utils` and SQL `do_shifts_overlap`).
- Client shift-code changes cascade to active assignments so timings cannot drift.

### 4.5 Machine and serial-number rules

- Serial numbers are unique and case-insensitive (`idx_machines_serial_number_unique_ci`) and must be
  non-empty.
- Operator and supervisor assignment lists reject duplicates and use collision-free list keys.
- Deleting a machine is manager-tier and guarded by confirmation plus audit logging.
- `machines.operator_ids` mirrors today-effective assignments only; it is not the historical source
  of truth.

### 4.6 Approval and profile-change routing

| Requester | Route |
| :--- | :--- |
| `super_admin` | Direct update, no approval |
| `admin` | Approval by `super_admin` |
| `manager`, `hr` | Approval by `admin` |
| `supervisor`, `operator` | Approval by `manager` |

Supervisors have no approval rights. Approval types and their approver pools are configurable in
`approval_types` (for example document verification allows `super_admin`, `admin`, `hr`).

Account deletion is reviewed by `super_admin`/`admin`; approval scrubs KYC numbers and deactivates
the account while retaining statutory machinery telemetry.

### 4.7 Notification rules

- Critical/security notifications are always delivered; non-critical notifications respect quiet
  hours (IST) and a daily cap.
- Push dispatch is idempotent per ticket and retries with exponential backoff.
- Tokens returning `DeviceNotRegistered` are deactivated automatically.
- Native notification permission is requested through an in-app primer and can be revoked in Settings.

---

## 5. Architecture

### 5.1 Repository layout

```text
.
├── apps/
│   ├── web/                 Next.js 16.2 App Router application
│   └── mobile/              Expo SDK 58 native application
├── packages/
│   ├── design-tokens/       Colors, typography, spacing, radius, motion, breakpoints
│   ├── permissions/         Roles, permission matrix, navigation rules, route guards
│   ├── types/               Shared domain and database types
│   ├── utils/               Dates (IST), overlaps, formatting, sanitizers, errors
│   └── validation/          Canonical Zod schemas
├── supabase/
│   ├── migrations/          SQL migrations (001–230 + timestamped RFQ)
│   ├── scripts/             Migration helpers and verification
│   ├── tests/               SQL/RPC verification harnesses
│   └── seed*.mjs            Development seeding
├── security/                Monorepo security baseline
├── rules/testing/           Centralized testing standards (00–14)
├── runbooks/                Production incident runbooks
├── AI/                      Persistent project memory and feature notes
├── docs/                    Architecture, design, and deployment notes
├── scripts/                 Monorepo test runner, guards, build dispatcher
└── AGENTS.md                Binding engineering rules for contributors and AI agents
```

### 5.2 Dependency direction and shared packages

`apps/*` → domain packages → foundation packages. Apps never get imported by packages; no cycles.

| Package | Responsibility | Key exports |
| :--- | :--- | :--- |
| `@reachinternational/design-tokens` | Single visual language for web and native | `colors`, `typography`, `spacing`, `radius`, `elevation`, `motion`, `breakpoints`, RN/CSS adapters |
| `@reachinternational/permissions` | RBAC and navigation contract | `CANONICAL_ROLES`, `ROLE_PERMISSIONS`, `NAV_ITEMS`, `isManagerOrAbove`, route helpers |
| `@reachinternational/types` | Shared data models | Users, machines, operations, clients, approvals, jobs, equipment |
| `@reachinternational/utils` | Pure cross-platform logic | IST date windows, shift overlap, formatting, sanitization, error mapping |
| `@reachinternational/validation` | Zod schemas | Auth, users, machines, assignments, logs, clients, documents |

Import through package barrels (`index.ts`); deep internal imports are prohibited.

### 5.3 Web architecture

- **React Server Components by default.** `'use client'` is limited to leaf interactivity.
- **Reads go through the DAL** — `apps/web/lib/dal.ts`, `lib/data/*`, `lib/queries/*`, using
  per-request Supabase SSR clients and explicit column projections (no `SELECT *`).
- **Mutations go through Server Actions** — `apps/web/app/actions/*` with Zod validation,
  authorization, audit logging, and tag-based revalidation (`revalidateTag`).
- **Auth** — Supabase Auth via HTTP-only cookies (`@supabase/ssr`), with a server-side proxy/session
  refresh and PKCE callback.
- **Caching** — `unstable_cache` + `React.cache()` with volatility-tiered TTLs and targeted tags
  (`machines`, `operations`, `users`, `dashboard`, `audit`, …).
- **Rendering** — route-level metadata, `noindex` on private operational pages such as `/dashboard`
  and `/running-logs`, and statically optimized public marketing pages with JSON-LD and sitemap
  generation.
- **Security headers** — CSP, frame-ancestors, HSTS and related headers from `next.config.ts`.

### 5.4 Native architecture

- **Expo Router** file-based navigation with typed routes and role-aware tab/menu composition.
- **Server state** — TanStack Query with tuned `staleTime`, cache persistence, and surgical
  invalidation; no refetch storms.
- **Auth storage** — `expo-secure-store` (iOS Keychain / Android Keystore) for tokens. Never
  AsyncStorage for credentials.
- **Offline-first** — `lib/offline/*` (NetInfo connectivity, persisted mutation queue, sync
  coordinator) with an ambient offline banner.
- **Touch ergonomics** — minimum 44 px targets, bottom sheets instead of desktop popovers,
  horizontal filter strips, Reanimated transitions, haptics gated by settings.
- **Typed text** — `<Text variant="...">` from the shared type scale; raw typography in
  `StyleSheet.create` is blocked by the typography guard.

**Native foundation layer already exists — extend it, do not build a second one:**

| Concern | Canonical location |
| :--- | :--- |
| Theme | `components/ui/ThemeProvider.tsx` (pass-through) + `lib/theming/store.ts` (`useSyncExternalStore`) |
| Dynamic type scale | `lib/typography/TypeScaleProvider.tsx` |
| Motion tokens & reduced motion | `lib/motion/{tokens,springs,useMotion,navigation}.ts` |
| Press feedback | `components/ui/touch/Pressable.tsx`, `components/ui/touch/feedback.ts`, `components/ui/Touchable.tsx` |
| Haptics (rate-limited, settings-gated) | `lib/haptics/{index,native,rateLimit}.ts` |
| Compatibility re-export only | `lib/interaction/*` |

> A theme-provider/typography pass and a centralized press-feedback/haptics layer already shipped.
> A performance pass may be in progress in these same modules — extend them in place; do not create
> parallel providers or a second interaction layer.

### 5.5 Web-to-mobile parity contract

Web and native are two views of one system. When a feature changes on one platform, the same change
must land on the other in the same session, with only platform-appropriate ergonomics differing:

- **Identical** — tokens, typography, colors, terminology, hierarchy, badges, status semantics,
  empty/error/loading states, permission behavior, and business rules.
- **Platform-appropriate** — touch cards instead of dense tables at small widths, bottom sheets
  instead of drawers/popovers, native share/print, haptics, offline queue, and SecureStore.
- **3-tier viewports** — mobile ≤640 px (touch cards), tablet 641–1023 px (2-column grids),
  desktop ≥1024 px (dense tables).
- Guards: `scripts/test-parity-rules-and-skills.mjs`, `scripts/check-typography.mjs`,
  `scripts/test-touch-haptics.mjs`.

---

## 6. Tech stack

| Layer | Web (`apps/web`) | Native (`apps/mobile`) |
| :--- | :--- | :--- |
| Framework | Next.js `16.2.12` App Router, React `19.2.4` | Expo SDK 58 (`~58.0.22`), React Native `0.88.1`, React `19.3.0` |
| Language | TypeScript 5 (strict) | TypeScript 5 (strict) |
| Styling | Tailwind CSS v4, CSS variables from design tokens, Base UI, Radix primitives | NativeWind, shared tokens, `StyleSheet` aligned to the type scale |
| Motion | Framer Motion, motion, GSAP, Lenis | Reanimated 4, Gesture Handler, shared motion tokens |
| Icons | Lucide (`lucide-react`), animated icon barrels | `lucide-react-native` |
| Server state | RSC + DAL + Server Actions, `unstable_cache`, `React.cache` | TanStack Query v5 + persistence |
| Validation | Zod v4 | Zod v3 via shared schemas |
| Auth | Supabase SSR cookie sessions | Supabase JS + `expo-secure-store` |
| Charts | Recharts | Native chart/kpi primitives |
| Exports | SheetJS (`xlsx`), CSV, print/PDF services | CSV, `expo-print`, `expo-sharing` |
| Push | `web-push` + VAPID + service worker | `expo-notifications` + `expo-server-sdk` |
| Monitoring | Sentry (`@sentry/nextjs`), Vercel Analytics, GA4 | `@sentry/react-native`, GA4 bridge |
| Storage/documents | Supabase private buckets + signed URLs | `expo-document-picker`, `expo-image-manipulator`, WebView/PDF viewer |

---

## 7. Data and environments

### 7.1 Environments and access policy

| Environment | Project ref | Use |
| :--- | :--- | :--- |
| Development | `vlmxciuogczumumrwyot` | Default target for all migrations, testing, seeding, and writes |
| Production | `dhbbgfzbyatzvqafnsqp` | Live data; read-only unless explicitly authorized |

- **Migrations created or edited in `supabase/migrations/` must be pushed to Development
  immediately** (no approval needed).
- **Production writes require explicit user instruction.** Reads, schema inspection, RPC/trigger/RLS
  inspection, and log queries are always allowed.
- Never point development builds or scripts at the production project.

### 7.2 Migrations

- 234 migration files: 233 numbered files (`001`–`230`, including rollback/companion scripts)
  plus one timestamped RFQ migration (`20261101061529_rfq.sql`).
- Recent themes: date-scoped assignments (228–230), unified approvals (201), push notifications
  (193–194), client sites/supervisors (175–182), careers (180), RFQ (timestamped migration), and
  the equipment catalogue.
- Migrations must be reproducible, non-duplicated, and additive where possible. Destructive changes
  require explicit approval.
- Always reload the PostgREST schema after RPC changes (`NOTIFY pgrst, 'reload schema'`).

### 7.3 Core tables

| Domain | Tables |
| :--- | :--- |
| Identity & people | `users`, `user_supervisors`, `user_documents`, `user_document_types`, `profile_change_requests`, `account_deletion_requests` |
| Geography | `states`, `districts`, `cities`, `towns`, `villages`, `working_locations` |
| Fleet & operations | `machines`, `machine_hour_logs`, `operator_machine_assignments`, `operator_shift_ranges`, `operator_payrolls` |
| Clients | `clients`, `client_sites`, `client_supervisors`, `client_shift_codes`, `companies`, `contacts`, `business_profile` |
| Approvals | `approval_types`, `approval_requests`, `approval_events`, `approval_decisions`, `approval_outbox`, `document_change_requests` |
| Notifications | `notifications`, `push_devices`, `push_tickets`, `user_notification_preferences`, `email_outbox` |
| Audit & limits | `audit_logs`, `rate_limit_hits`, `idempotency_keys` |
| Hiring | `job_postings`, `job_applications` |
| RFQ & quotations | `quote_requests`, `quote_request_items`, `quotations`, `quotation_items`, `rfq_events`, `rfq_attachments`, `rfq_status_transitions`, `rfq_counters` |
| Marketing catalogue | `equipment_categories`, `equipment_brands`, `equipment_models`, `equipment_segments`, `equipment_media`, `equipment_documents`, `equipment_enquiries`, `equipment_spec_definitions`, `equipment_specifications` |

### 7.4 Row-level security

- RLS is enabled across application tables; policies are defined in the migrations that own each
  feature.
- Sensitive tables: identity documents (private bucket + server-signed URLs), audit logs
  (append-only, no update/delete policies), notifications (recipient-scoped), payroll (HR/admin).
- Service-role access is restricted to server-only modules (`createSupabaseAdminClient`) and never
  reaches client bundles or mobile binaries.

### 7.5 Seed data and development accounts

```bash
pnpm seed          # clean + reseed the Development database
pnpm verify:seed   # verify the seeded dataset against acceptance criteria
```

The seed provisions governance accounts, a supervisor/manager/HR/operator set, five clients with
shift codes, six machines, active assignments, and recent logs.

**Development-only credentials** (never reuse in production):

| Role | Email | Password |
| :--- | :--- | :--- |
| Super Admin | `superadmin@reachinternational.co.in` | `Password@123456` |
| Admin | `admin@reachinternational.co.in` | `Password@123456` |
| Supervisor | `supervisor@reachinternational.co.in` | `Password@123456` |
| Manager | `manager@reachinternational.co.in` | `Password@123456` |
| HR | `hr@reachinternational.co.in` | `Password@123456` |
| Operators | `deepak.patel@` / `ramesh.kumar@` / `manoj.yadav@` / `amit.verma@` / `suresh.sharma@` / `rohit.singh@reachinternational.co.in` | `Password@123456` |

---

## 8. Security

The binding baseline is [`security/SECURITY-RULES.md`](security/SECURITY-RULES.md), with
threat model, attack surface, secrets handling, data privacy, dependency policy, incident response,
and testing standards in the same directory. App-scoped rules live in
[`apps/web/security/`](apps/web/security) and [`apps/mobile/security/`](apps/mobile/security).

Non-negotiables:

- Deny by default; authenticate and authorize on the server and in RLS.
- Validate every inbound payload with `@reachinternational/validation` (Zod).
- Explicit column projections only; never `SELECT *`.
- Never expose `SUPABASE_SECRET_KEY`, service-role keys, `CRON_SECRET`, or
  `INTERNAL_AUTH_SECRET` to clients.
- Keep private storage private — short-lived signed URLs, authorization checks, audit each view.
- Log security-relevant mutations with structured, PII-redacted audit entries.
- No debug `console.log` with user data; no disabled security checks.
- Run `pnpm audit` and keep the lockfile locked (`pnpm@11.21.0`).

Operational incidents follow [`runbooks/`](runbooks) (auth/session failure, database outage,
migration drift, storage failure, secret exposure, EAS/OTA crash recovery, deployment failure).

---

## 9. Design system

[`DESIGN.md`](DESIGN.md) is the authoritative visual specification; tokens are implemented in
`@reachinternational/design-tokens` and mapped to CSS variables in `apps/web/app/globals.css`.

| Token | Light | Dark | Use |
| :--- | :--- | :--- | :--- |
| Ink | `#171717` | `#fafafa` | Headings, primary text, brand |
| Canvas | `#fafafa` | `#0a0a0a` | Page background |
| Elevated | `#ffffff` | `#171717` | Cards, sheets, inputs |
| Hairline | `#ebebeb` | `#262626` | 1 px borders and dividers |
| Primary (Reach Sky) | `#0284c7` | `#0ea5e9` | Primary actions, active states |
| Success | `#10b981` | `#34d399` | Active/present/approved |
| Warning | `#f5a623` | `#fbbf24` | Pending/due/partial |
| Error | `#ee0000` | `#f87171` | Breakdown/rejected/invalid |
| Info | `#3b82f6` | `#60a5fa` | Neutral notices, client/site badges |

Rules:

- Vercel Geist language: Geist Sans for UI, Geist Mono for codes, serials, timestamps, and eyebrows.
- Bimodal radius: 6 px app/operational chrome, 64 px category pills, 100 px marketing CTAs.
- No arbitrary hex values or raw typography — use tokens and `<Text variant>`.
- Every UI change is checked at mobile/tablet/desktop and in light and dark themes.
- Reuse `components/ui` primitives before creating new components.

---

## 10. Getting started

### Prerequisites

- Node.js **22 LTS** (`.nvmrc` / `.node-version`)
- pnpm **11.21.0** (`corepack enable && corepack prepare pnpm@11.21.0 --activate`)
- Supabase CLI (for migrations/seeding)
- Expo/EAS CLI for native builds (optional for web-only work)

### Install

```bash
pnpm install          # runs postinstall (patches OpenNext for Cloudflare)
```

### Environment

```bash
cp .env.example apps/web/.env.local
cp .env.example apps/mobile/.env.local
```

Use `.env.example` as the reference, then keep only the relevant keys in each file: `NEXT_PUBLIC_*`
and server secrets for the web, `EXPO_PUBLIC_*` for native. Never put a server secret in a mobile
environment file.

Set at minimum:

- Web: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`,
  and server-only `SUPABASE_SECRET_KEY`, `INTERNAL_AUTH_SECRET`, `CRON_SECRET`.
- Native: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_APP_URL`,
  `EXPO_PUBLIC_WEB_APP_URL`, `EXPO_PUBLIC_SHELL_MODE=native`.
- Optional: Sentry DSNs, GA4 measurement ID, VAPID keys, Twilio/SendGrid/QStash.

### Run

```bash
pnpm dev                          # Turborepo: web + native dev servers
pnpm --filter @reachinternational/web dev
pnpm --filter @reachinternational/mobile start
```

### Database

```bash
supabase link --project-ref vlmxciuogczumumrwyot
supabase db push                  # apply pending migrations to Development
pnpm seed && pnpm verify:seed
```

---

## 11. Commands

| Command | What it does |
| :--- | :--- |
| `pnpm dev` | Run workspace dev tasks (web + mobile) |
| `pnpm build` | Build dispatcher (platform-aware) |
| `pnpm build:vercel` | Turborepo build for Vercel |
| `pnpm build:netlify` | Web build for Netlify |
| `pnpm build:worker` / `build:cloudflare` | OpenNext Cloudflare Worker build |
| `pnpm dev:worker` / `preview:worker` | Wrangler local dev/preview |
| `pnpm typecheck` | TypeScript across all 7 workspace projects |
| `pnpm lint` | ESLint across the workspace |
| `pnpm check:type` | Native typography guard (no raw typography) |
| `pnpm test` | Full monorepo suite (`scripts/run-all-tests.mjs`, 33 suites) |
| `pnpm test:all` | Full suite + workspace typecheck |
| `pnpm seed` / `pnpm verify:seed` | Reseed / verify the Development database |
| `pnpm build:mobile` | EAS Android production AAB |
| `pnpm build:mobile:apk` | EAS Android production APK |
| `pnpm build:mobile:preview` | EAS preview build |
| `pnpm --filter @reachinternational/mobile test` | Native unit/workflow suite |
| `pnpm --filter @reachinternational/web analyze` | Bundle analysis |
| `pnpm agentation:mcp` | Local Agentation MCP server |

---

## 12. Testing and quality gates

Standards: [`rules/testing/README.md`](rules/testing/README.md) (00–14). Every code change runs the
right-sized level; documentation-only changes run link and documentation checks.

| Level | Scope | Commands |
| :--- | :--- | :--- |
| **1 — every change** | Types, lint, targeted tests, guards | `pnpm typecheck`, `pnpm lint`, `pnpm check:type`, targeted suite |
| **2 — feature complete** | Integration, security negatives, viewports, accessibility | `pnpm test`, security suite, 3-tier viewport audit, a11y checks |
| **3 — release** | Full monorepo and production build | `pnpm test:all`, `pnpm build`, `pnpm audit`, seed replay |

What the suite enforces today:

- Security/rules link integrity and parity skills compliance.
- Native typography (only `<Text variant>`) and 44 px touch/haptics guards.
- Permissions, validation, and utils unit suites.
- Unified approval engine (state machine, dual control, concurrency, RLS, outbox) on web and native.
- Shift entry, date-based assignments, roster/assignment standardization, running logs.
- Push notifications (SQL pipeline, dispatcher, web/native lifecycle, end-to-end).
- RFQ, careers, equipment admin, CORS, navigation feedback, dashboard/machines/clients workflows.
- Vercel cron and Netlify deployment configuration.

Rules of engagement: never claim a test passed without running it; if a check cannot run, report
**NOT RUN — reason**; fix failures at the root instead of weakening assertions.

---

## 13. Deployment

### Web — three supported targets

| Target | Config | Notes |
| :--- | :--- | :--- |
| **Vercel** | [`vercel.json`](vercel.json) | Turborepo build; 3 daily crons (`cleanup-staging`, `cleanup-superseded`, `close-expired-jobs`) |
| **Cloudflare Workers** | [`wrangler.jsonc`](wrangler.jsonc) | OpenNext build, `nodejs_compat`, assets binding, matching cron triggers |
| **Netlify** | [`netlify.toml`](netlify.toml) | Build dispatcher, publish `apps/web/.next`, scheduled functions in `netlify/functions/`; details in [`docs/deployments/NETLIFY_DEPLOYMENT.md`](docs/deployments/NETLIFY_DEPLOYMENT.md) |

All three share the same Next.js build and environment contract; no platform-specific code paths.

### Native — EAS

- Profiles: `development`, `preview`, `production` (`apps/mobile/eas.json`).
- Identity: `com.reachinternational.app`, scheme `reachinternational`, version `1.5.0`,
  runtime version `1.5.0`, `appVersionSource: remote`.
- Permissions: `INTERNET`, `ACCESS_NETWORK_STATE`, `POST_NOTIFICATIONS`, `VIBRATE`; storage and
  biometric permissions are explicitly blocked.
- EAS workflows: `apps/mobile/.eas/workflows/deploy-android.yml` (internal-track AAB) and
  `publish-update.yml` (OTA to the `production` channel).
- OTA updates only ship JS/UI changes compatible with the published runtime version.

---

## 14. Documentation map

| Path | Purpose |
| :--- | :--- |
| [`AGENTS.md`](AGENTS.md) | Binding engineering workflow and non-negotiable rules |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | System architecture and boundaries |
| [`DESIGN.md`](DESIGN.md) | Visual specification and tokens |
| [`SECURITY.md`](SECURITY.md) | Security entry point |
| [`security/`](security) | Baseline policies: rules, threats, attack surface, secrets, privacy, testing |
| [`apps/web/security/`](apps/web/security) | Web-scoped security policy |
| [`apps/mobile/security/`](apps/mobile/security) | Native-scoped security policy |
| [`supabase/AGENTS.md`](supabase/AGENTS.md) | Database, RLS, RPC, and migration rules |
| [`packages/*/AGENTS.md`](packages) | Package-specific contracts |
| [`rules/testing/`](rules/testing) | Testing policy, selection matrix, and domain standards |
| [`AI/PROJECT_MEMORY.md`](AI/PROJECT_MEMORY.md) | Persistent project memory |
| [`AI/STATE.md`](AI/STATE.md) | Current state and recent verified work |
| [`AI/FEATURES/`](AI/FEATURES) | Feature notes |
| [`runbooks/`](runbooks) | Production incident procedures |
| [`docs/`](docs) | Architecture, design system, deployment, and implementation notes |
| [`NOTIFICATIONS.md`](NOTIFICATIONS.md) | Notification architecture notes |
| [`prd.md`](prd.md) | Product requirements |

---

## 15. Conventions for contributors and AI agents

1. **Read before writing** — `AGENTS.md`, `AI/PROJECT_MEMORY.md`, `AI/STATE.md`, the module
   `AGENTS.md`, and the relevant testing/security docs.
2. **Understand, plan, implement, verify** — no blind edits; state the impact and the plan first.
3. **Reuse → extend → refactor → create** — inspect existing components, actions, DAL modules, and
   migrations before adding anything.
4. **One business rule, one authority** — database first, then backend, then UI. Never implement a
   critical rule only in the client.
5. **Web and native change together** — same session, same tokens, same behavior.
6. **Database changes are migrations** — sequential, reproducible, applied to Development
   immediately; production only on explicit instruction.
7. **Security stays intact** — no RLS bypass, no widened permissions, no secrets in client code, no
   removed validation.
8. **No dead code or debug output** — remove unused imports, commented-out branches, and console
   noise you introduce.
9. **Verify honestly** — typecheck, lint, tests, and build as applicable; report **NOT RUN** when a
   check could not execute.
10. **Update memory** — `AI/STATE.md`, `AI/CHANGELOG_AI.md`, `AI/CURRENT_TASK.md`, affected
    `AI/FEATURES/*`, and this README when modules, roles, or schema change.

---

## 16. Troubleshooting

| Symptom | Check |
| :--- | :--- |
| Web cannot reach Supabase | `.env.local` project URL/key match the intended environment; restart `next dev` after env changes |
| Native app opens the WebView shell unexpectedly | `EXPO_PUBLIC_SHELL_MODE` should be `native`; clear Metro cache and rebuild |
| Metro cannot resolve modules after branch switch | `pnpm --filter @reachinternational/mobile clean:cache` then `start:clean` |
| `function is not unique` on an RPC | Duplicate PostgREST overloads; drop the stale signature, keep one canonical function, reload schema cache |
| Log submission rejected as unassigned | Operator has no assignment range covering `log_date`; verify the date window and assignment coverage |
| Log edit/delete rejected | Expected — shift logs are immutable (§4.1) |
| DB push refuses to run | Migration drift on the linked project; inspect `supabase migration list` before forcing |
| Typecheck fails only in one workspace | Run `pnpm --filter <workspace> typecheck` to isolate; packages must build before apps |
| Auth redirect loop | Session cookie/proxy secret mismatch; see [`runbooks/AUTH_PROXY_AND_SESSION_FAILURE.md`](runbooks/AUTH_PROXY_AND_SESSION_FAILURE.md) |
| Push notifications not delivered | VAPID/Expo credentials, device token state, notification preferences, quiet hours, and cron/sweeper health |

---

**ReachInternational** — built as a single system for web and native, with the database as the final
authority on business rules.
