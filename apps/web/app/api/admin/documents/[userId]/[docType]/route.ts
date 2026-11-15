import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkRateLimitAsync, getClientIp } from "@/lib/security/rate-limiter";
import { verifyDocumentViewerAuthorization } from "@/lib/server/admin-documents";
import { isDocType, DOCUMENT_ERROR_MESSAGES, type DocType } from "@reachinternational/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const RATE_LIMIT_ADMIN_DOC_FULL = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60,     // 60 requests per minute
};

/**
 * GET /api/admin/documents/[userId]/[docType]
 * 
 * Returns a 60s pre-signed URL for the full-resolution document image.
 * 
 * Rules:
 * - Authenticate via Bearer token (Native mobile) or Supabase Cookie session (Web).
 * - Enforces access matrix via canViewDocument & team verification.
 * - Rate limit: 60 req/min per viewer.
 * - Issues 60s signed URL directly from Supabase Storage user_files.
 * - Logs one audit_logs row (document.view, kind: full). Never logs signed URLs.
 * - Response headers: Cache-Control: no-store.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string; docType: string }> }
) {
  try {
    const { userId, docType } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: "Missing userId parameter" },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    if (!isDocType(docType)) {
      return NextResponse.json(
        { error: DOCUMENT_ERROR_MESSAGES.INVALID_DOC_TYPE },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const adminSupabase = createSupabaseAdminClient();
    let authUser: { id: string } | null = null;

    // 1. Dual authentication: Bearer token or Cookie
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
        // Fallback below
      }
    }

    if (!authUser) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    // 2. Load viewer profile & role
    const { data: viewerProfile, error: profileErr } = await adminSupabase
      .from("users")
      .select("id, role, status")
      .eq("id", authUser.id)
      .maybeSingle();

    if (profileErr || !viewerProfile) {
      return NextResponse.json(
        { error: "Viewer profile not found" },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    // 3. Rate Limit: 60 req/min per viewer
    const rateLimit = await checkRateLimitAsync(
      `${viewerProfile.id}:admin_docs_full`,
      RATE_LIMIT_ADMIN_DOC_FULL
    );

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: "Too Many Requests",
          message: "Document preview request limit exceeded. Maximum 60 requests per minute.",
        },
        {
          status: 429,
          headers: {
            ...NO_CACHE_HEADERS,
            "Retry-After": String(rateLimit.resetSeconds),
          },
        }
      );
    }

    // 4. Verify Authorization
    const { authorized } = await verifyDocumentViewerAuthorization(
      adminSupabase,
      { id: viewerProfile.id, role: viewerProfile.role },
      userId,
      docType
    );

    if (!authorized) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to view this document." },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    // 5. Query user_documents record
    const { data: doc, error: docErr } = await adminSupabase
      .from("user_documents")
      .select("id, user_id, document_type_code, storage_path, mime_type, file_size_bytes")
      .eq("user_id", userId)
      .eq("document_type_code", docType)
      .maybeSingle();

    if (docErr) {
      console.error("[AdminDocumentFull] Error querying document:", docErr);
      return NextResponse.json(
        { error: "Database error querying document." },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    if (!doc || !doc.storage_path) {
      return NextResponse.json(
        { error: DOCUMENT_ERROR_MESSAGES.DOCUMENT_NOT_FOUND },
        { status: 404, headers: NO_CACHE_HEADERS }
      );
    }

    // 6. Generate 60s pre-signed URL from user_files bucket
    const { data: signedData, error: storageErr } = await adminSupabase.storage
      .from("user_files")
      .createSignedUrl(doc.storage_path, 60);

    if (storageErr || !signedData?.signedUrl) {
      console.error("[AdminDocumentFull] Storage signed URL error:", storageErr);
      return NextResponse.json(
        { error: "Failed to generate document signed URL." },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    // 7. Write ONE audit_logs row (Never log signed URL)
    const clientIp = getClientIp(req);
    await adminSupabase.from("audit_logs").insert({
      user_id: viewerProfile.id,
      action: "document.view",
      entity_type: "user_documents",
      entity_id: doc.id,
      target_user_id: userId,
      ip_address: clientIp,
      metadata: {
        kind: "full",
        target_user_id: userId,
        document_id: doc.id,
        document_type: docType,
        viewer_role: viewerProfile.role,
      },
    });

    return NextResponse.json(
      {
        success: true,
        docType: docType as DocType,
        signedUrl: signedData.signedUrl,
        expiresIn: 60,
      },
      {
        status: 200,
        headers: NO_CACHE_HEADERS,
      }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[AdminDocumentFull] Fatal error:", errorMsg);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
