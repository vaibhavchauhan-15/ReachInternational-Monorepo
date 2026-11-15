import { NextRequest, NextResponse } from "next/server";
import { getApprovalDetailDAL } from "@/lib/dal/approvals";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { data, error } = await getApprovalDetailDAL(id);

    if (error || !data) {
      return NextResponse.json(
        { error: error || "Approval request not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
