# ReachInternational Production Security Engineering Rules & Policy

> **AUTHORITATIVE SECURITY POLICY FOR AI AGENTS**  
> *This document establishes the binding security engineering policy for all applications (`apps/web`, `apps/mobile`), shared packages (`packages/*`), data access layers (`lib/dal.ts`), server actions, database queries, authentication flows, authorization checks, storage buckets, and deployment configurations in the ReachInternational monorepo. Security is a non-negotiable, non-bypassable engineering requirement. Every AI coding agent MUST read, obey, and enforce these rules before writing or modifying any code in this repository.*

---

## 1. Purpose

The purpose of ReachInternational's security policy is to guarantee that the platform remains **resilient against unauthorized access, data leakage, privilege escalation, and industrial cyber threats** across all operational workflows:
* **Target Environment**: Multi-tenant fleet management, machine breakdown reporting, financial ledger tracking, payroll revisions, customer agreements, and mobile field operations.
* **Core Guarantee**: Every request, API endpoint, server action, and database query MUST verify authentication, authorization, and input validity on trusted server boundaries before executing business logic.

---

## 2. Security Standards (OWASP ASVS 5.0 Baseline)

ReachInternational adopts **OWASP ASVS 5.0 (Application Security Verification Standard)** as its authoritative security reference. All AI coding agents MUST align implementation with:
* **V1 Architecture**: Enforce strict trust boundaries between client, edge proxy, server, and database.
* **V2 Authentication**: Validate session cookies on every request using Supabase SSR Auth (`supabase.auth.getUser()`).
* **V3 Session Management**: Use HttpOnly, Secure, SameSite cookies with strict session expiration and server-side revocation.
* **V4 Access Control**: Enforce 13-role RBAC (`@reachinternational/permissions`), 3-tier scoping (`global`, `branch_scoped`, `assigned`, `client_own`), and PostgreSQL Row Level Security (RLS).
* **V5 Validation & Encoding**: Validate all incoming payloads via Zod schemas (`@reachinternational/validation`) and escape output via React JSX.
* **V8 Data Protection**: Mask sensitive employee PII, financial data, and credentials.
* **V10 Malicious Code & File Handling**: Validate MIME types, file extensions, and enforce 10MB limits on file uploads.
* **V14 Configuration**: Keep secrets strictly server-side (`SUPABASE_SERVICE_ROLE_KEY`, `SENDGRID_API_KEY`, `QSTASH_TOKEN`).

---

## 3. Security Architecture

ReachInternational enforces a 5-tier security boundary model:

```text
                                [ SECURITY BOUNDARIES ]
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Browser / Mobile App (UNTRUSTED): React client rendering, local state, UI controls │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Edge Auth Proxy (proxy.ts): Session validation & route guard redirects (<20ms)   │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Next.js App Router (RSC & Server Actions): DAL (lib/dal.ts) Zod payload check     │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Data Access Layer (lib/dal.ts): verifySession(), requirePermission(), audit log  │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Supabase PostgreSQL (TRUSTED): 35 migrations, 13-role RLS policies, pgcrypto     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Trust Boundaries

```text
Untrusted Boundary: Client Browser / Mobile App (Payloads, Headers, Form Inputs)
       ↓ [TLS 1.3 Transport Encryption]
Edge Boundary:      proxy.ts (Session Token Check & Protected Route Enforcement)
       ↓ [Server-Side Execution]
Server Boundary:    lib/dal.ts (verifySession() + Zod Schema Validation)
       ↓ [Authenticated Client]
