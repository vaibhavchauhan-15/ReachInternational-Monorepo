# Comprehensive Route Performance Audit (Phase 2)

> **SCOPE**: Empirical audit of all primary application routes across `apps/web`: `/login`, `/signup`, `/forgot-password`, `/machines`, `/users`, `/clients`, and all 4 operations states (`/operations?tab=logs`, `assignments`, `entry`, `history`).

---

## Layout Layer Audit

### Root Layout (`apps/web/app/layout.tsx`)
- **Type**: Server Component Shell (RSC)
- **Authentication**: None (Evaluated in Edge Proxy `proxy.ts`)
- **Database Calls**: 0 (No database queries)
- **Initial Data**: Google Font variables (`Geist`, `Geist Mono`), theme initialization script, and `<link rel="preconnect">` for Supabase backend.
- **Client Providers**: `ThemeProvider`, `ToastProvider`, `TooltipProvider`, `AgentationWrapper`, `CookieConsent`.
- **Performance Evaluation**: 🟢 **Efficient (Score: A)**. Zero layout-level data fetching waterfalls; cleanly sets up CSS variables and universal UI contexts.

### Authenticated App Layout (`apps/web/app/(app)/layout.tsx`)
- **Type**: Server Component Shell (RSC)
- **Authentication**: `verifySession()` and `getCurrentUser()` via `lib/dal.ts`.
- **Database Calls**: 1 (`public.users` profile lookup via `getCachedUserRow(userId)`).
- **Deduplication**: Wrapped in React `cache()` under key `dal-user-row-v6`. All subsequent child Server Components calling `getCurrentUser()` reuse this in-memory user instance with **0 extra database queries**.
- **Redirects**: Redirects invalid sessions or inactive/pending accounts to `/login` with descriptive error query parameters (`?error=account_pending`).
- **Performance Evaluation**: 🟢 **Efficient (Score: A)**. Fully cached single session fetch per HTTP request.

---

## Route 01 — `/login`

### 1. Route Type
- **Static / Dynamic**: Dynamic (Reads search parameters `error`, `message` inside Suspense)
- **Server / Client Boundary**: RSC Page Shell (`page.tsx`) + Interactive Client Form Leaf (`login-form.tsx` under `<Suspense>`)
- **Authentication**: Public (Unauthenticated). Authenticated users visiting `/login` without error parameters are redirected to `/machines` by Edge Proxy (`proxy.ts`) in ~3ms.
- **Roles**: All (Public / Anonymous)

### 2. Initial Data
- Static Hero UI typography and feature badges
- Search parameters: `error` (e.g. `account_pending`, `account_inactive`), `message`

### 3. Requests
- Initial Document: 1 HTML Document (`30.9 KB`)
- Static Assets: 15 JavaScript chunks (`1.41 MB` uncompressed, largest chunk `35aimukz77phg.js` 394.58 KB)

### 4. Database
- **Initial Load Queries**: **0** (Zero database queries executed before login)
- **Tables Accessed on Initial Load**: None
- **Rows Returned**: 0 rows
- **Columns Projected**: None

### 5. Components
- `LoginPage` (RSC)
- `LoginFormClient` (`'use client'` leaf form wrapped in `<Suspense>`)
- `ReachInternationalLogo`, `Input`, `Button`, `AnimatedIcons`

### 6. Mutations
- `login(state, formData)` Server Action (`apps/web/app/actions/auth.ts`)
  - Authenticates credentials against Supabase Auth (`auth.signInWithPassword`)
  - Verifies user role and account status in `public.users`
  - Logs security audit event (`logAudit`)
  - Redirects to `/machines` (Management/Staff) or `/operations?tab=entry` (Operators)

### 7. Cache
- **Cached**: Static layout shell cached by Next.js compiler
- **Revalidation**: None needed

### 8. Performance Problems
- 🟡 **P2 (Large Vendor Bundle)**: Initial uncompressed JS transfer is 1.41 MB across 15 chunks (Base UI, Framer Motion, Radix primitives).
- 🟢 **P3 (No Data Over-fetching)**: Clean architecture. Zero pre-auth DB calls.

### 9. Optimization Target
- **Initial Requests**: 1 Document + 10 JS/CSS Chunks
- **Initial Rows**: 0
- **Initial Payload**: < 400 KB compressed JS
- **Route Score**: 🟢 **A-**

