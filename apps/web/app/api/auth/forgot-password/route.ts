import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getResetPasswordRedirectUrl } from "@/lib/env";

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

    // 1. Verify if the account exists in Supabase (public.users)
    const adminSupabase = createSupabaseAdminClient();
    const { data: existingUser, error: lookupError } = await adminSupabase
      .from("users")
      .select("id, email, status")
      .ilike("email", emailLower)
      .maybeSingle();

    if (lookupError) {
      console.error("Database error in /api/auth/forgot-password lookup:", lookupError);
    }

    if (!existingUser) {
      return NextResponse.json(
        {
          success: false,
          error: "No account found with this email address. Please check your email or request access.",
        },
        { status: 404 }
      );
    }

    // 2. Verify user is approved by admin (status must be 'active')
    if (existingUser.status === "pending") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your account is pending administrator approval. You cannot reset your password until your account has been approved.",
        },
        { status: 403 }
      );
    }

    if (existingUser.status === "inactive") {
      return NextResponse.json(
        {
          success: false,
          error: "Your account has been deactivated. Please contact your administrator.",
        },
        { status: 403 }
      );
    }

    if (existingUser.status !== "active") {
      return NextResponse.json(
        {
          success: false,
          error: "Your account is not active. Please contact your administrator.",
        },
        { status: 403 }
      );
    }

    // 3. User is approved and active: send the password reset email via Supabase Auth
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
      console.error("Supabase resetPasswordForEmail error in API route:", resetError);
      return NextResponse.json(
        {
          success: false,
          error: resetError.message || "Failed to send reset email. Please try again.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        "Password reset link has been sent to your email. Please check your inbox and click the link to set your new password.",
    });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error("Exception in /api/auth/forgot-password:", err);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "An unexpected error occurred. Please try again.",
      },
      { status: 500 }
    );
  }
}
