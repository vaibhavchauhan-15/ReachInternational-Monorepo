# Code Quality, TypeScript & Static Analysis Rules

> **STATIC ANALYSIS, TYPE SAFETY, LINTING, AND PACKAGE INTEGRITY STANDARDS**  
> *Static analysis is the first line of defense. Code that does not pass strict type checking and linting is considered defective regardless of runtime behavior.*

---

## 1. Purpose

The purpose of ReachInternational's Code Quality & Static Analysis standards is to maintain a monorepo that is **strictly typed, free of dead code, compliant with workspace import boundaries, and free of circular dependencies**.

---

## 2. Applicable Applications & Packages

- `apps/web` (Next.js 16.2 App Router, TypeScript 5)
- `apps/mobile` (Expo SDK 57, React Native 0.86, TypeScript 5)
- `packages/*` (`@reachinternational/permissions`, `@reachinternational/validation`, `@reachinternational/types`, `@reachinternational/design-tokens`, `@reachinternational/utils`)

---

## 3. Testing Targets & Invariants

### A. TypeScript Strictness
1. **Zero `any` Policy**: The use of `any` is strictly prohibited unless interfacing with un-typed third-party binary libraries, and even then, must be constrained via `unknown` with runtime type narrowing.
2. **No `@ts-ignore` or `@ts-nocheck`**: Suppressing compiler errors is forbidden. Use `@ts-expect-error` only with an accompanying ticket or detailed explanatory comment.
3. **Exact Database Projections**: Never type database responses as `any`. Always use types derived from Supabase schema types in `@reachinternational/types/src/database.ts`.
4. **Strict Null Checks**: All optional fields must be properly handled with optional chaining (`?.`) or nullish coalescing (`??`).

### B. Linting & Formatting
1. **ESLint 9 Flat Config**: All code in `apps/web` and `apps/mobile` must pass ESLint without errors.
2. **React 19 & Next.js 16 Rules**: Follow Rules of Hooks, Server Component boundaries, and async route parameter unwrapping (`const { id } = await params`).
3. **Zero Console Statements**: Production code must not contain `console.log()` statements. Use structured logging via Sentry or monorepo logging utilities.

### C. Package Boundaries & Import Integrity
1. **Workspace Protocol**: Inter-package imports must use workspace protocol packages:
   - Correct: `import { Button } from '@reachinternational/design-tokens';`
   - Incorrect: `import { Button } from '../../../packages/design-tokens/src/Button';`
2. **No Deep Private Imports**: Never import from non-exported paths inside internal package directories. Use package root exports defined in `package.json#exports`.
3. **Zero Circular Dependencies**: Modules within packages and applications must maintain a strict directed acyclic graph (DAG).

### D. Dead-Code Elimination
1. **Unused Imports & Variables**: Remove unused imports, unreferenced variables, and dead helper functions before completing any task.
2. **Deprecated Components**: Do not leave commented-out legacy code in working files.

---

## 4. Required Testing Approach

```text
[ CODE MODIFICATION ]
       │
       ▼
[ VERIFY IMPORTS & BOUNDARIES ]
  └── Ensure no deep relative imports cross package roots
       │
       ▼
[ RUN STRICT TYPECHECK ]
  └── pnpm typecheck (Exit code 0, 0 compiler errors)
       │
       ▼
[ RUN LINT & CODE QUALITY CHECKS ]
  └── pnpm lint (Exit code 0, 0 warnings/errors)
       │
       ▼
[ AUDIT DIFF HYGIENE ]
  └── git diff inspection (Zero console.log, zero commented code)
```

---

## 5. Recommended Tools

- **TypeScript Compiler**: `tsc --noEmit` via Turborepo
- **ESLint**: Next.js & React Native ESLint configs
- **Dependency & Lockfile Inspector**: `pnpm install --frozen-lockfile`

---

## 6. Actual Project Commands

```bash
# 1. Monorepo-wide typecheck across all 9 packages
pnpm typecheck

# 2. Package-specific typecheck
pnpm --filter @reachinternational/web typecheck
pnpm --filter @reachinternational/mobile typecheck
pnpm --filter @reachinternational/permissions typecheck
pnpm --filter @reachinternational/validation typecheck
pnpm --filter @reachinternational/types typecheck
pnpm --filter @reachinternational/utils typecheck
pnpm --filter @reachinternational/design-tokens typecheck

# 3. Monorepo linting
pnpm lint

# 4. Mobile typography guard (detects raw styles bypassing design tokens)
node scripts/check-typography.mjs
```

---

## 7. Success Criteria

1. `pnpm typecheck` exits with code `0` and reports `0 errors`.
2. `pnpm lint` exits with code `0`.
3. `node scripts/check-typography.mjs` reports `Found 0 typography property instances across apps/mobile`.
4. Git diff audit shows zero debug statements, zero `@ts-ignore`, and clean import statements.

---

## 8. Failure Handling

- If TypeScript fails with a missing property: check the canonical types in `@reachinternational/types` and adjust the query projection or model definition rather than casting to `any`.
- If ESLint flags an unhandled Promise or Hook dependency: resolve the dependency array or await the Promise properly; never disable ESLint rules inline without architect approval.

---

## 9. Evidence & Reporting

The test report must include:
- Package typecheck status (`PASS` / `FAIL`).
- Number of type errors encountered and resolved.
- Output from `check-typography.mjs` when mobile code is modified.
