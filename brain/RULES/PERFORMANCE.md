# ReachInternational Production Performance & Optimization Rules

> **AUTHORITATIVE PERFORMANCE & OPTIMIZATION POLICY FOR AI AGENTS**  
> *This document establishes the binding performance engineering policy for all applications (`apps/web`, `apps/mobile`), shared packages (`packages/*`), data access layers (`lib/dal.ts`), server actions, database queries, assets, and rendering pipelines in the ReachInternational monorepo. Performance MUST be treated as a core product requirement, not as a final-stage optimization task. Every AI coding agent MUST read, obey, and enforce these rules before writing or modifying any code in this repository.*

---

## 1. Purpose

The purpose of ReachInternational's performance policy is to guarantee that the application remains **fast, responsive, lightweight, and operationally efficient** under real-world enterprise conditions:
* **Target Users**: Service Managers, Field Engineers, Mechanics, Supervisors, Operators, Store Managers, HR Managers, Rental Managers, Sales Executives, Finance Managers, and Admins.
* **Operating Conditions**: High-density fleet datasets, long-running operational shifts, mobile field access over 3G/4G networks, low-end mobile devices, and complex multi-tenant organization boundaries.

---

## 2. Performance Philosophy

1. **Performance as a Core Product Requirement**: Performance considerations MUST precede implementation. No feature shall be merged if it degrades initial load time, interaction responsiveness, or memory efficiency.
2. **Zero Premature Optimization**: Optimizations MUST target empirical bottlenecks, high-traffic routes, and shared primitives. Arbitrary, unmeasured optimization theater (e.g. wrapping trivial inline functions in `useCallback`) is FORBIDDEN.
3. **Safety & Correctness Primacy**: Performance optimizations MUST NEVER compromise security boundaries (RLS, authorization), data accuracy (financial ledgers, stock balances), visual compliance (`DESIGN.md`), accessibility (WCAG 2.2), or responsiveness.

---

## 3. Performance Architecture

ReachInternational enforces a multi-tier performance architecture spanning browser, edge server, data layer, database, and background job processing:

```text
                                [ PERFORMANCE PIPELINE ]
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Browser / Mobile App: Fast HTML/RSC hydration, instant skeleton UI, small bundles│
├──────────────────────────────────────────────────────────────────────────────────┤
│ Edge Auth Proxy (proxy.ts): Session validation & fast route redirects (<20ms)    │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Next.js App Router (RSC): Server Components render data near source without JS   │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Data Access Layer (lib/dal.ts & lib/queries/*): React cache() + unstable_cache() │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Supabase PostgreSQL: Indexed queries, RPC functions, composite indexes, 13 RLS   │
├──────────────────────────────────────────────────────────────────────────────────┤
│ Background Processing (QStash & Notifications): Async email/SMS/PDF generation   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Performance Budgets

Every route and package MUST comply with strict performance budgets:

```text
METRIC / RESOURCE TYPE                  TARGET THRESHOLD / BUDGET
──────────────────────────────────────────────────────────────────────────────────────────
• Initial Page Load (LCP)              ≤ 2.5 seconds (Good Core Web Vital)
• Interaction Responsiveness (INP)      ≤ 200 milliseconds
• Cumulative Layout Shift (CLS)         ≤ 0.1 (Zero layout jump)
• First Input Delay (FID)               ≤ 100 milliseconds
• Initial JS Bundle Payload             ≤ 150 KB gzipped (per route)
• Database Query Execution Time         ≤ 50 milliseconds (p95)
• Server Action Mutation Latency        ≤ 300 milliseconds
```

---

## 5. Core Web Vitals

AI agents MUST evaluate all UI changes against the three primary Core Web Vitals:

1. **Largest Contentful Paint (LCP ≤ 2.5s)**:
   * Above-the-fold content MUST render via React Server Components (RSC).
   * Critical hero images MUST use Next.js `<Image priority />` with exact layout sizing.
   * Fonts MUST load with `font-display: swap` using `next/font`.
2. **Interaction to Next Paint (INP ≤ 200ms)**:
   * Heavy computations MUST NOT run synchronously on the main thread during click events.
   * Submit actions MUST set `disabled={loading}` and display an instant spinner (`<Spinner />`).
3. **Cumulative Layout Shift (CLS ≤ 0.1)**:
   * Loading states MUST use fixed-height `<Skeleton />` containers matching final component bounds.
   * Dynamic content MUST NOT inject un-dimensioned elements above rendered content.

---

## 6. Rendering Strategy

ReachInternational leverages Next.js App Router's hybrid rendering model:

* **React Server Components (RSC)**: Default strategy for all pages and layout components (`apps/web/app/(app)/...`). Fetch data directly on the server, eliminate client JS bundle size, and keep sensitive database credentials on the server.
* **Client Components (`'use client'`)**: Reserved strictly for interactive leaf components (forms, modal triggers, searchable dropdowns, charts, theme toggles).
* **Static Generation & Revalidation**: Static data (categories, settings) use tag-based revalidation (`revalidateTag(CACHE_TAGS.categories)`).

---

## 7. Server vs Client Boundaries

Placing `'use client'` at the top of a page file is **STRICTLY FORBIDDEN**.

```text
CORRECT RSC / CLIENT BOUNDARY STRUCTURE:
┌──────────────────────────────────────────────────────────────────────────────────┐
│ page.tsx (RSC)                                                                  │
│ ├── PageHeader (RSC)                                                             │
│ ├── MetricCards (RSC)                                                            │
│ └── MainDataSection (RSC)                                                        │
│     ├── FilterToolbar ('use client' - leaf node for input state)                 │
│     └── EnterpriseTable ('use client' - leaf node for row selection)             │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Data Fetching Standards

