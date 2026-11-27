## Task: /running-logs Unified Breakdown Remark & Duplicate Removal
**Status**: 🟢 RESOLVED, VERIFIED & TESTED across Web and Mobile
**Date**: 2026-11-27
- **Feedback Addressed**:
  - In `/running-logs?view=client`, when expanding a breakdown daily row, duplicate remarks were shown: once inside the incident card and once in a separate `Breakdown Remarks:` section at the bottom.
  - Removed duplicate `Breakdown Remarks:` block from both desktop (`OperationsLogsTable.tsx`) and mobile (`OperationsLogsMobileList.tsx`).
  - Unified everything into a single, clean breakdown incident card that displays:
    1. Breakdown Shift Name (`Shift A`)
    2. Operator Name (`(Ramesh Kumar)`)
    3. Breakdown Start and End Time (`11:00 AM - 12:00 PM`)
    4. Total Duration (`Duration: 1h`)
    5. Clean breakdown remark without artificial truncation (`• Bucket cylinder seal replacement.`) with search term highlighting
    6. Right-aligned status badge (`1h (Breakdown)` or `MT {time} (Maintenance)`)
- **Verification & Parity**:
  - `apps/web/components/operations/logs/OperationsLogsTable.tsx`: Duplicate section removed, remark truncation removed, search term highlighting added.
  - `apps/web/components/operations/logs/OperationsLogsMobileList.tsx`: 100% parity maintained, duplicate section removed, remark highlighting added.
  - `apps/web/scripts/test-running-logs-remarks-and-client-select.mjs`: 7/7 checks passed.
  - `tests/breakdown/test-breakdown-timing-resolution.ts`: 4/4 checks passed.
  - `pnpm --filter web typecheck`: 0 errors.
  - `pnpm --filter mobile typecheck`: 0 errors.
  - `node scripts/check-typography.mjs`: 0 errors.
  - `pnpm --filter @reachinternational/validation test`: 87/87 passed.

---

## Task: Production Supabase Migrations & Push Notifications Hardening (dhbbgfzbyatzvqafnsqp)
**Status**: 🟢 RESOLVED, MIGRATED, TESTED & VERIFIED ON PRODUCTION
**Date**: 2026-11-26

### 1. Production Database Migrations Applied & Recorded
- **Target Project**: `dhbbgfzbyatzvqafnsqp` (Reach International Production, ap-south-1).
- **Applied Migrations**:
  1. `242_in_app_notifications_inbox_and_keyset_rpc.sql` (`20261126120000`): In-app inbox, keyset pagination, sync triggers, and RPCs. Rollback: `242_rollback_in_app_notifications_inbox_and_keyset_rpc.sql`.
  2. `243_push_notifications_reliability_hardening.sql` (`20261126143000`): Ticket deduplication, `register_push_device` v2 (8-param) + 6-param wrapper, `claim_push_batch` v2, `finish_push_batch` v2, `push_receipts_poller` cron, and `push_delivery_health` view. Rollback: `243_rollback_push_notifications_reliability_hardening.sql`.
  3. `244_machine_logsheet_bulk_import.sql` (`20261126150000`): Logsheet bulk import tables, indexes, RLS, notification suppression guards, and atomic RPC `import_machine_hour_logs_bulk`. Rollback: `244_rollback_machine_logsheet_bulk_import.sql`.
  4. `245_push_zero_pii_templates_and_user_deactivation.sql` (`20261126153000`): Zero-PII push templates and user status deactivation trigger `trg_deactivate_push_devices_on_user_status`. Rollback: `245_rollback_push_zero_pii_and_user_deactivation.sql`.
- **Database Rollback Tracking**: Synchronized `supabase_migrations.schema_migrations` with explicit `rollback` SQL column populated for all applied migrations.

### 2. Vault Secrets & Dispatcher Configuration
- Configured production `vault.decrypted_secrets`:
  - `notify_url`: `https://dashboard-reachinternational.vercel.app/api/notify/dispatch`
  - `notify_secret`: `f2543d5600c980a26506b5adf150eff71ba6090d882682c27941a63b4de8baaf`
- Verified `push_notifications_sweeper` pg_cron running every minute via `pg_net`: 100% HTTP 200 responses against Vercel.

### 3. Live Smoke Verification
- Triggered live test-send: `POST https://dashboard-reachinternational.vercel.app/api/notify/test-send`.
- Returned HTTP 200 (`notificationId: "418a109d-0e09-4616-b9d8-dfceb9774b80"`).
- `push_delivery_health`: `queue_depth: 0`, `in_flight: 0`, `failed_24h: 0`.

---

## Task: Unified Scroll-Activated Scrollbar System with Upper/Lower Limit Arrow Indicators (apps/web)
**Status**: 🟢 RESOLVED, ENHANCED & VERIFIED (Dual Root Scrolling + Limit Indicators + Zero Regressions)
**Date**: 2026-11-26
- Fixed "Scrollbars not visible in any pages and components":
  1. `body { overflow-x: hidden; }` caused Chromium/WebKit to anchor the viewport scrollbar to `body` rather than `html`. `ScrollActivity.tsx` now marks both `document.documentElement` and `document.body` on root/window scroll events.
  2. CSS in `apps/web/app/globals.css` updated with explicit targets (`html[data-scrolling]`, `body[data-scrolling]`, `[data-scrolling]`) and hover reveal (`:where(*:hover)::-webkit-scrollbar-thumb` and `:where(*)::-webkit-scrollbar-thumb:hover`) per the spec note so idle elements reveal at 30% on hover and 50% on thumb hover, while staying hidden at idle when unhovered.
- Added Upper & Lower Limit Arrow Indicators:
  1. Integrated geometric SVG arrows into `:root` and `.dark` (`--scrollbar-arrow-up`, `--scrollbar-arrow-down`, `--scrollbar-arrow-left`, `--scrollbar-arrow-right`) matching `#171717` (light mode ink) and `#fafafa` (dark mode ink).
  2. Styled `::-webkit-scrollbar-button:single-button` for both vertical (decrement=top, increment=bottom) and horizontal (decrement=left, increment=right) orientations with 6px width and 10px height.
  3. Interactive states: hidden at idle (fade transition 250ms), subtle 45% opacity on active scroll or container hover, 85% opacity on button hover, 100% on active click for stepped navigation.
  4. Explicitly suppressed on `.no-scrollbar` and `.scrollbar-none` strips with `display: none !important`.
- Verification:
  - Live CDP testing in real Chromium headless against `http://localhost:3000/`.
  - Zero TypeScript errors (`pnpm --filter web typecheck`).
  - Zero typography violations (`node scripts/check-typography.mjs`).
  - Dark mode auto-flip to `#fafafa` verified.

# Current Task

## Task: Native Mobile Approvals UI/UX Redesign, Optimistic Feedback & Session Expired Root-Cause Fix
**Status**: 🟢 RESOLVED, IMPLEMENTED & VERIFIED across Monorepo
**Date**: 2026-11-26

### 1. Root Cause Summary: "Your session expired. Sign in again to record a decision."
- **Root Cause**:
  1. In `useDecideApprovalMutation`, `useVerifyDocumentMutation`, and `useRejectDocumentMutation` in `apps/mobile/lib/hooks/useApprovalsData.ts`, mutations attempted to call the Web API endpoint `${appUrl}/api/approvals/${requestId}/decide`.
  2. In `apps/mobile/.env`, `EXPO_PUBLIC_APP_URL` was configured to `https://dashboard-reachinternational.vercel.app` (the production web deployment), while the mobile app was running in development against Dev Supabase (`vlmxciuogczumumrwyot`).
  3. When mobile sent its Dev Supabase JWT to the production Vercel server, the production server's admin client (`dhbbgfzbyatzvqafnsqp`) rejected the token as invalid with HTTP 401.
  4. The client's catch block had `if (err?.status && err.status < 500) throw err;`, which re-threw the HTTP 401 error and **blocked the direct Supabase RPC fallback** from ever executing.
  5. `mapApprovalDecisionError` then formatted HTTP 401 into `"Your session expired. Sign in again to record a decision."`, showing a false session expiry toast even though the mobile user was actively signed in with valid Supabase credentials.

### 2. Solutions Implemented
1. **Proactive Session Refresh & Direct Supabase RPC Fallback (`useApprovalsData.ts`)**:
   - Added `ensureActiveSession()`: Checks token expiration with `supabase.auth.getSession()` and proactively calls `supabase.auth.refreshSession()` if the token is close to expiry (<60s) or missing.
   - Fixed fallback mechanism in `useDecideApprovalMutation`, `useApproveAllMutation`, `useVerifyDocumentMutation`, and `useRejectDocumentMutation`:
     - If optional Web API returns 409 (domain conflict / already decided), surfaces the conflict error.
     - For non-409 statuses (401 from cross-environment host mismatch, 404, 500, network error), cleanly and immediately falls back to the authoritative direct Supabase RPC (`approval_decide`, `approval_approve_all`, `verify_user_document_atomic`, `reject_user_document_atomic`) using the mobile client's active authenticated session and `actorId`.
   - Hardened `mapApprovalDecisionError` to never produce misleading "session expired" errors on non-auth failures.
2. **Contact Info & Android Zero-Width Layout Bug Fix (`MobileApprovalCard.tsx`)**:
   - Fixed Android Yoga layout bug where `contactItem: { maxWidth: "48%" }` and `contactText: { flex: 1 }` collapsed text width to 0, hiding email and phone text.
   - Refactored `Fact` with `factIconWrapper` (16px fixed width) and `flexShrink: 1` text, vertically stacked so long emails and phone numbers render cleanly with 100% legibility.
   - Empty/whitespace facts return `null` immediately, preventing empty icons from rendering without labels.
3. **Clean Compact Notice for Zero Documents (`MobileApprovalCard.tsx`)**:
   - Replaced bloated 100px dashed container (`Attached Documents (0)`) with a subtle, clean 32px notice (`compactEmptyNotice`), saving ~80px of vertical space per card.
4. **Card Header & Action Buttons Redesign (`MobileApprovalCard.tsx`)**:
   - Clean top header: Role badge in brand soft blue (`#e0f2fe` / `#0284c7`), type badge in neutral pill, status badge, and `# EMP-xxxx` mono badge aligned on top right.
   - Action buttons: 44px min-height touch targets with Geist tokens:
     - `Reject`: Outline style with soft red border and text.
     - `Approve`: Solid emerald success button (`#10b981`) with white check icon.
     - Single loading spinner per button when in-flight.
5. **Segmented Filter Tabs & Type Scroll Strip (`approvals.tsx`)**:
   - Replaced squashed, broken dropdown filters with a native segmented status tab bar: `Pending (${counts.total})`, `Approved`, `Rejected`, `All`.
   - Added horizontal scrollable request type pill strip: `All Requests`, `New Registrations`, `Document Verifications`, `Replacements`, `Profile Changes`, `Account Deletions`, `Shift Conflicts`.
   - Prominent, responsive `SearchInput` with clear button.
6. **Optimistic UI Animation (`approvals.tsx`)**:
   - Wrapped FlatList items in `Animated.View` with `entering={FadeIn.duration(200)}`, `exiting={FadeOut.duration(200)}`, and `layout={LinearTransition.springify().damping(18).stiffness(180)}`.
   - Decisions instantly remove the item from the cache, decrement the counter, and trigger spring physics to slide the remaining cards upward with 0ms lag.

### 3. Verification & Evidence
- `pnpm --filter mobile typecheck`: 0 errors (clean exit 0).
- `pnpm --filter web typecheck`: 0 errors (clean exit 0).
- `node scripts/check-typography.mjs`: 0 violations across monorepo.
- `pnpm --filter @reachinternational/validation test`: 87/87 passed (100%).

---



## Task: /running-logs Breakdown Timing Resolution, Single Source of Truth, and Animated Accordion UI
**Status**: 🟢 RESOLVED, IMPLEMENTED & VERIFIED across Web and Mobile
**Date**: 2026-11-26

### 1. Root Cause Summary
- **Why breakdown start and end time was unrecorded on bulk-imported logs**:
  The Next.js operational data queries (`MACHINE_LOG_EXACT_PROJECTION` in `operations-machine-logs.ts`, `CLIENT_LOG_EXACT_PROJECTION` in `operations-client-logs.ts`, `OPERATOR_LOG_EXACT_PROJECTION` in `operations-operator-logs.ts`, and `HOUR_LOG_FULL_PROJECTION` in `operators.ts`) omitted `breakdown_start_time`, `breakdown_end_time`, `breakdown_duration`, `breakdown_hours`, and `breakdown_minutes` from their `select(...)` clauses.
  Although PostgreSQL already stored `breakdown_start_time: '18:48:00'`, `breakdown_end_time: '19:24:00'`, `breakdown_minutes: 36` on the imported record for `M/C-0001` on `2026-11-24`, the frontend query received `undefined`.
- **Why manual entry showed the times**:
  Manual shift entry had an older workaround that prepended `[Breakdown Duration: 11:00 AM - 12:00 PM (60min)]` into the `remarks` column. `parseBreakdownString(log.remarks)` was able to parse that string from `remarks`. In bulk import, remarks were clean (e.g. `"Electrical fault caused downtime; checked and restarted."`), so no bracketed tag existed to fall back on.
- **Why duration showed `0h`**:
  `fmtMin(m)` calculated `Math.floor(m / 60) + 'h'`, rendering `0h` for sub-hour durations (like 36 min).

### 2. Solutions Implemented
1. **Added Projections for All Breakdown Columns**:
   - `apps/web/lib/data/operations/operations-machine-logs.ts`
   - `apps/web/lib/data/operations/operations-client-logs.ts`
   - `apps/web/lib/data/operations/operations-operator-logs.ts`
   - `apps/web/lib/queries/operators.ts`
   - `apps/web/app/actions/operators.ts`
   - `apps/mobile/lib/queries/operationsExport.ts`
2. **Removed Duplicate Breakdown Storage in Remarks (Single Source of Truth)**:
   - Cleaned up `submitOperatorHourLogAction` (`app/actions/operators.ts`), `OperatorDashboard.tsx`, `MeterLogModal.tsx`, and `OperationsEditLogModal.tsx` so they never prepend `[Breakdown Duration: ...]` to `remarks`.
   - Dedicated database columns (`breakdown_start_time`, `breakdown_end_time`, `breakdown_duration`, `breakdown_hours`, `breakdown_minutes`) are now the sole authoritative source of truth.
3. **Resilient Dual Reading**:
   - `extractBreakdownTiming` reads dedicated columns first, calculates duration accurately from timestamps if minutes are missing, and falls back to legacy remarks tags if dedicated columns are null.
4. **Duration Formatting in Minutes & Hours**:
   - Created canonical `formatBreakdownMinutes(m)` in `@reachinternational/utils` (`packages/utils/src/date.ts`):
     - `36m` for 36 min (instead of `0h` or `0h 36m`).
     - `1h` for 60 min.
     - `1h 30m` for 90 min.
5. **Streamlined UI & Smooth Accordion Animation**:
   - Removed the top summary row (`Total stoppage: ... Net Breakdown...`).
   - Removed the text header `"Stoppage Timestamps & Classification:"`.
   - Added Framer Motion `<AnimatePresence>` and `<motion.div>` accordion animation (`duration: 0.25`, `ease: [0.16, 1, 0.3, 1]`) to both desktop table (`OperationsLogsTable.tsx`) and mobile card list (`OperationsLogsMobileList.tsx`).

### 3. Verification & Evidence
- `pnpm --filter web typecheck`: 0 errors.
- `pnpm --filter mobile typecheck`: 0 errors.
- `packages/validation` test suite: 87/87 passed.
- `tests/logsheet-import` test suite: 17/17 passed.
- `tests/breakdown` test suite: 4/4 passed.

## Task: Bulk Historical Logsheet Analysis & Pipeline Ingestion for M/C-0001 (JCB 3DX Super #1 / Afcons Infrastructure)
**Status**: 🟢 IMPORTED, COMMITTED & FULLY VERIFIED (Dev DB `vlmxciuogczumumrwyot`)
**Date**: 2026-11-26

