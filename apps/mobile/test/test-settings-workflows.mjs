/**
 * Test Suite: Settings & Navigation Architecture Verification
 * Validates the Expo Router route tree, functional features, permissions, and navigation guards.
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');
const rootDir = path.resolve(__dirname, '../..');
const mobileDir = path.resolve(rootDir, 'apps/mobile');

console.log('🧪 Starting Mobile Settings & Navigation Verification Suite...\n');

// Group 1: Exact File & Route Architecture Verification
console.log('--- 1. Target Route & File Structure Verification ---');

const expectedFiles = [
  'app/(app)/settings/index.tsx',
  'app/(app)/settings/account/index.tsx',
  'app/(app)/settings/account/profile.tsx',
  'app/(app)/settings/account/change-password.tsx',
  'app/(app)/settings/account/forgot-password.tsx',
  'app/(app)/settings/account/change-email.tsx',
  'app/(app)/settings/notifications.tsx',
  'app/(app)/settings/preferences/index.tsx',
  'app/(app)/settings/preferences/font-size.tsx',
  'app/(app)/settings/about/index.tsx',
  'app/(app)/settings/about/about-us.tsx',
  'app/(app)/settings/about/app-info.tsx',
  'app/(app)/settings/about/privacy.tsx',
  'app/(app)/settings/about/terms.tsx',
  'app/(app)/settings/about/support.tsx',
  'app/(app)/settings/about/cookies.tsx',
];

for (const relPath of expectedFiles) {
  const fullPath = path.join(mobileDir, relPath);
  assert(fs.existsSync(fullPath), `Target route file missing: ${relPath}`);
  console.log(`  ✓ ${relPath} exists`);
}

// Group 2: Elimination of Duplicate & Conflicting Routes
console.log('\n--- 2. Duplicate Route Elimination Verification ---');

const obsoleteFiles = [
  'app/(app)/settings/account/edit-profile.tsx', // Removed since edit-profile is subtree of profile
  'app/(app)/settings/aboutapp.tsx',
  'app/(app)/settings/account.tsx',
  'app/(app)/settings/app-info.tsx',
  'app/(app)/settings/appinfo.tsx',
  'app/(app)/settings/contact.tsx',
  'app/(app)/settings/font-size.tsx',
  'app/(app)/settings/fontsize.tsx',
  'app/(app)/settings/notification.tsx',
  'app/(app)/settings/password.tsx',
  'app/(app)/settings/preference.tsx',
  'app/(app)/settings/preferences.tsx',
  'app/(app)/settings/prefrences.tsx',
  'app/(app)/settings/security.tsx',
  'app/(app)/settings/support.tsx',
];

for (const relPath of obsoleteFiles) {
  const fullPath = path.join(mobileDir, relPath);
  assert(!fs.existsSync(fullPath), `Obsolete conflicting route must not exist: ${relPath}`);
  console.log(`  ✓ Conflicting duplicate removed: ${relPath}`);
}

// Group 3: Expo Router Configuration in _layout.tsx
console.log('\n--- 3. Expo Router Registration & Sub-Page Guarding ---');

const layoutContent = fs.readFileSync(path.join(mobileDir, 'app/(app)/_layout.tsx'), 'utf-8');

const registeredRoutes = [
  'settings/index',
  'settings/account/index',
  'settings/account/profile',
  'settings/account/change-password',
  'settings/account/forgot-password',
  'settings/account/change-email',
  'settings/notifications',
  'settings/preferences/index',
  'settings/preferences/font-size',
  'settings/about/index',
  'settings/about/about-us',
  'settings/about/app-info',
  'settings/about/privacy',
  'settings/about/terms',
  'settings/about/support',
  'settings/about/cookies',
];

for (const routeName of registeredRoutes) {
  const pattern = new RegExp(`<Tabs\\.Screen\\s+name=["']${routeName}["']`);
  assert(pattern.test(layoutContent), `Route ${routeName} must be registered in (app)/_layout.tsx`);
  console.log(`  ✓ Registered Tabs.Screen name="${routeName}"`);
}

// Verify Tabs backBehavior="history"
assert(layoutContent.includes('backBehavior="history"'), 'Tabs must have backBehavior="history"');
console.log('  ✓ Tabs backBehavior="history" configured for native navigation stack');

// Verify non-existent routes are excluded from Tabs.Screen
assert(!layoutContent.includes('name="settings/account/edit-profile"'), 'settings/account/edit-profile must not be registered in (app)/_layout.tsx');
console.log('  ✓ Verified non-existent route settings/account/edit-profile is excluded from Tabs.Screen');

// Ensure sub-pages have href: null so they don't appear in bottom tab bar
const subpageRoutes = registeredRoutes.filter((r) => r !== 'settings/index');
for (const subRoute of subpageRoutes) {
  const routeBlockMatch = layoutContent.match(new RegExp(`<Tabs\\.Screen\\s+name=["']${subRoute}["'][^>]+>`));
  assert(routeBlockMatch, `Expected route definition for ${subRoute}`);
  assert(routeBlockMatch[0].includes('href: null'), `Sub-page ${subRoute} must have href: null`);
}
console.log(`  ✓ All ${subpageRoutes.length} settings sub-pages have href: null (hidden from bottom bar)`);

// Group 4: Legacy Route Redirection in +not-found.tsx
console.log('\n--- 4. Legacy Route Redirections (+not-found.tsx) ---');

const notFoundContent = fs.readFileSync(path.join(mobileDir, 'app/+not-found.tsx'), 'utf-8');
const legacyRedirectChecks = [
  { legacy: '/settings/notification', target: '/settings/notifications' },
  { legacy: '/settings/preference', target: '/settings/preferences' },
  { legacy: '/settings/fontsize', target: '/settings/preferences/font-size' },
  { legacy: '/settings/font-size', target: '/settings/preferences/font-size' },
  { legacy: '/settings/aboutapp', target: '/settings/about' },
  { legacy: '/settings/appinfo', target: '/settings/about/app-info' },
  { legacy: '/settings/support', target: '/settings/about/support' },
  { legacy: '/settings/password', target: '/settings/account/change-password' },
  { legacy: '/settings/security', target: '/settings/account' },
  { legacy: '/settings/account/edit-profile', target: '/settings/account/profile' },
];

for (const { legacy, target } of legacyRedirectChecks) {
  assert(notFoundContent.includes(legacy), `+not-found.tsx must handle legacy route ${legacy}`);
  assert(notFoundContent.includes(target), `+not-found.tsx must redirect to ${target}`);
  console.log(`  ✓ Legacy route ${legacy} -> ${target}`);
}

// Group 5: Deep Link Security Whitelist
console.log('\n--- 5. Security & Deep Link Whitelist Verification ---');

const securityContent = fs.readFileSync(path.join(mobileDir, 'lib/security.ts'), 'utf-8');
for (const r of registeredRoutes) {
  assert(securityContent.includes(`'/${r}'`), `Deep-link whitelist must include /${r}`);
  console.log(`  ✓ Whitelisted /${r}`);
}

// Group 6: Deterministic Hierarchical Backward Navigation & Hardware Back
console.log('\n--- 6. Backward Navigation Hierarchy & Android BackHandler ---');

// Verify SettingsScreenContainer implementation
const containerContent = fs.readFileSync(path.join(mobileDir, 'components/settings/SettingsScreenContainer.tsx'), 'utf-8');
assert(containerContent.includes('backRoute?: string'), 'SettingsScreenContainer supports backRoute');
assert(containerContent.includes('BackHandler'), 'SettingsScreenContainer integrates Android BackHandler');
assert(containerContent.includes('router.replace(backRoute'), 'SettingsScreenContainer deterministically replaces to backRoute');
console.log('  ✓ SettingsScreenContainer implements deterministic backRoute & Android BackHandler');

const backRouteSpecs = [
  { file: 'app/(app)/settings/account/index.tsx', expectedBack: '/settings' },
  { file: 'app/(app)/settings/account/profile.tsx', expectedBack: '/settings/account' },
  { file: 'app/(app)/settings/account/change-password.tsx', expectedBack: '/settings/account' },
  { file: 'app/(app)/settings/account/forgot-password.tsx', expectedBack: '/settings/account' },
  { file: 'app/(app)/settings/account/change-email.tsx', expectedBack: '/settings/account' },
  { file: 'app/(app)/settings/notifications.tsx', expectedBack: '/settings' },
  { file: 'app/(app)/settings/preferences/index.tsx', expectedBack: '/settings' },
  { file: 'app/(app)/settings/preferences/font-size.tsx', expectedBack: '/settings/preferences' },
  { file: 'app/(app)/settings/about/index.tsx', expectedBack: '/settings' },
  { file: 'app/(app)/settings/about/about-us.tsx', expectedBack: '/settings/about' },
  { file: 'app/(app)/settings/about/app-info.tsx', expectedBack: '/settings/about' },
  { file: 'app/(app)/settings/about/privacy.tsx', expectedBack: '/settings/about' },
  { file: 'app/(app)/settings/about/terms.tsx', expectedBack: '/settings/about' },
  { file: 'app/(app)/settings/about/support.tsx', expectedBack: '/settings/about' },
  { file: 'app/(app)/settings/about/cookies.tsx', expectedBack: '/settings/about' },
];

for (const { file, expectedBack } of backRouteSpecs) {
  const content = fs.readFileSync(path.join(mobileDir, file), 'utf-8');
  assert(
    content.includes(`backRoute="${expectedBack}"`) || content.includes(`replace('${expectedBack}')`),
    `File ${file} must have deterministic backward navigation to ${expectedBack}`
  );
  console.log(`  ✓ ${file} navigates back to ${expectedBack}`);
}

// Group 7: Functional Features & Component Invariants
console.log('\n--- 7. Feature Integrity & Component Invariants ---');

// Settings Hub Sign Out Dialog
const settingsHub = fs.readFileSync(path.join(mobileDir, 'app/(app)/settings/index.tsx'), 'utf-8');
assert(settingsHub.includes('ConfirmDialog'), 'Settings index must import ConfirmDialog');
assert(settingsHub.includes('signOut'), 'Settings index must call signOut()');
assert(settingsHub.includes('variant="danger"'), 'Sign Out button must use variant="danger"');
assert(settingsHub.includes('appVersion'), 'Settings index must define appVersion');
assert(settingsHub.includes('Version ${appVersion}'), 'Settings index must display Version ${appVersion}');
assert(settingsHub.includes('router.push(\'/settings/account\''), 'Links to /settings/account');
assert(settingsHub.includes('router.push(\'/settings/notifications\''), 'Links to /settings/notifications');
assert(settingsHub.includes('router.push(\'/settings/preferences\''), 'Links to /settings/preferences');
assert(settingsHub.includes('router.push(\'/settings/about\''), 'Links to /settings/about');
console.log('  ✓ Settings Hub has ConfirmDialog, danger red signOut button, app version footer, and all 4 main hub links');

// Account Settings Screen
const accountIndex = fs.readFileSync(path.join(mobileDir, 'app/(app)/settings/account/index.tsx'), 'utf-8');
assert(accountIndex.includes('/settings/account/profile'), 'Links to Profile');
assert(!accountIndex.includes('/settings/account/edit-profile'), 'Edit Profile card removed (subtree of Profile)');
assert(accountIndex.includes('/settings/account/change-password'), 'Links to Change Password');
assert(accountIndex.includes('/settings/account/forgot-password'), 'Links to Forgot Password');
assert(accountIndex.includes('/settings/account/change-email'), 'Links to Change Email');
assert(accountIndex.includes('/account-deletion'), 'Links to Delete Account');
console.log('  ✓ Account Index links to all 5 canonical sub-features with edit-profile scoped to profile');

// Profile screen contains Edit Profile workflow
const profileContent = fs.readFileSync(path.join(mobileDir, 'app/(app)/profile/index.tsx'), 'utf-8');
assert(profileContent.includes('/profile/edit'), 'Profile screen provides access to Edit Profile');
console.log('  ✓ Profile screen includes Edit Profile workflow');

// Change Password Screen
const changePassword = fs.readFileSync(path.join(mobileDir, 'app/(app)/settings/account/change-password.tsx'), 'utf-8');
assert(changePassword.includes('signInWithPassword'), 'Change Password reauthenticates current password');
assert(changePassword.includes('updateUser'), 'Change Password updates password via Supabase Auth');
assert(changePassword.includes('strengthScore'), 'Change Password includes password complexity evaluation');
console.log('  ✓ Change Password verifies current password and evaluates complexity');

// Change Email Screen
const changeEmail = fs.readFileSync(path.join(mobileDir, 'app/(app)/settings/account/change-email.tsx'), 'utf-8');
assert(changeEmail.includes('signInWithPassword'), 'Change Email reauthenticates current password');
assert(changeEmail.includes('updateUser'), 'Change Email calls updateUser({ email })');
console.log('  ✓ Change Email requires password reauthentication');

// Notifications Screen
const notifsScreen = fs.readFileSync(path.join(mobileDir, 'app/(app)/settings/notifications.tsx'), 'utf-8');
assert(notifsScreen.includes('useNotificationPreferences'), 'Consumes useNotificationPreferences');
assert(notifsScreen.includes('getNotificationPermissionStatus'), 'Syncs with system permissions');
assert(notifsScreen.includes('requestNotificationPermission'), 'Can request system permissions');
assert(notifsScreen.includes('shiftReminders'), 'Includes shiftReminders channel');
assert(notifsScreen.includes('breakdownAlerts'), 'Includes breakdownAlerts channel');
assert(notifsScreen.includes('assignmentAlerts'), 'Includes assignmentAlerts channel');
assert(notifsScreen.includes('overtimeAlerts'), 'Includes overtimeAlerts channel');
assert(notifsScreen.includes('logSubmissions'), 'Includes logSubmissions channel');
console.log('  ✓ Notifications screen has master toggle, permission sync, and 5 alert channels');

// Preferences Screen
const prefsScreen = fs.readFileSync(path.join(mobileDir, 'app/(app)/settings/preferences/index.tsx'), 'utf-8');
assert(prefsScreen.includes('useTheme'), 'Preferences uses useTheme()');
assert(prefsScreen.includes('usePreferences'), 'Preferences uses usePreferences() for haptics');
assert(prefsScreen.includes('/settings/preferences/font-size'), 'Preferences links to /settings/preferences/font-size');
console.log('  ✓ Preferences screen controls theme, haptics, and links to font-size');

// Font Size Screen
const fontSizeScreen = fs.readFileSync(path.join(mobileDir, 'app/(app)/settings/preferences/font-size.tsx'), 'utf-8');
assert(fontSizeScreen.includes('useTypeScale'), 'Font size uses useTypeScale()');
assert(fontSizeScreen.includes('TypeScaleScope'), 'Font size uses TypeScaleScope for live preview');
assert(fontSizeScreen.includes('setPreset'), 'Font size commits via setPreset');
console.log('  ✓ Font Size screen has live preview and persistent commit');

// About Hub Screen
const aboutIndex = fs.readFileSync(path.join(mobileDir, 'app/(app)/settings/about/index.tsx'), 'utf-8');
assert(aboutIndex.includes('/settings/about/about-us'), 'Links to About Us');
assert(aboutIndex.includes('/settings/about/app-info'), 'Links to App Info');
assert(aboutIndex.includes('/settings/about/privacy'), 'Links to Privacy Policy');
assert(aboutIndex.includes('/settings/about/terms'), 'Links to Terms & Conditions');
assert(aboutIndex.includes('/settings/about/support'), 'Links to Support & Contact');
assert(aboutIndex.includes('/settings/about/cookies'), 'Links to Cookie Policy');
console.log('  ✓ About Index links to all company profile, legal, and support sub-pages');

// Group 8: Settings UI, Typography & Responsive Sizing Standardization
console.log('\n--- 8. Settings UI, Typography & Responsive Sizing ---');

// 1. SettingsScreenContainer responsive width containment
assert(containerContent.includes('maxWidth: 896'), 'SettingsScreenContainer must constrain scrollContent to maxWidth: 896 for wide viewports');
assert(containerContent.includes("alignSelf: 'center'"), 'SettingsScreenContainer must center scrollContent');
console.log('  ✓ SettingsScreenContainer enforces maxWidth: 896 and alignSelf: center (responsive viewport containment)');

// 2. SettingsSection typography standardization
const sectionContent = fs.readFileSync(path.join(mobileDir, 'components/settings/SettingsSection.tsx'), 'utf-8');
assert(sectionContent.includes('variant="caption"'), 'SettingsSection must use caption variant');
assert(sectionContent.includes('weight="semibold"'), 'SettingsSection must use semibold weight');
assert(sectionContent.includes('title.toUpperCase()'), 'SettingsSection must uppercase section titles');
console.log('  ✓ SettingsSection uses variant="caption" weight="semibold" title.toUpperCase()');

// 3. Notifications Screen: Removed Status Badge & Small Informative Heading
assert(!notifsScreen.includes('<Badge'), 'Notifications master push card must not render redundant status badge');
assert(notifsScreen.includes('OPERATIONAL ALERT CHANNELS'), 'Notifications screen must have small informative section title');
assert(notifsScreen.includes('Configure real-time push alerts'), 'Notifications screen must have informative section subtitle');
console.log('  ✓ Notifications screen removed status badge and implemented small, informative section heading');

// 4. About Screen: App Identity Banner & Categorized Sections
assert(aboutIndex.includes('APPLICATION & RELEASE'), 'About screen must include APPLICATION & RELEASE section');
assert(aboutIndex.includes('GOVERNANCE & COMPLIANCE'), 'About screen must include GOVERNANCE & COMPLIANCE section');
assert(aboutIndex.includes('SUPPORT & OPERATIONS'), 'About screen must include SUPPORT & OPERATIONS section');
assert(aboutIndex.includes('heroCard'), 'About screen must render app identity banner card');
console.log('  ✓ About screen includes identity banner and 3 small informative sections');

// 5. Account Screen: Profile Identity Card & Categorized Sections
assert(accountIndex.includes('profileCard'), 'Account screen must render profile identity card');
assert(accountIndex.includes('PROFILE & CREDENTIALS'), 'Account screen must include PROFILE & CREDENTIALS section');
assert(accountIndex.includes('DANGER ZONE'), 'Account screen must include DANGER ZONE section');
console.log('  ✓ Account screen includes profile identity card and structured sections');

// 6. Preferences Screen: Categorized Sections & Ergonomics
assert(prefsScreen.includes('APPEARANCE & TYPOGRAPHY'), 'Preferences screen must include APPEARANCE & TYPOGRAPHY section');
assert(prefsScreen.includes('TACTILE & TOUCH ERGONOMICS'), 'Preferences screen must include TACTILE & TOUCH ERGONOMICS section');
console.log('  ✓ Preferences screen structured into appearance and tactile ergonomics sections');

console.log('\n======================================================');
console.log('✅ ALL SETTINGS & NAVIGATION VERIFICATION CHECKS PASSED!');
console.log('======================================================');

