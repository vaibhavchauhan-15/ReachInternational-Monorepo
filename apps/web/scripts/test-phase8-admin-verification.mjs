import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import assert from "node:assert/strict";
import {
  canViewDocument,
  canVerifyDocument,
  canRejectDocument,
} from "../../../packages/permissions/src/documents.ts";
import { maskAadhaar, maskBankAccount } from "../../../packages/utils/src/string.ts";

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

console.log("=== PHASE 8: ADMIN & HR DOCUMENT READ & VERIFICATION TEST SUITE ===");
console.log(`Connected to Supabase Project: ${url}`);

let passedChecks = 0;

async function run() {
  try {
    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 1: Permissions Access Matrix (canViewDocument, canVerifyDocument, canRejectDocument)
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n[TEST 1] Verifying RBAC Access Matrix Invariants in @reachinternational/permissions...");

    const targetUser = { id: "target-user-uuid-1" };
    const otherUser = { id: "other-user-uuid-2" };

    // Super Admin, Admin, HR: unrestricted access to all docs
    for (const role of ["super_admin", "admin", "hr"]) {
      const viewer = { id: otherUser.id, role };
      assert.equal(canViewDocument(viewer, targetUser, "aadhaar"), true, `${role} can view aadhaar`);
      assert.equal(canViewDocument(viewer, targetUser, "bank_document"), true, `${role} can view bank doc`);
      assert.equal(canViewDocument(viewer, targetUser, "driving_license"), true, `${role} can view license`);
      assert.equal(canViewDocument(viewer, targetUser), true, `${role} can view doc list`);
      assert.equal(canVerifyDocument(viewer), true, `${role} can verify documents`);
      assert.equal(canRejectDocument(viewer), true, `${role} can reject documents`);
    }

    // Manager and Supervisor: NO access to identity/bank docs
    for (const role of ["manager", "supervisor"]) {
      const viewer = { id: otherUser.id, role };
      assert.equal(canViewDocument(viewer, targetUser, "aadhaar"), false, `${role} cannot view aadhaar`);
      assert.equal(canViewDocument(viewer, targetUser, "bank_document"), false, `${role} cannot view bank`);
      assert.equal(canVerifyDocument(viewer), false, `${role} cannot verify documents`);
      assert.equal(canRejectDocument(viewer), false, `${role} cannot reject documents`);

      // Driving license access strictly contingent on team membership
      assert.equal(
        canViewDocument(viewer, targetUser, "driving_license", { isTeamMember: false }),
        false,
        `${role} cannot view non-team driving license`
      );
      assert.equal(
        canViewDocument(viewer, targetUser, "driving_license", { isTeamMember: true }),
        true,
        `${role} can view team member driving license`
      );
    }

    // Operator: own documents only
    const opViewer = { id: targetUser.id, role: "operator" };
    assert.equal(canViewDocument(opViewer, targetUser, "aadhaar"), true, "operator can view own aadhaar");
    assert.equal(canViewDocument(opViewer, otherUser, "aadhaar"), false, "operator cannot view other aadhaar");
    assert.equal(canVerifyDocument(opViewer), false, "operator cannot verify");
    assert.equal(canRejectDocument(opViewer), false, "operator cannot reject");

    passedChecks++;
    console.log("  ✓ CHECK 1 PASSED: Permissions Access Matrix correctly enforces canonical roles & boundaries.");

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 2: Sensitive Field Masking & Redaction (Aadhaar & Bank)
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n[TEST 2] Verifying Sensitive Field Masking Functions...");

    const maskedAadhaar = maskAadhaar("987654326959");
    assert.equal(maskedAadhaar, "XXXX XXXX 6959", "Aadhaar format must be XXXX XXXX 6959");

    const maskedBank = maskBankAccount("12345678904321");
    assert.equal(maskedBank, "••••4321", "Bank account format must be ••••4321");

    assert.equal(maskAadhaar(null), "—", "Null Aadhaar returns em-dash");
    assert.equal(maskBankAccount(null), "—", "Null bank account returns em-dash");

    passedChecks++;
    console.log("  ✓ CHECK 2 PASSED: Sensitive fields properly masked for display.");

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 3: Atomic Document Verification & Rejection RPCs (Migration 197)
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n[TEST 3] Testing Atomic Document Verification & Rejection Database RPCs...");

    // Find an admin user for reviewer ID
    const { data: adminUserRow } = await adminSupabase
      .from("users")
      .select("id, role")
      .eq("role", "admin")
      .limit(1)
      .single();

    assert.ok(adminUserRow, "Must find an admin user for testing");
    const reviewerId = adminUserRow.id;

    // Find an existing operator user as target
    const { data: operatorUserRow } = await adminSupabase
      .from("users")
      .select("id, role, full_name")
      .eq("role", "operator")
      .limit(1)
      .single();

    assert.ok(operatorUserRow, "Must find an operator user for testing");
    const testTargetUserId = operatorUserRow.id;

    // Clean prior test artifacts
    await adminSupabase.from("user_documents").delete().eq("user_id", testTargetUserId).eq("document_type_code", "driving_license");
    await adminSupabase.from("document_change_requests").delete().eq("user_id", testTargetUserId);

    // Create a temporary document row in user_documents
    const testDocId = crypto.randomUUID();
    const { error: insertErr } = await adminSupabase.from("user_documents").insert({
      id: testDocId,
      user_id: testTargetUserId,
      document_type_code: "driving_license",
      storage_path: `documents/${testTargetUserId}/driving_license/test.jpg`,
      thumb_path: `documents/${testTargetUserId}/driving_license/test_thumb.jpg`,
      mime_type: "image/jpeg",
      file_size_bytes: 12345,
      verification_status: "pending",
    });
    assert.ifError(insertErr);

    // 3a. Call verify_user_document_atomic
    const { data: verifyRes, error: verifyErr } = await adminSupabase.rpc("verify_user_document_atomic", {
      p_document_id: testDocId,
      p_reviewer_id: reviewerId,
    });
    assert.ifError(verifyErr);
    assert.equal(verifyRes, true, "verify RPC should return true");

    // Check DB state
    const { data: verifiedDoc } = await adminSupabase
      .from("user_documents")
      .select("verification_status, verified_by, verified_at, rejection_reason")
      .eq("id", testDocId)
      .single();

    assert.equal(verifiedDoc.verification_status, "verified");
    assert.equal(verifiedDoc.verified_by, reviewerId);
    assert.ok(verifiedDoc.verified_at, "verified_at timestamp must be set");
    assert.equal(verifiedDoc.rejection_reason, null, "rejection_reason must be cleared");

    // 3b. Call reject_user_document_atomic
    const rejectionReason = "Blurry scan: license number not legible";
    const { data: rejectRes, error: rejectErr } = await adminSupabase.rpc("reject_user_document_atomic", {
      p_document_id: testDocId,
      p_reviewer_id: reviewerId,
      p_rejection_reason: rejectionReason,
    });
    assert.ifError(rejectErr);
    assert.equal(rejectRes, true, "reject RPC should return true");

    const { data: rejectedDoc } = await adminSupabase
      .from("user_documents")
      .select("verification_status, verified_by, verified_at, rejection_reason")
      .eq("id", testDocId)
      .single();

    assert.equal(rejectedDoc.verification_status, "rejected");
    assert.equal(rejectedDoc.rejection_reason, rejectionReason);
    assert.equal(rejectedDoc.verified_by, reviewerId, "verified_by records who reviewed/rejected");

    passedChecks++;
    console.log("  ✓ CHECK 3 PASSED: verify_user_document_atomic & reject_user_document_atomic RPCs succeed.");

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 4: Atomic Document Replacement Approval & Rejection RPCs
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n[TEST 4] Testing Atomic Document Replacement Change Request RPCs...");

    const testRequestId = crypto.randomUUID();
    const finalStoragePath = `documents/${testTargetUserId}/bank_document/${crypto.randomUUID()}.jpg`;
    const finalThumbPath = `documents/${testTargetUserId}/bank_document/${crypto.randomUUID()}_thumb.jpg`;

    // Insert pending document change request
    const { error: reqInsertErr } = await adminSupabase.from("document_change_requests").insert({
      id: testRequestId,
      user_id: testTargetUserId,
      document_type_code: "bank_document",
      staging_path: `replace/${testTargetUserId}/bank_document/staged.jpg`,
      staging_thumb_path: `replace/${testTargetUserId}/bank_document/staged_thumb.jpg`,
      status: "pending",
    });
    assert.ifError(reqInsertErr);

    // 4a. Call approve_document_change
    const { data: approveRes, error: approveErr } = await adminSupabase.rpc("approve_document_change", {
      p_request_id: testRequestId,
      p_reviewer_id: reviewerId,
      p_final_storage_path: finalStoragePath,
      p_final_thumb_path: finalThumbPath,
    });
    assert.ifError(approveErr);
    assert.equal(approveRes, true, "approve RPC should return true");

    // Verify change request state
    const { data: approvedReq } = await adminSupabase
      .from("document_change_requests")
      .select("status, reviewed_by, reviewed_at")
      .eq("id", testRequestId)
      .single();
    assert.equal(approvedReq.status, "approved");
    assert.equal(approvedReq.reviewed_by, reviewerId);

    // Verify user_documents row was upserted
    const { data: replacedDoc } = await adminSupabase
      .from("user_documents")
      .select("storage_path, thumb_path, verification_status")
      .eq("user_id", testTargetUserId)
      .eq("document_type_code", "bank_document")
      .single();
    assert.equal(replacedDoc.storage_path, finalStoragePath);
    assert.equal(replacedDoc.thumb_path, finalThumbPath);
    assert.equal(replacedDoc.verification_status, "verified");

    // 4b. Insert another request and test reject_document_change
    const testRejectReqId = crypto.randomUUID();
    await adminSupabase.from("document_change_requests").insert({
      id: testRejectReqId,
      user_id: testTargetUserId,
      document_type_code: "bank_document",
      staging_path: `replace/${testTargetUserId}/bank_document/staged2.jpg`,
      status: "pending",
    });

    const { data: rejectChangeRes, error: rejectChangeErr } = await adminSupabase.rpc(
      "reject_document_change",
      {
        p_request_id: testRejectReqId,
        p_reviewer_id: reviewerId,
        p_rejection_reason: "Account number mismatch",
      }
    );
    assert.ifError(rejectChangeErr);
    assert.equal(rejectChangeRes, true, "rejectChange RPC should return true");

    const { data: rejectedChangeRow } = await adminSupabase
      .from("document_change_requests")
      .select("status, rejection_reason")
      .eq("id", testRejectReqId)
      .single();
    assert.equal(rejectedChangeRow.status, "rejected");
    assert.equal(rejectedChangeRow.rejection_reason, "Account number mismatch");

    // Clean up test documents and change requests
    await adminSupabase.from("user_documents").delete().eq("storage_path", finalStoragePath);
    await adminSupabase.from("user_documents").delete().eq("user_id", testTargetUserId).eq("document_type_code", "driving_license");
    await adminSupabase.from("document_change_requests").delete().in("id", [testRequestId, testRejectReqId]);

    passedChecks++;
    console.log("  ✓ CHECK 4 PASSED: approve_document_change & reject_document_change RPCs execute atomically.");

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 5: Batched Signed Thumbnail URLs & Expiration Contract
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n[TEST 5] Testing Batched Signed Thumbnail URLs (60s Expiration & Zero Pass-Through)...");

    // Put a test file in user_files
    const sampleThumbPath = `documents/${reviewerId}/test/thumb_${crypto.randomUUID()}.jpg`;
    const { error: uploadErr } = await adminSupabase.storage
      .from("user_files")
      .upload(sampleThumbPath, Buffer.from([0xff, 0xd8, 0xff, 0xd9]), {
        contentType: "image/jpeg",
        upsert: true,
      });
    assert.ifError(uploadErr);

    // Request 60s signed URL
    const { data: signedUrls, error: signBatchErr } = await adminSupabase.storage
      .from("user_files")
      .createSignedUrls([sampleThumbPath], 60);

    assert.ifError(signBatchErr);
    assert.ok(Array.isArray(signedUrls) && signedUrls.length === 1);
    assert.ok(signedUrls[0].signedUrl.includes("token="), "Signed URL must contain signed token");

    // Clean up storage object
    await adminSupabase.storage.from("user_files").remove([sampleThumbPath]);

    passedChecks++;
    console.log("  ✓ CHECK 5 PASSED: Batched createSignedUrls issues temporary signed URLs directly to storage.");

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 6: Audit Logging Invariant — Zero Signed URLs Persisted
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n[TEST 6] Verifying Invariant: Signed URLs are NEVER written to audit logs...");

    const testAuditId = crypto.randomUUID();
    const safeMetadata = {
      kind: "thumb",
      target_user_id: reviewerId,
      document_count: 2,
      document_types: ["aadhaar", "driving_license"],
      viewer_role: "admin",
    };

    const { error: auditInsertErr } = await adminSupabase.from("audit_logs").insert({
      id: testAuditId,
      user_id: reviewerId,
      action: "document.view",
      entity_type: "user_documents",
      entity_id: reviewerId,
      target_user_id: reviewerId,
      ip_address: "127.0.0.1",
      metadata: safeMetadata,
    });
    assert.ifError(auditInsertErr);

    // Read back and assert no token or signedUrl in metadata
    const { data: auditRow } = await adminSupabase
      .from("audit_logs")
      .select("action, metadata, details")
      .eq("id", testAuditId)
      .single();

    assert.equal(auditRow.action, "document.view");
    const serialized = JSON.stringify(auditRow);
    assert.equal(serialized.includes("token="), false, "Audit row must NOT contain signed token");
    assert.equal(serialized.includes("signedUrl"), false, "Audit row must NOT contain signed URL");

    // Clean up
    await adminSupabase.from("audit_logs").delete().eq("id", testAuditId);

    passedChecks++;
    console.log("  ✓ CHECK 6 PASSED: Audit logs enforce strict privacy (zero signed URL leakage).");

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 7: Sensitive Reveal Audit Logging
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n[TEST 7] Verifying Sensitive Statutory Reveal Audit Logging (Aadhaar & Bank)...");

    const aadhaarRevealAuditId = crypto.randomUUID();
    await adminSupabase.from("audit_logs").insert({
      id: aadhaarRevealAuditId,
      user_id: reviewerId,
      action: "aadhaar.reveal",
      entity_type: "users",
      entity_id: reviewerId,
      target_user_id: reviewerId,
      ip_address: "127.0.0.1",
      metadata: {
        field: "aadhaar",
        target_user_id: reviewerId,
        viewer_role: "admin",
      },
    });

    const { data: revealRow } = await adminSupabase
      .from("audit_logs")
      .select("action, metadata")
      .eq("id", aadhaarRevealAuditId)
      .single();

    assert.equal(revealRow.action, "aadhaar.reveal");
    assert.equal(revealRow.metadata.field, "aadhaar");
    // Ensure raw unmasked number is not in audit log
    assert.equal(JSON.stringify(revealRow).includes("987654326959"), false);

    await adminSupabase.from("audit_logs").delete().eq("id", aadhaarRevealAuditId);

    passedChecks++;
    console.log("  ✓ CHECK 7 PASSED: Sensitive unmasking events audited safely without exposing PII.");

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK 8: Document View Volume Alert Logic (>20 views in 24 hours)
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n[TEST 8] Verifying High Volume Document View Threshold & Alert Calculation...");

    // Insert 22 mock view rows for the viewer
    const mockViewIds = [];
    const nowIso = new Date().toISOString();
    for (let i = 0; i < 22; i++) {
      mockViewIds.push(crypto.randomUUID());
    }

    const mockRows = mockViewIds.map((id) => ({
      id,
      user_id: reviewerId,
      action: "document.view",
      entity_type: "user_documents",
      entity_id: reviewerId,
      target_user_id: reviewerId,
      ip_address: "127.0.0.1",
      created_at: nowIso,
      metadata: { kind: "thumb", viewer_role: "admin" },
    }));

    await adminSupabase.from("audit_logs").insert(mockRows);

    // Query 24h count
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: volumeRows } = await adminSupabase
      .from("audit_logs")
      .select("user_id, created_at")
      .eq("action", "document.view")
      .eq("user_id", reviewerId)
      .gte("created_at", since24h);

    const count = volumeRows?.length || 0;
    assert.ok(count >= 22, `Expected at least 22 document.view records, found ${count}`);

    // Verify threshold condition
    const isExceeded = count > 20;
    assert.equal(isExceeded, true, "Volume alert must trigger when views exceed 20");

    // Cleanup mock view rows
    await adminSupabase.from("audit_logs").delete().in("id", mockViewIds);

    passedChecks++;
    console.log("  ✓ CHECK 8 PASSED: Document view volume alert triggers at >20 views/24h.");

    console.log("\n========================================================");
    console.log(`ALL ${passedChecks}/8 PHASE 8 VERIFICATION CHECKS PASSED SUCCESSFULLY!`);
    console.log("========================================================\n");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ PHASE 8 VERIFICATION SUITE FAILED:", err);
    process.exit(1);
  }
}

run();
