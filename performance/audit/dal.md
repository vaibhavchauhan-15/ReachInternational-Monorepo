# Data Access Layer (DAL) Architecture Specification (Phase 5)

> **SCOPE**: Authoritative DAL modules in `apps/web/lib/queries/*` and `apps/web/lib/dal.ts`.

---

## 1. DAL Architecture Overview

The Data Access Layer (DAL) enforces a strict unidirectional data flow:

```text
┌──────────────────────────────────────┐
│           UI / Route Layer           │
│  Server Components & Server Actions  │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│       Authoritative DAL Layer        │
│  apps/web/lib/queries/*.ts           │
│  - import "server-only"              │
│  - Purpose-specific query functions   │
│  - Explicit column projections       │
│  - Bounded page sizes (max 100)      │
│  - React cache() + unstable_cache()  │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│       Supabase Client Runtime        │
│  createSupabaseAdminClient()         │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│        PostgreSQL + RLS + Triggers   │
└──────────────────────────────────────┘
```

---

## 2. Authoritative DAL Module Inventory

| Module | File | Key Functions | Purpose | Columns Projected | Caching Strategy | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **Authentication & Profile DAL** | `lib/dal.ts` | `verifySession()`, `getCurrentUser()`, `requireRole()`, `requirePermission()` | Session validation & user role authorization | Explicit: `id, full_name, phone, role, status, city, district, state, email, created_at, updated_at` | React `cache()` + `dal-user-row-v6` (`users` tag) | 🟢 **Optimized** |
| **Operations DAL** | `lib/queries/operators.ts` | `getOperationsHubData(user, tab)`, `getOperatorEntryContext(id)` | Tab-aware data resolution for `/operations` | Explicit: `id, machine_id, operator_id, supervisor_id, client_id, log_date, start_meter, end_meter, start_time, end_time, overtime_hours, operating_hours, is_breakdown, start_fuel_level, fuel_consumed, shift, machine_condition, remarks, status` | Direct Parallel DAL | 🟢 **Refactored & Verified** |
| **User Directory DAL** | `lib/queries/users.ts` | `getUserList(params)`, `getAllUsersCached()`, `getUserOptions(role)` | User management directory and dropdown options | Explicit: `id, full_name, email, phone, role, status, city, district, state, created_at, updated_at` | `unstable_cache` (`all-users-directory-v2`, `users` tag) | 🟢 **Created & Verified** |
| **Machine Fleet DAL** | `lib/queries/machines.ts` | `getMachines(params)`, `getMachineById(id)`, `getMachineOptions()` | Fleet inventory, pagination (bounded max 100), dropdown options | Explicit machine & user join projections | `unstable_cache` (`machine-options-v2`, `machines` tag) | 🟢 **Refactored & Verified** |
| **Client CRM DAL** | `lib/queries/clients.ts` | `getClients()`, `getClientById(id)`, `getClientOptions()` | CRM client directory and dropdown options | Explicit: `id, code, client_name, contact_person, phone, email, city, state, is_active` | `unstable_cache` (`client-options-v2`, `clients` tag) | 🟢 **Refactored & Verified** |

---

## 3. Key Phase 5 Refactors Implemented

### 1. Operations Monolith Decomposition (`operations/page.tsx`)
- **Before**: 10 direct inline Supabase queries downloading ~850 rows unconditionally on every page view.
- **After**: Delegated to `getOperationsHubData(user, tab)` in `lib/queries/operators.ts`.
  - For operator entry (`tab=entry`): Only queries assigned machine and recent logs (2 queries, ~50 rows).
  - For supervisor hub (`tab=logs`): Executes parallel queries with explicit column projections and bounded limits.
- **Verification**: `pnpm typecheck` passed (0 errors); `next build` compiled `/operations` dynamically with zero errors.

### 2. User Directory Query Consolidation (`users/page.tsx`)
- **Before**: Called 2 Server Actions (`getAllUsers()` + `getPendingUsers()`) in parallel on every page render.
- **After**: Calls `getAllUsersCached()` from `lib/queries/users.ts` and derives pending users in memory:
  ```ts
  const allUsers = await getAllUsersCached();
  const pendingUsers = allUsers.filter((u) => u.status === "pending");
  ```
- **Result**: 50% reduction in database queries for `/users`.

### 3. Machine & Client Dropdown Optimization
- **Before**: Large read queries (`getMachines()`, `getClients()`) reused to populate modal selector dropdowns.
- **After**: Dedicated lightweight option queries (`getMachineOptions()`, `getClientOptions()`, `getUserOptions()`) returning only `id` and `label`, cached with automatic tag invalidation.

---

## 4. Phase 5 Verification Metrics

- **TypeScript Compilation (`pnpm typecheck`)**: ✅ **Pass (0 errors across all 9 workspace packages)**.
- **Turbopack Production Build (`next build`)**: ✅ **Pass (35/35 routes compiled in 19.1s)**.
