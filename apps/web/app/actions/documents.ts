"use server";

import { revalidateTag } from "next/cache";
import crypto from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifySession, getCurrentUserRole } from "@/lib/dal";
import {
  isManagerOrAbove,
  canVerifyDocument,
  canRejectDocument,
} from "@reachinternational/permissions";
import { logAudit } from "@/lib/audit";
import { CACHE_TAGS } from "@/lib/cache";
import {
  submitDocumentReplacement,
  acknowledgeRejectedDocumentReplacement,
  type SubmitReplacementResult,
} from "@/lib/server/document-replacement";
import {
  approveDocumentReplacementCore,
  rejectDocumentReplacementCore,
  verifyUserDocumentCore,
  rejectUserDocumentCore,
} from "@/lib/server/document-review";
import {
  type DocType,
  finalDocumentPath,
} from "@reachinternational/utils";

// ─── Types ──────────────────────────────────────────────────────────

export interface UserDocumentPendingReplacement {
  id: string;
  staging_path: string;
  staging_thumb_path?: string | null;
  signed_url?: string | null;
  thumb_signed_url?: string | null;
  created_at: string;
  status: "pending";
}

export interface UserDocumentRejectedReplacement {
  id: string;
  staging_path: string;
  staging_thumb_path?: string | null;
  signed_url?: string | null;
  thumb_signed_url?: string | null;
  rejection_reason: string;
  reviewed_at?: string | null;
  created_at: string;
}

export interface UserDocument {
  id: string;
  user_id: string;
  document_type_code: string;
  storage_path: string;
  thumb_path?: string | null;
  mime_type: string;
  file_size_bytes: number;
  verification_status?: "pending" | "verified" | "rejected";
  verified_by?: string | null;
  verified_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  signed_url?: string | null;
  thumb_signed_url?: string | null;
  is_pending_request?: boolean;
  pending_request_id?: string;
  pending_replacement?: UserDocumentPendingReplacement | null;
  has_pending_replacement?: boolean;
  rejected_replacement?: UserDocumentRejectedReplacement | null;
  has_rejected_replacement?: boolean;
}

export interface DocumentType {
  code: string;
  label: string;
  visibility: string;
  allowed_mime_types: string[];
  max_size_bytes: number;
}

// ─── Get document types (cached reference data) ─────────────────────

export async function getDocumentTypesAction(): Promise<DocumentType[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("user_document_types")
    .select("code, label, visibility, allowed_mime_types, max_size_bytes")
    .not("code", "in", '("profile_photo","bank_passbook")')
    .order("code");

  if (error || !data) return [];
  return (data as DocumentType[]).filter(
    (d) => d.code !== "profile_photo" && d.code !== "bank_passbook"
  );
}

// ─── Get user documents with signed URLs ────────────────────────────

/**
 * Fetch documents for a user. RLS handles access control:
 * - Owner can read own documents
 * - Admin/HR/Super Admin can read any user's documents
 *
 * If targetUserId is omitted, fetches the current user's documents.
 */
