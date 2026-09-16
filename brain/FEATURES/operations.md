# Operations & Fleet Operations Feature Documentation

## Overview
The Operations module is the central command center for fleet deployment, daily equipment running hours, multi-shift personnel rosters, and operational dispute management across Reach International's equipment fleet.

It provides complete cross-platform parity between the Next.js Web App (`apps/web/components/operations/*`, `apps/web/app/(app)/operations/page.tsx`) and the React Native Mobile App (`apps/mobile/app/(app)/operations.tsx`, `apps/mobile/components/operations/*`).

---

## 1. Top-Level Tab Views

### A. Daily Running Hours (`tab=logs`)
Comprehensive operational logs and equipment utilization view organized across three sub-tabs:
1. **Machine Sub-Tab**:
   - Machine Selector & Month Selector.
   - Machine Overview Header Card: Current Rental Status badge (`RENTED`, `AVAILABLE`, etc.), 2x3 metrics grid (Manufacturer, Model, Serial Number / Code, Total Run Hours, Breakdown Events count).
   - Running Logs Feed: Touch cards displaying log date, submission timestamp, machine model, serial number, client name, site location, shift details, start/end meter readings, total run hours, overtime hours, breakdown alert badges, and remarks.
2. **Clients Sub-Tab**:
   - Client Selector, Location / Site Selector, Machine Filter, and Month Selector.
   - Client Overview Header Card: Rented machine count, active site locations, client working hours, active working days in month, and CRM contact details.
   - Client-Filtered Running Logs Feed with server pagination, sorting, and 0ms in-memory cache toggling.
3. **Operator Sub-Tab**:
   - Operator Selector & Month / Custom Date Range Selector.
   - Operator Overview Header Card: Active operator name, status pill, total run hours, phone/email shortcuts, collapsible KPI grid (Run Hours, Overtime, Breakdowns, Total Logs), and on-demand "History" action button.
   - On-Demand Operator History Quick Modal (`OperatorHistoryQuickModal`): Strictly separates lifetime track record, shift assignment history, and all-time hours from primary list query; cached with `historySessionCache` for 0ms second-click latency.
   - Operator-Filtered Running Logs Feed: 20 paginated logs per page, exact column projection (`OPERATOR_LOG_EXACT_PROJECTION`), zero redundant SQL user joins (hydrated in JS memory), server sorting (`date-desc`, `date-asc`, `hours-desc`, `hours-asc`, `meter-desc`, `meter-asc`), and sub-millisecond GIN trigram search.
   - 0ms instant toggle across Machine, Client, and Operator sub-tabs via `subTabCacheRef`.

### B. Operator Machine Assignments (`tab=assignments`)
24/7 Multi-Shift Roster and Equipment Assignment Management:
- **Header Actions**: `+ Assign Operator` primary action button.
- **4 Assignment Fleet KPI Cards**: Total Equipment, Active Shift Operators, Full Capacity (3/3), Unassigned (0/3).
- **Status Filter Chips**: `All`, `Assigned`, `Full (3/3)`, `Unassigned`.
- **Global Actions**: Expand All Cards / Collapse All Cards toggle.
- **Equipment Roster Cards**: Machine code, model, serial, HMR meter reading, rental status, roster capacity pill (`0/3`, `1-2/3`, `3/3`), "+ Assign Operator" quick action, and expandable 3-shift cards (Shift 1 06:00-14:00, Shift 2 14:00-22:00, Shift 3 22:00-06:00) with operator contact shortcuts and unassign actions.

---

## 2. Modal Systems & Dialogs

### Assign Operator Modal (`MobileAssignmentModal.tsx`)
- Target Machine selector with live search.
- Operator selector with role validation (`operator`, `driver`, `helper`).
- Shift selector: Shift 1 (06:00 - 14:00), Shift 2 (14:00 - 22:00), Shift 3 (22:00 - 06:00), or Custom shift hours.
- Time pickers with standard/overnight shift indicators.
- Atomic conflict checking via `assign_operator_machine_atomic` RPC to prevent double-booking machines across shifts.