1. **Server-Only Query Modules**: All queries MUST reside inside `apps/web/lib/queries/` or `lib/dal.ts` and use `import "server-only"`.
2. **React Request Deduplication (`cache()`)**: Wrap server queries with React's `cache()` to deduplicate identical data fetches within a single render tree.
3. **Cross-Request Caching (`cacheWithTag`)**: Use `cacheWithTag` from `lib/cache.ts` (`unstable_cache`) for semi-static data (machine metadata, categories, settings).

```ts
import "server-only";
import { cache } from "react";
import { cacheWithTag, CACHE_TAGS } from "@/lib/cache";

export const getMachineMetadata = cache(async (machineId: string) => {
  return cacheWithTag(`machine:${machineId}`, 300, async () => {
    // Supabase query execution
  })();
});
```

---

## 9. Request Waterfalls (Parallel Fetching Mandate)

Sequential `await` calls for independent datasets are **STRICTLY FORBIDDEN**.

```ts
// ❌ FORBIDDEN: Sequential Async Waterfall (Slow)
const machines = await getMachines(branchId);
const stats = await getBranchStats(branchId);
const categories = await getCategories();

// ✅ REQUIRED: Parallel Async Fetching (Fast)
const [machines, stats, categories] = await Promise.all([
  getMachines(branchId),
  getBranchStats(branchId),
  getCategories(),
]);
```

---

## 10. API & Server Action Performance

1. **Server Action Mutation Boundary**: Database updates MUST execute via Server Actions in `apps/web/app/actions/` wrapped with authentication and Zod schema validation.
2. **Tag Invalidation**: After mutation, invalidate only affected tags (`revalidateTag(CACHE_TAGS.machines)`) rather than invalidating entire page paths (`revalidatePath`).
3. **DTO Payload Optimization**: Server Actions MUST return minimal JSON response payloads (`{ success: true, id: "..." }`) rather than returning full database entity trees.

---

## 11. Database Performance & Indexing

The PostgreSQL database uses multi-layer performance indexes defined across 35 migrations (`003_performance_indexes.sql`, `012_multi_layer_performance_indexes.sql`, `013_additional_performance_indexes.sql`):

1. **Foreign Key Indexing**: Every foreign key column (`machine_id`, `branch_id`, `created_by`, `assigned_to`) MUST have a corresponding B-tree index.
2. **Composite Filter Indexes**: Common multi-column filter queries MUST use composite indexes (e.g. `idx_machines_branch_status` on `(branch_id, status, created_at DESC)`).
3. **RLS Column Indexing**: Columns evaluated in RLS policies (`organization_id`, `branch_id`, `user_id`) MUST be indexed to avoid sequential table scans during authorization checks.

---

## 12. Query Optimization & Selective Projections

Using `SELECT *` on large operational tables in list views is **STRICTLY FORBIDDEN**.

