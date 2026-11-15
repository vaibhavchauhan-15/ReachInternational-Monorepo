# AI State

## Monorepo Health & Status
- **Current Task**: Vercel Hobby Plan Cron Schedule Remediation (`cleanup-staging` Hourly to Daily)
- **Status**: 🟢 Clean / Verified & Production Ready (26/26 monorepo test suites passed, 0 typecheck errors, Vercel Hobby plan compliance verified)
- **App Version**: `1.5.0` (Native `versionCode`: 6 managed via EAS remote / `appVersionSource: remote`, `runtimeVersion`: `1.5.0`)
- **Last Verified**: 2026-11-16
- **Vercel Hobby Plan Cron Remediation (`vercel.json` & `apps/web/vercel.json`)**:
  - `Root Cause`: Vercel's free Hobby plan strictly limits cron schedules to at most once per day. Commit `8c6b2cc` introduced `"schedule": "0 * * * *"` on `/api/cron/cleanup-staging`, triggering deploy error: `Hobby accounts are limited to daily cron jobs. This cron expression (0 * * * *) would run more than once per day. Upgrade to the Pro plan to unlock all Cron Jobs features on Vercel.`
  - `Fix Applied`:
    1. Adjusted `/api/cron/cleanup-staging` schedule from `"0 * * * *"` to `"0 2 * * *"` (daily at 02:00 UTC) across both `vercel.json` and `apps/web/vercel.json`.
    2. Spaced out daily cron execution across separate hours: `close-expired-jobs` (00:00 UTC), `cleanup-staging` (02:00 UTC), and `cleanup-superseded` (03:00 UTC).
    3. Created automated verification suite `scripts/test-vercel-cron-hobby-compliance.mjs` verifying schedule syntax, $\le 1$/day Hobby compliance, and handler existence.
    4. Verified `node scripts/run-all-tests.mjs`: 26/26 test suites passed cleanly.
    5. Verified `pnpm typecheck`: 0 errors across all 7 workspace packages.
- **Native Mobile Production Release & Play Store Audit (`apps/mobile`)**:
  - `Expo Doctor`: 19/19 checks passed cleanly (0 issues detected).
  - `Production APK & AAB Profiles`: Configured `eas.json` with `production` (`buildType: "app-bundle"` for Google Play Store) and `production-apk` (`buildType: "apk"` for standalone sideloading).
  - `Android Package Explicit Declaration`: Added `"package": "com.reachinternational.app"` in `apps/mobile/app.json` under `android`.
  - `Release Notes`: Authored comprehensive `apps/mobile/RELEASE_NOTES_v1.5.0.md`, updated in-app What's New manifest `apps/mobile/lib/whats-new/releaseManifest.ts` (`v1.5.0-native-release`), and updated Google Play Console release notes `apps/mobile/store-assets/release-notes-en-US.txt` (489 chars, strictly under 500-char limit).
  - `Automated Test Suites`: 43/43 mobile test suites (`index.mjs`) passed; 357/357 core invariant checks (`run-tests.mjs`) passed; 95/95 parity checks passed; 25/25 monorepo test suites passed; 0 raw typography property violations; rate-limiting touch haptics verified.
- **Migration 200 Rollback Script Remediation (`supabase/migrations/200_rollback_unified_approval_engine.sql`)**:
  - `Root Cause`: In PostgreSQL, `DROP TRIGGER IF EXISTS trg ON tbl;` requires `tbl` to exist. When running Migration 200 on a clean production database where Migration 201 has not yet run, `public.approval_events` table does not exist, causing PostgreSQL to abort with `ERROR: 42P01: relation "public.approval_events" does not exist`.
  - `Fix Applied`:
    1. Wrapped `DROP TRIGGER` inside a `DO $$ BEGIN IF EXISTS (...) THEN EXECUTE ... END IF; END $$;` catalog check on `pg_class` for `approval_events`.
    2. Added `CASCADE` to `DROP FUNCTION IF EXISTS public.trg_block_approval_events_mutation()`.
    3. Verified `tests/approvals/test-approval-engine-exhaustive.mjs` (44/44 passed) and `scripts/run-all-tests.mjs` (25/25 suites passed).
- **Migration 196 Production `sent_at` Column Remediation (`supabase/migrations/196_push_observability_views.sql`)**:
  - `Root Cause`: View `public.v_push_delivery_metrics` calculates latency metrics using `sent_at - created_at`. Migration 192 did not explicitly add `sent_at timestamptz` to `public.notifications` in its migration script. In production, attempting to create the view failed with `ERROR: 42703: column "sent_at" does not exist`.
  - `Fix Applied`:
    1. Added `ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS sent_at timestamptz;` at the beginning of `196_push_observability_views.sql`.
    2. Updated `finish_push_batch` in `196_push_observability_views.sql` to populate `sent_at = coalesce(n.sent_at, now())` when deliveries succeed (`a.has_ok = true`).
    3. Synchronized `192_push_notifications_schema_and_pipeline.sql` to also include `sent_at` and its assignment in `finish_push_batch`.
    4. Verified `test_push_notifications_phase5_6.mjs` (100% passed) and `scripts/run-all-tests.mjs` (25/25 suites passed).
- **Migration 195 Production Relation Error Remediation (`supabase/migrations/195_push_notification_event_producers.sql`)**:
  - `Root Cause`: In Section 6 (`producer_enq1_rfq` / `trg_notify_enq1_rfq`), Migration 195 attached a trigger directly to `public.quote_requests`. In standard migration runs, `195` executes before `20261101061529_rfq.sql` ('1' < '2'). In PostgreSQL, `DROP TRIGGER IF EXISTS` and `CREATE TRIGGER` fail with `ERROR: 42P01: relation does not exist` when the target table does not exist.
  - `Fix Applied`:
    1. Guarded trigger management inside a `DO $$ BEGIN IF EXISTS (...) THEN EXECUTE ... END IF; END $$;` block checking `pg_class` for `quote_requests`.
    2. Guarded contact name resolution in `producer_enq1_rfq()` using dynamic SQL with catalog check to prevent compile-time relation dependencies.
    3. Added reciprocal safe trigger attachment block in `supabase/migrations/20261101061529_rfq.sql` so whenever the RFQ migration is run, `trg_notify_enq1_rfq` is automatically wired up to `quote_requests`.
    4. Verified `test_push_notifications_phase5_6.mjs` (100% passed) and `scripts/run-all-tests.mjs` (25/25 suites passed).
- **Native Mobile KPI Cards Vertical Stretch Remediation (`apps/mobile`)**:
  - `Root Cause`: In React Native (Yoga flexbox), `KPICard.tsx` had `height: '100%'` in StyleSheet and `h-full` in NativeWind className, while `KPIGrid.tsx` native item wrappers had `flexGrow: 1`. In `FlatList` and `ScrollView` headers (Admin Dashboard, Machines, Users, Clients, Payroll, Attendance), Yoga resolved `100%` against the nearest ancestor with a definite height (the screen viewport ~740px), stretching cards to the bottom of the screen and pushing metric values and page content (filter panels, lists) off-screen.
  - `Fix Applied`:
    1. Scoped `height: '100%'` strictly to Web via `Platform.select({ web: { height: '100%' }, default: {} })` across `KPICard`, `StatusCard`, `PrimaryAction`, and role dashboard action cards.
    2. Removed `h-full` from `KPICard` className.
    3. Removed `flexGrow: 1` from native item wrappers in `KPIGrid.tsx` to maintain exact column widths without unintended expansion.
    4. Enhanced `MachineKPIStrip.tsx` with semantic icons (`Wrench`, `CheckCircle2`, `Building2`, `AlertTriangle`), achieving 100% visual parity and restoring complete machine page layout (KPIs, Filter Panel, Machine list).
    5. Verified `node scripts/check-typography.mjs`: 0 violations.
    6. Verified `pnpm --filter mobile typecheck`: 0 errors.
    7. Verified `node apps/mobile/test/index.mjs`: 43/43 test suites passed.
    8. Verified `node scripts/run-all-tests.mjs`: 25/25 monorepo test suites passed.
- **Running Logs View Switcher Migration (`apps/mobile/app/(app)/running-logs.tsx`)**:
  - `User Request`: Page Feedback on `/running-logs` (Viewport: 1536×791, Source: `apps/mobile/index.bundle:483191:33`) — "remove this toggle switch completely and use static btns instead of toggle switch".
  - `Fix Applied`:
    1. Removed `ToggleSwitch` and `SegmentedToggle` completely from `running-logs.tsx`.
    2. Implemented static `Button` components for `Clients`, `Machine`, and `Operator` within `styles.tabButtonGroup`.
    3. Active button renders with `variant="primary"` (Reach Sky Blue solid fill with white text) and inactive buttons render with `variant="outline"` (hairline border, elevated surface, ink text).
    4. Maintained responsive width constraints (`segmentedToggleInnerWide` max width 420px on viewports > 640px, full-width on mobile phones).
    5. Updated `apps/mobile/test/test-segmented-toggle.mjs` consumer test assertion to verify `tabOptionBtn` static button integration and `!runningLogsSource.includes('<ToggleSwitch')`.
    6. Verified `node scripts/check-typography.mjs`: 0 violations.
    7. Verified `pnpm --filter @reachinternational/mobile typecheck`: 0 errors.
    8. Verified `node apps/mobile/test/index.mjs`: 43/43 test suites passed.
    9. Verified `node scripts/run-all-tests.mjs`: 25/25 monorepo test suites passed.
