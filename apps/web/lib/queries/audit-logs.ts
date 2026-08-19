import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";
import type { AuditLogWithUser, UserRole } from "@/lib/types/database";

export interface AuditLogFilterParams {
  search?: string;
  role?: string;
  dateRange?: "all" | "today" | "7days" | "30days" | "custom";
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogQueryResult {
  logs: AuditLogWithUser[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const getAuditLogsFiltered = cache(
  async (params: AuditLogFilterParams = {}): Promise<AuditLogQueryResult> => {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.role !== "super_admin" && currentUser.role !== "admin")) {
      return { logs: [], totalCount: 0, page: 1, limit: 20, totalPages: 0 };
    }

    const {
      search = "",
      role = "all",
      dateRange = "all",
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = params;

    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from("audit_logs")
      .select(
        "id, user_id, action, entity_type, entity_id, metadata, created_at, user:users(id, full_name, email, role)",
        { count: "exact" }
      );

    // Apply Role Filter
    if (role && role !== "all") {
      if (role === "system") {
        query = query.is("user_id", null);
      } else {
        const { data: matchingUsers } = await supabase
          .from("users")
          .select("id")
          .eq("role", role as UserRole);

        const matchingIds = matchingUsers?.map((u) => u.id) ?? [];
        if (matchingIds.length > 0) {
          query = query.in("user_id", matchingIds);
        } else {
          return { logs: [], totalCount: 0, page, limit, totalPages: 0 };
        }
      }
    }

    // Apply Date Filters
    const now = new Date();
    if (dateRange === "today") {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      query = query.gte("created_at", todayStart);
    } else if (dateRange === "7days") {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
      query = query.gte("created_at", sevenDaysAgo);
    } else if (dateRange === "30days") {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
      query = query.gte("created_at", thirtyDaysAgo);
    } else if (dateRange === "custom") {
      if (startDate) {
        query = query.gte("created_at", new Date(startDate).toISOString());
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        query = query.lte("created_at", endDateTime.toISOString());
      }
    }

    // Apply Search Filter (action, entity_type, entity_id)
    if (search.trim()) {
      const s = search.trim();
      query = query.or(`action.ilike.%${s}%,entity_type.ilike.%${s}%,entity_id.ilike.%${s}%`);
    }

    // Pagination & Ordering
    const fromIndex = (page - 1) * limit;
    const toIndex = fromIndex + limit - 1;

    const { data: logs, count, error } = await query
      .order("created_at", { ascending: false })
      .range(fromIndex, toIndex);

    if (error) {
      console.error("Error fetching audit logs:", error);
      return { logs: [], totalCount: 0, page, limit, totalPages: 0 };
    }

    const totalCount = count ?? 0;
    const totalPages = Math.ceil(totalCount / limit);
    let finalLogs = (logs as unknown as AuditLogWithUser[]) ?? [];

    // Redact super_admin emails if current viewer is an admin (not super_admin)
    if (currentUser.role !== "super_admin") {
      const { data: superAdmins } = await supabase
        .from("users")
        .select("email")
        .eq("role", "super_admin");

      const superAdminEmails = new Set(
        (superAdmins || [])
          .map((u) => u.email?.toLowerCase())
          .filter((e): e is string => Boolean(e))
      );

      finalLogs = finalLogs.map((log) => {
        const isSuperAdminActor = log.user?.role === "super_admin";
        const userCopy = log.user
          ? {
              ...log.user,
              email: isSuperAdminActor ? "[Hidden]" : log.user.email,
            }
          : log.user;

        let metadataCopy = log.metadata ? { ...log.metadata } : null;
        if (metadataCopy) {
          const sanitizedMeta: Record<string, unknown> = {};
          for (const [key, val] of Object.entries(metadataCopy)) {
            if (typeof val === "string" && superAdminEmails.has(val.toLowerCase())) {
              sanitizedMeta[key] = "[Hidden]";
            } else {
              sanitizedMeta[key] = val;
            }
          }
          metadataCopy = sanitizedMeta;
        }

        return {
          ...log,
          user: userCopy,
          metadata: metadataCopy,
        };
      });
    }

    return {
      logs: finalLogs,
      totalCount,
      page,
      limit,
      totalPages,
    };
  }
);