---

## Route 02 — `/signup`

### 1. Route Type
- **Static / Dynamic**: Dynamic Client View (`page.tsx`)
- **Server / Client Boundary**: Single `'use client'` Page Component
- **Authentication**: Public (Unauthenticated)
- **Roles**: Public self-registration

### 2. Initial Data
- Static role configuration array (`signupRoleOptions` with 13 selectable enterprise roles)
- Form state values: `full_name`, `email`, `phone`, `role`, `city`, `district`, `state`, `password`, `confirm_password`

### 3. Requests
- Initial Document: 1 HTML Document (`39.7 KB`)
- Static Assets: 15 JavaScript chunks (`1.43 MB` uncompressed)

### 4. Database
- **Initial Load Queries**: **0** (Zero database queries executed before registration)
- **Tables Accessed on Initial Load**: None
- **Rows Returned**: 0 rows
- **Columns Projected**: None

### 5. Components
- `SignupPage` (`'use client'`)
- `SearchableSelect`, `Input`, `Button`, `AnimatedIcons`, `ReachInternationalLogo`

### 6. Mutations
- `signup(state, formData)` Server Action (`apps/web/app/actions/auth.ts`)
  - Validates input with Zod (`SignupSchema` with mandatory city, district, state)
  - Registers user in Supabase Auth (`supabase.auth.signUp`)
  - Database trigger `handle_new_user()` provisions `public.users` row with `status = 'pending'`
  - Dispatches welcome email notification to user

### 7. Cache
- **Cached**: Static assets cached on CDN/browser
- **Revalidation**: None

### 8. Performance Problems
- 🟡 **P2 (Entire Page is `'use client'`)**: `apps/web/app/signup/page.tsx` declares `'use client'` at root line 1 rather than separating the static hero panel into an RSC wrapper.
- 🟢 **P3**: Zero database round-trips on initial load.

### 9. Optimization Target
- **Initial Requests**: 1 Document + 10 Chunks
- **Initial Rows**: 0
- **Initial Payload**: < 400 KB compressed JS
- **Route Score**: 🟢 **A-**

---

## Route 03 — `/forgot-password`

### 1. Route Type
- **Static / Dynamic**: Dynamic Client View (`page.tsx`)
- **Server / Client Boundary**: Single `'use client'` Page Component
- **Authentication**: Public
- **Roles**: Public

### 2. Initial Data
- Form state: `email`

### 3. Requests
- Initial Document: 1 HTML Document (`28.4 KB`)
- Static Assets: 14 JavaScript chunks (`1.38 MB` uncompressed)

### 4. Database
- **Initial Load Queries**: **0**
- **Tables Accessed on Initial Load**: None
- **Rows Returned**: 0 rows

### 5. Components
- `ForgotPasswordPage` (`'use client'`)
- `Input`, `Button`, `AnimatedIcons`

### 6. Mutations
- `forgotPassword(state, formData)` Server Action (`apps/web/app/actions/auth.ts`)
  - Calls `supabase.auth.resetPasswordForEmail()`
  - Logs audit entry

### 7. Cache
- Static CDN caching

### 8. Performance Problems
- 🟢 **P3 (Minor)**: Full-page `'use client'` wrapper for a single email input form.

### 9. Optimization Target
- **Initial Requests**: 1 Document + 8 Chunks
- **Initial Rows**: 0
- **Route Score**: 🟢 **A**

---

## Route 04 — `/machines`

### 1. Route Type
- **Static / Dynamic**: Dynamic Server-Rendered Component with Suspense (`force-dynamic` via `searchParams`)
- **Server / Client Boundary**: RSC Page (`page.tsx`) + Interactive Client Directory Hub (`MachineListClient.tsx`)
- **Authentication**: Required (`protectOperatorRoute` redirects operators to `/operations?tab=entry`)
- **Roles**: `super_admin`, `admin`, `service_manager`, `supervisor`, `mechanic`, `service_engineer`

### 2. Initial Data
- Paginated fleet machine array (25 records per page)
- Fleet total count and total pages calculation
- Active supervisors lookup list
- Active operators lookup list
- Active machine complaints list
- Engineer service records dataset

