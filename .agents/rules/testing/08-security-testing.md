# Security Testing & Vulnerability Verification Standards

> **AUTOMATED AND NEGATIVE SECURITY TESTING PROTOCOLS COMPLIANT WITH OWASP ASVS**  
> *Cross-references the monorepo security baseline in [`security/SECURITY-TESTING.md`](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/security/SECURITY-TESTING.md). Security is verified through rigorous negative testing and zero-trust verification.*

---

## 1. Purpose

The purpose of ReachInternational's Security Testing standards is to ensure that **no unauthorized access, data leakage, role escalation, injection vulnerability, or secret exposure can occur** across any layer of the application.

---

## 2. Applicable Applications & Packages

- `apps/web`: Server Actions, Next.js API routes, Supabase SSR Auth, and Edge Auth Proxy (`proxy.ts`)
- `apps/mobile`: Supabase Auth, hardware-backed SecureStore, and offline mutation sync
- `supabase`: PostgreSQL Row Level Security (RLS) policies, RPCs, and storage bucket security
- `packages/permissions`: Canonical RBAC matrix and role-checking functions
- `security`: Monorepo-wide security documentation and threat models

---

## 3. Security Testing Invariants & Threat Surface

### A. Environment Isolation (MANDATORY)
- **Target Environment**: All security testing, payload fuzzing, and negative tests MUST run against the **Development Project** (`vlmxciuogczumumrwyot`).
- **Production Protection**: Running fuzzing, negative tests, or schema mutations against Production (`dhbbgfzbyatzvqafnsqp`) is **STRICTLY PROHIBITED**.

### B. Core Security Verification Categories (OWASP ASVS)
1. **Authentication & Session Integrity**:
   - Expired or malformed JWT cookies must be rejected and redirected to `/login`.
   - Modifying JWT claims must result in immediate signature verification failure in `supabase.auth.getUser()`.
   - Client-supplied `x-internal-user-*` headers must be stripped by `proxy.ts`.
2. **RBAC & Negative Role Scoping**:
   - `operator`: Cannot invoke administrative Server Actions (`deleteMachine`, `updateUserRole`, `approveFSR`).
   - `supervisor`: Can only manage machines and log shifts for sites within their operational assignment.
   - `hr`: Cannot alter machine technical parameters or operational logs.
3. **BOLA / IDOR Protection**:
   - User A cannot view User B's identity documents via `/api/documents/[id]/view` unless User A holds `admin`, `super_admin`, or `hr` role.
   - Operator A cannot submit machine logs for a machine assigned exclusively to Operator B.
4. **Injection Safety (SQL & XSS)**:
   - PostgREST parameterized queries must safely escape characters such as `' OR '1'='1`.
   - User input notes and complaint descriptions must be sanitized via `sanitizeHtml` to neutralize `<script>` tags.
5. **Secret Protection**:
   - The Supabase service role key (`SUPABASE_SECRET_KEY`) must NEVER appear in client bundles, Next.js client components (`'use client'`), or mobile app binaries.
6. **File Upload Security**:
   - Document uploads (KYC, driving licenses, machine manuals) must enforce strict MIME type whitelisting (`image/jpeg`, `image/png`, `application/pdf`), maximum file size limits (10MB), and store files in private Supabase storage buckets accessed only via signed URLs.
7. **Dependency Integrity**:
   - Monorepo dependencies must have `0` critical or high vulnerabilities in `pnpm audit`.

---

## 4. Required Testing Approach

```text
[ IDENTIFY ENTRY POINT ]
  ├── Server Action, API route, or PostgREST database query
  └── Determine data sensitivity (PII, financials, operational telemetry)

[ CONSTRUCT NEGATIVE SECURITY TEST ]
  ├── Scenario 1: Unauthenticated request (zero cookies / tokens)
  ├── Scenario 2: Authenticated but unauthorized role (e.g. operator calling admin action)
  ├── Scenario 3: Authenticated but out-of-scope resource ID (IDOR / BOLA attempt)
  └── Scenario 4: Fuzzed / malicious payload (XSS script tags, negative numbers, SQL injection)

[ EXECUTE & ASSERT ]
  ├── Verify request is rejected with HTTP 401, 403, or 400
  ├── Verify database RLS blocks unauthorized reads / writes
  └── Confirm zero internal database schema details are leaked in error responses
```

---

## 5. Recommended Tools

- **Security Verification Scripts**: Specialized scripts in `supabase/tests/` and `apps/web/scripts/`
- **Dependency Vulnerability Scanner**: `pnpm audit`
- **Markdown Security Link Validator**: `node scripts/verify-security-links.mjs`

---

## 6. Actual Project Commands

```bash
# 1. Dependency vulnerability audit
pnpm audit

# 2. RBAC matrix unit tests (verifies role permissions in isolation)
pnpm --filter @reachinternational/permissions test

# 3. Operations security RLS regression suite (verifies multi-role scoping)
node supabase/tests/test_operations_security_rls_regression.mjs

# 4. Supervisor-scoped users and clients RLS test
node supabase/tests/test_supervisor_scoped_users_rls.mjs

# 5. Web API security & CORS verification
node apps/web/scripts/test-cors-security.mjs

# 6. Verify security documentation cross-links
node scripts/verify-security-links.mjs
```

---

## 7. Success Criteria

1. **Zero High/Critical CVEs**: `pnpm audit` passes with 0 actionable high or critical vulnerabilities.
2. **Negative Tests Pass**: 100% of unauthorized role and IDOR test scenarios are safely rejected.
3. **Zero Leaked Secrets**: Client bundles contain zero private keys or database passwords.
4. **Sanitized Error Output**: Errors returned to clients never disclose PostgreSQL table names or SQL queries.

---

## 8. Failure Handling

- If an unauthorized role can execute a Server Action: wrap the action immediately with `verifySession()` and check permissions via `@reachinternational/permissions`.
- If an RLS policy leaks data: add explicit `USING` and `WITH CHECK` conditions restricting access to authorized branch/user IDs.
- If `pnpm audit` flags a vulnerable dependency: update the package version in `package.json` or add an override in root `package.json#overrides`.

---

## 9. Evidence & Reporting

The test report must provide:
- Status of `pnpm audit`.
- RBAC and RLS test execution outcomes.
- Confirmation that no secrets were committed or exposed.
