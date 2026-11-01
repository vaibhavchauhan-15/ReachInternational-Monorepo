"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Plus,
  MoreVertical,
  ExternalLink,
  Edit2,
  Copy,
  Archive,
  Trash2,
  CheckCircle,
  XCircle,
  RotateCcw,
  Sparkles,
  Zap,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  EquipmentAdminListItem,
  EquipmentBrand,
  EquipmentCategory,
} from "@reachinternational/types";
import {
  publishEquipmentAction,
  unpublishEquipmentAction,
  archiveEquipmentAction,
  restoreEquipmentAction,
  deleteEquipmentAction,
  duplicateEquipmentAction,
} from "@/app/actions/equipment";

interface EquipmentAdminTableClientProps {
  items: EquipmentAdminListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  brands: EquipmentBrand[];
  categories: EquipmentCategory[];
  currentStatus: string;
}

export function EquipmentAdminTableClient({
  items,
  total,
  page,
  pageSize,
  totalPages,
  brands,
  categories,
  currentStatus,
}: EquipmentAdminTableClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const q = searchParams.get("search") || "";
  const cat = searchParams.get("category_id") || "";
  const brand = searchParams.get("brand_id") || "";
  const power = searchParams.get("power") || "";
  const sort = searchParams.get("sort") || "updated_desc";

  function updateQuery(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === "" || value === "all") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    // reset to page 1 on filter/search change
    if (!updates.page && params.has("page") && Object.keys(updates).some((k) => k !== "page")) {
      params.delete("page");
    }
    startTransition(() => {
      router.push(`/marketing/equipment?${params.toString()}`);
    });
  }

  // Row selection
  const allSelected = items.length > 0 && selectedIds.length === items.length;
  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.id));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  // Row actions
  async function handlePublish(id: string) {
    setActiveMenuId(null);
    setFeedbackMsg(null);
    const res = await publishEquipmentAction(id);
    if (res.success) {
      setFeedbackMsg({ type: "success", text: "Machine published successfully." });
      router.refresh();
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Failed to publish." });
    }
  }

  async function handleUnpublish(id: string) {
    setActiveMenuId(null);
    setFeedbackMsg(null);
    const res = await unpublishEquipmentAction(id);
    if (res.success) {
      setFeedbackMsg({ type: "success", text: "Machine moved to draft." });
      router.refresh();
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Failed to unpublish." });
    }
  }

  async function handleArchive(id: string) {
    setActiveMenuId(null);
    setFeedbackMsg(null);
    const res = await archiveEquipmentAction(id);
    if (res.success) {
      setFeedbackMsg({ type: "success", text: "Machine archived." });
      router.refresh();
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Failed to archive." });
    }
  }

  async function handleRestore(id: string) {
    setActiveMenuId(null);
    setFeedbackMsg(null);
    const res = await restoreEquipmentAction(id);
    if (res.success) {
      setFeedbackMsg({ type: "success", text: "Machine restored to drafts." });
      router.refresh();
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Failed to restore." });
    }
  }

  async function handleDelete(id: string, hard = false) {
    setActiveMenuId(null);
    setFeedbackMsg(null);
    const res = await deleteEquipmentAction(id, hard);
    if (res.success) {
      setFeedbackMsg({
        type: "success",
        text: hard ? "Machine permanently deleted." : "Machine moved to trash.",
      });
      router.refresh();
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Failed to delete." });
    }
  }

  async function handleDuplicate(id: string) {
    setActiveMenuId(null);
    setFeedbackMsg(null);
    const res = await duplicateEquipmentAction(id);
    if (res.success) {
      setFeedbackMsg({ type: "success", text: "Machine duplicated as a new draft." });
      router.refresh();
    } else {
      setFeedbackMsg({ type: "error", text: res.error || "Failed to duplicate." });
    }
  }

  // Bulk actions
  async function handleBulkPublish() {
    setFeedbackMsg(null);
    for (const id of selectedIds) {
      await publishEquipmentAction(id);
    }
    setSelectedIds([]);
    setFeedbackMsg({ type: "success", text: `Published ${selectedIds.length} machines.` });
    router.refresh();
  }

  async function handleBulkUnpublish() {
    setFeedbackMsg(null);
    for (const id of selectedIds) {
      await unpublishEquipmentAction(id);
    }
    setSelectedIds([]);
    setFeedbackMsg({ type: "success", text: `Moved ${selectedIds.length} machines to draft.` });
    router.refresh();
  }

  async function handleBulkArchive() {
    setFeedbackMsg(null);
    for (const id of selectedIds) {
      await archiveEquipmentAction(id);
    }
    setSelectedIds([]);
    setFeedbackMsg({ type: "success", text: `Archived ${selectedIds.length} machines.` });
    router.refresh();
  }

  const statusTabs = [
    { key: "all", label: "All Fleet" },
    { key: "published", label: "Published" },
    { key: "draft", label: "Drafts" },
    { key: "archived", label: "Archived" },
    { key: "trash", label: "Trash" },
  ];

  return (
    <div className="space-y-4">
      {/* Toast Notification */}
      {feedbackMsg && (
        <div
          className={cn(
            "p-3 rounded-xl text-xs font-semibold flex items-center justify-between border animate-in fade-in duration-200",
            feedbackMsg.type === "success"
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
              : "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
          )}
        >
          <span>{feedbackMsg.text}</span>
          <button
            onClick={() => setFeedbackMsg(null)}
            className="text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Filter Bar & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 p-1 bg-[var(--color-hairline-soft-surface)] border border-[var(--color-hairline)] rounded-xl overflow-x-auto">
          {statusTabs.map((tab) => {
            const isActive = currentStatus === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => updateQuery({ status: tab.key })}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all duration-150 select-none",
                  isActive
                    ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] font-bold shadow-2xs border border-[var(--color-hairline)]"
                    : "text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas-elevated)]/40"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Primary CTA */}
        <div className="flex items-center gap-2">
          <Link
            href="/marketing/equipment/new"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-sm transition-all duration-150"
          >
            <Plus size={15} />
            <span>Add Equipment</span>
          </Link>
        </div>
      </div>

      {/* Filters Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 p-3 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl">
        {/* Search Input */}
        <div className="relative col-span-1 sm:col-span-2">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-mute)] pointer-events-none"
          />
          <input
            type="text"
            defaultValue={q}
            onChange={(e) => updateQuery({ search: e.target.value })}
            placeholder="Search by name, model number, slug..."
            className="w-full pl-9 pr-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-xs text-[var(--color-ink)] placeholder:text-[var(--color-mute)] focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          />
        </div>

        {/* Category Filter */}
        <div>
          <select
            value={cat}
            onChange={(e) => updateQuery({ category_id: e.target.value })}
            className="w-full px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-xs text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Brand Filter */}
        <div>
          <select
            value={brand}
            onChange={(e) => updateQuery({ brand_id: e.target.value })}
            className="w-full px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-xs text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          >
            <option value="">All Brands</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Sort Filter */}
        <div>
          <select
            value={sort}
            onChange={(e) => updateQuery({ sort: e.target.value })}
            className="w-full px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl text-xs text-[var(--color-ink)] focus:outline-none focus:ring-2 focus:ring-sky-500/20"
          >
            <option value="updated_desc">Recently Updated</option>
            <option value="name_asc">Name (A to Z)</option>
            <option value="name_desc">Name (Z to A)</option>
            <option value="height_desc">Working Height (Highest)</option>
            <option value="capacity_desc">Platform Capacity (Highest)</option>
          </select>
        </div>
      </div>

      {/* Bulk Action Bar (when rows are selected) */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-sky-500/10 border border-sky-500/20 rounded-xl text-xs">
          <span className="font-semibold text-sky-800 dark:text-sky-300">
            {selectedIds.length} machines selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBulkPublish}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold transition-colors"
            >
              Publish Selected
            </button>
            <button
              onClick={handleBulkUnpublish}
              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-bold transition-colors"
            >
              Move to Draft
            </button>
            <button
              onClick={handleBulkArchive}
              className="px-2.5 py-1 bg-neutral-700 hover:bg-neutral-600 text-white rounded-lg font-bold transition-colors"
            >
              Archive Selected
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2.5 py-1 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Equipment Table */}
      <div className="bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] font-semibold">
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="rounded border-[var(--color-hairline)] text-sky-600 focus:ring-sky-500"
                  />
                </th>
                <th className="py-3 px-4">Machine & Model</th>
                <th className="py-3 px-4">Brand & Category</th>
                <th className="py-3 px-4">Power & Specs</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Assets</th>
                <th className="py-3 px-4">Updated</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-hairline)]">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--color-mute)]">
                    <p className="font-semibold text-sm mb-1 text-[var(--color-ink)]">
                      No equipment machines found
                    </p>
                    <p className="text-xs">
                      Try adjusting your search terms, status filters, or add a new machine.
                    </p>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  const isMenuOpen = activeMenuId === item.id;

                  return (
                    <tr
                      key={item.id}
                      className={cn(
                        "hover:bg-[var(--color-hairline-soft-surface)]/60 transition-colors",
                        isSelected && "bg-sky-500/5"
                      )}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.id)}
                          className="rounded border-[var(--color-hairline)] text-sky-600 focus:ring-sky-500"
                        />
                      </td>

                      {/* Machine & Model */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-10 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-900 border border-[var(--color-hairline)] shrink-0">
                            {item.primary_image_url ? (
                              <Image
                                src={item.primary_image_url}
                                alt={item.model_name}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[var(--color-mute)]">
                                <Zap size={14} />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/marketing/equipment/${item.id}`}
                                className="font-bold text-[var(--color-ink)] hover:text-sky-600 transition-colors line-clamp-1"
                              >
                                {item.model_name}
                              </Link>
                              {item.is_featured && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 rounded-md font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                  <Sparkles size={10} />
                                  Featured
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-[var(--color-mute)] font-mono">
                              {item.model_number} • <span className="text-[10px]">/{item.slug}</span>
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Brand & Category */}
                      <td className="py-3 px-4">
                        <span className="font-semibold text-[var(--color-ink)] block">
                          {item.brand_name}
                        </span>
                        <span className="text-[11px] text-[var(--color-mute)] block">
                          {item.category_name}
                        </span>
                      </td>

                      {/* Power & Specs */}
                      <td className="py-3 px-4">
                        <div className="space-y-0.5">
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)]">
                            {item.power}
                          </span>
                          <p className="text-[11px] text-[var(--color-mute)]">
                            {item.max_platform_height_m ? `${item.max_platform_height_m}m height` : "–"}
                            {item.capacity_kg ? ` • ${item.capacity_kg}kg` : ""}
                          </p>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                            item.status === "published" &&
                              "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
                            item.status === "draft" &&
                              "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
                            item.status === "archived" &&
                              "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20"
                          )}
                        >
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full",
                              item.status === "published" && "bg-emerald-500",
                              item.status === "draft" && "bg-amber-500",
                              item.status === "archived" && "bg-neutral-400"
                            )}
                          />
                          {item.status.toUpperCase()}
                        </span>
                      </td>

                      {/* Assets summary */}
                      <td className="py-3 px-4">
                        <span className="text-[11px] text-[var(--color-mute)] font-mono">
                          {item.media_count} photos • {item.docs_count} docs • {item.specs_count} specs
                        </span>
                      </td>

                      {/* Updated */}
                      <td className="py-3 px-4 text-[11px] text-[var(--color-mute)]">
                        {new Date(item.updated_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right relative">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/marketing/equipment/${item.id}`}
                            className="p-1.5 rounded-lg hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
                            title="Edit Machine"
                          >
                            <Edit2 size={13} />
                          </Link>

                          <a
                            href={`/equipment`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
                            title="View Public Page"
                          >
                            <ExternalLink size={13} />
                          </a>

                          <div className="relative">
                            <button
                              onClick={() =>
                                setActiveMenuId(isMenuOpen ? null : item.id)
                              }
                              className="p-1.5 rounded-lg hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors"
                            >
                              <MoreVertical size={13} />
                            </button>

                            {/* Dropdown Menu */}
                            {isMenuOpen && (
                              <div className="absolute right-0 mt-1 w-44 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-xl shadow-lg p-1 z-30 text-left">
                                <button
                                  onClick={() => handleDuplicate(item.id)}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] rounded-lg transition-colors"
                                >
                                  <Copy size={12} className="text-sky-500" />
                                  <span>Duplicate</span>
                                </button>

                                {item.status === "published" ? (
                                  <button
                                    onClick={() => handleUnpublish(item.id)}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                                  >
                                    <XCircle size={12} />
                                    <span>Move to Draft</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handlePublish(item.id)}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                  >
                                    <CheckCircle size={12} />
                                    <span>Publish Machine</span>
                                  </button>
                                )}

                                {item.status !== "archived" ? (
                                  <button
                                    onClick={() => handleArchive(item.id)}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-[var(--color-mute)] hover:bg-[var(--color-hairline-soft-surface)] rounded-lg transition-colors"
                                  >
                                    <Archive size={12} />
                                    <span>Archive</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleRestore(item.id)}
                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-sky-600 hover:bg-sky-500/10 rounded-lg transition-colors"
                                  >
                                    <RotateCcw size={12} />
                                    <span>Restore to Draft</span>
                                  </button>
                                )}

                                <div className="my-1 border-t border-[var(--color-hairline)]" />

                                <button
                                  onClick={() =>
                                    handleDelete(item.id, currentStatus === "trash")
                                  }
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-500/10 rounded-lg transition-colors"
                                >
                                  <Trash2 size={12} />
                                  <span>
                                    {currentStatus === "trash"
                                      ? "Permanently Delete"
                                      : "Delete to Trash"}
                                  </span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/40 text-xs">
            <span className="text-[var(--color-mute)]">
              Showing <span className="font-bold text-[var(--color-ink)]">{(page - 1) * pageSize + 1}</span> to{" "}
              <span className="font-bold text-[var(--color-ink)]">
                {Math.min(page * pageSize, total)}
              </span>{" "}
              of <span className="font-bold text-[var(--color-ink)]">{total}</span> machines
            </span>

            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => updateQuery({ page: String(page - 1) })}
                className="px-2.5 py-1 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-hairline-soft-surface)]"
              >
                Previous
              </button>
              <span className="px-2 font-mono text-[var(--color-mute)]">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => updateQuery({ page: String(page + 1) })}
                className="px-2.5 py-1 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--color-hairline-soft-surface)]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
