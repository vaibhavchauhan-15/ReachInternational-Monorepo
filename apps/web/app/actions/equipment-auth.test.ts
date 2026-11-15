import { test } from "node:test";
import assert from "node:assert/strict";

const ALLOWED_ADMIN_ROLES = ["super_admin", "admin", "manager"] as const;

function isEquipmentActionAuthorized(userRole?: string | null): boolean {
  if (!userRole) return false;
  return (ALLOWED_ADMIN_ROLES as readonly string[]).includes(userRole);
}

test("unauthenticated users cannot invoke equipment cache revalidation", () => {
  assert.equal(isEquipmentActionAuthorized(null), false);
  assert.equal(isEquipmentActionAuthorized(undefined), false);
});

test("unauthorized roles cannot invoke equipment cache revalidation", () => {
  assert.equal(isEquipmentActionAuthorized("operator"), false);
  assert.equal(isEquipmentActionAuthorized("supervisor"), false);
  assert.equal(isEquipmentActionAuthorized("guest"), false);
});

test("authorized roles (super_admin, admin, manager) are permitted", () => {
  assert.equal(isEquipmentActionAuthorized("super_admin"), true);
  assert.equal(isEquipmentActionAuthorized("admin"), true);
  assert.equal(isEquipmentActionAuthorized("manager"), true);
});
