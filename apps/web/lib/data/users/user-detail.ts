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
  "id, full_name, email, phone, role, status, city, district, state, state_id, aadhaar_number, license_number, street, shift_start_time, shift_end_time, complete_profile, supervisor_id, monthly_salary, daily_rate, ot_hourly_rate, created_at, updated_at";

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

/**
 * Fetches a single user record with relation hydration without admin role check.
 * Used for authenticated user self-profile views (/profile).
 */
export async function getUserDetail(userId: string): Promise<User | null> {
  if (!userId) return null;

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

/**
 * Fetches the user's active pending profile change request (if any).
 */
export async function getMyPendingProfileRequest(userId: string) {
  if (!userId) return null;

  const adminClient = createSupabaseAdminClient();
  const { data, error } = await adminClient
    .from("profile_change_requests")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}
