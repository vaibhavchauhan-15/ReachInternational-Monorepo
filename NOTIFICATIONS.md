# Notification System — Architecture & Operations

> **Scope:** in-app notifications (`public.notifications` + inbox RPCs) and **push notifications** (Web Push + Expo) delivered when the browser tab or app is closed.
> **Audit + hardening record:** [`AI/FEATURES/push-notifications.md`](AI/FEATURES/push-notifications.md).
> **Incident runbook:** [`runbooks/PUSH_NOTIFICATION_DELIVERY_FAILURE.md`](runbooks/PUSH_NOTIFICATION_DELIVERY_FAILURE.md).
> The historical email (SendGrid) / WhatsApp (Twilio) / QStash design described in older revisions of this file is **retired** — none of those integrations exist in the codebase.

---

## 1. Channels

| Channel | Mechanism | Delivery when app/tab closed |
| --- | --- | --- |
| In-app inbox | `public.notifications` + `notification_list` / `notification_unread_count` / `notification_mark_read` RPCs | No (in-app only) |
| Native push (Android/iOS) | Expo Push Service (`expo-server-sdk`) → FCM/APNs | **Yes** |
| Web Push (browser/PWA) | `web-push` + VAPID + `public/sw.js` | **Yes** |

`public.notifications` is the **canonical notification source and transactional outbox**. There is no second queue.

## 2. Delivery pipeline (one notification → devices)

```
producer trigger / server action / scanner (pg_cron)
  └─ enqueue_notification()            → INSERT notifications (push_status='pending', dedupe_key)
       └─ trg_notifications_fastpath   → pg_net HTTP POST {ids:[id]}  (critical/high/normal)
       └─ pg_cron sweeper (1 min)      → pg_net HTTP POST {}          (drains everything due)
            └─ POST /api/notify/dispatch  (Bearer NOTIFY_SECRET, constant-time compare)
                 ├─ claim_push_batch()   atomic claim (SKIP LOCKED, 2-min lease, ≤5 attempts)
                 │    expiry → relevance → preferences → quiet hours (IST) → daily cap
                 │    → fan-out to every active device not yet delivered to
                 ├─ sendAll(): Expo (chunks ≤100) + Web Push (20-wide), failure domains isolated
                 └─ finish_push_batch()  per-device outcomes + per-notification state + jittered backoff
       └─ pg_cron receipts poller (15 min) → POST /api/notify/receipts (Expo ticket → receipt)
```

**Semantics (documented, not exactly-once):** one notification row per business event and
recipient; at most one active claim per delivery target; at-least-once provider delivery when a
network outcome is ambiguous (timeout after possible acceptance); best-effort duplicate
suppression via Expo `collapseId` (reminders), Web Push `Topic`/`tag`, and client-side `nid`
dedupe. Provider acceptance ≠ device delivery.

## 3. Schema map

| Object | Role |
| --- | --- |
| `public.notifications` | Inbox row + outbox state: `push_status (none→pending→sending→sent/skipped/failed)`, `claimed_at`, `push_attempts`, `send_after`, `ttl_seconds`, `dedupe_key`, `recheck`, `send_started_at`, `provider_accepted_at` |
| `public.push_devices` | One row per live push endpoint, globally unique `token`, `installation_id`, `provider (expo/webpush)`, `is_active`, `fail_count`, `disabled_reason`, `last_seen_at`, `vapid_version`. Per-user/per-platform cap (default 10, `app.push_device_cap`), LRU eviction with redacted audit event |
| `public.push_tickets` | Per-(notification × device) delivery record for **all** providers: `provider`, `status (ticketed/ok/error)`, `outcome (accepted/retry/dead/skipped)`, `ticket_id` (Expo receipts) |
| `public.user_notification_preferences` | Per-user toggles + quiet hours (IST). Enforced **server-side** in `claim_push_batch`; client toggles are UI only |
| `public.push_delivery_health` | Aggregate health view (queue depth, oldest pending, failure/invalid-token rates) — service_role only |

## 4. Producers (registry categories)

