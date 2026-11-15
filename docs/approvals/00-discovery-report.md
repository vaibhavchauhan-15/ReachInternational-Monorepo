# Phase 0 Discovery Report: Unified Approval & Verification Engine

**Document:** `docs/approvals/00-discovery-report.md`  
**Date:** 2026-11-15  
**Target Environment:** Supabase Dev Project `vlmxciuogczumumrwyot` (Reach International Dev)  
**Execution Mode:** READ-ONLY Discovery (Zero implementation code changes)  
**Monorepo Health Baseline:** 
- Monorepo Test Suites: 🟢 **21/21 Passed (100%)** (`node scripts/run-all-tests.mjs`)
- Native Mobile Suites: 🟢 **42/42 Passed (100%)** (`node apps/mobile/test/index.mjs`)
- Mobile Approvals Suite: 🟢 **27/27 Passed (100%)** (`node apps/mobile/test/test-users-approvals.mjs`)
- TypeScript Strictness: 🟢 **0 Errors across 7 packages** (`pnpm typecheck`)

---

## 2.1 Inventory of Every Existing Approval-Like Flow

Below is the complete inventory of all approval, review, verification, and status-transition workflows discovered across the monorepo:

| # | Flow | Tables / Columns | Status Values | Who Requests | Who Approves | Server Action / RPC | Web UI | Native UI | Notifications | Audit Event | Known Bugs / Gaps |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **1** | **New User Registration Approval** | `public.users.status`<br>`auth.users.email_confirmed_at` | `'pending'`<br>`'active'`<br>`'rejected'`<br>`'inactive'` | Public self-registration (`/signup`, `app/(auth)/signup.tsx`) or Admin user creation | `super_admin`<br>`admin`<br>`manager`<br>`hr` | **RPCs:**<br>`approve_user_registration_atomic`<br>`reject_user_registration_atomic`<br>`bulk_approve_user_registrations_atomic`<br>`bulk_reject_user_registrations_atomic`<br>**Action:** `approveUser` / `rejectUser` (`apps/web/app/actions/users.ts:120, 201`) | `apps/web/app/(app)/users/PendingApprovalsSection.tsx`<br>`apps/web/app/(app)/users/UsersClient.tsx:1385` | `apps/mobile/components/users/PendingApprovalsSection.tsx`<br>`apps/mobile/app/(app)/users.tsx:1520` | `REG1` push alert to approvers on submission; none currently to user on approval/rejection | `user.approved`<br>`user.rejected`<br>`users.bulk_approved`<br>`users.bulk_rejected` (`packages/types/src/audit.ts:25-26`) | Status is on the domain table (`users`). No dedicated request row. Rejection hard-deletes unapproved users to avoid zombie auth duplicates. |
| **2** | **Profile Sensitive-Info Change Request** | `public.profile_change_requests`<br>`current_data` (JSONB)<br>`requested_data` (JSONB)<br>`status`<br>`target_approver_role`<br>`reviewed_by`<br>`reviewed_at`<br>`rejection_reason` | `'pending'`<br>`'approved'`<br>`'rejected'`<br>`'cancelled'` | `operator`<br>`supervisor`<br>`manager`<br>`hr`<br>`admin` | `super_admin`<br>`admin`<br>`manager`<br>`hr` (hierarchy enforced) | **RPCs:**<br>`approve_profile_change_request_atomic`<br>`reject_profile_change_request_atomic`<br>`bulk_approve_profile_change_requests_atomic`<br>`bulk_reject_profile_change_requests_atomic`<br>**Action:** `approveProfileChangeRequest`<br>`rejectProfileChangeRequest` (`apps/web/app/actions/profile.ts:600, 777`) | `apps/web/app/(app)/users/ProfileChangeRequestsSection.tsx`<br>`apps/web/app/(app)/users/UsersClient.tsx:1369`<br>`apps/web/components/profile/ProfilePendingBanner.tsx` | `apps/mobile/components/users/ProfileChangeRequestsSection.tsx`<br>`apps/mobile/app/(app)/users.tsx:1508`<br>`apps/mobile/components/profile/EditProfileModal.tsx` | None automated via push outbox upon submission or decision | `user.profile_change_approved`<br>`user.profile_change_rejected` (`packages/types/src/audit.ts:30-31`) | Separate table with hardcoded column updates. If user submits account deletion from mobile, it dumps into this table with `requested_data.type = 'account_deletion'`. |
| **3** | **Account Deletion Request** | `public.account_deletion_requests`<br>`status`<br>`reason`<br>`admin_notes`<br>`reviewed_by`<br>`reviewed_at`<br>*(fallback to `profile_change_requests`)* | `'pending'`<br>`'approved'`<br>`'rejected'`<br>`'cancelled'` | Any authenticated user (`/delete-account`, `apps/mobile/app/(app)/account-deletion/index.tsx`) | `super_admin`<br>`admin`<br>`manager`<br>`hr` | **RPCs:**<br>`approve_account_deletion_request_atomic`<br>`reject_account_deletion_request_atomic`<br>**Action:** `approveAccountDeletionRequestAction`<br>`rejectAccountDeletionRequestAction` (`apps/web/app/actions/account-deletion.ts:317, 453`) | `apps/web/app/(app)/users/AccountDeletionRequestsSection.tsx`<br>`apps/web/app/(app)/users/UsersClient.tsx:1361` | `apps/mobile/components/users/AccountDeletionRequestsSection.tsx`<br>`apps/mobile/app/(app)/users.tsx:1539` | None automated via push | `user.account_deletion_approved`<br>`user.account_deletion_rejected` (`apps/web/app/actions/account-deletion.ts:404, 492`) | Dual-path fallback duct-tape: if table insert fails, writes into `profile_change_requests` (`apps/web/app/actions/account-deletion.ts:113-138`). |
| **4A** | **User Document Initial Verification** | `public.user_documents`<br>`verification_status`<br>`verified_by`<br>`verified_at`<br>`rejection_reason` | `'pending'`<br>`'verified'`<br>`'rejected'` | Operator/User on signup or document upload | `super_admin`<br>`admin`<br>`hr` | **RPCs:**<br>`verify_user_document_atomic`<br>`reject_user_document_atomic`<br>**Action:** `verifyUserDocumentAction`<br>`rejectUserDocumentAction` (`apps/web/app/actions/documents.ts:567, 598`) | `apps/web/app/(app)/users/[id]/UserDetailClient.tsx:842-890` | `apps/mobile/components/users/UserDetailView.tsx:750-810` | None automated | `document.verified`<br>`document.rejected` (`supabase/migrations/197_document_verification_and_approval_rpcs.sql:260, 334`) | Status stored directly on `user_documents`. Privileged reviewers must inspect user-by-user; no batch inbox for document verifications. |
| **4B** | **Document Replacement Approval** | `public.document_change_requests`<br>`staging_path`<br>`staging_thumb_path`<br>`status`<br>`reviewed_by`<br>`reviewed_at`<br>`rejection_reason` | `'pending'`<br>`'approved'`<br>`'rejected'`<br>`'cancelled'` | User requesting image replacement (`/profile/documents`, `app/(app)/profile/documents.tsx`) | `super_admin`<br>`admin`<br>`hr` | **RPCs:**<br>`approve_document_change`<br>`reject_document_change`<br>**Action:** `approveDocumentReplacementAction`<br>`rejectDocumentReplacementAction` (`apps/web/app/actions/documents.ts:632, 662`) | `apps/web/app/(app)/users/[id]/UserDetailClient.tsx:810-840`<br>`apps/web/components/documents/MyDocumentsSection.tsx` | `apps/mobile/components/users/UserDetailView.tsx:710-745`<br>`apps/mobile/app/(app)/profile/documents.tsx` | None automated via push | `document.replacement_approved`<br>`document.replacement_rejected` (`supabase/migrations/197_document_verification_and_approval_rpcs.sql:109, 188`) | Separate table `document_change_requests`. Admin cannot see pending replacement requests on the main `/users` table; must open user profile. |
| **5** | **Shift Log Conflict Resolution** | `public.machine_hour_logs`<br>`conflict_status`<br>`remarks`<br>`is_assisted` | `NULL`<br>`'pending'`<br>`'acknowledged'`<br>`'adjusted'` | Machine Operator (submitting overlapping or irregular shift hours) | `super_admin`<br>`admin`<br>`manager`<br>`supervisor` | **Actions:**<br>`acknowledgeShiftConflictAction`<br>`adjustShiftConflictAction` (`apps/web/app/actions/operators.ts:650-750`) | `apps/web/components/operations/ConflictResolutionModal.tsx` | `apps/mobile/components/operations/MobileConflictResolutionModal.tsx` | `AS1` assisted shift log push alert (`supabase/migrations/195_push_notification_event_producers.sql`) | `operations.conflict_acknowledged`<br>`operations.conflict_adjusted` | Status column on domain table `machine_hour_logs`. Acknowledging keeps entered values; adjusting alters start/end times. |
| **6** | **Job Application State Transitions** | `public.job_applications`<br>`status`<br>`rejection_reason`<br>`reviewer_id` | `'new'`<br>`'reviewing'`<br>`'shortlisted'`<br>`'interviewed'`<br>`'offered'`<br>`'hired'`<br>`'rejected'` | Public applicant (`/careers/[id]`) | `super_admin`<br>`admin`<br>`hr` | **Action:** `updateApplicationStatusAction`<br>`updateApplicationStatus` (`apps/web/app/actions/hiring.ts:150-185`) | `apps/web/app/(app)/careers/applications/[id]/ApplicationDetailClient.tsx` | N/A (Hiring is currently Web-only) | Email trigger via SendGrid | `careers.application_status_updated` | Transition state machine exists in code (`application-transitions.ts`) but lacks atomic RPC with database-enforced row locks. |
| **7** | **RFQ & Quotation Lifecycle** | `public.quote_requests`<br>`status`<br>`public.quotations.status`<br>`public.rfq_status_transitions` | `'submitted'`<br>`'in_review'`<br>`'quoted'`<br>`'accepted'`<br>`'rejected'`<br>`'lost'` | Prospective Client / Public user (`/quote`) | `super_admin`<br>`admin`<br>`sales` | **RPC:** `rfq_set_status`<br>**Action:** `rfq.ts:200-230` | `apps/web/app/(app)/rfq/[id]/RfqDetailClient.tsx` | N/A (Sales RFQ is Web-only) | `ENQ1` enquiry push alert to sales staff | `rfq.status_changed`<br>`rfq_events` audit table | Well-structured transition table (`rfq_status_transitions`), but entirely separate from all other company approval flows. |
| **8** | **Operator Payroll Statement Sign-off** | `public.operator_payrolls`<br>`status`<br>`approved_by`<br>`approved_at` | `'draft'`<br>`'reviewed'`<br>`'approved'`<br>`'paid'` | System calculation / HR run (`get_hr_payroll_summary`) | `super_admin`<br>`admin`<br>`hr` | **Actions:**<br>`updateOperatorRates`<br>`updateOperatorSalaryStatementAction` (`apps/web/app/actions/payroll.ts:64, 135`) | `apps/web/app/(app)/payroll/PayrollClient.tsx` | `apps/mobile/app/(app)/payroll.tsx` | `PAY1` push alert to operator (`apps/web/app/actions/payroll.ts:171`) | `payroll.statement_updated` | Status column exists on `operator_payrolls` table, but currently rates and statements are updated directly without interactive request/approval sign-off. |

