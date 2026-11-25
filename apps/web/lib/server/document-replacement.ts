import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { DOC_UPLOAD, type DocType, isDocType, DOCUMENT_ERROR_MESSAGES, finalDocumentPath } from "@reachinternational/utils";
import { TAGS } from "@/lib/cache/tags";
import { revalidateTag } from "next/cache";
import crypto from "node:crypto";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface SubmitReplacementParams {
  userId: string;
  docType: DocType;
  uploadId: string;
}

export interface SubmitReplacementResult {
  success: boolean;
  approvedImmediately?: boolean;
  message?: string;
  requestId?: string;
  error?: string;
}

/**
 * Verifies that the first 3 bytes of a staged file match JPEG magic bytes FF D8 FF.
 * Uses HTTP Range 0-2 request so strictly 3 bytes travel across the network.
 */
async function verifyJpegMagicBytes(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  stagingPath: string
): Promise<boolean> {
  try {
    const { data: signedData, error: signErr } = await adminSupabase.storage
      .from("doc_staging")
      .createSignedUrl(stagingPath, 60);

    if (signErr || !signedData?.signedUrl) {
      console.error(`[MagicBytes] Failed to create signed URL for ${stagingPath}:`, signErr);
      return false;
    }

    const resp = await fetch(signedData.signedUrl, {
      headers: { Range: "bytes=0-2" },
    });

    if (!resp.ok && resp.status !== 206) {
      console.error(`[MagicBytes] HTTP error ${resp.status} reading ${stagingPath}`);
      return false;
    }

    const buf = await resp.arrayBuffer();
    const bytes = new Uint8Array(buf);
    if (bytes.length < 3) return false;

    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  } catch (err) {
    console.error(`[MagicBytes] Exception reading magic bytes for ${stagingPath}:`, err);
    return false;
  }
}

/**
 * Handles document replacement submission:
 * 1. The server derives staging paths itself: replace/<userId>/<docType>/<uploadId>.jpg and _thumb.jpg.
 * 2. Confirms file existence, size limits, and JPEG magic bytes (FF D8 FF).
 * 3. Enforces one pending request per user and document type.
 * 4. If requires_approval is false: moves file to user_files and updates pointer immediately.
 * 5. If requires_approval is true: inserts pending row into document_change_requests.
 */
