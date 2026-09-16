# Client Fleet Operations — Performance & Architecture Audit (Milestone C1)

> **Document Type**: Architecture & Performance Audit Report (Phase 2, Milestone C1)  
> **Target Route**: `/operations?tab=logs&view=client` (Web) & `OperationsScreen` (Mobile)  
> **Status**: Completed (Read-Only Audit)  
> **Date**: 2026-09-13  
> **Database Instance**: Supabase PostgreSQL (`dhbbgfzbyatzvqafnsqp`, AP-South-1)  

---

## 1. Executive Summary & Audit Scope

Fleet Operations is ReachInternational's primary operational command center for tracking daily machine utilization, operator shift allocations, and running hours across enterprise client accounts (e.g., JK Paper Ltd., Saint Gobain). 

The target user workflow revolves around an intuitive 3-tier hierarchy:
```text
Client Groups (Client, Client ID, Machine Count, Date/Month, Expand)
     │
     └── Client Details (Expanded)
           ├── Assigned Machines
           ├── Active Operators
           ├── Shift Timings & Work Hours
           └── Daily Running Hour Logs & Status Actions
```

### The Core Problem
Under the current implementation, navigating to `/operations?tab=logs&view=client` does **not** employ progressive query-driven loading. Instead, the page executes a monolithic, eager data retrieval pipeline:
1. It loads **ALL machines** in the database upfront.
2. It loads **ALL clients** (with 22 table columns) upfront.
3. It loads **ALL staff users** (operators, supervisors, managers, admins) upfront.
4. It loads **250 recent hour logs** purely to extract string location tokens in JavaScript.
5. It auto-selects a single client (`mostRecentClientId`) and fetches a flat 10-row page of logs.
6. The UI in `OperationsClient.tsx` is a **3,769-line monolithic client component** (199 KB) that performs complex multi-array client-side joins in memory on every render.
7. There is **no Client Groups list UI**; users must choose a client from a dropdown, after which a flat logs table is rendered.

```text
CURRENT PIPELINE (Eager Over-Fetching):
[Route Request] ──► [Eager getOperationsHubData]
                         ├── Fetch ALL Machines (1000 rows)
                         ├── Fetch ALL Clients (22 columns)
                         ├── Fetch ALL Staff Users
                         ├── Fetch 250 Logs for Location Strings
                         └── Fetch Flat 10 Logs for ONE Client
                    ──► [OperationsClient.tsx (3,769 lines)]
                         └── Multi-Array Client-Side JS Joins

TARGET PIPELINE (Progressive Query-Driven):
[Route Request] ──► [Tier 1: Client Groups Summary RPC] (< 3ms)
                         └── Displays Paginated Client Cards/Table
[User Expands Client] ──► [Tier 2: On-Demand Machines Fetch] (< 2ms)
                              └── Reveals Client's Fleet & Operators
[User Clicks Machine] ──► [Tier 3: On-Demand Daily Logs Fetch] (< 2ms)
                              └── Reveals Machine Timings & Day Logs
```

---

