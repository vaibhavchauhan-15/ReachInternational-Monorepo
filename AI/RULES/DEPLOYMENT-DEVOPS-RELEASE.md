# ReachInternational Production Deployment, DevOps & Release Rules

> **AUTHORITATIVE DEPLOYMENT, DEVOPS & RELEASE POLICY FOR AI AGENTS**  
> *This document establishes the binding deployment, CI/CD pipeline, environment isolation, database migration, build verification, secret governance, post-release smoke testing, and rollback policy for all applications (`apps/web`, `apps/mobile`), shared packages (`packages/*`), database schemas, and deployment infrastructure within the ReachInternational monorepo. Every AI coding agent MUST read, obey, and enforce these rules before preparing, executing, or recommending any production deployment or release.*

---

## 1. Purpose

The purpose of ReachInternational's Deployment, DevOps & Release policy is to guarantee that **no code is released to production based solely on local functionality, visual appearance, or passing unit tests**. A release is production-ready ONLY when it completes the full multi-stage deployment validation pipeline:

```text
Development → Local Validation → Pull Request Review → CI Validation → Preview Staging → Production Release → Post-Release Audit
```

---

## 2. Source of Truth

ReachInternational establishes authoritative canonical sources of truth for deployment and release engineering:
1. **Package Manager & Workspace Configuration**: `pnpm-workspace.yaml` specifying `pnpm@11.21.0`.
2. **Build Pipeline & Caching**: Turborepo configuration `turbo.json` managing monorepo tasks (`build`, `typecheck`, `lint`).
3. **Root Build & Verification Scripts**: `package.json` specifying `pnpm build` (`turbo run build`) and `pnpm typecheck` (`turbo run typecheck`).
4. **Database Migration Stack**: Supabase PostgreSQL 35 SQL migrations in `supabase/migrations/` and `node supabase/verify_seed.mjs`.
5. **Production Base Domain**: Environment variable `NEXT_PUBLIC_APP_URL` defaulting to `https://reachinternation.com`.

---

## 3. Existing Deployment Architecture

ReachInternational is structured as a Turborepo monorepo:
* **Web Application (`apps/web`)**: Next.js App Router deployed with serverless and edge functions.
* **Mobile Application (`apps/mobile`)**: React Native / Expo cross-platform mobile application.
* **Shared Packages (`packages/*`)**: 7 domain packages (`@reachinternational/types`, `utils`, `design-tokens`, `permissions`, `validation`, `api-client`, `config`).

---

## 4. Hosting Platform

The web application (`apps/web`) is configured for Vercel / serverless edge deployment with native Next.js App Router optimization. The database backend is hosted on Supabase PostgreSQL with Row Level Security.

---

## 5. Runtime & Build Configuration

* **Node.js Runtime**: Node.js 18+ LTS runtime environment.
* **Build Task Execution**: Turborepo orchestrates monorepo builds (`turbo run build`).
* **Build Output Directories**: `.next/**` for `apps/web` and `dist/**` for workspace packages.

---

## 6. Package Manager Governance (`pnpm`)

1. **Single Lockfile Standard**: `pnpm-lock.yaml` is the ONLY authoritative lockfile.
2. **No Secondary Lockfiles**: Creating `package-lock.json` or `yarn.lock` files is **STRICTLY FORBIDDEN**.
3. **Execution Commands**: All commands MUST use `pnpm` (e.g. `pnpm add`, `pnpm typecheck`, `pnpm build`).

---

## 7. Environment Isolation Architecture

ReachInternational partitions deployment environments into three strict tiers:

```text
ENVIRONMENT     PURPOSE & DB BOUNDARY                      CONFIG & SECRET SOURCE
──────────────────────────────────────────────────────────────────────────────────────────
• Local Dev     Local Supabase container / seed data       .env.local (never committed)
• Preview       Vercel PR previews / staging Supabase DB   Environment dashboard secrets
• Production    https://reachinternation.com / Prod DB     Production secret store
```

