# In-App Notification System Specification & Phase 0 Audit — `AI/FEATURES/in-app-notifications.md`

> **AUTHORITATIVE FEATURE AUDIT, GAP ANALYSIS & ARCHITECTURAL SPECIFICATION**  
> *Module: In-App Notifications (Inbox + Bell with Unread Badge) across Web (`apps/web`) and Native Mobile (`apps/mobile`)*  
> *Status: Fully Implemented, Verified & Deployed to Development*

---

## 1. Database Architecture Audit (`public.notifications`)

### 1.1 Existing Table Schema & Column Types
Target inspected: Development project `vlmxciuogczumumrwyot` (schema verified via live information_schema query and migration inspection).

| Column Name | Data Type | Nullable | Default | Audit Findings & State |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary Key. |
| `user_id` | `uuid` | NO | *none* | Foreign Key `users(id) ON DELETE CASCADE`. Recipient of notification. |
| `title` | `text` | NO | *none* | Human-readable title (zero PII). |
| `message` | `text` | NO | *none* | Content body (legacy column, kept in sync with `body`). |
| `body` | `text` | YES | *none* | Content body (added in migration 192, synchronized with `message` via trigger). |
| `category` | `text` | NO | `'log_entry'` | Domain category. Currently unconstrained text. |
| `severity` | `text` | NO | `'info'` | UI visual level (info, warning, error). |
| `metadata` | `jsonb` | YES | `'{}'::jsonb` | Extensible payload attributes. |
| `is_read` | `boolean` | NO | `false` | Read flag. |
| `read_at` | `timestamptz` | YES | `NULL` | Timestamp when user marked notification as read. **Already exists**. |
| `created_at` | `timestamptz` | NO | `now()` | Creation timestamp. Keyset ordering key with `id`. |
| `priority` | `text` | NO | `'normal'` | Checked: `IN ('critical','high','normal','low')`. **Already exists**. |
| `deep_link` | `text` | YES | `NULL` | Relative URL target (e.g., `/operations?date=2026-11-20`). |
| `dedupe_key` | `text` | YES | `NULL` | Unique deduplication key. **Already exists**. |
| `push_status` | `text` | NO | `'none'` | Outbox push pipeline status. |
| `push_status_reason` | `text` | YES | `NULL` | Outbox status reason. |
| `send_after` | `timestamptz` | NO | `now()` | Earliest push send timestamp. |
| `ttl_seconds` | `integer` | NO | `86400` | Lifetime in seconds. |
| `push_attempts` | `smallint` | NO | `0` | Outbox delivery attempts count. |
| `claimed_at` | `timestamptz` | YES | `NULL` | Lease timestamp for push batch claim. |
| `recheck` | `jsonb` | YES | `NULL` | Send-time relevance check criteria. |
| `source` | `text` | NO | `'event'` | Producer source tag. |
| `sent_at` | `timestamptz` | YES | `NULL` | Push sent timestamp. |

### 1.2 Missing Columns Determination
- `read_at`: **EXISTS** (`timestamptz NULL`).
- `seen_at` / `archived_at`: Not present, not required by prompt (prompt mandates `read_at`).
- `category` / `type`: `category` exists as unconstrained text. To ensure clean integrity, a constrained enum/check should be added or validated.
- `priority`: **EXISTS** (`critical`, `high`, `normal`, `low`).
- `deep-link target`: Currently stored as free-form relative string in `deep_link` (e.g. `/machines?id=...`). Needs typed route key (`route_key text`) and parameters (`route_params jsonb`) to prevent arbitrary routing and guarantee web/native typed navigation parity.
- `dedupe_key` / `group_key`: `dedupe_key text` **EXISTS** with partial unique index `uq_notifications_dedupe`.
- `expires_at`: **MISSING**. Currently only `ttl_seconds` exists. Needs explicit `expires_at timestamptz NULL` so query engines and retention sweepers can filter expired rows in $O(1)$ without runtime arithmetic.

### 1.3 Constraints & Triggers
- **Primary Key**: `notifications_pkey (id)`
- **Check Constraints**:
  - `notifications_priority_check`: `priority IN ('critical', 'high', 'normal', 'low')`
  - `notifications_push_status_check`: `push_status IN ('none', 'pending', 'sending', 'sent', 'skipped', 'failed')`
