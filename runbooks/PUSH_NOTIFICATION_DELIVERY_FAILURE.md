# Runbook: Push Notification Delivery Failure (Web Push + Expo)

> **Severity:** P1 (silent notification loss) · **Components:** `public.notifications` outbox, pg_net/pg_cron, `/api/notify/dispatch`, Web Push (VAPID + `sw.js`), Expo Push Service
> **Architecture reference:** [`../NOTIFICATIONS.md`](../NOTIFICATIONS.md) · **Audit record:** [`../AI/FEATURES/push-notifications.md`](../AI/FEATURES/push-notifications.md)

---

## 1. Symptoms

- Users report no push with the browser tab / app closed (in-app inbox still works).
- `push_delivery_health.queue_depth` growing; `oldest_pending_seconds` climbing.
- `net._http_response` filled with non-2xx responses from the dispatcher.
- Devices disappearing (`disabled_reason` in `push_devices`).

## 2. 5-Minute Triage

```sql
-- 1. Queue health (service_role / SQL editor)
SELECT * FROM public.push_delivery_health;

-- 2. Is the database reaching the dispatcher at all?
SELECT status_code, timed_out, count(*), max(created)
  FROM net._http_response GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 10;

-- 3. Vault wiring (URL must target the dispatcher wired to THIS database)
SELECT name, substring(decrypted_secret from '^https?://[^/]+') FROM vault.decrypted_secrets
 WHERE name IN ('notify_url', 'notify_secret');
```

```bash
# 4. Dispatcher alive? (expect 401 with a wrong bearer — 404 means wrong URL/deployment)
curl -i -X POST "$NOTIFY_URL" -H "Authorization: Bearer <probe>" -H "Content-Type: application/json" -d '{}'
```

| Finding | Diagnosis | Fix |
| --- | --- | --- |
| All `net._http_response` are 404 | **Wrong `notify_url`** (silent failure mode) | Set the Vault URL to the deployment that serves this database (§4) |
| 401 from the dispatcher | `notify_secret` ≠ deployment `NOTIFY_SECRET` | Re-sync the Vault secret with the server env |
| 500 `Failed to claim push batch` | RPC drift / migration missing | Re-apply `supabase/migrations/243_...` (see DATABASE_MIGRATION_DRIFT runbook) |
| Queue drains but no delivery | `PUSH_ENABLED !== 'true'` or devices inactive | Check env kill switch; inspect `push_devices.disabled_reason` |
| `tickets_pending_receipt` grows | receipts poller not running | Verify cron job `push_receipts_poller` exists and the `/api/notify/receipts` route responds |
| Many `DeviceNotRegistered` | Expected churn (uninstalls) | Devices auto-deactivate; verify re-registration after reinstall |

## 3. Delivery Semantics Cheat-Sheet

- Claim: `claim_push_batch` — atomic (`FOR UPDATE SKIP LOCKED`), 2-minute lease on `sending`, max 5 attempts → `failed`.
- Ambiguous provider outcomes (timeout after possible acceptance) are retried → **duplicates possible**; suppressed best-effort via Expo `collapseId`, Web Push `Topic`, and client `nid` dedupe. Never promise exactly-once.
- A device that already accepted (`push_tickets.outcome='accepted'`) is never re-sent to on retry.
- Expired notifications (`ttl_seconds`, shift-lock deadline) are `skipped`, never dispatched.
- Quiet hours defer (IST), never drop. Critical/security bypass suppression. In-app rows are preserved regardless of push outcome.

## 4. Vault URL Rules (per environment)

- The dispatcher runs wherever the web app is deployed (`/api/notify/dispatch`, Node runtime).
- **`notify_url` must point at the deployment whose Supabase credentials target the same database** as the database issuing the call. Cross-wiring a Dev database to a production dispatcher will drive production delivery — never do it.
- Update (SQL editor / Management API on the correct project):
  ```sql
  SELECT vault.update_secret('notify_url', 'https://<dispatcher-host>/api/notify/dispatch');
  SELECT vault.update_secret('notify_secret', '<NOTIFY_SECRET of that deployment>');
  ```

## 5. VAPID Key Rotation

1. Generate a new pair (`npx web-push generate-vapid-details`); set `VAPID_PRIVATE_KEY` + `NEXT_PUBLIC_VAPID_PUBLIC_KEY` in the deployment env.
2. Update the public key constant in `apps/web/public/sw.js` (`VAPID_PUBLIC_KEY`) in the same release (parity test reminds you).
3. Deploy. Existing subscriptions continue to deliver; browsers whose subscription dies re-subscribe via `pushsubscriptionchange` → `/api/push/resubscribe`.
4. `push_devices.vapid_version` records which key each subscription used. Never change keys during a routine service-worker-only update.

## 6. Device Deactivation Reasons

| `disabled_reason` | Meaning | Action |
| --- | --- | --- |
| `logout` / `user_<status>` | Deactivated on logout / account deactivation | Re-registration on next login reactivates |
| `superseded_token` | Same installation registered a new token | None (by design) |
| `device_cap_lru` | Per-user cap eviction (least-recently-seen) | None; audit event `push.device_cap_lru_deactivated` |
| `DeviceNotRegistered` / `WebPush404` / `WebPush410` | Provider says endpoint/token is gone | None (by design) |
| `consecutive_failures` | 5 consecutive send failures | Investigate provider errors before user re-registers |

## 7. Escalation

- Provider outages (FCM/APNs/Expo/Web Push services): see [`EXTERNAL_SERVICES_DEGRADATION.md`](./EXTERNAL_SERVICES_DEGRADATION.md); the in-app inbox is unaffected.
- Suspected secret exposure (`NOTIFY_SECRET`, `VAPID_PRIVATE_KEY`): [`SECURITY_BREACH_AND_SECRET_EXPOSURE.md`](./SECURITY_BREACH_AND_SECRET_EXPOSURE.md).
- Queue health should be checked as part of [`DATABASE_OUTAGE_AND_POOL_EXHAUSTION.md`](./DATABASE_OUTAGE_AND_POOL_EXHAUSTION.md) triage when push symptoms accompany general DB issues.
