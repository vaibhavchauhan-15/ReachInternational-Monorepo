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

test("canDecideApproval restricts document_verify strictly to super_admin, admin, and hr", () => {
  const target = { id: "user-1", role: "operator" as const };

  assert.equal(canDecideApproval({ id: "admin-1", role: "admin" }, target, "document_verify"), true);
  assert.equal(canDecideApproval({ id: "hr-1", role: "hr" }, target, "document_verify"), true);
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

test("canDecideApproval enforces hierarchy: manager cannot decide for admin", () => {
  const manager = { id: "mgr-1", role: "manager" as const };
  const adminTarget = { id: "admin-1", role: "admin" as const };
  const operatorTarget = { id: "op-1", role: "operator" as const };

  assert.equal(canDecideApproval(manager, adminTarget, "profile_change"), false);
  assert.equal(canDecideApproval(manager, operatorTarget, "profile_change"), true);
});

test("getDecidableApprovalTypesForRole returns correct types for supervisor", () => {
  const types = getDecidableApprovalTypesForRole("supervisor");
  assert.deepEqual(types, ["shift_conflict"]);
});
