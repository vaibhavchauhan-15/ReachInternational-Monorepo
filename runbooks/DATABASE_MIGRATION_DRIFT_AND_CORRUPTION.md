# Incident: Database Migration Failure, Schema Drift & PostgREST Desync

## Purpose
This runbook provides emergency remediation procedures when a database SQL migration fails mid-execution, leaves table locks, causes PostgREST schema cache desynchronization, or creates schema drift between the repository migrations (`supabase/migrations/`) and the production database.

## Impact
- **Systems Affected**: Supabase PostgreSQL, PostgREST API Gateway, Server Actions, Next.js DAL, Row Level Security (RLS).
- **User Impact**: Specific features fail with PostgREST 404/400 errors. RPC calls such as `submit_operator_hour_log_atomic` or `get_machines_directory_summary` fail to execute.
- **Business Impact**: Machine directory searches fail, operator shift entries fail to commit, supervisor approvals break.

## Symptoms
- **Seed Verifier Failure**:
  ```bash
  pnpm verify:seed
  ```
  Reports missing relation or column errors (e.g. `Error: relation "public.machines" does not exist` or `column "client_id" does not exist`).
- **PostgREST Schema Cache Errors**:
  Next.js Server Actions or Mobile client queries fail with:
  ```text
  PGRST202: Could not find the function public.submit_operator_hour_log_atomic in the schema cache
  or:
  PGRST204: Could not find the 'client_id' column of 'machines' in the schema cache
  ```
- **RLS Accidental Lockout**:
  Authenticated queries return empty arrays (`[]`) unexpectedly due to a dropped or broken RLS policy.
- **Migration Lock Timeout**:
  Migration hangs on `ALTER TABLE` due to an unreleased exclusive lock on `machine_hour_logs` or `users`.

## Severity
**P0 / P1 (P0 if core RPCs broken globally; P1 if single column/feature drift)**

## Immediate Actions
1. **Halt Active Release Pipelines (< 2 min)** `[REQUIRES HUMAN APPROVAL]`:
   - In GitHub Actions, cancel `.github/workflows/deploy-web.yml` and EAS workflows to prevent deploying code expecting unapplied schema.
2. **Reload PostgREST Schema Cache (< 3 min)** `[REQUIRES HUMAN APPROVAL]`:
   - In Supabase SQL Editor:
     ```sql
     NOTIFY pgrst, 'reload schema';
     ```
3. **Verify RLS Status (< 5 min)** `[SAFE AUTOMATION]`:
   - Ensure RLS was not accidentally disabled:
     ```sql
     SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;
     ```

## Diagnosis
1. **Check Applied Migrations in Database** `[SAFE AUTOMATION]`:
   ```sql
   SELECT version, name, applied_at 
   FROM supabase_migrations.schema_migrations 
   ORDER BY version DESC 
   LIMIT 20;
   ```
   *Compare the highest version against the latest file in `supabase/migrations/` (e.g. `068_machine_directory_kpi_client_scoping.sql`).*
2. **Check Required Atomic RPC Functions** `[SAFE AUTOMATION]`:
   ```sql
   SELECT routine_name, routine_type, security_type
   FROM information_schema.routines
   WHERE routine_schema = 'public'
     AND routine_name IN (
       'submit_operator_hour_log_atomic',
       'get_machines_directory_summary',
       'get_users_aggregates'
     );
   ```
3. **Check for Lock Contentions on Target Tables** `[SAFE AUTOMATION]`:
   ```sql
   SELECT pid, mode, granted, query 
   FROM pg_locks l 
   JOIN pg_stat_activity a ON a.pid = l.pid 
   WHERE l.relation::regclass::text IN ('public.machines', 'public.machine_hour_logs', 'public.users');
   ```

## Recovery
1. **Replay Missing Migration SQL (Idempotent Apply)** `[REQUIRES HUMAN APPROVAL]`:
   - Manually execute the unapplied migration statements in Supabase SQL Editor:
     ```sql
     -- Example: Add missing column safely
     DO $$ 
     BEGIN 
       IF NOT EXISTS (
         SELECT 1 FROM information_schema.columns 
         WHERE table_schema = 'public' AND table_name = 'machines' AND column_name = 'client_id'
       ) THEN 
         ALTER TABLE public.machines ADD COLUMN client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
       END IF; 
     END $$;
     ```
2. **Register Migration in Schema Table** `[REQUIRES HUMAN APPROVAL]`:
   ```sql
   INSERT INTO supabase_migrations.schema_migrations (version, name, applied_at)
   VALUES ('068', '068_machine_directory_kpi_client_scoping', now())
   ON CONFLICT (version) DO NOTHING;
   ```
3. **Emergency RLS Re-Enforcement** `[REQUIRES HUMAN APPROVAL]`:
   ```sql
   ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.machine_hour_logs ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
   ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
   ```
4. **Force PostgREST Schema Reload** `[REQUIRES HUMAN APPROVAL]`:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```

## Validation
1. **Run Seed Verifier**:
   ```bash
   pnpm verify:seed
   ```
   *All 45+ tables must return `✅ Row Count: [N]`.*
2. **Run Workspace Typecheck**:
   ```bash
   pnpm typecheck
   ```
   *0 errors across all 9 packages.*
3. **Test RPC Directly in SQL Editor**:
   ```sql
   SELECT * FROM public.get_machines_directory_summary(NULL, NULL, NULL);
   ```
   *Must return valid summary JSON.*
4. **Health Check Probe**:
   ```bash
   curl -s "https://www.reachinternational.co.in/api/health?check=ready"
   ```
   *Must return HTTP 200 OK, `db: "healthy"`.*

## Rollback
- "No verified rollback mechanism found."  
  *(Production schema rollbacks MUST use forward-fixing idempotent SQL migrations. `DROP TABLE` and `DROP COLUMN` in production are strictly forbidden per monorepo release rules).*

## Escalation
- If exclusive table locks cannot be cleared and migrations timeout continuously, escalate to Lead DBA to terminate blocking sessions via `SELECT pg_terminate_backend(pid);`.
- If an unrecoverable schema corruption occurred, escalate to [`runbooks/DISASTER_RECOVERY_AND_RESTORE.md`](./DISASTER_RECOVERY_AND_RESTORE.md).

## Do Not
- **DO NOT** run destructive SQL drops (`DROP TABLE`, `DROP COLUMN`) in production.
- **DO NOT** manually delete rows from `supabase_migrations.schema_migrations` without DBA approval.
- **DO NOT** deploy frontend code until `NOTIFY pgrst, 'reload schema';` has completed.

## Root Cause Follow-Up
- Confirm all migrations in `supabase/migrations/` match `schema_migrations`.
- Confirm RLS is enabled on 100% of tables:
  ```sql
  SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false;
  ```
- Log resolution in `public.audit_logs`:
  ```sql
  INSERT INTO public.audit_logs (action, category, severity, details, created_at)
  VALUES ('SCHEMA_DRIFT_RESOLVED', 'system', 'HIGH', '{"reloaded_pgrst": true}', now());
  ```
- Complete postmortem in [`performance/monitoring/incidents.md`](../performance/monitoring/incidents.md).
