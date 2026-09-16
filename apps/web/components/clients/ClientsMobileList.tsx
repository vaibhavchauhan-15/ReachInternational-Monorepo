"use client";

import React, { memo } from "react";
import { Edit2, Trash2, Eye, Building2, Phone, Receipt, RotateCcw } from "lucide-react";
import type { CRMClient } from "@/lib/types/database";
import { Pagination } from "@/components/ui";
import { MobileClientCardSkeletonList } from "./ClientsSkeletons";

import { MobileClientCard } from "./MobileClientCard";

interface ClientsMobileListProps {
  clients: CRMClient[];
  total: number;
  page: number;
  pageSize: number;
  isPending: boolean;
  canManageClients: boolean;
  searchTerm?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  onViewClient: (client: CRMClient) => void;
  onEditClient: (client: CRMClient) => void;
  onDeleteClient: (client: CRMClient) => void;
  onRestoreClient?: (client: CRMClient) => void;
}

export const ClientsMobileList = memo(function ClientsMobileList({
  clients,
  total,
  page,
  pageSize,
  isPending,
  canManageClients,
  searchTerm = "",
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  onViewClient,
  onEditClient,
  onDeleteClient,
  onRestoreClient,
}: ClientsMobileListProps) {
  if (isPending) {
    return (
      <div className="block sm:hidden">
        <MobileClientCardSkeletonList count={pageSize} className="space-y-3" />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="block sm:hidden rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-8 text-center text-[var(--color-mute)]">
        <Building2 className="mx-auto h-8 w-8 text-[var(--color-mute)]/60 mb-2" />
        <p className="font-semibold text-[var(--color-ink)]">No clients found</p>
        <p className="text-xs">Try adjusting your search query or status filter.</p>
      </div>
    );
  }

  return (
    <div className="block sm:hidden space-y-3">
      {clients.map((client) => (
        <MobileClientCard
          key={client.id}
          client={client}
          canManageClients={canManageClients}
          searchTerm={searchTerm}
          onViewClient={onViewClient}
          onEditClient={onEditClient}
          onDeleteClient={onDeleteClient}
          onRestoreClient={onRestoreClient}
        />
      ))}

      {total > 0 && (
        <div className="px-1 pt-2 hidden sm:block">
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
