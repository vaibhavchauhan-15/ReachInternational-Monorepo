"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserOrNull } from "@/lib/dal";
import { logAudit } from "@/lib/audit";
import { TAGS } from "@/lib/cache/tags";
import type {
  AccountDeletionRequest,
  AccountDeletionSource,
  AccountDeletionStatus,
  User,
} from "@reachinternational/types";

export interface AccountDeletionResult {
  success: boolean;
  message?: string;
  error?: string;
  requestId?: string;
}

/**
 * Submit an Account Deletion Request
 * Callable by authenticated users (in-app web or mobile) or unauthenticated users via the public web portal.
 */
export async function submitAccountDeletionRequestAction(payload: {
  email: string;
  reason?: string;
  fullName?: string;
  source?: AccountDeletionSource;
}): Promise<AccountDeletionResult> {
  try {
    const rawEmail = payload.email?.trim().toLowerCase();
    if (!rawEmail || !rawEmail.includes("@")) {
      return { success: false, error: "Please provide a valid registered email address." };
    }

    const source: AccountDeletionSource = payload.source || "public_web";
    const reason = payload.reason?.trim() || "User requested account de-provisioning.";

    const adminClient = createSupabaseAdminClient();
    const currentUser = await getCurrentUserOrNull();

    // Resolve user account matching the email
    let matchedUser: Partial<User> | null = currentUser?.email?.toLowerCase() === rawEmail ? currentUser : null;

    if (!matchedUser) {
      const { data: userRow } = await adminClient
        .from("users")
        .select("id, full_name, email, role, phone")
        .eq("email", rawEmail)
        .maybeSingle();

      if (userRow) {
        matchedUser = userRow;
      }
    }

    const userId = matchedUser?.id || currentUser?.id || null;
    const fullName = matchedUser?.full_name || payload.fullName?.trim() || currentUser?.full_name || null;
    const role = matchedUser?.role || currentUser?.role || null;
    const phone = matchedUser?.phone || currentUser?.phone || null;

    // Dual-path resilience:
    // Path A: Try inserting into public.account_deletion_requests
    const { data: insertedRequest, error: insertErr } = await adminClient
      .from("account_deletion_requests")
      .insert({
        user_id: userId,
        email: rawEmail,
        full_name: fullName,
        phone,
        role,
        reason,
        source,
        status: "pending" as AccountDeletionStatus,
      })
      .select("id")
      .maybeSingle();

    let requestId = insertedRequest?.id;

    // Path B: Fallback to public.profile_change_requests if account_deletion_requests does not exist in schema cache
    if (insertErr) {
      const isMissingTable =
        insertErr.code === "PGRST205" ||
        insertErr.message?.includes("account_deletion_requests");

      if (isMissingTable && userId) {
        // Store in profile_change_requests with structured payload
        const { data: pReq, error: pErr } = await adminClient
          .from("profile_change_requests")
          .insert({
            user_id: userId,
            requester_role: role || "operator",
            current_data: { email: rawEmail },
            requested_data: {
              type: "account_deletion",
              email: rawEmail,
              full_name: fullName,
              phone,
              role,
              reason,
              source,
              requested_at: new Date().toISOString(),
            },
            target_approver_role: "admin",
            status: "pending",
          })
          .select("id")
          .maybeSingle();

        if (pErr) {
          console.error("[AccountDeletion] Fallback insert error:", pErr);
          return {
            success: false,
            error: "Failed to record deletion request. Please contact support at info@reachinternational.co.in",
          };
        }
        requestId = pReq?.id;
      } else {
        console.error("[AccountDeletion] Direct insert error:", insertErr);
        return {
          success: false,
          error: insertErr.message || "Failed to submit account deletion request. Please try again.",
        };
      }
    }

    // Structured Audit Logging
    try {
      await logAudit({
        action: "user.account_deletion_requested",
        entity_type: "account_deletion_request",
        entity_id: requestId || rawEmail,
        user_id: userId || undefined,
        actor_name: fullName || rawEmail,
        actor_role: role || "client",
        metadata: {
          email: rawEmail,
          source,
          reason,
        },
      });
    } catch (auditErr) {
      console.warn("[AccountDeletion] Non-blocking audit log warning:", auditErr);
    }

    try {
      revalidateTag(TAGS.users, "max");
      revalidatePath("/users");
      revalidatePath("/account-deletion");
    } catch {}

    return {
      success: true,
      requestId,
      message:
        "Your account deletion request has been registered. Our compliance desk will process it within 14 business days.",
    };
  } catch (err: any) {
    console.error("[AccountDeletion] Unexpected error in submitAccountDeletionRequestAction:", err);
    return {
      success: false,
      error: err?.message || "An unexpected error occurred while processing your deletion request.",
    };
  }
}

/**
 * Fetch all pending Account Deletion Requests (Admin / Management)
 */
