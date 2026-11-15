import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { type DocType, finalDocumentPath } from "@reachinternational/utils";
import crypto from "node:crypto";

export async function approveDocumentReplacementCore(params: {
  reviewerId: string;
  requestId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const adminSupabase = createSupabaseAdminClient();
    const { data: request, error: reqErr } = await adminSupabase
      .from("document_change_requests")
      .select("id, user_id, document_type_code, staging_path, staging_thumb_path, status")
      .eq("id", params.requestId)
      .maybeSingle();

    if (reqErr || !request) {
      return { success: false, error: "Document replacement request not found." };
    }

    if (request.status !== "pending") {
      return { success: false, error: `Request is already ${request.status}.` };
    }

    // Derive final paths in user_files
    const fileUuid = crypto.randomUUID();
    const finalMainPath = finalDocumentPath(
      request.user_id,
      request.document_type_code as DocType,
      fileUuid,
      false
    );
    const finalThumbPath = request.staging_thumb_path
      ? finalDocumentPath(
          request.user_id,
          request.document_type_code as DocType,
          fileUuid,
          true
        )
      : null;

    // Cross-bucket move from doc_staging to user_files
    const { error: moveMainErr } = await adminSupabase.storage
      .from("doc_staging")
      .move(request.staging_path, finalMainPath, { destinationBucket: "user_files" });

    if (moveMainErr) {
      console.error("[approveDocumentReplacementCore] Main file move error:", moveMainErr);
      return { success: false, error: "Failed to transfer staged document to canonical storage." };
    }

    if (request.staging_thumb_path && finalThumbPath) {
      const { error: moveThumbErr } = await adminSupabase.storage
        .from("doc_staging")
        .move(request.staging_thumb_path, finalThumbPath, { destinationBucket: "user_files" });

      if (moveThumbErr) {
        console.warn("[approveDocumentReplacementCore] Thumbnail move warning:", moveThumbErr);
      }
    }

    // Call atomic SQL RPC
    const { error: rpcErr } = await adminSupabase.rpc("approve_document_change", {
      p_request_id: request.id,
      p_reviewer_id: params.reviewerId,
      p_final_storage_path: finalMainPath,
      p_final_thumb_path: finalThumbPath,
    });

    if (rpcErr) {
      console.error("[approveDocumentReplacementCore] RPC error:", rpcErr);
      return { success: false, error: rpcErr.message || "Database error approving replacement." };
    }

    // Synchronize with unified approval engine if an open request exists
    try {
      const { data: appReq } = await adminSupabase
        .from("approval_requests")
        .select("id, version")
        .eq("type_key", "document_replace")
        .eq("subject_id", params.requestId)
        .eq("status", "pending")
        .maybeSingle();

      if (appReq) {
        await adminSupabase.rpc("approval_decide", {
          p_request_id: appReq.id,
          p_decision: "approve",
          p_expected_version: appReq.version,
        });
      }
    } catch {}

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[approveDocumentReplacementCore] Exception:", errorMsg);
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function rejectDocumentReplacementCore(params: {
  reviewerId: string;
  requestId: string;
  rejectionReason: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!params.rejectionReason || !params.rejectionReason.trim()) {
      return { success: false, error: "A rejection reason is required." };
    }

    const adminSupabase = createSupabaseAdminClient();
    const { error: rpcErr } = await adminSupabase.rpc("reject_document_change", {
      p_request_id: params.requestId,
      p_reviewer_id: params.reviewerId,
      p_rejection_reason: params.rejectionReason.trim(),
    });

    if (rpcErr) {
      console.error("[rejectDocumentReplacementCore] RPC error:", rpcErr);
      return { success: false, error: rpcErr.message || "Database error rejecting replacement." };
    }

    // Synchronize with unified approval engine if an open request exists
    try {
      const { data: appReq } = await adminSupabase
        .from("approval_requests")
        .select("id, version")
        .eq("type_key", "document_replace")
        .eq("subject_id", params.requestId)
        .eq("status", "pending")
        .maybeSingle();

      if (appReq) {
        await adminSupabase.rpc("approval_decide", {
          p_request_id: appReq.id,
          p_decision: "reject",
          p_note: params.rejectionReason.trim(),
          p_expected_version: appReq.version,
        });
      }
    } catch {}

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[rejectDocumentReplacementCore] Exception:", errorMsg);
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function verifyUserDocumentCore(params: {
  reviewerId: string;
  documentId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const adminSupabase = createSupabaseAdminClient();

    // 1. Check if unified approval engine has a pending request for this document
    const { data: appReq } = await adminSupabase
      .from("approval_requests")
      .select("id, status, version")
      .eq("type_key", "document_verify")
      .eq("subject_id", params.documentId)
      .eq("status", "pending")
      .maybeSingle();

    if (appReq) {
      const { error: appErr } = await adminSupabase.rpc("approval_decide", {
        p_request_id: appReq.id,
        p_decision: "approve",
        p_expected_version: appReq.version,
      });

      if (!appErr) {
        return { success: true };
      }
      console.warn("[verifyUserDocumentCore] approval_decide fallback to legacy:", appErr.message);
    }

    // 2. Legacy fallback
    const { error: rpcErr } = await adminSupabase.rpc("verify_user_document_atomic", {
      p_document_id: params.documentId,
      p_reviewer_id: params.reviewerId,
    });

    if (rpcErr) {
      console.error("[verifyUserDocumentCore] RPC error:", rpcErr);
      return { success: false, error: rpcErr.message || "Database error verifying document." };
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[verifyUserDocumentCore] Exception:", errorMsg);
    return { success: false, error: "An unexpected error occurred." };
  }
}

export async function rejectUserDocumentCore(params: {
  reviewerId: string;
  documentId: string;
  rejectionReason: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (!params.rejectionReason || !params.rejectionReason.trim()) {
      return { success: false, error: "A rejection reason is required." };
    }

    const adminSupabase = createSupabaseAdminClient();

    // 1. Check if unified approval engine has a pending request for this document
    const { data: appReq } = await adminSupabase
      .from("approval_requests")
      .select("id, status, version")
      .eq("type_key", "document_verify")
      .eq("subject_id", params.documentId)
      .eq("status", "pending")
      .maybeSingle();

    if (appReq) {
      const { error: appErr } = await adminSupabase.rpc("approval_decide", {
        p_request_id: appReq.id,
        p_decision: "reject",
        p_note: params.rejectionReason.trim(),
        p_expected_version: appReq.version,
      });

      if (!appErr) {
        return { success: true };
      }
      console.warn("[rejectUserDocumentCore] approval_decide fallback to legacy:", appErr.message);
    }

    // 2. Legacy fallback
    const { error: rpcErr } = await adminSupabase.rpc("reject_user_document_atomic", {
      p_document_id: params.documentId,
      p_reviewer_id: params.reviewerId,
      p_rejection_reason: params.rejectionReason.trim(),
    });

    if (rpcErr) {
      console.error("[rejectUserDocumentCore] RPC error:", rpcErr);
      return { success: false, error: rpcErr.message || "Database error rejecting document." };
    }

    return { success: true };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[rejectUserDocumentCore] Exception:", errorMsg);
    return { success: false, error: "An unexpected error occurred." };
  }
}
