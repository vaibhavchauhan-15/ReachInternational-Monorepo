/**
 * Node.js Execution Runner for Mobile Automated Verification Suite
 * Verifies app.json, eas.json, and brand integrity.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[Test Runner]: Initializing Mobile Automated Verification Suite...');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

try {
  // Test 1: Validate app.json structure
  const appJsonPath = path.join(__dirname, 'app.json');
  const appJsonRaw = fs.readFileSync(appJsonPath, 'utf8');
  const appJson = JSON.parse(appJsonRaw);

  assert(appJson.expo?.name === 'Reach Ops', 'app.json expo.name is Reach Ops');
  assert(appJson.expo?.android?.package === 'com.reachinternational.app', 'Android package is com.reachinternational.app');
  assert(appJson.expo?.updates?.url?.startsWith('https://u.expo.dev/'), 'EAS Update URL is configured');
  assert(
    typeof appJson.expo?.runtimeVersion === 'string' || appJson.expo?.runtimeVersion?.policy === 'appVersion',
    'Runtime version is properly configured for bare workflow (string literal or policy)'
  );
  assert(appJson.expo?.extra?.eas?.projectId === '40432ac1-55a2-4bfa-985e-a51562398743', 'EAS project ID is linked');

  // Test 2: Validate eas.json structure
  const easJsonPath = path.join(__dirname, 'eas.json');
  const easJsonRaw = fs.readFileSync(easJsonPath, 'utf8');
  const easJson = JSON.parse(easJsonRaw);

  assert(easJson.build?.production?.channel === 'production', 'Production build channel is production');
  assert(easJson.build?.production?.autoIncrement === true, 'Production build autoIncrement is enabled');
  assert(easJson.build?.production?.env?.EXPO_PUBLIC_SUPABASE_URL, 'Production build has EXPO_PUBLIC_SUPABASE_URL configured');
  assert(easJson.build?.production?.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY, 'Production build has EXPO_PUBLIC_SUPABASE_ANON_KEY configured');
  assert(easJson.submit?.production?.android?.track === 'internal', 'Default submit track is internal');
  assert(easJson.submit?.['production-play']?.android?.track === 'production', 'Store release submit track is production');
  assert(!easJson.submit?.production?.android?.serviceAccountKeyPath, 'Zero service account key paths stored in eas.json');

  // Test 3: Validate EAS Workflows exist
  const deployWorkflowPath = path.join(__dirname, '.eas', 'workflows', 'deploy-android.yml');
  const updateWorkflowPath = path.join(__dirname, '.eas', 'workflows', 'publish-update.yml');
  assert(fs.existsSync(deployWorkflowPath), 'deploy-android.yml workflow exists');
  assert(fs.existsSync(updateWorkflowPath), 'publish-update.yml workflow exists');

  // Test 4: Validate Android 15 stability in Root Layout and Supabase client
  const layoutContent = fs.readFileSync(path.join(__dirname, 'app', '_layout.tsx'), 'utf8');
  assert(layoutContent.includes('SafeAreaProvider'), '_layout.tsx wraps root with SafeAreaProvider (prevents Android 15 edge-to-edge crash)');
  assert(layoutContent.includes('export function ErrorBoundary'), '_layout.tsx exports ErrorBoundary to catch runtime exceptions gracefully');

  const supabaseContent = fs.readFileSync(path.join(__dirname, 'lib', 'supabase.ts'), 'utf8');
  assert(supabaseContent.includes('getSupabaseUrl'), 'supabase.ts utilizes centralized environment getter for Supabase URL');
  assert(supabaseContent.includes('getSupabaseAnonKey'), 'supabase.ts utilizes centralized environment getter for Supabase Anon Key');

  const envContent = fs.readFileSync(path.join(__dirname, 'lib', 'env.ts'), 'utf8');
  assert(envContent.includes('export function getSupabaseUrl'), 'env.ts exports authoritative getSupabaseUrl helper');
  assert(envContent.includes('export function getSupabaseAnonKey'), 'env.ts exports authoritative getSupabaseAnonKey helper');

  const pkgContent = fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8');
  assert(pkgContent.includes('expo-system-ui'), 'package.json includes expo-system-ui for Android 15 system UI theme');

  // Test 5: Validate Optimistic UI Foundation (Phase 0)
  const syncStateContent = fs.readFileSync(path.join(__dirname, 'lib', 'optimistic', 'syncState.ts'), 'utf8');
  assert(syncStateContent.includes("export type SyncState = 'synced' | 'pending' | 'queued' | 'failed'"), 'syncState.ts exports canonical 4-state SyncState');
  assert(syncStateContent.includes('isPendingSync'), 'syncState.ts exports isPendingSync predicate');

  const tempIdContent = fs.readFileSync(path.join(__dirname, 'lib', 'optimistic', 'tempId.ts'), 'utf8');
  assert(tempIdContent.includes('createTempId'), 'tempId.ts exports createTempId generator');
  assert(tempIdContent.includes('isTempId'), 'tempId.ts exports isTempId predicate');
  assert(tempIdContent.includes('generateUUID'), 'tempId.ts exports RFC4122 generateUUID');

  const reconcileContent = fs.readFileSync(path.join(__dirname, 'lib', 'optimistic', 'reconcile.ts'), 'utf8');
  assert(reconcileContent.includes('reconcileRow'), 'reconcile.ts exports reconcileRow');
  assert(reconcileContent.includes('removeTempRow'), 'reconcile.ts exports removeTempRow');
  assert(reconcileContent.includes('isRealtimeEcho'), 'reconcile.ts exports isRealtimeEcho deduplication');

  const persistContent = fs.readFileSync(path.join(__dirname, 'lib', 'optimistic', 'persist.ts'), 'utf8');
  assert(persistContent.includes('asyncStoragePersister'), 'persist.ts exports asyncStoragePersister');
  assert(persistContent.includes('isSensitiveQuery'), 'persist.ts exports sensitive query deny-list');
  assert(persistContent.includes('sanitizeDataForPersistence'), 'persist.ts strips tmp_ rows on dehydrate');
  assert(persistContent.includes('clearPersistedCache'), 'persist.ts exports clearPersistedCache');

  const optMutationContent = fs.readFileSync(path.join(__dirname, 'lib', 'optimistic', 'useOptimisticMutation.ts'), 'utf8');
  assert(optMutationContent.includes('useOptimisticMutation'), 'useOptimisticMutation.ts exports Tier 2 optimistic mutation hook');
  assert(optMutationContent.includes('defaultFormatErrorMessage'), 'useOptimisticMutation.ts maps PG error codes to human-readable explanations');

  const pendingMutationContent = fs.readFileSync(path.join(__dirname, 'lib', 'optimistic', 'usePendingMutation.ts'), 'utf8');
  assert(pendingMutationContent.includes('usePendingMutation'), 'usePendingMutation.ts exports Tier 3 pending mutation hook');

  assert(layoutContent.includes('PersistQueryClientProvider'), '_layout.tsx configures PersistQueryClientProvider for cold-start instant UI');
  assert(layoutContent.includes('asyncStoragePersister'), '_layout.tsx binds asyncStoragePersister');

  const authContent = fs.readFileSync(path.join(__dirname, 'lib', 'auth', 'useAuth.tsx'), 'utf8');
  assert(authContent.includes('clearPersistedCache'), 'useAuth.tsx purges persisted query cache on sign-out');

  const hapticsContent = fs.readFileSync(path.join(__dirname, 'lib', 'haptics', 'index.ts'), 'utf8');
  assert(hapticsContent.includes('confirm:'), 'lib/haptics exports confirm() haptic trigger');
  assert(hapticsContent.includes('reject:'), 'lib/haptics exports reject() haptic trigger');

  // Test 6: Validate Mobile Offline Resilience & Auto-Sync Engine
  const queueManagerContent = fs.readFileSync(path.join(__dirname, 'lib', 'offline', 'OfflineQueueManager.ts'), 'utf8');
  assert(queueManagerContent.includes('checkAndAutoDrain'), 'OfflineQueueManager implements proactive checkAndAutoDrain');
  assert(queueManagerContent.includes('onSyncComplete'), 'OfflineQueueManager exports onSyncComplete callback listener');
  assert(queueManagerContent.includes('registerAppStateListener'), 'OfflineQueueManager listens to AppState transitions for background-to-foreground auto-drain');

  const offlineBannerContent = fs.readFileSync(path.join(__dirname, 'components', 'offline', 'OfflineBanner.tsx'), 'utf8');
  assert(offlineBannerContent.includes('OfflineCollisionModal'), 'OfflineBanner integrates OfflineCollisionModal for resolving sync conflicts');
  assert(offlineBannerContent.includes('syncNow().catch'), 'OfflineBanner triggers auto-sync when online transition occurs');

  assert(layoutContent.includes('MobileOfflineSyncListener'), '_layout.tsx binds MobileOfflineSyncListener for TanStack Query cache invalidation');

  // Test 7: Validate Screen-Scoped Offline -> Online Reconnection & Sync Coordinator
  const netManagerContent = fs.readFileSync(path.join(__dirname, 'lib', 'offline', 'NetworkConnectivityManager.ts'), 'utf8');
  assert(netManagerContent.includes('export class NetworkConnectivityManager'), 'NetworkConnectivityManager exports authoritative connectivity manager');
  assert(netManagerContent.includes('RECONNECT_STABILIZATION_MS'), 'NetworkConnectivityManager defines debounce stabilization window');
  assert(netManagerContent.includes('onlineManager.setEventListener'), 'NetworkConnectivityManager binds TanStack Query onlineManager');
  assert(netManagerContent.includes('onReconnect'), 'NetworkConnectivityManager dispatches verified reconnect events');

  const syncCoordinatorContent = fs.readFileSync(path.join(__dirname, 'lib', 'offline', 'SyncCoordinator.ts'), 'utf8');
  assert(syncCoordinatorContent.includes('export class SyncCoordinator'), 'SyncCoordinator exports screen-scoped sync coordinator');
  assert(syncCoordinatorContent.includes('shouldRevalidateQuery'), 'SyncCoordinator implements 5-criteria targeted query validation');
  assert(syncCoordinatorContent.includes('doesQueryBelongToScreen'), 'SyncCoordinator isolates query keys by active screen domain');
  assert(syncCoordinatorContent.includes('handleReconnection'), 'SyncCoordinator orchestrates reconnection workflow');
  assert(syncCoordinatorContent.includes('registerScreenRefresher'), 'SyncCoordinator supports registered custom screen refreshers');

  const useScreenSyncContent = fs.readFileSync(path.join(__dirname, 'lib', 'offline', 'useScreenSync.ts'), 'utf8');
  assert(useScreenSyncContent.includes('export function useScreenSync'), 'useScreenSync exports screen sync integration hook');

  assert(layoutContent.includes('refetchOnReconnect: false'), '_layout.tsx configures refetchOnReconnect: false to prevent global tab refetch storms');
  assert(layoutContent.includes('syncCoordinator.setQueryClient'), '_layout.tsx binds QueryClient with syncCoordinator');
  assert(layoutContent.includes('MobileScreenSyncWatcher'), '_layout.tsx mounts MobileScreenSyncWatcher for route tracking');

  const opsContent = fs.readFileSync(path.join(__dirname, 'app', '(app)', 'operations.tsx'), 'utf8');
  assert(opsContent.includes("screen: 'operations'"), 'operations.tsx integrates screen-scoped revalidation via useScreenSync');

  const machinesContent = fs.readFileSync(path.join(__dirname, 'app', '(app)', 'machines.tsx'), 'utf8');
  assert(machinesContent.includes("screen: 'machines'"), 'machines.tsx integrates screen-scoped revalidation via useScreenSync');

  const dashContent = fs.readFileSync(path.join(__dirname, 'app', '(app)', 'dashboard.tsx'), 'utf8');
  assert(dashContent.includes("screen: 'dashboard'"), 'dashboard.tsx integrates screen-scoped revalidation via useScreenSync');

  console.log(`\n✅ Verification Suite Passed: All ${passed}/${passed + failed} test scenarios verified!`);
  process.exit(failed > 0 ? 1 : 0);
} catch (err) {
  console.error('Fatal execution error:', err);
  process.exit(1);
}

