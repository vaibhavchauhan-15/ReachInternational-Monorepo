/**
 * ReachInternational Mobile — UI States, Error Handling & Optimistic UX Verification Suite
 * Verifies:
 * 1. Zero Alert.alert invocations in apps/mobile/app/ and apps/mobile/components/
 * 2. Elimination of mock/fake fallback constants (e.g. INITIAL_CLIENTS) in data fetching
 * 3. Consistent adoption of ErrorState, EmptyState, PermissionDeniedView, ConfirmDialog, and FormError
 * 4. Optimistic rollback error toast dispatching in useOptimisticMutation
 * 5. Reusable UI state component exports and zero raw typography adherence
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');
const rootDir = path.resolve(__dirname, '../..');
const mobileDir = path.resolve(rootDir, 'apps/mobile');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    testsPassed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    testsFailed++;
  }
}

function getFilesRecursively(dir, filterFn) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursively(filePath, filterFn));
    } else if (!filterFn || filterFn(filePath)) {
      results.push(filePath);
    }
  }
  return results;
}

console.log('\n--- ReachInternational Mobile: UI States & Error Resilience Audit ---');

// 1. Audit Alert.alert invocations
console.log('\n[Suite 1] Native Alert.alert Elimination:');
const appFiles = getFilesRecursively(path.join(mobileDir, 'app'), f => /\.(tsx|ts)$/.test(f));
const componentFiles = getFilesRecursively(path.join(mobileDir, 'components'), f => /\.(tsx|ts)$/.test(f));

const alertInvocations = [];
for (const file of [...appFiles, ...componentFiles]) {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    if (trimmed.includes('Alert.alert(')) {
      alertInvocations.push(`${path.relative(mobileDir, file)}:${idx + 1}`);
    }
  });
}
assert(alertInvocations.length === 0, `Zero Alert.alert calls across app/ and components/ (Found: ${alertInvocations.join(', ') || '0'})`);

// 2. Audit Mock Data Fallbacks
console.log('\n[Suite 2] Elimination of Fake/Mock Data Fallbacks:');
const clientsPath = fs.existsSync(path.join(mobileDir, 'app/(app)/clients/index.tsx')) ? path.join(mobileDir, 'app/(app)/clients/index.tsx') : path.join(mobileDir, 'app/(app)/clients.tsx');
const clientsContent = fs.readFileSync(clientsPath, 'utf-8');
assert(!clientsContent.includes('INITIAL_CLIENTS'), 'clients.tsx does not use INITIAL_CLIENTS fallback');
assert(!clientsContent.includes('setClients(INITIAL_CLIENTS)'), 'clients.tsx never falls back to mock data on query failure');
assert(clientsContent.includes('setFetchError('), 'clients.tsx captures fetchError for true error rendering');

// 3. Audit Shared UI State Primitives
console.log('\n[Suite 3] Shared UI State Components:');
const uiIndexContent = fs.readFileSync(path.join(mobileDir, 'components/ui/index.ts'), 'utf-8');
assert(uiIndexContent.includes("export * from './ErrorState'"), 'components/ui exports ErrorState');
assert(uiIndexContent.includes("export * from './EmptyState'"), 'components/ui exports EmptyState');
assert(uiIndexContent.includes("export * from './PermissionDeniedView'"), 'components/ui exports PermissionDeniedView');
assert(uiIndexContent.includes("export * from './SlowNetworkBanner'"), 'components/ui exports SlowNetworkBanner');
assert(uiIndexContent.includes("export * from './FormError'"), 'components/ui exports FormError');

const errorStateContent = fs.readFileSync(path.join(mobileDir, 'components/ui/ErrorState.tsx'), 'utf-8');
assert(errorStateContent.includes('classifyError') && errorStateContent.includes('SQLSTATE'), 'ErrorState classifies and sanitizes raw SQL/database error leaks');
assert(errorStateContent.includes('haptics.select()'), 'ErrorState triggers tactile haptics on retry interaction');

const emptyStateContent = fs.readFileSync(path.join(mobileDir, 'components/ui/EmptyState.tsx'), 'utf-8');
assert(emptyStateContent.includes("'no-results'"), 'EmptyState supports "no-results" variant');
assert(emptyStateContent.includes("'filtered'"), 'EmptyState supports "filtered" variant');

const permDeniedContent = fs.readFileSync(path.join(mobileDir, 'components/ui/PermissionDeniedView.tsx'), 'utf-8');
assert(permDeniedContent.includes('haptics.select()'), 'PermissionDeniedView uses haptics on dashboard navigation');

// 4. Audit Route-Level UI States
console.log('\n[Suite 4] Route-Level UI State Integration:');

// Dashboard
const dashboardContent = fs.readFileSync(path.join(mobileDir, 'app/(app)/dashboard.tsx'), 'utf-8');
assert(dashboardContent.includes('<ErrorState') && dashboardContent.includes('isError'), 'dashboard.tsx handles query failure with ErrorState and retry');

// Attendance
const attendanceContent = fs.readFileSync(path.join(mobileDir, 'app/(app)/attendance.tsx'), 'utf-8');
assert(attendanceContent.includes('<PermissionDeniedView'), 'attendance.tsx renders PermissionDeniedView on RBAC denial');
assert(attendanceContent.includes('<ErrorState'), 'attendance.tsx renders ErrorState on query failure');
assert(attendanceContent.includes('variant="no-results"') && attendanceContent.includes('variant="filtered"'), 'attendance.tsx differentiates search, filter, and empty list states');

// Payroll
const payrollContent = fs.readFileSync(path.join(mobileDir, 'app/(app)/payroll.tsx'), 'utf-8');
assert(payrollContent.includes('<PermissionDeniedView'), 'payroll.tsx renders PermissionDeniedView on RBAC denial');
assert(payrollContent.includes('<ErrorState'), 'payroll.tsx renders ErrorState on query failure');
assert(payrollContent.includes('<EmptyState'), 'payroll.tsx renders EmptyState with contextual guidance');
assert(payrollContent.includes('<FormError'), 'payroll.tsx renders inline FormError in statement edit modal');

// Machines
const machinesContent = fs.readFileSync(path.join(mobileDir, 'app/(app)/machines.tsx'), 'utf-8');
assert(machinesContent.includes('<PermissionDeniedView'), 'machines.tsx renders PermissionDeniedView for non-authorized roles');
assert(machinesContent.includes('<ErrorState'), 'machines.tsx renders ErrorState on query failure');
assert(machinesContent.includes('<EmptyState'), 'machines.tsx renders EmptyState with filter/search differentiation');

// Clients
assert(clientsContent.includes('<PermissionDeniedView'), 'clients.tsx renders PermissionDeniedView on RBAC denial');
assert(clientsContent.includes('<ErrorState'), 'clients.tsx renders ErrorState on query failure');
assert(clientsContent.includes('<EmptyState'), 'clients.tsx renders EmptyState on zero records');
assert(clientsContent.includes('<ConfirmDialog'), 'clients.tsx uses ConfirmDialog for client deletion');

// Running Logs
const logsContent = fs.readFileSync(path.join(mobileDir, 'app/(app)/running-logs.tsx'), 'utf-8');
assert(logsContent.includes('<PermissionDeniedView'), 'running-logs.tsx renders PermissionDeniedView on RBAC boundary');
assert(logsContent.includes('<ErrorState'), 'running-logs.tsx renders ErrorState on query failure');
assert(logsContent.includes('<EmptyState'), 'running-logs.tsx renders EmptyState on empty running logs');

// Profile & Account Deletion
const profileContent = fs.readFileSync(path.join(mobileDir, 'app/(app)/profile/index.tsx'), 'utf-8');
assert(profileContent.includes('<ConfirmDialog'), 'profile/index.tsx uses ConfirmDialog for document delete and request withdraw');

const accountDelContent = fs.readFileSync(path.join(mobileDir, 'app/(app)/account-deletion/index.tsx'), 'utf-8');
assert(accountDelContent.includes('<ConfirmDialog'), 'account-deletion/index.tsx uses ConfirmDialog for submission & cancellation');
assert(accountDelContent.includes('<FormError'), 'account-deletion/index.tsx uses FormError for confirmation keyword validation');

// Users Management
const usersContent = fs.readFileSync(path.join(mobileDir, 'app/(app)/users.tsx'), 'utf-8');
assert(usersContent.includes('<ErrorState'), 'users.tsx renders ErrorState on initial load failure');
assert(usersContent.includes('<EmptyState'), 'users.tsx renders EmptyState on empty / filtered user lists');
assert(usersContent.includes('<ConfirmDialog'), 'users.tsx uses ConfirmDialog for all destructive & approval actions');

// 5. Audit Optimistic Rollback & Error Feedback
console.log('\n[Suite 5] Optimistic Mutations & Error Feedback:');
const optContent = fs.readFileSync(path.join(mobileDir, 'lib/optimistic/useOptimisticMutation.ts'), 'utf-8');
assert(optContent.includes("showToast('error', 'Action Failed', errorMsg)"), 'useOptimisticMutation surfaces error toast on mutation failure');
assert(optContent.includes('context.affectedKeys.forEach') && optContent.includes('queryClient.setQueryData'), 'useOptimisticMutation rolls back affected query caches on mutation failure');

console.log(`\n========================================`);
console.log(`UI States Test Results: ${testsPassed} passed, ${testsFailed} failed`);
console.log(`========================================\n`);

if (testsFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
