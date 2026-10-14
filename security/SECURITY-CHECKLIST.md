# Monorepo Security Checklist & Verification Gate

> **PRACTICAL SECURITY COMPLIANCE GATE FOR DEVELOPERS & AI AGENTS**  
> *Every item in this checklist must be evaluated prior to merging pull requests, releasing builds, or declaring AI engineering tasks complete. Do NOT check an item without tangible evidence.*

---

## 1. Pre-Implementation Checklist (Design & Scoping)

- [ ] **SEC-PRE-01: Boundary & Entry Point Identification**
  - *Requirement*: Identify which attack surface entry points ([`security/ATTACK-SURFACE.md`](./ATTACK-SURFACE.md)) are affected.
  - *Evidence*: Documented affected routes, actions, or components in the task plan.
- [ ] **SEC-PRE-02: Role & Permission Scoping**
  - *Requirement*: Verify which of the 6 canonical roles (`super_admin`, `admin`, `manager`, `supervisor`, `hr`, `operator`) can access the feature.
  - *Evidence*: Permission constant referenced from `@reachinternational/permissions`.
- [ ] **SEC-PRE-03: Data Sensitivity Classification**
  - *Requirement*: Check whether sensitive PII (Aadhaar, bank account, salary) or operational telemetry is involved.
  - *Evidence*: Consultation of [`security/DATA-PRIVACY.md`](./DATA-PRIVACY.md).

---

## 2. Implementation Checklist (Code & Architecture)

- [ ] **SEC-IMP-01: Server-Side Authorization Enforcement**
  - *Requirement*: Server Action or DAL query calls `requireRole()` or `requirePermission()`. UI buttons are not relied upon for security.
  - *Evidence*: Line reference to `requireRole(...)` or `roleHasPermission(...)`.
- [ ] **SEC-IMP-02: BOLA / IDOR Resource Ownership Check**
  - *Requirement*: For non-admin roles, server verifies `assigned_to`, `created_by`, or `user_id` matches the session.
  - *Evidence*: SQL filter or server-side equality comparison before mutation.
- [ ] **SEC-IMP-03: Zod Schema Payload Validation**
  - *Requirement*: Inbound form data or JSON is validated using a canonical Zod schema (`@reachinternational/validation`).
  - *Evidence*: `schema.safeParse()` or `schema.parse()` called at the start of the action.
- [ ] **SEC-IMP-04: Explicit Query Column Projection**
  - *Requirement*: No `SELECT *` in database queries. Only required fields are selected.
  - *Evidence*: Query string specifying exact comma-separated column names.
- [ ] **SEC-IMP-05: Zero Secret Leakage**
  - *Requirement*: No `SUPABASE_SECRET_KEY`, database credentials, or API tokens in client components (`'use client'`) or mobile bundles.
  - *Evidence*: Server secrets imported strictly via `import "server-only"` in `lib/env/server.ts`.
- [ ] **SEC-IMP-06: Output Encoding & Sanitization**
  - *Requirement*: User-generated text rendered into emails or rich HTML is passed through `sanitizeHtml()`.
  - *Evidence*: Import and call of `@reachinternational/utils/sanitize`.
- [ ] **SEC-IMP-07: Structured Audit Trail**
  - *Requirement*: Elevated state changes (create/update/delete machines, role edits, payroll changes) invoke `logAudit()`.
  - *Evidence*: Call to `await logAudit({ action: "...", entity_type: "...", entity_id: "..." })`.

---

## 3. Web-Specific Checklist (`apps/web`)

- [ ] **SEC-WEB-01: Edge Proxy Route Protection**
  - *Requirement*: New protected routes are covered by `proxy.ts` matcher and redirect unauthenticated requests to `/login`.
  - *Evidence*: Verification in `proxy.ts` route check (`isProtectedRoute`).
- [ ] **SEC-WEB-02: Rate Limiting Guard**
  - *Requirement*: New authentication, public, or mutation API endpoints are wrapped by `checkRateLimitAsync()`.
  - *Evidence*: Rate limit profile assigned in `proxy.ts` or route handler.
- [ ] **SEC-WEB-03: Cache Poisoning & Cross-User Data Prevention**
  - *Requirement*: User-specific data is not cached globally via `unstable_cache` without a user-scoped cache key.
  - *Evidence*: User ID included in cache key parameters.

---

## 4. Mobile-Specific Checklist (`apps/mobile`)

- [ ] **SEC-MOB-01: Hardware Keystore Authentication Storage**
  - *Requirement*: Tokens stored via `mobileSecureStorage` (`expo-secure-store`) with zero unencrypted `AsyncStorage` fallback.
  - *Evidence*: Absence of `AsyncStorage.setItem('token', ...)` in auth flows.
- [ ] **SEC-MOB-02: Deep Link Route Sanitization**
  - *Requirement*: Incoming deep links pass through `sanitizeDeepLinkRoute()` in `lib/security.ts`.
  - *Evidence*: Deep link handler routes through whitelist sanitizer.
- [ ] **SEC-MOB-03: Android Backup & Permissions Hardening**
  - *Requirement*: `allowBackup: false` preserved in `app.json`; unneeded native permissions blocked.
  - *Evidence*: Manifest inspection in `app.json` and `app.config.js`.
- [ ] **SEC-MOB-04: Offline Queue Idempotency**
  - *Requirement*: Queued offline actions use deterministic idempotency keys (`buildShiftLogIdempotencyKey`).
  - *Evidence*: Idempotency key generated and verified before insertion into queue.

---

## 5. Testing & Verification Checklist (Pre-Release)

- [ ] **SEC-TST-01: Static Typecheck Clean**
  - *Requirement*: `pnpm typecheck` exits with code 0 across all 9 workspaces.
  - *Evidence*: CLI output showing 0 type errors.
- [ ] **SEC-TST-02: Negative Authorization Tests**
  - *Requirement*: Negative test verifies unauthorized role receives HTTP 403 / "Permission denied".
  - *Evidence*: Test execution log in `supabase/tests/` or unit test suite.
- [ ] **SEC-TST-03: Negative Input Validation Tests**
  - *Requirement*: Invalid, empty, or boundary payloads are rejected with clear validation messages.
  - *Evidence*: Zod schema test execution output.
- [ ] **SEC-TST-04: Git Diff Clean of Secrets & Debug Logs**
  - *Requirement*: Diff inspected for `console.log` with credentials, commented-out security checks, or exposed keys.
  - *Evidence*: Clean `git diff` review.
- [ ] **SEC-TST-05: Database Migration Idempotency & RLS**
  - *Requirement*: New migrations target Dev project (`vlmxciuogczumumrwyot`), enable RLS, and avoid destructive drops.
  - *Evidence*: Migration file review adhering to `supabase/AGENTS.md`.
