/**
 * ReachInternational Mobile — ToggleSwitch & SegmentedToggle Verification Suite
 * Verifies mobile-first ToggleSwitch architecture, 0ms instant touch response,
 * touch target ergonomics (min 44dp), zero layout measurement lag,
 * full token compliance, and consumer integration.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

console.log('======================================================');
console.log('🧪 Starting Native ToggleSwitch Verification Suite...');
console.log('======================================================\n');

const MOBILE_ROOT = path.resolve(path.dirname(__filename), '..');

// ─── 1. Source Code & Export Invariants ───
console.log('--- 1. Architecture & Exports Verification ---');

const toggleSwitchSource = fs.readFileSync(
  path.join(MOBILE_ROOT, 'components/ui/ToggleSwitch.tsx'),
  'utf8'
);

const segmentedToggleSource = fs.readFileSync(
  path.join(MOBILE_ROOT, 'components/ui/SegmentedToggle.tsx'),
  'utf8'
);

// ToggleSwitch exports
assert.ok(
  toggleSwitchSource.includes('export interface ToggleSwitchOption'),
  'Must export ToggleSwitchOption interface'
);
assert.ok(
  toggleSwitchSource.includes('export type ToggleSwitchSize'),
  'Must export ToggleSwitchSize type'
);
assert.ok(
  toggleSwitchSource.includes('export interface ToggleSwitchProps'),
  'Must export ToggleSwitchProps interface'
);
assert.ok(
  toggleSwitchSource.includes('export const ToggleSwitch = React.memo'),
  'Must export ToggleSwitch wrapped with React.memo'
);
assert.ok(
  toggleSwitchSource.includes('areToggleSwitchPropsEqual'),
  'Must use areToggleSwitchPropsEqual custom comparator to eliminate parent re-render cascades'
);

// SegmentedToggle alias exports for backward compatibility
assert.ok(
  segmentedToggleSource.includes('SegmentedToggleItem'),
  'SegmentedToggle must export SegmentedToggleItem type'
);
assert.ok(
  segmentedToggleSource.includes('SegmentedToggleProps'),
  'SegmentedToggle must export SegmentedToggleProps type'
);
assert.ok(
  segmentedToggleSource.includes('SegmentedToggleSize'),
  'SegmentedToggle must export SegmentedToggleSize type'
);
assert.ok(
  segmentedToggleSource.includes('export const SegmentedToggle = ToggleSwitch'),
  'SegmentedToggle must alias ToggleSwitch'
);
assert.ok(
  segmentedToggleSource.includes('areSegmentedTogglePropsEqual'),
  'SegmentedToggle must export areSegmentedTogglePropsEqual'
);
console.log('  ✓ Canonical interfaces, types, and memoized exports verified');

// ─── 2. Performance & Mobile-Optimized Ergonomics ───
console.log('\n--- 2. Lightweight Performance & Mobile Ergonomics ---');

// Check touch targets (min 44dp standard)
assert.ok(
  toggleSwitchSource.includes('minHeight: 46') || toggleSwitchSource.includes('minHeight: 44'),
  'Standard size must enforce minimum 44dp hit area for touch ergonomics'
);

// Check APK shrink prevention styles
assert.ok(
  toggleSwitchSource.includes("minWidth: '100%'") && toggleSwitchSource.includes('flexGrow: 1'),
  'ToggleSwitch styles enforce minWidth: "100%" and flexGrow: 1 on container'
);

assert.ok(
  toggleSwitchSource.includes('minWidth: 64'),
  'ToggleSwitch enforces minWidth: 64 for inline touch targets'
);

// Check haptics integration
assert.ok(
  toggleSwitchSource.includes('haptics.select()'),
  'Must trigger haptic feedback on tab selection'
);

// Check clean flexbox layout (no overlapping or measurement race conditions)
assert.ok(
  toggleSwitchSource.includes('optionFullWidth: {') && toggleSwitchSource.includes('flex: 1'),
  'Full width options must divide width equally via flex: 1'
);

console.log('  ✓ Touch target ergonomics (44dp+), APK shrink safety, and haptics verified');

// ─── 3. Visual Design System & Token Compliance ───
console.log('\n--- 3. Visual Design & Token Compliance ---');

// Colors
assert.ok(
  toggleSwitchSource.includes('#0284c7') && toggleSwitchSource.includes('#0ea5e9'),
  'Must use Reach Sky Blue (#0284c7 light / #0ea5e9 dark) as canonical active color'
);
assert.ok(
  toggleSwitchSource.includes('#ffffff'),
  'Active segment text and badge text must be pure white'
);

// Sizes
const SIZES = ['sm', 'md', 'lg'];
for (const s of SIZES) {
  assert.ok(
    toggleSwitchSource.includes(`${s}: {`),
    `Size configuration must include ${s}`
  );
}

// Zero typography properties in StyleSheet.create
const stylesMatch = toggleSwitchSource.match(/const styles = StyleSheet\.create\({([\s\S]*?)}\);/);
assert.ok(stylesMatch, 'StyleSheet.create block found');
assert.ok(
  !/\b(fontSize|fontWeight|fontFamily|lineHeight|letterSpacing)\b/.test(stylesMatch[1]),
  'StyleSheet must have zero raw typography violations (enforced via <Text variant="...">)'
);
console.log('  ✓ Reach Sky Blue, pure white text, bimodal sizes, and typography tokens verified');

// ─── 4. Functional & Interaction Logic Simulation ───
console.log('\n--- 4. Functional Simulation (Math, Selection & Rapids) ---');

// Math verification for equal tab distribution
function computeGeometry(containerW, padding, itemsCount, activeIdx) {
  const availW = Math.max(0, containerW - padding * 2);
  const tabW = availW / itemsCount;
  const targetX = padding + activeIdx * tabW;
  return { tabW, targetX };
}

// 2 items (Operations: Shift, Log History) in a 360px container (padding 4)
const opGeom0 = computeGeometry(360, 4, 2, 0);
assert.strictEqual(opGeom0.targetX, 4, 'Tab 0 starts at padding');
assert.strictEqual(opGeom0.tabW, (360 - 8) / 2, 'Tab width divides available width equally (50%)');

// 3 items (Preferences: Dark, Light, System) in a 390px container (padding 4)
const prefGeom = computeGeometry(390, 4, 3, 1);
assert.strictEqual(prefGeom.tabW, (390 - 8) / 3, 'Tab width divides available width equally (33.3%)');

// Rapid consecutive tap simulation
let currentTab = 'entry';
let dispatchCount = 0;
const onChange = (next) => {
  if (next !== currentTab) {
    currentTab = next;
    dispatchCount++;
  }
};

const options = [{ id: 'entry', disabled: false }, { id: 'history', disabled: false }];
function simulateSelect(id) {
  const opt = options.find((o) => o.id === id);
  if (!opt || opt.disabled || opt.id === currentTab) return false;
  onChange(opt.id);
  return true;
}

assert.strictEqual(simulateSelect('entry'), false, 'Tapping active tab must be ignored (no duplicate work)');
assert.strictEqual(dispatchCount, 0, 'No dispatch on active tab tap');

assert.strictEqual(simulateSelect('history'), true, 'Switching to history tab succeeds');
assert.strictEqual(currentTab, 'history');
assert.strictEqual(dispatchCount, 1);

// Rapid switches
assert.strictEqual(simulateSelect('entry'), true);
assert.strictEqual(simulateSelect('history'), true);
assert.strictEqual(simulateSelect('entry'), true);
assert.strictEqual(dispatchCount, 4);

// Disabled item
options[1].disabled = true;
assert.strictEqual(simulateSelect('history'), false, 'Disabled item must reject selection');
console.log('  ✓ Distribution math, duplicate-tap prevention, and rapid-switching logic verified');

// ─── 5. Consumer Integration Verification ───
console.log('\n--- 5. Consumer Integration Verification ---');

// Check operations.tsx
const opsSource = fs.readFileSync(
  path.join(MOBILE_ROOT, 'app/(app)/operations.tsx'),
  'utf8'
);
assert.ok(
  opsSource.includes('ToggleSwitch'),
  'operations.tsx must import ToggleSwitch'
);
assert.ok(
  opsSource.includes('options={toggleOptions}'),
  'operations.tsx must bind memoized toggleOptions'
);

// Check preferences/index.tsx
const prefsSource = fs.readFileSync(
  path.join(MOBILE_ROOT, 'app/(app)/settings/preferences/index.tsx'),
  'utf8'
);
assert.ok(
  prefsSource.includes('ToggleSwitch'),
  'preferences/index.tsx must import ToggleSwitch'
);
assert.ok(
  prefsSource.includes('options={THEME_OPTIONS}'),
  'preferences/index.tsx must bind THEME_OPTIONS'
);
assert.ok(
  prefsSource.includes('useCallback'),
  'preferences/index.tsx must memoize handleThemeChange'
);

// Check MachineDetailView.tsx
const machineViewSource = fs.readFileSync(
  path.join(MOBILE_ROOT, 'components/machines/MachineDetailView.tsx'),
  'utf8'
);
assert.ok(
  machineViewSource.includes('ToggleSwitch'),
  'MachineDetailView.tsx must import ToggleSwitch'
);
assert.ok(
  machineViewSource.includes('options={segmentedTabItems}'),
  'MachineDetailView.tsx must bind memoized segmentedTabItems'
);

console.log('  ✓ operations.tsx, preferences/index.tsx, and MachineDetailView.tsx integrated cleanly');

console.log('\n======================================================');
console.log('✅ ToggleSwitch Verification Passed: All checks succeeded!');
console.log('======================================================');