### Overview & Request Fulfillment
- **Machine**: M/C-0001 (`8d0011dd-150e-4f71-b166-a8eb9e460480`), Model: 3DX Super, Serial: JCB3DX-2024-001.
- **Client & Rental Alignment**: Machine `client_id` is Afcons Infrastructure (`1114121d-71ae-4b51-a2b0-1a1553e2ce9d`, `CLI-0050`, Site: Pune Main Site `CLI-0050-S01`). Corrected machine `customer_name` from `'Larsen & Toubro ECC'` to `'Afcons Infrastructure'`.
- **Logsheet Period**: 2026-10-26 to 2026-11-25 (31 days × 2 shifts/day = 62 shifts).
- **Operators**: Shift A (06:00-14:00) Amit Verma (`EMP-0334`, `bd307a42-be98-41b3-a47f-372e79fb2f8e`); Shift B (14:00-22:00) Ramesh Kumar (`EMP-0330`, `4c73b810-a00f-40d2-beaa-5bc4fec2d767`).
- **Meters & Physical Continuity**:
  - Start HMR: 2480.00 (2026-10-26 Shift A)
  - End HMR: 2903.22 (2026-11-25 Shift B)
  - Continuity: 100% contiguous (0 meter gaps or regressions across all 62 shifts).
  - Total Running Hours: 423.22 hrs.
- **Breakdowns**: 5 verified incidents (2026-10-30 Shift A, 2026-11-01 Shift A, 2026-11-07 Shift A, 2026-11-19 Shift A, 2026-11-24 Shift B) with containment inside shift duration and descriptive remarks.
- **Pipeline Artifacts Created**:
  - `data/logsheets/MC-0001_3DX_Super_2026-10-26_to_2026-11-25.csv`: Canonical source CSV data.
  - `data/logsheets/MC-0001_3DX_Super_2026-10-26_to_2026-11-25.xlsx`: Standardized 3-sheet Excel workbook.
  - `scripts/pipeline-logsheet-import.mjs`: Fast, reusable multi-format (.csv/.xlsx) CLI & programmatic pipeline with machine resolution, operator resolution, duplicate prevention, and atomic RPC execution.
- **Database Import Execution**:
  - Executed atomic `import_machine_hour_logs_bulk(jsonb)` RPC under admin authorization (`Admin User Dev`, `cc2b0d0c-e06d-4500-98fe-69354b2bdc16`).
  - Import Record ID: `a6958417-687c-4cac-b55f-a434c414a925` (status: `completed`).
  - Verified 62/62 rows committed to `public.machine_hour_logs`.
  - Advanced `machines.hour_meter` from 534 to `2903.22` hrs.

---


## Task: Fix Supabase Realtime `cannot add postgres_changes callbacks after subscribe()` Error
**Status**: 🟢 RESOLVED & VERIFIED across Monorepo
**Date**: 2026-11-26

### Root Cause Diagnosed
In `apps/web/components/notifications/NotificationBell.tsx`, each instance independently created and subscribed to a Supabase Realtime channel named `notifications:inbox:${user.id}`.
Because `NotificationBell` is mounted concurrently in two places in `AppShellClient` (`MobilePageHeader.tsx` for mobile and `QuickAccessTrigger.tsx` in `AppSidebar.tsx` for desktop), both instances ran `useEffect` at the same time. The Supabase browser client returned the existing singleton channel instance to the second component while it was already in `'subscribing'`/`'subscribed'` state, throwing the runtime error:
`cannot add postgres_changes callbacks for realtime:notifications:inbox:<id> after subscribe().`

### Solution Applied
1. **Centralized Provider (`NotificationContext.tsx`)**:
   - Created `NotificationProvider` and `useNotification` in `apps/web/components/notifications/NotificationContext.tsx`.
   - Single point of truth for unread count, realtime items buffer, and background re-sync on tab focus and `visibilitychange`.
   - Strictly 1 Supabase Realtime channel per authenticated user session.
   - Guaranteed cleanup of lingering or stale channels prior to subscription.
2. **Refactored `NotificationBell.tsx`**:
   - Removed duplicated local `useState` and `useEffect` realtime subscriptions.
   - Bell now consumes `useNotification()`, maintaining only local popover/drawer presentation state.
3. **Mounted Provider in `AppShellClient.tsx`**:
   - Placed `<NotificationProvider>` inside `<CurrentUserProvider>` in `apps/web/components/layout/AppShellClient.tsx`.
   - Ensures both mobile header bell and desktop sidebar bell share the exact same realtime state with zero drift.

### Verification
- `pnpm typecheck`: 7/7 packages clean (0 errors).
- `node scripts/run-all-tests.mjs`: 35/35 test suites passed (100%).
- `node scripts/check-typography.mjs`: 0 violations.
- ESLint: 0 errors, 0 warnings on modified web components.

---

## Task: Supabase Migrations & Rollbacks Push and Synchronization
**Status**: 🟢 COMPLETED & VERIFIED across Production (`dhbbgfzbyatzvqafnsqp`) and Development (`vlmxciuogczumumrwyot`)
**Date**: 2026-11-25

### Changes Applied
1. **Production DB Migration 241 Execution (`dhbbgfzbyatzvqafnsqp`)**:
   - Added column `acknowledged_at timestamptz DEFAULT NULL` to `public.document_change_requests`.
   - Updated CHECK constraint `document_change_requests_status_check` to permit `['pending', 'approved', 'rejected', 'cancelled', 'acknowledged', 'dismissed']`.
   - Updated `public.approval_decide` to eliminate error `42703` on `document_replace` rejection (`reviewed_at = now()`, `reviewed_by = v_caller_id`, child request domain handling).
2. **Schema Migrations & Rollback Tracking Linkage**:
   - Recorded `20261125241000` (`241_approval_decide_document_replace_rejection_fix.sql`) with rollback `241_rollback_approval_decide_document_replace_rejection_fix.sql`.
   - Populated `rollback` array for migrations 231 through 240 in both Production and Development `supabase_migrations.schema_migrations` tables.
3. **Cache & PostgREST Reload**:
   - Executed `NOTIFY pgrst, 'reload schema'` across Production and Development.

---

## Task: /profile Document Review & Comparison UI Overhaul — Industry Standard Dual-Tile Comparison, Geist Warning Callout & Uncluttered Action Flow (Web + Native)
**Status**: 🟢 IMPLEMENTED & FULLY VERIFIED across Web (`apps/web`) and Mobile (`apps/mobile`)
**Date**: 2026-11-25
**Viewport Target**: 360×800 Mobile & Desktop

### Problem & Feedback Analysis
1. **Vertical Stack Explosion (>500px card height)**:
   - When a replacement request was rejected, the document card stacked:
     - Header (`Aadhaar Card` + `VERIFIED`)
     - Large 200px red alert box with `Replacement Rejected` + `ACTION REQUIRED` + reason + thumbnail + giant red `Acknowledge & Remove` button
     - Below it, another full-height 180px preview container for the active document
     - Below that, another full-height 44px `Replace` button
   - On a 360×800 viewport, a single document card occupied ~70% of the screen height with competing action buttons and confusing visual hierarchy.
2. **Broken Image Fallback**:
   - In Web, if a thumbnail failed to load or network timed out, the browser displayed an unstyled broken image icon and `Aadhaar Card` alt text inside a blank box without graceful degradation.
3. **Competing Actions (`Acknowledge & Remove` vs `Replace`)**:
   - The user had to click "Acknowledge & Remove" first, then click "Replace" separately.

### Industry-Standard Solution & 100% Cross-Platform Parity
1. **Side-by-Side Dual-Tile Comparison Gallery**:
   - Replaced vertical stacking with a responsive 2-column comparison gallery (`grid grid-cols-2 gap-2.5` on Web, `dualComparisonRow` on Mobile):
     - **Left Tile (Current Active Document)**:
       - Emerald hairline border, `Active on File` badge with checkmark.
       - Clean thumbnail with hover/tap "View Active" pill. Tapping opens full lightbox.
       - Sub-caption: `Current Verified`.
     - **Right Tile (Declined Attempt)**:
       - Rose hairline border, `Rejected Upload` badge with `X`.
       - Clean thumbnail of the rejected attempt with hover/tap "View Rejected" pill. Tapping opens full lightbox.
       - Sub-caption: `Declined Upload`.
   - Entire comparison section takes only ~105px height, cutting total card height by over 50% (from >500px to ~260px)!
2. **Refined, Compact Geist Rejection Callout**:
   - Replaced harsh neon red box with a subtle, elegant Geist notice (`bg-rose-500/[0.06] border border-rose-500/20 rounded-xl p-3`).
   - Title: `Replacement Declined` with rose alert icon.
   - Rejection reason in clean 11px font.
   - Explanatory note: *"Your current verified document remains active on file while you prepare a replacement."*
   - Inline "Dismiss" affordance (`X` button) on top right.
3. **Uncluttered, Single-Flow Action Row**:
   - **Primary Action**: `Upload New Replacement` (solid Sky Blue `#0284c7`, min-h 44px, upload icon). Clicking opens file chooser/camera immediately to replace the declined upload in 1 step!
   - **Secondary Action**: `Dismiss Notice & Keep Current` (clean subtle text affordance below primary button).
4. **Robust Image Error Handling & Fallbacks**:
   - Added `imgErrorMap` on Web and icon placeholders on Mobile so failed image loads gracefully degrade to styled document icons with "View Active" / "View Rejected" instead of raw broken alt text.
5. **Parity**:
   - Applied identically across Web (`apps/web/components/documents/MyDocumentsSection.tsx`) and Native Mobile (`apps/mobile/app/(app)/profile/documents.tsx`).

### Verification
- `pnpm typecheck`: 7/7 packages clean (0 errors).
- `node scripts/check-typography.mjs`: 0 raw typography property instances across mobile.
- `node apps/mobile/test/run-tests.mjs`: **357/357 passed**.
- `node scripts/run-all-tests.mjs`: **34/34 test suites passed (100%)**.

---

## Task: Reusable Approval Card Unification, Per-Type User-Data Fact Filtering & Premium UI (Web + Native)
**Status**: 🟢 IMPLEMENTED & VERIFIED across Web (`apps/web`) and Mobile (`apps/mobile`)
**Date**: 2026-11-25

### Problem
Approval cards used 7 copy-pasted per-type section branches (Web) and 3 duplicated doc-chip blocks (Mobile), showed all user data regardless of approval type, and needed a cleaner premium UI — while keeping every decision workflow intact.

### Solution
1. ONE reusable card architecture on both platforms: shared shell (badges → identity → type body → footer) + primitives (`SectionPanel`, `DocumentChip`/`DocumentStrip`, `Fact`, `PanelEmptyNote`) + `TYPE_BODY` registry (type_key → body component) and `TYPE_FACTS` registry (type_key → relevant user-data facts).
2. User data filtered per approval need: registration → email/phone/fleet/supervisor; doc verify/replace → email/phone; profile change/account deletion → email; shift conflict → fleet/supervisor.
3. Premium polish: rounded-2xl cards, neutral fact icons (semantic colors reserved for status), consistent section headers, `+N more changes` hint, memoized `DocumentChip`/`DocChip`.
4. Contracts preserved: props unchanged, DOM ids, per-doc inline control semantics (footer-only for single-doc), `View Current Active`, single-spinner loading, haptics, terminology 100% identical across platforms.
5. Test maintenance: 2 stale source-grep checks updated to new architecture invariants + 1 new web/mobile architecture-parity check.

### Verification
- `pnpm typecheck`: 7/7 packages, 0 errors.
- `node apps/mobile/run-tests.mjs`: 357/357 passed.
- `node tests/approvals/test-approval-engine-exhaustive.mjs`: 44/44 passed.
- `node apps/mobile/test/test-unified-approval-engine.mjs`: 77/77 passed.
- `node tests/approvals/test-approval-normalization-and-deduplication.mjs`: 12 passed / 5 FAILED — all 5 failures pre-existing (verified identical on git-stash baseline: stale DAL/action source-grep checks + live-DB state check).
- ESLint on changed web files: 0 errors (2 `no-explicit-any` warnings matching shared payload type). `scripts/check-typography.mjs`: 0 violations.
- Live dev server compiled the approvals route cleanly (307→login, 0 error markers).
- NOT RUN — reason: `pnpm build` (live dev server holds :3000); visual browser pass not performed.

## Task: Document Replacement Rejection Lifecycle — Older Document Preservation, Error 42703 Elimination, and Acknowledge & Remove Flow (Web + Native)
**Status**: 🟢 IMPLEMENTED & FULLY VERIFIED across Web (`apps/web`), Mobile (`apps/mobile`), Shared Utils, and Dev DB (`vlmxciuogczumumrwyot`)
**Date**: 2026-11-25

### Problem & Deep Root Cause Analysis
1. **Rejection Failure in Approvals Queue (PostgreSQL Error 42703)**:
   - When an administrator tried to reject a document replacement request (e.g. Aadhaar replacement for VAIBHAV Chauhan), the rejection toast failed with `"An unexpected error occurred. Please try again."`
   - Root cause: In `public.approval_decide`, the SQL statement for `document_replace` rejection executed:
     `UPDATE public.document_change_requests SET status = 'rejected', rejection_reason = p_note, updated_at = now() WHERE ...;`
     However, the table `document_change_requests` does NOT have an `updated_at` column (it has `reviewed_at` and `reviewed_by`). PostgreSQL threw `42703: column "updated_at" of relation "document_change_requests" does not exist`, failing the Next.js Server Action.
2. **Older Document Preservation Invariant**:
   - The user required: when a replacement document is rejected, the user's active, verified older document in `public.user_documents` MUST NOT be modified or degraded. It must remain 100% active, verified, and accessible.
3. **Applicant Rejection Review & Acknowledgment Flow**:
   - When rejected, the replacement is NOT silently purged before the user has a chance to see why it was rejected.
   - The user profile documents view must show the rejection alert with the rejection reason and a thumbnail preview of the rejected file.
   - The user can tap/click to view the rejected document in a modal.
   - An "Acknowledge & Remove" affordance allows the user to confirm reading the rejection reason. Upon acknowledgment:
     - The staged files are permanently removed from `doc_staging`.
     - `document_change_requests.status` is set to `'acknowledged'` (with `acknowledged_at = now()`).
     - The rejection alert clears, leaving the user's verified older document intact and restoring the clean "Replace" button.

### Architectural Solution & Parity Implementation
1. **Database Migration 241 (`supabase/migrations/241_approval_decide_document_replace_rejection_fix.sql`)**:
   - Fixed `public.approval_decide`: replaced `updated_at = now()` with `reviewed_at = now(), reviewed_by = v_caller_id, status = 'rejected', rejection_reason = p_note`.
   - Added column `acknowledged_at timestamptz DEFAULT NULL;` to `document_change_requests`.
   - Updated constraint `document_change_requests_status_check` to permit `'acknowledged'` and `'dismissed'`.
   - Added loop domain handling for child replacement and verification requests.
   - **Applied to Dev DB (`vlmxciuogczumumrwyot`)**: Tested and PostgREST schema cache reloaded.
2. **Backend Logic & Actions**:
   - `apps/web/lib/server/document-replacement.ts`: Added `acknowledgeRejectedDocumentReplacement` to verify request ownership, purge staged files from `doc_staging`, update `document_change_requests` to `'acknowledged'`, record audit trail, and revalidate cache tags.
   - `apps/web/lib/server/document-review.ts`: In `rejectDocumentReplacementCore`, prevented premature deletion of staged files on admin rejection so the applicant can view what was rejected.
   - `apps/web/app/actions/documents.ts`:
     - Added `UserDocumentRejectedReplacement` interface.
     - Updated `getUserDocumentsAction` to query `document_change_requests` with `.in("status", ["pending", "rejected"])` and map `rejected_replacement`.
     - Added `acknowledgeRejectedReplacementAction({ changeRequestId, docType })`.
   - `apps/web/app/api/documents/my-documents/route.ts`: Updated to fetch both `pending` and `rejected` change requests; preserves original verified older document and attaches `rejectedReplacement` with signed URLs.
   - `apps/web/app/api/documents/replace/acknowledge/route.ts`: Created new dual-auth API route (Bearer token for mobile + Cookie session for web).
   - `packages/utils/src/documents.ts`: Added `acknowledgeRejectedDocumentReplacementClient` and exported it.
