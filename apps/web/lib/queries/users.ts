import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, requireRole } from "@/lib/dal";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { User, UserRole, UserStatus, ProfileChangeRequest, WorkingLocation } from "@/lib/types/database";
import { getISTDateString } from "@reachinternational/utils";

export interface UserListParams {
  search?: string;
  role?: string;
  status?: string;
  kyc?: string;
  state?: string;
  dateRange?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}

export interface UserListAggregates {
  totalUsers: number;
  activeUsers: number;
  engineerCount: number;
  states: Array<{ id: string; label: string }>;
}

const USER_SELECT_COLUMNS =
  "id, full_name, email, phone, role, status, city, district, state, state_id, aadhaar_number, license_number, address, shift_time, supervisor_id, supervisor_ids, working_location_id, created_at, updated_at";

export async function getUserList(params: UserListParams = {}) {
  await requireRole("admin", "super_admin", "service_manager", "hr_manager", "manager");
  const supabase = createSupabaseAdminClient();

  const { search, role, status, kyc, state, dateRange, sort, page = 1, pageSize = 10 } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("users")
    .select(USER_SELECT_COLUMNS, { count: "exact" });

  if (sort) {
    if (sort === "newest") query = query.order("created_at", { ascending: false });
    else if (sort === "oldest") query = query.order("created_at", { ascending: true });
    else if (sort === "name_asc") query = query.order("full_name", { ascending: true });
    else if (sort === "name_desc") query = query.order("full_name", { ascending: false });
    else if (sort === "role_asc") query = query.order("role", { ascending: true });
    else query = query.order("created_at", { ascending: false });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  if (role && role !== "all") {
    query = query.eq("role", role);
  }

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  if (state && state !== "all") {
    query = query.eq("state", state);
  }

  if (kyc && kyc !== "all") {
    if (kyc === "fully_verified") {
      query = query.not("aadhaar_number", "is", null).not("license_number", "is", null);
    } else if (kyc === "aadhaar_only") {
      query = query.not("aadhaar_number", "is", null).is("license_number", null);
    } else if (kyc === "license_only") {
      query = query.is("aadhaar_number", null).not("license_number", "is", null);
    } else if (kyc === "pending_kyc") {
      query = query.or("aadhaar_number.is.null,license_number.is.null");
    }
  }

  if (dateRange && dateRange !== "all") {
    const today = new Date(getISTDateString());
    if (dateRange === "today") {
      query = query.gte("created_at", today.toISOString());
    } else if (dateRange === "7days") {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      query = query.gte("created_at", d.toISOString());
    } else if (dateRange === "30days") {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      query = query.gte("created_at", d.toISOString());
    } else if (dateRange === "90days") {
      const d = new Date(today);
      d.setDate(d.getDate() - 90);
      query = query.gte("created_at", d.toISOString());
    } else if (dateRange === "this_year") {
      const d = new Date(today.getFullYear(), 0, 1);
      query = query.gte("created_at", d.toISOString());
    }
  }

  if (search) {
    const s = search.replace(/[,()"\\]/g, "");
    query = query.or(
      `full_name.ilike.%${s}%,email.ilike.%${s}%,phone.ilike.%${s}%,city.ilike.%${s}%,district.ilike.%${s}%,state.ilike.%${s}%,aadhaar_number.ilike.%${s}%,license_number.ilike.%${s}%`
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

  const rawUsers = (data as unknown as User[]) || [];
  const supervisorIds = Array.from(
    new Set(
      rawUsers
        .flatMap((u) => [u.supervisor_id, ...(u.supervisor_ids || [])])
        .filter(Boolean)
    )
  ) as string[];
  const workingLocationIds = Array.from(
    new Set(rawUsers.map((u) => u.working_location_id).filter(Boolean))
  ) as string[];

  // Parallelize secondary supervisor and working location relations lookup
  const [supsRes, locsRes] = await Promise.all([
    supervisorIds.length > 0
      ? supabase.from("users").select("id, full_name, email, phone").in("id", supervisorIds)
      : Promise.resolve({ data: null }),
    workingLocationIds.length > 0
      ? supabase.from("working_locations").select("id, name, type, city, state, address").in("id", workingLocationIds)
      : Promise.resolve({ data: null }),
  ]);

  let supervisorMap = new Map<string, { id: string; full_name: string; email?: string | null; phone?: string | null }>();
  if (supsRes.data) {
    supervisorMap = new Map(supsRes.data.map((s) => [s.id, s]));
  }

  let workingLocationMap = new Map<string, { id: string; name: string; type?: string; city?: string | null; state?: string | null; address?: string | null }>();
  if (locsRes.data) {
    workingLocationMap = new Map((locsRes.data as any[]).map((l: any) => [l.id, l]));
  }

  const hydratedUsers = rawUsers.map((u) => {
    const supIds = (u.supervisor_ids && u.supervisor_ids.length > 0)
      ? u.supervisor_ids
      : (u.supervisor_id ? [u.supervisor_id] : []);
    const supervisorsList = supIds
      .map((id) => supervisorMap.get(id))
      .filter(Boolean) as Array<{ id: string; full_name: string; email?: string | null; phone?: string | null }>;
    const primarySup = (u.supervisor_id && supervisorMap.get(u.supervisor_id))
      || supervisorsList[0]
      || null;

    return {
      ...u,
      supervisor_id: primarySup?.id ?? null,
      supervisor_ids: supIds,
      supervisor: primarySup,
      supervisors: supervisorsList,
      working_location: u.working_location_id ? workingLocationMap.get(u.working_location_id) || null : null,
    };
  });

  return {
    users: hydratedUsers,
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

export const getUserListAggregatesCached = unstable_cache(
  async (): Promise<UserListAggregates> => {
    const supabase = createSupabaseAdminClient();

    const [totalRes, activeRes, engineerRes, statesRes] = await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase.from("users").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("users").select("id", { count: "exact", head: true }).in("role", ["engineer", "service_engineer"]),
      supabase.from("users").select("state, state_id").not("state", "is", null),
    ]);

    const statesMap = new Map<string, { id: string; label: string }>();
    if (statesRes.data) {
      for (const row of statesRes.data as Array<{ state: string | null; state_id: string | number | null }>) {
        if (row.state && row.state.trim()) {
          const cleanState = row.state.trim();
          const key = row.state_id ? String(row.state_id) : cleanState.toLowerCase();
          if (!statesMap.has(key)) {
            statesMap.set(key, { id: key, label: cleanState });
          }
        }
      }
    }

    const sortedStates = Array.from(statesMap.values()).sort((a, b) =>
      a.label.localeCompare(b.label)
    );

    return {
      totalUsers: totalRes.count ?? 0,
      activeUsers: activeRes.count ?? 0,
      engineerCount: engineerRes.count ?? 0,
      states: sortedStates,
    };
  },
  ["user-list-aggregates-v1"],
  { revalidate: CACHE_TIERS.CLASS_C_OPERATIONAL, tags: [TAGS.users] }
);

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

    const rawUsers = (data as unknown as User[]) || [];
    const supervisorMap = new Map<string, { id: string; full_name: string; email?: string | null; phone?: string | null }>();
    for (const u of rawUsers) {
      if (u.role === "supervisor") {
        supervisorMap.set(u.id, {
          id: u.id,
          full_name: u.full_name,
          email: u.email,
          phone: u.phone,
        });
      }
    }

    const { data: locs } = await supabase
      .from("working_locations")
      .select("id, name, type, city, state, address")
      .eq("status", "active");
    const workingLocationMap = new Map((locs || []).map((l: any) => [l.id, l]));

    return rawUsers.map((u) => {
      const supIds = (u.supervisor_ids && u.supervisor_ids.length > 0)
        ? u.supervisor_ids
        : (u.supervisor_id ? [u.supervisor_id] : []);
      const supervisorsList = supIds
        .map((id) => supervisorMap.get(id))
        .filter(Boolean) as Array<{ id: string; full_name: string; email?: string | null; phone?: string | null }>;
      const primarySup = (u.supervisor_id && supervisorMap.get(u.supervisor_id))
        || supervisorsList[0]
        || null;

      return {
        ...u,
        supervisor_id: primarySup?.id ?? null,
        supervisor_ids: supIds,
        supervisor: primarySup,
        supervisors: supervisorsList,
        working_location: u.working_location_id ? workingLocationMap.get(u.working_location_id) || null : null,
      };
    });
  },
  ["all-users-directory-v5"],
  { revalidate: CACHE_TIERS.CLASS_C_OPERATIONAL, tags: [TAGS.users] }
);

export const getActiveSupervisorsCached = unstable_cache(
  async (): Promise<Pick<User, "id" | "full_name" | "email" | "phone" | "role">[]> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, email, phone, role")
      .eq("role", "supervisor")
      .eq("status", "active")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("[DAL] Error fetching active supervisors:", error.message || error);
      return [];
    }

    return (data as unknown as Pick<User, "id" | "full_name" | "email" | "phone" | "role">[]) || [];
  },
  ["active-supervisors-list-v1"],
  { revalidate: CACHE_TIERS.CLASS_C_OPERATIONAL, tags: [TAGS.users] }
);

export const getActiveWorkingLocationsCached = unstable_cache(
  async (): Promise<WorkingLocation[]> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("working_locations")
      .select("id, name, type, city, state, address, pincode, status, created_at, updated_at")
      .eq("status", "active")
      .order("name", { ascending: true });

    if (error) {
      console.error("[DAL] Error fetching active working locations:", error.message || error);
      return [];
    }

    return (data as unknown as WorkingLocation[]) || [];
  },
  ["active-working-locations-list-v1"],
  { revalidate: CACHE_TIERS.CLASS_C_OPERATIONAL, tags: [TAGS.users] }
);

