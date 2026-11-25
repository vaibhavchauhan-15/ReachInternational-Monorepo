"use server";

import { revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifySession, getCurrentUser } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { TAGS } from "@/lib/cache/tags";
import {
  ApprovalSubmitInputSchema,
  ApprovalDecideInputSchema,
  ApprovalCancelInputSchema,
  ApprovalApproveAllInputSchema,
  ApprovalListQuerySchema,
  type ApprovalSubmitInput,
  type ApprovalDecideInput,
  type ApprovalCancelInput,
  type ApprovalApproveAllInput,
} from "@reachinternational/validation";
import type { ApprovalApproveAllResult, ApprovalListResponse } from "@reachinternational/types";
import { getApprovalsListDAL } from "@/lib/dal/approvals";
import { canSubmitApproval } from "@reachinternational/permissions";
import { sanitizeUserErrorMessage } from "@reachinternational/utils";
import { processPendingApprovalOutboxItems } from "@/lib/server/approvals-outbox";
import { transferAndApplyDocumentReplacement } from "@/lib/server/document-replacement";

export interface ApprovalActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  isVersionConflict?: boolean;
  isAlreadyDecided?: boolean;
}

/** Pre-authenticated user context from API route — eliminates double auth */
export interface PreAuthenticatedUser {
  id: string;
  role: string;
}

// ⚡ Shared helper: batch revalidate approval-related cache tags
function revalidateApprovalTags(requestId?: string) {
  revalidateTag(TAGS.approvals, "max");
  revalidateTag(TAGS.approvalsList, "max");
  revalidateTag(TAGS.approvalsCounts, "max");
  if (requestId) {
    revalidateTag(TAGS.approvalDetail(requestId), "max");
  }
}

function revalidateApprovalAndEntityTags(requestId?: string) {
  revalidateApprovalTags(requestId);
  revalidateTag(TAGS.users, "max");
  revalidateTag(TAGS.documents, "max");
  revalidateTag(TAGS.dashboard, "max");
  revalidateTag(TAGS.dashboardKpis, "max");
}

/**
 * Submit a proposed change for approval.
 */
export async function submitApprovalAction(
  rawInput: unknown
): Promise<ApprovalActionResult<{ id: string }>> {
  try {
    // ⚡ Parallel auth — saves ~100-200ms vs sequential
    const [session, user] = await Promise.all([verifySession(), getCurrentUser()]);
    if (!session.isAuth) {
      return { success: false, error: "You must be signed in to submit an approval request." };
    }
    if (!user) {
      return { success: false, error: "Authenticated user record not found." };
    }

    const parseResult = ApprovalSubmitInputSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const firstErr = parseResult.error.errors[0]?.message || "Invalid approval request payload.";
      return { success: false, error: firstErr };
    }

    const input: ApprovalSubmitInput = parseResult.data;

    // RBAC check
    if (!canSubmitApproval(user.role, input.type_key)) {
      return {
        success: false,
        error: `Your role (${user.role}) is not authorized to submit ${input.type_key} requests.`,
      };
    }

    const supabase = await createSupabaseServerClient();
    const { data: rpcId, error: rpcErr } = await supabase.rpc("approval_submit", {
      p_type_key: input.type_key,
      p_subject_type: input.subject_type,
      p_subject_id: input.subject_id ?? null,
      p_payload: input.payload,
      p_idempotency_key: input.idempotency_key ?? null,
      p_summary: input.summary ?? null,
      p_subject_label: input.subject_label ?? null,
    });

    if (rpcErr) {
      // Fallback direct insert if RPC schema cache is reloading
      const adminSupabase = createSupabaseAdminClient();
      const { data: insData, error: insErr } = await adminSupabase
        .from("approval_requests")
        .insert({
          type_key: input.type_key,
          subject_type: input.subject_type,
          subject_id: input.subject_id ?? null,
          subject_label: input.subject_label ?? null,
          requested_by: user.id,
          status: "pending",
          summary: input.summary || `${input.type_key} request`,
          payload: input.payload,
          idempotency_key: input.idempotency_key ?? null,
        })
        .select("id")
        .single();

      if (insErr || !insData) {
        return { success: false, error: sanitizeUserErrorMessage(insErr || rpcErr) };
      }

      // Enqueue outbox notification
      await adminSupabase.from("approval_outbox").insert({
        topic: "approval.submitted",
        request_id: insData.id,
        payload: {
          request_id: insData.id,
          type_key: input.type_key,
          requested_by: user.id,
          summary: input.summary,
        },
      });

      revalidateApprovalTags();

      return { success: true, data: { id: insData.id } };
    }

    revalidateApprovalTags();

    // 🔥 Fire-and-forget audit — does not block response
    logAudit({
      user_id: user.id,
      actor_role: user.role,
      action: "approval.submitted",
      entity_type: input.subject_type,
      entity_id: input.subject_id ?? rpcId,
      metadata: { request_id: rpcId, type_key: input.type_key },
    }).catch(() => {});

    return { success: true, data: { id: rpcId } };
  } catch (err) {
    return { success: false, error: sanitizeUserErrorMessage(err) };
  }
}

