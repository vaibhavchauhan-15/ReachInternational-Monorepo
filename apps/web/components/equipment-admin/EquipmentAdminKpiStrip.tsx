"use client";

import { KPIGrid, KPICard } from "@/components/ui";
import type { EquipmentAdminSummary } from "@reachinternational/types";

interface EquipmentAdminKpiStripProps {
  summary: EquipmentAdminSummary;
}

export function EquipmentAdminKpiStrip({ summary }: EquipmentAdminKpiStripProps) {
  return (
    <KPIGrid columns={4} className="mb-6">
      <KPICard
        label="Published Machines"
        value={summary.published_models}
        subtitle={`${summary.total_models} total registered`}
        icon="CheckCircle"
        variant="default"
      />
      <KPICard
        label="Drafts & Pending"
        value={summary.draft_models}
        subtitle={summary.draft_models === 1 ? "1 machine in draft" : `${summary.draft_models} machines in draft`}
        icon="AlertCircle"
        variant={summary.draft_models > 0 ? "warning" : "default"}
      />
      <KPICard
        label="Customer Enquiries"
        value={summary.total_enquiries}
        subtitle={`${summary.new_enquiries} uncontacted leads`}
        icon="Users"
        variant={summary.new_enquiries > 0 ? "success" : "default"}
      />
      <KPICard
        label="Brands & Categories"
        value={`${summary.total_brands} / ${summary.total_categories}`}
        subtitle="Catalog taxonomy scope"
        icon="TrendingUp"
        variant="default"
      />
    </KPIGrid>
  );
}