export async function getAccountDeletionRequestsAction(): Promise<AccountDeletionRequest[]> {
  try {
    const adminClient = createSupabaseAdminClient();
    const requests: AccountDeletionRequest[] = [];

    // 1. Try querying dedicated account_deletion_requests table
    const { data: directData, error: directErr } = await adminClient
      .from("account_deletion_requests")
      .select(`
        id,
        user_id,
        email,
        full_name,
        phone,
        role,
        reason,
        source,
        status,
        admin_notes,
        reviewed_by,
        reviewed_at,
        created_at,
        updated_at,
        user:users!account_deletion_requests_user_id_fkey(id, full_name, email, role, phone)
      `)
      .order("created_at", { ascending: false });

    if (!directErr && directData) {
      for (const item of directData) {
        requests.push({
          id: item.id,
          user_id: item.user_id,
          email: item.email,
          full_name: item.full_name || (item.user as any)?.full_name,
          phone: item.phone || (item.user as any)?.phone,
          role: item.role || (item.user as any)?.role,
          reason: item.reason,
          source: (item.source as AccountDeletionSource) || "web",
          status: (item.status as AccountDeletionStatus) || "pending",
          admin_notes: item.admin_notes,
          reviewed_by: item.reviewed_by,
          reviewed_at: item.reviewed_at,
          created_at: item.created_at,
          updated_at: item.updated_at,
          user: item.user as any,
        });
      }
    }

    // 2. Also check profile_change_requests for fallback deletion requests
    const { data: fallbackData } = await adminClient
      .from("profile_change_requests")
      .select(`
        id,
        user_id,
        requester_role,
        requested_data,
        status,
        reviewed_by,
        reviewed_at,
        rejection_reason,
        created_at,
        updated_at,
        user:users!profile_change_requests_user_id_fkey(id, full_name, email, role, phone)
      `)
      .order("created_at", { ascending: false });

    if (fallbackData) {
      for (const fItem of fallbackData) {
        const reqData = fItem.requested_data as Record<string, any>;
        if (reqData && reqData.type === "account_deletion") {
          // Avoid duplicate if already present
          if (!requests.some((r) => r.id === fItem.id)) {
            const u = fItem.user as any;
            requests.push({
              id: fItem.id,
              user_id: fItem.user_id,
              email: reqData.email || u?.email || "Unknown",
              full_name: reqData.full_name || u?.full_name,
              phone: reqData.phone || u?.phone,
              role: reqData.role || fItem.requester_role || u?.role,
              reason: reqData.reason || "Account deletion requested",
              source: (reqData.source as AccountDeletionSource) || "web",
              status: (fItem.status as AccountDeletionStatus) || "pending",
              admin_notes: fItem.rejection_reason,
              reviewed_by: fItem.reviewed_by,
              reviewed_at: fItem.reviewed_at,
              created_at: fItem.created_at,
              updated_at: fItem.updated_at,
              user: u,
            });
          }
        }
      }
    }

    // Sort newest first
    return requests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  } catch (err) {
    console.error("[AccountDeletion] Error fetching account deletion requests:", err);
    return [];
  }
}

/**
 * Approve Account Deletion Request (Admin Action)
 * Marks user inactive in database, clears sensitive KYC records, updates request status to 'approved', and writes audit log.
 */
export async function approveAccountDeletionRequestAction(
  requestId: string,
  userId?: string,
  adminNotes?: string
): Promise<AccountDeletionResult> {
  try {
    const currentUser = await getCurrentUserOrNull();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "super_admin")) {
      return { success: false, error: "Only administrators can authorize account deletions." };
    }

    const adminClient = createSupabaseAdminClient();
    const now = new Date().toISOString();

    // 1. Try updating direct account_deletion_requests
    let directUpdated = false;
    const { error: directErr } = await adminClient
      .from("account_deletion_requests")
      .update({
        status: "approved",
        admin_notes: adminNotes || "Approved by administrator. Account de-provisioned.",
        reviewed_by: currentUser.id,
        reviewed_at: now,
        updated_at: now,
      })
      .eq("id", requestId);

    if (!directErr) {
      directUpdated = true;
    }

    // 2. Also try updating fallback profile_change_requests if relevant
    await adminClient
      .from("profile_change_requests")
      .update({
        status: "approved",
        reviewed_by: currentUser.id,
        reviewed_at: now,
        updated_at: now,
      })
      .eq("id", requestId);

    // 3. De-provision / deactivate the user account in users table
    if (userId) {
      const { error: userUpdateErr } = await adminClient
        .from("users")
        .update({
          status: "inactive",
          aadhaar_number: null,
          license_number: null,
          updated_at: now,
        })
        .eq("id", userId);

      if (userUpdateErr) {
        console.warn("[AccountDeletion] Note updating user status:", userUpdateErr);
      }
    }

    // Structured Audit Log
    try {
      await logAudit({
        action: "user.account_deleted",
        entity_type: "account_deletion_request",
        entity_id: requestId,
        user_id: userId,
        actor_name: currentUser.full_name || currentUser.email,
        actor_role: currentUser.role,
        metadata: {
          requestId,
          userId,
          adminNotes,
          deactivatedAt: now,
        },
      });
    } catch (auditErr) {
      console.warn("[AccountDeletion] Non-blocking audit log warning:", auditErr);
    }

    try {
      revalidateTag(TAGS.users, "max");
      revalidatePath("/users");
    } catch {}

    return {
      success: true,
      message: "Account deletion request approved. The user account has been de-provisioned.",
    };
  } catch (err: any) {
    console.error("[AccountDeletion] Error approving deletion request:", err);
    return {
      success: false,
      error: err?.message || "Failed to approve account deletion request.",
    };
  }
}

