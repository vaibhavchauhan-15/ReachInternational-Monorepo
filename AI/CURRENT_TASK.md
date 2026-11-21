# Current Task

## Task: Past-Date Operator Shift Assignment Visibility & Persistence in Operations Monitor (Web + Native + DB)
**Status**: 🟢 COMPLETED & VERIFIED
**Date**: 2026-11-21

### Objectives (from page feedback on `/operations` at Viewport 1536×791)
1. When assigning an operator to a past date (e.g. 2026-11-19, "2d ago"), overwrite/save the roster changes cleanly in the database for that date.
2. Ensure the past-date assignment is fully working end-to-end.
3. Ensure the operations monitor and summary fetch and display the updated past-date assignment data directly from Supabase (showing the operator in Shift A instead of "Unassigned").

### Root Cause
- In `get_today_shift_log_monitor` and `get_today_shift_monitor_summary` (migrations 225 & 227), `assignments_on_date` included:
  ```sql
  AND NOT (
    oma.valid_from = oma.valid_to
    AND oma.is_active = false
    AND NOT EXISTS (SELECT 1 FROM logs lg WHERE lg.assignment_id = oma.id)
  )
  ```
- For past dates (`target_date < today_ist`), single-day assignments have `valid_from = valid_to = target_date`. Furthermore, trigger `trg_fn_sync_oma_valid_range` sets `is_active = false` on any assignment whose `valid_to < today_ist`. If the operator has not yet entered a log, `NOT EXISTS (logs)` evaluated to `true`.
- Because `p.target_date >= p.today_ist` was omitted from this guard, **every newly assigned past-date assignment without logs was completely excluded** from the monitor and summary CTEs, causing the monitor on past dates to return `Unassigned` instead of the newly assigned operator (`status: 'pending'`).

### Delivered
- **Database Migration 230 (`supabase/migrations/230_fix_past_date_shift_monitor_and_summary.sql`)**:
  - Scoped the exclusion guard in both `get_today_shift_log_monitor` and `get_today_shift_monitor_summary` to `p.target_date >= p.today_ist`.
  - Preserves the same-day relieved operator filter for today (`target_date >= today_ist`), while correctly including past single-day assignments as `status: 'pending'` before shift entry.
  - Automatically applied and verified on Development Supabase (`vlmxciuogczumumrwyot`). (Production DB `dhbbgfzbyatzvqafnsqp` left untouched per safety policy).
- **Web & Mobile Parity Synchronization**:
  - `apps/mobile/components/operations/MobileAssignPersonnelModal.tsx`: Updated `onSuccess` callback to pass `assignmentDate` upon successful save (`onSuccess(currentRosterSnapshot, assignmentDate)`).
  - `apps/mobile/components/operations/MobileTodayShiftMonitorTab.tsx`: Added date-switching or refetching upon save on a specific date (`if (savedDate && savedDate !== selectedDate) setSelectedDate(savedDate); else Promise.all([refetchSummary(), refetchInfinite()]);`).
  - `apps/web/components/operations/TodayShiftMonitorTab.tsx`: Retained date-matching optimistic monitor updates and verified soft background synchronization via `refreshRoster(false)`.

### Verification
- **Live Supabase Dev Query**: Executed `get_today_shift_log_monitor('e8f096b2...', '2026-11-19'::date)` on `M/C-0001`: returns `VAIBHAV CHAuhannn`, Shift `A`, `status: 'pending'`, `log_id: null`.
- **Live Supabase Summary Query**: Executed `get_today_shift_monitor_summary('e8f096b2...', '2026-11-19'::date)`: returns `pending: 7, unassigned: 0`.
- **TypeScript**: `pnpm --filter web typecheck` and `pnpm --filter mobile typecheck` 100% clean (0 errors).
- **Automated Tests**:
  - `node tests/operations/test-date-based-assignment.mjs`: 57/57 passed cleanly (100%).
  - `node apps/web/scripts/test-assignment-standardization.mjs`: 34/34 passed cleanly (100%).
  - `node scripts/run-all-tests.mjs`: 33/33 monorepo test suites passed cleanly (100%).

---

## Task: Operations Page Feedback — Date Picker Tooltips, Window Badge Removal & Layout Optimization (Web + Native)
**Status**: 🟢 COMPLETED & VERIFIED
**Date**: 2026-11-21

### Objectives (from page feedback on `/operations` at Viewport 624×807)
1. Add tooltips on `<CustomDatePicker>` day cells for: Today, Yesterday, 2 days ago to 7 days ago, Tomorrow, and Locked dates.
2. Remove `"7d back · 1d ahead"` chip from the Assignment Date row.
3. Clean and optimize the Assignment Date row layout for mobile and tablet viewports.

