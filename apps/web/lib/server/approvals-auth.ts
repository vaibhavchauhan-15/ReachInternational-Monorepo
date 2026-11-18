import "server-only";
import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  status: string;
  isAdmin: boolean;
}

export const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

/**
 * Authenticate incoming request via Bearer token (Native Mobile) or Session Cookie (Web).
 * Returns verified user record with explicit role and admin authorization flag.
 */
export async function authenticateApprovalsRequest(
  req: NextRequest
): Promise<{ user: AuthenticatedUser | null; error: string | null; status: number }> {
  try {
    const adminSupabase = createSupabaseAdminClient();
    let authUserId: string | null = null;
    let authEmail: string = "";

    // 1. Dual Authentication: Bearer token (Native Mobile)
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7).trim();
      const { data, error } = await adminSupabase.auth.getUser(token);
      if (!error && data?.user) {
        authUserId = data.user.id;
        authEmail = data.user.email || "";
      }
    }

    // 2. Cookie session (Web)
    if (!authUserId) {
      try {
        const supabase = await createSupabaseServerClient();
        const { data, error } = await supabase.auth.getUser();
        if (!error && data?.user) {
          authUserId = data.user.id;
          authEmail = data.user.email || "";
        }
      } catch {
        // Fallback handled below
      }
    }

    if (!authUserId) {
      return { user: null, error: "Unauthorized: Valid session or token required.", status: 401 };
    }

    // 3. Fetch user profile from database
    const { data: userRow, error: userErr } = await adminSupabase
      .from("users")
      .select("id, email, role, status")
      .eq("id", authUserId)
      .maybeSingle();

    if (userErr || !userRow) {
      return { user: null, error: "User profile not found.", status: 401 };
    }

    if (userRow.status !== "active") {
      return { user: null, error: `Account is ${userRow.status}.`, status: 403 };
    }

    const isAdmin = userRow.role === "admin" || userRow.role === "super_admin";

    return {
      user: {
        id: userRow.id,
        email: userRow.email || authEmail,
        role: userRow.role,
        status: userRow.status,
        isAdmin,
      },
      error: null,
      status: 200,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { user: null, error: msg, status: 500 };
  }
}
