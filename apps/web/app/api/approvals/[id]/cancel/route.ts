import { NextRequest, NextResponse } from "next/server";
import { cancelApprovalAction } from "@/app/actions/approvals";
import {
  authenticateApprovalsRequest,
  NO_CACHE_HEADERS,
} from "@/lib/server/approvals-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/approvals/[id]/cancel
 * Cancel an open approval request (requester or admin).
 */
export async function POST(
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
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const result = await cancelApprovalAction({
      ...body,
      request_id: id,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    return NextResponse.json(result.data, { headers: NO_CACHE_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
