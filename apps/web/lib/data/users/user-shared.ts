import "server-only";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { User, UserRole, ProfileChangeRequest, AccountDeletionRequest, WorkingLocation } from "@/lib/types/database";
import { SUPERVISOR_VISIBLE_USER_ROLES } from "@reachinternational/permissions";

export interface UserListAggregates {
  total: number;
  active: number;
  engineers: number;
  new_registrations: number;
  totalUsers: number;
  activeUsers: number;
  engineerCount: number;
  states: Array<{ id: string; label: string }>;
}

export const USER_SELECT_COLUMNS =
  "id, full_name, email, phone, role, status, city, district, state, state_id, aadhaar_number, license_number, address, shift_time, supervisor_id, supervisor_ids, working_location_id, created_at, updated_at";

export const getActiveSupervisorsCached = unstable_cache(
  async (): Promise<Pick<User, "id" | "full_name" | "email" | "phone" | "role">[]> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("users")
      .select("id, full_name, email, phone, role")
      .in("role", ["supervisor", "admin", "super_admin", "manager", "service_manager"])
      .eq("status", "active")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("[DAL] Error fetching active supervisors:", error.message || error);
      return [];
    }

    return (data as unknown as Pick<User, "id" | "full_name" | "email" | "phone" | "role">[]) || [];
  },
  ["active-supervisors-list-v2"],
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

export const getUserListAggregatesCached = unstable_cache(
  async (): Promise<UserListAggregates> => {
    const supabase = createSupabaseAdminClient();

    // 1. Primary: High-performance scalar RPC (Migration 077)
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc("get_users_directory_summary");
      if (!rpcError && rpcData) {
        const parsed = typeof rpcData === "string" ? JSON.parse(rpcData) : rpcData;
        if (parsed && typeof parsed.total !== "undefined") {
          const total = Number(parsed.total ?? 0);
          const active = Number(parsed.active ?? 0);
          const engineers = Number(parsed.engineers ?? 0);
          const new_registrations = Number(parsed.new_registrations ?? 0);
          return {
            total,
            active,
            engineers,
            new_registrations,
            totalUsers: total,
            activeUsers: active,
            engineerCount: engineers,
            states: Array.isArray(parsed.states) ? parsed.states : [],
          };
        }
      }
    } catch {
      // Fallback below
    }

    // 2. Secondary fallback: Migration 059 RPC
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc("get_user_aggregates");
      if (!rpcError && rpcData) {
        const parsed = typeof rpcData === "string" ? JSON.parse(rpcData) : rpcData;
        if (parsed && typeof parsed.total_users !== "undefined") {
          const total = Number(parsed.total_users ?? 0);
          const active = Number(parsed.active_users ?? 0);
          const engineers = Number(parsed.engineer_count ?? 0);
          return {
            total,
            active,
            engineers,
            new_registrations: 0,
            totalUsers: total,
            activeUsers: active,
            engineerCount: engineers,
            states: Array.isArray(parsed.states) ? parsed.states : [],
          };
        }
      }
    } catch {
      // Fallback below
    }

    // 3. Parallel fallback queries
    const [totalRes, activeRes, engineerRes, statesRes] = await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase.from("users").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("users").select("id", { count: "exact", head: true }).in("role", ["engineer", "service_engineer"]),
      supabase.from("users").select("state, state_id").not("state", "is", null).limit(300),
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

    const total = totalRes.count ?? 0;
    const active = activeRes.count ?? 0;
    const engineers = engineerRes.count ?? 0;

    return {
      total,
      active,
      engineers,
      new_registrations: 0,
      totalUsers: total,
      activeUsers: active,
      engineerCount: engineers,
      states: sortedStates,
    };
  },
  ["user-list-aggregates-v3"],
  { revalidate: CACHE_TIERS.CLASS_C_OPERATIONAL, tags: [TAGS.users] }
);

