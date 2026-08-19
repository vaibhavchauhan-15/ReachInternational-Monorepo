# Product Requirements Document
## ServiceCentric — Machine Service Tracking & Automated Alert System
### Phase 1 — Internal Enterprise Application

| | |
|---|---|
| **Document Type** | Product Requirements Document (PRD) |
| **Version** | 1.0 |
| **Status** | Ready for Development |
| **Application Type** | Internal, single-tenant business application (NOT SaaS) |
| **Target Users** | Internal employees only (Super Admin, Admin, Service Engineer) |
| **Phase** | 1 of N |

---

## 1. Executive Summary

The business currently tracks machine service schedules for 500+ heavy machinery units manually using Excel. This creates a single point of failure: if the admin does not check the spreadsheet on a given day, service due-dates are missed, customer relationships suffer, and engineers are not dispatched.

ServiceCentric Phase 1 replaces this manual process with an internal web application that:

- Centralizes all machine and customer service records in a single database.
- Automatically identifies machines due for service **today**, **tomorrow**, or **overdue**.
- Sends automatic WhatsApp alerts to the Admin and the assigned Service Engineer with zero manual intervention.
- Gives Service Engineers a mobile-friendly way to view assigned work and close out completed services.
- Provides Super Admin/Admin dashboards, audit logs, and Excel import/export for data continuity.

Phase 1 targets the current scale (500+ machines) but the alert engine is explicitly architected to scale to **50,000+ machines** without a redesign, using a queue-based, batch-processing approach rather than a single synchronous cron job.

---

## 2. Business Objectives

| # | Objective | Success Metric |
|---|---|---|
| 1 | Eliminate missed service reminders | 0 missed "due today" alerts per month |
| 2 | Remove daily manual Excel checking | Admin spends 0 minutes/day manually cross-checking due dates |
| 3 | Give engineers automatic visibility of their workload | 100% of assigned engineers notified same-day |
| 4 | Preserve historical service data during migration | 100% of existing Excel records imported without data loss |
| 5 | Support business growth | System functions correctly at 500 machines and remains architecturally valid at 50,000 machines |
| 6 | Improve accountability | Every create/update/delete/notification action is logged and traceable to a user |

---

## 3. Project Scope

### 3.1 In Scope (Phase 1)
- Web application (desktop + mobile-responsive) for Super Admin, Admin, Service Engineer.
- Machine master data management (CRUD, search, filter, pagination).
- Excel/CSV bulk import with validation and error reporting.
- Excel export.
- Automated daily WhatsApp notifications (today due / tomorrow due / overdue) to Admin + assigned Engineer.
- Manual resend of failed notifications.
- Service completion workflow by Engineer (with optional photo upload).
- Role-based dashboards with KPIs and charts.
- Full audit logging.
- Authentication via Supabase Auth (email/password, forgot password).

### 3.2 Out of Scope (Phase 1)
- Customer-facing notifications or portal.
- Native mobile app (mobile-responsive web only).
- GPS tracking, AMC management, inventory/spare parts, billing, QR tracking, PDF service reports, AI predictive maintenance — all deferred to future phases (see Section 19).
- Multi-tenant / multi-company support (single organization only).
- Payment processing.

---

## 4. User Roles & Permissions Matrix

Three roles: **Super Admin**, **Admin**, **Service Engineer**. Access is enforced both at the UI (route guards) and API layer (middleware) and at the database layer (Supabase Row Level Security).

| Capability | Super Admin | Admin | Service Engineer |
|---|:---:|:---:|:---:|
| Login / Logout / Forgot Password | ✅ | ✅ | ✅ |
| View Dashboard | ✅ (global) | ✅ (global) | ✅ (assigned machines only) |
| Add / Edit Machine | ✅ | ✅ | ❌ |
| Delete Machine | ✅ | ✅ | ❌ |
| Bulk Excel Import | ✅ | ✅ | ❌ |
| Excel Export | ✅ | ✅ | ❌ (own assigned data only, optional) |
| Assign / Reassign Engineer | ✅ | ✅ | ❌ |
| View Service Schedule (all) | ✅ | ✅ | ❌ (own only) |
| View Assigned Machines | ✅ | ✅ | ✅ (own only) |
| Mark Service Completed | ✅ | ✅ | ✅ (own assigned only) |
| Update Service Notes / Photos | ✅ | ✅ | ✅ (own assigned only) |
| Set Next Service Due Date | ✅ | ✅ | ✅ (own assigned only, on completion) |
| View Notifications / Logs | ✅ | ✅ | ❌ |
| Resend Failed Notification | ✅ | ✅ | ❌ |
| Manage WhatsApp Settings | ✅ | ❌ | ❌ |
| Manage Admin/Engineer Users | ✅ | ❌ | ❌ |
| Role Management | ✅ | ❌ | ❌ |
| View Audit Logs | ✅ | ❌ (own actions only, optional) | ❌ |
| Backup & Restore | ✅ | ❌ | ❌ |
| System Settings | ✅ | ❌ | ❌ |

