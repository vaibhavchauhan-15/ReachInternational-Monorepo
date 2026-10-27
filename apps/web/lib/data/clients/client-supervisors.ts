import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS, CACHE_TIERS } from "@/lib/cache";
import { CLIENT_KEYS } from "@reachinternational/utils";

export interface ClientSupervisorItem {
  id: string; // client_supervisors.id
  client_id: string;
  supervisor_id: string;
  supervisor_name: string;
  supervisor_email?: string | null;
  supervisor_phone?: string | null;
  assigned_at: string;
  assigned_by?: string | null;
}

export interface CandidateSupervisorItem {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  status: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return UUID_REGEX.test(id.trim());
}

/**
 * Cached getter for supervisors assigned to a specific client.
 */
export function getCachedClientSupervisors(clientId: string) {
  return unstable_cache(
    async (): Promise<ClientSupervisorItem[]> => {
      if (!isValidUuid(clientId)) return [];

      const supabase = createSupabaseAdminClient();
      const { data, error } = await supabase
        .from("client_supervisors")
        .select(`
          id,
          client_id,
          supervisor_id,
          assigned_at,
          assigned_by,
          supervisor:users!client_supervisors_supervisor_id_fkey(id, full_name, email, phone, status)
        `)
        .eq("client_id", clientId)
        .order("assigned_at", { ascending: false });

      if (error) {
        console.error("Error in getClientSupervisors:", error.message);
        return [];
      }

      return (data || []).map((row: any) => {
        const sup = Array.isArray(row.supervisor) ? row.supervisor[0] : row.supervisor;
        return {
          id: row.id,
          client_id: row.client_id,
          supervisor_id: row.supervisor_id,
          supervisor_name: sup?.full_name || "Unknown Supervisor",
          supervisor_email: sup?.email || null,
          supervisor_phone: sup?.phone || null,
          assigned_at: row.assigned_at,
          assigned_by: row.assigned_by,
        };
      });
    },
    [CLIENT_KEYS.detail(clientId), "client_supervisors"],
    {
      revalidate: CACHE_TIERS.CLASS_B_FLEET,
      tags: [TAGS.clientDetail(clientId), TAGS.clients],
    }
  )();
}

export const getClientSupervisors = cache(async (clientId: string): Promise<ClientSupervisorItem[]> => {
  return getCachedClientSupervisors(clientId);
});

/**
 * Returns available active supervisors that can be assigned to a client.
 * If clientId is provided, excludes supervisors already assigned to that client.
 */
export async function getAvailableSupervisors(clientId?: string): Promise<CandidateSupervisorItem[]> {
  const supabase = createSupabaseAdminClient();

  const { data: supervisors, error } = await supabase
    .from("users")
    .select("id, full_name, phone, email, status")
    .eq("role", "supervisor")
    .eq("status", "active")
    .order("full_name", { ascending: true });

  if (error || !supervisors) {
    console.error("Error in getAvailableSupervisors:", error?.message);
    return [];
  }

  if (!clientId || !isValidUuid(clientId)) {
    return supervisors;
  }

  const { data: assigned } = await supabase
    .from("client_supervisors")
    .select("supervisor_id")
    .eq("client_id", clientId);

  const assignedIds = new Set((assigned || []).map((a) => a.supervisor_id));

  return supervisors.filter((s) => !assignedIds.has(s.id));
}

/**
 * Checks whether a supervisor is authorized to access a specific client.
 * Global admin/manager roles always return true.
 */
export async function checkSupervisorClientAccess(clientId: string, userId: string): Promise<boolean> {
  if (!isValidUuid(clientId) || !isValidUuid(userId)) return false;

  const supabase = createSupabaseAdminClient();

  const { data: user } = await supabase
    .from("users")
    .select("role, status")
    .eq("id", userId)
    .single();

  if (!user || user.status !== "active") return false;

  if (["super_admin", "admin", "manager"].includes(user.role)) {
    return true;
  }

  if (user.role !== "supervisor") {
    return false;
  }

  const { data: assignment } = await supabase
    .from("client_supervisors")
    .select("id")
    .eq("client_id", clientId)
    .eq("supervisor_id", userId)
    .maybeSingle();

  return Boolean(assignment?.id);
}
