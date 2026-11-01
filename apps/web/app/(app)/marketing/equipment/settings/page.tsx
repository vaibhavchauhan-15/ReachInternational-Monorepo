import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import {
  getEquipmentAdminSummary,
  getEquipmentFilterOptions,
} from "@/lib/data/equipment-admin";
import { EquipmentAdminNavTabs } from "@/components/equipment-admin/EquipmentAdminNavTabs";
import { EquipmentAdminKpiStrip } from "@/components/equipment-admin/EquipmentAdminKpiStrip";
import { Building2, Layers, Cpu } from "lucide-react";

export default async function EquipmentSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowedRoles = ["super_admin", "admin", "manager"];
  if (!allowedRoles.includes(user.role)) {
    redirect("/dashboard");
  }

  const [summary, filterOptions] = await Promise.all([
    getEquipmentAdminSummary(),
    getEquipmentFilterOptions(),
  ]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">
            Equipment Taxonomy Settings
          </h1>
          <p className="text-xs text-[var(--color-mute)] mt-0.5">
            Configured brand partners, machinery categories, and technical specification definitions.
          </p>
        </div>

        <EquipmentAdminNavTabs
          totalModels={summary.total_models}
          totalEnquiries={summary.total_enquiries}
          newEnquiries={summary.new_enquiries}
        />
      </div>

      <EquipmentAdminKpiStrip summary={summary} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Categories */}
        <div className="p-5 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl space-y-4">
          <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
            <Layers size={18} />
            <h3 className="font-bold text-sm text-[var(--color-ink)]">
              Machinery Categories ({filterOptions.categories.length})
            </h3>
          </div>
          <div className="divide-y divide-[var(--color-hairline)] max-h-96 overflow-y-auto">
            {filterOptions.categories.map((c) => (
              <div key={c.id} className="py-2.5">
                <span className="font-bold text-xs text-[var(--color-ink)] block">{c.name}</span>
                <span className="text-[10px] text-[var(--color-mute)] font-mono">slug: {c.slug}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Brands */}
        <div className="p-5 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl space-y-4">
          <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
            <Building2 size={18} />
            <h3 className="font-bold text-sm text-[var(--color-ink)]">
              Brand Partners ({filterOptions.brands.length})
            </h3>
          </div>
          <div className="divide-y divide-[var(--color-hairline)] max-h-96 overflow-y-auto">
            {filterOptions.brands.map((b) => (
              <div key={b.id} className="py-2.5">
                <span className="font-bold text-xs text-[var(--color-ink)] block">{b.name}</span>
                <span className="text-[10px] text-[var(--color-mute)] font-mono">slug: {b.slug}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Spec Definitions */}
        <div className="p-5 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl space-y-4">
          <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
            <Cpu size={18} />
            <h3 className="font-bold text-sm text-[var(--color-ink)]">
              Spec Definitions ({filterOptions.specDefinitions.length})
            </h3>
          </div>
          <div className="divide-y divide-[var(--color-hairline)] max-h-96 overflow-y-auto">
            {filterOptions.specDefinitions.slice(0, 15).map((s: any) => (
              <div key={s.id} className="py-2.5">
                <span className="font-bold text-xs text-[var(--color-ink)] block">{s.name}</span>
                <span className="text-[10px] text-[var(--color-mute)] font-mono">
                  code: {s.code} {s.unit ? `(${s.unit})` : ""} • {s.group_name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
