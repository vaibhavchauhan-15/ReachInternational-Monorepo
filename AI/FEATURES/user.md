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
6. `supervisor` — Supervisor (Field supervision, complaint logging & log verification)
7. `mechanic` — Mechanic (Workshop repairs & parts request)
8. `operator` — Operator (Machine operation & daily meter log entry)
9. `store_manager` — Store Manager (Inventory stock ledger, receiving & transfers)
10. `hr_manager` — HR Manager (Employee directory, onboarding & protected salary)

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
- `exportUsersToExcel(users)` & `exportUsersToCSV(users)`: Generates structured Excel (.xlsx) and CSV reports with metadata headers, masked Aadhaar formatting, and status breakdown summary statistics.
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
- **Server-Side Pagination & Performance Optimization (`/users?tab=all`)**:
  - `getUserList()` enforces 10 users per page (`pageSize = 10`), parallelizes supervisor and working location relations lookup with `Promise.all()`, and executes exact count range queries.
  - `getUserListAggregatesCached()` runs cached parallel aggregate queries (`TAGS.users`, tier `CLASS_C_OPERATIONAL`) for `totalUsers`, `activeUsers`, `engineerCount`, and unique `states`.
  - Next.js searchParams passthrough in `app/(app)/users/page.tsx` supports URL bookmarking, deep linking, and zero client-side filter computation.
  - `<UsersPageClient>` uses `useTransition` for smooth `isPending` state handling, renders standard `<Pagination>` on both desktop table and mobile cards, connects metrics cards to global aggregates, and exports complete filtered datasets via `exportUsersFilteredAction`.