---

## 2.2 Monorepo Foundations Audit (With Citations & Evidence)

### 2.2.1 Roles & Permission Model
- **Canonical Roles (Strictly 6 Monorepo-Wide):** Defined in `packages/permissions/src/roles.ts:4-11`:
  ```ts
  export const CANONICAL_ROLES: UserRole[] = [
    "super_admin", "admin", "manager", "supervisor", "hr", "operator"
  ];
  ```
- **Permission Matrix:** Managed in `packages/permissions/src/matrix.ts:1-120`. Maps atomic permissions (e.g. `"profile.approve_changes"`, `"operator.log_approve"`, `"user.view"`) across the 6 roles.
- **Document Access Rules:** `packages/permissions/src/documents.ts:24-89` enforces `PRIVILEGED_DOCUMENT_ROLES = ["super_admin", "admin", "hr"]`. Managers and supervisors can only view the `driving_license` of assigned team members (`canViewDocument`).
- **DAL Authorization:** Server components and actions enforce roles via `requireRole(...)` or `verifySession()` from `apps/web/lib/dal.ts:25-90`.
- **UI Role Guards:** Web uses `hasRole(...)` and `canViewUsers(...)`; Native Mobile uses `useAuth()` hook (`apps/mobile/lib/auth/useAuth.tsx:1-85`) returning `{ user, role, isPrivileged }`.

