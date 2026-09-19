import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/dal";
import type { User } from "@/lib/types/database";
import { hydrateUsersPersonnel } from "./user-list";

/**
 * Complete column projection for single user view, edit modal, and detailed inspect drawer.
 * Includes sensitive and heavy fields: aadhaar_number, license_number, address, shift details.
 */
export const USER_DETAIL_COLUMNS =
  "id, full_name, email, phone, role, status, city, district, state, state_id, aadhaar_number, license_number, address, shift_time, shift_start_time, shift_end_time, complete_profile, supervisor_id, supervisor_ids, working_location_id, created_at, updated_at";

/**
 * Fetches a single user by ID with full column projection and in-memory relation hydration.
 * Used on-demand when opening UserDetailSheet or UserEditModal.
 */
export async function getUserById(userId: string): Promise<User | null> {
  if (!userId) return null;
  await requireRole("admin", "super_admin", "manager", "hr", "supervisor");

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("users")
    .select(USER_DETAIL_COLUMNS)
    .eq("id", userId)
    .single();

  if (error || !data) {
    return null;
  }

  const hydrated = await hydrateUsersPersonnel([data]);
  return hydrated[0] || null;
}
