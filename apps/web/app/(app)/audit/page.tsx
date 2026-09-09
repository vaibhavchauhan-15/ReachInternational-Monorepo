import { redirect } from "next/navigation";
import { getCurrentUser, requirePermission } from "@/lib/dal";
import {
  getAuditLogsFiltered,
  mapCategoryToAuditTab,
  type AuditTab,
} from "@/lib/queries/audit-logs";
import { AuditClient } from "@/components/audit/AuditClient";

export const metadata = {
  title: "Audit Logs | ReachInternational",
  description: "Centralized audit trail of all system activities, security events, and operational changes.",
};

interface AuditSearchParams {
  tab?: AuditTab | string;
  search?: string;
  category?: string;
  severity?: string;
  role?: string;
  dateRange?: "all" | "today" | "7days" | "30days" | "custom";
  startDate?: string;
  endDate?: string;
  cursor?: string;
  page?: string | number;
}

interface AuditPageProps {
  searchParams?: Promise<AuditSearchParams>;
}

export default async function AuditPage({ searchParams }: AuditPageProps) {
  await requirePermission("audit.view");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const params: AuditSearchParams = searchParams ? await searchParams : {};

  // Resolve active tab: explicit tab takes precedence, fallback to category mapping, default to "machine" if no tab/category
  const activeTab: AuditTab =
    (params.tab as AuditTab) ||
    (params.category ? mapCategoryToAuditTab(params.category) : "machine");

  const page = params.page ? Math.max(1, parseInt(String(params.page), 10) || 1) : 1;

  const result = await getAuditLogsFiltered({
    tab: activeTab,
    search: params.search,
    category: params.category,
    severity: params.severity,
    role: params.role,
    dateRange: params.dateRange,
    startDate: params.startDate,
    endDate: params.endDate,
    page,
    limit: 25,
  });

  return (
    <AuditClient
      initialLogs={result.logs}
      totalCount={result.totalCount}
      currentPage={result.page}
      totalPages={result.totalPages}
      tabCounts={result.tabCounts}
      activeTab={activeTab}
      userRole={user.role}
      initialParams={{
        tab: activeTab,
        search: params.search,
        category: params.category,
        severity: params.severity,
        role: params.role,
        dateRange: params.dateRange,
        startDate: params.startDate,
        endDate: params.endDate,
      }}
    />
  );
}
