#!/usr/bin/env node
/**
 * Static RBAC guard test for the Web Machines module.
 *
 * Verifies that every machine server action is capability-guarded, that the
 * routes guard before fetching, and that the UI derives controls from the
 * shared capability matrix instead of hardcoded role checks.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(__dirname, "..");
const ROOT = path.resolve(WEB, "..", "..");

const read = (p) => fs.readFileSync(path.resolve(ROOT, p), "utf8");

const actions = read("apps/web/app/actions/machines.ts");
const importActions = read("apps/web/app/actions/machine-import.ts");
const listPage = read("apps/web/app/(app)/machines/page.tsx");
const detailPage = read("apps/web/app/(app)/machines/[...id]/page.tsx");
const listClient = read("apps/web/components/machines/MachineListClient.tsx");
const detailClient = read("apps/web/app/(app)/machines/[...id]/MachineClientView.tsx");
const mobileHeader = read("apps/web/components/layout/MobilePageHeader.tsx");
const operatorsRoute = read("apps/web/app/api/machines/[id]/operators/route.ts");
const supervisorsRoute = read("apps/web/app/api/machines/[id]/supervisors/route.ts");
const migration = read("supabase/migrations/231_machines_rbac_and_query_hardening.sql");
const filtersDal = read("apps/web/lib/data/machines/machine-filters.ts");

let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};

// ── 1. Every server action exported from the machines action module ──────────
const actionChunks = actions.split(/\nexport async function /).slice(1);
const actionNames = actionChunks.map((chunk) => chunk.slice(0, chunk.indexOf("(")).trim());
check(actionNames.length >= 20, `expected machine actions, found ${actionNames.length}`);

const mutating = new Set([
  "createMachine",
  "updateMachine",
  "updateMachineOperationalStatus",
  "deleteMachine",
  "reassignMachineSupervisor",
  "updateMachineInfoAction",
  "updateMachineSupervisorsAction",
  "updateMachineOperatorsAction",
  "updateMachinePersonnelAction",
  "updateMachineClientAssignmentAction",
]);
const reads = new Set([
  "getMachineHourLogsAction",
  "getPaginatedMachineHourLogsAction",
  "getMachineAssignmentsAction",
  "getMachineAuditAction",
  "searchMachinesServerAction",
  "getPaginatedMachinesAction",
  "getMachineExportDataAction",
]);
const optionReaders = new Set([
  "getMachineModalOptionsAction",
  "getActiveOperatorsForUserAction",
  "getActiveOperatorAssignmentsAction",
  "getClientSelectOptionsAction",
  "getActiveSupervisorsOnlyAction",
  "getSupervisorFilterOptionsAction",
  "checkMachineSerialNumberAvailable",
  "checkMachineIdAvailable",
]);

for (const chunk of actionChunks) {
  const name = chunk.slice(0, chunk.indexOf("(")).trim();
  const body = chunk.slice(0, chunk.indexOf("\nexport ") > 0 ? chunk.indexOf("\nexport ") : chunk.length);
  if (mutating.has(name) || reads.has(name) || optionReaders.has(name)) {
    check(
      body.includes("requireMachineCapability("),
      `${name} must call requireMachineCapability (no capability-free action)`
    );
  }
}

for (const name of [
  "updateMachine",
  "updateMachineOperationalStatus",
  "updateMachineInfoAction",
  "updateMachineSupervisorsAction",
  "updateMachineOperatorsAction",
  "updateMachinePersonnelAction",
  "updateMachineClientAssignmentAction",
]) {
  const chunk = actionChunks.find((c) => c.startsWith(`${name}(`));
  check(!!chunk, `${name} export missing`);
  check(chunk.includes("requireMachineRecordAccess("), `${name} must verify machine record scope`);
}

check(
  actions.includes("MACHINE_CAPABILITIES.DELETE") && actions.includes("MACHINE_CAPABILITIES.EXPORT"),
  "delete/export capabilities must be enforced in actions"
);
check(
  actions.includes("MACHINE_CAPABILITIES.ASSIGN_SUPERVISOR") &&
    actions.includes("MACHINE_CAPABILITIES.ASSIGN_OPERATOR") &&
    actions.includes("MACHINE_CAPABILITIES.ASSIGN_CLIENT"),
  "assignment capabilities must be enforced in actions"
);
check(
  !actions.includes('requireRole("admin"') && !actions.includes('role === "supervisor"'),
  "machines actions must not use hardcoded role checks"
);

// ── 2. Bulk import ───────────────────────────────────────────────────────────
check(
  importActions.includes("MACHINE_CAPABILITIES.IMPORT"),
  "bulk import must require machine.import"
);
check(
  importActions.includes(".insert(payloads)"),
  "bulk import must use a single set-based insert"
);

// ── 3. Routes guard before data access ───────────────────────────────────────
check(listPage.includes("requireMachinesPageAccess()"), "/machines page must guard the route");
check(
  listPage.includes("isOperatorMachineView(user.role)"),
  "operator view must be selected by role (not by a capability the manager tier also holds)"
);
check(
  listPage.includes("if (isOperatorMachineView(user.role))"),
  "operator branch must bypass fleet queries"
);
check(
  !listPage.includes("MACHINE_CAPABILITIES.OPERATOR_VIEW"),
  "operator view must never be granted as a fleet capability"
);
check(
  detailPage.includes("requireMachinesPageAccess()"),
  "/machines/[id] page must guard the route"
);
check(
  detailPage.includes("canAccessMachineRecord("),
  "/machines/[id] must enforce record scope"
);
check(
  detailPage.includes("includeRate: canViewRates"),
  "rental rates must only be projected with machine.rental_rates_view"
);
check(
  detailPage.includes("includeClientCompliance: !isOperatorView"),
  "operator detail projection must exclude GSTIN/PAN/billing"
);

// ── 4. API routes return 403 ─────────────────────────────────────────────────
for (const [name, route] of [
  ["operators", operatorsRoute],
  ["supervisors", supervisorsRoute],
]) {
  check(route.includes("requireMachineCapability("), `${name} route must check capabilities`);
  check(route.includes("requireMachineRecordAccess("), `${name} route must check record scope`);
  check(route.includes("isMachineForbiddenError"), `${name} route must map denials`);
  check(route.includes("status: 403"), `${name} route must return HTTP 403`);
}

// ── 5. UI derives from capabilities and does not mount hidden controls ──────
check(
  listClient.includes("capabilities?: readonly MachineCapability[]"),
  "MachineListClient must accept the server-computed capability set"
);
check(
  listClient.includes("hasMachineCapability(userRole, capability)"),
  "MachineListClient must fall back to the shared matrix"
);
check(
  listClient.includes("{canExport && (") && listClient.includes("canExport ? tableBulkActions : undefined"),
  "export menu/bulk actions must be capability-gated"
);
check(
  listClient.includes("canCreateMachine") && listClient.includes("canDelete"),
  "create/delete controls must be capability-gated"
);
check(
  listClient.includes("{!isOperatorView && (") && listClient.includes("MachineKPIStrip"),
  "operator view must not mount fleet KPIs/filters"
);
check(
  listClient.includes("isOperatorMachineView(userRole)"),
  "list UI must select operator view by role"
);
check(
  detailClient.includes("capabilities?: readonly MachineCapability[]"),
  "MachineClientView must accept the capability set"
);
check(
  detailClient.includes("allowAuditView") && detailClient.includes("canViewRates"),
  "audit tab and rental rate projection must be capability-gated"
);
check(
  detailClient.includes("infoModalOpen &&") &&
    detailClient.includes("operatorModalOpen &&") &&
    detailClient.includes("clientModalOpen &&"),
  "detail modals must only mount when open"
);
check(
  mobileHeader.includes("hasMachineCapability(userRole, MACHINE_CAPABILITIES."),
  "mobile header machine actions must derive from capabilities"
);

// ── 6. Fleet-wide assignment data is never returned unscoped ────────────────
check(
  filtersDal.includes("getMachineScope(scopeRole"),
  "operator-assignment cache must resolve caller scope"
);
check(
  filtersDal.includes('scope === "assigned"') && filtersDal.includes("operator_id"),
  "operator assignment reads must be limited to the caller"
);
check(
  filtersDal.includes('scope === "supervised"') && filtersDal.includes("client_supervisors"),
  "supervisor assignment reads must be limited to supervised machines"
);
check(
  filtersDal.includes('"active-operator-machine-assignments-v4"'),
  "assignment cache key must be bumped when scoping changes"
);
check(
  operatorsRoute.includes("getActiveOperatorMachineAssignments(assignmentDate, user.id, user.role)"),
  "operators API must pass the caller scope into the assignment cache"
);
check(
  supervisorsRoute.includes("MACHINE_CAPABILITIES.ASSIGN_SUPERVISOR"),
  "supervisor candidate pool must require machine.assign_supervisor"
);

// ── 7. Database layer ────────────────────────────────────────────────────────
for (const needle of [
  "DROP POLICY IF EXISTS \"machines_select_authorized\"",
  "DROP POLICY IF EXISTS \"machines_update_authorized\"",
  "v_role IN ('super_admin', 'admin', 'manager')",
  "IF v_role <> 'supervisor' AND v_role <> 'operator' THEN",
  "ERRCODE = '42501'",
  "get_machines_directory_summary",
  "idx_oma_machine_operator_active",
]) {
  check(migration.includes(needle), `migration missing: ${needle}`);
}
check(
  !migration.includes("'hr'") || !migration.includes("v_role IN ('super_admin', 'admin', 'manager', 'hr')"),
  "migration must not grant HR machine directory access"
);

console.log(`PASS — ${checks} machines RBAC guard checks`);