Database Boundary:  PostgreSQL (Row Level Security & B-Tree Permission Indexes)
```

**Mandate**: The browser and mobile clients are COMPLETELY UNTRUSTED. Client-side state, hidden UI buttons, or disabled inputs provide ZERO security. Authoritative checks MUST occur on trusted server and database boundaries.

---

## 5. Authentication

1. **Canonical Auth Provider**: Authentication is managed strictly via Supabase SSR Auth (`createSupabaseServerClient()` in `lib/supabase/server.ts`).
2. **Server-Side Identity Verification**: `verifySession()` in `lib/dal.ts` invokes `supabase.auth.getUser()` to validate JWT signatures against Supabase Auth servers on every request.
3. **Prohibition of Custom Auth**: AI agents MUST NOT create secondary login systems, custom JWT signers, or manual password hashing algorithms.

---

## 6. Sessions

1. **HttpOnly Cookie Configuration**: Sessions are stored in HttpOnly, Secure, SameSite=Lax cookies managed by Supabase SSR middleware.
2. **No LocalStorage Token Storage**: Authentication tokens MUST NEVER be stored in `localStorage` or `sessionStorage` in web applications.
3. **Session Invalidation**: Invoking logout MUST invalidate the session cookie on the server and trigger Supabase auth revocation (`supabase.auth.signOut()`).

---

## 7. Authorization Architecture

Authorization is enforced across three mandatory verification layers:

```text
Layer 1 (Middleware): Edge Auth Proxy (proxy.ts) checks for valid session cookie on protected routes.
Layer 2 (Server DAL): DAL functions (lib/dal.ts) execute requirePermission(permissionCode) & getUserBranchIds().
Layer 3 (Database):   PostgreSQL RLS policies evaluate auth.uid() against table-level role & branch scoping.
```

---

## 8. Role-Based Access Control (RBAC Matrix)

ReachInternational defines 13 explicit enterprise roles inside `@reachinternational/permissions`:

```text
ROLE HIERARCHY TIER         ROLES INCLUDED
──────────────────────────────────────────────────────────────────────────────────────────
• Executive / Admin Tier   → super_admin, company_admin, branch_manager
• Financial & Business Tier→ finance_manager, rental_manager, sales_executive, hr_manager
• Technical & Service Tier → service_manager, field_engineer, mechanic
• Operational & Field Tier → supervisor, operator, client
```

### RBAC Rule:
UI controls and Server Actions MUST use canonical permission helpers:
```ts
import { roleHasPermission, PERMISSIONS } from "@reachinternational/permissions";

// Check permission before executing elevated action
if (!roleHasPermission(user.role, PERMISSIONS.MACHINES_DELETE)) {
  throw new Error("Unauthorized: Insufficient permissions to delete machine");
}
```

---

## 9. Resource-Level Authorization & BOLA/IDOR Protection

Possessing a valid URL or record ID (e.g. `/machines/mch_9921`) DOES NOT grant access to the resource.

1. **Branch Scoping Check**: AI agents MUST filter data queries using `getUserBranchIds(user)` from `lib/dal.ts` to ensure users can only access records within their authorized branch scope (`DEL-HQ`).
2. **Resource Ownership Verification**: For client or assigned staff roles, authorization checks MUST verify that `created_by === user.id` or `assigned_to === user.id` or `client_id === user.client_id`.

---

## 10. Database Security & Minimum Privilege

1. **Default Anon Protection**: The public `anon` role has ZERO access to table data unless explicit RLS policies grant read access to public marketing assets.
2. **Authenticated Role Bounds**: The `authenticated` role operates strictly under Row Level Security policies.
3. **Service Role Restrictions**: `SUPABASE_SERVICE_ROLE_KEY` (`createSupabaseAdminClient()`) bypasses RLS and MUST ONLY be used inside trusted server-only DAL modules (`lib/dal.ts`) for system-level operations. It MUST NEVER be exposed to client components.

---

## 11. Row Level Security (RLS) Policy Mandate

RLS is enabled across all 35 PostgreSQL migrations. AI agents MUST observe:

```sql
-- Canonical RLS Policy Example (Machines Table)
CREATE POLICY "Branch-scoped machine access" ON public.machines
FOR SELECT TO authenticated
USING (
  organization_id = (SELECT organization_id FROM users WHERE id = auth.uid())
  AND (
    branch_id IN (SELECT branch_id FROM user_branches WHERE user_id = auth.uid())
    OR (SELECT role FROM users WHERE id = auth.uid()) IN ('super_admin', 'company_admin')
  )
);
```

**Rule**: AI agents MUST NOT disable, drop, or bypass RLS policies to solve query bugs or improve performance.

---

## 12. Input Validation (Zod Schema Mandate)

All external inputs (HTTP request bodies, URL search params, form submissions, Server Action arguments) MUST be validated against canonical Zod schemas from `@reachinternational/validation`:

```ts
import { createMachineSchema } from "@reachinternational/validation";

