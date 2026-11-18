# Current Task

## Task: Atomic Bulk "Approve All" Engine with Statutory Document Protection (`apps/web` & `apps/mobile`)
**Status**: 🟢 FULLY VERIFIED & COMPLETE (0 TYPECHECK ERRORS ACROSS ALL 7 PACKAGES, 14/14 APPROVE ALL CHECKS PASSING, 357/357 MOBILE TESTS PASSING, 28/28 MONOREPO SUITES PASSING)
**Date**: 2026-11-19
**Target Files & Configurations**:
- Database Migrations: [supabase/migrations/218_approve_all_pending_registrations.sql](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/supabase/migrations/218_approve_all_pending_registrations.sql) & [supabase/migrations/219_rollback_approve_all_pending_registrations.sql](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/supabase/migrations/219_rollback_approve_all_pending_registrations.sql)
- Shared Types: [packages/types/src/approvals.ts](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/packages/types/src/approvals.ts)
- Shared Validation: [packages/validation/src/approvals.ts](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/packages/validation/src/approvals.ts)
- Shared Client Utilities: [packages/utils/src/approvals-client.ts](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/packages/utils/src/approvals-client.ts)
- Web Server Action & API: [apps/web/app/actions/approvals.ts](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/apps/web/app/actions/approvals.ts) & [apps/web/app/api/approvals/approve-all/route.ts](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/apps/web/app/api/approvals/approve-all/route.ts)
- Web UI & Modal: [apps/web/app/(app)/approvals/ApprovalsClientShell.tsx](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/apps/web/app/(app)/approvals/ApprovalsClientShell.tsx) & [apps/web/app/(app)/approvals/components/ApproveAllConfirmModal.tsx](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/apps/web/app/(app)/approvals/components/ApproveAllConfirmModal.tsx)
- Mobile Mutation & Screen: [apps/mobile/lib/hooks/useApprovalsData.ts](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/apps/mobile/lib/hooks/useApprovalsData.ts) & [apps/mobile/app/(app)/approvals.tsx](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/apps/mobile/app/(app)/approvals.tsx)
- Mobile Confirm Modal: [apps/mobile/components/approvals/ApproveAllConfirmModal.tsx](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/apps/mobile/components/approvals/ApproveAllConfirmModal.tsx)
- Monorepo Verification Test: [tests/approvals/test-approve-all-engine.mjs](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/tests/approvals/test-approve-all-engine.mjs)

---

### User Request Addressed:
1. **"Approve All" Feature**: In the approvals page (`/approvals` on Web and Native Mobile), implement "Approve All".
2. **Critical Business Invariant**: "if approval all then all the user documents should be pending only user is active".
3. **Speed, Responsiveness & Optimization**: Atomic transaction handling, row-level locking with `FOR UPDATE SKIP LOCKED`, optimistic UI dismiss with soft spring animation, zero-drift Web & Mobile parity.

---

### Implementation Details:
1. **Database Migration 218 (`public.approval_approve_all`)**:
   - Executes as an atomic `SECURITY DEFINER` stored procedure on Supabase PostgreSQL.
   - Enforces role authorization (`super_admin` or `admin`).
   - Locks pending registration requests with `FOR UPDATE SKIP LOCKED` for concurrency safety and zero deadlock risk.
   - Updates `approval_requests`: marks registrations as `approved` with timestamp and actor id.
   - Updates `users`: sets `status = 'active'` and `updated_at = NOW()`.
   - **Crucial Statutory Invariant**: Explicitly updates `user_documents`:
     `SET verification_status = 'pending', status = 'pending', verified_by = NULL, verified_at = NULL`.
     Only the user is activated; all user documents remain in `pending` status.
   - Consolidates pending documents into a single `document_verify` entry with `pending_document_ids` for each user so they stay visible in the "Document Verifications" queue.
   - Excludes standalone `document_verify` and `document_replace` requests from bulk approval to prevent bulk bypass of statutory compliance.
2. **Shared Packages (`@reachinternational/*`)**:
   - `@reachinternational/types`: Added `ApprovalApproveAllResult` interface.
   - `@reachinternational/validation`: Added `ApprovalApproveAllInputSchema` & `ApprovalApproveAllInput`.
   - `@reachinternational/utils`: Added `approveAll()` supporting direct RPC execution with HTTP REST fallback.
3. **Web (`apps/web`)**:
   - `approveAllAction`: Server Action with session check, admin RBAC validation, audit logging (`approval.approve_all`), and cache invalidation (`revalidateTag` for `approvals`, `approvalsList`, `approvalsCounts`, `users`, `documents`).
   - `POST /api/approvals/approve-all`: Dual-authenticated API route for web/mobile client requests.
   - `ApproveAllConfirmModal.tsx`: Accessible dialog explicitly informing the administrator that the user will be activated while statutory KYC documents remain pending for manual review.
   - `ApprovalsClientShell.tsx`: Header "Approve All" button with pending count badge, optimistic exit animations, and instant count synchronization.
4. **Native Mobile (`apps/mobile`)**:
   - `useApproveAllMutation`: Dual-transport hook (web API endpoint with direct Supabase RPC fallback), optimistic cache updates for rapid responsiveness, count badge decrement, and rollback on error.
   - `ApproveAllConfirmModal.tsx`: Native modal adhering to 0 raw typography properties, min 44px touch targets, and `haptics.confirm()`.
   - `approvals.tsx`: Header "Approve All" button with minimum 44px touch targets, loading spinner, and toast notifications.

---

### Verification:
- `pnpm typecheck`: Clean across all 7 workspace packages (0 errors).
- `node scripts/check-typography.mjs`: 0 raw typography property violations across `apps/mobile`.
- `node scripts/test-touch-haptics.mjs`: 100% compliant.
- `node tests/approvals/test-approve-all-engine.mjs`: 14/14 checks passed.
- `node apps/mobile/run-tests.mjs`: 357/357 verification scenarios passed.
- `node scripts/run-all-tests.mjs`: 28/28 monorepo test suites passing (100%).
