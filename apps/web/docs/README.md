# Web Application Documentation — `apps/web/docs/`

This directory houses architectural documentation, operational patterns, and performance reports for the ReachInternational Web Application (Next.js 16.2 App Router, React 19, Tailwind CSS v4, Base UI, and Supabase SSR).

## Directory Structure

```text
apps/web/docs/
├── README.md                              ← YOU ARE HERE (Web documentation index)
└── reports/                               ← Automated Performance & Lighthouse Reports
    ├── lh-report-run-1.json               ← Lighthouse Mobile run 1
    ├── lh-report-run-2.json               ← Lighthouse Mobile run 2
    └── lh-report-run-3.json               ← Lighthouse Mobile run 3
```

## Web Architecture Highlights

### 1. App Router & React Server Components (RSC)
- **Directory Layout**: Next.js 16.2 App Router in `apps/web/app/`.
- **Server-First Data Fetching**: React Server Components (RSC) fetch data by default at the server boundary. Client components (`'use client'`) are strictly leaf nodes for interactivity, animations, and form inputs.
- **Data Access Layer (DAL)**: All reads go through `lib/dal.ts` or `lib/queries/*` using per-request Supabase SSR clients with secure HTTP-only cookies (`@supabase/ssr`).

### 2. Mutations via Server Actions
- **Location**: `apps/web/app/actions/*`.
- **Security & Authorization**: All mutations enforce canonical RBAC permissions (`@reachinternational/permissions`), validate inputs via Zod (`@reachinternational/validation`), write audit logs to `audit_logs` (`lib/audit.ts`), and trigger cache revalidations via `revalidateTag` / `revalidatePath`.
- **Zero Service Role Key Leakage**: `SUPABASE_SERVICE_ROLE_KEY` is strictly confined to server-only modules and never exported or exposed to client bundles.

### 3. Responsive UI & Vercel Geist System
- **Design Tokens**: Standardized Vercel Geist design tokens (`packages/design-tokens`):
  - Canvas: `#fafafa` (light) / `#0a0a0a` (dark)
  - Elevated Canvas: `#ffffff` (light) / `#171717` (dark)
  - Hairlines: 1px `#ebebeb` (light) / `#262626` (dark)
  - Reach Sky Blue: `#0284c7` (light) / `#0ea5e9` (dark)
- **3-Tier Viewport Responsiveness**:
  - **Mobile (≤640px)**: Touch-optimized cards with minimum 44px tap targets (`min-h-[44px]`).
  - **Tablet (641px–1023px)**: 2-column responsive bento grids and compact filters.
  - **Desktop (≥1024px)**: High-density `EnterpriseTable` data grids with sortable columns and pagination.

### 4. Web Testing & Verification Suites
Web tests are organized into targeted automated suites in `apps/web/test/` and `apps/web/scripts/`:
- **`apps/web/test/test-web-push-notifications.mjs`**: Full lifecycle Web Push API, Service Worker `/sw.js`, and VAPID keys.
- **`apps/web/scripts/test-cors-security.mjs`**: Web API boundary, allowed origins, and credentials.
- **`apps/web/scripts/test-machines-web-rbac.mjs`**: Web capability matrix, route 403 guards, and UI mounting.
- **`apps/web/scripts/test-shift-filter-and-timing-sort.mjs`**: Roster filtering, timing sort, and optimistic UI.
- **`apps/web/scripts/test-dashboard-standardization.mjs`**: 6 canonical role dashboard views.
- **`apps/web/scripts/test-assignment-standardization.mjs`**: Assignment dialogs, overlap guards, and date bounds.
