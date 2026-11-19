import { NextRequest, NextResponse } from "next/server";
import { approveAllAction } from "@/app/actions/approvals";
import {
  authenticateApprovalsRequest,
  NO_CACHE_HEADERS,
} from "@/lib/server/approvals-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/approvals/approve-all
 * Approve All pending approval requests.
 * Invariant: For user registrations, activates users immediately while keeping all user documents pending.
 * Strictly restricted to admin users (super_admin, admin).
 */
export async function POST(req: NextRequest) {
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

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    // ⚡ Pass pre-authenticated user — eliminates double auth (saves ~200-400ms)
    const result = await approveAllAction(body, { id: auth.user.id, role: auth.user.role });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    return NextResponse.json(result.data, { headers: NO_CACHE_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
