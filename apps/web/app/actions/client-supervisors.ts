"use server";

import { revalidateTag, revalidatePath } from "next/cache";
import { getCurrentUser, requireRole } from "@/lib/dal";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TAGS } from "@/lib/cache";
import {
  AssignClientSupervisorSchema,
  RemoveClientSupervisorSchema,
} from "@reachinternational/validation";
import {
  getClientSupervisors,
  getAvailableSupervisors,
  type CandidateSupervisorItem,
  type ClientSupervisorItem,
} from "@/lib/data/clients";

export interface ClientSupervisorActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

export async function assignClientSupervisorAction(payload: {
  clientId: string;
  supervisorId: string;
}): Promise<ClientSupervisorActionResult<ClientSupervisorItem>> {
  try {
    const caller = await requireRole("super_admin", "admin", "manager");

    const parsed = AssignClientSupervisorSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid assignment data.",
        code: "VALIDATION_ERROR",
      };
    }

    const supabase = createSupabaseAdminClient();
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "assign_client_supervisor_atomic",
      {
        p_client_id: parsed.data.clientId,
        p_supervisor_id: parsed.data.supervisorId,
        p_assigned_by: caller.id,
      }
    );

    if (rpcError) {
      return {
        success: false,
        error: rpcError.message || "Failed to assign supervisor to client.",
        code: rpcError.code,
      };
    }

    if (rpcResult && !rpcResult.success) {
      return {
        success: false,
        error: rpcResult.error || "Failed to assign supervisor.",
        code: rpcResult.code,
      };
    }

    // Invalidate client caches
    revalidateTag(TAGS.clientDetail(parsed.data.clientId), "max");
    revalidateTag(TAGS.clients, "max");
    revalidateTag(TAGS.machines, "max");
    revalidatePath(`/clients/${parsed.data.clientId}`);

    // Fetch full supervisor details for client-side state update
    const { data: userRecord } = await supabase
      .from("users")
      .select("id, full_name, email, phone")
      .eq("id", parsed.data.supervisorId)
      .single();

    const clientSupervisor: ClientSupervisorItem = {
      id: rpcResult.id || "",
      client_id: parsed.data.clientId,
      supervisor_id: parsed.data.supervisorId,
      supervisor_name: userRecord?.full_name || rpcResult.supervisor_name || "Supervisor",
      supervisor_email: userRecord?.email || null,
      supervisor_phone: userRecord?.phone || null,
      assigned_at: new Date().toISOString(),
      assigned_by: caller.id,
    };

    return {
      success: true,
      data: clientSupervisor,
    };
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes("NEXT_REDIRECT") || err.name === "NEXT_REDIRECT")) {
      throw err;
    }
    const message = err instanceof Error ? err.message : "Failed to assign supervisor.";
    return { success: false, error: message };
  }
}

export async function removeClientSupervisorAction(payload: {
  clientId: string;
  supervisorId: string;
}): Promise<ClientSupervisorActionResult<{ success: boolean }>> {
  try {
    const caller = await requireRole("super_admin", "admin", "manager");

    const parsed = RemoveClientSupervisorSchema.safeParse(payload);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message || "Invalid removal data.",
        code: "VALIDATION_ERROR",
      };
    }

    const supabase = createSupabaseAdminClient();
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "remove_client_supervisor_atomic",
      {
        p_client_id: parsed.data.clientId,
        p_supervisor_id: parsed.data.supervisorId,
        p_removed_by: caller.id,
      }
    );

    if (rpcError) {
      return {
        success: false,
        error: rpcError.message || "Failed to remove supervisor.",
        code: rpcError.code,
      };
    }

    if (rpcResult && !rpcResult.success) {
      return {
        success: false,
        error: rpcResult.error || "Failed to remove supervisor.",
        code: rpcResult.code,
      };
    }

    revalidateTag(TAGS.clientDetail(parsed.data.clientId), "max");
    revalidateTag(TAGS.clients, "max");
    revalidateTag(TAGS.machines, "max");
    revalidatePath(`/clients/${parsed.data.clientId}`);

    return {
      success: true,
      data: { success: true },
    };
  } catch (err: unknown) {
    if (err instanceof Error && (err.message.includes("NEXT_REDIRECT") || err.name === "NEXT_REDIRECT")) {
      throw err;
    }
    const message = err instanceof Error ? err.message : "Failed to remove supervisor.";
    return { success: false, error: message };
  }
}

export async function getAvailableSupervisorsAction(clientId?: string): Promise<CandidateSupervisorItem[]> {
  try {
    await requireRole("super_admin", "admin", "manager");
    return getAvailableSupervisors(clientId);
  } catch {
    return [];
  }
}

export async function getClientSupervisorsAction(clientId: string): Promise<ClientSupervisorItem[]> {
  try {
    await requireRole("super_admin", "admin", "manager", "supervisor");
    return getClientSupervisors(clientId);
  } catch {
    return [];
  }
}
