import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeDatabaseError,
  classifyError,
  sanitizeUserErrorMessage,
  isAbortError,
} from "./errors.ts";

test("classifyError: identifies network errors correctly", () => {
  const res = classifyError(new Error("Failed to fetch"));
  assert.equal(res.classification, "network");
  assert.equal(res.statusCode, 503);
});

test("classifyError: identifies timeout errors correctly", () => {
  const res = classifyError({ message: "Request timed out", code: "ETIMEDOUT" });
  assert.equal(res.classification, "timeout");
  assert.equal(res.statusCode, 504);
});

test("classifyError: identifies permission/RLS errors correctly", () => {
  const res = classifyError({ code: "42501", message: "row-level security policy violation" });
  assert.equal(res.classification, "permission");
  assert.equal(res.statusCode, 403);
});

test("classifyError: identifies 404/PGRST116 as not_found", () => {
  const res = classifyError({ code: "PGRST116", message: "0 rows returned" });
  assert.equal(res.classification, "not_found");
  assert.equal(res.statusCode, 404);
});

test("classifyError: identifies duplicate key (23505) as conflict", () => {
  const res = classifyError({ code: "23505", message: "duplicate key value" });
  assert.equal(res.classification, "conflict");
  assert.equal(res.statusCode, 409);
});

test("sanitizeDatabaseError: sanitizes RLS 42501 error without leaking schema", () => {
  const res = sanitizeDatabaseError({
    code: "42501",
    message: "new row violates row-level security policy for table machines",
  });
  assert.equal(res.statusCode, 403);
  assert.ok(res.error.includes("Permission denied"));
  assert.ok(!res.error.includes("row-level security"));
});

test("sanitizeDatabaseError: sanitizes 23505 unique constraint for machine_id", () => {
  const res = sanitizeDatabaseError({
    code: "23505",
    message: 'duplicate key value violates unique constraint "machines_machine_id_key"',
  });
  assert.equal(res.statusCode, 409);
  assert.ok(res.error.includes("Machine ID already exists"));
  assert.ok(res.fieldErrors?.machine_id !== undefined);
});

test("sanitizeDatabaseError: sanitizes 23505 unique constraint for client GSTIN", () => {
  const res = sanitizeDatabaseError({
    code: "23505",
    message: 'duplicate key value violates unique constraint "clients_gstin_key"',
  });
  assert.equal(res.statusCode, 409);
  assert.ok(res.error.includes("GSTIN is already registered"));
  assert.ok(res.fieldErrors?.gstin !== undefined);
});

test("sanitizeDatabaseError: sanitizes 23503 foreign key constraint without leaking constraint names", () => {
  const res = sanitizeDatabaseError({
    code: "23503",
    message: 'update or delete on table "machines" violates foreign key constraint "fk_machine"',
  });
  assert.equal(res.statusCode, 409);
  assert.ok(res.error.includes("Cannot complete operation"));
  assert.ok(!res.error.includes("fk_machine"));
});

test("sanitizeDatabaseError: sanitizes 23514 check constraint for hour meter range", () => {
  const res = sanitizeDatabaseError({
    code: "23514",
    message: 'violates check constraint "chk_machine_hour_logs_meter_range"',
  });
  assert.equal(res.statusCode, 400);
  assert.ok(
    res.error.includes("Ending hour meter reading cannot be less than starting hour meter reading")
  );
});

test("sanitizeUserErrorMessage: scrubs raw SQL syntax messages", () => {
  const msg = sanitizeUserErrorMessage('error: (SQLSTATE 42601) syntax error at or near "SELECT"');
  assert.ok(!msg.includes("SQLSTATE"));
  assert.ok(!msg.includes("SELECT"));
});

test("sanitizeUserErrorMessage: preserves safe plain text messages", () => {
  const msg = sanitizeUserErrorMessage("Please check your email address.");
  assert.equal(msg, "Please check your email address.");
});

test("isAbortError: detects Supabase postgrest AbortError correctly", () => {
  const supabaseAbortError = {
    message: "AbortError: signal is aborted without reason",
    details: "AbortError: signal is aborted without reason\n    at Object.onCancel",
    hint: "Request was aborted (timeout or manual cancellation)",
    code: "",
  };
  assert.equal(isAbortError(supabaseAbortError), true);
});

test("isAbortError: detects signal.aborted = true even if error is generic", () => {
  const controller = new AbortController();
  controller.abort();
  assert.equal(isAbortError(new Error("Generic error"), controller.signal), true);
});

test("isAbortError: detects DOMException AbortError", () => {
  const domAbort = new DOMException("The user aborted a request.", "AbortError");
  assert.equal(isAbortError(domAbort), true);
});

test("isAbortError: returns false for actual database or network errors", () => {
  assert.equal(isAbortError({ code: "42501", message: "permission denied" }), false);
  assert.equal(isAbortError(new Error("Failed to fetch")), false);
  assert.equal(isAbortError(null), false);
  assert.equal(isAbortError(undefined), false);
});
