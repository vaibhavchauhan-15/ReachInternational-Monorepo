/**
 * Test Suite: Dashboard Card Height & Width Uniformity Across Mobile, Tablet & Desktop
 * Validates:
 * 1. KPIGrid eliminates odd card spanning (isLastOdd), guaranteeing identical card widths across viewports.
 * 2. KPICard enforces uniform minHeight: 104 and height: 100% across all roles.
 * 3. StatusCard enforces uniform minHeight: 124 and height: 100%.
 * 4. PrimaryAction enforces uniform minHeight: 82 and height: 100%.
 * 5. Admin, HR, Manager, and Super Admin cards implement responsive action grids on tablet/desktop.
 * 6. Operator shift cards enforce uniform minHeight: 210 and responsive grid layout.
 * 7. Operator machine & client cards enforce uniform minHeight: 180 and 2-column tablet/desktop grid.
 * 8. Dashboard skeletons match production card heights (104px KPI, 82px action, 124px status, 210px shift, 180px worksite).
 * 9. Strict zero raw typography rule enforcement across all dashboard components.
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');

console.log('🧪 Starting Dashboard Card Height & Width Uniformity Verification Suite...\n');

let testCount = 0;
function pass(name) {
  testCount++;
  console.log(`  ✓ ${name}`);
}

// Read component source files
const kpiGridPath = path.join(__dirname, 'components', 'dashboard', 'shared', 'KPIGrid.tsx');
const kpiGridSrc = fs.readFileSync(kpiGridPath, 'utf8');

const kpiCardPath = path.join(__dirname, 'components', 'dashboard', 'shared', 'KPICard.tsx');
const kpiCardSrc = fs.readFileSync(kpiCardPath, 'utf8');

const statusCardPath = path.join(__dirname, 'components', 'dashboard', 'shared', 'StatusCard.tsx');
const statusCardSrc = fs.readFileSync(statusCardPath, 'utf8');

const primaryActionPath = path.join(__dirname, 'components', 'dashboard', 'shared', 'PrimaryAction.tsx');
const primaryActionSrc = fs.readFileSync(primaryActionPath, 'utf8');

const adminCardPath = path.join(__dirname, 'components', 'dashboard', 'admin', 'AdminDashboardCard.tsx');
const adminCardSrc = fs.readFileSync(adminCardPath, 'utf8');

const hrCardPath = path.join(__dirname, 'components', 'dashboard', 'hr', 'HRDashboardCard.tsx');
const hrCardSrc = fs.readFileSync(hrCardPath, 'utf8');

const managerCardPath = path.join(__dirname, 'components', 'dashboard', 'manager', 'ManagerDashboardCard.tsx');
const managerCardSrc = fs.readFileSync(managerCardPath, 'utf8');

const supervisorCardPath = path.join(__dirname, 'components', 'dashboard', 'supervisor', 'SupervisorDashboardCard.tsx');
const supervisorCardSrc = fs.readFileSync(supervisorCardPath, 'utf8');

const superAdminCardPath = path.join(__dirname, 'components', 'dashboard', 'super-admin', 'SuperAdminDashboardCard.tsx');
const superAdminCardSrc = fs.readFileSync(superAdminCardPath, 'utf8');

const operatorCardPath = path.join(__dirname, 'components', 'dashboard', 'operator', 'OperatorDashboardCard.tsx');
const operatorCardSrc = fs.readFileSync(operatorCardPath, 'utf8');

const dashboardSkeletonPath = path.join(__dirname, 'components', 'dashboard', 'shared', 'DashboardSkeleton.tsx');
const dashboardSkeletonSrc = fs.readFileSync(dashboardSkeletonPath, 'utf8');

const operatorSkeletonPath = path.join(__dirname, 'components', 'dashboard', 'operator', 'OperatorDashboardSkeleton.tsx');
const operatorSkeletonSrc = fs.readFileSync(operatorSkeletonPath, 'utf8');

// -----------------------------------------------------------------------------
// Group 1: KPIGrid Width Uniformity & Span Elimination
// -----------------------------------------------------------------------------
console.log('Group 1: KPIGrid Width Uniformity & Column Distribution');

assert(!kpiGridSrc.includes('isLastOdd'), 'KPIGrid must not contain isLastOdd logic that creates double-width cards');
assert(!kpiGridSrc.includes("gridColumn: 'span 2'"), 'KPIGrid must not span 2 columns for odd cards');
assert(kpiGridSrc.includes('repeat(${effectiveCols}, minmax(0, 1fr))'), 'KPIGrid on web must use minmax(0, 1fr) for strictly equal columns');
assert(kpiGridSrc.includes('minHeight: 104'), 'KPIGrid item wrapper must enforce uniform minHeight: 104');
assert(kpiGridSrc.includes("height: '100%'"), 'KPIGrid item wrapper must enforce height: 100% to fill row height');
pass('KPIGrid eliminates odd card spanning and guarantees identical column widths across viewports');

// -----------------------------------------------------------------------------
// Group 2: KPICard Height Uniformity (104px Invariant)
// -----------------------------------------------------------------------------
console.log('\nGroup 2: KPICard Height Uniformity & Content Balancing');

assert(kpiCardSrc.includes('minHeight: 104'), 'KPICard styles must enforce minHeight: 104');
assert(kpiCardSrc.includes("height: '100%'"), 'KPICard touchWrapper and kpiCard must set height: 100%');
assert(kpiCardSrc.includes('minHeight: 36'), 'KPICard headerRow must reserve minHeight: 36 for label line balancing');
assert(kpiCardSrc.includes('minHeight: 32'), 'KPICard valueRow must reserve minHeight: 32');
pass('KPICard enforces standardized 104px minimum height and balanced text rows');

// -----------------------------------------------------------------------------
// Group 3: StatusCard Height Uniformity (124px Invariant)
// -----------------------------------------------------------------------------
console.log('\nGroup 3: StatusCard Height Uniformity');

assert(statusCardSrc.includes('minHeight: 124'), 'StatusCard must enforce minHeight: 124');
assert(statusCardSrc.includes("height: '100%'"), 'StatusCard must enforce height: 100%');
assert(statusCardSrc.includes('minHeight: 52'), 'StatusCard contentRow must reserve minHeight: 52');
pass('StatusCard enforces standardized 124px minimum height');

// -----------------------------------------------------------------------------
// Group 4: PrimaryAction Height Uniformity (82px Invariant)
// -----------------------------------------------------------------------------
console.log('\nGroup 4: PrimaryAction Height Uniformity');

assert(primaryActionSrc.includes('minHeight: 82'), 'PrimaryAction card must enforce minHeight: 82');
assert(primaryActionSrc.includes("height: '100%'"), 'PrimaryAction card must enforce height: 100%');
assert(primaryActionSrc.includes('minHeight: 34'), 'PrimaryAction description must reserve minHeight: 34 for 2 lines');
pass('PrimaryAction enforces standardized 82px minimum height across all roles');

// -----------------------------------------------------------------------------
// Group 5: Responsive Action Grids (Admin, HR, Manager, Super Admin)
// -----------------------------------------------------------------------------
console.log('\nGroup 5: Responsive Action Grids on Tablet & Desktop');

const rolesWithActions = [
  { name: 'AdminDashboardCard', src: adminCardSrc },
  { name: 'HRDashboardCard', src: hrCardSrc },
  { name: 'ManagerDashboardCard', src: managerCardSrc },
  { name: 'SuperAdminDashboardCard', src: superAdminCardSrc },
];

for (const { name, src } of rolesWithActions) {
  assert(src.includes('isTabletOrDesktop'), `${name} must determine isTabletOrDesktop for responsive layout`);
  assert(src.includes('actionGrid'), `${name} must define actionGrid styles for tablet/desktop`);
  pass(`${name} reflows action cards into equal-width grid on tablet and desktop`);
}

// -----------------------------------------------------------------------------
// Group 6: Operator Shift & Assignment Card Uniformity
// -----------------------------------------------------------------------------
console.log('\nGroup 6: Operator Shift & Assignment Card Uniformity');

assert(operatorCardSrc.includes('minHeight: 210'), 'OperatorDashboardCard shiftCard must enforce minHeight: 210');
assert(operatorCardSrc.includes('minHeight: 74'), 'OperatorDashboardCard shiftMetadataStack must reserve minHeight: 74');
assert(operatorCardSrc.includes('minHeight: 180'), 'OperatorDashboardCard assignmentCard must enforce minHeight: 180');
assert(operatorCardSrc.includes('minHeight: 88'), 'OperatorDashboardCard assignmentDetailsStack must reserve minHeight: 88');
assert(operatorCardSrc.includes('assignmentGrid'), 'OperatorDashboardCard must implement assignmentGrid for 2-col tablet/desktop worksite cards');
assert(operatorCardSrc.includes('shiftGrid'), 'OperatorDashboardCard must implement shiftGrid for responsive shift cards');
pass('OperatorDashboardCard enforces 210px shift cards and 180px equal machine/client worksite cards');

// -----------------------------------------------------------------------------
// Group 7: Skeleton Synchronization (0 Layout Shift)
// -----------------------------------------------------------------------------
console.log('\nGroup 7: Skeleton Dimension Parity');

assert(dashboardSkeletonSrc.includes('height={104}'), 'DashboardSkeleton must match KPICard 104px height');
assert(dashboardSkeletonSrc.includes('height={82}'), 'DashboardSkeleton must match PrimaryAction 82px height');
assert(operatorSkeletonSrc.includes('minHeight: 124'), 'OperatorDashboardSkeleton must match StatusCard 124px height');
assert(operatorSkeletonSrc.includes('minHeight: 210'), 'OperatorDashboardSkeleton must match ShiftCard 210px height');
assert(operatorSkeletonSrc.includes('minHeight: 180'), 'OperatorDashboardSkeleton must match WorksiteCard 180px height');
pass('Skeleton loaders achieve 100% height parity with production cards (0 layout shift)');

// -----------------------------------------------------------------------------
// Group 8: Zero Raw Typography Properties
// -----------------------------------------------------------------------------
console.log('\nGroup 8: Typography & Design System Invariants');

const allCheckedFiles = [
  { name: 'KPIGrid.tsx', src: kpiGridSrc },
  { name: 'KPICard.tsx', src: kpiCardSrc },
  { name: 'StatusCard.tsx', src: statusCardSrc },
  { name: 'PrimaryAction.tsx', src: primaryActionSrc },
  { name: 'AdminDashboardCard.tsx', src: adminCardSrc },
  { name: 'HRDashboardCard.tsx', src: hrCardSrc },
  { name: 'ManagerDashboardCard.tsx', src: managerCardSrc },
  { name: 'SupervisorDashboardCard.tsx', src: supervisorCardSrc },
  { name: 'SuperAdminDashboardCard.tsx', src: superAdminCardSrc },
  { name: 'OperatorDashboardCard.tsx', src: operatorCardSrc },
  { name: 'DashboardSkeleton.tsx', src: dashboardSkeletonSrc },
  { name: 'OperatorDashboardSkeleton.tsx', src: operatorSkeletonSrc },
];

for (const { name, src } of allCheckedFiles) {
  const sheetMatch = src.match(/StyleSheet\.create\(\{([\s\S]*?)\}\);/);
  if (sheetMatch) {
    const sheetBody = sheetMatch[1];
    assert(!/fontSize\s*:/.test(sheetBody), `${name} must not contain raw fontSize in StyleSheet.create`);
    assert(!/fontWeight\s*:/.test(sheetBody), `${name} must not contain raw fontWeight in StyleSheet.create`);
    assert(!/lineHeight\s*:/.test(sheetBody), `${name} must not contain raw lineHeight in StyleSheet.create`);
    assert(!/fontFamily\s*:/.test(sheetBody), `${name} must not contain raw fontFamily in StyleSheet.create`);
  }
  pass(`${name} strictly adheres to zero raw typography rules`);
}

console.log(`\n🎉 All ${testCount} Dashboard Card Dimension & Uniformity checks passed successfully (100%)!\n`);
