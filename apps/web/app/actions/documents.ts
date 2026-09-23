"use server";

import { revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { verifySession, getCurrentUserRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { CACHE_TAGS } from "@/lib/cache";

// ─── Types ──────────────────────────────────────────────────────────

export interface UserDocument {
  id: string;
  user_id: string;
  document_type_code: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  created_at: string;
  updated_at: string;
  signed_url?: string | null;
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
    .neq("code", "profile_photo")
    .order("code");

  if (error || !data) return [];
  return (data as DocumentType[]).filter((d) => d.code !== "profile_photo");
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
  const supabase = await createSupabaseServerClient();
  const userId = targetUserId || session.userId;

  // RLS enforces access — no app-side role check needed
  const { data: docs, error } = await supabase
    .from("user_documents")
    .select("id, user_id, document_type_code, storage_path, mime_type, file_size_bytes, created_at, updated_at")
    .eq("user_id", userId)
    .order("document_type_code");

  if (error || !docs) return [];

  // Generate short-lived signed URLs for each document
  const withUrls: UserDocument[] = await Promise.all(
    docs.map(async (doc) => {
      const { data: urlData } = await supabase.storage
        .from("user_files")
        .createSignedUrl(doc.storage_path, 180); // 3-minute expiry

      return {
        ...doc,
        signed_url: urlData?.signedUrl || null,
      } as UserDocument;
    })
  );

  return withUrls;
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
    const supabase = await createSupabaseServerClient();

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
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("user_documents")
      .select("id, user_id, document_type_code, storage_path, mime_type, file_size_bytes, file_name, status");

    if (params.documentId) {
      query = query.eq("id", params.documentId);
    } else if (params.documentTypeCode) {
      const ownerId = params.targetUserId || session.userId;
      query = query.eq("user_id", ownerId).eq("document_type_code", params.documentTypeCode);
    } else {
      return { success: false, error: "Missing document identifier." };
    }

    const { data: doc, error } = await query.maybeSingle();

    if (error || !doc) {
      return { success: false, error: "Document not found." };
    }

    // Authorization check: owner or privileged role
    const isOwner = doc.user_id === session.userId;
    const isPrivileged = ["super_admin", "admin", "hr"].includes(role);

    if (!isOwner && !isPrivileged) {
      return { success: false, error: "Unauthorized to view this document." };
    }

    // Generate short-lived (120 seconds) signed URL
    const { data: urlData, error: storageError } = await supabase.storage
      .from("user_files")
      .createSignedUrl(doc.storage_path, 120);

    if (storageError || !urlData?.signedUrl) {
      return { success: false, error: "Failed to generate secure preview link." };
    }

    // Audit log
    void logAudit({
      action: "document.viewed",
      entity_type: "user_document",
      entity_id: doc.id,
      user_id: session.userId,
      metadata: {
        document_type: doc.document_type_code,
        owner_id: doc.user_id,
        mime_type: doc.mime_type,
        viewer_role: role,
      },
    });

    const title =
      doc.document_type_code === "aadhaar"
        ? "Aadhaar Card"
        : doc.document_type_code === "driving_license"
        ? "Driving Licence"
        : "Identity Document";

    return {
      success: true,
      signedUrl: urlData.signedUrl,
      mimeType: doc.mime_type,
      fileName: doc.file_name || doc.storage_path.split("/").pop(),
      fileSizeBytes: doc.file_size_bytes,
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
