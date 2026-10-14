# Monorepo Attack Surface Analysis

> **REPOSITORY-WIDE ENTRY POINTS, TRUST BOUNDARIES, AND RISK MATRIX**  
> *This document identifies all external, internal, and network entry points across ReachInternational Web, Native Mobile, shared packages, and database infrastructure. Every entry point is mapped to its trust boundary, associated risks, existing controls, and verification status.*

---

## 1. Trust Boundaries Diagram

```text
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      UNTRUSTED CLIENT ZONE                             │
 │  • Public Web Browsers (DOM, localStorage, user input, query params)   │
 │  • Native Mobile App (Android/iOS, local file system, deep links)      │
 └──────────────────┬─────────────────────────────────┬───────────────────┘
                    │ HTTPS / TLS 1.3                 │ HTTPS / TLS 1.3
                    ▼                                 ▼
 ┌──────────────────────────────────────┐  ┌──────────────────────────────┐
 │    WEB EDGE BOUNDARY (proxy.ts)      │  │   SUPABASE AUTH & GATEWAY    │
 │  • Rate Limiting (checkRateLimit)    │  │  • JWT Issuance & Refresh    │
 │  • Token Presence / Route Guards     │  │  • Public Anon Endpoints     │
 │  • Header Sanitization & Signing     │  │  • Rate Limits               │
 └──────────────────┬───────────────────┘  └──────────────┬───────────────┘
                    │ Edge-Signed Request                 │ Authenticated Client
                    ▼                                     ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      TRUSTED APPLICATION ZONE                          │
 │  • Next.js Server Components (RSC) & Server Actions (app/actions/*)    │
 │  • Data Access Layer (lib/dal.ts verifySession, requireRole)          │
 │  • Background Cron Handlers (/api/cron/*)                             │
 │  • Centralized Audit Logger (lib/audit.ts logAudit)                   │
 └──────────────────────────────────┬─────────────────────────────────────┘
                                    │ Direct SQL / RLS
                                    ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                       TRUSTED PERSISTENCE ZONE                         │
 │  • Supabase PostgreSQL (Row Level Security across all 154+ migrations) │
 │  • Supabase Storage (user_files bucket, signed URLs)                  │
 │  • Upstash Redis / QStash (Rate limiting & cron dispatches)           │
 └────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Attack Surface Catalog

### A. Web Application Entry Points (`apps/web`)

| ID | Surface / Entry Point | Protocol / Method | Trust Boundary | Primary Risks | Existing Controls | Status |
|---|---|---|---|---|---|---|
| **WEB-01** | Edge Proxy (`proxy.ts`) | HTTP `GET`/`POST`/`ALL` | Untrusted Client → Edge Proxy | LPDoS, brute force, route bypass | Edge rate limiting (`checkRateLimitAsync`), route matching (`isProtectedRoute`), stripping spoofed `x-internal-user-*` headers | `Verified` |
| **WEB-02** | Public Auth Routes (`/login`, `/signup`, `/reset-password`) | HTTP `GET`/`POST` | Untrusted Client → Edge / Next.js | Credential stuffing, brute force, account enumeration | Strict rate limits (`RATE_LIMIT_PROFILES.AUTH_STRICT`), Zod schema validation (`authSchema`), role home redirect | `Verified` |
| **WEB-03** | PKCE Auth Callback (`/api/auth/callback`) | HTTP `GET` with `code` / `token_hash` | Supabase Auth Email → Server Callback | Open redirect, authorization code interception | PKCE exchange via `@supabase/ssr`, server-side code validation, internal path redirect normalization | `Verified` |
| **WEB-04** | Forgot Password Route (`/api/auth/forgot-password`) | HTTP `POST` | Untrusted Client → API Endpoint | Email enumeration, spam relaying, denial of service | IP rate limiting, Supabase reset password dispatch | `Verified` |
| **WEB-05** | Document View & Download (`/api/documents/[id]/view`, `download`) | HTTP `GET` with URL param `id` | Untrusted Client → Server API | BOLA/IDOR, unauthorized KYC document access | Session verification (`verifySession`), ownership and role check (`getDocumentViewUrlAction`), 180s short-lived signed URLs | `Verified` |
| **WEB-06** | Server Actions (`app/actions/*`) | HTTP `POST` (Next-Action) | Untrusted Client → Server Action | CSRF, parameter tampering, unauthorized state mutation | Next.js Server Action CSRF tokens, `requireRole()`, `requirePermission()`, canonical Zod validation, `logAudit()` | `Verified` |
| **WEB-07** | Document Upload Flow (`confirmDocumentUploadAction`) | Supabase Storage Direct Upload + Action | Untrusted Client → Storage & DB | Malicious file upload, path traversal, quota exhaustion | 2MB file size limit, private storage bucket, path scoping (`documents/{user_id}/{type_code}`), RLS on `storage.objects` | `Partially Verified` (Bucket `allowed_mime_types` is NULL at DB level; app validates MIME) |
| **WEB-08** | Audit Trail Access (`/audit`, `app/actions/audit.ts`) | Server Component & Action | Authenticated Staff → Server DAL | Unauthorized viewing of system activity | Role restriction (`requireRole('super_admin', 'admin', 'manager')`), RLS on `audit_logs` | `Verified` |
| **WEB-09** | Health Check (`/api/health`) | HTTP `GET` | Public Monitor → Server Route | Information leakage | Returns minimal `{ status: "ok", timestamp }` without leaking versions or environment | `Verified` |

---

### B. Native Mobile Application Entry Points (`apps/mobile`)

| ID | Surface / Entry Point | Protocol / Method | Trust Boundary | Primary Risks | Existing Controls | Status |
|---|---|---|---|---|---|---|
| **MOB-01** | Deep Links (`reachinternational://`, App Links) | URI Intent Handling | OS / External App → Mobile Router | Route injection, phishing, unauthorized navigation | `sanitizeDeepLinkRoute()` in `lib/security.ts`, whitelist of valid routes, role-based target validation | `Verified` |
| **MOB-02** | Local Session Storage | Expo Native Bridge | App Sandbox → Hardware Keystore | Token extraction, session hijacking | `expo-secure-store` backed by Android Keystore / iOS Keychain, 1800-char chunking, zero plaintext AsyncStorage fallback | `Verified` |
| **MOB-03** | Offline Mutation Queue (`@reach:offline_queue_v1`) | Local Storage (`AsyncStorage`) | App Sandbox → Local Persistence | Local data tampering, replay attacks, duplicate shift logs | `MAX_QUEUE_CAPACITY` (50), deterministic idempotency keys (`buildShiftLogIdempotencyKey`), UUID generation, server conflict resolution | `Partially Verified` (Payloads unencrypted in AsyncStorage) |
| **MOB-04** | Direct Supabase REST/PostgREST Calls | HTTPS / TLS 1.3 | Mobile Client → Supabase Gateway | BOLA, privilege escalation, unauthorized query execution | PostgREST respects user JWT, table-level RLS, input sanitization via Zod schemas, zero service-role key in mobile bundle | `Verified` |
| **MOB-05** | Operating System Permissions | Android / iOS Manifest | Mobile OS → Native Runtime | Unnecessary permission exploitation, spyware perception | Android `blockedPermissions` stripping in `app.json`, `withAndroidLargeScreenAndPermissions` plugin, `allowBackup: false` | `Verified` |
| **MOB-06** | Document / Image Picker (`expo-document-picker`) | Native File Intent | OS File System → Mobile Sandbox | Upload of malicious executables, oversized payloads | File size limit checks (2MB), MIME type checks before upload to Supabase storage | `Verified` |

---

### C. Shared Infrastructure & Third-Party Services

| ID | Service / Dependency | Protocol / Scope | Trust Boundary | Primary Risks | Existing Controls | Status |
|---|---|---|---|---|---|---|
| **EXT-01** | Supabase PostgreSQL Database | Port 5432 / HTTPS PostgREST | App Servers / Clients → DB Engine | SQL injection, RLS bypass, cross-tenant data leak | Prepared statements, parameterized queries, RLS on all tables, foreign keys, database triggers | `Verified` |
| **EXT-02** | Supabase Auth Server | HTTPS / TLS 1.3 | Server / Client → Supabase Auth | Account takeover, credential brute force | Bcrypt password hashing, PKCE auth flows, rate limiting | `Verified` |
| **EXT-03** | Upstash QStash & Redis | HTTPS REST API | Server Action / Edge Proxy → Upstash | Unauthorized cron execution, rate limit bypass | Bearer token authentication, server-only environment protection | `Partially Verified` |
| **EXT-04** | Sentry Error Reporting | HTTPS API | Web & Mobile → Sentry Cloud | PII / token leakage in stack traces | Data sanitization in Sentry client configs, explicit masking of passwords/tokens | `Verified` |
| **EXT-05** | SendGrid / Twilio Dispatch | HTTPS API | Server Actions → Dispatch Providers | Email spoofing, SMS flooding, token leakage | Server-only credential isolation, recipient input validation via Zod | `Partially Verified` |

---

## 3. Verified Security Gaps & Limitations

1. **Storage Bucket MIME Enforcement (Gap 1)**:
   - Migration 101 set `allowed_mime_types = NULL` on the `user_files` bucket in Supabase storage.
   - *Risk*: An authenticated user could theoretically upload disallowed file types directly via the Supabase client if bypassing the web application form.
   - *Existing Mitigation*: Web and mobile applications validate MIME types (`packages/validation/src/hr.ts`), file paths are restricted by storage RLS, and files are served with content-type headers.
   - *Status*: `Partially Verified` — Recommended to re-tighten `allowed_mime_types` on the storage bucket via migration.

2. **Mobile Offline Queue Encryption (Gap 2)**:
   - `OfflineQueueManager.ts` stores pending shift logs in `AsyncStorage` (`@reach:offline_queue_v1`) as unencrypted JSON.
   - *Risk*: A user on a rooted Android device could inspect or modify offline shift logs before they are synced.
   - *Existing Mitigation*: Shift logs require an authenticated Supabase session to sync, and server RPCs validate start/end meter logic.
   - *Status*: `Partially Verified` — Operational telemetry risk, low PII impact.

3. **Branch Scoping Query Implementation (Gap 3)**:
   - `getUserBranchIds()` in `apps/web/lib/dal.ts` currently returns `null`.
   - *Risk*: Multi-branch filtering is currently not actively enforced at the DAL layer for queries that rely on `getUserBranchIds()`.
   - *Status*: `Documented Limitation` — Multi-tenancy currently relies on `organization_id` and role scoping.
