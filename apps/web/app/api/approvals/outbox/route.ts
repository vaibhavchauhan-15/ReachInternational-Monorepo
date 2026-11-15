import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { finalDocumentPath, type DocType } from "@reachinternational/utils";
import crypto from "node:crypto";

export const dynamic = "force-dynamic";

/**
 * Transactional Approval Outbox Worker
 * Triggered periodically via QStash / Cron or on fast-path commit to process
 * pending side-effects (push notifications, emails, file movements, and account deletion).
 */
export async function POST(req: NextRequest) {
  try {
    // Verify bearer token or cron secret if configured
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // In production/staging, block unauthorized triggers
      const isDev = process.env.NODE_ENV === "development";
      if (!isDev) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const admin = createSupabaseAdminClient();

    // 1. Fetch pending outbox rows (limit 25)
    const { data: items, error: fetchErr } = await admin
      .from("approval_outbox")
      .select("*")
      .is("processed_at", null)
      .order("id", { ascending: true })
      .limit(25);

    if (fetchErr) {
      console.error("[ApprovalOutbox] Error fetching pending items:", fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ success: true, processed: 0 });
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

          if (userId && docTypeCode && stagingPath) {
            const fileUuid = crypto.randomUUID();
            const finalPath = finalDocumentPath(userId, docTypeCode, fileUuid, false);
            const finalThumb = stagingThumbPath
              ? finalDocumentPath(userId, docTypeCode, fileUuid, true)
              : null;

            // Move main document from doc_staging to user_files
            const { error: moveErr } = await admin.storage
              .from("doc_staging")
              .move(stagingPath, finalPath, { destinationBucket: "user_files" });

            if (moveErr) {
              console.error("[ApprovalOutbox] Document move error:", moveErr);
            } else {
              // Move thumbnail if present
              if (stagingThumbPath && finalThumb) {
                await admin.storage
                  .from("doc_staging")
                  .move(stagingThumbPath, finalThumb, { destinationBucket: "user_files" })
                  .catch((e: unknown) => console.warn("[ApprovalOutbox] Thumb move warn:", e));
              }

              // Upsert canonical user_documents record
              await admin.from("user_documents").upsert(
                {
                  user_id: userId,
                  document_type_code: docTypeCode,
                  storage_path: finalPath,
                  thumb_path: finalThumb,
                  verification_status: "verified",
                  status: "verified",
                  verified_at: new Date().toISOString(),
                  rejection_reason: null,
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "user_id,document_type_code" }
              );
            }
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

    return NextResponse.json({ success: true, processed: processedCount });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[ApprovalOutbox] Unhandled error:", errorMsg);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
