import { Metadata } from "next";
import { getCurrentUser, requireRole } from "@/lib/dal";
import { redirect } from "next/navigation";
import { getClientList, getClientKPIs } from "@/lib/data/clients";
import { ClientsCoordinatorClient } from "@/components/clients/ClientsCoordinatorClient";

export const metadata: Metadata = {
  title: "Client Directory | ReachInternational CRM",
  description: "High-performance enterprise customer directory with real-time fleet overview, tax compliance, and multi-tier responsiveness.",
};

/**
 * C6 — Initial Page Load
 *
 * Target Lifecycle:
 * OPEN /clients
 *      ↓
 * Shell (loading.tsx with ClientsSkeleton)
 *      ↓
 * KPI + First Page of Clients (Concurrent sub-millisecond execution)
 *      ↓
 * Interactive
 *
 * Strictly required on initial load:
 * 1. User authorization (getCurrentUser + requireRole)
 * 2. KPI data (getClientKPIs via scalar RPC)
 * 3. Current status (URL search param or default 'all')
 * 4. Current search (URL search param or default '')
 * 5. First page of clients (getClientList with exact lean projection)
 *
 * Strictly NOT loaded on initial load:
 * - Client details (deferred to ClientDetailDrawer)
 * - Location hierarchy (embedded cities_list in scalar KPI summary, 0 extra DB queries)
 * - Machines (0 machine table queries)
 * - Operators (0 operator queries)
 * - Running logs (0 machine_hour_logs queries)
 * - History / Audit logs (0 audit log queries)
 * - Export libraries (deferred to dynamic chunk)
 */
export default async function ClientsPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // 1. User Authorization
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  await requireRole("super_admin", "admin", "manager");

  // 3 & 4. Current Status & Current Search from URL
  const searchParams = await props.searchParams;
  const page = Math.max(1, parseInt((searchParams?.page as string) || "1", 10));
  const search = ((searchParams?.search as string) || "").trim();
  const status = (searchParams?.status as "all" | "active" | "inactive") || "all";
  const city = (searchParams?.city as string) || "all";
  const rawSort = (searchParams?.sort as string) || "company_name_asc";

  let sortField = "company_name";
  let sortOrder: "asc" | "desc" = "asc";
  if (rawSort === "company_name_desc") {
    sortField = "company_name";
    sortOrder = "desc";
  } else if (rawSort === "code_asc") {
    sortField = "code";
    sortOrder = "asc";
  } else if (rawSort === "code_desc") {
    sortField = "code";
    sortOrder = "desc";
  } else if (rawSort === "created_at_desc" || rawSort === "newest") {
    sortField = "created_at";
    sortOrder = "desc";
  } else if (rawSort === "created_at_asc" || rawSort === "oldest") {
    sortField = "created_at";
    sortOrder = "asc";
  } else if (rawSort === "company_name_asc") {
    sortField = "company_name";
    sortOrder = "asc";
  } else {
    sortField = (searchParams?.sort as string) || "company_name";
    sortOrder = (searchParams?.order as "asc" | "desc") || "asc";
  }

  const parsedPageSize = parseInt((searchParams?.pageSize as string) || "10", 10);
  const pageSize = [10, 25, 50, 100].includes(parsedPageSize) ? parsedPageSize : 10;

  // 2 & 5. Concurrent high-performance queries: KPI data & First page of clients
  const [metrics, paginatedData] = await Promise.all([
    getClientKPIs(),
    getClientList({
      page,
      pageSize,
      search,
      status,
      city,
      sortField,
      sortOrder,
    }),
  ]);

  // Cities are embedded in metrics.cities_list via Migration 071 (0 extra DB queries)
  const availableCities = metrics.cities_list || [];

  return (
    <ClientsCoordinatorClient
      user={user}
      initialClients={paginatedData.clients}
      total={paginatedData.total}
      page={paginatedData.page}
      pageSize={paginatedData.pageSize}
      metrics={metrics}
      availableCities={availableCities}
      currentSort={rawSort}
    />
  );
}
