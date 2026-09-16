# ReachInternational Production Monitoring & Observability Runbook (Phase 19)

## 1. Overview
This directory contains observability standards, telemetry metrics, alert policies, dashboard layouts, and incident triage runbooks for ReachInternational (reachinternation.com).

## 2. Core Triaging Runbooks

For comprehensive, step-by-step incident recovery guides, consult the authoritative [`runbooks/`](../../runbooks/) directory:

### 🚨 Scenario 1: Sudden Spike in 5xx Server Errors
1. **Check Application Logs**: Filter by `level="ERROR"` in telemetry streams to identify unhandled exceptions and digest codes.
2. **Inspect Database Health**: Verify connection pool utilization in Supabase Dashboard and check for connection exhaustion.
3. **Verify Recent Deployments**: Compare `release` tags on error traces against the latest deployment commit.
4. **Action**: Follow [`runbooks/VERCEL_WEB_DEPLOYMENT_FAILURE.md`](../../runbooks/VERCEL_WEB_DEPLOYMENT_FAILURE.md) to trigger instant rollback if correlated with a new release.

### ⚠️ Scenario 2: p95 / p99 Latency Degradation (> 100ms on Shift Submissions)
1. **Inspect Slow Routes**: Identify whether latency is isolated to `/operations` or spans all routes.
2. **Inspect Database Locks & Queries**: Check `pg_stat_activity` for long-running transactions or table locks on `machine_hour_logs`.
3. **Check Cache Invalidation Triggers**: Verify whether cache tags (`TAGS.machines`, `TAGS.clients`) are undergoing excessive eviction cycles.
4. **Action**: Follow [`runbooks/DATABASE_OUTAGE_AND_POOL_EXHAUSTION.md`](../../runbooks/DATABASE_OUTAGE_AND_POOL_EXHAUSTION.md) for detailed locking and query diagnostics.

### 🛑 Scenario 3: Database Connection Saturation (> 80% Pool)
1. **Identify Connection Leaks**: Check active long-lived client queries vs serverless connection pooling.
2. **Evaluate Report Jobs**: Check if concurrent heavy reports are holding database connections open.
3. **Action**: Follow [`runbooks/DATABASE_OUTAGE_AND_POOL_EXHAUSTION.md`](../../runbooks/DATABASE_OUTAGE_AND_POOL_EXHAUSTION.md) to scale PgBouncer pool limits or terminate blocking backends.

### 🔄 Scenario 4: Node.js Memory Escalation
1. **Inspect Memory Growth**: Check heap memory trends across 1-hour windows.
2. **Review Realtime Subscriptions**: Ensure client websockets and subscriptions cleanly unsubscribe on unmount.
3. **Review Response Payloads**: Ensure no unbounded payloads or `SELECT *` queries were introduced.
4. **Action**: Follow [`runbooks/RATE_LIMIT_LOCKOUT_AND_LPDOS_INCIDENT.md`](../../runbooks/RATE_LIMIT_LOCKOUT_AND_LPDOS_INCIDENT.md) if memory escalation correlates with abusive request floods.

---

## 3. Dedicated Runbook Index

See [`runbooks/README.md`](../../runbooks/README.md) for the complete P0–P2 operational recovery directory.