### Filter Selector Modal (`OperationsFilterSelectorModal.tsx`)
- Reusable bottom sheet modal for choosing Machine, Client, Site Location, Operator, and Month.
- Live search filtering, clean typography, Geist token adherence, and checkmark feedback.

### Export & Print Modal (`OperationsExportModal.tsx`)
- Professional PDF generation matching web `PrintableSupervisorLogsModal.tsx` via `expo-print` + `expo-sharing`.
- Direct AirPrint / Android Print Spooler integration via `Print.printAsync({ html })`.
- CSV Spreadsheet generation via `expo-file-system/legacy` + `expo-sharing`.
- Comprehensive metadata header: Export scope, active filters, total hours, overtime, breakdown count, and record count.

### Conflict Resolution Modal (`MobileConflictResolutionModal.tsx`)
- Resolves overlapping shift hours and overtime disputes via `resolve_hour_log_conflict_atomic` RPC.

---

## 3. Database & DAL Dependencies
- `machines` table: `id`, `machine_code`, `model`, `serial_number`, `manufacturer`, `status`, `current_meter_reading`.
- `machine_assignments` table: `id`, `machine_id`, `operator_id`, `shift_id`, `start_time`, `end_time`, `is_active`.
- `hour_logs` table: `id`, `machine_id`, `operator_id`, `client_id`, `log_date`, `shift_id`, `start_meter`, `end_meter`, `total_hours`, `overtime_hours`, `breakdown_occurred`, `breakdown_notes`, `remarks`, `conflict_status`.
- `clients` & `client_sites` tables: CRM client details, addresses, and site names.
- RPC functions: `assign_operator_machine_atomic`, `resolve_hour_log_conflict_atomic`.

---

## 4. Client Canonical Address & Multi-Site Location Architecture
- **Canonical Address Standard**: `address = client.street + client.city + client.district + client.state + client.pincode` (comma-delimited, non-empty components only).
- **Database Schema**: `public.clients` contains a single canonical `street text NOT NULL` column (duplicate `"Street"` and separate `address` columns were dropped in Migration 065). All application layers compute the full address on the fly.
- **Multi-Site Client Resolution**:
  - When the same client company operates across different project locations, separate client rows share the same `company_name` with distinct `street`, `city`, `district`, `state`, `pincode`.
  - The Operations Hub aggregates all site addresses for that company into `clientSites` (Web) and `clientLocations` (Mobile).
  - Filtering by site uses bidirectional containment matching (`locStr.includes(targetLoc) || targetLoc.includes(locStr)`), ensuring historical log fragments and full canonical addresses both resolve correctly.

---

## 5. Operations Hub Multi-Filter Hierarchy & Dynamic Synchronization
- **Default Multi-Filter Behavior**:
  - **Client**: Defaults to the client with the most recent operational logs (e.g. JK Paper Ltd.).
  - **Location**: Defaults to `"all"` ("All Sites & Locations").
  - **Machine**: Defaults to `"all"` ("All Machines").
  - **Month**: Defaults to the current calendar month (e.g. `"09"` / September).
- **Synchronized Filter Hierarchy (`client + location + machine + month`)**:
  - Selecting any filter dynamically updates server query parameters and recalculates both the aggregate KPI metrics (Run Hours, OT, Breakdowns, Working Days) and the paginated bottom entries table/touch cards.
  - Selecting "All Months" (`month=all`) is explicitly preserved in URL and queries across all recorded time.
  - Safe alphanumeric token resolution prevents PostgREST grammar crashes when filtering addresses containing colons or punctuation (`"CPM |PO : CP Mills"`).

---

