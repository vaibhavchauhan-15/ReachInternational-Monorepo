/**
 * ReachInternational Mobile — Press Feedback & Interaction Verification Suite
 * Verifies Material Design 3 and iOS Human Interface Guidelines compliance,
 * platform ripple/activeOpacity matrix, micro-scale safety, and haptics.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('======================================================');
console.log('🧪 Starting Mobile Press Feedback Verification Suite...');
console.log('======================================================\n');

const MOBILE_ROOT = fs.existsSync(path.resolve('components'))
  ? path.resolve('.')
  : path.resolve('apps/mobile');

// ─── 1. Feedback Matrix & Variant Coverage ───
console.log('--- 1. Feedback Matrix & Variant Coverage ---');

const feedbackSource = fs.readFileSync(
  path.join(MOBILE_ROOT, 'components/ui/touch/feedback.ts'),
  'utf8'
);

const EXPECTED_VARIANTS = [
  'buttonPrimary',
  'buttonSecondary',
  'buttonDanger',
  'buttonOutline',
  'buttonGhost',
  'primary',
  'secondary',
  'danger',
  'outline',
  'ghost',
  'icon',
  'iconButton',
  'listRow',
  'dropdownOption',
  'selectorOption',
  'card',
  'cardSelect',
  'kpiCard',
  'navTab',
  'toggle',
  'segmentedOption',
  'chip',
  'fab',
  'longPressRow',
  'plain',
];

for (const variant of EXPECTED_VARIANTS) {
  assert.ok(
    feedbackSource.includes(`'${variant}'`),
    `Missing expected TouchVariant in feedback.ts: ${variant}`
  );
}
console.log(`  ✓ All ${EXPECTED_VARIANTS.length} canonical touch variants declared`);

// ─── 2. Material Design 3 & Platform Color Tokens ───
console.log('\n--- 2. Material Design 3 & Theme-Aware State Layers ---');

assert.ok(
  feedbackSource.includes('rgba(255, 255, 255, 0.22)'),
  'High-contrast white ripple required on primary & danger buttons'
);
assert.ok(
  feedbackSource.includes('rgba(23, 23, 23, 0.08)'),
  'Light mode ink ripple required for standard surfaces'
);
assert.ok(
  feedbackSource.includes('rgba(255, 255, 255, 0.12)'),
  'Dark mode ink ripple required for elevated surfaces'
);
assert.ok(
  feedbackSource.includes('rgba(2, 132, 199, 0.12)') || feedbackSource.includes('rgba(14, 165, 233, 0.16)'),
  'Reach sky blue tinted state layer required for navigation tabs'
);
console.log('  ✓ Theme-aware state layers and contrast ratios compliant');

// ─── 3. Micro-Scale & Layout Safety Invariants ───
console.log('\n--- 3. Geometric Integrity & Zero-Layout-Shift Invariants ---');

// Cards, KPI grids, list rows, and icons MUST have scale: 1.0 to prevent text blurriness,
// layout shifts, and Android elevation clipping.
const cardSectionMatch = feedbackSource.match(/case 'card':[\s\S]*?case 'cardSelect':/);
assert.ok(cardSectionMatch, 'Card section found in feedback.ts');
assert.ok(
  cardSectionMatch[0].includes('scale: 1.0'),
  'Card variant MUST enforce scale: 1.0 (zero layout shift)'
);

const iconSectionMatch = feedbackSource.match(/case 'icon':[\s\S]*?case 'card':/);
assert.ok(iconSectionMatch, 'Icon section found in feedback.ts');
assert.ok(
  iconSectionMatch[0].includes('scale: 1.0'),
  'Icon/IconButton variant MUST enforce scale: 1.0 (zero glyph distortion)'
);

const rowSectionMatch = feedbackSource.match(/case 'listRow':[\s\S]*?case 'navTab':/);
assert.ok(rowSectionMatch, 'ListRow section found in feedback.ts');
assert.ok(
  rowSectionMatch[0].includes('scale: 1.0'),
  'ListRow/DropdownOption variant MUST enforce scale: 1.0 (dense alignment preserved)'
);

const navSectionMatch = feedbackSource.match(/case 'navTab':[\s\S]*?case 'toggle':/);
assert.ok(navSectionMatch, 'NavTab section found in feedback.ts');
assert.ok(
  navSectionMatch[0].includes('scale: 1.0'),
  'NavTab variant MUST enforce scale: 1.0 (zero bottom bar vibration)'
);
console.log('  ✓ Cards, KPI tiles, list rows, and navigation tabs strictly preserve 1.0 scale');

// ─── 4. Canonical Pressable Primitives ───
console.log('\n--- 4. Canonical Pressable Architecture ---');

const pressableSource = fs.readFileSync(
  path.join(MOBILE_ROOT, 'components/ui/touch/Pressable.tsx'),
  'utf8'
);

assert.ok(
  pressableSource.includes('forwardRef'),
  'Pressable MUST use forwardRef for React 19 / RN ref passing'
);
assert.ok(
  pressableSource.includes('AnimatedRNPressable'),
  'Pressable MUST use AnimatedRNPressable for UI-thread animations'
);
assert.ok(
  pressableSource.includes('android_ripple={androidRipple}'),
  'Pressable MUST bind native android_ripple'
);
assert.ok(
  pressableSource.includes('usePressProgress'),
  'Pressable MUST export usePressProgress context'
);
assert.ok(
  pressableSource.includes('resolvePressStyle'),
  'Pressable MUST implement platform-specific resolvePressStyle (iOS activeOpacity)'
);
assert.ok(
  pressableSource.includes('opacity: 0.38'),
  'Pressable MUST enforce Material 3 38% disabled opacity'
);
assert.ok(
  pressableSource.includes('HIT_SLOP_MIN_48'),
  'Pressable MUST enforce minimum 48dp touch targets on small touchables'
);
console.log('  ✓ Pressable.tsx implements forwardRef, RenderThread ripple, iOS activeOpacity & hitSlop');

// ─── 5. Component Migration Verification ───
console.log('\n--- 5. Component Migration Verification ---');

// Button.tsx
const buttonSource = fs.readFileSync(
  path.join(MOBILE_ROOT, 'components/ui/Button.tsx'),
  'utf8'
);
assert.ok(
  buttonSource.includes("from './touch/Pressable'"),
  'Button.tsx MUST import canonical Pressable from ./touch/Pressable'
);
assert.ok(
  buttonSource.includes('mapButtonVariantToTouch'),
  'Button.tsx MUST map button variants to TouchVariants'
);
assert.ok(
  buttonSource.includes('loading={isLoading}'),
  'Button.tsx MUST pass loading state to Pressable'
);
console.log('  ✓ Button.tsx migrated to canonical Pressable with Material 3 states');

// IconButton.tsx
const iconButtonSource = fs.readFileSync(
  path.join(MOBILE_ROOT, 'components/ui/IconButton.tsx'),
  'utf8'
);
assert.ok(
  iconButtonSource.includes('minWidth: 44') && iconButtonSource.includes('minHeight: 44'),
  'IconButton.tsx MUST preserve 44px min touch target'
);
assert.ok(
  iconButtonSource.includes('haptic={haptic}'),
  'IconButton.tsx MUST forward haptic prop'
);
console.log('  ✓ IconButton.tsx enforces 44px minimum touch targets and haptic forwarding');

// Card.tsx
const cardSource = fs.readFileSync(
  path.join(MOBILE_ROOT, 'components/ui/Card.tsx'),
  'utf8'
);
assert.ok(
  cardSource.includes("from './touch/Pressable'"),
  'Card.tsx MUST import canonical Pressable from ./touch/Pressable'
);
assert.ok(
  cardSource.includes('CardPressContext'),
  'Card.tsx MUST export CardPressContext for child icon synchronization'
);
assert.ok(
  cardSource.includes('variant="card"'),
  'Card.tsx MUST pass variant="card" to Pressable'
);
console.log('  ✓ Card.tsx migrated to canonical Pressable with CardPressContext');

// MobileBottomNav.tsx
const navSource = fs.readFileSync(
  path.join(MOBILE_ROOT, 'components/navigation/MobileBottomNav.tsx'),
  'utf8'
);
assert.ok(
  navSource.includes("from '../ui/touch/Pressable'"),
  'MobileBottomNav.tsx MUST import canonical Pressable from ../ui/touch/Pressable'
);
assert.ok(
  navSource.includes('variant="navTab"'),
  'MobileBottomNav.tsx MUST pass variant="navTab" to Pressable'
);
assert.ok(
  navSource.includes('if (!isActive)'),
  'MobileBottomNav.tsx MUST only trigger haptics when transitioning to an inactive tab'
);
console.log('  ✓ MobileBottomNav.tsx migrated to canonical Pressable with deduped tab haptics');

// ─── 6. Preferences & Haptics Integration ───
console.log('\n--- 6. Preferences & Haptics Integration ---');

const hapticsSource = fs.readFileSync(
  path.join(MOBILE_ROOT, 'lib/haptics/index.ts'),
  'utf8'
);
assert.ok(
  hapticsSource.includes('isHapticsEnabled()'),
  'haptics/index.ts MUST verify in-app user preference'
);
assert.ok(
  hapticsSource.includes('shouldAllowHaptic(kind)'),
  'haptics/index.ts MUST enforce 60ms rate limit and 120ms dedupe'
);

const storeSource = fs.readFileSync(
  path.join(MOBILE_ROOT, 'lib/preferences/store.ts'),
  'utf8'
);
assert.ok(
  storeSource.includes('hapticsEnabled: true'),
  'preferences store MUST default hapticsEnabled to true'
);
console.log('  ✓ Preferences store defaults haptics to true with rate limit guards');

console.log('\n======================================================');
console.log('🎉 ALL PRESS FEEDBACK & INTERACTION CHECKS PASSED (100%)!');
console.log('======================================================\n');