---

## 5. Functional Requirements

### FR-1 Authentication
- FR-1.1 Users log in with email + password via Supabase Auth.
- FR-1.2 Forgot password sends a reset link via email (Supabase Auth built-in).
- FR-1.3 Sessions expire after 7 days of inactivity (configurable).
- FR-1.4 Role is fetched from `users` table on login and attached to session/JWT claims.

### FR-2 Machine Management
- FR-2.1 Admin/Super Admin can create, edit, delete, search, filter, and paginate machines.
- FR-2.2 Machine ID must be unique across the system.
- FR-2.3 Next Service Due Date is either entered manually or auto-calculated as `Last Service Date + Service Interval (days)`.
- FR-2.4 Soft delete only (machines are marked `inactive`, not physically removed) to preserve service history integrity.

### FR-3 Bulk Excel Import
- FR-3.1 Admin uploads `.xlsx` or `.csv` matching a provided template.
- FR-3.2 System validates every row before committing any (see Section 11).
- FR-3.3 Valid rows are inserted/upserted (by Machine ID); invalid rows are rejected and reported.
- FR-3.4 A downloadable error report (failed rows + reasons) is generated per import batch.
- FR-3.5 Import runs as a background job for files above a row threshold (see Section 11.4) to avoid serverless timeout.

### FR-4 Service Management
- FR-4.1 Admin can reassign the engineer on any machine at any time.
- FR-4.2 Engineer can mark a service "Completed," attach notes, optionally attach photos, and set/confirm the next due date.
- FR-4.3 On completion, `Last Service Date` = today, `Next Service Due Date` recalculated, and a `service_records` row is created (append-only history).

### FR-5 Notification System (see Section 9 for full architecture)
- FR-5.1 System automatically identifies machines due **today**, **tomorrow due**, and **overdue** once per day.
- FR-5.2 WhatsApp alerts are sent automatically to the Admin and the assigned Engineer for each qualifying machine.
- FR-5.3 Failed sends are retried automatically; persistent failures are logged and surfaced for manual resend.
- FR-5.4 No duplicate alerts are sent for the same machine + alert-type + date.

### FR-6 Dashboard
- FR-6.1 Role-scoped KPI cards and charts (see Section 10).
- FR-6.2 Real-time-enough data (refreshed on page load / every 5 min via polling or Supabase Realtime).

### FR-7 Audit Logging
- FR-7.1 Every state-changing action is logged with actor, timestamp, action type, entity, and before/after (where applicable).

---

## 6. Detailed Module Specifications

### 6.1 Machine Management Module

**Fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `machine_code` | string | Yes | Unique, business-defined ID |
| `machine_name` | string | Yes | |
| `model` | string | No | |
| `customer_name` | string | Yes | |
| `customer_mobile` | string | Yes | Validated Indian mobile format |
| `customer_address` | string | No | |
| `city` | string | Yes | |
| `state` | string | Yes | |
| `engineer_id` | UUID (FK) | No | Nullable = unassigned |
| `last_service_date` | date | No | |
| `next_service_due_date` | date | Yes | Auto-calculated or manual override |
| `service_interval_days` | integer | Yes | Default org-configurable, e.g. 90 |
| `status` | enum | Yes | `active`, `inactive` |
| `notes` | text | No | |
| `created_at` / `updated_at` | timestamp | System | |

**Actions:** Add, Edit, Soft Delete, Search (by ID/Name/Customer/Engineer), Filter (status/city/engineer/due-bucket), Paginate (server-side, 25/50/100 per page), Import, Export.

### 6.2 Service Engineer Workspace
- Mobile-first list view of machines assigned to the logged-in engineer, grouped by **Overdue / Due Today / Due Tomorrow / Upcoming**.
- One-tap "Mark Completed" flow: date auto-filled, notes field, optional photo upload (stored in Supabase Storage), next due date confirmation.