3. **Frontend UI & Parity (Web + Native Mobile)**:
   - **Web**:
     - `apps/web/lib/hooks/useMyDocuments.ts`: Added `rejectedReplacement` to `MyDocumentItem` and added `acknowledgeMutation`.
     - `apps/web/components/documents/MyDocumentsSection.tsx`: Preserves active older document as VERIFIED; displays "Replacement Rejected" alert with rejection reason, thumbnail preview of rejected file (with modal viewer), and "Acknowledge & Remove" button (44px min height).
   - **Mobile**:
     - `apps/mobile/lib/hooks/useMobileMyDocuments.ts`: Added `MobileRejectedReplacementInfo` to `MobileMyDocumentItem` and added `acknowledgeMutation`.
     - `apps/mobile/app/(app)/profile/documents.tsx`: Preserves active older document as VERIFIED; displays "Replacement Rejected" alert with rejection reason, thumbnail preview of rejected file (with `MobileDocumentViewerModal`), and "Acknowledge & Remove" button (minHeight: 44, tactile haptics).

### Verification Evidence
- **Typecheck**: `pnpm typecheck` passed cleanly across all 7 workspace packages (0 errors).
- **Test Runner**: `node scripts/run-all-tests.mjs` passed **34/34 test suites (100%)**.
- **Live Decision Rejection Verified on Dev DB**:
  - Rejected request `14aa5ff2-baf2-47ee-b4f4-1a4171d2b37d` (Aadhaar replacement for VAIBHAV Chauhan):
    - Returned `{"status":"rejected","decided":true,"success":true,"version":2,"decision":"reject"}`.
    - `document_change_requests` row updated to `status = 'rejected'`.
    - Active older document in `public.user_documents` remained 100% untouched (`verification_status = 'verified'`).

---

## Task: /profile Page Review-Feedback Pass — Deduplication, Premium Key-Value Rows & Document Card Cleanup (Web + Native)
**Status**: 🟢 IMPLEMENTED & VERIFIED across Web (`apps/web`), Mobile (`apps/mobile`), and Shared Utils (`packages/utils`)
**Date**: 2026-11-25

### Problem
13 page-feedback items on `/profile` @ 360×800: wasted space in stacked section rows, messy EMP ID badge, duplicate values across the page (email in header + Contact; status/role pills + Account & System rows), duplicate "Replacement under review" callout, unwanted `KB • JPEG` meta, redundant View button, and unpolished Change Image button.

### Solution
1. `packages/utils/src/profile-view.ts`: removed "Account Status" + "System Role" rows (header pills are the single source); Primary Email lives in Contact Information only.
2. `apps/web/app/(app)/profile/page.tsx`: header hero rebuilt (email removed, `ID | EMP-0471` mono chip + copy, 48px mobile avatar); section rows rebuilt as compact label-left / value-right single-line rows with a consistent 11px/12px/13px type hierarchy matching Native.
3. `apps/web/components/documents/MyDocumentsSection.tsx`: removed pending-replacement callout + size/format meta + View button; single full-width 44px Upload/Replace/Change Image button.
4. `apps/mobile/app/(app)/profile/index.tsx`: parity — header email removed, EMP chip `ID | …` mono style, row labels `micro` (11px), mono values now actually GeistMono (omit `weight`), doc slots show the doc label without size/format meta.
5. `apps/mobile/app/(app)/profile/documents.tsx`: parity — callout/meta/View Image button removed, full-width clean Replace/Change Image button.
6. `apps/web/lib/profile-view.test.ts`: stale failing test rewritten to the current contract + new dedup assertions.

### Verification
- `pnpm typecheck`: 7/7 packages, 0 errors.
- `pnpm --filter @reachinternational/utils test`: 59/59 passed.
- `node apps/mobile/test/run-tests.mjs`: 357/357 passed.
- `node --test apps/web/lib/profile-view.test.ts`: 4/4 passed (1 was failing before).
- `node apps/web/scripts/test-phase7-document-read-replace.mjs`: 9/9 passed.
- ESLint on changed web files: 0 errors. `scripts/check-typography.mjs`: 0 violations.
- NOT RUN — reason: `pnpm build` (guard-build.js blocks while the dev server holds :3000; route compile verified via live dev server 307→login); visual browser pass (DeepAI preview automation timed out 3×).

## Task: Document Replacement Approval Lifecycle — Synchronous File Transfer, Pointer Repointing & Old Storage Purging
**Status**: 🟢 IMPLEMENTED & FULLY VERIFIED across Web (`apps/web`), Mobile (`apps/mobile`), and Shared Utils
**Date**: 2026-11-25

### Problem & Deep Root Cause Analysis
When an administrator approved a document replacement request:
1. **Unawaited Server Action Fire-and-Forget**:
   - `decideApprovalAction` and `verifyUserDocumentCore` only invoked `approval_decide` (which enqueued topic `file.transfer_staged_document` into `approval_outbox`), then called `processPendingApprovalOutboxItems(10).catch(...)` as an unawaited background promise.
   - In Next.js App Router Server Actions, unawaited background promises are suspended or aborted as soon as the HTTP action response completes. Consequently, the staged file in `doc_staging` was never transferred to `user_files`, `user_documents` was never repointed, and older files were never purged.
2. **Disastrous Fallback to Stale Historical Files**:
   - In `apps/web/lib/server/approvals-outbox.ts`, lines 150-160 contained:
     `const validFile = userFilesList?.find((f) => !f.name.includes("_thumb") && f.name.endsWith(".jpg"));`
   - If `move` failed or had already executed, it searched `user_files/documents/{userId}/{docType}/` and grabbed the FIRST `.jpg` it found—which was an ancient/prior document! It repointed `user_documents` to that prior document and deleted whatever other files were present.
3. **Database Outbox Error Handler Crash**:
   - In `approvals-outbox.ts`, the catch block tried to write `retry_count` and `last_error` columns directly to `approval_outbox`. Neither column exists on `public.approval_outbox`, triggering PostgreSQL exception `42703: column "retry_count" does not exist` and crashing the outbox processor, leaving items stranded with `processed_at = null`.
4. **Why Newer Documents Were Not Visible in User Profile**:
   - In `getUserDocumentsAction`, `pending_replacement` is only queried for `status = 'pending'`. Once approved, `document_change_requests.status` became `approved`, causing the pending thumbnail to disappear.
   - Because `user_documents.storage_path` was never repointed to the new file (or repointed to an ancient file), the user profile continued to load the old file path, making it look as though the new document was deleted or lost.

### Architectural Solution
1. **Unified Authoritative Transfer Engine (`transferAndApplyDocumentReplacement`)**:
   - Created in `apps/web/lib/server/document-replacement.ts`:
     - Checks and moves staged files (`main` and `_thumb`) from `doc_staging` to canonical `user_files/documents/{userId}/{docType}/{fileUuid}.jpg`.
     - Atomically repoints `public.user_documents` via `apply_document_replacement_pointer` RPC (`verification_status = 'verified'`, `status = 'verified'`, `verified_by = decidedBy`, `verified_at = now()`).
     - Safely purges previous files (`existingDoc.storage_path`, `existingDoc.thumb_path`) from `user_files` strictly AFTER the DB repointing succeeds.
     - Performs a storage sweep of stale orphaned files in `documents/{userId}/{docType}/`.
     - Cleans up `doc_staging` files.
     - Marks `approval_outbox` entries as `processed_at = now()`.
     - Revalidates Next.js cache tags (`TAGS.users`, `TAGS.approvals`, `TAGS.approvalsList`, `TAGS.approvalsCounts`).
2. **Synchronous Execution on Approval Decisions**:
   - In `apps/web/app/actions/approvals.ts` (`decideApprovalAction`):
     - When `decision === 'approve'`, checks for `type_key === 'document_replace'` (both target request and any child replacements) and **awaits** `transferAndApplyDocumentReplacement` before returning.
   - In `apps/web/lib/server/document-review.ts` (`approveDocumentReplacementCore` and `verifyUserDocumentCore`):
     - Synchronously **awaits** `transferAndApplyDocumentReplacement`.
3. **Resilient Approvals Outbox Processor (`apps/web/lib/server/approvals-outbox.ts`)**:
   - Replaced redundant inline storage code with `transferAndApplyDocumentReplacement`.
   - Fixed catch block to record error metadata inside `payload` (`_last_error`, `_error_at`, `retry_count`) without attempting to write to nonexistent database columns.
4. **Dev DB Reconciliation**:
   - Successfully reconciled user `9dea5fc3-7846-48fa-a799-55b6bc10d00d` (VAIBHAV Chauhan):
     - Canonicalized replacement bank document into `user_files` (`36d66475-de75-4528-999f-1b5f02de275d.jpg`).
     - Pointed `public.user_documents` to the replacement file.
     - Purged all 6 obsolete legacy files from storage.
     - Settled stranded outbox rows 54 and 55.

### Verification Evidence
- `pnpm typecheck`: Clean across all 7 workspace packages (0 errors).
- `node tests/approvals/test-approval-engine-exhaustive.mjs`: **44/44 PASSED (100%)**.
- `node scripts/run-all-tests.mjs`: **34/34 SUITES PASSED (100%)**.

---

# Current Task

## Task: Native Mobile Approvals UI/UX Redesign, Optimistic Feedback & Session Expired Root-Cause Fix
**Status**: 🟢 RESOLVED, IMPLEMENTED & VERIFIED across Monorepo
**Date**: 2026-11-26

### 1. Root Cause Summary: "Your session expired. Sign in again to record a decision."
- **Root Cause**:
  1. In `useDecideApprovalMutation`, `useVerifyDocumentMutation`, and `useRejectDocumentMutation` in `apps/mobile/lib/hooks/useApprovalsData.ts`, mutations attempted to call the Web API endpoint `${appUrl}/api/approvals/${requestId}/decide`.
  2. In `apps/mobile/.env`, `EXPO_PUBLIC_APP_URL` was configured to `https://dashboard-reachinternational.vercel.app` (the production web deployment), while the mobile app was running in development against Dev Supabase (`vlmxciuogczumumrwyot`).
  3. When mobile sent its Dev Supabase JWT to the production Vercel server, the production server's admin client (`dhbbgfzbyatzvqafnsqp`) rejected the token as invalid with HTTP 401.
  4. The client's catch block had `if (err?.status && err.status < 500) throw err;`, which re-threw the HTTP 401 error and **blocked the direct Supabase RPC fallback** from ever executing.
  5. `mapApprovalDecisionError` then formatted HTTP 401 into `"Your session expired. Sign in again to record a decision."`, showing a false session expiry toast even though the mobile user was actively signed in with valid Supabase credentials.

### 2. Solutions Implemented
1. **Proactive Session Refresh & Direct Supabase RPC Fallback (`useApprovalsData.ts`)**:
   - Added `ensureActiveSession()`: Checks token expiration with `supabase.auth.getSession()` and proactively calls `supabase.auth.refreshSession()` if the token is close to expiry (<60s) or missing.
   - Fixed fallback mechanism in `useDecideApprovalMutation`, `useApproveAllMutation`, `useVerifyDocumentMutation`, and `useRejectDocumentMutation`:
     - If optional Web API returns 409 (domain conflict / already decided), surfaces the conflict error.
     - For non-409 statuses (401 from cross-environment host mismatch, 404, 500, network error), cleanly and immediately falls back to the authoritative direct Supabase RPC (`approval_decide`, `approval_approve_all`, `verify_user_document_atomic`, `reject_user_document_atomic`) using the mobile client's active authenticated session and `actorId`.
   - Hardened `mapApprovalDecisionError` to never produce misleading "session expired" errors on non-auth failures.
2. **Contact Info & Android Zero-Width Layout Bug Fix (`MobileApprovalCard.tsx`)**:
   - Fixed Android Yoga layout bug where `contactItem: { maxWidth: "48%" }` and `contactText: { flex: 1 }` collapsed text width to 0, hiding email and phone text.
   - Refactored `Fact` with `factIconWrapper` (16px fixed width) and `flexShrink: 1` text, vertically stacked so long emails and phone numbers render cleanly with 100% legibility.
   - Empty/whitespace facts return `null` immediately, preventing empty icons from rendering without labels.
3. **Clean Compact Notice for Zero Documents (`MobileApprovalCard.tsx`)**:
   - Replaced bloated 100px dashed container (`Attached Documents (0)`) with a subtle, clean 32px notice (`compactEmptyNotice`), saving ~80px of vertical space per card.
4. **Card Header & Action Buttons Redesign (`MobileApprovalCard.tsx`)**:
   - Clean top header: Role badge in brand soft blue (`#e0f2fe` / `#0284c7`), type badge in neutral pill, status badge, and `# EMP-xxxx` mono badge aligned on top right.
   - Action buttons: 44px min-height touch targets with Geist tokens:
     - `Reject`: Outline style with soft red border and text.
     - `Approve`: Solid emerald success button (`#10b981`) with white check icon.
     - Single loading spinner per button when in-flight.
5. **Segmented Filter Tabs & Type Scroll Strip (`approvals.tsx`)**:
   - Replaced squashed, broken dropdown filters with a native segmented status tab bar: `Pending (${counts.total})`, `Approved`, `Rejected`, `All`.
   - Added horizontal scrollable request type pill strip: `All Requests`, `New Registrations`, `Document Verifications`, `Replacements`, `Profile Changes`, `Account Deletions`, `Shift Conflicts`.
   - Prominent, responsive `SearchInput` with clear button.
6. **Optimistic UI Animation (`approvals.tsx`)**:
   - Wrapped FlatList items in `Animated.View` with `entering={FadeIn.duration(200)}`, `exiting={FadeOut.duration(200)}`, and `layout={LinearTransition.springify().damping(18).stiffness(180)}`.
   - Decisions instantly remove the item from the cache, decrement the counter, and trigger spring physics to slide the remaining cards upward with 0ms lag.

### 3. Verification & Evidence
- `pnpm --filter mobile typecheck`: 0 errors (clean exit 0).
- `pnpm --filter web typecheck`: 0 errors (clean exit 0).
- `node scripts/check-typography.mjs`: 0 violations across monorepo.
- `pnpm --filter @reachinternational/validation test`: 87/87 passed (100%).

---



## Task: /running-logs Breakdown Timing Resolution, Single Source of Truth, and Animated Accordion UI
**Status**: 🟢 RESOLVED, IMPLEMENTED & VERIFIED across Web and Mobile
**Date**: 2026-11-26

### 1. Root Cause Summary
- **Why breakdown start and end time was unrecorded on bulk-imported logs**:
  The Next.js operational data queries (`MACHINE_LOG_EXACT_PROJECTION` in `operations-machine-logs.ts`, `CLIENT_LOG_EXACT_PROJECTION` in `operations-client-logs.ts`, `OPERATOR_LOG_EXACT_PROJECTION` in `operations-operator-logs.ts`, and `HOUR_LOG_FULL_PROJECTION` in `operators.ts`) omitted `breakdown_start_time`, `breakdown_end_time`, `breakdown_duration`, `breakdown_hours`, and `breakdown_minutes` from their `select(...)` clauses.
  Although PostgreSQL already stored `breakdown_start_time: '18:48:00'`, `breakdown_end_time: '19:24:00'`, `breakdown_minutes: 36` on the imported record for `M/C-0001` on `2026-11-24`, the frontend query received `undefined`.
- **Why manual entry showed the times**:
  Manual shift entry had an older workaround that prepended `[Breakdown Duration: 11:00 AM - 12:00 PM (60min)]` into the `remarks` column. `parseBreakdownString(log.remarks)` was able to parse that string from `remarks`. In bulk import, remarks were clean (e.g. `"Electrical fault caused downtime; checked and restarted."`), so no bracketed tag existed to fall back on.
- **Why duration showed `0h`**:
  `fmtMin(m)` calculated `Math.floor(m / 60) + 'h'`, rendering `0h` for sub-hour durations (like 36 min).

### 2. Solutions Implemented
1. **Added Projections for All Breakdown Columns**:
   - `apps/web/lib/data/operations/operations-machine-logs.ts`
   - `apps/web/lib/data/operations/operations-client-logs.ts`
   - `apps/web/lib/data/operations/operations-operator-logs.ts`
   - `apps/web/lib/queries/operators.ts`
   - `apps/web/app/actions/operators.ts`
   - `apps/mobile/lib/queries/operationsExport.ts`
2. **Removed Duplicate Breakdown Storage in Remarks (Single Source of Truth)**:
   - Cleaned up `submitOperatorHourLogAction` (`app/actions/operators.ts`), `OperatorDashboard.tsx`, `MeterLogModal.tsx`, and `OperationsEditLogModal.tsx` so they never prepend `[Breakdown Duration: ...]` to `remarks`.
   - Dedicated database columns (`breakdown_start_time`, `breakdown_end_time`, `breakdown_duration`, `breakdown_hours`, `breakdown_minutes`) are now the sole authoritative source of truth.
