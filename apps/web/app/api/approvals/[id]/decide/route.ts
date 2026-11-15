import { NextRequest, NextResponse } from "next/server";
import { decideApprovalAction } from "@/app/actions/approvals";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const result = await decideApprovalAction({
      ...body,
      request_id: id,
    });

    if (!result.success) {
      const status = result.isVersionConflict ? 409 : 400;
      return NextResponse.json({ error: result.error, isVersionConflict: result.isVersionConflict }, { status });
    }

    return NextResponse.json(result.data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