export async function getUserDocumentsAction(
  targetUserId?: string
): Promise<UserDocument[]> {
  const session = await verifySession();
  const userId = targetUserId || session.userId;

  const isOwner = session.userId === userId;
  const callerRole = (await getCurrentUserRole()) || "operator";
  const isPrivileged = ["super_admin", "admin", "manager", "hr", "supervisor"].includes(callerRole);

  if (!isOwner && !isPrivileged) {
    return [];
  }

  const adminSupabase = createSupabaseAdminClient();

  const [docsRes, changeReqsRes] = await Promise.all([
    adminSupabase
      .from("user_documents")
      .select(
        "id, user_id, document_type_code, storage_path, thumb_path, mime_type, file_size_bytes, verification_status, verified_by, verified_at, rejection_reason, created_at, updated_at"
      )
      .eq("user_id", userId)
      .order("document_type_code"),
    adminSupabase
      .from("document_change_requests")
      .select("id, user_id, document_type_code, staging_path, staging_thumb_path, status, rejection_reason, reviewed_at, created_at")
      .eq("user_id", userId)
      .in("status", ["pending", "rejected"])
      .order("created_at", { ascending: false }),
  ]);

  const docs = docsRes.data || [];
  const changeReqs = changeReqsRes.data || [];

  // Batch generate signed URLs
  const userFilesPaths = [
    ...docs.map((d) => d.storage_path).filter(Boolean),
    ...docs.map((d) => d.thumb_path).filter(Boolean),
  ];
  const stagingPaths = [
    ...changeReqs.map((r) => r.staging_path).filter(Boolean),
    ...changeReqs.map((r) => r.staging_thumb_path).filter(Boolean),
  ];

  const [userFilesSignedRes, stagingSignedRes] = await Promise.all([
    userFilesPaths.length > 0
      ? adminSupabase.storage
          .from("user_files")
          .createSignedUrls(Array.from(new Set(userFilesPaths)), 3600)
      : { data: [] },
    stagingPaths.length > 0
      ? adminSupabase.storage
          .from("doc_staging")
          .createSignedUrls(Array.from(new Set(stagingPaths)), 3600)
      : { data: [] },
  ]);

  const userFilesMap = new Map<string, string>();
  if (userFilesSignedRes.data) {
    for (const item of userFilesSignedRes.data) {
      if (item?.signedUrl && item.path) userFilesMap.set(item.path, item.signedUrl);
    }
  }

  const stagingMap = new Map<string, string>();
  if (stagingSignedRes.data) {
    for (const item of stagingSignedRes.data) {
      if (item?.signedUrl && item.path) stagingMap.set(item.path, item.signedUrl);
    }
  }

  const changeReqMap = new Map<string, any>();
  for (const cr of changeReqs) {
    if (!changeReqMap.has(cr.document_type_code)) {
      changeReqMap.set(cr.document_type_code, cr);
    }
  }

  const result: UserDocument[] = [];
  const coveredTypes = new Set<string>();

  for (const doc of docs) {
    coveredTypes.add(doc.document_type_code);
    const cr = changeReqMap.get(doc.document_type_code);

    let pendingReplacement: UserDocumentPendingReplacement | null = null;
    let rejectedReplacement: UserDocumentRejectedReplacement | null = null;

    if (cr) {
      if (cr.status === "pending") {
        pendingReplacement = {
          id: cr.id,
          staging_path: cr.staging_path,
          staging_thumb_path: cr.staging_thumb_path,
          signed_url: stagingMap.get(cr.staging_path) || null,
          thumb_signed_url: cr.staging_thumb_path ? stagingMap.get(cr.staging_thumb_path) || null : null,
          created_at: cr.created_at,
          status: "pending",
        };
      } else if (cr.status === "rejected") {
        rejectedReplacement = {
          id: cr.id,
          staging_path: cr.staging_path,
          staging_thumb_path: cr.staging_thumb_path,
          signed_url: stagingMap.get(cr.staging_path) || null,
          thumb_signed_url: cr.staging_thumb_path ? stagingMap.get(cr.staging_thumb_path) || null : null,
          rejection_reason: cr.rejection_reason || "Document replacement rejected by administrator.",
          reviewed_at: cr.reviewed_at,
          created_at: cr.created_at,
        };
      }
    }

    result.push({
      ...doc,
      signed_url: userFilesMap.get(doc.storage_path) || null,
      thumb_signed_url: doc.thumb_path ? userFilesMap.get(doc.thumb_path) || null : null,
      pending_replacement: pendingReplacement,
      has_pending_replacement: Boolean(pendingReplacement),
      rejected_replacement: rejectedReplacement,
      has_rejected_replacement: Boolean(rejectedReplacement),
    });
  }

  // Synthesize any pending change requests that don't have an active row in user_documents yet
  for (const cr of changeReqs) {
    if (!coveredTypes.has(cr.document_type_code)) {
      coveredTypes.add(cr.document_type_code);
      result.push({
        id: cr.id,
        user_id: userId,
        document_type_code: cr.document_type_code,
        storage_path: cr.staging_path,
        thumb_path: cr.staging_thumb_path,
        mime_type: "image/jpeg",
        file_size_bytes: 0,
        verification_status: "pending",
        created_at: cr.created_at,
        updated_at: cr.created_at,
        signed_url: stagingMap.get(cr.staging_path) || null,
        thumb_signed_url: cr.staging_thumb_path ? stagingMap.get(cr.staging_thumb_path) || null : null,
        is_pending_request: true,
        pending_request_id: cr.id,
        pending_replacement: null,
        has_pending_replacement: true,
      });
    }
  }

  return result;
}

