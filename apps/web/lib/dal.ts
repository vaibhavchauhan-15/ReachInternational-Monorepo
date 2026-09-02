import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CACHE_TAGS } from "@/lib/cache";
import type { User, UserRole } from "@/lib/types/database";
import { roleHasPermission } from "@/lib/auth/rbac";

export const verifySession = cache(async () => {
  const supabase = await createSupabaseServerClient();
  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if ((error as any)?.status === 429 || (error as any)?.code === "over_request_rate_limit") {
        console.warn("[DAL] Supabase auth rate limit reached (429) in verifySession.");
      }
    } else {
      user = data?.user ?? null;
    }
  } catch (err: any) {
    if (err?.status === 429 || err?.code === "over_request_rate_limit" || err?.name === "AuthApiError") {
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
      .select("id, full_name, phone, role, status, city, district, state, state_id, aadhaar_number, license_number, address, shift_time, email, created_at, updated_at")
      .eq("id", userId)
      .single();

    if (error || !data) {
      console.error("Error fetching user row:", error);
      return null;
    }

    return data;
  },
  ["dal-user-row-v6"],
  { revalidate: 60, tags: [CACHE_TAGS.users] }
);

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await verifySession();
  const data = await getCachedUserRow(session.userId);
  if (!data) return null;
  return { ...data, email: session.email } as User;
});

export function protectOperatorRoute(role?: string) {
  if (role === "operator") {
    redirect("/operations?tab=entry");
  }
}

export function protectDisabledRoute(role?: string) {
  if (role === "operator") {
    redirect("/operations?tab=entry");
  }
  redirect("/machines");
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
    redirect("/machines");
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
    redirect("/machines");
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
    redirect("/machines");
  }

  return user;
});

export const getUserBranchIds = cache(async (): Promise<string[] | null> => {
  return null;
});

export const getCurrentUserOrNull = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient();
  let user = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (!error) {
      user = data?.user ?? null;
    }
  } catch (err: any) {
    if (err?.status === 429 || err?.code === "over_request_rate_limit" || err?.name === "AuthApiError") {
      console.warn("[DAL] Supabase auth rate limit caught in getCurrentUserOrNull.");
    }
  }

  if (!user) return null;

  const data = await getCachedUserRow(user.id);
  if (!data) return null;

  return { ...data, email: user.email || data.email || "" } as User;
});