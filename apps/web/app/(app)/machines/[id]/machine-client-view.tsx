"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  AnimatedChevronLeft,
  AnimatedEdit,
  AnimatedClock,
  AnimatedBuilding2,
  AnimatedFileText,
  AnimatedPackage,
  AnimatedSettings,
  AnimatedWrench,
  AnimatedCheck,
  AnimatedCopy,
  AnimatedMessageSquare,
  AnimatedTrash,
} from "@/components/ui/animated-icons";
import { ScissorLiftLogoIcon } from "@/components/branding/ScissorLiftLogoIcon";
import { Phone, Mail, Check, Copy, MapPin, AlertTriangle, CheckCircle2, FileText, Wrench, PackageCheck, Building2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardHeader,
  Badge,
  Button,
  EmptyState,
  FadeIn,
  Modal,
  useToast,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  ConfirmationDialog,
} from "@/components/ui";
import dynamic from "next/dynamic";
import type { MachineWithEngineer, ServiceRecordWithDetails } from "@/lib/types/database";
import { formatDate, formatShiftTimingRange } from "@reachinternational/utils";
import { deleteMachine } from "@/app/actions/machines";

const ServiceForm = dynamic(() => import("./service-form").then((mod) => mod.ServiceForm), { ssr: false });

function formatComplianceDate(dateStr?: string | null): string {
  if (!dateStr) return "1st January 1970";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = d.getDate();
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const suffix = (day === 1 || day === 21 || day === 31) ? "st" : (day === 2 || day === 22) ? "nd" : (day === 3 || day === 23) ? "rd" : "th";
    return `${day}${suffix} ${month} ${year}`;
  } catch {
    return dateStr;
  }
}

interface MachineClientViewProps {
  machine: MachineWithEngineer;
  serviceHistory: ServiceRecordWithDetails[];
  breakdownHistory?: any[];
  hourMeterLogs?: any[];
  partsUsedHistory?: any[];
  activeRental?: any;
  isAdmin: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  isAssignedEngineer: boolean;
  currentUserId: string;
}

