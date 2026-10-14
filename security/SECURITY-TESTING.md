# Security Testing & Verification Standards

> **AUTOMATED AND MANUAL SECURITY TESTING METHODOLOGY**  
> *This document establishes the binding standards for security testing, negative authorization testing, RLS verification, payload fuzzing, and regression suites across the ReachInternational monorepo.*

---

## 1. Testing Principles & Authorized Environments

1. **Test Environment Isolation (Mandatory)**: All security test suites, integration tests, and migration validations MUST target the **Development Project** (`vlmxciuogczumumrwyot`). Running security tests or fuzzing against Production (`dhbbgfzbyatzvqafnsqp`) is **STRICTLY PROHIBITED**.
2. **Negative Testing Mandate**: Every feature enforcing authorization or validation MUST include negative test cases verifying that invalid inputs and unauthorized roles are rejected. Testing only happy paths is considered incomplete engineering.
3. **Never Disable Checks to Pass Tests**: Test code must never mock away authentication, disable RLS policies, or bypass validation checks to achieve a passing status.

---

## 2. Core Security Test Categories

### A. Authentication & Session Verification
- **Expired Token Test**: Verify that requests carrying expired JWT cookies are rejected and redirected to `/login`.
- **Forged Signature Test**: Verify that modifying JWT claims in a cookie results in immediate signature validation failure in `supabase.auth.getUser()`.
- **Header Tampering Test**: Verify that client-supplied `x-internal-user-*` headers are stripped by `proxy.ts`.

### B. RBAC & Negative Authorization Testing
- **Operator Escalation Test**: Verify that an `operator` session cannot execute administrative Server Actions (`deleteMachine`, `createClient`, `updateUserRole`, `approveFSR`).
- **Supervisor Scoping Test**: Verify that a `supervisor` can only manage machines and approve logs for sites within their operational assignment.
- **HR Scoping Test**: Verify that an `hr` user cannot modify machine operational parameters or delete machinery records.

### C. Resource-Level Authorization & BOLA / IDOR Testing
- **KYC Document Snooping**: Verify that User A cannot fetch signed URLs for User B's identity documents via `/api/documents/[id]/view` unless User A holds `admin`, `super_admin`, or `hr` role.
- **Machine Log Spoofing**: Verify that Operator A cannot submit machine hour logs for a machine currently assigned exclusively to Operator B.

### D. Input Validation & Injection Fuzzing
- **Zod Schema Rejection**: Verify that payloads with missing required fields, negative meter readings, invalid UUIDs, or strings exceeding max lengths are rejected with HTTP 400.
- **XSS Payload Filtering**: Verify that `<script>alert(1)</script>` or `javascript:void(0)` strings injected into user notes or complaints are sanitized via `sanitizeHtml`.
- **SQL Injection Safety**: Verify that PostgREST parameterized queries safely escape characters such as `' OR '1'='1`.

### E. Row Level Security (RLS) Verification
- **Direct Table Query Audit**: Execute PostgREST queries as an authenticated `operator` against `public.audit_logs`, `public.user_documents`, and `public.payroll_records`. Confirm that RLS blocks reads of unauthorized rows.

---

## 3. Existing Monorepo Security & Verification Commands

| Command | Target Scope | Security Function | Expected Result |
|---|---|---|---|
| `pnpm typecheck` | Monorepo (9 packages) | Static type safety, strict mode, zero `any` bypasses | Exit code 0, 0 errors |
| `pnpm --filter @reachinternational/permissions test` | `@reachinternational/permissions` | Verifies RBAC matrix, permission checking, route helpers | All unit tests pass |
| `node apps/mobile/run-tests.mjs` | `apps/mobile` | Mobile screen invariants, role scoping, offline queue | All 146+ tests pass |
| `node scripts/test-touch-haptics.mjs` | `apps/mobile` | Ergonomics, touch target min 44px, haptic safety | All guards verified |
| `node scripts/test-parity-rules-and-skills.mjs` | Monorepo-wide | Web & Mobile parity, token consistency, rule alignment | 100% checks pass |
| `node supabase/verify_seed.mjs` | Supabase Database | Foreign keys, table counts, database seed integrity | Seed integrity verified |
| `pnpm audit` | Dependencies | Known vulnerability scanning across npm dependencies | 0 critical/high CVEs |

---

## 4. Writing a Security Negative Test (Example)

When creating a new Server Action or API route, write automated test scenarios covering:

```ts
import { describe, it } from "node:test";
import assert from "node:assert";
import { roleHasPermission, PERMISSIONS } from "@reachinternational/permissions";

describe("Security RBAC Negative Tests", () => {
  it("operator cannot delete machines", () => {
    const canDelete = roleHasPermission("operator", PERMISSIONS.MACHINE_DELETE);
    assert.strictEqual(canDelete, false, "Operator must not have MACHINE_DELETE permission");
  });

  it("supervisor cannot delete users", () => {
    const canDeleteUser = roleHasPermission("supervisor", PERMISSIONS.EMPLOYEE_DELETE);
    assert.strictEqual(canDeleteUser, false, "Supervisor must not have EMPLOYEE_DELETE permission");
  });

  it("hr cannot delete machines", () => {
    const canDeleteMachine = roleHasPermission("hr", PERMISSIONS.MACHINE_DELETE);
    assert.strictEqual(canDeleteMachine, false, "HR must not have MACHINE_DELETE permission");
  });
});
```

---

## 5. Security Test Sign-Off Requirement

Before any feature branch is merged into `development` or `production`:
1. All static checks (`pnpm typecheck`, `pnpm check:type`) MUST pass with zero errors.
2. The author or AI agent must confirm that negative authorization scenarios have been validated.
3. Git diff must be reviewed to verify no testing bypasses or exposed credentials remain.
