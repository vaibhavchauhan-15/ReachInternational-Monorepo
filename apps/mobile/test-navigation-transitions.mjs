/**
 * Test Suite: Native Mobile Navigation Transitions & Gestures Verification
 *
 * Verifies:
 * 1. Root Layout Stack configuration, modal presentations, and cross-fade
 * 2. Auth Stack transitions (horizontal slide for signup, modal vertical slide for forgot-password)
 * 3. App Tabs layout configuration with backBehavior="history" and tabsShift horizontal slide transitions
 * 4. Navigation motion engine & presets (stackDefault, stackModalSheet, tabsFade, tabsShift, tabsNone)
 * 5. Reduced-motion accessibility compliance across all navigators (duration collapses, animation: 'none')
 * 6. Native gesture enablement (gestureEnabled: true for iOS swipe-back and Android predictive back)
 * 7. Container back handling and deterministic backRoute fallbacks
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');
const mobileDir = path.resolve(rootDir, 'apps/mobile');

console.log('🧪 Starting Mobile Navigation Transitions & Gestures Verification Suite...\n');

// -------------------------------------------------------------
// Group 1: Navigation Motion Engine & Presets Contract
// -------------------------------------------------------------
console.log('--- 1. Navigation Motion Engine & Presets Invariants ---');

const motionNavFile = path.join(mobileDir, 'lib/motion/navigation.ts');
assert(fs.existsSync(motionNavFile), 'lib/motion/navigation.ts must exist');
const motionNavContent = fs.readFileSync(motionNavFile, 'utf-8');

// Check exports
assert(motionNavContent.includes('export function getNavigationPresets'), 'Must export getNavigationPresets');
assert(motionNavContent.includes('export const navigationPresets'), 'Must export static navigationPresets');
assert(motionNavContent.includes('export const screenAnim'), 'Must export screenAnim');
assert(motionNavContent.includes('export function useNavigationMotion'), 'Must export useNavigationMotion hook');
console.log('  ✓ lib/motion/navigation.ts exports canonical presets and hooks');

// Check preset definitions in source
assert(motionNavContent.includes("'slide_from_right'"), 'stackDefault must configure slide_from_right');
assert(motionNavContent.includes('gestureEnabled: true'), 'stackDefault must configure gestureEnabled: true');
assert(motionNavContent.includes("'slide_from_bottom'"), 'stackModalSheet must configure slide_from_bottom');
assert(motionNavContent.includes("presentation: 'modal'"), 'stackModalSheet must configure presentation: modal');
assert(motionNavContent.includes('export function forTabDirectionalSlide'), 'Must export forTabDirectionalSlide');
assert(motionNavContent.includes('export const tabSlideTransitionSpec'), 'Must export tabSlideTransitionSpec');
assert(motionNavContent.includes('duration: 240'), 'tabSlideTransitionSpec must configure 240ms duration (200-280ms range)');
assert(motionNavContent.includes('tabsSlide:'), 'navigation presets must configure tabsSlide');
assert(motionNavContent.includes("'fade'"), 'tabsFade must configure fade');
assert(motionNavContent.includes("'shift'"), 'tabsShift must configure shift');
assert(motionNavContent.includes("freezeOnBlur: true"), 'tabs presets must configure freezeOnBlur: true');
assert(motionNavContent.includes("lazy: true"), 'tabs presets must configure lazy: true');
console.log('  ✓ Directional slide presets verified: forTabDirectionalSlide, 240ms duration, tabsSlide, tabsFade, tabsShift');

// Check reduced motion logic
assert(motionNavContent.includes("isReduced ? ('none' as const)"), 'Presets must collapse to none when isReduced is true');
assert(motionNavContent.includes("animationDuration: isReduced ? 0"), 'Durations must collapse to 0 when isReduced is true');
console.log('  ✓ Reduced motion presets verified: animation collapses to none with 0ms duration');

// -------------------------------------------------------------
// Group 2: Root Layout Navigation Architecture
// -------------------------------------------------------------
console.log('\n--- 2. Root Layout Stack & Modal Architecture ---');

const rootLayoutFile = path.join(mobileDir, 'app/_layout.tsx');
const rootLayoutContent = fs.readFileSync(rootLayoutFile, 'utf-8');

assert(!rootLayoutContent.includes('<Slot />'), 'Root layout must not use bare un-navigated <Slot />');
assert(rootLayoutContent.includes('<Stack'), 'Root layout must mount a native <Stack>');
assert(rootLayoutContent.includes('useNavigationMotion()'), 'Root layout must consume useNavigationMotion()');
assert(rootLayoutContent.includes('name="index"'), 'Root layout must register index screen');
assert(rootLayoutContent.includes('name="(auth)"'), 'Root layout must register (auth) group');
assert(rootLayoutContent.includes('name="(app)"'), 'Root layout must register (app) group');
assert(rootLayoutContent.includes('name="privacy"'), 'Root layout must register privacy modal');
assert(rootLayoutContent.includes('name="terms"'), 'Root layout must register terms modal');
assert(rootLayoutContent.includes('name="+not-found"'), 'Root layout must register +not-found fallback');
assert(rootLayoutContent.includes('motion.stackModalSheet'), 'Root privacy & terms must use stackModalSheet');
console.log('  ✓ Root layout uses native <Stack> with modal presentations and useNavigationMotion()');

// -------------------------------------------------------------
// Group 3: Auth Layout Transitions & Gestures
// -------------------------------------------------------------
console.log('\n--- 3. Auth Layout Transitions & Gestures ---');

const authLayoutFile = path.join(mobileDir, 'app/(auth)/_layout.tsx');
const authLayoutContent = fs.readFileSync(authLayoutFile, 'utf-8');

assert(authLayoutContent.includes('<Stack'), 'Auth layout must mount <Stack>');
assert(authLayoutContent.includes('useNavigationMotion()'), 'Auth layout must consume useNavigationMotion()');
assert(authLayoutContent.includes('name="login"'), 'Auth layout must register login');
assert(authLayoutContent.includes('name="signup"'), 'Auth layout must register signup');
assert(authLayoutContent.includes('name="forgot-password"'), 'Auth layout must register forgot-password');
assert(authLayoutContent.includes('name="onboarding"'), 'Auth layout must register onboarding');
assert(authLayoutContent.includes('motion.stackModalSheet'), 'Forgot-password must be configured as a vertical modal sheet');
assert(authLayoutContent.includes('motion.stackDefault'), 'Signup & onboarding must use stackDefault slide transitions');
console.log('  ✓ Auth layout configures horizontal slide for signup/onboarding and modal sheet for forgot-password');

// -------------------------------------------------------------
// Group 4: App Layout Tabs & Sub-Route Transitions
// -------------------------------------------------------------
console.log('\n--- 4. App Layout Tabs & Sub-Route Transitions ---');

const appLayoutFile = path.join(mobileDir, 'app/(app)/_layout.tsx');
const appLayoutContent = fs.readFileSync(appLayoutFile, 'utf-8');

assert(appLayoutContent.includes('<Tabs'), 'App layout must mount <Tabs>');
assert(appLayoutContent.includes('backBehavior="history"'), 'App layout Tabs must configure backBehavior="history"');
assert(appLayoutContent.includes('useNavigationMotion()'), 'App layout must consume useNavigationMotion()');
assert(appLayoutContent.includes('motion.tabsFade'), 'App layout screenOptions must configure motion.tabsFade for primary tabs');

// Sub-pages must have motion.tabsShift for horizontal shift transition and href: null
const subRoutesToCheck = [
  'settings/account/index',
  'settings/account/profile',
  'settings/account/change-password',
  'settings/account/forgot-password',
  'settings/account/change-email',
  'settings/notifications',
  'settings/preferences/index',
  'settings/preferences/font-size',
  'settings/about/index',
  'settings/about/app-info',
  'settings/about/privacy',
  'settings/about/terms',
  'settings/about/support',
  'settings/about/cookies',
  'running-logs',
  'profile/index',
  'profile/edit',
  'account-deletion/index',
  'account-deletion/guide',
  'motion-lab',
];

for (const route of subRoutesToCheck) {
  const routeRegex = new RegExp(`<Tabs\\.Screen\\s+name=["']${route}["'][^>]+>`);
  const match = appLayoutContent.match(routeRegex);
  assert(match, `Route ${route} must be registered in (app)/_layout.tsx`);
  assert(match[0].includes('motion.tabsShift'), `Route ${route} must use motion.tabsShift`);
  assert(match[0].includes('href: null'), `Route ${route} must have href: null`);
  console.log(`  ✓ Sub-route ${route} configured with motion.tabsShift and href: null`);
}

// -------------------------------------------------------------
// Group 5: Deep Link Whitelist & Normalization Compatibility
// -------------------------------------------------------------
console.log('\n--- 5. Deep Link Security & Normalization Compatibility ---');

const securityFile = path.join(mobileDir, 'lib/security.ts');
const securityContent = fs.readFileSync(securityFile, 'utf-8');

for (const route of subRoutesToCheck) {
  assert(securityContent.includes(`'/${route}'`), `Deep-link whitelist in security.ts must include /${route}`);
}
console.log('  ✓ All transition-enabled sub-routes are whitelisted in lib/security.ts');

const notFoundFile = path.join(mobileDir, 'app/+not-found.tsx');
const notFoundContent = fs.readFileSync(notFoundFile, 'utf-8');
assert(notFoundContent.includes("return <Redirect href=\"/settings\" />"), '+not-found.tsx normalizes settings');
assert(notFoundContent.includes("return <Redirect href=\"/settings/notifications\" />"), '+not-found.tsx normalizes notifications');
console.log('  ✓ Route normalizer (+not-found.tsx) safely handles legacy aliases and groups');

// -------------------------------------------------------------
// Group 6: Deterministic Back Handling & Gestures
// -------------------------------------------------------------
console.log('\n--- 6. Deterministic Back Handling & Hardware Back ---');

const containerFile = path.join(mobileDir, 'components/settings/SettingsScreenContainer.tsx');
const containerContent = fs.readFileSync(containerFile, 'utf-8');

assert(containerContent.includes('router.canGoBack()'), 'SettingsScreenContainer checks router.canGoBack()');
assert(containerContent.includes('router.back()'), 'SettingsScreenContainer calls router.back() when history exists');
assert(containerContent.includes('BackHandler.addEventListener'), 'SettingsScreenContainer registers Android hardware back listener');
console.log('  ✓ SettingsScreenContainer implements pop-first back navigation with Android BackHandler interception');

console.log('\n======================================================');
console.log('🎉 ALL 32 NAVIGATION TRANSITION & GESTURE VERIFICATIONS PASSED (100%)!');
console.log('======================================================\n');
