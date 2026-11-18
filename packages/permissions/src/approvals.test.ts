import test from "node:test";
import assert from "node:assert/strict";
import {
  canSubmitApproval,
  canViewApproval,
  canDecideApproval,
  getDecidableApprovalTypesForRole,
} from "./approvals.ts";

test("canSubmitApproval allows operator to submit profile_change and document_replace", () => {
  assert.equal(canSubmitApproval("operator", "profile_change"), true);
  assert.equal(canSubmitApproval("operator", "document_replace"), true);
  assert.equal(canSubmitApproval("operator", "account_deletion"), true);
});

test("canDecideApproval restricts deciding strictly to super_admin and admin", () => {
  const target = { id: "user-1", role: "operator" as const };

  assert.equal(canDecideApproval({ id: "sa-1", role: "super_admin" }, target, "document_verify"), true);
  assert.equal(canDecideApproval({ id: "admin-1", role: "admin" }, target, "document_verify"), true);
  assert.equal(canDecideApproval({ id: "hr-1", role: "hr" }, target, "document_verify"), false);
  assert.equal(canDecideApproval({ id: "mgr-1", role: "manager" }, target, "document_verify"), false);
  assert.equal(canDecideApproval({ id: "sup-1", role: "supervisor" }, target, "document_verify"), false);
  assert.equal(canDecideApproval({ id: "op-1", role: "operator" }, target, "document_verify"), false);
});

test("canDecideApproval blocks self-approval by default", () => {
  const approver = { id: "user-1", role: "admin" as const };
  const target = { id: "user-1", role: "admin" as const };

  assert.equal(canDecideApproval(approver, target, "profile_change", false), false);
  assert.equal(canDecideApproval(approver, target, "profile_change", true), true);
});

test("canDecideApproval enforces hierarchy: admin cannot decide for super_admin", () => {
  const adminApprover = { id: "admin-1", role: "admin" as const };
  const superAdminApprover = { id: "sa-1", role: "super_admin" as const };
  const superAdminTarget = { id: "sa-1", role: "super_admin" as const };
  const operatorTarget = { id: "op-1", role: "operator" as const };

  assert.equal(canDecideApproval(adminApprover, superAdminTarget, "profile_change"), false);
  assert.equal(canDecideApproval(adminApprover, operatorTarget, "profile_change"), true);
  assert.equal(canDecideApproval(superAdminApprover, operatorTarget, "profile_change"), true);
});

test("getDecidableApprovalTypesForRole returns correct types for admin and supervisor", () => {
  const supervisorTypes = getDecidableApprovalTypesForRole("supervisor");
  assert.deepEqual(supervisorTypes, []);

  const adminTypes = getDecidableApprovalTypesForRole("admin");
  assert.ok(adminTypes.includes("document_verify"));
  assert.ok(adminTypes.includes("profile_change"));
  assert.ok(adminTypes.includes("registration"));
  assert.ok(adminTypes.includes("document_replace"));
  assert.ok(adminTypes.includes("account_deletion"));
  assert.ok(adminTypes.includes("shift_conflict"));
});
