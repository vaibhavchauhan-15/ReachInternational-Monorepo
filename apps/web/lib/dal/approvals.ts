import "server-only";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";
import type {
  ApprovalCounts,
  ApprovalRequest,
  ApprovalRequestListItem,
  ApprovalStatus,
  ApprovalCursor,
} from "@reachinternational/types";
import { sanitizeUserErrorMessage } from "@reachinternational/utils";

export interface ApprovalListParams {
  status?: ApprovalStatus | "all";
  type_key?: string;
  cursor_created_at?: string;
  cursor_id?: string;
  limit?: number;
}

export interface ApprovalCallerContext {
  id: string;
  role: string;
}

export interface ApprovalListDALResult {
  data: ApprovalRequestListItem[];
  next_cursor: ApprovalCursor | null;
  has_more: boolean;
  pending_total: number;
  error: string | null;
}

// ⚡ In-memory signed URL cache with TTL (45 minutes) to avoid repeated Supabase Storage API round-trips
interface CachedSignedUrl {
  url: string;
  expiresAt: number;
}
const signedUrlCache = new Map<string, CachedSignedUrl>();
const SIGNED_URL_TTL_MS = 45 * 60 * 1000; // 45 min TTL for 60 min (3600s) signed URLs

async function resolveSignedUrlsBatch(
  adminSupabase: ReturnType<typeof createSupabaseAdminClient>,
  bucket: "user_files" | "doc_staging",
  paths: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (paths.length === 0) return result;

  const now = Date.now();
  const missingPaths: string[] = [];

  for (const p of paths) {
    const cleanPath = p.replace(/^\/+/, "");
    const cacheKey = `${bucket}:${cleanPath}`;
    const cached = signedUrlCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      result.set(cleanPath, cached.url);
      result.set(p, cached.url);
    } else {
      missingPaths.push(cleanPath);
    }
  }

  if (missingPaths.length > 0) {
    const uniqueMissing = Array.from(new Set(missingPaths));
    const { data } = await adminSupabase.storage
      .from(bucket)
      .createSignedUrls(uniqueMissing, 3600);

    if (data) {
      for (const s of data) {
        if (s?.path && s.signedUrl) {
          result.set(s.path, s.signedUrl);
          signedUrlCache.set(`${bucket}:${s.path}`, {
            url: s.signedUrl,
            expiresAt: now + SIGNED_URL_TTL_MS,
          });
        }
      }
    }

    // Prune stale cache entries if cache size exceeds 1000 items
    if (signedUrlCache.size > 1000) {
      for (const [key, entry] of signedUrlCache.entries()) {
        if (entry.expiresAt <= now) {
          signedUrlCache.delete(key);
        }
      }
    }
  }

  return result;
}