### 2.2.2 How RLS Policies Are Written Today
- **Helper Functions:** Authoritative definition in `supabase/migrations/021_optimize_rls_functions.sql:11-35`:
  - `public.current_user_role()`: Marked `STABLE SECURITY DEFINER SET search_path = public, pg_temp`.
  - Caches the role query within a statement/transaction for `auth.uid()`, preventing per-row lookups.
  - Helper wrappers: `public.is_admin()`, `public.is_supervisor_or_admin()`.
- **Performance Convention:** Modern policies wrap helper calls in sub-selects (e.g. `(SELECT public.current_user_role()) IN ('super_admin', 'admin', 'hr')`). PostgreSQL treats this as an **initPlan**, evaluating once for the whole query rather than once per row.
- **Example Evidence:** `supabase/migrations/194_phase1_storage_and_document_foundation.sql:139-147` on `document_change_requests`:
  ```sql
  CREATE POLICY "users read own change requests"
    ON public.document_change_requests FOR SELECT TO authenticated
    USING (
      user_id = (SELECT auth.uid()) OR
      (SELECT public.current_user_role()) IN ('super_admin', 'admin', 'manager', 'hr')
    );
  ```

### 2.2.3 Existing Audit Log
- **Table Definition:** `public.audit_logs` created in `supabase/migrations/016_enterprise_security_hardening.sql:86-105` and extended with `target_user_id` in `194_phase1_storage_and_document_foundation.sql:157-160`.
- **Columns:** `id`, `user_id` (actor), `action` (string), `entity_type`, `entity_id`, `details` (JSONB), `metadata` (JSONB), `category`, `severity`, `before_state` (JSONB), `after_state` (JSONB), `actor_name`, `actor_role`, `target_user_id`, `created_at`.
- **Centralized Writer:** `apps/web/lib/audit.ts:35-108` (`logAudit`). Uses `createSupabaseAdminClient()` in fire-and-forget mode. Auto-derives `category` and `severity` from action names via `@reachinternational/types`.
- **Audit Action Dictionary:** `packages/types/src/audit.ts:1-244` (`AUDIT_ACTIONS`).
- **UI Display:** Web renders `apps/web/app/(app)/audit/AuditClient.tsx` with dedicated filters and volume alerts (e.g. DPDP Act 2023 scrutiny banner for document views).

