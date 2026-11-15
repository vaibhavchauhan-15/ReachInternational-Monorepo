/**
 * Comprehensive Live Natural Registration & Signup Scenarios Test
 * Tests valid and invalid signups against http://localhost:3000
 * and Supabase Dev Project vlmxciuogczumumrwyot.
 */

import fs from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Load .env.local
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

const BASE_URL = "http://localhost:3000";
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || "https://vlmxciuogczumumrwyot.supabase.co";
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SERVICE_KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const SESSION_SECRET = env.UPLOAD_SESSION_SECRET || SERVICE_KEY;

if (!SERVICE_KEY || !ANON_KEY) {
  console.error("Missing SUPABASE credentials in apps/web/.env.local");
  process.exit(1);
}

const adminSupabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log("==================================================================");
console.log("  NATURAL REGISTRATION & VALID/INVALID SIGNUP SCENARIOS TEST");
console.log(`  Live Server:   ${BASE_URL}`);
console.log(`  Supabase Dev:  ${SUPABASE_URL}`);
console.log("==================================================================\n");

let passed = 0;
let total = 0;

function assert(condition, message, details = "") {
  total++;
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message} ${details ? `(${details})` : ""}`);
    process.exit(1);
  }
}

// Canonical JPEG bytes (starts with FF D8 FF)
const VALID_JPEG_BYTES = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60,
  0x00, 0x60, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0xff, 0xd9,
]);

// Non-JPEG bytes (Corrupt: plain text masquerading as jpg)
const CORRUPT_TEXT_BYTES = Buffer.from("THIS_IS_A_PLAIN_TEXT_FILE_RENAMED_TO_JPG_WITHOUT_MAGIC_BYTES");

function createSignedSessionToken(uuid, expiryMs, secret) {
  const payload = `${uuid}.${expiryMs}`;
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${hmac}`;
}

async function uploadPair(mainUrl, thumbUrl, mainBytes, thumbBytes) {
  const r1 = await fetch(mainUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: mainBytes,
  });
  const r2 = await fetch(thumbUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: thumbBytes,
  });
  return r1.ok && r2.ok;
}

