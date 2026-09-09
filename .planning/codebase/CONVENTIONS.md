# Coding Conventions

**Analysis Date:** 2026-09-09

## Naming Patterns

**Files & Directories:**
- React Components: PascalCase (`apps/web/components/machines/MachineModal.tsx`, `apps/web/components/operations/OperationsClient.tsx`).
- Utility & Action Files: kebab-case (`apps/web/lib/utils.ts`, `apps/web/app/actions/machines.ts`, `apps/web/lib/audit-helpers.ts`).
- Query Modules: kebab-case under `apps/web/lib/queries/` (`users.ts`, `operators.ts`, `audit-logs.ts`).
- Route Folders: kebab-case, leveraging Next.js route groups `(app)/` and `(auth)/`.
- Database Migrations: 3-digit zero-padded sequential number with descriptive snake_case (`supabase/migrations/058_optimize_hour_logs_pagination.sql`).
- Test Files: snake_case with `test_` prefix under `supabase/tests/` (`test_operator_complete_matrix.mjs`, `test_future_shift_validation.mjs`).

**Functions & Identifiers:**
- Functions & Actions: camelCase with clear verb prefixes (`getUserList()`, `updateUserSupervisor()`, `submitOperatorLogAction()`, `formatCurrency()`).
- Event Handlers: camelCase with `handle` prefix (`handleSearchChange()`, `handlePageChange()`, `handleSubmit()`).
- Constants & Enums: UPPER_SNAKE_CASE (`USER_ROLES`, `TAGS`, `CACHE_TIERS`, `USER_SELECT_COLUMNS`).
- Types & Interfaces: PascalCase, avoiding Hungarian `I` prefixes (`User`, `MachineRecord`, `AuditLogEntry`, `PaginationProps`).

## Code Style & Formatting

**TypeScript & Strictness:**
- Strict Mode: Enforced across all packages (`tsconfig.json: "strict": true`, `"noImplicitAny": true`).
- Zero Type Errors: Monorepo-wide zero tolerance for typecheck regressions (`pnpm typecheck` or `turbo run typecheck` must pass with 0 errors across all packages).
- Canonical Barrels & Monorepo Layering:
  - All inter-package imports must use canonical root barrel exports (`import { ... } from "@reachinternational/types"`).
  - Deep imports into internal files (e.g., `@reachinternational/types/src/database`) are strictly forbidden.
  - Dependencies follow a strict DAG: `apps/*` → `packages/*`. Apps never import from apps, and packages never import from apps.

**Styling & Design Tokens (Vercel Geist System):**
- Strict adherence to `DESIGN.md` and `AI/RULES/DESIGN-SYSTEM.md`:
  - Canvas: `#fafafa` (light), `#000000` (dark)
  - Elevated Surface: `#ffffff` (light), `#0a0a0a` (dark)
  - Ink / Text: `#171717` (light), `#ededed` (dark)
  - Hairline Borders: 1px `#ebebeb` (light), `#262626` (dark)
  - Primary Brand Accent: `#0070f3` (link blue)
  - Fonts: Geist Sans and Geist Mono
- Class Merging: Dynamic classes must use `cn()` (`tailwind-merge` + `clsx`).

**Import Organization:**
Imports must be grouped in the following order, separated by blank lines:
1. React and Next.js / Expo framework primitives (`import React, { useState, useTransition } from "react"`, `import Link from "next/link"`).
2. Third-party libraries (`import { createClient } from "@supabase/supabase-js"`, `import { LucideIcon } from "lucide-react"`).
3. Monorepo shared packages (`@reachinternational/types`, `@reachinternational/permissions`, `@reachinternational/validation`).
4. Internal aliases (`@/components/ui/Table`, `@/lib/dal`).
5. Local relative imports (`./UserRow`, `./MobileUserCard`).
6. Explicit type-only imports (`import type { User, PaginationProps } from "..."`).

## Error Handling & Mutations

**Server Actions Pattern:**
- Always wrap database updates and third-party API calls in structured `try / catch` blocks.
- Verify user session and permissions via `lib/dal.ts` and `@reachinternational/permissions` before executing mutations.
- Validate incoming arguments using canonical Zod schemas from `@reachinternational/validation`.
- Return standardized result envelopes:
  ```typescript
  // Success
  return { success: true, data: result };
  // Failure
  return { success: false, error: "Failed to update record: " + error.message };
  ```
- Elevated and state-changing mutations must call `logAudit()` in `apps/web/lib/audit.ts` to capture an immutable audit log entry.

**Data Access & Query Pattern:**
- Never use `SELECT *` in production queries. Always project explicit column lists (e.g., `USER_SELECT_COLUMNS`).
- Hydrate related entities in parallel using `Promise.all()` to avoid sequential waterfalls.
- Use resilient 3-tier fallbacks for complex relational joins to prevent catastrophic UI errors when optional foreign keys are null.

## Viewport Responsiveness & Web-to-Mobile Parity

**3-Tier Viewport Responsiveness:**
- **Mobile (≤640px)**: Reflow tables into high-touch cards (`block sm:hidden`), use scrollable horizontal toolbars (`overflow-x-auto`), ensure minimum 44px touch targets.
- **Tablet (641px–1023px)**: Adaptive 2-column grid layouts (`grid-cols-1 sm:grid-cols-2`), compact header controls, responsive modals.
- **Desktop (≥1024px)**: High-density data tables (`hidden sm:block`), multi-column metric grids, hover tooltips (`<TooltipWrapper>`).

**Mandatory Web-to-Mobile Synchronization:**
- Whenever any UI feature, form field, status badge, modal, or workflow is added or modified in `apps/web`, the exact same capability must be synchronized to `apps/mobile` in the same task.
- Parity ensures operational consistency for field workers using mobile devices and managers using desktop browsers.

---

*Conventions analysis: 2026-09-09*
*Update when coding standards or architectural guidelines evolve*
