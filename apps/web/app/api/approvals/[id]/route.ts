import { NextRequest, NextResponse } from "next/server";
import { getApprovalDetailDAL } from "@/lib/dal/approvals";
import {
  authenticateApprovalsRequest,
  NO_CACHE_HEADERS,
} from "@/lib/server/approvals-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/approvals/[id]
 * Fetch detailed approval request information.
 * Admins can access any request; non-admins can access only requests where
 * they are the requester or the target subject.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApprovalsRequest(req);
    if (!auth.user) {
      return NextResponse.json(
        { error: auth.error || "Unauthorized" },
        { status: auth.status, headers: NO_CACHE_HEADERS }
      );
    }

    const { id } = await params;
    const { data, error } = await getApprovalDetailDAL(id, {
      id: auth.user.id,
      role: auth.user.role,
    });

    if (error || !data) {
      const status = error?.includes("Forbidden") ? 403 : 404;
      return NextResponse.json(
        { error: error || "Approval request not found" },
        { status, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(data, { headers: NO_CACHE_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
