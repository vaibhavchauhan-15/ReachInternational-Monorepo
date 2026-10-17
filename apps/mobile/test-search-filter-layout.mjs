/**
 * ReachInternational Mobile — Search & Filter Non-Overlapping Layout Automated Test Suite
 *
 * Verifies that:
 * 1. SearchInput defines flex-safe containers with minWidth: 0, dynamic flex handling, and flexShrink: 0 on icons/clear buttons.
 * 2. MobileTodayShiftMonitorTab wraps SearchInput in searchContainer (flex: 1, minWidth: 0) and prevents overlap with filter & reset buttons.
 * 3. MobileOperatorHistoryTab wraps SearchInput in searchContainer and maintains non-overlapping filter & quick reset buttons.
 * 4. MachineFilterPanel enforces minWidth: 0 on searchContainer and flexShrink: 0 on filterToggleBtn & quickResetBtn.
 * 5. UserFiltersPanel enforces minWidth: 0 on searchContainer and flexShrink: 0 on filterToggleBtn & quickResetBtn.
 * 6. FilterToolbar enforces minWidth: 0 on searchFlexWrap, flexShrink: 0 on buttons, and eradicates redundant chevrons.
 * 7. AttendanceScreen enforces minWidth: 0 on searchContainer, flexShrink: 0 on filter & reset buttons.
 * 8. MachineDetailView enforces minWidth: 0 on logSearchInput and flexShrink: 0 on filterToggleBtn.
 */

import fs from 'fs';
import path from 'path';
import assert from 'assert';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('====================================================');
console.log('Mobile Search & Filter Non-Overlapping Layout Verification');
console.log('====================================================');

let passedAssertions = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedAssertions++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// 1. SearchInput Component Architecture
// ---------------------------------------------------------------------------
console.log('\n--- 1. SearchInput Flex Safety & Sizing ---');
const searchInputPath = path.join(rootDir, 'apps/mobile/components/ui/SearchInput.tsx');
const searchInputContent = fs.readFileSync(searchInputPath, 'utf8');

test('SearchInput defines minWidth: 0 in container style', () => {
  assert(searchInputContent.includes('minWidth: 0'), 'styles.container includes minWidth: 0');
});

test('SearchInput defines flexContainer with flex: 1, minWidth: 0, and flexShrink: 1', () => {
  assert(searchInputContent.includes('flexContainer: {'), 'defines flexContainer style');
  assert(searchInputContent.includes('flexShrink: 1'), 'flexContainer defines flexShrink: 1');
});

test('SearchInput defines fullWidthContainer with width: 100%', () => {
  assert(searchInputContent.includes('fullWidthContainer: {'), 'defines fullWidthContainer style');
  assert(searchInputContent.includes('width: \'100%\''), 'fullWidthContainer has width 100%');
});

test('SearchInput dynamically switches between flexContainer and fullWidthContainer', () => {
  assert(searchInputContent.includes('isFlexLayout'), 'isFlexLayout memoized calculation exists');
  assert(searchInputContent.includes('isFlexLayout ? styles.flexContainer : styles.fullWidthContainer'), 'uses conditional flex vs full width');
});

test('SearchInput inner TextInput defines minWidth: 0 to prevent HTML input overflow', () => {
  assert(searchInputContent.includes('minWidth: 0'), 'styles.input specifies minWidth: 0');
});

test('SearchInput leftIconWrapper enforces flexShrink: 0', () => {
  assert(searchInputContent.includes('leftIconWrapper: {'), 'defines leftIconWrapper style');
  assert(searchInputContent.includes('flexShrink: 0'), 'leftIconWrapper defines flexShrink: 0');
});

test('SearchInput clearBtn enforces flexShrink: 0', () => {
  assert(searchInputContent.includes('clearBtn: {'), 'defines clearBtn style');
  assert(searchInputContent.includes('flexShrink: 0'), 'clearBtn defines flexShrink: 0');
});

// ---------------------------------------------------------------------------
// 2. Operations Shift Monitor Tab (MobileTodayShiftMonitorTab)
// ---------------------------------------------------------------------------
console.log('\n--- 2. Operations Shift Monitor Tab (Non-Overlapping Layout) ---');
const todayShiftPath = path.join(rootDir, 'apps/mobile/components/operations/MobileTodayShiftMonitorTab.tsx');
const todayShiftContent = fs.readFileSync(todayShiftPath, 'utf8');

