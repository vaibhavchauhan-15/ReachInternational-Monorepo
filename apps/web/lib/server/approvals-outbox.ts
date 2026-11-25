import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { transferAndApplyDocumentReplacement } from "@/lib/server/document-replacement";

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
          const res = await transferAndApplyDocumentReplacement({
            userId: payload.user_id,
            documentTypeCode: payload.document_type_code,
            stagingPath: payload.staging_path,
            stagingThumbPath: payload.staging_thumb_path,
            decidedBy: payload.decided_by,
            requestId: payload.request_id || item.request_id,
            fileSizeBytes: payload.file_size_bytes,
            mimeType: payload.mime_type,
            fileName: payload.file_name,
          });

          if (!res.success) {
            throw new Error(res.error || "Failed to transfer staged document");
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
        // Resilient error tracking inside payload: dead-letter retry boundary (5 attempts)
        const currentPayload = (item.payload || {}) as Record<string, any>;
        const newRetry = (currentPayload.retry_count || 0) + 1;
        const updatedPayload = {
          ...currentPayload,
          retry_count: newRetry,
          last_error: errMsg,
          error_at: new Date().toISOString(),
        };

        await admin
          .from("approval_outbox")
          .update({
            payload: updatedPayload,
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