### 2.2.4 Notification, Push, Realtime, Outbox & QStash Infrastructure
- **Unified Inbox & Outbox:** `public.notifications` (`supabase/migrations/192_push_notifications_schema_and_pipeline.sql:14-48`).
- **Delivery Channels:**
  - Native Mobile: Expo SDK 58 Push Notifications via `expo-server-sdk` (`apps/mobile/lib/notifications/registerPush.ts:1-120`).
  - Web Application: Browser Web Push API via `web-push` and `/sw.js` (`apps/web/public/sw.js:1-95`).
- **Sub-Second Fast-Path Trigger:** `trg_notifications_fastpath` (`supabase/migrations/199_optimize_push_fastpath_and_external_delivery.sql:8-35`) uses `pg_net` to trigger `POST /api/notify/dispatch` asynchronously immediately on transaction commit.
- **Dispatcher Execution:** Claims batches via `claim_push_batch` (`FOR UPDATE SKIP LOCKED`) in `apps/web/app/api/notify/dispatch/route.ts:1-240`.
- **QStash Setup:** Used for serverless cron triggers and reminder workers (`apps/web/app/api/cron/send-reminders/route.ts:1-60`). Authenticates via `QSTASH_CURRENT_SIGNING_KEY` / `CRON_SECRET` bearer token verification.

