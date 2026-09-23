import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseUrl, getSupabasePublishableKey } from "@/lib/env";
import { checkRateLimitAsync, getClientIp, RATE_LIMIT_PROFILES } from "@/lib/security/rate-limiter";
import { signInternalUser } from "@/lib/security/internal-auth-token";
import {
  isProtectedRoute as checkProtectedRoute,
  isDeprecatedRoute as checkDeprecatedRoute,
  isAuthRoute as checkAuthRoute,
  isPublicLegalRoute as checkPublicLegalRoute,
  getRoleHomeRoute,
} from "@reachinternational/permissions";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtectedRoute = checkProtectedRoute(path);
  const isDeprecatedRoute = checkDeprecatedRoute(path);
  const isAuthRoute = checkAuthRoute(path);
  const isPublicLegal = checkPublicLegalRoute(path);
  const isPublicRoute = isAuthRoute || isPublicLegal;


  // Step 1: LPDoS Edge Rate Limiting Guard
  const clientIp = getClientIp(request);
  const isAuthMutation = (path.startsWith("/api/auth") || isPublicRoute) && request.method !== "GET";
  const rateLimitProfile = isAuthMutation 
    ? RATE_LIMIT_PROFILES.AUTH_STRICT 
    : request.method === "POST" 
      ? RATE_LIMIT_PROFILES.MUTATION_API 
      : RATE_LIMIT_PROFILES.GENERAL_ROUTES;

  const rateLimitResult = await checkRateLimitAsync(`${clientIp}:${isAuthMutation ? 'auth' : 'gen'}`, rateLimitProfile);
  if (!rateLimitResult.success) {
    return new NextResponse(
      JSON.stringify({
        error: "Too Many Requests",
        message: "Request rate limit exceeded. LPDoS / Brute-force safeguard active.",
        retryAfter: rateLimitResult.resetSeconds,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rateLimitResult.resetSeconds),
          "X-RateLimit-Limit": String(rateLimitResult.limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-internal-user-id");
  requestHeaders.delete("x-internal-user-email");
  requestHeaders.delete("x-internal-user-sig");

  let response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // SECURITY: Use getUser() instead of getSession() — getUser() validates the JWT
  // against the Supabase Auth server, preventing forged/tampered JWT cookie attacks.
  // Wrapped in a 5000ms timeout guard to prevent network hangs from stalling proxy requests.
  let authenticatedUser = null;
  try {
    const getUserWithTimeout = Promise.race([
      supabase.auth.getUser(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Auth verification timeout")), 5000)
      ),
    ]);

    const { data: { user }, error: userError } = await getUserWithTimeout;
    if (!userError && user) {
      authenticatedUser = user;
    }
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number; code?: string; name?: string };
    if (error?.message === "Auth verification timeout") {
      console.warn("[Auth Proxy] Supabase auth getUser timed out after 5000ms. Proceeding without active session.");
    } else if (error?.status === 429 || error?.code === "over_request_rate_limit" || error?.name === "AuthApiError") {
      console.warn("[Auth Proxy] Supabase auth rate limit reached (429). Continuing with request processing.");
    } else {
      console.error("[Auth Proxy] Error verifying user:", err);
    }
  }

  // Inject cryptographically signed edge-verified user credentials into downstream request headers
  // to avoid redundant auth roundtrips in downstream Server Components (lib/dal.ts verifySession)
  if (authenticatedUser) {
    try {
      const authSig = await signInternalUser(authenticatedUser.id, authenticatedUser.email || "");
      requestHeaders.set("x-internal-user-id", authenticatedUser.id);
      requestHeaders.set("x-internal-user-email", authenticatedUser.email || "");
      requestHeaders.set("x-internal-user-sig", authSig);

      const existingCookies = response.cookies.getAll();
      response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
      existingCookies.forEach((c) => response.cookies.set(c));
    } catch (sigErr) {
      console.error("[Auth Proxy] Error signing internal auth headers:", sigErr);
    }
  }

  // React Server Actions (requests carrying 'next-action' header) handle their own redirects,
  // mutations, and authorization in App Router. Intercepting a Server Action with an HTTP 30x redirect
  // causes Next.js React DOM action dispatcher to crash with "An unexpected response was received from the server."
  const isServerAction = Boolean(request.headers.get("next-action"));
  if (isServerAction) {
    return response;
  }

  // Helper to preserve response cookies (session tokens refreshed by Supabase Auth) on redirects
  const createRedirectResponse = (targetPath: string) => {
    const redirectRes = NextResponse.redirect(new URL(targetPath, request.nextUrl));
    response.cookies.getAll().forEach((c) => {
      redirectRes.cookies.set(c.name, c.value, c);
    });
    return redirectRes;
  };

  // Redirect legacy /hr visits directly to /payroll (preserving query params like month, removing obsolete tab=payroll)
  if (path === "/hr" || path.startsWith("/hr/")) {
    const targetUrl = new URL(request.nextUrl);
    targetUrl.pathname = targetUrl.pathname.replace(/^\/hr(\/|$)/, "/payroll$1");
    targetUrl.searchParams.delete("tab");
    return createRedirectResponse(targetUrl.pathname + (targetUrl.search || ""));
  }

  // Normalize /payroll by stripping obsolete ?tab= parameter (e.g., from old bookmarks or next.config redirect preservation)
  if (path === "/payroll" && request.nextUrl.searchParams.has("tab")) {
    const targetUrl = new URL(request.nextUrl);
    targetUrl.searchParams.delete("tab");
    return createRedirectResponse(targetUrl.pathname + (targetUrl.search || ""));
  }

  // Normalize /operations by stripping obsolete ?tab=logs / ?tab=entry parameter
  if (path === "/operations" && (request.nextUrl.searchParams.get("tab") === "logs" || request.nextUrl.searchParams.get("tab") === "entry")) {
    const targetUrl = new URL(request.nextUrl);
    targetUrl.searchParams.delete("tab");
    return createRedirectResponse(targetUrl.pathname + (targetUrl.search || ""));
  }

  // Normalize /machines by stripping obsolete ?tab= parameter
  if (path === "/machines" && request.nextUrl.searchParams.has("tab")) {
    const targetUrl = new URL(request.nextUrl);
    targetUrl.searchParams.delete("tab");
    return createRedirectResponse(targetUrl.pathname + (targetUrl.search || ""));
  }

  // Normalize /clients by stripping obsolete ?tab= parameter
  if (path === "/clients" && request.nextUrl.searchParams.has("tab")) {
    const targetUrl = new URL(request.nextUrl);
    targetUrl.searchParams.delete("tab");
    return createRedirectResponse(targetUrl.pathname + (targetUrl.search || ""));
  }

  // Redirect unauthenticated user accessing protected or deprecated route to /login
  if (isProtectedRoute && !authenticatedUser) {
    return createRedirectResponse("/login");
  }

  // Check if request to public route carries an error/message parameter
  const hasAuthErrorParam =
    request.nextUrl.searchParams.has("error") ||
    request.nextUrl.searchParams.has("message") ||
    request.nextUrl.searchParams.has("reason") ||
    request.nextUrl.searchParams.has("status");

  const isRecoveryFlow =
    request.nextUrl.searchParams.get("type") === "recovery" ||
    request.nextUrl.searchParams.has("code") ||
    request.nextUrl.searchParams.has("token_hash") ||
    request.nextUrl.searchParams.has("reset") ||
    path.startsWith("/reset-password");

  // Intercept recovery code/token_hash arriving at /reset-password or /login
  // and route through /api/auth/callback for server-side PKCE code exchange
  if (
    (path === "/reset-password" || path === "/login") &&
    (request.nextUrl.searchParams.has("code") || request.nextUrl.searchParams.has("token_hash"))
  ) {
    const callbackUrl = new URL("/api/auth/callback", request.nextUrl);
    request.nextUrl.searchParams.forEach((val, key) => {
      callbackUrl.searchParams.set(key, val);
    });
    if (!callbackUrl.searchParams.has("next")) {
      callbackUrl.searchParams.set("next", "/reset-password");
    }
    return createRedirectResponse(callbackUrl.pathname + callbackUrl.search);
  }

  // Resolve authenticated user's configured Home route from centralized configuration
  const roleHome = getRoleHomeRoute(authenticatedUser?.user_metadata?.role);

  // Redirect authenticated user visiting auth entry routes (/login, /signup, /forgot-password, /reset-password) to role Home
  // UNLESS they arrived with an error/status parameter or are in an active recovery flow.
  // Public legal routes (/privacy, /terms, /account-deletion) remain accessible to both authenticated and guest users.
  if (isAuthRoute && authenticatedUser && !hasAuthErrorParam && !isRecoveryFlow) {
    return createRedirectResponse(roleHome);
  }

  // Redirect authenticated user visiting deprecated routes or root '/' to role Home
  if ((isDeprecatedRoute || path === "/") && authenticatedUser) {
    return createRedirectResponse(roleHome);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|\\.well-known/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
  ],
};
