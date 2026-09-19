"use client";

import { useState, useMemo, useTransition, useEffect, useRef, lazy, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  AnimatedChevronLeft,
  AnimatedEdit,
  AnimatedTrash,
  AnimatedLoader,
  AnimatedCheck,
  AnimatedCopy,
  AnimatedMessageSquare,
} from "@/components/ui/animated-icons";
import { ScissorLiftLogoIcon } from "@/components/branding/ScissorLiftLogoIcon";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Shield,
  Wrench,
  Building2,
  ExternalLink,
  Check,
  Copy,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Badge,
  Button,
  Card,
  FadeIn,
  EmptyState,
  SegmentedToggle,
  useToast,
  ConfirmationDialog,
  type ClientSelectItem,
} from "@/components/ui";
import type { MachineWithEngineer } from "@/lib/types/database";
import type { User } from "@reachinternational/types";
import { deleteMachine } from "@/app/actions/machines";
import { formatDate } from "@reachinternational/utils";
import {
  MachineInfoModal,
  MachinePersonnelModal,
  MachineClientModal,
} from "@/components/machines/MachineEditModals";

// Heavy tabs — lazy loaded on demand
const HMRTab = lazy(() => import("./tabs/HMRTab"));
const AuditTab = lazy(() => import("./tabs/AuditTab"));

// ─── Types ───
type PersonnelPick = Pick<User, "id" | "full_name" | "phone" | "email" | "shift_time">;

interface MachineClientViewProps {
  machine: MachineWithEngineer;
  activeRental?: any;
  supervisors?: User[];
  operators?: User[];
  clients?: ClientSelectItem[];
  isAdmin: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  isAssignedEngineer: boolean;
  currentUserId: string;
  userRole?: string;
}

// ─── Skeletons ───
function HMRSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <AnimatedLoader isSpinning size={16} className="text-sky-500" />
        <span className="text-xs font-medium text-[var(--color-mute)]">Loading hours meter logs...</span>
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-[var(--color-hairline)] animate-pulse" />
        ))}
      </div>
    </div>
  );
}

function AuditSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <AnimatedLoader isSpinning size={16} className="text-sky-500" />
        <span className="text-xs font-medium text-[var(--color-mute)]">Loading audit trail...</span>
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-[var(--color-hairline)] animate-pulse" />
        ))}
      </div>
    </div>
  );
}

/**
 * Mobile-optimized separate edit menu for the sticky Hero banner
 */
function MachineHeroEditMenu({
  onEditInfo,
  onEditPersonnel,
  onEditClient,
}: {
  onEditInfo: () => void;
  onEditPersonnel: () => void;
  onEditClient: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="secondary"
        size="sm"
        icon={<AnimatedEdit size={14} className="text-[var(--color-ink)]" />}
        onClick={() => setOpen((prev) => !prev)}
        title="Edit Machine Options"
        aria-label="Edit Machine Options"
        aria-expanded={open}
        className="h-8 px-2.5 sm:px-3 text-xs font-semibold gap-1"
      >
        <span>Edit</span>
        <ChevronDown size={11} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full mt-1.5 z-50 w-56 sm:w-64 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-1.5 shadow-xl text-xs space-y-1"
          >
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onEditInfo();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] active:scale-[0.99] transition-all cursor-pointer min-h-[40px]"
            >
              <Wrench size={15} className="text-amber-500 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-xs text-[var(--color-ink)]">Edit Machine Info</span>
                <span className="text-[10px] text-[var(--color-mute)]">Specs, HMR & Health</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onEditPersonnel();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] active:scale-[0.99] transition-all cursor-pointer min-h-[40px]"
            >
              <Shield size={15} className="text-teal-600 dark:text-teal-400 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-xs text-[var(--color-ink)]">Edit Personnel</span>
                <span className="text-[10px] text-[var(--color-mute)]">Supervisors & Operators</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onEditClient();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left font-medium text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] active:scale-[0.99] transition-all cursor-pointer min-h-[40px]"
            >
              <Building2 size={15} className="text-sky-500 shrink-0" />
              <div className="flex flex-col min-w-0">
                <span className="font-semibold text-xs text-[var(--color-ink)]">Edit Client Assignment</span>
                <span className="text-[10px] text-[var(--color-mute)]">Client & Rental Status</span>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN COMPONENT — Single Scrollable Full-Screen Page
