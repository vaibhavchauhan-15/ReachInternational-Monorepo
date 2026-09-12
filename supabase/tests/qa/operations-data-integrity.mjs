/**
 * Operations Hub QA — Automated Data-Integrity Test Suite
 * Companion to AI/TESTING/OPERATIONS-TEST-PLAN.md (2026-09-12)
 *
 * Validates the database ground truth for /operations against the
 * invariants defined in the test plan:
 *   T1  Duplicate log detection (no duplicate machine/operator/date/shift)
 *   T2  Machine status matrix coverage (seed audit)
 *   T3  Client coverage classes (1 machine / multi / multi-site / zero-log)
 *   T4  Operator coverage classes (zero-log / multi-shift / multi-machine)
 *   T5  Monthly volume (find zero-record and max-record months)
 *   T6  Referential integrity (logs must join to an existing machine)
 *   T7  Date sanity (no log_date in the far future beyond allowed grace)
 *   T8  Export count invariant baseline (server pageSize=10 must never bound exports)
 *
 * Run: node supabase/tests/qa/operations-data-integrity.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv(filePath) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

loadEnv(path.resolve(__dirname, '../../../.env'));
loadEnv(path.resolve(__dirname, '../../../apps/web/.env'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ FATAL: Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL / key).');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  ✅ PASS — ${name}`);
  } else {
    failed++;
    failures.push({ name, detail });
    console.log(`  ❌ FAIL — ${name}\n     ↳ ${detail}`);
  }
}

async function main() {
  console.log('\n════════════════════════════════════════════════');
  console.log(' Operations Hub QA — Data-Integrity Test Suite');
  console.log('════════════════════════════════════════════════\n');

  // ── T1: Duplicate log detection ─────────────────────────────
  console.log('T1 · Duplicate log detection (expect 0 duplicates)');
  {
    const { data, error } = await supabase
      .from('machine_hour_logs')
      .select('machine_id, operator_id, log_date, start_time, end_time');
    if (error) throw error;
    const seen = new Set();
    const dups = [];
    for (const r of data || []) {
      const key = [r.machine_id, r.operator_id, r.log_date, r.start_time, r.end_time].join('|');
      if (seen.has(key)) dups.push(key);
      seen.add(key);
    }
    check('No duplicate logs by (machine, operator, date, shift)', dups.length === 0,
      dups.length ? `${dups.length} duplicate groups, e.g. ${dups[0]}` : 'clean');
  }

  // ── T2: Machine status matrix ───────────────────────────────
  console.log('\nT2 · Machine status matrix coverage');
  {
    const { data, error } = await supabase.from('machines').select('id, machine_id, serial_number, status, health_status');
    if (error) throw error;
    const machines = data || [];
    check('Machines table non-empty', machines.length > 0, `${machines.length} machines found`);
    const healthStatuses = new Set(machines.map((m) => m.health_status).filter(Boolean));
    const rentStatuses = new Set(machines.map((m) => m.status).filter(Boolean));
    const expectedHealth = ['active', 'spare', 'under_maintenance', 'breakdown'];
    const expectedRent = ['available', 'rented'];
    check('All health_status values valid', machines.every((m) => !m.health_status || expectedHealth.includes(m.health_status)),
      'unexpected values: ' + JSON.stringify([...healthStatuses]));
    check('All status values valid', machines.every((m) => !m.status || expectedRent.includes(m.status)),
      'unexpected values: ' + JSON.stringify([...rentStatuses]));
    const healthCovered = expectedHealth.filter((h) => healthStatuses.has(h));
    const rentCovered = expectedRent.filter((r) => rentStatuses.has(r));
    console.log(`     ℹ Coverage: health=[${healthCovered.join(', ')}] rent=[${rentCovered.join(', ')}] — ` +
      `${healthCovered.length < expectedHealth.length ? '⚠ seed gap: some health statuses untested' : 'full coverage'}`);
  }

  // ── T3: Client coverage classes ─────────────────────────────
  console.log('\nT3 · Client coverage classes');
  {
    const { data, error } = await supabase.from('machine_hour_logs').select('client_id, machine_id, location');
    if (error) throw error;
    const byClient = new Map();
    for (const r of data || []) {
      if (!r.client_id) continue;
      if (!byClient.has(r.client_id)) byClient.set(r.client_id, { machines: new Set(), sites: new Set(), logs: 0 });
      const e = byClient.get(r.client_id);
      e.machines.add(r.machine_id);
      e.sites.add(r.location || 'unknown');
      e.logs++;
    }
    const { count: totalClients } = await supabase.from('clients').select('id', { count: 'exact', head: true });
    const classes = {
      singleMachine: [...byClient.values()].filter((c) => c.machines.size === 1).length,
      multiMachine: [...byClient.values()].filter((c) => c.machines.size > 1).length,
      multiSite: [...byClient.values()].filter((c) => c.sites.size > 1).length,
      zeroLog: (totalClients ?? 0) - byClient.size,
    };
    console.log(`     ℹ Classes: ${JSON.stringify(classes)} of ${totalClients} clients`);
    check('Client classes computable', (totalClients ?? 0) > 0 && byClient.size > 0, 'no client/log data');
  }

  // ── T4: Operator coverage classes ───────────────────────────
  console.log('\nT4 · Operator coverage classes');
  {
    const { data: operators, error: e1 } = await supabase.from('users').select('id, full_name').in('role', ['operator', 'driver', 'helper']);
    const { data: logs, error: e2 } = await supabase.from('machine_hour_logs').select('operator_id, machine_id, start_time');
    if (e1 || e2) throw e1 || e2;
    const opIds = new Set((operators || []).map((o) => o.id));
    const byOp = new Map();
    for (const r of logs || []) {
      if (!r.operator_id || !opIds.has(r.operator_id)) continue;
      if (!byOp.has(r.operator_id)) byOp.set(r.operator_id, { machines: new Set(), shifts: new Set(), logs: 0 });
      const e = byOp.get(r.operator_id);
      e.machines.add(r.machine_id);
      e.shifts.add(r.start_time);
      e.logs++;
    }
    const zeroLog = (operators || []).filter((o) => !byOp.has(o.id)).length;
    const multiMachine = [...byOp.values()].filter((o) => o.machines.size > 1).length;
    const multiShift = [...byOp.values()].filter((o) => o.shifts.size > 1).length;
    console.log(`     ℹ Operators: ${(operators || []).length} total, zeroLog=${zeroLog}, multiMachine=${multiMachine}, multiShift=${multiShift}`);
    check('Log operator_ids always reference operator/driver/helper roles', (logs || []).every((r) => !r.operator_id || opIds.has(r.operator_id)),
      'log rows with operator_id outside operator roles found');
  }

  // ── T5: Monthly volume ──────────────────────────────────────
  console.log('\nT5 · Monthly record volume (zero-record vs max-record months)');
  {
    const { data, error } = await supabase.from('machine_hour_logs').select('log_date');
    if (error) throw error;
    const byMonth = new Map();
    for (const r of data || []) {
      const ym = String(r.log_date).slice(0, 7);
      byMonth.set(ym, (byMonth.get(ym) || 0) + 1);
    }
    const sorted = [...byMonth.entries()].sort((a, b) => b[1] - a[1]);
    const max = sorted[0];
    const currentYm = new Date().toISOString().slice(0, 7);
    console.log(`     ℹ Max month: ${max ? `${max[0]} (${max[1]} logs)` : 'none'}; current month ${currentYm}: ${byMonth.get(currentYm) || 0} logs`);
    check('Dataset exists for max-record month testing', !!max && max[1] > 0, 'no logs in DB');
    check('Current month (default view) has data', (byMonth.get(currentYm) || 0) > 0,
      'current month has 0 logs — /operations default view would show empty state');
  }

  // ── T6: Referential integrity ───────────────────────────────
  console.log('\nT6 · Referential integrity');
  {
    const { data: logs, error } = await supabase.from('machine_hour_logs').select('id, machine_id');
    if (error) throw error;
    const { data: machines } = await supabase.from('machines').select('id');
    const machineIds = new Set((machines || []).map((m) => m.id));
    const orphans = (logs || []).filter((l) => !machineIds.has(l.machine_id));
    check('Every log references an existing machine', orphans.length === 0,
      orphans.length ? `${orphans.length} orphan logs, e.g. ${orphans[0]?.id}` : 'clean');
    check('Machine FK is never null on logs', (logs || []).every((l) => !!l.machine_id), 'null machine_id found');
  }

  // ── T7: Date sanity ─────────────────────────────────────────
  console.log('\nT7 · Date sanity (future-dated logs)');
  {
    const { data, error } = await supabase.from('machine_hour_logs').select('id, log_date').order('log_date', { ascending: false }).limit(1);
    if (error) throw error;
    const latest = data?.[0]?.log_date;
    const today = new Date(); today.setHours(23, 59, 59, 999);
    const graceLimit = new Date(today.getTime() + 1 * 86400000); // 1-day IST grace
    const latestDate = latest ? new Date(latest + 'T23:59:59') : null;
    check('No logs dated beyond 1-day future grace', !latestDate || latestDate <= graceLimit,
      `latest log_date ${latest} exceeds grace limit`);
    console.log(`     ℹ Latest log_date: ${latest || 'none'}`);
  }

  // ── T8: Export count invariant baseline ─────────────────────
  console.log('\nT8 · Export count baseline (server pagination must not bound exports)');
  {
    const { count, error } = await supabase.from('machine_hour_logs').select('*', { count: 'exact', head: true });
    if (error) throw error;
    console.log(`     ℹ Total machine_hour_logs: ${count}`);
    check('Log table queryable with exact count', typeof count === 'number', 'count failed');
    if (count > 10) {
      console.log('     ℹ PASS precondition for export-vs-DB comparison: dataset > pageSize(10) — Playwright export checks use this baseline.');
    }
  }

  // ── Summary ─────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════════');
  console.log(` RESULTS: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════════════');
  if (failures.length) {
    console.log('\nFailed checks:');
    for (const f of failures) console.log(`  • ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ FATAL ERROR:', err.message);
  process.exit(1);
});
