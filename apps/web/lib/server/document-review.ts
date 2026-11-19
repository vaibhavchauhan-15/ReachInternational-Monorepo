import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { type DocType, finalDocumentPath } from "@reachinternational/utils";
import { processPendingApprovalOutboxItems } from "@/lib/server/approvals-outbox";
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

    // 1. Check if unified approval engine has a pending request for this document replacement
    const { data: appReq } = await adminSupabase
      .from("approval_requests")
      .select("id, version")
      .eq("type_key", "document_replace")
      .eq("subject_id", params.requestId)
      .eq("status", "pending")
      .maybeSingle();

    if (appReq) {
      const { error: decideErr } = await adminSupabase.rpc("approval_decide", {
        p_request_id: appReq.id,
        p_decision: "approve",
        p_expected_version: appReq.version,
        p_actor_id: params.reviewerId,
      });

      if (!decideErr) {
        // ⚡ Non-blocking fire-and-forget outbox drain (saves ~500ms-5s from response path)
        processPendingApprovalOutboxItems(10).catch((err) => {
          console.warn("[approveDocumentReplacementCore] Background outbox processing non-blocking error:", err);
        });
        return { success: true };
      }
      console.warn("[approveDocumentReplacementCore] approval_decide fallback:", decideErr.message);
    }

    // 2. Direct fallback execution
    const { data: existingDoc } = await adminSupabase
      .from("user_documents")
      .select("id, storage_path, thumb_path, mime_type, file_size_bytes, file_name")
      .eq("user_id", request.user_id)
      .eq("document_type_code", request.document_type_code)
      .maybeSingle();

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
    const { error: rpcErr } = await adminSupabase.rpc("apply_document_replacement_pointer", {
      p_user_id: request.user_id,
      p_doc_type: request.document_type_code,
      p_final_storage_path: finalMainPath,
      p_final_thumb_path: finalThumbPath,
      p_decided_by: params.reviewerId,
      p_mime_type: existingDoc?.mime_type || "image/jpeg",
      p_file_size_bytes: existingDoc?.file_size_bytes || 0,
      p_file_name: existingDoc?.file_name || `${request.document_type_code}.jpg`,
      p_change_request_id: request.id,
    });

    if (rpcErr) {
      console.error("[approveDocumentReplacementCore] RPC error:", rpcErr);
      return { success: false, error: rpcErr.message || "Database error approving replacement." };
    }

    // Delete older document files from user_files ONLY AFTER successful DB update
    if (existingDoc?.storage_path) {
      const oldFiles = [existingDoc.storage_path, existingDoc.thumb_path].filter(
        (p): p is string => Boolean(p) && p !== finalMainPath && p !== finalThumbPath
      );
      if (oldFiles.length > 0) {
        await adminSupabase.storage
          .from("user_files")
          .remove(oldFiles)
          .catch((e: unknown) => console.warn("[approveDocumentReplacementCore] Warning deleting old files:", e));
      }
    }

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

    // Fetch staging paths to clean up
    const { data: request } = await adminSupabase
      .from("document_change_requests")
      .select("id, staging_path, staging_thumb_path")
      .eq("id", params.requestId)
      .maybeSingle();

    const { error: rpcErr } = await adminSupabase.rpc("reject_document_change", {
      p_request_id: params.requestId,
      p_reviewer_id: params.reviewerId,
      p_rejection_reason: params.rejectionReason.trim(),
    });

    if (rpcErr) {
      console.error("[rejectDocumentReplacementCore] RPC error:", rpcErr);
      return { success: false, error: rpcErr.message || "Database error rejecting replacement." };
    }

    // Clean up staged files
    if (request?.staging_path) {
      const stagedFiles = [request.staging_path, request.staging_thumb_path].filter(Boolean) as string[];
      if (stagedFiles.length > 0) {
        await adminSupabase.storage
          .from("doc_staging")
          .remove(stagedFiles)
          .catch((e: unknown) => console.warn("[rejectDocumentReplacementCore] Staging clean warn:", e));
      }
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
