"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  ShieldCheck,
  Shield,
  FileText,
  Image as ImageIcon,
  ExternalLink,
  MoreVertical,
  Users,
  IdCard,
  Fingerprint,
  Banknote,
  UserCog,
  LogIn,
  KeyRound,
  CalendarDays,
  ChevronRight,
  ArrowUpRight,
  Maximize2,
  ScanLine,
  AlertTriangle,
  FileCheck2,
} from "lucide-react";
import {
  AnimatedTruck,
  AnimatedClock,
  AnimatedShieldCheck,
  AnimatedMapPin,
  AnimatedFileText,
  AnimatedCopy,
  AnimatedCheck,
  AnimatedEdit,
  AnimatedMail,
  AnimatedPhone,
  AnimatedKey,
  AnimatedPower,
  AnimatedTrash2,
  AnimatedCalendarClock,
  AnimatedEye,
  AnimatedEyeOff,
  AnimatedWrench,
  AnimatedPlus,
} from "@/components/ui/animated-icons";
import { Button, EmptyState, useToast, ConfirmationDialog } from "@/components/ui";
import { DocumentViewerModal, type ViewerDocument } from "@/components/documents/DocumentViewerModal";
import { UserEditModal } from "../UserEditModal";
import { PasswordResetModal } from "../PasswordResetModal";
import { AssignPersonnelModal } from "@/components/machines/AssignPersonnelModal";
import {
  formatDate,
  formatTimeAgo,
  maskAadhaar,
  maskBankAccount,
  formatLicenseNumber,
  getUserInitials,
  formatMachineCategoryLabel,
} from "@reachinternational/utils";
import {
  toggleUserStatus,
  resetUserPassword,
  deleteUser,
  editUser,
  getUserDetailAction,
  getUserAssignedMachinesAction,
  getUserAssignmentsAction,
  getUserSupervisedOperatorsAction,
} from "@/app/actions/users";
import {
  getDocumentViewUrlAction,
  verifyUserDocumentAction,
  rejectUserDocumentAction,
  approveDocumentReplacementAction,
  rejectDocumentReplacementAction,
  getUserDocumentsAction,
  logSensitiveRevealAction,
  type UserDocument,
  type DocumentType,
} from "@/app/actions/documents";
import type { User } from "@/lib/types/database";
import type {
  UserMachineItem,
  UserRunningLogItem,
  UserAssignmentItem,
  UserAuditItem,
  UserSummaryKPIs,
  SupervisedOperatorItem,
} from "@/lib/data/users";

export type UserDetailTabKey = "machines" | "operators" | "logs" | "assignments" | "attendance" | "documents" | "audit";

export interface UserDetailClientProps {
  user: User;
  currentUser: User;
  isSuperAdmin: boolean;
  canManage: boolean;
  kpis: UserSummaryKPIs;
  machines: UserMachineItem[];
  runningLogs: UserRunningLogItem[];
  assignments: UserAssignmentItem[];
  auditLogs: UserAuditItem[];
  documents: UserDocument[];
  documentTypes: DocumentType[];
  supervisors?: Array<{ value: string; label: string; description?: string }>;
  operators?: SupervisedOperatorItem[];
}

function formatShiftTime(timeStr?: string | null): string {
  if (!timeStr) return "—";
  const [hStr, mStr] = timeStr.split(":");
  const h = parseInt(hStr, 10);
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12.toString().padStart(2, "0")}:${mStr || "00"} ${ampm}`;
}

function getRoleBadge(role: string) {
  switch (role) {
    case "super_admin":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-300/80 dark:border-red-800/80 shadow-xs">
          <ShieldAlert className="h-3 w-3 text-red-600 dark:text-red-400" />
          Super Admin
        </span>
      );
    case "admin":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800/80 shadow-xs">
          <ShieldCheck className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          Admin
        </span>
      );
    case "manager":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 shadow-xs">
          <ShieldCheck className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
          Manager
        </span>
      );
    case "supervisor":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800/80 shadow-xs">
          <Shield className="h-3 w-3 text-teal-600 dark:text-teal-400" />
          Supervisor
        </span>
      );
    case "hr":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 shadow-xs">
          <Shield className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
          HR
        </span>
      );
    case "operator":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 shadow-xs">
          <Shield className="h-3 w-3 text-amber-600 dark:text-amber-400" />
          Operator
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-canvas)] text-[var(--color-ink)] border border-[var(--color-hairline)] shadow-xs capitalize">
          {role}
        </span>
      );
  }
}

function getRoleAvatarStyle(role?: string): string {
  switch (role) {
    case "super_admin":
      return "from-rose-500/20 to-red-600/25 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800";
    case "admin":
      return "from-amber-500/20 to-amber-600/25 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800";
    case "manager":
      return "from-indigo-500/20 to-indigo-600/25 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800";
    case "supervisor":
      return "from-teal-500/20 to-teal-600/25 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-800";
    case "hr":
      return "from-emerald-500/20 to-emerald-600/25 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800";
    case "operator":
      return "from-amber-500/20 to-yellow-600/25 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800";
    default:
      return "from-zinc-500/20 to-zinc-600/25 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-800";
  }
}

function getInitials(name?: string): string {
  return getUserInitials(name);
}

/* ────────────────────────────────────────────────────────────────────────────
 * Presentation primitives (shared, premium Geist surfaces)
 * ──────────────────────────────────────────────────────────────────────────── */

type PanelTone = "sky" | "teal" | "amber" | "indigo" | "emerald" | "rose" | "violet";

const PANEL_TONE_CLASS: Record<PanelTone, string> = {
  sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
  teal: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
};

interface PanelProps {
  icon: React.ReactNode;
  tone?: PanelTone;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Standardised tab panel shell: hairline card + eyebrow header + generous body. */
function Panel({ icon, tone = "sky", title, subtitle, actions, footer, children, className = "" }: PanelProps) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xs ${className}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-hairline)] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${PANEL_TONE_CLASS[tone]}`}
            aria-hidden="true"
          >
            {icon}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[13px] font-bold leading-tight tracking-[-0.01em] text-[var(--color-ink)] sm:text-sm">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 truncate text-[10.5px] font-medium leading-tight text-[var(--color-mute)]">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className="p-3.5 sm:p-5">{children}</div>
      {footer && (
        <footer className="border-t border-[var(--color-hairline)] bg-[var(--color-canvas)]/60 px-4 py-2.5 text-[10.5px] font-medium text-[var(--color-mute)] sm:px-5">
          {footer}
        </footer>
      )}
    </section>
  );
}

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  copied?: boolean;
  onCopy?: () => void;
  valueClassName?: string;
  title?: string;
  truncate?: boolean;
}

/** Label/value row used inside the profile detail groups. */
function DetailRow({
  label,
  value,
  mono = false,
  copied = false,
  onCopy,
  valueClassName = "",
  title,
  truncate = false,
}: DetailRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-[11px] font-medium text-[var(--color-mute)]">{label}</dt>
      <dd className="flex min-w-0 items-center justify-end gap-1.5 text-right">
        <span
          title={title}
          className={`min-w-0 text-xs font-semibold text-[var(--color-ink)] ${truncate ? "block truncate" : "break-words"} ${
            mono ? "font-mono" : ""
          } ${valueClassName}`}
        >
          {value}
        </span>
        {onCopy && (
          <button
            type="button"
            onClick={onCopy}
            aria-label={`Copy ${label}`}
            title={`Copy ${label}`}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--color-mute)] transition-colors hover:bg-[var(--color-hairline)] hover:text-[var(--color-ink)] focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-[var(--color-link)]/40 cursor-pointer"
          >
            {copied ? (
              <AnimatedCheck size={11} className="text-emerald-500" />
            ) : (
              <AnimatedCopy size={11} />
            )}
          </button>
        )}
      </dd>
    </div>
  );
}