export async function createMachineAction(formData: FormData) {
  const session = await verifySession();
  
  // Zod runtime validation
  const validationResult = createMachineSchema.safeParse(Object.fromEntries(formData));
  if (!validationResult.success) {
    return { success: false, errors: validationResult.error.flatten().fieldErrors };
  }
  // Proceed with authorized mutation
}
```

---

## 13. Output Encoding & Escaping

1. **React JSX Escaping**: React automatically encodes values rendered inside JSX, mitigating standard DOM XSS attacks.
2. **No Unsafe Raw HTML**: Using `dangerouslySetInnerHTML` is **STRICTLY FORBIDDEN** unless rendering sanitized rich text backed by DOMPurify with an explicit code review comment.

---

## 14. Cross-Site Scripting (XSS) Protection

1. **User Content Sanitization**: Any user-generated markdown, rich text, or SVG content MUST be sanitized server-side prior to rendering.
2. **URL Attribute Guard**: Dynamic `href` attributes (e.g. user-supplied website URLs) MUST be validated to ensure they use safe protocols (`https://` or `mailto:`), blocking `javascript:` execution vectors.

---

## 15. API Security Standards

1. **Edge Middleware Guard**: Protected API routes inside `apps/web/app/api/` MUST verify authentication via Edge Auth Proxy (`proxy.ts`).
2. **Method Enforcement**: API endpoints MUST explicitly check HTTP methods (`GET`, `POST`, `PUT`, `DELETE`) and reject unsupported verbs with HTTP 405 Method Not Allowed.
3. **Payload Scrubbing**: API responses MUST return only necessary data fields, omitting password hashes, secret keys, or internal system metadata.

---

## 16. Server Action Security

Server Actions in `apps/web/app/actions/` are public HTTP POST attack surfaces. Every Server Action MUST follow this mandatory execution template:

```ts
export async function executeProtectedAction(inputData: unknown) {
  // Step 1: Verify Authentication
  const session = await verifySession();

  // Step 2: Verify Authorization & Permissions
  const user = await getCurrentUser(session.userId);
  await requirePermission(user, PERMISSIONS.OPERATIONS_WRITE);

  // Step 3: Validate Input Payload
  const parsed = actionSchema.parse(inputData);

  // Step 4: Execute Mutation within RLS bounds
  const result = await performDatabaseMutation(parsed, user);

  // Step 5: Write Audit Log
  await logAuditEvent({ action: "UPDATE_RECORD", userId: user.id, targetId: result.id });

  return { success: true, data: result };
}
```

---

## 17. Client-Side Security Bounds

1. **Zero Secret Exposure**: Client Components (`'use client'`) MUST NEVER import or access server-only environment variables (`SUPABASE_SERVICE_ROLE_KEY`, `SENDGRID_API_KEY`, `QSTASH_TOKEN`).
2. **UI Controls Are Decorative**: Hiding an `Edit` or `Delete` button based on role is a UX feature, NOT a security control. Server Actions MUST re-verify permissions independently.

---

## 18. File Upload Security

1. **Validation Boundary**: File uploads (machine photos, FSR attachments, employee documents) MUST be validated for:
   * **MIME Type**: Restricted to allowed types (`image/jpeg`, `image/png`, `application/pdf`).
   * **Extension**: Extension MUST match verified MIME type.
   * **Max File Size**: Hard limit of 10 MB per file upload.
2. **Filename Sanitization**: Uploaded files MUST be renamed using randomly generated UUIDs (`${crypto.randomUUID()}.pdf`) to prevent path traversal attacks (`../../etc/passwd`).

---

## 19. Storage Bucket Security

1. **Public vs Private Buckets**:
   * *Public Buckets*: Restricted strictly to machine catalog photos and public assets.
   * *Private Buckets*: HR documents, financial invoices, payroll receipts, and customer agreements MUST be stored in private Supabase Storage buckets.
2. **Signed URL Access**: Access to private storage assets MUST require time-limited signed URLs (`supabase.storage.from("private").createSignedUrl(path, 60)`).

---

## 20. Secrets Management

```text
SECRET CATEGORY                     STORAGE LOCATION / SCOPE
──────────────────────────────────────────────────────────────────────────────────────────
• Public Client Environment Vars    NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
• Server-Only Service Role Key      SUPABASE_SERVICE_ROLE_KEY (Server-only .env.local)
• Third-Party Integration Secrets   SENDGRID_API_KEY, TWILIO_AUTH_TOKEN, QSTASH_TOKEN
```

