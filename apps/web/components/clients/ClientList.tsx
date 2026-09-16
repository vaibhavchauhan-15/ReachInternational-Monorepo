"use client";

import React, { memo } from "react";
import type { CRMClient } from "@/lib/types/database";
import { ClientsTable } from "./ClientsTable";
import { ClientsMobileList } from "./ClientsMobileList";

interface ClientListProps {
  clients: CRMClient[];
  total: number;
  page: number;
  pageSize: number;
  isPending: boolean;
  canManageClients: boolean;
  sortField?: string;
  sortOrder?: "asc" | "desc";
  onSortChange?: (field: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  onViewClient: (client: CRMClient) => void;
  onEditClient: (client: CRMClient) => void;
  onDeleteClient: (client: CRMClient) => void;
  onRestoreClient?: (client: CRMClient) => void;
}

/**
 * Unified ClientList component encapsulating:
 * - Desktop high-density table view (hidden sm:block)
 * - Mobile touch card reflow (block sm:hidden) with min 44px touch targets
 * - Responsive pagination and transition states
 */
export const ClientList = memo(function ClientList({
  clients,
  total,
  page,
  pageSize,
  isPending,
  canManageClients,
  sortField = "company_name",
  sortOrder = "asc",
  onSortChange = () => {},
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  onViewClient,
  onEditClient,
  onDeleteClient,
  onRestoreClient,
}: ClientListProps) {
  return (
    <div className="space-y-4">
      {/* Desktop View (>=640px) */}
      <ClientsTable
        clients={clients}
        total={total}
        page={page}
        pageSize={pageSize}
        isPending={isPending}
        canManageClients={canManageClients}
        sortField={sortField}
        sortOrder={sortOrder}
        onSortChange={onSortChange}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={pageSizeOptions}
        onViewClient={onViewClient}
        onEditClient={onEditClient}
        onDeleteClient={onDeleteClient}
        onRestoreClient={onRestoreClient}
      />

      {/* Mobile View (<640px) */}
      <ClientsMobileList
        clients={clients}
        total={total}
        page={page}
        pageSize={pageSize}
        isPending={isPending}
        canManageClients={canManageClients}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
        pageSizeOptions={pageSizeOptions}
        onViewClient={onViewClient}
        onEditClient={onEditClient}
        onDeleteClient={onDeleteClient}
        onRestoreClient={onRestoreClient}
      />
    </div>
  );
});
