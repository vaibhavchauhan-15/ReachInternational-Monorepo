# Push Notifications — Phase 0 Audit (Web Push + Expo)

> **Status:** PHASE 0 AUDIT COMPLETE → PHASE 1 APPROVED (“proceed”) → PHASES 2–5 IMPLEMENTED & VERIFIED. Phase 6 real-device verification: NOT RUN (no physical devices/credentials in this environment — reproduction steps in the final report).
> **Date:** 2026-11-26
> **Environment audited:** Development `vlmxciuogczumumrwyot` (read-only SQL via Supabase Management API). Production `dhbbgfzbyatzvqafnsqp`: **NOT TOUCHED** — `PRODUCTION READ-ONLY AUTHORIZATION: NOT GRANTED` in the task brief.
> **Authorized write:** this file only. No application code, schema, migration, env var, or configuration was modified.
> **Git state at start:** `main` @ `4c44f5e` with uncommitted in-app-notifications / logsheet-import work (another task). Preserved untouched.

---

## 0. Executive summary

The push pipeline architecture is sound and complete on paper: `public.notifications` as transactional outbox, `push_devices`, `push_tickets`, `user_notification_preferences`, row-level fast-path trigger → pg_net → authenticated dispatcher, pg_cron sweeper, `claim_push_batch` (SKIP LOCKED) / `finish_push_batch`, web-push 4.0.0 + VAPID + `public/sw.js`, expo-server-sdk 8.0.0, native channels and permission primer, and push test suites.

However, **the pipeline has never delivered a single push end to end in Development**, and two independent, verified breaks explain "users don't receive notifications when the tab/app is closed":

1. **Device registration is broken in both apps (verified empirically).** `register_push_device(p_platform, p_provider, p_token, ...)` — `p_provider` has no default (`supabase/migrations/192:112`), but both clients omit it:
   - `apps/web/lib/notifications/web-push-client.ts:129`
   - `apps/mobile/lib/notifications/registerPush.ts:190`
   PostgREST probe against Dev (2026-11-26, anon role, no data written):
   - client-style call `{p_platform:'web', p_token:..., p_app_version:...}` → **HTTP 404 `PGRST202` "Searched for the function public.register_push_device with parameters p_app_version, p_platform, p_token … no matches"**
   - full call incl. `p_provider` → `42501` (anon correctly denied; function resolves).
   Dev data corroborates: **`push_devices` = 0 rows, `push_tickets` = 0 rows** since 2026-10-15.
2. **The dispatcher URL stored in Supabase Vault is wrong (verified empirically).** Vault `notify_url` = `https://reachinternational.co.in/api/notify/dispatch` (host extracted, 52 chars). Every pg_net call to it returns **HTTP 404 with an HTML error page** (`net._http_response`: 405/405 responses in the trailing 6 h window are 404). The working dispatcher is at `https://dashboard-reachinternational.vercel.app/api/notify/dispatch` (probe: `401` with a bad bearer — route alive, auth enforced). Consequence: the fast-path trigger and the every-minute sweeper never reach the dispatcher → **1,291 notifications stuck `pending`, oldest 11 d 12 h 56 m** (2026-11-26 12:45 IST).

Secondary verified defects (see gap list): category preference toggles are dead code (CASE branch names never match produced categories), `SEC1` security alerts silently fail to enqueue (grant mismatch), Expo receipt polling is never scheduled, kill-switch/oversized-payload paths deactivate healthy devices, web logout never deregisters the browser, PII in two push bodies, deep-link routing has no single allowlist on web and a divergent one on mobile.

Remediation of the verified gaps is achievable with **small targeted fixes** in three areas (registration RPC/client contract, vault URL + operational alerting, finish/aggregate semantics), plus a modest per-device delivery-state change (verdict A). No new queue, table, or infrastructure is justified by the measured volumes (peak 18 notifications/minute on Dev).

---

## 1. End-to-end trace — one notification, both platforms

### 1.1 Common hops (database → dispatcher)

