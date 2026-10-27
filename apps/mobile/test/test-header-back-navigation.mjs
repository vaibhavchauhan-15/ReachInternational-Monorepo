/**
 * Reach International — Mobile Header & Back Button Navigation Verification Suite
 * Verifies that:
 * 1. MobileHeader.tsx optimizes handleBackPress (checks canGoBack first, then fallback to backRoute or /dashboard).
 * 2. SettingsScreenContainer.tsx optimizes handleBack with history check and safe fallback.
 * 3. All primary tabs (operations, machines, attendance, users, clients, payroll, settings) have back navigation.
 * 4. Home page (dashboard.tsx) strictly does NOT have a back button (`showBack={false}`).
 * 5. All subtabs, detail views, and subpages have back navigation with deterministic fallback.
 * 6. (auth)/signup.tsx has top "Back to sign in" navigation button with ArrowLeft icon.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');
const mobileRoot = __dirname;

let totalChecks = 0;
let passedChecks = 0;

function assert(condition, message) {
  totalChecks++;
  if (condition) {
    passedChecks++;
    console.log(`  ✓ ${message}`);
  } else {
    console.error(`  ✗ FAILED: ${message}`);
  }
}

console.log('[Test Suite]: Mobile Header & Back Navigation Verification\n');

// 1. MobileHeader.tsx optimization
const mobileHeaderContent = fs.readFileSync(path.join(mobileRoot, 'components/ui/MobileHeader.tsx'), 'utf-8');
assert(
  mobileHeaderContent.includes('router.canGoBack()') && mobileHeaderContent.includes('router.back()'),
  'MobileHeader.tsx checks router.canGoBack() before falling back'
);
assert(
  mobileHeaderContent.includes('router.replace(backRoute as any)') && mobileHeaderContent.includes("router.replace('/dashboard')"),
  'MobileHeader.tsx falls back to backRoute or /dashboard gracefully'
);
assert(
  mobileHeaderContent.includes('haptics.select()'),
  'MobileHeader.tsx includes tactile haptic feedback on back press'
);
assert(
  mobileHeaderContent.includes('hitSlopToMin48={true}'),
  'MobileHeader back button provides min 48px touch ergonomics'
);

// 2. SettingsScreenContainer.tsx optimization
const settingsContainerContent = fs.readFileSync(path.join(mobileRoot, 'components/settings/SettingsScreenContainer.tsx'), 'utf-8');
assert(
  settingsContainerContent.includes('router.canGoBack()') && settingsContainerContent.includes('router.back()'),
  'SettingsScreenContainer.tsx prioritizes stack history via router.canGoBack()'
);
assert(
  settingsContainerContent.includes("router.replace(backRoute as any)") && settingsContainerContent.includes("router.replace('/settings' as any)"),
  'SettingsScreenContainer.tsx falls back to backRoute or /settings'
);

// 3. Home page (dashboard.tsx) MUST NOT have a back button
const dashboardContent = fs.readFileSync(path.join(mobileRoot, 'app/(app)/dashboard.tsx'), 'utf-8');
assert(
  dashboardContent.includes('showBack={false}'),
  'Dashboard (Home) strictly retains showBack={false}'
);

// 4. Primary Tabs have back button
const attendanceContent = fs.readFileSync(path.join(mobileRoot, 'app/(app)/attendance.tsx'), 'utf-8');
assert(
  attendanceContent.includes('showBack={true}') && attendanceContent.includes('backRoute="/dashboard"'),
  'Attendance tab implements showBack={true} with backRoute="/dashboard"'
);

const clientsPath = fs.existsSync(path.join(mobileRoot, 'app/(app)/clients/index.tsx')) ? path.join(mobileRoot, 'app/(app)/clients/index.tsx') : path.join(mobileRoot, 'app/(app)/clients.tsx');
const clientsContent = fs.readFileSync(clientsPath, 'utf-8');
assert(
  clientsContent.includes('showBack={true}') && clientsContent.includes('backRoute="/dashboard"'),
  'Clients tab implements showBack={true} with backRoute="/dashboard"'
);

const payrollContent = fs.readFileSync(path.join(mobileRoot, 'app/(app)/payroll.tsx'), 'utf-8');
assert(
  payrollContent.includes('showBack={true}') && payrollContent.includes('backRoute="/dashboard"'),
  'Payroll tab implements showBack={true} with backRoute="/dashboard"'
);

const usersContent = fs.readFileSync(path.join(mobileRoot, 'app/(app)/users.tsx'), 'utf-8');
assert(
  usersContent.includes('showBack={true}') && usersContent.includes('backRoute="/dashboard"'),
  'Users tab implements showBack={true} with backRoute="/dashboard"'
);

const machinesContent = fs.readFileSync(path.join(mobileRoot, 'app/(app)/machines.tsx'), 'utf-8');
assert(
  machinesContent.includes('showBack={true}') && machinesContent.includes('backRoute="/dashboard"'),
  'Machines tab implements showBack={true} with backRoute="/dashboard"'
);

const operationsContent = fs.readFileSync(path.join(mobileRoot, 'app/(app)/operations.tsx'), 'utf-8');
assert(
  operationsContent.includes('showBack={true}') && operationsContent.includes('backRoute="/dashboard"'),
  'Operations tab implements showBack={true} with backRoute="/dashboard"'
);

const runningLogsContent = fs.readFileSync(path.join(mobileRoot, 'app/(app)/running-logs.tsx'), 'utf-8');
assert(
  runningLogsContent.includes('showBack={true}') && runningLogsContent.includes('backRoute="/dashboard"'),
  'Running logs implements showBack={true} with backRoute="/dashboard"'
);

const motionLabContent = fs.readFileSync(path.join(mobileRoot, 'app/(app)/motion-lab.tsx'), 'utf-8');
assert(
  motionLabContent.includes('showBack={true}') && motionLabContent.includes('backRoute="/dashboard"'),
  'Motion lab implements showBack={true} with backRoute="/dashboard"'
);

const settingsIndexContent = fs.readFileSync(path.join(mobileRoot, 'app/(app)/settings/index.tsx'), 'utf-8');
assert(
  settingsIndexContent.includes('showBack={true}') && settingsIndexContent.includes('backRoute="/dashboard"'),
  'Settings tab implements showBack={true} with backRoute="/dashboard"'
);

// 5. Account Deletion screens
const accountDeletionContent = fs.readFileSync(path.join(mobileRoot, 'app/(app)/account-deletion/index.tsx'), 'utf-8');
assert(
  accountDeletionContent.includes('showBack={true}') && accountDeletionContent.includes('backRoute="/settings/account"'),
  'Account deletion screen implements showBack={true} with backRoute="/settings/account"'
);

const accountDeletionGuideContent = fs.readFileSync(path.join(mobileRoot, 'app/(app)/account-deletion/guide.tsx'), 'utf-8');
assert(
  accountDeletionGuideContent.includes('showBack={true}') && accountDeletionGuideContent.includes('backRoute="/account-deletion"'),
  'Account deletion guide implements showBack={true} with backRoute="/account-deletion"'
);

// 6. Settings Subpages
const notificationsSettingsContent = fs.readFileSync(path.join(mobileRoot, 'app/(app)/settings/notifications.tsx'), 'utf-8');
assert(
  notificationsSettingsContent.includes('backRoute="/settings"'),
  'Notifications settings specifies backRoute="/settings"'
);

const accountSettingsContent = fs.readFileSync(path.join(mobileRoot, 'app/(app)/settings/account/index.tsx'), 'utf-8');
assert(
  accountSettingsContent.includes('showBack={true}') && accountSettingsContent.includes('backRoute="/settings"'),
  'Account settings specifies showBack={true} with backRoute="/settings"'
);

const preferencesSettingsContent = fs.readFileSync(path.join(mobileRoot, 'app/(app)/settings/preferences/index.tsx'), 'utf-8');
assert(
  preferencesSettingsContent.includes('showBack={true}') && preferencesSettingsContent.includes('backRoute="/settings"'),
  'Preferences settings specifies showBack={true} with backRoute="/settings"'
);

const fontSizeSettingsContent = fs.readFileSync(path.join(mobileRoot, 'app/(app)/settings/preferences/font-size.tsx'), 'utf-8');
assert(
  fontSizeSettingsContent.includes('showBack={true}') && fontSizeSettingsContent.includes('backRoute="/settings/preferences"'),
  'Font size settings specifies showBack={true} with backRoute="/settings/preferences"'
);

const aboutSettingsContent = fs.readFileSync(path.join(mobileRoot, 'app/(app)/settings/about/index.tsx'), 'utf-8');
assert(
  aboutSettingsContent.includes('showBack={true}') && aboutSettingsContent.includes('backRoute="/settings"'),
  'About app settings specifies showBack={true} with backRoute="/settings"'
);

// 7. Signup screen back button
const signupContent = fs.readFileSync(path.join(mobileRoot, 'app/(auth)/signup.tsx'), 'utf-8');
assert(
  signupContent.includes('handleNavigateBack') && signupContent.includes('Back to sign in'),
  'Signup screen provides Back to sign in button with handleNavigateBack'
);

// 8. Public Legal Pages
const privacyContent = fs.readFileSync(path.join(mobileRoot, 'app/privacy.tsx'), 'utf-8');
assert(
  privacyContent.includes('showBack={true}') && privacyContent.includes('router.canGoBack()'),
  'Privacy policy screen provides showBack={true} with stack history awareness'
);

const termsContent = fs.readFileSync(path.join(mobileRoot, 'app/terms.tsx'), 'utf-8');
assert(
  termsContent.includes('showBack={true}') && termsContent.includes('router.canGoBack()'),
  'Terms of service screen provides showBack={true} with stack history awareness'
);

console.log(`\nResults: ${passedChecks}/${totalChecks} passed.`);
if (passedChecks === totalChecks) {
  console.log('✅ All Header & Back Button Navigation assertions verified successfully!');
  process.exit(0);
} else {
  console.error('❌ Some assertions failed.');
  process.exit(1);
}
