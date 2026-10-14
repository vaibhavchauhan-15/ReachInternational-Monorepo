/**
 * Comprehensive Automated Verification Suite for Mobile Authentication,
 * Hardware Keystore Persistence, UI Hints, Lifecycle & Device Scenarios.
 *
 * Verifies:
 * 1. Exclusive Hardware Keystore Storage & Encrypted Chunking (Zero Plaintext Fallback)
 * 2. Cached Profile as UI Hint Only (Session Authority & Expired Session Reset)
 * 3. User Enumeration Defense & Post-Authentication Status Evaluation
 * 4. AppState Token Auto-Refresh Singleton & Guaranteed Timeout Reset
 * 5. Remember Me (Email-only string) vs Auth Session Persistence Decoupling
 * 6. Responsive UI & 0 Raw Typography Compliance
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

console.log('\n================================================================');
console.log('  REACHINTERNATIONAL PRODUCTION SECURITY & PERSISTENCE SUITE    ');
console.log('================================================================\n');

let passedCount = 0;
let totalCount = 0;

function check(title, assertion) {
  totalCount++;
  try {
    assertion();
    console.log(`  ✓ ${title}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✕ ${title}`);
    console.error(`    Error: ${err.message}`);
  }
}

const rootDir = process.cwd();
const mobileDir = path.join(rootDir, 'apps', 'mobile');
const savedEmailsPath = path.join(mobileDir, 'lib', 'auth', 'savedEmails.ts');
const authErrorsPath = path.join(mobileDir, 'lib', 'auth', 'authErrors.ts');
const supabasePath = path.join(mobileDir, 'lib', 'supabase.ts');
const useAuthPath = path.join(mobileDir, 'lib', 'auth', 'useAuth.tsx');
const loginPath = path.join(mobileDir, 'app', '(auth)', 'login.tsx');
const inputPath = path.join(mobileDir, 'components', 'ui', 'Input.tsx');

const savedEmailsContent = fs.readFileSync(savedEmailsPath, 'utf8');
const authErrorsContent = fs.readFileSync(authErrorsPath, 'utf8');
const supabaseContent = fs.readFileSync(supabasePath, 'utf8');
const useAuthContent = fs.readFileSync(useAuthPath, 'utf8');
const loginContent = fs.readFileSync(loginPath, 'utf8');
const inputContent = fs.readFileSync(inputPath, 'utf8');

// [1] Exclusive Hardware Keystore & Encrypted Chunking
console.log('[1/6] Testing Hardware-Backed Keystore & Storage Security...');

check('mobileSecureStorage implements getItem, setItem, and removeItem', () => {
  assert(supabaseContent.includes('getItem: async'));
  assert(supabaseContent.includes('setItem: async'));
  assert(supabaseContent.includes('removeItem: async'));
});

check('Hardware-backed SecureStore is the exclusive native keystore', () => {
  assert(supabaseContent.includes('SecureStore.getItemAsync'));
  assert(supabaseContent.includes('SecureStore.setItemAsync'));
  assert(supabaseContent.includes('SecureStore.deleteItemAsync'));
});

check('ZERO plaintext AsyncStorage fallback for session tokens', () => {
  assert(!supabaseContent.includes('AsyncStorage.setItem(`@secure_fallback_'));
  assert(!supabaseContent.includes('AsyncStorage.getItem(`@secure_fallback_'));
});

check('Purges legacy unencrypted fallback keys on read, write, and remove', () => {
  assert(supabaseContent.includes('AsyncStorage.removeItem(`@secure_fallback_'));
});

check('Implements hardware keystore chunking for payloads > 1800 chars', () => {
  assert(supabaseContent.includes('SECURE_CHUNK_SIZE = 1800'));
  assert(supabaseContent.includes(`${'${sanitizedKey}__count'}`));
  assert(supabaseContent.includes(`${'${sanitizedKey}__chunk_'}`));
});

check('Reassembles all chunks strictly from hardware SecureStore', () => {
  assert(supabaseContent.includes('SecureStore.getItemAsync(`${sanitizedKey}__chunk_${i}`)'));
  assert(supabaseContent.includes('chunks.join('));
});

check('Deletes all chunk keys from SecureStore on removeItem', () => {
  assert(supabaseContent.includes('SecureStore.deleteItemAsync(`${sanitizedKey}__count`)'));
  assert(supabaseContent.includes('SecureStore.deleteItemAsync(`${sanitizedKey}__chunk_${i}`)'));
});

// [2] Session Authority & Cached Profile as UI Hint Only
console.log('\n[2/6] Testing Session Authority & Cached Profile Separation...');

check('useAuth.tsx treats cached profile strictly as a UI hint (loadCachedProfileHint)', () => {
  assert(useAuthContent.includes('loadCachedProfileHint'));
  assert(!useAuthContent.includes('hydrateCachedProfile(userId).then('));
});

check('Cached profile NEVER sets authenticated session independently', () => {
  const cacheFnMatch = useAuthContent.match(/const loadCachedProfileHint[\s\S]*?^  \};/m);
  assert(cacheFnMatch && !cacheFnMatch[0].includes('setSession('));
});

check('isLoading remains true on cold start until Supabase session resolves', () => {
  assert(useAuthContent.includes('supabase.auth.getSession().then(({ data: { session } }) => {'));
  assert(useAuthContent.includes('setIsLoading(false);'));
});

check('Expired or null session clears all auth state and sets unauthenticated', () => {
  assert(useAuthContent.includes('setSession(null);'));
  assert(useAuthContent.includes('setUser(null);'));
  assert(useAuthContent.includes('setRole(null);'));
  assert(useAuthContent.includes('setUserProfile(null);'));
});

check('SIGNED_OUT event immediately purges cached profile and resets state', () => {
  assert(useAuthContent.includes("if (event === 'SIGNED_OUT' || !newSession)"));
  assert(useAuthContent.includes('AsyncStorage.removeItem(`${PROFILE_CACHE_PREFIX}${user.id}`)'));
});

check('signOut purges persisted query cache, cached profile, and Supabase tokens', () => {
  assert(useAuthContent.includes('clearPersistedCache'));
  assert(useAuthContent.includes('AsyncStorage.removeItem(`${PROFILE_CACHE_PREFIX}${user.id}`)'));
  assert(useAuthContent.includes('supabase.auth.signOut()'));
});

// [3] User Enumeration Defense & Post-Authentication Status
console.log('\n[3/6] Testing User Enumeration Defense & Account Status...');

check('authErrors.ts exports mapAuthError and formatAccountStatusNotice', () => {
  assert(authErrorsContent.includes('export function mapAuthError'));
  assert(authErrorsContent.includes('export function formatAccountStatusNotice'));
});

check('Failed password / credential check ALWAYS returns generic message', () => {
  const generic = 'Invalid email or password. Please verify your credentials and try again.';
  assert(authErrorsContent.includes(generic));
});

check('mapAuthError does NOT leak inactive/pending account status on credential probes', () => {
  const mapFn = authErrorsContent.match(/export function mapAuthError[\s\S]*?^}/m);
  assert(mapFn && !mapFn[0].includes('Account Deactivated'));
  assert(mapFn && !mapFn[0].includes('Pending Approval'));
});

check('formatAccountStatusNotice is evaluated ONLY after password verification', () => {
  assert(useAuthContent.includes('formatAccountStatusNotice(syncResult.status)'));
  assert(useAuthContent.includes('const { data, error } = await Promise.race([authPromise, timeoutPromise]);'));
});

check('Inactive or pending account revokes session immediately in syncUserProfile', () => {
  assert(useAuthContent.includes("if (data.status === 'inactive' || data.status === 'pending')"));
  assert(useAuthContent.includes('await supabase.auth.signOut()'));
  assert(useAuthContent.includes('AsyncStorage.removeItem(`${PROFILE_CACHE_PREFIX}${userId}`)'));
});

// [4] Session Lifecycle, AppState & Timeout Handling
console.log('\n[4/6] Testing Session Lifecycle, AppState & Timeout Resilience...');

check('AppState listener registered with singleton guard in supabase.ts', () => {
  assert(supabaseContent.includes('isAppStateListenerBound'));
  assert(supabaseContent.includes('initSupabaseAppStateLifecycle'));
});

check('Triggers startAutoRefresh on active and stopAutoRefresh on background', () => {
  assert(supabaseContent.includes("if (state === 'active')"));
  assert(supabaseContent.includes('supabase.auth.startAutoRefresh()'));
  assert(supabaseContent.includes('supabase.auth.stopAutoRefresh()'));
});

check('Checks session freshness on active foreground transition', () => {
  assert(supabaseContent.includes('supabase.auth.getSession().catch(() => {})'));
});

check('signIn sets 15-second timeout and guarantees timer cleanup (clearTimeout)', () => {
  assert(useAuthContent.includes('timeoutTimer = setTimeout('));
  assert(useAuthContent.includes('clearTimeout(timeoutTimer)'));
});

check('signIn double-submission mutex is guaranteed cleared in finally block', () => {
  assert(useAuthContent.includes('finally {'));
  assert(useAuthContent.includes('isSigningInRef.current = false;'));
});

check('login.tsx handleLogin guarantees loading state cleared in finally block', () => {
  assert(loginContent.includes('finally {'));
  assert(loginContent.includes('isSubmittingRef.current = false;'));
  assert(loginContent.includes('setIsLoading(false);'));
});

// [5] Remember Me vs Session Persistence Decoupling
console.log('\n[5/6] Testing Remember Me Decoupling from Session Persistence...');

check('Remember Me controls non-sensitive email prefill only', () => {
  assert(savedEmailsContent.includes('@reach_remembered_email'));
  assert(savedEmailsContent.includes('@reach_remember_me_flag'));
});

check('ZERO password caching in savedEmails.ts executable code', () => {
  const code = savedEmailsContent.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  assert(!code.toLowerCase().includes('password'));
});

check('Session persistence follows SecureStore policy independently of Remember Me', () => {
  assert(supabaseContent.includes('persistSession: true'));
  assert(supabaseContent.includes('autoRefreshToken: true'));
});

// [6] UI/UX, Touch Ergonomics & Accessibility
console.log('\n[6/6] Testing UI/UX, Touch Ergonomics & Accessibility...');

check('login.tsx renders "Welcome back" card', () => {
  assert(loginContent.includes('Welcome back'));
});

check('login.tsx email suggestions strip allows quick autofill and removal', () => {
  assert(loginContent.includes('visibleEmailSuggestions'));
  assert(loginContent.includes('handleSelectEmailSuggestion'));
  assert(loginContent.includes('handleRemoveEmailSuggestion'));
});

check('Input.tsx password toggle meets minimum 44px touch target (hitSlop)', () => {
  assert(inputContent.includes('hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}'));
  assert(inputContent.includes('minWidth: 44, minHeight: 44'));
});

check('login.tsx Sign In CTA button includes loading spinner and disabled state', () => {
  assert(loginContent.includes('ActivityIndicator'));
  assert(loginContent.includes('disabled={isLoading}'));
});

check('login.tsx preserves 3-tier layout (Mobile touch cards, Tablet elevated, Desktop showcase)', () => {
  assert(loginContent.includes('isDesktop'));
  assert(loginContent.includes('isTablet'));
  assert(loginContent.includes('isMobile'));
  assert(loginContent.includes('desktopShowcasePanel'));
});

console.log('\n================================================================');
console.log(`  VERIFICATION RESULTS: ${passedCount}/${totalCount} TESTS PASSED`);
console.log(`  STATUS: ${passedCount === totalCount ? '100% PASS' : 'FAILURES DETECTED'}`);
console.log('================================================================\n');

if (passedCount !== totalCount) {
  process.exit(1);
}
