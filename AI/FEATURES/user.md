# Feature Module — User Management & RBAC

## Overview
Manages user accounts, profile details, company branch assignments, and Role-Based Access Control (RBAC) role assignments across 13 system roles.

## File Map
- **Page**: `app/(app)/users/page.tsx`
- **Client Hub**: `app/(app)/users/users-client.tsx`
- **Sections**: `app/(app)/users/ProfileChangeRequestsSection.tsx` (Profile detail changes review & batch approval)
- **Row & Detail Sheet**: `app/(app)/users/UserRow.tsx`, `UserDetailSheet.tsx`
- **Modals**: `app/(app)/users/UserCreateModal.tsx`, `UserEditModal.tsx`, `components/profile/EditProfileModal.tsx`
- **Mobile**: `apps/mobile/app/(app)/profile.tsx`, `apps/mobile/app/(app)/users.tsx`, `apps/mobile/components/profile/EditProfileModal.tsx`
- **RBAC Matrix & Scopes**: `lib/auth/rbac.ts`, `lib/auth/scope.ts`, `@reachinternational/permissions`
- **Actions**: `app/actions/users.ts`, `app/actions/profile.ts`, `app/actions/auth.ts`
- **DAL & Queries**: `lib/dal.ts`, `lib/queries/users.ts`
- **Database Migrations**: `supabase/migrations/017_comprehensive_13_roles_rbac.sql` ... `042_add_shift_address_and_profile_change_requests.sql`

## Supported Canonical System Roles (11 Roles)
1. `super_admin` — Super Admin (Unrestricted global platform & multi-branch authority; full access across all modules; immutable audit log view & export)
2. `admin` — System Administrator (User onboarding & machine master administration)
3. `manager` — Manager (Consolidated operational management across fleet, contracts, inventory, CRM, and reports)
4. `service_manager` — Service Manager (Service planning, breakdown dispatch & FSR approval)
5. `service_engineer` (alias `engineer`) — Service Engineer (Field service & breakdown repairs)
6. `supervisor` — Supervisor (Field supervision, complaint logging & log verification; scoped read-only access to `/users` for assigned operators, mechanics, and service engineers)
7. `mechanic` — Mechanic (Workshop repairs & parts request)
8. `operator` — Operator (Machine operation & daily meter log entry)
9. `store_manager` — Store Manager (Inventory stock ledger, receiving & transfers)
10. `hr_manager` — HR Manager (Employee directory, onboarding & protected salary)

## Supervisor Scoped Read-Only Access (`/users`) (Migration 061)
- **Canonical Scopes (`@reachinternational/permissions`)**:
  - `SUPERVISOR_VISIBLE_USER_ROLES = ["operator", "mechanic", "service_engineer", "engineer"]`.
  - Added permissions: `user.activate`, `user.assign_supervisor`, `user.bulk_manage`. Supervisor granted `user.view` (scoped).
  - Utility helpers: `getUserDataScope(role)`, `canViewUsers(role)`, `canCreateUser(role)`, `canUpdateUser(role)`, `canDeleteUser(role)`, `canActivateUser(role)`, `canAssignSupervisor(role)`, `canBulkMutateUsers(role)`.
- **Database RLS Boundary (`061_supervisor_scoped_users_rls.sql`)**:
  - Drops permissive `users_select_authenticated` (`USING (true)`).
  - `users_select_management`: Full SELECT for `super_admin`, `admin`, `manager`, `service_manager`, `hr_manager`, `store_manager`.
  - `users_select_self`: Allows every authenticated user to read their own record (`id = auth.uid()`).
  - `users_select_supervisor_scoped`: Allows supervisors to SELECT only users where `role IN ('operator', 'mechanic', 'service_engineer', 'engineer')` AND (`supervisor_id = auth.uid() OR supervisor_ids @> ARRAY[auth.uid()]`).
  - Composite indexes: `idx_users_role_supervisor_id` on `(role, supervisor_id)`, `idx_users_supervisor_id` on `(supervisor_id)`, `idx_users_supervisor_ids` GIN on `(supervisor_ids)`.
