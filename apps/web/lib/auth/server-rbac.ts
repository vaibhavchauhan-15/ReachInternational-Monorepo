import "server-only";
import { getCurrentUser } from "@/lib/dal";
import { roleHasPermission } from "@/lib/auth/rbac";

/**
 * Server-only helper: Verify current logged-in user has permission
 */
export async function currentUserHasPermission(permission: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return roleHasPermission(user.role, permission);
}
