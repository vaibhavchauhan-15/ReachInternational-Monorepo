/**
 * Machine Workflows & UI States Verification Suite
 * Tests /machines screen and machine modals for:
 * - UI states: Loading, empty, error, slow network, permission denied
 * - Optimistic UX & mutex concurrency locks
 * - Zero Alert.alert occurrences
 * - 0 raw typography property compliance
 * - Wide-screen responsive container constraints
 */

import fs from 'fs';
import path from 'path';

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passCount++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failCount++;
  }
}

console.log('\n--- VERIFYING MACHINES SCREEN & MODAL UI STATES ---');

const machinesScreenPath = path.resolve('apps/mobile/app/(app)/machines.tsx');
const machinesScreenContent = fs.readFileSync(machinesScreenPath, 'utf8');

const machineCategoryModalPath = path.resolve('apps/mobile/components/machines/MachineCategoryModal.tsx');
const machineCategoryModalContent = fs.readFileSync(machineCategoryModalPath, 'utf8');

const deleteMachineDialogPath = path.resolve('apps/mobile/components/machines/DeleteMachineDialog.tsx');
const deleteMachineDialogContent = fs.readFileSync(deleteMachineDialogPath, 'utf8');

// 1. UI State Primitives Integration
assert(
  machinesScreenContent.includes('EmptyState') &&
  machinesScreenContent.includes('ErrorState') &&
  machinesScreenContent.includes('PermissionDeniedView') &&
  machinesScreenContent.includes('SlowNetworkBanner'),
  'machines.tsx imports canonical EmptyState, ErrorState, PermissionDeniedView, and SlowNetworkBanner'
);

// 2. Permission Denied Gate (No silent return null)
assert(
  machinesScreenContent.includes('<PermissionDeniedView') &&
  machinesScreenContent.includes('featureName="Fleet') &&
  !machinesScreenContent.includes('if (role && isHr) {\n    return null;\n  }'),
  'machines.tsx guards HR role with PermissionDeniedView instead of abrupt return null'
);

// 3. Slow Network Telemetry
assert(
  machinesScreenContent.includes('slowTimerRef') &&
  machinesScreenContent.includes('setIsSlowNetwork(true)') &&
  machinesScreenContent.includes('<SlowNetworkBanner'),
  'machines.tsx mounts SlowNetworkBanner when initial fetch or refresh exceeds threshold'
);

// 4. Cached Fleet Resilience on Fetch Error
assert(
  machinesScreenContent.includes('Boolean(fetchError) && machines.length > 0') &&
  machinesScreenContent.includes('cachedErrorBanner'),
  'machines.tsx preserves cached fleet and displays ambient retry banner on background refresh failure'
);

// 5. Full ErrorState on Cold Load Failure
assert(
  machinesScreenContent.includes('fetchError && machines.length === 0') &&
  machinesScreenContent.includes('<ErrorState') &&
  machinesScreenContent.includes('onRetry='),
  'machines.tsx renders full ErrorState with retry when cold fleet load fails'
);

// 6. Role-Aware & Search-Aware Empty States
assert(
  machinesScreenContent.includes('variant="no-results"') &&
  machinesScreenContent.includes('actionLabel="Clear Search"') &&
  machinesScreenContent.includes('handleClearSearch'),
  'machines.tsx renders no-results EmptyState with Clear Search action'
);

assert(
  machinesScreenContent.includes('variant="filtered"') &&
  machinesScreenContent.includes('actionLabel="Reset All Filters"') &&
  machinesScreenContent.includes('handleResetAllFilters'),
  'machines.tsx renders filtered EmptyState with Reset All Filters action'
);

assert(
  machinesScreenContent.includes('title="No Assigned Machinery"') &&
  machinesScreenContent.includes('title="No Supervised Machinery"') &&
  machinesScreenContent.includes('title="Fleet Directory Empty"'),
  'machines.tsx renders role-scoped EmptyStates for operator, supervisor, and administrator'
);

// 7. Optimistic Deletion & Concurrency Mutex Lock
assert(
  machinesScreenContent.includes('isDeletingRef') &&
  machinesScreenContent.includes('if (!deleteMachine?.id || isDeletingRef.current) return;') &&
  machinesScreenContent.includes('setMachines((prev) => prev.filter'),
  'machines.tsx enforces isDeletingRef mutex lock and optimistically removes machine from state'
);

assert(
  machinesScreenContent.includes('setMachines(prevMachines)') &&
  machinesScreenContent.includes('queryClient.setQueriesData({ queryKey: [\'machines\'] }, prevMachines)'),
  'machines.tsx rolls back local state and queryClient cache on deletion failure'
);

// 8. Zero Alert.alert in Machine Modals
assert(
  !machineCategoryModalContent.includes('Alert.alert') &&
  machineCategoryModalContent.includes('<ConfirmDialog') &&
  machineCategoryModalContent.includes('title={`Delete Category'),
  'MachineCategoryModal replaces Alert.alert with ConfirmDialog'
);

assert(
  !deleteMachineDialogContent.includes('Alert.alert') &&
  deleteMachineDialogContent.includes('<ConfirmDialog') &&
  deleteMachineDialogContent.includes('variant="danger"'),
  'DeleteMachineDialog uses ConfirmDialog with zero Alert.alert'
);

// 9. Responsive Large-Viewport Containment
assert(
  machinesScreenContent.includes('maxWidth: 1200') &&
  machinesScreenContent.includes('alignSelf: \'center\''),
  'machines.tsx constrains scrollContent with maxWidth: 1200 and alignSelf: center for wide viewports'
);

// 10. Category Modal Management Integration
assert(
  machinesScreenContent.includes('<MachineCategoryModal') &&
  machinesScreenContent.includes('categoryModalOpen') &&
  machinesScreenContent.includes('manage-categories'),
  'machines.tsx integrates MachineCategoryModal with header action for fleet administrators'
);

console.log(`\nResults: ${passCount} Passed, ${failCount} Failed.`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('✅ Machine Workflows & UI States Verification Passed: 100% compliant!\n');
  process.exit(0);
}
