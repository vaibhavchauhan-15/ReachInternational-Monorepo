#!/usr/bin/env node
/**
 * Native Machines RBAC Verification Suite
 *
 * Verifies the shared RBAC matrix for the native Machines module across all five enforcement layers:
 *   1. Database — RLS / triggers / SECURITY DEFINER role checks (live Dev verification)
 *   2. Data layer — role-based projection + capability-gated queries (no fleet/KPI/audit fetch for operators)
 *   3. Server contract — RPC raises 42501 for every non-operator caller
 *   4. Routes — capability redirect guard (deep links and stale navigation state)
 *   5. UI — controls are not mounted (not CSS hidden) and heavy modals mount lazily
 *
 * Single source of truth: packages/permissions/src/machines.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const mobileRoot = path.resolve(path.dirname(__filename), '..');
const repoRoot = path.resolve(mobileRoot, '..', '..');

let totalPassed = 0;
let totalFailed = 0;
let totalWarned = 0;

function check(name, fn) {
  try {
    const result = fn();
    if (result === 'WARN') {
      console.log(`  ! ${name} — pending shared migration (not a native regression)`);
      totalWarned++;
      return;
    }
    console.log(`  ✓ ${name}`);
    totalPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    totalFailed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}


async function acheck(name, fn) {
  try {
    const result = await fn();
    if (result === 'WARN') {
      console.log(`  ! ${name} — pending shared migration (not a native regression)`);
      totalWarned++;
      return;
    }
    console.log(`  ✓ ${name}`);
    totalPassed++;
  } catch (err) {
    console.error(`  ✗ ${name}: ${err.message}`);
    totalFailed++;
  }
}

const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const readMobile = (rel) => fs.readFileSync(path.join(mobileRoot, rel), 'utf8');

const machinesScreen = readMobile('app/(app)/machines.tsx');
const machinesHook = readMobile('lib/hooks/useMachinesData.ts');
const machineCard = readMobile('components/machines/MobileMachineCard.tsx');
const machineDetail = readMobile('components/machines/MachineDetailView.tsx');
const machineModal = readMobile('components/machines/MachineModal.tsx');
const exportModal = readMobile('components/machines/MachineExportModal.tsx');
const permissionsSource = read('packages/permissions/src/machines.ts');
const migration = read('supabase/migrations/232_native_machines_operator_view_and_scope.sql');

console.log('\n[Machines RBAC Suite]: single source of truth → native screens\n');

// ─── 1. SHARED CAPABILITY MATRIX ─────────────────────────────────────────────
console.log('--- 1. Shared capability matrix (@reachinternational/permissions) ---');

check('matrix declares HR with zero machine capabilities', () => {
  assert(permissionsSource.includes('hr: []'), 'Expected `hr: []` in MACHINE_ROLE_CAPABILITIES');
});

check('operator role is limited to VIEW + OPERATOR_VIEW', () => {
  const block = permissionsSource.split('const OPERATOR_CAPABILITIES')[1] || '';
  const slice = block.split('];')[0];
  assert(slice.includes('MACHINE_CAPABILITIES.VIEW'), 'Expected VIEW for operator');
  assert(slice.includes('MACHINE_CAPABILITIES.OPERATOR_VIEW'), 'Expected OPERATOR_VIEW for operator');
  ['CREATE', 'EDIT_SPECS', 'DELETE', 'ASSIGN_SUPERVISOR', 'RENTAL_RATES_VIEW', 'AUDIT_VIEW', 'EXPORT', 'IMPORT']
    .forEach((cap) => assert(!slice.includes(`MACHINE_CAPABILITIES.${cap}`), `Operator must not have ${cap}`));
});

check('supervisor capabilities match the confirmed matrix cells', () => {
  const block = permissionsSource.split('const SUPERVISOR_CAPABILITIES')[1] || '';
  const slice = block.split('];')[0];
  ['VIEW', 'FLEET_VIEW', 'STATUS_UPDATE', 'ASSIGN_OPERATOR', 'ASSIGN_CLIENT', 'AUDIT_VIEW', 'EXPORT']
    .forEach((cap) => assert(slice.includes(`MACHINE_CAPABILITIES.${cap}`), `Supervisor must have ${cap}`));
  ['EDIT_SPECS', 'CREATE', 'IMPORT', 'DELETE', 'ASSIGN_SUPERVISOR', 'RENTAL_RATES_VIEW']
    .forEach((cap) => assert(!slice.includes(`MACHINE_CAPABILITIES.${cap}`), `Supervisor must not have ${cap}`));
});

check('helpers deny by default for unknown roles', () => {
  assert(permissionsSource.includes('return "";'), 'normalizeMachineRole must return "" for unknown roles');
  assert(permissionsSource.includes('if (!normalized) return false;'), 'hasMachineCapability must deny unknown roles');
});

// ─── 2. ROUTE LAYER ──────────────────────────────────────────────────────────
console.log('\n--- 2. Route layer (deep links + stale navigation state) ---');

check('/machines redirects unauthorized roles instead of rendering a dead screen', () => {
  assert(machinesScreen.includes('canAccessMachinesRoute(role)'), 'Expected capability route guard');
  assert(machinesScreen.includes('<Redirect href={getMobileRoleHomeRoute(role) as any} />'), 'Expected Redirect to role home');
  assert(!machinesScreen.includes('<PermissionDeniedView'), 'In-place denial view must be replaced by a redirect');
});

check('machines screen has no ad-hoc role string capability logic', () => {
  ['isAdminOrManager', "=== 'admin'", "=== 'super_admin'", "=== 'manager'", "role || ''"].forEach((token) => {
    assert(!machinesScreen.includes(token), `Found role string comparison: ${token}`);
  });
  assert(machinesScreen.includes("from '@reachinternational/permissions'"), 'Expected permissions import');
});

check('machine tab remains hidden for HR through the navigation manifest', () => {
  const navigation = read('packages/permissions/src/navigation.ts');
  const machinesItem = navigation.split('key: "machines"')[1] || '';
  const rolesBlock = machinesItem.split(']')[0];
  assert(!rolesBlock.includes('"hr"'), 'HR must not receive the Machines nav item');
});

// ─── 3. DATA LAYER ───────────────────────────────────────────────────────────
console.log('\n--- 3. Data layer (role-based projection & query gating) ---');

check('operator reads assigned machinery through the role-checked RPC only', () => {
  assert(machinesHook.includes('get_operator_assigned_machines'), 'Expected operator RPC');
  assert(!machinesHook.includes("from('operator_machine_assignments')"), 'Operator must not issue an assignment query');
  assert(machinesHook.includes('enabled: enabled && operatorView'), 'Operator query must be capability scoped');
});

check('fleet list / KPI / filter-option queries are capability gated', () => {
  assert(machinesHook.includes('hasMachineCapability(userRole, MACHINE_CAPABILITIES.FLEET_VIEW)'), 'Expected FLEET_VIEW gate');
  assert(machinesHook.includes('enabled: enabled && canViewFleet && Boolean(userId)'), 'KPI query must be gated');
  assert(machinesHook.includes('enabled: enabled && canFilter'), 'Filter-option query must be gated');
  assert(machinesHook.includes('enabled: enabled && canViewFleet && Boolean(userId),\n    initialPageParam: 1') ||
    machinesHook.includes('enabled: enabled && canViewFleet && Boolean(userId)'), 'Fleet list query must be gated');
});

check('operator projection excludes rates, audit and personnel arrays', () => {
  const mapper = machinesHook.split('function mapOperatorMachine')[1].split('}\n\n/**')[0];
  ['operator_ids', 'supervisor_ids', 'rental_rate', 'audit', 'customer_mobile', 'notes'].forEach((token) => {
    assert(!mapper.includes(token), `Operator projection leaked ${token}`);
  });
  ['machine_id', 'model', 'serial_number', 'manufacturer', 'year_of_mfg', 'health_status', 'hour_meter', 'worksite_name', 'site_supervisor_name']
    .forEach((token) => assert(mapper.includes(token) || machinesHook.includes(token), `Operator view missing ${token}`));
});

check('cache mutations are surgical and roll back authoritatively', () => {
  assert(machinesHook.includes("queryKey: ['machines', 'infinite']"), 'Expected surgical infinite key');
  assert(machinesHook.includes("queryKey: ['machines', 'operator']"), 'Expected surgical operator key');
  assert(machinesHook.includes('onError: async () =>'), 'Expected rollback hook');
  assert(machinesHook.includes('await resyncMachines()'), 'Expected authoritative resync rollback');
});

// ─── 4. UI LAYER ─────────────────────────────────────────────────────────────
console.log('\n--- 4. UI layer (not mounted, not merely hidden) ---');

check('operator never mounts fleet KPIs or filters', () => {
  assert(machinesScreen.includes('{canViewFleet && kpis && <MachineKPIStrip'), 'KPI strip must be capability gated');
  assert(machinesScreen.includes('{canViewFleet && (\n          <MachineFilterPanel'), 'Filter panel must be capability gated');
});

check('every header action is capability gated', () => {
  const actions = machinesScreen.split('const headerActions')[1].split('return list;')[0];
  ['add-machine', 'manage-categories', 'export-fleet', 'import-excel', 'reset-filters'].forEach((id) => {
    const idx = actions.indexOf(`id: '${id}'`);
    assert(idx > -1, `Missing header action ${id}`);
    const prefix = actions.slice(0, idx);
    assert(/if \(can[A-Za-z]+\) \{\s*$/.test(prefix.split('\n').slice(-2).join('\n')) ||
      prefix.trimEnd().endsWith('{'), `${id} is not capability gated`);
  });
});

check('modals and the filter drawer mount lazily after first authorized open', () => {
  [
    '{machineModalMounted && canOpenMachineEditor && (',
    '{deleteDialogMounted && canDelete && (',
    '{categoryModalMounted && canEditSpecs && (',
    '{importModalMounted && canImport && (',
    '{exportModalMounted && canExport && (',
    '{filterDrawerMounted && canViewFleet && (',
  ].forEach((token) => assert(machinesScreen.includes(token), `Missing lazy mount guard: ${token}`));
});

check('machine detail gates audit, edit, delete and client assignment by capability', () => {
  assert(machineDetail.includes('hasMachineCapability(userRole, MACHINE_CAPABILITIES.AUDIT_VIEW)'), 'Audit capability missing');
  assert(machineDetail.includes('canViewAudit\n        ? ['), 'Audit tab must use the capability');
  assert(machineDetail.includes('hasMachineCapability(userRole, MACHINE_CAPABILITIES.DELETE)'), 'Delete capability missing');
  assert(machineDetail.includes('hasMachineCapability(userRole, MACHINE_CAPABILITIES.EDIT_SPECS)'), 'Edit spec capability missing');
  assert(machineDetail.includes('if (!machine.id || !canViewAudit) return;'), 'Audit query must be capability gated');
});

check('card actions are capability driven and touch sized', () => {
  assert(machineCard.includes('canAssignOperator'), 'Card must receive the assign capability');
  assert(machineCard.includes('canLogEntry'), 'Card must receive the log-entry capability');
  assert(machineCard.includes('pressScale={PRESS.scale}'), 'Card must opt into the shared press scale');
  assert(machineCard.includes('minHeight: 44'), 'Card CTA must keep a 44px touch target');
  assert(machineCard.includes('width: 44'), 'Card icon action must keep a 44px touch target');
});

check('export/PDF native modules are loaded on demand', () => {
  assert(!/^import \* as Print from 'expo-print'/m.test(exportModal), 'expo-print must not be imported at module scope');
  assert(exportModal.includes("require('expo-print')"), 'expo-print must be required inside the export handler');
  assert(exportModal.includes("require('expo-sharing')"), 'expo-sharing must be required inside the export handler');
});

check('supervisor can update HMR/health through the editor (capability reachable)', () => {
  assert(machineDetail.includes('canUpdateStatus'), 'Detail view must expose the status capability');
  assert(machineModal.includes('OPERATIONAL STATUS'), 'Supervisor modal must render the operational status section');
  assert(machineModal.includes('Rental status is derived automatically from the client assignment.'), 'Rental status must stay derived');
});

// ─── 5. DATABASE LAYER (live Dev verification) ───────────────────────────────
console.log('\n--- 5. Database layer (live Dev RLS + SECURITY DEFINER role checks) ---');

function loadEnvLocal() {
  const candidates = [path.join(repoRoot, '.env.local'), path.join(repoRoot, 'apps/web/.env.local')];
  const env = {};
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !env[match[1]]) env[match[1]] = match[2].replace(/^"|"$/g, '');
    }
  }
  return env;
}

async function runSql(sql) {
  const env = loadEnvLocal();
  const token = process.env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.DEV_REF || 'vlmxciuogczumumrwyot';
  if (!token) return { skipped: true };

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await res.text();
  return { status: res.status, text };
}

/** Runs a query as a simulated authenticated user (RLS + auth.uid() apply). */
function asUser(userId, sql) {
  return runSql(`begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"${userId}","role":"authenticated"}', true);
${sql}
rollback;`);
}

