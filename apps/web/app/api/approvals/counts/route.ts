import { NextRequest, NextResponse } from "next/server";
import { getApprovalCountsDAL } from "@/lib/dal/approvals";
import {
  authenticateApprovalsRequest,
  NO_CACHE_HEADERS,
} from "@/lib/server/approvals-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/approvals/counts
 * Aggregated pending approval counts.
 * Strictly restricted to admin users (super_admin, admin).
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateApprovalsRequest(req);
    if (!auth.user) {
      return NextResponse.json(
        { error: auth.error || "Unauthorized" },
        { status: auth.status, headers: NO_CACHE_HEADERS }
      );
    }

    if (!auth.user.isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Approvals are restricted to admin users." },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    const { data, error } = await getApprovalCountsDAL({
      id: auth.user.id,
      role: auth.user.role,
    });

    if (error) {
      return NextResponse.json({ error }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    return NextResponse.json(data, { headers: NO_CACHE_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
