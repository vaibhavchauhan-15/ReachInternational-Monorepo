/**
 * Universal Approval Engine Transport Client (@reachinternational/utils)
 * Typed, cross-platform client functions supporting both direct Supabase RPC execution
 * and HTTP / REST endpoint transports with zero-leak error sanitization.
 */

import type {
  ApprovalCounts,
  ApprovalRequest,
  ApprovalRequestListItem,
  ApprovalStatus,
} from "@reachinternational/types";
import { sanitizeUserErrorMessage } from "./errors.ts";

export interface ApprovalRpcClient {
  rpc: <T = any>(
    fn: string,
    args?: Record<string, unknown>
  ) => PromiseLike<{ data: T | null; error: any }>;
}

export interface ApprovalHttpOptions {
  baseUrl?: string;
  token?: string;
  fetchFn?: typeof fetch;
}

export type ApprovalClientTransport = ApprovalRpcClient | ApprovalHttpOptions;

function isRpcClient(transport: ApprovalClientTransport): transport is ApprovalRpcClient {
  return typeof (transport as any)?.rpc === "function";
}

export interface ClientResult<T> {
  data: T | null;
  error: string | null;
}

export interface SubmitApprovalInput {
  type_key: string;
  subject_type: string;
  subject_id?: string | null;
  payload: Record<string, unknown>;
  idempotency_key?: string;
  summary?: string;
  subject_label?: string;
}

export interface DecideApprovalInput {
  request_id: string;
  decision: "approve" | "reject";
  note?: string;
  expected_version?: number;
}

export interface CancelApprovalInput {
  request_id: string;
  note?: string;
}

export interface ListApprovalsInput {
  status?: ApprovalStatus;
  type_key?: string;
  cursor_created_at?: string;
  cursor_id?: string;
  limit?: number;
}

/**
 * Submit a proposed change for approval.
 */