### 3. Requests
- Initial Document: 1 HTML Document (`44.2 KB` server-rendered HTML)
- Subresource Assets: 18 JS chunks (`1.52 MB` uncompressed)

### 4. Database
- **Initial Load Queries**: **5 parallel database queries**:
  1. `getMachines({ search, status, page: 1, pageSize: 25 })` ──► `public.machines` (with joins on `users` for operator and supervisor)
  2. `getActiveSupervisors()` ──► `public.users` (cached via `unstable_cache` under tag `machinesMeta`)
  3. `getActiveOperators()` ──► `public.users` (cached via `unstable_cache` under tag `machinesMeta`)
  4. `getMachineComplaints()` ──► `public.machine_complaints`
  5. `getEngineerServicesData()` ──► `public.service_records`
- **Tables Accessed**: `machines`, `users`, `machine_complaints`, `service_records`, `employees`
- **Rows Returned**: ~35 rows total across all 5 queries
- **Columns Projected**: Explicit 16 columns for `machines`; wildcard in fallback queries

### 5. Components
- `MachinesPage` (RSC) & `MachinesContent` (RSC)
- `MachinesSkeleton` (Fallback UI)
- `MachineListClient` (`'use client'` - 39.6 KB)
  - `EnterpriseTable` (High-density fleet table)
  - `AddMachineModal` (Create machine dialog)
  - `EditMachineModal` (Update machine dialog)
  - `DeleteMachineModal` (Delete machine dialog)

### 6. Mutations
- `createMachine(formData)` ──► `apps/web/app/actions/machines.ts`
- `updateMachine(machineId, formData)` ──► `apps/web/app/actions/machines.ts`
- `deleteMachine(machineId)` ──► `apps/web/app/actions/machines.ts`
- `reassignMachineSupervisor(machineId, supervisorId)` ──► `apps/web/app/actions/machines.ts`

### 7. Cache
- **Cached**: `getActiveSupervisors` and `getActiveOperators` cached via `unstable_cache` (TTL 300s, tag: `machinesMeta`)
- **Revalidation**: Server actions call `revalidateTag("machines")` and `revalidateTag("machinesMeta")`

### 8. Performance Problems
- 🟠 **P1-001 (Cross-Tab Data Over-fetching)**: `page.tsx:L44-L45` fetches `getMachineComplaints()` and `getEngineerServicesData()` on EVERY load of `/machines`, even when viewing the primary "inventory" tab.
- 🟠 **P1-002 (`router.refresh()` on Mutations)**: `MachineListClient.tsx` invokes `router.refresh()` at lines 529, 838, 1075, 1087, forcing a full RSC tree re-fetch.
- 🟡 **P2 (Modals Statically Bundled)**: `AddMachineModal` and `EditMachineModal` are synchronously imported inside `MachineListClient.tsx`.

### 9. Optimization Target
- **Initial Requests**: 1 Page RSC request (parallelizing only active tab queries)
- **Initial Rows**: Max 25 machine rows + cached supervisor/operator lists
- **Initial DB Queries**: Reduce from 5 queries to **3 queries** on default tab
- **Route Score**: 🟡 **B+**

---

## Route 05 — `/users`

### 1. Route Type
- **Static / Dynamic**: Dynamic Server-Rendered Component (`export const dynamic = "force-dynamic"`)
- **Server / Client Boundary**: RSC Page (`page.tsx`) + Interactive Client Directory Hub (`users-client.tsx`)
- **Authentication**: Required (`requireRole("admin", "super_admin", "service_manager", "hr_manager")`)
- **Roles**: Management / HR Only

### 2. Initial Data
- All user directory profiles (`allUsers`)
- Pending approval user profiles (`pendingUsers`)
- Current authenticated user context

### 3. Requests
- Initial Document: 1 HTML Document (`41.8 KB`)
- Static Assets: 16 JS chunks (`1.46 MB` uncompressed)

### 4. Database
- **Initial Load Queries**: **2 parallel database queries**:
  1. `getAllUsers()` ──► `public.users` (`SELECT id, full_name, email, phone, role, status, city, district, state, created_at ORDER BY created_at DESC`)
  2. `getPendingUsers()` ──► `public.users` (`SELECT ... WHERE status = 'pending' ORDER BY created_at DESC`)
