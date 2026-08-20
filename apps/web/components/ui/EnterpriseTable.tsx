"use client";

import { useState, useMemo, ReactNode } from "react";
import {
  AnimatedChevronUp,
  AnimatedChevronDown,
  AnimatedChevronsUpDown,
  AnimatedCopy,
  AnimatedCheck,
  AnimatedSlidersHorizontal,
  AnimatedDownload,
} from "./animated-icons";
import { Download } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { InfoTooltip, TooltipWrapper } from "./tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { AnimateIcon, AnimatedIcon } from "./animated-icon";

export interface ColumnDef<T> {
  id: string;
  header: string | ReactNode;
  accessorKey?: keyof T;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  sortFn?: (a: T, b: T) => number;
  tooltip?: string;
  width?: string;
}

export type TableDensity = "compact" | "default" | "comfortable";

interface EnterpriseTableProps<T extends { id: string | number }> {
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
    icon?: typeof Download;
    onClick: (selectedIds: (string | number)[]) => void;
    variant?: "default" | "danger";
  }[];
  defaultHiddenColumns?: string[];
  defaultSortColumn?: string | null;
  defaultSortDirection?: "asc" | "desc";
}

export function CopyCell({
  value,
  label,
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const tooltipLabel = copied ? "Copied!" : `Copy ${label || "value"}`;

  return (
    <div className="inline-flex items-center gap-1.5 group">
      <span className={className || "font-mono text-xs text-[var(--color-ink)]"}>
        {label || value}
      </span>
      <TooltipWrapper content={tooltipLabel} side="top">
        <button
          type="button"
          onClick={handleCopy}
          aria-label={tooltipLabel}
          className="p-0.5 rounded hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-all flex-shrink-0 cursor-pointer"
        >
          {copied ? (
            <AnimatedCheck size={12} className="text-emerald-600" />
          ) : (
            <AnimatedCopy size={12} />
          )}
        </button>
      </TooltipWrapper>
    </div>
  );
}

export function EnterpriseTable<T extends { id: string | number }>({
  columns,
  data,
  emptyMessage = "No data found",
  emptyDescription = "There are no records matching your criteria.",
  emptyAction,
  onRowClick,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  bulkActions = [],
  defaultHiddenColumns = [],
  defaultSortColumn = null,
  defaultSortDirection = "asc",
}: EnterpriseTableProps<T>) {
  const [density, setDensity] = useState<TableDensity>("default");
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[]>(() =>
    columns
      .map((c) => c.id)
      .filter((id) => !defaultHiddenColumns.includes(id))
  );
  const [sortColumn, setSortColumn] = useState<string | null>(defaultSortColumn);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(defaultSortDirection);
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const densityPadding: Record<TableDensity, string> = {
    compact: "py-1.5 px-3 text-xs",
    default: "py-2.5 px-3.5 text-xs",
    comfortable: "py-3 px-4 text-xs font-medium",
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onSelectionChange) return;
    if (e.target.checked) {
      onSelectionChange(data.map((item) => item.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectRow = (id: string | number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onSelectionChange) return;
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((item) => item !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  const handleSort = (colId: string) => {
    if (sortColumn === colId) {
      if (sortDirection === "asc") setSortDirection("desc");
      else {
        setSortColumn(null);
        setSortDirection("asc");
      }
    } else {
      setSortColumn(colId);
      setSortDirection("asc");
    }
  };

  const visibleColumns = useMemo(
    () => columns.filter((col) => visibleColumnIds.includes(col.id)),
    [columns, visibleColumnIds]
  );

  const sortedData = useMemo(() => {
    if (!sortColumn) return data;
    const col = columns.find((c) => c.id === sortColumn);
    if (!col) return data;

    if (col.sortFn) {
      return [...data].sort((a, b) => {
        const res = col.sortFn!(a, b);
        return sortDirection === "asc" ? res : -res;
      });
    }

    if (!col.accessorKey) return data;

    const key = col.accessorKey;
    return [...data].sort((a, b) => {
      const valA = a[key];
      const valB = b[key];

      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      if (typeof valA === "string" && typeof valB === "string") {
        return sortDirection === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }
      return sortDirection === "asc"
        ? (valA as number) > (valB as number)
          ? 1
          : -1
        : (valA as number) < (valB as number)
        ? 1
        : -1;
    });
  }, [data, sortColumn, sortDirection, columns]);

  const allSelected = data.length > 0 && selectedIds.length === data.length;

  return (
    <div className="w-full flex flex-col gap-3">
      {/* Table Toolbar Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        {/* Bulk Actions Bar */}
        <AnimatePresence>
          {selectable && selectedIds.length > 0 ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-2 bg-[var(--color-ink)] text-white px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-medium shadow-md"
            >
              <span>{selectedIds.length} selected</span>
              <div className="h-4 w-px bg-neutral-700 mx-1" />
              {bulkActions.map((action, idx) => {
                const Icon = action.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => action.onClick(selectedIds)}
                    className="flex items-center gap-1 hover:text-neutral-300 transition-colors cursor-pointer"
                  >
                    {Icon && <AnimateIcon icon={Icon} animation="bounce" size={14} />}
                    {action.label}
                  </button>
                );
              })}
            </motion.div>
          ) : (
            <div className="text-xs text-[var(--color-mute)] font-medium">
              Showing <span className="text-[var(--color-ink)] font-bold">{data.length}</span> entries
            </div>
          )}
        </AnimatePresence>

        {/* View Controls: Density & Column Toggles */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Density Selector */}
          <div className="flex items-center bg-[var(--color-hairline-soft-surface)] p-0.5 rounded-[var(--radius-sm)] text-xs">
            <TooltipWrapper content="Compact table row spacing" side="top">
              <button
                onClick={() => setDensity("compact")}
                className={`px-2 py-1 rounded-[calc(var(--radius-sm)-2px)] transition-all cursor-pointer ${
                  density === "compact"
                    ? "bg-[var(--color-canvas-elevated)] font-semibold shadow-xs text-[var(--color-ink)]"
                    : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                }`}
                aria-label="Compact row density"
              >
                Compact
              </button>
            </TooltipWrapper>
            <TooltipWrapper content="Default table row spacing" side="top">
              <button
                onClick={() => setDensity("default")}
                className={`px-2 py-1 rounded-[calc(var(--radius-sm)-2px)] transition-all cursor-pointer ${
                  density === "default"
                    ? "bg-[var(--color-canvas-elevated)] font-semibold shadow-xs text-[var(--color-ink)]"
                    : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                }`}
                aria-label="Default row density"
              >
                Default
              </button>
            </TooltipWrapper>
            <TooltipWrapper content="Comfortable table row spacing" side="top">
              <button
                onClick={() => setDensity("comfortable")}
                className={`px-2 py-1 rounded-[calc(var(--radius-sm)-2px)] transition-all cursor-pointer ${
                  density === "comfortable"
                    ? "bg-[var(--color-canvas-elevated)] font-semibold shadow-xs text-[var(--color-ink)]"
                    : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                }`}
                aria-label="Comfortable row density"
              >
                Comfortable
              </button>
            </TooltipWrapper>
          </div>

          {/* Column Visibility Dropdown */}
          <div className="relative">
            <TooltipWrapper content="Customize visible table columns" side="top">
              <button
                onClick={() => setShowColumnMenu(!showColumnMenu)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm)] border border-[var(--color-hairline)] text-xs text-[var(--color-body)] hover:bg-[var(--color-hairline-soft-surface)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                aria-label="Customize visible table columns"
              >
                <AnimatedSlidersHorizontal size={14} />
                <span>Columns</span>
              </button>
            </TooltipWrapper>

            {showColumnMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowColumnMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-50 w-48 card-elevated p-2 shadow-lg border border-[var(--color-hairline)] space-y-1">
                  <p className="text-[10px] font-semibold text-[var(--color-mute)] uppercase px-2 py-1">
                    Toggle Columns
                  </p>
                  {columns.map((col) => {
                    const isVisible = visibleColumnIds.includes(col.id);
                    return (
                      <label
                        key={col.id}
                        className="flex items-center gap-2 px-2 py-1 text-xs text-[var(--color-ink)] rounded hover:bg-[var(--color-hairline-soft-surface)] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() => {
                            if (isVisible) {
                              if (visibleColumnIds.length > 1) {
                                setVisibleColumnIds(
                                  visibleColumnIds.filter((id) => id !== col.id)
                                );
                              }
                            } else {
                              setVisibleColumnIds([...visibleColumnIds, col.id]);
                            }
                          }}
                          className="rounded text-[var(--color-ink)] focus:ring-0 cursor-pointer"
                        />
                        <span>{col.header}</span>
                      </label>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Table Wrapper */}
      <div className="w-full overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs">
        <table className="w-full text-left border-collapse">
          {/* Table Header */}
          <thead className="bg-[var(--color-canvas)] border-b border-[var(--color-hairline)] sticky top-0 z-10 backdrop-blur-md">
            <tr>
              {selectable && (
                <th className={`w-10 ${densityPadding[density]}`}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                    className="rounded text-[var(--color-ink)] focus:ring-0 cursor-pointer"
                  />
                </th>
              )}

              {visibleColumns.map((col) => (
                <th
                  key={col.id}
                  style={{ width: col.width }}
                  className={`font-semibold text-[var(--color-mute)] tracking-tight select-none ${
                    densityPadding[density]
                  } ${col.sortable ? "cursor-pointer hover:text-[var(--color-ink)]" : ""}`}
                  onClick={() => col.sortable && handleSort(col.id)}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.header}</span>
                    {col.tooltip && <InfoTooltip content={col.tooltip} />}
                    {col.sortable && (
                      <span className="text-[var(--color-mute)]">
                        {sortColumn === col.id ? (
                          sortDirection === "asc" ? (
                            <AnimatedChevronUp size={14} className="text-[var(--color-ink)]" />
                          ) : (
                            <AnimatedChevronDown size={14} className="text-[var(--color-ink)]" />
                          )
                        ) : (
                          <AnimatedChevronsUpDown size={14} className="opacity-40 hover:opacity-100" />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-[var(--color-hairline)]">
            {sortedData.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                  className="py-12 text-center"
                >
                  <EmptyState
                    title={emptyMessage}
                    description={emptyDescription}
                    action={emptyAction}
                  />
                </td>
              </tr>
            ) : (
              sortedData.map((row) => {
                const isSelected = selectedIds.includes(row.id);

                return (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`transition-colors ${
                      onRowClick ? "cursor-pointer" : ""
                    } ${
                      isSelected
                        ? "bg-[var(--color-link-soft)]/20"
                        : "hover:bg-[var(--color-hairline-soft-surface)]/50"
                    }`}
                  >
                    {selectable && (
                      <td
                        className={densityPadding[density]}
                        onClick={(e) => handleSelectRow(row.id, e)}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded text-[var(--color-ink)] focus:ring-0 cursor-pointer"
                        />
                      </td>
                    )}

                    {visibleColumns.map((col) => {
                      const value = col.accessorKey ? row[col.accessorKey] : null;
                      return (
                        <td key={col.id} className={densityPadding[density]}>
                          {col.cell ? col.cell(row) : (value as ReactNode)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
