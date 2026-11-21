#!/usr/bin/env node
/**
 * Test Suite: Date-Based Operator-to-Machine Assignment (Web + Native)
 *
 * Verifies:
 *  1. Database architecture: date-aware RPCs, window enforcement, date-scoped integrity
 *     triggers, machine+shift-per-date uniqueness and legacy wrapper compatibility.
 *  2. Shared window contract (today - 7 days .. today + 1 day IST, 9 dates) used
 *     identically by Web and Native.
 *  3. Web wiring: AssignOperatorToMachineDialog date picker, date-scoped roster fetch,
 *     date persisted on save, and no optimistic mutation of today's machine mirror.
 *  4. Native wiring: MobileAssignPersonnelModal date picker, date-scoped TanStack Query,
 *     date-aware RPC + legacy fallback guard.
 *  5. Live Dev database behaviour: independence of dates, duplicate prevention,
 *     out-of-window rejection, bounded-range splitting and idempotency.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../..');

console.log('\n================================================================');
console.log('  TEST: DATE-BASED OPERATOR ASSIGNMENT (WEB + NATIVE)           ');
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

function read(relPath) {
  // Normalise CRLF so contract assertions are platform independent
  return fs
    .readFileSync(path.resolve(rootDir, relPath), "utf8")
    .split("\r\n")
    .join("\n");
}

// -----------------------------------------------------------------------------
// 1. Database migration contract
// -----------------------------------------------------------------------------
console.log('--- 1. Database: Date-Aware Assignment Architecture ---');

const migrationPath = 'supabase/migrations/228_date_based_operator_assignment.sql';
const migration = read(migrationPath);

check('migration 228 exists and defines the date-aware roster RPC', () => {
  assert.match(migration, /save_machine_roster_on_date_atomic/);
  assert.match(migration, /p_assignment_date\s+DATE\s+DEFAULT NULL/);
});

check('migration 228 defines the date-aware single-assign RPC', () => {
  assert.match(migration, /assign_operator_machine_on_date_atomic/);
});

check('migration 228 resolves the target date and rejects out-of-window dates', () => {
  assert.match(migration, /v_target_date\s*:=\s*COALESCE\(p_assignment_date,\s*v_today_ist\)/);
  assert.match(migration, /DATE_OUT_OF_WINDOW/);
});

const migration229 = read('supabase/migrations/229_assignment_window_past_and_tomorrow.sql');

check('migration 229 replaces the window with 7 past days + today + tomorrow', () => {
  assert.match(
    migration229,
    /v_target_date < \(v_today_ist - 7\) OR v_target_date > \(v_today_ist \+ 1\)/
  );
  assert.match(migration229, /must be between 7 days ago and tomorrow/);
  assert.doesNotMatch(migration229, /v_target_date > \(v_today_ist \+ 7\)/);
});

check('migration 229 keeps past-date edits from interrupting today', () => {
  // Truncated past ranges stay active and open-ended ranges are re-opened after the edit
  assert.match(migration229, /v_target_date <> v_today_ist AND v_close_date >= v_curr\.valid_from/);
  assert.match(migration229, /v_curr\.valid_to IS NULL AND v_target_date < v_today_ist/);
  // Back-dated single-day rows with no log are dropped instead of leaving empty history
  assert.match(migration229, /assignment\.backfill_removed/);
});

check('migration 229 adds a date-aware relief RPC that splits a range', () => {
  assert.match(migration229, /FUNCTION public\.end_assignment_on_date_atomic\(/);
  assert.match(migration229, /p_reopen_continuation boolean DEFAULT true/);
  assert.match(migration229, /DROP FUNCTION IF EXISTS public\.end_assignment_on_date_atomic\(uuid, date, uuid, text, text\)/);
  // Past-date reads must be range-scoped, never is_active-scoped
  assert.match(migration229, /AND \(is_active = true OR v_target_date < v_today_ist\)/);
});

check('future dates persist as single-day ranges; today keeps carry-forward', () => {
  assert.match(
    migration,
    /v_target_valid_to\s*:=\s*CASE WHEN v_target_date = v_today_ist THEN NULL ELSE v_target_date END/
  );
});

check('legacy 5-arg and 9-arg RPCs remain as delegating wrappers', () => {
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.save_machine_roster_atomic/);
  assert.match(migration, /CREATE OR REPLACE FUNCTION public\.assign_operator_machine_atomic/);
  assert.match(migration, /RETURN public\.save_machine_roster_on_date_atomic/);
  assert.match(migration, /RETURN public\.assign_operator_machine_on_date_atomic/);
});

check('machine + shift uniqueness is date-aware (GiST) instead of date-less unique', () => {
  assert.match(migration, /DROP INDEX IF EXISTS public\.idx_oma_machine_active_shift_code/);
  assert.match(migration, /oma_no_active_machine_shift_overlap/);
  assert.match(migration, /daterange\(valid_from,\s*COALESCE\(valid_to,\s*'9999-12-31'::date\),\s*'\[\]'\)/);
});

check('integrity triggers are date-scoped (capacity, mirror, legacy time slots)', () => {
  assert.match(migration, /enforce_max_operators_per_machine/);
  assert.match(migration, /AND valid_from <= NEW\.valid_from/);
  assert.match(migration, /enforce_max_shifts_per_operator/);
  assert.match(migration, /sync_machine_assigned_operators/);
  assert.match(migration, /valid_from <= v_today_ist/);
  assert.match(migration, /sync_operator_shift_ranges/);
});

check('open-ended ranges are capped at the next planned date (no 23P01 on planning)', () => {
  assert.match(migration, /trg_fn_cap_open_assignment_range/);
  assert.match(migration, /NEW\.valid_to := v_next_start - 1/);
  assert.match(migration, /trg_cap_open_assignment_range/);
});

check('reconciliation preserves later planned (bounded) dates when relieving', () => {
  assert.match(migration, /v_curr\.valid_to IS NOT NULL AND v_curr\.valid_to > v_target_date/);
  assert.match(migration, /assignment\.planned_removed/);
});

check('future planning never mutates today\'s machine operator mirror', () => {
  assert.match(migration, /IF v_target_date = v_today_ist THEN\s*UPDATE public\.machines/);
});

check('migration reloads the PostgREST schema cache', () => {
  assert.match(migration, /NOTIFY pgrst, 'reload schema'/);
});

// -----------------------------------------------------------------------------
// 2. Shared window contract
// -----------------------------------------------------------------------------
console.log('\n--- 2. Shared Window Contract (IST, 9 dates: 7 past + today + tomorrow) ---');

const utilsDate = read('packages/utils/src/date.ts');

check('utils exports the canonical assignment date window helpers', () => {
  assert.match(utilsDate, /export const ASSIGNMENT_DATE_WINDOW_PAST_DAYS = 7/);
  assert.match(utilsDate, /export const ASSIGNMENT_DATE_WINDOW_FUTURE_DAYS = 1/);
  assert.match(utilsDate, /export function getAssignmentDateWindow/);
  assert.match(utilsDate, /export function isValidAssignmentDate/);
  assert.match(utilsDate, /export function resolveAssignmentDate/);
});

check('utils window uses IST-safe date math (no local device time)', () => {
  assert.match(utilsDate, /getISTDateString\(referenceDate \?\? null\)/);
  assert.match(utilsDate, /addDaysToDateStr\(today, -ASSIGNMENT_DATE_WINDOW_PAST_DAYS\)/);
  assert.match(utilsDate, /addDaysToDateStr\(today, ASSIGNMENT_DATE_WINDOW_FUTURE_DAYS\)/);
  assert.match(utilsDate, /export function getAssignmentDateKind/);
});

// -----------------------------------------------------------------------------
// 3. Web wiring
// -----------------------------------------------------------------------------
console.log('\n--- 3. Web (Next.js) Wiring ---');

const webDialog = read('apps/web/components/assignments/AssignOperatorToMachineDialog.tsx');

check('web dialog renders the reusable CustomDatePicker with the 9-date window', () => {
  assert.match(webDialog, /<CustomDatePicker/);
  assert.match(webDialog, /maxDaysOld=\{ASSIGNMENT_DATE_WINDOW_PAST_DAYS\}/);
  assert.match(webDialog, /allowFutureDays=\{ASSIGNMENT_DATE_WINDOW_FUTURE_DAYS\}/);
  assert.match(webDialog, /assignment date/i);
});

check('web dialog can lock itself to today and hide the date control entirely', () => {
  assert.match(webDialog, /allowDateSelection = true/);
  assert.match(webDialog, /allowDateSelection \? \(/);
  assert.match(webDialog, /Editing <span[^>]*>today/);
  const shell = read('apps/web/components/machines/AssignPersonnelModal.tsx');
  assert.match(shell, /allowDateSelection/);
});

check('web dialog seeds the assignment date from the caller (clamped into the window)', () => {
  assert.match(webDialog, /const \[assignmentDate, setAssignmentDate\] = useState<string>/);
  assert.match(webDialog, /resolveAssignmentDate\(initialAssignmentDate\)/);
  assert.match(webDialog, /resolveAssignmentDate\(nextDate\)/);
});

check('/operations keeps the full 7-past + today + tomorrow date picker available', () => {
  const monitor = read('apps/web/components/operations/TodayShiftMonitorTab.tsx');
  // The dialog must not be locked to today anymore: a supervisor correcting a historical
  // roster or planning tomorrow picks the date right inside the dialog.
  assert.doesNotMatch(monitor, /allowDateSelection=\{false\}/);
  assert.match(monitor, /initialAssignmentDate=\{selectedDate\}/);
  // Optimistic patching may only touch the day that is actually on screen.
  assert.match(monitor, /const savedDate = result\.assignmentDate \|\| getISTDateString\(\);/);
  assert.match(monitor, /if \(savedDate !== selectedDateRef\.current\) return;/);
});

check('web dialog fetches the roster scoped to the selected date', () => {
  assert.match(webDialog, /params\.set\("date", assignmentDate\)/);
  assert.match(webDialog, /\[isOpen, selectedMachineId, assignmentDate\]/);
});

check('web dialog persists the selected date on save', () => {
  assert.match(webDialog, /body: JSON\.stringify\(payload\)/);
  assert.match(webDialog, /assignmentDate,\s*\n\s*operators: roster\.map/);
  assert.match(webDialog, /updateMachinePersonnelAction\(selectedMachineId, \{[\s\S]*?assignmentDate,/);
});

check('web dialog only mirrors TODAY edits into the live machine state', () => {
  assert.match(webDialog, /if \(isTodayAssignment\) \{\s*\n\s*onMachineUpdated\?\.\(\{/);
  assert.match(webDialog, /if \(isTodayAssignment\) onMachineUpdated\?\.\(rollbackSnapshot\)/);
  assert.doesNotMatch(webDialog, /if \(!isFuturePlan\)/);
});

const webRoute = read('apps/web/app/api/machines/[id]/operators/route.ts');

check('operators API validates and echoes the assignment date (GET + POST)', () => {
  assert.match(webRoute, /req\.nextUrl\.searchParams\.get\("date"\)/);
  assert.match(webRoute, /isValidAssignmentDate\(dateParam\)/);
  assert.match(webRoute, /\.lte\("valid_from", assignmentDate\)/);
  assert.match(webRoute, /assignment_date: assignmentDate/);
  assert.match(webRoute, /assignmentDate,/);
});

const machinesAction = read('apps/web/app/actions/machines.ts');

check('server action validates the window before touching the database', () => {
  assert.match(machinesAction, /isValidAssignmentDate\(requestedDate\)/);
  assert.match(machinesAction, /DATE_OUT_OF_WINDOW/);
});

check('server action calls the date-aware RPC with the legacy fallback guard', () => {
  assert.match(machinesAction, /save_machine_roster_on_date_atomic/);
  assert.match(machinesAction, /p_assignment_date: assignmentDate/);
  assert.match(machinesAction, /DATE_ASSIGNMENT_UNAVAILABLE/);
});

const machineFilters = read('apps/web/lib/data/machines/machine-filters.ts');

check('fleet assignment lookups are date-scoped (no stale/future bleed)', () => {
  assert.match(machineFilters, /async \(targetDate\?: string \| null\)/);
  assert.match(machineFilters, /\.lte\("valid_from", dateFilter\)/);
  assert.match(machineFilters, /valid_to\.is\.null,valid_to\.gte\.\$\{dateFilter\}/);
});

// -----------------------------------------------------------------------------
// 4. Native wiring
// -----------------------------------------------------------------------------
console.log('\n--- 4. Native (Expo) Wiring ---');

const mobileModal = read('apps/mobile/components/operations/MobileAssignPersonnelModal.tsx');

check('native modal renders the reusable CustomDatePicker with the same window', () => {
  assert.match(mobileModal, /<CustomDatePicker/);
  assert.match(mobileModal, /maxDaysOld=\{ASSIGNMENT_DATE_WINDOW_PAST_DAYS\}/);
  assert.match(mobileModal, /allowFutureDays=\{ASSIGNMENT_DATE_WINDOW_FUTURE_DAYS\}/);
  assert.match(mobileModal, /ASSIGNMENT DATE/);
});

check('native modal keeps the assignment date in state and resets on open', () => {
  assert.match(mobileModal, /const \[assignmentDate, setAssignmentDate\] = useState<string>/);
  assert.match(mobileModal, /setAssignmentDate\(resolveAssignmentDate\(initialAssignmentDate\)\)/);
  assert.match(mobileModal, /resolveAssignmentDate\(nextDate\)/);
});

check('native shift monitor seeds the assignment date from the displayed day', () => {
  const nativeMonitor = read('apps/mobile/components/operations/MobileTodayShiftMonitorTab.tsx');
  assert.match(nativeMonitor, /initialAssignmentDate=\{selectedDate\}/);
});

check('native modal seeds the roster per machine + date and waits for scoped data', () => {
  assert.match(mobileModal, /`\$\{activeMachine\.id\}:\$\{assignmentDate\}`/);
  assert.match(mobileModal, /if \(isFetchingModalData\) return;/);
});

check('native modal saves exclusively through the date-aware roster RPC', () => {
  assert.match(mobileModal, /save_machine_roster_on_date_atomic/);
  assert.match(mobileModal, /p_assignment_date: assignmentDate/);
  assert.match(mobileModal, /Date-based assignment is not available on this deployment yet/);
});

check('native modal keeps no date-less fallback write path', () => {
  assert.doesNotMatch(mobileModal, /save_machine_roster_atomic/);
  assert.doesNotMatch(mobileModal, /assign_operator_machine_atomic/);
  assert.ok(
    !mobileModal.includes("from('operator_machine_assignments')"),
    'no raw operator_machine_assignments insert fallback may remain'
  );
});

const mobileHook = read('apps/mobile/lib/hooks/useAssignPersonnelModalData.ts');

check('native fleet assignments query is date-scoped and cache-keyed by date', () => {
  assert.match(mobileHook, /export function useFleetAssignments\(visible: boolean, assignmentDate\?: string \| null\)/);
  assert.match(mobileHook, /\['assign-personnel-modal-data', 'fleet-assignments', targetDate\]/);
  assert.match(mobileHook, /\.lte\('valid_from', targetDate\)/);
  assert.match(mobileHook, /\n\s*assignmentDate,\n\s*\}: UseAssignPersonnelModalDataOptions/);
});

// -----------------------------------------------------------------------------
// 5. Web / Native parity
// -----------------------------------------------------------------------------
console.log('\n--- 5. Web ↔ Native Parity ---');

check('both platforms consume the identical shared window contract', () => {
  for (const file of [webDialog, mobileModal, webRoute, machinesAction]) {
    assert.match(file, /getAssignmentDateWindow|isValidAssignmentDate|resolveAssignmentDate/);
  }
  for (const src of [webDialog, mobileModal]) {
    assert.match(src, /ASSIGNMENT_DATE_WINDOW_FUTURE_DAYS/);
    assert.match(src, /ASSIGNMENT_DATE_WINDOW_PAST_DAYS/);
  }
});

check('date-based copy is identical in intent on both platforms', () => {
  for (const src of [webDialog, mobileModal]) {
    assert.match(src, /Carries forward until changed|carries forward until changed/);
    assert.match(src, /Past correction|Correcting the roster/);
  }
});

check('both platforms keep duplicate-shift prevention in the assignment flow', () => {
  for (const file of [webDialog, mobileModal]) {
    assert.match(file, /takenShiftCodes|assignedCodes|shiftCodes/);
  }
});

// -----------------------------------------------------------------------------
// 7. Dated assignment everywhere (no date-less write paths remain)
// -----------------------------------------------------------------------------
console.log('\n--- 7. Dated Assignment Everywhere (No Date-Less Writes) ---');

function listSourceFiles(relDir) {
  const out = [];
  const walk = (dir) => {
    let entries = [];
    try {
      entries = fs.readdirSync(path.resolve(rootDir, dir), { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (['node_modules', '.next', '.open-next', 'dist', 'build'].includes(entry.name)) continue;
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else if (/\.(ts|tsx)$/.test(entry.name)) out.push(rel);
    }
  };
  walk(relDir);
  return out;
}

const appSourceFiles = [...listSourceFiles('apps/web'), ...listSourceFiles('apps/mobile')];

check('no application code calls a date-less assignment RPC', () => {
  const dateLess = /save_machine_roster_atomic|assign_operator_machine_atomic|end_operator_machine_assignment_atomic/;
  const offenders = appSourceFiles.filter((f) => dateLess.test(read(f)));
  assert.deepEqual(offenders, [], `date-less RPC calls found in: ${offenders.join(', ')}`);
});

check('every date-aware RPC call site also sends p_assignment_date', () => {
  const datedCallFiles = appSourceFiles.filter((f) =>
    /save_machine_roster_on_date_atomic|assign_operator_machine_on_date_atomic/.test(read(f))
  );
  assert.ok(datedCallFiles.length >= 5, `expected several dated call sites, found ${datedCallFiles.length}`);
  const missing = datedCallFiles.filter((f) => !/p_assignment_date/.test(read(f)));
  assert.deepEqual(missing, [], `p_assignment_date missing in: ${missing.join(', ')}`);
});

check('web server actions resolve the assignment date (today by default)', () => {
  const machinesAction = read('apps/web/app/actions/machines.ts');
  const assignmentsAction = read('apps/web/app/actions/assignments.ts');
  assert.match(machinesAction, /resolveAssignmentDate\(requestedDate\)/);
  assert.match(assignmentsAction, /resolveAssignmentDate\(requested\)/);
  assert.match(machinesAction, /resolveAssignmentDate\(targetDateRaw\)/);
  assert.match(assignmentsAction, /resolveAssignmentTarget\(/);
  // No date-less fallback execution remains
  assert.doesNotMatch(machinesAction, /executeResilientPersonnelUpdateFallback/);
  assert.doesNotMatch(machinesAction, /DATE_ASSIGNMENT_UNAVAILABLE[\s\S]{0,400}save_machine_roster_atomic/);
});

check('web dialogs seed the assignment date from the caller and pass it on save', () => {
  const machineDialog = read('apps/web/components/assignments/AssignOperatorToMachineDialog.tsx');
  const operatorDialog = read('apps/web/components/assignments/AssignMachineToOperatorDialog.tsx');
  for (const src of [machineDialog, operatorDialog]) {
    assert.match(src, /initialAssignmentDate\?: string \| null/);
    assert.match(src, /resolveAssignmentDate\(initialAssignmentDate\)/);
    assert.match(src, /maxDaysOld=\{ASSIGNMENT_DATE_WINDOW_PAST_DAYS\}/);
    assert.match(src, /allowFutureDays=\{ASSIGNMENT_DATE_WINDOW_FUTURE_DAYS\}/);
  }
  assert.match(machineDialog, /assignmentDate,/);
  assert.match(operatorDialog, /assignmentDate,/);
  assert.match(operatorDialog, /getOperatorActiveAssignmentsAction\(operator\.id, assignmentDate\)/);
  // The composed shell forwards the preferred date to whichever dialog it renders.
  const shell = read('apps/web/components/machines/AssignPersonnelModal.tsx');
  assert.equal(shell.match(/initialAssignmentDate=\{initialAssignmentDate\}/g)?.length, 2);
});

check('native dialogs default the assignment date to today and pass it on save', () => {
  const personnel = read('apps/mobile/components/operations/MobileAssignPersonnelModal.tsx');
  const operatorModal = read('apps/mobile/components/assignments/AssignMachineToOperatorModal.tsx');
  for (const src of [personnel, operatorModal]) {
    assert.match(src, /maxDaysOld=\{ASSIGNMENT_DATE_WINDOW_PAST_DAYS\}/);
    assert.match(src, /allowFutureDays=\{ASSIGNMENT_DATE_WINDOW_FUTURE_DAYS\}/);
  }
  assert.match(personnel, /initialAssignmentDate\?: string \| null/);
  assert.match(operatorModal, /getAssignmentDateWindow\(\)\.today/);
  assert.match(personnel, /p_assignment_date: assignmentDate/);
  assert.match(operatorModal, /p_assignment_date: assignmentDate/);
});

check('native machine create/edit syncs personnel through the dated roster RPC for today', () => {
  const machineModal = read('apps/mobile/components/machines/MachineModal.tsx');
  assert.match(machineModal, /save_machine_roster_on_date_atomic/);
  assert.match(machineModal, /p_assignment_date: todayIst/);
  // The old destructive "deactivate every row for this machine" write must be gone
  assert.doesNotMatch(machineModal, /end_reason: 'removed' \}\)\s*\r?\n\s*\.eq\('machine_id', machineToEdit\.id\)/);
});

check('deprecated date-less native assignment modal is removed', () => {
  assert.ok(!fs.existsSync(path.resolve(rootDir, 'apps/mobile/components/assignments/AssignOperatorToMachineModal.tsx')));
  const barrel = read('apps/mobile/components/assignments/index.ts');
  assert.doesNotMatch(barrel, /AssignOperatorToMachineModal/);
});

// -----------------------------------------------------------------------------
// 6. Live database verification (Development project only)
// -----------------------------------------------------------------------------
console.log('\n--- 6. Live Dev Database Behaviour ---');

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
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY || env.SUPABASE_SECRET_KEY;
const isDevProject = Boolean(supabaseUrl && supabaseUrl.includes('vlmxciuogczumumrwyot'));

let supabase = null;
if (supabaseUrl && serviceKey && isDevProject) {
  supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function istOffset(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

if (!supabase) {
  console.log('  ℹ SKIPPED (live DB) — Development project credentials not available.');
  console.log('    Static, schema and UI wiring contracts above still fully verified.');
} else {
  const TODAY = istOffset(0);
  const TMR = istOffset(1);
  const F2 = istOffset(2);
  const M2 = istOffset(-2);
  const M3 = istOffset(-3);
  const M4 = istOffset(-4);
  const M5 = istOffset(-5);
  const M6 = istOffset(-6);
  const P7 = istOffset(-7);
  const P8 = istOffset(-8);

  const restorePlan = [];
  let testMachine = null;
  let callerId = null;
  let spareOperatorId = null;
  let spareShiftCode = 'S3';
  let baselineShiftCodes = [];
  const testStartedAt = new Date().toISOString();
  let syntheticAssignmentId = null;

  const readRoster = async (machineId, date) => {
    const { data, error } = await supabase.rpc('save_machine_roster_on_date_atomic', {
      p_machine_id: machineId,
      p_operators: null,
      p_supervisor_ids: null,
      p_activate_machine: false,
      p_caller_id: callerId,
      p_assignment_date: date,
    });
    if (error) throw new Error(`roster read failed: ${error.message}`);
    return data;
  };

  const saveRoster = async (machineId, operators, date) => {
    const { data, error } = await supabase.rpc('save_machine_roster_on_date_atomic', {
      p_machine_id: machineId,
      p_operators: operators,
      p_supervisor_ids: null,
      p_activate_machine: false,
      p_caller_id: callerId,
      p_assignment_date: date,
    });
    if (error) throw new Error(`roster save failed: ${error.message}`);
    return data;
  };

  const rosterKeys = async (machineId, date) =>
    ((await readRoster(machineId, date))?.operators || [])
      .map((o) => `${o.id}:${o.shift_code}`)
      .sort()
      .join(',');

  // --- Discover a machine with spare shift capacity + a fully free operator ------
  await checkAsync('discovers an assignable machine and a spare operator', async () => {
    const { data: adminUser } = await supabase
      .from('users')
      .select('id')
      .in('role', ['admin', 'super_admin'])
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    callerId = adminUser?.id || null;
    assert.ok(callerId, 'an active admin/super_admin is required to invoke the RPCs');

    const { data: fleetBusy } = await supabase
      .from('operator_machine_assignments')
      .select('operator_id')
      .eq('is_active', true)
      .lte('valid_from', TMR)
      .or(`valid_to.is.null,valid_to.gte.${TMR}`);
    const busyOperatorIds = new Set((fleetBusy || []).map((r) => r.operator_id));

    const { data: operators } = await supabase
      .from('users')
      .select('id')
      .eq('role', 'operator')
      .eq('status', 'active')
      .limit(80);
    const freeOperator = (operators || []).find((o) => !busyOperatorIds.has(o.id));
    assert.ok(freeOperator, 'a fully free operator is required for the live checks');
    spareOperatorId = freeOperator.id;

    const { data: machines } = await supabase
      .from('machines')
      .select('id, machine_id, status')
      .not('status', 'in', '("decommissioned","scrapped")')
      .order('machine_id')
      .limit(40);

    for (const machine of machines || []) {
      const { data: rows } = await supabase
        .from('operator_machine_assignments')
        .select('id, operator_id, shift_code, valid_from, valid_to, is_active')
        .eq('machine_id', machine.id)
        .eq('is_active', true)
        .lte('valid_from', TMR)
        .or(`valid_to.is.null,valid_to.gte.${TMR}`);
      if (!rows || rows.length === 0 || rows.length >= 3) continue;

      const codes = rows.map((r) => (r.shift_code || '').toUpperCase());
      const freeShift = ['A', 'B', 'C', 'S1', 'S2', 'S3'].find((c) => !codes.includes(c));
      if (!freeShift) continue;

      testMachine = machine;
      baselineShiftCodes = codes;
      spareShiftCode = freeShift;
      restorePlan.push(...rows);
      break;
    }

    assert.ok(
      testMachine,
      'a machine with 1-2 active shifts and a free shift code is required'
    );
  });

  if (testMachine) {
    // Authoritative timing for the spare shift (client shift codes, else the machine's rows)
    const { data: machineClient } = await supabase
      .from('machines')
      .select('client_id')
      .eq('id', testMachine.id)
      .maybeSingle();
    let spareShiftTiming = null;
    if (machineClient?.client_id) {
      const { data: codes } = await supabase
        .from('client_shift_codes')
        .select('code, start_time, end_time')
        .eq('client_id', machineClient.client_id)
        .eq('is_active', true);
      const match = (codes || []).find(
        (c) => (c.code || '').trim().toUpperCase() === spareShiftCode
      );
      if (match) spareShiftTiming = { start_time: match.start_time, end_time: match.end_time };
    }
    assert.ok(spareShiftTiming, 'the spare shift must have authoritative client timings');

    const baselineActions = () =>
      restorePlan.map((r) => ({ operatorId: r.operator_id, shiftCode: r.shift_code }));

    // --- Window -----------------------------------------------------------------
    await checkAsync('only today-7 .. tomorrow is writable (9 dates)', async () => {
      for (const [label, date, expectOk] of [
        ['today-8', P8, false],
        ['today+2', F2, false],
        ['today-7', P7, true],
        ['tomorrow', TMR, true],
        ['today', TODAY, true],
      ]) {
        const res = await saveRoster(testMachine.id, null, date);
        if (expectOk) {
          assert.equal(res?.success, true, `${label} must be accepted: ${JSON.stringify(res)}`);
        } else {
          assert.equal(res?.success, false, `${label} must be rejected`);
          assert.equal(res?.code, 'DATE_OUT_OF_WINDOW', `${label} rejection code`);
        }
      }
    });

    await checkAsync('tomorrow is persisted as a single-day range', async () => {
      const res = await supabase.rpc('assign_operator_machine_on_date_atomic', {
        p_machine_id: testMachine.id,
        p_operator_id: spareOperatorId,
        p_shift_code: spareShiftCode,
        p_assigned_by: callerId,
        p_assignment_date: TMR,
      });
      assert.equal(res.error, null);
      assert.equal(res.data?.success, true, JSON.stringify(res.data));
      assert.equal(res.data?.valid_from, TMR);
      assert.equal(res.data?.valid_to, TMR, 'tomorrow must be scoped to that single date');

      const todayKeys = await rosterKeys(testMachine.id, TODAY);
      for (const r of restorePlan) {
        assert.ok(
          todayKeys.includes(`${r.operator_id}:${r.shift_code}`),
          "tomorrow planning must never touch today's roster"
        );
      }

      const tomorrow = await readRoster(testMachine.id, TMR);
      assert.ok(tomorrow.operators.some((o) => o.id === spareOperatorId));
    });

    await checkAsync('re-saving the same date is idempotent (no duplicate rows)', async () => {
      const before = await readRoster(testMachine.id, TMR);
      const res = await saveRoster(
        testMachine.id,
        [...baselineActions(), { operatorId: spareOperatorId, shiftCode: spareShiftCode }],
        TMR
      );
      assert.equal(res?.success, true);
      const after = await readRoster(testMachine.id, TMR);
      assert.equal(after.operators.length, before.operators.length);
    });

    await checkAsync('duplicate/conflicting assignment for the same machine+shift+date is blocked', async () => {
      const res = await supabase.rpc('assign_operator_machine_on_date_atomic', {
        p_machine_id: testMachine.id,
        p_operator_id: spareOperatorId,
        p_shift_code: baselineShiftCodes[0],
        p_assigned_by: callerId,
        p_assignment_date: TODAY,
      });
      assert.equal(res.error, null);
      assert.equal(res.data?.success, false);
      assert.ok(
        ['MACHINE_SHIFT_OCCUPIED', 'SHIFT_OVERLAP_CONFLICT'].includes(res.data?.code),
        `unexpected code: ${res.data?.code}`
      );
    });

    await checkAsync("today's assignment stays open-ended (carry-forward contract)", async () => {
      const res = await supabase.rpc('assign_operator_machine_on_date_atomic', {
        p_machine_id: testMachine.id,
        p_operator_id: spareOperatorId,
        p_shift_code: spareShiftCode,
        p_assigned_by: callerId,
        p_assignment_date: TODAY,
      });
      assert.equal(res.error, null);
      assert.equal(res.data?.success, true, JSON.stringify(res.data));
      assert.equal(res.data?.valid_from, TODAY);
      assert.equal(res.data?.valid_to, null, "today's assignment must carry forward");

      // Release the shift again so the back-dating check owns it exclusively
      await supabase
        .from('operator_machine_assignments')
        .delete()
        .eq('machine_id', testMachine.id)
        .eq('operator_id', spareOperatorId)
        .eq('valid_from', TODAY);
    });

    // --- Back-dating ------------------------------------------------------------
    await checkAsync('back-dating a roster save splits the range without touching today', async () => {
      // A six-day-old carry-forward range for the spare operator, then relieve it on today-3.
      const { data: synthetic, error: synthErr } = await supabase
        .from('operator_machine_assignments')
        .insert({
          machine_id: testMachine.id,
          operator_id: spareOperatorId,
          shift_code: spareShiftCode,
          shift_start_time: spareShiftTiming.start_time,
          shift_end_time: spareShiftTiming.end_time,
          is_active: true,
          assigned_by: callerId,
          assigned_at: new Date().toISOString(),
          valid_from: M6,
          valid_to: null,
          notes: 'date-based-assignment test',
        })
        .select('id')
        .single();
      assert.equal(synthErr, null, synthErr?.message);
      syntheticAssignmentId = synthetic.id;

      const todayKeysBefore = await rosterKeys(testMachine.id, TODAY);
      assert.ok(todayKeysBefore.includes(spareOperatorId), 'spare operator must be effective today first');

      const res = await saveRoster(testMachine.id, [], M3);
      assert.equal(res?.success, true, JSON.stringify(res));

      const { data: slices } = await supabase
        .from('operator_machine_assignments')
        .select('id, valid_from, valid_to')
        .eq('machine_id', testMachine.id)
        .eq('operator_id', spareOperatorId)
        .order('valid_from');

      assert.ok(
        (slices || []).some((r) => r.valid_from === M6 && r.valid_to === M4),
        'the covered range must be truncated to the day before the edit'
      );
      // The continuation re-opens the day after the edit and is capped the day before the
      // already-planned tomorrow row, so today's coverage is always preserved.
      assert.ok(
        (slices || []).some((r) => r.valid_from === M2 && r.valid_to === TODAY),
        'the carry-forward must re-open the day after the edit (capped before the planned tomorrow)'
      );

      const todayKeysAfter = await rosterKeys(testMachine.id, TODAY);
      assert.ok(
        todayKeysAfter.includes(spareOperatorId),
        'back-dating must never remove the operator from today'
      );

      const pastIso = await readRoster(testMachine.id, M3);
      assert.ok(
        !(pastIso.operators || []).some((o) => o.id === spareOperatorId),
        'the edited past date must no longer include the operator'
      );
    });

    await checkAsync('historical (auto-deactivated) ranges are still readable on their dates', async () => {
      // trg_fn_sync_oma_valid_range force-deactivates rows whose valid_to < today,
      // so DATE-scoped reads must resolve by range, not by is_active.
      const past = await readRoster(testMachine.id, M5);
      assert.equal(past?.success, true);
      assert.ok(
        (past.operators || []).some((o) => o.id === spareOperatorId),
        'the untouched part of the back-dated range must still be readable'
      );
    });

    await checkAsync('date-aware relief splits a range and preserves today', async () => {
      const { data: target } = await supabase
        .from('operator_machine_assignments')
        .select('id, valid_from, valid_to')
        .eq('machine_id', testMachine.id)
        .eq('operator_id', spareOperatorId)
        .eq('valid_from', M6)
        .maybeSingle();
      assert.ok(target?.id, 'truncated range must exist');

      const relief = await supabase.rpc('end_assignment_on_date_atomic', {
        p_assignment_id: target.id,
        p_effective_date: M5,
        p_caller_id: callerId,
        p_end_reason: 'removed',
      });
      assert.equal(relief.error, null, relief.error?.message);
      assert.equal(relief.data?.success, true, JSON.stringify(relief.data));

      const { data: afterRelief } = await supabase
        .from('operator_machine_assignments')
        .select('id, valid_from, valid_to')
        .eq('machine_id', testMachine.id)
        .eq('operator_id', spareOperatorId);
      assert.ok(
        (afterRelief || []).some((r) => r.id === target.id && r.valid_to === M6),
        'relief must truncate the range to (date - 1)'
      );
      assert.ok(
        (afterRelief || []).some((r) => r.valid_from === M4 && r.valid_to === M4),
        'relief must re-open the continuation from (date + 1)'
      );
      assert.ok(
        (await rosterKeys(testMachine.id, TODAY)).includes(spareOperatorId),
        "relief on a past date must not remove the operator from today"
      );
    });

    await checkAsync('relief rejects out-of-window dates without mutating anything', async () => {
      const { data: target } = await supabase
        .from('operator_machine_assignments')
        .select('id')
        .eq('machine_id', testMachine.id)
        .eq('operator_id', spareOperatorId)
        .eq('valid_from', M2)
        .maybeSingle();

      const before = await rosterKeys(testMachine.id, TODAY);
      const res = await supabase.rpc('end_assignment_on_date_atomic', {
        p_assignment_id: target.id,
        p_effective_date: P8,
        p_caller_id: callerId,
        p_end_reason: 'removed',
      });
      assert.equal(res.data?.success, false);
      assert.equal(res.data?.code, 'DATE_OUT_OF_WINDOW');
      assert.equal(await rosterKeys(testMachine.id, TODAY), before);
    });

    await checkAsync('out-of-window and malformed dates are rejected by both write RPCs', async () => {
      // Real calendar dates outside the window are rejected with a structured code
      for (const badDate of [P8, F2]) {
        const rosterRes = await saveRoster(testMachine.id, [], badDate);
        assert.equal(rosterRes?.success, false, `roster must reject ${badDate}`);
        assert.equal(rosterRes?.code, 'DATE_OUT_OF_WINDOW', `roster code for ${badDate}`);

        const singleRes = await supabase.rpc('assign_operator_machine_on_date_atomic', {
          p_machine_id: testMachine.id,
          p_operator_id: spareOperatorId,
          p_shift_code: spareShiftCode,
          p_assigned_by: callerId,
          p_assignment_date: badDate,
        });
        assert.equal(singleRes.data?.success, false);
        assert.equal(singleRes.data?.code, 'DATE_OUT_OF_WINDOW');
      }

      // Malformed / impossible calendar dates are rejected by the cast or the guard
      for (const badDate of ['2026-02-31', 'not-a-date']) {
        const rosterRes = await saveRoster(testMachine.id, [], badDate).catch(() => ({ success: false }));
        assert.notEqual(rosterRes?.success, true, `roster must reject ${badDate}`);

        const singleRes = await supabase.rpc('assign_operator_machine_on_date_atomic', {
          p_machine_id: testMachine.id,
          p_operator_id: spareOperatorId,
          p_shift_code: spareShiftCode,
          p_assigned_by: callerId,
          p_assignment_date: badDate,
        });
        const rejected = Boolean(singleRes.error) || singleRes.data?.success === false;
        assert.ok(rejected, `single-assign must reject ${badDate}`);
      }
    });

    await checkAsync('legacy wrapper still serves today + carry-forward', async () => {
      const res = await supabase.rpc('save_machine_roster_atomic', {
        p_machine_id: testMachine.id,
        p_operators: baselineActions(),
        p_supervisor_ids: null,
        p_activate_machine: false,
        p_caller_id: callerId,
      });
      assert.equal(res.error, null);
      assert.equal(res.data?.success, true);
      const today = await readRoster(testMachine.id, TODAY);
      assert.equal(today.operators.length, restorePlan.length);
    });

    // --- Cleanup ---------------------------------------------------------------
    await checkAsync('cleans up test data and restores the original assignment ranges', async () => {
      const { data: createdRows } = await supabase
        .from('operator_machine_assignments')
        .select('id')
        .eq('machine_id', testMachine.id)
        .gte('created_at', testStartedAt);
      for (const row of createdRows || []) {
        await supabase.from('operator_machine_assignments').delete().eq('id', row.id);
      }
      for (const original of restorePlan) {
        await supabase
          .from('operator_machine_assignments')
          .update({
            valid_to: original.valid_to,
            is_active: original.is_active,
            ended_at: original.is_active ? null : new Date().toISOString(),
          })
          .eq('id', original.id);
      }
      const today = await readRoster(testMachine.id, TODAY);
      assert.equal(today.operators.length, restorePlan.length);
    });
  }
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`  RESULT: ${passed} passed, ${failed} failed`);
console.log('================================================================\n');

if (failed > 0) process.exit(1);
