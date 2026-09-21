import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabasePublishableKey } from "@/lib/env";

/**
 * /api/auth/callback — Server-side Auth code & OTP token exchange.
 *
 * Supabase recovery & auth emails redirect here with ?code=xxx&next=/reset-password
 * or ?token_hash=xxx&type=recovery&next=/reset-password.
 *
 * The PKCE verifier lives in an HttpOnly cookie that only the server can read,
 * so the exchange MUST happen server-side — not in a "use client" component.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") || "/dashboard";

  // If Supabase forwarded an error directly (e.g. expired link on Supabase server)
  const incomingError = searchParams.get("error");
  if (incomingError) {
    const errorUrl = new URL(next, request.nextUrl.origin);
    errorUrl.searchParams.set("error", incomingError);
    const errorDesc = searchParams.get("error_description");
    if (errorDesc) {
      errorUrl.searchParams.set("error_description", errorDesc);
    }
    return NextResponse.redirect(errorUrl);
  }

  // Ensure either code or token_hash is present
  if (!code && !tokenHash) {
    const errorUrl = new URL(next, request.nextUrl.origin);
    errorUrl.searchParams.set("error", "missing_code");
    errorUrl.searchParams.set(
      "error_description",
      "No authorization code or recovery token found in reset link."
    );
    return NextResponse.redirect(errorUrl);
  }

  const response = NextResponse.redirect(
    new URL(next, request.nextUrl.origin)
  );

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  let exchangeError = null;

  if (code) {
    // PKCE Flow
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    exchangeError = error;
  } else if (tokenHash && type) {
    // OTP / Token Hash Flow
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    exchangeError = error;
  }

  if (exchangeError) {
    const errorUrl = new URL(next, request.nextUrl.origin);
    errorUrl.searchParams.set("error", "invalid_code");
    errorUrl.searchParams.set("error_description", exchangeError.message);
    return NextResponse.redirect(errorUrl);
  }

  return response;
}
