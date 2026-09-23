import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/cache";
import type { User, UserRole } from "@/lib/types/database";
import { roleHasPermission, getRoleHomeRoute } from "@reachinternational/permissions";


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
      .select("id, full_name, phone, role, status, city, district, state, state_id, aadhaar_number, license_number, street, shift_start_time, shift_end_time, complete_profile, email, daily_rate, ot_hourly_rate, monthly_salary, supervisor_id, created_at, updated_at")
      .eq("id", userId)
      .single();

    if (error) {
      // Self-heal: If auth user exists in auth.users but has no row in public.users (PGRST116: 0 rows)
      if (error.code === "PGRST116") {
        try {
          const { data: authData, error: authErr } = await supabase.auth.admin.getUserById(userId);
          if (!authErr && authData?.user) {
            const meta = authData.user.user_metadata || {};
            const fallbackUser = {
              id: userId,
              email: authData.user.email || "",
              full_name: (meta.full_name as string) || authData.user.email || "User",
              role: (meta.role as string) || "operator",
              status: "active",
              street: (meta.street as string) || (meta.address as string) || null,
              city: (meta.city as string) || null,
              district: (meta.district as string) || null,
              state: (meta.state as string) || null,
              complete_profile: false,
            };
            const { data: inserted, error: insertErr } = await supabase
              .from("users")
              .insert(fallbackUser)
              .select("id, full_name, phone, role, status, city, district, state, state_id, aadhaar_number, license_number, street, shift_start_time, shift_end_time, complete_profile, email, daily_rate, ot_hourly_rate, monthly_salary, supervisor_id, created_at, updated_at")
              .single();

            if (!insertErr && inserted) {
              return {
                ...inserted,
                address: inserted.street || null,
              };
            }
          }
        } catch (healErr) {
          console.warn("[DAL] Self-healing user row failed:", healErr);
        }
      }

      console.error("[DAL] Error fetching user row for userId " + userId + ":", error.message || error.code || error);
      return null;
    }

    if (!data) {
      console.warn("[DAL] User row not found in public.users for userId:", userId);
      return null;
    }

    return {
      ...data,
      address: data.street || null,
    };
  },
  ["dal-user-row-v10"],
  { revalidate: 60, tags: [CACHE_TAGS.users] }
);

export function isProfileIncomplete(user: User): boolean {
  if (typeof user.complete_profile === "boolean") {
    return !user.complete_profile;
  }
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
    redirect(getRoleHomeRoute("operator"));
  }
}

export function protectDisabledRoute(role?: string) {
  redirect(getRoleHomeRoute(role));
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
    redirect(getRoleHomeRoute(user.role));
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
    redirect(getRoleHomeRoute(user.role));
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
    redirect(getRoleHomeRoute(user.role));
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