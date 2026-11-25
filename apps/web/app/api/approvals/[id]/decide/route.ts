import { NextRequest, NextResponse } from "next/server";
import { decideApprovalAction } from "@/app/actions/approvals";
import {
  authenticateApprovalsRequest,
  NO_CACHE_HEADERS,
} from "@/lib/server/approvals-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/approvals/[id]/decide
 * Approve or Reject an approval request.
 * Strictly restricted to admin users (super_admin, admin).
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

    if (!auth.user.isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Only admin users can decide approval requests." },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    // ⚡ Pass pre-authenticated user — eliminates double auth (saves ~200-400ms)
    const result = await decideApprovalAction(
      { ...body, request_id: id },
      { id: auth.user.id, role: auth.user.role }
    );

    if (!result.success) {
      const status = result.isVersionConflict || result.isAlreadyDecided ? 409 : 400;
      return NextResponse.json(
        {
          error: result.error,
          isVersionConflict: result.isVersionConflict,
          isAlreadyDecided: result.isAlreadyDecided,
        },
        { status, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(result.data, { headers: NO_CACHE_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
