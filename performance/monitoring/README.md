# ReachInternational Production Monitoring & Observability Runbook (Phase 19)

## 1. Overview
This directory contains observability standards, telemetry metrics, alert policies, dashboard layouts, and incident triage runbooks for ReachInternational (reachinternation.com).

## 2. Core Triaging Runbooks

### 🚨 Scenario 1: Sudden Spike in 5xx Server Errors
1. **Check Application Logs**: Filter by `level="ERROR"` in telemetry streams to identify unhandled exceptions and digest codes.
2. **Inspect Database Health**: Verify connection pool utilization in Supabase Dashboard and check for connection exhaustion.
3. **Verify Recent Deployments**: Compare `release` tags on error traces against the latest deployment commit.
4. **Action**: If unrecoverable errors correlate with the latest release, trigger immediate rollback using git deployment rollback protocol.

### ⚠️ Scenario 2: p95 / p99 Latency Degradation (> 100ms on Shift Submissions)
1. **Inspect Slow Routes**: Identify whether latency is isolated to `/operations` or spans all routes.
2. **Inspect Database Locks & Queries**: Check `pg_stat_activity` for long-running transactions or table locks on `machine_hour_logs`.
3. **Check Cache Invalidation Triggers**: Verify whether cache tags (`TAGS.machines`, `TAGS.clients`) are undergoing excessive eviction cycles.

### 🛑 Scenario 3: Database Connection Saturation (> 80% Pool)
1. **Identify Connection Leaks**: Check active long-lived client queries vs serverless connection pooling.
2. **Evaluate Report Jobs**: Check if concurrent heavy reports are holding database connections open.
3. **Action**: Scale PgBouncer pool limits or queue heavy export jobs.

### 🔄 Scenario 4: Node.js Memory Escalation
1. **Inspect Memory Growth**: Check heap memory trends across 1-hour windows.
2. **Review Realtime Subscriptions**: Ensure client websockets and subscriptions cleanly unsubscribe on unmount.
3. **Review Response Payloads**: Ensure no unbounded payloads or `SELECT *` queries were introduced.
