# Incident: Auth Proxy HMAC Signature Mismatch & Session Redirect Loop

## Purpose
This runbook provides emergency diagnostics and recovery procedures when users are trapped in infinite `/login` redirect loops due to Edge Proxy HMAC token verification failures, Supabase Auth API rate limits, or session cookie desynchronization.

## Impact
- **Systems Affected**: Edge Auth Proxy (`apps/web/proxy.ts`), Supabase SSR Auth, `lib/security/internal-auth-token.ts`, `lib/dal.ts`.
- **User Impact**: Authenticated operators, supervisors, and administrators cannot access protected routes (`/machines`, `/operations`, `/dashboard`) and are continually bounced back to `/login`.
- **Business Impact**: Complete operational lockout for web users.

## Symptoms
- **Persistent `/login` Redirect Loop**: Users submit valid credentials, session cookie is set, but accessing `/machines` immediately redirects to `/login`.
- **Edge Proxy Timeout Logs**:
  ```text
  [Auth Proxy] Supabase auth rate limit reached (429). Continuing with request processing.
  or:
  [Auth Proxy] Supabase auth getUser timed out after 5000ms. Proceeding without active session.
  ```
- **HMAC Signature Verification Failure**:
  ```text
  [DAL] Unexpected error in verifySession
  or:
  [Auth Proxy] Error signing internal auth headers
  ```
- **Stale Browser Auth Token**: DevTools shows malformed or expired `sb-dhbbgfzbyatzvqafnsqp-auth-token` cookies.

## Severity
**P1 (High)**

## Immediate Actions
1. **Probe Supabase Auth Health (< 2 min)** `[SAFE AUTOMATION]`:
   ```bash
   curl -i "https://dhbbgfzbyatzvqafnsqp.supabase.co/auth/v1/health"
   ```
   *Expected: HTTP 200 OK with `{ "version": "..." }`.*
2. **Verify Environment Secrets Across Runtimes (< 3 min)** `[SAFE AUTOMATION]`:
   - In Vercel Project Settings -> **Environment Variables**:
   - Ensure `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`), `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are present across **Production** and **Preview** without trailing whitespace.

## Diagnosis
1. **Check for Runtime Key Discrepancies** `[SAFE AUTOMATION]`:
   In `apps/web/lib/security/internal-auth-token.ts`, `getSecret()` reads:
   ```ts
   const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
   ```
   If `SUPABASE_SECRET_KEY` is present in Node.js serverless functions but missing from Vercel Edge Middleware, `proxy.ts` falls back to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, while `verifySession()` in `lib/dal.ts` signs with `SUPABASE_SECRET_KEY`. **The signature comparison fails 100% of the time**, forcing an automatic redirect to `/login`.
2. **Inspect User Profile Status** `[SAFE AUTOMATION]`:
   ```sql
   SELECT id, email, role, status, complete_profile 
   FROM public.users 
   WHERE email = '<USER_EMAIL>';
   ```
   - If `status = 'inactive'`, user is intentionally deactivated.
   - If `complete_profile != 'yes'`, user is intentionally redirected to `/onboarding`.
3. **Verify Auth User vs Public Profile Sync** `[SAFE AUTOMATION]`:
   ```sql
   SELECT au.id AS auth_id, pu.id AS profile_id, pu.role, pu.status
   FROM auth.users au
   LEFT JOIN public.users pu ON au.id = pu.id
   WHERE au.email = '<USER_EMAIL>';
   ```
   *If `pu.id IS NULL`, auth user exists without a profile row in `public.users`.*

## Recovery
1. **Repair Missing `public.users` Profile Row** `[REQUIRES HUMAN APPROVAL]`:
   ```sql
   INSERT INTO public.users (
     id, email, full_name, role, status, complete_profile, created_at, updated_at
   )
   SELECT 
     id, 
     email, 
     COALESCE(raw_user_meta_data->>'full_name', split_part(email, '@', 1)), 
     COALESCE(raw_user_meta_data->>'role', 'operator'), 
     'active', 
     'yes', 
     now(), 
     now()
   FROM auth.users
   WHERE email = '<USER_EMAIL>'
   ON CONFLICT (id) DO UPDATE 
   SET status = 'active', complete_profile = 'yes';
   ```
2. **Synchronize Secrets & Redeploy in Vercel** `[REQUIRES HUMAN APPROVAL]`:
   - Ensure `SUPABASE_SECRET_KEY` is checked for all environments (Production, Preview, Development).
   - In Vercel Dashboard, redeploy the active build.
3. **Clear Corrupted Browser Cookies** `[SAFE AUTOMATION]`:
   - Instruct user to clear cookies for `reachinternational.co.in` or delete all `sb-*` tokens in DevTools.
4. **Purge User Profile Cache** `[REQUIRES HUMAN APPROVAL]`:
   - In `apps/web/lib/dal.ts`, user profile is cached with `CACHE_TAGS.users`. Trigger tag invalidation via `/api/refresh` or server mutation.

## Validation
1. **Verify Public Route Loads**:
   ```bash
   curl -i "https://www.reachinternational.co.in/login"
   ```
   *Must return HTTP 200 OK.*
2. **Verify Protected Route Redirection (Unauthenticated)**:
   ```bash
   curl -i "https://www.reachinternational.co.in/machines"
   ```
   *Must return HTTP 307 / 302 Redirect to `/login`.*
3. **Live Browser Login Test**:
   - Log in with test operator credentials.
   - Verify immediate successful landing on `/operations` without looping back to `/login`.

## Rollback
- If key changes in Vercel broke authentication further: In Vercel Environment Variables, restore the previous secret key values and redeploy.
- If a bad deployment broke proxy logic: Revert to previous deployment SHA via Vercel Instant Rollback.

## Escalation
- If Supabase Auth service itself is reporting 5xx or global rate limit lockouts, engage Supabase Critical Support.

## Do Not
- **DO NOT** disable authentication checks in `proxy.ts` or `lib/dal.ts` as a temporary workaround.
- **DO NOT** delete users from `auth.users` directly without backing up their linked operational logs.
- **DO NOT** store JWT tokens in `localStorage` in web clients (violates security rules).

## Root Cause Follow-Up
- Confirm `SUPABASE_SECRET_KEY` is identical across all Vercel environment tiers.
- Log resolution in `public.audit_logs`:
  ```sql
  INSERT INTO public.audit_logs (action, category, severity, details, created_at)
  VALUES ('AUTH_PROXY_INCIDENT_RESOLVED', 'security', 'HIGH', '{"remediation": "repaired profile sync and secret alignment"}', now());
  ```
- File incident postmortem in [`performance/monitoring/incidents.md`](../performance/monitoring/incidents.md).