### 2.2.5 Storage Conventions & Document Replacement
- **Buckets:**
  - `user_files`: Private bucket holding canonical, verified documents (`documents/<userId>/<docType>/<uuid>.jpg` and `_thumb.jpg`).
  - `doc_staging`: Private bucket holding unverified signup/replacement uploads (`1 MB` limit, `image/jpeg` only, `signup/<uuid>/<docType>.jpg` or `replacement/<userId>/<docType>_<ts>.jpg`).
- **Zero-Byte-Pass-Through:** Clients upload directly to signed upload URLs generated by `/api/signup/upload-urls` or `/api/documents/upload-url`. Zero binary image bytes pass through Vercel or Next.js servers.
- **Signed Read URLs:** Generated server-side with 60–120s TTL (`apps/web/app/actions/documents.ts:142-154`).
- **Document Replacement Promotion:** Atomic stored procedure `approve_document_change` (`supabase/migrations/197_document_verification_and_approval_rpcs.sql:23-130`) repoints `user_documents` pointers and sets status to `verified`.

### 2.2.6 Data-Access Layer (DAL), Server Actions & Validation
- **Server Data Access:** Next.js Server Components use `apps/web/lib/dal.ts` and `apps/web/lib/data/users/` with per-request SSR clients. No `SELECT *`; explicit columns only (`USER_SELECT_COLUMNS`).
- **Mutations:** Server Actions (`apps/web/app/actions/*`) validate inputs using Zod from `@reachinternational/validation`, check permissions, call atomic database RPCs, record audit logs, and trigger `revalidateTag(CACHE_TAGS.users, "max")`.
- **Validation:** Canonical schemas in `packages/validation/src/auth.ts`, `hourMeter.ts`, `documents.ts`.

### 2.2.7 UI Components, Skeletons, Theme & Interaction
- **Design System Tokens:** Adheres strictly to root `DESIGN.md` and `@reachinternational/design-tokens`:
  - Canvas: `#fafafa` light / `#0a0a0a` dark.
  - Elevated Cards: `#ffffff` light / `#171717` dark.
  - Hairline Border: 1px `#ebebeb` light / `#262626` dark.
  - Brand Primary: Reach Sky Blue `#0284c7` / `#0ea5e9`.
- **3-Tier Viewport Protocol:** Mobile (≤640px touch cards), Tablet (641–1023px 2-col grids), Desktop (≥1024px high-density tables).
- **Native Typography Guard:** Zero raw typography properties in `StyleSheet.create`; strictly `<Text variant="...">` enforced by `scripts/check-typography.mjs`.
- **Touch Ergonomics:** Minimum 44px hit targets (`hitSlopToMin48` / `minHeight: 44`), bottom sheets, and soft haptics (`haptics.selectionAsync()`).

### 2.2.8 Native Specifics
- **Server State Caching:** `@tanstack/react-query` v5 with `query-async-storage-persister` (`apps/mobile/lib/hooks/useUsersData.ts:606-680`).
- **Offline-First Queue:** `apps/mobile/lib/offline/OfflineQueueManager.ts` stores mutations in AsyncStorage, drains sequentially on reconnect, and prevents duplicate submissions.
- **Hardware SecureStore:** `expo-secure-store` backed by iOS Keychain / Android Keystore for auth tokens (`apps/mobile/lib/auth/secureStore.ts`). No plaintext AsyncStorage tokens.
- **Deep Linking:** Supported via URL scheme `reachops://` with path routing in `apps/mobile/app/`.

### 2.2.9 Test Setup
- **Monorepo Suite Runner:** `node scripts/run-all-tests.mjs` executes 21 modular test suites covering security, typography, permissions, utils, and push notifications.
- **Native Test Runner:** `node apps/mobile/test/index.mjs` executes 42 test suites verifying mobile workflows, touch targets, offline queue, and approvals.
- **Approvals Verification:** `apps/mobile/test/test-users-approvals.mjs` verifies 27 assertions for single/bulk registration, profile change, and account deletion approvals.
- **Live Database Tests:** Located in `supabase/tests/`, running directly against Dev DB `vlmxciuogczumumrwyot`.

---

## 2.3 Baseline Metrics (Live Measurement on Dev DB)