// ═══════════════════════════════════════════════════════
export function MachineClientView({
  machine,
  activeRental = null,
  supervisors = [],
  operators = [],
  clients = [],
  isAdmin,
  canEdit,
  canDelete,
  userRole = "admin",
}: MachineClientViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedModel, setCopiedModel] = useState(false);
  const [copiedSerial, setCopiedSerial] = useState(false);

  // Tab state with dynamic URL searchParams synchronization
  const initialTab = useMemo(() => {
    const t = searchParams.get("tab");
    if (t === "running_hours" || t === "logs" || t === "hmr") return "running_hours";
    if (t === "audit_trail" || t === "audit") return "audit_trail";
    return "overview";
  }, [searchParams]);

  const [activeTab, setActiveTab] = useState<"overview" | "running_hours" | "audit_trail">(initialTab);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "running_hours" || t === "logs" || t === "hmr") setActiveTab("running_hours");
    else if (t === "audit_trail" || t === "audit") setActiveTab("audit_trail");
  }, [searchParams]);

  // Local state representing live machine record (instantly updated on modal save)
  const [machineData, setMachineData] = useState<MachineWithEngineer>(machine);
  useEffect(() => {
    setMachineData(machine);
  }, [machine]);

  // Separate Modal States
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [personnelModalOpen, setPersonnelModalOpen] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);

  // Global mobile header action listener
  useEffect(() => {
    const handleEditInfo = () => setInfoModalOpen(true);
    const handleEditPersonnel = () => setPersonnelModalOpen(true);
    const handleEditClient = () => setClientModalOpen(true);

    window.addEventListener("reach:edit-machine-info", handleEditInfo);
    window.addEventListener("reach:edit-machine-personnel", handleEditPersonnel);
    window.addEventListener("reach:edit-machine-client", handleEditClient);

    return () => {
      window.removeEventListener("reach:edit-machine-info", handleEditInfo);
      window.removeEventListener("reach:edit-machine-personnel", handleEditPersonnel);
      window.removeEventListener("reach:edit-machine-client", handleEditClient);
    };
  }, []);

  const handleMachineUpdated = (updatedFields: Partial<MachineWithEngineer>) => {
    setMachineData((prev) => ({
      ...prev,
      ...updatedFields,
    }));
  };

  // Client detail copy states
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [copiedBillingAddress, setCopiedBillingAddress] = useState(false);
  const [copiedGstin, setCopiedGstin] = useState(false);
  const [copiedPan, setCopiedPan] = useState(false);

  const allowEdit = canEdit ?? isAdmin;
  const allowDelete = canDelete ?? isAdmin;

  // ─── Derived Data ───
  const machineTitle =
    [machineData.model, machineData.serial_number].filter(Boolean).join(" - ") ||
    machineData.machine_id ||
    "Machine Details";

  const assignedSupervisors = useMemo((): PersonnelPick[] => {
    if (Array.isArray(machineData.supervisors) && machineData.supervisors.length > 0) return machineData.supervisors;
    if (Array.isArray(machineData.supervisor_ids) && machineData.supervisor_ids.length > 0 && supervisors.length > 0) {
      const fromProp = supervisors.filter((s) => machineData.supervisor_ids?.includes(s.id));
      if (fromProp.length > 0) return fromProp;
    }
    if (machineData.current_supervisor) return [machineData.current_supervisor];
    return [];
  }, [machineData.supervisors, machineData.supervisor_ids, machineData.current_supervisor, supervisors]);

  const assignedOperators = useMemo((): PersonnelPick[] => {
    if (Array.isArray(machineData.operators) && machineData.operators.length > 0) return machineData.operators;
    if (Array.isArray(machineData.operator_ids) && machineData.operator_ids.length > 0 && operators.length > 0) {
      const fromProp = operators.filter((o) => machineData.operator_ids?.includes(o.id));
      if (fromProp.length > 0) return fromProp;
    }
    if (machineData.current_operator) return [machineData.current_operator];
    return [];
  }, [machineData.operators, machineData.operator_ids, machineData.current_operator, operators]);

  // Client data
  const client = machineData.client || activeRental?.client || null;
  const clientCompanyName = client?.company_name || machineData.customer_name || "";
  const clientCode = client?.code || "";
  const clientContactPerson = client?.contact_person || "";
  const clientPhone = client?.phone || machineData.customer_mobile || "";
  const clientEmail = (client as any)?.email || machineData.customer_email || "";
  const clientGstin = client?.gstin || "";
  const clientPan = client?.pan_number || "";
  const clientAddress = (client as any)?.street || client?.address || machineData.customer_address || "";
  const clientCity = client?.city || machineData.city || "";
  const clientDistrict = client?.district || "";
  const clientState = client?.state || machineData.state || "";
  const clientPincode = client?.pincode || "";
  const isBillingAddressDifferent = Boolean(client?.is_billing_address_different);
  const billingAddress = client?.billing_address || "";
  const billingCity = client?.billing_city || "";
  const billingDistrict = client?.billing_district || "";
  const billingState = client?.billing_state || "";
  const billingPincode = client?.billing_pincode || "";

  const clientLocationParts = [clientCity, clientDistrict, clientState].filter(Boolean);
  const clientLocation = clientLocationParts.length > 0 ? Array.from(new Set(clientLocationParts)).join(", ") : "";
  const hasLinkedClient = Boolean(clientCompanyName || clientAddress || clientPhone || client?.id);

  const fullSiteAddress = [clientAddress, clientLocation, clientPincode ? `PIN: ${clientPincode}` : ""]
    .filter(Boolean).join(", ");
  const fullBillingAddress = [
    billingAddress, [billingCity, billingDistrict, billingState].filter(Boolean).join(", "),
    billingPincode ? `PIN: ${billingPincode}` : "",
  ].filter(Boolean).join(", ");

  const cleanPhone = clientPhone ? clientPhone.replace(/[^0-9+]/g, "") : "";
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
    `Hello ${clientContactPerson || clientCompanyName || "Client"}, regarding machine ${machineData.model ? `${machineData.model} (${machineData.machine_id})` : machineData.machine_id}.`
  )}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${clientCompanyName} ${clientAddress} ${clientLocation}`.trim()
  )}`;

  // ─── Handlers ───
  const handleCopyMachineId = () => {
    navigator.clipboard.writeText(machineData.machine_id || machineData.machine_code || "");
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleDeleteMachine = () => {
    startDeleteTransition(async () => {
      const res = await deleteMachine(machineData.id);
      if (res?.error) {
        toast("error", "Failed to delete machine", res.error);
        setDeleteConfirmOpen(false);
      } else {
        toast("success", "Machine deleted", `${machineData.machine_id} has been permanently deleted.`);
        setDeleteConfirmOpen(false);
        router.push("/machines");
      }
    });
  };

  const handleCopy = (text: string, setter: (v: boolean) => void, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setter(true);
    toast("info", `${label} Copied!`, `${label} copied to clipboard.`);
    setTimeout(() => setter(false), 2000);
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5 pb-20 md:pb-8 max-w-7xl mx-auto px-2 sm:px-4 md:px-6 w-full">

      {/* ═══════════ BREADCRUMB ═══════════ */}
      <FadeIn className="hidden sm:flex items-center justify-between">
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

      {/* ═══════════ STATIC HEADER & NAVIGATION ZONE ═══════════ */}
      <div className="relative w-full flex flex-col gap-2.5 sm:gap-3">
        {/* HERO MACHINE BANNER */}
        <div className="rounded-xl sm:rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3 sm:p-4 md:p-5 shadow-2xs transition-all">
          {/* ── Mobile Layout (≤640px): Standard Mobile Hierarchy ── */}
          <div className="flex flex-col gap-2.5 sm:hidden">
            {/* Row 1: Icon + Title & Machine ID + Right Actions */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white shadow-2xs border border-neutral-800"
                >
                  <ScissorLiftLogoIcon size={20} className="text-sky-400" />
                </motion.div>
                <div className="flex flex-col min-w-0 flex-1">
                  <h1
                    className="text-[15px] font-extrabold text-[var(--color-ink)] tracking-tight truncate leading-tight"
                    title={machineTitle}
                  >
                    {machineTitle}
                  </h1>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] font-mono font-semibold text-[var(--color-mute)] truncate">
                      {machineData.machine_id}
                    </span>
                    {machineData.manufacturer && (
                      <>
                        <span className="text-[10px] text-[var(--color-mute)]">•</span>
                        <span className="text-[11px] font-medium text-[var(--color-mute)] truncate">
                          {machineData.manufacturer}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Separate Edit Menu + Delete on header (Touch-friendly 34-36px hit targets) */}
              <div className="flex items-center gap-1.5 shrink-0">
                {allowEdit && (
                  <MachineHeroEditMenu
                    onEditInfo={() => setInfoModalOpen(true)}
                    onEditPersonnel={() => setPersonnelModalOpen(true)}
                    onEditClient={() => setClientModalOpen(true)}
                  />
                )}
                {allowDelete && (
                  <Button
                    variant="destructive"
                    size="sm"
                    responsive
                    mobileIconOnly
                    icon={<AnimatedTrash size={14} />}
                    onClick={() => setDeleteConfirmOpen(true)}
                    disabled={isDeleting}
                    title="Delete Machine"
                    aria-label="Delete Machine"
                    className="h-8.5 w-8.5 min-h-[34px] min-w-[34px] p-0 flex items-center justify-center rounded-lg"
                  >
                    Delete
                  </Button>
                )}
              </div>
            </div>

            {/* Row 2: Status Badges (Full width, side-by-side, no cramped wrapping) */}
            <div className="flex items-center gap-2 pt-2 border-t border-[var(--color-hairline)] overflow-x-auto flex-nowrap custom-scrollbar">
              <Badge
                variant={
                  machineData.health_status === "breakdown"
                    ? "overdue"
                    : machineData.health_status === "under_maintenance"
                    ? "warning"
                    : machineData.health_status === "spare"
                    ? "spare"
                    : "success"
                }
                dot
              >
                <span className="capitalize font-semibold text-[11px]">
                  {machineData.health_status === "breakdown"
                    ? "Breakdown"
                    : machineData.health_status === "under_maintenance"
                    ? "Under Maintenance"
                    : machineData.health_status === "spare"
                    ? "Spare"
                    : "Active"}
                </span>
              </Badge>
              <Badge
                variant={
                  machineData.status === "on_rent" || machineData.status === "rented"
                    ? "info"
                    : machineData.status === "under_maintenance"
                    ? "warning"
                    : "neutral"
                }
                dot
              >
                <span className="capitalize font-semibold text-[11px]">
                  {machineData.status === "on_rent" || machineData.status === "rented"
                    ? "On Rent"
                    : machineData.status === "under_maintenance"
                    ? "Under Maintenance"
                    : "Available"}
                </span>
              </Badge>
            </div>
          </div>

          {/* ── Desktop & Tablet Layout (≥641px): Full Width Multi-Col ── */}
          <div className="hidden sm:flex items-center justify-between gap-4">
            {/* Left: Scissor Lift Icon + Title + Status Badges */}
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-white shadow-2xs border border-neutral-800"
              >
                <ScissorLiftLogoIcon size={24} className="text-sky-400" />
              </motion.div>
              <div className="flex flex-col min-w-0 flex-1 gap-1">
                <h1
                  className="text-xl md:text-2xl font-extrabold text-[var(--color-ink)] tracking-tight truncate"
                  title={machineTitle}
                >
                  {machineTitle}
                </h1>
                {/* Health Status + Rent Status Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant={
                      machineData.health_status === "breakdown"
                        ? "overdue"
                        : machineData.health_status === "under_maintenance"
                        ? "warning"
                        : machineData.health_status === "spare"
                        ? "spare"
                        : "success"
                    }
                    dot
                  >
                    <span className="capitalize font-semibold text-xs">
                      {machineData.health_status === "breakdown"
                        ? "Breakdown"
                        : machineData.health_status === "under_maintenance"
                        ? "Under Maintenance"
                        : machineData.health_status === "spare"
                        ? "Spare"
                        : "Active"}
                    </span>
                  </Badge>
                  <Badge
                    variant={
                      machineData.status === "on_rent" || machineData.status === "rented"
                        ? "info"
                        : machineData.status === "under_maintenance"
                        ? "warning"
                        : "neutral"
                    }
                    dot
                  >
                    <span className="capitalize font-semibold text-xs">
                      {machineData.status === "on_rent" || machineData.status === "rented"
                        ? "On Rent"
                        : machineData.status === "under_maintenance"
                        ? "Under Maintenance"
                        : "Available"}
                    </span>
                  </Badge>
                </div>
              </div>
            </div>

            {/* Right: Separate Edit Menu + Delete on header (Optimized for Desktop) */}
            <div className="flex items-center gap-2 shrink-0">
              {allowEdit && (
                <MachineHeroEditMenu
                  onEditInfo={() => setInfoModalOpen(true)}
                  onEditPersonnel={() => setPersonnelModalOpen(true)}
                  onEditClient={() => setClientModalOpen(true)}
                />
              )}
              {allowDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  responsive
                  mobileIconOnly
                  icon={<AnimatedTrash size={14} />}
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={isDeleting}
                  title="Delete Machine"
                  aria-label="Delete Machine"
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* TAB NAVIGATION TOGGLE / NAVBAR */}
        <div className="flex items-center justify-between gap-2">
          <SegmentedToggle
            items={[
              { id: "overview", label: "Basic Info" },
              { id: "running_hours", label: "HMR" },
              ...(userRole !== "operator" ? [{ id: "audit_trail" as const, label: "Audit" }] : []),
            ]}
            value={activeTab}
            onChange={setActiveTab}
            size="sm"
          />
        </div>
      </div>

      {/* ═══════════ TAB 1: BASIC INFO & CLIENT (ALL LIGHT DATA ON SAME SCREEN) ═══════════ */}
      {activeTab === "overview" && (
        <div className="flex flex-col gap-4 sm:gap-5">
          {/* ═══════════ SECTION 1: BASIC INFO ═══════════ */}
          <FadeIn delay={0.1}>
        <Card padding="md" className="card-hover-system sm:p-6">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--color-hairline)]">
            <h3 className="text-sm sm:text-base font-bold text-[var(--color-ink)]">Basic Info</h3>
            {allowEdit && (
              <Button
                variant="secondary"
                size="sm"
                icon={<AnimatedEdit size={12} className="text-[var(--color-ink)]" />}
                onClick={() => setInfoModalOpen(true)}
                title="Edit Machine Info"
                aria-label="Edit Machine Info"
                className="h-8 px-2.5 sm:px-3 text-xs font-semibold gap-1"
              >
                <span>Edit</span>
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3.5 mt-3.5 text-xs sm:text-sm">
            {/* Machine ID */}
            <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
              <div className="flex items-center justify-between gap-1 mb-0.5">
                <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">Machine ID</span>
                <button type="button" onClick={handleCopyMachineId} title="Copy Machine ID" className="text-[10px] text-[var(--color-mute)] hover:text-[var(--color-ink)] inline-flex items-center gap-0.5 cursor-pointer">
                  {copiedId ? <AnimatedCheck size={10} className="text-emerald-600" /> : <AnimatedCopy size={10} />}
                </button>
              </div>
              <span className="font-bold text-[var(--color-ink)] font-mono text-xs sm:text-sm">{machineData.machine_id}</span>
            </div>
            {/* Model */}
            <InfoCell
              label="Model"
              value={machineData.model || "—"}
              copyable={Boolean(machineData.model)}
              copied={copiedModel}
              onCopy={() => handleCopy(machineData.model || "", setCopiedModel, "Model")}
            />
            {/* Serial No */}
            <InfoCell
              label="Serial No"
              value={machineData.serial_number || "—"}
              mono
              copyable={Boolean(machineData.serial_number)}
              copied={copiedSerial}
              onCopy={() => handleCopy(machineData.serial_number || "", setCopiedSerial, "Serial Number")}
            />
            {/* Year of Mfg */}
            <InfoCell label="Year Of Mfg (YUM)" value={machineData.year_of_mfg || "—"} />
            {/* Manufacturer */}
            <InfoCell label="Manufacturer" value={machineData.manufacturer || "—"} />
            {/* HMR */}
            <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
              <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Hour Meter (HMR)</span>
              <span className="font-bold text-sky-600 dark:text-sky-400 font-mono text-xs sm:text-sm">{machineData.hour_meter ?? 0} hrs</span>
            </div>
            {/* Supervisors */}
            <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
              <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Supervisors</span>
              <div className="flex items-center justify-between gap-1.5 min-w-0">
                <span
                  className="font-bold text-[var(--color-ink)] text-xs sm:text-sm truncate"
                  title={assignedSupervisors.length > 0 ? assignedSupervisors.map((s) => s.full_name).join(", ") : undefined}
                >
                  {assignedSupervisors.length > 0 ? assignedSupervisors.map((s) => s.full_name).join(", ") : "—"}
                </span>
                {assignedSupervisors.length > 0 && (
                  <Badge variant="info" className="text-[10px] px-1.5 py-0 shrink-0">{assignedSupervisors.length}</Badge>
                )}
              </div>
            </div>
            {/* Operators */}
            <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
              <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-0.5">Operators</span>
              <div className="flex items-center justify-between gap-1.5 min-w-0">
                <span
                  className="font-bold text-[var(--color-ink)] text-xs sm:text-sm truncate"
                  title={assignedOperators.length > 0 ? assignedOperators.map((o) => o.full_name).join(", ") : undefined}
                >
                  {assignedOperators.length > 0 ? assignedOperators.map((o) => o.full_name).join(", ") : "—"}
                </span>
                {assignedOperators.length > 0 && (
                  <Badge variant="warning" className="text-[10px] px-1.5 py-0 shrink-0">{assignedOperators.length}</Badge>
                )}
              </div>
            </div>
          </div>
        </Card>
      </FadeIn>

      {/* ═══════════ SECTION 2: ASSIGNED SHIFT PERSONNEL ═══════════ */}
      <FadeIn delay={0.15}>
        <Card padding="md" className="card-hover-system sm:p-6">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--color-hairline)]">
            <h3 className="text-sm sm:text-base font-bold text-[var(--color-ink)]">
              Assigned Shift Personnel
            </h3>
            {allowEdit && (
              <Button
                variant="secondary"
                size="sm"
                icon={<AnimatedEdit size={12} className="text-[var(--color-ink)]" />}
                onClick={() => setPersonnelModalOpen(true)}
                title="Edit Assigned Personnel"
                aria-label="Edit Assigned Personnel"
                className="h-8 px-2.5 sm:px-3 text-xs font-semibold gap-1"
              >
                <span>Edit</span>
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-3.5">
            {/* Supervisors Panel */}
            <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/40 p-3 sm:p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                  <span className="text-xs font-bold text-[var(--color-ink)]">Supervisors ({assignedSupervisors.length})</span>
                </div>
              </div>
              {assignedSupervisors.length === 0 ? (
                <p className="text-xs text-[var(--color-mute)] italic py-4 text-center">No supervisors assigned</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {assignedSupervisors.map((sup, idx) => (
                    <PersonnelCard key={sup.id || idx} person={sup} shiftIndex={idx + 1} color="teal" />
                  ))}
                </div>
              )}
            </div>

            {/* Operators Panel */}
            <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-hairline-soft-surface)]/40 p-3 sm:p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1.5">
                  <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold text-[var(--color-ink)]">Operators ({assignedOperators.length})</span>
                </div>
              </div>
              {assignedOperators.length === 0 ? (
                <p className="text-xs text-[var(--color-mute)] italic py-4 text-center">No operators assigned</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {assignedOperators.map((op, idx) => (
                    <PersonnelCard key={op.id || idx} person={op} shiftIndex={idx + 1} color="amber" />
                  ))}
                </div>
              )}
            </div>
          </div>
        </Card>
      </FadeIn>

      {/* ═══════════ SECTION 3: CLIENT DETAILS ═══════════ */}
      <FadeIn delay={0.2}>
        <Card padding="md" className="card-hover-system sm:p-6">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--color-hairline)]">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-[var(--color-ink)]">Client Details</h3>
              {clientCode && (
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  {clientCode}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              {hasLinkedClient && (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 py-1.5 px-2 sm:px-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)] hover:text-sky-600 dark:hover:text-sky-400 transition-colors text-xs font-semibold"
                  title="Open in Google Maps"
                  aria-label="Map Location"
                >
                  <MapPin size={13} className="text-sky-600 dark:text-sky-400 shrink-0" />
                  <span className="hidden sm:inline">Map Location</span>
                </a>
              )}
              {client?.id && (
                <Link href="/clients?tab=all" className="inline-flex items-center gap-1 text-xs text-[var(--color-link)] hover:underline font-medium mr-1">
                  <span className="hidden sm:inline">Directory</span> <ExternalLink size={12} />
                </Link>
              )}
              {allowEdit && (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<AnimatedEdit size={12} className="text-[var(--color-ink)]" />}
                  onClick={() => setClientModalOpen(true)}
                  title="Edit Client Assignment"
                  aria-label="Edit Client Assignment"
                  className="h-8 px-2.5 sm:px-3 text-xs font-semibold gap-1"
                >
                  <span>Edit</span>
                </Button>
              )}
            </div>
          </div>

          {hasLinkedClient ? (
            <div className="flex flex-col gap-3.5 sm:gap-4 mt-3.5 text-xs sm:text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3.5">
                {/* Client Name */}
                <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">CLIENT NAME</span>
                  <p className="font-bold text-[var(--color-ink)] text-sm sm:text-base">{clientCompanyName}</p>
                  {activeRental?.contract_number && (
                    <span className="inline-block mt-1.5 font-mono text-[11px] text-sky-600 dark:text-sky-400 font-bold bg-sky-500/10 px-2 py-0.5 rounded self-start border border-sky-500/20">
                      Contract: {activeRental.contract_number}
                    </span>
                  )}
                </div>
                {/* Contact Person */}
                <InfoCell label="Contact Person" value={clientContactPerson || "—"} />
                {/* Contact Mobile */}
                <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">Contact Mobile</span>
                  {clientPhone ? (
                    <a href={`tel:${clientPhone}`} className="font-semibold text-[var(--color-link)] hover:underline inline-flex items-center gap-1.5 text-xs sm:text-sm font-mono">
                      <Phone className="h-3.5 w-3.5 shrink-0" /> {clientPhone}
                    </a>
                  ) : <p className="text-[var(--color-mute)]">—</p>}
                </div>
                {/* Email */}
                {clientEmail && (
                  <div className="flex flex-col p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                    <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider mb-1">Contact Email</span>
                    <a href={`mailto:${clientEmail}`} className="font-medium text-[var(--color-link)] hover:underline inline-flex items-center gap-1.5 break-all text-xs sm:text-sm">
                      <Mail className="h-3.5 w-3.5 shrink-0" /> {clientEmail}
                    </a>
                  </div>
                )}
                {/* City & State */}
                <InfoCell label="City & State" value={clientLocation || "—"} />
                {/* GSTIN */}
                {clientGstin && userRole !== "operator" && (
                  <CopyableInfoCell label="GSTIN" value={clientGstin} mono copied={copiedGstin} onCopy={() => handleCopy(clientGstin, setCopiedGstin, "GSTIN")} />
                )}
                {/* PAN */}
                {clientPan && userRole !== "operator" && (
                  <CopyableInfoCell label="PAN Number" value={clientPan} mono copied={copiedPan} onCopy={() => handleCopy(clientPan, setCopiedPan, "PAN")} />
                )}
              </div>

              {/* Site Location */}
              <CopyableInfoCell label="SITE LOCATION" value={fullSiteAddress || "—"} full copied={copiedAddress} onCopy={() => handleCopy(fullSiteAddress, setCopiedAddress, "Address")} />

              {/* Billing Address */}
              {isBillingAddressDifferent && (billingAddress || billingCity) && userRole !== "operator" && (
                <CopyableInfoCell label="Billing Address" value={fullBillingAddress || "—"} full copied={copiedBillingAddress} onCopy={() => handleCopy(fullBillingAddress, setCopiedBillingAddress, "Billing Address")} />
              )}

              {/* Rental Contract */}
              {activeRental && userRole !== "operator" && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
                  <div>
                    <span className="text-[10px] text-[var(--color-mute)] font-bold uppercase block mb-0.5">Rental Start</span>
                    <span className="font-semibold text-xs sm:text-sm text-[var(--color-ink)]">{formatDate(activeRental.start_date)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--color-mute)] font-bold uppercase block mb-0.5">Rental End</span>
                    <span className="font-semibold text-xs sm:text-sm text-[var(--color-ink)]">{formatDate(activeRental.end_date)}</span>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-[var(--color-mute)] font-bold uppercase block mb-0.5">Rental Rate</span>
                    <span className="font-bold text-xs sm:text-sm text-emerald-600 dark:text-emerald-400">
                      ₹{(activeRental.monthly_rate || activeRental.rental_rate || 0).toLocaleString("en-IN")} / {activeRental.rate_unit || "month"}
                    </span>
                  </div>
                </div>
              )}

              {/* Quick Action Buttons */}
              {clientPhone && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <motion.a whileTap={{ scale: 0.96 }} href={`tel:${clientPhone}`} className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 transition-all text-center font-semibold text-xs min-h-[44px]">
                    <Phone className="h-4 w-4 shrink-0" /> <span className="truncate">Call</span>
                  </motion.a>
                  <motion.a whileTap={{ scale: 0.96 }} href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-500/20 transition-all text-center font-semibold text-xs min-h-[44px]">
                    <AnimatedMessageSquare size={16} className="shrink-0" /> <span className="truncate">WhatsApp</span>
                  </motion.a>
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center bg-[var(--color-hairline-soft-surface)]/30 rounded-xl border border-dashed border-[var(--color-hairline)] mt-3 p-4">
              <Building2 className="h-8 w-8 text-[var(--color-mute)] mx-auto mb-2 opacity-50" />
              <p className="font-bold text-[var(--color-ink)] text-xs sm:text-sm">No Client Assigned</p>
              <p className="text-xs text-[var(--color-mute)] mt-1 max-w-sm mx-auto">This machine is currently available in the fleet inventory.</p>
              {allowEdit && (
                <div className="mt-4">
                  <Button onClick={() => setClientModalOpen(true)} variant="secondary" size="sm">
                    Assign Client
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>
      </FadeIn>
        </div>
      )}

      {/* ═══════════ TAB 2: HOURS METER LOGS (HEAVY DATA FETCH LAZY LOADED) ═══════════ */}
      {activeTab === "running_hours" && (
        <FadeIn delay={0.1}>
          <Suspense fallback={<HMRSkeleton />}>
            <HMRTab machineId={machineData.id} />
          </Suspense>
        </FadeIn>
      )}

      {/* ═══════════ TAB 3: AUDIT TRAIL (LAZY LOADED ON DEMAND) ═══════════ */}
      {activeTab === "audit_trail" && (
        <FadeIn delay={0.1}>
          <Suspense fallback={<AuditSkeleton />}>
            <AuditTab machineId={machineData.id} isAdmin={isAdmin} machine={machineData} />
          </Suspense>
        </FadeIn>
      )}

      {/* ═══════════ DEDICATED SEPARATE DIALOGS ═══════════ */}
      {allowEdit && (
        <>
          <MachineInfoModal
            isOpen={infoModalOpen}
            onClose={() => setInfoModalOpen(false)}
            machine={machineData}
            onMachineUpdated={handleMachineUpdated}
          />
          <MachinePersonnelModal
            isOpen={personnelModalOpen}
            onClose={() => setPersonnelModalOpen(false)}
            machine={machineData}
            supervisors={supervisors}
            operators={operators}
            userRole={userRole}
            onMachineUpdated={handleMachineUpdated}
          />
          <MachineClientModal
            isOpen={clientModalOpen}
            onClose={() => setClientModalOpen(false)}
            machine={machineData}
            clients={clients}
            onMachineUpdated={handleMachineUpdated}
          />
        </>
      )}

      {/* Delete Confirmation */}
      <ConfirmationDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteMachine}
        title="Delete Machine"
        description={`Are you sure you want to permanently delete machine ${machineData.machine_id} (${machineData.model || "Unknown Model"})? This action cannot be undone and will remove related logs.`}
        confirmLabel="Delete Machine"
        cancelLabel="Keep Machine"
        variant="danger"
        loading={isDeleting}
      />
    </div>
  );
}

