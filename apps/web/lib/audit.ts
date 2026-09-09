import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuditCategory, AuditSeverity } from "@reachinternational/types";
import { deriveAuditCategory, deriveAuditSeverity } from "@reachinternational/types";

interface AuditLogParams {
  action: string;
  entity_type?: string;
  entity_id?: string;
  metadata?: Record<string, unknown>;
  details?: Record<string, unknown>;
  user_id?: string;
  category?: AuditCategory;
  severity?: AuditSeverity;
  before_state?: Record<string, unknown>;
  after_state?: Record<string, unknown>;
  actor_name?: string;
  actor_role?: string;
  entity_name?: string;
  ip_address?: string;
}

/**
 * Centralized audit logging utility.
 *
 * Inserts a structured, immutable audit record into `public.audit_logs`.
 * Auto-derives `category` from action prefix and `severity` from action keywords
 * when not explicitly provided. Resolves `actor_name` and `actor_role` from the
 * current session when not supplied.
 *
 * This function is fire-and-forget by design — audit failures MUST NOT block
 * business operations. Errors are logged to console.error.
 */
export async function logAudit({
  action,
  entity_type,
  entity_id,
  metadata,
  details,
  user_id,
  category,
  severity,
  before_state,
  after_state,
  actor_name,
  actor_role,
  entity_name,
  ip_address,
}: AuditLogParams) {
  try {
    const supabase = await createSupabaseServerClient();

    // Resolve actor from session if not explicitly provided
    let resolvedUserId = user_id;
    let resolvedActorName = actor_name;
    let resolvedActorRole = actor_role;

    if (!resolvedUserId || !resolvedActorName) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!resolvedUserId) resolvedUserId = user?.id;

      // Fetch display name and role for denormalization
      if (user?.id && (!resolvedActorName || !resolvedActorRole)) {
        const { data: profile } = await supabase
          .from("users")
          .select("full_name, role")
          .eq("id", user.id)
          .single();

        if (profile) {
          if (!resolvedActorName) resolvedActorName = profile.full_name;
          if (!resolvedActorRole) resolvedActorRole = profile.role;
        }
      }
    }

    // Auto-derive category and severity from action if not provided
    const resolvedCategory = category ?? deriveAuditCategory(action);
    const resolvedSeverity = severity ?? deriveAuditSeverity(action);

    await supabase.from("audit_logs").insert({
      user_id: resolvedUserId ?? null,
      action,
      entity_type: entity_type ?? null,
      entity_id: entity_id ?? null,
      category: resolvedCategory,
      severity: resolvedSeverity,
      metadata: metadata ?? null,
      details: details ?? null,
      before_state: before_state ?? null,
      after_state: after_state ?? null,
      actor_name: resolvedActorName ?? null,
      actor_role: resolvedActorRole ?? null,
      entity_name: entity_name ?? null,
      ip_address: ip_address ?? null,
    });
  } catch (error) {
    // Audit failures must never crash the application
    console.error("Failed to write audit log:", error);
  }
}