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
- `auth_user_has_branch_access(target_branch_id)`: Postgres RLS function enforcing branch scoping (Super Admin & Admin bypass branch locks).
- `prevent_audit_log_modification()`: Postgres trigger preventing any physical UPDATE or DELETE on `public.audit_logs`, guaranteeing immutable audit trails.