// ─── Reusable Sub-Components ───

function InfoCell({
  label,
  value,
  mono,
  copyable,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
  copied?: boolean;
  onCopy?: () => void;
}) {
  return (
    <div className="flex flex-col p-2.5 sm:p-3 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)]">
      <div className="flex items-center justify-between gap-1 mb-0.5">
        <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">{label}</span>
        {copyable && onCopy && value && value !== "—" && (
          <button
            type="button"
            onClick={onCopy}
            title={`Copy ${label}`}
            className="text-[10px] text-[var(--color-mute)] hover:text-[var(--color-ink)] inline-flex items-center gap-0.5 cursor-pointer p-0.5 -mr-0.5 rounded transition-colors"
          >
            {copied ? <AnimatedCheck size={10} className="text-emerald-600" /> : <AnimatedCopy size={10} />}
          </button>
        )}
      </div>
      <span className={`font-bold text-[var(--color-ink)] text-xs sm:text-sm truncate ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function CopyableInfoCell({ label, value, mono, full, copied, onCopy }: { label: string; value: string; mono?: boolean; full?: boolean; copied: boolean; onCopy: () => void }) {
  return (
    <div className={`flex flex-col p-3 sm:p-3.5 rounded-xl bg-[var(--color-hairline-soft-surface)]/60 border border-[var(--color-hairline)] ${full ? "" : ""}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-bold text-[var(--color-mute)] uppercase tracking-wider">{label}</span>
        <button type="button" onClick={onCopy} title={copied ? "Copied!" : `Copy ${label}`} className="p-1 -mr-1 -mt-0.5 rounded-md text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] inline-flex items-center justify-center cursor-pointer transition-colors">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <p className={`font-semibold text-[var(--color-ink)] text-xs sm:text-sm leading-relaxed ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function PersonnelCard({ person, shiftIndex, color }: { person: PersonnelPick; shiftIndex: number; color: "teal" | "amber" }) {
  const isTeal = color === "teal";
  const badgeClasses = isTeal
    ? "text-teal-700 dark:text-teal-300 bg-teal-500/10 border-teal-500/25"
    : "text-amber-700 dark:text-amber-300 bg-amber-500/10 border-amber-500/25";

  return (
    <div className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] gap-2.5">
      {/* Left side: Name, Shift badge, Shift time */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-bold text-xs sm:text-sm text-[var(--color-ink)] truncate max-w-[170px] sm:max-w-none" title={person.full_name}>
            {person.full_name}
          </span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${badgeClasses} shrink-0`}>
            Shift {shiftIndex}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--color-mute)] mt-1">
          <Clock size={11} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span className="font-mono text-[var(--color-ink)] font-semibold">
            {person.shift_time || (isTeal ? "08:00 AM - 08:00 PM" : "08:00 AM - 04:00 PM")}
          </span>
        </div>
      </div>

      {/* Right side: Single compact layout for call & email */}
      {(person.phone || person.email) && (
        <div className="inline-flex items-center rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-0.5 shrink-0 shadow-xs">
          {person.phone && (
            <a
              href={`tel:${person.phone}`}
              title={`Call ${person.full_name} (${person.phone})`}
              aria-label={`Call ${person.full_name}`}
              className="p-1.5 rounded-md text-[var(--color-mute)] hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors inline-flex items-center justify-center cursor-pointer"
            >
              <Phone size={13} />
            </a>
          )}
          {person.phone && person.email && (
            <div className="h-3.5 w-px bg-[var(--color-hairline)] my-auto mx-0.5" />
          )}
          {person.email && (
            <a
              href={`mailto:${person.email}`}
              title={`Email ${person.full_name} (${person.email})`}
              aria-label={`Email ${person.full_name}`}
              className="p-1.5 rounded-md text-[var(--color-mute)] hover:text-sky-600 dark:hover:text-sky-400 hover:bg-sky-500/10 transition-colors inline-flex items-center justify-center cursor-pointer"
            >
              <Mail size={13} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