**Rule**: Hardcoding secrets or private keys directly into code files is **STRICTLY FORBIDDEN**.

---

## 21. Cookies & Browser Storage

1. **Cookie Flag Mandate**: Authentication cookies MUST enforce `HttpOnly`, `Secure` (in production), and `SameSite=Lax`.
2. **No Sensitive Data in Web Storage**: Sensitive user PII, authorization tokens, or financial records MUST NEVER be written to `localStorage` or `sessionStorage`.

---

## 22. CSRF & State-Changing Protections

1. **SameSite Cookie Protection**: `SameSite=Lax` cookies protect against cross-site request forgery attacks on standard browser GET/POST navigations.
2. **Next.js Action Host Header Matching**: Server Actions automatically check request `Origin` and `Host` headers to prevent unauthorized cross-origin action calls.

---

## 23. Cross-Origin Resource Sharing (CORS)

Mobile API endpoints (`apps/web/app/api/...`) MUST enforce explicit origin filtering. Setting `Access-Control-Allow-Origin: *` on authenticated endpoints is FORBIDDEN.

---

## 24. Rate Limiting Safeguards

Sensitive authentication endpoints (login, password reset, OTP request) MUST enforce rate limiting via Upstash QStash or Edge Middleware to prevent brute-force attacks.

---

## 25. Resource Abuse & DoS Protection

1. **Payload Size Caps**: API JSON payloads MUST be capped at 1MB.
2. **Query Result Pagination**: Data queries MUST default to 25 rows per page to prevent memory exhaustion attacks.

---

## 26. Business Logic Security & Approval Thresholds

ReachInternational enforces strict financial and operational approval thresholds:
* **Purchase Orders > ₹10,000**: Requires explicit approval by Store Manager or Finance Manager.
* **Expenses > ₹50,000**: Requires explicit approval by Company Admin or Super Admin.
* **Rental Agreement Discounts > 15%**: Requires explicit approval by Rental Manager.

AI agents MUST enforce these approval gates inside Server Actions and DAL query functions.

---

## 27. Transactions & Race Conditions

Multi-table state mutations (e.g. updating stock ledger AND creating GRN, or processing invoice payment AND updating customer balance) MUST execute within PostgreSQL ACID transactions (`BEGIN ... COMMIT`) or RPC functions to prevent partial state corruption.

---

## 28. External Service Integrations

External API integrations (SendGrid, Twilio, WhatsApp, QStash) MUST be invoked exclusively from server-side modules (`lib/notifications/`). Integration API keys MUST remain server-only.

---

## 29. Webhook Security

Incoming webhooks (e.g. payment gateway notifications, QStash background triggers) MUST verify HMAC signatures (`crypto.createHmac()`) against configured webhook secret tokens before processing payloads.

---

## 30. Payment Security Standards

1. **Zero Card Storage**: ReachInternational NEVER stores raw credit card numbers, CVVs, or bank credentials.
2. **Payment Gateway Integration**: Payment processing MUST delegate directly to authorized PCI-DSS compliant payment gateways via secure tokens.

---

## 31. AI & LLM Security

If AI/LLM integration features are introduced:
1. **Server-Only Execution**: LLM API keys MUST remain server-side.
2. **Prompt Injection Safeguards**: User inputs passed into prompts MUST be sanitized and isolated within system instructions.
3. **No Auth Bypass via AI**: AI models MUST NOT execute database actions without passing standard DAL `requirePermission()` checks.

---

## 32. Dependency Security

1. **Workspace Versioning**: Internal dependencies use the `workspace:*` protocol.
2. **Vulnerability Scans**: Run `pnpm audit` periodically to inspect monorepo packages for known CVE vulnerabilities.

---

## 33. Security Headers (`next.config.js`)

Production responses MUST include standard HTTP security headers:
```text
X-DNS-Prefetch-Control: on
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
Referrer-Policy: origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## 34. Transport Security

All communications MUST be encrypted in transit via **TLS 1.3** (or TLS 1.2 minimum). Insecure HTTP connections MUST redirect automatically to HTTPS in production environments.

---

## 35. Cryptography Standards

1. **Standard Cryptography**: Cryptographic operations MUST use standard Node.js `crypto` or PostgreSQL `pgcrypto`.
2. **No Custom Algorithms**: Creating custom encryption algorithms or hashing routines is **STRICTLY FORBIDDEN**.

---

## 36. Sensitive Data Protection & Masking

1. **PII Masking**: Employee bank account numbers, SSNs, and personal identification fields MUST be masked in user interfaces (`XXXX-XXXX-1294`).
2. **Log Scrubbing**: Password fields, authentication tokens, and secret keys MUST be scrubbed before writing log events.

---

## 37. Security Logging & Auditing (`lib/audit.ts`)

Elevated mutations (creating machines, editing roles, deleting records, approving POs) MUST write structured audit logs to PostgreSQL `audit_logs` using `logAuditEvent()` in `lib/audit.ts`:

```ts
import { logAuditEvent } from "@/lib/audit";