```ts
// ❌ FORBIDDEN: Fetching all 45 columns for a simple table list
const { data } = await supabase.from("machines").select("*");

// ✅ REQUIRED: Explicit projection of required columns only
const { data } = await supabase
  .from("machines")
  .select("id, code, name, model, status, hour_meter, branch_id");
```

### RPC Aggregation:
Complex multi-table dashboard metrics MUST execute via PostgreSQL RPC functions (e.g. `get_branch_dashboard_stats`) to compute stats inside the database engine rather than transporting thousands of raw rows to Node.js.

---

## 13. Pagination Strategies

Large operational tables MUST implement server-side pagination:

1. **Page Size Limit**: Default table pagination MUST load 25 rows per page (max 50 rows).
2. **Keyset / Cursor Pagination**: For massive log tables (`operator_daily_meters`, `audit_logs`), prefer keyset pagination on `(created_at DESC, id DESC)` over deep offset pagination (`OFFSET 10000`).

---

## 14. Large Dataset Handling

1. **Server-Side Filtering**: Filters and search queries MUST execute in PostgreSQL (`.ilike()`, `.eq()`) via URL search params (`?search=CAT&status=active`).
2. **Mobile Touch Card Reflow**: Viewports ≤640px reflow tables into card views (`block sm:hidden`), keeping list rendering lightweight.
3. **Incremental Streaming**: Wrap heavy data sections in React `<Suspense fallback={<Skeleton />}>` to stream server-rendered chunks incrementally.

---

## 15. Table Performance (`EnterpriseTable.tsx`)

1. **Row Component Stability**: Table rows inside `<EnterpriseTable>` MUST use stable key props (`key={row.id}`).
2. **Density Toggles**: Support dense row height (48px) to reduce DOM node height.
3. **Memoized Column Definitions**: Column definitions passed to `<EnterpriseTable>` MUST be defined statically outside render or memoized with `useMemo`.

---

## 16. State Management

AI agents MUST select the minimal state mechanism required:

```text
STATE CATEGORY        RECOMMENDED MECHANISM                  EXAMPLE USAGE
──────────────────────────────────────────────────────────────────────────────────────────
• Server State       React Server Components / React cache  Database queries, profile
• URL Filter State   URL Search Params (useSearchParams)    Search, status filter, tabs
• Local UI State     React useState                         Modal open, dropdown toggle
• Form Input State   React Hook Form / Local state          Input fields, checkbox
```

**Rule**: DO NOT introduce global state management libraries (Redux, Zustand) for data that can reside in RSC or URL search parameters.

---

## 17. React Rendering Performance

1. **Avoid Render Trigger Loops**: Never update state inside render body.
2. **Keep State Leaf-Scoped**: Move transient state (e.g., hover state, input text) down into individual child components to prevent re-rendering entire parent page trees.
3. **Stable Component Definitions**: Never define React components inside the body of another component.

---

## 18. Targeted Memoization Rules

Unmeasured memoization is prohibited. Apply `useMemo` and `useCallback` ONLY when:
1. **Expensive Computations**: Performing complex data transformations (e.g. sorting 500+ items, calculating financial ledger totals).
2. **Reference Stability**: Passing object/array dependencies into heavy third-party components or custom hooks with effect dependencies.

---

## 19. Effect Usage & Cleanup Rules

1. **No Derived State in Effects**: Compute derived values synchronously during render instead of using `useEffect`.
2. **Mandatory Event Cleanup**: Any manual event listener (`window.addEventListener`), timer (`setInterval`), or subscription MUST return a cleanup function.
3. **Zero Infinite Effect Loops**: Verify dependency arrays in `useEffect` contain only primitive values or memoized references.

---

## 20. Bundle Size Control

1. **Monorepo Dependencies**: Shared dependencies MUST use workspace protocol (`workspace:*`).
2. **Tree-Shaking**: Import icons from specific barrel paths (`lucide-react` or `@/components/ui/animated-icons`).
3. **Zero Unused Packages**: Run `pnpm depcheck` or bundle analysis before adding new npm packages.

---

## 21. Dependency Addition Protocol

