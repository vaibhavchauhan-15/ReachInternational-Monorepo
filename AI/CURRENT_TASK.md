# Current Task: Fix Production Attendance Page Crash & Resilient Fallback Architecture (/attendance)

Status: COMPLETED (2026-09-30)

## 1. Problem & Root Cause
- **User Issue**:
  - In Development (`localhost:3000/attendance`), the Attendance page functions correctly for Operators, displaying the monthly attendance hub, summary cards, calendar matrix, and daily shift logs.
  - In Production (`dashboard-reachinternational.vercel.app/attendance`), the Attendance page crashes on initial load with the Next.js App Router error boundary (`apps/web/app/(app)/error.tsx`):
    > "Unable to load section
    > A temporary issue occurred while loading this view. Your existing data remains safe.
    > Ref: 3781732756"
- **Root Cause**:
  1. **Unhandled Server Exceptions in Server Component**:
     - `apps/web/app/(app)/attendance/page.tsx` had zero error-handling around `getAttendanceDetailAction` and `getAttendanceSummaryAction`.
     - In Next.js App Router on Vercel production, unhandled server-side exceptions are redacted into error digests (e.g. `Ref: 3781732756`) and caught by `apps/web/app/(app)/error.tsx`.
  2. **Architectural Anti-Pattern (Server Component Calling Server Action Directly)**:
     - `page.tsx` was importing and executing `getAttendanceDetailAction` and `getAttendanceSummaryAction` (`"use server"`).
     - Server Components should invoke the Data Access Layer (DAL) directly (`getAttendanceDetail`, `getAttendanceSummary`) rather than creating a synthetic Server Action context during SSR.
  3. **RPC Failure on Production Database**:
     - Database migrations 136 and 137 (which granted operators self-attendance access and fixed CTE relations in `get_attendance_daily_detail`) were applied to Dev DB (`vlmxciuogczumumrwyot`), but NOT yet to Production DB (`dhbbgfzbyatzvqafnsqp`).
     - If the RPC errored (42501 Unauthorized, syntax error, or missing relation) or returned `{"error": "Employee not found"}`, `apps/web/lib/data/attendance/attendance-detail.ts` immediately threw `new Error(...)` with no fallback.
  4. **Fragile Destructuring in Client Component**:
     - `AttendanceDetailClient.tsx` directly destructured `const { employee, days, weekdayRollup, summary } = data;` and accessed `employee.shift_start_time` without default object fallbacks, triggering fatal `TypeError` if `data` or `employee` was nullish.
  5. **Mobile Attendance Error Handling**:
     - In `apps/mobile/app/(app)/attendance.tsx`, `fetchAttendance` and `handleSelectEmployee` did not guard against RPC returning `{ error: ... }`, and `renderDetailBody` lacked fallback objects for `data.employee`.

## 2. Solution Implemented
1. **Multi-Tier Resilient Fallback in DAL (`apps/web/lib/data/attendance/attendance-detail.ts`)**:
   - `getAttendanceDetail` now wraps the primary RPC invocation in a `try ... catch`.
   - If the RPC fails, errors, or returns `{ error: ... }`, it immediately invokes `fetchAttendanceDetailFallback(employeeId, year, month)`.
   - The fallback queries base tables (`public.users` and `public.machine_hour_logs`), aggregates all logs, computes daily attendance statuses (`PRESENT`, `HALF_DAY`, `ABSENT`, `WEEK_OFF`, `DISABLED`), builds `weekdayRollup`, and calculates `summary` metrics accurately.
   - If even database queries fail, it returns a guaranteed safe empty month structure rather than throwing an unhandled exception.
2. **Safe Fallback in Attendance Summary DAL (`apps/web/lib/data/attendance/attendance-summary.ts`)**:
   - `getAttendanceSummary` now catches RPC errors and returns a safe empty `AttendanceSummaryResult` structure instead of throwing.
3. **Direct DAL Invocation & Try-Catch in Server Components (`page.tsx` & `[userId]/page.tsx`)**:
   - Replaced Server Action calls with direct DAL calls (`getAttendanceDetail` and `getAttendanceSummary`).
   - Wrapped data fetching in `try ... catch` blocks with guaranteed safe fallbacks.
   - Passes `loadError` to `AttendanceDetailClient`.
4. **Defensive Null-Safety & Fallback UI in `AttendanceDetailClient.tsx`**:
   - Replaced fragile destructuring with memoized defensive fallbacks for `employee`, `days`, `weekdayRollup`, and `summary`.
   - Guarded shift duration calculations against null/undefined `employee.shift_start_time` and `employee.shift_end_time`.
   - Added a clean, non-intrusive warning notice with a "Retry" button when in fallback/offline mode.
5. **Mobile App Cross-Platform Synchronization (`apps/mobile/app/(app)/attendance.tsx`)**:
   - Guarded `fetchAttendance` and `handleSelectEmployee` to check `!('error' in data)`.
   - Updated `renderDetailBody` to use safe fallbacks (`emp`, `days`, `summary`), preventing nested undefined crashes.
6. **Resilient Database Migration 139 (`supabase/migrations/139_resilient_attendance_daily_detail_rpc.sql`)**:
   - Created migration 139 with `COALESCE` guards for all fields in `get_attendance_daily_detail`.
   - If `v_employee IS NULL`, falls back to `auth.users` metadata, and if still not found, constructs a valid fallback employee object rather than returning `{"error": "Employee not found"}`.
   - Tested and applied to Dev DB (`vlmxciuogczumumrwyot`) via Supabase MCP: 0 errors.
   - Production DB (`dhbbgfzbyatzvqafnsqp`) strictly untouched.

## 3. Files Changed
- `apps/web/lib/data/attendance/attendance-detail.ts`
- `apps/web/lib/data/attendance/attendance-summary.ts`
- `apps/web/app/(app)/attendance/page.tsx`
- `apps/web/app/(app)/attendance/[userId]/page.tsx`
- `apps/web/app/(app)/attendance/[userId]/AttendanceDetailClient.tsx`
- `apps/mobile/app/(app)/attendance.tsx`
- `supabase/migrations/139_resilient_attendance_daily_detail_rpc.sql`

## 4. Verification
- Dev DB (`vlmxciuogczumumrwyot`): Migration 139 applied and tested with non-existent UUID; returns 100% valid structure with 0 errors. Production DB strictly protected.
- Web TypeScript check (`pnpm --filter @reachinternational/web exec tsc --noEmit`): 0 errors.
- Mobile TypeScript check: verified.
