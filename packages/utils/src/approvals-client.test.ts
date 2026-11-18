import test from "node:test";
import assert from "node:assert/strict";
import {
  submitApproval,
  decideApproval,
  approveAll,
  cancelApproval,
  listApprovals,
  getApproval,
  approvalCounts,
  type ApprovalRpcClient,
} from "./approvals-client.ts";

test("submitApproval executes approval_submit RPC and returns request id", async () => {
  const mockRpc: ApprovalRpcClient = {
    rpc: async <T = any>(fn: string, args?: Record<string, unknown>) => {
      assert.equal(fn, "approval_submit");
      assert.equal(args?.p_type_key, "document_verify");
      assert.equal(args?.p_subject_type, "document");
      return { data: "req-123" as unknown as T, error: null };
    },
  };

  const res = await submitApproval(mockRpc, {
    type_key: "document_verify",
    subject_type: "document",
    subject_id: "doc-1",
    payload: { doc_type: "bank_document" },
  });

  assert.equal(res.error, null);
  assert.deepEqual(res.data, { id: "req-123" });
});

test("submitApproval sanitizes database errors", async () => {
  const mockRpc: ApprovalRpcClient = {
    rpc: async <T = any>() => {
      return {
        data: null,
        error: { message: "duplicate key value violates unique constraint approval_one_open_per_subject" },
      };
    },
  };

  const res = await submitApproval(mockRpc, {
    type_key: "document_verify",
    subject_type: "document",
    payload: {},
  });

  assert.equal(res.data, null);
  assert.ok(res.error);
  assert.ok(!res.error.includes("unique constraint"));
});

test("decideApproval calls approval_decide RPC with expected version", async () => {
  const mockRpc: ApprovalRpcClient = {
    rpc: async <T = any>(fn: string, args?: Record<string, unknown>) => {
      assert.equal(fn, "approval_decide");
      assert.equal(args?.p_request_id, "req-1");
      assert.equal(args?.p_decision, "approve");
      assert.equal(args?.p_expected_version, 1);
      return {
        data: { success: true, status: "approved", version: 2 } as unknown as T,
        error: null,
      };
    },
  };

  const res = await decideApproval(mockRpc, {
    request_id: "req-1",
    decision: "approve",
    expected_version: 1,
  });

  assert.equal(res.error, null);
  assert.equal(res.data?.success, true);
  assert.equal(res.data?.status, "approved");
  assert.equal(res.data?.version, 2);
});

test("cancelApproval calls approval_cancel RPC", async () => {
  const mockRpc: ApprovalRpcClient = {
    rpc: async <T = any>(fn: string, args?: Record<string, unknown>) => {
      assert.equal(fn, "approval_cancel");
      assert.equal(args?.p_request_id, "req-1");
      return {
        data: { success: true, status: "cancelled" } as unknown as T,
        error: null,
      };
    },
  };

  const res = await cancelApproval(mockRpc, {
    request_id: "req-1",
    note: "User requested cancel",
  });

  assert.equal(res.error, null);
  assert.equal(res.data?.success, true);
  assert.equal(res.data?.status, "cancelled");
});

test("approveAll calls approval_approve_all RPC and activates users", async () => {
  const mockRpc: ApprovalRpcClient = {
    rpc: async <T = any>(fn: string, args?: Record<string, unknown>) => {
      assert.equal(fn, "approval_approve_all");
      assert.equal(args?.p_type_key, "registration");
      assert.equal(args?.p_actor_id, "admin-1");
      return {
        data: {
          success: true,
          approved_count: 3,
          approved_ids: ["req-1", "req-2", "req-3"],
          activated_user_ids: ["user-1", "user-2", "user-3"],
        } as unknown as T,
        error: null,
      };
    },
  };

  const res = await approveAll(mockRpc, {
    type_key: "registration",
    actor_id: "admin-1",
  });

  assert.equal(res.error, null);
  assert.equal(res.data?.success, true);
  assert.equal(res.data?.approved_count, 3);
  assert.deepEqual(res.data?.activated_user_ids, ["user-1", "user-2", "user-3"]);
});


test("listApprovals calls approval_list RPC with keyset pagination params", async () => {
  const mockRpc: ApprovalRpcClient = {
    rpc: async <T = any>(fn: string, args?: Record<string, unknown>) => {
      assert.equal(fn, "approval_list");
      assert.equal(args?.p_status, "pending");
      assert.equal(args?.p_limit, 20);
      return {
        data: [
          {
            id: "req-1",
            type_key: "profile_change",
            type_label: "Profile Change",
            subject_type: "user",
            subject_id: "u-1",
            requested_by: "u-1",
            status: "pending",
            summary: "Update phone number",
            priority: 0,
            created_at: "2026-11-15T12:00:00Z",
            version: 1,
          },
        ] as unknown as T,
        error: null,
      };
    },
  };

  const res = await listApprovals(mockRpc, { status: "pending", limit: 20 });
  assert.equal(res.error, null);
  assert.equal(res.data?.length, 1);
  assert.equal(res.data?.[0].id, "req-1");
});

test("approvalCounts calls approval_counts RPC", async () => {
  const mockRpc: ApprovalRpcClient = {
    rpc: async <T = any>(fn: string) => {
      assert.equal(fn, "approval_counts");
      return {
        data: { total: 5, by_type: { document_verify: 3, profile_change: 2 } } as unknown as T,
        error: null,
      };
    },
  };

  const res = await approvalCounts(mockRpc);
  assert.equal(res.error, null);
  assert.equal(res.data?.total, 5);
  assert.equal(res.data?.by_type.document_verify, 3);
});

test("submitApproval with HTTP transport dispatches fetch request", async () => {
  const mockFetch: typeof fetch = async (url, init) => {
    assert.equal(url, "https://api.reachinternational.com/api/approvals");
    assert.equal(init?.method, "POST");
    return {
      ok: true,
      json: async () => ({ id: "http-req-99" }),
    } as any;
  };

  const res = await submitApproval(
    {
      baseUrl: "https://api.reachinternational.com",
      fetchFn: mockFetch,
    },
    {
      type_key: "registration",
      subject_type: "user",
      payload: { full_name: "John Doe" },
    }
  );

  assert.equal(res.error, null);
  assert.deepEqual(res.data, { id: "http-req-99" });
});
