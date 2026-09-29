# Feature Module — Attendance Management & Operator Self Ledger

## Overview
Provides monthly attendance tracking, calendar matrix inspection, punch time auditing, machine hour log correlation, and payable days computation.
Supports both administrative roster summaries (for HR, Managers, Admins, Supervisors) and strict personal attendance ledgers (for Operators).

## File Map
- **Web Pages**:
  - `apps/web/app/(app)/attendance/page.tsx` — Direct in-page personal attendance hub for operators (`<AttendanceDetailClient isSelf={true}>`) / Monthly roster summary (`<AttendanceClient>`) for Admins, HR, Managers, Supervisors. Zero redirect hops.
  - `apps/web/app/(app)/attendance/[userId]/page.tsx` — Individual employee daily detail and monthly calendar view with operator foreign ID protection redirecting to `/attendance`.
- **Client Components & Utilities**:
  - `apps/web/app/(app)/attendance/AttendanceClient.tsx` — High-density employee summary roster and CSV export.
  - `apps/web/app/(app)/attendance/[userId]/AttendanceDetailClient.tsx` — 3-tier responsive calendar matrix, KPI cards, daily shift log ledger, single unified Export button, and shift inspection modal. Automatically removes redundant user details master card when `isSelf` or `isOperator`.
  - `apps/web/components/attendance/PrintableAttendanceModal.tsx` — Centralized A4 portrait print/PDF modal and Excel exporter with red logo, user details in header, KPI strip, balanced 8-column layout (Site Location 30%), dynamic row height scaling (clamped 5.4mm–9.5mm), canonical address normalization (`normalizeClientSiteAddress`), strict single-line ellipsis enforcement, and 3-column signature block guaranteeing all 1 to 31 days fit cleanly on a single A4 page without page spillover.
  - `apps/web/lib/utils/attendance-export.ts` — Excel export utility calculating dynamic column widths based on maximum string lengths.
- **Mobile Screen**:
  - `apps/mobile/app/(app)/attendance.tsx` — Direct in-screen "My Attendance" ledger for operators; searchable roster and calendar detail modal for managers/admins.
- **Server Actions & DAL**:
  - `apps/web/app/actions/attendance.ts` — `getAttendanceDetailAction`, `getAttendanceSummaryAction`, `getAttendanceExportAction`. Rejects foreign operator requests with 403 Forbidden.
  - `apps/web/lib/data/attendance/attendance-detail.ts` — Database accessor for `get_attendance_daily_detail`.
- **Permissions**:
  - `packages/permissions/src/permissions.ts` — `ATTENDANCE_VIEW` (`"attendance.view"`), `ATTENDANCE_VIEW_SELF` (`"attendance.view_self"`).
  - `packages/permissions/src/matrix.ts` — Role permission mappings (`operator` has `attendance.view_self`; `super_admin`, `admin`, `hr`, `manager`, `supervisor` have `attendance.view`).
  - `packages/permissions/src/navigation.ts` — Nav items and role assignments.
- **Database RPCs & Migrations**:
  - `supabase/migrations/116_fix_attendance_daily_detail_rpc.sql` — Daily detail computation with shift timings and breakdown deduction.
  - `supabase/migrations/136_allow_operator_self_and_manager_attendance_daily_detail.sql` — Operator self-access authorization and manager RBAC grant.
  - `supabase/migrations/137_restrict_operator_attendance_and_monthly_summary.sql` — Strict database-level operator lockdown on `get_attendance_monthly_summary` (raises 42501) and self-check on `get_attendance_daily_detail` (raises 42501 if caller is operator and `auth.uid() <> p_employee_id`).

## Security & Data Isolation
1. **Operator Isolation Rule**:
   - PostgreSQL RPC `get_attendance_daily_detail` verifies:
     ```sql
     IF v_caller_role = 'operator' AND auth.uid() <> p_employee_id THEN
       RAISE EXCEPTION 'Unauthorized: operators can only view their own attendance' USING ERRCODE = '42501';
     END IF;
     ```
   - PostgreSQL RPC `get_attendance_monthly_summary` verifies:
     ```sql
     IF v_caller_role = 'operator' THEN
       RAISE EXCEPTION 'Unauthorized: operators cannot access attendance summary roster' USING ERRCODE = '42501';
     END IF;
     ```
   - Server Action `getAttendanceDetailAction` validates session role and forces `resolvedId = user.id` if caller is an operator.
   - Page route `/attendance` renders the operator's personal ledger directly in-page with zero redirects to avoid router bounces.
   - Page route `/attendance/[userId]` redirects operators attempting to inspect foreign user IDs to `/attendance`.
   - Operators have NO access to `get_attendance_monthly_summary` or summary CSV exports.

2. **Mobile Screen Adaptation**:
   - When caller is an operator, the mobile screen immediately calls `get_attendance_daily_detail` for their own ID. Search bars and foreign operator lists are not mounted.
