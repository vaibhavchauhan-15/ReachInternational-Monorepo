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
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');

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

const machinesScreenPath = path.join(__dirname, 'app/(app)/machines.tsx');
const machinesScreenContent = fs.readFileSync(machinesScreenPath, 'utf8');

const machineCategoryModalPath = path.join(__dirname, 'components/machines/MachineCategoryModal.tsx');
const machineCategoryModalContent = fs.readFileSync(machineCategoryModalPath, 'utf8');

const deleteMachineDialogPath = path.join(__dirname, 'components/machines/DeleteMachineDialog.tsx');
const deleteMachineDialogContent = fs.readFileSync(deleteMachineDialogPath, 'utf8');

const useMachinesDataPath = path.join(__dirname, 'lib/hooks/useMachinesData.ts');
const useMachinesDataContent = fs.readFileSync(useMachinesDataPath, 'utf8');

// 1. UI State Primitives Integration
assert(
  machinesScreenContent.includes('EmptyState') &&
  machinesScreenContent.includes('ErrorState') &&
  machinesScreenContent.includes('SlowNetworkBanner'),
  'machines.tsx imports canonical EmptyState, ErrorState, and SlowNetworkBanner'
);

// 2. Route Guard (capability-driven redirect, no in-place denial screen)
assert(
  machinesScreenContent.includes('canAccessMachinesRoute')
    ? machinesScreenContent.includes('canAccessMachinesRoute(role)') &&
      machinesScreenContent.includes('<Redirect href={getMobileRoleHomeRoute(role) as any} />') &&
      !machinesScreenContent.includes('<PermissionDeniedView')
    : machinesScreenContent.includes('<PermissionDeniedView'),
  'machines.tsx redirects unauthorized roles (HR, unknown) through the shared capability guard'
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
  machinesScreenContent.includes('if (!target?.id || isDeletingRef.current) return;') &&
  useMachinesDataContent.includes('onMutate: async (machine: any)') &&
  useMachinesDataContent.includes('removeMachineFromCache(machine?.id)'),
  'machines.tsx enforces isDeletingRef mutex lock and the cache layer removes the row optimistically'
);

