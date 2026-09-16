# Incident: Catastrophic Database Loss, Corruption & Point-in-Time Recovery (PITR)

## Purpose
This runbook provides step-by-step restoration procedures for catastrophic data loss, accidental mass deletion, or severe database corruption using Supabase automated Point-in-Time Recovery (PITR) and physical WAL archives.

## Impact
- **Systems Affected**: Entire ReachInternational platform, Supabase PostgreSQL, Vercel Web, Expo Mobile.
- **User Impact**: Total operational downtime or critical data loss across machines, shift records, client accounts, or user profiles.
- **Business Impact**: Severe operational and legal risk if historical machinery maintenance and shift records are permanently destroyed.

## Symptoms
- **Table Missing or Truncated**: Queries fail with `relation "public.machines" does not exist` or tables return 0 rows unexpectedly.
- **Critical Seed Verifier Failure**:
  ```bash
  pnpm verify:seed
  ```
  Reports `Row Count: 0` across core operational tables.
- **Unconstrained Mutation Discovered**: Accidental `UPDATE` or `DELETE` statement without a `WHERE` clause executed on `machine_hour_logs` or `users`.

## Severity
**P0 (Critical Disaster)**

## Immediate Actions
1. **Halt Mutation Traffic Immediately (< 2 min)** `[REQUIRES HUMAN APPROVAL]`:
   - Prevent dirty writes during restoration by enabling maintenance mode in Vercel Project Settings:
     ```text
     NEXT_PUBLIC_MAINTENANCE_MODE=true
     ```
   - Cancel all active GitHub Actions release pipelines.
2. **Determine Incident Timestamp ($T_{incident}$) (< 5 min)** `[SAFE AUTOMATION]`:
   - Query `public.audit_logs` or activity logs to determine the exact timestamp before the destructive event occurred:
     $$\text{Target PITR Timestamp} = T_{incident} - 2\text{ minutes}$$
3. **Notify Executive & Technical Leadership**:
   - Declare P0 Disaster Recovery incident.

## Diagnosis
1. **Query Audit Log for Destruction Timestamp** `[SAFE AUTOMATION]`:
   ```sql
   SELECT action, created_at, actor_name, details 
   FROM public.audit_logs 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```
2. **Assess Extent of Data Loss** `[SAFE AUTOMATION]`:
   ```sql
   SELECT 
     (SELECT count(*) FROM public.machines) AS machine_count,
     (SELECT count(*) FROM public.machine_hour_logs) AS log_count,
     (SELECT count(*) FROM public.users) AS user_count,
     (SELECT count(*) FROM public.clients) AS client_count;
   ```
3. **Verify PITR Archive Range in Supabase Console** `[SAFE AUTOMATION]`:
   - Navigate to [Supabase Console](https://supabase.com/dashboard/project/dhbbgfzbyatzvqafnsqp) -> **Settings** -> **Database** -> **Backups** -> Verify PITR continuous archiving status covers the target timestamp.

## Recovery
1. **Execute Point-in-Time Recovery (PITR)** `[REQUIRES HUMAN APPROVAL]`:
   - In Supabase Dashboard -> **Database** -> **Backups** -> **Point-in-Time Recovery**.
   - Select **Restore to a point in time**.
   - Enter the target UTC timestamp ($T_{incident} - 2\text{ min}$).
   - Click **Confirm Restore** (Restoration duration: 15–30 minutes).
2. **Update Platform Credentials (if restored to a new project ref)** `[REQUIRES HUMAN APPROVAL]`:
   - If Supabase provisions a new project ref during restore:
   - In Vercel Project Settings -> **Environment Variables**: Update `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`.
   - In `apps/mobile/eas.json`: Update `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. **Refresh PostgREST Schema Cache** `[REQUIRES HUMAN APPROVAL]`:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```

## Validation
1. **Execute Monorepo Seed Verification**:
   ```bash
   pnpm verify:seed
   ```
   *All 45+ tables must report healthy, non-zero row counts (`✅ Row Count: [N]`).*
2. **Execute Health Probe**:
   ```bash
   curl -i "https://www.reachinternational.co.in/api/health?check=ready"
   ```
   *Must return HTTP 200 OK, `status: "ok"`, `db: "healthy"`, `dbLatencyMs: < 50`.*
3. **Verify Workspace Typecheck**:
   ```bash
   pnpm typecheck
   ```
   *Must pass with 0 errors across all 9 packages.*
4. **Verify Mobile Test Suite**:
   ```bash
   node apps/mobile/run-tests.mjs
   ```
   *All 18/18 scenarios must pass.*
5. **Live Smoke Test**:
   - Log into web app as administrator. Verify machines on `/machines` and logs on `/operations`.

## Rollback
- "No verified rollback mechanism found."  
  *(A PITR database restore overwrites the current database instance state with the historical snapshot. If the restored point was chosen incorrectly, initiate another PITR restoration targeting a different timestamp within the backup retention window).*

## Escalation
- If PITR restoration fails in the Supabase console, immediately engage Supabase Critical Support through the Enterprise Support Portal.

## Do Not
- **DO NOT** execute manual `DROP TABLE` or `CREATE TABLE` scripts during recovery (this invalidates WAL logs).
- **DO NOT** restore production traffic before `pnpm verify:seed` reports complete table counts.
- **DO NOT** delete the pre-incident database without dumping a forensic snapshot.

## Root Cause Follow-Up
- Re-disable maintenance mode in Vercel (`NEXT_PUBLIC_MAINTENANCE_MODE=false`) and redeploy.
- Re-verify Row Level Security across all tables:
  ```sql
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;
  ```
- Record recovery entry in `public.audit_logs`:
  ```sql
  INSERT INTO public.audit_logs (action, category, severity, details, created_at)
  VALUES ('DISASTER_RECOVERY_COMPLETED', 'system', 'CRITICAL', '{"pitr_restored": true}', now());
  ```
- Conduct full blameless postmortem within 48 hours using [`performance/monitoring/incidents.md`](../performance/monitoring/incidents.md).