## 6. Dynamic Viewport-Aware Selectors & Unified Transitions
- **Positioning Engine (`useDynamicDropdownPosition.ts`)**:
  - Uses `useIsomorphicLayoutEffect` for pre-paint synchronous measurement on client, eliminating the (0,0) coordinate flash on first open.
  - Returns `isPositioned: boolean` guard ensuring portals do not render before valid non-zero bounding rect calculation.
  - Provides `updatePosition()` callable synchronously in click handlers before toggling open state.
  - Automatically handles viewport collisions (flipping placement between `"bottom"` and `"top"`), dynamic max-height clipping, scroll/resize tracking (`capture: true`), and click-outside dismissal.
- **Framer Motion `<AnimatePresence>` & `<motion.div>` Standard**:
  - Consistent across `MachineSelect`, `ClientSelect`, `SearchableSelect`, `UserSelect`, `CustomDatePicker`, and `DateRangePicker`.
  - Spring-like easing: `ease: [0.16, 1, 0.3, 1]` with `duration: 0.16s`, scale `0.97`, dynamic `transformOrigin` (`"bottom center"` / `"top center"`), and directional `y` offset based on placement.
  - Non-flickering exit transitions with `onExitComplete` cleanup.

---

## 7. Unified Custom Calendar Date Range Picker (`DateRangePicker.tsx`)
- **Single Component Date Range Workflow**: Replaces separate Start Date and End Date dropdowns with a single, high-density, minimal `<DateRangePicker>` component.
- **Reused Calendar Architecture**: Reuses the exact custom calendar layout, month navigation, weekday headers, and days grid from `CustomDatePicker.tsx`.
- **Outer Portal Architecture (`createPortal` Outside `<AnimatePresence>`)**:
  - Ensures clean React 19 / Framer Motion 12 lifecycle mounting in `document.body` without `PopChildMeasure` errors.
  - Standardized across `DateRangePicker`, `CustomDatePicker`, `ClientSelect`, `MachineSelect`, `SearchableSelect`, and `UserSelect`.
- **Dynamic Viewport Collision & Explicit Style Resets**:
  - Uses explicit `top: position.top !== undefined ? `${position.top}px` : "auto"` and `bottom: position.bottom !== undefined ? `${position.bottom}px` : "auto"`.
  - Prevents Framer Motion from retaining stale coordinates that previously collapsed popovers to 0px height when flipping between top and bottom on short screens (e.g. 1536×695).
  - Streamlined height (~280px) ensures full calendar visibility without internal scrolling or cutoff.
  - Elevated z-index to `99999` guarantees popover is never blocked by cards, modals, or tables.
- **Clean, Minimal Popover Layout (No Clutter / No Presets / No Header Banner)**:
  - Removed preset quick range pills (`Today`, `Yesterday`, etc.) and status bar (`01-08-2026 → 12-09-2026 43 Days`) inside the popover to deliver an ultra-clean, appealing UI.
  - Popover opens directly with the Month Switcher navigation (`< Month Year >`), allowing users to browse and select any month's start and end dates directly on the calendar grid.
- **Interactive Range Selection**:
  - First click sets `tempStartDate`, clears `tempEndDate`, and highlights the start day.
  - Mouse hover creates a live provisional range ribbon between start date and hovered day.
  - Second click on or after start date completes the range, sets `tempEndDate`, and fires `onChange({ startDate, endDate })`.
  - Re-anchoring support: Clicking an earlier date re-anchors the start date cleanly.
  - Same-day range: Clicking the start date twice creates a single-day range (`startDate === endDate`).
- **Connected Ribbon Highlighting**: Start cell (`rounded-l-xl`), End cell (`rounded-r-xl`), and in-range cells (`rounded-none bg-sky-500/15`) with weekend edge rounding.
- **Trigger Button**: Displays `01-09-2026 to 12-09-2026` with `12 Days` pill badge, calendar icon, clear button (`AnimatedX`), and animated chevron.
- **Clean Action Footer**: Compact `Clear`, `Cancel`, and `Apply Range` buttons adhering to Vercel Geist tokens.