- **DAL Layer Scoping (`apps/web/lib/queries/users.ts`)**:
  - `getUserList()`: Allows `supervisor` role. Injects dual supervisor scope predicate `.or(\`supervisor_id.eq.${currentUser.id},supervisor_ids.cs.{${currentUser.id}}\`)` and clamps `role` filter to `SUPERVISOR_VISIBLE_USER_ROLES` to block URL parameter bypasses (`?role=admin`).
  - Executes via `createSupabaseServerClient()` for supervisor defense-in-depth with JWT RLS enforcement, with fallback and adminClient hydration for secondary relational lookups (working locations, supervisor names).
  - `getSupervisorUserListAggregatesCached(supervisorId)`: Computes scoped KPI metrics (total assigned, active, engineers) cached under `TAGS.users` with supervisor-specific cache tags to eliminate cross-user cache pollution.
  - Data leakage prevention: Supervisor bypasses `getPendingUsersCached`, `getPendingProfileChangeRequests`, and `getActiveSupervisorsCached`.
- **Read-Only UI & Experience (`apps/web/app/(app)/users/*`)**:
  - App Sidebar: Displays `/users` for `supervisor` role.
  - Server Page (`page.tsx`): Authorizes `supervisor`, derives `readOnly = !canCreateUser(role)`, provides scoped aggregates, skips pending approvals.
  - Client Hub (`users-client.tsx`): When `readOnly`, hides "+ Add User", hides pending registration/profile update metric cards, filters role dropdown to `SUPERVISOR_ROLE_OPTIONS`, suppresses selection checkboxes, and prevents bulk action bar rendering.
  - Row & Actions (`UserRow.tsx`): Returns `false` for `canManageUser`; the "More actions" 3-dot button is gated behind `canManageUser(user)` and therefore hidden entirely for supervisors (row click still opens `UserDetailSheet`). Allows supervisors to view contact info for assigned staff.
  - Detail Sheet (`UserDetailSheet.tsx`): Shows contact details for assigned personnel while keeping sensitive documents (Aadhaar, License) masked with unmasking restricted to admin/super_admin or self.
  - Audit Logging (`app/actions/users.ts`): `exportUsersFilteredAction` logs `USER_EXPORT` audit records with user ID, role, exported record count, and filters.
## High-Performance Search, Sort, Filter, Export & Skeleton Loading Architecture
- **Pattern-Aware DAL Query (`apps/web/lib/queries/users.ts`, `apps/mobile/app/(app)/users.tsx`)**:
  - `applyOptimizedUserSearch(query, search)`:
    - **1-Character Fast Prefix**: Executes `full_name.ilike.${char}%,email.ilike.${char}%,role.ilike.${char}%` hitting PostgreSQL B-tree indexes directly in <2ms, resolving instantly without table scans.
    - **Digits Detection**: Strips formatting (+91/0, spaces, dashes) and targets `phone`, `aadhaar_number`, `license_number`, avoiding unnecessary scans on role/location columns.
    - **Email Detection**: Targets `email` and `full_name` when input contains `@` or `.com`/`.in`.
    - **Role Normalization**: Automatically converts spaced entries ("super admin", "service engineer") to database slugs (`super_admin`, `service_engineer`) and handles plural suffixes.
    - **Multi-Token Composite Search**: Chains `.or()` across separate tokens so multi-term queries ("Kalicharan Gujarat") match across name, state, and role columns.
  - **Export Query Optimization**: Omits `{ count: "exact" }` when `pageSize > 100`, eliminating the secondary full-table count query on export requests.
  - **Relational Batch Protection**: For bulk exports, queries supervisors and working locations via indexed role/catalog lookups when ID count exceeds 50, preventing HTTP 414 URL overflow errors.
  - **Deterministic Secondary Sort**: Appends `.order("id", { ascending: true })` across all sort branches to prevent pagination drift.
- **Auto-Run Query & 300ms Snappy Debounce (`apps/web/app/(app)/users/users-client.tsx`, `apps/mobile/app/(app)/users.tsx`)**:
  - Automatically dispatches search query after a 300ms typing pause without requiring users to click any button or press enter.
  - Enter key triggers immediate execution; clearing input immediately resets the query.
  - Dropdown filter selections (role, status, state, kyc, dateRange, sort) apply immediately on selection.
  - `lastCommittedSearchRef` protects user typing from being overwritten by asynchronous URL parameter changes.
