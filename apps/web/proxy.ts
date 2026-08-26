import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const protectedRoutes = [
  "/dashboard",
  "/machines",
  "/operations",
  "/services",
  "/service",
  "/notifications",
  "/notification",
  "/users",
  "/audit-logs",
  "/settings",
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
  "/clients",
  "/my-work",
  "/complaints",
  "/administration",
  "/branches",
  "/docs",
];

const publicRoutes = ["/login", "/forgot-password", "/signup"];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.some((route) => path.startsWith(route));
  const isPublicRoute = publicRoutes.some((route) => path.startsWith(route));

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

  // Redirect unauthenticated user accessing protected route to /login
  if (isProtectedRoute && !session?.user) {
    return NextResponse.redirect(new URL("/login", request.nextUrl));
  }

  // Redirect authenticated user visiting public route (/login, /signup) to /machines
  if (isPublicRoute && session?.user) {
    return NextResponse.redirect(new URL("/machines", request.nextUrl));
  }

  // Redirect authenticated user visiting root '/' to /machines
  if (path === "/" && session?.user) {
    return NextResponse.redirect(new URL("/machines", request.nextUrl));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
  ],
};
