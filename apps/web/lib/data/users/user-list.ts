import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser, requireRole } from "@/lib/dal";
import type { User, WorkingLocation } from "@/lib/types/database";
import { getISTDateString } from "@reachinternational/utils";
import { SUPERVISOR_VISIBLE_USER_ROLES } from "@reachinternational/permissions";
import { getActiveSupervisorsCached, getActiveWorkingLocationsCached } from "./user-shared";

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
  "id, full_name, email, phone, role, status, city, district, state, state_id, shift_time, supervisor_id, supervisor_ids, working_location_id, created_at, updated_at";

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

/**
 * Hydrates supervisor and working location relations in-memory from cached master lists.
 * Eliminates ad-hoc eager SQL joins and avoids secondary table roundtrips.
 * Reuses the machine-list.ts hydration pattern.
 */
export async function hydrateUsersPersonnel(rawUsers: any[]): Promise<User[]> {
  if (!rawUsers || rawUsers.length === 0) return [];

  const [activeSupervisors, activeLocations] = await Promise.all([
    getActiveSupervisorsCached(),
    getActiveWorkingLocationsCached(),
  ]);

  const supervisorMap = new Map(activeSupervisors.map((s) => [s.id, s]));
  const locationMap = new Map(activeLocations.map((l) => [l.id, l]));

  // Check for any edge-case supervisor IDs not present in the active cache (e.g. inactive supervisors)
  const missingSupIds = new Set<string>();
  rawUsers.forEach((u) => {
    const supIds =
      u.supervisor_ids && u.supervisor_ids.length > 0
        ? u.supervisor_ids
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
        extraSups.forEach((s) => supervisorMap.set(s.id, s as any));
      }
    } catch {
      // Silently continue if supplemental fetch fails
    }
  }

  return rawUsers.map((u) => {
    const supIds: string[] =
      u.supervisor_ids && u.supervisor_ids.length > 0
        ? u.supervisor_ids
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
      supervisor_id: primarySup?.id ?? null,
      supervisor_ids: supIds,
      supervisor: primarySup,
      supervisors: supervisorsList,
      working_location: u.working_location_id ? locationMap.get(u.working_location_id) || null : null,
    };
  });
}

/**
 * Server-paginated user list query.
 * Uses exact column projection (USER_LIST_COLUMNS) and in-memory hydration.
 */
export async function getUserList(params: UserListParams = {}): Promise<UserListResponse> {
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
  const hydratedUsers = await hydrateUsersPersonnel(rawUsers);

  return {
    users: hydratedUsers,
    total: isExport ? hydratedUsers.length : (count ?? 0),
    page,
    pageSize,
    totalPages: isExport ? 1 : Math.ceil((count ?? 0) / pageSize),
  };
}
