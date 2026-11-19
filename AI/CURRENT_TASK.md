# Current Task

## Task: Production Bug Fix & Schema Cache Resilience — save_machine_roster_atomic Missing in Production DB
**Status**: 🟢 FULLY VERIFIED & COMPLETE (ROOT CAUSE ISOLATED, RESILIENT FALLBACK IMPLEMENTED ACROSS WEB & MOBILE, MIGRATION 221 HARDENED WITH STANDALONE HELPERS, 0 TYPECHECK ERRORS, 29/29 MONOREPO TEST SUITES PASSING)
**Date**: 2026-11-19

### 1. Issue Reported:
- Error in production modal "Assign Operator to Shift":
  `Could not find the function public.save_machine_roster_atomic(p_activate_machine, p_caller_id, p_machine_id, p_operators, p_supervisor_ids) in the schema cache`
- Triggered whenever assigning an operator and clicking "Save Shift Roster" in the Production environment.

### 2. Root Cause Analysis:
1. **Unapplied Migration in Production Database**:
   - `public.save_machine_roster_atomic()` was created in migration `221_operations_roster_performance_optimization.sql` and applied only to Dev DB (`vlmxciuogczumumrwyot`).
   - The Production database (`dhbbgfzbyatzvqafnsqp`) has migrations recorded only up to `094_hr_payroll`. Migration 221 was never applied to the Production database.
2. **Absence of Resilient Fallback in Server Actions & Mobile**:
   - In commit `613fc91711bc185be3c37ed72bf3767ee6fed359`, `updateMachinePersonnelAction` in `apps/web/app/actions/machines.ts` was refactored to rely exclusively on `supabaseAdmin.rpc("save_machine_roster_atomic", ...)`.
   - When PostgREST encountered the missing RPC, it returned `PGRST202`. Without a fallback handler, the action failed immediately and returned the raw schema cache error to the UI toast.
   - Similarly, in `apps/mobile/components/assignments/AssignOperatorToMachineModal.tsx` and `MobileAssignPersonnelModal.tsx`, `save_machine_roster_atomic` was called directly without fallback for unmigrated environments.

### 3. Resolution & Fixes Implemented:
1. **Zero-Downtime Resilient Web Fallback (`apps/web/app/actions/machines.ts`)**:
   - Updated `updateMachinePersonnelAction` to detect when `save_machine_roster_atomic` is absent from the schema cache (`PGRST202`, `42883`, or `schema cache`).
   - Automatically diverts to `executeResilientPersonnelUpdateFallback()`:
     - Full operator validation (role check, status check, max 3 shifts per machine).
     - Authoritative client shift timing resolution via `client_shift_codes`.
     - Distinct shift validation & intra-machine non-overlap checks via `shiftToMinuteRanges` and `doRangesOverlap`.
     - Cross-fleet operator capacity checks (max 3 shifts or 24h fleet-wide) and cross-fleet interval collision detection.
     - Graceful range closure of relieved assignments (`end_assignment_range` with direct table update fallback).
     - Atomic assignment creation (`assign_operator_machine_atomic` with direct table insert fallback).
     - Coordinated update of `machines` table (`operator_ids`, `current_operator_id`, `supervisor_ids`, `current_supervisor_id`, `health_status`).
     - Audit logging via `logAudit()`.
     - Invalidation of Next.js cache tags (`TAGS.machineDetail`, `TAGS.operations`, `TAGS.todayShiftMonitor`, etc.).
     - Retrieval and return of fresh verified personnel snapshot via `getMachinePersonnelFreshAction()`.
2. **Mobile App Resilient Fallback (`apps/mobile`)**:
   - In `AssignOperatorToMachineModal.tsx` and `MobileAssignPersonnelModal.tsx`:
     - Added graceful detection of missing RPC (`PGRST202`, `42883`, or `schema cache`).
     - Executes direct assignment deactivation, atomic assignment insertion, and machine synchronization if the RPC is absent, preventing crashes in production.
3. **Migration 221 Standalone Hardening (`supabase/migrations/221_operations_roster_performance_optimization.sql`)**:
   - Ensured prerequisite helper functions `shift_to_ranges` and `do_shifts_overlap` are defined with `CREATE OR REPLACE FUNCTION` directly in Migration 221 so it has zero external dependencies.
   - Appended `NOTIFY pgrst, 'reload schema';` so PostgREST immediately reloads its schema cache upon execution.
4. **Test Fixture Cleansing (`scripts/test-cross-platform-shift-assignment-push.mjs`)**:
   - Added pre-cleaning of active assignments for test operator to avoid collision with previously left-over test rows in Dev DB.

### 4. Verification Evidence:
- **TypeScript Full Monorepo Typecheck (`pnpm typecheck`)**: 7/7 packages clean (0 errors).
- **Mobile Typography Guard (`node scripts/check-typography.mjs`)**: 0 raw typography properties.
- **Mobile Touch & Haptics Guard (`node scripts/test-touch-haptics.mjs`)**: 100% passed.
- **Mobile Automated Verification Suite (`node apps/mobile/run-tests.mjs`)**: 357/357 tests passed (100%).
- **Permissions Package Tests (`pnpm --filter @reachinternational/permissions test`)**: 25/25 tests passed (100%).
- **Cross-Platform Push Pipeline (`node scripts/test-cross-platform-shift-assignment-push.mjs`)**: 5/5 scenarios passed (100%).
- **Monorepo Comprehensive Test Runner (`node scripts/run-all-tests.mjs`)**: 29/29 suites passed (100%).
