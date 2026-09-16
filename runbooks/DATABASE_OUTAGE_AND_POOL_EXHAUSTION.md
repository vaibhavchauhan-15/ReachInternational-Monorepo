# Incident: Database Outage, Connection Saturation & Query Statement Timeout

## Purpose
This runbook provides rapid diagnostic and recovery procedures when the primary Supabase PostgreSQL database (`dhbbgfzbyatzvqafnsqp`) becomes unreachable, experiences PgBouncer connection pool exhaustion, or suffers from query locks triggering statement timeouts.

## Impact
- **Systems Affected**: Supabase PostgreSQL, PgBouncer Pool, Next.js Server Components, Server Actions, Mobile App.
- **User Impact**: Universal failure across Web and Mobile. Operators cannot submit daily shift logs, managers cannot view machine directories, and dashboard KPI cards fail to load.
- **Business Impact**: Complete field operations recording halt.

## Symptoms
- **Readiness Probe Failure**:
  ```bash
  curl -s "https://www.reachinternational.co.in/api/health?check=ready"
  ```
  Returns HTTP 503 with `{ "status": "degraded", "db": "unhealthy" }` or `{ "status": "error", "db": "unavailable" }`.
- **Postgres Statement Timeout (Error 57014)**:
  Server logs output:
  ```text
  canceling statement due to statement timeout (timeout: 10000ms)
  ```
  *(Migration `014_set_statement_timeouts_and_dos_guards.sql` enforces a 10s statement timeout).*
- **PgBouncer Pool Exhaustion**:
  Server Actions throw:
  ```text
  FATAL: remaining connection slots are reserved for non-replication superuser connections
  or: connection pool exhausted / timeout acquiring client connection
  ```
- **UI Error Boundaries**:
  Web app displays `<AppError>` boundary with digest code; mobile app displays offline/network retry banners.

## Severity
**P0 (Critical)**

## Immediate Actions
1. **Probe Database Latency Directly (< 2 min)** `[SAFE AUTOMATION]`:
   ```bash
   curl -w "\nHTTP_STATUS: %{http_code}\nTIME_TOTAL: %{time_total}s\n" \
     "https://www.reachinternational.co.in/api/health?check=ready"
   ```