### 6.3 Notification Center
- List of all notifications with status filter (`sent`, `failed`, `pending`).
- Manual "Resend" action on any failed notification (Admin/Super Admin only).
- WhatsApp template preview.

### 6.4 Admin/User Management (Super Admin only)
- Create/deactivate Admin and Engineer accounts.
- Assign role.
- Reset a user's password (triggers Supabase reset email).

---

## 7. Database Design (High-Level)

**Database:** Supabase PostgreSQL. All tables use UUID primary keys, `created_at`/`updated_at` timestamps, and Row Level Security policies scoped by role.

```sql
-- Users (mirrors Supabase auth.users, extended profile)
users (
  id uuid PK references auth.users,
  full_name text,
  phone text,
  role text CHECK (role IN ('super_admin','admin','engineer')),
  status text CHECK (status IN ('active','inactive')),
  created_at timestamptz,
  updated_at timestamptz
)

-- Machines (master data)
machines (
  id uuid PK,
  machine_code text UNIQUE NOT NULL,
  machine_name text NOT NULL,
  model text,
  customer_name text NOT NULL,
  customer_mobile text NOT NULL,
  customer_address text,
  city text,
  state text,
  engineer_id uuid REFERENCES users(id),
  last_service_date date,
  next_service_due_date date NOT NULL,
  service_interval_days int NOT NULL DEFAULT 90,
  status text CHECK (status IN ('active','inactive')) DEFAULT 'active',
  notes text,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
-- Index: (next_service_due_date), (engineer_id), (status)

-- Service history (append-only)
service_records (
  id uuid PK,
  machine_id uuid REFERENCES machines(id),
  engineer_id uuid REFERENCES users(id),
  service_date date NOT NULL,
  notes text,
  photo_urls text[],
  next_service_due_date date,
  created_at timestamptz DEFAULT now()
)

-- Notifications (one row per machine + alert_type + date)
notifications (
  id uuid PK,
  machine_id uuid REFERENCES machines(id),
  recipient_id uuid REFERENCES users(id),
  alert_type text CHECK (alert_type IN ('today','tomorrow','overdue')),
  alert_date date NOT NULL,
  channel text DEFAULT 'whatsapp',
  status text CHECK (status IN ('pending','sent','failed')) DEFAULT 'pending',
  whatsapp_message_id text,
  retry_count int DEFAULT 0,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE (machine_id, recipient_id, alert_type, alert_date)  -- idempotency guard
)

-- Import batches
import_batches (
  id uuid PK,
  uploaded_by uuid REFERENCES users(id),
  filename text,
  total_rows int,
  success_count int,
  failed_count int,
  status text CHECK (status IN ('processing','completed','failed')),
  created_at timestamptz DEFAULT now()
)

import_errors (
  id uuid PK,
  batch_id uuid REFERENCES import_batches(id),
  row_number int,
  error_message text,
  raw_data jsonb
)

-- Audit log
audit_logs (
  id uuid PK,
  user_id uuid REFERENCES users(id),
  action text NOT NULL,        -- e.g. 'machine.created'
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
)

-- Notification/system settings (Super Admin configurable)
system_settings (
  id uuid PK,
  whatsapp_phone_number_id text,
  whatsapp_access_token_ref text,   -- reference to secret, not the token itself
  daily_run_time time DEFAULT '08:00',
  default_service_interval_days int DEFAULT 90,
  updated_at timestamptz
)
```

**Key relationships:** `machines.engineer_id → users.id`, `service_records.machine_id → machines.id`, `notifications.machine_id → machines.id`. All FKs `ON DELETE RESTRICT` except audit/history which use `ON DELETE SET NULL` to preserve records.

---

## 8. API List

All routes under `/api/*`, implemented as Next.js Route Handlers. Auth enforced via Supabase session middleware; role checks per route.

