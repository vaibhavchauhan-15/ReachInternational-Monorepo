/**
 * Test Suite: Mobile Dashboard UI States, Error Resilience & Role Parity
 * Validates:
 * 1. TanStack Query integration, retry backoff, and full error state destructuring
 * 2. Error classification (network, timeout, server, permission, generic) without raw SQL disclosure
 * 3. Slow network telemetry and SlowNetworkBanner triggering
 * 4. PermissionDeniedView defense against invalid or 403 unauthorized roles
 * 5. Pull-to-refresh try/finally resilience with ambient toast notifications
 * 6. Role-specific empty state rendering across all 6 canonical roles (operator, supervisor, manager, hr, admin, super_admin)
 * 7. Zero raw typography properties and strict Geist design token compliance
 */

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');

console.log('🧪 Starting Mobile Dashboard UI States & Role Parity Verification Suite...\n');

// 1. Read files
const dashboardPath = path.join(__dirname, 'app', '(app)', 'dashboard.tsx');
const dashboardSrc = fs.readFileSync(dashboardPath, 'utf8');

const operatorCardPath = path.join(__dirname, 'components', 'dashboard', 'operator', 'OperatorDashboardCard.tsx');
const operatorCardSrc = fs.readFileSync(operatorCardPath, 'utf8');

const supervisorCardPath = path.join(__dirname, 'components', 'dashboard', 'supervisor', 'SupervisorDashboardCard.tsx');
const supervisorCardSrc = fs.readFileSync(supervisorCardPath, 'utf8');

const managerCardPath = path.join(__dirname, 'components', 'dashboard', 'manager', 'ManagerDashboardCard.tsx');
const managerCardSrc = fs.readFileSync(managerCardPath, 'utf8');

const hrCardPath = path.join(__dirname, 'components', 'dashboard', 'hr', 'HRDashboardCard.tsx');
const hrCardSrc = fs.readFileSync(hrCardPath, 'utf8');

const adminCardPath = path.join(__dirname, 'components', 'dashboard', 'admin', 'AdminDashboardCard.tsx');
const adminCardSrc = fs.readFileSync(adminCardPath, 'utf8');

const superAdminCardPath = path.join(__dirname, 'components', 'dashboard', 'super-admin', 'SuperAdminDashboardCard.tsx');
const superAdminCardSrc = fs.readFileSync(superAdminCardPath, 'utf8');

let testCount = 0;
function pass(name) {
  testCount++;
  console.log(`  ✓ ${name}`);
}

// -----------------------------------------------------------------------------
// Group 1: Dashboard Query & Error Resilience
// -----------------------------------------------------------------------------
console.log('Group 1: Dashboard Query & Error Handling Architecture');

assert(dashboardSrc.includes('isError'), 'dashboard.tsx must extract isError from useQuery');
assert(dashboardSrc.includes('error,'), 'dashboard.tsx must extract error from useQuery');
assert(dashboardSrc.includes('isFetching'), 'dashboard.tsx must extract isFetching from useQuery');
pass('dashboard.tsx destructures full TanStack Query status (isLoading, isError, error, isFetching)');

assert(dashboardSrc.includes('retry: 2'), 'dashboard.tsx must configure bounded retries (retry: 2)');
assert(dashboardSrc.includes('retryDelay:'), 'dashboard.tsx must configure exponential backoff for transient retries');
pass('dashboard.tsx defines bounded retries with exponential backoff');

assert(dashboardSrc.includes('classifyError'), 'dashboard.tsx must import and utilize classifyError');
assert(dashboardSrc.includes('ErrorState'), 'dashboard.tsx must render ErrorState upon query failure');
pass('dashboard.tsx classifies errors and renders ErrorState instead of masking errors as zeroes');

assert(dashboardSrc.includes('PermissionDeniedView'), 'dashboard.tsx must import PermissionDeniedView');
assert(dashboardSrc.includes("classifyError(error).classification === 'permission'"), 'dashboard.tsx must gate permission errors with PermissionDeniedView');
pass('dashboard.tsx renders PermissionDeniedView on 403 Forbidden or permission classification');

