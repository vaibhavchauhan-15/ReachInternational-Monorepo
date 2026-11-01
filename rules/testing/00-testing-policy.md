# Global Testing Policy & Quality Gate Protocol

> **MANDATORY GLOBAL TESTING POLICY — ENFORCED FOR ALL AGENTS AND MODULES**  
> *This policy establishes the non-negotiable verification gates, testing lifecycle, and core quality invariants that every AI coding agent must enforce across all repositories, applications, and packages.*

---

## 1. Purpose

The purpose of ReachInternational's Global Testing Policy is to ensure that **no code change is merged, committed, or reported as complete based purely on visual inspection or partial compilation**. Every modification to software in this monorepo must withstand a rigorous multi-tier quality gate prior to completion.

A feature, bug fix, or refactor is complete ONLY when:
$$\text{Correctness} + \text{Types} + \text{Lint} + \text{Security} + \text{Responsiveness} + \text{Performance} + \text{Parity} = \text{VERIFIED}$$

---

## 2. Applicable Applications & Packages

This policy applies universally to:
- `apps/web`: Next.js 16.2 App Router (Marketing, Auth, and Operational Admin routes)
- `apps/mobile`: React Native / Expo SDK 57 (Android and iOS applications)
- `packages/design-tokens`: Shared design tokens, typography, and Geist system
- `packages/permissions`: Canonical RBAC matrix and route permission gates
- `packages/types`: Shared TypeScript interfaces and Supabase database schemas
- `packages/validation`: Zod schemas for all inbound mutation payloads
- `packages/utils`: Shared formatting, salary, shift overlap, and error utilities
- `supabase`: PostgreSQL schemas, migrations, RPCs, and Row Level Security policies

---

## 3. Testing Targets

Every code modification must verify the following core targets:

1. **Syntactic & Static Integrity**: Strict TypeScript compilation and zero lint warnings.
2. **Runtime Contract Adherence**: Zod schema validation against both valid and invalid boundary payloads.
3. **Authorization & Data Isolation**: Deny-by-default access, multi-role scoping, and RLS enforcement.
4. **Visual & Ergonomic Parity**: 100% adherence to `DESIGN.md` tokens across both Web and Native Mobile.
5. **Operational State Resilience**: Proper behavior across loading, empty, error, and offline states.
6. **Cross-Platform Synchronization**: Zero behavioral or aesthetic drift between Web and Mobile implementations.

---

## 4. Required Testing Approach

Testing in ReachInternational follows a mandatory four-stage lifecycle:

```text
[ STAGE 1: DISCOVERY & PRE-TESTING ]
  ├── Read rules/testing/README.md and relevant testing rules
  ├── Analyze git status, affected files, and dependency graph
  └── Classify execution level (Level 1, Level 2, or Level 3)

[ STAGE 2: IMPLEMENTATION & INVARIANT PRESERVATION ]
  ├── Write code adhering to domain rules and design tokens
  ├── Preserve existing validations, constraints, and RLS policies
  └── Maintain 100% Web & Mobile parity for cross-platform features

[ STAGE 3: MULTI-TIER TEST EXECUTION ]
  ├── Mandatory: Static type checking (pnpm typecheck)
  ├── Mandatory: Targeted unit and module tests
  ├── Conditional: Integration, database, and responsive audits
  └── Conditional: Build verification for affected applications

[ STAGE 4: REPORTING & EVIDENCE GENERATION ]
  ├── Compile executed commands, terminal outputs, and statuses
  └── Output standardized test report adhering to 14-test-reporting.md
```

### The Three Testing Execution Levels

| Execution Level | Trigger Condition | Mandatory Verification Scope |
|---|---|---|
| **Level 1 — Every Code Change** | Any edit to `.ts`, `.tsx`, `.mjs`, `.sql` | • `pnpm typecheck` (affected package)<br>• Relevant package lint<br>• Targeted unit/module test<br>• Import and diff hygiene audit |
| **Level 2 — Feature Completion** | New screen, action, API, or migration | • All Level 1 checks<br>• Integration / DAL tests<br>• 3-tier responsive viewport test<br>• RBAC / security negative tests<br>• Mobile test suite (`run-tests.mjs`) |
| **Level 3 — Release Acceptance** | Production deploy, schema refactor, package bump | • All Level 2 checks<br>• Full monorepo typecheck & lint<br>• Production Web build (`pnpm build`)<br>• Mobile export / prebuild validation<br>• Database seed & migration replay |

---

## 5. Recommended Tools & Infrastructure

- **Package & Task Runner**: Turborepo 2.11+ with pnpm 11+
- **Static Analysis**: TypeScript 5.0+ (Strict Mode), ESLint 9+
- **Unit & Logic Testing**: Node.js Native Test Runner (`node --test --experimental-strip-types`)
- **Mobile Workflow Verification**: Custom fast test runners (`node apps/mobile/test/run-tests.mjs`)
- **Database Auditing**: Supabase CLI, Node pg/supabase client scripts (`verify_seed.mjs`)
- **Mobile Ergonomics**: Custom guards (`check-typography.mjs`, `test-touch-haptics.mjs`)
- **Parity Auditing**: Parity validator (`test-parity-rules-and-skills.mjs`)

---

## 6. Actual Project Commands

The following commands are available and must be used directly by agents:

```bash
# 1. Monorepo-wide static verification
pnpm typecheck
pnpm lint

# 2. Package-specific unit tests
pnpm --filter @reachinternational/permissions test
pnpm --filter @reachinternational/utils test
pnpm --filter @reachinternational/design-tokens test

# 3. Mobile application verification
node apps/mobile/test/run-tests.mjs
node scripts/check-typography.mjs
node scripts/test-touch-haptics.mjs

# 4. Monorepo parity & cross-links
node scripts/test-parity-rules-and-skills.mjs
node scripts/verify-security-links.mjs

# 5. Database & seed integrity
node supabase/verify_seed.mjs

# 6. Production application build verification
pnpm --filter @reachinternational/web build
```

---

## 7. Success Criteria

A task passes the Global Testing Policy only when:
1. **Zero Errors**: All executed test commands exit with code `0`.
2. **Zero Invariant Violations**: No TypeScript type assertions (`as any`), `@ts-ignore`, or disabled lints were added.
3. **Zero Security Regressions**: No RLS policies were bypassed or disabled; all mutations enforce RBAC.
4. **Parity Maintained**: Any change in `apps/web` has an identical implementation in `apps/mobile`.
5. **Clean Diff**: `git diff` contains no leftover `console.log` statements or commented-out code.

---

## 8. Failure Handling Protocol

When any test command fails, AI agents MUST follow this non-negotiable loop:

```text
FAIL → READ COMPLETE ERROR → IDENTIFY ROOT CAUSE → APPLY FIX → RE-RUN SUITE → VERIFY PASS
```

- **NEVER** ignore an error to declare a task complete.
- **NEVER** hide or suppress error messages.
- **NEVER** delete or disable an existing test to make a suite pass.
- **NEVER** alter business requirements merely to accommodate failing tests.

---

## 9. Evidence & Reporting Requirements

Every task completion message MUST include an explicit Test Execution Report following [`14-test-reporting.md`](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/rules/testing/14-test-reporting.md). Claims such as "tested and verified" without concrete command outputs are rejected.
