"use client";

import React, { ReactNode } from "react";
import { EnterpriseTable, ColumnDef, TableDensity } from "./EnterpriseTable";
import { EmptyState } from "./EmptyState";
import { SkeletonTable } from "./Skeleton";

export interface DataTableProps<T extends { id: string | number }> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selectedIds?: (string | number)[];
  onSelectionChange?: (selectedIds: (string | number)[]) => void;
  bulkActions?: {
    label: string;
    icon?: any;
    onClick: (selectedIds: (string | number)[]) => void;
    variant?: "default" | "danger";
  }[];
  defaultHiddenColumns?: string[];
  defaultSortColumn?: string | null;
  defaultSortDirection?: "asc" | "desc";
  /** Optional custom mobile card renderer for screen widths <= 640px */
  renderMobileCard?: (item: T, index: number) => ReactNode;
  className?: string;
}

export function DataTable<T extends { id: string | number }>({
  columns,
  data,
  loading = false,
  emptyMessage = "No records found",
  emptyDescription = "There are no entries matching your active criteria.",
  emptyAction,
  onRowClick,
  selectable,
  selectedIds,
  onSelectionChange,
  bulkActions,
  defaultHiddenColumns,
  defaultSortColumn,
  defaultSortDirection,
  renderMobileCard,
  className = "",
}: DataTableProps<T>) {
  if (loading) {
    return <SkeletonTable rows={6} columns={columns.length || 5} />;
  }

  return (
    <div className={`w-full ${className}`}>
      {/* If a mobile card renderer is provided, automatically reflow on <= 640px */}
      {renderMobileCard ? (
        <>
          {/* Desktop Table View (>= 640px) */}
          <div className="hidden sm:block">
            <EnterpriseTable
              columns={columns}
              data={data}
              emptyMessage={emptyMessage}
              emptyDescription={emptyDescription}
              emptyAction={emptyAction}
              onRowClick={onRowClick}
              selectable={selectable}
              selectedIds={selectedIds}
              onSelectionChange={onSelectionChange}
              bulkActions={bulkActions}
              defaultHiddenColumns={defaultHiddenColumns}
              defaultSortColumn={defaultSortColumn}
              defaultSortDirection={defaultSortDirection}
            />
          </div>

          {/* Mobile Touch Card View (<= 640px) */}
          <div className="block sm:hidden space-y-2.5">
            {data.length === 0 ? (
              <div className="card-elevated p-8 text-center">
                <EmptyState
                  title={emptyMessage}
                  description={emptyDescription}
                  action={emptyAction}
                />
              </div>
            ) : (
              data.map((item, idx) => (
                <div key={item.id} onClick={() => onRowClick?.(item)}>
                  {renderMobileCard(item, idx)}
                </div>
              ))
            )}
          </div>
        </>
      ) : (
        /* Standard Responsive Table View */
        <EnterpriseTable
          columns={columns}
          data={data}
          emptyMessage={emptyMessage}
          emptyDescription={emptyDescription}
          emptyAction={emptyAction}
          onRowClick={onRowClick}
          selectable={selectable}
          selectedIds={selectedIds}
          onSelectionChange={onSelectionChange}
          bulkActions={bulkActions}
          defaultHiddenColumns={defaultHiddenColumns}
          defaultSortColumn={defaultSortColumn}
          defaultSortDirection={defaultSortDirection}
        />
      )}
    </div>
  );
}
