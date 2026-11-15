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
  type ApprovalSubmitInput,
  type ApprovalDecideInput,
  type ApprovalCancelInput,
} from "@reachinternational/validation";
import {
  canSubmitApproval,
  canDecideApproval,
} from "@reachinternational/permissions";
import { sanitizeUserErrorMessage } from "@reachinternational/utils";

export interface ApprovalActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  isVersionConflict?: boolean;
}

/**
 * Submit a proposed change for approval.
 */
export async function submitApprovalAction(
  rawInput: unknown
): Promise<ApprovalActionResult<{ id: string }>> {
  try {
    const session = await verifySession();
    if (!session.isAuth) {
      return { success: false, error: "You must be signed in to submit an approval request." };
    }

    const user = await getCurrentUser();
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

      revalidateTag(TAGS.approvals, "max");
      revalidateTag(TAGS.approvalsList, "max");
      revalidateTag(TAGS.approvalsCounts, "max");

      return { success: true, data: { id: insData.id } };
    }

    revalidateTag(TAGS.approvals, "max");
    revalidateTag(TAGS.approvalsList, "max");
    revalidateTag(TAGS.approvalsCounts, "max");

    await logAudit({
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
 */
export async function decideApprovalAction(
  rawInput: unknown
): Promise<ApprovalActionResult<{ status: string; version: number }>> {
  try {
    const session = await verifySession();
    if (!session.isAuth) {
      return { success: false, error: "You must be signed in to decide approval requests." };
    }

    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Authenticated user record not found." };
    }

    const parseResult = ApprovalDecideInputSchema.safeParse(rawInput);
    if (!parseResult.success) {
      const firstErr = parseResult.error.errors[0]?.message || "Invalid decision payload.";
      return { success: false, error: firstErr };
    }

    const input: ApprovalDecideInput = parseResult.data;

    // Check request exists and caller permission
    const adminSupabase = createSupabaseAdminClient();
    const { data: request, error: reqErr } = await adminSupabase
      .from("approval_requests")
      .select("id, type_key, requested_by, subject_id, status, version")
      .eq("id", input.request_id)
      .maybeSingle();

    if (reqErr || !request) {
      return { success: false, error: "Approval request not found." };
    }

    if (request.status !== "pending") {
      return {
        success: false,
        isVersionConflict: true,
        error: `This request is already ${request.status}. Refreshing latest status.`,
      };
    }

    const approverObj = { id: user.id, role: user.role };
    const targetObj = { id: request.subject_id, role: undefined };

    if (!canDecideApproval(approverObj, targetObj, request.type_key)) {
      return {
        success: false,
        error: `Your role (${user.role}) is not authorized to decide ${request.type_key} requests.`,
      };
    }

    const supabase = await createSupabaseServerClient();
    const { data: rpcData, error: rpcErr } = await supabase.rpc("approval_decide", {
      p_request_id: input.request_id,
      p_decision: input.decision,
      p_note: input.note ?? null,
      p_expected_version: input.expected_version ?? request.version,
    });

    if (rpcErr) {
      const msg = rpcErr.message || "";
      if (rpcErr.code === "40001" || msg.includes("Concurrency conflict") || msg.includes("modified")) {
        return {
          success: false,
          isVersionConflict: true,
          error: "This request was modified by another user. Refreshing latest state.",
        };
      }
      return { success: false, error: sanitizeUserErrorMessage(rpcErr) };
    }

    revalidateTag(TAGS.approvals, "max");
    revalidateTag(TAGS.approvalsList, "max");
    revalidateTag(TAGS.approvalsCounts, "max");
    revalidateTag(TAGS.approvalDetail(input.request_id), "max");

    await logAudit({
      user_id: user.id,
      actor_role: user.role,
      action: `approval.${input.decision}`,
      entity_type: "approval_request",
      entity_id: input.request_id,
      metadata: {
        decision: input.decision,
        type_key: request.type_key,
        note: input.note,
      },
    }).catch(() => {});

    return {
      success: true,
      data: {
        status: (rpcData as any)?.status || (input.decision === "approve" ? "approved" : "rejected"),
        version: (rpcData as any)?.version || request.version + 1,
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
    const session = await verifySession();
    if (!session.isAuth) {
      return { success: false, error: "You must be signed in to cancel requests." };
    }

    const user = await getCurrentUser();
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

    revalidateTag(TAGS.approvals, "max");
    revalidateTag(TAGS.approvalsList, "max");
    revalidateTag(TAGS.approvalsCounts, "max");
    revalidateTag(TAGS.approvalDetail(input.request_id), "max");

    await logAudit({
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
