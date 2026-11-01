"use client";

import React, { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RfqListItem } from "@reachinternational/types";
import type { RfqDashboardStats, SalesUserOption } from "@/lib/queries/rfq";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Search,
  Filter,
  Plus,
  LayoutGrid,
  List,
  Building2,
  Calendar,
  User,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  XCircle,
  Bell,
  RefreshCw,
} from "lucide-react";

interface RfqDashboardClientProps {
  initialItems: RfqListItem[];
  initialStats: RfqDashboardStats;
  salesUsers: SalesUserOption[];
  currentRole: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; border: string }
> = {
  new: {
    label: "New",
    bg: "bg-blue-50 dark:bg-blue-950/60",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-900/60",
  },
  under_review: {
    label: "Under Review",
    bg: "bg-amber-50 dark:bg-amber-950/60",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-900/60",
  },
  contacted: {
    label: "Contacted",
    bg: "bg-purple-50 dark:bg-purple-950/60",
    text: "text-purple-700 dark:text-purple-400",
    border: "border-purple-200 dark:border-purple-900/60",
  },
  quotation_prepared: {
    label: "Quote Drafted",
    bg: "bg-indigo-50 dark:bg-indigo-950/60",
    text: "text-indigo-700 dark:text-indigo-400",
    border: "border-indigo-200 dark:border-indigo-900/60",
  },
  quotation_sent: {
    label: "Quote Sent",
    bg: "bg-sky-50 dark:bg-sky-950/60",
    text: "text-sky-700 dark:text-sky-400",
    border: "border-sky-200 dark:border-sky-900/60",
  },
  on_hold: {
    label: "On Hold",
    bg: "bg-neutral-100 dark:bg-neutral-800",
    text: "text-neutral-700 dark:text-neutral-300",
    border: "border-neutral-200 dark:border-neutral-700",
  },
  converted: {
    label: "Converted",
    bg: "bg-emerald-50 dark:bg-emerald-950/60",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-900/60",
  },
  lost: {
    label: "Lost",
    bg: "bg-red-50 dark:bg-red-950/60",
    text: "text-red-700 dark:text-red-400",
    border: "border-red-200 dark:border-red-900/60",
  },
  spam: {
    label: "Spam",
    bg: "bg-neutral-100 dark:bg-neutral-900",
    text: "text-neutral-500 dark:text-neutral-400",
    border: "border-neutral-200 dark:border-neutral-800",
  },
};