---

## 10. Centralized PDF Generation & Export Architecture

### Centralized Service Structure (`apps/web/lib/pdf/` & `apps/web/components/pdf/`)
- **Configuration & Filenames (`apps/web/lib/pdf/pdf-config.ts`)**:
  - Pinned page dimensions (A4 portrait: 210mm × 297mm, margins: 5mm top/bottom, 8mm left/right).
  - Standardized branding tokens: `REACH INTERNATIONAL`, `/pdf-logo.png`, `PDF_PAGE`, `MONTH_NAMES`.
  - Filename builders: `buildExportFileName`, `buildMachineExportFileName`, `buildMachinesExportFileName`.
  - Date/time slugs: `formatExportDateTimeSlug` (display and slug format).
- **Centralized Print Styles (`apps/web/lib/pdf/pdf-print-styles.ts`)**:
  - `getPrintStylesheet(documentId, previewId, options)`: Single generator for `@page`, `@media print`, `page-break-inside: avoid`, and high-density centered table styling.
- **Shared Utilities (`apps/web/lib/pdf/pdf-utils.ts`)**:
  - `isUuid()`: Identifies raw UUIDs to prevent displaying them.
  - `resolveCleanClientName()`: Cascade resolution for client company name falling back to "Client Representative".
  - `resolvePeriodLabel()`: Month or custom date range label formatter.
  - `formatCompactTiming()`: Range formatter with zero spaces.
  - `computeDurationHours()`: Standardized duration calculator.
  - `handleBrowserPrint()`: Browser print handler with temporary document title swap for clean saved filename.
- **Reusable Print Components (`apps/web/components/pdf/`)**:
  - `<PDFReportHeader>`: Reusable header with logo, title, single-line/multiline subtitle, and metadata strip.
  - `<PDFKPIStrip>`: Reusable 4-column KPI metric summary.
  - `<PDFSignatureBlock>`: Standardized 3-column verification block (Prepared By, Client Details & Sign-off, Verified & Approved By).
  - `<PDFTableWrapper>`: Print-optimized table wrapper with screen scroll support.
- **Mobile PDF Templates (`apps/mobile/lib/pdf-html-templates.ts`)**:
  - `buildPdfHtmlStyles`, `buildPdfHtmlHeader`, `buildPdfHtmlKpiStrip`, `buildPdfHtmlSignatureBlock`, `buildPdfHtmlWrapper` used by `OperationsExportModal.tsx` and `MachineExportModal.tsx` for `expo-print`.

---

## 8. Unified Operations Query & Cache Key Architecture (`@reachinternational/utils`)
- **Shared Query Keys Module (`packages/utils/src/operations-keys.ts`)**:
  - Deterministic serialization of all query parameters (`serializeMachineLogsFilter`, `serializeClientLogsFilter`, `serializeOperatorLogsFilter`, `serializeAssignmentsFilter`, `serializeSummaryFilter`).
  - Strict handling: omitted vs default values yield identical cache keys to avoid cache fragmentation.
- **Hierarchical String Keys (`OPERATIONS_KEYS`)**:
  - `operations:logs:machine:{filters}`
  - `operations:logs:client:{filters}`
  - `operations:logs:operator:{filters}`
  - `operations:assignments:{filters}`
  - `operations:log-detail:{id}`
  - `operations:assignment-detail:{id}`
  - `operations:filters:machines`
  - `operations:filters:clients`
  - `operations:filters:operators`
  - `operations:filters:sites:{clientId}`
  - `operations:summaries:{filters}`
- **TanStack Query Array Keys (`OPERATIONS_QUERY_KEYS`)**:
  - `['operations', 'logs', 'machine', { ... }]`
  - `['operations', 'logs', 'client', { ... }]`
  - `['operations', 'logs', 'operator', { ... }]`
  - `['operations', 'assignments', { ... }]`
  - `['operations', 'filters', 'machines' | 'clients' | 'operators']`
  - `['operations', 'details', 'log' | 'assignment', id]`
