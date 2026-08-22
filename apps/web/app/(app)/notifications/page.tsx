import { Suspense } from "react";
import { getCurrentUser, protectDisabledRoute } from "@/lib/dal";
import { getNotifications, getNotificationStats } from "@/lib/queries/notifications";
import { NotificationListClient } from "@/components/notifications/NotificationListClient";
import { NotificationsSkeleton } from "@/components/ui";

interface NotificationsPageProps {
  searchParams: Promise<{
    status?: string;
    alert_type?: string;
    search?: string;
    date_from?: string;
    date_to?: string;
    page?: string;
  }>;
}

async function NotificationsContent({ searchParams }: NotificationsPageProps) {
  const user = await getCurrentUser();
  if (!user) return null;
  protectDisabledRoute(user.role);

  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || "1", 10);
  const status = resolvedParams.status || "all";
  const alert_type = resolvedParams.alert_type || "all";
  const search = resolvedParams.search || "";
  const date_from = resolvedParams.date_from || "";
  const date_to = resolvedParams.date_to || "";

  const [notificationData, stats] = await Promise.all([
    getNotifications({
      status,
      alert_type,
      search,
      date_from: date_from || undefined,
      date_to: date_to || undefined,
      page,
      pageSize: 25,
    }),
    getNotificationStats(),
  ]);

  return (
    <NotificationListClient
      notifications={notificationData.notifications}
      total={notificationData.total}
      page={notificationData.page}
      pageSize={notificationData.pageSize}
      totalPages={notificationData.totalPages}
      stats={stats}
      userRole={user.role}
      currentStatus={status}
      currentAlertType={alert_type}
      currentSearch={search}
      currentDateFrom={date_from}
      currentDateTo={date_to}
    />
  );
}

export default function NotificationsPage({ searchParams }: NotificationsPageProps) {
  return (
    <Suspense fallback={<NotificationsSkeleton />}>
      <NotificationsContent searchParams={searchParams} />
    </Suspense>
  );
}
