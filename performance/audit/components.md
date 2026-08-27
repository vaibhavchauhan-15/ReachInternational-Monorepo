# Component Architecture Audit (Phase 1)

> **SCOPE**: Audit of all 180 React components across `apps/web/components` and `apps/web/app`.

---

## 1. Component Hierarchy & Boundary Analysis

ReachInternational leverages a Server-Driven UI architecture with React Server Components (RSC) at page roots passing typed props to interactive Client Component leaf nodes.

```text
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Page Level (RSC) — apps/web/app/(app)/.../page.tsx                              │
│ • Validates auth session via verifySession() / requireRole()                    │
│ • Fetches data from DAL (lib/dal.ts, lib/queries/*)                             │
│ • Streams HTML with React <Suspense fallback={<Skeleton />}>                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Domain Client Hubs ('use client') — apps/web/components/.../*Client.tsx         │
│ • Manages active tabs, URL search filters, search inputs, modal open states     │
│ • Renders responsive 3-tier viewports (Desktop Table vs Mobile Touch Cards)     │
├─────────────────────────────────────────────────────────────────────────────────┤
│ Modals & Print Overlays ('use client') — apps/web/components/.../*Modal.tsx     │
│ • Contains heavy form logic, Zod validation, and print preview engines          │
├─────────────────────────────────────────────────────────────────────────────────┤
│ UI Primitives (RSC & Leaf Client) — apps/web/components/ui/*                   │
│ • Stateless buttons, badges, tooltips, dialogs, inputs, data tables             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Size & Complexity Matrix

| Component File | Size (Bytes) | Lines | Boundary | Primary Responsibility | Re-render / Performance Risk | Priority |
| :--- | :---: | :---: | :---: | :--- | :--- | :---: |
| `components/operations/OperationsClient.tsx` | 100.8 KB | 1,986 | `'use client'` | Running hours log feed, site filter, machine assignments, stats bar | Embeds `PrintableSupervisorLogsModal` synchronously; 5 `router.refresh()` calls | 🔴 P0 |
| `components/dashboard/OperatorDashboard.tsx` | 98.4 KB | 2,043 | `'use client'` | Daily machine log entry (Section A/B/C), log history feed | Synchronously imports PDF modals and xlsx export logic | 🔴 P0 |
| `app/(app)/machines/[id]/machine-client-view.tsx` | 59.4 KB | 1,118 | `'use client'` | Machine detail specifications, logs, telemetry | Heavy tab rendering on single machine route | 🟠 P1 |
| `components/operations/PrintableSupervisorLogsModal.tsx` | 40.9 KB | 821 | `'use client'` | A4 Printable HTML layout & PDF export engine | Directly bundled into operations client bundle; should be lazy loaded via `next/dynamic` | 🟠 P1 |
| `components/machines/MachineListClient.tsx` | 39.6 KB | 1,108 | `'use client'` | Fleet directory, search/filters, add/edit/delete modals | 4 `router.refresh()` triggers; large modal tree | 🟠 P1 |
| `app/(app)/users/users-client.tsx` | 32.9 KB | 770 | `'use client'` | User & employee directory, pending approvals, status toggle | 8 `router.refresh()` calls on quick actions | 🟠 P1 |
| `components/ui/CustomTimePicker.tsx` | 23.4 KB | 520 | `'use client'` | 1-Click grid time picker primitive | Shared UI leaf; memoized and fast | 🟢 P3 |
| `components/layout/AppSidebar.tsx` | 18.2 KB | 430 | `'use client'` | Navigation sidebar & responsive drawer | Memoized navigation items; active route detection | 🟢 P3 |
| `components/ui/EnterpriseTable.tsx` | 14.1 KB | 310 | `'use client'` | High-density desktop data table | Highly optimized row rendering; stable keys | 🟡 P2 |

---

## 3. Major Architectural Findings & Bottlenecks

### Finding C-01: Synchronous Inclusion of Heavy Export Modals (🔴 P0)
- **Problem**: `OperationsClient.tsx` directly imports `PrintableSupervisorLogsModal.tsx` (40.9 KB) and `OperatorDashboard.tsx` directly imports `PrintableOperatorLogsModal.tsx` (23.4 KB) and `xlsx`.
- **Impact**: Every user visiting `/operations` downloads ~65 KB of print formatting code even if they never export or print a report.
- **Remediation Target**: Wrap export modals in `next/dynamic(() => import(...), { ssr: false })` to lazy load them only when the user clicks the "Export / Print" trigger.

### Finding C-02: Over-Reliance on `router.refresh()` (🟠 P1)
- **Problem**: 27 instances of `router.refresh()` across client components (e.g. 8 in `users-client.tsx`, 5 in `OperationsClient.tsx`, 4 in `MachineListClient.tsx`).
- **Impact**: Re-triggers server component data fetching for the entire route tree upon single row mutations, causing full layout re-renders.
- **Remediation Target**: Replace with targeted Server Action tag revalidation (`revalidateTag`) and optimistic local state updates.

### Finding C-03: Direct Inline Supabase Querying in `operations/page.tsx` (🔴 P0)
- **Problem**: `apps/web/app/(app)/operations/page.tsx` directly queries Supabase with 7 parallel `supabase.from(...)` calls using wildcard projections instead of calling `lib/dal.ts` or `lib/queries/operators.ts`.
- **Impact**: Bypasses unified React `cache()` and DAL revalidation tags.
- **Remediation Target**: Extract all queries into `apps/web/lib/queries/operators.ts` with explicit projections and `cacheWithTag`.
