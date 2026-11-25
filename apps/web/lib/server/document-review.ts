import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { type DocType, finalDocumentPath, sanitizeUserErrorMessage } from "@reachinternational/utils";
import { processPendingApprovalOutboxItems } from "@/lib/server/approvals-outbox";
import { transferAndApplyDocumentReplacement } from "@/lib/server/document-replacement";
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
        // ⚡ Synchronously transfer replacement document into user_documents
        const transferRes = await transferAndApplyDocumentReplacement({
          userId: request.user_id,
          documentTypeCode: request.document_type_code,
          stagingPath: request.staging_path,
          stagingThumbPath: request.staging_thumb_path,
          decidedBy: params.reviewerId,
          requestId: request.id,
        });

        if (!transferRes.success) {
          console.warn("[approveDocumentReplacementCore] transfer warning:", transferRes.error);
        }

        processPendingApprovalOutboxItems(10).catch(() => {});
        return { success: true };
      }
      console.warn("[approveDocumentReplacementCore] approval_decide fallback:", decideErr.message);
    }

    // 2. Direct execution via unified transfer engine
    const transferRes = await transferAndApplyDocumentReplacement({
      userId: request.user_id,
      documentTypeCode: request.document_type_code,
      stagingPath: request.staging_path,
      stagingThumbPath: request.staging_thumb_path,
      decidedBy: params.reviewerId,
      requestId: request.id,
    });

    if (!transferRes.success) {
      return { success: false, error: transferRes.error || "Failed to transfer staged document." };
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

    // Note: Staged files in doc_staging are intentionally preserved until the user
    // reviews the rejection reason and acknowledges it via acknowledgeRejectedDocumentReplacement.

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
          p_actor_id: params.reviewerId,
          p_expected_version: appReq.version,
        });
      }
    } catch { }

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
    const docId = (params.documentId || "").trim();
    if (!docId) {
      return { success: false, error: "Document ID is required." };
    }

    // 1. Check if unified approval engine has a pending request matching docId:
    // It could be the approval request ID itself, or matching subject_id / payload pointers
    let appReq = await adminSupabase
      .from("approval_requests")
      .select("id, status, version, type_key")
      .eq("id", docId)
      .eq("status", "pending")
      .maybeSingle()
      .then((r) => r.data);

    if (!appReq) {
      appReq = await adminSupabase
        .from("approval_requests")
        .select("id, status, version, type_key")
        .or(`subject_id.eq.${docId},payload->>document_id.eq.${docId},payload->>request_id.eq.${docId}`)
        .in("type_key", ["document_verify", "document_replace"])
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
        .then((r) => r.data);
    }

    if (appReq) {
      const { error: appErr } = await adminSupabase.rpc("approval_decide", {
        p_request_id: appReq.id,
        p_decision: "approve",
        p_actor_id: params.reviewerId,
        p_expected_version: appReq.version,
      });

      if (!appErr) {
        if (appReq.type_key === "document_replace") {
          const { data: fullReq } = await adminSupabase
            .from("approval_requests")
            .select("payload, requested_by")
            .eq("id", appReq.id)
            .maybeSingle();

          const p = (fullReq?.payload || {}) as Record<string, any>;
          if (p.staging_path) {
            await transferAndApplyDocumentReplacement({
              userId: p.user_id || fullReq?.requested_by,
              documentTypeCode: p.document_type_code,
              stagingPath: p.staging_path,
              stagingThumbPath: p.staging_thumb_path,
              decidedBy: params.reviewerId,
              requestId: appReq.id,
              fileSizeBytes: p.file_size_bytes,
              mimeType: p.mime_type,
              fileName: p.file_name,
            });
          }
        }

        processPendingApprovalOutboxItems(10).catch(() => { });
        return { success: true };
      }
      console.warn("[verifyUserDocumentCore] approval_decide fallback:", appErr.message);
    }

    // 2. Check if docId is a pending document_change_requests row (replacement)
    const { data: changeReq } = await adminSupabase
      .from("document_change_requests")
      .select("id")
      .eq("id", docId)
      .eq("status", "pending")
      .maybeSingle();

      if (changeReq) {
        return await approveDocumentReplacementCore({
          reviewerId: params.reviewerId,
          requestId: changeReq.id,
        });
      }

      // 3. Check if docId is a record in user_documents
      const { data: userDoc } = await adminSupabase
        .from("user_documents")
        .select("id, verification_status")
        .eq("id", docId)
        .maybeSingle();

      if (userDoc) {
        if (userDoc.verification_status === "verified") {
          return { success: true };
        }
        const { error: rpcErr } = await adminSupabase.rpc("verify_user_document_atomic", {
          p_document_id: docId,
          p_reviewer_id: params.reviewerId,
        });

        if (rpcErr) {
          console.error("[verifyUserDocumentCore] RPC error:", rpcErr);
          return { success: false, error: sanitizeUserErrorMessage(rpcErr, "Failed to verify document.") };
        }
        return { success: true };
      }

      // 4. Record not found or already verified
      return {
        success: false,
        error: "Document record not found or has already been reviewed.",
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("[verifyUserDocumentCore] Exception:", errorMsg);
      return { success: false, error: sanitizeUserErrorMessage(err, "An unexpected error occurred.") };
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
      const docId = (params.documentId || "").trim();
      const reason = params.rejectionReason.trim();
      if (!docId) {
        return { success: false, error: "Document ID is required." };
      }

      // 1. Check if unified approval engine has a pending request matching docId
      let appReq = await adminSupabase
        .from("approval_requests")
        .select("id, status, version, type_key")
        .eq("id", docId)
        .eq("status", "pending")
      .maybeSingle()
        .then((r) => r.data);

      if (!appReq) {
        appReq = await adminSupabase
          .from("approval_requests")
          .select("id, status, version, type_key")
          .or(`subject_id.eq.${docId},payload->>document_id.eq.${docId},payload->>request_id.eq.${docId}`)
          .in("type_key", ["document_verify", "document_replace"])
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
          .then((r) => r.data);
      }

      if (appReq) {
        const { error: appErr } = await adminSupabase.rpc("approval_decide", {
          p_request_id: appReq.id,
          p_decision: "reject",
          p_note: reason,
          p_actor_id: params.reviewerId,
          p_expected_version: appReq.version,
        });

        if (!appErr) {
          processPendingApprovalOutboxItems(10).catch(() => { });
          return { success: true };
        }
        console.warn("[rejectUserDocumentCore] approval_decide fallback:", appErr.message);
      }

      // 2. Check if docId is a pending document_change_requests row (replacement)
      const { data: changeReq } = await adminSupabase
        .from("document_change_requests")
        .select("id")
        .eq("id", docId)
        .eq("status", "pending")
        .maybeSingle();

        if (changeReq) {
          return await rejectDocumentReplacementCore({
            reviewerId: params.reviewerId,
            requestId: changeReq.id,
            rejectionReason: reason,
          });
        }

        // 3. Check if docId is a record in user_documents
        const { data: userDoc } = await adminSupabase
          .from("user_documents")
          .select("id, verification_status")
          .eq("id", docId)
          .maybeSingle();

        if (userDoc) {
          const { error: rpcErr } = await adminSupabase.rpc("reject_user_document_atomic", {
            p_document_id: docId,
            p_reviewer_id: params.reviewerId,
            p_rejection_reason: reason,
          });

          if (rpcErr) {
            console.error("[rejectUserDocumentCore] RPC error:", rpcErr);
            return { success: false, error: sanitizeUserErrorMessage(rpcErr, "Failed to reject document.") };
          }
          return { success: true };
        }

        // 4. Record not found
        return {
          success: false,
          error: "Document record not found or has already been reviewed.",
        };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error("[rejectUserDocumentCore] Exception:", errorMsg);
        return { success: false, error: sanitizeUserErrorMessage(err, "An unexpected error occurred.") };
      }
    }