### Delivered — Web & Mobile Parity
- **CustomDatePicker Tooltips & Lock Indicators**:
  - Implemented floating real-time tooltips over each calendar cell with Geist dark contrast styling, type indicators (emerald for Today, indigo for Tomorrow, sky for Yesterday, amber for Past days, rose lock for Locked), day label, and formatted date (`Today · 21 Nov`, `Yesterday · 20 Nov`, `N days ago · <Date>`, `Tomorrow · 22 Nov`, `Locked · <Date>`).
  - Added micro lock icons (`Lock` size 8) on all disabled calendar cells.
  - Added live status preview in the calendar footer showing hovered/focused date and status reason (`Today · Current active date`, `Yesterday · 1 day ago`, `Tomorrow · Next day plan`, `Locked · >7d limit`).
  - Enabled full accessibility via `aria-disabled` and keyboard focus support without blocking pointer events.
- **Removed "7d back · 1d ahead"**:
  - Deleted the raw badge from `AssignOperatorToMachineDialog.tsx`, `AssignMachineToOperatorDialog.tsx`, and `MobileAssignPersonnelModal.tsx`.
  - Removed `showWindowBadge` on `<CustomDatePicker>`.
- **Clean & Optimized Assignment Date Row**:
  - Re-architected container to `flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/40 p-2.5 sm:p-3`.
  - Icon in a crisp subtle tile, title + context pill (Past Correction / Tomorrow Plan), clean subtitle, "Today" quick button, and compact date picker trigger without awkward wrapping at 624×807.

### Verification
- `pnpm typecheck` across all 7 packages clean (0 errors).
- `node scripts/run-all-tests.mjs`: 33/33 monorepo test suites passed (100%).
- `node tests/operations/test-date-based-assignment.mjs`: 57/57 tests passed (100%).
- Live browser CDP verification at viewport 624×807: visually verified Assign Operator dialog, clean date row, hovered "Today · 21 Nov" tooltip, lock icons, and live footer preview. Zero horizontal overflow or layout breakage.

---

## Task: Employee Profile Detail (`/users/[id]`) — Feedback Resolution (Zero Duplication, Hero Redesign, Centered Copy & Streamlined Tabs)
**Status**: 🟢 COMPLETED & VERIFIED
**Date**: 2026-11-21

