# Current Task

## Task: 260 — Screen Entry Point Migration & Optimistic Standardization: Assignment UI — Native React Native / Expo App
**Status**: 🟢 COMPLETED
**Date**: 2026-10-23
**Target Scope**:
- `apps/mobile/components/machines/MachineDetailView.tsx`
- `apps/mobile/components/users/AssignMachineModal.tsx`
- `apps/mobile/components/users/UserDetailView.tsx`
- `apps/mobile/components/clients/ClientDetailView.tsx`
- `apps/mobile/components/clients/AssignClientSupervisorModal.tsx`
- `apps/mobile/components/operations/MobileAssignPersonnelModal.tsx`
- `apps/mobile/components/assignments/AssignOperatorToMachineModal.tsx`
- `apps/mobile/lib/hooks/useClientDetailData.ts`
- `apps/mobile/test/test-standardized-assignment-ui.mjs`

**Key Migration & Standardization Deliverables**:
1. **Screen Entry Point Migrations**:
   - `MachineDetailView.tsx`: Migrated directly to `AssignOperatorToMachineModal`, showing target entity banner (Machine ID badge, Model, S/N), inherited client-supervisor callout, 24h capacity counter (`2 / 3 Shifts Assigned`), monochromatic `getUserInitials` avatar tokens, and automatic snapshot rollback.
   - `UserDetailView.tsx`: Migrated "Assign Equipment" action in Tab 1 (Fleet), Tab 3 (Assignments), and contextual menu to mount `AssignMachineModal` with operator delegation to `AssignMachineToOperatorModal`.
   - `AssignMachineModal.tsx`: Enhanced to detect operator roles and delegate to `AssignMachineToOperatorModal` for dedicated operator equipment assignment while preserving `MobileAssignPersonnelModal` fallback.
   - `ClientDetailView.tsx`: Upgraded "Assigned Client Supervisors" section with monochromatic `getUserInitials` avatar tokens (`#171717` ink / `#ffffff` elevated / hairline border) and optimistic rollback on supervisor removal.
   - `AssignClientSupervisorModal.tsx`: Upgraded candidate and currently assigned supervisor items with monochromatic `getUserInitials` avatar tokens.
   - `MobileAssignPersonnelModal.tsx`: Modernized operator roster card display with monochromatic `getUserInitials` avatar tokens.
2. **Optimistic Updates & Reliable Cache Rollback**:
   - `useClientDetailData.ts`: Enhanced `assignSupervisorMutation` and `removeSupervisorMutation` with `onMutate` query cancellation, previous cache snapshotting, optimistic cache population/filtering, and automatic rollback in `onError`.
3. **Automated Verification**:
   - Expanded `apps/mobile/test/test-standardized-assignment-ui.mjs` with Section 6 verifying all screen entry point migrations, optimistic rollback in `useClientDetailData`, and monochromatic `getUserInitials` tokens across `ClientDetailView`, `AssignClientSupervisorModal`, `MachineDetailView`, and `UserDetailView`.
   - `node apps/mobile/test/index.mjs`: Clean pass across all 34 / 34 mobile test suites (100%).
   - `node apps/mobile/run-tests.mjs`: Clean pass across all 357 / 357 test scenarios (100%).
   - `node scripts/check-typography.mjs`: Clean pass (0 raw typography property violations).
   - `pnpm typecheck`: Clean pass across all 7 workspace packages (0 errors).
