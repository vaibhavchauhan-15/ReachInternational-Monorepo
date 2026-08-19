# Coding & Architecture Rules — ServiceCentric

1. **Strict TypeScript & Explicit Types**: Avoid using `any` or `@ts-ignore`. Define data models in `@servicecentric/types` or `lib/types/*` and infer from Supabase Database Types.
2. **Server First Architecture (RSC)**: Default to React Server Components unless client interactivity (state, click handlers, animations, hooks) is strictly required. Use `'use client'` only at the lowest component level.
3. **Data Access Layer Enforcement**: Never write ad-hoc raw Supabase select queries inside UI components. Use `lib/dal.ts` or `lib/queries/*`.
4. **Server Actions for Mutations**: Handle all POST/PUT/DELETE operations in `app/actions/*`. Validate inputs with canonical Zod schemas from `@servicecentric/validation`.
5. **Monorepo Layering & One-Way Dependency Flow**:
   - Dependencies flow strictly: `apps/*` → `shared/domain packages` → `foundation packages` (`types`, `utils`).
   - Packages MUST NOT import from applications (`packages/*` → `apps/*` forbidden).
   - Foundation packages MUST NOT import from shared domain packages.
   - Cross-app imports (`apps/web` ↔ `apps/mobile`) are strictly prohibited.
   - Circular workspace dependencies are forbidden.
6. **Canonical Package Export Barrels & No Deep Internal Imports**:
   - Always import strictly through canonical package export barrels (`index.ts` / exports map).
   - Deep internal file imports (e.g. `@servicecentric/utils/src/internal/date.ts`) are strictly forbidden.
7. **Architectural Change Control & Blast Radius Management**:
   - Do NOT refactor, rename, extract, or split packages unnecessarily without explicit requirement or a verified concrete problem.
   - Always choose the smallest, most localized modification that satisfies requirements.
   - Synchronous Contract Updates: If an exported function signature, schema, or type changes in a shared package, refactor all consuming call-sites across `apps/web` and `apps/mobile` in the same task.
8. **Code Extraction & Abstraction Protocol**:
   - Extract code into shared packages ONLY when it represents the same domain concept, behavior, contract, or invariant—not merely because similar code exists in multiple places.
   - Keep platform UI components and platform-specific implementations local to `apps/web` and `apps/mobile`.
9. **Workspace Hygiene & Dependency Declaration**:
   - Always use explicit workspace protocols (`"workspace:*"` or `"workspace:^"`) in `package.json`.
   - No ghost dependencies: declare all direct imports explicitly in package dependencies.
10. **Verification Integrity & Zero Error Guarantee**:
    - Never disable TypeScript strictness, cast to `any`, or insert `@ts-ignore` to bypass type errors.
    - Never suppress ESLint errors without explicit justification or comment out failing tests.
    - Run workspace-wide typechecking (`pnpm typecheck`) and guarantee **0 compilation errors across all 9 workspace projects** before finalizing tasks.
11. **Clean Imports**: Use `@/` alias for root path imports (`@/components/...`, `@/lib/...`) within apps.
12. **No Silent Error Swallowing**: Always handle errors explicitly in Server Actions and log via `console.error` or return `{ success: false, error: string }`.
13. **No Hardcoded Values**: Environmental keys (Supabase URL/Key, SendGrid API key, Twilio credentials) must be read from `process.env`.
14. **Exclusive Package Manager Rule**: Use strictly `pnpm` (`pnpm install`, `pnpm dev`, `pnpm build`, `pnpm typecheck`, `pnpm lint`) across the monorepo workspace. Never use `npm` or mix package managers.
15. **Documentation Synchronization**: Automatically update `AI/STATE.md`, `AI/CHANGELOG_AI.md`, `AI/CURRENT_TASK.md`, and `README.md` whenever features, packages, roles, or database schemas are modified.