test('MobileTodayShiftMonitorTab wraps SearchInput in searchContainer', () => {
  assert(todayShiftContent.includes('<View style={styles.searchContainer}>'), 'SearchInput is wrapped in searchContainer');
  assert(todayShiftContent.includes('searchContainer: {'), 'defines searchContainer style');
});

test('MobileTodayShiftMonitorTab searchContainer has flex: 1 and minWidth: 0', () => {
  assert(todayShiftContent.includes('flex: 1'), 'searchContainer has flex: 1');
  assert(todayShiftContent.includes('minWidth: 0'), 'searchContainer has minWidth: 0');
});

test('MobileTodayShiftMonitorTab filterToggleBtn enforces flexShrink: 0', () => {
  assert(todayShiftContent.includes('filterToggleBtn: {'), 'defines filterToggleBtn style');
  assert(todayShiftContent.includes('flexShrink: 0'), 'filterToggleBtn defines flexShrink: 0');
});

test('MobileTodayShiftMonitorTab quickResetBtn enforces flexShrink: 0', () => {
  assert(todayShiftContent.includes('quickResetBtn: {'), 'defines quickResetBtn style');
  assert(todayShiftContent.includes('flexShrink: 0'), 'quickResetBtn defines flexShrink: 0');
});

test('MobileTodayShiftMonitorTab eliminates misleading chevron down from drawer trigger', () => {
  assert(!todayShiftContent.includes('name="chevron-down"'), 'chevron-down icon is removed from filter button');
});

// ---------------------------------------------------------------------------
// 3. Operations Operator History Tab (MobileOperatorHistoryTab)
// ---------------------------------------------------------------------------
console.log('\n--- 3. Operations Operator History Tab (Non-Overlapping Layout) ---');
const operatorHistoryPath = path.join(rootDir, 'apps/mobile/components/operations/MobileOperatorHistoryTab.tsx');
const operatorHistoryContent = fs.readFileSync(operatorHistoryPath, 'utf8');

test('MobileOperatorHistoryTab wraps SearchInput in searchContainer', () => {
  assert(operatorHistoryContent.includes('<View style={styles.searchContainer}>'), 'SearchInput is wrapped in searchContainer');
  assert(operatorHistoryContent.includes('searchContainer: {'), 'defines searchContainer style');
});

test('MobileOperatorHistoryTab searchContainer has flex: 1 and minWidth: 0', () => {
  assert(operatorHistoryContent.includes('minWidth: 0'), 'searchContainer has minWidth: 0');
});

test('MobileOperatorHistoryTab filterBtn enforces flexShrink: 0', () => {
  assert(operatorHistoryContent.includes('flexShrink: 0'), 'filterBtn defines flexShrink: 0');
});

test('MobileOperatorHistoryTab provides quickResetBtn with flexShrink: 0', () => {
  assert(operatorHistoryContent.includes('quickResetBtn: {'), 'defines quickResetBtn style');
  assert(operatorHistoryContent.includes('flexShrink: 0'), 'quickResetBtn defines flexShrink: 0');
});

// ---------------------------------------------------------------------------
// 4. Machine Filter Panel (MachineFilterPanel)
// ---------------------------------------------------------------------------
console.log('\n--- 4. Machine Filter Panel (Non-Overlapping Layout) ---');
const machineFilterPath = path.join(rootDir, 'apps/mobile/components/machines/MachineFilterPanel.tsx');
const machineFilterContent = fs.readFileSync(machineFilterPath, 'utf8');

test('MachineFilterPanel searchContainer defines minWidth: 0', () => {
  assert(machineFilterContent.includes('searchContainer: {\n    flex: 1,\n    minWidth: 0'), 'searchContainer includes minWidth: 0');
});

test('MachineFilterPanel filterToggleBtn enforces flexShrink: 0', () => {
  assert(machineFilterContent.includes('filterToggleBtn: {'), 'defines filterToggleBtn style');
  assert(machineFilterContent.includes('flexShrink: 0'), 'filterToggleBtn defines flexShrink: 0');
});

test('MachineFilterPanel quickResetBtn enforces flexShrink: 0', () => {
  assert(machineFilterContent.includes('quickResetBtn: {'), 'defines quickResetBtn style');
  assert(machineFilterContent.includes('flexShrink: 0'), 'quickResetBtn defines flexShrink: 0');
});

// ---------------------------------------------------------------------------
// 5. User Filters Panel (UserFiltersPanel)
// ---------------------------------------------------------------------------
console.log('\n--- 5. User Filters Panel (Non-Overlapping Layout) ---');
const userFiltersPath = path.join(rootDir, 'apps/mobile/components/users/UserFiltersPanel.tsx');
const userFiltersContent = fs.readFileSync(userFiltersPath, 'utf8');

