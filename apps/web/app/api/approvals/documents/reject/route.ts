import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import {
  authenticateApprovalsRequest,
  NO_CACHE_HEADERS,
} from "@/lib/server/approvals-auth";
import { rejectUserDocumentCore } from "@/lib/server/document-review";
import { canRejectDocument } from "@reachinternational/permissions";
import { TAGS } from "@/lib/cache/tags";

export const dynamic = "force-dynamic";

/**
 * POST /api/approvals/documents/reject
 * Fast, atomic document rejection endpoint for Web and Mobile.
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

    if (!canRejectDocument({ id: auth.user.id, role: auth.user.role })) {
      return NextResponse.json(
        { error: "Forbidden: Only HR and Admins can reject documents." },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const documentId = typeof body.documentId === "string" ? body.documentId : typeof body.document_id === "string" ? body.document_id : "";
    const rejectionReason = typeof body.rejectionReason === "string" ? body.rejectionReason : typeof body.rejection_reason === "string" ? body.rejection_reason : typeof body.note === "string" ? body.note : "";

    if (!documentId) {
      return NextResponse.json(
        { error: "Missing documentId parameter." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    if (!rejectionReason.trim()) {
      return NextResponse.json(
        { error: "A rejection reason is required." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const result = await rejectUserDocumentCore({
      reviewerId: auth.user.id,
      documentId,
      rejectionReason: rejectionReason.trim(),
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to reject document." },
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

    return NextResponse.json({ success: true, status: "rejected" }, { headers: NO_CACHE_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
