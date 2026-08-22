"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  AnimatedChevronLeft,
  AnimatedEdit,
  AnimatedCalendarClock,
  AnimatedAlertTriangle,
  AnimatedWrench,
  AnimatedPhone,
  AnimatedMail,
  AnimatedMessageSquare,
  AnimatedMapPin,
  AnimatedCopy,
  AnimatedCheck,
  AnimatedUserCheck,
  AnimatedClock,
  AnimatedCheckCircle,
  AnimatedSparkles,
  AnimatedShieldCheck,
  AnimatedActivity,
  AnimatedHistory,
  AnimatedBuilding2,
  AnimatedFileText,
  AnimatedPackage,
  AnimatedSettings,
} from "@/components/ui/animated-icons";
import { Phone, Mail, Check, Copy, MapPin, Navigation, UserCheck, AlertTriangle, CheckCircle2, FileText, Layers, ShieldCheck, Tag, Wrench, PackageCheck, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardHeader,
  Badge,
  Button,
  EmptyState,
  FadeIn,
  SlideUp,
  AnimatedCounter,
  AnimatedProgress,
  Modal,
  useToast,
  RefreshButton,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui";
import dynamic from "next/dynamic";
import type { MachineWithEngineer, ServiceRecordWithDetails } from "@/lib/types/database";
import { formatDate } from "@reachinternational/utils";

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
  isAssignedEngineer,
  currentUserId,
}: MachineClientViewProps) {
  const { toast } = useToast();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "service_breakdown" | "running_hours" | "parts_used" | "service_interval" | "documents" | "complete_service"
  >("overview");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Calculate Due Status & Health Metrics
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
    dueLabel = `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"}`;
  } else if (nextDueDateStr === today) {
    dueVariant = "today";
    dueLabel = "Due Today";
  } else if (diffDays === 1) {
    dueVariant = "tomorrow";
    dueLabel = "Due Tomorrow";
  } else if (diffDays > 1) {
    dueLabel = `Due in ${diffDays} days`;
  }

  // Calculate visual health score (0% to 100%)
  const totalDays = machine.service_interval_days || 30;
  const daysPassed = totalDays - Math.max(0, diffDays);
  const healthPercentage = Math.max(0, Math.min(100, Math.round(((totalDays - daysPassed) / totalDays) * 100)));

  const handleCopyCode = () => {
    navigator.clipboard.writeText(machine.machine_code || machine.machine_id);
    setCopiedCode(true);
    toast("success", "Copied!", `Machine code ${machine.machine_code} copied to clipboard.`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyAddress = () => {
    const cityStr = machine.city || "";
    const stateStr = machine.state || "";
    const fullAddr = `${machine.customer_address || ""}, ${cityStr}, ${stateStr}`.trim();
    navigator.clipboard.writeText(fullAddr);
    setCopiedAddress(true);
    toast("info", "Address Copied!", "Customer address copied to clipboard.");
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const cleanPhone = machine.customer_mobile ? machine.customer_mobile.replace(/[^0-9+]/g, "") : "";
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    `Hello ${machine.customer_name}, regarding machine ${machine.machine_code} (${machine.machine_name}).`
  )}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${machine.customer_name} ${machine.customer_address || ""} ${machine.city || ""} ${machine.state || ""}`
  )}`;

  const clientInfo = activeRental?.customer || {
    company_name: machine.customer_name,
    contact_person: machine.customer_name,
    contact_mobile: machine.customer_mobile,
    contact_email: machine.customer_email,
    billing_address: machine.customer_address,
    city: machine.city,
    state: machine.state,
  };

  return (
    <div className="flex flex-col gap-5 pb-20 md:pb-8 max-w-7xl mx-auto px-1 sm:px-0">
      {/* Top Breadcrumb Header */}
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
        <span className="text-xs text-[var(--color-mute)] flex items-center gap-1.5 font-mono">
          <AnimatedShieldCheck size={14} className="text-[var(--color-link)]" />
          <span className="hidden xs:inline">REACH INTERNATIONAL</span> Fleet Portal
        </span>
      </FadeIn>

      {/* Hero Machine Banner Card */}
      <FadeIn delay={0.05}>
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 sm:p-6 shadow-sm transition-all">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 h-48 w-48 rounded-full bg-[var(--color-link)]/10 blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="flex items-start gap-3 sm:gap-4">
              <motion.div
                whileHover={{ scale: 1.05, rotate: 3 }}
                whileTap={{ scale: 0.95 }}
                className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white shadow-md border border-neutral-800"
              >
                <AnimatedWrench size={24} className="text-sky-400" />
              </motion.div>

              <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                {/* Name & Badges Header */}
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[var(--color-ink)] tracking-tight">
                    {machine.machine_name}
                  </h1>

                  <Badge variant={machine.status === "on_rent" ? "info" : machine.status === "active" ? "success" : machine.status === "under_maintenance" ? "warning" : "neutral"}>
                    <span className="capitalize font-semibold">{machine.status === "on_rent" ? "On Rent" : machine.status === "under_maintenance" ? "Under Maintenance" : machine.status}</span>
                  </Badge>

                  <Badge variant={dueVariant} dot>
                    <span className="font-semibold">{dueLabel}</span>
                  </Badge>
                </div>

                {/* Machine Code & Model */}
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs sm:text-sm text-[var(--color-mute)]">
                  <div className="inline-flex items-center gap-1">
                    <span className="font-mono text-xs text-[var(--color-mute)]">Unique ID:</span>
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={handleCopyCode}
                      title="Copy Unique Code"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono bg-[var(--color-hairline-soft-surface)] hover:bg-[var(--color-hairline)] text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-all active:scale-95 border border-[var(--color-hairline)]"
                    >
                      <span>{machine.machine_code}</span>
                      {copiedCode ? (
                        <AnimatedCheck size={12} className="text-emerald-600" />
                      ) : (
                        <AnimatedCopy size={12} className="text-[var(--color-mute)]" />
                      )}
                    </motion.button>
                  </div>
                  {machine.model && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-xs text-[var(--color-mute)]">Model: {machine.model}</span>
                    </>
                  )}
                  {machine.serial_number && (
                    <>
                      <span>•</span>
                      <span className="font-mono text-xs text-[var(--color-mute)]">Serial: {machine.serial_number}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Header Action Buttons */}
            <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
              <RefreshButton path={`/machines/${machine.id}`} tag={`machine:${machine.id}`} />

              {isAdmin && (
                <Link href={`/machines/${machine.id}/edit`} className="flex-1 sm:flex-initial">
                  <Button variant="secondary" className="w-full sm:w-auto text-xs sm:text-sm py-2 px-3 shadow-2xs">
                    <AnimatedEdit size={16} className="mr-1 text-[var(--color-body)]" /> Edit Machine
                  </Button>
                </Link>
              )}

              {(isAssignedEngineer || isAdmin) && (
                <Button
                  variant="primary"
                  onClick={() => {
                    setActiveTab("complete_service");
                    window.scrollTo({ top: 350, behavior: "smooth" });
                  }}
                  className="flex-1 sm:flex-initial text-xs sm:text-sm py-2 px-3.5 shadow-sm hover:shadow-md active:scale-98 transition-all"
                >
                  <AnimatedSparkles size={16} className="mr-1 text-amber-300" /> Log Service
                </Button>
              )}
            </div>
          </div>

          {/* Client Touch Quick Actions */}
          <div className="mt-4 pt-3.5 border-t border-[var(--color-hairline)] flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold text-[var(--color-mute)] uppercase tracking-wider">
                Client & Site Contact Actions
              </span>
              {machine.status === "on_rent" && (
                <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400">
                  Client: {clientInfo.company_name}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <motion.a
                whileTap={{ scale: 0.94 }}
                href={`tel:${clientInfo.contact_mobile || machine.customer_mobile}`}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 transition-all text-center group"
              >
                <AnimatedPhone size={16} className="mb-0.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold leading-tight">Call Client</span>
                <span className="text-[10px] text-[var(--color-mute)] truncate max-w-full font-mono mt-0.5">
                  {clientInfo.contact_mobile || machine.customer_mobile}
                </span>
              </motion.a>

              <motion.a
                whileTap={{ scale: 0.94 }}
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/20 transition-all text-center group"
              >
                <AnimatedMessageSquare size={16} className="mb-0.5 text-green-600 dark:text-green-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold leading-tight">WhatsApp</span>
                <span className="text-[10px] text-[var(--color-mute)] truncate max-w-full mt-0.5">Direct Chat</span>
              </motion.a>

              <motion.a
                whileTap={{ scale: 0.94 }}
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-700 dark:text-sky-400 border border-sky-500/20 transition-all text-center group"
              >
                <AnimatedMapPin size={16} className="mb-0.5 text-sky-600 dark:text-sky-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold leading-tight">Map Site</span>
                <span className="text-[10px] text-[var(--color-mute)] truncate max-w-full mt-0.5">
                  {machine.city || "New Delhi"}
                </span>
              </motion.a>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Scorecard Metrics Grid */}
      <SlideUp delay={0.1}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
          <Card padding="sm" className="relative overflow-hidden border-l-4 border-l-[var(--color-link)] h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Health</span>
                <AnimatedActivity size={14} className="text-[var(--color-link)]" />
              </div>
              <div className="flex items-baseline gap-1 mb-1.5">
                <span className="text-lg sm:text-2xl font-extrabold text-[var(--color-ink)]">
                  <AnimatedCounter value={healthPercentage} />%
                </span>
                <span className="text-[10px] text-[var(--color-mute)] hidden xs:inline">Score</span>
              </div>
            </div>
            <AnimatedProgress
              value={healthPercentage}
              max={100}
              barClassName={healthPercentage < 25 ? "bg-red-500" : healthPercentage < 50 ? "bg-amber-500" : "bg-emerald-500"}
            />
          </Card>

          <Card padding="sm" className="h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Hour Meter</span>
                <AnimatedClock size={14} className="text-[var(--color-mute)]" />
              </div>
              <p className="text-lg sm:text-2xl font-extrabold text-[var(--color-ink)] mt-0.5 font-mono">
                {machine.hour_meter || 0} hrs
              </p>
            </div>
            <p className="text-[10px] sm:text-xs font-medium text-[var(--color-mute)] mt-1 truncate">Current Total Run</p>
          </Card>

          <Card padding="sm" className="h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Next Service</span>
                <AnimatedCalendarClock size={14} className="text-[var(--color-mute)]" />
              </div>
              <p className="text-xs sm:text-sm font-bold text-[var(--color-ink)] mt-0.5 truncate">{formatDate(machine.next_service_due_date)}</p>
            </div>
            <p className="text-[10px] sm:text-xs font-medium text-[var(--color-mute)] mt-1 truncate">{dueLabel}</p>
          </Card>

          <Card padding="sm" className="h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Service Interval</span>
                <AnimatedSettings size={14} className="text-[var(--color-mute)]" />
              </div>
              <p className="text-lg sm:text-2xl font-extrabold text-[var(--color-ink)] mt-0.5">
                {machine.service_interval_days || 90} Days
              </p>
            </div>
            <p className="text-[10px] sm:text-xs text-[var(--color-mute)] mt-1">Maintenance Cycle</p>
          </Card>
        </div>
      </SlideUp>

      {/* Segmented Navigation Tabs Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar bg-[var(--color-hairline-soft-surface)]/70 p-1.5 rounded-2xl border border-[var(--color-hairline)]">
        {[
          { id: "overview", label: "Master Specs & Client", icon: AnimatedBuilding2 },
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
              className={`flex items-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all relative whitespace-nowrap shrink-0 select-none ${
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
                  className="absolute inset-0 bg-[var(--color-canvas-elevated)] rounded-xl shadow-xs border border-[var(--color-hairline)] -z-10"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Main Tab Content Panels */}
      <AnimatePresence mode="wait">
        {/* TAB 1: OVERVIEW & MASTER SPECS */}
        {activeTab === "overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-6"
          >
            <Card padding="lg" className="card-hover-system">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--color-hairline)]">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[var(--color-ink)] flex items-center gap-2">
                    <AnimatedWrench size={20} className="text-[var(--color-link)]" />
                    Machine Master Parameters & Specifications
                  </h3>
                  <p className="text-xs text-[var(--color-mute)] mt-0.5">
                    Machine identification, meter readings, personnel assignments, and fleet status
                  </p>
                </div>
                <Badge variant={machine.status === "rented" ? "info" : "neutral"} dot>
                  <span className="font-bold uppercase tracking-wider text-xs">
                    {machine.status === "rented" ? "On Rent" : "Available"}
                  </span>
                </Badge>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-4 mt-4 text-xs sm:text-sm">
                <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">Machine ID</span>
                  <span className="font-bold text-[var(--color-ink)] font-mono text-base">{machine.machine_id}</span>
                </div>

                <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">Model</span>
                  <span className="font-bold text-[var(--color-ink)] text-sm">{machine.model || "-"}</span>
                </div>

                <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">Serial No</span>
                  <span className="font-bold text-[var(--color-ink)] font-mono text-sm">{machine.serial_number || "-"}</span>
                </div>

                <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">Year Of Mfg (YUM)</span>
                  <span className="font-bold text-[var(--color-ink)] text-sm">{machine.year_of_mfg || "-"}</span>
                </div>

                <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">Manufacturer</span>
                  <span className="font-bold text-[var(--color-ink)] text-sm">{machine.manufacturer || "-"}</span>
                </div>

                <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">Hour Meter (HMR)</span>
                  <span className="font-bold text-[var(--color-ink)] font-mono text-base">{machine.hour_meter ?? 0} hrs</span>
                </div>

                <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">Services Logged</span>
                  <span className="font-bold text-[var(--color-ink)] text-base">{machine.service_count ?? 0}</span>
                </div>

                <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">Current Supervisor</span>
                  <span className="font-bold text-[var(--color-ink)] text-sm">{machine.current_supervisor?.full_name || "-"}</span>
                </div>

                <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">Current Operator</span>
                  <span className="font-bold text-[var(--color-ink)] text-sm">{machine.current_operator?.full_name || "-"}</span>
                </div>

                <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">Health Status</span>
                  <span className="font-bold text-sm capitalize text-[var(--color-ink)]">
                    {machine.health_status === "breakdown" ? "Breakdown" : machine.health_status === "under_maintenance" ? "Under Maintenance" : "Active"}
                  </span>
                </div>

                <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">Rental Fleet Status</span>
                  <span className="font-bold text-sky-600 dark:text-sky-400 text-sm capitalize">
                    {machine.status === "rented" ? "On Rent" : "Available"}
                  </span>
                </div>
              </div>
            </Card>

            {/* Client Details Section (If On Rent or Client Assigned) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <Card padding="lg" className="lg:col-span-2 card-hover-system border-sky-500/20 bg-sky-500/5">
                <CardHeader
                  title={machine.status === "on_rent" ? "Client Details (On Rent)" : "Customer & Site Location"}
                  eyebrow="Active Deployment Client"
                  action={
                    <Badge variant={machine.status === "on_rent" ? "info" : "neutral"}>
                      {machine.status === "on_rent" ? "On Rent Contract Active" : "Site Deployed"}
                    </Badge>
                  }
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs sm:text-sm">
                  <div>
                    <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider block mb-1">
                      Client / Company Name
                    </span>
                    <p className="font-bold text-[var(--color-ink)] text-base">{clientInfo.company_name || machine.customer_name}</p>
                    {activeRental?.contract_number && (
                      <span className="inline-block mt-1 font-mono text-[11px] text-sky-600 font-bold bg-sky-500/10 px-2 py-0.5 rounded">
                        Contract: {activeRental.contract_number}
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider block mb-1">
                      Contact Person
                    </span>
                    <p className="font-semibold text-[var(--color-ink)] text-sm">{clientInfo.contact_person || machine.customer_name}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider block mb-1">
                      Contact Mobile
                    </span>
                    <a
                      href={`tel:${clientInfo.contact_mobile || machine.customer_mobile}`}
                      className="font-semibold text-[var(--color-link)] hover:underline inline-flex items-center gap-1.5"
                    >
                      <Phone className="h-3.5 w-3.5" /> {clientInfo.contact_mobile || machine.customer_mobile}
                    </a>
                  </div>

                  {clientInfo.contact_email && (
                    <div>
                      <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider block mb-1">
                        Contact Email
                      </span>
                      <a
                        href={`mailto:${clientInfo.contact_email}`}
                        className="font-medium text-[var(--color-link)] hover:underline inline-flex items-center gap-1.5 break-all"
                      >
                        <Mail className="h-3.5 w-3.5 shrink-0" /> {clientInfo.contact_email}
                      </a>
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Site Location Address</span>
                      <button
                        type="button"
                        onClick={handleCopyAddress}
                        className="text-xs text-[var(--color-mute)] hover:text-[var(--color-ink)] inline-flex items-center gap-1"
                      >
                        {copiedAddress ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedAddress ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                    <p className="text-xs sm:text-sm text-[var(--color-ink)] leading-relaxed bg-[var(--color-canvas-elevated)] p-3 rounded-xl border border-[var(--color-hairline)] font-medium">
                      {clientInfo.billing_address || machine.customer_address || "Delhi NCR Site Yard"}
                    </p>
                  </div>

                  {activeRental && (
                    <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-[var(--color-hairline)]">
                      <div>
                        <span className="text-[10px] text-[var(--color-mute)] font-bold uppercase block">Rental Start</span>
                        <span className="font-semibold text-xs text-[var(--color-ink)]">{formatDate(activeRental.start_date)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--color-mute)] font-bold uppercase block">Rental End</span>
                        <span className="font-semibold text-xs text-[var(--color-ink)]">{formatDate(activeRental.end_date)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--color-mute)] font-bold uppercase block">Rental Rate</span>
                        <span className="font-semibold text-xs text-emerald-600">₹{activeRental.rental_rate} / {activeRental.rate_unit}</span>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Assigned Engineer & Staff */}
              <Card padding="lg" className="card-hover-system flex flex-col justify-between">
                <div>
                  <CardHeader title="Assigned Engineer" eyebrow="Field Operations" />

                  <div className="mt-4">
                    {machine.engineer ? (
                      <div className="flex flex-col gap-3 text-xs sm:text-sm">
                        <div className="flex items-center gap-3 bg-[var(--color-hairline-soft-surface)]/60 p-3 rounded-xl border border-[var(--color-hairline)]">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white font-bold text-sm">
                            {machine.engineer.full_name?.charAt(0).toUpperCase()}
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-bold text-[var(--color-ink)] truncate text-sm">{machine.engineer.full_name}</p>
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                              <UserCheck className="h-3 w-3" /> Field Engineer
                            </span>
                          </div>
                        </div>

                        {machine.engineer.phone && (
                          <div>
                            <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider block mb-1">Phone</span>
                            <a href={`tel:${machine.engineer.phone}`} className="font-medium text-[var(--color-link)] hover:underline flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" /> {machine.engineer.phone}
                            </a>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-6 text-center bg-[var(--color-hairline-soft-surface)]/40 rounded-xl border border-dashed border-[var(--color-hairline)] px-3">
                        <AlertTriangle className="h-6 w-6 text-amber-500 mb-1" />
                        <p className="font-bold text-[var(--color-ink)] text-xs">No Engineer Assigned</p>
                      </div>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div className="mt-4 pt-3 border-t border-[var(--color-hairline)]">
                    <Link href={`/machines/${machine.id}/edit`}>
                      <Button variant="secondary" className="w-full text-xs font-semibold py-2 rounded-xl">
                        Reassign Staff
                      </Button>
                    </Link>
                  </div>
                )}
              </Card>
            </div>
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
                            {log.start_time && log.end_time ? `${log.start_time} - ${log.end_time}` : `${log.running_hours || 0} hrs`}
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
    </div>
  );
}
