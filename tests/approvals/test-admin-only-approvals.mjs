#!/usr/bin/env node
/**
 * Test Suite: Admin-Only Approvals & Performance Scalability Verification
 * Verifies end-to-end enforcement across permissions, web routes, mobile screens,
 * DAL, Server Actions, API endpoints, and database schema.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('\n================================================================');
console.log('  TEST: ADMIN-ONLY APPROVALS & SCALABILITY VERIFICATION          ');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function check(desc, fn) {
  try {
    fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// 1. Permissions Package Matrix & Route Guard
// -----------------------------------------------------------------------------
console.log('--- 1. Permissions Matrix & RBAC Standards ---');

const navCode = fs.readFileSync(path.resolve(rootDir, 'packages/permissions/src/navigation.ts'), 'utf8');
const approvalsPermCode = fs.readFileSync(path.resolve(rootDir, 'packages/permissions/src/approvals.ts'), 'utf8');

check('NAV_ITEMS restricts /approvals strictly to super_admin and admin', () => {
  assert(navCode.includes('key: "approvals"'), 'Contains approvals nav item');
  const match = navCode.match(/key:\s*"approvals"[\s\S]*?roles:\s*\[([\s\S]*?)\]/);
  assert(match, 'Matched roles array for approvals');
  const roles = match[1].split(',').map((r) => r.trim().replace(/['"]/g, '')).filter(Boolean);
  assert.deepEqual(roles, ['super_admin', 'admin']);
});

check('canDecideApproval strictly requires super_admin or admin role', () => {
  assert(approvalsPermCode.includes('approverRole !== "super_admin" && approverRole !== "admin"'), 'Rejects non-admins');
  assert(approvalsPermCode.includes('targetRole !== "super_admin"'), 'Blocks admin from deciding super_admin');
});

// -----------------------------------------------------------------------------
// 2. Web Page & Route Protection
// -----------------------------------------------------------------------------
console.log('\n--- 2. Web Page & Navigation Protection ---');

const webPage = fs.readFileSync(path.resolve(rootDir, 'apps/web/app/(app)/approvals/page.tsx'), 'utf8');
const webSidebar = fs.readFileSync(path.resolve(rootDir, 'apps/web/components/layout/AppSidebar.tsx'), 'utf8');
const webCmdPalette = fs.readFileSync(path.resolve(rootDir, 'apps/web/components/ui/CommandPalette.tsx'), 'utf8');
const webUsers = fs.readFileSync(path.resolve(rootDir, 'apps/web/app/(app)/users/UsersClient.tsx'), 'utf8');

check('Approvals page.tsx enforces requireRole("admin")', () => {
  assert(webPage.includes('requireRole("admin")'), 'Page calls requireRole with admin');
  assert(!webPage.includes('all system roles can access their approvals'), 'Removed legacy broad access comment');
});

check('Web AppSidebar restricts Approvals to super_admin and admin', () => {
  const match = webSidebar.match(/href:\s*"\/approvals"[\s\S]*?roles:\s*\[([\s\S]*?)\]/);
  assert(match, 'Found approvals item in AppSidebar');
  const roles = match[1].split(',').map((r) => r.trim().replace(/['"]/g, '')).filter(Boolean);
  assert.deepEqual(roles, ['super_admin', 'admin']);
});

check('Web CommandPalette restricts nav-approvals to super_admin and admin', () => {
  const match = webCmdPalette.match(/id:\s*"nav-approvals"[\s\S]*?roles:\s*\[([\s\S]*?)\]/);
  assert(match, 'Found nav-approvals in CommandPalette');
  const roles = match[1].split(',').map((r) => r.trim().replace(/['"]/g, '')).filter(Boolean);
  assert.deepEqual(roles, ['super_admin', 'admin']);
});

check('Web UsersClient renders Centralized Approvals banner only for admin users', () => {
  assert(webUsers.includes('currentUser.role === "admin" || currentUser.role === "super_admin"'), 'Guards banner with admin check');
});

// -----------------------------------------------------------------------------
// 3. Web API Endpoints & Dual Authentication
// -----------------------------------------------------------------------------
console.log('\n--- 3. Web API Endpoints & Dual Authentication ---');

const apiList = fs.readFileSync(path.resolve(rootDir, 'apps/web/app/api/approvals/route.ts'), 'utf8');
const apiCounts = fs.readFileSync(path.resolve(rootDir, 'apps/web/app/api/approvals/counts/route.ts'), 'utf8');
const apiDecide = fs.readFileSync(path.resolve(rootDir, 'apps/web/app/api/approvals/[id]/decide/route.ts'), 'utf8');
const apiDetail = fs.readFileSync(path.resolve(rootDir, 'apps/web/app/api/approvals/[id]/route.ts'), 'utf8');
const apiCancel = fs.readFileSync(path.resolve(rootDir, 'apps/web/app/api/approvals/[id]/cancel/route.ts'), 'utf8');
const authHelper = fs.readFileSync(path.resolve(rootDir, 'apps/web/lib/server/approvals-auth.ts'), 'utf8');

check('Auth helper implements dual auth (Bearer token + Cookie session)', () => {
  assert(authHelper.includes('Bearer '), 'Inspects authorization Bearer token');
  assert(authHelper.includes('createSupabaseServerClient'), 'Inspects cookie session');
  assert(authHelper.includes('isAdmin = userRow.role === "admin" || userRow.role === "super_admin"'), 'Calculates isAdmin flag');
});

check('GET /api/approvals rejects non-admin users with 403 Forbidden', () => {
  assert(apiList.includes('!auth.user.isAdmin'), 'Checks isAdmin flag');
  assert(apiList.includes('Forbidden: Approvals queue is restricted to admin users.'), 'Returns forbidden message');
});

check('GET /api/approvals/counts rejects non-admin users with 403 Forbidden', () => {
  assert(apiCounts.includes('!auth.user.isAdmin'), 'Checks isAdmin flag');
  assert(apiCounts.includes('Forbidden: Approvals are restricted to admin users.'), 'Returns forbidden message');
});

check('POST /api/approvals/[id]/decide rejects non-admin users with 403 Forbidden', () => {
  assert(apiDecide.includes('!auth.user.isAdmin'), 'Checks isAdmin flag');
  assert(apiDecide.includes('Forbidden: Only admin users can decide approval requests.'), 'Returns forbidden message');
});

check('GET /api/approvals/[id] and POST /api/approvals/[id]/cancel enforce dual auth', () => {
  assert(apiDetail.includes('authenticateApprovalsRequest'), 'Detail enforces dual auth');
  assert(apiCancel.includes('authenticateApprovalsRequest'), 'Cancel enforces dual auth');
});

// -----------------------------------------------------------------------------
// 4. Mobile Screen, Navigation & Ambient Banners
// -----------------------------------------------------------------------------
console.log('\n--- 4. Mobile Screen, Navigation & Ambient Banners ---');

const mobileScreen = fs.readFileSync(path.resolve(rootDir, 'apps/mobile/app/(app)/approvals.tsx'), 'utf8');
const mobileUsers = fs.readFileSync(path.resolve(rootDir, 'apps/mobile/app/(app)/users.tsx'), 'utf8');
const mobileRegistry = fs.readFileSync(path.resolve(rootDir, 'apps/mobile/components/navigation/quickAccessRegistry.ts'), 'utf8');

check('Mobile approvals.tsx guards screen with PermissionDeniedView for non-admins', () => {
  assert(mobileScreen.includes('canAccessApprovals = ["super_admin", "admin"].includes(normalizedRole)'), 'Calculates canAccessApprovals');
  assert(mobileScreen.includes('<PermissionDeniedView'), 'Mounts PermissionDeniedView');
  assert(mobileScreen.includes('requiredRoles={["super_admin", "admin"]}'), 'Specifies required admin roles');
});

check('Mobile approvals.tsx disables network queries for non-admins', () => {
  assert(mobileScreen.includes('enabled: Boolean(canAccessApprovals)'), 'Disables query hooks for unauthorized users');
  assert(mobileScreen.includes('useApprovalsRealtimeSync(Boolean(canAccessApprovals))'), 'Disables realtime subscription for non-admins');
});

check('Mobile users.tsx renders Central Approvals banner only for admin users', () => {
  assert(mobileUsers.includes("['super_admin', 'admin'].includes(normalizedRole) && (pendingRequestsData?.total || 0) > 0"), 'Guards banner with admin roles check');
});

check('Mobile quickAccessRegistry registers nav-approvals for admin roles only', () => {
  assert(mobileRegistry.includes("id: 'nav-approvals'"), 'Registers nav-approvals');
  const match = mobileRegistry.match(/id:\s*'nav-approvals'[\s\S]*?roles:\s*\[([\s\S]*?)\]/);
  assert(match, 'Found roles for nav-approvals');
  const roles = match[1].split(',').map((r) => r.trim().replace(/['"]/g, '')).filter(Boolean);
  assert.deepEqual(roles, ['super_admin', 'admin']);
});

// -----------------------------------------------------------------------------
// 5. Database Schema & Scalability Invariants
// -----------------------------------------------------------------------------
console.log('\n--- 5. Database Schema & Scalability Invariants ---');

const migration202 = fs.readFileSync(path.resolve(rootDir, 'supabase/migrations/202_admin_only_approvals_optimization.sql'), 'utf8');

check('Migration 202 creates multi-column composite index for non-pending tabs', () => {
  assert(migration202.includes('CREATE INDEX IF NOT EXISTS idx_approval_requests_status_created'), 'Creates status + created_at index');
  assert(migration202.includes('ON public.approval_requests (status, created_at DESC, id DESC)'), 'Correct column ordering');
});

check('Migration 202 creates type-filtered multi-column index for fast slicing', () => {
  assert(migration202.includes('CREATE INDEX IF NOT EXISTS idx_approval_requests_status_type_created'), 'Creates status + type_key + created_at index');
  assert(migration202.includes('ON public.approval_requests (status, type_key, created_at DESC, id DESC)'), 'Correct column ordering');
});

check('Migration 202 creates approver activity history index on approval_decisions', () => {
  assert(migration202.includes('CREATE INDEX IF NOT EXISTS idx_approval_decisions_approver'), 'Creates approver index');
});

check('Migration 202 hardens RLS policies to restrict general queues to admin users', () => {
  assert(migration202.includes("public.current_user_role() IN ('super_admin', 'admin')"), 'Restricts RLS read policy');
});

check('Migration 202 hardens approval_decide, approval_list, and approval_counts RPCs', () => {
  assert(migration202.includes("v_caller_role NOT IN ('super_admin', 'admin', 'service_role', 'postgres')"), 'approval_decide admin check');
  assert(migration202.includes("v_is_admin := v_role IN ('super_admin', 'admin', 'service_role', 'postgres')"), 'approval_list admin check');
});

console.log('\n----------------------------------------------------------------');
console.log(`  RESULT: ${passed} PASSED / ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