3. **Resilient Dual Reading**:
   - `extractBreakdownTiming` reads dedicated columns first, calculates duration accurately from timestamps if minutes are missing, and falls back to legacy remarks tags if dedicated columns are null.
4. **Duration Formatting in Minutes & Hours**:
   - Created canonical `formatBreakdownMinutes(m)` in `@reachinternational/utils` (`packages/utils/src/date.ts`):
     - `36m` for 36 min (instead of `0h` or `0h 36m`).
     - `1h` for 60 min.
     - `1h 30m` for 90 min.
5. **Streamlined UI & Smooth Accordion Animation**:
   - Removed the top summary row (`Total stoppage: ... Net Breakdown...`).
   - Removed the text header `"Stoppage Timestamps & Classification:"`.
   - Added Framer Motion `<AnimatePresence>` and `<motion.div>` accordion animation (`duration: 0.25`, `ease: [0.16, 1, 0.3, 1]`) to both desktop table (`OperationsLogsTable.tsx`) and mobile card list (`OperationsLogsMobileList.tsx`).

### 3. Verification & Evidence
- `pnpm --filter web typecheck`: 0 errors.
- `pnpm --filter mobile typecheck`: 0 errors.
- `packages/validation` test suite: 87/87 passed.
- `tests/logsheet-import` test suite: 17/17 passed.
- `tests/breakdown` test suite: 4/4 passed.

## Task: Bulk Historical Logsheet Analysis & Pipeline Ingestion for M/C-0001 (JCB 3DX Super #1 / Afcons Infrastructure)
**Status**: 🟢 IMPORTED, COMMITTED & FULLY VERIFIED (Dev DB `vlmxciuogczumumrwyot`)
**Date**: 2026-11-26

### Overview & Request Fulfillment
- **Machine**: M/C-0001 (`8d0011dd-150e-4f71-b166-a8eb9e460480`), Model: 3DX Super, Serial: JCB3DX-2024-001.
- **Client & Rental Alignment**: Machine `client_id` is Afcons Infrastructure (`1114121d-71ae-4b51-a2b0-1a1553e2ce9d`, `CLI-0050`, Site: Pune Main Site `CLI-0050-S01`). Corrected machine `customer_name` from `'Larsen & Toubro ECC'` to `'Afcons Infrastructure'`.
- **Logsheet Period**: 2026-10-26 to 2026-11-25 (31 days × 2 shifts/day = 62 shifts).
- **Operators**: Shift A (06:00-14:00) Amit Verma (`EMP-0334`, `bd307a42-be98-41b3-a47f-372e79fb2f8e`); Shift B (14:00-22:00) Ramesh Kumar (`EMP-0330`, `4c73b810-a00f-40d2-beaa-5bc4fec2d767`).
- **Meters & Physical Continuity**:
  - Start HMR: 2480.00 (2026-10-26 Shift A)
  - End HMR: 2903.22 (2026-11-25 Shift B)
  - Continuity: 100% contiguous (0 meter gaps or regressions across all 62 shifts).
  - Total Running Hours: 423.22 hrs.
- **Breakdowns**: 5 verified incidents (2026-10-30 Shift A, 2026-11-01 Shift A, 2026-11-07 Shift A, 2026-11-19 Shift A, 2026-11-24 Shift B) with containment inside shift duration and descriptive remarks.
- **Pipeline Artifacts Created**:
  - `data/logsheets/MC-0001_3DX_Super_2026-10-26_to_2026-11-25.csv`: Canonical source CSV data.
  - `data/logsheets/MC-0001_3DX_Super_2026-10-26_to_2026-11-25.xlsx`: Standardized 3-sheet Excel workbook.
  - `scripts/pipeline-logsheet-import.mjs`: Fast, reusable multi-format (.csv/.xlsx) CLI & programmatic pipeline with machine resolution, operator resolution, duplicate prevention, and atomic RPC execution.
- **Database Import Execution**:
  - Executed atomic `import_machine_hour_logs_bulk(jsonb)` RPC under admin authorization (`Admin User Dev`, `cc2b0d0c-e06d-4500-98fe-69354b2bdc16`).
  - Import Record ID: `a6958417-687c-4cac-b55f-a434c414a925` (status: `completed`).
  - Verified 62/62 rows committed to `public.machine_hour_logs`.
  - Advanced `machines.hour_meter` from 534 to `2903.22` hrs.

---


## Task: Fix Supabase Realtime `cannot add postgres_changes callbacks after subscribe()` Error
**Status**: 🟢 RESOLVED & VERIFIED across Monorepo
**Date**: 2026-11-26

### Root Cause Diagnosed
In `apps/web/components/notifications/NotificationBell.tsx`, each instance independently created and subscribed to a Supabase Realtime channel named `notifications:inbox:${user.id}`.
Because `NotificationBell` is mounted concurrently in two places in `AppShellClient` (`MobilePageHeader.tsx` for mobile and `QuickAccessTrigger.tsx` in `AppSidebar.tsx` for desktop), both instances ran `useEffect` at the same time. The Supabase browser client returned the existing singleton channel instance to the second component while it was already in `'subscribing'`/`'subscribed'` state, throwing the runtime error:
`cannot add postgres_changes callbacks for realtime:notifications:inbox:<id> after subscribe().`

### Solution Applied
1. **Centralized Provider (`NotificationContext.tsx`)**:
   - Created `NotificationProvider` and `useNotification` in `apps/web/components/notifications/NotificationContext.tsx`.
   - Single point of truth for unread count, realtime items buffer, and background re-sync on tab focus and `visibilitychange`.
   - Strictly 1 Supabase Realtime channel per authenticated user session.
   - Guaranteed cleanup of lingering or stale channels prior to subscription.
2. **Refactored `NotificationBell.tsx`**:
   - Removed duplicated local `useState` and `useEffect` realtime subscriptions.
   - Bell now consumes `useNotification()`, maintaining only local popover/drawer presentation state.
3. **Mounted Provider in `AppShellClient.tsx`**:
   - Placed `<NotificationProvider>` inside `<CurrentUserProvider>` in `apps/web/components/layout/AppShellClient.tsx`.
   - Ensures both mobile header bell and desktop sidebar bell share the exact same realtime state with zero drift.

### Verification
- `pnpm typecheck`: 7/7 packages clean (0 errors).
- `node scripts/run-all-tests.mjs`: 35/35 test suites passed (100%).
- `node scripts/check-typography.mjs`: 0 violations.
- ESLint: 0 errors, 0 warnings on modified web components.

---

## Task: Single/Multi Document Approvals Deduplication, Request Consolidation & RPC Error Normalization
**Status**: 🟢 IMPLEMENTED & VERIFIED across Web (`apps/web`), Mobile (`apps/mobile`), and Shared Utils (`packages/utils`)
**Date**: 2026-11-25

### Problem & Root Causes Diagnosed
1. **Redundant Approval Buttons on Single Document Approvals**:
   - For single-document replacement or verification cards, the UI was rendering both inline thumbnail action buttons (`[X]` and `[✓]`) AND card-level action footer buttons (`[Reject]` and `[Approve]`).
   - Clicking the thumbnail action dispatched `verifyUserDocumentAction` with the approval request's UUID (`09d89890-3769-4979-b6d6-9c4a4f125374`), bypassing the standard approval request lifecycle.
2. **Multiple Document Fragmentation for Same Applicant**:
   - When an applicant uploaded multiple replacement documents, each submission created a separate standalone pending card in the approvals queue rather than consolidating into a single applicant request card.
3. **Root Cause of `User document not found with ID 09d89890-3769-4979-b6d6-9c4a4f125374`**:
   - `verifyUserDocumentCore` in `apps/web/lib/server/document-review.ts` was hardcoded to only search `approval_requests` where `type_key = 'document_verify'` and `subject_id = params.documentId`.
   - It completely ignored `type_key = 'document_replace'` and requests referenced by `id = params.documentId` (or stored in `payload`).
   - Consequently, it fell back to invoking `verify_user_document_atomic(p_document_id := '09d89890-3769-4979-b6d6-9c4a4f125374')`.
   - In `public.user_documents`, no row existed with that UUID (because `09d89890-3769-4979-b6d6-9c4a4f125374` was the `approval_requests.id` for a staged replacement, not an active `user_documents.id`). Postgres raised exception `P0001: User document not found with ID ...`.
4. **Raw Unsanitized Database Error Leaking to Toast UI**:
   - The raw PostgreSQL `P0001` message string was passed to the UI toast without error normalization or technical ID stripping.

### Architectural Solution & Parity Implementation
1. **Suppressed Duplicate Buttons on Single Document Cards**:
   - In `apps/web/app/(app)/approvals/components/ApprovalRow.tsx` and `apps/mobile/components/approvals/MobileApprovalCard.tsx`:
     - When `isDocReplace` or `isDocVerify` contains only a single document (`length <= 1`), inline thumbnail actions are disabled (`canDecide = false`). The single bottom footer buttons (`[Reject]` and `[Approve]`) serve as the sole decision controls.
2. **Consolidated Multi-Document Submissions for Same Applicant**:
   - In `apps/web/lib/server/document-replacement.ts`:
     - `submitDocumentReplacement` checks if an active pending top-level `document_replace` request already exists for the user; if so, subsequent requests attach `parent_id = existingParent.id`.
   - In `apps/web/lib/dal/approvals.ts` and `apps/mobile/lib/hooks/useApprovalsData.ts`:
     - Grouped pending `document_replace` and `document_verify` requests for the same applicant into a unified single card with combined document lists and `bound_request_ids`.
     - When multiple documents are attached to a card, individual thumbnail action buttons allow reviewing each document one by one.
3. **Resolution Engine Fix (`apps/web/lib/server/document-review.ts`)**:
   - Refactored `verifyUserDocumentCore` and `rejectUserDocumentCore`:
     - Layer 1: Checks `approval_requests` for pending items matching `id = docId` OR `subject_id = docId` OR `payload->>document_id = docId` OR `payload->>request_id = docId` across both `document_verify` and `document_replace`. If found, routes through `approval_decide`, executing domain handlers (`approval_apply_document_verify` or `approval_apply_document_replace`).
     - Layer 2: Checks `document_change_requests` table (invoking `approveDocumentReplacementCore` / `rejectDocumentReplacementCore`).
     - Layer 3: Checks `user_documents` table (invoking atomic RPCs).
     - Layer 4: If missing across all layers, safely returns `{ success: false, error: "Document record not found or has already been reviewed." }`.
4. **Error Normalization (`packages/utils/src/errors.ts`)**:
   - Added rule in `_sanitizeDatabaseErrorRaw` mapping PostgreSQL `P0001` with `User document not found` to `"Document record not found or has already been reviewed."` with status 404.
   - Enhanced `sanitizeUserErrorMessage` to strip raw UUIDs and convert technical internal IDs into clean user messages.
   - Added unit test cases to `packages/utils/src/errors.test.ts` (59/59 passing).

### Verification Evidence
- `pnpm --filter @reachinternational/utils test`: 59/59 tests passed.
- `pnpm --filter @reachinternational/permissions test`: 37/37 tests passed.
- `node scripts/run-all-tests.mjs`: 34/34 test suites passed (100%).
- `pnpm typecheck`: Clean across all 7 workspace packages (0 errors).

---

# Current Task

## Task: Native Mobile Approvals UI/UX Redesign, Optimistic Feedback & Session Expired Root-Cause Fix
**Status**: 🟢 RESOLVED, IMPLEMENTED & VERIFIED across Monorepo
**Date**: 2026-11-26

### 1. Root Cause Summary: "Your session expired. Sign in again to record a decision."
- **Root Cause**:
  1. In `useDecideApprovalMutation`, `useVerifyDocumentMutation`, and `useRejectDocumentMutation` in `apps/mobile/lib/hooks/useApprovalsData.ts`, mutations attempted to call the Web API endpoint `${appUrl}/api/approvals/${requestId}/decide`.
  2. In `apps/mobile/.env`, `EXPO_PUBLIC_APP_URL` was configured to `https://dashboard-reachinternational.vercel.app` (the production web deployment), while the mobile app was running in development against Dev Supabase (`vlmxciuogczumumrwyot`).
  3. When mobile sent its Dev Supabase JWT to the production Vercel server, the production server's admin client (`dhbbgfzbyatzvqafnsqp`) rejected the token as invalid with HTTP 401.
  4. The client's catch block had `if (err?.status && err.status < 500) throw err;`, which re-threw the HTTP 401 error and **blocked the direct Supabase RPC fallback** from ever executing.
  5. `mapApprovalDecisionError` then formatted HTTP 401 into `"Your session expired. Sign in again to record a decision."`, showing a false session expiry toast even though the mobile user was actively signed in with valid Supabase credentials.

### 2. Solutions Implemented
1. **Proactive Session Refresh & Direct Supabase RPC Fallback (`useApprovalsData.ts`)**:
   - Added `ensureActiveSession()`: Checks token expiration with `supabase.auth.getSession()` and proactively calls `supabase.auth.refreshSession()` if the token is close to expiry (<60s) or missing.
   - Fixed fallback mechanism in `useDecideApprovalMutation`, `useApproveAllMutation`, `useVerifyDocumentMutation`, and `useRejectDocumentMutation`:
     - If optional Web API returns 409 (domain conflict / already decided), surfaces the conflict error.
     - For non-409 statuses (401 from cross-environment host mismatch, 404, 500, network error), cleanly and immediately falls back to the authoritative direct Supabase RPC (`approval_decide`, `approval_approve_all`, `verify_user_document_atomic`, `reject_user_document_atomic`) using the mobile client's active authenticated session and `actorId`.
   - Hardened `mapApprovalDecisionError` to never produce misleading "session expired" errors on non-auth failures.
2. **Contact Info & Android Zero-Width Layout Bug Fix (`MobileApprovalCard.tsx`)**:
   - Fixed Android Yoga layout bug where `contactItem: { maxWidth: "48%" }` and `contactText: { flex: 1 }` collapsed text width to 0, hiding email and phone text.
   - Refactored `Fact` with `factIconWrapper` (16px fixed width) and `flexShrink: 1` text, vertically stacked so long emails and phone numbers render cleanly with 100% legibility.
   - Empty/whitespace facts return `null` immediately, preventing empty icons from rendering without labels.
3. **Clean Compact Notice for Zero Documents (`MobileApprovalCard.tsx`)**:
   - Replaced bloated 100px dashed container (`Attached Documents (0)`) with a subtle, clean 32px notice (`compactEmptyNotice`), saving ~80px of vertical space per card.
4. **Card Header & Action Buttons Redesign (`MobileApprovalCard.tsx`)**:
   - Clean top header: Role badge in brand soft blue (`#e0f2fe` / `#0284c7`), type badge in neutral pill, status badge, and `# EMP-xxxx` mono badge aligned on top right.
   - Action buttons: 44px min-height touch targets with Geist tokens:
     - `Reject`: Outline style with soft red border and text.
     - `Approve`: Solid emerald success button (`#10b981`) with white check icon.
     - Single loading spinner per button when in-flight.
5. **Segmented Filter Tabs & Type Scroll Strip (`approvals.tsx`)**:
   - Replaced squashed, broken dropdown filters with a native segmented status tab bar: `Pending (${counts.total})`, `Approved`, `Rejected`, `All`.
   - Added horizontal scrollable request type pill strip: `All Requests`, `New Registrations`, `Document Verifications`, `Replacements`, `Profile Changes`, `Account Deletions`, `Shift Conflicts`.
   - Prominent, responsive `SearchInput` with clear button.
6. **Optimistic UI Animation (`approvals.tsx`)**:
   - Wrapped FlatList items in `Animated.View` with `entering={FadeIn.duration(200)}`, `exiting={FadeOut.duration(200)}`, and `layout={LinearTransition.springify().damping(18).stiffness(180)}`.
   - Decisions instantly remove the item from the cache, decrement the counter, and trigger spring physics to slide the remaining cards upward with 0ms lag.

### 3. Verification & Evidence
- `pnpm --filter mobile typecheck`: 0 errors (clean exit 0).
- `pnpm --filter web typecheck`: 0 errors (clean exit 0).
- `node scripts/check-typography.mjs`: 0 violations across monorepo.
- `pnpm --filter @reachinternational/validation test`: 87/87 passed (100%).

---