- **Instant Real-Time Skeleton Feedback (`FilterToolbar.tsx`, `users-client.tsx`, `apps/mobile/app/(app)/users.tsx`)**:
  - `isQueryLoading` is computed from `isPending || isSearchDebouncing` (`searchTerm !== currentSearch`).
  - As soon as the user enters or changes a single character, `<FilterToolbar />` displays an active spinning indicator and the data views immediately display `TableSkeletonRows` and `MobileCardSkeletonList` instead of stale data or loading text banners.
  - Synchronized on mobile with `showLoading = isLoading || isSearchingDebounce`.
- **Action & Component Lazy Loading (`apps/web/app/(app)/users/users-client.tsx`)**:
  - `exportUsersToExcel` and `exportUsersToCSV`: Dynamically imported via `await import("@/lib/utils/users-export")` on demand inside export handlers, removing ~1.2MB of `xlsx` from the initial client bundle.
  - `UserDetailSheet`: Dynamically imported with `next/dynamic` (`ssr: false`) and mounted strictly when `selectedSheetUser` is active (`{selectedSheetUser && <UserDetailSheet ... />}`).
  - `UserCreateModal` & `UserEditModal`: Dynamically imported and lazily mounted only when modal flags are open.
  - `ProfileChangeRequestsSection`: Dynamically imported with `next/dynamic` (`ssr: false`).
- **Context-Aware Empty States ("No users found") (`apps/web/app/(app)/users/users-client.tsx`, `apps/mobile/app/(app)/users.tsx`)**:
  - Dynamic explanation clearly distinguishes between search query terms vs active filter criteria.
  - Single-click "Clear Search & Filters" CTA resets search, role, status, state, kyc, dateRange, and pagination back to defaults.
- **Infinite Pagination on Scroll & FlatList Virtualization (`apps/web/app/(app)/users/users-client.tsx`, `apps/mobile/app/(app)/users.tsx`, `apps/web/app/actions/users.ts`)**:
  - **Infinite Scroll on Touch Card Views**:
    - Replaced monolithic, all-at-once user loading with paginated infinite loading on scroll for touch card lists (25 cards per batch on React Native, 10 on Web Mobile).
    - React Native utilizes `<FlatList<UserRecord>>` with `onEndReachedThreshold={0.35}` and `onMomentumScrollBegin` guard to seamlessly fetch subsequent pages.
    - Web mobile view utilizes an `IntersectionObserver` sentinel div placed after the card stream to trigger `handleLoadMoreMobile()`.
  - **Card Deduplication & Anti-Replacement**:
    - Appends newly fetched batches to existing list using Set-based ID deduplication (`new Set(prev.map(u => u.id))`), guaranteeing cards are never duplicated or overwritten.
  - **Non-Blocking Load More & Inline Error Retry**:
    - Non-blocking bottom micro-spinner and status caption while fetching next pages, keeping already-rendered cards interactive.
    - Inline error retry banner with retry action on network errors, preventing full page reloads.
  - **Subtle End of List State**:
    - When `hasMore` reaches `false`, renders subtle "All users have been displayed" divider and halts further pagination requests.
  - **High-Performance Virtualization & Native Scroll Physics**:
    - Extracted memoized `UserTouchCard` (`React.memo`) to eliminate re-renders of existing cards on batch appends.
    - Native vertical scrollbar enabled via `showsVerticalScrollIndicator={true}`.
    - Concurrency lock (`isFetchingRef`) and request cancellation versioning (`requestVersionRef`) prevent duplicate fetches and race conditions.
    - Filter, search, and pull-to-refresh interactions smoothly reset pagination state back to Page 1.