| # | Hop | Where | Latency budget | Failure mode | Retry behaviour |
|---|-----|-------|----------------|--------------|-----------------|
| 1 | Business insert → producer trigger | `supabase/migrations/195_*` (BD1/AS1/EM1/SA1/REG1/ENQ1), `194_*` (SP1/SP2/SL1/SUP1), app actions (`apps/web/app/actions/auth.ts:1334` SEC1, `payroll.ts:171` PAY1) | same tx | Producer wrapped in `BEGIN…EXCEPTION WHEN OTHERS → RAISE WARNING` — never aborts business tx (good) | none (by design) |
| 2 | `enqueue_notification(...)` → INSERT `public.notifications` (`push_status='pending'`, dedupe `ON CONFLICT DO NOTHING`) | `supabase/migrations/192:223-301` | same tx | dedupe swallows duplicates; deep_link regex check | dedupe_key unique index |
| 3 | Fast-path trigger `trg_notifications_fastpath` AFTER INSERT FOR EACH ROW → `notify_fastpath_trigger` reads Vault `notify_url`/`notify_secret` → `net.http_post({ids:[id]})` | `supabase/migrations/193:1-43`, Dev trigger (verified via `pg_get_triggerdef`) | ≤ 1 s (pg_net 0.20.4 worker batches after commit) | `EXCEPTION WHEN OTHERS` swallows everything (WARNING only). **Currently always ends in a 404 response** | **pg_net does not retry**; sweeper is the safety net |
| 4 | pg_cron sweeper `push_notifications_sweeper` every minute → `net.http_post(body '{}')` | `supabase/migrations/193:45-68`, active in `cron.job` | 0–60 s | cron errors visible only in `cron.job_run_details`; **currently 404 forever** | next minute repeats (this is the only liveness driver) |
| 5 | Dispatcher `POST /api/notify/dispatch` | `apps/web/app/api/notify/dispatch/route.ts` | — | `assertBearer` (constant-time `crypto.timingSafeEqual`, `apps/web/lib/notifications/auth.ts`), `PUSH_ENABLED` kill switch, 45 s drain loop, `maxDuration = 60` | 500 on claim failure; no rate limit beyond bearer auth |
| 6 | `claim_push_batch(200, ids)` — claim + rule pipeline | `supabase/migrations/192:313-467` (Dev definition verified identical) | single RPC tx | rules below | claim `FOR UPDATE SKIP LOCKED`; lease: `sending` reclaimed after **2 min**; attempts +1 at claim; max **5** attempts |
| 7 | Rules at claim: send-time relevance recheck (`notification_still_relevant`) → category preferences → quiet hours (IST) defer → daily cap (5 non-critical / 24 h) → no-active-device → fan-out to each active device | same | — | see §5–§7 findings | quiet-hours deferral rewrites `send_after` and decrements attempts |
| 8 | `sendAll` routes by provider | `apps/web/lib/notifications/send-all.ts` | — | `PUSH_DISABLED_CATEGORIES` marks rows `outcome:'dead'` (→ **deactivates device**, bug G-C4) | provider isolation via `Promise.all` (one throw loses the other's results, see G-C5) |
| 9a | **Expo**: token format check → `chunkPushNotifications` (≤ 100) → sequential chunks → ticket per message | `apps/web/lib/notifications/expo-sender.ts`, `expo-server-sdk@8.0.0` | per chunk ≈ 1 RTT | ticket `DeviceNotRegistered`/`InvalidExpoPushToken` → `dead`; `MessageRateExceeded`/`MessageTooBig`/`InvalidCredentials` → `retry` (misclassified permanent errors, G-C6); chunk throw → all `retry` (ambiguous acceptance) | SDK internally: `promise-limit` 6 concurrent, `promise-retry` ×2 on HTTP 429 only (`build/ExpoClient.js:50-73`) |
| 9b | **Web Push**: key check → 2 KB payload guard → `webpush.sendNotification` (TTL, urgency, `topic`) | `apps/web/lib/notifications/webpush-sender.ts`, `web-push@4.0.0` | 20-wide windows | 404/410 → `dead`; 429/5xx → `retry`; other (incl. 400/401/403) → `retry`; >2 KB → `dead` (deactivates device, bug G-C4) | notification-level backoff 30 s · 2^(n−1), 5 attempts |
| 10 | `finish_push_batch` — device fail_count / deactivation, `push_tickets` insert (Expo only), per-notification aggregation | `supabase/migrations/192:470-560` (Dev def: `sent_at = now()`, file says `COALESCE(n.sent_at, now())` — drift) | same tx | notification `has_ok → 'sent'` masks sibling device retries (verdict A) | `retry` → `pending` + backoff; ≥5 attempts → `failed` terminal |
| 11 | Expo receipts: `POST /api/notify/receipts` polls `ticketed` rows after 15 min | `apps/web/app/api/notify/receipts/route.ts` | delayed ≥ 15 min | `DeviceNotRegistered` receipt → deactivate device | **never scheduled — no cron/Vercel/Netlify job invokes it** (G-C7) |
| 12 | Client display + click | web: `apps/web/public/sw.js`; native: `apps/mobile/lib/notifications/registerPush.ts` + `postNotification.ts` | — | see §2/§3 | — |

### 1.2 Web-specific hop notes

- Subscription creation: `web-push-client.ts` → `pushManager.subscribe` → `register_push_device` RPC (**breaks, G-S1/G-C1**) with endpoint + `p256dh`/`auth` keys. Triggered from Settings toggle (`apps/web/components/settings/SettingsClient.tsx:123`, user action — good).
- SW scope `/`, `skipWaiting()` + `clients.claim()` unconditionally on every update (`sw.js:9-15`) — an updated SW takes over open sessions mid-flow (accepted behavior documented; revisit only if a session-breaking regression appears).
- `push` handler: `tag = d.tag || d.nid`, `renotify: Boolean(tag)`, `requireInteraction` for critical/high. `notificationclick` focuses/navigates `data.link` **without route allowlist validation** (G-S3).
- `pushsubscriptionchange` (`sw.js:78-96`): re-subscribe with `oldSubscription.options`, falls back to `{userVisibleOnly:true}` **without `applicationServerKey`** (fails in browsers requiring it), and only broadcasts to open windows — with no window open the new subscription is **never re-registered server-side** (G-C8).

### 1.3 Native-specific hop notes

- Registration: `registerPush.ts` — Android channels created first, permission, then `getExpoPushTokenAsync({projectId})` (hardcoded fallback `40432ac1-55a2-4bfa-985e-a51562398743`), then `register_push_device` RPC (**breaks, G-C1**).
- Permission primer exists: `apps/mobile/components/permissions/NotificationPermissionModal.tsx`; **but** `apps/mobile/app/_layout.tsx:366` also auto-calls `registerForPushNotifications()` on login, which itself calls `requestPermissionsAsync` — the OS prompt can fire without primer interaction (ordering not enforced) (G-P2).
- Channels (existing, do not recreate — importance is immutable): `breakdown_alerts` HIGH, `shift_reminders` HIGH, `assignment_updates` DEFAULT, `general_updates` DEFAULT (`registerPush.ts:73-104`). Server mapping `resolveAndroidChannel` (`expo-sender.ts:9-28`) resolves both `breakdown`/`breakdown_alerts` and `shift_reminder`/`shift_reminders` variants to these IDs — every `channelId` sent exists on device. No versioned channel needed (importance already as desired).
- Foreground: `setupForegroundNotificationHandler` always shows system banner (`shouldShowBanner: true`) — Phase 3 item "in-app indicator instead of duplicate banner where appropriate" not implemented (G-P3).
- Tap routing: `setupNotificationResponseListener` validates `data.link` against `ROUTE_ALLOWLIST` in `registerPush.ts:36-42` — **divergent from the shared registry** (see §16) and missing `machines`, `approvals`, `payroll`, `attendance`, `rfq`; invalid links silently fall back to `/dashboard` (G-S3).
- Badge: `shouldSetBadge: true` but **no `setBadgeCount`/unread-count sync anywhere in `apps/mobile`** (grep: zero matches) (G-P4).
- Logout / account switch: `unregisterPushNotifications()` called from `apps/mobile/lib/auth/useAuth.tsx:395` (good). Token re-registration upserts by token and reassigns `user_id`, covering shared phones. No per-user device cap, no `installation_id` column (G-C9).

---

## 2–16. Required verification items

### 2. Schema semantics — VERIFIED
- `public.notifications` = **one row per business event per recipient** and doubles as the outbox; delivery state machine lives here: `push_status (none→pending→sending→sent/skipped/failed)`, `claimed_at` (lease anchor), `push_attempts` (max 5), `send_after` (retry schedule / quiet-hours deferral), `sent_at`, `push_status_reason`, `ttl_seconds`, `dedupe_key`, `recheck`. (`supabase/migrations/192:23-41`, verified on Dev.)
- `public.push_tickets` = **one row per (notification × device) Expo receipt** — NOT the delivery queue and NOT used for web push. Columns: `ticket_id`, `status (ticketed/ok/error)`, `error`, `created_at`. **No claim owner/token, no lease, no attempts** (by design here; claiming is on `notifications`).
- `public.push_devices` keyed by **globally unique `token`** (`uq_push_devices_token`) — no `installation_id` column exists. Columns: `platform`, `provider`, `web_keys`, `is_active`, `fail_count`, `disabled_reason`, `last_seen_at`.
- **No per-device delivery state**: once a notification is `sent`, per-device outcomes are forgotten (verdict A).

### 3. Web — VERIFIED (paths in §1.2)
- VAPID keys from env (`VAPID_PRIVATE_KEY`/`NEXT_PUBLIC_VAPID_PUBLIC_KEY`; present in all env files incl. examples; gitignored). **No key versioning or rotation path** — rotating the key pair silently invalidates every subscription (G-S4). No `VAPID_PRIVATE_KEY` in `apps/web/.env.local`? — checked: present in `apps/web/.env.local`, `.dev.vars`, `.env.production`, `apps/web/.env.production*` (names verified, values not read into this document).
- TTL + Urgency + Topic sent (`webpush-sender.ts:112-121`); payload JSON `{title, body, link, nid, tag}` — 2 KB guard exists (but kills the device on violation).
- **Endpoint validation: NONE.** `register_push_device` accepts any `text` token/endpoint with no HTTPS or push-service-host check → SSRF vector: a registered (authenticated) user can store an arbitrary URL that the dispatcher later fetches server-side (G-S2).

### 4. Native — VERIFIED (paths in §1.3)
- `EXPO_ACCESS_TOKEN` **absent from every env file** (optional for Expo ticket API; receipts also work unauthenticated). Deploy-platform env presence NOT VERIFIABLE from repo.
- Receipts: delayed 15 min, ≤ 1 000/tick, `DeviceNotRegistered` deactivates (`receipts/route.ts`) — **but never scheduled** (G-C7).
- `DeviceNotRegistered` also handled synchronously at ticket time (`expo-sender.ts:60-66`).
- iOS critical alerts not used (correct — needs Apple entitlement). `interruptionLevel` exists in SDK but unused.

### 5. Server — VERIFIED
- Dispatcher auth: Bearer `NOTIFY_SECRET`, constant-time compare (`lib/notifications/auth.ts`). DB side stores `notify_url` + `notify_secret` in **Supabase Vault** (read at trigger time; not in migrations — good). **The stored URL is wrong (404)** — the "what happens when wrong" case is proven: silent, permanent, no alerting.
- Batching: `p_limit 200`, 45 s drain loop, `maxDuration 60`, region `bom1`. Concurrency: Expo chunks sequential (SDK internal `promise-limit` 6, retry ×2 on 429); web push 20-wide `Promise.all`.
- Backoff: `send_after = now() + 30 s · 2^(attempts−1)`; max 5 attempts → `failed` (`max_retries_exceeded`); terminal states exist (`failed`, `skipped`). **No dead-letter table** (bounded by `push_status`, acceptable at current volume).
- **Cron overlap: NOT prevented** — sweeper fires every minute regardless of a dispatcher run in flight (mitigated by SKIP LOCKED + 45 s cap; no observed double-processing — also nothing has ever processed).
- Installed SDK behavior verified against lockfile + source (not upstream docs): `expo-server-sdk@8.0.0` — chunk limit **100** (`ExpoClientValues.js:14`), receipts chunk **300**, concurrency **6**, 429-retry ×2 min 1 s; **network errors are not retried by the SDK** (our code marks them `retry`, creating the ambiguous-acceptance window). `web-push@4.0.0` — `topic` supported (`web-push-lib.js:121`), `node:https`-based (Cloudflare Workers compat needs `nodejs_compat` sockets — NOT RUN).
- Logging: `console.error/warn` with no PII beyond notification ids and Supabase error objects (e.g., `dispatch/route.ts:36`); `receipts` logs counts only. Ticket errors store provider error strings. **No structured redaction layer, no Sentry breadcrumbs** (G-O2).

### 6. Preferences — VERIFIED with a defect
- Quiet hours (IST) enforced **server-side** in `claim_push_batch` (defer, not drop) — identical for web and native because enforcement is per-device-agnostic in the DB. Daily cap 5 non-critical / 24 h server-side. `push_enabled` + category toggles read server-side; the client toggle (`SettingsClient.tsx`, `apps/mobile/lib/preferences/notifications.ts`) is UI-only — correct.
- **Category toggles are dead code**: the CASE in `claim_push_batch` (`192:470-475`) matches `'shift_reminders','breakdown_alerts','assignment_alerts','admin_alerts','payroll_alerts'`, but producers emit `'shift_reminder','breakdown','assignment','admin','approvals','log_entry','security','payroll'` (verified live: `cat_source_dist`). Only the `security` exclusion and `push_enabled` actually work. (Dev data provenance: producer/scanner rows use the registry spellings; the 720 `breakdown_alerts` rows are test-fixture provenance — `supabase/tests/test_push_notifications_phase1_sql.mjs:307` inserts that exact spelling, which is why the tests pass while production flows don't.)
- Critical bypass: `priority='critical'` bypasses quiet hours + daily cap + (via `security` category) preferences. `SEC1` uses category `security` + priority `critical` — correct. A `security`-category row with non-critical priority would still be capped/quiet-hour-deferred (no such producer today; semantic gap noted).

### 7. Content & PII — VERIFIED with violations
Producers live: BD1 breakdown (critical, or low if >24 h old), AS1 assisted log (normal), EM1 equipment halted (high), SA1 assignment change (normal), REG1 registration pending (normal), ENQ1 RFQ (normal), SP1-s1/s2 shift-end (high), SP2 morning digest (high), SL1 final lock (critical), SUP1 supervisor digest (normal), SEC1 password change (critical, **silently fails** — G-C2), PAY1 payroll update (normal), plus inbox-task rows (`log_entry`, `approvals`, `breakdown_alerts` sources `event` / `approval_outbox:*`).
- **PII on lock screen (zero-PII violation):** `REG1` body contains `NEW.full_name` (`195:producer_reg1_registration`), `ENQ1` body contains contact `full_name` + project city (`195:producer_enq1_rfq`). Everything else is machine codes / counts / dates.
- Noisy/duplicate candidates: SA1 fires per assignment INSERT/UPDATE (dedupe key includes `TG_OP` + `valid_from`; bulk imports suppressed via `app.skip_notify` and the logsheet import's `reach.suppress_log_notifications`); EM1 per machine-stop transition; BD1 fans out to every manager/admin + machine supervisors per breakdown log. Measured peak 18/min — **no storm observed**.
- `SEC1`/`PAY1` referenced as DB producers in `199` comments but implemented in app actions only; `security`/`payroll` categories bypass/surpass the (dead) preference CASE.

### 8. RLS, grants, authorization — VERIFIED (changes would need approval)
- `push_devices`, `push_tickets`: RLS enabled, **zero policies** for clients → deny-all; mutations only via `SECURITY DEFINER` RPCs bound to `auth.uid()`; `REVOKE … FROM PUBLIC, anon` + `GRANT … TO authenticated, service_role` (192:160-175). `claim/finish/enqueue` granted to **service_role only** (verified `proacl` on Dev). Sound.
- `user_notification_preferences`: `own_prefs` FOR ALL `auth.uid() = user_id` — sound.
- `notifications`: `notifications_select_own` (own rows); `notifications_insert_authorized` allows `authenticated` to INSERT **any user's** notification if the actor is supervisor/manager/admin/super_admin — client-injectable notification rows (spoofed in-app + push spam to arbitrary recipients). Recorded as insufficient; **fix is an RLS change → gated behind explicit approval** (G-S5).
- `register_push_device`: unauthenticated → `unauthenticated` exception (verified in tests and by grant). Ownership: upsert reassigns token owner to `auth.uid()` (correct shared-phone semantics).

### 9. Device limits / registration — VERIFIED
- **No per-user/per-platform cap** and no LRU eviction — prompt requires a configurable cap with LRU deactivation + redacted audit event (G-C9). Never reject a new device: currently trivially true (0 devices can register at all).
- Duplicate notifications to one physical device from stale tokens are prevented by global token uniqueness + upsert reassignment.

### 10. Existing push test suites — VERIFIED
| Suite | Covers | Not covered |
|-------|--------|-------------|
| `scripts/test-push-end-to-end.mjs` | enqueue → claim → prefs verification, fixture cleanup | never validated real client registration RPC call shapes |
| `scripts/test-cross-platform-shift-assignment-push.mjs` | 5 scenarios web↔native fan-out, dual-device claiming, channel resolution incl. both category spellings | uses service-role inserts for devices (bypasses `p_provider` bug) |
| `apps/web/test/test-web-push-notifications.mjs` | sw.js handlers, 2 KB guard, settings prefs sync, WebView skip | no live push, no SW click E2E |
| `apps/mobile/test/test-mobile-push-notifications.mjs` | channels, Expo Go guards, deep-link allowlist, sign-out deactivation, `register_push_device` auth guard (calls **with** `p_provider`) | no real FCM/APNs delivery |
| `supabase/tests/test_push_notifications_phase1_sql.mjs` | prefs gating, reassignment, dedupe — inserts test rows incl. `push_status:'sent'` fixtures | fixture rows left in Dev (`breakdown_alerts` ×720) |
| `supabase/tests/test_push_notifications_phase5_6.mjs` | anon RLS denials on push tables/RPCs | — |
| `apps/web/scripts/test-push-dispatcher.mjs` | manual dispatcher smoke | — |

Systemic blind spot: **all suites create devices via service-role/SQL with `p_provider`, so the broken client RPC call shape was never exercised.** No negative suite for TTL expiry, storm/backoff, lease reclaim, multi-device independence, or PII templates (Phase 5 list).

### 11. Migration history — VERIFIED (README counts are indeed inconsistent)
- `supabase/migrations/`: **247 SQL files**; number collisions: `101` ×2, `105` ×2, `194` ×2, `209` ×2, `242` ×2 (plus `20261101061529_rfq.sql` naming outlier).
- Dev `supabase_migrations.schema_migrations`: **146 rows**, latest recorded `241_approval_decide_document_replace_rejection_fix` (`20261125241000`).
- **Push migrations `192, 193, 194, 195, 196, 199` are NOT recorded in history** (applied ad hoc) though their objects exist on Dev (verified `pg_proc`, `pg_trigger`, `cron.job`).
- **Drift:** Dev `trg_notifications_fastpath` WHEN clause = `priority IN ('critical','high')` (i.e. migration `193`), **not** `199` (which adds `'normal'`) → normal-priority rows rely on the 1-minute sweeper. `finish_push_batch` on Dev sets `sent_at = now()` on re-send vs file's `COALESCE(n.sent_at, now())`.
- **Next safe migration number: `243`** (do not reuse 242; record every apply in `schema_migrations`; the two uncommitted `242_*` files belong to other tasks).

### 12. Baseline from real data — Development only (Production: NOT GRANTED, not queried)
Sample: **2,268 notifications, 2026-10-15 10:39 → 2026-11-26 12:45 IST** (full Dev history); devices/tickets tables empty entire period.

- Notifications/day (recent): 2026-11-25 ≈ 221 (assignment 69, breakdown_alerts 50*, admin 33, shift_reminder 32, log_entry 18, approvals 25); 2026-11-26 (to 12:45) ≈ 69. *`breakdown_alerts` rows are test-fixture provenance (see §6).
- `push_status` distribution: **pending 1,291 (56.9%)**, sent 720 (31.7%, all `sent_at IS NULL`, `claimed_at IS NULL`, `push_attempts=0` → inserted as pre-set `sent`, outside the pipeline), none 256 (log_entry, push disabled), skipped 1 (`no_active_device`).
- Attempts histogram: `0 → 2,267`, `1 → 1`. **Oldest pending age: 11 d 12 h 56 m** (as of 2026-11-26 12:45 IST). Stuck `sending`: 0.
- Created→accepted latency p50/p95/p99: **NOT MEASURABLE — 0 rows with `sent_at`** (no pipeline completion ever). Phase 4 must add `trigger_enqueued_at` / `claimed_at` / `provider_request_started_at` / `provider_accepted_at` instrumentation before latency targets can be evaluated.
- Devices: total 0, active 0, stale 0; duplicate tokens 0 (unique index; **no installation id to dedupe by**). Multi-device users: n/a.
- Peak load: **18 notifications/minute** (2026-11-25 10:38 IST); peak hour 80 (2026-11-25 10:00). Fan-out multiplier (× recipients × devices) unexercised (0 devices).
- `net._http_response`: **405 rows / 5,064 kB** in the trailing ~6 h window (2026-11-26 06:46→12:49 IST); retention ≈ 6 h (pg_net purge; oldest ≈ now−6 h); **100 % status 404**. `net.http_request_queue`: 0 (nothing in flight).
- `user_notification_preferences`: 2 rows, both defaults.

### 13. Dispatcher runtime matrix — VERIFIED
| Target | How it runs | web-push 4.0.0 needs | Duration vs batch |
|--------|-------------|----------------------|-------------------|
| **Vercel** (primary; `www.reachinternational.co.in` + `dashboard-reachinternational.vercel.app` per `runbooks/VERCEL_WEB_DEPLOYMENT_FAILURE.md`) | `apps/web/app/api/notify/dispatch/route.ts`, `runtime='nodejs'`, `maxDuration=60`, `preferredRegion='bom1'` | `node:https`, `node:crypto` — full support | 60 s max vs 45 s drain loop vs 200-row batches — fits |
| **Cloudflare Workers** (`wrangler.jsonc` → `apps/web/.open-next/worker.js`, `nodejs_compat`, compat 2025-08-16) | open-next server function | `node:https` via nodejs_compat sockets — plausible but **NOT RUN / unverified** | Worker limits apply; unverified |
| **Netlify** (`netlify.toml` + `netlify/functions/*` crons) | Node functions | full support | 10 s default / 26 s paid unless configured — **`maxDuration` is Vercel-specific; Netlify function timeout not configured for dispatch** (unverified) |

DB learns dispatcher URL/secret **from Supabase Vault** (`notify_url`, `notify_secret`; verified present) — correctly kept out of migrations. **Failure semantics when wrong/missing:** trigger swallows (`EXCEPTION WHEN OTHERS → WARNING`), pg_net records 404s silently, cron keeps firing, backlog grows unbounded — exactly the observed state. No health signal anywhere.

### 14. Trigger fan-out — VERIFIED
- Fast-path trigger is **row-level** (`AFTER INSERT … FOR EACH ROW`); a 200-row reminder fan-out creates **200 pg_net calls** (plus ×1 per recipient for multi-recipient producers). Measured volume (≤18/min) makes statement-level triggers + transition tables an optimization without a demonstrated need → **not recommended now** (proportionality).
- pg_net 0.20.4: `net.http_post` enqueues into `net.http_request_queue` inside the calling transaction; the worker dispatches **after commit** (rolled-back producer txs never fire). pg_net **does not retry** failed deliveries.
- Sweeper coverage of lost pg_net calls: **yes in principle** — the every-minute sweeper posts `body '{}'` so `claim_push_batch(p_ids := NULL)` drains all due pending rows — this is the only recovery path for lost/failed fast-path calls, and it is currently non-functional (404).

### 15. Collapse capability — VERIFIED against installed packages (not upstream docs)
- `expo-server-sdk@8.0.0` `ExpoPushMessage` **has `collapseId` and `tag`** (`apps/web/node_modules/expo-server-sdk/build/ExpoClient.d.ts:88-89`) — currently **unused** by `expo-sender.ts`. Collapsing repeated reminders is achievable with zero new dependencies.
- `web-push@4.0.0` **supports `options.topic`** (`web-push-lib.js:121`); already used (`sp-<category>`). Topic replaces queued-but-undelivered messages per endpoint — best-effort only. Web `tag` + `renotify` already group client-side.

### 16. Cross-task contract — VERIFIED
Single registry owner (inbox task, uncommitted): `packages/types/src/notifications.ts` (`NotificationCategory`, `NotificationRouteKey`), DB-side allowlist in `supabase/migrations/242_in_app_notifications_inbox_and_keyset_rpc.sql` (`trg_sync_notification_route`: `route_key`↔`deep_link` sync, routes `operations|machines|users|approvals|payroll|attendance|rfq|settings|dashboard`), plus `packages/permissions/src/notifications.ts`. **Push does not consume it today**: enqueue validates deep_link by regex only; mobile carries a private divergent `ROUTE_ALLOWLIST`; web SW validates nothing. Push-side work must reference this registry — **do not create a second copy**.

---

## REQUIRED AUDIT VERDICTS

**A. Multiple devices per user — PARTIAL → remediation: DEEPER CHANGE (small, bounded)**
Evidence: `claim_push_batch` fans out one row per active device and `finish_push_batch` records per-device outcomes — delivery is genuinely attempted per device (PASS part). But aggregation (`192`, `aggregated` CTE) sets the *notification* to `sent` on `bool_or(outcome='ok')`, so a sibling device's `retry` is abandoned and never re-attempted (device B silently loses that notification once device A succeeded). Additionally `send-all.ts` maps `CategoryDisabledByKillSwitch` and `webpush-sender.ts` maps `PayloadExceeds2KB` to `outcome:'dead'`, which **deactivates healthy devices** (a failure of one concern corrupts another device's registration). Fix requires per-(notification × device) delivery state (extend `push_tickets` semantics to all providers or a status column pair) — a small additive schema change, not a new queue.

**B. Concurrent dispatch — PASS → remediation: SMALL TARGETED FIX (none required; document + guard)**
Evidence: claiming is a single RPC (`claim_push_batch`) whose `UPDATE … FROM (SELECT … FOR UPDATE SKIP LOCKED LIMIT n)` commits when the RPC returns — **before** `sendAll` makes any network call (`dispatch/route.ts` calls `admin.rpc('claim_push_batch')` then `sendAll`, no open tx). Two concurrent dispatchers cannot claim the same active row (SKIP LOCKED + status transition). Caveats (document, don't over-build): no claim-owner token; fixed 2-minute lease while max claim lifetime is 45 s (loop cap) < 60 s `maxDuration` — safe today; sweeper has no cron-overlap guard (harmless given SKIP LOCKED). Add an owner token only if batch windows ever exceed the lease.

**C. Ambiguous provider acceptance — PARTIAL → remediation: SMALL TARGETED FIX**
Evidence: `expo-sender.ts` chunk-level `catch` marks the entire chunk `retry` although Expo may have accepted some/all messages (SDK does not retry network errors itself — only 429 ×2) → at-least-once with real duplicate risk. `collapseId` (supported, verified) is unused; web `topic` is set (best-effort collapse of queued messages only). Backoff is jitterless `30 s · 2^(n−1)`, 5 attempts, terminal `failed`. Permanent errors (`InvalidCredentials`, `MessageTooBig`) misrouted to `retry`; `PayloadExceeds2KB` misrouted to device-deactivating `dead`. Fix: use `collapseId` per (user, category, business-key) for reminders, reclassify permanent errors, add jitter, and document uncertain-acceptance explicitly. Correctness must not depend on collapse (it doesn't today).

**D. Abandoned claims — PARTIAL → remediation: SMALL TARGETED FIX**
Evidence: lease-expiry reclaim exists (`push_status='sending' AND claimed_at < now() − interval '2 minutes' AND push_attempts < 5`), attempts bounded at 5 with terminal `failed`; no ticket can be stuck forever **provided a dispatcher eventually runs** — but the sweeper is the only liveness driver and its target 404s (observed: 1,291 pending for 11.5 d, zero claims). There is no alerting on queue depth / oldest-pending. Fix: correct + verify the Vault URL, add health views/alert (Phase 4), keep lease reclaim as-is.

---

## GAP LIST (ranked security > correctness > latency > polish)

**Security**
- **G-S1 (Critical):** Device registration RPC-call-shape break means no device rows — while it also masks G-S2; fix registration first. Evidence: PGRST202 probe, 0 device rows. *(Root cause of the headline symptom.)*
- **G-S2 (High):** No endpoint/token validation in `register_push_device` (any `text`) — SSRF vector via stored web-push endpoints; add HTTPS + known push-service-host validation server-side. Evidence: `192:112-145` has zero validation.
- **G-S3 (High):** Deep-link routing unvalidated on web (SW navigates `data.link` directly) and mobile allowlist diverges from the shared registry (taps for `machines|approvals|payroll|attendance|rfq` silently bounce to `/dashboard`). Consume the single registry + route allowlist (§16).
- **G-S4 (Medium):** VAPID keys unversioned; rotation silently kills all subscriptions; no documented rotation path. Also `NEXT_PUBLIC_VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` pair consistency per environment unverified.
- **G-S5 (Medium, RLS-gated):** `notifications_insert_authorized` lets supervisor+ roles insert notification rows for arbitrary users from the client (spoofed pushes/inbox spam). RLS change → **needs explicit approval**; independent work must not depend on it.
- **G-S6 (Low):** No Zod validation of dispatcher request body (`ids` cast from `any`); accept only `string[]` of UUIDs. `NOTIFY_SECRET` listed in Netlify `SECRETS_SCAN_OMIT_KEYS` — tighten.

**Correctness**
- **G-C1 (Critical):** `register_push_device` call-shape mismatch (both apps) — no registration possible. Fix: pass `p_provider` (`'webpush'`/`'expo'`) from both clients (or add defaulted overload in a 243 migration — additive).
- **G-C2 (High):** `changePasswordAction` (`apps/web/app/actions/auth.ts:1334`) calls `enqueue_notification` via the **user-scoped** server client, but the function is granted to `service_role` only (verified `proacl`) → SEC1 security alert **silently dropped** (`catch` swallows). Use the admin client (as `payroll.ts` already does).
- **G-C3 (High):** Category preference CASE (`shift_reminders|breakdown_alerts|…`) never matches produced categories (`shift_reminder|breakdown|…`) → category toggles dead; fix CASE to the registry spellings (or map once in enqueue). Quiet-hours/cap use `priority`, so they work.
- **G-C4 (High):** `outcome:'dead'` used for sender-side conditions (kill-switch category, >2 KB payload) **deactivates healthy devices** in `finish_push_batch`.
- **G-C5 (Medium):** `sendAll` `Promise.all` without per-provider isolation guard — one throwing provider loses the other's results (rows fall back to lease reclaim → duplicates). Wrap providers so a throw produces `retry` results for its own rows only.
- **G-C6 (Medium):** Permanent Expo errors (`InvalidCredentials`, `MessageTooBig`) classified `retry`; `PayloadExceeds2KB` classified device-`dead`.
- **G-C7 (High):** `/api/notify/receipts` never scheduled anywhere (no pg_cron, Vercel, Netlify, or Worker cron) → Expo receipts (`ok/error`, `DeviceNotRegistered`) never reconciled.
- **G-C8 (Medium):** `pushsubscriptionchange` re-subscribe drops `applicationServerKey` and only registers via open windows — silent subscription loss when no tab is open (directly harms the closed-tab scenario).
- **G-C9 (Medium):** No per-user device cap / LRU eviction; no `installation_id`; web logout (`app/actions/auth.ts` signOut paths) never calls `unsubscribeFromWebPush`/`unregister_push_device` → logged-out browsers keep receiving pushes.
- **G-C10 (Medium):** TTL never enforced at claim: quiet-hours-deferred or backlog rows dispatch past `send_after + ttl_seconds` and past the shift-lock deadline (`notification_still_relevant` rechecks the log, not expiry). "Expired notifications are never dispatched" is not currently true.
- **G-C11 (Low):** Dev drift: fast-path trigger missing `'normal'` (199 not applied as written); `finish_push_batch sent_at` drift; 720 fixture rows pollute Dev status semantics; `net._http_response` 404 history is the only trace of the broken URL.
- **G-C12 (Low):** `sw.js` `skipWaiting`/`clients.claim` unconditional (documented risk); `client.url.includes(link)` matching is fragile.

**Latency**
- **G-L1:** Measured latency is unobtainable (no `sent_at`/timestamp instrumentation). Phase 4 instrumentation is a prerequisite for the p95 2–3 s / 60 s targets. Fast-path currently covers `critical|high` only on Dev (199 drift) — normal events wait ≤ 60 s for the sweeper (already within target).
- **G-L2:** One pg_net call per row (row-level trigger) — acceptable at measured 18/min; revisit only if volume grows ×10.

**Polish**
- **G-P1:** `NOTIFICATIONS.md` describes a legacy email/WhatsApp/QStash system — rewrite for the actual push pipeline.
- **G-P2:** Mobile permission request can fire without primer interaction (dual registration paths: `app/_layout.tsx:366` auto + primer modal).
- **G-P3:** Foreground handler always shows system banner (no in-app indicator mode).
- **G-P4:** Badge never synced from unread count (`notification_unread_count` RPC exists — read-only consumption is authorized).
- **G-P5:** Structured PII-redacted logging / Sentry breadcrumbs absent; `console.*` only.

---

## RECOMMENDED IMPLEMENTATION SCOPE (for approval — each item cites its evidence)

**Batch 1 — restore delivery (closes the headline symptom):**
1. Pass `p_provider` in `register_push_device` calls (`web-push-client.ts:129`, `registerPush.ts:190`) + guard test asserting the exact RPC arg shape (evidence: G-C1, PGRST202 probe, 0 devices). *Additive, no schema change.*
2. Fix Vault `notify_url` to the deployed dispatcher URL and add a one-line health verification to the push runbook; smoke via `test-send` (evidence: 404 ×405, §12 backlog). *Config-only.*
3. Schedule `/api/notify/receipts` (pg_cron every 15 min alongside existing jobs) (evidence: G-C7).
4. SEC1 enqueue via admin client (evidence: G-C2, `proacl`).

**Batch 2 — correctness of outcomes (small):**
5. Preference CASE → registry category spellings (evidence: G-C3, live `cat_source_dist`).
6. Stop deactivating devices for sender-side conditions; new non-device outcome (evidence: G-C4).
7. Permanent-vs-transient error reclassification + jittered backoff; per-provider failure isolation in `sendAll` (evidence: G-C5, G-C6).
8. TTL/expiry enforcement at claim (`send_after + ttl_seconds`, reminder deadlines) (evidence: G-C10).
9. Web logout deregistration + `pushsubscriptionchange` fix with `applicationServerKey` (evidence: G-C8, G-C9).

**Batch 3 — security (small; G-S5 is approval-gated and independent):**
10. Server-side endpoint validation (HTTPS + known push-service hosts) in registration (evidence: G-S2).
11. Push payload = validated discriminated-union over the shared registry (`packages/types`/`packages/validation`); SW + native tap routing through the single route allowlist (evidence: G-S3, §16). *Consumes inbox-owned registry; no second copy.*
12. VAPID key versioning/rotation runbook (evidence: G-S4).
13. RLS tightening of `notifications_insert_authorized` — **report + await approval; do not block Batches 1–2** (evidence: G-S5).

**Batch 4 — multi-device delivery state (verdict A, bounded additive schema):**
14. Per-(notification × device) delivery status so one device's success never cancels another's retry (extend `push_tickets` to web rows or add `push_device_deliveries` columns — **additive only**, decision to be re-approved with the exact DDL) (evidence: verdict A).

**Batch 5 — observability, parity, tests (Phases 4–5):** timestamp instrumentation + health views + runbook + PII template checks + the negative suites from the brief (evidence: G-L1, G-P5, §10 blind spots).

Explicitly **not** recommended at current volumes (proportionality): statement-level trigger fan-out, coalescing at claim time, circuit breakers, global backoff, new queue technology, dead-letter table, per-provider rate limiters.

---

## PHASE 1 — DECISION GATE

Triggers from the brief checked:
- **Audit contradicts the prompt?** Partly material: the pipeline exists as described but has never functioned end to end (0 devices, 0 tickets, all-dispatcher-calls-404). Reported above; no silent reinterpretation.
- **Provider credential missing?** All VAPID/NOTIFY/PUSH env names present (values unread). `EXPO_ACCESS_TOKEN` absent everywhere (optional; note for deploy env audit). Cloudflare/Netlify runtime support for `web-push` NOT RUN — flagged.
- **New queue proposed?** No. `notifications`+`push_tickets` extended only.
- **Dispatcher correctness on three deploy targets?** Vercel verified (401 probe); Netlify timeout config unverified; Cloudflare `node:https` compatibility unverified (NOT RUN).
- **RLS/permission/authorization change needed?** Yes for G-S5 (`notifications_insert_authorized`) — reported, gated, and fully independent of Batches 1–3.

**→ STOPPED here per instructions. Implementation (Phase 2+) begins only on written approval of this audit.**

---

# IMPLEMENTATION RECORD (Phases 2–5, approved 2026-11-26)

## Migrations (Development `vlmxciuogczumumrwyot` only; additive; applied + recorded in `supabase_migrations.schema_migrations`)

| Migration | Contents | Rollback |
|---|---|---|
| `supabase/migrations/243_push_notifications_reliability_hardening.sql` | `push_devices.installation_id/vapid_version`; `push_tickets` per-(notification × device) delivery state for all providers (`provider`, `outcome`, nullable `ticket_id`, unique `(notification_id, device_id)`); `notifications.send_started_at/provider_accepted_at`; `register_push_device` v2 (provider derivation, SSRF/token validation, installation dedupe, per-user/platform cap 10 (`app.push_device_cap`) with LRU + redacted audit); `begin_push_send`; `claim_push_batch` v2 (canonical category CASE, TTL + shift-deadline expiry, per-device delivered guard, all-delivered completion, deadline-capped provider TTL); `finish_push_batch` v2 (`skip` outcome, per-device rows, mixed-outcome aggregation, jittered backoff); fast-path trigger includes `normal`; `push_receipts_poller` cron (15 min); `push_delivery_health` view | `supabase/rollbacks/243_rollback_push_notifications_reliability_hardening.sql` |
| `supabase/migrations/245_push_zero_pii_templates_and_user_deactivation.sql` | REG1/ENQ1 push bodies zero-PII; `trg_deactivate_push_devices_on_user_status` | `supabase/rollbacks/245_rollback_push_zero_pii_and_user_deactivation.sql` |

Migration-gate record: Dev history inspected before apply (latest recorded 241; next safe number 243 ✓); ordering verified; additive only; execution results verified post-apply (functions, columns, indexes, cron jobs, trigger, view all live); forward-recovery = rerun migration; rollback scripts provided. **Postgres gotcha fixed during testing:** unqualified `ttl_seconds` in `claim_push_batch` collided with the `RETURNS TABLE` out-parameter (42702) — all references qualified in the final migration. No RLS/grant/role changes (G-S5 remains gated — SQL below, unapplied).

## Code changes

- `apps/web/lib/notifications/web-push-client.ts` — `p_provider:'webpush'`, `p_installation_id`, `p_vapid_version` (fixes G-C1); web-push-client installation identity.
- `apps/mobile/lib/notifications/registerPush.ts` — `p_provider:'expo'`, `p_installation_id`; shared route allowlist via `@reachinternational/types` (G-S3 parity); foreground policy (banner only for critical/high); badge sync hooks.
- `apps/mobile/lib/notifications/badge.ts` (new) — badge ← `notification_unread_count` (G-P4).
- `apps/web/app/actions/auth.ts` — SEC1 enqueues via admin client (G-C2); logout deactivates the user's push devices (G-C9).
- `apps/web/lib/notifications/types.ts` — `PushOutcome += 'skip'`; `COLLAPSIBLE_CATEGORIES`.
- `apps/web/lib/notifications/send-all.ts` — kill switch → `skip` (G-C4); per-provider failure isolation (G-C5).
- `apps/web/lib/notifications/expo-sender.ts` — permanent/transient error mapping (G-C6); `collapseId` for reminders (verdict C); allowlisted link resolution.
- `apps/web/lib/notifications/webpush-sender.ts` — oversize/permanent → `skip` (G-C4/G-C6); allowlisted link.
- `apps/web/app/api/notify/dispatch/route.ts` — Zod body validation (G-S6); `begin_push_send` instrumentation (G-L1).
- `apps/web/app/api/notify/receipts/route.ts` — receipt `outcome` reconciliation.
- `apps/web/app/api/push/resubscribe/route.ts` (new) — cookie-authenticated SW re-registration.
- `apps/web/public/sw.js` — allowlist-validated click routing; `pushsubscriptionchange` keeps `applicationServerKey` + re-registers server-side (G-C8); update-policy comment.
- `apps/web/components/settings/SettingsClient.tsx` — in-app permission primer; denied/blocked guidance; iOS Home-Screen-web-app eligibility detection (Phase 3).
- `packages/types/src/pushNotifications.ts`, `packages/validation/src/pushNotifications.ts` (new) — push payload + route allowlist derived from the single registry (`Record<NotificationRouteKey,…>` — type-enforced completeness); consumed by senders, SW (parity-tested), mobile.
- `tests/push/test-push-hardening.mjs` (new, 24 checks) + registration in `scripts/run-all-tests.mjs`; mobile lifecycle suite updated to the new foreground policy + shared-registry allowlist.

## Gaps closed vs. verdicts

- **A (multi-device)** → per-device delivery records + delivered-guard + mixed-outcome aggregation: a sibling's success never cancels a retry; verified live (multi-device test).
- **B (concurrent dispatch)** → unchanged claim path, now verified live (two concurrent `claim_push_batch` calls, exactly one wins; attempts=1).
- **C (ambiguous acceptance)** → documented; `collapseId`/`Topic` in use; jittered backoff; permanent errors no longer retried; duplicates remain possible (documented, not exactly-once).
- **D (abandoned claims)** → lease reclaim + bounded attempts verified live; `push_delivery_health` exposes stuck queue; receipts poller scheduled.

## Gated (awaiting explicit approval — NOT applied)

**G-S5 RLS hardening** (`notifications_insert_authorized` allows supervisor+ to insert notification rows for arbitrary users — spoofed in-app/push spam):
```sql
-- Proposed (requires explicit approval; independent of all shipped changes):
DROP POLICY IF EXISTS notifications_insert_authorized ON public.notifications;
CREATE POLICY notifications_insert_authorized ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
-- Producers are unaffected (SECURITY DEFINER bypasses RLS); only client-side
-- cross-user inserts are removed. Verify supervisors relying on client inserts
-- (none found in codebase — all producers are DB triggers / admin-client actions).
```

## Verification results (2026-11-26)

| Check | Result |
|---|---|
| `pnpm typecheck` | **PASS** (7/7 packages) |
| `pnpm lint` | **PARTIAL** — 0 errors in all push/notification/settings/auth files; repo-wide: 155 pre-existing `react-hooks` rule errors in unrelated files, and full `eslint` invocation aborts (V8 OOM on Windows/Node 24) — both pre-existing, not introduced here |
| `pnpm check:type` | **PASS** (0 raw typography properties) |
| `pnpm test` | **PASS** 39/39 suites, incl. new hardening suite (24 negative/parity checks on live Dev) and all 6 existing push suites |
| `pnpm audit` | 28 pre-existing transitive vulnerabilities (2 low/13 mod/8 high/5 critical, node-forge via Expo CLI chains etc.); **zero new dependencies added** |
| Phase 6 real-device | **NOT RUN** — needs physical devices + credentials (steps in final report) |

## Environment notes (unchanged by design)

- Dev Vault `notify_url` still points at the 404ing `reachinternational.co.in/api/notify/dispatch`; the only verified live dispatcher is **production-wired** (`dashboard-reachinternational.vercel.app`, public bundle contains `dhbbgfzbyatzvqafnsqp`), so Dev must not call it. Fix = deploy a dev-wired dispatcher or run one locally with a tunnel; exact commands in the runbook + production checklist. Dev backlog (≈1.3k historical pending rows) intentionally untouched.
- Production database: **not queried, not modified** (authorization NOT granted). Production checklist delivered separately in the final report.
