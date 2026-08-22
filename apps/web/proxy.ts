import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const protectedRoutes = [
  "/dashboard",
  "/machines",
  "/services",
  "/notifications",
  "/users",
  "/audit-logs",
  "/settings",
];
const publicRoutes = ["/login", "/forgot-password", "/signup"];

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some((route) => path.startsWith(route));
  const isPublicRoute = publicRoutes.some((route) => path.startsWith(route));

  // Create a Supabase client for the proxy to refresh sessions
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        },
      },
    }
  );

  let session = null;
  try {
    const { data } = await supabase.auth.getSession();
    session = data?.session ?? null;
  } catch (err: any) {
    if (err?.status === 429 || err?.code === "over_request_rate_limit" || err?.name === "AuthApiError") {
      console.warn("[Auth Proxy] Supabase auth rate limit reached (429). Continuing with request processing.");
    } else {
      console.error("[Auth Proxy] Error checking session:", err);
    }
  }

  // Redirect to login if not authenticated and trying to access protected route
  if (isProtectedRoute && !session?.user) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // Redirect authenticated user visiting root '/' to /machines for instant edge navigation
  if (path === "/" && session?.user) {
    return NextResponse.redirect(new URL("/machines", req.nextUrl));
  }

  return NextResponse.next({
    request: {
      headers: req.headers,
    },
  });
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
  ],
};