# Database Map — Supabase PostgreSQL Schema

## Schema & Tables Overview

### 1. `users` (User Profiles — mirrors auth.users)
- `id` (uuid, PK, references `auth.users`)
- `full_name` (text, NOT NULL)
- `phone` (text, NOT NULL)
- `email` (text, NOT NULL, case-insensitive unique index `lower(btrim(email))`)
- `role` (text: `super_admin`, `admin`, `manager`, `supervisor`, `hr`, `operator`)
- `status` (text: `active`, `inactive`, `pending`)
- `city` (text, NOT NULL, default '')
- `district` (text, NOT NULL, default '')
- `state` (text, NOT NULL, default '')
- `state_id` (smallint, FK `states.id`)
- `street` (text, nullable — canonical address field)
- `shift_start_time` (time without time zone, nullable)
- `shift_end_time` (time without time zone, nullable)
- `supervisor_id` (uuid, nullable, FK `users.id` — primary designated supervisor)
- `monthly_salary` (numeric(10, 2), mandatory >= 0 for `role = 'operator'`)
- `daily_rate` (numeric(10, 2), default 0)
- `ot_hourly_rate` (numeric(10, 2), default 0)
- `complete_profile` (boolean, NOT NULL, default false)
- `aadhaar_number` (text, nullable, B-tree index)
- `license_number` (text, nullable, B-tree index)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### 1b. `user_supervisors` (Relational Supervisor Junction Table)
- `user_id` (uuid, FK `users.id` ON DELETE CASCADE)
- `supervisor_id` (uuid, FK `users.id` ON DELETE CASCADE)
- `created_at` (timestamptz, default now())
- PRIMARY KEY (`user_id`, `supervisor_id`)
- Indexes: `idx_user_supervisors_user_id`, `idx_user_supervisors_supervisor_id`
- RLS: Authenticated users can view their own supervisor mappings; supervisors can view their assigned operators; admins/managers have full access.

### 2. `machines` (Industrial Machine Inventory)
- `id` (uuid, PK)
- `machine_code` (text, unique, NOT NULL)
- `machine_name` (text, NOT NULL)
- `model` (text)
- `customer_name` (text, NOT NULL)
- `customer_mobile` (text, NOT NULL)
- `customer_email` (text) — Added in migration 006 for email notifications
- `customer_address` (text)
- `city` (text, NOT NULL)
- `state` (text, NOT NULL)
- `engineer_id` (uuid, FK `users.id`)
- `last_service_date` (date)
- `next_service_due_date` (date, NOT NULL)
- `service_interval_days` (int, default 90)
- `status` (text: `active`, `inactive`)
- `notes` (text)
- `created_by` (uuid, FK `users.id`)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

### 3. `service_records` (Maintenance & Service Logs)
- `id` (uuid, PK)
- `machine_id` (uuid, FK `machines.id`)
- `engineer_id` (uuid, FK `users.id`)
- `service_date` (date, NOT NULL)
- `notes` (text)
- `photo_urls` (text[])
- `next_service_due_date` (date)
- `created_at` (timestamptz)

### 4. `notifications` (Notification Logs)
- `id` (uuid, PK)
- `machine_id` (uuid, FK `machines.id`, **nullable since migration 008** — summary emails are not machine-bound)
- `recipient_id` (uuid, FK `users.id`)
- `alert_type` (text: `today`, `tomorrow`, `overdue`, `new_machine`, `machine_updated`, `machine_deleted`, `excel_import`, `system_error`, `reminder_failed`, `daily_summary`, `engineer_summary`, `weekly_report`, `monthly_report`) — `engineer_summary` added in migration 008
- `alert_date` (date)
- `channel` (text: `whatsapp`, `sms`, `email`, `in_app`) — CHECK constraint updated in migration 006
- `status` (text: `pending`, `sent`, `failed`)
- `whatsapp_message_id` (text)
- `email_message_id` (text) — Added in migration 002 for SendGrid/Gmail message IDs
- `payload` (jsonb) — Added in migration 008; stores rendered email `{ subject, html, text }` for summary emails so retries can replay the exact message
- `provider_response` (jsonb) — Added in migration 008; stores SendGrid `{ statusCode, body, headers }` delivery verification
- `retry_count` (int, default 0)
- `error_message` (text)
- `sent_at` (timestamptz)
- `created_at` (timestamptz)
- UNIQUE constraint: `(machine_id, recipient_id, alert_type, alert_date, channel)`
- Partial unique index `idx_notifications_summary_idempotency` on `(recipient_id, alert_type, alert_date, channel) WHERE machine_id IS NULL AND alert_type IN ('daily_summary','engineer_summary','weekly_report','monthly_report')` — prevents duplicate summary emails per recipient per day
- Indexes: `idx_notifications_recipient_id`, `idx_notifications_alert_type` (migration 008)