- **Migration 194 Production Unique Constraint Remediation (`supabase/migrations/194_phase1_storage_and_document_foundation.sql`)**:
  - `Root Cause`: Migration 113 previously set dummy placeholders (`aadhaar_number = '987654321098'`, `license_number = 'MH-01-2024-0012345'`) across all non-operator users (`super_admin`, `admin`, `manager`, `hr`, `supervisor`). When Migration 194 attempted to create `users_aadhaar_number_unique_idx`, PostgreSQL failed with `ERROR: 23505: duplicate key value violates unique constraint` on `Key (aadhaar_number)=(987654321098)`.
  - `Fix Applied`:
    1. Nullified legacy Migration 113 dummy placeholder values (`987654321098` and `MH-01-2024-0012345`).
    2. Added CTE window-function deduplication (`ROW_NUMBER() OVER (PARTITION BY ... ORDER BY status = 'active' DESC, role = 'operator' DESC, created_at ASC)`) for `aadhaar_number`, `license_number`, and `phone_normalized` prior to index creation, ensuring only the primary/authoritative record keeps the value and duplicate secondary records have the field set to `NULL`.
    3. Successfully verified `users_phone_normalized_unique_idx`, `users_aadhaar_number_unique_idx`, and `users_license_number_unique_idx` creation.
- **Expo Go Remote Push & Channel Warning Remediation (`apps/mobile`)**:
  - `Root Cause`: Expo Go on Android removed support for remote push notifications (FCM) in SDK 53+. When running inside Expo Go on Android, `Notifications.getExpoPushTokenAsync()` calls `warnOfExpoGoPushUsage.js` which throws an uncaught error. Additionally, `Notifications.setNotificationChannelAsync()` throws a NullPointerException because Expo Go does not create or return custom notification channels through the Android NotificationManager.
  - `Fix Applied`:
    1. Implemented canonical `isExpoGo()` helper in `apps/mobile/lib/notifications/registerPush.ts` checking `isRunningInExpoGo()` from `expo` and `Constants.appOwnership === 'expo'`.
    2. Guarded `setupNotificationChannels()` to skip invocation on Android inside Expo Go, preventing the native NullPointerException.
    3. Guarded `registerForPushNotifications()` to gracefully return `null` inside Expo Go with informative dev logging instead of calling `getExpoPushTokenAsync()`.
    4. Added early warning suppression patterns in `apps/mobile/lib/suppressWarnings.ts` for `expo-notifications` SDK 53 notice and channel manager warnings.
    5. Added ambient banner and informational feedback in `app/(app)/settings/notifications.tsx` to inform developers that remote push requires a development build while local notifications remain active.
    6. Verified `node apps/mobile/test/index.mjs`: **43/43 suites passed (100%)**.
    7. Verified `node scripts/run-all-tests.mjs`: **25/25 suites passed (100%)**.
    8. Verified `pnpm typecheck`: **0 errors across all 7 packages**.
- **Migration 184 Production Constraint Remediation (`supabase/migrations/184_date_independent_operator_shift_assignments.sql`)**:
  - `Root Cause`: Migration 184 backfilled `valid_from` on historical assignments created prior to `2026-10-03` using an unconstrained subquery `SELECT MIN(m.log_date) FROM machine_hour_logs` for each operator/machine/shift code. When an operator (e.g. `0ca0def2-191c-435e-ac27-0541101ed134`) had multiple assignments on shift `c` prior to Oct 3, all assignments received the same minimum log date (`2026-09-29`), generating overlapping date windows (`[2026-09-29, 2026-09-30]` and `[2026-09-29, 2026-10-01]`). Step 2b previously attempted to fix handover collisions using two hardcoded dev UUIDs (`398d7987-2053-4925-af28-52772570c5ba` and `e3f1365b-eb82-4553-9b55-744144655154`), which failed in production, throwing PostgreSQL error `23P01` on creating exclusion constraint `oma_no_active_operator_shift_overlap`.
  - `Fix Applied`:
    1. Bounded historical `valid_from` backfill to only consider logs within the assignment's own lifespan (`log_date <= valid_to`) and excluded logs belonging to strictly earlier completed assignments.
    2. Replaced hardcoded UUID updates in Step 2b with an automated, dynamic reconciliation block (`DO $$ ... $$`) iterating chronologically over `(operator_id, lower(trim(shift_code)))`. Contiguous handovers are automatically adjusted (`valid_to = next.valid_from - 1`), identical start-date overlaps are sequentially separated (`valid_from = prev.valid_to + 1`), and invalid durations (`valid_to < valid_from`) are normalized.
    3. Exclusion constraint `oma_no_active_operator_shift_overlap` now executes with 0 conflicting rows across production and development databases.
- **Expo SDK 58 Dependencies Alignment & Deduplication (`apps/mobile`)**:
  - Resolved `expo doctor` duplicate native module check failure for `expo-constants`: bumped `expo-constants` to `~58.0.16` to match `expo-notifications@58.1.9`.
  - Updated 7 outdated SDK 58 native modules (`expo-document-picker@~58.0.5`, `expo-font@~58.0.12`, `expo-haptics@~58.0.8`, `expo-linear-gradient@~58.0.4`, `expo-print@~58.0.9`, `expo-secure-store@~58.0.3`, `expo-status-bar@~58.0.5`).
  - Executed `pnpm install` and verified lockfile deduplication (`pnpm why -r expo-constants` -> Found 1 version).
  - Verified `expo-doctor`: **19/19 checks passed cleanly (0 errors)**.
  - Verified `tsc --noEmit`: **0 errors**.
  - Verified `apps/mobile/test/index.mjs`: **43/43 suites passed (100%)**.
  - Verified `scripts/run-all-tests.mjs`: **25/25 suites passed (100%)**.
  - Verified `node scripts/check-typography.mjs`: **0 raw typography properties found**.
- **Universal Approval Engine Architecture & Implementation (`@reachinternational/*`, `apps/web`, `apps/mobile`, `supabase`)**:
  - `Universal Multi-Flow Queue & State Machine`:
    - Replaces scattered, ad-hoc approvals across users, documents, profile changes, and account deletions with ONE auditable, transactional approval engine.
    - Master ledger `public.approval_requests` holding single source of truth across all approval types (`document_verify`, `profile_change`, `registration`, `account_deletion`, `shift_conflict`).
    - Single-transaction transitions strictly inside PostgreSQL `SECURITY DEFINER` RPCs (`approval_submit`, `approval_decide`, `approval_cancel`).
    - Strict state machine: only `pending` can transition; terminal states (`approved`, `rejected`, `cancelled`, `expired`) are immutable. Resubmissions link via `supersedes_id` preserving audit trail.
    - Dual-control support with `approval_decisions` tracking individual approver votes (`required_approvals = 2`).
    - Append-only audit ledger `approval_events` protected by trigger preventing `UPDATE` and `DELETE`.
  - `Concurrency & Idempotency`:
    - `approval_decide` locks target request `FOR UPDATE` and verifies `p_expected_version`. Stale concurrent decisions raise `P0003` concurrency conflict handled gracefully in UI.
    - Partial unique index `approval_idem` (`requested_by`, `idempotency_key`) prevents duplicate submissions.
    - Partial queue indexes `approval_queue` and `approval_queue_all_pending` optimize queue lookups (<10ms at 100k+ rows).
  - `Asynchronous Outbox Pipeline`:
    - Side effects decoupled into `approval_outbox` during commit.
    - QStash / Cron worker [`app/api/approvals/outbox/route.ts`] processes topics (`approval.submitted`, `approval.decided`) with bearer auth, retries, and dead-letter handling (5 max attempts).
  - `Web 3-Tier Responsive Experience`:
    - Mobile (<=640px): full-screen sheet with sticky bottom action bar.
    - Tablet (641-1023px): master-detail split layout.
    - Desktop (>=1024px): high-density table, side drawer detail view, and keyboard shortcuts (`A` to approve, `R` to reject).
  - `Native Mobile Ergonomics & Parity`:
    - Expo SDK 58 / React Native.
    - TanStack Query optimistic updates with automatic rollback on error.
    - Segmented status tabs (Pending, Approved, Rejected) and scrollable type filter strip.
    - BottomSheet with type-specific renderers (Document verify, Profile change diffs, Registration details, Account deletion warnings).
    - 100% Geist theme tokens (`colors.canvas`, `colors.canvasElevated`, `colors.hairline`, `colors.ink`, `colors.mute`).
    - 0 raw typography instances verified (`node scripts/check-typography.mjs`).
    - Min 44px touch targets verified (`node scripts/test-touch-haptics.mjs`).
  - `Multi-Flow Integration (Pilot & Remaining)`:
    - Authored idempotent backfill script `supabase/scripts/backfill_document_verification.mjs` (with `--dry-run` and `--revert`).
    - Connected `verifyUserDocumentCore` and `rejectUserDocumentCore` in `apps/web/lib/server/document-review.ts` to route through `approval_decide`.
    - Connected `approveDocumentReplacementCore` and `rejectDocumentReplacementCore` in `document-review.ts`.
    - Connected `approveUser` and `rejectUser` in `apps/web/app/actions/users.ts`.
    - Connected `approveProfileChangeRequest` and `rejectProfileChangeRequest` in `apps/web/app/actions/profile.ts`.
    - Connected `approveAccountDeletionRequestAction` and `rejectAccountDeletionRequestAction` in `apps/web/app/actions/account-deletion.ts`.
    - Added Approvals route to `apps/mobile/app/(app)/_layout.tsx` and web `CommandPalette.tsx`.
    - Standardized migration naming to `supabase/migrations/200_unified_approval_engine.sql` and `200_rollback_unified_approval_engine.sql`.
    - Applied Migration 200 directly to Dev DB `vlmxciuogczumumrwyot`. All 5 tables, partial indexes, triggers, and RPCs verified active live.
    - Executed `supabase/scripts/backfill_document_verification.mjs` populating 32 document verification records into `public.approval_requests`.
    - Benchmarked `approval_counts` and `approval_list` (<100ms) with `benchmark_approval_engine_100k.mjs`.
  - `Documentation & Guide`:
    - Authored `docs/approvals/README.md` explaining how to add a new approval type in 5 steps (config row, payload schema, apply handler, permissions entry, detail renderer), rollout/rollback protocols, and observability metrics.
  - `Verified Quality Gates`:
    - `scripts/run-all-tests.mjs`: **25/25 suites passed cleanly (100%)**
    - `apps/mobile/test/index.mjs`: **43/43 suites passed cleanly (100%)**
    - `tests/approvals/test-approval-engine-exhaustive.mjs`: **44/44 assertions passed (100%)**
    - `apps/mobile/test/test-unified-approval-engine.mjs`: **53/53 assertions passed (100%)**
    - `apps/mobile/test/test-users-approvals.mjs`: **7/7 assertions passed (100%)**
    - `node scripts/check-typography.mjs`: **0 raw typography properties found**
    - `pnpm exec turbo run typecheck --force`: **0 errors across all 7 packages**
  - `Scattered Approvals Permanently Removed & Centralized`:
    - Configured `SUPABASE_ACCESS_TOKEN` across root, `apps/web/.env.local`, and `apps/mobile/.env.local` for unified CLI and dev environment access.
    - Deleted all 7 scattered approval section files (`PendingApprovalsSection`, `ProfileChangeRequestsSection`, `AccountDeletionRequestsSection` across Web and Native Mobile).
    - Replaced with unified ambient banners directing reviewers directly to `/approvals` and `/(app)/approvals`.
    - Removed inline document verification buttons from `UserDetailClient.tsx` and `UserDetailView.tsx`.
    - Integrated all inbound submission pipelines (`auth.ts`, `finalize/route.ts`, `profile.ts`, `account-deletion.ts`, `document-replacement.ts`) into `public.approval_requests`.
    - `@reachinternational/permissions`: **25/25 tests passed**
    - `@reachinternational/utils`: **49/49 tests passed**
    - `node scripts/check-typography.mjs`: **0 raw typography properties found**
    - `pnpm typecheck` (Turbo): **0 errors across all 7 packages (Exit code 0)**