- **Tables Accessed**: `public.users`
- **Rows Returned**: 28 rows (Current DB user count)
- **Columns Projected**: Explicit 10 columns (`id, full_name, email, phone, role, status, city, district, state, created_at`)

### 5. Components
- `UsersPage` (RSC) & `UsersPageContent` (RSC)
- `UsersSkeleton` (Fallback UI)
- `UsersPageClient` (`'use client'` - 32.9 KB)
  - Pending Approvals Alert Banner
  - Metric summary cards (Total, Active, Pending, Inactive)
  - User table with role badges and status toggle switches
  - `UserCreateModal`, `UserEditModal`, `UserDetailModal`, `PasswordResetModal`

### 6. Mutations
- `createUser(state, formData)` ──► `apps/web/app/actions/users.ts`
- `approveUser(userId)` ──► `apps/web/app/actions/users.ts`
- `rejectUser(userId, reason)` ──► `apps/web/app/actions/users.ts`
- `toggleUserStatus(userId, currentStatus)` ──► `apps/web/app/actions/users.ts`
- `updateUserRole(userId, newRole)` ──► `apps/web/app/actions/users.ts`
- `resetUserPassword(userId, newPassword)` ──► `apps/web/app/actions/users.ts`

### 7. Cache
- **Cached**: User session deduplicated via React `cache()`
- **Revalidation**: Mutations trigger `revalidateTag("users")` and `revalidatePath("/users")`

### 8. Performance Problems
- 🟠 **P1-001 (Redundant Parallel Query)**: `getAllUsers()` already fetches all users including those with `status = 'pending'`. Running `getPendingUsers()` as a second query is 100% redundant; pending users can be derived via `allUsers.filter(u => u.status === "pending")`.
- 🟠 **P1-002 (Unbounded User Query)**: `getAllUsers()` has no `.limit()` or pagination. If the company scales to 5,000 operators, all 5,000 are downloaded to the browser at once.
- 🟠 **P1-003 (`router.refresh()` Multiplication)**: `users-client.tsx` has **8 separate `router.refresh()` calls** on quick action buttons.

### 9. Optimization Target
- **Initial Requests**: 1 Single Database Query (Eliminate `getPendingUsers()`)
- **Initial Rows**: Paginated (max 50 users) or in-memory sliced
- **Initial DB Queries**: **1 query** (Down from 2)
- **Route Score**: 🟡 **B**

---

## Route 06 — `/clients`

### 1. Route Type
- **Static / Dynamic**: Dynamic Server-Rendered Component
- **Server / Client Boundary**: RSC Page (`page.tsx`) + Interactive Client Directory (`ClientsClient.tsx`)
- **Authentication**: Required (`requireRole("super_admin", "admin", "service_manager", "rental_manager", "sales_executive")`)
- **Roles**: Sales / Management

### 2. Initial Data
- CRM Client organization profiles (`clients`)

### 3. Requests
- Initial Document: 1 HTML Document (`36.5 KB`)
- Static Assets: 16 JS chunks (`1.45 MB` uncompressed)

### 4. Database
- **Initial Load Queries**: **1 cached query**:
  - `getClients()` ──► `public.clients` (`SELECT id, code, client_name, company_name, contact_person, email, phone, gstin, address, city, state, pincode, notes, status, deleted_at, created_at, updated_at WHERE deleted_at IS NULL ORDER BY client_name ASC`)
- **Tables Accessed**: `public.clients`
- **Rows Returned**: 1 row (Current DB client count)
- **Columns Projected**: Explicit 17 columns

### 5. Components
- `ClientsPage` (RSC)
- `ClientsClient` (`'use client'` - 24.2 KB)
  - `CreateClientModal`, `EditClientModal`

### 6. Mutations
- `createClientAction(state, formData)` ──► `apps/web/app/actions/clients.ts`
- `updateClientAction(state, formData)` ──► `apps/web/app/actions/clients.ts`
- `softDeleteClientAction(clientId)` ──► `apps/web/app/actions/clients.ts`

### 7. Cache
- **Cached**: Wrapped in `unstable_cache` (`TAGS.clients`, TTL 300s)
- **Revalidation**: `revalidateTag("clients")`

