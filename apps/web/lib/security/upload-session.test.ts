import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  createUploadSessionToken,
  verifyUploadSessionToken,
} from "./upload-session.ts";

test("createUploadSessionToken creates a token with <uuid>.<expiry>.<hmac>", () => {
  const token = createUploadSessionToken();
  assert.equal(typeof token, "string");
  const parts = token.split(".");
  assert.equal(parts.length, 3);

  const [uuid, expiryStr, hmac] = parts;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.match(uuid, uuidRegex);

  const expiry = Number(expiryStr);
  assert.ok(Number.isFinite(expiry));
  assert.ok(expiry > Date.now());

  assert.equal(typeof hmac, "string");
  assert.equal(hmac.length, 64); // SHA-256 hex string
});

test("createUploadSessionToken accepts custom valid UUID for existing session reuse", () => {
  const customUuid = "550e8400-e29b-41d4-a716-446655440000";
  const token = createUploadSessionToken(customUuid);
  const parts = token.split(".");
  assert.equal(parts[0], customUuid);
});

test("verifyUploadSessionToken verifies a freshly created token", () => {
  const token = createUploadSessionToken();
  const res = verifyUploadSessionToken(token);
  assert.equal(res.valid, true);
  if (res.valid) {
    assert.equal(typeof res.uuid, "string");
    assert.ok(res.expiry > Date.now());
  }
});

test("verifyUploadSessionToken rejects tampered uuid", () => {
  const token = createUploadSessionToken();
  const parts = token.split(".");
  const tampered = `00000000-0000-4000-8000-000000000000.${parts[1]}.${parts[2]}`;
  const res = verifyUploadSessionToken(tampered);
  assert.equal(res.valid, false);
});

test("verifyUploadSessionToken rejects tampered expiry", () => {
  const token = createUploadSessionToken();
  const parts = token.split(".");
  const tamperedExpiry = Number(parts[1]) + 1000;
  const tampered = `${parts[0]}.${tamperedExpiry}.${parts[2]}`;
  const res = verifyUploadSessionToken(tampered);
  assert.equal(res.valid, false);
});

test("verifyUploadSessionToken rejects tampered hmac signature", () => {
  const token = createUploadSessionToken();
  const parts = token.split(".");
  const tamperedHmac = "a".repeat(64);
  const tampered = `${parts[0]}.${parts[1]}.${tamperedHmac}`;
  const res = verifyUploadSessionToken(tampered);
  assert.equal(res.valid, false);
});

test("verifyUploadSessionToken rejects expired tokens", () => {
  // Create token with negative TTL
  const expiredToken = createUploadSessionToken(undefined, -10000);
  const res = verifyUploadSessionToken(expiredToken);
  assert.equal(res.valid, false);
  if (!res.valid) {
    assert.match(res.error, /expired/i);
  }
});

test("verifyUploadSessionToken rejects malformed strings", () => {
  assert.equal(verifyUploadSessionToken("").valid, false);
  assert.equal(verifyUploadSessionToken(null).valid, false);
  assert.equal(verifyUploadSessionToken(undefined).valid, false);
  assert.equal(verifyUploadSessionToken("not-a-token").valid, false);
  assert.equal(verifyUploadSessionToken("part1.part2").valid, false);
  assert.equal(verifyUploadSessionToken("part1.part2.part3.part4").valid, false);
  assert.equal(verifyUploadSessionToken("invalid-uuid.123456789.hmac").valid, false);
});