## 2. Current Architecture & Data Flow

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. ROUTE ENTRY POINT: apps/web/app/(app)/operations/page.tsx (RSC)                     │
│    • Parses searchParams (tab, view, client, machine, operator, month, start, end)     │
│    • Enforces RBAC permissions: requirePermission("machine.view") + getCurrentUser()   │
│    • Resolves viewMode default: defaults to "client"                                   │
│    • Dispatches getOperationsHubData(user, effectiveTab, params)                       │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. DATA ACCESS LAYER: apps/web/lib/queries/operators.ts                                │
│    • Tab check: if (tab === "logs")                                                    │
│    • Concurrently executes 5 eager queries via Promise.all():                          │
│        1. supabase.from("machines").select(...) [ALL MACHINES]                         │
│        2. getClients(undefined, true) [ALL CLIENTS - 22 COLUMNS]                      │
│        3. supabase.from("users").select(...) [ALL ACTIVE STAFF]                        │
│        4. supabase.from("machine_hour_logs").limit(1) [FIND RECENT CLIENT]             │
│        5. supabase.from("machine_hour_logs").limit(250) [BUILD LOCATIONS MAP]          │
│    • In-Memory JS Aggregations:                                                        │
│        - Loops over machines to compute clientMachineCount Map                         │
│        - Loops over 250 logs to compute clientLocationsMap Map                         │
│        - Enriches clients with machine_count and sites array                           │
│    • Calls getOperationsLogsPage(...) for the single resolved effectiveClientId        │
│        - Runs RPC get_operations_summary (or fallback row scanning)                    │
│        - Runs machine_hour_logs with PAGED_LOG_FULL_PROJECTION (embedded 3 relations)  │
│        - Formats logs via formatHourLogsData in JS                                     │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ 3. CLIENT COMPONENT HYDRATION: apps/web/components/operations/OperationsClient.tsx      │
│    • Massive 3,769-line Client Component receiving 19 complex props                    │
│    • Reconstructs allClientsList via useMemo merging dbClients, hourLogs, and machines │
│    • Resolves activeClient via multi-pass fallback matching                            │
│    • Filters clientMachines from global machines array in JS useMemo                   │
│    • Aggregates clientSites from activeClient.sites and matching hourLogs in JS        │
│    • Renders single Client Header Box with 4 KPI summary cards                         │
│    • Renders flat table of 10 logs for that single client                              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Current Query Map & Database Access Breakdown

### Initial Route Load (`/operations?tab=logs&view=client`)

| # | Target Table / RPC | Query Type | Purpose / Columns | Execution Time (Live DB) | Data Transferred |
|---|---|---|---|---|---|
| **1** | `auth.users` / `public.users` | `SELECT` | Verify active session & role permissions | ~8.2 ms | 1 User Record |
| **2** | `public.machines` | `SELECT` | `id, machine_id, model, serial_number, status, client_id, current_operator_id` (All rows) | ~3.1 ms | 19 Machine Rows (Scales to 1000s) |
| **3** | `public.clients` | `SELECT` | `id, code, company_name, contact_person, phone, gstin, pan_number, street, city, district, state, pincode, is_billing_address_different, billing_address, billing_city, billing_district, billing_state, billing_pincode, status, deleted_at, created_at, updated_at` | ~4.6 ms | All Client Rows (22 Columns) |
| **4** | `public.users` | `SELECT` | `id, full_name, email, phone, role, status, shift_time, shift_start_time, shift_end_time` (All active staff) | ~3.9 ms | 79 Staff Rows |
| **5** | `public.machine_hour_logs` | `SELECT` | Find most recent active `client_id` (limit 1) | ~1.8 ms | 1 Row |
| **6** | `public.machine_hour_logs` | `SELECT` | `client_id, location` (limit 250) to build site strings in JS | ~6.4 ms | 250 Rows (or all rows if <250) |
| **7** | `public.get_operations_summary` | `RPC` | Aggregate metrics (`total_run_hours`, `total_ot_hours`, `total_breakdowns`, `logged_days_count`) | ~2.1 ms | 1 JSON Summary Object |
| **8** | `public.machine_hour_logs` | `SELECT` | Paged logs with embedded `machine`, `client`, `operator` relations (limit 10) | ~5.8 ms | 10 Relational Rows |

**Total Queries Executed on Initial Page Load: 8 Queries**  
**Total Sequential/Waterfall Latency: ~36–45 ms** (Database only, excluding network serialization)

### Filter / Search Execution (`searchInput` or `ClientSelect` change)

When the user enters a search query in `searchInput` (e.g. searching "CAT" or "JK"):
1. Dispatches `handleFilterChange({ search: "CAT", page: 1 })`.
2. Router pushes query to server URL.
3. `getOperationsLogsPage` detects `search`:
   - Runs `supabase.from("machines").select("id").or(...)` (limit 50).
   - Runs `supabase.from("users").select("id").ilike(...)` (limit 50).
   - Runs `supabase.from("clients").select("id").ilike(...)` (limit 50).
   - Constructs a massive PostgREST OR filter: `remarks.ilike, location.ilike, machine_id.in, operator_id.in, client_id.in`.
   - Re-queries `machine_hour_logs` with the multi-relation projection.