Measurements captured on live Supabase Dev DB (`vlmxciuogczumumrwyot`) via automated benchmarking script (`scratch/measure-baseline.mjs`):

### 2.3.1 Row Counts Across Approval-Related Tables
- **Users (`public.users`):**
  - Total: **13** rows
  - `status = 'pending'`: **1** row
  - `status = 'active'`: **12** rows
  - `status = 'rejected'`: **0** rows
- **Profile Change Requests (`public.profile_change_requests`):**
  - Total: **3** rows
  - `status = 'pending'`: **0** rows
  - `status = 'approved'`: **2** rows
  - `status = 'rejected'`: **0** rows
- **Account Deletion Requests (`public.account_deletion_requests`):**
  - Total: **0** rows (0 pending)
- **User Documents (`public.user_documents`):**
  - Total: **29** rows
  - `verification_status = 'pending'`: **0** rows
  - `verification_status = 'verified'`: **29** rows
- **Document Change Requests (`public.document_change_requests`):**
  - Total: **2** rows
  - `status = 'pending'`: **1** row
  - `status = 'approved'`: **1** row
- **Shift Log Conflicts (`public.machine_hour_logs`):**
  - `conflict_status = 'pending'`: **0** rows
- **Job Applications (`public.job_applications`):**
  - Total: **5** rows (`status = 'new'`: **1** row)
- **Quote Requests (`public.quote_requests`):**
  - Total: **1** row

### 2.3.2 Query Latency & Network Payload Measurements
| Query | Execution Latency | Payload Size | Current Rows Returned |
|---|---|---|---|
| **Pending Users Query** (`users.status = 'pending'`) | **94.18 ms** | **554 bytes** | 1 row |
| **Pending Profile Changes Query** (`status = 'pending'`) | **73.91 ms** | **2 bytes** | 0 rows |
| **Pending Account Deletions Query** (`status = 'pending'`) | **26.24 ms** | **2 bytes** | 0 rows |
| **Pending User Documents Query** (`verification_status = 'pending'`) | **23.06 ms** | **2 bytes** | 0 rows |
| **Simulated Parallel Web Page Fetch** (`Promise.all` across 4 tables) | **232.21 ms** | **232 bytes** | 1 row total |

---

## 2.4 Gap List: Technical Debt & Architectural Fragility

1. **Duplicated Approval Logic & RPC Sprawl:**
   - There are **over 14 separate atomic RPCs** doing identical concurrency locking (`SELECT ... FOR UPDATE`), role hierarchy verification, and audit logging.
   - Separate bulk approval RPCs (`bulk_approve_user_registrations_atomic`, `bulk_approve_profile_change_requests_atomic`) duplicating looping logic.

2. **Duct-Tape Fallback Workaround (High Fragility):**
   - In `apps/web/app/actions/account-deletion.ts:113-138`, if inserting into `account_deletion_requests` encounters an error, the server action silently falls back to inserting into `profile_change_requests` with `requested_data: { type: "account_deletion" }`.
   - On the frontend (`apps/mobile/lib/hooks/useUsersData.ts:665-680` and `apps/web/lib/data/users/user-shared.ts:492-515`), code must inspect and parse both tables to extract deletion requests.

3. **Inconsistent Status Strings & Audit Columns:**
   - `users.status`: `'pending'`, `'active'`, `'rejected'`.
   - `user_documents.verification_status`: `'pending'`, `'verified'`, `'rejected'`.
   - `profile_change_requests.status`: `'pending'`, `'approved'`, `'rejected'`, `'cancelled'`.
   - Reviewer identity stored under 3 different column names: `reviewed_by`, `approved_by`, and `verified_by`.

4. **Missing Central Approver Inbox:**
   - Administrators, managers, and HR have no unified inbox. To approve user registrations, profile changes, and account deletions, they must check `/users`. For document verifications, they must drill down into individual profiles. For shift conflicts, they must go to `/operations`.

5. **N+1 Storage Signed URL Generation:**
   - In document review flows, signed URLs are generated via iterative calls rather than single batch requests if not properly aggregated.