- **Cross-Platform Shift Assignment Push Verification & Delivery**:
  - `Cross-Platform Matrix (100% Verified)`:
    - Web Supervisor -> Native Mobile Operator (Expo Push on Android/iOS outside the app): **PASS**
    - Web Supervisor -> Web Browser Operator (Web Push VAPID outside the browser tab): **PASS**
    - Mobile Supervisor -> Native Mobile Operator (Expo Push on Android/iOS outside the app): **PASS**
    - Mobile Supervisor -> Web Browser Operator (Web Push VAPID outside the browser tab): **PASS**
    - Dual-Registered Operator (Simultaneous fanout to both Native Mobile & Web Browser): **PASS**
  - `Channel Mapping & Robustness`: Updated `resolveAndroidChannel` in `apps/web/lib/notifications/expo-sender.ts` to map both `'assignment'` and `'assignment_alerts'` to Android channel `assignment_updates`.
  - `Quality Gates`: 22/22 monorepo test suites passed (`scripts/run-all-tests.mjs`), 42/42 mobile test suites passed (`apps/mobile/test/index.mjs`), 0 raw typography property violations, 0 typecheck errors across all 7 packages.
- **Document Replacement Optimization & Admin Visibility (`apps/web`, `apps/mobile`, `packages/*`)**:
  - `Console Error Resolution`: Resolved `A replacement request for this document is already pending review (400)` in `/api/documents/upload-url/route.ts` and `apps/web/lib/server/document-replacement.ts`. Instead of rejecting with 400 when an active pending replacement exists, `submitDocumentReplacement` smoothly updates the existing row in `public.document_change_requests` (`staging_path`, `staging_thumb_path`, `created_at = now()`) and records `document.replacement_updated` audit log.
  - `Admin User Document Visibility (/users/[id] & UserDetailView)`:
    - Updated `getUserDocumentsAction` (`apps/web/app/actions/documents.ts`) to query both `public.user_documents` and active `public.document_change_requests` (`status = 'pending'`).
    - Added server-side signed URL batch generation for both canonical `user_files` and private `doc_staging` buckets via `createSupabaseAdminClient()`.
    - Synthesizes `pending_replacement` (with `id`, `signed_url`, `thumb_signed_url`, `created_at`) and attaches `is_pending_request: true` for pending initial documents.
    - Added an Amber Replacement Review Callout card in `UserDetailClient.tsx` (Web) and `UserDetailView.tsx` (Mobile) with:
      - "Replacement Document Pending Review" header with clock icon
      - The newly uploaded image thumbnail preview
      - "Preview New" button opening direct in-app fullscreen viewer
      - "Approve Replacement" button (promotes staging file to `user_files` and executes `approve_document_change` atomic RPC)
      - "Reject Replacement" button (prompts for reason and executes `reject_document_change` atomic RPC)
    - Updated `useUserDetailDocumentsInfinite` in `apps/mobile/lib/hooks/useUserDetailData.ts` to query `document_change_requests`, batch sign staging URLs, and attach `pending_replacement` and `is_pending_request`.
  - `Optimistic Fast Upload & Replace Flow (/profile)`:
    - Added instant optimistic local thumbnail preview via `URL.createObjectURL(file)` in `MyDocumentsSection.tsx`.
    - Displays replacement image thumbnail with "Under Review" pending status badge.
    - Replaced disabled buttons with active "Change Image" action button when a replacement is pending, allowing users to freely upload an updated image without crashes.
    - Thumbnail containers are interactive: tapping on either mobile or desktop opens the in-app document viewer directly.
  - `Mobile Native Parity & Architecture`:
    - Created `POST /api/documents/review` supporting dual authentication (Cookie session for Web and Bearer token for Mobile) for administrative document verification and replacement approvals/rejections.
    - Enforced 44px minimum touch targets (`minHeight: 44` / `min-h-[44px]`) on buttons across both platforms.
    - Maintained strict zero raw typography in mobile styles (`<Text variant="...">`).
    - Zero binary bytes pass through Vercel server functions: images upload directly to Supabase storage signed URLs.
  - `Verified`: 0 type errors across `apps/web` and `apps/mobile`, 43/43 document viewer tests passed, 42/42 user workflow tests passed, 357/357 mobile tests passed, 9/9 phase 7 document tests passed, 8/8 phase 8 admin verification tests passed, 54/54 architecture audit checks passed (100%), 29/29 live signup scenarios passed (100%).