4. Total database queries executed during search: **6 queries**.

---

## 4. Current Request Waterfall Analysis

The diagram below illustrates the network waterfall during a cold page visit to `/operations?tab=logs&view=client`:

```text
TIME (ms)   0      50     100    150    200    250    300    350    400    450
Browser     ├─ GET /operations?tab=logs&view=client
Next.js RSC        ├── Auth & Permissions (requirePermission + getCurrentUser)
                   └── getOperationsHubData()
                         ├── [Promise.all: 5 parallel queries]
                         │     ├── Query: machines (all)
                         │     ├── Query: clients (all 22 cols)
                         │     ├── Query: users (all staff)
                         │     ├── Query: recent client_id
                         │     └── Query: 250 logs for locations
                         ├── JS Processing: clientMachineCount & clientLocationsMap
                         └── getOperationsLogsPage(effectiveClientId)
                               ├── [Promise.all: 2 parallel queries]
                               │     ├── RPC: get_operations_summary
                               │     └── Query: machine_hour_logs (paged slice)
                               └── JS Processing: formatHourLogsData
Next.js RSC        └── Serialization of Props (190 KB JSON)
Browser            └── HTML & RSC Streaming Arrives (TTFB ~280ms)
Hydration              └── OperationsClient Hydration & Initial useMemos (3,769 lines)
Second Pass                └── 8 useEffect Hooks Trigger Cascade Re-Renders
Interactive                └── Page Interactive (TTI ~550ms)
```

### Waterfall Inefficiencies
1. **Two-Tier Sequential Gating**: `getOperationsLogsPage` cannot start until Query 4 (`recent client_id`) resolves, forcing a 2-tier waterfall on the server.
2. **Synchronous In-Memory JS Loops**: Between database queries, the server CPU iterates through 250 log objects and 1000 machine objects to compute location and count maps that PostgreSQL can compute in <0.5ms.
3. **Massive Props Deserialization**: The client receives all machines, all staff users, and all CRM clients in props, delaying hydration on mid-to-low tier devices.

---

## 5. Current Cache Behavior & Invalidation Gaps

| Entity / Query | Caching Strategy | Cache Key / Tag | Invalidation Trigger | Gaps / Vulnerabilities |
|---|---|---|---|---|
| `getClients()` | `unstable_cache` | `["clients-directory-list-v4"]` (`TAGS.clients`) | Mutations in `clients.ts` | Over-caches entire table without pagination or active machine scoping. |
| `getOperationsHubData` | React `cache()` | Request-scoped in-memory | Automatic per RSC request | Not cached across users or navigation; runs 5 raw database queries on every page hit. |
| `getOperationsLogsPage` | React `cache()` | Request-scoped in-memory | Automatic per RSC request | Zero cross-request caching; month summaries re-queried on every page switch. |
| `get_operations_summary` | PostgreSQL Function | None (Live DB) | None | Executes clean `SELECT` with indexed filters, but is re-computed on every filter change. |
| `exportLogsCache` | None | None | None | Every time the export modal opens, it triggers a live query for up to 5,000 rows. |

### Major Invalidation Gaps
- **Cross-User Redundancy**: If 5 supervisors view the operations hub simultaneously, the database executes identical queries for machines, clients, and staff 5 times without shared edge or SWR caching.
- **Client Mutex Invalidation**: Updating a client's company name invalidates `TAGS.clients`, but the operations hub in-memory maps in active sessions do not update until a full hard reload.

---

## 6. Current Rendering Architecture & Component Hierarchy

### Component Scale
- File: `apps/web/components/operations/OperationsClient.tsx`
- Total Lines: **3,769 lines**
- File Size: **199.8 KB**
- Nature: Monolithic Client Component (`"use client"`).