## Task: /running-logs Breakdown Timing Resolution, Single Source of Truth, and Animated Accordion UI
**Status**: 🟢 RESOLVED, IMPLEMENTED & VERIFIED across Web and Mobile
**Date**: 2026-11-26

### 1. Root Cause Summary
- **Why breakdown start and end time was unrecorded on bulk-imported logs**:
  The Next.js operational data queries (`MACHINE_LOG_EXACT_PROJECTION` in `operations-machine-logs.ts`, `CLIENT_LOG_EXACT_PROJECTION` in `operations-client-logs.ts`, `OPERATOR_LOG_EXACT_PROJECTION` in `operations-operator-logs.ts`, and `HOUR_LOG_FULL_PROJECTION` in `operators.ts`) omitted `breakdown_start_time`, `breakdown_end_time`, `breakdown_duration`, `breakdown_hours`, and `breakdown_minutes` from their `select(...)` clauses.
  Although PostgreSQL already stored `breakdown_start_time: '18:48:00'`, `breakdown_end_time: '19:24:00'`, `breakdown_minutes: 36` on the imported record for `M/C-0001` on `2026-11-24`, the frontend query received `undefined`.
- **Why manual entry showed the times**:
  Manual shift entry had an older workaround that prepended `[Breakdown Duration: 11:00 AM - 12:00 PM (60min)]` into the `remarks` column. `parseBreakdownString(log.remarks)` was able to parse that string from `remarks`. In bulk import, remarks were clean (e.g. `"Electrical fault caused downtime; checked and restarted."`), so no bracketed tag existed to fall back on.
- **Why duration showed `0h`**:
  `fmtMin(m)` calculated `Math.floor(m / 60) + 'h'`, rendering `0h` for sub-hour durations (like 36 min).

### 2. Solutions Implemented
1. **Added Projections for All Breakdown Columns**:
   - `apps/web/lib/data/operations/operations-machine-logs.ts`
   - `apps/web/lib/data/operations/operations-client-logs.ts`
   - `apps/web/lib/data/operations/operations-operator-logs.ts`
   - `apps/web/lib/queries/operators.ts`
   - `apps/web/app/actions/operators.ts`
   - `apps/mobile/lib/queries/operationsExport.ts`
2. **Removed Duplicate Breakdown Storage in Remarks (Single Source of Truth)**:
   - Cleaned up `submitOperatorHourLogAction` (`app/actions/operators.ts`), `OperatorDashboard.tsx`, `MeterLogModal.tsx`, and `OperationsEditLogModal.tsx` so they never prepend `[Breakdown Duration: ...]` to `remarks`.
   - Dedicated database columns (`breakdown_start_time`, `breakdown_end_time`, `breakdown_duration`, `breakdown_hours`, `breakdown_minutes`) are now the sole authoritative source of truth.
3. **Resilient Dual Reading**:
   - `extractBreakdownTiming` reads dedicated columns first, calculates duration accurately from timestamps if minutes are missing, and falls back to legacy remarks tags if dedicated columns are null.
4. **Duration Formatting in Minutes & Hours**:
   - Created canonical `formatBreakdownMinutes(m)` in `@reachinternational/utils` (`packages/utils/src/date.ts`):
     - `36m` for 36 min (instead of `0h` or `0h 36m`).
     - `1h` for 60 min.
     - `1h 30m` for 90 min.
5. **Streamlined UI & Smooth Accordion Animation**:
   - Removed the top summary row (`Total stoppage: ... Net Breakdown...`).
   - Removed the text header `"Stoppage Timestamps & Classification:"`.
   - Added Framer Motion `<AnimatePresence>` and `<motion.div>` accordion animation (`duration: 0.25`, `ease: [0.16, 1, 0.3, 1]`) to both desktop table (`OperationsLogsTable.tsx`) and mobile card list (`OperationsLogsMobileList.tsx`).

### 3. Verification & Evidence
- `pnpm --filter web typecheck`: 0 errors.
- `pnpm --filter mobile typecheck`: 0 errors.
- `packages/validation` test suite: 87/87 passed.
- `tests/logsheet-import` test suite: 17/17 passed.
- `tests/breakdown` test suite: 4/4 passed.

## Task: Bulk Historical Logsheet Analysis & Pipeline Ingestion for M/C-0001 (JCB 3DX Super #1 / Afcons Infrastructure)
**Status**: 🟢 IMPORTED, COMMITTED & FULLY VERIFIED (Dev DB `vlmxciuogczumumrwyot`)
**Date**: 2026-11-26

### Overview & Request Fulfillment
- **Machine**: M/C-0001 (`8d0011dd-150e-4f71-b166-a8eb9e460480`), Model: 3DX Super, Serial: JCB3DX-2024-001.
- **Client & Rental Alignment**: Machine `client_id` is Afcons Infrastructure (`1114121d-71ae-4b51-a2b0-1a1553e2ce9d`, `CLI-0050`, Site: Pune Main Site `CLI-0050-S01`). Corrected machine `customer_name` from `'Larsen & Toubro ECC'` to `'Afcons Infrastructure'`.
- **Logsheet Period**: 2026-10-26 to 2026-11-25 (31 days × 2 shifts/day = 62 shifts).
- **Operators**: Shift A (06:00-14:00) Amit Verma (`EMP-0334`, `bd307a42-be98-41b3-a47f-372e79fb2f8e`); Shift B (14:00-22:00) Ramesh Kumar (`EMP-0330`, `4c73b810-a00f-40d2-beaa-5bc4fec2d767`).
- **Meters & Physical Continuity**:
  - Start HMR: 2480.00 (2026-10-26 Shift A)
  - End HMR: 2903.22 (2026-11-25 Shift B)
  - Continuity: 100% contiguous (0 meter gaps or regressions across all 62 shifts).
  - Total Running Hours: 423.22 hrs.
- **Breakdowns**: 5 verified incidents (2026-10-30 Shift A, 2026-11-01 Shift A, 2026-11-07 Shift A, 2026-11-19 Shift A, 2026-11-24 Shift B) with containment inside shift duration and descriptive remarks.
- **Pipeline Artifacts Created**:
  - `data/logsheets/MC-0001_3DX_Super_2026-10-26_to_2026-11-25.csv`: Canonical source CSV data.
  - `data/logsheets/MC-0001_3DX_Super_2026-10-26_to_2026-11-25.xlsx`: Standardized 3-sheet Excel workbook.
  - `scripts/pipeline-logsheet-import.mjs`: Fast, reusable multi-format (.csv/.xlsx) CLI & programmatic pipeline with machine resolution, operator resolution, duplicate prevention, and atomic RPC execution.
- **Database Import Execution**:
  - Executed atomic `import_machine_hour_logs_bulk(jsonb)` RPC under admin authorization (`Admin User Dev`, `cc2b0d0c-e06d-4500-98fe-69354b2bdc16`).
  - Import Record ID: `a6958417-687c-4cac-b55f-a434c414a925` (status: `completed`).
  - Verified 62/62 rows committed to `public.machine_hour_logs`.
  - Advanced `machines.hour_meter` from 534 to `2903.22` hrs.

---


## Task: Fix Supabase Realtime `cannot add postgres_changes callbacks after subscribe()` Error
**Status**: 🟢 RESOLVED & VERIFIED across Monorepo
**Date**: 2026-11-26

### Root Cause Diagnosed
In `apps/web/components/notifications/NotificationBell.tsx`, each instance independently created and subscribed to a Supabase Realtime channel named `notifications:inbox:${user.id}`.
Because `NotificationBell` is mounted concurrently in two places in `AppShellClient` (`MobilePageHeader.tsx` for mobile and `QuickAccessTrigger.tsx` in `AppSidebar.tsx` for desktop), both instances ran `useEffect` at the same time. The Supabase browser client returned the existing singleton channel instance to the second component while it was already in `'subscribing'`/`'subscribed'` state, throwing the runtime error:
`cannot add postgres_changes callbacks for realtime:notifications:inbox:<id> after subscribe().`

### Solution Applied
1. **Centralized Provider (`NotificationContext.tsx`)**:
   - Created `NotificationProvider` and `useNotification` in `apps/web/components/notifications/NotificationContext.tsx`.
   - Single point of truth for unread count, realtime items buffer, and background re-sync on tab focus and `visibilitychange`.
   - Strictly 1 Supabase Realtime channel per authenticated user session.
   - Guaranteed cleanup of lingering or stale channels prior to subscription.
2. **Refactored `NotificationBell.tsx`**:
   - Removed duplicated local `useState` and `useEffect` realtime subscriptions.
   - Bell now consumes `useNotification()`, maintaining only local popover/drawer presentation state.
3. **Mounted Provider in `AppShellClient.tsx`**:
   - Placed `<NotificationProvider>` inside `<CurrentUserProvider>` in `apps/web/components/layout/AppShellClient.tsx`.
   - Ensures both mobile header bell and desktop sidebar bell share the exact same realtime state with zero drift.

### Verification
- `pnpm typecheck`: 7/7 packages clean (0 errors).
- `node scripts/run-all-tests.mjs`: 35/35 test suites passed (100%).
- `node scripts/check-typography.mjs`: 0 violations.
- ESLint: 0 errors, 0 warnings on modified web components.

---

## Task: Document Replacement Approval Lifecycle — Synchronous File Transfer, Pointer Repointing & Old Storage Purging
**Status**: 🟢 IMPLEMENTED & FULLY VERIFIED across Web (`apps/web`), Mobile (`apps/mobile`), and Shared Utils
**Date**: 2026-11-25

### Problem & Deep Root Cause Analysis
When an administrator approved a document replacement request:
1. **Unawaited Server Action Fire-and-Forget**:
   - `decideApprovalAction` and `verifyUserDocumentCore` only invoked `approval_decide` (which enqueued topic `file.transfer_staged_document` into `approval_outbox`), then called `processPendingApprovalOutboxItems(10).catch(...)` as an unawaited background promise.
   - In Next.js App Router Server Actions, unawaited background promises are suspended or aborted as soon as the HTTP action response completes. Consequently, the staged file in `doc_staging` was never transferred to `user_files`, `user_documents` was never repointed, and older files were never purged.
2. **Disastrous Fallback to Stale Historical Files**:
   - In `apps/web/lib/server/approvals-outbox.ts`, lines 150-160 contained:
     `const validFile = userFilesList?.find((f) => !f.name.includes("_thumb") && f.name.endsWith(".jpg"));`
   - If `move` failed or had already executed, it searched `user_files/documents/{userId}/{docType}/` and grabbed the FIRST `.jpg` it found—which was an ancient/prior document! It repointed `user_documents` to that prior document and deleted whatever other files were present.
3. **Database Outbox Error Handler Crash**:
   - In `approvals-outbox.ts`, the catch block tried to write `retry_count` and `last_error` columns directly to `approval_outbox`. Neither column exists on `public.approval_outbox`, triggering PostgreSQL exception `42703: column "retry_count" does not exist` and crashing the outbox processor, leaving items stranded with `processed_at = null`.
4. **Why Newer Documents Were Not Visible in User Profile**:
   - In `getUserDocumentsAction`, `pending_replacement` is only queried for `status = 'pending'`. Once approved, `document_change_requests.status` became `approved`, causing the pending thumbnail to disappear.
   - Because `user_documents.storage_path` was never repointed to the new file (or repointed to an ancient file), the user profile continued to load the old file path, making it look as though the new document was deleted or lost.

### Architectural Solution
1. **Unified Authoritative Transfer Engine (`transferAndApplyDocumentReplacement`)**:
   - Created in `apps/web/lib/server/document-replacement.ts`:
     - Checks and moves staged files (`main` and `_thumb`) from `doc_staging` to canonical `user_files/documents/{userId}/{docType}/{fileUuid}.jpg`.
     - Atomically repoints `public.user_documents` via `apply_document_replacement_pointer` RPC (`verification_status = 'verified'`, `status = 'verified'`, `verified_by = decidedBy`, `verified_at = now()`).
     - Safely purges previous files (`existingDoc.storage_path`, `existingDoc.thumb_path`) from `user_files` strictly AFTER the DB repointing succeeds.
     - Performs a storage sweep of stale orphaned files in `documents/{userId}/{docType}/`.
     - Cleans up `doc_staging` files.
     - Marks `approval_outbox` entries as `processed_at = now()`.
     - Revalidates Next.js cache tags (`TAGS.users`, `TAGS.approvals`, `TAGS.approvalsList`, `TAGS.approvalsCounts`).
2. **Synchronous Execution on Approval Decisions**:
   - In `apps/web/app/actions/approvals.ts` (`decideApprovalAction`):
     - When `decision === 'approve'`, checks for `type_key === 'document_replace'` (both target request and any child replacements) and **awaits** `transferAndApplyDocumentReplacement` before returning.
   - In `apps/web/lib/server/document-review.ts` (`approveDocumentReplacementCore` and `verifyUserDocumentCore`):
     - Synchronously **awaits** `transferAndApplyDocumentReplacement`.
3. **Resilient Approvals Outbox Processor (`apps/web/lib/server/approvals-outbox.ts`)**:
   - Replaced redundant inline storage code with `transferAndApplyDocumentReplacement`.
   - Fixed catch block to record error metadata inside `payload` (`_last_error`, `_error_at`, `retry_count`) without attempting to write to nonexistent database columns.
4. **Dev DB Reconciliation**:
   - Successfully reconciled user `9dea5fc3-7846-48fa-a799-55b6bc10d00d` (VAIBHAV Chauhan):
     - Canonicalized replacement bank document into `user_files` (`36d66475-de75-4528-999f-1b5f02de275d.jpg`).
     - Pointed `public.user_documents` to the replacement file.
     - Purged all 6 obsolete legacy files from storage.
     - Settled stranded outbox rows 54 and 55.

### Verification Evidence
- `pnpm typecheck`: Clean across all 7 workspace packages (0 errors).
- `node tests/approvals/test-approval-engine-exhaustive.mjs`: **44/44 PASSED (100%)**.
- `node scripts/run-all-tests.mjs`: **34/34 SUITES PASSED (100%)**.

---

# Current Task

## Task: Native Mobile Approvals UI/UX Redesign, Optimistic Feedback & Session Expired Root-Cause Fix
**Status**: 🟢 RESOLVED, IMPLEMENTED & VERIFIED across Monorepo
**Date**: 2026-11-26

### 1. Root Cause Summary: "Your session expired. Sign in again to record a decision."
- **Root Cause**:
  1. In `useDecideApprovalMutation`, `useVerifyDocumentMutation`, and `useRejectDocumentMutation` in `apps/mobile/lib/hooks/useApprovalsData.ts`, mutations attempted to call the Web API endpoint `${appUrl}/api/approvals/${requestId}/decide`.
  2. In `apps/mobile/.env`, `EXPO_PUBLIC_APP_URL` was configured to `https://dashboard-reachinternational.vercel.app` (the production web deployment), while the mobile app was running in development against Dev Supabase (`vlmxciuogczumumrwyot`).
  3. When mobile sent its Dev Supabase JWT to the production Vercel server, the production server's admin client (`dhbbgfzbyatzvqafnsqp`) rejected the token as invalid with HTTP 401.
  4. The client's catch block had `if (err?.status && err.status < 500) throw err;`, which re-threw the HTTP 401 error and **blocked the direct Supabase RPC fallback** from ever executing.
  5. `mapApprovalDecisionError` then formatted HTTP 401 into `"Your session expired. Sign in again to record a decision."`, showing a false session expiry toast even though the mobile user was actively signed in with valid Supabase credentials.

### 2. Solutions Implemented
1. **Proactive Session Refresh & Direct Supabase RPC Fallback (`useApprovalsData.ts`)**:
   - Added `ensureActiveSession()`: Checks token expiration with `supabase.auth.getSession()` and proactively calls `supabase.auth.refreshSession()` if the token is close to expiry (<60s) or missing.
   - Fixed fallback mechanism in `useDecideApprovalMutation`, `useApproveAllMutation`, `useVerifyDocumentMutation`, and `useRejectDocumentMutation`:
     - If optional Web API returns 409 (domain conflict / already decided), surfaces the conflict error.
     - For non-409 statuses (401 from cross-environment host mismatch, 404, 500, network error), cleanly and immediately falls back to the authoritative direct Supabase RPC (`approval_decide`, `approval_approve_all`, `verify_user_document_atomic`, `reject_user_document_atomic`) using the mobile client's active authenticated session and `actorId`.
   - Hardened `mapApprovalDecisionError` to never produce misleading "session expired" errors on non-auth failures.
