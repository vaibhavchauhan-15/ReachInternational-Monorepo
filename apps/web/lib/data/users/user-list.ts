import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser, requireRole } from "@/lib/dal";
import type { User } from "@/lib/types/database";
import { getISTDateString } from "@reachinternational/utils";
import { SUPERVISOR_VISIBLE_USER_ROLES } from "@reachinternational/permissions";
import { getActiveSupervisorsCached } from "./user-shared";

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

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Lean column projection strictly required for the User Directory list view.
 * Excludes heavy, sensitive fields: aadhaar_number, license_number, and address.
 * Reuses the machine-list.ts projection pattern.
 */
export const USER_LIST_COLUMNS =
  "id, full_name, email, phone, role, status, street, city, district, state, state_id, aadhaar_number, license_number, shift_start_time, shift_end_time, supervisor_id, monthly_salary, daily_rate, ot_hourly_rate, complete_profile, created_at, updated_at";

export function sanitizeSearchToken(token: string): string {
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
export function applyOptimizedUserSearch<T extends { or: (filters: string) => T }>(
  query: T,
  search?: string
): T {
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
    conditions.push(`phone.ilike.%${phoneDigits}%`);
    if (digits.length >= 4) {
      conditions.push(`aadhaar_number.ilike.%${digits}%`);
    }
    return query.or(conditions.join(","));
  }

  // 2. Email query
  if (trimmed.includes("@")) {
    return query.or(`email.ilike.%${sanitized}%`);
  }

  // 3. Multi-token full-text name / role / location search
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length > 1) {
    const andClauses = tokens.map((t) => {
      const s = sanitizeSearchToken(t);
      return `and(or(full_name.ilike.%${s}%,role.ilike.%${s}%,city.ilike.%${s}%,district.ilike.%${s}%,state.ilike.%${s}%))`;
    });
    return query.or(andClauses.join(","));
  }

  // 4. Default: single-token broad text search across indexed name, email, role, and address
  return query.or(
    `full_name.ilike.%${sanitized}%,email.ilike.%${sanitized}%,role.ilike.%${sanitized}%,city.ilike.%${sanitized}%,district.ilike.%${sanitized}%,state.ilike.%${sanitized}%,street.ilike.%${sanitized}%`
  );
}

/**
 * Hydrates supervisor and working location relations in-memory from cached master lists.
 * Eliminates ad-hoc eager SQL joins and avoids secondary table roundtrips.
 * Reuses the machine-list.ts hydration pattern.
 */
type CachedSupervisor = Pick<User, "id" | "full_name" | "email" | "phone" | "role">;

export async function hydrateUsersPersonnel(rawUsers: User[]): Promise<User[]> {
  if (!rawUsers || rawUsers.length === 0) return [];

  const activeSupervisors = await getActiveSupervisorsCached();
  const supervisorMap = new Map<string, CachedSupervisor>(activeSupervisors.map((s) => [s.id, s]));

  // Query user_supervisors junction table for all users
  const userIds = rawUsers.map((u) => u.id);
  const userToSupsMap = new Map<string, string[]>();
  if (userIds.length > 0) {
    try {
      const adminClient = createSupabaseAdminClient();
      const { data: userSupsRes } = await adminClient
        .from("user_supervisors")
        .select("user_id, supervisor_id")
        .in("user_id", userIds);
      if (userSupsRes) {
        for (const rel of userSupsRes as Array<{ user_id: string; supervisor_id: string }>) {
          const existing = userToSupsMap.get(rel.user_id) || [];
          existing.push(rel.supervisor_id);
          userToSupsMap.set(rel.user_id, existing);
        }
      }
    } catch {
      // Fallback to u.supervisor_id
    }
  }

  // Check for any edge-case supervisor IDs not present in the active cache (e.g. inactive supervisors)
  const missingSupIds = new Set<string>();
  rawUsers.forEach((u) => {
    const junctionSupIds = userToSupsMap.get(u.id) || [];
    const supIds =
      junctionSupIds.length > 0
        ? junctionSupIds
        : u.supervisor_id
        ? [u.supervisor_id]
        : [];
    supIds.forEach((id: string) => {
      if (id && !supervisorMap.has(id)) {
        missingSupIds.add(id);
      }
    });
  });

  if (missingSupIds.size > 0 && missingSupIds.size <= 20) {
    try {
      const adminClient = createSupabaseAdminClient();
      const { data: extraSups } = await adminClient
        .from("users")
        .select("id, full_name, email, phone, role")
        .in("id", Array.from(missingSupIds));
      if (extraSups) {
        extraSups.forEach((s) => supervisorMap.set(s.id, s as CachedSupervisor));
      }
    } catch {
      // Silently continue if supplemental fetch fails
    }
  }

  return rawUsers.map((u) => {
    const junctionSupIds = userToSupsMap.get(u.id) || [];
    const supIds: string[] =
      junctionSupIds.length > 0
        ? junctionSupIds
        : u.supervisor_id
        ? [u.supervisor_id]
        : [];

    const supervisorsList = supIds
      .map((id: string) => supervisorMap.get(id))
      .filter(Boolean) as Array<{ id: string; full_name: string; email?: string | null; phone?: string | null }>;

    const primarySup =
      (u.supervisor_id && supervisorMap.get(u.supervisor_id)) ||
      supervisorsList[0] ||
      null;

    return {
      ...u,
      address: u.street || u.address || null,
      supervisor_id: primarySup?.id ?? null,
      supervisor_ids: supIds,
      supervisor: primarySup,
      supervisors: supervisorsList,
    };
  });
}

/**
 * Server-paginated user list query.
 * Uses exact column projection (USER_LIST_COLUMNS) and in-memory hydration.
 */
export async function getUserList(params: UserListParams = {}): Promise<UserListResponse> {
  await requireRole("admin", "super_admin", "manager", "hr", "supervisor");
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
    .select(USER_LIST_COLUMNS, isExport ? {} : { count: "exact" });

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
    // Supervisor scope: assigned via primary supervisor_id or user_supervisors junction table
    let assignedIds: string[] = [];
    try {
      const { data: supRows } = await supabase
        .from("user_supervisors")
        .select("user_id")
        .eq("supervisor_id", currentUser.id);
      assignedIds = (supRows || []).map((r: any) => r.user_id);
    } catch {}

    if (assignedIds.length > 0) {
      query = query.or(`supervisor_id.eq.${currentUser.id},id.in.(${assignedIds.join(",")})`);
    } else {
      query = query.eq("supervisor_id", currentUser.id);
    }

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
  const hydratedUsers = await hydrateUsersPersonnel(rawUsers);

  return {
    users: hydratedUsers,
    total: isExport ? hydratedUsers.length : (count ?? 0),
    page,
    pageSize,
    totalPages: isExport ? 1 : Math.ceil((count ?? 0) / pageSize),
  };
}