function formatFileSize(bytes?: number | null): string {
  const size = Number(bytes || 0);
  if (!size) return "Size n/a";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function humanizeAction(action: string): string {
  return action
    .replace(/[_.]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" || typeof value === "number") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

const AUDIT_CATEGORY_ICON: Record<string, React.ReactNode> = {
  security: <ShieldCheck className="h-3.5 w-3.5" />,
  authentication: <LogIn className="h-3.5 w-3.5" />,
  document: <FileCheck2 className="h-3.5 w-3.5" />,
  documents: <FileCheck2 className="h-3.5 w-3.5" />,
  role: <UserCog className="h-3.5 w-3.5" />,
  permissions: <KeyRound className="h-3.5 w-3.5" />,
  profile: <IdCard className="h-3.5 w-3.5" />,
  machine: <AnimatedTruck size={14} />,
  assignment: <AnimatedTruck size={14} />,
  attendance: <AnimatedCalendarClock size={14} />,
};

function AuditCategoryGlyph({ category }: { category: string | null }) {
  return (
    <>{AUDIT_CATEGORY_ICON[(category || "").toLowerCase()] || <ScanLine className="h-3.5 w-3.5" />}</>
  );
}

function DocStatusPill({ status, pendingApproval = false }: { status: string; pendingApproval?: boolean }) {
  if (status === "verified") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
        <ShieldCheck className="h-3 w-3" />
        Verified
      </span>
    );
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
        <ShieldAlert className="h-3 w-3" />
        Rejected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
      <Shield className="h-3 w-3" />
      {pendingApproval ? "Awaiting approval" : "Pending review"}
    </span>
  );
}

export function UserDetailClient({
  user: initialUser,
  currentUser,
  isSuperAdmin,
  canManage,
  kpis,
  machines: initialMachines,
  runningLogs,
  assignments: initialAssignments,
  auditLogs,
  documents,
  documentTypes,
  supervisors = [],
  operators: initialOperators = [],
}: UserDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [user, setUser] = useState<User>(initialUser);
  const [machines, setMachines] = useState<UserMachineItem[]>(initialMachines);
  const [assignments, setAssignments] = useState<UserAssignmentItem[]>(initialAssignments);
  const [operators, setOperators] = useState<SupervisedOperatorItem[]>(initialOperators);
  const [activeTab, setActiveTab] = useState<UserDetailTabKey>("machines");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showFullAadhaar, setShowFullAadhaar] = useState(false);
  const [showFullBankAccount, setShowFullBankAccount] = useState(false);
  const [docList, setDocList] = useState<UserDocument[]>(documents);
  const [verifyingDocId, setVerifyingDocId] = useState<string | null>(null);
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectModalDoc, setRejectModalDoc] = useState<UserDocument | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");

  const availableTabs = useMemo(() => {
    const tabs: Array<{ key: UserDetailTabKey; label: string; count?: number }> = [
      { key: "machines", label: "Machines", count: machines.length },
    ];

    if (user.role === "supervisor") {
      tabs.push({ key: "operators", label: "Operators", count: operators.length });
    } else if (user.role === "operator") {
      tabs.push({ key: "logs", label: "Running Logs", count: runningLogs.length });
      tabs.push({ key: "assignments", label: "Assignments", count: assignments.length });
      tabs.push({ key: "attendance", label: "Attendance" });
    }

    tabs.push({ key: "documents", label: "KYC & Documents", count: docList.length });
    tabs.push({ key: "audit", label: "Audit Trail", count: auditLogs.length });

    return tabs;
  }, [user.role, machines.length, operators.length, runningLogs.length, assignments.length, docList.length, auditLogs.length]);

  useEffect(() => {
    if (!availableTabs.some((t) => t.key === activeTab)) {
      setActiveTab("machines");
    }
  }, [availableTabs, activeTab]);

  useEffect(() => {
    setDocList(documents);
  }, [documents]);

  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  useEffect(() => {
    setMachines(initialMachines);
  }, [initialMachines]);

  useEffect(() => {
    setAssignments(initialAssignments);
  }, [initialAssignments]);

  useEffect(() => {
    setOperators(initialOperators);
  }, [initialOperators]);

  const handleRefreshUserData = useCallback(async () => {
    try {
      const isSup = user.role === "supervisor";
      const [detailRes, machinesRes, assignmentsRes, docsRes, opsRes] = await Promise.all([
        getUserDetailAction(user.id),
        getUserAssignedMachinesAction(user.id, user.role),
        getUserAssignmentsAction(user.id),
        getUserDocumentsAction(user.id).catch(() => []),
        isSup ? getUserSupervisedOperatorsAction(user.id).catch(() => ({ operators: [] })) : Promise.resolve({ operators: [] }),
      ]);

      if (detailRes.user) {
        setUser(detailRes.user);
      }
      if (machinesRes.machines) {
        setMachines(machinesRes.machines);
      }
      if (assignmentsRes.assignments) {
        setAssignments(assignmentsRes.assignments);
      }
      if (Array.isArray(docsRes)) {
        setDocList(docsRes);
      }
      if (opsRes.operators) {
        setOperators(opsRes.operators);
      }
    } catch (err) {
      console.error("Failed to refresh user data", err);
    } finally {
      router.refresh();
    }
  }, [user.id, user.role, router]);

  // Modals & Action States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [activeViewerDoc, setActiveViewerDoc] = useState<ViewerDocument | null>(null);

  // Confirmation dialogs
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmToggleOpen, setConfirmToggleOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [resetPasswordResult, setResetPasswordResult] = useState<{ userName: string; temporaryPassword: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setIsActionsMenuOpen(false);
      }
    };
    if (isActionsMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isActionsMenuOpen]);

  const cleanPhone = (user.phone || "").replace(/[^0-9+]/g, "");
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone.replace("+", "")}?text=${encodeURIComponent(
        `Hello ${user.full_name}, ReachInternational regarding your profile ${user.employee_id || ""}.`
      )}`
    : "";

  // Listen for mobile top header 3-dot contextual actions
  useEffect(() => {
    const handleEditProfile = () => {
      if (canManage) {
        setIsEditModalOpen(true);
      } else {
        toast("error", "You do not have permission to edit this profile");
      }
    };

    const handleAssignEquipment = () => {
      if (user.role === "operator") {
        setIsAssignModalOpen(true);
      } else {
        toast("info", "Equipment assignment is only applicable for operators");
      }
    };

    const handleResetPassword = () => {
      if (canManage) {
        setConfirmResetOpen(true);
      }
    };

    const handleToggleStatus = () => {
      if (canManage) {
        if (user.id === currentUser.id) {
          toast("error", "You cannot change your own account status");
          return;
        }
        setConfirmToggleOpen(true);
      }
    };

    const handleDeleteUser = () => {
      if (isSuperAdmin) {
        if (user.id === currentUser.id) {
          toast("error", "You cannot delete your own account");
          return;
        }
        setConfirmDeleteOpen(true);
      }
    };

    const handleEmail = () => {
      if (user.email) {
        window.location.href = `mailto:${user.email}`;
      } else {
        toast("error", "No email address found for this user");
      }
    };

    const handleWhatsapp = () => {
      if (whatsappUrl) {
        window.open(whatsappUrl, "_blank", "noopener,noreferrer");
      } else {
        toast("error", "No phone number available for WhatsApp chat");
      }
    };

    const handleCall = () => {
      if (cleanPhone) {
        window.location.href = `tel:${cleanPhone}`;
      } else {
        toast("error", "No phone number available for calls");
      }
    };

    window.addEventListener("reach:user-edit-profile", handleEditProfile);
    window.addEventListener("reach:user-assign-equipment", handleAssignEquipment);
    window.addEventListener("reach:user-reset-password", handleResetPassword);
    window.addEventListener("reach:user-toggle-status", handleToggleStatus);
    window.addEventListener("reach:user-delete", handleDeleteUser);
    window.addEventListener("reach:user-email", handleEmail);
    window.addEventListener("reach:user-whatsapp", handleWhatsapp);
    window.addEventListener("reach:user-call", handleCall);

    return () => {
      window.removeEventListener("reach:user-edit-profile", handleEditProfile);
      window.removeEventListener("reach:user-assign-equipment", handleAssignEquipment);
      window.removeEventListener("reach:user-reset-password", handleResetPassword);
      window.removeEventListener("reach:user-toggle-status", handleToggleStatus);
      window.removeEventListener("reach:user-delete", handleDeleteUser);
      window.removeEventListener("reach:user-email", handleEmail);
      window.removeEventListener("reach:user-whatsapp", handleWhatsapp);
      window.removeEventListener("reach:user-call", handleCall);
    };
  }, [user.role, user.email, user.id, currentUser.id, canManage, isSuperAdmin, whatsappUrl, cleanPhone, toast]);

  // Synchronize and refetch user data when assignments or personnel change across the platform
  useEffect(() => {
    const handleAssignmentRefresh = (e: Event) => {
      const customEvent = e as CustomEvent<{ userId?: string }>;
      if (!customEvent.detail?.userId || customEvent.detail.userId === user.id) {
        handleRefreshUserData();
      }
    };
    window.addEventListener("reach:refresh-user-assignments", handleAssignmentRefresh);
    window.addEventListener("reach:refresh-machine-personnel", handleRefreshUserData);
    return () => {
      window.removeEventListener("reach:refresh-user-assignments", handleAssignmentRefresh);
      window.removeEventListener("reach:refresh-machine-personnel", handleRefreshUserData);
    };
  }, [user.id, handleRefreshUserData]);

  const handleCopy = useCallback((text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast("success", `${key} copied to clipboard`);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  }, [toast]);

  // Sensitive docs view permission
  const canRevealDocs = useMemo(() => {
    if (currentUser.role === "super_admin" || currentUser.role === "admin" || currentUser.role === "hr") return true;
    if (user.id === currentUser.id) return true;
    return false;
  }, [currentUser.role, currentUser.id, user.id]);

  const canVerifyReject = useMemo(() => {
    return ["super_admin", "admin", "hr"].includes(currentUser.role);
  }, [currentUser.role]);

  const handleToggleAadhaar = useCallback(() => {
    const next = !showFullAadhaar;
    setShowFullAadhaar(next);
    if (next && user.id) {
      void logSensitiveRevealAction({ targetUserId: user.id, field: "aadhaar" });
    }
  }, [showFullAadhaar, user.id]);

  const handleToggleBankAccount = useCallback(() => {
    const next = !showFullBankAccount;
    setShowFullBankAccount(next);
    if (next && user.id) {
      void logSensitiveRevealAction({ targetUserId: user.id, field: "bank_account" });
    }
  }, [showFullBankAccount, user.id]);

  const [approvingReplacementId, setApprovingReplacementId] = useState<string | null>(null);

  const handleApproveReplacement = useCallback(
    async (requestId: string, docLabel: string) => {
      setApprovingReplacementId(requestId);
      try {
        const res = await approveDocumentReplacementAction({ requestId });
        if (res.success) {
          toast("success", `${docLabel} approved and verified.`);
          handleRefreshUserData();
        } else {
          toast("error", res.error || "Failed to approve document replacement.");
        }
      } catch (err: any) {
        toast("error", err?.message || "Failed to approve document replacement.");
      } finally {
        setApprovingReplacementId(null);
      }
    },
    [toast, handleRefreshUserData]
  );

  const handleVerifyDoc = useCallback(
    async (doc: UserDocument) => {
      setVerifyingDocId(doc.id);
      try {
        if (doc.is_pending_request) {
          const res = await approveDocumentReplacementAction({ requestId: doc.id });
          if (res.success) {
            toast("success", `${doc.document_type_code.replace(/_/g, " ")} approved and verified.`);
            handleRefreshUserData();
          } else {
            toast("error", res.error || "Failed to approve document.");
          }
        } else {
          const res = await verifyUserDocumentAction({ documentId: doc.id, userId: user.id });
          if (res.success) {
            toast("success", `${doc.document_type_code.replace(/_/g, " ")} verified successfully.`);
            setDocList((prev) =>
              prev.map((d) =>
                d.id === doc.id
                  ? { ...d, verification_status: "verified", rejection_reason: null }
                  : d
              )
            );
            handleRefreshUserData();
          } else {
            toast("error", res.error || "Failed to verify document.");
          }
        }
      } catch {
        toast("error", "An unexpected error occurred.");
      } finally {
        setVerifyingDocId(null);
      }
    },
    [user.id, toast, handleRefreshUserData]
  );

  const handleOpenRejectModal = useCallback((doc: UserDocument) => {
    setRejectModalDoc(doc);
    setRejectionReasonInput("");
  }, []);

  const handleConfirmRejectDoc = useCallback(async () => {
    if (!rejectModalDoc) return;
    if (!rejectionReasonInput.trim()) {
      toast("error", "Please provide a reason for rejecting the document.");
      return;
    }
    setRejectingDocId(rejectModalDoc.id);
    try {
      if (rejectModalDoc.is_pending_request) {
        const res = await rejectDocumentReplacementAction({
          requestId: rejectModalDoc.id,
          rejectionReason: rejectionReasonInput.trim(),
        });
        if (res.success) {
          toast("info", `${rejectModalDoc.document_type_code.replace(/_/g, " ")} marked as rejected.`);
          setRejectModalDoc(null);
          setRejectionReasonInput("");
          handleRefreshUserData();
        } else {
          toast("error", res.error || "Failed to reject document replacement.");
        }
      } else {
        const res = await rejectUserDocumentAction({
          documentId: rejectModalDoc.id,
          userId: user.id,
          rejectionReason: rejectionReasonInput.trim(),
        });
        if (res.success) {
          toast("info", `${rejectModalDoc.document_type_code.replace(/_/g, " ")} marked as rejected.`);
          setDocList((prev) =>
            prev.map((d) =>
              d.id === rejectModalDoc.id
                ? {
                    ...d,
                    verification_status: "rejected",
                    rejection_reason: rejectionReasonInput.trim(),
                  }
                : d
            )
          );
          setRejectModalDoc(null);
          setRejectionReasonInput("");
          handleRefreshUserData();
        } else {
          toast("error", res.error || "Failed to reject document.");
        }
      }
    } catch {
      toast("error", "An unexpected error occurred.");
    } finally {
      setRejectingDocId(null);
    }
  }, [rejectModalDoc, rejectionReasonInput, user.id, toast, handleRefreshUserData]);

  // Tab data (search box removed from profile view)
  const filteredMachines = machines;
  const filteredOperators = operators;
  const filteredLogs = runningLogs;
  const filteredAssignments = assignments;
  const filteredAuditLogs = auditLogs;

  // Document viewer handler
  const handleViewDoc = async (doc: UserDocument) => {
    try {
      const res = await getDocumentViewUrlAction({
        documentId: doc.id,
        targetUserId: doc.user_id,
      });
      if (res.success && res.signedUrl) {
        setActiveViewerDoc({
          id: doc.id,
          title: res.title || doc.document_type_code,
          url: res.signedUrl,
          mimeType: res.mimeType || doc.mime_type,
          fileSizeBytes: res.fileSizeBytes || doc.file_size_bytes,
          fileName: res.fileName || doc.storage_path.split("/").pop(),
        });
        return;
      }
    } catch {
      // fallback
    }

    if (doc.signed_url) {
      setActiveViewerDoc({
        id: doc.id,
        title: doc.document_type_code === "aadhaar" ? "Aadhaar Card" : "Driving Licence",
        url: doc.signed_url,
        mimeType: doc.mime_type,
        fileSizeBytes: doc.file_size_bytes,
        fileName: doc.storage_path.split("/").pop(),
      });
    } else {
      toast("error", "Unable to load secure preview for this document");
    }
  };

  // Reset password action
  const handleExecuteResetPassword = async () => {
    setActionLoading(true);
    try {
      const res = await resetUserPassword(user.id);
      setConfirmResetOpen(false);
      if (res.formState?.error) {
        toast("error", res.formState.error || "Failed to reset password");
      } else if (res.newPassword) {
        setResetPasswordResult({
          userName: user.full_name,
          temporaryPassword: res.newPassword,
        });
        toast("success", "Password reset successfully");
      } else {
        toast("success", res.formState?.message || "Password reset instructions sent");
      }
    } catch (err: any) {
      setConfirmResetOpen(false);
      toast("error", err?.message || "Error resetting password");
    } finally {
      setActionLoading(false);
    }
  };

  // Toggle user status action
  const handleExecuteToggleStatus = async () => {
    setActionLoading(true);
    try {
      const newStatus = user.status === "active" ? "inactive" : "active";
      const res = await toggleUserStatus(user.id);
      if (!res.error) {
        setUser((prev) => ({ ...prev, status: newStatus as any }));
        toast("success", `Account marked as ${newStatus}`);
      } else {
        toast("error", res.error || "Failed to update user status");
      }
    } catch (err: any) {
      toast("error", err?.message || "Error updating user status");
    } finally {
      setActionLoading(false);
      setConfirmToggleOpen(false);
    }
  };

  // Delete user action
  const handleExecuteDelete = async () => {
    setActionLoading(true);
    try {
      const res = await deleteUser(user.id);
      if (!res.error) {
        toast("success", "User account deleted successfully");
        router.push("/users");
      } else {
        toast("error", res.error || "Failed to delete user");
        setActionLoading(false);
        setConfirmDeleteOpen(false);
      }
    } catch (err: any) {
      toast("error", err?.message || "Error deleting user");
      setActionLoading(false);
      setConfirmDeleteOpen(false);
    }
  };

  // Handle edit submission
  const handleEditSubmit = async (formData: FormData) => {
    setIsEditSubmitting(true);
    try {
      formData.set("id", user.id);
      const res = await editUser(user.id, formData);
      if (!res.error) {
        toast("success", "User profile updated successfully");
        setIsEditModalOpen(false);
        // Refresh local user state
        const fresh = await getUserDetailAction(user.id);
        if (fresh.user) {
          setUser(fresh.user);
        }
        router.refresh();
      } else {
        toast("error", res.error || "Failed to update profile");
      }
    } catch (err: any) {
      toast("error", err?.message || "Error updating profile");
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const assignedSupervisors = useMemo(() => {
    if (user.supervisors && user.supervisors.length > 0) return user.supervisors;
    if (user.supervisor) return [user.supervisor];
    return [];
  }, [user.supervisors, user.supervisor]);

  const shiftDisplay = useMemo(() => {
    if (user.shift_time) return user.shift_time;
    if (user.shift_start_time && user.shift_end_time) {
      return `${formatShiftTime(user.shift_start_time)} – ${formatShiftTime(user.shift_end_time)}`;
    }
    return "09:00 AM – 06:00 PM (Standard)";
  }, [user.shift_time, user.shift_start_time, user.shift_end_time]);

  const plLeaveDisplay = useMemo(() => {
    if (user.total_pl_quota == null) return "12 days";
    const remaining = Math.max(Number(user.total_pl_quota) - Number(user.pl_used_as_on_date || 0), 0);
    return `${remaining} / ${user.total_pl_quota} days`;
  }, [user.total_pl_quota, user.pl_used_as_on_date]);

  /** Current payroll month (IST) for the attendance deep link. */
  const currentMonthIST = useMemo(
    () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 7),
    []
  );

  const docStats = useMemo(() => {
    const verified = docList.filter((d) => d.verification_status === "verified").length;
    const rejected = docList.filter((d) => d.verification_status === "rejected").length;
    return { verified, rejected, pending: Math.max(docList.length - verified - rejected, 0) };
  }, [docList]);

  /** Statutory numbers whose upload has not landed yet, so they stay visible beside the rest. */
  const missingTypedDocuments = useMemo(() => {
    const has = (code: string) => docList.some((d) => d.document_type_code === code);
    const items: Array<{ code: string; label: string; hint: string }> = [];
    if (user.aadhaar_number && !has("aadhaar")) {
      items.push({ code: "aadhaar", label: "Aadhaar Card", hint: "Number on record · no scan uploaded" });
    }
    if (user.license_number && !has("driving_license")) {
      items.push({ code: "driving_license", label: "Driving Licence", hint: "Number on record · no scan uploaded" });
    }
    if (user.bank_account_number && !has("bank_document")) {
      items.push({ code: "bank_document", label: "Banking Document", hint: "Account on record · no scan uploaded" });
    }
    return items;
  }, [docList, user.aadhaar_number, user.license_number, user.bank_account_number]);

  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  const [auditVisibleCount, setAuditVisibleCount] = useState(10);

  // Statutory typed value helpers reused by the merged document cards
  const getTypedValueForDoc = useCallback(
    (code: string): { label: string; value: string; revealable: boolean } | null => {
      if (code === "aadhaar") {
        return {
          label: "Aadhaar number",
          value: user.aadhaar_number
            ? showFullAadhaar
              ? user.aadhaar_number
              : maskAadhaar(user.aadhaar_number)
            : "Not provided",
          revealable: Boolean(user.aadhaar_number && canRevealDocs),
        };
      }
      if (code === "driving_license") {
        return {
          label: "Licence number",
          value: user.license_number ? formatLicenseNumber(user.license_number) : "Not provided",
          revealable: false,
        };
      }
      if (code === "bank_document") {
        return {
          label: "Bank account",
          value: user.bank_account_number
            ? `${showFullBankAccount ? user.bank_account_number : maskBankAccount(user.bank_account_number)} · ${
                user.bank_ifsc_code || "No IFSC"
              }`
            : "Not provided",
          revealable: Boolean(user.bank_account_number && canRevealDocs && canVerifyReject),
        };
      }
      return null;
    },
    [
      user.aadhaar_number,
      user.license_number,
      user.bank_account_number,
      user.bank_ifsc_code,
      showFullAadhaar,
      showFullBankAccount,
      canRevealDocs,
      canVerifyReject,
    ]
  );

  const toggleTypedReveal = useCallback(
    (code: string) => {
      if (code === "aadhaar") handleToggleAadhaar();
      else if (code === "bank_document") handleToggleBankAccount();
    },
    [handleToggleAadhaar, handleToggleBankAccount]
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 pb-16 sm:gap-5 md:pb-8">
      {/* ─── 1. TOP BREADCRUMB ─── */}
      <div className="flex items-center">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[11px] text-[var(--color-mute)]">
          <Link href="/dashboard" className="transition-colors hover:text-[var(--color-ink)]">
            Home
          </Link>
          <ChevronRight className="h-3 w-3 shrink-0 text-[var(--color-faint)]" aria-hidden="true" />
          <Link href="/users" className="transition-colors hover:text-[var(--color-ink)]">
            Users
          </Link>
          <ChevronRight className="h-3 w-3 shrink-0 text-[var(--color-faint)]" aria-hidden="true" />
          <span className="max-w-[200px] truncate font-semibold text-[var(--color-ink)] sm:max-w-[320px]">
            {user.full_name}
          </span>
        </nav>
      </div>

      {/* ─── 2. MASTER HERO BANNER CARD ─── */}
      <section className="relative overflow-hidden rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xs">
        {/* Subtle top hairline gradient accent (Reserved for identity emphasis only) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-sky-500/45 to-transparent" />

        <div className="flex flex-col gap-4 p-4 sm:p-5 xl:p-6">
          {/* Top Row: Avatar + Name & Chips + Desktop/Mobile Actions */}
          <div className="flex items-start justify-between gap-3">
            {/* Left: Avatar + Identity + Chips */}
            <div className="flex min-w-0 flex-1 items-center gap-3.5 sm:gap-4">
              <div className="relative shrink-0">
                <div
                  className={`flex h-13 w-13 items-center justify-center rounded-xl border bg-gradient-to-br font-bold text-base shadow-xs select-none sm:h-16 sm:w-16 sm:text-xl ${getRoleAvatarStyle(
                    user.role
                  )}`}
                >
                  <span>{getInitials(user.full_name)}</span>
                </div>
                <span
                  aria-hidden="true"
                  className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-[var(--color-canvas-elevated)] ${
                    user.status === "active" ? "bg-emerald-500" : "bg-slate-400"
                  }`}
                />
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <h1 className="truncate text-lg font-bold leading-tight tracking-[-0.02em] text-[var(--color-ink)] sm:text-xl lg:text-2xl">
                  {user.full_name}
                </h1>

                {/* Primary Badges & Chips */}
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  {/* Monospace EMP-xxxx Badge with 1-click copy */}
                  <button
                    type="button"
                    onClick={() => handleCopy(user.employee_id || user.id, "Employee ID")}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-2.5 py-0.5 font-mono text-[11px] font-bold text-[var(--color-ink)] shadow-2xs transition-all hover:border-[var(--color-link)]/60 hover:bg-[var(--color-hairline-soft-surface)] cursor-pointer"
                    title="Click to copy Employee ID"
                  >
                    <span>{user.employee_id || `ID: ${user.id.slice(0, 8)}`}</span>
                    {copiedKey === "Employee ID" ? (
                      <AnimatedCheck size={11} className="shrink-0 text-emerald-500" />
                    ) : (
                      <AnimatedCopy size={11} className="shrink-0 text-[var(--color-mute)]" />
                    )}
                  </button>

                  {getRoleBadge(user.role)}

                  {user.role === "operator" && user.machine_category && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-sky-700 shadow-xs dark:border-sky-800/80 dark:bg-sky-950/60 dark:text-sky-300">
                      {formatMachineCategoryLabel(user.machine_category)}
                    </span>
                  )}

                  {/* Status Badge */}
                  {user.status === "active" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/80 bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 shadow-xs dark:border-emerald-800/80 dark:bg-emerald-950/80 dark:text-emerald-300">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold capitalize text-slate-700 shadow-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                      {user.status}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions: Desktop Edit button + 3-Dot menu (always anchored at top right) */}
            <div className="flex shrink-0 items-center gap-2">
              {canManage && (
                <div className="hidden sm:block">
                  <Button
                    variant="primary"
                    onClick={() => setIsEditModalOpen(true)}
                    className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md px-3.5 text-xs font-semibold shadow-xs"
                  >
                    <AnimatedEdit size={14} className="shrink-0" />
                    <span>Edit Profile</span>
                  </Button>
                </div>
              )}

              {/* 3-Dot Actions Menu (works seamlessly on mobile & desktop) */}
              <div className="relative" ref={actionsMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsActionsMenuOpen((prev) => !prev)}
                  className="inline-flex items-center justify-center h-9 w-9 rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors shadow-2xs cursor-pointer"
                  title="More options"
                  aria-label="More options"
                  aria-expanded={isActionsMenuOpen}
                >
                  <MoreVertical size={16} />
                </button>

                <AnimatePresence>
                  {isActionsMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.98 }}
                      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute right-0 top-full mt-1.5 min-w-[210px] rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-1.5 shadow-2xl space-y-0.5 z-50 backdrop-blur-md"
                    >
                      {/* Edit Profile */}
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsActionsMenuOpen(false);
                            setIsEditModalOpen(true);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors cursor-pointer text-left"
                        >
                          <AnimatedEdit size={14} className="text-sky-500 shrink-0" />
                          <span>Edit Profile</span>
                        </button>
                      )}
                      {/* Assign Equipment (Operators) */}
                      {canManage && user.role === "operator" && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsActionsMenuOpen(false);
                            setIsAssignModalOpen(true);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors cursor-pointer text-left"
                        >
                          <AnimatedWrench size={14} className="text-amber-500 shrink-0" />
                          <span>Assign Equipment</span>
                        </button>
                      )}

                      {/* Email Option */}
                      {user.email && (
                        <a
                          href={`mailto:${user.email}`}
                          onClick={() => setIsActionsMenuOpen(false)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors cursor-pointer text-left"
                        >
                          <AnimatedMail size={14} className="text-sky-500 shrink-0" />
                          <span>Send Email</span>
                        </a>
                      )}

                      {/* WhatsApp Option */}
                      {whatsappUrl && (
                        <a
                          href={whatsappUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setIsActionsMenuOpen(false)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors cursor-pointer text-left"
                        >
                          <ExternalLink size={14} className="text-emerald-500 shrink-0" />
                          <span>Chat on WhatsApp</span>
                        </a>
                      )}

                      {/* Reset Password */}
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsActionsMenuOpen(false);
                            setConfirmResetOpen(true);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors cursor-pointer text-left"
                        >
                          <AnimatedKey size={14} className="text-amber-500 shrink-0" />
                          <span>Reset Password</span>
                        </button>
                      )}

                      {/* Deactivate / Activate Account */}
                      {canManage && user.id !== currentUser.id && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsActionsMenuOpen(false);
                            setConfirmToggleOpen(true);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-colors cursor-pointer text-left"
                        >
                          <AnimatedPower
                            size={14}
                            className={user.status === "active" ? "text-amber-600 shrink-0" : "text-emerald-600 shrink-0"}
                          />
                          <span>{user.status === "active" ? "Deactivate Account" : "Activate Account"}</span>
                        </button>
                      )}

                      {/* Delete Account */}
                      {isSuperAdmin && user.id !== currentUser.id && (
                        <div className="pt-1 mt-1 border-t border-[var(--color-hairline)]">
                          <button
                            type="button"
                            onClick={() => {
                              setIsActionsMenuOpen(false);
                              setConfirmDeleteOpen(true);
                            }}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer text-left"
                          >
                            <AnimatedTrash2 size={14} className="text-red-600 shrink-0" />
                            <span>Delete Account</span>
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Formatted Operational Metadata Grid: Shift, Joined, Supervisor, Location */}
          <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)]/60 p-3 text-xs sm:grid-cols-4 sm:gap-3">
            {/* Shift Time */}
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="flex items-center gap-1 text-[10.5px] font-medium text-[var(--color-mute)]">
                <AnimatedClock size={12} className="shrink-0 text-amber-500" />
                <span>Shift Time</span>
              </span>
              <span className="truncate font-semibold text-[var(--color-ink)]">
                {shiftDisplay && shiftDisplay !== "—" ? shiftDisplay : "Standard Shift"}
              </span>
            </div>

            {/* Joining Date */}
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="flex items-center gap-1 text-[10.5px] font-medium text-[var(--color-mute)]">
                <CalendarDays className="h-3 w-3 shrink-0 text-violet-500" />
                <span>Joining Date</span>
              </span>
              <span className="truncate font-semibold text-[var(--color-ink)]">
                {formatDate(user.doj || user.created_at)}
              </span>
            </div>

            {/* Supervisor */}
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="flex items-center gap-1 text-[10.5px] font-medium text-[var(--color-mute)]">
                <Users className="h-3 w-3 shrink-0 text-teal-500" />
                <span>Supervisor</span>
              </span>
              <span className="truncate font-semibold text-[var(--color-ink)]">
                {assignedSupervisors.length > 0
                  ? assignedSupervisors.map((s) => s.full_name).join(", ")
                  : "Unassigned"}
              </span>
            </div>

            {/* Location */}
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="flex items-center gap-1 text-[10.5px] font-medium text-[var(--color-mute)]">
                <AnimatedMapPin size={12} className="shrink-0 text-sky-500" />
                <span>Location</span>
              </span>
              <span className="truncate font-semibold text-[var(--color-ink)]">
                {user.location || (user.city && user.state ? `${user.city}, ${user.state}` : user.city || "—")}
              </span>
            </div>
          </div>

          {/* Mobile Full-Width Action Button (Eliminates dead space on mobile) */}
          {canManage && (
            <div className="pt-0.5 sm:hidden">
              <Button
                variant="primary"
                onClick={() => setIsEditModalOpen(true)}
                className="flex h-9 w-full cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 text-xs font-semibold shadow-xs"
              >
                <AnimatedEdit size={14} className="shrink-0" />
                <span>Edit Profile</span>
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* ─── 3. PROFILE DETAIL GROUPS (single surface, 0 duplicate fields) ─── */}
      <section className="overflow-hidden rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-2xs">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-hairline)] px-4 py-2.5 sm:px-5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-mute)]">
            Profile Details
          </p>
          <span className="hidden text-[10.5px] font-medium text-[var(--color-faint)] sm:inline">
            Directory record · read-only
          </span>
        </div>

        <div className="grid grid-cols-1 gap-px bg-[var(--color-hairline)] md:grid-cols-3">
          {/* Group 1: Contact Information */}
          <div className="bg-[var(--color-canvas-elevated)] p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md border border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <AnimatedMail size={13} />
              </span>
              <h3 className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--color-mute)]">Contact</h3>
            </div>
            <dl className="divide-y divide-[var(--color-hairline)]/60">
              <DetailRow
                label="Email"
                value={user.email || "—"}
                title={user.email || undefined}
                truncate
                copied={copiedKey === "Email"}
                onCopy={user.email ? () => handleCopy(user.email!, "Email") : undefined}
              />
              <DetailRow
                label="Phone"
                value={user.phone || "—"}
                mono
                copied={copiedKey === "Phone"}
                onCopy={user.phone ? () => handleCopy(user.phone!, "Phone") : undefined}
              />
              <DetailRow
                label="WhatsApp"
                value={
                  whatsappUrl ? (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-emerald-600 hover:underline dark:text-emerald-400"
                    >
                      <span>Chat direct</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
            </dl>
          </div>

          {/* Group 2: Leave & Compensation */}
          <div className="bg-[var(--color-canvas-elevated)] p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md border border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AnimatedClock size={13} />
              </span>
              <h3 className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--color-mute)]">
                Pay &amp; Leave
              </h3>
            </div>
            <dl className="divide-y divide-[var(--color-hairline)]/60">
              <DetailRow label="PL Leave Quota" value={plLeaveDisplay} />
              {canManage && user.monthly_salary != null && Number(user.monthly_salary) > 0 ? (
                <DetailRow
                  label="Monthly Salary"
                  value={`₹${Number(user.monthly_salary).toLocaleString("en-IN")}`}
                  mono
                  valueClassName="text-emerald-600 dark:text-emerald-400"
                />
              ) : (
                <DetailRow label="Compensation" value="Standard grade" />
              )}
              {user.role === "supervisor" && (
                <DetailRow
                  label="Supervised"
                  value={
                    <button
                      type="button"
                      onClick={() => setActiveTab("operators")}
                      className="inline-flex items-center gap-1 font-semibold text-[var(--color-link)] hover:underline cursor-pointer"
                    >
                      <span>
                        {operators.length} {operators.length === 1 ? "operator" : "operators"}
                      </span>
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  }
                />
              )}
            </dl>
          </div>

          {/* Group 3: Residential Address */}
          <div className="bg-[var(--color-canvas-elevated)] p-4">
            <div className="mb-2.5 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md border border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <AnimatedMapPin size={13} />
              </span>
              <h3 className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-[var(--color-mute)]">Address</h3>
            </div>
            <dl className="divide-y divide-[var(--color-hairline)]/60">
              <DetailRow
                label="Street"
                value={user.street || user.address || "—"}
                title={user.street || user.address || undefined}
                truncate
              />
              <DetailRow
                label="City / District"
                value={user.city && user.district ? `${user.city}, ${user.district}` : user.city || user.district || "—"}
              />
              <DetailRow label="State" value={user.state || "—"} />
            </dl>
          </div>
        </div>
      </section>

      {/* ─── 4. TAB STRIP (Search removed from profile view) ─── */}
      <div className="sticky top-12 z-20 -mx-3 border-b border-[var(--color-hairline)] bg-[var(--color-canvas)]/92 px-3 py-2 backdrop-blur-md sm:-mx-6 sm:px-6 md:top-0">
        <nav
          aria-label="Profile sections"
          className="-mx-1 flex min-w-0 flex-wrap items-center gap-1.5 px-1 py-0.5"
        >
          {availableTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-[36px] shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-xs ring-1 ring-[var(--color-ink)]"
                    : "border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-mute)] hover:border-[var(--color-hairline)] hover:bg-[var(--color-hairline-soft-surface)] hover:text-[var(--color-ink)]"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`rounded-full px-1.5 py-px font-mono text-[10px] font-bold ${
                      isActive
                        ? "bg-[var(--color-canvas)]/20 text-[var(--color-canvas)]"
                        : "bg-[var(--color-hairline)] text-[var(--color-mute)]"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* ─── 6. TAB CONTENT PANELS ─── */}

      {/* TAB 1: Assigned / Supervised Machinery Fleet */}
      {activeTab === "machines" && (
        <Panel
          icon={<AnimatedTruck size={15} />}
          tone="sky"
          title={user.role === "supervisor" ? "Supervised Machinery Fleet" : "Assigned Machinery Fleet"}
          subtitle={`${filteredMachines.length} of ${machines.length} machines`}
          actions={
            canManage && user.role === "operator" ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsAssignModalOpen(true)}
                className="flex h-8 cursor-pointer items-center gap-1.5 px-2.5 text-xs shadow-2xs"
              >
                <AnimatedPlus size={13} className="text-amber-500" />
                <span className="hidden sm:inline">Assign Equipment</span>
              </Button>
            ) : undefined
          }
        >
          {filteredMachines.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <EmptyState
                title="No Machines Found"
                description={
                  user.role === "supervisor"
                    ? "No machinery currently under supervision for this user or their operators."
                    : "No machinery currently assigned to this user."
                }
              />
              {canManage && user.role === "operator" && (
                <div className="mt-3">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsAssignModalOpen(true)}
                    className="flex h-8 cursor-pointer items-center gap-1.5 px-3 text-xs"
                  >
                    <AnimatedPlus size={14} />
                    <span>Assign Equipment to Operator</span>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-lg border border-[var(--color-hairline)] lg:block">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="bg-[var(--color-hairline-soft-surface)]">
                    <tr className="text-[10px] uppercase tracking-[0.06em] text-[var(--color-mute)]">
                      <th className="whitespace-nowrap px-3 py-2.5 font-bold">Machine</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-bold">Name / Model</th>
                      {user.role === "supervisor" && (
                        <th className="whitespace-nowrap px-3 py-2.5 font-bold">Operator</th>
                      )}
                      <th className="whitespace-nowrap px-3 py-2.5 font-bold">Serial</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-bold">Manufacturer</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-bold">Hour Meter</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-bold">Status</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-bold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-hairline)]">
                    {filteredMachines.map((m) => (
                      <tr key={m.id} className="transition-colors hover:bg-[var(--color-hairline-soft-surface)]">
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] font-bold text-[var(--color-ink)]">
                          {m.machine_id}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-semibold text-[var(--color-ink)]">{m.machine_name}</div>
                          <div className="text-[10px] text-[var(--color-mute)]">{m.model}</div>
                        </td>
                        {user.role === "supervisor" && (
                          <td className="px-3 py-2.5">
                            {m.assigned_operator_name ? (
                              <div>
                                <div className="font-semibold text-[var(--color-ink)]">{m.assigned_operator_name}</div>
                                {m.assigned_operator_code && (
                                  <div className="font-mono text-[10px] text-[var(--color-mute)]">
                                    {m.assigned_operator_code}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[11px] italic text-[var(--color-faint)]">Unassigned</span>
                            )}
                          </td>
                        )}
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-[var(--color-mute)]">
                          {m.serial_number || "—"}
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-[var(--color-body)]">{m.manufacturer || "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-[11px] text-[var(--color-ink)]">
                          {m.hour_meter != null ? `${Number(m.hour_meter).toLocaleString("en-IN")} h` : "—"}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${
                              m.status === "active"
                                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                : "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-mute)]"
                            }`}
                          >
                            {m.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <Link
                            href={`/machines/${m.id}`}
                            className="inline-flex items-center gap-1 rounded-md border border-transparent px-1.5 py-1 text-[11px] font-semibold text-[var(--color-link)] transition-colors hover:border-[var(--color-hairline)] hover:bg-[var(--color-canvas-elevated)]"
                          >
                            <span>Inspect</span>
                            <ArrowUpRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tablet & mobile cards */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:hidden">
                {filteredMachines.map((m) => (
                  <Link
                    key={m.id}
                    href={`/machines/${m.id}`}
                    className="group flex flex-col gap-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3 transition-colors hover:border-[var(--color-link)]/40"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] font-bold text-[var(--color-ink)]">{m.machine_id}</p>
                        <p className="truncate text-xs font-semibold text-[var(--color-ink)]">
                          {m.machine_name}
                          <span className="font-normal text-[var(--color-mute)]"> · {m.model}</span>
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${
                          m.status === "active"
                            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-mute)]"
                        }`}
                      >
                        {m.status}
                      </span>
                    </div>

                    {user.role === "supervisor" && (
                      <p className="text-[11px] text-[var(--color-mute)]">
                        Operator:{" "}
                        <span className="font-semibold text-[var(--color-ink)]">
                          {m.assigned_operator_name || "Unassigned"}
                        </span>
                        {m.assigned_operator_code && (
                          <span className="ml-1 font-mono text-[10px]">({m.assigned_operator_code})</span>
                        )}
                      </p>
                    )}

                    <div className="mt-auto flex items-center justify-between border-t border-[var(--color-hairline)] pt-2 text-[10.5px] text-[var(--color-mute)]">
                      <span className="font-mono">
                        Meter {m.hour_meter != null ? `${Number(m.hour_meter).toLocaleString("en-IN")} h` : "—"}
                      </span>
                      <span className="inline-flex items-center gap-1 font-semibold text-[var(--color-link)]">
                        Inspect
                        <ArrowUpRight className="h-3 w-3" />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </Panel>
      )}

      {/* TAB: Supervised Operators (Supervisor Role Only) */}
      {activeTab === "operators" && user.role === "supervisor" && (
        <Panel
          icon={<Users className="h-3.5 w-3.5" />}
          tone="teal"
          title="Supervised Operators"
          subtitle={`${filteredOperators.length} of ${operators.length} operators`}
        >
          {filteredOperators.length === 0 ? (
            <div className="py-10 text-center">
              <EmptyState
                title="No Operators Assigned"
                description="No operators are currently assigned to report to this supervisor."
              />
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-lg border border-[var(--color-hairline)] lg:block">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="bg-[var(--color-hairline-soft-surface)]">
                    <tr className="text-[10px] uppercase tracking-[0.06em] text-[var(--color-mute)]">
                      <th className="whitespace-nowrap px-3 py-2.5 font-bold">Operator</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-bold">Contact</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-bold">Category</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-bold">Equipment</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-bold">Shift</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-bold">Status</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-bold">Profile</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-hairline)]">
                    {filteredOperators.map((op) => {
                      const cleanOpPhone = (op.phone || "").replace(/[^0-9+]/g, "");
                      const opWhatsappUrl = cleanOpPhone
                        ? `https://wa.me/${cleanOpPhone.replace("+", "")}?text=${encodeURIComponent(
                            `Hello ${op.full_name}, regarding operations under supervisor ${user.full_name}.`
                          )}`
                        : "";
                      const shiftStr =
                        op.shift_start_time && op.shift_end_time
                          ? `${formatShiftTime(op.shift_start_time)} – ${formatShiftTime(op.shift_end_time)}`
                          : "Standard";

                      return (
                        <tr key={op.id} className="transition-colors hover:bg-[var(--color-hairline-soft-surface)]">
                          <td className="px-3 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                                <span>{getInitials(op.full_name)}</span>
                              </div>
                              <div className="min-w-0">
                                <Link
                                  href={`/users/${op.employee_id || op.id}`}
                                  className="block truncate font-semibold text-[var(--color-ink)] transition-colors hover:text-[var(--color-link)]"
                                >
                                  {op.full_name}
                                </Link>
                                <div className="font-mono text-[10px] text-[var(--color-mute)]">
                                  {op.employee_id || `ID: ${op.id.slice(0, 8)}`}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="space-y-0.5">
                              {op.phone ? (
                                <div className="flex items-center gap-1.5 font-mono text-[11px] text-[var(--color-ink)]">
                                  <AnimatedPhone size={11} className="shrink-0 text-teal-500" />
                                  <a href={`tel:${cleanOpPhone}`} className="hover:underline">
                                    {op.phone}
                                  </a>
                                  {opWhatsappUrl && (
                                    <a
                                      href={opWhatsappUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="ml-0.5 text-emerald-600 hover:opacity-80 dark:text-emerald-400"
                                      title="WhatsApp chat"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[var(--color-mute)]">—</span>
                              )}
                              {op.email && (
                                <div className="flex max-w-[180px] items-center gap-1.5 truncate text-[10px] text-[var(--color-mute)]">
                                  <AnimatedMail size={11} className="shrink-0 text-sky-500" />
                                  <span className="truncate">{op.email}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            {op.machine_category ? (
                              <span className="inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:border-sky-800/80 dark:bg-sky-950/60 dark:text-sky-300">
                                {formatMachineCategoryLabel(op.machine_category)}
                              </span>
                            ) : (
                              <span className="text-[var(--color-mute)]">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {op.active_machine_code ? (
                              <div className="space-y-0.5">
                                <Link
                                  href={`/machines/${op.active_machine_id}`}
                                  className="block font-mono text-[11px] font-bold text-[var(--color-link)] hover:underline"
                                >
                                  {op.active_machine_code}
                                </Link>
                                <div className="max-w-[160px] truncate text-[10px] text-[var(--color-mute)]">
                                  {op.active_machine_name}
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-mute)]">
                                Unassigned
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-[var(--color-mute)]">{shiftStr}</td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${
                                op.status === "active"
                                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                  : "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-mute)]"
                              }`}
                            >
                              {op.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <Link
                              href={`/users/${op.employee_id || op.id}`}
                              className="inline-flex items-center gap-1 rounded-md border border-transparent px-1.5 py-1 text-[11px] font-semibold text-[var(--color-link)] transition-colors hover:border-[var(--color-hairline)] hover:bg-[var(--color-canvas-elevated)]"
                            >
                              <span>View</span>
                              <ChevronRight className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Tablet & mobile touch cards */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:hidden">
                {filteredOperators.map((op) => {
                  const cleanOpPhone = (op.phone || "").replace(/[^0-9+]/g, "");
                  const opWhatsappUrl = cleanOpPhone
                    ? `https://wa.me/${cleanOpPhone.replace("+", "")}?text=${encodeURIComponent(
                        `Hello ${op.full_name}, regarding operations under supervisor ${user.full_name}.`
                      )}`
                    : "";
                  const shiftStr =
                    op.shift_start_time && op.shift_end_time
                      ? `${formatShiftTime(op.shift_start_time)} – ${formatShiftTime(op.shift_end_time)}`
                      : "Standard";

                  return (
                    <div
                      key={op.id}
                      className="flex flex-col gap-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-xs font-bold text-amber-700 dark:text-amber-300">
                            <span>{getInitials(op.full_name)}</span>
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/users/${op.employee_id || op.id}`}
                              className="block truncate text-[13px] font-bold text-[var(--color-ink)] transition-colors hover:text-[var(--color-link)]"
                            >
                              {op.full_name}
                            </Link>
                            <span className="font-mono text-[10px] text-[var(--color-mute)]">
                              {op.employee_id || `ID: ${op.id.slice(0, 8)}`}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${
                            op.status === "active"
                              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : "border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-mute)]"
                          }`}
                        >
                          {op.status}
                        </span>
                      </div>

                      <div className="space-y-1.5 border-t border-[var(--color-hairline)] pt-2 text-[11px]">
                        {op.active_machine_code && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[var(--color-mute)]">Equipment</span>
                            <Link
                              href={`/machines/${op.active_machine_id}`}
                              className="truncate font-mono text-[11px] font-bold text-[var(--color-link)] hover:underline"
                            >
                              {op.active_machine_code} · {op.active_machine_name}
                            </Link>
                          </div>
                        )}
                        {op.machine_category && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[var(--color-mute)]">Category</span>
                            <span className="font-semibold text-[var(--color-ink)]">
                              {formatMachineCategoryLabel(op.machine_category)}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[var(--color-mute)]">Shift</span>
                          <span className="font-medium text-[var(--color-ink)]">{shiftStr}</span>
                        </div>
                      </div>

                      <div className="mt-auto flex items-center justify-between gap-2 border-t border-[var(--color-hairline)] pt-2">
                        <div className="flex items-center gap-1.5">
                          {cleanOpPhone && (
                            <a
                              href={`tel:${cleanOpPhone}`}
                              aria-label={`Call ${op.full_name}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-teal-600 transition-colors hover:bg-[var(--color-hairline-soft-surface)] dark:text-teal-400"
                            >
                              <AnimatedPhone size={13} />
                            </a>
                          )}
                          {opWhatsappUrl && (
                            <a
                              href={opWhatsappUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`WhatsApp ${op.full_name}`}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-emerald-600 transition-colors hover:bg-[var(--color-hairline-soft-surface)] dark:text-emerald-400"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>

                        <Link
                          href={`/users/${op.employee_id || op.id}`}
                          className="inline-flex items-center gap-1 rounded-lg bg-[var(--color-ink)] px-3 py-1.5 text-[11px] font-semibold text-[var(--color-canvas)] shadow-2xs transition-opacity hover:opacity-90"
                        >
                          <span>View profile</span>
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Panel>
      )}

      {/* TAB 2: Shift Running Logs */}
      {activeTab === "logs" && (
        <Panel
          icon={<AnimatedClock size={15} />}
          tone="emerald"
          title="Shift Running Logs"
          subtitle={`${filteredLogs.length} of ${runningLogs.length} recent logs`}
        >
          {filteredLogs.length === 0 ? (
            <div className="py-10 text-center">
              <EmptyState
                title="No Running Logs Found"
                description="No machine operating logs recorded for this user yet."
              />
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-hidden rounded-lg border border-[var(--color-hairline)] lg:block">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="bg-[var(--color-hairline-soft-surface)]">
                    <tr className="text-[10px] uppercase tracking-[0.06em] text-[var(--color-mute)]">
                      <th className="whitespace-nowrap px-3 py-2.5 font-bold">Date</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-bold">Machine</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-bold">Shift</th>
                      <th className="whitespace-nowrap px-3 py-2.5 font-bold">Meter</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-bold">Hours</th>
                      <th className="whitespace-nowrap px-3 py-2.5 text-right font-bold">OT</th>
                      <th className="px-3 py-2.5 font-bold">Location &amp; Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-hairline)]">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="transition-colors hover:bg-[var(--color-hairline-soft-surface)]">
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] font-semibold text-[var(--color-ink)]">
                          {log.log_date}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-mono text-[11px] font-bold text-[var(--color-ink)]">{log.machine_code}</span>
                          <span className="block max-w-[150px] truncate text-[10px] text-[var(--color-mute)]">
                            {log.machine_name}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-[11px] text-[var(--color-mute)]">
                          {log.start_time && log.end_time
                            ? `${formatShiftTime(log.start_time)} – ${formatShiftTime(log.end_time)}`
                            : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-[var(--color-body)]">
                          {log.start_meter != null && log.end_meter != null ? `${log.start_meter} → ${log.end_meter}` : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-[11px] font-bold text-[var(--color-ink)]">
                          {Number(log.running_hours || 0).toFixed(1)} h
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-[11px] text-amber-600 dark:text-amber-400">
                          {log.overtime_hours != null && log.overtime_hours > 0
                            ? `${Number(log.overtime_hours).toFixed(1)} h`
                            : "—"}
                        </td>
                        <td
                          className="max-w-[260px] truncate px-3 py-2.5 text-[11px] text-[var(--color-mute)]"
                          title={log.remarks || log.location || undefined}
                        >
                          {log.is_breakdown && (
                            <span className="mr-1.5 inline-flex items-center rounded border border-rose-500/25 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold text-rose-700 dark:text-rose-300">
                              Breakdown
                            </span>
                          )}
                          {log.location || log.remarks || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tablet & mobile cards */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:hidden">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-col gap-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] font-bold text-[var(--color-ink)]">{log.log_date}</p>
                        <p className="truncate text-xs font-semibold text-[var(--color-ink)]">
                          {log.machine_code}
                          <span className="font-normal text-[var(--color-mute)]"> · {log.machine_name}</span>
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                          {Number(log.running_hours || 0).toFixed(1)} h
                        </p>
                        {log.overtime_hours != null && log.overtime_hours > 0 && (
                          <p className="font-mono text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            +{Number(log.overtime_hours).toFixed(1)} OT
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-[var(--color-mute)]">
                      <span>
                        {log.start_time && log.end_time
                          ? `${formatShiftTime(log.start_time)} – ${formatShiftTime(log.end_time)}`
                          : "Standard shift"}
                      </span>
                      {log.start_meter != null && log.end_meter != null && (
                        <span className="font-mono">
                          {log.start_meter} → {log.end_meter}
                        </span>
                      )}
                      {log.is_breakdown && (
                        <span className="inline-flex items-center rounded border border-rose-500/25 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-bold text-rose-700 dark:text-rose-300">
                          Breakdown
                        </span>
                      )}
                    </div>

                    {log.remarks && (
                      <p className="mt-auto border-t border-[var(--color-hairline)] pt-2 text-[10.5px] italic text-[var(--color-mute)]">
                        {log.remarks}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>
      )}

      {/* TAB 3: Shift & Machine Assignments */}
      {activeTab === "assignments" && (
        <Panel
          icon={<AnimatedWrench size={15} />}
          tone="indigo"
          title="Machine Assignment History"
          subtitle={`${filteredAssignments.length} of ${assignments.length} assignments`}
          actions={
            canManage && user.role === "operator" ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsAssignModalOpen(true)}
                className="flex h-8 cursor-pointer items-center gap-1.5 px-2.5 text-xs shadow-2xs"
              >
                <AnimatedWrench size={13} className="text-indigo-500" />
                <span className="hidden sm:inline">Manage shifts &amp; equipment</span>
              </Button>
            ) : undefined
          }
        >
          {filteredAssignments.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <EmptyState
                title="No Assignments Found"
                description="No machine assignments registered for this user."
              />
              {canManage && user.role === "operator" && (
                <div className="mt-3">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsAssignModalOpen(true)}
                    className="flex h-8 cursor-pointer items-center gap-1.5 px-3 text-xs"
                  >
                    <AnimatedPlus size={14} />
                    <span>Assign Equipment to Operator</span>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {filteredAssignments.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5 transition-colors hover:border-[var(--color-link)]/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link
                        href={`/machines/${a.machine_id}`}
                        className="font-mono text-[11px] font-bold text-[var(--color-ink)] transition-colors hover:text-[var(--color-link)]"
                      >
                        {a.machine_code}
                      </Link>
                      <p className="truncate text-xs font-semibold text-[var(--color-ink)]">{a.machine_name}</p>
                      <p className="truncate text-[10px] text-[var(--color-mute)]">{a.model}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                        a.is_active
                          ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-mute)]"
                      }`}
                    >
                      {a.is_active ? "Active duty" : "Ended"}
                    </span>
                  </div>

                  <dl className="mt-auto divide-y divide-[var(--color-hairline)]/60 border-t border-[var(--color-hairline)] pt-1.5 text-[11px]">
                    <div className="flex items-center justify-between gap-2 py-1.5">
                      <dt className="text-[var(--color-mute)]">Shift</dt>
                      <dd className="flex items-center gap-1.5 text-right font-medium text-[var(--color-ink)]">
                        {a.shift_code && (
                          <span className="rounded border border-sky-500/25 bg-sky-500/10 px-1.5 py-px font-mono text-[10px] font-bold uppercase text-sky-700 dark:text-sky-300">
                            {a.shift_code}
                          </span>
                        )}
                        <span>
                          {a.shift_start_time && a.shift_end_time
                            ? `${formatShiftTime(a.shift_start_time)} – ${formatShiftTime(a.shift_end_time)}`
                            : "Standard day shift"}
                        </span>
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2 py-1.5">
                      <dt className="text-[var(--color-mute)]">Assigned</dt>
                      <dd className="font-mono text-[10.5px] font-medium text-[var(--color-ink)]">
                        {formatDate(a.assigned_at)}
                      </dd>
                    </div>
                    {a.ended_at && (
                      <div className="flex items-center justify-between gap-2 py-1.5">
                        <dt className="text-[var(--color-mute)]">Ended</dt>
                        <dd className="font-mono text-[10.5px] font-medium text-[var(--color-ink)]">
                          {formatDate(a.ended_at)}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* TAB 4: Attendance Overview & Deep Link (Operator Role Only) */}
      {activeTab === "attendance" && user.role === "operator" && (
        <Panel
          icon={<AnimatedCalendarClock size={15} />}
          tone="amber"
          title="Attendance & Timesheet"
          subtitle="Punch telemetry · worked hours · overtime"
          actions={
            <Link
              href={`/attendance/${user.id}?month=${currentMonthIST}`}
              className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-[var(--color-ink)] px-3 text-[11px] font-semibold text-[var(--color-canvas)] transition-opacity hover:opacity-90"
            >
              <span className="hidden sm:inline">Open full ledger</span>
              <span className="sm:hidden">Ledger</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          }
        >
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-[var(--color-hairline)] bg-[var(--color-hairline)] sm:grid-cols-3">
            <div className="bg-[var(--color-canvas)] p-3.5">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-mute)]">
                Work days
              </p>
              <p className="mt-2 font-mono text-xl font-bold leading-none text-[var(--color-ink)]">
                {kpis.totalDaysWorked}
              </p>
              <p className="mt-1.5 text-[10.5px] text-[var(--color-faint)]">From verified daily machine logs</p>
            </div>
            <div className="bg-[var(--color-canvas)] p-3.5">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-mute)]">
                Running time
              </p>
              <p className="mt-2 font-mono text-xl font-bold leading-none text-emerald-600 dark:text-emerald-400">
                {kpis.totalRunningHours} h
              </p>
              <p className="mt-1.5 text-[10.5px] text-[var(--color-faint)]">Cumulative operating duration</p>
            </div>
            <div className="bg-[var(--color-canvas)] p-3.5">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-mute)]">
                Shift window
              </p>
              <p className="mt-2 text-sm font-bold leading-tight text-[var(--color-ink)]">{shiftDisplay}</p>
              <p className="mt-1.5 text-[10.5px] text-[var(--color-faint)]">Standard operating window</p>
            </div>
          </div>
        </Panel>
      )}

      {/* TAB 5: KYC & Identity Documents */}
      {activeTab === "documents" && (
        <Panel
          icon={<AnimatedFileText size={15} />}
          tone="teal"
          title="Identity & KYC Documents"
          subtitle={`${docList.length} file${docList.length === 1 ? "" : "s"} · Aadhaar, licence, banking & compliance`}
          actions={
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                {docStats.verified} verified
              </span>
              {docStats.pending > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                  {docStats.pending} pending
                </span>
              )}
              {docStats.rejected > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                  {docStats.rejected} rejected
                </span>
              )}
            </div>
          }
          footer={
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5">
                <Shield className="h-3 w-3" />
                Complies with Aadhaar Act &amp; DPDP Act 2023
              </span>
              <span className="text-[var(--color-faint)]">Sensitive reveals are audit-logged</span>
            </div>
          }
        >
          {docList.length === 0 && missingTypedDocuments.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[var(--color-hairline)] py-10 text-center">
              <EmptyState
                title="No Identity Documents"
                description="No statutory identity or compliance documents have been uploaded for this profile yet."
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
              {docList.map((doc) => {
                const docType = documentTypes.find((t) => t.code === doc.document_type_code);
                const isVerified = doc.verification_status === "verified";
                const isRejected = doc.verification_status === "rejected";
                const isPending = !isVerified && !isRejected;
                const typed = getTypedValueForDoc(doc.document_type_code);
                const thumbUrl = doc.thumb_signed_url || doc.signed_url;
                const isPdf = (doc.mime_type || "").toLowerCase() === "application/pdf";
                const copyValue =
                  doc.document_type_code === "aadhaar"
                    ? user.aadhaar_number
                    : doc.document_type_code === "driving_license"
                      ? user.license_number
                      : doc.document_type_code === "bank_document"
                        ? user.bank_account_number
                        : null;
                const copyLabel =
                  doc.document_type_code === "aadhaar"
                    ? "Aadhaar"
                    : doc.document_type_code === "driving_license"
                      ? "Licence"
                      : "Bank Account";

                return (
                  <article
                    key={doc.id}
                    className="group flex flex-row gap-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3 transition-colors hover:border-[var(--color-link)]/40"
                  >
                    {/* Document thumbnail — click opens the full document viewer */}
                    <button
                      type="button"
                      onClick={() => handleViewDoc(doc)}
                      aria-label={`View full ${docType?.label || doc.document_type_code} document`}
                      className="relative h-24 w-20 shrink-0 overflow-hidden rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] cursor-zoom-in sm:h-28 sm:w-[88px]"
                    >
                      {isPdf ? (
                        <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-rose-600 dark:text-rose-400">
                          <FileText className="h-6 w-6" />
                          <span className="font-mono text-[8px] font-bold">PDF</span>
                        </span>
                      ) : thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={thumbUrl}
                          alt={docType?.label || "Document preview"}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                        />
                      ) : (
                        <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-sky-600 dark:text-sky-400">
                          <ImageIcon className="h-6 w-6" />
                          <span className="font-mono text-[8px] font-bold">IMG</span>
                        </span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 hidden items-center justify-center gap-1 bg-gradient-to-t from-black/75 to-transparent pb-1 pt-3 text-[9px] font-semibold text-white group-hover:flex">
                        <Maximize2 className="h-2.5 w-2.5" />
                        View
                      </span>
                    </button>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex flex-wrap items-start justify-between gap-2 sm:flex-nowrap">
                        <p
                          className="min-w-0 truncate text-[13px] font-bold text-[var(--color-ink)]"
                          title={docType?.label || doc.document_type_code}
                        >
                          {docType?.label || doc.document_type_code.replace(/_/g, " ").toUpperCase()}
                        </p>
                        <DocStatusPill status={doc.verification_status || "pending"} pendingApproval={doc.is_pending_request} />
                      </div>
                      <p className="mt-0.5 font-mono text-[10px] text-[var(--color-mute)]">
                        {(doc.mime_type.split("/")[1] || "").toUpperCase()} · {formatFileSize(doc.file_size_bytes)} ·{" "}
                        {formatDate(doc.created_at)}
                      </p>

                      {/* Registered number shown beside its own scan */}
                      {typed && (
                        <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] px-2.5 py-1.5">
                          <div className="min-w-0">
                            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--color-mute)]">
                              {typed.label}
                            </p>
                            <p className="truncate font-mono text-xs font-bold text-[var(--color-ink)]">{typed.value}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            {typed.revealable && (
                              <button
                                type="button"
                                onClick={() => toggleTypedReveal(doc.document_type_code)}
                                aria-label={
                                  (doc.document_type_code === "aadhaar" ? showFullAadhaar : showFullBankAccount)
                                    ? "Hide number"
                                    : "Reveal full number"
                                }
                                className="rounded p-1 text-[var(--color-mute)] transition-colors hover:bg-[var(--color-hairline)] hover:text-[var(--color-ink)] cursor-pointer"
                              >
                                {(doc.document_type_code === "aadhaar" ? showFullAadhaar : showFullBankAccount) ? (
                                  <AnimatedEyeOff size={13} />
                                ) : (
                                  <AnimatedEye size={13} />
                                )}
                              </button>
                            )}
                            {copyValue && (
                              <button
                                type="button"
                                onClick={() => handleCopy(copyValue, copyLabel)}
                                aria-label={`Copy ${copyLabel}`}
                                className="rounded p-1 text-[var(--color-mute)] transition-colors hover:bg-[var(--color-hairline)] hover:text-[var(--color-ink)] cursor-pointer"
                              >
                                {copiedKey === copyLabel ? (
                                  <AnimatedCheck size={13} className="text-emerald-500" />
                                ) : (
                                  <AnimatedCopy size={13} />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {isRejected && doc.rejection_reason && (
                        <p className="mt-2 rounded-md border border-rose-500/25 bg-rose-500/5 px-2.5 py-1.5 text-[10.5px] text-rose-700 dark:text-rose-300">
                          <span className="font-semibold">Rejected:</span> {doc.rejection_reason}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleViewDoc(doc)}
                          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] px-2.5 text-[11px] font-semibold text-[var(--color-ink)] shadow-2xs transition-colors hover:bg-[var(--color-hairline-soft-surface)] cursor-pointer"
                        >
                          <Maximize2 className="h-3 w-3 text-[var(--color-mute)]" />
                          View document
                        </button>
                        {isPending && canVerifyReject && (
                          <button
                            type="button"
                            onClick={() => router.push(`/approvals?type=document_verify`)}
                            className="inline-flex h-7 items-center gap-1 rounded-md bg-[var(--color-primary)] px-2.5 text-[11px] font-semibold text-white shadow-2xs transition-opacity hover:opacity-90 cursor-pointer"
                          >
                            Review in approvals
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        )}
                      </div>

                      {/* Replacement document awaiting review */}
                      {doc.pending_replacement && (
                        <div className="mt-2.5 space-y-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-amber-800 dark:text-amber-200">
                              <AnimatedClock size={12} className="text-amber-600 dark:text-amber-400" />
                              Replacement pending review
                            </span>
                            <span className="font-mono text-[9.5px] text-[var(--color-mute)]">
                              {formatDate(doc.pending_replacement.created_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveViewerDoc({
                                  id: doc.pending_replacement!.id,
                                  title: `${docType?.label || doc.document_type_code} (Replacement)`,
                                  url: doc.pending_replacement!.signed_url || "",
                                  mimeType: "image/jpeg",
                                });
                              }}
                              aria-label="Preview replacement document"
                              className="h-12 w-10 shrink-0 overflow-hidden rounded border border-amber-500/40 bg-[var(--color-canvas-elevated)] cursor-zoom-in"
                            >
                              {doc.pending_replacement.thumb_signed_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={doc.pending_replacement.thumb_signed_url}
                                  alt="Replacement preview"
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center text-amber-600">
                                  <ImageIcon className="h-4 w-4" />
                                </span>
                              )}
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[10.5px] font-semibold text-[var(--color-ink)]">
                                New scan uploaded by employee
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveViewerDoc({
                                      id: doc.pending_replacement!.id,
                                      title: `${docType?.label || doc.document_type_code} (Replacement)`,
                                      url: doc.pending_replacement!.signed_url || "",
                                      mimeType: "image/jpeg",
                                    });
                                  }}
                                  className="inline-flex h-6 items-center rounded border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] px-2 text-[10px] font-semibold text-[var(--color-ink)] cursor-pointer"
                                >
                                  Preview
                                </button>
                                {canVerifyReject && (
                                  <button
                                    type="button"
                                    onClick={() => router.push(`/approvals?type=document_replace`)}
                                    className="inline-flex h-6 items-center rounded bg-[var(--color-primary)] px-2 text-[10px] font-semibold text-white cursor-pointer"
                                  >
                                    Review
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}

              {/* Statutory numbers on record without a scanned file yet */}
              {missingTypedDocuments.map((item) => {
                const typed = getTypedValueForDoc(item.code);
                const copyValue =
                  item.code === "aadhaar"
                    ? user.aadhaar_number
                    : item.code === "driving_license"
                      ? user.license_number
                      : user.bank_account_number;
                const copyLabel = item.code === "aadhaar" ? "Aadhaar" : item.code === "driving_license" ? "Licence" : "Bank Account";
                const Icon =
                  item.code === "aadhaar" ? Fingerprint : item.code === "driving_license" ? IdCard : Banknote;

                return (
                  <article
                    key={item.code}
                    className="flex flex-row gap-3 rounded-lg border border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas)]/70 p-3"
                  >
                    <div className="flex h-24 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] text-[var(--color-faint)] sm:h-28 sm:w-[88px]">
                      <ImageIcon className="h-5 w-5" />
                      <span className="font-mono text-[8px] font-bold uppercase tracking-[0.08em]">No scan</span>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex flex-wrap items-start justify-between gap-2 sm:flex-nowrap">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--color-mute)]" />
                          <p className="truncate text-[13px] font-bold text-[var(--color-ink)]">{item.label}</p>
                        </div>
                        <span className="rounded-full border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] px-2 py-0.5 text-[10px] font-bold text-[var(--color-mute)]">
                          Not uploaded
                        </span>
                      </div>
                      <p className="mt-0.5 text-[10px] text-[var(--color-mute)]">{item.hint}</p>

                      {typed && (
                        <div className="mt-2 flex items-center justify-between gap-2 rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] px-2.5 py-1.5">
                          <div className="min-w-0">
                            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--color-mute)]">
                              {typed.label}
                            </p>
                            <p className="truncate font-mono text-xs font-bold text-[var(--color-ink)]">{typed.value}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-0.5">
                            {typed.revealable && (
                              <button
                                type="button"
                                onClick={() => toggleTypedReveal(item.code)}
                                aria-label="Reveal full number"
                                className="rounded p-1 text-[var(--color-mute)] transition-colors hover:bg-[var(--color-hairline)] hover:text-[var(--color-ink)] cursor-pointer"
                              >
                                {(item.code === "aadhaar" ? showFullAadhaar : showFullBankAccount) ? (
                                  <AnimatedEyeOff size={13} />
                                ) : (
                                  <AnimatedEye size={13} />
                                )}
                              </button>
                            )}
                            {copyValue && (
                              <button
                                type="button"
                                onClick={() => handleCopy(copyValue, copyLabel)}
                                aria-label={`Copy ${copyLabel}`}
                                className="rounded p-1 text-[var(--color-mute)] transition-colors hover:bg-[var(--color-hairline)] hover:text-[var(--color-ink)] cursor-pointer"
                              >
                                {copiedKey === copyLabel ? (
                                  <AnimatedCheck size={13} className="text-emerald-500" />
                                ) : (
                                  <AnimatedCopy size={13} />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      <p className="mt-auto pt-2 text-[10.5px] text-[var(--color-faint)]">
                        Ask the employee to upload a clear scan to complete verification.
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Panel>
      )}

      {/* TAB 6: Security Audit Trail */}
      {activeTab === "audit" && (
        <Panel
          icon={<AnimatedShieldCheck size={15} />}
          tone="violet"
          title="Account Activity & Audit Trail"
          subtitle={`${filteredAuditLogs.length} of ${auditLogs.length} recorded events`}
          actions={
            <span className="hidden items-center gap-1.5 rounded-full border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-2.5 py-0.5 text-[10px] font-semibold text-[var(--color-mute)] sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
              Immutable log
            </span>
          }
        >
          {filteredAuditLogs.length === 0 ? (
            <div className="py-10 text-center">
              <EmptyState
                title="No Audit Records"
                description="No recorded audit changes for this account yet."
              />
            </div>
          ) : (
            <>
              <ol className="relative space-y-1.5">
                {filteredAuditLogs.slice(0, auditVisibleCount).map((log, index, list) => {
                  const isLast = index === list.length - 1;
                  const expanded = expandedAuditId === log.id;
                  const severity = (log.severity || "info") as "info" | "warning" | "critical";
                  const glyphTone =
                    severity === "critical"
                      ? "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-300"
                      : severity === "warning"
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300"
                        : "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-mute)]";
                  const hasDetails =
                    log.details && typeof log.details === "object" && Object.keys(log.details as object).length > 0;

                  return (
                    <li key={log.id} className="relative flex gap-2.5">
                      {/* Timeline rail */}
                      <div className="relative flex w-6 shrink-0 flex-col items-center">
                        <span
                          className={`z-10 flex h-6 w-6 items-center justify-center rounded-full border shadow-2xs ${glyphTone}`}
                        >
                          <AuditCategoryGlyph category={log.category} />
                        </span>
                        {!isLast && <span className="absolute top-6 h-full w-px bg-[var(--color-hairline)]" />}
                      </div>

                      <div className="min-w-0 flex-1 rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-2.5 py-1.5 transition-colors hover:border-[var(--color-link)]/30">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                            <p className="truncate text-[11.5px] font-semibold text-[var(--color-ink)]">
                              {humanizeAction(log.action)}
                            </p>
                            {log.category && (
                              <span className="rounded border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] px-1.5 py-px font-mono text-[9px] font-bold uppercase tracking-[0.06em] text-[var(--color-mute)]">
                                {log.category}
                              </span>
                            )}
                            {severity !== "info" && (
                              <span
                                className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-px text-[9px] font-bold uppercase ${
                                  severity === "critical"
                                    ? "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                                    : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                }`}
                              >
                                <AlertTriangle className="h-2.5 w-2.5" />
                                {severity}
                              </span>
                            )}
                          </div>
                          <span
                            className="shrink-0 font-mono text-[9.5px] text-[var(--color-mute)]"
                            title={formatDate(log.created_at)}
                          >
                            {formatTimeAgo(log.created_at)}
                          </span>
                        </div>

                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-[var(--color-mute)]">
                          <span className="inline-flex items-center gap-1">
                            <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--color-hairline)] text-[7px] font-bold text-[var(--color-body)]">
                              {getInitials(log.actor_name || "System")}
                            </span>
                            <span className="font-medium text-[var(--color-body)]">{log.actor_name || "System"}</span>
                          </span>
                          <span className="text-[var(--color-faint)]">·</span>
                          <span className="capitalize">{log.actor_role || "automated"}</span>
                          <span className="hidden text-[var(--color-faint)] sm:inline">·</span>
                          <span className="hidden font-mono sm:inline">{formatDate(log.created_at)}</span>
                          {hasDetails && (
                            <button
                              type="button"
                              onClick={() => setExpandedAuditId(expanded ? null : log.id)}
                              aria-expanded={expanded}
                              className="ml-auto inline-flex items-center gap-0.5 rounded text-[9.5px] font-semibold text-[var(--color-link)] transition-opacity hover:opacity-80 cursor-pointer"
                            >
                              {expanded ? "Hide" : "Details"}
                              <ChevronRight
                                className={`h-2.5 w-2.5 transition-transform ${expanded ? "rotate-90" : ""}`}
                              />
                            </button>
                          )}
                        </div>

                        {expanded && hasDetails && (
                          <dl className="mt-1.5 grid grid-cols-1 gap-px overflow-hidden rounded border border-[var(--color-hairline)] bg-[var(--color-hairline)] sm:grid-cols-2">
                            {Object.entries(log.details as Record<string, unknown>)
                              .slice(0, 12)
                              .map(([key, value]) => (
                                <div
                                  key={key}
                                  className="flex min-w-0 items-baseline justify-between gap-2 bg-[var(--color-canvas-elevated)] px-2 py-1"
                                >
                                  <dt className="shrink-0 font-mono text-[9px] uppercase tracking-[0.06em] text-[var(--color-mute)]">
                                    {humanizeAction(key)}
                                  </dt>
                                  <dd className="min-w-0 break-words text-right font-mono text-[9.5px] text-[var(--color-ink)]">
                                    {formatAuditValue(value)}
                                  </dd>
                                </div>
                              ))}
                          </dl>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>

              {filteredAuditLogs.length > auditVisibleCount && (
                <div className="mt-3 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => setAuditVisibleCount((prev) => prev + 15)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-[11px] font-semibold text-[var(--color-ink)] shadow-2xs transition-colors hover:bg-[var(--color-hairline-soft-surface)] cursor-pointer"
                  >
                    Show {Math.min(15, filteredAuditLogs.length - auditVisibleCount)} more
                    <ChevronRight className="h-3 w-3 rotate-90" />
                  </button>
                </div>
              )}
            </>
          )}
        </Panel>
      )}

      {/* ─── 7. MODALS & DIALOGS ─── */}

      {/* User Edit Modal */}
      {isEditModalOpen && (
        <UserEditModal
          user={user}
          isSuperAdmin={isSuperAdmin}
          onClose={() => setIsEditModalOpen(false)}
          loading={isEditSubmitting}
          onSubmit={handleEditSubmit}
          supervisors={supervisors}
        />
      )}

      {/* In-App KYC Document Viewer Modal */}
      <DocumentViewerModal
        document={activeViewerDoc}
        onClose={() => setActiveViewerDoc(null)}
      />

      {/* Document Rejection Reason Dialog */}
      {rejectModalDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-5 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-[var(--color-ink)]">
                Reject {rejectModalDoc.document_type_code.replace(/_/g, " ").toUpperCase()} Document
              </h3>
              <p className="text-xs text-[var(--color-mute)] mt-1">
                Please state the specific reason why this document is being rejected (e.g., blurry image, mismatched name, expired document). The user will be notified to upload a replacement.
              </p>
            </div>

            <textarea
              value={rejectionReasonInput}
              onChange={(e) => setRejectionReasonInput(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={3}
              className="w-full rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-2.5 text-xs text-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ink)]"
            />

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRejectModalDoc(null)}
                className="cursor-pointer"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!rejectionReasonInput.trim() || rejectingDocId === rejectModalDoc.id}
                onClick={handleConfirmRejectDoc}
                className="bg-rose-600 hover:bg-rose-700 text-white border-0 cursor-pointer"
              >
                {rejectingDocId === rejectModalDoc.id ? "Rejecting..." : "Confirm Rejection"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmResetOpen}
        onClose={() => setConfirmResetOpen(false)}
        title="Reset User Password"
        description={`Are you sure you want to reset the password for ${user.full_name}? A temporary password will be generated and issued.`}
        confirmLabel="Confirm Reset"
        cancelLabel="Cancel"
        onConfirm={handleExecuteResetPassword}
        variant="warning"
        loading={actionLoading}
      />

      {/* Password Reset Result Modal */}
      {resetPasswordResult && (
        <PasswordResetModal
          open={!!resetPasswordResult}
          onClose={() => setResetPasswordResult(null)}
          userName={resetPasswordResult.userName}
          temporaryPassword={resetPasswordResult.temporaryPassword}
        />
      )}

      {/* Toggle Status Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmToggleOpen}
        onClose={() => setConfirmToggleOpen(false)}
        title={user.status === "active" ? "Deactivate User Account" : "Activate User Account"}
        description={
          user.status === "active"
            ? `Are you sure you want to deactivate ${user.full_name}? The user will immediately lose access to the system and cannot log in. Any active machinery assignments will be ended to prevent scheduling conflicts, but all historical shift logs, attendance records, and data will remain preserved.`
            : `Are you sure you want to activate ${user.full_name}? The user will regain system login access, be able to operate machinery, and be eligible for shift assignments.`
        }
        confirmLabel={user.status === "active" ? "Yes, Deactivate" : "Yes, Activate"}
        cancelLabel="Cancel"
        onConfirm={handleExecuteToggleStatus}
        variant={user.status === "active" ? "warning" : "info"}
        loading={actionLoading}
      />

      {/* Delete User Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="Permanently Delete User Account"
        description={`Are you completely sure you want to delete ${user.full_name} (${user.employee_id || user.id})? This action is irreversible.`}
        confirmLabel="Yes, Delete Permanently"
        cancelLabel="Cancel"
        onConfirm={handleExecuteDelete}
        variant="danger"
        loading={actionLoading}
      />

      {/* Operator Shift & Equipment Assignment Modal */}
      {isAssignModalOpen && (
        <AssignPersonnelModal
          isOpen={isAssignModalOpen}
          onClose={() => setIsAssignModalOpen(false)}
          operator={user as any}
          operatorId={user.id}
          userRole={currentUser.role}
          onSuccess={handleRefreshUserData}
        />
      )}
    </div>
  );
}