### 8. Performance Problems
- 🟢 **P3 (Healthy Architecture)**: Uses explicit projections, server-side caching (`unstable_cache`), and soft delete filtering.
- 🟡 **P2**: Modals statically imported into client tree.

### 9. Optimization Target
- **Initial Requests**: 1 Cached Database Query
- **Initial Rows**: 1 – 50 rows
- **Route Score**: 🟢 **A**

---

## Route 07 — `/operations?tab=logs` (Supervisor / Manager View)

### 1. Route Type
- **Static / Dynamic**: Dynamic Server-Rendered Component (`apps/web/app/(app)/operations/page.tsx`)
- **Server / Client Boundary**: RSC Page (`page.tsx`) + Heavy Client Hub (`OperationsClient.tsx`)
- **Authentication**: Required (`requirePermission("machine.view")`)
- **Roles**: `super_admin`, `admin`, `service_manager`, `supervisor`

### 2. Initial Data
- 🔴 **Loaded unconditionally on initial render**:
  1. Complete fleet machines list (`machinesRes`)
  2. Complete CRM clients list (`dbClients`)
  3. All operational users (`operators`)
  4. All machine assignments with 4-table joins (`assignments`)
  5. **500 historical machine hour logs** with 4-table joins (`hourLogs`)
  6. **100 site movements** with machine and operator joins (`siteMovements`)
  7. **100 operator payouts** with operator joins (`operatorPayouts`)
  8. Assigned machine lookup (`assignedMachineRes`)
  9. Recent operator logs query (`recentOperatorLogsRes`)
  10. Active machines query with `limit(100)` (`activeMachinesRes`)

### 3. Requests
- Initial Document: 1 HTML Document (`68.4 KB` server-rendered HTML)
- Static Assets: 20 JS chunks (`1.68 MB` uncompressed)

### 4. Database
- **Initial Load Queries**: 🔴 **10 parallel database queries executed on every page load**:
  - `getMachines()` (DAL query to `machines`)
  - `getClients()` (DAL query to `clients`)
  - `supabase.from("users").select("*").in("role", ...)` (Direct DB query)
  - `supabase.from("machine_assignments").select("*, machine:machines(*), ...")` (Direct DB query)
  - `supabase.from("machine_hour_logs").select("*, machine:machines(*), client:clients(*), operator:users!operator_id(...), supervisor:users!supervisor_id(...)").limit(500)` (Direct DB query)
  - `supabase.from("machine_site_movements").select("*, machine:machines(*), ...").limit(100)` (Direct DB query)
  - `supabase.from("operator_payouts").select("*, operator:users!operator_id(...)").limit(100)` (Direct DB query)
  - `supabase.from("machines").select("*").eq("current_operator_id", user.id)` (Direct DB query)
  - `operatorLogsQuery` on `machine_hour_logs` (Direct DB query)
  - `supabase.from("machines").select("*").order("created_at", ...).limit(100)` (Direct DB query)
- **Tables Accessed**: `machines`, `clients`, `users`, `machine_assignments`, `machine_hour_logs`, `machine_site_movements`, `operator_payouts`
- **Rows Returned**: **~850 rows** across 10 queries
- **Columns Projected**: 🔴 Multiple wildcard `select("*")` calls on large join tables

### 5. Components
- `OperationsPage` (RSC)
- `OperationsClient` (`'use client'` - **100.8 KB**)
- `PrintableSupervisorLogsModal` (`'use client'` - **40.9 KB**, statically imported)
- `supervisor-logs-export.ts` (Includes SheetJS `xlsx` in client runtime)

### 6. Mutations
- `assignOperatorToMachineAction` ──► `apps/web/app/actions/operators.ts`
- `unassignOperatorFromMachineAction` ──► `apps/web/app/actions/operators.ts`

### 7. Cache
- **Cached**: None (Dynamic page queries bypass DAL caching)
- **Revalidation**: Client calls `router.refresh()` at 5 different locations

