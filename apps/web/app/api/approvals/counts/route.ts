import { NextResponse } from "next/server";
import { getApprovalCountsDAL } from "@/lib/dal/approvals";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { data, error } = await getApprovalCountsDAL();
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