**Auth**
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password`

**Machines**
- `GET /api/machines` — search, filter, paginate
- `GET /api/machines/:id`
- `POST /api/machines`
- `PATCH /api/machines/:id`
- `DELETE /api/machines/:id` (soft delete)
- `POST /api/machines/import` — starts import job, returns `batch_id`
- `GET /api/machines/import/:batchId` — poll status
- `GET /api/machines/import/:batchId/errors` — download error report
- `GET /api/machines/export` — streams Excel

**Services**
- `GET /api/services?bucket=today|tomorrow|overdue|completed`
- `POST /api/services/:machineId/complete`
- `PATCH /api/services/:machineId/reassign`

**Dashboard**
- `GET /api/dashboard/summary`
- `GET /api/dashboard/charts/monthly-services`
- `GET /api/dashboard/charts/overdue-trend`

**Notifications**
- `GET /api/notifications?status=`
- `POST /api/notifications/:id/resend`
- `GET /api/settings/notifications`
- `PATCH /api/settings/notifications`

**Users (Super Admin)**
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id`
- `DELETE /api/users/:id`

**Audit**
- `GET /api/audit-logs?filters`

**Internal / System (protected by secret header, not user session)**
- `POST /api/cron/daily-alert-orchestrator` — invoked by Vercel Cron
- `POST /api/queue/process-alert-batch` — invoked by queue webhook (QStash)
- `POST /api/queue/process-import-batch` — invoked by queue webhook for large imports

---

## 9. Notification System Architecture (Alert Engine)

This is the most critical module. It must run unattended, every day, with zero duplicate or missed alerts, and must scale from 500 to 50,000+ machines without redesign.

### 9.1 Design Principle
A single Vercel serverless function cannot synchronously loop through tens of thousands of machines and call the WhatsApp API for each — it will hit execution time limits. The architecture therefore separates **scheduling**, **fan-out**, and **execution** into distinct stages using a durable queue.

### 9.2 Components

| Component | Technology | Responsibility |
|---|---|---|
| **Scheduler** | Vercel Cron (`vercel.json`) | Triggers the orchestrator once daily at the configured time (default 08:00 IST) |
| **Orchestrator** | Next.js API route | Queries machines due today/tomorrow/overdue in pages of 500, and enqueues one queue message per batch |
| **Queue** | Upstash QStash (HTTP-native, serverless-friendly, built-in retry & rate limiting) | Durable delivery of batch jobs to the worker endpoint |
| **Worker** | Next.js API route (`/api/queue/process-alert-batch`) | Receives one batch (≤500 machines), calls WhatsApp Cloud API per recipient, writes result to `notifications` |
| **WhatsApp Cloud API** | Meta Business Cloud API | Delivers the actual message |
| **Notification Store** | `notifications` table | System of record for what was sent, to whom, and current status |

### 9.3 Flow

1. **08:00 daily** — Vercel Cron hits `/api/cron/daily-alert-orchestrator` (protected by a secret bearer token).
2. Orchestrator runs three queries (paginated by cursor, 500 rows/page):
   - `next_service_due_date = today` → `alert_type = 'today'`
   - `next_service_due_date = today + 1` → `alert_type = 'tomorrow'`
   - `next_service_due_date < today AND status = 'active'` → `alert_type = 'overdue'`
3. For each page, orchestrator publishes one QStash message containing the machine ID list + alert_type.
4. QStash delivers each message to the worker endpoint, respecting a configured concurrency/rate limit (e.g. 10 concurrent batches, matching WhatsApp API tier limits).
5. Worker, for each machine in its batch:
   - Resolves recipients (Admin(s) + assigned Engineer).
   - For each (machine, recipient) pair, attempts `INSERT ... ON CONFLICT (machine_id, recipient_id, alert_type, alert_date) DO NOTHING` into `notifications` with `status = 'pending'`. If the row already existed (conflict), **skip** — this is the idempotency/duplicate-prevention guard.
   - Calls WhatsApp Cloud API with an approved message template.
   - On success: update row to `status = 'sent'`, store `whatsapp_message_id`.
   - On failure: increment `retry_count`; if `retry_count < 3`, QStash's own retry (exponential backoff, e.g. 30s/2m/10m) re-delivers the batch; if exhausted, mark `status = 'failed'` with `error_message` stored for the Notification Center.
6. Admin sees any `failed` rows in the Notification Center and can manually resend (calls the same worker logic for a single record).

### 9.4 Non-Functional Guarantees