- **Cache Invalidation Tags (`apps/web/lib/data/operations/keys.ts`, `apps/web/lib/cache/tags.ts`)**:
  - Registered granular tags: `operations`, `operationsLogs`, `operationsAssignments`, `operationsFilters`, `operationsSummaries`, `operationLogDetail(id)`, `operationAssignmentDetail(id)`, `clientOperations(clientId)`, `machineOperations(machineId)`, `operatorOperations(operatorId)`.

---

## 11. Modular Component Hierarchy & Dynamic Code Splitting (`apps/web/components/operations/`)
- **Thin Coordinator Shell (`OperationsClient.tsx`)**:
  - Reduced from 3,769 lines (199.8 KB) to 234 lines (6.6 KB).
  - Coordinates header, top-level tabs, active tab selection, and dialog state without holding sub-view state.
- **Dynamic On-Demand Module Splitting (`next/dynamic`)**:
  - `OperationsAssignmentsTab`: Dynamic chunk `258th1peshebt.js` (16.01 KB) with `OperationsAssignmentsSkeleton` fallback.
  - `OperatorDashboard`: Dynamic chunk `40j4irph7-bp1.js` (172.44 KB) with `OperatorDashboardSkeleton` fallback; loaded only for operator users.
  - `AssignOperatorModal`: Dynamic chunk `2isb1seg791ew.js` (12.26 KB); loaded only on click.
  - `PrintableSupervisorLogsModal` & SheetJS: Dynamic chunk `071y3s7tillhf.js` (39.97 KB); loaded only on report export/print.
  - `ConflictResolutionModal`: Dynamic chunk `284389_pkuu_x.js` (9.72 KB); loaded only on conflict review.
- **Sub-Component Hierarchy**:
  - `OperationsHeader.tsx`: Title and action triggers.
  - `OperationsTabs.tsx`: Top tab navigation strip.
  - `skeletons/OperationsSkeletons.tsx`: Fallback skeleton loaders for tables, cards, assignments, and dashboard.
  - `logs/OperationsLogsTab.tsx`: Isolated log filter bar, debounced search (350ms), sub-view pill switcher, table, and mobile cards.
  - `logs/OperationsMachineView.tsx`, `logs/OperationsClientView.tsx`, `logs/OperationsOperatorView.tsx`: Sub-view header summary cards.
  - `logs/OperationsLogsTable.tsx`: High-density desktop table (`hidden sm:block`).
  - `logs/OperationsLogsMobileList.tsx`: Touch-friendly mobile card feed (`block sm:hidden`).
  - `assignments/OperationsAssignmentsTab.tsx`: 4 assignment KPI cards, filter chips, search input, expand/collapse toggles, and paginated roster cards.
  - `assignments/MachineAssignmentCard.tsx`: Machine accordion card with 3 shift slots, contact shortcuts, and unassign triggers.

---

## 12. Sub-Tab Isolated Data-Loading Architecture (Phase 3)
- **Architectural Mandate**:
  ```
  Daily Running Hours
         │
         ├── Machine
         ├── Client
         └── Operator
                │
                ▼
         Current query only
                │
                ▼
          Server pagination (10 logs)
                │
                ▼
             Database
  ```
- **Isolated Query Services (`apps/web/lib/data/operations/`)**:
  - `operations-machine-logs.ts` (`view=machine`):
    - Fetches machine catalog via `getCachedOperationsMachines` (60s SWR).
    - Queries active machine specs, 10 paginated logs via `range(0, 9)`, and scalar counters via `get_operations_summary`.
    - **Zero queries** for CRM clients, staff operators, or location scans.
  - `operations-client-logs.ts` (`view=client`):
    - Fetches CRM client directory via `getCachedOperationsClients` (60s SWR).
    - Queries active client specs, client-rented machines (`WHERE client_id = activeClientId`), distinct client sites, 10 paginated logs, and scalar counters via `get_operations_summary`.
    - **Zero queries** for unrelated fleet machines or staff operators.
  - `operations-operator-logs.ts` (`view=operator`):
    - Fetches operator directory via `getCachedOperationsOperators` (60s SWR).
    - Queries active operator specs, 10 paginated logs, and scalar counters via `get_operations_summary`.
    - **Zero queries** for fleet machines or CRM clients.
  - `tab=assignments`:
    - Queries **0 daily running logs** (completely eliminated legacy 500-log query).
