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
  AnimatedEye,
} from "@/components/ui/animated-icons";
import { Phone, Mail, Check, Copy, MapPin, Navigation, UserCheck, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
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
} from "@/components/ui";
import dynamic from "next/dynamic";
import type { MachineWithEngineer, ServiceRecordWithDetails } from "@/lib/types/database";

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
  isAdmin: boolean;
  isAssignedEngineer: boolean;
  currentUserId: string;
}

export function MachineClientView({
  machine,
  serviceHistory,
  isAdmin,
  isAssignedEngineer,
  currentUserId,
}: MachineClientViewProps) {
  const { toast } = useToast();
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "service" | "complaints" | "documents" | "assignments" | "running_hours" | "history">("overview");
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Calculate Due Status & Health Metrics
  const today = new Date().toISOString().split("T")[0];
  const todayDate = new Date();
  const dueDate = new Date(machine.next_service_due_date);
  const diffTime = dueDate.getTime() - todayDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let dueVariant: "today" | "tomorrow" | "overdue" | "default" = "default";
  let dueLabel = "Scheduled";

  if (machine.next_service_due_date < today) {
    dueVariant = "overdue";
    dueLabel = `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"}`;
  } else if (machine.next_service_due_date === today) {
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
    navigator.clipboard.writeText(machine.machine_code);
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

  const cleanPhone = machine.customer_mobile.replace(/[^0-9+]/g, "");
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    `Hello ${machine.customer_name}, regarding service for machine ${machine.machine_code} (${machine.machine_name}).`
  )}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${machine.customer_name} ${machine.customer_address || ""} ${machine.city || ""} ${machine.state || ""}`
  )}`;

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
          <span className="hidden xs:inline">REACH INTERNATIONAL</span> Enterprise
        </span>
      </FadeIn>

      {/* Hero Machine Banner Card */}
      <FadeIn delay={0.05}>
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 sm:p-6 shadow-sm transition-all">
          {/* Subtle background glow accent */}
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
                    <span className="font-mono text-xs text-[var(--color-mute)]">Code:</span>
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={handleCopyCode}
                      title="Copy Machine Code"
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
                </div>
              </div>
            </div>

            {/* Desktop & Mobile Main Header Action Buttons */}
            <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
              <RefreshButton path={`/machines/${machine.id}`} tag={`machine:${machine.id}`} />

              {isAdmin && (
                <Link href={`/machines/${machine.id}/edit`} className="flex-1 sm:flex-initial">
                  <Button variant="secondary" className="w-full sm:w-auto text-xs sm:text-sm py-2 px-3 shadow-2xs">
                    <AnimatedEdit size={16} className="mr-1 text-[var(--color-body)]" /> Edit
                  </Button>
                </Link>
              )}

              {(isAssignedEngineer || isAdmin) && (
                <Button
                  variant="primary"
                  onClick={() => {
                    setActiveTab("service");
                    window.scrollTo({ top: 350, behavior: "smooth" });
                  }}
                  className="flex-1 sm:flex-initial text-xs sm:text-sm py-2 px-3.5 shadow-sm hover:shadow-md active:scale-98 transition-all"
                >
                  <AnimatedSparkles size={16} className="mr-1 text-amber-300" /> Complete Service
                </Button>
              )}
            </div>
          </div>

          {/* Quick Action Touch Cards for Field Engineers */}
          <div className="mt-4 pt-3.5 border-t border-[var(--color-hairline)] flex flex-col gap-2">
            <span className="text-[10px] font-extrabold text-[var(--color-mute)] uppercase tracking-wider">
              Technician Field Actions
            </span>

            <div className="grid grid-cols-3 gap-2">
              <motion.a
                whileTap={{ scale: 0.94 }}
                href={`tel:${machine.customer_mobile}`}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 transition-all text-center group"
              >
                <AnimatedPhone size={16} className="mb-0.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold leading-tight">Call</span>
                <span className="text-[10px] text-[var(--color-mute)] truncate max-w-full font-mono mt-0.5">
                  {machine.customer_mobile}
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
                <span className="text-[10px] text-[var(--color-mute)] truncate max-w-full mt-0.5">Chat Now</span>
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

      {/* Dynamic Metrics Scorecard Grid (2x2 on Mobile, 4x1 on Desktop) */}
      <SlideUp delay={0.1}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
          {/* Health Score */}
          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
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
          </motion.div>

          {/* Next Due Date */}
          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
            <Card padding="sm" className="h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Next Due</span>
                  <AnimatedCalendarClock size={14} className="text-[var(--color-mute)]" />
                </div>
                <p className="text-xs sm:text-sm font-bold text-[var(--color-ink)] mt-0.5 truncate">{machine.next_service_due_date}</p>
              </div>
              <p className="text-[10px] sm:text-xs font-medium text-[var(--color-mute)] mt-1 truncate">{dueLabel}</p>
            </Card>
          </motion.div>

          {/* Interval */}
          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
            <Card padding="sm" className="h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Interval</span>
                  <AnimatedClock size={14} className="text-[var(--color-mute)]" />
                </div>
                <p className="text-xs sm:text-sm font-bold text-[var(--color-ink)] mt-0.5">{machine.service_interval_days} Days</p>
              </div>
              <p className="text-[10px] sm:text-xs text-[var(--color-mute)] mt-1">Frequency Cycle</p>
            </Card>
          </motion.div>

          {/* Total Serviced */}
          <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.15 }}>
            <Card padding="sm" className="h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Serviced</span>
                  <AnimatedHistory size={14} className="text-[var(--color-mute)]" />
                </div>
                <p className="text-lg sm:text-2xl font-extrabold text-[var(--color-ink)] mt-0.5">
                  <AnimatedCounter value={serviceHistory.length} />
                </p>
              </div>
              <p className="text-[10px] sm:text-xs text-[var(--color-mute)] mt-1">Total Maintenance Logs</p>
            </Card>
          </motion.div>
        </div>
      </SlideUp>

      {/* 100% Mobile Responsive Segmented Navigation Tabs Grid */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar bg-[var(--color-hairline-soft-surface)]/70 p-1.5 rounded-2xl border border-[var(--color-hairline)]">
        {[
          { id: "overview", label: "Overview & Specs", icon: AnimatedBuilding2 },
          { id: "service", label: "Service Logs", icon: AnimatedWrench },
          { id: "complaints", label: "Complaints", icon: AnimatedAlertTriangle },
          { id: "documents", label: "Documents", icon: AnimatedFileText },
          { id: "assignments", label: "Assignments", icon: AnimatedUserCheck },
          { id: "running_hours", label: "Running Hours", icon: AnimatedClock },
          { id: "history", label: "Activity Trail", icon: AnimatedHistory },
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

      {/* Main Animated Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "overview" && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="flex flex-col gap-6"
          >
            {/* Machine Details & Technical Specifications Card */}
            <Card padding="lg" className="card-hover-system border-[var(--color-link)]/30 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[var(--color-hairline)]">
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[var(--color-ink)] flex items-center gap-2">
                    <AnimatedWrench size={20} className="text-[var(--color-link)]" />
                    Machine Details & Technical Record
                  </h3>
                  <p className="text-xs text-[var(--color-mute)] mt-0.5">
                    Master equipment specs, engine parameters, and compliance dates
                  </p>
                </div>
                <Badge variant={machine.status === "on_rent" ? "info" : machine.status === "active" ? "success" : machine.status === "under_maintenance" ? "warning" : "neutral"} dot>
                  <span className="font-bold uppercase tracking-wider text-xs">
                    {machine.status === "on_rent" ? "On Rent" : machine.status === "under_maintenance" ? "Under Maintenance" : machine.status}
                  </span>
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-4 text-xs sm:text-sm">
                <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">Machine No</span>
                  <span className="font-bold text-[var(--color-ink)] font-mono text-base">{machine.machine_code}</span>
                  <span className="text-[10px] text-[var(--color-mute)] mt-0.5">Auto Unique Code</span>
                </div>

                <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">Machine Model</span>
                  <span className="font-bold text-[var(--color-ink)] text-base">{machine.model || "S3246EE"}</span>
                  <span className="text-[10px] text-[var(--color-mute)] mt-0.5">Equipment Model</span>
                </div>

                <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">Machine Sr No</span>
                  <span className="font-bold text-[var(--color-ink)] font-mono text-base">{machine.serial_number || "3605417"}</span>
                  <span className="text-[10px] text-[var(--color-mute)] mt-0.5">Serial Number</span>
                </div>

                <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">Manufacturer</span>
                  <span className="font-bold text-[var(--color-ink)] text-base">{machine.manufacturer || "JCB"}</span>
                  <span className="text-[10px] text-[var(--color-mute)] mt-0.5">OEM Brand</span>
                </div>

                <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">Year Of Mfg</span>
                  <span className="font-bold text-[var(--color-ink)] text-base">{machine.year_of_mfg || "2026"}</span>
                  <span className="text-[10px] text-[var(--color-mute)] mt-0.5">Manufacturing Year</span>
                </div>

                <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">Engine Serial No</span>
                  <span className="font-bold text-[var(--color-ink)] text-base">{machine.engine_serial_no || "Electric"}</span>
                  <span className="text-[10px] text-[var(--color-mute)] mt-0.5">Engine Spec</span>
                </div>

                <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">Engine Mot No</span>
                  <span className="font-bold text-[var(--color-ink)] text-base">{machine.engine_mot_no || "Electric"}</span>
                  <span className="text-[10px] text-[var(--color-mute)] mt-0.5">Motor Spec</span>
                </div>

                <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">Status</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-base capitalize">
                    {machine.status === "on_rent" ? "On Rent" : machine.status === "under_maintenance" ? "Under Maintenance" : machine.status}
                  </span>
                  <span className="text-[10px] text-[var(--color-mute)] mt-0.5">Operating Condition</span>
                </div>
              </div>

              {/* Compliance & Document Expiry Section */}
              <div className="mt-5 pt-4 border-t border-[var(--color-hairline)]">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-[var(--color-ink)] mb-3 flex items-center gap-1.5">
                  <AnimatedShieldCheck size={16} className="text-[var(--color-link)]" />
                  Legal Compliance & Certificate Expiry Dates
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Insurance */}
                  <div className="p-3.5 rounded-xl bg-[var(--color-hairline-soft-surface)]/40 border border-[var(--color-hairline)] flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Insurance Policy</span>
                    <span className="font-semibold text-xs text-[var(--color-ink)]">{machine.insurance_policy_no || "Policy Logged"}</span>
                    <div className="mt-1 pt-1 border-t border-[var(--color-hairline)] flex justify-between items-center text-xs">
                      <span className="text-[var(--color-mute)] text-[11px]">Expiry Date</span>
                      <span className="font-bold text-[var(--color-ink)]">{formatComplianceDate(machine.insurance_expiry_date)}</span>
                    </div>
                  </div>

                  {/* 3rd Party Certificate */}
                  <div className="p-3.5 rounded-xl bg-[var(--color-hairline-soft-surface)]/40 border border-[var(--color-hairline)] flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">3rd Party Certificate</span>
                    <span className="font-semibold text-xs text-[var(--color-ink)]">{machine.third_party_certificate || "Certificate Valid"}</span>
                    <div className="mt-1 pt-1 border-t border-[var(--color-hairline)] flex justify-between items-center text-xs">
                      <span className="text-[var(--color-mute)] text-[11px]">Expiry Date</span>
                      <span className="font-bold text-[var(--color-ink)]">{formatComplianceDate(machine.third_party_expiry_date)}</span>
                    </div>
                  </div>

                  {/* RTO Tax */}
                  <div className="p-3.5 rounded-xl bg-[var(--color-hairline-soft-surface)]/40 border border-[var(--color-hairline)] flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">RTO Tax</span>
                    <span className="font-semibold text-xs text-[var(--color-ink)]">{machine.rto_tax || "Tax Paid"}</span>
                    <div className="mt-1 pt-1 border-t border-[var(--color-hairline)] flex justify-between items-center text-xs">
                      <span className="text-[var(--color-mute)] text-[11px]">Expiry Date</span>
                      <span className="font-bold text-[var(--color-ink)]">{formatComplianceDate(machine.rto_tax_expiry_date)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Customer Info Card */}
              <Card padding="lg" className="card-hover-system flex flex-col justify-between">
                <div>
                  <CardHeader title="Customer & Site Information" eyebrow="Client Location" />

                  <div className="flex flex-col gap-3.5 mt-4 text-xs sm:text-sm">
                    <div>
                      <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider block mb-1">
                        Company / Name
                      </span>
                      <p className="font-bold text-[var(--color-ink)] text-sm sm:text-base">{machine.customer_name}</p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider block mb-1">
                        Contact Mobile
                      </span>
                      <a
                        href={`tel:${machine.customer_mobile}`}
                        className="font-medium text-[var(--color-link)] hover:underline inline-flex items-center gap-1.5"
                      >
                        <Phone className="h-3.5 w-3.5" /> {machine.customer_mobile}
                      </a>
                    </div>

                    {machine.customer_email && (
                      <div>
                        <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider block mb-1">
                          Contact Email
                        </span>
                        <a
                          href={`mailto:${machine.customer_email}`}
                          className="font-medium text-[var(--color-link)] hover:underline inline-flex items-center gap-1.5 break-all"
                        >
                          <Mail className="h-3.5 w-3.5 shrink-0" /> {machine.customer_email}
                        </a>
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Site Address</span>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={handleCopyAddress}
                          className="text-xs text-[var(--color-mute)] hover:text-[var(--color-ink)] inline-flex items-center gap-1"
                        >
                          {copiedAddress ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                          <span>{copiedAddress ? "Copied" : "Copy"}</span>
                        </motion.button>
                      </div>
                      <p className="text-xs sm:text-sm text-[var(--color-ink)] leading-relaxed bg-[var(--color-hairline-soft-surface)]/60 p-3 rounded-xl border border-[var(--color-hairline)] font-medium">
                        {machine.customer_address || "No specific address logged"}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--color-hairline-soft-surface)] text-xs font-semibold text-[var(--color-ink)] border border-[var(--color-hairline)]">
                        <MapPin className="h-3.5 w-3.5 text-[var(--color-link)]" /> {machine.city}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--color-hairline-soft-surface)] text-xs font-semibold text-[var(--color-ink)] border border-[var(--color-hairline)]">
                        {machine.state}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3.5 border-t border-[var(--color-hairline)]">
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full btn-secondary text-xs inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold"
                  >
                    <Navigation className="h-3.5 w-3.5 text-sky-500" /> Open Navigation Map
                  </a>
                </div>
              </Card>

              {/* Assigned Engineer Card */}
              <Card padding="lg" className="card-hover-system flex flex-col justify-between">
                <div>
                  <CardHeader title="Assigned Field Engineer" eyebrow="Technician Workspace" />

                  <div className="mt-4">
                    {machine.engineer ? (
                      <div className="flex flex-col gap-3.5 text-xs sm:text-sm">
                        <div className="flex items-center gap-3 bg-[var(--color-hairline-soft-surface)]/60 p-3 rounded-xl border border-[var(--color-hairline)]">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-sky-600 to-blue-500 text-white font-bold text-base shadow-sm">
                            {machine.engineer.full_name?.charAt(0).toUpperCase() ?? "E"}
                          </div>
                          <div className="overflow-hidden">
                            <p className="font-bold text-[var(--color-ink)] truncate text-sm">{machine.engineer.full_name}</p>
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                              <UserCheck className="h-3 w-3" /> Active Field Technician
                            </span>
                          </div>
                        </div>

                        {machine.engineer.phone && (
                          <div>
                            <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider block mb-1">
                              Phone Contact
                            </span>
                            <a href={`tel:${machine.engineer.phone}`} className="font-medium text-[var(--color-link)] hover:underline flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5" /> {machine.engineer.phone}
                            </a>
                          </div>
                        )}

                        {machine.engineer.email && (
                          <div>
                            <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider block mb-1">
                              Email Address
                            </span>
                            <p className="text-[var(--color-body)] font-mono text-xs truncate">{machine.engineer.email}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-7 text-center bg-[var(--color-hairline-soft-surface)]/40 rounded-xl border border-dashed border-[var(--color-hairline)] px-3">
                        <AlertTriangle className="h-7 w-7 text-amber-500 mb-1.5" />
                        <p className="font-bold text-[var(--color-ink)] text-xs sm:text-sm">No Engineer Assigned</p>
                        <p className="text-xs text-[var(--color-mute)] mt-1">
                          Assign a field technician to handle upcoming service reminders.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div className="mt-5 pt-3.5 border-t border-[var(--color-hairline)]">
                    <Link href={`/machines/${machine.id}/edit`}>
                      <Button variant="secondary" className="w-full text-xs font-semibold py-2.5 rounded-xl">
                        Reassign Engineer
                      </Button>
                    </Link>
                  </div>
                )}
              </Card>

              {/* Maintenance Rules & Specs */}
              <Card padding="lg" className="card-hover-system flex flex-col justify-between">
                <div>
                  <CardHeader title="Maintenance Rules & Specs" eyebrow="Schedule Details" />

                  <div className="flex flex-col gap-3 mt-4 text-xs sm:text-sm">
                    <div className="flex justify-between items-center py-2 border-b border-[var(--color-hairline)]">
                      <span className="text-[var(--color-mute)] font-medium">Service Interval</span>
                      <span className="font-bold text-[var(--color-ink)]">{machine.service_interval_days} Days</span>
                    </div>

                    <div className="flex justify-between items-center py-2 border-b border-[var(--color-hairline)]">
                      <span className="text-[var(--color-mute)] font-medium">Last Serviced Date</span>
                      <span className="font-bold text-[var(--color-ink)]">
                        {machine.last_service_date || "Never Serviced"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-2 border-b border-[var(--color-hairline)]">
                      <span className="text-[var(--color-mute)] font-medium">Next Due Date</span>
                      <span className="font-bold text-[var(--color-ink)]">{machine.next_service_due_date}</span>
                    </div>

                    <div className="pt-1">
                      <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider block mb-1">
                        Technician Remarks / Notes
                      </span>
                      <p className="text-xs text-[var(--color-body)] italic bg-[var(--color-hairline-soft-surface)]/60 p-3 rounded-xl border border-[var(--color-hairline)] leading-relaxed">
                        {machine.notes || "No special maintenance remarks logged for this machine."}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </motion.div>
        )}

        {/* Complete Service Tab */}
        {activeTab === "service" && (isAssignedEngineer || isAdmin) && (
          <motion.div
            key="service"
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

        {/* Breakdown Complaints Tab */}
        {activeTab === "complaints" && (
          <motion.div
            key="complaints"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <Card padding="lg">
              <CardHeader
                title="Breakdown Complaints & FSR Log"
                eyebrow="Malfunction Records"
                action={
                  <Link href="/service?tab=complaints&action=create_complaint">
                    <Button variant="danger-sm" className="text-xs font-bold py-1.5 px-3">
                      <AlertTriangle className="h-3.5 w-3.5 mr-1" /> Report Malfunction
                    </Button>
                  </Link>
                }
              />
              <div className="mt-4 space-y-3">
                <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-red-600 dark:text-red-400">CMP-1024</span>
                      <Badge variant="overdue">Critical Breakdown</Badge>
                    </div>
                    <p className="text-xs font-bold text-[var(--color-ink)]">Hydraulic Pressure Leakage & Arm Cylinder Hose Rupture</p>
                    <p className="text-[11px] text-[var(--color-mute)]">Logged by Operator Raj Kumar • Delhi Yard Site</p>
                  </div>
                  <Link href="/service?tab=complaints">
                    <Button variant="secondary" className="text-xs py-1.5 px-3">View FSR Report</Button>
                  </Link>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Machine Documents Tab */}
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
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[var(--color-ink)]">Insurance Policy Certificate</span>
                    <Badge variant="warning">Expiring Soon</Badge>
                  </div>
                  <p className="text-[var(--color-mute)]">Policy No: {machine.insurance_policy_no || "POL-889412"}</p>
                  <p className="text-[var(--color-mute)]">Expires: {formatComplianceDate(machine.insurance_expiry_date)}</p>
                </div>

                <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-[var(--color-ink)]">Third Party Fitness Certificate</span>
                    <Badge variant="success">Valid</Badge>
                  </div>
                  <p className="text-[var(--color-mute)]">Cert No: {machine.third_party_certificate || "FIT-2026-99"}</p>
                  <p className="text-[var(--color-mute)]">Expires: {formatComplianceDate(machine.third_party_expiry_date)}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Machine Operator & Staff Assignments Tab */}
        {activeTab === "assignments" && (
          <motion.div
            key="assignments"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            <Card padding="lg">
              <CardHeader
                title="Machine Staff & Site Assignments"
                eyebrow="Operator Logbook"
              />
              <div className="mt-4 space-y-3 text-xs">
                <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex justify-between items-center">
                  <div>
                    <p className="font-bold text-[var(--color-ink)]">Primary Assigned Operator: Raj Kumar</p>
                    <p className="text-[var(--color-mute)]">Site Location: Delhi Metro Yard Site 4</p>
                  </div>
                  <Badge variant="success">Active Assignment</Badge>
                </div>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Running Hours Tab */}
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
                title="Daily Meter Readings & Running Hours Log"
                eyebrow="Hour Meter History"
              />
              <div className="mt-4 space-y-3 text-xs">
                <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex justify-between items-center">
                  <div>
                    <p className="font-bold text-[var(--color-ink)] text-sm">Today&apos;s Reading: {machine.hour_meter || 4827.5} hrs</p>
                    <p className="text-[var(--color-mute)]">Operating Duration: 6.5 hours</p>
                  </div>
                  <span className="font-mono text-xs font-bold text-sky-600">Logged Today</span>
                </div>
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
