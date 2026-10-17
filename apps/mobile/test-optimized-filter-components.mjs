/**
 * Automated Verification Suite for Optimized Filter Components & Dropdown Performance
 * 
 * Verifies:
 * 1. Drawer animation tuning (200ms open, 170ms close, UI-thread opacity transition).
 * 2. FilterCategoryCard minimal layout (no nested card borders, no numbered prefixes by default, no redundant subtitles).
 * 3. FilterSidebar accessibility, sticky footer touch ergonomics (>=44px), rapid tap guard.
 * 4. DropdownFilterSelector prefix minimization (showPrefix default false), memoized option rows, zero unused state.
 * 5. MachineFilterSidebar clean hierarchy (Rental Status, Health Status, Client Allocation, Site Supervisor, Sort By).
 * 6. UserFiltersPanel & clients.tsx consistency across monorepo.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedAssertions++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedAssertions++;
  }
}

console.log('\n--- 1. Drawer Opening & Closing Transitions ---');
const drawerPath = path.join(rootDir, 'apps/mobile/components/ui/overlay/Drawer.tsx');
const drawerContent = fs.readFileSync(drawerPath, 'utf8');

assert(drawerContent.includes('duration: 200'), 'Drawer open duration is tuned to 200ms (160-220ms target)');
assert(drawerContent.includes('duration: 170'), 'Drawer close duration is tuned to 170ms (160-220ms target)');
assert(drawerContent.includes('OPEN_EASING'), 'Drawer uses smooth ease-out curve for opening');
assert(drawerContent.includes('CLOSE_EASING'), 'Drawer uses smooth ease-in curve for closing');
assert(drawerContent.includes('opacity: 0.2 + norm * 0.8'), 'Drawer integrates UI-thread panel opacity fade transition');
assert(drawerContent.includes('scrimOpacity'), 'Drawer coordinates background scrim opacity on UI thread');
assert(drawerContent.includes('activeOffsetX(25)'), 'Drawer pan gesture prevents accidental touch cancellation on buttons');

console.log('\n--- 2. FilterCategoryCard Clean & Minimal Layout ---');
const filterSidebarPath = path.join(rootDir, 'apps/mobile/components/ui/FilterSidebar.tsx');
const filterSidebarContent = fs.readFileSync(filterSidebarPath, 'utf8');

assert(filterSidebarContent.includes('styles.categorySection'), 'FilterCategoryCard uses clean section layout without nested card borders');
assert(!filterSidebarContent.includes('styles.categoryCard'), 'Nested categoryCard style with bulky border & padding is eliminated');
assert(filterSidebarContent.includes('showIndex = false'), 'FilterCategoryCard disables numbered section prefixes by default');
assert(filterSidebarContent.includes('<Text variant="label"'), 'FilterCategoryCard uses clean label typography token');
assert(filterSidebarContent.includes('subtitle ?'), 'FilterCategoryCard renders subtitles only when explicitly provided');

console.log('\n--- 3. FilterSidebar Actions, Sticky Footer & Tap Ergonomics ---');
assert(filterSidebarContent.includes('isApplyingRef.current'), 'FilterSidebar implements rapid double-tap lock on Apply action');
assert(filterSidebarContent.includes('accessibilityLabel="Close filter sidebar"'), 'Close button provides accessible label');
assert(filterSidebarContent.includes('accessibilityLabel="Reset all filters"'), 'Reset All button provides accessible label');
assert(filterSidebarContent.includes('disabled={activeFilterCount === 0}'), 'Reset All is cleanly disabled when no filters are active');
assert(filterSidebarContent.includes('hitSlopToMin48'), 'FilterSidebar actions implement minimum touch ergonomics');
assert(filterSidebarContent.includes('backgroundColor: \'#0284c7\''), 'Apply button uses canonical Reach Sky Blue brand color');
assert(filterSidebarContent.includes('minHeight: 44'), 'Action buttons strictly satisfy >=44px touch targets');

console.log('\n--- 4. DropdownFilterSelector Performance & Prefix Minimization ---');
const dropdownPath = path.join(rootDir, 'apps/mobile/components/ui/DropdownFilterSelector.tsx');
const dropdownContent = fs.readFileSync(dropdownPath, 'utf8');

assert(dropdownContent.includes('showPrefix = false'), 'DropdownFilterSelector defaults showPrefix to false for clean values');
assert(dropdownContent.includes('showPrefix &&'), 'DropdownFilterSelector only renders redundant prefix when showPrefix is true');
assert(!dropdownContent.includes('setWindowWidth'), 'Unused windowWidth state and listeners are eradicated');
assert(dropdownContent.includes('DropdownOptionRow = React.memo'), 'DropdownOptionRow is memoized for zero re-renders on typing/selection');
assert(dropdownContent.includes('useCallback'), 'Option selection callback is stabilized via useCallback');
assert(dropdownContent.includes('accessibilityRole="combobox"'), 'Trigger provides accessible combobox role');
assert(dropdownContent.includes('accessibilityRole="checkbox"'), 'Option items provide accessible checkbox role');
assert(dropdownContent.includes('keyboardHeight'), 'Dynamic popover positioning accounts for keyboard height');

console.log('\n--- 5. MachineFilterSidebar Clean Hierarchy & Parity ---');
const machineFilterPath = path.join(rootDir, 'apps/mobile/components/machines/MachineFilterSidebar.tsx');
const machineFilterContent = fs.readFileSync(machineFilterPath, 'utf8');

assert(!machineFilterContent.includes('subtitle="Category-wise fleet equipment refinement"'), 'Excessive header subtitle is removed');
assert(!machineFilterContent.includes('index={1}'), 'Numbered section 1 is removed');
assert(!machineFilterContent.includes('index={2}'), 'Numbered section 2 is removed');
assert(!machineFilterContent.includes('index={3}'), 'Numbered section 3 is removed');
assert(!machineFilterContent.includes('index={4}'), 'Numbered section 4 is removed');
assert(!machineFilterContent.includes('index={5}'), 'Numbered section 5 is removed');
assert(machineFilterContent.includes('title="Rental Status"'), 'Clean sentence/title case Rental Status is used');
assert(machineFilterContent.includes('title="Health Status"'), 'Clean sentence/title case Health Status is used');
assert(machineFilterContent.includes('title="Client Allocation"'), 'Clean sentence/title case Client Allocation is used');
assert(machineFilterContent.includes('title="Site Supervisor"'), 'Clean sentence/title case Site Supervisor is used');
assert(machineFilterContent.includes('title="Sort By"'), 'Clean sentence/title case Sort By is used');
assert(!machineFilterContent.includes('subtitle="Filter equipment by rental availability status"'), 'Redundant Rental subtitle is removed');
assert(!machineFilterContent.includes('subtitle="Filter equipment by operational health condition"'), 'Redundant Health subtitle is removed');
assert(!machineFilterContent.includes('subtitle="Filter equipment assigned to specific client locations"'), 'Redundant Client subtitle is removed');
assert(!machineFilterContent.includes('subtitle="Filter machinery overseen by supervising personnel"'), 'Redundant Supervisor subtitle is removed');
assert(!machineFilterContent.includes('subtitle="Order equipment by ID, model, manufacturing year, or meter"'), 'Redundant Sort subtitle is removed');
assert(machineFilterContent.includes('testID="category-rental-status"'), 'Rental testID is preserved');
assert(machineFilterContent.includes('testID="category-health-status"'), 'Health testID is preserved');
assert(machineFilterContent.includes('testID="category-client-allocation"'), 'Client testID is preserved');
assert(machineFilterContent.includes('testID="category-site-supervisor"'), 'Supervisor testID is preserved');
assert(machineFilterContent.includes('testID="category-sorting-order"'), 'Sorting testID is preserved');

console.log('\n--- 6. Cross-Page Filter Consistency (Users & Clients) ---');
const userFiltersPath = path.join(rootDir, 'apps/mobile/components/users/UserFiltersPanel.tsx');
const userFiltersContent = fs.readFileSync(userFiltersPath, 'utf8');
assert(!userFiltersContent.includes('subtitle="Category-wise staff directory refinement"'), 'Users header subtitle is removed');
assert(!userFiltersContent.includes('index={1}'), 'Users numbering is removed');
assert(userFiltersContent.includes('title="Organizational Role"'), 'Users Organizational Role is clean');

const clientsScreenPath = path.join(rootDir, 'apps/mobile/app/(app)/clients.tsx');
const clientsScreenContent = fs.readFileSync(clientsScreenPath, 'utf8');
assert(!clientsScreenContent.includes('subtitle="Category-wise client directory refinement"'), 'Clients header subtitle is removed');
assert(!clientsScreenContent.includes('index={1}'), 'Clients numbering is removed');
assert(clientsScreenContent.includes('title="Client Status"'), 'Clients Client Status is clean');

console.log('\n--- 7. Operations Shift Monitor Tab (Universal Filters & Sorting & Clean Hierarchy) ---');
const todayShiftPath = path.join(rootDir, 'apps/mobile/components/operations/MobileTodayShiftMonitorTab.tsx');
const todayShiftContent = fs.readFileSync(todayShiftPath, 'utf8');
assert(todayShiftContent.includes('<FilterSidebar'), 'MobileTodayShiftMonitorTab uses canonical FilterSidebar');
assert(todayShiftContent.includes('title="Filters & Sorting"'), 'MobileTodayShiftMonitorTab reuses standard "Filters & Sorting" title');
assert(!todayShiftContent.includes('title="Filter Shifts"'), 'Legacy "Filter Shifts" title is eradicated');
assert(!todayShiftContent.includes('subtitle="Refine shifts by date, status, client & order"'), 'Header subtitle is eradicated');
assert(!todayShiftContent.includes('title="SHIFT DATE"'), 'All-caps SHIFT DATE is eradicated');
assert(todayShiftContent.includes('title="Shift Date"'), 'Clean sentence/title case Shift Date is used');
assert(todayShiftContent.includes('showPrefix={false}'), 'CustomDatePicker uses showPrefix={false} for clean display');
assert(todayShiftContent.includes('title="Entry Status"'), 'Clean sentence/title case Entry Status is used');
assert(todayShiftContent.includes('title="Client Allocation"'), 'Clean sentence/title case Client Allocation is used');
assert(todayShiftContent.includes('title="Shift Preset"'), 'Clean sentence/title case Shift Preset is used');
assert(todayShiftContent.includes('title="Sort By"'), 'Clean sentence/title case Sort By is used');
assert(!todayShiftContent.includes('description="Filter shift roster records by specific calendar date"'), 'Redundant Shift Date description is eradicated');
assert(!todayShiftContent.includes('filterAnim.interpolate'), 'MobileTodayShiftMonitorTab eliminates maxHeight animation layout re-computation');
assert(!todayShiftContent.includes('filterPanelAnimatedContainer'), 'MobileTodayShiftMonitorTab removes dead accordion animated container');
assert(todayShiftContent.includes('DropdownFilterSelector'), 'MobileTodayShiftMonitorTab uses unified DropdownFilterSelector');

console.log('\n--- 8. Operations Operator History Tab (Universal Filters & Sorting) ---');
const operatorHistoryPath = path.join(rootDir, 'apps/mobile/components/operations/MobileOperatorHistoryTab.tsx');
const operatorHistoryContent = fs.readFileSync(operatorHistoryPath, 'utf8');
assert(operatorHistoryContent.includes('<FilterSidebar'), 'MobileOperatorHistoryTab uses canonical FilterSidebar');
assert(operatorHistoryContent.includes('title="Filters & Sorting"'), 'MobileOperatorHistoryTab reuses standard "Filters & Sorting" title');
assert(!operatorHistoryContent.includes('title="Filter Shift Logs"'), 'Legacy "Filter Shift Logs" title is eradicated');
assert(!operatorHistoryContent.includes('title="DATE RANGE"'), 'All-caps DATE RANGE is eradicated');
assert(operatorHistoryContent.includes('title="Date Range"'), 'Clean sentence/title case Date Range is used');
assert(operatorHistoryContent.includes('title="Status & Condition"'), 'Clean sentence/title case Status & Condition is used');
assert(operatorHistoryContent.includes('title="Sort By"'), 'Clean sentence/title case Sort By is used');
assert(!operatorHistoryContent.includes('styles.drawerContainer'), 'MobileOperatorHistoryTab eliminates custom hardcoded drawer container');
assert(!operatorHistoryContent.includes('styles.filterOptionPill'), 'MobileOperatorHistoryTab eliminates custom hardcoded pill loops');
assert(operatorHistoryContent.includes('DropdownFilterSelector'), 'MobileOperatorHistoryTab uses unified DropdownFilterSelector');

console.log('\n--- 9. Attendance Screen Filter Sidebar Integration ---');
const attendancePath = path.join(rootDir, 'apps/mobile/app/(app)/attendance.tsx');
const attendanceContent = fs.readFileSync(attendancePath, 'utf8');
assert(attendanceContent.includes('<FilterSidebar'), 'AttendanceScreen uses canonical FilterSidebar');
assert(attendanceContent.includes('title="Filters & Sorting"'), 'AttendanceScreen reuses standard "Filters & Sorting" title');
assert(!attendanceContent.includes('title="ATTENDANCE STATUS"'), 'All-caps ATTENDANCE STATUS is eradicated');
assert(attendanceContent.includes('title="Attendance Status"'), 'Clean sentence/title case Attendance Status is used');
assert(attendanceContent.includes('setIsFilterSidebarOpen(true)'), 'AttendanceScreen operator FAB and management filter button trigger sidebar');
assert(attendanceContent.includes('DropdownFilterSelector'), 'AttendanceScreen uses unified DropdownFilterSelector');

console.log('\n--- 10. MachineDetailView Running Logs FilterSidebar ---');
const machineDetailPath = path.join(rootDir, 'apps/mobile/components/machines/MachineDetailView.tsx');
const machineDetailContent = fs.readFileSync(machineDetailPath, 'utf8');
assert(machineDetailContent.includes('<FilterSidebar'), 'MachineDetailView uses canonical FilterSidebar for running logs');
assert(machineDetailContent.includes('title="Filters & Sorting"'), 'MachineDetailView reuses standard "Filters & Sorting" title');
assert(!machineDetailContent.includes('CustomFilterSelectorModal'), 'MachineDetailView completely eliminates duplicate CustomFilterSelectorModal');
assert(machineDetailContent.includes('DropdownFilterSelector'), 'MachineDetailView uses unified DropdownFilterSelector');
assert(machineDetailContent.includes('title="Date Range"'), 'MachineDetailView uses clean Date Range category');
assert(machineDetailContent.includes('title="Sort By"'), 'MachineDetailView uses clean Sort By category');

console.log('\n--- 11. Eradication of Duplicate & Legacy Filter Components ---');
const machinesLegacyModal = path.join(rootDir, 'apps/mobile/components/machines/CustomFilterSelectorModal.tsx');
const usersLegacyModal = path.join(rootDir, 'apps/mobile/components/users/CustomFilterSelectorModal.tsx');
const operationsLegacyModal = path.join(rootDir, 'apps/mobile/components/operations/OperationsFilterSelectorModal.tsx');

assert(!fs.existsSync(machinesLegacyModal), 'Duplicate machines/CustomFilterSelectorModal.tsx is deleted');
assert(!fs.existsSync(usersLegacyModal), 'Duplicate users/CustomFilterSelectorModal.tsx is deleted');
assert(!fs.existsSync(operationsLegacyModal), 'Duplicate operations/OperationsFilterSelectorModal.tsx is deleted');

console.log('\n--- 12. React Native Text Node Protection Safeguards ---');
const badgePath = path.join(rootDir, 'apps/mobile/components/ui/Badge.tsx');
const badgeContent = fs.readFileSync(badgePath, 'utf8');
assert(badgeContent.includes('renderBadgeChildren'), 'Badge component defines renderBadgeChildren helper');
assert(badgeContent.includes('typeof children === \'string\' || typeof children === \'number\''), 'Badge safely checks for primitive string/number children');
assert(badgeContent.includes('renderBadgeChildren(children)'), 'Badge renders children through renderBadgeChildren to prevent unparented text nodes');

assert(filterSidebarContent.includes('label={badgeLabel}'), 'FilterCategoryCard passes label prop to Badge');
assert(filterSidebarContent.includes('label={`${activeFilterCount} active`}'), 'FilterSidebar passes label prop to activeFilterCount Badge');

const alertPath = path.join(rootDir, 'apps/mobile/components/ui/Alert.tsx');
const alertContent = fs.readFileSync(alertPath, 'utf8');
assert(alertContent.includes('const AlertTitle = React.forwardRef<\n  React.ElementRef<typeof Text>'), 'AlertTitle renders Text component instead of View');
assert(alertContent.includes('const AlertDescription = React.forwardRef<\n  React.ElementRef<typeof Text>'), 'AlertDescription renders Text component instead of View');

const cardPath = path.join(rootDir, 'apps/mobile/components/ui/Card.tsx');
const cardContent = fs.readFileSync(cardPath, 'utf8');
assert(cardContent.includes('const CardTitle = React.forwardRef<\n  React.ElementRef<typeof Text>'), 'CardTitle renders Text component instead of View');
assert(cardContent.includes('const CardDescription = React.forwardRef<\n  React.ElementRef<typeof Text>'), 'CardDescription renders Text component instead of View');

const buttonPath = path.join(rootDir, 'apps/mobile/components/ui/Button.tsx');
const buttonContent = fs.readFileSync(buttonPath, 'utf8');
assert(buttonContent.includes('typeof children === \'string\' || typeof children === \'number\''), 'Button safely wraps string/number children in Text');

console.log(`\n========================================`);
console.log(`Results: ${passedAssertions} passed, ${failedAssertions} failed.`);
console.log(`========================================\n`);

if (failedAssertions > 0) {
  process.exit(1);
}