export function RfqDashboardClient({
  initialItems,
  initialStats,
  salesUsers,
  currentRole,
}: RfqDashboardClientProps) {
  const router = useRouter();
  const [items, setItems] = useState<RfqListItem[]>(initialItems);
  const [stats, setStats] = useState<RfqDashboardStats>(initialStats);
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [newRfqAlert, setNewRfqAlert] = useState<string | null>(null);

  // Sync state with props
  useEffect(() => {
    setItems(initialItems);
    setStats(initialStats);
  }, [initialItems, initialStats]);

  // Realtime subscription for incoming quote requests
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("rfq-realtime-channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "quote_requests",
        },
        (payload: any) => {
          const newRfq = payload.new as any;
          setNewRfqAlert(
            `New RFQ received: ${newRfq.rfq_number || "Pending"} (${newRfq.project_city || "Pan-India"})`
          );
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  // Helper for overdue check
  const checkIsOverdue = (item: RfqListItem) => {
    return Boolean(
      item.follow_up_at &&
        new Date(item.follow_up_at) < new Date() &&
        !["converted", "lost", "spam"].includes(item.status)
    );
  };

  const getAssigneeName = (userId: string | null) => {
    if (!userId) return null;
    return salesUsers.find((u) => u.id === userId)?.full_name || null;
  };

  // Filter items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const isOverdue = checkIsOverdue(item);

      // Tab filter
      if (activeTab === "new" && item.status !== "new") return false;
      if (activeTab === "under_review" && item.status !== "under_review") return false;
      if (activeTab === "quoted" && !["quotation_prepared", "quotation_sent"].includes(item.status))
        return false;
      if (activeTab === "converted" && item.status !== "converted") return false;
      if (activeTab === "lost" && item.status !== "lost") return false;
      if (activeTab === "overdue" && !isOverdue) return false;

      // Source filter
      if (sourceFilter !== "all" && item.source !== sourceFilter) return false;

      // Assignee filter
      if (assigneeFilter !== "all") {
        if (assigneeFilter === "unassigned" && item.assigned_to) return false;
        if (assigneeFilter !== "unassigned" && item.assigned_to !== assigneeFilter) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const rfqMatch = item.rfq_number?.toLowerCase().includes(query);
        const compMatch = item.company_name?.toLowerCase().includes(query);
        const contMatch = item.contact_name?.toLowerCase().includes(query);
        const cityMatch = item.project_city?.toLowerCase().includes(query);
        const equipMatch = item.headline?.toLowerCase().includes(query);
        if (!rfqMatch && !compMatch && !contMatch && !cityMatch && !equipMatch) return false;
      }

      return true;
    });
  }, [items, activeTab, sourceFilter, assigneeFilter, searchQuery, salesUsers]);

  return (
    <div className="space-y-6">
      {/* Realtime Alert Banner */}
      {newRfqAlert && (
        <div className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs text-sky-900 shadow-xs dark:border-sky-900/60 dark:bg-sky-950/50 dark:text-sky-300">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 animate-bounce text-sky-600 dark:text-sky-400" />
            <span className="font-semibold">{newRfqAlert}</span>
          </div>
          <button
            onClick={() => {
              setNewRfqAlert(null);
              router.refresh();
            }}
            className="flex items-center gap-1 rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-sky-700 shadow-2xs hover:bg-sky-100 dark:bg-neutral-900 dark:text-sky-300"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Sales & Enquiries — Quote Requests
          </h1>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Manage incoming equipment enquiries, review site feasibility, prepare quotations, and track sales pipeline.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/sales/rfq/clients"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800/60 transition-colors"
          >
            <Building2 className="h-3.5 w-3.5" />
            Clients Directory
          </Link>

          {["super_admin", "admin"].includes(currentRole) && (
            <Link
              href="/admin/sales/rfq/settings"
              className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800/60 transition-colors"
            >
              Business Settings
            </Link>
          )}

          <Link
            href="/admin/sales/rfq/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-sky-500 active:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            New Manual RFQ
          </Link>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Active Requests */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900/60">
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            Active Pipeline
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-neutral-900 dark:text-white">
              {stats.total_active}
            </span>
            <FileText className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          </div>
        </div>

        {/* New Unassigned */}
        <div className="rounded-xl border border-blue-200/80 bg-blue-50/40 p-4 shadow-2xs dark:border-blue-900/40 dark:bg-blue-950/20">
          <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300">
            New Enquiries
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-blue-900 dark:text-blue-200">
              {stats.new_count}
            </span>
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          </div>
        </div>

        {/* Under Review */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900/60">
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            Under Review
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-neutral-900 dark:text-white">
              {stats.under_review_count}
            </span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
        </div>

        {/* Quotes Sent */}
        <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900/60">
          <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            Quotations Sent
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-neutral-900 dark:text-white">
              {stats.quotation_sent_count}
            </span>
            <TrendingUp className="h-4 w-4 text-sky-500" />
          </div>
        </div>

        {/* Converted */}
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-2xs dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
            Won / Converted
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xl font-bold text-emerald-900 dark:text-emerald-200">
              {stats.converted_count}
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        {/* Overdue Follow-ups */}
        <div className={`rounded-xl border p-4 shadow-2xs ${
          stats.overdue_count > 0
            ? "border-red-200 bg-red-50/50 dark:border-red-900/50 dark:bg-red-950/30"
            : "border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900/60"
        }`}>
          <span className={`text-[11px] font-medium ${
            stats.overdue_count > 0 ? "text-red-700 dark:text-red-400" : "text-neutral-500 dark:text-neutral-400"
          }`}>
            Overdue Follow-ups
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className={`text-xl font-bold ${
              stats.overdue_count > 0 ? "text-red-900 dark:text-red-300" : "text-neutral-900 dark:text-white"
            }`}>
              {stats.overdue_count}
            </span>
            <AlertTriangle className={`h-4 w-4 ${stats.overdue_count > 0 ? "text-red-600" : "text-neutral-400"}`} />
          </div>
        </div>
      </div>

      {/* Tabs and Controls Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-3 shadow-2xs sm:flex-row sm:items-center sm:justify-between dark:border-neutral-800 dark:bg-neutral-900/60">
        {/* Status Tab Strip */}
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: "all", label: "All RFQs" },
            { id: "new", label: `New (${stats.new_count})` },
            { id: "under_review", label: "Review" },
            { id: "quoted", label: "Quoted" },
            { id: "converted", label: "Converted" },
            { id: "lost", label: "Lost" },
            { id: "overdue", label: `Overdue (${stats.overdue_count})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                activeTab === tab.id
                  ? "bg-neutral-950 text-white dark:bg-white dark:text-neutral-950"
                  : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950 dark:text-neutral-400 dark:hover:bg-neutral-800/70 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Right View Switcher */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-0.5 text-xs dark:border-neutral-800 dark:bg-neutral-800/80">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`rounded-md p-1.5 transition-all ${
                viewMode === "table"
                  ? "bg-white text-neutral-950 shadow-xs dark:bg-neutral-900 dark:text-white"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400"
              }`}
              title="Table view"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              className={`rounded-md p-1.5 transition-all ${
                viewMode === "kanban"
                  ? "bg-white text-neutral-950 shadow-xs dark:bg-neutral-900 dark:text-white"
                  : "text-neutral-500 hover:text-neutral-900 dark:text-neutral-400"
              }`}
              title="Kanban Board view"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {/* Search */}
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search by RFQ #, company, contact, city, equipment..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 bg-white py-2 pl-9 pr-3 text-xs text-neutral-900 shadow-2xs focus:border-sky-500 focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-100"
          />
        </div>

        {/* Source Filter */}
        <div>
          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 shadow-2xs focus:border-sky-500 focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-100"
          >
            <option value="all">All Sources</option>
            <option value="website">Website Form</option>
            <option value="equipment_page">Equipment Page</option>
            <option value="phone">Phone Call</option>
            <option value="whatsapp">WhatsApp Enquiry</option>
            <option value="email">Direct Email</option>
            <option value="walk_in">Walk-in Client</option>
            <option value="referral">Referral</option>
          </select>
        </div>

        {/* Assignee Filter */}
        <div>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-900 shadow-2xs focus:border-sky-500 focus:outline-hidden dark:border-neutral-800 dark:bg-neutral-900/60 dark:text-neutral-100"
          >
            <option value="all">All Sales Owners</option>
            <option value="unassigned">Unassigned</option>
            {salesUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name} ({u.role})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content: Table or Kanban */}
      {viewMode === "table" ? (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-2xs dark:border-neutral-800 dark:bg-neutral-900/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-neutral-100 bg-neutral-50/70 text-[11px] font-semibold text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/40 dark:text-neutral-400">
                <tr>
                  <th className="py-3 px-4">RFQ Ref #</th>
                  <th className="py-3 px-4">Client / Company</th>
                  <th className="py-3 px-4">Machines & Scope</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Assigned To</th>
                  <th className="py-3 px-4">Follow-Up</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-neutral-400">
                      No quote requests found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const statusConf = STATUS_CONFIG[item.status] || STATUS_CONFIG.new;
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors"
                      >
                        {/* RFQ Ref */}
                        <td className="py-3 px-4 font-mono font-semibold text-sky-600 dark:text-sky-400">
                          <Link
                            href={`/admin/sales/rfq/${item.id}`}
                            className="hover:underline flex items-center gap-1"
                          >
                            <span>{item.rfq_number}</span>
                          </Link>
                          <span className="block text-[10px] font-sans text-neutral-400 capitalize">
                            via {item.source.replace("_", " ")}
                          </span>
                        </td>

                        {/* Client / Company */}
                        <td className="py-3 px-4">
                          <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                            {item.company_name || item.contact_name}
                          </div>
                          {item.company_name && (
                            <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                              Attn: {item.contact_name}
                            </div>
                          )}
                          <div className="text-[10px] text-neutral-400">
                            {item.phone || item.email}
                          </div>
                        </td>

                        {/* Machines & Scope */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="truncate font-medium text-neutral-800 dark:text-neutral-200">
                            {item.headline || "Equipment Item"}
                          </div>
                          <div className="text-[11px] text-neutral-500">
                            {item.item_count} machine{item.item_count > 1 ? "s" : ""} •{" "}
                            <span className="capitalize font-semibold text-neutral-700 dark:text-neutral-300">
                              {item.types?.join(", ") || "Rental"}
                            </span>
                          </div>
                        </td>

                        {/* Location */}
                        <td className="py-3 px-4">
                          <span className="font-medium text-neutral-800 dark:text-neutral-200">
                            {item.project_city}
                          </span>
                          <span className="text-[11px] text-neutral-400 block">
                            {item.project_state_code}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}
                          >
                            {statusConf.label}
                          </span>
                        </td>

                        {/* Assigned To */}
                        <td className="py-3 px-4">
                          {getAssigneeName(item.assigned_to) ? (
                            <span className="inline-flex items-center gap-1 font-medium text-neutral-700 dark:text-neutral-300">
                              <User className="h-3.5 w-3.5 text-neutral-400" />
                              {getAssigneeName(item.assigned_to)}
                            </span>
                          ) : (
                            <span className="text-[11px] italic text-neutral-400">
                              Unassigned
                            </span>
                          )}
                        </td>

                        {/* Follow-Up */}
                        <td className="py-3 px-4">
                          {item.follow_up_at ? (
                            <div className="flex flex-col">
                              <span
                                className={`text-[11px] font-medium ${
                                  checkIsOverdue(item)
                                    ? "text-red-600 font-semibold dark:text-red-400"
                                    : "text-neutral-600 dark:text-neutral-400"
                                }`}
                              >
                                {new Date(item.follow_up_at).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                })}
                              </span>
                              {checkIsOverdue(item) && (
                                <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">
                                  Overdue
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-neutral-400 text-[11px]">—</span>
                          )}
                        </td>

                        {/* Action Link */}
                        <td className="py-3 px-4 text-right">
                          <Link
                            href={`/admin/sales/rfq/${item.id}`}
                            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2.5 py-1 text-xs font-semibold text-neutral-700 shadow-2xs hover:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
                          >
                            <span>Open</span>
                            <ChevronRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Kanban Board View */
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { id: "new", title: "New Enquiries", color: "border-blue-500" },
            { id: "under_review", title: "Under Feasibility Review", color: "border-amber-500" },
            { id: "quotation_sent", title: "Quotations Dispatched", color: "border-sky-500" },
            { id: "converted", title: "Won / Converted", color: "border-emerald-500" },
          ].map((col) => {
            const colItems = filteredItems.filter((i) => {
              if (col.id === "quotation_sent") {
                return ["quotation_prepared", "quotation_sent"].includes(i.status);
              }
              return i.status === col.id;
            });

            return (
              <div
                key={col.id}
                className="flex flex-col rounded-xl border border-neutral-200 bg-neutral-50/50 p-3 dark:border-neutral-800 dark:bg-neutral-900/40"
              >
                <div
                  className={`flex items-center justify-between border-b-2 ${col.color} pb-2.5 mb-3`}
                >
                  <h3 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                    {col.title}
                  </h3>
                  <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                    {colItems.length}
                  </span>
                </div>

                <div className="space-y-3 overflow-y-auto max-h-[600px] pr-1">
                  {colItems.length === 0 ? (
                    <div className="py-8 text-center text-[11px] text-neutral-400 italic">
                      No RFQs in this stage
                    </div>
                  ) : (
                    colItems.map((card) => (
                      <Link
                        key={card.id}
                        href={`/admin/sales/rfq/${card.id}`}
                        className="block rounded-lg border border-neutral-200 bg-white p-3 shadow-2xs hover:border-sky-500 hover:shadow-xs transition-all dark:border-neutral-800 dark:bg-neutral-900"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                            {card.rfq_number}
                          </span>
                          <span className="text-neutral-400 text-[10px]">
                            {card.project_city}
                          </span>
                        </div>

                        <div className="mt-1 font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                          {card.company_name || card.contact_name}
                        </div>

                        <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2">
                          {card.headline || "Equipment Item"}
                        </p>

                        <div className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2 text-[10px] text-neutral-400 dark:border-neutral-800">
                          <span>{card.item_count} unit(s)</span>
                          <span className="font-medium text-neutral-600 dark:text-neutral-300 truncate max-w-[100px]">
                            {getAssigneeName(card.assigned_to) || "Unassigned"}
                          </span>
                        </div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
