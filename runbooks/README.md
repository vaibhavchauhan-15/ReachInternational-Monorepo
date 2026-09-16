# ReachInternational Production Operations Runbooks

> **AUTHORITATIVE RECOVERY & INCIDENT TRIAGE GUIDES FOR REACHINTERNATIONAL**  
> *Target Domain: `https://www.reachinternational.co.in` | Database: Supabase PostgreSQL (`dhbbgfzbyatzvqafnsqp`)*  
> *This directory contains standard operating recovery runbooks for production on-call engineers, operators, and developers.*

---

## 1. Incident Severity Definitions & SLA Matrix

When declaring a production incident, assign a severity level immediately:

| Severity | Definition | Target Response SLA | Target Resolution (RTO) | Communication Channel |
| :--- | :--- | :--- | :--- | :--- |
| **P0 (Critical)** | Catastrophic outage. Web app down, database unreachable, operator shift submissions failing universally, or active data corruption. | < 5 minutes | < 30 minutes | Urgent phone bridge + Executive alert |
| **P1 (High)** | Major degraded state. Authentication failures, mobile app crashing on launch, migration locks, or critical role lockout (Admin/Supervisor). | < 15 minutes | < 2 hours | Eng-Incidents slack/chat + Team ping |
| **P2 (Medium)** | Non-blocking service degradation. Transactional email delays (SendGrid), WhatsApp alert queue lag (Twilio), single machine log overlap. | < 1 hour | < 6 hours | Operations issue tracker |
| **P3 (Low)** | Minor cosmetic or non-critical anomaly. Stale cache on reports, minor export formatting glitch, individual rate limit edge case. | Next business day | Next release cycle | Backlog ticket |

---

## 2. On-Call Incident Commander 5-Minute Checklist

When a production incident alert triggers or an operational failure is reported:

1. **Acknowledge & Triage (< 2 min)**:
   - Identify affected surface: Web (`apps/web`), Mobile (`apps/mobile`), Database (`supabase`), or External Service.
   - Run health probe:
     ```bash
     curl -i "https://www.reachinternational.co.in/api/health?check=ready"
     ```
   - Classify severity (P0, P1, P2, P3).

2. **Halt Harmful Pipelines (< 3 min)**:
   - If incident follows a new deployment: Halt active release pipelines in GitHub Actions.
   - If database write corruption is occurring: Identify blocking query or isolate client mutations.

3. **Open Dedicated Runbook (< 5 min)**:
   - Match symptoms against the runbook index below and execute the **Immediate Containment** section.

4. **Communicate & Log**:
   - Record incident initiation in internal communications.
   - All elevated mitigation actions MUST be recorded in the postmortem template located at [`performance/monitoring/incidents.md`](../performance/monitoring/incidents.md).

---

## 3. Runbook Directory Index

| Runbook | Severity | Affected Components | Primary Symptoms & Recovery Trigger |
| :--- | :---: | :--- | :--- |
| [**SECURITY_BREACH_AND_SECRET_EXPOSURE.md**](./SECURITY_BREACH_AND_SECRET_EXPOSURE.md) | **P0** | Supabase Auth, Service Role Key, Vercel Secrets | Master service-role secret leaked in client bundle or git, credential compromise, emergency key rotation, session revocation. |
| [**DATABASE_OUTAGE_AND_POOL_EXHAUSTION.md**](./DATABASE_OUTAGE_AND_POOL_EXHAUSTION.md) | **P0** | Supabase Postgres, PgBouncer, Web DAL | DB connection saturation (> 85%), statement timeout (> 10s), `/api/health?check=ready` returns 503 degraded. |
| [**DISASTER_RECOVERY_AND_RESTORE.md**](./DISASTER_RECOVERY_AND_RESTORE.md) | **P0** | Complete Monorepo & Supabase Cloud | Catastrophic database loss or mass deletion; executing Point-in-Time Recovery (PITR), verifying table seed counts, smoke testing. |
| [**MOBILE_EAS_AND_OTA_CRASH_RECOVERY.md**](./MOBILE_EAS_AND_OTA_CRASH_RECOVERY.md) | **P0 / P1** | Expo React Native, EAS, Android 15 | Faulty EAS OTA update crashes mobile app on boot, Android 15 edge-to-edge/Safe Area crash, emergency OTA rollback. |
| [**DATABASE_MIGRATION_DRIFT_AND_CORRUPTION.md**](./DATABASE_MIGRATION_DRIFT_AND_CORRUPTION.md) | **P0 / P1** | Supabase Migrations, RPCs, RLS | Migration fails mid-run, broken RPC contracts (`submit_operator_hour_log_atomic`), `pnpm verify:seed` table mismatch. |
| [**AUTH_PROXY_AND_SESSION_FAILURE.md**](./AUTH_PROXY_AND_SESSION_FAILURE.md) | **P1** | Edge Proxy (`proxy.ts`), Supabase SSR Auth | Supabase Auth HTTP 429 rate limit, internal HMAC token signature mismatch (`signInternalUser`), `/login` redirect loops. |
| [**VERCEL_WEB_DEPLOYMENT_FAILURE.md**](./VERCEL_WEB_DEPLOYMENT_FAILURE.md) | **P1** | Next.js 16, Vercel, Turborepo | Vercel production build compilation failure, `guard-build.js` process collision, corrupted `.next` cache, instant SHA rollback. |
| [**RATE_LIMIT_LOCKOUT_AND_LPDOS_INCIDENT.md**](./RATE_LIMIT_LOCKOUT_AND_LPDOS_INCIDENT.md) | **P1** | Edge Rate Limiter, `proxy.ts` | Legitimate office IP or users receiving HTTP 429 "Too Many Requests", active brute-force attack or LPDoS assault mitigation. |
| [**DATA_DISCREPANCY_AND_LOG_OVERLAP.md**](./DATA_DISCREPANCY_AND_LOG_OVERLAP.md) | **P1 / P2** | Machine Hour Logs, Shift Triggers | Operator shift rejected with "Shift overlaps with existing log" or meter reading discontinuity; atomic RPC sequence reconciliation. |
| [**EXTERNAL_SERVICES_DEGRADATION.md**](./EXTERNAL_SERVICES_DEGRADATION.md) | **P2** | SendGrid, Twilio, Upstash QStash | SendGrid email quota exceeded / API rejection, Twilio WhatsApp template rejection, QStash cron trigger failure. |
| [**STORAGE_BUCKET_AND_UPLOAD_FAILURE.md**](./STORAGE_BUCKET_AND_UPLOAD_FAILURE.md) | **P2** | Supabase Storage, Media Manager | 403 Forbidden on bucket uploads, signed URL expiry, photo upload rejection for machine/FSR records in `apps/mobile/lib/media.ts`. |

