import { test } from "node:test";
import assert from "node:assert/strict";
import type { UserRole } from "@reachinternational/types";
import {
  MACHINE_CAPABILITIES,
  MACHINE_ROLE_CAPABILITIES,
  MACHINE_FORBIDDEN_CODE,
  canAccessMachinesRoute,
  getMachineCapabilities,
  getMachineScope,
  hasMachineCapability,
  isOperatorMachineView,
  normalizeMachineRole,
} from "./machines.ts";

const ROLES: UserRole[] = [
  "super_admin",
  "admin",
  "manager",
  "supervisor",
  "hr",
  "operator",
];

const ALL_CAPABILITIES = Object.values(MACHINE_CAPABILITIES);
const FLEET_CAPABILITIES = ALL_CAPABILITIES.filter(
  (capability) =>
    capability !== MACHINE_CAPABILITIES.OPERATOR_VIEW &&
    capability !== MACHINE_CAPABILITIES.LOGS_IMPORT
);

test("super_admin inherits every fleet capability (never the operator-only view)", () => {
  for (const capability of FLEET_CAPABILITIES) {
    assert.equal(
      hasMachineCapability("super_admin", capability),
      true,
      `super_admin must have ${capability}`
    );
  }
  assert.equal(
    getMachineCapabilities("super_admin").length,
    FLEET_CAPABILITIES.length + 1
  );
  assert.equal(
    hasMachineCapability("super_admin", MACHINE_CAPABILITIES.OPERATOR_VIEW),
    false,
    "super_admin must use the fleet view, not the assigned-machine view"
  );
  assert.equal(
    hasMachineCapability("super_admin", MACHINE_CAPABILITIES.LOGS_IMPORT),
    true,
    "super_admin must be able to bulk import logsheet records"
  );
});

test("admin has the full fleet matrix plus the admin-only logsheet import", () => {
  for (const capability of FLEET_CAPABILITIES) {
    assert.equal(
      hasMachineCapability("admin", capability),
      true,
      `admin must have ${capability}`
    );
  }
  assert.equal(
    hasMachineCapability("admin", MACHINE_CAPABILITIES.OPERATOR_VIEW),
    false,
    `admin must not select the operator-only view`
  );
  assert.equal(
    hasMachineCapability("admin", MACHINE_CAPABILITIES.LOGS_IMPORT),
    true,
    "admin must be able to bulk import logsheet records"
  );
});

test("manager has the fleet matrix but NOT the admin-only logsheet import", () => {
  for (const capability of FLEET_CAPABILITIES) {
    assert.equal(
      hasMachineCapability("manager", capability),
      true,
      `manager must have ${capability}`
    );
  }
  assert.equal(
    hasMachineCapability("manager", MACHINE_CAPABILITIES.OPERATOR_VIEW),
    false,
    `manager must not select the operator-only view`
  );
  assert.equal(
    hasMachineCapability("manager", MACHINE_CAPABILITIES.LOGS_IMPORT),
    false,
    "manager must NOT bulk import logsheet records (admin-only)"
  );
});

test("supervisor capabilities match the confirmed matrix cells", () => {
  const allowed = [
    MACHINE_CAPABILITIES.VIEW,
    MACHINE_CAPABILITIES.FLEET_VIEW,
    MACHINE_CAPABILITIES.STATUS_UPDATE,
    MACHINE_CAPABILITIES.ASSIGN_OPERATOR,
    MACHINE_CAPABILITIES.ASSIGN_CLIENT,
    MACHINE_CAPABILITIES.AUDIT_VIEW,
    MACHINE_CAPABILITIES.EXPORT,
  ];
  const denied = [
    MACHINE_CAPABILITIES.CREATE,
    MACHINE_CAPABILITIES.EDIT_SPECS,
    MACHINE_CAPABILITIES.IMPORT,
    MACHINE_CAPABILITIES.LOGS_IMPORT,
    MACHINE_CAPABILITIES.DELETE,
    MACHINE_CAPABILITIES.ASSIGN_SUPERVISOR,
    MACHINE_CAPABILITIES.RENTAL_RATES_VIEW,
    MACHINE_CAPABILITIES.OPERATOR_VIEW,
  ];
  for (const capability of allowed) {
    assert.equal(hasMachineCapability("supervisor", capability), true, `supervisor must have ${capability}`);
  }
  for (const capability of denied) {
    assert.equal(hasMachineCapability("supervisor", capability), false, `supervisor must NOT have ${capability}`);
  }
});

