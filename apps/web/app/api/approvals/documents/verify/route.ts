import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import {
  authenticateApprovalsRequest,
  NO_CACHE_HEADERS,
} from "@/lib/server/approvals-auth";
import { verifyUserDocumentCore } from "@/lib/server/document-review";
import { canVerifyDocument } from "@reachinternational/permissions";
import { TAGS } from "@/lib/cache/tags";

export const dynamic = "force-dynamic";

/**
 * POST /api/approvals/documents/verify
 * Fast, atomic document verification endpoint for Web and Mobile.
 * Dual authentication: Cookie session (Web) or Bearer token (Mobile).
 * Restricted to super_admin, admin, or hr.
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

    if (!canVerifyDocument({ id: auth.user.id, role: auth.user.role })) {
      return NextResponse.json(
        { error: "Forbidden: Only HR and Admins can verify documents." },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const documentId = typeof body.documentId === "string" ? body.documentId : typeof body.document_id === "string" ? body.document_id : "";

    if (!documentId) {
      return NextResponse.json(
        { error: "Missing documentId parameter." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const result = await verifyUserDocumentCore({
      reviewerId: auth.user.id,
      documentId,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to verify document." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    // ⚡ Asynchronous cache tag revalidation — non-blocking
    try {
      revalidateTag(TAGS.users, "max");
      revalidateTag(TAGS.documents, "max");
      revalidateTag(TAGS.approvals, "max");
      revalidateTag(TAGS.approvalsList, "max");
      revalidateTag(TAGS.approvalsCounts, "max");
    } catch {
      // Non-blocking in Route Handler
    }

    return NextResponse.json({ success: true, status: "verified" }, { headers: NO_CACHE_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
