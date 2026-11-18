import { NextResponse, type NextRequest } from "next/server";
import { registerNewUserServer } from "@/lib/server/signup-user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/signup/register
 *
 * Enterprise-grade registration endpoint for Native Mobile & API clients.
 * Delegates to registerNewUserServer for pre-flight validation, rate-limiting,
 * duplicate checks, magic-bytes verification, admin user creation with zero
 * email confirmation (bypassing GoTrue 429 over_email_send_rate_limit),
 * document finalization, and registration approval dispatch.
 */
export async function POST(request: NextRequest) {
  try {
    const forwarded = request.headers.get("x-forwarded-for");
    const realIp = request.headers.get("x-real-ip");
    const clientIp = forwarded ? forwarded.split(",")[0].trim() : (realIp || "127.0.0.1");

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

    const httpStatus = result.status || (result.success ? 201 : 400);
    return NextResponse.json(result, { status: httpStatus });
  } catch (err: any) {
    console.error("[POST /api/signup/register] Unhandled exception:", err);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error during registration. Please try again later.",
        fieldErrors: {},
      },
      { status: 500 }
    );
  }
}
