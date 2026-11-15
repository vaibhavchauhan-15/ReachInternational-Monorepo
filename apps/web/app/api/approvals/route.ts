import { NextRequest, NextResponse } from "next/server";
import { getApprovalsListDAL } from "@/lib/dal/approvals";
import { submitApprovalAction } from "@/app/actions/approvals";
import { ApprovalListQuerySchema } from "@reachinternational/validation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryObj: Record<string, any> = {};
    if (searchParams.get("status")) queryObj.status = searchParams.get("status");
    if (searchParams.get("type_key")) queryObj.type_key = searchParams.get("type_key");
    if (searchParams.get("cursor_created_at")) queryObj.cursor_created_at = searchParams.get("cursor_created_at");
    if (searchParams.get("cursor_id")) queryObj.cursor_id = searchParams.get("cursor_id");
    if (searchParams.get("limit")) queryObj.limit = parseInt(searchParams.get("limit")!, 10);

    const parsed = ApprovalListQuerySchema.safeParse(queryObj);
    const params = parsed.success ? parsed.data : {};

    const { data, error } = await getApprovalsListDAL(params);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await submitApprovalAction(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.data, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
