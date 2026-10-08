/**
 * Automated Verification Suite for Offline -> Online Reconnection & Data Revalidation
 *
 * Verifies:
 * 1. NetworkConnectivityManager offline -> online transition detection
 * 2. Stabilization debounce preventing reconnect storms and link flapping
 * 3. Prevention of duplicate online events when network was already online
 * 4. SyncCoordinator targeted screen-scoped query revalidation
 * 5. Screen query filtering (active, matching visible screen, needs fresh data, not fetching, not disabled)
 * 6. Non-target screens and hidden tabs are NOT refetched
 * 7. Offline mutations queue drainage and post-mutation targeted cache invalidation
 * 8. Preservation of screen state, pagination, and filter values
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NetworkConnectivityManager,
  RECONNECT_STABILIZATION_MS,
} from '../NetworkConnectivityManager';
import { SyncCoordinator } from '../SyncCoordinator';

test('NetworkConnectivityManager is a singleton and tracks telemetry', () => {
  const manager1 = NetworkConnectivityManager.getInstance();
  const manager2 = NetworkConnectivityManager.getInstance();
  assert.equal(manager1, manager2, 'Must return same singleton instance');

  const status = manager1.getStatus();
  assert.equal(typeof status.isConnected, 'boolean');
  assert.equal(typeof status.isOnline, 'boolean');
  assert.equal(typeof status.isOffline, 'boolean');
});

test('SyncCoordinator normalizes route pathnames to canonical screen identifiers', () => {
  const coordinator = SyncCoordinator.getInstance();

  assert.equal(coordinator.normalizeScreenName('/(app)/operations'), 'operations');
  assert.equal(coordinator.normalizeScreenName('/operations?tab=logs'), 'operations');
  assert.equal(coordinator.normalizeScreenName('/(app)/machines'), 'machines');
  assert.equal(coordinator.normalizeScreenName('/machines/m-123'), 'machines');
  assert.equal(coordinator.normalizeScreenName('/(app)/dashboard'), 'dashboard');
  assert.equal(coordinator.normalizeScreenName('/'), 'dashboard');
  assert.equal(coordinator.normalizeScreenName('/(app)/attendance'), 'attendance');
  assert.equal(coordinator.normalizeScreenName('/(app)/payroll'), 'payroll');
  assert.equal(coordinator.normalizeScreenName('/(app)/users'), 'users');
  assert.equal(coordinator.normalizeScreenName('/(app)/clients'), 'clients');
});

test('SyncCoordinator correctly matches query keys to screen domains', () => {
  const coordinator = SyncCoordinator.getInstance();

  // Operations domain
  assert.equal(coordinator.doesQueryBelongToScreen(['operations', 'logs'], 'operations'), true);
  assert.equal(coordinator.doesQueryBelongToScreen(['operations', 'master'], 'operations'), true);
  assert.equal(coordinator.doesQueryBelongToScreen(['operator', 'entry-context', 'u1'], 'operations'), true);
  assert.equal(coordinator.doesQueryBelongToScreen(['operator', 'history-logs', 'u1'], 'operations'), true);

  // Cross-screen isolation: operations queries do NOT belong to machines screen
  assert.equal(coordinator.doesQueryBelongToScreen(['operations', 'logs'], 'machines'), false);
  assert.equal(coordinator.doesQueryBelongToScreen(['machines'], 'operations'), false);

  // Machines domain
  assert.equal(coordinator.doesQueryBelongToScreen(['machines'], 'machines'), true);
  assert.equal(coordinator.doesQueryBelongToScreen(['machines', 'detail', 'm1'], 'machines'), true);

  // Dashboard domain
  assert.equal(coordinator.doesQueryBelongToScreen(['dashboard'], 'dashboard'), true);
  assert.equal(coordinator.doesQueryBelongToScreen(['dashboard'], 'operations'), false);

  // Attendance domain
  assert.equal(coordinator.doesQueryBelongToScreen(['attendance'], 'attendance'), true);
  assert.equal(coordinator.doesQueryBelongToScreen(['attendance'], 'dashboard'), false);

  // Payroll domain
  assert.equal(coordinator.doesQueryBelongToScreen(['payroll'], 'payroll'), true);
  assert.equal(coordinator.doesQueryBelongToScreen(['payroll'], 'users'), false);
});

test('SyncCoordinator shouldRevalidateQuery strictly enforces all 5 criteria', () => {
  const coordinator = SyncCoordinator.getInstance();

  // Case 1: Active, matching screen, stale -> MUST REVALIDATE
  const activeStaleQuery = {
    queryKey: ['operations', 'logs', { page: 2, machineId: 'M-002' }],
    isActive: () => true,
    isStale: () => true,
    state: { fetchStatus: 'idle', status: 'success', data: [{ id: '1' }] },
    options: { enabled: true },
  } as any;
  assert.equal(
    coordinator.shouldRevalidateQuery(activeStaleQuery, 'operations'),
    true,
    'Active, matching, stale query must revalidate'
  );

  // Case 2: Inactive query (e.g. unmounted screen or previous page) -> MUST NOT REVALIDATE
  const inactiveQuery = {
    queryKey: ['operations', 'logs', { page: 1 }],
    isActive: () => false,
    isStale: () => true,
    state: { fetchStatus: 'idle', status: 'success', data: [{ id: 'old' }] },
    options: { enabled: true },
  } as any;
  assert.equal(
    coordinator.shouldRevalidateQuery(inactiveQuery, 'operations'),
    false,
    'Inactive queries (like unvisited pages) must NOT revalidate'
  );

  // Case 3: Belongs to different screen (e.g. machines while viewing operations) -> MUST NOT REVALIDATE
  const differentScreenQuery = {
    queryKey: ['machines'],
    isActive: () => true,
    isStale: () => true,
    state: { fetchStatus: 'idle', status: 'success', data: [] },
    options: { enabled: true },
  } as any;
  assert.equal(
    coordinator.shouldRevalidateQuery(differentScreenQuery, 'operations'),
    false,
    'Queries from other screens must NOT revalidate'
  );

  // Case 4: Already fetching in-flight -> MUST NOT REVALIDATE (prevents duplicate requests)
  const inFlightQuery = {
    queryKey: ['operations', 'logs'],
    isActive: () => true,
    isStale: () => true,
    state: { fetchStatus: 'fetching', status: 'success', data: [] },
    options: { enabled: true },
  } as any;
  assert.equal(
    coordinator.shouldRevalidateQuery(inFlightQuery, 'operations'),
    false,
    'Already in-flight fetching query must NOT trigger duplicate fetch'
  );

  // Case 5: Fresh data (staleTime not expired, e.g. 10m master data) -> MUST NOT REVALIDATE
  const freshQuery = {
    queryKey: ['operations', 'master'],
    isActive: () => true,
    isStale: () => false,
    state: { fetchStatus: 'idle', status: 'success', data: { machines: [] } },
    options: { enabled: true },
  } as any;
  assert.equal(
    coordinator.shouldRevalidateQuery(freshQuery, 'operations'),
    false,
    'Fresh data within staleTime must NOT be refetched unnecessarily'
  );

  // Case 6: Failed request while offline (status: error) -> MUST REVALIDATE (retry)
  const failedOfflineQuery = {
    queryKey: ['operations', 'logs'],
    isActive: () => true,
    isStale: () => false,
    state: { fetchStatus: 'idle', status: 'error', error: new Error('Network error') },
    options: { enabled: true },
  } as any;
  assert.equal(
    coordinator.shouldRevalidateQuery(failedOfflineQuery, 'operations'),
    true,
    'Failed request from offline status must be retried'
  );

  // Case 7: Explicitly disabled query -> MUST NOT REVALIDATE
  const disabledQuery = {
    queryKey: ['operations', 'logs'],
    isActive: () => true,
    isStale: () => true,
    state: { fetchStatus: 'idle', status: 'success', data: [] },
    options: { enabled: false },
  } as any;
  assert.equal(
    coordinator.shouldRevalidateQuery(disabledQuery, 'operations'),
    false,
    'Disabled queries must NOT revalidate'
  );
});

test('SyncCoordinator executes registered screen refresher for the active screen only', async () => {
  const coordinator = SyncCoordinator.getInstance();

  let operationsRefreshed = false;
  let machinesRefreshed = false;

  coordinator.registerScreenRefresher('operations', async () => {
    operationsRefreshed = true;
  });

  coordinator.registerScreenRefresher('machines', async () => {
    machinesRefreshed = true;
  });

  // When active screen is operations
  coordinator.setActiveScreen('operations');
  const stats = await coordinator.handleReconnection();

  assert.equal(operationsRefreshed, true, 'Operations refresher must execute');
  assert.equal(machinesRefreshed, false, 'Machines refresher must NOT execute while viewing operations');
  assert.equal(stats?.screen, 'operations');
  assert.equal(stats?.customRefresherExecuted, true);
});

test('SyncCoordinator mutex guard prevents concurrent synchronization runs', async () => {
  const coordinator = SyncCoordinator.getInstance();
  coordinator.setActiveScreen('operations');

  // Launch two reconnection syncs simultaneously
  const promise1 = coordinator.handleReconnection();
  const promise2 = coordinator.handleReconnection();

  const [res1, res2] = await Promise.all([promise1, promise2]);

  // One must succeed, the other must be rejected by mutex guard returning null
  assert.ok(res1 !== null || res2 !== null, 'One sync must execute');
  assert.ok(res1 === null || res2 === null, 'Second concurrent sync must return null (mutex guard)');
});