/**
 * Approve or Reject an approval request.
 * @param rawInput — Approval decision payload
 * @param _preAuthedUser — Pre-authenticated user from API route (skips redundant auth)
 */
export async function decideApprovalAction(
  rawInput: unknown,
  _preAuthedUser?: PreAuthenticatedUser
): Promise<ApprovalActionResult<{ status: string; version: number }>> {
  try {
    // Parse input first (synchronous) so we can skip wasted work early
    const parseResult = ApprovalDecideInputSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const firstErr = parseResult.error.errors[0]?.message || "Invalid decision payload.";
      return { success: false, error: firstErr };
    }
    const input: ApprovalDecideInput = parseResult.data;

    let userId: string;
    let userRole: string;

    if (_preAuthedUser) {
      // ⚡ Pre-authenticated from API route — skip redundant auth (saves ~200-400ms)
      userId = _preAuthedUser.id;
      userRole = _preAuthedUser.role;
    } else {
      // ⚡ Parallel auth — saves ~100-200ms vs sequential
      const [session, user] = await Promise.all([verifySession(), getCurrentUser()]);
      if (!session.isAuth) {
        return { success: false, error: "You must be signed in to decide approval requests." };
      }
      if (!user) {
        return { success: false, error: "Authenticated user record not found." };
      }
      userId = user.id;
      userRole = user.role;
    }

    // Role verification: strictly admin users
    if (!["super_admin", "admin"].includes(userRole)) {
      return {
        success: false,
        error: `Your role (${userRole}) is not authorized to decide approval requests.`,
      };
    }

    const adminSupabase = createSupabaseAdminClient();

    // ⚡ Atomic approval_decide RPC with caller attribution — eliminates 2 redundant pre-queries
    // Checks row existence, status, version concurrency, authorization, and self-approval atomically
    const { data: rpcData, error: rpcErr } = await adminSupabase.rpc("approval_decide", {
      p_request_id: input.request_id,
      p_decision: input.decision,
      p_note: input.note ?? null,
      p_expected_version: input.expected_version ?? null,
      p_actor_id: userId,
      p_idempotency_key: input.idempotency_key ?? null,
    });

    if (rpcErr) {
      const msg = rpcErr.message || "";
      if (rpcErr.code === "P0002" || msg.includes("not found")) {
        return { success: false, error: "Approval request not found." };
      }
      if (rpcErr.code === "P0004" || msg.includes("terminal state") || msg.includes("already")) {
        // ⚡ Industry-Standard Idempotent Normalization:
        // Query current state of the request. If it is ALREADY in the desired state
        // (e.g. already approved and decision is approve), treat as idempotent success.
        const { data: currentReq } = await adminSupabase
          .from("approval_requests")
          .select("id, status, version, decided_by, decided_at")
          .eq("id", input.request_id)
          .maybeSingle();

        const desiredStatus = input.decision === "approve" ? "approved" : "rejected";
        if (currentReq && currentReq.status === desiredStatus) {
          revalidateApprovalAndEntityTags(input.request_id);
          return {
            success: true,
            data: {
              status: currentReq.status,
              version: currentReq.version,
            },
          };
        }

        const conflictStatus = currentReq?.status || "decided";
        return {
          success: false,
          isAlreadyDecided: true,
          error: `This request was already ${conflictStatus} by an administrator.`,
        };
      }
      if (rpcErr.code === "40001" || rpcErr.code === "P0003" || msg.includes("Concurrency conflict") || msg.includes("modified")) {
        return {
          success: false,
          isVersionConflict: true,
          error: "This request was modified by another user. Refreshing latest state.",
        };
      }
      return { success: false, error: sanitizeUserErrorMessage(rpcErr) };
    }

    // Grouped requests are resolved atomically inside approval_decide via
    // approval_requests.parent_id (migration 235/236). `input.bound_request_ids`
    // stays part of the wire contract for native, but is advisory only — the
    // database, not the client, decides which rows move together.
    revalidateApprovalAndEntityTags(input.request_id);

    // ⚡ Synchronously transfer document replacements so user profile immediately reflects new files
    if (input.decision === "approve") {
      try {
        const { data: decidedReq } = await adminSupabase
          .from("approval_requests")
          .select("id, type_key, payload, requested_by")
          .eq("id", input.request_id)
          .maybeSingle();

        if (decidedReq?.type_key === "document_replace") {
          const p = (decidedReq.payload || {}) as Record<string, any>;
          if (p.staging_path) {
            await transferAndApplyDocumentReplacement({
              userId: p.user_id || decidedReq.requested_by,
              documentTypeCode: p.document_type_code,
              stagingPath: p.staging_path,
              stagingThumbPath: p.staging_thumb_path,
              decidedBy: userId,
              requestId: decidedReq.id,
              fileSizeBytes: p.file_size_bytes,
              mimeType: p.mime_type,
              fileName: p.file_name,
            });
          }
        }

        // Also check if any bound or child requests of type document_replace need transfer
        const { data: childReplacements } = await adminSupabase
          .from("approval_requests")
          .select("id, type_key, payload, requested_by")
          .eq("parent_id", input.request_id)
          .eq("type_key", "document_replace");

        for (const child of childReplacements || []) {
          const cp = (child.payload || {}) as Record<string, any>;
          if (cp.staging_path) {
            await transferAndApplyDocumentReplacement({
              userId: cp.user_id || child.requested_by,
              documentTypeCode: cp.document_type_code,
              stagingPath: cp.staging_path,
              stagingThumbPath: cp.staging_thumb_path,
              decidedBy: userId,
              requestId: child.id,
              fileSizeBytes: cp.file_size_bytes,
              mimeType: cp.mime_type,
              fileName: cp.file_name,
            });
          }
        }
      } catch (replaceErr) {
        console.error("[decideApprovalAction] Synchronous replacement transfer error:", replaceErr);
      }
    }

    // 🔥 Fire-and-forget audit — does not block response
    logAudit({
      user_id: userId,
      actor_role: userRole,
      action: `approval.${input.decision}`,
      entity_type: "approval_request",
      entity_id: input.request_id,
      metadata: {
        decision: input.decision,
        note: input.note,
      },
    }).catch(() => {});

    // 🔥 Drain outbox for remaining notifications / side effects
    processPendingApprovalOutboxItems(10).catch((err) => {
      console.warn("[decideApprovalAction] Background outbox processing non-blocking error:", err);
    });

    return {
      success: true,
      data: {
        status: (rpcData as any)?.status || (input.decision === "approve" ? "approved" : "rejected"),
        version: (rpcData as any)?.version || 1,
      },
    };
  } catch (err) {
    return { success: false, error: sanitizeUserErrorMessage(err) };
  }
}

