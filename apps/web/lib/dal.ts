import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/cache";
import type { User, UserRole } from "@/lib/types/database";
import { roleHasPermission } from "@reachinternational/permissions";

import { headers } from "next/headers";
import { verifyInternalUser } from "@/lib/security/internal-auth-token";

export const verifySession = cache(async () => {
  // 1. Fast-path: Check cryptographically signed edge-verified user headers
  // Eliminates duplicate outbound network roundtrips to Supabase Auth on authenticated page loads.
  try {
    const headersList = await headers();
    const edgeUserId = headersList.get("x-internal-user-id");
    const edgeUserEmail = headersList.get("x-internal-user-email") || "";
    const edgeUserSig = headersList.get("x-internal-user-sig");

    if (edgeUserId && edgeUserSig) {
      const isValid = await verifyInternalUser(edgeUserId, edgeUserEmail, edgeUserSig);
      if (isValid) {
        return { isAuth: true, userId: edgeUserId, email: edgeUserEmail };
      }
    }
  } catch {
    // Fall through to direct Supabase auth verification if headers() is unavailable
  }

  // 2. Direct Supabase auth verification (Server Actions, direct mutations, fallback)
  const supabase = await createSupabaseServerClient();
  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      const errObj = error as { status?: number; code?: string };
      if (errObj?.status === 429 || errObj?.code === "over_request_rate_limit") {
        console.warn("[DAL] Supabase auth rate limit reached (429) in verifySession.");
      }
    } else {
      user = data?.user ?? null;
    }
  } catch (err: unknown) {
    const errObj = err as { status?: number; code?: string; name?: string };
    if (errObj?.status === 429 || errObj?.code === "over_request_rate_limit" || errObj?.name === "AuthApiError") {
      console.warn("[DAL] Supabase auth rate limit exception (429) caught in verifySession.");
    } else {
      console.error("[DAL] Unexpected error in verifySession:", err);
    }
  }

  if (!user) {
    redirect("/login");
  }

  return { isAuth: true, userId: user.id, email: user.email! };
});

// Cache the profile-row lookup across requests (keyed by userId), tagged `users`
// so every app/actions/users.ts mutation + refresh.ts already invalidates it.
// auth.getUser() above still validates the token on every request.
const getCachedUserRow = unstable_cache(
  async (userId: string) => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, phone, role, status, city, district, state, state_id, aadhaar_number, license_number, address, shift_time, shift_start_time, shift_end_time, complete_profile, email, created_at, updated_at")
      .eq("id", userId)
      .single();

    if (error || !data) {
      console.error("Error fetching user row:", error);
      return null;
    }

    return data;
  },
  ["dal-user-row-v8"],
  { revalidate: 60, tags: [CACHE_TAGS.users] }
);

export function isProfileIncomplete(user: User): boolean {
  return user.complete_profile !== "yes";
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await verifySession();
  const data = await getCachedUserRow(session.userId);
  if (!data) return null;
  return { ...data, email: session.email } as User;
});

export function protectOperatorRoute(role?: string) {
  if (role === "operator") {
    redirect("/dashboard");
  }
}

export function protectDisabledRoute() {
  redirect("/dashboard");
}

export const getCurrentUserRole = cache(async (): Promise<UserRole | null> => {
  const user = await getCurrentUser();
  return user?.role ?? null;
});

export const requireRole = cache(async (...roles: UserRole[]) => {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.status !== "active") {
    redirect("/login");
  }

  // Super admin bypasses role checks
  if (user.role === "super_admin") {
    return user;
  }

  if (!roles.includes(user.role)) {
    redirect("/dashboard");
  }

  return user;
});

export const requirePermission = cache(async (permissionCode: string) => {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.status !== "active") {
    redirect("/login");
  }

  if (!roleHasPermission(user.role, permissionCode)) {
    redirect("/dashboard");
  }

  return user;
});

export const requireAnyPermission = cache(async (...permissionCodes: string[]) => {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.status !== "active") {
    redirect("/login");
  }

  if (user.role === "super_admin") return user;

  const hasAny = permissionCodes.some((code) => roleHasPermission(user.role, code));
  if (!hasAny) {
    redirect("/dashboard");
  }

  return user;
});

export const getUserBranchIds = cache(async (): Promise<string[] | null> => {
  return null;
});

export const getCurrentUserOrNull = cache(async (): Promise<User | null> => {
  // 1. Fast-path: Check cryptographically signed edge-verified user headers from proxy.ts
  // Eliminates duplicate outbound network roundtrips to Supabase Auth on initial page loads.
  try {
    const headersList = await headers();
    const edgeUserId = headersList.get("x-internal-user-id");
    const edgeUserEmail = headersList.get("x-internal-user-email") || "";
    const edgeUserSig = headersList.get("x-internal-user-sig");

    if (edgeUserId && edgeUserSig) {
      const isValid = await verifyInternalUser(edgeUserId, edgeUserEmail, edgeUserSig);
      if (isValid) {
        const data = await getCachedUserRow(edgeUserId);
        if (data) {
          return { ...data, email: edgeUserEmail || data.email || "" } as User;
        }
      }
    }
  } catch {
    // Fall through to direct Supabase auth verification if headers() is unavailable
  }

  // 2. Direct Supabase auth verification fallback
  const supabase = await createSupabaseServerClient();
  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error) {
      user = data?.user ?? null;
    }
  } catch (err: unknown) {
    const errObj = err as { status?: number; code?: string; name?: string };
    if (errObj?.status === 429 || errObj?.code === "over_request_rate_limit" || errObj?.name === "AuthApiError") {
      console.warn("[DAL] Supabase auth rate limit caught in getCurrentUserOrNull.");
    }
  }

  if (!user) return null;

  const data = await getCachedUserRow(user.id);
  if (!data) return null;

  return { ...data, email: user.email || data.email || "" } as User;
});