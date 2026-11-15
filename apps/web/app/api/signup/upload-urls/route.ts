import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  checkRateLimitAsync,
  getClientIp,
  RATE_LIMIT_PROFILES,
} from "@/lib/security/rate-limiter";
import {
  createUploadSessionToken,
  verifyUploadSessionToken,
} from "@/lib/security/upload-session";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { SignupUploadUrlRequestSchema } from "@reachinternational/validation";
import { DOCUMENT_ERROR_MESSAGES, stagingPath, type DocType } from "@reachinternational/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/signup/upload-urls
 * 
 * Issues pre-signed upload URLs for background staging direct to Supabase Storage.
 * Zero-byte-pass-through architecture: Vercel server NEVER processes binary file bytes.
 * 
 * Body: { session?: string, docType: DocType, turnstileToken?: string }
 * Response: { session, main: { path, token, signedUrl }, thumb: { path, token, signedUrl } }
 */
export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);

    // 1. General Rate Limiting Guard: 30 requests per 10 minutes per IP
    const uploadRateLimit = await checkRateLimitAsync(
      `signup-upload:${clientIp}`,
      RATE_LIMIT_PROFILES.SIGNUP_UPLOAD
    );

    if (!uploadRateLimit.success) {
      return NextResponse.json(
        {
          error: "Too Many Requests",
          message: "Too many upload requests. Please wait a few moments before trying again.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(uploadRateLimit.resetSeconds),
            "X-RateLimit-Limit": String(uploadRateLimit.limit),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }

    // 2. Parse & Validate Inbound JSON Payload
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid JSON request payload." },
        { status: 400 }
      );
    }

    const parseResult = SignupUploadUrlRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const issue = parseResult.error.issues[0];
      return NextResponse.json(
        {
          error: "Bad Request",
          message: issue?.message || DOCUMENT_ERROR_MESSAGES.INVALID_DOC_TYPE,
        },
        { status: 400 }
      );
    }

    const { session, docType, turnstileToken } = parseResult.data;

    let stagingUuid: string;
    let sessionToken: string;

    if (session) {
      // 3a. Verify existing staging session token
      const verifyRes = verifyUploadSessionToken(session);
      if (!verifyRes.valid) {
        return NextResponse.json(
          {
            error: "Invalid Session",
            message: verifyRes.error || DOCUMENT_ERROR_MESSAGES.STAGING_SESSION_EXPIRED,
          },
          { status: 400 }
        );
      }
      stagingUuid = verifyRes.uuid;
      sessionToken = session;
    } else {
      // 3b. First call of a session: Cap sessions per IP (10/hr) + optional Turnstile abuse check
      const sessionRateLimit = await checkRateLimitAsync(
        `signup-session:${clientIp}`,
        RATE_LIMIT_PROFILES.SIGNUP_SESSION
      );

      if (!sessionRateLimit.success) {
        return NextResponse.json(
          {
            error: "Too Many Requests",
            message: "Too many registration sessions started from your network. Please try again later.",
          },
          {
            status: 429,
            headers: {
              "Retry-After": String(sessionRateLimit.resetSeconds),
            },
          }
        );
      }

      // Optional abuse control: Cloudflare Turnstile verification
      const turnstileOutcome = await verifyTurnstileToken(turnstileToken, clientIp);
      if (!turnstileOutcome.success) {
        return NextResponse.json(
          {
            error: "Verification Failed",
            message: turnstileOutcome.error || "Abuse protection verification failed.",
          },
          { status: 403 }
        );
      }

      // Generate a new tamper-proof signed session token (2-hour TTL)
      sessionToken = createUploadSessionToken();
      const verifiedNew = verifyUploadSessionToken(sessionToken);
      if (!verifiedNew.valid) {
        return NextResponse.json(
          { error: "Internal Error", message: "Failed to initialize staging session." },
          { status: 500 }
        );
      }
      stagingUuid = verifiedNew.uuid;
    }

    // 4. Construct staging paths: signup/<uuid>/<docType>.jpg and .../<docType>_thumb.jpg
    const mainPath = stagingPath(`signup/${stagingUuid}`, docType as DocType, false);
    const thumbPath = stagingPath(`signup/${stagingUuid}`, docType as DocType, true);

    // 5. Generate signed upload URLs via Supabase Service Role on doc_staging
    const supabase = createSupabaseAdminClient();

    const [mainResult, thumbResult] = await Promise.all([
      supabase.storage.from("doc_staging").createSignedUploadUrl(mainPath, { upsert: true }),
      supabase.storage.from("doc_staging").createSignedUploadUrl(thumbPath, { upsert: true }),
    ]);

    if (mainResult.error || !mainResult.data) {
      console.error("[SignupUploadUrls] Main signed upload URL error:", mainResult.error);
      return NextResponse.json(
        {
          error: "Storage Error",
          message: "Failed to generate pre-signed upload URL for document.",
        },
        { status: 500 }
      );
    }

    if (thumbResult.error || !thumbResult.data) {
      console.error("[SignupUploadUrls] Thumbnail signed upload URL error:", thumbResult.error);
      return NextResponse.json(
        {
          error: "Storage Error",
          message: "Failed to generate pre-signed upload URL for thumbnail.",
        },
        { status: 500 }
      );
    }

    // 6. Return response to device (< 1 KB JSON payload)
    return NextResponse.json({
      session: sessionToken,
      main: {
        path: mainResult.data.path,
        token: mainResult.data.token,
        signedUrl: mainResult.data.signedUrl,
      },
      thumb: {
        path: thumbResult.data.path,
        token: thumbResult.data.token,
        signedUrl: thumbResult.data.signedUrl,
      },
    });
  } catch (err) {
    console.error("[SignupUploadUrls] Unhandled endpoint error:", err);
    return NextResponse.json(
      {
        error: "Internal Error",
        message: "An unexpected error occurred while preparing document upload.",
      },
      { status: 500 }
    );
  }
}
