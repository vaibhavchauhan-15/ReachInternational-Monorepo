gi# Database Map — Supabase PostgreSQL Schema

## Schema & Tables Overview

### 1. `users` (User Profiles — mirrors auth.users)
- `id` (uuid, PK, references `auth.users`)
- `full_name` (text, NOT NULL)
- `phone` (text)
- `email` (text, NOT NULL, unique, synced with auth.users)
- `role` (text: `super_admin`, `admin`, `engineer`)
- `status` (text: `active`, `inactive`)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

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

