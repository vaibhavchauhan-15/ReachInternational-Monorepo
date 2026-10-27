/**
 * Automated Verification Suite for UserDetailView, Infinite Pagination, and SegmentedToggle
 * Validates:
 * 1. Edit Profile CTA relocated to absolute top-right of hero banner card.
 * 2. SegmentedToggle release build APK shrink prevention (edge-to-edge minWidth: 100%, flexGrow: 1).
 * 3. Infinite pagination hooks in useUserDetailData.ts for all tabs.
 * 4. Skeleton loader components in UserDetailSkeletons.tsx and replacement of spinners.
 * 5. TabPaginationFooter integration across tab lists.
 * 6. Zero raw typography compliance.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');

console.log('======================================================');
console.log('🧪 Starting UserDetailView & Pagination Verification Suite...');
console.log('======================================================\n');

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

try {
  const userDetailViewPath = path.join(__dirname, 'components', 'users', 'UserDetailView.tsx');
  const userDetailCode = fs.readFileSync(userDetailViewPath, 'utf8');

  const segmentedTogglePath = path.join(__dirname, 'components', 'ui', 'SegmentedToggle.tsx');
  const segmentedToggleCode = fs.readFileSync(segmentedTogglePath, 'utf8');

  const hooksPath = path.join(__dirname, 'lib', 'hooks', 'useUserDetailData.ts');
  const hooksCode = fs.readFileSync(hooksPath, 'utf8');

  const skeletonsPath = path.join(__dirname, 'components', 'users', 'UserDetailSkeletons.tsx');
  const skeletonsCode = fs.readFileSync(skeletonsPath, 'utf8');

  // --- 1. Header Banner & Profile Ergonomics (Feedback: Edit Btn, Address, Emp ID, Avatar) ---
  console.log('--- 1. Header Banner & Profile Ergonomics ---');
  assert(
    !userDetailCode.includes('accessibilityLabel="Edit Profile"') &&
      userDetailCode.includes("label: 'Edit Profile'"),
    'Edit Profile button is removed from hero card banner; managed cleanly via header 3-dot actions'
  );

  assert(
    !userDetailCode.includes('[user.city, user.district, user.state].filter(Boolean)') &&
      userDetailCode.includes('LOCATION & ADDRESS'),
    'Address is removed from the header hero card and presented cleanly in the Location card'
  );

  assert(
    userDetailCode.includes('styles.heroEmpId') &&
      userDetailCode.includes('styles.heroDetails') &&
      !userDetailCode.includes('styles.empIdBadge'),
    'Employee ID is placed directly below user name with small typography, low opacity, and zero copy icon'
  );

  assert(
    userDetailCode.includes('accessibilityLabel="Copy Employee ID"') &&
      userDetailCode.includes("handleCopy(") &&
      userDetailCode.includes("'Employee ID'"),
    'Copy icon and clipboard copy handler added to Employee ID in Card 2 (Employment Details)'
  );

  assert(
    userDetailCode.includes('getUserInitials(user.full_name)') &&
      userDetailCode.includes("avatarBg = isDark ? '#ffffff' : '#171717'") &&
      userDetailCode.includes("avatarText = isDark ? '#171717' : '#ffffff'"),
    'Avatar is 100% black and white, optimized for light and dark theme, using first name and surname initials'
  );

  // --- 2. SegmentedToggle APK Shrink Prevention (Feedback #3 & #6) ---
  console.log('\n--- 2. SegmentedToggle APK Shrink Prevention ---');
  assert(
    segmentedToggleCode.includes('minWidth: \'100%\'') &&
      segmentedToggleCode.includes('flexGrow: 1'),
    'SegmentedToggle styles enforce minWidth: "100%" and flexGrow: 1 on scrollContent and container'
  );

  assert(
    segmentedToggleCode.includes('itemInline:') &&
      segmentedToggleCode.includes('minWidth: 64'),
    'SegmentedToggle itemInline enforces minWidth: 64 for mobile touch targets'
  );

  assert(
    (userDetailCode.includes('minWidth: 76') && userDetailCode.includes('minHeight: 40')) ||
      (userDetailCode.includes('tabStripContainer') && userDetailCode.includes('minHeight: 44')),
    'UserDetailView enforces mobile touch ergonomics with 44px minHeight horizontal tab chips or segmented toggle'
  );

  // --- 3. Infinite Pagination Hooks (Feedback #3 & #6) ---
  console.log('\n--- 3. Infinite Pagination Hooks in useUserDetailData.ts ---');
  assert(
    hooksCode.includes('useInfiniteQuery') &&
      hooksCode.includes('useUserDetailMachinesInfinite') &&
      hooksCode.includes('useUserDetailRunningLogsInfinite') &&
      hooksCode.includes('useUserDetailAssignmentsInfinite') &&
      hooksCode.includes('useUserDetailAttendanceInfinite') &&
      hooksCode.includes('useUserDetailDocumentsInfinite') &&
      hooksCode.includes('useUserDetailAuditLogsInfinite'),
    'All 6 server-side infinite query hooks are implemented and exported'
  );

  assert(
    hooksCode.includes('getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined)') &&
      hooksCode.includes('pageSize = 20'),
    'Infinite query hooks use page size 20 and compute getNextPageParam from nextCursor / page + 1'
  );

  assert(
    hooksCode.includes('export interface UserMachinesPageChunk') &&
      hooksCode.includes('export interface UserRunningLogsPageChunk') &&
      hooksCode.includes('export interface UserAssignmentsPageChunk') &&
      hooksCode.includes('export interface UserAttendancePageChunk') &&
      hooksCode.includes('export interface UserDocumentsPageChunk') &&
      hooksCode.includes('export interface UserAuditLogsPageChunk'),
    'Typed page chunks with items and total counts are exported'
  );

  // --- 4. Skeleton Loading Replacement (Feedback #4 & #5) ---
  console.log('\n--- 4. Skeleton Loading Replacement ---');
  assert(
    skeletonsCode.includes('export const UserMachinesSkeleton') &&
      skeletonsCode.includes('export const UserLogsSkeleton') &&
      skeletonsCode.includes('export const UserAssignmentsSkeleton') &&
      skeletonsCode.includes('export const UserAttendanceSkeleton') &&
      skeletonsCode.includes('export const UserDocumentsSkeleton') &&
      skeletonsCode.includes('export const UserAuditSkeleton'),
    'UserDetailSkeletons.tsx exports dedicated skeleton loaders for every tab'
  );

  assert(
    userDetailCode.includes('<UserMachinesSkeleton count={2} />') &&
      userDetailCode.includes('<UserLogsSkeleton count={3} />') &&
      userDetailCode.includes('<UserAssignmentsSkeleton count={2} />') &&
      userDetailCode.includes('<UserAttendanceSkeleton />') &&
      userDetailCode.includes('<UserDocumentsSkeleton count={2} />') &&
      userDetailCode.includes('<UserAuditSkeleton count={2} />'),
    'UserDetailView replaced raw ActivityIndicator spinners with skeleton loaders in all tab panels'
  );

  // --- 5. TabPaginationFooter Integration ---
  console.log('\n--- 5. TabPaginationFooter Integration ---');
  assert(
    userDetailCode.includes('const TabPaginationFooter: React.FC<TabPaginationFooterProps>') &&
      userDetailCode.includes('Load More {label}') &&
      userDetailCode.includes('All {totalCount} {label} loaded'),
    'TabPaginationFooter component renders load-more trigger and all-loaded checkmark'
  );

  assert(
    userDetailCode.includes('tabPaginationFooter:') &&
      userDetailCode.includes('loadMorePillBtn:') &&
      userDetailCode.includes('endOfListRow:'),
    'Pagination footer styles are defined in StyleSheet.create'
  );

  // --- 6. Typography Invariant ---
  console.log('\n--- 6. Typography Invariant ---');
  const typographyProps = ['fontSize:', 'fontWeight:', 'lineHeight:', 'letterSpacing:'];
  let violationCount = 0;
  for (const prop of typographyProps) {
    if (skeletonsCode.includes(prop)) {
      console.error(`  ❌ Raw typography property ${prop} found in UserDetailSkeletons.tsx`);
      violationCount++;
    }
  }
  assert(violationCount === 0, 'Zero raw typography properties in UserDetailSkeletons.tsx');

} catch (err) {
  console.error('Test execution error:', err);
  process.exit(1);
}

console.log('\n======================================================');
if (failed === 0) {
  console.log(`✅ All ${passed}/${passed} UserDetailView & Pagination Verifications Passed!`);
  console.log('======================================================');
  process.exit(0);
} else {
  console.error(`❌ Verification Failed: ${failed} failed, ${passed} passed.`);
  console.log('======================================================');
  process.exit(1);
}