/**
 * Cancel an open approval request (requester only).
 */
export async function cancelApprovalAction(
  rawInput: unknown
): Promise<ApprovalActionResult<{ status: string }>> {
  try {
    // ⚡ Parallel auth
    const [session, user] = await Promise.all([verifySession(), getCurrentUser()]);
    if (!session.isAuth) {
      return { success: false, error: "You must be signed in to cancel requests." };
    }
    if (!user) {
      return { success: false, error: "Authenticated user record not found." };
    }

    const parseResult = ApprovalCancelInputSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const firstErr = parseResult.error.errors[0]?.message || "Invalid cancel payload.";
      return { success: false, error: firstErr };
    }

    const input: ApprovalCancelInput = parseResult.data;

    const supabase = await createSupabaseServerClient();
    const { data: rpcData, error: rpcErr } = await supabase.rpc("approval_cancel", {
      p_request_id: input.request_id,
      p_note: input.note ?? null,
    });

    if (rpcErr) {
      return { success: false, error: sanitizeUserErrorMessage(rpcErr) };
    }

    revalidateApprovalTags(input.request_id);

    // 🔥 Fire-and-forget audit
    logAudit({
      user_id: user.id,
      actor_role: user.role,
      action: "approval.cancelled",
      entity_type: "approval_request",
      entity_id: input.request_id,
      metadata: { note: input.note },
    }).catch(() => {});

    return {
      success: true,
      data: { status: "cancelled" },
    };
  } catch (err) {
    return { success: false, error: sanitizeUserErrorMessage(err) };
  }
}

