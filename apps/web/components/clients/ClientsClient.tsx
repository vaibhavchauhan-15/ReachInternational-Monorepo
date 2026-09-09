"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  AnimatedUsers,
  AnimatedSearch,
  AnimatedPlus,
  AnimatedBuilding2,
  AnimatedMapPin,
  AnimatedPhone,
  AnimatedMail,
  AnimatedFileText,
  AnimatedAlertTriangle,
  AnimatedCheck,
  AnimatedX,
  AnimatedRefresh,
} from "@/components/ui/animated-icons";
import { Edit2, Trash2, ShieldAlert, CheckCircle2, Building2, MapPin, Phone, Mail, Loader2, Receipt } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { CRMClient, User } from "@/lib/types/database";
import { ClientModal } from "./ClientModal";
import { softDeleteClientAction } from "@/app/actions/clients";
import { Button, PageHeader, Pagination } from "@/components/ui";

interface ClientsClientProps {
  user: User;
  initialClients: CRMClient[];
  total: number;
  page: number;
  pageSize: number;
  metrics: {
    total: number;
    active: number;
    inactive: number;
    cities: number;
  };
}

export function ClientsClient({ user, initialClients, total, page, pageSize, metrics }: ClientsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Initialize state from URL
  const initialSearch = searchParams.get("search") || "";
  const initialStatus = (searchParams.get("status") as "all" | "active" | "inactive") || "all";

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(initialStatus);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<CRMClient | null>(null);
  const [deletingClient, setDeletingClient] = useState<CRMClient | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const canManageClients = ["super_admin", "admin", "manager", "service_manager"].includes(user.role);

  // Sync state to URL with debounce for search
  const updateFilters = useCallback(
    (updates: { page?: number; search?: string; status?: "all" | "active" | "inactive" }) => {
      const current = new URLSearchParams(Array.from(searchParams.entries()));

      if (updates.page !== undefined) current.set("page", updates.page.toString());
      if (updates.search !== undefined) {
        if (updates.search) current.set("search", updates.search);
        else current.delete("search");
        if (updates.page === undefined) current.set("page", "1"); // reset page on search change
      }
      if (updates.status !== undefined) {
        if (updates.status !== "all") current.set("status", updates.status);
        else current.delete("status");
        if (updates.page === undefined) current.set("page", "1"); // reset page on status change
      }

      startTransition(() => {
        router.push(`${pathname}?${current.toString()}`);
      });
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== (searchParams.get("search") || "")) {
        updateFilters({ search: searchQuery });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchParams, updateFilters]);

  function handleStatusChange(newStatus: "all" | "active" | "inactive") {
    setStatusFilter(newStatus);
    updateFilters({ status: newStatus });
  }

  function handleOpenAddModal() {
    setEditingClient(null);
    setIsModalOpen(true);
  }

  function handleOpenEditModal(client: CRMClient) {
    setEditingClient(client);
    setIsModalOpen(true);
  }

  async function handleConfirmSoftDelete() {
    if (!deletingClient) return;
    setIsDeleting(true);

    const res = await softDeleteClientAction(deletingClient.id);
    setIsDeleting(false);

    if (res.error) {
      setToastMessage({ type: "error", text: res.error });
    } else {
      setToastMessage({ type: "success", text: `Client "${deletingClient.company_name || deletingClient.client_name}" soft-deleted successfully.` });
      setDeletingClient(null);
      // Let Server Action revalidation update the data
    }
  }

  return (
    <div className={`space-y-4 transition-opacity duration-200 ${isPending ? "opacity-60 pointer-events-none" : "opacity-100"}`}>
      {/* Toast Notice */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`flex items-center justify-between rounded-lg px-4 py-3 text-xs font-semibold shadow-md ${
              toastMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60"
                : "bg-red-50 text-red-800 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/60"
            }`}
          >
            <div className="flex items-center gap-2">
              {toastMessage.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
              )}
              <span>{toastMessage.text}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-[var(--color-mute)] hover:text-[var(--color-ink)] cursor-pointer"
            >
              <AnimatedX className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Header */}
      <PageHeader
        title="Client Directory"
        description="Manage registered client accounts, stored contact info, tax parameters, and monthly running log associations."
        actions={
          canManageClients ? (
            <Button
              variant="primary"
              icon={<AnimatedPlus className="h-4 w-4" />}
              responsive
              onClick={handleOpenAddModal}
            >
              Add New Client
            </Button>
          ) : null
        }
      />

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--color-mute)] mb-1">
            <span>Total Clients</span>
            <Building2 className="h-4 w-4 text-sky-500" />
          </div>
          <p className="text-xl font-extrabold text-[var(--color-ink)]">{metrics.total}</p>
          <span className="text-[10px] text-[var(--color-mute)]">Directory accounts</span>
        </div>

        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--color-mute)] mb-1">
            <span>Active Clients</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">{metrics.active}</p>
          <span className="text-[10px] text-[var(--color-mute)]">Operational accounts</span>
        </div>

        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--color-mute)] mb-1">
            <span>Inactive Clients</span>
            <ShieldAlert className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400">{metrics.inactive}</p>
          <span className="text-[10px] text-[var(--color-mute)]">Deactivated or soft-deleted</span>
        </div>

        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[var(--color-mute)] mb-1">
            <span>Locations Covered</span>
            <MapPin className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-xl font-extrabold text-[var(--color-ink)]">{metrics.cities}</p>
          <span className="text-[10px] text-[var(--color-mute)]">Unique cities / hubs</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 shadow-xs">
        {/* Search */}
        <div className="relative flex-1">
          <AnimatedSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-mute)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by company name, code, GSTIN, PAN, contact, city, district, state..."
            className="w-full rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] pl-9 pr-3 py-2 text-xs text-[var(--color-ink)] placeholder:text-[var(--color-mute)] focus:bg-[var(--color-canvas-elevated)] focus:outline-hidden focus:ring-2 focus:ring-sky-500 transition-all"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)] p-1">
          <button
            type="button"
            onClick={() => handleStatusChange("all")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "all"
                ? "bg-[var(--color-canvas-elevated)] text-[var(--color-ink)] shadow-xs"
                : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
            }`}
          >
            All ({metrics.total})
          </button>
          <button
            type="button"
            onClick={() => handleStatusChange("active")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "active"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
            }`}
          >
            Active ({metrics.active})
          </button>
          <button
            type="button"
            onClick={() => handleStatusChange("inactive")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === "inactive"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
            }`}
          >
            Inactive ({metrics.inactive})
          </button>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-hidden rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[11px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
              <th className="py-2.5 px-4">Code</th>
              <th className="py-2.5 px-4">Company & Tax</th>
              <th className="py-2.5 px-4">Contact Person</th>
              <th className="py-2.5 px-4">Phone</th>
              <th className="py-2.5 px-4">Site Location</th>
              <th className="py-2.5 px-4">Status</th>
              {canManageClients && <th className="py-2.5 px-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-hairline)]">
            {initialClients.length === 0 ? (
              <tr>
                <td colSpan={canManageClients ? 7 : 6} className="py-12 text-center text-[var(--color-mute)]">
                  <Building2 className="mx-auto h-8 w-8 text-[var(--color-mute)]/60 mb-2" />
                  <p className="font-semibold text-[var(--color-ink)]">No clients found</p>
                  <p className="text-xs">Try adjusting your search query or status filter.</p>
                </td>
              </tr>
            ) : (
              initialClients.map((client) => (
                <tr key={client.id} className="hover:bg-[var(--color-hairline-soft-surface)]/60 transition-colors">
                  <td className="py-2.5 px-4 font-mono font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                    {client.code}
                  </td>

                  <td className="py-2.5 px-4">
                    <div className="font-bold text-[var(--color-ink)]">
                      {client.company_name || client.client_name}
                    </div>
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

                  <td className="py-2.5 px-4 font-medium text-[var(--color-body)]">
                    {client.contact_person || "—"}
                  </td>

                  <td className="py-2.5 px-4">
                    {client.phone ? (
                      <div className="font-mono text-[var(--color-ink)] whitespace-nowrap flex items-center gap-1">
                        <Phone className="h-3 w-3 text-[var(--color-mute)]" />
                        {client.phone}
                      </div>
                    ) : (
                      <span className="text-[var(--color-mute)]">—</span>
                    )}
                  </td>

                  <td className="py-2.5 px-4 font-medium text-[var(--color-body)]">
                    <div>
                      {[client.city, client.district, client.state].filter(Boolean).join(", ") || "—"}
                    </div>
                    {client.is_billing_address_different && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                        <Receipt className="h-3 w-3" /> Separate Billing
                      </span>
                    )}
                  </td>

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

                  {canManageClients && (
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(client)}
                          className="rounded-md p-1.5 text-[var(--color-mute)] hover:bg-[var(--color-hairline-soft-surface)] hover:text-sky-600 transition-colors cursor-pointer"
                          title="Edit Client"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingClient(client)}
                          className="rounded-md p-1.5 text-[var(--color-mute)] hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400 transition-colors cursor-pointer"
                          title="Soft Delete Client"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {total > pageSize && (
          <div className="px-4 py-2 border-t border-[var(--color-hairline)] bg-[var(--color-canvas)]">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={(newPage) => updateFilters({ page: newPage })}
            />
          </div>
        )}
      </div>

      {/* Mobile Touch Cards View */}
      <div className="block sm:hidden space-y-3">
        {initialClients.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-8 text-center text-[var(--color-mute)]">
            <Building2 className="mx-auto h-8 w-8 text-[var(--color-mute)]/60 mb-2" />
            <p className="font-semibold text-[var(--color-ink)]">No clients found</p>
            <p className="text-xs">Try adjusting your search query.</p>
          </div>
        ) : (
          initialClients.map((client) => (
            <div
              key={client.id}
              className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 shadow-xs space-y-2.5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">{client.code}</span>
                  <h3 className="text-sm font-bold text-[var(--color-ink)]">{client.company_name || client.client_name}</h3>
                  {(client.gstin || client.pan_number) && (
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
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
                </div>

                {client.deleted_at ? (
                  <span className="rounded-full bg-red-50 dark:bg-red-950/60 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/80">
                    SOFT DELETED
                  </span>
                ) : client.status === "active" ? (
                  <span className="rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80">
                    ACTIVE
                  </span>
                ) : (
                  <span className="rounded-full bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 text-[10px] font-bold text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                    INACTIVE
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs border-t border-[var(--color-hairline)] pt-2 text-[var(--color-body)]">
                <div>
                  <span className="block text-[10px] text-[var(--color-mute)]">Contact Person</span>
                  <span className="font-semibold text-[var(--color-ink)]">{client.contact_person || "—"}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-[var(--color-mute)]">Location</span>
                  <span className="font-semibold text-[var(--color-ink)]">{[client.city, client.district, client.state].filter(Boolean).join(", ") || "—"}</span>
                </div>
                {client.phone && (
                  <div className="col-span-2">
                    <span className="block text-[10px] text-[var(--color-mute)]">Phone</span>
                    <span className="font-mono text-[var(--color-ink)]">{client.phone}</span>
                  </div>
                )}
                {client.is_billing_address_different && (
                  <div className="col-span-2 text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                    <Receipt className="h-3 w-3" />
                    Billing: {[client.billing_city, client.billing_state].filter(Boolean).join(", ") || "Different"}
                  </div>
                )}
              </div>

              {canManageClients && (
                <div className="flex items-center justify-end gap-2 border-t border-[var(--color-hairline)] pt-2.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(client)}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-xs font-semibold text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                    Edit Details
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingClient(client)}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-800/80 bg-red-50 dark:bg-red-950/40 px-3 py-2 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Soft Delete
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
      
      {total > pageSize && (
        <div className="block sm:hidden px-1 pt-2">
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            onPageChange={(newPage) => updateFilters({ page: newPage })}
          />
        </div>
      )}

      {/* Add / Edit Client Modal */}
      <ClientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        client={editingClient}
        onSuccess={() => {
          setToastMessage({
            type: "success",
            text: editingClient ? "Client details updated successfully." : "New client registered successfully.",
          });
        }}
      />

      {/* Soft Delete Confirmation Modal */}
      {deletingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80">
                <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--color-ink)]">Soft Delete Client?</h3>
                <p className="text-xs text-[var(--color-mute)] font-mono">{deletingClient.code}</p>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-800 dark:text-amber-300">
              <p className="font-semibold mb-1">Historical Logs Preservation Guarantee:</p>
              <p>
                Soft-deleting <strong>&ldquo;{deletingClient.company_name || deletingClient.client_name}&rdquo;</strong> sets its status to inactive. All historical machine running logs, delivery challans, and monthly billing reports will remain 100% intact in the system.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--color-hairline)] pt-3">
              <button
                type="button"
                onClick={() => setDeletingClient(null)}
                disabled={isDeleting}
                className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] px-4 py-2 text-xs font-medium text-[var(--color-body)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSoftDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Confirm Soft Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
