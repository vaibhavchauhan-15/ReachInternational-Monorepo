# Monorepo System Architecture & Design System — ServiceCentric

> *"Architecture should prevent accidental complexity, not create complexity in the name of architecture."*

---

## 1. LAYERED MONOREPO HIERARCHY & DEPENDENCY GRAPH

Dependencies flow IN ONE DIRECTION ONLY:

              [ apps/* ]
     (apps/web [@servicecentric/web], 
      apps/mobile [@servicecentric/mobile])
                    │
                    ▼
        [ shared/domain packages ]
   (@servicecentric/api-client, @servicecentric/validation, 
    @servicecentric/permissions, @servicecentric/design-tokens)
                    │
                    ▼
         [ foundation packages ]
     (@servicecentric/types, @servicecentric/utils)

### Layer Definitions:
1. **`apps/*`**: Applications (Web, Mobile) that consume shared domain and foundation packages.
2. **`shared/domain packages`**: Business logic, API client contracts (`api-client`), Zod validation schemas (`validation`), universal RBAC matrices (`permissions`), and platform-neutral design tokens (`design-tokens`) providing Web CSS custom properties and Native React Native theme object adapters.
3. **`foundation packages`**: Pure, low-level contracts (`types`, `utils`) with zero domain or platform assumptions.
4. **`tooling/config infrastructure`**: Isolated build and lint configurations (`@servicecentric/config`), treated as tooling, not runtime dependencies.

---

## 2. BOUNDARY ENFORCEMENT & IMPORT RULES

Before adding an import between workspace projects, verify that the dependency direction is valid.

### Forbidden:
- ❌ `packages/*` → `apps/*` (Packages MUST NOT import from applications)
- ❌ `foundation packages` → `shared/domain packages` (No upward dependencies)
- ❌ `Platform-neutral / foundation package` → `Platform-specific package` (Platform-neutral code MUST NOT depend on platform-specific implementation)
- ❌ `apps/web` ↔ `apps/mobile` (No cross-app imports)
- ❌ Circular workspace dependencies (Direct or indirect)
- ❌ **Deep internal imports**: Importing from another package's internal source files (e.g. `@servicecentric/utils/src/internal/date.ts`). Always import strictly through canonical package export barrels (`index.ts` / exports map).

### Allowed:
- ✅ `apps/*` → Shared domain & foundation packages
- ✅ `apps/*` → Platform-neutral packages
- ✅ Shared/domain packages → Foundation packages (`types`, `utils`)
- ✅ Platform-specific adapters → Platform-neutral core contracts
- ✅ Packages → Packages (when dependency direction remains strictly acyclic)

---

## 3. DEPENDENCY GRAPH VALIDATION PROTOCOL

Before creating or modifying any workspace dependency in `package.json`:

1. **Identify Source**: Determine the source package making the request.
2. **Identify Target**: Determine the target package being imported.
3. **Layer Audit**: Determine both projects' architectural layers.
4. **DAG Check**: Verify the proposed dependency does not violate the DAG.
5. **Cycle Detection**: Search existing workspace dependencies to ensure no circular chain is introduced.
6. **Post-Edit Verification**: Verify the workspace dependency graph remains strictly acyclic (`pnpm typecheck`).

---

## 4. ARCHITECTURAL CHANGE CONTROL

- **Do Not Refactor Unnecessarily**: Do NOT restructure, rename, extract, merge, or split packages unless:
  1. The requested task explicitly requires it,
  2. The current architecture creates a concrete, verified problem, or
  3. The change provides a measurable architectural benefit.
- **Prefer Smallest Correct Change**: Always choose the smallest, most localized modification that fulfills the requirement.
- **Scope Discipline**: Never perform opportunistic refactoring outside the assigned task scope.

---

## 5. CODE EXTRACTION & ABSTRACTION PROTOCOL

- **Rule for Extraction**: Extract code into a shared package **only when it represents the same domain concept, behavior, contract, or invariant**—not merely because similar code exists in multiple places.
- **Platform Separation**: Keep UI components and platform-specific implementations local to their respective `apps/*` unless explicitly building a unified, platform-agnostic component system.

---

## 6. PACKAGE RESPONSIBILITIES

- **`@servicecentric/types`**: Pure TypeScript interfaces, database types, DTOs, and global enums. Zero runtime dependencies.
- **`@servicecentric/validation`**: Canonical Zod schemas shared across forms, API handlers, and Server Actions.
- **`@servicecentric/permissions`**: Universal RBAC roles, permission matrices, and 3-tier scoping rules (`ORGANIZATION`, `BRANCH`, `ASSIGNED`).
- **`@servicecentric/design-tokens`**: Platform-neutral visual tokens with Web (CSS variables) and Mobile (RN style objects) adapters.
- **`@servicecentric/api-client`**: Standardized HTTP/RPC contracts, response envelopes (`ApiResponse<T>`), and API error handlers.
- **`@servicecentric/utils`**: Pure platform-neutral helper functions (date formatters, INR currency, string formatters, math).
- **`@servicecentric/config`**: Monorepo tooling and linting configurations.

---

## 7. WORKSPACE HYGIENE & TURBO ORCHESTRATION

1. **Explicit Workspace Dependencies**: Always use explicit workspace protocols (`"workspace:*"` or `"workspace:^"`) in `package.json`.
2. **No Ghost Dependencies**: Every app and package MUST declare all direct imports in its own `package.json`.
3. **Single Lockfile**: Maintain a single root lockfile (`pnpm-lock.yaml`).
4. **Turborepo Pipeline (`turbo.json`)**: Topological task graphs (`^build`, `^typecheck`) and accurate output declarations (`.next/**`, `dist/**`).

---

## 8. APPLICATION & LAYER ARCHITECTURE (Web & Mobile)

### Presentation Layer (`apps/web/app/(app)`, `apps/mobile/app/(app)`)
- **Server Components (RSC - Web)**: Responsible for initial page render, DAL query invocation, and streaming.
- **Client Components (`'use client'` - Web / Native - Mobile)**: Interactive UI widgets, modals, charts, command palette (`CommandPalette.tsx`), and Expo Router tabs.

### Data Access Layer (`apps/web/lib/dal.ts`, `apps/web/lib/queries/*`)
- Enforces session verification and role check before query execution.
- Contains RPC invocations for optimized dashboard queries.
- Caches queries via React `cache()` in `apps/web/lib/cache.ts`.

### Server Actions (`apps/web/app/actions/*`)
- Handles form submissions and UI mutations.
- Enforces schema validation using Zod (`@servicecentric/validation`).
- Writes to `audit_logs` using `lib/audit.ts` for all mutation events.
- Triggers notifications via `lib/notifications/*`.

### Database & Auth Layer (`apps/web/lib/supabase/*`, `apps/mobile/lib/supabase.ts`)
- Client split:
  - `lib/supabase/server.ts`: Server-side client using cookies (SSR).
  - `lib/supabase/browser.ts`: Browser-side client.
  - `lib/supabase/admin.ts`: Service role admin client for elevated operations.
  - `apps/mobile/lib/supabase.ts`: Expo mobile client using custom storage adapter for session persistence.
