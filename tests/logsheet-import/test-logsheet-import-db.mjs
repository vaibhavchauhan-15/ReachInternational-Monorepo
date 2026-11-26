#!/usr/bin/env node
/**
 * Test Suite: Admin Bulk Machine Logsheet Import — Database & Security (Live Dev DB)
 *
 * Verifies the `import_machine_hour_logs_bulk` RPC and `machine_log_imports`
 * audit table against the Development database (vlmxciuogczumumrwyot):
 *   1. Authorization: admin allowed; operator and anonymous callers rejected
 *   2. Happy path: atomic insert, correct machine/operator linkage, audit record
 *   3. Idempotency: repeated confirmations never double-insert
 *   4. Duplicate rejection: existing logs are never overwritten
 *   5. Atomicity: a failing batch inserts ZERO records (rollback)
 *   6. Hour meter non-regression and privilege/RLS hardening
 *
 * Uses the Supabase Management API (SUPABASE_ACCESS_TOKEN) with simulated JWT
 * claims, exactly like the live runtime's auth.uid() resolution.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnvFile(path.resolve(rootDir, ".env.local"));
loadEnvFile(path.resolve(rootDir, "apps/web/.env.local"));

const token = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = "vlmxciuogczumumrwyot"; // Development only

// Disposable fixture machine (users come from real accounts, read-only)
const MACHINE_ID = "11111111-2222-4333-8444-555555555003";

// Resolved at startup from real accounts (users.id references auth.users):
let ADMIN_ID = null;
let OPERATOR_ID = null;
let OPERATOR_2_ID = null;

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

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

/** Executes the import RPC as the given user (null = anonymous). */
async function callImportRpc(sub, payload) {
  const claims = sub
    ? `{"sub":"${sub}","role":"authenticated","iss":"supabase"}`
    : `{"role":"anon"}`;
  const payloadJson = JSON.stringify(payload).replace(/'/g, "''");
  const query = `
    WITH s AS (SELECT set_config('request.jwt.claims', '${claims.replace(/'/g, "''")}', false))
    SELECT import_machine_hour_logs_bulk('${payloadJson}'::jsonb) AS result FROM s;
  `;
  return sql(query);
}

function rpcRows(shiftRows) {
  return shiftRows;
}

function buildPayload(importToken, rows, extra = {}) {
  return {
    import_token: importToken,
    machine_id: MACHINE_ID,
    filename: "test-logsheet.xlsx",
    file_checksum: "test-checksum-" + importToken,
    template_version: "1.0",
    total_file_rows: rows.length,
    skipped_duplicates: 0,
    rejected_rows: 0,
    rows,
    ...extra,
  };
}

function makeRow(rowNumber, overrides = {}) {
  return {
    row_number: rowNumber,
    operator_id: OPERATOR_ID,
    log_date: "2024-03-10",
    shift_code: "S1",
    start_time: "06:00",
    end_time: "14:00",
    start_meter: 5000,
    end_meter: 5008,
    overtime_hours: 0,
    normal_working_hours: 8,
    machine_condition: "good",
    is_breakdown: false,
    breakdown_start_time: null,
    breakdown_end_time: null,
    breakdown_duration: null,
    breakdown_hours: 0,
    remarks: "Logsheet import test row",
    location: null,
    ...overrides,
  };
}

console.log("\n================================================================");
console.log("  TEST: BULK MACHINE LOGSHEET IMPORT — DATABASE & SECURITY      ");
console.log("================================================================\n");

if (!token) {
  console.error("SUPABASE_ACCESS_TOKEN not found — live DB tests cannot run.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Setup fixtures (read-only user references + one disposable test machine)
// ---------------------------------------------------------------------------
const adminRes = await sql(
  `SELECT id FROM public.users WHERE role IN ('admin', 'super_admin') AND status = 'active' ORDER BY role = 'admin' DESC LIMIT 1;`
);
const operatorRes = await sql(
  `SELECT id FROM public.users WHERE role = 'operator' AND status = 'active' ORDER BY created_at LIMIT 2;`
);
if (!adminRes.ok || !adminRes.body.length || !operatorRes.ok || operatorRes.body.length < 2) {
  console.error("Live DB fixtures unavailable (need 1 active admin + 2 active operators) — cannot run.");
  process.exit(1);
}
ADMIN_ID = adminRes.body[0].id;
OPERATOR_ID = operatorRes.body[0].id;
OPERATOR_2_ID = operatorRes.body[1].id;

await sql(`
  INSERT INTO public.machines (id, machine_id, machine_name, model, serial_number, year_of_mfg, manufacturer, hour_meter, status, health_status)
  VALUES ('${MACHINE_ID}', 'TEST-LOGSHEET-01', 'Test Excavator', 'Test Excavator', 'SN-TEST-9001', 2022, 'TestMake', 100, 'available', 'active')
  ON CONFLICT (id) DO UPDATE SET hour_meter = 100;
`);

// ---------------------------------------------------------------------------
// 1. Authorization
// ---------------------------------------------------------------------------
console.log("--- 1. Authorization (role verified from public.users, never client claims) ---");

await checkAsync("anonymous caller is rejected by the RPC", async () => {
  const res = await callImportRpc(null, buildPayload("test-token-anon", [makeRow(2)]));
  const text = JSON.stringify(res.body);
  assert.ok(
    !res.ok || /Not authorized/i.test(text),
    `expected authorization failure, got: ${text.slice(0, 200)}`
  );
  assert.ok(!/success"?\s*:\s*true/.test(text), "anonymous import must never succeed");
});

await checkAsync("operator role is rejected by the RPC (bulk import is admin-only)", async () => {
  const res = await callImportRpc(OPERATOR_ID, buildPayload("test-token-op", [makeRow(2)]));
  const text = JSON.stringify(res.body);
  assert.ok(
    /Not authorized: only administrators/i.test(text),
    `expected admin-only rejection, got: ${text.slice(0, 200)}`
  );
});

// ---------------------------------------------------------------------------
// 2. Happy path: atomic import + verification + audit
// ---------------------------------------------------------------------------
console.log("\n--- 2. Happy path: atomic import, verification and audit trail ---");

const HAPPY_TOKEN = "test-import-happy-0001";
const happyRows = [
  makeRow(2, { shift_code: "S1", start_time: "06:00", end_time: "14:00", start_meter: 5000, end_meter: 5008 }),
  makeRow(3, {
    shift_code: "S2",
    start_time: "14:00",
    end_time: "22:00",
    start_meter: 5008,
    end_meter: 5015,
    operator_id: OPERATOR_2_ID,
  }),
  makeRow(4, { shift_code: "S3", start_time: "22:00", end_time: "06:00", start_meter: 5015, end_meter: 5022 }),
];

let happyResult = null;

await checkAsync("admin imports 3 historical rows atomically", async () => {
  const res = await callImportRpc(ADMIN_ID, buildPayload(HAPPY_TOKEN, happyRows));
  assert.ok(res.ok, `RPC failed: ${JSON.stringify(res.body).slice(0, 300)}`);
  happyResult = res.body[0].result;
  assert.equal(happyResult.success, true);
  assert.equal(happyResult.already_imported, false);
  assert.equal(happyResult.imported_rows, 3);
  assert.equal(happyResult.inserted_log_ids.length, 3);
});

await checkAsync("committed records are verifiable by their IDs with correct linkage", async () => {
  const ids = happyResult.inserted_log_ids.map((id) => `'${id}'`).join(",");
  const res = await sql(`
    SELECT count(*) AS c,
           count(*) FILTER (WHERE machine_id = '${MACHINE_ID}') AS correct_machine,
           count(*) FILTER (WHERE entry_source = 'admin' AND entered_by = '${ADMIN_ID}') AS correct_attribution,
           count(*) FILTER (WHERE assignment_id IS NULL) AS unlinked_assignments,
           sum(running_hours) AS total_hours
    FROM public.machine_hour_logs WHERE id IN (${ids});
  `);
  const row = res.body[0];
  assert.equal(Number(row.c), 3, "all 3 committed rows must be findable by id");
  assert.equal(Number(row.correct_machine), 3, "every row must reference the selected machine id");
  assert.equal(Number(row.correct_attribution), 3, "rows must be attributed to the importing admin");
  assert.equal(Number(row.total_hours), 22, "running hours must equal meter deltas (8+7+7)");
});

await checkAsync("import audit record captures machine, admin, counts and ids", async () => {
  const res = await sql(`
    SELECT id, admin_user_id, machine_id, filename, template_version, total_rows, imported_rows,
           total_running_hours, status, array_length(inserted_log_ids, 1) AS id_count
    FROM public.machine_log_imports WHERE import_token = '${HAPPY_TOKEN}';
  `);
  assert.equal(res.body.length, 1, "exactly one audit record per import token");
  const row = res.body[0];
  assert.equal(row.admin_user_id, ADMIN_ID);
  assert.equal(row.machine_id, MACHINE_ID);
  assert.equal(row.filename, "test-logsheet.xlsx");
  assert.equal(row.template_version, "1.0");
  assert.equal(Number(row.imported_rows), 3);
  assert.equal(row.status, "completed");
  assert.equal(Number(row.id_count), 3);
});

await checkAsync("machine hour meter advances to the highest imported end meter", async () => {
  const res = await sql(`SELECT hour_meter FROM public.machines WHERE id = '${MACHINE_ID}';`);
  assert.equal(Number(res.body[0].hour_meter), 5022);
});

// ---------------------------------------------------------------------------
// 3. Idempotency
// ---------------------------------------------------------------------------
console.log("\n--- 3. Idempotency: repeated confirmations never double-insert ---");

await checkAsync("retrying the same import token returns the original result", async () => {
  const res = await callImportRpc(ADMIN_ID, buildPayload(HAPPY_TOKEN, happyRows));
  assert.ok(res.ok, JSON.stringify(res.body).slice(0, 200));
  const result = res.body[0].result;
  assert.equal(result.already_imported, true);
  assert.equal(result.imported_rows, 3);
  const count = await sql(`SELECT count(*) AS c FROM public.machine_hour_logs WHERE machine_id = '${MACHINE_ID}';`);
  assert.equal(Number(count.body[0].c), 3, "record count must be unchanged after a retry");
});

// ---------------------------------------------------------------------------
// 4. Duplicate rejection
// ---------------------------------------------------------------------------
console.log("\n--- 4. Duplicate rejection: existing records are never overwritten ---");

await checkAsync("re-importing the same rows under a new token is rejected atomically", async () => {
  const res = await callImportRpc(ADMIN_ID, buildPayload("test-import-dup-0001", happyRows));
  const text = JSON.stringify(res.body);
  assert.ok(/already exists|already has a log/i.test(text), `expected duplicate rejection: ${text.slice(0, 200)}`);
  const count = await sql(`SELECT count(*) AS c FROM public.machine_hour_logs WHERE machine_id = '${MACHINE_ID}';`);
  assert.equal(Number(count.body[0].c), 3, "no additional rows may be inserted");
});

// ---------------------------------------------------------------------------
// 5. Atomicity: failing batch inserts zero rows
// ---------------------------------------------------------------------------
console.log("\n--- 5. Atomicity: a failing batch inserts ZERO records ---");

const brokenBatch = [
  makeRow(2, { log_date: "2024-05-01", shift_code: "S1", start_meter: 6000, end_meter: 6006 }),
  makeRow(3, {
    log_date: "2024-05-01",
    shift_code: "S2",
    start_time: "14:00",
    end_time: "22:00",
    operator_id: "99999999-9999-4999-8999-999999999999", // non-existent operator → must abort everything
    start_meter: 6006,
    end_meter: 6010,
  }),
];

await checkAsync("one bad row aborts the entire batch (no partial import)", async () => {
  const res = await callImportRpc(ADMIN_ID, buildPayload("test-import-rollback-0001", brokenBatch));
  const text = JSON.stringify(res.body);
  assert.ok(/operator could not be resolved/i.test(text), `expected row error: ${text.slice(0, 200)}`);
  const count = await sql(
    `SELECT count(*) AS c FROM public.machine_hour_logs WHERE machine_id = '${MACHINE_ID}' AND log_date = '2024-05-01';`
  );
  assert.equal(Number(count.body[0].c), 0, "zero rows from the failing batch may survive");
});

await checkAsync("no audit record is left behind by the failed batch", async () => {
  const res = await sql(
    `SELECT count(*) AS c FROM public.machine_log_imports WHERE import_token = 'test-import-rollback-0001';`
  );
  assert.equal(Number(res.body[0].c), 0);
});

// ---------------------------------------------------------------------------
// 6. Hardening: meter rules, privileges and RLS
// ---------------------------------------------------------------------------
console.log("\n--- 6. Hardening: validation rules, privileges and RLS ---");

await checkAsync("meter regression is rejected by the RPC", async () => {
  const res = await callImportRpc(
    ADMIN_ID,
    buildPayload("test-import-meters-0001", [
      makeRow(2, { log_date: "2024-06-01", shift_code: "S1", start_meter: 100, end_meter: 50 }),
    ])
  );
  const text = JSON.stringify(res.body);
  assert.ok(/hour meter readings are invalid/i.test(text), `expected meter rejection: ${text.slice(0, 200)}`);
});

await checkAsync("future log dates are rejected by the RPC", async () => {
  const res = await callImportRpc(
    ADMIN_ID,
    buildPayload("test-import-future-0001", [
      makeRow(2, { log_date: "2999-01-01", shift_code: "S1" }),
    ])
  );
  const text = JSON.stringify(res.body);
  assert.ok(/log date is missing or in the future/i.test(text), `expected future-date rejection: ${text.slice(0, 200)}`);
});

await checkAsync("RPC is revoked from anon and machine_log_imports has admin-only read RLS", async () => {
  const res = await sql(`
    SELECT
      has_function_privilege('anon', 'public.import_machine_hour_logs_bulk(jsonb)', 'EXECUTE') AS anon_exec,
      has_function_privilege('authenticated', 'public.import_machine_hour_logs_bulk(jsonb)', 'EXECUTE') AS auth_exec,
      (SELECT bool_and(qual IS NOT NULL OR with_check IS NULL) FROM pg_policies WHERE tablename = 'machine_log_imports') AS policies_guarded,
      (SELECT count(*) FROM pg_policies WHERE tablename = 'machine_log_imports' AND cmd = 'SELECT') AS select_policies,
      (SELECT count(*) FROM pg_policies WHERE tablename = 'machine_log_imports' AND cmd <> 'SELECT') AS write_policies
    ;
  `);
  const row = res.body[0];
  assert.equal(row.anon_exec, false, "anon must not execute the import RPC");
  assert.equal(row.auth_exec, true);
  assert.equal(Number(row.select_policies), 1, "exactly one read policy");
  assert.equal(Number(row.write_policies), 0, "no client write policies — writes only via SECURITY DEFINER");
});

// ---------------------------------------------------------------------------
// Cleanup (test fixtures only)
// ---------------------------------------------------------------------------
await sql(`
  DELETE FROM public.machine_hour_logs
  WHERE machine_id = '${MACHINE_ID}'
     OR id IN (SELECT unnest(inserted_log_ids) FROM public.machine_log_imports WHERE filename = 'test-logsheet.xlsx');
`);
await sql(`DELETE FROM public.machine_log_imports WHERE filename = 'test-logsheet.xlsx';`);
await sql(`DELETE FROM public.machines WHERE id = '${MACHINE_ID}';`);

console.log("\n================================================================");
console.log(`  RESULT: ${passed} PASSED / ${failed} FAILED`);
console.log("================================================================\n");

if (failed > 0) process.exit(1);