/**
 * Approve All pending approval requests.
 * Invariant: For user registrations, activates users immediately while keeping all user documents pending.
 * @param rawInput — Approve all payload
 * @param _preAuthedUser — Pre-authenticated user from API route (skips redundant auth)
 */
export async function approveAllAction(
  rawInput?: unknown,
  _preAuthedUser?: PreAuthenticatedUser
): Promise<ApprovalActionResult<ApprovalApproveAllResult>> {
  try {
    let userId: string;
    let userRole: string;

    if (_preAuthedUser) {
      // ⚡ Pre-authenticated from API route — skip redundant auth
      userId = _preAuthedUser.id;
      userRole = _preAuthedUser.role;
    } else {
      // ⚡ Parallel auth
      const [session, user] = await Promise.all([verifySession(), getCurrentUser()]);
      if (!session.isAuth) {
        return { success: false, error: "You must be signed in to approve requests." };
      }
      if (!user) {
        return { success: false, error: "Authenticated user record not found." };
      }
      userId = user.id;
      userRole = user.role;
    }

    // Role verification: strictly admin users
    if (!["super_admin", "admin"].includes(userRole)) {
      return {
        success: false,
        error: `Your role (${userRole}) is not authorized to perform bulk approval.`,
      };
    }

    const parseResult = ApprovalApproveAllInputSchema.safeParse(rawInput || {});
    if (!parseResult.success) {
      const firstErr = parseResult.error.errors[0]?.message || "Invalid approve all payload.";
      return { success: false, error: firstErr };
    }

    const input: ApprovalApproveAllInput = parseResult.data;
    const adminSupabase = createSupabaseAdminClient();

    const { data: rpcData, error: rpcErr } = await adminSupabase.rpc("approval_approve_all", {
      p_actor_id: userId,
      p_type_key: input.type_key ?? null,
      p_request_ids: input.request_ids ?? null,
      p_note: input.note ?? null,
    });

    if (rpcErr) {
      return { success: false, error: sanitizeUserErrorMessage(rpcErr) };
    }

    const result = rpcData as unknown as ApprovalApproveAllResult;

    // ⚡ Batch revalidate all approval + entity cache tags
    revalidateApprovalAndEntityTags();

    // 🔥 Fire-and-forget audit — does not block response
    logAudit({
      user_id: userId,
      actor_role: userRole,
      action: "approval.approve_all",
      entity_type: "approval_request",
      entity_id: userId,
      metadata: {
        type_key: input.type_key,
        approved_count: result?.approved_count ?? 0,
        approved_ids: result?.approved_ids ?? [],
        activated_user_ids: result?.activated_user_ids ?? [],
      },
    }).catch(() => {});

    // 🔥 Fire-and-forget outbox drain — does not block response
    processPendingApprovalOutboxItems(10).catch((err) => {
      console.warn("[approveAllAction] Background outbox processing non-blocking error:", err);
    });

    return {
      success: true,
      data: result,
    };
  } catch (err) {
    return { success: false, error: sanitizeUserErrorMessage(err) };
  }
}

/**
 * Keyset-paginated approval queue page action for smooth infinite scroll.
 * Validated via ApprovalListQuerySchema and protected by server-enforced RBAC.
 */
export async function getApprovalsListPageAction(
  rawInput: unknown
): Promise<ApprovalActionResult<ApprovalListResponse>> {
  try {
    const [session, user] = await Promise.all([verifySession(), getCurrentUser()]);
    if (!session.isAuth) {
      return { success: false, error: "Unauthorized: Please sign in." };
    }
    if (!user) {
      return { success: false, error: "Authenticated user record not found." };
    }

    if (!["super_admin", "admin"].includes(user.role)) {
      return {
        success: false,
        error: `Your role (${user.role}) is not authorized to access the approvals queue.`,
      };
    }

    const parseResult = ApprovalListQuerySchema.safeParse(rawInput || {});
    if (!parseResult.success) {
      const firstErr = parseResult.error.errors[0]?.message || "Invalid pagination query parameters.";
      return { success: false, error: firstErr };
    }

    const result = await getApprovalsListDAL(parseResult.data, {
      id: user.id,
      role: user.role,
    });

    if (result.error) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      data: {
        items: result.data,
        next_cursor: result.next_cursor,
        has_more: result.has_more,
        pending_total: result.pending_total,
      },
    };
  } catch (err) {
    return { success: false, error: sanitizeUserErrorMessage(err) };
  }
}
