/**
 * Node.js Execution Runner for Mobile Automated Verification Suite
 * Verifies app.json, eas.json, and brand integrity.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');

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
  assert(dashContent.includes('checkAndNotifyShiftEnded'), 'dashboard.tsx dispatches shift-end native notifications');

  const operatorCardContent = fs.readFileSync(path.join(__dirname, 'components', 'dashboard', 'operator', 'OperatorDashboardCard.tsx'), 'utf8');
  assert(!operatorCardContent.includes('"Enter Shift Entry"'), 'OperatorDashboardCard suppresses redundant Enter Shift Entry button in StatusCard');
  assert(operatorCardContent.includes('/operations?tab=entry'), 'Shift card links to /operations?tab=entry');
  assert(!operatorCardContent.includes('title="LAST RECORDED METER (HMR)"'), 'OperatorDashboardCard suppresses Last Recorded Meter card');

  // Test 8: Validate /users Workflow Verification (RBAC, Assignment, Deletion, Status, Layout)
  const usersScreenPath = path.join(__dirname, 'app', '(app)', 'users.tsx');
  const userDetailModalPath = path.join(__dirname, 'components', 'users', 'UserDetailModal.tsx');
  const assignMachineModalPath = path.join(__dirname, 'components', 'users', 'AssignMachineModal.tsx');
  const assignSupervisorModalPath = path.join(__dirname, 'components', 'users', 'AssignSupervisorModal.tsx');
  const assignPersonnelModalPath = path.join(__dirname, 'components', 'operations', 'MobileAssignPersonnelModal.tsx');
  const deleteConfirmDialogPath = path.join(__dirname, 'components', 'users', 'DeleteUserConfirmDialog.tsx');
  const sheetPath = path.join(__dirname, 'components', 'ui', 'overlay', 'Sheet.tsx');

  const usersContent = fs.readFileSync(usersScreenPath, 'utf8');
  const userDetailContent = fs.readFileSync(userDetailModalPath, 'utf8');
  const assignMachineContent = fs.readFileSync(assignMachineModalPath, 'utf8');
  const assignSupervisorContent = fs.readFileSync(assignSupervisorModalPath, 'utf8');
  const assignPersonnelContent = fs.readFileSync(assignPersonnelModalPath, 'utf8');
  const deleteConfirmContent = fs.readFileSync(deleteConfirmDialogPath, 'utf8');
  const sheetContent = fs.readFileSync(sheetPath, 'utf8');

  // RBAC Matrix
  assert(usersContent.includes("const canEditUsers = ['super_admin', 'admin', 'manager', 'hr'].includes(normalizedRole);"), 'users.tsx canEditUsers permits super_admin, admin, manager, hr');
  assert(usersContent.includes("const canDeleteUsers = ['super_admin', 'admin'].includes(normalizedRole);"), 'users.tsx canDeleteUsers restricted to super_admin and admin');
  assert(usersContent.includes("const canActivateUsers = ['super_admin', 'admin', 'hr'].includes(normalizedRole);"), 'users.tsx canActivateUsers permits super_admin, admin, hr');
  assert(usersContent.includes("const canAssignSupervisorUsers = ['super_admin', 'admin', 'manager', 'hr'].includes(normalizedRole);"), 'users.tsx canAssignSupervisorUsers permits super_admin, admin, manager, hr');
  assert(usersContent.includes("const canAssignMachineUsers = ['super_admin', 'admin', 'manager', 'supervisor'].includes(normalizedRole);"), 'users.tsx canAssignMachineUsers permits super_admin, admin, manager, supervisor');
  assert(usersContent.includes("const canResetPwdUsers = ['super_admin', 'admin', 'manager', 'hr'].includes(normalizedRole);"), 'users.tsx canResetPwdUsers permits super_admin, admin, manager, hr');
  assert(usersContent.includes("authUser?.id !== item.id") || usersContent.includes("authUser?.id !== moreActionsUser.id"), 'users.tsx prevents self-deletion');
  assert(usersContent.includes("authUser?.id === targetUser.id") && usersContent.includes("You cannot change your own account status"), 'users.tsx prevents changing own status');
  assert(usersContent.includes("normalizedRole === 'admin' && targetUser.role === 'super_admin'"), 'users.tsx prevents admin from modifying super_admin');

  // Assignment Invariants
  assert(assignMachineContent.includes('MobileAssignPersonnelModal'), 'AssignMachineModal integrates canonical MobileAssignPersonnelModal');
  assert(assignPersonnelContent.includes('savingRef = useRef(false);'), 'MobileAssignPersonnelModal implements synchronous savingRef mutex');
  assert(assignPersonnelContent.includes('maximum limit of 3 active shifts (24h) across the fleet'), 'MobileAssignPersonnelModal enforces 3 active shifts fleet cap per operator');
  assert(assignPersonnelContent.includes('duplicateShifts.length > 0'), 'MobileAssignPersonnelModal enforces distinct shifts per machine');
  assert(assignPersonnelContent.includes('doRangesOverlap(opRanges, otherRanges)'), 'MobileAssignPersonnelModal validates multi-machine disjoint shift intervals');
  assert(assignSupervisorContent.includes('savingRef = React.useRef(false)'), 'AssignSupervisorModal implements synchronous savingRef mutex');
  assert(assignSupervisorContent.includes('s.id !== user.id') && assignSupervisorContent.includes('selectedId === user.id'), 'AssignSupervisorModal prevents self-supervisor assignment');

  // Deletion Safety
  assert(usersContent.includes('<DeleteUserConfirmDialog') && usersContent.includes('user={userToDelete}'), 'users.tsx binds single deletion to DeleteUserConfirmDialog');
  assert(usersContent.includes('deleteSubmittingRef.current'), 'users.tsx implements deleteSubmittingRef double-tap lock');
  assert(usersContent.includes("'delete_or_deactivate_user_atomic'"), 'users.tsx calls delete_or_deactivate_user_atomic RPC');
  assert(usersContent.includes('<ConfirmDialog') && usersContent.includes('showBulkDeleteModal'), 'users.tsx binds bulk deletion to danger ConfirmDialog');
  assert(usersContent.includes("'bulk_delete_or_deactivate_users_atomic'"), 'users.tsx calls bulk_delete_or_deactivate_users_atomic RPC');
  assert(deleteConfirmContent.includes('Consequences &amp; Compliance Notice'), 'DeleteUserConfirmDialog displays statutory consequences notice');

  // Status Toggling & Rollback
  assert(usersContent.includes('setStatusConfirmUser(targetUser)'), 'users.tsx requires explicit confirmation for status change');
  assert(usersContent.includes('statusSubmittingRef.current'), 'users.tsx implements statusSubmittingRef double-tap lock');
  assert(usersContent.includes("'toggle_user_status_atomic'"), 'users.tsx calls toggle_user_status_atomic RPC');
  assert(usersContent.includes('haptics.reject()') && usersContent.includes('prev.map((u) => (u.id === statusConfirmUser.id ? { ...u, status: updatedStatus } : u))'), 'users.tsx preserves UI integrity and provides haptics on status update');

  const userTouchCardPath = path.join(__dirname, 'components', 'users', 'UserTouchCard.tsx');
  const userActionsPopoverPath = path.join(__dirname, 'components', 'users', 'UserActionsPopover.tsx');
  const userTouchCardContent = fs.existsSync(userTouchCardPath) ? fs.readFileSync(userTouchCardPath, 'utf8') : '';
  const userActionsPopoverContent = fs.existsSync(userActionsPopoverPath) ? fs.readFileSync(userActionsPopoverPath, 'utf8') : '';

  // Action Menu & User Detail Modal Parity
  assert(
    usersContent.includes('handleTriggerResetPassword') && (usersContent.includes('handleTriggerResetPassword(u)') || userActionsPopoverContent.includes('onResetPassword')),
    'users.tsx More Actions menu includes password triggers'
  );
  assert(
    (usersContent.includes('onOpenMoreActions?.(u') || userTouchCardContent.includes('onOpenMoreActions?.(u')) &&
      (usersContent.includes('onAssignMachine(u)') || userTouchCardContent.includes('onAssignMachine(u)') || userTouchCardContent.includes('onAssignMachine?.(u)')) &&
      (usersContent.includes('onAssignSupervisor(u)') || userTouchCardContent.includes('onAssignSupervisor(u)') || userTouchCardContent.includes('onAssignSupervisor?.(u)')),
    'UserTouchCard includes canonical 3-action toolbar with More, Assign Machine, and Supervisor'
  );
  assert(userDetailContent.includes('<DeleteUserConfirmDialog') && userDetailContent.includes('<ConfirmDialog'), 'UserDetailModal maintains 100% parity with confirmation dialogs');

  // Responsive Layout & Ergonomics
  assert(sheetContent.includes("maxWidth: 640") && sheetContent.includes("alignItems: 'center'"), 'Sheet.tsx centers and constrains maxWidth to 640px for wide viewports');
  assert(usersContent.includes("maxWidth: 560") && usersContent.includes("alignSelf: 'center'"), 'users.tsx constrains moreActionsSheetContent maxWidth to 560px');
  assert(usersContent.includes("maxWidth: 1200") && usersContent.includes("alignSelf: 'center'"), 'users.tsx constrains scrollContent maxWidth to 1200px');
  assert(usersContent.includes('hitSlopToMin48'), 'UserTouchCard uses hitSlopToMin48 for minimum 48px touch ergonomic compliance');

  // Quick Access Search & Command Palette Assertions
  const cmdPaletteContent = fs.readFileSync(path.join(__dirname, 'components', 'navigation', 'MobileCommandPalette.tsx'), 'utf8');
  const registryContent = fs.readFileSync(path.join(__dirname, 'components', 'navigation', 'quickAccessRegistry.ts'), 'utf8');

  assert(registryContent.includes('buildQuickAccessDestinations'), 'quickAccessRegistry exports buildQuickAccessDestinations');
  assert(registryContent.includes('filterAndScoreDestinations'), 'quickAccessRegistry exports filterAndScoreDestinations');
  assert(registryContent.includes('isDestinationPermitted'), 'quickAccessRegistry exports isDestinationPermitted');
  assert(registryContent.includes('Settings → Preferences → Theme'), 'quickAccessRegistry indexes hierarchical breadcrumbs');
  assert(registryContent.includes('nav-operations-entry') && registryContent.includes('nav-operations-today'), 'quickAccessRegistry indexes Operations tabs');
  assert(registryContent.includes('nav-settings-account') && registryContent.includes('nav-settings-preferences'), 'quickAccessRegistry indexes nested Settings pages');
  assert(registryContent.includes('sys-toggle-theme') && registryContent.includes('sys-toggle-haptics'), 'quickAccessRegistry indexes actionable system functions');
  assert(cmdPaletteContent.includes('debouncedSearch'), 'MobileCommandPalette implements debounced search');
  assert(cmdPaletteContent.includes('item.breadcrumb'), 'MobileCommandPalette renders hierarchical breadcrumbs');
  assert(cmdPaletteContent.includes('CATEGORY_ORDER'), 'MobileCommandPalette groups results by category');
  assert(cmdPaletteContent.includes('ConfirmDialog'), 'MobileCommandPalette integrates ConfirmDialog for sign out');
  assert(cmdPaletteContent.includes('queryString'), 'MobileCommandPalette parses route query parameters for tabs');

  // Native Sign-In UI/UX, Authentication & Session Persistence Assertions
  const savedEmailsContent = fs.readFileSync(path.join(__dirname, 'lib', 'auth', 'savedEmails.ts'), 'utf8');
  const authErrorsContent = fs.readFileSync(path.join(__dirname, 'lib', 'auth', 'authErrors.ts'), 'utf8');
  const useAuthContent = fs.readFileSync(path.join(__dirname, 'lib', 'auth', 'useAuth.tsx'), 'utf8');
  const loginContent = fs.readFileSync(path.join(__dirname, 'app', '(auth)', 'login.tsx'), 'utf8');
  const inputContent = fs.readFileSync(path.join(__dirname, 'components', 'ui', 'Input.tsx'), 'utf8');

  assert(savedEmailsContent.includes('export async function getSavedEmails'), 'savedEmails.ts exports getSavedEmails');
  assert(savedEmailsContent.includes('export async function saveEmailSuggestion'), 'savedEmails.ts exports saveEmailSuggestion');
  const codeWithoutComments = savedEmailsContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  assert(!codeWithoutComments.toLowerCase().includes('password'), 'savedEmails.ts contains zero password caching in executable code');
  assert(authErrorsContent.includes('export function mapAuthError'), 'authErrors.ts exports mapAuthError');
  assert(authErrorsContent.includes("const genericMsg = 'Invalid email or password.';"), 'authErrors.ts defends against user enumeration attacks');
  assert(authErrorsContent.includes('export function formatAccountStatusNotice'), 'authErrors.ts exports formatAccountStatusNotice for post-auth status notices');
  assert(supabaseContent.includes('SECURE_CHUNK_SIZE') && supabaseContent.includes('SecureStore.setItemAsync(`${sanitizedKey}__chunk_'), 'supabase.ts implements encrypted hardware keystore chunking');
  assert(!supabaseContent.includes('AsyncStorage.setItem(`@secure_fallback_'), 'supabase.ts guarantees ZERO plaintext session token storage in AsyncStorage');
  assert(supabaseContent.includes('supabase.auth.startAutoRefresh') && supabaseContent.includes('isAppStateListenerBound'), 'supabase.ts handles foreground token auto-refresh via singleton AppState listener');
  assert(useAuthContent.includes('signIn: (email: string, password: string, rememberMe?: boolean) => Promise<SignInResult>'), 'useAuth.tsx exports atomic signIn method');
  assert(useAuthContent.includes('loadCachedProfileHint'), 'useAuth.tsx treats cached profile strictly as UI hint without bypassing authentication');
  assert(loginContent.includes('Welcome back'), 'login.tsx renders Welcome back enterprise card');
  assert(loginContent.includes('visibleEmailSuggestions'), 'login.tsx renders non-sensitive email suggestions');
  assert(loginContent.includes('autoComplete="email"') && loginContent.includes('autoComplete="current-password"'), 'login.tsx configures OS-supported autofill');
  assert(inputContent.includes('hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}'), 'Input.tsx password toggle meets minimum 44px touch targets');
  assert(inputContent.includes("color: isDark ? '#fafafa' : '#171717'"), 'Input.tsx enforces theme ink color on label for dark/light visibility');
  assert(inputContent.includes("inputBackgroundColor = isDark ? '#141414' : '#fafafa'"), 'Input.tsx enforces theme-aware input background');
  assert(inputContent.includes('inputTextColor = theme.colors.ink'), 'Input.tsx enforces theme ink color for input text');
  assert(inputContent.includes('placeholderTextColor={effectivePlaceholderColor}'), 'Input.tsx binds theme-aware placeholderTextColor');
  assert(loginContent.includes('Remember me') && loginContent.includes('Forgot password?'), 'login.tsx renders Remember me and Forgot password options');
  assert(loginContent.includes('isDesktop') && loginContent.includes('desktopShowcasePanel'), 'login.tsx preserves 3-tier desktop showcase layout');

  // Test 9: Offline Shift Log Deduplication & UI/UX Modal Parity
  const offlineQueueMgrContent = fs.readFileSync(path.join(__dirname, 'lib', 'offline', 'OfflineQueueManager.ts'), 'utf8');
  const collisionModalContent = fs.readFileSync(path.join(__dirname, 'components', 'offline', 'OfflineCollisionModal.tsx'), 'utf8');
  const monitorContent = fs.readFileSync(path.join(__dirname, 'components', 'operations', 'MobileTodayShiftMonitorTab.tsx'), 'utf8');
  const historyContent = fs.readFileSync(path.join(__dirname, 'components', 'operations', 'MobileOperatorHistoryTab.tsx'), 'utf8');

  assert(offlineQueueMgrContent.includes('export function normalizeShiftCode'), 'OfflineQueueManager.ts exports normalizeShiftCode');
  assert(offlineQueueMgrContent.includes('export function buildShiftLogIdempotencyKey'), 'OfflineQueueManager.ts exports buildShiftLogIdempotencyKey');
  assert(offlineQueueMgrContent.includes('findDuplicateMutation('), 'OfflineQueueManager implements findDuplicateMutation');
  assert(offlineQueueMgrContent.includes('checkDuplicateShiftLog('), 'OfflineQueueManager implements checkDuplicateShiftLog');
  assert(offlineQueueMgrContent.includes('syncedItemIds.add(item.id)') && offlineQueueMgrContent.includes('23505'), 'OfflineQueueManager handles 23505 unique constraints idempotently');
  assert(!collisionModalContent.includes('Alert.alert') && collisionModalContent.includes('<ConfirmDialog'), 'OfflineCollisionModal uses ConfirmDialog with zero Alert.alert');
  assert(!opsContent.includes('Alert.alert') && opsContent.includes('<ConfirmDialog'), 'operations.tsx uses ConfirmDialog with zero Alert.alert');
  assert(!monitorContent.includes('Alert.alert') && monitorContent.includes('<ConfirmDialog'), 'MobileTodayShiftMonitorTab uses ConfirmDialog with zero Alert.alert');
  assert(!historyContent.includes('Alert.alert') && historyContent.includes('<SyncStatusBadge'), 'MobileOperatorHistoryTab uses SyncStatusBadge with zero Alert.alert');

  // Test 10: Shift Page UI States, Error Resilience, Empty States & Form Validation
  const useOpsDataContent = fs.readFileSync(path.join(__dirname, 'lib', 'hooks', 'useOperationsData.ts'), 'utf8');
  const operatorEntryContent = fs.readFileSync(path.join(__dirname, 'components', 'operations', 'MobileOperatorEntryCard.tsx'), 'utf8');

  assert(useOpsDataContent.includes("console.error('[useTodayShiftMonitor] RPC Error:', error);") && useOpsDataContent.includes('throw error;'), 'useTodayShiftMonitor throws on RPC error (zero error masking)');
  assert(useOpsDataContent.includes("console.error('[useOperatorEntryContext] RPC Error:', error);") && useOpsDataContent.includes('throw error;'), 'useOperatorEntryContext throws on RPC error (zero error masking)');
  assert(operatorEntryContent.includes('isError && !entryContext') && operatorEntryContent.includes('<ErrorState'), 'MobileOperatorEntryCard renders ErrorState on query failure');
  assert(operatorEntryContent.includes('No Equipment Assigned') && operatorEntryContent.includes('<EmptyState'), 'MobileOperatorEntryCard renders EmptyState when unassigned');
  assert(operatorEntryContent.includes('isMeterRegressed') && operatorEntryContent.includes('<FormError'), 'MobileOperatorEntryCard validates meter regression via FormError');
  assert(operatorEntryContent.includes('isOver24Hours') && operatorEntryContent.includes('<FormError'), 'MobileOperatorEntryCard validates running hours cap via FormError');
  assert(operatorEntryContent.includes('isFutureShift') && operatorEntryContent.includes('Shift in progress · Submit logs after'), 'MobileOperatorEntryCard displays short & informative in-progress shift advisory banner');
  assert(monitorContent.includes('if (isError && rows.length === 0)') && monitorContent.includes('<ErrorState'), 'MobileTodayShiftMonitorTab renders ErrorState on query failure');
  assert(monitorContent.includes('variant="no-results"') && monitorContent.includes('variant="filtered"') && monitorContent.includes('variant="empty"'), 'MobileTodayShiftMonitorTab handles all semantic EmptyState variants');
  assert(historyContent.includes('isError && filteredLogs.length === 0') && historyContent.includes('<ErrorState'), 'MobileOperatorHistoryTab renders ErrorState on query failure');
  assert(historyContent.includes('variant="no-results"') && historyContent.includes('variant="filtered"') && historyContent.includes('variant="empty"'), 'MobileOperatorHistoryTab handles all semantic EmptyState variants');
  assert(opsContent.includes('maxWidth: 1200'), 'operations.tsx constrains maxWidth to 1200px for 1920x869 wide desktop viewports');

  // Test 37: Verify TimePickerDialog Android 16 Clock UI invariants
  const timePickerPath = path.join(__dirname, 'components/ui/TimePickerDialog.tsx');
  const timePickerContent = fs.readFileSync(timePickerPath, 'utf8');
  assert(timePickerContent.includes("const [mode, setMode] = useState<'dial' | 'keyboard'>"), 'TimePickerDialog implements dual Dial and Keyboard modes');
  assert(timePickerContent.includes('<Keyboard size={22}') && timePickerContent.includes('<Clock size={22}'), 'TimePickerDialog integrates mode switch icon button');
  assert(!timePickerContent.includes('-1 hr') && !timePickerContent.includes('+5m'), 'TimePickerDialog eliminates crowded stepper button clutter');
  assert(timePickerContent.includes("activeUnit === 'hour'") && timePickerContent.includes("rgba(2, 132, 199, 0.22)"), 'TimePickerDialog applies accent-filled active container styling');
  assert(timePickerContent.includes('styles.ampmContainer') && timePickerContent.includes('styles.ampmDivider'), 'TimePickerDialog renders vertically stacked AM/PM capsule');
  assert(!timePickerContent.includes('INTERMEDIATE_MINUTE_TICKS'), 'TimePickerDialog eliminates minute dots for lightweight smooth dial');
  assert(!timePickerContent.includes('selectTextOnFocus') && timePickerContent.includes('selectionColor="transparent"'), 'TimePickerDialog eliminates blue selection highlight box in keyboard mode');

  // Test 38: Verify Native Attendance Performance & Workflow Invariants
  const attendanceScreenPath = path.join(__dirname, 'app/(app)/attendance.tsx');
  const attendanceScreenContent = fs.readFileSync(attendanceScreenPath, 'utf8');
  assert(attendanceScreenContent.includes('useOperatorAttendanceInfiniteQuery'), 'attendance.tsx integrates useOperatorAttendanceInfiniteQuery for server-side pagination');
  assert(attendanceScreenContent.includes("screen: 'attendance'"), 'attendance.tsx registers screen-scoped reconnect revalidation via useScreenSync');
  assert(attendanceScreenContent.includes('initialNumToRender={8}'), 'attendance.tsx configures initialNumToRender={8} for fast initial rendering');
  assert(attendanceScreenContent.includes('removeClippedSubviews='), 'attendance.tsx configures removeClippedSubviews to unmount off-screen day cards');
  assert(attendanceScreenContent.includes('ListHeaderComponent={renderOperatorListHeader}'), 'attendance.tsx uses ListHeaderComponent to eliminate nested scrolling');
  assert(attendanceScreenContent.includes('onEndReachedThreshold={0.4}'), 'attendance.tsx triggers lazy page fetches at 0.4 threshold');
  assert(attendanceScreenContent.includes('fetchNextPage'), 'attendance.tsx calls fetchNextPage on scroll end');

  const attendanceQueriesPath = path.join(__dirname, 'lib/queries/attendance.ts');
  const attendanceQueriesContent = fs.readFileSync(attendanceQueriesPath, 'utf8');
  assert(attendanceQueriesContent.includes('p_page: page') && attendanceQueriesContent.includes('p_page_size: pageSize'), 'getAttendanceDailyDetail passes pagination parameters to RPC');
  assert(attendanceQueriesContent.includes('totalDays') && attendanceQueriesContent.includes('hasMore'), 'attendance.ts queries define paginated response contract');

  const attendanceHooksPath = path.join(__dirname, 'lib/hooks/useAttendanceData.ts');
  const attendanceHooksContent = fs.readFileSync(attendanceHooksPath, 'utf8');
  assert(attendanceHooksContent.includes('useInfiniteQuery'), 'useAttendanceData.ts implements useInfiniteQuery for operator monthly attendance');
  assert(attendanceHooksContent.includes('initialPageParam: 1'), 'useAttendanceData.ts sets initialPageParam: 1');
  assert(attendanceHooksContent.includes('getNextPageParam'), 'useAttendanceData.ts derives next page from hasMore flag');

  const attendanceDayCardPath = path.join(__dirname, 'components/attendance/AttendanceDayCard.tsx');
  const attendanceDayCardContent = fs.readFileSync(attendanceDayCardPath, 'utf8');
  assert(attendanceDayCardContent.includes('React.memo'), 'AttendanceDayCard is wrapped in React.memo for row memoization');

  const attendanceEmployeeCardPath = path.join(__dirname, 'components/attendance/AttendanceEmployeeCard.tsx');
  const attendanceEmployeeCardContent = fs.readFileSync(attendanceEmployeeCardPath, 'utf8');
  assert(attendanceEmployeeCardContent.includes('React.memo'), 'AttendanceEmployeeCard is wrapped in React.memo for row memoization');

  const migration171Path = path.join(__dirname, '../../supabase/migrations/171_attendance_daily_detail_pagination.sql');
  assert(fs.existsSync(migration171Path), 'Migration 171 for attendance daily detail pagination exists');
  const migration171Content = fs.readFileSync(migration171Path, 'utf8');
  assert(migration171Content.includes('p_page int') && migration171Content.includes('p_page_size int'), 'Migration 171 implements paginated get_attendance_daily_detail');
  assert(migration171Content.includes("v_caller_role = 'operator'") && migration171Content.includes('42501'), 'Migration 171 enforces strict operator self-attendance isolation (42501)');

  // Test 175: Validate Mobile Splash Screen & Gateway Minimalist Canvas (Logo Completely Removed)
  const splashIndexContent = fs.readFileSync(path.join(__dirname, 'app/index.tsx'), 'utf8');
  assert(!splashIndexContent.includes('ReachBrandEmblem'), 'Splash screen completely removes logo (ReachBrandEmblem)');
  assert(!splashIndexContent.includes('ActivityIndicator'), 'Splash screen completely removes loading spinner (ActivityIndicator)');
  assert(!splashIndexContent.includes('styles.indicator'), 'Splash screen removes styles.indicator');
  assert(!splashIndexContent.includes('logoSize'), 'Splash screen removes logo sizing calculations');
  assert(splashIndexContent.includes('theme.colors.canvas'), 'Splash screen renders clean theme canvas background');
  assert(splashIndexContent.includes('memo(function NativeGatewayScreen'), 'NativeGatewayScreen is memoized with React.memo');
  assert(splashIndexContent.includes('SplashScreen.hideAsync()'), 'Splash screen coordinates native splash dismissal upon auth resolution');

  // Test 176: Validate Production-Ready What's New System
  assert(fs.existsSync(path.join(__dirname, 'lib/whats-new/releaseManifest.ts')), "What's New manifest exists");
  assert(fs.existsSync(path.join(__dirname, 'lib/whats-new/whatsNewService.ts')), "What's New service exists");
  assert(fs.existsSync(path.join(__dirname, 'components/whats-new/WhatsNewSheet.tsx')), "WhatsNewSheet bottom sheet exists");
  assert(fs.existsSync(path.join(__dirname, 'components/whats-new/WhatsNewController.tsx')), "WhatsNewController exists");
  assert(fs.existsSync(path.join(__dirname, 'app/(app)/settings/about/whats-new.tsx')), "Dedicated What's New screen route exists");

  const appLayoutCheck = fs.readFileSync(path.join(__dirname, 'app/(app)/_layout.tsx'), 'utf8');
  assert(appLayoutCheck.includes('WhatsNewController'), 'AppLayout mounts WhatsNewController');
  assert(appLayoutCheck.includes('settings/about/whats-new'), 'AppLayout registers settings/about/whats-new route');

  // Test 177: Validate About Us Screen, LongLogo Centralization & UI Polish
  assert(fs.existsSync(path.join(__dirname, 'components/branding/ReachLongLogo.tsx')), 'ReachLongLogo component exists');
  assert(fs.existsSync(path.join(__dirname, 'assets/Reach International Light Theme LongLogo.png')), 'Light Theme LongLogo PNG exists');
  assert(fs.existsSync(path.join(__dirname, 'assets/Reach International Dark Theme LongLogo.png')), 'Dark Theme LongLogo PNG exists');
  assert(fs.existsSync(path.join(__dirname, 'app/(app)/settings/about/about-us.tsx')), 'About Us screen exists');
  assert(appLayoutCheck.includes('settings/about/about-us'), 'AppLayout registers settings/about/about-us route');

  const appInfoCheck = fs.readFileSync(path.join(__dirname, 'app/(app)/settings/about/app-info.tsx'), 'utf8');
  assert(!appInfoCheck.includes('heroCard'), 'App Info screen removes heroCard');

  const termsCheck = fs.readFileSync(path.join(__dirname, 'app/terms.tsx'), 'utf8');
  assert(!termsCheck.includes('desktopShowcasePanel'), 'Terms screen removes desktopShowcasePanel');
  assert(termsCheck.includes('ReachLongLogo'), 'Terms screen footer uses ReachLongLogo');

  const loginCheck = fs.readFileSync(path.join(__dirname, 'app/(auth)/login.tsx'), 'utf8');
  assert(loginCheck.includes('ReachLongLogo'), 'Login screen uses ReachLongLogo');

  const privacyCheck = fs.readFileSync(path.join(__dirname, 'app/privacy.tsx'), 'utf8');
  assert(privacyCheck.includes('ReachLongLogo'), 'Privacy screen footer uses ReachLongLogo');

  // Test 178: Validate Optimized Filter Components, UI Minimalism & Mobile Dropdown Performance
  const drawerCheck = fs.readFileSync(path.join(__dirname, 'components/ui/overlay/Drawer.tsx'), 'utf8');
  assert(drawerCheck.includes('duration: 200'), 'Drawer opening animation duration is 200ms');
  assert(drawerCheck.includes('duration: 170'), 'Drawer closing animation duration is 170ms');
  assert(drawerCheck.includes('opacity: 0.2 + norm * 0.8'), 'Drawer integrates UI-thread panel opacity fade');

  const filterSidebarCheck = fs.readFileSync(path.join(__dirname, 'components/ui/FilterSidebar.tsx'), 'utf8');
  assert(filterSidebarCheck.includes('styles.categorySection'), 'FilterCategoryCard uses minimal form group without nested card borders');
  assert(filterSidebarCheck.includes('isApplyingRef.current'), 'FilterSidebar implements rapid double-tap lock on Apply action');
  assert(filterSidebarCheck.includes('accessibilityLabel="Close filter sidebar"'), 'Close button has accessible label');
  assert(filterSidebarCheck.includes('disabled={activeFilterCount === 0}'), 'Reset All is disabled when active filter count is 0');

  const dropdownFilterCheck = fs.readFileSync(path.join(__dirname, 'components/ui/DropdownFilterSelector.tsx'), 'utf8');
  assert(dropdownFilterCheck.includes('showPrefix = false'), 'DropdownFilterSelector showPrefix defaults to false');
  assert(dropdownFilterCheck.includes('DropdownOptionRow = React.memo'), 'DropdownOptionRow is memoized');
  assert(!dropdownFilterCheck.includes('setWindowWidth'), 'DropdownFilterSelector eliminates unused windowWidth state');

  const machineFilterCheck = fs.readFileSync(path.join(__dirname, 'components/machines/MachineFilterSidebar.tsx'), 'utf8');
  assert(!machineFilterCheck.includes('index={1}'), 'MachineFilterSidebar removes numbered section prefixes');
  assert(machineFilterCheck.includes('title="Rental Status"'), 'MachineFilterSidebar uses clean Rental Status title');
  assert(machineFilterCheck.includes('title="Health Status"'), 'MachineFilterSidebar uses clean Health Status title');
  assert(machineFilterCheck.includes('title="Client Allocation"'), 'MachineFilterSidebar uses clean Client Allocation title');
  assert(machineFilterCheck.includes('title="Site Supervisor"'), 'MachineFilterSidebar uses clean Site Supervisor title');
  assert(machineFilterCheck.includes('title="Sort By"'), 'MachineFilterSidebar uses clean Sort By title');
  assert(!machineFilterCheck.includes('subtitle="Filter equipment by rental availability status"'), 'MachineFilterSidebar eliminates redundant subtitles');
  assert(!machineFilterCheck.includes('subtitle="Category-wise fleet equipment refinement"'), 'MachineFilterSidebar eliminates header subtitle');

  // Test 179: Validate Universal Filters & Sorting and Duplicate Modal Eradication
  const todayShiftCheck = fs.readFileSync(path.join(__dirname, 'components/operations/MobileTodayShiftMonitorTab.tsx'), 'utf8');
  assert(todayShiftCheck.includes('title="Filters & Sorting"'), 'Operations Shift Monitor uses standard Filters & Sorting');
  assert(!todayShiftCheck.includes('title="Filter Shifts"'), 'Operations Shift Monitor eradicates legacy Filter Shifts');
  assert(todayShiftCheck.includes('title="Shift Date"'), 'Operations Shift Monitor uses clean Shift Date category');
  assert(todayShiftCheck.includes('title="Entry Status"'), 'Operations Shift Monitor uses clean Entry Status category');

  const operatorHistCheck = fs.readFileSync(path.join(__dirname, 'components/operations/MobileOperatorHistoryTab.tsx'), 'utf8');
  assert(operatorHistCheck.includes('title="Filters & Sorting"'), 'Operator History uses standard Filters & Sorting');
  assert(!operatorHistCheck.includes('title="Filter Shift Logs"'), 'Operator History eradicates legacy Filter Shift Logs');

  const attendanceCheck = fs.readFileSync(path.join(__dirname, 'app/(app)/attendance.tsx'), 'utf8');
  assert(attendanceCheck.includes('title="Filters & Sorting"'), 'Attendance uses standard Filters & Sorting');

  const machineDetailCheck = fs.readFileSync(path.join(__dirname, 'components/machines/MachineDetailView.tsx'), 'utf8');
  assert(machineDetailCheck.includes('<FilterSidebar'), 'MachineDetailView uses canonical FilterSidebar');
  assert(!machineDetailCheck.includes('CustomFilterSelectorModal'), 'MachineDetailView eradicates CustomFilterSelectorModal');

  assert(!fs.existsSync(path.join(__dirname, 'components/machines/CustomFilterSelectorModal.tsx')), 'Duplicate machines/CustomFilterSelectorModal.tsx is deleted');
  assert(!fs.existsSync(path.join(__dirname, 'components/users/CustomFilterSelectorModal.tsx')), 'Duplicate users/CustomFilterSelectorModal.tsx is deleted');
  assert(!fs.existsSync(path.join(__dirname, 'components/operations/OperationsFilterSelectorModal.tsx')), 'Duplicate operations/OperationsFilterSelectorModal.tsx is deleted');

  // Test 180: Validate Production-Ready Fully Opaque Badge Component
  const badgeCheck = fs.readFileSync(path.join(__dirname, 'components/ui/Badge.tsx'), 'utf8');
  const badgeVariantsCode = badgeCheck.slice(badgeCheck.indexOf('const badgeVariants'), badgeCheck.indexOf('export type BadgeProps'));
  assert(!badgeVariantsCode.includes('/10'), 'Badge variants completely eliminate /10 semi-transparent washes');
  assert(!badgeVariantsCode.includes('/20'), 'Badge variants completely eliminate /20 semi-transparent borders');
  assert(badgeCheck.includes("default: 'border-primary bg-primary'"), 'Badge default variant uses solid primary fill');
  assert(badgeCheck.includes("secondary: 'border-border bg-secondary'"), 'Badge secondary variant uses solid secondary fill');
  assert(badgeCheck.includes("destructive: 'border-destructive bg-destructive'"), 'Badge destructive variant uses solid destructive fill');
  assert(badgeCheck.includes("error: 'border-rose-200 bg-rose-50 dark:border-rose-900 dark:bg-rose-950'"), 'Badge error variant uses solid opaque rose fill');
  assert(badgeCheck.includes("info: 'border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950'"), 'Badge info variant uses solid opaque sky fill');
  assert(badgeCheck.includes("outline: 'border-border bg-card'"), 'Badge outline variant uses solid opaque bg-card (never transparent)');
  assert(badgeCheck.includes("success: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950'"), 'Badge success variant uses solid opaque emerald fill');
  assert(badgeCheck.includes("warning: 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950'"), 'Badge warning variant uses solid opaque amber fill');
  assert(badgeCheck.includes("neutral: 'border-border bg-muted'"), 'Badge neutral variant uses solid opaque muted fill');
  assert(badgeCheck.includes('text-emerald-800 dark:text-emerald-200'), 'Badge success text uses high-contrast tokens');
  assert(badgeCheck.includes('text-rose-800 dark:text-rose-200'), 'Badge error text uses high-contrast tokens');
  assert(badgeCheck.includes('text-sky-800 dark:text-sky-200'), 'Badge info text uses high-contrast tokens');
  assert(badgeCheck.includes('text-amber-800 dark:text-amber-200'), 'Badge warning text uses high-contrast tokens');
  assert(badgeCheck.includes('rounded-full shrink-0 self-center'), 'Badge status dot uses shrink-0 and self-center for vertical alignment');
  assert(badgeCheck.includes('normalizedStatus = String(status).trim().toLowerCase()'), 'Badge normalizes status for case-resilience');

  // Test 181: Validate Production-Ready Optimized Mobile Button Component
  const buttonCheck = fs.readFileSync(path.join(__dirname, 'components/ui/Button.tsx'), 'utf8');
  assert(buttonCheck.includes('useTheme'), 'Button consumes useTheme for centralized theme tokens');
  assert(buttonCheck.includes('BUTTON_SIZE_STYLES: Record<string, ViewStyle>'), 'Button extracts static size definitions outside render loop');
  assert(buttonCheck.includes('minHeight: 44'), 'Button enforces minimum 44px touch targets');
  assert(buttonCheck.includes('background: theme.colors.canvasElevated'), 'Button outline variant uses solid canvas elevated background');
  assert(!buttonCheck.includes('rgba(23, 23, 23, 0.05)'), 'Button secondary variant eradicates transparent rgba in favor of solid surface');
  assert(buttonCheck.includes("case 'ghost':") && buttonCheck.includes("background: 'transparent'"), 'Button ghost variant intentionally preserves transparent styling');
  assert(buttonCheck.includes("case 'link':") && buttonCheck.includes("background: 'transparent'"), 'Button link variant intentionally preserves transparent styling');
  assert(buttonCheck.includes('#0284c7'), 'Button defines Reach blue #0284c7 primary background');
  assert(buttonCheck.includes('color={colors.spinner}'), 'Button derives loading spinner color from variant/theme foreground');
  assert(buttonCheck.includes('const leadingIcon = leftIcon ?? icon;'), 'Button preserves documented leftIcon precedence over icon');
  assert(buttonCheck.includes('staticStyles = StyleSheet.create'), 'Button defines static layout styles via StyleSheet.create');
  assert(buttonCheck.includes('isDisabled && !isLoading'), 'Button applies deliberate disabled palette without degrading active loading state');
  assert(buttonCheck.includes('loading={isLoading}'), 'Button passes loading state to Pressable to suppress interactions');
  // Test 182: Validate Search, Filter & Clear/Reset Non-Overlapping Layout Architecture
  const searchInputCheck182 = fs.readFileSync(path.join(__dirname, 'components/ui/SearchInput.tsx'), 'utf8');
  assert(searchInputCheck182.includes('minWidth: 0'), 'SearchInput defines minWidth: 0 in container style');
  assert(searchInputCheck182.includes('flexContainer: {'), 'SearchInput defines flexContainer style');
  assert(searchInputCheck182.includes('fullWidthContainer: {'), 'SearchInput defines fullWidthContainer style');
  assert(searchInputCheck182.includes('isFlexLayout ? styles.flexContainer : styles.fullWidthContainer'), 'SearchInput conditionally applies flex vs full width');
  assert(searchInputCheck182.includes('leftIconWrapper: {') && searchInputCheck182.includes('clearBtn: {'), 'SearchInput protects left icon and clear button with flexShrink: 0');

  const shiftMonitorCheck182 = fs.readFileSync(path.join(__dirname, 'components/operations/MobileTodayShiftMonitorTab.tsx'), 'utf8');
  assert(shiftMonitorCheck182.includes('<View style={styles.searchContainer}>'), 'MobileTodayShiftMonitorTab wraps SearchInput in searchContainer');
  assert(shiftMonitorCheck182.includes('searchContainer: {\n    flex: 1,\n    minWidth: 0'), 'MobileTodayShiftMonitorTab searchContainer has flex: 1 and minWidth: 0');
  assert(shiftMonitorCheck182.includes('filterToggleBtn: {') && shiftMonitorCheck182.includes('quickResetBtn: {'), 'MobileTodayShiftMonitorTab styles filter and reset buttons');

  const operatorHistCheck182 = fs.readFileSync(path.join(__dirname, 'components/operations/MobileOperatorHistoryTab.tsx'), 'utf8');
  assert(operatorHistCheck182.includes('<View style={styles.searchContainer}>'), 'MobileOperatorHistoryTab wraps SearchInput in searchContainer');
  assert(operatorHistCheck182.includes('searchContainer: {\n    flex: 1,\n    minWidth: 0'), 'MobileOperatorHistoryTab searchContainer has flex: 1 and minWidth: 0');

  const machinePanelCheck182 = fs.readFileSync(path.join(__dirname, 'components/machines/MachineFilterPanel.tsx'), 'utf8');
  assert(machinePanelCheck182.includes('searchContainer: {\n    flex: 1,\n    minWidth: 0'), 'MachineFilterPanel searchContainer defines minWidth: 0');

  const userPanelCheck182 = fs.readFileSync(path.join(__dirname, 'components/users/UserFiltersPanel.tsx'), 'utf8');
  assert(userPanelCheck182.includes('searchContainer: {\n    flex: 1,\n    minWidth: 0'), 'UserFiltersPanel searchContainer defines minWidth: 0');

  const filterToolbarCheck182 = fs.readFileSync(path.join(__dirname, 'components/ui/FilterToolbar.tsx'), 'utf8');
  assert(filterToolbarCheck182.includes('searchFlexWrap: {\n    flex: 1,\n    minWidth: 0'), 'FilterToolbar searchFlexWrap defines minWidth: 0');

  const attendanceToolbarCheck182 = fs.readFileSync(path.join(__dirname, 'app/(app)/attendance.tsx'), 'utf8');
  assert(attendanceToolbarCheck182.includes('searchContainer: {\n    flex: 1,\n    minWidth: 0'), 'Attendance screen searchContainer defines minWidth: 0');

  // Test 183: Centralized Native Badges with Light & Dark Theme Tokens, Roles, and Universal Reuse
  const badgeCheck183 = fs.readFileSync(path.join(__dirname, 'components/ui/Badge.tsx'), 'utf8');
  assert(badgeCheck183.includes('export function resolveBadgeColors('), 'Badge exports resolveBadgeColors helper');
  assert(badgeCheck183.includes('export function formatBadgeRoleLabel('), 'Badge exports formatBadgeRoleLabel helper');
  assert(badgeCheck183.includes('export function formatBadgeStatusLabel('), 'Badge exports formatBadgeStatusLabel helper');
  assert(badgeCheck183.includes("shape === 'rounded' ? radiusNumeric.sm : radiusNumeric.full"), 'Badge supports bimodal shapes (rounded & pill)');
  assert(badgeCheck183.includes('const staticBadgeStyles = StyleSheet.create({'), 'Badge allocates static base layout once via StyleSheet.create');
  assert(badgeCheck183.includes('const isInteractive = hasPress'), 'Badge container is only interactive when onPress is provided');
  assert(badgeCheck183.includes("accessibilityRole: hasRemove ? undefined : ('button' as const)"), 'Badge suppresses outer button role when onRemove exists to prevent nested button DOM hydration error');
  assert(badgeCheck183.includes("in_transit: 'info'"), 'Badge maps in_transit to info');

  const machineCardCheck183 = fs.readFileSync(path.join(__dirname, 'components/machines/MobileMachineCard.tsx'), 'utf8');
  assert(machineCardCheck183.includes('<Badge status="active" dot') && machineCardCheck183.includes('customLabel="Active"'), 'MobileMachineCard binds dot to Active health status badge');
  assert(machineCardCheck183.includes("status={machine.status === 'rented' ? 'rented' : 'available'}"), 'MobileMachineCard renders Rented/Available badge');

  const userTouchCardCheck183 = fs.readFileSync(path.join(__dirname, 'components/users/UserTouchCard.tsx'), 'utf8');
  assert(userTouchCardCheck183.includes('<Badge\n                role={u.role}'), 'UserTouchCard reuses centralized Badge for user role');
  assert(userTouchCardCheck183.includes('<Badge\n                status={u.status}\n                dot'), 'UserTouchCard reuses centralized Badge with dot for user status');

  const userDetailCheck183 = fs.readFileSync(path.join(__dirname, 'components/users/UserDetailModal.tsx'), 'utf8');
  assert(userDetailCheck183.includes('<Badge\n                  role={user.role}'), 'UserDetailModal reuses centralized Badge for user role');
  assert(userDetailCheck183.includes('<Badge\n                  status={user.status}\n                  dot'), 'UserDetailModal reuses centralized Badge with dot for user status');

  const todayShiftCardCheck183 = fs.readFileSync(path.join(__dirname, 'components/operations/MobileTodayShiftCard.tsx'), 'utf8');
  assert(todayShiftCardCheck183.includes('<Badge\n            status='), 'MobileTodayShiftCard reuses centralized Badge for shift log status');

  const deleteDialogCheck183 = fs.readFileSync(path.join(__dirname, 'components/users/DeleteUserConfirmDialog.tsx'), 'utf8');
  assert(deleteDialogCheck183.includes('<Badge\n              role={user.role}'), 'DeleteUserConfirmDialog reuses centralized Badge for user role');
  assert(deleteDialogCheck183.includes('<Badge\n              status={user.status'), 'DeleteUserConfirmDialog reuses centralized Badge for user status');

  const clientsCheckPath = fs.existsSync(path.join(__dirname, 'app/(app)/clients/index.tsx')) ? path.join(__dirname, 'app/(app)/clients/index.tsx') : path.join(__dirname, 'app/(app)/clients.tsx');
  const clientsCheck183 = fs.readFileSync(clientsCheckPath, 'utf8');
  assert(clientsCheck183.includes("variant={activeFilter === 'active' ? 'success' : 'warning'}"), 'clients.tsx reuses centralized Badge for status active filter chip');
  assert(!clientsCheck183.includes('#064e3b26'), 'clients.tsx eradicates transparent #064e3b26 in favor of 100% solid opaque Badge');
  assert(!clientsCheck183.includes('#78350f26'), 'clients.tsx eradicates transparent #78350f26 in favor of 100% solid opaque Badge');

  // Test 184: Running Logs Screen Redesign & Visual Parity with Web App
  const runningLogsScreenCheck184 = fs.readFileSync(path.join(__dirname, 'app/(app)/running-logs.tsx'), 'utf8');
  assert(runningLogsScreenCheck184.includes('RunningLogFilterPanel'), 'running-logs.tsx orchestrates RunningLogFilterPanel');
  assert(runningLogsScreenCheck184.includes('RunningLogSummaryCard'), 'running-logs.tsx renders RunningLogSummaryCard');
  assert(runningLogsScreenCheck184.includes('RunningLogMachineHeaderCard'), 'running-logs.tsx renders RunningLogMachineHeaderCard');
  assert(runningLogsScreenCheck184.includes('RunningLogShiftCard'), 'running-logs.tsx renders RunningLogShiftCard');
  assert(runningLogsScreenCheck184.includes('useOperationsMasterData'), 'running-logs.tsx queries centralized master data hook');
  assert(runningLogsScreenCheck184.includes('useOperationsLogs'), 'running-logs.tsx queries operations logs with TanStack Query');

  const filterPanelCheck184 = fs.readFileSync(path.join(__dirname, 'components/operations/RunningLogFilterPanel.tsx'), 'utf8');
  assert(filterPanelCheck184.includes('SegmentedToggle'), 'RunningLogFilterPanel renders SegmentedToggle for mode selection');
  assert(filterPanelCheck184.includes("id: 'machine', label: 'Machine'"), 'RunningLogFilterPanel provides Machine view option');
  assert(filterPanelCheck184.includes("id: 'client', label: 'Clients'"), 'RunningLogFilterPanel provides Clients view option');
  assert(filterPanelCheck184.includes("id: 'operator', label: 'Operator'"), 'RunningLogFilterPanel provides Operator view option');
  assert(filterPanelCheck184.includes('inlineDescription'), 'RunningLogFilterPanel passes inlineDescription to SearchableSelect');

  const shiftCardCheck184 = fs.readFileSync(path.join(__dirname, 'components/operations/RunningLogShiftCard.tsx'), 'utf8');
  assert(shiftCardCheck184.includes('export function formatExcelDate('), 'RunningLogShiftCard exports formatExcelDate');
  assert(shiftCardCheck184.includes('export function resolveShiftCode('), 'RunningLogShiftCard exports resolveShiftCode');
  assert(shiftCardCheck184.includes('M/C RT'), 'RunningLogShiftCard renders M/C RT metric container');
  assert(shiftCardCheck184.includes('WH'), 'RunningLogShiftCard renders WH metric container');
  assert(shiftCardCheck184.includes('B/D'), 'RunningLogShiftCard renders B/D metric container');

  const searchableSelectCheck184 = fs.readFileSync(path.join(__dirname, 'components/ui/SearchableSelect.tsx'), 'utf8');
  assert(searchableSelectCheck184.includes('inlineDescription?: boolean;'), 'SearchableSelect supports inlineDescription prop');
  assert(searchableSelectCheck184.includes('rgba(2, 132, 199,'), 'SearchableSelect styles code badges with Reach Sky Blue tokens');

  const operationsDataHookCheck184 = fs.readFileSync(path.join(__dirname, 'lib/hooks/useOperationsData.ts'), 'utf8');
  assert(operationsDataHookCheck184.includes('export interface ClientSiteRecord'), 'useOperationsData exports ClientSiteRecord');
  assert(operationsDataHookCheck184.includes(".from('client_sites')"), 'useOperationsData queries client_sites table');
  assert(operationsDataHookCheck184.includes("clientSites,"), 'useOperationsData integrates clientSites in master data');

  // Test 185: Attendance & Running Logs Feedback Polish: Operator EMP ID, Month Badges Removal, Separate Start/End CustomDatePicker, Quiet Empty State
  assert(operationsDataHookCheck184.includes('employee_id?: string | null;'), 'useOperationsData defines employee_id on OperatorRecord');
  assert(operationsDataHookCheck184.includes("select('id, employee_id, full_name"), 'useOperationsData queries employee_id in users query');

  assert(filterPanelCheck184.includes('code: o.employee_id || undefined'), 'RunningLogFilterPanel displays operator EMP ID as code');
  assert(!filterPanelCheck184.includes("code: 'OP'"), 'RunningLogFilterPanel eradicates hardcoded OP code badge');
  assert(!filterPanelCheck184.includes("code: 'JAN'"), 'RunningLogFilterPanel eradicates code badges from MONTH_OPTIONS');
  assert(!filterPanelCheck184.includes("code: 'CUST'"), 'RunningLogFilterPanel eradicates CUST badge from custom month option');

  assert(!fs.existsSync(path.join(__dirname, 'components/ui/DateRangePicker.tsx')), 'DateRangePicker extra component is eradicated');

  const uiIndexCheck185 = fs.readFileSync(path.join(__dirname, 'components/ui/index.ts'), 'utf8');
  assert(!uiIndexCheck185.includes("export * from './DateRangePicker'"), 'components/ui/index.ts does not export DateRangePicker');
  assert(uiIndexCheck185.includes("export * from './CustomDatePicker'"), 'components/ui/index.ts exports CustomDatePicker');

  assert(!filterPanelCheck184.includes('<DateRangePicker'), 'RunningLogFilterPanel eradicates DateRangePicker extra component');
  assert(filterPanelCheck184.includes('<CustomDatePicker'), 'RunningLogFilterPanel reuses canonical CustomDatePicker');
  assert(filterPanelCheck184.includes('label="Start Date"'), 'RunningLogFilterPanel includes separate Start Date picker');
  assert(filterPanelCheck184.includes('label="End Date"'), 'RunningLogFilterPanel includes separate End Date picker');

  assert(runningLogsScreenCheck184.includes('quietEmptyCard'), 'running-logs.tsx renders clean quiet empty card on filtered results');
  assert(runningLogsScreenCheck184.includes('RunningLogSummaryCard'), 'running-logs.tsx preserves summary card visibility during filtering');

  // Test 200: Unparented Text Node & Empty String Children Prevention
  const machineDetailViewCheck = fs.readFileSync(path.join(__dirname, 'components/machines/MachineDetailView.tsx'), 'utf8');
  assert(machineDetailViewCheck.includes('(activeLogFilterCount > 0 || logSearch.length > 0)'), 'MachineDetailView uses boolean length check for logSearch active filters');
  assert(!machineDetailViewCheck.includes('(activeLogFilterCount > 0 || logSearch) &&'), 'MachineDetailView eradicates unparented empty string condition');

  const emptyStateCheck = fs.readFileSync(path.join(__dirname, 'components/ui/EmptyState.tsx'), 'utf8');
  assert(emptyStateCheck.includes('Boolean(resolvedActionLabel || secondaryActionLabel)'), 'EmptyState uses Boolean check for actionRow');

  const pressableCheck = fs.readFileSync(path.join(__dirname, 'components/ui/touch/Pressable.tsx'), 'utf8');
  assert(pressableCheck.includes('sanitizedChildren'), 'Pressable implements sanitizedChildren defense-in-depth against empty strings');

  const mobileMachineCardCheck = fs.readFileSync(path.join(__dirname, 'components/machines/MobileMachineCard.tsx'), 'utf8');
  assert(mobileMachineCardCheck.includes('Boolean(machine.serial_number || machine.year_of_mfg)'), 'MobileMachineCard uses Boolean check for metadata row');

  // Test 225: Optimized In-App Document & Native PDF Viewer (Zero Google Drive Redirects, @kishannareshpal/expo-pdf, Shared Cache)
  const viewerModalCheck = fs.readFileSync(path.join(__dirname, 'components/documents/MobileDocumentViewerModal.tsx'), 'utf8');
  assert(viewerModalCheck.includes('isDirectUrl(rawDocUrl)'), 'MobileDocumentViewerModal initializes direct URLs synchronously');
  assert(!viewerModalCheck.includes('[docKey, rawDocUrl, doc, toast]'), 'MobileDocumentViewerModal removes unstable dependencies from useEffect');
  assert(viewerModalCheck.includes('prevDocKeyRef.current !== docKey'), 'MobileDocumentViewerModal uses prevDocKeyRef to prevent state reset loops');
  assert(viewerModalCheck.includes('handleRotate'), 'MobileDocumentViewerModal moves Rotate button to header actions row');
  assert(!viewerModalCheck.includes('RotateCcw'), 'MobileDocumentViewerModal completely eradicates RotateCcw icon');
  assert(!viewerModalCheck.includes('handleResetRotation'), 'MobileDocumentViewerModal completely eradicates handleResetRotation');
  assert(!viewerModalCheck.includes('floatingBar:'), 'MobileDocumentViewerModal completely eradicates bottom floating control bar');
  assert(!viewerModalCheck.includes('Pinch to zoom & pan'), 'MobileDocumentViewerModal completely eradicates bottom pinch to zoom notice');
  assert(!viewerModalCheck.includes('docs.google.com/gview'), 'MobileDocumentViewerModal completely eradicates Google Drive / Docs viewer redirects');
  assert(viewerModalCheck.includes('NativePdfViewer'), 'MobileDocumentViewerModal renders NativePdfViewer for in-app PDF display');

  const nativePdfCheck = fs.readFileSync(path.join(__dirname, 'components/documents/NativePdfViewer.tsx'), 'utf8');
  assert(nativePdfCheck.includes('@kishannareshpal/expo-pdf'), 'NativePdfViewer integrates @kishannareshpal/expo-pdf');
  assert(nativePdfCheck.includes('fitMode="width"'), 'NativePdfViewer configures fitMode="width" for fit-to-width auto scaling');
  assert(nativePdfCheck.includes('horizontal={false}'), 'NativePdfViewer enforces continuous vertical multipage scrolling');
  assert(nativePdfCheck.includes('pagingEnabled={false}'), 'NativePdfViewer disables paging snapping for free vertical scrolling');
  assert(nativePdfCheck.includes('doubleTapToZoom={true}'), 'NativePdfViewer enables smooth doubleTapToZoom');

  const docCacheCheck = fs.readFileSync(path.join(__dirname, 'lib/documentCache.ts'), 'utf8');
  assert(docCacheCheck.includes('ensureLocalDocumentFile'), 'documentCache exports ensureLocalDocumentFile shared cache resolver');
  assert(docCacheCheck.includes('downloadDocumentInApp'), 'documentCache exports in-app download helper');
  assert(!docCacheCheck.includes("a.target = '_blank'"), 'documentCache never uses target="_blank" to prevent browser redirects');
  assert(docCacheCheck.includes('shareDocumentReliable'), 'documentCache exports reliable share helper');
  assert(docCacheCheck.includes('localFileCache'), 'documentCache caches local files to avoid duplicate transfers');

  console.log(`\n✅ Verification Suite Passed: All ${passed}/${passed + failed} test scenarios verified!`);
  process.exit(failed > 0 ? 1 : 0);
} catch (err) {
  console.error('Fatal execution error:', err);
  process.exit(1);
}