| Concern | Mechanism |
|---|---|
| **Idempotency** | DB unique constraint `(machine_id, recipient_id, alert_type, alert_date)` — re-running the same day never double-sends |
| **Duplicate prevention** | Same as above, enforced at the database layer, not just application logic |
| **Retry** | QStash automatic retry with backoff at the transport layer; `retry_count` tracked in DB for visibility |
| **Failure handling** | Failed rows preserved with error detail; surfaced in UI; manually resendable |
| **Rate limiting** | QStash concurrency cap tuned to stay under Meta's messaging-tier limit; worker also implements a small delay between calls within a batch |
| **Batch processing** | Fixed batch size (500) keeps each worker invocation well under Vercel's function timeout regardless of total machine count |
| **Logging** | Every attempt logged to `notifications`; orchestrator run itself logged to `audit_logs` (`action = 'alert_run.started' / 'alert_run.completed'`) |
| **Monitoring** | `GET /api/dashboard/summary` surfaces failed-notification count; recommend a daily alert-to-self (email/Slack webhook) if failed_count > threshold |

### 9.5 Scaling Path (500 → 50,000+ machines)
- At 500 machines: ~1–2 batches/day, completes in seconds.
- At 50,000 machines: ~100 batches/day, fanned out via QStash with bounded concurrency — orchestrator's job stays O(pages), not O(machines), so its own runtime doesn't grow unmanageably.
- If WhatsApp tier rate limits become the bottleneck at high volume, the only change needed is adjusting QStash concurrency/rate settings — no application redesign required.
- If Postgres-based cursor pagination becomes slow at very high row counts, add a covering index on `(next_service_due_date, status)` (already recommended in Section 7).

### 9.6 Notification Content
Each WhatsApp message (via approved Meta template) includes: Machine ID, Machine Name, Customer Name, Due Date, Assigned Engineer, Customer Contact Number, and alert type (Today/Tomorrow/Overdue).

---

## 10. Dashboard Specifications

### 10.1 KPI Cards (role-scoped)
- Total Machines
- Active Machines
- Today's Due Services
- Tomorrow's Due Services
- Overdue Services
- Completed Today
- Notification Status (Sent / Failed today)

### 10.2 Charts
- **Monthly Services Completed** — bar chart, last 12 months.
- **Overdue Trend** — line chart, overdue count over last 30 days.

### 10.3 Panels
- Today's Due / Tomorrow Due / Overdue lists (clickable → machine detail)
- Recent Activity feed (last 20 audit events)
- Quick Search bar
- Filter chips (City, Engineer, Status)

### 10.4 Role Scoping
- Super Admin / Admin: organization-wide data.
- Engineer: only machines where `engineer_id = current_user.id`.

---

## 11. Excel Import Specifications

### 11.1 Template
A downloadable `.xlsx` template with columns matching Section 6.1 fields, headers exactly matching `machine_code, machine_name, model, customer_name, customer_mobile, customer_address, city, state, engineer_email, last_service_date, service_interval_days`. `next_service_due_date` is auto-computed, not imported directly (avoids inconsistent data).

### 11.2 Validation (per row, before commit)
- `machine_code`: required, unique (checked against DB and within the file itself).
- `customer_mobile`: required, must match `^[6-9]\d{9}$` (Indian 10-digit) or `^\+91[6-9]\d{9}$`.
- `machine_name`, `customer_name`, `city`, `state`: required, non-empty.
- `last_service_date`: valid date, not in the future.
- `service_interval_days`: positive integer; default applied if blank.
- `engineer_email`: if present, must match an existing active Engineer account; if blank, machine is imported unassigned.

### 11.3 Processing
- File type restricted to `.xlsx`/`.csv`, max size 10 MB, max 10,000 rows per file (larger sets must be split).
- **All-or-nothing per row, best-effort per file**: valid rows are committed; invalid rows are rejected individually and reported — the whole file is not rejected for a few bad rows.
- An `import_batches` record tracks progress; for files > 500 rows, processing happens via the same queue infrastructure as Section 9 to avoid timeout.

### 11.4 Output
- Success summary: rows processed, inserted, updated, skipped.
- Downloadable error report (`.xlsx`): row number, field, error reason, raw row data.

---

## 12. User Flows

### 12.1 Admin — Add Single Machine
Login → Machines → "Add Machine" → fill form → validate client-side → submit → server validates uniqueness → machine created → audit log written → redirect to machine detail.

### 12.2 Admin — Bulk Import
Machines → "Import" → download template (if needed) → upload file → client-side pre-check (file type/size) → server validates all rows → success/error summary shown → error report downloadable → valid rows visible in machine list immediately.

