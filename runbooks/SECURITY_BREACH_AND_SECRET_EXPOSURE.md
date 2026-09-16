# Incident: Security Breach, Credential Leakage & Master Secret Exposure

## Purpose
This runbook provides emergency containment, revocation, key rotation, and post-breach audit procedures when sensitive credentials (specifically `SUPABASE_SECRET_KEY`, `SENDGRID_API_KEY`, `TWILIO_AUTH_TOKEN`, or admin sessions) are leaked, compromised, or exposed.

## Impact
- **Systems Affected**: Supabase PostgreSQL (`dhbbgfzbyatzvqafnsqp`), Supabase Auth, Vercel Production Environment, Git repository.
- **User Impact**: Total potential compromise of Row Level Security (RLS) if `SUPABASE_SECRET_KEY` is exposed. Attackers can execute arbitrary SQL queries, modify machine hour logs, or view confidential employee documents.
- **Business Impact**: Unauthorized machine reassignment, tampering with fleet operational logs, and data exfiltration.

## Symptoms
- **Secret Scanner Alerts**: GitHub Secret Scanning, GitGuardian, or TruffleHog alert triggering on active tokens.
- **Triage Reporting Protocol**: Never reproduce or copy raw secret values in incident reports, tickets, or chat; state strictly: `Potential secret exposure detected in <file/path>`.
- **Client Bundle Leakage**: `SUPABASE_SECRET_KEY` detected in `.next/static/**` client JavaScript bundles due to an accidental `NEXT_PUBLIC_` or `EXPO_PUBLIC_` prefix.
- **Audit Log Anomalies**: High-severity records in `public.audit_logs` showing unauthorized updates, role escalations (`role = 'super_admin'`), or deletions originating from unexpected IP addresses.
- **Unauthorized Role Changes**: Unexpected user accounts elevated to `super_admin` in `public.users`.

## Severity
**P0 (Critical)**