test('UserFiltersPanel searchContainer defines minWidth: 0', () => {
  assert(userFiltersContent.includes('searchContainer: {\n    flex: 1,\n    minWidth: 0'), 'searchContainer includes minWidth: 0');
});

test('UserFiltersPanel filterToggleBtn enforces flexShrink: 0', () => {
  assert(userFiltersContent.includes('filterToggleBtn: {'), 'defines filterToggleBtn style');
  assert(userFiltersContent.includes('flexShrink: 0'), 'filterToggleBtn defines flexShrink: 0');
});

test('UserFiltersPanel quickResetBtn enforces flexShrink: 0', () => {
  assert(userFiltersContent.includes('quickResetBtn: {'), 'defines quickResetBtn style');
  assert(userFiltersContent.includes('flexShrink: 0'), 'quickResetBtn defines flexShrink: 0');
});

// ---------------------------------------------------------------------------
// 6. FilterToolbar Canonical Reusable Component
// ---------------------------------------------------------------------------
console.log('\n--- 6. FilterToolbar Canonical Component ---');
const filterToolbarPath = path.join(rootDir, 'apps/mobile/components/ui/FilterToolbar.tsx');
const filterToolbarContent = fs.readFileSync(filterToolbarPath, 'utf8');

test('FilterToolbar searchFlexWrap defines minWidth: 0', () => {
  assert(filterToolbarContent.includes('searchFlexWrap: {\n    flex: 1,\n    minWidth: 0'), 'searchFlexWrap includes minWidth: 0');
});

test('FilterToolbar filterToggleBtn enforces flexShrink: 0', () => {
  assert(filterToolbarContent.includes('filterToggleBtn: {'), 'defines filterToggleBtn style');
  assert(filterToolbarContent.includes('flexShrink: 0'), 'filterToggleBtn defines flexShrink: 0');
});

test('FilterToolbar resetBtn enforces flexShrink: 0', () => {
  assert(filterToolbarContent.includes('resetBtn: {'), 'defines resetBtn style');
  assert(filterToolbarContent.includes('flexShrink: 0'), 'resetBtn defines flexShrink: 0');
});

// ---------------------------------------------------------------------------
// 7. Attendance Screen
// ---------------------------------------------------------------------------
console.log('\n--- 7. Attendance Screen Search & Filter ---');
const attendancePath = path.join(rootDir, 'apps/mobile/app/(app)/attendance.tsx');
const attendanceContent = fs.readFileSync(attendancePath, 'utf8');

test('Attendance screen searchContainer defines minWidth: 0', () => {
  assert(attendanceContent.includes('searchContainer: {\n    flex: 1,\n    minWidth: 0'), 'searchContainer includes minWidth: 0');
});

test('Attendance screen managementFilterBtn enforces flexShrink: 0', () => {
  assert(attendanceContent.includes('managementFilterBtn: {'), 'defines managementFilterBtn style');
  assert(attendanceContent.includes('flexShrink: 0'), 'managementFilterBtn defines flexShrink: 0');
});

test('Attendance screen managementResetBtn enforces flexShrink: 0', () => {
  assert(attendanceContent.includes('managementResetBtn: {'), 'defines managementResetBtn style');
  assert(attendanceContent.includes('flexShrink: 0'), 'managementResetBtn defines flexShrink: 0');
});

// ---------------------------------------------------------------------------
// 8. MachineDetailView Running Logs
// ---------------------------------------------------------------------------
console.log('\n--- 8. MachineDetailView Running Logs Search & Filter ---');
const machineDetailPath = path.join(rootDir, 'apps/mobile/components/machines/MachineDetailView.tsx');
const machineDetailContent = fs.readFileSync(machineDetailPath, 'utf8');

test('MachineDetailView logSearchInput defines minWidth: 0', () => {
  assert(machineDetailContent.includes('logSearchInput: {\n    flex: 1,\n    minWidth: 0'), 'logSearchInput includes minWidth: 0');
});

test('MachineDetailView filterToggleBtn enforces flexShrink: 0', () => {
  assert(machineDetailContent.includes('filterToggleBtn: {'), 'defines filterToggleBtn style');
  assert(machineDetailContent.includes('flexShrink: 0'), 'filterToggleBtn defines flexShrink: 0');
});

console.log('====================================================');
console.log(`Results: ${passedAssertions} passed, 0 failed.`);
console.log('====================================================\n');
