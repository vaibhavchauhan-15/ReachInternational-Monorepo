# Machine Directory Architectural & Performance Audit (M1)
**Document**: `MACHINE_PAGE_CURRENT_DATA_FLOW.md`  
**Target Route**: `/machines` (`apps/web/app/(app)/machines/page.tsx`)  
**Role**: Machine Directory Performance Engineer  
**Status**: COMPLETE AUDIT (No Code Modified)  
**Date**: 2026-09-12  

---

## Executive Summary

The Machine Directory (`/machines`) serves as the core operational fleet inventory hub for **ReachInternational**. It manages industrial assets, meter readings (HMR), maintenance and health states, rental allocations to clients, and multi-shift supervisory/operator assignments.

This audit evaluates the end-to-end architecture across the 20 structural components, traces all inbound and outbound data requests, identifies critical architectural bottlenecks (including disconnected KPI metrics, in-memory filtering on paginated slices, request waterfalls, and payload bloat), and provides the foundational technical blueprint for milestones **M2 through M12**.

---

## 1. Complete Inspection of the 20 Architecture Areas

### 1. Page Component (`apps/web/app/(app)/machines/page.tsx`)
- **Nature**: Asynchronous React Server Component (RSC).
- **Execution Flow**:
  1. Calls `getCurrentUser()` (`lib/dal.ts`) to authenticate and verify user role via HMAC edge signature and session validation.
  2. Enforces operator role boundary: calls `protectOperatorRoute(user.role)`.
  3. Resolves asynchronous search parameters: `page` (default `1`), `search` (default `""`), `status` (default `"all"`). Note: `city` is defined in `MachinesPageProps` interface but completely ignored in execution logic.
  4. Dispatches 4 parallel server queries via `Promise.all`:
     - `getMachines({ search, status, page, pageSize: 25 })`
     - `getActiveSupervisors()`
     - `getActiveOperators()`
     - `getClientOptions()`
  5. Renders `<MachineListClient>` passing all 4 datasets as serialized props across the network boundary.
- **Streaming & Suspense**: Root export `MachinesPage` wraps `MachinesContent` in `<Suspense fallback={<MachinesSkeleton />}>`.
- **Loading Skeleton**: `loading.tsx` renders `<MachinesSkeleton />`.

### 2. Layout (`apps/web/app/(app)/layout.tsx`)
- **Configuration**: `dynamic = "force-dynamic"`, `revalidate = 0`.
- **Context**: Validates authenticated session, checks user active/pending status, verifies profile onboarding completeness (`user.complete_profile === "yes"` bypasses check with 0 CPU overhead), reads sidebar collapsed state cookie (`reachinternational_sidebar_collapsed`), and wraps children inside `<AppShellClient>`.

### 3. Server/Client Boundaries
- **Server Boundary**: `apps/web/app/(app)/machines/page.tsx` executes on the server.
- **Client Boundary**: `apps/web/components/machines/MachineListClient.tsx` marked with `"use client"`.
- **Serialized Prop Transfer**:
  - `machines` (Array of 25 heavily hydrated machine objects including nested client records and personnel arrays).
  - `supervisors` (Full directory list of all active supervisors and supervisor employees across the organization).
  - `operators` (Full directory list of all active operators and driver employees across the organization).
  - `clients` (Full directory list of all active CRM clients with address fields).
- **Dynamic Code-Split Modals** (`next/dynamic` with `ssr: false`):
  - `MobileMachineCard.tsx`
  - `MachineModal.tsx`
  - `MachineImportModal.tsx`
  - `PrintableMachineDirectoryModal.tsx`

### 4. Machine Table (`EnterpriseTable.tsx`)
- **Viewport**: Rendered exclusively on Desktop/Tablet viewports (`hidden sm:block`).
- **Columns (12)**:
  1. `MACHINE ID` (11%, font-mono link to `/machines/[id]`, sortable)
  2. `MODEL` (12%, truncate max-w-[120px], sortable)
  3. `SERIAL NO` (12%, font-mono mute, truncate max-w-[120px])
  4. `YUM` (6%, Year of Manufacture, font-mono)
  5. `MFR` (9%, Manufacturer, truncate max-w-[90px])
  6. `HMR` (7%, Hour Meter Reading, font-mono bold sky-600, sortable)
  7. `ASSIGNED CLIENT` (14%, Company Name + Client Code badge)
  8. `SUPERVISOR` (12%, `PersonnelCell` multi-shift rendering with dynamic typography: 1 name = 12px, 2 names = 11px, 3+ names = 10px + `+N` badge)
  9. `OPERATOR (24H)` (12%, `PersonnelCell` with amber badge)
  10. `HEALTH` (9%, `Active`, `Spare`, `Maintenance`, `Breakdown` status badges, sortable)
  11. `STATUS` (8%, `Available` / `Rented` badges, sortable)
  12. `ACTIONS` (4%, Contextual row actions dropdown `RowActionsMenu`)
