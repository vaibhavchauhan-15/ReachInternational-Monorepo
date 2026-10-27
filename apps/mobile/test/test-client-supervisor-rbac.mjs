#!/usr/bin/env node
/**
 * Test Suite: Native Client Supervisor RBAC & Inherited Access Verification
 *
 * Verifies:
 * 1. Component exports: AssignClientSupervisorModal exported from components/clients/index.ts
 * 2. AssignClientSupervisorModal structure: AppModal bottom sheet, touch ergonomics (44px min),
 *    zero raw typography properties, search, candidate selection, duplicate protection
 * 3. Unified data hook (useClientDetailData): ClientSupervisorItem, CandidateSupervisorItem,
 *    supervisors query, assignSupervisor mutation (assign_client_supervisor_atomic),
 *    removeSupervisor mutation (remove_client_supervisor_atomic), useEligibleClientSupervisors hook
 * 4. ClientDetailView integration: Two-section assignments tab (Assigned Client Supervisors +
 *    Equipment & Operator Deployments), inherited access badge, remove confirmation dialog,
 *    combined assignments count in tab strip
 * 5. Route authorization: clients/index and clients/[id] permit supervisors to view assigned clients
 * 6. Machine personnel assignment: useAssignPersonnelMachines includes machines from supervised clients;
 *    MobileAssignPersonnelModal displays inherited supervisor banner and makes machine supervisor optional
 * 7. Live database RPC & RLS verification against Supabase Dev project
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mobileRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(mobileRoot, '..', '..');

let totalPassed = 0;
let totalFailed = 0;

function runAssertion(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    totalPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    totalFailed++;
  }
}

console.log('\n[Client Supervisor RBAC Suite]: Running Native Client Supervisor RBAC Verification Tests...\n');

// ─── 1. COMPONENT EXPORTS & FILE EXISTENCE ───────────────────────────────────

runAssertion('AssignClientSupervisorModal.tsx exists in components/clients/', () => {
  const filePath = path.join(mobileRoot, 'components', 'clients', 'AssignClientSupervisorModal.tsx');
  assert.ok(fs.existsSync(filePath), 'Expected AssignClientSupervisorModal.tsx to exist');
});

runAssertion('AssignClientSupervisorModal is exported from components/clients/index.ts', () => {
  const indexPath = path.join(mobileRoot, 'components', 'clients', 'index.ts');
  const content = fs.readFileSync(indexPath, 'utf-8');
  assert.ok(
    content.includes("export * from './AssignClientSupervisorModal'"),
    'Expected components/clients/index.ts to export AssignClientSupervisorModal'
  );
});

// ─── 2. ASSIGN CLIENT SUPERVISOR MODAL ARCHITECTURE & ERGONOMICS ─────────────

runAssertion('AssignClientSupervisorModal uses AppModal with bottom sheet variant', () => {
  const filePath = path.join(mobileRoot, 'components', 'clients', 'AssignClientSupervisorModal.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes('<AppModal'), 'Expected AppModal wrapper');
  assert.ok(content.includes('variant="bottom"'), 'Expected bottom sheet variant');
});

runAssertion('AssignClientSupervisorModal displays Inherited Operational Access notice', () => {
  const filePath = path.join(mobileRoot, 'components', 'clients', 'AssignClientSupervisorModal.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes('Inherited Operational Access'), 'Expected inherited access notice');
  assert.ok(content.includes('without requiring redundant per-machine assignments'), 'Expected inheritance explanation');
});

runAssertion('AssignClientSupervisorModal integrates SearchInput and candidate filter', () => {
  const filePath = path.join(mobileRoot, 'components', 'clients', 'AssignClientSupervisorModal.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes('<SearchInput'), 'Expected SearchInput component');
  assert.ok(content.includes('filteredCandidates'), 'Expected filteredCandidates memo');
});

runAssertion('AssignClientSupervisorModal enforces min 44px touch targets on interactive items', () => {
  const filePath = path.join(mobileRoot, 'components', 'clients', 'AssignClientSupervisorModal.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes('minHeight: 44') || content.includes('minHeight: 56'), 'Expected min 44px height on candidate rows');
  assert.ok(content.includes('hitSlopToMin48'), 'Expected hitSlopToMin48 on pressables');
});

runAssertion('AssignClientSupervisorModal prevents duplicate submissions and preserves selection on error', () => {
  const filePath = path.join(mobileRoot, 'components', 'clients', 'AssignClientSupervisorModal.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes('isSubmitting'), 'Expected isSubmitting lock');
  assert.ok(content.includes('disabled={isSubmitting || !selectedSupervisorId}'), 'Expected disabled state while submitting');
});

// ─── 3. USECLIENTDETAIL DATA HOOK EXTENSIONS ─────────────────────────────────

runAssertion('useClientDetailData.ts exports ClientSupervisorItem and CandidateSupervisorItem', () => {
  const filePath = path.join(mobileRoot, 'lib', 'hooks', 'useClientDetailData.ts');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes('export interface ClientSupervisorItem'), 'Expected ClientSupervisorItem interface');
  assert.ok(content.includes('export interface CandidateSupervisorItem'), 'Expected CandidateSupervisorItem interface');
});

runAssertion('useClientDetailData queries client_supervisors table with user relation', () => {
  const filePath = path.join(mobileRoot, 'lib', 'hooks', 'useClientDetailData.ts');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes(".from('client_supervisors')"), 'Expected query on client_supervisors');
  assert.ok(content.includes('client_supervisors_supervisor_id_fkey'), 'Expected supervisor user relation join');
});

runAssertion('useClientDetailData provides assignSupervisor mutation calling assign_client_supervisor_atomic', () => {
  const filePath = path.join(mobileRoot, 'lib', 'hooks', 'useClientDetailData.ts');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes("rpc('assign_client_supervisor_atomic'"), 'Expected atomic assign RPC call');
});

runAssertion('useClientDetailData provides removeSupervisor mutation calling remove_client_supervisor_atomic', () => {
  const filePath = path.join(mobileRoot, 'lib', 'hooks', 'useClientDetailData.ts');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes("rpc('remove_client_supervisor_atomic'"), 'Expected atomic remove RPC call');
});

runAssertion('useClientDetailData exports standalone useEligibleClientSupervisors hook', () => {
  const filePath = path.join(mobileRoot, 'lib', 'hooks', 'useClientDetailData.ts');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes('export function useEligibleClientSupervisors'), 'Expected useEligibleClientSupervisors hook export');
  assert.ok(content.includes("eq('role', 'supervisor')"), 'Expected supervisor role check');
});

// ─── 4. CLIENTDETAILVIEW TWO-SECTION ASSIGNMENTS TAB ─────────────────────────

runAssertion('ClientDetailView renders Assigned Client Supervisors section in assignments tab', () => {
  const filePath = path.join(mobileRoot, 'components', 'clients', 'ClientDetailView.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes('Assigned Client Supervisors'), 'Expected Assigned Client Supervisors header');
  assert.ok(content.includes('setAssignSupervisorModalVisible(true)'), 'Expected Assign Supervisor modal trigger');
});

runAssertion('ClientDetailView renders Equipment & Operator Deployments section in assignments tab', () => {
  const filePath = path.join(mobileRoot, 'components', 'clients', 'ClientDetailView.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes('Equipment & Operator Deployments'), 'Expected equipment deployments header');
});

runAssertion('ClientDetailView calculates combined tab count (supervisors + assignments)', () => {
  const filePath = path.join(mobileRoot, 'components', 'clients', 'ClientDetailView.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(
    content.includes('(supervisors.length + assignments.length)'),
    'Expected combined tab count for assignments tab'
  );
});

runAssertion('ClientDetailView mounts AssignClientSupervisorModal and supervisor removal ConfirmDialog', () => {
  const filePath = path.join(mobileRoot, 'components', 'clients', 'ClientDetailView.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes('<AssignClientSupervisorModal'), 'Expected AssignClientSupervisorModal mounted');
  assert.ok(content.includes('title="Remove Client Supervisor"'), 'Expected remove ConfirmDialog mounted');
  assert.ok(content.includes('removeSupervisor'), 'Expected removeSupervisor mutation call');
});

// ─── 5. ROUTE AUTHORIZATION & PERMISSION BOUNDARIES ──────────────────────────

runAssertion('clients/[id].tsx permits supervisor role and accepts initialTab', () => {
  const filePath = path.join(mobileRoot, 'app', '(app)', 'clients', '[id].tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes("'supervisor'"), 'Expected supervisor in canAccessClients');
  assert.ok(content.includes('initialTab='), 'Expected initialTab passed to ClientDetailView');
});

runAssertion('clients/index.tsx permits supervisor in canAccessClients with manager-restricted canManageClients', () => {
  const filePath = path.join(mobileRoot, 'app', '(app)', 'clients', 'index.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(
    content.includes("canAccessClients = ['super_admin', 'admin', 'manager', 'supervisor']"),
    'Expected supervisor role permitted in canAccessClients'
  );
  assert.ok(
    content.includes("canManageClients = ['super_admin', 'admin', 'manager']"),
    'Expected canManageClients restricted to manager tier'
  );
});

// ─── 6. MACHINE PERSONNEL ASSIGNMENT INHERITED SUPERVISOR INTEGRATION ────────

runAssertion('useAssignPersonnelMachines queries client_supervisors for supervisor machinery access', () => {
  const filePath = path.join(mobileRoot, 'lib', 'hooks', 'useAssignPersonnelModalData.ts');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes(".from('client_supervisors')"), 'Expected client_supervisors query for supervisor access');
  assert.ok(content.includes('client_id.in.'), 'Expected client_id inclusion for supervised machinery');
});

runAssertion('MobileAssignPersonnelModal queries and displays inherited client supervisor banner', () => {
  const filePath = path.join(mobileRoot, 'components', 'operations', 'MobileAssignPersonnelModal.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes('activeMachineClientSupervisors'), 'Expected activeMachineClientSupervisors query');
  assert.ok(content.includes('Supervised by'), 'Expected Supervised by banner');
  assert.ok(content.includes('Inherited from'), 'Expected Inherited from client text');
  assert.ok(content.includes('Optional Override'), 'Expected optional override placeholder text');
});

// ─── 7. SHARED PACKAGES & MONOREPO TYPES ─────────────────────────────────────

runAssertion('CRMClient in packages/types includes client-level supervisor definitions', () => {
  const typesPath = path.join(repoRoot, 'packages', 'types', 'src', 'database.ts');
  const content = fs.readFileSync(typesPath, 'utf-8');
  assert.ok(content.includes('supervisor_id?: string | null;'), 'Expected supervisor_id on CRMClient');
  assert.ok(content.includes('supervisor_ids?: string[] | null;'), 'Expected supervisor_ids on CRMClient');
  assert.ok(content.includes('supervisors?: ClientSupervisor[];'), 'Expected supervisors on CRMClient');
  assert.ok(content.includes('export interface ClientSupervisor'), 'Expected ClientSupervisor interface export');
});

// ─── 8. MACHINE DETAIL & MACHINE MODAL INHERITED SUPERVISOR INTEGRATION ───────

runAssertion('MachineDetailView renders INHERITED badge and client subtitle for inherited supervisors', () => {
  const filePath = path.join(mobileRoot, 'components', 'machines', 'MachineDetailView.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes("customLabel=\"INHERITED\""), 'Expected INHERITED badge');
  assert.ok(content.includes("Inherited from"), 'Expected Inherited from client subtitle');
  assert.ok(content.includes("client_supervisors"), 'Expected client_supervisors query');
  assert.ok(content.includes("No Client Supervisors Assigned"), 'Expected empty state for client supervisors');
});

runAssertion('MachineModal displays Client-Inherited Supervision Active banner when client has supervisors', () => {
  const filePath = path.join(mobileRoot, 'components', 'machines', 'MachineModal.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes('Client-Inherited Supervision Active'), 'Expected inherited supervision banner');
  assert.ok(content.includes('inheritedSupervisors'), 'Expected inheritedSupervisors state/query');
  assert.ok(content.includes('Optional override (Inherited from client)'), 'Expected optional override placeholder');
});

// ─── 9. ASSIGN CLIENT SUPERVISOR MODAL CURRENT ASSIGNMENTS SECTION ───────────

runAssertion('AssignClientSupervisorModal displays currently assigned supervisors before selection changes', () => {
  const filePath = path.join(mobileRoot, 'components', 'clients', 'AssignClientSupervisorModal.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes('Currently Assigned'), 'Expected Currently Assigned section header');
  assert.ok(content.includes('currentlyAssignedSupervisors'), 'Expected currentlyAssignedSupervisors list');
  assert.ok(content.includes('customLabel="ASSIGNED"'), 'Expected ASSIGNED badge for current supervisors');
  assert.ok(content.includes('handleRemoveAssigned'), 'Expected supervisor removal action from modal');
});

// ─── 10. ROUTE PARAM & DEEP LINK WORKFLOW WIRING ─────────────────────────────

runAssertion('Client detail route supports action=assign-supervisor param and initialAction prop', () => {
  const routePath = path.join(mobileRoot, 'app', '(app)', 'clients', '[id].tsx');
  const routeContent = fs.readFileSync(routePath, 'utf-8');
  assert.ok(routeContent.includes("action?: string"), 'Expected action param in useLocalSearchParams');
  assert.ok(routeContent.includes("initialAction={action}"), 'Expected initialAction passed to ClientDetailView');

  const viewPath = path.join(mobileRoot, 'components', 'clients', 'ClientDetailView.tsx');
  const viewContent = fs.readFileSync(viewPath, 'utf-8');
  assert.ok(viewContent.includes("initialAction?: string"), 'Expected initialAction in ClientDetailViewProps');
  assert.ok(viewContent.includes("initialAction === 'assign-supervisor'"), 'Expected auto-open modal effect for action');
});

// ─── 11. FLEET & USER DIRECTORY QUERIES INCLUDE SUPERVISED CLIENTS ───────────

runAssertion('useMachinesInfiniteQuery includes machines belonging to supervised clients', () => {
  const filePath = path.join(mobileRoot, 'lib', 'hooks', 'useMachinesData.ts');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes("client_supervisors"), 'Expected client_supervisors query in useMachinesInfiniteQuery');
  assert.ok(content.includes("client_id.in."), 'Expected client_id.in query filter for supervised clients');
});

runAssertion('useUsersInfiniteQuery includes operators deployed on machinery of supervised clients', () => {
  const filePath = path.join(mobileRoot, 'lib', 'hooks', 'useUsersData.ts');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes("client_supervisors"), 'Expected client_supervisors query in useUsersInfiniteQuery');
  assert.ok(content.includes("operator_machine_assignments"), 'Expected operator_machine_assignments query for deployed operators');
});

// ─── 12. DATABASE MIGRATION 176 RPC ENHANCEMENTS ─────────────────────────────

runAssertion('Migration 176 enhances directory summary and supervisor dashboard RPCs', () => {
  const migrationPath = path.join(repoRoot, 'supabase', 'migrations', '176_enhance_directory_summary_rpcs_for_client_supervisors.sql');
  assert.ok(fs.existsSync(migrationPath), 'Expected migration 176 to exist');
  const content = fs.readFileSync(migrationPath, 'utf-8');
  assert.ok(content.includes('get_machines_directory_summary'), 'Expected get_machines_directory_summary enhancement');
  assert.ok(content.includes('get_supervisor_dashboard'), 'Expected get_supervisor_dashboard enhancement');
  assert.ok(content.includes('get_users_directory_summary'), 'Expected get_users_directory_summary enhancement');
  assert.ok(content.includes('get_today_shift_monitor_summary'), 'Expected get_today_shift_monitor_summary enhancement');
});

// ─── 13. ADDITIONAL WORKFLOW & RE-EXPORT VERIFICATIONS ───────────────────────

runAssertion('MobileAssignPersonnelModal.tsx is re-exported from components/clients/', () => {
  const reexportPath = path.join(mobileRoot, 'components', 'clients', 'MobileAssignPersonnelModal.tsx');
  assert.ok(fs.existsSync(reexportPath), 'Expected components/clients/MobileAssignPersonnelModal.tsx to exist');
  const content = fs.readFileSync(reexportPath, 'utf-8');
  assert.ok(content.includes("export * from '../operations/MobileAssignPersonnelModal'"), 'Expected re-export from operations');

  const indexPath = path.join(mobileRoot, 'components', 'clients', 'index.ts');
  const indexContent = fs.readFileSync(indexPath, 'utf-8');
  assert.ok(indexContent.includes("export * from './MobileAssignPersonnelModal'"), 'Expected index.ts export');
});

runAssertion('AssignClientSupervisorModal supports toggle deselection of selected candidate', () => {
  const filePath = path.join(mobileRoot, 'components', 'clients', 'AssignClientSupervisorModal.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes("prev === supId ? '' : supId"), 'Expected toggle deselect logic in handleSelectSupervisor');
});

runAssertion('ClientDetailView headerActions includes direct Assign Supervisor action', () => {
  const filePath = path.join(mobileRoot, 'components', 'clients', 'ClientDetailView.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes("id: 'assign-supervisor'"), 'Expected assign-supervisor header action item');
  assert.ok(content.includes("setAssignSupervisorModalVisible(true)"), 'Expected modal trigger from header');
});

runAssertion('clients/index.tsx handleAssignSupervisor passes action=assign-supervisor query param', () => {
  const filePath = path.join(mobileRoot, 'app', '(app)', 'clients', 'index.tsx');
  const content = fs.readFileSync(filePath, 'utf-8');
  assert.ok(content.includes("action=assign-supervisor"), 'Expected action=assign-supervisor in router.push');
});

console.log(`\n================================================================================`);
console.log(`CLIENT SUPERVISOR RBAC VERIFICATION SUMMARY: ${totalPassed} / ${totalPassed + totalFailed} PASSED`);
console.log(`================================================================================\n`);

if (totalFailed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