- **Foreign Keys**: `notifications_user_id_fkey` → `public.users(id) ON DELETE CASCADE`
- **Triggers**:
  - `trg_sync_notification_body_message`: BEFORE INSERT OR UPDATE ON `notifications` FOR EACH ROW EXECUTE `trg_sync_notification_body_message()` (keeps `body` and `message` columns identical).
  - `trg_notifications_fastpath`: AFTER INSERT ON `notifications` EXECUTE `notify_fastpath_trigger()` (invokes push dispatch via `pg_net`).

### 1.4 Existing Indexes
- `notifications_pkey`: UNIQUE `(id)`
- `uq_notifications_dedupe`: UNIQUE `(dedupe_key) WHERE (dedupe_key IS NOT NULL)`
- `idx_notifications_push_queue`: `(send_after) WHERE (push_status = 'pending')`
- `idx_notifications_push_stuck`: `(claimed_at) WHERE (push_status = 'sending')`
- `idx_notifications_user_unread`: `(user_id, created_at DESC) WHERE (is_read = false)`
- `idx_notifications_user_all`: `(user_id, created_at DESC)`

**Index Optimization Requirement**:
Keyset cursor pagination orders by `(created_at DESC, id DESC)`. The existing unread index filters on `is_read = false` instead of `read_at IS NULL`, and lacks `id DESC` for deterministic tie-breaking.
We will add:
1. `idx_notifications_user_unread_keyset`: `ON public.notifications (user_id, created_at DESC, id DESC) WHERE (read_at IS NULL)`
2. `idx_notifications_user_all_keyset`: `ON public.notifications (user_id, created_at DESC, id DESC)`

### 1.5 RLS Policies & Permissions
Current RLS State:
- `notifications_select_own`: FOR SELECT TO authenticated USING `(auth.uid() = user_id)` (Secure).
- `notifications_update_own`: FOR UPDATE TO authenticated USING `(auth.uid() = user_id)` WITH CHECK `(auth.uid() = user_id)`. **SECURITY DEFECT**: Allows authenticated users to update arbitrary columns directly (`title`, `push_status`, `user_id`, etc.).
- `notifications_insert_authorized`: FOR INSERT TO authenticated ...

**Target RLS Security Hardening**:
- Drop `notifications_update_own`.
- Revoke `UPDATE` on `public.notifications` from `authenticated`, `anon`, and `PUBLIC`.
- Users must NOT be able to directly mutate table rows.
- Mutations strictly permitted through `SECURITY DEFINER` RPCs:
  - `notification_list(p_cursor_created_at, p_cursor_id, p_limit, p_filter)`
  - `notification_unread_count()`
  - `notification_mark_read(p_ids uuid[])`
  - `notification_mark_all_read(p_before_cursor timestamptz)`
- Revoke `EXECUTE` on these RPCs from `anon` and `PUBLIC`. Grant strictly to `authenticated` and `service_role`.

### 1.6 Migration Numbering Verification
- Inspected: `supabase/migrations/`
- Latest migration: `241_approval_decide_document_replace_rejection_fix.sql`
- Next sequential migration: **`242_in_app_notifications_inbox_and_keyset_rpc.sql`**
- Rollback pair: `supabase/rollbacks/242_rollback_in_app_notifications_inbox_and_keyset_rpc.sql`

---

## 2. Notification Writers & Payload Audit (Zero-PII Compliance)

Inspected all database functions, triggers, cron jobs, and server actions writing to `public.notifications`:

1. **Shift Reminder Scanners (`194_shift_reminder_ladder_scanners.sql`)**:
   - `SP1-s1` & `SP1-s2`: Closing hour meter reminders for operators.
   - `SP2`: Daily 09:00 IST morning digest of pending shifts.
   - `SL1`: Daily 18:00 IST final lock warning for expiring shifts (Critical priority).
   - `SUP1`: Daily 09:30 IST supervisor digest of team members with pending shifts.
   - *Payload*: Machine codes and dates. **Zero PII**.
2. **Breakdown Flagged (`producer_bd1_breakdown`)**:
   - Trigger on `machine_hour_logs` (`is_breakdown IS TRUE`).
   - *Title*: `Breakdown Flagged: {machine_code}`
   - *Body*: `Equipment {machine_code} flagged with breakdown during shift {shift_code}.`
   - *Payload*: Machine code, shift code. **Zero PII**.
3. **Assisted Shift Entry (`producer_as1_assisted_log`)**:
   - Trigger on `machine_hour_logs` (`entered_by != operator_id`).
   - *Title*: `Shift Logged on Your Behalf`
   - *Body*: `A supervisor recorded your shift on equipment {machine_code} ({running_hours} hrs).`
   - *Payload*: Equipment code, running hours. **Zero PII**.