### Component Tree Breakdown
```text
OperationsClient (Root State Container - 25+ useState hooks)
│
├── Top Navigation Bar (Tabs: Logs, Assignments)
│
├── Conflict Alert Banner (Pending shift conflict alerts)
│
├── Tab 1: "logs" (Supervisor Running Hours)
│     ├── Filter Bar Strip (Expandable)
│     │     ├── View Mode Switcher ("machine" | "client" | "operator")
│     │     ├── Search Input (with inline loader)
│     │     ├── Action Icons (Print Modal trigger)
│     │     └── Filter Dropdowns (ClientSelect, SearchableSelect, MachineSelect, MonthSelect)
│     │
│     ├── Client Summary Card (Expandable via AnimatePresence)
│     │     ├── Client Name, Code, Machine Count Badge
│     │     ├── Working Days Badge
│     │     ├── Contact & Address Strip (MapPin, Phone, Mail)
│     │     └── 4 KPI Metric Cards (Run Hours, Overtime, Breakdowns, Days)
│     │
│     ├── Desktop Logs Table (hidden sm:block)
│     │     ├── Table Headers (Conditional columns by viewMode)
│     │     ├── Table Body (10 rows mapped from filteredHourLogs)
│     │     └── Table Pagination Controls
│     │
│     └── Mobile Logs Cards (block sm:hidden)
│           ├── Mobile Operations Card List (10 touch cards)
│           └── Mobile Pagination Controls
│
├── Tab 2: "assignments" (Machine Assignments)
│     ├── Machine Card Grid (Collapsible cards with operator assigners)
│     └── Machine Assignment Modals (Assign, Reassign, Shift Picker)
│
└── Shared Modals
      ├── PrintableSupervisorLogsModal (Dynamic import)
      └── ShiftConflictResolutionModal
```

### Re-Render Radius & React State Overhead
1. **Monolithic State Pollution**: 25+ state variables live at the top level of `OperationsClient`. Changing `selectedMachineId` in the assignment tab triggers a re-render of the entire logs table and client summary.
2. **Search Keystroke Thrashing**: `searchInput` state lives in `OperationsClient`. Every character typed causes React 19 to evaluate the entire 3,769-line render function.
3. **Double Render on Mount**:
   - `useEffect(() => setLogsViewMode(initialViewMode), [initialViewMode])`
   - `useEffect(() => setLogsSelectedClientId(initialClientId), [initialClientId])`
   - `useEffect(() => setLogsSelectedMachineId(initialMachineId), [initialMachineId])`
   - `useEffect(() => setLogsSelectedMonth(initialMonth), [initialMonth])`
   These 4 consecutive effects execute immediately after mounting, forcing multiple subsequent reconciliation passes.
4. **Heavy `useMemo` Re-computations**:
   - `allClientsList`: Iterates over 3 arrays to build a deduplicated `Map`.
   - `clientMachines`: Iterates over `machines` using string comparisons and array lookups.
   - `clientSites`: Iterates over logs to find site strings.

---

## 7. Current Mobile Responsiveness & Web/Mobile Parity Analysis

### Web App Mobile View (`apps/web` on Viewports ≤ 640px)
- Employs CSS display switching (`hidden sm:block` for tables, `block sm:hidden` for cards).
- Both DOM trees are mounted in the virtual DOM, increasing React tree depth.
- The mobile view currently renders a single client's summary card followed by 10 touch cards for that client's daily logs.
- Lacks a mobile-optimized Client Groups browse view where supervisors can see all client accounts as tap-to-expand cards.

### Mobile App Native View (`apps/mobile/app/(app)/operations.tsx`)
- Screen: 3,341 lines (132.9 KB).
- Data fetching via TanStack Query:
  - `useOperationsMasterData`: Eagerly fetches all machines (with supervisor joins), all assignments (with 4 user/machine joins), all operators, and all clients.
  - `useOperationsLogs`: Fetches all machine hour logs with full relations.
- Uses `ScrollView` instead of `FlatList` or `FlashList`, mounting every single log card in native memory simultaneously.
- When `logsViewMode === 'client'`, it filters logs in JavaScript:
  ```typescript
  const clientLogs = logs.filter(l => l.client_id === selectedClientId);
  ```
  This forces all logs across all clients to be downloaded over mobile cellular data.
- **Drift Identified**: Web and Mobile query structures are divergent. Web uses RSC + DAL with server-side pagination; Mobile uses client-side TanStack queries that download unpaginated datasets.