- **Features**: Row checkbox selection (`selectable`), bulk action trigger bar, empty state fallback, row click navigation (`router.push('/machines/[id]')`).

### 5. Machine Cards (`MobileMachineCard.tsx`)
- **Viewport**: Rendered on Mobile devices (`block sm:hidden`) and when Cards view mode is active.
- **Card Structure**:
  - Top colored accent border matching health/rental status (`border-l-[3px] border-l-rose-500` for breakdown, `border-l-amber-500` for maintenance, `border-l-cyan-500` for spare, `border-l-sky-500` for rented, `border-l-emerald-500` for active).
  - Click-to-copy Machine ID pill button with feedback toast.
  - Model, S/N, YUM, and Manufacturer metadata tags.
  - Health and Rental status badges.
  - Inset key specs well: HMR reading, Assigned Client, Supervisor list with `+N` indicator, Operator (24h) list with `+N` indicator.
  - Action footer: Role-gated Edit/Update Status button, Delete button, and "View Details" navigation link.

### 6. Auto View / Cards / Table View Switcher
- **State**: `viewMode` (`"auto" | "cards" | "table"`), defaults to `"auto"`.
- **Responsive Treatment**: The view switcher toolbar button group is strictly hidden on mobile devices (<=640px) via `hidden sm:flex`.
- **Rendering Matrix**:
  - `"auto"`: Renders `EnterpriseTable` on desktop (`hidden sm:block`) and `MobileMachineCard` list on mobile (`block sm:hidden`).
  - `"cards"`: Renders responsive card grid (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) across all viewports.
  - `"table"`: Renders `EnterpriseTable` on desktop, falling back to `MobileMachineCard` on mobile viewports.

### 7. Search
- **Input**: `FilterToolbar` search bar with instantaneous debounced feedback (`useDeferredValue(search)`).
- **Behavior**:
  - Form submit or Enter key triggers `updateFilters({ search: deferredSearch, page: 1 })`, updating URL search param `?search=...` and server-transitioning via `router.push`.
  - **Severe Architectural Inefficiency**: While awaiting server response, `filteredAndSortedMachines` runs an immediate in-memory substring match across 10 fields (`machine_id`, `model`, `serial_number`, `manufacturer`, `year_of_mfg`, `supervisor`, `operator`, `client name`, `client code`, `customer_name`) over **only the current 25 rows in memory**. When the server response returns, `filteredAndSortedMachines` filters the server results a second time.

### 8. Filters
- **Four Dropdown Filters**:
  1. `Rental Status` (`currentStatus`): Syncs to URL `?status=...`. Handled on server by `getMachines`. Also filtered redundantly on client in `filteredAndSortedMachines`.
  2. `Health Status` (`healthStatusFilter`): **Purely client-side state** (`useState("all")`). Does NOT sync to URL; does NOT reach the server query; filters only the 25 rows in memory.
  3. `Supervisor` (`supervisorFilter`): **Purely client-side state** (`useState("all")`). Does NOT sync to URL; does NOT reach the server query; filters only the 25 rows in memory.
  4. `Sort By` (`sortBy`): **Purely client-side state** (`useState("machine_id_asc")`). Does NOT sync to URL; does NOT reach the server query; sorts only the 25 rows in memory.
- **Active Filter Chips**: Dynamic pill row with clear buttons (`X`) and a global "Clear All" action.

### 9. Columns Selector
- **Implementation**: Managed internally inside `EnterpriseTable.tsx` via `visibleColumnIds` state and `showColumnMenu` popover.
- **Capabilities**: Allows toggling visibility of any of the 12 columns. Prevents hiding all columns (minimum 1 column enforced).
- **Persistence**: Not persisted in LocalStorage or cookies; resets to default on page reload or route transition.

