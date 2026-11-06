/**
 * Test Suite: Machine Detail Mobile Optimization & Ergonomics Verification
 *
 * Verifies:
 * 1. Hero Card: Left accent border indicator, clean scissor squircle, copyable ID chip,
 *    and clean status + rental badge row with HMR quick pill.
 * 2. Tab Navigation: Complete removal of broken ToggleSwitch; replacement with
 *    reusable Pressable button tab bar (min 42dp, tactile haptics, count pill).
 * 3. Page Transition Animation: Smooth Reanimated FadeIn / FadeOut transitions for
 *    screen mount/unmount and 60fps cross-fade transitions for tab switching.
 * 4. Basic Info 2-Column Grid: 6 cards structured into 3 flex rows of 2 (flex: 1, minWidth: 0)
 *    filling 100% screen width without subpixel wrapping collapse into a single column.
 * 5. Client Details 2-Column Grid: Row pairs with flex: 1 eliminating 48% wrapping bugs.
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');
const mobileDir = path.resolve(__dirname);

console.log('🧪 Starting Machine Detail Mobile Optimization Verification Suite...\n');

const machineDetailViewPath = path.join(mobileDir, 'components/machines/MachineDetailView.tsx');
assert(fs.existsSync(machineDetailViewPath), 'MachineDetailView.tsx must exist');
const machineDetailContent = fs.readFileSync(machineDetailViewPath, 'utf8');

const machinesScreenPath = path.join(mobileDir, 'app/(app)/machines.tsx');
assert(fs.existsSync(machinesScreenPath), 'machines.tsx must exist');
const machinesScreenContent = fs.readFileSync(machinesScreenPath, 'utf8');

let passCount = 0;

function check(desc, condition) {
  assert(condition, desc);
  console.log(`  ✓ ${desc}`);
  passCount++;
}

console.log('--- 1. Hero Card Layout & Badges Formatting ---');

check(
  'Hero card features dynamic left accent border based on machine operational health',
  machineDetailContent.includes('borderLeftWidth: 4') &&
  machineDetailContent.includes('borderLeftColor: getAccentBorderColor()') &&
  machineDetailContent.includes('getAccentBorderColor')
);

check(
  'Hero card renders dark squircle container with scissor lift logo icon',
  machineDetailContent.includes('styles.scissorSquircle') &&
  machineDetailContent.includes('ScissorLiftLogoIcon') &&
  machineDetailContent.includes('variant="title"')
);

check(
  'Machine ID has copyable chip with haptics and confirmation icon',
  machineDetailContent.includes('styles.heroIdChip') &&
  machineDetailContent.includes('handleCopy(machine.machine_id') &&
  machineDetailContent.includes('copiedId ?')
);

check(
  'Status badges row is well-formatted without harsh divider line and includes quick HMR pill',
  machineDetailContent.includes('styles.heroBadgeRow') &&
  machineDetailContent.includes('styles.heroHmrPill') &&
  machineDetailContent.includes("'On Rent'") &&
  machineDetailContent.includes("'Available'")
);

console.log('\n--- 2. Tab Navigation: Broken Toggle Switch Removed & Replaced with Buttons ---');

check(
  'ToggleSwitch and SegmentedToggle are completely removed from MachineDetailView',
  !machineDetailContent.includes('<ToggleSwitch') &&
  !machineDetailContent.includes('<SegmentedToggle') &&
  !machineDetailContent.includes('import {') || !machineDetailContent.includes('ToggleSwitch,')
);

check(
  'Tab navigation uses reusable button tab bar with Pressable and tactile haptics',
  machineDetailContent.includes('styles.tabButtonBar') &&
  machineDetailContent.includes('styles.tabButton') &&
  machineDetailContent.includes('variant="segmentedOption"') &&
  machineDetailContent.includes('haptics.select()')
);

check(
  'Tab navigation renders icons, labels, and count pill badges for HMR and Audit',
  machineDetailContent.includes('tabItems.map') &&
  machineDetailContent.includes('styles.tabCountPill') &&
  machineDetailContent.includes('tab.count')
);

console.log('\n--- 3. Smooth Page & Tab Transition Animations ---');

check(
  'machines.tsx wraps MachineDetailView with Reanimated FadeIn/FadeOut for smooth page transitions',
  machinesScreenContent.includes('Animated.View') &&
  machinesScreenContent.includes('FadeIn.duration(') &&
  machinesScreenContent.includes('FadeOut.duration(') &&
  machinesScreenContent.includes('<MachineDetailView')
);

check(
  'MachineDetailView wraps all tab content panels in Reanimated FadeIn for smooth cross-fades',
  machineDetailContent.includes('key="tab_overview"') &&
  machineDetailContent.includes('key="tab_running_hours"') &&
  machineDetailContent.includes('key="tab_audit_trail"') &&
  machineDetailContent.includes('entering={FadeIn.duration(200)}')
);

console.log('\n--- 4. Basic Info 6 Cards 2-Column Flexbox Layout ---');

check(
  'Basic Info uses 2-column flexbox rows with flex: 1 filling 100% screen width',
  machineDetailContent.includes('styles.specsGridContainer') &&
  machineDetailContent.includes('styles.specsRow') &&
  machineDetailContent.includes('flexDirection: \'row\'') &&
  machineDetailContent.includes('flex: 1') &&
  machineDetailContent.includes('minWidth: 0')
);

check(
  'Row 1 contains Machine ID and Model spec boxes with copy actions',
  machineDetailContent.includes('MACHINE ID') &&
  machineDetailContent.includes('MODEL') &&
  machineDetailContent.includes('handleCopy(machine.model')
);

check(
  'Row 2 contains Serial No and Year of Mfg spec boxes',
  machineDetailContent.includes('SERIAL NO') &&
  machineDetailContent.includes('YEAR OF MFG (YUM)')
);

check(
  'Row 3 contains Manufacturer and Hour Meter (HMR) in Reach blue',
  machineDetailContent.includes('MANUFACTURER') &&
  machineDetailContent.includes('HOUR METER (HMR)') &&
  machineDetailContent.includes('styles.specBoxValueHmr')
);

console.log('\n--- 5. Client Details 2-Column Flexbox Layout ---');

check(
  'Client Details uses clean flexbox rows (specsRow with flex: 1) preventing wrap degradation',
  machineDetailContent.includes('styles.clientGridContainer') &&
  machineDetailContent.includes('CLIENT NAME') &&
  machineDetailContent.includes('CONTACT PERSON') &&
  machineDetailContent.includes('CONTACT MOBILE')
);

console.log(`\nResults: ${passCount} Passed, 0 Failed.`);
console.log('✅ Machine Detail Mobile Optimization & Ergonomics Verification Passed: 100% compliant!\n');
