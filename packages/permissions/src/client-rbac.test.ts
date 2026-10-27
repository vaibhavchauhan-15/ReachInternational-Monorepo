import test from "node:test";
import assert from "node:assert/strict";
import { PERMISSIONS } from "./permissions.ts";
import { roleHasPermission, hasAllPermissions, hasAnyPermission } from "./matrix.ts";

import type { UserRole } from "@reachinternational/types";

test("CLIENT_ASSIGN_SUPERVISOR and CLIENT_REMOVE_SUPERVISOR permissions exist", () => {
  assert.equal(PERMISSIONS.CLIENT_ASSIGN_SUPERVISOR, "client.assign_supervisor");
  assert.equal(PERMISSIONS.CLIENT_REMOVE_SUPERVISOR, "client.remove_supervisor");
});

test("Super Admin has all permissions including client supervisor management", () => {
  assert.equal(roleHasPermission("super_admin", PERMISSIONS.CLIENT_ASSIGN_SUPERVISOR), true);
  assert.equal(roleHasPermission("super_admin", PERMISSIONS.CLIENT_REMOVE_SUPERVISOR), true);
});

test("Admin and Manager roles can assign and remove client supervisors", () => {
  const privilegedRoles: UserRole[] = ["admin", "manager"];
  for (const role of privilegedRoles) {
    assert.equal(
      roleHasPermission(role, PERMISSIONS.CLIENT_ASSIGN_SUPERVISOR),
      true,
      `${role} must have CLIENT_ASSIGN_SUPERVISOR permission`
    );
    assert.equal(
      roleHasPermission(role, PERMISSIONS.CLIENT_REMOVE_SUPERVISOR),
      true,
      `${role} must have CLIENT_REMOVE_SUPERVISOR permission`
    );
  }
});

test("Supervisor, Operator, HR, and Account roles CANNOT assign or remove client supervisors", () => {
  const unprivilegedRoles: UserRole[] = [
    "supervisor",
    "operator",
    "hr",
  ];
  for (const role of unprivilegedRoles) {
    assert.equal(
      roleHasPermission(role, PERMISSIONS.CLIENT_ASSIGN_SUPERVISOR),
      false,
      `${role} must NOT have CLIENT_ASSIGN_SUPERVISOR permission`
    );
    assert.equal(
      roleHasPermission(role, PERMISSIONS.CLIENT_REMOVE_SUPERVISOR),
      false,
      `${role} must NOT have CLIENT_REMOVE_SUPERVISOR permission`
    );
  }
});

test("hasAllPermissions and hasAnyPermission work correctly with client supervisor permissions", () => {
  assert.equal(
    hasAllPermissions("admin", [
      PERMISSIONS.CLIENT_ASSIGN_SUPERVISOR,
      PERMISSIONS.CLIENT_REMOVE_SUPERVISOR,
    ]),
    true
  );
  assert.equal(
    hasAnyPermission("supervisor", [
      PERMISSIONS.CLIENT_ASSIGN_SUPERVISOR,
      PERMISSIONS.MACHINE_VIEW,
    ]),
    true
  );
  assert.equal(
    hasAnyPermission("operator", [
      PERMISSIONS.CLIENT_ASSIGN_SUPERVISOR,
      PERMISSIONS.CLIENT_REMOVE_SUPERVISOR,
    ]),
    false
  );
});
