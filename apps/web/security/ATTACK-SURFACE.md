# Web Application Attack Surface Analysis — `apps/web`

> **NEXT.JS 16 APP ROUTER ENTRY POINTS, TRUST BOUNDARIES, AND RISKS**  
> *This document provides an exhaustive inventory of entry points, server action boundaries, API routes, and trust transitions in `apps/web`.*

---

## 1. Web Entry Point Inventory

### A. Edge Proxy & Route Boundaries (`apps/web/proxy.ts`)
- **Route Path**: Handled across all matching routes via `proxy.ts`.
- **Trust Boundary**: Public internet → Next.js Edge Runtime.
- **Entry Points**:
  1. `/login`, `/signup`, `/reset-password` (Public Auth)
  2. `/api/auth/callback` (PKCE Callback)
  3. `/api/auth/forgot-password` (Password Reset Dispatch)
  4. `/(app)/*` (`/dashboard`, `/machines`, `/clients`, `/operations`, `/running-logs`, `/users`, `/payroll`, `/attendance`, `/settings`)
- **Controls & Protections**:
  - `checkRateLimitAsync()` enforces rate limit profiles (`AUTH_STRICT`, `MUTATION_API`, `GENERAL_ROUTES`).
  - Strips incoming spoofed `x-internal-user-*` headers.
  - Redirects unauthenticated visitors accessing protected routes to `/login`.
  - Normalizes legacy URLs (e.g. `/hr` -> `/payroll`, `/operations?tab=logs` -> `/running-logs`).
  - Prevents CDN/browser caching of navigation redirects (`Cache-Control: no-store`).
- **Status**: `Verified`.

---

### B. Server Actions (`apps/web/app/actions/*`)
Server Actions accept `POST` requests carrying the Next.js `next-action` header.

| Action Module | Primary Operations | Target Tables | Existing Authorization Controls | Risk & Verification Status |
|---|---|---|---|---|
| **`machines.ts`** | `createMachine`, `updateMachine`, `deactivateMachine` | `public.machines`, `public.machine_hour_logs` | `requireRole("admin", "super_admin", "manager")`, Zod parsing, `logAudit()` | `Verified` |
| **`clients.ts`** | `createClient`, `updateClient`, `deleteClient` | `public.clients`, `public.client_sites` | `requireRole("admin", "super_admin", "manager")`, Zod parsing, `logAudit()` | `Verified` |
| **`operators.ts`** | `submitOperatorHourLog`, `approveHourLog` | `public.machine_hour_logs` | Session verification, operator assignment check, meter increase check | `Verified` |
| **`documents.ts`** | `confirmDocumentUploadAction`, `getDocumentViewUrlAction` | `public.user_documents`, Supabase Storage | `verifySession()`, role check (`isManagerOrAbove`) or ownership match, 180s signed URLs | `Verified` |
| **`payroll.ts`** | `updatePayrollRecord`, `finalizePayrollMonth` | `public.payroll_records` | `requireRole("admin", "super_admin", "hr")`, `logAudit()` | `Verified` |
| **`users.ts`** | `createUser`, `updateUser`, `updateUserRole`, `toggleUserStatus` | `public.users` | `requireRole("admin", "super_admin")`, `logAudit()` | `Verified` |
| **`account-deletion.ts`**| `requestAccountDeletionAction` | `public.users`, `public.audit_logs` | `verifySession()`, confirmation keyword check, `logAudit()` | `Verified` |

---

### C. Public & Protected API Routes (`apps/web/app/api/*`)

| Endpoint | Method | Scope | Key Security Risks | Controls | Status |
|---|---|---|---|---|---|
| **`/api/auth/callback`** | `GET` | Public | Open redirect, auth code theft | Server-side PKCE code exchange with Supabase Auth, internal relative redirect path sanitization | `Verified` |
| **`/api/auth/forgot-password`**| `POST` | Public | Email enumeration, spam dispatch | IP rate limiting (`AUTH_STRICT`), generic response message | `Verified` |
| **`/api/documents/[id]/view`** | `GET` | Authenticated | BOLA / IDOR document access | Calls `getDocumentViewUrlAction` with session verification; returns signed URL (180s) | `Verified` |
| **`/api/documents/[id]/download`**| `GET` | Authenticated | Unauthorized document exfiltration | Validates user role or document ownership | `Verified` |
| **`/api/health`** | `GET` | Public | System info leakage | Returns minimal `{ status: "ok" }` without version headers | `Verified` |

---

## 2. Web Vulnerability Analysis & Mitigations

### Cross-Site Scripting (XSS)
- **Vector**: User input (machine model, breakdown notes, client names) rendered in the browser.
- **Mitigation**: React 19 JSX automatically encodes text nodes, preventing DOM XSS. For rich text or email generation, untrusted content is passed through `sanitizeHtml` (`@reachinternational/utils/sanitize`).
- **Status**: `Verified`.

### Cross-Site Request Forgery (CSRF)
- **Vector**: Malicious third-party website submitting forged state-changing requests.
- **Mitigation**: Next.js App Router Server Actions enforce cryptographic action tokens and `Origin`/`Host` header validation by default. Web cookies use `SameSite=Lax`.
- **Status**: `Verified`.

### Open Redirects
- **Vector**: Manipulated `?next=` parameter in auth callbacks redirecting users to phishing domains.
- **Mitigation**: In `/api/auth/callback`, the redirect target is validated to ensure it starts with `/` and does not contain protocol prefixes (`http://`, `https://`, `//`).
- **Status**: `Verified`.

### Cache Poisoning & Cross-User Data Leakage
- **Vector**: User-specific data cached across multiple users via Next.js `unstable_cache`.
- **Mitigation**: In `apps/web/lib/dal.ts`, `getCachedUserRow` explicitly incorporates `userId` in the cache key (`["dal-user-row-v10", userId]`) and tags each cache entry with `CACHE_TAGS.users`. Global cached functions must never cache user-private data.
- **Status**: `Verified`.

### Server-Side Request Forgery (SSRF)
- **Vector**: Application fetching URLs supplied by untrusted user input.
- **Mitigation**: The web application does not accept arbitrary external URLs for server-side fetching. File downloads and signed URLs target internal Supabase storage endpoints only.
- **Status**: `Verified`.
