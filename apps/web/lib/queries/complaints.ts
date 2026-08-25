import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";
import { CACHE_TAGS } from "@/lib/cache";
import type { ComplaintWithDetails } from "@/lib/types/database";

export interface ComplaintListParams {
  machine_id?: string;
  status?: string;
  engineer_id?: string;
  supervisor_id?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

const getCachedMachineComplaints = unstable_cache(
  async (paramsJSON: string, userRole: string, userId: string) => {
    const params: ComplaintListParams = JSON.parse(paramsJSON);
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from("machine_complaints")
      .select(
        `
        id,
        complaint_no,
        machine_id,
        supervisor_id,
        engineer_id,
        complaint_date,
        end_date,
        location,
        state_name,
        city,
        hour_meter,
        required_part,
        part_quantity,
        complaint,
        work_done,
        pending_work,
        images,
        pdf_report_url,
        checklist_data,
        status,
        created_at,
        updated_at,
        machine:machines(id, model, serial_number, status, health_status),
        supervisor:users!machine_complaints_supervisor_id_fkey(id, full_name, phone, email),
        engineer:users!machine_complaints_engineer_id_fkey(id, full_name, phone, email)
      `,
        { count: "estimated" }
      )
      .order("created_at", { ascending: false });

    if (userRole === "engineer" || userRole === "service_engineer" || userRole === "mechanic") {
      query = query.or(`engineer_id.eq.${userId},supervisor_id.eq.${userId}`);
    } else if (userRole === "supervisor") {
      query = query.or(`supervisor_id.eq.${userId},engineer_id.eq.${userId}`);
    } else if (userRole === "operator") {
      query = query.eq("supervisor_id", userId);
    }

    if (params.machine_id && params.machine_id !== "all") {
      query = query.eq("machine_id", params.machine_id);
    }

    if (params.status && params.status !== "all") {
      query = query.eq("status", params.status);
    }

    if (params.engineer_id && params.engineer_id !== "all") {
      query = query.eq("engineer_id", params.engineer_id);
    }

    if (params.supervisor_id && params.supervisor_id !== "all") {
      query = query.eq("supervisor_id", params.supervisor_id);
    }

    if (params.search) {
      query = query.or(
        `complaint_no.ilike.%${params.search}%,complaint.ilike.%${params.search}%,location.ilike.%${params.search}%`
      );
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 25;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let { data, count, error } = await query.range(from, to);

    // If query fails, handle missing table schema cache gracefully or attempt fallback query
    if (error) {
      const errMsg = String(error.message || error.details || (error as any).hint || error || "");
      const isMissingTable =
        errMsg.includes("Could not find the table") ||
        (error as any).code === "PGRST204" ||
        (error as any).code === "42P01";

      if (isMissingTable) {
        return { complaints: [], total: 0, page, pageSize, totalPages: 0 };
      }

      const fallbackQuery = supabase
        .from("machine_complaints")
        .select("*, machine:machines(*)", { count: "estimated" })
        .order("created_at", { ascending: false });

      const fallbackRes = await fallbackQuery.range(from, to);
      if (!fallbackRes.error) {
        data = fallbackRes.data;
        count = fallbackRes.count;
        error = null;
      } else {
        const fallbackErrMsg = String(fallbackRes.error.message || fallbackRes.error.details || fallbackRes.error || "");
        if (
          !fallbackErrMsg.includes("Could not find the table") &&
          (fallbackRes.error as any).code !== "PGRST204" &&
          (fallbackRes.error as any).code !== "42P01"
        ) {
          console.error("Error fetching machine complaints:", fallbackErrMsg);
        }
      }
    }

    if (error) {
      return { complaints: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const formattedComplaints = (data ?? []).map((c: any) => {
      if (c.machine) {
        const code = c.machine.machine_id || c.machine.machine_code || c.machine.id;
        c.machine = {
          ...c.machine,
          machine_id: code,
          machine_code: code,
          machine_name: c.machine.model ? `${code} (${c.machine.model})` : code,
        };
      }
      return c;
    });

    return {
      complaints: formattedComplaints as unknown as ComplaintWithDetails[],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    };
  },
  ["machine-complaints-list"],
  { revalidate: 60, tags: [CACHE_TAGS.complaints] }
);

export const getMachineComplaints = cache(
  async (params: ComplaintListParams = {}) => {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");
    return getCachedMachineComplaints(JSON.stringify(params), user.role, user.id);
  }
);