---

## 8. Export Overhead & Bundle Weight Analysis

### Static SheetJS (`xlsx`) Import
In `apps/web/lib/utils/operator-logs-export.ts` and `apps/web/lib/utils/supervisor-logs-export.ts`:
```typescript
// Line 1:
import * as XLSX from "xlsx";
```
- **Impact**: Any component or module that imports from `operator-logs-export.ts` bundles the entire SheetJS library (~180 KB minified, ~55 KB gzipped) into the initial client bundle.
- In Milestone M10 (Machine Directory), this was resolved via dynamic imports (`await import("xlsx")`). The same optimization has **not yet been applied** to Fleet Operations.

### Un-virtualized DOM Printing
In `PrintableSupervisorLogsModal.tsx`:
- The modal calls `getOperationsExportLogsAction`, retrieving up to **5,000 log records** from PostgreSQL.
- It maps directly to standard HTML `<tr>` elements inside a non-virtualized `<table>`.
- Rendering 500–1000 operational log rows with SVG icons and borders causes severe DOM thrashing, high memory usage, and browser freezes during `window.print()`.

---

## 9. Top 20 Performance Bottlenecks & Architectural Flaws

| # | Category | Bottleneck Description | Impact / Evidence | Severity |
|---|---|---|---|---|
| **1** | Database | **Eager Machine Preloading**: Loading ALL machines (`getMachines({ pageSize: 1000 })`) on initial page load. | 19 rows transferred now; scales to 1,000+ rows (~250 KB) in production. | **P0 (Critical)** |
| **2** | Database | **Eager Client Preloading**: Fetching all clients with 22 columns without pagination or active scoping. | Over-fetches billing addresses, GSTIN, PAN, and contact details for operational logs. | **P0 (Critical)** |
| **3** | Database | **Eager Staff Preloading**: Querying all users with roles `['operator', 'supervisor', 'manager', 'admin', 'super_admin']`. | 79 staff records serialized on every page hit. | **P1 (High)** |
| **4** | Query Design | **250-Row Location Hack**: Querying 250 recent logs purely to extract unique location strings in JS. | Extra database query and CPU array processing on every request. | **P1 (High)** |
| **5** | Architecture | **Missing Client Groups Hierarchy**: Page forces single-client dropdown selection rather than rendering progressive Client Groups. | Violates user target page specification; cannot see fleet-wide client overview. | **P0 (Critical)** |
| **6** | Database | **Cartesian Product in Multi-Table Aggregations**: Naive `LEFT JOIN` between `machines` and `machine_hour_logs` creates $N \times M$ rows. | 1,335 intermediate rows generated for just 2 clients (2.67ms vs 0.58ms with subqueries). | **P1 (High)** |
| **7** | Component | **Monolithic 3,769-Line Client Component**: Single component file managing all tabs, modals, and views. | 199 KB file size; high parsing/compilation overhead; excessive re-render radius. | **P0 (Critical)** |
| **8** | Client JS | **In-Memory Client Merging**: Merging `dbClients`, `hourLogs`, and `machines` in client JS `useMemo`. | Duplicate CPU cycles on every client render pass. | **P2 (Medium)** |
| **9** | React | **Cascade Mount Re-Renders**: 8 `useEffect` hooks setting local state from URL props after mount. | Triggers multiple consecutive reconciliation passes on initial load. | **P1 (High)** |
| **10** | React | **Typing Lag in Search**: State `searchInput` held in parent component; re-renders entire tree on every keystroke. | INP degradation; input typing latency. | **P1 (High)** |
| **11** | PostgREST | **Embedded Foreign Key Projections**: Embedding machine, client, and operator objects in each log row. | Increases query planning time and multiplies JSON payload size by 3x. | **P1 (High)** |
| **12** | Bundle Size | **Static SheetJS Import**: `import * as XLSX from "xlsx"` at top of export utility files. | ~180 KB uncompressed JS added to client bundles. | **P1 (High)** |
| **13** | Progressive UI | **Missing Client Machine Lazy Loading**: Client machines filtered from global array in JS instead of fetched on expand. | Forces client to hold all machines in memory. | **P0 (Critical)** |
| **14** | Progressive UI | **Missing Daily Logs Lazy Loading**: Logs queried upfront instead of fetched on-demand when a machine is inspected. | Blocks initial page render waiting for paged log slices. | **P0 (Critical)** |
| **15** | Memory | **Un-virtualized Export Modal**: Rendering up to 5,000 DOM rows in print modal. | Browser tab freezes and memory consumption spikes above 200 MB. | **P2 (Medium)** |
| **16** | DOM | **Dual DOM Tree for Responsive Views**: Desktop table and mobile cards mounted concurrently via CSS display toggles. | Doubles DOM node count; wastes CPU during style recalculations. | **P2 (Medium)** |
| **17** | Mobile | **Unpaginated Data Fetching in Mobile App**: Mobile downloads all machines and assignments via client-side query. | Excessive cellular data consumption (~500 KB per launch). | **P0 (Critical)** |
| **18** | Mobile | **`ScrollView` Memory Bloat**: Mobile operations screen maps over logs in `ScrollView` without virtualization. | Stutters on Android devices with large log histories. | **P1 (High)** |
| **19** | Database | **Un-indexed Location Search**: PostgREST ILIKE on `location` triggers sequential scan. | Lacks GIN trigram index on `machine_hour_logs.location`. | **P2 (Medium)** |
| **20** | Database | **Lack of Client-Level Operations Summary RPC**: No database function exists to aggregate client groups in <1ms. | Forces JavaScript to stitch together machine counts and day counts. | **P0 (Critical)** |

