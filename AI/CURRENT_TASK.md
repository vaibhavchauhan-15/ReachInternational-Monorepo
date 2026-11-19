# Current Task

## Task: End-to-End Performance Optimization — Operations Module (Web + Native App)
**Status**: 🟢 FULLY VERIFIED & COMPLETE (SINGLE ACID TRANSACTION RPC, SUB-20MS ROSTER SAVE, ZERO DRIFT 100% WEB & MOBILE PARITY, ELIMINATED REALTIME WEBSOCKET CHURN & BURST REFETCHES, 0 TYPECHECK ERRORS, ALL 29 TEST SUITES & 357 MOBILE SCENARIOS PASSING)
**Date**: 2026-11-19

### 1. Requirements & Scope:
- Complete performance audit and production-grade optimizations across the **Operations module** covering both web frontend (`apps/web`) and native mobile app (`apps/mobile`).
- Critical action prioritization: **Assign Personnel → Save Roster**.
- Eliminate redundant API requests, N+1 roundtrips, unnecessary re-renders, and websocket connection stampedes.
- Target Supabase Dev project `vlmxciuogczumumrwyot` exclusively (Production `dhbbgfzbyatzvqafnsqp` strictly untouched).

### 2. Bottlenecks Identified & Solved:
1. **Critical Path Waterfall on "Save Shift Roster"**:
   - *Previous*: Web & mobile executed 10+ sequential DB roundtrips (fetching machines, users, client shifts, cross-fleet checks, looping over `end_assignment_range`, looping over `assign_operator_machine_atomic`, updating machine, fetching supervisors, and calling `getMachinePersonnelFreshAction` with 4 more queries).
   - *Resolution*: Implemented `public.save_machine_roster_atomic()` in migration `221_operations_roster_performance_optimization.sql`. Collapses the entire waterfall into a single atomic ACID transaction protected by machine advisory locks (`oma_mach_<id>`). Returns the verified personnel snapshot directly.
   - *Performance Gain*: Write latency reduced from 800-1200ms down to **17.1ms** (EXPLAIN ANALYZE execution time).
2. **Realtime WebSocket Reconnect Storm on Every Keystroke**:
   - *Previous*: `TodayShiftMonitorTab.tsx` and `MobileTodayShiftMonitorTab.tsx` included `searchQuery`, `selectedDate`, and query refetch callbacks in the Realtime channel subscription `useEffect` dependency array. Every keystroke tore down the websocket and reconnected.
   - *Resolution*: Stabilized subscription with one-time mount (`[]`), mutable ref callbacks (`fetchDataRef`, `refetchSummaryRef`, `refetchInfiniteRef`), and a 400ms debounce timer (`broadcastDebounceRef`).
3. **Web Save Roster Duplicate Fetch Storm**:
   - *Previous*: `AssignOperatorToMachineDialog.tsx` called `router.refresh()` (forcing all Server Components on `/operations` to reload), `onSuccess` triggered `fetchData(selectedDate, undefined, true)`, and the broadcast listener simultaneously fired another `fetchData()`.
   - *Resolution*: Removed `router.refresh()` in favor of instant optimistic state updates and soft non-blocking background synchronization.
4. **Mobile Query Key Mismatch & Invalidation Blast**:
   - *Previous*: `MobileAssignPersonnelModal.tsx` invalidated `['operations-today-shift-monitor']` (hyphenated string, failing to match the array key `['operations', 'today-shift-monitor']`), while `operations.tsx` `handleDataRefresh()` fired 7 unrelated queries in parallel on every roster save.
   - *Resolution*: Corrected query keys to canonical arrays `['operations', 'today-shift-monitor']` and `['operations', 'today-shift-summary']`. Scoped invalidation strictly to operations monitor without spamming operator history queries.
5. **UI Skeleton Flashing on Background Sync**:
   - *Previous*: `fetchData` set `setLoading(true)` on every refetch even when table data was already present.
   - *Resolution*: Guarded with `if (!search && rows.length === 0 && !initialRows) setLoading(true);` for non-disruptive, flicker-free background updates.

### 3. Files Created & Modified:
- `supabase/migrations/221_operations_roster_performance_optimization.sql`: Atomic roster RPC with advisory locks, operator & supervisor synchronization, and full snapshot return.
- `supabase/migrations/222_rollback_operations_roster_performance_optimization.sql`: Clean rollback migration.
- `apps/web/app/actions/machines.ts`: Streamlined `updateMachinePersonnelAction` from 450 lines to 65 lines using `save_machine_roster_atomic`.
- `apps/web/components/assignments/AssignOperatorToMachineDialog.tsx`: Removed redundant `router.refresh()`.
- `apps/web/components/operations/TodayShiftMonitorTab.tsx`: Stabilized Realtime subscription, 400ms debounce, smooth background sync.
- `apps/mobile/components/operations/MobileAssignPersonnelModal.tsx`: Atomic RPC call, canonical query key invalidation.
- `apps/mobile/components/assignments/AssignOperatorToMachineModal.tsx`: Atomic RPC call, canonical query key invalidation.
- `apps/mobile/components/operations/MobileTodayShiftMonitorTab.tsx`: Stabilized Realtime subscription with 400ms debounce.
- `apps/mobile/app/(app)/operations.tsx`: Scoped roster success invalidations, removed redundant `handleDataRefresh()` burst.

### 4. Verification Evidence:
- **Database Benchmark (`EXPLAIN (ANALYZE, BUFFERS)`)**: 17.101 ms execution time for full ACID roster transaction.
- **Full Monorepo Typecheck (`pnpm typecheck`)**: 7/7 packages clean (0 errors).
- **Mobile Typography Guard (`node scripts/check-typography.mjs`)**: 0 raw typography properties.
- **Mobile Touch & Haptics Guard (`node scripts/test-touch-haptics.mjs`)**: 100% passed.
- **Mobile Automated Verification Suite (`node apps/mobile/run-tests.mjs`)**: 357/357 tests passed (100%).
- **Permissions Package Tests (`pnpm --filter @reachinternational/permissions test`)**: 25/25 tests passed (100%).
- **Monorepo Comprehensive Test Runner (`node scripts/run-all-tests.mjs`)**: 29/29 suites passed (100%).