/**
 * Reject Account Deletion Request (Admin Action)
 */
export async function rejectAccountDeletionRequestAction(
  requestId: string,
  adminNotes?: string
): Promise<AccountDeletionResult> {
  try {
    const currentUser = await getCurrentUserOrNull();
    if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "super_admin")) {
      return { success: false, error: "Only administrators can reject account deletions." };
    }

    const adminClient = createSupabaseAdminClient();
    const now = new Date().toISOString();

    // 1. Try direct update
    await adminClient
      .from("account_deletion_requests")
      .update({
        status: "rejected",
        admin_notes: adminNotes || "Request declined by administrator.",
        reviewed_by: currentUser.id,
        reviewed_at: now,
        updated_at: now,
      })
      .eq("id", requestId);

    // 2. Also try fallback table
    await adminClient
      .from("profile_change_requests")
      .update({
        status: "rejected",
        rejection_reason: adminNotes || "Request declined by administrator.",
        reviewed_by: currentUser.id,
        reviewed_at: now,
        updated_at: now,
      })
      .eq("id", requestId);

    try {
      await logAudit({
        action: "user.account_deletion_rejected",
        entity_type: "account_deletion_request",
        entity_id: requestId,
        actor_name: currentUser.full_name || currentUser.email,
        actor_role: currentUser.role,
        metadata: {
          requestId,
          adminNotes,
        },
      });
    } catch {}

    try {
      revalidateTag(TAGS.users, "max");
      revalidatePath("/users");
    } catch {}

    return {
      success: true,
      message: "Account deletion request has been rejected.",
    };
  } catch (err: any) {
    console.error("[AccountDeletion] Error rejecting deletion request:", err);
    return {
      success: false,
      error: err?.message || "Failed to reject deletion request.",
    };
  }
}

/**
 * Get user's own pending deletion request (if any)
 */
export async function getMyPendingAccountDeletionRequestAction(): Promise<AccountDeletionRequest | null> {
  try {
    const currentUser = await getCurrentUserOrNull();
    if (!currentUser?.id) return null;

    const adminClient = createSupabaseAdminClient();

    // Direct table check
    const { data: directReq } = await adminClient
      .from("account_deletion_requests")
      .select("*")
      .eq("user_id", currentUser.id)
      .eq("status", "pending")
      .maybeSingle();

    if (directReq) {
      return directReq as AccountDeletionRequest;
    }

    // Fallback check
    const { data: fallbackReq } = await adminClient
      .from("profile_change_requests")
      .select("*")
      .eq("user_id", currentUser.id)
      .eq("status", "pending")
      .maybeSingle();

    if (fallbackReq && (fallbackReq.requested_data as any)?.type === "account_deletion") {
      const rd = fallbackReq.requested_data as any;
      return {
        id: fallbackReq.id,
        user_id: fallbackReq.user_id,
        email: rd.email || currentUser.email,
        full_name: rd.full_name || currentUser.full_name,
        role: currentUser.role,
        reason: rd.reason,
        source: rd.source || "web",
        status: "pending",
        created_at: fallbackReq.created_at,
        updated_at: fallbackReq.updated_at,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Cancel user's own pending deletion request
 */
export async function cancelMyAccountDeletionRequestAction(
  requestId: string
): Promise<AccountDeletionResult> {
  try {
    const currentUser = await getCurrentUserOrNull();
    if (!currentUser?.id) {
      return { success: false, error: "You must be signed in to cancel a deletion request." };
    }

    const adminClient = createSupabaseAdminClient();
    const now = new Date().toISOString();

    await adminClient
      .from("account_deletion_requests")
      .update({
        status: "cancelled",
        updated_at: now,
      })
      .eq("id", requestId)
      .eq("user_id", currentUser.id);

    await adminClient
      .from("profile_change_requests")
      .update({
        status: "cancelled",
        updated_at: now,
      })
      .eq("id", requestId)
      .eq("user_id", currentUser.id);

    try {
      revalidateTag(TAGS.users, "max");
      revalidatePath("/users");
      revalidatePath("/account-deletion");
    } catch {}

    return {
      success: true,
      message: "Your account deletion request has been cancelled.",
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Failed to cancel deletion request.",
    };
  }
}
