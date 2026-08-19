import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { roleHasPermission, PERMISSIONS } from "@/lib/auth/rbac";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import type { UserRole } from "@/lib/types/database";

export interface TaskItem {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  urgency: "urgent" | "pending" | "due_today" | "completed";
  dueText: string;
  actionText: string;
  actionHref: string;
  category: "complaint" | "approval" | "service" | "document" | "meter" | "inventory";
  requiredPermission?: string;
}

export interface MyWorkAssignedMachine {
  id: string;
  machine_code: string;
  machine_name: string;
  model: string;
  serial_number: string;
  customer_name: string | null;
  city: string | null;
  state: string | null;
  hour_meter: number;
  status: string;
  next_service_due_date: string | null;
}

export interface MyWorkData {
  tasks: TaskItem[];
  assignedMachines: MyWorkAssignedMachine[];
  metrics: {
    urgentCount: number;
    pendingCount: number;
    dueTodayCount: number;
    completedCount: number;
  };
}

const getCachedMyWorkData = unstable_cache(
  async (userId: string, role: UserRole, branchId?: string | null): Promise<MyWorkData> => {
    const supabase = createSupabaseAdminClient();
    const today = new Date().toISOString().split("T")[0];

    // 1. Fetch Assigned Machines
    let machinesQuery = supabase
      .from("machines")
      .select("id, machine_code, machine_name, model, serial_number, customer_name, city, state, hour_meter, status, next_service_due_date, engineer_id, current_operator_id, branch_id")
      .order("next_service_due_date", { ascending: true })
      .limit(10);

    if (role === "engineer" || role === "service_engineer" || role === "mechanic") {
      machinesQuery = machinesQuery.eq("engineer_id", userId);
    } else if (role === "operator") {
      machinesQuery = machinesQuery.eq("current_operator_id", userId);
    } else if ((role === "branch_manager" || role === "supervisor") && branchId) {
      machinesQuery = machinesQuery.eq("branch_id", branchId);
    }

    const { data: rawMachines } = await machinesQuery;
    const assignedMachines: MyWorkAssignedMachine[] = (rawMachines ?? []).map((m) => ({
      id: m.id,
      machine_code: m.machine_code,
      machine_name: m.machine_name,
      model: m.model,
      serial_number: m.serial_number,
      customer_name: m.customer_name,
      city: m.city,
      state: m.state,
      hour_meter: Number(m.hour_meter || 0),
      status: m.status,
      next_service_due_date: m.next_service_due_date,
    }));

    const rawTasks: TaskItem[] = [];

    // 2. Fetch Assigned Breakdown Complaints
    if (roleHasPermission(role, PERMISSIONS.COMPLAINT_VIEW)) {
      let complaintQuery = supabase
        .from("machine_complaints")
        .select(`
          id,
          complaint_no,
          complaint,
          status,
          created_at,
          city,
          state_name,
          location,
          machine:machines!machine_complaints_machine_id_fkey(machine_code, machine_name, model)
        `)
        .neq("status", "closed")
        .neq("status", "resolved")
        .order("created_at", { ascending: false })
        .limit(10);

      if (role === "engineer" || role === "service_engineer" || role === "mechanic") {
        complaintQuery = complaintQuery.or(`engineer_id.eq.${userId},supervisor_id.eq.${userId}`);
      } else if (role === "supervisor" || role === "branch_manager") {
        if (branchId) {
          complaintQuery = complaintQuery.eq("branch_id", branchId);
        }
      }

      const { data: complaints } = await complaintQuery;
      if (complaints && complaints.length > 0) {
        for (const c of complaints) {
          const machineObj = Array.isArray(c.machine) ? c.machine[0] : c.machine;
          const machineCode = machineObj?.machine_code || "Machine";
          const isUrgent = c.status === "open";
          rawTasks.push({
            id: `cmp-${c.id}`,
            code: c.complaint_no || `CMP-${c.id.slice(0, 6).toUpperCase()}`,
            title: c.complaint || "Breakdown Complaint Resolution",
            subtitle: `${machineCode} • ${c.city || c.state_name || c.location || "On-Site"}`,
            urgency: isUrgent ? "urgent" : c.status === "pending_parts" ? "pending" : "due_today",
            dueText: isUrgent ? "Action Required" : c.status === "pending_parts" ? "Parts Pending" : "In Progress",
            actionText: role === "service_engineer" || role === "mechanic" ? "Open Job" : "View Complaint",
            actionHref: "/service?tab=complaints",
            category: "complaint",
            requiredPermission: PERMISSIONS.COMPLAINT_VIEW,
          });
        }
      }
    }

    // 3. Fetch Assigned Scheduled Services
    if (roleHasPermission(role, PERMISSIONS.SERVICE_VIEW)) {
      let serviceQuery = supabase
        .from("service_records")
        .select(`
          id,
          service_category,
          service_status,
          service_due_date,
          machine:machines!service_records_machine_id_fkey(machine_code, machine_name, customer_name)
        `)
        .neq("service_status", "completed")
        .order("service_due_date", { ascending: true })
        .limit(10);

      if (role === "engineer" || role === "service_engineer" || role === "mechanic") {
        serviceQuery = serviceQuery.eq("engineer_id", userId);
      }

      const { data: services } = await serviceQuery;
      if (services && services.length > 0) {
        for (const s of services) {
          const machineObj = Array.isArray(s.machine) ? s.machine[0] : s.machine;
          const dueDate = s.service_due_date || today;
          const isOverdue = dueDate < today;
          const isToday = dueDate === today;
          rawTasks.push({
            id: `srv-${s.id}`,
            code: `SRV-${s.id.slice(0, 6).toUpperCase()}`,
            title: `${s.service_category || "Preventive Maintenance"} Service`,
            subtitle: `Machine: ${machineObj?.machine_code || "Equipment"} • ${machineObj?.customer_name || "Assigned Customer"}`,
            urgency: isOverdue ? "urgent" : isToday ? "due_today" : "pending",
            dueText: isOverdue ? "Overdue" : isToday ? "Scheduled Today" : `Due ${dueDate}`,
            actionText: "Fill FSR Report",
            actionHref: "/service?tab=schedule",
            category: "service",
            requiredPermission: PERMISSIONS.SERVICE_VIEW,
          });
        }
      }
    }

    // 4. Fetch Role-Specific Approval Work Items
    if ((role === "store_manager" || role === "branch_manager" || role === "admin" || role === "super_admin") && roleHasPermission(role, PERMISSIONS.PO_VIEW)) {
      let poQuery = supabase
        .from("purchase_orders")
        .select("id, po_number, vendor_name, amount, status, created_at")
        .eq("status", "pending_approval")
        .limit(5);

      if (branchId && (role === "store_manager" || role === "branch_manager")) {
        poQuery = poQuery.eq("branch_id", branchId);
      }

      const { data: pos } = await poQuery;
      if (pos && pos.length > 0) {
        for (const po of pos) {
          rawTasks.push({
            id: `po-${po.id}`,
            code: po.po_number || `PO-${po.id.slice(0, 6).toUpperCase()}`,
            title: "Spare Parts PO Approval",
            subtitle: `Vendor: ${po.vendor_name || "Supplier"} • ₹${Number(po.amount || 0).toLocaleString("en-IN")}`,
            urgency: "pending",
            dueText: "Approval Required",
            actionText: "Review PO",
            actionHref: "/purchase-orders",
            category: "approval",
            requiredPermission: PERMISSIONS.PO_VIEW,
          });
        }
      }
    }

    // 5. Operator Specific Daily Meter Log Task
    if (role === "operator" && assignedMachines.length > 0) {
      const primaryMachine = assignedMachines[0];
      rawTasks.push({
        id: `op-meter-${primaryMachine.id}`,
        code: `MTR-${today}`,
        title: "Daily Shift & Meter Reading Log",
        subtitle: `Equipment: ${primaryMachine.machine_code} • Current: ${primaryMachine.hour_meter} hrs`,
        urgency: "due_today",
        dueText: "Action Required Today",
        actionText: "Enter Meter",
        actionHref: "/dashboard",
        category: "meter",
        requiredPermission: PERMISSIONS.OPERATOR_LOG_CREATE,
      });
    }

    // Filter tasks strictly by permissions & role
    const validTasks = rawTasks.filter((t) => {
      if (t.requiredPermission && !roleHasPermission(role, t.requiredPermission)) {
        return false;
      }
      return true;
    });

    // Compute Completed Count Today
    let completedCount = 0;
    let completedSrQuery = supabase
      .from("service_records")
      .select("id", { count: "exact", head: true })
      .eq("service_date", today);

    if (role === "engineer" || role === "service_engineer" || role === "mechanic") {
      completedSrQuery = completedSrQuery.eq("engineer_id", userId);
    }
    const { count } = await completedSrQuery;
    completedCount = count || 0;

    const urgentCount = validTasks.filter((t) => t.urgency === "urgent").length;
    const pendingCount = validTasks.filter((t) => t.urgency === "pending").length;
    const dueTodayCount = validTasks.filter((t) => t.urgency === "due_today").length;

    return {
      tasks: validTasks,
      assignedMachines,
      metrics: {
        urgentCount,
        pendingCount,
        dueTodayCount,
        completedCount,
      },
    };
  },
  ["my-work-data-v2"],
  { revalidate: CACHE_TIERS.CLASS_C_OPERATIONAL, tags: [TAGS.dashboardKpis, TAGS.services] }
);

export const getMyWorkData = cache(
  async (userId: string, role: UserRole, branchId?: string | null): Promise<MyWorkData> => {
    return getCachedMyWorkData(userId, role, branchId);
  }
);
