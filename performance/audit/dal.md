# Data Access Layer (DAL) Audit (Phase 1)

> **SCOPE**: Audit of `apps/web/lib/dal.ts` and all 20 domain query modules in `apps/web/lib/queries/*`.

---

## 1. DAL Architecture Overview

The Data Access Layer (DAL) isolates database queries from UI components and Server Actions, providing:
1. **Server-Only Build Enforcement**: Every DAL module starts with `import "server-only";` to guarantee zero database credentials or server queries leak into client component bundles.
2. **Per-Request Deduplication**: Uses React's `cache()` to deduplicate identical session and user profile lookups within a single React Server Component render tree.
3. **Cross-Request Tag Caching**: Uses `unstable_cache` / `cacheWithTag` for semi-static datasets.

---

## 2. Core DAL Modules & Query Inventory

| DAL Module File | Primary Functions | Target Tables | Columns Projected | Joins / Relations | Caching Strategy | Priority / Concerns |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| `apps/web/lib/dal.ts` | `verifySession()`, `getCurrentUser()`, `getCachedUserRow()`, `requireRole()` | `auth.users`, `public.users` | Explicit: `id, full_name, phone, role, status, city, district, state, email, created_at, updated_at` | None | React `cache()` + `dal-user-row-v6` | 🟢 P3 (Healthy) |
| `apps/web/lib/queries/machines.ts` | `getMachines()`, `getMachineById()`, `getMachineCounts()` | `public.machines`, `public.users` | Mixed (`select("*")` in `getMachineById`) | `engineer:users`, `operator:users`, `supervisor:users` | `cacheWithTag("machines", 300)` | 🟠 P1 (`select("*")`) |
| `apps/web/lib/queries/operators.ts` | `getOperatorMachines()`, `getOperatorDailyMeters()`, `getOperationalUsers()` | `public.machines`, `public.machine_hour_logs`, `public.users` | Explicit & Join projections | `machine:machines`, `operator:users` | React `cache()` | 🟡 P2 (Need to integrate page queries) |
| `apps/web/lib/queries/users.ts` | `getUsers()`, `getUserById()`, `getUserCounts()` | `public.users` | Explicit projections with search/role filters | None | React `cache()` | 🟢 P3 (Healthy) |
| `apps/web/lib/queries/clients.ts` | `getClients()`, `getClientById()` | `public.clients` | Explicit address & name projections | None | `cacheWithTag("clients", 300)` | 🟢 P3 (Healthy) |
| `apps/web/lib/queries/audit-logs.ts` | `getAuditLogsFiltered()` | `public.audit_logs`, `public.users` | `id, user_id, action, entity_type, entity_id, metadata, created_at` | `user:users(full_name, email)` | Uncached (Dynamic audit stream) | 🟢 P3 |

---

## 3. Major DAL Architectural Findings

### Finding DAL-01: Page Bypass in Operations Module (🔴 P0)
- **Problem**: `apps/web/app/(app)/operations/page.tsx` executes 7 parallel database queries inline rather than calling `lib/queries/operators.ts`.
- **Impact**: Bypasses React `cache()`, duplicates join logic, and performs unconstrained `select("*")` on large operational tables.
- **Remediation**: Create consolidated DAL functions `getOperationsHubData(user, branchId)` in `lib/queries/operators.ts` with parallel `Promise.all()` fetching and explicit column projections.

### Finding DAL-02: Wildcard `select("*")` in `getMachineById` (🟠 P1)
- **Problem**: `apps/web/lib/queries/machines.ts` queries all machine columns with `select("*")` when retrieving individual machine records.
- **Remediation**: Replace with explicit projection of schema fields.
