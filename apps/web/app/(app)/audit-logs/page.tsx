import { redirect } from "next/navigation";
import { getCurrentUser, protectDisabledRoute } from "@/lib/dal";
import { getAuditLogsFiltered } from "@/lib/queries/audit-logs";
import { AuditLogsClient } from "@/components/audit-logs/AuditLogsClient";

interface AuditLogsPageProps {
  searchParams: Promise<{
    search?: string;
    role?: string;
    dateRange?: "all" | "today" | "7days" | "30days" | "custom";
    startDate?: string;
    endDate?: string;
    page?: string;
  }>;
}

export default async function AuditLogsPage({ searchParams }: AuditLogsPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  protectDisabledRoute(user.role);

  const params = await searchParams;
  const page = params.page ? parseInt(params.page, 10) : 1;

  const result = await getAuditLogsFiltered({
    search: params.search,
    role: params.role,
    dateRange: params.dateRange,
    startDate: params.startDate,
    endDate: params.endDate,
    page: isNaN(page) ? 1 : page,
    limit: 20,
  });

  return (
    <AuditLogsClient
      initialLogs={result.logs}
      totalCount={result.totalCount}
      currentPage={result.page}
      totalPages={result.totalPages}
      initialParams={{
        search: params.search,
        role: params.role,
        dateRange: params.dateRange,
        startDate: params.startDate,
        endDate: params.endDate,
      }}
    />
  );
}
