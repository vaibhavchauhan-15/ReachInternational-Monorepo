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
} from "@reachinternational/types";
import { sanitizeUserErrorMessage } from "@reachinternational/utils";

export interface ApprovalListParams {
  status?: ApprovalStatus;
  type_key?: string;
  cursor_created_at?: string;
  cursor_id?: string;
  limit?: number;
}

export interface ApprovalCallerContext {
  id: string;
  role: string;
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
    const cacheKey = `${bucket}:${p}`;
    const cached = signedUrlCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      result.set(p, cached.url);
    } else {
      missingPaths.push(p);
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

/**
 * Fetch keyset-paginated approvals list via approval_list RPC.
 * Queue review is strictly restricted to admin users (super_admin, admin).
 */
export const getApprovalsListDAL = cache(
  async (
    params: ApprovalListParams = {},
    overrideCaller?: ApprovalCallerContext
  ): Promise<{ data: ApprovalRequestListItem[]; error: string | null }> => {
    try {
      let userId = overrideCaller?.id;
      let userRole = overrideCaller?.role;

      if (!userId || !userRole) {
        const user = await getCurrentUser();
        if (!user) {
          return { data: [], error: "Unauthorized" };
        }
        userId = user.id;
        userRole = user.role;
      }

      const isAdmin = userRole === "admin" || userRole === "super_admin";
      if (!isAdmin) {
        return { data: [], error: "Forbidden: Approvals queue is restricted to admin users." };
      }

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
          payload,
          version,
          created_at,
          expires_at,
          type:approval_types (
            label,
            priority
          ),
          requester:users!approval_requests_requested_by_fkey (
            id,
            full_name,
            email,
            phone,
            role,
            employee_id,
            machine_category
          )
        `)
        .order("created_at", { ascending: false })
        .limit(params.limit ?? 50);

      if (params.status && params.status !== ("all" as any)) {
        query = query.eq("status", params.status);
      }
      if (params.type_key) {
        query = query.eq("type_key", params.type_key);
      }

      const { data: rows, error: qErr } = await query;
      if (qErr) {
        return { data: [], error: sanitizeUserErrorMessage(qErr) };
      }

      const userProfileMap = new Map<string, any>();
      for (const row of rows || []) {
        const reqObj: any = Array.isArray(row.requester) ? row.requester[0] : row.requester;
        if (reqObj?.id) {
          userProfileMap.set(reqObj.id, reqObj);
        }
      }

      const missingUserIds = (rows || [])
        .map((r: any) => {
          const p = r.payload || {};
          return p.user_id || (r.subject_type === "user" ? r.subject_id : null);
        })
        .filter((id: string | null) => Boolean(id) && !userProfileMap.has(id!)) as string[];

      const targetUserIds = Array.from(
        new Set(
          (rows || [])
            .map((r: any) => {
              const p = r.payload || {};
              return (
                p.user_id ||
                (r.subject_type === "user" ? r.subject_id : null) ||
                r.requested_by
              );
            })
            .filter(Boolean)
        )
      ) as string[];

      // Parallel data fetching for missing user profiles and associated documents
      const [missingUsersRes, userDocsRes] = await Promise.all([
        missingUserIds.length > 0
          ? adminSupabase
              .from("users")
              .select("id, full_name, email, phone, role, employee_id, machine_category")
              .in("id", Array.from(new Set(missingUserIds)))
          : Promise.resolve({ data: null }),
        targetUserIds.length > 0
          ? adminSupabase
              .from("user_documents")
              .select(
                "id, user_id, document_type_code, storage_path, thumb_path, verification_status, mime_type, file_size_bytes"
              )
              .in("user_id", targetUserIds)
              .order("created_at", { ascending: true })
          : Promise.resolve({ data: null }),
      ]);

      if (missingUsersRes.data) {
        for (const u of missingUsersRes.data) {
          userProfileMap.set(u.id, u);
        }
      }

      const userDocsMap = new Map<string, any[]>();
      const userFilesPaths: string[] = [];

      if (userDocsRes.data) {
        for (const doc of userDocsRes.data) {
          const list = userDocsMap.get(doc.user_id) || [];
          list.push(doc);
          userDocsMap.set(doc.user_id, list);
          if (doc.storage_path) userFilesPaths.push(doc.storage_path);
          if (doc.thumb_path) userFilesPaths.push(doc.thumb_path);
        }
      }

      const stagingPaths: string[] = [];
      for (const row of rows || []) {
        const p = (row.payload || {}) as Record<string, any>;
        if (p.staging_path) stagingPaths.push(p.staging_path);
        if (p.staging_thumb_path) stagingPaths.push(p.staging_thumb_path);
        if (p.storage_path) userFilesPaths.push(p.storage_path);
        if (p.thumb_path) userFilesPaths.push(p.thumb_path);
      }

      // ⚡ Parallel batch signed URL resolution across storage buckets with 45-min memory caching
      const [signedUserFilesMap, signedStagingMap] = await Promise.all([
        resolveSignedUrlsBatch(adminSupabase, "user_files", userFilesPaths),
        resolveSignedUrlsBatch(adminSupabase, "doc_staging", stagingPaths),
      ]);

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

      const mapped: ApprovalRequestListItem[] = (rows || []).map((row: any) => {
        const p = (row.payload || {}) as Record<string, any>;
        const targetUserId =
          p.user_id ||
          (row.subject_type === "user" ? row.subject_id : null) ||
          row.requested_by;
        const reqObj: any = Array.isArray(row.requester) ? row.requester[0] : row.requester;
        const profile = userProfileMap.get(targetUserId) || reqObj || null;

        let empId = profile?.employee_id || p.employee_id || null;
        if (!empId && row.subject_label?.includes("·")) {
          const parts = row.subject_label.split("·").map((s: string) => s.trim());
          if (
            parts[0] &&
            (parts[0].startsWith("EMP") ||
              parts[0].startsWith("RI-") ||
              parts[0].startsWith("#"))
          ) {
            empId = parts[0];
          }
        }

        const rawDocs = targetUserId ? userDocsMap.get(targetUserId) || [] : [];
        const attachedDocs = rawDocs.map((doc: any) => ({
          id: doc.id,
          document_type_code: doc.document_type_code,
          label: formatDocLabel(doc.document_type_code),
          thumb_signed_url:
            (doc.thumb_path ? signedUserFilesMap.get(doc.thumb_path) : null) ||
            (doc.storage_path ? signedUserFilesMap.get(doc.storage_path) : null) ||
            null,
          signed_url:
            (doc.storage_path ? signedUserFilesMap.get(doc.storage_path) : null) ||
            (doc.thumb_path ? signedUserFilesMap.get(doc.thumb_path) : null) ||
            null,
          verification_status: doc.verification_status || "pending",
          file_size_bytes: doc.file_size_bytes,
          mime_type: doc.mime_type,
        }));

        if (
          row.type_key === "document_verify" &&
          attachedDocs.length === 0 &&
          p.document_type_code
        ) {
          attachedDocs.push({
            id: p.document_id || row.id,
            document_type_code: p.document_type_code,
            label: formatDocLabel(p.document_type_code),
            thumb_signed_url:
              (p.thumb_path ? signedUserFilesMap.get(p.thumb_path) : null) ||
              (p.storage_path ? signedUserFilesMap.get(p.storage_path) : null) ||
              null,
            signed_url:
              (p.storage_path ? signedUserFilesMap.get(p.storage_path) : null) ||
              (p.thumb_path ? signedUserFilesMap.get(p.thumb_path) : null) ||
              null,
            verification_status: row.status,
            file_size_bytes: p.file_size_bytes,
            mime_type: p.mime_type || "image/jpeg",
          });
        }

        if (row.type_key === "document_replace" && p.document_type_code) {
          attachedDocs.unshift({
            id: row.id,
            document_type_code: p.document_type_code,
            label: `${formatDocLabel(p.document_type_code)} (Replacement)`,
            thumb_signed_url:
              (p.staging_thumb_path ? signedStagingMap.get(p.staging_thumb_path) : null) ||
              (p.staging_path ? signedStagingMap.get(p.staging_path) : null) ||
              null,
            signed_url:
              (p.staging_path ? signedStagingMap.get(p.staging_path) : null) ||
              (p.staging_thumb_path ? signedStagingMap.get(p.staging_thumb_path) : null) ||
              null,
            verification_status: "pending",
            file_size_bytes: p.file_size_bytes,
            mime_type: "image/jpeg",
          });
        }

        return {
          id: row.id,
          type_key: row.type_key,
          type_label: row.type?.label || row.type_key,
          subject_type: row.subject_type,
          subject_id: row.subject_id,
          subject_label: row.subject_label,
          requested_by: row.requested_by,
          requester_name:
            profile?.full_name || reqObj?.full_name || p.full_name || null,
          status: row.status,
          summary: row.summary,
          priority: row.type?.priority ?? 0,
          created_at: row.created_at,
          expires_at: row.expires_at,
          version: row.version,
          payload: p,
          role: profile?.role || p.role || null,
          employee_id: empId,
          email: profile?.email || p.email || null,
          phone: profile?.phone || p.phone || null,
          machine_category:
            profile?.machine_category || p.machine_category || null,
          documents: attachedDocs,
          bound_request_ids: [row.id],
        };
      });

      // ─── Approvals Normalization Engine ──────────────────────────
      // 1. Group / suppress redundant document_verify requests for users undergoing registration
      // 2. Bind multiple requests of same type for same user into one consolidated card
      const pendingRegistrationUserIds = new Set<string>();
      for (const item of mapped) {
        if (item.type_key === "registration" && item.status === "pending") {
          const uId = item.payload?.user_id || item.subject_id || item.requested_by;
          if (uId) pendingRegistrationUserIds.add(uId);
        }
      }

      // Map of registration items by userId for attaching bound document_verify IDs
      const registrationByUserId = new Map<string, ApprovalRequestListItem>();
      for (const item of mapped) {
        if (item.type_key === "registration" && item.status === "pending") {
          const uId = item.payload?.user_id || item.subject_id || item.requested_by;
          if (uId) registrationByUserId.set(uId, item);
        }
      }

      const normalized: ApprovalRequestListItem[] = [];
      // Groups for binding same-user same-type requests: key = `${targetUserId}:${typeKey}`
      const groupedIndex = new Map<string, ApprovalRequestListItem>();

      for (const item of mapped) {
        const targetUserId =
          item.payload?.user_id ||
          (item.subject_type === "user" ? item.subject_id : null) ||
          item.requested_by;

        // If this is a document_verify request for a user who already has a pending registration card:
        // Absorb it into the registration card and suppress this duplicate standalone card!
        if (
          item.type_key === "document_verify" &&
          targetUserId &&
          pendingRegistrationUserIds.has(targetUserId)
        ) {
          const regItem = registrationByUserId.get(targetUserId);
          if (regItem) {
            regItem.bound_request_ids = regItem.bound_request_ids || [];
            if (!regItem.bound_request_ids.includes(item.id)) {
              regItem.bound_request_ids.push(item.id);
            }
          }
          continue; // Suppress duplicate standalone document_verify card
        }

        // For document_verify or document_replace: bind multiple same-user requests into 1 consolidated card
        if (
          (item.type_key === "document_verify" || item.type_key === "document_replace") &&
          targetUserId &&
          item.status === "pending"
        ) {
          const groupKey = `${targetUserId}:${item.type_key}`;
          const existing = groupedIndex.get(groupKey);

          if (existing) {
            // Bind into existing card
            existing.bound_request_ids = existing.bound_request_ids || [existing.id];
            if (!existing.bound_request_ids.includes(item.id)) {
              existing.bound_request_ids.push(item.id);
            }

            // Merge documents without duplicate IDs
            const existingDocIds = new Set((existing.documents || []).map((d) => d.id));
            for (const doc of item.documents || []) {
              if (!existingDocIds.has(doc.id)) {
                existing.documents = existing.documents || [];
                existing.documents.push(doc);
                existingDocIds.add(doc.id);
              }
            }

            // Update summary and subject_label for multi-document representation
            const totalDocs = existing.documents?.length || 1;
            if (totalDocs > 1) {
              const uName = existing.requester_name || existing.subject_label || "User";
              existing.subject_label = `${uName} (${totalDocs} Documents)`;
              existing.summary = `${existing.type_label}: ${uName} (${totalDocs} documents pending review)`;
            }
            continue; // Absorbed into existing card
          } else {
            item.bound_request_ids = [item.id];
            groupedIndex.set(groupKey, item);
            normalized.push(item);
            continue;
          }
        }

        normalized.push(item);
      }

      return { data: normalized, error: null };
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
