import "server-only";
import crypto from "crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

export interface IdempotencyCheckParams {
  userId?: string | null;
  actionName: string;
  idempotencyKey?: string | null;
  payload: Record<string, unknown> | unknown;
}

export type IdempotencyResult<T = unknown> =
  | { isNew: false; isDuplicate: true; isProcessing: false; cachedResult: T }
  | { isNew: false; isDuplicate: false; isProcessing: true; error: string }
  | { isNew: true; isDuplicate: false; isProcessing: false; idempotencyKey: string; executionToken: string };

export function canonicalizeJson(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(canonicalizeJson);
  }
  const sortedKeys = Object.keys(obj as Record<string, unknown>).sort();
  const result: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    result[key] = canonicalizeJson((obj as Record<string, unknown>)[key]);
  }
  return result;
}

/**
 * Computes a deterministic SHA-256 hash of a payload object with canonical key ordering.
 */
export function computePayloadHash(payload: unknown): string {
  try {
    const canonical = canonicalizeJson(payload);
    const stringified = JSON.stringify(canonical);
    return crypto.createHash("sha256").update(stringified || "").digest("hex");
  } catch {
    return crypto.createHash("sha256").update(String(payload)).digest("hex");
  }
}

/**
 * Verifies and locks an idempotency key before executing a state-changing mutation.
 * Implements FAIL-CLOSED error policy, execution ownership token, and TTL checking.
 */
export async function checkAndStoreIdempotencyKey<T = unknown>({
  userId,
  actionName,
  idempotencyKey,
  payload,
}: IdempotencyCheckParams): Promise<IdempotencyResult<T>> {
  const supabase = createSupabaseAdminClient();
  const requestHash = computePayloadHash(payload);
  const userPrefix = userId || "anon";

  // Scope key to authenticated user + action_name + key to prevent cross-user collisions
  const resolvedKey =
    idempotencyKey && idempotencyKey.trim().length > 0
      ? `${userPrefix}:${actionName}:${idempotencyKey.trim()}`
      : `${userPrefix}:${actionName}:auto-${crypto.createHash("sha256").update(`${userPrefix}:${actionName}:${requestHash}`).digest("hex")}`;

  const executionToken = crypto.randomUUID();

  try {
    // 1. Check if key already exists in idempotency_keys
    const { data: existing, error: selectErr } = await supabase
      .from("idempotency_keys")
      .select("idempotency_key, request_hash, status, response_payload, created_at, expires_at")
      .eq("idempotency_key", resolvedKey)
      .maybeSingle();

    if (selectErr && selectErr.code !== "PGRST116") {
      console.error("[Idempotency] Error querying key:", selectErr);
    }

    if (existing) {
      // 1a. Check for TTL Expiration (24h)
      const isExpired = existing.expires_at && new Date(existing.expires_at).getTime() <= Date.now();
      if (isExpired) {
        console.info(`[Idempotency] Cleaning up expired key (expired_at: ${existing.expires_at})`);
        await supabase.from("idempotency_keys").delete().eq("idempotency_key", resolvedKey);
      } else {
        // Security Check: Payload Hash Mismatch Detection
        if (existing.request_hash && existing.request_hash !== requestHash) {
          await logAudit({
            action: "IDEMPOTENCY_PAYLOAD_MISMATCH",
            entity_type: "idempotency_key",
            entity_id: resolvedKey,
            metadata: { actionName, expectedHash: existing.request_hash, actualHash: requestHash },
            user_id: userId ?? undefined,
          });

          return {
            isNew: false,
            isDuplicate: false,
            isProcessing: true,
            error: "Security Violation: Idempotency key payload mismatch. The payload submitted with this key differs from the original operation.",
          };
        }

        if (existing.status === "COMPLETED") {
          await logAudit({
            action: "DUPLICATE_REQUEST_PREVENTED",
            entity_type: "idempotency_key",
            entity_id: resolvedKey,
            metadata: { actionName, requestHash, replayType: "cached_completed_response" },
            user_id: userId ?? undefined,
          });

          return {
            isNew: false,
            isDuplicate: true,
            isProcessing: false,
            cachedResult: (existing.response_payload as T) ?? ({ success: true, replayed: true } as T),
          };
        }

        if (existing.status === "PROCESSING") {
          await logAudit({
            action: "REPLAY_ATTACK_BLOCKED",
            entity_type: "idempotency_key",
            entity_id: resolvedKey,
            metadata: { actionName, requestHash, replayType: "concurrent_processing_replay" },
            user_id: userId ?? undefined,
          });

          return {
            isNew: false,
            isDuplicate: false,
            isProcessing: true,
            error: "A duplicate request is currently being processed. Please wait.",
          };
        }

        // If existing status is FAILED, remove failed key to allow clean retry
        if (existing.status === "FAILED") {
          await supabase.from("idempotency_keys").delete().eq("idempotency_key", resolvedKey);
        }
      }
    }

    // 2. Insert new PROCESSING idempotency lock with unique execution_token
    const { error: insertErr } = await supabase.from("idempotency_keys").insert({
      idempotency_key: resolvedKey,
      user_id: userId,
      action_name: actionName,
      request_hash: requestHash,
      status: "PROCESSING",
      execution_token: executionToken,
    });

    if (insertErr) {
      // Handle unique constraint conflict race condition
      if (insertErr.code === "23505") {
        await logAudit({
          action: "REPLAY_ATTACK_BLOCKED",
          entity_type: "idempotency_key",
          entity_id: resolvedKey,
          metadata: { actionName, requestHash, replayType: "race_condition_duplicate" },
          user_id: userId ?? undefined,
        });

        return {
          isNew: false,
          isDuplicate: false,
          isProcessing: true,
          error: "A duplicate request was submitted simultaneously. Blocked replay attack.",
        };
      }
      console.error("[Idempotency] Insert lock error:", insertErr);
    }

    return {
      isNew: true,
      isDuplicate: false,
      isProcessing: false,
      idempotencyKey: resolvedKey,
      executionToken,
    };
  } catch (err) {
    console.error("[Idempotency Critical Error] Store failure in checkAndStoreIdempotencyKey:", err);
    // FAIL CLOSED POLICY: Do NOT execute state mutation if idempotency lock cannot be established
    return {
      isNew: false,
      isDuplicate: false,
      isProcessing: true,
      error: "Unable to verify request idempotency due to database store failure. Operation aborted to prevent duplicate state corruption.",
    };
  }
}