export async function getSupervisorUserListAggregatesCached(
  supervisorId: string
): Promise<UserListAggregates> {
  const fetchScoped = unstable_cache(
    async (supId: string): Promise<UserListAggregates> => {
      const supabase = createSupabaseAdminClient();

      // 1. Primary: Scoped scalar RPC (Migration 077)
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc("get_users_directory_summary", {
          p_supervisor_id: supId,
        });
        if (!rpcError && rpcData) {
          const parsed = typeof rpcData === "string" ? JSON.parse(rpcData) : rpcData;
          if (parsed && typeof parsed.total !== "undefined") {
            const total = Number(parsed.total ?? 0);
            const active = Number(parsed.active ?? 0);
            const engineers = Number(parsed.engineers ?? 0);
            const new_registrations = Number(parsed.new_registrations ?? 0);
            return {
              total,
              active,
              engineers,
              new_registrations,
              totalUsers: total,
              activeUsers: active,
              engineerCount: engineers,
              states: Array.isArray(parsed.states) ? parsed.states : [],
            };
          }
        }
      } catch {
        // Fallback below
      }

      // 2. Secondary fallback parallel queries
      const scopeFilter = `supervisor_id.eq.${supId},supervisor_ids.cs.{${supId}}`;

      const [totalRes, activeRes, engineerRes, statesRes] = await Promise.all([
        supabase
          .from("users")
          .select("id", { count: "exact", head: true })
          .or(scopeFilter)
          .in("role", SUPERVISOR_VISIBLE_USER_ROLES),
        supabase
          .from("users")
          .select("id", { count: "exact", head: true })
          .or(scopeFilter)
          .in("role", SUPERVISOR_VISIBLE_USER_ROLES)
          .eq("status", "active"),
        supabase
          .from("users")
          .select("id", { count: "exact", head: true })
          .or(scopeFilter)
          .in("role", ["engineer", "service_engineer"]),
        supabase
          .from("users")
          .select("state, state_id")
          .or(scopeFilter)
          .in("role", SUPERVISOR_VISIBLE_USER_ROLES)
          .not("state", "is", null)
          .limit(100),
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

      const total = totalRes.count ?? 0;
      const active = activeRes.count ?? 0;
      const engineers = engineerRes.count ?? 0;

      return {
        total,
        active,
        engineers,
        new_registrations: 0,
        totalUsers: total,
        activeUsers: active,
        engineerCount: engineers,
        states: sortedStates,
      };
    },
    [`supervisor-user-aggregates-v2-${supervisorId}`],
    { revalidate: CACHE_TIERS.CLASS_C_OPERATIONAL, tags: [TAGS.users] }
  );

  return fetchScoped(supervisorId);
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

export const getPendingAccountDeletionRequestsCached = unstable_cache(
  async (): Promise<AccountDeletionRequest[]> => {
    const supabase = createSupabaseAdminClient();
    const requests: AccountDeletionRequest[] = [];

    // 1. Direct table
    const { data: directData } = await supabase
      .from("account_deletion_requests")
      .select(`
        id,
        user_id,
        email,
        full_name,
        phone,
        role,
        reason,
        source,
        status,
        admin_notes,
        reviewed_by,
        reviewed_at,
        created_at,
        updated_at,
        user:users!account_deletion_requests_user_id_fkey(id, full_name, email, role, phone)
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (directData && Array.isArray(directData)) {
      for (const d of directData) {
        requests.push({
          id: d.id,
          user_id: d.user_id,
          email: d.email,
          full_name: d.full_name || (d.user as any)?.full_name,
          phone: d.phone || (d.user as any)?.phone,
          role: d.role || (d.user as any)?.role,
          reason: d.reason,
          source: (d.source as any) || "web",
          status: "pending",
          admin_notes: d.admin_notes,
          reviewed_by: d.reviewed_by,
          reviewed_at: d.reviewed_at,
          created_at: d.created_at,
          updated_at: d.updated_at,
          user: d.user as any,
        });
      }
    }

    // 2. Fallback in profile_change_requests
    const { data: fallbackData } = await supabase
      .from("profile_change_requests")
      .select(`
        id,
        user_id,
        requester_role,
        requested_data,
        status,
        created_at,
        updated_at,
        user:users!profile_change_requests_user_id_fkey(id, full_name, email, role, phone)
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (fallbackData && Array.isArray(fallbackData)) {
      for (const f of fallbackData) {
        const reqData = f.requested_data as Record<string, any>;
        if (reqData && reqData.type === "account_deletion") {
          if (!requests.some((r) => r.id === f.id)) {
            const u = f.user as any;
            requests.push({
              id: f.id,
              user_id: f.user_id,
              email: reqData.email || u?.email || "Unknown",
              full_name: reqData.full_name || u?.full_name,
              phone: reqData.phone || u?.phone,
              role: reqData.role || f.requester_role || u?.role,
              reason: reqData.reason || "Account deletion requested",
              source: (reqData.source as any) || "web",
              status: "pending",
              created_at: f.created_at,
              updated_at: f.updated_at,
              user: u,
            });
          }
        }
      }
    }

    return requests.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },
  ["pending-account-deletion-requests-v1"],
  { revalidate: 30, tags: [TAGS.users] }
);
