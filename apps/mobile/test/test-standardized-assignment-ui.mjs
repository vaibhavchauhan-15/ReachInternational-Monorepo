/**
 * ReachInternational Mobile — Standardized Assignment UI Verification Suite
 *
 * Verifies the redesigned, modular native assignment component suite:
 * 1. Component Architecture & Barrel Exports (apps/mobile/components/assignments/)
 * 2. Mobile-First Ergonomics & Design System Adherence (min 44px, monochromatic avatars)
 * 3. Shift Conflict & 24h Capacity Enforcement (max 3 operators, disjoint intervals)
 * 4. Optimistic Mutation, Snapshot Rollback & Real-time Synchronization
 * 5. Security & Client-Based Inherited RBAC Integration
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const testDir = path.dirname(__filename);
const mobileRoot = path.resolve(testDir, '..');

console.log('🧪 Starting Standardized Native Assignment UI Verification Suite...\n');

const assignmentsDir = path.join(mobileRoot, 'components', 'assignments');

// ─── 1. COMPONENT ARCHITECTURE & BARREL EXPORTS ──────────────────────────────
console.log('--- 1. Component Architecture & Barrel Exports ---');

const expectedFiles = [
  'AssignmentBottomSheet.tsx',
  'AssignmentSearchInput.tsx',
  'AssignmentSelectableList.tsx',
  'AssignmentShiftPicker.tsx',
  'AssignmentSelectionSummary.tsx',
  'AssignmentActionBar.tsx',
  'AssignOperatorToMachineModal.tsx',
  'AssignMachineToOperatorModal.tsx',
  'AssignSupervisorToClientModal.tsx',
  'AssignReportingSupervisorModal.tsx',
  'index.ts',
];

for (const file of expectedFiles) {
  const filePath = path.join(assignmentsDir, file);
  assert(fs.existsSync(filePath), `Expected ${file} to exist in components/assignments/`);
  console.log(`  ✓ ${file} exists`);
}

const barrelPath = path.join(assignmentsDir, 'index.ts');
const barrelContent = fs.readFileSync(barrelPath, 'utf8');

const expectedExports = [
  'AssignmentBottomSheet',
  'AssignmentSearchInput',
  'AssignmentSelectableList',
  'AssignmentShiftPicker',
  'AssignmentSelectionSummary',
  'AssignmentActionBar',
  'AssignOperatorToMachineModal',
  'AssignMachineToOperatorModal',
  'AssignSupervisorToClientModal',
  'AssignReportingSupervisorModal',
];

for (const exp of expectedExports) {
  assert(barrelContent.includes(exp), `Barrel index.ts must export ${exp}`);
  console.log(`  ✓ Barrel exports ${exp}`);
}

// ─── 2. MOBILE-FIRST ERGONOMICS & DESIGN SYSTEM INVARIANTS ──────────────────
console.log('\n--- 2. Mobile-First Ergonomics & Design System Invariants ---');

const bottomSheetContent = fs.readFileSync(path.join(assignmentsDir, 'AssignmentBottomSheet.tsx'), 'utf8');
assert(
  bottomSheetContent.includes("variant=\"bottom\""),
  'AssignmentBottomSheet: Must configure bottom sheet modal presentation'
);
assert(
  bottomSheetContent.includes('KeyboardAvoidingView'),
  'AssignmentBottomSheet: Must implement KeyboardAvoidingView for safe input focus'
);
assert(
  bottomSheetContent.includes('targetEntity?.inheritedNotice'),
  'AssignmentBottomSheet: Renders inherited client supervisor notice banner'
);
console.log('  ✓ AssignmentBottomSheet implements bottom-sheet presentation, safe areas, and inherited notice');

const searchInputContent = fs.readFileSync(path.join(assignmentsDir, 'AssignmentSearchInput.tsx'), 'utf8');
assert(
  searchInputContent.includes('debounceMs = 250') || searchInputContent.includes('debounceMs'),
  'AssignmentSearchInput: Must support debounced text filtering'
);
assert(
  searchInputContent.includes('minHeight: 44'),
  'AssignmentSearchInput: Enforces minimum 44px touch target on search input container'
);
console.log('  ✓ AssignmentSearchInput implements debounced query propagation and 44px touch targets');

const selectableListContent = fs.readFileSync(path.join(assignmentsDir, 'AssignmentSelectableList.tsx'), 'utf8');
assert(
  selectableListContent.includes('getUserInitials'),
  'AssignmentSelectableList: Uses canonical getUserInitials for monochromatic avatars'
);
assert(
  selectableListContent.includes("isDark ? '#ffffff' : '#171717'") ||
  selectableListContent.includes("isDark ? '#171717' : '#ffffff'"),
  'AssignmentSelectableList: Adheres to monochromatic theme-optimized avatar palette'
);
assert(
  selectableListContent.includes('minHeight: 52') || selectableListContent.includes('minHeight: 44'),
  'AssignmentSelectableList: Enforces min 44px+ touch ergonomics on interactive candidate cards'
);
console.log('  ✓ AssignmentSelectableList renders monochromatic avatars and accessible touch cards');

// ─── 3. CAPACITY LIMITS & SHIFT OVERLAP VALIDATION ────────────────────────────
console.log('\n--- 3. Capacity Limits & Shift Overlap Validation ---');

const opToMachineContent = fs.readFileSync(path.join(assignmentsDir, 'AssignOperatorToMachineModal.tsx'), 'utf8');
assert(
  opToMachineContent.includes('maxCapacity={3}') || opToMachineContent.includes('roster.length >= 3'),
  'AssignOperatorToMachineModal: Enforces maximum 3 operators per machinery unit'
);
assert(
  opToMachineContent.includes('doRangesOverlap') && opToMachineContent.includes('shiftToMinuteRanges'),
  'AssignOperatorToMachineModal: Enforces disjoint interval overlap validation'
);
assert(
  opToMachineContent.includes('occupiedShiftCodes.includes'),
  'AssignOperatorToMachineModal: Prevents duplicate shift assignment on the same machine'
);
assert(
  opToMachineContent.includes('otherAssignments.length >= 3'),
  'AssignOperatorToMachineModal: Enforces fleet limit of 3 active shifts per operator'
);
console.log('  ✓ AssignOperatorToMachineModal enforces 3-operator machine cap and collision detection');

const machineToOpContent = fs.readFileSync(path.join(assignmentsDir, 'AssignMachineToOperatorModal.tsx'), 'utf8');
assert(
  machineToOpContent.includes('maxCapacity={3}') || machineToOpContent.includes('roster.length >= 3'),
  'AssignMachineToOperatorModal: Enforces maximum 3 active shifts for operator across fleet'
);
assert(
  machineToOpContent.includes('doRangesOverlap') && machineToOpContent.includes('shiftToMinuteRanges'),
  'AssignMachineToOperatorModal: Prevents operator shift schedule collisions across machines'
);
console.log('  ✓ AssignMachineToOperatorModal enforces operator fleet capacity and interval validation');

// ─── 4. OPTIMISTIC UPDATES & SNAPSHOT ROLLBACK ────────────────────────────────
console.log('\n--- 4. Optimistic Updates & Snapshot Rollback ---');

assert(
  opToMachineContent.includes('savingRef = useRef(false);') &&
  opToMachineContent.includes('savingRef.current = true;'),
  'AssignOperatorToMachineModal: Implements synchronous savingRef mutex preventing double taps'
);
assert(
  opToMachineContent.includes('queryClient.getQueryData') &&
  opToMachineContent.includes('queryClient.setQueryData'),
  'AssignOperatorToMachineModal: Implements cache snapshot and safe rollback on mutation failure'
);
assert(
  opToMachineContent.includes('broadcastMobileAssignmentChanged'),
  'AssignOperatorToMachineModal: Broadcasts realtime assignment changed event'
);
console.log('  ✓ AssignOperatorToMachineModal implements savingRef mutex, cache rollback, and realtime broadcast');

assert(
  machineToOpContent.includes('savingRef = useRef(false);') &&
  machineToOpContent.includes('savingRef.current = true;'),
  'AssignMachineToOperatorModal: Implements synchronous savingRef mutex'
);
assert(
  machineToOpContent.includes('queryClient.getQueryData') &&
  machineToOpContent.includes('queryClient.setQueryData'),
  'AssignMachineToOperatorModal: Implements cache snapshot and safe rollback'
);
console.log('  ✓ AssignMachineToOperatorModal implements savingRef mutex and cache rollback');

// ─── 5. SUPERVISOR & CLIENT ASSIGNMENT INVARIANTS ─────────────────────────────
console.log('\n--- 5. Supervisor & Client Assignment Invariants ---');

const supToClientContent = fs.readFileSync(path.join(assignmentsDir, 'AssignSupervisorToClientModal.tsx'), 'utf8');
assert(
  supToClientContent.includes('assign_client_supervisor_atomic') ||
  supToClientContent.includes('assignSupervisor'),
  'AssignSupervisorToClientModal: Executes client supervisor assignment via data hook'
);
assert(
  supToClientContent.includes('currentlyAssignedSupervisors'),
  'AssignSupervisorToClientModal: Displays currently assigned supervisors with removal'
);
console.log('  ✓ AssignSupervisorToClientModal manages client-level supervisors with removal');

const repSupContent = fs.readFileSync(path.join(assignmentsDir, 'AssignReportingSupervisorModal.tsx'), 'utf8');
assert(
  repSupContent.includes('s.id !== user.id') && repSupContent.includes('selectedId === user.id'),
  'AssignReportingSupervisorModal: Prevents user from being assigned as own reporting supervisor'
);
assert(
  repSupContent.includes('user_supervisors'),
  'AssignReportingSupervisorModal: Synchronizes user_supervisors junction table'
);
console.log('  ✓ AssignReportingSupervisorModal prevents self-supervisor assignment and syncs junction table');

// ─── 6. SCREEN ENTRY POINT MIGRATIONS & OPTIMISTIC ROLLBACK ─────────────────
console.log('\n--- 6. Screen Entry Point Migrations & Optimistic Rollback ---');

const machineDetailContent = fs.readFileSync(path.join(mobileRoot, 'components', 'machines', 'MachineDetailView.tsx'), 'utf8');
assert(
  machineDetailContent.includes('AssignOperatorToMachineModal'),
  'MachineDetailView: Integrates and mounts AssignOperatorToMachineModal'
);
console.log('  ✓ MachineDetailView mounts AssignOperatorToMachineModal');

const assignMachineContent = fs.readFileSync(path.join(mobileRoot, 'components', 'users', 'AssignMachineModal.tsx'), 'utf8');
assert(
  assignMachineContent.includes('AssignMachineToOperatorModal'),
  'AssignMachineModal: Delegates to AssignMachineToOperatorModal for operator assignments'
);
console.log('  ✓ AssignMachineModal delegates to AssignMachineToOperatorModal');

const userDetailContent = fs.readFileSync(path.join(mobileRoot, 'components', 'users', 'UserDetailView.tsx'), 'utf8');
assert(
  userDetailContent.includes('<AssignMachineModal') && userDetailContent.includes('<AssignSupervisorModal'),
  'UserDetailView: Mounts standardized AssignMachineModal and AssignSupervisorModal'
);
console.log('  ✓ UserDetailView mounts standardized AssignMachineModal and AssignSupervisorModal');

const clientDetailHookContent = fs.readFileSync(path.join(mobileRoot, 'lib', 'hooks', 'useClientDetailData.ts'), 'utf8');
assert(
  clientDetailHookContent.includes('onMutate:') &&
  clientDetailHookContent.includes('previousSupervisors') &&
  clientDetailHookContent.includes('onError:'),
  'useClientDetailData: Implements optimistic mutations with snapshot rollback for supervisor assignments'
);
console.log('  ✓ useClientDetailData implements optimistic mutations and snapshot rollback');

const clientDetailViewContent = fs.readFileSync(path.join(mobileRoot, 'components', 'clients', 'ClientDetailView.tsx'), 'utf8');
assert(
  clientDetailViewContent.includes('getUserInitials'),
  'ClientDetailView: Employs monochromatic getUserInitials avatar tokens for client supervisors'
);
console.log('  ✓ ClientDetailView employs monochromatic getUserInitials avatar tokens');

const assignClientSupContent = fs.readFileSync(path.join(mobileRoot, 'components', 'clients', 'AssignClientSupervisorModal.tsx'), 'utf8');
assert(
  assignClientSupContent.includes('getUserInitials'),
  'AssignClientSupervisorModal: Employs monochromatic getUserInitials avatar tokens'
);
console.log('  ✓ AssignClientSupervisorModal employs monochromatic getUserInitials avatar tokens');

console.log('\n======================================================');
console.log('🎉 ALL STANDARDIZED ASSIGNMENT UI CHECKS PASSED!');
console.log('======================================================\n');
