import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateDocumentUpload,
  MAX_DOCUMENT_FILE_SIZE_BYTES,
  ALLOWED_DOCUMENT_MIMES,
} from "./document-upload-validation.ts";

test("validates file size limit strictly at 2MB", () => {
  const fakeFileUnder = {
    size: 2 * 1024 * 1024,
    type: "image/jpeg",
  } as unknown as File;

  const validRes = validateDocumentUpload(fakeFileUnder, true, "Aadhaar document");
  assert.equal(validRes.error, undefined);
  assert.equal(validRes.safeExt, ".jpg");

  const fakeFileOver = {
    size: 2 * 1024 * 1024 + 1,
    type: "image/jpeg",
  } as unknown as File;

  const overRes = validateDocumentUpload(fakeFileOver, true, "Aadhaar document");
  assert.ok(overRes.error?.includes("smaller than 2 MB"));
});

test("enforces strict MIME type whitelist", () => {
  const disallowedTypes = [
    "text/html",
    "application/javascript",
    "application/x-msdownload",
    "image/gif",
    "image/svg+xml",
  ];

  for (const mime of disallowedTypes) {
    const fakeFile = {
      size: 1024,
      type: mime,
    } as unknown as File;

    const res = validateDocumentUpload(fakeFile, true, "Document");
    assert.ok(
      res.error?.includes("valid document file"),
      `MIME "${mime}" must be rejected`
    );
  }
});

test("whitelisted MIME types return correct safe extensions", () => {
  const mappings: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
  };

  for (const [mime, expectedExt] of Object.entries(mappings)) {
    const fakeFile = {
      size: 1024,
      type: mime,
    } as unknown as File;

    const res = validateDocumentUpload(fakeFile, true, "Document");
    assert.equal(res.error, undefined);
    assert.equal(res.safeExt, expectedExt);
  }
});

test("handles required vs optional empty files", () => {
  const requiredRes = validateDocumentUpload(null, true, "Aadhaar");
  assert.equal(requiredRes.error, "Aadhaar is required.");

  const optionalRes = validateDocumentUpload(null, false, "License");
  assert.equal(optionalRes.error, undefined);
  assert.equal(optionalRes.safeExt, undefined);
});
