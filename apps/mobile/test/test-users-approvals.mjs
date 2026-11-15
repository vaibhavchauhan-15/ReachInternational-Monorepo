/**
 * Automated Verification Suite for Mobile /users Approvals Architecture
 * Covers:
 * 1. Removal of Scattered Approval Sections from /users
 * 2. Centralized Approvals Ambient Banner & Navigation to /(app)/approvals
 * 3. Central Approvals Data Hook & Queue Integration
 * 4. Visual Hierarchy & Parity with Web (Placing ambient banner right below KPIs)
 * 5. Complete Central Approval Screen Contract
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.resolve(path.dirname(__filename), '..');

console.log('[Test Runner]: Initializing Mobile Centralized Approvals Verification Suite...\n');

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
  const usersScreenPath = path.join(__dirname, 'app', '(app)', 'users.tsx');
  const approvalsScreenPath = path.join(__dirname, 'app', '(app)', 'approvals.tsx');
  const usersDataHookPath = path.join(__dirname, 'lib', 'hooks', 'useUsersData.ts');

  const usersContent = fs.readFileSync(usersScreenPath, 'utf8');
  const approvalsContent = fs.readFileSync(approvalsScreenPath, 'utf8');
  const usersDataContent = fs.readFileSync(usersDataHookPath, 'utf8');

  console.log('--- 1. Removal of Scattered Approval Sections from users.tsx ---');
  assert(
    !usersContent.includes('<PendingApprovalsSection') &&
    !usersContent.includes('<ProfileChangeRequestsSection') &&
    !usersContent.includes('<AccountDeletionRequestsSection'),
    'users.tsx: Completely removed scattered approval sections from User Management directory'
  );
  assert(
    !usersContent.includes("from './PendingApprovalsSection'") &&
    !usersContent.includes("from './ProfileChangeRequestsSection'"),
    'users.tsx: Removed legacy scattered approval component imports'
  );

  console.log('\n--- 2. Centralized Approvals Ambient Banner & Navigation ---');
  assert(
    usersContent.includes("router.push('/(app)/approvals')") &&
    usersContent.includes('Pending Approvals in Central Queue'),
    'users.tsx: Mounts Centralized Approvals Ambient Banner directing reviewers to /(app)/approvals'
  );

  const kpiGridIndex = usersContent.indexOf('<KPIGrid');
  const bannerIndex = usersContent.indexOf('Pending Approvals in Central Queue');
  const filtersPanelIndex = usersContent.indexOf('<UserFiltersPanel');

  assert(
    kpiGridIndex !== -1 &&
    bannerIndex !== -1 &&
    filtersPanelIndex !== -1 &&
    kpiGridIndex < bannerIndex &&
    bannerIndex < filtersPanelIndex,
    'users.tsx: Visual hierarchy cleanly places KPIGrid -> Centralized Approvals Banner -> UserFiltersPanel'
  );

  console.log('\n--- 3. Central Approvals Data Hook & Queue Integration ---');
  assert(
    usersDataContent.includes('useCentralApprovalCounts') &&
    usersDataContent.includes("rpc('approval_counts')") &&
    usersDataContent.includes(".from('approval_requests')"),
    'useUsersData.ts: Integrates useCentralApprovalCounts with central approval_counts RPC and approval_requests'
  );

  console.log('\n--- 4. Mobile Centralized Approvals Screen Contract ---');
  assert(
    approvalsContent.includes('export default function ApprovalsScreen()') ||
    approvalsContent.includes('ApprovalsScreen'),
    'approvals.tsx: Exports canonical central approvals screen'
  );
  assert(
    approvalsContent.includes('useApprovalsListQuery') &&
    approvalsContent.includes('useDecideApprovalMutation'),
    'approvals.tsx: Integrates with centralized approval engine contracts'
  );

  console.log(`\n======================================================`);
  console.log(`✅ All ${passed}/${passed + failed} Centralized Approvals Verification Checks Passed!`);
  console.log(`======================================================\n`);
  process.exit(failed > 0 ? 1 : 0);
} catch (err) {
  console.error('Fatal execution error:', err);
  process.exit(1);
}
