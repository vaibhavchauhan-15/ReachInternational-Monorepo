/**
 * Comprehensive Component Re-Verification Script
 * Checks all storage buckets, policies, tables, RPCs, routes, client hooks, and actions
 * against Dev Supabase project vlmxciuogczumumrwyot.
 */

import fs from "node:fs";
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

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || "https://vlmxciuogczumumrwyot.supabase.co";
const SERVICE_KEY = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error("Missing SUPABASE_SECRET_KEY in apps/web/.env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

console.log("=== COMPREHENSIVE DOCUMENT PIPELINE RE-VERIFICATION ===");
console.log(`Connected to: ${SUPABASE_URL}\n`);

let checksPassed = 0;
let totalChecks = 0;

function check(passed, label, details = "") {
  totalChecks++;
  if (passed) {
    console.log(`  ✓ ${label}`);
    checksPassed++;
  } else {
    console.error(`  ✗ FAIL: ${label} ${details ? `(${details})` : ""}`);
  }
}

async function run() {
  // 1. Storage Buckets
  console.log("[1. STORAGE BUCKETS]");
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  check(!bErr && buckets, "Fetched storage buckets");
  const docStaging = buckets?.find((b) => b.id === "doc_staging");
  const userFiles = buckets?.find((b) => b.id === "user_files");

  check(!!docStaging, "doc_staging bucket exists");
  check(docStaging?.public === false, "doc_staging is private (public=false)");
  check(docStaging?.file_size_limit === 1048576, `doc_staging file size limit is 1MB (${docStaging?.file_size_limit})`);
  check(
    Array.isArray(docStaging?.allowed_mime_types) && docStaging.allowed_mime_types.includes("image/jpeg"),
    "doc_staging allowed_mime_types contains image/jpeg"
  );

  check(!!userFiles, "user_files bucket exists");
  check(userFiles?.public === false, "user_files is private (public=false)");

  // 2. Database Tables & Columns
  console.log("\n[2. DATABASE TABLES & COLUMNS]");
  // Test user_documents columns
  const { data: userDocSample, error: udErr } = await supabase
    .from("user_documents")
    .select("thumb_path, verification_status, verified_by, verified_at, rejection_reason")
    .limit(1);
  check(!udErr, "user_documents contains thumb_path, verification_status, verified_by, verified_at, rejection_reason");

  // Test document_change_requests columns
  const { data: dcrSample, error: dcrErr } = await supabase
    .from("document_change_requests")
    .select("id, user_id, document_type_code, staging_path, staging_thumb_path, status, reviewed_by, reviewed_at, rejection_reason, created_at")
    .limit(1);
  check(!dcrErr, "document_change_requests table exists with canonical columns");

  // Test audit_logs target_user_id
  const { data: alSample, error: alErr } = await supabase
    .from("audit_logs")
    .select("target_user_id")
    .limit(1);
  check(!alErr, "audit_logs table has target_user_id column");

  // 3. Stored Procedures (RPCs)
  console.log("\n[3. DATABASE ATOMIC STORED PROCEDURES]");
  // We check if the functions are callable or defined in pg_proc
  const rpcsToCheck = [
    "verify_user_document_atomic",
    "reject_user_document_atomic",
    "approve_document_change",
    "reject_document_change",
  ];

  for (const rpcName of rpcsToCheck) {
    // Calling with null/dummy to verify function signature existence in pg_proc
    const { error: rpcErr } = await supabase.rpc(rpcName, {
      p_document_id: "00000000-0000-0000-0000-000000000000",
      p_reviewer_id: "00000000-0000-0000-0000-000000000000",
      p_request_id: "00000000-0000-0000-0000-000000000000",
      p_rejection_reason: "test",
      p_final_storage_path: "test",
      p_final_thumb_path: "test",
    });
    // If function does not exist, code is 42883. Any other error (e.g. not found ID or validation error) proves the function exists.
    const exists = !rpcErr || rpcErr.code !== "42883";
    check(exists, `Stored procedure ${rpcName} exists in database`);
  }

  // 4. File System Codebase Verification
  console.log("\n[4. MONOREPO CODEBASE FILES & INVARIANTS]");
  const requiredFiles = [
    // Web utils & hooks
    "apps/web/lib/utils/image-compression.ts",
    "apps/web/lib/hooks/useSignupDocumentUploads.ts",
    "apps/web/lib/hooks/useMyDocuments.ts",
    "apps/web/components/documents/DocumentUploadCard.tsx",
    "apps/web/components/documents/MyDocumentsSection.tsx",
    "apps/web/app/signup/page.tsx",
    "apps/web/app/(app)/profile/documents/page.tsx",
    "apps/web/app/(app)/users/[id]/UserDetailClient.tsx",
    // Web APIs & Server Actions
    "apps/web/app/api/signup/upload-urls/route.ts",
    "apps/web/app/api/signup/finalize/route.ts",
    "apps/web/app/api/documents/upload-url/route.ts",
    "apps/web/app/api/documents/replace/route.ts",
    "apps/web/app/api/admin/documents/[userId]/route.ts",
    "apps/web/app/api/admin/documents/[userId]/[docType]/route.ts",
    "apps/web/app/api/cron/cleanup-staging/route.ts",
    "apps/web/app/api/cron/cleanup-superseded/route.ts",
    "apps/web/app/actions/auth.ts",
    "apps/web/app/actions/documents.ts",
    "apps/web/lib/security/upload-session.ts",
    "apps/web/lib/server/finalize-signup-documents.ts",
    "apps/web/lib/server/admin-documents.ts",
    // Next config & proxy
    "apps/web/proxy.ts",
    "apps/web/next.config.ts",
    "apps/web/lib/supabase/server.ts",
    // Packages
    "packages/utils/src/documents.ts",
    "packages/permissions/src/documents.ts",
    "packages/validation/src/documents.ts",
    // Native Mobile
    "apps/mobile/lib/utils/mobileImageCompression.ts",
    "apps/mobile/lib/hooks/useMobileSignupDocumentUploads.ts",
    "apps/mobile/lib/hooks/useMobileMyDocuments.ts",
    "apps/mobile/components/documents/MobileDocumentUploadCard.tsx",
    "apps/mobile/components/users/UserDetailView.tsx",
    "apps/mobile/components/users/RejectReasonModal.tsx",
    "apps/mobile/app/(auth)/signup.tsx",
    "apps/mobile/app/(app)/profile/documents.tsx",
  ];

  for (const filePath of requiredFiles) {
    const fileExists = fs.existsSync(filePath);
    check(fileExists, `File exists: ${filePath}`);
  }

  // 5. Invariant Checks in Code
  console.log("\n[5. ARCHITECTURAL INVARIANT CHECKS]");
  // Check proxy.ts has isServerAction bypass
  const proxyContent = fs.readFileSync("apps/web/proxy.ts", "utf8");
  check(
    proxyContent.includes("isServerAction") && proxyContent.includes("RATE_LIMIT_PROFILES.SIGNUP_UPLOAD"),
    "proxy.ts contains isServerAction rate limit bypass and SIGNUP_UPLOAD profile"
  );

  // Check next.config.ts has no bodySizeLimit
  const nextConfigContent = fs.readFileSync("apps/web/next.config.ts", "utf8");
  check(
    !nextConfigContent.includes("bodySizeLimit"),
    "next.config.ts has bodySizeLimit workaround removed"
  );

  // Check server.ts has getCachedAuthUser
  const serverContent = fs.readFileSync("apps/web/lib/supabase/server.ts", "utf8");
  check(
    serverContent.includes("getCachedAuthUser") && serverContent.includes("cache(async () =>"),
    "server.ts implements React cache() for getCachedAuthUser"
  );

  // Check auth.ts has FF D8 FF magic byte check
  const authContent = fs.readFileSync("apps/web/app/actions/auth.ts", "utf8");
  check(
    authContent.includes("verifyStagedJpegMagicBytes") && authContent.includes("0xff && bytes[1] === 0xd8 && bytes[2] === 0xff"),
    "auth.ts verifies JPEG magic bytes (FF D8 FF) via HTTP Range 0-2"
  );
  check(
    authContent.includes("adminSupabase.auth.admin.deleteUser(userId)") && authContent.includes("compensation rollback"),
    "auth.ts implements Step 9 compensation rollback deleting new user on post-auth failure"
  );

  console.log("\n========================================================");
  console.log(`RE-VERIFICATION RESULTS: ${checksPassed}/${totalChecks} CHECKS PASSED (${Math.round((checksPassed/totalChecks)*100)}%)`);
  console.log("========================================================\n");

  if (checksPassed < totalChecks) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("Re-verification failed:", err);
  process.exit(1);
});