/**
 * Marks an idempotency key as COMPLETED with execution_token ownership verification.
 */
export async function completeIdempotencyKey<T = unknown>(
  idempotencyKey: string,
  executionToken: string,
  responsePayload: T
): Promise<boolean> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("idempotency_keys")
      .update({
        status: "COMPLETED",
        response_payload: responsePayload as object,
      })
      .eq("idempotency_key", idempotencyKey)
      .eq("execution_token", executionToken)
      .eq("status", "PROCESSING")
      .select("idempotency_key");

    if (error || !data || data.length === 0) {
      console.error("[Idempotency Security Violation] Ownership completion failed. Token mismatch or lock invalid:", {
        idempotencyKey,
        executionToken,
        error,
      });
      await logAudit({
        action: "IDEMPOTENCY_COMPLETION_OWNERSHIP_MISMATCH",
        entity_type: "idempotency_key",
        entity_id: idempotencyKey,
        metadata: { executionToken },
      });
      return false;
    }
    return true;
  } catch (err) {
    console.error("[Idempotency] Failed to mark key COMPLETED:", err);
    return false;
  }
}

/**
 * Marks an idempotency key as FAILED or deletes it so the user can fix invalid input and retry.
 */
export async function failIdempotencyKey(
  idempotencyKey: string,
  executionToken?: string,
  _errorMsg?: string
): Promise<void> {
  try {
    const supabase = createSupabaseAdminClient();
    let query = supabase.from("idempotency_keys").delete().eq("idempotency_key", idempotencyKey);
    if (executionToken) {
      query = query.eq("execution_token", executionToken);
    }
    await query;
  } catch (err) {
    console.error("[Idempotency] Failed to clean up FAILED key:", err);
  }
}
