import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkRateLimitAsync, getClientIp } from "@/lib/security/rate-limiter";
import { verifyDocumentViewerAuthorization } from "@/lib/server/admin-documents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

const RATE_LIMIT_ADMIN_DOCS = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60,     // 60 requests per minute
};

/**
 * GET /api/admin/documents/[userId]
 * 
 * Returns document metadata plus 60s pre-signed URLs for thumbnails in ONE batch call.
 * 
 * Rules:
 * - Authenticate via Bearer token (Native mobile) or Supabase Cookie session (Web).
 * - Enforces access matrix via canViewDocument & team verification.
 * - Rate limit: 60 req/min per viewer.
 * - Batch generates 60s thumbnail signed URLs via createSignedUrls.
 * - Logs one audit_logs row (document.view, kind: thumb). Never logs signed URLs.
 * - Response headers: Cache-Control: no-store.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    if (!userId) {
      return NextResponse.json({ error: "Missing userId parameter" }, { status: 400 });
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
      `${viewerProfile.id}:admin_docs_list`,
      RATE_LIMIT_ADMIN_DOCS
    );

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: "Too Many Requests",
          message: "Document list request limit exceeded. Maximum 60 requests per minute.",
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
    const { authorized, restrictedToLicense } = await verifyDocumentViewerAuthorization(
      adminSupabase,
      { id: viewerProfile.id, role: viewerProfile.role },
      userId
    );

    if (!authorized) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to view this user's documents." },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    // 5. Query user_documents
    let docsQuery = adminSupabase
      .from("user_documents")
      .select(
        "id, user_id, document_type_code, storage_path, thumb_path, mime_type, file_size_bytes, verification_status, verified_by, verified_at, rejection_reason, created_at, updated_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (restrictedToLicense) {
      docsQuery = docsQuery.eq("document_type_code", "driving_license");
    }

    const { data: rawDocs, error: docsErr } = await docsQuery;
    if (docsErr) {
      console.error("[AdminDocuments] Error fetching user_documents:", docsErr);
      return NextResponse.json(
        { error: "Failed to query user documents." },
        { status: 500, headers: NO_CACHE_HEADERS }
      );
    }

    const docs = rawDocs || [];

    // Query pending change requests
    let dcrQuery = adminSupabase
      .from("document_change_requests")
      .select("id, user_id, document_type_code, staging_path, staging_thumb_path, status, created_at")
      .eq("user_id", userId)
      .eq("status", "pending");

    if (restrictedToLicense) {
      dcrQuery = dcrQuery.eq("document_type_code", "driving_license");
    }

    const { data: pendingRequests } = await dcrQuery;

    // 6. Batch generate 60s signed URLs for thumbnails in ONE single call
    const thumbPaths: string[] = [];
    const pathToDocIndex = new Map<string, number>();

    docs.forEach((doc, idx) => {
      const path = doc.thumb_path || doc.storage_path;
      if (path) {
        thumbPaths.push(path);
        pathToDocIndex.set(path, idx);
      }
    });

    const docsWithUrls = docs.map((d) => ({
      ...d,
      thumb_signed_url: null as string | null,
    }));

    if (thumbPaths.length > 0) {
      const { data: signedResults, error: signErr } = await adminSupabase.storage
        .from("user_files")
        .createSignedUrls(thumbPaths, 60);

      if (!signErr && Array.isArray(signedResults)) {
        for (const item of signedResults) {
          if (item?.path && item.signedUrl && !item.error) {
            const idx = pathToDocIndex.get(item.path);
            if (idx !== undefined && docsWithUrls[idx]) {
              docsWithUrls[idx].thumb_signed_url = item.signedUrl;
            }
          }
        }
      }
    }

    // 7. Write ONE audit_logs row (Never log signed URLs)
    const clientIp = getClientIp(req);
    await adminSupabase.from("audit_logs").insert({
      user_id: viewerProfile.id,
      action: "document.view",
      entity_type: "user_documents",
      entity_id: userId,
      target_user_id: userId,
      ip_address: clientIp,
      metadata: {
        kind: "thumb",
        target_user_id: userId,
        document_count: docs.length,
        document_types: docs.map((d) => d.document_type_code),
        viewer_role: viewerProfile.role,
      },
    });

    return NextResponse.json(
      {
        success: true,
        userId,
        documents: docsWithUrls,
        pendingChangeRequests: pendingRequests || [],
      },
      {
        status: 200,
        headers: NO_CACHE_HEADERS,
      }
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[AdminDocuments] Fatal error:", errorMsg);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