test("operator only gets view + the dedicated operator view", () => {
  assert.equal(hasMachineCapability("operator", MACHINE_CAPABILITIES.VIEW), true);
  assert.equal(hasMachineCapability("operator", MACHINE_CAPABILITIES.OPERATOR_VIEW), true);
  for (const capability of ALL_CAPABILITIES) {
    if (
      capability === MACHINE_CAPABILITIES.VIEW ||
      capability === MACHINE_CAPABILITIES.OPERATOR_VIEW
    ) {
      continue;
    }
    assert.equal(
      hasMachineCapability("operator", capability),
      false,
      `operator must NOT have ${capability}`
    );
  }
});

test("HR has no machine access at all (route, directory, rates, audit, export)", () => {
  assert.equal(canAccessMachinesRoute("hr"), false);
  assert.equal(isOperatorMachineView("hr"), false);
  for (const capability of ALL_CAPABILITIES) {
    assert.equal(
      hasMachineCapability("hr", capability),
      false,
      `hr must NOT have ${capability}`
    );
  }
  assert.equal(getMachineCapabilities("hr").length, 0);
});

test("sales, marketing and unknown roles are denied by default", () => {
  for (const role of ["sales", "marketing", "guest", "", null, undefined]) {
    assert.equal(canAccessMachinesRoute(role), false, `${role} must not access /machines`);
    assert.equal(getMachineCapabilities(role as string | null | undefined).length, 0);
  }
});

test("route access: manager tier, supervisor and operator only", () => {
  assert.equal(canAccessMachinesRoute("super_admin"), true);
  assert.equal(canAccessMachinesRoute("admin"), true);
  assert.equal(canAccessMachinesRoute("manager"), true);
  assert.equal(canAccessMachinesRoute("supervisor"), true);
  assert.equal(canAccessMachinesRoute("operator"), true);
  assert.equal(canAccessMachinesRoute("hr"), false);
});

test("scopes are all / supervised / assigned / none", () => {
  assert.equal(getMachineScope("super_admin"), "all");
  assert.equal(getMachineScope("admin"), "all");
  assert.equal(getMachineScope("manager"), "all");
  assert.equal(getMachineScope("supervisor"), "supervised");
  assert.equal(getMachineScope("operator"), "assigned");
  assert.equal(getMachineScope("hr"), "none");
  assert.equal(getMachineScope("sales"), "none");
});

test("role and capability normalization is tolerant but deny-by-default", () => {
  assert.equal(normalizeMachineRole(" SUPER-ADMIN "), "super_admin");
  assert.equal(normalizeMachineRole("Site Supervisor"), "supervisor");
  assert.equal(normalizeMachineRole("Operator"), "operator");
  assert.equal(normalizeMachineRole("unknown_role"), "");
  assert.equal(normalizeMachineRole(null), "");
  assert.equal(hasMachineCapability("Site Supervisor" as any, "machine.fleet_view"), true);
  assert.equal(hasMachineCapability("admin", "machine.unknown_capability"), false);
});

test("matrix exposes only the canonical capability codes", () => {
  for (const role of ROLES) {
    const granted = getMachineCapabilities(role);
    for (const capability of granted) {
      assert.ok(
        ALL_CAPABILITIES.includes(capability),
        `${role} was granted unknown capability ${capability}`
      );
    }
  }
  assert.equal(MACHINE_ROLE_CAPABILITIES.hr.length, 0);
  assert.equal(MACHINE_FORBIDDEN_CODE, "MACHINE_FORBIDDEN");
});

test("capability arrays returned to callers cannot mutate the matrix", () => {
  const first = getMachineCapabilities("operator");
  first.push(MACHINE_CAPABILITIES.DELETE as any);
  const second = getMachineCapabilities("operator");
  assert.equal(second.includes(MACHINE_CAPABILITIES.DELETE), false);
});