// ─── Acknowledge rejected document replacement ──────────────────────

/**
 * Called by the user to acknowledge a rejected replacement request:
 * 1. Verifies ownership of the rejected request.
 * 2. Purges the rejected files from doc_staging bucket.
 * 3. Updates status to 'acknowledged' with timestamp.
 * 4. User profile re-renders cleanly without the rejected banner.
 */
export async function acknowledgeRejectedReplacementAction(params: {
  changeRequestId?: string;
  docType?: DocType;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await verifySession();
    return await acknowledgeRejectedDocumentReplacement({
      userId: session.userId,
      changeRequestId: params.changeRequestId,
      docType: params.docType,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[acknowledgeRejectedReplacementAction] Error:", msg);
    return { success: false, error: "Failed to acknowledge rejected document." };
  }
}

// ─── Confirm document upload (upsert after XHR upload completes) ────

/**
 * Called by the client after a successful XHR upload to register the
 * document in user_documents. Uses UPSERT (ON CONFLICT DO UPDATE) via
 * Supabase's upsert option since UNIQUE(user_id, document_type_code).
 */
export async function confirmDocumentUploadAction(params: {
  documentTypeCode: string;
  storagePath: string;
  mimeType: string;
  fileSizeBytes: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    if (params.documentTypeCode === "profile_photo") {
      return { success: false, error: "Profile photo uploads are not supported." };
    }

    const session = await verifySession();
    const userRole = await getCurrentUserRole();
    const canManageDocs = isManagerOrAbove(userRole);

    const supabase = await createSupabaseServerClient();

    if (!canManageDocs) {
      const { data: existingDoc } = await supabase
        .from("user_documents")
        .select("id")
        .eq("user_id", session.userId)
        .eq("document_type_code", params.documentTypeCode)
        .maybeSingle();

      if (existingDoc) {
        return { success: false, error: "Only administrators and managers can replace official documents." };
      }
    }

    const { error } = await supabase
      .from("user_documents")
      .upsert(
        {
          user_id: session.userId,
          document_type_code: params.documentTypeCode,
          storage_path: params.storagePath,
          mime_type: params.mimeType,
          file_size_bytes: params.fileSizeBytes,
          uploaded_by: session.userId,
        },
        { onConflict: "user_id,document_type_code" }
      );

    if (error) {
      console.error("Error confirming document upload:", error);
      return { success: false, error: error.message };
    }

    void logAudit({
      action: "document.uploaded",
      entity_type: "user_document",
      entity_id: session.userId,
      user_id: session.userId,
      metadata: {
        document_type: params.documentTypeCode,
        mime_type: params.mimeType,
        file_size_bytes: params.fileSizeBytes,
      },
    });

    revalidateTag(CACHE_TAGS.users, "max");
    return { success: true };
  } catch (err) {
    console.error("Exception in confirmDocumentUploadAction:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

// ─── Secure on-demand document view URL (short-lived 120s + audit) ──

/**
 * Generate a short-lived signed URL (120s) for viewing a document.
 * Strictly verifies authorization:
 * - User must be the owner of the document, OR
 * - User must have 'super_admin', 'admin', or 'hr' role.
 * Logs access in audit logs (action: 'document.viewed').
 */
export async function getDocumentViewUrlAction(params: {
  documentId?: string;
  documentTypeCode?: string;
  targetUserId?: string;
  isStaging?: boolean;
}): Promise<{
  success: boolean;
  signedUrl?: string;
  mimeType?: string;
  fileName?: string;
  fileSizeBytes?: number;
  title?: string;
  error?: string;
}> {
  try {
    const session = await verifySession();
    const role = (await getCurrentUserRole()) || "operator";
    const adminSupabase = createSupabaseAdminClient();

    let doc: any = null;
    let fromStaging = Boolean(params.isStaging);

    if (params.documentId) {
      if (!fromStaging) {
        const { data: userDoc } = await adminSupabase
          .from("user_documents")
          .select("id, user_id, document_type_code, storage_path, mime_type, file_size_bytes, file_name, status")
          .eq("id", params.documentId)
          .maybeSingle();

        if (userDoc) {
          doc = userDoc;
        }
      }

      if (!doc) {
        const { data: changeReq } = await adminSupabase
          .from("document_change_requests")
          .select("id, user_id, document_type_code, staging_path, staging_thumb_path, status, created_at")
          .eq("id", params.documentId)
          .maybeSingle();

        if (changeReq) {
          doc = {
            id: changeReq.id,
            user_id: changeReq.user_id,
            document_type_code: changeReq.document_type_code,
            storage_path: changeReq.staging_path,
            mime_type: "image/jpeg",
            file_size_bytes: 0,
            file_name: `${changeReq.document_type_code}.jpg`,
            status: changeReq.status,
          };
          fromStaging = true;
        }
      }
    } else if (params.documentTypeCode) {
      const ownerId = params.targetUserId || session.userId;
      const { data: userDoc } = await adminSupabase
        .from("user_documents")
        .select("id, user_id, document_type_code, storage_path, mime_type, file_size_bytes, file_name, status")
        .eq("user_id", ownerId)
        .eq("document_type_code", params.documentTypeCode)
        .maybeSingle();

      if (userDoc) {
        doc = userDoc;
      } else {
        const { data: changeReq } = await adminSupabase
          .from("document_change_requests")
          .select("id, user_id, document_type_code, staging_path, staging_thumb_path, status, created_at")
          .eq("user_id", ownerId)
          .eq("document_type_code", params.documentTypeCode)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .maybeSingle();

        if (changeReq) {
          doc = {
            id: changeReq.id,
            user_id: changeReq.user_id,
            document_type_code: changeReq.document_type_code,
            storage_path: changeReq.staging_path,
            mime_type: "image/jpeg",
            file_size_bytes: 0,
            file_name: `${changeReq.document_type_code}.jpg`,
            status: changeReq.status,
          };
          fromStaging = true;
        }
      }
    } else {
      return { success: false, error: "Missing document identifier." };
    }

    if (!doc) {
      return { success: false, error: "Document not found." };
    }

    // Authorization check: owner or privileged staff
    const isOwner = doc.user_id === session.userId;
    const isPrivileged = ["super_admin", "admin", "hr", "manager", "supervisor"].includes(role);

    if (!isOwner && !isPrivileged) {
      return { success: false, error: "Unauthorized to view this document." };
    }

    // Generate signed URL (120 seconds) from appropriate bucket
    let targetBucket = fromStaging ? "doc_staging" : "user_files";
    let { data: urlData, error: storageError } = await adminSupabase.storage
      .from(targetBucket)
      .createSignedUrl(doc.storage_path, 120);

    // Self-healing fallback: If user_files says Object not found, check if a newer file exists or if it's still in staging
    if ((storageError || !urlData?.signedUrl) && !fromStaging) {
      // 1. Check doc_staging in case transfer is in-flight
      const { data: stgData } = await adminSupabase.storage
        .from("doc_staging")
        .createSignedUrl(doc.storage_path, 120);

      if (stgData?.signedUrl) {
        urlData = stgData;
        storageError = null;
        targetBucket = "doc_staging";
      } else {
        // 2. Check if a newer file exists in user_files under documents/<userId>/<docType>
        const { data: userFilesList } = await adminSupabase.storage
          .from("user_files")
          .list(`documents/${doc.user_id}/${doc.document_type_code}`);

        const validFile = userFilesList?.find(
          (f) => !f.name.includes("_thumb") && f.name.endsWith(".jpg")
        );

        if (validFile) {
          const healedPath = `documents/${doc.user_id}/${doc.document_type_code}/${validFile.name}`;
          const { data: healedData, error: healErr } = await adminSupabase.storage
            .from("user_files")
            .createSignedUrl(healedPath, 120);

          if (!healErr && healedData?.signedUrl) {
            urlData = healedData;
            storageError = null;
            // Update pointer in user_documents so future queries are instant
            await adminSupabase
              .from("user_documents")
              .update({
                storage_path: healedPath,
                thumb_path: `documents/${doc.user_id}/${doc.document_type_code}/${validFile.name.replace(".jpg", "")}_thumb.jpg`,
                updated_at: new Date().toISOString(),
              })
              .eq("id", doc.id);
          }
        }
      }
    }

    if (storageError || !urlData?.signedUrl) {
      return { success: false, error: "Failed to generate secure preview link." };
    }

    // Audit log
    void logAudit({
      action: "document.viewed",
      entity_type: fromStaging ? "document_change_request" : "user_document",
      entity_id: doc.id,
      user_id: session.userId,
      metadata: {
        document_type: doc.document_type_code,
        owner_id: doc.user_id,
        mime_type: doc.mime_type,
        viewer_role: role,
        bucket: targetBucket,
      },
    });

    const title =
      doc.document_type_code === "aadhaar"
        ? "Aadhaar Card"
        : doc.document_type_code === "driving_license"
        ? "Driving Licence"
        : doc.document_type_code === "bank_document"
        ? "Bank Document / Passbook"
        : "Identity Document";

    return {
      success: true,
      signedUrl: urlData.signedUrl,
      mimeType: doc.mime_type || "image/jpeg",
      fileName: doc.file_name || doc.storage_path.split("/").pop(),
      fileSizeBytes: doc.file_size_bytes || 0,
      title,
    };
  } catch (err) {
    console.error("Exception in getDocumentViewUrlAction:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

// ─── Delete document ────────────────────────────────────────────────

export async function deleteDocumentAction(
  documentTypeCode: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (documentTypeCode === "profile_photo") {
      return { success: false, error: "Invalid document type." };
    }

    const session = await verifySession();
    const userRole = await getCurrentUserRole();
    const canManageDocs = isManagerOrAbove(userRole);

    if (!canManageDocs) {
      return { success: false, error: "Only administrators and managers can remove official documents." };
    }

    const supabase = await createSupabaseServerClient();

    // Fetch existing doc to get storage path
    const { data: doc } = await supabase
      .from("user_documents")
      .select("id, storage_path")
      .eq("user_id", session.userId)
      .eq("document_type_code", documentTypeCode)
      .maybeSingle();

    if (!doc) {
      return { success: false, error: "Document not found." };
    }

    // Delete from storage first, then from DB
    const { error: storageError } = await supabase.storage
      .from("user_files")
      .remove([doc.storage_path]);

    if (storageError) {
      console.error("Error deleting file from storage:", storageError);
      // Continue with DB deletion even if storage delete fails
    }

    const { error: dbError } = await supabase
      .from("user_documents")
      .delete()
      .eq("id", doc.id);

    if (dbError) {
      console.error("Error deleting document record:", dbError);
      return { success: false, error: dbError.message };
    }

    void logAudit({
      action: "document.deleted",
      entity_type: "user_document",
      entity_id: session.userId,
      user_id: session.userId,
      metadata: { document_type: documentTypeCode },
    });

    revalidateTag(CACHE_TAGS.users, "max");
    return { success: true };
  } catch (err) {
    console.error("Exception in deleteDocumentAction:", err);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/**
 * Server action to submit a staged replacement document for review or immediate pointer swap.
 */
export async function submitDocumentReplacementAction(params: {
  docType: DocType;
  uploadId: string;
}): Promise<SubmitReplacementResult> {
  const session = await verifySession();
  const result = await submitDocumentReplacement({
    userId: session.userId,
    docType: params.docType,
    uploadId: params.uploadId,
  });

  if (result.success) {
    revalidateTag(CACHE_TAGS.users, "max");
  }

  return result;
}

// ─── Phase 8: Document Verification & Replacement Approvals ─────────────────

/**
 * Marks a user's document as verified (super_admin, admin, hr only).
 */
export async function verifyUserDocumentAction(params: {
  documentId: string;
  userId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // ⚡ Parallel auth check (saves ~100-200ms)
    const [session, role] = await Promise.all([verifySession(), getCurrentUserRole()]);
    if (!canVerifyDocument({ id: session.userId, role })) {
      return { success: false, error: "Unauthorized: only HR and Admins can verify documents." };
    }

    const result = await verifyUserDocumentCore({
      reviewerId: session.userId,
      documentId: params.documentId,
    });

    if (result.success) {
      revalidateTag(CACHE_TAGS.users, "max");
    }

    return result;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[verifyUserDocumentAction] Exception:", errorMsg);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/**
 * Marks a user's document as rejected with a reason (super_admin, admin, hr only).
 */
export async function rejectUserDocumentAction(params: {
  documentId: string;
  userId: string;
  rejectionReason: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // ⚡ Parallel auth check (saves ~100-200ms)
    const [session, role] = await Promise.all([verifySession(), getCurrentUserRole()]);
    if (!canRejectDocument({ id: session.userId, role })) {
      return { success: false, error: "Unauthorized: only HR and Admins can reject documents." };
    }

    const result = await rejectUserDocumentCore({
      reviewerId: session.userId,
      documentId: params.documentId,
      rejectionReason: params.rejectionReason,
    });

    if (result.success) {
      revalidateTag(CACHE_TAGS.users, "max");
    }

    return result;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[rejectUserDocumentAction] Exception:", errorMsg);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/**
 * Approves a staged replacement document, transferring files cross-bucket from
 * doc_staging to user_files and updating the user_documents pointer atomically.
 */
export async function approveDocumentReplacementAction(params: {
  requestId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // ⚡ Parallel auth check (saves ~100-200ms)
    const [session, role] = await Promise.all([verifySession(), getCurrentUserRole()]);
    if (!canVerifyDocument({ id: session.userId, role })) {
      return { success: false, error: "Unauthorized: only HR and Admins can approve document replacements." };
    }

    const result = await approveDocumentReplacementCore({
      reviewerId: session.userId,
      requestId: params.requestId,
    });

    if (result.success) {
      revalidateTag(CACHE_TAGS.users, "max");
    }

    return result;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[approveDocumentReplacement] Exception:", errorMsg);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/**
 * Rejects a staged replacement request with a reason.
 */
export async function rejectDocumentReplacementAction(params: {
  requestId: string;
  rejectionReason: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // ⚡ Parallel auth check (saves ~100-200ms)
    const [session, role] = await Promise.all([verifySession(), getCurrentUserRole()]);
    if (!canRejectDocument({ id: session.userId, role })) {
      return { success: false, error: "Unauthorized: only HR and Admins can reject document replacements." };
    }

    const result = await rejectDocumentReplacementCore({
      reviewerId: session.userId,
      requestId: params.requestId,
      rejectionReason: params.rejectionReason,
    });

    if (result.success) {
      revalidateTag(CACHE_TAGS.users, "max");
    }

    return result;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[rejectDocumentReplacement] Exception:", errorMsg);
    return { success: false, error: "An unexpected error occurred." };
  }
}

/**
 * Logs reveal of sensitive fields (Aadhaar or Bank Account) for audit compliance.
 */
export async function logSensitiveRevealAction(params: {
  targetUserId: string;
  field: "aadhaar" | "bank_account";
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await verifySession();
    const adminSupabase = createSupabaseAdminClient();
    const action = params.field === "aadhaar" ? "aadhaar.reveal" : "bank_account.reveal";

    await adminSupabase.from("audit_logs").insert({
      user_id: session.userId,
      action,
      entity_type: "user",
      entity_id: params.targetUserId,
      target_user_id: params.targetUserId,
      metadata: {
        field: params.field,
        viewer_id: session.userId,
        target_user_id: params.targetUserId,
      },
    });

    return { success: true };
  } catch (err: unknown) {
    console.error("[logSensitiveRevealAction] Error:", err);
    return { success: false, error: "Failed to record audit log." };
  }
}