### 5. `import_batches` & `import_errors`
- Tracks Excel import jobs and per-row errors.

### 6. `audit_logs`
- Insert-only, immutable action tracking.
- Records `user_id`, `action`, `entity_type`, `entity_id`, `metadata` (jsonb), `created_at`.

### 7. `system_settings`
- `whatsapp_phone_number_id`, `whatsapp_access_token_ref`
- `gmail_sender_email`, `gmail_app_password_ref`, `email_from_name`
- `daily_run_time` (default `08:00`)
- `default_service_interval_days` (default 90)

### 8. `user_document_types` (Config — Document Type Registry)
- `code` (text, PK) — e.g. `'aadhaar'`, `'driving_license'` (strictly Aadhaar and Driving Licence only; profile photo removed)
- `label` (text, NOT NULL) — human-readable display name
- `visibility` (text, NOT NULL, CHECK `'private'` | `'public'`) — determines storage bucket routing
- `allowed_mime_types` (text[], NOT NULL) — per-type accepted MIME types
- `max_size_bytes` (bigint, NOT NULL) — per-type file size limit
- `created_at` (timestamptz)
- RLS: SELECT for `authenticated`; no write policies (service_role only)
- Adding a new document type = one `INSERT` row, no migration needed

### 9. `user_documents` (User File Uploads)
- `id` (uuid, PK)
- `user_id` (uuid, FK `users.id`, ON DELETE CASCADE)
- `document_type_code` (text, FK `user_document_types.code`)
- `storage_path` (text, NOT NULL) — path within the bucket, e.g. `{user_id}/aadhaar.pdf`
- `mime_type` (text, NOT NULL)
- `file_size_bytes` (bigint, NOT NULL)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)
- UNIQUE constraint: `(user_id, document_type_code)` — one file per user per type
- Indexes: `idx_user_documents_user_id`, `idx_user_documents_type_code`
- RLS: Users read/write own documents; `super_admin`, `admin`, `hr` can read all

## Storage Buckets

### `user_files` (Private — Signed URL Access Only)
- **Public**: false
- **Purpose**: User KYC and identity documents (Aadhaar, Driving Licence photos/PDFs)
- **Access**: Owner CRUD via `storage.foldername(name)[1] = auth.uid()::text OR storage.foldername(name)[2] = auth.uid()::text`; admin/HR read
- **Path pattern**: `documents/{user_id}/{type_code}.{ext}` (inside folder `documents`)