6. **Missing Post-Commit Outbox for Decision Notifications:**
   - When a registration or profile request is approved, no automated push notification is dispatched to the affected user because side-effects were not modeled outside the database transaction.

---

## 2.5 Conflicts Between Target Plan and Real Code (With Adaptations)

| # | Plan / Assumption | Reality in Codebase | Required Adaptation |
|---|---|---|---|
| **C-01** | *Plan assumed domain tables only hold approved truth.* | `public.users` currently holds unapproved pending registrations (`status = 'pending'`). | **Adaptation:** On user registration, the engine creates an `approval_requests` row (`type_id = 'user_registration'`). The `users` row is created with `status = 'pending'` (or stored in request payload). Upon approval, the apply handler sets `status = 'active'` and confirms auth email. Live users query filters `status = 'active'`. |
| **C-02** | *Plan assumed all approval requests have an `entity_id`.* | New user registrations do not yet have an active entity ID before user creation, or they reference an unapproved user ID. | **Adaptation:** Make `approval_requests.entity_id` nullable (`UUID NULL`). For registrations, `entity_id` references the newly provisioned pending `users.id`, or is populated upon approval. |
| **C-03** | *Plan assumed single table for account deletion.* | Dual-table fallback exists: `account_deletion_requests` and legacy records in `profile_change_requests`. | **Adaptation:** Migration script will backfill pending rows from BOTH tables into `approval_requests (type_id = 'account_deletion')` before deprecating the legacy tables. |
| **C-04** | *Plan assumed document review has its own table.* | Document verification uses `public.user_documents.verification_status`, while document replacement uses `public.document_change_requests`. | **Adaptation:** Model as two distinct types: `document_verification` (initial KYC check) and `document_replacement` (cross-bucket file transfer approval). |
| **C-05** | *Plan assumed QStash is mandatory for all side-effects.* | The monorepo has an existing sub-second fast-path trigger (`trg_notifications_fastpath` via `pg_net`) and 1-minute `pg_cron` sweeper for push delivery, while QStash handles cron dispatches. | **Adaptation:** The outbox worker will integrate with the existing `enqueue_notification` fast-path pipeline, supported by QStash / cron for resilient background sweeping. |

---

## 2.6 Migration Risk Assessment

| Risk Item | Severity | Description | Mitigation Strategy |
|---|---|---|---|
| **R-01: In-Flight Pending Requests During Cutover** | **Medium** | There is currently 1 pending user registration and 1 pending document change request in the Dev DB. | **Mitigation:** The additive migration will include a data backfill script that reads active pending rows from `users`, `profile_change_requests`, and `document_change_requests` and inserts corresponding rows into `approval_requests` with status `'pending'`. Zero requests lost. |
| **R-02: Staging S3/Storage Files for Replacements** | **Medium** | Replacement requests reference files in `doc_staging`. If the request schema changes, file paths could be lost or orphaned. | **Mitigation:** `requested_payload` preserves exact `staging_path` and `staging_thumb_path`. The domain handler invokes the proven cross-bucket `move()` procedure to `user_files`. |
| **R-03: Breaking Existing Mobile App Versions** | **High** | Deployed mobile versions (or current local builds) expect `usePendingApprovalRequests` and legacy RPCs (`approve_profile_change_request_atomic`). | **Mitigation:** Employ backward-compatibility database wrapper functions during the pilot. Legacy RPC names will internally delegate to `record_approval_decision` until mobile UI is updated and verified. |
| **R-04: Dual-Control Concurrency Deadlock** | **Low** | If two approvers submit decisions simultaneously on a dual-control request. | **Mitigation:** Database stored procedure uses `SELECT ... FOR UPDATE` row-level lock on `approval_requests` and `CONSTRAINT uq_approval_decisions_approver UNIQUE (request_id, approver_id)`. |

---

## Gate Assessment & Recommendation

- **High-Risk Blocker Found?** **NO**. No data loss or irreversible changes are required. All risks are classified as Medium/Low with concrete mitigations.
- **Pilot Recommendation:** Proceed with **Profile Sensitive-Info Change Requests** as the pilot flow.
- **Status:** Phase 0 complete. Awaiting user approval to proceed to Phase 1 (Schema Migration, Additive RPCs, and Rollback Script).
