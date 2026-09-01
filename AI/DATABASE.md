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
- `004_dashboard_rpc.sql` & `005_fix_dashboard_rpc_user_context.sql`: Returns aggregated KPI statistics, machine status breakdowns, upcoming services, and notification deliverability rates scoped to the authenticated user's role.
- `get_notification_stats`: Returns notification statistics scoped by user role.
- `build_service_alert_email`: Builds `{ subject, html }` for service-alert emails.
- `pending_email_notifications` view: Pending email notifications joined with recipient + machine details.

## Migrations Log
- `001_initial_schema.sql`: Core tables, indexes, RLS policies.
- `002_update_notifications_channel.sql`: Updated notification channel to allow `whatsapp` and `sms`.
- `002_user_email_and_gmail_notifications.sql`: Added required `email` to users; Gmail/email notification tracking schema.
- `003_performance_indexes.sql`: Composite indexes for machine queries, service dates, and user filtering.
- `004_dashboard_rpc.sql`: High-speed SQL function for analytics dashboard metrics.
- `005_fix_dashboard_rpc_user_context.sql`: Fixed security context in RPC function for RLS compliance.
- `006_email_notifications.sql`: Added `customer_email` to machines; updated notifications channel CHECK to include `'email'` and `'in_app'`.
- `008_daily_summary_notifications.sql`: Made `machine_id` nullable; added `engineer_summary` alert type; added `payload` + `provider_response` jsonb; partial unique idempotency index for summary emails; recipient/alert-type indexes.
- `036_enforce_machine_serial_number_unique_and_not_empty.sql`: Case-insensitive trimmed unique index on `machines(lower(trim(serial_number)))` and check constraint.
- `037_add_client_id_to_machines.sql`: Added `client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL` and index `idx_machines_client_id` on `public.machines`.
