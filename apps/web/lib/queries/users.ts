import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, requireRole } from "@/lib/dal";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { User, UserRole, UserStatus } from "@/lib/types/database";

export interface UserListParams {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

const USER_SELECT_COLUMNS =
  "id, full_name, email, phone, role, status, city, district, state, created_at, updated_at";

export async function getUserList(params: UserListParams = {}) {
  await requireRole("admin", "super_admin", "service_manager", "hr_manager");
  const supabase = createSupabaseAdminClient();

  const { search, role, status, page = 1, pageSize = 50 } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("users")
    .select(USER_SELECT_COLUMNS, { count: "estimated" })
    .order("created_at", { ascending: false });

  if (role && role !== "all") {
    query = query.eq("role", role);
  }

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (search) {
    const s = search.replace(/[,()"\\]/g, "");
    query = query.or(
      `full_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%,city.ilike.%${s}%`
    );
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    console.error("[DAL] Error fetching user list:", error.message || error);
    return {
      users: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
    };
  }

  return {
    users: (data as unknown as User[]) || [],
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

export const getAllUsersCached = unstable_cache(
  async (): Promise<User[]> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("users")
      .select(USER_SELECT_COLUMNS)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[DAL] Error in getAllUsersCached:", error.message || error);
      return [];
    }

    return (data as unknown as User[]) || [];
  },
  ["all-users-directory-v2"],
  { revalidate: CACHE_TIERS.CLASS_C_OPERATIONAL, tags: [TAGS.users] }
);

export const getUserOptions = unstable_cache(
  async (role?: UserRole): Promise<{ id: string; label: string; role: UserRole }[]> => {
    const supabase = createSupabaseAdminClient();
    let query = supabase
      .from("users")
      .select("id, full_name, email, role")
      .neq("status", "inactive")
      .order("full_name", { ascending: true });

    if (role) {
      query = query.eq("role", role);
    }

    const { data, error } = await query;
    if (error) return [];

    return (data || []).map((u: any) => ({
      id: u.id,
      label: u.full_name || u.email || "Unknown User",
      role: u.role,
    }));
  },
  ["user-options-v2"],
  { revalidate: CACHE_TIERS.CLASS_B_DIRECTORY, tags: [TAGS.users] }
);
