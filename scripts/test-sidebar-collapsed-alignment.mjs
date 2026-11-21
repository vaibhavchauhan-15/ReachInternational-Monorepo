import fs from 'node:fs';
import path from 'node:path';

console.log('================================================================');
console.log('  SIDEBAR COLLAPSED VERTICAL ALIGNMENT VERIFICATION');
console.log('================================================================');

const navItemPath = path.resolve('apps/web/components/layout/sidebar/NavigationItem.tsx');
const sidebarPath = path.resolve('apps/web/components/ui/Sidebar.tsx');
const quickAccessPath = path.resolve('apps/web/components/layout/sidebar/QuickAccessTrigger.tsx');
const userProfilePath = path.resolve('apps/web/components/layout/sidebar/UserProfileDropdown.tsx');

const navItemCode = fs.readFileSync(navItemPath, 'utf8');
const sidebarCode = fs.readFileSync(sidebarPath, 'utf8');
const quickAccessCode = fs.readFileSync(quickAccessPath, 'utf8');
const userProfileCode = fs.readFileSync(userProfilePath, 'utf8');

// 1. NavigationItem uses SidebarMenuButton for both collapsible subItems and normal items
if (!navItemCode.includes('<SidebarMenuButton')) {
  console.error('❌ FAIL: NavigationItem does not use SidebarMenuButton');
  process.exit(1);
}

// 2. Both branches in NavigationItem must use SidebarMenuButton (at least 2 occurrences)
const menuButtonOccurrences = (navItemCode.match(/<SidebarMenuButton/g) || []).length;
if (menuButtonOccurrences < 2) {
  console.error(`❌ FAIL: Expected at least 2 <SidebarMenuButton> occurrences in NavigationItem, found ${menuButtonOccurrences}`);
  process.exit(1);
}
console.log('  ✓ 1. NavigationItem uses <SidebarMenuButton> for both subItems (Marketing) and standard items');

// 3. Ensure no redundant "w-full h-10 px-3" overrides that break collapsed mode
if (navItemCode.includes('w-full h-10 px-3 flex items-center')) {
  console.error('❌ FAIL: NavigationItem still contains redundant className override breaking collapsed centering');
  process.exit(1);
}
console.log('  ✓ 2. Redundant className overrides removed so SidebarMenuButton centering takes effect');

// 4. Ensure CollapsibleTrigger has zero layout impact when collapsed
if (!navItemCode.includes('collapsed ? "hidden opacity-0') && !navItemCode.includes('collapsed ? "opacity-0 w-0 max-w-0')) {
  console.error('❌ FAIL: CollapsibleTrigger button is not hidden/zero-width when collapsed');
  process.exit(1);
}
console.log('  ✓ 3. CollapsibleTrigger chevron button is hidden/zero-width when collapsed');

// 5. SidebarMenuButton in Sidebar.tsx handles collapsed centering
if (!sidebarCode.includes('collapsed ? "justify-center h-10 w-10 mx-auto p-0" : "w-full h-10 px-3"')) {
  console.error('❌ FAIL: SidebarMenuButton missing canonical collapsed centering classes');
  process.exit(1);
}
console.log('  ✓ 4. SidebarMenuButton implements canonical collapsed centering ("justify-center h-10 w-10 mx-auto p-0")');

// 6. Inactive state is ghost button (no static border outline edges, only hover surface)
if (sidebarCode.includes('border border-transparent') || !sidebarCode.includes('text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]')) {
  console.error('❌ FAIL: SidebarMenuButton must maintain ghost button style with no visible outline border');
  process.exit(1);
}
console.log('  ✓ 5. SidebarMenuButton maintains ghost button style with no visible outline border');

// 7. Verify QuickAccessTrigger matches 40x40 collapsed center
if (!quickAccessCode.includes('justify-center h-10 w-10 mx-auto p-0')) {
  console.error('❌ FAIL: QuickAccessTrigger does not match collapsed centering');
  process.exit(1);
}
console.log('  ✓ 6. QuickAccessTrigger aligns with collapsed 40x40 centering');

// 8. Verify UserProfileDropdown matches 40x40 collapsed center
if (!userProfileCode.includes('justify-center h-10 w-10 mx-auto p-0')) {
  console.error('❌ FAIL: UserProfileDropdown does not match collapsed centering');
  process.exit(1);
}
console.log('  ✓ 7. UserProfileDropdown aligns with collapsed 40x40 centering');

console.log('================================================================');
console.log('  ALL SIDEBAR COLLAPSED ALIGNMENT CHECKS PASSED (100%)');
console.log('================================================================');