### 8. Performance Problems
- 🔴 **P0-001 (Critical Direct DB Bypass & Over-fetching)**: 8 direct inline Supabase queries bypass DAL in `operations/page.tsx`, loading 500 hour logs, 100 site movements, 100 payouts, and all assignments for tab `logs`.
- 🔴 **P0-002 (Duplicate Fleet Queries)**: `getMachines()` is called at line 50, and `supabase.from("machines").select("*").limit(100)` is called AGAIN at line 77.
- 🔴 **P0-003 (Heavy Synchronous Print Bundling)**: `PrintableSupervisorLogsModal` (40.9 KB) and `xlsx` SheetJS are bundled into the initial client bundle.
- 🟠 **P1-001 (5 `router.refresh()` Triggers)**: Forces all 10 queries to re-execute whenever an assignment is changed.

### 9. Optimization Target
- **Initial Requests**: 1 Consolidated DAL Query (`getSupervisorLogsHubData`)
- **Initial Rows**: Paginated 50 hour logs + filter lookups (Max ~100 rows total)
- **Initial DB Queries**: Reduce from 10 queries to **2 queries**
- **Route Score**: 🔴 **D**

---

## Route 08 — `/operations?tab=assignments`

### 1. Route Type
- **Static / Dynamic**: Dynamic Server-Rendered View
- **Server / Client Boundary**: RSC Page (`page.tsx`) + Sub-view in `OperationsClient.tsx`
- **Authentication**: Required (`requirePermission("machine.view")`)
- **Roles**: `super_admin`, `admin`, `service_manager`, `supervisor`

### 2. Initial Data
- Same 10 parallel queries as `tab=logs` (Fetches 500 hour logs, 100 site movements, 100 payouts even though the user is ONLY viewing assignments)

### 3. Requests / Database
- **Initial Load Queries**: **10 parallel queries** (Same monolithic loader in `page.tsx`)
- **Rows Returned**: ~850 rows

### 4. Components
- `OperationsClient.tsx` (Assignments sub-view)
- Assignment Modal

### 5. Performance Problems
- 🔴 **P0-001 (Massive Cross-Tab Over-fetching)**: User requested only machine assignments, but the server downloaded 500 historical hour logs and 100 operator payouts.
- 🟠 **P1-002**: Direct inline database queries with `select("*")`.

### 6. Optimization Target
- **Initial Requests**: Tab-specific DAL function (`getMachineAssignmentsHubData`)
- **Initial DB Queries**: **2 queries** (Active assignments + unassigned operators)
- **Initial Rows**: ~30 rows
- **Route Score**: 🔴 **D**

---

## Route 09 — `/operations?tab=entry` (Operator Daily Meter Log Entry)

### 1. Route Type
- **Static / Dynamic**: Dynamic Server-Rendered View
- **Server / Client Boundary**: RSC Page (`page.tsx`) + `OperatorDashboard.tsx` (`'use client'`)
- **Authentication**: Required (`role === "operator"` or supervisor)
- **Roles**: `operator`, `supervisor`

### 2. Initial Data
- Same 10 parallel queries as `tab=logs`
- Operator assigned machine: `supabase.from("machines").select("*").eq("current_operator_id", user.id)`
- Operator's recent logs

### 3. Requests / Database
- **Initial Load Queries**: **10 parallel queries** (Executes full management queries for hour logs, payouts, and movements even for an operator opening the simple meter entry form!)
- **Rows Returned**: ~850 rows

### 4. Components
- `OperatorDashboard.tsx` (`'use client'` - **98.4 KB**)
  - Section A: Model, Serial Number & Client confirmation
  - Section B: Shift Start/End times, HMR meter calculations
  - Section C: Maintenance & Breakdown checklist
  - `PrintableOperatorLogsModal.tsx` (**23.4 KB**, statically imported)

### 5. Mutations
- `submitOperatorHourLogAction(input)` ──► `apps/web/app/actions/operators.ts`
  - Validates with `CreateHourLogSchema`
  - Acquires SHA-256 idempotency lock in `public.idempotency_keys`
  - Inserts log in `public.machine_hour_logs`
  - Updates machine `hour_meter` in `public.machines`
  - Records audit entry and invalidates `TAGS.hourLogs`

### 6. Performance Problems
- 🔴 **P0-001 (Massive Operator Overhead)**: Operators on mobile devices download 10 management database queries and a 120 KB client component tree just to log 2 numbers (Start HMR & End HMR).
- 🔴 **P0-002 (Synchronous PDF Modal in Operator Bundle)**: `PrintableOperatorLogsModal.tsx` bundled statically.