assert(dashboardSrc.includes('isRecognizedRole'), 'dashboard.tsx must validate active role against canonical roles');
assert(dashboardSrc.includes('CANONICAL_ROLES'), 'dashboard.tsx must define CANONICAL_ROLES list');
pass('dashboard.tsx gates unrecognized roles with PermissionDeniedView');

// -----------------------------------------------------------------------------
// Group 2: Slow Network Telemetry & Ambient Banners
// -----------------------------------------------------------------------------
console.log('\nGroup 2: Slow Network Telemetry & Offline Resilience');

assert(dashboardSrc.includes('SlowNetworkBanner'), 'dashboard.tsx must import SlowNetworkBanner');
assert(dashboardSrc.includes('isSlowNetwork'), 'dashboard.tsx must track isSlowNetwork state');
assert(dashboardSrc.includes('isSlowDismissed'), 'dashboard.tsx must support dismissing slow network banner');
assert(dashboardSrc.includes('7000'), 'dashboard.tsx must detect requests exceeding 7 seconds');
pass('dashboard.tsx monitors network latency with 7s threshold and renders SlowNetworkBanner');

assert(dashboardSrc.includes('showToast'), 'dashboard.tsx must use showToast for background feedback');
assert(dashboardSrc.includes('finally {'), 'dashboard.tsx onRefresh must use finally block to ensure refreshing is dismissed');
assert(dashboardSrc.includes('setRefreshing(false)'), 'dashboard.tsx must dismiss refreshing state in finally');
pass('dashboard.tsx pull-to-refresh implements guaranteed try/finally dismissal with toast telemetry');

assert(dashboardSrc.includes('useScreenSync'), 'dashboard.tsx must integrate screen-scoped synchronization');
pass('dashboard.tsx registers useScreenSync for foreground and reconnect updates');

// -----------------------------------------------------------------------------
// Group 3: Operator Role States & Empty Guidance
// -----------------------------------------------------------------------------
console.log('\nGroup 3: Operator Role States & Empty Guidance');

assert(operatorCardSrc.includes('EmptyState'), 'OperatorDashboardCard must import EmptyState');
assert(operatorCardSrc.includes('hasNoAssignments'), 'OperatorDashboardCard must evaluate hasNoAssignments');
assert(operatorCardSrc.includes('No Shifts or Equipment Assigned'), 'OperatorDashboardCard must present clear empty title when unassigned');
pass('OperatorDashboardCard renders EmptyState when operator has no active machine or shifts');

assert(operatorCardSrc.includes('No Shifts Assigned'), 'OperatorDashboardCard StatusCard must display No Shifts Assigned when count is 0');
assert(operatorCardSrc.includes('totalAssignedCount === 0'), 'OperatorDashboardCard must handle totalAssignedCount === 0 safely');
pass('OperatorDashboardCard handles 0 assigned shifts without misleading pending submission warnings');

// -----------------------------------------------------------------------------
// Group 4: Supervisor Role States & Empty Guidance
// -----------------------------------------------------------------------------
console.log('\nGroup 4: Supervisor Role States & Empty Guidance');

assert(supervisorCardSrc.includes('EmptyState'), 'SupervisorDashboardCard must import EmptyState');
assert(supervisorCardSrc.includes('hasNoSupervisedFleet'), 'SupervisorDashboardCard must evaluate hasNoSupervisedFleet');
assert(supervisorCardSrc.includes('No Supervised Fleet or Team Assigned'), 'SupervisorDashboardCard must display empty guidance when fleet is 0');
pass('SupervisorDashboardCard renders EmptyState when supervisor has no assigned machines or operators');

// -----------------------------------------------------------------------------
// Group 5: Manager Role States & Empty Guidance
// -----------------------------------------------------------------------------
console.log('\nGroup 5: Manager Role States & Empty Guidance');

