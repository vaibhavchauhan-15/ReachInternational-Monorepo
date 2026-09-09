# Architecture

**Analysis Date:** 2026-09-09

## Pattern Overview

**Overall:** Enterprise Turborepo Monorepo with Clean Separation of Concerns, Strict Unidirectional Layering (DAG), Data Access Layer (DAL), and React Server Components (RSC) Architecture.

**Key Characteristics:**
- **Unidirectional Dependency Flow**: `apps/web` and `apps/mobile` consume shared domain packages in `packages/*`. Packages never import from apps, and foundation packages never import from higher-level domain packages.
- **Server-Driven Data & Mutations**: Web data fetching is concentrated in server components and DAL queries (`apps/web/lib/queries/*`), while mutations are isolated in audited Server Actions (`apps/web/app/actions/*`).
- **3-Tier Viewport Parity**: Desktop (high-density tables), Tablet (adaptive 2-col grids), and Mobile (touch cards, bottom sheets) share an identical visual language, design tokens, and domain logic.
- **Strict Database Security**: Multi-tenant Row Level Security (RLS), security-definer RPCs for privileged workflows, append-only tamper-proof audit logs, and zero client exposure of service keys.

## Layers

**1. Presentation Layer (Web & Mobile UIs):**
- Purpose: Render accessible, responsive interfaces adhering to Vercel Geist design tokens (`#171717` ink, `#fafafa` canvas, `#ffffff` elevated, `#0070f3` link blue).
- Contains:
  - Web: Next.js App Router RSC pages (`apps/web/app/(app)/*`), client interactive components (`'use client'`), modals, sheets, and tables.
  - Mobile: Expo Router screen views (`apps/mobile/app/(app)/*`), touch cards, and bottom sheet modals.
- Depends on: Shared domain packages (`@reachinternational/*`), UI components (`components/ui/*`), DAL queries, and Server Actions.

**2. Application & Mutation Layer (Server Actions & Route Handlers):**
- Purpose: Execute business logic, validate inputs, enforce permissions, and orchestrate transactional mutations.
- Contains:
  - Server Actions in `apps/web/app/actions/*` (`auth.ts`, `users.ts`, `machines.ts`, `operators.ts`, `rentals.ts`, etc.).
  - Next.js Route Handlers in `apps/web/app/api/*` (health checks, webhooks, QStash cron triggers).
- Depends on: `@reachinternational/validation`, `@reachinternational/permissions`, `lib/dal.ts`, `lib/audit.ts`, `lib/supabase/*`.
- Used by: Presentation layer client components and external webhooks.

**3. Data Access Layer (DAL) & Caching Layer:**
- Purpose: Abstract data retrieval, execute projection queries, hydrate relations in parallel, and cache expensive computations.
- Contains:
  - Canonical DAL in `apps/web/lib/dal.ts`.
  - Domain query modules in `apps/web/lib/queries/*` (`users.ts`, `machines.ts`, `operators.ts`, `audit-logs.ts`, `clients.ts`).
  - Cache tiering in `apps/web/lib/cache.ts` using `unstable_cache` with tag-based revalidation (`TAGS.*`).
- Depends on: `@supabase/supabase-js`, `@supabase/ssr`, `@reachinternational/types`.
- Used by: RSC pages and Server Actions.

**4. Domain Logic & Foundation Packages (`packages/*`):**
- Purpose: Provide platform-agnostic types, validation schemas, RBAC rules, design tokens, and utility functions shared between Web and Mobile.
- Contains:
  - `packages/types`: Database row schemas, domain models, audit taxonomy.
  - `packages/permissions`: Role definitions, capability matrices, supervised role checks.
  - `packages/validation`: Zod schemas for forms and server action payloads.
  - `packages/design-tokens`: Shared CSS variables, color hexes, radii, and typography scales.
  - `packages/utils`: Date helpers, currency formatters, and math functions.
- Depends on: Zero internal workspace dependencies (strictly foundational).

**5. Database & Persistence Layer (`supabase/*`):**
- Purpose: Relational data storage, data integrity enforcement, Row Level Security, and atomic business procedures.
- Contains:
  - 58 PostgreSQL migrations in `supabase/migrations/`.
  - Triggers (`handle_new_user`, `sync_user_supervisor_array`, `prevent_overlapping_shifts`).
  - Security-definer stored procedures (`get_active_supervisors_public`, `assign_machine_operator_atomic`).

