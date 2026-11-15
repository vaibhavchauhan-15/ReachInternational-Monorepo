/**
 * Universal Approval Engine Bridge
 * 
 * Centralized server-side helper for dispatching approval requests into
 * the master ledger (public.approval_requests).
 * 
 * Ensures all approval requests across Web and Mobile (registrations, profile changes,
 * account deletions, document verifications, document replacements) are routed to
 * ONE fast, scalable, and auditable approval engine.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ApprovalType } from "@reachinternational/types";

export interface SubmitApprovalEngineParams {
  type_key: string;
  subject_type: "user" | "document" | "shift";
  subject_id?: string | null;
  subject_label?: string | null;
  requested_by: string;
  summary: string;
  payload: Record<string, any>;
  idempotency_key?: string | null;
}

export interface SubmitApprovalEngineResult {
  success: boolean;
  requestId?: string;
  error?: string;
}

/**
 * Submit an approval request to the central approval engine.
 * Safe & resilient: handles missing table / migration pending states gracefully.
 */
export async function submitToApprovalEngineSafely(
  params: SubmitApprovalEngineParams
): Promise<SubmitApprovalEngineResult> {
  try {
    const supabase = createSupabaseAdminClient();

    // 1. Check for existing pending request for same subject to prevent duplicates
    if (params.subject_id) {
      const { data: existing } = await supabase
        .from("approval_requests")
        .select("id")
        .eq("type_key", params.type_key)
        .eq("subject_id", params.subject_id)
        .eq("status", "pending")
        .maybeSingle();

      if (existing) {
        return { success: true, requestId: existing.id };
      }
    }

    // 2. Insert into central approval_requests ledger
    const { data, error } = await supabase
      .from("approval_requests")
      .insert({
        type_key: params.type_key,
        subject_type: params.subject_type,
        subject_id: params.subject_id || null,
        subject_label: params.subject_label || null,
        requested_by: params.requested_by,
        status: "pending",
        summary: params.summary,
        payload: params.payload,
        idempotency_key: params.idempotency_key || null,
      })
      .select("id")
      .single();

    if (error) {
      // If table does not exist yet (schema cache), log safely
      if (error.code === "PGRST205" || error.message?.includes("approval_requests")) {
        console.warn(
          `[ApprovalEngineBridge] Warning: approval_requests ledger not ready in schema cache. ${error.message}`
        );
        return { success: false, error: error.message };
      }
      console.error("[ApprovalEngineBridge] Error submitting approval request:", error);
      return { success: false, error: error.message };
    }

    return { success: true, requestId: data?.id };
  } catch (err: any) {
    console.error("[ApprovalEngineBridge] Unexpected error in submitToApprovalEngineSafely:", err);
    return { success: false, error: err?.message || "Failed to submit approval request." };
  }
}