### 7. Optimization Target
- **Initial Requests**: Single operator-targeted query (`getOperatorEntryContext(operatorId)`)
- **Initial DB Queries**: **1 query** (Operator's active assigned machine + last logged meter reading)
- **Initial Rows**: **1 row** (Down from 850 rows!)
- **Route Score**: 🔴 **D**

---

## Route 10 — `/operations?tab=history` (Operator Log History)

### 1. Route Type
- **Static / Dynamic**: Dynamic Server-Rendered View
- **Server / Client Boundary**: RSC Page (`page.tsx`) + Sub-view in `OperatorDashboard.tsx`
- **Authentication**: Required
- **Roles**: `operator`, `supervisor`

### 2. Initial Data
- Same 10 parallel queries as `tab=logs`
- Operator's own hour logs (`operatorLogsQuery` with `operator_id = user.id`)

### 3. Requests / Database
- **Initial Load Queries**: **10 parallel queries**
- **Rows Returned**: ~850 rows

### 4. Components
- `OperatorDashboard.tsx` (History table sub-view)
- `PrintableOperatorLogsModal`

### 5. Performance Problems
- 🔴 **P0-001 (Monolithic Cross-Tab Over-fetching)**: Operator history only needs the operator's personal logs, but the page fetches all management tables.
- 🟠 **P1-002**: Unbounded history pagination.

### 6. Optimization Target
- **Initial Requests**: Single operator history query (`getOperatorLogHistory(operatorId, page, pageSize)`)
- **Initial DB Queries**: **1 query**
- **Initial Rows**: Paginated 25 logs
- **Route Score**: 🔴 **D**

---

## Final Route Audit Summary Table

| Route | DB Calls (Current) | DB Calls (Target) | Current Rows | Target Rows | Waterfall | N+1 Risk | Over-fetch | Route Score |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `/login` | 0 | 0 | 0 | 0 | None | None | None | 🟢 **A-** |
| `/signup` | 0 | 0 | 0 | 0 | None | None | None | 🟢 **A-** |
| `/forgot-password` | 0 | 0 | 0 | 0 | None | None | None | 🟢 **A** |
| `/machines` | 5 | 3 | ~35 | ~25 | Low | None | Cross-tab complaints | 🟡 **B+** |
| `/users` | 2 | 1 | 28 | 28 (paged) | Low | None | Duplicate pending query | 🟡 **B** |
| `/clients` | 1 | 1 | 1 | 1 | None | None | None (Cached) | 🟢 **A** |
| `/operations?tab=logs` | **10** | **2** | **~850** | **~50** | High | Low | 🔴 Critical (All 10 queries) | 🔴 **D** |
| `/operations?tab=assignments` | **10** | **2** | **~850** | **~30** | High | Low | 🔴 Critical (Fetches logs/payouts) | 🔴 **D** |
| `/operations?tab=entry` | **10** | **1** | **~850** | **1** | High | Low | 🔴 Critical (Loads mgmt data) | 🔴 **D** |
| `/operations?tab=history` | **10** | **1** | **~850** | **~25** | High | Low | 🔴 Critical (Loads mgmt data) | 🔴 **D** |

---

## Phase 2 Key Discoveries & Recommendations

1. **The Operations Monolith Bottleneck (`/operations`)**:
   - `apps/web/app/(app)/operations/page.tsx` is the single biggest performance bottleneck in the application.
   - It runs **10 parallel database queries** and downloads **~850 rows** on every render, regardless of which tab (`logs`, `assignments`, `entry`, `history`) is active.
   - **Phase 2 Solution**: Refactor `operations/page.tsx` into tab-routed sub-loaders or dynamic DAL resolvers so each tab only fetches its own required data (reducing database calls from 10 to 1-2, and reducing transferred rows from 850 to 1-50).

2. **Duplicate Query in `/users` (`page.tsx`)**:
   - Running `getPendingUsers()` alongside `getAllUsers()` is redundant. Deriving pending users in-memory saves 1 database round-trip on every user directory load.

3. **Dynamic Import of Heavy Print Modals**:
   - Lazy loading `PrintableSupervisorLogsModal` (40.9 KB) and `PrintableOperatorLogsModal` (23.4 KB) via `next/dynamic` will immediately shave over **64 KB** of uncompressed JS from the `/operations` client bundle.
