- **Feature: Machine Log Sequencing & Overlap Prevention across Frontend, Backend & PostgreSQL Database (`033_machine_log_sequencing_and_overlap_prevention.sql`, `operators.ts`, `OperatorDashboard.tsx`, `MeterLogModal.tsx`, `date.ts`, `hourMeter.ts`, `database.ts`) (2026-08-31)**:
  - **1. Database-Level Zero Overlap & Concurrency Enforcement (PostgreSQL GiST & Advisory Locks)**:
    - Applied Migration `033_machine_log_sequencing_and_overlap_prevention.sql` with `btree_gist` extension.
    - Added GiST exclusion constraint `machine_hour_logs_machine_timeline_overlap_excl` on `(machine_id WITH =, tstzrange(start_datetime, end_datetime, '[)') WITH &&)` allowing exact handovers `[start, end)` without collisions.
    - Added `start_datetime TIMESTAMPTZ`, `end_datetime TIMESTAMPTZ`, `end_date DATE` columns, with datetime order check constraint `end_datetime > start_datetime`.
    - Backfilled all existing records with timezone-aware `Asia/Kolkata` timestamps and overnight calendar day derivations.
    - Added transaction-level advisory locking `pg_advisory_xact_lock(hashtext('machine_log_' || NEW.machine_id::text))` to serialize concurrent operator submissions.
    - Enhanced triggers `trg_check_machine_hour_log_shift_overlap` and `trg_auto_calculate_machine_hour_log_overtime` with interval math.
    - Updated canonical RPC stored procedure `submit_operator_hour_log_atomic` to support `p_start_datetime`, `p_end_datetime`, `p_end_date`.
  - **2. Monorepo Shared Utilities & Validation**:
    - In `packages/types/src/database.ts`: Added `end_date`, `start_datetime`, `end_datetime` to `MachineHourLog`.
    - In `packages/validation/src/hourMeter.ts`: Added `end_date`, `start_datetime`, `end_datetime` to `CreateHourLogSchema`.
    - In `packages/utils/src/date.ts`: Added `findLatestMachineLogTimeline(logs, machineId)` and `checkIntervalOverlap(start1, end1, start2, end2)` supporting half-open `[start, end)` exact handovers.
  - **3. Backend Server Actions & DAL (`apps/web/`)**:
    - In `apps/web/lib/queries/operators.ts`: Updated `HOUR_LOG_PROJECTION` to select `end_date, start_datetime, end_datetime`.
    - In `apps/web/app/actions/operators.ts`: Refactored `checkShiftOverlapServer` to compare full timeline intervals across machine logs, and updated `submitOperatorHourLogAction` and `updateOperatorHourLogAction` to pass complete datetime parameters.
  - **4. Web Frontend UI/UX (`apps/web/components/dashboard/OperatorDashboard.tsx`)**:
    - Added **Machine Timeline Context Banner** in Section B (Shift Timing) displaying the latest log's end date/time and handover eligibility.
    - Added real-time sequencing validation rejecting starts preceding previous log end times, with a 1-click `"Align Start to HH:MM AM/PM (Handover)"` button.
    - Enhanced real-time client-side interval overlap warning.
    - Added timeline overlap validation to the Edit Correction modal.
  - **5. Mobile App Synchronization (`apps/mobile/components/work/MeterLogModal.tsx`)**:
    - Fetched recent machine timeline logs with `findLatestMachineLogTimeline`.
    - Added Machine Timeline Context Strip and sequencing error alert with 44px touch target `"Align Start to HH:MM AM/PM (Handover)"` button.
    - Submitted `start_datetime`, `end_datetime`, `end_date`, and `log_date` directly to database.
  - **6. Verification & Automated Test Suite**:
    - Ran live 10-scenario SQL automated test suite (`public.run_machine_log_overlap_test_suite()`) on Supabase: **10/10 tests PASSED with 100% success rate** (same-day shift, exact handover, overlap rejection, duplicate rejection, overnight shift, overnight overlap rejection, post-overnight handover, independent machine timelines, editing without overlap, overtime & working hours math).
    - `pnpm turbo run typecheck --force` passed with **9/9 packages successful (0 errors)**.
    - `pnpm --filter @reachinternational/web build` compiled all **35/35 Next.js App Router routes cleanly with code 0**.

- **Bug Fix: column "details" of relation "audit_logs" does not exist during machine hour log submission (`032_fix_audit_logs_metadata_and_atomic_rpc.sql`, `024_remove_fuel_status_and_fix_idempotency.sql`) (2026-08-31)**:
  - **1. Root Cause**:
    - The PostgreSQL stored procedure `public.submit_operator_hour_log_atomic` attempted to insert into `public.audit_logs (..., details, ...)` instead of `metadata`, triggering `column "details" of relation "audit_logs" does not exist` on log submissions.
    - Additionally, legacy overloaded signatures of `submit_operator_hour_log_atomic` remained in `pg_proc`.
  - **2. Supabase Migration & Database Remediation (`032_fix_audit_logs_metadata_and_atomic_rpc.sql`)**:
    - Dropped all legacy overloaded signatures of `submit_operator_hour_log_atomic`.
    - Added `details JSONB` column to `public.audit_logs` as backward-compatibility defense-in-depth.
    - Re-created canonical `submit_operator_hour_log_atomic` inserting into `metadata` (and `details`).
    - Applied live to Supabase project `dhbbgfzbyatzvqafnsqp` and verified execution with 0 errors.
  - **3. Verification**:
    - Verified function signature in `pg_proc` (exactly 1 canonical function).
    - Verified log submission transaction execution via PL/pgSQL test block.
    - `pnpm turbo run typecheck --force` passed with **9/9 packages successful (0 errors)**.

- **Page Feedback: /clients?tab=all — Add GSTIN, PAN, District, Conditional Billing Address, Remove Header Icon, Label Refinements & Auto-Scroll (`030_add_client_tax_and_billing_address_columns.sql`, `packages/types/src/database.ts`, `packages/validation/src/client.ts`, `apps/web/app/actions/clients.ts`, `apps/web/lib/queries/clients.ts`, `apps/web/components/clients/ClientModal.tsx`, `apps/web/components/clients/ClientsClient.tsx`, `apps/web/components/ui/Input.tsx`, `apps/mobile/app/(app)/clients.tsx`) (2026-08-31)**:
  - **1. Modal Header Icon Removal (Feedback #2)**: Removed the icon container from the `<ClientModal>` header, creating a clean, modern header with title and close action.
  - **2. GSTIN & PAN Tax Identifiers (Feedback #1)**:
    - Added `gstin VARCHAR(50)` and `pan_number VARCHAR(50)` columns to `public.clients` with partial B-Tree indexes.
    - Added auto-uppercasing inputs in both Web `<ClientModal>` and Mobile Add/Edit modal.
    - Displayed GSTIN and PAN badges in the desktop client directory table and mobile touch cards.
  - **3. District Field (Feedback #1)**:
    - Added `district VARCHAR(100)` column to `public.clients` with partial B-Tree index.
    - Added District input in primary Site Location section in both Web and Mobile client modals.
    - Displayed District alongside City and State in table rows and cards.
  - **4. Conditional Billing Address & Label Simplifications**:
    - Added `is_billing_address_different BOOLEAN NOT NULL DEFAULT FALSE` flag and separate billing address columns (`billing_address`, `billing_city`, `billing_district`, `billing_state`, `billing_pincode`) to `public.clients`.
    - Renamed Section 2 and textarea to **"Site Address"**.
    - Simplified Section 3 (Billing Address) sub-field labels to **"City"**, **"District"**, **"State"**, **"Pincode"**.
  - **5. Single Red Asterisk Deduplication & Auto-Scroll Visibility**:
    - Deduplicated trailing asterisks in `Input.tsx` when `required={true}` so only one clean red star displays.
    - Added smooth auto-scroll (`scrollIntoView`) upon activating the *"Different from Site Address"* toggle to bring the expanded inputs immediately into view.
  - **6. Cross-Platform Mobile App Synchronization**:
    - Synchronized `apps/mobile/app/(app)/clients.tsx` with GSTIN, PAN, District, Site Address, simplified Billing labels, and toggle switch.
  - **7. Verification**:
    - `pnpm turbo run typecheck --force` passed with **9/9 packages successful (0 errors)** in 16.7s.
    - `pnpm --filter @reachinternational/web build` compiled all **35/35 Next.js App Router routes cleanly with code 0**.
    - `pnpm --filter @reachinternational/mobile typecheck` passed with **0 errors**.

- **Page Feedback: /users — Add Eye Icon to View Complete User Details (`UserRow.tsx`, `users-client.tsx`, `UserDetailSheet.tsx`, `MobileUserCard.tsx`, `apps/mobile/app/(app)/users.tsx`, `ClientsClient.tsx`) (2026-08-31)**:
  - **1. Eye Icon Button in User Directory Table (`UserRow.tsx`, `users-client.tsx`)**:
    - Added dedicated Eye icon button `<AnimatedEye size={16} />` wrapped in `<TooltipWrapper content="View user details" side="top">` to the Actions column on every user row.
    - Added `"View User Details"` action at the top of the 3-dots actions dropdown menu with `AnimatedEye`.
    - Made the User Name cell clickable (`onClick={() => onViewDetails(user)}`) with hover link styling to instantly open user details.
    - Adjusted Actions column header width (`w-[84px] whitespace-nowrap text-right`) to comfortably accommodate both the eye icon and dropdown triggers.
  - **2. Comprehensive User Details Drawer Sheet (`UserDetailSheet.tsx`)**:
    - Refactored `UserDetailSheet` to show complete profile information: Account ID (UUID with copy), Email (with 1-click copy & mailto), Phone (with 1-click copy & tel), Location hierarchy (City, District, State, Deployment Site), Aadhaar Number (masked with eye reveal toggle & copy), Driving Licence (formatted with copy), Registration Date & relative time badge (`formatTimeAgo`), Role & Access Badge, Status Badge with pulse dot, and full administrative management controls.
  - **3. Mobile Touch Card Parity (`MobileUserCard.tsx`, `apps/mobile/app/(app)/users.tsx`)**:
    - Added `<AnimatedEye size={15} />` touch button to `<MobileUserCard>` header alongside status badge and tap-to-open card action.
    - Synchronized mobile app (`apps/mobile/app/(app)/users.tsx`) with an explicit `<Eye size={14} />` action button in the card header for full web-to-mobile parity.
  - **4. Verification**:
    - `pnpm turbo run typecheck --force` passed with **9/9 packages successful (0 errors)** in 26.2s.
    - `pnpm --filter @reachinternational/web build` compiled all **35/35 Next.js App Router routes cleanly with code 0**.
    - `pnpm --filter @reachinternational/mobile typecheck` passed with **0 errors**.

- **Bug Fix: Error fetching operator recent logs (`apps/web/lib/queries/operators.ts`, `reports.ts`, `machines.ts`, `MeterLogModal.tsx`, `operations.tsx`) (2026-08-31)**:
  - **Fixed Dropped Column Query in `HOUR_LOG_PROJECTION`**:
    - In `apps/web/lib/queries/operators.ts`, updated `HOUR_LOG_PROJECTION` to select `id, code, company_name, address, city, state, phone` from `clients` (replacing dropped `client_name` and `email` columns from Migration 029/031).
    - In `formatHourLogsData`, mapped `client_name: c.company_name || c.client_name || ""` for backwards compatibility with UI components.
  - **Synchronized All Client Joins Monorepo-wide**:
    - Updated `apps/web/lib/queries/reports.ts` to select `company_name` in machine hour logs join.
    - Updated `apps/web/lib/queries/machines.ts` to select `company_name` in `getMachineActiveRental`.
    - Updated `apps/mobile/components/work/MeterLogModal.tsx` and `apps/mobile/app/(app)/operations.tsx` to query `company_name` from `clients`.
  - **Verification**:
    - `pnpm turbo run typecheck --force` passed with **9/9 packages successful (0 errors)** in 36.82s.
    - `pnpm --filter @reachinternational/web build` compiled all **35/35 Next.js App Router routes cleanly with code 0**.
    - `pnpm --filter @reachinternational/mobile typecheck` passed with **0 errors**.

- **Page Feedback: /clients?tab=all — Streamline Client Management & Database Schema across Web, Mobile & Supabase (`029_streamline_clients_table.sql`, `packages/types/src/database.ts`, `packages/validation/src/client.ts`, `apps/web/app/actions/clients.ts`, `apps/web/lib/queries/clients.ts`, `apps/web/components/clients/ClientModal.tsx`, `apps/web/components/clients/ClientsClient.tsx`, `apps/mobile/app/(app)/clients.tsx`) (2026-08-31)**:
  - **1. Modal Header Subtitle Removal (Feedback #1)**: Removed description paragraph text from `<ClientModal>` header.
  - **2. Client Name Removed & Replaced by Company Name (Feedbacks #2, #3)**: Removed redundant "Client Name" field and designated "Company Name *" as the primary required identifier for client registration.
  - **3. Removed Unwanted Form Fields (Feedbacks #4, #5, #6, #7)**: Removed "Email Address", "GSTIN / Tax ID Number", "Account Status", and "Internal Remarks / Notes" from the modal. New accounts default to "active" status.
  - **4. Supabase Database Migration (`029_streamline_clients_table.sql`)**:
    - Wrapped migration in an idempotent `DO $$ BEGIN ... END $$;` block with dynamic SQL and `information_schema.columns` checks.
    - Backfilled `company_name` with `client_name` for existing records (preserving `"Saint Gobain"` with zero data loss).
    - Enforced `company_name NOT NULL` with non-empty check constraint `clients_company_name_not_empty`.
    - Created B-Tree index `idx_clients_company_name` and dropped obsolete `idx_clients_client_name`.
    - Dropped unwanted columns from `public.clients`: `client_name`, `email`, `gstin`, `notes`. Runs idempotently in any environment without 42703 column errors.
  - **5. Types & Zod Validation Packages**:
    - Updated `CRMClient` in `packages/types/src/database.ts` with required `company_name: string` and deprecated backward-compatibility alias `client_name`.
    - Updated `CreateClientSchema` & `UpdateClientSchema` in `packages/validation/src/client.ts` with required `companyName` and removed deprecated fields.
  - **6. Backend Server Actions & DAL**:
    - Updated `createClientAction` and `updateClientAction` in `apps/web/app/actions/clients.ts`.
    - Updated `CLIENT_SELECT_COLUMNS`, `getCachedClients`, and `getClientOptions` in `apps/web/lib/queries/clients.ts`.
  - **7. Web UI Standardization (`ClientsClient.tsx`, `ClientSelect.tsx`)**:
    - Updated table header ("Company Name", "Contact Person", "Phone", "City / State", "Status", "Actions").
    - Updated mobile touch cards to display Company Name, Contact Person, Phone, Location.
    - Updated search filter and delete confirmation dialog.
  - **8. Cross-Platform Mobile App Synchronization (`apps/mobile/app/(app)/clients.tsx`)**:
    - Synchronized mobile client modal, touch cards, state management, and search filter with the exact same streamlined Company Name schema.
  - **9. Verification**:
    - `pnpm turbo run typecheck --force` passed with **9/9 packages successful (0 errors)**.
    - `pnpm --filter @reachinternational/mobile typecheck` passed with **0 errors**.
- **Page Feedback: /operations?tab=entry — Remove Redundant Log Date Field & Standardize Red Stars on All Mandatory Form Fields (`CustomDatePicker.tsx`, `DateTimePicker.tsx`, `OperatorDashboard.tsx`, `MeterLogModal.tsx`) (2026-08-31)**:
  - **Removed Redundant Log Date Field (Feedback #1)**:
    - Removed `<CustomDatePicker>` container (`Log Date`) from Section A because shift start date is already selected in the unified `Start *` DateTimePicker in Section B.
    - Refactored Section A into a clean, balanced 2-column grid (`grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4`) with `Select Machine` (`MachineSelect`) and `Client Name` (`ClientSelect`).
    - Maintained automatic synchronization between `startDate` and `selectedLogDate`.
  - **Standardized Red Stars on All Mandatory Fields (Feedback #2)**:
    - Replaced all black asterisks (`*`) in form labels with red stars (`<span className="text-rose-500 font-bold ml-0.5">*</span>`) across all required inputs (`Starting Meter`, `Ending Meter`, `Start`, `End`, `Select Machine`, `Client Name`, `Breakdown Duration`, and Edit Modal).
  - **Verification**:
    - `pnpm turbo run typecheck --force` passed with **9/9 packages successful (0 errors)**.
    - `pnpm --filter @reachinternational/web build` compiled all **35/35 Next.js App Router routes cleanly with code 0**.
    - `pnpm --filter @reachinternational/mobile typecheck` passed with **0 errors**.

- **Page Feedback: /operations?tab=entry — Unified Date + Time Shift Timing & Overnight Shift Calculation (`packages/utils/src/date.ts`, `CustomDatePicker.tsx`, `DateTimePicker.tsx`, `OperatorDashboard.tsx`, `MeterLogModal.tsx`) (2026-08-31)**:
  - **Shared Shift Timing Calculation Helper (`packages/utils/src/date.ts`)**:
    - Implemented `computeShiftTiming({ startDate, startTime, endDate, endTime, manualOvertime })` returning `durationHours`, `durationMinutes`, `durationFormatted` (`10h 00m`), `isOvernight`, `overtimeHours`, `normalWorkingHours`, `breakHours`, `isValid`, and `errorMessage`.
    - Implemented `parseDateTimeToDate(dateStr, timeStr)` for reliable date/time string parsing.
  - **CustomDatePicker Future Days Extension (`CustomDatePicker.tsx`)**:
    - Added `allowFutureDays?: number` property. Enabled `allowFutureDays={1}` on Shift End Date picker so tomorrow can be selected for overnight shifts.
    - Added dynamic `"Tomorrow"` relative badge (`bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20`) when `diffDays === -1`.
  - **Composite DateTimePicker Primitive (`DateTimePicker.tsx`)**:
    - Upgraded composite picker supporting custom labels, touch-friendly min 44px targets, `maxDaysOld`, `allowFutureDays`, and icon colors.
  - **Web Operator Dashboard (`apps/web/components/dashboard/OperatorDashboard.tsx`)**:
    - Replaced individual time pickers with two composite `<DateTimePicker>` inputs for **Start \*** and **End \***.
    - Added dynamic shift status pill (`🌙 Overnight shift · 10h 00m` / `☀️ Day shift · 8h 00m`) with live working time and overtime summary.
    - Automatic auto-advance to next day when PM start and AM end time are entered on the same day.
    - Added validation strip with 1-click `"Set End Date to Next Day (Overnight Shift)"` recovery button when `endDateTime <= startDateTime`.
    - Updated `shiftOverlapWarning` with timestamp comparison to prevent overlapping machine operating logs across day boundaries.
    - Updated draft auto-save and edit modal with Start & End Date + Time.
  - **Mobile Synchronization (`apps/mobile/components/work/MeterLogModal.tsx`)**:
    - Synchronized mobile meter log modal with `computeShiftTiming`, start/end dates, dynamic overnight badge pill (`🌙 Overnight · Xh Ym`), and strict validation.
  - **Verification**:
    - `pnpm turbo run typecheck --force` passed with **9/9 packages successful (0 errors)** in 37.54s.
    - `pnpm --filter @reachinternational/web build` compiled all **35/35 Next.js App Router routes cleanly with code 0**.
    - `pnpm --filter @reachinternational/mobile typecheck` passed with **0 errors**.

- **Page Feedback: /users — Show Tiny Time Elapsed for Pending User Approval Requests (`packages/utils/src/date.ts`, `apps/web/app/(app)/users/users-client.tsx`, `apps/mobile/app/(app)/users.tsx`) (2026-08-31)**:
  - **Shared Tiny Relative Time Utility (`packages/utils/src/date.ts`)**:
    - Implemented `formatTinyRelativeTime(dateInput)` supporting ultra-compact time intervals: `< 1min` -> `"1min"`, `< 60m` -> `"${diffMin}min"`, `< 24h` -> `"${diffHour}h"`, `< 30d` -> `"${diffDay}d"`, `< 12mo` -> `"${diffMonth}m"`, `≥ 1y` -> `"${diffYear}y"`.
  - **Web Pending User Cards (`apps/web/app/(app)/users/users-client.tsx`)**:
    - Rendered `<Clock size={11} className="text-amber-600 dark:text-amber-400" />` alongside `<span className="font-mono">{formatTinyRelativeTime(pUser.created_at)}</span>` in an amber chip badge next to the requested role badge on each pending approval card inside `#pending-approvals-section`.
    - Added informative hover tooltip (`title={`Request sent: ${formatDateTime(pUser.created_at)} (${formatTimeAgo(pUser.created_at)})`}`).
  - **Web-to-Mobile Synchronization (`apps/mobile/app/(app)/users.tsx`)**:
    - Synchronized mobile pending user approval cards with matching tiny time chip and clock icon (`<Clock size={9} color={theme.colors.warning} />` and `formatTinyRelativeTime(p.created_at)`).
  - **Verification**:
    - `pnpm turbo run typecheck --force` passed with **9/9 packages successful (0 errors)** in 47.1s.
    - `pnpm --filter @reachinternational/web build` compiled all **35/35 Next.js App Router routes cleanly with code 0**.
    - `pnpm --filter @reachinternational/mobile typecheck` passed with **0 errors**.

- **Page Feedback: /signup — Visual & Fleet Showcase Panel Parity with Sign In Page (`signup/page.tsx`, `login/page.tsx`) (2026-08-31)**:
  - **Left Showcase Panel Parity (Feedback #1)**:
    - Replaced the dark background image / overlay structure (`signup_bg.png`) on `/signup` with the identical clean visual & industrial fleet showcase panel from the sign-in page (`/login`).
    - Standardized the left panel width to `lg:w-[40%]`, elevated canvas background `bg-[var(--color-canvas-elevated)]`, hairline border `border-r border-[var(--color-hairline)]`, atmospheric Reach Blue radial glow, canonical logo `<ReachInternationalLogo variant="full" size={28} />`, hero typography (*"Manage your fleet. Track every hour."*), ground shadow pedestal, and the industrial boom lift fleet asset (`/loginpageimage.png`).
    - Adjusted the right registration workspace to `lg:w-[60%]` with responsive vertical spacing and smooth scrolling.
  - **Verification**:
    - `pnpm turbo run typecheck --force` passed with **9/9 packages successful (0 errors)**.
    - `pnpm --filter @reachinternational/web build` compiled all **35/35 routes cleanly with code 0**.

- **Page Feedback: /operations?tab=entry — Operator Dashboard Layout Refinement & Breakdown Standardization (`OperatorDashboard.tsx`, `MachineSelect.tsx`, `ClientSelect.tsx`, `OperationsClient.tsx`, `operator-logs-export.ts`, `supervisor-logs-export.ts`, `PrintableOperatorLogsModal.tsx`, `PrintableSupervisorLogsModal.tsx`, `mobile/operations.tsx`) (2026-08-31)**:
  - **1. Section A Layout Simplification (Feedbacks #1, #2, #3, #5)**:
    - Removed redundant Serial Number input container `div` from Section A (as `<MachineSelect>` already includes serial number and machine code).
    - Renamed `"Model *"` label to `"Select Machine"` in `<MachineSelect>` and `OperatorDashboard.tsx`. Updated default placeholder to `"Search or select machine..."`.
    - Removed redundant `"Client Site Location *"` input container `div` from Section A.
    - Renamed `"Client / Customer Name *"` to `"Client Name"` in `<ClientSelect>` and `OperatorDashboard.tsx`.
    - Streamlined Section A into a clean, balanced 3-column responsive grid: `Log Date` (`CustomDatePicker`), `Select Machine` (`MachineSelect`), and `Client Name` (`ClientSelect`).
  - **2. ClientSelect Header Cleanup (Feedback #4)**:
    - Removed redundant client code badge (`"CLI-0001"`) from `<label>` in `ClientSelect.tsx`.
  - **3. Breakdown Column Value Standardization (Feedback #6)**:
    - Standardized Breakdown display when machine operated normally: now displays `0` (or `0` mono badge) instead of text `"Normal"` / `"🟢 Normal"`.
    - Synchronized across Operator Dashboard table & mobile cards (`OperatorDashboard.tsx`), submit confirmation modal (`🟢 Normal (0 breakdown hours)`), Operations Client supervisor table and mobile cards (`OperationsClient.tsx`), Excel exports (`operator-logs-export.ts`, `supervisor-logs-export.ts`), printable/PDF modals (`PrintableOperatorLogsModal.tsx`, `PrintableSupervisorLogsModal.tsx`), and Mobile App (`apps/mobile/app/(app)/operations.tsx`).
  - **4. Verification**:
    - `pnpm turbo run typecheck --force` passed with **9/9 packages successful (0 errors)**.
    - `pnpm --filter @reachinternational/web build` compiled all **35/35 routes cleanly with code 0**.
- **Page Consistency: /signup & /login (Sign In) — Input Box & Reusable Component Consistency (`login-form.tsx`, `signup/page.tsx`, `login/page.tsx`, `Input.tsx`) (2026-08-31)**:
  - **Eliminated Duplicate & Inconsistent Input Markup**:
    - Replaced all 11 raw hardcoded input boxes in `signup/page.tsx` and 2 raw inputs in `login-form.tsx` with canonical centralized `<Input>` components from `@/components/ui`.
    - Standardized uniform input heights to `h-[42px] sm:h-[44px] min-h-[42px] sm:min-h-[44px]`, corner radius `rounded-lg` (8px), background `bg-[var(--color-canvas)]`, font size `text-xs sm:text-[13px] font-medium`, hairline border with hover transitions, Reach Sky Blue focus ring (`focus:border-sky-500 dark:focus:border-sky-400 focus:ring-2 focus:ring-sky-500/15`), centered icons (`left-3 sm:left-3.5 top-1/2 -translate-y-1/2` with left padding `pl-9.5 sm:pl-10`), and password visibility toggle with cursor pointer across all fields on both pages.
  - **Deduplicated Alert & Feedback Components**:
    - Replaced manual custom alert boxes with canonical `<Alert>` (`variant="error"` and `variant="success"`) from `@/components/ui` across `/login` and `/signup`.
  - **Centralized Design Tokens**:
    - Replaced hardcoded hex colors (`#111314`, `#151718`, `#F5F7F8`, `#969CA3`, `#26292C`, `#292C2F`, `#00AEEF`) with standard CSS variables (`bg-[var(--color-canvas-elevated)]`, `bg-[var(--color-canvas)]`, `text-[var(--color-ink)]`, `text-[var(--color-mute)]`, `border-[var(--color-hairline)]`, `text-sky-600 dark:text-sky-400`).
  - **Verification**:
    - `pnpm --filter @reachinternational/web typecheck` passed with **0 errors**.
    - `pnpm --filter @reachinternational/web build` compiled all **35/35 routes cleanly with code 0**.

- **ReachInternational Centralized UI Design System & Reusable Component Architecture (`apps/web/components/ui/`, `apps/mobile/components/ui/`, `packages/design-tokens`) (2026-08-31)**:
  - **1. Centralized Buttons (`Button.tsx`, `IconButton.tsx`)**:
    - Enhanced canonical `<Button>` supporting all variants (`primary`, `secondary`, `outline`, `ghost`, `danger`, `destructive`, `success`, `link`, `primary-sm`, `ghost-sm`, `danger-sm`, `success-sm`), sizes (`sm`, `md`, `lg`, `icon`), `fullWidth`, `responsive` / `mobileIconOnly` (auto icon collapse on ≤640px), loading spinner `<AnimatedLoader>`, polymorphic `<Link>` href, and accessibility focus rings.
    - Created `<IconButton>` dedicated primitive with built-in `<TooltipWrapper>` and accessible `aria-label`.
  - **2. Standardized Form Components (`Input.tsx`, `PasswordInput.tsx`, `NumberInput.tsx`, `Textarea.tsx`, `Select.tsx`, `MultiSelect.tsx`, `Checkbox.tsx`, `Radio.tsx`, `Switch.tsx`, `FormField.tsx`)**:
    - Created `<PasswordInput>` with animated eye toggle and lock icon.
    - Created `<NumberInput>` with stepper buttons (`+` / `-`), min/max limits, step intervals, and prefix/suffix support.
    - Created `<Textarea>` with label, error, hint, resize control, and optional character counter.
    - Created `<MultiSelect>` with searchable options, tag chips preview, select all, clear all, and active checkmarks.
    - Created `<Checkbox>` with animated checkmark and indeterminate state support.
    - Created `<Radio>` & `<RadioGroup>` with context management and subtitles.
    - Created `<Switch>` with spring physics, label, and description.
    - Created `<FormField>`, `<Label>`, `<HelperText>`, `<ErrorMessage>` layout primitives.
  - **3. Centralized Date & Time Components (`CustomDatePicker.tsx`, `DatePicker.tsx`, `DateRangePicker.tsx`, `CustomTimePicker.tsx`, `TimePicker.tsx`, `DateTimePicker.tsx`)**:
    - Exported canonical `<DatePicker>` and `<TimePicker>` aliases.
    - Created `<DateRangePicker>` with quick preset period pills (`Today`, `Yesterday`, `Last 7 Days`, `Last 30 Days`, `This Month`, `Custom`) and start/end calendar inputs.
    - Created composite `<DateTimePicker>` combining DatePicker and TimePicker in a responsive 2-column interface.
  - **4. Centralized Search & Filtering (`SearchBox.tsx`, `FilterToolbar.tsx`, `FilterDropdown.tsx`, `SortControl.tsx`, `FilterChips.tsx`)**:
    - Created `<SearchBox>` with search icon, clear button, keyboard shortcut indicator (`/` or `⌘K`), and loading spinner.
    - Created canonical `<FilterDropdown>` with dot indicators, active checkmarks, and smart edge alignment (`left` / `right`).
    - Created `<SortControl>` combining sort dropdown with ascending/descending toggle.
    - Created `<FilterChips>` with active filter badge tags and 1-click "Clear All" reset.
  - **5. Centralized Tables & Data Display (`Table.tsx`, `EnterpriseTable.tsx`, `DataTable.tsx`, `Pagination.tsx`)**:
    - Created `<DataTable>` unifying `<EnterpriseTable>` for desktop (≥1024px) with automated mobile touch cards reflow (`block sm:hidden`).
    - Upgraded `<Pagination>` with page size selector (`10`, `25`, `50`, `100` rows per page), first/last page jumps (`«` / `»`), and responsive styling.
  - **6. Centralized Export System (`ExportButton.tsx`, `ExportDropdown.tsx`)**:
    - Created canonical `<ExportButton>` supporting Excel (`.xlsx`), CSV (`.csv`), PDF (`.pdf`), and Print actions with tooltips and mobile icon-only responsiveness.
    - Created `<ExportDropdown>` offering multi-format export actions in a single menu.
  - **7. Centralized Dialogs, Feedback & Layout (`Alert.tsx`, `Drawer.tsx`, `Tabs.tsx`, `Breadcrumb.tsx`, `Container.tsx`, `index.ts`)**:
    - Created `<Alert>` banner component (`info`, `success`, `warning`, `error`, `neutral`).
    - Created `<Drawer>` slide-over component with spring animation and backdrop blur.
    - Created `<Tabs>` supporting segmented category pills and underline tabs with URL synchronization.
    - Created `<Breadcrumb>` standalone component with home link and chevron separators.
    - Created `<PageContainer>`, `<Section>`, `<Stack>`, `<Grid>` layout primitives.
    - Consolidated all 28+ UI primitives into `apps/web/components/ui/index.ts` as the single source of truth.
  - **8. Page Migrations**:
    - Migrated `/machines` (`MachineListClient.tsx`) and `/users` (`users-client.tsx`) to consume `<ExportButton>` and centralized UI primitives.
  - **9. Verification**:
    - `pnpm --filter @reachinternational/web typecheck` passed with **0 errors**.
    - `pnpm --filter @reachinternational/web build` compiled all **35/35 routes cleanly with code 0**.
    - `pnpm --filter @reachinternational/mobile typecheck` passed with **0 errors**.

- **Page Feedback: /signup — Site-Wide Input Box, Dropdown Selection & Button Standardization across All Pages & Tabs (`Input.tsx`, `globals.css`, `SearchableSelect.tsx`, `Select.tsx`, `ClientSelect.tsx`, `MachineSelect.tsx`, `UserSelect.tsx`, `Button.tsx`, `ClientModal.tsx`, `signup/page.tsx`) (2026-08-31)**:
  - **Standardized Input Box Ergonomics (Feedback #1)**:
    - Updated `Input.tsx` to standardize input boxes across all pages and modals matching the `/signup` design tokens: height `h-[42px] sm:h-[44px] min-h-[42px] sm:min-h-[44px]`, corner radius `rounded-lg`, background `bg-[var(--color-canvas)]`, font size `text-xs sm:text-[13px] font-medium`, hairline border with hover transitions, Reach Sky Blue focus ring (`focus:border-sky-500 dark:focus:border-sky-400 focus:ring-2 focus:ring-sky-500/15`), centered icons (`left-3 sm:left-3.5 top-1/2 -translate-y-1/2` with left padding `pl-9.5 sm:pl-10`), and password visibility toggle with cursor pointer.
    - Updated `.input-base` in `globals.css` with matching height, 8px radius, hover states, and focus ring.
  - **Standardized Dropdown Selection Ergonomics (Feedback #2)**:
    - Standardized trigger button height (`h-[42px] sm:h-[44px] min-h-[42px] sm:min-h-[44px]`, or `compact ? "h-[38px] min-h-[38px] py-1.5"`), `rounded-lg` radius, font size `text-xs sm:text-[13px] font-medium`, hairline border with dark/light hover transitions, open ring state `border-sky-500 ring-2 ring-sky-500/15`, and smooth rotating chevron across `<SearchableSelect>`, `<Select>`, `<ClientSelect>`, `<MachineSelect>`, and `<UserSelect>`.
  - **Standardized Button Styling & Ergonomics (Feedback #3)**:
    - Standardized `<Button>` size classes (`sm` = `h-8 sm:h-8.5 rounded-lg`, `md` = `h-9 sm:h-9.5 rounded-lg`, `lg` = `h-11 sm:h-11.5 rounded-lg`) and primary variant style with `bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white shadow-xs font-semibold active:scale-[0.98]`.
    - Integrated canonical `<Button>` on `/signup` submit CTA and replaced raw modal inputs with canonical `<Input>` in `ClientModal.tsx`.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful (0 errors)** in 16.9s; `pnpm --filter @reachinternational/web build` compiled all **35/35 routes cleanly with code 0 and 0 warnings**.

- **Page Feedback: /machines — Assigned Client in Cards, Badge Removal & Top-Right Header Actions Alignment (`MobileMachineCard.tsx`, `PageHeader.tsx`, `MachineListClient.tsx`, `MachineRow.tsx`, `apps/mobile/app/(app)/machines.tsx`, `MachineDetailModal.tsx`) (2026-08-31)**:
  - **Replaced Service Count with Assigned Client (Feedback #1)**: Replaced the obsolete "Service Count" parameter on `<MobileMachineCard>` and desktop table `<MachineRow>` / `tableColumns` with "Assigned Client:" showing the customer/company name (`machine.customer_name`, e.g. Saint Gobain, HAL) or "—" when unassigned. Synchronized mobile app (`apps/mobile/app/(app)/machines.tsx` and `MachineDetailModal.tsx`).
  - **Removed Total Badge from PageHeader (Feedback #2)**: Removed the `1 Total` badge pill from the `<PageHeader>` on `/machines`.
  - **Aligned Actions to Top Right on Mobile (Feedback #3)**: Enhanced `<PageHeader>` and `<HeaderMoreMenu>` with flexbox alignment (`flex items-center justify-between w-full flex-nowrap`) and compact touch triggers so the Excel export icon, More (`⋮`) button, and `Add Machine` (`+`) CTA remain seamlessly on the top right in the exact same horizontal row as the "Machine Directory" title on mobile viewports (e.g. 412×915).
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful (0 errors)** in 24.3s.

- **Page Feedback: /machines/[id] — Mobile & Desktop UI/UX, Typography, Header Actions, Scorecard Grid Removal, Basic Info & Assigned Client Details Optimization (`machine-client-view.tsx`) (2026-08-31)**:
  - **Breadcrumb & Header Polish (Feedback #1, #2, #3, #4, #5, #17)**: Removed `"REACH INTERNATIONAL Fleet Portal"` text from top breadcrumbs; removed `<RefreshButton>`; converted Edit Machine button to responsive icon-only mode on mobile viewports (`responsive` prop); removed `"Log Service"` button from the hero banner; replaced wrench icon in machine avatar with canonical Reach scissor lift icon `<ScissorLiftLogoIcon size={24} className="text-sky-400" />`; removed `.mt-4 pt-3.5 border-t` quick actions from the hero banner.
  - **Removed Scorecard Metrics Grid (Feedback #6, #7, #8, #9)**: Removed the entire 4-card scorecard metrics grid (Health %, Hour Meter, Next Service, Service Interval) from below the hero card.
  - **Tab 1: Basic Info Card Refinement (Feedback #10, #11, #12, #13)**: Renamed title from `"Machine Master Parameters & Specifications"` to `"Basic Info"`; removed subtitle paragraph text; removed wrench icon from heading; optimized status badges for compact mobile rendering.
  - **Tab 1: Properly Assigned Client Details Section (Feedback #14, #15)**: Integrated comprehensive Assigned Client Details card with Company Name, Client Code badge (`CLI-0001`), Contact Person, click-to-call mobile phone link, email mailto link, City & State, GSTIN, Site Location address with 1-click copy button, rental contract timeline and rate (if active), and quick action touch buttons (Call, WhatsApp, Map Location); removed redundant separate Assigned Engineer card.
  - **Mobile Responsiveness & Design System Ergonomics (Feedback #16)**: Standardized responsive padding (`px-2 sm:px-4 md:px-6`), scrollable tab strip (`overflow-x-auto`), high-density parameter grid, and touch-friendly controls.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful (0 errors)** in 19.1s.

- **Page Feedback: /machines — Mobile & Desktop UI/UX, Typography, Input Ergonomics, Filter Toolbar & View Toggle Removal on Mobile (`MachineListClient.tsx`, `MobileMachineCard.tsx`, `MachineModal.tsx`) (2026-08-31)**:
  - **Removed View Toggle on Mobile**: Concealed the View Switcher (Auto View / Cards / Table segmented control) on mobile viewports (`hidden sm:flex`) in `<FilterToolbar>`'s `actions` slot, resolving the unwanted mobile button toggle. Mobile devices automatically render optimized touch cards (`MobileMachineCard`).
  - **Canonical PageHeader Integration**: Integrated `<PageHeader>` with responsive typography (`text-xl sm:text-2xl md:text-[32px]`), breadcrumbs (`Machines`), live total badge (`X Total`), icon-only Excel export button (`h-9 w-9 p-0` with `<TooltipWrapper>`), and primary `Add Machine` CTA (`h-9 px-3.5 sm:px-4 text-xs font-semibold`).
  - **KPI Metrics Cards Grid**: Refined 2-column mobile grid (`grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5`) with Framer Motion tactile tap scale (`whileTap={{ scale: 0.98 }}`), `<AnimatedCounter>` value transitions, and high-contrast status highlights.
  - **Multi-Dimensional Custom Dropdown Filters & Search**: Implemented `<CustomFilterSelector>` responsive dropdowns with smart edge alignment (`align="left"` / `align="right"`), dot indicators, and checkmarks for Rental Status, Health Status, Supervisor, and Sort By; added active filter badge strip with dismissible `X` chips and a 1-click `"Clear All"` reset.
  - **MobileMachineCard Polish**: Added dynamic left accent indicator stripe based on health status (`breakdown` = rose, `under_maintenance` = amber, `active` = emerald/sky), top hover sheen, 1-click Machine ID copy button with animated check, formatted specs inset well, and touch-friendly action buttons.
  - **MachineModal Input Ergonomics**: Standardized modal input heights (`h-[42px] sm:h-[40px]`), section cards with animated icons, 2-column responsive layout (`grid-cols-1 sm:grid-cols-2`), and mobile-friendly submit/cancel action buttons.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful (0 errors)** in 28.7s; `pnpm --filter @reachinternational/web build` compiled all **35/35 routes cleanly with code 0**.

- **Page Feedback: /login — Mobile & Desktop Optimization & /signup Text Removal (`login/page.tsx`, `login-form.tsx`, `signup/page.tsx`) (2026-08-31)**:
  - **Removed Signup Subtitle**: Removed the subtitle paragraph text (`"Fill in your details to request enterprise platform access."`) from the card header in `apps/web/app/signup/page.tsx` as requested.
  - **Login Outer Container & Viewport Flow**: Configured `min-h-screen min-h-[100dvh]` with unified root scroll container on mobile/tablet viewports and `lg:h-screen lg:overflow-hidden` on desktop (≥1024px) in `apps/web/app/login/page.tsx`, eliminating layout squishing or viewport clipping on mobile devices (e.g. 412x915).
  - **Login Card Container Ergonomics**: Standardized card container in `apps/web/app/login/login-form.tsx` with `rounded-2xl`, responsive padding (`p-5 sm:p-7 md:p-8`), and max-width `max-w-md sm:max-w-[480px] lg:max-w-[500px]`.
  - **Input Box Height, Padding & Icon Sizing**: Standardized input heights to `h-[42px] sm:h-[48px]`, left padding `pl-10`, right padding `pr-3.5 sm:pr-4` (and `pr-10 sm:pr-11` for password), `rounded-lg sm:rounded-[9px]`, 15px animated icons, and eye toggle button with cursor pointer.
  - **Typography & Controls**: Polished header typography (`text-xl sm:text-2xl md:text-[26px]`), field labels (`text-[12px] sm:text-[13px] font-medium`), error/success alert banners, primary submit button (`h-11 sm:h-11.5`), and card/legal footers.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful (0 errors)** in 44.4s; `pnpm --filter @reachinternational/web build` compiled all **35/35 routes cleanly with code 0**.

- **Page Feedback: /signup — Mobile & Desktop UI/UX, Typography, Input Ergonomics & Layout Optimization (`signup/page.tsx`, `SearchableSelect.tsx`) (2026-08-31)**:
  - **Outer Shell & Viewport Flow**: Configured `min-h-screen min-h-[100dvh]` with unified root scroll container on mobile/tablet viewports and `lg:h-screen lg:overflow-hidden` on desktop, eliminating viewport clipping and nested scrollbars on mobile devices (e.g. 412x915).
  - **Mobile Brand Header**: Removed redundant `Enterprise Fleet Platform` badge from mobile header, displaying a clean centered `<ReachInternationalLogo variant="full" size={26} />` matching `/login`.
  - **Card Container Ergonomics**: Standardized card container with `rounded-2xl`, responsive padding (`p-4 sm:p-6 lg:p-6.5`), and max width `max-w-xl lg:max-w-2xl`.
  - **Input Box Height, Padding & Icon Sizing**: Standardized uniform input heights to `h-[42px] sm:h-[44px]` across all 11 fields; standardized left icon padding to `pl-9.5 sm:pl-10` with icons centered at `left-3 sm:left-3.5` (size 15px/16px); enhanced City/District/State 3-column responsive grid (`grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3`) with proper icon spacing; added `triggerClassName` support in `<SearchableSelect>` for seamless role dropdown integration.
  - **Typography & Spacing**: Polished header hierarchy (`text-xl sm:text-2xl`), field labels (`text-[12px] sm:text-[13px] font-medium`), error notices, approval note callout, primary CTA button (`h-11 sm:h-11.5`), and card/legal footers.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful (0 errors)** in 58.4s; `pnpm --filter @reachinternational/web build` compiled all **35/35 routes cleanly with code 0**.

- **Page Feedback: /login — Remove Enterprise Fleet Platform Badge from Mobile Header (`login-form.tsx`) (2026-08-31)**:
  - **Removed Redundant Mobile Badge**: Removed the `.inline-flex` badge element (`Enterprise Fleet Platform` with pulsing emerald dot) from the mobile header of `<LoginFormClient>` in `apps/web/app/login/login-form.tsx`, leaving a clean, balanced brand logo presentation.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful (0 errors)** in 22.6s.

- **Page Feedback: /login — Button Label Standardization & Arrow Removal (`login-form.tsx`, `apps/mobile/app/(auth)/login.tsx`) (2026-08-31)**:
  - **Button Label Refinement**: Changed primary submit button label from `"Sign in to Reach Fleet"` to `"Sign in"` in `apps/web/app/login/login-form.tsx`.
  - **Removed Trailing Arrow from Footer**: Removed the `"→"` arrow span from the `"Request access"` signup link in the card footer of `login-form.tsx`.
  - **Web-to-Mobile Synchronization**: Synchronized `apps/mobile/app/(auth)/login.tsx` by updating the primary action button to `"Sign in"` (from `"Sign in to Reach Fleet"`) and removing the arrow from `"Request Access →"` to `"Request Access"`.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful (0 errors)** in 25.05s.

- **Page Feedback: /operations?tab=entry — Universal Searchable Dropdowns for Machine, Client & User across all Pages (`MachineSelect.tsx`, `ClientSelect.tsx`, `UserSelect.tsx`, `SearchableSelect.tsx`, `OperatorDashboard.tsx`, `OperationsClient.tsx`, `MachineComplaintModal.tsx`, `MachineModal.tsx`, `PartIssueModal.tsx`, `PurchaseRequestModal.tsx`, `ClientModal.tsx`) (2026-08-31)**:
  - **Canonical UI Dropdown Primitives (`apps/web/components/ui/`)**:
    - `MachineSelect.tsx`: High-density searchable dropdown with Model name, Machine Code badge (`bg-sky-500/10 text-sky-600 font-mono`), Serial number subtitle, real-time search across model/name/code/serial/engine/manufacturer/city, clear button, active checkmarks, and `allowAll` support.
    - `ClientSelect.tsx`: High-density searchable dropdown with Client Name, Client Code badge (`CLI-0001`), location pin subtitle (`📍 Location`), real-time search across name/company/code/city/state/address, clear button, active checkmarks, and `allowAll` support.
    - `UserSelect.tsx`: High-density searchable dropdown with User Full Name, role badge pill, email/phone subtitle, real-time search across name/role/phone/email/city, role filter support, and active checkmarks.
    - `SearchableSelect.tsx`: Upgraded generic dropdown with modern Geist design system tokens, search box with clear button, and active checkmarks.
    - `index.ts`: Exported all select primitives and their TypeScript prop types.
  - **Replaced Dropdowns Across All Pages & Modals**:
    - **Operator Dashboard (`OperatorDashboard.tsx`)**: Replaced manual dropdown markup in Section A with `<MachineSelect>` and `<ClientSelect>`.
    - **Operations Client (`OperationsClient.tsx`)**: Replaced log filter toolbar with `<ClientSelect>`, `<MachineSelect>`, `<UserSelect>`, and `<SearchableSelect>`. Replaced modal dropdowns for Assign Operator, Site Movement, and Salary Payout.
    - **Complaints (`MachineComplaintModal.tsx`)**: Replaced machine selector with `<MachineSelect>` and service engineer selector with `<UserSelect>`.
    - **Machines (`MachineModal.tsx`)**: Replaced supervisor and operator selectors with `<UserSelect>`.
    - **Inventory (`PartIssueModal.tsx`, `PurchaseRequestModal.tsx`)**: Replaced target machine with `<MachineSelect>`, manager selector with `<UserSelect>`, and branch/priority/part selectors with `<SearchableSelect>`.
    - **CRM (`ClientModal.tsx`)**: Replaced account status selector with `<SearchableSelect>`.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful (0 errors)**; `pnpm --filter @reachinternational/web build` compiled all **35/35 routes cleanly with code 0**.

- **Database Schema & Architecture: Relational Indian Locations Hierarchy with Official Government Codes (`030_create_relational_locations_hierarchy.sql`, `packages/types/src/database.ts`, `apps/web/lib/queries/locations.ts`, `apps/web/app/actions/locations.ts`) (2026-08-31)**:
  - **Created 5 Normalized Relational Hierarchy Tables with Official Government IDs (`030_create_relational_locations_hierarchy.sql`)**:
    - `public.states`: `id SMALLINT PRIMARY KEY`, `name TEXT NOT NULL` (36 States & UTs with official LGD codes `1` to `38`).
    - `public.districts`: `id SMALLINT PRIMARY KEY`, `state_id SMALLINT NOT NULL REFERENCES states(id)`, `name TEXT NOT NULL` (784 administrative districts with official LGD codes `1` to `784`).
    - `public.cities`: `id INTEGER PRIMARY KEY`, `district_id SMALLINT NOT NULL REFERENCES districts(id)`, `name TEXT NOT NULL` (466 Municipal Corporations & Statutory Cities with official Census location codes `800001+`).
    - `public.towns`: `id INTEGER PRIMARY KEY`, `district_id SMALLINT NOT NULL REFERENCES districts(id)`, `name TEXT NOT NULL` (15,081 Municipal Councils, Nagar Panchayats, Census Towns, and Tehsils).
    - `public.villages`: `id INTEGER PRIMARY KEY`, `district_id SMALLINT NOT NULL REFERENCES districts(id)`, `name TEXT NOT NULL` (640,787 Revenue Villages with official 6-digit Census codes `1` to `641904`).
  - **Performance Optimization & Indexing**:
    - Foreign key indexes: `idx_districts_state_id`, `idx_cities_district_id`, `idx_towns_district_id`, `idx_villages_district_id`.
    - Name & Trigram indexes: `idx_states_name`, `idx_districts_name`, `idx_cities_name`, `idx_towns_name`, `idx_villages_name`, `idx_districts_name_trgm`, `idx_cities_name_trgm`, `idx_towns_name_trgm`.
  - **Security & RLS**:
    - Enabled RLS on all 5 tables with public SELECT policies and admin-only mutation policies.
  - **Live Seeding in Supabase PostgreSQL (`dhbbgfzbyatzvqafnsqp`)**:
    - Seeded: **36 States, 784 Districts, 466 Cities, 15,081 Towns, and 640,787 Villages**.
  - **Types, DAL & Server Actions**:
    - Exported `State`, `District`, `City`, `Town`, `Village` in `packages/types/src/database.ts`.
    - Implemented DAL query helpers and Server Actions in `apps/web/lib/queries/locations.ts` and `apps/web/app/actions/locations.ts`.
  - **Verification**: Monorepo typecheck passed (`9/9 packages successful, 0 errors`).
  - **Extracted & Cleaned 4 Official Datasets (`supabase/Indian_location data/`)**:
    - Processed LGD State Directory (36 States & UTs with official English/Local names, LGD & Census codes).
    - Processed LGD District Directory (784 Administrative Districts with LGD codes and state mapping).
    - Processed Census 2011 Town & Village Directory (15,331+ Statutory Cities, Municipal Corporations, Municipal Councils, Nagar Panchayats, Cantonments, Outgrowths, Census Towns, and Sub-District/Tehsil/Taluka centres).
  - **Relational Tables & Fast Lookup Architecture (`029_create_comprehensive_master_location.sql`)**:
    - `public.master_states`: 36 States/UTs with LGD and Census codes.
    - `public.master_districts`: 784 Districts with unique constraint `(state_name, district_name)`.
    - `public.master_cities`: 15,331 Cities/Towns/Tehsils with unique constraint `(state_name, district_name, city_name, town_code)`.
    - `public.master_location`: Unified composite search table with generated column `search_text` (`city_town || ', ' || district || ', ' || state`) containing 15,331 records.
  - **Performance Optimization & Indexing**:
    - Enabled `pg_trgm` PostgreSQL extension.
    - Added compound B-Tree indexes for cascading dropdown queries (State → District → City, execution time: **0.235 ms**).
    - Added GIN Trigram index on `search_text` for instant fuzzy autocomplete (execution time: **2.705 ms**).
  - **Security & RLS**:
    - Configured public read RLS policies and admin-only mutation policies across all 4 tables.
  - **Data Ingestion & Live Supabase Seeding**:
    - Applied migration `029_create_comprehensive_master_location.sql` to Supabase project `dhbbgfzbyatzvqafnsqp`.
    - Seeded all 36 States/UTs, 784 Districts, and 15,331 Cities/Towns/Tehsils into Supabase PostgreSQL.
  - **DAL & Shared Types**:
    - Exported `MasterState`, `MasterDistrict`, `MasterCity`, and `MasterLocation` in `packages/types/src/database.ts`.
    - Built cached DAL in `apps/web/lib/queries/locations.ts` (`getStatesList`, `getDistrictsList`, `getCitiesList`, `searchLocations`).
    - Created Server Actions in `apps/web/app/actions/locations.ts`.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful (0 errors)**.

- **Bugfix: Resolve React 19 Script Tag Warning & Logo Hydration Parity (`ThemeScript.tsx`, `ThemeProvider.tsx`, `ScissorLiftLogoIcon.tsx`) (2026-08-31)**:
  - **React 19 Inline Script Console Error Suppression (`ThemeScript.tsx`, `ThemeProvider.tsx`)**: In React 19 / Next.js 16, inline theme initialization scripts rendered in `<head>` during SSR are flagged with a false-positive development warning (`"Encountered a script tag while rendering React component"`). Added development-mode console filter guards in `ThemeScript.tsx` and `ThemeProvider.tsx` to eliminate console noise while preserving blocking zero-flicker dark/light theme initialization.
  - **SVG Geometry Parity & Hydration Safeguard (`ScissorLiftLogoIcon.tsx`)**: Added `suppressHydrationWarning` on the root `<svg>` element to eliminate hydration warnings from hot-reloaded dev client bundles.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful** (0 errors in 22.3s); `pnpm --filter @reachinternational/web build` compiled all **35/35 routes cleanly with code 0**.

- **Page Feedback: /machines — Show Client Management to Manager and Above Roles (`AppSidebar.tsx`, `proxy.ts`, `CommandPalette.tsx`, `ClientsClient.tsx`, `ClientModal.tsx`, `apps/mobile/lib/nav/navItems.ts`) (2026-08-31)**:
  - **Show Client Management in Sidebar (`AppSidebar.tsx`)**: Added `Clients` nav item to `mainNavItems` with icon `AnimatedBuilding2`, roles `["super_admin", "admin", "manager", "service_manager"]`, and subItem `Client Directory` (`tab: "all"`).
  - **Enabled Route in Auth Proxy (`proxy.ts`)**: Moved `"/clients"` from `deprecatedRoutes` to `activeProtectedRoutes` so direct navigation and sidebar links load `/clients` cleanly without redirecting to `/machines`.
  - **Command Palette & Quick Actions (`CommandPalette.tsx`)**: Added `nav-clients` ("Go to Client Directory", `⌘C`) and `action-add-client` ("Add New Client") for `super_admin`, `admin`, `manager`, and `service_manager`.
  - **Mobile Navigation Parity (`apps/mobile/lib/nav/navItems.ts`)**: Added `Clients` item with `Building2` icon and authorized roles `['super_admin', 'admin', 'manager', 'service_manager']` to `mobileNavItems`.
  - **UI/UX & Design Tokens Polish (`ClientsClient.tsx`, `ClientModal.tsx`)**: Standardized page layout with canonical `<PageHeader>`, KPI cards, table container, mobile touch cards, and confirmation modal dialogs with canonical Geist design system tokens.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful** (0 errors in 24.2s); `pnpm --filter @reachinternational/web build` compiled all **35/35 routes cleanly with code 0**.

- **Page Feedback: /users?tab=all — Comprehensive & Optimized Multi-Dimensional Filter Selectors (`users-client.tsx`, `apps/mobile/app/(app)/users.tsx`) (2026-08-31)**:
  - **Comprehensive Multi-Dimensional Filter Suite**: Added 6 fully functional filter selectors inside `<FilterToolbar>` on `/users?tab=all`:
    - **Role**: All Roles, Engineers, Service Managers, Managers, Supervisors, Operators, Mechanics, Store Managers, HR Managers, Admins, Super Admins.
    - **Status**: All Status, Active, Inactive, Pending.
    - **Region / State**: Dynamic extraction from `usersList` sorted alphabetically (e.g. Maharashtra, Gujarat, Delhi, Karnataka, etc.) + All Regions.
    - **KYC / Verification**: All KYC Status, Fully Verified (Aadhaar + DL), Aadhaar Provided, Driving Licence Provided, Pending KYC.
    - **Joined Date**: All Time, Today, Last 7 Days, Last 30 Days, Last 90 Days, This Year.
    - **Sort By**: Newest Joined (default), Oldest Joined, Name (A → Z), Name (Z → A), Role (A → Z).
  - **Active Filter Chips & 1-Click Clear**: Added dismissible active filter badge tags with `X` button and `"Clear All"` reset trigger for instant feedback and selective filter removal.
  - **Responsive 3-Tier Viewport Design**: 2-column grid on mobile (`grid grid-cols-2 gap-2 w-full`) with alternating `align="left"` and `align="right"` edge clamping; flex-wrap on desktop/tablet (`sm:flex sm:flex-wrap items-center gap-2 sm:gap-2.5 w-full`).
  - **High-Performance Filter & Search Pipeline**: Single-pass `useMemo` computation with `useDeferredValue` for search across 10 user attributes with zero UI lag.
  - **Web-to-Mobile Synchronization**: Synchronized mobile user list filters (Active, Pending, Inactive, Roles) and extended multi-field search in `apps/mobile/app/(app)/users.tsx`.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful** (0 errors in 24.2s); `pnpm --filter @reachinternational/web build` compiled all **35/35 routes cleanly with code 0**.

- **Sidebar Logo Icon Polish: Remove Up Arrow from ScissorLiftLogoIcon (`ScissorLiftLogoIcon.tsx`) (2026-08-31)**:
  - **Removed Up Arrow Graphic**: Removed the upward height indicator arrow paths (`<g className={accentClassName}>`) from `<ScissorLiftLogoIcon>`, creating a clean, focused industrial lifting platform icon.
  - **Horizontal Centering & Perfect Geometry**: Shifted the scissor lift vector coordinates by +4px to center the structure symmetrically at `x = 50` on the 100×100 canvas (equal 14px left/right platform margins, centered scissor pivots and wheels).
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful** (0 errors in 32.3s).

- **Page Feedback: /users?tab=all — Smooth Filter Transition & Search Box View Switcher Alignment (`FilterToolbar.tsx`, `users-client.tsx`) (2026-08-31)**:
  - **Smooth & Optimized Filter Open/Close Transition**: Eliminated layout snaps/jumps in `<FilterToolbar>` by removing `space-y-3` from parent wrapper and placing top margin/padding inside `<motion.div>` with calibrated cubic-bezier easing (`[0.16, 1, 0.3, 1]`) and GPU acceleration (`willChange`).
  - **Aligned View Switcher with Search Box**: Moved View Switcher (`Auto View` / `Cards` / `Table`) from `<PageHeader>` into `<FilterToolbar>`'s `actions` slot, aligning it cleanly alongside the search input.
  - **Mobile Concealment**: Maintained `hidden sm:flex` so the View Switcher is hidden on mobile devices (≤640px) where touch cards are used natively.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful** (0 errors in 26.5s); `pnpm --filter @reachinternational/web build` compiled all 35 Next.js App Router routes cleanly with code 0.

- **Page Feedback: /users?tab=all — Responsive Custom Dropdown Filter Selectors for Mobile & Desktop (`users-client.tsx`) (2026-08-31)**:
  - **Responsive Layout Across Viewports**: Standardized on unified `<CustomFilterSelector>` dropdowns for Role and Status across Mobile (≤640px), Tablet (641px–1023px), and Desktop (≥1024px) viewports.
  - **Mobile 50/50 Single Row**: Positioned both selectors side-by-side in a single row on mobile (`flex items-center gap-2 w-full`) with `flex-1 min-w-0` equal width distribution.
  - **Smart Popover Edge Alignment**: Added `align="left"` for Role (anchored to left edge `left-0`) and `align="right"` for Status (anchored to right edge `right-0 sm:right-auto sm:left-0`), preventing any horizontal overflow off mobile screens.
  - **Desktop Compact Sizing**: Formatted desktop selectors to clean fixed widths (`sm:w-60` for Role, `sm:w-48` for Status) aligned compactly at the start of the toolbar with zero horizontal overflow.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful** (0 errors in 15.3s).

- **Page Feedback: /users?tab=all — Fix CustomFilterSelector Role & Status Selection and FilterToolbar Default State (`FilterToolbar.tsx`, `users-client.tsx`) (2026-08-31)**:
  - **Dynamic Overflow Transition in FilterToolbar**: Resolved parent overflow clipping by tracking animation state in `FilterToolbar.tsx` (`isAnimating`), allowing height clipping during transition and setting `overflow-visible` when open so dropdown menus float unhindered above all content.
  - **CustomFilterSelector Enhancements**: Elevated container `z-index` to `z-40` when open, added touch events (`touchstart`), pointer events, and keyboard (`Escape`) dismissal handlers, with comfortable touch targets and instant filter updates.
  - **Default Closed Filter Toolbar**: Verified `defaultOpen = false` guarantees the filter toolbar remains closed by default on initial page load and reset.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful** (0 errors in 25.9s); `pnpm --filter @reachinternational/web build` compiled all 35 Next.js App Router routes cleanly with code 0.

- **Page Feedback: /users?tab=all — Shift Role Label to Bottom Right & Single-Row Custom Filter Selectors (`MobileUserCard.tsx`, `users-client.tsx`) (2026-08-31)**:
  - **Shifted Role Badge to Bottom Right**: Moved the role pill badge in `MobileUserCard.tsx` from the header to the bottom right of the card next to metadata lines, enhancing layout balance and visual clarity.
  - **Single Horizontal Row Filters**: Placed Role and Status selectors side-by-side in a single row on mobile viewports (`sm:hidden flex items-center gap-2 w-full`).
  - **Custom Filter Selectors**: Implemented `CustomFilterSelector` with custom button triggers, role color dot indicators, Framer Motion animated floating popover menus, checkmarks on active items, and click-outside dismissal.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful** (0 errors in 25.6s).

- **Page Feedback: /users?tab=all — Mobile Typography, Touch Controls, Dropdown Filters & MobileUserCard Polish (`PageHeader.tsx`, `users-client.tsx`, `MobileUserCard.tsx`) (2026-08-31)**:
  - **Responsive Header Typography**: Scaled `PageHeader` title (`text-xl sm:text-2xl md:text-[32px]`) for natural mobile rendering on compact displays (`412px`).
  - **Mobile Pending Action Buttons**: Upgraded Approve and Reject buttons to full-width 50/50 flex-1 touch targets (`h-9 sm:h-8`) with active tap scale.
  - **Removed Redundant Floating FAB**: Removed fixed bottom-right floating "Invite User" button in favor of the header CTA.
  - **Mobile Vertical Dropdown Filters**: Added vertical `<select>` dropdowns for Role and Status on mobile (`sm:hidden`), keeping animated horizontal pill strips on desktop (`hidden sm:flex`).
  - **Polished `MobileUserCard` UI/UX**: Removed role icon from avatar, removed 3-dot menu button, removed standalone call/email buttons, and refined card into an ultra-clean, high-density touch card with tap-to-open indicator chevron.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful** (0 errors in 23.7s).

- **Page Feedback: /users?tab=all — Smooth FilterToolbar Open & Close Transition (`FilterToolbar.tsx`) (2026-08-31)**:
  - **Smooth Accordion Transition Physics**: Re-engineered `<FilterToolbar>` with a calibrated cubic-bezier deceleration curve (`[0.16, 1, 0.3, 1]`), decoupled outer height-clipping container and inner content padding/border container with nested `y: -6` to `y: 0` slide-fade, and smooth chevron rotation (`duration-300 ease-out`), removing all layout pops and jumpiness.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful** (0 errors in 35.2s).

- **Page Feedback: /users?tab=all — Icon-Only Excel Export Button in Header (`users-client.tsx`) (2026-08-31)**:
  - **Icon-Only Excel Export Button**: Converted the Export button in the page header actions to an icon-only square button (`h-9 w-9 p-0`) displaying only the green Excel `<FileSpreadsheet>` icon, paired with a rich tooltip (`<TooltipWrapper content="Export user directory to Excel (.xlsx)">`).
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful** (0 errors in 39.8s).

- **Page Feedback: /users?tab=all — Header Polish, Tooltip & Parallel Batch Accept/Reject Actions (`users-client.tsx`, `apps/web/app/actions/users.ts`, `apps/mobile/app/(app)/users.tsx`) (2026-08-31)**:
  - **Removed Refresh Button**: Removed `<RefreshButton>` from PageHeader actions.
  - **Polished Export Button**: Wrapped with `<TooltipWrapper content="Export user directory to Excel (.xlsx)">` and configured proper icon and styling.
  - **Renamed Add CTA**: Changed button label from "Add Employee / User" to "Add User" with responsive label handling.
  - **Parallel Accept All & Reject All Batch Actions**:
    - Created `bulkApproveUsers(userIds)` & `bulkRejectUsers(userIds)` in `apps/web/app/actions/users.ts` with parallel background promises (`Promise.allSettled`), atomic updates, batch employee directory sync, background email dispatch, and audit logging.
    - Added "Accept All (N)" and "Reject All" action buttons to `#pending-approvals-section` header with optimistic UI state transitions and `<ConfirmationDialog>` security modal for bulk rejection.
    - Synchronized mobile Pending Approvals section with "Accept All (N)" and "Reject All" batch buttons in `apps/mobile/app/(app)/users.tsx`.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful** (0 errors in 37.6s); Next.js web build compiled cleanly.

- **Page Feedback: /users?tab=all — Remove Icons from Pending Approvals Buttons & Role Badges (`users-client.tsx`, `apps/mobile/app/(app)/users.tsx`) (2026-08-31)**:
  - **Removed Icons from Action Buttons**: Removed `<Check>` icon from Approve button and `<X>` icon from Reject button in `#pending-approvals-section`, creating clean text-only action buttons across Web and Mobile.
  - **Removed Icons from Role Badges**: Removed all role-specific icons (`AnimatedActivity`, `AnimatedWrench`, `AnimatedBuilding2`, etc.) from `getPendingRoleBadge`, displaying clean text role status badges matching the table row standard in `UserRow.tsx`.
  - **Purged Unused Icon Imports**: Removed unreferenced animated icon imports from `users-client.tsx`.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful** (0 errors in 1m14s); `pnpm --filter @reachinternational/web build` compiled all 35 routes cleanly.

- **Page Feedback: /users?tab=all — Polish UI/UX, Transitions & Animations for Pending User Approvals (`users-client.tsx`, `apps/mobile/app/(app)/users.tsx`) (2026-08-31)**:
  - **Pending Approvals Container Shell (`#pending-approvals-section`)**:
    - Upgraded outer card container to high-elevation surface with subtle ambient amber gradient wash, 16px radius (`rounded-2xl`), 1px border (`border-amber-500/25`), and warm top highlight hairline glow.
    - Added glowing amber shield icon badge with animated pulsing radar dot.
    - Added clear title hierarchy with descriptive subtitle (*"Review and authorize registration requests before granting system access"*).
    - Added live badge counter with pulsing amber status dot (`X Pending`).
  - **Pending User Cards & Framer Motion Physics (`<motion.div>`)**:
    - Implemented spring physics (`type: "spring", stiffness: 380, damping: 28`) for smooth entrance, exit, and dynamic grid reflow (`layout` prop).
    - Added physical hover lift (`whileHover={{ y: -2 }}`), top sheen illumination, and shadow transitions.
    - Added left indicator accent stripe (`border-l-[3px] border-l-amber-500 dark:border-l-amber-400`).
    - Multi-tone initials avatar with role-themed gradient background (`getRoleAvatarStyle`) and live pulsing "Awaiting Approval" amber pip.
    - Formatted user details: Bold full name, role badge with icon (`getPendingRoleBadge`), Email with Mail icon, Phone with Phone icon, and City/State with MapPin icon.
    - Modernized action buttons: Emerald Approve button (`variant="success-sm"`) with scaling check icon (`group-hover/btn:scale-110`) and loading state; refined secondary danger Reject button with rotating X icon (`group-hover/btn:rotate-90`) and loading state.
  - **Cross-Platform Mobile Synchronization (`apps/mobile/app/(app)/users.tsx`)**:
    - Synchronized mobile Pending Approvals section with matching amber accent styling, badge counters, role chips, formatted contact metadata with icons (Mail, Phone, MapPin), and touch-friendly Approve/Reject buttons for 100% cross-platform parity.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful** (0 errors in 1m16s); `pnpm --filter @reachinternational/web build` compiled all 35 Next.js App Router routes cleanly with code 0.

- **Page Feedback: /machines — Canonical Reusable & Responsive Primary Button & Site-Wide Black Button Replacement (`Button.tsx`, `globals.css`, `colors.ts`, `MachineListClient.tsx`, `users-client.tsx`, `login-form.tsx`, `signup/page.tsx`, `ClientsClient.tsx`, `ClientModal.tsx`) (2026-08-30)**:
  - **Canonical Reusable & Responsive `<Button>` Component (`apps/web/components/ui/Button.tsx`, `index.ts`)**:
    - Upgraded `<Button>` component to faithfully embody the Reach Sky Blue primary button style from the "Add Machine" button on `/machines`.
    - Implemented full variant suite (`primary`, `primary-sm`, `secondary`, `ghost-sm`, `danger`, `danger-sm`, `success`, `success-sm`, `outline`, `ghost`).
    - Built responsive 3-tier mobile behavior (`responsive` / `mobileIconOnly`): on mobile screens (≤640px), when an icon is provided with a text label, `<Button>` automatically conceals the text label (`<span className="hidden sm:inline">...</span>`) while preserving 100% full click functionality and touch-friendly padding (`w-8 sm:w-auto px-0 sm:px-3` or `w-9 sm:w-auto px-0 sm:px-4`), expanding to full text on desktop/tablet.
    - Integrated loading spinner `<AnimatedLoader />` and polymorphic Next.js `<Link>` support via `href`.
  - **Design Tokens & Global CSS Alignment (`packages/design-tokens`, `globals.css`)**:
    - Updated `packages/design-tokens/src/tokens/colors.ts`: Set `primary: '#0284c7'` (light) / `primary: '#0ea5e9'` (dark) and `onPrimary: '#ffffff'`.
    - Updated `apps/web/app/globals.css`: Replaced `.btn-primary` and `.btn-primary-sm` black/ink styles with Sky Blue primary styles.
  - **Site-Wide Black Button Replacement**:
    - Replaced all black CTA/action buttons across `/machines` (`MachineListClient.tsx`), `/users` (`users-client.tsx`, `UserCreateModal.tsx`, `UserEditModal.tsx`), `/login` (`login-form.tsx`), `/signup` (`signup/page.tsx`), `/clients` (`ClientsClient.tsx`, `ClientModal.tsx`), `/dashboard` (`MechanicDashboard.tsx`), Quick Actions (`GlobalCreateModal.tsx`), Notifications (`NotificationRow.tsx`), and Error Boundaries (`error.tsx`) with the unified Sky Blue Button component.
  - **Cross-Platform Mobile Synchronization (`apps/mobile`)**:
    - Verified mobile primary buttons consume updated Reach Sky Blue design tokens for complete cross-platform parity.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful** (0 errors in 54.5s); `pnpm --filter @reachinternational/web build` compiled all 35 Next.js App Router routes cleanly with code 0.

- **Page Feedback: /operations?tab=entry — Dropdown Calendar Only, Remove Inline Matrix & Popover Strip, Mobile Responsiveness (`CustomDatePicker.tsx`, `OperatorDashboard.tsx`) (2026-08-30)**:
  - **Refactored CustomDatePicker (`apps/web/components/ui/CustomDatePicker.tsx`)**:
    - Removed inline 8-day card matrix grid from the page.
    - Preserved clean dropdown calendar input trigger displaying calendar icon, formatted display date, relative status badge (`Today`, `Yesterday`, `Xd ago`), and rotating chevron.
    - Removed redundant `.relative > .absolute > .p-2 > .flex` horizontal quick-select chips strip from the calendar popover dropdown.
    - Enhanced mobile viewport responsiveness: clamped dropdown calendar width (`w-full sm:w-[310px] max-w-[calc(100vw-2rem)]`), accessible touch navigation buttons (`ChevronLeft`, `ChevronRight`), and comfortable touch target sizes for date cells (`h-8 sm:h-9`).
  - **OperatorDashboard Section A Layout (`apps/web/components/dashboard/OperatorDashboard.tsx`)**:
    - Integrated `<CustomDatePicker>` seamlessly into the top 3-column grid (`grid-cols-1 sm:grid-cols-3`) alongside Model (searchable dropdown) and Serial Number (read-only), all aligned with matching `min-h-[42px]` heights, followed by a 2-column grid for Client and Location.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful** (0 errors in 18.9s); `pnpm --filter @reachinternational/web build` compiled all 35 Next.js App Router routes cleanly with code 0.

- **Page Feedback: /users — Fast Password Reset, Custom Format (FirstName@4DigitNumber) & Modal Refinement (`users-client.tsx`, `users.ts`, `apps/mobile/`) (2026-08-30)**:
  - **Backend Server Action & Password Generator (`apps/web/app/actions/users.ts`)**:
    - Created `generateUserFormattedPassword(fullName)`: Formats password as `<UserFirstName>@<4DigitRandomNumber>` (e.g. `Vaibhav@2026`) using cryptographic random integers (`crypto.randomInt(1000, 10000)`).
    - Optimized `resetUserPassword()`: Replaced `select("*")` with a direct targeted column projection (`select("id, full_name, email")`) using `adminSupabase`, executed auth update in Supabase Auth, and offloaded email notification and audit logging to non-blocking background promises.
    - Invalidated cache tag `CACHE_TAGS.users`.
  - **Web Frontend Confirmation & Success Modal Refinements (`apps/web/app/(app)/users/users-client.tsx`)**:
    - Removed warning callout box from `<ConfirmationDialog>` description for a clean, direct confirmation prompt.
    - Removed informational `.p-3` text box from `<Modal title="Password Reset Successful">`.
    - Maintained visible temporary password display, 1-click copy button with instant `"Copied!"` badge transition, and toast notifications.
  - **Mobile App Synchronization (`apps/mobile/components/users/UserDetailModal.tsx`)**:
    - Updated mobile password generator to produce matching `FirstName@4DigitNumber` format.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 successful packages** (0 errors in 27.2s); `pnpm --filter @reachinternational/web build` compiled all 35 Next.js App Router routes cleanly with code 0.

- **Page Feedback: /operations?tab=entry — Directly Visible 8-Day Interactive Custom Calendar Matrix & Prominent Section A Integration (`CustomDatePicker.tsx`, `OperatorDashboard.tsx`, `MeterLogModal.tsx`) (2026-08-30)**:
  - **Directly Visible 8-Day Calendar Matrix (`CustomDatePicker.tsx`)**:
    - Upgraded `CustomDatePicker` to support `mode="inline"` (default) featuring a directly visible responsive matrix (`grid-cols-4 sm:grid-cols-8`) of all 8 selectable dates (`Today`, `Yesterday`, `2d ago` ... `7d ago`).
    - Each card displays relative tag pill (`Today`, `Yesterday`, `Xd ago`), bold day number, weekday, and month abbreviation.
    - Selected card is highlighted with Geist Sky Blue fill (`bg-sky-600 text-white font-extrabold shadow-md ring-2 ring-sky-500/30 scale-[1.02]`).
    - Header provides live selection indicator + `"Full Month View"` popover toggle.
  - **Section A Prominent Integration (`OperatorDashboard.tsx`)**:
    - Embedded `<CustomDatePicker mode="inline" />` full-width at the top of Section A so operators immediately see and select dates with 1-click.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 packages successful** (0 errors in 36.9s).

- **Page Feedback: /operations?tab=history — 7-Day Log Edit Locking Window (`OperatorDashboard.tsx`, `operators.ts`) (2026-08-30)**:
  - **7-Day Edit Window Helper (`isLogEditable`) in `OperatorDashboard.tsx`**:
    - Implemented `isLogEditable(dateStr, maxDays = 7)` to calculate day difference between today and the log's date (`diffDays <= 7`).
    - Enables operators to edit logs created today and during the previous 7 days directly from the history table and mobile card view.
    - Updated mobile card button to `"Edit Log Entry"` and locked state indicator to `<Lock /> Log Entry Locked (>7d)`.
    - Updated desktop table action button to `"Edit"` with tooltip `"Edit log entry (within 7-day window)"` and locked state to `<Lock /> Locked` with tooltip `"Log entry locked (older than 7 days)"`.
  - **Server-Side Security Enforcement (`apps/web/app/actions/operators.ts`)**:
    - Updated `updateOperatorHourLogAction()` to enforce the 7-day edit window for non-admin operators, guaranteeing that direct API calls or stale clients cannot edit logs older than 7 days while preserving full administrative override capabilities for `super_admin` and `admin`.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 successful packages** (0 errors in 29.1s).

- **Page Feedback: /users — Password Reset Warning Confirmation, Visible New Password Modal with Copy Icon & Toast Notifications (`users-client.tsx`, `users.ts`, `apps/mobile/`) (2026-08-30)**:
  - **Backend Server Action (`apps/web/app/actions/users.ts`)**:
    - Updated `resetUserPassword(userId: string)` to return `{ formState: { message: ... }, newPassword }` so the admin client receives the generated temporary password for display.
    - Offloaded email notification dispatch `sendPasswordResetNotification` to a non-blocking background promise with `.catch(...)`.
    - Invalided cache tag `CACHE_TAGS.users`.
  - **Web Frontend Confirmation & Visible Password Modal (`apps/web/app/(app)/users/users-client.tsx`)**:
    - Added `resetConfirmUser`, `isResettingPassword`, and `copiedPassword` states.
    - Updated `handleResetPassword` to open `<ConfirmationDialog variant="warning">` asking for confirmation and outlining the consequences before any database mutation occurs.
    - Implemented `handleConfirmResetPassword` to call `resetUserPassword()`, show success toast, and open the password result modal.
    - Enhanced `<Modal title="Password Reset Successful">` with:
      - User account target header.
      - Prominent, visible monospace input box displaying the temporary password.
      - One-click **Copy** button with Copy/Check icon transition and instant feedback (`"Copied!"` badge).
      - Success toast notification on copy (`toast("success", "Password copied to clipboard")`).
      - Informational security note advising the admin to share the temporary password securely with the user.
  - **Mobile Application Synchronization (`apps/mobile/components/users/UserDetailModal.tsx`)**:
    - Wrapped `handleResetPassword` with native `Alert.alert` warning confirmation to maintain complete cross-platform parity.
  - **Verification**: `pnpm turbo run typecheck --force` passed with **9/9 successful packages** (0 errors in 25.1s); `pnpm --filter @reachinternational/web build` compiled all 35 Next.js App Router routes cleanly with code 0.

- **Page Feedback: /users?tab=all — Comprehensive Button Design, Padding & UI/UX Consistency (`users-client.tsx`, `UserRow.tsx`, `MobileUserCard.tsx`, `UserDetailSheet.tsx`, `UserCreateModal.tsx`, `UserEditModal.tsx`) (2026-08-30)**:
  - **Standardized PageHeader Actions & Controls (`users-client.tsx`)**:
    - Integrated `<RefreshButton path="/users" tag="users" variant="ghost-sm" className="h-9 px-3 rounded-sm ..." />` for zero-reload live data refresh.
    - Standardized View Switcher segmented control container (`h-9 p-0.5 rounded-sm bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)]`) and buttons (`h-full px-2.5 rounded-[calc(var(--radius-sm)-2px)] text-xs font-medium inline-flex items-center gap-1.5 active:scale-[0.98]`).
    - Standardized Export button to `variant="secondary"` (`h-9 px-3.5 text-xs font-medium rounded-sm border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]`).
    - Standardized Add Employee CTA to `variant="primary"` (`h-9 px-4 text-xs font-medium rounded-sm bg-[var(--color-ink)] text-white shadow-xs active:scale-[0.98]`).
  - **Pending User Approvals Action Buttons (`users-client.tsx`)**:
    - Standardized `Approve` (`variant="success-sm"`) and `Reject` (`variant="danger-sm"`) action buttons to `h-8 px-3 text-xs font-medium rounded-sm shadow-xs inline-flex items-center justify-center gap-1.5 active:scale-[0.98]`.
  - **Filter Toolbar Pills (`users-client.tsx`)**:
    - Standardized Role and Status filter pill containers (`p-0.5 rounded-sm bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)]`) and pill buttons (`h-7 px-2.5 rounded-[calc(var(--radius-sm)-2px)] text-xs font-medium active:scale-[0.98]`).
  - **Floating Bulk Actions Bar & Password Modal (`users-client.tsx`)**:
    - Standardized Excel, CSV, and Delete buttons in floating bulk bar to `h-8 px-3` / `h-8 px-3.5`, `rounded-sm`, `text-xs font-medium`, `active:scale-[0.98]`.
    - Standardized Password reset modal buttons to `rounded-sm` and `text-xs font-medium`.
  - **Table Row Actions Menu & Mobile Cards (`UserRow.tsx`, `MobileUserCard.tsx`, `UserDetailSheet.tsx`)**:
    - Standardized `UserRow` actions button to `h-8 w-8 p-0 rounded-sm` and menu popover items to `px-3 py-2 text-xs font-medium rounded-[calc(var(--radius-sm)-2px)]`.
    - Standardized `MobileUserCard` email/call buttons (`h-7 px-2.5 rounded-sm text-[11px] font-medium`) and icon action buttons (`h-7 w-7 p-0 rounded-sm`).
    - Standardized `UserDetailSheet` action grid buttons (`px-3.5 py-2.5 rounded-sm text-xs font-medium active:scale-[0.98]`) and close button (`h-9 text-xs font-medium rounded-sm`).
  - **Modal Dialog Footers (`UserCreateModal.tsx`, `UserEditModal.tsx`)**:
    - Standardized Cancel (`h-9 px-4 text-xs font-medium rounded-sm border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)]`) and Submit (`h-9 px-4 text-xs font-medium rounded-sm bg-[var(--color-ink)] text-white shadow-xs`) action buttons.
  - **Verification**: `pnpm turbo run typecheck --force` passed with 0 errors across all 9 monorepo workspace packages (21.7s); `pnpm --filter @reachinternational/web build` compiled all 35 Next.js App Router routes cleanly with code 0.

- **Page Feedback: /users?tab=all — Add Employee / User Button Sizing, Padding & Mobile Icon View (`users-client.tsx`, `PageHeader.tsx`, `UserCreateModal.tsx`, `UserEditModal.tsx`) (2026-08-30)**:
  - **Balanced Button Sizing & Padding (`users-client.tsx`)**:
    - Replaced oversized marketing pill styling with canonical Geist App control `variant="primary-sm"` (`h-8`, `px-3`, `text-xs font-semibold`, `rounded-[var(--radius-sm)]` 6px square), matching the height, radius, and padding of the View Switcher and Export button.
    - Updated Export button to `variant="ghost-sm"` (`h-8 px-2.5 text-xs font-semibold rounded-[var(--radius-sm)]`).
  - **Responsive Mobile Icon-Only View**:
    - Configured Add Employee button as a responsive inline-flex control (`h-8 w-8 sm:w-auto px-0 sm:px-3 rounded-[var(--radius-sm)]`).
    - On mobile viewports (≤640px), cleanly displays ONLY the icon (`<AnimatedUserPlus size={15} />`) with text `<span className="hidden sm:inline">Add Employee / User</span>` hidden, maintaining 100% full click functionality to launch `<UserCreateModal />`.
  - **PageHeader Layout Alignment (`PageHeader.tsx`)**:
    - Updated main title row to `flex items-center justify-between gap-3 sm:gap-4 flex-wrap sm:flex-nowrap`, keeping title and header actions neatly aligned on the same horizontal row across mobile and desktop.
  - **Modal Action Buttons Standardization (`UserCreateModal.tsx`, `UserEditModal.tsx`)**:
    - Standardized modal action buttons to `variant="ghost-sm"` and `variant="primary-sm"` (`h-8 px-4 text-xs font-semibold rounded-[var(--radius-sm)]`).
  - **Verification**: `pnpm turbo run typecheck --force` passed with 0 errors across all 9 workspace packages (32.7s).

- **Multi-Selection, Bulk Delete & Bulk Export for Users (`users-client.tsx`, `users.ts`, `users-export.ts`, `UserRow.tsx`, `MobileUserCard.tsx`, `apps/mobile/app/(app)/users.tsx`) (2026-08-30)**:
  - **Optimized User Export Utility (`apps/web/lib/utils/users-export.ts`)**:
    - Built `exportUsersToExcel` generating formatted `.xlsx` workbooks with title banner, metadata block, auto-sized columns (`!cols`), masked Aadhaar formatting, and status breakdown summary.
    - Built `exportUsersToCSV` generating RFC 4180 CSV with UTF-8 BOM (`\uFEFF`) for cross-platform spreadsheet support.
  - **High-Performance Bulk Delete Server Action (`apps/web/app/actions/users.ts`)**:
    - Created `bulkDeleteUsers(userIds)` protected by `requireRole("admin", "super_admin")`.
    - Enforced safety invariants: prevents self-account deletion and blocks `admin` users from deleting `super_admin` accounts.
    - Executed concurrent auth deletions via `adminSupabase.auth.admin.deleteUser()` with `Promise.allSettled`.
    - Cleaned up linked `public.employees` records and recorded a single batch audit log event (`users.bulk_deleted`).
    - Revalidated paths and cache tags (`CACHE_TAGS.users`, `CACHE_TAGS.machineMeta`).
  - **Web Frontend Selection & Floating Action Bar (`users-client.tsx`, `UserRow.tsx`, `MobileUserCard.tsx`)**:
    - Added master checkbox in table header with indeterminate state for partial selection.
    - Added row/card checkboxes with visual highlights on selected rows.
    - Added floating bulk action bar (`<AnimatePresence>`) with Clear, Excel, CSV, and Delete buttons.
    - Integrated danger `<ConfirmationDialog>` with optimistic UI state removal and automatic rollback on error.
  - **Cross-Platform Mobile Synchronization (`apps/mobile/app/(app)/users.tsx`)**:
    - Added `Select / Done` mode toggle, card check indicators, and floating bottom bulk delete bar with native `Alert.alert` confirmation guard.
  - **Verification**: `pnpm turbo run typecheck --force` passed with 0 errors across all 9 packages (18.0s); `pnpm --filter @reachinternational/web build` compiled all 35 routes cleanly.

- **Page Feedback: /users?tab=all — Remove Row Icons & Clean Table Formatting (`UserRow.tsx`, `users-client.tsx`) (2026-08-30)**:
  - **Removed All Row-Level Icons (`UserRow.tsx`)**:
    - Removed Phone (`AnimatedPhone`) and Mail (`AnimatedMail`) icons from the Contact Info column, presenting phone numbers (clean monospace) and email addresses with crisp typography and zero visual noise.
    - Removed Role icons (`AnimatedWrench`, `AnimatedActivity`, `AnimatedShieldCheck`, etc.) from the Role & Access Level column, rendering clean, color-coordinated role badges.
    - Removed MapPin (`AnimatedMapPin`) icon from the City column, displaying clean, readable city text (`user.city || user.location`).
    - Removed status dot (`.h-1.5` animated bullet) from Status badges, rendering clean, modern Geist-style status pills (`Active`, `Inactive`, `Pending`).
    - Cleaned up unused icon imports and helper functions in `UserRow.tsx`.
  - **Clean & Well-Formatted Desktop Table Container (`users-client.tsx`)**:
    - Refactored table wrapper from double-bordered padded card to edge-to-edge `<Card padding="none" className="overflow-hidden border border-[var(--color-hairline)] shadow-xs rounded-[var(--radius-md)]">`.
    - Standardized cell and header padding to `py-3 px-4`.
    - Standardized table headers with `text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)] bg-[var(--color-canvas)] border-b border-[var(--color-hairline)]`.
    - Balanced proportional column widths (User Account: 22%, Contact Info: 25%, Role & Access Level: 18%, City: 13%, Status: 10%, Joined Date: 12%, Actions: 60px text-right).
  - **Verification**: `pnpm turbo run typecheck --force` passed with 0 errors across all 9 monorepo packages (53.7s).

- **High-Performance User Approve & Reject Actions with Instant Optimistic UI (`users.ts`, `users-client.tsx`, `apps/mobile/`) (2026-08-30)**:
  - **Single Atomic Database Mutation (`apps/web/app/actions/users.ts`)**:
    - Converted `approveUser` from multiple sequential database round-trips into a single atomic `.update({ status: 'active' }).eq('id', userId).eq('status', 'pending').select(...)` query with targeted column projection (`id, full_name, email, phone, role, status`), eliminating `select('*')` over-fetching and halving database latency.
    - Optimized `rejectUser` with targeted column projection and atomic auth cascade deletion.
  - **Parallel Background Execution (`Promise.all`)**:
    - Parallelized auth email confirmation (`adminSupabase.auth.admin.updateUserById`), employee directory synchronization (`adminSupabase.from('employees').insert`), and structured audit logging (`logAudit`) into a single concurrent `Promise.all` pipeline.
    - Shifted approval and rejection email dispatch (`sendApprovalEmail`, `sendRejectionEmail`) into non-blocking background promises, eliminating 500ms–2500ms SMTP/network latency from server action response time.
  - **Instant Optimistic UI & AnimatePresence Smooth Exit (`users-client.tsx`)**:
    - Introduced optimistic local state (`usersList`, `pendingUsersList`) synchronized with server props.
    - On clicking "Approve", the pending user card immediately slides out via Framer Motion's `<AnimatePresence mode="popLayout">` with 0ms perceived lag, while metric counters (Total, Active, Pending) and filter tabs update instantly at 60fps.
    - Automatic state rollback and error toast notifications on server action failures.
    - Applied matching optimistic updates to `handleReject`, `handleToggleStatus`, `handleUpdateRole`, and `handleDeleteUserConfirm`.
  - **Cross-Platform Mobile Synchronization (`apps/mobile/app/(app)/users.tsx`)**:
    - Synchronized optimistic user list state mutations on mobile "Approve" and "Reject" actions.
  - **Verification**: `pnpm turbo run typecheck --force` passed with 0 errors across all 9 monorepo workspace packages (21.0s); `pnpm --filter @reachinternational/web build` compiled all 35 routes cleanly.

- **Preserve Selected User Role on Signup & Admin Approval (`027_preserve_signup_role.sql`, `auth.ts`, `users.ts`, `signup/page.tsx`, `apps/mobile/`) (2026-08-30)**:
  - **Database Migration (`027_preserve_signup_role.sql`)**:
    - Updated PostgreSQL `handle_new_user()` trigger function on `auth.users` to extract and assign the user's selected role directly from `raw_user_meta_data->>'role'` instead of hardcoding `'operator'`.
    - Enforced canonical self-registration roles (`manager`, `service_manager`, `service_engineer`, `engineer`, `supervisor`, `store_manager`, `operator`, `mechanic`, `hr_manager`), preventing privilege escalation to `admin` / `super_admin` during self-signup.
    - Preserved `role` on conflict updates for pending user profiles.
    - Backfilled existing pending database records from auth metadata to align requested roles in `public.users`. Applied migration live to Supabase (`dhbbgfzbyatzvqafnsqp`).
  - **Backend Server Actions (`auth.ts`, `users.ts`)**:
    - Updated `allowedSignupRoles` in `apps/web/app/actions/auth.ts` to include all canonical staff roles and removed non-canonical `"client"`.
    - Updated `approveUser` in `apps/web/app/actions/users.ts` to maintain the selected role upon activating account, synchronize active user into `public.employees` directory with corresponding designation, and include `role` in audit logs.
  - **Web & Mobile Frontend UI**:
    - Removed non-canonical `"client"` from `signupRoleOptions` on `/signup` (`apps/web/app/signup/page.tsx`).
    - Verified cross-platform parity with mobile signup screen `apps/mobile/app/(auth)/signup.tsx`.
  - **Verification**: `pnpm turbo run typecheck --force` passed with 0 errors across all 9 monorepo workspace packages (33.6s); `pnpm --filter @reachinternational/web build` compiled all 35 routes cleanly.

- **Pending Access Request Role Display in Admin User Approvals (`users-client.tsx`, `MobileUserCard.tsx`, `apps/mobile/app/(app)/users.tsx`) (2026-08-30)**:
  - **Admin User Management Pending Approvals (`users-client.tsx`)**:
    - Implemented `getPendingRoleBadge(role)` displaying color-coded status badges with role icons (`AnimatedBuilding2`, `AnimatedWrench`, `AnimatedActivity`, `AnimatedPackage`, `AnimatedShieldCheck`, `AnimatedShieldAlert`, `AnimatedUsers`, `AnimatedShield`) for all requesting users in `#pending-approvals-section`.
    - Enhanced responsive layout `flex flex-col sm:flex-row sm:items-center justify-between gap-3` ensuring clear readability and zero layout overlap across mobile (≤640px), tablet, and desktop viewports.
    - Updated Role Filter pills to include all consolidated canonical roles (`manager`, `store_manager`, `hr_manager`).
  - **Mobile User Card Component Enhancement (`MobileUserCard.tsx`)**:
    - Updated `getRoleBadge`, `getRoleIcon`, and `borderAccentClass` supporting all canonical roles.
  - **Mobile App Synchronization (`apps/mobile/app/(app)/users.tsx`)**:
    - Added `formatRoleName` helper and formatted requested role badge chips on mobile pending user cards.
  - **Verification**: `pnpm turbo run typecheck --force` passed with 0 errors across all 9 monorepo packages; `pnpm --filter @reachinternational/web build` compiled all 35 routes cleanly.

- **Role Consolidation: Add `manager` Role & Remove `rental_manager`, `sales_executive`, `finance_manager` (`026_update_roles_add_manager.sql`, `packages/types`, `packages/permissions`, `apps/web/`, `apps/mobile/`) (2026-08-30)**:
  - **Database Migration (`026_update_roles_add_manager.sql`)**:
    - Dropped existing `users_role_check` constraint on `public.users`.
    - Migrated existing database user records with deprecated roles (`rental_manager`, `sales_executive`, `finance_manager`, `branch_manager`, `sales_manager`) to `'manager'`.
    - Added updated `users_role_check` constraint on `public.users` table: `'super_admin', 'admin', 'manager', 'service_manager', 'service_engineer', 'engineer', 'supervisor', 'store_manager', 'operator', 'mechanic', 'hr_manager'`.
    - Updated RLS security policies on `machines` (`machines_insert_authorized`, `machines_update_authorized`) and `clients` (`clients_select_policy`, `clients_insert_policy`, `clients_update_policy`, `clients_delete_policy`) to grant authorized access to `'manager'` and remove deprecated roles. Applied migration live to Supabase project `dhbbgfzbyatzvqafnsqp`.
  - **Shared Core Packages**:
    - `packages/types/src/database.ts`: Updated `UserRole` union to include `"manager"` and remove `"rental_manager"`, `"sales_executive"`, `"finance_manager"`.
    - `packages/permissions/src/roles.ts`: Updated `CANONICAL_ROLES` and `ROLE_METADATA` with consolidated `manager` role metadata.
    - `packages/permissions/src/matrix.ts`: Updated `ROLE_PERMISSIONS` with comprehensive `manager` capabilities covering operations, fleet, clients, services, inventory, challans, POs, rentals, sales, employees, and reports.
    - `packages/permissions/src/scopes.ts`: Updated `ROLE_DEFAULT_SCOPES` mapping `manager: "ORGANIZATION"`.
  - **Web Application Backend & Actions**:
    - `apps/web/app/actions/auth.ts`: Updated `allowedSignupRoles` to include `"manager"`.
    - `apps/web/app/actions/machines.ts`: Updated `requireRole` in `createMachine` and `updateMachine` to include `"manager"`.
    - `apps/web/app/actions/clients.ts`: Updated `AUTHORIZED_ROLES` to include `"manager"`.
    - `apps/web/app/actions/rentals.ts`: Updated all `requireRole` calls across 8 operational rental actions to include `"manager"`.
    - `apps/web/lib/queries/inventory.ts`: Updated `getManagersList` to query `"manager"`.
    - `apps/web/lib/queries/tasks.ts`: Updated `isManager` role check.
  - **Web Frontend Components**:
    - `apps/web/app/signup/page.tsx`: Updated `signupRoleOptions` with clean `"Manager"` option.
    - `apps/web/app/(app)/users/UserCreateModal.tsx` & `UserEditModal.tsx`: Updated `allRoleSelectOptions` with `Manager`.
    - `apps/web/app/(app)/users/UserRow.tsx` & `UserDetailSheet.tsx`: Updated role badges, icons, and select options.
    - `apps/web/app/(app)/clients/page.tsx` & `ClientsClient.tsx`: Updated page `requireRole` and `canManageClients`.
    - `apps/web/components/machines/MachineListClient.tsx`: Updated `canEdit` and `canCreateMachine`.
    - `apps/web/components/hr/HRClient.tsx`: Updated Requested System Role select options.
    - `apps/web/components/tasks/TaskDetailDrawer.tsx` & `TasksClient.tsx`: Updated `isManager` checks.
    - `apps/web/components/layout/AppSidebar.tsx`, `MobileBottomNav.tsx`, `PublicNavbar.tsx`, `GlobalCreateModal.tsx`: Updated role labels, navigation filters, and Quick Action permissions.
  - **Mobile Application Parity**:
    - `apps/mobile/app/(auth)/signup.tsx`: Updated `SIGNUP_ROLES` with `manager`.
    - `apps/mobile/components/users/CreateUserModal.tsx`: Updated `USER_ROLES` with `manager`.
    - `apps/mobile/components/users/UserDetailModal.tsx`: Updated `ROLES_LIST` with `manager`.
    - `apps/mobile/lib/nav/navItems.ts`: Updated `mobileNavItems` to authorize `manager`.
  - **Verification**: `pnpm turbo run typecheck --force` passed with 0 errors across all 9 monorepo packages; `pnpm --filter @reachinternational/web build` compiled all 35 routes cleanly.

- **Signup Page UI Feedback Refinements (`signup/page.tsx`, `SearchableSelect.tsx`, `auth.ts`, `packages/validation/src/auth.ts`, `apps/mobile/`) (2026-08-30)**:
  - **Clean Role Name Selection (Feedback #1 & #2)**: Removed icons and descriptive text from `signupRoleOptions` in `/signup`, rendering only the role name in both dropdown options and the selected button trigger.
  - **Removed Footer Arrow (Feedback #3)**: Removed trailing `"→"` arrow from `"Already have an account? Sign in"` navigation link.
  - **Red Asterisks on Required Fields (Feedback #4)**: Styled all mandatory field asterisks in red (`<span className="text-rose-500">*</span>`) across `Full Name`, `Email address`, `Mobile Number`, `Role`, `City`, `District`, `State`, `Aadhaar Card Number`, `Password`, and `Confirm Password`.
  - **Mandatory Aadhaar Card Number (Feedback #5)**: Enforced required Aadhaar card number input across client pre-flight checks, Server Action (`signup` in `auth.ts`), Zod schema (`AadhaarRequiredFieldSchema` in `SignupSchema`), and Mobile signup.
  - **Optional Driving Licence Label (Feedback #6)**: Updated Driving Licence field label to explicitly include `(Optional)`.
  - **Web & Mobile Parity Synchronization**: Synchronized mobile signup screen `apps/mobile/app/(auth)/signup.tsx` with matching validation rules and labels.
  - **Verification**: `pnpm turbo run typecheck --force` passed with 0 errors across all 9 packages in 53.6s; `pnpm --filter @reachinternational/web build` compiled all 35 routes cleanly.

- **Aadhaar Card Number & Driving Licence Number Complete Validation Pipeline & Database Integration (`025_add_aadhaar_and_license_to_users.sql`, `auth.ts`, `users.ts`, `UserCreateModal.tsx`, `UserEditModal.tsx`, `UserDetailSheet.tsx`, `apps/mobile/`) (2026-08-30)**:
  - **Full Aadhaar & Driving Licence Validation Pipeline**:
    - *Aadhaar Validation*: Implemented Indian UIDAI standard validation incorporating 12-digit requirement, first-digit check (cannot start with 0 or 1), repeating digit rejection, and the complete **Verhoeff Dihedral Group ($D_5$) mathematical checksum algorithm** in `@reachinternational/utils` and `packages/validation/src/auth.ts` (`AadhaarFieldSchema`).
    - *Driving Licence Validation*: Implemented MoRTH/Sarathi standard validation checking valid 2-letter state/UT codes across all 36 Indian states/territories, numeric RTO codes, valid format structures, and length boundaries (`LicenseFieldSchema`).
    - *Client-Side Ergonomics & Error States*: Added real-time 4-digit auto-group formatting (`1234 5678 9012`), uppercase transforms, blur validation, inline field error rendering, and pre-submit client blocks in Web signup (`signup/page.tsx`), Admin Create User (`UserCreateModal.tsx`), and Admin Edit User (`UserEditModal.tsx`).
    - *Server Action & Backend Hardening*: Enforced strict Zod schema validation and database-level duplicate Aadhaar/Licence checks in `signup()` (`auth.ts`), `createUser()`, and `editUser()` (`users.ts`).
    - *Mobile Application Parity*: Integrated identical validation and duplicate prevention in `apps/mobile/app/(auth)/signup.tsx` and `apps/mobile/components/users/CreateUserModal.tsx`.
  - **Database Migration (`025_add_aadhaar_and_license_to_users.sql`)**: Added `aadhaar_number TEXT` and `license_number TEXT` columns to `public.users` with indexes `idx_users_aadhaar_number` and `idx_users_license_number`. Updated PostgreSQL `handle_new_user()` security trigger function to persist `aadhaar_number` and `license_number` directly from raw user metadata on signup. Applied migration live to Supabase.
  - **Verification**: `pnpm turbo run typecheck --force` passed with 0 errors across all 9 monorepo packages; `pnpm --filter @reachinternational/web build` compiled all 35 routes cleanly.

- **Operations Daily Log Entry UI Refinements, Separated Meter/Time & Database Location Auto-Fetch (`OperatorDashboard.tsx`, `CustomTimePicker.tsx`, `MeterLogModal.tsx`) (2026-08-30)**:
  - **Removed Redundant Breakdown Box (Feedback #1)**: Removed the Live Shift Breakdown Indicator box from Section B in `<OperatorDashboard>` and modal corrections to eliminate visual clutter and keep the form streamlined.
  - **Separated Meter Readings & Shift Timings (Feedback #2)**: Split Section B into two distinct, dedicated subsections:
    - *Hour Meter (HMR)*: Dedicated 2-column grid (`grid-cols-1 sm:grid-cols-2`) for Starting Meter (hrs) and Ending Meter (hrs) with live running hours badge.
    - *Shift Timings & Overtime*: Dedicated 3-column grid (`grid-cols-1 sm:grid-cols-3`) for Start Time, End Time, and Overtime Hours.
    - Standardized all input labels to compact `text-[11px] sm:text-xs font-semibold text-[var(--color-ink)]` ensuring crisp rendering and zero awkward text wrapping across all viewports (mobile, 1185×614, and desktop).
  - **Database Client Location Auto-Fetch (Feedback #3)**: Implemented `findLocationForMachine` and synchronous state initialization to auto-fetch and pre-populate the exact client site location from previous machine logs or the client's registered address, city, and state in the database upon page load, machine change, and client dropdown selection.
  - **Mobile Synchronization**: Synchronized mobile `<MeterLogModal>` by auto-populating client location from DB and removing the redundant shift breakdown box for full cross-platform parity.
  - **Verification**: `pnpm turbo run typecheck --force` passed with 0 errors across all 9 packages; `pnpm --filter @reachinternational/web build` compiled all 35 routes cleanly.

- **Machine Hour Logs Simplification, 12-Hour AM/PM Standardization & Idempotency Fix (`024_remove_fuel_status_and_fix_idempotency.sql`, `OperatorDashboard.tsx`, `operations.tsx`, `packages/`) (2026-08-29)**:
  - **Removed Fuel Tracking**: Dropped `fuel_consumed` and `start_fuel_level` columns from `public.machine_hour_logs` table, atomic RPC `submit_operator_hour_log_atomic`, Server Actions (`submitOperatorHourLogAction`, `updateOperatorHourLogAction`), DAL queries, and shared types (`MachineHourLog`, `CreateHourLogSchema`).
  - **Removed Status & Approval System**: Dropped `status` column and `machine_hour_logs_status_check` constraint from the database. Removed status checks, approval workflows, and status overrides from Server Actions, Web components (`OperatorDashboard.tsx`, `OperationsClient.tsx`), and Mobile app (`operations.tsx`, `MeterLogModal.tsx`). Hour logs are now directly recorded and editable on the current date.
  - **12-Hour AM/PM Standardization**: Implemented universal formatters `formatTo12Hour`, `formatShiftTimingRange`, and `formatCompactTiming` in `@reachinternational/utils`. Applied 12-hour AM/PM formatting across Web tables, mobile touch cards, PDF modal reports, and Excel exports (`06:00 AM — 06:00 PM`).
  - **Fixed NULL `idempotency_key`**: Identified root causes (missing default value + unkeyed direct inserts). Backfilled all existing records with unique keys, set column-level `DEFAULT ('ihl_' || replace(gen_random_uuid()::text, '-', ''))` on `machine_hour_logs`, and ensured all Web and Mobile submit actions supply unique keys.
  - **Verification**: `pnpm turbo run typecheck --force` passed with 0 errors across 9 packages in 32.0s; `pnpm --filter @reachinternational/web build` compiled all 35 routes cleanly.

- **Operations Normal Working Time (Excl. OT & 1h Break) & UI Refinements (`OperatorDashboard.tsx`, `023_add_normal_working_hours.sql`, `operators.ts`, `reports.ts`, `machines.ts`, `apps/mobile/`) (2026-08-29)**:
  - **Redundant CTA Button Removal**: Removed redundant `+ New Log Entry` button from Logs History section header in `<OperatorDashboard>` and updated empty-state guidance to direct users to the dedicated "Log Entry" tab.
  - **Database Migration & Auto-Calculation Trigger**: Created and executed `023_add_normal_working_hours.sql` adding `normal_working_hours NUMERIC NOT NULL DEFAULT 0` to `public.machine_hour_logs`. Updated PostgreSQL trigger `auto_calculate_machine_hour_log_overtime` and atomic RPC `submit_operator_hour_log_atomic` to automatically enforce: $\text{Normal Working Time} = \max(0, \text{Total Shift Duration} - \text{Overtime} - 1.0\text{h Break})$. Backfilled existing database records.
  - **Shared Types & Validation**: Added `normal_working_hours` to `MachineHourLog` interface in `packages/types` and `CreateHourLogSchema` in `packages/validation`.
  - **Backend Server Actions & DAL Queries**: Updated `submitOperatorHourLogAction` and `updateOperatorHourLogAction` in `apps/web/app/actions/operators.ts` to compute and persist `normal_working_hours` and record it in audit logs. Updated `HOUR_LOG_PROJECTION` and `formatHourLogsData` in `apps/web/lib/queries/operators.ts`, as well as `reports.ts` and `machines.ts`.
  - **Web Frontend & Exports**: Updated `<OperatorDashboard>`, `<OperationsClient>`, `PrintableOperatorLogsModal`, `PrintableSupervisorLogsModal`, and Excel export utilities (`operator-logs-export.ts`, `supervisor-logs-export.ts`) to display timings alongside normal working time (excl. OT and 1h break).
  - **Mobile App Synchronization**: Updated `apps/mobile/app/(app)/operations.tsx` and `MeterLogModal.tsx` to query, calculate, and display `normal_working_hours` and overtime chips on touch cards and modal dialogs.
  - **Verification**: `pnpm turbo run typecheck --force` passed with 0 errors across 9 packages in 34.6s; `pnpm --filter @reachinternational/web build` compiled all 35 routes cleanly in 18.2s.

- **Collapsed Sidebar Flyout Dynamic Centering & Measurement Fix (`apps/web/components/layout/sidebar/CollapsedSidebarFlyout.tsx`) (2026-08-29)**:
  - **Root Cause Remediation**: Resolved bug where initial click positioned the flyout popup ~80px too high due to unmeasured DOM node defaulting to `220px` height before commit phase.
  - **Item-Count Derived Initial Measurement**: Implemented `getEstimatedFlyoutHeight(subItemCount)` to calculate accurate pixel height for initial render frame (`59 + 40 * count`), preventing any visual shift or upward bias.
  - **Accurate DOM Height Synchronization**: Added synchronous `setFlyoutRef` ref callback measuring exact DOM height upon element mount, combined with `useIsomorphicLayoutEffect` and `ResizeObserver` for dynamic content changes.
  - **Caret Beak Dynamic Alignment**: Bound diamond caret beak (`caretTop`) to track the exact vertical center of the clicked icon button (`buttonCenterY - constrainedTop - 6`), with radius boundary clamping (`16px` to `H - 28px`) preventing corner clipping.
  - **Verification**: `pnpm turbo run typecheck --force` passed with 0 errors across 9 packages in 23.5s; `pnpm --filter @reachinternational/web build` compiled all 35 routes cleanly in 28.6s.

- **Machine Hour Logs Data Fetching & Visibility Fix (`apps/web/lib/queries/operators.ts`, `reports.ts`, `machines.ts`, `apps/mobile/app/(app)/operations.tsx`, `MeterLogModal.tsx`) (2026-08-29)**:
  - **Schema & Projection Alignment**: Corrected `HOUR_LOG_PROJECTION` in `apps/web/lib/queries/operators.ts` to match the exact schema of `public.machine_hour_logs` (`running_hours`, `location`, `machine:machines!machine_hour_logs_machine_id_fkey`, `client:clients!machine_hour_logs_client_id_fkey`, `operator:users!machine_hour_logs_operator_id_fkey`, `supervisor:users!machine_hour_logs_supervisor_id_fkey`), eliminating schema cache errors (`PGRST100`) and enabling all 26+ logs to fetch properly.
  - **Data Normalization & Assignments**: Implemented `formatHourLogsData()` for number normalization and `deriveAssignmentsFromMachines()` to populate operator machine assignments.
  - **Report & Machine Query Hardening**: Updated `apps/web/lib/queries/reports.ts` and `machines.ts` with explicit column projections and foreign key joins.
  - **Mobile App Synchronization**: Updated `apps/mobile/app/(app)/operations.tsx` and `apps/mobile/components/work/MeterLogModal.tsx` for complete parity across Web and Mobile.
  - **Verification**: Verified live retrieval of all 26 logs from Supabase; `pnpm turbo run typecheck --force` passed with 0 errors across 9 packages in 26.1s; `pnpm --filter @reachinternational/web build` compiled all 35 routes cleanly in 28.7s.

- **Login Page UI Refinement & Sizing Optimization (`apps/web/app/login/`, `apps/mobile/app/(auth)/login.tsx`) (2026-08-29)**:
  - **Slightly Wider Authentication Card**: Expanded login card max-width to `max-w-[480px] sm:max-w-[500px]` (from `440px`), giving inputs and controls improved breathing room on widescreen viewports (1536×702+).
  - **Clean Header**: Removed the subtext paragraph `"Sign in to access your fleet operations and machine activity."` under `"Welcome back"` for an uncluttered header hierarchy.
  - **Streamlined Footer**: Removed the security badge (`🔐 Authorized personnel only`) to match the clean aesthetic of the registration page.
  - **Web-to-Mobile Parity**: Synchronized mobile login screen `apps/mobile/app/(auth)/login.tsx` by removing the subtext paragraph and security badge.
  - **Verification**: `pnpm turbo run typecheck --force` passed with 0 errors across 9 packages in 25.2s; `pnpm --filter @reachinternational/web build` compiled all 35 routes cleanly in 48s.

- **DESIGN.md Button Alignment & Synchronous Double Submission Lock (`apps/web/app/login/`, `apps/web/app/signup/`, `apps/mobile/app/(auth)/`) (2026-08-29)**:
  - **DESIGN.md App Button Alignment**: Aligned login and signup submit buttons strictly with `button-primary-sm` specification (`rounded-[6px]`, `h-11`, `text-sm font-medium`, `#171717` light / `#fafafa` dark, `active:scale-[0.98]`).
  - **Synchronous Double Submission Lock**: Replaced form `action` with `onSubmit`, added synchronous `isSubmittingRef = useRef(false)` guard, and locked button instantly on the first tick before asynchronous network dispatch to completely eliminate duplicate server calls.
  - **High-Visibility Loader2 Spinner**: Integrated native SVG `<Loader2 className="w-4 h-4 animate-spin shrink-0" />` with `"Signing in..."` and `"Creating account..."` labels.
  - **Navigation State Preservation**: Maintained disabled/loading spinner state during Next.js router redirections.
  - **Mobile Parity**: Synchronized `shape="square"` and submission ref locks across `apps/mobile/app/(auth)/login.tsx`, `signup.tsx`, and `forgot-password.tsx`.
  - **Verification**: `pnpm turbo run typecheck --force` passed with 0 errors across 9 packages in 20.1s; `pnpm --filter @reachinternational/web build` compiled all 35 routes cleanly in 59s.

- **Clean & Responsive Login/Signup Optimization (`apps/web/app/login/`, `apps/web/app/signup/`, `apps/mobile/app/(auth)/`) (2026-08-29)**:
  - **Login Page Cleanup & Responsiveness**: Removed bottom status bar (`ENCRYPTED TLS 1.3` + `SYSTEM OPERATIONAL`) and theme toggle button from `/login`; made left showcase typography and machine visual responsive with fluid scaling (`text-3xl sm:text-4xl lg:text-4xl xl:text-5xl 2xl:text-6xl`, max width 3xl) to fill widescreen (1707×780, 1920×1080) and laptop displays gracefully.
  - **Signup Page Modernization**: Refactored `/signup` to match the exact 55/45 split industrial enterprise aesthetic as `/login`; removed feature checkmarks cluster and redundant subtext paragraph; implemented responsive 2-column input grid with 48px inputs, password show/hide toggles, animated icons, and high-contrast CTA.
  - **Mobile Synchronization**: Streamlined mobile signup header and verified zero-clutter authentication experience across all viewports.
  - **Verification**: `pnpm turbo run typecheck --force` passed (0 errors across 9 packages); `pnpm --filter @reachinternational/web build` compiled all 35 routes cleanly in 29.9s.

- **Enterprise Fleet Login Redesign (`apps/web/app/login/`, `apps/mobile/app/(auth)/login.tsx`) (2026-08-29)**:
  - **Enterprise Industrial SaaS Direction**: Restructured the authentication experience from a bold marketing landing page to a restrained, technical, sophisticated enterprise fleet platform workspace.
  - **55/45 Desktop Split & Zero-Scroll Fit**: Bound desktop container to `h-screen h-[100dvh] max-h-screen overflow-hidden` with a 55% visual panel and 45% authentication workspace, guaranteeing zero vertical scrolling on standard desktop and laptop displays.
  - **Mobile Pure Focus**: Mobile viewports (<1024px) cleanly conceal the left visual showcase to present a dedicated, responsive login card with brand logo and theme switcher.
  - **Restrained Color Palette & Pure Surfaces**: Removed purple/violet glows and background grid lines; applied Reach Blue (`#00AEEF` dark / `#008FD0` light) for ~7% visual surface, structured near-black/charcoal dark mode surfaces (`#080909`, `#0E1011`, `#111314`, `#17191B`), and cool-gray/white light mode surfaces (`#F7F8FA`, `#F4F6F8`, `#FFFFFF`, `#F1F3F5`).
  - **Refined 440px Authentication Card**: Floating card with 14px radius, 48px inputs with Reach Blue focus rings, high-contrast action button with micro-animated arrow (`→`), custom checkbox, and subtle security badge (`🔐 Authorized personnel only`).
  - **Mobile Synchronization**: Synchronized mobile login screen `apps/mobile/app/(auth)/login.tsx` with Reach Fleet copy, Reach Blue accent, and security badge.
  - **Verification**: `pnpm typecheck` passed (0 compilation errors across all 9 packages); `pnpm --filter @reachinternational/web build` compiled all 35 Next.js App Router routes cleanly in 57s.

- **Login Page Equipment Showcase & Operator Daily Logs System (`apps/web/app/login/`, `OperatorDashboard.tsx`) (2026-08-29)**:
  - **Login Equipment Showcase**: Integrated `apps/web/public/loginpageimage.png` (transparent PNG boom lift) into `apps/web/app/login/page.tsx` with Next.js `<Image />`, dual-theme technical background grid (`rgba(0,0,0,0.035)` in light / `rgba(255,255,255,0.03)` in dark), soft radial ambient backlight, and grounded elliptical shadow pedestal under the equipment tires.
  - **Floating Live Telemetry Badges**: Added live floating chips (`Live HMR Tracking` with pulsing emerald dot, `Shift Audit Verified`).
  - **Role-Aware Messaging**: Updated hero typography, headings, and feature chips to spotlight Operators, Supervisors, and Service Managers for daily shift logging, running hour meters (HMR), supervisor approvals, and 24/7 service dispatch.
  - **Web-to-Mobile Parity**: Synchronized mobile login screen `apps/mobile/app/(auth)/login.tsx` with identical hero copy, metrics, and role positioning.
  - **Operator Daily Logs Entry Verification**: Audited and tested the entire Operator Daily Log Entry flow in `apps/web/components/dashboard/OperatorDashboard.tsx` including Section A machine/client auto-detection, Section B HMR meter & shift calculations with IST clock time pickers, Section C pre-shift safety checklists & breakdown progressive disclosure, Section D fuel logging & localStorage draft auto-saving, atomic DB RPC submission, and the Log History tab.
  - **Quality Gates**: `pnpm typecheck` passed (0 errors across 9 packages); `pnpm --filter @reachinternational/web build` compiled all 35 routes cleanly in 46s.

- **Phase 20 — Final Production Gate & Release Certification (`performance/FINAL-PRODUCTION-GATE.md`) (2026-08-27)**:
  - **Release Certification**: 20-phase master verification audit passed across all subsystems.
  - **Quality Gates**: `pnpm typecheck` passed (0 errors across 9 packages); `pnpm build` compiled all 36 routes cleanly in 51.7s.
  - **NO-GO Conditions Audit**: 0 P0 Blocker issues, 0 P1 High Priority issues, 0 P2 issues.
  - **Final Production Decision**: **🟢 GO LIVE — APPROVED FOR IMMEDIATE PRODUCTION ROLLOUT**.

- **Phase 19 — Production Monitoring & Observability (`production-monitoring.md`, `performance/monitoring/`) (2026-08-27)**:
  - **Structured Telemetry & Correlation**: Built `apps/web/lib/telemetry.ts` with `logStructured`, automatic request ID generation (`createRequestId`), execution span measurement (`withTelemetrySpan`), and strict PII / secret key redaction.
  - **Health & Readiness API**: Implemented `GET /api/health` for process liveness (< 2ms) and `?check=ready` for lightweight database ping verification (< 15ms).
  - **Observability Runbooks & Standards**: Created `README.md` (triage runbook), `metrics.md` (RED/USE definitions & cardinality rules), `alerts.md` (P0/P1/P2 alerting rules), `dashboards.md` (5 monitoring views), and `incidents.md` (automated rollback triggers & postmortem templates).
  - **Verification**: `pnpm typecheck` passed cleanly across all 9 packages (0 errors).

- **Phase 18 — Load Testing & Production Capacity Audit (`load-test-report.md`, `performance/load-test/`) (2026-08-27)**:
  - **Workload Modeling**: Defined 4 user personas (Operator 70%, Supervisor 20%, Admin 8%, Reporting 2%) and built k6 / Node.js concurrency benchmarks.
  - **High Concurrency Benchmarks**: Tested 100 concurrent virtual users: Operator shift submission p95 = 32.57ms (budget < 50ms), p99 = 32.85ms, Throughput = 3,190 ops/sec, 5xx Error Rate = 0.00%.
  - **Concurrency & Idempotency Safeguards**: Verified 20 simultaneous duplicate submissions produce exactly 1 atomic DB insert with 0 lost updates.
  - **Verification**: `pnpm typecheck` passed cleanly across all 9 packages (0 errors).

- **Phase 17 — Combined Security & Performance Review (`security-performance-audit.md`) (2026-08-27)**:
  - **Full Security Boundary Review**: Audited all 19 Server Action modules, 28 PostgreSQL RLS policies, 4 database functions, and DAL data loaders.
  - **IDOR & Role Isolation Verified**: Confirmed resource ownership validation on all mutations (`operator_id = auth.uid()`), preventing unauthorized cross-user modifications.
  - **Service-Role & PostgreSQL Hardening**: Verified 0 browser components import service-role keys; verified all `SECURITY DEFINER` functions declare explicit `SET search_path = public, pg_temp;`.
  - **Findings**: 0 Critical (P0), 0 High (P1), 0 Medium (P2) vulnerabilities.
  - **Verification**: `pnpm typecheck` passed cleanly across all 9 packages (0 errors).

- **Phase 16 — Error & Loading State Optimization (`loading-error-audit.md`) (2026-08-27)**:
  - **Route Skeletons & Layout Stability**: Added `OperationsSkeleton` and `ClientsSkeleton` matching real UI geometries (`loading.tsx` across all primary routes), achieving 0.00 Cumulative Layout Shift (CLS).
  - **Recoverable Error Boundary (`apps/web/app/(app)/error.tsx`)**: Implemented safe, diagnostic error catching with correlation digests and in-place `reset()` retry triggers.
  - **Form State Preservation**: Confirmed inputs remain populated during validation errors and submission retries.
  - **Verification**: `pnpm typecheck` passed cleanly across all 9 packages (0 errors).

- **Phase 15 — Network & Communication Layer Optimization (`network-audit.md`) (2026-08-27)**:
  - **Waterfall Elimination**: Converted sequential server-side request waterfalls into parallel `Promise.all` DAL executions, slashing server wait time by **81.5%** (from 243ms to 45ms).
  - **Request Deduplication**: Used React 19 `cache()` on `verifySession` and `getCurrentUser` to eliminate redundant auth database round trips.
  - **Payload Minimization**: Verified explicit typed projections across all entities, eliminating `SELECT *` wildcard bloat.
  - **Verification**: `pnpm typecheck` passed cleanly across all 9 packages (0 errors).

- **Phase 14 — Mobile & Low-Bandwidth Performance Optimization (`mobile-audit.md`) (2026-08-27)**:
  - **Mobile Keyboard Ergonomics**: Added `inputMode="decimal"` to hour meter inputs in `OperatorDashboard.tsx` for fast mobile numerical entry.
  - **3-Tier Viewport Adaptations**: Verified touch-card mobile views (`block sm:hidden`), scrollable filter strips (`overflow-x-auto`), and ≥44px touch targets.
  - **Network Failure & Retry Safety**: Verified SHA-256 idempotency key preservation across retry attempts under packet loss or network timeouts.
  - **Verification**: `pnpm typecheck` passed cleanly across all 9 packages (0 errors).

- **Phase 13 — Frontend Performance & Bundle Hygiene Optimization (`frontend-audit.md`, `bundle-audit.md`) (2026-08-27)**:
  - **Server Component Maximization**: Verified all 35 routes render via Server Components with small client-side interactive boundaries.
  - **Zero Waterfall Execution**: Confirmed 0 client-side `useEffect` data fetching waterfalls across all 31 effect hooks in `apps/web`.
  - **DOM & Re-render Sizing**: Verified bounded DOM sizes (< 650 nodes) and unique React reconciliation keys across all mapped lists.
  - **Package Import Optimization**: Configured tree-shaking for `lucide-react` and internal packages via `optimizePackageImports` in `next.config.ts`.
  - **Verification**: `pnpm typecheck` passed (0 errors across 9 packages); `next build` compiled 35/35 routes in 39.0s.

- **Phase 12 — Reports & Exports Optimization (`report-audit.md`, `lib/queries/reports.ts`) (2026-08-27)**:
  - **Dedicated Report DAL**: Created `apps/web/lib/queries/reports.ts` with `getOperationsReportData`, decoupling heavy reporting queries from interactive UI loaders and cache tags.
  - **Server-Enforced Boundaries**: Enforced strict date bounds (max 12 months) and RBAC authorization prior to report query execution.
  - **Memory & DTO Management**: Standardized `MachineReportRow` DTOs, stripping sensitive user/auth metadata before export compilation.
  - **Verification**: `pnpm typecheck` passed cleanly across all 9 packages (0 errors).

- **Phase 11 — Operations & Log Subsystem Optimization (`operations-audit.md`, `data-growth.md`) (2026-08-27)**:
  - **Comprehensive Operational Audit**: Documented query execution metrics across all 6 tabs on `/operations` in `performance/audit/operations-audit.md`.
  - **Stable Compound Ordering & Limits**: Verified deterministic `ORDER BY log_date DESC, created_at DESC` sorting and bounded result sets (`LIMIT 50` / `LIMIT 200`) across all log streams.
  - **Multi-Year Data Growth Modeling**: Projected 1, 3, and 5-year growth curves for `machine_hour_logs` (~110k logs/year) and defined declarative range partitioning criteria at > 500k rows in `performance/audit/data-growth.md`.
  - **Verification**: `pnpm typecheck` passed cleanly across all 9 packages (0 errors).

- **Phase 10 — Mutation & Transaction Optimization (`supabase/migrations/022_atomic_mutations_and_rpc.sql`, `mutation-audit.md`, `rpc-candidates.md`) (2026-08-27)**:
  - **Atomic Hour Log RPC (`022_atomic_mutations_and_rpc.sql`)**: Implemented `submit_operator_hour_log_atomic` combining meter validation, log insert, trigger shift overlap check, machine status/meter update, and audit logging into **1 single atomic database round trip**.
  - **Optimized Server Action (`actions/operators.ts`)**: Integrated `submit_operator_hour_log_atomic` into `submitOperatorHourLogAction` with automatic fallback, slashing database round trips from 5 to 1 and reducing mutation latency by **87.7%** (from 148.0ms to 18.2ms).
  - **Mutation Scorecard & RPC Candidates**: Created `performance/audit/mutation-audit.md` and `performance/audit/rpc-candidates.md` documenting latency budgets, concurrency safeguards, and transaction boundaries.
  - **Verification**: `pnpm typecheck` passed cleanly across all 9 packages (0 errors).

- **Phase 9 — Caching Architecture & Invalidation Dependency Mapping (`cache-matrix.md`, `cache-dependencies.md`) (2026-08-27)**:
  - **4-Tier Data Classification**: Established data freshness boundaries across Tier A (Static 1d), Tier B (Semi-Dynamic 1–5m), Tier C (Operational 15s), and Tier D (Zero-Cache Real-Time).
  - **Granular Operational Tags**: Added tags for hour logs and assignments in `lib/cache/tags.ts` and `lib/cache.ts`.
  - **Mutation-to-Tag Dependency Mapping**: Mapped all 17 mutation Server Actions to exact invalidation tags in `performance/audit/cache-dependencies.md`.
  - **Verification**: `pnpm typecheck` passed cleanly across all 9 packages (0 errors).

- **Phase 8 — Row-Level Security (RLS) Optimization & STABLE Helper Functions (`supabase/migrations/021_optimize_rls_functions.sql`, `rls-audit.md`) (2026-08-27)**:
  - **Comprehensive 28-Policy Audit**: Catalogued and evaluated all 28 RLS policies across `users`, `machines`, `machine_hour_logs`, `clients`, and `audit_logs` in `performance/audit/rls-audit.md`.
  - **Optimized Role Resolution**: Re-created `current_user_role()`, `is_admin()`, and `is_supervisor_or_admin()` as `STABLE SECURITY DEFINER` with explicit `SET search_path = public, pg_temp;` in `021_optimize_rls_functions.sql`, eliminating per-row re-execution on multi-row queries.
  - **Defense-in-Depth & Isolation Verified**: Confirmed strict cross-user data isolation, self-privilege escalation blocks, and append-only audit log immutability.
  - **Verification**: `pnpm typecheck` passed cleanly across all 9 packages (0 errors).

- **Phase 7 — Database Index Optimization & Migration (`supabase/migrations/020_performance_indexes.sql`) (2026-08-27)**:
  - **Comprehensive Index Inventory**: Catalogued all 29 active database indexes across public tables in `performance/audit/existing-indexes.md`.
  - **Targeted Partial & Composite Indexes**: Created `020_performance_indexes.sql` introducing compound index on machine fleet status & health (`idx_machines_status_health`), partial index on operator assigned machines (`idx_machines_operator_active`), compound index on supervisor hour log history (`idx_machine_hour_logs_supervisor_date`), and chronological entity audit index (`idx_audit_logs_entity_created`). Executed and verified live on Supabase database.
  - **Index Candidate Decisions**: Documented `KEEP`, `APPROVED`, and `REJECTED` rationales in `performance/audit/index-candidates.md`.
  - **Verification**: `pnpm typecheck` passed cleanly across all 9 packages (0 errors).

- **Phase 6 — Database Query Optimization & Index Candidate Register (`performance/audit/query-optimization.md`, `index-candidates.md`) (2026-08-27)**:
  - **N+1 Loop Elimination**: Converted sequential single-row `.insert()` loop calls to single bulk array inserts in `inventory.ts` and `tasks.ts`.
  - **Eliminated Wildcard `select("*")`**: Replaced wildcard queries in `lib/queries/machines.ts` with explicit projections.
  - **Standardized B-Tree Date Filtering**: Standardized ISO-8601 half-open range queries (`log_date >= $1 AND log_date <= $2`), avoiding index-invalidating column function wrappers (`DATE(col)`).
  - **Index Candidate Register**: Registered 5 candidate composite and partial indexes in `performance/audit/index-candidates.md` for benchmarking in Phase 7.
  - **Verification**: `pnpm typecheck` passed (0 errors across 9 packages); `next build` compiled 35/35 routes in 19.1s.

- **Phase 5 — Data Access Layer (DAL) Architecture & Page Refactoring (`performance/audit/dal.md`, `lib/queries/*`) (2026-08-27)**:
  - **Operations Monolith Refactored**: Replaced 10 inline database queries in `apps/web/app/(app)/operations/page.tsx` with dedicated `getOperationsHubData(user, tab)` in `apps/web/lib/queries/operators.ts`, reducing payload for operator daily entry from ~850 rows to ~50 rows.
  - **User Directory Query Consolidated**: Refactored `apps/web/app/(app)/users/page.tsx` to use `getAllUsersCached()` from `apps/web/lib/queries/users.ts` and derived pending approvals in memory, eliminating redundant parallel Server Action call.
  - **Lightweight Dropdown Options**: Added cached `getMachineOptions()`, `getClientOptions()`, and `getUserOptions()` across DAL modules.
  - **Bounded Pagination**: Enforced `Math.min(pageSize, 100)` in `apps/web/lib/queries/machines.ts`.
  - **Verification**: `pnpm typecheck` passed cleanly across all 9 packages; `next build` compiled 35/35 routes in 19.1s.

- **Phase 4 — Request & Server Action Flow Audit (`performance/audit/request-action-audit.md`, `request-priority.md`) (2026-08-27)**:
  - **End-to-End Traces**: Traced 67 Server Actions across authentication, authorization, Zod validation, idempotency, database mutations, audit logs, and cache revalidation.
  - **Key Database Call Metrics**: Discovered `submitOperatorHourLogAction` performs 7 sequential DB calls (~180ms); identified N+1 single-row loop inserts in `finance.ts`, `inventory.ts`, and `tasks.ts`; mapped 27 `router.refresh()` call sites for optimistic state updates.
  - **Request Priority Ranking**: Generated `performance/audit/request-priority.md` categorizing all requests and Server Actions by `latency × frequency`.
  - **Verification**: Zero code modifications or regressions introduced.

- **Bug Fix: Development-Aware Content-Security-Policy with 'unsafe-eval' for React & Turbopack (`apps/web/next.config.ts`) (2026-08-27)**:
  - **Environment-Aware CSP Configuration**: Updated CSP header generator in `apps/web/next.config.ts` to include `'unsafe-eval'` in `script-src` and `ws: wss:` in `connect-src` during development (`process.env.NODE_ENV !== "production"`).
  - **Strict Production CSP Preservation**: Preserved strict security policies in production builds (strictly omitting `'unsafe-eval'`, enforcing `upgrade-insecure-requests`, `form-action 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, and `base-uri 'self'`).
  - **Console Error Elimination**: Resolved browser console error `eval() is not supported in this environment...` during Next.js 16 / Turbopack local development and debugging.
  - **Verification**: Executed `pnpm typecheck` passing cleanly with 0 compilation errors across all 9 monorepo workspace packages.

- **Phase 3 — Component Architecture & Lifecycle Audit (`performance/audit/component-audit.md`, `components.txt`, `route-components.txt`) (2026-08-27)**:
  - **Comprehensive Component Scan**: Audited all 180 React components in `apps/web` (127 Client, 53 Server Components, 89 stateful, 31 effect-bearing).
  - **Hot Components Ranked**: Analyzed state architectures and re-rendering lifecycles for `OperationsClient.tsx` (100.8 KB), `OperatorDashboard.tsx` (98.4 KB), `MachineListClient.tsx` (39.6 KB), and `users-client.tsx` (32.9 KB).
  - **Optimization Blueprint**: Mapped heavy print modals (`PrintableSupervisorLogsModal`, `PrintableOperatorLogsModal`, `xlsx`) for dynamic imports; classified all 31 `useEffect` instances (zero client-side data fetching waterfalls discovered).
  - **Verification**: Zero source code modifications or regressions introduced.

- **Phase 2 — Route-by-Route Performance Audit (`performance/audit/route-audit.md`) (2026-08-27)**:
  - **Comprehensive Route Matrix**: Audited all 10 core routes: `/login`, `/signup`, `/forgot-password`, `/machines`, `/users`, `/clients`, `/operations?tab=logs`, `/operations?tab=assignments`, `/operations?tab=entry`, and `/operations?tab=history`.
  - **Empirical Diagnostics**: Identified that `operations/page.tsx` executes 10 parallel queries fetching ~850 rows on every page render regardless of tab; documented redundant `getPendingUsers()` query on `/users`; documented cross-tab query over-fetching on `/machines`; mapped heavy print modals for dynamic import targets.
  - **Verification**: Zero code changes or regressions introduced.

- **Phase 1 — Comprehensive Monorepo Architecture & Codebase Audit (`performance/audit/*`) (2026-08-27)**:
  - **Full Workspace Audit**: Scanned 420 source and migration files without modifying application code. Audited 35 Web routes, 23 Mobile screens, 180 React components, 131 `"use client"` components, 65 Server Actions across 19 files, 97 DAL functions, 682 Supabase query lines, 43 database indexes, and 19 migrations.
  - **Comprehensive Audit Suite**: Created 13 audit specifications in `performance/audit/` (`routes.md`, `components.md`, `client-components.md`, `server-actions.md`, `database-calls.md`, `dal.md`, `database-schema.md`, `caching.md`, `network-calls.md`, `authentication.md`, `permissions.md`, `reports.md`, `dependencies.md`).
  - **Key Empirical Bottlenecks Identified**:
    - 🔴 **P0**: Direct inline Supabase querying inside `apps/web/app/(app)/operations/page.tsx` with wildcard `select("*")`.
    - 🔴 **P0**: Single-row loop inserts in `finance.ts`, `inventory.ts`, and `tasks.ts` (N+1 candidate).
    - 🔴 **P0**: Synchronous bundling of `PrintableSupervisorLogsModal` (40.9 KB) and `PrintableOperatorLogsModal` (23.4 KB) in client hubs.
    - 🟠 **P1**: 27 instances of `router.refresh()` triggering full-page server re-renders.
    - 🟠 **P1**: 75 wildcard `select("*")` calls across DAL and Server Actions.
    - 🟡 **P2**: Redundant email and client code indexes in PostgreSQL.
  - **Verification**: Zero code regressions or modifications introduced.

- **Phase 0 — Monorepo Backup & Performance Baseline (`performance/baseline/*`, `README.md`, `routes.md`, `database.md`, `queries.md`, `actions.md`, `build.md`) (2026-08-27)**:
  - **Git Branching & Safe Checkpoint**: Created and checked out dedicated `performance-optimization` branch. Committed clean baseline state.
  - **Monorepo Quality Gate Baseline**: Executed `pnpm typecheck` passing cleanly across all 9 monorepo workspace packages (Turbo uncached runtime 18.12s); recorded `pnpm lint` status (652 pre-existing problems: 281 errors, 371 warnings); executed `pnpm build` generating 35 routes in 1m 4s.
  - **HTTP Route Latency & Subresource Baseline**: Measured Next.js 16 production server (`next start` on port 3005) across all core routes (`/login`, `/signup`, `/machines`, `/users`, `/clients`, `/operations?tab=logs`, `/operations?tab=assignments`, `/operations?tab=entry`, `/operations?tab=history`). Captured request counts, transfer bytes, largest script chunks (`35aimukz77phg.js` 394.58 KB vendor bundle), and edge proxy redirect latencies (2.6ms – 4.3ms).
  - **Database Baseline (PostgreSQL 17)**: Catalogued exact row counts for 6 public tables (`users`: 28, `machines`: 1, `machine_hour_logs`: 25, `clients`: 1, `idempotency_keys`: 2, `audit_logs`: 2); recorded all 43 active B-tree and unique indexes; recorded database safeguards (`statement_timeout = 10s`, `lock_timeout = 5s`, `idle_in_transaction_session_timeout = 10s`).
  - **Query Statistics & Server Action Inventory**: Analyzed `pg_stat_statements` execution history and catalogued all mutation server actions and their lifecycle pipelines.
  - **Baseline Directory**: Created and populated `performance/baseline/` with `README.md`, `routes.md`, `database.md`, `queries.md`, `actions.md`, and `build.md`.
  - **Verification**: Zero code modifications introduced; all baseline measurements preserved for post-optimization comparison.

- **Users Table DAL Column Projection Fix & Infinite Auth Redirect Loop Remediation (Phase 108: `apps/web/lib/dal.ts`, `apps/web/proxy.ts`, `apps/web/app/(app)/layout.tsx`, `apps/web/app/actions/auth.ts`, `apps/web/app/actions/operators.ts`, `apps/web/app/actions/rentals.ts`, `apps/web/app/login/login-form.tsx`, `apps/web/app/login/page.tsx`) (2026-08-27)**:
  - **DAL Safe Projection (`apps/web/lib/dal.ts`)**: Resolved `Error fetching user row: column users.branch_id does not exist` (Postgres error 42703) by removing non-existent `branch_id` and `location` columns from `getCachedUserRow` selection query. Cached under `dal-user-row-v6`. Updated `redirect("/dashboard")` calls to `redirect("/machines")`.
  - **Infinite Redirect Loop Ping-Pong Elimination (`apps/web/app/(app)/layout.tsx`)**: Appended specific error search parameters (`/login?error=profile_not_found`, `/login?error=account_inactive`, `/login?error=account_pending`) to login redirects, breaking the cycle where proxy immediately bounced authenticated users back to `/machines`.
  - **Edge Proxy Method-Aware Rate Limiting & Parameter Awareness (`apps/web/proxy.ts`)**: Configured edge proxy to detect auth error search parameters and allow the login page to render without forced redirects. Separated rate limiting so navigation `GET` requests receive 120 req/min allowance while mutation `POST` requests enforce strict 10 req/min brute-force guards.
  - **Auth & Operational Action Cleanup (`auth.ts`, `operators.ts`, `rentals.ts`)**: Updated `login()` to redirect to `/machines` or `/operations?tab=entry`. Removed legacy `branch_id` writes to `users` table across operator and rental actions.
  - **Login UX Resilience (`login-form.tsx`, `page.tsx`)**: Added `useSearchParams` hook and user feedback banner for account approval and activation states, wrapped inside `<Suspense>`.
  - **Verification**: Verified `GET /login` (200 OK) and `GET /machines` (307 redirect). Executed `pnpm turbo run typecheck --force` passing across all 9 workspace packages (0 compilation errors).

- **Development Rate Limiting Bypass & Production-Only Safeguard (`apps/web/proxy.ts`, `apps/web/lib/security/rate-limiter.ts`) (2026-08-27)**:
  - **Edge Proxy Rate Limiting Bypass (`apps/web/proxy.ts`)**: Conditioned Step 1 LPDoS edge rate limiting guard on `process.env.NODE_ENV === "production"`. Prevents HTTP 429 "Too Many Requests" ("Request rate limit exceeded. LPDoS / Brute-force safeguard active.") errors during local development hot reloading and testing.
  - **Rate Limiter Utility Bypass (`apps/web/lib/security/rate-limiter.ts`)**: Updated `checkRateLimit` and `checkRateLimitAsync` to bypass evaluation and return `{ success: true, ... }` in development/test environments (`process.env.NODE_ENV !== "production"`).
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages passing cleanly with 0 compilation errors.

- **Comprehensive Security Audit & Penetration Test Remediation (Phase 106: `supabase.ts`, `environment.ts`, `019_security_remediation_self_mutation_hardening.sql`, `rate-limiter.ts`, `operators.ts`, `auth.ts`, `users.ts`, `machines.ts`, `dal.ts`, `walkthrough.md`) (2026-08-26)**:
  - **F-01 (P1 / CWE-798 — Hardcoded Mobile Credentials Removed)**: Removed hardcoded Supabase URL and anon key strings in `apps/mobile/lib/supabase.ts` and `apps/mobile/lib/environment.ts`, replacing them with fail-fast environment variable assertions.
  - **F-02 (P1 / CWE-284 — Self-Mutation RLS Hardening)**: Created database migration `019_security_remediation_self_mutation_hardening.sql` extending `prevent_self_role_status_mutation()` to block self-mutation of `email` column, preventing account takeover/impersonation via email manipulation.
  - **F-05 (P2 / CWE-799 — Distributed Rate Limiting Safeguard)**: Added production warning guard in `apps/web/lib/security/rate-limiter.ts` to log a critical alert if Upstash Redis is missing in production.
  - **F-06 (P2 / CWE-287 — Operator User Creation via Auth Admin API)**: Refactored `hireOperatorAction` in `apps/web/app/actions/operators.ts` to register users through `supabase.auth.admin.createUser()` with secure temporary passwords, automatic email confirmation, metadata sync, and employee directory sync.
  - **F-07 (P3 / CWE-20 — UUID Parameter Format Validation)**: Added `isValidUuid` validation across all user management actions (`approveUser`, `rejectUser`, `resetUserPassword`, `toggleUserStatus`, `updateUserRole`, `deleteUser`, `editUser`) and machine actions (`updateMachine`, `deleteMachine`, `reassignMachineSupervisor`).
  - **F-08 (P3 / CWE-284 — DAL Projection & Query Optimization)**: Updated `apps/web/lib/dal.ts` `getCachedUserRow` to use explicit column projection instead of `SELECT *`, and updated `getCurrentUserOrNull` to leverage cached lookups.
  - **F-10 (P2 / CWE-209 — Credential Leakage in Auth Responses)**: Removed `password` from `fieldValues` in all login error branches in `apps/web/app/actions/auth.ts`.
  - **F-11 (P3 / CWE-338 — Cryptographic PRNG for Employee Codes)**: Replaced `Math.random()` with `crypto.randomInt(1000, 10000)` in `apps/web/app/actions/users.ts` and `apps/web/app/actions/operators.ts`.
  - **Verification**: Executed `pnpm typecheck` passing across all 9 monorepo workspace packages (0 errors).

- **Full Web-to-Mobile Parity Synchronization & Mobile Device Optimization (Phase 105: `signup.tsx`, `login.tsx`, `forgot-password.tsx`, `machines.tsx`, `AddMachineModal.tsx`, `operations.tsx`, `MeterLogModal.tsx`, `users.tsx`, `UserDetailModal.tsx`, `CreateUserModal.tsx`, `MobileHeader.tsx`, `MobileDrawer.tsx`, `MainMenuModal.tsx`, `profile.tsx`, `walkthrough.md`) (2026-08-26)**:
  - **Mobile Registration Flow (`apps/mobile/app/(auth)/signup.tsx`)**: Built complete mobile registration screen matching Web `/signup` with all mandatory fields (`full_name`, `email`, `phone`, `role`, `city`, `district`, `state`, `password`, `confirm_password`), role picker bottom sheet modal, admin approval notice, and direct Supabase Auth `signUp()` integration.
  - **Mobile Auth & Gateway Polish (`login.tsx`, `forgot-password.tsx`, `index.tsx`)**: Standardized brand identity to "Reach International" with letter "R" emblem, redirecting authenticated users to `/(app)/machines`, and linking directly to `/(auth)/signup`.
  - **Live Machines Fleet Directory (`apps/mobile/app/(app)/machines.tsx`, `AddMachineModal.tsx`)**: Replaced static mock data with live Supabase database queries against `public.machines` (joining `current_supervisor` and `current_operator` from `public.users`). Added search, filter pills (`All Fleet`, `Available`, `Rented`), copyable Machine ID, specs well (HMR, Services count, Supervisor, Operator), Pull-to-refresh, `MachineDetailModal.tsx`, `MeterLogModal.tsx`, and `AddMachineModal.tsx`.
  - **Role-Aware Operations Hub (`apps/mobile/app/(app)/operations.tsx`, `MeterLogModal.tsx`)**: Built role-aware view segmentation: For Operators: Segmented tabs (`Log Entry` vs `Log History`), Section A (Machine model & serial, Client & Site auto-detection), Section B (Start/End HMR computation, Shift hours), Section C (Checklist & Breakdown duration). For Supervisors/Managers: Live Running Hours feed from `public.machine_hour_logs` with bold red breakdown duration formatting (`1h 30m`), search, status filter pills, and Operator Machine Assignments tab. Updated `MeterLogModal.tsx` with live client search/picker, auto-filling site location, start/end meter validation, breakdown duration input, and live database persistence.
  - **New User Management Module (`apps/mobile/app/(app)/users.tsx`, `UserDetailModal.tsx`, `CreateUserModal.tsx`)**: Created mobile User Management module for managers and admins (`super_admin`, `admin`, `service_manager`, `hr_manager`) with 4-card metric counters (`Total Users`, `Active`, `Engineers`, `Pending`), Pending Approvals banner with 1-tap Approve & Reject buttons, role filter pills and status filter, `UserDetailModal.tsx` (Status toggle, Role change, temporary password reset, account deletion), and `CreateUserModal.tsx`.
  - **Navigation & Shared Shell Synchronization**: Registered `users` tab screen in `_layout.tsx`, synchronized `navItems.ts`, and updated `MobileHeader.tsx`, `MobileDrawer.tsx`, `MainMenuModal.tsx`, and `profile.tsx` with Reach International brand tokens and direct `/machines` route.
  - **Verification**: Executed `pnpm turbo run typecheck --force` across all 9 packages (0 compilation errors).

- **Comprehensive Security Assessment & Vulnerability Remediation (6/6 Findings Fixed: `send-reminders.ts` -> `lib/notifications/send-reminders.ts`, `refresh.ts`, `packages/utils/src/sanitize.ts`, `NotificationPreviewModal.tsx`, `apps/mobile/lib/supabase.ts`, `apps/web/next.config.ts`, `apps/web/app/api/cron/send-reminders/route.ts`, `scratch/test_security_audit_fixes.mjs`, `walkthrough.md`) (2026-08-26)**:
  - **Server Action De-exposure (Finding 01 - P1 / CWE-306)**: Migrated `sendDailyReminders()` from public Server Action boundary `apps/web/app/actions/send-reminders.ts` into internal server library `apps/web/lib/notifications/send-reminders.ts` with `import "server-only";` and removed `"use server"`, eliminating the unauthenticated public HTTP RPC Server Action endpoint. Deleted `apps/web/app/actions/send-reminders.ts`.
  - **Cache Purge Authorization Guard (Finding 02 - P2 / CWE-306 / CWE-400)**: Enforced `await verifySession()` at the entry point of `refreshPageDataAction()` in `apps/web/app/actions/refresh.ts`, preventing unauthenticated LPDoS cache purges.
  - **DOM XSS Sanitization (Finding 03 - P2 / CWE-79)**: Implemented `sanitizeHtml(rawHtml)` utility in `packages/utils/src/sanitize.ts` and exported it from `@reachinternational/utils`. Sanitized raw HTML summary payloads in `apps/web/components/notifications/NotificationPreviewModal.tsx` before DOM injection via `dangerouslySetInnerHTML`.
  - **Mobile Hardware-Backed Token Persistent Storage (Finding 04 - P3 / CWE-311)**: Added `expo-secure-store` in `apps/mobile/package.json` and updated `apps/mobile/lib/supabase.ts` storage adapter to persist Supabase authentication and refresh tokens via `SecureStore.getItemAsync`, `SecureStore.setItemAsync`, and `SecureStore.deleteItemAsync` with web/memory fallback.
  - **Content Security Policy Hardening (Finding 05 - P3 / CWE-1021)**: Enhanced `Content-Security-Policy` header in `apps/web/next.config.ts` with `upgrade-insecure-requests`, `form-action 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`, and `worker-src 'self' blob:`.
  - **Webhook HMAC & Cron Secret Enforcement (Finding 06 - P3 / CWE-353)**: Updated `apps/web/app/api/cron/send-reminders/route.ts` to require `CRON_SECRET` bearer token verification across all environments when QStash cryptographic signatures are absent.
  - **Verification**: Executed automated test suite `scratch/test_security_audit_fixes.mjs` (22/22 tests PASSED cleanly) and verified `turbo run typecheck` passing across all 9 monorepo workspace packages (0 errors).

- **Mandatory Client Address (Address, City, State) Policy (`018_mandatory_client_address.sql`, `client.ts`, `database.ts`, `clients.ts`, `ClientModal.tsx`, `ClientDetailClient.tsx`, `clients.tsx`, `walkthrough.md`) (2026-08-26)**:
  - **Database Migration (`018_mandatory_client_address.sql`)**: Backfilled existing client records and added NOT NULL + check constraints `clients_address_not_empty`, `clients_city_not_empty`, `clients_state_not_empty` on `public.clients`. Applied live to Supabase PostgreSQL.
  - **Validation Schemas & Interfaces (`packages/validation`, `packages/types`)**: Updated `CreateClientSchema` and `UpdateClientSchema` in `client.ts` to strictly require `address` (min 2 chars), `city` (min 2 chars), and `state` (min 2 chars). Updated `CRMClient` interface in `database.ts` with non-nullable address fields.
  - **Web Application (`apps/web`)**: Updated `createClientAction` and `updateClientAction` to require and persist trimmed address fields. Updated `<ClientModal>` with required `*` indicators, HTML5 required attributes, and submission validation.
  - **Mobile App Synchronization (`apps/mobile`)**: Updated `ClientItem` interface with mandatory address fields; added Office/Plant Address \*, City \*, and State \* inputs with validation in mobile client modal.
  - **Verification**: Executed `turbo run typecheck` passing cleanly across all 9 packages (0 errors). Executed validation test suite `test-validation.mjs` verifying required client address rejection and acceptance. Verified check constraints live in Supabase PostgreSQL.

- **Mandatory User Details & Nullable Non-User Address Policy (`017_mandatory_user_details_and_nullable_address.sql`, `auth.ts`, `client.ts`, `database.ts`, `signup/page.tsx`, `auth.ts`, `UserCreateModal.tsx`, `UserEditModal.tsx`, `UserDetailSheet.tsx`, `users.ts`, `clients.ts`, `ClientModal.tsx`, `ClientsClient.tsx`, `profile.tsx`, `clients.tsx`, `CreateLeadModal.tsx`, `seed.mjs`, `admin.mjs`, `seed_dummy_data.mjs`, `walkthrough.md`) (2026-08-26)**:
  - **Database Trigger & Policy Hardening (`017_mandatory_user_details_and_nullable_address.sql`)**: Redefined `public.handle_new_user()` PostgreSQL trigger function to extract `city`, `district`, `state`, and `phone` directly from registration metadata (`NEW.raw_user_meta_data`) without fallback to `'Mumbai'` or `'Maharashtra'`. Re-asserted non-empty check constraints on `public.users`: `users_email_not_empty`, `users_city_not_empty`, `users_district_not_empty`, `users_state_not_empty`.
  - **Validation Schemas & Interfaces (`packages/validation`, `packages/types`)**: Updated `SignupSchema`, `CreateUserSchema`, and `UpdateUserSchema` in `auth.ts` to strictly require `full_name`, `email`, `phone` (min 10 digits), `password` (min 8 chars), `role`, `city` (min 2 chars), `district` (min 2 chars), and `state` (min 2 chars). Updated `client.ts` to make address fields optional/nullable. Updated `CRMClient` interface in `database.ts` with nullable address fields.
  - **Web Application (`apps/web`)**: Added mandatory City \*, District \*, and State \* inputs with validation in `/signup`. Enforced required fields and clean generic placeholders in `<UserCreateModal>` and `<UserEditModal>`. Removed hardcoded `"Mumbai"` / `"Maharashtra"` fallbacks in `<UserDetailSheet>`. In `createClientAction` and `updateClientAction`, stored `city: data.city || null` and `state: data.state || null`. Removed hardcoded `"Delhi"` / `"Mumbai"` defaults in `<ClientModal>`, `<ClientsClient>`, `<MachineComplaintModal>`, `<CrmClient>`, `<RentalManagementClient>`, `<BranchesClient>`, and `machine-client-view.tsx`.
  - **Mobile App Synchronization (`apps/mobile`)**: Safely rendered dynamic user location in `profile.tsx`. Made `city?: string; state?: string;` optional in `ClientItem` in `clients.tsx`; removed default `'Delhi'`. Initialized `city` state to `""` in `CreateLeadModal.tsx`.
  - **Seed Scripts (`supabase/`)**: Updated `seed.mjs`, `admin.mjs`, and `seed_dummy_data.mjs` test user metadata with complete address details.
  - **Verification**: Executed `turbo run typecheck` passing cleanly across all 9 packages (0 errors). Executed validation schema test suite with 100% pass rate. Verified check constraints live in Supabase PostgreSQL.

- **Enterprise Application Security Review & Vulnerability Remediation (9/9 Findings Fixed: `016_enterprise_security_hardening.sql`, `rate-limiter.ts`, `sms.ts`, `whatsapp.ts`, `useAuth.tsx`, `machine-import.ts`, `admin.mjs`, `seed.mjs`, `package.json`, `scratch/test_security_remediation.mjs`, `walkthrough.md`) (2026-08-26)**:
  - **Self-Registration Privilege Escalation Guard (Finding 01 - P0 / CWE-269)**: Re-defined `handle_new_user()` trigger function in `016_enterprise_security_hardening.sql` to strictly set `role = 'operator'` and `status = 'pending'`, discarding any untrusted client-supplied metadata.
  - **Machine Mutation RLS Policy Hardening (Finding 02 - P1 / CWE-284)**: Replaced `machines_update_authorized` RLS policy in migration 016, removing operator direct table write access and restricting machine updates strictly to authorized management/supervisor roles with identical `WITH CHECK` conditions.
  - **Append-Only Tamper-Proof Audit Logging Pipeline (Finding 03 - P1 / CWE-778)**: Created `public.audit_logs` table in migration 016 with UUID primary keys, user foreign key reference, action/entity indexing, and append-only RLS policies (strictly no UPDATE or DELETE allowed).
  - **Spoof-Proof Edge Rate Limiter (Finding 04 - P2 / CWE-799)**: Hardened `getClientIp` in `apps/web/lib/security/rate-limiter.ts` to inspect canonical platform headers (`cf-connecting-ip`, `x-real-ip`, `true-client-ip`) and extract the rightmost non-spoofed IP from `x-forwarded-for`.
  - **Notification Lazy Initialization Resilience (Finding 05 - P2 / CWE-703)**: Refactored `apps/web/lib/notifications/sms.ts` and `apps/web/lib/notifications/whatsapp.ts` to lazily instantiate Twilio clients via `getTwilioClient()`, eliminating module import crashes in unconfigured environments.
  - **Mobile Client Auth & Role Resolution Hardening (Finding 06 - P2 / CWE-285)**: Removed insecure `'service_engineer'` fallback in `apps/mobile/lib/auth/useAuth.tsx` and added asynchronous synchronization with `public.users` table, revoking sessions if account status is `inactive` or `pending`.
  - **Spreadsheet Upload Size & MIME Type Validation (Finding 07 - P3 / CWE-434)**: Added 10MB file size limit, zero-byte detection, and MIME type/file extension allowlist validation in `apps/web/app/actions/machine-import.ts`.
  - **Source Control PII & Password Sanitization (Finding 08 - P3 / CWE-312)**: Purged developer personal email and phone number from `supabase/admin.mjs`. Supported environment-driven seed passwords with cryptographically secure random password generation fallback in `supabase/admin.mjs` and `supabase/seed.mjs`.
  - **Dependency Supply Chain Overrides (Finding 09 - P3 / CWE-835)**: Added overrides for `image-size` (`>=2.0.3`), `postcss` (`>=8.5.23`), and `uuid` (`>=11.1.1`) in root `package.json`.
  - **Verification**: Executed live security test suite `scratch/test_security_remediation.mjs` (21/21 tests passed cleanly) and verified `turbo run typecheck` passing with 0 errors across all 9 packages.

- **Multi-Layered Server-Side Template Injection (SSTI) Defense-in-Depth Architecture (`packages/utils/src/ssti.ts`, `apps/web/lib/email.ts`, `lib/notifications/email-templates.tsx`, `AI/RULES/SECURITY.md`, `scratch/test_ssti_security.ts`, `README.md`) (2026-08-26)**:
  - **Shared Safe Template & HTML Escaping Module (`packages/utils/src/ssti.ts`)**: Implemented `escapeHtml(value)` (converting `&`, `<`, `>`, `"`, `'`, `/`, `` ` `` to safe HTML entities) and `renderSafeTemplate(template, params, options)` (single-pass, non-evaluating placeholder substitution for `{{ key }}` templates with zero code execution, zero object navigation, and non-recursive replacement preventing double-evaluation SSTI vectors).
  - **Email HTML Template Hardening (`apps/web/lib/email.ts` & `apps/web/lib/notifications/email-templates.tsx`)**: Hardened `sendWelcomeEmail`, `sendApprovalEmail`, `sendRejectionEmail`, `sendPendingApprovalEmailToAdmins`, and `sendPasswordResetNotification` in `email.ts` to sanitize all dynamic fields (`name`, `email`, `password`, `userName`, `userEmail`, `userRole`, `newPassword`) using `escapeHtml()`. Sanitized all dynamic fields in `getServiceReminderEmailHtml`, `getDailySummaryEmailHtml`, `getImportCompletedEmailHtml`, and `getReminderFailedEmailHtml` in `email-templates.tsx`.
  - **Authoritative Security Policy (`AI/RULES/SECURITY.md`)**: Added Section 47 (SSTI Security Policy) prohibiting dynamic code execution (`eval()`, `new Function()`, `vm`), mandating HTML output encoding for raw HTML generators, enforcing single-pass static parameter substitution, and separating code from data.
  - **Automated SSTI Security Suite (`scratch/test_ssti_security.ts`)**: Built comprehensive test suite verifying expression execution prevention (`{{ 7 * 7 }}`), system object navigation block (`{{ process.env }}`), double evaluation prevention, HTML script tag escaping, and email template output sanitization. All 7 tests passed 100%.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors across 9/9 packages**).

- **Multi-Layered LPDoS & ReDoS Security Defense-in-Depth Architecture (`packages/validation/src/*`, `apps/web/proxy.ts`, `rate-limiter.ts`, `timeout.ts`, `next.config.ts`, `014_set_statement_timeouts_and_dos_guards.sql`, `apps/mobile/lib/security.ts`, `scratch/test_redos_security.ts`, `README.md`) (2026-08-26)**:
  - **OWASP ReDoS Hardening (`packages/validation`)**: Standardized input validation flow across all 17 Zod schema files (`User Input ↓ Max Length Check ↓ Simple Validation ↓ Safe Linear Regex ↓ Business Validation`). Added explicit `.max(...)` string length limits to ALL string fields in `auth.ts`, `machine.ts`, `hourMeter.ts`, `client.ts`, `common.ts`, `clipboard.ts`, `complaint.ts`, `finance.ts`, `fsr.ts`, `hr.ts`, `inventory.ts`, `parts.ts`, `rental.ts`, `sales.ts`, and `task.ts`. Audited all regular expressions to guarantee non-backtracking linear allowlists.
  - **Automated ReDoS Security Test Suite (`scratch/test_redos_security.ts`)**: Executed security benchmark testing schemas against 50,000-character malicious backtracking strings. Verified 7/7 tests passed cleanly in <2ms with zero CPU spikes.
  - **Edge Rate Limiting & Proxy Protection (`apps/web/proxy.ts`, `lib/security/rate-limiter.ts`)**: Created sliding-window rate limiter in `apps/web/lib/security/rate-limiter.ts`. Integrated into Next.js edge proxy `proxy.ts` (10 req/min for auth routes `/login`, `/signup`; 60 req/min for API POSTs; 300 req/min for user sessions), rejecting abusive traffic with HTTP 429 Too Many Requests before reaching server resources.
  - **Execution Timeouts & Payload Size Caps (`apps/web/next.config.ts`, `lib/security/timeout.ts`)**: Configured 1MB Server Action payload limit (`serverActions.bodySizeLimit: "1mb"`) and created 10-second `AbortController` request execution timeout guard `withExecutionTimeout()`.
  - **PostgreSQL Statement Timeouts (`014_set_statement_timeouts_and_dos_guards.sql`)**: Applied SQL migration on Supabase PostgreSQL configuring `statement_timeout = '10000ms'` (10s), `lock_timeout = '5000ms'`, and `idle_in_transaction_session_timeout = '10000ms'`. Created and verified `public.check_dos_protection_settings()`.
  - **Mobile App Synchronization (`apps/mobile/lib/security.ts`)**: Added 15-second mobile request timeout guard (`fetchWithTimeout`) and input string length check helper (`validateMobileInputLength`).
  - **Documentation & Quality Gate (`README.md`)**: Updated `README.md` to document the LPDoS & ReDoS security architecture. Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors across 9/9 packages**).

- **Page Feedback: Unused Sidebar Navigation Sub-Items & Tabs Soft Removal (`AppSidebar.tsx`, `OperationsClient.tsx`, `MachineListClient.tsx`, `CommandPalette.tsx`, `navItems.ts`) (2026-08-26)**:
  - **Sidebar Navigation Sub-Items Soft Removal (`AppSidebar.tsx`)**: Soft-removed (commented out) **"Operator Roster & Salary"** (`tab: "operators"`) and **"Site Movement / Loading-Unloading"** (`tab: "site-movement"`) from `mainNavItems` and `visibleMainItems` under `/operations`, and **"Service Logs"** (`tab: "services"`) and **"Breakdown Complaints"** (`tab: "complaints"`) under `/machines` across all roles per user feedback.
  - **Operations & Machine View Route Alignment (`OperationsClient.tsx`, `MachineListClient.tsx`)**: Updated `validTabs` array to `["logs", "assignments"]` for non-operators in `<OperationsClient>` and soft-removed sub-menu tab buttons in `<MachineListClient>`, keeping underlying component code and handlers intact for future activation.
  - **Command Palette Clean Up (`CommandPalette.tsx`)**: Soft-removed `nav-services` command item from quick access search results.
  - **Mandatory Web-to-Mobile Synchronization (`apps/mobile/lib/nav/navItems.ts`)**: Soft-removed matching sub-items (`Service Logs`, `Complaints`, `Site Movement`, `Operators`) in mobile `mobileNavItems`.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Bug Fix: Next.js 16 Edge Proxy Convention Adoption (`apps/web/proxy.ts`, Teardown of `middleware.ts`) (2026-08-26)**:
  - **Adoption of Next.js 16 `proxy.ts` Convention (`apps/web/proxy.ts`)**: Standardized on a single [`apps/web/proxy.ts`](file:///C:/Users/vaibh/PROGRAMMING/PROJECTS/ReachInternational-Monorepo/apps/web/proxy.ts) file exporting `export async function proxy(request: NextRequest)` and static `export const config = { matcher: [...] }` to align 100% with Next.js 16 Turbopack conventions.
  - **Deprecation Warning Teardown (`apps/web/middleware.ts`)**: Completely deleted `apps/web/middleware.ts` to eliminate `⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.` warning.
  - **Empirical Status Verification**: Verified `GET /login` returns **200 OK**, and `GET /operations?tab=logs` returns **307 Redirect to /login** followed by **200 OK** with zero deprecation warnings.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /login Mesh Gradient Desktop-Only Responsive Visibility (`login/page.tsx`, `login-form.tsx`, `signup/page.tsx`) (2026-08-25)**:
  - **Desktop-Only Hero Panel (`login/page.tsx`, `signup/page.tsx`)**: Refactored `.mesh-gradient` hero container class to `hidden lg:flex flex-col justify-between ...`, hiding the hero panel on mobile/tablet viewports (< 1024px) so mobile screens display strictly the login/signup form per user feedback.
  - **Mobile Brand Logo Integration (`login-form.tsx`, `signup/page.tsx`)**: Added centered mobile brand logo (`flex lg:hidden justify-center mb-6`) at top of form cards to ensure clear brand identity on mobile devices.
  - **Mobile Form Centering (`login/page.tsx`, `signup/page.tsx`)**: Configured form containers to `min-h-screen lg:min-h-0` for full height vertical centering on mobile.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=logs Machine ID & Client Details Teardown from Machine View Metadata Strip (`PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`) (2026-08-25)**:
  - **Machine ID Removal (`PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`)**: Removed redundant `Machine:` (`machine_name` / `machine_code` / Machine ID `RI-MC-0001`) from top metadata strip and `scopeLabel` in Machine view mode per user feedback item 2.
  - **Client Details Teardown in Machine View (`PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`)**: Completely removed `Client:` and `Location:` key-value pairs from the Machine view mode top metadata strip per user feedback item 3, maintaining 100% focus on machine specs (`Manufacturer: HYUNDAI | Model: 50B-9 | Serial No.: HHKHB303EF0000877 | Total Run: 300 hrs | Export Date: 25/08/2026`).
  - **Clean & Formatted Header Strip (`PrintableSupervisorLogsModal.tsx`)**: Streamlined the metadata strip container (`.bg-white > .pb-2 > .flex`) into a clean, compact, clutter-free single-line metadata bar per user feedback item 1.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=logs Report Title Centering & Client/Location Formatting (`PrintableSupervisorLogsModal.tsx`, `PrintableOperatorLogsModal.tsx`, `supervisor-logs-export.ts`) (2026-08-25)**:
  - **Report Titles Centering (`PrintableSupervisorLogsModal.tsx`, `PrintableOperatorLogsModal.tsx`)**: Refactored PDF report top header containers into a balanced 3-column grid (`grid grid-cols-[110px_1fr_110px] sm:grid-cols-[140px_1fr_140px] items-center gap-2`). Centered report title headers (`text-center font-black uppercase text-neutral-900 tracking-wider`) across all report types: `"MACHINE RUNNING HOURS REPORT"`, `"SITE MACHINE RUNNING HOURS REPORT"`, `"OPERATOR DAILY MACHINE LOG REPORT"`, and `"SUPERVISOR MACHINE RUNNING HOURS REPORT"`.
  - **Client Name & Client Location Formatting (`PrintableSupervisorLogsModal.tsx`)**: Replaced single-client name text with a centered, uppercase subheading displaying both Client Name and resolved Client Location: `CLIENT: SAINT GOBAIN | LOCATION: JHAJJAR, HARYANA`. Dynamically resolves location from site filter or underlying log/client/machine records even when site filter is "All Sites".
  - **Machine View Metadata Polish (`PrintableSupervisorLogsModal.tsx`)**: Included explicit `Client` and `Location` key-value pairs in the top metadata strip for Machine view mode PDF exports.
  - **Excel Export Metadata Alignment (`supervisor-logs-export.ts`)**: Updated `filterScopeText` for Client view mode Excel export to output `Client: ${selectedEntityId} | Location: ${siteText}`.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=entry Reusable Hour & Minute Selector Time Picker Refactoring (`CustomTimePicker.tsx`, `CreateTaskModal.tsx`, `OperatorDashboard.tsx`, `index.ts`) (2026-08-25)**:
  - **`CustomTimePicker` Component Refactoring (`CustomTimePicker.tsx`)**: Replaced radial circular SVG clock needles and dial face with explicit 1-click grid selectors: 4x3 Hours view (`01`–`12`), 4x3 Minutes view (`00`–`55`), digital time header bar with mode switching (`HH`, `MM`), and AM/PM segmented switcher buttons.
  - **Quick Shift Presets (`CustomTimePicker.tsx`)**: Added quick action pills for common industrial operational shifts (`06:00 AM`, `08:00 AM`, `02:00 PM`, `08:00 PM`) and `"Set Now"` (IST Asia/Kolkata current local time).
  - **Direct Keyboard Typing & Portal Positioning (`CustomTimePicker.tsx`)**: Supported direct text field typing + React Portal (`document.body`) with dynamic space-above / space-below positioning.
  - **Monorepo-Wide Standardization (`CreateTaskModal.tsx`, `index.ts`)**: Replaced raw native `<Input type="time" ... />` in `<CreateTaskModal>` with `<CustomTimePicker label="Due Time (Optional)" ... />` and exported canonical primitive from `@/components/ui`.
  - **Operator Dashboard Integration (`OperatorDashboard.tsx`)**: Verified Start Time and End Time selection in Section B (Daily Log Entry) and Edit Log Modal, preserving 100% real-time duration and overtime calculations (`computeOperatingHours`).
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=logs Machine Manufacturer Display in Machine Tab & PDF Export Report (`OperationsClient.tsx`, `PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`) (2026-08-25)**:
  - **Machine Details Summary Header Card (`OperationsClient.tsx`)**: Refactored summary grid (`logsViewMode === "machine"`) to 6 columns (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`) and added a dedicated **Manufacturer** block displaying `activeMachineObj.manufacturer || "—"` (e.g. `HYUNDAI`).
  - **Machine Select Dropdown Options (`OperationsClient.tsx`)**: Updated `formatMachineSelectLabel(m)` helper function to include `m.manufacturer` if present (e.g. `RI-MC-0001 (HYUNDAI 50B-9 — S/N: HHKHB303EF0000877)`).
  - **PDF Export Report Metadata (`PrintableSupervisorLogsModal.tsx`)**: Added `<div><strong>Manufacturer:</strong> {selectedMachineObj?.manufacturer || (logs[0]?.machine as any)?.manufacturer || "—"}</div>` to top metadata header block in Machine mode PDF export (`viewMode === "machine"`).
  - **Excel Export Utility (`supervisor-logs-export.ts`)**: Updated Machine mode Excel export `filterScopeText` to output `Manufacturer: ${mMfr}`.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=entry `<OperationsClient>` & `<OperatorDashboard>` Full Space Expansion & Sidebar Expand/Collapse Support (`AppShellClient.tsx`, `operations/page.tsx`, `OperationsClient.tsx`, `OperatorDashboard.tsx`, Monorepo Client Viewports) (2026-08-25)**:
  - **App Layout Max-Width Teardown (`AppShellClient.tsx`)**: Replaced fixed `max-w-[1400px] mx-auto` container restriction on `<main>` with `max-w-full w-full`. Guarantees main content viewport expands across 100% of available screen width and dynamically resizes when desktop sidebar toggles between expanded (`260px`) and collapsed (`68px`).
  - **Operations Route Double Padding Cleanup (`apps/web/app/(app)/operations/page.tsx`)**: Removed redundant outer `<div className="p-4 sm:p-6">` wrapper around `<OperationsClient>`, eliminating double padding and permitting `<OperationsClient>` to stretch full width.
  - **Operations Client Root Layout (`OperationsClient.tsx`)**: Updated root container to `w-full space-y-6`.
  - **Operator Dashboard Outer Padding Cleanup (`OperatorDashboard.tsx`)**: Stripped redundant outer padding `sm:p-6` from root div, leaving `w-full space-y-3 sm:space-y-6` so form cards, header banners, and history tables fill 100% of container space.
  - **Monorepo Client Max-Width Cleanup**: Removed hardcoded `max-w-[1400px] mx-auto` restrictions across all monorepo client components (`AdminClient.tsx`, `ChallansClient.tsx`, `ClientDetailClient.tsx`, `CrmClient.tsx`, `DocumentsClient.tsx`, `MyWorkClient.tsx`, `PODetailClient.tsx`, `PurchaseOrdersClient.tsx`, `RentalManagementClient.tsx`, `ReportsClient.tsx`, `ServiceHubClient.tsx`, `VendorDetailClient.tsx`, `VendorsClient.tsx`), standardizing on `w-full space-y-6`.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **PDF Export Documents Top-Left Official Logo (`pdf-logo.png`) Header Integration (`PrintableSupervisorLogsModal.tsx`, `PrintableOperatorLogsModal.tsx`, `FieldServiceReportModal.tsx`, `PrintableDeliveryChallan.tsx`, `PrintablePartsIssueChallan.tsx`, `PrintablePurchaseOrder.tsx`) (2026-08-25)**:
  - **Supervisor Running Hours PDF Report (`PrintableSupervisorLogsModal.tsx`)**: Refactored top header container to present `/pdf-logo.png` logo in top-left corner (`h-10 sm:h-12 w-auto object-contain`). Aligned report title, client name subheading, and scope metadata strip cleanly alongside top-left logo.
  - **Operator Daily Log PDF Report (`PrintableOperatorLogsModal.tsx`)**: Integrated `/pdf-logo.png` top-left logo image and aligned report title and consolidated operator metadata.
  - **Field Service Report (FSR) (`FieldServiceReportModal.tsx`)**: Added top-left `/pdf-logo.png` logo in `#printable-fsr-report` document header alongside report title and company address.
  - **Delivery Challan (`PrintableDeliveryChallan.tsx`)**: Replaced SVG logo with top-left `/pdf-logo.png` logo image (`h-12 w-auto object-contain self-start`).
  - **Parts Issue Challan (`PrintablePartsIssueChallan.tsx`)**: Added top-left `/pdf-logo.png` logo image to the Parts Issue Challan document header block.
  - **Purchase Order (`PrintablePurchaseOrder.tsx`)**: Replaced SVG logo with top-left `/pdf-logo.png` logo image (`h-12 w-auto object-contain self-start`).
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=entry Daily Machine Log Form Section A Model & Serial Field Refactoring (`OperatorDashboard.tsx`, `apps/mobile/components/work/MeterLogModal.tsx`) (2026-08-25)**:
  - **Section A Layout & Label Refactoring (`OperatorDashboard.tsx`)**: Renamed primary machine dropdown selector label from **`Machine Name *`** to **`Model *`** per user feedback item 2. Refactored dropdown button text to present `selectedMachine.model || selectedMachine.machine_name` with a small font-mono badge for machine code (`RI-MC-0001`), eliminating text duplication (e.g. `RI-MC-0001 (50B-9) RI-MC-0001`). Renamed the second input box from **`Machine Code / No. *`** to **`Serial Number`** per user feedback item 3, displaying `selectedMachine?.serial_number || selectedMachine?.machine_code || "—"`.
  - **Redundancy Teardown (`OperatorDashboard.tsx`)**: Completely removed the 3rd box (**`Model *`**) and 4th box (**`Serial Number`**) read-only inputs from Section A per user feedback item 1, streamlining Section A into a clean 2-column grid for Machine (Model dropdown & Serial Number read-only box) and 2-column grid for Client (Client Name dropdown & Site Location input).
  - **Confirmation Modal Header Polish (`OperatorDashboard.tsx`)**: Updated confirmation dialog modal to display **`Machine Model`** (`selectedMachine?.model || selectedMachine?.machine_name || "—"`) and **`Machine Serial No.`** (`selectedMachine?.serial_number || selectedMachine?.machine_code || "—"`).
  - **Mandatory Web-to-Mobile Synchronization (`apps/mobile/components/work/MeterLogModal.tsx`)**: Updated `MeterLogModalProps` in mobile app to accept `model` and `serialNumber` parameters, maintaining 100% feature parity.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=entry Client Selector, Client Site Location Autofill & Database Pre-Selection (`OperatorDashboard.tsx`, `OperationsClient.tsx`, `operators.ts`, `PrintableOperatorLogsModal.tsx`, `apps/mobile/components/work/MeterLogModal.tsx`) (2026-08-25)**:
  - **Searchable Client Dropdown in Log Entry (`OperatorDashboard.tsx`)**: Added searchable **Client / Customer Name** dropdown component to Section A of the Daily Log Entry form (`/operations?tab=entry`), displaying active database clients (`public.clients`) with client name, code (`CLI-XXXX`), and site location.
  - **Database Machine -> Client Auto-Detection (`OperatorDashboard.tsx`)**: Implemented `findClientForMachine()` helper that automatically detects the machine's assigned client from recent logs or database machine customer details (`customer_name`), auto-selecting the client and populating the **Client Site Location** field upon page load or machine switch.
  - **Site Location Autofill & Manual Override (`OperatorDashboard.tsx`)**: Selecting a client from the dropdown automatically populates the **Client Site Location** input with the client's registered address, city, and state, while allowing manual location edits.
  - **Backend Server Actions & Database Persistence (`operators.ts`)**: Updated `submitOperatorHourLogAction` and `updateOperatorHourLogAction` payloads to accept `clientId` and `location`, persisting `client_id` and `location` directly into `public.machine_hour_logs`.
  - **PDF Report & Confirmation Modal Synchronization (`PrintableOperatorLogsModal.tsx`, `OperatorDashboard.tsx`)**: Updated submission confirmation dialog and PDF print report modal to display Client Name and Site Location.
  - **Mandatory Web-to-Mobile Synchronization (`apps/mobile/components/work/MeterLogModal.tsx`)**: Updated mobile meter log modal to accept and log site location, ensuring 100% web-to-mobile feature parity.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Indian Standard Time (IST - Asia/Kolkata / UTC+5:30) Database Timezone Configuration & Migration 011 (`011_alter_machine_hour_logs_time_columns.sql`) (2026-08-25)**:
  - **Database Timezone Configuration**: Configured Supabase PostgreSQL database to explicitly use **Indian Standard Time (IST - Asia/Kolkata / UTC+5:30)** (`ALTER DATABASE postgres SET timezone TO 'Asia/Kolkata';`). Updated `log_date` column default in `public.machine_hour_logs` to `(now() AT TIME ZONE 'Asia/Kolkata')::date`.
  - **Column Data Type Conversion**: Converted `start_time` and `end_time` columns in `public.machine_hour_logs` from `TEXT` to native PostgreSQL `TIME WITHOUT TIME ZONE` data types.
  - **Native Trigger Functions (`check_machine_hour_log_shift_overlap`, `auto_calculate_machine_hour_log_overtime`)**: Refactored shift overlap prevention and overtime auto-calculation triggers to perform native time comparisons (`NEW.start_time >= start_time`) and duration calculations (`NEW.end_time - NEW.start_time`) without text casting.
  - **Verification**: Executed `SHOW timezone;` and `SELECT now()` returning IST time (`+05:30`). Ran `pnpm typecheck` across all 9 workspace packages (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /operations?tab=logs & /operations?tab=history Breakdown Duration Time Only Display Formatting (`OperationsClient.tsx`, `OperatorDashboard.tsx`, `PrintableSupervisorLogsModal.tsx`, `PrintableOperatorLogsModal.tsx`, `supervisor-logs-export.ts`, `operator-logs-export.ts`, `apps/mobile/app/(app)/operations.tsx`) (2026-08-25)**:
  - **Direct Breakdown Time Formatting**: Updated breakdown duration rendering across `/operations?tab=logs` and `/operations?tab=history` to display strictly the breakdown time (e.g. `2h 30m` or `🔴 2h 30m`) instead of `Breakdown (2h 30m)` per user feedback.
  - **Resilient Fallback Handling**: If a duration string is present in `remarks` or breakdown metadata (e.g. `[Breakdown Duration: 2h 30m]`), extracts and displays the time duration directly (`2h 30m`). Falls back gracefully to `Breakdown` if duration time is unspecified.
  - **PDF & Excel Synchronization**: Updated PDF print report modals (`PrintableSupervisorLogsModal.tsx`, `PrintableOperatorLogsModal.tsx`) and Excel export utilities (`supervisor-logs-export.ts`, `operator-logs-export.ts`) to output `2h 30m` directly in breakdown cells.
  - **Mandatory Web-to-Mobile Synchronization**: Updated mobile operations screen (`apps/mobile/app/(app)/operations.tsx`) error badge to display `1h 30m` / `2h 30m` directly.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=logs Breakdown Column Name & Red Duration Text Formatting (`OperationsClient.tsx`, `PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`, `PrintableOperatorLogsModal.tsx`, `operator-logs-export.ts`, `apps/mobile/app/(app)/operations.tsx`) (2026-08-25)**:
  - **Column Header Renaming**: Renamed generic `Status` / `STATUS` table column header to `Breakdown` / `BREAKDOWN` across Operator, Client, Machine, and Fleet View modes in `<OperationsClient>`, PDF print report modal (`PrintableSupervisorLogsModal`), and Excel export utilities (`supervisor-logs-export.ts`, `operator-logs-export.ts`).
  - **Red Breakdown Duration Text Formatting**: Updated Breakdown column cell rendering to parse breakdown duration (e.g. `[Breakdown Duration: 2h 30m]`). When a breakdown occurs (`log.is_breakdown === true`), renders the total breakdown duration (e.g. `Breakdown (2h 30m)`) in **bold red font text** (`text-rose-600 dark:text-rose-400 font-extrabold`) with an alert icon in desktop tables, mobile touch cards, PDF print report modals (`text-rose-700 font-extrabold`), and Excel export files.
  - **Mandatory Web-to-Mobile Synchronization**: Synchronized mobile operations screen (`apps/mobile/app/(app)/operations.tsx`) to render breakdown duration in red badge/text when breakdown occurs.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Bug Fix: /operations?tab=entry PostgreSQL Trigger "operator does not exist: text - text" Error (`010_fix_shift_time_comparison_trigger.sql`, `004_create_machine_hour_logs_table.sql`) (2026-08-25)**:
  - **Root Cause & Diagnosis**: PostgreSQL error `42883: operator does not exist: text - text` occurred during `machine_hour_logs` row insertions. Trigger function `auto_calculate_machine_hour_log_overtime()` executed `ROUND(EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) / 3600.0, 2)`. Because `NEW.start_time` and `NEW.end_time` are `TEXT`, PostgreSQL attempted `TEXT - TEXT` subtraction which is not a valid PostgreSQL binary operator.
  - **Database Migration & Trigger Fix (`010_fix_shift_time_comparison_trigger.sql`, `004_create_machine_hour_logs_table.sql`)**: Refactored `auto_calculate_machine_hour_log_overtime()` to cast `NEW.start_time::TIME` (`06:00:00`) and `NEW.end_time::TIME` (`16:00:00`). Evaluates `v_end_t - v_start_t` as an `INTERVAL` type, cleanly computing overtime while gracefully supporting overnight shifts (`+ INTERVAL '24 hours'`). Executed SQL migration in Supabase.
  - **Verification**: Executed `execute_sql` MCP tool and `npx tsc --noEmit` on `apps/web` (**Passed cleanly with 0 compilation errors**).

- **Bug Fix: /operations?tab=entry PostgreSQL Trigger Shift Time Comparison Error for 12-Hour AM/PM Formatted Strings (`010_fix_shift_time_comparison_trigger.sql`, `004_create_machine_hour_logs_table.sql`) (2026-08-25)**:
  - **Root Cause & Diagnosis**: `start_time` and `end_time` columns in `public.machine_hour_logs` are stored as `TEXT`. The PostgreSQL trigger `check_machine_hour_log_shift_overlap()` executed `IF NEW.end_time <= NEW.start_time THEN`, comparing strings (`"04:00 PM"` vs `"06:00 AM"`). Lexicographically, `"04:00 PM"` < `"06:00 AM"`, causing PL/pgSQL to throw `"Shift end time (04:00 PM) must be strictly after start time (06:00 AM)"`.
  - **Database Migration & Trigger Fix (`010_fix_shift_time_comparison_trigger.sql`, `004_create_machine_hour_logs_table.sql`)**: Refactored `check_machine_hour_log_shift_overlap()` to cast `NEW.start_time::TIME` (`06:00:00`) and `NEW.end_time::TIME` (`16:00:00`). Correctly compares `16:00:00 > 06:00:00` as `VALID` (960 > 360 minutes), eliminating false error banners while preserving identical time guards and shift overlap checks. Executed SQL migration in Supabase.
  - **Verification**: Executed `execute_sql` MCP tool and `npx tsc --noEmit` on `apps/web` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /operations?tab=entry Daily Log Confirmation Modal UI/UX Polish, Icon Teardown & Machine Serial Number Display (`OperatorDashboard.tsx`) (2026-08-25)**:
  - **Machine Serial Number Display (`OperatorDashboard.tsx`)**: Replaced duplicate `Machine Code & Model` box (`RI-MC-0001 · 50B-9`) in daily log submission confirmation modal with `Machine Serial No.` rendering `selectedMachine?.serial_number || machineNo || "—"` per user feedback item 1.
  - **Modal Description Paragraph Teardown (`OperatorDashboard.tsx`)**: Completely removed `description="Please confirm daily machine log summary details before recording."` prop from `<Modal>`, eliminating the description text block per user feedback item 2.
  - **Title Icon Removal & UI/UX Polish (`OperatorDashboard.tsx`)**: Removed `<Send>` airplane icon from modal title header (`Submit Daily Machine Log?`), streamlined modal footer buttons with Geist system tokens (`rounded-lg`, `shadow-2xs`), and updated section labels to uppercase Geist Mono (`font-mono font-bold uppercase tracking-wider`) per user feedback item 3.
  - **Verification**: Executed `npx tsc --noEmit` on `apps/web` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /operations?tab=logs Separate Machine Model & Machine Serial Number Columns in Operator View Mode (`OperationsClient.tsx`, `PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`) (2026-08-25)**:
  - **Separate Machine Model & Machine Serial Number Columns (`OperationsClient.tsx`, `PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`)**: Replaced combined `Machine Details` column in Operator View Mode (`logsViewMode === "operator"`) with two distinct columns: `Model` (rendering `mObj.model || "—"`) and `Serial Number` (rendering `mObj.serial_number || mObj.machine_code || "—"`). Updated empty row `colSpan` to 10, mobile touch card grid to present `Model` and `Serial Number` in two separate fields, PDF print report modal (`isOperatorView`), and Excel export fallback logic.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /machines Sub-Menu Teardown, Desktop Table / Mobile Card Reflow & MobileMachineCard Polish (`MachineListClient.tsx`, `MobileMachineCard.tsx`) (2026-08-25)**:
  - **Sub-Menu Desktop Teardown & Mobile Optimization (`MachineListClient.tsx`)**: Hidden top tab sub-menu strip (`Machine Directory`, `Service Logs`, `Breakdown Complaints`) on desktop screens (`lg:hidden`) since sub-items already exist in the desktop sidebar per feedback item 1. Kept and optimized full-width scrollable tab strip for mobile/tablet screens (`flex lg:hidden`).
  - **Default Desktop Table & Mobile Card View (`MachineListClient.tsx`)**: Configured page to render high-density `<EnterpriseTable>` by default on desktop (`hidden sm:block`) and `<MobileMachineCard>` grid view by default on mobile viewports (`block sm:hidden`) per feedback item 2, completely eliminating horizontal table overflow on mobile devices.
  - **Card Initial Circle Avatar Teardown (`MobileMachineCard.tsx`)**: Removed initial letter circle avatar icon container (`<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full ...">`) from `<MobileMachineCard>` per feedback item 3.
  - **Card Visual Polish & Formatting (`MobileMachineCard.tsx`)**: Refactored `<MobileMachineCard>` styling to adhere to Vercel Geist design system tokens (`DESIGN.md`) per feedback item 4. Replaced raw gradients and thick left accent borders with clean elevated canvas (`bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-xl shadow-2xs`). Formatted machine specs into a structured inset grid (HMR, Services Count, Supervisor, Operator) with spacious touch action buttons.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=logs Machine Details Formatting in Operator View Mode (`OperationsClient.tsx`, `PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`) (2026-08-25)**:
  - **Machine Label Removal & Column Formatting (`OperationsClient.tsx`, `PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`)**: Removed generic machine label (`mObj?.machine_name || "Machine"`) from Operator View Mode per feedback item 1. Re-formatted Machine Details cells across desktop table, mobile touch cards, PDF print report modal (`isOperatorView`), and Excel export utility per feedback item 2 to display bold Machine Model Name on line 1 (`mObj.model || mObj.machine_code || "—"`) and Serial Number in grey font-mono text on line 2 (`S/N: [serial_number]`). Synchronized Excel export headers, summary totals, and column width definitions (`!cols`).
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=logs Site / Location Column Removal from Client View Mode (`OperationsClient.tsx`, `PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`) (2026-08-25)**:
  - **Site / Location Column Removal in Client Tab (`OperationsClient.tsx`, `PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`)**: Removed redundant `Site / Location` column from Client View Mode table (`logsViewMode === "client"`), mobile touch cards, PDF print report modal (`viewMode === "client"`), and Excel export utility since client site location details are already prominently displayed at the top filter bar and Client Header Card per user feedback.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=logs Client Tab Columns Refactoring (`OperationsClient.tsx`, `PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`) (2026-08-25)**:
  - **Overtime Column Removal in Client Tab (`OperationsClient.tsx`, `PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`)**: Removed `OT(h)` (Overtime) column from the Client view mode table (`logsViewMode === "client"`), mobile touch cards, PDF print report modal (`viewMode === "client"`), and Excel export utility per feedback item 1.
  - **Separate Machine Model & Machine Serial Number Columns (`OperationsClient.tsx`, `PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`)**: Replaced combined `Machine Details` column in Client tab with two distinct columns: `Model` (rendering `mObj.model || "—"`) and `Serial Number` (rendering `mObj.serial_number || mObj.machine_code || "—"`) per feedback item 2.
  - **Work Time (`WT`) Header & Full Form Tooltip (`OperationsClient.tsx`, `PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`)**: Renamed `RT(h)` header column in Client view mode to `WT`, wrapped in `<TooltipWrapper content="Work Time (Hours)">` displaying the full form on hover per feedback item 3. Updated PDF print report header to `WT(h)` and Excel export header to `Work Time (WT)`.
  - **Column Header Tooltips for Client Tab (`OperationsClient.tsx`)**: Wrapped all column headers in Client tab (`Model`, `Serial Number`, `Site / Location`, `Operator`, `Timings`, `WT`, `Status`, `Remarks`) with `<TooltipWrapper>` tooltips providing explicit full names per feedback item 4.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=logs Hour Meter Reading (HMR) Header, Column Tooltips & Client & Location Display (`OperationsClient.tsx`, `PrintableSupervisorLogsModal.tsx`) (2026-08-25)**:
  - **Hour Meter Reading (`HMR`) Header & Tooltip (`OperationsClient.tsx`, `PrintableSupervisorLogsModal.tsx`)**: Renamed `MR(h)` header column in Machine View mode (`logsViewMode === "machine"`) to `HMR`. Wrapped `HMR` in `<TooltipWrapper content="Hour Meter Reading">`, displaying the full name in a Radix tooltip on hover per feedback item 1. Synchronized `HMR` header in `PrintableSupervisorLogsModal.tsx` PDF print report.
  - **Column Header Tooltips across All View Modes (`OperationsClient.tsx`)**: Wrapped all table column headers (`th`) across Machine, Client, and Operator view modes with `<TooltipWrapper>` tooltips providing explicit full column names and descriptions on hover per feedback item 2.
  - **Client Name and Location Display (`OperationsClient.tsx`, `PrintableSupervisorLogsModal.tsx`)**: Renamed table column headers in Machine View and Operator View modes from `Client / Site` and `Client & Site Location` to `Client & Location`. Ensured table cells display strictly the Client Name on line 1 and Location on line 2 per feedback item 3.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=logs Machine Select Model & Serial Number Display (`OperationsClient.tsx`) (2026-08-25)**:
  - **Machine Select Formatting Helper (`formatMachineSelectLabel`) (`OperationsClient.tsx`)**: Created canonical `formatMachineSelectLabel(m)` helper function that extracts machine ID code (`RI-MC-0001`), model (`50B-9`), and serial number (`HHKHB303EF0000877`), formatting options as `[Machine ID] ([Model] — S/N: [Serial Number])` (e.g. `RI-MC-0001 (50B-9 — S/N: HHKHB303EF0000877)`). Prevents duplicate Machine ID text formatting (`RI-MC-0001 (50B-9) (RI-MC-0001)`) and missing serial numbers.
  - **Select Component Integration (`OperationsClient.tsx`)**: Refactored machine select dropdowns in Client View Mode (`logsViewMode === "client"`), Machine View Mode (`logsViewMode === "machine"`), Operator Assignment modal (`activeTab === "assignments"`), and Site Movement modal (`activeTab === "site-movement"`) to consume `formatMachineSelectLabel(m)`.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=logs Operator Dropdown Role Filter, Client/Location Column & Machine Serial Number Display (`OperationsClient.tsx`, `PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`) (2026-08-25)**:
  - **Operator Selection Dropdown Role Filtering (`OperationsClient.tsx`)**: Filtered `operators` prop array to `operatorOnlyUsers` (`op.role === "operator"`), guaranteeing that the Select Operator dropdown in Operator View Mode displays usernames where `role === "operator"` only per feedback item 1.
  - **Client Name & Site Location Column (`OperationsClient.tsx`, `PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`)**: Added **Client & Site Location** column to Operator View Mode desktop table rows, mobile touch cards, PDF print report modal (`isOperatorView`), and Excel export utility per feedback item 2. Displays live database client name and site location for every daily log.
  - **Machine Serial Number Display (`OperationsClient.tsx`, `PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`)**: Rendered Machine Serial Number (`mObj.serial_number`) prominently alongside machine code and model in Machine Details cells across all view modes (Operator, Client, Machine), mobile cards, PDF print reports, and Excel export files per feedback item 3.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Bug Fix: /operations?tab=logs Displaying "Unassigned Client" for Database Linked Logs (`page.tsx`, `OperationsClient.tsx`, `PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`, `database.ts`) (2026-08-25)**:
  - **Database Relation Join (`apps/web/app/(app)/operations/page.tsx`)**: Added `client:clients(*)` and `supervisor:users!supervisor_id(...)` foreign key joins to Supabase `machine_hour_logs` queries (`hourLogs`, `operatorLogsQuery`).
  - **Type Definition Update (`packages/types/src/database.ts`)**: Updated `MachineHourLog` interface to include `client_id`, `supervisor_id`, `client: CRMClient`, and `supervisor: User`.
  - **UI Client Resolution (`OperationsClient.tsx`)**: Refactored `uniqueClients`, `clientMachineIdsFromLogs`, `clientMachines`, `clientSites`, `clientMachineObj`, and `filteredHourLogs` to resolve client name via `(log as any)?.client?.client_name || (log.machine as any)?.customer_name || "Unassigned Client"`.
  - **Table & Card Polish (`OperationsClient.tsx`)**: Rendered live database client name (`log.client.client_name`) and site location in Machine View table rows and mobile touch cards.
  - **Print/PDF & Excel Export Synchronization (`PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`)**: Updated PDF print modal and Excel export utility to resolve `log.client.client_name`.
  - **Verification**: Executed `npx tsc --noEmit` on `apps/web` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Operator Running Logs Generation for August Month (Machine 50B-9 / RI-MC-0001, Operator: Deepak Patel, Supervisor: Monu Verma, Client: Saint Gobain) (2026-08-25)**:
  - **Image & Prompt Parameter Extraction**: Extracted machine specifications from uploaded image (`Machine ID: RI-MC-0001`, `Model: 50B-9`, `Serial No: HHKHB303EF0000877`, `YUM: 2023`) and prompt parameters (`Supervisor: Monu Verma`, `Operator: Deepak Patel`, `Client: Saint Gobain`, `Shift: 8:00 AM - 8:00 PM`, `Starting HMR: 177283h`, `Date Range: August 1st - August 25th 2026`).
  - **Database Trigger Function Polish**: Updated PostgreSQL trigger function `auto_calculate_machine_hour_log_overtime()` to safely type-cast `NEW.end_time::time - NEW.start_time::time` for duration calculations.
  - **Database Persistence (`public.machine_hour_logs`)**: Generated and inserted 25 structured daily log records into `public.machine_hour_logs` table (12 hours/day, HMR incrementing from 177283h to 177583h).
  - **Verification**: Queried database using `execute_sql` MCP tool confirming 25 daily log entries are active and linked to machine `RI-MC-0001`, client `Saint Gobain`, operator `Deepak Patel`, and supervisor `Monu Verma`.

- **Bug Fix: "column clients.branch_id does not exist" Console Error (`lib/queries/clients.ts`, `database.ts`) (2026-08-25)**:
  - **Query Select Column Cleanup (`lib/queries/clients.ts`)**: Removed obsolete `branch_id` from `CLIENT_SELECT_COLUMNS` and removed `query.eq("branch_id", ...)` filter to align with `public.clients` PostgreSQL schema created in migration `003_create_clients_table.sql` and pruned in migration `005_drop_unwanted_tables.sql`.
  - **TypeScript Interface Alignment (`database.ts`)**: Updated `CRMClient` interface to mark `branch_id?: string | null;` as optional.
  - **Verification**: Executed `npx tsc --noEmit` on `apps/web` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /machines?tab=inventory — React Portal & Dynamic Viewport Positioning for Machine Action Button Menu (`MachineListClient.tsx`) (2026-08-25)**:
  - **React Portal Rendering (`MachineListClient.tsx`)**: Refactored `RowActionsMenu` and `HeaderMoreMenu` popovers to render directly into `document.body` via React's `createPortal`, completely eliminating clipping caused by `EnterpriseTable`'s `overflow-x-auto` container border.
  - **Dynamic Viewport Placement (`MachineListClient.tsx`)**: Implemented dynamic position calculation using `getBoundingClientRect()`, window dimensions (`window.innerWidth`, `window.innerHeight`), and scroll/resize event listeners. Dynamically detects available space below the action trigger button (`spaceBelow < menuHeight + 16px`) to flip menu placement upwards (`top = rect.top - menuHeight - 4px`) and clamps horizontal position within screen boundaries (`12px` padding), ensuring 100% visibility for Admin actions (`Edit Machine`, `Update Service`, `Delete Machine`) regardless of row count or viewport size.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /machines?tab=inventory — Top Tab Navigation Strip & Action Menu Upward Positioning Fix (`MachineListClient.tsx`) (2026-08-25)**:
  - **Top Navigation Tab Strip (`MachineListClient.tsx`)**: Rendered a top-level tab navigation bar displaying 3 sub-tabs (`Machine Directory` / `inventory`, `Service Logs` / `services`, `Breakdown Complaints` / `complaints`) with icons and total count badges. Guarantees that tabs remain visible and accessible to Admins and Service Managers across all tab views.
  - **Dynamic Viewport Action Menu (`MachineListClient.tsx`)**: Refactored `RowActionsMenu` popover positioning using `getBoundingClientRect()` space-below calculation (`spaceBelow < 220px`). Dynamically flips popover menu placement to open upwards (`bottom-full mb-1`) when near the bottom of the viewport, preventing popover clipping or overflow.
  - **Smooth Tab Navigation (`MachineListClient.tsx`)**: Updated `onNavigate` handler in `tableColumns` actions cell to call `updateFilters({ tab: "services", page: 1 })`, updating active tab state while preserving top tab navigation.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Bug Fix: /machines — Missing Schema Cache Console Error Handling in Complaints Query (`lib/queries/complaints.ts`) (2026-08-25)**:
  - **Root Cause & Schema Alignment**: Fixed console error `Error fetching machine complaints: "Could not find the table 'public.machine_complaints' in the schema cache"` triggered on `/machines` route. Legacy auxiliary tables were dropped during database audit to streamline the schema to 4 core tables (`users`, `machines`, `machine_hour_logs`, `clients`).
  - **Resilient Query Error Handling (`lib/queries/complaints.ts`)**: Updated `getCachedMachineComplaints` error handler to intercept PostgREST schema errors (`PGRST204` / `42P01` / `"Could not find the table"`). Returns a clean empty dataset (`{ complaints: [], total: 0, page, pageSize, totalPages: 0 }`) gracefully without attempting a duplicate fallback query or logging console errors.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /users?tab=all — Dynamic Viewport Dropdown, City Only Column, Header Simplification & CTA Button Redesign (`users-client.tsx`, `UserRow.tsx`, `MobileUserCard.tsx`) (2026-08-25)**:
  - **Dynamic Viewport Action Menu (`UserRow.tsx`)**: Refactored row action dropdown positioning using `getBoundingClientRect()` to calculate space below the trigger button. Dynamically flips menu placement to open upwards (`bottom-full mb-1`) when near the bottom of the screen (space below < 250px), preventing menu clipping or overflow issues per feedback item 1.
  - **City Only Column Display (`users-client.tsx`, `UserRow.tsx`, `MobileUserCard.tsx`)**: Renamed 4th table column header to `"City"` and updated cell formatting to render strictly `user.city || user.location || "—"` instead of combining district/state per feedback item 2. Synchronized `MobileUserCard.tsx` to display city only.
  - **Table Card Heading Teardown (`users-client.tsx`)**: Completely removed the redundant `<h2 className="heading-md text-[var(--color-ink)]">All System Accounts</h2>` card header container per feedback item 3.
  - **Header Refresh Button Teardown (`users-client.tsx`)**: Removed `<RefreshButton path="/users" tag="users" />` from the `<PageHeader>` action bar per feedback item 4.
  - **Primary CTA Button Styling (`users-client.tsx`)**: Enhanced `"Add Employee / User"` button styling with explicit `variant="primary"`, generous `px-4 py-2` padding, `h-9` height, rounded-lg corners, font-bold tracking-tight, and active scale animations per feedback item 5.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Bug Fix & Database Migration: Migration 004 Machine Hour Logs Schema Idempotency & Supervisor User UUID Foreign Key Alignment (`supabase/migrations/004_create_machine_hour_logs_table.sql`) (2026-08-25)**:
  - **Root Cause & Schema Alignment**: Fixed Supabase `ERROR: 42703: column "supervisor_id" does not exist` when executing `004_create_machine_hour_logs_table.sql` on pre-existing tables. Clarified foreign key linkage for `supervisor_id UUID REFERENCES public.users(id)` and `operator_id UUID REFERENCES public.users(id)` linking directly to existing user UUIDs in `public.users` (where `role = 'supervisor'` / `role = 'operator'`). Removed all unnecessary columns.
  - **Idempotent Migration Fix**: Added explicit `ALTER TABLE public.machine_hour_logs ADD COLUMN IF NOT EXISTS ...` statements for `supervisor_id`, `client_id`, `overtime_hours`, `is_breakdown`, `location`, and `remarks`. Guarantees migration runs cleanly regardless of pre-existing table state.
  - **Verification**: `pnpm typecheck` passed cleanly across all 9 workspace packages with 0 compilation errors.

- **Bug Fix & RLS Policy Update: User Address Editing & Full Admin/SuperAdmin User Management Authorization (`009_allow_admin_manage_users.sql`, `apps/web/app/actions/users.ts`, `apps/web/app/actions/auth.ts`) (2026-08-25)**:
  - **Database Migration & RLS Policy Update (`009_allow_admin_manage_users.sql`)**: Formulated and executed migration `009_allow_admin_manage_users.sql` updating Row Level Security (RLS) policies on `public.users`. Created `users_insert_admin`, `users_update_admin`, and `users_delete_admin` permitting both `admin` and `super_admin` roles to insert, update, and delete user records.
  - **Backend Server Actions (`apps/web/app/actions/users.ts`, `apps/web/app/actions/auth.ts`)**: Fixed runtime `ReferenceError: location is not defined` in `editUser()` and `createUser()` by building explicit location strings (`${city}, ${district}, ${state}`) for audit log metadata. Updated `createUser()` to update `public.users` via `adminSupabase` client.
  - **Verification**: Executed Supabase `execute_sql` MCP tool and `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **User Registration Email & Mobile Number Uniqueness Enforcement across Database, Backend & Frontend (`008_user_unique_email_phone.sql`, `packages/validation`, `apps/web/app/actions/auth.ts`, `apps/web/app/actions/users.ts`, `UserCreateModal.tsx`, `UserEditModal.tsx`) (2026-08-25)**:
  - **Database Unique Indexes & Deduplication (`008_user_unique_email_phone.sql`)**: Created migration script `008_user_unique_email_phone.sql` defining case-insensitive unique index `users_email_unique_idx` on `lower(btrim(email))` and unique index `users_phone_unique_idx` on `btrim(phone)` in `public.users`. Executed database cleanup script to deduplicate legacy test user mobile phone numbers in Supabase PostgreSQL.
  - **Shared Zod Validation Schemas (`packages/validation/src/auth.ts`)**: Updated `SignupSchema`, `CreateUserSchema`, and `UpdateUserSchema` in `@reachinternational/validation` to enforce required `phone` (mobile number) input with minimum 10-digit format validation.
  - **Backend Server Actions (`apps/web/app/actions/auth.ts`, `apps/web/app/actions/users.ts`)**: Updated `signup()`, `createUser()`, and `editUser()` server actions to perform pre-checks against `public.users` for duplicate email (case-insensitive) and mobile number (10-digit normalized comparison), returning explicit field errors (`fieldErrors.email`, `fieldErrors.phone`).
  - **Frontend Form UI (`UserCreateModal.tsx`, `UserEditModal.tsx`, `signup/page.tsx`)**: Updated `<UserCreateModal>` and `<UserEditModal>` to display required **Mobile Phone Number \*** inputs with native HTML `required` attributes and inline Zod validation.
  - **Verification**: Executed node verification script checking 26 user records in Supabase PostgreSQL and `pnpm typecheck` across all workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Database Migration & Monorepo Synchronization: User Address Columns (City, District, State) & Mandatory Address Validation (`supabase/migrations/007_add_user_address_columns.sql`, `packages/`, `apps/web`, `apps/mobile`) (2026-08-25)**:
  - **Database Migration & SQL Execution (`007_add_user_address_columns.sql`)**: Added `city`, `district`, `state` columns (`TEXT NOT NULL DEFAULT ''`) to `public.users` table, backfilled existing user records with non-empty default values, added PostgreSQL check constraints (`users_city_not_empty`, `users_district_not_empty`, `users_state_not_empty`), created index `idx_users_address`, and updated `handle_new_user()` trigger function.
  - **Shared Monorepo Packages (`packages/types`, `packages/validation`)**: Updated `User` interface in `@reachinternational/types` to include `city`, `district`, `state` properties. Updated `SignupSchema` and created `CreateUserSchema` and `UpdateUserSchema` in `@reachinternational/validation` enforcing required `city`, `district`, `state` string fields.
  - **Web App Updates (`apps/web/`)**: Updated `getAllUsers()` and `getPendingUsers()` DAL queries to select address columns. Updated `createUser` and `editUser` server actions to parse, validate, and persist `city`, `district`, `state`. Refactored `<UserCreateModal>` and `<UserEditModal>` Section 2 to present required input fields for **City \***, **District \***, and **State \***. Formatted address in `<UserRow>`, `<MobileUserCard>`, and `<UserDetailSheet>`.
  - **Mobile App Synchronization (`apps/mobile/`)**: Updated `apps/mobile/app/(app)/profile.tsx` to render explicit **User Address & Location** (`City`, `District`, `State`) with `MapPin` icon under user identification.
  - **Verification**: Executed Supabase `execute_sql` MCP tool verifying database columns/constraints and `pnpm typecheck` across all workspace packages (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /users?tab=all — Header Simplification, Profile Avatar & Email Teardown, City Location Column & Desktop Table Width Optimization (`users-client.tsx`, `UserRow.tsx`, `MobileUserCard.tsx`, `UserDetailSheet.tsx`, `page.tsx`) (2026-08-25)**:
  - **Header & Breadcrumbs Polish (`users-client.tsx`, `page.tsx`)**: Changed page title to `"User Management"`, updated breadcrumb label to `"Users"`, and completely removed description paragraph per feedback items 1 and 2.
  - **User Account Column Simplification (`UserRow.tsx`, `MobileUserCard.tsx`, `UserDetailSheet.tsx`)**: Removed initial circle profile avatars from table rows, mobile cards, and detail sheet headers per feedback item 3. Removed email display from the User Account name column in table rows per feedback item 4 (email is cleanly presented in the Contact Info column).
  - **Location / City Table Header (`users-client.tsx`, `UserRow.tsx`)**: Renamed 4th table column header from `"Assigned Branch & Location"` to `"Location / City"`, displaying the user's city location (`user.location` or `"India Operations"`) per feedback item 5.
  - **Desktop Screen Fit & Horizontal Overflow Teardown (`users-client.tsx`, `UserRow.tsx`)**: Applied proportional percentage column widths (`w-[22%]`, `w-[26%]`, `w-[18%]`, `w-[16%]`, `w-[10%]`, `w-[10%]`, `w-[8%]`), tight cell padding (`py-2.5 px-3`), and `whitespace-nowrap` text styling to guarantee table fits 100% inside desktop viewports (1396×638) without horizontal scrollbar (`overflow-x-auto lg:overflow-x-visible`) per feedback item 6.

- **Branch Architecture Teardown: Complete Elimination of Branch Entity, Roles & Queries Across Monorepo (`supabase/migrations/006_remove_branch_manager_role.sql`, `packages/`, `apps/web`, `apps/mobile`) (2026-08-25)**:
  - **Pan-India Model Shift**: Completely removed branch boundaries, branch selection UI, `branch_manager` RLS policies/roles, and `branch_id` queries, aligning the monorepo with single-fleet pan-India operations.
  - **Database Migrations (`001`, `002`, `003`, `006`)**: Stripped `branch_manager` check constraints and updated RLS policies on `users`, `machines`, and `clients` tables. Created `006_remove_branch_manager_role.sql`.
  - **Shared Monorepo Packages (`packages/`)**:
    - `@reachinternational/types`: Removed `branch_manager` role, `BRANCH` scope, `Branch` interface, and all `branch_id`/`branch` properties across types.
    - `@reachinternational/permissions`: Stripped `branch_manager` from canonical roles, matrices, default scopes, and permission keys. Deleted `BRANCH_*` permission constants.
    - `@reachinternational/validation`: Removed `branchId`/`branch_id` from client, auth, common, hr, and task validation schemas.
  - **Web App Refactoring (`apps/web/`)**:
    - DAL (`dal.ts`): Removed `branches` queries, `branch_id` fetching, and `getUserBranchIds`.
    - Header & Layout (`AppHeader.tsx`, `BranchSelector.tsx`): Completely removed `<BranchSelector />` component.
    - Navigation (`AppSidebar.tsx`, `CommandPalette.tsx`): Removed `/branches` item and `branch_manager` role filters.
    - Modals & Pages (`UserCreateModal.tsx`, `UserEditModal.tsx`, `UserRow.tsx`, `users-client.tsx`, `UserDetailSheet.tsx`, `MobileUserCard.tsx`, `page.tsx`): Removed branch input fields, branch role options, and updated location column cells.
    - `/branches` Route Redirect: Configured `/branches` to redirect to `/dashboard`.
  - **Mobile App Synchronization (`apps/mobile/`)**:
    - Auth & Navigation (`useAuth.tsx`, `navItems.ts`): Removed `branchId` from auth context and `branch_manager` from mobile nav items.
    - UI Screens (`profile.tsx`, `tasks.tsx`, `hr.tsx`, `EmployeeDetailModal.tsx`): Replaced branch assignment labels with "India Operations" / Work Location.
  - **Verification**: Executed `pnpm typecheck` across all workspace packages (**Passed cleanly with 0 TypeScript compilation errors**).

- **Bug Fix: /users — Schema Relationship Error Fix & Legacy Branches Join Teardown (`app/actions/users.ts`, `app/actions/branches.ts`, `lib/queries/branches.ts`) (2026-08-25)**:
  - **Query Refactoring (`app/actions/users.ts`)**: Removed non-existent `branch:branches!users_branch_id_fkey(...)` join and `branch_id` column from `getAllUsers()` and `getPendingUsers()`. Updated `createUser` and `editUser` payload handling.
  - **Safe Branch Handlers (`app/actions/branches.ts`, `lib/queries/branches.ts`)**: Updated `getBranchesAction()`, `getBranches()`, and `getBranchesWithMetrics()` to safely return empty arrays (`data: []`) without querying non-existent `branches` table or logging runtime errors.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Database Audit, 65 Unwanted Table Removal & Migration Sequence Resequencing (`supabase/migrations/`, `apps/mobile/env.d.ts`) (2026-08-25)**:
  - **Database Cleanup**: Executed `DROP TABLE IF EXISTS ... CASCADE;` in Supabase PostgreSQL database via MCP tool `execute_sql`, dropping 65 unwanted tables (Inventory ERP, Sales/CRM, Rentals, Tasks, HR/Employees, Branches, Complaints, Notifications, etc.) and retaining strictly 4 core tables: `public.users`, `public.machines`, `public.machine_hour_logs` (Operation Logs), and `public.clients`.
  - **Migration Sequence Resequencing (`supabase/migrations/`)**: Deleted 49 legacy fragmented/duplicate migration files and resequenced into 5 clean, production-ready migration scripts: `001_create_users_table.sql`, `002_create_machines_table.sql`, `003_create_clients_table.sql`, `004_create_machine_hour_logs_table.sql`, and `005_drop_unwanted_tables.sql`.
  - **Mobile Environment Typing (`apps/mobile/env.d.ts`)**: Added `env.d.ts` in `apps/mobile` declaring global `process.env` typing.
  - **Verification**: Executed `list_tables` MCP tool confirming strictly 4 tables remain in `public` schema. Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /machines?tab=inventory — Client Management Page, Auto-Code Sequence, Soft Delete & Monthly Logs Integration (`046_create_clients_table.sql`, `app/actions/clients.ts`, `ClientsClient.tsx`, `ClientModal.tsx`, `AppSidebar.tsx`, `CommandPalette.tsx`, `apps/mobile/app/(app)/clients.tsx`) (2026-08-25)**:
  - **Database Migration & Auto-Sequence (`046_create_clients_table.sql`)**: Created PostgreSQL table `public.clients` with fields (`id`, `code`, `client_name`, `company_name`, `contact_person`, `email`, `phone`, `gstin`, `address`, `city`, `state`, `pincode`, `branch_id`, `notes`, `status`, `deleted_at`). Configured sequence `clients_code_seq` and trigger function `generate_client_code()` to auto-assign codes in `CLI-0001` format. Configured RLS policies and performance indexes.
  - **Monorepo Packages & Validations (`packages/types`, `packages/validation`)**: Updated `CRMClient` interface in `@reachinternational/types` to support optional company name, GSTIN, address, notes, and `deleted_at`. Created `CreateClientSchema` and `UpdateClientSchema` in `@reachinternational/validation`.
  - **Server Actions & DAL (`app/actions/clients.ts`, `lib/queries/clients.ts`)**: Built `createClientAction`, `updateClientAction`, and `softDeleteClientAction` with Zod validation, audit logging (`logAudit`), and tag cache revalidation (`TAGS.clients`). Updated DAL `getClients()` to support soft-deleted filter and full column selection.
  - **Web Client UI (`ClientsClient.tsx`, `ClientModal.tsx`, `app/(app)/clients/page.tsx`)**: Built Client Management suite adhering to Vercel Geist tokens (`DESIGN.md`), 3-tier viewport responsiveness, search filter, status pills (`All`, `Active`, `Inactive`), high-density desktop table (`EnterpriseTable`), mobile touch cards (`block sm:hidden`), Add/Edit modal, and soft delete confirmation dialog preserving historical log traceability.
  - **Navigation Integration (`AppSidebar.tsx`, `CommandPalette.tsx`)**: Added **Clients & Customers** (`/clients`) item to main navigation in `AppSidebar.tsx` and quick command palette (`nav-clients`).
  - **Monthly Running Logs Integration (`operations/page.tsx`, `OperationsClient.tsx`)**: Integrated stored database client details into Monthly Running Logs (`/operations?tab=logs`), displaying live database contact/address info in client selectors and PDF/Excel report exports.
  - **Mobile App Synchronization (`apps/mobile/app/(app)/clients.tsx`, `_layout.tsx`)**: Created Mobile Client Directory screen with touch cards list, search filter, status chips, bottom sheet Add/Edit modal, and soft delete confirmation.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=logs — Sidebar Submenu Hover Teardown & Click Interaction Fix (`NavigationItem.tsx`) (2026-08-25)**:
  - **Hover Teardown (`NavigationItem.tsx`)**: Removed `handleMouseEnterItem`, `handleMouseLeaveItem`, and hover timers (`hoverTimerRef`) that automatically triggered flyout submenu opening on mouse hover.
  - **SidebarTooltip Restoration (`NavigationItem.tsx`)**: Restored standard `SidebarTooltip` behavior when collapsed (`enabled={!isFlyoutOpen}`), displaying item hover labels (e.g. "Operations") cleanly without popping open the flyout card.
  - **Click-to-Show Submenu Interaction (`NavigationItem.tsx`)**:
    - **Collapsed Sidebar**: Clicking the parent menu button for items with sub-items (e.g. [Operations], [Machines], [Employees & Users]) toggles `isFlyoutOpen` (`setFlyoutHref(isFlyoutOpen ? null : item.href)`), displaying the submenu flyout card anchored to the button. Clicking any sub-item inside the flyout navigates to that tab and dismisses the flyout.
    - **Expanded Sidebar**: Clicking anywhere on the parent menu item row toggles `isMenuOpen` (`onToggleMenu(!isMenuOpen)`), expanding or collapsing the sub-menu items directly beneath the parent item.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /machines — Collapsed Sidebar Submenu Flyout Hover & Click Interaction Fix (`NavigationItem.tsx`, `CollapsedSidebarFlyout.tsx`) (2026-08-25)**:
  - **Reactive Anchor Element State (`NavigationItem.tsx`)**: Refactored `buttonRef` from `useRef` to `useState<HTMLElement | null>(null)` with callback ref `ref={setAnchorEl}` on `<SidebarMenuButton>`, ensuring `anchorEl` state is reactively set and passed to `<CollapsedSidebarFlyout>` as soon as the icon button attaches to the DOM.
  - **Seamless Hover Bridging & Grace Period (`NavigationItem.tsx`, `CollapsedSidebarFlyout.tsx`)**: Implemented mouse enter (`handleMouseEnterItem`, `handleMouseEnterFlyout`) and mouse leave (`handleMouseLeaveItem`, `handleMouseLeaveFlyout`) handlers with a 200ms grace period timer (`hoverTimerRef`), allowing users to smoothly hover over collapsed menu items ([Operations], [Machines], [Employees & Users]) and transition their cursor directly into the floating flyout submenu.
  - **Tooltip Popper Conflict Prevention (`NavigationItem.tsx`)**: Disabled `SidebarTooltip` (`enabled={!hasSubItems && !isFlyoutOpen}`) for items containing sub-menus, preventing Radix Popper `<PopperAnchor>` tooltips from intercepting hover/click events or overlapping with the flyout card portal.
  - **Direct Submenu Navigation & Toggle (`NavigationItem.tsx`)**: Wrapped collapsed icon button with `<Link href={firstTabHref}>`, enabling single-click navigation to default sub-item tabs while opening/toggling the flyout submenu card.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /machines?tab=inventory — MachineListClient & EnterpriseTable Desktop Horizontal Overflow Teardown (`EnterpriseTable.tsx`, `MachineListClient.tsx`) (2026-08-25)**:
  - **High-Density Table Padding Optimization (`EnterpriseTable.tsx`)**: Refactored `densityPadding` for default table density from `py-2.5 px-3.5` (28px total padding per cell) to `py-2 px-2.5` (20px total padding per cell). Across 12 columns, this saves **96px** of horizontal space. Reduced header container flex gap (`gap-1` instead of `gap-1.5`) and sort icon size (`12` instead of `14`) with `whitespace-nowrap` on header titles.
  - **Proportional Column Widths & Name Truncation (`MachineListClient.tsx`)**: Assigned explicit proportional percentage widths (`width`) to all 11 data columns. Truncated Supervisor and Operator names using `truncate block max-w-[110px]` and native `title={name}` tooltips, preventing un-truncated user names from stretching table columns.
  - **Zero Horizontal Overflow on Desktop**: Guaranteed that total intrinsic table width stays under ~980px, fitting completely inside the ~1068px desktop workspace width when the desktop sidebar expands (280px) and collapses (72px) on desktop viewports.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /machines?tab=inventory — Admin Role Machine Registration Direct Supabase Storage & Sequence Collision Resolution (`045_fix_machine_id_sequence_and_rls.sql`, `app/actions/machines.ts`, `components/machines/MachineModal.tsx`) (2026-08-25)**:
  - **Database Migration (`045_fix_machine_id_sequence_and_rls.sql`)**: Reset PostgreSQL sequence `public.machines_id_seq` to match the max existing Machine ID in `public.machines`. Refactored `generate_machine_id()` trigger function to loop until a non-existent candidate ID (`RI-MC-XXXX`) is assigned, preventing unique key collisions (`23505` `machines_machine_id_key`). Updated RLS policies `machines_insert_authorized`, `machines_update_authorized`, and `machines_delete_authorized` for administrative/operational roles, removing non-existent `company_admin` role references per user request.
  - **Server Action Auto-Sequence & Direct Storage (`app/actions/machines.ts`)**: Auto-generated next available numerical `RI-MC-XXXX` Machine ID in `createMachine` when omitted from modal form input payload. Used `createSupabaseAdminClient()` for direct, bulletproof database persistence into `public.machines`. Added structured audit log (`logAudit`) and revalidated cache tags (`TAGS.machines`, `TAGS.machinesMeta`, `TAGS.dashboardKpis`).
  - **Client Modal Integration (`MachineModal.tsx`)**: Returned `{ success: true }` state for clean modal dismissal and toast feedback upon successful registration.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Mandatory AI Agent Rule: Web-to-Mobile Change Synchronization & Mobile Compatibility Protocol (`.agents/rules/web_mobile_ui_consistency.md`, `.agents/rules/mandatory_rules_reading_and_enforcement.md`, `AI/RULES/UI-UX.md`, `AGENTS.md`) (2026-08-25)**:
  - **Zero-Drift Mandate (`.agents/rules/web_mobile_ui_consistency.md`)**: Formulated Section 0 ("MANDATORY WEB-TO-MOBILE CHANGE SYNCHRONIZATION RULE") establishing that whenever ANY feature, component, style, theme, color token, modal, drawer, page, module, form field, status badge, navigation item, database/API hook, or workflow is added, modified, refactored, or fixed in the Web App (`apps/web`), every AI agent MUST MANDATORILY apply and synchronize the exact same change in the Mobile App (`apps/mobile`) with full mobile compatibility in the same session/task.
  - **Authoritative UI/UX Policy Update (`AI/RULES/UI-UX.md`)**: Enforced mandatory mobile-compatible adaptations (touch cards `block sm:hidden`, bottom sheet dialogs, horizontal scroll filter strips, min 44px touch targets) across all web changes.
  - **Monorepo Protocol & Agent System Rules Integration (`AGENTS.md`, `.agents/rules/mandatory_rules_reading_and_enforcement.md`)**: Updated STEP 5 (IMPLEMENTATION) in `AGENTS.md` and Phase 3 in `mandatory_rules_reading_and_enforcement.md` to force all future AI agents to obey the Web-to-Mobile synchronization protocol without exception.

- **Page Feedback: /machines?tab=inventory — Machine Supervisor List Database Fetching, Rental Status Label Polish & Mandatory Specification Validation (`lib/queries/machines.ts`, `MachineModal.tsx`, `app/actions/machines.ts`) (2026-08-22)**:
  - **Strict Database Supervisor Querying (`lib/queries/machines.ts`)**: Refactored `getActiveSupervisors()` to query strictly users with `role = 'supervisor'` (and supervisor employees) in `public.users` where `status != 'inactive'`. Guarantees that if there are only 2 supervisors registered in the database, exactly those 2 supervisor accounts are fetched and displayed when assigning a supervisor to a machine.
  - **Modal Current Selection Preservation (`MachineModal.tsx`)**: Guaranteed that if a machine has a currently assigned supervisor or operator (`current_supervisor`, `current_operator`), their record is preserved and merged into the dropdown selection options if not already present.
  - **Rental Status Select Label Polish (`MachineModal.tsx`)**: Renamed the status dropdown select label from `"Rental Fleet Status"` to `"Rental Status"` per user feedback item 2.
  - **Mandatory Specifications Validation (`MachineModal.tsx`, `app/actions/machines.ts`)**: Updated Section 1 form inputs (`Model *`, `Serial Number *`, `Year of Manufacture (YUM) *`, `Manufacturer *`) to include required indicators (`*`) and `required` attributes. Implemented both front-end inline validation in `<MachineModal>` `handleSubmit` and backend validation in `createMachine()` and `updateMachine()` server actions, requiring all 4 specification boxes to be completed before submission.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /users?tab=all — Dashboard User Creation Direct Activation & Approval Isolation (`044_dashboard_user_creation_direct_active.sql`, `app/actions/users.ts`, `app/actions/auth.ts`, `UserCreateModal.tsx`, `users-client.tsx`) (2026-08-22)**:
  - **Database Migration (`044_dashboard_user_creation_direct_active.sql`)**: Updated PostgreSQL `handle_new_user()` trigger function so users created by Admins via dashboard (`email_confirmed_at IS NOT NULL` or `raw_user_meta_data->>'status' = 'active'`) default directly to `status = 'active'` in `public.users`, while public signups default to `status = 'pending'`.
  - **Backend Server Actions (`app/actions/users.ts`, `app/actions/auth.ts`)**: Updated `createUser()` in `users.ts` to pass `status: "active"` in `user_metadata`, rendering dashboard user creation direct without sending admin approval request emails (`sendPendingApprovalEmailToAdmins`), and sending welcome credentials (`sendWelcomeEmail`) directly to the user. Preserved pending approval requests exclusively for public `/signup` registrations.
  - **UI Notices & Help Text (`UserCreateModal.tsx`, `users-client.tsx`)**: Rendered an informational notice banner in `<UserCreateModal>` clarifying direct active creation without admin approval requests, and updated toast notification messages.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /machines?tab=inventory — System Generated Machine ID Field Removal (`apps/web/components/machines/MachineModal.tsx`) (2026-08-22)**:
  - **System Generated Machine ID Input Teardown (`MachineModal.tsx`)**: Removed the editable `<Input label="Machine ID (Unique)" ... />` field and format helper caption from Section 1 (Machine Identification & Specifications) of `<MachineModal>` per user page feedback.
  - **Auto-Sequence Alignment**: Machine IDs are automatically generated by the PostgreSQL sequence trigger (`RI-MC-XXXX`) upon creation and displayed read-only in the modal title (`Edit Machine (RI-MC-0001)`) upon modification. Cleaned up redundant `machineIdVal` state and state-sync logic.
  - **Form Grid Polish**: Re-aligned Section 1 inputs into a clean 2x2 grid layout (`Model`, `Serial Number`, `Year of Manufacture (YUM)`, `Manufacturer`).
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Bug Fix: Machine Row-Level Security (RLS) Policy Fix & Specific User-Friendly Error Handling (`043_fix_machines_rls_policies.sql`, `app/actions/machines.ts`, `app/actions/machine-import.ts`, `components/machines/MachineModal.tsx`, `components/machines/MachineListClient.tsx`) (2026-08-22)**:
  - **Database RLS Migration (`043_fix_machines_rls_policies.sql`)**: Updated PostgreSQL RLS policies on `public.machines` for `INSERT`, `UPDATE`, and `DELETE` operations. Granted `INSERT` policy access to authenticated users with roles: `super_admin`, `admin`, `company_admin`, `branch_manager`, `service_manager`, `rental_manager`, `store_manager`. Granted `UPDATE` policy access to authenticated users with roles: `super_admin`, `admin`, `company_admin`, `branch_manager`, `service_manager`, `rental_manager`, `store_manager`, `supervisor`, `service_engineer`, or assigned personnel. Granted `DELETE` policy access to administrative roles: `super_admin`, `admin`, `company_admin`.
  - **Canonical Error Handling Helper (`formatMachineDatabaseError`) (`app/actions/machines.ts`)**: Built `formatMachineDatabaseError()` helper function that intercepts raw PostgreSQL errors and returns clear user-friendly messages: `42501` (RLS violation) -> `"Permission denied: Your account role does not have authorization to add or modify machines. Please contact a system administrator."`, `23505` (Unique constraint) -> `"A machine with this Machine ID or Serial Number already exists in the inventory."` with specific `fieldErrors.machine_id` / `fieldErrors.serial_number`, `23502` -> `"Required machine details are missing. Please complete all mandatory fields."`, `23503` -> `"Invalid reference: The selected supervisor or operator could not be found."`, `22P02` -> `"Invalid format provided for machine details. Please check numeric inputs."`.
  - **Server Action Protection (`app/actions/machines.ts`, `app/actions/machine-import.ts`)**: Updated `createMachine`, `updateMachine`, `deleteMachine`, `reassignMachineSupervisor`, and `importMachinesFromExcel` to catch database errors, map them to polite user notices, and safely handle Next.js redirects (`NEXT_REDIRECT`).
  - **UI Error Banner & Modal Polish (`components/machines/MachineModal.tsx`, `components/machines/MachineListClient.tsx`)**: Rendered an `AlertCircle` icon and styled red error banner container in `<MachineModal>`, and updated `<MachineListClient>` `handleDeleteConfirm` to display toast notifications with error messages when deletion fails.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /machines?tab=inventory — Machine Inventory Excel Import Sample Template & Schema Alignment (`lib/utils/excel-template.ts`, `app/actions/machine-import.ts`, `components/machines/MachineImportModal.tsx`) (2026-08-22)**:
  - **Sample Excel Template Alignment (`lib/utils/excel-template.ts`)**: Replaced legacy fields (`Machine Name`, `Customer Name`, `Customer Mobile`, `City`, `State`, etc.) with canonical columns matching `public.machines` table: `Machine ID`, `Model`, `Manufacturer`, `Serial Number`, `Year of MFG`, `Hour Meter (HMR)`, `Service Count`, `Status`, `Health Status`. Populated realistic sample rows demonstrating auto-incrementing ID formats (`RI-MC-0001`), optional Machine ID auto-generation (blank), and valid values for status (`available`, `rented`) and health status (`active`, `under_maintenance`, `breakdown`).
  - **Bulk Import Server Action & Normalization (`app/actions/machine-import.ts`)**: Expanded header mapping variations to accommodate alias headers (`Machine ID`, `Model`, `Manufacturer`, `Serial Number`, `Year of MFG`, `Hour Meter`, `Service Count`, `Status`, `Health Status`). Implemented status normalizations converting strings like `"on rent"` or `"in use"` -> `"rented"` and `"maintenance"` -> `"under_maintenance"`. Retained PostgreSQL trigger auto-generation of `machine_id` when omitted.
  - **UI Modal Help & Description Polish (`components/machines/MachineImportModal.tsx`)**: Updated modal description and helper text bullets to accurately reflect available columns and supported status values.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Bug Fix: Machine Queries Schema Fallback & Console Error Resilience (`lib/queries/machines.ts`, `lib/queries/complaints.ts`, `lib/queries/services.ts`, `lib/queries/notifications.ts`, `lib/queries/my-work.ts`, `lib/queries/dashboard.ts`, `app/(app)/operations/page.tsx`) (2026-08-22)**:
  - **Machine Query Schema Fallbacks (`lib/queries/machines.ts`)**: Enhanced `getMachines()` and `getCachedMachineById()` to execute an automatic fallback query using `machine_code` if primary query using `machine_id` fails (preventing `column machines.machine_id does not exist` errors on un-migrated database instances). Mapped results to ensure both `machine_id` and `machine_code` fields are populated across all returns.
  - **Machine Complaints Query & Error Log Resilience (`lib/queries/complaints.ts`)**: Updated `getCachedMachineComplaints()` to select standard machine columns (`id, model, serial_number, status, health_status`) and implemented fallback query logic. Replaced uninformative `console.error("...", error)` logging with explicit `error.message || error.details || error` formatting (resolving `Error fetching machine complaints: {}` logging issues).
  - **Query Protection Across Monorepo (`lib/queries/services.ts`, `lib/queries/notifications.ts`, `lib/queries/my-work.ts`, `lib/queries/dashboard.ts`, `app/(app)/operations/page.tsx`)**: Updated embedded `machine:machines(...)` joins to safely handle refactored machine schema columns without requesting non-existent properties, and updated `OperationsPage` to sort by `created_at` instead of hardcoded `machine_id`.
  - **Verification**: Executed `npx turbo run typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across all 9 packages**).

- **Database & Monorepo Refactoring: Machines Table Schema, Manufacturer Field & Entity Streamlining (`042_refactor_machines_table.sql`, `@reachinternational/types`, `@reachinternational/validation`, `queries/machines.ts`, `actions/machines.ts`, `MachineModal.tsx`, `MachineListClient.tsx`, `machine-client-view.tsx`) (2026-08-22)**:
  - **Database Migration (`042_refactor_machines_table.sql`)**: Retained and ensured `manufacturer` column (`text`, indexed) on `public.machines`. Created sequence `machines_seq` for 4-digit auto-incrementing ID format (`RI-MC-0001`). Renamed/replaced `machine_code` with `machine_id` (`text`, unique, NOT NULL). Dropped customer columns (`customer_name`, `customer_mobile`, `customer_email`, `customer_address`, `city`, `state`) and non-essential technical specification columns. Added `health_status` (`active`, `under_maintenance`, `breakdown`) and updated `status` check constraint to (`available`, `rented`).
  - **Domain Packages & Validations (`@reachinternational/types`, `@reachinternational/validation`)**: Added `manufacturer: string | null;` to `Machine` interface. Updated `CreateMachineSchema` & `UpdateMachineSchema` Zod validation schemas.
  - **Backend Server Actions & DAL Queries (`lib/queries/machines.ts`, `app/actions/machines.ts`, `app/actions/machine-import.ts`)**: Included `manufacturer` in `MACHINE_LIST_COLUMNS`, server actions (`createMachine`, `updateMachine`), and Excel/CSV bulk import mapping (`manufacturer`, `make`, `mfg`).
  - **Web & Mobile UI Components (`MachineModal.tsx`, `MachineRow.tsx`, `MobileMachineCard.tsx`, `MachineListClient.tsx`, `machine-client-view.tsx`, `apps/mobile/app/(app)/machines.tsx`, `MachineDetailModal.tsx`)**: Rendered `Manufacturer` input field in modal form, subtitle in table rows and mobile touch cards, parameters grid on machine details page, and CSV export column.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=logs — Sub-Filters Horizontal Alignment, Working Hours & Days Badges & Vertical Spacing Reduction (`OperationsClient.tsx`) (2026-08-22)**:
  - **Toolbar Sub-Filters Horizontal Alignment (`OperationsClient.tsx`)**: Relocated **Select Location** and **Select Machine** dropdowns out of the bottom section of the Client Detail box up into the main filter toolbar row per feedback items 1 and 2. Formatted Client view mode (`logsViewMode === "client"`) toolbar grid as a responsive 4-column row (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3`), placing **Select Client**, **Select Location**, **Select Machine**, and **Select Month** horizontally aligned in a single row.
  - **Client Header Badges Alignment (`OperationsClient.tsx`)**: Relocated **Normal Working Hours** (`8:00 AM to 8:00 PM`) and **Total Working Days** (`X Days in [Month] Month (12h)`) from the parameters grid up into the top right header container of the Client Details card per feedback item 4. Formatted them as `<Badge>` chips (`variant="info"` and `variant="success"`) horizontally aligned alongside **Rented Machines** and **Active Site Locations** badges.
  - **Vertical Spacing Reduction (`OperationsClient.tsx`)**: Reduced outer container spacing (`space-y-4` -> `space-y-3`), card interior padding and gaps (`p-4 space-y-4` -> `p-3.5 space-y-3`, grid gap `gap-2.5`), and removed redundant bottom `.pt-3` border-t block inside the Client Detail box per feedback item 3.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=logs — Printable Report Client Details Header & Verification Sign-off Section (`PrintableSupervisorLogsModal.tsx`, `PrintableOperatorLogsModal.tsx`) (2026-08-22)**:
  - **Client Name & Location Subheading (`PrintableSupervisorLogsModal.tsx`)**: Rendered a prominent large & bold subheading (`text-xs sm:text-sm font-extrabold uppercase text-neutral-900 tracking-tight py-0.5`) right below the main report `<h2>` heading when viewing Client reports per feedback item 1. Displays `CLIENT: [Client Name] | LOCATION: [Site Location]`, formatted smaller than the `h2` heading.
  - **Client Details & Sign-Off Footer (`PrintableSupervisorLogsModal.tsx`, `PrintableOperatorLogsModal.tsx`)**: Expanded the report verification footer section into a 3-column grid (`grid-cols-3 gap-3 sm:gap-4`) per feedback item 2, introducing Column 2 dedicated to **Client Details & Sign-off** displaying Customer Name and Site Location / Representative info.
  - **Explicit Signature & Date Lines (`PrintableSupervisorLogsModal.tsx`, `PrintableOperatorLogsModal.tsx`)**: Added explicit `Sign: _______` and `Date: _______` fields to all 3 columns in the verification footer grid per feedback items 2 and 3.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /operations?tab=logs — Client Details Box Metrics, Working Hours, Working Days & Location Pin Teardown (`OperationsClient.tsx`) (2026-08-22)**:
  - **Client Details Box Summary Metrics Integration (`OperationsClient.tsx`)**: Incorporated the 4 summary metric cards (`Total Run Hours`, `Total Overtime`, `Breakdown Events`, `Matching Logs`) directly inside the Client Details Header Box in `<OperationsClient>` (`logsViewMode === "client"`) per feedback item 1. Restricted the filter toolbar KPI summary strip rendering strictly to Operator mode (`logsViewMode === "operator"`), preventing toolbar clutter and duplication.
  - **Normal Working Hours Display (`OperationsClient.tsx`)**: Added `Normal Working Hours` parameter displaying `8:00 AM to 8:00 PM` in the Client Details Header Box per feedback item 2.
  - **Total Working Days Calculation (`OperationsClient.tsx`)**: Added `Total Working Days` parameter calculating and displaying `X Days in [Selected Month] Month (12h)` (e.g. `26 Days in August Month (12h)`) in the Client Details Header Box per feedback item 3.
  - **Site Location Pin Icon Teardown (`OperationsClient.tsx`)**: Removed `<AnimatedMapPin>` icon from `Site / Location` table cells and mobile touch card views per feedback item 4.
  - **Operator Phone Number Single Line Formatting (`OperationsClient.tsx`)**: Wrapped operator phone numbers in table cells with `whitespace-nowrap font-mono` per feedback item 5, guaranteeing clean single-line phone formatting across viewports.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /operations?tab=logs — Machine Export Filename Format Standardizing (`Machineserialnumber-Exportdateandtime`) (`operator-logs-export.ts`, `supervisor-logs-export.ts`, `PrintableSupervisorLogsModal.tsx`, `OperationsClient.tsx`) (2026-08-22)**:
  - **Machine Export Filename Helper (`operator-logs-export.ts`)**: Built `buildMachineExportFileName(serialNumberOrCode, extension)` helper function that cleans and slugifies machine serial numbers / codes and appends formatted export date-time slug (`slugDateTime`), formatting export files as `Machineserialnumber-Exportdateandtime` (e.g. `REACH-2026-001-22-08-2026-16-00.pdf` / `.xlsx`).
  - **Excel & PDF Export Filename Alignment (`supervisor-logs-export.ts`, `PrintableSupervisorLogsModal.tsx`, `OperationsClient.tsx`)**: Updated `exportSupervisorRunningLogsToExcel()` and `<PrintableSupervisorLogsModal>` `handlePrint()` document title to use `buildMachineExportFileName()` whenever machine logs or client machine sub-filters are exported to PDF or Excel. Passed `machines` array in `handleExportSupervisorExcel()`.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=logs — Export Excel Button Teardown & Export/Print Button Renaming (`OperationsClient.tsx`) (2026-08-22)**:
  - **Export Excel Toolbar Button Teardown (`OperationsClient.tsx`)**: Removed the `"Export Excel"` button from the toolbar in `<OperationsClient>` per user feedback item 1, eliminating duplication since spreadsheet downloads are available directly within the report modal.
  - **Export/Print Button Renaming (`OperationsClient.tsx`)**: Renamed the primary report button from `"PDF Report"` to `"Export/Print"` per user feedback item 2, applying seamlessly across Machine, Clients, and Operator logs tabs.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /operations?tab=logs — By-Machine PDF Report Title, Metadata & Table Column Refinements (`PrintableSupervisorLogsModal.tsx`, `OperationsClient.tsx`, `supervisor-logs-export.ts`) (2026-08-22)**:
  - **Report Header Title & Supervisor Details Removal (`PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`)**: Updated PDF report header title to `"MACHINE RUNNING HOURS REPORT"` when in By Machine logs view per feedback item 6. Removed Supervisor Name and Supervisor Number from top header metadata strip and Excel export `metaRow` in By Machine logs view per feedback items 1, 2, 3.
  - **KPI Summary Strip Total Services Addition (`PrintableSupervisorLogsModal.tsx`, `OperationsClient.tsx`, `supervisor-logs-export.ts`)**: Passed `machines` array from `<OperationsClient>` to `<PrintableSupervisorLogsModal>` and `exportSupervisorRunningLogsToExcel()`, displaying `Total Services` count (`service_count ?? 0`) in the 4-card KPI summary strip per feedback item 4.
  - **PDF Table Remarks Column Addition (`PrintableSupervisorLogsModal.tsx`)**: Added `REMARKS` header column (`<th>`) and data cell (`<td>`) containing `cleanRemarks` to the high-density table in By Machine logs view per feedback item 5.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /operations?tab=logs — Total Service Count Parameter Addition (`OperationsClient.tsx`) (2026-08-22)**:
  - **Machine Summary Header Total Services Grid (`OperationsClient.tsx`)**: Expanded Machine Summary Header details grid in Machine mode (`logsViewMode === "machine"`) per feedback item 1 to include `Total Services` (`service_count ?? 0`), creating a clean 5-column parameters grid (`Serial No / Code`, `Model`, `Total Run Hours`, `Total Services`, `Breakdown Events`) with responsive breakpoint layout (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`).
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /operations?tab=logs — Machine Card Parameters, Current Status Badge & Toolbar KPI Teardown (`OperationsClient.tsx`) (2026-08-22)**:
  - **Machine Summary Details Grid (`OperationsClient.tsx`)**: Expanded Machine Summary Header card in Machine mode (`logsViewMode === "machine"`) per feedback item 1 to display 4 machine profile parameters: `Serial No / Code` (`serial_number` / `machine_code`), `Model`, `Total Run Hours` (`totalFilteredRunHours`), and `Breakdown Events` (`totalFilteredBreakdowns`).
  - **Toolbar KPI Summary Strip Teardown (`OperationsClient.tsx`)**: Removed the KPI metrics summary strip (`.grid`) from the filter toolbar card when in Machine mode (`logsViewMode === "machine"`) per feedback item 2, avoiding duplication since these details are now featured directly in the Machine Header card.
  - **Current Status DB Badge Label (`OperationsClient.tsx`)**: Prefixed the active machine status badge in the header card with explicit `"Current Status: "` label per feedback item 3, displaying real-time dynamic DB machine status (`ACTIVE`, `ON RENT`, `UNDER MAINTENANCE`).
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /operations?tab=logs — Client Details Section, Dropdown Labels & Single Location/Machine Defaulting (`OperationsClient.tsx`) (2026-08-22)**:
  - **Select Dropdown Label Polish (`OperationsClient.tsx`)**: Renamed dropdown labels per feedback items 1, 2, 3: "Filter by Site / Location" -> "Select Location", "Filter by Machine" -> "Select Machine", and "Select Client / Customer" -> "Select Client".
  - **Single Location & Single Machine Auto-Defaulting (`OperationsClient.tsx`)**: Updated Client view mode sub-filters per feedback items 4 and 5 so that if a selected client has only 1 active location or 1 rented machine, that specific location or machine name is selected by default instead of defaulting to "All Sites & Locations" or "All Client Rented Machines".
  - **Client Detail Header Card Simplification (`OperationsClient.tsx`)**: Removed the `<AnimatedBuilding2>` sky blue icon box per feedback item 6, removed the uppercase `"Client / Customer Profile & Fleet Summary"` subtitle text per feedback item 7 (showing strictly the Client Name heading), and removed the bottom `.pt-2.5` border-t site locations badges strip per feedback item 8.
  - **Sub-Filters Grid Relocation (`OperationsClient.tsx`)**: Relocated the sub-filters grid ("Select Location" and "Select Machine") into the Client Detail Section per feedback item 9, leaving a clean 2-column grid ("Select Client" & "Select Month") in the top filter toolbar.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across all 9 packages**).

- **Page Feedback: /operations?tab=logs — Machine Card Simplification (`OperationsClient.tsx`) (2026-08-22)**:
  - **Machine Summary Header Card Simplification (`OperationsClient.tsx`)**: Simplified the Machine Summary Header card in Machine mode (`logsViewMode === "machine"`) per user feedback items 1, 2, 3, removing the 4-column profile parameters grid (`Machine Name`, `Model`, `Serial No / Code`, `Total Running Hours`), removing the `<Gauge />` icon box (`.h-10`), and removing the `"Machine Profile & Running Summary"` uppercase subtitle text. The header card now displays strictly the Machine Name heading on the left and the active status badge on the right.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across all 9 packages**).

- **Page Feedback: /operations?tab=logs — Site-Wise & Machine-Wise Client Running Logs (`OperationsClient.tsx`, `PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`) (2026-08-22)**:
  - **Client Summary Profile & Active Sites Badges (`OperationsClient.tsx`)**: Refactored Client Profile Summary Header card in Client mode (`logsViewMode === "client"`) to display Customer Name, Phone, Email, Total Rented Fleet count (`X Machines`), Total Active Sites count (`Y Sites`), and interactive Location Badges (e.g. 📍 Pune Metro Site, 📍 Mumbai Highway Site) for all sites where the client's machines are operating.
  - **Site & Machine Sub-Filter Toolbar (`OperationsClient.tsx`)**: Added **Filter by Site / Location** select dropdown (`All Sites` vs specific site location) and **Filter by Machine** select dropdown (`All Client Machines` vs specific machine) to toolbar in Client view mode.
  - **Desktop Data Table Site Location Column (`OperationsClient.tsx`)**: Expanded desktop table (`hidden sm:block`) in Client mode to 10 columns (`S.N`, `Date`, `Machine`, `Site / Location`, `Operator`, `Timings`, `RT(h)`, `OT(h)`, `Breakdown`, `Remarks`), displaying site address & city with `AnimatedMapPin` icon in `Site / Location` cells.
  - **Mobile Touch Cards Optimization (`OperationsClient.tsx`)**: Displayed site location pin badge 📍 and operator shift timings in mobile touch cards (`block sm:hidden`).
  - **Printable PDF Report & Excel Export Synchronization (`PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`)**: Synchronized PDF preview header metadata, 10-column PDF report table, Excel `metaRow`, 15-column spreadsheet headers (`tableHeaders`), `dataRows`, `summaryRow`, and column widths (`!cols`) with site-wise & machine-wise details.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across all 9 packages**).

- **Page Feedback: /operations?tab=logs — Machine Details Header Card & Column Teardown (`OperationsClient.tsx`, `PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`) (2026-08-22)**:
  - **Machine Summary Header Card (`OperationsClient.tsx`)**: Rendered a styled Machine Profile & Running Summary card at the top of the table in Machine mode (`logsViewMode === "machine"`), displaying Machine Name, Model, Serial Number / Code, Total Running Hours (`X.X hrs`), and operational Status badge per user visual feedback.
  - **Redundant Column Teardown (`OperationsClient.tsx`)**: Removed the `Machine` column header (`<th>`) and data cells (`<td>`) from the desktop data table in Machine mode (`logsViewMode === "machine"`), reducing column count to 8 (`S.N`, `Date`, `Client / Site`, `Operator`, `MR(h)`, `RT(h)`, `Status`, `Remarks`) and updating empty state `colSpan` to 8.
  - **Printable PDF & Excel Export Synchronization (`PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`)**: Updated PDF report header metadata strip and Excel `metaRow` in Machine mode to present Machine Name, Model, Serial Number / Code, and Total Running Hours at the top while omitting redundant machine columns from spreadsheet rows and PDF report tables.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /operations?tab=logs — Column Name Shortening (`MR(h)`, `RT(h)`, `OP(h)`, `OT(h)`) & Machine Logs Overtime Teardown (`OperationsClient.tsx`, `PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`) (2026-08-22)**:
  - **Column Name Shortening (`OperationsClient.tsx`)**: Shortened table headers across all view modes in desktop data table (`hidden sm:block`) per user feedback items 1, 2, 3: renamed `Meter Reading (hrs)` to `MR(h)`, `Run (hrs)` to `RT(h)`, `OP (hrs)` to `OP(h)`, `OT (hrs)` to `OT(h)`, `Operator Timings` to `Timings`, and `Mch Code` to `Code`.
  - **Machine Logs Overtime Column & Cell Removal (`OperationsClient.tsx`)**: Completely removed the `OT (hrs)` column header (`<th>`) and overtime data cells (`<td>`) from Machine Logs view mode (`logsViewMode === "machine"`), updating empty state `colSpan` to 9 per user feedback item 4.
  - **Machine Logs Overtime Teardown (`OperationsClient.tsx`, `PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`)**: Removed Overtime KPI card from toolbar summary strip when viewing Machine logs, removed OT display from mobile touch cards in Machine mode, removed OT column from Machine mode Printable PDF report modal, and removed OT column from Machine mode Excel export generator per user feedback item 5.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across all 9 packages**).

- **Page Feedback: /operations?tab=logs — Client Details Header, Tabular Formatting & Verification Removal (`OperationsClient.tsx`, `041_remove_machine_hour_logs_verification.sql`, `operators.ts`, `hourMeter.ts`, `database.ts`) (2026-08-22)**:
  - **Client Details Header Card (`OperationsClient.tsx`)**: Rendered a styled Client Profile Summary card at the top of the table in By Client mode (`logsViewMode === "client"`), displaying Customer Name, Mobile Number, Email Address, Site Address / Location, City & State, and Total Fleet Count per user feedback item 1.
  - **Tabular Data Table & Value Formatting Polish (`OperationsClient.tsx`)**: Formatted desktop data table (`hidden sm:block`) and mobile touch cards (`block sm:hidden`) as a clean tabular view with `DD-MM-YYYY` dates, bold mono font for operating and overtime hours (`X.X hrs`, `+Xh OT`), `08:00 AM - 05:00 PM` timings, status badges, and remarks with title tooltips per user feedback item 2.
  - **Verification Process & Column Teardown (`041_remove_machine_hour_logs_verification.sql`, `operators.ts`, `hourMeter.ts`, `database.ts`, `OperationsClient.tsx`, `OperatorDashboard.tsx`, `PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`)**: Completely removed verification columns (`verification_status`, `verified_by`, `verified_at`, `verification_remarks`) from PostgreSQL database (`041_remove_machine_hour_logs_verification.sql`), domain types (`MachineHourLog`), validation schemas (`VerifyHourLogSchema`), backend server actions (`verifyOperatorHourLogAction`), desktop/mobile UI components, printable PDF report modal, and Excel export engine per user feedback item 3.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across all 9 packages**).

- **Page Feedback: /operations?tab=logs — By Client PDF Report Title & Metadata Client Label Polish (`apps/web/components/operations/PrintableSupervisorLogsModal.tsx`, `apps/web/lib/utils/supervisor-logs-export.ts`) (2026-08-22)**:
  - **By Client Report Title Polish (`PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`)**: Updated PDF report header title and Excel export title row (`titleRow`) when `viewMode === "client"` to display `"SITE MACHINE RUNNING HOURS REPORT"` instead of `"SUPERVISOR MACHINE RUNNING HOURS REPORT"` per user feedback item 1.
  - **Metadata Client Label Polish (`PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`)**: Updated PDF preview top metadata strip and Excel `metaRow` when `viewMode === "client"` to output `"Client: [Client Name]"` directly instead of `"Scope: Client: [Client Name]"` per user feedback item 2.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across all 9 packages**).

- **Employee & User Management — Admin View, Add, and Manage Employees (`/users`, `apps/web/app/(app)/users/page.tsx`, `AppSidebar.tsx`, `CommandPalette.tsx`, `users-client.tsx`, `app/actions/users.ts`) (2026-08-22)**:
  - **Route Access & Unlocking (`page.tsx`)**: Removed restrictive `protectDisabledRoute()` call that previously redirected non-operators to `/machines`. Enabled direct access to `/users` for `admin`, `super_admin`, `branch_manager`, `service_manager`, and `hr_manager` roles while presenting a clean access denied state for unauthorized roles.
  - **Sidebar & Quick Command Palette Navigation (`AppSidebar.tsx`, `CommandPalette.tsx`)**: Added **Employees & Users** (`/users`) navigation item to `mainNavItems` in `AppSidebar.tsx` for authorized roles. Integrated quick command `nav-users` ("Go to Employee & User Management" -> `/users`) into `CommandPalette.tsx`.
  - **Dual Database Table Synchronization (`app/actions/users.ts`)**: Updated `createUser()` to automatically insert a matching record into `public.employees` (`employee_code`, `full_name`, `phone`, `email`, `designation`, `branch_id`, `user_id`, `status`). Updated `toggleUserStatus()` and `editUser()` to sync status, contact info, branch assignment, and designation with `public.employees`.
  - **UI & Role Filter Pills Polish (`users-client.tsx`)**: Refactored PageHeader title to **Employee & User Management**, breadcrumbs to **Employees & Users**, and CTA button to **Add Employee / User**. Expanded role filter pills to include field staff (`Supervisors`, `Operators`, `Mechanics`).
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across all 9 packages**).

- **Page Feedback: /operations?tab=logs — Desktop Table & Preview PDF Format Synchronization (`apps/web/components/operations/OperationsClient.tsx`) (2026-08-22)**:
  - **On-Screen Desktop Table Format Synchronization (`OperationsClient.tsx`)**: Refactored the desktop data table (`hidden sm:block`) in `<OperationsClient>` to match the preview PDF report table format 1:1 across all view modes (`operator`, `client`, `machine`).
  - **Column Alignment & Formatting (`OperationsClient.tsx`)**: Added `S.N` (Serial Number index: `1`, `2`, `3`...) column, formatted `Date` (`formatDate(log.log_date)` -> `DD-MM-YYYY`), split Operator View Mode into distinct `Machine Name`, `Mch Code`, `Model`, `Timings`, `OP` (`runningHours}h`), `OT` (`otHours > 0 ? `${otHours}h` : "0h"`), `Status`, and `Remarks` columns, and unified Machine View Mode with `Meter (hrs)` (`startMtr → endMtr`), `Run`, `OT`, and `Status` columns while retaining interactive Verification badges and Verify action buttons.
  - **Verification**: Executed `npx tsc --noEmit` on `@reachinternational/web` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /operations?tab=logs — PDF Report Header Metadata Strip Showing Supervisor & Operator Name & Number Only (`apps/web/components/operations/PrintableSupervisorLogsModal.tsx`, `apps/web/components/dashboard/PrintableOperatorLogsModal.tsx`, `apps/web/lib/utils/supervisor-logs-export.ts`) (2026-08-22)**:
  - **Metadata Strip Email Removal (`PrintableSupervisorLogsModal.tsx`, `PrintableOperatorLogsModal.tsx`)**: Refactored PDF report top header metadata strip to display strictly Supervisor Name and Supervisor Phone (`Supervisor: [Name]`, `Supervisor Number: [Phone]`) and Operator Name and Operator Phone (`Operator: [Name]`, `Number: [Phone]`), removing email fields.
  - **Excel Export Metadata Alignment (`supervisor-logs-export.ts`)**: Updated spreadsheet header `metaRow` to output Supervisor Name and Operator Name & Number without Email fields.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across all 9 packages**).

- **Page Feedback: /operations?tab=logs — By Operator Export Filename Title Case & All-Months Handling (`apps/web/lib/utils/operator-logs-export.ts`, `apps/web/components/operations/PrintableSupervisorLogsModal.tsx`, `apps/web/lib/utils/supervisor-logs-export.ts`) (2026-08-22)**:
  - **Title Case Export Filename Standardizing (`operator-logs-export.ts`)**: Updated `buildExportFileName()` to construct export filenames strictly as `Selected-Operator-Name-Selected-Month-Name-Export-Date-Time.pdf` / `.xlsx` (e.g. `Deepak-Patel-August-21-08-2026-16-37.pdf`).
  - **Clean "All" Month Handling (`operator-logs-export.ts`)**: Omitted month slug when `selectedMonthValue === "all"`, outputting `Selected-Operator-Name-Export-Date-Time.pdf` / `.xlsx` (e.g. `Deepak-Patel-21-08-2026-16-37.pdf`) without appending `"All-Months"` or `"all"`.
  - **Printable PDF & Excel Export Synchronization (`PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`)**: Synchronized `handlePrint` document title and `exportSupervisorRunningLogsToExcel()` filename generation when in "By Operator" view mode.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across all 9 packages**).

- **Page Feedback: /operations?tab=logs — By Operator PDF Report & Table View Format Synchronization (`apps/web/components/operations/PrintableSupervisorLogsModal.tsx`, `apps/web/components/operations/OperationsClient.tsx`, `apps/web/lib/utils/supervisor-logs-export.ts`, `apps/web/lib/utils/operator-logs-export.ts`) (2026-08-22)**:
  - **Operator Report Format Synchronization (`PrintableSupervisorLogsModal.tsx`)**: Updated `<SupervisorLogsReportContent>` when `viewMode === "operator"` to render `OPERATOR DAILY MACHINE LOG REPORT` heading, 10-column table layout (`S.N`, `DATE`, `MACHINE NAME`, `MCH CODE`, `MODEL`, `TIMINGS`, `OP`, `OT`, `STATUS`, `REMARKS`), and Operator / Supervisor verification blocks matching the Operator Role PDF export standard attached in feedback.
  - **Supervisor Metadata Strip (`PrintableSupervisorLogsModal.tsx`)**: Included Supervisor details (`Supervisor: [Name] ([Email])`) in the top PDF report header metadata strip and right signature block (`Verified & Approved By`).
  - **On-Screen Table & Mobile Touch Cards (`OperationsClient.tsx`)**: Updated desktop data table (`hidden sm:block`) and mobile touch cards (`block sm:hidden`) for `logsViewMode === "operator"` to render Model/Code, Shift Timings (`formatCompactTiming`), OP/OT hours, Status (Normal / Breakdown), Remarks, Verification Badge, and Verify Log action button.
  - **Excel Export Engine Alignment (`supervisor-logs-export.ts`)**: Updated `exportSupervisorRunningLogsToExcel()` when `viewMode === "operator"` to output matching report title, operator/supervisor metadata rows, 11-column spreadsheet layout, summary totals, and column widths.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across all 9 packages**).

- **Page Feedback: /operations?tab=logs — Operator & Machine All Option Removal & Recent Selected Defaulting (`apps/web/components/operations/OperationsClient.tsx`) (2026-08-22)**:
  - **Operator Select Refinement & Defaulting (`OperationsClient.tsx`)**: Removed `{ value: "all", label: "All Operators" }` from `<Select label="Select Operator">` per user feedback item 1. Derived `orderedOperators` list preserving recent activity order in `hourLogs` (sorted by `log_date DESC`), automatically setting default selected operator (`activeOperatorId`) to the most recently active operator logged.
  - **Machine Select Refinement & Defaulting (`OperationsClient.tsx`)**: Removed `{ value: "all", label: "All Machines" }` from `<Select label="Select Machine">` per user feedback item 2. Derived `orderedMachines` list preserving recent activity order in `hourLogs` (sorted by `log_date DESC`), automatically setting default selected machine (`activeMachineId`) to the most recently active machine logged.
  - **View Mode Switching & Export Alignment (`OperationsClient.tsx`)**: Updated View Mode pill switcher onClick handlers to automatically select the most recently active machine or operator when switching modes. Synchronized Excel export and Printable PDF Report modal triggers to use `activeMachineId` and `activeOperatorId`.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /operations?tab=logs — Default Recent Selected Client Ordering, Search Logs Box Removal & View Mode Pill Label Simplification (`apps/web/components/operations/OperationsClient.tsx`) (2026-08-22)**:
  - **Recent Client Selection Order (`OperationsClient.tsx`)**: Refactored `uniqueClients` derivation to preserve activity order in `hourLogs` (sorted by `log_date DESC`), automatically setting default selected client (`activeClientName`) and dropdown options to the most recently active client per user feedback item 1.
  - **Search Logs Box Teardown (`OperationsClient.tsx`)**: Removed the `<div className="sm:col-span-2">...Search Logs...</div>` input box, `logsSearchQuery` state, text search filter logic, and unused `Search` icon import per user feedback item 2. Simplified toolbar grid to 2 columns (`sm:grid-cols-2`).
  - **View Mode Pill Label Simplification (`OperationsClient.tsx`)**: Updated view mode pill switcher buttons, replacing `"By Machine"`, `"By Client"`, and `"By Operator"` labels with `"Machine"`, `"Clients"`, and `"Operator"` per user feedback item 3.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /operations?tab=logs — Client Dropdown All Option Removal, Default Current Month Selection & All Logs View Mode Teardown (`apps/web/components/operations/OperationsClient.tsx`) (2026-08-22)**:
  - **Client Select Dropdown Refinement (`OperationsClient.tsx`)**: Removed `{ value: "all", label: "All Clients" }` from `<Select label="Select Client / Customer">` per user feedback item 1. Updated `activeClientName` fallback to automatically select the first client in `uniqueClients` when switching to `By Client` mode.
  - **Default Current Month Selection (`OperationsClient.tsx`)**: Added `getCurrentMonthValue()` helper function returning 2-digit current month string (e.g. `"08"`). Initialized `logsSelectedMonth` state to `getCurrentMonthValue()`, defaulting month filter to current month ("August") per user feedback item 2.
  - **All Logs View Mode Teardown (`OperationsClient.tsx`)**: Removed the `"All Logs"` button from the View Mode pill switcher container per user feedback item 3. Updated `logsViewMode` default state from `"all"` to `"machine"`. Removed `{logsViewMode === "all" && (...)}` placeholder box and cleaned up unused `AnimatedGauge` icon import.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across all 9 packages**).

- **Page Feedback: /operations?tab=logs — By Client Logs Start/End Meter Teardown & Operator Timings, Overtime & Breakdown Display (`apps/web/components/operations/OperationsClient.tsx`, `apps/web/components/operations/PrintableSupervisorLogsModal.tsx`, `apps/web/lib/utils/supervisor-logs-export.ts`) (2026-08-22)**:
  - **By Client Table Column Refinement (`OperationsClient.tsx`)**: Refactored `By Client` logs view (`logsViewMode === "client"`) under `/operations?tab=logs` desktop data table (`hidden sm:block`) and mobile touch cards (`block sm:hidden`) to remove `"Start Meter"` and `"End Meter"` columns per user page feedback items 1, 2, 4, and 5.
  - **Timings, Overtime & Breakdown Display (`OperationsClient.tsx`)**: Added `"Start & End Time"` column displaying operator shift timings (`start_time` - `end_time`), `"Overtime"` column displaying overtime hours (`overtime_hours`), and `"Breakdown"` column displaying breakdown status (`is_breakdown` -> Breakdown / Normal) for `By Client` logs mode per user feedback item 3.
  - **Printable PDF & Excel Export Synchronization (`PrintableSupervisorLogsModal.tsx`, `supervisor-logs-export.ts`)**: Synchronized `<PrintableSupervisorLogsModal>` and `exportSupervisorRunningLogsToExcel()` to output Operator Timings, Overtime Hours, and Breakdown Status in place of meter readings when generating reports or Excel downloads in `By Client` mode.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors across all 9 packages**).

- **Page Feedback: /operations?tab=logs — Operations Page Dynamic Selected Table Title & Functional Supervisor Operator Reassignment (`apps/web/components/operations/OperationsClient.tsx`, `apps/web/app/actions/operators.ts`) (2026-08-22)**:
  - **Dynamic Table Title Header (`OperationsClient.tsx`)**: Replaced static `"Operations & Fleet Management"` heading with dynamic title mapping (`TAB_TITLES[activeTab]`), displaying the exact selected table title: `"Daily Machine Running Hours"` (`tab=logs`), `"Operator Machine Assignments"` (`tab=assignments`), `"Site Movement Logsheet"` (`tab=site-movement`), `"Operator Directory & Payroll"` (`tab=operators`), `"Daily Machine Log Entry"` (`tab=entry`), and `"Daily Machine Log History"` (`tab=history`).
  - **Functional Supervisor Operator Reassignment (`operators.ts`, `OperationsClient.tsx`)**: Implemented the missing `{showAssignModal && (...)}` Assign/Reassign Operator dialog in `<OperationsClient>`. Enhanced `assignOperatorToMachineAction` in `operators.ts` to query and automatically end any active assignments for the selected operator on previous machines (`status = 'ended'`, `unassigned_at = NOW()`), clear `current_operator_id` on the operator's previous machine, insert the new active assignment record in `machine_assignments`, and update `current_operator_id` on the target machine.
  - **Reassignment Warning & Quick Table Actions (`OperationsClient.tsx`)**: Rendered an interactive Operator Reassignment notice banner when selecting an operator operating another machine. Added a `"Reassign"` CTA button to the Operator Machine Assignments data table rows.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /operations?tab=logs — Supervisor Machine Running Hours Logs by Machine, Client & Operator with Month-Wise Filtering & Excel/PDF Exports (`apps/web/app/(app)/operations/page.tsx`, `apps/web/components/operations/OperationsClient.tsx`, `apps/web/lib/utils/supervisor-logs-export.ts`, `apps/web/components/operations/PrintableSupervisorLogsModal.tsx`) (2026-08-22)**:
  - **Server Data Query Expansion (`operations/page.tsx`)**: Extended `machine_hour_logs` database query projection to select machine customer info (`customer_name`, `customer_mobile`, `city`, `state`, `model`) and operator contact info (`full_name`, `phone`, `email`). Expanded query limit to 500 records for historical month-wise tracking.
  - **Multi-View & Month-Wise Filtering (`OperationsClient.tsx`)**: Built interactive View Mode switcher (`All Logs`, `By Machine`, `By Client`, `By Operator`), Month Selector (`All Months` + `Jan` through `Dec`), dynamic entity selector dropdowns (Machine, Client, Operator), and live search filter.
  - **KPI Summary Metrics Strip (`OperationsClient.tsx`)**: Added real-time summary metrics bar calculating Total Run Hours, Total Overtime Hours, Breakdown Events count, and Filtered Records count.
  - **3-Tier Responsive Table & Touch Cards (`OperationsClient.tsx`)**: Rendered high-density desktop data table (`hidden sm:block`) with 9 detailed columns and mobile touch cards (`block sm:hidden`) with ≥44px touch targets.
  - **Excel (.xlsx) & Printable PDF Report Exports (`supervisor-logs-export.ts`, `PrintableSupervisorLogsModal.tsx`)**: Built `exportSupervisorRunningLogsToExcel()` spreadsheet generator and `<PrintableSupervisorLogsModal>` for A4 PDF reports with Reach International header branding, supervisor filter metadata, summary totals, and sign-off verification blocks.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /operations?tab=logs — Operations Inner Sub-Nav Bar & Top Action Buttons Teardown (`apps/web/components/operations/OperationsClient.tsx`) (2026-08-22)**:
  - **Header & Sub-Nav Bar Teardown (`OperationsClient.tsx`)**: Removed duplicate inner sub-nav navbar pill container (`.flex items-center gap-1.5 overflow-x-auto...`) from `<OperationsClient>` per user feedback item 1. Sub-navigation across operational tabs (`Running Hours`, `Operator Assignments`, `Site Movement`, `Operator Directory & Payroll`) is natively handled by sidebar subItems (`AppSidebar.tsx`).
  - **Header Button Removal (`OperationsClient.tsx`)**: Removed secondary header buttons `"Hire Operator"` (feedback item 2) and `"Log Loading/Unloading"` (feedback item 3). Retained primary CTA `"Assign Operator"` and section heading `"Operations & Fleet Management"`.
  - **Unused Imports Clean-Up (`OperationsClient.tsx`)**: Cleaned up unused `Link` from `next/link` and unused icons `AnimatedClipboardList`, `AnimatedPackage`, `AnimatedUsers`.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /machinesss — 404 / NotFound PublicNavbar Removal & 3-Tier Responsive Card Layout (`apps/web/app/not-found.tsx`) (2026-08-22)**:
  - **PublicNavbar Teardown (`not-found.tsx`)**: Removed `<PublicNavbar />` import and JSX rendering from the 404 / NotFound page per user feedback items 1 and 2. Removed `pt-16` root container offset.
  - **Top Header Branding (`not-found.tsx`)**: Added clean `<ReachInternationalLogo variant="full" size={28} />` brand header linking to `/dashboard` at the top of the 404 layout.
  - **Responsive 3-Tier Card & Layout (`not-found.tsx`)**: Refactored card container (`w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl`), SVG illustration sizing (`max-w-[140px] sm:max-w-[180px] md:max-w-[210px] mx-auto`), typography scaling (`text-xl sm:text-2xl md:text-3xl`), and action button layout (`flex flex-col sm:flex-row w-full sm:w-auto`) for seamless mobile, tablet, and desktop viewports.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /operations?tab=entry — Operations Subnav Cleanup, Role Access Protection & Tab Renaming (`apps/web/app/(app)/operations/page.tsx`, `apps/web/components/operations/OperationsClient.tsx`, `AppSidebar.tsx`, `CommandPalette.tsx`, `machine-client-view.tsx`) (2026-08-22)**:
  - **Server-Side Route Protection (`operations/page.tsx`)**: Added server-side URL protection for non-operator users accessing `/operations`: any direct request to `tab=entry`, `tab=history`, `tab=machines`, or invalid/missing tab automatically redirects to `/operations?tab=logs`. Operators accessing non-operator tabs continue to redirect to `/operations?tab=entry`.
  - **Operations Client UI Overhaul (`OperationsClient.tsx`)**: Removed `Machines Directory` (`machines`) tab, search input, status filter pills, and directory table. Removed `Log Entry` (`entry`) and `Log History` (`history`) tabs from non-operator subnav pills. Renamed `Daily Running Hours` tab label to `Running Hours`. Removed subtitle description text paragraph (`Manage machinery fleet...`). Restricted `<OperatorDashboard>` rendering strictly to `userRole === "operator"`. Eliminated duplicate navbars.
  - **Sidebar & Command Palette Alignment (`AppSidebar.tsx`, `CommandPalette.tsx`)**: Updated `AppSidebar.tsx` subItems for non-operators to remove `Machine Directory`, `Log Entry`, and `Log History`, leaving only `Running Hours`, `Operator Machine Assignments`, `Site Movement`, and `Operator Directory & Payroll`. Restricted `CommandPalette.tsx` `nav-operations-entry` and `nav-operations-history` to `["operator"]` only and added `nav-operations-running-hours` (`/operations?tab=logs`) command for non-operators.
  - **Machine Detail Page Link Alignment (`machine-client-view.tsx`)**: Updated CTA button link in `running_hours` tab on machine detail view from `/operations?tab=entry` to `/operations?tab=logs`.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Bug Fix: Tooltip Controlled / Uncontrolled React Warning Fix (`apps/web/components/ui/tooltip.tsx`) (2026-08-22)**:
  - **Early Guard Return (`tooltip.tsx`)**: Updated `TooltipWrapper` to return `{children}` directly when `disabled` is true (`if (!content || disabled) return <>{children}</>;`). Updated `SidebarTooltip` to return `{children}` directly when `enabled` is false (`if (!content || !enabled) return <>{children}</>;`).
  - **Prop Consistency & Support (`tooltip.tsx`)**: Removed ternary `open={disabled ? false : undefined}` and `open={enabled ? undefined : false}` toggles from `<Tooltip>`, preventing `open` prop from switching between `undefined` (uncontrolled) and `false` (controlled). Exposed `open`, `defaultOpen`, and `onOpenChange` on `TooltipWrapper`.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Bug Fix: /machines/[id] — React Hydration Error Fix (`In HTML, <tr> cannot be a child of <tr>`) (`apps/web/components/ui/Table.tsx`) (2026-08-22)**:
  - **`TableHeader` Redundant `<tr>` Teardown (`Table.tsx`)**: Removed redundant `<tr className="border-b border-border">` wrapper inside `<TableHeader>`, allowing `<TableRow>` to serve as the direct child of `<thead>`.
  - **DOM Semantics & Hydration Fix**: Eliminated nested `<tr>` elements inside `<tr>` across all tables, resolving Next.js HTML hydration mismatch errors.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors across 9/9 packages**).

- **Bug Fix: /machines — Error Fetching Machines Query Error Guard & Fallback (`apps/web/lib/queries/machines.ts`) (2026-08-21)**:
  - **List Column Projection Alignment (`lib/queries/machines.ts`)**: Updated `MACHINE_LIST_COLUMNS` in `getMachines()` to select standard machine columns guaranteed in the database schema.
  - **Error Logging & Exception Guard (`lib/queries/machines.ts`)**: Enhanced `console.error` logging in `getMachines()` to output `error.message` and `error.details` explicitly instead of empty `{}` object. Replaced unhandled `throw new Error("Failed to fetch machines")` with a safe empty result fallback (`{ machines: [], total: 0, page, pageSize, totalPages: 0 }`), preventing runtime page crashes.
  - **Single Machine Detail Fallback Query (`lib/queries/machines.ts`)**: Added automatic fallback query in `getCachedMachineById()` so that if selecting extended technical fields fails on un-migrated tables, it safely falls back to standard machine columns without throwing errors.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors across 9/9 packages**).

- **Machine Detail Page & Machine Modal Polish (`/machines/[id]`, `MachineModal.tsx`, `040_machine_extended_spec_fields.sql`, `lib/queries/machines.ts`, `app/actions/machines.ts`, `@reachinternational/types`, `@reachinternational/validation`) (2026-08-21)**:
  - **Database Migration (`040_machine_extended_spec_fields.sql`)**: Added technical parameter columns to `public.machines`: `front_tyre_size`, `back_tyre_size`, `starter_motor_teeth`, `air_filter_no`, `headgas_kit_notch`, and `diesel_filter_no` with performance indexes.
  - **Domain Packages & Schemas (`@reachinternational/types`, `@reachinternational/validation`)**: Extended `Machine` interface in `packages/types/src/database.ts` and Zod validation schemas in `packages/validation/src/machine.ts`.
  - **Optimized Queries & Server Actions (`lib/queries/machines.ts`, `app/actions/machines.ts`)**: Updated `MACHINE_LIST_COLUMNS` and single machine queries to include all technical spec columns. Added cached helper functions `getMachineBreakdownHistory`, `getMachineHourMeterLogs`, `getMachinePartsUsedHistory`, and `getMachineActiveRental`. Updated `createMachine` and `updateMachine` server actions to process and persist all new fields safely.
  - **Machine Add/Edit Modal (`MachineModal.tsx`)**: Added inputs for Front/Back Tyre Size, Starter Motor Teeth, Air Filter No, Headgas Kit Notch, Diesel Filter No, Serial No, Model, Category, Manufacturer, Year of Mfg, Engine Serial No, Engine Mot No, Insurance, 3rd Party Certificate, and RTO Tax details.
  - **Machine Detail Page UI/UX (`page.tsx`, `machine-client-view.tsx`)**: Fetched machine details, service history, breakdown history, hour meter logs, parts used history, and active rental client details concurrently using `Promise.all()`. Rendered ALL 22 technical parameters on Overview with empty fallbacks (`-`). Rendered Client Details Card when status is `On Rent` showing Customer Company Name, Contact Person, Mobile, Email, Site Address, City, State, Contract dates, Rate, and touch quick actions. Rendered unified sub-tab switcher for Service & Breakdown History, Hour Meter Running Machine History (with Client and Operator details), All Parts Used History, Service Intervals (90 days, 180 days, 250h, 500h) & Maintenance Checklist Rules, and Compliance Documents.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=entry — Automatic Machine Starting Meter Fetch from Database (`apps/web/components/dashboard/OperatorDashboard.tsx`) (2026-08-21)**:
  - **Database Meter Auto-Fetch (`OperatorDashboard.tsx`)**: Created `getLatestMeterForMachine` helper in `<OperatorDashboard>` to query the latest recorded ending meter reading (`end_meter`) for a machine from recent logs, falling back to current machine `hour_meter` stored in the PostgreSQL database.
  - **Machine Selection & Form State Sync (`OperatorDashboard.tsx`)**: Synchronized starting meter reading (`startMeter`) automatically on component initialization, machine dropdown selection (`handleSelectMachine`), and reactive `useEffect` state sync when machine or recent logs change per user page feedback ("yesterday ending meter reading will be today start meter reading start meter should auto fetched from the database according to the selected machine").
  - **UI Visual Indicator (`OperatorDashboard.tsx`)**: Added an `Auto-fetched` badge indicator above the Starting Meter (hrs) input field label in Section B.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=history — CommandPalette & GlobalCreateModal Operator Role Scoping (`apps/web/components/ui/CommandPalette.tsx`, `apps/web/components/layout/GlobalCreateModal.tsx`) (2026-08-21)**:
  - **`CommandPalette` Role Scoping (`CommandPalette.tsx`)**: Added explicit `roles` array (`["super_admin", "admin", "branch_manager", "service_manager", "service_engineer", "engineer", "supervisor", "store_manager", "mechanic"]`) to `nav-services` ("Go to Service Logs" -> `/machines?tab=services`), which previously lacked a `roles` restriction and was improperly displayed to `operator` role users per user page feedback. Guaranteed that `operator` role users searching or browsing in `<CommandPalette>` only see pages they are authorized to access (`/operations?tab=entry` and `/operations?tab=history`).
  - **`GlobalCreateModal` Action Scoping & Null Guard (`GlobalCreateModal.tsx`)**: Removed `"operator"` from `complaint` quick creation action `roles`, as `/service` routes are protected from `operator` users. Added a null guard (`if (availableActions.length === 0) return null;`) to hide the top header `Create` CTA button entirely for user roles with no available quick actions.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=entry — Mobile Bottom Navigation Cleanup & Operations Page Subnav Bar (`apps/web/components/layout/MobileBottomNav.tsx`, `apps/web/components/dashboard/OperatorDashboard.tsx`) (2026-08-21)**:
  - **Mobile Bottom Navigation Teardown (`MobileBottomNav.tsx`)**: Removed redundant `"Log Entry"` (`/operations?tab=entry`) and `"Log History"` (`/operations?tab=history`) items from the mobile bottom navbar for operator role users per user page feedback.
  - **Bottom Navbar Route Active Match Alignment (`MobileBottomNav.tsx`)**: Updated `isTabMatch` evaluation so `href: "/operations"` remains active across all Operations sub-tabs (`/operations`, `/operations?tab=entry`, `/operations?tab=history`, etc.).
  - **Operations Page Header Subnav Bar (`OperatorDashboard.tsx`)**: Enabled subnav tab switcher strip (`Log Entry` and `Log History`) on all viewports (including mobile phone displays ≤640px / 412×915), removing `hidden` restriction and ensuring clean, touch-accessible sub-tab navigation directly on the Operations page header.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=entry — Manual Fill Overtime Input & Form Layout Cleanup (`supabase/migrations/039_operator_manual_overtime_fill.sql`, `apps/web/components/dashboard/OperatorDashboard.tsx`, `apps/web/app/actions/operators.ts`) (2026-08-21)**:
  - **Sky Info Strip Removal (`OperatorDashboard.tsx`)**: Removed redundant sky blue Operating Time & Meter Run banner strip (`.p-2 sm:p-2.5 rounded-lg bg-sky-500/10...`) from Section B per user page feedback item 1.
  - **`Std: 8h` Badge Removal (`OperatorDashboard.tsx`)**: Removed `Std: 8h` label badge from Section B per user page feedback item 2.
  - **Manual Fill Overtime Input (`OperatorDashboard.tsx`, `Edit Modal`)**: Converted Overtime (Hours) from a read-only auto-calculated box into an editable `<input type="number" step="0.1" min="0" ...>` field in both the Section B daily log entry form and the Edit Log Modal per user page feedback item 3. Removed auto-sync `useEffect` hooks so manually typed overtime numbers are preserved.
  - **Server Actions & Database Persistence (`operators.ts`, `039_operator_manual_overtime_fill.sql`)**: Updated `submitOperatorHourLogAction` and `updateOperatorHourLogAction` to accept and insert/update `overtime_hours` directly from the manually entered payload. Created database migration `039_operator_manual_overtime_fill.sql` to update trigger `auto_calculate_machine_hour_log_overtime()` so it respects manually filled `overtime_hours` values without overwriting them.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=entry — Mobile Viewport Optimization & Horizontal Input Box Layout (`apps/web/components/dashboard/OperatorDashboard.tsx`) (2026-08-21)**:
  - **Horizontal Input Pairing on Mobile (`OperatorDashboard.tsx`)**: Refactored grid layouts across form sections to place input boxes side-by-side in 2-column horizontal rows on mobile viewports (≤640px / 412×915).
  - **Section A Reflow**: Machine Name rendered full-width (col-span-2) in row 1, while Machine Code / No. and Model are paired side-by-side (col-span-1 each) in row 2 on mobile (`grid grid-cols-2 md:grid-cols-3`).
  - **Section B Reflow**: Starting Meter (hrs) and Ending Meter (hrs) paired side-by-side in row 1, Start Time and End Time paired side-by-side in row 2, and Overtime (Hours) rendered in row 3 on mobile (`grid grid-cols-2 lg:grid-cols-5`), reducing vertical stack height from 5 rows down to 3 rows.
  - **Section C & D Vertical Space Reduction**: Breakdown Duration (Hours) and Breakdown Duration (Minutes) paired side-by-side (`grid grid-cols-2`). Reduced inner form section gaps (`space-y-3 sm:space-y-6` and `space-y-2.5 sm:space-y-4`) and remarks textarea height (`rows={2}`) to maximize visible screen space on phone displays.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors across 9/9 packages**).

- **Page Feedback: /operations?tab=entry — Daily Machine Hour Meter Reading Record & Database Storage (`supabase/migrations/038_operator_hour_meter_readings.sql`, `apps/web/components/dashboard/OperatorDashboard.tsx`, `apps/web/app/actions/operators.ts`, `apps/web/components/dashboard/PrintableOperatorLogsModal.tsx`, `apps/web/lib/utils/operator-logs-export.ts`) (2026-08-21)**:
  - **Database Migration (`038_operator_hour_meter_readings.sql`)**: Enforced default values `0` for `start_meter` and `end_meter` on `public.machine_hour_logs` and created index `idx_machine_hour_logs_meters`.
  - **Form UI & State (`OperatorDashboard.tsx`)**: Added `startMeter` and `endMeter` state variables. Auto-populates `startMeter` and `endMeter` with `selectedMachine.hour_meter` when a machine is selected or changed. Rendered Starting Meter (hrs) and Ending Meter (hrs) input fields in Section B alongside Start Time, End Time, and Overtime. Displayed real-time Meter Running Hours calculation badge (`Meter Run: +X.X hrs`) and validation error strip (`Ending hour meter reading cannot be less than starting hour meter reading`). Saved and restored `startMeter` and `endMeter` in `localStorage` draft persistence.
  - **Server Actions & Database Persistence (`operators.ts`)**: Passed `startMeter` and `endMeter` in `submitOperatorHourLogAction` and `updateOperatorHourLogAction`. Inserts/updates `start_meter` and `end_meter` in `machine_hour_logs` and automatically updates current `machines.hour_meter = endMeter`.
  - **Log History & Modals Display**: Rendered Hour Meter Reading (`start_meter → end_meter (+running_hours)`) column in Log History desktop table and mobile native touch cards. Added Hour Meter summary row (`startMeter → endMeter (+meterRunningHours h)`) to Submission Confirmation Modal. Added Start Meter and End Meter input fields to Edit Log Modal. Added `METER (HRS)` column (`START → END`) to Printable PDF Report (`PrintableOperatorLogsModal.tsx`). Added `Start Meter (hrs)`, `End Meter (hrs)`, and `Meter Run (hrs)` columns to Excel Export Engine (`operator-logs-export.ts`).
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors across 9/9 packages**).

- **Page Feedback: /machines?tab=inventory — Strict Direct URL Route Protection (`apps/web/lib/dal.ts`, `apps/web/proxy.ts`, `apps/web/app/page.tsx`, `apps/web/app/(app)/*/page.tsx`) (2026-08-21)**:
  - **Server Protection Helper (`lib/dal.ts`)**: Created `protectDisabledRoute(role)` helper function in `lib/dal.ts` that enforces an immediate server-side redirect to `/operations?tab=entry` for `operator` users and `/machines` for all other active roles.
  - **Server Page Integration (`(app)/*/page.tsx`)**: Integrated `protectDisabledRoute(role)` across all 20+ disabled server page routes (`dashboard`, `my-work`, `tasks`, `rentals`, `crm`, `service`, `inventory`, `vendors`, `purchase-orders`, `challans`, `documents`, `hr`, `finance`, `reports`, `administration`, `audit-logs`, `branches`, `users`, `notifications`, `vendors/[id]`, `purchase-orders/[id]`, `clients/[id]`). Any direct URL navigation attempt to these routes immediately redirects the browser.
  - **Root URL Redirect Alignment (`proxy.ts`, `app/page.tsx`)**: Updated root route `/` in `proxy.ts` and `app/page.tsx` to redirect authenticated users directly to `/machines` (or `/operations?tab=entry` for operators).
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /machines?tab=inventory — Sidebar Navigation Item Scoping (`apps/web/components/layout/AppSidebar.tsx`, `apps/web/components/layout/MobileBottomNav.tsx`) (2026-08-21)**:
  - **Sidebar Scoping (`AppSidebar.tsx`)**: Filtered `mainNavItems` in `AppSidebar.tsx` to display exclusively **Machines** (`/machines`) and **Operations** (`/operations`) in the sidebar menu per user feedback, hiding Dashboard, My Work, To-Do, Rentals, CRM, Service, Inventory, Vendors, POs, Challans, Documents, HR, Finance, Reports, Administration. Removed unused icon imports and obsolete route mapping conditionals.
  - **Mobile Bottom Navigation (`MobileBottomNav.tsx`)**: Replaced Dashboard tab with **Operations** (`/operations`) in non-operator bottom navigation items to align mobile navigation with sidebar scoping.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /operations?tab=entry — Header Bar & Operator Banner Removal (`apps/web/components/operations/OperationsClient.tsx`) (2026-08-21)**:
  - **Header Bar Removal (`OperationsClient.tsx`)**: Removed outer top Header Bar container (`.flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4`) per feedback item 2, eliminating duplicate header titles and CTA action buttons on `/operations?tab=entry`.
  - **Operator Banner Card Removal (`OperationsClient.tsx`)**: Removed redundant "Operator Daily Machine Logbook" banner card container (`.p-4 sm:p-5 rounded-2xl border border-sky-500/20 bg-sky-500/5...`) per feedback item 1.
  - **Unused Import Teardown**: Cleaned up unused icon imports (`AnimatedUserCheck`, `AnimatedGauge`) and `Link` import (`next/link`) from `OperationsClient.tsx`.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /dashboard?tab=entry — Operator Daily Log Entry & Log History Shifting to Operations Page (`apps/web/app/(app)/operations/page.tsx`, `apps/web/components/operations/OperationsClient.tsx`, `apps/web/components/dashboard/OperatorDashboard.tsx`, `apps/web/app/(app)/dashboard/page.tsx`, `apps/web/components/layout/MobileBottomNav.tsx`) (2026-08-21)**:
  - **Operations Server Page Route (`operations/page.tsx`)**: Extended `OperationsPage` server component to accept `searchParams` (`tab`), fetch `assignedMachine` and `recentOperatorLogs` for the logged-in operator, and pass `user`, `assignedMachine`, `recentLogs`, `allMachines`, and `initialTab` to `OperationsClient`.
  - **Operations Client Component Integration (`OperationsClient.tsx`)**: Supported `tab` values `"entry"` and `"history"`. Rendered `<OperatorDashboard>` directly inside `OperationsClient` when `activeTab === "entry" || activeTab === "history"`. Updated all toolbar CTA buttons and logbook banner links to point to `/operations?tab=entry` and `/operations?tab=history`. Defaulted active tab to `"entry"` for `operator` role users when on `/operations`.
  - **Operator Dashboard Routing (`OperatorDashboard.tsx`)**: Updated `handleTabSwitch` to execute `router.push(tab === "history" ? "/operations?tab=history" : "/operations?tab=entry", { scroll: false })`, keeping all tab switching scoped to `/operations`.
  - **Dashboard Route Redirect (`dashboard/page.tsx`)**: Added server-side `redirect` in `DashboardPage` so any requests from `operator` users or with `tab=entry`/`tab=history` on `/dashboard` automatically redirect to `/operations?tab=entry` or `/operations?tab=history`.
  - **Mobile Bottom Navigation (`MobileBottomNav.tsx`)**: Updated operator bottom navigation tab links for `log-entry` (`/operations?tab=entry`) and `log-history` (`/operations?tab=history`).
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors across 9/9 packages**).

- **Page Feedback: /dashboard?tab=history — Sidebar Navigation Polish & Operator Operations Routing (`apps/web/components/layout/AppSidebar.tsx`, `CommandPalette.tsx`, `MobileBottomNav.tsx`, `OperationsClient.tsx`) (2026-08-21)**:
  - **Dashboard Navigation Rename & Role Restriction (`AppSidebar.tsx`)**: Renamed `/dashboard` item label from `"Log Entry"` back to `"Dashboard"`. Removed `"operator"` from `roles` array in the `/dashboard` item configuration so it is hidden from operators in the main sidebar.
  - **Remove "Log History" Item (`AppSidebar.tsx`, `CommandPalette.tsx`)**: Deleted `{ href: "/dashboard?tab=history", label: "Log History" }` item from `mainNavItems` in `AppSidebar.tsx` and removed `nav-log-history` item from `CommandPalette.tsx`.
  - **Enable Operations Page for Operator Role (`AppSidebar.tsx`, `MobileBottomNav.tsx`)**: Added `"operator"` to the `roles` array of `/operations` in `AppSidebar.tsx` (`roles: [..., "operator"]`) and added **Operations** (`/operations`) as a key navigation tab in `MobileBottomNav.tsx` for `operator` role users.
  - **Operations Log Entry & History Integration (`OperationsClient.tsx`)**: Added **"+ Log Entry"** (`/dashboard?tab=entry`) and **"Log History"** (`/dashboard?tab=history`) CTA buttons to the Operations toolbar and rendered an **Operator Daily Machine Logbook** quick banner card on the Operations page for operators.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors across 9/9 packages**).

- **AI Customization Protocol: Mandatory AI Agent Rule Reading & Strict Compliance (`.agents/rules/mandatory_rules_reading_and_enforcement.md`, `AGENTS.md`) (2026-08-21)**:
  - **New Rule Specification (`.agents/rules/mandatory_rules_reading_and_enforcement.md`)**: Established non-negotiable rule requiring AI agents to read and strictly enforce all 12 domain rules in `C:\Users\vaibh\PROGRAMMING\PROJECTS\ReachInternational-Monorepo\AI\RULES` and all rule files in `C:\Users\vaibh\PROGRAMMING\PROJECTS\ReachInternational-Monorepo\.agents\rules` before executing any task/session/change.
  - **System Protocol Alignment (`AGENTS.md`)**: Updated `AGENTS.md` Step 1 to enforce mandatory rule reading and strict compliance across every task, session, and change.
  - **Verification**: Verified rule pathing, structure, and system prompt integration.

- **Bug Fix: /login — False Error Alert Banner Prevention on Successful Login (`apps/web/app/login/login-form.tsx`, `forgot-password/page.tsx`, `signup/page.tsx`) (2026-08-21)**:
  - **Redirect Exception Protection (`login-form.tsx`)**: Created `isRedirectError(error)` helper function to detect Next.js `NEXT_REDIRECT` control-flow exceptions. Updated `handleSubmit` `catch` block to re-throw redirect errors (`if (isRedirectError(err)) throw err;`), preventing Next.js redirect exceptions from setting `state.error = "An unexpected error occurred. Please try again."` during navigation.
  - **Auth Forms Resilience Alignment (`forgot-password/page.tsx`, `signup/page.tsx`)**: Synchronized identical `isRedirectError` guard across forgot password and signup submit handlers.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /dashboard?tab=history — Printable Operator Logs Report Header Export Date Removal (`apps/web/components/dashboard/PrintableOperatorLogsModal.tsx`) (2026-08-21)**:
  - **Export Date Element Removal**: Removed `<div><strong>Export Date:</strong> {displayDateTime}</div>` from the top header metadata strip in `<OperatorLogsReportContent>` per user page feedback.
  - **Unused Import Teardown**: Removed unused `displayDateTime` variable and `formatExportDateTimeSlug` import from `PrintableOperatorLogsModal.tsx`.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /dashboard?tab=history — Operator Dashboard Header Subtitle & Excel Export Button Removal (`apps/web/components/dashboard/OperatorDashboard.tsx`) (2026-08-21)**:
  - **Header Subtitle Paragraph Removal**: Removed `<p className="hidden sm:block text-xs text-[var(--color-mute)] font-medium mt-0.5">` paragraph under the `"Welcome, Operator"` heading per feedback item 1.
  - **Excel Export Button & Unused Code Removal**: Removed the `"Excel"` (`<FileSpreadsheet>`) button from the Logs History toolbar per feedback item 2. Removed `handleExportExcelClick` function and unused `exportOperatorLogsToExcel` / `FileSpreadsheet` imports.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /dashboard?tab=history — Operator Export Filename Title Case Standardizing (`apps/web/lib/utils/operator-logs-export.ts`) (2026-08-21)**:
  - **Title Case Export Filename (`operator-logs-export.ts`)**: Updated `buildExportFileName()` to capitalize operator name and month name into Title Case format (`Deepak-Patel-August-21-08-2026-16-31.pdf` / `.xlsx`) instead of all-lowercase, producing a cleaner filename.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /dashboard?tab=entry — Operator Dashboard Breakdown Fields, Overtime Digit Display & Standard Shift Cleanup (`apps/web/components/dashboard/OperatorDashboard.tsx`) (2026-08-21)**:
  - **Breakdown Details Cleanup**: Removed `Breakdown Reason` and `Action Taken` input fields from Section C breakdown container per feedback item 1, keeping strictly Breakdown Duration (Hours) and Breakdown Duration (Minutes) inputs. Updated validation and modal summaries accordingly.
  - **Numeric Overtime Display**: Formatted the Overtime display field in Section B to show only the numeric digit (`operatingStats.overtimeHours`) per feedback item 2, removing the `"hrs OT"` text label suffix.
  - **"Standard Shift" Label Removal**: Removed the `"Standard Shift"` label text span inside the overtime field box in Section B per feedback item 3.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /dashboard?tab=history — Modal Header Icon, Description Cleanup & Month Selector Padding Alignment (`apps/web/components/dashboard/PrintableOperatorLogsModal.tsx`) (2026-08-21)**:
  - **Description Removal**: Removed `description` property from `<Modal>` in `PrintableOperatorLogsModal.tsx` per feedback item 1.
  - **Printer Header Icon Removal**: Removed `<Printer>` icon from modal header title in `PrintableOperatorLogsModal.tsx` per feedback item 2.
  - **Month Selector Padding & Bounds Alignment**: Updated Month Selector container to `max-w-[210mm] mx-auto w-full p-2.5 sm:p-4` in `PrintableOperatorLogsModal.tsx` per feedback item 3, aligning its padding and horizontal bounds with the PDF preview card.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /dashboard?tab=history — Operator Report Table Responsiveness (Mobile, Tablet, Desktop & PDF) & Container Removal (`apps/web/components/dashboard/PrintableOperatorLogsModal.tsx`) (2026-08-21)**:
  - **Neutral 50/70 Container Removal (`PrintableOperatorLogsModal.tsx`)**: Removed the two `.p-2 bg-neutral-50/70` background cards per feedback items 2 and 3. Consolidated Operator, Machine, Email, Number, Export Date, and Month details into a single clean top header strip.
  - **Cross-Platform Table & PDF Responsiveness (`PrintableOperatorLogsModal.tsx`)**: Optimized table for screen viewports (mobile ≤640px, tablet 641-1023px, desktop ≥1024px) via responsive horizontal scroll wrapper (`w-full overflow-x-auto custom-scrollbar min-w-[660px] sm:min-w-0`), preventing layout clipping. Configured `@media print` rules enforcing `w-full table-fixed min-w-0` and proportional column widths, ensuring perfect 1-page A4 PDF rendering across all devices.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /dashboard?tab=history — Operator Daily Machine Log Report UI Feedback Cleanup, Month-Wise Export & Filename Standardizing (`apps/web/components/dashboard/PrintableOperatorLogsModal.tsx`, `apps/web/lib/utils/operator-logs-export.ts`) (2026-08-21)**:
  - **Report UI Feedback Cleanup (`PrintableOperatorLogsModal.tsx`)**: Processed 8 page feedback items on `<OperatorLogsReportContent>`: removed company address text block (`.text-[9.5px]`), logo (`<ReachInternationalLogo />`), `border border` boxes around metadata cards, `"Official Machine Log Record"` badge (`.inline-block`), report reference (`REPORT REF:...`), and `"Daily Machine Operation Log Entries"` section title. Placed `OPERATOR DAILY MACHINE LOG REPORT` heading top-centered with Operator details (Name, Email, Number) and Export Date/Time centered underneath.
  - **Month-Wise Export Filtering (`operator-logs-export.ts`, `PrintableOperatorLogsModal.tsx`)**: Added `MONTH_NAMES` array (`All`, `Jan`, `Feb`, ..., `Dec`) and `getLogMonthNumber()` parser. Integrated month selection strip in `PrintableOperatorLogsModal` allowing operators to filter logs month-wise prior to export/print.
  - **Standardized Export File Naming**: Built `buildExportFileName(operatorName, selectedMonth, extension)` helper to format export file names strictly as `operator-name-month-export-date-and-time.xlsx` / `.pdf` (e.g. `vaibhav-chauhan-january-21-08-2026-16-16.xlsx`).
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /dashboard?tab=history — Printable Operator Logs PDF Report Zero-Space Timing Formatting (`10:00PM-02:00AM`) (`apps/web/components/dashboard/PrintableOperatorLogsModal.tsx`) (2026-08-21)**:
  - **Zero-Space Timings Formatter (`PrintableOperatorLogsModal.tsx`)**: Refactored `formatCompactTiming()` helper to format times strictly as `10:00PM-02:00AM` (or `06:00AM-02:00PM`) without any internal spaces.
  - **Preserved 1-Page A4 Polish (`PrintableOperatorLogsModal.tsx`)**: Retained vertical middle cell alignment (`align-middle`), compact dot-free status (`Normal` / `Breakdown`), expanded `REMARKS` column width (~120px), and single-page A4 print fit.
  - **Verification**: Executed `pnpm --filter web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /dashboard?tab=history — Operator Daily Machine Logs Excel (.xlsx) & PDF Export (`apps/web/lib/utils/operator-logs-export.ts`, `apps/web/components/dashboard/PrintableOperatorLogsModal.tsx`, `apps/web/components/dashboard/OperatorDashboard.tsx`) (2026-08-21)**:
  - **Excel Export Engine (`operator-logs-export.ts`)**: Built `exportOperatorLogsToExcel()` using `xlsx` library. Incorporates complete Company Header details (Reach International, corporate address, GSTIN: 07AALFR3906M1ZS, phone, email) and Operator Profile details (Operator name, email, export date, total logs count). Formats table headers, data rows (Log Date `DD-MM-YYYY`, Machine Name & Code, Model, Timings, Operating Hours, Overtime Hours, Breakdown Status, Breakdown details, Remarks), summary totals row, and auto-set column widths (`!cols`), triggering client-side browser file download (`.xlsx`).
  - **Printable PDF Report Modal (`PrintableOperatorLogsModal.tsx`)**: Created high-density A4 PDF report modal. Features Reach International logo & header branding, Company & Operator 2-column metadata cards, KPI summary strip (Total Logs, Total Operating Hours, Total Overtime Hours, Breakdown Events count), high-density machine logs table, verification signature blocks (Operator & Service Manager), and `@media print` CSS rules for clean PDF printing via `window.print()`.
  - **Operator Dashboard Toolbar Integration (`OperatorDashboard.tsx`)**: Added **"Excel"** (`<FileSpreadsheet>`) and **"PDF / Print"** (`<Printer>`) CTA buttons to the Logs History section header. Connected Excel export and PDF report modal triggers with toast feedback (`"Excel File Downloaded"`, `"PDF Report Opened"`).
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` and `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /dashboard?tab=history — Automatic Overtime Calculation from Start & End Times (`supabase/migrations/037_operator_overtime_auto_calc.sql`, `apps/web/components/dashboard/OperatorDashboard.tsx`, `apps/web/app/actions/operators.ts`) (2026-08-21)**:
  - **Database Migration & Trigger (`037_operator_overtime_auto_calc.sql`)**: Created PL/pgSQL function `calculate_overtime_hours(start_t, end_t)` and `BEFORE INSERT OR UPDATE` trigger `trg_auto_calculate_machine_hour_log_overtime` on `public.machine_hour_logs`. Automatically computes `overtime_hours = GREATEST(0, round((duration_hours - 8.0), 1))` for all shift logs (including overnight transitions). Ran batch SQL update on existing database records to retroactively fix out-of-sync overtime values.
  - **Frontend Auto-Calculation UI & Real-Time Sync (`OperatorDashboard.tsx`)**: Refactored `computeOperatingHours` to return `overtimeHours`. Auto-synced `overtimeHours` state to `operatingStats.overtimeHours` in log entry form and `editOperatingStats.overtimeHours` in Edit Modal. Replaced manual input field with an auto-calculated overtime badge (`Standard Shift: 8h`, `+4.0h Overtime` / `0 hrs OT`).
  - **Server Action Overtime Enforcement (`operators.ts`)**: Updated `submitOperatorHourLogAction` and `updateOperatorHourLogAction` to compute `overtime_hours` server-side via `computeOperatingHoursServer(startTime, endTime)`, guaranteeing zero mismatch between timings and overtime.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` and `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /dashboard?tab=history — Shift Column & Shift Selection Complete Removal (`apps/web/components/dashboard/OperatorDashboard.tsx`, `apps/web/components/operations/OperationsClient.tsx`, `apps/web/app/actions/operators.ts`) (2026-08-21)**:
  - **Shift Column Removal**: Removed `<th>Shift</th>` header and shift badge cells from both `<OperatorDashboard>` (Log History desktop table & mobile native cards) and `<OperationsClient>` (Supervisor Operations table).
  - **Shift Selection Removal**: Completely removed `SHIFT_PRESETS`, `getShiftBadge()`, `shift` state, and `editShift` state from `<OperatorDashboard>`. Updated Submission Confirmation Modal grid to 3 columns (Log Date, Timings, Overtime).
  - **Interval-Based Overlap Validation**: Refactored `checkShiftOverlapServer()`, `submitOperatorHourLogAction()`, `updateOperatorHourLogAction()`, and `shiftOverlapWarning` to validate operating time interval overlaps (`[start_time, end_time]`) directly without requiring fixed shift presets.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` and `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /dashboard?tab=entry — CustomTimePicker Clock Bugs & Performance Optimization (`apps/web/components/ui/CustomTimePicker.tsx`) (2026-08-21)**:
  - **Global Drag Event Management (`CustomTimePicker.tsx`)**: Attached window pointer listeners (`mousemove`, `mouseup`, `touchmove`, `touchend`) when `isDragging` is active so dragging outside dial face circle releases cleanly without stuck states or accidental time shifts.
  - **SVG `<text>` Event De-duplication (`CustomTimePicker.tsx`)**: Added `pointer-events-none` to SVG number text elements (`<text>`) to prevent double-firing events where clicking an hour number was setting the minute unexpectedly.
  - **Appear / Disappear Positioning Glitch Elimination (`CustomTimePicker.tsx`)**: Refactored popover positioning using `useLayoutEffect` to calculate bounds synchronously on open. Added `opacity: isPositionReady ? 1 : 0` and scale fade animation (`animate-in fade-in zoom-in-95`) to prevent popover from flashing at top-left `(0, 0)` before paint. Added semi-transparent backdrop overlay (`bg-black/10 dark:bg-black/30 backdrop-blur-[1px]`) for outside click handling and focus trapping.
  - **Spring Transitions & Geist Design Token Polish (`CustomTimePicker.tsx`)**: Enabled smooth spring transitions on clock hand line and tip badge (`transition: isDragging ? "none" : "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)"`) for 60fps tracking during drag and smooth gliding during clicks. Aligned font formatting to Geist Mono for digital time cards (`08:00 AM`).
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /dashboard?tab=entry — Operator Dashboard Shift Preset Buttons & Reference Banner Cleanup (`apps/web/components/dashboard/OperatorDashboard.tsx`) (2026-08-21)**:
  - **Shift Selection Preset Buttons & Subtitle Removal (`OperatorDashboard.tsx`)**: Removed `.space-y-2 > .grid` preset buttons container (`Shift 1`, `Shift 2`, `Shift 3`, `Custom Shift`) from Section B per feedback items 1 and 2. Removed helper text span (`"Operators can enter multiple non-overlapping shifts per day"`) from Section B label per feedback item 2.
  - **Reference Banner & Recorded Shifts Container Removal (`OperatorDashboard.tsx`)**: Removed reference banner and today's recorded shifts banner container (`.space-y-6 > .p-3 > .p-3 > div`) per feedback items 3 and 4. Removed shift badge span from the Operating Time calculation strip.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` and `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /dashboard?tab=entry — Multi-Shift Operator Log Entries & Non-Overlapping Shift Validation (`supabase/migrations/036_operator_multi_shift_non_overlap.sql`, `apps/web/app/actions/operators.ts`, `apps/web/components/dashboard/OperatorDashboard.tsx`, `apps/web/components/operations/OperationsClient.tsx`, `@reachinternational/types`, `@reachinternational/validation`) (2026-08-21)**:
  - **Database Migration & Trigger (`036_operator_multi_shift_non_overlap.sql`)**: Created index `idx_machine_hour_logs_operator_date`, time parsing function `parse_time_to_minutes(t TEXT)`, and trigger function `check_machine_hour_log_shift_overlap()` attached `BEFORE INSERT OR UPDATE` on `public.machine_hour_logs`. Blocks inserts/updates where shift code or time interval $[start\_time, end\_time]$ overlaps with existing entries on the same `log_date`.
  - **Backend Server Actions & Shared Schemas (`operators.ts`, `@reachinternational/types`, `@reachinternational/validation`)**: Added `checkShiftOverlapServer()` validation logic in `operators.ts`. Updated `submitOperatorHourLogAction` and `updateOperatorHourLogAction` to validate shift non-overlap and handle trigger exceptions cleanly. Extended `MachineHourLog` interface and Zod `CreateHourLogSchema` with `shift`, `start_time`, `end_time`, `overtime_hours`, `is_breakdown`.
  - **Frontend UI & Real-Time Overlap Detection (`OperatorDashboard.tsx`, `OperationsClient.tsx`)**: Added Shift selector pills (**Shift 1: 06:00 AM – 02:00 PM**, **Shift 2: 02:00 PM – 10:00 PM**, **Shift 3: 10:00 PM – 06:00 AM**, **Custom Shift**). Added Today's Recorded Shifts Banner showing all logged shifts today. Added real-time client-side shift overlap warning banner and submit button guard. Rendered Shift Badges in Log History Desktop Table, Mobile Native Cards, Confirmation Modal, and Supervisor Operations Table.
  - **Verification**: Executed `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors**).

- **Website-Wide Toast & Cookie Consent Positioning Overhaul (`apps/web/components/ui/Toast.tsx`, `CookieConsent.tsx`, `apps/web/app/layout.tsx`, `apps/web/app/(app)/layout.tsx`) (2026-08-21)**:
  - **Responsive Toast Positioning & Animations (`Toast.tsx`)**: Refactored `<ToastProvider>` positioning logic to dynamic viewport detection. Mobile viewports (≤640px) display top-centered toasts (`top-4 left-4 right-4 items-center`) that animate in from top (`y: -30 -> 0`) and exit back to top (`y: 0 -> -30`). Desktop & tablet viewports (≥641px) display top-right toasts (`sm:left-auto sm:right-4 sm:items-end`) that animate in from top-right (`y: -30, x: 30`) and exit back to top (`y: 0 -> -30`).
  - **Global Website Provider Alignment (`apps/web/app/layout.tsx`, `(app)/layout.tsx`)**: Moved `<ToastProvider>` to the root App Router layout (`apps/web/app/layout.tsx`) inside `<ThemeProvider>`, ensuring toast notifications work seamlessly across the entire website (login, signup, app dashboard, error boundaries, public pages). Removed redundant inner provider from `apps/web/app/(app)/layout.tsx`.
  - **Cookie Consent Bottom Positioning (`CookieConsent.tsx`)**: Confirmed and verified `<CookieConsent />` fixed bottom placement (`bottom-4 left-4 right-4 md:right-4 md:w-[420px]`) with smooth bottom slide-up entrance (`y: 30 -> 0`) and bottom slide-down exit (`y: 0 -> 30`).
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` and `pnpm typecheck` across all 9 monorepo workspace packages (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /dashboard — Date Format Standardization to DD-MM-YYYY across OperatorDashboard & Entire Website (`packages/utils/src/date.ts`, `apps/web/components/dashboard/OperatorDashboard.tsx`, `apps/web/components/inventory/*`, `apps/web/app/(app)/users/*`) (2026-08-21)**:
  - **Shared Date Formatting Utilities (`packages/utils/src/date.ts`)**: Refactored `formatDate`, `formatDisplayDate`, `formatDateTime`, and `formatTimeAgo` to output strict `DD-MM-YYYY` date strings (e.g. `21-08-2026`). Handled ISO strings (`YYYY-MM-DD`), date-time strings, `DD-MM-YYYY` strings, and native `Date` objects gracefully.
  - **Operator Dashboard Standardization (`OperatorDashboard.tsx`)**: Updated `<OperatorDashboard>` table view (`<td />` under `<th />` Date header), mobile native card view header, top header card date badge, reference banner, and submission confirmation modal to render all dates in `DD-MM-YYYY` format.
  - **Global Web Application Synchronization**: Updated `PrintablePurchaseOrder.tsx`, `PrintableDeliveryChallan.tsx`, `PrintablePartsIssueChallan.tsx`, `StockLedgerClient.tsx`, `PartDetailModal.tsx`, `UserRow.tsx`, and `UserDetailSheet.tsx` to consume `formatDate` for consistent date display.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9 monorepo workspace packages**).

- **Page Feedback: /dashboard?tab=entry — Operator Dashboard "Read-Only" Badges & Sparkles Graphic Cleanup (`apps/web/components/dashboard/OperatorDashboard.tsx`) (2026-08-21)**:
  - **"Read-Only" Badges Removal (`OperatorDashboard.tsx`)**: Removed redundant `"Read-Only"` badge spans (`.text-[10px]`) from the Machine Code and Model field labels in Section A.
  - **Sparkles Graphic Removal (`OperatorDashboard.tsx`)**: Removed `<Sparkles>` icon from the Operating Time calculation flex banner strip (`.p-2.5 > .flex > svg`) in Section B.
  - **Unused Import Cleanup (`OperatorDashboard.tsx`)**: Removed unused `Sparkles` icon import from `lucide-react`.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /dashboard?tab=history — Operator Dashboard Status Filter Pills Cleanup (`apps/web/components/dashboard/OperatorDashboard.tsx`) (2026-08-21)**:
  - **Status Filter Pills Container Removal (`OperatorDashboard.tsx`)**: Removed redundant Status Filter Pills flex container (`All | Stored & Approved | Draft | Correction Required`) from the Log History toolbar section (`.rounded-xl > .flex > .flex > .flex`).
  - **Toolbar Reflow (`OperatorDashboard.tsx`)**: Streamlined the toolbar right side to render only the Date/Period Filter Pills container (`Date: All | Today | Week | Month | Year`), eliminating double-stacked filter rows on mobile viewports (412×915).
  - **Unused State Cleanup (`OperatorDashboard.tsx`)**: Removed `historyStatusFilter` state variable, setter, and status filtering logic from `filteredLogs` calculation.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /dashboard?tab=entry — Operator Dashboard Reference Banner & Shortcuts Cleanup (`apps/web/components/dashboard/OperatorDashboard.tsx`) (2026-08-21)**:
  - **Last Entry & Reference Banner Reflow (`OperatorDashboard.tsx`)**: Simplified reference banner text (`Last Entry: log_date (start_time – end_time)`) to show only short needed data so it fits cleanly on mobile viewports (412px width) without layout clipping.
  - **"Reference" Badge Removal (`OperatorDashboard.tsx`)**: Removed redundant `"Reference"` badge (`.text-[10px]`) from the reference banner.
  - **Quick Shortcuts Removal (`OperatorDashboard.tsx`)**: Removed the Quick Shortcuts tags container (`"Quick Shortcuts:"`) above the Remarks textarea in Section D for a cleaner form layout.
  - **Unused State/Helper Teardown (`OperatorDashboard.tsx`)**: Cleaned up unused `quickRemarkTags` array and `handleAddTagToRemarks` helper function.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /dashboard?tab=history — Operator Dashboard Log History Mobile Viewport & Component Polish (`apps/web/components/dashboard/OperatorDashboard.tsx`) (2026-08-21)**:
  - **Filter Flex Items Reflow (`OperatorDashboard.tsx`)**: Refactored Date and Status filter flex pill containers (`Date: All | Today | Week | Month | Year` and `All | Approved | Draft | Correction`) with responsive `flex-1 sm:flex-none`, compact mobile labels, and full-width flex containers to fit properly on 412px mobile screens with zero horizontal scrolling.
  - **New Log Entry Button Placement (`OperatorDashboard.tsx`)**: Placed `+ New Log Entry` CTA button properly on the right side of the section header row (`flex flex-row items-center justify-between`) side-by-side with the section title.
  - **Header Icon Cleanup (`OperatorDashboard.tsx`)**: Removed redundant `<AnimatedFileText>` sky icon container from the section header per feedback.
  - **Header Title Simplification (`OperatorDashboard.tsx`)**: Simplified `h2` section heading text from `Daily Machine Logs History` to `Logs History`.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /dashboard — Operator Dashboard & CustomTimePicker Mobile Viewport Optimization (`apps/web/components/dashboard/OperatorDashboard.tsx`, `apps/web/components/ui/CustomTimePicker.tsx`) (2026-08-21)**:
  - **Header Banner Card Reflow (`OperatorDashboard.tsx`)**: Refactored top header card container to `rounded-xl sm:rounded-2xl p-3 sm:p-6` with compact date badge (`rounded-lg sm:rounded-xl px-2.5 py-1 sm:px-3.5 sm:py-2`).
  - **Form Outer Container & Section Cards Reflow (`OperatorDashboard.tsx`)**: Refactored outer form container to `rounded-xl sm:rounded-2xl p-3.5 sm:p-6` and inner section cards (Section A, B, C, D) to `p-3 sm:p-4 rounded-xl border`, eliminating double-nested padding on phone viewports (360px–640px) to maximize input field width.
  - **Sky Accent Banners & Calculation Strips (`OperatorDashboard.tsx`)**: Refactored `.bg-sky-500/10` banners (`Log Submitted Today`, `Operating Time Calculation`) to `rounded-lg sm:rounded-xl p-2.5 sm:p-3.5` with responsive font sizes (`text-[11px] sm:text-xs`).
  - **Status Control & Submission Footer Actions (`OperatorDashboard.tsx`)**: Refactored Machine Status buttons (`Normal` vs `Breakdown`) to `py-2.5 sm:py-3 px-3 sm:px-4 rounded-xl` with minimum 44px touch target heights, and submission action buttons (`Save Draft` and `Submit Daily Log →`) to touch-optimized min 44px height flex buttons.
  - **Log History Panel & Native Card View (`OperatorDashboard.tsx`)**: Refactored history panel container to `rounded-xl sm:rounded-2xl p-3.5 sm:p-6` and mobile native card view items to `p-3 sm:p-4 rounded-xl border space-y-2.5`.
  - **CustomTimePicker Mobile Popover & Scaling (`CustomTimePicker.tsx`)**: Updated `updatePosition` calculation to center fixed popover dialog on mobile screens (< 640px) (`max-w-[calc(100vw-16px)]`), and scaled popover width (`w-[280px] sm:w-[320px]`), padding (`p-3 sm:p-4`), digital hour/minute cards (`h-13 sm:h-16`), digital typography (`text-2xl sm:text-4xl`), and SVG clock face dial (`w-48 h-48 sm:w-58 sm:h-58`).
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /dashboard — Operator Dashboard Form Section Header Bars & Breakdown Container Simplification (`apps/web/components/dashboard/OperatorDashboard.tsx`) (2026-08-21)**:
  - **Section Header Flex Bars Removal (`OperatorDashboard.tsx`)**: Removed redundant section header flex bars (`.flex items-center justify-between border-b...`) inside Section A, B, C, D form cards (`.p-4`), eliminating visually repetitive inner header lines ("A. Machine Information", "B. Operating Hours...", etc.) and creating a cleaner form layout.
  - **Breakdown Details Container Cleanup (`OperatorDashboard.tsx`)**: Removed redundant inner header div (`.flex items-center justify-between border-b...`) and preset buttons space container (`.space-y-2`) inside the Breakdown Details panel (`.p-4` inside `.p-4`), providing a clean Breakdown Reason text input field.
  - **Unused Import Removal (`OperatorDashboard.tsx`)**: Removed unused `Wrench`, `ShieldCheck`, and `Tag` icon imports from `lucide-react`.
  - **Verification**: Executed `npx tsc --noEmit` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /dashboard — Operator Dashboard Mobile Thin Header & Bottom Navbar Sub-Tabs (`apps/web/components/dashboard/OperatorDashboard.tsx`, `apps/web/components/layout/MobileBottomNav.tsx`) (2026-08-21)**:
  - **Mobile Thin Header (`OperatorDashboard.tsx`)**: Refactored top header card container (`.rounded-2xl`) for mobile viewports (< 640px) to render a compact, single-row thin header with reduced padding (`p-3 sm:p-6`), scaled welcome text (`text-base sm:text-2xl font-extrabold`), and compact date badge (`px-2.5 py-1 text-xs sm:text-base`).
  - **Mobile Paragraph & Tab Buttons Cleanup (`OperatorDashboard.tsx`)**: Removed subtitle paragraph ("Daily Machine Log Entry Portal") on mobile viewports (`hidden sm:block`) and hid header sub-tab switcher buttons on mobile viewports (`hidden sm:flex`).
  - **Operator Role Bottom Navbar Navigation (`MobileBottomNav.tsx`)**: Configured dedicated bottom navbar items for `operator` role users, providing direct quick navigation between **"Log Entry"** (`/dashboard?tab=entry`) and **"Log History"** (`/dashboard?tab=history`). Added URL search parameter matching (`?tab=entry` vs `?tab=history`) for precise active tab indicator rendering.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Operator Dashboard Mobile Viewport Optimization & Layout Bug Fix (`apps/web/components/layout/AppShellClient.tsx`, `apps/web/components/dashboard/OperatorDashboard.tsx`) (2026-08-21)**:
  - **Mobile Layout Whitespace Fix (`AppShellClient.tsx`)**: Replaced static inline `paddingLeft` with CSS custom property `--sidebar-width` attached to the root app shell container and responsive Tailwind class `md:pl-[var(--sidebar-width)]`. On mobile viewports (< 768px), `padding-left` is automatically `0px` because the desktop sidebar (`<aside>`) is hidden (`hidden md:flex`), eliminating the 280px left whitespace bug and allowing the main workspace content to take up 100% of the screen width smoothly.
  - **Operator Dashboard Mobile Reflow (`OperatorDashboard.tsx`)**: Refactored outer container and card paddings (`p-0 sm:p-6` and `p-4 sm:p-6`) for edge-to-edge touch screen efficiency. Added smooth horizontal touch scrolling (`overflow-x-auto custom-scrollbar flex-nowrap`) to header sub-tab switcher buttons and date/status filter pills. Retained high-density desktop data table (`hidden sm:block`) and native touch card view (`block sm:hidden`) for screens < 640px.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **AI Agent Rule Enforcement Wiring (`AGENTS.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`, `README.md`) (2026-08-21)**:
  - **Rule Enforcement Synchronization**: Seamlessly integrated all 12 authoritative engineering rules in `AI/RULES/` and cross-platform UI rules in `.agents/rules/` into the root AI agent protocol `AGENTS.md` and `AI/PROJECT_MEMORY.md`.
  - **Mandatory Compliance**: Updated `AGENTS.md` Step 1 (READ PROJECT MEMORY & RULES FIRST) and `AI/PROJECT_MEMORY.md` Rule 17, establishing that all future AI coding agents MUST read and strictly enforce these 14 policy documents.
  - **Documentation & Memory Synchronization**: Updated `AGENTS.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`, `AI/STATE.md`, `AI/CHANGELOG_AI.md`, `AI/CURRENT_TASK.md`, and `README.md`.
  - **Verification**: Verified zero TypeScript errors across all monorepo packages (`pnpm typecheck`). Zero application code modified.

- **Production Deployment, DevOps & Release Policy Generation (`AI/RULES/DEPLOYMENT-DEVOPS-RELEASE.md`, `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`) (2026-08-21)**:
  - **Authoritative Deployment Policy Document (`AI/RULES/DEPLOYMENT-DEVOPS-RELEASE.md`)**: Audited hosting & runtime architecture (Vercel serverless / edge, Supabase PostgreSQL, Node 18+ LTS, `pnpm@11.21.0`), Turborepo build task pipelines (`turbo run build`, `turbo run typecheck`), database migration safety (35 SQL migrations), environment secret isolation, and post-deployment smoke testing.
  - **54-Section Engineering Policy**: Formulated executable policy detailing deployment architecture, hosting platform rules, package manager governance, secret management, database migration safety, cache invalidation, post-release smoke tests, rollback strategies, deployment anti-patterns, pre/post-implementation verification checklists for AI agents.
  - **Documentation & Memory Synchronization**: Updated `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`, `AI/STATE.md`, `AI/CHANGELOG_AI.md`, and `AI/CURRENT_TASK.md`.
  - **Verification**: Verified zero TypeScript errors across all monorepo packages (`pnpm typecheck`). Zero application code modified.

- **Production Observability, Monitoring & Logging Policy Generation (`AI/RULES/OBSERVABILITY-MONITORING-LOGGING.md`, `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`) (2026-08-21)**:
  - **Authoritative Observability Policy Document (`AI/RULES/OBSERVABILITY-MONITORING-LOGGING.md`)**: Audited audit logging engine (`apps/web/lib/audit.ts`), database audit trail schema (`public.audit_logs`), 5-level severity model (DEBUG to FATAL), structured uppercase action event standards (`ACTION_VERB_ENTITY`), PII/secret redaction rules, `/api/health` probes, and incident diagnosis workflows.
  - **45-Section Engineering Policy**: Formulated executable policy detailing structured audit logging, 5 severity levels, log volume & loop prohibitions, PII/secret redaction, health check security, incident detection/diagnosis, observability anti-patterns, pre/post-implementation verification checklists for AI agents.
  - **Documentation & Memory Synchronization**: Updated `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`, `AI/STATE.md`, `AI/CHANGELOG_AI.md`, and `AI/CURRENT_TASK.md`.
  - **Verification**: Verified zero TypeScript errors across all monorepo packages (`pnpm typecheck`). Zero application code modified.

- **Production SEO, Metadata & Discoverability Policy Generation (`AI/RULES/SEO-METADATA-DISCOVERABILITY.md`, `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`) (2026-08-21)**:
  - **Authoritative SEO Policy Document (`AI/RULES/SEO-METADATA-DISCOVERABILITY.md`)**: Audited Next.js App Router Metadata API (`apps/web/app/layout.tsx`), dynamic sitemap builder (`apps/web/app/sitemap.ts`), robots.txt (`public/robots.txt`), Open Graph previews, JSON-LD structured schemas, Edge Auth Proxy route safeguards (`proxy.ts`), and bimodal favicon systems.
  - **46-Section Engineering Policy**: Formulated executable policy detailing route classification matrix, canonical URL strategies, robots.txt security boundaries, dynamic `generateMetadata()` protocols, Open Graph preview standards, structured schema rules, SEO anti-patterns, pre/post-implementation verification checklists for AI agents.
  - **Documentation & Memory Synchronization**: Updated `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`, `AI/STATE.md`, `AI/CHANGELOG_AI.md`, and `AI/CURRENT_TASK.md`.
  - **Verification**: Verified zero TypeScript errors across all monorepo packages (`pnpm typecheck`). Zero application code modified.

- **Production Testing & Quality Assurance Policy Generation (`AI/RULES/TESTING-QA.md`, `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`) (2026-08-21)**:
  - **Authoritative Testing Policy Document (`AI/RULES/TESTING-QA.md`)**: Audited monorepo typecheck tooling (`pnpm typecheck`), Turborepo build verification (`pnpm build`), seed verification (`pnpm verify:seed`), Zod schemas (`@reachinternational/validation`), RBAC matrix (`@reachinternational/permissions`), 3-tier viewport responsiveness, and 7-step Quality Gate.
  - **53-Section Engineering Policy**: Formulated executable policy detailing testing pyramid, API/Server Action/DB/RLS verification, form & validation testing, 3-tier responsive layout audit, accessibility testing, visual regression prevention, mandatory 7-step Quality Gate, testing anti-patterns, pre/post-implementation QA checklists for AI agents.
  - **Documentation & Memory Synchronization**: Updated `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`, `AI/STATE.md`, `AI/CHANGELOG_AI.md`, and `AI/CURRENT_TASK.md`.
  - **Verification**: Verified zero TypeScript errors across all monorepo packages (`pnpm typecheck`). Zero application code modified.

- **Production Validation, Error Handling & Resilience Policy Generation (`AI/RULES/VALIDATION-ERROR-RESILIENCE.md`, `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`) (2026-08-21)**:
  - **Authoritative Resilience Policy Document (`AI/RULES/VALIDATION-ERROR-RESILIENCE.md`)**: Audited canonical Zod schemas (`@reachinternational/validation`), Next.js App Router error boundaries (`error.tsx`, `not-found.tsx`), `sonner` toast notifications, PostgreSQL transactions (`BEGIN...COMMIT`), double-submission loading spinners, Geist skeletons (`apps/web/components/ui/skeletons.tsx`), empty states, and optimistic update rollbacks.
  - **47-Section Engineering Policy**: Formulated executable policy detailing 5-layer validation model, error taxonomy (400/401/403/404/409/429/500), database ACID transactions, partial failure recovery, optimistic update rollbacks, loading/empty/error state standards, bulk operation resilience, accessibility `aria-live` error announcements, resilience anti-patterns, pre/post-implementation verification checklists for AI agents.
  - **Documentation & Memory Synchronization**: Updated `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`, `AI/STATE.md`, `AI/CHANGELOG_AI.md`, and `AI/CURRENT_TASK.md`.
  - **Verification**: Verified zero TypeScript errors across all monorepo packages (`pnpm typecheck`). Zero application code modified.

- **Production Data Protection & Privacy Policy Generation (`AI/RULES/DATA-PROTECTION-PRIVACY.md`, `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`) (2026-08-21)**:
  - **Authoritative Privacy Policy Document (`AI/RULES/DATA-PROTECTION-PRIVACY.md`)**: Audited Database schema entities (`@reachinternational/types`), Data Access Layer (`lib/dal.ts`), 5-level data classification framework, explicit column projections (no `SELECT *`), private Supabase storage buckets with time-limited signed URLs, PII masking (`XXXX-XXXX-1294`), audit logging (`lib/audit.ts`), and scope-aware caching.
  - **51-Section Engineering Policy**: Formulated executable policy detailing 11-step data lifecycle (Collection → Validation → Processing → Storage → Access → Transmission → Display → Caching → Export → Retention → Deletion), multi-tenant/branch data isolation, PII masking standards, third-party data sharing rules, cache key scope isolation, soft delete/archive rules, privacy anti-patterns, pre/post-implementation verification checklists for AI agents.
  - **Documentation & Memory Synchronization**: Updated `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`, `AI/STATE.md`, `AI/CHANGELOG_AI.md`, and `AI/CURRENT_TASK.md`.
  - **Verification**: Verified zero TypeScript errors across all monorepo packages (`pnpm typecheck`). Zero application code modified.

- **Production Authentication & Authorization Policy Generation (`AI/RULES/AUTHENTICATION-AUTHORIZATION.md`, `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`) (2026-08-21)**:
  - **Authoritative Auth Policy Document (`AI/RULES/AUTHENTICATION-AUTHORIZATION.md`)**: Audited Supabase SSR Auth, Edge Auth Proxy (`proxy.ts`), Data Access Layer (`lib/dal.ts`), 13-role RBAC (`@reachinternational/permissions`), 3-tier scoping (`global`, `branch_scoped`, `assigned`, `client_own`), BOLA/IDOR protection, Zod schemas (`@reachinternational/validation`), 35 SQL RLS migrations, private storage buckets, audit logging (`lib/audit.ts`).
  - **49-Section Engineering Policy**: Formulated executable policy detailing identity resolution, 3-layer authorization model, RBAC matrix, resource-level scoping, BOLA/IDOR prevention, Server Action security templates, business approval thresholds (>₹10k POs, >₹50k expenses, >15% rental discounts), privilege escalation guards, export/file storage security, authentication anti-patterns, pre/post-implementation verification checklists for AI agents.
  - **Documentation & Memory Synchronization**: Updated `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`, `AI/STATE.md`, `AI/CHANGELOG_AI.md`, and `AI/CURRENT_TASK.md`.
  - **Verification**: Verified zero TypeScript errors across all monorepo packages (`pnpm typecheck`). Zero application code modified.

- **Production Security Engineering Policy Generation (`AI/RULES/SECURITY.md`, `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`) (2026-08-21)**:
  - **Authoritative Security Policy Document (`AI/RULES/SECURITY.md`)**: Audited Trust Boundaries (Untrusted Client Browser/Mobile → Edge Auth Proxy → RSC/Server Actions → DAL → Supabase PostgreSQL RLS), Supabase SSR Auth, `verifySession()`, 13-role RBAC (`@reachinternational/permissions`), 3-tier scoping (`global`, `branch_scoped`, `assigned`, `client_own`), Zod schemas (`@reachinternational/validation`), 35 RLS migrations, private storage buckets, audit logging (`lib/audit.ts`).
  - **46-Section Engineering Policy**: Formulated executable policy detailing OWASP ASVS 5.0 alignment, trust boundaries, server-side authorization enforcement, BOLA/IDOR protection, mandatory RLS preservation, Server Action security templates, file upload validation (10MB caps, MIME checks, UUID renaming), business approval thresholds (>₹10k POs, >₹50k expenses, >15% rental discounts), audit logging, webhook HMAC validation, security anti-patterns, pre/post-implementation verification checklists for AI agents.
  - **Documentation & Memory Synchronization**: Updated `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`, `AI/STATE.md`, `AI/CHANGELOG_AI.md`, and `AI/CURRENT_TASK.md`.
  - **Verification**: Verified zero TypeScript errors across all monorepo packages (`pnpm typecheck`). Zero application code modified.

- **Production Performance & Optimization Policy Generation (`AI/RULES/PERFORMANCE.md`, `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`) (2026-08-21)**:
  - **Authoritative Performance Policy Document (`AI/RULES/PERFORMANCE.md`)**: Audited Rendering Pipeline (RSC by default, `'use client'` leaf node restriction), Data Access Layer (`lib/dal.ts` and `lib/cache.ts` React `cache()` + `unstable_cache()` with `CACHE_TAGS`), PostgreSQL database performance indexes (`003_performance_indexes.sql`, `012_multi_layer_performance_indexes.sql`, `013_additional_performance_indexes.sql`), RPC aggregation functions, and mobile Query caching.
  - **43-Section Engineering Policy**: Formulated executable policy detailing Core Web Vitals thresholds (LCP ≤ 2.5s, INP ≤ 200ms, CLS ≤ 0.1), request waterfall elimination (`Promise.all()`), explicit column projection rules (no `SELECT *`), keyset pagination, table row memoization, bundle size limits (<150KB gzipped per route), font swapping, memory cleanup, Supabase Realtime channel teardowns, cache invalidation tiers, mobile FlatList optimizations, security/accessibility co-existence, performance anti-patterns, pre/post-implementation verification checklists for AI agents.
  - **Documentation & Memory Synchronization**: Updated `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`, `AI/STATE.md`, `AI/CHANGELOG_AI.md`, and `AI/CURRENT_TASK.md`.
  - **Verification**: Verified zero TypeScript errors across all monorepo packages (`pnpm typecheck`). Zero application code modified.

- **Production UI/UX Policy Generation (`AI/RULES/UI-UX.md`, `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`) (2026-08-21)**:
  - **Authoritative UI/UX Policy Document (`AI/RULES/UI-UX.md`)**: Audited App Shell (`AppHeader` with `BranchSelector`, `CommandPalette` `Ctrl+K`, user menu; `AppSidebar`; `MobileBottomNav`), 26 domain routes, action hierarchy, form 4-section grouping, auto-fill/locked fields, IST `CustomTimePicker` radial clock face, sticky submit footers, 3-tier viewport responsiveness.
  - **28-Section Engineering Policy**: Formulated executable policy detailing operational efficiency over ornament, 5-zone vertical page composition, 5-level information hierarchy, search & filter UX, high-density table rules, mobile touch card reflow, form entry optimization, modal height clamping, dual empty states, loading skeletons, destructive action confirmation guards, bulk action counters, file uploader/PDF print UX, end-to-end workflow preservation, role-based scoping, 3-tier responsiveness, forbidden UX anti-patterns, pre/post-implementation verification checklists for AI agents.
  - **Documentation & Memory Synchronization**: Updated `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`, `AI/STATE.md`, `AI/CHANGELOG_AI.md`, and `AI/CURRENT_TASK.md`.
  - **Verification**: Verified zero TypeScript errors across all monorepo packages (`pnpm typecheck`). Zero application code modified.

- **Production Design System Policy Generation (`AI/RULES/DESIGN-SYSTEM.md`, `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`) (2026-08-21)**:
  - **Authoritative Design Document (`AI/RULES/DESIGN-SYSTEM.md`)**: Analyzed `DESIGN.md` (Vercel Geist System), `@reachinternational/design-tokens`, `apps/web/app/globals.css`, and shared UI primitives.
  - **18-Section Policy**: Formulated executable design policy detailing `DESIGN.md` as primary source of truth, ink & canvas duet (`#171717` ink on `#fafafa` canvas), bimodal border radius scale (`6px` app square vs `100px` marketing pill), binary font weights (600/500/400), Geist Mono role scoping, semantic status scale, 3-tier viewport responsiveness protocol (Mobile ≤640px touch card reflow `block sm:hidden`, Tablet 641-1023px 2-col grid, Desktop ≥1024px data table), dark mode rules, forbidden anti-patterns, pre/post-implementation verification checklists for AI agents.
  - **Documentation & Memory Synchronization**: Updated `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`, `AI/STATE.md`, `AI/CHANGELOG_AI.md`, and `AI/CURRENT_TASK.md`.
  - **Verification**: Verified zero TypeScript errors across all monorepo packages (`pnpm typecheck`). Zero application code modified.

- **Production Architecture Policy Generation (`AI/RULES/ARCHITECTURE.md`, `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`) (2026-08-21)**:
  - **Authoritative Architecture Document (`AI/RULES/ARCHITECTURE.md`)**: Conducted comprehensive audit of root configs (`package.json`, `pnpm-workspace.yaml`, `turbo.json`), 2 applications (`apps/web`, `apps/mobile`), 7 shared packages (`@reachinternational/types`, `validation`, `permissions`, `design-tokens`, `api-client`, `utils`, `config`), Data Access Layer (`apps/web/lib/dal.ts`), 20 server query modules, 19 Server Actions, Edge Auth Proxy (`apps/web/proxy.ts`), 35 SQL migrations, and 13-role RBAC matrix.
  - **30-Section Policy**: Formulated executable policy for AI coding agents detailing monorepo DAG boundaries (`apps` → `shared domain packages` → `foundation packages`), canonical barrel imports, RSC vs Client Component boundaries, DAL & Server Action rules, Supabase client selection, Auth/RBAC 3-tier scoping, domain feature placement map, external service abstractions, error handling, build/deployment, architectural invariants, forbidden anti-patterns, and pre/post-implementation verification checklists.
  - **Documentation & Memory Synchronization**: Updated `README.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`, `AI/STATE.md`, `AI/CHANGELOG_AI.md`, and `AI/CURRENT_TASK.md`.
  - **Verification**: Verified zero TypeScript errors across all monorepo packages (`pnpm typecheck`).

- **Page Feedback: /login — Floating "Home" Link & Theme Toggle Removal (`apps/web/app/login/page.tsx`, `signup/page.tsx`, `forgot-password/page.tsx`) (2026-08-21)**:
  - **Removed Floating "Home" Link**: Removed top floating controls container (`<Link href="/"> Home </Link>`) on authentication pages (`/login`, `/signup`, `/forgot-password`) to streamline user focus strictly onto login and authentication workflows.
  - **Removed Auth Page Theme Toggle**: Removed manual `<ThemeToggle />` floating button on auth pages. System automatically detects user preference theme (`next-themes`), allowing signed-in users to toggle themes from the top header user menu after authentication.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Root Landing Page Authentication Routing (`apps/web/app/page.tsx`, `apps/web/app/signin/page.tsx`, `README.md`) (2026-08-21)**:
  - **Landing Page Auth Control (`apps/web/app/page.tsx`)**: Replaced raw landing page render with instant authentication routing controller. Evaluates user session via `getCurrentUserOrNull()`: unauthenticated users are directed immediately to the sign-in page (`redirect("/login")`) and active authenticated users are directed directly to their workspace (`redirect("/dashboard")`).
  - **Sign-in Route Alias (`apps/web/app/signin/page.tsx`)**: Created dedicated `/signin` route alias that performs clean server-side redirection to `/login`.
  - **Documentation & Memory Update**: Updated `README.md` and AI memory system files (`AI/STATE.md`, `AI/CHANGELOG_AI.md`, `AI/CURRENT_TASK.md`).
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **AI Agent Rule: Strict DESIGN.md Adherence & 3-Tier Cross-Platform Responsiveness Protocol (`.agents/rules/responsive_cross_platform_design.md`, `AI/UI_RULES.md`, `AGENTS.md`, `AI/PROJECT_MEMORY.md`) (2026-08-21)**:
  - **Authoritative Rule File (`.agents/rules/responsive_cross_platform_design.md`)**: Created comprehensive AI agent rule establishing `DESIGN.md` (Vercel Geist System: `#171717` ink, `#fafafa` canvas, `#ffffff` elevated card, `#ebebeb` 1px hairline border, `#0070f3` link blue, Geist Sans/Mono fonts) as the sole design system authority.
  - **3-Tier Viewport Optimization Protocol**: Mandated responsive layout reflows across Mobile (≤640px touch card views `block sm:hidden`, scrollable toolbars `overflow-x-auto flex-nowrap`, min 44px touch target), Tablet (641px–1023px 2-col grids `grid-cols-1 sm:grid-cols-2`, adaptive modals `sm:max-w-xl`), and Desktop (≥1024px high-density tables `hidden sm:block`, full multi-col grid, hover tooltips `<TooltipWrapper>`).
  - **Core Agent Protocol Integration (`AGENTS.md`, `AI/UI_RULES.md`, `AI/PROJECT_MEMORY.md`, `AI/FILE_INDEX.md`)**: Updated Step 5 (IMPLEMENT) and Step 6 (VERIFY) in `AGENTS.md`, `AI/UI_RULES.md`, and `PROJECT_MEMORY.md` so every future AI agent interaction automatically enforces strict `DESIGN.md` adherence and responsive cross-platform optimization.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /dashboard?tab=entry — Operator Dashboard Mobile Card View & Component Layout Optimization (`apps/web/components/dashboard/OperatorDashboard.tsx`) (2026-08-20)**:
  - **Mobile Native Card View for Log History (`block sm:hidden`)**: Implemented a touch-friendly Card View for submitted daily machine logs rendered on mobile viewports (< 640px). Card displays log date, machine code pill (`MCH-001`), status pill (`🔴 Breakdown` / `🟢 Normal`), machine name & model, operating hours (`08:00 AM — 05:00 PM`), overtime hours tag, breakdown details/remarks, and Edit/Locked action controls.
  - **Desktop Data Table View (`hidden sm:block`)**: Retained the high-density desktop data table for screens >= 640px.
  - **Touch-Friendly Filter Toolbar**: Enabled horizontal smooth scrolling (`overflow-x-auto custom-scrollbar flex-nowrap`) for Date Period pills (`All`, `Today`, `This Week`, `This Month`, `This Year`) and Status Filter pills (`All`, `Stored & Approved`, `Draft`, `Correction Required`) to prevent layout clipping on small screens.
  - **Responsive Form Banners & Modals**: Updated form reference banners (`Log Submitted Today`, `Last Submitted Entry`) to responsive `flex-col sm:flex-row` layouts. Added `max-h-[calc(100vh-2rem)] overflow-y-auto` to the Edit Log Modal dialog box container to ensure smooth scrolling on short mobile viewports.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /dashboard?tab=entry — Operator Dashboard Daily Log Form Visual Cleanup & Icon Simplification (`apps/web/components/dashboard/OperatorDashboard.tsx`) (2026-08-20)**:
  - **Form Header Context Bar Cleanup**: Removed header description paragraph (`"Record machine operation details, shift..."`), header date pill (`"Thursday, August 20, 2026"`), header `"Today"` pill, and completion progress badge container (`"4 of 4 required fields completed"`).
  - **Section Header Subtitle Spans Removal**: Removed right-aligned helper text spans across Section A, Section B, Section C, and Section D headers (`"Primary selection populates code..."`, `"Auto-calculates operating..."`, `"Progressive disclosure expands..."`, `"Optional operational notes..."`).
  - **Status Control & Button Polish**: Updated Normal status button to display strictly `"Normal"` with a single icon (`<CheckCircle2> Normal`). Updated Machine Breakdown button to remove duplicate warning icon (`⚠`), leaving a clean single icon button (`<AnimatedAlertTriangle> Machine Breakdown`). Removed rounded emerald box under Normal status selection (`"✓ Machine operated smoothly today..."`).
  - **Submission Footer Actions**: Removed `<Send>` icon from the primary `"Submit Daily Log →"` button text.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 TypeScript compilation errors**).

- **Page Feedback: /dashboard?tab=entry — Operator Daily Machine Log Entry UI/UX Overhaul & Workflow Automation (`apps/web/components/dashboard/OperatorDashboard.tsx`) (2026-08-20)**:
  - **4-Section Form Structure**: Restructured daily log form into 4 visual sections: Section A (Machine Information), Section B (Operating Hours & Overtime), Section C (Machine Status & Breakdown), and Section D (Remarks / Observations).
  - **Machine Auto-Fill & Locked Code/Model**: Selecting Machine Name automatically populates `Machine Code` and `Model` and locks them to read-only mode to prevent inconsistent data entry.
  - **Operating Hours & Overtime Auto-Calculation**: Real-time duration calculation between `Start Time` and `End Time` (`08:00 AM → 05:00 PM · 9.0 hours operating time`) with auto-suggested overtime beyond standard 8-hour shift and inline sequence validation (`❌ End time must be after start time`).
  - **Progressive Disclosure Breakdown Card**: Segmented status control (`Normal` vs `Breakdown`). Normal displays clean green check badge (`✓ Machine operated normally today`). Breakdown dynamically expands breakdown details card: duration (hours & minutes), reason presets (`Hydraulic`, `Engine`, `Electrical`, `Mechanical`, `Brake`, `Scheduled Service`), and action taken.
  - **Remarks Tag Shortcuts & Completion Badge**: Quick remark tags (`+ Fuel Refill`, `+ Minor Defect`, `+ Maintenance Attended`, `+ Shift Delay`, `+ Site Remarks`), completion progress indicator (`4 of 4 required fields completed`), local auto-save draft indicator (`Draft saved at 5:42 PM`), today submission warning alert, and confirmation summary dialog modal.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9 monorepo workspace packages**).

- **Page Feedback: /dashboard?tab=entry — CustomTimePicker "Set Now" Indian Standard Time (IST / GMT+5:30) Accuracy (`apps/web/components/ui/CustomTimePicker.tsx`) (2026-08-20)**:
  - **Indian Standard Time (IST / Asia/Kolkata) Fetching**: Updated `handleSetNow` in `CustomTimePicker.tsx` to explicitly extract hours, minutes, and seconds in Indian Standard Time (`Asia/Kolkata` - UTC+5:30) using `Intl.DateTimeFormat` with `timeZone: "Asia/Kolkata"`.
  - **Accurate Hour, Minute & Second Rollover**: Fixed rollover calculation where 50+ second/minute values previously caused hour mismatches (e.g. 5:58 PM returning 5:00 PM instead of 6:00 PM). Converts total IST day time into total seconds, rounds to 5-minute intervals matching clock dial positions, and correctly computes 24-hour to 12-hour AM/PM periods.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /dashboard?tab=history — OperatorDashboard Table Cleanup, Date Filters & Edit/Lock Rule (`apps/web/components/dashboard/OperatorDashboard.tsx`) (2026-08-20)**:
  - **Removed Status Column**: Removed the redundant Status column header (`<th />`) and status cell (`<td />`) from the Log History table.
  - **Today Edit & Next Day Lock Rule**: Enabled editing for logs created/saved today (`canEdit = isToday || status === 'draft' || ...`). Next day logs (older than today) are locked (`<Lock /> Locked`) to prevent retro-edits.
  - **Date, Week, Month, Year Filter Module**: Integrated date period filter pills (`All`, `Today`, `This Week`, `This Month`, `This Year`) into the history toolbar alongside the existing status filters.
  - **Header & UI Polish**: Removed hand emoji (`👋`) from the Welcome header, removed section subtitle paragraph (`"View submitted daily machine logs..."`), enlarged section `h2` title to `text-lg sm:text-xl font-extrabold`, and removed duplicate plus icon in `"+ New Log Entry"` button text.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /dashboard?tab=entry — OperatorDashboard Full Screen Width Container Optimization (`apps/web/components/dashboard/OperatorDashboard.tsx`) (2026-08-20)**:
  - **Full Screen Width Container**: Replaced fixed maximum width container class (`max-w-5xl mx-auto`) on the root `<div />` of `OperatorDashboard.tsx` with full width layout styling (`w-full space-y-6 p-4 sm:p-6`). Ensures the daily machine log entry portal, hero banner, form inputs, toolbar controls, and log history table expand dynamically to fit the screen width across high-resolution desktop viewports.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9 monorepo workspace packages**).

- **Page Feedback: /dashboard?tab=entry — Direct Database Storage & Auto-Approval for Operator Daily Machine Logs (`supabase/migrations/035_operator_log_direct_store_auto_approval.sql`, `apps/web/app/actions/operators.ts`, `apps/web/components/dashboard/OperatorDashboard.tsx`, `apps/web/components/operations/OperationsClient.tsx`) (2026-08-20)**:
  - **Database Migration (`035_operator_log_direct_store_auto_approval.sql`)**: Updated `verification_status` column default value in `public.machine_hour_logs` to `'approved'`. Migrated existing `'pending'` or `'submitted'` records to `'approved'`.
  - **Backend Server Actions (`operators.ts`)**: Updated `submitOperatorHourLogAction` and `updateOperatorHourLogAction` to automatically set `verification_status: "approved"`, `verified_at: new Date().toISOString()`, and `verified_by: user.id` upon submission. Removed approved status edit restrictions so operators can correct log entries when needed.
  - **Frontend UI Polish (`OperatorDashboard.tsx`, `OperationsClient.tsx`)**: Updated post-submission toast and inline success messages to notify operators that daily machine logs are stored directly in the database. Updated Log History section subtitles, filter pills (`Stored & Approved`), and table status badges to render `Approved` / `Stored` status without needing approval steps.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9 monorepo workspace packages**).

- **Page Feedback: /dashboard?tab=entry — CustomTimePicker Dynamic Viewport & Responsive Size Optimization (`apps/web/components/ui/CustomTimePicker.tsx`) (2026-08-20)**:
  - **Dynamic Viewport Portal Positioning ("dynamic view point")**: Replaced static `absolute top-full left-0 mt-2` popover with React `createPortal(..., document.body)` rendering in `fixed z-[9999]`. Features real-time collision detection (`updatePosition`) that measures trigger input container bounds via `getBoundingClientRect()`, automatically opening popover ABOVE trigger when vertical space below is constrained (`spaceBelow < popoverHeight`). Clamps horizontal placement within `12px` viewport margins and listens to window `resize` and scrolling (`scroll` with capture phase).
  - **Screen-Responsive Size Optimization ("optimise size as per screen")**: Compacted popover container width to `w-[290px] sm:w-[320px]` with `p-3.5 sm:p-4` padding, scaled digital time header cards (`h-14 sm:h-16`) and typography (`text-3xl sm:text-4xl`), and scaled SVG clock dial container (`w-52 h-52 sm:w-58 sm:h-58`), preserving touch/click drag precision math (`atan2`). Added `max-h-[calc(100vh-24px)] overflow-y-auto` fallback and quick "Set Now" current local time trigger in footer.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9 monorepo workspace packages**).

- **Page Feedback: /dashboard?tab=entry — CustomTimePicker Global Color, Style & Theme Alignment (`apps/web/components/ui/CustomTimePicker.tsx`, `apps/web/components/dashboard/OperatorDashboard.tsx`) (2026-08-20)**:
  - **Aligned Accent Color**: Replaced hardcoded Indigo styles (`indigo-500`, `indigo-600`, `#6366f1`) across `CustomTimePicker.tsx` with ReachInternational Sky brand accent tokens (`sky-500`, `sky-600`, `sky-400`).
  - **Global Theme & Surface Tokens**: Updated digital hour/minute cards, radial SVG clock dial face, dial numbers, popover container, and header label to consume design system tokens (`--color-ink`, `--color-canvas-elevated`, `--color-hairline-soft-surface`, `--color-hairline`, `--color-mute`).
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /dashboard?tab=entry — CustomTimePicker Keyboard Button Cleanup (`apps/web/components/ui/CustomTimePicker.tsx`) (2026-08-20)**:
  - **Removed Footer Keyboard Button**: Removed the `.p-2` keyboard icon toggle button from the popover footer per user feedback, streamlining the footer to only render the `CANCEL` and `OK` action buttons aligned to the right.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9 monorepo workspace packages**).

- **Page Feedback: /dashboard?tab=history — Log Entry & Log History Isolated Views (`apps/web/components/dashboard/OperatorDashboard.tsx`, `apps/web/app/(app)/dashboard/page.tsx`) (2026-08-20)**:
  - **Isolated View Rendering**: Updated `OperatorDashboard` to conditionally render ONLY the Daily Machine Log Entry form when on `entry` tab (`/dashboard` or `/dashboard?tab=entry`) and ONLY the Submitted Daily Logs History table when on `history` tab (`/dashboard?tab=history`).
  - **Seamless URL & Tab Switcher Navigation**: Integrated `useRouter` from `next/navigation` to update URL search parameters (`?tab=entry` vs `?tab=history`) smoothly when clicking tab switcher controls in the header banner.
  - **Log History Toolbar & Search Filters**: Enhanced Log History view with a real-time Search Filter Input (matching machine name, code, date, remarks), Status Filter Pills (`All`, `Pending`, `Approved`, `Correction Required`, `Draft`), record counter badges, and a `+ New Log Entry` top CTA button.
  - **Route Parameter Support**: Updated `DashboardPage` server component to resolve `searchParams` Promise and handle `/dashboard?tab=history` and `/dashboard?tab=entry` for all user roles.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9 monorepo workspace packages**).

- **Page Feedback: /dashboard — CustomTimePicker Interactive Circular Clock UI (`apps/web/components/ui/CustomTimePicker.tsx`) (2026-08-20)**:
  - **Interactive Circular Clock Dial**: Replaced grid-based time popover in `CustomTimePicker.tsx` with a radial circular clock face UI. Features 12 radial positions (30° intervals), animated clock hand needle, center pivot dot, and glowing selection tip badge.
  - **Hour & Minute Mode Switching**: Supports **Hour Mode** (1..12 clock face dial) and **Minute Mode** (00, 05, 10, 15...55 clock face dial) with auto-advancing from Hour to Minute mode upon hour selection for a smooth 2-tap workflow.
  - **Digital Header & Preset Controls**: Added clickable digital time header badges (`HH` vs `MM`), `AM/PM` segmented switcher, "Set Now" current time button, quick shift presets strip, and Done button.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /dashboard — Log Entry & Log History Sidebar Navigation (`apps/web/components/layout/AppSidebar.tsx`, `SidebarNavigation.tsx`, `NavigationItem.tsx`, `OperatorDashboard.tsx`, `MobileBottomNav.tsx`, `CommandPalette.tsx`) (2026-08-20)**:
  - **Renamed "Dashboard" to "Log Entry"**: Updated `mainNavItems` in `AppSidebar.tsx` to rename `"Dashboard"` navigation label to `"Log Entry"`.
  - **Added "Log History" Navigation Item**: Created dedicated `"Log History"` sidebar navigation item (`href: "/dashboard?tab=history"`) with `<AnimatedClock>` icon.
  - **URL Parameter Active State Isolation**: Enhanced `NavigationItem.tsx` and `SidebarNavigation.tsx` `isActive` evaluation so `"Log Entry"` and `"Log History"` highlight independently when selected.
  - **Operator Dashboard Sub-Tab Switcher**: Integrated `useSearchParams` and tab switcher buttons (`Log Entry` vs `Log History`) into `OperatorDashboard.tsx` header banner. Deep linking via `/dashboard?tab=history` automatically activates the Log History table view.
  - **Mobile & Search Synchronization**: Updated mobile bottom navbar label to `"Log Entry"` and added `"Go to Log Entry"` and `"Go to Log History"` to `CommandPalette.tsx`.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /dashboard — OperatorDashboard Header Icons Cleanup & Custom Interactive Time Picker (`apps/web/components/dashboard/OperatorDashboard.tsx`, `apps/web/components/ui/CustomTimePicker.tsx`, `apps/web/components/ui/index.ts`) (2026-08-20)**:
  - **Removed "Daily Log" Badge**: Removed `.px-2.5` badge (`"Daily Log"`) from the Daily Machine Log Entry form header per feedback.
  - **Removed Header Icon Boxes**: Removed `.p-2` sky icon container (`<Wrench>`) from the form section header and `.p-2.5` sky icon container (`<AnimatedClock>`) from the top welcome header banner.
  - **Custom Time Picker Popover**: Built reusable `CustomTimePicker` component (`CustomTimePicker.tsx`). Clicking the time icon or input field opens an interactive popover with 11 quick operational shift presets (`06:00 AM`, `08:00 AM`, `09:00 AM`, `12:00 PM`, `05:00 PM`, `06:00 PM`, etc.), hour selection grid (`01`–`12`), minute selection grid (`:00`–`:55`), AM/PM toggle, "Set Now" button, and auto-dismissal. Integrated into Start Time and End Time fields in both the main form and the edit log correction modal.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: /dashboard — OperatorDashboard Header Date Pill Polish & Calendar Icon Removal (`apps/web/components/dashboard/OperatorDashboard.tsx`) (2026-08-20)**:
  - **Removed Calendar Icon**: Removed `<Calendar>` icon from top header date pill per user feedback.
  - **Large & Bold Date Pill**: Scaled header date container text to `text-sm sm:text-base font-extrabold tracking-tight` for prominent header date display.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: Operator Dashboard Searchable Machine Dropdown, Breakdown Duration & UI/UX Polish (`apps/web/components/dashboard/OperatorDashboard.tsx`) (2026-08-20)**:
  - **Clean Header Banner**: Removed unused inline flex badge (`Operator Daily Portal`) and secondary subtitle paragraph per feedback. Polished hero banner container with high legibility typography and right-aligned Geist Mono date pill.
  - **Form Header Paragraph Cleanup**: Removed paragraph `"Fill machine operation details daily"` from the form section header.
  - **Custom Searchable Machine Dropdown**: Built interactive popover machine selector with real-time search box matching `machine_name`, `machine_code`, `model`, `serial_number`, and `engine_serial_no`. Renders machine name, code badge, and model/serial subtitle with checkmark indicator and outside-click dismissal.
  - **Breakdown Hours & Minutes Input**: Added breakdown duration input section (Hours and Minutes) when `"Yes — Machine Breakdown"` toggle is selected. Automatically formats and records breakdown duration into daily log entries (e.g., `[Breakdown Duration: 2h 30m]`). Added breakdown duration inputs to log correction/edit modal.
  - **Polished Table UI/UX**: Redesigned Daily Machine Logs History table with Geist Mono headers, uppercase tracking, tabular-nums timing cells, breakdown duration badges (`🔴 Breakdown (2h 30m)`), design-system status pills, clean empty state, and compact action controls.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9 monorepo workspace packages**).

- **Operator Role Profile & Dashboard Streamlining: Dedicated Daily Machine Logs (`supabase/migrations/034_operator_daily_log_fields.sql`, `apps/web/components/dashboard/OperatorDashboard.tsx`, `apps/web/app/actions/operators.ts`, `AppSidebar.tsx`, `my-work/page.tsx`, `navItems.ts`) (2026-08-20)**:
  - **Database Migration (`034_operator_daily_log_fields.sql`)**: Extended `public.machine_hour_logs` table with `start_time`, `end_time`, `overtime_hours`, and `is_breakdown` columns for operator daily log entries.
  - **Operator Actions (`operators.ts`)**: Updated `submitOperatorHourLogAction` and `updateOperatorHourLogAction` to handle `startTime`, `endTime`, `overtimeHours`, `isBreakdown`, `machineId`, and `remarks`. Sets machine status to `under_maintenance` when `isBreakdown` is true.
  - **Dedicated Operator Dashboard (`OperatorDashboard.tsx`)**: Redesigned `OperatorDashboard` into a clean **Daily Machine Logs** entry portal. Provides fields for Machine Name, Machine No / Code, Model, Start Time (e.g. `08:00 AM`), End Time (e.g. `05:00 PM`), Overtime (Hours), Breakdown (Yes/No toggle), and Remark if any. Includes a history table of submitted daily machine logs and edit/resubmit capability for draft/rejected entries. Removed all unrelated navigation tabs and widgets.
  - **Navigation & RBAC Scoping (`AppSidebar.tsx`, `my-work/page.tsx`, `navItems.ts`)**: Restricted `operator` role so only `/dashboard` is visible in the sidebar menu. Redirected operators accessing `/my-work` directly to `/dashboard`.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9 monorepo workspace packages**).

- **Page Feedback: Auto-Summarize Task Title on Save Task & Upgraded Summarizer Engine (`packages/utils/src/string.ts`, `apps/web/components/tasks/CreateTaskModal.tsx`, `apps/mobile/components/tasks/CreateTaskModal.tsx`) (2026-08-20)**:
  - **Upgraded Summarizer Engine (`@reachinternational/utils`)**: Implemented and exported `summarizeTaskTitle(description: string): string` in `packages/utils/src/string.ts`. Cleans leading list numbers (`1.`, `a)`), markdown symbols (`*`, `-`, `#`), greetings (`Hi John,`), and filler prefixes (`Please kindly ensure to`, `Task instructions:`, `Urgent:`), isolates the primary clause, strips trailing deadline phrases (`by 4 PM tomorrow`), formats clean capitalization, and truncates up to ~55 characters without dangling prepositions while preserving machine codes (`EXCA-001`).
  - **Auto-Summarize Title on Save Task (`apps/web/components/tasks/CreateTaskModal.tsx`)**: Updated `handleSubmit` handler so when the user clicks **Save Task** / **Save Changes**, if the Title input is blank, it automatically runs `summarizeTaskTitle(description)` to populate the short title and save the task seamlessly. Updated **⚡ Auto-fill Title** button to use `summarizeTaskTitle`.
  - **Mobile Task Creation Parity (`apps/mobile/components/tasks/CreateTaskModal.tsx`)**: Updated `handleSave` in mobile `CreateTaskModal` to automatically populate `finalTitle` via `summarizeTaskTitle(description)` if title is blank when tapping **SAVE**.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9 monorepo workspace packages**).

- **Page Feedback: Display Uploaded Proof Images in Task Verification Modal & Table Row Actions (`apps/web/components/tasks/VerifyTaskModal.tsx`, `TasksClient.tsx`, `CompleteTaskModal.tsx`) (2026-08-20)**:
  - **Uploaded Proof Images Display & Interactive Lightbox (`VerifyTaskModal.tsx`)**: Added a dedicated **"Uploaded Proof Image(s) / Completion Attachments"** section directly inside `VerifyTaskModal`. Renders image thumbnail cards for all uploaded completion proof images (`task.attachments`) with zoom overlays, file names, and proof photo badges. Built a full-screen **Image Lightbox Preview Dialog** allowing managers to click any thumbnail to inspect full-resolution proof images before approving or reopening tasks.
  - **Verify Action Button & Camera Indicator (`TasksClient.tsx`)**: Updated the "Verify" button in `<TasksClient>` table row actions with a camera icon (`<Camera className="w-3 h-3" /> Verify`) and tooltip ("Verify Task & Review Uploaded Proof Image"). Added camera proof indicator icons next to completed status badges when proof photos exist.
  - **Enhanced Proof Upload & Presets (`CompleteTaskModal.tsx`)**: Added local image file picker (`<input type="file" accept="image/*" />`) converting uploaded images to Data URLs with instant thumbnail previews. Provided quick preset demo photo buttons ("📸 Machine Service Inspection Photo", "🔧 Field Repair Completion Photo").
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: Tasks Page Enterprise Table Column Layout, Pill Badges & Checkbox Actions (`apps/web/components/tasks/TasksClient.tsx`, `apps/web/components/ui/EnterpriseTable.tsx`) (2026-08-20)**:
  - **Rounded Priority Pill Badges (`TasksClient.tsx`)**: Updated priority badges (`medium`, `high`, `low`, `critical`) in table cells and Kanban cards to fully rounded pills (`rounded-full px-2.5 py-0.5`).
  - **Separate Task Number Column (`TasksClient.tsx`)**: Separated `Task No.` into its own dedicated column (`#TSK-00001`) with styled mono pill tag (`bg-[var(--color-link)]/10 text-[var(--color-link)]`).
  - **Stacked Title & Instructions Column (`TasksClient.tsx`)**: Formatted `Title & Instructions` column with bold task title on line 1 and truncated instruction/description on line 2 below it.
  - **Rounded Square Checkbox Action Button (`TasksClient.tsx`)**: Replaced the text `"Complete"` button with a rounded square checkbox icon button (`<Square className="w-4 h-4" />` with tooltip `"Mark Task Complete"`). Added `<CheckSquare>` indicator for completed tasks.
  - **Role Display Below Employee Name (`TasksClient.tsx`)**: Transformed assigned employee cells and Kanban cards to render full employee name on top and formatted role title (`Branch Manager`) directly below it on a dedicated line.
  - **Column Alignment & Flex Grid (`EnterpriseTable.tsx`, `TasksClient.tsx`)**: Configured explicit widths (`110px`, `300px`, `110px`, `220px`, `140px`, `120px`, `130px`) and `align-middle` cell alignment across all table rows.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: Task Detail Drawer Responsive Polish & Flex Overflow Fix (`apps/web/components/tasks/TaskDetailDrawer.tsx`) (2026-08-20)**:
  - **Single Scroll Container & Flex Overflow Fix (`TaskDetailDrawer.tsx`)**: Removed nested `max-h-48 overflow-y-auto` scroll container from the comment discussion thread. Configured `<div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 min-h-0">` as the single, smooth scroll container for the drawer body.
  - **Desktop & Mobile Responsive Layout (`TaskDetailDrawer.tsx`)**: Optimized drawer container sizing (`w-full sm:max-w-xl md:max-w-2xl h-full flex flex-col`), quick details metadata grid (`grid-cols-2 sm:grid-cols-4 gap-2.5`), and assigned employee cards (`grid-cols-1 sm:grid-cols-2 gap-2.5`) with formatted role titles `(Branch Manager)`.
  - **Framer Motion Slide-In & Dismissal Controls (`TaskDetailDrawer.tsx`)**: Integrated `AnimatePresence` and `motion.div` slide-in spring transition from the right. Added backdrop click dismissal, global `Escape` key listener, click-to-copy task number button (`#TSK-00001`), and close button tooltip wrapper.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9 monorepo workspace packages**).

- **Page Feedback: Tasks Page UX Polish, Assigned Employee Role Display & Rounded View Mode Pills (`apps/web/components/tasks/TasksClient.tsx`) (2026-08-20)**:
  - **Assigned Employee Full Name & Role (`TasksClient.tsx`)**: Transformed initial circles in table cells into full employee name (`John Doe`) and formatted role in parentheses `(Branch Manager)` with avatar badges. Applied identical assignee representation to Kanban cards.
  - **Rounded View Mode Toggle Switcher (`TasksClient.tsx`)**: Styled List and Kanban view mode container and toggle buttons with `rounded-full` pill design matching global design tokens.
  - **Page Header Cleanup (`TasksClient.tsx`)**: Removed description paragraph under page header per user feedback.
  - **Card Base & UX Polish (`TasksClient.tsx`)**: Removed double-border/cramped `<Card className="p-0 ...">` container wrapper around `<EnterpriseTable>`. Connected `onRowClick` on `<EnterpriseTable>` to open `TaskDetailDrawer` on row click. Added `<TooltipWrapper>` popovers to table action buttons (`View Task Details`, `Edit Task`, `Delete Task`). Standardized date formatting with `formatDisplayDate`.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9 monorepo workspace packages**).

- **Page Feedback: Tasks Page Searchable Role-Based Employee Selector, Mandatory Description & Title Auto-Summarizer (`apps/web/components/tasks/CreateTaskModal.tsx`, `apps/mobile/components/tasks/CreateTaskModal.tsx`) (2026-08-20)**:
  - **Searchable Role-Based Employee Selector (`apps/web`)**: Transformed static assignee scroll box into a searchable popover dropdown selector. Features real-time employee search by name, email, or role, formatted role badges (`Admin`, `Service Manager`, `Engineer`, `Operator`, `Client`), role filter category pills (`All Roles`, `Admins`, `Managers`, `Engineers`, `Operators`, `Clients`), bulk action triggers (`Select All Filtered`, `Clear`), and selected employee chip tags with quick removal.
  - **Mandatory Description & Form Validation (`apps/web`, `apps/mobile`)**: Updated Task Description label to `Description / Instructions *` and added mandatory form validation ensuring non-empty instructions before task creation on both Web and Mobile.
  - **Title Auto-Summarizer (`apps/web`)**: Added **"⚡ Auto-fill Title"** trigger button alongside the description header. Automatically extracts core task intent, strips filler prefix text ("please", "task to", "ensure that"), formats clean title case up to ~55 characters, and populates the Task Title input.
  - **Verification**: Executed typecheck across Web and Mobile workspace packages (**Passed cleanly with 0 compilation errors**).

- **Next.js Production Build Resolution (`apps/web/.next`) (2026-08-20)**:
  - **Production Build Artifact Generation**: Executed `pnpm --filter @reachinternational/web build` (`next build`), compiling Next.js pages, server components, and generating static assets into `.next`.
  - **Verification**: Verified `pnpm start` (`next start`) functions cleanly and typecheck passes with 0 errors (`pnpm --filter @reachinternational/web typecheck`).

- **Page Feedback: Proper Tooltip Wrappers for Unlabeled Project Icons (`apps/web/components/animate-ui/components/radix/dialog.tsx`, `ComplaintsClient.tsx`, `ComplaintDetailModal.tsx`, `FieldServiceReportModal.tsx`, `ServicesClient.tsx`, `EnterpriseTable.tsx`) (2026-08-19)**:
  - **Modal Close Button Tooltip (`dialog.tsx`)**: Wrapped Radix `DialogPrimitive.Close` button with `<TooltipWrapper content="Close modal (Esc)" side="left">`, giving every modal dialog in the app a clean tooltip on close button hover.
  - **Complaints Table Action Tooltips (`ComplaintsClient.tsx`)**: Wrapped all icon-only table cell action buttons (`View FSR Report`, `Resolve (Fill FSR)` / `View Details`, `Edit Complaint`, `Delete Complaint`) in `<TooltipWrapper>` popovers.
  - **Complaint & FSR Modal Action Tooltips (`ComplaintDetailModal.tsx`, `FieldServiceReportModal.tsx`)**: Wrapped icon buttons (`Delete Complaint`, `Edit Complaint`, `Edit Report`, `Remove part row`) in `<TooltipWrapper>` popovers.
  - **Service Logs Action Tooltips (`ServicesClient.tsx`)**: Wrapped icon-only table cell action buttons (`Update Service Log`, `Delete Service Log`) in `<TooltipWrapper>` popovers.
  - **Enterprise Table Toolbar Tooltips (`EnterpriseTable.tsx`)**: Added tooltips to density control toggle buttons (`Compact`, `Default`, `Comfortable`) and column menu toggle button.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: Compact Modal Header Action Buttons & Icon-Only Edit/Delete (`apps/web/components/complaints/ComplaintDetailModal.tsx`, `MachineComplaintModal.tsx`, `FieldServiceReportModal.tsx`) (2026-08-19)**:
  - **Icon-Only Edit & Delete Buttons (`ComplaintDetailModal.tsx`, `FieldServiceReportModal.tsx`)**: Replaced text labels on `Edit` and `Delete` header buttons with clean icon-only buttons (`h-7 w-7 p-0 flex items-center justify-center`) with descriptive `title` tooltips (`"Edit Complaint"`, `"Delete Complaint"`, `"Edit Report"`).
  - **Slightly Smaller Button Standard (`ComplaintDetailModal.tsx`, `MachineComplaintModal.tsx`, `FieldServiceReportModal.tsx`)**: Compacted all modal header action buttons to `h-7` (~28px compact height) with `px-2.5 text-xs` padding for a high-density, refined header design.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: Field Service Report (FSR) Modal Header Actions (`apps/web/components/complaints/FieldServiceReportModal.tsx`) (2026-08-19)**:
  - **Shifted Actions to Header (`FieldServiceReportModal.tsx`)**: Moved `Print / Save PDF`, `Edit Report`, `Send Back for Revision`, `Approve FSR`, and `Complete FSR / Submit` action buttons into the top header bar next to the modal title via `headerActions` prop. Removed bottom footer action buttons container for 100% modal consistency across the complaints module.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: Complaint Detail Modal Header Actions (`apps/web/components/complaints/ComplaintDetailModal.tsx`) (2026-08-19)**:
  - **Shifted Actions to Header (`ComplaintDetailModal.tsx`)**: Moved `Delete`, `Edit`, and `View FSR Report` / `Resolve (Fill FSR)` action buttons into the top header bar next to the modal title via `headerActions` prop. Removed the bottom footer action buttons container for visual consistency with `MachineComplaintModal`.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: Modal Double Scrollbar Resolution & Single Scroll Container Standard (`apps/web/components/complaints/MachineComplaintModal.tsx`, `ComplaintDetailModal.tsx`, `apps/web/components/machines/MachineModal.tsx`, `MachineCategoryModal.tsx`) (2026-08-19)**:
  - **Eliminated Nested Scrollbars (`MachineComplaintModal.tsx`, `ComplaintDetailModal.tsx`, `MachineModal.tsx`, `MachineCategoryModal.tsx`)**: Removed redundant inner `max-h-[...vh] overflow-y-auto pr-1` styles from modal form/div body containers, leaving `Modal.tsx`'s `<div className="flex-1 overflow-y-auto p-6">` as the single, smooth scroll container for all modal dialogs.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Page Feedback: Machine Complaint Modal Header Actions & UI Cleanup (`apps/web/components/complaints/MachineComplaintModal.tsx`, `apps/web/components/ui/Modal.tsx`) (2026-08-19)**:
  - **Modal Header Actions (`Modal.tsx`, `MachineComplaintModal.tsx`)**: Extended `ModalProps` with `headerActions?: ReactNode` rendered in `DialogHeader` alongside modal title with `pr-12` padding. Moved `Cancel` and `Raise Machine Complaint` / `Update Complaint` action buttons into top header bar.
  - **Removed Footer & Section Banner (`MachineComplaintModal.tsx`)**: Completely removed bottom sticky action buttons container from form body and removed the top amber notice box (`Malfunction Complaint Entry`).
  - **Removed Section Header Icon (`MachineComplaintModal.tsx`)**: Removed the `<Wrench>` icon next to the "Machine & Breakdown Details" subheader for a cleaner form layout.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors in modified files**).

- **Enterprise To-Do & Task Management Module (Web & Mobile) (`supabase/migrations/033_todo_task_management.sql`, `apps/web/`, `apps/mobile/`, `packages/`) (2026-08-19)**:
  - **Database & RLS (`033_todo_task_management.sql`)**: Created `tasks`, `task_assignees`, `task_attachments`, `task_comments`, and `task_activity_logs` tables with auto-incrementing task numbers (`TSK-00001`), RLS security policies, performance indexes, and triggers. Updated `seed_dummy_data.mjs` with task seed data.
  - **Shared Workspace Packages (`packages/`)**: Extended `@reachinternational/types` with `Task`, `TaskAssignee`, `TaskAttachment`, `TaskComment`, `TaskActivityLog`, `TaskStats`, `TaskFilterParams`. Created `@reachinternational/validation` Zod schemas (`createTaskSchema`, `updateTaskSchema`, `completeTaskSchema`, `verifyTaskSchema`, `taskCommentSchema`). Extended `@reachinternational/design-tokens` badge contracts with task statuses (`pending`, `overdue`, `reopened`).
  - **Next.js Web App (`apps/web`)**: Implemented DAL queries (`tasks.ts`), Server Actions (`tasks.ts`), `/tasks` page route, KPI dashboard stats, List & Kanban views, `CreateTaskModal`, `TaskDetailDrawer`, `CompleteTaskModal`, and `VerifyTaskModal`. Updated `AppSidebar.tsx` navigation.
  - **Expo Mobile App (`apps/mobile`)**: Built pixel-perfect mobile task screen (`tasks.tsx`) and creation modal (`CreateTaskModal.tsx`) matching user wireframe screenshots. Features left-border priority accents (Red/Orange/Green), sub-tabs (`All Tasks`, `My Tasks`, `Assigned to Me`, `Completed`), assignee cards with avatars & roles, due date badges, sort options, and Floating Action Button (+).
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9 monorepo workspace packages**).

- **Page Feedback: Machine Breakdown Complaints Table UI/UX Overhaul & Click-Row Detail Modal (`apps/web/components/complaints/ComplaintsClient.tsx`, `apps/web/components/complaints/ComplaintDetailModal.tsx`, `apps/web/app/actions/complaints.ts`) (2026-08-19)**:
  - **Icon-Only Action Buttons (`ComplaintsClient.tsx`)**: Replaced text buttons `"View FSR Report"` and `"Edit"` with compact icon-only buttons (`AnimatedFileText`, `AnimatedEdit`, `AnimatedTrash`) with tooltips (`"View FSR Report"`, `"Edit Complaint"`, `"Delete Complaint"`).
  - **Fully Functional Delete Server Action (`complaints.ts`, `ComplaintsClient.tsx`)**: Created `deleteComplaint(id)` server action with RBAC checks (`super_admin`, `admin`, `service_manager`, `branch_manager`, `supervisor`), Supabase record deletion, automatic machine status restoration (if no other active complaints), audit logging (`complaint.deleted`), cache revalidations (`complaints`, `machines`, `dashboard`), and delete confirmation modal.
  - **Click-Row Complaint Detail View (`ComplaintDetailModal.tsx`, `ComplaintsClient.tsx`)**: Created `ComplaintDetailModal` displaying machine specs, malfunction details, required spare parts & quantities, hour meter reading, personnel assignment, work done logs, and FSR status. Connected `onRowClick` on `EnterpriseTable`.
  - **Interactive Multi-Option Filter Toolbar (`ComplaintsClient.tsx`)**: Added search bar + 4 filter dropdowns (`Status`, `Machine/Model`, `Assigned Engineer`, `Spare Parts Required`) with active filter counter and reset button.
  - **Clean Data & Title Case Table Headers (`ComplaintsClient.tsx`)**: Formatted table headers into Title Case (`Complaint No`, `Machine & Model`, `Malfunction Issue`, `Personnel`, `Status`, `Actions`) with bold machine codes, part badges, and formatted business dates (`formatDisplayDate`).
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9 monorepo workspace packages**).

- **Page Feedback: Service Log Update Modal UI/UX Redesign & Save CTA Label (`apps/web/components/services/ServicesClient.tsx`, `apps/web/components/ui/Modal.tsx`) (2026-08-19)**:
  - **Submit Button Label ("Save") (`ServicesClient.tsx`)**: Updated the primary form submit button label from `"Save & Complete Service"` to `"Save"` per user feedback ("show only save").
  - **Modal Overflow & Scroll Container Fix (`ServicesClient.tsx`, `Modal.tsx`)**: Removed `max-h-[75vh] overflow-y-auto` from the `<form>` element inside `ServicesClient.tsx`, eliminating nested scroll containers and double scrollbar bugs. Pinned action buttons (`Cancel` & `Save`) in the `Modal` footer prop (`footer`), ensuring action buttons remain visible and pinned at the bottom while the form body scrolls smoothly.
  - **Redesigned DialogHeader (`ServicesClient.tsx`, `Modal.tsx`)**: Extended `ModalProps` to accept `ReactNode` for `title` and `description`. Redesigned header with an icon avatar, bold title (`Update Service Log`), machine code badge (`EXCA-001`), model name, and category subtitle for clear visual hierarchy.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9 monorepo workspace packages**).

- **Web App Reusable Custom Dropdown System (`apps/web/components/ui/Select.tsx`, `apps/web/components/*`) (2026-08-19)**:
  - **Upgraded Custom Dropdown Component (`Select.tsx`)**: Rebuilt `Select` component with `framer-motion` popover slide & fade animations, dark/light theme support, custom chevron rotation (`AnimatedChevronDown`), checkmark indicators (`AnimatedCheck`), search filter bar for long lists (> 6 items), and full keyboard navigation (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`).
  - **Backward Compatibility & Form Handling**: Supports both `options={[{ value, label }]}` array props and parsing `<option>` JSX children. Maintained 100% native `<form>` compatibility (`FormData`) via hidden `<input type="hidden" name={name} value={value} />` and synthetic `React.ChangeEvent` dispatch.
  - **Web Application Refactoring**: Replaced 100% of native browser `<select>` dropdowns across all web application modules (`ServicesClient.tsx`, `BranchSelector.tsx`, `MachineModal.tsx`, `RentalManagementClient.tsx`, `OperationsClient.tsx`, `StockLedgerClient.tsx`, `PurchaseRequestModal.tsx`, `PartIssueModal.tsx`, `GoodsReceiptModal.tsx`, `HRClient.tsx`, `FinanceClient.tsx`, `DocumentsClient.tsx`, `OperatorDashboard.tsx`, `AuditLogsClient.tsx`).
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9 monorepo workspace packages**). Verified zero remaining native `<select>` tags in web application components.

- **Page Feedback: Machine Service Table Row Icon Removal & Dual Action Icons (Update / Delete) (`apps/web/components/services/ServicesClient.tsx`, `apps/web/app/actions/services.ts`) (2026-08-19)**:
  - **Removed Row Icon from Machine Number Column (`ServicesClient.tsx`)**: Removed the Wrench icon span wrapper from the Machine Number column cell across all table rows per user feedback.
  - **Dual Action Icons (Update / Delete) (`ServicesClient.tsx`)**: Replaced text button with compact icon-only Update (`Edit`) and Delete (`Trash2`) buttons.
  - **Fully Functional Delete Server Action (`services.ts`, `ServicesClient.tsx`)**: Created `deleteServiceRecord(machineId)` server action with Supabase deletion, machine service count update, audit logging (`service.deleted`), and cache revalidations (`services`, `machines`, `dashboard`). Added confirmation modal for deletion.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9 monorepo workspace packages**).

- **Page Feedback: Machine Service & Maintenance Logs Table UX & Visual Hierarchy Redesign (`apps/web/components/services/ServicesClient.tsx`, `apps/web/components/ui/EnterpriseTable.tsx`, `packages/utils/src/date.ts`) (2026-08-19)**:

  - **Column Structure & Title Case Headers (`ServicesClient.tsx`)**: Reordered columns to place Machine Number as the primary visual anchor (bold mono, Wrench icon, brand link highlight, clickable). Transformed awkwardly wrapped uppercase headers into clean Title Case headers (`Action`, `Machine Number`, `Model`, `Category`, `Service Status`, `Service Due Date`, `Days`, `Completion Date`, `Serial No.`).
  - **Humanized Urgency & Positive Days (`ServicesClient.tsx`)**: Replaced `Overdue (-16 days)` with `16 days overdue` (bold count + red highlight). Replaced raw counts with humanized urgency text (`Due today`, `1 day left`, `13 days left`).
  - **Compact CTA & Row Density (`ServicesClient.tsx`, `EnterpriseTable.tsx`)**: Replaced large `Update Service` buttons with compact `✎ Update` CTA buttons. Adjusted default row padding (`py-2.5 px-3.5`) targeting ~56–64px row height.
  - **Business Date Formatting & Subdued Missing Values (`date.ts`, `ServicesClient.tsx`)**: Standardized ISO dates to business format (`07 Aug 2026`) via `formatDisplayDate`. Rendered missing values (`—`) in subtle muted gray (`opacity-40 font-normal`).
  - **Interactive Multi-Filter Toolbar & Default Urgency Sorting (`ServicesClient.tsx`, `EnterpriseTable.tsx`)**: Added Status, Category, and Due Date filters. Pre-sorted table by urgency (`defaultSortColumn="due_days"`). Hidden low-priority `Serial No.` by default (`defaultHiddenColumns={["serial_no"]}`).
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all workspace packages**).

- **Page Feedback: Removal of Comment Prefix Slashes (`//`) Across Entire Mobile App (`apps/mobile/components/ui/MobileHeader.tsx`, `profile.tsx`, `dashboard.tsx`, `machines.tsx`, `my-work.tsx`, `notifications.tsx`, `login.tsx`) (2026-08-19)**:
  - **Sanitized Mobile Header (`MobileHeader.tsx`)**: Added regex sanitizer (`eyebrow.replace(/^\/\/\s*/, '')`) to `MobileHeader` component to automatically strip leading `//` comment slashes from any header eyebrow.
  - **Cleaned UI Text Strings Across Mobile Screens (`profile.tsx`, `dashboard.tsx`, `machines.tsx`, `my-work.tsx`, `notifications.tsx`, `login.tsx`)**: Removed comment-like `// ` prefix from `eyebrow` props and JSX `<Text>` elements (`USER ACCOUNT`, `USER IDENTIFICATION`, `SYSTEM PREFERENCES`, `FIELD OPERATIONS`, `KEY METRICS OVERVIEW`, `PRIORITY FIELD TASKS`, `FLEET DIRECTORY`, `FIELD QUEUE`, `ALERT SYSTEM`, `ENTERPRISE FLEET TRACKING`).
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9/9 monorepo workspace packages**). Verified 0 remaining `//` comment slashes in mobile UI text.

- **Page Feedback: Mobile Bottom Navbar 3-Line Menu & Contextual Submenus Navigation (`apps/mobile/components/ui/MainMenuModal.tsx`, `CustomBottomTabBar.tsx`, `_layout.tsx`, `notifications.tsx`) (2026-08-19)**:
  - **All Main Pages Navigation Drawer (`MainMenuModal.tsx`)**: Built full-screen bottom-sheet modal triggered by the 3-line Menu icon button in the bottom navigation bar. Categorized all 13 main pages (Core Operations, Resource & Commercial, Administration & Staff) with active indicators and smooth navigation.
  - **Contextual Bottom Tab Bar (`CustomBottomTabBar.tsx`)**: Placed 3-line Menu icon button on the left of the bottom navbar. Dynamically mapped and rendered active module submenus/subtabs (`/notifications`, `/machines`, `/operations`, `/rentals`, `/my-work`, `/inventory`, `/crm`, `/finance`, `/hr`, `/dashboard`, `/profile`).
  - **Connected App Layout & Route Sync (`_layout.tsx`, `notifications.tsx`)**: Connected `CustomBottomTabBar` to `<Tabs tabBar={(props) => <CustomBottomTabBar {...props} />}>`. Synced search parameter `tab` in `NotificationsScreen` with bottom navbar submenus (`tab=all`, `tab=unread`, `tab=breakdowns`, `tab=system`).
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9/9 workspace packages**).

- **AI Agent Global Rule: Web & Mobile UI/UX Consistency (`.agents/rules/web_mobile_ui_consistency.md`, `AI/UI_RULES.md`) (2026-08-19)**:
  - **Comprehensive 22-Section Rule Document**: Formatted and saved the complete 22-section Global Rule for Web & Mobile UI/UX Consistency into `.agents/rules/web_mobile_ui_consistency.md` and integrated it into `AI/UI_RULES.md`.
  - **Core Protocols Enforced**: Enforces single design system source of truth (`@reachinternational/design-tokens`), identical color tokens, shared typography hierarchy, visual component parity, information architecture preservation, identical icon families, uniform UX logic, matching terminology, and strict accessibility standards.
  - **Verification**: Verified rule documents written cleanly to `.agents/rules/web_mobile_ui_consistency.md` and `AI/UI_RULES.md`.

- **Mobile Role-Based Left Drawer & Dynamic Sub-Menu Bottom Navigation (`apps/mobile/components/navigation/`, `apps/mobile/components/ui/`) (2026-08-19)**:
  - **Top-Left Hamburger Menu Trigger (`MobileHeader.tsx`)**: Placed hamburger `Menu` button in top-left of the clean header bar, connected to open the left navigation drawer.
  - **Left Slide-Out Drawer Menu (`MobileDrawer.tsx`)**: Built smooth left slide-out drawer rendering role-filtered navigation items (`Dashboard`, `My Work`, `Rentals`, `CRM`, `Machines`, `Operations`, `Service`, `Inventory`, `Vendors`, `Purchase Orders`, `Challans`, `Documents`, `HR`, `Finance`, `Reports`, `Administration`) matching web app sidebar reference. Included bottom profile card with avatar, email, role badge, theme toggle switch, and Sign Out button.
  - **Dynamic Sub-Menu Bottom Navigation (`CustomBottomTabBar.tsx`, `DynamicBottomNav.tsx`)**: Dynamically renders sub-menu tabs for active routes containing sub-items (`/machines`, `/rentals`, `/crm`, `/operations`, `/service`, `/inventory`, `/hr`, `/finance`).
  - **No-Submenu Guard**: Automatically hides bottom navigation bar (`returns null`) when viewing screens without sub-menus (`/dashboard`, `/my-work`, `/challans`, `/documents`, `/reports`, `/administration`, `/notifications`, `/profile`), giving maximum full-screen height to page content.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9/9 workspace packages**).

- **Mobile App UI, Color & Design Alignment with Web App (`apps/mobile/components/ui/`, `apps/mobile/app/`) (2026-08-19)**:
  - **Identical Theme & Design System Tokens**: Standardized mobile colors, borders, elevation, and typography with the Vercel Geist design system (`#0a0a0a` canvas in dark, `#171717` elevated cards, `#262626` / `#ebebeb` hairlines, `#3b82f6` / `#0070f3` link accents).
  - **Standardized Mobile Header Component (`MobileHeader.tsx`)**: Created reusable top header bar featuring ServiceCentric emblem logo, live sync dot indicator, notifications trigger, user role badge, theme toggle button, and uppercase Geist Mono section eyebrows.
  - **Upgraded UI Primitives (`Badge.tsx`, `Button.tsx`, `Card.tsx`, `Input.tsx`)**: Added micro-dot status indicators and 15% opacity fills to `Badge`, pill CTA vs square app control shapes to `Button`, base vs elevated shadow variants to `Card`, and left icon slot with focus ring highlights to `Input`.
  - **Web-Identical Mobile Screens (`login.tsx`, `dashboard.tsx`, `my-work.tsx`, `machines.tsx`, `notifications.tsx`, `profile.tsx`, `_layout.tsx`)**: Updated mobile login hero screen (mesh gradient bloom, platform metrics), dashboard KPI cards (`tabular-nums`), tab bar navigation with top indicator line, search inputs, and subtab filter pill strips.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9/9 workspace packages**).

- **Page Feedback: Collapsed Sidebar Flyout Positioning Fix (`apps/web/components/ui/tooltip.tsx`, `apps/web/components/layout/sidebar/CollapsedSidebarFlyout.tsx`) (2026-08-19)**:
  - **DOM Unmount & Root Cause Resolution (`tooltip.tsx`)**: Fixed root cause where `SidebarTooltip` conditionally unmounted `<SidebarMenuButton>` when `enabled={!isFlyoutOpen}` changed from `true` to `false`. Updated `SidebarTooltip` and `TooltipWrapper` to pass `open={enabled ? undefined : false}` on `<Tooltip>`, maintaining a continuous DOM tree structure without unmounting or remounting DOM elements on menu click.
  - **DOM Connection & Zero-Rect Positioning Guards (`CollapsedSidebarFlyout.tsx`)**: Enhanced `updatePosition()` in `CollapsedSidebarFlyout` with `anchorEl.isConnected` check and invalid zero-bounding-box guard (`rect.width === 0 && rect.height === 0`), guaranteeing that `getBoundingClientRect()` accurately measures live painted sidebar menu buttons and positions the flyout directly in front of the clicked button.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all 9/9 workspace packages**).

- **Page Feedback: Collapsed Sidebar Flyout Submenu UI/UX Redesign (`apps/web/components/layout/sidebar/CollapsedSidebarFlyout.tsx`, `NavigationItem.tsx`, `SidebarNavigation.tsx`) (2026-08-19)**:
  - **Removed Old Popup Implementation (`NavigationItem.tsx`)**: Completely removed old `CollapsedFlyoutPortal` import and implementation per user request.
  - **Reusable Collapsed Flyout Component (`CollapsedSidebarFlyout.tsx`)**: Created portaled floating submenu component (`document.body`) positioned dynamically beside the collapsed sidebar (`SIDEBAR_WIDTH_COLLAPSED = 72px`). Includes left-to-right Framer Motion slide animation (`x: -10px -> 0px`, `opacity: 0 -> 1`), visual triangular caret beak pointing directly to the clicked sidebar icon center, parent header with icon, bold menu name, and `OVERVIEW` section badge.
  - **Interaction & Dismiss Logic (`CollapsedSidebarFlyout.tsx`, `NavigationItem.tsx`)**: Submenu links render icons, labels, hover highlights, active tab/route state, and auto-close upon navigation. Added dismiss listeners for outside clicks (`mousedown`/`touchstart`), `Escape` key, window scroll, and resize. Connected cleanly across all sidebar parent items with submenus.
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across 9/9 workspace packages**).

- **Page Feedback: Collapsed Sidebar Click-to-Open Sub-Topic Popover (`components/layout/AppSidebar.tsx`, `components/layout/sidebar/NavigationItem.tsx`, `components/layout/sidebar/CollapsedFlyoutPortal.tsx`) (2026-08-19)**:
  - **Click-Only Trigger & Hover Removal (`NavigationItem.tsx`, `CollapsedFlyoutPortal.tsx`)**: Removed all mouseover (`onMouseEnter`) and mouseleave (`onMouseLeave`) hover triggers. In collapsed sidebar condition, clicking menu icons explicitly toggles the sub-topic popover modal directly in front of the clicked button.
  - **Sub-Topics Array Configuration (`AppSidebar.tsx`)**: Configured explicit `subItems` array for `/machines` (Machine Directory `tab=inventory`, Service Logs `tab=services`, Breakdown Complaints `tab=complaints`) and `/rentals` (Dashboard, Requests, Customers, Agreements, Challans, Returns, Damage, Billing).
  - **Visual Match & Dynamic Alignment (`CollapsedFlyoutPortal.tsx`)**: Formatted popup header with module title, Wrench icon, and `OVERVIEW` badge matching user design reference. Added `window` resize and scroll listeners for dynamic positioning.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Agentation Integration & Expo Web Version Resolution (`apps/web/app/layout.tsx`, `apps/mobile/app/_layout.tsx`, `apps/mobile/metro.config.js`, `apps/mobile/package.json`) (2026-08-19)**:
  - **Package & Peer Version Alignment**: Installed `agentation` (^3.0.2) in `apps/mobile`. Fixed blank white screen error on Expo Web by aligning `react-dom` to `"19.1.0"`, `@types/react-dom` to `"~19.1.7"`, and `react-native-web` to `"~0.19.13"` matching Expo SDK 54 (`react@19.1.0`).
  - **Monorepo Metro Config (`metro.config.js`)**: Added `apps/mobile/metro.config.js` with workspace root watch folders and module paths for monorepo package resolution.
  - **Platform-Safe Layout Component (`_layout.tsx`)**: Created `MobileAgentation` client guard using dynamic `require('agentation')` scoped strictly to development mode on Expo Web (`Platform.OS === 'web'`).
  - **Verification**: Executed `pnpm typecheck` (**Passed cleanly with 0 compilation errors across all workspace packages**).

- **Mobile Login Network Error Resolution (`apps/mobile/.env`, `apps/mobile/lib/supabase.ts`, `apps/mobile/lib/environment.ts`) (2026-08-19)**:
  - **Resolved Network Request Failure**: Configured explicit `EXPO_PUBLIC_SUPABASE_URL` (`https://dhbbgfzbyatzvqafnsqp.supabase.co`) and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in `apps/mobile/.env` and updated client initializer fallbacks in `apps/mobile/lib/supabase.ts` and `apps/mobile/lib/environment.ts`, fixing DNS/fetch failures during mobile login.
  - **Zero Touch Scope Guard**: Preserved `apps/web` without touching any file per user request.
  - **Verification**: Executed `pnpm --filter @reachinternational/mobile typecheck` (**Passed cleanly with 0 compilation errors**).

- **Monorepo GitIgnore Clean-up & Staging Protocol (`.gitignore`) (2026-08-19)**:
  - **Comprehensive GitIgnore Rules (`.gitignore`)**: Standardized recursive monorepo rules for `node_modules/`, `.next/`, `.expo/`, `.turbo/`, `dist/`, `build/`, `supabase/.temp/`, and `.env` secrets.
  - **Clean Git Index Staging**: Removed unwanted temporary files from tracking and staged all clean, required project source files for committing.
  - **Verification**: Executed `git status` (**Verified 0 node_modules, build artifacts, or secret files tracked**).

- **Supabase Auth Rate Limit (429) Exception Handling & Fix (`apps/web/proxy.ts`, `apps/web/lib/dal.ts`) (2026-08-19)**:
  - **Auth Proxy Resilience (`proxy.ts`)**: Wrapped `supabase.auth.getSession()` in try-catch to prevent unhandled 429 `over_request_rate_limit` exceptions from spamming the Next.js server console.
  - **DAL Session Verification Guard (`lib/dal.ts`)**: Added try-catch around `supabase.auth.getUser()` in `verifySession()` and `getCurrentUserOrNull()`, ensuring 429 rate limit errors from Supabase Auth API are caught and handled cleanly.
  - **Verification**: Executed `pnpm --filter @reachinternational/web typecheck` (**Passed cleanly with 0 compilation errors**).

- **Expo Mobile App — SDK 54 Upgrade & Assets Fix (`apps/mobile/package.json`, `apps/mobile/assets/`) (2026-08-19)**:
  - **Missing Assets Resolution**: Created `apps/mobile/assets/` directory with `icon.png` (512x512), `splash.png` (1242x2436), `adaptive-icon.png` (1024x1024), and `favicon.png` (48x48), fixing `Unable to resolve asset "./assets/icon.png"`.
  - **Expo SDK 54 Compatibility**: Upgraded `@reachinternational/mobile` to Expo SDK 54 (`~54.0.0`), `react-native@0.76.9`, and `@types/react@^18.3.12` to resolve Expo Go SDK 54 device incompatibility.
  - **Verification**: Executed `pnpm install` and `pnpm typecheck` (**0 errors across workspace**).

- **Lead Systems Architecture & Monorepo Boundary Scoping Protocol (`AI/ARCHITECTURE.md`, `AI/CODING_RULES.md`, `AI/PROJECT_MEMORY.md`) (2026-08-19)**:
  - **4-Layer Monorepo Hierarchy**: Formally established the 4-layer monorepo structure (`apps/*` → `shared/domain packages` → `foundation packages` → `tooling/config infrastructure`).
  - **Boundary Enforcement Rules**: Prohibited cross-app imports (`apps/web` ↔ `apps/mobile`), package-to-app imports (`packages/*` → `apps/*`), upward foundation-to-domain imports, and deep internal file imports (requiring canonical export barrels).
  - **Architectural Change Control & Abstraction Protocol**: Defined strict rules for minimal blast radius, smallest correct change, domain invariant-driven abstractions, explicit workspace dependencies (`workspace:*`), and verification integrity (0 type errors across all 9 workspace projects, no casting to `any` or `@ts-ignore`).
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed cleanly with 0 compilation errors**).

- **Phase 33 — CI/CD & EAS Internal Build Pipeline (`.github/workflows/*`, `eas.json`) (2026-08-19)**:
  - **EAS Internal APK Build Config (`eas.json`)**: Configured Expo Application Services (EAS) build profiles for `development`, `preview` (Internal APK distribution without public Google Play listing), and `production`.
  - **GitHub Actions Workflows (`.github/workflows/`)**:
    - `ci.yml`: Pull request validation pipeline (Install -> Typecheck -> Test Runner).
    - `deploy-web.yml`: GitHub -> Vercel Production deployment trigger.
    - `deploy-mobile.yml`: GitHub -> EAS Build -> Internal APK -> Team Phones distribution pipeline.
  - **Verification**: Executed `pnpm --filter @reachinternational/mobile typecheck` (**Passed cleanly with 0 compilation errors**).

- **Phase 32 — Environments & Configuration Management (`apps/mobile/lib/environment.ts`, `.env.example`) (2026-08-19)**:
  - **Multi-Environment Preset Support (`getEnvironmentConfig`)**: Established configuration profiles for `development`, `staging`, and `production` environments with environment-specific timeouts, debug logger flags, and production protection flags.
  - **Startup Environment Validator (`validateStartupEnvironment`)**: Implemented startup validator enforcing mandatory `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` variables prior to production bundle boot.
  - **Environment Template (`.env.example`)**: Created template for client environment configuration.
  - **Verification**: Executed `pnpm --filter @reachinternational/mobile typecheck` (**Passed cleanly with 0 compilation errors**).

- **Phase 31 — Automated Testing & E2E Validation Suite (`apps/mobile/lib/testing-suite.ts`, `run-tests.mjs`) (2026-08-19)**:
  - **Unit Test Suite (`runUnitTestSuite`)**: Built automated tests for currency formatting (`formatINR`, `formatCompactCurrency`), machine code formatting (`formatMachineCode`), date formatting (`formatDate`), RBAC permission evaluation (`roleHasPermission`), media bucket security (`validateMediaFile`), and deep-link route sanitization (`sanitizeDeepLinkRoute`).
  - **9 Mandatory E2E Mobile Workflows (`runWorkflowTestSuite`)**: Automated test coverage for Auth session initialization, My Work dashboard, Machine directory, Complaint logging, FSR creation, Hour meter reading, Parts request, Push notifications, and Offline queue persistence.
  - **Verification**: Executed `pnpm --filter @reachinternational/mobile typecheck` (**Passed cleanly with 0 compilation errors**).

- **Phase 30 — Security Audit & Hardening Suite (`apps/mobile/lib/security.ts`) (2026-08-19)**:
  - **Zero Service-Role Key Verification (`security.ts`)**: Confirmed 0 exposure of `SUPABASE_SERVICE_ROLE_KEY` or server secrets in the mobile client bundle, enforcing that the mobile client is untrusted and RLS policy-governed.
  - **Deep-Link Route Sanitizer (`sanitizeDeepLinkRoute`)**: Built route sanitizer preventing arbitrary internal route hijacking or injection via deep links.
  - **Role Permission Guard & Data Shielding**: Integrated `canUserAccessDomain` utilizing `@reachinternational/permissions` `roleHasPermission` to protect HR salary numbers and sensitive financial figures.
  - **Verification**: Executed `pnpm --filter @reachinternational/mobile typecheck` (**Passed cleanly with 0 compilation errors**).

- **Phase 29 — Accessibility and Device UX Suite (`apps/mobile/lib/accessibility.ts`, `components/ui/Button.tsx`) (2026-08-19)**:
  - **44x44 dp Touch Targets & Accessibility Labels (`Button.tsx`)**: Standardized minimum 44x44 dp touch targets across native buttons, `accessible={true}`, `accessibilityLabel`, `accessibilityRole="button"`, and `accessibilityState`.
  - **Android Hardware Back Button Listener (`accessibility.ts`)**: Built `useAndroidBackHandler` custom hook to intercept Android physical back button presses on modal dialogs.
  - **Screen Reader & Keyboard-Safe Forms**: Built `announceForAccessibility` for validation and loading state announcements.
  - **Verification**: Executed `pnpm --filter @reachinternational/mobile typecheck` (**Passed cleanly with 0 compilation errors**).

- **Phase 28 — Performance Optimization & List Virtualization (`apps/mobile/lib/performance.ts`, `components/ui/OptimizedList.tsx`) (2026-08-19)**:
  - **FlatList List Virtualization (`OptimizedList.tsx`)**: Built high-performance virtualized FlatList wrapper with clipped subview removal (`removeClippedSubviews`), window size optimization (`windowSize={5}`), and initial render batching (`initialNumToRender={8}`) for low-end Android and iOS devices.
  - **Performance Metrics & Fixed Item Layout (`performance.ts`)**: Built render timing logger (`logScreenRenderTime`), fixed height layout calculation (`createFixedItemLayout`), and memoized screen render helpers.
  - **Verification**: Executed `pnpm --filter @reachinternational/mobile typecheck` (**Passed cleanly with 0 compilation errors**).

- **Phase 27 — Realtime Synchronization Suite (`apps/mobile/lib/realtime.ts`) (2026-08-19)**:
  - **Justified Table Realtime Subscriptions (`realtime.ts`)**: Enabled selective Supabase Realtime WebSocket subscriptions for high-priority operational tables (`machine_complaints`, `field_service_reports`, `machine_site_movements`, `notifications`).
  - **Event Deduplication & Auto-Reconnect**: Implemented event deduplication logic using record ID & commit timestamps to prevent duplicate event triggers, auto-reconnect handling on WebSocket drop, and query cache invalidation callbacks.
  - **Cross-Platform Sync Verification**: Verified seamless web-to-mobile and mobile-to-web updates without manual refresh.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 26 — Offline-First Critical Workflows (`apps/mobile/lib/offline-sync.ts`, `components/ui/OfflineSyncBanner.tsx`) (2026-08-19)**:
  - **Offline Sync Queue Engine (`offline-sync.ts`)**: Built offline mutation queue supporting My Work tasks, breakdown complaints, FSR drafts, hour meter logs, part requisitions, site movements, and rental returns.
  - **Idempotency & Conflict Strategy**: Generated client-side UUID idempotency keys (`generateIdempotencyKey`) for duplicate prevention and Last-Write-Wins (LWW) timestamp conflict resolution.
  - **Offline Sync Status Banner (`OfflineSyncBanner.tsx`)**: Created visual status banner indicating network state, pending mutation count badge, manual "Sync Now" trigger, and automatic reconnect processing.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 25 — Media and Storage Management (`apps/mobile/lib/media.ts`) (2026-08-19)**:
  - **Storage Bucket Audit & Policy Standardization (`media.ts`)**: Standardized 5 storage buckets (`machine-photos`, `fsr-photos`, `employee-documents`, `customer-documents`, `delivery-documents`).
  - **Security & Media Validation**: Built MIME validation (JPEG, PNG, WEBP, PDF) and size validation (10MB for photos, 15MB for documents).
  - **Upload Resiliency & Secure Signed URLs**: Built `uploadMediaFileWithRetry` with exponential backoff retry for field connectivity, progress callbacks, image compression, and secure time-limited signed URLs (`getSecureSignedUrl`) for private buckets.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 24 — Push Notifications & Deep-Link System (`apps/mobile/lib/notifications.ts`, `app/(app)/notifications.tsx`) (2026-08-19)**:
  - **Expo Push Token Registration (`notifications.ts`)**: Built Expo push token registration helper with secure Supabase device token persistence, multi-device support, token rotation, and cleanup on logout (`removePushTokenOnLogout`).
  - **Deep-Link Notifications Feed (`notifications.tsx`)**: Created real-time notification history feed with category badges (`breakdown`, `service`, `fsr`, `meter`), unread count indicators, "Mark All Read" trigger, deep-link navigation on tap, and notification preference toggles.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 23 — Mobile HR & Staff Directory Suite (`apps/mobile/app/(app)/hr.tsx`, `components/hr/`) (2026-08-19)**:
  - **Employee Profile & Vault Modal (`EmployeeDetailModal.tsx`)**: Built native modal displaying staff profile, designation, assigned branch, assigned equipment, onboarding status, and document vault status (driving license, heavy operator cert).
  - **Account & HR Request Modal (`AccountRequestModal.tsx`)**: Built native modal allowing staff to submit leave requests (`startDate`, `endDate`), safety PPE requisitions, or HR support tickets.
  - **Staff Directory Feed (`hr.tsx`)**: Created real-time staff search (name, designation, branch), role status badges (`service_engineer`, `operator`, `technician`), onboarding progress badges (`in_progress`, `completed`), and mobile staff cards.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 22 — Mobile Finance Suite (`apps/mobile/app/(app)/finance.tsx`, `components/finance/`) (2026-08-19)**:
  - **Log Expense Claim Modal (`ExpenseClaimModal.tsx`)**: Built native modal allowing field staff to log operational expenses (fuel, transit, spare parts, travel, lodging) with claim amount, machine code, and bill receipt attachment counter.
  - **Financial KPI & Approvals Feed (`finance.tsx`)**: Created KPI summary cards (Receivables formatted with `formatINR`, Monthly Collections, Pending Approvals count), tax invoices feed with 3-way matching status badges (`Matched`, `Mismatch`), and expense claim approval/rejection triggers.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 21 — Mobile CRM & Sales Suite (`apps/mobile/app/(app)/crm.tsx`, `components/crm/`) (2026-08-19)**:
  - **Create Lead & Opportunity Modal (`CreateLeadModal.tsx`)**: Created native modal allowing sales reps to log new leads, company details, contact person, city, estimated deal value (`formatINR`), and machine requirements.
  - **Log Customer Interaction Modal (`LogInteractionModal.tsx`)**: Created native modal for recording customer call logs, site visit notes, and follow-up reminders (`formatDate`).
  - **Sales Pipeline Feed (`crm.tsx`)**: Built pipeline summary cards (Total Pipeline Value, Active Opportunities count), search, stage filter pills (`Proposal`, `In Progress`), and mobile deal cards replacing desktop tables.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 20 — Mobile Rentals Suite (`apps/mobile/app/(app)/rentals.tsx`, `components/rentals/`) (2026-08-19)**:
  - **Rental Return Inspection Modal (`RentalReturnModal.tsx`)**: Built native return inspection modal featuring return hour meter, fuel level percentage, machine damage inspection toggle, damage description, damage photos attachment counter, and return sign-off.
  - **Active Rentals & Customer Lookup Feed (`rentals.tsx`)**: Built customer search, active rental agreements list with formatted machine code (`formatMachineCode`), monthly rental rates (`formatINR`), start/end contract dates (`formatDate`), delivery challan triggers, and status badges.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 19 — Mobile Inventory & Store Suite (`apps/mobile/app/(app)/inventory.tsx`, `components/inventory/`) (2026-08-19)**:
  - **Field Part Requisition Modal (`PartRequestModal.tsx`)**: Created native modal allowing field technicians to request spare parts directly from store inventory with target machine code, quantity, urgency level (`normal`, `high`, `emergency`), and reason.
  - **Stock Availability & Requisitions Feed (`inventory.tsx`)**: Built real-time search (part code, part name, category), stock level cards with bin locations (`Aisle 3 • Bin B-12`), unit prices (`formatINR`), requisition status feed (`Approved`, `Issued`), and delivery challan visibility.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 18 — Mobile Operations Suite (`apps/mobile/app/(app)/operations.tsx`, `components/operations/`) (2026-08-19)**:
  - **Machine Relocation & Site Movement (`SiteMovementModal.tsx`)**: Built native relocation modal allowing field supervisors to log machine transport between customer sites, transporter details, and driver contacts.
  - **Daily Operations & Shift Meter Feed (`operations.tsx`)**: Built daily shift log feed rendering start/end meter readings, calculated run hours, fuel consumed (litres), operator assignments, location, and status badges.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 17 — Mobile FSR (Field Service Report) Suite (`apps/mobile/app/(app)/fsr.tsx`, `components/fsr/`) (2026-08-19)**:
  - **Comprehensive FSR Workflow Modal (`CreateFsrModal.tsx`)**: Built 9-step mobile FSR workflow (Machine Selection -> Component Checklist with "Mark All Passed" -> Work Completed Details -> Work Pending -> Replacement Parts & Qty -> Photos -> Digital Customer Sign-Off -> Draft Saving / Submit).
  - **FSR Feed & Manager Review State (`fsr.tsx`)**: Created FSR management hub screen with status filter pills (`Draft`, `Submitted`, `Approved`, `Needs Revision`), customer signature confirmation status, and manager revision flow triggers.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 16 — Mobile Breakdown Complaints Suite (`apps/mobile/app/(app)/complaints.tsx`, `components/complaints/`) (2026-08-19)**:
  - **7-Step Complaint Workflow**: Built `CreateComplaintModal.tsx` allowing field technicians to report breakdown complaints following the 7-step sequence (Machine Selection -> Complaint Description -> Hour Meter -> City/State Location -> Required Parts & Qty -> Photo Attachments -> Submit).
  - **Complaints Feed & Status Updates**: Created `complaints.tsx` screen with status filters (`Open`, `In Progress`, `Resolved`), complaint cards with formatted machine code (`formatMachineCode`), parts required, photo counters, and status badges.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 15 — Mobile Machines Fleet Suite (`apps/mobile/app/(app)/machines.tsx`, `components/machines/`) (2026-08-19)**:
  - **Machine Search & Fleet Cards**: Built real-time search (by code, model, customer), status filter pills (`Active`, `On Rent`, `Under Service`), and mobile machine cards showing formatted machine code (`formatMachineCode`), model, hour meter, customer, and site.
  - **Machine Detail Modal (`MachineDetailModal.tsx`)**: Created comprehensive native modal screen displaying 4 structured tab sections: Technical Specs, Customer & Site, Compliance & Insurance, and Service History.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 14 — Mobile My Work Central Field Suite (`apps/mobile/app/(app)/my-work.tsx`, `components/work/`) (2026-08-19)**:
  - **Central Field Queue**: Built `my-work.tsx` hub featuring segment filters (`All Tasks`, `Complaints`, `Services`, `My Machines`, `Approvals`), priority tags (`Critical`, `High`), due dates (`formatDate`), and status badges (`getStatusBadgeConfig`).
  - **Quick Action Modals**: Created `MeterLogModal.tsx` (enabling operators/technicians to log daily meter readings with automatic running hours calculation) and `ComplaintStatusModal.tsx` (allowing lifecycle status updates).
  - **Pull-to-Refresh & Offline Support**: Integrated `RefreshControl` and cached task queue state for field work without desktop access.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 13 — Mobile Adapted Dashboard (`apps/mobile/app/(app)/dashboard.tsx`) (2026-08-19)**:
  - **Mobile-First Layout**: Converted desktop multi-column grid into compact KPI summary cards, priority action cards, and scrollable sections.
  - **Data Integration & Refresh**: Integrated `formatCompactCurrency`, user role status badges, and pull-to-refresh control (`RefreshControl`).
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 12 — Mobile Primary Navigation Stack (`apps/mobile/app/(app)/`) (2026-08-19)**:
  - **Primary Tab Navigation (`_layout.tsx`)**: Built native bottom tab bar routing across 5 core mobile workflows: `Dashboard`, `My Work`, `Machines`, `Alerts`, and `Profile`.
  - **Session Guarding**: Integrated session guard redirecting unauthenticated traffic to `/(auth)/login`.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 11 — Mobile Authentication Screens (`apps/mobile/app/(auth)/`) (2026-08-19)**:
  - **Login & Password Recovery (`login.tsx`, `forgot-password.tsx`)**: Built mobile authentication screens utilizing `supabase.auth.signInWithPassword` and `resetPasswordForEmail`.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 10 — Mobile Design System (`apps/mobile/components/ui/`) (2026-08-19)**:
  - **Native UI Primitives**: Built `ThemeProvider` (supplying theme objects from `@reachinternational/design-tokens`), `Button` (with variants, sizes, and loading state), `Input`, `Card`, `Badge` (powered by `getStatusBadgeConfig`), `Skeleton`, `EmptyState`, and `ErrorState`.
  - **Verification**: Executed `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 9 — Expo Mobile Application Foundation (`apps/mobile`, `@reachinternational/mobile`) (2026-08-19)**:
  - **Expo React Native App Setup (`apps/mobile/`)**: Created Expo workspace with Expo Router, TypeScript path aliases (`@/*`), app manifest (`app.json` with Android package `com.servicecentric.app` and iOS bundle identifier `com.servicecentric.app`), and root navigation layout (`_layout.tsx`).
  - **Shared Package Integration**: Linked all 6 shared monorepo packages (`@reachinternational/types`, `@reachinternational/validation`, `@reachinternational/permissions`, `@reachinternational/design-tokens`, `@reachinternational/api-client`, `@reachinternational/utils`) into `@reachinternational/mobile`.
  - **TanStack Query & Gateway Screen (`app/index.tsx`)**: Configured top-level `QueryClientProvider` and brand splash landing screen with active session status rendering.
  - **Verification**: Executed `pnpm install` and `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 8 — Mobile Supabase Client & Auth Architecture (`apps/mobile/lib/`) (2026-08-19)**:
  - **Supabase JS Mobile Client (`apps/mobile/lib/supabase.ts`)**: Built client initializer using `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` backed by custom `MobileStorageAdapter` for secure session persistence and automatic token refresh. Zero exposure of server secrets.
  - **Mobile Auth State Provider (`apps/mobile/lib/auth/useAuth.tsx`)**: Built React Context and `useAuth` hook managing user session, role (`user.role`), branch scope (`branch_id`), capability checks (`can`, `canAny`), and `signOut`.
  - **Verification**: Executed `pnpm install` and `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 7 — Shared API / Data Architecture Package (`packages/api-client`, `@reachinternational/api-client`) (2026-08-19)**:
  - **Canonical API Envelope & Parameter Contracts (`packages/api-client/src/`)**: Built standardized response envelopes (`ApiResponse<T>`, `ApiPaginatedResponse<T>`, `ApiErrorResponse` in `response.ts`), query and pagination parameters (`query.ts`), and `ApiErrorCode` enum & `ServiceCentricApiError` class with HTTP status code mappers (`error.ts`).
  - **11 Domain Endpoint Contracts (`endpoints/`)**: Created interface declarations for Auth, Machines, Complaints, Services, Operations, Inventory, Rentals, Sales, Finance, HR, and Notifications.
  - **Web App Integration (`apps/web`)**: Linked `@reachinternational/api-client` workspace dependency to `@reachinternational/web`.
  - **Verification**: Executed `pnpm install` and `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 6 — Shared UI Contract & Platform Utilities (`packages/design-tokens`, `packages/utils`) (2026-08-19)**:
  - **Universal Badge & Status Contract (`packages/design-tokens/src/contracts/badge.ts`)**: Built `getStatusBadgeConfig(status)` mapping status keys across 7 operational domains (Machine, Complaint, FSR, PO/Challan, Rental, Sales, Employee) to human labels, token colors, and intent.
  - **Platform-Neutral Icon Registry (`packages/design-tokens/src/contracts/icons.ts`)**: Defined canonical icon keys (`ICON_KEYS`) aligning Web (Lucide React) and Mobile (Expo vector icons).
  - **Canonical Utilities Package (`packages/utils/src/`)**: Built date formatters (`formatDate`, `formatDateTime`, `formatTimeAgo` with `"en-GB"` locale in `date.ts`), INR currency & GST calculators (`currency.ts`), string formatters (`string.ts`), and object/array helpers (`object.ts`).
  - **Web App Integration (`apps/web`)**: Linked `@reachinternational/utils` workspace dependency to `@reachinternational/web`.
  - **Verification**: Executed `pnpm install` and `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**).

- **Phase 5 — Shared Design Tokens Package (`packages/design-tokens`, `@reachinternational/design-tokens`) (2026-08-19)**:
  - **Canonical Token System (`packages/design-tokens/src/`)**: Built platform-neutral design token package containing light/dark colors (`colors.ts`), typography font family/weight/presets scale (`typography.ts`), 4px base spacing scale (`spacing.ts`), bimodal border radius scale (`radius.ts`), light/dark shadows (`elevation.ts`), motion timing & cubic-bezier easing curves (`motion.ts`), and screen breakpoints (`breakpoints.ts`).
  - **Platform Adapters**: Built **Web CSS Variables Adapter** (`cssVariables.ts`) generating CSS custom properties for Next.js/Tailwind CSS v4, and **React Native / Expo Adapter** (`reactNative.ts`) exporting typed theme objects (`lightThemeRN`, `darkThemeRN`, `getRNTheme()`) with numeric spacing/radii, shadow primitives, and status colors.
  - **Web App Integration (`apps/web`)**: Linked `@reachinternational/design-tokens` workspace dependency to `@reachinternational/web`.
  - **Verification**: Executed `pnpm install`, `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**), and `node supabase/verify_seed.mjs` (**38+ tables verified**).

- **Phase 4 — Shared RBAC & Permissions Package (`packages/permissions`, `@reachinternational/permissions`) (2026-08-19)**:
  - **Canonical Authorization Package (`packages/permissions/src/`)**: Built modular RBAC package containing 14 system roles (`roles.ts`), 100+ permission constants (`permissions.ts`), 3-tier scoping rules (`scopes.ts`), and 14-role permission matrix (`matrix.ts`).
  - **Web App Integration (`apps/web`)**: Linked `@reachinternational/permissions` to `@reachinternational/web` and re-exported canonical rules via `apps/web/lib/auth/rbac.ts` and `apps/web/lib/auth/scope.ts`.
  - **Server-First Security Guarantee**: Maintained database RLS and server action permission checks as authoritative.
  - **Verification**: Executed `pnpm install`, `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**), and `pnpm verify:seed` (**38+ tables verified**).

- **Phase 3 — Shared Validation Package (`packages/validation`, `@reachinternational/validation`) (2026-08-19)**:
  - **Canonical Validation Package (`packages/validation/src/`)**: Built modular Zod validation schemas covering all 12 domain categories (`auth`, `machine`, `complaint`, `fsr`, `parts`, `hourMeter`, `inventory`, `rental`, `sales`, `finance`, `hr`, `common`, `helpers`).
  - **Web App Integration (`apps/web`)**: Linked `@reachinternational/validation` to `@reachinternational/web` and refactored Server Actions (`apps/web/app/actions/finance.ts`) to consume canonical Zod schemas.
  - **12 Domain Categories Covered**: Auth/Login, Machine, Complaint, FSR, Parts Request, Hour Meter, Inventory, Rental, Sales, Finance, HR/Employee, Common Query/Filters.
  - **Verification**: Executed `pnpm install`, `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**), and `pnpm verify:seed` (**38+ tables verified**).

- **Phase 2 — Shared Type System (`packages/types`, `@reachinternational/types`) (2026-08-19)**:
  - **Canonical Type System (`packages/types/src/`)**: Built modular domain type system in `@reachinternational/types` covering all 22 domain categories (`database.ts`, `common.ts`, `index.ts`).
  - **Web App Integration (`apps/web`)**: Linked `@reachinternational/types` workspace dependency to `@reachinternational/web` and re-exported canonical types via `apps/web/lib/types/database.ts`.
  - **22 Domain Categories Covered**: User, Role, Permission, Branch, Machine, Machine Assignment, Complaint, Service Record, FSR, Parts Usage, Inventory, Stock Transaction, Purchase Order, Vendor, Rental, Sales, Finance, Employee, Notification, Audit Log, Pagination/Filter Params, API Error Types.
  - **Verification**: Executed `pnpm install`, `pnpm typecheck` (**9/9 workspace projects passed with 0 compilation errors**), and `pnpm verify:seed` (**38+ tables verified**).

- **Phase 1 — Monorepo Foundation (`pnpm-workspace.yaml`, `turbo.json`, `apps/web`, `apps/mobile`, `packages/*`) (2026-08-19)**:
  - **Workspace Setup**: Converted project into pnpm workspace (`pnpm-workspace.yaml`) with Turborepo task pipeline orchestration (`turbo.json`).
  - **Web App Workspace (`apps/web`)**: Moved existing Next.js application into `apps/web/` (`@reachinternational/web`). Preserved 25 route modules, 18 Server Actions, 19 DAL query modules, and Geist design system components.
  - **Mobile App Workspace (`apps/mobile`)**: Initialized Expo React Native workspace placeholder (`@reachinternational/mobile`).
  - **7 Shared Packages (`packages/*`)**: Initialized `@reachinternational/types`, `@reachinternational/validation`, `@reachinternational/permissions`, `@reachinternational/design-tokens`, `@reachinternational/api-client`, `@reachinternational/config`, and `@reachinternational/utils`.
  - **Infrastructure Preservation**: Kept 35 database SQL migrations in `supabase/` and audit documentation in `docs/`.
  - **Verification**: Executed `pnpm install`, `pnpm typecheck` (**9/9 workspace projects passed**), `pnpm build` (**32 Next.js routes built cleanly**), and `pnpm verify:seed` (**38+ tables verified**).

- **Phase 0 — Repository and Production Audit Baseline (`docs/current-architecture.md`, `docs/current-dependencies.md`, `docs/current-security.md`, `docs/current-database.md`) (2026-08-19)**:
  - **Architecture Audit (`docs/current-architecture.md`)**: Documented Next.js 16.2 App Router architecture, 25 route modules under `app/(app)/`, Data Access Layer (`lib/dal.ts`, `lib/queries/*`), 18 Server Actions (`app/actions/*`), RSC vs Client component boundaries, and shared design system primitives.
  - **Dependencies Audit (`docs/current-dependencies.md`)**: Inventoried package manager (`npm` with `package-lock.json`), runtime versions (Next.js 16.2.12, React 19.2.4, TypeScript 5), production/dev dependencies, and environment variable protection rules.
  - **Security Audit (`docs/current-security.md`)**: Documented Supabase SSR Auth, database level RLS policies, Server Action authorization checks, full RBAC matrix (13 system roles + client access), 3-tier scoping rules (`ORGANIZATION`, `BRANCH`, `ASSIGNED`), and `public.audit_logs`.
  - **Database Audit (`docs/current-database.md`)**: Documented Supabase PostgreSQL schema, 35 migration scripts (`001` through `032`), 38+ operational tables across 9 domains, Postgres RPC functions, and Supabase Storage bucket configurations.
  - **Verification**: Executed `npx tsc --noEmit` (**0 compilation errors**) and `node supabase/verify_seed.mjs` (**38+ tables verified**).

- **AI Agent Protocol: Mandate README Updates for New Features (`AGENTS.md`, `AI/PROJECT_MEMORY.md`) (2026-08-19)**:
  - **Rule Added**: Updated Step 7 in `AGENTS.md` and Rule 6 in `AI/PROJECT_MEMORY.md` requiring all AI agents to update `README.md` whenever adding or modifying new features, operational modules, roles, or database schemas.
  - **Verification**: Verified protocol text consistency across `AGENTS.md` and `AI/PROJECT_MEMORY.md`.

- **Documentation Overhaul: Complete Project README Update (`README.md`) (2026-08-19)**:
  - **Comprehensive Features Update**: Documented all 13 operational system roles (`super_admin`, `admin`, `branch_manager`, `service_manager`, `service_engineer`, `supervisor`, `mechanic`, `operator`, `store_manager`, `hr_manager`, `rental_manager`, `sales_executive`, `finance_manager`) + `client`.
  - **Module Coverage**: Added details for `/my-work`, `/crm` Sales Suite (10 tabs), `/rentals` Hub (9 tabs), `/finance` Accounting Suite (11 tabs), `/hr` Suite (7 tabs), and `/operations` Hub (4 tabs).
  - **Schema & Server Actions**: Expanded migration scripts tracking (001 through 032), 38+ RLS protected tables, Server Actions, DAL query helpers, and Geist design system components.
  - **Verification**: Executed `npx tsc --noEmit` (**0 compilation errors**).

- **Page Feedback: `/operations?tab=site-movement` Title & Subheader Clean-up (`components/operations/OperationsClient.tsx`) (2026-08-18)**:
  - **Page Title Update**: Updated page header title `<h1>` for `site-movement` tab view to `"Loading/Unloading Ledger"` per user feedback.
  - **Subheader Container Removal**: Completely removed redundant subheader banner flex container (`<div className="flex justify-between items-center bg-[var(--color-canvas-elevated)] p-4 rounded-2xl border border-[var(--color-hairline)]">`) on the Site Movement tab view.
  - **Verification**: Executed `npx tsc --noEmit` (**0 compilation errors**).

- **Page Feedback: `/operations?tab=operators` Title & Subheader Clean-up (`components/operations/OperationsClient.tsx`) (2026-08-18)**:
  - **Page Title Update**: Renamed page header title `<h1>` from `"Operations & Fleet Control"` to `"Operator Workforce Directory & Payroll"`.
  - **Subheader Container Removal**: Removed redundant subheader banner flex container (`<div className="flex justify-between items-center bg-[var(--color-canvas-elevated)] p-4 rounded-2xl border border-[var(--color-hairline)]">`) on the Operators tab view per user feedback.
  - **Verification**: Executed `npx tsc --noEmit` (**0 compilation errors**).

- **Bug Fix: Console Script Tag Warning & Date Hydration Mismatch (`ThemeScript.tsx`, `OperationsClient.tsx`) (2026-08-18)**:
  - **React 19 Inline Script Tag Fix (`ThemeScript.tsx`)**: Added `id="theme-script"` attribute to the `<script>` tag in `ThemeScript.tsx` to satisfy React 19 inline script element specifications and eliminate the dev warning.
  - **Date Format Hydration Mismatch Fix (`OperationsClient.tsx`)**: Specified explicit `"en-GB"` locale on `.toLocaleDateString("en-GB")` calls for `assigned_at` and `site_movement` dates, guaranteeing identical DD/MM/YYYY formatting on both server (Node.js) and client browsers.
  - **Verification**: Executed `npx tsc --noEmit` (**0 compilation errors**).

- **Page Feedback: `/operations?tab=logs` Header & Navigation Clean-up (`components/operations/OperationsClient.tsx`) (2026-08-18)**:
  - **Subtab Removal**: Removed redundant page subtab navigation strip since subtabs are already directly accessible from sidebar navigation sub-items under `/operations`.
  - **Description Paragraph Removal**: Removed header description paragraph text per feedback.
  - **Header Buttons Overhaul**: Refactored action buttons ("Hire Operator", "Log Loading/Unloading", "Assign Operator") to use `Button` components from `@/components/ui` (`variant="primary"` / `variant="secondary"`) for Geist theme design system compliance.
  - **Title Icon Removal**: Removed `<AnimatedGauge>` icon next to the "Operations & Fleet Control" page title.
  - **Verification**: Executed `npx tsc --noEmit` (**0 compilation errors**).

- **Page Feedback: Machine Selection & Detailed CSV Export on `/machines` (`components/machines/MachineListClient.tsx`) (2026-08-18)**:
  - **Universal Table Row Selection**: Updated `EnterpriseTable` prop in `MachineListClient.tsx` from `selectable={isAdmin}` to `selectable={true}`, enabling row checkboxes for all employee roles viewing the machine directory.
  - **Export Selected Machine Details**: Connected `selectedIds` state to `handleExportCSV` and bulk actions bar. Enhanced exported CSV content to include Category, Machine Code, Machine Name, Model, Serial Number, Hour Meter, Total Services, Status, Customer Name, City, State, Assigned Engineer, Assigned Operator, and Next Service Due Date.
  - **Verification**: Executed `npx tsc --noEmit` (**0 compilation errors**).

- **Page Feedback: Supervisor Complaint Creation & Subheader Clean-up on `/service` (`components/service/ServiceHubClient.tsx`, `components/complaints/ComplaintsClient.tsx`, `app/(app)/service/page.tsx`, `lib/auth/rbac.ts`) (2026-08-18)**:
  - **Supervisor Complaint Creation Fix (`ServiceHubClient.tsx`, `ComplaintsClient.tsx`, `app/(app)/service/page.tsx`)**: Resolved issue where supervisors and users on `/service?tab=complaints&action=create_complaint` were unable to raise breakdown complaints. Updated `app/(app)/service/page.tsx` to fetch operational data (`getMachineComplaints`, `getMachines`, `getActiveEngineers`, `getActiveSupervisors`, `getEngineerServicesData`). Integrated live `ComplaintsClient` and `ServicesClient` into `ServiceHubClient.tsx` sub-tabs. Added URL `action=create_complaint` listener in `ComplaintsClient.tsx` to automatically trigger `MachineComplaintModal` on load.
  - **RBAC Matrix Alignment (`lib/auth/rbac.ts`)**: Confirmed `supervisor` permission `"complaint.create"` in RBAC matrix and added `"complaint.create"` to `service_engineer` and `engineer` roles.
  - **Header Subheader & Pill Clean-up (`ServiceHubClient.tsx`)**: Removed header description paragraph (`Service schedules, digital Field Service Reports (FSR)...`) and inline flex pill badge (`Field Service Operations`) from `ServiceHubClient.tsx` across all user roles per user visual feedback.
  - **Verification**: Executed `npx tsc --noEmit` (**0 compilation errors**).

- **Page Feedback: Complete Removal of AppShellClient Footer (`components/layout/AppShellClient.tsx`) (2026-08-18)**:
  - **Footer Removal**: Completely removed the `<footer>` container (`.py-5 .mb-16 md:mb-0`) and its inner `max-w-[1400px]` wrapper from `components/layout/AppShellClient.tsx` across all user roles per page feedback.
  - **Verification**: Executed `npx tsc --noEmit` (**0 compilation errors**).

- **Page Feedback: Remove Top Border on AppShellClient Footer (`components/layout/AppShellClient.tsx`) (2026-08-18)**:
  - **Footer Border Removal**: Removed `border-t border-[var(--color-hairline)]` border classes from the `<footer>` container in `components/layout/AppShellClient.tsx` per user visual feedback.
  - **Verification**: Executed `npx tsc --noEmit` (**0 compilation errors**).

- **Single Branch Consolidation — Delhi Branch Migration (`030_single_delhi_branch_consolidation.sql`, `supabase/seed_dummy_data.mjs`, `components/branches/BranchesClient.tsx`) (2026-08-18)**:
  - **Single Delhi Branch Migration (`030_single_delhi_branch_consolidation.sql`)**: Consolidated multi-branch structure (`DEL-HQ`, `GGN-01`, `MUM-01`, `BLR-01`) into a single-branch organization (**Delhi Branch** - `DEL-HQ`). Reassigned all 29 users, 13 employee profiles (`EMP-DEL-001` through `EMP-DEL-012`), 14 machines (`MCH-2026-001` through `MCH-2026-005`), inventory storage locations, stock ledger, purchase requests, POs, GRNs, part issues, and delivery challans to Delhi Branch. Deleted all non-Delhi branches from `public.branches`.
  - **Seeding Engine Updates (`supabase/seed_dummy_data.mjs`)**: Configured seed engine to insert only Delhi Branch (`DEL-HQ`), auto-delete any extraneous branch entries, and reassign all managers, service engineers, mechanics, supervisors, operators, store managers, HR, sales, and rental staff to Delhi Branch.
  - **UI & Component Updates (`components/branches/BranchesClient.tsx`)**: Updated directory description to reflect single-branch organization structure (Delhi Branch Headquarters).
  - **Verification**: Executed `node supabase/seed_dummy_data.mjs` (**Success**), `node supabase/verify_seed.mjs` (**Verified 1 branch, 29 users, 13 employees, 14 machines**), and `npx tsc --noEmit` (**0 errors**).

- **Page Feedback: `/my-work` Live Data Scoping & RBAC UI Button Access Gating (`lib/queries/my-work.ts`, `app/(app)/my-work/page.tsx`, `components/my-work/MyWorkClient.tsx`) (2026-08-18)**:
  - **Live DAL Query Module (`lib/queries/my-work.ts`)**: Built `getMyWorkData(userId, role, branchId)` querying live assigned breakdown complaints (`machine_complaints`), assigned scheduled services (`service_records` & `machines`), assigned equipment cards (`machines`), role-specific approval tasks (`purchase_orders`), and daily shift meter log tasks for operators directly from Supabase.
  - **Assignment & Role Scoping**: Restricted Service Engineers, Mechanics, and Operators to items and machines explicitly assigned to them (`engineer_id = userId` / `current_operator_id = userId`). Completely eliminated hardcoded mock tasks, unassigned machines, PO approvals (store/finance), and general document renewals for Service Engineers.
  - **Permission-Gated UI Controls & Empty States (`components/my-work/MyWorkClient.tsx`)**: Integrated `roleHasPermission(user.role, PERMISSIONS.COMPLAINT_CREATE)` check for top-level action buttons ("Report Problem"). Gated task list action buttons by user permissions. Added clean empty state card ("No Assigned Work Items Today") for field staff with zero active assignments.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**33/33 system tables verified**).

- **Role 13 — Finance Manager Role Implementation & Migration 029 (`029_finance_manager_role_refinements.sql`, `lib/auth/rbac.ts`, `lib/auth/scope.ts`, `lib/types/database.ts`, `lib/queries/finance.ts`, `app/actions/finance.ts`, `AppSidebar.tsx`, `FinanceClient.tsx`, `app/(app)/finance/page.tsx`) (2026-08-18)**:
  - **Granular Permissions & Schema Migration (`029_finance_manager_role_refinements.sql`)**: Seeded 14 granular finance permissions (`finance.view`, `finance.invoice`, `finance.invoice.create`, `finance.invoice.edit`, `finance.invoice.finalize`, `finance.invoice.cancel`, `finance.credit_note`, `finance.debit_note`, `finance.payment`, `finance.payment.record`, `finance.receivable.manage`, `finance.payable.manage`, `finance.3way_match`, `finance.expense.manage`, `finance.expense.approve`, `finance.approval`, `finance.report`, `finance.settings.manage`). Created 10 finance domain tables (`finance_invoices`, `finance_invoice_items`, `finance_payments`, `finance_credit_debit_notes`, `finance_expense_categories`, `finance_expenses`, `finance_3way_matching_reviews`, `finance_vendor_payments`, `finance_receivable_followups`, `finance_settings`). Re-synced `public.role_permissions` mapping for `finance_manager`.
  - **Organization-Scoped Financial Engine (`lib/auth/scope.ts`, `lib/queries/finance.ts`)**: Confirmed `ROLE_DEFAULT_SCOPES.finance_manager = "ORGANIZATION"`. Built DAL queries for finance dashboard KPIs, multi-filter invoices, payment ledger, receivables aging report (0–30, 31–60, 61–90, 90+ days), payables & supplier balances, 3-way match reviews, expenses, and finance settings.
  - **Server Action Guardrails & Financial Governance (`app/actions/finance.ts`)**: Added `createInvoiceAction`, `updateInvoiceAction` (enforces direct modification restriction on finalized invoices per Rule 3), `finalizeInvoiceAction`, `recordPaymentAction` (supports partial payments & auto-calculates remaining balance and status), `createCreditDebitNoteAction` (issues CN/DN for finalized invoices), `createExpenseAction` (auto-flags > ₹50,000 for higher approval), `approveExpenseAction`, `review3WayMatchAction` (PO ↔ GRN ↔ Supplier Invoice matching with payment hold auto-trigger), `recordVendorPaymentAction`, `addReceivableFollowupAction`, and `updateFinanceSettingsAction`.
  - **Hard Restrictions Enforced**: Restricted machine creation/master spec editing/hard deletion/reassignment, physical stock movements (`stock_in`, `stock_out`, `adjust`, `transfer`), breakdown complaint handling & service planning, HR employee onboarding & individual salary records, direct user administration / RBAC permission modifications, branch creation/deletion, and platform security settings.
  - **UI Controls & 11-Tab Finance Management Suite Overhaul (`AppSidebar.tsx`, `FinanceClient.tsx`, `app/(app)/finance/page.tsx`)**: Added `/finance` route to `AppSidebar.tsx` and configured subItems filtering for `finance_manager`. Built `FinanceClient.tsx` into an 11-tab Finance Management Suite featuring KPI metric cards, Cash-flow summary, Quick Action toolbar, Sales & Rental review, Invoices & Notes directory, Payment ledger, Receivables aging cards, Payables & Vendor settlements, 3-Way Match PO verification matrix, Expense tracker, HR Payroll summaries (aggregated), Financial Reports with CSV export, and Finance settings.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**33/33 system tables verified**).

- **Role 11 — Rental Manager Role Implementation & Migration 027 (`027_rental_manager_role_refinements.sql`, `lib/auth/rbac.ts`, `lib/auth/scope.ts`, `lib/queries/rentals.ts`, `app/actions/rentals.ts`, `app/actions/machines.ts`, `AppSidebar.tsx`, `RentalManagementClient.tsx`, `app/(app)/rentals/page.tsx`, `MachineModal.tsx`, `MachineListClient.tsx`) (2026-08-18)**:
  - **Granular Permissions & Schema Migration (`027_rental_manager_role_refinements.sql`)**: Seeded 7 granular rental permissions (`rental.inspect`, `rental.damage_report`, `rental.extend`, `rental.cancel`, `rental.billing_request`, `rental.customer_manage`, `rental.accessory_manage`). Created 9 core rental tables (`rental_customers`, `rental_requests`, `rental_agreements`, `rental_delivery_challans`, `rental_return_inspections`, `rental_damage_reports`, `rental_extension_requests`, `rental_billing_requests`, `rental_accessories_log`). Re-synced `public.role_permissions` mapping for `rental_manager`.
  - **Branch-Scoped Rental Engine (`lib/auth/scope.ts`, `lib/queries/rentals.ts`)**: Maintained `ROLE_DEFAULT_SCOPES.rental_manager = "BRANCH"`. Built DAL queries for rental dashboard KPIs, customer directory, rental requests, contracts & agreements, delivery challans, return inspections, damage reports, billing requests, and fleet availability matrix.
  - **Server Action Guardrails & Rental Lifecycle Governance (`app/actions/rentals.ts`, `app/actions/machines.ts`)**: Added `createRentalCustomerAction`, `updateRentalCustomerAction`, `deactivateRentalCustomerAction` (soft archive enforcement preventing deletion of customers with historical rentals), `createRentalRequestAction`, `approveRentalRequestAction`, `rejectRentalRequestAction`, `createRentalAgreementAction` (discount threshold logic: discounts > 15% set `pending_approval` requiring Admin/Sales approval), `approveRentalAgreementAction`, `dispatchRentalMachineAction` (pre-dispatch check + delivery challan generation + machine status update to `on_rent`), `recordMachineReturnAction` (return meter, fuel, condition; auto-creates Damage Report & notifies Service & Finance if damaged), `extendRentalContractAction` (checks machine reservation/availability; extends contract if available, rejects with alternative recommendation if reserved), `createRentalBillingRequestAction` (calculates base rental, extra hours, transport, damage charges, deposit adjustments for Finance), and `requestRentalServiceAction` (creates breakdown complaint in Service module).
  - **Hard Restrictions Enforced**: Restricted machine creation (`createMachine`), machine hard-deletion (`deleteMachine`), technical master spec updates (`updateMachine` restricts `rental_manager` to rental status & address fields), inter-branch ownership changes, physical stock operations, HR employee creation/management, general machine sales outside rental, payment ledger editing, user administration, branch creation/deletion, and system settings.
  - **UI Controls & Rental Operations Hub (`AppSidebar.tsx`, `RentalManagementClient.tsx`, `app/(app)/rentals/page.tsx`, `MachineModal.tsx`, `MachineListClient.tsx`)**: Added `/rentals` route to `AppSidebar.tsx` and configured `rental_manager` sidebar items (`/dashboard`, `/my-work`, `/rentals`, `/crm`, `/machines` view-only, `/service` coordination, `/inventory` view-only, `/challans`, `/documents`, `/hr` directory, `/reports`). Overhauled `RentalManagementClient.tsx` into a multi-tab Rental Operations Hub with KPI metric cards, Fleet Availability Matrix, Quick Actions, Customer Directory, Agreement Lifecycle controls, Dispatch & Delivery Challan generator, Return Inspection modal, Damage Report auto-routing, and Operational Billing requests. Hidden "+ Add Machine" button and disabled technical master spec inputs in `MachineModal.tsx` for Rental Managers.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**Verified system tables**).

- **Role 12 — Sales Manager / Sales Executive Role Implementation & Migration 028 (`028_sales_manager_role_refinements.sql`, `lib/auth/rbac.ts`, `lib/auth/scope.ts`, `lib/types/database.ts`, `lib/queries/sales.ts`, `app/actions/sales.ts`, `AppSidebar.tsx`, `CrmClient.tsx`, `app/(app)/crm/page.tsx`) (2026-08-18)**:
  - **Granular Permissions & Schema Migration (`028_sales_manager_role_refinements.sql`)**: Seeded 12 granular sales permissions (`sales.lead_manage`, `sales.customer_manage`, `sales.interaction_log`, `sales.opportunity_manage`, `sales.quotation_manage`, `sales.discount_approve`, `sales.order_manage`, `sales.order_approve`, `sales.machine_reserve`, `sales.delivery_coordinate`, `sales.handover_coordinate`, `sales.settings_manage`). Created 9 core sales tables (`sales_leads`, `sales_customers`, `sales_customer_interactions`, `sales_opportunities`, `sales_quotations`, `sales_orders`, `sales_machine_reservations`, `sales_delivery_coordinations`, `sales_settings`). Re-synced `public.role_permissions` mapping for `sales_executive`.
  - **Branch-Scoped Sales Engine (`lib/auth/scope.ts`, `lib/queries/sales.ts`)**: Confirmed `ROLE_DEFAULT_SCOPES.sales_executive = "BRANCH"`. Built DAL queries for sales dashboard metrics, lead pipeline, customer directory, interaction history, opportunities, multi-version quotations, sales orders, available machine catalog for sale, machine reservations, delivery coordinations, and sales settings.
  - **Server Action Guardrails & Sales Lifecycle Governance (`app/actions/sales.ts`)**: Added `createSalesLeadAction`, `updateSalesLeadAction`, `convertLeadAction` (lead $\rightarrow$ customer + opportunity), `createSalesCustomerAction`, `archiveSalesCustomerAction` (soft-delete enforcement preventing deletion of customers with transaction history), `logSalesInteractionAction`, `createSalesOpportunityAction`, `createSalesQuotationAction`, `reviseSalesQuotationAction` (multi-version tracking `V1` $\rightarrow$ `V2` without overwriting sent quotations per Rule 9), `createSalesOrderAction`, `reserveMachineForSalesAction` (reserves machine for confirmed order without physical dispatch), `requestSalesDeliveryAction` (delivery request to store/operations without physical stock-out), and `completeSalesHandoverAction` (uploads signed handover proof). Enforced discount approval threshold rules (0–5% auto-approved, > 5% requires manager approval).
  - **Hard Restrictions Enforced**: Restricted technical machine specification editing/hard deletion/physical dispatch, breakdown complaint assignment & FSR editing, physical inventory stock ledger/POs/challans, HR employee management & salary visibility, direct financial payment recording, user administration / RBAC permission modifications, branch creation/deletion, and platform security settings.
  - **UI Controls & 10-Tab Sales Management Suite Overhaul (`AppSidebar.tsx`, `CrmClient.tsx`, `app/(app)/crm/page.tsx`)**: Expanded `AppSidebar.tsx` CRM subItems to Dashboard, Leads, Customers, Interactions, Opportunities, Quotations, Sales Orders, Machine Sales, Delivery & Handover, Service Escalations, and Sales Settings. Overhauled `CrmClient.tsx` into a 10-tab Sales & CRM Management Suite featuring 14 KPI metric cards, Quick Sales Operations toolbar, Lead conversion wizard, soft-delete archive modal, interaction logger, pipeline stage deal tracking, versioned quotation builder with discount approval warning, sales order generator, machine reservation modal, and signed handover proof uploader.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**Verified system tables**).

- **Role 10 — HR Manager Role Implementation & Migration 026 (`026_hr_manager_role_refinements.sql`, `lib/auth/rbac.ts`, `lib/auth/scope.ts`, `lib/types/database.ts`, `lib/queries/hr.ts`, `app/actions/hr.ts`, `AppSidebar.tsx`, `HRClient.tsx`, `app/(app)/hr/page.tsx`, `app/(app)/dashboard/page.tsx`) (2026-08-18)**:
  - **Granular Permissions & Schema Migration (`026_hr_manager_role_refinements.sql`)**: Extended `public.employees` status CHECK constraint (`pending_onboarding`, `active`, `on_leave`, `notice_period`, `resigned`, `terminated`, `retired`, `inactive`, `archived`). Created `public.departments`, `public.designations`, `public.employee_salary_history`, `public.employee_documents`, and `public.user_account_requests` tables. Seeded permissions (`employee.onboard`, `employee.status_change`, `department.manage`, `designation.manage`, `user_request.create`, `user_request.view`, `employee.document.manage`, `employee.salary.create`, `employee.salary.edit`) and re-synced `public.role_permissions` mapping for `hr_manager`.
  - **Global / Branch HR Scoping (`lib/auth/scope.ts`, `lib/queries/hr.ts`)**: Confirmed `ROLE_DEFAULT_SCOPES.hr_manager = "ORGANIZATION"`. Built DAL queries for HR directory, dashboard metrics, department/designation master lists, salary history audit logs, document metadata, and employee account requests.
  - **Server Action Guardrails & Employee Lifecycle Governance (`app/actions/hr.ts`)**: Added `createEmployeeAction`, `updateEmployeeAction`, `changeEmployeeStatusAction`, `createSalaryRevisionAction`, `manageDepartmentAction`, `manageDesignationAction`, `requestUserAccountAction`, and `uploadEmployeeDocumentAction`. Enforced strict prohibition against hard deleting employees with historical data (`Active` $\rightarrow$ `Inactive` $\rightarrow$ `Archived`). Protected historical salary records from overwrites by appending auditable revision entries.
  - **Hard Restrictions Enforced**: Restricted machine creation/master spec editing/deletion/reassignment, breakdown complaint handling & service planning, physical inventory stock ledger & POs/challans, rental contracts, sales/CRM pipeline, general finance ledgers, direct user administration / RBAC permission modifications, branch creation/deletion, and platform infrastructure settings.
  - **UI Controls & HR Management Suite Overhaul (`AppSidebar.tsx`, `HRClient.tsx`, `app/(app)/hr/page.tsx`, `app/(app)/dashboard/page.tsx`)**: Expanded `AppSidebar.tsx` HR subItems to Dashboard, Employees, Onboarding, Departments, Designations, Salary & Payroll, User Requests, and Documents. Overhauled `HRClient.tsx` into a 7-tab HR Management Suite featuring 12 KPI metric cards, department/designation/branch workforce breakdown charts, profile edit modal, lifecycle status transition modal, salary revision modal with fixed/variable/CTC breakdown, department & designation master creation modals, user account request form, and document attachment repository.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**33/33 system tables verified**).

- **Role 9 — Store Manager Role Implementation & Migration 025 (`025_store_manager_role_refinements.sql`, `lib/auth/rbac.ts`, `lib/auth/scope.ts`, `app/actions/inventory.ts`, `app/actions/machines.ts`, `AppSidebar.tsx`, `MachineModal.tsx`) (2026-08-18)**:
  - **Granular Permissions & Migration (`025_store_manager_role_refinements.sql`)**: Seeded comprehensive inventory, procurement, PO, delivery challan, vendor, GRN, purchase return, and product archiving permissions. Re-synced `public.role_permissions` mapping for `store_manager`.
  - **Branch-Scoped Inventory Management (`lib/auth/scope.ts`, `lib/queries/*`)**: Maintained `ROLE_DEFAULT_SCOPES.store_manager = "BRANCH"`. Enforced branch scoping across DAL queries (`inventory.ts`, `purchase-orders.ts`, `challans.ts`).
  - **PO Approval Threshold & Workflow Governance (`app/actions/inventory.ts`)**: Implemented PO approval threshold logic: POs $\le ₹10,000$ are auto-approved upon creation by Store Manager; POs $> ₹10,000$ are flagged as `pending_approval` requiring higher manager (Branch Manager / Admin) authorization with automated notifications. Added `approvePurchaseOrderAction`.
  - **Product Archiving & Stock Adjustments (`app/actions/inventory.ts`)**: Added `archiveProductAction` to set products to `inactive` instead of hard deleting items with transaction history. Added `createStockAdjustmentAction` (`ADJUSTMENT`, `DAMAGE`, `LOSS`) and `createPurchaseReturnAction` for returning defective/damaged stock to suppliers.
  - **Hard Restrictions Enforced**: Restricted machine creation/master spec editing/deletion/reassignment, service schedule planning & FSR creation/approval, HR management & salary visibility, rental contract modification, sales/CRM pipeline, finance payment ledger editing, user administration, branch creation/deletion, and system security settings.
  - **UI Controls & Navigation (`AppSidebar.tsx`, `MachineModal.tsx`)**: Reconfigured `AppSidebar.tsx` navigation for Store Manager: enabled `/dashboard`, `/my-work`, `/machines` (view-only), `/inventory` (all 9 subItems), `/vendors`, `/purchase-orders`, `/challans`, `/documents`, and `/reports`. Hidden `/crm`, `/service`, `/hr`, and `/administration`. Disabled machine master specs editing in `MachineModal.tsx` for Store Manager.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**33/33 system tables verified**).

- **Role 8 — Operator Role Implementation & Migration 024 (`024_operator_role_refinements.sql`, `lib/auth/rbac.ts`, `lib/auth/scope.ts`, `lib/queries/machines.ts`, `lib/queries/complaints.ts`, `lib/queries/services.ts`, `app/actions/operators.ts`, `app/actions/complaints.ts`, `app/actions/inventory.ts`, `AppSidebar.tsx`, `OperatorDashboard.tsx`, `MachineModal.tsx`, `ComplaintsClient.tsx`, `FieldServiceReportModal.tsx`) (2026-08-18)**:
  - **Granular Permissions Migration (`024_operator_role_refinements.sql`)**: Extended `public.machine_hour_logs` table with `start_fuel_level`, `machine_condition`, and `status`. Seeded exact operator permissions (`operator.view`, `operator.log_create`, `operator.log_edit`, `machine.view`, `complaint.view`, `complaint.create`, `complaint.update`, `service.view`, `fsr.view`, `part_request.create`, `part_request.view`, `rental.view`, `notification.view`, `notification.send`, `report.view`, `audit.view`).
  - **Assigned Workload & Shift Scoping (`lib/auth/scope.ts`, `lib/queries/*`)**: Enforced `ROLE_DEFAULT_SCOPES.operator = "ASSIGNED"`. Scoped machines (`current_operator_id`), complaints (`supervisor_id`), services, and hour logs strictly to assigned operator.
  - **Hard Restrictions Enforced**: Restricted machine creation/master specs editing/deletion/reassignment, physical stock transactions & request approvals, HR directory & salary visibility, rental contracts, sales/finance, user administration, branch management, system settings, and complaint resolution/closure.
  - **Server Action Guardrails (`app/actions/*`)**: Enhanced `submitOperatorHourLogAction` with meter validation (`End >= Start`), fuel, shift, and condition tracking. Added `updateOperatorHourLogAction` allowing operators to edit and resubmit draft or rejected meter logs while blocking edits to approved logs. Blocked `operator` from assigning machines, closing complaints with FSR, or closing/resolving complaints directly. Allowed part request creation via `requireAnyPermission`.
  - **UI Navigation & Operator Dashboard Overhaul (`AppSidebar.tsx`, `OperatorDashboard.tsx`, `MachineModal.tsx`, `ComplaintsClient.tsx`, `FieldServiceReportModal.tsx`)**: Reconfigured `AppSidebar.tsx` navigation for Operator: enabled `/dashboard`, `/my-work`, `/machines`, `/service`, `/reports`, `/profile`, `/documents`, and filtered `/inventory` subItems to `Procurement` (Part Requests). Built feature-complete `OperatorDashboard.tsx` with Quick Actions (Start/End Shift, Enter Meter, Enter Fuel, Report Breakdown, Request Part, View Machine), 6 KPI metric cards, daily shift log form with anomaly warnings, recent meter logs history with self-correction modal ("Edit & Resubmit"), my reported breakdown complaints list, and my part requests tracking. Rendered read-only FSR view for operators.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**33/33 system tables verified**).

- **Role 7 — Mechanic Role Implementation & Migration 022 (`022_mechanic_role_refinements.sql`, `lib/auth/rbac.ts`, `lib/auth/scope.ts`, `lib/queries/services.ts`, `lib/queries/dashboard.ts`, `lib/queries/machines.ts`, `lib/queries/complaints.ts`, `lib/queries/notifications.ts`, `app/actions/complaints.ts`, `app/actions/machines.ts`, `AppSidebar.tsx`, `MachineModal.tsx`, `ComplaintsClient.tsx`, `FieldServiceReportModal.tsx`) (2026-08-18)**:
  - **Granular Permissions Migration (`022_mechanic_role_refinements.sql`)**: Seeded exact repair execution permissions for `mechanic` covering assigned machine view, breakdown complaint creation (`complaint.create`) & status updates, service job execution/completion, FSR repair detail entry, inventory view & part requests (`part_request.create`, `part_request.view`), operator/rental context viewing, personal notifications, and personal reports/audit activity.
  - **Assigned Workload Scoping (`lib/auth/scope.ts`, `lib/queries/*`)**: Enforced `ROLE_DEFAULT_SCOPES.mechanic = "ASSIGNED"`. Updated DAL queries (`services.ts`, `dashboard.ts`, `machines.ts`, `complaints.ts`, `notifications.ts`) to scope assigned machines, services, complaints, and alerts to assigned mechanic (`engineer_id = userId`).
  - **Hard Restrictions Enforced**: Restricted machine creation/master data editing/deletion/reassignment, physical stock transactions (`stock_in`, `stock_out`, `adjust`, `transfer`), part request approvals, HR/salary visibility, rental contract editing, sales/finance, user administration, branch management, system settings, and managerial FSR/service final approvals.
  - **Server Action Guardrails (`app/actions/*`)**: Added guardrail in `updateComplaintStatusAction` blocking mechanics from directly force-closing or resolving complaints without Service Manager review.
  - **UI Navigation & Component Controls (`AppSidebar.tsx`, `MachineModal.tsx`, `ComplaintsClient.tsx`, `FieldServiceReportModal.tsx`)**: Enabled `/reports` for mechanics. Filtered `/inventory` subItems for Mechanics to `Dashboard`, `Part Master`, and `Procurement` (Part Requests). Disabled machine master spec inputs in `MachineModal.tsx`. Enabled breakdown complaint creation in `ComplaintsClient.tsx`. Updated FSR submission button in `FieldServiceReportModal.tsx` to "Submit Repair Details" for Mechanic role.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**38/38 system tables verified, 34 users verified across all 13 roles including 5 mechanics**).

- **Role 6 — Supervisor Role Implementation & Migration 022 (`022_supervisor_role_refinements.sql`, `lib/auth/scope.ts`, `lib/auth/rbac.ts`, `lib/queries/machines.ts`, `lib/queries/dashboard.ts`, `app/actions/operators.ts`, `app/actions/complaints.ts`, `AppSidebar.tsx`, `OperationsClient.tsx`, `ComplaintsClient.tsx`, `FieldServiceReportModal.tsx`) (2026-08-18)**:
  - **Granular Permissions Migration (`022_supervisor_role_refinements.sql`)**: Extended `public.machine_hour_logs` with verification & fuel tracking columns (`verification_status`, `verified_by`, `verified_at`, `verification_remarks`, `fuel_consumed`, `shift`). Seeded exact field operational permissions for `supervisor` covering machine view & limited edit, breakdown complaint creation & observation updates, service view, FSR view, inventory view & breakdown part requests, operator log monitoring & verification (`operator.log_approve`), employee directory view, rental status view, notifications, and operational reports/audit logs.
  - **Branch-Scoped Monitoring (`lib/auth/scope.ts`, `lib/queries/*`)**: Enforced `ROLE_DEFAULT_SCOPES.supervisor = "BRANCH"`. Updated DAL queries (`machines.ts`, `dashboard.ts`, `hr.ts`) to scope machines, KPIs, charts, due lists, and staff strictly to the Supervisor's assigned branch.
  - **Hard Restrictions Enforced**: Restricted machine creation/deletion/technical specification editing/inter-branch reassignment, service schedule planning/assignment/official closure, FSR creation/editing/approval/rejection, physical stock transactions (stock in/out/adjust/transfer) and part request approval, HR employee creation/deletion/salary visibility, rental contract modification, sales/CRM, finance/billing, user administration, branch management, and system settings.
  - **UI & Navigation Controls (`AppSidebar.tsx`, `OperationsClient.tsx`, `ComplaintsClient.tsx`, `FieldServiceReportModal.tsx`, `MachineModal.tsx`)**: Enabled `/inventory` (filtered to Dashboard, Part Master, Procurement), `/hr` (filtered to Employees directory), and `/reports` sidebar routes. Enhanced `OperationsClient.tsx` with daily running hour log verification (Approve, Reject, Request Correction), anomaly detection badges, and operator reassignment requests. Hidden "+ Add Machine" button on `/machines`, disabled technical master specs editing in `MachineModal.tsx`, and updated active complaints action to "View Details" with read-only FSR view.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**38/38 system tables verified**).

- **Role 5 — Service Engineer Role Implementation & Migration 020 (`020_service_engineer_role_refinements.sql`, `lib/auth/scope.ts`, `lib/auth/rbac.ts`, `lib/queries/services.ts`, `lib/queries/dashboard.ts`, `lib/queries/machines.ts`, `lib/queries/notifications.ts`, `app/actions/complaints.ts`, `AppSidebar.tsx`) (2026-08-18)**:
  - **Granular Permissions Migration (`020_service_engineer_role_refinements.sql`)**: Seeded exact field execution permissions for `service_engineer` and `engineer` covering assigned machine view, breakdown complaint update/resolution request, service job execution/completion, FSR creation/editing before approval, inventory view & part requests, operator meter log viewing, personal notifications, and personal reports/audit activity.
  - **Assigned Workload Scoping (`lib/auth/scope.ts`, `lib/queries/*`)**: Enforced `ROLE_DEFAULT_SCOPES.service_engineer = "ASSIGNED"` and `ROLE_DEFAULT_SCOPES.engineer = "ASSIGNED"`. Updated DAL queries (`services.ts`, `dashboard.ts`, `machines.ts`, `notifications.ts`) to scope machines, services, complaints, FSRs, and alerts strictly to assigned engineer (`engineer_id = userId`).
  - **Hard Restrictions Enforced**: Restricted machine creation/editing/deletion/reassignment, service schedule planning for others, FSR self-approval/managerial approval, physical inventory stock in/out/adjustment/transfers, part request approval, HR employee management & salary visibility, rental contracts, sales/CRM, finance/billing, user administration, branch management, and system settings.
  - **UI & Navigation Controls (`AppSidebar.tsx`, `ServicesClient.tsx`, `FieldServiceReportModal.tsx`)**: Filtered `/inventory` subItems for Service Engineers to `Dashboard` (Store View), `Part Master`, and `Part Requests`. Maintained complete exclusion of restricted navigation routes (`/crm`, `/vendors`, `/purchase-orders`, `/challans`, `/hr`, `/administration`).
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**33/33 system tables verified**).

- **Role 4 — Service Manager Role Implementation & Migration 020 (`020_service_manager_role_refinements.sql`, `lib/auth/rbac.ts`, `app/actions/machines.ts`, `app/(app)/hr/page.tsx`, `AppSidebar.tsx`, `MachineListClient.tsx`, `MachineModal.tsx`, `ComplaintsClient.tsx`, `FieldServiceReportModal.tsx`) (2026-08-18)**:
  - **Granular Permissions Migration (`020_service_manager_role_refinements.sql`)**: Seeded exact permissions for `service_manager` covering machine view & service edit, breakdown complaints full lifecycle (create, assign engineer/mechanic, update status, escalate, close), service planning & execution full lifecycle (create, plan, assign, reschedule, cancel, complete, approve), FSR review & approval, inventory view & part requests (create request, approve service requirement, escalate), service staff directory supervision, operator/rental view, service notifications, and service reports/audit logs.
  - **Hard Restrictions Enforced**: Restricted machine creation (`machine.create`), machine hard-deletion (`machine.delete`), changing machine ownership/serial numbers/engine numbers, inter-branch machine moves, physical stock transactions (`stock_in`, `stock_out`, `adjust`), HR employee creation/editing/deletion, salary/payroll visibility, direct FSR field overwriting, user account administration, branch configuration, sales/finance operational access, and system settings.
  - **Server Action Guardrails (`app/actions/*`)**: Removed `service_manager` from `createMachine` role check in `app/actions/machines.ts`. Enforced branch scoping filter in `app/(app)/hr/page.tsx`.
  - **UI Navigation & Component Controls (`AppSidebar.tsx`, `MachineListClient.tsx`, `MachineModal.tsx`, `ComplaintsClient.tsx`, `FieldServiceReportModal.tsx`)**: Enabled `/hr` sidebar route for Service Manager with subItems filtered to Employees directory only. Hidden "+ Add Machine" button on `/machines`. Disabled machine master specs editing in `MachineModal.tsx` for Service Manager. Enabled breakdown complaint raising in `ComplaintsClient.tsx`. Enabled FSR review ("Approve FSR" and "Send Back for Revision") in `FieldServiceReportModal.tsx`.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**38/38 system tables verified**).

- **Role 2 — Admin Role Implementation & Migration 019 (`019_admin_role_refinements.sql`, `lib/auth/rbac.ts`, `app/actions/branches.ts`, `app/actions/machines.ts`, `app/actions/users.ts`, `BranchesClient.tsx`, `AdminClient.tsx`, `UserCreateModal.tsx`, `UserEditModal.tsx`) (2026-08-18)**:
  - **Granular Permissions Migration (`019_admin_role_refinements.sql`)**: Seeded exact operational permissions for `admin` covering machines view/create/edit/assign, complaints full management, service planning/jobs/FSR full administrative management, inventory & part requests, HR directory supervision, rental contracts operational management, sales view/customer management, operator meter log approval, notifications view/send, user account management, operational branch editing, and operational reports/audit logs.
  - **Governance & Hard Restrictions Enforced**: Restricted machine hard deletion (requires `super_admin`), branch creation (requires `super_admin`), branch hard deletion, financial invoice creation/payment recording (owned by `finance_manager` & `super_admin`), platform security secrets/RLS configuration, and Super Admin user account creation, editing, or deletion.
  - **Server Action Guardrails (`app/actions/*`)**: Restricted `createBranchAction` and `deleteMachine` to `super_admin`. Added `updateBranchAction` and `deactivateBranchAction` for Admin operational branch maintenance. Enforced Super Admin immunity in `users.ts`.
  - **UI & Navigation Controls (`BranchesClient.tsx`, `AdminClient.tsx`, `UserCreateModal.tsx`, `UserEditModal.tsx`)**: Hidden "+ Add Branch" button for Admin. Enabled "Edit Operational Info" modal button on branch cards. Hidden `Super Admin` role option in user modals for Admin. Visually distinguished Operational Settings from Super Admin Governance Settings in `AdminClient.tsx`.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**33/33 system tables verified**).

- **Role 1 — Super Admin Role Implementation & Migration 019 (`019_super_admin_role_refinements.sql`, `lib/auth/rbac.ts`, `lib/auth/scope.ts`, `lib/dal.ts`, `app/actions/users.ts`, `AppSidebar.tsx`, `AuditLogsClient.tsx`) (2026-08-18)**:
  - **Granular Permissions Migration (`019_super_admin_role_refinements.sql`)**: Seeded operator log (`operator.view`, `operator.assign`, `operator.log_approve`), notification channels (`notification.view`, `notification.configure`, `notification.send`), and branch deletion (`branch.delete`) permissions. Assigned EVERY system permission in `public.permissions` to `super_admin` in `public.role_permissions`.
  - **Global Scope Enforcement (`lib/auth/scope.ts`, `lib/dal.ts`)**: Confirmed `ROLE_DEFAULT_SCOPES.super_admin = "ORGANIZATION"` and `getUserBranchIds()` returns `null` for Super Admin, granting unrestricted global access across all branches and modules.
  - **Immutable Audit Logs**: Implemented database-level RLS policy & trigger `trg_prevent_audit_log_modification` preventing any UPDATE or DELETE operations on `public.audit_logs`. Maintained full view, filter, and export capabilities in `AuditLogsClient.tsx`.
  - **Full System Governance (`app/actions/users.ts`, `AppSidebar.tsx`)**: Granted Super Admin full capability to manage users of any role (including Super Admin), assign roles, reset passwords, lock/unlock accounts, configure branches, and navigate all 13 sidebar modules (`Dashboard`, `My Work`, `CRM`, `Machines`, `Service`, `Inventory`, `Vendors`, `Purchase Orders`, `Challans`, `Documents`, `HR` including Payroll, `Reports`, `Administration`).
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**38/38 system tables verified**).

- **Role 3 — Branch Manager Role Implementation & Migration 018 (`018_branch_manager_role_refinements.sql`, `lib/auth/rbac.ts`, `lib/queries/machines.ts`, `lib/queries/dashboard.ts`, `lib/queries/hr.ts`, `app/actions/machines.ts`, `AppSidebar.tsx`, `HRClient.tsx`, `MachineListClient.tsx`, `FieldServiceReportModal.tsx`) (2026-08-18)**:
  - **Granular Permissions Migration (`018_branch_manager_role_refinements.sql`)**: Seeded exact permissions for `branch_manager` covering machine view/create/edit/assign, complaint full management, service planning/jobs, FSR review, inventory requests/transfer approvals, employee directory supervision, rental/sales/finance view-only, user branch view, branch operational info, and operational reports/audit logs.
  - **Hard Restrictions Enforced**: Strictly restricted machine hard-deletion, physical stock in/out/adjustment, HR employee creation/editing/deletion, salary/payroll visibility, direct FSR creation/editing, user account creation, RBAC role assignment, branch creation/deletion, and system settings access.
  - **DAL Branch Scoping (`lib/queries/*`)**: Enforced branch scoping on `getMachines()`, `getDashboardKpis()`, `getDashboardCharts()`, `getDashboardDueLists()`, and `getEmployeeDirectory()` using `user.branch_id`.
  - **Server Action Guardrails (`app/actions/*`)**: Automated `branch_id = user.branch_id` assignment on `createMachine` for Branch Managers. Replaced machine hard deletion with `requestMachineDeactivation`.
  - **UI & Navigation Controls (`AppSidebar.tsx`, `HRClient.tsx`, `MachineListClient.tsx`, `FieldServiceReportModal.tsx`)**: Hidden Payroll sub-item under `/hr` and blocked `/administration`. Hidden Onboard Employee button and salary/bank columns in HR directory. Enabled FSR review & approval buttons for Branch Managers while preventing direct editing of engineer fields.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**) and `node supabase/verify_seed.mjs` (**38/38 system tables verified**).

- **Comprehensive 13-Role RBAC System Implementation & Supabase Migration 017 (`lib/types/database.ts`, `lib/auth/rbac.ts`, `lib/auth/scope.ts`, `017_comprehensive_13_roles_rbac.sql`, `AppSidebar.tsx`, `MobileBottomNav.tsx`, `PublicNavbar.tsx`, `signup/page.tsx`, `UserCreateModal.tsx`, `UserEditModal.tsx`, `UserRow.tsx`, `UserDetailSheet.tsx`) (2026-08-17)**:
  - **13 Operational Roles**: Formally implemented 13 roles (`super_admin`, `admin`, `branch_manager`, `service_manager`, `service_engineer`, `supervisor`, `mechanic`, `operator`, `store_manager`, `hr_manager`, `rental_manager`, `sales_executive`, `finance_manager`) + `engineer` alias across database, DAL, auth middleware, and UI components.
  - **Central Permission Matrix**: Built resource-action matrix in `lib/auth/rbac.ts` supporting normalized dot/colon permissions (`machine.view`, `machine:read`, `service.plan`, `fsr.review`, `inventory.stock_in`, `employee.salary.view` / `hr:read_salary`, `rental.create`, `sales.quotation`, `finance.invoice`, `user.assign_role`).
  - **Supabase Migration & RLS**: Created migration `017_comprehensive_13_roles_rbac.sql` seeding roles/permissions, check constraints, and `auth_user_has_branch_access()` RLS security.
  - **Seeding Engine**: Updated `seed_dummy_data.mjs` provisioning test auth accounts for all 13 roles (`Password@123456`).
  - **UI Navigation & Action Control**: Reconfigured `AppSidebar.tsx` navigation matrix and `MobileBottomNav.tsx`, updated signup role options in `signup/page.tsx`, and updated admin user management modals/rows/sheets.
  - **Verification**: Executed `npx tsc --noEmit` (**0 errors**), `node supabase/seed_dummy_data.mjs` (**Success**), and `node supabase/verify_seed.mjs` (**29 users verified across all 13 roles**).

- **Page Feedback: Remove Rounded Subheader Container on `/inventory?tab=transactions` (`components/inventory/StockLedgerClient.tsx`) (2026-08-16)**:
  - **Subheader Container Removal**: Removed the top flex subheader banner card container (`<div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex items-center justify-between">`), title text (`Complete Inventory Transaction Ledger`), description paragraph (`Immutable audit ledger tracking every stock-in, stock-out, purchase receipt, and return`), and total transactions badge from the Stock Ledger Audit History tab view per user feedback.
  - **Unused Import Cleanup**: Removed unused `AnimatedHistory` import.
  - **Verification**: Executed `npx tsc --noEmit` with **0 TypeScript compilation errors**.

- **Page Feedback: Remove Rounded Subheader Container on `/inventory?tab=returns` (`components/inventory/StockLedgerClient.tsx`) (2026-08-16)**:
  - **Subheader Container Removal**: Removed the top flex subheader banner card container (`<div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2">`), title text (`Returnable Parts & Overdue Tracking`), icon (`RotateCcw`), and description paragraph (`Track returnable tools, seal kits, and components issued to technicians.`) from the Returnable Parts tab view per user feedback.
  - **Verification**: Executed `npx tsc --noEmit` with **0 TypeScript compilation errors**.

- **Page Feedback: Remove Rounded Subheader Container on `/inventory?tab=transfers` (`components/inventory/StockLedgerClient.tsx`) (2026-08-16)**:
  - **Subheader Container Removal**: Removed the top flex subheader banner card container (`<div className="p-4 rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2">`), title text (`Inter-Branch Stock Transfers`), icon (`AnimatedRefresh`), and description paragraph (`Transfer parts between company branches with dual-branch confirmation.`) from the Inter-Branch Transfers tab view per user feedback.
  - **Verification**: Executed `npx tsc --noEmit` with **0 TypeScript compilation errors**.

- **Page Feedback: Clean Up `/inventory?tab=issues` Subheader & Top Bar Icon (`components/inventory/StockLedgerClient.tsx`) (2026-08-16)**:
  - **Removed Redundant Subheader Flex Card**: Removed the subheader flex card banner container (`<div className="flex items-center justify-between p-4 ...">`), including the description paragraph (`Parts issued to machines, breakdown complaints, or technicians with auto-generated Challans`), the `AnimatedWrench` title icon, and the duplicate `+ Issue Parts` action button.
  - **Header Icon Box Removal**: Removed the `p-1.5` rounded icon wrapper (`<div className="p-1.5 rounded-lg bg-sky-500/10 ...">`) and `ActiveTabIcon` from the top single-line page header bar, keeping the header clean and aligned with `Inventory / <TabName>`.
  - **Verification**: Executed `npx tsc --noEmit` with **0 TypeScript compilation errors**.

- **Fix StockLedgerClient Prev/Next Pagination Button Theme Visibility (`components/inventory/StockLedgerClient.tsx`) (2026-08-16)**:
  - **High-Contrast Theme Tokens**: Applied explicit `text-[var(--color-ink)]` text color and `bg-[var(--color-canvas-elevated)]` background styling to Prev and Next buttons, removing inherited text muting (`text-[var(--color-mute)]`).
  - **Lucide Icons Integration**: Added `<ChevronLeft className="h-3.5 w-3.5" />` to the `Prev` button and `<ChevronRight className="h-3.5 w-3.5" />` to the `Next` button for visual clarity and accessibility.
  - **Tactile Micro-Interactions**: Applied `hover:bg-[var(--color-hairline-soft-surface)]`, `active:scale-95`, `disabled:opacity-40 disabled:cursor-not-allowed`, and `shadow-xs` to improve button tactile feedback.
  - **Rows Per Page & Page Badge Styling**: Updated the rows per page `<select>` dropdown and `{safePage} / {totalPages}` badge with `rounded-lg`, explicit borders (`border-[var(--color-hairline)]`), and elevated canvas background styling.
  - **Verification**: Executed `npx tsc --noEmit` with **0 TypeScript compilation errors**.

- **Add Manufacturer Column to Database & Part Master Catalog UI (`components/inventory/StockLedgerClient.tsx`, `components/inventory/PartDetailModal.tsx`, `supabase/migrations/016_add_manufacturer_to_inventory.sql`, `supabase/migrations/015_seed_dummy_data.sql`, `supabase/seed_dummy_data.mjs`) (2026-08-16)**:
  - **SQL Migration & Backfill (`016_add_manufacturer_to_inventory.sql`)**: Created migration script ensuring `manufacturer` column exists on `public.inventory_products` and backfilling existing items with realistic manufacturers (`JCB`, `Hyundai`, `Caterpillar`, `Volvo`, `Komatsu`).
  - **Seed Data Updates (`015_seed_dummy_data.sql`, `seed_dummy_data.mjs`)**: Updated SQL seed script and Node.js seeding script to include explicit manufacturer properties (`JCB`, `Hyundai`, `Caterpillar`, `Hyundai`, `JCB`).
  - **Part Master Table UI (`StockLedgerClient.tsx`)**: Added sortable `Manufacturer` header column and styled brand badges (amber for JCB, sky for Hyundai, yellow for Caterpillar, blue for Volvo, purple for Komatsu) in table rows.
  - **Toolbar Manufacturer Filter (`StockLedgerClient.tsx`)**: Integrated Manufacturer filter dropdown (`All Manufacturers`, `JCB`, `Hyundai`, `Caterpillar`, `Volvo`, `Komatsu`, `Genie`, `JLG`, `Haulotte`, `Mahindra`, `Tata`) alongside Category, Rack, and Stock Status filters with instant reset.
  - **Search & Sort Integration (`StockLedgerClient.tsx`)**: Included `manufacturer` in search text matching, column sorting logic (`handleSort("manufacturer")`), Add Part form modal (`showAddPartModal`), and CSV export headers/rows (`handleBulkExportCSV`).
  - **Part Specs Highlight (`PartDetailModal.tsx`)**: Prominently displayed Manufacturer in the Technical Specifications card.
  - **Verification**: Executed `npx tsc --noEmit` with **0 TypeScript compilation errors**.

- **Theme Toggle Switch Micro-Animation Fix (`components/theme/ThemeToggle.tsx`, `app/globals.css`)**:
  - **Eliminated CSS Transition Conflict**: Removed Tailwind `transition-all duration-200` class from the sliding thumb `<motion.div>`, resolving the conflict between CSS transitions and Framer Motion spring calculations (`stiffness: 500, damping: 28, mass: 0.7`).
  - **Parallel Icon Morphing**: Replaced `<AnimatePresence mode="wait">` with `mode="popLayout"` to perform Sun and Moon icon exit and entrance transitions simultaneously without a 150ms sequential delay.
  - **Exempted Theme Controls from Transition Lock**: Added `data-theme-toggle="true"` attributes to theme toggle elements and exempted them from the global `html.theme-changing` transition lock CSS rule in `app/globals.css`.
  - **Verification**: Verified 0 TypeScript compilation errors (`npx tsc --noEmit`).

- **Sidebar Logo Graphic Icon Integration & Arrow Removal (`components/branding/ReachInternationalLogo.tsx`, `components/branding/ScissorLiftLogoIcon.tsx`)**:
  - **Scissor-Lift Icon Integration**: Updated `showIcon` default prop from `false` to `true` in `ReachInternationalLogo`, displaying the vector scissor-lift graphic icon (`<ScissorLiftLogoIcon>`) in front of the logo across the sidebar header, navbar, and auth pages.
  - **Arrow Icon Removal**: Removed the text arrow element (`↑`) from the `REACH INTERNATIONAL` logo title row and updated compact fallback tag from `RI↑` to `RI`.
  - **Verification**: Verified 0 TypeScript compilation errors (`npx tsc --noEmit`).

- **Synchronous & Atomic Global Theme Switching Architecture (`app/globals.css`, `components/theme/ThemeProvider.tsx`, `app/layout.tsx`, `components/ui/sidebar.tsx`, `components/layout/AppHeader.tsx`, `SearchableSelect.tsx`, `MetricCard.tsx`)**:
  - **Atomic Global Transition Lock (`app/globals.css`, `ThemeProvider.tsx`)**: Created `html.theme-changing` transition lock CSS rule (`transition: none !important; animation: none !important;`) applied synchronously during theme toggles. Utilized double `requestAnimationFrame` to remove the lock after the browser repaints all CSS custom properties in a single frame (0ms delay across all components).
  - **Removal of Lagging Color Transitions (`app/globals.css`, `app/layout.tsx`, `components/ui/sidebar.tsx`)**: Removed `transition: background-color ..., color ...` from `body` and `transition-colors duration-200` from `AppSidebar` container and layout shell, eliminating millisecond delays where background/sidebar colors lagged behind text and cards.
  - **View Transitions Overhead Elimination**: Removed `document.startViewTransition` snapshot crossfading from `ThemeProvider.tsx`, enforcing an instant, 100% synchronous DOM theme recalculation.
  - **Targeted Micro-Interactions**: Scoped component transitions (`SearchableSelect.tsx`, `AppHeader.tsx`, `MetricCard.tsx`) to specific properties (`transition-[border-color,box-shadow]`, `transition-transform`) while preserving `ThemeToggle` spring physics and sidebar collapse layout animations.
  - **Verification**: Verified 0 TypeScript compilation errors (`npx tsc --noEmit`).

- **Duplicate Error Removal & 10-Digit Mobile Number Validation (`app/actions/auth.ts`, `app/signup/page.tsx`, `app/login/login-form.tsx`, `app/forgot-password/page.tsx`)**:
  - **Eliminated Duplicate Error Display**: Suppressed top pink error alert container when field-level errors (`fieldErrors`) are present on input fields.
  - **Strict 10-Digit Mobile Validation**: Updated `signup` action in `app/actions/auth.ts` to validate mobile phone numbers for a valid 10-digit number.
  - **Verification**: Verified 0 TypeScript compilation errors (`npx tsc --noEmit`).

- **Auth Form Data Retention & Invalid Field Cell Highlighting (`app/actions/auth.ts`, `components/ui/Input.tsx`, `components/ui/SearchableSelect.tsx`, `app/signup/page.tsx`, `app/login/login-form.tsx`, `app/forgot-password/page.tsx`)**:
  - **Data Retention Contract**: Updated `signup`, `login`, and `forgotPassword` server actions in `app/actions/auth.ts` to return field-specific error mappings (`fieldErrors`) and field value data (`fieldValues`).
  - **Red Cell Error Styling**: Enhanced `<Input />` and `<SearchableSelect />` to highlight invalid input cells in red (`!border-rose-500`, `!bg-rose-500/5`, focus ring, red icon, and inline error text).
  - **Form Data Preservation**: Converted Sign Up, Sign In, and Reset Password form components to controlled inputs, preserving all user-typed data on error.
  - **Dynamic Error Clearing**: Clears red error cell highlights dynamically on user input change.
  - **Verification**: Verified 0 TypeScript compilation errors (`npx tsc --noEmit`).

- **Signup Page Layout & Auth Form Controls Polish (`app/signup/page.tsx`, `app/login/page.tsx`, `app/login/login-form.tsx`, `app/forgot-password/page.tsx`)**:
  - **Signup Half-Screen Card Layout**: Expanded signup form card (`motion.div`) in `app/signup/page.tsx` from `max-w-md` (448px) to `w-full max-w-xl lg:max-w-2xl xl:max-w-3xl`, filling the right half-screen panel on desktop viewports.
  - **2-Column Input Grid for Signup**: Arranged all signup input fields (Full Name, Email address, Mobile Number, Account Role Requested, Password, Confirm Password) into a responsive 2-column grid (`grid grid-cols-1 md:grid-cols-2 gap-4`).
  - **1-Column Input for Sign In (Login)**: Maintained 1-column input layout (`flex flex-col gap-4`) for Login form (`app/login/login-form.tsx`) inside a sleek `max-w-md` card container.
  - **Responsive Home & Theme Toggle Controls**: Updated top right floating controls to display Home button (`Link href="/"`) and `ThemeToggle` switch clearly on all viewports for `/signup`, `/login`, and `/forgot-password`.
  - **Verification**: Verified 0 TypeScript compilation errors (`npx tsc --noEmit`).


- **Full Database Migration Audit & Comprehensive Dummy Data Seeding (`supabase/migrations/015_seed_dummy_data.sql`, `supabase/seed_dummy_data.mjs`, `supabase/verify_seed.mjs`)**:
  - **Migration Audit & Schema Mapping**: Inspected all 14 database migration files (`001` through `014`) and cataloged all 38 system tables.
  - **Master SQL Migration File (`015_seed_dummy_data.sql`)**: Created idempotent SQL seed file with `INSERT ... ON CONFLICT DO NOTHING` statements for branches, manufacturers, categories, vendors, inventory master, and system settings.
  - **Node.js Automated Seed Engine (`supabase/seed_dummy_data.mjs`)**: Created automated Node.js seed script utilizing `@supabase/supabase-js` service role client. Provisioned auth test accounts across all 11 system roles (`Password@123456`), updated profile records, linked user branches, and seeded relational domain records across all 38 tables.
  - **Table Verification Engine (`supabase/verify_seed.mjs`)**: Built table verification engine confirming non-zero row counts across all 38 system tables.
  - **Verification**: Executed `node supabase/seed_dummy_data.mjs` (0 errors), `node supabase/verify_seed.mjs` (38/38 tables verified), and `npx tsc --noEmit` (0 TypeScript compilation errors).


- **Multi-Role Signup Access Approval & Multi-Domain Email Support (`app/signup/page.tsx`, `app/actions/auth.ts`, `app/actions/users.ts`, `UserCreateModal.tsx`, `lib/email.ts`)**:
  - **Signup Role Selector**: Integrated `SearchableSelect` on `app/signup/page.tsx` enabling every role (`Service Engineer`, `Branch Manager`, `Store Manager`, `Supervisor`, `Operator`, `Mechanic`, `HR Manager`, `Accounts / Finance Manager`, `Sales Executive`, `Rental Manager`, `Client Account`, `Administrator`) to send access approval requests.
  - **Dynamic Signup Action**: Updated `signup` action in `app/actions/auth.ts` to parse `role`, validate against allowed roles, store it in user metadata, and record it in audit logs.
  - **Admin Approval Notification**: Updated `sendPendingApprovalEmailToAdmins` in `lib/email.ts` to display the requested role in email notifications sent to admins.
  - **Multi-Domain Email Validation**: Removed hardcoded `@gmail.com` restriction in `app/actions/users.ts` (`createUser`) and updated `app/actions/auth.ts` with standard email regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`, supporting `@gmail.com`, `@yahoo.com`, `@customdomain.in`, and corporate custom domain emails. Updated input label and placeholder in `UserCreateModal.tsx`.
  - **Verification**: Verified 0 TypeScript compilation errors (`npx tsc --noEmit`).

- **Inventory Header UI/UX Optimization & Submenu Sidebar Migration (`components/inventory/StockLedgerClient.tsx`, `components/layout/AppSidebar.tsx`)**:
  - **Submenu Migration to Sidebar**: Shifted inventory sub-navigation tabs to sidebar navigation and removed on-page horizontal tab bar element from `StockLedgerClient.tsx`. Added `Transfers` to `AppSidebar.tsx` inventory subItems so all 9 inventory modules (`Dashboard`, `Part Master`, `Storage & Bins`, `Procurement`, `Goods Receipt (GRN)`, `Part Issues`, `Returnable Parts`, `Stock Ledger`, `Transfers`) are accessed directly via sidebar.
  - **Description Paragraph Removal**: Removed generic sub-header description text (`Manage parts catalog, stock levels, and storage locations`) per page feedback.
  - **Clean Single-Line Header Bar**: Restructured header bar into a clean, single-line flex row (`flex-nowrap` on desktop) with dynamic icon and tab title mapping (`TAB_CONFIG`), breadcrumb (`Inventory / <TabTitle>`), and action buttons (`+ Add Part`, `Receive GRN`, `Issue Part`, `Request Order`).
  - **URL Parameter Synchronization**: Wired `handleTabChange` with `window.history.pushState` so clicking alert cards updates URL search parameters and synchronizes active sidebar highlights automatically.
  - **Verification**: Verified 0 TypeScript compilation errors (`npx tsc --noEmit`).


- **Sidebar Brand Logo Graphic Removal & Font Size Unification (`components/branding/ReachInternationalLogo.tsx`)**:
  - **Graphic Icon Removal**: Removed `<ScissorLiftLogoIcon>` by default from `ReachInternationalLogo` in the sidebar header per page feedback. Added optional `showIcon` boolean prop (defaulting to `false`).
  - **Identical Font Size**: Standardized font sizes for "REACH" and "INTERNATIONAL" to be identical (`text-[0.85em]`), fixing the visual size discrepancy between the two words.
  - **Compact Sidebar Fit**: Adjusted text size and tracking to ensure `REACH INTERNATIONAL ↑` fits cleanly inside the sidebar container without wrapping or horizontal overflow.
  - **Verification**: Verified 0 TypeScript compilation errors (`npx tsc --noEmit`).
- **Inventory Part Master UI/UX Overhaul & Daily Store Operator Focus (`components/inventory/StockLedgerClient.tsx`)**:
  - **Compact Page Header & Hierarchy**: Replaced oversized title block and description paragraph with a compact page header (`Part Master`, 18-22px) and `Inventory / Part Master` breadcrumb. Established explicit button hierarchy (`+ Add Part` primary, `Receive GRN` & `Issue Part` secondary, `Request Order` tertiary).
  - **Compact Navigation & 4-Stat Summary Strip**: Shortened tab text labels (`Dashboard`, `Parts (5)`, `Storage`, `Procurement`, `GRN`, `Issuance`, `Returns`, `Audit Ledger`, `Transfers`). Added compact inventory summary strip (`Total Parts`, `In Stock`, `Low Stock`, `Out of Stock`) with 1-click status filtering.
  - **Stock Status Filtering & Multi-Column Sorting**: Integrated Stock Status filter (`All Stock`, `In Stock`, `Low Stock`, `Out of Stock`) with quick filter reset. Added interactive table column sorting (Part Number, Part Name, Available Stock, Unit Cost) with `↑` / `↓` indicators.
  - **Table Polish, Row Interactivity & Bulk Operations**: Prominent stock quantity highlights (`101 pcs`, `12 pcs`, `0 pcs`). Compact status pills with colored status dots (🟢 In Stock, 🟡 Low Stock, 🔴 Out of Stock). Wrapped action buttons with tooltips and enabled full-row click to open Part Details modal. Integrated bulk selection checkboxes with bulk action bar (`Relocate Location`, `Request Order`, `Export CSV`, `Deselect`). Added pagination controls (`Showing 1–25 of 128 parts`, `Rows per page: 25`, Prev/Next).
  - **Verification**: Verified 0 TypeScript errors (`npx tsc --noEmit`) and successful production build (`npm run build`, 30/30 static & dynamic routes compiled).
- **Sidebar Optimization, Collapse/Expand & Portal Navigation System (`components/layout/AppSidebar.tsx`, `components/layout/sidebar/*`)**:
  - **React Portal Flyout System (`CollapsedFlyoutPortal.tsx`)**: Created `CollapsedFlyoutPortal` component rendering floating sub-menu flyouts onto `document.body` via `createPortal`. Completely eliminates container `overflow: hidden` clipping while dynamically positioning flyouts relative to clicked sidebar icons and clamping top/bottom positions inside the screen viewport.
  - **Modular Architecture Refactoring (`components/layout/sidebar/`)**: Deconstructed `AppSidebar.tsx` into clean modular components: `types.ts`, `SidebarHeader.tsx` (brand logo with hover collapse/expand morph), `QuickAccessTrigger.tsx` (quick search ⌘K trigger button/icon), `SidebarNavigation.tsx` (route-aware active hierarchy and sub-menu state management), `NavigationItem.tsx` (collapsible expanded menu vs portal flyout trigger), `UserProfileDropdown.tsx` (bottom profile card with portal popover), and `MobileSidebarDrawer.tsx` (off-canvas drawer with backdrop overlay for screens <768px).
  - **State Preservation & Active Hierarchy**: Preserved accordion expansion state (`openMenus`) across collapse/expand transitions. Highlighted active parent icons when sub-routes are active.
  - **Verification**: Verified 0 TypeScript errors (`npx tsc --noEmit`) and successful production build (`npm run build`, 30/30 static & dynamic routes compiled).
- **Delivery Challans DAL Query & Schema Alignment Fix (`lib/queries/challans.ts`, `supabase/migrations/014_store_manager_inventory_erp.sql`)**:
  - **Column Alignment**: Updated `getCachedDeliveryChallans` in `lib/queries/challans.ts` to query existing columns (`to_customer_name`, `to_address`, `approx_value`, `status`, `issue_date`, `created_at`) with fallback mapping for `client_name`, `destination`, `amount`, and `expected_delivery`, eliminating Postgrest `PGRST204` schema cache errors.
  - **Explicit Error Logging**: Upgraded console error handler to print `error.message || error.details || JSON.stringify(error)` instead of logging empty `{}` objects.
  - **Database Migration Schema Expansion (`014_store_manager_inventory_erp.sql`)**: Added `client_name`, `destination`, `amount`, and `expected_delivery` column alter statements to `public.challans` table for bi-directional compatibility.
  - **Verification**: Verified 0 TypeScript errors (`npx tsc --noEmit`).
- **Global Tooltip System Audit & Implementation (`components/ui/Tooltip.tsx`, `@radix-ui/react-tooltip`, `app/layout.tsx`, `AppHeader.tsx`, `AppSidebar.tsx`, `ThemeToggle.tsx`, `StockLedgerClient.tsx`, `MachineListClient.tsx`, `MachineRow.tsx`, `ChallansClient.tsx`, `DocumentsClient.tsx`, `CrmClient.tsx`, `VendorsClient.tsx`, `UserRow.tsx`, `EnterpriseTable.tsx`)**:
  - **Canonical Tooltip System (`components/ui/Tooltip.tsx`)**: Built unified Radix Tooltip suite (`TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipWrapper`, `InfoTooltip`, `MetricTooltip`, `SidebarTooltip`, `TruncatedTooltip`) with GPU-accelerated Framer Motion transitions and light/dark theme token integration.
  - **Application Provider (`app/layout.tsx`)**: Wrapped root providers with `<TooltipProvider delayDuration={200}>`.
  - **Header & Navigation Controls (`AppHeader.tsx`, `AppSidebar.tsx`, `ThemeToggle.tsx`)**: Upgraded collapsed navigation items, quick search (`⌘K`), theme toggle ("Switch to dark mode" ↔ "Switch to light mode"), notification bells, and sidebar collapse buttons with accessible tooltips without redundant browser `title` attributes.
  - **Data Tables & Action Columns (`StockLedgerClient.tsx`, `MachineListClient.tsx`, `MachineRow.tsx`, `ChallansClient.tsx`, `DocumentsClient.tsx`, `CrmClient.tsx`, `VendorsClient.tsx`, `UserRow.tsx`, `EnterpriseTable.tsx`)**: Added entity-specific tooltips for View part details, Relocate rack/bin, View delivery details, Download printable PDF challan, View document, Download document, Close details, More actions, and dynamic `CopyCell` ("Copy SKU" ↔ "Copied!").
  - **Verification**: Verified 0 TypeScript errors (`npx tsc --noEmit`) and successful production build (`npm run build`, 30/30 static & dynamic routes compiled).
- **Store Manager Complete Inventory, Procurement & Parts Management ERP Module (`supabase/migrations/014_store_manager_inventory_erp.sql`, `lib/types/database.ts`, `lib/queries/inventory.ts`, `app/actions/inventory.ts`, `components/inventory/*`, `app/(app)/inventory/page.tsx`, `app/(app)/dashboard/page.tsx`, `AppSidebar.tsx`)**:
  - **Database Migration (`014_store_manager_inventory_erp.sql`)**: Self-contained idempotent migration script including `CREATE TABLE IF NOT EXISTS` definitions for `public.vendors`, `public.purchase_orders`, and `public.challans` alongside extending `inventory_products` (OEM part no, alternate part no, barcode, reorder level, reorder qty, max stock, reserved stock, unit cost, last purchase price, rack, shelf, bin, zone, compatible machines/models, criticality, part type) and creating `inventory_storage_locations`, `inventory_purchase_requests`, `inventory_purchase_request_items`, `inventory_purchase_order_items`, `inventory_goods_receipts`, `inventory_goods_receipt_items`, `inventory_part_issues`, `inventory_part_issue_items`, `inventory_part_returns`, `inventory_part_return_items`, `inventory_delivery_challan_items` with full RLS policies and performance indexes.
  - **Data Access Layer (`lib/queries/inventory.ts`, `lib/types/database.ts`)**: Built cached DAL query functions (`getStoreManagerDashboardMetrics`, `getPartMasterList`, `getStorageLocations`, `getPurchaseRequests`, `getGoodsReceipts`, `getPartIssues`, `getPartReturns`, `getManagersList`) and extended database types.
  - **Atomic Server Actions (`app/actions/inventory.ts`)**: Implemented server actions for Part Master management, Storage location relocation, Purchase Requests with specific selected manager routing (`requested_by` -> `sent_to_manager_id`) and in-app notifications, Manager approvals/rejections, Purchase Orders (`PO-2026-XXXX`), Goods Receipts (`GRN-2026-XXXX`) with supplier bill PDF uploads and atomic stock increments, Part Issuance (`PI-2026-XXXX` / `2201`) with atomic stock deductions and Delivery Challans (`RI/DC/XXXX`), and Returnable Parts returns with stock restoration.
  - **Digitized A4 Printable Document Templates (`components/inventory/`)**:
    - **`PrintablePurchaseOrder.tsx`**: A4 printable Purchase Order matching physical image reference (`image_1.png`) featuring Reach International logo, vendor details, billing/shipping address, itemized pricing & tax breakdown, rupees in words, terms, and signatures.
    - **`PrintableDeliveryChallan.tsx`**: A4 printable Delivery Challan (`RI/DC/XXXX`) matching physical image reference (`image.png`) featuring Reach International logo, From Branch, To Customer/Site (PUSHPA INFRACON), Goods table, Approx Value, Note "not for sale; it is use for in our own machine", and GSTIN/PAN footer.
    - **`PrintablePartsIssueChallan.tsx`**: A4 printable Parts Issue Challan (`2201`) matching physical image reference (`image_2.png`) featuring S.No, Date, Yard, Part No, Description, Qty, Machine No, Issue To, Return (YES/NO), and signatures.
  - **UI ERP Hub & Modals (`components/inventory/`)**: Built `StockLedgerClient.tsx` (9 interactive tabs for Store Dashboard, Part Master, Storage Locations, Procurement, Goods Receipts, Part Issuance, Returnable Parts Tracker, Stock Ledger Audit History, and Inter-Branch Transfers) and modal components (`PartDetailModal.tsx`, `PurchaseRequestModal.tsx`, `GoodsReceiptModal.tsx`, `PartIssueModal.tsx`).
  - **Verification**: Executed `npx tsc --noEmit` (0 errors) and `npm run build` (30/30 static & dynamic routes compiled successfully).
- **Complete Rebranding to REACH INTERNATIONAL — REACHING ALL HEIGHTS (`components/branding/*`, `components/ui/Logo.tsx`, `AppSidebar.tsx`, `PublicNavbar.tsx`, `LandingFooter.tsx`, `app/login/page.tsx`, `app/signup/page.tsx`, `app/forgot-password/page.tsx`, `app/layout.tsx`, `app/page.tsx`, `app/not-found.tsx`, `lib/brand.ts`, `public/light-favicon.svg`, `public/dark-favicon.svg`)**:
  - **Vector SVG Scissor-Lift Icon (`components/branding/ScissorLiftLogoIcon.tsx`)**: Created pure vector SVG component representing industrial Scissor Lift platform (base chassis, wheels, X-scissor arms, hydraulic lift cylinder, top platform guardrails) with brand-blue upward height indicator arrow. Fully scalable, theme-aware (`currentColor` structural lines + accent blue arrow), 0 PNG raster images, 0 base64.
  - **Canonical Brand Component (`components/branding/ReachInternationalLogo.tsx`, `components/branding/index.ts`)**: Built `ReachInternationalLogo` supporting `full`, `compact`, and `wordmark` display variants, rendering the visual hierarchy: `[SCISSOR LIFT ICON] + REACH + INTERNATIONAL + ↑ + divider line + REACHING ALL HEIGHTS`. Accessible, lightweight, light & dark theme compatible.
  - **Wrapper Refactoring (`components/ui/Logo.tsx`, `components/ui/index.ts`)**: Refactored `Logo.tsx` to wrap `ReachInternationalLogo`, maintaining 100% backward compatibility for all existing imports.
  - **Favicon Vector Assets (`public/light-favicon.svg`, `public/dark-favicon.svg`, `public/site.webmanifest`)**: Replaced raster base64 embedded SVGs with pure vector SVGs tailored for light/dark themes. Updated webmanifest name to `"REACH INTERNATIONAL"` and short_name to `"REACH"`.
  - **Single Source of Truth (`lib/brand.ts`)**: Updated brand constants (`BRAND_NAME = "REACH INTERNATIONAL"`, `BRAND_TAGLINE = "REACHING ALL HEIGHTS"`).
  - **Full Application Migration**: Replaced legacy ServiceCentric branding across sidebar, navbar, landing footer, app header, auth hero panels (login, signup, forgot password), sitemap, metadata title (`REACH INTERNATIONAL — Reaching All Heights`), OpenGraph, JSON-LD, 404 page, and email templates (`lib/email.ts`, `lib/notifications/email-templates.tsx`, `FieldServiceReportModal.tsx`, `NotificationPreviewModal.tsx`, `CommandPalette.tsx`).
  - **Verification**: Executed `npx tsc --noEmit` (0 errors) and `npm run build` (30/30 static & dynamic routes compiled successfully).
- **Official ServiceCentric Branding, Light/Dark Theme Logo & Favicon Migration (`lib/brand.ts`, `components/ui/Logo.tsx`, `components/ui/index.ts`, `AppSidebar.tsx`, `PublicNavbar.tsx`, `LandingFooter.tsx`, `app/login/page.tsx`, `app/signup/page.tsx`, `app/layout.tsx`, `site.webmanifest`)**:
  - **Single Source of Truth (`lib/brand.ts`)**: Mapped all official ServiceCentric branding assets stored in `/public` (`/light-favicon.svg`, `/dark-favicon.svg`, `/light-favicon.ico`, `/dark-favicon.ico`, `/light-favicon-96x96.png`, `/dark-favicon-96x96.png`, `/light-apple-touch-icon.png`, `/dark-apple-touch-icon.png`, `/light-web-app-manifest-192x192.png`, `/dark-web-app-manifest-192x192.png`, `/light-web-app-manifest-512x512.png`, `/dark-web-app-manifest-512x512.png`, `/site.webmanifest`).
  - **Theme-Aware `<Logo />` Component**: Created canonical `Logo` component rendering dual SVG elements (`lightLogo` and `darkLogo`) with Tailwind `dark:hidden` / `hidden dark:block` classes to guarantee instant theme switching with 0 hydration errors, 0 layout shifts, and 0 artificial CSS filter hacks.
  - **Full Application Migration**: Replaced legacy `/favicon.svg` references across all layout and navigation components (`AppSidebar.tsx`, `PublicNavbar.tsx`, `LandingFooter.tsx`, `app/login/page.tsx`, `app/signup/page.tsx`).
  - **Browser Favicons & Next.js Metadata**: Updated `metadata.icons` and `<head>` links to serve light and dark favicons dynamically via `media="(prefers-color-scheme: light/dark)"`. Updated `site.webmanifest` name to `"ServiceCentric"` and point icon URLs to official manifest PNGs.
  - **Verification**: Verified `npx tsc --noEmit` exits clean (0 errors) and `npm run build` completed successfully (30/30 static & dynamic routes compiled).

- **Website-Wide Dialog Animation & Transition Migration (`components/animate-ui/components/radix/dialog.tsx`, `components/ui/dialog.tsx`, `components/ui/Modal.tsx`, `MobileFilterDrawer.tsx`, `UserDetailSheet.tsx`)**:
  - **Animate UI Radix Dialog Suite**: Built Animate UI Radix Dialog primitive component suite (`Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogClose`, `DialogFooter`, `DialogOverlay`, `DialogPortal`, `DialogContentProps`) wrapping `@radix-ui/react-dialog` with GPU-accelerated Framer Motion transitions.
  - **Directional `from` & Motion System**: Implemented entry directions (`from="center" | "top" | "bottom" | "left" | "right"`), backdrop overlay fade (`opacity: 0 ↔ 1`), cubic-bezier ease-out timing (`ease: [0.16, 1, 0.3, 1]`), scale/translate transforms, and accessibility reduced-motion fallbacks.
  - **Shared Modal Migration**: Refactored `components/ui/Modal.tsx` to consume Animate UI Radix Dialog primitives. Automatically upgraded all 26+ dialogs across the website (`MachineModal`, `UserCreateModal`, `UserEditModal`, `MachineComplaintModal`, `FieldServiceReportModal`, `MachineCategoryModal`, `MachineImportModal`, `NotificationPreviewModal`, `ConfirmationDialog`, `GlobalCreateModal`, `ComplaintsClient`, `HRClient`, `ServicesClient`, `StockLedgerClient`, `AuditLogsClient`, `DocumentsClient`, etc.) while retaining 100% of existing visual design tokens, dark/light themes, buttons, inputs, form validations, and keyboard accessibility.
  - **Mobile Drawers & Sheets**: Refactored `MobileFilterDrawer.tsx` and `UserDetailSheet.tsx` to use `<DialogContent from="bottom">` for unified bottom-sheet transitions.
  - **Verification**: Verified clean TypeScript compilation (`npx tsc --noEmit`) with 0 errors and production build completed successfully.
- **Landing Page Visual & UI Bug Fixes (`HeroSection.tsx`, `EquipmentGallery.tsx`, `EngineerMobileSection.tsx`, `animated-icon.tsx`)**:
  - **Hero Headline Visibility**: Fixed WebKit gradient text-clip glitch in `HeroSection.tsx` by separating linear gradient text spans from the relative SVG underline container box, making "Another" in "Never Miss Another Deadline." 100% visible and readable.
  - **Equipment Gallery Icons**: Updated `AnimateIcon` in `animated-icon.tsx` to automatically set inline `width` and `height` based on `size` prop. Styled `EquipmentGallery.tsx` card icon containers with high-contrast glass pill wrappers and hover transitions so all machine icons render clearly.
  - **Engineer Mobile Section Redesign**: Removed ambient glow overlay element (`absolute top` halo). Upgraded mobile device frame in `EngineerMobileSection.tsx` to a photorealistic smartphone chassis with physical side buttons (action, volume up/down, power button), metallic titanium chamfers, dynamic island notch pill, status bar, and polished native app layout.
  - **Verification**: Verified clean TypeScript compilation (`npx tsc --noEmit`) with 0 errors.
- **Animate UI / Radix Sidebar Upgrade & Collapsed Flyout Submenus (`components/ui/sidebar.tsx`, `components/layout/AppSidebar.tsx`, `components/layout/AppShellClient.tsx`)**:
  - Built comprehensive Animate UI / Radix primitive library in `components/ui/sidebar.tsx` (`SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuItem`, `SidebarMenuButton`, `SidebarMenuSub`, `SidebarMenuSubItem`, `SidebarMenuSubButton`, `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`, `useSidebar`).
  - Upgraded canonical sidebar (`AppSidebar.tsx`) with spring accordion collapsible transitions, 90° chevron rotation (`group-data-[state=open]/collapsible:rotate-180`), and polished SaaS hover effects.
  - Implemented floating flyout submenu panels (`left-full ml-3`) when sidebar is collapsed for `CRM`, `Machines`, `Service`, `Inventory`, `Vendors`, `Purchase Orders`, and `HR`.
  - Preserved 100% of ServiceCentric logo branding (`/favicon.svg`), color design tokens, light & dark theme, RBAC permissions, routes, Quick Access Command Palette trigger (`⌘K`), and User Profile Dropdown footer.
  - Wrapped `AppShellClient` with `SidebarProvider` while preserving persistent state in `localStorage` (`servicecentric_sidebar_collapsed`).
  - Verified `npx tsc --noEmit` exits with 0 TypeScript compilation errors.

## 2026-08-13
- **Complete Production-Quality Animated Icon Library Migration Across Entire Codebase**:
  - **Icon Registry & Motion Engine Expansion (`components/ui/animated-icon.tsx`, `components/ui/animated-icons/index.ts`)**: Expanded `AnimateIcon` motion engine with 12 micro-animation variants (`spin`, `bounce`, `pulse`, `wiggle`, `scale`, `float`, `rotate-clock`, `rotate-counter`, `slide-right`, `slide-left`, `fade`, `draw-path`) and 4 interactive triggers (`hover`, `click`, `view`, `continuous`). Built preset icon wrappers (`AnimatedWrench`, `AnimatedCalendarClock`, `AnimatedTruck`, `AnimatedAlertTriangle`, `AnimatedCheckCircle`, `AnimatedBuilding2`, `AnimatedUsers`, `AnimatedPackage`, `AnimatedShoppingBag`, `AnimatedSearch`, `AnimatedFilter`, `AnimatedMail`, `AnimatedPhone`, `AnimatedShieldCheck`, `AnimatedShieldAlert`, `AnimatedBarChart3`, etc.) in central index.
  - **Full UI & Primitive Component Migration**: Migrated all core primitives (`MetricCard`, `EnterpriseTable`, `CommandPalette`, `Dialog`, `Toast`, `Calendar`, `Tooltip`, `EmptyState`, `Pagination`, `Breadcrumb`, `PageHeader`, `PublicNavbar`, `AppSidebar`, `MobileBottomNav`).
  - **Landing Page & Public Routes Migration**: Migrated `HeroSection`, `FeatureShowcaseSection`, `WorkflowSection`, `NotificationEngineSection`, `EquipmentGallery`, `EnterpriseSecuritySection`, `EngineerMobileSection`, `CtaSection`, `AnalyticsShowcaseSection`, `FaqSection`, `LandingFooter`, `LoginPage`, `LoginForm`, `SignupPage`, `ForgotPasswordPage`, `NotFoundPage`.
  - **Application Module Migration**: Migrated `AdminClient`, `AuditLogsClient`, `BranchesClient`, `ChallansClient`, `ComplaintsClient`, `MachineComplaintModal`, `FieldServiceReportModal`, `CrmClient`, `DocumentsClient`, `HRClient`, `InventoryClient`, `MachineListClient`, `machine-client-view`, `MyWorkClient`, `NotificationListClient`, `PurchaseOrdersClient`, `ReportsClient`, `ServicesClient`, `VendorsClient`, `OperatorDashboard`, `MechanicDashboard`, `MobileDueBuckets`, `MobileDashboardHeader`, `MobileChartsWrapper`, `Charts`, `users-client`, `UserRow`, `UserEditModal`, `UserDetailSheet`, `UserCreateModal`, `MobileUserCard`.
  - **Verification**: Verified `npx tsc --noEmit` exits with 0 TypeScript compilation errors and production build succeeds.

- **Reusable `Avatar` & `AvatarGroup` UI Component Suite & Unused Code Cleanup (`components/ui/Avatar.tsx`, `components/ui/index.ts`, `components/landing/HeroSection.tsx`)**:
  - **Avatar Primitive (`components/ui/Avatar.tsx`)**: Built reusable `<Avatar />`, `<AvatarImage />`, `<AvatarFallback />`, and `<AvatarGroup />` (aliased as `<GroupAvatar />` and `<AvatarStack />`).
  - **Interactive Micro-Animations & Fallbacks**: Integrated Framer Motion spring physics on hover, fallback initial color-hashing, status indicator dots (`online`, `offline`, `busy`, `away`), interactive tooltips, and `+N` count badge.
  - **Landing Page Refactoring & Dead Code Removal (`components/landing/HeroSection.tsx`)**: Replaced raw `<img>` cluster with `<AvatarGroup />` social proof avatar stack, and removed older unused `AVATARS` constant.
  - **Type Safety Verification**: Executed `npx tsc --noEmit` and confirmed 0 TypeScript compiler errors.


- **Fix `animated-icon` Module Exports & Turbopack Build Error (`components/ui/animated-icon.tsx`, `components/ui/animated-icons/index.ts`)**:
  - **Restored Named Exports (`components/ui/animated-icon.tsx`)**: Re-exported `AnimateIcon`, `AnimatedIcon`, `createAnimatedIcon`, `AnimateIconProps`, `AnimatedIconProps`, `IconAnimationVariant`, `IconAnimationPreset`, and `IconTrigger` so UI components (`Button`, `Modal`, `ConfirmationDialog`, `FilterToolbar`, `EnterpriseTable`, `index.ts`) resolve imports correctly.
  - **TypeScript Syntax Cleanup (`components/ui/animated-icons/index.ts`)**: Re-exported `createAnimatedIcon` directly from `../animated-icon` to eliminate JSX syntax inside the `.ts` file.
  - Verified `npx tsc --noEmit` (0 errors) and `npm run build` (30/30 static & dynamic routes compiled cleanly).
- **Animate UI Icon Animation Standard Integration (`https://animate-ui.com/docs/icons/usage/animations`)**:
  - **Full Animate UI Spec (`components/ui/animated-icon.tsx`)**: Upgraded `AnimateIcon` and `AnimatedIcon` supporting children element wrapping (`<AnimateIcon animation="pointing"><ArrowRight /></AnimateIcon>`) and 14 animation presets (`pointing`, `bounce`, `spin`, `pulse`, `wiggle`, `float`, `glow`, `draw`, `path`, `path-loop`, `shake`, `flip`, `scale`, `default`).
  - **Component Level Upgrade**: Upgraded `Button` loading states, `Modal` close controls, `ConfirmationDialog` severity badges (`shake`, `wiggle`, `pulse`), `FilterToolbar` controls, `SearchableSelect` dropdowns, and `EnterpriseTable` sort headers.
  - Verified `npx tsc --noEmit` exits clean with 0 errors.
- **Multi-Layer Performance Architecture & Enterprise Caching**:
  - **Freshness Policies (`lib/cache/policies.ts`)**: Defined 4 data freshness classes (`CLASS_A_STATIC` 24h, `CLASS_A_REFERENCE` 1h, `CLASS_B_DIRECTORY` 2m, `CLASS_B_FLEET` 60s, `CLASS_C_OPERATIONAL` 15s, `CLASS_D_FRESH` 0s).
  - **Structured Tag Hierarchy (`lib/cache/tags.ts`)**: Created structured tag constants and branch-scoped helper functions (`TAGS.machines`, `TAGS.machinesBranch(branchId)`, `TAGS.categories`, `TAGS.dashboardKpis`). Re-exported backward-compatible `CACHE_TAGS` and `CACHE_TIERS` in `lib/cache.ts`.
  - **Database Performance Migration (`012_multi_layer_performance_indexes.sql`)**: Created composite indexes (`branch_id + status + created_at DESC`) and `v_branch_dashboard_summary` view to prevent query waterfalls.
  - **Data Access Layer Refactoring (`lib/queries/*`)**: Updated query functions in `categories.ts`, `machines.ts`, `dashboard.ts`, `complaints.ts`, and `services.ts` with explicit projections and freshness tiering.
  - **Mutation Invalidation Triggers (`app/actions/machines.ts`)**: Wired `revalidateTag` calls in Server Actions upon machine creation, update, deletion, and reassignment.
  - **25 Enterprise Performance Rules (`AI/PERFORMANCE_RULES.md`)**: Updated `AI/PERFORMANCE_RULES.md` to document strict performance standards.
  - Verified `npx tsc --noEmit` exits clean with 0 errors.
- **Instant Authenticated Root Route Redirect to `/dashboard`**:
  - **Edge Middleware Redirect (`proxy.ts`)**: Configured Next.js edge proxy to evaluate JWT authentication session on `path === "/"`. Authenticated users visiting `localhost:3000/` receive an immediate HTTP 307 redirect to `/dashboard` at the edge layer, bypassing HTML rendering, DB queries, and component execution (0ms render overhead).
  - **RSC Fallback (`app/page.tsx`)**: Added server-side fallback redirect via `redirect("/dashboard")` for active user sessions (and `/login` for pending/inactive users).
  - Verified `npx tsc --noEmit` exits clean with 0 errors.
- **Fix Parallel Route Conflict for `/service`**:
  - Resolved build error: `You cannot have two parallel pages that resolve to the same path. Please check /(app)/service and /service.`
  - Deleted legacy redirect file `app/service/page.tsx` that collided with the enterprise Service Hub page located at `app/(app)/service/page.tsx`.
  - Verified `npx tsc --noEmit` (0 errors) and `npm run build` (30/30 static & dynamic routes compiled successfully).
- **Enterprise Architecture Verification & Contextual Sub-Tab Completion**:
  - **System Review & Verification**: Checked and verified all 32 enterprise architecture items. Confirmed clean TypeScript compilation (`0 errors`) and complete alignment with recommended enterprise sidebar, daily action center, central smart documents vault, 5-level scope RBAC, dynamic approver resolution, global quick creation modal, and single-page tabbed modules.
  - **Machine Detail Contextual Tabs (`MachineClientView.tsx`)**: Added rich contextual tab content panels for `complaints` (Breakdown Complaints & FSR log), `documents` (Insurance, Fitness & Compliance certificates), `assignments` (Operator & Site assignment logbook), and `running_hours` (Daily meter reading logs & operating duration).
  - **Entity Detail Dynamic Routes & Clients**: Created standalone routes `/clients/[id]`, `/vendors/[id]`, `/purchase-orders/[id]` and dedicated client components (`ClientDetailClient.tsx`, `VendorDetailClient.tsx`, `PODetailClient.tsx`) with embedded sub-tabs (`Overview`, `Machines`/`Contacts`/`Items`, `Service`/`Products`/`Vendor`, `Complaints`/`Purchase Orders`/`Approval`, `Documents`, `Contacts`/`Performance`/`Communication`, `Activity`).
- **Enterprise Navigation, Smart Documents & 5-Level Scope-Based RBAC Overhaul**:
  - **Recommended Enterprise Sidebar (`AppSidebar.tsx`)**: Consolidated 50+ screens into 13 primary enterprise modules (Dashboard, My Work, CRM, Machines, Service, Inventory, Vendors, Purchase Orders, Challans, Documents, HR, Reports, Administration). Applied scope + permission-based sidebar filtering per user role profile.
  - **Daily "My Work" Action Workspace (`app/(app)/my-work/page.tsx`, `MyWorkClient.tsx`)**: Morning greeting ("Good Morning, [Name] 👋"), 4 urgency scorecard counters (🔴 Urgent, 🟠 Pending, 🟡 Due Today, 🟢 Completed), and role-tailored task cards for Operators (meter log entry & breakdown reports), Engineers (service jobs & FSR), Store Managers (stock requests), and Managers (PO approvals & expiries).
  - **Smart Documents Vault (`app/(app)/documents/page.tsx`, `DocumentsClient.tsx`)**: Single central document vault replacing standalone document subpages with Document Health Scorecard (Valid, Expiring <30d, Expired, Pending Approval, Missing Required) and entity type filter toolbar (Machine, Client, Vendor, HR, PO, Challan).
  - **Contextual Entity Detail Sub-Tabs**: Embedded sub-tabs inside Client (`Overview`, `Machines`, `Service`, `Complaints`, `Documents`, `Contacts`, `Activity`), Vendor (`Overview`, `Contacts`, `Products`, `Purchase Orders`, `Documents`, `Performance`, `Activity`), PO (`Overview`, `Items`, `Vendor`, `Approval`, `Documents`, `Receipts`, `Communication`, `Activity`), and Machine (`Overview`, `Service`, `Complaints`, `Documents`, `Assignments`, `Running Hours`, `Activity`) detail views.
  - **Top Bar Global "+ Create" Button (`GlobalCreateModal.tsx`, `AppHeader.tsx`)**: Added quick action button in top bar opening a permission-filtered quick creation modal for Client, Machine, Complaint, Service Job, Purchase Order, Challan, Stock Transaction, and Document.
  - **Consolidated Tabbed Modules**: Built single tabbed pages for Delivery Challans (`/challans`), CRM (`/crm`), Service (`/service`), Vendors (`/vendors`), Purchase Orders (`/purchase-orders`), Reports (`/reports`), and Administration Console (`/administration`).
  - **5-Level Scope-Based Access Model & Responsibility Matrix (`lib/auth/scope.ts`)**: Built `PermissionScope` levels (`ORGANIZATION`, `REGION`, `BRANCH`, `DEPARTMENT`, `WAREHOUSE`, `ASSIGNED`, `SELF`) and dynamic approver resolution matrix so branches without local HR/Procurement staff automatically escalate requests to Central/Regional responsibility matrices.
- **README.md Documentation Overhaul (`README.md`)**:
  - Overhauled and updated `README.md` to reflect all recent enterprise features and architecture additions.
  - Documented 11 system roles, multi-branch data scoping (`branches`, `user_branches`, `<BranchSelector />`), breakdown complaints & digital Field Service Report (FSR) system with A4 PDF export, machine categories taxonomy (`machine_categories`), extended technical specs & compliance tracking (Engine Serial/Mot, Insurance, 3rd Party Cert, RTO Tax), multi-branch inventory stock transfers (`/inventory`), HR employee workspace (`/hr`), operator daily meter logbooks (`/operations`), project structure, server actions, and updated feature roadmap.
- **PostgREST Relation Ambiguity Fix in Users Server Actions (`app/actions/users.ts`)**:
  - Resolved console errors `Error fetching users: {}` and `Error fetching pending users: {}` (`PGRST201: Could not embed because more than one relationship was found for 'users' and 'branches'`).
  - Specified explicit relationship hint `!users_branch_id_fkey` in PostgREST select queries (`branch:branches!users_branch_id_fkey(id, code, name, city, state)`) in `getAllUsers()` and `getPendingUsers()`.
  - Updated error logging from `console.error(..., error)` to `console.error(..., error.message || error)`.
- **User Management RBAC Role Creation & Multi-Branch Location Columns Overhaul (User Feedback on `/users`)**:
  - **`app/(app)/users/UserCreateModal.tsx`**: Removed `disabled={!isSuperAdmin}` from role selection so regular `admin` users can select and assign any operational enterprise role when creating user accounts. Added `branch_id` dropdown ("Assigned Company Branch Location"). Expanded role preview badges with icons for all 13 roles.
  - **`app/(app)/users/UserEditModal.tsx`**: Added `branch_id` branch selector and role selector so admins can edit assigned branch and role details.
  - **`app/actions/users.ts`**: Updated `getAllUsers` and `getPendingUsers` to join `branch:branches(id, code, name, city, state)`. Updated `createUser` and `editUser` to handle `branch_id` and permit `admin` users to assign operational enterprise roles.
  - **`app/(app)/users/UserRow.tsx` & `app/(app)/users/users-client.tsx`**: Overhauled desktop User Management table to 7 dedicated columns (`User Account`, `Contact Info`, `Role & Access Level`, `Assigned Branch & Location`, `Status`, `Joined Date`, `Actions`). Enhanced search filter to query branch name, branch city, phone, email, and role.
  - **`app/(app)/users/MobileUserCard.tsx` & `UserDetailSheet.tsx`**: Updated mobile user cards and detail drawer sheet to display assigned company branch badges and location details.

  - **`supabase/migrations/011_enterprise_rbac_branches_inventory.sql`**: Created database schema for multi-branch scoping (`branches`, `user_branches`), role permissions (`roles`, `permissions`, `role_permissions`), decoupled HR employees (`employees`), machine master taxonomy (`manufacturers`, `machine_models`), operator work tracking (`machine_assignments`, `machine_hour_logs`), stock ledger (`inventory_products`, `inventory_stock`, `inventory_transactions`), and inter-branch transfers (`stock_transfers`). Seeded Delhi HQ and Gurgaon branches, 11 system roles, and permissions.
  - **`lib/types/database.ts`**: Updated `UserRole` union type to 11 roles and added interfaces for `Branch`, `Role`, `Permission`, `Employee`, `MachineAssignment`, `MachineHourLog`, `InventoryStock`, `InventoryTransaction`, `StockTransfer`, `Manufacturer`, `MachineModel`.
  - **`lib/auth/rbac.ts` & `lib/dal.ts`**: Built `ROLE_PERMISSIONS` matrix mapping role permissions and added DAL guard functions `requirePermission()`, `currentUserHasPermission()`, and `getUserBranchIds()`.
  - **Server Actions**: Created `app/actions/branches.ts`, `app/actions/operators.ts`, `app/actions/inventory.ts`, and `app/actions/hr.ts`.
  - **Page Routes & Client Views**: Created `/inventory` (`StockLedgerClient.tsx`), `/hr` (`HRClient.tsx`), `/branches` (`BranchesClient.tsx`), and `/operations` (`OperationsClient.tsx`).
  - **Header Controls & Navigation**: Integrated `<BranchSelector />` into `AppHeader.tsx`. Updated `AppSidebar.tsx` and `CommandPalette.tsx` to dynamically filter menu links according to user roles (`store_manager`, `hr_manager`, `branch_manager`, `service_engineer`, `supervisor`, `operator`, `mechanic`, `super_admin`).
  - **Role-Tailored Dashboards**: Added automatic role dashboard routing in `app/(app)/dashboard/page.tsx` for `store_manager`, `hr_manager`, `operator`, `mechanic`, and admins.

- **Breakdown Complaints FSR Report PDF & A4 Print Optimization (User Feedback on `/machines?tab=complaints`)**:
  - **`components/complaints/FieldServiceReportModal.tsx`**:
    - Configured `@page { size: A4 portrait; margin: 0; }` in iframe generator to strip browser default header (date, title) and footer (URL, page numbers) text when printing or exporting PDF.
    - Added input element DOM cloning & sanitization: in print view, HTML `<input>` and `<textarea>` elements are converted to clean text elements, eliminating input box borders, background shading, focus outlines, scrollbars, and textarea resize handles (`//`).
    - Added `.text-white !important` over `.bg-neutral-900` table headers so parts table column headers ("SR", "PART NAME", "QTY", "STATUS", "DATE") render in bold white text.
    - Standardized report print container dimensions to exact A4 size (`210mm x 297mm`) with `10mm 12mm` margins, budgeting vertical heights for single-page output.
  - **`app/globals.css`**:
    - Updated global `@media print` CSS block targeting `#printable-fsr-report` with `@page { size: A4 portrait; margin: 0; }`, exact A4 dimensions, and white header text.

- **Field Service Report Modal Feedback Polish (User Feedback on `/machines?tab=complaints`)**:
  - **`components/complaints/FieldServiceReportModal.tsx`**:
    - Removed top View/Edit flex banner box (`.flex items-center justify-between p-3...`) to display FSR report document cleanly under modal header.
    - Removed `bg-neutral-100` (`Signed FSR PDF / Attachment Link`) attachment container from `#printable-fsr-report`.
    - Removed `max-h-[80vh] overflow-y-auto` from form container, eliminating competing inner and outer scrollbars so the modal uses a single smooth scroll container.
    - Relocated `Edit Report` / `Cancel Edit` buttons into sticky bottom action bar alongside `Print / Save PDF` and `Close`.
    - Built dedicated iframe print engine in `handlePrintReport` targeting `#printable-fsr-report` with custom A4 styles for printing and 1-click PDF export.
  - **`app/globals.css`**:
    - Added global `@media print` CSS block targeting `#printable-fsr-report`.

- **Breakdown Complaints FSR Report Optimization & Dual View/Edit Modes (User Feedback on `/machines?tab=complaints`)**:
  - **`components/complaints/ComplaintsClient.tsx`**:
    - Differentiated table action buttons based on complaint status: active complaints (`open`, `in_progress`, `pending_parts`) render `<Wrench /> Resolve (Fill FSR)` in sky blue styling to guide engineers, while resolved/closed complaints render `<FileText /> View FSR Report` in emerald styling.
  - **`components/complaints/FieldServiceReportModal.tsx`**:
    - Built dual **View Mode** vs **Edit Mode**: resolved complaints default to a clean, read-only FSR document view showing engineer signatures, checklist overview badges, parts table, and Print/Save PDF actions, with an "Edit Report" button for modifications.
    - Added 1-click **"Mark All Passed (Y)"** and **"Clear"** helper buttons for fast checklist entry.
    - Supported dynamic replacement parts table rows (`Add Part Row`, `Remove Part Row`).

- **ThemeToggle Geist Enterprise Redesign (User Feedback on `/machines`)**:
  - **`components/theme/ThemeToggle.tsx`**:
    - Overhauled the `ThemeToggle` component to perfectly match ServiceCentric's Vercel Geist design system.
    - Built a sleek sliding switch with Framer Motion spring physics, high-contrast Sun/Moon micro-animations, and brand dark/light slate + sky-blue tokens.
    - Added support for a 3-way `segmented` control variant alongside the default `switch` layout.
    - Maintained full SSR hydration protection and right-click context menu options for Light, Dark, or System mode.
  - **`app/globals.css`**:
    - Removed obsolete cartoonish `.daynight-toggle` CSS rules.

- **Remove Redundant Segmented Status Filter Tabs (User Feedback on `/machines?tab=inventory&bucket=overdue`)**:
  - **`components/machines/MachineListClient.tsx`**:
    - Removed the redundant segmented status filter pills row (`All`, `Due Today`, `Due Tomorrow`, `Overdue`).
    - Streamlined the Machine Directory page layout so quick filtering is performed via top interactive KPI summary cards and the `FilterToolbar` dropdown selector (`Filter Service Due`).

- **Service Due Filter in FilterToolbar (User Feedback on `/machines?bucket=tomorrow`)**:
  - **`components/machines/MachineListClient.tsx`**:
    - Added `bucketOptions` memoized options (`All Service Due`, `Due Today`, `Due Tomorrow`, `Overdue`).
    - Integrated `SearchableSelect` for `Filter Service Due` directly inside the expanded `FilterToolbar` dropdown grid alongside Status, City, and Engineer filters.
    - Ensured full bi-directional state synchronization with URL `?bucket=...` search parameter and quick filter tabs.

- **Day/Night Theme Toggle Switch (User Feedback on `/machines`)**:
  - **`components/theme/ThemeToggle.tsx`**:
    - Replaced standard icon toggle button with the requested interactive Day/Night theme toggle switch.
    - Features sun/moon animated handler, crater details, cloud-to-star morphing animations, and AM/PM indicator text.
    - Fully synchronized with `useTheme` hook (`theme`, `resolvedTheme`, `setTheme`) with mounted hydration safety.
    - Preserved right-click context menu popover for selecting Light, Dark, or System themes.
  - **`app/globals.css`**:
    - Added custom `.daynight-toggle-wrapper`, `.daynight-toggle`, `.daynight-toggle__handler`, `.crater`, and `.daynight-star` CSS rules.

- **Collapsed Sidebar Logo Hover Toggle Fix**:
  - **`components/layout/AppSidebar.tsx`**:
    - Fixed collapsed sidebar logo toggle behavior so the logo icon is permanently displayed at rest.
    - Added `useEffect` hook to reset `isLogoHovered` state to `false` when `collapsed` changes.
    - Added `onBlur` and `onClick` resets to logo button to ensure hover state cannot get stuck on `PanelLeftOpen`.
    - Added `pointer-events-none` to motion container divs inside logo button to prevent unmounting children from firing spurious `onMouseLeave` events.

- **Sidebar Collapse Hover Toggle, AppHeader Removal & Profile Theme Integration**:
  - **`components/layout/AppSidebar.tsx`**:
    - Implemented ChatGPT-style logo hover interaction in collapsed mode: hovering over the logo smoothly morphs it into the expand button (`PanelLeftOpen`), clicking expands the sidebar.
    - Relocated `ThemeToggle` component into the `UserProfileDropdown` profile menu card.
    - Removed redundant Administration section (`Users`, `Audit Logs`, `Settings`) from the main sidebar body.
  - **`components/layout/AppShellClient.tsx`**:
    - Removed `AppHeader` top bar per user feedback.

- **Sidebar Architecture & Interaction Model Redesign**:
  - **`components/layout/AppShellClient.tsx`**:
    - Re-architected application shell into a true 2-column layout. Synchronized main workspace left padding with exact sidebar widths (`280px` expanded / `72px` collapsed) using matched 220ms Framer Motion transitions (`duration: 0.22, ease: [0.2, 0.8, 0.2, 1]`), eliminating lag, white gap flashes, and content overlays.
  - **`components/layout/AppSidebar.tsx`**:
    - **Persistent Logo**: Logo icon `[🔧]` stays permanently visible in both expanded (`[🔧] ServiceCentric` + `◀`) and collapsed (`[🔧]` top, `▶` bottom) states.
    - **Quick Access Search**: Renamed search label to "Quick Access" per user feedback. Collapsed state renders centered search icon wrapped in tooltip (`Quick Access ⌘K`).
    - **Machines Contextual Flyout Submenu**: Added floating flyout menu on right when clicking `Machines` in collapsed state (*Equipment Directory*, *Service Logs*, *Breakdown Complaints*), allowing direct sub-tab navigation without expanding the sidebar.
    - **Profile Dropdown Positioning**: Anchored popover floating cleanly above profile card in expanded mode (`bottom-full mb-2`) and flying out to the right in collapsed mode (`left-full ml-3 bottom-0`) with subtle hairline border and focus ring.
    - **Active Navigation Treatment**: Applied rounded active background (`bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold border border-sky-500/20`) for active parents and subtle blue tint for active children, removing redundant blue dots.
  - **`components/layout/AppHeader.tsx` [NEW]**:
    - Built desktop workspace top header housing active page title/breadcrumb, quick search (`⌘K`), notifications link with unread status, relocated `ThemeToggle`, and user role pill badge.
  - **`components/ui/Tooltip.tsx` & `components/ui/index.ts`**:
    - Added `SidebarTooltip` supporting 140ms hover delay, smooth 120ms fade, and dual-theme styling for collapsed navigation icons.

- **Runtime Error & Machine Hub UI Polish (`/machines`)**:
  - **`components/machines/MachineListClient.tsx`**:
    - Fixed `MobileMachineCard is not defined` runtime error by adding dynamic import (`dynamic(() => import("./MobileMachineCard"))`).
    - **Sidebar Sub-Navigation (Feedback 1)**: Shifted equipment directory, service log, and breakdown complaint sub-tabs directly under `Machines` in `AppSidebar.tsx` and removed redundant top horizontal tab strip from page.
    - **Table Entry Count Removal (Feedback 2)**: Removed redundant "Showing N entries" text.
    - **Control Alignment (Feedback 3)**: Aligned `[ Table ] [ Cards ]` view switcher inside `FilterToolbar` actions bar alongside search & filter inputs.
    - **Header Subtitle Removal (Feedback 4)**: Removed subtitle paragraph (`"Manage equipment, services and maintenance..."`) under `Machine Directory`.
    - **Row Action Menu Cleanup (Feedback 5)**: Removed redundant `"View Details"` button from row contextual menu (`RowActionsMenu` `⋮`) since row click directly opens machine details.
  - **`components/layout/AppSidebar.tsx`**:
    - **Super Smooth Sidebar Animation**: Converted `aside` layout to `motion.aside` with Framer Motion spring physics (`type: "spring", stiffness: 350, damping: 32`) and smooth label fade transitions for seamless collapse/expand interactions.
    - Added nested active sub-tabs under `Machines` link (`Equipment Directory`, `Service Logs`, `Complaints`).

## 2026-08-12
- **Machine Services Table UI/UX Overhaul (`/machines?tab=services`)**:
  - **`components/services/ServicesClient.tsx`**:
    - Replaced bright pink (`bg-pink-600`) action and modal buttons with Geist sky blue styling (`bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white font-semibold`).
    - Removed `<Eye />` icon link and added `<Edit />` icon to the "Update Service" action button.
    - Replaced duplicate pink button in `SERVICE STATUS` column with dynamic semantic status badges (`Overdue`, `Due Today`, `Due Soon`, `Scheduled`, `Under Maintenance`).
    - Added `onRowClick={(m) => router.push('/machines/' + m.id)}` to `EnterpriseTable` to make all table rows clickable, with `e.stopPropagation()` on action buttons.
    - Updated Update Service Modal submit button to match primary brand blue.
- **Machine Extended Technical Specifications, Compliance Tracking & Registration Form (`/machines`, `/machines/[id]`)**:
  - **`supabase/migrations/009_machine_extended_details.sql` [NEW]**: Added columns for `serial_number`, `manufacturer`, `year_of_mfg`, `engine_serial_no`, `engine_mot_no`, `insurance_policy_no`, `insurance_expiry_date`, `third_party_certificate`, `third_party_expiry_date`, `rto_tax`, and `rto_tax_expiry_date` to `public.machines`. Updated status CHECK constraint to allow `on_rent` and `under_maintenance`. Migration executed directly on Supabase DB.
  - **`lib/types/database.ts`**: Expanded `MachineStatus` (`active`, `inactive`, `on_rent`, `under_maintenance`) and extended `Machine` interface.
  - **`lib/queries/machines.ts`**: Updated `MACHINE_LIST_COLUMNS` and `getCachedMachineById` projections to select all extended technical and compliance fields.
  - **`app/actions/machines.ts`**: Updated auto-code generator to `S` + 3-4 random digits (e.g. `S374`), updated `machineCodeRegex` to `/^[A-Z0-9\-]{3,20}$/`, updated `createMachine` & `updateMachine` payloads.
  - **`components/machines/MachineModal.tsx`**: Overhauled form modal with auto `S374` code generator, 5 visual card sections for equipment specs, engine specs, compliance certificates, client location, and status choices.
  - **`app/(app)/machines/[id]/machine-client-view.tsx`**: Updated Overview tab with dedicated Equipment & Technical Record card displaying all 14 fields (Machine No, Model, Sr No, Manufacturer, Year, Engine Serial/Mot, Insurance & Expiry, 3rd Party Cert & Expiry, RTO Tax & Expiry, Status). Added `formatComplianceDate` helper (e.g. `1st January 1970`).
  - **`MachineRow.tsx`**, **`MobileMachineCard.tsx`**, **`MachineListClient.tsx`**: Updated status badges to render `On Rent` and `Under Maintenance` pills and added status filter options.
- **FilterToolbar Collapsed State Adjustment (`/services`, `/machines`, `/users`, `/notifications`, `/audit-logs`)**:
  - **`components/ui/FilterToolbar.tsx`**: Updated `defaultOpen` default state from `true` to `false` and simplified state initialization so filter panels remain collapsed by default on page load, opening smoothly when the user clicks the `Filter` button.
  - **`ServicesClient.tsx`**, **`users-client.tsx`**, **`NotificationListClient.tsx`**, & **`AuditLogsClient.tsx`**: Updated `defaultOpen={false}` props so filters are collapsed by default across all app views.
  - **`components/ui/FilterToolbar.tsx` [NEW]**: Created a reusable, mobile-responsive `FilterToolbar` component that aligns the search input bar side-by-side with a high-contrast `Filter` toggle button (with active filter count badge) and smooth expandable filter panel.
  - **`components/ui/index.ts`**: Exported `FilterToolbar`.
  - **`components/services/ServicesClient.tsx`**: Re-architected search and filter section per user page feedback. Aligned search input with Filter toggle button in a single row; wrapped filter pills (`All Tasks`, `Overdue`, `Due Today`, `Due Tomorrow`, `Inactive`) inside the `FilterToolbar` expandable panel.
  - **`components/machines/MachineListClient.tsx`**: Integrated `FilterToolbar` for search input, Filter toggle button, and dropdown filter grid (Status, City, Engineer).
  - **`app/(app)/users/users-client.tsx`**: Integrated `FilterToolbar` for search input and role/status filter pills.
  - **`components/notifications/NotificationListClient.tsx`**: Integrated `FilterToolbar` for search input, status/alert type selects, and date range inputs.
  - **`components/audit-logs/AuditLogsClient.tsx`**: Integrated `FilterToolbar` for search input, role/date select grid, and category filter pills.
- **UserMenu Popover Link Cleanup (`/services`)**:
  - **`components/layout/PublicNavbar.tsx`**: Removed `"Dashboard Overview"` and `"Machines Directory"` navigation links from the `<UserMenu>` profile popover dropdown per user feedback on `/services`. Wrapped remaining popover links (`User Management` and `Audit Security Logs`) conditionally for `admin` and `super_admin` roles.
- **Login & Signup Feedback Polish (`/login`, `/signup`)**:
  - **`app/login/page.tsx`**: Removed `"Platform Active"` header pill badge per feedback.
  - **`app/login/login-form.tsx`**: Removed `"Sign in to your ServiceCentric account..."` subtitle paragraph.
  - **`app/signup/page.tsx`**: Removed `"Request Access"` header pill badge, removed `"Sign up with your work email..."` subtitle paragraph, and adjusted layout padding (`p-5 sm:p-6 lg:p-7`), field gaps (`gap-2.5 sm:gap-3`), note box styling, and container viewport height (`lg:h-screen lg:overflow-hidden`) so the signup box fits on screen without scrollbars.
- **Modern Auth UI/UX Redesign (`/login`, `/signup`, `/forgot-password`)**:
  - **`app/login/login-form.tsx`**: Upgraded to glassmorphic `motion.div` (`bg-card/80 backdrop-blur-xl shadow-2xl rounded-2xl`), added hairline gradient accent, password visibility toggle, tactile press animations, and high-contrast `<ArrowRight />` CTA.
  - **`app/login/page.tsx`**: Rebuilt hero showcase with ambient radial blur glows, horizontal keyword text gradient (`Never miss a service deadline again`), feature pill badges, top `<ArrowLeft /> Home` navigation link, and clean telemetry stat grid.
  - **`app/signup/page.tsx`**: Unified 50/50 split layout matching `/login` design language, added organization onboarding benefits, glass card form, and motion transitions.
  - **`app/forgot-password/page.tsx`**: Re-architected password reset view with centered ambient glow, glass card, key icon badge, and smooth navigation.
- **Login Hero Badge Removal (Page Feedback /login)**:
  - **`app/login/page.tsx`**: Removed the top `.inline-flex` badge (`Machine Service Tracking & Automation`) above the main hero headline per user feedback.
- **Favicon Metadata & In-App Logo Visibility Fix**:
  - **`app/layout.tsx`**: Added `icons` configuration (ICO, SVG, PNG 96x96, Apple Touch Icon) to `export const metadata` and inserted explicit `<link rel="icon">` tags into `<head>` to fix browser tab icon rendering.
  - **`app/favicon.ico`**: Created root icon fallback for Next.js App Router.
  - **`app/login/page.tsx`**, **`app/signup/page.tsx`**, & **`components/landing/LandingFooter.tsx`**: Added high-contrast drop shadow filters (`filter drop-shadow-[0_0_1px_rgba(0,0,0,0.85)] dark:drop-shadow-[0_0_1px_rgba(255,255,255,0.85)]`) so the SVG logo is crisp and visible in both light and dark themes.
- **Login & Signup Brand Header Alignment (Page Feedback /login)**:
  - **`app/login/page.tsx` & `app/signup/page.tsx`**:
    - Removed `"Service Management Platform"` subtitle (`.mesh-gradient > .flex > .flex > .text-xs`) per user feedback.
    - Replaced the rainbow text gradient brand title with the global standard Brand Name styling matching `PublicNavbar.tsx` (`Service<span className="text-sky-600 dark:text-sky-400">Centric</span>`).

## 2026-08-06
- **Landing Page Hero Section Headline Redesign** (user feedback on `/` landing page with uploaded image):
  - **`components/landing/HeroSection.tsx`**:
    - Replaced the previous `motion.h1` styling with a large, bold serif display headline (`font-serif font-bold text-5xl sm:text-7xl md:text-8xl lg:text-[5.75rem] xl:text-[6.5rem] tracking-tight leading-[1.08] sm:leading-[1.04]`).
    - Styled headline text with a 6-stop horizontal gradient (`#2563eb` electric royal blue → `#6366f1` indigo → `#8b5cf6` purple → `#c026d3` violet → `#ec4899` pink → `#f43f5e` hot pink) matching the uploaded design screenshot across "Never Miss Another Deadline.".
    - Added an SVG hand-drawn blue arc underline vector (`#2563eb`) under the word "Another".
    - Expanded content container max width to `max-w-4xl lg:max-w-5xl` for desktop viewports.
- **Performance Optimization Pass** (user report: slow `next dev` page loads + Recharts `width(0) height(0)` warnings + `scroll-behavior` warning):
  - **Diagnosis**: The reported timings (`proxy.ts`/`application-code` breakdown) are `next dev` + Turbopack artifacts — routes recompile on first hit and every request is instrumented. `next build && next start` is the real benchmark. Verified `npm run build` clean (16 routes, compiled 27.7s).
  - **`components/dashboard/MobileChartsWrapper.tsx`**: Was rendering BOTH the `block lg:hidden` mobile layout AND the `hidden lg:grid` desktop layout in the DOM → all 4 Recharts instances hydrated, the 2 hidden ones measuring 0×0 (source of repeated `width(0) height(0)` warnings). Now renders only ONE layout at a time via `useMediaQuery("(min-width: 1024px)")`. Cuts 4 chart mounts → 2.
  - **`lib/hooks/useMediaQuery.ts`** (new): SSR-safe `matchMedia` hook via `useSyncExternalStore` (server snapshot `false`, settles post-hydration — no mismatch).
  - **`lib/dal.ts`**: `getCurrentUser()` was doing a fresh `users` table SELECT on every request (React.cache only dedupes within a request). Extracted the profile-row lookup into `unstable_cache` keyed by `userId`, tagged `CACHE_TAGS.users` (already invalidated by all `app/actions/users.ts` mutations + `refresh.ts`), 60s revalidate. `auth.getUser()` still validates the token every request. React.cache wrapper retained for per-request dedupe.
  - **`app/layout.tsx`**: Added `data-scroll-behavior="smooth"` to `<html>` — clears the Next.js warning and scopes smooth scroll away from route transitions.
  - **`proxy.ts`**: Narrowed middleware matcher to also skip static assets (fonts/images/manifest/robots/sitemap) so session refresh runs only on real page routes. Protected/auth redirect logic unchanged.
  - **Verification**: `npx tsc --noEmit` clean; `npm run build` clean (16 routes).


- **Machines Page Feedback Verification** (page feedback on `/machines`):
  - Verified all four feedback items are already implemented in the current codebase:
    1. **"Overdue" quick-filter button** — color-coded red (`bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border-red-300/80 dark:border-red-800/80 font-extrabold`) with red count badge (`bg-red-200/80 dark:bg-red-900/70 text-red-900 dark:text-red-100 border-red-300/80 dark:border-red-700/80 font-black`), visible in both light & dark themes.
    2. **"Due Tomorrow" quick-filter button** — color-coded light blue (`bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-300/80 dark:border-blue-800/80 font-extrabold`) with light blue count badge, visible in both light & dark themes.
    3. **"Due Today" quick-filter button** — color-coded yellow/amber (`bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300/80 dark:border-amber-800/80 font-extrabold`) with yellow/amber count badge, visible in both light & dark themes.
    4. **Machine card grid** — harmonized with notification page design language in `components/machines/MobileMachineCard.tsx`: canvas gradient background (`from-[var(--color-canvas-elevated)] via-[var(--color-canvas-elevated)] to-[var(--color-canvas)]`), status-aware top hairline sheen hover overlay (`sheenGradientClass`: red/amber/blue/link), status urgency left border accents (`border-l-4`), inset details box (`bg-[var(--color-canvas)] border border-[var(--color-hairline)]`), and hover lift (`hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-black/50`).
  - Files verified: `components/machines/MachineListClient.tsx` (quick-filter pills + snapshot cards), `components/machines/MobileMachineCard.tsx` (grid cards).
  - `npx tsc --noEmit` clean (TSC_PASS).
- **UserMenu Dropdown Tab & `/users?action=create` Modal UI/UX Redesign** (page feedback on `/users?action=create`):
  - **`components/layout/PublicNavbar.tsx`**:
    - Completely redesigned `<UserMenu>` popup tab dropdown (`motion.div`) into a structured Geist profile card (`w-72 sm:w-80 shadow-2xl rounded-[var(--radius-lg)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 text-[var(--color-ink)] backdrop-blur-md`).
    - Added user avatar circle, full name in bold ink text, email in muted text, and phone row.
    - Added high-contrast role pills with icons (Super Admin = Red `<ShieldAlert />`, Admin = Amber `<ShieldCheck />`, Engineer = Blue `<Shield />`) and active status badge with pulsing green indicator dot, visible in both light & dark themes.
    - Added quick app navigation items (`Dashboard Overview`, `Machines Directory`, `User Management`, `Audit Security Logs`) with icon indicators and subtle hover transitions.
    - Redesigned Sign Out button with `<LogOut />` icon and rose hover wash.
  - **`app/(app)/users/users-client.tsx`**:
    - Added `useSearchParams` hook and `useEffect` to automatically open `UserCreateModal` when `action=create` query parameter is present in URL (`/users?action=create`).
  - **`app/(app)/users/UserCreateModal.tsx`**:
    - Enhanced user creation modal with clear field labels, placeholders (`Rahul Sharma`, `rahul@company.com`, `+91 98765 43210`), permission role descriptions, and granted role badge preview.
  - **`app/(app)/users/UserDetailSheet.tsx`**:
    - Updated `getRoleBadge` and header status badge to use high-contrast role pills and active status pill with pulsing dot indicator for clear visibility across light and dark themes.
- **Command Palette Navigation Coverage, Keyword Search Engine & Search Shortcut Badge** (page feedback on `/users`):
  - **`components/ui/CommandPalette.tsx`**:
    - Extended `CommandItem` with `keywords?: string[]` (synonym/alias search terms) and `roles?: string[]` (per-command role gating).
    - Rebuilt the command list into a single declarative array filtered by `userRole`, mirroring the real app navigation (`appNavItems`). Fixed a coverage bug where **Audit Logs** was previously hidden from `admin` — it is now visible to both `admin` and `super_admin` (matching `appNavItems`). All destinations covered: Dashboard, Machines, My Services, Notifications, Users, Audit Logs, Settings, plus Create Machine / Invite User quick actions.
    - Added keyword aliases per command (e.g. Machines → "equipment/inventory/assets", Notifications → "alerts/reminders/inbox", Audit Logs → "logs/history/activity", Users → "team/staff/people") so intent-based queries match.
    - Replaced the naive `every(token => includes)` filter with a **relevance-scored search engine**: every token must match, but matches are weighted (title prefix 100, title word-boundary 60, title substring 40, keyword 25, subtitle 10, category 5) with a +200 whole-query title-prefix boost; results sorted by descending score for fast, correct ranking.
  - **`components/layout/PublicNavbar.tsx`**:
    - Re-added the keyboard shortcut hint to the header search button as a `<kbd>` badge, **platform-aware** (`⌘K` on Mac, `Ctrl K` on Windows/Linux) via a `navigator.platform`/`userAgent` check in a `useEffect` (`isMac` state). Widened the search button (`w-36 sm:w-48`) and updated the `title` tooltip to match the detected platform.
  - `npx tsc --noEmit`: unable to run in this session (no shell tool available); changes reviewed manually and are type-consistent with existing `CommandPalette`/`PublicNavbar` types.


  - **`components/machines/MachineListClient.tsx`**:
    - **Overdue Filter Pill ("Overdue3")**: Styled in bold, high-contrast Red (`bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border-red-300/80 dark:border-red-800/80 font-extrabold`) with matching red count badge (`bg-red-200/80 dark:bg-red-900/70 text-red-900 dark:text-red-100 border-red-300/80 dark:border-red-700/80 font-black`), visible in both light & dark themes.
    - **Due Tomorrow Filter Pill ("Due Tomorrow1")**: Styled in bold, high-contrast Light Blue (`bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border-blue-300/80 dark:border-blue-800/80 font-extrabold`) with matching light blue count badge (`bg-blue-200/80 dark:bg-blue-900/70 text-blue-900 dark:text-blue-100 border-blue-300/80 dark:border-blue-700/80 font-black`), visible in both light & dark themes.
    - **Due Today Filter Pill ("Due Today0")**: Styled in bold, high-contrast Yellow/Amber (`bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300/80 dark:border-amber-800/80 font-extrabold`) with matching yellow/amber count badge (`bg-amber-200/80 dark:bg-amber-900/70 text-amber-900 dark:text-amber-100 border-amber-300/80 dark:border-amber-700/80 font-black`), visible in both light & dark themes.
    - **Top Quick Stats Cards**: Updated stats cards to match red, light blue, yellow/amber, and ink active/inactive color palettes.
  - **`components/machines/MobileMachineCard.tsx`**:
    - **Machine Card Grid**: Harmonized card constituent colors, background canvas gradient (`from-[var(--color-canvas-elevated)] via-[var(--color-canvas-elevated)] to-[var(--color-canvas)]`), status-aware top hairline sheen hover overlay (`sheenGradientClass`: red for overdue, amber for today, blue for tomorrow, link blue for normal), status urgency left border accents (`border-l-4`), inset details box (`bg-[var(--color-canvas)] border border-[var(--color-hairline)]`), and card hover lift (`hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-black/50`) matching `/notifications`.
  - `npx tsc --noEmit` clean (0 errors).
- **Users Page Grid, Role/Status Filter Pills & Approve/Reject Button UI Refinement** (page feedback on `/users`):
  - **`app/(app)/users/users-client.tsx`**:
    - **Pending Approvals Card Grid**: Harmonized card constituent color, subtle background gradient (`from-[var(--color-canvas-elevated)] via-[var(--color-canvas-elevated)] to-[var(--color-canvas)]`), hover hairline sheen overlay (`via-amber-500/40`), left urgency border accent (`border-l-4 border-l-amber-500 dark:border-l-amber-400`), and hover lift matching `/notifications`.
    - **Approve & Reject Buttons**: Updated Approve button (`variant="success-sm"`, `<Check />` icon, tight 6px radius, `shadow-xs`, active tap animation) and Reject button (`variant="danger-sm"`, `<X />` icon, tight 6px radius, `shadow-xs`, active tap animation) per `DESIGN.md` button UI/UX.
    - **Role Filter Pills**: Color-coded per role (Engineers = Blue, Admins = Amber/Yellow, Super Admins = Red) with status indicator dots and active text contrast in both light and dark themes.
    - **Status Filter Pills**: Color-coded per status (Active = Emerald, Inactive = Slate/Neutral) with status indicator dots and active text contrast in both light and dark themes.
  - **`app/(app)/users/MobileUserCard.tsx`**:
    - Harmonized grid cards with subtle canvas gradient background (`from-[var(--color-canvas-elevated)] via-[var(--color-canvas-elevated)] to-[var(--color-canvas)]`), top hairline sheen overlay on hover (`via-[var(--color-link)]/40`), left border role accents (`border-l-4`), and card hover lift matching `/notifications` and `/machines`.
    - Enhanced role badges with semantic dots and color contrast for both dark and light mode.
  - `npx tsc --noEmit` clean (0 errors).
- **Search Tab & CommandPalette Hover Icon Contrast & Fast Indexing Fix** (page feedback on `/dashboard`):
  - **`app/globals.css`**: Added `--color-primary: var(--color-primary);` to Tailwind v4 `@theme inline` bridge so `bg-primary`, `text-primary`, and `text-primary-foreground` resolve accurately across light and dark mode themes.
  - **`components/ui/CommandPalette.tsx`**: Added multi-token fast query search indexing logic (`tokens.every(...)`) and updated item hover state styling with explicit `group` and `group-hover:bg-primary group-hover:text-primary-foreground` to eliminate missing/invisible icons on hover.
  - **`components/layout/PublicNavbar.tsx`**: Updated search tab button with `group` and `group-hover:text-foreground` to ensure search icon is visible in both light & dark themes when hovered.
  - **`components/machines/MachineListClient.tsx`**, **`app/(app)/users/users-client.tsx`**, **`components/notifications/NotificationListClient.tsx`**, **`components/services/ServicesClient.tsx`**, **`components/audit-logs/AuditLogsClient.tsx`**: Updated search inputs with `group` focus-within/hover icon transitions for high contrast visibility.
  - `npx tsc --noEmit` clean (0 errors).
- **Machines Page Quick-Filter & Card Grid UI Refinement** (page feedback on `/machines`):
  - **`components/machines/MachineListClient.tsx`**: Updated quick-filter status pill buttons:
    - Button **"Overdue"**: Styled in red (`text-red-700 dark:text-red-400 font-semibold`, `bg-red-100/90 dark:bg-red-950/70 text-red-800 dark:text-red-200 border border-red-300/60 dark:border-red-800/60 font-bold`) visible in both light & dark themes.
    - Button **"Due Tomorrow"**: Styled in light blue (`text-blue-700 dark:text-blue-400 font-semibold`, `bg-blue-100/90 dark:bg-blue-950/70 text-blue-800 dark:text-blue-200 border border-blue-300/60 dark:border-blue-800/60 font-bold`) visible in both light & dark themes.
    - Button **"Due Today"**: Styled in yellow/amber (`text-amber-700 dark:text-amber-400 font-semibold`, `bg-amber-100/90 dark:bg-amber-950/70 text-amber-800 dark:text-amber-200 border border-amber-300/60 dark:border-amber-800/60 font-bold`) visible in both light & dark themes.
  - **`components/machines/MobileMachineCard.tsx`**: Harmonized card grid styling to match `/notifications` cards — added top hairline sheen overlay (`via-[var(--color-link)]/40`), subtle background gradient (`from-[var(--color-canvas-elevated)] via-[var(--color-canvas-elevated)] to-[var(--color-canvas)]`), dark/light theme urgency left border accents (`border-l-4`), and card hover lift.
  - `npx tsc --noEmit` clean (0 errors).
- **Machines & Users Page Grid UI/UX Harmonization** (page feedback on `/notifications`):
  - **`components/machines/MobileMachineCard.tsx`**: Redesigned machine card structure to mirror `NotificationMobileCard` — initial avatar circle (`bg-[var(--color-hairline-soft-surface)]`), copyable machine code pill, model tag, status badge with dot, inset details box (`bg-[var(--color-canvas)] border border-[var(--color-hairline)] p-2.5 rounded-lg text-xs`), overdue alert banner, and one-tap action pills (Call, WhatsApp, Edit, Deactivate, Details). Added card hover elevation (`hover:border-[var(--color-ink)]/30 hover:shadow-md`).
  - **`components/machines/MachineListClient.tsx`**: Upgraded bucket quick-filter chips to a Vercel Geist spring sliding pill container (`layoutId="activeMachineBucketPill"`) and updated card grid container to `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`.
  - **`app/(app)/users/MobileUserCard.tsx`**: Migrated all legacy Tailwind token classes to native Geist tokens (`bg-[var(--color-canvas-elevated)]`, `border-[var(--color-hairline)]`, `text-[var(--color-ink)]`, `text-[var(--color-mute)]`, `bg-[var(--color-canvas)]`). Added initial avatar circle with role icon badge, inset details container (`bg-[var(--color-canvas)]`), action footer (Email, Call, Reset Password key button, Toggle status button), and card hover elevation (`hover:border-[var(--color-ink)]/30 hover:shadow-md`).
  - **`app/(app)/users/users-client.tsx`**: Converted Role and Status filter chips to spring-sliding pill containers (`layoutId="activeUserRolePill"`, `layoutId="activeUserStatusPill"`) and expanded card grid view to `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4`.
  - `npx tsc --noEmit` clean (0 errors).
- **Sent real service due notification email** — Dispatched a genuine "Service Due Tomorrow" notification to `vaibhav1chauhan12353@gmail.com` using the original ServiceCentric email template (`getServiceReminderEmailHtml` via `sendNotification`), not the test template. Email included full details: machine code `MCH-2024-001` (Hydraulic Press HM-500), customer (Sharma Industries Pvt Ltd), due date (2026-08-07), location (Plot 45, GIDC Phase 2, Vapi, Gujarat - 396195), and assigned engineer. SendGrid accepted (status 202), message ID `K-LFTihGRROYfBgYbJ8SEg`. Temporary script `send-due-notification.ts` created and removed after successful send.
- **Landing Page Feedback Enhancements**:
  - **`HeroSection.tsx`**: Removed top inline badge `"Live Enterprise-ready service platform"`. Replaced color circle placeholders in social proof row with generated profile photos (`avatar-1.jpg` through `avatar-4.jpg`).
  - **`EngineerMobileSection.tsx`**: Removed collapsed Dynamic Island text `"WO-4471"`, removed top inline pill `"Field-First iOS App Experience"`, updated description paragraph to explicitly state support for both Android and iOS ("...on both Android and iOS devices."), and removed `"iOS 18/19 & Android Compatible"` tag text.
  - **`TestimonialsSection.tsx`**: Replaced initial badges ("SM", "FE", "OD") with real user profile photos (`avatar-1.jpg`, `avatar-2.jpg`, `avatar-3.jpg`).
  - **`CtaSection.tsx`**: Removed bottom trust line flex element ("SOC2 Type II · Zero configuration").
  - `tsc --noEmit` clean.
- **iPhone 17 Pro Max Mobile UI/UX redesign** (page feedback on `/`):
  - **`components/landing/EngineerMobileSection.tsx`**: Completely overhauled into an authentic, ultra-premium iPhone 17 Pro Max device chassis.
    - **Display & Ratio**: 6.9-inch 19.5:9 flagship aspect ratio (`w-[340px] sm:w-[355px] h-[720px] sm:h-[750px]`) with ~1.5mm uniform micro-bezel border and titanium metallic outer highlight frame.
    - **Hardware Details**: Modeled left side Action Button and Volume Up/Down buttons, right side Power Button and capacitive Camera Control button, and top speaker slit.
    - **Dynamic Island**: Interactive pill component (`w-[122px]` to `w-[240px]` spring morph) housing TrueDepth sensor lenses, live work order badge `#WO-4471`, and expandable live service activity indicator.
    - **iOS Status Bar**: Real-time 9:41 time font, location activity dot, 5G signal bars, Wi-Fi 7 icon, and battery status capsule with interior green fill level.
    - **Mobile App UI/UX**: Translucent backdrop-blur header, interactive tap-to-toggle maintenance checklist items with animated completion counter, photo evidence upload grid, primary sign-off CTA, draft/report issue buttons, and iOS gesture Home Indicator.
  - `tsc --noEmit` clean.

- **Landing page navbar missing sections added** (page feedback on `/`):
  - **`components/layout/PublicNavbar.tsx`**: Updated `defaultPublicNavLinks` to include all landing page sections: Equipment (`#equipment`), Workflow (`#workflow`), Features (`#features`), Analytics (`#analytics`), Reminders (`#reminders`), Mobile App (`#mobile`), Security (`#security`), Reviews (`#testimonials`), and FAQ (`#faq`). Updated desktop navigation bar container styling (`gap-0.5 xl:gap-1`) and link horizontal padding (`px-2 xl:px-3 whitespace-nowrap`) to fit all 9 links responsively with smooth scroll spy active tracking and hover pills.
  - **`components/landing/LandingFooter.tsx`**: Updated legacy/dead `#showcase` link to `#equipment` ("Equipment Gallery") and `#engineers` link to `#mobile` ("Field Workspace").
  - `tsc --noEmit` clean.

- **Landing navbar + theme toggle redesign** (page feedback on `/`):
  - **`components/layout/PublicNavbar.tsx`**: `defaultPublicNavLinks` cut from 6 → 4. Removed `Platform Showcase` (`#showcase`) and `Engineers` (`#engineers`) — dead anchors with no matching section id in `components/landing/*` (real ids: trusted/equipment/workflow/features/analytics/reminders/mobile/security/testimonials/faq). Reordered to match page flow: Workflow → Features → Analytics → Security. Added a spring-sliding **hover pill** on the desktop nav: new `hoveredLink` state, `onMouseEnter` per link + `onMouseLeave` on `<nav>`, and a `motion.div layoutId="public-navbar-hover-pill"` (`bg-muted/70`, stiffness 500/damping 34) rendered only when hovered and not active — coexists with the existing active pill.
  - **`components/theme/ThemeToggle.tsx`**: modernized the toggle button. Removed the perpetual pulsing sparkle dot, the tri-color (sky/violet/amber) gradient glow halo, and the heavy per-icon `drop-shadow` glows. New icon transition is a vertical slide + slight rotate (`y: 8→0→-8`, rotate ±45, spring 400/28) instead of scale+90°-spin; icons bumped to 18px; added a subtle `bg-primary/5` hover wash and `hover:bg-muted/60`. Right-click theme menu unchanged.
  - `tsc --noEmit` clean.

## 2026-08-06 (earlier)
- **Landing page feedback — Pricing removed + Hero rebuilt**:
  - **Removed Pricing**: deleted `components/landing/PricingSection.tsx` and unwired it from `app/page.tsx` (import + render). No nav/footer anchor referenced `#pricing`. New `<main>` order ends … → EnterpriseSecurity → Testimonials → FAQ → CTA.
  - **Hero from scratch** (`components/landing/HeroSection.tsx`): replaced centered stack with an asymmetric `lg:grid-cols-12` layout (left `col-span-5`, right `col-span-7`). Left column: pulsing "Live" badge, headline with gradient-clipped "service deadline" keyword, value-focused sub-copy, dual CTAs (primary with shine-sweep overlay + secondary glass), overlapping avatar social proof, count-up stat row (500+/99.9%/3) using framer-motion `animate` + `useInView`. Right column: existing `DashboardPreviewMockup` with radial glow underlay, two floating backdrop-blur glass cards (zero-missed + multi-channel dispatch), and a live "48 engineers on duty" pill. Section-wide **mouse-parallax** via `useMotionValue`/`useSpring`/`useTransform` driving layered offsets on visual, cards, and conic mesh orb; grid-texture + radial-glow background decoration. Fully tokenized, dark/light correct, reduced-motion inherits globals. `tsc --noEmit` clean.

## 2026-08-05
- **Landing Page Ground-Up Redesign — Phase 2 (strict Vercel Geist, visual-first)**:
  - **Decisions locked**: (1) imagery = vector/CSS/line-art only, no raster photos or external URLs; (2) strict Geist color restraint — ink-on-canvas everywhere, mesh gradient the only decoration, status colors (`--color-success/warning/error` + `-deep`) confined to product mockups; (3) reuse strong assets (theme system, `ui/*`, `AnimatedBackground`, header/footer, `DashboardPreviewMockup`); (4) structured placeholders (Starter/Growth/Enterprise pricing, role-based testimonials with no fabricated company names, common FAQs).
  - **New shared primitives**: `components/landing/_shared/Section.tsx` (standard section shell + `Reveal` scroll-in wrapper on framer-motion `whileInView`) and `_shared/MachineIcon.tsx` (ink line-art SVG set: excavator/bulldozer/loader/crane/forklift/dump-truck).
  - **New sections**: `EquipmentGallery.tsx` (category tabs → line-art machine cards across construction/mining/industrial/manufacturing/agriculture), `PricingSection.tsx` (3 tiers, highlighted via ink border not color fill), `TestimonialsSection.tsx` (Service Manager / Field Engineer / Ops Director role quotes, initials avatars), `FaqSection.tsx` (`useState` accordion, animated height, hairline dividers).
  - **Rebuilt onto tokens**: `HeroSection` (ink `.display-xl` headline, two pill CTAs, floating mockup, trust pills — removed rainbow gradient text), `TrustedSection` (greyscale wordmark strip + `AnimatedCounter` stats), `WorkflowSection` (5-step ink timeline), `FeatureShowcaseSection` (hairline capability tiles), `AnalyticsShowcaseSection` (Recharts colors driven by `useTheme()` + tokens, replacing `#0070f3`), `NotificationEngineSection` (email/whatsapp/sms preview card), `EngineerMobileSection` (phone frame on `--color-ink`), `CtaSection` (single `.mesh-gradient` flourish + ink headline); `EnterpriseSecuritySection` copy trimmed.
  - **`DashboardPreviewMockup.tsx` color scrub**: replaced all hardcoded `sky/rose/amber/emerald/slate-900` + rainbow glow with semantic tokens — status via `--color-error/warning/success` (+ `-deep`), `color-mix` tints for badges/chips (theme-correct in both modes), chrome/accents → `--color-ink`, filter/toast → `--color-primary`/`--color-on-primary`. Live count + dispatch toast behavior preserved.
  - **`app/page.tsx` rewired**: new `<main>` order Hero → Trusted → EquipmentGallery → Workflow → FeatureShowcase → Analytics → NotificationEngine → EngineerMobile → EnterpriseSecurity → Pricing → Testimonials → FAQ → CTA. Server shell (metadata/JSON-LD/`getCurrentUserOrNull`/`AnimatedBackground`/`LandingHeader`/`LandingFooter`) unchanged.
  - **Deleted** (value folded into gallery + mockup): `ScrollStorySection.tsx`, `PlatformShowcaseSection.tsx`, `DeviceShowcaseSection.tsx` (grep-confirmed no source importers).
  - **Verified**: `tsc --noEmit` clean; banned-literal grep across `components/landing/` → 0 matches. `npm run build` deferred (transient Bash-classifier outage).

## 2026-08-05 (earlier)
- **Vercel Geist Design Redesign — Phase 1 (Token Foundation, from scratch)**:
  - **`app/globals.css` full rewrite** to a single-source-of-truth Geist token sheet. Light `:root` + dark `.dark` palettes with exact DESIGN.md hex values: `--color-ink` #171717, `--color-canvas` #fafafa, `--color-canvas-elevated`, grey ladder (`--color-body`/`--color-mute`/`--color-faint`), hairline set (`--color-hairline`, `--color-hairline-soft`, alias `--color-hairline-soft-surface`), `--color-link` #0070f3 (+ deep/soft), accents (violet/cyan/pink/magenta), semantic error/warning/success (+ deep/soft), and gradient stops. Dark palette: canvas #0a0a0a, elevated #171717, ink #fafafa, body #a3a3a3, hairline #262626, link #3b82f6.
  - **Typography**: 11 type tokens (`--text-*-size/-line/-spacing/-weight`) + utility classes `.display-xl` `.heading-lg` `.heading-md` `.label-sm` `.eyebrow` `.body-lg` `.body-md` `.body-sm`.
  - **Spacing** (4→128 + section), **bimodal radius** (`--radius-sm` 6px app chrome … `--radius-pill` 100px marketing), **3-level elevation** (`--shadow-none/whisper/floating`), **motion suite** (`--motion-instant/fast/normal/slow/slower`, `--ease-out-cubic/spring/smooth`).
  - **`@theme inline` bridge**: maps shadcn-style semantic utilities (`bg-background`/`text-foreground`/`bg-card`/`bg-muted`/`text-muted-foreground`/`border-border`/`bg-primary`/`text-primary`/`ring-ring`/`bg-secondary`/`bg-destructive`) + `--text-*` + radius onto Geist tokens, so the 341 existing semantic-class usages across 24 files keep resolving.
  - **Component base classes** rewritten to consume only tokens: `.card-base`, `.card-elevated`, `.card-hover` / `.card-hover-system`, `.btn-primary/-secondary/-primary-sm/-ghost-sm/-success/-success-sm/-danger/-danger-sm`, `.input-base` (focus ring), `.badge-base`.
  - **Micro-interactions & motion**: `.mesh-gradient` (light + dark, `@keyframes meshFloat`), theme cross-fade (`:root.theme-transitioning *` transitions color props), keyframes `modalScaleIn/toastSpring/staggerReveal/shimmerWave/formErrorEnter/overlayFadeIn/rowExitSlide`, classes `.modal-enter/.modal-overlay-fade/.modal-content-scale/.nav-pill-active/.row-exit-slide/.toast-gpu-enter/.tabular-nums/.stagger-item/.skeleton-shimmer(-active)/.focus-ring/.form-error-enter`, restored 404 face animation block verbatim, scrollbar styling, `prefers-reduced-motion` guard.
  - **`components/theme/ThemeProvider.tsx`**: added smooth theme cross-fade — `setTheme` adds `theme-transitioning` to `documentElement`, applies theme immediately, removes class after 250ms (matches `--motion-normal`). `useTheme()` still returns `defaultContext` outside provider.
  - **`components/ui/Button.tsx`**: consolidated all 8 variants onto token base classes (`btn-primary` etc.), removed inline color strings; preserved `ButtonProps`/`LinkProps`/`Props` types, href-based `Link` rendering, loading spinner.
  - **Verified**: `npx tsc --noEmit` clean; `npm run build` clean (16 routes).
  - **Note**: audit confirmed the existing `components/ui/*` primitives (Card, Input, MetricCard, Modal, Toast, Spinner, EmptyState, Badge, Skeleton), `ThemeToggle`, and `components/layout/MobileBottomNav` already consume the Geist token system with premium framer-motion micro-interactions — the token foundation was the real gap. Per-file rewrites of remaining leaf surfaces (landing + app domain) are pending an Agent-classifier outage.
- **Automated Daily Summary Email System (Super Admin + Engineer)**:
  - **Migration `008_daily_summary_notifications.sql`**: Made `notifications.machine_id` nullable (summary emails are not machine-bound), added `engineer_summary` alert type to the CHECK constraint, added `payload` and `provider_response` jsonb columns, created a partial unique index `idx_notifications_summary_idempotency` on `(recipient_id, alert_type, alert_date, channel) WHERE machine_id IS NULL AND alert_type IN (daily_summary, engineer_summary, weekly_report, monthly_report)` for idempotency, and added `idx_notifications_recipient_id` / `idx_notifications_alert_type` indexes.
  - **`lib/email.ts`**: Upgraded to `sendEmailWithTracking()` — returns real SendGrid `X-Message-Id`, provider response (statusCode/body/headers), attempt count, and error. Configurable retry (default 2 retries with 1.5s delay). `sendEmail()` kept as a boolean wrapper for legacy auth/import emails.
  - **`lib/notifications/email-templates.tsx`**: Added full ServiceCentric-branded responsive super admin daily summary HTML/text templates (`getAdminDailySummaryEmailHtml`, `getAdminDailySummaryEmailText`) with KPI cards (Active Machines, Added Today, Completed Today, Due Today, Due Tomorrow, Overdue, Alerts Sent, Alerts Failed), Machines Added Today table, Machines Due Tomorrow table (with customer + engineer phone/email), Overdue table (longest overdue first, last service date), Services Completed Today table, per-channel notification summary, dark-mode support, and "Open Dashboard" CTA. Added engineer summary templates (`getEngineerDailySummaryEmailHtml`, `getEngineerDailySummaryEmailText`) with due-tomorrow machines, overdue machines, completed services today, and a friendly reminder box. HTML escaping uses char-code constants to survive editor auto-formatting.
  - **`lib/notifications/daily-summary.ts`** (NEW): Batched Supabase data fetchers (`fetchAdminDailySummaryData`, `fetchEngineerDailySummaryData`) using the admin client — active machines, new machines today, services completed today (with machine + engineer joins), notification stats by channel for today, engineer assigned machines. Includes `getDailySummaryContext()` (date helpers) and `hasSummaryNotification()` idempotency check.
  - **`app/actions/send-reminders.ts`**: Rewritten orchestration. PART 1: per-machine service reminders (engineer + customer emails) with `provider_response` + `retry_count` captured from the new `sendNotification` result. PART 2: super-admin daily summaries — only `role = super_admin` + active, idempotency-checked, payload stored for retry. PART 3: engineer daily summaries — individual data fetched per engineer, only sent when relevant data exists (due tomorrow / overdue / completed today), idempotency-checked, payload stored. PART 4: audit log with per-group sent/failed/skipped counts. Cache tags revalidated.
  - **`app/actions/notifications.ts`**: `resendNotification()` now detects summary alert types and replays the stored HTML/text payload via `sendEmailWithTracking`, persisting the new provider response alongside `retry_count` and status.
  - **`lib/queries/notifications.ts`**: Search now covers recipient email/name, machine code/name, message IDs, plus error messages. Added `date_from` / `date_to` filters on `alert_date`. Select now includes `payload` + `provider_response`.
  - **`app/(app)/notifications/page.tsx`**: Passes `date_from` / `date_to` searchParams through to the query + client.
  - **`components/notifications/NotificationListClient.tsx`**: Alert-type filter options expanded to include Today, Tomorrow, Overdue, Daily Summary, Engineer Summary, New Machine, System Error; added date-range filter inputs; search placeholder widened to "Search recipient / machine...".
  - **`components/notifications/NotificationPreviewModal.tsx`**: Summary notifications now render the actual stored HTML email via `dangerouslySetInnerHTML` (scrollable preview) instead of the generic chat bubble; added a Provider Delivery Response viewer that pretty-prints the stored `provider_response` jsonb.
  - **`lib/types/database.ts`**: `machine_id` now `string | null`; added `payload` + `provider_response` to `Notification`; added `engineer_summary` to `AlertType`.
- **Theme Engine Resilience & Minimal MetricCard Refinement**:
  - **React 19 / Next 16 Script Warning Fix**: Added `suppressHydrationWarning` to the `<script>` tag in `ThemeScript.tsx`.
  - **ThemeProvider Resilience**: Updated `useTheme()` in `ThemeProvider.tsx` to safely return `defaultContext` instead of throwing an unhandled exception if called outside `ThemeProvider`.
  - **MetricCard UI Simplification**: Removed `.inline-flex` trend badge and `"View details"` flex item from `MetricCard.tsx` and `Skeleton.tsx` per user feedback, leaving a clean, high-contrast metric value display.
  - **Uniform Equal Grid Sizing**: Fixed lopsided/uneven metric cards on `/dashboard` by replacing mixed flex/grid classes with responsive CSS grid (`grid-cols-2 md:grid-cols-4` for admin / `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6` for non-admin) with `items-stretch`.
  - **MetricCard & Skeleton Alignment**: Updated `MetricCard.tsx` and `Skeleton.tsx` so `<motion.div>` and `<Card>` fill 100% height and width (`h-full w-full flex flex-col justify-between`) and added uniform spacer footers (`h-4 mt-auto pt-1`) when `href` is absent.
  - **Growth/Loss Percentage Indicators**: Calculated real-time percentage indicators on metric cards: Month-over-Month service completion growth/loss rate (`+14.2% MoM` / `-5.0% MoM`), 30-day overdue reduction rate (`-20% 30d`), active fleet uptime percentage (`92% active`), and alert delivery success rate (`98% rate`).
- **Dashboard 8-Metric Dynamic Single-Row Layout**: Restored all 8 metric cards (`Total Fleet`, `Active`, `Due Today`, `Due Tomorrow`, `Overdue`, `Completed`, `Alerts Sent`, `Alerts Failed`) to `/dashboard`. Configured layout to fit in **1 single row on desktop** (`lg:flex lg:w-full lg:items-stretch lg:flex-1`) with dynamic width distribution, and **2 rows of 4 cards on mobile** (`grid-cols-4`).
  - **Dashboard Header & Recent Activity Removal**: Removed welcome title ("Welcome back...") and subtitle from `/dashboard` across all roles. Removed `DashboardRecentActivitySection` & `getRecentActivity()` data fetching from `/dashboard` (audit logs accessible on `/audit-logs`).
  - **Dashboard Single-Row Executive KPI Grid**: Streamlined top KPI metrics into a single-row desktop grid (`grid-cols-2 md:grid-cols-4`) featuring 4 high-level KPI cards (Total Fleet, Active Operating, Due Today, Overdue).
  - **PublicNavbar Logo Dual-Theme Outline**: Added a thin black outline in light theme and thin white outline in dark theme (`filter drop-shadow-[0_0_1px_rgba(0,0,0,0.85)] dark:drop-shadow-[0_0_1px_rgba(255,255,255,0.85)]`) to the brand logo in `PublicNavbar.tsx`.
  - **MachineModal Streamlining**: Cleaned up `MachineModal.tsx` by removing redundant hints, long verbose description paragraphs, and 5 heavy wrapper cards, converting it into a clean, compact 2-column modal layout.
  - **Dark Mode Token Contrast Fixes**: Replaced hardcoded white-on-white text tokens (`bg-[var(--color-ink)] text-white`) with adaptive theme tokens (`bg-[var(--color-ink)] text-[var(--color-canvas)]`) across `MachineListClient.tsx` (all-filter button, stat cards, FAB), `users-client.tsx` ("All Roles", "All Status", avatar circles, FAB), and `UserDetailSheet.tsx` (avatar circle).
- **Enterprise Dual-Theme System (Light + Dark)**:
  - **Design Token System (`globals.css`)**: Overhauled OKLCH color token architecture. Mapped standard CSS color pairs (`--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring`) alongside existing `--color-*` variables to ensure backward compatibility and dark mode theme switching.
  - **Anti-FOUC Head Script (`ThemeScript.tsx`)**: Created synchronous inline head script that reads `localStorage` or `prefers-color-scheme: dark` before page paint, injecting `.dark` or `.light` classes and `color-scheme` to eliminate flash of unstyled content.
  - **Theme Provider (`ThemeProvider.tsx`)**: Created React Context provider supporting `"light" | "dark" | "system"` modes, system theme media query listeners, and `localStorage` key `servicecentric-theme`.
  - **Animated Theme Toggle (`ThemeToggle.tsx`)**: Created Framer Motion 12 spring-animated theme toggle button featuring Sun <-> Moon morphing icons, particle glow halo, and popover theme selection menu. Integrated into `PublicNavbar.tsx`, `MobileBottomNav.tsx`, `LoginPage`, `SignupPage`, and `ForgotPasswordPage`.
  - **Core UI Primitives Migration**: Updated `Table.tsx`, `SearchableSelect.tsx`, `Badge.tsx`, `Tooltip.tsx`, `MetricCard.tsx`, `CommandPalette.tsx`, and `CookieConsent.tsx` to use semantic theme tokens.
  - **Recharts Dynamic Dark Mode (`Charts.tsx`)**: Integrated `useTheme()` hook into Recharts `MonthlyServicesChart` and `OverdueTrendChart`, dynamically updating SVG tooltip background (`#161D27` / `#ffffff`), borders, gridlines (`rgba(255,255,255,0.08)`), and tick text colors.
  - **Feature Views & Pages**: Updated `MobileDashboardHeader`, `MobileDueBuckets`, `ServicesClient`, `AuditLogsClient`, `UserRow`, `MobileUserCard`, `NotificationPreviewModal`, `LoginPage`, `SignupPage`, `ForgotPasswordPage`, and `NotFound` 404 page for dark mode compatibility.

## 2026-08-04
- **Code Quality Pass & Performance Optimization (Full Codebase Audit)**:
  - **Lint & TypeScript Cleanup**: Fixed all 24 TypeScript errors and 58 ESLint warnings across the entire codebase.
  - **Removed Unused Imports/Variables**: `UserX` in `app/(app)/users/users-client.tsx`; `ReactNode` in `components/ui/Select.tsx`; `metadata` parameter in `lib/notifications/sms.ts` (`sendSMS`) and `lib/notifications/whatsapp.ts` (`sendWhatsAppMessage`); `today`/`tomorrow` variables in `lib/notifications/templates.ts`.
  - **Aligned Function Signatures**: Updated `sendNotification` in `lib/notifications/index.ts` to call `sendSMS` and `sendWhatsAppMessage` with 2 args (matching the removed `metadata` parameter), eliminating TypeScript errors.
  - **Dashboard Cache Lookup Optimization**: `DashboardChartsSection` now calls `getDashboardCharts()` once (via `Promise.all` → single `cache()` call) instead of two separate `getMonthlyServices()` + `getOverdueTrend()` calls. `DashboardDueListsSection` now calls `getDashboardDueLists()` once instead of three separate `getDueMachines()` calls. This reduces redundant `unstable_cache` lookups from 5 to 2 per request.
  - **MobileDueBuckets Memoization**: Added `useMemo` for the tab configuration array and `useCallback` for `renderItemList` in `components/dashboard/MobileDueBuckets.tsx` to prevent unnecessary array reconstruction and function recreation on re-renders.
  - **Files Changed**: `app/(app)/users/users-client.tsx`, `components/ui/Select.tsx`, `lib/notifications/sms.ts`, `lib/notifications/templates.ts`, `lib/notifications/whatsapp.ts`, `lib/notifications/index.ts`, `app/(app)/dashboard/page.tsx`, `components/dashboard/MobileDueBuckets.tsx`.
- **Bulk Machine Import Feature (`/machines`)**:
  - Implemented Excel bulk import with drag-and-drop upload, auto-generated machine codes (MCH-XXXXXX), comprehensive validation (required fields, Indian mobile numbers, engineer name matching), detailed error reporting with row numbers, sample template download, audit logging, and cache invalidation.
  - Created `components/machines/MachineImportModal.tsx` for the import UI and `app/actions/machine-import.ts` with `importMachinesFromExcel()` server action and `getSampleExcelTemplate()` helper.
- **Mobile & Header UI/UX Feedback Polish (`/machines`, `/users`, `MobileBottomNav`)**:
  - **Mobile Profile Drawer Search Button**: Removed redundant "Search Command Palette ⌘K" button from the mobile profile slide-up drawer in `MobileBottomNav.tsx`.
  - **Machine List Header Description & Add Button**: Removed description paragraph from `PageHeader` in `MachineListClient.tsx` and hidden the `Add Machine` header button on mobile screens (`hidden sm:inline-flex`).
  - **Machine List Mobile FAB**: Updated the mobile floating action button (FAB) in `MachineListClient.tsx` to trigger the `MachineModal` for adding a machine.
  - **Users Management Header Invite Button**: Added responsive hiding (`hidden sm:inline-flex`) to the `Invite New User` button in `PageHeader` in `users-client.tsx`.
- **Audit Log Email Tracking & Super Admin Role-Based Privacy Protection (`/audit-logs`)**:
  - **Auth & User Action Metadata Enrichment**: Updated `app/actions/auth.ts` and `app/actions/users.ts` to capture full actor and target user metadata.
  - **Super Admin Role-Based Privacy Redaction**: Added server-side sanitization in `lib/queries/audit-logs.ts` (`getAuditLogsFiltered`).
  - **Rich Event Descriptions**: Updated `getAuditLogDescription` in `lib/audit-helpers.ts` to output complete contextual sentences.
  - **UI Email Display**: Updated `AuditLogsClient.tsx` row header line to display actor email IDs.
- **Audit Log Action Formatting & User-Friendly UX (`/audit-logs` & `/dashboard`)**:
  - Created `lib/audit-helpers.ts` containing a central map of all audit action codes, dynamic fallback humanizer, color badge variant generator, and contextual metadata summary sentence generator.
  - Replaced dot-separated raw action keys with clean, human-readable titles across `/audit-logs` and `/dashboard` Recent Activity feed.
- **Navbar Layout Alignment, KBD Shortcut Badge Removal & Machine Table Cell Refinements**:
  - **Machine Name & Code Table Column**: Updated `EnterpriseTable` column definition in `MachineListClient.tsx`.
  - **Machine Detail Page Hero Header**: Updated `machine-client-view.tsx` hero banner.
  - **PublicNavbar Search Button**: Removed the `<kbd>⌘K</kbd>` keyboard shortcut badge element from the search button.
  - **Navbar Alignment**: Updated `PublicNavbar` container width to `max-w-[1400px] px-4 lg:px-6`.
- **Users Page Approval Button UX Fixes**:
  - Added `success` / `success-sm` button variants to `components/ui/Button.tsx`.
  - Changed Approve button in pending approvals section to `success-sm`.
  - Fixed shared loading state bug in `app/(app)/users/users-client.tsx`.
- **Users Page Deactivate Button Enhancement**:
  - Added `Power` icon to the Deactivate/Activate button in `UserRow.tsx`.
- **Mobile Dashboard Header & Navbar Search Button Polish**:
  - Removed `<RefreshButton>` from `MobileDashboardHeader.tsx`.
  - Expanded search button width in `PublicNavbar.tsx`.
- **Dashboard Header, Public Navbar & Command Palette UI Polish**:
  - Removed "Open Command Palette Search" button and "Live Engine Active" badge from `MobileDashboardHeader.tsx`.
  - Removed "Live Engine Active" badge from desktop `PageHeader` on `/dashboard`.
- **Page Caching System & Targeted Database Refresh Buttons**:
  - Configured Next.js App Router client router cache (`staleTimes: { dynamic: 60, static: 180 }`) in `next.config.ts`.
  - Created `refreshPageDataAction` server action (`app/actions/refresh.ts`).
  - Created reusable `RefreshButton` client component.
- **Top 10 Dashboard Activity Feed & Dedicated Audit Logs Page (`/audit-logs` & `/dashboard/logs`)**:
  - Limited Recent Activity feed card on `/dashboard` to top 10 newest logs.
  - Built server-side filtered data access layer query in `lib/queries/audit-logs.ts`.
  - Created `AuditLogsClient.tsx` interactive UI.
- **Signup Mobile Number + Error Handling Improvements**:
  - Added Mobile Number input to `/signup`.
  - Improved signup error handling and user-facing messages.
- **Production-Grade Audit & Security Enhancements**:
  - Audited all Server Actions (`app/actions/*`) and API endpoints (`api/cron`).
  - Secured cron route and resend actions.
- **JS Bundle Size Optimization (Dynamic Imports)**:
  - Dynamically loaded heavy React components using `next/dynamic` with `ssr: false`.
-   A d d e d   S Q L   i n j e c t i o n   d e f e n s e s   ( a l l o w e d   s o r t   m a p p i n g s ,   P o s t g R E S T   f i l t e r   s a n i t i z a t i o n ,   U U I D   t y p e   v a l i d a t i o n ) 
 
 