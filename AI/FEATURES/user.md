# Feature Module — User Management & RBAC

## Overview
Manages user accounts, profile details, company branch assignments, and Role-Based Access Control (RBAC) role assignments across 13 system roles.

## File Map
- **Page**: `app/(app)/users/page.tsx`
- **Client Hub**: `app/(app)/users/users-client.tsx`
- **Row & Detail Sheet**: `app/(app)/users/UserRow.tsx`, `UserDetailSheet.tsx`
- **Modals**: `app/(app)/users/UserCreateModal.tsx`, `UserEditModal.tsx`
- **RBAC Matrix & Scopes**: `lib/auth/rbac.ts`, `lib/auth/scope.ts`
- **Actions**: `app/actions/users.ts`, `app/actions/auth.ts`
- **DAL**: `lib/dal.ts`
- **Database Migrations**: `supabase/migrations/017_comprehensive_13_roles_rbac.sql`, `018_branch_manager_role_refinements.sql`, `019_super_admin_role_refinements.sql`, `020_service_manager_role_refinements.sql`, `021_service_engineer_role_refinements.sql`, `022_mechanic_role_refinements.sql`

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
- `getPendingRoleBadge(role)`: Renders color-coded status badges with role icons for pending account access requests on the Admin management page.
- `roleHasPermission(role, permission)`: Evaluates resource-action permissions with dot/colon normalization (`machine:read` ↔ `machine.view`, `hr:read_salary` ↔ `employee.salary.view`).
- `currentUserHasPermission(permission)`: Checks active user permission.
- `updateUserRole(userId, role)`: Changes user permission tier across all canonical system roles (Super Admin can assign any role including Super Admin; Admin cannot modify Super Admin roles).
- `toggleUserStatus(userId)`: Toggles user status between `active` and `inactive` via `createSupabaseAdminClient()`.
- `auth_user_has_branch_access(target_branch_id)`: Postgres RLS function enforcing branch scoping (Super Admin & Admin bypass branch locks).
- `prevent_audit_log_modification()`: Postgres trigger preventing any physical UPDATE or DELETE on `public.audit_logs`, guaranteeing immutable audit trails.