- **PostgreSQL Database Acceleration (Migration 069)**:
  - `idx_mhl_location_trgm`: GIN trigram index on `machine_hour_logs USING gin (location gin_trgm_ops)` for sub-millisecond location text search.
  - `idx_mhl_remarks_trgm`: GIN trigram index on `machine_hour_logs USING gin (remarks gin_trgm_ops)` for sub-millisecond remarks text search.
  - `idx_mhl_client_location`: Partial B-tree index on `machine_hour_logs (client_id, location) WHERE location IS NOT NULL AND location <> ''` for instant client site resolution.
  - `get_operations_summary` RPC: Sub-millisecond scalar summary counter RPC calculating `{ total_run_hours, total_ot_hours, total_breakdowns, logged_days_count }`.
- **Live Database Performance Benchmarks**:
  - Machine sub-tab: 0 clients, 0 operators queried. Sub-millisecond RPC.
  - Client sub-tab: 136.67 ms DB time. 0 unrelated machines, 0 operators queried.
  - Operator sub-tab: 82.58 ms DB time. 0 machines, 0 clients queried.

---

## 13. Machine Sub-Tab Precision Data-Loading Optimization (Phase 4)
- **Architectural Scope**:
  ```
  Logs
   └── Machine
  Initial load: Strictly the 20 machine log rows needed for the active page. Zero unbounded fetches.
  ```
- **Key Capabilities & Delivery**:
  1. **Server Pagination**:
     - Standardized default page size to 20 records (`pageSize: 20`).
     - Uses PostgREST exact range slice (`.range(fromIndex, toIndex, { count: "exact" })`).
  2. **Server Sorting**:
     - Database-level ordering for `date-desc`, `date-asc`, `hours-desc`, `hours-asc`, `meter-desc`, `meter-asc`.
     - High-density table headers in `OperationsLogsTable.tsx` are interactive with `ChevronUp`/`ChevronDown` indicators.
  3. **Multi-Attribute Server Filtering**:
     - Filters by `machine_id`, `start_date` / `end_date`, `site` (`location.ilike.%site%`), `shift`, and `breakdownOnly` (`is_breakdown.eq.true`).
  4. **Sub-Millisecond Trigram Search**:
     - Evaluates search queries against GIN trigram indexes on `location` and `remarks`, alongside active operator lookup.
  5. **Exact Columns Projection (`MACHINE_LOG_EXACT_PROJECTION`)**:
     - Replaced `SELECT *` with 20 exact columns on `machine_hour_logs`.
  6. **Zero Redundant Joins in SQL**:
     - Eliminated `machines` join in SQL query since all rows belong to `activeMachineId`.
     - Hydrates `activeMachine` in JavaScript from cached fleet catalog in memory.
  7. **Query Caching & Deduplication**:
     - Cached with Next.js `unstable_cache` (30s TTL, tags `operationsLogs`, `operations`, `machineOperations(machineId)`).
     - Wrapped in React `cache()` for in-flight request deduplication.
  8. **Lazy Detail Modal (`OperationsLogDetailModal.tsx`)**:
     - Dynamically code-split via `next/dynamic` (`ssr: false`).
     - Presents machine specs, HMR meter gauge, breakdown timeline, and conflict analysis on-demand.
  9. **Lazy History Modal (`MachineHistoryQuickModal.tsx`)**:
     - Dynamically code-split and triggered from "View History" in `OperationsMachineView`.
     - Client session cache provides instant 0ms response on second click.