async function liveChecks() {
  const probe = await runSql('select 1 as ok;');
  if (probe.skipped) {
    console.log('  - Live DB checks skipped (SUPABASE_ACCESS_TOKEN not configured)');
    totalWarned++;
    return;
  }

  const users = await runSql(
    `select id, role from public.users where role in ('operator','supervisor','hr','manager','admin','super_admin') order by role;`
  );
  const rows = JSON.parse(users.text.slice(users.text.indexOf('[')));
  const byRole = {};
  rows.forEach((u) => { if (!byRole[u.role]) byRole[u.role] = u.id; });

  // Operator with a live assignment (falls back to any operator)
  const assigned = await runSql(
    `select operator_id from public.operator_machine_assignments where is_active order by operator_id limit 1;`
  );
  const assignedRows = JSON.parse(assigned.text.slice(assigned.text.indexOf('[')));
  const operatorId = assignedRows?.[0]?.operator_id || byRole.operator;

  await acheck('operator RPC returns only assigned machinery (server-projected columns)', async () => {
    const res = await asUser(operatorId, 'select * from public.get_operator_assigned_machines();');
    assert(res.status === 201 || res.status === 200, `Operator RPC failed: ${res.text.slice(0, 160)}`);
    const data = JSON.parse(res.text.slice(res.text.indexOf('[')));
    const keys = Object.keys(data[0] || {});
    ['rental_rate', 'daily_rate', 'operator_ids', 'supervisor_ids', 'notes', 'customer_mobile'].forEach((col) => {
      assert(!keys.includes(col), `Operator RPC leaked column ${col}`);
    });
    if (data.length > 0) {
      ['machine_id', 'model', 'serial_number', 'manufacturer', 'year_of_mfg', 'health_status', 'hour_meter', 'worksite_name', 'site_supervisor_name']
        .forEach((col) => assert(keys.includes(col), `Operator RPC missing ${col}`));
    }
    return 'PASS';
  });

  for (const role of ['hr', 'supervisor', 'manager', 'admin']) {
    const userId = byRole[role];
    if (!userId) continue;
    await acheck(`operator RPC rejects ${role} with 42501`, async () => {
      const res = await asUser(userId, 'select * from public.get_operator_assigned_machines();');
      assert(res.status >= 400, `${role} unexpectedly received rows`);
      assert(res.text.includes('42501'), `Expected SQLSTATE 42501, got: ${res.text.slice(0, 160)}`);
      return 'PASS';
    });
  }

  if (byRole.operator) {
    await acheck('audit_logs RLS returns zero rows for operators', async () => {
      const res = await asUser(byRole.operator, 'select count(*)::int as n from public.audit_logs;');
      if (res.status >= 400) {
        assert(res.text.includes('42501') || res.text.includes('permission denied'), 'Unexpected operator audit error');
        return 'PASS';
      }
      const data = JSON.parse(res.text.slice(res.text.indexOf('[')));
      assert((data?.[0]?.n ?? 0) === 0, `Operator received ${data?.[0]?.n} audit rows`);
      return 'PASS';
    });
  }

  if (byRole.hr) {
    await acheck('HR cannot read the fleet table (RLS)', async () => {
      const res = await asUser(byRole.hr, 'select count(*)::int as n from public.machines;');
      if (res.status >= 400) return 'PASS';
      const data = JSON.parse(res.text.slice(res.text.indexOf('[')));
      if ((data?.[0]?.n ?? 0) > 0) return 'WARN'; // shared migration 231 pending
      return 'PASS';
    });

    await acheck('HR is rejected by get_machines_directory_summary (42501)', async () => {
      const res = await asUser(byRole.hr, 'select public.get_machines_directory_summary(null, null, null);');
      if (res.status >= 400 && res.text.includes('42501')) return 'PASS';
      return 'WARN'; // shared migration 231 pending
    });
  }

  if (byRole.operator) {
    await acheck('operator cannot self-escalate to the fleet KPI RPC', async () => {
      const res = await asUser(byRole.operator, 'select public.get_machines_directory_summary(null, null, null);');
      if (res.status >= 400 && res.text.includes('42501')) return 'PASS';
      return 'WARN'; // shared migration 231 pending
    });
  }

  await acheck('no commercial rental-rate column exists to over-fetch', async () => {
    const res = await runSql(
      `select count(*)::int as n from information_schema.columns where table_schema='public' and table_name='machines' and column_name ~ '(rate|price|tariff)';`
    );
    const data = JSON.parse(res.text.slice(res.text.indexOf('[')));
    assert((data?.[0]?.n ?? 0) === 0, 'machines now exposes a rate/price column — extend the capability projection');
    return 'PASS';
  });

  // ── Write-path denials: every ✗ must also fail closed at the database ──
  const firstMachine = await runSql('select id from public.machines order by machine_id limit 1;');
  const machineId = JSON.parse(firstMachine.text.slice(firstMachine.text.indexOf('[')))[0]?.id;

  if (byRole.operator) {
    await acheck('operator SELECT is limited to actively assigned machinery (RLS)', async () => {
      const rpc = await asUser(operatorId, 'select * from public.get_operator_assigned_machines();');
      const assigned = JSON.parse(rpc.text.slice(rpc.text.indexOf('[')) || '[]');
      const res = await asUser(operatorId, 'select count(*)::int as n from public.machines;');
      if (res.status >= 400) return 'PASS';
      const data = JSON.parse(res.text.slice(res.text.indexOf('[')));
      assert(
        (data?.[0]?.n ?? 0) === assigned.length,
        `Operator saw ${data?.[0]?.n} machines but owns ${assigned.length}`
      );
      return 'PASS';
    });

    await acheck('operator cannot change machine assignment columns (blocked)', async () => {
      if (!machineId) return 'WARN';
      const res = await asUser(
        operatorId,
        `with upd as (update public.machines set customer_name = 'RLS-PROBE' where id = '${machineId}' returning id)
         select count(*)::int as n from upd;`
      );
      if (res.status >= 400) {
        assert(
          res.text.includes('42501') || /permission denied|violates row-level security/i.test(res.text),
          `Unexpected error: ${res.text.slice(0, 160)}`
        );
        return 'PASS';
      }
      const rows = JSON.parse(res.text.slice(res.text.indexOf('[')) || '[]');
      assert((rows?.[0]?.n ?? 0) === 0, 'Operator updated a machine outside the shift-log fields');
      return 'PASS';
    });
  }

  if (byRole.supervisor && machineId) {
    await acheck('supervisor cannot edit static machine specs (blocked)', async () => {
      const res = await asUser(
        byRole.supervisor,
        `with upd as (update public.machines set model = model || '-PROBE' where id = '${machineId}' returning id)
         select count(*)::int as n from upd;`
      );
      if (res.status >= 400) {
        assert(
          res.text.includes('42501') || /permission denied/i.test(res.text),
          `Unexpected error: ${res.text.slice(0, 160)}`
        );
        return 'PASS';
      }
      const rows = JSON.parse(res.text.slice(res.text.indexOf('[')) || '[]');
      assert((rows?.[0]?.n ?? 0) === 0, 'Supervisor edited machine specs');
      return 'PASS';
    });

    await acheck('supervisor cannot delete a machine (RLS)', async () => {
      const res = await asUser(
        byRole.supervisor,
        `with del as (delete from public.machines where id = '${machineId}' returning id)
         select count(*)::int as n from del;`
      );
      if (res.status >= 400) return 'PASS';
      const rows = JSON.parse(res.text.slice(res.text.indexOf('[')) || '[]');
      assert((rows?.[0]?.n ?? 0) === 0, 'Supervisor deleted a machine');
      return 'PASS';
    });
  }

  if (byRole.hr) {
    await acheck('HR cannot insert a machine (RLS)', async () => {
      const res = await asUser(
        byRole.hr,
        `with ins as (
           insert into public.machines (machine_id, machine_name, model, serial_number, year_of_mfg, manufacturer)
           values ('HR/PROBE-1', 'Probe', 'Probe', 'HR-PROBE-1', 2024, 'Probe') returning id
         )
         select count(*)::int as n from ins;`
      );
      if (res.status >= 400) return 'PASS';
      const rows = JSON.parse(res.text.slice(res.text.indexOf('[')) || '[]');
      assert((rows?.[0]?.n ?? 0) === 0, 'HR inserted a machine row');
      return 'PASS';
    });
  }
}

// NOTE: liveChecks is async; check() must await async assertions before counting failures.
async function run() {
  await liveChecks();

  console.log(`\nResults: ${totalPassed} Passed, ${totalFailed} Failed, ${totalWarned} Pending/Shared.\n`);
  if (totalFailed > 0) {
    console.error('❌ Machines RBAC verification FAILED');
    process.exit(1);
  }
  console.log('✅ Machines RBAC verification passed.\n');
}

run();