---

## 4. AI Agent Safety Protocol & Operational Boundaries

AI agents consulting or operating alongside these runbooks must strictly distinguish between **SAFE AUTOMATION** and operations that **REQUIRE HUMAN APPROVAL**. Under no circumstances should an AI agent autonomously execute high-risk, state-altering operations without explicit human authorization.

### Safe Automation (Autonomous Execution Permitted)
AI agents may autonomously execute non-destructive diagnostic, verification, and inspection tasks:
- Running read-only health probes (`curl /api/health`, `curl /api/health?check=ready`).
- Executing read-only database diagnostics (`SELECT count(*) ...`, `EXPLAIN ANALYZE`, inspecting `pg_stat_activity`).
- Running local static analysis, typechecking (`pnpm typecheck`), and verification test suites (`node apps/mobile/run-tests.mjs`).
- Inspecting build artifacts, serverless execution logs, and deployment histories.
- Drafting incident reports, diagnostic summaries, and proposed configuration or code patches.

### Requires Human Approval (Strict Human Gate Required)
The following high-risk operations **MUST NOT** be executed autonomously by any AI agent and require explicit, documented human approval from the Incident Commander or designated lead:
1. **Data Restoration & Destructive Operations**:
   - Initiating Supabase Point-in-Time Recovery (PITR) or restoring production databases.
   - Deleting, truncating, or mass-updating production records in `public.users`, `public.machines`, or `public.machine_hour_logs`.
   - Terminating active PostgreSQL query processes (`SELECT pg_terminate_backend(...)`).
2. **Credential & Access Control Alterations**:
   - Rolling or rotating `SUPABASE_SECRET_KEY`, `SENDGRID_API_KEY`, `TWILIO_AUTH_TOKEN`, or `CRON_SECRET`.
   - Mass-invalidating active user sessions in `auth.sessions` or `auth.refresh_tokens`.
   - Modifying Row Level Security (RLS) policies or granting elevated roles (`super_admin`).
3. **Infrastructure & Release State**:
   - Rolling back or promoting production deployments on Vercel or Google Play Console.
   - Republishing emergency EAS OTA updates to mobile production channels.
   - Altering Vercel Edge Firewall rules, Upstash rate limits, or IP allowlists.
   - Force-pushing (`git push --force`) or rewriting repository history.
   - Bypassing pre-build safety guards (`SKIP_BUILD_GUARD=1`).

---

## 5. Emergency Contacts & Escalation Order

1. **Lead Database Administrator / Supabase Owner**: Escalation for PostgreSQL pool saturation, migration locks, or PITR recovery.
2. **Platform & DevOps Lead (Vercel / GitHub Actions)**: Escalation for production edge proxy failures, Vercel deployment blockers, or WAF rate limiting.
3. **Mobile & Field Operations Lead (Expo / EAS)**: Escalation for Play Store release blocks or emergency EAS OTA update rollbacks.
4. **Operations Supervisor**: Escalation for operator shift logging anomalies or emergency machine reassignment.

---

## 6. Related Production Documentation

- **Incident Postmortem Standard**: [`performance/monitoring/incidents.md`](../performance/monitoring/incidents.md)
- **Monitoring & Metrics Reference**: [`performance/monitoring/metrics.md`](../performance/monitoring/metrics.md)
- **Production Alert Policies**: [`performance/monitoring/alerts.md`](../performance/monitoring/alerts.md)
- **Authoritative Deployment Policy**: [`brain/RULES/DEPLOYMENT-DEVOPS-RELEASE.md`](../brain/RULES/DEPLOYMENT-DEVOPS-RELEASE.md)
- **Observability & Audit Rules**: [`brain/RULES/OBSERVABILITY-MONITORING-LOGGING.md`](../brain/RULES/OBSERVABILITY-MONITORING-LOGGING.md)
- **Database Seed Verifier**: Run `pnpm verify:seed` (`node supabase/verify_seed.mjs`)
