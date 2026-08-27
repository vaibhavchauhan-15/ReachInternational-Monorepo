# Request & Server Action Priority Register (Phase 4)

> **SCOPE**: Prioritization of all application requests, Server Actions, and data loaders ranked by cumulative performance cost (`latency × frequency`).

---

## 🔴 P0 — Critical Architectural Bottlenecks

### 1. Operations Hub Initial Data Fetching (`/operations`)
- **Location**: `apps/web/app/(app)/operations/page.tsx:L50-L78`
- **Cost**: 10 parallel database queries, ~850 rows transferred per request.
- **Frequency**: High (Main operational dashboard accessed by all roles).
- **Target**: Reduce to 1–2 queries and < 50 rows per active tab.

### 2. Operator Shift Hour Meter Submission (`submitOperatorHourLogAction`)
- **Location**: `apps/web/app/actions/operators.ts:L101-L240`
- **Cost**: 7 sequential database round-trips over the network (~180ms total latency).
- **Frequency**: Very High (Executed multiple times daily by every active machine operator).
- **Target**: Consolidate into 2 database round trips using atomic stored procedure.

### 3. N+1 Loop Database Inserts (`createInvoiceAction`, `inventory.ts`, `tasks.ts`)
- **Location**: `apps/web/app/actions/finance.ts:L65`, `inventory.ts:L360`, `tasks.ts:L76`
- **Cost**: 1 round trip per item (e.g. 20 items = 20 DB queries).
- **Frequency**: Medium.
- **Target**: 1 single bulk array insert (`insert(items)`).

---

## 🟠 P1 — High Priority Bottlenecks

### 4. Machine Fleet Management Page Load (`/machines`)
- **Location**: `apps/web/app/(app)/machines/page.tsx:L35-L46`
- **Cost**: 5 database queries (Fetches complaints and service records unconditionally).
- **Target**: Reduce to 3 queries on default inventory view.

### 5. User Directory List Fetching (`/users`)
- **Location**: `apps/web/app/(app)/users/page.tsx:L38-L39`
- **Cost**: 2 database queries (`getAllUsers()` + redundant `getPendingUsers()`).
- **Target**: 1 single database query; derive pending users in memory.

### 6. `router.refresh()` Full-Tree RSC Invalidation (27 Call Sites)
- **Location**: `users-client.tsx` (8), `OperationsClient.tsx` (5), `MachineListClient.tsx` (4)
- **Cost**: Full server component tree re-fetch on single status toggles.
- **Target**: Replace with React 19 optimistic updates.

---

## 🟡 P2 — Medium Priority Bottlenecks

### 7. Heavy Modals Bundled in Initial Client Hydration
- **Location**: `OperationsClient.tsx` and `OperatorDashboard.tsx`
- **Cost**: ~64 KB of uncompressed JS transferred on initial load.
- **Target**: Lazy load via `next/dynamic`.

### 8. Unmemoized Array Deduplication in Operations Client
- **Location**: `OperationsClient.tsx:L174-L246`
- **Cost**: 8 Set operations re-running on every search keystroke.
- **Target**: Wrap in `useMemo`.

---

## 🟢 P3 — Low Priority / Well-Optimized

### 9. Edge Proxy Navigation Routing (`apps/web/proxy.ts`)
- **Cost**: 2.6ms – 4.3ms.
- **Status**: ✅ Highly optimized.

### 10. Single Session Lookup Deduplication (`apps/web/lib/dal.ts`)
- **Cost**: 1 DB query per HTTP request (React `cache()`).
- **Status**: ✅ Highly optimized.
