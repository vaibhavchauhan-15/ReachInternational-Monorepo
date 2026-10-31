# Change-Impact Analysis & Test Selection Protocol

> **GUIDELINES FOR RIGHT-SIZED, TARGETED TEST SELECTION BASED ON CODE IMPACT**  
> *Blindly running every slow test on trivial changes wastes time; failing to run critical tests causes regressions. This document defines the exact decision matrix for mapping code changes to test selection.*

---

## 1. Purpose

The purpose of ReachInternational's Test Selection Protocol is to ensure that AI agents select the **most efficient, right-sized verification suite** matching the blast radius of their changes. Agents must never skip necessary tests, nor should they execute full production mobile builds for a one-line utility fix.

---

## 2. Applicable Applications & Packages

This decision framework applies to all changes across:
- `apps/web`
- `apps/mobile`
- `packages/*`
- `supabase`

---

## 3. Change-Impact Decision Matrix

Use this matrix to determine the mandatory test suite based on the modified files:

| Modified Location | Change Nature | Mandatory Tests (Level 1) | Extended Tests (Level 2/3) |
|---|---|---|---|
| `packages/permissions/**` | RBAC matrix, route helpers | • `pnpm --filter @reachinternational/permissions test`<br>• `pnpm typecheck` | • `node supabase/tests/test_supervisor_scoped_users_rls.mjs`<br>• Web/Mobile navigation test |
| `packages/validation/**` | Zod schema changes | • `pnpm --filter @reachinternational/validation typecheck`<br>• Schema unit tests | • Server Action mutation tests<br>• Mobile form validation tests |
| `packages/utils/**` | Formatters, payroll, overlap | • `pnpm --filter @reachinternational/utils test`<br>• `pnpm typecheck` | • Attendance/payroll integration tests |
| `packages/design-tokens/**` | Colors, spacing, typography | • `pnpm --filter @reachinternational/design-tokens test`<br>• `node scripts/check-typography.mjs` | • `node scripts/test-parity-rules-and-skills.mjs`<br>• 3-tier viewport audit |
| `supabase/migrations/**` | Schema, triggers, RLS, RPCs | • `node supabase/verify_seed.mjs`<br>• Specific `supabase/tests/*.mjs` test | • RLS regression suite (`test_operations_security_rls_regression.mjs`) |
| `apps/web/lib/dal.ts` or `lib/queries/**` | Data fetching layer | • `pnpm --filter @reachinternational/web typecheck`<br>• Edge proxy check | • Web E2E / component loading tests |
| `apps/web/app/actions/**` | Server Action mutations | • `pnpm --filter @reachinternational/web typecheck`<br>• Security role authorization test | • Form submission test & cache revalidation check |
| `apps/web/components/**` or `app/**` | UI components or pages | • `pnpm --filter @reachinternational/web typecheck`<br>• 3-tier viewport check (Mobile/Tablet/Desktop) | • Accessibility audit (`axe-core`)<br>• Parity check in `apps/mobile` |
| `apps/mobile/components/**` or `app/**` | Mobile UI or screens | • `pnpm --filter @reachinternational/mobile typecheck`<br>• `node apps/mobile/test/run-tests.mjs`<br>• `node scripts/check-typography.mjs` | • `node scripts/test-touch-haptics.mjs`<br>• Offline queue & SecureStore test |
| `security/**` or `apps/*/security/**` | Security policies | • `node scripts/verify-security-links.mjs` | • Security test audit |
| Root `package.json` or `pnpm-lock.yaml` | Dependency changes | • Full `pnpm typecheck`<br>• `pnpm lint`<br>• `pnpm audit` | • Full monorepo build (`pnpm build`) |

---

## 4. Required Testing Approach

Before running tests, the AI agent must answer these four questions:

```text
1. DIRECT BLAST RADIUS: What packages or applications contain modified files?
2. DOWNSTREAM CONSUMERS: What other packages depend on the modified package in the workspace graph?
3. SENSITIVITY LEVEL: Does this change touch authentication, RBAC, financial calculations, or database RLS?
4. CROSS-PLATFORM DRIFT: If this affects web operational UI, does mobile have a matching feature?
```

### Blast Radius Rules
- **Package Edits**: When editing `packages/*`, always run typecheck and unit tests for the package itself, AND typecheck downstream consumers (`apps/web` and `apps/mobile`).
- **Database Edits**: When modifying `supabase/migrations`, ALWAYS verify that the change targets the **Development Project** (`vlmxciuogczumumrwyot`) and execute the corresponding migration verification script.
- **UI Edits**: When editing UI components, never test only in a desktop browser. Always verify mobile viewports (≤640px) and dark/light mode token adherence.

---

## 5. Recommended Tools

- **Turborepo Filtered Execution**: `pnpm --filter <workspace-name> <command>` for isolated package runs.
- **Git Status & Diff Inspection**: Inspecting exact lines changed before test selection.
- **Workspace Dependency Inspector**: Reviewing `pnpm-workspace.yaml` and `package.json` peer dependencies.

---

## 6. Actual Project Commands

```bash
# Targeted package test execution
pnpm --filter @reachinternational/permissions test
pnpm --filter @reachinternational/utils test
pnpm --filter @reachinternational/design-tokens test

# Targeted application typechecks
pnpm --filter @reachinternational/web typecheck
pnpm --filter @reachinternational/mobile typecheck

# Targeted mobile test execution
node apps/mobile/test/run-tests.mjs
node apps/mobile/test/test-auth-workflows.mjs
node apps/mobile/test/test-shift-workflows.mjs
node apps/mobile/test/test-machines-workflows.mjs

# Targeted database test execution
node supabase/verify_seed.mjs
node supabase/tests/test_supervisor_assisted_shift_entry.mjs
node supabase/tests/test_client_shifts_and_ot.mjs
```

---

## 7. Success Criteria

1. **Precision**: All directly and indirectly affected packages are tested without skipping dependencies.
2. **Completeness**: No changed code path is left without at least Level 1 static and logic verification.
3. **Execution Efficiency**: Appropriate tests run within seconds rather than invoking unnecessary full-app builds.

---

## 8. Failure Handling

If a targeted test fails:
1. Do not broaden tests until the targeted failure is diagnosed and resolved.
2. Investigate whether the failure is caused by an outdated test expectation or an actual code regression.
3. If an upstream package caused a downstream consumer failure, fix the root contract in the upstream package.

---

## 9. Evidence & Reporting

The test report must state:
- **Change Scope**: Exactly which packages were modified.
- **Selected Suites**: The rationale for choosing the specific test commands.
- **Results**: The exact exit status and output summary.