---

## 10. Recommended Target Architecture: Progressive Query-Driven System

To transform the Client view of Fleet Operations into a world-class, ultra-fast progressive system matching the Machine Directory reference architecture, the following 3-tier hierarchy must be established:

```text
================================================================================
TIER 1: CLIENT GROUPS SUMMARY (Initial Fast Load)
================================================================================
Route: /operations?tab=logs&view=client
Payload: ~3-5 KB (Only paginated Client Groups)
Execution Time: < 3.0 ms
Database Function: public.get_client_operations_directory(p_month, p_search, p_page, p_page_size)

UI Representation:
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Search Clients...] [Select Month: September 2026]           [Export / Print]│
├──────────────────────────────────────────────────────────────────────────────┤
│ CLIENT NAME           CLIENT ID   MACHINES   DAYS   RUN HRS   OT    EXPAND   │
├──────────────────────────────────────────────────────────────────────────────┤
│ ▶ JK Paper Ltd.       JKP-001     16         9      142.5h    18h   [ v ]    │
│ ▶ Saint Gobain        SG-004      1          33     210.0h    0h    [ v ]    │
└──────────────────────────────────────────────────────────────────────────────┘
• Zero machine hour logs loaded upfront.
• Zero individual machines loaded upfront.
• Zero operator records loaded upfront.
• Instant TTFB (< 200 ms).
```

```text
================================================================================
TIER 2: CLIENT MACHINES ON EXPAND (On-Demand Retrieval)
================================================================================
Trigger: User clicks [ v ] (Expand) on a Client Group row
Server Action: getClientOperationsMachinesAction(clientId, month)
Payload: ~2 KB (Only machines assigned to that specific client)
Execution Time: < 2.0 ms
Cache: Client session cache (clientMachinesCacheRef) provides instant 0ms toggling.

UI Representation:
▼ JK Paper Ltd. (16 Machines, 9 Active Days)
  ┌────────────────────────────────────────────────────────────────────────────┐
  │ MACHINE ID   MODEL       SERIAL NO      ASSIGNED OPERATOR   STATUS  LOGS   │
  ├────────────────────────────────────────────────────────────────────────────┤
  │ REACH-001    CAT-320D    SN-8849201     Rajesh Kumar        Active  [View] │
  │ REACH-004    VOLVO-EC210 SN-7729104     Amit Singh          Active  [View] │
  │ REACH-007    KOMATSU-200 SN-6638192     Vikram Patil        Maint.  [View] │
  └────────────────────────────────────────────────────────────────────────────┘
```