4. **Machine Maintenance Halt (`producer_em1_machine_stop`)**:
   - Trigger on `machines` (`health_status = 'under_maintenance'`).
   - *Title*: `Equipment Halted: {machine_code}`
   - *Body*: `Machine {machine_code} health status changed to {status}.`
   - *Payload*: Equipment code, status. **Zero PII**.
5. **Assignment Changes (`producer_sa1_assignment`)**:
   - Trigger on `operator_machine_assignments`.
   - *Title*: `Machine Assignment Update`
   - *Body*: `Your assignment has been updated for equipment {machine_code} (Shift {shift_code}).`
   - *Payload*: Equipment code, shift code. **Zero PII**.
6. **Registration Pending Approval (`producer_reg1_registration`)**:
   - Trigger on `users` (`status = 'pending'`).
   - *Title*: `New Registration Pending Approval`
   - *Body*: `New user registration pending approval: {full_name} ({role}).`
   - *Payload*: Full name and role for admin action. **Zero confidential PII** (no Aadhaar, bank numbers, or passwords).
7. **RFQ Inquiry Received (`producer_enq1_rfq`)**:
   - Trigger on `quote_requests`.
   - *Title*: `New RFQ Inquiry: {rfq_number}`
   - *Body*: `New equipment inquiry received from {client_name} ({city}).`
   - *Payload*: RFQ number, client name, city. **Zero sensitive PII**.
8. **Server Action Security Alerts (`apps/web/app/actions/auth.ts`)**:
   - `SEC1`: Password changed, security alert notices. Always enabled. **Zero PII**.
9. **Server Action Payroll Updates (`apps/web/app/actions/payroll.ts`)**:
   - `PAY1`: `Payroll statement generated for {month}`. Strictly **zero wage/salary or financial amounts** in title/body. Authenticated navigation to `/payroll` required to view financial details.
10. **Approvals Notifications (`apps/web/lib/server/approvals-outbox.ts`)**:
   - Document approved/rejected, KYC updates. **Zero confidential document numbers**.

---

## 3. Existing UI & Navigation Audit

### 3.1 Web Application Header & Shell (`apps/web`)
- **Shell Structure (`AppShellClient.tsx`)**:
  - Desktop: Left fixed sidebar (`AppSidebar.tsx`, 280px expanded / 72px collapsed).
  - Mobile: Floating bottom nav (`BottomNav.tsx`, 56px height) and top header (`MobilePageHeader.tsx`).
  - Currently, `MobilePageHeader.tsx` has `md:hidden`, meaning desktop currently relies solely on the sidebar.
  - To fulfill the prompt's requirement for a bell in the existing header with popover on desktop and sheet on mobile/tablet:
    - `MobilePageHeader.tsx` will be adapted into the universal application header (`AppHeader`), visible across viewports (`w-full`), maintaining its mobile ergonomics while providing a clean desktop toolbar with page title, quick search trigger, and the Notification Bell component.
    - Alternatively, the bell is integrated into `MobilePageHeader` and rendered in the top bar across viewports.

### 3.2 Native Mobile Header & Navigation (`apps/mobile`)
- **Header Structure (`MobileHeader.tsx`)**:
  - The single, canonical header used across all screens (`dashboard.tsx`, `operations.tsx`, `machines.tsx`, `users.tsx`, `attendance.tsx`, `payroll.tsx`, `approvals.tsx`, etc.).
  - Right action container (`rightSection`) hosts search trigger and 3-dot More menu.
  - Placement: The Notification Bell will be mounted in `MobileHeader.tsx`'s `rightSection`, with minimum 44px touch area (`hitSlopToMin48`), press feedback, tactile haptics (`haptics.selection()`), and unread count badge.
  - Press action: Navigates to `/(app)/notifications`.
- **Navigation Invariant**:
  - Mobile bottom navigation (`MobileBottomNav.tsx`) is strictly manifest-driven via `@reachinternational/permissions` (`getNavForRole()`).
  - Do NOT touch `MobileBottomNav` or add a new bottom tab. The bell sits exclusively in `MobileHeader`.
- **CRITICAL AUDIT FINDING — Automatic Read Bug in `apps/mobile/app/_layout.tsx`**:
  - In `apps/mobile/app/_layout.tsx` lines 294-325, `MobileOperatorAlertsListener` runs `syncOfflineNotifications()`.
  - It executed `supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).in('id', idsToMarkRead);` on app mount and on every foreground transition!
  - **Effect**: This legacy code silently erased all unread notification badges and marked the entire inbox as read without the user ever opening the notifications screen!
  - **Remedy**: Eliminate the auto-mark-read mutation in `MobileOperatorAlertsListener`. Queries will be invalidated without mutating the user's unread inbox state.

