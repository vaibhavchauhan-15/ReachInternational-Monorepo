import { getCurrentUser, requireRole } from "@/lib/dal";
import { redirect } from "next/navigation";
import { getClients } from "@/lib/queries/clients";
import { ClientsClient } from "@/components/clients/ClientsClient";

export default async function ClientsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  await requireRole("super_admin", "admin", "manager", "service_manager");

  const clients = await getClients(undefined, true);

  return (
    <div className="p-4 sm:p-6">
      <ClientsClient user={user} initialClients={clients} />
    </div>
  );
}
