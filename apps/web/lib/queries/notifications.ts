import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";
import { CACHE_TAGS } from "@/lib/cache";
import type { NotificationWithDetails, UserRole } from "@/lib/types/database";

export interface NotificationListParams {
  status?: string;
  alert_type?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  pageSize?: number;
}

export interface NotificationStats {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  sentToday: number;
  failedToday: number;
}

const DEFAULT_STATS: NotificationStats = {
  total: 0,
  sent: 0,
  failed: 0,
  pending: 0,
  sentToday: 0,
  failedToday: 0,
};

// Top-level cached notification stats using stateless admin client.
// Passing (userId, role) scopes the cache entry per user — no cross-user leakage.
const getCachedNotificationStats = unstable_cache(
  async (userId: string, role: UserRole): Promise<NotificationStats> => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.rpc("get_notification_stats", {
      p_user_id: userId,
      p_role: role,
    });
    if (!error && data) {
      return (data as NotificationStats) ?? DEFAULT_STATS;
    }

    const today = new Date().toISOString().split("T")[0];
    let query = supabase.from("notifications").select("status, alert_date");
    if (role === "engineer" || role === "service_engineer" || role === "mechanic") {
      query = query.eq("recipient_id", userId);
    }
    const { data: list } = await query;
    const notifs = list ?? [];

    return {
      total: notifs.length,
      sent: notifs.filter((n) => n.status === "sent").length,
      failed: notifs.filter((n) => n.status === "failed").length,
      pending: notifs.filter((n) => n.status === "pending").length,
      sentToday: notifs.filter((n) => n.status === "sent" && n.alert_date === today).length,
      failedToday: notifs.filter((n) => n.status === "failed" && n.alert_date === today).length,
    };
  },
  ["notification-stats"],
  {
    revalidate: 60,
    tags: [CACHE_TAGS.notifications],
  }
);

export const getNotificationStats = cache(async (): Promise<NotificationStats> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return getCachedNotificationStats(user.id, user.role);
});

export async function getNotifications(params: NotificationListParams = {}) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  const supabase = await createSupabaseServerClient();

  const {
    status,
    alert_type,
    search,
    date_from,
    date_to,
    page = 1,
    pageSize = 25,
  } = params;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("notifications")
    .select(
      `
      id,
      alert_type,
      alert_date,
      channel,
      status,
      sent_at,
      created_at,
      error_message,
      whatsapp_message_id,
      email_message_id,
      payload,
      provider_response,
      machine:machines(id, model, serial_number),
      recipient:users!notifications_recipient_id_fkey(id, full_name, phone, email)
    `,
      { count: "estimated" }
    );

  if (user.role === "engineer" || user.role === "service_engineer" || user.role === "mechanic") {
    query = query.eq("recipient_id", user.id);
  }

  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (alert_type && alert_type !== "all") {
    query = query.eq("alert_type", alert_type);
  }

  if (search) {
    query = query.or(
      `error_message.ilike.%${search}%,whatsapp_message_id.ilike.%${search}%,email_message_id.ilike.%${search}%,machine.model.ilike.%${search}%,recipient.email.ilike.%${search}%,recipient.full_name.ilike.%${search}%`
    );
  }

  if (date_from) {
    query = query.gte("alert_date", date_from);
  }
  if (date_to) {
    query = query.lte("alert_date", date_to);
  }

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, count, error } = await query;

  if (error) throw new Error(error.message);

  return {
    notifications: (data as unknown as NotificationWithDetails[]) ?? [],
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}