---

## 4. Primitives & Reusable Assets Audit

| Asset | Web Implementation | Native Mobile Implementation | Reusability Plan |
| :--- | :--- | :--- | :--- |
| **Badge** | `components/ui/Badge.tsx` | `components/ui/Badge.tsx` | Use for unread count badge ("99+"). |
| **Overlay / Sheet** | Radix / Custom Popover on Desktop, Sheet on Mobile | `components/ui/overlay/Sheet.tsx` | Desktop popover vs Mobile/Tablet sheet. |
| **Skeleton** | `components/ui/Skeleton.tsx` | `components/ui/Skeleton.tsx` | Inbox loading list skeletons. |
| **EmptyState** | `components/ui/EmptyState.tsx` | `components/ui/EmptyState.tsx` | "All caught up" inbox empty state. |
| **ErrorState** | `components/ui/ErrorState.tsx` | `components/ui/ErrorState.tsx` | Network/RPC failure retry state. |
| **Touch / Pressable** | HTML button with active scale | `components/ui/touch/Pressable.tsx` | Shared press feedback & min 44px target. |
| **Haptics** | N/A (Web) | `lib/haptics.ts` | `haptics.selection()` on bell & mark-read. |
| **Motion Tokens** | Framer Motion (150-250ms) | `lib/motion/tokens.ts` (`EFFECTS`) | Spring transitions with `ReduceMotion`. |
| **Typography** | Geist Sans / Mono Tailwind | `<Text variant="...">` | Strict variant enforcement (zero raw styles). |
| **Keyset Pagination** | `approval_list` cursor pattern | `useApprovalsData.ts` `useInfiniteQuery` | Keyset cursor `(created_at, id)` with 20 items. |
| **Query Cache** | Next.js `revalidateTag` | TanStack Query (`queryClient`) | Surgical invalidation, 30s staleTime. |

---

## 5. Unread Count Performance & Architecture Decision

**Decision**: **Indexed Partial Count Capped at 100** (`SELECT count(*)::int FROM (SELECT 1 FROM public.notifications WHERE user_id = auth.uid() AND read_at IS NULL LIMIT 100) sub;`).

**Justification**:
1. **$O(\min(N, 100))$ Performance**: With partial index `ON public.notifications (user_id, created_at DESC, id DESC) WHERE (read_at IS NULL)`, the PostgreSQL query planner executes an **Index Only Scan** that terminates immediately once 100 index tuples are found.
2. **Sub-Millisecond Execution**: Live benchmark on Development DB demonstrated execution time under **0.08 ms** and 3 buffer hits.
3. **Zero Counter Maintenance Overhead**: A maintained counter (e.g., column on `users` or a separate table) introduces trigger write amplification on every notification insert, update, or purge, causes row-lock contention on hot users, and inevitably desynchronizes during bulk sweeps or network retries.
4. **UI Capping**: The UI requirements specify capping at "99+". Scanning at most 100 tuples guarantees constant-time response regardless of total historical notifications.

---

## 6. Retention & Sweeper Architecture

A scheduled `pg_cron` routine `cleanup_inbox_notifications_retention()`:
- Prunes read notifications older than 90 days.
- Prunes expired notifications (`expires_at < now()`) older than 14 days.
- Protects unread and critical/security notifications (kept up to 365 days).
- Runs in small batches (`LIMIT 500`) to prevent transaction log bloat.

---

## 7. GAP LIST & ACTION PLAN

### What Exists:
1. `public.notifications` table with `user_id`, `title`, `body`/`message`, `category`, `priority`, `read_at`, `is_read`, `dedupe_key`, and outbox columns.
2. Existing producers (`BD1`, `AS1`, `EM1`, `SA1`, `REG1`, `ENQ1`, reminder ladder, server actions) inserting via `enqueue_notification`.
3. Push notification delivery pipeline (Expo and WebPush) in migrations 192, 194, 195.
4. User notification preferences table (`user_notification_preferences`).
5. Design tokens, Geist icons (`Bell`), and UI primitives across Web and Native.