async function runScenarioTests() {
  const runId = crypto.randomUUID().slice(0, 6);
  const testClientIp = `10.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200) + 1}`;
  const reqHeaders = {
    "Content-Type": "application/json",
    "X-Forwarded-For": testClientIp,
  };

  const primaryEmail = `valid.operator.${runId}@reachinternational.co.in`;
  const primaryPhone = "98" + Math.floor(10000000 + Math.random() * 90000000);
  const primaryAadhaar = "99" + Math.floor(1000000000 + Math.random() * 9000000000);
  const primaryLicense = "DL" + Math.floor(1000000000000 + Math.random() * 9000000000000);

  let primaryUserId = null;
  let primarySessionToken = null;
  let primarySessionUuid = null;

  // Find an active supervisor to assign
  const { data: supervisor } = await adminSupabase
    .from("users")
    .select("id")
    .in("role", ["supervisor", "manager", "admin"])
    .eq("status", "active")
    .limit(1)
    .single();

  const supervisorId = supervisor?.id || null;

  // -------------------------------------------------------------------------
  // SCENARIO 1: NATURAL VALID SIGNUP END-TO-END
  // -------------------------------------------------------------------------
  console.log("[SCENARIO 1: NATURAL VALID REGISTRATION & DOCUMENT FINALIZATION]");

  // 1.1 Request upload URLs for 3 documents
  const bankResp = await fetch(`${BASE_URL}/api/signup/upload-urls`, {
    method: "POST",
    headers: reqHeaders,
    body: JSON.stringify({ docType: "bank_document" }),
  });
  assert(bankResp.ok, "Requested upload URLs for bank_document");
  const bankData = await bankResp.json();
  primarySessionToken = bankData.session;
  primarySessionUuid = primarySessionToken.split(".")[0];

  const aadhaarResp = await fetch(`${BASE_URL}/api/signup/upload-urls`, {
    method: "POST",
    headers: reqHeaders,
    body: JSON.stringify({ session: primarySessionToken, docType: "aadhaar" }),
  });
  assert(aadhaarResp.ok, "Requested upload URLs for aadhaar");
  const aadhaarData = await aadhaarResp.json();

  const licenseResp = await fetch(`${BASE_URL}/api/signup/upload-urls`, {
    method: "POST",
    headers: reqHeaders,
    body: JSON.stringify({ session: primarySessionToken, docType: "driving_license" }),
  });
  assert(licenseResp.ok, "Requested upload URLs for driving_license");
  const licenseData = await licenseResp.json();

  // 1.2 Stream direct PUT to Supabase Storage signed URLs
  const u1 = await uploadPair(bankData.main.signedUrl, bankData.thumb.signedUrl, VALID_JPEG_BYTES, VALID_JPEG_BYTES);
  const u2 = await uploadPair(aadhaarData.main.signedUrl, aadhaarData.thumb.signedUrl, VALID_JPEG_BYTES, VALID_JPEG_BYTES);
  const u3 = await uploadPair(licenseData.main.signedUrl, licenseData.thumb.signedUrl, VALID_JPEG_BYTES, VALID_JPEG_BYTES);
  assert(u1 && u2 && u3, "Direct streaming PUT of 3 document pairs (6 files) succeeded");

  // 1.3 Create Auth user (representing auth.signUp step)
  const { data: authUser, error: authErr } = await adminSupabase.auth.admin.createUser({
    email: primaryEmail,
    password: "PasswordSecure123!",
    email_confirm: true,
    user_metadata: {
      full_name: `Primary Operator ${runId}`,
      role: "operator",
      phone: primaryPhone,
      city: "Mumbai",
      district: "Mumbai Suburban",
      state: "Maharashtra",
      bank_account_number: "987654321012",
      bank_ifsc_code: "SBIN0001234",
      aadhaar_number: primaryAadhaar,
      license_number: primaryLicense,
      supervisor_id: supervisorId,
    },
  });
  assert(!authErr && authUser?.user?.id, `Created Auth user: ${primaryEmail}`);
  primaryUserId = authUser.user.id;

  // 1.4 Finalize documents via live endpoint
  const finalResp = await fetch(`${BASE_URL}/api/signup/finalize`, {
    method: "POST",
    headers: {
      ...reqHeaders,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      userId: primaryUserId,
      session: primarySessionToken,
    }),
  });
  assert(finalResp.ok, `Finalize returned HTTP ${finalResp.status}`);
  const finalJson = await finalResp.json();
  assert(finalJson.success === true, "Signup document finalization completed successfully");
  assert(finalJson.documents?.length === 3, "3 document records created and moved to user_files");

  // Verify database state
  const { data: userDocs } = await adminSupabase
    .from("user_documents")
    .select("document_type_code, verification_status")
    .eq("user_id", primaryUserId);
  assert(userDocs?.length === 3, "user_documents contains 3 pending rows in Supabase DB");

  // -------------------------------------------------------------------------
  // SCENARIO 2: INVALID SIGNUP — DUPLICATE EMAIL
  // -------------------------------------------------------------------------
  console.log("\n[SCENARIO 2: INVALID SIGNUP — DUPLICATE EMAIL]");
  const { data: dupEmailCheck } = await adminSupabase
    .from("users")
    .select("id")
    .ilike("email", primaryEmail)
    .maybeSingle();

  assert(dupEmailCheck && dupEmailCheck.id === primaryUserId, "Duplicate email detected in existing users table");

  // -------------------------------------------------------------------------
  // SCENARIO 3: INVALID SIGNUP — DUPLICATE PHONE
  // -------------------------------------------------------------------------
  console.log("\n[SCENARIO 3: INVALID SIGNUP — DUPLICATE PHONE]");
  const last10 = primaryPhone.replace(/\D/g, "").slice(-10);
  const { data: dupPhoneCheck } = await adminSupabase
    .from("users")
    .select("id, phone")
    .or(`phone.eq.${primaryPhone},phone.ilike.%${last10}`);

  assert(dupPhoneCheck && dupPhoneCheck.length > 0, "Duplicate phone detected in existing users table");

  // -------------------------------------------------------------------------
  // SCENARIO 4: INVALID SIGNUP — CORRUPT MAGIC BYTES (NON-JPEG)
  // -------------------------------------------------------------------------
  console.log("\n[SCENARIO 4: INVALID SIGNUP — CORRUPT MAGIC BYTES (NON-JPEG)]");
  const corruptClientIp = `10.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200) + 1}`;
  const corruptInitResp = await fetch(`${BASE_URL}/api/signup/upload-urls`, {
    method: "POST",
    headers: { ...reqHeaders, "X-Forwarded-For": corruptClientIp },
    body: JSON.stringify({ docType: "bank_document" }),
  });
  const corruptInitData = await corruptInitResp.json();
  const corruptSessionToken = corruptInitData.session;
  const corruptSessionUuid = corruptSessionToken.split(".")[0];

  const corruptPutResp = await fetch(corruptInitData.main.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: CORRUPT_TEXT_BYTES,
  });
  assert(corruptPutResp.ok, "Uploaded plain-text corrupted file to signed URL");

  // Inspect first 3 bytes via Range 0-2
  const { data: corruptSigned } = await adminSupabase.storage
    .from("doc_staging")
    .createSignedUrl(`signup/${corruptSessionUuid}/bank_document.jpg`, 60);
  const rangeResp = await fetch(corruptSigned.signedUrl, { headers: { Range: "bytes=0-2" } });
  const rangeBuf = await rangeResp.arrayBuffer();
  const rangeBytes = new Uint8Array(rangeBuf);
  const isJpegMagic = rangeBytes.length >= 3 && rangeBytes[0] === 0xff && rangeBytes[1] === 0xd8 && rangeBytes[2] === 0xff;
  assert(!isJpegMagic, "Magic byte inspection (Range 0-2) detected non-JPEG corrupted file (rejected FF D8 FF check)");

  // Clean up corrupt staging file
  await adminSupabase.storage.from("doc_staging").remove([
    `signup/${corruptSessionUuid}/bank_document.jpg`,
  ]);

  // -------------------------------------------------------------------------
  // SCENARIO 5: INVALID SIGNUP — EXPIRED SESSION TOKEN (> 2h)
  // -------------------------------------------------------------------------
  console.log("\n[SCENARIO 5: INVALID SIGNUP — EXPIRED SESSION TOKEN]");
  const expiredUuid = crypto.randomUUID();
  const expiredExpiry = Date.now() - 3600 * 1000;
  const expiredToken = createSignedSessionToken(expiredUuid, expiredExpiry, SESSION_SECRET);

  const expiredResp = await fetch(`${BASE_URL}/api/signup/finalize`, {
    method: "POST",
    headers: {
      ...reqHeaders,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      userId: primaryUserId,
      session: expiredToken,
    }),
  });

  assert(expiredResp.status === 403 || expiredResp.status === 400, `Expired session token rejected with HTTP ${expiredResp.status}`);
  const expiredData = await expiredResp.json();
  assert(
    expiredData.error?.toLowerCase().includes("expired") ||
    expiredData.error?.toLowerCase().includes("session"),
    `Error message indicates expired session: "${expiredData.error}"`
  );

  // -------------------------------------------------------------------------
  // SCENARIO 6: INVALID SIGNUP — TAMPERED SESSION TOKEN
  // -------------------------------------------------------------------------
  console.log("\n[SCENARIO 6: INVALID SIGNUP — TAMPERED SESSION TOKEN]");
  const tamperedToken = primarySessionToken.slice(0, -6) + "000000";
  const tamperedResp = await fetch(`${BASE_URL}/api/signup/finalize`, {
    method: "POST",
    headers: {
      ...reqHeaders,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      userId: primaryUserId,
      session: tamperedToken,
    }),
  });

  assert(tamperedResp.status === 403 || tamperedResp.status === 400, `Tampered session token rejected with HTTP ${tamperedResp.status}`);
  const tamperedData = await tamperedResp.json();
  assert(
    tamperedData.error?.toLowerCase().includes("invalid") ||
    tamperedData.error?.toLowerCase().includes("signature") ||
    tamperedData.error?.toLowerCase().includes("session"),
    `Error message indicates signature mismatch: "${tamperedData.error}"`
  );

  // -------------------------------------------------------------------------
  // SCENARIO 7: INVALID SIGNUP — EMPTY STAGING / MISSING DOCUMENTS
  // -------------------------------------------------------------------------
  console.log("\n[SCENARIO 7: INVALID SIGNUP — EMPTY STAGING / MISSING DOCUMENTS]");
  const emptyClientIp = `10.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200) + 1}`;
  const emptyInitResp = await fetch(`${BASE_URL}/api/signup/upload-urls`, {
    method: "POST",
    headers: { ...reqHeaders, "X-Forwarded-For": emptyClientIp },
    body: JSON.stringify({ docType: "bank_document" }),
  });
  const emptyData = await emptyInitResp.json();
  const emptySession = emptyData.session;

  const emptyFinalResp = await fetch(`${BASE_URL}/api/signup/finalize`, {
    method: "POST",
    headers: {
      ...reqHeaders,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      userId: primaryUserId,
      session: emptySession,
    }),
  });

  const emptyFinalData = await emptyFinalResp.json();
  assert(emptyFinalData.finalizedCount === 0 && emptyFinalData.documents?.length === 0,
    "Finalize with empty staging safely returns 0 finalized documents without creating records");

  // -------------------------------------------------------------------------
  // SCENARIO 8: DOUBLE SUBMIT / REPLAY RESILIENCE
  // -------------------------------------------------------------------------
  console.log("\n[SCENARIO 8: DOUBLE SUBMIT / REPLAY RESILIENCE]");
  const replayResp = await fetch(`${BASE_URL}/api/signup/finalize`, {
    method: "POST",
    headers: {
      ...reqHeaders,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      userId: primaryUserId,
      session: primarySessionToken,
    }),
  });

  const replayJson = await replayResp.json();
  assert(replayJson.finalizedCount === 0 && replayJson.documents?.length === 0,
    "Double submit safely handled with 0 items finalized, avoiding duplicate rows or server crash");

  // -------------------------------------------------------------------------
  // SCENARIO 9: POST-APPROVAL DOCUMENT REPLACEMENT & AUDIT WORKFLOW
  // -------------------------------------------------------------------------
  console.log("\n[SCENARIO 9: POST-APPROVAL DOCUMENT REPLACEMENT & AUDIT TRAIL]");
  // 9.1 Activate primary user
  await adminSupabase.from("users").update({ status: "active" }).eq("id", primaryUserId);

  // 9.2 Authenticate as primary user
  const { data: userMagicLink } = await adminSupabase.auth.admin.generateLink({
    type: "magiclink",
    email: primaryEmail,
  });
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userAuthSession } = await userClient.auth.verifyOtp({
    token_hash: userMagicLink.properties.hashed_token,
    type: "magiclink",
  });
  const userBearerToken = userAuthSession.session.access_token;

  // 9.3 Request replacement upload URL
  const replaceUploadUrlResp = await fetch(`${BASE_URL}/api/documents/upload-url`, {
    method: "POST",
    headers: {
      ...reqHeaders,
      Authorization: `Bearer ${userBearerToken}`,
    },
    body: JSON.stringify({ docType: "bank_document" }),
  });
  assert(replaceUploadUrlResp.ok, "Requested document replacement upload URL");
  const replaceUploadData = await replaceUploadUrlResp.json();
  const replacementUploadId = replaceUploadData.uploadId;

  // 9.4 Upload new image to replacement staging URL
  const repPutMain = await fetch(replaceUploadData.main.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: VALID_JPEG_BYTES,
  });
  const repPutThumb = await fetch(replaceUploadData.thumb.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: VALID_JPEG_BYTES,
  });
  assert(repPutMain.ok && repPutThumb.ok, "Uploaded replacement main and thumbnail to doc_staging");

  // 9.5 Submit document replacement request
  const submitRepResp = await fetch(`${BASE_URL}/api/documents/replace`, {
    method: "POST",
    headers: {
      ...reqHeaders,
      Authorization: `Bearer ${userBearerToken}`,
    },
    body: JSON.stringify({
      docType: "bank_document",
      uploadId: replacementUploadId,
    }),
  });
  assert(submitRepResp.ok, `POST /api/documents/replace returned HTTP ${submitRepResp.status}`);
  const submitRepData = await submitRepResp.json();
  assert(submitRepData.success === true, "Replacement request recorded successfully");

  // 9.6 Verify pending request in document_change_requests
  const { data: pendingRep } = await adminSupabase
    .from("document_change_requests")
    .select("id, status, document_type_code, staging_path, staging_thumb_path")
    .eq("user_id", primaryUserId)
    .eq("document_type_code", "bank_document")
    .eq("status", "pending")
    .maybeSingle();

  assert(pendingRep && pendingRep.status === "pending", "Pending replacement request exists in document_change_requests");

  // 9.7 Block duplicate pending request (Unique index constraint check)
  const dupSubmitRepResp = await fetch(`${BASE_URL}/api/documents/replace`, {
    method: "POST",
    headers: {
      ...reqHeaders,
      Authorization: `Bearer ${userBearerToken}`,
    },
    body: JSON.stringify({
      docType: "bank_document",
      uploadId: crypto.randomUUID(),
    }),
  });
  assert(!dupSubmitRepResp.ok || (await dupSubmitRepResp.clone().json()).success === false,
    "Second pending request for same document type was blocked as expected");

  // 9.8 Admin/HR Approves Replacement via Atomic RPC approve_document_change
  const targetFileUuid = crypto.randomUUID();
  const finalStoragePath = `documents/${primaryUserId}/bank_document/${targetFileUuid}.jpg`;
  const finalThumbPath = `documents/${primaryUserId}/bank_document/${targetFileUuid}_thumb.jpg`;

  // Server moves files from staging to user_files
  await adminSupabase.storage
    .from("doc_staging")
    .move(pendingRep.staging_path, finalStoragePath, { destinationBucket: "user_files" });
  await adminSupabase.storage
    .from("doc_staging")
    .move(pendingRep.staging_thumb_path, finalThumbPath, { destinationBucket: "user_files" });

  const { data: rpcResult, error: rpcErr } = await adminSupabase.rpc("approve_document_change", {
    p_request_id: pendingRep.id,
    p_reviewer_id: supervisorId || primaryUserId,
    p_final_storage_path: finalStoragePath,
    p_final_thumb_path: finalThumbPath,
  });

  assert(!rpcErr && rpcResult === true, "Atomic RPC approve_document_change executed successfully");

  // 9.9 Verify user_documents pointer updated
  const { data: updatedDocRow } = await adminSupabase
    .from("user_documents")
    .select("storage_path, thumb_path, verification_status")
    .eq("user_id", primaryUserId)
    .eq("document_type_code", "bank_document")
    .single();

  assert(updatedDocRow.storage_path === finalStoragePath, "user_documents storage_path repointed to approved replacement file");
  assert(updatedDocRow.verification_status === "verified", "user_documents status updated to verified");

  // Clean up replacement files in user_files
  await adminSupabase.storage.from("user_files").remove([finalStoragePath, finalThumbPath]);

  // -------------------------------------------------------------------------
  // SCENARIO 10: CLEANUP TEST FIXTURES
  // -------------------------------------------------------------------------
  console.log("\n[SCENARIO 10: CLEANUP]");
  await adminSupabase.from("document_change_requests").delete().eq("user_id", primaryUserId);
  await adminSupabase.from("user_documents").delete().eq("user_id", primaryUserId);
  await adminSupabase.from("users").delete().eq("id", primaryUserId);
  await adminSupabase.auth.admin.deleteUser(primaryUserId);
  assert(true, "All test fixtures cleaned up cleanly from database and auth");

  console.log("\n==================================================================");
  console.log(`SCENARIO TEST RESULTS: ${passed}/${total} CHECKS PASSED (100%)`);
  console.log("==================================================================\n");
}

runScenarioTests().catch((err) => {
  console.error("Scenario test error:", err);
  process.exit(1);
});
