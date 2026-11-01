"use client";

import { KPIGrid, KPICard } from "@/components/ui";
import type { HiringSummary } from "@reachinternational/types";

interface HiringKpiStripProps {
  summary: HiringSummary;
}

export function HiringKpiStrip({ summary }: HiringKpiStripProps) {
  return (
    <KPIGrid columns={4} className="mb-6">
      <KPICard
        label="Published Roles"
        value={summary.published}
        subtitle={`${summary.total_jobs} total created`}
        icon="CheckCircle"
        variant="default"
      />
      <KPICard
        label="Draft Jobs"
        value={summary.drafts}
        subtitle={summary.drafts === 1 ? "1 job in draft" : `${summary.drafts} jobs in draft`}
        icon="AlertCircle"
        variant={summary.drafts > 0 ? "warning" : "default"}
      />
      <KPICard
        label="Total Applications"
        value={summary.applications}
        subtitle={`${summary.applications_7d} received in last 7 days`}
        icon="Users"
        variant="default"
      />
      <KPICard
        label="New (Unreviewed)"
        value={summary.new_applications}
        subtitle="Pending initial screening"
        icon="TrendingUp"
        variant={summary.new_applications > 0 ? "success" : "default"}
      />
    </KPIGrid>
  );
}
