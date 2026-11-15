import test from "node:test";
import assert from "node:assert/strict";
import {
  StagingUploadRequestSchema,
  DocumentChangeRequestSchema,
  SignupUploadUrlRequestSchema,
} from "./documents.ts";

test("StagingUploadRequestSchema validates valid payload", () => {
  const valid = {
    sessionId: "123e4567-e89b-12d3-a456-426614174000",
    docTypes: ["bank_document", "aadhaar"],
  };
  const result = StagingUploadRequestSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("StagingUploadRequestSchema rejects invalid UUID or docType", () => {
  const invalidSession = {
    sessionId: "not-a-uuid",
    docTypes: ["aadhaar"],
  };
  assert.equal(StagingUploadRequestSchema.safeParse(invalidSession).success, false);

  const invalidType = {
    sessionId: "123e4567-e89b-12d3-a456-426614174000",
    docTypes: ["passport"],
  };
  assert.equal(StagingUploadRequestSchema.safeParse(invalidType).success, false);
});

test("DocumentChangeRequestSchema validates replacement request", () => {
  const valid = {
    document_type_code: "driving_license",
    staging_path: "staging/session-1/driving_license.jpg",
    staging_thumb_path: "staging/session-1/driving_license_thumb.jpg",
  };
  const result = DocumentChangeRequestSchema.safeParse(valid);
  assert.equal(result.success, true);
});

test("SignupUploadUrlRequestSchema validates first request without session", () => {
  const validFirst = {
    docType: "aadhaar",
  };
  const result = SignupUploadUrlRequestSchema.safeParse(validFirst);
  assert.equal(result.success, true);
  assert.equal(result.data?.docType, "aadhaar");
  assert.equal(result.data?.session, undefined);
});

test("SignupUploadUrlRequestSchema validates request with session token", () => {
  const validNext = {
    session: "550e8400-e29b-41d4-a716-446655440000.1794680000000.abcdef1234567890",
    docType: "driving_license",
    turnstileToken: "cf-turnstile-token-abc",
  };
  const result = SignupUploadUrlRequestSchema.safeParse(validNext);
  assert.equal(result.success, true);
  assert.equal(result.data?.docType, "driving_license");
});

test("SignupUploadUrlRequestSchema rejects invalid docType", () => {
  const invalid = {
    docType: "voter_id",
  };
  const result = SignupUploadUrlRequestSchema.safeParse(invalid);
  assert.equal(result.success, false);
});

