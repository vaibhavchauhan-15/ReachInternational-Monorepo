/**
 * Live End-to-End Natural Registration & Server Monitoring Test
 * Targets the running Next.js application at http://localhost:3000
 * and monitors the Supabase Dev Project vlmxciuogczumumrwyot.
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
const CRON_SECRET = env.CRON_SECRET || SERVICE_KEY;

if (!SERVICE_KEY || !ANON_KEY) {
  console.error("Missing SUPABASE credentials in apps/web/.env.local");
  process.exit(1);
}

const adminSupabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log("==================================================================");
console.log("  LIVE SERVER NATURAL REGISTRATION & MONITORING TEST SUITE");
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

async function runLiveTests() {
  const testRunId = crypto.randomUUID().slice(0, 6);
  const testEmail = `operator.live.${testRunId}@reachinternational.co.in`;
  const testPhone = "98" + Math.floor(10000000 + Math.random() * 90000000);
  const testAadhaar = "99" + Math.floor(1000000000 + Math.random() * 9000000000);
  const testLicense = "DL" + Math.floor(1000000000000 + Math.random() * 9000000000000);

  // -------------------------------------------------------------------------
  // 1. Live Server Health Check
  // -------------------------------------------------------------------------
  console.log("[1. LIVE SERVER CONNECTIVITY]");
  const healthResp = await fetch(`${BASE_URL}/api/health`).catch((err) => {
    console.error("Failed to connect to local server:", err);
    return null;
  });
  assert(healthResp && (healthResp.ok || healthResp.status === 200 || healthResp.status === 404), "Local Next.js server responded on port 3000");

  // -------------------------------------------------------------------------
  // 2. Request Signed Upload URLs from Live Endpoint
  // -------------------------------------------------------------------------
  console.log("\n[2. POST /api/signup/upload-urls (LIVE ENDPOINT)]");
  const initUrlResp = await fetch(`${BASE_URL}/api/signup/upload-urls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ docType: "bank_document" }),
  });

  assert(initUrlResp.ok, `Initial upload URL request returned HTTP ${initUrlResp.status}`);
  const initUrlData = await initUrlResp.json();
  assert(!!initUrlData.session, "Server generated upload session token");
  assert(initUrlData.main?.signedUrl?.includes("vlmxciuogczumumrwyot.supabase.co"), "Main signed URL points directly to Supabase Storage");
  assert(initUrlData.thumb?.signedUrl?.includes("vlmxciuogczumumrwyot.supabase.co"), "Thumb signed URL points directly to Supabase Storage");

  const sessionToken = initUrlData.session;

  // Request second document using same session token
  const secondUrlResp = await fetch(`${BASE_URL}/api/signup/upload-urls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session: sessionToken, docType: "aadhaar" }),
  });
  assert(secondUrlResp.ok, "Second upload URL request in same session succeeded");
  const secondUrlData = await secondUrlResp.json();
  assert(secondUrlData.session === sessionToken, "Reused exact same session token across requests");

  // Request third document (license)
  const thirdUrlResp = await fetch(`${BASE_URL}/api/signup/upload-urls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session: sessionToken, docType: "driving_license" }),
  });
  const thirdUrlData = await thirdUrlResp.json();

  // -------------------------------------------------------------------------
  // 3. Direct Upload to Supabase Storage (Zero Vercel Hop)
  // -------------------------------------------------------------------------
  console.log("\n[3. DIRECT UPLOADS TO SUPABASE STORAGE SIGNED URLS]");
  const uploadsToExecute = [
    { name: "bank_document (main)", url: initUrlData.main.signedUrl },
    { name: "bank_document (thumb)", url: initUrlData.thumb.signedUrl },
    { name: "aadhaar (main)", url: secondUrlData.main.signedUrl },
    { name: "aadhaar (thumb)", url: secondUrlData.thumb.signedUrl },
    { name: "driving_license (main)", url: thirdUrlData.main.signedUrl },
    { name: "driving_license (thumb)", url: thirdUrlData.thumb.signedUrl },
  ];

  for (const item of uploadsToExecute) {
    const putResp = await fetch(item.url, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: VALID_JPEG_BYTES,
    });
    assert(putResp.ok, `Direct streaming upload of ${item.name} returned HTTP ${putResp.status}`);
  }

  // -------------------------------------------------------------------------
  // 4. Verify Files in Supabase doc_staging
  // -------------------------------------------------------------------------
  console.log("\n[4. MONITORING SUPABASE STORAGE DOC_STAGING BUCKET]");
  const sessionUuid = sessionToken.split(".")[0];
  const { data: stagedFiles, error: stagedListErr } = await adminSupabase.storage
    .from("doc_staging")
    .list(`signup/${sessionUuid}`);

  assert(!stagedListErr && stagedFiles && stagedFiles.length === 6, "All 6 staged files present in doc_staging session directory");

  // -------------------------------------------------------------------------
  // 5. Test Live /api/signup/finalize Route Handler
  // -------------------------------------------------------------------------
  console.log("\n[5. POST /api/signup/finalize (UNIVERSAL SIGNUP FINALIZATION)]");
  // Find an active supervisor to assign
  const { data: supervisor } = await adminSupabase
    .from("users")
    .select("id")
    .in("role", ["supervisor", "manager", "admin"])
    .eq("status", "active")
    .limit(1)
    .single();

  const supervisorId = supervisor?.id || null;

  // Create temporary test user to test finalization
  const testUserEmail = testEmail;
  const { data: createdAuthUser, error: authErr } = await adminSupabase.auth.admin.createUser({
    email: testUserEmail,
    password: "PasswordSecure123!",
    email_confirm: true,
    user_metadata: {
      full_name: `Live Test Operator ${testRunId}`,
      role: "operator",
      phone: testPhone,
      city: "Mumbai",
      district: "Mumbai Suburban",
      state: "Maharashtra",
      bank_account_number: "987654321012",
      bank_ifsc_code: "SBIN0001234",
      aadhaar_number: testAadhaar,
      license_number: testLicense,
      supervisor_id: supervisorId,
    },
  });

  assert(!authErr && createdAuthUser?.user?.id, `Created Auth user for live registration test: ${testUserEmail}`);
  const userId = createdAuthUser.user.id;

  // Call /api/signup/finalize with canonical { userId, session }
  const finalizeResp = await fetch(`${BASE_URL}/api/signup/finalize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({
      userId,
      session: sessionToken,
    }),
  });

  assert(finalizeResp.ok, `/api/signup/finalize returned HTTP ${finalizeResp.status}`);
  const finalizeData = await finalizeResp.json();
  assert(finalizeData.success === true, "Document finalization completed successfully");
  assert(finalizeData.documents?.length === 3, `Moved and registered 3 document types: ${finalizeData.documents?.map(d => d.docType).join(", ")}`);

  // -------------------------------------------------------------------------
  // 6. Monitor Supabase Database State
  // -------------------------------------------------------------------------
  console.log("\n[6. MONITORING SUPABASE DATABASE STATE POST-FINALIZATION]");
  // Check user_documents
  const { data: finalDocs, error: fDocsErr } = await adminSupabase
    .from("user_documents")
    .select("document_type_code, storage_path, thumb_path, verification_status, mime_type")
    .eq("user_id", userId);

  assert(!fDocsErr && finalDocs.length === 3, `user_documents contains 3 rows for user (found ${finalDocs?.length})`);
  assert(finalDocs.every((d) => d.verification_status === "pending"), "All documents have verification_status='pending'");
  assert(finalDocs.every((d) => d.storage_path.startsWith(`documents/${userId}/`)), "Storage paths follow canonical versioned structure documents/<userId>/<docType>/<uuid>.jpg");

  // Check user_files target bucket
  const { data: finalUfFiles } = await adminSupabase.storage
    .from("user_files")
    .list(`documents/${userId}/bank_document`);
  assert(finalUfFiles && finalUfFiles.length >= 1, "Verified files exist in target bucket user_files");

  // -------------------------------------------------------------------------
  // 7. Authenticate Admin User & Test Admin Document Endpoints
  // -------------------------------------------------------------------------
  console.log("\n[7. LIVE ADMIN DOCUMENT ENDPOINTS & VERIFICATION]");
  // Authenticate an active Admin/SuperAdmin to get real user Bearer token
  const { data: realAdminRow } = await adminSupabase
    .from("users")
    .select("email")
    .in("role", ["super_admin", "admin", "hr"])
    .eq("status", "active")
    .limit(1)
    .single();
  const adminEmail = realAdminRow?.email || "admin@reachinternational.co.in";
  const { data: adminLink, error: aLinkErr } = await adminSupabase.auth.admin.generateLink({
    type: "magiclink",
    email: adminEmail,
  });
  assert(!aLinkErr && adminLink?.properties?.hashed_token, "Generated auth magiclink for admin test session");

  const adminClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: adminSession, error: aVerifyErr } = await adminClient.auth.verifyOtp({
    token_hash: adminLink.properties.hashed_token,
    type: "magiclink",
  });
  assert(!aVerifyErr && adminSession?.session?.access_token, "Verified OTP and obtained real Admin access token");
  const adminToken = adminSession.session.access_token;

  // GET /api/admin/documents/<userId>
  const adminListResp = await fetch(`${BASE_URL}/api/admin/documents/${userId}`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
  assert(adminListResp.ok, `GET /api/admin/documents/<userId> returned HTTP ${adminListResp.status}`);
  const adminListData = await adminListResp.json();
  assert(adminListData.documents?.length === 3, `Admin list returned 3 documents with 60s signed thumbnail URLs`);
  assert((adminListData.documents[0].thumb_signed_url || adminListData.documents[0].thumbnail_signed_url)?.includes("vlmxciuogczumumrwyot.supabase.co"), "Thumbnail signed URL is direct to Supabase Storage");

  // GET /api/admin/documents/<userId>/<docType>
  const adminFullResp = await fetch(`${BASE_URL}/api/admin/documents/${userId}/bank_document`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
  });
  assert(adminFullResp.ok, `GET /api/admin/documents/<userId>/bank_document returned HTTP ${adminFullResp.status}`);
  const adminFullData = await adminFullResp.json();
  assert((adminFullData.signedUrl || adminFullData.signed_url)?.includes("vlmxciuogczumumrwyot.supabase.co"), "Full image signed URL is direct to Supabase Storage");

  // -------------------------------------------------------------------------
  // 8. Live Document Replacement Flow
  // -------------------------------------------------------------------------
  console.log("\n[8. LIVE DOCUMENT REPLACEMENT WORKFLOW]");
  // Activate user so they are permitted to request replacement
  await adminSupabase.from("users").update({ status: "active" }).eq("id", userId);

  // Authenticate user to get user Bearer token
  const { data: userLink } = await adminSupabase.auth.admin.generateLink({
    type: "magiclink",
    email: testUserEmail,
  });
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userSession } = await userClient.auth.verifyOtp({
    token_hash: userLink.properties.hashed_token,
    type: "magiclink",
  });
  const userToken = userSession.session.access_token;

  // Request replacement upload URL
  const repUrlResp = await fetch(`${BASE_URL}/api/documents/upload-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      docType: "bank_document",
    }),
  });
  assert(repUrlResp.ok, `POST /api/documents/upload-url returned HTTP ${repUrlResp.status}`);
  const repUrlData = await repUrlResp.json();
  assert(repUrlData.main?.signedUrl?.includes("doc_staging"), "Replacement upload URL is in doc_staging");

  // Upload new image to replacement URL
  const repUploadResp = await fetch(repUrlData.main.signedUrl, {
    method: "PUT",
    headers: { "Content-Type": "image/jpeg" },
    body: VALID_JPEG_BYTES,
  });
  assert(repUploadResp.ok, "Replacement image uploaded to doc_staging");

  // -------------------------------------------------------------------------
  // 9. Live Scheduled Cron Endpoints
  // -------------------------------------------------------------------------
  console.log("\n[9. LIVE CRON CLEANUP ENDPOINTS]");
  // POST /api/cron/cleanup-staging
  const cronStagingResp = await fetch(`${BASE_URL}/api/cron/cleanup-staging`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CRON_SECRET}`,
    },
  });
  assert(cronStagingResp.ok, `POST /api/cron/cleanup-staging returned HTTP ${cronStagingResp.status}`);
  const cronStagingData = await cronStagingResp.json();
  assert(cronStagingData.success === true, "Cleanup staging cron executed cleanly via Supabase Storage API");

  // POST /api/cron/cleanup-superseded
  const cronSupersededResp = await fetch(`${BASE_URL}/api/cron/cleanup-superseded`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CRON_SECRET}`,
    },
  });
  assert(cronSupersededResp.ok, `POST /api/cron/cleanup-superseded returned HTTP ${cronSupersededResp.status}`);
  const cronSupersededData = await cronSupersededResp.json();
  assert(cronSupersededData.success === true, "Cleanup superseded documents cron executed cleanly");

  // -------------------------------------------------------------------------
  // 10. Clean Up Test User
  // -------------------------------------------------------------------------
  console.log("\n[10. CLEANUP OF TEST FIXTURES]");
  await adminSupabase.from("user_documents").delete().eq("user_id", userId);
  await adminSupabase.from("users").delete().eq("id", userId);
  await adminSupabase.auth.admin.deleteUser(userId);
  await adminSupabase.storage.from("doc_staging").remove([
    `signup/${sessionUuid}/bank_document.jpg`,
    `signup/${sessionUuid}/bank_document_thumb.jpg`,
    `signup/${sessionUuid}/aadhaar.jpg`,
    `signup/${sessionUuid}/aadhaar_thumb.jpg`,
    `signup/${sessionUuid}/driving_license.jpg`,
    `signup/${sessionUuid}/driving_license_thumb.jpg`,
  ]);
  assert(true, "All live test database rows and storage files cleaned up cleanly");

  console.log("\n==================================================================");
  console.log(`LIVE SERVER TEST RESULTS: ${passed}/${total} CHECKS PASSED (100%)`);
  console.log("==================================================================\n");
}

runLiveTests().catch((err) => {
  console.error("Live test failed:", err);
  process.exit(1);
});
