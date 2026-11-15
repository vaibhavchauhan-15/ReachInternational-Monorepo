import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkRateLimitAsync } from "@/lib/security/rate-limiter";
import { DOC_UPLOAD, isDocType, DOCUMENT_ERROR_MESSAGES } from "@reachinternational/utils";
import crypto from "node:crypto";

const RATE_LIMIT_REPLACE = {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10,           // 10 per hour per user
};

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

    // Verify user is active
    const { data: userProfile, error: profileErr } = await adminSupabase
      .from("users")
      .select("status")
      .eq("id", user.id)
      .maybeSingle();

    if (profileErr || !userProfile || userProfile.status !== "active") {
      return NextResponse.json(
        { error: "Only active user accounts can request document replacements." },
        { status: 403 }
      );
    }

    // Rate limit: 10 per hour per user
    const rateLimitResult = await checkRateLimitAsync(
      `${user.id}:replace_upload_url`,
      RATE_LIMIT_REPLACE
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          error: "Too Many Requests",
          message: "Replacement upload limit reached. Maximum 10 requests per hour.",
          retryAfter: rateLimitResult.resetSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimitResult.resetSeconds),
          },
        }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const { docType } = body as { docType?: unknown };

    if (!isDocType(docType)) {
      return NextResponse.json(
        { error: DOCUMENT_ERROR_MESSAGES.INVALID_DOC_TYPE },
        { status: 400 }
      );
    }

    // Generate staging upload paths
    const uploadId = crypto.randomUUID();
    const mainStagingPath = `replace/${user.id}/${docType}/${uploadId}.jpg`;
    const thumbStagingPath = `replace/${user.id}/${docType}/${uploadId}_thumb.jpg`;

    const [mainResult, thumbResult] = await Promise.all([
      adminSupabase.storage
        .from("doc_staging")
        .createSignedUploadUrl(mainStagingPath, { upsert: true }),
      adminSupabase.storage
        .from("doc_staging")
        .createSignedUploadUrl(thumbStagingPath, { upsert: true }),
    ]);

    if (mainResult.error || !mainResult.data) {
      console.error("[ReplacementUploadUrl] Main file sign error:", mainResult.error);
      return NextResponse.json(
        { error: "Failed to generate main document upload URL." },
        { status: 500 }
      );
    }

    if (thumbResult.error || !thumbResult.data) {
      console.error("[ReplacementUploadUrl] Thumbnail sign error:", thumbResult.error);
      return NextResponse.json(
        { error: "Failed to generate thumbnail upload URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      uploadId,
      docType,
      main: {
        path: mainStagingPath,
        token: mainResult.data.token,
        signedUrl: mainResult.data.signedUrl,
      },
      thumb: {
        path: thumbStagingPath,
        token: thumbResult.data.token,
        signedUrl: thumbResult.data.signedUrl,
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[ReplacementUploadUrl] Fatal error:", errorMsg);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