- **Live Database Benchmarks**:
  - Cold page 1 load (20 records): **201.45 ms**.
  - Server sorting (`hours-desc`): **92.34 ms**.
  - Server sorting (`meter-desc`): **90.53 ms**.
  - Trigram search: **82.29 ms**.

---

## 14. Client Sub-Tab Precision Data-Loading Optimization (Phase 5)
- **Architectural Scope**:
  ```
  Initial /operations load (view=machine)
          ↓
  Machine tab data loaded
          ↓
  Machine tab data remains cached in client memory
          ↓
  User clicks "Clients"
          ↓
  Client query executed on-demand (only then load client-oriented data)
          ↓
  Do not refetch: machines, operators, permissions unless required
  ```
- **Key Capabilities & Delivery**:
  1. **Initial Load Machine Default**:
     - Route default in `app/(app)/operations/page.tsx` and `lib/queries/operators.ts` defaults to `view=machine`. Zero client log rows and zero client queries are executed on initial load.
  2. **Client-Side In-Memory Session Caching (`subTabCacheRef`)**:
     - Preserves `machine`, `client`, and `operator` datasets in client session memory.
     - Subsequent toggles between "Machine" and "Clients" sub-tabs execute with **0ms latency**, zero network requests, and zero refetching of machines, operators, or permissions.
  3. **On-Demand Client Query (`getOperationsClientLogsAction`)**:
     - Triggered strictly when user clicks "Clients" or modifies client filters.
     - Scoped strictly to `activeClientId`: only queries client-rented machines, client distinct sites, and 20 paginated client logs.
  4. **Zero Redundant SQL Joins**:
     - Redundant SQL table join `client:clients(...)` completely removed from SQL query since `WHERE client_id = activeClientId`.
     - `activeClient` hydrated in JavaScript memory from cached CRM client catalog.
  5. **Server Pagination & Sorting**:
     - Default `pageSize = 20` records with PostgREST `.range(fromIndex, toIndex, { count: "exact" })`.
     - Server-level ordering on `date-desc`, `date-asc`, `hours-desc`, `hours-asc`, `meter-desc`, `meter-asc`.
  6. **Server Filtering & Search**:
     - Supports `activeClientId`, `machineId` (scoped to client-rented machines), `site` location, and month / custom date range.
     - Sub-millisecond text search leveraging PostgreSQL GIN trigram indexes on `location` and `remarks`.
  7. **Query Caching & Deduplication**:
     - Next.js `unstable_cache` with 30s TTL, tagged with `TAGS.operationsLogs`, `TAGS.operations`, `TAGS.clientOperations(activeClientId)`.
     - Wrapped with React `cache()` for in-flight request deduplication.
  8. **Silent URL Synchronization**:
     - Filter updates and sub-tab switches synchronize the browser address bar via `window.history.replaceState`, preserving bookmarkable URLs without triggering full Next.js page re-renders or server permission re-evaluations.
- **Live Database Benchmarks (`dhbbgfzbyatzvqafnsqp`)**:
  - Cold client sub-tab load (20 records): **168.40 ms** (Target: < 500 ms) — PASS.
  - Server sorting (`hours-desc`): **61.95 ms** (Target: < 200 ms) — PASS.
  - Server sorting (`meter-desc`): **74.10 ms** (Target: < 200 ms) — PASS.
  - Server pagination (Page 2, offset 20-39): **61.84 ms** (Target: < 200 ms) — PASS.
  - Sub-tab switching from cache (2nd click): **0 ms** (Instant, 0 network requests) — PASS.
  - SQL client join overhead: **0 ms (Eliminated)** — PASS.
  - Unrelated fleet machines queried: **0** — PASS.
  - Operators queried on client sub-tab: **0** — PASS.
  - Permissions re-evaluated on sub-tab switch: **0** — PASS.




