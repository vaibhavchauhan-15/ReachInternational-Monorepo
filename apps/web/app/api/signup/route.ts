import { NextResponse, type NextRequest } from "next/server";
import { registerNewUserServer } from "@/lib/server/signup-user";
import { getClientIp } from "@/lib/security/rate-limiter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/signup
 * 
 * Enterprise-grade registration endpoint for Native Mobile & API clients.
 * - Prevents 429 over_email_send_rate_limit by using adminSupabase.auth.admin.createUser with email_confirm: true
 * - Validates all fields completely; returns exact fieldErrors on validation failure before touching database
 * - Validates uniqueness of email, phone, Aadhaar, and licence
 * - Moves staged documents to user_files and creates registration approval request
 */
export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid JSON request payload.", fieldErrors: {} },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid request body.", fieldErrors: {} },
        { status: 400 }
      );
    }

    const stagingSessionToken = body.stagingSessionToken || body.session || "";

    const result = await registerNewUserServer({
      ...body,
      stagingSessionToken,
      clientIp,
    });

    return NextResponse.json(result, { status: result.status || (result.success ? 201 : 400) });
  } catch (err: any) {
    console.error("[POST /api/signup] Unhandled exception:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error during registration. Please try again later.",
      },
      { status: 500 }
    );
  }
}
