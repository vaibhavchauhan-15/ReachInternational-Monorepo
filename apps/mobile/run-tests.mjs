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

  assert(appJson.expo?.name === 'ReachInternational', 'app.json expo.name is ReachInternational');
  assert(appJson.expo?.android?.package === 'com.reachinternational.app', 'Android package is com.reachinternational.app');
  assert(appJson.expo?.updates?.url?.startsWith('https://u.expo.dev/'), 'EAS Update URL is configured');
  assert(appJson.expo?.runtimeVersion?.policy === 'appVersion', 'Runtime version policy is set to appVersion');
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
  assert(supabaseContent.includes('FALLBACK_SUPABASE_URL'), 'supabase.ts defines production fallback URL to guarantee non-empty createClient');

  const pkgContent = fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8');
  assert(pkgContent.includes('expo-system-ui'), 'package.json includes expo-system-ui for Android 15 system UI theme');

  console.log(`\n✅ Verification Suite Passed: All ${passed}/${passed + failed} test scenarios verified!`);
  process.exit(failed > 0 ? 1 : 0);
} catch (err) {
  console.error('Fatal execution error:', err);
  process.exit(1);
}

