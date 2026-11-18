import { NextRequest, NextResponse } from "next/server";
import { getApprovalsListDAL } from "@/lib/dal/approvals";
import { submitApprovalAction } from "@/app/actions/approvals";
import { ApprovalListQuerySchema } from "@reachinternational/validation";
import {
  authenticateApprovalsRequest,
  NO_CACHE_HEADERS,
} from "@/lib/server/approvals-auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/approvals
 * Keyset-paginated approvals queue.
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
        { error: "Forbidden: Approvals queue is restricted to admin users." },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    const { searchParams } = new URL(req.url);
    const queryObj: Record<string, any> = {};
    if (searchParams.get("status")) queryObj.status = searchParams.get("status");
    if (searchParams.get("type_key")) queryObj.type_key = searchParams.get("type_key");
    if (searchParams.get("cursor_created_at")) queryObj.cursor_created_at = searchParams.get("cursor_created_at");
    if (searchParams.get("cursor_id")) queryObj.cursor_id = searchParams.get("cursor_id");
    if (searchParams.get("limit")) queryObj.limit = parseInt(searchParams.get("limit")!, 10);

    const parsed = ApprovalListQuerySchema.safeParse(queryObj);
    const params = parsed.success ? parsed.data : {};

    const { data, error } = await getApprovalsListDAL(params, {
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

/**
 * POST /api/approvals
 * Submit a request to the central approval engine.
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

    const body = await req.json();
    const result = await submitApprovalAction(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    return NextResponse.json(result.data, { status: 201, headers: NO_CACHE_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