- **Web & Native Signup 100% Parity (`apps/web` & `apps/mobile`)**:
  - `Registration Progress Stepper`: Interactive progress bar with completed steps count, completion percentage, and 6 clickable step chips (1: Role, 2: Shift, 3: Address, 4: Bank, 5: ID, 6: Login) that smoothly scroll to the section.
  - `Work Shift Time Selection`: Clean custom time pickers for start and end times with dynamic duration badge (removed rigid presets to support operators' flexible, non-fixed shift hours across sites).
  - `Document Upload Card Layout`: Responsive header with flex-wrap and auto margins ensuring file size and format badges ("1 MB max · JPG/PNG") never overlap with headings in any viewport.
  - `Operator-Friendly Guidance Hints`: Added plain-language helper texts under all inputs (Name as on Aadhaar, 10-digit mobile, salary account instructions, passbook 9-18 digits, IFSC 11-char code, Aadhaar 12-digit UIDAI, driving licence for Forklift/Boom Lift/equipment, secret 8+ char password).
  - `Interactive Terms & Privacy Checkbox`: Dedicated container card that highlights in soft red with an alert icon when missing, and turns emerald with real-time error clearing when clicked anywhere inside the card.
  - `Enhanced Error Handling & Toasts`: Button remains clickable (`disabled={loading}` only), missing fields are validated simultaneously with instant red borders and auto-scrolling to the first invalid field, accompanied by friendly toast notifications.
  - `Smooth Animations & Password Matching`: Emerald borders, matching lock icons, and "✓ Passwords match" confirmation badge across both platforms. Dismissable draft banner (`[✕]`).
  - `Full Monorepo Verification`: 0 type errors across all 7 packages (`pnpm typecheck`), 48/48 signup workflow checks, and 357/357 core mobile tests passed.
- **Operator Machine Category (`@reachinternational/*`, `apps/web`, `apps/mobile`, `supabase`)**:
  - Implemented mandatory Machine Category dropdown during user registration for the `operator` role across Web and Native Mobile:
    - Stacker
    - Reach Truck
    - Order Picker
    - Electric Pallet Truck
    - Forklift
    - Scissor Lift
    - Boom Lift
  - Number Removal: Dropdown options and display badges strictly show clean category names only (`Stacker`, `Reach Truck`, `Forklift`, etc.) with zero number prefixes (`MACHINE_CATEGORY_SELECT_OPTIONS` = `{ value: name, label: name }`, `formatMachineCategoryLabel` returns clean category name).
  - Section 1 Completeness Fix: Added `transpilePackages: ["@reachinternational/design-tokens", "@reachinternational/permissions", "@reachinternational/types", "@reachinternational/utils", "@reachinternational/validation"]` to `apps/web/next.config.ts` so Turbopack dev cleanly transpiles and watches monorepo packages. Updated `isSignupSection1Complete` to use case-insensitive trimming for `operator` role. Enabled legacy draft string normalization (`"3. Reach Truck"` -> `"Reach Truck"`). Verified Section 1 immediately turns green with checkmark badge upon selecting machine category.
  - Canonical utilities in `packages/utils/src/machine-categories.ts` exporting `MACHINE_CATEGORIES`, `MACHINE_CATEGORY_SELECT_OPTIONS` (`{ value: name, label: name }`), `formatMachineCategoryLabel`, `normalizeMachineCategory`, `isValidMachineCategory`, etc.
  - Automatic database-level enforcement in `supabase/migrations/198_add_machine_category_to_users.sql`: `public.users.machine_category TEXT`, trigger `trg_users_machine_category_role` automatically nulling `machine_category` whenever `role <> 'operator'`, updated `handle_new_user()` trigger and atomic `approve_profile_change_request_atomic` RPC. Applied to Dev DB `vlmxciuogczumumrwyot`.
  - Conditional Zod schema and validation in `@reachinternational/validation`: `SignupSchema`, `validateSignupFormData`, `CreateUserSchema`, `UpdateUserSchema`, `isSignupSection1Complete`.
  - Web UI: `apps/web/app/signup/page.tsx` renders dropdown in Section 1 for operators, `apps/web/app/(app)/users/[id]/UserDetailClient.tsx` displays machine category badge in header and metadata row in Employment Details card, `UserCreateModal.tsx` and `UserEditModal.tsx` enforce machine category for operators and auto-reset when role changes.
  - Native Mobile UI: `apps/mobile/app/(auth)/signup.tsx` renders `SearchableSelect` with `Wrench` icon in Section 1 for operators, `apps/mobile/lib/hooks/useFormDraft.ts` persists/restores machine category draft, `apps/mobile/components/users/UserDetailView.tsx` renders Machine Category badge in hero badges and in Employment Details card, `UserDetailModal.tsx` (`UserRecord`) updated, `CreateUserModal.tsx` and `UserEditModal.tsx` support machine category selection and persistence.
  - Profile Parity: Both Web and Mobile consume `toProfileView` from `@reachinternational/utils`, which displays Machine Category in `Work & Operations` with `{ variant: "info" }` badge for operator profiles.
  - Verified: 0 type errors across all 7 packages (`pnpm typecheck`), 42/42 utils unit tests, 48/48 mobile sign-up workflow checks, 357/357 core mobile test suite, 29/29 live natural registration scenarios, 47/47 live database trigger invariant tests passed.
- **Web Signup FormData Fix (`apps/web`)**:
  - `FIX-SIGNUP-FORMDATA-01`: Resolved `Failed to construct 'FormData': parameter 1 is not of type 'HTMLFormElement'` in `apps/web/app/signup/page.tsx`:
    - Root cause: `handleSubmit` accessed `new FormData(e.currentTarget)` after an `await` (`ensureFreshSessionForSubmit()`), where React's synthetic event had already nulled out `e.currentTarget`.
    - Fix: Switched to `const formData = new FormData()` (0-argument constructor), eliminating DOM element dependency and ensuring 0 binary bytes traverse Vercel.
    - Synchronized `machine_category` for operator accounts across `isSignupSection1Complete`, `missingMandatoryList`, and form submission.
    - Verified: Turbopack compilation clean, 0 type errors across all 7 packages (`pnpm typecheck`), all validation & permissions suites passing (100%).
- **Push Notification & Alert System**:
  - `Phase 1 (Data Foundation)`: Migration `192_push_notifications_schema_and_pipeline.sql` applied on Dev DB (`vlmxciuogczumumrwyot`). Unified inbox/outbox `notifications`, `push_devices`, `push_tickets`, `user_notification_preferences`. Atomic RPCs `enqueue_notification`, `claim_push_batch`, `finish_push_batch`, `register_push_device`, `unregister_push_device`. Verified: 26/26 SQL checks passed (`test_push_notifications_phase1_sql.mjs`).
  - `Phase 2 (Dispatcher)`: Fast-path trigger (`pg_net`) and 1-minute sweeper cron (`pg_cron`) via migration `193_push_fastpath_trigger_and_sweeper_cron.sql`. API routes `/api/notify/dispatch`, `/api/notify/receipts`, `/api/notify/test-send` with constant-time `NOTIFY_SECRET` verification. Expo + Web Push senders. Secrets stored in Supabase Vault and `.env.local`. Verified: all dispatcher tests passed (`test-push-dispatcher.mjs`).
  - `Phase 3 (Native Mobile)`: Expo SDK 58 `expo-notifications` plugin in `app.json` with white-on-transparent `notification-icon.png` (`#0284c7`). 4 Android channels (`breakdown_alerts`, `shift_reminders`, `assignment_updates`, `general_updates`). Device registration/unregistration on auth state changes. Replaced obsolete client timers in `shiftEndNotifier.ts`. Server-synced notification settings removing dead "Overtime Alerts" toggle. Verified: 357/357 mobile tests passed, 0 typography errors.
  - `Phase 4 (Web Application)`: Service worker `/sw.js` with notificationclick window-matching and anti-cache headers. Web push subscription helper `web-push-client.ts`. Deep link parameters `?date=YYYY-MM-DD&shift=CODE&machine=UUID` handled in `OperatorEntryClient.tsx`. Server-synced Web Push toggle and role-aware settings in `SettingsClient.tsx`. Verified: 0 web typecheck errors.
  - `Phase 5 (Reminder Engine SQL)`: Migration `194_shift_reminder_ladder_scanners.sql` applied. Immutable deadline function `shift_entry_deadline(p_work_date)` and `get_pending_shift_slots`. 4 scheduled scanners: `enqueue_shift_end_reminders` (SP1-s1 +15m, SP1-s2 +90m), `enqueue_pending_digest` (SP2 09:00 IST), `enqueue_final_lock_warning` (SL1 18:00 IST), `enqueue_supervisor_digest` (SUP1 09:30 IST).
  - `Phase 6 (Event Producers)`: Migration `195_push_notification_event_producers.sql` applied. Database triggers for `BD1` (breakdown, with 24h old log downgrade), `AS1` (assisted shift log), `EM1` (emergency machine stop/maintenance), `SA1` (assignment changes, respecting `app.skip_notify`), `REG1` (pending user registrations), `ENQ1` (quote requests/RFQs). Server Actions updated for `SEC1` (password changes/resets in `auth.ts`) and `PAY1` (salary statement updates in `payroll.ts`, zero PII).
  - `Phase 7 (Hardening & Observability)`: Migration `196_push_observability_views.sql` applied (`v_push_delivery_metrics`, `v_push_device_health`). Attack surface updated (`security/ATTACK-SURFACE.md` WEB-10, WEB-11, MOB-07, EXT-06, EXT-07). Verified: 21/21 monorepo test suites passed (`scripts/run-all-tests.mjs`), 41/41 mobile test suites passed (`node apps/mobile/test/index.mjs`), 7/7 package typechecks passed (`pnpm typecheck`).
- **Zero-Byte-Pass-Through Document Upload Architecture**:
  - `Phase 1 (Database & Storage Foundation)`: Migration `194_phase1_storage_and_document_foundation.sql` applied. Created `doc_staging` private bucket (1 MB limit, JPEG only). Extended `user_documents`, created `document_change_requests`, added normalized phone unique indexes, and implemented cron routes (`cleanup-staging`, `cleanup-superseded`). Verified: 25/25 checks passed.
  - `Phase 2 (Shared Packages)`: Exported `DOC_UPLOAD`, `stagingPath`, `finalDocumentPath`, error messages, `canViewDocument` RBAC in permissions, and Zod schemas in validation. Verified: all 76 unit tests passed.
  - `Phase 3 (Signup Upload Endpoint)`: Implemented `POST /api/signup/upload-urls` route handler with `<uuid>.<expiry>.<hmac>` session token hardening (2h TTL, constant-time timingSafeEqual), rate limiting (30 req / 10 min, 10 sessions / hr), Cloudflare Turnstile verification support, and direct Supabase storage pre-signed URLs. Verified: 8/8 unit tests and 10/10 acceptance integration checks passed (100% pass rate).
  - `Phase 4 (Web Client & Zero-Byte Submit)`: Canvas-based pick-time compression (`image-compression.ts`, auto-orient, 3-pass step-down targeting $\le 400$ KB, $\ge 600$ px short edge gate, $\le 1$ MB ceiling, 320 px thumbnail). Background direct streaming to signed URLs via `useSignupDocumentUploads` hook with exponential backoff and 1.5h session freshness guard. `signup()` Server Action updated in `auth.ts` to verify staged files and move them to `user_files`. `signup/page.tsx` updated with `DocumentUploadCard`, IndexedDB draft integration, 0-byte FormData serialization, submit double-click gating, and categorized catch block error toasts. Fixed `web-push` namespace Turbopack import issue. Verified: 6/6 compression unit tests, 7/7 client acceptance tests passed, 7/7 monorepo packages typecheck clean, Next.js production build succeeded with 0 errors.
  - `Phase 5 (Native Client & Zero-Byte Submit)`: Native image picking via `expo-image-picker` with camera & gallery and EXIF/GPS stripping (`exif: false`). Native compression via `expo-image-manipulator` (`mobileImageCompression.ts`) enforcing $\ge 600$ px short edge gate, 3-pass adaptive loop (1600px@0.8 -> 1600px@0.7 -> 1400px@0.7), $\le 400$ KB target, 1 MB ceiling, and 320 px thumbnail @ 0.7. ArrayBuffer streaming via `base64-arraybuffer` and `expo-file-system` with automatic direct HTTP PUT fallback. Offline queue integration for `UPLOAD_STAGING_DOCUMENT` in `OfflineQueueManager.ts`. Native hook `useMobileSignupDocumentUploads` tracking slot states (`idle`, `compressing`, `uploading`, `ready`, `failed`) and session freshness (1.5h). Universal finalizer `finalizeStagedSignupDocuments` and `POST /api/signup/finalize` for server-side staging-to-canonical file transfers. Updated `MobileDocumentUploadCard.tsx` with slot lifecycle and accessible camera/gallery modal sheet (min 48px touch targets, 0 raw typography). Updated `apps/mobile/app/(auth)/signup.tsx` to send text fields + session token only (< 10 KB, zero binary file bytes in registration payload). Verified: 15/15 mobile staging tests passed (`test-mobile-document-upload-staging.mjs`), 43/43 signup workflow tests passed, 42/42 mobile test runner suites passed (`test/index.mjs`), 357/357 core mobile tests passed (`run-tests.mjs`), 7/7 package typechecks clean (`pnpm typecheck`), Next.js production build succeeded with 0 errors.
  - `Phase 6 (signup() Server Action)`: Replaced `signup()` server action in `apps/web/app/actions/auth.ts` enforcing the strict 9-step order of operations:
    1. In-action rate limiting via Upstash Redis (`RATE_LIMIT_PROFILES.AUTH_STRICT`) keyed by client IP, returning structured retry errors. Next.js edge proxy (`proxy.ts`) updated with `isServerAction` bypass to prevent premature 429 JSON blocking.
    2. Text field validation and upload session token verification (`verifyUploadSessionToken`) enforcing HMAC signature and 2h expiry.
    3. Concurrently parallelized checks in one single round trip (`Promise.all`): supervisor check, email uniqueness, phone uniqueness (using indexed `users_phone_unique_idx`), Aadhaar uniqueness, driving licence uniqueness, and `doc_staging.list("signup/<uuid>")`.
    4. Document metadata inspection (mimetype `image/jpeg`, size $\le 1$ MB) and parallel HTTP Range 0-2 verification confirming `0xFF, 0xD8, 0xFF` JPEG magic bytes across all main files.
    5. `auth.signUp()` registration: preserves staged files in `doc_staging` on recoverable error for immediate user retry.
    6. Direct bank details sync (`bank_account_number`, `bank_ifsc_code`) to `public.users`.
    7. Parallel server-side `move()` from `doc_staging` to `user_files` with `{ destinationBucket: "user_files" }` at canonical `documents/<userId>/<docType>/<uuid>.jpg` (and `_thumb.jpg`) — zero file bytes pass through Next.js/Vercel or client memory.
    8. Batch array `.upsert()` into `public.user_documents` in a single query and centralized audit log entry (`target_user_id: userId`).
    9. Step 9 compensation rollback: on post-auth failure, deletes newly created user via `adminSupabase.auth.admin.deleteUser(userId)` (cascading to `users` and `user_documents`), returns `"Registration processing failed. Please try again."`, and restores staged files to `doc_staging` for user retry.
    - Verified: 10/10 checks passed in `apps/web/scripts/test-phase6-signup-action.mjs` (100%), 15/15 mobile staging tests passed, 43/43 signup workflow tests passed, 357/357 core mobile tests passed, 7/7 monorepo packages clean (`pnpm typecheck`), Next.js production build succeeded with 0 errors across all 32 routes.
  - `Phase 7 (The user reads and replaces their own documents)`:
    1. Direct Signed Read URLs: Client applications select user's `user_documents` rows directly from Supabase, then call `createSignedUrls(thumbPaths, 60)` once for the list and `createSignedUrl(storage_path, 60)` on opening full image straight against Supabase Storage bucket `user_files` via 3.2 storage RLS policy (`users read own documents`) with zero bytes passing through Vercel or intermediate servers. Cached in React Query / TanStack Query with `staleTime: 45 * 1000`.
    2. Document Verification Status: Displays status pill per document (`verified` in emerald, `pending` in amber, `rejected` in rose with rejection reason callout, and `hasPendingReplacement` banner).
    3. Replacement Upload Endpoint (`POST /api/documents/upload-url`): Dual authentication (Bearer token from Native Mobile & per-request SSR session cookies from Web), verifies active user status (`status === 'active'`), enforces rate limit (10 per hour per user), rejects duplicate pending requests, and generates signed upload URLs in `doc_staging` for main and thumbnail.
    4. Client Pick-Time Compression & Direct Upload: Web canvas compressor (`compressImageForUpload`) and Native image manipulator (`compressMobileImage`) enforce $\ge 600$ px short edge, adaptive loop $\le 1600$ px, 320 px thumb, JPEG 0.8, $\le 400$ KB target, 1 MB ceiling. Client streams ArrayBuffer directly to `doc_staging` signed URLs.
    5. Server-Side Replacement Engine (`submitDocumentReplacement`): Server derives staging path, checks staging list, enforces $\le 1$ MB limit, verifies JPEG magic bytes `0xFF, 0xD8, 0xFF` via HTTP Range 0-2 request, enforces unique pending constraint on `public.document_change_requests (user_id, document_type_code) WHERE status = 'pending'`, and branches on `requires_approval` (immediate cross-bucket move to `user_files`, pointer swap in `public.user_documents`, and audit log vs. pending request creation).
    6. UI Screens & Components: Web `MyDocumentsSection.tsx` and dedicated route `/profile/documents`; Mobile `app/(app)/profile/documents.tsx` and `app/(app)/profile/index.tsx` quick link (min 44px touch targets, zero raw typography).
    - Verified: 9/9 checks passed in `apps/web/scripts/test-phase7-document-read-replace.mjs` (100%), 357/357 core mobile tests passed (`run-tests.mjs`), 7/7 monorepo packages clean (`pnpm typecheck`), Next.js production build succeeded with 0 errors across all 34 routes.
  - `Phase 8 (Admin and HR Read & Verification)`:
    1. RBAC Access Matrix (`packages/permissions/src/documents.ts`): `super_admin, admin, hr` have full view, verify, and reject permissions for all users and document types. `manager, supervisor` have zero access to identity or banking documents, and can only view `driving_license` of verified team members (`isTeamMember: true` validated via `users.supervisor_id` or `user_supervisors` junction table). `operator` has view access only to their own documents. Verified: 20/20 permissions tests passed.
    2. Atomic Database Stored Procedures (`migration 197` applied to Dev DB `vlmxciuogczumumrwyot`): Added `verify_user_document_atomic`, `reject_user_document_atomic`, `approve_document_change` (with `mime_type: 'image/jpeg'`, `file_size_bytes: 0` backfills on new inserts), and `reject_document_change`. All execute with `SECURITY DEFINER` and caller role validation.
    3. Universal Admin Document API Endpoints: Implemented `GET /api/admin/documents/<userId>` (batched 60s signed thumbnail URLs, rate limited 60 req/min, `Cache-Control: no-store`) and `GET /api/admin/documents/<userId>/<docType>` (60s signed full image URL). Dual authentication supports session cookies on Web and Bearer token on Mobile. Invariant enforced: zero signed URLs persisted in `audit_logs`.
    4. Statutory Column Projection & Masking / Reveal Logging: Sanitized `monthly_salary`, `daily_rate`, `ot_hourly_rate`, `bank_account_number`, and `bank_ifsc_code` for non-privileged viewers (`operator`, `supervisor`, `manager`) in query layer (`user-list.ts`, `user-detail.ts`). Masked Aadhaar (`XXXX XXXX 6959`) and Bank Accounts (`••••4321`) in `packages/utils/src/string.ts`. User detail eye toggle logs `aadhaar.reveal` and `bank_account.reveal` audit trail without persisting raw numbers.
    5. Web & Native Verification UI: Side-by-side document preview cards matched with registered statutory values (Aadhaar, Licence, Bank Account & IFSC) on Web (`UserDetailClient.tsx`) and Native Mobile (`UserDetailView.tsx`). "Verify" (green) and "Reject" (red) buttons for privileged roles (`isSuperAdmin`, `isAdmin`, `isHr`), opening accessible reason prompt modal (`RejectReasonModal.tsx`) with haptic feedback.
    6. Audit Trail Documents Domain & Volume Monitoring: Added dedicated `"documents"` tab to `AuditTab` and `AuditTabCounts` in `apps/web/lib/queries/audit-logs.ts` with customized table columns in `AuditLogTable.tsx`. Aggregates `document.view` actions in the past 24 hours per viewer; if an account exceeds 20 views, displays a high-visibility warning banner in `AuditClient.tsx` recommending scrutiny under the Digital Personal Data Protection (DPDP) Act 2023.
    - Verified: 8/8 checks passed in `apps/web/scripts/test-phase8-admin-verification.mjs` (100%), 20/20 permissions tests passed, 35/35 utils tests passed, 357/357 mobile tests passed (`run-tests.mjs`), 7/7 monorepo packages clean (`pnpm typecheck`), Next.js production build succeeded with 0 errors across all 34 routes.
  - `Phase 9 (Proxy, Rate Limits, and Environment)`:
    1. Next-Action Bypass in Edge Proxy (`apps/web/proxy.ts`): Bypassed strict edge JSON 429 rate limiter for requests with `next-action` headers. Prevents edge middleware from breaking the React Server Action client dispatcher with raw JSON. Server actions enforce rate limits internally via Upstash and return structured error responses.
    2. Dedicated Signup Upload Profile: Added `RATE_LIMIT_PROFILES.SIGNUP_UPLOAD` (`windowMs: 10 * 60 * 1000`, `maxRequests: 30`) to accommodate shared carrier IPs on Indian mobile networks. Routed `/api/signup/upload-urls` to this profile.
    3. Removal of `bodySizeLimit` Workaround: Removed `serverActions.bodySizeLimit: "5mb"` from `apps/web/next.config.ts`. Restored standard Next.js 1 MB default now that uploads stream directly to storage and Server Action payloads are tiny text strings (< 10 KB).
    4. Per-Request `getUser()` Caching: Wrapped `supabase.auth.getUser()` in React `cache()` (`getCachedAuthUser`) in `apps/web/lib/supabase/server.ts`, eliminating 10–20 redundant `/auth/v1/user` HTTP calls per page load.
    5. Environment Variables Documentation: Documented `UPLOAD_SESSION_SECRET` in `apps/web/.env.example` alongside `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `CRON_SECRET`, and `NEXT_PUBLIC_APP_URL`.
    - Verified: 5/5 checks passed in `apps/web/scripts/test-phase9-proxy-rate-limits.mjs` (100%), 8/8 Phase 8 tests passed, 9/9 Phase 7 tests passed, 10/10 Phase 6 tests passed, 20/20 permissions tests passed, 35/35 utils tests passed, 357/357 mobile tests passed, 7/7 monorepo packages clean (`pnpm typecheck`), Next.js production build succeeded with 0 errors across all 34 routes.
  - `Phase 10 (Failure Handling Summary & Verification)`:
    1. Upload Fails on Flaky Network: Handled via 3x retry with progressive backoff delays (500ms, 1000ms, 2000ms) and per-file retry button on Web; Native Mobile enqueues upload payloads in `OfflineQueueManager` (`UPLOAD_STAGING_DOCUMENT`) to drain automatically on reconnect.
    2. Duplicate Email/Phone After Upload: Pre-auth parallel validation catches duplicate phone/email without touching staged files; in-memory slots and session token are preserved; retry reuses the same session with zero re-uploads.
    3. Session Expired (Over 2 h): 2-hour HMAC upload session token with client-side 1.5-hour freshness auto-refresh; server rejects expired tokens with `"Upload session has expired"`.
    4. `signUp()` Fails: When Supabase Auth fails (rate limits, weak password, network drop), staged files in `doc_staging` are preserved; client retains ready state for immediate user retry.
    5. Post-Auth Move/Upsert Failure: Step 9 compensation rollback in `signup()` deletes newly created user (`deleteUser` cascading to `users` and `user_documents`), returns `"Registration processing failed. Please try again."`, and leaves staged files intact for retry.
    6. Replacement Rejected: `reject_document_change` RPC updates `document_change_requests` to `status = 'rejected'` with reason; original `user_documents` record remains completely untouched and active; user sees rejection reason on My Documents screen.
    7. Abandoned Signup: Hourly cron (`POST /api/cron/cleanup-staging`) purges session folders older than 24 hours via official Supabase Storage API.
    - Verified: 18/18 checks passed in `apps/web/scripts/test-phase10-failure-handling.mjs` (100%).
  - `Phase 11 (Complete 20-Scenario Test Checklist)`:
    - 20 architectural test scenarios verified: 8 MB compression target (< 10 KB submit POST), *.supabase.co direct upload targets (0 bytes through Vercel), throttled 3G background completion, mid-upload retry idempotency with upsert, double-click submit single execution lock, duplicate email session reuse without re-upload, non-JPEG magic byte rejection (0xFF 0xD8 0xFF), HEIC decode error rejection, < 600 px resolution rejection, HMAC session tampering/expiry rejection, 3.2 storage RLS cross-user boundary, 403 admin route non-privileged block, batched thumbnail URLs in 19 ms with single audit row, 60s signed URL expiration, atomic pointer swap on approve with audit log, rejection reason retention on reject with untouched original document, duplicate pending request 23505 prevention via partial unique index, Step 9 move compensation rollback, friendly 2-minute rate limit duration formatting, and 100% Web vs Native path/size parity.
    - Verified: 37/37 checks passed in `apps/web/scripts/test-phase11-test-checklist.mjs` (100%).
  - `Phase 12 (Comprehensive Architecture Re-Verification & Component Extraction)`:
    - Extracted standalone `DocumentUploadCard.tsx` to `apps/web/components/documents/DocumentUploadCard.tsx` (reusable client component per Monorepo Rule 3).
    - Ran 54-point architecture audit in `scripts/reverify-all-components.mjs` covering buckets (`doc_staging`, `user_files`), RLS policies, tables, stored procedures (`verify_user_document_atomic`, `reject_user_document_atomic`, `approve_document_change`, `reject_document_change`), Next.js routes, client hooks, and code invariants. Verified: 54/54 checks passed (100%).
  - `Phase 13 (Live Natural Registration & Valid/Invalid Scenarios Verification)`:
    - Executed live server tests against Next.js 16.2 production server on `http://localhost:3000` and Supabase Dev (`vlmxciuogczumumrwyot`):
      1. Live Natural Registration Suite (`scripts/test-live-natural-registration.mjs`): 37/37 checks passed (100%). Exercised token generation, direct PUT streaming, staging directory monitoring, finalize route handler, DB state verification, admin thumbnail list (< 500 ms) and full image signed URLs, replacement upload URL, cron cleanup endpoints, and clean fixture deletion.
      2. Valid/Invalid Signup Scenarios Suite (`scripts/test-live-signup-scenarios.mjs`): 29/29 checks passed (100%). Tested valid natural signup, duplicate email rejection, duplicate phone rejection, corrupt magic byte rejection (Range 0-2 check), expired session token rejection (HTTP 403), tampered session token rejection (HTTP 403), missing required documents rejection, double-submit replay idempotency (0 duplicates), post-approval document replacement workflow, duplicate pending request blocking, atomic RPC `approve_document_change` pointer swap, and complete test fixture cleanup.
    - Verified: 100% pass across all test suites; zero mobile or web TypeScript errors (`tsc --noEmit`).
  - `Deliberate Architectural Exclusions (Non-Goals)`:
    - PDF Support / Conversion: Excluded on purpose. User identity and banking uploads are strictly restricted to JPEG photos/scans (`DOC_UPLOAD.mime = "image/jpeg"`). No heavy PDF rasterization or conversion libraries.
    - Image Transformation Services: Excluded on purpose. No server-side Cloudinary/Imgix or Next.js image optimization routes. Compression and 320 px thumbnail generation are handled 100% on the client at pick time.
    - Virus Scanning Services: Excluded on purpose. No third-party scanning hops or ClamAV workers. Defense-in-depth is achieved via strict JPEG magic byte inspection (`0xFF, 0xD8, 0xFF`), private buckets, non-executable storage, and short-lived (60s) signed URLs.
    - OCR (Optical Character Recognition): Excluded on purpose. Users manually enter their registered statutory numbers; HR/Admin reviewers verify typed values side-by-side with document photos in the verification UI.
    - Add these capabilities only when a concrete, proven business need appears.
- **Dashboard Card Height & Width Uniformity (apps/mobile)**:
  - `FEAT-DASHBOARD-UNIFORMITY-01`: Standardized card dimensions and responsive grid reflow across all roles (Admin, Manager, HR, Supervisor, Operator, Super-Admin):
    - `KPIGrid.tsx`: Eliminated odd-card column spanning (`isLastOdd`), ensuring all cards occupy identical single-column slots of equal width on both mobile and tablet/desktop.
    - `KPICard.tsx`: Standardized `minHeight: 104`, `height: '100%'`, `headerRow` `minHeight: 36` to reserve space for 1- or 2-line labels.
    - `StatusCard.tsx`: Standardized `minHeight: 124`, `height: '100%'`, `contentRow` `minHeight: 52`, `description` `minHeight: 32`.
    - `PrimaryAction.tsx`: Standardized `minHeight: 82`, `height: '100%'`, `titleRow` `minHeight: 22`, `description` `minHeight: 34`.
    - Responsive Flexbox Grid: Converted quick action lists to responsive 2-column or 3-column rows on tablet/desktop (`width > 640`), eliminating oversized vertical cards.
    - Operator Dashboard: Standardized shift cards to `minHeight: 210` with balanced metadata, and equipment/worksite cards to `minHeight: 180` with 2-column tablet layout.
    - Skeletons: Synchronized `DashboardSkeleton.tsx` and `OperatorDashboardSkeleton.tsx` with identical heights and grid reflow.
    - Test Suite: **22/22 assertions passed** in `test-dashboard-card-dimensions.mjs`.
    - Central mobile test runner: **40/40 TEST SUITES PASSED (100%)** (`node apps/mobile/test/index.mjs`).
    - Monorepo typecheck: **7/7 packages passed with 0 errors** (`pnpm typecheck`).
- **Pending Approvals System (apps/web & apps/mobile)**:
  - `FEAT-USERS-APPROVALS-01`: Registration, Profile Update, and Account Deletion Approvals (100% Web & Native Parity):
    - Authored & applied migrations `190_user_registration_and_profile_approval_rpcs.sql` and `191_account_deletion_and_registration_rejection_hardening.sql` to Dev Supabase Project (`vlmxciuogczumumrwyot`). Added 10 atomic `SECURITY DEFINER` RPCs:
      - `approve_user_registration_atomic`, `reject_user_registration_atomic`, `bulk_approve_user_registrations_atomic`, `bulk_reject_user_registrations_atomic`
      - `approve_profile_change_request_atomic`, `reject_profile_change_request_atomic`, `bulk_approve_profile_change_requests_atomic`, `bulk_reject_profile_change_requests_atomic`
      - `approve_account_deletion_request_atomic`, `reject_account_deletion_request_atomic`
    - Deduplication: `submitAccountDeletionRequestAction` checks for active pending requests before inserting; `reject_user_registration_atomic` cleans up unapproved auth/user rows to prevent zombie duplicates in Supabase.
    - Performance: Parallelized batch profile approvals/rejections in `apps/web/app/actions/profile.ts` using `Promise.allSettled`.
    - Native mobile `apps/mobile/app/(app)/users.tsx`: Replaced fragile client table updates with atomic RPCs for account deletions; unified visual hierarchy with `KPIGrid` -> `ProfileChangeRequestsSection` -> `PendingApprovalsSection` -> `AccountDeletionRequestsSection` -> `UserFiltersPanel`.
    - Mobile approvals test suite: **27/27 assertions passed** (`test-users-approvals.mjs`).
    - Central mobile test runner: **39/39 TEST SUITES PASSED (100%)** (`node apps/mobile/test/index.mjs`).
    - Monorepo typecheck: **7/7 packages passed with 0 errors** (`pnpm typecheck`).
- **Date-Independent Shift Architecture (Phases 0-6 Rollout)**:
  - `Phase 0`: Read-only audit completed & approved (`PHASE_0_AUDIT_REPORT.md`). Identified root causes ROOT-01 to ROOT-09.
  - `Phase 1`: Design decision & benchmark completed & approved (`PHASE_1_DESIGN_DECISION.md`). Selected Effective-Dated Assignment Ranges with GiST exclusion overlap prevention.
  - `Phase 2`: Additive migration completed & applied (`184_date_independent_operator_shift_assignments.sql`). Backfilled 100% of historical assignments and logs (`PHASE_2_MIGRATION_REPORT.md`).
  - `Phase 3`: Backend RPCs completed & applied (`185_phase3_rpcs_date_independent_assignments.sql`). Added `get_shift_tasks`, `end_assignment_range`, updated `assign_operator_machine_atomic`, updated `submit_operator_hour_log_atomic` (`PHASE_3_RPC_REPORT.md`).
  - `Phase 4`: Web & Native Cutover completed & applied (`186_phase4_date_independent_monitor_and_context.sql`). Web DAL, Server Actions, Native TanStack hooks (`useShiftTasks`), and OfflineQueueManager (7-day window expiration guard) updated and verified (`PHASE_4_CUTOVER_REPORT.md`).
  - `Phase 5`: Contract cleanup & range sync applied (`187_phase5_contract_cleanup_and_range_sync.sql`). Added `chk_oma_valid_range_order`, `trg_sync_oma_valid_range`, cleaned up legacy current-assignment lookups in Web and Native DAL.
  - `Phase 6`: Automated Verification & Release completed (`188_phase6_hardening_date_independent_shift_contract.sql`). All 10 contract business cases verified with 100% pass rate (`PHASE_6_FINAL_TEST_REPORT.md`).
  - `Remediation & Exhaustive Re-Testing`: Migration `189_date_independent_operator_shift_remediation.sql` applied. 38/38 tests PASSED in `supabase/tests/test_complete_shift_independence_and_validation_matrix.mjs` and 36/36 tests PASSED in `supabase/tests/test_exhaustive_date_independent_shifts.mjs` (`EXHAUSTIVE_DATE_INDEPENDENT_SHIFT_VERIFICATION_REPORT.md`). 100% verified resolution for User A historical shift corruption bug, User B unassigned past date bug, 7-day past shift entry window, and all valid/invalid shift entry test cases.
  - `Storage Footprint`: 99.6% leaner storage compared to daily materialized rows (~3.9 MB/yr vs ~930 MB/yr at 5,000 operators).
  - `Parity Status`: 100% status parity verified between Web and Native Mobile across historical and current dates.
- **Web Verification**: 🟢 0 type errors (`pnpm --filter web typecheck`); 21/21 validation tests passed
- **Native Verification**: 🟢 0 type errors (`pnpm --filter mobile typecheck`); 39/39 test suites passed (`node apps/mobile/test/index.mjs`)
- **Implicit State Machine Bug Fixes (apps/web)**:
  - `BUG-01`: Job application status lifecycle transition matrix (`application-transitions.ts`) & concurrency guard (`.eq("status", previous.status).maybeSingle()`).
  - `BUG-02`: Job posting publishing lifecycle transition matrix (`job-transitions.ts`) & atomic status updates in `job-mutations.ts`.
  - `BUG-03`: Profile change request approval/rejection atomic status transition lock (`.eq("status", "pending")`) preventing concurrent mutations.
  - `BUG-04`: Secured `revalidateEquipmentCache` Server Action with `getCurrentUser()` and `ALLOWED_ADMIN_ROLES` role guard.
  - `BUG-05`: `ConfirmationDialog` double-submit re-entrancy lock and automatic loading reset on close/reopen.
  - `BUG-06`: `RfqForm` submission re-entrancy guard with `isSubmittingRef` preventing duplicate RFQ creations.
  - `BUG-07`: `ConflictResolutionModal` state reset on close, cancel, and reopen.
  - `BUG-08`: `completeOnboardingAction` server-side 2MB file size and safe MIME validation (`document-upload-validation.ts`).
  - `BUG-09`: `useInstantSearch` client mode sequence counter (`clientRequestIdRef`) preventing stale out-of-order responses.
  - `BUG-10`: `MachineImportModal` state reset on close/reopen & atomic batch insertion for Excel machines.
  - `BUG-11`: `AssignOperatorToMachineDialog` client shift codes effect re-trigger on asynchronous `clientId` resolution.
  - `BUG-12`: `EnterpriseTable` false-positive `allSelected` fix using `data.every(...)` and indeterminate checkbox state.
  - `BUG-13`: `MachineClientView` browser Back navigation fallback to `overview` tab.
  - `BUG-14`: `PayrollClient` URL searchParams synchronization on Back/Forward navigation.
  - `BUG-15`: `PayrollClient` CSV export blob URL cleanup with `URL.revokeObjectURL(url)`.
  - `BUG-16`: `CommandPalette` query and selection index reset upon reopening.
- **Expo Doctor**: 🟢 19/19 checks passed (0 issues detected)
- **Monorepo Typecheck**: All 7 packages passed with 0 errors (`pnpm typecheck`)
- **Native Verification Suites**: **36/36 TEST SUITES PASSED (100%)** (`node apps/mobile/test/index.mjs`)
- **What's New System Verification**: 57/57 passed (`node apps/mobile/test/test-whats-new-system.mjs`)
- **Authoritative Release Documentation**: `apps/mobile/RELEASE_NOTES_v1.4.0.md`
- **Gradle & AGP Compatibility**:
  - `FIX-EAS-BUILD-06`: Deep Gradle 9.4.1 / AGP 9.2.1 build failure remediation for EAS Build `@vaibhavchauhan_15/reachinternational-monorepo` (`a25ae1cb-ddf5-4618-beb1-aaa2a6f9b7f2`).
    - Stripped `android.enableLegacyVariantApi=true` from `gradle.properties` (fatal error in AGP 9.0+).
    - Stripped obsolete `android.enableR8.fullMode=true`.
    - Maintained `android.newDsl=false` for legacy AGP DSL access required by `expo-modules-core` (`ndkDirectory`).
    - Added `android.disallowKotlinSourceSets=false` to permit source set declarations in `expo-updates` with KSP.
    - Added `android.builtInKotlin=false` to avoid extension collisions in `react-native-webview` and `reach-haptics`.
    - Migrated `packagingOptions` to modern `packaging` DSL in `app/build.gradle`.
    - Guarded `apply plugin: 'kotlin-android'` and modernized `compileSdkVersion` in `reach-haptics/android/build.gradle`.
    - Verified locally via `./gradlew help` and `./gradlew :app:bundleRelease --dry-run` with 100% success.
  - `FIX-EAS-BUILD-05`: In AGP 9.0+, `libraryVariants` was completely removed from `LibraryExtensionImpl` (`com.android.library`). Patched `expo-constants`'s `get-app-config-android.gradle` via `pnpm patch expo-constants` (`patches/expo-constants.patch` in `pnpm-workspace.yaml`). The patch safely falls back to configuring variant config tasks directly on `project.android.buildTypes.all` when `hasLibraryVariants` is false, hooking into lifecycle tasks (`preBuild` / `pre<Variant>Build`) and setting asset directories. Retained `android.enableLegacyVariantApi=true` and `android.newDsl=false` in `apps/mobile/android/gradle.properties` for broader AGP 9 backwards compatibility.
- **Core Bug Fixes Applied**:
  - `FIX-EAS-BUILD-05`: Resolved Gradle build exception `Could not get unknown property 'libraryVariants' for object of type com.android.build.gradle.internal.dsl.LibraryExtensionImpl$AgpDecorated` in `expo-constants/scripts/get-app-config-android.gradle`. Created monorepo pnpm patch `patches/expo-constants.patch` applied automatically during CI/EAS `pnpm install`.
  - `FIX-EAS-BUILD-01`: Upgraded `eas-cli` globally from `27.2.0` to `27.4.1`, resolving outdated CLI banner.
  - `FIX-EAS-BUILD-02`: Removed redundant `"NODE_ENV": "production"` and `"NODE_ENV": "development"` from `apps/mobile/eas.json` `env` blocks. Expo CLI automatically sets production bundling mode, eliminating the EAS builder package pruning warning.
  - `FIX-EAS-BUILD-03`: Removed `android.package` from `apps/mobile/app.json`. In bare workflow with an existing committed `android/` directory, the native package identity is owned authoritatively by `android/app/build.gradle` (`applicationId 'com.reachinternational.app'`). Updated test suite assertion to verify native Gradle applicationId.
  - `FIX-EAS-BUILD-04`: Removed static `android.versionCode` from `apps/mobile/app.json`. Since `eas.json` utilizes `appVersionSource: "remote"` with `autoIncrement: true`, EAS automatically tracks and increments the authoritative build number remotely on Expo servers without manifest divergence warnings.
  - `BUG-SHIFT-01`: Standardized premature shift end error string across layers to `"Cannot log before shift end."` (`packages/utils/src/date.ts:677`).
  - `BUG-SHIFT-02`: Unified validation parity between Web and Mobile by extending `CreateHourLogSchema` with `shift_code`, `operator_id`, `client_id`, and breakdown bounds refinement (`packages/validation/src/hourMeter.ts`). Wired schema safeParse into `MobileOperatorEntryCard.tsx` and `MeterLogModal.tsx`. Authored `hourMeter.test.ts`.
  - `BUG-SHIFT-03`: Modernized operations security RLS assertions for strict log immutability (`test_operations_security_rls_regression.mjs`).
  - `BUG-SHIFT-04`: Dynamic test machine resolution and overlap conflict detection verification (`test_prevent_cross_machine_shift_overlap.mjs`).
  - `BUG-SHIFT-05`: Exclusion constraint `osr_machine_shift_no_overlap` (`23P01`) collision resolution in test matrix fixtures (`test_exhaustive_shift_entry_matrix.mjs`).
  - `BUG-SHIFT-06`: Resolved operator unassigned shift submission error (`23514`) in `MobileOperatorEntryCard.tsx`. Fixed shift resolution to prioritize assigned shifts (`resolvedInitialShift` / `assignedShiftCodes`), prevented unassigned draft overwrites, added client-side pre-submission validation guard, added 1-tap "Switch to Assigned Shift" button in the warning banner, and suppressed harmless React Native runtime notices (`ImageBackground is deprecated` and `VirtualizedList`).
  - `BUG-MACHINES-01`: Removed redundant Edit and Delete buttons from the hero card in `MachineDetailView.tsx` (fully covered by the header 3-dots more menu: Edit Info, Manage Personnel, Edit Client, Delete Machine).
  - `BUG-MACHINES-02`: Fixed flex layout collapse and component overlap in `Assigned Shift Personnel` card (`MachineDetailView.tsx`). Removed unconditional `{ flex: 1 }` on column children in mobile view, added `width: '100%'` and `flexShrink: 0`, ensuring `Operators` panel with `EmptyState` ("No Operators Assigned") expands to full height and is cleanly contained inside the card without overlapping `Client Details`.
  - `BUG-MACHINES-03`: Replaced large solid blue client code pill with a compact, light-grey pill badge with copy icon (`Copy size={10}`) and 1-tap copy functionality (`handleCopy`).
  - `BUG-MACHINES-04`: Mobile layout optimization across all machine cards (Basic Info specs grid, Shift Personnel, Client Details) adhering to Geist design tokens and 44px min touch targets.
  - `BUG-MACHINES-05`: Fixed "Edit Assigned Shift Personnel" modal opening and layout collapse on machine details page (`MachineDetailView.tsx`, `MobileAssignPersonnelModal.tsx`, `Sheet.tsx`, `AssignmentBottomSheet.tsx`):
    - Replaced outdated `AssignOperatorToMachineModal` with canonical `MobileAssignPersonnelModal` in `MachineDetailView.tsx`, bound to `initialMachineId={machine.id}`.
    - Resolved root-cause height collapse: set explicit `height: '88%', maxHeight: '92%'` in modal panel styles, enabling flex: 1 scroll containers to expand and scroll smoothly.
    - Added `minHeight: 220` anti-collapse safety guard in `Sheet.tsx` `styles.sheetPanel`.
    - Tuned silky-smooth native spring entrance curve (`stiffness: 340, damping: 32, mass: 0.9`), timing exit with cubic-bezier easing (`duration: 220, Easing.bezier(0.3, 0, 0.8, 0.15)`), and synchronized Scrim backdrop fade (260ms in / 220ms out).
    - Fixed operator query lazy loading in `AssignOperatorToMachineModal.tsx` by passing active `isAddOperatorOpen` and `relevantOperatorIds`.
  - `FEAT-ASSIGN-MODAL-MOBILE-OPT`: Fully optimized "Assign Machine Operator" modal for native mobile screens (`MobileAssignPersonnelModal.tsx` & `ShiftCardSelector.tsx`):
    - Completely removed inherited client-level supervisor banner and inherited override placeholder.
    - Simplified shift buttons to clean, short titles (`Shift A`, `Shift B`, `Shift C`) with parenthesized qualifiers completely stripped.
    - Optimized shift times to compact mobile format (`6AM-2PM`, `2PM-10PM`, `10PM-6AM`).
    - Enforced single-row flex layout (`flex: 1`, `minWidth: 0`) for shift buttons, preventing wrapping across all device viewports.
    - Implemented 60fps Reanimated animated collapsibles (`DropdownCollapsible`) with height, opacity, and glide interpolation for smooth dropdown opening and closing.
    - Implemented smooth 180-degree rotating chevrons (`AnimatedChevron`) for all dropdown triggers.
    - Enhanced bottom sheet opening and closing spring curve (`Sheet.tsx`) for fluid, native dismissal.
    - Elevated touch ergonomics to 46px min target height across all trigger and action buttons with safe area bottom inset padding.
  - `BUG-ATTENDANCE-01`: Attendance KPI Cards Mobile & Tablet Optimization & Style Property Separation:
    - Root-cause resolution of React DOM warning `Removing a style property during rerender (flex) when a conflicting property is set (flexShrink)`:
      - In `MachineDetailView.tsx` (lines 1797, 1917), replaced shorthand `flex: isMobile ? undefined : 1` mixed with `flexShrink: 0` with separated `flexGrow: isMobile ? 0 : 1`, `flexShrink: 0`, `flexBasis: isMobile ? 'auto' : 0`.
      - In `KPICard.tsx`, replaced `touchWrapper` shorthand `flex: 1` and `height: '100%'` with separated non-shorthand `flexGrow: 1, flexShrink: 0, flexBasis: 'auto'` and `minHeight: 84`, preventing height/width collapse in web/mobile containers.
    - Optimized Attendance KPI strip for Mobile and Tablet:
      - Replaced fragile horizontal `ScrollView` with fixed 140px cards with canonical `<KPIGrid columns={4}>`.
      - Mobile (`width <= 640px`): Renders 2x2 responsive grid (50% card width), eliminating horizontal scrolling and keeping all 4 cards above the fold.
      - Tablet (`641px - 1023px`): Renders 4 columns in 1 single row (25% each), spanning full tablet width evenly.
      - Desktop (`>= 1024px`): Renders 4 columns in 1 single row (25% each).
      - Synchronized `AttendanceSkeleton.tsx` (`AttendanceKpiStripSkeleton`) with `KPIGrid columns={4}` for 100% skeleton layout parity (0 layout shift).
      - Added automated test suite `test-attendance-kpi-optimization.mjs` verifying all 8 invariants (38/38 mobile suites passing).
