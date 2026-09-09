# Feature: Centralized Audit Logs Module (`/audit`)

## 1. Overview
The Centralized Audit Logs module transforms ReachInternational's previously fragmented, operations-nested assignment logs into a single, industry-grade, enterprise audit center located at `/audit`.

It captures every critical mutation across the entire platform in an append-only, tamper-proof audit trail with structured taxonomy, before-and-after state diff comparison, denormalized zero-JOIN reads, and RBAC-governed visibility.

## 2. Event Taxonomy (`packages/types/src/audit.ts`)
- **Authentication**: `auth.login`, `auth.logout`, `auth.login_failed`, `auth.session_expired`
- **Machines**: `machine.created`, `machine.updated`, `machine.deleted`, `machine.status_changed`, `machine.hmr_updated`, `machine.assigned_to_client`, `machine.removed_from_client`
- **Assignments**: `assignment.operator_assigned`, `assignment.operator_changed`, `assignment.operator_unassigned`, `assignment.supervisor_assigned`, `assignment.supervisor_changed`, `assignment.supervisor_unassigned`
- **Rental**: `rental.machine_rented`, `rental.rental_ended`, `rental.extended`, `rental.cancelled`, `rental.dispatched`, `rental.returned`, `rental.inspected`, `rental.damage_reported`
- **Employees & Users**: `employee.created`, `employee.updated`, `employee.deleted`, `employee.activated`, `employee.deactivated`, `employee.approved`, `employee.rejected`, `employee.role_changed`, `employee.password_reset`
- **Operations**: `operations.log_created`, `operations.log_updated`, `operations.log_deleted`, `operations.shift_started`, `operations.shift_ended`, `operations.shift_changed`, `operations.breakdown_created`, `operations.breakdown_updated`, `operations.breakdown_resolved`
- **Clients**: `client.created`, `client.updated`, `client.deleted`
- **Security & Permissions**: `security.unauthorized_action`, `security.event`, `security.rls_violation`, `security.blocked_mutation`, `permission.role_changed`
- **System**: `system.settings_updated`, `system.import_started`, `system.import_completed`, `system.notification_sent`, `system.reminder_dispatched`

## 3. Database Schema & Indexes (Migration 053)
Migration: `supabase/migrations/053_centralized_audit_schema_and_indexes.sql`
- Added columns to `public.audit_logs`:
  - `category TEXT`
  - `severity TEXT CHECK (severity IN ('info', 'warning', 'critical')) DEFAULT 'info'`
  - `before_state JSONB`
  - `after_state JSONB`
  - `actor_name TEXT`
  - `actor_role TEXT`
  - `entity_name TEXT`
  - `ip_address TEXT`
- Optimized B-Tree composite indexes:
  - `idx_audit_logs_category_created` ON `(category, created_at DESC)`
  - `idx_audit_logs_severity_created` ON `(severity, created_at DESC)`
  - `idx_audit_logs_cursor` ON `(created_at DESC, id DESC)`
  - `idx_audit_logs_actor_role` ON `(actor_role, created_at DESC)`
- RLS Policies:
  - Strict append-only (0 UPDATE, 0 DELETE).
  - Admins & Super Admins: read all logs.
  - Managers / Service Managers: read all operations, machines, users, assignments, and rental logs.
  - Supervisors: read machine, assignment, and operations logs.
  - Field staff: read their own activity audit trail (`auth.uid() = user_id`).
  - Automated redaction of Super Admin emails for lower-privileged viewers.

## 4. Web Architecture & Components
- Route: `/audit` (`apps/web/app/(app)/audit/page.tsx`)
  - Server Component guarded with `await requirePermission("audit.view")`.
  - Supports domain tabs: `tab=machine`, `tab=assignments`, `tab=rentals`, `tab=employees`, `tab=auth`, `tab=others`, `tab=all`.
  - Re-evaluates on filter/tab change via URL query searchParams.
  - Backward compatibility: `/audit?category=auth` automatically maps to `tab=auth`, `/audit-logs` and `/operations/audit-logs` redirect cleanly to `/audit`.
- Detail Route: `/audit/[id]` (`apps/web/app/(app)/audit/[id]/page.tsx`)
  - Standalone server component for deep linking, mobile, and bookmarking.
- UI Components:
  - `<AuditClient>` (`apps/web/components/audit/AuditClient.tsx`): Main client orchestrator with dedicated domain tab switcher, live record count badges, contextual domain explanation wells, tab-customized desktop table columns, and mobile touch cards.
  - `<AuditKpis>` (`apps/web/components/audit/AuditKpis.tsx`): Metric cards with interactive 1-click tab navigation.
  - `<AuditFilters>` (`apps/web/components/audit/AuditFilters.tsx`): Streamlined toolbar with search, severity selector, date range presets, custom date inputs, actor role filter, CSV export, and reset button.
  - `<AuditDetailDrawer>` (`apps/web/components/audit/AuditDetailDrawer.tsx`): Right-side slide-over drawer displaying actor, entity links, before/after diff table, and raw JSON payload with 1-click copy.

## 5. Mobile App Synchronization (`apps/mobile`)
- Removed obsolete nested `'audit-logs'` tab from `apps/mobile/app/(app)/operations.tsx`.
- Removed assignment audit cards and segment button from mobile operations.
- Cleaned up state and types in React Native codebase.

## 6. Verification
- `pnpm -r exec tsc --noEmit`: 0 errors across all workspace packages.
- Live HTTP verification: `/audit` and `/audit-logs` route checks return 307 Redirect to `/login` when unauthenticated.