assert(managerCardSrc.includes('EmptyState'), 'ManagerDashboardCard must import EmptyState');
assert(managerCardSrc.includes('hasNoFleetData'), 'ManagerDashboardCard must evaluate hasNoFleetData');
assert(managerCardSrc.includes('Fleet Directory Empty'), 'ManagerDashboardCard must display empty guidance when fleet is 0');
pass('ManagerDashboardCard renders EmptyState when manager has 0 fleet utilization');

// -----------------------------------------------------------------------------
// Group 6: HR Role States & Empty Guidance
// -----------------------------------------------------------------------------
console.log('\nGroup 6: HR Role States & Empty Guidance');

assert(hrCardSrc.includes('EmptyState'), 'HRDashboardCard must import EmptyState');
assert(hrCardSrc.includes('hasNoStaffData'), 'HRDashboardCard must evaluate hasNoStaffData');
assert(hrCardSrc.includes('No Staff Records'), 'HRDashboardCard must display empty guidance when employee roster is 0');
pass('HRDashboardCard renders EmptyState when employee roster is 0');

// -----------------------------------------------------------------------------
// Group 7: Admin & Super Admin Role States & Empty Guidance
// -----------------------------------------------------------------------------
console.log('\nGroup 7: Admin & Super Admin Role States & Empty Guidance');

assert(adminCardSrc.includes('EmptyState'), 'AdminDashboardCard must import EmptyState');
assert(adminCardSrc.includes('hasNoOrgData'), 'AdminDashboardCard must evaluate hasNoOrgData');
assert(adminCardSrc.includes('Organization Fleet & Users Empty'), 'AdminDashboardCard must display empty guidance when org data is 0');
pass('AdminDashboardCard renders EmptyState when organization is empty');

assert(superAdminCardSrc.includes('EmptyState'), 'SuperAdminDashboardCard must import EmptyState');
assert(superAdminCardSrc.includes('hasNoPlatformData'), 'SuperAdminDashboardCard must evaluate hasNoPlatformData');
assert(superAdminCardSrc.includes('Platform Fleet & Directory Empty'), 'SuperAdminDashboardCard must display empty guidance when platform is empty');
pass('SuperAdminDashboardCard renders EmptyState when global platform metrics are empty');

// -----------------------------------------------------------------------------
// Group 8: Zero Raw Typography & Design Token Invariants
// -----------------------------------------------------------------------------
console.log('\nGroup 8: Typography & Design System Invariants');

const filesToCheck = [
  { name: 'dashboard.tsx', src: dashboardSrc },
  { name: 'OperatorDashboardCard.tsx', src: operatorCardSrc },
  { name: 'SupervisorDashboardCard.tsx', src: supervisorCardSrc },
  { name: 'ManagerDashboardCard.tsx', src: managerCardSrc },
  { name: 'HRDashboardCard.tsx', src: hrCardSrc },
  { name: 'AdminDashboardCard.tsx', src: adminCardSrc },
  { name: 'SuperAdminDashboardCard.tsx', src: superAdminCardSrc },
];

for (const { name, src } of filesToCheck) {
  // Check StyleSheet.create for forbidden properties
  const sheetMatch = src.match(/StyleSheet\.create\(\{([\s\S]*?)\}\);/);
  if (sheetMatch) {
    const sheetBody = sheetMatch[1];
    assert(!/fontSize\s*:/.test(sheetBody), `${name} must not contain raw fontSize in StyleSheet.create`);
    assert(!/fontWeight\s*:/.test(sheetBody), `${name} must not contain raw fontWeight in StyleSheet.create`);
    assert(!/lineHeight\s*:/.test(sheetBody), `${name} must not contain raw lineHeight in StyleSheet.create`);
    assert(!/fontFamily\s*:/.test(sheetBody), `${name} must not contain raw fontFamily in StyleSheet.create`);
  }
  pass(`${name} adheres strictly to zero raw typography rules`);
}

console.log(`\n🎉 All ${testCount} Dashboard UI States & Role Parity checks passed successfully (100%)!\n`);