Before running `pnpm add <package>`:
1. Verify if equivalent functionality exists in `@reachinternational/utils` or `apps/web/lib/`.
2. Verify package bundle size using Bundlephobia (MUST be < 20KB gzipped unless approved).
3. Verify package supports tree-shaking and server components.

---

## 22. Code Splitting & Dynamic Imports

Heavy libraries MUST be lazy-loaded using Next.js `dynamic()`:

```tsx
import dynamic from "next/dynamic";

// Dynamically import heavy Recharts chart component
const AnalyticsChart = dynamic(
  () => import("@/components/analytics/AnalyticsChart").then((m) => m.AnalyticsChart),
  { ssr: false, loading: () => <Skeleton className="h-64 w-full" /> }
);
```

---

## 23. Image Optimization (`next/image`)

All images MUST use Next.js `<Image />` or Supabase Storage CDN:

1. **Explicit Dimensions**: Specify `width` and `height` props or use `fill` with an aspect-ratio container to prevent CLS.
2. **Modern Formats**: Enable AVIF/WebP in `next.config.js`.
3. **Above-the-Fold Priority**: Hero images MUST set `priority={true}`. All other images MUST use default `loading="lazy"`.

---

## 24. Font Performance (`next/font`)

1. **Geist Sans & Geist Mono**: Configured via `next/font/google` or local Geist font package in `app/layout.tsx`.
2. **Zero FOIT / FOUT**: Enforce `display: "swap"` and fallback system fonts.

---

## 25. Third-Party Scripts & API Handling

External services (SendGrid, Twilio, WhatsApp, QStash) MUST be invoked asynchronously on the server. Third-party tracking scripts MUST NOT block initial client HTML hydration.

---

## 26. CSS & Tailwind Performance

1. **Tailwind v4**: Utilizes `@import "tailwindcss"` with CSS variable tokens (`var(--color-ink)`).
2. **No Dynamic Class String Construction**: Use `cn()` utility (`clsx` + `tailwind-merge`) with static class strings rather than constructing raw dynamic string interpolations.

---

## 27. Animation Performance (`framer-motion`)

1. **Hardware Acceleration**: Animate ONLY GPU-accelerated CSS properties: `transform` (`scale`, `translate3d`), `opacity`.
2. **Motion Token Specs**: Micro-animations MUST use standard design tokens (`150ms ease-out`).
3. **Reduced Motion**: Respect user OS preference via `motion-reduce:transition-none`.

---

## 28. Memory Management

1. **Unbounded Cache Safeguards**: In-memory caches MUST set maximum item limits (`maxSize`) or TTL expiration.
2. **Subscription Teardown**: Supabase Realtime subscriptions MUST unsubscribe inside component unmount cleanup functions (`supabase.removeChannel(channel)`).

---

## 29. Real-Time Data Performance

1. **Targeted Subscriptions**: Subscribe ONLY to specific row changes (`filter: "branch_id=eq.DEL-HQ"`) rather than subscribing to full table changes.
2. **Connection Reuse**: Reuse a single Supabase Realtime client instance per session.

---

## 30. Caching & Invalidation Policy

Data freshness is categorized into 4 operational tiers:

```text
DATA CLASS        REVALIDATION PERIOD   INVALIDATION STRATEGY
──────────────────────────────────────────────────────────────────────────────────────────
• Class A (Static)      24 Hours (86400s)  Tag Invalidation (revalidateTag)
• Class B (Semi-Dynamic) 5 Minutes (300s)  Tag + Time Revalidation
• Class C (Operational) 15 Seconds (15s)   Direct Mutation Invalidation
• Class D (Realtime)    Instant (0s)       Supabase Realtime Channel
```

---

## 31. Authentication & Authorization Performance

1. **Edge Auth Proxy (`proxy.ts`)**: Validates Supabase session cookie at the edge (< 20ms) before route handler execution.
2. **Cached Profile Lookup (`getCachedUserRow`)**: User profile & permissions lookup in `lib/dal.ts` MUST be cached per request via React `cache()`.
3. **Security Invariant**: Authorization checks (RLS, `requirePermission`) MUST NEVER be bypassed to achieve performance gains.

---

## 32. Mobile Performance (`apps/mobile`)

1. **TanStack React Query v5**: Mobile app utilizes `@tanstack/react-query` for automatic query caching, background refetching, and offline persistence.
2. **Native FlatList**: Mobile lists MUST use React Native `FlatList` with `getItemLayout`, `initialNumToRender={10}`, and `maxToRenderPerBatch={10}`.

