import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { verifySession } from "@/lib/dal";
import type {
  ApprovalCounts,
  ApprovalRequest,
  ApprovalRequestListItem,
  ApprovalStatus,
} from "@reachinternational/types";
import { sanitizeUserErrorMessage } from "@reachinternational/utils";

export interface ApprovalListParams {
  status?: ApprovalStatus;
  type_key?: string;
  cursor_created_at?: string;
  cursor_id?: string;
  limit?: number;
}

/**
 * Fetch keyset-paginated approvals list via approval_list RPC.
 */
export const getApprovalsListDAL = cache(
  async (
    params: ApprovalListParams = {}
  ): Promise<{ data: ApprovalRequestListItem[]; error: string | null }> => {
    try {
      const session = await verifySession();
      if (!session.isAuth) {
        return { data: [], error: "Unauthorized" };
      }

      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.rpc("approval_list", {
        p_status: params.status ?? "pending",
        p_type_key: params.type_key ?? null,
        p_cursor_created_at: params.cursor_created_at ?? null,
        p_cursor_id: params.cursor_id ?? null,
        p_limit: params.limit ?? 25,
      });

      if (error) {
        // Fallback to table select if RPC schema cache is updating
        const adminSupabase = createSupabaseAdminClient();
        let query = adminSupabase
          .from("approval_requests")
          .select(`
            id,
            type_key,
            subject_type,
            subject_id,
            subject_label,
            requested_by,
            status,
            summary,
            version,
            created_at,
            expires_at,
            type:approval_types (
              label,
              priority
            ),
            requester:users!approval_requests_requested_by_fkey (
              full_name
            )
          `)
          .eq("status", params.status ?? "pending")
          .order("created_at", { ascending: false })
          .limit(params.limit ?? 25);

        if (params.type_key) {
          query = query.eq("type_key", params.type_key);
        }

        const { data: fbData, error: fbErr } = await query;
        if (fbErr) {
          return { data: [], error: sanitizeUserErrorMessage(fbErr) };
        }

        const mapped: ApprovalRequestListItem[] = (fbData || []).map((row: any) => ({
          id: row.id,
          type_key: row.type_key,
          type_label: row.type?.label || row.type_key,
          subject_type: row.subject_type,
          subject_id: row.subject_id,
          subject_label: row.subject_label,
          requested_by: row.requested_by,
          requester_name: row.requester?.full_name || null,
          status: row.status,
          summary: row.summary,
          priority: row.type?.priority ?? 0,
          created_at: row.created_at,
          expires_at: row.expires_at,
          version: row.version,
        }));

        return { data: mapped, error: null };
      }

      return { data: Array.isArray(data) ? data : [], error: null };
    } catch (err) {
      return { data: [], error: sanitizeUserErrorMessage(err) };
    }
  }
);

/**
 * Fetch full approval request detail with type and requester metadata.
 */
export const getApprovalDetailDAL = cache(
  async (
    requestId: string
  ): Promise<{ data: ApprovalRequest | null; error: string | null }> => {
    try {
      const session = await verifySession();
      if (!session.isAuth) {
        return { data: null, error: "Unauthorized" };
      }

      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.rpc("approval_get", {
        p_request_id: requestId,
      });

      if (error) {
        // Fallback to table lookup
        const adminSupabase = createSupabaseAdminClient();
        const { data: fbData, error: fbErr } = await adminSupabase
          .from("approval_requests")
          .select(`
            *,
            type:approval_types (*),
            requester:users!approval_requests_requested_by_fkey (
              id, full_name, email, role
            )
          `)
          .eq("id", requestId)
          .maybeSingle();

        if (fbErr || !fbData) {
          return { data: null, error: sanitizeUserErrorMessage(fbErr || "Approval request not found") };
        }

        return { data: fbData as ApprovalRequest, error: null };
      }

      return { data: data as ApprovalRequest, error: null };
    } catch (err) {
      return { data: null, error: sanitizeUserErrorMessage(err) };
    }
  }
);

/**
 * Fetch aggregated approval counts across types.
 */
export const getApprovalCountsDAL = cache(
  async (): Promise<{ data: ApprovalCounts; error: string | null }> => {
    try {
      const session = await verifySession();
      if (!session.isAuth) {
        return { data: { total: 0, by_type: {} }, error: "Unauthorized" };
      }

      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase.rpc("approval_counts");

      if (error) {
        const adminSupabase = createSupabaseAdminClient();
        const { data: rows, error: fbErr } = await adminSupabase
          .from("approval_requests")
          .select("type_key")
          .eq("status", "pending");

        if (fbErr) {
          return { data: { total: 0, by_type: {} }, error: sanitizeUserErrorMessage(fbErr) };
        }

        const by_type: Record<string, number> = {};
        for (const row of rows || []) {
          by_type[row.type_key] = (by_type[row.type_key] || 0) + 1;
        }

        return {
          data: { total: (rows || []).length, by_type },
          error: null,
        };
      }

      return {
        data: (data as ApprovalCounts) || { total: 0, by_type: {} },
        error: null,
      };
    } catch (err) {
      return {
        data: { total: 0, by_type: {} },
        error: sanitizeUserErrorMessage(err),
      };
    }
  }
);