export async function submitApproval(
  transport: ApprovalClientTransport,
  input: SubmitApprovalInput
): Promise<ClientResult<{ id: string }>> {
  try {
    if (isRpcClient(transport)) {
      const { data, error } = await transport.rpc<string | { id: string }>("approval_submit", {
        p_type_key: input.type_key,
        p_subject_type: input.subject_type,
        p_subject_id: input.subject_id ?? null,
        p_payload: input.payload,
        p_idempotency_key: input.idempotency_key ?? null,
        p_summary: input.summary ?? null,
        p_subject_label: input.subject_label ?? null,
      });

      if (error) {
        return { data: null, error: sanitizeUserErrorMessage(error) };
      }
      const id = typeof data === "string" ? data : (data as any)?.id;
      return { data: { id }, error: null };
    }

    const fetchImpl = transport.fetchFn || fetch;
    const base = transport.baseUrl || "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (transport.token) headers["Authorization"] = `Bearer ${transport.token}`;

    const res = await fetchImpl(`${base}/api/approvals`, {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { data: null, error: sanitizeUserErrorMessage(json.error || json.message) };
    }
    return { data: json.data || json, error: null };
  } catch (err) {
    return { data: null, error: sanitizeUserErrorMessage(err) };
  }
}

/**
 * Record an approval or rejection decision.
 */
export async function decideApproval(
  transport: ApprovalClientTransport,
  input: DecideApprovalInput
): Promise<ClientResult<{ success: boolean; status: ApprovalStatus; version: number }>> {
  try {
    if (isRpcClient(transport)) {
      const { data, error } = await transport.rpc<{
        success: boolean;
        status: ApprovalStatus;
        version: number;
      }>("approval_decide", {
        p_request_id: input.request_id,
        p_decision: input.decision,
        p_note: input.note ?? null,
        p_expected_version: input.expected_version ?? null,
      });

      if (error) {
        return { data: null, error: sanitizeUserErrorMessage(error) };
      }
      return { data, error: null };
    }

    const fetchImpl = transport.fetchFn || fetch;
    const base = transport.baseUrl || "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (transport.token) headers["Authorization"] = `Bearer ${transport.token}`;

    const res = await fetchImpl(`${base}/api/approvals/${input.request_id}/decide`, {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { data: null, error: sanitizeUserErrorMessage(json.error || json.message) };
    }
    return { data: json.data || json, error: null };
  } catch (err) {
    return { data: null, error: sanitizeUserErrorMessage(err) };
  }
}

/**
 * Cancel an open approval request (requester only).
 */
export async function cancelApproval(
  transport: ApprovalClientTransport,
  input: CancelApprovalInput
): Promise<ClientResult<{ success: boolean; status: ApprovalStatus }>> {
  try {
    if (isRpcClient(transport)) {
      const { data, error } = await transport.rpc<{
        success: boolean;
        status: ApprovalStatus;
      }>("approval_cancel", {
        p_request_id: input.request_id,
        p_note: input.note ?? null,
      });

      if (error) {
        return { data: null, error: sanitizeUserErrorMessage(error) };
      }
      return { data, error: null };
    }

    const fetchImpl = transport.fetchFn || fetch;
    const base = transport.baseUrl || "";
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (transport.token) headers["Authorization"] = `Bearer ${transport.token}`;

    const res = await fetchImpl(`${base}/api/approvals/${input.request_id}/cancel`, {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { data: null, error: sanitizeUserErrorMessage(json.error || json.message) };
    }
    return { data: json.data || json, error: null };
  } catch (err) {
    return { data: null, error: sanitizeUserErrorMessage(err) };
  }
}

/**
 * List approval requests using keyset pagination.
 */
export async function listApprovals(
  transport: ApprovalClientTransport,
  params: ListApprovalsInput = {}
): Promise<ClientResult<ApprovalRequestListItem[]>> {
  try {
    if (isRpcClient(transport)) {
      const { data, error } = await transport.rpc<ApprovalRequestListItem[]>("approval_list", {
        p_status: params.status ?? "pending",
        p_type_key: params.type_key ?? null,
        p_cursor_created_at: params.cursor_created_at ?? null,
        p_cursor_id: params.cursor_id ?? null,
        p_limit: params.limit ?? 20,
      });

      if (error) {
        return { data: null, error: sanitizeUserErrorMessage(error) };
      }
      return { data: Array.isArray(data) ? data : [], error: null };
    }

    const fetchImpl = transport.fetchFn || fetch;
    const base = transport.baseUrl || "";
    const headers: Record<string, string> = { Accept: "application/json" };
    if (transport.token) headers["Authorization"] = `Bearer ${transport.token}`;

    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.type_key) q.set("type_key", params.type_key);
    if (params.cursor_created_at) q.set("cursor_created_at", params.cursor_created_at);
    if (params.cursor_id) q.set("cursor_id", params.cursor_id);
    if (params.limit) q.set("limit", String(params.limit));

    const res = await fetchImpl(`${base}/api/approvals?${q.toString()}`, {
      method: "GET",
      headers,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { data: null, error: sanitizeUserErrorMessage(json.error || json.message) };
    }
    return { data: json.data || json, error: null };
  } catch (err) {
    return { data: null, error: sanitizeUserErrorMessage(err) };
  }
}

/**
 * Get a single approval request by ID with type and requester metadata.
 */
export async function getApproval(
  transport: ApprovalClientTransport,
  requestId: string
): Promise<ClientResult<ApprovalRequest>> {
  try {
    if (isRpcClient(transport)) {
      const { data, error } = await transport.rpc<ApprovalRequest>("approval_get", {
        p_request_id: requestId,
      });

      if (error) {
        return { data: null, error: sanitizeUserErrorMessage(error) };
      }
      return { data, error: null };
    }

    const fetchImpl = transport.fetchFn || fetch;
    const base = transport.baseUrl || "";
    const headers: Record<string, string> = { Accept: "application/json" };
    if (transport.token) headers["Authorization"] = `Bearer ${transport.token}`;

    const res = await fetchImpl(`${base}/api/approvals/${requestId}`, {
      method: "GET",
      headers,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { data: null, error: sanitizeUserErrorMessage(json.error || json.message) };
    }
    return { data: json.data || json, error: null };
  } catch (err) {
    return { data: null, error: sanitizeUserErrorMessage(err) };
  }
}

/**
 * Get aggregated counts of pending approval requests.
 */
export async function approvalCounts(
  transport: ApprovalClientTransport
): Promise<ClientResult<ApprovalCounts>> {
  try {
    if (isRpcClient(transport)) {
      const { data, error } = await transport.rpc<ApprovalCounts>("approval_counts");

      if (error) {
        return { data: null, error: sanitizeUserErrorMessage(error) };
      }
      return { data, error: null };
    }

    const fetchImpl = transport.fetchFn || fetch;
    const base = transport.baseUrl || "";
    const headers: Record<string, string> = { Accept: "application/json" };
    if (transport.token) headers["Authorization"] = `Bearer ${transport.token}`;

    const res = await fetchImpl(`${base}/api/approvals/counts`, {
      method: "GET",
      headers,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { data: null, error: sanitizeUserErrorMessage(json.error || json.message) };
    }
    return { data: json.data || json, error: null };
  } catch (err) {
    return { data: null, error: sanitizeUserErrorMessage(err) };
  }
}