### 12.3 Daily Automated Alert (system flow)
Vercel Cron fires → Orchestrator queries due machines → batches enqueued to QStash → Worker sends WhatsApp messages → `notifications` updated → Admin dashboard reflects Sent/Failed counts → Admin optionally resends failures.

### 12.4 Engineer — Complete a Service
Login → Dashboard (mobile) → "Due Today" list → select machine → "Mark Completed" → enter notes, optional photo, confirm next due date → submit → `service_records` row created, `machines.last_service_date`/`next_service_due_date` updated, audit logged.

### 12.5 Admin — Resend Failed Notification
Notification Center → filter "Failed" → select notification → "Resend" → worker logic invoked synchronously for that single record → status updates in place.

---

## 13. Validation Rules

| Field / Action | Rule |
|---|---|
| `machine_code` | Required, unique, alphanumeric, max 50 chars |
| `customer_mobile` | Required, Indian mobile format (10 digits, optional +91) |
| `next_service_due_date` | Must be ≥ `last_service_date` |
| `service_interval_days` | Integer, 1–3650 |
| Excel file | `.xlsx`/`.csv` only, ≤10 MB, ≤10,000 rows |
| Photo upload | `.jpg`/`.png`/`.webp` only, ≤5 MB per file, max 5 per service record |
| Password | Min 8 chars, enforced by Supabase Auth policy |
| Role assignment | Only Super Admin can set role = `super_admin` or `admin` |
| Machine deletion | Soft delete only; blocked if machine has a `pending` notification in flight |

---

## 14. Error Handling

### 14.1 API Error Format (standardized)
```json
{
  "error": {
    "code": "MACHINE_CODE_DUPLICATE",
    "message": "Machine ID already exists.",
    "field": "machine_code"
  }
}
```

### 14.2 HTTP Status Convention
- `400` — validation error (payload includes field-level detail)
- `401` — not authenticated
- `403` — authenticated but not authorized for this role
- `404` — resource not found
- `409` — conflict (duplicate machine_code, duplicate notification key)
- `422` — Excel import row-level failure (batch-level partial success)
- `500` — unexpected server error (logged to monitoring, generic message to user)

### 14.3 User-Facing Behavior
- Form-level errors shown inline next to the offending field.
- Import errors shown as a downloadable, row-referenced report — never a single generic failure message.
- WhatsApp send failures never block the UI; they are recorded and surfaced asynchronously in the Notification Center.

---

## 15. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | Dashboard initial load < 2s (p95); API responses < 500ms (p95) at 500-machine scale |
| **Scalability** | Architecture supports growth to 50,000+ machines without redesign (Section 9.5) |
| **Availability** | Target 99.5% uptime, inherited from Vercel + Supabase platform SLAs |
| **Security** | RBAC + Supabase Row Level Security on every table; see Section 16 |
| **Data Validation** | Server-side validation on every write, never trust client-side alone |
| **Error Handling** | Standardized error contract (Section 14); no silent failures |
| **Logging** | All state changes and all notification attempts logged (Sections 6.4, 9.4) |
| **Monitoring** | Failed-notification count surfaced on dashboard; recommend external alerting (e.g. Vercel/Sentry integration) for orchestrator failures |
| **Backup** | Supabase automated daily backups + Point-in-Time Recovery enabled |
| **Disaster Recovery** | Documented restore runbook; RPO ≤ 24h, RTO ≤ 4h for Phase 1 |
| **Browser/Device Support** | Latest Chrome/Safari/Edge, desktop + mobile responsive (engineer workspace mobile-first) |

---

## 16. Security Requirements

- **Authentication:** Supabase Auth (JWT-based), enforced session middleware on every route.
- **Authorization:** Role checked at (a) UI route guard, (b) API middleware, (c) Supabase Row Level Security policy — defense in depth, not UI-only.
- **Secrets:** WhatsApp Cloud API token, QStash signing key, and Supabase service role key stored only in Vercel encrypted environment variables — never in client bundle or database in plaintext.
- **Transport:** HTTPS enforced everywhere (Vercel default).
- **Input Sanitization:** All user input parameterized (Supabase client / query builder) — no raw string SQL concatenation; file uploads validated by MIME type and size before processing.
- **Webhook/Internal Route Protection:** `/api/cron/*` and `/api/queue/*` require a shared-secret bearer header, not user session — prevents public triggering.
- **Audit Trail:** Immutable `audit_logs` table, insert-only, no update/delete permitted via RLS.
- **Rate Limiting:** Login endpoint rate-limited to mitigate brute force (e.g. 5 attempts/15 min per IP).

