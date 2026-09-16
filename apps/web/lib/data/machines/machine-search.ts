import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";

export interface MachineSearchResult {
  id: string;
  machine_id: string;
  model: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  status: string;
  health_status: string;
  client?: {
    id: string;
    code: string;
    company_name: string;
  } | null;
}

export interface MachineSearchOptions {
  limit?: number;
  status?: string;
  health_status?: string;
}

/**
 * Fast full-fleet search using PostgreSQL GIN trigram indexes.
 * Selects only the essential identification columns needed for comboboxes,
 * autocompletion, and search drawers.
 */
export const searchMachines = cache(
  async (query: string, options?: MachineSearchOptions): Promise<MachineSearchResult[]> => {
    const user = await getCurrentUser();
    if (!user) throw new Error("Unauthorized");

    const trimmed = (query || "").trim().replace(/[,()"\\]/g, "");
    if (!trimmed) return [];

    const supabase = createSupabaseAdminClient();
    const limit = Math.min(Math.max(1, options?.limit || 20), 50);

    let dbQuery = supabase
      .from("machines")
      .select(`
        id,
        machine_id,
        model,
        serial_number,
        manufacturer,
        status,
        health_status,
        client:clients!machines_client_id_fkey(id, code, company_name)
      `)
      .or(
        `machine_id.ilike.%${trimmed}%,model.ilike.%${trimmed}%,serial_number.ilike.%${trimmed}%,manufacturer.ilike.%${trimmed}%`
      )
      .limit(limit);

    // Apply role scoping
    if (user.role === "operator") {
      dbQuery = dbQuery.or(`current_operator_id.eq.${user.id},operator_ids.cs.{${user.id}}`);
    } else if (user.role === "supervisor") {
      dbQuery = dbQuery.or(`current_supervisor_id.eq.${user.id},supervisor_ids.cs.{${user.id}}`);
    }

    if (options?.status && options.status !== "all") {
      dbQuery = dbQuery.eq("status", options.status);
    }
    if (options?.health_status && options.health_status !== "all") {
      dbQuery = dbQuery.eq("health_status", options.health_status);
    }

    const { data, error } = await dbQuery;

    if (error) {
      console.error("Error executing machine search:", error.message || error);
      return [];
    }

    return (data || []).map((m: any) => ({
      id: m.id,
      machine_id: m.machine_id || m.id,
      model: m.model,
      serial_number: m.serial_number,
      manufacturer: m.manufacturer,
      status: m.status,
      health_status: m.health_status,
      client: m.client || null,
    }));
  }
);
