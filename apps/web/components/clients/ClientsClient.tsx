"use client";

import { useState, useMemo } from "react";
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
import { Edit2, Trash2, MoreVertical, ShieldAlert, CheckCircle2, Building2, MapPin, Phone, Mail, Hash, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { CRMClient, User } from "@/lib/types/database";
import { ClientModal } from "./ClientModal";
import { softDeleteClientAction } from "@/app/actions/clients";

interface ClientsClientProps {
  user: User;
  initialClients: CRMClient[];
}

export function ClientsClient({ user, initialClients }: ClientsClientProps) {
  const [clients, setClients] = useState<CRMClient[]>(initialClients);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<CRMClient | null>(null);

  const [deletingClient, setDeletingClient] = useState<CRMClient | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const canManageClients = ["super_admin", "admin", "branch_manager", "service_manager", "rental_manager", "sales_executive"].includes(user.role);

  // Filtered clients list
  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        client.client_name.toLowerCase().includes(q) ||
        client.code.toLowerCase().includes(q) ||
        (client.company_name && client.company_name.toLowerCase().includes(q)) ||
        (client.contact_person && client.contact_person.toLowerCase().includes(q)) ||
        (client.phone && client.phone.toLowerCase().includes(q)) ||
        (client.email && client.email.toLowerCase().includes(q)) ||
        (client.city && client.city.toLowerCase().includes(q)) ||
        (client.gstin && client.gstin.toLowerCase().includes(q));

      const matchesStatus = statusFilter === "all" || client.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [clients, searchQuery, statusFilter]);

  // Metrics summary
  const metrics = useMemo(() => {
    const total = clients.length;
    const active = clients.filter((c) => c.status === "active").length;
    const inactive = clients.filter((c) => c.status === "inactive").length;
    const cities = new Set(clients.map((c) => c.city).filter(Boolean)).size;

    return { total, active, inactive, cities };
  }, [clients]);

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
      setClients((prev) =>
        prev.map((c) => (c.id === deletingClient.id ? { ...c, status: "inactive", deleted_at: new Date().toISOString() } : c))
      );
      setToastMessage({ type: "success", text: `Client "${deletingClient.client_name}" soft-deleted successfully.` });
      setDeletingClient(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Toast Notice */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`flex items-center justify-between rounded-lg px-4 py-3 text-xs font-semibold shadow-md ${
              toastMessage.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {toastMessage.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" />
              )}
              <span>{toastMessage.text}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-neutral-500 hover:text-neutral-700"
            >
              <AnimatedX className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-[var(--color-border,#ebebeb)] bg-[var(--color-bg-elevated,#ffffff)] p-4 sm:p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <AnimatedUsers className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-[var(--color-ink,#171717)] tracking-tight">
                Client & Customer Directory
              </h1>
              <p className="text-xs text-neutral-500">
                Manage registered client accounts, stored contact info, tax parameters, and monthly running log associations.
              </p>
            </div>
          </div>
        </div>

        {canManageClients && (
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-primary,#0070f3)] px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-600 focus:outline-hidden transition-all shrink-0"
          >
            <AnimatedPlus className="h-4 w-4" />
            Add New Client
          </button>
        )}
      </div>

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[var(--color-border,#ebebeb)] bg-[var(--color-bg-elevated,#ffffff)] p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
            <span>Total Clients</span>
            <Building2 className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-xl font-extrabold text-[var(--color-ink,#171717)]">{metrics.total}</p>
          <span className="text-[10px] text-neutral-400">Directory accounts</span>
        </div>

        <div className="rounded-xl border border-[var(--color-border,#ebebeb)] bg-[var(--color-bg-elevated,#ffffff)] p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
            <span>Active Clients</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-xl font-extrabold text-emerald-600">{metrics.active}</p>
          <span className="text-[10px] text-neutral-400">Operational accounts</span>
        </div>

        <div className="rounded-xl border border-[var(--color-border,#ebebeb)] bg-[var(--color-bg-elevated,#ffffff)] p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
            <span>Inactive Clients</span>
            <ShieldAlert className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-xl font-extrabold text-amber-600">{metrics.inactive}</p>
          <span className="text-[10px] text-neutral-400">Deactivated or soft-deleted</span>
        </div>

        <div className="rounded-xl border border-[var(--color-border,#ebebeb)] bg-[var(--color-bg-elevated,#ffffff)] p-3.5 shadow-xs">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-1">
            <span>Locations Covered</span>
            <MapPin className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-xl font-extrabold text-[var(--color-ink,#171717)]">{metrics.cities}</p>
          <span className="text-[10px] text-neutral-400">Unique cities / hubs</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-xl border border-[var(--color-border,#ebebeb)] bg-[var(--color-bg-elevated,#ffffff)] p-3 shadow-xs">
        {/* Search */}
        <div className="relative flex-1">
          <AnimatedSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by client name, code, contact person, phone, email, GSTIN, city..."
            className="w-full rounded-lg border border-[var(--color-border,#ebebeb)] bg-neutral-50/50 pl-9 pr-3 py-2 text-xs text-[var(--color-ink,#171717)] placeholder:text-neutral-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border,#ebebeb)] bg-neutral-50 p-1">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === "all"
                ? "bg-white text-[var(--color-ink,#171717)] shadow-xs"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            All ({clients.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === "active"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            Active ({metrics.active})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("inactive")}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
              statusFilter === "inactive"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            Inactive ({metrics.inactive})
          </button>
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-hidden rounded-xl border border-[var(--color-border,#ebebeb)] bg-[var(--color-bg-elevated,#ffffff)] shadow-xs">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--color-border,#ebebeb)] bg-neutral-50 text-[11px] font-semibold text-neutral-600 uppercase tracking-wider">
              <th className="py-2.5 px-3">Code</th>
              <th className="py-2.5 px-3">Client Name</th>
              <th className="py-2.5 px-3">Contact Person</th>
              <th className="py-2.5 px-3">Phone / Email</th>
              <th className="py-2.5 px-3">City / State</th>
              <th className="py-2.5 px-3">GSTIN</th>
              <th className="py-2.5 px-3">Status</th>
              {canManageClients && <th className="py-2.5 px-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border,#ebebeb)]">
            {filteredClients.length === 0 ? (
              <tr>
                <td colSpan={canManageClients ? 8 : 7} className="py-12 text-center text-neutral-400">
                  <Building2 className="mx-auto h-8 w-8 text-neutral-300 mb-2" />
                  <p className="font-semibold text-neutral-600">No clients found</p>
                  <p className="text-xs">Try adjusting your search query or status filter.</p>
                </td>
              </tr>
            ) : (
              filteredClients.map((client) => (
                <tr key={client.id} className="hover:bg-neutral-50/80 transition-colors">
                  <td className="py-2.5 px-3 font-mono font-bold text-blue-600 whitespace-nowrap">
                    {client.code}
                  </td>

                  <td className="py-2.5 px-3">
                    <div className="font-bold text-[var(--color-ink,#171717)]">{client.client_name}</div>
                    {client.company_name && (
                      <div className="text-[10px] text-neutral-400">{client.company_name}</div>
                    )}
                  </td>

                  <td className="py-2.5 px-3 font-medium text-neutral-700">
                    {client.contact_person || "—"}
                  </td>

                  <td className="py-2.5 px-3">
                    {client.phone && (
                      <div className="font-mono text-neutral-800 whitespace-nowrap flex items-center gap-1">
                        <Phone className="h-3 w-3 text-neutral-400" />
                        {client.phone}
                      </div>
                    )}
                    {client.email && (
                      <div className="text-[10px] text-neutral-500 flex items-center gap-1">
                        <Mail className="h-3 w-3 text-neutral-400" />
                        {client.email}
                      </div>
                    )}
                    {!client.phone && !client.email && <span className="text-neutral-400">—</span>}
                  </td>

                  <td className="py-2.5 px-3 font-medium text-neutral-700">
                    {[client.city, client.state].filter(Boolean).join(", ") || "—"}
                  </td>

                  <td className="py-2.5 px-3 font-mono text-[11px] text-neutral-600 uppercase">
                    {client.gstin || "—"}
                  </td>

                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {client.deleted_at ? (
                      <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-200">
                        SOFT DELETED
                      </span>
                    ) : client.status === "active" ? (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600 border border-neutral-200">
                        INACTIVE
                      </span>
                    )}
                  </td>

                  {canManageClients && (
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(client)}
                          className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-blue-600 transition-colors"
                          title="Edit Client"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingClient(client)}
                          className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600 transition-colors"
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
      </div>

      {/* Mobile Touch Cards View */}
      <div className="block sm:hidden space-y-3">
        {filteredClients.length === 0 ? (
          <div className="rounded-xl border border-[var(--color-border,#ebebeb)] bg-[var(--color-bg-elevated,#ffffff)] p-8 text-center text-neutral-400">
            <Building2 className="mx-auto h-8 w-8 text-neutral-300 mb-2" />
            <p className="font-semibold text-neutral-600">No clients found</p>
            <p className="text-xs">Try adjusting your search query.</p>
          </div>
        ) : (
          filteredClients.map((client) => (
            <div
              key={client.id}
              className="rounded-xl border border-[var(--color-border,#ebebeb)] bg-[var(--color-bg-elevated,#ffffff)] p-3.5 shadow-xs space-y-2.5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-xs font-bold text-blue-600">{client.code}</span>
                  <h3 className="text-sm font-bold text-[var(--color-ink,#171717)]">{client.client_name}</h3>
                  {client.company_name && (
                    <p className="text-[10px] text-neutral-400">{client.company_name}</p>
                  )}
                </div>

                {client.deleted_at ? (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-200">
                    SOFT DELETED
                  </span>
                ) : client.status === "active" ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    ACTIVE
                  </span>
                ) : (
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-neutral-600 border border-neutral-200">
                    INACTIVE
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs border-t border-[var(--color-border,#ebebeb)] pt-2 text-neutral-600">
                <div>
                  <span className="block text-[10px] text-neutral-400">Contact Person</span>
                  <span className="font-semibold text-[var(--color-ink,#171717)]">{client.contact_person || "—"}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-neutral-400">Location</span>
                  <span className="font-semibold text-[var(--color-ink,#171717)]">{[client.city, client.state].filter(Boolean).join(", ") || "—"}</span>
                </div>
                {client.phone && (
                  <div>
                    <span className="block text-[10px] text-neutral-400">Phone</span>
                    <span className="font-mono text-[var(--color-ink,#171717)]">{client.phone}</span>
                  </div>
                )}
                {client.gstin && (
                  <div>
                    <span className="block text-[10px] text-neutral-400">GSTIN</span>
                    <span className="font-mono text-[10px] text-[var(--color-ink,#171717)] uppercase">{client.gstin}</span>
                  </div>
                )}
              </div>

              {canManageClients && (
                <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border,#ebebeb)] pt-2.5">
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(client)}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-[var(--color-border,#ebebeb)] bg-neutral-50 px-3 py-2 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-blue-600" />
                    Edit Details
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingClient(client)}
                    className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
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
          <div className="relative w-full max-w-md rounded-xl border border-[var(--color-border,#ebebeb)] bg-[var(--color-bg-elevated,#ffffff)] p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 border border-red-200">
                <ShieldAlert className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[var(--color-ink,#171717)]">Soft Delete Client?</h3>
                <p className="text-xs text-neutral-500 font-mono">{deletingClient.code}</p>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="font-semibold mb-1">Historical Logs Preservation Guarantee:</p>
              <p>
                Soft-deleting <strong>"{deletingClient.client_name}"</strong> sets its status to inactive. All historical machine running logs, delivery challans, and monthly billing reports will remain 100% intact in the system.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border,#ebebeb)] pt-3">
              <button
                type="button"
                onClick={() => setDeletingClient(null)}
                disabled={isDeleting}
                className="rounded-lg border border-[var(--color-border,#ebebeb)] bg-white px-4 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSoftDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
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
