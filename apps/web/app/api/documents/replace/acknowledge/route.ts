import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { acknowledgeRejectedDocumentReplacement } from "@/lib/server/document-replacement";
import type { DocType } from "@reachinternational/utils";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const adminSupabase = createSupabaseAdminClient();
    let user: { id: string } | null = null;

    // 1. Check Authorization: Bearer <token> (Native mobile / API clients)
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const { data, error } = await adminSupabase.auth.getUser(token);
      if (!error && data?.user) {
        user = data.user;
      }
    }

    // 2. Fall back to Next.js cookie-based Supabase session (Web browser)
    if (!user) {
      const supabase = await createSupabaseServerClient();
      const { data, error: authErr } = await supabase.auth.getUser();
      if (!authErr && data?.user) {
        user = data.user;
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const { changeRequestId, docType } = body as { changeRequestId?: string; docType?: DocType };

    if (!changeRequestId && !docType) {
      return NextResponse.json(
        { error: "changeRequestId or docType is required" },
        { status: 400 }
      );
    }

    const result = await acknowledgeRejectedDocumentReplacement({
      userId: user.id,
      changeRequestId,
      docType,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to acknowledge rejected document" },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[API:documents:replace:acknowledge] Fatal error:", errorMsg);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
