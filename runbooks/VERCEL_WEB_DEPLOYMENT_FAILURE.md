# Incident: Vercel Web Production Build Failure & Deployment Rollback

## Purpose
This runbook provides emergency diagnosis, compiler recovery, and instant traffic rollback procedures when a production deployment to Vercel fails or introduces critical 5xx errors into the live web application (`apps/web`).

## Impact
- **Systems Affected**: Next.js Web App (`apps/web`), Vercel Production Environment, GitHub Actions (`.github/workflows/deploy-web.yml`).
- **User Impact**: In a deployment failure, new code is blocked from shipping. In a bad release, web users experience 500/502 errors on critical pages (`/machines`, `/operations`, `/dashboard`).
- **Business Impact**: Interrupted operations release cycles; inability to deploy urgent security or bug hotfixes.

## Symptoms
- **GitHub Actions Deployment Failure**: Workflow `.github/workflows/deploy-web.yml` fails with exit code 1 during `amondnet/vercel-action`.
- **Pre-Build Concurrency Guard Collision**:
  Build logs output:
  ```text
  ❌ [Build Guard Error] Next.js dev server is actively running (PID 14220).
     Running 'pnpm build' concurrently corrupts shared '.next' compiler artifacts.
  or:
  ❌ [Build Guard Error] Port 3000 is actively in use.
  ```
- **TypeScript Strict Compilation Errors**:
  ```text
  Type error: Property '...' does not exist on type '...'.
  Failed to compile Next.js App Router static optimization.
  ```
- **Post-Deploy 5xx Error Rate Spike**: HTTP 500 error rate exceeds 0.5% immediately following release activation.

## Severity
**P1 (High)**

## Immediate Actions
1. **Execute Instant Rollback in Vercel (< 2 min)** `[REQUIRES HUMAN APPROVAL]`:
   - In [Vercel Dashboard](https://vercel.com/dashboard) -> Select **ReachInternational Web**.
   - Go to **Deployments** tab.
   - Find the **last healthy deployment** prior to the failing release.
   - Click the three dots (`•••`) -> Select **Instant Rollback** (or **Promote to Production**).
   - *Vercel shifts 100% of production traffic back to the previous deployment artifact in < 5 seconds.*
2. **Alternative CLI Rollback (via npx)** `[REQUIRES HUMAN APPROVAL]`:
   ```bash
   npx vercel rollback <HEALTHY_DEPLOYMENT_URL_OR_ID>
   ```

## Diagnosis
1. **Inspect Vercel Remote Build Logs** `[SAFE AUTOMATION]`:
   - In Vercel Dashboard, open the failed deployment and inspect the build output.
   - Filter for: `Error:`, `Type error`, `Build Guard Error`, `ENOMEM`, `Module not found`.
2. **Replicate Build Locally** `[SAFE AUTOMATION]`:
   ```bash
   # 1. Verify dependencies
   pnpm install --frozen-lockfile

   # 2. Run typecheck
   pnpm typecheck

   # 3. Test compilation
   pnpm --filter @reachinternational/web build
   ```
3. **Inspect Pre-Build Guard Environment Variables** `[SAFE AUTOMATION]`:
   In `apps/web/scripts/guard-build.js`:
   ```js
   if (process.env.CI || process.env.VERCEL || process.env.SKIP_BUILD_GUARD === "1") {
     process.exit(0);
   }
   ```
   If a custom CI runner or preview environment fails with `[Build Guard Error]`, confirm `CI=true` or `VERCEL=1` is passed in environment variables.

## Recovery
1. **Add Build Guard Bypass (if falsely tripping)** `[REQUIRES HUMAN APPROVAL]`:
   - In Vercel Project Settings -> **Environment Variables**: Add `SKIP_BUILD_GUARD=1`.
2. **Clear Corrupted Vercel Compiler Cache & Redeploy** `[REQUIRES HUMAN APPROVAL]`:
   - In Vercel Dashboard -> Failed Deployment -> Click **Redeploy**.
   - Check the box **"Redeploy with existing build cache cleared"**.
3. **Revert Problematic Commit on `main`** `[REQUIRES HUMAN APPROVAL]`:
   ```bash
   git checkout main
   git pull origin main
   git revert <OFFENDING_COMMIT_SHA> -m 1 --no-edit
   pnpm typecheck
   git push origin main
   ```

## Validation
1. **Verify Liveness Endpoint**:
   ```bash
   curl -i "https://www.reachinternational.co.in/api/health"
   ```
   *Must return HTTP 200 OK with `status: "ok"`.*
2. **Verify Database Readiness Probe**:
   ```bash
   curl -i "https://www.reachinternational.co.in/api/health?check=ready"
   ```
   *Must return HTTP 200 OK, `db: "healthy"`.*
3. **Verify Core Routes**:
   - `curl -s -o /dev/null -w "%{http_code}" https://www.reachinternational.co.in/login` -> 200
   - `curl -s -o /dev/null -w "%{http_code}" https://www.reachinternational.co.in/machines` -> 307 (Redirect to login)

## Rollback
- **Vercel Deployment Rollback**: Supported natively. Use **Instant Rollback** in the Vercel dashboard to promote any previous successful deployment SHA.
- **Git Commit Rollback**: Use `git revert <COMMIT_SHA>` to push a clean reverting commit to `main`.

## Escalation
- If Vercel Edge CDN itself is returning 502 Bad Gateway globally across all deployments, check [Vercel Status](https://www.vercel-status.com/) and engage Vercel Support.

## Do Not
- **DO NOT** disable TypeScript compilation checks in `next.config.ts` (`ignoreBuildErrors: true` is strictly prohibited).
- **DO NOT** delete the active production domain alias in Vercel during an incident.
- **DO NOT** merge unverified hotfixes directly to `main` without running `pnpm typecheck` locally first.

## Root Cause Follow-Up
- Confirm GitHub Actions CI (`.github/workflows/ci.yml`) is passing on `main`.
- Log rollback in `public.audit_logs`:
  ```sql
  INSERT INTO public.audit_logs (action, category, severity, details, created_at)
  VALUES ('DEPLOYMENT_ROLLBACK_EXECUTED', 'system', 'HIGH', '{"reverted_sha": "<SHA>"}', now());
  ```
- Document postmortem in [`performance/monitoring/incidents.md`](../performance/monitoring/incidents.md).
