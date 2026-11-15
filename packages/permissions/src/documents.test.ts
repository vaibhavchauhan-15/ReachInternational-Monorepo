import test from "node:test";
import assert from "node:assert/strict";
import { canViewDocument, canVerifyDocument, canRejectDocument } from "./documents.ts";

test("canViewDocument: user can view own document", () => {
  const user = { id: "user-123", role: "operator" };
  assert.equal(canViewDocument(user, { id: "user-123" }, "aadhaar"), true);
  assert.equal(canViewDocument(user, { id: "user-123" }, "bank_document"), true);
  assert.equal(canViewDocument(user, { id: "user-123" }, "driving_license"), true);
});

test("canViewDocument: privileged roles (super_admin, admin, hr) can view another user's documents", () => {
  const target = { id: "target-user-456" };
  assert.equal(canViewDocument({ id: "admin-1", role: "super_admin" }, target, "aadhaar"), true);
  assert.equal(canViewDocument({ id: "admin-2", role: "admin" }, target, "bank_document"), true);
  assert.equal(canViewDocument({ id: "hr-1", role: "hr" }, target, "driving_license"), true);
});

test("canViewDocument: manager and supervisor can view driving_license of team members only", () => {
  const target = { id: "target-user-456" };

  // Team member driving license allowed
  assert.equal(
    canViewDocument({ id: "mgr-1", role: "manager" }, target, "driving_license", { isTeamMember: true }),
    true
  );
  assert.equal(
    canViewDocument({ id: "sup-1", role: "supervisor" }, target, "driving_license", { isTeamMember: true }),
    true
  );

  // Non-team member driving license denied
  assert.equal(
    canViewDocument({ id: "mgr-1", role: "manager" }, target, "driving_license", { isTeamMember: false }),
    false
  );
  assert.equal(
    canViewDocument({ id: "sup-1", role: "supervisor" }, target, "driving_license"),
    false
  );

  // Other documents (aadhaar, bank_document) denied even for team members
  assert.equal(
    canViewDocument({ id: "mgr-1", role: "manager" }, target, "aadhaar", { isTeamMember: true }),
    false
  );
  assert.equal(
    canViewDocument({ id: "sup-1", role: "supervisor" }, target, "bank_document", { isTeamMember: true }),
    false
  );
});

test("canViewDocument: operator and unprivileged roles cannot view another user's documents", () => {
  const target = { id: "target-user-456" };
  assert.equal(canViewDocument({ id: "op-1", role: "operator" }, target, "aadhaar"), false);
  assert.equal(canViewDocument({ id: "sales-1", role: "sales" }, target, "bank_document"), false);
  assert.equal(canViewDocument(null, target, "aadhaar"), false);
  assert.equal(canViewDocument({ id: "op-1", role: "operator" }, null, "aadhaar"), false);
});

test("canVerifyDocument and canRejectDocument: only super_admin, admin, hr permitted", () => {
  assert.equal(canVerifyDocument({ id: "sa-1", role: "super_admin" }), true);
  assert.equal(canVerifyDocument({ id: "adm-1", role: "admin" }), true);
  assert.equal(canVerifyDocument({ id: "hr-1", role: "hr" }), true);
  assert.equal(canVerifyDocument({ id: "mgr-1", role: "manager" }), false);
  assert.equal(canVerifyDocument({ id: "sup-1", role: "supervisor" }), false);
  assert.equal(canVerifyDocument({ id: "op-1", role: "operator" }), false);
  assert.equal(canVerifyDocument(null), false);

  assert.equal(canRejectDocument({ id: "sa-1", role: "super_admin" }), true);
  assert.equal(canRejectDocument({ id: "adm-1", role: "admin" }), true);
  assert.equal(canRejectDocument({ id: "hr-1", role: "hr" }), true);
  assert.equal(canRejectDocument({ id: "mgr-1", role: "manager" }), false);
  assert.equal(canRejectDocument({ id: "sup-1", role: "supervisor" }), false);
  assert.equal(canRejectDocument({ id: "op-1", role: "operator" }), false);
  assert.equal(canRejectDocument(null), false);
});
