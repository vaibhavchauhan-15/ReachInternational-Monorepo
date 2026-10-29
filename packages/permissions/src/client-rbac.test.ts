import test from "node:test";
import assert from "node:assert/strict";
import { PERMISSIONS } from "./permissions.ts";
import { roleHasPermission, hasAllPermissions, hasAnyPermission } from "./matrix.ts";
import { isRouteAllowedForRole } from "./navigation.ts";

import type { UserRole } from "@reachinternational/types";

test("CLIENT_VIEW, CLIENT_CREATE, CLIENT_EDIT, CLIENT_DELETE and supervisor permissions exist", () => {
  assert.equal(PERMISSIONS.CLIENT_VIEW, "client.view");
  assert.equal(PERMISSIONS.CLIENT_CREATE, "client.create");
  assert.equal(PERMISSIONS.CLIENT_EDIT, "client.edit");
  assert.equal(PERMISSIONS.CLIENT_DELETE, "client.delete");
  assert.equal(PERMISSIONS.CLIENT_ASSIGN_SUPERVISOR, "client.assign_supervisor");
  assert.equal(PERMISSIONS.CLIENT_REMOVE_SUPERVISOR, "client.remove_supervisor");
});

test("Super Admin has all permissions including client supervisor management", () => {
  assert.equal(roleHasPermission("super_admin", PERMISSIONS.CLIENT_ASSIGN_SUPERVISOR), true);
  assert.equal(roleHasPermission("super_admin", PERMISSIONS.CLIENT_REMOVE_SUPERVISOR), true);
  assert.equal(roleHasPermission("super_admin", PERMISSIONS.CLIENT_VIEW), true);
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

test("Supervisor role can ONLY view clients (read-only: cannot create, edit, delete, or manage supervisors)", () => {
  assert.equal(roleHasPermission("supervisor", PERMISSIONS.CLIENT_VIEW), true, "Supervisor MUST have CLIENT_VIEW permission");
  assert.equal(roleHasPermission("supervisor", PERMISSIONS.CLIENT_CREATE), false, "Supervisor MUST NOT have CLIENT_CREATE permission");
  assert.equal(roleHasPermission("supervisor", PERMISSIONS.CLIENT_EDIT), false, "Supervisor MUST NOT have CLIENT_EDIT permission");
  assert.equal(roleHasPermission("supervisor", PERMISSIONS.CLIENT_DELETE), false, "Supervisor MUST NOT have CLIENT_DELETE permission");
  assert.equal(roleHasPermission("supervisor", PERMISSIONS.CLIENT_ASSIGN_SUPERVISOR), false, "Supervisor MUST NOT have CLIENT_ASSIGN_SUPERVISOR permission");
  assert.equal(roleHasPermission("supervisor", PERMISSIONS.CLIENT_REMOVE_SUPERVISOR), false, "Supervisor MUST NOT have CLIENT_REMOVE_SUPERVISOR permission");
});

test("Super Admin, Admin, and Manager have client management permissions", () => {
  for (const role of ["super_admin", "admin", "manager"] as UserRole[]) {
    assert.equal(roleHasPermission(role, PERMISSIONS.CLIENT_VIEW), true, `${role} must have CLIENT_VIEW`);
    assert.equal(roleHasPermission(role, PERMISSIONS.CLIENT_CREATE), true, `${role} must have CLIENT_CREATE`);
    assert.equal(roleHasPermission(role, PERMISSIONS.CLIENT_EDIT), true, `${role} must have CLIENT_EDIT`);
    assert.equal(roleHasPermission(role, PERMISSIONS.CLIENT_DELETE), true, `${role} must have CLIENT_DELETE`);
  }
});

test("Operator and HR CANNOT view or manage clients", () => {
  for (const role of ["operator", "hr"] as UserRole[]) {
    assert.equal(roleHasPermission(role, PERMISSIONS.CLIENT_VIEW), false, `${role} must NOT have CLIENT_VIEW`);
    assert.equal(roleHasPermission(role, PERMISSIONS.CLIENT_CREATE), false, `${role} must NOT have CLIENT_CREATE`);
    assert.equal(roleHasPermission(role, PERMISSIONS.CLIENT_EDIT), false, `${role} must NOT have CLIENT_EDIT`);
    assert.equal(roleHasPermission(role, PERMISSIONS.CLIENT_DELETE), false, `${role} must NOT have CLIENT_DELETE`);
    assert.equal(roleHasPermission(role, PERMISSIONS.CLIENT_ASSIGN_SUPERVISOR), false, `${role} must NOT have CLIENT_ASSIGN_SUPERVISOR`);
    assert.equal(roleHasPermission(role, PERMISSIONS.CLIENT_REMOVE_SUPERVISOR), false, `${role} must NOT have CLIENT_REMOVE_SUPERVISOR`);
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

test("Route /clients is accessible to supervisor, manager, admin, super_admin, and blocked for operator, hr", () => {
  assert.equal(isRouteAllowedForRole("/clients", "supervisor"), true, "Supervisor MUST be allowed on /clients route");
  assert.equal(isRouteAllowedForRole("/clients", "manager"), true, "Manager MUST be allowed on /clients route");
  assert.equal(isRouteAllowedForRole("/clients", "admin"), true, "Admin MUST be allowed on /clients route");
  assert.equal(isRouteAllowedForRole("/clients", "super_admin"), true, "Super Admin MUST be allowed on /clients route");
  assert.equal(isRouteAllowedForRole("/clients", "operator"), false, "Operator MUST NOT be allowed on /clients route");
  assert.equal(isRouteAllowedForRole("/clients", "hr"), false, "HR MUST NOT be allowed on /clients route");
});
