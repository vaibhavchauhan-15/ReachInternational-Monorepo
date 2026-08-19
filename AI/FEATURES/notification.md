# Feature Module — Multi-Channel Notification Engine

## Overview
Handles automated and manual dispatching of machine service reminders, system alerts, and updates. **All notifications are currently sent via SendGrid email.** WhatsApp/SMS (Twilio) are kept for future use via dynamic imports in `lib/notifications/index.ts`.

## File Map
- **Page**: `app/(app)/notifications/page.tsx`
- **Components**: `components/notifications/NotificationListClient.tsx`, `components/notifications/NotificationPreviewModal.tsx`, `components/notifications/NotificationRow.tsx`, `components/notifications/NotificationMobileCard.tsx`
- **Actions**: `app/actions/notifications.ts`, `app/actions/send-reminders.ts`, `app/actions/manual-reminder.ts`
- **Dispatchers**: `lib/notifications/email-templates.tsx`, `lib/notifications/sms.ts`, `lib/notifications/whatsapp.ts`, `lib/notifications/templates.ts`, `lib/notifications/index.ts`, `lib/notifications/daily-summary.ts`
- **Queries**: `lib/queries/notifications.ts`
- **Cron API Route**: `app/api/cron/send-reminders/route.ts`
- **Email**: `lib/email.ts` (SendGrid)

## Key Functions & Workflows
- `sendManualReminder(machineId)`: Sends immediate service reminder to engineer and customer via **SendGrid email**.
- `sendDailyReminders()`: Cron-driven automated batch dispatch. **PART 1**: per-machine service reminders (engineer + customer + **ALL admins** via email). **PART 2**: **admin daily operations summary** — one consolidated email per active `super_admin` and `admin` with KPI cards, new machines today, machines due tomorrow (with engineer phone/email), overdue machines (longest first), services completed today, per-channel notification stats, and dashboard CTA. **PART 3**: **engineer daily summary** — individualized email per active engineer with their due-tomorrow machines, overdue machines, completed services today, and a friendly reminder. **PART 4**: audit log with per-group sent/failed/skipped counts.
- `resendNotification(notificationId)`: Resends a failed notification via **SendGrid email**. For `daily_summary` / `engineer_summary` alert types, replays the stored HTML/text payload from `notifications.payload`.
- `sendNotification(payload)`: Central dispatcher. Defaults to email via SendGrid with delivery verification (`sendEmailWithTracking`). WhatsApp/SMS available via dynamic imports for future use.

## Intelligent Automation
- **Individual Machine Notifications**: Every service due/overdue machine triggers emails to: assigned engineer, customer (if email provided), and **all active admins (super_admin + admin roles)**.
- **Daily Summary Emails**: Sent automatically to all active admins (super_admin + admin) and engineers with relevant data.
- **Idempotency**: Partial unique index + app-level checks prevent duplicate notifications when cron re-runs.
- **Delivery Verification**: `sendEmailWithTracking()` captures SendGrid message IDs, status codes, and retries up to 2 times.
- **Concurrency Control**: Batched sends with 20-concurrent limit to respect SendGrid rate limits.

## Email Template Design
All email templates follow the **Vercel Geist design system** (`DESIGN.md`):
- **Colors**: Ink (#171717) on canvas (#fafafa), hairline borders (#ebebeb), semantic badges (warning #f5a623, link #0070f3, error #ee0000)
- **Typography**: System fonts with Geist-style weight (600 for headings, 500 for buttons, 400 for body)
- **Layout**: Hairline-bordered cards, 6px border radius, responsive tables, fully-rounded pill buttons (#171717)
- **Dark Mode**: Complete `@media (prefers-color-scheme: dark)` support with near-black backgrounds (#0f0f0f, #1a1a1a) and proper contrast
- **Templates**: Service reminders, admin daily summary (with KPI grid + notification stats), engineer daily summary (with reminder box)

## Daily Summary Email System
- **Data source**: Supabase via `lib/notifications/daily-summary.ts` (batched queries, admin client, server-only).
- **Admin summary** (`alert_type = 'daily_summary'`): KPIs (active machines, added today, completed today, due today, due tomorrow, overdue, alerts sent/failed), Machines Added Today table, Machines Due Tomorrow table (customer + engineer details), Overdue table (days overdue, last service date), Services Completed Today table, Notification Summary (email/WhatsApp/SMS sent/failed), "Open Dashboard" CTA. Sent to all active `super_admin` and `admin` users.
- **Engineer summary** (`alert_type = 'engineer_summary'`): Due Tomorrow machines (customer contact/address/city), Overdue machines (days overdue, last service), Services Completed Today, friendly reminder box, dashboard CTA. Only sent when the engineer has relevant data.
- **Idempotency**: Partial unique index `idx_notifications_summary_idempotency` on `(recipient_id, alert_type, alert_date, channel) WHERE machine_id IS NULL AND alert_type IN ('daily_summary','engineer_summary','weekly_report','monthly_report')` + app-level `hasSummaryNotification()` check. Rerunning the cron never duplicates.
- **Delivery verification**: `sendEmailWithTracking()` captures SendGrid `X-Message-Id`, status code, body, and headers into `notifications.provider_response`; retries up to 2 times with 1.5s delay; `retry_count` and `error_message` persisted.
- **Retry from Notification Center**: Failed summary emails can be resent; the stored `payload` (subject/html/text) is replayed exactly.

## Channels
| Channel | Status | Provider |
|---------|--------|----------|
| Email | **Active** | SendGrid |
| WhatsApp | Inactive (kept for future) | Twilio |
| SMS | Inactive (kept for future) | Twilio |
| In-App | Active | Supabase notifications table |

## Database
- `machines.customer_email` — Optional email for customer notifications.
- `notifications.channel` — CHECK constraint allows `('whatsapp', 'sms', 'email', 'in_app')`.
- `notifications.email_message_id` — Stores SendGrid message ID after successful send.
- `notifications.machine_id` — **Nullable** (migration 008); summary emails are not machine-bound.
- `notifications.alert_type` — Includes `engineer_summary` (migration 008).
- `notifications.payload` (jsonb) — Rendered email `{ subject, html, text }` for summary retries/audit.
- `notifications.provider_response` (jsonb) — SendGrid `{ statusCode, body, headers }` delivery verification.
- `notifications.retry_count` — Number of retry attempts performed.
- Partial unique index `idx_notifications_summary_idempotency` — prevents duplicate summary emails per recipient per day.