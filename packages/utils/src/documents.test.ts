import test from "node:test";
import assert from "node:assert/strict";
import {
  DOC_UPLOAD,
  stagingPath,
  finalDocumentPath,
  isDocType,
  DOCUMENT_ERROR_MESSAGES,
  fetchSignupUploadUrl,
} from "./documents.ts";

test("DOC_UPLOAD specifications match exact architectural requirements", () => {
  assert.deepEqual(DOC_UPLOAD.docTypes, ["bank_document", "aadhaar", "driving_license"]);
  assert.equal(DOC_UPLOAD.maxEdge, 2400);
  assert.equal(DOC_UPLOAD.thumbEdge, 480);
  assert.equal(DOC_UPLOAD.minShortEdge, 600);
  assert.equal(DOC_UPLOAD.quality, 0.92);
  assert.equal(DOC_UPLOAD.thumbQuality, 0.82);
  assert.equal(DOC_UPLOAD.targetBytes, 800000);
  assert.equal(DOC_UPLOAD.maxBytes, 2500000);
  assert.equal(DOC_UPLOAD.mime, "image/jpeg");
});

test("stagingPath generates expected staging and thumbnail file paths", () => {
  const session = "staging/abc-123";
  assert.equal(stagingPath(session, "aadhaar", false), "staging/abc-123/aadhaar.jpg");
  assert.equal(stagingPath(session, "aadhaar", true), "staging/abc-123/aadhaar_thumb.jpg");
  assert.equal(stagingPath(session, "bank_document", false), "staging/abc-123/bank_document.jpg");
  assert.equal(stagingPath(session, "driving_license", true), "staging/abc-123/driving_license_thumb.jpg");
});

test("finalDocumentPath generates versioned, immutable storage paths", () => {
  const userId = "u-456";
  const fileId = "uuid-789";
  assert.equal(
    finalDocumentPath(userId, "bank_document", fileId, false),
    "documents/u-456/bank_document/uuid-789.jpg"
  );
  assert.equal(
    finalDocumentPath(userId, "bank_document", fileId, true),
    "documents/u-456/bank_document/uuid-789_thumb.jpg"
  );
});

test("isDocType correctly validates allowed doc types", () => {
  assert.equal(isDocType("aadhaar"), true);
  assert.equal(isDocType("bank_document"), true);
  assert.equal(isDocType("driving_license"), true);
  assert.equal(isDocType("passport"), false);
  assert.equal(isDocType(""), false);
  assert.equal(isDocType(null), false);
});

test("DOCUMENT_ERROR_MESSAGES provides standardized cross-platform strings", () => {
  assert.ok(DOCUMENT_ERROR_MESSAGES.INVALID_DOC_TYPE);
  assert.ok(DOCUMENT_ERROR_MESSAGES.IMAGE_TOO_LARGE);
  assert.ok(DOCUMENT_ERROR_MESSAGES.DIMENSIONS_TOO_SMALL);
  assert.ok(DOCUMENT_ERROR_MESSAGES.UNSUPPORTED_MIME);
  assert.ok(DOCUMENT_ERROR_MESSAGES.UPLOAD_FAILED);
  assert.ok(DOCUMENT_ERROR_MESSAGES.UNAUTHORIZED_VIEW);
});

test("fetchSignupUploadUrl correctly dispatches request to /api/signup/upload-urls", async () => {
  const originalFetch = globalThis.fetch;
  try {
    let capturedUrl = "";
    let capturedBody = "";

    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      capturedUrl = String(input);
      capturedBody = String(init?.body);
      return {
        ok: true,
        json: async () => ({
          session: "session-123.9999.sig",
          main: { path: "signup/123/aadhaar.jpg", token: "tok1", signedUrl: "https://example.com/tok1" },
          thumb: { path: "signup/123/aadhaar_thumb.jpg", token: "tok2", signedUrl: "https://example.com/tok2" },
        }),
      } as Response;
    };

    const res = await fetchSignupUploadUrl({
      baseUrl: "http://localhost:3000",
      session: "session-123.9999.sig",
      docType: "aadhaar",
    });

    assert.equal(capturedUrl, "http://localhost:3000/api/signup/upload-urls");
    assert.deepEqual(JSON.parse(capturedBody), {
      session: "session-123.9999.sig",
      docType: "aadhaar",
    });
    assert.equal(res.session, "session-123.9999.sig");
    assert.equal(res.main.token, "tok1");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

