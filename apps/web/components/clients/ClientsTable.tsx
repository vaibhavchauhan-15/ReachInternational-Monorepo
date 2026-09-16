"use client";

import React, { memo } from "react";
import { Edit2, Trash2, Eye, Building2, Phone, Receipt, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type { CRMClient } from "@/lib/types/database";
import { Pagination } from "@/components/ui";
import { ClientTableSkeletonRows } from "./ClientsSkeletons";
import { ClientRowActionsMenu } from "./ClientRowActionsMenu";

interface ClientsTableProps {
  clients: CRMClient[];
  total: number;
  page: number;
  pageSize: number;
  isPending: boolean;
  canManageClients: boolean;
  sortField: string;
  sortOrder: "asc" | "desc";
  onSortChange: (field: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  onViewClient: (client: CRMClient) => void;
  onEditClient: (client: CRMClient) => void;
  onDeleteClient: (client: CRMClient) => void;
  onRestoreClient?: (client: CRMClient) => void;
}

const ClientTableRow = memo(function ClientTableRow({
  client,
  canManageClients,
  onViewClient,
  onEditClient,
  onDeleteClient,
  onRestoreClient,
}: {
  client: CRMClient;
  canManageClients: boolean;
  onViewClient: (client: CRMClient) => void;
  onEditClient: (client: CRMClient) => void;
  onDeleteClient: (client: CRMClient) => void;
  onRestoreClient?: (client: CRMClient) => void;
}) {
  return (
    <tr className="hover:bg-[var(--color-hairline-soft-surface)]/60 transition-colors group">
      {/* Code */}
      <td className="py-2.5 px-4 font-mono font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap">
        <button
          type="button"
          onClick={() => onViewClient(client)}
          className="hover:underline cursor-pointer focus:outline-hidden"
          title="View Client Details"
        >
          {client.code}
        </button>
      </td>

      {/* Company & Tax */}
      <td className="py-2.5 px-4 max-w-[260px]">
        <button
          type="button"
          onClick={() => onViewClient(client)}
          className="font-bold text-[var(--color-ink)] hover:text-sky-600 text-left transition-colors cursor-pointer block truncate focus:outline-hidden"
        >
          {client.company_name || client.client_name}
        </button>
        {(client.gstin || client.pan_number) && (
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {client.gstin && (
              <span className="font-mono text-[10px] bg-purple-500/10 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded border border-purple-500/20 font-semibold">
                GST: {client.gstin}
              </span>
            )}
            {client.pan_number && (
              <span className="font-mono text-[10px] bg-sky-500/10 text-sky-700 dark:text-sky-300 px-1.5 py-0.5 rounded border border-sky-500/20 font-semibold">
                PAN: {client.pan_number}
              </span>
            )}
          </div>
        )}
      </td>

      {/* Contact Person */}
      <td className="py-2.5 px-4 font-medium text-[var(--color-body)] whitespace-nowrap">
        {client.contact_person || "—"}
      </td>

      {/* Phone */}
      <td className="py-2.5 px-4 whitespace-nowrap">
        {client.phone ? (
          <div className="font-mono text-[var(--color-ink)] flex items-center gap-1">
            <Phone className="h-3 w-3 text-[var(--color-mute)]" />
            <a href={`tel:${client.phone}`} className="hover:text-sky-600">
              {client.phone}
            </a>
          </div>
        ) : (
          <span className="text-[var(--color-mute)]">—</span>
        )}
      </td>

      {/* Site Location */}
      <td className="py-2.5 px-4 max-w-[280px]">
        <div className="font-medium text-[var(--color-body)] truncate" title={client.address || client.street}>
          {client.address || client.street || "—"}
        </div>
        {client.is_billing_address_different && (
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
            <Receipt className="h-3 w-3" /> Separate Billing
          </span>
        )}
      </td>

      {/* Status */}
      <td className="py-2.5 px-4 whitespace-nowrap">
        {client.deleted_at ? (
          <span className="inline-flex items-center rounded-full bg-red-50 dark:bg-red-950/60 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/80">
            SOFT DELETED
          </span>
        ) : client.status === "active" ? (
          <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
            ACTIVE
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-bold text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
            INACTIVE
          </span>
        )}
      </td>

      {/* Actions */}
      <td className="py-2.5 px-4 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => onViewClient(client)}
            className="rounded-md p-1.5 text-[var(--color-mute)] hover:bg-[var(--color-hairline-soft-surface)] hover:text-sky-600 transition-colors cursor-pointer"
            title="View Details"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          {canManageClients && (
            <button
              type="button"
              onClick={() => onEditClient(client)}
              className="rounded-md p-1.5 text-[var(--color-mute)] hover:bg-[var(--color-hairline-soft-surface)] hover:text-sky-600 transition-colors cursor-pointer"
              title="Edit Client"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
          )}
          <ClientRowActionsMenu
            client={client}
            canManageClients={canManageClients}
            onViewDetails={onViewClient}
            onEdit={onEditClient}
            onDelete={onDeleteClient}
            onRestore={onRestoreClient}
          />
        </div>
      </td>
    </tr>
  );
});

export const ClientsTable = memo(function ClientsTable({
  clients,
  total,
  page,
  pageSize,
  isPending,
  canManageClients,
  sortField,
  sortOrder,
  onSortChange,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  onViewClient,
  onEditClient,
  onDeleteClient,
  onRestoreClient,
}: ClientsTableProps) {
  function renderSortIcon(column: string) {
    if (sortField !== column) {
      return <ArrowUpDown className="h-3 w-3 text-[var(--color-mute)]/60" />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="h-3 w-3 text-sky-600" />
    ) : (
      <ArrowDown className="h-3 w-3 text-sky-600" />
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider select-none">
              <th
                onClick={() => onSortChange("code")}
                className="py-2.5 px-4 cursor-pointer hover:text-[var(--color-ink)] transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Code</span>
                  {renderSortIcon("code")}
                </div>
              </th>
              <th
                onClick={() => onSortChange("company_name")}
                className="py-2.5 px-4 cursor-pointer hover:text-[var(--color-ink)] transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Company & Tax</span>
                  {renderSortIcon("company_name")}
                </div>
              </th>
              <th
                onClick={() => onSortChange("contact_person")}
                className="py-2.5 px-4 cursor-pointer hover:text-[var(--color-ink)] transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Contact Person</span>
                  {renderSortIcon("contact_person")}
                </div>
              </th>
              <th className="py-2.5 px-4">Phone</th>
              <th
                onClick={() => onSortChange("city")}
                className="py-2.5 px-4 cursor-pointer hover:text-[var(--color-ink)] transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Site Location</span>
                  {renderSortIcon("city")}
                </div>
              </th>
              <th
                onClick={() => onSortChange("status")}
                className="py-2.5 px-4 cursor-pointer hover:text-[var(--color-ink)] transition-colors"
              >
                <div className="flex items-center gap-1">
                  <span>Status</span>
                  {renderSortIcon("status")}
                </div>
              </th>
              <th className="py-2.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-hairline)]">
            {isPending ? (
              <ClientTableSkeletonRows canManageClients={canManageClients} count={pageSize} />
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[var(--color-mute)]">
                  <Building2 className="mx-auto h-8 w-8 text-[var(--color-mute)]/60 mb-2" />
                  <p className="font-semibold text-[var(--color-ink)]">No clients found</p>
                  <p className="text-xs">Try adjusting your search query or status filter.</p>
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <ClientTableRow
                  key={client.id}
                  client={client}
                  canManageClients={canManageClients}
                  onViewClient={onViewClient}
                  onEditClient={onEditClient}
                  onDeleteClient={onDeleteClient}
                  onRestoreClient={onRestoreClient}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {total > 0 && (
        <div className="px-4 py-2 border-t border-[var(--color-hairline)] bg-[var(--color-canvas)]">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={onPageChange}
            pageSizeOptions={pageSizeOptions}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      )}
    </div>
  );
});
