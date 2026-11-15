import "server-only";
import { type SupabaseClient } from "@supabase/supabase-js";
import { canViewDocument, type DocumentViewerSubject } from "@reachinternational/permissions";

/**
 * Checks whether targetUserId is a supervised team member of viewerId.
 */
export async function checkIsTeamMember(
  supabase: SupabaseClient<any, any, any>,
  viewerId: string,
  targetUserId: string
): Promise<boolean> {
  if (!viewerId || !targetUserId) return false;
  if (viewerId === targetUserId) return true;

  try {
    // 1. Direct supervisor_id check on target user
    const { data: userRow } = await supabase
      .from("users")
      .select("supervisor_id")
      .eq("id", targetUserId)
      .maybeSingle();

    if (userRow?.supervisor_id === viewerId) {
      return true;
    }

    // 2. user_supervisors junction table check
    const { data: junctionRow } = await supabase
      .from("user_supervisors")
      .select("user_id")
      .eq("user_id", targetUserId)
      .eq("supervisor_id", viewerId)
      .maybeSingle();

    if (junctionRow) {
      return true;
    }
  } catch (err) {
    console.error("[checkIsTeamMember] Error querying team relations:", err);
  }

  return false;
}

/**
 * Evaluates whether viewer is authorized to view target user's documents.
 */
export async function verifyDocumentViewerAuthorization(
  supabase: SupabaseClient<any, any, any>,
  viewer: DocumentViewerSubject,
  targetUserId: string,
  docType?: string
): Promise<{ authorized: boolean; isTeamMember: boolean; restrictedToLicense: boolean }> {
  const isTeamMember = await checkIsTeamMember(supabase, viewer.id, targetUserId);
  const normalizedRole = (viewer.role || "").toLowerCase().trim().replace(/[\s-]/g, "_");

  const authorized = canViewDocument(
    viewer,
    { id: targetUserId },
    docType,
    { isTeamMember }
  );

  const restrictedToLicense =
    ["manager", "supervisor"].includes(normalizedRole) && viewer.id !== targetUserId;

  return {
    authorized,
    isTeamMember,
    restrictedToLicense,
  };
}