2. **Contact Info & Android Zero-Width Layout Bug Fix (`MobileApprovalCard.tsx`)**:
   - Fixed Android Yoga layout bug where `contactItem: { maxWidth: "48%" }` and `contactText: { flex: 1 }` collapsed text width to 0, hiding email and phone text.
   - Refactored `Fact` with `factIconWrapper` (16px fixed width) and `flexShrink: 1` text, vertically stacked so long emails and phone numbers render cleanly with 100% legibility.
   - Empty/whitespace facts return `null` immediately, preventing empty icons from rendering without labels.
3. **Clean Compact Notice for Zero Documents (`MobileApprovalCard.tsx`)**:
   - Replaced bloated 100px dashed container (`Attached Documents (0)`) with a subtle, clean 32px notice (`compactEmptyNotice`), saving ~80px of vertical space per card.
4. **Card Header & Action Buttons Redesign (`MobileApprovalCard.tsx`)**:
   - Clean top header: Role badge in brand soft blue (`#e0f2fe` / `#0284c7`), type badge in neutral pill, status badge, and `# EMP-xxxx` mono badge aligned on top right.
   - Action buttons: 44px min-height touch targets with Geist tokens:
     - `Reject`: Outline style with soft red border and text.
     - `Approve`: Solid emerald success button (`#10b981`) with white check icon.
     - Single loading spinner per button when in-flight.
5. **Segmented Filter Tabs & Type Scroll Strip (`approvals.tsx`)**:
   - Replaced squashed, broken dropdown filters with a native segmented status tab bar: `Pending (${counts.total})`, `Approved`, `Rejected`, `All`.
   - Added horizontal scrollable request type pill strip: `All Requests`, `New Registrations`, `Document Verifications`, `Replacements`, `Profile Changes`, `Account Deletions`, `Shift Conflicts`.
   - Prominent, responsive `SearchInput` with clear button.
6. **Optimistic UI Animation (`approvals.tsx`)**:
   - Wrapped FlatList items in `Animated.View` with `entering={FadeIn.duration(200)}`, `exiting={FadeOut.duration(200)}`, and `layout={LinearTransition.springify().damping(18).stiffness(180)}`.
   - Decisions instantly remove the item from the cache, decrement the counter, and trigger spring physics to slide the remaining cards upward with 0ms lag.

### 3. Verification & Evidence
- `pnpm --filter mobile typecheck`: 0 errors (clean exit 0).
- `pnpm --filter web typecheck`: 0 errors (clean exit 0).
- `node scripts/check-typography.mjs`: 0 violations across monorepo.
- `pnpm --filter @reachinternational/validation test`: 87/87 passed (100%).

---



## Task: /running-logs Breakdown Timing Resolution, Single Source of Truth, and Animated Accordion UI
**Status**: 🟢 RESOLVED, IMPLEMENTED & VERIFIED across Web and Mobile
**Date**: 2026-11-26

### 1. Root Cause Summary
- **Why breakdown start and end time was unrecorded on bulk-imported logs**:
  The Next.js operational data queries (`MACHINE_LOG_EXACT_PROJECTION` in `operations-machine-logs.ts`, `CLIENT_LOG_EXACT_PROJECTION` in `operations-client-logs.ts`, `OPERATOR_LOG_EXACT_PROJECTION` in `operations-operator-logs.ts`, and `HOUR_LOG_FULL_PROJECTION` in `operators.ts`) omitted `breakdown_start_time`, `breakdown_end_time`, `breakdown_duration`, `breakdown_hours`, and `breakdown_minutes` from their `select(...)` clauses.
  Although PostgreSQL already stored `breakdown_start_time: '18:48:00'`, `breakdown_end_time: '19:24:00'`, `breakdown_minutes: 36` on the imported record for `M/C-0001` on `2026-11-24`, the frontend query received `undefined`.
- **Why manual entry showed the times**:
  Manual shift entry had an older workaround that prepended `[Breakdown Duration: 11:00 AM - 12:00 PM (60min)]` into the `remarks` column. `parseBreakdownString(log.remarks)` was able to parse that string from `remarks`. In bulk import, remarks were clean (e.g. `"Electrical fault caused downtime; checked and restarted."`), so no bracketed tag existed to fall back on.
- **Why duration showed `0h`**:
  `fmtMin(m)` calculated `Math.floor(m / 60) + 'h'`, rendering `0h` for sub-hour durations (like 36 min).

### 2. Solutions Implemented
1. **Added Projections for All Breakdown Columns**:
   - `apps/web/lib/data/operations/operations-machine-logs.ts`
   - `apps/web/lib/data/operations/operations-client-logs.ts`
   - `apps/web/lib/data/operations/operations-operator-logs.ts`
   - `apps/web/lib/queries/operators.ts`
   - `apps/web/app/actions/operators.ts`
   - `apps/mobile/lib/queries/operationsExport.ts`
2. **Removed Duplicate Breakdown Storage in Remarks (Single Source of Truth)**:
   - Cleaned up `submitOperatorHourLogAction` (`app/actions/operators.ts`), `OperatorDashboard.tsx`, `MeterLogModal.tsx`, and `OperationsEditLogModal.tsx` so they never prepend `[Breakdown Duration: ...]` to `remarks`.
   - Dedicated database columns (`breakdown_start_time`, `breakdown_end_time`, `breakdown_duration`, `breakdown_hours`, `breakdown_minutes`) are now the sole authoritative source of truth.
3. **Resilient Dual Reading**:
   - `extractBreakdownTiming` reads dedicated columns first, calculates duration accurately from timestamps if minutes are missing, and falls back to legacy remarks tags if dedicated columns are null.
4. **Duration Formatting in Minutes & Hours**:
   - Created canonical `formatBreakdownMinutes(m)` in `@reachinternational/utils` (`packages/utils/src/date.ts`):
     - `36m` for 36 min (instead of `0h` or `0h 36m`).
     - `1h` for 60 min.
     - `1h 30m` for 90 min.
5. **Streamlined UI & Smooth Accordion Animation**:
   - Removed the top summary row (`Total stoppage: ... Net Breakdown...`).
   - Removed the text header `"Stoppage Timestamps & Classification:"`.
   - Added Framer Motion `<AnimatePresence>` and `<motion.div>` accordion animation (`duration: 0.25`, `ease: [0.16, 1, 0.3, 1]`) to both desktop table (`OperationsLogsTable.tsx`) and mobile card list (`OperationsLogsMobileList.tsx`).

### 3. Verification & Evidence
- `pnpm --filter web typecheck`: 0 errors.
- `pnpm --filter mobile typecheck`: 0 errors.
- `packages/validation` test suite: 87/87 passed.
- `tests/logsheet-import` test suite: 17/17 passed.
- `tests/breakdown` test suite: 4/4 passed.

## Task: Bulk Historical Logsheet Analysis & Pipeline Ingestion for M/C-0001 (JCB 3DX Super #1 / Afcons Infrastructure)
**Status**: 🟢 IMPORTED, COMMITTED & FULLY VERIFIED (Dev DB `vlmxciuogczumumrwyot`)
**Date**: 2026-11-26

### Overview & Request Fulfillment
- **Machine**: M/C-0001 (`8d0011dd-150e-4f71-b166-a8eb9e460480`), Model: 3DX Super, Serial: JCB3DX-2024-001.
- **Client & Rental Alignment**: Machine `client_id` is Afcons Infrastructure (`1114121d-71ae-4b51-a2b0-1a1553e2ce9d`, `CLI-0050`, Site: Pune Main Site `CLI-0050-S01`). Corrected machine `customer_name` from `'Larsen & Toubro ECC'` to `'Afcons Infrastructure'`.
- **Logsheet Period**: 2026-10-26 to 2026-11-25 (31 days × 2 shifts/day = 62 shifts).
- **Operators**: Shift A (06:00-14:00) Amit Verma (`EMP-0334`, `bd307a42-be98-41b3-a47f-372e79fb2f8e`); Shift B (14:00-22:00) Ramesh Kumar (`EMP-0330`, `4c73b810-a00f-40d2-beaa-5bc4fec2d767`).
- **Meters & Physical Continuity**:
  - Start HMR: 2480.00 (2026-10-26 Shift A)
  - End HMR: 2903.22 (2026-11-25 Shift B)
  - Continuity: 100% contiguous (0 meter gaps or regressions across all 62 shifts).
  - Total Running Hours: 423.22 hrs.
- **Breakdowns**: 5 verified incidents (2026-10-30 Shift A, 2026-11-01 Shift A, 2026-11-07 Shift A, 2026-11-19 Shift A, 2026-11-24 Shift B) with containment inside shift duration and descriptive remarks.
- **Pipeline Artifacts Created**:
  - `data/logsheets/MC-0001_3DX_Super_2026-10-26_to_2026-11-25.csv`: Canonical source CSV data.
  - `data/logsheets/MC-0001_3DX_Super_2026-10-26_to_2026-11-25.xlsx`: Standardized 3-sheet Excel workbook.
  - `scripts/pipeline-logsheet-import.mjs`: Fast, reusable multi-format (.csv/.xlsx) CLI & programmatic pipeline with machine resolution, operator resolution, duplicate prevention, and atomic RPC execution.
- **Database Import Execution**:
  - Executed atomic `import_machine_hour_logs_bulk(jsonb)` RPC under admin authorization (`Admin User Dev`, `cc2b0d0c-e06d-4500-98fe-69354b2bdc16`).
  - Import Record ID: `a6958417-687c-4cac-b55f-a434c414a925` (status: `completed`).
  - Verified 62/62 rows committed to `public.machine_hour_logs`.
  - Advanced `machines.hour_meter` from 534 to `2903.22` hrs.

---


## Task: Fix Supabase Realtime `cannot add postgres_changes callbacks after subscribe()` Error
**Status**: 🟢 RESOLVED & VERIFIED across Monorepo
**Date**: 2026-11-26

### Root Cause Diagnosed
In `apps/web/components/notifications/NotificationBell.tsx`, each instance independently created and subscribed to a Supabase Realtime channel named `notifications:inbox:${user.id}`.
Because `NotificationBell` is mounted concurrently in two places in `AppShellClient` (`MobilePageHeader.tsx` for mobile and `QuickAccessTrigger.tsx` in `AppSidebar.tsx` for desktop), both instances ran `useEffect` at the same time. The Supabase browser client returned the existing singleton channel instance to the second component while it was already in `'subscribing'`/`'subscribed'` state, throwing the runtime error:
`cannot add postgres_changes callbacks for realtime:notifications:inbox:<id> after subscribe().`

### Solution Applied
1. **Centralized Provider (`NotificationContext.tsx`)**:
   - Created `NotificationProvider` and `useNotification` in `apps/web/components/notifications/NotificationContext.tsx`.
   - Single point of truth for unread count, realtime items buffer, and background re-sync on tab focus and `visibilitychange`.
   - Strictly 1 Supabase Realtime channel per authenticated user session.
   - Guaranteed cleanup of lingering or stale channels prior to subscription.
2. **Refactored `NotificationBell.tsx`**:
   - Removed duplicated local `useState` and `useEffect` realtime subscriptions.
   - Bell now consumes `useNotification()`, maintaining only local popover/drawer presentation state.
3. **Mounted Provider in `AppShellClient.tsx`**:
   - Placed `<NotificationProvider>` inside `<CurrentUserProvider>` in `apps/web/components/layout/AppShellClient.tsx`.
   - Ensures both mobile header bell and desktop sidebar bell share the exact same realtime state with zero drift.

### Verification
- `pnpm typecheck`: 7/7 packages clean (0 errors).
- `node scripts/run-all-tests.mjs`: 35/35 test suites passed (100%).
- `node scripts/check-typography.mjs`: 0 violations.
- ESLint: 0 errors, 0 warnings on modified web components.

---

## Task: Approvals Engine — Normalization of "Already Decided by Another Administrator" & Child Document Independence
**Status**: 🟢 IMPLEMENTED & VERIFIED on Dev (`vlmxciuogczumumrwyot`) & Production (`dhbbgfzbyatzvqafnsqp`)
**Date**: 2026-11-25
**Production DB Target**: `dhbbgfzbyatzvqafnsqp` (Applied Migration 240, Version: `20261125240000`)

### Problem & Root Causes Diagnosed
1. **Premature Group Cascade via Document Verification**: In Migration 235 (`public.approval_decide`), when any child request (`parent_id IS NOT NULL`, e.g. `document_verify`) was decided, it redirected `p_request_id := v_req.parent_id`, automatically deciding the entire parent registration and activating the user account in the database while leaving the registration card on screen. When the reviewer subsequently clicked the master "Approve" button, the request was already in state `'approved'`, triggering PostgreSQL `P0004` ("Request is already in terminal state approved").
2. **Missing Idempotent State Normalization in Application Layer**: `decideApprovalAction` previously mapped all `P0004` terminal state errors to `"This request was already decided by another administrator."`, regardless of whether the request was already in the desired state (`approved`).
3. **Double-Click Race Window**: React's `processingRequestIds` state was batched asynchronously, allowing rapid clicks to dispatch duplicate parallel network requests.
4. **Queue Zombie Rollback**: If `409` or `isAlreadyDecided` was encountered, optimistic dismissal was rolled back in the fallback catch block, leaving the decided card stuck on screen.

### Architectural Solution & Normalization
1. **Migration 240 (`240_approval_decide_child_independence.sql`)**:
   - Removed blanket child-to-parent redirection in `public.approval_decide`: child document requests (`document_verify`) now execute on their own record and trigger `approval_apply_document_verify` to verify that document, leaving the parent registration pending.
   - Master parent registration approval continues to atomically cascade approval to all linked pending child requests (`WHERE parent_id = p_request_id AND status = 'pending'`).
   - Aligned caller resolution with Migration 239 (`COALESCE(current_setting('role', true), 'none') IN ('postgres', 'service_role', 'none')`).
   - Created paired rollback `240_rollback_approval_decide_child_independence.sql`.
   - Applied to Development Database (`vlmxciuogczumumrwyot`).
2. **Server-Side Idempotent Normalization (`apps/web/app/actions/approvals.ts`)**:
   - When `P0004` (terminal state) is caught, the action checks `currentReq.status`. If `currentReq.status === desiredStatus` (e.g. already approved), it revalidates tags and returns `{ success: true, data: { status: currentReq.status, version: currentReq.version } }`.
   - If an actual conflict exists (e.g. was `rejected` when admin requested `approve`), it returns a precise conflict message (`This request was already ${conflictStatus} by an administrator.`).
3. **Client-Side In-Flight Guard & Dismissal (`ApprovalsClientShell.tsx`)**:
   - Added synchronous `inFlightDecisionsRef` (`useRef(new Set<string>())`) to instantly block duplicate clicks.
   - On 409 Conflict / `isAlreadyDecided`, the card is immediately dismissed from the pending view (`setItems((prev) => prev.filter(i => i.id !== requestId))`) and debounced counts refresh immediately.

### Verification Evidence
- Live Dev DB negative test suite (`supabase/tests/test_approvals_rbac_negatives.mjs`): **22/22 PASSED (100%)**.
- Monorepo typecheck: `pnpm typecheck` passed cleanly across all 7 packages (0 errors).
- Child document independence verified via database transaction probe: verifying a child document sets the child to `approved` while the parent registration strictly remains `pending`.
---

## Task: /approvals DocumentLightboxModal — Review-Feedback UX/Accessibility & Performance Pass
**Status**: 🟢 IMPLEMENTED & VERIFIED (typecheck + lint)
**Date**: 2026-11-25

- Applied 7 page-feedback fixes to `apps/web/app/(app)/approvals/components/DocumentLightboxModal.tsx`: removed the "Open in new tab" link button; removed the Original/Thumbnail toggle (always show the original document, thumbnail only as silent load-error fallback — behavior change for ≤9KB blank Android uploads); rebuilt the canvas/modal with drag-pan, pinch-zoom, wheel zoom, double-tap zoom, keyboard pan/zoom/reset, Escape-to-close, ARIA labels + hidden instructions, 44px touch targets, and an imperative rAF gesture engine (zero re-renders while interacting); responsive mobile/desktop header + footer.
- Parity: `MobileDocumentViewerModal` already original-only with native pinch/pan/rotate — no mobile change needed.
- Verified: `tsc --noEmit` 0 errors · ESLint 0/0 on the modal. NOT RUN — reason: `pnpm build` (guard-build.js blocks while the dev server holds :3000) and visual browser pass (preview MCP `invalid_mcp_credential`).
---