const formatDocLabel = (code: string): string => {
  switch (code) {
    case "aadhaar":
      return "Aadhaar Card";
    case "driving_license":
      return "Driving License";
    case "bank_document":
      return "Bank Details";
    default:
      return code
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
};

/**
 * Fetch keyset-paginated approvals list via approval_list RPC with DB-level grouping.
 * Queue review is strictly restricted to admin users (super_admin, admin).
 */
export const getApprovalsListDAL = cache(
  async (
    params: ApprovalListParams = {},
    overrideCaller?: ApprovalCallerContext
  ): Promise<ApprovalListDALResult> => {
    try {
      let userId = overrideCaller?.id;
      let userRole = overrideCaller?.role;

      if (!userId || !userRole) {
        const user = await getCurrentUser();
        if (!user) {
          return {
            data: [],
            next_cursor: null,
            has_more: false,
            pending_total: 0,
            error: "Unauthorized",
          };
        }
        userId = user.id;
        userRole = user.role;
      }

      const isAdmin = userRole === "admin" || userRole === "super_admin";
      if (!isAdmin) {
        return {
          data: [],
          next_cursor: null,
          has_more: false,
          pending_total: 0,
          error: "Forbidden: Approvals queue is restricted to admin users.",
        };
      }

      const adminSupabase = createSupabaseAdminClient();
      const statusParam = params.status && params.status !== "all" ? params.status : "pending";
      const typeKeyParam = params.type_key && params.type_key !== "all" ? params.type_key : null;
      const limitParam = params.limit ?? 20;

      // ⚡ Single RPC round-trip: Keyset cursor pagination + DB-level registration grouping + pending count
      const { data: rpcRes, error: rpcErr } = await adminSupabase.rpc("approval_list", {
        p_status: statusParam,
        p_type_key: typeKeyParam,
        p_cursor_created_at: params.cursor_created_at ?? null,
        p_cursor_id: params.cursor_id ?? null,
        p_limit: limitParam,
      });

      if (rpcErr) {
        return {
          data: [],
          next_cursor: null,
          has_more: false,
          pending_total: 0,
          error: sanitizeUserErrorMessage(rpcErr),
        };
      }

      const resObj = (rpcRes && typeof rpcRes === "object" ? rpcRes : {}) as any;
      const rawItems: any[] = Array.isArray(resObj.items)
        ? resObj.items
        : Array.isArray(rpcRes)
        ? rpcRes
        : [];
      const nextCursor: ApprovalCursor | null = resObj.next_cursor || null;
      const hasMore: boolean = Boolean(resObj.has_more);
      const pendingTotal: number =
        typeof resObj.pending_total === "number" ? resObj.pending_total : rawItems.length;

      // Batch sign storage paths in parallel for all attached documents across user_files and doc_staging
      const userFilesPaths: string[] = [];
      const stagingPaths: string[] = [];

      for (const item of rawItems) {
        const p = (item.payload || {}) as Record<string, any>;
        if (p.staging_path) stagingPaths.push(p.staging_path);
        if (p.staging_thumb_path) stagingPaths.push(p.staging_thumb_path);
        if (p.storage_path) userFilesPaths.push(p.storage_path);
        if (p.thumb_path) userFilesPaths.push(p.thumb_path);

        for (const doc of item.documents || []) {
          if (doc.storage_path) userFilesPaths.push(doc.storage_path);
          if (doc.thumb_path) userFilesPaths.push(doc.thumb_path);
        }
      }

      const [signedUserFilesMap, signedStagingMap] = await Promise.all([
        resolveSignedUrlsBatch(adminSupabase, "user_files", userFilesPaths),
        resolveSignedUrlsBatch(adminSupabase, "doc_staging", stagingPaths),
      ]);

      const items: ApprovalRequestListItem[] = rawItems.map((row: any) => {
        const p = (row.payload || {}) as Record<string, any>;

        const documents = (row.documents || []).map((doc: any) => {
          const sPath = doc.storage_path ? doc.storage_path.replace(/^\/+/, "") : "";
          const tPath = doc.thumb_path ? doc.thumb_path.replace(/^\/+/, "") : "";
          return {
            id: doc.id,
            document_type_code: doc.document_type_code,
            label: formatDocLabel(doc.document_type_code),
            thumb_signed_url:
              signedUserFilesMap.get(tPath) ||
              signedUserFilesMap.get(sPath) ||
              null,
            signed_url:
              signedUserFilesMap.get(sPath) ||
              signedUserFilesMap.get(tPath) ||
              null,
            verification_status: doc.verification_status || "pending",
            file_size_bytes: doc.file_size_bytes,
            mime_type: doc.mime_type,
          };
        });

        // Document replacement: surface the staged replacement file
        if (row.type_key === "document_replace" && p.document_type_code) {
          const sPath = p.staging_path ? p.staging_path.replace(/^\/+/, "") : "";
          const tPath = p.staging_thumb_path ? p.staging_thumb_path.replace(/^\/+/, "") : "";
          documents.unshift({
            id: row.id,
            document_type_code: p.document_type_code,
            label: `${formatDocLabel(p.document_type_code)} (Replacement)`,
            thumb_signed_url:
              signedStagingMap.get(tPath) ||
              signedStagingMap.get(sPath) ||
              null,
            signed_url:
              signedStagingMap.get(sPath) ||
              signedStagingMap.get(tPath) ||
              null,
            verification_status: "pending",
            file_size_bytes: p.file_size_bytes,
            mime_type: "image/jpeg",
          });
        }

        // Standalone document verification fallback if documents array was empty
        if (
          row.type_key === "document_verify" &&
          documents.length === 0 &&
          p.document_type_code
        ) {
          const sPath = p.storage_path ? p.storage_path.replace(/^\/+/, "") : "";
          const tPath = p.thumb_path ? p.thumb_path.replace(/^\/+/, "") : "";
          documents.push({
            id: p.document_id || row.id,
            document_type_code: p.document_type_code,
            label: formatDocLabel(p.document_type_code),
            thumb_signed_url:
              signedUserFilesMap.get(tPath) ||
              signedUserFilesMap.get(sPath) ||
              null,
            signed_url:
              signedUserFilesMap.get(sPath) ||
              signedUserFilesMap.get(tPath) ||
              null,
            verification_status: row.status,
            file_size_bytes: p.file_size_bytes,
            mime_type: p.mime_type || "image/jpeg",
          });
        }

        return {
          id: row.id,
          type_key: row.type_key,
          type_label: row.type_label || row.type_key,
          subject_type: row.subject_type,
          subject_id: row.subject_id,
          subject_label: row.subject_label,
          requested_by: row.requested_by,
          requester_name: row.requester_name || null,
          status: row.status,
          summary: row.summary,
          priority: row.priority ?? 0,
          created_at: row.created_at,
          expires_at: row.expires_at,
          version: row.version,
          payload: p,
          role: row.role || row.requester_role || p.role || null,
          employee_id: row.employee_id || p.employee_id || null,
          email: row.email || p.email || null,
          phone: row.phone || p.phone || null,
          machine_category: row.machine_category || p.machine_category || null,
          supervisor_name: row.supervisor_name || p.supervisor_name || p.supervisorName || null,
          supervisor_id: row.supervisor_id || p.supervisor_id || p.supervisorId || null,
          documents,
          bound_request_ids: Array.isArray(row.bound_request_ids)
            ? row.bound_request_ids
            : [row.id],
        };
      });

      return {
        data: items,
        next_cursor: nextCursor,
        has_more: hasMore,
        pending_total: pendingTotal,
        error: null,
      };
    } catch (err) {
      return {
        data: [],
        next_cursor: null,
        has_more: false,
        pending_total: 0,
        error: sanitizeUserErrorMessage(err),
      };
    }
  }
);

/**
 * Fetch full approval request detail with type and requester metadata.
 */
export const getApprovalDetailDAL = cache(
  async (
    requestId: string,
    overrideCaller?: ApprovalCallerContext
  ): Promise<{ data: ApprovalRequest | null; error: string | null }> => {
    try {
      let userId = overrideCaller?.id;
      let userRole = overrideCaller?.role;

      if (!userId || !userRole) {
        const user = await getCurrentUser();
        if (!user) {
          return { data: null, error: "Unauthorized" };
        }
        userId = user.id;
        userRole = user.role;
      }

      const isAdmin = userRole === "admin" || userRole === "super_admin";

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
            id,
            type_key,
            subject_type,
            subject_id,
            subject_label,
            requested_by,
            status,
            summary,
            payload,
            decision_note,
            decided_by,
            decided_at,
            expires_at,
            supersedes_id,
            idempotency_key,
            version,
            created_at,
            updated_at,
            type:approval_types (
              key, label, category, approver_roles, required_approvals, allow_self_approve, ttl, cooling_off, priority, active
            ),
            requester:users!approval_requests_requested_by_fkey (
              id, full_name, email, role, phone, employee_id, machine_category
            )
          `)
          .eq("id", requestId)
          .maybeSingle();

        if (fbErr || !fbData) {
          return { data: null, error: sanitizeUserErrorMessage(fbErr || "Approval request not found") };
        }

        if (!isAdmin && fbData.requested_by !== userId && fbData.subject_id !== userId) {
          return { data: null, error: "Forbidden: Access denied to this approval request." };
        }

        const mapped = {
          ...fbData,
          type: Array.isArray(fbData.type) ? fbData.type[0] : fbData.type,
          requester: Array.isArray(fbData.requester) ? fbData.requester[0] : fbData.requester,
        } as unknown as ApprovalRequest;

        return { data: mapped, error: null };
      }

      return { data: data as ApprovalRequest, error: null };
    } catch (err) {
      return { data: null, error: sanitizeUserErrorMessage(err) };
    }
  }
);

/**
 * Fetch aggregated approval counts across types.
 * Strictly available to admin users; non-admins safely receive zero counts.
 */
export const getApprovalCountsDAL = cache(
  async (
    overrideCaller?: ApprovalCallerContext
  ): Promise<{ data: ApprovalCounts; error: string | null }> => {
    try {
      let userId = overrideCaller?.id;
      let userRole = overrideCaller?.role;

      if (!userId || !userRole) {
        const user = await getCurrentUser();
        if (!user) {
          return { data: { total: 0, by_type: {} }, error: "Unauthorized" };
        }
        userId = user.id;
        userRole = user.role;
      }

      const isAdmin = userRole === "admin" || userRole === "super_admin";
      if (!isAdmin) {
        return { data: { total: 0, by_type: {} }, error: null };
      }

      const adminSupabase = createSupabaseAdminClient();
      const { data, error } = await adminSupabase.rpc("approval_counts");

      if (error) {
        const { data: rows, error: fbErr } = await adminSupabase
          .from("approval_requests")
          .select("type_key")
          .eq("status", "pending")
          .is("parent_id", null);

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