### Objectives (from page feedback on `/users/EMP-0471`)
1. Remove `<UserDetailClient>` paragraph "Employee Profile".
2. Align copy button inline in the email row instead of slightly bottom.
3. Align copy button inline in the phone row instead of slightly bottom.
4. Align copy icon inline in the number row instead of slightly bottom.
5. Align copy icon inline in the emp id row instead of slightly bottom.
6. Properly format avatar with other chips and info.
7. Remove quick contact cluster (mail/call/whatsapp icon buttons in hero).
8. Remove operational snapshot cards completely (don't just hide them).
9. Remove the tab strip search box completely.
10. Optimize hero card for mobile and desktop, eliminate empty space on mobile, well-format every info (avatar, emp id, role, machine category, status chip, shift time, join date, supervisor, etc.).
11. Eliminate duplicate info across the page; keep only one-time info on this page.
12. Remove "Back to Users" link and shift breadcrumb to the top-left position.

### Delivered
- [x] **Top Breadcrumb (Item 12)**: Removed "Back to Users" link with left arrow; shifted `<nav aria-label="Breadcrumb">` to the top-left, responsive across mobile and desktop.
- [x] **Hero Banner Card (Items 1, 6, 7, 10)**:
  - Removed "Employee Profile" uppercase paragraph.
  - Formatted Avatar (`h-13 w-13 sm:h-16 sm:w-16`, role-based gradient, crisp initials, active status pulse dot).
  - Grouped Full Name with EMP-ID mono badge (1-click copy + feedback), Role badge, Machine Category (operator), and Status badge (active/inactive).
  - Removed redundant quick contact cluster (mail, phone, whatsapp icons).
  - Added structured metadata strip (Shift Time, Joining Date, Supervisor, Location) in a 2-col (mobile) / 4-col (desktop) grid with icons.
  - Added mobile full-width primary `Edit Profile` button below metadata strip, eliminating all empty space on mobile devices.
  - Anchored desktop `Edit Profile` + 3-dot dropdown menu at top-right.
- [x] **Zero Duplicate Information (Item 11)**:
  - Hero card exclusively owns identity, badges, shift time, joining date, supervisor, and location.
  - Profile Details card now owns ONLY unique non-duplicate info divided into 3 equal columns (`md:grid-cols-3`):
    1. Contact Information: Email (with copy), Phone (with copy), WhatsApp ("Chat direct")
    2. Leave & Compensation: PL Leave Quota, Monthly Salary (if authorized), Supervised Operators link (if supervisor)
    3. Residential Address: Street Address, City / District, State
  - Removed duplicate Employee ID, Joining Date, Supervisor, Machine Category, and Shift Hours rows.
- [x] **Inline Centered Copy Buttons (Items 2, 3, 4, 5)**:
  - Upgraded `DetailRow` from `items-start` to `items-center` on both the row div and `<dd>`, with `inline-flex h-5 w-5 shrink-0 items-center justify-center` button.
  - Perfectly vertically centered copy buttons inline with text, completely resolving the "slightly bottom" misalignment.
- [x] **Operational Snapshot Removed (Item 8)**:
  - Completely deleted `<section aria-label="Operational snapshot">` and `snapshotTiles` definition.
- [x] **Tab Search Box Removed (Item 9)**:
  - Removed search box from sticky tab strip.
  - Tabs render clean counter pills and display all rows directly.

### Verification
- `apps/web` TypeScript check (`tsc --noEmit`): clean (0 errors).
- Turborepo monorepo typecheck (`pnpm typecheck`): 7/7 packages clean (0 errors).
- ESLint on `UserDetailClient.tsx`: 0 errors.
- Comprehensive test runner (`node scripts/run-all-tests.mjs`): 33/33 test suites passed cleanly (100%).

---

## Task: /operations Assign Dialog — Restored 7-Past / Today / Tomorrow Date Picker (Web + Native)
**Status**: 🟢 COMPLETED & VERIFIED
**Date**: 2026-11-21

### Objective (page feedback on `/operations`)
“While assigning I can't choose 7 days past from today and tomorrow date from the date picker.”

### Root cause
`TodayShiftMonitorTab` passed `allowDateSelection={false}` to the assign modal (a leftover from the previous “remove the picker” request), so the `/operations` dialog was hard-locked to today and rendered no date control at all — while the monitor could be viewing any historical date. Native already exposed the picker, so this was also a Web↔Native drift.

### Delivered
- [x] `initialAssignmentDate` prop added to `AssignOperatorToMachineDialog`, `AssignMachineToOperatorDialog` and `AssignPersonnelModal`, clamped into `[today−7, today+1]` with `resolveAssignmentDate()` (today when missing/out of window).
- [x] `/operations` passes `initialAssignmentDate={selectedDate}` and enables the picker: today, the last 7 days and tomorrow are all selectable; save button and toasts carry the chosen date.
- [x] Optimistic monitor patching guarded by the saved assignment date, so back-dated / tomorrow edits never rewrite the on-screen day.
- [x] Date section shows `7d back · 1d ahead`; an amber notice explains when the viewed day is outside the window and therefore clamps to today.
- [x] `CustomDatePicker` tooltips corrected (`Tomorrow / Today / Yesterday / N days ago`, window-aware disabled hints).
- [x] Native parity: `MobileAssignPersonnelModal` accepts `initialAssignmentDate`, `MobileTodayShiftMonitorTab` seeds it from `selectedDate`, caption states the window.
- [x] Tests updated to the new contract and live Dev-DB save/remove cycles executed for tomorrow and 7-days-ago (data restored).

### Verification
- `tests/operations/test-date-based-assignment.mjs` 57/57 · `scripts/run-all-tests.mjs` 33/33 suites · web `tsc` clean (my files; a concurrent user-profile edit leaves 20 `tabSearch` errors in `UserDetailClient.tsx`) · ESLint 0 errors · mobile `tsc` clean · `run-tests.mjs` 357/357 · typography 0 · touch/haptics pass · parity 95/95.
- Live browser: window is exactly 14→22 Nov 2026; tomorrow save → single-day `2026-11-22` row (today + machine mirror untouched); 7-days-ago save → single-day `2026-11-14` row; both removed afterwards.

### Follow-ups
- [ ] On-device Expo check of the native date section (typecheck + shared-contract tests only here).

---

## Task: Employee Profile Detail — KYC/Document Merge, Premium Layout & Audit Redesign (Web + Native)
**Status**: 🟢 COMPLETED & VERIFIED
**Date**: 2026-11-21

### Objectives (from page feedback on `/users/EMP-0322`)
1. Remove the three rounded stat cards (Aadhaar number / Driving Licence / Banking credentials) from the KYC tab.
2. In the same document card layout show the registered number **and** the document image, render thumbnails properly, and open the full document on click — for Aadhaar, licence, banking and every other document type.
3. Remove the "Search in documents…" control.
4. Make every block cleaner / better formatted / premium and optimise for mobile, tablet and desktop.
5. Make the audit trail more user-friendly, cleaner and properly placed at every breakpoint.

### Delivered — Web (`apps/web/app/(app)/users/[id]/UserDetailClient.tsx`, `loading.tsx`)
- **Removed** the three statutory value cards. Their data now lives inside the matching document card via `getTypedValueForDoc()` (masked by default, eye reveal audit-logged, copy button).
- **Document cards rebuilt**: 3:4 thumbnail (real `thumb_signed_url || signed_url` image, PDF/IMG fallback, hover zoom overlay, click = full `DocumentViewerModal`), status pill, `formatFileSize()` meta, registered-number block, View document + Review in approvals actions, replacement-document callout. `missingTypedDocuments` renders dashed "No scan" cards so a registered Aadhaar/licence/account never disappears when no file exists.
- **Documents search removed** (`showTabSearch` now excludes `documents` and `attendance`); the audit search remains because it filters rows.
- **Single-surface profile details**: four hairline-divided groups (Contact / Employment / Shift & Pay / Location) inside one card using the new `DetailRow` (truncate + tooltip for long email/street), plus a role-aware **operational snapshot** strip (Fleet/Operators · Running hours/Days worked · Documents).
- **Hero** restructured: status-dot avatar, mono eyebrow, stacked layout until `xl` (fixes 834 px name/id truncation), quick-contact cluster (mail/call/WhatsApp) on desktop.
- **Every tab panel** now uses a shared `Panel` shell (tinted icon tile + title + subtitle + actions + footer); machines/operators/logs/assignments/attendance got premium tables + touch cards, equal-height assignment cards, and the attendance deep link now uses the **current IST month** (was hard-coded `2026-09`).
- **Audit redesigned**: compact timeline rail with category glyphs, humanised actions, severity chips, actor initials, relative + absolute timestamps, expandable details key/value grid, and progressive disclosure (10 rows → "Show 15 more").
- Sticky, wrapping tab strip (`sticky top-12 md:top-0`) — all pills visible at 390/834/1536 px (no clipped pills), contextual search below `lg`.

### Delivered — Native parity (`apps/mobile/components/users/UserDetailView.tsx`)
- Statutory cards removed; registered numbers merged into each document card with reveal/copy; real scan thumbnails (tap → `MobileDocumentViewerModal`); dashed "No scan" cards; status-count header chips; document search hidden; `formatFileSizeMobile()`; obsolete statutory styles and dead icon imports removed.

### Verification
- `apps/web` `tsc --noEmit` clean; ESLint on both files **0 errors** (warnings reduced 27 → 20 by deleting dead icon imports); `next build` **succeeded**.
- `apps/mobile` `tsc --noEmit` clean; `node apps/mobile/run-tests.mjs` **357/357**; `scripts/check-typography.mjs` **0 violations**; `scripts/test-touch-haptics.mjs` pass; `scripts/test-parity-rules-and-skills.mjs` **95/95**; `apps/mobile/test/test-users-workflows.mjs` **42/42**.
- Live browser (Edge CDP, authenticated Dev session): `/users/EMP-0322` (supervisor), `/users/EMP-0002` (admin with image documents) and `/users/EMP-0338` (operator with logs/assignments/attendance) at **1536 / 834 / 390 px**, light + dark. Verified: image thumbnails render, viewer opens, audit details expand, sticky strip, zero horizontal overflow (`scrollWidth - clientWidth = -8`).

### Known follow-ups
- [ ] Native device/simulator visual confirmation of the reshaped KYC cards (React Native cannot be rendered in this environment; `tsc` + 357 mobile guard tests pass).
- [ ] `user_documents.file_size_bytes` is 0 for some legacy rows (shown as "Size n/a"); data heal is out of scope.

---

## Task: Assignment Window → 7 Past + Today + Tomorrow (Web + Native + DB)

### Scope
- Replace the `today .. today+7` assignment window with **7 past days + today + tomorrow** (9 dates, IST).
- Make back-dated roster edits safe (they must never disturb today/tomorrow).
- `/operations` feedback: remove the assignment-date picker and clean/optimise the assignment dialogs.

### Implementation Phases
- [x] Phase 1 — Shared contract: `ASSIGNMENT_DATE_WINDOW_PAST_DAYS = 7`, `ASSIGNMENT_DATE_WINDOW_FUTURE_DAYS = 1`, window `minDate/maxDate/pastDays/futureDays`, new `getAssignmentDateKind()`; unit tests rewritten (6/6).
- [x] Phase 2 — Migration 229 (applied to Dev): window enforcement in both dated RPCs, range-scoped past reads, past reconciliation truncate + re-open, `assignment.backfill_removed` audit, new `end_assignment_on_date_atomic(p_reopen_continuation)` with the 5-arg overload dropped.
- [x] Phase 3 — Web: actions/API resolve the new window and use the date-aware relief RPC; past dates resolved by range in `GET /api/machines/[id]/operators` and `getActiveOperatorMachineAssignments`.
- [x] Phase 4 — Web UI: compact date row with the 9-date picker on /machines; `allowDateSelection={false}` lock for /operations (no picker at all); dialog layout cleanup (equipment row, roster, dashed add row, footer border) and window-aware `CustomDatePicker` badges.
- [x] Phase 5 — Native: same window constants on both modals, `assignmentDate < today` → “Past Roster Updated” copy, `end_assignment_on_date_atomic` relief.
- [x] Phase 6 — Tests: `test-date-based-assignment.mjs` 55/55 (static + live Dev-DB back-dating/split/relief checks); cleanup hardened to only delete rows created during the run.
- [x] Phase 7 — Verification: `pnpm typecheck` 7/7, `run-all-tests.mjs` 33/33, ESLint 0 errors, typography/touch guards, live browser picker + past-save check.

### Follow-ups (require user decision)
- [ ] Apply migrations **228 + 229** to Production (`dhbbgfzbyatzvqafnsqp`) — blocked by policy until explicitly instructed.
- [ ] On-device Expo run of the native date section (typecheck + shared-contract tests only so far).
# Current Task

## Task: Past-Date Operator Shift Assignment Visibility & Persistence in Operations Monitor (Web + Native + DB)
**Status**: 🟢 COMPLETED & VERIFIED
**Date**: 2026-11-21

### Objectives (from page feedback on `/operations` at Viewport 1536×791)
1. When assigning an operator to a past date (e.g. 2026-11-19, "2d ago"), overwrite/save the roster changes cleanly in the database for that date.
2. Ensure the past-date assignment is fully working end-to-end.
3. Ensure the operations monitor and summary fetch and display the updated past-date assignment data directly from Supabase (showing the operator in Shift A instead of "Unassigned").

### Root Cause
- In `get_today_shift_log_monitor` and `get_today_shift_monitor_summary` (migrations 225 & 227), `assignments_on_date` included:
  ```sql
  AND NOT (
    oma.valid_from = oma.valid_to
    AND oma.is_active = false
    AND NOT EXISTS (SELECT 1 FROM logs lg WHERE lg.assignment_id = oma.id)
  )
  ```
- For past dates (`target_date < today_ist`), single-day assignments have `valid_from = valid_to = target_date`. Furthermore, trigger `trg_fn_sync_oma_valid_range` sets `is_active = false` on any assignment whose `valid_to < today_ist`. If the operator has not yet entered a log, `NOT EXISTS (logs)` evaluated to `true`.
- Because `p.target_date >= p.today_ist` was omitted from this guard, **every newly assigned past-date assignment without logs was completely excluded** from the monitor and summary CTEs, causing the monitor on past dates to return `Unassigned` instead of the newly assigned operator (`status: 'pending'`).

### Delivered
- **Database Migration 230 (`supabase/migrations/230_fix_past_date_shift_monitor_and_summary.sql`)**:
  - Scoped the exclusion guard in both `get_today_shift_log_monitor` and `get_today_shift_monitor_summary` to `p.target_date >= p.today_ist`.
  - Preserves the same-day relieved operator filter for today (`target_date >= today_ist`), while correctly including past single-day assignments as `status: 'pending'` before shift entry.
  - Automatically applied and verified on Development Supabase (`vlmxciuogczumumrwyot`). (Production DB `dhbbgfzbyatzvqafnsqp` left untouched per safety policy).
- **Web & Mobile Parity Synchronization**:
  - `apps/mobile/components/operations/MobileAssignPersonnelModal.tsx`: Updated `onSuccess` callback to pass `assignmentDate` upon successful save (`onSuccess(currentRosterSnapshot, assignmentDate)`).
  - `apps/mobile/components/operations/MobileTodayShiftMonitorTab.tsx`: Added date-switching or refetching upon save on a specific date (`if (savedDate && savedDate !== selectedDate) setSelectedDate(savedDate); else Promise.all([refetchSummary(), refetchInfinite()]);`).
  - `apps/web/components/operations/TodayShiftMonitorTab.tsx`: Retained date-matching optimistic monitor updates and verified soft background synchronization via `refreshRoster(false)`.

### Verification
- **Live Supabase Dev Query**: Executed `get_today_shift_log_monitor('e8f096b2...', '2026-11-19'::date)` on `M/C-0001`: returns `VAIBHAV CHAuhannn`, Shift `A`, `status: 'pending'`, `log_id: null`.
- **Live Supabase Summary Query**: Executed `get_today_shift_monitor_summary('e8f096b2...', '2026-11-19'::date)`: returns `pending: 7, unassigned: 0`.
- **TypeScript**: `pnpm --filter web typecheck` and `pnpm --filter mobile typecheck` 100% clean (0 errors).
- **Automated Tests**:
  - `node tests/operations/test-date-based-assignment.mjs`: 57/57 passed cleanly (100%).
  - `node apps/web/scripts/test-assignment-standardization.mjs`: 34/34 passed cleanly (100%).
  - `node scripts/run-all-tests.mjs`: 33/33 monorepo test suites passed cleanly (100%).

---

## Task: Operations Page Feedback — Date Picker Tooltips, Window Badge Removal & Layout Optimization (Web + Native)
**Status**: 🟢 COMPLETED & VERIFIED
**Date**: 2026-11-21

### Objectives (from page feedback on `/operations` at Viewport 624×807)
1. Add tooltips on `<CustomDatePicker>` day cells for: Today, Yesterday, 2 days ago to 7 days ago, Tomorrow, and Locked dates.
2. Remove `"7d back · 1d ahead"` chip from the Assignment Date row.
3. Clean and optimize the Assignment Date row layout for mobile and tablet viewports.

### Delivered — Web & Mobile Parity
- **CustomDatePicker Tooltips & Lock Indicators**:
  - Implemented floating real-time tooltips over each calendar cell with Geist dark contrast styling, type indicators (emerald for Today, indigo for Tomorrow, sky for Yesterday, amber for Past days, rose lock for Locked), day label, and formatted date (`Today · 21 Nov`, `Yesterday · 20 Nov`, `N days ago · <Date>`, `Tomorrow · 22 Nov`, `Locked · <Date>`).
  - Added micro lock icons (`Lock` size 8) on all disabled calendar cells.
  - Added live status preview in the calendar footer showing hovered/focused date and status reason (`Today · Current active date`, `Yesterday · 1 day ago`, `Tomorrow · Next day plan`, `Locked · >7d limit`).
  - Enabled full accessibility via `aria-disabled` and keyboard focus support without blocking pointer events.
- **Removed "7d back · 1d ahead"**:
  - Deleted the raw badge from `AssignOperatorToMachineDialog.tsx`, `AssignMachineToOperatorDialog.tsx`, and `MobileAssignPersonnelModal.tsx`.
  - Removed `showWindowBadge` on `<CustomDatePicker>`.
- **Clean & Optimized Assignment Date Row**:
  - Re-architected container to `flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)]/40 p-2.5 sm:p-3`.
  - Icon in a crisp subtle tile, title + context pill (Past Correction / Tomorrow Plan), clean subtitle, "Today" quick button, and compact date picker trigger without awkward wrapping at 624×807.

### Verification
- `pnpm typecheck` across all 7 packages clean (0 errors).
- `node scripts/run-all-tests.mjs`: 33/33 monorepo test suites passed (100%).
- `node tests/operations/test-date-based-assignment.mjs`: 57/57 tests passed (100%).
- Live browser CDP verification at viewport 624×807: visually verified Assign Operator dialog, clean date row, hovered "Today · 21 Nov" tooltip, lock icons, and live footer preview. Zero horizontal overflow or layout breakage.

---

## Task: Employee Profile Detail (`/users/[id]`) — Feedback Resolution (Zero Duplication, Hero Redesign, Centered Copy & Streamlined Tabs)
**Status**: 🟢 COMPLETED & VERIFIED
**Date**: 2026-11-21

### Objectives (from page feedback on `/users/EMP-0471`)
1. Remove `<UserDetailClient>` paragraph "Employee Profile".
2. Align copy button inline in the email row instead of slightly bottom.
3. Align copy button inline in the phone row instead of slightly bottom.
4. Align copy icon inline in the number row instead of slightly bottom.
5. Align copy icon inline in the emp id row instead of slightly bottom.
6. Properly format avatar with other chips and info.
7. Remove quick contact cluster (mail/call/whatsapp icon buttons in hero).
8. Remove operational snapshot cards completely (don't just hide them).
9. Remove the tab strip search box completely.
10. Optimize hero card for mobile and desktop, eliminate empty space on mobile, well-format every info (avatar, emp id, role, machine category, status chip, shift time, join date, supervisor, etc.).
11. Eliminate duplicate info across the page; keep only one-time info on this page.
12. Remove "Back to Users" link and shift breadcrumb to the top-left position.

### Delivered
- [x] **Top Breadcrumb (Item 12)**: Removed "Back to Users" link with left arrow; shifted `<nav aria-label="Breadcrumb">` to the top-left, responsive across mobile and desktop.
- [x] **Hero Banner Card (Items 1, 6, 7, 10)**:
  - Removed "Employee Profile" uppercase paragraph.
  - Formatted Avatar (`h-13 w-13 sm:h-16 sm:w-16`, role-based gradient, crisp initials, active status pulse dot).
  - Grouped Full Name with EMP-ID mono badge (1-click copy + feedback), Role badge, Machine Category (operator), and Status badge (active/inactive).
  - Removed redundant quick contact cluster (mail, phone, whatsapp icons).
  - Added structured metadata strip (Shift Time, Joining Date, Supervisor, Location) in a 2-col (mobile) / 4-col (desktop) grid with icons.
  - Added mobile full-width primary `Edit Profile` button below metadata strip, eliminating all empty space on mobile devices.
  - Anchored desktop `Edit Profile` + 3-dot dropdown menu at top-right.
- [x] **Zero Duplicate Information (Item 11)**:
  - Hero card exclusively owns identity, badges, shift time, joining date, supervisor, and location.
  - Profile Details card now owns ONLY unique non-duplicate info divided into 3 equal columns (`md:grid-cols-3`):
    1. Contact Information: Email (with copy), Phone (with copy), WhatsApp ("Chat direct")
    2. Leave & Compensation: PL Leave Quota, Monthly Salary (if authorized), Supervised Operators link (if supervisor)
    3. Residential Address: Street Address, City / District, State
  - Removed duplicate Employee ID, Joining Date, Supervisor, Machine Category, and Shift Hours rows.
- [x] **Inline Centered Copy Buttons (Items 2, 3, 4, 5)**:
  - Upgraded `DetailRow` from `items-start` to `items-center` on both the row div and `<dd>`, with `inline-flex h-5 w-5 shrink-0 items-center justify-center` button.
  - Perfectly vertically centered copy buttons inline with text, completely resolving the "slightly bottom" misalignment.
- [x] **Operational Snapshot Removed (Item 8)**:
  - Completely deleted `<section aria-label="Operational snapshot">` and `snapshotTiles` definition.
- [x] **Tab Search Box Removed (Item 9)**:
  - Removed search box from sticky tab strip.
  - Tabs render clean counter pills and display all rows directly.

### Verification
- `apps/web` TypeScript check (`tsc --noEmit`): clean (0 errors).
- Turborepo monorepo typecheck (`pnpm typecheck`): 7/7 packages clean (0 errors).
- ESLint on `UserDetailClient.tsx`: 0 errors.
- Comprehensive test runner (`node scripts/run-all-tests.mjs`): 33/33 test suites passed cleanly (100%).

---

## Task: Users Directory Card & Responsive Layout Refinement (Web + Native)
**Status**: 🟢 COMPLETED & VERIFIED
**Date**: 2026-11-21

### Objectives
Make `/users` clean, well-formatted and fully responsive on mobile, tablet and desktop, keeping every status/role chip visible while removing card clutter.

### Delivered
- [x] Web `MobileUserCard`: checkbox removed from the default card; **long press (450 ms)** enters multi-select (context menu suppressed, 12 ms haptic, click-after-long-press guarded, guard reset on pointerdown).
- [x] Identity chips on one row: employee ID (mono 10.5 px) · status pill · role pill.
- [x] City + state on one row; duplicate-city bug fixed (`locationSuffix` wrongly fell back to `locationLabel`).
- [x] Aadhaar + DL compliance footer pinned with `mt-auto` so equal-height grid cards align.
- [x] Cards below `lg` (1 → 2 cols at `sm`); table only `lg+` with progressive columns (core 6 → `xl +Supervisor` → `2xl +Machine/Location` → `min-[1900px] +KYC/Joined`) and capped name/email/supervisor widths (no horizontal scroll at 1024–1600 px).
- [x] KPI tiles responsive (2 cols until `lg`, `p-3 sm:p-3.5`, single-line labels, aligned values).
- [x] Shared `PageHeader` stacks actions below `lg` → no truncated page titles on tablets (verified on `/machines`).
- [x] Bulk bar compacted to one row above the mobile bottom nav with `Select All`/`Deselect`, icon-only exports on mobile.
- [x] Native parity: `UserTouchCard` identity chips row (EMP micro + status + role), city/state inline in one line, dead styles removed.

### Verification
- `apps/web` `tsc --noEmit` clean; ESLint on touched files: 0 errors; `apps/mobile` `tsc --noEmit` clean.
- `node test/test-users-workflows.mjs`: 42/42 · `scripts/check-typography.mjs`: 0 violations · `scripts/test-touch-haptics.mjs`: pass · `scripts/test-parity-rules-and-skills.mjs`: 95/95.
- Live browser: 390 / 820 / 1024 / 1280 / 1440 / 1600 px, light + dark, plus long-press selection, bulk bar, empty state and card→detail navigation.

### Known follow-ups
- [ ] Native device/simulator visual confirmation of the reshaped `UserTouchCard` (RN layout cannot be rendered in this environment).

---

## Task: Date-Based Operator-to-Machine Assignment (Today .. Today+7, IST)
**Status**: 🟢 COMPLETED & VERIFIED (Dev DB migrated; Production pending explicit user instruction)
**Date**: 2026-11-21

### Objectives
Make operator-to-machine assignment date-aware end-to-end (Web + Native + DB): a supervisor/admin must pick an assignment date (today .. today+7, IST), assigning on one date must never disturb today's roster or any other date, and duplicate/overlapping assignments must stay blocked.

### Root causes found during the audit
- `save_machine_roster_atomic` / `assign_operator_machine_atomic` hard-coded `valid_from = today_ist, valid_to = NULL`.
- Date-less partial unique index `idx_oma_machine_active_shift_code` on `(machine_id, lower(trim(shift_code))) WHERE is_active` made future single-day plans collide with today's carry-forward rows.
- Integrity triggers (`enforce_max_operators_per_machine`, `enforce_max_shifts_per_operator`, `sync_machine_assigned_operators`, `sync_operator_shift_ranges`) counted rows across all dates.
- No date input in either assignment dialog; all roster reads were date-less.
- Latent: `getActiveOperatorMachineAssignments` used an ambiguous `users!inner` embed (PGRST201) and always returned `[]`, disabling fleet-wide availability/overlap badges.

### Implementation Phases
- [x] Phase 1 — Migration `228_date_based_operator_assignment.sql`: date-aware RPCs (`p_assignment_date`), window enforcement (`DATE_OUT_OF_WINDOW`), single-day ranges for future dates, GiST machine+shift range exclusion, date-scoped triggers, `trg_cap_open_assignment_range`, date-scoped reconciliation + audit; legacy RPC wrappers kept for backward compatibility. Applied to Dev.
- [x] Phase 2 — Shared IST window helpers in `packages/utils/src/date.ts` (+ unit tests).
- [x] Phase 3 — Web: action/API/DAL date plumbing + required Assignment Date picker and future-plan UX in `AssignOperatorToMachineDialog`.
- [x] Phase 4 — Native parity: date-keyed modal data hook + `MobileAssignPersonnelModal` date section and save path.
- [x] Phase 5 — Fix `getActiveOperatorMachineAssignments` FK ambiguity (availability/conflict badges now real) and return 401 instead of 500 for unauthenticated API calls.
- [x] Phase 6 — Tests/verification: `test-date-based-assignment.mjs` 42/42 (11 live DB checks), assignment standardization 34/34, utils 55/55, `pnpm typecheck` 7/7, `run-all-tests.mjs` 33/33, live browser E2E on the Dev app.
- [x] Phase 7 — Dated-everywhere sweep: removed every date-less assignment write path (web resilient fallback + legacy roster branch, updateMachineOperatorsAction, assignments actions, native legacy fallback/raw inserts, native machine-modal deactivation), deleted the unused date-less mobile modal, added the Assignment Date section to the operator-fixed dialogs, and defaulted every entry point to today.
- [x] Phase 8 — Re-verification: 52/52 date-based checks (incl. valid today, rejected past/invalid dates, zero date-less RPC references), live API 200/400 matrix, live browser today assign+remove cycle with mirror verification, pnpm typecheck 7/7.

### Follow-ups (require user decision)
- [ ] Apply migration 228 to **Production** (`dhbbgfzbyatzvqafnsqp`) — blocked by policy until explicitly instructed.
- [ ] `operator_shift_ranges` remains intentionally date-less (materialises today-effective rows only); cross-date overlap for future plans is enforced by `oma_no_active_operator_shift_overlap` and the RPC `SHIFT_OVERLAP_CONFLICT` check.

---

## Task: Operations Module End-to-End Audit, Performance Optimization & Architecture Refactoring
**Status**: 🟢 COMPLETED & VERIFIED (Dev DB migrated; Production pending explicit user instruction)
**Date**: 2026-11-21

### Objectives
Audit and optimize the entire Web Operations module (Shift Management, Shift Entry & History, Daily Operations) for speed, scalability, reduced server/DB load and instant-feeling interactions — without changing established workflows or UI.

### Implementation Phases
- [x] Phase 0: Map the Operations module (page, monitor tab, entry client, history tab, DAL, actions, DB RPCs, indexes) and measure baselines with `EXPLAIN (ANALYZE, BUFFERS)` on the Development database.
- [x] Phase 1: Migration `227_optimize_operations_shift_monitor_queries.sql`
  - [x] Drop the stale pre-225 `get_today_shift_log_monitor(uuid,date,text,uuid)` overload that caused PostgREST 42725 "function is not unique" for any call omitting `p_shift_code`/`p_sort` (broke native `useTodayShiftMonitor`).
  - [x] Rewrite `get_today_shift_log_monitor`, `get_today_shift_monitor_summary`, `get_today_shift_log_monitor_paginated` (single planned statement each, RBAC scope resolved once, one log scan, equality joins, paginated delegates to canonical monitor).
  - [x] Add index `idx_mhl_logdate_machine_shift`.
- [x] Phase 2: Behavioural equivalence proof (48 monitor cases + 8 paginated/summary cases, 0 differences).
- [x] Phase 3: DAL `lib/data/operations/today-shift-monitor.ts` — removed the duplicate active-roster query + JS reconciliation, added tagged 10 s `unstable_cache` tier and `bypassCache` fast path.
- [x] Phase 4: `TodayShiftMonitorTab` — single fetch per date, request coalescing, in-memory search/filter/sort, visibility-gated polling, dead refs removed.
- [x] Phase 5: `OperatorEntryClient` — removed duplicate context fetch, single-run notification sync, session-scoped broadcast channel (leak fixed).
- [x] Phase 6: `OperatorHistoryTab` — 60 s per-operator session cache.
- [x] Phase 7: Backend cleanups — O(n) assignment stats, parallel assisted-entry authorization, dead code removal (`OperationsClient` dead dynamic import, `getClients()` payload on `/operations`, `getShiftTasks`).
- [x] Phase 8: Verify — `pnpm typecheck` 7/7 clean, ESLint 0 errors, `next build` passed (isolated dist dir), `node scripts/run-all-tests.mjs` 32/32 suites passed.

### Follow-ups (require user decision)
- [ ] Apply migration 227 to **Production** (`dhbbgfzbyatzvqafnsqp`) — blocked by policy until the user explicitly instructs.
- [ ] Optional: reduce the `running-logs` default page size (currently 500 rows per page) to a smaller server-side page.