## Key Functions & Workflows
- `updateMyProfile(formData)`: Allows users to update their own full name, phone, shift schedule, street address, city/state, Aadhaar, and driving licence. Instant database updates for Super Admin; automatically creates a `profile_change_requests` record for lower roles routed according to role approval hierarchy.
- **Profile Approval Hierarchy Matrix**:
  - `super_admin`: Instant database update (no approval needed). Can approve changes for all roles.
  - `admin`: Requests routed to `super_admin`. Can approve requests from all lower roles.
  - `manager` / `service_manager` / `hr_manager` / `store_manager`: Requests routed to `admin`. Can approve requests from supervisors and field staff.
  - `supervisor`: Requests routed to `manager`. **Supervisor has 0 approval access**.
  - `operator`, `engineer`, `mechanic`: Requests routed to `manager`.
- `approveProfileChangeRequest(requestId)` / `rejectProfileChangeRequest(requestId, reason)`: Authenticated server actions enforcing the approval matrix and updating both `public.users` table and Supabase auth user metadata upon approval.
- `bulkApproveProfileChangeRequests(requestIds)` / `bulkRejectProfileChangeRequests(requestIds, reason)`: Batch processing of profile detail change requests.
- `getPendingRoleBadge(role)`: Renders color-coded status badges with role icons for pending account access requests on the Admin management page.
- `exportUsersToExcel(users, filenamePrefix, scopeLabel)` & `exportUsersToCSV(users, filenamePrefix)`: Generates structured Excel (.xlsx) and CSV reports with metadata headers (including Scope, Total Exported, Date, Generated By), masked Aadhaar formatting, and status breakdown summary statistics.
- **Export Scope Control (Popover Menu & Scoped Handlers)**:
  - Header export button opens an interactive scope dropdown popover displaying exact live counts:
    - **Current Page**: Exports visible paginated rows (`usersList.length`, e.g. 10 users on Page 1) to `Users-Page-{currentPage}`.
    - **All Matching Users**: Exports complete dataset (`totalCount` users) across all pages matching active filters to `Users-Directory-All`.
    - **Selected Users**: Dynamically surfaces when rows are checked (`selectedUserIds.length` users) to `Users-Selected`.
  - Format toggle pill switchable between `.xlsx` (Excel) and `.csv` (CSV).
  - Preserved quick-export buttons on the floating bulk action bar when rows are checked.
- `bulkDeleteUsers(userIds)`: High-performance parallel user deletion server action with self-delete protection, super admin privileges guard, employee sync cleanup, audit logging, and cache invalidation.
- `roleHasPermission(role, permission)`: Evaluates resource-action permissions with dot/colon normalization (`machine:read` ↔ `machine.view`, `hr:read_salary` ↔ `employee.salary.view`, `profile.edit_self`, `profile.approve_changes`).
- `currentUserHasPermission(permission)`: Checks active user permission.
- `updateUserRole(userId, role)`: Changes user permission tier across all canonical system roles (Super Admin can assign any role including Super Admin; Admin cannot modify Super Admin roles).
- `toggleUserStatus(userId)`: Toggles user status between `active` and `inactive` via `createSupabaseAdminClient()`.
- **Multi-Supervisor Assignment & Clean UI (`056_add_user_supervisor_ids.sql`)**:
  - Supervised roles (`operator`, `service_engineer`, `engineer`, `mechanic`) support multiple assigned supervisors via `supervisor_ids UUID[]` with GIN indexing, while preserving `supervisor_id` as the primary supervisor via bidirectional DB triggers (`sync_user_supervisor_array`).
  - The desktop users table (`/users?tab=all`) column 4 renders clean, compact supervisor badges/chips (`#fafafa` canvas background, `#ebebeb` border, max 15-char truncation with full-name tooltip; "Unassigned" if empty; `—` for non-supervised roles). Clicking a supervisor chip opens the user detail sheet.
  - Supervisor assignment is managed directly within the 3-dot action menu portal dropdown as a scrollable multi-select checkbox list with min 44px touch targets and "No Supervisor" clearing option.
  - `UserDetailSheet` and mobile `UserDetailModal` display all assigned supervisors with email tags.
  - Name and email in table rows and cards are truncated cleanly at 15 and 20 characters respectively with hover tooltips and detail sheet access.
  - Mirrored in mobile app with touchable cards, bottom sheet modal selectors, and details view.