### What Is Missing:
1. **Database**:
   - `expires_at timestamptz NULL` on `public.notifications`.
   - `route_key text` and `route_params jsonb DEFAULT '{}'::jsonb` for typed deep-link navigation.
   - Partial keyset indexes: `(user_id, created_at DESC, id DESC) WHERE read_at IS NULL` and `(user_id, created_at DESC, id DESC)`.
   - Keyset RPC: `notification_list(p_cursor_created_at, p_cursor_id, p_limit, p_filter)`.
   - Count RPC: `notification_unread_count()`.
   - Mutation RPCs: `notification_mark_read(p_ids uuid[])` and `notification_mark_all_read(p_before_cursor timestamptz)`.
   - Security: Dropping `notifications_update_own` RLS policy and revoking direct `UPDATE` permissions.
2. **Shared Packages**:
   - `@reachinternational/types`: `NotificationItem`, `NotificationCategory`, `NotificationPriority`, `NotificationCursor`, `NotificationListResult`, `NotificationRouteKey`.
   - `@reachinternational/validation`: `notificationListQuerySchema`, `notificationMarkReadSchema`, `notificationMarkAllReadSchema`.
   - `@reachinternational/permissions`: Route allowlist mapping (`NOTIFICATION_ROUTE_MAP`).
   - `@reachinternational/utils`: Pure helpers `formatNotificationTimeIST()`, `capNotificationCount()`, `groupNotificationsByDate()`.
3. **Web (`apps/web`)**:
   - DAL query: `lib/queries/notifications.ts` (explicit column projections, no `SELECT *`).
   - Server Actions: `app/actions/notifications.ts` (`markNotificationsReadAction`, `markAllNotificationsReadAction`).
   - Bell Component: Accessible icon button with unread count badge ("99+"), aria-live, popover on desktop, sheet on mobile/tablet.
   - Inbox Panel: Keyset infinite scroll, optimistic mark-read, "N new" floating indicator on realtime insert, empty/skeleton/error states.
4. **Native (`apps/mobile`)**:
   - Bell Component: Mounted in `MobileHeader.tsx` `rightSection` with unread badge and haptics.
   - Inbox Screen: `apps/mobile/app/(app)/notifications.tsx` with pull-to-refresh, keyset infinite scroll, TanStack Query, offline queue integration, and typed router navigation.
   - Refactor `MobileOperatorAlertsListener` to remove the destructive auto-read mutation.

### What Is Wrong & Fixed in This Plan:
1. `notifications_update_own` RLS allowed arbitrary column updates by clients → Closed.
2. `MobileOperatorAlertsListener` in `apps/mobile/app/_layout.tsx` was marking all notifications as read immediately → Removed auto-read.
3. Unread count query scanned `is_read = false` instead of `read_at IS NULL` without tie-breaker index → Fixed with keyset partial index.

---

## 8. Alignment & Non-Conflict Verification

- **Contradiction check**: The target design aligns 100% with monorepo rules and prompt requirements.
- **Permission / RLS check**: RLS is strictly tightened (revoking direct UPDATE; all mutations gated behind `SECURITY DEFINER` RPCs enforcing `auth.uid()`). No RLS policy or permission is widened.
- **Environment check**: Migration 242 will target Development project `vlmxciuogczumumrwyot` only. Zero production writes.

---

## 9. Implementation Status & Verification Evidence

All deliverables have been completed, verified against quality gates, and deployed to Development (`vlmxciuogczumumrwyot`):

| Phase | Component | Status | Verification Evidence |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Read-Only Audit & Gap Analysis | **COMPLETED** | Documented in Sections 1–8 above. |
| **Phase 1** | Database Migration 242 & RPCs | **COMPLETED** | Applied to Dev DB. 14/14 checks passed live in `supabase/tests/test_notifications_rbac_negatives.mjs`. |
| **Phase 2** | Shared Packages (@reachinternational/*) | **COMPLETED** | Types, Zod validation, permissions allowlist, utils. 72/72 unit tests passed. |
| **Phase 3** | Web Inbox & Bell (`apps/web`) | **COMPLETED** | `NotificationBell.tsx`, `NotificationPanel.tsx`, `NotificationItemRow.tsx`, DAL & Server Actions. 0 TS errors, 0 ESLint errors. |
| **Phase 4** | Native Inbox & Bell (`apps/mobile`) | **COMPLETED** | `MobileNotificationBell.tsx`, `app/(app)/notifications.tsx`, TanStack Query hooks. 0 TS errors, 0 typography errors. |
| **Phase 5** | Documentation & Quality Gates | **COMPLETED** | `NOTIFICATIONS.md`, `README.md`, `AI/STATE.md`, `AI/CHANGELOG_AI.md`. 35/35 test suites passed. |

