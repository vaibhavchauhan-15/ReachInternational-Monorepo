import { getCurrentUser } from "@/lib/dal";
import { redirect } from "next/navigation";
import { CrmClient } from "@/components/crm/CrmClient";
import {
  getSalesDashboardMetrics,
  getSalesLeads,
  getSalesCustomers,
  getSalesInteractions,
  getSalesOpportunities,
  getSalesQuotations,
  getSalesOrders,
  getAvailableMachinesForSale,
  getSalesMachineReservations,
  getSalesDeliveryCoordinations,
  getSalesSettings,
} from "@/lib/queries/sales";

export default async function CrmPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const branchId = user.branch_id;

  const [
    metrics,
    leads,
    customers,
    interactions,
    opportunities,
    quotations,
    orders,
    availableMachines,
    reservations,
    deliveries,
    settings,
  ] = await Promise.all([
    getSalesDashboardMetrics(branchId),
    getSalesLeads(branchId),
    getSalesCustomers(branchId),
    getSalesInteractions(),
    getSalesOpportunities(branchId),
    getSalesQuotations(branchId),
    getSalesOrders(branchId),
    getAvailableMachinesForSale(branchId),
    getSalesMachineReservations(branchId),
    getSalesDeliveryCoordinations(branchId),
    getSalesSettings(),
  ]);

  return (
    <CrmClient
      user={user}
      initialMetrics={metrics}
      initialLeads={leads}
      initialCustomers={customers}
      initialInteractions={interactions}
      initialOpportunities={opportunities}
      initialQuotations={quotations}
      initialOrders={orders}
      initialAvailableMachines={availableMachines}
      initialReservations={reservations}
      initialDeliveries={deliveries}
      initialSettings={settings}
    />
  );
}