---

## 17. Deployment Architecture

```
┌─────────────────┐      ┌────────────────────┐      ┌───────────────────┐
│   Vercel (Web)   │◄────►│  Supabase (Postgres │      │  Meta WhatsApp     │
│  Next.js 15 App  │      │  + Auth + Storage)  │      │  Business Cloud API│
└────────┬─────────┘      └────────────────────┘      └─────────▲──────────┘
         │  Vercel Cron (daily trigger)                          │
         ▼                                                       │
┌─────────────────┐      ┌────────────────────┐                  │
│  Orchestrator    │─────►│  Upstash QStash     │──────────────────┘
│  API route       │      │  (durable queue)    │
└──────────────────┘      └──────────┬─────────┘
                                      ▼
                           ┌────────────────────┐
                           │  Worker API route   │
                           │  (batch processor)  │
                           └────────────────────┘
```

- **Environments:** `staging` and `production`, separate Supabase projects, separate Vercel deployments, separate WhatsApp test/production phone numbers.
- **CI/CD:** Git push to `main` → Vercel auto-build/deploy (production); feature branches → preview deployments.
- **Config:** All environment-specific values via Vercel Environment Variables (per environment).

---

## 18. Risks & Assumptions

| Risk / Assumption | Impact | Mitigation |
|---|---|---|
| WhatsApp template approval by Meta can take days | Delays notification go-live | Submit templates for approval in parallel with development, early in the project |
| Meta messaging tier rate limits at higher volume | Alerts delayed at scale | Start on a verified business tier; monitor and request tier upgrade proactively as machine count grows |
| Existing Excel data has inconsistent phone numbers/dates | Import failures | Validation report (Section 11.4) + one-time data cleanup pass before go-live |
| Assumption: Admin and Engineers have WhatsApp installed on registered numbers | No alert received | Confirm during onboarding; capture correct numbers in `users` table |
| Assumption: single organization, single timezone (IST) | N/A for Phase 1 | Revisit if multi-region expansion occurs |
| Vercel serverless function timeout limits | Could break large batch/import jobs if not queued | Mitigated architecturally via QStash queue (Sections 9, 11.3) |
| Cost of WhatsApp conversations at 50,000-machine scale | Budget impact | Model utility-conversation pricing before scaling past Phase 1 pilot |

---

## 19. Future Roadmap (Not Detailed — Later Phases)

- Customer-facing notification/portal
- Native mobile app
- GPS tracking of machines
- AMC (Annual Maintenance Contract) management
- Inventory & spare parts tracking
- QR-code-based machine identification
- Auto-generated PDF service reports
- Billing/invoicing integration
- Advanced analytics
- AI-based predictive maintenance

---

## 20. Acceptance Criteria (Phase 1 Definition of Done)

1. **Given** a machine's `next_service_due_date` is today, **when** the daily orchestrator runs, **then** the assigned Engineer and Admin each receive exactly one WhatsApp "Due Today" alert, and a corresponding `notifications` row with `status='sent'` exists.
2. **Given** the orchestrator runs twice for the same day (e.g. manual re-trigger), **when** alerts have already been sent, **then** no duplicate WhatsApp messages are sent (unique constraint enforced).
3. **Given** a WhatsApp send fails, **when** retries are exhausted, **then** the notification is marked `failed` with an error message and appears in the Notification Center for manual resend.
4. **Given** an Admin uploads a valid Excel file, **when** import completes, **then** all valid rows appear in the machine list and an error report is available for any invalid rows.
5. **Given** an Engineer marks a service complete, **when** the form is submitted, **then** `last_service_date` updates, `next_service_due_date` recalculates, a `service_records` entry is created, and the machine drops out of the "Due Today/Overdue" bucket.
6. **Given** a user without the required role attempts a restricted action (e.g. Engineer deleting a machine), **when** the request is made, **then** it is rejected with `403` at the API layer regardless of UI state.
7. **Given** any create/update/delete/notification event occurs, **when** it completes, **then** a corresponding `audit_logs` entry exists with actor, action, and timestamp.
8. **Given** the system holds 500 active machines, **when** the daily orchestrator runs, **then** it completes and all alerts are sent within 15 minutes of the scheduled run time.

---

*End of Phase 1 PRD. Ready for development team handoff.*