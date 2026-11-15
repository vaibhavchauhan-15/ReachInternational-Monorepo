import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";
import type { AuditLogWithUser, UserRole } from "@/lib/types/database";

export type AuditTab =
  | "all"
  | "machine"
  | "assignments"
  | "rentals"
  | "employees"
  | "auth"
  | "documents"
  | "others";

export interface AuditLogFilterParams {
  tab?: AuditTab | string;
  search?: string;
  category?: string;
  severity?: string;
  role?: string;
  dateRange?: "all" | "today" | "7days" | "30days" | "custom";
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AuditTabCounts {
  all: number;
  machine: number;
  assignments: number;
  rentals: number;
  employees: number;
  auth: number;
  documents: number;
  others: number;
}

export interface DocumentViewVolumeAlert {
  viewer_id: string;
  viewer_name: string;
  viewer_email: string;
  viewer_role: string;
  view_count: number;
  timeframe_hours: number;
  first_view_at: string;
  last_view_at: string;
}

export interface AuditLogQueryResult {
  logs: AuditLogWithUser[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  tabCounts: AuditTabCounts;
  volumeAlerts?: DocumentViewVolumeAlert[];
}

/** Map legacy category param to modern audit tab */
export function mapCategoryToAuditTab(category?: string): AuditTab {
  if (!category) return "machine";
  if (category === "all") return "all";
  if (category === "machine") return "machine";
  if (category === "assignment") return "assignments";
  if (category === "rental" || category === "client") return "rentals";
  if (category === "employee") return "employees";
  if (category === "auth") return "auth";
  if (category === "document" || category === "documents") return "documents";
  return "others";
}

/**
 * Optimized audit log query with domain-specific tab filtering,
 * server-side indexing, pagination, and RBAC.
 */
export const getAuditLogsFiltered = cache(
  async (params: AuditLogFilterParams = {}): Promise<AuditLogQueryResult> => {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return {
        logs: [],
        totalCount: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
        tabCounts: { all: 0, machine: 0, assignments: 0, rentals: 0, employees: 0, auth: 0, documents: 0, others: 0 },
      };
    }

    // RBAC: restrict access based on role
    const allowedRoles = [
      "super_admin",
      "admin",
      "manager",
      "supervisor",
      "hr",
    ];
    if (!allowedRoles.includes(currentUser.role)) {
      return {
        logs: [],
        totalCount: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
        tabCounts: { all: 0, machine: 0, assignments: 0, rentals: 0, employees: 0, auth: 0, documents: 0, others: 0 },
      };
    }

    const {
      tab: rawTab,
      search = "",
      category,
      severity = "all",
      role = "all",
      dateRange = "all",
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = params;

    // Resolve active tab: explicit tab takes precedence, fallback to category mapping, default to "machine"
    const activeTab: AuditTab =
      (rawTab as AuditTab) ||
      (category ? mapCategoryToAuditTab(category) : "machine");

    const supabase = createSupabaseAdminClient();

    // Select with denormalized fields — zero JOINs for display data
    let query = supabase
      .from("audit_logs")
      .select(
        `id, user_id, action, entity_type, entity_id,
         category, severity,
         metadata, details, before_state, after_state,
         actor_name, actor_role, entity_name,
         ip_address, created_at,
         user:users(id, full_name, email, role)`,
        { count: "exact" }
      );

    // ── Dedicated Domain Tab Filters ──
    if (activeTab === "machine") {
      // Machine creation, edits, deletion, status, and HMR
      query = query
        .or("category.eq.machine,action.ilike.machine.%")
        .not("action", "in", '("machine.assigned_to_client","machine.removed_from_client")');
    } else if (activeTab === "assignments") {
      // Operator & Supervisor machine assignments
      query = query.or(
        "category.eq.assignment,action.ilike.assignment.%,action.ilike.operator.%"
      );
    } else if (activeTab === "rentals") {
      // Machine assigned to client, rented out, dispatched, returned, or client records
      query = query.or(
        "category.in.(rental,client),action.ilike.rental.%,action.ilike.client.%,action.in.(machine.assigned_to_client,machine.removed_from_client)"
      );
    } else if (activeTab === "employees") {
      // Employee created, edited, approved, rejected, deleted, role updated
      query = query
        .or("category.eq.employee,action.ilike.employee.%,action.ilike.user.%")
        .neq("action", "user.signup");
    } else if (activeTab === "auth") {
      // Sign-in, sign-out, failed logins, user registration
      query = query.or("category.eq.auth,action.ilike.auth.%,action.eq.user.signup");
    } else if (activeTab === "documents") {
      // Document views, statutory reveal, approvals, rejections, replacements (DPDP Act compliance)
      query = query.or(
        "category.in.(document,documents),action.ilike.document.%,action.ilike.%.reveal,action.in.(document.view,document.verify,document.reject,document.replace_approve,document.replace_reject,aadhaar.reveal,bank_account.reveal)"
      );
    } else if (activeTab === "others") {
      // Running hour logs, breakdowns, security, system settings, crons
      query = query.or(
        "category.in.(operations,security,system,service,sales),action.ilike.operations.%,action.ilike.security.%,action.ilike.system.%,action.ilike.service.%,action.ilike.sales.%,action.ilike.permission.%"
      );
    }

    // ── Severity Filter (indexed) ──
    if (severity && severity !== "all") {
      query = query.eq("severity", severity);
    }

    // ── Actor Role Filter (indexed) ──
    if (role && role !== "all") {
      if (role === "system") {
        query = query.is("user_id", null);
      } else {
        query = query.eq("actor_role", role);
      }
    }

    // ── Date Filters ──
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

    // ── Search Filter ──
    if (search) {
      const s = search.replace(/[,()"\\\n\r]/g, "").trim();
      if (s) {
        query = query.or(
          `action.ilike.%${s}%,entity_type.ilike.%${s}%,entity_id.ilike.%${s}%,actor_name.ilike.%${s}%,entity_name.ilike.%${s}%`
        );
      }
    }

    // ── RBAC Scope (server-side, in addition to RLS) ──
    if (currentUser.role === "supervisor") {
      // Supervisors see assignment, machine, operations, and auth
      if (activeTab === "all") {
        query = query.or(
          "category.in.(assignment,machine,operations,auth),action.ilike.assignment.%,action.ilike.machine.%,action.ilike.operations.%,action.ilike.auth.%"
        );
      }
    }

    // ── Pagination & Ordering ──
    const fromIndex = (page - 1) * limit;
    const toIndex = fromIndex + limit - 1;

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Fetch tab counts, main filtered data, and 24h document view logs concurrently
    const [countRes, queryRes, volumeRes] = await Promise.all([
      supabase.from("audit_logs").select("action, category"),
      query
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(fromIndex, toIndex),
      supabase
        .from("audit_logs")
        .select("user_id, created_at, actor_name, actor_role, user:users(id, full_name, email, role)")
        .eq("action", "document.view")
        .gte("created_at", twentyFourHoursAgo)
        .order("created_at", { ascending: false }),
    ]);

    // Aggregate counts for all tabs
    let machineCount = 0;
    let assignmentCount = 0;
    let rentalCount = 0;
    let employeeCount = 0;
    let authCount = 0;
    let documentCount = 0;
    let othersCount = 0;

    for (const row of countRes.data || []) {
      const act = (row.action || "").toLowerCase();
      const cat = (row.category || "").toLowerCase();

      if (
        act.startsWith("document.") ||
        act === "aadhaar.reveal" ||
        act === "bank_account.reveal" ||
        cat === "document" ||
        cat === "documents"
      ) {
        documentCount++;
      } else if (
        act === "machine.assigned_to_client" ||
        act === "machine.removed_from_client" ||
        act.startsWith("rental.") ||
        act.startsWith("client.") ||
        cat === "rental" ||
        cat === "client"
      ) {
        rentalCount++;
      } else if (act.startsWith("machine.") || cat === "machine") {
        machineCount++;
      } else if (act.startsWith("assignment.") || act.startsWith("operator.") || cat === "assignment") {
        assignmentCount++;
      } else if (
        ((act.startsWith("employee.") || act.startsWith("user.")) && act !== "user.signup") ||
        cat === "employee"
      ) {
        employeeCount++;
      } else if (act.startsWith("auth.") || act === "user.signup" || cat === "auth") {
        authCount++;
      } else {
        othersCount++;
      }
    }

    const tabCounts: AuditTabCounts = {
      all: (countRes.data || []).length,
      machine: machineCount,
      assignments: assignmentCount,
      rentals: rentalCount,
      employees: employeeCount,
      auth: authCount,
      documents: documentCount,
      others: othersCount,
    };

    // Calculate document view volume alerts (>20 views in 24h by a single viewer)
    interface ViewerVolumeEntry {
      viewer_id: string;
      viewer_name: string;
      viewer_email: string;
      viewer_role: string;
      views: string[];
    }

    const volumeMap = new Map<string, ViewerVolumeEntry>();

    for (const row of (volumeRes.data || []) as any[]) {
      if (!row.user_id) continue;
      const u = row.user;
      const entry: ViewerVolumeEntry = volumeMap.get(row.user_id) || {
        viewer_id: row.user_id,
        viewer_name: row.actor_name || u?.full_name || "Unknown",
        viewer_email: u?.email || "",
        viewer_role: row.actor_role || u?.role || "unknown",
        views: [],
      };
      entry.views.push(row.created_at);
      volumeMap.set(row.user_id, entry);
    }

    const volumeAlerts: DocumentViewVolumeAlert[] = [];
    for (const item of volumeMap.values()) {
      if (item.views.length > 20) {
        volumeAlerts.push({
          viewer_id: item.viewer_id,
          viewer_name: item.viewer_name,
          viewer_email: item.viewer_email,
          viewer_role: item.viewer_role,
          view_count: item.views.length,
          timeframe_hours: 24,
          first_view_at: item.views[item.views.length - 1],
          last_view_at: item.views[0],
        });
      }
    }

    const { data: logs, count, error } = queryRes;

    if (error) {
      console.error("Error fetching audit logs:", error.message || error);
      return { logs: [], totalCount: 0, page, limit, totalPages: 0, tabCounts, volumeAlerts };
    }

    const totalCount = count ?? 0;
    const totalPages = Math.ceil(totalCount / limit);
    let finalLogs = (logs as unknown as AuditLogWithUser[]) ?? [];

    // ── PII Redaction ──
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
      tabCounts,
      volumeAlerts,
    };
  }
);
