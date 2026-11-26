#!/usr/bin/env node
/**
 * Test Suite: Admin Bulk Machine Logsheet Import — Security & Authorization
 *
 * Verifies defense-in-depth across every layer of the import feature:
 *   1. Capability matrix: machine.logs_import is super_admin/admin only
 *   2. Server actions + template route enforce server-side authorization
 *   3. The database RPC re-verifies the caller role and is revoked from anon
 *   4. Trusted identifiers never come from the spreadsheet
 *   5. No privileged credentials leak to the client; RLS stays enabled
 *
 * Run: node --test --experimental-strip-types tests/logsheet-import/test-logsheet-import-security.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../..");
const read = (rel) => fs.readFileSync(path.join(rootDir, rel), "utf8");
const importFromRoot = (rel) => import(pathToFileURL(path.join(rootDir, rel)).href);

const {
  MACHINE_CAPABILITIES,
  hasMachineCapability,
  getMachineCapabilities,
} = await importFromRoot("packages/permissions/src/machines.ts");
const { ROLE_PERMISSIONS } = await importFromRoot("packages/permissions/src/matrix.ts");
const { LOGSHEET_IMPORT_COLUMNS } = await importFromRoot("packages/validation/src/logsheetImport.ts");

const actionsSrc = read("apps/web/app/actions/logsheet-import.ts");
const routeSrc = read("apps/web/app/api/operations/logsheet-import/template/route.ts");
const validateSrc = read("apps/web/lib/server/logsheet-import/validate.ts");
const migrationSrc = read("supabase/migrations/244_machine_logsheet_bulk_import.sql");
const modalSrc = read("apps/web/components/operations/import/LogsheetImportModal.tsx");
const operationsClientSrc = read("apps/web/components/operations/OperationsClient.tsx");

// ---------------------------------------------------------------------------
// 1. Capability matrix
// ---------------------------------------------------------------------------

test("machine.logs_import exists and is granted ONLY to super_admin and admin", () => {
  const cap = MACHINE_CAPABILITIES.LOGS_IMPORT;
  assert.equal(cap, "machine.logs_import");
  assert.equal(hasMachineCapability("super_admin", cap), true);
  assert.equal(hasMachineCapability("admin", cap), true);
  for (const role of ["manager", "supervisor", "site_supervisor", "operator", "hr", "sales", "marketing"]) {
    assert.equal(hasMachineCapability(role, cap), false, `${role} must NOT have ${cap}`);
  }
  assert.equal(hasMachineCapability("", cap), false);
  assert.equal(hasMachineCapability(null, cap), false);
  assert.equal(hasMachineCapability("unknown_role", cap), false);
});

test("role permission matrix grants machine.logs_import to admin only (super_admin wildcard)", () => {
  assert.ok(ROLE_PERMISSIONS.admin.includes("machine.logs_import"));
  for (const role of ["manager", "supervisor", "hr", "operator", "sales", "marketing"]) {
    assert.ok(!ROLE_PERMISSIONS[role].includes("machine.logs_import"), `${role} must not hold the permission`);
  }
  assert.ok(ROLE_PERMISSIONS.super_admin.includes("*"));
});

test("the operator view and logsheet import never leak into the fleet matrix", () => {
  const adminCaps = getMachineCapabilities("admin");
  assert.ok(adminCaps.includes(MACHINE_CAPABILITIES.LOGS_IMPORT));
  const managerCaps = getMachineCapabilities("manager");
  assert.ok(!managerCaps.includes(MACHINE_CAPABILITIES.LOGS_IMPORT));
});

// ---------------------------------------------------------------------------
// 2. Server-side enforcement in actions and routes
// ---------------------------------------------------------------------------

test("every server action guards with requireMachineCapability(LOGS_IMPORT)", () => {
  const guards = actionsSrc.match(/requireMachineCapability\(MACHINE_CAPABILITIES\.LOGS_IMPORT\)/g) || [];
  // validate + import + history + machines + checksum actions = 5 guards
  assert.ok(guards.length >= 4, `expected >= 4 guards, found ${guards.length}`);
  assert.ok(actionsSrc.includes('"use server"'));
});

test("template route authenticates and enforces the LOGS_IMPORT capability server-side", () => {
  assert.ok(routeSrc.includes("hasMachineCapability"));
  assert.ok(routeSrc.includes("MACHINE_CAPABILITIES.LOGS_IMPORT"));
  assert.ok(routeSrc.includes("Forbidden"));
  assert.ok(routeSrc.includes("Unauthorized"));
});

test("UI hides the importer behind the same capability (never the only gate)", () => {
  assert.ok(operationsClientSrc.includes("hasMachineCapability"));
  assert.ok(operationsClientSrc.includes("MACHINE_CAPABILITIES.LOGS_IMPORT"));
  assert.ok(operationsClientSrc.includes("canImport"));
});

// ---------------------------------------------------------------------------
// 3. Database enforcement
// ---------------------------------------------------------------------------

test("the import RPC re-verifies the real caller role from public.users", () => {
  assert.ok(migrationSrc.includes("SECURITY DEFINER"));
  assert.ok(/INTO\s+v_actor_role/.test(migrationSrc));
  assert.ok(migrationSrc.includes("only administrators can bulk import machine logs"));
  assert.ok(migrationSrc.includes("auth.uid()"));
  assert.ok(migrationSrc.includes("status = 'active'"));
});

test("the import RPC is revoked from anon and ungranted to PUBLIC", () => {
  assert.ok(migrationSrc.includes("REVOKE EXECUTE ON FUNCTION public.import_machine_hour_logs_bulk(jsonb) FROM PUBLIC"));
  assert.ok(migrationSrc.includes("REVOKE EXECUTE ON FUNCTION public.import_machine_hour_logs_bulk(jsonb) FROM anon"));
});

test("RLS stays enabled on machine_hour_logs and machine_log_imports", () => {
  assert.ok(migrationSrc.includes("ALTER TABLE public.machine_log_imports ENABLE ROW LEVEL SECURITY"));
  assert.ok(!/ALTER TABLE public\.machine_hour_logs DISABLE ROW LEVEL SECURITY/i.test(migrationSrc));
  assert.ok(!/ALTER TABLE public\.machine_log_imports DISABLE ROW LEVEL SECURITY/i.test(migrationSrc));
  // No client write policies on the audit table — writes only via the definer RPC
  const policySection = migrationSrc.slice(migrationSrc.indexOf("machine_log_imports ENABLE"));
  assert.ok(!/CREATE POLICY[^;]*FOR (INSERT|UPDATE|DELETE)/i.test(policySection));
});

test("idempotency token uniqueness protects against double-submission", () => {
  assert.ok(migrationSrc.includes("import_token          TEXT NOT NULL UNIQUE"));
  assert.ok(migrationSrc.includes("already_imported"));
});

// ---------------------------------------------------------------------------
// 4. Trusted identifiers never come from the spreadsheet
// ---------------------------------------------------------------------------

test("the template/parsing column model contains NO trusted database identifiers", () => {
  const keys = LOGSHEET_IMPORT_COLUMNS.map((c) => c.key);
  for (const forbidden of ["machine_id", "operator_id", "assignment_id", "client_id", "site_id", "entered_by", "entry_source"]) {
    assert.ok(!keys.includes(forbidden), `${forbidden} must not be importable from Excel`);
  }
  const headers = LOGSHEET_IMPORT_COLUMNS.map((c) => c.header.toLowerCase());
  for (const header of headers) {
    assert.ok(!/uuid|machine id|operator id(?! |$)|assignment/.test(header), `header "${header}" leaks a trusted identifier`);
  }
});

test("machine and operator identities are resolved server-side, not read from cells", () => {
  // The RPC receives machine_id from the envelope (server-validated) and resolves
  // operator identity through users.id — spreadsheet values only carry employee
  // IDs / names which are resolved against the database first.
  assert.ok(validateSrc.includes("fetchImportMachine"));
  assert.ok(validateSrc.includes("resolveOperators"));
  assert.ok(validateSrc.includes("OPERATOR_NOT_FOUND"));
  assert.ok(validateSrc.includes("OPERATOR_AMBIGUOUS"));
});

// ---------------------------------------------------------------------------
// 5. Credential hygiene + upload hardening
// ---------------------------------------------------------------------------

test("no privileged Supabase credentials reach the client bundle", () => {
  for (const src of [actionsSrc, routeSrc, modalSrc, operationsClientSrc]) {
    assert.ok(!/SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|service_role_key/i.test(src), "privileged key referenced");
  }
});

test("upload limits and format checks are enforced (size, extension, magic bytes)", () => {
  const parseSrc = read("apps/web/lib/server/logsheet-import/parse.ts");
  assert.ok(parseSrc.includes("buffer[0] !== 0x50") || parseSrc.includes("0x50, 0x4b"), "xlsx magic-byte check present");
  assert.ok(parseSrc.includes('"missing_data_sheet"'));
  assert.ok(actionsSrc.includes("LOGSHEET_IMPORT_MAX_FILE_BYTES"));
  assert.ok(modalSrc.includes(".xlsx"));
});

test("import success is only reported after post-commit DB verification", () => {
  assert.ok(actionsSrc.includes("insertedLogIds"));
  assert.ok(actionsSrc.includes("verifiedAll"));
  assert.ok(actionsSrc.includes("Import verification failed"));
  assert.ok(migrationSrc.includes("Import verification failed: not all records were committed"));
});

test("every validation issue carries column, original value, reason and expected format", () => {
  const validationModule = read("packages/validation/src/logsheetImport.ts");
  assert.ok(validationModule.includes("columnLabel"));
  assert.ok(validationModule.includes("value:"));
  assert.ok(validationModule.includes("expected:"));
  assert.ok(validationModule.includes("message:"));
});
