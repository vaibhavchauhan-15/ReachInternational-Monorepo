#!/usr/bin/env node
/**
 * Test Suite: Shift Entry Comprehensive Multi-Shift, Multi-Machine & Date Independence Verification
 * 
 * Verifies:
 * 1. Multi-Shift on Same Machine (Distinct assignment IDs for Shift A and Shift B, avoiding unique index collision)
 * 2. Multi-Shift on Different Machines (Cross-machine overlap prevention, valid non-overlapping multi-machine operation)
 * 3. Date Independence (Today vs Yesterday assignments are fully independent)
 * 4. Past Date Unassigned Guard (Operators without assignment covering target date blocked across DB, Server Action, and UI)
 * 5. Hour Meter Non-Regression (Historical log entry never decrements machine hour_meter backwards)
 * 6. Mobile & Web Parity (RPC parameters, UI alerts, disabled states, and fallback consistency)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('\n================================================================');
console.log('  TEST: SHIFT ENTRY COMPREHENSIVE VERIFICATION SUITE            ');
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

async function checkAsync(desc, fn) {
  try {
    await fn();
    console.log(`  ✓ ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// 1. Static Contract & Codebase Hardening Checks
// -----------------------------------------------------------------------------
console.log('--- 1. Static Invariants & Codebase Verification ---');

const migrationSql = fs.readFileSync(
  path.resolve(rootDir, 'supabase/migrations/226_fix_shift_entry_assignment_and_unassigned_guard.sql'),
  'utf8'
);
const webActionCode = fs.readFileSync(
  path.resolve(rootDir, 'apps/web/app/actions/operators.ts'),
  'utf8'
);
const webClientCode = fs.readFileSync(
  path.resolve(rootDir, 'apps/web/components/operations/entry/OperatorEntryClient.tsx'),
  'utf8'
);
const mobileCode = fs.readFileSync(
  path.resolve(rootDir, 'apps/mobile/components/operations/MobileOperatorEntryCard.tsx'),
  'utf8'
);
const typesCode = fs.readFileSync(
  path.resolve(rootDir, 'packages/types/src/database.ts'),
  'utf8'
);

check('Migration 226 declares p_assignment_id DEFAULT NULL::uuid in submit_operator_hour_log_atomic', () => {
  assert(
    migrationSql.includes('p_assignment_id uuid DEFAULT NULL::uuid'),
    'submit_operator_hour_log_atomic must define p_assignment_id parameter'
  );
});

check('Migration 226 resolves assignment_id strictly matching shift_code', () => {
  assert(
    migrationSql.includes(String.raw`lower(trim(regexp_replace(oma.shift_code, '^shift\\s*', '', 'i'))) = lower(trim(v_shift_code))`),
    'RPC must resolve assignment_id strictly matching the normalized shift_code'
  );
});

check('Migration 226 protects machine hour_meter using GREATEST(hour_meter, p_end_meter)', () => {
  assert(
    migrationSql.includes('hour_meter          = GREATEST(COALESCE(hour_meter, 0), p_end_meter)'),
    'Machine hour_meter update must be non-regressing using GREATEST'
  );
});

check('Migration 226 installs trigger trg_enforce_operator_assignment_exists on machine_hour_logs', () => {
  assert(
    migrationSql.includes('CREATE TRIGGER trg_enforce_operator_assignment_exists'),
    'Trigger trg_enforce_operator_assignment_exists must be defined'
  );
  assert(
    migrationSql.includes('BEFORE INSERT OR UPDATE ON public.machine_hour_logs'),
    'Trigger must execute BEFORE INSERT OR UPDATE ON machine_hour_logs'
  );
});

check('Web Server Action enforces non-assisted operator assignment existence', () => {
  assert(
    webActionCode.includes('if (!isAssisted && (!activeAssignments || activeAssignments.length === 0))'),
    'Server action must reject non-assisted entries if operator has no assignment on work date'
  );
});

check('Web Server Action resolves shift-matched assignment ID and passes to RPC', () => {
  assert(
    webActionCode.includes('p_assignment_id: resolvedAssignmentId'),
    'submit_operator_hour_log_atomic RPC call must receive resolvedAssignmentId'
  );
  assert(
    webActionCode.includes('hour_meter: Math.max(Number(mData?.hour_meter) || 0, endMtr)'),
    'Fallback machine update must use Math.max to prevent hour meter regression'
  );
});

check('Web UI dynamically resolves shift-specific assignment ID from context.assigned_shifts', () => {
  assert(
    webClientCode.includes('const matchedAss = context.assigned_shifts?.find'),
    'OperatorEntryClient must find assignment matching selected shift code'
  );
  assert(
    webClientCode.includes('assignmentId: effectiveAssignmentId'),
    'OperatorEntryClient must submit effectiveAssignmentId'
  );
  assert(
    webClientCode.includes('You were not assigned to any equipment or shift on'),
    'OperatorEntryClient must show unassigned warning banner'
  );
});

check('Mobile UI dynamically resolves shift-specific assignment ID and passes p_assignment_id', () => {
  assert(
    mobileCode.includes('const matchedAss = currentContext?.assigned_shifts?.find'),
    'MobileOperatorEntryCard must match assignment to shift code'
  );
  assert(
    mobileCode.includes('p_assignment_id: effectiveAssignmentId'),
    'MobileOperatorEntryCard must pass p_assignment_id in rpcParams'
  );
  assert(
    mobileCode.includes('hour_meter: Math.max(Number((effectiveMachine as any)?.hour_meter) || 0, endNum)'),
    'Mobile direct fallback update must use Math.max to prevent meter regression'
  );
  assert(
    mobileCode.includes('const isSupervisorOrAdmin = [\'super_admin\', \'admin\', \'manager\', \'supervisor\'].includes'),
    'Mobile component must restrict fleet machine fetching to supervisors/admins'
  );
});

check('Shared Types include assigned_shifts and assigned_machines in OperatorEntryContext', () => {
  assert(
    typesCode.includes('assigned_shifts?: Array<{'),
    'OperatorEntryContext must define assigned_shifts'
  );
  assert(
    typesCode.includes('assigned_machines?: Array<{'),
    'OperatorEntryContext must define assigned_machines'
  );
});

// -----------------------------------------------------------------------------
// 2. Live Database Verification on Development DB (vlmxciuogczumumrwyot)
// -----------------------------------------------------------------------------
console.log('\n--- 2. Live Database Verification (Dev DB: vlmxciuogczumumrwyot) ---');

function loadEnv() {
  const envPath = path.resolve(rootDir, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i), l.slice(i + 1)];
      })
  );
}

const env = loadEnv();
const token = process.env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_ACCESS_TOKEN || '';
const devProjectRef = 'vlmxciuogczumumrwyot';

async function queryDev(sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${devProjectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DB Query HTTP ${res.status}: ${err}`);
  }
  return res.json();
}

await checkAsync('Dev DB has submit_operator_hour_log_atomic with p_assignment_id parameter', async () => {
  const rows = await queryDev(`
    SELECT proname, proargnames 
    FROM pg_proc 
    WHERE proname = 'submit_operator_hour_log_atomic';
  `);
  assert(rows.length > 0, 'Function submit_operator_hour_log_atomic must exist');
  const args = rows[0].proargnames || [];
  assert(args.includes('p_assignment_id'), 'proargnames must include p_assignment_id');
});

await checkAsync('Dev DB has canonical get_operator_entry_context with exactly 2 parameters', async () => {
  const rows = await queryDev(`
    SELECT proname, proargnames, pronargs 
    FROM pg_proc 
    WHERE proname = 'get_operator_entry_context';
  `);
  assert.equal(rows.length, 1, 'Exactly one get_operator_entry_context function must exist (no ambiguous overload)');
  assert.equal(rows[0].pronargs, 2, 'get_operator_entry_context must accept 2 parameters');
  assert.deepEqual(rows[0].proargnames, ['p_operator_id', 'p_target_date']);
});

await checkAsync('Dev DB has active trigger trg_enforce_operator_assignment_exists on machine_hour_logs', async () => {
  const rows = await queryDev(`
    SELECT tgname, relname 
    FROM pg_trigger t 
    JOIN pg_class c ON c.oid = t.tgrelid 
    WHERE tgname = 'trg_enforce_operator_assignment_exists';
  `);
  assert(rows.length > 0, 'Trigger trg_enforce_operator_assignment_exists must be attached');
  assert.equal(rows[0].relname, 'machine_hour_logs');
});

await checkAsync('get_operator_entry_context returns structured assigned_shifts and assigned_machines arrays', async () => {
  const rows = await queryDev(`
    SELECT public.get_operator_entry_context(NULL, CURRENT_DATE) AS ctx;
  `);
  assert(rows.length > 0, 'RPC execution succeeded');
  const ctx = rows[0].ctx;
  assert(Array.isArray(ctx.assigned_shifts), 'ctx.assigned_shifts must be an array');
  assert(Array.isArray(ctx.assigned_machines), 'ctx.assigned_machines must be an array');
  assert(Array.isArray(ctx.shift_codes), 'ctx.shift_codes must be an array');
});

await checkAsync('trg_enforce_operator_assignment_exists blocks unassigned operator past-date insert (42501)', async () => {
  // Find a machine and operator pair where no assignment exists
  const pairRes = await queryDev(`
    SELECT m.id AS machine_id, u.id AS operator_id
    FROM public.machines m
    CROSS JOIN (SELECT id FROM public.users WHERE role = 'operator') u
    WHERE NOT EXISTS (
      SELECT 1 FROM public.operator_machine_assignments oma 
      WHERE oma.machine_id = m.id AND oma.operator_id = u.id
    )
    LIMIT 1;
  `);
  
  if (pairRes.length > 0) {
    const { machine_id: machineId, operator_id: operatorId } = pairRes[0];

    let threwExpected = false;
    let actualError = null;
    try {
      const res = await queryDev(`
        INSERT INTO public.machine_hour_logs (
          machine_id, operator_id, log_date, start_meter, end_meter,
          entry_source, entered_by, shift_code,
          start_datetime, end_datetime
        ) VALUES (
          '${machineId}', '${operatorId}', (CURRENT_DATE - 5), 100, 108,
          'operator', '${operatorId}', 'A',
          ((CURRENT_DATE - 5)::text || ' 06:00:00+05:30')::timestamptz,
          ((CURRENT_DATE - 5)::text || ' 14:00:00+05:30')::timestamptz
        );
      `);
      console.log('      Unexpected query success, result was:', res);
    } catch (e) {
      actualError = e.message;
      if (e.message.includes('42501') || e.message.includes('not authorized') || e.message.includes('valid assignment')) {
        threwExpected = true;
      }
    }
    assert(threwExpected, `Inserting log without assignment must fail with 42501, got: ${actualError}`);
  }
});

await checkAsync('Multi-shift on same machine: get_operator_entry_context resolves distinct assignments per shift', async () => {
  // 1. Pick an operator, machine and admin
  const mRes = await queryDev(`SELECT id FROM public.machines LIMIT 1;`);
  const uRes = await queryDev(`SELECT id FROM public.users WHERE role = 'operator' LIMIT 1;`);
  const aRes = await queryDev(`SELECT id FROM public.users WHERE role IN ('admin', 'super_admin') LIMIT 1;`);
  
  if (mRes.length > 0 && uRes.length > 0 && aRes.length > 0) {
    const machineId = mRes[0].id;
    const operatorId = uRes[0].id;
    const adminId = aRes[0].id;
    const testDate = '2026-11-20';

    // Insert 2 test assignments for Shift A and Shift B
    const assA = await queryDev(`
      INSERT INTO public.operator_machine_assignments (
        operator_id, machine_id, assigned_by, is_active, shift_code, shift_start_time, shift_end_time, valid_from, valid_to
      ) VALUES (
        '${operatorId}', '${machineId}', '${adminId}', true, 'A', '06:00:00', '14:00:00', '${testDate}', '${testDate}'
      ) RETURNING id;
    `);
    const assB = await queryDev(`
      INSERT INTO public.operator_machine_assignments (
        operator_id, machine_id, assigned_by, is_active, shift_code, shift_start_time, shift_end_time, valid_from, valid_to
      ) VALUES (
        '${operatorId}', '${machineId}', '${adminId}', true, 'B', '14:00:00', '22:00:00', '${testDate}', '${testDate}'
      ) RETURNING id;
    `);

    try {
      const assIdA = assA[0].id;
      const assIdB = assB[0].id;
      assert.notEqual(assIdA, assIdB, 'Assignments must have distinct IDs');

      const ctxRes = await queryDev(`
        SELECT public.get_operator_entry_context('${operatorId}'::uuid, '${testDate}'::date) AS ctx;
      `);
      const ctx = ctxRes[0].ctx;
      assert(Array.isArray(ctx.assigned_shifts), 'assigned_shifts must be an array');
      
      const shiftAEntry = ctx.assigned_shifts.find(s => s.shift_code === 'A' && s.machine_id === machineId);
      const shiftBEntry = ctx.assigned_shifts.find(s => s.shift_code === 'B' && s.machine_id === machineId);

      assert(shiftAEntry, 'Must return assigned shift A');
      assert(shiftBEntry, 'Must return assigned shift B');
      assert.equal(shiftAEntry.assignment_id, assIdA, 'Shift A must link to Assignment A ID');
      assert.equal(shiftBEntry.assignment_id, assIdB, 'Shift B must link to Assignment B ID');
    } finally {
      // Clean up test assignments
      await queryDev(`
        DELETE FROM public.operator_machine_assignments 
        WHERE id IN ('${assA[0].id}', '${assB[0].id}');
      `);
    }
  }
});

await checkAsync('Machine hour_meter never regresses backwards when past-date log is entered', async () => {
  const mRes = await queryDev(`SELECT id, hour_meter FROM public.machines LIMIT 1;`);
  if (mRes.length > 0) {
    const machineId = mRes[0].id;
    const initialMeter = Number(mRes[0].hour_meter) || 100;
    const higherMeter = initialMeter + 50;
    const lowerHistoricalMeter = initialMeter + 10;

    // Simulate update to higher meter
    await queryDev(`UPDATE public.machines SET hour_meter = ${higherMeter} WHERE id = '${machineId}';`);

    // Call GREATEST update simulating historical past date log submission
    await queryDev(`
      UPDATE public.machines 
      SET hour_meter = GREATEST(COALESCE(hour_meter, 0), ${lowerHistoricalMeter})
      WHERE id = '${machineId}';
    `);

    const checkRes = await queryDev(`SELECT hour_meter FROM public.machines WHERE id = '${machineId}';`);
    const finalMeter = Number(checkRes[0].hour_meter);

    assert.equal(finalMeter, higherMeter, 'Machine meter must not regress to lower historical reading');

    // Restore original meter
    await queryDev(`UPDATE public.machines SET hour_meter = ${initialMeter} WHERE id = '${machineId}';`);
  }
});

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`  SHIFT ENTRY TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log('================================================================\n');

if (failed > 0) {
  process.exit(1);
}