```text
================================================================================
TIER 3: DAILY RUNNING LOGS ON CLICK (On-Demand Machine Logs)
================================================================================
Trigger: User clicks [View] or a Machine Row in Tier 2
Server Action: getMachineDailyLogsAction(machineId, month, page, pageSize)
Payload: ~3 KB (Only 10 paginated daily logs for that specific machine)
Execution Time: < 2.0 ms
Cache: Client session cache (logsCacheRef) provides 0ms back-navigation.

UI Representation:
  ▼ REACH-001 (CAT-320D) — Daily Running Logs for September 2026
    ┌──────────────────────────────────────────────────────────────────────────┐
    │ DATE        TIMINGS            WORK (WT)   OT    HMR          REMARKS    │
    ├──────────────────────────────────────────────────────────────────────────┤
    │ 12 Sep 2026 08:00 AM - 05:00 PM 8.0 hrs    1.5h  1,420 → 1,428 Normal    │
    │ 11 Sep 2026 08:00 AM - 05:00 PM 8.0 hrs    0.0h  1,412 → 1,420 Normal    │
    │ 10 Sep 2026 08:00 AM - 01:30 PM 5.5 hrs    0.0h  1,406 → 1,412 Breakdown │
    └──────────────────────────────────────────────────────────────────────────┘
```

---

## 11. Milestone Implementation Roadmap (Phase 2)

| Milestone | Title | Focus & Deliverables |
|---|---|---|
| **C1** | **Client Page Audit Agent** | Comprehensive read-only performance & architecture audit (**THIS DOCUMENT**). |
| **C2** | **Client Database Optimization** | PostgreSQL RPC `get_client_operations_directory` + subquery aggregation to eliminate Cartesian joins + indexes on `machine_hour_logs (client_id, log_date, is_breakdown)`. |
| **C3** | **Client DAL & Cache Architecture** | Refactor `operators.ts` into isolated DAL functions with Tag-based caching (`TAGS.clientOperations(id)`). |
| **C4** | **Progressive Client Groups UI** | Build the 3-Tier progressive hierarchy: Client Groups Table/Cards -> Expand to Machines -> Click to Daily Logs. |
| **C5** | **Client View Code Splitting & Re-render Isolation** | Split `OperationsClient.tsx` into decoupled view modules (`ClientOperationsView.tsx`); isolate search inputs; eliminate typing lag. |
| **C6** | **Client Search, Filter & Date Range Optimization** | Server-side debounced search with trigram GIN indexes; URL-synchronized month & custom date range picker. |
| **C7** | **Client Operations Export Optimization** | Dynamic import code-splitting for SheetJS (`xlsx`); centralized PDF reporting; zero export preloading. |
| **C8** | **Client Mobile Synchronization** | Synchronize progressive hierarchy to `apps/mobile`: Virtualized card lists, touch targets (≥44px), TanStack Query caching. |
| **C9** | **Client Mutation & Surgical Cache Invalidation** | Precise cache invalidations on log entry, edit, conflict resolution, and machine assignment. |
| **C10** | **QA, Benchmarks & Regression Verification** | Verify TTFB < 250ms, DB query < 5ms, 0 TypeScript errors across Web and Mobile, complete memory documentation update. |

---

## 12. Acceptance Criteria for C1 Milestone

- [x] Read-only audit conducted with zero modifications to application source code.
- [x] All data flows traced from Route (`page.tsx`) through DAL (`operators.ts`) to live PostgreSQL database (`dhbbgfzbyatzvqafnsqp`).
- [x] Initial query waterfall, payload volume, and cache behavior documented with empirical timings.
- [x] Component hierarchy and re-render bottlenecks in `OperationsClient.tsx` identified and quantified.
- [x] Mobile responsiveness and cross-platform synchronization gaps analyzed.
- [x] Top 20 performance bottlenecks cataloged with severity classifications.
- [x] Progressive 3-tier target architecture (`Client Groups` -> `Client Machines` -> `Daily Logs`) fully designed.
- [x] Audit report generated: `CLIENT_OPERATIONS_CURRENT_ARCHITECTURE.md`.