| Source | Category | Priority | Notes |
| --- | --- | --- | --- |
| BD1 breakdown log trigger | `breakdown` | critical (low if >24 h old) | supervisors + managers/admins |
| EM1 machine halted | `breakdown` | high | assigned operators + supervisors |
| AS1 assisted log | `assignment` | normal | operator |
| SA1 assignment change | `assignment` | normal | `app.skip_notify` suppressible |
| REG1 registration pending | `admin` | normal | 15-min digest bucket, **zero-PII body** |
| ENQ1 RFQ inquiry | `admin` | normal | **zero-PII body** |
| SP1-s1/s2 shift-end reminders | `shift_reminder` | high | window `[today−6, today]` IST |
| SP2 morning digest | `shift_reminder` | high | 09:00 IST |
| SL1 final lock warning | `shift_reminder` | critical | 18:00 IST, bypasses quiet hours |
| SUP1 supervisor digest | `shift_reminder` | normal | 09:30 IST |
| SEC1 password change/reset | `security` | critical | bypasses preferences + quiet hours + cap |
| PAY1 payroll statement | `payroll` | normal | generic body (month only) |
| approvals / log_entry (inbox task) | `approvals`, `log_entry`, … | varies | shared registry in `@reachinternational/types` |

**Reminder date authority:** operator logging window is exactly `[today_IST − 6, today_IST]`
(`public.get_pending_shift_slots` — the single implementation; no client-side duplicate exists).
Deadlines: `shift_entry_deadline(work_date) = (work_date + 7) 00:00 IST`. Expired reminders are
never dispatched (TTL + deadline enforced at claim).

## 5. Preferences & quiet hours

- Quiet hours (default 22:00–06:00 IST) **defer** non-critical pushes to the window end (never drop).
- Daily cap: max 5 non-critical pushes per user per 24 h (`daily_cap_exceeded`).
- `priority='critical'` and category `security` bypass application-level suppression.
- Nothing here overrides browser permission, OS settings, connectivity or provider availability.

## 6. Environment & secrets

| Name | Where | Purpose |
| --- | --- | --- |
| `NOTIFY_SECRET` | Server env only | Bearer auth for `/api/notify/*` (constant-time compare) |
| `VAPID_PRIVATE_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Server env / public env | Web Push VAPID pair (public key is safe to expose) |
| `VAPID_SUBJECT` | Server env | `mailto:` subject |
| `EXPO_ACCESS_TOKEN` | Server env (optional) | Expo Push API access token |
| `PUSH_ENABLED` | Server env | Master kill switch (`'true'` required) |
| `PUSH_DISABLED_CATEGORIES` | Server env | Comma-separated category kill switch (skips, never deactivates devices) |
| Vault `notify_url` / `notify_secret` | Supabase Vault (per database) | How pg_net/pg_cron reach the dispatcher |

**The database's `notify_url` must point at the dispatcher deployment wired to that same
database.** A wrong URL fails silently (pg_net records 404s; the trigger swallows errors) —
monitor `net._http_response` and `push_delivery_health`. VAPID rotation: rotate the pair, deploy,
then re-subscribe clients (see the runbook); `push_devices.vapid_version` tracks the key version.

## 7. Web behavior

- Permission is requested only from a user action behind an in-app primer (Settings) — never on page load.
- iOS/iPadOS: Web Push only works for an installed Home Screen web app (16.4+); the UI detects and explains.
- `sw.js`: allowlist-validated `notificationclick` (same-origin routes only), `tag`+`renotify` grouping, `pushsubscriptionchange` re-subscribes with `applicationServerKey` and re-registers via `POST /api/push/resubscribe`.
- Logout deactivates the user's push devices server-side.

## 8. Native behavior

- Android channels (fixed IDs, do not recreate): `breakdown_alerts` (HIGH), `shift_reminders` (HIGH), `assignment_updates` (DEFAULT), `general_updates` (DEFAULT).
- Registration keyed by `installation_id`; token re-registration reassigns ownership (shared phones).
- Foreground: critical/high show the system heads-up banner; normal/low surface via the in-app badge/inbox instead of a duplicate banner.
- Badge is synced from `notification_unread_count`. Logout/account-switch deactivates devices; user deactivation deactivates via DB trigger.

## 9. Testing

```bash
pnpm test                 # full battery (includes push suites + live Dev DB negatives)
node tests/push/test-push-hardening.mjs   # push hardening & negative security suite
node scripts/test-push-end-to-end.mjs     # live pipeline round-trip (Dev)
node apps/web/test/test-web-push-notifications.mjs
node apps/mobile/test/test-mobile-push-notifications.mjs
```

Push suites cover: SSRF/token validation, claim concurrency, lease reclaim, multi-device
independence, TTL expiry, quiet hours + critical bypass, category toggles, dedupe, IST deadline
boundaries, zero-PII templates, service-only RPCs, RLS isolation, route allowlist parity.

## 10. Monitoring

```sql
SELECT * FROM public.push_delivery_health;   -- queue depth, oldest pending, failures
SELECT status_code, count(*) FROM net._http_response GROUP BY 1;  -- pg_net dispatch health
```
