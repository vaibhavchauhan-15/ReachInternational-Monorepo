import test from "node:test";
import assert from "node:assert/strict";
import {
  ApprovalSubmitInputSchema,
  ApprovalDecideInputSchema,
  ApprovalCancelInputSchema,
  ProfileChangePayloadSchema,
  RegistrationPayloadSchema,
  DocumentVerifyPayloadSchema,
  DocumentReplacePayloadSchema,
  AccountDeletionPayloadSchema,
} from "./approvals.ts";

test("ApprovalSubmitInputSchema validates correct submission", () => {
  const valid = {
    type_key: "profile_change",
    subject_type: "user",
    subject_id: "123e4567-e89b-12d3-a456-426614174000",
    payload: { phone: "+919876543210" },
    idempotency_key: "idem-12345",
    summary: "Update phone number",
  };
  const res = ApprovalSubmitInputSchema.safeParse(valid);
  assert.equal(res.success, true);
});

test("ApprovalSubmitInputSchema rejects missing required type_key", () => {
  const invalid = {
    type_key: "",
    subject_type: "user",
    payload: {},
  };
  const res = ApprovalSubmitInputSchema.safeParse(invalid);
  assert.equal(res.success, false);
});

test("ApprovalDecideInputSchema validates approve and reject decisions", () => {
  const approveRes = ApprovalDecideInputSchema.safeParse({
    request_id: "123e4567-e89b-12d3-a456-426614174000",
    decision: "approve",
    expected_version: 1,
  });
  assert.equal(approveRes.success, true);

  const rejectRes = ApprovalDecideInputSchema.safeParse({
    request_id: "123e4567-e89b-12d3-a456-426614174000",
    decision: "reject",
    note: "Document photo is blurry, please retake",
  });
  assert.equal(rejectRes.success, true);
});

test("ApprovalDecideInputSchema rejects invalid decision keyword", () => {
  const invalid = {
    request_id: "123e4567-e89b-12d3-a456-426614174000",
    decision: "pending",
  };
  const res = ApprovalDecideInputSchema.safeParse(invalid);
  assert.equal(res.success, false);
});

test("ProfileChangePayloadSchema enforces non-empty changes", () => {
  const emptyRes = ProfileChangePayloadSchema.safeParse({
    target_user_id: "123e4567-e89b-12d3-a456-426614174000",
    changes: {},
  });
  assert.equal(emptyRes.success, false);

  const validRes = ProfileChangePayloadSchema.safeParse({
    target_user_id: "123e4567-e89b-12d3-a456-426614174000",
    changes: {
      phone: { old_value: "9999999999", new_value: "9876543210" },
    },
  });
  assert.equal(validRes.success, true);
});

test("DocumentReplacePayloadSchema validates storage paths", () => {
  const valid = {
    document_type_code: "driving_license",
    user_id: "123e4567-e89b-12d3-a456-426614174000",
    staging_path: "replacement/user123/license.jpg",
    staging_thumb_path: "replacement/user123/license_thumb.jpg",
  };
  const res = DocumentReplacePayloadSchema.safeParse(valid);
  assert.equal(res.success, true);
});

test("AccountDeletionPayloadSchema validates reason and source", () => {
  const valid = {
    user_id: "123e4567-e89b-12d3-a456-426614174000",
    reason: "Leaving company",
    source: "mobile",
  };
  const res = AccountDeletionPayloadSchema.safeParse(valid);
  assert.equal(res.success, true);
});
