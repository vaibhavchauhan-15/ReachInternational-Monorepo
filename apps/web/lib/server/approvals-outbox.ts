import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { finalDocumentPath, type DocType } from "@reachinternational/utils";
import { revalidateTag } from "next/cache";
import { TAGS } from "@/lib/cache/tags";
import crypto from "node:crypto";

/**
 * Process pending approval outbox items directly (fast-path side-effect processor).
 * Handles push notifications, staged document migrations, and status updates.
 */
export async function processPendingApprovalOutboxItems(limit = 25): Promise<{ success: boolean; processed: number; error?: string }> {
  try {
    const admin = createSupabaseAdminClient();

    // 1. Fetch pending outbox rows
    const { data: items, error: fetchErr } = await admin
      .from("approval_outbox")
      .select("*")
      .is("processed_at", null)
      .order("id", { ascending: true })
      .limit(limit);

    if (fetchErr) {
      console.error("[ApprovalOutbox] Error fetching pending items:", fetchErr);
      return { success: false, processed: 0, error: fetchErr.message };
    }

    if (!items || items.length === 0) {
      return { success: true, processed: 0 };
    }

    let processedCount = 0;

    for (const item of items) {
      try {
        const topic = item.topic;
        const payload = (item.payload || {}) as Record<string, any>;

        // ─── Topic: approval.submitted ──────────────────────────────────
        if (topic === "approval.submitted") {
          const typeKey = payload.type_key;
          const summary = payload.summary || "New approval request pending review";
          const requestId = payload.request_id || item.request_id;

          // Lookup approver roles for this type
          const { data: typeRow } = await admin
            .from("approval_types")
            .select("approver_roles, label")
            .eq("key", typeKey)
            .maybeSingle();

          const roles = typeRow?.approver_roles || ["admin", "super_admin", "hr"];

          // Query eligible approvers
          const { data: approvers } = await admin
            .from("users")
            .select("id")
            .in("role", roles)
            .eq("status", "active")
            .limit(20);

          for (const approver of approvers || []) {
            try {
              await admin.rpc("enqueue_notification", {
                p_user_id: approver.id,
                p_category: "approvals",
                p_priority: "normal",
                p_title: `Approval Required: ${typeRow?.label || typeKey}`,
                p_body: summary,
                p_deep_link: `/approvals?id=${requestId}`,
                p_dedupe_key: `approval:submit:${requestId}:${approver.id}`,
                p_source: "approval_outbox:submit",
              });
            } catch {}
          }
        }

        // ─── Topic: approval.decided ────────────────────────────────────
        else if (topic === "approval.decided") {
          const requestedBy = payload.requested_by;
          const decision = payload.decision;
          const status = payload.status || (decision === "approve" ? "approved" : "rejected");
          const note = payload.note;
          const typeKey = payload.type_key;
          const requestId = payload.request_id || item.request_id;

          if (requestedBy) {
            const isApproved = status === "approved";
            const title = isApproved
              ? `Request Approved: ${typeKey}`
              : `Request Rejected: ${typeKey}`;
            const body = isApproved
              ? "Your request has been approved by the management team."
              : `Your request was not approved.${note ? ` Reason: ${note}` : ""}`;

            try {
              await admin.rpc("enqueue_notification", {
                p_user_id: requestedBy,
                p_category: "approvals",
                p_priority: isApproved ? "normal" : "high",
                p_title: title,
                p_body: body,
                p_deep_link: `/approvals?id=${requestId}`,
                p_dedupe_key: `approval:decide:${requestId}:${status}`,
                p_source: "approval_outbox:decide",
              });
            } catch {}
          }
        }

        // ─── Topic: file.transfer_staged_document ───────────────────────
        else if (topic === "file.transfer_staged_document") {
          const userId = payload.user_id;
          const docTypeCode = payload.document_type_code as DocType;
          const stagingPath = payload.staging_path;
          const stagingThumbPath = payload.staging_thumb_path;
          const decidedBy = payload.decided_by || null;
          const reqId = payload.request_id || item.request_id;
          const mimeType = payload.mime_type || "image/jpeg";
          const fileSizeBytes = typeof payload.file_size_bytes === "number" ? payload.file_size_bytes : 0;
          const fileName = payload.file_name || `${docTypeCode}.jpg`;

          if (userId && docTypeCode && stagingPath) {
            // 1. Fetch current canonical document to delete after successful replacement
            const { data: existingDoc } = await admin
              .from("user_documents")
              .select("id, storage_path, thumb_path, mime_type, file_size_bytes, file_name")
              .eq("user_id", userId)
              .eq("document_type_code", docTypeCode)
              .maybeSingle();

            const fileUuid = crypto.randomUUID();
            const finalPath = finalDocumentPath(userId, docTypeCode, fileUuid, false);
            const finalThumb = stagingThumbPath
              ? finalDocumentPath(userId, docTypeCode, fileUuid, true)
              : null;

            // 2. Move main document from doc_staging to user_files
            let isFileReadyInUserFiles = false;
            let activeFinalPath = finalPath;
            let activeFinalThumb = finalThumb;

            const { error: moveErr } = await admin.storage
              .from("doc_staging")
              .move(stagingPath, finalPath, { destinationBucket: "user_files" });

            if (moveErr) {
              console.warn("[ApprovalOutbox] Document move error/warning:", moveErr);
              // Check if the file was already moved or already exists at a destination in user_files
              const { data: userFilesList } = await admin.storage
                .from("user_files")
                .list(`documents/${userId}/${docTypeCode}`);

              const validFile = userFilesList?.find((f) => !f.name.includes("_thumb") && f.name.endsWith(".jpg"));
              if (validFile) {
                activeFinalPath = `documents/${userId}/${docTypeCode}/${validFile.name}`;
                const thumbFile = userFilesList?.find((f) => f.name === `${validFile.name.replace(".jpg", "")}_thumb.jpg`);
                activeFinalThumb = thumbFile ? `documents/${userId}/${docTypeCode}/${thumbFile.name}` : null;
                isFileReadyInUserFiles = true;
              }
            } else {
              isFileReadyInUserFiles = true;
              // 3. Move thumbnail if present
              if (stagingThumbPath && finalThumb) {
                await admin.storage
                  .from("doc_staging")
                  .move(stagingThumbPath, finalThumb, { destinationBucket: "user_files" })
                  .catch((e: unknown) => console.warn("[ApprovalOutbox] Thumb move warn:", e));
              }
            }

            if (!isFileReadyInUserFiles) {
              throw new Error(`Failed to transfer staged document for user ${userId} (${docTypeCode})`);
            }

            // 4. Atomically repoint user_documents via RPC
            const { error: rpcErr } = await admin.rpc("apply_document_replacement_pointer", {
              p_user_id: userId,
              p_doc_type: docTypeCode,
              p_final_storage_path: activeFinalPath,
              p_final_thumb_path: activeFinalThumb,
              p_decided_by: decidedBy,
              p_mime_type: existingDoc?.mime_type || mimeType,
              p_file_size_bytes: fileSizeBytes || existingDoc?.file_size_bytes || 0,
              p_file_name: existingDoc?.file_name || fileName,
              p_change_request_id: reqId,
            });

            if (rpcErr) {
              console.error("[ApprovalOutbox] RPC error, falling back to direct upsert:", rpcErr);
              const { error: upsertErr } = await admin.from("user_documents").upsert(
                {
                  user_id: userId,
                  document_type_code: docTypeCode,
                  storage_path: activeFinalPath,
                  thumb_path: activeFinalThumb,
                  mime_type: existingDoc?.mime_type || mimeType,
                  file_size_bytes: fileSizeBytes || existingDoc?.file_size_bytes || 0,
                  file_name: existingDoc?.file_name || fileName,
                  verification_status: "verified",
                  status: "verified",
                  verified_by: decidedBy,
                  verified_at: new Date().toISOString(),
                  rejection_reason: null,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id,document_type_code" }
              );

              if (upsertErr) {
                throw new Error(`Failed to update user_documents: ${upsertErr.message}`);
              }

              // Update document_change_requests to approved
              if (reqId) {
                await admin
                  .from("document_change_requests")
                  .update({
                    status: "approved",
                    reviewed_by: decidedBy,
                    reviewed_at: new Date().toISOString(),
                  })
                  .eq("id", reqId);
              }
              await admin
                .from("document_change_requests")
                .update({
                  status: "approved",
                  reviewed_by: decidedBy,
                  reviewed_at: new Date().toISOString(),
                })
                .eq("user_id", userId)
                .eq("document_type_code", docTypeCode)
                .eq("status", "pending");
            }

            // 5. Delete older document files from user_files ONLY AFTER user_documents is safely updated!
            if (existingDoc?.storage_path) {
              const oldFiles = [existingDoc.storage_path, existingDoc.thumb_path].filter(
                (p): p is string => Boolean(p) && p !== activeFinalPath && p !== activeFinalThumb
              );
              if (oldFiles.length > 0) {
                const { error: delErr } = await admin.storage
                  .from("user_files")
                  .remove(oldFiles);
                if (delErr) {
                  console.warn("[ApprovalOutbox] Warning deleting older document files:", delErr);
                }
              }
            }

            // 6. Revalidate cache tags so UI immediately reflects verified document
            try {
              revalidateTag(TAGS.users, "max");
              revalidateTag(TAGS.approvals, "max");
              revalidateTag(TAGS.approvalsList, "max");
              revalidateTag(TAGS.approvalsCounts, "max");
            } catch {}
          }
        }

        // Mark item as processed
        await admin
          .from("approval_outbox")
          .update({ processed_at: new Date().toISOString() })
          .eq("id", item.id);

        processedCount++;
      } catch (itemErr: unknown) {
        const errMsg = itemErr instanceof Error ? itemErr.message : String(itemErr);
        console.error(`[ApprovalOutbox] Error processing item ${item.id}:`, errMsg);
        const newRetry = (item.retry_count || 0) + 1;
        await admin
          .from("approval_outbox")
          .update({
            retry_count: newRetry,
            last_error: errMsg,
            // Dead-letter boundary: after 5 attempts, mark processed to unblock queue
            processed_at: newRetry >= 5 ? new Date().toISOString() : null,
          })
          .eq("id", item.id);
      }
    }

    return { success: true, processed: processedCount };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[ApprovalOutbox] Unhandled error:", errorMsg);
    return { success: false, processed: 0, error: errorMsg };
  }
}