---

## 8. Environment Variables Architecture

Environment variables MUST be partitioned into public vs server-only:
* **Public Client Variables (`NEXT_PUBLIC_*`)**: Exposed to browser bundles (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
* **Server-Only Secrets**: Restricted strictly to server runtimes (`SUPABASE_SERVICE_ROLE_KEY`, `SENDGRID_API_KEY`).

---

## 9. Secret Management Policy

1. **Zero Secrets in Source Control**: Committing secret keys, passwords, or service-role keys to Git is **STRICTLY FORBIDDEN**.
2. **`SUPABASE_SERVICE_ROLE_KEY` Isolation**: MUST NEVER be exposed in client components or browser variables.

---

## 10. Branching Strategy

* `main`: Authoritative production branch.
* `feature/*`: Feature development branches created off `main`.
* `fix/*`: Bugfix branches targeting specific issues.

---

## 11. Continuous Integration (CI) Architecture

The repository enforces automated CI validation pipelines on pull requests:
```text
Pull Request Opened → Typecheck Audit (pnpm typecheck) → Build Audit (pnpm build) → Lint Audit → Migration Verification
```

---

## 12. Pull Request Gate Standards

Pull requests targeting `main` MUST pass all CI checks without bypassing type errors, disabling lint rules, or ignoring build failures.

---

## 13. Preview Deployments

Vercel preview deployments created for pull requests MUST use isolated preview databases or staging schemas to prevent modifying production database tables.

---

## 14. Staging Validation Protocol

Staging validation MUST verify multi-tenant organizational data isolation and branch-level RBAC authorization prior to production release.

---

## 15. Production Environment Governance

Production releases MUST target `https://reachinternation.com` with `NEXT_PUBLIC_APP_URL` correctly configured in production deployment settings.

---

## 16. Database Deployment Architecture

Database schema updates are managed through version-controlled SQL migrations in `supabase/migrations/` targeting Supabase PostgreSQL.

---

## 17. Database Migration Execution Protocol

1. **Migration File Creation**: SQL migrations MUST be placed in `supabase/migrations/` using timestamped filenames.
2. **RLS Policy Preservation**: New tables MUST include explicit Row Level Security (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`).

---

## 18. Data Migration & Transformation Safety

Data transformations MUST be executed via idempotent SQL migration scripts (`UPDATE ... WHERE ... AND NOT EXISTS`).

---

## 19. Migration Safety & Destructive Change Prohibition

1. **Non-Destructive Standard**: Dropping production columns (`DROP COLUMN`) or dropping tables (`DROP TABLE`) without multi-phase deprecation is **STRICTLY FORBIDDEN**.
2. **Backward-Compatible Schema Changes**: Schema changes MUST be backward-compatible with running application instances.

---

## 20. Cache & CDN Invalidation

Deployments containing data structure changes MUST trigger tag-based revalidation (`revalidateTag()`) or path revalidation (`revalidatePath()`) to purge stale server caches.

---

## 21. Static Asset Deployment

Static assets in `public/` (favicons, manifests, icons) MUST be cache-busted or immutably versioned during production build compilation.

---

## 22. Domain & DNS Governance

Production deployment MUST use the canonical domain `https://reachinternation.com`. Modifying domain configurations through client code is FORBIDDEN.

---

## 23. Authentication Deployment Configuration

Production authentication callbacks in Supabase Auth MUST be configured with exact production redirect URLs (`https://reachinternation.com/auth/callback`). Staging or localhost URLs MUST NOT be set as primary production auth redirects.

---

## 24. Authorization & RLS Enforcement

Production database access MUST enforce Row Level Security across all 35 SQL migrations. Relying solely on client-side authorization is **STRICTLY FORBIDDEN**.

---

## 25. External Service Integration Deployment

Production deployment settings MUST configure production credentials for SendGrid, Twilio, WhatsApp, and QStash background messaging queues.

---

## 26. Production Secrets Inventory

* `NEXT_PUBLIC_APP_URL`: `https://reachinternation.com`
* `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase Anonymous Public Key
* `SUPABASE_SERVICE_ROLE_KEY`: Supabase Admin Service Role Key (Server Only)

---

## 27. Build Artifact Governance

Generated build artifacts (`.next/`, `dist/`, `node_modules/`) MUST remain listed in `.gitignore` and MUST NEVER be committed to source control.

---

## 28. Dependency Management Rules

1. **Monorepo Dependency Locking**: Dependency additions MUST use `pnpm add -w` for root or `pnpm --filter <package> add <dep>` for specific workspace packages.
2. **Lockfile Synchronization**: Committing `package.json` edits without updating `pnpm-lock.yaml` is FORBIDDEN.

---

## 29. Security Configuration Audit

Production deployments MUST enforce security headers (CSP, HSTS, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`) adhering to `AI/RULES/SECURITY.md`.

---

## 30. Feature Flags Strategy

High-risk enterprise features SHOULD be wrapped in environment-aware feature flags allowing instant feature toggling without code redeployment.

---

## 31. Backward Compatibility Protocol

API endpoints and database schemas MUST remain backward compatible across at least one minor release version to support active mobile clients (`apps/mobile`).

---

## 32. API Endpoint Versioning & Compatibility

Renaming or removing required request parameters on public API endpoints in `apps/web/app/api/` without version deprecation is FORBIDDEN.

---

## 33. Rollback Strategy

1. **Application Rollback**: Instantly revert Vercel production deployment to the previous successful build deployment SHA.
2. **Database Rollback Caution**: Database schema rollbacks MUST be handled via forward-fix migrations (`supabase/migrations/`) rather than raw schema drops.

---

## 34. Failed Deployment Handling

If a production build or deployment step fails:
* Deployment MUST immediately halt.
* The system MUST remain on the previous stable production deployment.
* AI agents MUST inspect build failure logs before attempting code re-submissions.

---

## 35. Post-Deployment Validation (Smoke Testing)

Immediately following a production deployment release, the following smoke test sequence MUST be verified:
```text
1. Domain Load Audit     → Verify https://reachinternation.com returns HTTP 200 OK
2. Health Check Probe    → Verify /api/health returns { status: "ok" }
3. Authentication Flow   → Verify login page loads and session cookies set cleanly
4. Core Dashboard Load   → Verify /dashboard renders 5-zone vertical composition
5. DB Seed Verification  → Run pnpm verify:seed to confirm database integrity
```

---

## 36. Automated Smoke Testing Verification

AI agents MUST run local validation prior to release:
```bash
pnpm typecheck
pnpm verify:seed
```

---

## 37. Production Observability Integration

Production deployments MUST integrate with `AI/RULES/OBSERVABILITY-MONITORING-LOGGING.md`, recording elevated operational events in `public.audit_logs`.

---

## 38. Production Performance Monitoring

Post-deployment Core Web Vitals (LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1) MUST be audited to ensure zero performance regressions were introduced.

---

## 39. Production Logging Verification

Production server logs MUST be verified post-release to ensure zero unhandled exception spikes or secret key exposures occur.

---

## 40. Database Backup & Recovery Governance

Supabase PostgreSQL automated daily snapshots and point-in-time recovery (PITR) MUST be active prior to executing production database schema updates.

---

## 41. Disaster Recovery Protocol

In the event of a catastrophic production failure, recovery proceeds via Supabase PITR database restoration + Vercel deployment SHA rollback.

---

## 42. Incident Response Execution

```text
Incident Detected → Halt Deployment Pipeline → Trigger Vercel Rollback → Investigate Logs (lib/audit.ts) → Apply Hotfix Migration → Re-Verify
```

---

## 43. Release Versioning

Monorepo releases follow semantic versioning (`MAJOR.MINOR.PATCH`) tracked in `package.json` and git tags.

---

## 44. Deployment Traceability

Every production deployment MUST map to a specific Git commit SHA and Turborepo build identifier.

---

## 45. Cost & Infrastructure Control

AI agents MUST NOT introduce secondary paid hosting services or un-cached external API loops that create unbounded infrastructure expenses.

---

## 46. Environment Leakage Prevention

Production environments MUST NEVER render development banners, mock test data, local debug bars, or `localhost` API endpoints.

---

## 47. SEO Deployment Requirements

Deployments MUST observe `AI/RULES/SEO-METADATA-DISCOVERABILITY.md`, ensuring canonical domains point to `https://reachinternation.com` and preview environments inject `noindex, nofollow` headers.

---

## 48. Observability Deployment Requirements

Deployments MUST observe `AI/RULES/OBSERVABILITY-MONITORING-LOGGING.md`, ensuring audit logging via `logAudit()` remains 100% operational.

---

## 49. Security Deployment Requirements

Deployments MUST observe `AI/RULES/SECURITY.md`, ensuring zero secret keys are bundled into client JavaScript.

---

## 50. Testing Deployment Requirements

Deployments MUST observe `AI/RULES/TESTING-QA.md`, passing the mandatory 7-step Quality Gate prior to release.

---

## 51. Forbidden Deployment Anti-Patterns (NEVER INTRODUCE)

AI agents MUST NEVER introduce any of the following deployment anti-patterns:
* ❌ **Committing Lockfile Conflicts**: Pushing multiple package manager lockfiles (`package-lock.json` alongside `pnpm-lock.yaml`).
* ❌ **Exposing Service Role Keys**: Bundling `SUPABASE_SERVICE_ROLE_KEY` in client-side code or public env variables.
* ❌ **Bypassing CI Typechecks**: Disabling `pnpm typecheck` or using `@ts-ignore` to force a build through CI.
* ❌ **Destructive DB Schema Drops**: Executing `DROP TABLE` or `DROP COLUMN` in production without multi-stage deprecation.
* ❌ **Hardcoding Localhost URLs**: Hardcoding `http://localhost:3000` in production authentication redirects or API calls.
* ❌ **Deploying Un-Audited Code**: Releasing code without executing post-implementation Quality Gate verification.

---

## 52. Change Policy

Before executing any deployment configuration change:
1. Verify compatibility with hosting platform and runtime environment.
2. Formulate the smallest correct configuration change.
3. Perform post-implementation Quality Gate verification.

---

## 53. AI Agent Pre-Deployment Checklist

Before deploying code, every AI agent MUST complete this mental checklist:

* [ ] Have I executed `pnpm typecheck` and confirmed `0 compilation errors` across all 9 packages?
* [ ] Is `pnpm-lock.yaml` updated and synchronized with `package.json`?
* [ ] Are all new environment variables documented and partitioned into public vs server-only?
* [ ] Are database schema changes placed in `supabase/migrations/` with RLS enabled?
* [ ] Are production secret keys isolated from client JavaScript bundles?
* [ ] Is `NEXT_PUBLIC_APP_URL` configured to `https://reachinternation.com`?

---

## 54. AI Agent Post-Deployment Audit

After completing code or configuration modifications, every AI agent MUST perform the following verification protocol:

1. **Compilation Audit**: Run `pnpm typecheck` across all 9 monorepo workspace packages (0 errors).
2. **Build Audit**: Execute `pnpm build` (`turbo run build`) and confirm clean compilation.
3. **Database Audit**: Execute `pnpm verify:seed` to verify database table and foreign key integrity.
4. **Design & Responsive Audit**: Confirm visual compliance with `DESIGN.md` across Mobile, Tablet, and Desktop.
5. **Memory Synchronization**: Update `AI/STATE.md`, `AI/CURRENT_TASK.md`, `AI/CHANGELOG_AI.md`, and `README.md`.

---
