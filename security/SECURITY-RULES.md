# Monorepo-Wide Security Rules & Enforcement Policy

> **MANDATORY SECURITY REQUIREMENTS ACROSS ALL PACKAGES AND APPLICATIONS**  
> *These rules are non-negotiable. No developer or AI coding agent has authorization to relax, bypass, or disable any security control defined herein.*

---

## 1. Golden Rules of Security Enforcement

1. **Deny-by-Default Authorization**: Access to every resource, route, mutation, and query is denied unless explicit authorization is proven on a trusted boundary.
2. **Server-Side Authority**: The client runtime (browser or mobile binary) is completely untrusted. All critical business decisions, input validation, role checks, and database updates MUST execute on trusted server infrastructure (`apps/web/lib/dal.ts`, `apps/web/app/actions/*`, and PostgreSQL RLS/RPCs).
3. **Defense-in-Depth**: Security controls must operate across multiple independent layers:
   - Layer 1: Edge Proxy (`proxy.ts`) rate limiting and token presence check.
   - Layer 2: Server Action / DAL validation (`requireRole()`, `@reachinternational/validation`).
   - Layer 3: Database Row Level Security (RLS) enforcing `auth.uid()` and role policies.
4. **Zero Client Secrets**: Privileged secrets (`SUPABASE_SECRET_KEY`, `SENDGRID_API_KEY`, `DATABASE_URL`) must never be bundled into client code, exposed via public environment variables, or stored in mobile application binaries.
5. **No Test or Build Shortcuts**: Disabling type checks, silencing linter rules, bypassing RLS, or mocking authentication merely to make tests pass is strictly prohibited.

---

## 2. Authentication & Session Invariants

1. **Canonical Identity Provider**: Supabase SSR Auth is the sole identity authority. Custom authentication schemes, manual password hashing, and custom JWT signers are prohibited.
2. **Web Session Cookies**: Web sessions must use `HttpOnly`, `Secure`, `SameSite=Lax` cookies managed via `@supabase/ssr`. Web applications must NEVER write authentication tokens to `localStorage` or `sessionStorage`.
3. **Mobile Hardware Keystore**: Mobile authentication tokens must be stored exclusively via `expo-secure-store` backed by Android KeyStore / iOS Keychain (`apps/mobile/lib/supabase.ts`). Unencrypted token persistence in `AsyncStorage` is strictly forbidden.
4. **Token Verification**: Verify sessions using `supabase.auth.getUser()`, which validates JWT claims directly with Supabase Auth servers. Do NOT rely on unverified client-side session payloads (`getSession()`).
5. **Session Revocation**: Logout must invoke `supabase.auth.signOut()` and destroy all local session cookies or Keystore entries immediately.

---

## 3. Authorization & Access Control Invariants

1. **Strict 6-Role System**: All access control decisions must map strictly to the canonical 6 roles defined in `@reachinternational/permissions`:
   - `super_admin`
   - `admin`
   - `manager`
   - `supervisor`
   - `hr`
   - `operator`
2. **Triple Verification Requirement**: Before performing any state mutation, the server must verify:
   - **Identity**: Is the user authenticated? (`verifySession()`)
   - **Role & Permission**: Does the user's role permit this action? (`requirePermission()`, `requireRole()`, or `roleHasPermission()`)
   - **Resource Ownership / Scope**: Does the user own or have administrative scope over this specific entity ID?
3. **BOLA / IDOR Prevention**: Never trust an entity ID supplied in a client URL or payload. For non-administrative roles (e.g., `operator`, `supervisor`), the server MUST verify that:
   - The operator is actively assigned to the machine (`current_operator_id === user.id`).
   - The document belongs to the requesting user (`user_documents.user_id === user.id`).
   - The machine is assigned to the supervisor's site (`supervisor_ids @> ARRAY[user.id]`).
4. **UI Guards Are Not Security**: Hiding buttons, conditionally rendering tabs, or navigating away in client components are purely UX optimizations. Authorization MUST be enforced in Server Actions and database RLS.

---

## 4. Input Validation & Data Sanitization

1. **Strict Zod Schemas**: Every Server Action and API endpoint accepting incoming payloads MUST validate inputs using Zod schemas from `@reachinternational/validation`.
2. **Type Coercion & Stripping**: Schemas must explicitly strip unknown properties (`.strip()`) to prevent mass assignment vulnerabilities.
3. **HTML Sanitization**: Any user-supplied text rendered into HTML or email templates must be sanitized using `sanitizeHtml` from `@reachinternational/utils/sanitize` to strip script tags, event handlers, and malicious URIs (`javascript:`, `data:`).
4. **File Upload Restrictions**: Uploaded files in `user_files` bucket must be restricted to allowed MIME types (`image/jpeg`, `image/png`, `application/pdf`), maximum size of 2MB, and stored under scoped paths `documents/{user_id}/{type_code}.{ext}`.

---

## 5. Database & Row Level Security (RLS)

1. **Universal RLS**: Every table containing application data in Supabase PostgreSQL MUST have RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`).
2. **Never Disable RLS**: Disabling RLS on any table in development or production is an emergency-level security violation.
3. **Explicit Query Projections**: Never use `SELECT *` in production queries or DAL functions. Always specify exact required columns to prevent accidental exposure of sensitive fields (e.g. `aadhaar_number`, `bank_account_number`).
4. **Admin Client Scoping**: The Supabase service-role client (`createSupabaseAdminClient()`) bypasses RLS. It may ONLY be used in server-side modules (`apps/web/lib/supabase/admin.ts`, `apps/web/lib/dal.ts`, `apps/web/lib/audit.ts`) for system operations. Never pass the admin client to client components or invoke it without prior role verification.
5. **Development Isolation**: All database migrations, SQL queries, and seed scripts executed by AI agents MUST target the Development project (`vlmxciuogczumumrwyot`). Operations against Production (`dhbbgfzbyatzvqafnsqp`) during development are strictly forbidden.

---

## 6. Secure Logging & Error Handling

1. **No Sensitive Data in Logs**: Passwords, authentication tokens, session cookies, credit card numbers, Aadhaar numbers, and bank account details must NEVER appear in server logs, Sentry breadcrumbs, or console output.
2. **Sanitized User Errors**: Database exception messages, SQL constraint violations, and internal stack traces must be sanitized before returning to the client. Use `classifyError()` or `formatMachineDatabaseError()` to present friendly, actionable messages without leaking schema internals.
3. **Structured Audit Logging**: Elevated mutations (creating/editing/deleting machinery, role updates, KYC verification, payroll revisions) MUST call `logAudit()` in `apps/web/lib/audit.ts`.

---

## 7. Handling Unresolved Security Risks

If an AI agent or engineer discovers an architectural limitation, conflicting rule, or potential security flaw:
1. **STOP Implementation**: Do not guess an insecure workaround.
2. **Check Existing Rules**: Determine if an existing authoritative rule in `AI/RULES/` governs the behavior.
3. **Document the Gap**: Record the finding in [`security/ATTACK-SURFACE.md`](./ATTACK-SURFACE.md) and [`security/THREAT-MODEL.md`](./THREAT-MODEL.md).
4. **Report to User**: Clearly state the risk, root cause, and recommended architectural solution before writing code.