---

## 33. Network Performance

1. **Payload Compression**: Enable Gzip/Brotli compression for all HTTP responses.
2. **Deduplicated Network Calls**: Avoid duplicate API requests during route navigation.

---

## 34. Perceived Performance

1. **Instant Skeleton Screen**: Content containers MUST display pulse skeletons (`<Skeleton />`) during server streaming.
2. **Instant Button Loading**: Action buttons MUST enter loading state instantly upon click.

---

## 35. Performance + Security

Performance and Security MUST coexist:
* **NEVER** bypass RLS policies or permission checks to speed up queries.
* **NEVER** cache sensitive financial, payroll, or user authorization data in public/global caches.

---

## 36. Performance + Accessibility

Performance and Accessibility MUST coexist:
* **NEVER** remove visible focus rings (`ring-2 ring-[var(--color-link)]`) to save rendering cost.
* **NEVER** replace semantic HTML elements (`<button>`, `<input>`) with un-styled `<div>` tags.

---

## 37. Performance + Responsive Design

Optimizations MUST maintain 3-tier viewport parity:
* Mobile (≤640px touch cards `block sm:hidden`)
* Tablet (641px–1023px 2-col grids)
* Desktop (≥1024px high-density `<EnterpriseTable>`)

---

## 38. Performance Testing

Verification MUST be performed using established project tooling:
1. **Compilation Check**: `pnpm typecheck` across all 9 monorepo packages.
2. **Build Check**: `pnpm build` to verify bundle sizes and zero static build errors.

---

## 39. Performance Regression Protection

Before modifying shared queries in `lib/queries/` or UI primitives in `components/ui/`:
1. Audit all consuming routes across the 26 domain modules.
2. Verify query execution times remain ≤50ms.
3. Verify zero compilation errors across all workspace packages.

---

## 40. Performance Anti-Patterns (NEVER INTRODUCE)

AI agents MUST NEVER introduce any of the following performance anti-patterns:
* ❌ **`SELECT *` on Large Tables**: Fetching all columns when only a few are needed.
* ❌ **Sequential Query Waterfalls**: Awaiting independent queries sequentially instead of using `Promise.all()`.
* ❌ **`'use client'` at Page Root**: Converting entire pages into Client Components.
* ❌ **Missing Image Dimensions**: Rendering images without explicit dimensions causing CLS layout shifts.
* ❌ **Un-Memoized Table Column Definitions**: Re-creating column arrays on every render tick.
* ❌ **Global State Overuse**: Introducing global stores for data that belongs in RSC or local state.

---

## 41. Performance Change Policy

Before executing a performance-related change:
1. Identify the empirical bottleneck via timing logs or bundle analysis.
2. Formulate the smallest correct code change.
3. Verify that zero security, visual design, or accessibility regressions are introduced.

---

## 42. AI Agent Pre-Implementation Checklist

Before writing code, every AI agent MUST complete this mental checklist:

* [ ] Am I fetching only the required table columns (no `SELECT *`)?
* [ ] Are independent async queries wrapped in `Promise.all()` to eliminate waterfalls?
* [ ] Is `'use client'` restricted strictly to interactive leaf components?
* [ ] Are dynamic imports (`next/dynamic`) used for heavy non-critical libraries?
* [ ] Do images specify explicit dimensions or `fill` to prevent CLS?
* [ ] Are database queries backed by appropriate B-tree or composite indexes?
* [ ] Is server data caching (`cache()` / `cacheWithTag`) applied safely with tag invalidation?

---

## 43. AI Agent Post-Implementation Performance Audit

After completing code modifications, every AI agent MUST perform the following verification protocol:

1. **Compilation Audit**: Run `pnpm typecheck` across all 9 monorepo workspace packages.
2. **Security & RLS Audit**: Confirm authorization checks and RLS policies remain intact.
3. **Design & Responsive Audit**: Confirm visual compliance with `DESIGN.md` across Mobile, Tablet, and Desktop.
4. **Memory Synchronization**: Update `AI/STATE.md`, `AI/CURRENT_TASK.md`, `AI/CHANGELOG_AI.md`, and `README.md`.

---
