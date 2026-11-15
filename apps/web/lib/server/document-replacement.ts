import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { DOC_UPLOAD, type DocType, isDocType, DOCUMENT_ERROR_MESSAGES } from "@reachinternational/utils";
import { submitToApprovalEngineSafely } from "./approval-engine-bridge";
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

  // 3. Check for existing pending request: if one exists, update it with the new staging image
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

  if (existingPending) {
    const { error: updateErr } = await adminSupabase
      .from("document_change_requests")
      .update({
        staging_path: mainStagingPath,
        staging_thumb_path: thumbFile ? thumbStagingPath : null,
        created_at: new Date().toISOString(),
      })
      .eq("id", existingPending.id);

    if (updateErr) {
      console.error("[Replacement] Update existing change request error:", updateErr);
      return { success: false, error: "Failed to update pending replacement request." };
    }

    await logAudit({
      action: "document.replacement_updated",
      entity_type: "document_change_request",
      entity_id: existingPending.id,
      user_id: userId,
      target_user_id: userId,
      metadata: {
        document_type: docType,
        staging_path: mainStagingPath,
        request_id: existingPending.id,
      },
    });

    return {
      success: true,
      approvedImmediately: false,
      requestId: existingPending.id,
      message: "Replacement request updated with new image and submitted for administrator review.",
    };
  }

  // 4. Check if document type requires approval
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

  // Requires approval: create pending request in document_change_requests
  const { data: requestRow, error: insertErr } = await adminSupabase
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

  if (insertErr || !requestRow) {
    console.error("[Replacement] Insert change request error:", insertErr);
    if (insertErr?.code === "23505") {
      return { success: false, error: DOCUMENT_ERROR_MESSAGES.DUPLICATE_PENDING_REQUEST };
    }
    return { success: false, error: "Failed to submit replacement request." };
  }

  await logAudit({
    action: "document.replacement_requested",
    entity_type: "document_change_request",
    entity_id: requestRow.id,
    user_id: userId,
    target_user_id: userId,
    metadata: {
      document_type: docType,
      staging_path: mainStagingPath,
      request_id: requestRow.id,
    },
  });

  // Submit to Centralized Approval Engine
  await submitToApprovalEngineSafely({
    type_key: "document_replace",
    subject_type: "document",
    subject_id: requestRow.id,
    subject_label: `${docType.toUpperCase()} replacement`,
    requested_by: userId,
    summary: `Document replacement request for ${docType}`,
    payload: {
      user_id: userId,
      document_type_code: docType,
      staging_path: mainStagingPath,
      staging_thumb_path: thumbFile ? thumbStagingPath : null,
      request_id: requestRow.id,
    },
  });

  return {
    success: true,
    approvedImmediately: false,
    requestId: requestRow.id,
    message: "Replacement request submitted for administrator review.",
  };
}
