import { getCurrentUser, requireRole } from "@/lib/dal";
import { redirect } from "next/navigation";
import { getPaginatedClients, getClientMetrics } from "@/lib/queries/clients";
import { ClientsClient } from "@/components/clients/ClientsClient";

export default async function ClientsPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  await requireRole("super_admin", "admin", "manager", "service_manager");

  const searchParams = await props.searchParams;
  const page = parseInt((searchParams?.page as string) || "1", 10);
  const search = (searchParams?.search as string) || "";
  const statusFilter = (searchParams?.status as "all" | "active" | "inactive") || "all";
  const pageSize = 10;

  const [paginatedData, metrics] = await Promise.all([
    getPaginatedClients({ page, pageSize, search, statusFilter }),
    getClientMetrics()
  ]);

  return (
    <div className="p-4 sm:p-6">
      <ClientsClient 
        user={user} 
        initialClients={paginatedData.clients} 
        total={paginatedData.total}
        page={paginatedData.page}
        pageSize={paginatedData.pageSize}
        metrics={metrics}
      />
    </div>
  );
}
