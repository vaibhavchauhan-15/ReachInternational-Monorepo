import test from "node:test";
import assert from "node:assert/strict";
import { isSupervisorOrAbove } from "./roles.ts";
import { PERMISSIONS } from "./permissions.ts";
import { roleHasPermission } from "./matrix.ts";

test("isSupervisorOrAbove correctly identifies authorized shift entry roles", () => {
  assert.equal(isSupervisorOrAbove("super_admin"), true);
  assert.equal(isSupervisorOrAbove("admin"), true);
  assert.equal(isSupervisorOrAbove("manager"), true);
  assert.equal(isSupervisorOrAbove("supervisor"), true);
  assert.equal(isSupervisorOrAbove("Supervisor"), true);
  assert.equal(isSupervisorOrAbove("Site Supervisor"), true);
  assert.equal(isSupervisorOrAbove("site_supervisor"), true);
  assert.equal(isSupervisorOrAbove("ADMIN"), true);
  assert.equal(isSupervisorOrAbove("  manager  "), true);
  assert.equal(isSupervisorOrAbove("operator"), false);
  assert.equal(isSupervisorOrAbove("hr"), false);
  assert.equal(isSupervisorOrAbove(null), false);
  assert.equal(isSupervisorOrAbove(undefined), false);
});

test("Supervisor role has OPERATOR_LOG_CREATE and OPERATOR_LOG_EDIT permissions", () => {
  assert.equal(roleHasPermission("supervisor", PERMISSIONS.OPERATOR_LOG_CREATE), true);
  assert.equal(roleHasPermission("supervisor", PERMISSIONS.OPERATOR_LOG_EDIT), true);
  assert.equal(roleHasPermission("admin", PERMISSIONS.OPERATOR_LOG_CREATE), true);
  assert.equal(roleHasPermission("manager", PERMISSIONS.OPERATOR_LOG_CREATE), true);
  assert.equal(roleHasPermission("operator", PERMISSIONS.OPERATOR_LOG_CREATE), true);
  assert.equal(roleHasPermission("hr", PERMISSIONS.OPERATOR_LOG_CREATE), false);
});
