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

### Approvals Engine RPCs (`approval_*`)
All are `SECURITY DEFINER` with `SET search_path = 'public', 'pg_temp'`. Execute is revoked from `anon`/`PUBLIC` everywhere; the client contract (`approval_list`, `approval_counts`, `approval_get`, `approval_submit`, `approval_cancel`, `approval_approve_all`, `approval_decide`) is granted to `authenticated` + `service_role` only, and the internal domain handlers plus `approval_expire_due()` are service-role only.
- `approval_list(p_status, p_type_key, p_cursor_created_at, p_cursor_id, p_limit)` -> `{ items, next_cursor, has_more, pending_total }`. Keyset cursor `(created_at, id)`, no `OFFSET`, top-level rows only (`parent_id IS NULL`), each row carries `bound_request_ids` for its group.
- `approval_counts()` -> `{ total, by_type }` over top-level pending rows only, so badges match the queue.
- `approval_decide(p_request_id, p_decision, p_note, p_expected_version, p_actor_id, p_idempotency_key)` -> new state. One transaction: `auth.uid()`, approver-pool check against `approval_types.approver_roles`, self-approval block, `FOR UPDATE` row lock + status re-check, dual-control votes, then decision/event/audit/outbox and an atomic cascade to `parent_id` children. Errors: `42501` unauthorised, `P0002` unknown id, `P0003` version conflict, `P0004` already decided.
- `approval_approve_all(...)` bulk path, top-level rows only, cascades children, skips the actor's own requests unless the type allows self-approve, returns `skipped_ids`.
- `approval_apply_registration/document_verify/document_replace/profile_change/account_deletion`, `approval_apply_handler`, `approval_expire_due()` internal only.
- `approval_uuid_or_null(text)` IMMUTABLE helper: a malformed `payload` uuid value can no longer abort a queue read or a decision with `22P02`.

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
- `151_client_sites_schema.sql`: Client Sites Normalization Phase A:
  - Created `public.norm_text(text)` deterministic normalization function.
  - Created `public.client_sites` table with auto-assigned `site_code` (`CLI-XXXX-SNN`), generated `address_key`, immutable site code trigger, unique constraints, and RLS policies.
  - Created `public.find_similar_sites` fuzzy search RPC with `pg_trgm`.
  - Added `site_id` column and composite FK `(site_id, client_id)` to `machines` and `machine_hour_logs`.
- `152_client_sites_backfill.sql`: Client Sites Normalization Phase B:
  - Idempotently created 5 initial sites from existing clients.
  - Backfilled `machines.site_id` for rented machines.
  - Temporarily bypassed `trg_enforce_machine_hour_logs_immutable` to backfill `machine_hour_logs.site_id` for all 36 logs.
- `153_update_rpcs_for_site_id.sql`: Client Sites Normalization Phase C:
  - Updated `submit_operator_hour_log_atomic` RPC to automatically resolve and insert `site_id` from machines.
  - Updated `get_clients_directory_summary` RPC to return `sites_count` from `client_sites`.
- `235_rebuild_approvals_engine_grouping_and_pagination.sql`: Approvals engine rebuild:
  - `approval_requests.parent_id` (FK `approval_requests.id` ON DELETE CASCADE) links a registration to its document-verification requests so one applicant = one queue item.
  - `trg_auto_create_document_verification_approval` links new document requests to the pending registration.
  - Partial keyset indexes `idx_approval_queue_toplevel`, `idx_approval_queue_toplevel_type`, `idx_approval_queue_all_toplevel` (all `WHERE parent_id IS NULL`).
  - Rebuilt `approval_list` / `approval_counts` / `approval_decide` with keyset pagination, grouped counts and atomic group decisions.
- `236_approvals_rbac_null_role_guard_and_execute_hardening.sql`: Closed three privilege escalations (NULL-role RBAC bypass, `approval_get` `OR v_role IS NULL`, forged `p_actor_id` bulk approve), replaced the always-true `current_user = 'postgres'` check with the session role GUC, cascaded `approve_all`/`cancel`/`expire_due` to child rows, and revoked `anon`/`PUBLIC` execute across all `approval_*` functions.
- `237_approval_payload_uuid_cast_safety.sql`: Replaced every `(payload->>'key')::uuid` cast with `approval_uuid_or_null()` so one malformed payload row can no longer make the queue unreadable or a request undecidable.
- `238_approvals_supervisor_metadata.sql`: `approval_list` additionally resolves `supervisor_name` / `supervisor_id` (users.supervisor_id -> payload metadata -> `user_supervisors` junction) and returns them per row.
- `239_approval_counts_service_role_identity.sql`: `approval_counts()` resolves a service-role identity before its deny-by-default guard, so the service-role data-access layer sees counts again (regression introduced by 236). Numbered 239 to leave 238 to the supervisor-metadata migration; the two touch disjoint functions.

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

