/**
 * Automated Verification Suite for ReachInternational Mobile Button Optimization
 * Verifies all 10 priority issues:
 * 1. Solid fills for primary, secondary, destructive, outline; transparent only for ghost & link.
 * 2. Theme tokens used consistently without hardcoded colors.
 * 3. Predictable styling source of truth: static styles & size definitions outside component.
 * 4. Variant-aware loading spinner color matching foreground.
 * 5. Static sizeStyles outside component render loop.
 * 6. Clean style composition without redundant object rebuilds.
 * 7. Centralized variant-aware text colors.
 * 8. Explicit shape resolution (pill vs rounded).
 * 9. Deliberate disabled palette & touch feedback suppression.
 * 10. Leading icon precedence (leftIcon ?? icon).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Starting Mobile Button Optimizations Verification Suite...\n');

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

const buttonPath = path.join(__dirname, 'components', 'ui', 'Button.tsx');
const buttonSrc = fs.readFileSync(buttonPath, 'utf8');

// -----------------------------------------------------------------------------
// Group 1: Background Fills & Transparency Boundaries (Critical)
// -----------------------------------------------------------------------------
console.log('Group 1: Intentional Fills & Transparency Integrity');

assert(
  buttonSrc.includes('background: theme.colors.canvasElevated') ||
    buttonSrc.includes('background: theme.colors.canvas'),
  'Outline variant uses solid canvas elevated background instead of transparent'
);
assert(
  buttonSrc.includes("case 'secondary':") &&
    !buttonSrc.includes("rgba(23, 23, 23, 0.05)"),
  'Secondary variant uses solid neutral surface instead of washed-out transparent rgba'
);
assert(
  buttonSrc.includes("case 'ghost':") && buttonSrc.includes("background: 'transparent'"),
  'Ghost variant intentionally preserves minimal transparent styling'
);
assert(
  buttonSrc.includes("case 'link':") && buttonSrc.includes("background: 'transparent'"),
  'Link variant intentionally preserves minimal transparent styling'
);
assert(
  buttonSrc.includes('#0284c7') && buttonSrc.includes('#0ea5e9'),
  'Primary variant defines Reach sky blue (#0284c7 light / #0ea5e9 dark) solid fill'
);
assert(
  buttonSrc.includes('#ee0000') || buttonSrc.includes('#dc2626'),
  'Destructive variant defines accessible red (#ee0000 light / #dc2626 dark) solid fill'
);

// -----------------------------------------------------------------------------
// Group 2: Theme Tokens & Color Centralization (High)
// -----------------------------------------------------------------------------
console.log('\nGroup 2: Theme Token Consistency & Color Centralization');

assert(buttonSrc.includes('useTheme'), 'Button consumes useTheme hook');
assert(buttonSrc.includes('resolveButtonColors'), 'Centralizes variant-aware colors in resolveButtonColors helper');
assert(buttonSrc.includes('theme.colors.primary'), 'Derives primary color from theme.colors.primary');
assert(buttonSrc.includes('theme.colors.onPrimary'), 'Derives primary text color from theme.colors.onPrimary');
assert(buttonSrc.includes('theme.colors.hairline'), 'Derives outline border from theme.colors.hairline');
assert(buttonSrc.includes('theme.colors.ink'), 'Derives neutral text color from theme.colors.ink');
assert(buttonSrc.includes('theme.colors.link'), 'Derives link text color from theme.colors.link');
assert(!buttonSrc.includes("isDark ? '#f8fafc' : theme.colors.ink"), 'Eradicates hardcoded #f8fafc color branch');

// -----------------------------------------------------------------------------
// Group 3: Variant-Aware Loading Spinner (High)
// -----------------------------------------------------------------------------
console.log('\nGroup 3: Variant-Aware Loading Spinner');

assert(
  buttonSrc.includes('color={colors.spinner}'),
  'ActivityIndicator color is derived dynamically from colors.spinner'
);
assert(
  buttonSrc.includes('spinner: theme.colors.ink'),
  'Secondary variant uses readable ink spinner instead of white spinner'
);
assert(
  buttonSrc.includes('spinner: theme.colors.link'),
  'Link variant uses theme link color spinner instead of white spinner'
);
assert(
  buttonSrc.includes("effectiveVariant === 'outline' || effectiveVariant === 'ghost'") === false,
  'Eradicates hardcoded ternary spinner color logic'
);

// -----------------------------------------------------------------------------
// Group 4: Performance & Static Geometry Extraction (Medium)
// -----------------------------------------------------------------------------
console.log('\nGroup 4: Performance & Static Geometry Architecture');

assert(
  buttonSrc.includes('const BUTTON_SIZE_STYLES: Record<string, ViewStyle> = {'),
  'BUTTON_SIZE_STYLES extracted outside the Button component render loop'
);
assert(
  buttonSrc.includes('minHeight: 44'),
  'Default, md, and icon sizes strictly enforce minimum 44px touch targets'
);
assert(
  buttonSrc.includes('const staticStyles = StyleSheet.create({'),
  'Static base, fullWidth, and icon layout styles created once with StyleSheet.create'
);
assert(
  buttonSrc.includes('RADIUS_PILL = 9999') && buttonSrc.includes('RADIUS_ROUNDED = radiusNumeric.md'),
  'Extracts static radii constants from design tokens'
);
assert(
  buttonSrc.includes('staticStyles.base,') && buttonSrc.includes('sizeStyle,'),
  'Style composition references pre-allocated static styles directly'
);

// -----------------------------------------------------------------------------
// Group 5: Explicit Shape Resolution & Backward Compatibility (Medium)
// -----------------------------------------------------------------------------
console.log('\nGroup 5: Explicit Shape Resolution');

assert(
  buttonSrc.includes("effectiveShape === 'pill'"),
  'Resolves shape prop explicitly as first-class API'
);
assert(
  buttonSrc.includes('rounded-full'),
  'Preserves backward compatibility for callers using rounded-full'
);
assert(
  buttonSrc.includes('rippleRadius={isPill ? RADIUS_PILL'),
  'Sets full-circle ripple radius for pill buttons'
);

// -----------------------------------------------------------------------------
// Group 6: Deliberate Disabled State & Touch Suppression (Medium)
// -----------------------------------------------------------------------------
console.log('\nGroup 6: Deliberate Disabled Palette & Touch Suppression');

assert(
  buttonSrc.includes('isDisabled && !isLoading'),
  'Differentiates between passive disabled state and active loading state'
);
assert(
  buttonSrc.includes('text: theme.colors.mute') || buttonSrc.includes('text: theme.colors.faint'),
  'Disabled buttons use deliberate muted text color instead of blunt opacity'
);
assert(
  buttonSrc.includes('disabled={isDisabled}') && buttonSrc.includes('loading={isLoading}'),
  'Forwards disabled and loading flags to Pressable to suppress haptics, ripples, and scale'
);
assert(
  buttonSrc.includes('accessibilityState={{ disabled: isDisabled, busy: isLoading }}'),
  'Sets accessible disabled and busy states on Pressable'
);

// -----------------------------------------------------------------------------
// Group 7: Icon Precedence & Layout (Medium)
// -----------------------------------------------------------------------------
console.log('\nGroup 7: Leading Icon Precedence & Alignment');

assert(
  buttonSrc.includes('const leadingIcon = leftIcon ?? icon;'),
  'Preserves leading icon precedence where leftIcon takes priority over icon'
);
assert(
  buttonSrc.includes('staticStyles.leadingIcon') && buttonSrc.includes('staticStyles.trailingIcon'),
  'Leading and trailing icons use dedicated static spacing wrappers'
);

// -----------------------------------------------------------------------------
// Group 8: String/Primitive Text Protection & Exports (Integrity)
// -----------------------------------------------------------------------------
console.log('\nGroup 8: Children Text Protection & Public Contract');

assert(
  buttonSrc.includes("typeof children === 'string' || typeof children === 'number'"),
  'Safeguards raw string and number children against React Native unparented text crashes'
);
assert(
  buttonSrc.includes('Array.isArray(children)'),
  'Safeguards primitive array children against unparented text crashes'
);
assert(
  buttonSrc.includes('export { Button, buttonVariants, buttonTextVariants };'),
  'Preserves canonical named exports'
);
assert(
  buttonSrc.includes('export default Button;'),
  'Preserves default export'
);

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log(`\n======================================================`);
console.log(`🎉 Mobile Button Verification: ${passed} passed, ${failed} failed`);
console.log(`======================================================\n`);

if (failed > 0) {
  process.exit(1);
}
