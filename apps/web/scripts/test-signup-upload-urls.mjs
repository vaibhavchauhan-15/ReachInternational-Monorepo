import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  createUploadSessionToken,
  verifyUploadSessionToken,
} from "../lib/security/upload-session.ts";
import {
  DOC_UPLOAD,
  stagingPath,
  isDocType,
  DOCUMENT_ERROR_MESSAGES,
} from "../../../packages/utils/src/documents.ts";
import { SignupUploadUrlRequestSchema } from "../../../packages/validation/src/documents.ts";

const SUPABASE_URL = "https://vlmxciuogczumumrwyot.supabase.co";
const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsbXhjaXVvZ2N6dW11bXJ3eW90Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODMyNDgwNiwiZXhwIjoyMDkzOTAwODA2fQ.2Z8Fiptbf7vqMHI5TsJ8-RPD4JHC5oFMPHn0BP-3mDY";

process.env.UPLOAD_SESSION_SECRET = "reach-test-upload-session-secret-2026";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runTests() {
  console.log("=== PHASE 3 ACCEPTANCE TEST SUITE: SIGNUP UPLOAD ARCHITECTURE ===\n");

  const cleanupPaths = [];

  try {
    // 1. Session Token Lifecycle (Generation & Structure)
    console.log("[Test 1] Session token format: <uuid>.<expiryEpoch>.<hmac> (2h TTL)...");
    const sessionToken = createUploadSessionToken();
    assert.equal(typeof sessionToken, "string");
    const parts = sessionToken.split(".");
    assert.equal(parts.length, 3, "Token must consist of exactly 3 parts separated by dots");

    const [uuid, expiryStr, hmac] = parts;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    assert.match(uuid, uuidRegex, "Part 1 must be a valid UUIDv4");
    const expiry = Number(expiryStr);
    assert.ok(Number.isFinite(expiry), "Part 2 must be finite timestamp");
    assert.ok(expiry > Date.now(), "Expiry must be in the future");
    assert.equal(hmac.length, 64, "Part 3 must be a 64-char SHA-256 HMAC hex string");
    console.log(`  ✓ Created valid session token for staging UUID: ${uuid}`);

    // 2. Session Verification
    console.log("[Test 2] Session token cryptographic verification & tamper-proofing...");
    const verifyValid = verifyUploadSessionToken(sessionToken);
    assert.equal(verifyValid.valid, true);
    if (verifyValid.valid) {
      assert.equal(verifyValid.uuid, uuid);
    }
    console.log("  ✓ Valid session token verified successfully");

    // 3. Tampering Rejection
    console.log("[Test 3] Rejection of tampered session tokens...");
    const tamperedHmac = `${uuid}.${expiryStr}.${"a".repeat(64)}`;
    assert.equal(verifyUploadSessionToken(tamperedHmac).valid, false);

    const tamperedUuid = `00000000-0000-4000-8000-000000000000.${expiryStr}.${hmac}`;
    assert.equal(verifyUploadSessionToken(tamperedUuid).valid, false);

    const tamperedExpiry = `${uuid}.${expiry + 1000}.${hmac}`;
    assert.equal(verifyUploadSessionToken(tamperedExpiry).valid, false);
    console.log("  ✓ Cryptographic verification rejected all tampered variations");

    // 4. Expired Token Rejection
    console.log("[Test 4] Rejection of expired session tokens...");
    const expiredToken = createUploadSessionToken(undefined, -10000);
    const verifyExpired = verifyUploadSessionToken(expiredToken);
    assert.equal(verifyExpired.valid, false);
    if (!verifyExpired.valid) {
      assert.match(verifyExpired.error, /expired/i);
    }
    console.log("  ✓ Expired session token rejected with clear user-facing error");

    // 5. Schema Validation for Inbound Payloads
    console.log("[Test 5] Inbound payload validation against canonical DOC_UPLOAD types...");
    const initialReq = { docType: "aadhaar" };
    const parsedInitial = SignupUploadUrlRequestSchema.safeParse(initialReq);
    assert.equal(parsedInitial.success, true);
    assert.equal(parsedInitial.data?.docType, "aadhaar");

    const subsequentReq = { session: sessionToken, docType: "driving_license" };
    const parsedSubsequent = SignupUploadUrlRequestSchema.safeParse(subsequentReq);
    assert.equal(parsedSubsequent.success, true);
    assert.equal(parsedSubsequent.data?.session, sessionToken);

    const invalidReq = { docType: "passport" };
    const parsedInvalid = SignupUploadUrlRequestSchema.safeParse(invalidReq);
    assert.equal(parsedInvalid.success, false);
    console.log("  ✓ Zod validation strictly enforces allowed document types");

    // 6. Supabase Storage `createSignedUploadUrl` for Staging
    console.log("[Test 6] Generate pre-signed upload URLs on bucket `doc_staging`...");
    const mainPath = stagingPath(`signup/${uuid}`, "aadhaar", false);
    const thumbPath = stagingPath(`signup/${uuid}`, "aadhaar", true);
    cleanupPaths.push(mainPath, thumbPath);

    const [mainRes, thumbRes] = await Promise.all([
      admin.storage.from("doc_staging").createSignedUploadUrl(mainPath, { upsert: true }),
      admin.storage.from("doc_staging").createSignedUploadUrl(thumbPath, { upsert: true }),
    ]);

    assert.ok(!mainRes.error && mainRes.data?.signedUrl, `Main signed URL failed: ${mainRes.error?.message}`);
    assert.ok(!thumbRes.error && thumbRes.data?.signedUrl, `Thumb signed URL failed: ${thumbRes.error?.message}`);
    assert.equal(mainRes.data.path, `signup/${uuid}/aadhaar.jpg`);
    assert.equal(thumbRes.data.path, `signup/${uuid}/aadhaar_thumb.jpg`);
    console.log(`  ✓ Generated main signed upload URL: ${mainRes.data.path}`);
    console.log(`  ✓ Generated thumb signed upload URL: ${thumbRes.data.path}`);

    // 7. Direct Upload to Supabase Storage (Zero Byte Pass-Through Proof)
    console.log("[Test 7] Direct binary upload (PUT) to Supabase Storage (zero server bytes)...");
    const testJpegHeader = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60,
      0x00, 0x60, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
      0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
      0xff, 0xd9,
    ]);

    const uploadMain = await fetch(mainRes.data.signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": DOC_UPLOAD.mime,
        "x-upsert": "true",
      },
      body: testJpegHeader,
    });
    assert.equal(uploadMain.status, 200, `Direct upload failed with HTTP ${uploadMain.status}`);

    const uploadThumb = await fetch(thumbRes.data.signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": DOC_UPLOAD.mime,
        "x-upsert": "true",
      },
      body: testJpegHeader,
    });
    assert.equal(uploadThumb.status, 200, `Thumbnail direct upload failed with HTTP ${uploadThumb.status}`);
    console.log("  ✓ Direct client-to-storage upload succeeded with HTTP 200 (Vercel bypassed)");

    // 8. Storage Verification
    console.log("[Test 8] Verify staged files exist in bucket `doc_staging`...");
    const { data: downloadedMain, error: dlErrMain } = await admin.storage
      .from("doc_staging")
      .download(mainPath);
    assert.ok(!dlErrMain, `Download main failed: ${dlErrMain?.message}`);
    assert.equal(downloadedMain.size, testJpegHeader.length);

    const { data: downloadedThumb, error: dlErrThumb } = await admin.storage
      .from("doc_staging")
      .download(thumbPath);
    assert.ok(!dlErrThumb, `Download thumb failed: ${dlErrThumb?.message}`);
    assert.equal(downloadedThumb.size, testJpegHeader.length);
    console.log("  ✓ Both main file and thumbnail verified in `doc_staging` storage");

    // 9. Session Continuity for Subsequent Documents
    console.log("[Test 9] Session continuity: second document in same staging session...");
    const verifiedSession = verifyUploadSessionToken(sessionToken);
    assert.equal(verifiedSession.valid, true);
    if (verifiedSession.valid) {
      const secondMainPath = stagingPath(`signup/${verifiedSession.uuid}`, "driving_license", false);
      const secondThumbPath = stagingPath(`signup/${verifiedSession.uuid}`, "driving_license", true);
      cleanupPaths.push(secondMainPath, secondThumbPath);

      assert.equal(secondMainPath, `signup/${uuid}/driving_license.jpg`);
      assert.equal(secondThumbPath, `signup/${uuid}/driving_license_thumb.jpg`);
      console.log(`  ✓ Correctly preserved staging prefix for second document: signup/${uuid}`);
    }

    // 10. Third Document in Same Session
    console.log("[Test 10] Session continuity: third document in same staging session...");
    if (verifiedSession.valid) {
      const thirdMainPath = stagingPath(`signup/${verifiedSession.uuid}`, "bank_document", false);
      const thirdThumbPath = stagingPath(`signup/${verifiedSession.uuid}`, "bank_document", true);
      cleanupPaths.push(thirdMainPath, thirdThumbPath);

      assert.equal(thirdMainPath, `signup/${uuid}/bank_document.jpg`);
      assert.equal(thirdThumbPath, `signup/${uuid}/bank_document_thumb.jpg`);
      console.log(`  ✓ Correctly preserved staging prefix for third document: signup/${uuid}`);
    }

    console.log("\nALL 10 VERIFICATION CHECKS PASSED WITH 100% SUCCESS!");
  } finally {
    // Cleanup any staged test files
    if (cleanupPaths.length > 0) {
      console.log(`\nCleaning up ${cleanupPaths.length} test files from doc_staging...`);
      await admin.storage.from("doc_staging").remove(cleanupPaths);
      console.log("✓ Cleanup completed.");
    }
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
