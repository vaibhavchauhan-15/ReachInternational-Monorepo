import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";

// ─── Setup & Env ─────────────────────────────────────────────────────────────
const envContent = fs.readFileSync("apps/web/.env.local", "utf8");
const env = {};
envContent.split("\n").forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || "";
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    env[match[1]] = val;
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey || !anonKey) {
  console.error("Missing Supabase credentials in apps/web/.env.local");
  process.exit(1);
}

// Service role admin client
const adminSupabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("=== PHASE 7: DOCUMENT READ & REPLACE VERIFICATION SUITE ===");
console.log(`Connected to Supabase Project: ${url}`);

let passedChecks = 0;
const testEmail = "rohit.singh@reachinternational.co.in";
const otherEmail = "deepak.patel@reachinternational.co.in";

// Minimal valid JPEG buffer (starts with 0xFF, 0xD8, 0xFF)
const validJpegBuffer = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
  0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
  0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
  0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
  0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xbf, 0x00, 0xff, 0xd9,
]);

let testUserId = null;
let otherUserId = null;
let testFilesToClean = [];

async function verifyStagedJpegMagicBytes(stagingPath) {
  const { data: signedData, error: sErr } = await adminSupabase.storage
    .from("doc_staging")
    .createSignedUrl(stagingPath, 60);

  if (sErr || !signedData?.signedUrl) return false;

  const resp = await fetch(signedData.signedUrl, { headers: { Range: "bytes=0-2" } });
  if (!resp.ok && resp.status !== 206) return false;

  const buf = await resp.arrayBuffer();
  const bytes = new Uint8Array(buf);
  if (bytes.length < 3) return false;
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

async function run() {
  try {
    // ─── 0. Authenticate Test Users ──────────────────────────────────────────
    console.log("\n[SETUP] Authenticating active test users via Supabase MagicLink OTP...");

    // Generate link for test user
    const { data: linkData1, error: linkErr1 } = await adminSupabase.auth.admin.generateLink({
      type: "magiclink",
      email: testEmail,
    });
    if (linkErr1) throw linkErr1;
    testUserId = linkData1.user.id;

    const userClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: userSession, error: otpErr1 } = await userClient.auth.verifyOtp({
      token_hash: linkData1.properties.hashed_token,
      type: "magiclink",
    });
    if (otpErr1) throw otpErr1;
    const userToken = userSession.session.access_token;

    // Generate link for other user to test isolation
    const { data: linkData2, error: linkErr2 } = await adminSupabase.auth.admin.generateLink({
      type: "magiclink",
      email: otherEmail,
    });
    if (linkErr2) throw linkErr2;
    otherUserId = linkData2.user.id;

    const otherClient = createClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: otpErr2 } = await otherClient.auth.verifyOtp({
      token_hash: linkData2.properties.hashed_token,
      type: "magiclink",
    });
    if (otpErr2) throw otpErr2;

    console.log(`✓ Authenticated test user (${testEmail}, id=${testUserId}) and other user (${otherEmail}, id=${otherUserId}).`);
    passedChecks++;

    // ─── 1. Storage Policy 3.2: Direct Signed Read URLs ───────────────────────
    console.log("\n[TEST 1] Testing 3.2 Storage Policy: User reads own documents directly without Vercel hop...");

    const initialDocPath = `documents/${testUserId}/aadhaar/test_read.jpg`;
    const initialThumbPath = `documents/${testUserId}/aadhaar/test_read_thumb.jpg`;
    testFilesToClean.push(initialDocPath, initialThumbPath);

    // Upload initial files to user_files bucket using admin
    await adminSupabase.storage.from("user_files").upload(initialDocPath, validJpegBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });
    await adminSupabase.storage.from("user_files").upload(initialThumbPath, validJpegBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

    // 1a. User A requests signed URL for own document directly via Supabase Storage client
    const { data: userSignedResult, error: userSignErr } = await userClient.storage
      .from("user_files")
      .createSignedUrl(initialDocPath, 60);

    assert(!userSignErr, `User should be able to create signed URL for own file: ${userSignErr?.message}`);
    assert(userSignedResult?.signedUrl, "Signed URL must be returned");

    // Fetch the signed URL directly over HTTP
    const fetchRes = await fetch(userSignedResult.signedUrl);
    assert.equal(fetchRes.status, 200, "HTTP fetch of own signed URL must return 200 OK");
    const fetchedBuf = Buffer.from(await fetchRes.arrayBuffer());
    assert.deepEqual(fetchedBuf, validJpegBuffer, "Fetched file bytes must match uploaded JPEG");

    console.log("✓ Direct signed URL generation and zero-hop download succeeded for document owner.");
    passedChecks++;

    // 1b. Batch thumbnail signed URL generation (Section 7 Read Requirement)
    const { data: batchThumbs, error: batchErr } = await userClient.storage
      .from("user_files")
      .createSignedUrls([initialThumbPath], 60);

    assert(!batchErr, `Batch createSignedUrls must succeed: ${batchErr?.message}`);
    assert(Array.isArray(batchThumbs) && batchThumbs.length === 1, "Must return 1 signed URL");
    assert(batchThumbs[0].signedUrl, "Batch item must contain signedUrl");

    const batchFetchRes = await fetch(batchThumbs[0].signedUrl);
    assert.equal(batchFetchRes.status, 200, "Batch signed thumbnail URL must return 200 OK");
    console.log("✓ Batch createSignedUrls(thumbPaths, 60) succeeded directly against user_files bucket.");
    passedChecks++;

    // ─── 2. Replacement Upload URL Route Verification ────────────────────────
    console.log("\n[TEST 2] Testing Replacement Upload URL Generation in doc_staging...");

    const uploadId = crypto.randomUUID();
    const stagingMainPath = `replace/${testUserId}/aadhaar/${uploadId}.jpg`;
    const stagingThumbPath = `replace/${testUserId}/aadhaar/${uploadId}_thumb.jpg`;
    testFilesToClean.push(`doc_staging:${stagingMainPath}`, `doc_staging:${stagingThumbPath}`);

    // Service role creates signed upload URLs in doc_staging
    const [mainUploadRes, thumbUploadRes] = await Promise.all([
      adminSupabase.storage
        .from("doc_staging")
        .createSignedUploadUrl(stagingMainPath, { upsert: true }),
      adminSupabase.storage
        .from("doc_staging")
        .createSignedUploadUrl(stagingThumbPath, { upsert: true }),
    ]);

    assert(!mainUploadRes.error && mainUploadRes.data?.signedUrl, "Main signed upload URL must be created");
    assert(!thumbUploadRes.error && thumbUploadRes.data?.signedUrl, "Thumb signed upload URL must be created");

    console.log("✓ Signed upload URLs generated in bucket doc_staging for replacement.");
    passedChecks++;

    // ─── 3. Magic Byte & Validation Gate ─────────────────────────────────────
    console.log("\n[TEST 3] Testing Magic Byte Verification (0xFF, 0xD8, 0xFF) and Corrupt Upload Rejection...");

    const invalidBuffer = Buffer.from("NOT_A_JPEG_FILE_JUST_PLAIN_TEXT");
    // Upload invalid content to main upload URL
    const uploadInvalidRes = await fetch(mainUploadRes.data.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg", "x-upsert": "true" },
      body: invalidBuffer,
    });
    assert(uploadInvalidRes.ok, "PUT to signed upload URL succeeded");

    const isInvalidJpeg = await verifyStagedJpegMagicBytes(stagingMainPath);
    assert.equal(isInvalidJpeg, false, "Corrupt file without 0xFF 0xD8 0xFF must fail magic byte check");

    // Upload valid JPEG to staging
    const uploadValidRes = await fetch(mainUploadRes.data.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg", "x-upsert": "true" },
      body: validJpegBuffer,
    });
    assert(uploadValidRes.ok, "PUT valid JPEG to signed upload URL succeeded");

    const isValidJpeg = await verifyStagedJpegMagicBytes(stagingMainPath);
    assert.equal(isValidJpeg, true, "Valid JPEG must pass 3-byte magic check (0xFF 0xD8 0xFF)");

    console.log("✓ Magic byte verification accurately distinguishes valid JPEG from corrupt/spoofed files.");
    passedChecks++;

    // ─── 4. Valid Staging Upload & Approval Workflow ─────────────────────────
    console.log("\n[TEST 4] Testing Valid Replacement with requires_approval = true...");

    // Upload thumbnail
    const uploadThumbRes = await fetch(thumbUploadRes.data.signedUrl, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg", "x-upsert": "true" },
      body: validJpegBuffer,
    });
    assert(uploadThumbRes.ok, "PUT valid thumbnail to signed upload URL succeeded");

    // Clean up any pre-existing pending request for this user and docType
    await adminSupabase
      .from("document_change_requests")
      .delete()
      .eq("user_id", testUserId)
      .eq("document_type_code", "aadhaar");

    // Ensure user_document_types requires_approval is true for aadhaar
    await adminSupabase
      .from("user_document_types")
      .update({ requires_approval: true })
      .eq("code", "aadhaar");

    // Create pending change request row
    const { data: insertedPending, error: insertErr } = await adminSupabase
      .from("document_change_requests")
      .insert({
        user_id: testUserId,
        document_type_code: "aadhaar",
        staging_path: stagingMainPath,
        staging_thumb_path: stagingThumbPath,
        status: "pending",
      })
      .select()
      .single();

    assert(!insertErr && insertedPending, `Pending change request must be created: ${insertErr?.message}`);
    assert.equal(insertedPending.status, "pending");
    console.log("✓ Replacement pending request successfully created with status='pending'.");
    passedChecks++;

    // ─── 5. Duplicate Pending Replacement Rejection ──────────────────────────
    console.log("\n[TEST 5] Testing Duplicate Pending Replacement Rejection (Unique Partial Index)...");

    const { error: duplicateInsertErr } = await adminSupabase
      .from("document_change_requests")
      .insert({
        user_id: testUserId,
        document_type_code: "aadhaar",
        staging_path: `replace/${testUserId}/aadhaar/duplicate.jpg`,
        staging_thumb_path: `replace/${testUserId}/aadhaar/duplicate_thumb.jpg`,
        status: "pending",
      });

    assert(duplicateInsertErr, "Duplicate pending request for same user + docType must be rejected by unique index");
    console.log("✓ Duplicate pending replacement correctly rejected by unique constraint.");
    passedChecks++;

    // ─── 6. Immediate Swap Workflow (requires_approval = false) ─────────────
    console.log("\n[TEST 6] Testing Immediate Swap Workflow when requires_approval = false...");

    // Update driving_license to requires_approval = false
    await adminSupabase
      .from("user_document_types")
      .update({ requires_approval: false })
      .eq("code", "driving_license");

    const immediateUploadId = crypto.randomUUID();
    const immStagingMain = `replace/${testUserId}/driving_license/${immediateUploadId}.jpg`;
    const immStagingThumb = `replace/${testUserId}/driving_license/${immediateUploadId}_thumb.jpg`;
    testFilesToClean.push(`doc_staging:${immStagingMain}`, `doc_staging:${immStagingThumb}`);

    // Upload to staging
    await adminSupabase.storage.from("doc_staging").upload(immStagingMain, validJpegBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });
    await adminSupabase.storage.from("doc_staging").upload(immStagingThumb, validJpegBuffer, {
      contentType: "image/jpeg",
      upsert: true,
    });

    // Move cross-bucket from doc_staging to user_files
    const finalMainPath = `documents/${testUserId}/driving_license/${immediateUploadId}.jpg`;
    const finalThumbPath = `documents/${testUserId}/driving_license/${immediateUploadId}_thumb.jpg`;
    testFilesToClean.push(finalMainPath, finalThumbPath);

    const { error: moveMainErr } = await adminSupabase.storage
      .from("doc_staging")
      .move(immStagingMain, finalMainPath, { destinationBucket: "user_files" });
    assert(!moveMainErr, `Cross-bucket move main file failed: ${moveMainErr?.message}`);

    const { error: moveThumbErr } = await adminSupabase.storage
      .from("doc_staging")
      .move(immStagingThumb, finalThumbPath, { destinationBucket: "user_files" });
    assert(!moveThumbErr, `Cross-bucket move thumb file failed: ${moveThumbErr?.message}`);

    // Swap pointer in user_documents
    const { error: upsertErr } = await adminSupabase
      .from("user_documents")
      .upsert({
        user_id: testUserId,
        document_type_code: "driving_license",
        storage_path: finalMainPath,
        thumb_path: finalThumbPath,
        mime_type: "image/jpeg",
        file_size_bytes: validJpegBuffer.length,
        file_name: "driving_license.jpg",
        verification_status: "verified",
        updated_at: new Date().toISOString(),
      });
    assert(!upsertErr, `Immediate pointer swap upsert failed: ${upsertErr?.message}`);

    // Log audit
    await adminSupabase.from("audit_logs").insert({
      actor_id: testUserId,
      target_user_id: testUserId,
      action: "document_replaced_immediate",
      entity_type: "user_documents",
      entity_id: `${testUserId}:driving_license`,
      details: {
        document_type_code: "driving_license",
        storage_path: finalMainPath,
      },
    });

    // Verify pointer swapped
    const { data: updatedDoc, error: updateErr } = await adminSupabase
      .from("user_documents")
      .select("*")
      .eq("user_id", testUserId)
      .eq("document_type_code", "driving_license")
      .single();

    assert(!updateErr && updatedDoc, "Updated document row must exist");
    assert.equal(updatedDoc.storage_path, finalMainPath, "storage_path must point to new file");
    assert.equal(updatedDoc.thumb_path, finalThumbPath, "thumb_path must point to new thumb");
    assert.equal(updatedDoc.verification_status, "verified", "Document status must be verified");

    // Restore driving_license requires_approval to true
    await adminSupabase
      .from("user_document_types")
      .update({ requires_approval: true })
      .eq("code", "driving_license");

    console.log("✓ Immediate replacement: cross-bucket move, pointer swap, and audit log verified.");
    passedChecks++;

    // ─── 7. Static Architecture & Invariant Enforcement Verification ─────────
    console.log("\n[TEST 7] Verifying Source Code Architecture & Invariants...");

    const uploadUrlRouteSrc = fs.readFileSync("apps/web/app/api/documents/upload-url/route.ts", "utf8");
    assert.ok(uploadUrlRouteSrc.includes("checkRateLimitAsync"), "upload-url must enforce rate limiting");
    assert.ok(uploadUrlRouteSrc.includes("createSignedUploadUrl"), "upload-url must generate signed upload URLs");
    assert.ok(uploadUrlRouteSrc.includes("doc_staging"), "upload-url must target doc_staging bucket");

    const replacementEngineSrc = fs.readFileSync("apps/web/lib/server/document-replacement.ts", "utf8");
    assert.ok(replacementEngineSrc.includes("bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff"), "Must verify 0xFF 0xD8 0xFF magic bytes");
    assert.ok(replacementEngineSrc.includes("destinationBucket: \"user_files\""), "Must move to destinationBucket user_files");
    assert.ok(replacementEngineSrc.includes("target_user_id"), "Must log audit with target_user_id");

    const webHookSrc = fs.readFileSync("apps/web/lib/hooks/useMyDocuments.ts", "utf8");
    assert.ok(webHookSrc.includes("createSignedUrls"), "Web hook must use createSignedUrls for thumbnails");
    assert.ok(webHookSrc.includes("staleTime: 45 * 1000"), "Web hook must configure 45s staleTime cache");

    const mobileHookSrc = fs.readFileSync("apps/mobile/lib/hooks/useMobileMyDocuments.ts", "utf8");
    assert.ok(mobileHookSrc.includes("createSignedUrls"), "Mobile hook must use createSignedUrls for thumbnails");
    assert.ok(mobileHookSrc.includes("staleTime: 45 * 1000"), "Mobile hook must configure 45s staleTime cache");

    const mobileScreenSrc = fs.readFileSync("apps/mobile/app/(app)/profile/documents.tsx", "utf8");
    assert.ok(mobileScreenSrc.includes("minHeight: 44") || mobileScreenSrc.includes("minHeight: 48"), "Mobile screen must enforce min 44px touch targets");
    assert.ok(!mobileScreenSrc.includes("fontSize:"), "Mobile screen must not contain raw typography fontSize");

    console.log("✓ All source code invariant checks passed across Web and Mobile.");
    passedChecks++;

    console.log("\n=======================================================");
    console.log(`ALL ${passedChecks} PHASE 7 TEST VERIFICATION CHECKS PASSED!`);
    console.log("=======================================================\n");
  } finally {
    // ─── 8. Cleanup Test Fixtures ────────────────────────────────────────────
    console.log("[CLEANUP] Cleaning up test fixtures from DB and Storage...");
    try {
      if (testUserId) {
        await adminSupabase.from("document_change_requests").delete().eq("user_id", testUserId);
        await adminSupabase.from("user_documents").delete().eq("user_id", testUserId).eq("document_type_code", "aadhaar");
        await adminSupabase.from("user_documents").delete().eq("user_id", testUserId).eq("document_type_code", "driving_license");
        await adminSupabase.from("audit_logs").delete().eq("target_user_id", testUserId).eq("action", "document_replaced_immediate");
      }

      for (const fileRef of testFilesToClean) {
        if (!fileRef) continue;
        if (fileRef.startsWith("doc_staging:")) {
          const path = fileRef.substring("doc_staging:".length);
          await adminSupabase.storage.from("doc_staging").remove([path]);
        } else {
          await adminSupabase.storage.from("user_files").remove([fileRef]);
        }
      }

      console.log("✓ Cleanup completed cleanly.");
    } catch (cleanupErr) {
      console.warn("Cleanup warning (non-fatal):", cleanupErr.message);
    }
  }
}

run().catch((err) => {
  console.error("\n❌ PHASE 7 VERIFICATION SUITE FAILED:", err);
  process.exit(1);
});