### 10. Density Selector
- **Implementation**: Managed inside `EnterpriseTable.tsx` via `density` state (`"compact" | "default" | "comfortable"`).
- **Padding Tokens**:
  - `compact`: `py-1.5 px-2 text-xs`
  - `default`: `py-2 px-2.5 text-xs`
  - `comfortable`: `py-2.5 px-3 text-xs font-medium`
- **Persistence**: Resets on route reload.

### 11. Pagination
- **Server Pagination**: Managed via URL search parameter `?page=X`.
- **Calculation**: Handled on server in `getMachines` using SQL `.range((page - 1) * 25, page * 25 - 1)`.
- **Component**: `<Pagination page={page} pageSize={pageSize} total={total} onPageChange={handlePageChange} />`.
- **Architectural Disconnect**: If client-side filters (`healthStatusFilter`, `supervisorFilter`) reduce the 25 loaded records to 2, the pagination bar still shows the total server page count (e.g. "Page 1 of 6"), confusing users.

### 12. KPI Cards
- **Four Interactive Metric Cards**:
  1. `Total Machines`: Displays `total` from server count. Clicking sets `status=all`.
  2. `Available Fleet`: Displays `statsSummary.availableCount`. Clicking sets `status=available`.
  3. `On Rent`: Displays `statsSummary.rentedCount`. Clicking sets `status=rented`.
  4. `Breakdown Events`: Displays `statsSummary.breakdownCount`. Clicking toggles `healthStatusFilter="breakdown"`.
