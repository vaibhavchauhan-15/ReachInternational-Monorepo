# Web Application Threat Model & STRIDE Analysis — `apps/web`

> **THREAT MODELING FOR NEXT.JS APP ROUTER, SERVER ACTIONS, & DAL**  
> *This document details the realistic web-specific threat vectors, STRIDE classifications, risk severities, mitigations, and verification procedures for `apps/web`.*

---

## 1. Web Threat Matrix (STRIDE)

| Threat ID | STRIDE Category | Threat Description & Attack Vector | Impacted Asset | Severity | Likelihood | Mitigation | Verification Procedure |
|---|---|---|---|---|---|---|---|
| **WEB-TM-01** | **Spoofing** | Attacker spoofs `x-internal-user-*` headers in HTTP request to impersonate super admin. | Server Authentication | **Critical** | Low | `proxy.ts` unconditionally strips all incoming `x-internal-user-*` headers before verifying the session and re-signing the header with `signInternalUser()`. | Send request with `x-internal-user-id: spoofed-uuid`; verify downstream DAL does not grant elevated privileges. |
| **WEB-TM-02** | **Tampering** | Parameter tampering on Server Action payload (e.g. modifying machine rental price or client ID). | Database Fleet Integrity | **High** | Medium | Server Actions re-validate all incoming payload fields using canonical Zod schemas from `@reachinternational/validation`; RLS prevents unauthorized writes. | Submit invalid schema payload to Server Action; verify action returns `{ error: "Validation failed" }`. |
| **WEB-TM-03** | **Repudiation** | Privileged user executes soft deletion of a client or machine and claims unauthorized action occurred. | Operational Audit Log | **High** | Low | `logAudit()` persists structured immutable event records into `public.audit_logs` using the server admin client. | Execute `deleteClient` action; inspect `public.audit_logs` for corresponding record. |
| **WEB-TM-04** | **Information Disclosure** | Low-privilege user queries `/api/documents/[id]/view` to view confidential KYC docs of other staff (BOLA/IDOR). | Employee Identity Files | **Critical** | Medium | `getDocumentViewUrlAction` verifies `user_id === session.userId` or checks if role is `admin`, `super_admin`, or `hr`. Signed URLs expire after 180s. | Request document view URL for another user's document as an operator; verify HTTP 403 Forbidden. |
| **WEB-TM-05** | **Information Disclosure** | Cross-user data leakage caused by improperly keyed Next.js `unstable_cache`. | User Profile / Data | **High** | Low | All user-specific cached functions in `lib/dal.ts` include `userId` in the cache key array (`["dal-user-row-v10", userId]`) and use tag revalidation (`CACHE_TAGS.users`). | Fetch user row for User A, then User B; confirm distinct cached objects returned without data bleeding. |
| **WEB-TM-06** | **Denial of Service** | Low-and-Slow / Brute Force HTTP flood against auth endpoints (LPDoS). | Auth Service Availability | **High** | High | `proxy.ts` applies `RATE_LIMIT_PROFILES.AUTH_STRICT` (5 requests / 60 seconds) returning HTTP 429 Too Many Requests with `Retry-After`. | Execute 6 rapid POST requests to `/api/auth/forgot-password`; verify 6th request receives HTTP 429. |
| **WEB-TM-07** | **Elevation of Privilege** | Attacker bypasses hidden UI buttons and executes administrative Server Action via direct HTTP POST. | System Administration | **Critical** | Medium | Every Server Action calls `requireRole()` or `requirePermission()` at the top of the function body before inspecting inputs or mutating the database. | Invoke `createUser` Server Action using an operator session token; verify error: "Permission denied". |
| **WEB-TM-08** | **Elevation of Privilege** | User manipulates profile update action to assign themselves `admin` role. | RBAC Matrix | **Critical** | Low | Profile update action (`app/actions/profile.ts`) explicitly excludes role assignment from the allowed update payload. Role changes require dedicated `updateUserRole` action restricted to `super_admin`. | Pass `{ role: "admin" }` in operator profile update; verify role remains unchanged. |

---

## 2. Web Attack Surface Mitigations Summary

- **CSRF**: Mitigated by Next.js Server Action action-token binding and `SameSite=Lax` session cookies.
- **XSS**: Mitigated by React 19 JSX auto-encoding and `sanitizeHtml()` for user-generated strings.
- **SQL Injection**: Mitigated by Supabase PostgREST parameterized query compilation.
- **SSRF**: Mitigated by lack of user-controllable outbound HTTP fetch destinations.
- **Open Redirects**: Mitigated by strict internal relative path normalization in `/api/auth/callback`.
