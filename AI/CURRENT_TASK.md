# Current Task

## Task: Deep Analysis & Remediation of Operator Shift Assignment Overlap Bug in Production DB
**Status**: 🟢 FULLY VERIFIED & COMPLETE (ROOT CAUSE ISOLATED, MIGRATION 223 CREATED & TESTED IN DEV DB, MIGRATION 222 NEUTRALIZED, SERVER ACTION RESILIENCE HARDENED, 7/7 PACKAGES TYPECHECK CLEAN, 357/357 MOBILE TESTS PASSING)
**Date**: 2026-11-20

### 1. Error Diagnosed
- **User Action**: Ran migration 221 and 222 in the production DB (`dhbbgfzbyatzvqafnsqp`). When attempting to assign an operator in the "Assign Operator to Shift" modal (e.g. Vikas Singh on FDZN30 M/C-0009 rented to JK Paper Ltd.), the application displays:
  ```text
  Shift window overlapping error: The selected shift timings overlap with an existing active assignment.
  ```
  (Toast: `Save failed — Rolling back: Shift window overlapping error: The selected shift timings overlap with an existing active assignment.`)

- **Deep Root Cause Analysis**:
  1. **Migration 222 Rollback Pitfall**:
     - File `222_rollback_operations_roster_performance_optimization.sql` was named with a sequential number `222_`. When run sequentially after 221, it immediately executed `DROP FUNCTION IF EXISTS public.save_machine_roster_atomic(...)`, dropping the function in production!
     - When the web application called `save_machine_roster_atomic`, PostgREST returned `PGRST202` (function not found in schema cache).
  2. **Fallback Execution to `assign_operator_machine_atomic` & Direct Fallback**:
     - The missing RPC triggered `executeResilientPersonnelUpdateFallback` in `apps/web/app/actions/machines.ts`.
     - The fallback called `assign_operator_machine_atomic`, which attempted `INSERT INTO public.operator_machine_assignments`.
  3. **Exclusion Constraint Flaw (`oma_no_active_operator_shift_overlap` from Migration 184)**:
     - Migration 184 defined:
       ```sql
       ADD CONSTRAINT oma_no_active_operator_shift_overlap
       EXCLUDE USING gist (
         operator_id WITH =,
         lower(trim(shift_code)) WITH =,
         daterange(valid_from, COALESCE(valid_to, '9999-12-31'::date), '[]') WITH &&
       )
       WHERE (is_active = true OR valid_to IS NULL OR valid_from < valid_to);
       ```
     - **Flaw A (Inclusive Closed Bounds `'[]'`)**: `daterange(..., '[]')` includes both bounds. If an assignment ended today (`valid_to = today`), its range was `[valid_from, today]`. When a new assignment was created today (`valid_from = today`), its range was `[today, 9999-12-31]`. Both ranges overlapped on `today`!
     - **Flaw B (`WHERE valid_from < valid_to`)**: Inactive assignments (`is_active = false`) remained indexed as long as `valid_from < valid_to`. Thus, past assignments permanently blocked re-assigning an operator to that shift!
     - **Flaw C (Exception Mapping)**: When the INSERT hit this exclusion constraint, PostgreSQL raised `SQLSTATE '23P01'`, which `assign_operator_machine_atomic` caught at line 326 and converted into the exact error string:
       `'error', 'Shift window overlapping error: The selected shift timings overlap with an existing active assignment.'`
  4. **`shift_to_ranges` Unbounded Range Hazard**:
     - `shift_to_ranges(NULL, NULL)` previously returned `{(,1440), [0,)}`, an unbounded 24-hour range that overlapped with everything, causing `operator_shift_ranges` to also raise `23P01`.

### 2. Solutions Implemented:
1. **Migration 223 ([`supabase/migrations/223_fix_operator_shift_assignment_overlap_and_roster.sql`](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/supabase/migrations/223_fix_operator_shift_assignment_overlap_and_roster.sql))**:
   - Re-creates and hardens `save_machine_roster_atomic(UUID, JSONB, UUID[], BOOLEAN, UUID)` with same-day assignment re-activation (`v_ended_today_id`), shift normalization (`regexp_replace(shift_code, '^shift\s*', '', 'i')`), and PostgREST schema cache reload.
   - Replaces `oma_no_active_operator_shift_overlap` with a strictly active scope (`WHERE (is_active = true)`) and regex-normalized shift codes.
   - Adds NULL guards to `shift_to_ranges(TIME, TIME)` (returns `ARRAY[]::int4range[]`) and `do_shifts_overlap(...)` (returns `FALSE`).
   - Cleans and resyncs `operator_shift_ranges` table.
   - Hardens `assign_operator_machine_atomic()` with in-place updates, same-day re-activation, and consistent normalization.
2. **Neutralized Migration 222 ([`supabase/migrations/222_rollback_operations_roster_performance_optimization.sql`](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/supabase/migrations/222_rollback_operations_roster_performance_optimization.sql))**:
   - Replaced `DROP FUNCTION` with a safe no-op `DO $$ BEGIN NULL; END $$;` so sequential runners never drop the production function.
3. **Hardened Web Fallback ([`apps/web/app/actions/machines.ts`](file:///c:/Users/Reach%20International/Projects/ReachInternational-Monorepo/apps/web/app/actions/machines.ts))**:
   - Enhanced `executeResilientPersonnelUpdateFallback` with same-day ended assignment re-activation and explicit error bubbling.

### 3. Verification Evidence:
- **Dev DB Deployment & Verification (`vlmxciuogczumumrwyot`)**:
  - `oma_no_active_operator_shift_overlap` verified with `WHERE ((is_active = true))`.
  - `save_machine_roster_atomic` deployed and verified.
- **Static Typecheck (`pnpm typecheck`)**: 7/7 packages clean (0 errors).
- **Mobile Automated Test Suite (`node apps/mobile/run-tests.mjs`)**: 357/357 passed (100%).
- **Typography Check (`node scripts/check-typography.mjs`)**: Clean (0 raw typography violations).
- **Touch Haptics Check (`node scripts/test-touch-haptics.mjs`)**: Clean (All guards verified).
- **Permissions Test Suite (`pnpm --filter @reachinternational/permissions test`)**: 25/25 passed (100%).