## Stored Procedures (RPCs)
- `088_dashboard_read_model_rpcs.sql`: High-speed, role-specific dashboard read model RPCs (<5ms, `STABLE`, `SECURITY DEFINER`):
  - `get_super_admin_dashboard()`: Platform-wide counts (users, active machines, clients, assignments, today's logs, audit activity).
  - `get_admin_dashboard()`: Fleet counts + operational KPIs (breakdowns, overlapping logs, overtime, incomplete entries) + alerts.
  - `get_manager_dashboard()`: Fleet utilization breakdown (active, rented, spare, breakdown) + today's operating hours + alerts.
  - `get_supervisor_dashboard(p_supervisor_id UUID)`: Team-scoped counts (assigned machines, assigned operators, submitted vs pending logs, breakdowns) + alerts.
  - `get_hr_dashboard()`: Employee roster count, active operators, attendance log proxy, pending profile change requests + alerts.
  - `get_operator_dashboard(p_operator_id UUID)`: Assigned machine, client worksite, today's entry status, last HMR reading, shift + alerts.
- `084_operator_entry_context_rpc.sql`: `get_operator_entry_context(p_operator_id UUID)` returns assigned machine, client, and last HMR.

## Migrations Log
- `001_initial_schema.sql`: Core tables, indexes, RLS policies.
- `002_update_notifications_channel.sql`: Updated notification channel to allow `whatsapp` and `sms`.
- `002_user_email_and_gmail_notifications.sql`: Added required `email` to users; Gmail/email notification tracking schema.
- `003_performance_indexes.sql`: Composite indexes for machine queries, service dates, and user filtering.
- `004_dashboard_rpc.sql`: High-speed SQL function for analytics dashboard metrics (legacy).
- `005_fix_dashboard_rpc_user_context.sql`: Fixed security context in RPC function for RLS compliance.
- `006_email_notifications.sql`: Added `customer_email` to machines; updated notifications channel CHECK to include `'email'` and `'in_app'`.
- `008_daily_summary_notifications.sql`: Made `machine_id` nullable; added `engineer_summary` alert type; added `payload` + `provider_response` jsonb; partial unique idempotency index for summary emails; recipient/alert-type indexes.
- `036_enforce_machine_serial_number_unique_and_not_empty.sql`: Case-insensitive trimmed unique index on `machines(lower(trim(serial_number)))` and check constraint.
- `037_add_client_id_to_machines.sql`: Added `client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL` and index `idx_machines_client_id` on `public.machines`.
- `084_operator_entry_context_rpc.sql`: High-speed RPC for operator fast-entry form context.
- `085_prune_roles_to_six_canonical.sql`: Pruned database roles to 6 canonical roles (`super_admin`, `admin`, `manager`, `supervisor`, `hr`, `operator`).
- `086_operator_rbac_and_deletion_restriction.sql`: Machine hour log deletion restricted to `super_admin`; operator select and 7-day update RLS.
- `087_enforce_7day_operator_log_window.sql`: Database trigger enforcing 7-day date window for operator hour logs.
- `088_dashboard_read_model_rpcs.sql`: Dedicated read model RPCs for all 6 canonical roles with indexed counts and real-time operational alerts.
- `089_operator_machine_directory_kpi_scoping.sql`: Machine directory KPI summary scoping for operators including active assignments.
- `090_supervisor_dashboard_action_url.sql`: Point supervisor dashboard breakdown alert actionUrl to `/operations?tab=logs`.
- `091_dashboard_action_urls.sql`: Canonical dashboard RPC action URLs hardening across all roles.
- `092_fix_active_machines_dashboard_kpis.sql`: Fix active machinery query in `get_super_admin_dashboard()` and `get_manager_dashboard()` to check `health_status = 'active'` (or `status = 'active'`) excluding inactive machines.
- `096_operator_payrolls_table.sql`: Normalized operator payrolls table with `UNIQUE (operator_id, payroll_month)`, relational HR payroll summary RPC, single/bulk rate update RPCs.
- `097_attendance_rpcs.sql`: Zero-table derived attendance RPCs from `machine_hour_logs`.
- `098_schema_correctness_fixes.sql`: Schema correctness & constraint hardening:
  - Removed auto-generated `idempotency_key` DEFAULT on `machine_hour_logs` (defeats idempotency on raw inserts).
  - Added `CHECK (end_meter >= start_meter)` on `machine_hour_logs`.
  - Added currency precision `numeric(10,2)` on `users.daily_rate`, `users.ot_hourly_rate` and `numeric(10,2)`/`numeric(12,2)` on all `operator_payrolls` monetary columns.
  - Added `UNIQUE (phone)` on `users`.
  - Extended `updated_at` triggers (via existing `update_updated_at()`) to 8 secondary tables: `operator_payrolls`, `operator_machine_assignments`, `profile_change_requests`, `states`, `districts`, `cities`, `towns`, `villages`.
- `099_user_document_upload_system.sql`: Scalable user document upload system:
  - `user_document_types` config/reference table with seed rows (aadhaar, driving_license).
  - `user_documents` table with FK to types, UNIQUE(user_id, document_type_code), indexes, RLS.
  - Storage bucket: `user_files` (private, signed URL, 2MB limit, jpeg/png/pdf).
  - Storage path convention: `documents/{user_id}/{type_code}.{ext}`.
  - Storage RLS: owner CRUD via folder check; admin/HR read.
  - Pure creation migration avoiding direct deletion on `storage.buckets` (`storage.protect_delete()` compliance).
  - `updated_at` trigger via existing `update_updated_at()`.

## Schema Constraints & Triggers Summary

### `updated_at` Auto-Update Triggers (12 tables total)
All use `public.update_updated_at()` (`BEFORE UPDATE`, sets `NEW.updated_at = NOW()`):
- `users` (migration 001), `machines` (migration 002), `clients` (migration 003)
- `operator_payrolls`, `operator_machine_assignments`, `profile_change_requests`, `states`, `districts`, `cities`, `towns`, `villages` (migration 098)
- `user_documents` (migration 099)

### Key Constraints
- `machine_hour_logs.idempotency_key`: TEXT UNIQUE, no DEFAULT (RPC generates fallback via COALESCE)
- `machine_hour_logs.running_hours`: GENERATED ALWAYS AS (end_meter - start_meter) STORED
- `machine_hour_logs.chk_end_meter_gte_start`: CHECK (end_meter >= start_meter)
- `operator_payrolls.uq_operator_payrolls_operator_month`: UNIQUE (operator_id, payroll_month)
- `users.users_phone_unique`: UNIQUE (phone)
- `users.daily_rate`, `users.ot_hourly_rate`: numeric(10,2)
- `operator_payrolls` monetary columns: numeric(10,2) for rates, numeric(12,2) for pay totals