- **CRITICAL ARCHITECTURAL BUG (DATA ACCURACY)**:
  `statsSummary` is calculated via `machines.forEach(...)` on client over `machines` prop (which contains **only the 25 machines on the current page**).
  - Example: A fleet has 142 total machines, 80 available, 62 on rent, and 12 in breakdown.
  - Card 1 (`Total Machines`) displays **142** (from server exact count).
  - Card 2 (`Available Fleet`) displays **14** (calculated only from page 1's 25 rows!).
  - Card 3 (`On Rent`) displays **11** (calculated only from page 1's 25 rows!).
  - Card 4 (`Breakdown Events`) displays **0** (because no breakdown happened to be on page 1!).
  - Cards 2 and 3 sum to 25 instead of 142, creating immediate user distrust.

### 13. Row Actions Menu (`RowActionsMenu`)
- **Trigger**: Three-dot button (`⋮`) in the desktop table.
- **Positioning**: Portaled to `document.body` via `createPortal` with window boundary clamping and smart vertical flipping (`shouldOpenUpwards`).
- **Options**:
  - Manager/Admin: "Edit Machine" (opens `MachineModal`).
  - Supervisor: "Update Status" (opens `MachineModal` in operational-only mode).
  - All Users: "View Details" (links to `/machines/[id]`).
  - Manager/Admin: "Delete Machine" (triggers `ConfirmationDialog`).

### 14. Machine Details (`/machines/[id]`)
- **Route**: `apps/web/app/(app)/machines/[id]/page.tsx`.
- **Data Fetching**: Parallel fetch of `getMachineById(id)` and `getMachineActiveRental(id)`.
- **Tabs**:
  - `Overview`: Machine specifications, client details, HMR, active rental contract details, assigned supervisors and operators.
  - `Running Hours`: Displays machine hour meter logs. **Properly lazy-loaded** on demand when the tab is clicked via Server Action `getMachineHourLogsAction(machineId)`.

### 15. Edit Machine Functionality
- **Modal Path**: On `/machines`, clicking Edit opens `MachineModal` in-place with existing machine data. Submits via Server Action `updateMachine(id, state, formData)`.
- **Full Page Path**: `/machines/[id]/edit` (`machine-edit-client.tsx`). Fetches `getMachineById`, `getActiveSupervisors`, `getActiveOperators`, `getClientOptions`.
- **Validation**: Uniqueness of Serial Number verified dynamically on blur via `checkMachineSerialNumberAvailable`.
- **Permissions**: Role-gated via `requireRole` and database trigger `trg_enforce_supervisor_machine_update_restrictions` (supervisors can only update operational fields: HMR, status, health, operators, client).

### 16. Add Machine Functionality
- **Trigger**: "Add Machine" button in page header.
- **Modal**: `MachineModal` in creation mode (`machine = null`).
- **Server Action**: `createMachine(state, formData)`.
- **Auto-Increment Redundancy**: Server action scans `machines` table for `RI-MC-%` IDs using `LIMIT 100` in Node.js to compute `maxNum + 1`, even though PostgreSQL sequence `machines_id_seq` and trigger `trg_generate_machine_id` are already present in database migration `002`.

### 17. Delete / Deactivate Functionality
- **Trigger**: "Delete Machine" in row actions menu or mobile card footer.
- **Modal**: `<ConfirmationDialog variant="danger">`.
- **Server Action**: `deleteMachine(id)` in `apps/web/app/actions/machines.ts`.
- **Operation**: Issues hard `DELETE FROM public.machines WHERE id = id`.
- **Constraint Handling**: Catches foreign key violations (e.g. when logs or service records exist) and formats error via `formatMachineDatabaseError`.
- **Audit**: Inserts structured audit entry `machine.deleted`.

### 18. Assignment Functionality
- **Personnel Model**: Supports multiple supervisors (`supervisor_ids UUID[]`) and multiple operators (`operator_ids UUID[]`) per machine for 24-hour shift operations.
- **Database Trigger**: `trg_sync_machine_personnel_arrays` keeps `current_supervisor_id` = `supervisor_ids[1]` and `current_operator_id` = `operator_ids[1]`.
- **Authoritative Shifts**: Migration `047` created `public.operator_machine_assignments` and `public.operator_shift_ranges` with GiST exclusion constraints preventing operator double-booking.
- **List Hydration**: `getMachines` runs `hydrateMachinesPersonnel`, which queries `operator_machine_assignments` for all 25 machines on every page view.

### 19. Machine History
- **Location**: `/machines/[id]` -> "Running Hours" tab.
- **Query**: `getMachineHourLogsAction(machineId)`.
- **Payload**: Retrieves up to 50 logs with start/end meter, running hours, overtime, breakdown flag, operator details, and client details.
- **Export**: Generates machine-specific PDF and Excel history reports.

### 20. Machine-Related Dialogs / Drawers
1. `MachineModal.tsx`: Comprehensive creation and editing modal.
2. `MachineImportModal.tsx`: Bulk Excel spreadsheet importer with drag-and-drop, template download, and per-row error reporting.
3. `PrintableMachineDirectoryModal.tsx`: High-density A4 PDF report preview and browser print portal.
4. `ConfirmationDialog.tsx`: Destructive action confirmation dialog.
5. **Orphaned / Dead Components Identified**:
   - `MachineCategoryModal.tsx` (143 lines): Completely unreferenced anywhere in codebase.
   - `MobileFilterDrawer.tsx` (147 lines): Unreferenced legacy filtering drawer.
   - `MachineRow.tsx` (152 lines): Unreferenced legacy table row.

---

## 2. Complete Data Request Trace

Every network, database, and cache request associated with the Machine Directory is traced below:

| # | Request Name | Source File | Supabase Target (Table/RPC) | Columns Selected | Rows Returned | Filters Applied | Sorting | Pagination | Index Utilized | Cache Behavior | Duplicated? | Required on Initial Load? | Can be Lazy Loaded? |
|---|--------------|-------------|-----------------------------|------------------|---------------|-----------------|---------|------------|----------------|----------------|-------------|---------------------------|---------------------|
| **R1** | `verifySession` / `getCurrentUser` | `lib/dal.ts` | `public.users` | `id, email, full_name, phone, role, status, avatar_url, complete_profile, shift_time, created_at, updated_at` | 1 | `id = auth.uid()` | None | None | `users_pkey` | React `cache()` (per request) | No (deduped by React cache) | **YES** | No (auth gate) |
| **R2** | `getMachines` (Primary Fleet) | `lib/queries/machines.ts:146` | `public.machines` + 3 joins (`users`, `users`, `clients`) | 16 machine cols + 5 operator cols + 5 supervisor cols + 19 client cols (**45 columns total**) | 25 | Role scope, `search`, `status` | `machine_id ASC` | `LIMIT 25 OFFSET (page-1)*25` + `count: "exact"` | `idx_machines_status_health`, `machines_machine_id_key` | React `cache()` | No | **YES** | No (core page data) |
| **R3** | `hydrateMachinesPersonnel` (Users) | `lib/queries/machines.ts:63` | `public.users` | `id, full_name, phone, email, shift_time, role` | 1 – 50 | `.in("id", allUserIds)` | None | None | `users_pkey` | None | **YES** (Overlaps with joined `current_operator` & `current_supervisor` in R2) | **YES** | No |
| **R4** | `hydrateMachinesPersonnel` (Active Assignments) | `lib/queries/machines.ts:79` | `public.operator_machine_assignments` | `id, machine_id, operator_id, shift_start_time, shift_end_time, crosses_midnight, is_active, assigned_by, assigned_at, ended_at, ended_by, end_reason, created_at, updated_at` (14 cols) | 0 – 50 | `.in("machine_id", machineIds).eq("is_active", true)` | `shift_start_time ASC` | None | `idx_oma_machine_active` | None | No | **PARTIAL** (Only operator IDs needed, not all 14 shift/audit cols) | Yes (can be simplified) |
| **R5** | `getActiveSupervisors` | `lib/queries/machines.ts:380` | `public.users` + `public.employees` | `users(6 cols)`, `employees(6 cols)` | All supervisors in DB | `role='supervisor'`, `status!='inactive'` | `full_name ASC` | None (unbounded) | `idx_users_role`, `idx_users_status` | Next.js `unstable_cache` (1 hr, tag `machinesMeta`) | No | **NO** (Only needed if modal opened or dropdown used) | **YES** (On modal open) |
| **R6** | `getActiveOperators` | `lib/queries/machines.ts:457` | `public.users` + `public.employees` | `users(7 cols)`, `employees(6 cols)` | All operators in DB | `role='operator'`, `status='active'` | `full_name ASC` | None (unbounded) | `idx_users_role`, `idx_users_status` | Next.js `unstable_cache` (1 hr, tag `machinesMeta`) | No | **NO** (Unused on `/machines` list view! Only used in closed modal) | **YES** (On modal open) |
| **R7** | `getClientOptions` | `lib/queries/clients.ts:77` | `public.clients` | `id, code, company_name, city, district, state, pincode, street, phone` (9 cols) | All clients in DB | `deleted_at IS NULL` | `company_name ASC` | None (unbounded) | `idx_clients_deleted_at` | Next.js `unstable_cache` (1 hr, tag `clients`) | No | **NO** (Unused on `/machines` list view! Only used in closed modal) | **YES** (On modal open) |
| **R8** | `checkMachineSerialNumberAvailable` | `app/actions/machines.ts:568` | `public.machines` | `id, machine_id, serial_number` | 1 | `serial_number ILIKE ...` | None | `LIMIT 1` | `idx_machines_serial_number_lower_unique` | None | No | **NO** (On input blur) | **YES** (Interactive) |
| **R9** | `createMachine` (Uniqueness & ID Scan) | `app/actions/machines.ts:106` | `public.machines` | `id, machine_id, serial_number` | 1 + 100 | `serial_number ILIKE ...`, `machine_id LIKE 'RI-MC-%'` | `created_at DESC` | `LIMIT 100` | Table scan / B-tree | None | **YES** (Redundant with DB trigger) | **NO** (Mutation) | **YES** (Mutation) |
| **R10** | `importMachinesFromExcel` (Pre-fetch) | `app/actions/machine-import.ts:135` | `public.machines` | `machine_id, serial_number` | All rows in `machines` | None | None | None (unbounded) | Table scan | None | No | **NO** (Bulk Import Modal) | **YES** (Interactive) |
| **R11** | `getMachineHourLogsAction` | `app/actions/machines.ts:601` | `public.machine_hour_logs` + 2 joins | 19 log cols + 4 operator cols + 3 client cols | Up to 50 | `machine_id = ID` | `log_date DESC` | `LIMIT 50` | `idx_mhl_machine_date` | None | No | **NO** (On tab click on `[id]`) | **YES** (Already lazy-loaded) |

---

## 3. Comprehensive Vulnerabilities & Performance Issues Identified

### A. Unnecessary Queries on Initial Page Load
1. **`getActiveOperators()` is 100% Unnecessary on Initial Load**:
   - `page.tsx` runs `getActiveOperators()` on every visit to `/machines`.
   - This queries two tables (`users` and `employees`), sorts in memory, and serializes hundreds of operator profiles.
   - **Zero operator data is displayed in the list view**. It is passed exclusively to `MachineModal`, which is closed when the page mounts.
2. **`getClientOptions()` is 100% Unnecessary on Initial Load**:
   - `page.tsx` runs `getClientOptions()` on every visit to `/machines`.
   - It selects 9 columns for every client in the database.
   - There is NO client dropdown filter on `/machines`. The table already displays the client name from `machines.client_id` join. It is passed exclusively to the unopened `MachineModal`.
3. **`getActiveSupervisors()` Unnecessary on Initial Load**:
   - Only needed if the supervisor filter dropdown or `MachineModal` is opened.

### B. Severe Architectural Flaw: Disconnected KPI Metrics
- The 4 KPI cards at the top of the page calculate their numbers from `statsSummary` using `machines.forEach()` on the client:
  ```typescript
  // MachineListClient.tsx:942
  const statsSummary = useMemo(() => {
    let availableCount = 0;
    let rentedCount = 0;
    let breakdownCount = 0;
    machines.forEach((m) => {
      if (m.status === "rented") rentedCount++;
      else availableCount++;
      if (m.health_status === "breakdown") breakdownCount++;
    });
    return { availableCount, rentedCount, breakdownCount };
  }, [machines]);
  ```
- Because `machines` is paginated to 25 items by `getMachines`, **the KPI cards only count the 25 items on the active page**.
- `Total Machines` displays 150 (from server count), while `Available Fleet` and `On Rent` sum to 25. If there are 15 breakdowns across the fleet but 0 on page 1, `Breakdown Events` displays `0`.
- **Resolution Path (M2/M4)**: Implement a lightweight PostgreSQL summary query/RPC or scalar count aggregator returning fleet-wide totals (`total_fleet`, `total_available`, `total_rented`, `total_breakdown`) in a single sub-millisecond query.

### C. In-Memory Client-Side Filtering on Paginated Slices
- `healthStatusFilter` and `supervisorFilter` exist only as React state in `MachineListClient`.
- When a user filters by `health_status = "breakdown"`:
  - The client simply filters the 25 records on page 1.
  - Machines in breakdown on pages 2, 3, or 4 are never retrieved.
  - The user sees an empty state or incomplete list.
- **Resolution Path (M4/M8)**: Elevate `health_status`, `supervisor_id`, and `sortBy` into URL search parameters (`searchParams`) and pass them to `getMachines()` so PostgreSQL filters and sorts the entire fleet before pagination.

### D. In-Memory Client-Side Sorting on Paginated Slices
- `sortBy` ("Highest HMR", "Lowest HMR", "Newest YUM") runs in client memory via `list.sort(...)`.
- Selecting "Highest HMR" merely sorts the 25 machines on the current page; it does NOT fetch the machines with the true highest HMR in the company fleet.
- **Resolution Path (M4/M8)**: Push sort parameters (`sortField`, `sortOrder`) to `getMachines` on server.

### E. Double Filtering and Search Latency
- When searching, `FilterToolbar` updates both local state (triggering `filteredAndSortedMachines` in client memory) and dispatches a router transition to `page.tsx`.
- The user experiences a jarring visual flash: the 25 current rows are filtered locally, and a moment later the server replaces the entire array with the real search results, which are then filtered locally again.

### F. Sequential 3-Step Request Waterfall in `getMachines`
- `getMachines` executes sequentially:
  ```
  Step 1: supabase.from("machines").select(...)   [Waits for network roundtrip ~120ms]
             ↓
  Step 2: supabase.from("users").select(...)      [Waits for network roundtrip ~80ms]
             ↓
  Step 3: supabase.from("operator_machine_assignments").select(...) [Waits ~80ms]
  ```
- Total query time: ~280ms before any HTML can stream.
- **Resolution Path (M3/M4)**: Consolidate personnel hydration or run Steps 2 and 3 in parallel via `Promise.all`.

### G. Oversized Joined Payloads (SELECT Bloat)
- In `MACHINE_LIST_COLUMNS`, the join on `client:clients!machines_client_id_fkey` requests:
  `id, code, company_name, city, district, state, pincode, phone, contact_person, street, gstin, pan_number, is_billing_address_different, billing_address, billing_city, billing_district, billing_state, billing_pincode, status`.
- That is **19 columns** per machine row. The machine directory table only needs `id, code, company_name`.
- In `operator_machine_assignments`, 14 columns are retrieved including audit and timestamp fields (`created_at`, `updated_at`, `assigned_by`, `ended_by`, `end_reason`), none of which are displayed in the list view.

### H. Missing Trigram Indexes for Substring Search
- The search query generates:
  ```sql
  WHERE machine_id ILIKE '%search%'
     OR model ILIKE '%search%'
     OR serial_number ILIKE '%search%'
     OR manufacturer ILIKE '%search%'
  ```
- No GIN trigram (`pg_trgm`) indexes exist on `model`, `serial_number`, or `manufacturer`. Standard B-trees cannot index `%...%` leading wildcards, forcing a sequential table scan on every search query.

### I. Bulk Import N+1 HTTP Waterfall
- In `apps/web/app/actions/machine-import.ts`:
  - Iterates through spreadsheet rows and executes an individual `supabase.from("machines").insert(...)` roundtrip for every single row.
  - A 100-row file triggers 100 sequential HTTP requests to Supabase.

### J. Orphaned Code Bloat
- Three components in `apps/web/components/machines/` are 100% unused and unreferenced:
  - `MachineCategoryModal.tsx` (5.3 KB)
  - `MobileFilterDrawer.tsx` (5.5 KB)
  - `MachineRow.tsx` (6.2 KB)

---

## 4. Milestone Execution Roadmap (M2 → M12)

Based on the findings of this M1 audit, the structured performance roadmap is organized as follows:

- **M2 — Machine Database Optimization**:
  - Add GIN trigram indexes on `machines(machine_id, model, serial_number, manufacturer)` for instant substring search.
  - Deploy an optimized scalar summary RPC `get_machines_directory_summary()` to return accurate fleet-wide KPI counts (`total`, `available`, `rented`, `breakdown`, `maintenance`, `spare`) in <0.2ms.
- **M3 — Machine Data Access Layer**:
  - Create slim list projections (`MACHINE_DIRECTORY_ROW_PROJECTION`) selecting only the 3 client columns actually rendered.
  - Eliminate the 3-step sequential waterfall in `hydrateMachinesPersonnel` using parallel promises or joined array aggregation.
- **M4 — Machine Query + Cache Layer**:
  - Connect all filters (`health_status`, `supervisor_id`, `sortBy`, `sortOrder`) to server-side query params in `getMachines`.
  - Cache machine metadata and fleet KPI aggregates with targeted cache invalidation tags.
- **M5 — Machine Progressive Loading**:
  - Stream the page using React Suspense: render PageHeader + KPI skeleton immediately, then stream `EnterpriseTable` as data resolves.
- **M6 — Machine UI Rendering Optimization**:
  - Remove duplicate client-side `list.filter` and `list.sort` execution in `filteredAndSortedMachines`.
  - Fix `statsSummary` to consume true fleet metrics from server.
- **M7 — Machine Detail Lazy Loading**:
  - Sever `getActiveOperators()`, `getClientOptions()`, and `getActiveSupervisors()` from initial page load.
  - Lazy-load modal options dynamically only when `MachineModal` is mounted.
- **M8 — Machine Search & Filter Optimization**:
  - Unify URL query synchronizers for all filters.
  - Implement debounced server search transitions with visual loading spinner inside search bar.
- **M9 — Machine Export Optimization**:
  - Maintain dynamic SheetJS (`xlsx`) loading on export click.
  - Add server-side stream export option for large fleet datasets.
- **M10 — Machine Performance Testing**:
  - Benchmark cold/warm TTFB, Largest Contentful Paint (LCP), and database execution time before and after optimizations.
- **M11 — Machine Security Regression**:
  - Verify RLS policies, InitPlans, supervisor role boundaries, and input sanitization remain intact.
- **M12 — Machine Final Optimization**:
  - Delete orphaned components (`MachineCategoryModal`, `MobileFilterDrawer`, `MachineRow`).
  - Update `AI/STATE.md`, `AI/CHANGELOG_AI.md`, and `AI/CURRENT_TASK.md`.

---

*End of M1 Audit. No application source code was modified during this milestone.*
