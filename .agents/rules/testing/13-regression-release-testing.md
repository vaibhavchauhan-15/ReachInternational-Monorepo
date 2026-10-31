# Regression & Release Acceptance Testing Standards

> **LEVEL 3 COMPREHENSIVE MONOREPO VERIFICATION FOR RELEASES AND DEPLOYMENTS**  
> *Before any release, production deployment, major dependency upgrade, or database refactoring, the entire monorepo must pass this comprehensive acceptance battery.*

---

## 1. Purpose

The purpose of ReachInternational's Regression & Release Acceptance Testing standards is to provide **absolute confidence that a release introduces zero regressions in existing workflows, zero security vulnerabilities, zero database migration deadlocks, and zero broken builds across Web and Native Mobile**.

---

## 2. Applicable Applications & Packages

- `apps/web`: Production Next.js build and route compilation
- `apps/mobile`: Expo EAS build readiness, asset bundling, and native compatibility
- `packages/*`: All 5 workspace packages compiled and verified
- `supabase`: PostgreSQL migration replay, seed integrity, and RLS regression suite

---

## 3. Level 3 Release Acceptance Invariants

A release is approved for production deployment ONLY when every step of the Level 3 battery passes:

```text
┌───────────────────────────────────────┬──────────────────────────────────────────┐
│ VERIFICATION GATE                     │ REQUIRED ACCEPTANCE CRITERIA             │
├───────────────────────────────────────┼──────────────────────────────────────────┤
│ 1. Monorepo Typecheck                 │ pnpm typecheck exits 0 across 9 packages │
│ 2. Monorepo Linting                   │ pnpm lint exits 0 with zero warnings     │
│ 3. All Unit & Package Tests           │ permissions, utils, tokens test suites   │
│ 4. Mobile Test Battery                │ 357/357 scenarios in run-tests.mjs pass  │
│ 5. Database Seed & FK Integrity       │ verify_seed.mjs reports 0 broken links   │
│ 6. RLS Security Regression            │ test_operations_security_rls_regression  │
│ 7. Production Web Build               │ pnpm build succeeds (0 compilation errs)│
│ 8. Mobile Prebuild / Assets           │ EAS configuration and assets verified    │
│ 9. Web & Mobile 100% Parity           │ test-parity-rules-and-skills.mjs passes  │
│ 10. Zero Secret Exposure              │ git diff audit confirms 0 leaked secrets │
└───────────────────────────────────────┴──────────────────────────────────────────┘
```

---

## 4. Required Testing Approach

Follow this exact sequence before deploying any release:

```text
[ STAGE 1: MONOREPO STATIC INTEGRITY ]
  ├── Run pnpm typecheck (Strict TypeScript verification)
  └── Run pnpm lint (Code quality & import verification)

[ STAGE 2: DOMAIN LOGIC & WORKFLOWS ]
  ├── Run pnpm --filter @reachinternational/permissions test
  ├── Run pnpm --filter @reachinternational/utils test
  └── Run node apps/mobile/test/run-tests.mjs

[ STAGE 3: DATABASE MIGRATION REPLAY ]
  ├── Verify seed integrity: node supabase/verify_seed.mjs
  └── Run RLS regression: node supabase/tests/test_operations_security_rls_regression.mjs

[ STAGE 4: PRODUCTION BUILD VERIFICATION ]
  ├── Run pnpm --filter @reachinternational/web build
  └── Confirm all static and dynamic routes generate without errors

[ STAGE 5: DIFF & SECRET HYGIENE AUDIT ]
  ├── Run pnpm audit (Zero high/critical CVEs)
  └── Inspect git diff for zero committed credentials or debug logs
```

---

## 5. Recommended Tools

- **Turborepo**: Monorepo-wide pipeline execution (`turbo run build typecheck lint`)
- **EAS CLI**: Mobile app build and profile validation (`eas build --profile preview`)
- **Git Hygiene**: `git diff --staged` and security scanners

---

## 6. Actual Project Commands

```bash
# 1. Complete monorepo static verification
pnpm typecheck
pnpm lint

# 2. Package unit tests
pnpm --filter @reachinternational/permissions test
pnpm --filter @reachinternational/utils test
pnpm --filter @reachinternational/design-tokens test

# 3. Mobile verification battery
node apps/mobile/test/run-tests.mjs
node scripts/check-typography.mjs
node scripts/test-touch-haptics.mjs

# 4. Database integrity & RLS regression
node supabase/verify_seed.mjs
node supabase/tests/test_operations_security_rls_regression.mjs
node supabase/tests/test_client_shifts_and_ot.mjs

# 5. Parity & documentation links
node scripts/test-parity-rules-and-skills.mjs
node scripts/verify-security-links.mjs

# 6. Production Web build
pnpm --filter @reachinternational/web build

# 7. Dependency vulnerability scan
pnpm audit
```

---

## 7. Success Criteria

1. **Zero Failures**: Every executed command must return exit code `0`.
2. **Production Bundle Generated**: Next.js App Router successfully produces `.next/standalone` production artifacts.
3. **100% Parity Verified**: Web and Mobile parity tests report 0 token or UX drift.
4. **Isolated DB Targeted**: Verified that all migrations and tests were executed exclusively against the Development project (`vlmxciuogczumumrwyot`).

---

## 8. Failure Handling

If ANY check in the Level 3 battery fails:
- **HALT THE RELEASE IMMEDIATELY**.
- Do not deploy or merge the release branch.
- Read the full error log, isolate the failing workspace package, resolve the root cause, and re-execute the entire Level 3 battery from Stage 1.

---

## 9. Evidence & Reporting

The release acceptance report must provide:
- Comprehensive checklist of all 7 execution steps.
- Production build output summary.
- Explicit sign-off declaring the release candidate production-ready.