assert(
  useMachinesDataContent.includes('onError: async () =>') &&
  useMachinesDataContent.includes('await resyncMachines()'),
  'useMachinesData.ts rolls back the TanStack cache through an authoritative resync on deletion failure'
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

// 11. TanStack Query v5 Server State & RPC Aggregation
assert(
  useMachinesDataContent.includes('useMachinesInfiniteQuery') &&
  useMachinesDataContent.includes('useMachineKPIs') &&
  useMachinesDataContent.includes('PAGE_SIZE = 10'),
  'useMachinesData.ts exports useMachinesInfiniteQuery, useMachineKPIs, and bounded PAGE_SIZE = 10'
);

assert(
  useMachinesDataContent.includes('get_machines_directory_summary') &&
  useMachinesDataContent.includes('p_supervisor_id') &&
  useMachinesDataContent.includes('p_operator_id'),
  'useMachinesData.ts aggregates KPIs via high-performance get_machines_directory_summary RPC'
);

assert(
  useMachinesDataContent.includes('get_operator_assigned_machines') &&
  useMachinesDataContent.includes('isOperatorMachineView') &&
  useMachinesDataContent.includes('abortSignal(signal)') &&
  !useMachinesDataContent.includes("from('operator_machine_assignments')"),
  'useMachinesData.ts reads operator machinery through the role-checked RPC (no client-side fleet query)'
);

// 12. FlatList Virtualization & 60fps Scrolling Ergonomics
assert(
  machinesScreenContent.includes('<FlatList') &&
  machinesScreenContent.includes('renderItem={renderMachineItem}') &&
  machinesScreenContent.includes('initialNumToRender={10}') &&
  machinesScreenContent.includes('maxToRenderPerBatch={10}') &&
  machinesScreenContent.includes('windowSize={5}') &&
  !machinesScreenContent.includes('<ScrollView\n        contentContainerStyle={styles.scrollContent}'),
  'machines.tsx uses FlatList virtualization with batching and windowSize tuning instead of unbounded ScrollView'
);

// 13. Instant 0ms Shell & Progressive Skeletons
const machineKPIStripPath = path.join(__dirname, 'components/machines/MachineKPIStrip.tsx');
const machineKPIStripContent = fs.readFileSync(machineKPIStripPath, 'utf8');

const kpiCardPath = path.join(__dirname, 'components/dashboard/shared/KPICard.tsx');
const kpiCardContent = fs.readFileSync(kpiCardPath, 'utf8');

assert(
  machineKPIStripContent.includes('isLoading?: boolean') &&
  machineKPIStripContent.includes('isLoading={isLoading}'),
  'MachineKPIStrip supports progressive isLoading prop on all 4 KPI cards'
);

assert(
  kpiCardContent.includes('isLoading ? (') &&
  kpiCardContent.includes('<Skeleton'),
  'KPICard renders lightweight Skeleton for metric value while preserving card structure'
);

assert(
  machinesScreenContent.includes('<MachineKPIStrip stats={kpis} isLoading={isKPIsLoading} />'),
  'machines.tsx renders static KPI strip instantly at 0ms with progressive value skeletons'
);

// 14. Server-Side Infinite Pagination & End-of-List Status
assert(
  machinesScreenContent.includes('onEndReached={handleEndReached}') &&
  machinesScreenContent.includes('onEndReachedThreshold={0.5}') &&
  machinesScreenContent.includes('isFetchingNextPage') &&
  machinesScreenContent.includes('All {totalCount} machines loaded'),
  'machines.tsx implements server-side chunked pagination with onEndReached and end-of-list status'
);

// 15. Flicker-Free Search & TanStack Query keepPreviousData
assert(
  useMachinesDataContent.includes('placeholderData: keepPreviousData') &&
  useMachinesDataContent.includes('keepPreviousData'),
  'useMachinesData.ts configures placeholderData: keepPreviousData for seamless search/filter transitions'
);

// 16. Deterministic Secondary Tie-Breaker Ordering
assert(
  useMachinesDataContent.includes(".order('id', { ascending: true })"),
  'useMachinesData.ts enforces deterministic secondary tie-breaker .order(id) on all sorting paths'
);

// 17. User Hydration Cache (Zero N+1 Roundtrips)
assert(
  useMachinesDataContent.includes('knownUsersCache') &&
  useMachinesDataContent.includes('knownUsersCache.get(') &&
  useMachinesDataContent.includes('knownUsersCache.set('),
  'useMachinesData.ts caches hydrated users across chunks to eliminate N+1 user roundtrips'
);

// 18. MobileMachineCard Pure Memoization & Callback Isolation
const mobileMachineCardPath = path.join(__dirname, 'components/machines/MobileMachineCard.tsx');
const mobileMachineCardContent = fs.readFileSync(mobileMachineCardPath, 'utf8');

assert(
  mobileMachineCardContent.includes('React.memo(') &&
  mobileMachineCardContent.includes('prevProps.machine') &&
  machinesScreenContent.includes('handleViewDetails') &&
  machinesScreenContent.includes('handleViewHistory') &&
  machinesScreenContent.includes('handleEdit') &&
  machinesScreenContent.includes('handleDelete'),
  'MobileMachineCard is wrapped in React.memo with custom equality check and stable callback references'
);

// 19. Role-Scoped Deep Link Authorization Gate
assert(
  machinesScreenContent.includes('handledDeepLinkRef') &&
  machinesScreenContent.includes('operatorView') &&
  useMachinesDataContent.includes('get_operator_assigned_machines') &&
  machinesScreenContent.includes("toast('warning', 'Access Restricted'"),
  'machines.tsx guards deep-link machine resolution with role capability + assigned-machine RPC'
);

// 20. Zero SELECT * on Clients in MachineDetailView
const machineDetailViewPath = path.join(__dirname, 'components/machines/MachineDetailView.tsx');
const machineDetailViewContent = fs.readFileSync(machineDetailViewPath, 'utf8');

assert(
  !machineDetailViewContent.includes(".from('clients')\n      .select('*')") &&
  !machineDetailViewContent.includes(".from('clients').select('*')") &&
  machineDetailViewContent.includes("company_name,") &&
  machineDetailViewContent.includes("contact_person,"),
  'MachineDetailView enforces explicit column projections with zero select(*) on clients'
);

// 21. Bounded HMR History Query
assert(
  machineDetailViewContent.includes(".from('machine_hour_logs')") &&
  machineDetailViewContent.includes('.limit(100)') &&
  machineDetailViewContent.includes(".order('id', { ascending: false })"),
  'MachineDetailView bounds machine_hour_logs queries with deterministic ordering and limit(100)'
);

// 22. Stable Card Preservation During Search / Refresh
assert(
  machinesScreenContent.includes('data={isLoading && machines.length === 0 ? [] : machines}') &&
  machinesScreenContent.includes('(isLoading || isSearching) && machines.length === 0'),
  'machines.tsx preserves rendered cards during background search and refetches without skeleton flicker'
);

console.log(`\nResults: ${passCount} Passed, ${failCount} Failed.`);

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('✅ Machine Workflows & UI States Verification Passed: 100% compliant!\n');
  process.exit(0);
}