/**
 * Fetch pending profile detail change requests based on the approver's hierarchy.
 * - super_admin: sees all pending requests
 * - admin: sees pending requests from manager and below
 * - manager / service_manager / hr_manager: sees pending requests from supervisor, operator, engineer, mechanic, etc.
 */
export const getPendingProfileChangeRequests = unstable_cache(
  async (userRole: UserRole): Promise<ProfileChangeRequest[]> => {
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from("profile_change_requests")
      .select(`
        id,
        user_id,
        requester_role,
        current_data,
        requested_data,
        target_approver_role,
        status,
        reviewed_by,
        reviewed_at,
        rejection_reason,
        created_at,
        updated_at,
        user:users!profile_change_requests_user_id_fkey(id, full_name, email, role, phone, shift_time, address, city, district, state, aadhaar_number, license_number)
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (userRole === "super_admin") {
      // Super admin can review all requests
    } else if (userRole === "admin") {
      // Admin can review requests from manager and below
      query = query.not("requester_role", "in", '("super_admin","admin")');
    } else if (["manager", "service_manager", "hr_manager", "store_manager"].includes(userRole)) {
      // Manager can review requests from supervisor and below
      query = query.not("requester_role", "in", '("super_admin","admin","manager","service_manager","hr_manager","store_manager")');
    } else {
      // Non-approvers see empty
      return [];
    }

    const { data, error } = await query;
    if (error) {
      console.error("[DAL] Error in getPendingProfileChangeRequests:", error.message || error);
      return [];
    }

    return (data as unknown as ProfileChangeRequest[]) || [];
  },
  ["pending-profile-change-requests-v1"],
  { revalidate: 30, tags: [TAGS.users] }
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

export const getPendingUsersCached = unstable_cache(
  async (): Promise<User[]> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("users")
      .select(USER_SELECT_COLUMNS)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[DAL] Error fetching pending users:", error.message || error);
      return [];
    }

    return (data as unknown as User[]) || [];
  },
  ["pending-users-list-v1"],
  { revalidate: 30, tags: [TAGS.users] }
);
