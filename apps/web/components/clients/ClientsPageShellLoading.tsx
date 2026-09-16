import React from "react";
import { ClientsHeader } from "./ClientsHeader";
import { ClientSearch } from "./ClientSearch";
import { ClientStatusTabs } from "./ClientStatusTabs";
import { ClientTableSkeletonRows, MobileClientCardSkeletonList } from "./ClientsSkeletons";

/**
 * C18 — Independent Loading States Shell
 *
 * Decoupled Loading UX:
 * Header:      ready (Real Header UI mounted)
 * KPI:         loading (4-card skeleton strip)
 * Search:      ready (Real search input & icon mounted)
 * Tabs:        ready (Real status tabs All/Active/Inactive mounted)
 * Table:       loading (Skeleton rows for desktop & cards for mobile)
 * Add Client:  not loaded (0 bytes of modal chunk loaded)
 */
export function ClientsPageShellLoading() {
  return (
    <div className="space-y-4" aria-label="Loading client directory...">
      {/* 1. Header: Ready */}
      <ClientsHeader
        canManageClients={true}
        totalClients={0}
        onOpenAddModal={() => {}}
        onOpenExportModal={() => {}}
      />

      {/* 2. KPI: Loading Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`kpi-skel-${i}`}
            className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 shadow-xs space-y-2 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 rounded bg-[var(--color-hairline)]" />
              <div className="h-6 w-6 rounded bg-[var(--color-hairline)]" />
            </div>
            <div className="h-7 w-16 rounded bg-[var(--color-hairline)]" />
          </div>
        ))}
      </div>

      {/* 3 & 4. Search & Tabs: Ready */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 shadow-xs">
        <ClientSearch
          initialSearch=""
          isPending={true}
          onSearchChange={() => {}}
        />
        <ClientStatusTabs
          statusFilter="all"
          cityFilter="all"
          availableCities={[]}
          totalCount={0}
          activeCount={0}
          inactiveCount={0}
          hasActiveFilters={false}
          onStatusChange={() => {}}
          onCityChange={() => {}}
          onResetFilters={() => {}}
        />
      </div>

      {/* 5. Table / Mobile List: Loading Skeletons */}
      <div className="hidden sm:block overflow-hidden rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider select-none">
                <th className="py-2.5 px-4">Code</th>
                <th className="py-2.5 px-4">Company & Tax</th>
                <th className="py-2.5 px-4">Contact Person</th>
                <th className="py-2.5 px-4">Phone</th>
                <th className="py-2.5 px-4">Site Location</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-hairline)]">
              <ClientTableSkeletonRows canManageClients={true} count={10} />
            </tbody>
          </table>
        </div>
      </div>

      <div className="block sm:hidden">
        <MobileClientCardSkeletonList count={6} className="space-y-3.5" />
      </div>
    </div>
  );
}