await logAuditEvent({
  action: "DELETE_MACHINE",
  userId: user.id,
  targetId: machineId,
  details: { code: machine.code, branchId: machine.branch_id },
});
```

---

## 38. Security + Performance

Security and Performance MUST coexist:
* **NEVER** disable authorization checks or RLS policies to achieve query speedups.
* Optimize performance using composite indexes and React `cache()`, maintaining 100% security bounds.

---

## 39. Security + Accessibility

Security and Accessibility MUST coexist:
* Screen-reader announcements (`aria-live`) and hidden accessible content MUST strictly respect resource authorization limits.

---

## 40. Security + Responsive Design

Authorization checks MUST be 100% identical regardless of whether a request originates from Mobile, Tablet, or Desktop viewports.

---

## 41. Security Testing & Verification

1. **Compilation Check**: `pnpm typecheck` across all 9 monorepo workspace packages.
2. **Permission Unit Tests**: Test access bounds across authenticated, unauthorized, wrong-role, and wrong-branch scenarios.

---

## 42. Security Regression Protection

Before modifying shared authorization functions in `lib/dal.ts`, `@reachinternational/permissions`, or Supabase RLS migrations:
1. Audit downstream impact across all 26 domain modules.
2. Verify zero authorization bypass vectors exist.
3. Verify zero compilation errors across all workspace packages.

---

## 43. Security Anti-Patterns (NEVER INTRODUCE)

AI agents MUST NEVER introduce any of the following security anti-patterns:
* ❌ **Client-Only Authorization**: Hiding a button in UI without verifying permissions on the server.
* ❌ **Disabling RLS Policies**: Dropping or bypassing RLS to fix a query permission error.
* ❌ **Service Role Key Leakage**: Importing `SUPABASE_SERVICE_ROLE_KEY` inside Client Components.
* ❌ **Hardcoded Secrets**: Storing API tokens or database passwords inside source files.
* ❌ **Un-Validated Server Actions**: Accepting client payload arguments without Zod schema parsing.
* ❌ **Raw SQL Concatenation**: Interpolating user input strings directly into raw SQL queries.
* ❌ **Excessive Error Disclosure**: Returning raw database stack traces to the browser.

---

## 44. Security Change Policy

Before executing a security-sensitive code change:
1. Identify affected trust boundaries (Client → Server → Database).
2. Formulate the smallest correct code change.
3. Verify that zero security, performance, or visual regressions are introduced.

---

## 45. AI Agent Pre-Implementation Security Checklist

Before writing code, every AI agent MUST complete this mental checklist:

* [ ] Is this operation authenticated on the server via `verifySession()`?
* [ ] Is authorization enforced via `requirePermission()` and `getUserBranchIds()`?
* [ ] Are all incoming input payloads validated with a canonical Zod schema?
* [ ] Are sensitive service role keys kept strictly inside server-only modules?
* [ ] Is Row Level Security (RLS) preserved intact on the target table?
* [ ] Are file uploads restricted to allowed MIME types and 10MB size limits?
* [ ] Is an audit log entry written to `audit_logs` for this mutation?

---

## 46. AI Agent Post-Implementation Security Audit

After completing code modifications, every AI agent MUST perform the following verification protocol:

1. **Compilation Audit**: Run `pnpm typecheck` across all 9 monorepo workspace packages.
2. **Security & RLS Audit**: Confirm authorization checks and RLS policies remain 100% active.
3. **Design & Responsive Audit**: Confirm visual compliance with `DESIGN.md` across Mobile, Tablet, and Desktop.
4. **Memory Synchronization**: Update `AI/STATE.md`, `AI/CURRENT_TASK.md`, `AI/CHANGELOG_AI.md`, and `README.md`.

---
