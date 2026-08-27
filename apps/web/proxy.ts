import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { checkRateLimitAsync, getClientIp, RATE_LIMIT_PROFILES } from "@/lib/security/rate-limiter";

const activeProtectedRoutes = [
  "/machines",
  "/operations",
  "/users",
];

const deprecatedRoutes = [
  "/dashboard",
  "/clients",
  "/crm",
  "/inventory",
  "/finance",
  "/hr",
  "/tasks",
  "/documents",
  "/challans",
  "/purchase-orders",
  "/rentals",
  "/reports",
  "/vendors",
  "/administration",
  "/branches",
  "/complaints",
  "/services",
  "/service",
  "/notifications",
  "/notification",
  "/audit-logs",
  "/my-work",
  "/docs",
  "/settings",
];

const publicRoutes = ["/login", "/forgot-password", "/signup"];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtectedRoute =
    activeProtectedRoutes.some((route) => path.startsWith(route)) ||
    deprecatedRoutes.some((route) => path.startsWith(route));
  const isDeprecatedRoute = deprecatedRoutes.some((route) => path.startsWith(route));
  const isPublicRoute = publicRoutes.some((route) => path.startsWith(route));

  // Step 1: LPDoS Edge Rate Limiting Guard
  const clientIp = getClientIp(request);
  const isAuthRoute = isPublicRoute || path.startsWith("/api/auth");
  const rateLimitProfile = isAuthRoute 
    ? RATE_LIMIT_PROFILES.AUTH_STRICT 
    : request.method === "POST" 
      ? RATE_LIMIT_PROFILES.MUTATION_API 
      : RATE_LIMIT_PROFILES.GENERAL_ROUTES;

  const rateLimitResult = await checkRateLimitAsync(`${clientIp}:${isAuthRoute ? 'auth' : 'gen'}`, rateLimitProfile);
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

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
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
  // getSession() only decodes the JWT locally without server-side verification.
  let authenticatedUser = null;
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (!userError && user) {
      authenticatedUser = user;
    }
  } catch (err: any) {
    if (err?.status === 429 || err?.code === "over_request_rate_limit" || err?.name === "AuthApiError") {
      console.warn("[Auth Proxy] Supabase auth rate limit reached (429). Continuing with request processing.");
    } else {
      console.error("[Auth Proxy] Error verifying user:", err);
    }
  }

  // Redirect unauthenticated user accessing protected or deprecated route to /login
  if (isProtectedRoute && !authenticatedUser) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  // Redirect authenticated user visiting public route (/login, /signup) to /machines
  if (isPublicRoute && authenticatedUser) {
    return NextResponse.redirect(new URL("/machines", request.nextUrl));
  }

  // Redirect authenticated user visiting deprecated routes or root '/' to /machines
  if ((isDeprecatedRoute || path === "/") && authenticatedUser) {
    return NextResponse.redirect(new URL("/machines", request.nextUrl));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
  ],
};
