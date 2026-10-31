# Performance & Optimization Testing Standards

> **PERFORMANCE BUDGETS AND VERIFICATION STANDARDS FOR WEB, DATABASE, AND MOBILE**  
> *Cross-references the monorepo performance rules in [`AI/RULES/PERFORMANCE.md`](file:///c:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/AI/RULES/PERFORMANCE.md). Performance is treated as an essential product requirement.*

---

## 1. Purpose

The purpose of ReachInternational's Performance Testing standards is to ensure the software remains **fast, lightweight, and operationally resilient** under demanding enterprise conditions: high-density machine telemetry, long operational shifts, low-end mobile hardware, and field operations over 3G/4G networks.

---

## 2. Applicable Applications & Packages

- `apps/web`: Web Core Web Vitals, bundle sizes, RSC streaming, and cache policies
- `apps/mobile`: Hermes runtime, 60 FPS UI thread animations, TanStack Query caching, and list recycling
- `supabase`: PostgreSQL query execution speed, index coverage, and connection pooling

---

## 3. Measurable Performance Budgets

Every route, component, and query must comply with these strict budgets:

```text
┌───────────────────────────────────────┬──────────────────────────────────────────┐
│ METRIC / RESOURCE TYPE                │ TARGET BUDGET THRESHOLD                  │
├───────────────────────────────────────┼──────────────────────────────────────────┤
│ 1. Largest Contentful Paint (LCP)     │ ≤ 2.5 seconds (Good Core Web Vital)      │
│ 2. Interaction to Next Paint (INP)    │ ≤ 200 milliseconds                      │
│ 3. Cumulative Layout Shift (CLS)      │ ≤ 0.1 (Zero jarring layout jumps)        │
│ 4. Initial JS Bundle Payload          │ ≤ 150 KB gzipped (per web route)         │
│ 5. Database Query Execution Time      │ ≤ 50 milliseconds (p95)                  │
│ 6. Server Action Mutation Latency     │ ≤ 300 milliseconds                       │
│ 7. Native Mobile Cold Startup Time    │ ≤ 2.0 seconds on mid-tier Android device │
│ 8. Native Scroll Animation Framerate  │ 60 FPS (zero UI thread frame drops)      │
└───────────────────────────────────────┴──────────────────────────────────────────┘
```

---

## 4. Platform-Specific Testing Standards

### A. Web Application Performance (`apps/web`)
1. **Server Components by Default**: Data fetching occurs server-side in RSC. Client components (`'use client'`) must only exist at leaf nodes for user interaction.
2. **Next.js Image Optimization**: All images must use `next/image` with explicit `width`, `height`, and modern formats (WebP/AVIF). Hero images must specify `priority` to improve LCP.
3. **Bundle Size Auditing**: Verify that heavy third-party libraries (e.g. `xlsx`) are dynamically imported via `import()` and never bundled into the critical initial route chunk.
4. **Caching & Revalidation**: Reads must utilize `unstable_cache` with tags defined in `lib/cache/tags.ts`, and mutations must selectively call `revalidateTag()`.

### B. Database & Admin Performance (`supabase`)
1. **Zero N+1 Queries**: Never issue database queries inside `.map()` loops. Use SQL joins, composite RPC functions, or PostgREST resource embedding (e.g. `select('*, clients(*)')`).
2. **Index Verification**: Any query filtering or sorting by machine status, client ID, date, or operator ID must have a matching PostgreSQL B-tree or composite index.
3. **Pagination Enforced**: Tables and lists must never execute unbounded `SELECT *` queries. Default page size must be capped at 25–50 records.

### C. Native Mobile Performance (`apps/mobile`)
1. **TanStack Query Caching**: Server state must have a default `staleTime` of 30 seconds (`30_000ms`) to eliminate redundant network round trips during screen navigation.
2. **List Recycling**: Virtualized lists must use optimized FlatList/FlashList configurations:
   ```ts
   initialNumToRender={10}
   maxToRenderPerBatch={10}
   windowSize={5}
   removeClippedSubviews={true}
   ```
3. **UI Thread Animations**: All animations must use React Native Reanimated running on the native UI thread, avoiding JavaScript thread bridge congestion.

---

## 5. Required Testing Approach

```text
[ BASELINE MEASUREMENT ]
  ├── Measure metric before changes (LCP, bundle size, query duration)
  └── Record baseline in task memory

[ APPLY OPTIMIZATION / FEATURE ]
  ├── Implement changes respecting performance invariants
  └── Avoid premature or unmeasured optimization theater

[ VERIFICATION MEASUREMENT ]
  ├── Measure metric after changes under identical conditions
  └── Compare Before vs After numbers (Must meet or exceed target budget)
```

---

## 6. Recommended Tools

- **Web Performance**: Lighthouse CI, Next.js Bundle Analyzer (`@next/bundle-analyzer`), Chrome DevTools Performance panel
- **Database Profiling**: PostgreSQL `EXPLAIN ANALYZE` via Supabase Studio or MCP tool
- **Mobile Profiling**: React DevTools Profiler, Hermes CPU profiler

---

## 7. Actual Project Commands

```bash
# 1. Production web build (displays per-route bundle sizes and static/dynamic classification)
pnpm --filter @reachinternational/web build

# 2. Check mobile operator dashboard optimization invariants
node apps/mobile/test/test-operator-dashboard-optimizations.mjs

# 3. Test mobile running logs caching and list query efficiency
node apps/mobile/test/test-running-logs-workflows.mjs

# 4. Mobile screen transition and navigation performance check
node apps/mobile/test/test-navigation-transitions.mjs
```

---

## 8. Success Criteria

1. **Budgets Respected**: LCP $\le$ 2.5s, CLS $\le$ 0.1, and initial JS bundle $\le$ 150KB gzip.
2. **Zero N+1 Queries**: Every screen load issues at most 1–3 network requests.
3. **Smooth Scroll**: Mobile lists maintain consistent 60 FPS scrolling without blank card flashes.

---

## 9. Failure Handling

- If initial JS exceeds 150KB: use dynamic imports (`dynamic(() => import(...))`) for modals, charts (`recharts`), and export tools (`xlsx`).
- If LCP degrades: ensure the hero image has `priority`, and that server components fetch critical data in parallel (`Promise.all`) rather than sequentially.
- If a database query exceeds 50ms: inspect table indexes and add a composite index on frequently filtered columns.

---

## 10. Evidence & Reporting

The test report must provide:
- Before and after performance metrics where applicable.
- Route bundle size output from `pnpm build`.
- Status of mobile list optimizations and caching policies.
