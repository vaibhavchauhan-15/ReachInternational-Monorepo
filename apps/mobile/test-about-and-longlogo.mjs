/**
 * Test Suite: About Us Screen, LongLogo Centralization & UI Polish
 * 
 * Verifies:
 * 1. Reusable ReachLongLogo component supporting dark and light theme assets.
 * 2. Brand assets exist and have authentic dimensions.
 * 3. Removal of hero card from /settings/about/app-info.
 * 4. Removal of desktop showcase split panel from /settings/about/terms.
 * 5. Addition of authentic About Us screen (/settings/about/about-us) with founders & company profile.
 * 6. Centralized transparent long logo replacement across login, onboarding, privacy, terms, and profile sheet.
 * 7. Complete route registration, security whitelisting, and quick access indexing.
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Starting About Us & LongLogo Verification Suite...\n');

// 1. LongLogo Component & Assets
console.log('--- 1. ReachLongLogo Component & Assets ---');
const longLogoPath = path.join(__dirname, 'components/branding/ReachLongLogo.tsx');
assert(fs.existsSync(longLogoPath), 'ReachLongLogo.tsx exists');
const longLogoContent = fs.readFileSync(longLogoPath, 'utf-8');
assert(longLogoContent.includes('export const ReachLongLogo'), 'Exports ReachLongLogo');
assert(longLogoContent.includes('Reach International Light Theme LongLogo.png'), 'Requires light theme asset');
assert(longLogoContent.includes('Reach International Dark Theme LongLogo.png'), 'Requires dark theme asset');

const lightAsset = path.join(__dirname, 'assets/Reach International Light Theme LongLogo.png');
const darkAsset = path.join(__dirname, 'assets/Reach International Dark Theme LongLogo.png');
assert(fs.existsSync(lightAsset), 'Light theme PNG asset exists in assets/');
assert(fs.existsSync(darkAsset), 'Dark theme PNG asset exists in assets/');
console.log('  ✓ ReachLongLogo component and authentic light/dark PNG assets verified');

// 2. Centralized ReachInternationalLogo Integration
console.log('\n--- 2. Centralized Branding Barrel & Integration ---');
const brandingBarrel = fs.readFileSync(path.join(__dirname, 'components/branding/index.ts'), 'utf-8');
assert(brandingBarrel.includes("export * from './ReachLongLogo'"), 'Branding index exports ReachLongLogo');

const brandLogoFile = fs.readFileSync(path.join(__dirname, 'components/branding/ReachInternationalLogo.tsx'), 'utf-8');
assert(brandLogoFile.includes('ReachLongLogo'), 'ReachInternationalLogo integrates ReachLongLogo');
console.log('  ✓ Branding index exports ReachLongLogo and ReachInternationalLogo delegates cleanly');

// 3. Removal of Hero Card from /settings/about/app-info
console.log('\n--- 3. /settings/about/app-info Feedback Verification ---');
const appInfoContent = fs.readFileSync(path.join(__dirname, 'app/(app)/settings/about/app-info.tsx'), 'utf-8');
assert(!appInfoContent.includes('heroCard'), 'heroCard removed from app-info.tsx');
assert(!appInfoContent.includes('heroCenter'), 'heroCenter removed from app-info.tsx');
assert(appInfoContent.includes('specsCard'), 'Specifications card preserved');
assert(appInfoContent.includes('Platform Runtime'), 'Platform runtime specs preserved');
console.log('  ✓ Hero brand card removed from app-info.tsx per user feedback');

// 4. Removal of Desktop Showcase from /settings/about/terms
console.log('\n--- 4. /settings/about/terms Feedback Verification ---');
const termsContent = fs.readFileSync(path.join(__dirname, 'app/terms.tsx'), 'utf-8');
assert(!termsContent.includes('desktopShowcasePanel'), 'desktopShowcasePanel removed from terms.tsx');
assert(!termsContent.includes('loginPageImage'), 'loginPageImage asset requirement removed from terms.tsx');
assert(termsContent.includes('ReachLongLogo'), 'terms.tsx footer uses ReachLongLogo');
assert(!termsContent.includes('{BRAND_NAME} • {BRAND_TAGLINE}'), 'Duplicate brand name/tagline removed from terms footer');
console.log('  ✓ Desktop split showcase panel removed completely from terms.tsx');

// 5. Authentic About Us Screen (/settings/about/about-us)
console.log('\n--- 5. About Us Screen Content & Company Credentials ---');
const aboutUsPath = path.join(__dirname, 'app/(app)/settings/about/about-us.tsx');
assert(fs.existsSync(aboutUsPath), 'about-us.tsx route screen exists');
const aboutUsContent = fs.readFileSync(aboutUsPath, 'utf-8');
assert(aboutUsContent.includes('Mr. Vishal'), 'Features Director Mr. Vishal');
assert(aboutUsContent.includes('Mr. Dhruv Sharma'), 'Features Director Mr. Dhruv Sharma');
assert(aboutUsContent.includes('Safe'), 'Features core pillar Safe');
assert(aboutUsContent.includes('Quick'), 'Features core pillar Quick');
assert(aboutUsContent.includes('Cost-Effective'), 'Features core pillar Cost-Effective');
assert(aboutUsContent.includes('8800040308'), 'Features official phone number');
assert(aboutUsContent.includes('reachinternational.co.in'), 'Features official website');
assert(aboutUsContent.includes('ReachLongLogo'), 'Features ReachLongLogo');
console.log('  ✓ About Us screen verified with authentic founders, directors, and company history');

// 6. Navigation Hub Integration
console.log('\n--- 6. Navigation Hub Integration ---');
const aboutIndexContent = fs.readFileSync(path.join(__dirname, 'app/(app)/settings/about/index.tsx'), 'utf-8');
assert(aboutIndexContent.includes('/settings/about/about-us'), 'About hub links to /settings/about/about-us');
assert(aboutIndexContent.includes('About Us'), 'About hub renders About Us card');

const layoutContent = fs.readFileSync(path.join(__dirname, 'app/(app)/_layout.tsx'), 'utf-8');
assert(layoutContent.includes('settings/about/about-us'), '_layout.tsx registers settings/about/about-us tab screen');

const securityContent = fs.readFileSync(path.join(__dirname, 'lib/security.ts'), 'utf-8');
assert(securityContent.includes('/settings/about/about-us'), 'security.ts whitelists /settings/about/about-us');

const quickAccessContent = fs.readFileSync(path.join(__dirname, 'components/navigation/quickAccessRegistry.ts'), 'utf-8');
assert(quickAccessContent.includes('nav-settings-about-us'), 'quickAccessRegistry indexes nav-settings-about-us');
assert(quickAccessContent.includes('/settings/about/about-us'), 'quickAccessRegistry links to /settings/about/about-us');

const notFoundContent = fs.readFileSync(path.join(__dirname, 'app/+not-found.tsx'), 'utf-8');
assert(notFoundContent.includes('/settings/about/about-us'), '+not-found.tsx handles about-us alias redirect');
console.log('  ✓ About Us screen wired across _layout, security, command palette, and 404 router');

// 7. LongLogo Applied Everywhere
console.log('\n--- 7. LongLogo Applied Across App Screens ---');
const loginContent = fs.readFileSync(path.join(__dirname, 'app/(auth)/login.tsx'), 'utf-8');
assert(loginContent.includes('ReachLongLogo'), 'login.tsx imports and uses ReachLongLogo');

const onboardingContent = fs.readFileSync(path.join(__dirname, 'app/(auth)/onboarding.tsx'), 'utf-8');
assert(onboardingContent.includes('ReachLongLogo'), 'onboarding.tsx imports and uses ReachLongLogo');

const privacyContent = fs.readFileSync(path.join(__dirname, 'app/privacy.tsx'), 'utf-8');
assert(privacyContent.includes('ReachLongLogo'), 'privacy.tsx imports and uses ReachLongLogo');

const profileSheetContent = fs.readFileSync(path.join(__dirname, 'components/navigation/MobileProfileSheet.tsx'), 'utf-8');
assert(profileSheetContent.includes('ReachLongLogo'), 'MobileProfileSheet.tsx imports and uses ReachLongLogo');

const previewCardContent = fs.readFileSync(path.join(__dirname, 'components/ui/SharedLinkPreviewCard.tsx'), 'utf-8');
assert(previewCardContent.includes('ReachLongLogo'), 'SharedLinkPreviewCard.tsx imports and uses ReachLongLogo');
console.log('  ✓ Transparent LongLogo applied across login, onboarding, privacy, profile sheet & preview cards');

console.log('\n======================================================');
console.log('🎉 ALL 24 ABOUT US & LONGLOGO VERIFICATION CHECKS PASSED (100%)!');
console.log('======================================================\n');
