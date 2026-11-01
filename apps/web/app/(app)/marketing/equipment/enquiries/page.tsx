import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import {
  getEquipmentAdminSummary,
  getEquipmentEnquiriesList,
} from "@/lib/data/equipment-admin";
import { EquipmentAdminNavTabs } from "@/components/equipment-admin/EquipmentAdminNavTabs";
import { EquipmentAdminKpiStrip } from "@/components/equipment-admin/EquipmentAdminKpiStrip";
import { EquipmentEnquiriesTableClient } from "@/components/equipment-admin/EquipmentEnquiriesTableClient";

interface EnquiriesPageProps {
  searchParams: Promise<{
    status?: string;
    page?: string;
    pageSize?: string;
  }>;
}

export default async function EquipmentEnquiriesPage({ searchParams }: EnquiriesPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowedRoles = ["super_admin", "admin", "manager"];
  if (!allowedRoles.includes(user.role)) {
    redirect("/dashboard");
  }

  const resolved = await searchParams;
  const status = resolved.status || "all";
  const page = parseInt(resolved.page || "1", 10);
  const pageSize = parseInt(resolved.pageSize || "20", 10);

  const [summary, enquiriesData] = await Promise.all([
    getEquipmentAdminSummary(),
    getEquipmentEnquiriesList({ status, page, pageSize }),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">
            Equipment Quotation Enquiries
          </h1>
          <p className="text-xs text-[var(--color-mute)] mt-0.5">
            Review and track prospective machine hire and purchase requests submitted by industrial clients.
          </p>
        </div>

        <EquipmentAdminNavTabs
          totalModels={summary.total_models}
          totalEnquiries={summary.total_enquiries}
          newEnquiries={summary.new_enquiries}
        />
      </div>

      <EquipmentAdminKpiStrip summary={summary} />

      {/* Enquiries Table */}
      <EquipmentEnquiriesTableClient
        enquiries={enquiriesData.enquiries}
        total={enquiriesData.total}
        currentStatus={status}
      />
    </div>
  );
}
