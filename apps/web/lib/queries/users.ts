import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser, requireRole } from "@/lib/dal";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { User, UserRole, UserStatus, ProfileChangeRequest, AccountDeletionRequest, WorkingLocation } from "@/lib/types/database";
import { getISTDateString } from "@reachinternational/utils";
import { SUPERVISOR_VISIBLE_USER_ROLES } from "@reachinternational/permissions";

export const USERS_PAGE_SIZE = 10;

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

function sanitizeSearchToken(token: string): string {
  return token
    .replace(/[,()"]/g, "")
    .replace(/[\\%_]/g, "\\$&")
    .trim();
}

/**
 * Applies an optimized, high-performance search query filter to the Supabase query builder.
 * Targets only relevant indexed columns based on input pattern (digits, email, role, multi-token text)
 * and skips single-character queries to prevent heavy unindexed sequential table scans.
 */
export function applyOptimizedUserSearch(query: any, search?: string) {
  if (!search) return query;
  const trimmed = search.trim();
  if (trimmed.length === 0) return query;

  const sanitized = sanitizeSearchToken(trimmed);
  if (!sanitized) return query;

  // Single-character fast prefix search: hits B-Tree index on prefix without full table scan
  if (trimmed.length === 1) {
    return query.or(`full_name.ilike.${sanitized}%,email.ilike.${sanitized}%,role.ilike.${sanitized}%`);
  }

  // 1. Phone or Aadhaar search: input consists mostly of numbers, +, -, spaces, ()
  const isDigitsOnly = /^[0-9+\s\-()]+$/.test(trimmed);
  const digits = trimmed.replace(/\D/g, "");

  if (isDigitsOnly && digits.length >= 3) {
    let phoneDigits = digits;
    if (digits.length === 12 && digits.startsWith("91")) {
      phoneDigits = digits.slice(2);
    } else if (digits.length === 11 && digits.startsWith("0")) {
      phoneDigits = digits.slice(1);
    }

    const conditions: string[] = [];
    if (phoneDigits.length >= 3) {
      conditions.push(`phone.ilike.%${phoneDigits}%`);
    }
    if (digits.length >= 4) {
      conditions.push(`aadhaar_number.ilike.%${digits}%`);
    }
    conditions.push(`license_number.ilike.%${sanitized}%`);
    conditions.push(`full_name.ilike.%${sanitized}%`);

    return query.or(conditions.join(","));
  }

  // 2. Email search: contains @ or domain ending
  if (trimmed.includes("@") || trimmed.endsWith(".com") || trimmed.endsWith(".in")) {
    return query.or(`email.ilike.%${sanitized}%,full_name.ilike.%${sanitized}%`);
  }

  // 3. Multi-token or Role search
  const words = trimmed.split(/\s+/).map(sanitizeSearchToken).filter((w) => w.length >= 2);
  const roleSlug = sanitized.toLowerCase().replace(/\s+/g, "_");
  const isKnownRole = [
    "super_admin",
    "admin",
    "service_manager",
    "service_engineer",
    "engineer",
    "supervisor",
    "store_manager",
    "hr_manager",
    "operator",
    "mechanic",
    "manager",
    "branch_manager",
  ].some((r) => r === roleSlug || r.includes(roleSlug) || roleSlug.includes(r));

  if (words.length > 1) {
    if (isKnownRole) {
      return query.or(`role.ilike.%${roleSlug}%,full_name.ilike.%${sanitized}%,email.ilike.%${sanitized}%`);
    }

    // Composite multi-token AND matching across name, role, city, district, state, email
    for (const word of words) {
      const wRole = word.toLowerCase().replace(/s$/, "");
      query = query.or(
        `full_name.ilike.%${word}%,role.ilike.%${wRole}%,city.ilike.%${word}%,district.ilike.%${word}%,state.ilike.%${word}%,email.ilike.%${word}%`
      );
    }
    return query;
  }

  // 4. Single-token text search
  const roleVariant = sanitized.toLowerCase().replace(/s$/, "");
  const conditions = [
    `full_name.ilike.%${sanitized}%`,
    `email.ilike.%${sanitized}%`,
    `role.ilike.%${sanitized}%`,
    `city.ilike.%${sanitized}%`,
    `district.ilike.%${sanitized}%`,
    `state.ilike.%${sanitized}%`,
    `license_number.ilike.%${sanitized}%`,
  ];

  if (roleVariant !== sanitized.toLowerCase()) {
    conditions.push(`role.ilike.%${roleVariant}%`);
  }

  if (digits.length >= 3) {
    conditions.push(`phone.ilike.%${digits}%`);
    conditions.push(`aadhaar_number.ilike.%${digits}%`);
  }

  return query.or(conditions.join(","));
}

export async function getUserList(params: UserListParams = {}) {
  await requireRole("admin", "super_admin", "service_manager", "hr_manager", "manager", "supervisor");
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error("Unauthorized");

  const isSupervisor = currentUser.role === "supervisor";
  let supabase;
  if (isSupervisor) {
    try {
      supabase = await createSupabaseServerClient();
    } catch {
      supabase = createSupabaseAdminClient();
    }
  } else {
    supabase = createSupabaseAdminClient();
  }

  const { search, role, status, kyc, state, dateRange, sort, page = 1, pageSize = USERS_PAGE_SIZE } = params;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const isExport = pageSize > 100;
  let query = supabase
    .from("users")
    .select(USER_SELECT_COLUMNS, isExport ? {} : { count: "exact" });

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
  // Deterministic secondary sort key ensures stable page boundaries on equal timestamps/values
  query = query.order("id", { ascending: true });

  if (isSupervisor) {
    // Supervisor scope: assigned via primary supervisor_id or supervisor_ids array
    query = query.or(`supervisor_id.eq.${currentUser.id},supervisor_ids.cs.{${currentUser.id}}`);

    // Clamp role filter to supervisor visible roles only
    if (role && role !== "all") {
      if ((SUPERVISOR_VISIBLE_USER_ROLES as readonly string[]).includes(role)) {
        query = query.eq("role", role);
      } else {
        query = query.eq("role", "__unauthorized_scope__");
      }
    } else {
      query = query.in("role", SUPERVISOR_VISIBLE_USER_ROLES);
    }
  } else {
    if (role && role !== "all") {
      query = query.eq("role", role);
    }
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

  query = applyOptimizedUserSearch(query, search);


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

  // Parallelize secondary supervisor and working location relations lookup with URL overflow protection
  const adminClient = createSupabaseAdminClient();
  const [supsRes, locsRes] = await Promise.all([
    supervisorIds.length > 50
      ? adminClient.from("users").select("id, full_name, email, phone").in("role", ["supervisor", "admin", "super_admin", "manager", "service_manager"])
      : supervisorIds.length > 0
      ? adminClient.from("users").select("id, full_name, email, phone").in("id", supervisorIds)
      : Promise.resolve({ data: null }),
    workingLocationIds.length > 50
      ? adminClient.from("working_locations").select("id, name, type, city, state, address")
      : workingLocationIds.length > 0
      ? adminClient.from("working_locations").select("id, name, type, city, state, address").in("id", workingLocationIds)
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
    total: isExport ? hydratedUsers.length : (count ?? 0),
    page,
    pageSize,
    totalPages: isExport ? 1 : Math.ceil((count ?? 0) / pageSize),
  };
}

export const getUserListAggregatesCached = unstable_cache(
  async (): Promise<UserListAggregates> => {
    const supabase = createSupabaseAdminClient();

    // 1. Try single round-trip RPC (Migration 059)
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc("get_user_aggregates");
      if (!rpcError && rpcData) {
        const parsed = typeof rpcData === "string" ? JSON.parse(rpcData) : rpcData;
        if (parsed && typeof parsed.total_users !== "undefined") {
          return {
            totalUsers: Number(parsed.total_users ?? 0),
            activeUsers: Number(parsed.active_users ?? 0),
            engineerCount: Number(parsed.engineer_count ?? 0),
            states: Array.isArray(parsed.states) ? parsed.states : [],
          };
        }
      }
    } catch {
      // Fallback below if RPC is not yet registered in DB
    }

    // 2. Parallel fallback queries
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

    return {
      totalUsers: totalRes.count ?? 0,
      activeUsers: activeRes.count ?? 0,
      engineerCount: engineerRes.count ?? 0,
      states: sortedStates,
    };
  },
  ["user-list-aggregates-v2"],
  { revalidate: CACHE_TIERS.CLASS_C_OPERATIONAL, tags: [TAGS.users] }
);

export async function getSupervisorUserListAggregatesCached(
  supervisorId: string
): Promise<UserListAggregates> {
  const fetchScoped = unstable_cache(
    async (supId: string): Promise<UserListAggregates> => {
      const supabase = createSupabaseAdminClient();
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

      return {
        totalUsers: totalRes.count ?? 0,
        activeUsers: activeRes.count ?? 0,
        engineerCount: engineerRes.count ?? 0,
        states: sortedStates,
      };
    },
    [`supervisor-user-aggregates-${supervisorId}`],
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