export function MachineClientView({
  machine,
  serviceHistory,
  breakdownHistory = [],
  hourMeterLogs = [],
  partsUsedHistory = [],
  activeRental = null,
  isAdmin,
  canEdit,
  canDelete,
  isAssignedEngineer,
  currentUserId,
}: MachineClientViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "service_breakdown" | "running_hours" | "parts_used" | "service_interval" | "documents" | "complete_service"
  >("overview");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const allowEdit = canEdit ?? isAdmin;
  const allowDelete = canDelete ?? isAdmin;

  const handleDeleteMachine = () => {
    startDeleteTransition(async () => {
      const res = await deleteMachine(machine.id);
      if (res?.error) {
        toast("error", "Failed to delete machine", res.error);
        setDeleteConfirmOpen(false);
      } else {
        toast("success", "Machine deleted", `${machine.machine_id} has been permanently deleted.`);
        router.push("/machines");
        router.refresh();
      }
    });
  };

  // Calculate Due Status
  const today = new Date().toISOString().split("T")[0];
  const todayDate = new Date();
  const nextDueDateStr = machine.next_service_due_date || today;
  const dueDate = new Date(nextDueDateStr);
  const diffTime = dueDate.getTime() - todayDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let dueVariant: "today" | "tomorrow" | "overdue" | "default" = "default";
  let dueLabel = "Scheduled";

  if (nextDueDateStr < today) {
    dueVariant = "overdue";
    dueLabel = `Overdue by ${Math.abs(diffDays)}d`;
  } else if (nextDueDateStr === today) {
    dueVariant = "today";
    dueLabel = "Due Today";
  } else if (diffDays === 1) {
    dueVariant = "tomorrow";
    dueLabel = "Due Tomorrow";
  } else if (diffDays > 1) {
    dueLabel = `Due in ${diffDays}d`;
  }

  const handleCopyCode = () => {
    navigator.clipboard.writeText(machine.machine_code || machine.machine_id);
    setCopiedCode(true);
    toast("success", "Copied!", `Machine code ${machine.machine_code || machine.machine_id} copied to clipboard.`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const clientInfo = activeRental?.client || activeRental?.customer || {
    company_name: machine.customer_name,
    client_name: machine.customer_name,
    code: machine.customer_name ? "CLI-0001" : undefined,
    contact_person: machine.customer_name,
    phone: machine.customer_mobile,
    contact_mobile: machine.customer_mobile,
    email: machine.customer_email,
    contact_email: machine.customer_email,
    address: machine.customer_address,
    billing_address: machine.customer_address,
    city: machine.city,
    state: machine.state,
  };

  const clientPhone = clientInfo.phone || clientInfo.contact_mobile || machine.customer_mobile || "";
  const clientEmail = clientInfo.email || clientInfo.contact_email || machine.customer_email || "";
  const clientAddress = clientInfo.address || clientInfo.billing_address || machine.customer_address || "";
  const clientLocation = `${clientInfo.city || machine.city || ""}${clientInfo.state || machine.state ? (clientInfo.city || machine.city ? ", " : "") + (clientInfo.state || machine.state) : ""}`.trim();
  const hasClientInfo = !!(clientInfo.company_name || clientInfo.client_name || machine.customer_name || clientPhone || clientAddress);

  const handleCopyAddress = () => {
    const fullAddr = `${clientAddress}${clientLocation ? `, ${clientLocation}` : ""}`.trim();
    navigator.clipboard.writeText(fullAddr || "—");
    setCopiedAddress(true);
    toast("info", "Address Copied!", "Deployment address copied to clipboard.");
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const cleanPhone = clientPhone ? clientPhone.replace(/[^0-9+]/g, "") : "";
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    `Hello ${clientInfo.contact_person || clientInfo.company_name || machine.customer_name || "Client"}, regarding machine ${machine.machine_code || machine.machine_id} (${machine.model || machine.machine_name}).`
  )}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${clientInfo.company_name || machine.customer_name || ""} ${clientAddress} ${clientLocation}`.trim()
  )}`;

  return (
    <div className="flex flex-col gap-4 sm:gap-6 pb-20 md:pb-8 max-w-7xl mx-auto px-2 sm:px-4 md:px-6 w-full">
      {/* Top Breadcrumb Navigation */}
      <FadeIn className="flex items-center justify-between">
        <Link
          href="/machines"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors group py-1"
        >
          <motion.div whileTap={{ scale: 0.85 }} className="flex items-center">
            <AnimatedChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Machines</span>
          </motion.div>
        </Link>
      </FadeIn>

      {/* Hero Machine Banner Card */}
      <FadeIn delay={0.05}>
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-5 md:p-6 shadow-2xs transition-all">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-[var(--color-link)]/10 blur-3xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 relative z-10">
            <div className="flex items-start gap-3 sm:gap-4">
              <motion.div
                whileHover={{ scale: 1.05, rotate: 2 }}
                whileTap={{ scale: 0.95 }}
                className="flex h-11 w-11 sm:h-13 sm:w-13 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white shadow-md border border-neutral-800"
              >
                <ScissorLiftLogoIcon size={24} className="text-sky-400" />
              </motion.div>

              <div className="flex flex-col gap-1 min-w-0 flex-1">
                {/* Name & Badges Header */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <h1 className="text-lg sm:text-2xl md:text-3xl font-extrabold text-[var(--color-ink)] tracking-tight">
                    {machine.machine_name || machine.machine_id}
                  </h1>

                  <Badge
                    variant={machine.status === "on_rent" || machine.status === "rented" ? "info" : machine.status === "active" ? "success" : machine.status === "under_maintenance" ? "warning" : "neutral"}
                  >
                    <span className="capitalize font-semibold text-[11px] sm:text-xs">
                      {machine.status === "on_rent" || machine.status === "rented" ? "On Rent" : machine.status === "under_maintenance" ? "Under Maintenance" : machine.status}
                    </span>
                  </Badge>

                  <Badge variant={dueVariant} dot>
                    <span className="font-semibold text-[11px] sm:text-xs">{dueLabel}</span>
                  </Badge>
                </div>

                {/* Machine Code & Model */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--color-mute)]">
                  <div className="inline-flex items-center gap-1">
                    <span className="font-mono text-[11px] sm:text-xs text-[var(--color-mute)]">ID:</span>
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={handleCopyCode}
                      title="Copy Unique Code"
                      className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-md text-[11px] sm:text-xs font-mono bg-[var(--color-hairline-soft-surface)] hover:bg-[var(--color-hairline)] text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-all active:scale-95 border border-[var(--color-hairline)] cursor-pointer"
                    >
                      <span>{machine.machine_code || machine.machine_id}</span>
                      {copiedCode ? (
                        <AnimatedCheck size={11} className="text-emerald-600" />
                      ) : (
                        <AnimatedCopy size={11} className="text-[var(--color-mute)]" />
                      )}
                    </motion.button>
                  </div>
                  {machine.model && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-[11px] sm:text-xs text-[var(--color-mute)]">Model: {machine.model}</span>
                    </>
                  )}
                  {machine.serial_number && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-[11px] sm:text-xs text-[var(--color-mute)]">Sr: {machine.serial_number}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              {allowEdit && (
                <Button
                  variant="secondary"
                  icon={<AnimatedEdit size={15} className="text-[var(--color-body)]" />}
                  responsive
                  href={`/machines/${machine.id}/edit`}
                >
                  Edit Machine
                </Button>
              )}
              {allowDelete && (
                <Button
                  variant="destructive"
                  icon={<AnimatedTrash size={15} />}
                  responsive
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={isDeleting}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Segmented Navigation Tabs Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar bg-[var(--color-hairline-soft-surface)]/70 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border border-[var(--color-hairline)]">
        {[
          { id: "overview", label: "Basic Info & Client", icon: AnimatedBuilding2 },
          { id: "service_breakdown", label: `Service & Breakdown History (${serviceHistory.length + breakdownHistory.length})`, icon: AnimatedWrench },
          { id: "running_hours", label: `Hour Meter Running History (${hourMeterLogs.length})`, icon: AnimatedClock },
          { id: "parts_used", label: `All Parts Used History (${partsUsedHistory.length})`, icon: AnimatedPackage },
          { id: "service_interval", label: "Service Interval Schedule", icon: AnimatedSettings },
          { id: "documents", label: "Compliance & Expiry", icon: AnimatedFileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 py-1.5 px-2.5 sm:py-2 sm:px-3 rounded-lg sm:rounded-xl text-xs font-bold transition-all relative whitespace-nowrap shrink-0 select-none cursor-pointer ${
                isActive
                  ? "text-sky-600 dark:text-sky-400 font-extrabold"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
            >
              <Icon size={14} className="shrink-0" />
              <span>{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTabPill"
                  className="absolute inset-0 bg-[var(--color-canvas-elevated)] rounded-lg sm:rounded-xl shadow-2xs border border-[var(--color-hairline)] -z-10"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Main Tab Content Panels */}
      <AnimatePresence mode="wait">
        {/* TAB 1: BASIC INFO & CLIENT */}
        {activeTab === "overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-4 sm:gap-6"
          >
            {/* Basic Info Card */}
            <Card padding="md" className="card-hover-system sm:p-6">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--color-hairline)]">
                <h3 className="text-sm sm:text-base font-bold text-[var(--color-ink)]">
                  Basic Info
                </h3>
                <Badge variant={machine.status === "rented" || machine.status === "on_rent" ? "info" : "neutral"} dot>
                  <span className="font-semibold uppercase tracking-wider text-[10px] sm:text-xs">
                    {machine.status === "rented" || machine.status === "on_rent" ? "On Rent" : "Available"}
                  </span>
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5 mt-3.5 text-xs sm:text-sm">
                <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Machine ID</span>
                  <span className="font-bold text-[var(--color-ink)] font-mono text-xs sm:text-sm">{machine.machine_id}</span>
                </div>

                <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Model</span>
                  <span className="font-bold text-[var(--color-ink)] text-xs sm:text-sm">{machine.model || "-"}</span>
                </div>

                <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Serial No</span>
                  <span className="font-bold text-[var(--color-ink)] font-mono text-xs sm:text-sm">{machine.serial_number || "-"}</span>
                </div>

                <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Year Of Mfg (YUM)</span>
                  <span className="font-bold text-[var(--color-ink)] text-xs sm:text-sm">{machine.year_of_mfg || "-"}</span>
                </div>

                <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Manufacturer</span>
                  <span className="font-bold text-[var(--color-ink)] text-xs sm:text-sm">{machine.manufacturer || "-"}</span>
                </div>

                <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Hour Meter (HMR)</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400 font-mono text-xs sm:text-sm">{machine.hour_meter ?? 0} hrs</span>
                </div>

                <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Services Logged</span>
                  <span className="font-bold text-[var(--color-ink)] text-xs sm:text-sm">{machine.service_count ?? 0}</span>
                </div>

                <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Supervisor</span>
                  <span className="font-bold text-[var(--color-ink)] text-xs sm:text-sm truncate">{machine.current_supervisor?.full_name || "-"}</span>
                </div>

                <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Operator</span>
                  <span className="font-bold text-[var(--color-ink)] text-xs sm:text-sm truncate">{machine.current_operator?.full_name || "-"}</span>
                </div>

                <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Health Status</span>
                  <span className="font-bold text-xs sm:text-sm capitalize text-[var(--color-ink)]">
                    {machine.health_status === "breakdown" ? "Breakdown" : machine.health_status === "under_maintenance" ? "Under Maintenance" : "Active"}
                  </span>
                </div>

                <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Rental Fleet Status</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400 text-xs sm:text-sm capitalize">
                    {machine.status === "rented" || machine.status === "on_rent" ? "On Rent" : "Available"}
                  </span>
                </div>
              </div>
            </Card>

            {/* Properly Assigned Client Details Section */}
            <Card padding="md" className="card-hover-system sm:p-6 border-sky-500/20 bg-gradient-to-b from-sky-500/[0.03] to-transparent">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--color-hairline)]">
                <div className="flex items-center gap-2">
                  <AnimatedBuilding2 size={18} className="text-sky-600 dark:text-sky-400" />
                  <h3 className="text-sm sm:text-base font-bold text-[var(--color-ink)]">
                    Assigned Client Details
                  </h3>
                </div>
                <Badge variant={machine.status === "on_rent" || machine.status === "rented" ? "info" : "neutral"}>
                  <span className="text-[10px] sm:text-xs font-semibold">
                    {machine.status === "on_rent" || machine.status === "rented" ? "On Rent Active" : "Site Deployed"}
                  </span>
                </Badge>
              </div>

              {hasClientInfo ? (
                <div className="flex flex-col gap-4 mt-4 text-xs sm:text-sm">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {/* Company / Client Name */}
                    <div className="flex flex-col p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)]">
                      <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">
                        Client / Company Name
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-bold text-[var(--color-ink)] text-sm sm:text-base">
                          {clientInfo.company_name || clientInfo.client_name || machine.customer_name}
                        </p>
                        {clientInfo.code && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                            {clientInfo.code}
                          </span>
                        )}
                      </div>
                      {activeRental?.contract_number && (
                        <span className="inline-block mt-1 font-mono text-[11px] text-sky-600 font-bold bg-sky-500/10 px-2 py-0.5 rounded self-start">
                          Contract: {activeRental.contract_number}
                        </span>
                      )}
                    </div>

                    {/* Contact Person */}
                    <div className="flex flex-col p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)]">
                      <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">
                        Contact Person
                      </span>
                      <p className="font-semibold text-[var(--color-ink)] text-xs sm:text-sm">
                        {clientInfo.contact_person || machine.customer_name || "—"}
                      </p>
                    </div>

                    {/* Contact Phone */}
                    <div className="flex flex-col p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)]">
                      <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">
                        Contact Mobile
                      </span>
                      {clientPhone ? (
                        <a
                          href={`tel:${clientPhone}`}
                          className="font-semibold text-[var(--color-link)] hover:underline inline-flex items-center gap-1.5 text-xs sm:text-sm font-mono"
                        >
                          <Phone className="h-3.5 w-3.5" /> {clientPhone}
                        </a>
                      ) : (
                        <p className="text-[var(--color-mute)]">—</p>
                      )}
                    </div>

                    {/* Contact Email */}
                    {clientEmail && (
                      <div className="flex flex-col p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)]">
                        <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">
                          Contact Email
                        </span>
                        <a
                          href={`mailto:${clientEmail}`}
                          className="font-medium text-[var(--color-link)] hover:underline inline-flex items-center gap-1.5 break-all text-xs sm:text-sm"
                        >
                          <Mail className="h-3.5 w-3.5 shrink-0" /> {clientEmail}
                        </a>
                      </div>
                    )}

                    {/* City & State */}
                    <div className="flex flex-col p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)]">
                      <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">
                        City & State
                      </span>
                      <p className="font-semibold text-[var(--color-ink)] text-xs sm:text-sm">
                        {clientLocation || "—"}
                      </p>
                    </div>

                    {/* GSTIN if present */}
                    {clientInfo.gstin && (
                      <div className="flex flex-col p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)]">
                        <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">
                          GSTIN
                        </span>
                        <p className="font-mono font-semibold text-[var(--color-ink)] text-xs sm:text-sm">
                          {clientInfo.gstin}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Site Address with 1-click Copy */}
                  <div className="flex flex-col p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">
                        Site Location / Deployment Address
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyAddress}
                        className="text-xs text-[var(--color-mute)] hover:text-[var(--color-ink)] inline-flex items-center gap-1 cursor-pointer"
                      >
                        {copiedAddress ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedAddress ? "Copied" : "Copy Address"}</span>
                      </button>
                    </div>
                    <p className="text-xs sm:text-sm text-[var(--color-ink)] leading-relaxed font-medium">
                      {clientAddress || "—"}
                    </p>
                  </div>

                  {/* Rental Contract Timeline & Rate if available */}
                  {activeRental && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)]">
                      <div>
                        <span className="text-[10px] text-[var(--color-mute)] font-bold uppercase block">Rental Start</span>
                        <span className="font-semibold text-xs sm:text-sm text-[var(--color-ink)]">{formatDate(activeRental.start_date)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--color-mute)] font-bold uppercase block">Rental End</span>
                        <span className="font-semibold text-xs sm:text-sm text-[var(--color-ink)]">{formatDate(activeRental.end_date)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--color-mute)] font-bold uppercase block">Rental Rate</span>
                        <span className="font-semibold text-xs sm:text-sm text-emerald-600">₹{activeRental.monthly_rate || activeRental.rental_rate || 0} / {activeRental.rate_unit || "month"}</span>
                      </div>
                    </div>
                  )}

                  {/* Quick Action Touch Buttons */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {clientPhone ? (
                      <motion.a
                        whileTap={{ scale: 0.96 }}
                        href={`tel:${clientPhone}`}
                        className="flex items-center justify-center gap-1.5 py-2 px-2.5 sm:py-2.5 sm:px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 transition-all text-center font-semibold text-xs"
                      >
                        <Phone className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span className="truncate">Call</span>
                      </motion.a>
                    ) : null}

                    {clientPhone ? (
                      <motion.a
                        whileTap={{ scale: 0.96 }}
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 py-2 px-2.5 sm:py-2.5 sm:px-3 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/20 transition-all text-center font-semibold text-xs"
                      >
                        <AnimatedMessageSquare size={14} className="shrink-0 text-green-600 dark:text-green-400" />
                        <span className="truncate">WhatsApp</span>
                      </motion.a>
                    ) : null}

                    <motion.a
                      whileTap={{ scale: 0.96 }}
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 py-2 px-2.5 sm:py-2.5 sm:px-3 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-500/20 transition-all text-center font-semibold text-xs"
                    >
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
                      <span className="truncate">Map Location</span>
                    </motion.a>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center bg-[var(--color-hairline-soft-surface)]/30 rounded-xl border border-dashed border-[var(--color-hairline)] mt-3 p-4">
                  <Building2 className="h-8 w-8 text-[var(--color-mute)] mx-auto mb-2 opacity-50" />
                  <p className="font-bold text-[var(--color-ink)] text-xs sm:text-sm">No Client Assigned</p>
                  <p className="text-xs text-[var(--color-mute)] mt-1 max-w-sm mx-auto">
                    This machine is currently available in the fleet inventory and has not been assigned to a client contract.
                  </p>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* TAB 2: SERVICE & BREAKDOWN HISTORY */}
        {activeTab === "service_breakdown" && (
          <motion.div
            key="service_breakdown"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-5"
          >
            <Card padding="lg">
              <CardHeader
                title="Service Records & Breakdown Malfunction History"
                eyebrow="Combined Maintenance & FSR Ledger"
                action={
                  <div className="flex items-center gap-2">
                    <Link href="/service?tab=complaints&action=create_complaint">
                      <Button variant="danger-sm" className="text-xs font-bold py-1.5 px-3">
                        <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Report Breakdown
                      </Button>
                    </Link>
                    {(isAssignedEngineer || isAdmin) && (
                      <Button
                        variant="primary"
                        onClick={() => setActiveTab("complete_service")}
                        className="text-xs font-bold py-1.5 px-3"
                      >
                        + Log Maintenance Service
                      </Button>
                    )}
                  </div>
                }
              />

              {serviceHistory.length === 0 && breakdownHistory.length === 0 ? (
                <div className="py-10 text-center">
                  <EmptyState
                    title="No Service or Breakdown Logs Found"
                    description="This machine has no recorded maintenance services or breakdown complaints logged yet."
                  />
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {/* Maintenance Service Records */}
                  {serviceHistory.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-1.5">
                        <Wrench className="h-4 w-4 text-sky-500" /> Maintenance Service Logs ({serviceHistory.length})
                      </h4>

                      <div className="w-full overflow-x-auto rounded-xl border border-[var(--color-hairline)]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Service Date</TableHead>
                              <TableHead>Category / Type</TableHead>
                              <TableHead>Meter (hrs)</TableHead>
                              <TableHead>Engineer</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Notes & Remarks</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {serviceHistory.map((s) => (
                              <TableRow key={s.id}>
                                <TableCell className="font-mono text-xs font-bold">{formatDate(s.service_date)}</TableCell>
                                <TableCell className="font-semibold text-xs">{s.service_category || "Routine Service"}</TableCell>
                                <TableCell className="font-mono text-xs">{s.hour_meter || 0} hrs</TableCell>
                                <TableCell className="text-xs">{s.engineer?.full_name || "Assigned Engineer"}</TableCell>
                                <TableCell>
                                  <Badge variant={s.service_status === "completed" ? "success" : "warning"}>
                                    <span className="capitalize">{s.service_status || "completed"}</span>
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-[var(--color-mute)] max-w-xs truncate">{s.notes || "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Breakdown Complaints */}
                  {breakdownHistory.length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-[var(--color-hairline)]">
                      <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-ink)] flex items-center gap-1.5">
                        <AlertTriangle className="h-4 w-4 text-amber-500" /> Breakdown Malfunction Reports ({breakdownHistory.length})
                      </h4>

                      <div className="w-full overflow-x-auto rounded-xl border border-[var(--color-hairline)]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Complaint No</TableHead>
                              <TableHead>Reported Date</TableHead>
                              <TableHead>Malfunction Details</TableHead>
                              <TableHead>Required Part</TableHead>
                              <TableHead>Engineer / Supervisor</TableHead>
                              <TableHead>FSR Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {breakdownHistory.map((b) => (
                              <TableRow key={b.id}>
                                <TableCell className="font-mono text-xs font-bold text-red-600 dark:text-red-400">{b.complaint_no}</TableCell>
                                <TableCell className="font-mono text-xs">{formatDate(b.complaint_date)}</TableCell>
                                <TableCell className="text-xs font-medium max-w-xs truncate">{b.complaint}</TableCell>
                                <TableCell className="text-xs font-mono">{b.required_part ? `${b.required_part} (${b.part_quantity || 1})` : "-"}</TableCell>
                                <TableCell className="text-xs">{b.engineer?.full_name || b.supervisor?.full_name || "Technician"}</TableCell>
                                <TableCell>
                                  <Badge variant={b.status === "resolved" ? "success" : b.status === "in_progress" ? "info" : "overdue"}>
                                    <span className="capitalize">{b.status}</span>
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* TAB 3: HOUR METER RUNNING HISTORY */}
        {activeTab === "running_hours" && (
          <motion.div
            key="running_hours"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <Card padding="lg">
              <CardHeader
                title="Hour Meter Running Machine History"
                eyebrow="Operator Daily Logbook with Client & Operator Details"
                action={
                  <Link href="/operations?tab=logs">
                    <Button variant="secondary" className="text-xs font-bold py-1.5 px-3">
                      + Add Meter Log Entry
                    </Button>
                  </Link>
                }
              />

              {hourMeterLogs.length === 0 ? (
                <div className="py-10 text-center">
                  <EmptyState
                    title="No Running Meter Logs Logged"
                    description="Daily hour meter logbook entries recorded by machine operators will be displayed here."
                  />
                </div>
              ) : (
                <div className="mt-4 w-full overflow-x-auto rounded-xl border border-[var(--color-hairline)]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Log Date</TableHead>
                        <TableHead>Client Company</TableHead>
                        <TableHead>Operator</TableHead>
                        <TableHead>Operating Hours</TableHead>
                        <TableHead>Meter Reading (Start → End)</TableHead>
                        <TableHead>Overtime</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hourMeterLogs.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs font-bold">{formatDate(log.log_date)}</TableCell>
                          <TableCell className="font-medium text-xs">{clientInfo.company_name || machine.customer_name}</TableCell>
                          <TableCell className="text-xs font-semibold">{log.operator?.full_name || "Operator"}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {log.start_time && log.end_time ? formatShiftTimingRange(log.start_time, log.end_time) : `${log.running_hours || 0} hrs`}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-sky-600 dark:text-sky-400 font-bold">
                            {log.start_meter || 0} → {log.end_meter || 0} (+{log.running_hours || 0}h)
                          </TableCell>
                          <TableCell className="font-mono text-xs text-amber-600 font-semibold">
                            {log.overtime_hours ? `+${log.overtime_hours} hrs` : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-[var(--color-mute)] max-w-xs truncate">{log.remarks || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* TAB 4: ALL PARTS USED HISTORY */}
        {activeTab === "parts_used" && (
          <motion.div
            key="parts_used"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <Card padding="lg">
              <CardHeader
                title="All Spare Parts Used & Issued History"
                eyebrow="Inventory Issue Challan Ledger"
                action={
                  <Link href="/inventory?tab=issue">
                    <Button variant="secondary" className="text-xs font-bold py-1.5 px-3">
                      <PackageCheck className="h-3.5 w-3.5 mr-1" /> Issue Part to Machine
                    </Button>
                  </Link>
                }
              />

              {partsUsedHistory.length === 0 ? (
                <div className="py-10 text-center">
                  <EmptyState
                    title="No Spare Parts Issued"
                    description="No inventory parts or spare components have been issued to this machine yet."
                  />
                </div>
              ) : (
                <div className="mt-4 w-full overflow-x-auto rounded-xl border border-[var(--color-hairline)]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Challan / Issue No</TableHead>
                        <TableHead>Issue Date</TableHead>
                        <TableHead>Part Number & Description</TableHead>
                        <TableHead>Qty Issued</TableHead>
                        <TableHead>Issued To</TableHead>
                        <TableHead>Returnable</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {partsUsedHistory.flatMap((issue: any) =>
                        (issue.items || []).map((item: any) => (
                          <TableRow key={`${issue.id}-${item.id}`}>
                            <TableCell className="font-mono text-xs font-bold text-sky-600">{issue.challan_number || issue.issue_number}</TableCell>
                            <TableCell className="font-mono text-xs">{formatDate(issue.issue_date)}</TableCell>
                            <TableCell className="text-xs">
                              <span className="font-mono font-bold block">{item.product?.part_number || "PART-SPEC"}</span>
                              <span className="text-[var(--color-mute)]">{item.product?.name || "Spare Component"}</span>
                            </TableCell>
                            <TableCell className="font-mono text-xs font-bold">{item.quantity_issued} {item.unit || "Pcs"}</TableCell>
                            <TableCell className="text-xs">{issue.issued_to_name || "Service Technician"}</TableCell>
                            <TableCell>
                              <Badge variant={item.is_returnable ? "warning" : "neutral"}>
                                {item.is_returnable ? "Returnable" : "Non-Returnable"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={issue.status === "issued" ? "success" : "neutral"}>
                                <span className="capitalize">{issue.status}</span>
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          </motion.div>
        )}

        {/* TAB 5: SERVICE INTERVAL & SCHEDULE */}
        {activeTab === "service_interval" && (
          <motion.div
            key="service_interval"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-6"
          >
            <Card padding="lg">
              <CardHeader
                title="Service Interval & Scheduled Maintenance Rules"
                eyebrow="Routine Inspection Cycles (90 Days / 180 Days / 250 Hrs / 500 Hrs)"
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 text-xs sm:text-sm">
                <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider block">Service Frequency Interval</span>
                  <p className="text-xl font-extrabold text-[var(--color-ink)]">{machine.service_interval_days || 90} Days</p>
                  <p className="text-[11px] text-[var(--color-mute)]">Recommended preventive maintenance cycle</p>
                </div>

                <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider block">Last Serviced Date</span>
                  <p className="text-xl font-extrabold text-[var(--color-ink)]">{machine.last_service_date ? formatDate(machine.last_service_date) : "Never Serviced"}</p>
                  <p className="text-[11px] text-[var(--color-mute)]">Last logged maintenance completion</p>
                </div>

                <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider block">Next Service Due Date</span>
                  <p className="text-xl font-extrabold text-[var(--color-link)]">{formatDate(machine.next_service_due_date)}</p>
                  <p className="text-[11px] text-amber-600 font-semibold">{dueLabel}</p>
                </div>
              </div>

              {/* Maintenance Schedule Checklist Matrix */}
              <div className="mt-6 pt-5 border-t border-[var(--color-hairline)] space-y-4">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-ink)]">
                  Standard Preventive Maintenance Checklist Rules
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/50 space-y-1">
                    <span className="font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" /> 90-Day / 250-Hour Interval
                    </span>
                    <p className="text-[var(--color-mute)] leading-relaxed">
                      Engine oil filter replacement, air filter inspection/cleaning (`{machine.air_filter_no || "Standard"}`), hydraulic fluid check, battery voltage test, and starter motor teeth inspection (`{machine.starter_motor_teeth || "Standard"}`).
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/50 space-y-1">
                    <span className="font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 text-sky-600" /> 180-Day / 500-Hour Interval
                    </span>
                    <p className="text-[var(--color-mute)] leading-relaxed">
                      Diesel fuel filter replacement (`{machine.diesel_filter_no || "Standard"}`), headgas kit notch inspection (`{machine.headgas_kit_notch || "Standard"}`), front tyre (`{machine.front_tyre_size || "Standard"}`) & back tyre (`{machine.back_tyre_size || "Standard"}`) wear check, brake pads, and hydraulic hose stress test.
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* TAB 6: COMPLIANCE DOCUMENTS */}
        {activeTab === "documents" && (
          <motion.div
            key="documents"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <Card padding="lg">
              <CardHeader
                title="Machine Compliance Documents & Certificates"
                eyebrow="Compliance Vault"
                action={
                  <Link href="/documents?action=upload">
                    <Button variant="primary" className="text-xs font-bold py-1.5 px-3">
                      <FileText className="h-3.5 w-3.5 mr-1" /> Upload Certificate
                    </Button>
                  </Link>
                }
              />
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[var(--color-ink)]">Insurance Policy Certificate</span>
                    <Badge variant="warning">Policy Logged</Badge>
                  </div>
                  <p className="text-[var(--color-mute)]">Policy No: {machine.insurance_policy_no || "-"}</p>
                  <p className="text-[var(--color-mute)]">Expires: {formatComplianceDate(machine.insurance_expiry_date)}</p>
                </div>

                <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[var(--color-ink)]">Third Party Fitness Certificate</span>
                    <Badge variant="success">Valid</Badge>
                  </div>
                  <p className="text-[var(--color-mute)]">Cert No: {machine.third_party_certificate || "-"}</p>
                  <p className="text-[var(--color-mute)]">Expires: {formatComplianceDate(machine.third_party_expiry_date)}</p>
                </div>

                <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[var(--color-ink)]">RTO Tax Receipt</span>
                    <Badge variant="success">Paid</Badge>
                  </div>
                  <p className="text-[var(--color-mute)]">Tax Receipt No: {machine.rto_tax || "-"}</p>
                  <p className="text-[var(--color-mute)]">Expires: {machine.rto_tax_expiry_date ? formatComplianceDate(machine.rto_tax_expiry_date) : "-"}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* TAB 7: COMPLETE SERVICE FORM */}
        {activeTab === "complete_service" && (isAssignedEngineer || isAdmin) && (
          <motion.div
            key="complete_service"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <Card padding="lg" className="shadow-sm border-[var(--color-link)]/20">
              <CardHeader
                title="Complete Maintenance Service"
                eyebrow="Field Logger"
                action={
                  <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Auto-updates Schedule
                  </span>
                }
              />
              <div className="mt-4">
                <ServiceForm machineId={machine.id} engineerId={currentUserId} />
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Lightbox Modal for attached photos */}
      <Modal open={!!selectedPhoto} onClose={() => setSelectedPhoto(null)} title="Photo Attachment Preview" size="lg">
        {selectedPhoto && (
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-full max-h-[70vh] flex items-center justify-center overflow-hidden rounded-xl bg-neutral-950 p-2">
              <Image
                src={selectedPhoto}
                alt="Enlarged photo preview"
                width={800}
                height={600}
                unoptimized
                className="max-h-[65vh] w-auto object-contain rounded-lg shadow-lg"
              />
            </div>
            <div className="flex justify-end w-full">
              <Button variant="secondary" onClick={() => setSelectedPhoto(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteMachine}
        title="Delete Machine"
        description={`Are you sure you want to permanently delete machine ${machine.machine_id} (${machine.model || "Unknown Model"})? This action cannot be undone and will remove related logs.`}
        confirmLabel="Delete Machine"
        cancelLabel="Keep Machine"
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
}
