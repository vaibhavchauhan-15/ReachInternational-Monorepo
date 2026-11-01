import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import {
  getEquipmentAdminSummary,
  getEquipmentAdminList,
  getEquipmentFilterOptions,
} from "@/lib/data/equipment-admin";
import { EquipmentAdminNavTabs } from "@/components/equipment-admin/EquipmentAdminNavTabs";
import { EquipmentAdminKpiStrip } from "@/components/equipment-admin/EquipmentAdminKpiStrip";
import { EquipmentAdminTableClient } from "@/components/equipment-admin/EquipmentAdminTableClient";
import type { PowerType } from "@reachinternational/types";

interface EquipmentPageProps {
  searchParams: Promise<{
    status?: string;
    category_id?: string;
    brand_id?: string;
    power?: string;
    search?: string;
    sort?: string;
    page?: string;
    pageSize?: string;
  }>;
}

export default async function EquipmentAdminListPage({ searchParams }: EquipmentPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowedRoles = ["super_admin", "admin", "manager"];
  if (!allowedRoles.includes(user.role)) {
    redirect("/dashboard");
  }

  const resolved = await searchParams;
  const page = parseInt(resolved.page || "1", 10);
  const pageSize = parseInt(resolved.pageSize || "10", 10);
  const status = resolved.status || "all";
  const search = resolved.search || "";
  const category_id = resolved.category_id || undefined;
  const brand_id = resolved.brand_id || undefined;
  const power = (resolved.power as PowerType) || undefined;
  const sort = resolved.sort || "updated_desc";

  const [summary, listData, filterOptions] = await Promise.all([
    getEquipmentAdminSummary(),
    getEquipmentAdminList({
      page,
      pageSize,
      status,
      search,
      category_id,
      brand_id,
      power,
      sort,
    }),
    getEquipmentFilterOptions(),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">
            Equipment Fleet Management
          </h1>
          <p className="text-xs text-[var(--color-mute)] mt-0.5">
            Administer industrial access platforms, material handling machinery, specifications, and public publishing.
          </p>
        </div>

        <EquipmentAdminNavTabs
          totalModels={summary.total_models}
          totalEnquiries={summary.total_enquiries}
          newEnquiries={summary.new_enquiries}
        />
      </div>

      {/* KPI Strip */}
      <EquipmentAdminKpiStrip summary={summary} />

      {/* Main Table */}
      <Suspense fallback={<div className="h-64 rounded-2xl bg-[var(--color-canvas-elevated)] border animate-pulse" />}>
        <EquipmentAdminTableClient
          items={listData.items}
          total={listData.total}
          page={listData.page}
          pageSize={listData.pageSize}
          totalPages={listData.totalPages}
          brands={filterOptions.brands}
          categories={filterOptions.categories}
          currentStatus={status}
        />
      </Suspense>
    </div>
  );
}