2. **Access Supabase Dashboard (< 3 min)**:
   - Log into [Supabase Console](https://supabase.com/dashboard/project/dhbbgfzbyatzvqafnsqp) -> **Database**.
3. **Terminate Long-Running Blocking Backends (< 5 min)** `[REQUIRES HUMAN APPROVAL]`:
   - If a specific query is blocking traffic, execute termination in SQL editor.

## Diagnosis
1. **Inspect Active Connections and Query Durations** `[SAFE AUTOMATION]`:
   ```sql
   SELECT 
     pid,
     usename,
     client_addr,
     state,
     wait_event_type,
     wait_event,
     now() - query_start AS duration,
     query
   FROM pg_stat_activity
   WHERE state != 'idle'
     AND pid != pg_backend_pid()
   ORDER BY duration DESC;
   ```
2. **Identify Blocked Transactions & Lock Chains** `[SAFE AUTOMATION]`:
   ```sql
   SELECT 
     blocked_locks.pid     AS blocked_pid,
     blocked_activity.usename  AS blocked_user,
     blocking_locks.pid    AS blocking_pid,
     blocking_activity.usename AS blocking_user,
     blocked_activity.query    AS blocked_statement,
     blocking_activity.query   AS blocking_statement
   FROM  pg_catalog.pg_locks         blocked_locks
   JOIN pg_catalog.pg_stat_activity blocked_activity 
     ON blocked_activity.pid = blocked_locks.pid
   JOIN pg_catalog.pg_locks         blocking_locks 
     ON blocking_locks.locktype = blocked_locks.locktype
     AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
     AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
     AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
     AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
     AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
     AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
     AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
     AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
     AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
     AND blocking_locks.pid != blocked_locks.pid
   JOIN pg_catalog.pg_stat_activity blocking_activity 
     ON blocking_activity.pid = blocking_locks.pid
   WHERE NOT blocked_locks.granted;
   ```
3. **Detect `idle in transaction` Connections** `[SAFE AUTOMATION]`:
   ```sql
   SELECT 
     pid, 
     usename, 
     now() - state_change AS idle_duration,
     query
   FROM pg_stat_activity
   WHERE state = 'idle in transaction'
     AND now() - state_change > interval '10 seconds';
   ```

## Recovery
1. **Cancel or Terminate Blocking Backends** `[REQUIRES HUMAN APPROVAL]`:
   ```sql
   -- Graceful cancellation
   SELECT pg_cancel_backend(<BLOCKING_PID>);

   -- Force termination if unresponsive after 5 seconds
   SELECT pg_terminate_backend(<BLOCKING_PID>);
   ```
2. **Mass-Terminate All Backends Exceeding 30 Seconds** `[REQUIRES HUMAN APPROVAL]`:
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state != 'idle'
     AND pid != pg_backend_pid()
     AND now() - query_start > interval '30 seconds';
   ```
3. **Clear `idle in transaction` Connections** `[REQUIRES HUMAN APPROVAL]`:
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle in transaction'
     AND now() - state_change > interval '15 seconds';
   ```
4. **Restart PgBouncer Pooler (if pool is frozen)** `[REQUIRES HUMAN APPROVAL]`:
   - In Supabase Dashboard -> **Settings** -> **Database** -> **Connection Pooling Configuration**.
   - Restart the pooler service or scale pool limit from 15 to 25 connections during high-load shift hours.

## Validation
1. **Verify Health Endpoint Latency**:
   ```bash
   curl -i "https://www.reachinternational.co.in/api/health?check=ready"
   ```
   *Must return HTTP 200 OK with `status: "ok"`, `db: "healthy"`, and `dbLatencyMs: < 50`.*
2. **Verify Database Table Integrity**:
   ```bash
   pnpm verify:seed
   ```
   *All 45+ tables must report `✅ Row Count: [N]` without connection timeouts.*
3. **Verify Machine Directory RPC Performance**:
   ```sql
   EXPLAIN ANALYZE
   SELECT * FROM public.get_machines_directory_summary(NULL, NULL, NULL);
   ```
   *Must execute in under 15ms.*

## Rollback
- "No verified rollback mechanism found."  
  *(Terminating a hung query or clearing the connection pool is a live state reset that cannot be rolled back; transactions that were canceled roll back automatically via PostgreSQL ACID guarantees).*

## Escalation
- If connections cannot be terminated and database CPU remains at 100%, contact Supabase Enterprise Support to restart the primary Postgres container instance.
- If data corruption or table drop occurred during the lock contention, escalate to [`runbooks/DISASTER_RECOVERY_AND_RESTORE.md`](./DISASTER_RECOVERY_AND_RESTORE.md) for PITR restoration.

## Do Not
- **DO NOT** restart the entire database cluster without attempting query cancellation first.
- **DO NOT** disable statement timeouts (`SET statement_timeout = 0`) globally in production.
- **DO NOT** run unindexed `SELECT *` queries across the full `machine_hour_logs` table while diagnosing.

## Root Cause Follow-Up
- Audit recent migrations for missing indexes (review migrations `066` and `067`).
- Check if Next.js Server Components are bypassing cache due to an invalidation loop.
- Log resolution in `public.audit_logs`:
  ```sql
  INSERT INTO public.audit_logs (action, category, severity, details, created_at)
  VALUES ('DATABASE_OUTAGE_RESOLVED', 'system', 'CRITICAL', '{"pool_restarted": true}', now());
  ```
- File incident postmortem in [`performance/monitoring/incidents.md`](../performance/monitoring/incidents.md).
