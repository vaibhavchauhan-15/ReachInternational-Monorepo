import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface AuditLogParams {
  action: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
  user_id?: string;
}

export async function logAudit({ action, entity_type, entity_id, metadata, user_id }: AuditLogParams) {
  try {
    const supabase = await createSupabaseServerClient();
    let resolvedUserId = user_id;
    if (!resolvedUserId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      resolvedUserId = user?.id;
    }

    await supabase.from("audit_logs").insert({
      user_id: resolvedUserId ?? null,
      action,
      entity_type: entity_type ?? null,
      entity_id: entity_id ?? null,
      metadata: metadata ?? null,
    });
  } catch (error) {
    console.error("Failed to write audit log:", error);
  }
}