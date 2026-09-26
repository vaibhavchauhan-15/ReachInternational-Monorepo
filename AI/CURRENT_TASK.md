# Current Task: Attendance Page Feedback Resolution — Scheduled vs Present Days Parity & Clean UI (/attendance)

Status: COMPLETED (2026-09-26)

## Overview & Requirements Addressed (6 Feedback Items)
1. **Remove PageHeader Description Paragraph** (Feedback 1):
   - Removed description text `"Monthly operator attendance tracking derived from machine operation logs"` from `<PageHeader />` in `apps/web/app/(app)/attendance/AttendanceClient.tsx`.
2. **Remove KPI Card Subtitles** (Feedback 2, 3, 4, 5):
   - Card 1 (Total Staff): Removed subtitle paragraph `"Active operators this month"`.
   - Card 2 (Present): Removed subtitle paragraph `"Full daily work log completed"`.
   - Card 3 (Absent): Removed subtitle paragraph `"No machine logs submitted"`.
   - Card 4 (Half Day): Removed subtitle paragraph `"Under 4 hours operation"`.
   - Aligns web KPI cards cleanly with mobile app KPI cards (which only display title and value).
3. **Correct Scheduled and Present Days Alignment** (Feedback 6):
   - Feedback: `"sheduled and presnt day show the wrong data / present day <= scheduled day / correct it proprely"`.
   - **Root Cause**:
     - `v_scheduled_days` in `get_attendance_monthly_summary` was previously capped with `WHILE v_d <= LEAST(v_month_end, v_today) LOOP`, which undercounted the month's total scheduled working days (showing 23 instead of 26 for September 2026).
     - `present_days` was computed using `COUNT(DISTINCT mhl.log_date)` which counted logs on Sundays (3 Sunday shift dates) and did not check `day_normal_hours >= 4`, leading to `present_days = 24` while `scheduled_days = 23` (`24 > 23`).
     - Furthermore, `get_attendance_daily_detail` marked Sundays as `WEEK_OFF` and reported `presentDays = 21`, conflicting directly with the summary table.
   - **Delivered Database Fix (`111_fix_attendance_scheduled_and_present_days.sql` on Dev DB `vlmxciuogczumumrwyot`)**:
     - `v_scheduled_days` now computes the total scheduled working days in the month (weekdays excluding Sundays) across `[v_month_start, v_month_end]` = 26 days for September 2026.
     - `present_days` strictly counts scheduled weekdays (`EXTRACT(DOW FROM mhl.log_date) <> 0`) with at least 4 normal working hours (`day_hours.day_normal_hours >= 4`), capped at `v_scheduled_days`.
     - `half_days` strictly counts scheduled weekdays with `< 4` hours.
     - `absent_days` counts past scheduled weekdays strictly before today with no logs (`GREATEST(v_past_scheduled_days - logs.past_present_days, 0)`).
     - Sunday running hours and overtime remain 100% tracked in `worked_minutes` and `overtime_minutes`.
     - Strict mathematical invariant guaranteed: `present_days <= scheduled_days` monorepo-wide.
     - 100% parity achieved between summary table and `get_attendance_daily_detail` modal.
4. **Client-Side Defense-in-Depth**:
   - Guarded `Math.min(emp.present_days, emp.scheduled_days)` in `AttendanceClient.tsx` (desktop table, mobile cards, CSV export) and `apps/mobile/app/(app)/attendance.tsx` (touch cards).

## Monorepo Quality Gate Status
- Web TypeScript check: `pnpm --filter @reachinternational/web exec tsc --noEmit` exited code 0 (0 errors).
- Mobile TypeScript check: `pnpm --filter @reachinternational/mobile exec tsc --noEmit` exited code 0 (0 errors).
- Permissions RBAC suite: `pnpm --filter @reachinternational/permissions test` passed (3/3 pass, exit code 0).
- Dev Server: `GET /attendance?month=2026-09` HTTP 200 OK.