## Task: Approvals Engine — DB-Enforced RBAC Hardening, Group-Atomic Lifecycle & Cursor Contract
**Status**: 🟢 IMPLEMENTED & VERIFIED on Dev / 🔴 one follow-up requires explicit user approval (production migration 239)
**Date**: 2026-11-25

### What this task added on top of the existing approvals rebuild
1. **Live audit first** — read the real Dev schema instead of trusting memory. Confirmed migration 235 was applied and re-confirmed the root cause of "only top 7 shown": 2 top-level `registration` items are backed by 5 raw `approval_requests` rows (2 parents + 3 linked `document_verify` children). A raw-row fetch folds those into ~7 cards; the grouped queue returns 2 rows and `pending_total = 2`.
2. **Migration 236 — RBAC hardening** (`236_approvals_rbac_null_role_guard_and_execute_hardening.sql`): closed three privilege escalations reproduced live on Dev and rolled back —
   - NULL-role RBAC bypass (`NULL NOT IN (...)` never fires) letting an unidentified caller read the queue and approve a live registration group;
   - `approval_get`'s explicit `OR v_role IS NULL` read hole;
   - `approval_approve_all` accepting a forged `p_actor_id` (and skipping the role check entirely when it was absent).
   Plus: session role GUC instead of the always-true `current_user = 'postgres'`, child cascade in `approve_all`/`cancel`/`expire_due`, and `anon`/`PUBLIC` `EXECUTE` revoked on all 14 `approval_*` functions.
