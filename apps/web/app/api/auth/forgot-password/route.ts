import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getResetPasswordRedirectUrl } from "@/lib/env/client";

const GENERIC_RESET_SUCCESS_MESSAGE =
  "If an active account exists for this email address, password reset instructions have been sent. Please check your inbox.";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim() : "";

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Email address is required." },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailLower)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }

    // 1. Lookup account in Supabase (public.users)
    const adminSupabase = createSupabaseAdminClient();
    const { data: existingUser, error: lookupError } = await adminSupabase
      .from("users")
      .select("id, email, status")
      .ilike("email", emailLower)
      .maybeSingle();

    if (lookupError) {
      console.error("[ForgotPassword] Database error in account lookup:", lookupError.message);
    }

    // 2. User Enumeration Defense: If user does not exist or is not active, return generic success
    if (!existingUser || existingUser.status !== "active") {
      return NextResponse.json({
        success: true,
        message: GENERIC_RESET_SUCCESS_MESSAGE,
      });
    }

    // 3. User is approved and active: send password reset email via Supabase Auth
    const supabase = await createSupabaseServerClient();
    const referer = request.headers.get("referer");
    const origin =
      request.headers.get("origin") ||
      (referer ? new URL(referer).origin : null) ||
      request.nextUrl.origin;
    const resetRedirectUrl = getResetPasswordRedirectUrl(origin);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      existingUser.email || emailLower,
      {
        redirectTo: resetRedirectUrl,
      }
    );

    if (resetError) {
      console.error("[ForgotPassword] Supabase resetPasswordForEmail error:", resetError.message);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to send reset email. Please try again shortly.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: GENERIC_RESET_SUCCESS_MESSAGE,
    });
  } catch (err: unknown) {
    console.error("[ForgotPassword] Unexpected exception in /api/auth/forgot-password:", err);
    return NextResponse.json(
      {
        success: false,
        error: "An unexpected error occurred. Please try again.",
      },
      { status: 500 }
    );
  }
}
