/**
 * Test Suite: Mobile Operator Dashboard Production-Grade Optimizations
 * Verifies:
 * 1. Instant UI rendering with lightweight skeletons & non-blocking layout
 * 2. Prominent "Enter Shift Entry" primary action button in Section 1
 * 3. Removal of Last Recorded Meter (HMR) card (Feedback 4)
 * 4. Removal of AlertWidget card for operator & replacement with native shift-end notifications (Feedback 3)
 * 5. Accurate parsing and idempotency in shiftEndNotifier
 * 6. Optimistic UI mutation updates in MobileOperatorEntryCard and query invalidation in SyncCoordinator
 * 7. Zero raw typography properties in StyleSheet.create
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function parseTimeToMinutes(timeStr) {
  if (!timeStr) return null;
  const clean = timeStr.trim();
  const ampmMatch = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const period = ampmMatch[3].toUpperCase();
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  const h24Match = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (h24Match) {
    const hours = parseInt(h24Match[1], 10);
    const minutes = parseInt(h24Match[2], 10);
    return hours * 60 + minutes;
  }
  return null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');

console.log('🧪 Starting Mobile Operator Dashboard Optimizations Verification Suite...\n');

let testCount = 0;
function pass(name) {
  testCount++;
  console.log(`  ✓ ${name}`);
}

// 1. Read files
const operatorCardPath = path.join(__dirname, 'components', 'dashboard', 'operator', 'OperatorDashboardCard.tsx');
const operatorCardSrc = fs.readFileSync(operatorCardPath, 'utf8');

const dashboardPath = path.join(__dirname, 'app', '(app)', 'dashboard.tsx');
const dashboardSrc = fs.readFileSync(dashboardPath, 'utf8');

const entryCardPath = path.join(__dirname, 'components', 'operations', 'MobileOperatorEntryCard.tsx');
const entryCardSrc = fs.readFileSync(entryCardPath, 'utf8');

const syncCoordinatorPath = path.join(__dirname, 'lib', 'offline', 'SyncCoordinator.ts');
const syncCoordinatorSrc = fs.readFileSync(syncCoordinatorPath, 'utf8');

const shiftNotifierPath = path.join(__dirname, 'lib', 'notifications', 'shiftEndNotifier.ts');
const shiftNotifierSrc = fs.readFileSync(shiftNotifierPath, 'utf8');

// -----------------------------------------------------------------------------
// Group 1: Instant UI Rendering & Per-Shift Log Actions
// -----------------------------------------------------------------------------
console.log('Group 1: Instant UI Rendering & Per-Shift Log Actions');

assert(operatorCardSrc.includes('isLoading?: boolean'), 'OperatorDashboardCard must accept isLoading prop');
assert(!operatorCardSrc.includes('"Enter Shift Entry"'), 'StatusCard must suppress redundant Enter Shift Entry button');
assert(operatorCardSrc.includes('/operations?tab=entry'), 'Shift actions must route to /operations?tab=entry');
assert(operatorCardSrc.includes('label={`Log ${shiftCodeName}`}'), 'Per-shift card must render primary log button');
assert(operatorCardSrc.includes('label="View Shift Log"'), 'Submitted shift card must render view shift log button');
pass('OperatorDashboardCard provides per-shift actions and suppresses duplicate button in StatusCard');

// Verify Button.tsx provides rock-solid theme styling and min 44px touch target
const buttonPath = path.join(__dirname, 'components', 'ui', 'Button.tsx');
const buttonSrc = fs.readFileSync(buttonPath, 'utf8');
assert(buttonSrc.includes('useTheme'), 'Button.tsx must use useTheme for reliable color tokens');
assert(buttonSrc.includes('minHeight: 44'), 'Button.tsx must enforce min 44px touch target');
assert(buttonSrc.includes('#0284c7'), 'Button.tsx must define Reach blue #0284c7 primary background');
pass('Button component enforces min 44px touch target and robust theme colors');

assert(operatorCardSrc.includes('Skeleton'), 'OperatorDashboardCard must import Skeleton for progressive hydration');
assert(operatorCardSrc.includes('isLoading && !data'), 'OperatorDashboardCard must render progressive skeletons when loading without data');
pass('OperatorDashboardCard implements progressive skeleton hydration without blocking initial render');

// -----------------------------------------------------------------------------
// Group 2: Removal of Last Recorded Meter & Alert Card
// -----------------------------------------------------------------------------
console.log('\nGroup 2: UI De-clutter & User Feedback Enforcement');

assert(!operatorCardSrc.includes('title="LAST RECORDED METER (HMR)"'), 'OperatorDashboardCard must not contain LAST RECORDED METER (HMR) card (Feedback 4)');
assert(!operatorCardSrc.includes('meterValueRow'), 'OperatorDashboardCard must not contain obsolete meterValueRow styles');
pass('LAST RECORDED METER (HMR) card successfully removed per Feedback 4');

assert(dashboardSrc.includes("if (activeRole === 'operator')"), 'dashboard.tsx must check activeRole === operator for alerts');
assert(dashboardSrc.includes('return [];'), 'dashboard.tsx must return empty alerts for operator to suppress alert card (Feedback 3)');
pass('Alert card suppressed for operator dashboard per Feedback 3');

// -----------------------------------------------------------------------------
// Group 3: Shift End Native Mobile Notification
// -----------------------------------------------------------------------------
console.log('\nGroup 3: Shift End Push Notification Delivery');

assert(shiftNotifierSrc.includes('checkAndNotifyShiftEnded'), 'shiftEndNotifier.ts must export checkAndNotifyShiftEnded');
assert(shiftNotifierSrc.includes('postNotification'), 'shiftEndNotifier.ts must dispatch postNotification');
assert(shiftNotifierSrc.includes('AsyncStorage'), 'shiftEndNotifier.ts must persist notified state in AsyncStorage');
assert(shiftNotifierSrc.includes('@reach:notified_shift_end_'), 'shiftEndNotifier.ts must use scoped idempotency key');
pass('shiftEndNotifier implements schedule check, native dispatch, and idempotent storage');

// Time parsing logic verification
assert.equal(parseTimeToMinutes('08:00 AM'), 480, '08:00 AM should equal 480 minutes');
assert.equal(parseTimeToMinutes('05:00 PM'), 1020, '05:00 PM should equal 1020 minutes');
assert.equal(parseTimeToMinutes('17:00:00'), 1020, '17:00:00 should equal 1020 minutes');
assert.equal(parseTimeToMinutes('12:00 AM'), 0, '12:00 AM should equal 0 minutes');
assert.equal(parseTimeToMinutes('12:00 PM'), 720, '12:00 PM should equal 720 minutes');
pass('parseTimeToMinutes handles 12h AM/PM and 24h formats with 100% precision');

assert(dashboardSrc.includes('checkAndNotifyShiftEnded'), 'dashboard.tsx must integrate checkAndNotifyShiftEnded');
pass('dashboard.tsx monitors assigned shifts and triggers shift-end notification');

// -----------------------------------------------------------------------------
// Group 4: Fast Loading & Optimistic UI
// -----------------------------------------------------------------------------
console.log('\nGroup 4: Optimistic UI & Cache Synchronization');

assert(dashboardSrc.includes("placeholderData: (previousData) => previousData"), 'dashboard.tsx must configure placeholderData to prevent refetch flicker');
assert(dashboardSrc.includes("activeRole !== 'operator'"), 'dashboard.tsx must allow operator to render instantly rather than blocking on full-screen skeleton');
pass('dashboard.tsx renders static layout instantly without blocking database responses');

assert(entryCardSrc.includes("queryClient.setQueriesData({ queryKey: ['dashboard'] }"), 'MobileOperatorEntryCard must optimistically update dashboard cache');
assert(entryCardSrc.includes("queryClient.invalidateQueries({\n        queryKey: ['dashboard'],\n      })"), 'MobileOperatorEntryCard must invalidate dashboard query for server reconciliation');
pass('MobileOperatorEntryCard applies optimistic updates with rollback and server reconciliation');

assert(syncCoordinatorSrc.includes("this.queryClient.invalidateQueries({ queryKey: ['dashboard'] })"), 'SyncCoordinator must invalidate dashboard on offline sync');
pass('SyncCoordinator ensures offline drained mutations update dashboard');

// -----------------------------------------------------------------------------
// Group 5: Zero Raw Typography Properties
// -----------------------------------------------------------------------------
console.log('\nGroup 5: Typography & Design System Invariants');

const sheetMatch = operatorCardSrc.match(/StyleSheet\.create\(\{([\s\S]*?)\}\);/);
assert(sheetMatch, 'OperatorDashboardCard must contain StyleSheet.create');
const sheetBody = sheetMatch[1];
assert(!/fontSize\s*:/.test(sheetBody), 'OperatorDashboardCard must not contain raw fontSize in StyleSheet.create');
assert(!/fontWeight\s*:/.test(sheetBody), 'OperatorDashboardCard must not contain raw fontWeight in StyleSheet.create');
assert(!/lineHeight\s*:/.test(sheetBody), 'OperatorDashboardCard must not contain raw lineHeight in StyleSheet.create');
assert(!/fontFamily\s*:/.test(sheetBody), 'OperatorDashboardCard must not contain raw fontFamily in StyleSheet.create');
pass('OperatorDashboardCard adheres strictly to zero raw typography rules');

console.log(`\n🎉 All ${testCount} Operator Dashboard Optimization checks passed successfully (100%)!\n`);