- **Table Interaction & Action Column Refinement**:
  - Entire user rows in `UserRow.tsx` and pending user cards in `users-client.tsx` are whole-item clickable to open `UserDetailSheet` with keyboard navigation and event propagation prevention on checkboxes and action menus.
  - Standalone Eye icon button removed from table rows.
  - Actions table header text removed (`<span className="sr-only">Actions</span>`) with compact column width, cleanly showcasing the 3-dot menu button in every row.
- **Working Location / Site / Office Selection (All Users)**:
  - Table `public.working_locations` stores all operational bases (`id`, `name`, `type`, `address`, `city`, `state`, `pincode`, `status`).
  - Users have a `working_location_id` referencing `working_locations(id)`.
  - The desktop users table (`/users`) renders a dedicated `Working Location` column showing the site name and city with map pin icon or `—`.
  - `MobileUserCard` renders a Working Base badge with `MapPin` icon.
  - `UserDetailSheet` and mobile `UserDetailModal` display the working location under Location & Base details.
  - `UserCreateModal` and `UserEditModal` render a dynamic `<SearchableSelect>` for Working Location in Section 4 across all roles, with hidden inputs submitting `working_location_id`.
  - Public RPC `get_active_working_locations_public()` allows unauthenticated and authenticated users to list active locations securely.
  - Excel and CSV exports include the Working Location column.
- `auth_user_has_branch_access(target_branch_id)`: Postgres RLS function enforcing branch scoping (Super Admin & Admin bypass branch locks).
- `prevent_audit_log_modification()`: Postgres trigger preventing any physical UPDATE or DELETE on `public.audit_logs`, guaranteeing immutable audit trails.
- **Server-Side Pagination, Global Search & Deterministic Sorting (`/users?tab=all`)**:
  - `getUserList()` enforces 10 users per page (`pageSize = USERS_PAGE_SIZE = 10`), parallelizes supervisor and working location relations lookup with `Promise.all()`, and executes exact count range queries.
  - Appends `.order("id", { ascending: true })` as a stable secondary tiebreaker across all sort paths (`newest`, `oldest`, `name_asc`, `name_desc`, `role_asc`) ensuring deterministic, non-drifting page boundaries on equal timestamps or values.
  - **Pattern-Aware Search Optimization (`applyOptimizedUserSearch`)**: Intelligently routes queries based on pattern detection:
    - Formatted Phone & Aadhaar numbers: Strips spaces, dashes, +91/0 prefixes (`cleanDigits`), scanning only `phone`, `aadhaar_number`, `license_number`, and `full_name`.
    - Email: Targets `email` and `full_name` when input contains `@` or `.com`/`.in`.
    - Roles: Normalizes spaces to underscores (`super admin` -> `super_admin`, `service engineer` -> `service_engineer`) and handles plural suffixes (`operators` -> `operator`).
    - Multi-Token Composite Search: Chains `.or()` across separate tokens so multi-term queries ("Kalicharan Gujarat", "Munaa operator") match across distinct columns with 100% accuracy.
    - Single-Character Protection: Bypasses heavy search filter execution when `trimmed.length < 2 && trimmed.length > 0` to prevent full sequential table scans that bypass trigram GIN indexes.
  - **500ms Debounce & Input Isolation (`users-client.tsx`)**: Extended search debounce from 300ms to strictly 500ms. Input changes are isolated using `lastCommittedSearchRef` so server URL updates never overwrite active user typing. Instant clear on empty and instant submit on Enter (`onSubmitSearch`).
  - Migration `060_add_users_sort_role_search_indexes.sql` deploys `users_full_name_sort_idx` B-tree index on `users(full_name)` and `users_role_trgm_idx` GIN index on `users USING GIN (role gin_trgm_ops)`.
  - `getUserListAggregatesCached()` runs cached parallel aggregate queries (`TAGS.users`, tier `CLASS_C_OPERATIONAL`) for `totalUsers`, `activeUsers`, `engineerCount`, and unique `states`.
  - Next.js searchParams passthrough in `app/(app)/users/page.tsx` supports URL bookmarking, deep linking, and zero client-side filter computation.
  - Full Web-to-Mobile parity synchronized in `apps/mobile/app/(app)/users.tsx` with `debouncedSearch` (500ms timer, min 2-character requirement) and `applyOptimizedUserSearch(query, debouncedSearch)`.

