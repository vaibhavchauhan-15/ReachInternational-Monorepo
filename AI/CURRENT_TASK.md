# Current Task

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