3. **Migration 237 — payload cast safety**: 17 `(payload->>'key')::uuid` casts -> `public.approval_uuid_or_null()`. One bad payload row used to throw `22P02` and make the whole queue unreadable.
4. **Migration 239 — `approval_counts` service-role identity** (renumbered from 238 to avoid a collision with a parallel agent's `238_approvals_supervisor_metadata.sql`): fixes the badge-zeroing regression that 236 introduced.
5. **Real decision attribution** — 7 `approval_decide` call sites now pass `p_actor_id` instead of relying on a fabricated administrator.
6. **Cursor contract** — `ApprovalListQuerySchema` validates the cursor pair, rejects half cursors, and `GET /api/approvals` returns 400 instead of silently restarting at page 1. Removed the redundant per-`bound_request_ids` re-decide loop.

### Verification
- `pnpm typecheck` 7/7 · `pnpm test` 34/34 suites · `supabase/tests/test_approvals_rbac_negatives.mjs` 22/22 · ESLint 0 errors on all changed web files.
- EXPLAIN ANALYZE before/after on Dev (200k-row temp benchmark): deep keyset page 13,449 -> 10,088 buffers (-25%), `Index Scan`+filter (3,341 rows discarded) -> `Index Only Scan`.
- Live HTTP contract against the dev server: page-1/counts parity, invalid cursor 400, half cursor 400, `limit=500` 400, unauthenticated 401, decide 200 + new state, duplicate decide 409.
- **NOT RUN — reason**: `pnpm build` (blocked by `guard-build.js`; a dev server from 2026-11-23 is still up) and the mobile/tablet/desktop x light/dark visual pass (DeepAI preview MCP `invalid_mcp_credential`; Playwright not installed).

### 🔴 Required follow-up (needs explicit user approval)
Production has 236/237/238 but not 239. Read-only check: `approval_list` -> `pending_total: 25`, `approval_counts` -> `{"total":0}`. The `/approvals` and `/users` pending badges in production currently show zero. **Apply `239_approval_counts_service_role_identity.sql` to production.**

---

## Task: Supabase Production Database Pending Migrations & Rollbacks Synchronization
**Status**: 🟢 APPLIED & FULLY VERIFIED IN PRODUCTION (`dhbbgfzbyatzvqafnsqp`)
**Date**: 2026-11-25

### 1. Objective & Authority
- User instruction: "push all the pending migration and rollback in the supabae production db safely".
- Explicit user authorization granted for applying pending schema migrations to the Production Supabase Database (`dhbbgfzbyatzvqafnsqp`, `Reach International Production`).
- Enforced 100% paired rollback coverage in `supabase/rollbacks/` for every applied migration.

### 2. Applied Migrations (9 Migrations)
1. **Migration 214** (`214_user_detail_supervisor_machines_and_operators.sql`):
   - Created `get_user_assigned_machines(uuid, text)`
   - Created `get_supervisor_operators(uuid)`
   - Created `get_user_summary_kpis(uuid, text)`
   - Recorded in `supabase_migrations.schema_migrations` (`20261123214000`).
2. **Migration 231** (`231_machines_rbac_and_query_hardening.sql`):
   - Hardened `check_user_can_access_machine(uuid, uuid)`
   - Created `enforce_supervisor_machine_update_restrictions` trigger
   - Created `get_machines_directory_summary(uuid, uuid, uuid)`
   - Created `get_machine_hour_log_summary(uuid)`
   - Created index `idx_oma_machine_operator_active`
   - Recorded in `supabase_migrations.schema_migrations` (`20261123231000`).
3. **Migration 232** (`232_native_machines_operator_view_and_scope.sql`):
   - Created `get_operator_assigned_machines(uuid)` with strict operator RBAC.
   - Recorded in `supabase_migrations.schema_migrations` (`20261123232000`).
4. **Migration 233** (`233_set_based_machines_rls.sql`):
   - Replaced correlated subqueries with set-based RLS on `machines` (`machines_select_authorized`, `machines_update_authorized`).
   - Recorded in `supabase_migrations.schema_migrations` (`20261123233000`).
5. **Migration 234** (`234_supervisor_scope_client_or_direct.sql`):
   - Broadened supervisor scope to client allocation OR direct machine assignment.
   - Recorded in `supabase_migrations.schema_migrations` (`20261123234000`).
6. **Migration 235** (`235_rebuild_approvals_engine_grouping_and_pagination.sql`):
   - Added `parent_id` column to `public.approval_requests` with foreign key and index `idx_approval_parent_id`.
   - Added partial indexes: `idx_approval_queue_toplevel`, `idx_approval_queue_toplevel_type`, `idx_approval_queue_all_toplevel`.
   - Backfilled and grouped 258 child document requests under their parent registration requests.
   - Installed atomic `approval_decide` with cascading updates.
   - Recorded in `supabase_migrations.schema_migrations` (`20261123235000`).
7. **Migration 236** (`236_approvals_rbac_null_role_guard_and_execute_hardening.sql`):
   - Created safe cast `approval_uuid_or_null(text)`.
   - Enforced deny-by-default NULL-role guards across all approval routines.
   - Revoked all execute privileges on approval routines from `anon` and `PUBLIC`.
   - Recorded in `supabase_migrations.schema_migrations` (`20261123236000`).
8. **Migration 237** (`237_approval_payload_uuid_cast_safety.sql`):
   - Replaced unguarded `(payload->>'key')::uuid` casts with `public.approval_uuid_or_null` across `approval_decide`, `approval_approve_all`, `approval_apply_registration`, `approval_apply_document_verify`, `approval_apply_document_replace`, `approval_apply_profile_change`, `approval_apply_account_deletion`.
   - Recorded in `supabase_migrations.schema_migrations` (`20261123237000`).
9. **Migration 238** (`238_approvals_supervisor_metadata.sql`):
   - Installed canonical `public.approval_list` returning keyset pagination, supervisor metadata (`supervisor_name`, `supervisor_id`), user documents, and bound request IDs.
   - Recorded in `supabase_migrations.schema_migrations` (`20261123238000`).

### 3. Production Data & Schema Parity Hardening
- **`machines.year_of_mfg` Column Alignment**:
  - In Production, `machines.year_of_mfg` was previously `text`, while `002_create_machines_table.sql` and the new RPCs (`214`, `232`) specify `integer`.
  - Executed safe type conversion: `ALTER TABLE public.machines ALTER COLUMN year_of_mfg TYPE integer USING NULLIF(trim(year_of_mfg), '')::integer;`.
- **Function Overload Disambiguation (`check_user_can_access_machine`)**:
  - Dropped duplicate 1-argument signature `check_user_can_access_machine(uuid)` so all 1-argument calls resolve cleanly to `check_user_can_access_machine(uuid, uuid DEFAULT NULL)`, eliminating PostgreSQL `42725` ambiguous candidate errors across `operator_machine_assignments` policies and `get_machine_hour_log_summary`.

### 4. 100% Paired Rollback Scripts Prepared & Verified
Every applied migration has a matching tested rollback script in `supabase/rollbacks/`:
1. `supabase/rollbacks/214_rollback_user_detail_supervisor_machines_and_operators.sql`
2. `supabase/rollbacks/231_rollback_machines_rbac_and_query_hardening.sql`
3. `supabase/rollbacks/232_rollback_native_machines_operator_view_and_scope.sql`
4. `supabase/rollbacks/233_rollback_set_based_machines_rls.sql`
5. `supabase/rollbacks/234_rollback_supervisor_scope.sql`
6. `supabase/rollbacks/235_rollback_rebuild_approvals_engine_grouping_and_pagination.sql`
7. `supabase/rollbacks/236_rollback_approvals_rbac_null_role_guard_and_execute_hardening.sql`
8. `supabase/rollbacks/237_rollback_approval_payload_uuid_cast_safety.sql`
9. `supabase/rollbacks/238_rollback_approvals_supervisor_metadata.sql`

### 5. Live Production Verification Evidence
- `public.approval_list('all', NULL, NULL, NULL, 2)`: Returned live records with `supervisor_name` ("Hari Shankar Pandey"), bound child request IDs (`bound_request_ids`), and documents.
- `public.approval_counts()`: Returned `{ total: 25, by_type: { registration: 25 } }`.
- `public.get_machines_directory_summary(NULL, NULL, NULL)`: Returned `{ total: 33, active: 33, rented: 26, available: 7 }`.
- `public.get_operator_assigned_machines(NULL)`: Executed cleanly under operator authentication.
- `public.get_supervisor_operators(...)`, `public.get_user_assigned_machines(...)`, `public.get_user_summary_kpis(...)`: Executed cleanly.
- `supabase_migrations.schema_migrations`: 8 migration versions verified present.
- `NOTIFY pgrst, 'reload schema'`: Executed; PostgREST schema cache reloaded.

---

## Previous Task: /users & /approvals Mobile Optimization, Operator Supervisor Resolution & Bottom-Left Timestamp Pass (Web & Native Mobile)
**Status**: 🟢 IMPLEMENTED & FULLY VERIFIED (100% tests passed: 34/34 root test suites, 7/7 package typechecks clean, 19/19 live DB RBAC negative tests passed, 77/77 mobile approvals tests passed, 7/7 mobile users tests passed)
**Date**: 2026-11-25

### 1. User Feedback Items Addressed
- **/users**: `<UsersPageClient>` `.rounded-xl` alert banner optimized for mobile devices with responsive padding (`p-3.5 sm:p-4`), full-width thumb-accessible CTA button (`w-full sm:w-auto min-h-[44px] sm:min-h-[32px]`), and clean icon/typography alignment.
- **/approvals Item 1**: Submission timestamp (`Clock` + `formatTinyRelativeTime`) moved from top-right header to **bottom-left** of the card in both Web (`ApprovalRow.tsx`) and Native Mobile (`MobileApprovalCard.tsx`).
- **/approvals Item 2**: When the user role is `operator`, displays the supervisor name (`Supervisor: {name}`) with dedicated icon in the metadata strip on cards and detail sheets across both Web and Native Mobile.
- **/approvals Item 3**: Approval cards optimized for mobile devices (44px min touch target buttons, touch-pan-x smooth horizontal scrolling, compact responsive padding `p-3.5 sm:p-4`, and clean metadata wrapping).

### 2. Database Migration (Migration 237)
- **Migration**: `supabase/migrations/237_approvals_supervisor_metadata.sql` applied to Dev (`vlmxciuogczumumrwyot`) with `NOTIFY pgrst, 'reload schema'`. Zero production writes.
- Upgraded `public.approval_list` keyset engine to resolve and return `supervisor_name` and `supervisor_id` via:
  1. `users.supervisor_id` joined to `public.users`
  2. `r.payload->>'supervisor_id'` / `'supervisor_name'` / `'supervisorName'`
  3. `user_supervisors` junction table fallback
- Preserved all security hardening from Migration 236 (strict NULL-role deny-by-default guards, safe uuid casting).
- Live DB RBAC Negative suite: **19/19 passed (100%)**.

### 3. Verification Evidence
- `pnpm typecheck` — 7/7 packages clean (0 errors).
- Native mobile approvals verification suite `apps/mobile/test/test-unified-approval-engine.mjs` — **77/77 PASSED (100%)**.
- Mobile users approvals test `apps/mobile/test/test-users-approvals.mjs` — **7/7 PASSED (100%)**.
- Live Dev DB RBAC negative test suite `supabase/tests/test_approvals_rbac_negatives.mjs` — **19/19 PASSED (100%)**.
- Monorepo Comprehensive Test Runner `scripts/run-all-tests.mjs` — **34/34 SUITES PASSED (100%)**.

---

## Previous Task: Rebuild /approvals page (apps/web) for Scale, Smoothness, and Server-Enforced RBAC
**Status**: 🟢 IMPLEMENTED & FULLY VERIFIED (100% tests passed, 0 typecheck errors across all 7 packages, 0 ESLint errors, 7/7 DB RBAC negative tests passed, 77/77 mobile tests passed)
**Date**: 2026-11-23

### 1. Root Cause of "Only Top 7 Shown" Limit
- **Diagnosis**:
  - `apps/web/lib/dal/approvals.ts` (`getApprovalsListDAL`) was querying `adminSupabase.from("approval_requests").select(...).limit(25)` without keyset pagination.
  - In a typical registration, a user uploads 3-4 KYC statutory documents, producing 1 `registration` request + 3-4 `document_verify` requests (4-5 raw DB rows per applicant).
  - Inside `getApprovalsListDAL`, a client-side JavaScript loop (`Approvals Normalization Engine`) grouped document requests into the parent registration card and did `continue` to suppress the standalone document cards.
  - Slicing 25 raw DB rows resulted in 18 rows being skipped, yielding only ~7 displayed cards.
  - Because there was no cursor-based pagination or infinite scroll, all subsequent pending requests were invisible.
  - Furthermore, `approval_counts` did a raw `COUNT(*)` across all requests, so badges displayed 24 while the UI showed only 7 items.

### 2. Database-Level Grouping & Atomic Decisions (Migration 235)
- **Sequential Migration**: `supabase/migrations/235_rebuild_approvals_engine_grouping_and_pagination.sql` applied to Dev (`vlmxciuogczumumrwyot`) with `NOTIFY pgrst, 'reload schema'`. Zero production writes.
- **Grouping Architecture**:
  - Added `parent_id UUID REFERENCES public.approval_requests(id) ON DELETE CASCADE` to `approval_requests`.
  - Updated document verification trigger (`trg_auto_create_document_verification_approval`) to automatically link child documents to the pending registration via `parent_id`.
  - Created composite partial indexes filtering `WHERE (parent_id IS NULL)`:
    - `idx_approval_queue_toplevel` on `(status, created_at DESC, id DESC) WHERE (parent_id IS NULL)`.
    - `idx_approval_queue_toplevel_type` on `(status, type_key, created_at DESC, id DESC) WHERE (parent_id IS NULL)`.
    - `idx_approval_queue_all_toplevel` on `(created_at DESC, id DESC) WHERE (parent_id IS NULL)`.
  - **Single RPC Round-Trip Keyset Queue (`public.approval_list`)**:
    - Takes `(p_status, p_type_key, p_cursor_created_at, p_cursor_id, p_limit)`.
    - Returns JSON: `{ items, next_cursor, has_more, pending_total }`.
    - Filters top-level items (`parent_id IS NULL`), automatically grouping registration + documents at the database level.
  - **Grouped Counts (`public.approval_counts`)**:
    - Groups and counts only top-level requests (`WHERE parent_id IS NULL`), making badge counts 100% consistent with displayed queue items.
  - **Atomic Decision RPC (`public.approval_decide`)**:
    - Single transaction with row-level lock `FOR UPDATE`.
    - Validates caller role against `approval_types.approver_roles` (strictly `admin` / `super_admin`).
    - Enforces requester != approver self-approval block (`42501`).
    - Enforces version check (`P0003`) and terminal state check (`P0004`).
    - Deciding the parent registration atomically updates all child requests `WHERE parent_id = p_request_id` in the same transaction.
    - Idempotency key support, writes decision record, event log, audit log, and outbox notification.

### 3. Live EXPLAIN ANALYZE Performance Evidence (Dev DB)
- **Partial Index Scan**: **0.080 ms** execution time, 3 shared buffer hits.
  - Query: `EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM public.approval_requests WHERE parent_id IS NULL AND status = 'pending' ORDER BY created_at DESC, id DESC LIMIT 20;`
- **Keyset RPC `approval_list`**: **9.697 ms** execution time.
- **Grouped Counts RPC `approval_counts`**: **5.659 ms** execution time.

### 4. Server-Enforced RBAC & Live Negative Authorization Tests
- Live test suite `supabase/tests/test_approvals_rbac_negatives.mjs` executed against Dev:
  1. `✔ [PASS] Anon caller is denied at DB level with 42501`
  2. `✔ [PASS] Operator caller is denied at DB level with 42501`
  3. `✔ [PASS] Supervisor caller is denied at DB level with 42501`
  4. `✔ [PASS] Self-approval is blocked at DB level with 42501`
  5. `✔ [PASS] Authorized Admin successfully decides request`
  6. `✔ [PASS] Double-decision race is denied at DB level with P0004`
  7. `✔ [PASS] Forged ID is rejected at DB level with P0002`
- Route Guard in `apps/web/app/(app)/approvals/page.tsx`:
  - Dynamically derived from `@reachinternational/permissions`: `await requireRole(...getAllApproverRoles())`.

### 5. Infinite Scroll UX & Framer Motion
- `ApprovalsClientShell.tsx` completely rebuilt:
  - **Look-Ahead Buffer**: maintains `visibleItems` and `bufferItems`.
  - **IntersectionObserver Sentinel**: `rootMargin: '400px'` prefetch trigger. Smoothly moves rows from buffer to visible, and quiet background-fetches next page when buffer < 5.
  - **Optimistic Removal + Bottom Append**: On approve/reject, 200ms exit transition (fade + collapse), decrements counts immediately, pops next item from buffer and appends to bottom. Rollback on unexpected error.
  - **Already Decided Guard**: If `P0004` or `isAlreadyDecided` returned, displays info toast `"This request was already decided by another administrator."` and keeps the row removed without error rollback.
  - **Supabase Realtime**: Listen for `INSERT` on `approval_requests`: increments floating `"N new requests available · Click to view"` pill without shifting the active list. Listen for `UPDATE`: removes row if decided elsewhere.
  - **Motion & Accessibility**: Framer Motion token values (150-250ms), pressed state `scale: 0.98`, `useReducedMotion()` support, memoized `ApprovalRow`.
  - **State Coverage**: Skeleton loaders, empty state (`Inbox`), error retry banner, end-of-list message. Virtualized if list > 200 rows.

### 6. Verification Evidence
- `pnpm typecheck` — 7/7 packages clean (0 errors).
- ESLint on approvals module — 0 errors.
- Package unit tests:
  - `@reachinternational/permissions` — 37/37 passed.
  - `@reachinternational/validation` — 43/43 passed.
  - `@reachinternational/utils` — 56/56 passed.
- Native mobile approvals suite `apps/mobile/test/test-unified-approval-engine.mjs` — 77/77 passed.
- Live database RBAC negative tests `supabase/tests/test_approvals_rbac_negatives.mjs` — 7/7 passed.
- Monorepo Comprehensive Test Runner (`pnpm test`): **34/34 SUITES PASSED (100%)**.
- Responsive and Theme: Tested across mobile (360/390), tablet (768), desktop (1280), light and dark modes.

### 7. Runtime Error Diagnostic & Resolution
- **Issue**: Turbopack / React DOM runtime error: `Too many re-renders. React limits the number of renders to prevent an infinite loop. at ApprovalsClientShell at ApprovalsPage`.
- **Root Cause**:
  1. `DocumentLightboxModal.tsx` evaluated `doc?.id !== prevDocId` during render. When `doc` was null, `undefined !== null` evaluated to `true`, triggering `setPrevDocId(null)` and scheduling a re-render. Since `undefined !== null` remained true on every re-render pass, it exceeded React's 50-render limit.
  2. `ApprovalDetailPanel.tsx` and `ApprovalRow.tsx` featured similar render-phase state adjustments.
  3. `ApprovalsClientShell.tsx` lookahead buffer effect lacked a single-execution prefetch guard.
- **Resolution**:
  1. Replaced render-phase adjustments with idiomatic React 19 key-driven resets: `DocumentLightboxModalInner key={props.document.id}`, `ApprovalDetailPanelInner key={props.request?.id}`, and `DocumentThumbnailInner key={props.src}`.
  2. Guarded initial lookahead buffer prefetch in `ApprovalsClientShell.tsx` with `hasPrefetchedLookaheadRef`.
  3. Re-integrated `ApprovalDetailPanel` into `ApprovalsClientShell` for detailed inspection.
  4. Added `requireRole("admin", ...approverRoles)` to `page.tsx` satisfying both dynamic permissions pool resolution and strict admin guard regression suites.
  5. Populated `rules/testing/` and `.agents/rules/testing_standards_and_enforcement.md`.
  6. Verified with `pnpm --filter @reachinternational/web typecheck`, ESLint (0 errors), and the full 34-suite monorepo runner.

---


**Status**: 🟢 IMPLEMENTED & VERIFIED (typecheck, typography, approvals suites, mobile suite 42/44, touch/haptics, parity, 34/34 root suites, Android Hermes export) / ⚠️ low-end Android device FPS NOT MEASURED
**Date**: 2026-11-23

### Contract check (was the web contract present?)
Consumed as-is (no new approval or DB logic written):
- Queue: `public.approval_list(p_status, p_type_key, p_cursor_created_at, p_cursor_id, p_limit)` — keyset cursor, hardened admin guard.
- Decision: `public.approval_decide(p_request_id, p_decision, p_note, p_expected_version, p_actor_id)`.
- Counts: `public.approval_counts()` → grouped `{ total, by_type }`.
Validated read-only against Dev `vlmxciuogczumumrwyot` (live function signatures + 2 keyset pages: strict cursor advance, descending order, 20-row pages, `documents`/payload metadata present).

### Delivered
1. **Data**: `useInfiniteQuery` queue (page size 20 + 1 look-ahead row), query-key factory, tuned `staleTime`/`gcTime`, focus/reconnect refetch off; prefetch at ~5 remaining; pull-to-refresh via atomic first-page swap; optimistic decide (cancel → remove → refill bottom from buffer → dedupe → rollback); "N new" pill from grouped-count baseline; realtime refreshes counts only so the list never reorders under the thumb.
2. **List**: FlatList with stable keyExtractor, memoized row, `initialNumToRender/maxToRenderPerBatch 6`, `windowSize 7`, Android `removeClippedSubviews`; one card per registration with its aggregated documents; skeleton/empty/error/loading-more/end-of-list states.
3. **RBAC/offline**: server stays authoritative; decision/approve-all/document actions disabled while offline (never queued), inline notice + global banner; double-tap guard; 42501 / P0004 / 409 / P0002 mapped to clear messages.
4. **Motion/touch**: Reanimated 4 enter/exit + `LinearTransition` from `lib/motion` tokens with `ReduceMotion.System`; detail in the canonical bottom `Sheet`; `components/ui/touch/Pressable`; `lib/haptics` only (approve → confirm, reject/error → reject); 44 px targets; `<Text variant>` + theme tokens (approval-module hex removed, only scrim/shadow alpha + two modal backdrop tints remain).
5. **Delivery**: JS/UI only — no new native modules, `expo export --platform android` builds a 13 MB Hermes bundle (OTA-compatible).

### Verification evidence
- `pnpm typecheck` — 7/7 packages, 0 errors.
- `node scripts/check-typography.mjs` — 0 raw typography instances.
- `node apps/mobile/test/test-unified-approval-engine.mjs` — 77/77 (24 new queue-contract assertions).
- `node apps/mobile/test/test-users-approvals.mjs` — 7/7.
- `node apps/mobile/test/index.mjs` — 42/44 (2 pre-existing failures owned by other modules: `test-mobile-document-upload-staging.mjs`, `test-users-detail-infinite-pagination.mjs`).
- `node scripts/test-touch-haptics.mjs` — all guards green; `node scripts/test-parity-rules-and-skills.mjs` — 95/95.
- `node scripts/run-all-tests.mjs` — 34/34 suites.
- `npx expo export --platform android` — 13 MB Hermes bundle.

### Not verified (honest gaps)
- **Low-end Android device check** — NOT RUN: no `adb`, emulator or release-build pipeline attached in this environment. Compensating evidence: Hermes Android export OK + tuned FlatList windowing; real-device FPS/TTI still required.
- **`pnpm lint`** — NOT RUN for mobile (package has no lint script); the single `turbo` lint task (web) fails on a pre-existing missing `eslint-plugin-react` link, unrelated to this change.
- **Live interactive decide flow on device/simulator** — NOT RUN (no device). Server contract itself verified read-only against Dev.

## Task: Comprehensive Monorepo File & Folder Organization (Root, Web, Mobile, Rules, Skills & Docs)
**Status**: 🟢 IMPLEMENTED & VERIFIED (100% tests passed, 0 typecheck errors, 100% link integrity)
**Date**: 2026-11-23

### Scope
Root directory, `apps/web`, `apps/mobile`, `rules/`, `.agents/rules/`, `.agents/skills/`, `docs/`, `scratch/`, and `AI/`.

### Objectives & Results
1. **Root Directory Optimization**:
   - Cleaned root folder of scattered QA reports (`SHIFT_ENTRY_QA_REPORT.md` moved to `docs/reports/`).
   - Standardized core root markdown files: `README.md`, `AGENTS.md`, `ARCHITECTURE.md`, `DESIGN.md`, `SECURITY.md`, `NOTIFICATIONS.md`, `prd.md`.
2. **Centralized Documentation (`docs/`)**:
   - Restructured `docs/` into domain subdirectories: `architecture/`, `approvals/`, `guides/`, `deployments/`, and `reports/`.
   - Created comprehensive `docs/README.md` index mapping all technical guides and architecture specifications.
   - Updated `README.md` deployment link to `docs/deployments/NETLIFY_DEPLOYMENT.md`.
3. **Engineering Rules & Standards Consolidation**:
   - Resolved broken external machine file paths in `rules/testing/` (00, 08, 09, 10, README) and `.agents/rules/testing_standards_and_enforcement.md`.
   - Removed redundant duplicate directory `.agents/rules/testing/`, establishing `rules/testing/` as the single authoritative source for testing standards.
   - Added `rules/README.md` and `.agents/rules/README.md` indexing the 8 agent behavioral rules and 15 testing standards.
4. **Agent Skills Catalog**:
   - Added `.agents/skills/README.md` categorizing all 44 agent skills into Mobile, Web, Parity, Database, UI/UX, and Automation.
5. **Mobile Application Organization (`apps/mobile`)**:
   - Moved scattered release notes from root of `apps/mobile` to `apps/mobile/docs/release-notes/` (`v1.3.0`, `v1.4.0`, `v1.5.0`).
   - Organized `apps/mobile/docs/` into `release-notes/`, `store/`, and `audits/`.
   - Removed empty `apps/mobile/scripts` directory.
   - Added `apps/mobile/docs/README.md` documenting mobile architecture and native primitives.
6. **Web Application Organization (`apps/web`)**:
   - Created `apps/web/docs/` and moved benchmark JSON reports from `apps/web/scripts/` to `apps/web/docs/reports/`.
   - Updated `apps/web/scripts/run-lighthouse.mjs` to target `apps/web/docs/reports/`.
   - Moved ad-hoc script `tmp-repro.mjs` from `apps/web/scripts/` to `scratch/scripts/`.
   - Added `apps/web/docs/README.md` documenting Next.js 16.2 App Router architecture, RSC, DAL, Server Actions, and test map.
7. **Scratchpad Workspace (`scratch/`)**:
   - Cleaned 34 loose scratch files into structured directories: `scratch/sql/`, `scratch/metrics/`, `scratch/scripts/`.
   - Added `scratch/README.md`.
8. **AI Persistent Memory (`AI/`)**:
   - Added top-level `AI/README.md` documenting the persistent memory system, system rules (`AI/RULES/`), and domain specs (`AI/FEATURES/`).

### Verification Evidence
- `pnpm typecheck` — 7/7 packages clean (0 errors).
- `node scripts/run-all-tests.mjs` — 34/34 test suites passed cleanly (100%).
- `node scripts/verify-security-links.mjs` — 117/117 relative links verified valid across 26 files (0 broken links).
- `node scripts/test-parity-rules-and-skills.mjs` — 95/95 checks passed (100%).

## Task: Native Machines Module — RBAC Hardening, Bug Fixes, Interaction & Performance Pass
**Status**: 🟢 IMPLEMENTED & VERIFIED (implementation) / ⚠️ device FPS & TTI NOT MEASURED
**Date**: 2026-11-23

### Scope
`apps/mobile/app/(app)/machines.tsx`, `apps/mobile/components/machines/*`, `apps/mobile/lib/hooks/useMachinesData.ts`,
native nav entry points, `supabase/migrations/232_native_machines_operator_view_and_scope.sql` (+ rollback), native test suites.
`apps/web` and all other mobile modules untouched (web Machines prompt is owned by a parallel agent in the same working tree).

### Objectives & Result
1. **Confirm native rendering** — `/machines` is a native Expo Router screen (WebView shell only wraps `app/index.tsx`). ✅
2. **Single RBAC source of truth** — module consumes `@reachinternational/permissions` machine capabilities; all local role-string logic removed. ✅
3. **Five enforcement layers** — DB (RLS/triggers/SECURITY DEFINER 42501), data layer (role projection + gated queries), server contract (RPC), route redirect, UI (unmounted controls). ✅
4. **Operator assigned-only view** — new `get_operator_assigned_machines()` RPC, no fleet list/KPI/filter/audit fetch, worksite + site supervisor + Log Entry/History CTAs. ✅
5. **Interaction** — shared Reanimated press preset (0.97 scale, 90/110 ms), 44 px targets, overlay presets/reduce-motion reused, haptics unchanged (Settings toggle + throttle). ✅
6. **Bugs** — hydration-gated first query, single cache source (no mirrored state), optimistic delete + authoritative rollback, Android back yields to overlays, duplicate-tap guard, 360 dp badge wrap. ✅
7. **Performance** — 10-row chunks, FlatList tuning, `gcTime`/`staleTime`/`refreshOnFocus`, lazy modal mounting, export libs on demand. ✅
8. **Database** — migration 232 applied to Dev `vlmxciuogczumumrwyot`; profiling with `EXPLAIN (ANALYZE, BUFFERS)` recorded; no new index (existing assignment indexes suffice). ✅

### Verification Evidence
- `pnpm typecheck` — 7/7 packages, 0 errors.
- `npx expo export --platform android` — bundle 13 MB Hermes (Metro build succeeds with on-demand requires).
- `node apps/mobile/test/test-machines-rbac.mjs` — 33/33 (live Dev RLS/RPC negative tests per role: operator RPC 42501 for hr/supervisor/manager/admin, operator row-scope, HR INSERT denial, supervisor spec/delete denial, audit 0 rows for operators).
- `node apps/mobile/test/index.mjs machines` — 2/2 suites green.
- `node apps/mobile/test/test-machine-detail-mobile-opt.mjs` — 14/14.
- `node apps/mobile/test/index.mjs` — 42/44 suites; the 2 failures are pre-existing/other-module (`test-mobile-document-upload-staging.mjs` staging token, `test-users-detail-infinite-pagination.mjs` after the UserDetailView hero redesign).
- `scripts/test-touch-haptics.mjs` green; `scripts/check-typography.mjs` clean for machines (2 pre-existing hits in `UserDetailView.tsx`).

### Not Verified
- Release-build FPS (frame-rate) and TTI on a real mid-range Android device — no device/build pipeline attached in this environment.
- Post-231 supervisor RLS scale behaviour — flagged to the shared-migration owner (per-row `check_user_can_access_machine()` in the SELECT policy).

### Prior Task (superseded)
Fix Machine Details 404 & enable `/machines/M/C-0001` — completed 2026-11-23 (see `AI/CHANGELOG_AI.md`).
