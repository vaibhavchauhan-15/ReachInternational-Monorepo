import { redirect } from "next/navigation";
import { getCurrentUser, protectDisabledRoute } from "@/lib/dal";
import { roleHasPermission } from "@/lib/auth/rbac";
import { getMachines } from "@/lib/queries/machines";
import {
  getRentalDashboardKpis,
  getRentalRequests,
  getRentalCustomers,
  getRentalAgreements,
  getRentalChallans,
  getRentalReturnInspections,
  getRentalDamageReports,
  getRentalBillingRequests,
} from "@/lib/queries/rentals";
import { RentalManagementClient } from "@/components/rentals/RentalManagementClient";

export const metadata = {
  title: "Rental Operations & Fleet Management — Reach International",
  description: "Complete machine-rental lifecycle: enquiries, customer agreements, machine dispatches, delivery challans, return inspections, damage reports, and operational billing.",
};

export default async function RentalsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  protectDisabledRoute(user.role);

  if (!roleHasPermission(user.role, "rental.view")) {
    redirect("/dashboard");
  }

  const [
    kpis,
    requests,
    customers,
    agreements,
    challans,
    inspections,
    damageReports,
    billingRequests,
    machines,
  ] = await Promise.all([
    getRentalDashboardKpis(),
    getRentalRequests(),
    getRentalCustomers(),
    getRentalAgreements(),
    getRentalChallans(),
    getRentalReturnInspections(),
    getRentalDamageReports(),
    getRentalBillingRequests(),
    getMachines(),
  ]);

  return (
    <RentalManagementClient
      user={user}
      initialKpis={kpis}
      initialRequests={requests}
      initialCustomers={customers}
      initialAgreements={agreements}
      initialChallans={challans}
      initialInspections={inspections}
      initialDamageReports={damageReports}
      initialBillingRequests={billingRequests}
      machines={machines?.machines || []}
    />
  );
}