## Immediate Actions
1. **Rotate Leaked Credential Immediately (< 2 min)** `[REQUIRES HUMAN APPROVAL]`:
   - Do NOT attempt to rewrite git history before rotating the active key!
   - In [Supabase Dashboard](https://supabase.com/dashboard/project/dhbbgfzbyatzvqafnsqp) -> **Project Settings** -> **API** -> Click **Roll Key** under `service_role (secret)`.
   - *This immediately invalidates the compromised key across all Supabase API gateways.*
2. **Invalidate Active Sessions (< 3 min)** `[REQUIRES HUMAN APPROVAL]`:
   - If user credentials or JWT tokens were leaked, terminate all active sessions in the SQL Editor:
     ```sql
     DELETE FROM auth.sessions;
     DELETE FROM auth.refresh_tokens;
     ```
3. **Notify On-Call Leads**:
   - Alert Head of Engineering and Database Administrator.

## Diagnosis
1. **Inspect Audit Trail for Unauthorized Administrative Actions** `[SAFE AUTOMATION]`:
   ```sql
   SELECT 
     id,
     user_id,
     actor_name,
     actor_role,
     action,
     severity,
     ip_address,
     created_at,
     details
   FROM public.audit_logs
   WHERE severity IN ('CRITICAL', 'HIGH')
      OR action LIKE '%ADMIN%'
      OR action LIKE '%ROLE%'
   ORDER BY created_at DESC 
   LIMIT 50;
   ```
2. **Inspect User Profiles for Unauthorized Escalations** `[SAFE AUTOMATION]`:
   ```sql
   SELECT id, email, full_name, role, status, updated_at
   FROM public.users
   WHERE role IN ('super_admin', 'admin')
   ORDER BY updated_at DESC;
   ```
3. **Scan Git Commit History for Secret Strings** `[SAFE AUTOMATION]`:
   ```bash
   git log -p -n 20 | grep -E "(SUPABASE_SECRET|SENDGRID_API_KEY|TWILIO_AUTH)"
   ```

## Recovery
1. **Update Production Environment Variables in Vercel** `[REQUIRES HUMAN APPROVAL]`:
   - In Vercel Project Settings -> **Environment Variables**:
   - Update `SUPABASE_SECRET_KEY` with the newly rolled key.
   - Save and mark for Production and Preview environments.
   - If SendGrid or Twilio leaked: replace `SENDGRID_API_KEY` or `TWILIO_AUTH_TOKEN`.
2. **Trigger Web App Redeployment** `[REQUIRES HUMAN APPROVAL]`:
   - In Vercel Dashboard, redeploy the current production deployment to propagate the new secrets to all serverless Node.js and Edge runtimes.
3. **Purge Leaked Secrets from Git History**:
   - **Primary Defense**: Ensure the secret has been revoked and rolled in Supabase/Vercel (Steps 1 & 2). Once revoked, the leaked string is completely inactive.
   - **Repository Sanitization**: In an authorized environment with Git administrative tools (such as BFG Repo-Cleaner or `git filter-repo`), purge the commit or replace the secret string across historical commits, then coordinate force-pushing to remote branches.
   - **GitHub Secret Alert Resolution**: In GitHub repository **Security** -> **Secret scanning**, mark the exposed secret alert as "Revoked" once key rotation is validated.
4. **Re-verify Row Level Security**:
   Ensure RLS was not disabled during the incident:
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public' 
     AND rowsecurity = false;
   ```
   *Must return 0 rows.*

## Validation
1. **Verify Backend Connectivity with New Secret**:
   ```bash
   node supabase/verify_seed.mjs
   ```
   *Must report `✅ Row Count: [N]` across all 45+ tables without authentication errors.*
2. **Verify Public App Health**:
   ```bash
   curl -i "https://www.reachinternational.co.in/api/health?check=ready"
   ```
   *Must return HTTP 200 OK with `status: "ok"` and `db: "healthy"`.*
3. **Verify Edge Proxy Rejects Stale HMAC Signatures**:
   - Perform a clean browser login on `/login`.
   - Confirm HMAC edge signature verification (`x-internal-user-sig`) succeeds with the new secret.

## Rollback
- **Secret Revocation Rollback**: "No verified rollback mechanism found."  
  *(A revoked API key cannot and must not be un-revoked. Key rotation is strictly forward-only).*
- If the new key was incorrectly copied into Vercel, re-copy the exact secret string from the Supabase Dashboard into Vercel and redeploy.

## Escalation
- If data tampering or unauthorized deletion occurred before key revocation, immediately escalate to P0 Disaster Recovery and execute [`runbooks/DISASTER_RECOVERY_AND_RESTORE.md`](./DISASTER_RECOVERY_AND_RESTORE.md) for Point-in-Time Recovery.
- If employee KYC documents or private customer data was downloaded, notify legal and compliance counsel for statutory breach disclosure.

## Do Not
- **DO NOT** paste, print, or reproduce raw secret strings in runbooks, incident channels, or postmortems. Note strictly: `Potential secret exposure detected in <file/path>`.
- **DO NOT** delete Git commit history manually without rotating the active key first (attackers already have the key).
- **DO NOT** commit the replacement secret to Git or `.env.example`.
- **DO NOT** prefix `SUPABASE_SECRET_KEY` with `NEXT_PUBLIC_` or `EXPO_PUBLIC_`.
- **DO NOT** disable Row Level Security (`ALTER TABLE ... DISABLE ROW LEVEL SECURITY`) to troubleshoot permission errors.

## Root Cause Follow-Up
- Audit `apps/web/lib/supabase/admin.ts` to guarantee `import "server-only";` is present on line 1.
- Enable automated pre-commit secret scanning hooks (e.g. `gitleaks` or `detect-secrets`).
- Record complete forensic incident entry in `public.audit_logs`:
  ```sql
  INSERT INTO public.audit_logs (action, category, severity, details, created_at)
  VALUES ('SECURITY_BREACH_REMEDIATED', 'security', 'CRITICAL', '{"keys_rotated": ["SUPABASE_SECRET_KEY"], "sessions_purged": true}', now());
  ```
- Complete postmortem in [`performance/monitoring/incidents.md`](../performance/monitoring/incidents.md).