## Data Flow

**Typical Mutation Flow (e.g., Operator Shift Hour Log Submission):**
1. **User Action**: Machine operator fills shift hour log form on mobile (`apps/mobile/components/work/MeterLogModal.tsx`) or web (`apps/web/components/dashboard/OperatorDashboard.tsx`).
2. **Client Validation**: Form performs preflight schema check using canonical Zod validation from `@reachinternational/validation`.
3. **Server Action Invocation**: Action `submitOperatorLogAction` executes in `apps/web/app/actions/operators.ts`.
4. **Authorization & Session Verification**: Action queries `lib/dal.ts` to verify active auth session and validate that actor role matches operator/supervisor privileges.
5. **Database Transaction / Atomic RPC**: Action submits data to PostgreSQL, triggering database-level sequence validation, shift overlap checks, and breakdown linkage.
6. **Audit Trail Logging**: Action calls `logAudit()` in `lib/audit.ts` to log Before/After diffs and actor IP to `public.audit_logs`.
7. **Cache Invalidation**: Action calls `revalidateTag(TAGS.operators)` and `revalidatePath('/operations')`.
8. **UI State Update**: Web transitions state seamlessly via `useTransition`, or mobile TanStack Query invalidates query cache.

**Typical Query Flow (e.g., High-Density Paginated Users Directory):**
1. **Request**: User visits `/users?page=2&search=operator`.
2. **RSC Execution**: `apps/web/app/(app)/users/page.tsx` parses URL search params.
3. **DAL Query**: Calls `getUserList()` and `getUserListAggregatesCached()` in `apps/web/lib/queries/users.ts`.
4. **Relational Hydration**: Supervisors and working locations are hydrated concurrently via `Promise.all()` from memory cache or indexed ID maps.
5. **Streamed Response**: Server streams HTML containing pre-rendered table and `<Pagination>` component with zero client-side waterfall latency.

## Key Abstractions

**1. Data Access Layer (DAL):**
- Purpose: Central gatekeeper verifying request-scoped authentication and returning typed database models.
- File: `apps/web/lib/dal.ts`.

**2. Audited Mutation Pattern:**
- Purpose: Every create/update/delete operation writes a structured audit log before returning to the caller.
- Files: `apps/web/lib/audit.ts`, `apps/web/lib/audit-helpers.ts`.

**3. Canonical Pagination:**
- Purpose: Standardized desktop table and mobile touch card pagination handling large datasets (>20 rows).
- Files: `apps/web/components/ui/Table.tsx` (`<Pagination />`), integrated across all 39 routes.

**4. Permission & Role Guards:**
- Purpose: Deterministic RBAC ensuring only authorized roles access operational domains.
- Files: `packages/permissions/src/roles.ts`, `packages/permissions/src/guards.ts`.

## Entry Points

**Web Entry Points:**
- Root Layout: `apps/web/app/layout.tsx` - Providers (Theme, Tooltip), global security headers, root styling.
- App Shell: `apps/web/app/(app)/layout.tsx` - Authenticated dashboard layout with `AppSidebar.tsx` and `MobileBottomNav.tsx`.
- Public Routes: `apps/web/app/login/page.tsx`, `apps/web/app/signup/page.tsx`, `apps/web/app/forgot-password/page.tsx`.

**Mobile Entry Points:**
- App Root: `apps/mobile/app/_layout.tsx` - Expo Router root provider, Supabase session provider, and QueryClient provider.
- Navigation Router: `apps/mobile/app/(app)/_layout.tsx` - Native stack navigation and bottom tab bar.

## Error Handling

**Strategy:** Multi-tier defensive error handling with non-crashing UI boundaries, structured error envelopes, and user-friendly toast notifications.
- **Server Actions**: Return standardized result envelopes `{ success: false, error: string, details?: unknown }` instead of uncaught throws.
- **Client Components**: Display inline error states or toast banners (`@/components/ui/Toast.tsx`).
- **Next.js Boundaries**: `error.tsx` catches unexpected runtime crashes per route group.

---

*Architecture analysis: 2026-09-09*
*Update after major architectural or structural changes*
