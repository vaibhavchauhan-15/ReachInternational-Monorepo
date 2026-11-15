import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canVerifyDocument, canRejectDocument } from "@reachinternational/permissions";
import type { UserRole } from "@reachinternational/types";
import {
  approveDocumentReplacementCore,
  rejectDocumentReplacementCore,
  verifyUserDocumentCore,
  rejectUserDocumentCore,
} from "@/lib/server/document-review";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function POST(req: NextRequest) {
  try {
    const adminSupabase = createSupabaseAdminClient();
    let authUser: { id: string } | null = null;

    // 1. Dual authentication: Bearer token (Mobile) or Cookie session (Web)
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const { data, error } = await adminSupabase.auth.getUser(token);
      if (!error && data?.user) {
        authUser = data.user;
      }
    }

    if (!authUser) {
      try {
        const supabase = await createSupabaseServerClient();
        const { data, error: authErr } = await supabase.auth.getUser();
        if (!authErr && data?.user) {
          authUser = data.user;
        }
      } catch {
        // Fallback handled below
      }
    }

    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    // 2. Fetch reviewer role
    const { data: userRow } = await adminSupabase
      .from("users")
      .select("role")
      .eq("id", authUser.id)
      .maybeSingle();

    const role = (userRow?.role || "operator") as UserRole;
    if (!canVerifyDocument({ id: authUser.id, role }) && !canRejectDocument({ id: authUser.id, role })) {
      return NextResponse.json(
        { error: "Forbidden: Only Super Admin, Admin, and HR can review documents." },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    // 3. Parse payload
    const body = await req.json().catch(() => ({}));
    const { action, requestId, documentId, rejectionReason, isPendingRequest } = body;

    let result: { success: boolean; error?: string } = { success: false, error: "Invalid action." };

    if (action === "approve_replacement") {
      if (!requestId) {
        return NextResponse.json({ error: "requestId is required." }, { status: 400 });
      }
      result = await approveDocumentReplacementCore({ reviewerId: authUser.id, requestId });
    } else if (action === "reject_replacement") {
      if (!requestId) {
        return NextResponse.json({ error: "requestId is required." }, { status: 400 });
      }
      result = await rejectDocumentReplacementCore({
        reviewerId: authUser.id,
        requestId,
        rejectionReason: rejectionReason || "Document does not meet requirements",
      });
    } else if (action === "verify_document") {
      if (isPendingRequest && requestId) {
        result = await approveDocumentReplacementCore({ reviewerId: authUser.id, requestId });
      } else if (documentId) {
        result = await verifyUserDocumentCore({ reviewerId: authUser.id, documentId });
      } else {
        return NextResponse.json({ error: "documentId or requestId is required." }, { status: 400 });
      }
    } else if (action === "reject_document") {
      if (!rejectionReason || !rejectionReason.trim()) {
        return NextResponse.json({ error: "A rejection reason is required." }, { status: 400 });
      }
      if (isPendingRequest && requestId) {
        result = await rejectDocumentReplacementCore({
          reviewerId: authUser.id,
          requestId,
          rejectionReason,
        });
      } else if (documentId) {
        result = await rejectUserDocumentCore({
          reviewerId: authUser.id,
          documentId,
          rejectionReason,
        });
      } else {
        return NextResponse.json({ error: "documentId or requestId is required." }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: `Unknown review action: ${action}` }, { status: 400 });
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Review operation failed" },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    revalidateTag(CACHE_TAGS.users, "max");

    return NextResponse.json(
      { success: true },
      { status: 200, headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[DocumentReviewAPI] Unhandled error:", errorMsg);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