export async function submitDocumentReplacement(
  params: SubmitReplacementParams
): Promise<SubmitReplacementResult> {
  const { userId, docType, uploadId } = params;

  if (!isDocType(docType)) {
    return { success: false, error: DOCUMENT_ERROR_MESSAGES.INVALID_DOC_TYPE };
  }

  if (!uploadId || !UUID_REGEX.test(uploadId)) {
    return { success: false, error: "Invalid upload ID format." };
  }

  const adminSupabase = createSupabaseAdminClient();

  // 1. The server derives the path itself
  const mainStagingPath = `replace/${userId}/${docType}/${uploadId}.jpg`;
  const thumbStagingPath = `replace/${userId}/${docType}/${uploadId}_thumb.jpg`;

  // 2. Verify existence and size in doc_staging
  const stagingPrefix = `replace/${userId}/${docType}`;
  const { data: stagedFiles, error: listErr } = await adminSupabase.storage
    .from("doc_staging")
    .list(stagingPrefix);

  if (listErr || !stagedFiles) {
    console.error("[Replacement] Staging list error:", listErr);
    return { success: false, error: DOCUMENT_ERROR_MESSAGES.STAGING_FILE_MISSING };
  }

  const mainFileName = `${uploadId}.jpg`;
  const thumbFileName = `${uploadId}_thumb.jpg`;

  const mainFile = stagedFiles.find((f) => f.name === mainFileName);
  const thumbFile = stagedFiles.find((f) => f.name === thumbFileName);

  if (!mainFile) {
    return { success: false, error: DOCUMENT_ERROR_MESSAGES.STAGING_FILE_MISSING };
  }

  // Check size limit (1 MB ceiling)
  const fileSize = typeof mainFile.metadata?.size === "number" ? mainFile.metadata.size : 0;
  if (fileSize > DOC_UPLOAD.maxBytes) {
    return { success: false, error: DOCUMENT_ERROR_MESSAGES.IMAGE_TOO_LARGE };
  }

  // Verify first 3 bytes are FF D8 FF
  const isJpeg = await verifyJpegMagicBytes(adminSupabase, mainStagingPath);
  if (!isJpeg) {
    return { success: false, error: "Uploaded replacement file is not a valid JPEG image." };
  }

  // 3. Check if document type requires approval
  const { data: docTypeRow, error: typeErr } = await adminSupabase
    .from("user_document_types")
    .select("requires_approval")
    .eq("code", docType)
    .maybeSingle();

  if (typeErr) {
    console.warn("[Replacement] Warning checking requires_approval, defaulting to true:", typeErr);
  }

  const requiresApproval = docTypeRow?.requires_approval !== false;

  if (!requiresApproval) {
    // Skip review: move files to user_files and swap pointer immediately
    const fileUuid = crypto.randomUUID();
    const finalMainPath = `documents/${userId}/${docType}/${fileUuid}.jpg`;
    const finalThumbPath = thumbFile ? `documents/${userId}/${docType}/${fileUuid}_thumb.jpg` : null;

    const movePromises: Promise<void>[] = [
      adminSupabase.storage
        .from("doc_staging")
        .move(mainStagingPath, finalMainPath, { destinationBucket: "user_files" })
        .then(({ error }) => {
          if (error) throw new Error(`Failed to move main file: ${error.message}`);
        }),
    ];

    if (thumbFile && finalThumbPath) {
      movePromises.push(
        adminSupabase.storage
          .from("doc_staging")
          .move(thumbStagingPath, finalThumbPath, { destinationBucket: "user_files" })
          .then(({ error }) => {
            if (error) console.warn("[Replacement] Thumbnail move warning:", error.message);
          })
      );
    }

    await Promise.all(movePromises);

    // Swap pointer in user_documents
    const nowIso = new Date().toISOString();
    const { error: upsertErr } = await adminSupabase
      .from("user_documents")
      .upsert(
        {
          user_id: userId,
          document_type_code: docType,
          storage_path: finalMainPath,
          thumb_path: finalThumbPath,
          mime_type: DOC_UPLOAD.mime,
          file_size_bytes: fileSize,
          file_name: `${docType}.jpg`,
          verification_status: "verified",
          status: "verified",
          updated_at: nowIso,
        },
        { onConflict: "user_id,document_type_code" }
      );

    if (upsertErr) {
      console.error("[Replacement] Pointer swap error:", upsertErr);
      return { success: false, error: "Failed to update document record." };
    }

    await logAudit({
      action: "document.replaced_direct",
      entity_type: "user_document",
      entity_id: userId,
      user_id: userId,
      target_user_id: userId,
      metadata: {
        document_type: docType,
        storage_path: finalMainPath,
        thumb_path: finalThumbPath,
        file_size_bytes: fileSize,
      },
    });

    return {
      success: true,
      approvedImmediately: true,
      message: "Document replaced successfully.",
    };
  }

  // 4. Requires approval: Create or update pending change request & submit to approval queue
  const { data: userProfile } = await adminSupabase
    .from("users")
    .select("id, full_name, email, phone, role, employee_id, machine_category")
    .eq("id", userId)
    .maybeSingle();

  // Check for existing pending row in document_change_requests
  const { data: existingPending, error: pendingErr } = await adminSupabase
    .from("document_change_requests")
    .select("id")
    .eq("user_id", userId)
    .eq("document_type_code", docType)
    .eq("status", "pending")
    .maybeSingle();

  if (pendingErr) {
    console.error("[Replacement] Error checking pending requests:", pendingErr);
  }

  let changeRequestId: string;

  if (existingPending) {
    changeRequestId = existingPending.id;
    const { error: updateErr } = await adminSupabase
      .from("document_change_requests")
      .update({
        staging_path: mainStagingPath,
        staging_thumb_path: thumbFile ? thumbStagingPath : null,
        status: "pending",
        rejection_reason: null,
        reviewed_by: null,
        reviewed_at: null,
        created_at: new Date().toISOString(),
      })
      .eq("id", changeRequestId);

    if (updateErr) {
      console.error("[Replacement] Update existing change request error:", updateErr);
      return { success: false, error: "Failed to update pending replacement request." };
    }
  } else {
    const { data: inserted, error: insertErr } = await adminSupabase
      .from("document_change_requests")
      .insert({
        user_id: userId,
        document_type_code: docType,
        staging_path: mainStagingPath,
        staging_thumb_path: thumbFile ? thumbStagingPath : null,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      console.error("[Replacement] Insert change request error:", insertErr);
      if (insertErr?.code === "23505") {
        return { success: false, error: DOCUMENT_ERROR_MESSAGES.DUPLICATE_PENDING_REQUEST };
      }
      return { success: false, error: "Failed to submit replacement request." };
    }
    changeRequestId = inserted.id;
  }

  // 5. Ensure Centralized Approval Engine ledger row is active & pending
  const payloadData = {
    user_id: userId,
    document_type_code: docType,
    staging_path: mainStagingPath,
    staging_thumb_path: thumbFile ? thumbStagingPath : null,
    request_id: changeRequestId,
    file_size_bytes: fileSize,
    mime_type: DOC_UPLOAD.mime,
    file_name: `${docType}.jpg`,
    full_name: userProfile?.full_name || null,
    role: userProfile?.role || null,
    employee_id: userProfile?.employee_id || null,
    email: userProfile?.email || null,
    phone: userProfile?.phone || null,
    machine_category: userProfile?.machine_category || null,
  };

  const docLabel = docType.replace(/_/g, " ").toUpperCase();
  const summaryText = `Document replacement request for ${docType.replace(/_/g, " ")}`;

  // Check if an approval request already exists for this subject or this user & docType
  const { data: existingApproval } = await adminSupabase
    .from("approval_requests")
    .select("id, version, status")
    .eq("type_key", "document_replace")
    .or(`subject_id.eq.${changeRequestId},and(requested_by.eq.${userId},payload->>document_type_code.eq.${docType})`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let approvalRequestId: string;

  if (existingApproval) {
    approvalRequestId = existingApproval.id;
    const { error: appUpdateErr } = await adminSupabase
      .from("approval_requests")
      .update({
        status: "pending",
        subject_id: changeRequestId,
        subject_label: `${docLabel} replacement`,
        summary: summaryText,
        payload: payloadData,
        decision_note: null,
        decided_by: null,
        decided_at: null,
        version: (existingApproval.version || 1) + 1,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .eq("id", approvalRequestId);

    if (appUpdateErr) {
      console.error("[Replacement] Error updating approval_request:", appUpdateErr);
    }
  } else {
    // If user already has a pending top-level document_replace request, link as child so it consolidates into one card
    const { data: existingParent } = await adminSupabase
      .from("approval_requests")
      .select("id")
      .eq("type_key", "document_replace")
      .eq("requested_by", userId)
      .eq("status", "pending")
      .is("parent_id", null)
      .maybeSingle();

    const { data: newApproval, error: appInsertErr } = await adminSupabase
      .from("approval_requests")
      .insert({
        type_key: "document_replace",
        subject_type: "document",
        subject_id: changeRequestId,
        subject_label: `${docLabel} replacement`,
        requested_by: userId,
        status: "pending",
        summary: summaryText,
        payload: payloadData,
        parent_id: existingParent?.id || null,
      })
      .select("id")
      .single();

    if (appInsertErr || !newApproval) {
      console.error("[Replacement] Error inserting approval_request:", appInsertErr);
      return { success: false, error: "Failed to submit approval request to administrator queue." };
    }
    approvalRequestId = newApproval.id;
  }

  // 6. Enqueue notification in approval_outbox for administrators
  await adminSupabase.from("approval_outbox").insert({
    topic: "approval.submitted",
    request_id: approvalRequestId,
    payload: {
      request_id: approvalRequestId,
      type_key: "document_replace",
      requested_by: userId,
      summary: summaryText,
    },
  });

  // 7. Revalidate cache tags so admin instantly sees the approval card in queue
  try {
    revalidateTag(TAGS.approvals, "max");
    revalidateTag(TAGS.approvalsList, "max");
    revalidateTag(TAGS.approvalsCounts, "max");
    revalidateTag(TAGS.users, "max");
  } catch {}

  // 8. Log audit trail
  await logAudit({
    action: existingPending ? "document.replacement_updated" : "document.replacement_requested",
    entity_type: "document_change_request",
    entity_id: changeRequestId,
    user_id: userId,
    target_user_id: userId,
    metadata: {
      document_type: docType,
      staging_path: mainStagingPath,
      request_id: changeRequestId,
      approval_request_id: approvalRequestId,
    },
  });

  return {
    success: true,
    approvedImmediately: false,
    requestId: changeRequestId,
    message: existingPending
      ? "Replacement request updated with new image and submitted for administrator review."
      : "Replacement request submitted for administrator review.",
  };
}

// ─── Phase 9: Authoritative Document Replacement Transfer & Pointer Swap ─────────

export interface DocumentReplacementTransferParams {
  userId: string;
  documentTypeCode: string;
  stagingPath: string;
  stagingThumbPath?: string | null;
  decidedBy?: string | null;
  requestId?: string | null; // document_change_requests.id or approval_requests.id
  fileSizeBytes?: number;
  mimeType?: string;
  fileName?: string;
}

/**
 * Atomically transfers a replacement document from `doc_staging` to `user_files`,
 * swaps the pointer in `public.user_documents`, purges older files from storage,
 * marks change request and outbox rows as approved/processed, and revalidates cache tags.
 */
export async function transferAndApplyDocumentReplacement(
  params: DocumentReplacementTransferParams
): Promise<{ success: boolean; error?: string; finalPath?: string }> {
  const {
    userId,
    documentTypeCode,
    stagingPath,
    stagingThumbPath,
    decidedBy,
    requestId,
    fileSizeBytes,
    mimeType,
    fileName,
  } = params;

  if (!userId || !documentTypeCode || !stagingPath) {
    return { success: false, error: "Missing required parameters for document replacement transfer." };
  }

  const admin = createSupabaseAdminClient();

  // 1. Fetch current canonical document to safely identify older files to clean up AFTER replacement
  const { data: existingDoc } = await admin
    .from("user_documents")
    .select("id, storage_path, thumb_path, mime_type, file_size_bytes, file_name")
    .eq("user_id", userId)
    .eq("document_type_code", documentTypeCode)
    .maybeSingle();

  // 2. Generate new final paths in user_files
  const fileUuid = crypto.randomUUID();
  const docType = documentTypeCode as DocType;
  const finalPath = finalDocumentPath(userId, docType, fileUuid, false);
  const finalThumbPath = stagingThumbPath
    ? finalDocumentPath(userId, docType, fileUuid, true)
    : null;

  let activeFinalPath = finalPath;
  let activeFinalThumb = finalThumbPath;
  let isReadyInUserFiles = false;

  // 3. Check and transfer main file from doc_staging to user_files
  const { error: moveErr } = await admin.storage
    .from("doc_staging")
    .move(stagingPath, finalPath, { destinationBucket: "user_files" });

  if (!moveErr) {
    isReadyInUserFiles = true;
    if (stagingThumbPath && finalThumbPath) {
      await admin.storage
        .from("doc_staging")
        .move(stagingThumbPath, finalThumbPath, { destinationBucket: "user_files" })
        .catch((e: unknown) => console.warn("[transferAndApplyDocumentReplacement] Thumb move warning:", e));
    }
  } else {
    // If move failed, check if the staged file was ALREADY transferred to user_files
    console.warn("[transferAndApplyDocumentReplacement] doc_staging move error:", moveErr.message);

    const folder = `documents/${userId}/${documentTypeCode}`;
    const { data: userFilesList } = await admin.storage.from("user_files").list(folder);

    // Extract file basename from stagingPath (e.g. 36d66475-de75-4528-999f-1b5f02de275d.jpg)
    const stagedBaseName = stagingPath.split("/").pop();
    const existingTransferred = userFilesList?.find(
      (f) =>
        f.name === `${fileUuid}.jpg` ||
        (stagedBaseName && f.name === stagedBaseName) ||
        (stagedBaseName && f.name.startsWith(stagedBaseName.replace(".jpg", "")))
    );

    if (existingTransferred) {
      activeFinalPath = `${folder}/${existingTransferred.name}`;
      const thumbFile = userFilesList?.find(
        (f) => f.name === `${existingTransferred.name.replace(".jpg", "")}_thumb.jpg`
      );
      activeFinalThumb = thumbFile ? `${folder}/${thumbFile.name}` : null;
      isReadyInUserFiles = true;
    }
  }

  if (!isReadyInUserFiles) {
    const msg = `Failed to transfer staged document for user ${userId} (${documentTypeCode}): staged file not found in doc_staging or user_files.`;
    console.error("[transferAndApplyDocumentReplacement]", msg);
    return { success: false, error: msg };
  }

  // 4. Atomically repoint user_documents via PostgreSQL RPC
  const { error: rpcErr } = await admin.rpc("apply_document_replacement_pointer", {
    p_user_id: userId,
    p_doc_type: documentTypeCode,
    p_final_storage_path: activeFinalPath,
    p_final_thumb_path: activeFinalThumb,
    p_decided_by: decidedBy || null,
    p_mime_type: existingDoc?.mime_type || mimeType || "image/jpeg",
    p_file_size_bytes: fileSizeBytes || existingDoc?.file_size_bytes || 0,
    p_file_name: existingDoc?.file_name || fileName || `${documentTypeCode}.jpg`,
    p_change_request_id: requestId || null,
  });

  if (rpcErr) {
    console.error("[transferAndApplyDocumentReplacement] RPC error, attempting direct upsert fallback:", rpcErr);
    const { error: upsertErr } = await admin.from("user_documents").upsert(
      {
        user_id: userId,
        document_type_code: documentTypeCode,
        storage_path: activeFinalPath,
        thumb_path: activeFinalThumb,
        mime_type: existingDoc?.mime_type || mimeType || "image/jpeg",
        file_size_bytes: fileSizeBytes || existingDoc?.file_size_bytes || 0,
        file_name: existingDoc?.file_name || fileName || `${documentTypeCode}.jpg`,
        verification_status: "verified",
        status: "verified",
        verified_by: decidedBy || null,
        verified_at: new Date().toISOString(),
        rejection_reason: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,document_type_code" }
    );

    if (upsertErr) {
      return { success: false, error: `Failed to update user_documents: ${upsertErr.message}` };
    }

    if (requestId) {
      await admin
        .from("document_change_requests")
        .update({
          status: "approved",
          reviewed_by: decidedBy || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);
    }
  }

  // Ensure all matching pending change requests for this user/doctype are settled
  await admin
    .from("document_change_requests")
    .update({
      status: "approved",
      reviewed_by: decidedBy || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("document_type_code", documentTypeCode)
    .eq("status", "pending");

  // 5. PURGE OLDER DOCUMENT FILES from user_files
  // Strictly after user_documents is safely pointing to the new activeFinalPath!
  if (existingDoc?.storage_path) {
    const oldFiles = [existingDoc.storage_path, existingDoc.thumb_path].filter(
      (p): p is string => Boolean(p) && p !== activeFinalPath && p !== activeFinalThumb
    );
    if (oldFiles.length > 0) {
      const { error: delErr } = await admin.storage
        .from("user_files")
        .remove(oldFiles);
      if (delErr) {
        console.warn("[transferAndApplyDocumentReplacement] Warning deleting previous document files:", delErr);
      }
    }
  }

  // Purge lingering orphaned files in this user/docType storage folder (excluding active files)
  try {
    const folder = `documents/${userId}/${documentTypeCode}`;
    const { data: lingeringFiles } = await admin.storage.from("user_files").list(folder);
    if (lingeringFiles && lingeringFiles.length > 2) {
      const activeBase = activeFinalPath.split("/").pop();
      const activeThumb = activeFinalThumb ? activeFinalThumb.split("/").pop() : null;
      const staleToPurge = lingeringFiles
        .filter((f) => f.name !== activeBase && f.name !== activeThumb)
        .map((f) => `${folder}/${f.name}`);
      if (staleToPurge.length > 0) {
        await admin.storage.from("user_files").remove(staleToPurge);
      }
    }
  } catch (cleanErr) {
    console.warn("[transferAndApplyDocumentReplacement] Storage sweep warning:", cleanErr);
  }

  // Clean up any remaining staging files from doc_staging
  try {
    const stagingFilesToClean = [stagingPath, stagingThumbPath].filter(Boolean) as string[];
    if (stagingFilesToClean.length > 0) {
      await admin.storage.from("doc_staging").remove(stagingFilesToClean);
    }
  } catch {}

  // 6. Mark corresponding approval_outbox rows as processed
  if (requestId) {
    await admin
      .from("approval_outbox")
      .update({ processed_at: new Date().toISOString() })
      .eq("topic", "file.transfer_staged_document")
      .or(`request_id.eq.${requestId},payload->>request_id.eq.${requestId}`);
  }

  // 7. Revalidate cache tags so all user profile views and approval queues immediately reflect the change
  try {
    revalidateTag(TAGS.users, "max");
    revalidateTag(TAGS.approvals, "max");
    revalidateTag(TAGS.approvalsList, "max");
    revalidateTag(TAGS.approvalsCounts, "max");
  } catch {}

  return { success: true, finalPath: activeFinalPath };
}

export interface AcknowledgeRejectedParams {
  userId: string;
  changeRequestId?: string;
  docType?: DocType;
}

export interface AcknowledgeRejectedResult {
  success: boolean;
  error?: string;
  filesRemoved?: string[];
}

/**
 * Acknowledges a rejected document replacement request:
 * 1. Verifies that the rejected change request belongs to the authenticated user.
 * 2. Purges the rejected files from doc_staging bucket.
 * 3. Updates status to 'acknowledged' with acknowledged_at timestamp.
 * 4. Logs audit entry and revalidates user profile cache tags.
 */
export async function acknowledgeRejectedDocumentReplacement(
  params: AcknowledgeRejectedParams
): Promise<AcknowledgeRejectedResult> {
  const { userId, changeRequestId, docType } = params;
  const adminSupabase = createSupabaseAdminClient();

  let query = adminSupabase
    .from("document_change_requests")
    .select("id, staging_path, staging_thumb_path, status, user_id, document_type_code")
    .eq("user_id", userId)
    .eq("status", "rejected");

  if (changeRequestId) {
    query = query.eq("id", changeRequestId);
  } else if (docType) {
    query = query.eq("document_type_code", docType);
  }

  const { data: request, error: queryErr } = await query.maybeSingle();
  if (queryErr || !request) {
    return { success: false, error: "Rejected document request not found or already acknowledged." };
  }

  // 1. Delete rejected staged files from doc_staging bucket
  const filesToRemove = [request.staging_path, request.staging_thumb_path].filter(Boolean) as string[];
  if (filesToRemove.length > 0) {
    await adminSupabase.storage
      .from("doc_staging")
      .remove(filesToRemove)
      .catch((e: unknown) => console.warn("[Acknowledge] doc_staging clean warning:", e));
  }

  // 2. Update status to 'acknowledged' with acknowledged_at timestamp
  const { error: updateErr } = await adminSupabase
    .from("document_change_requests")
    .update({
      status: "acknowledged",
      acknowledged_at: new Date().toISOString(),
    })
    .eq("id", request.id);

  if (updateErr) {
    console.error("[Acknowledge] Update status error:", updateErr);
    // If constraint fails for any reason, fallback to delete
    await adminSupabase.from("document_change_requests").delete().eq("id", request.id);
  }

  // 3. Log audit
  await logAudit({
    action: "document.replacement_rejection_acknowledged",
    entity_type: "document_change_requests",
    entity_id: request.id,
    user_id: userId,
    target_user_id: userId,
    metadata: {
      document_type: request.document_type_code,
      files_removed: filesToRemove,
    },
  });

  // 4. Revalidate cache
  try {
    revalidateTag(TAGS.users, "max");
    revalidateTag(TAGS.approvals, "max");
  } catch {}

  return { success: true, filesRemoved: filesToRemove };
}

