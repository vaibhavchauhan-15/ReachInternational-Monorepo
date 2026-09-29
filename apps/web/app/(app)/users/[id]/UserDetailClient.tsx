"use client";

import React, { useState, useMemo, useCallback } from "react";
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
  RotateCcw,
} from "lucide-react";
import {
  AnimatedUser,
  AnimatedTruck,
  AnimatedClock,
  AnimatedShieldCheck,
  AnimatedMapPin,
  AnimatedCreditCard,
  AnimatedFileText,
  AnimatedChevronLeft,
  AnimatedCopy,
  AnimatedCheck,
  AnimatedEdit,
  AnimatedMail,
  AnimatedPhone,
  AnimatedKey,
  AnimatedPower,
  AnimatedTrash2,
  AnimatedCalendarClock,
  AnimatedBuilding2,
  AnimatedEye,
  AnimatedEyeOff,
  AnimatedSearch,
  AnimatedWrench,
  AnimatedPlus,
} from "@/components/ui/animated-icons";
import { Button, TooltipWrapper, EmptyState, useToast, ConfirmationDialog } from "@/components/ui";
import { DocumentViewerModal, type ViewerDocument } from "@/components/documents/DocumentViewerModal";
import { UserEditModal } from "../UserEditModal";
import { AssignPersonnelModal } from "@/components/machines/AssignPersonnelModal";
import {
  formatDate,
  formatTimeAgo,
  maskAadhaar,
  formatLicenseNumber,
} from "@reachinternational/utils";
import {
  toggleUserStatus,
  resetUserPassword,
  deleteUser,
  editUser,
  getUserDetailAction,
} from "@/app/actions/users";
import { getDocumentViewUrlAction, type UserDocument, type DocumentType } from "@/app/actions/documents";
import type { User, UserRole } from "@/lib/types/database";
import type {
  UserMachineItem,
  UserRunningLogItem,
  UserAssignmentItem,
  UserAuditItem,
  UserSummaryKPIs,
} from "@/lib/data/users";

export type UserDetailTabKey = "machines" | "logs" | "assignments" | "attendance" | "documents" | "audit";

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
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserDetailClient({
  user: initialUser,
  currentUser,
  isSuperAdmin,
  canManage,
  kpis,
  machines,
  runningLogs,
  assignments,
  auditLogs,
  documents,
  documentTypes,
  supervisors = [],
}: UserDetailClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [user, setUser] = useState<User>(initialUser);
  const [activeTab, setActiveTab] = useState<UserDetailTabKey>("machines");
  const [tabSearch, setTabSearch] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showFullAadhaar, setShowFullAadhaar] = useState(false);

  // Modals & Action States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [activeViewerDoc, setActiveViewerDoc] = useState<ViewerDocument | null>(null);

  // Confirmation dialogs
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmToggleOpen, setConfirmToggleOpen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

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

  // Filtered in-tab items
  const filteredMachines = useMemo(() => {
    if (!tabSearch.trim()) return machines;
    const q = tabSearch.toLowerCase().trim();
    return machines.filter(
      (m) =>
        m.machine_id.toLowerCase().includes(q) ||
        m.machine_name.toLowerCase().includes(q) ||
        m.model.toLowerCase().includes(q) ||
        (m.serial_number && m.serial_number.toLowerCase().includes(q))
    );
  }, [machines, tabSearch]);

  const filteredLogs = useMemo(() => {
    if (!tabSearch.trim()) return runningLogs;
    const q = tabSearch.toLowerCase().trim();
    return runningLogs.filter(
      (l) =>
        l.machine_code.toLowerCase().includes(q) ||
        l.machine_name.toLowerCase().includes(q) ||
        l.log_date.includes(q) ||
        (l.location && l.location.toLowerCase().includes(q)) ||
        (l.remarks && l.remarks.toLowerCase().includes(q))
    );
  }, [runningLogs, tabSearch]);

  const filteredAssignments = useMemo(() => {
    if (!tabSearch.trim()) return assignments;
    const q = tabSearch.toLowerCase().trim();
    return assignments.filter(
      (a) =>
        a.machine_code.toLowerCase().includes(q) ||
        a.machine_name.toLowerCase().includes(q) ||
        a.model.toLowerCase().includes(q)
    );
  }, [assignments, tabSearch]);

  const filteredAuditLogs = useMemo(() => {
    if (!tabSearch.trim()) return auditLogs;
    const q = tabSearch.toLowerCase().trim();
    return auditLogs.filter(
      (a) =>
        a.action.toLowerCase().includes(q) ||
        (a.actor_name && a.actor_name.toLowerCase().includes(q)) ||
        (a.actor_role && a.actor_role.toLowerCase().includes(q)) ||
        (a.category && a.category.toLowerCase().includes(q))
    );
  }, [auditLogs, tabSearch]);

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
      if (!res.formState.error) {
        toast("success", `Password reset successfully. New password: ${res.newPassword || "Sent via notification"}`);
      } else {
        toast("error", res.formState.error || "Failed to reset password");
      }
    } catch (err: any) {
      toast("error", err?.message || "Error resetting password");
    } finally {
      setActionLoading(false);
      setConfirmResetOpen(false);
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

  const cleanPhone = (user.phone || "").replace(/[^0-9+]/g, "");
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone.replace("+", "")}?text=${encodeURIComponent(
        `Hello ${user.full_name}, ReachInternational regarding your profile ${user.employee_id || ""}.`
      )}`
    : "";

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

  return (
    <div className="flex flex-col gap-4 sm:gap-6 pb-20 md:pb-8 max-w-7xl mx-auto px-2 sm:px-4 md:px-6 w-full">
      {/* ─── 1. TOP BREADCRUMB & BACK NAVIGATION ─── */}
      <div className="flex items-center justify-between">
        <Link
          href="/users"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors group py-1"
        >
          <motion.div whileTap={{ scale: 0.9 }} className="flex items-center gap-1">
            <AnimatedChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            <span>Back to Users</span>
          </motion.div>
        </Link>

        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--color-mute)]">
          <Link href="/dashboard" className="hover:text-[var(--color-ink)] transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link href="/users" className="hover:text-[var(--color-ink)] transition-colors">
            Users
          </Link>
          <span>/</span>
          <span className="text-[var(--color-ink)] font-semibold truncate max-w-[240px]">
            {user.full_name}
          </span>
        </nav>
      </div>

      {/* ─── 2. MASTER HERO BANNER CARD ─── */}
      <div className="rounded-xl sm:rounded-2xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 sm:p-5 md:p-6 shadow-2xs relative overflow-hidden">
        {/* Subtle top hairline gradient accent */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-sky-500/50 to-transparent pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          {/* Left: Avatar + Title & Identifiers */}
          <div className="flex items-start sm:items-center gap-3.5 min-w-0">
            <div
              className={`flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${getRoleAvatarStyle(
                user.role
              )} font-bold text-base sm:text-lg border shadow-xs select-none`}
            >
              <span>{getInitials(user.full_name)}</span>
            </div>

            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                {/* Monospace EMP-xxxx Badge with 1-click copy */}
                <button
                  type="button"
                  onClick={() => handleCopy(user.employee_id || user.id, "Employee ID")}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md font-mono text-xs font-bold bg-[var(--color-canvas)] text-[var(--color-ink)] border border-[var(--color-hairline)] hover:border-[var(--color-link)]/60 hover:bg-[var(--color-hairline-soft-surface)] transition-all cursor-pointer shadow-2xs"
                  title="Click to copy Employee ID"
                >
                  <span>{user.employee_id || `ID: ${user.id.slice(0, 8)}`}</span>
                  {copiedKey === "Employee ID" ? (
                    <AnimatedCheck size={12} className="text-emerald-500 shrink-0" />
                  ) : (
                    <AnimatedCopy size={12} className="text-[var(--color-mute)] shrink-0" />
                  )}
                </button>

                {getRoleBadge(user.role)}

                {/* Status Badge */}
                {user.status === "active" ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300/80 dark:border-emerald-800/80 shadow-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 shadow-xs capitalize">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                    {user.status}
                  </span>
                )}
              </div>

              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-[var(--color-ink)] truncate leading-tight">
                {user.full_name}
              </h1>

              {user.location && (
                <div className="flex items-center gap-1 text-xs text-[var(--color-mute)]">
                  <AnimatedMapPin size={12} className="text-sky-500" />
                  <span>{user.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
            {canManage && (
              <Button
                variant="primary"
                onClick={() => setIsEditModalOpen(true)}
                className="h-9 px-3.5 text-xs font-semibold rounded-md shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <AnimatedEdit size={14} className="shrink-0" />
                <span>Edit Profile</span>
              </Button>
            )}

            {canManage && user.role === "operator" && (
              <Button
                variant="secondary"
                onClick={() => setIsAssignModalOpen(true)}
                className="h-9 px-3 text-xs font-semibold rounded-md shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <AnimatedWrench size={14} className="shrink-0 text-amber-500" />
                <span>Assign Equipment</span>
              </Button>
            )}

            {user.phone && (
              <a
                href={`tel:${cleanPhone}`}
                className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors shadow-2xs"
                title="Call phone"
              >
                <AnimatedPhone size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">Call</span>
              </a>
            )}

            {user.email && (
              <a
                href={`mailto:${user.email}`}
                className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors shadow-2xs"
                title="Send email"
              >
                <AnimatedMail size={14} className="text-sky-600 dark:text-sky-400" />
                <span className="hidden sm:inline">Email</span>
              </a>
            )}

            {canManage && (
              <Button
                variant="outline"
                onClick={() => setConfirmResetOpen(true)}
                className="h-9 px-3 text-xs font-medium rounded-md border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] cursor-pointer"
                title="Reset password"
              >
                <AnimatedKey size={14} className="text-amber-500" />
                <span className="hidden md:inline">Reset Pass</span>
              </Button>
            )}

            {canManage && user.id !== currentUser.id && (
              <Button
                variant="outline"
                onClick={() => setConfirmToggleOpen(true)}
                className="h-9 px-3 text-xs font-medium rounded-md border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] cursor-pointer"
                title={user.status === "active" ? "Deactivate account" : "Activate account"}
              >
                <AnimatedPower size={14} className={user.status === "active" ? "text-amber-600" : "text-emerald-600"} />
                <span className="hidden md:inline">{user.status === "active" ? "Deactivate" : "Activate"}</span>
              </Button>
            )}

            {isSuperAdmin && user.id !== currentUser.id && (
              <Button
                variant="outline"
                onClick={() => setConfirmDeleteOpen(true)}
                className="h-9 px-3 text-xs font-medium rounded-md border-red-200 dark:border-red-900/40 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer"
                title="Delete user account"
              >
                <AnimatedTrash2 size={14} className="text-red-600" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ─── 3. 4-CARD HIGH-DENSITY METADATA GRID ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Contact Information */}
        <div
          data-hover-parent
          className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 shadow-2xs space-y-2.5 transition-all hover:border-[var(--color-link)]/40 hover:shadow-xs group"
        >
          <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)] flex items-center gap-1.5">
              <AnimatedMail size={16} className="text-sky-500 shrink-0" />
              Contact Information
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[var(--color-mute)]">Email</span>
              <div className="flex items-center gap-1 min-w-0">
                <span className="font-semibold text-[var(--color-ink)] truncate max-w-[160px]" title={user.email}>
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(user.email, "Email")}
                  className="p-1 hover:bg-[var(--color-hairline)] rounded text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                  title="Copy email"
                >
                  {copiedKey === "Email" ? (
                    <AnimatedCheck size={12} className="text-emerald-500" />
                  ) : (
                    <AnimatedCopy size={12} />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[var(--color-mute)]">Phone</span>
              <div className="flex items-center gap-1">
                <span className="font-semibold font-mono text-[var(--color-ink)]">
                  {user.phone || "—"}
                </span>
                {user.phone && (
                  <button
                    type="button"
                    onClick={() => handleCopy(user.phone!, "Phone")}
                    className="p-1 hover:bg-[var(--color-hairline)] rounded text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                    title="Copy phone"
                  >
                    {copiedKey === "Phone" ? (
                      <AnimatedCheck size={12} className="text-emerald-500" />
                    ) : (
                      <AnimatedCopy size={12} />
                    )}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-1.5 pt-0.5">
              <span className="text-[var(--color-mute)]">WhatsApp</span>
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  <span>Chat Direct</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-[var(--color-mute)]">—</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Employment & Designation */}
        <div
          data-hover-parent
          className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 shadow-2xs space-y-2.5 transition-all hover:border-[var(--color-link)]/40 hover:shadow-xs group"
        >
          <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)] flex items-center gap-1.5">
              <AnimatedUser size={16} className="text-teal-500 shrink-0" />
              Employment Details
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-mute)]">Employee ID</span>
              <span className="font-semibold font-mono text-[var(--color-ink)]">
                {user.employee_id || `EMP-${user.id.slice(0, 4).toUpperCase()}`}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[var(--color-mute)]">Joining Date</span>
              <span className="font-semibold text-[var(--color-ink)]">
                {user.doj ? formatDate(user.doj) : formatDate(user.created_at)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-1">
              <span className="text-[var(--color-mute)]">Supervisor</span>
              <span className="font-semibold text-[var(--color-ink)] truncate max-w-[160px]" title={assignedSupervisors.map((s) => s.full_name).join(", ")}>
                {assignedSupervisors.length > 0
                  ? assignedSupervisors.map((s) => s.full_name).join(", ")
                  : "Unassigned"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Shift & Compensation */}
        <div
          data-hover-parent
          className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 shadow-2xs space-y-2.5 transition-all hover:border-[var(--color-link)]/40 hover:shadow-xs group"
        >
          <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)] flex items-center gap-1.5">
              <AnimatedClock size={16} className="text-amber-500 shrink-0" />
              Shift & Compensation
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-mute)]">Shift Hours</span>
              <span className="font-semibold text-[var(--color-ink)] text-right">
                {shiftDisplay}
              </span>
            </div>

            {canManage && user.monthly_salary != null && Number(user.monthly_salary) > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-mute)]">Monthly Salary</span>
                <span className="font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                  ₹{Number(user.monthly_salary).toLocaleString("en-IN")} / mo
                </span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-[var(--color-mute)]">PL Leave Quota</span>
              <span className="font-semibold text-[var(--color-ink)]">
                {user.total_pl_quota != null ? `${user.total_pl_quota - (user.pl_used_as_on_date || 0)} / ${user.total_pl_quota} days` : "12 days"}
              </span>
            </div>
          </div>
        </div>

        {/* Card 4: Location & Address */}
        <div
          data-hover-parent
          className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 shadow-2xs space-y-2.5 transition-all hover:border-[var(--color-link)]/40 hover:shadow-xs group"
        >
          <div className="flex items-center justify-between pb-1.5 sm:pb-2 border-b border-[var(--color-hairline)]/60">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)] flex items-center gap-1.5">
              <AnimatedMapPin size={16} className="text-rose-500 shrink-0" />
              Location & Address
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-mute)]">City / District</span>
              <span className="font-semibold text-[var(--color-ink)] truncate max-w-[150px]">
                {user.city && user.district ? `${user.city}, ${user.district}` : user.city || user.district || "—"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[var(--color-mute)]">State</span>
              <span className="font-semibold text-[var(--color-ink)]">
                {user.state || "—"}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-[var(--color-mute)]">Street</span>
              <span className="font-semibold text-[var(--color-ink)] truncate max-w-[150px]" title={user.street || user.address || undefined}>
                {user.street || user.address || "—"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 4. 4-CARD KPI METRICS STRIP ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Assigned Fleet Machinery */}
        <div
          data-hover-parent
          className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 shadow-2xs space-y-1.5 transition-all hover:border-[var(--color-link)]/40 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
              Assigned Fleet
            </span>
            <AnimatedTruck size={16} className="text-sky-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[var(--color-ink)]">
            {kpis.assignedMachinesCount}
          </div>
          <div className="text-[11px] text-[var(--color-mute)]">
            {kpis.assignedMachinesCount === 1 ? "1 active machine unit" : `${kpis.assignedMachinesCount} active machine units`}
          </div>
        </div>

        {/* Metric 2: Total Shift Running Hours */}
        <div
          data-hover-parent
          className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 shadow-2xs space-y-1.5 transition-all hover:border-[var(--color-link)]/40 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
              Running Hours
            </span>
            <AnimatedClock size={16} className="text-emerald-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[var(--color-ink)]">
            {kpis.totalRunningHours.toFixed(1)} <span className="text-xs font-normal font-sans text-[var(--color-mute)]">hrs</span>
          </div>
          <div className="text-[11px] text-[var(--color-mute)]">
            Logged across active duty shifts
          </div>
        </div>

        {/* Metric 3: Total Work Days Logged */}
        <div
          data-hover-parent
          className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 shadow-2xs space-y-1.5 transition-all hover:border-[var(--color-link)]/40 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
              Work Days
            </span>
            <AnimatedCalendarClock size={16} className="text-amber-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[var(--color-ink)]">
            {kpis.totalDaysWorked} <span className="text-xs font-normal font-sans text-[var(--color-mute)]">days</span>
          </div>
          <div className="text-[11px] text-[var(--color-mute)]">
            Distinct operational shift logs
          </div>
        </div>

        {/* Metric 4: Verified KYC Documents */}
        <div
          data-hover-parent
          className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-3.5 sm:p-4 shadow-2xs space-y-1.5 transition-all hover:border-[var(--color-link)]/40 group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
              KYC Documents
            </span>
            <AnimatedFileText size={16} className="text-teal-500 shrink-0" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-[var(--color-ink)]">
            {kpis.documentsCount} <span className="text-xs font-normal font-sans text-[var(--color-mute)]">files</span>
          </div>
          <div className="text-[11px] text-[var(--color-mute)]">
            Aadhaar, Licence & records
          </div>
        </div>
      </div>

      {/* ─── 5. TAB STRIP & SEARCH TOOLBAR ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--color-hairline)] pb-3">
        {/* Scrollable Tab Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar flex-nowrap pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab("machines")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "machines"
                ? "bg-[var(--color-ink)] text-[var(--color-on-primary)] shadow-xs"
                : "bg-[var(--color-canvas)] text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
            }`}
          >
            Machines ({machines.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("logs")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "logs"
                ? "bg-[var(--color-ink)] text-[var(--color-on-primary)] shadow-xs"
                : "bg-[var(--color-canvas)] text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
            }`}
          >
            Running Logs ({runningLogs.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("assignments")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "assignments"
                ? "bg-[var(--color-ink)] text-[var(--color-on-primary)] shadow-xs"
                : "bg-[var(--color-canvas)] text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
            }`}
          >
            Assignments ({assignments.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("attendance")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "attendance"
                ? "bg-[var(--color-ink)] text-[var(--color-on-primary)] shadow-xs"
                : "bg-[var(--color-canvas)] text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
            }`}
          >
            Attendance
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("documents")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "documents"
                ? "bg-[var(--color-ink)] text-[var(--color-on-primary)] shadow-xs"
                : "bg-[var(--color-canvas)] text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
            }`}
          >
            KYC & Documents ({documents.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              activeTab === "audit"
                ? "bg-[var(--color-ink)] text-[var(--color-on-primary)] shadow-xs"
                : "bg-[var(--color-canvas)] text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)]"
            }`}
          >
            Audit Trail ({auditLogs.length})
          </button>
        </div>

        {/* In-Tab Search Input */}
        {activeTab !== "attendance" && (
          <div className="relative w-full sm:w-64 shrink-0">
            <input
              type="text"
              value={tabSearch}
              onChange={(e) => setTabSearch(e.target.value)}
              placeholder={`Search in ${activeTab}...`}
              className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] placeholder-[var(--color-mute)] focus:outline-hidden focus:border-[var(--color-link)] transition-colors"
            />
            <div className="absolute left-2.5 top-2 text-[var(--color-mute)] pointer-events-none">
              <AnimatedSearch size={14} />
            </div>
            {tabSearch && (
              <button
                type="button"
                onClick={() => setTabSearch("")}
                className="absolute right-2.5 top-2 text-[var(--color-mute)] hover:text-[var(--color-ink)] text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── 6. TAB CONTENT PANELS ─── */}

      {/* TAB 1: Assigned Machinery Fleet */}
      {activeTab === "machines" && (
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedTruck size={16} className="text-sky-500" />
              <span>Assigned Machinery Fleet</span>
            </h3>
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-[var(--color-mute)]">
                Showing {filteredMachines.length} of {machines.length} machines
              </span>
              {canManage && user.role === "operator" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsAssignModalOpen(true)}
                  className="h-7 text-xs px-2.5 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <AnimatedPlus size={13} className="text-amber-500" />
                  <span>Assign Equipment</span>
                </Button>
              )}
            </div>
          </div>

          {filteredMachines.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center">
              <EmptyState
                title="No Machines Found"
                description={tabSearch ? "No assigned machines match your search." : "No machinery currently assigned to this user."}
              />
              {canManage && user.role === "operator" && !tabSearch && (
                <div className="mt-3">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsAssignModalOpen(true)}
                    className="h-8 text-xs px-3 flex items-center gap-1.5 cursor-pointer"
                  >
                    <AnimatedPlus size={14} />
                    <span>Assign Equipment to Operator</span>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[var(--color-canvas)] border-b border-[var(--color-hairline)] text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
                    <tr>
                      <th className="py-2.5 px-3">Machine ID</th>
                      <th className="py-2.5 px-3">Name / Model</th>
                      <th className="py-2.5 px-3">Serial Number</th>
                      <th className="py-2.5 px-3">Manufacturer</th>
                      <th className="py-2.5 px-3">Hour Meter</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-hairline)]">
                    {filteredMachines.map((m) => (
                      <tr key={m.id} className="hover:bg-[var(--color-hairline-soft-surface)] transition-colors group">
                        <td className="py-2.5 px-3 font-mono font-bold text-[var(--color-ink)]">
                          {m.machine_id}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-[var(--color-ink)]">{m.machine_name}</div>
                          <div className="text-[10px] text-[var(--color-mute)]">{m.model}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[var(--color-mute)]">
                          {m.serial_number || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--color-ink)]">
                          {m.manufacturer || "—"}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[var(--color-ink)]">
                          {m.hour_meter != null ? `${m.hour_meter} h` : "—"}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                            m.status === "active"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                              : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                          }`}>
                            {m.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <Link
                            href={`/machines/${m.id}`}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-link)] hover:underline"
                          >
                            <span>Inspect</span>
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="grid grid-cols-1 gap-2.5 sm:hidden">
                {filteredMachines.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[var(--color-ink)]">{m.machine_id}</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 capitalize">
                        {m.status}
                      </span>
                    </div>
                    <div className="font-semibold text-[var(--color-ink)]">{m.machine_name} ({m.model})</div>
                    <div className="flex items-center justify-between text-[11px] text-[var(--color-mute)] pt-1 border-t border-[var(--color-hairline)]">
                      <span>Meter: {m.hour_meter != null ? `${m.hour_meter} h` : "—"}</span>
                      <Link href={`/machines/${m.id}`} className="text-[var(--color-link)] font-semibold flex items-center gap-1">
                        <span>Inspect</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 2: Shift Running Logs */}
      {activeTab === "logs" && (
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedClock size={16} className="text-emerald-500" />
              <span>Shift Running Logs (Recent 50)</span>
            </h3>
            <span className="text-xs text-[var(--color-mute)]">
              Showing {filteredLogs.length} of {runningLogs.length} logs
            </span>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center">
              <EmptyState
                title="No Running Logs Found"
                description={tabSearch ? "No logs match your search token." : "No machine operating logs recorded for this user yet."}
              />
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-[var(--color-canvas)] border-b border-[var(--color-hairline)] text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Machine</th>
                      <th className="py-2.5 px-3">Timings</th>
                      <th className="py-2.5 px-3">Meters (Start - End)</th>
                      <th className="py-2.5 px-3">Hours</th>
                      <th className="py-2.5 px-3">Overtime</th>
                      <th className="py-2.5 px-3">Location & Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-hairline)]">
                    {filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[var(--color-hairline-soft-surface)] transition-colors">
                        <td className="py-2.5 px-3 font-mono font-medium text-[var(--color-ink)] whitespace-nowrap">
                          {log.log_date}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-semibold text-[var(--color-ink)]">{log.machine_code}</span>
                          <span className="text-[10px] text-[var(--color-mute)] block truncate max-w-[140px]">
                            {log.machine_name}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-[var(--color-mute)] whitespace-nowrap">
                          {log.start_time && log.end_time
                            ? `${formatShiftTime(log.start_time)} – ${formatShiftTime(log.end_time)}`
                            : "—"}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[var(--color-ink)] whitespace-nowrap">
                          {log.start_meter != null && log.end_meter != null
                            ? `${log.start_meter} → ${log.end_meter}`
                            : "—"}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-[var(--color-ink)]">
                          {log.running_hours.toFixed(1)} h
                        </td>
                        <td className="py-2.5 px-3 font-mono text-amber-600 dark:text-amber-400">
                          {log.overtime_hours != null && log.overtime_hours > 0 ? `${log.overtime_hours.toFixed(1)} h` : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-[var(--color-mute)] max-w-xs truncate" title={log.remarks || log.location || undefined}>
                          {log.is_breakdown && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-700 mr-1.5">
                              BREAKDOWN
                            </span>
                          )}
                          {log.location || log.remarks || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="grid grid-cols-1 gap-2.5 sm:hidden">
                {filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-1.5 text-xs"
                  >
                    <div className="flex items-center justify-between font-mono">
                      <span className="font-bold text-[var(--color-ink)]">{log.log_date}</span>
                      <span className="font-bold text-emerald-600">{log.running_hours.toFixed(1)} hrs</span>
                    </div>
                    <div className="font-medium text-[var(--color-ink)] flex items-center justify-between">
                      <span>{log.machine_code} ({log.machine_name})</span>
                      {log.overtime_hours != null && log.overtime_hours > 0 && (
                        <span className="text-[10px] text-amber-600 font-mono">+{log.overtime_hours}h OT</span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--color-mute)]">
                      {log.start_time && log.end_time ? `${formatShiftTime(log.start_time)} – ${formatShiftTime(log.end_time)}` : "Standard Shift"}
                    </div>
                    {log.remarks && (
                      <div className="text-[10px] text-[var(--color-mute)] italic border-t border-[var(--color-hairline)] pt-1">
                        {log.remarks}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: Shift & Machine Assignments */}
      {activeTab === "assignments" && (
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedBuilding2 size={16} className="text-indigo-500" />
              <span>Machine Assignment History</span>
            </h3>
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-[var(--color-mute)]">
                Showing {filteredAssignments.length} of {assignments.length} assignments
              </span>
              {canManage && user.role === "operator" && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsAssignModalOpen(true)}
                  className="h-7 text-xs px-2.5 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <AnimatedWrench size={13} className="text-indigo-500" />
                  <span>Manage Shifts & Equipment</span>
                </Button>
              )}
            </div>
          </div>

          {filteredAssignments.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center">
              <EmptyState
                title="No Assignments Found"
                description={tabSearch ? "No assignments match your search query." : "No machine assignments registered for this user."}
              />
              {canManage && user.role === "operator" && !tabSearch && (
                <div className="mt-3">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setIsAssignModalOpen(true)}
                    className="h-8 text-xs px-3 flex items-center gap-1.5 cursor-pointer"
                  >
                    <AnimatedPlus size={14} />
                    <span>Assign Equipment to Operator</span>
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredAssignments.map((a) => (
                <div
                  key={a.id}
                  className="p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2.5 text-xs hover:border-[var(--color-link)]/40 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[var(--color-ink)]">{a.machine_code}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      a.is_active
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}>
                      {a.is_active ? "Active Duty" : "Ended"}
                    </span>
                  </div>

                  <div>
                    <div className="font-semibold text-[var(--color-ink)]">{a.machine_name}</div>
                    <div className="text-[10px] text-[var(--color-mute)]">{a.model}</div>
                  </div>

                  <div className="pt-2 border-t border-[var(--color-hairline)] space-y-1 text-[11px] text-[var(--color-mute)]">
                    <div className="flex items-center justify-between">
                      <span>Shift</span>
                      <span className="font-medium text-[var(--color-ink)]">
                        {a.shift_start_time && a.shift_end_time
                          ? `${formatShiftTime(a.shift_start_time)} – ${formatShiftTime(a.shift_end_time)}`
                          : "Standard Day Shift"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Assigned At</span>
                      <span className="font-mono">{formatDate(a.assigned_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Attendance Overview & Deep Link */}
      {activeTab === "attendance" && (
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-5 sm:p-6 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[var(--color-hairline)]">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[var(--color-ink)] flex items-center gap-2">
                <AnimatedCalendarClock size={18} className="text-amber-500" />
                <span>Attendance & Timesheet Ledger</span>
              </h3>
              <p className="text-xs text-[var(--color-mute)]">
                Direct monthly attendance logs, punch-in/out telemetry, worked hours, and overtime records.
              </p>
            </div>

            <Link
              href={`/attendance/${user.id}?month=2026-09`}
              className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-md bg-[var(--color-ink)] text-[var(--color-on-primary)] text-xs font-semibold hover:opacity-90 active:scale-98 transition-all shrink-0 cursor-pointer shadow-xs"
            >
              <span>View Full Attendance Ledger</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-1">
              <span className="text-xs font-medium text-[var(--color-mute)]">Total Active Work Days</span>
              <div className="text-2xl font-bold font-mono text-[var(--color-ink)]">{kpis.totalDaysWorked}</div>
              <span className="text-[11px] text-[var(--color-mute)]">From verified daily machine logs</span>
            </div>

            <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-1">
              <span className="text-xs font-medium text-[var(--color-mute)]">Total Shift Running Time</span>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{kpis.totalRunningHours} h</div>
              <span className="text-[11px] text-[var(--color-mute)]">Cumulated operating duration</span>
            </div>

            <div className="p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-1">
              <span className="text-xs font-medium text-[var(--color-mute)]">Shift Schedule</span>
              <div className="text-base font-bold text-[var(--color-ink)] mt-1">{shiftDisplay}</div>
              <span className="text-[11px] text-[var(--color-mute)]">Standard operating window</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: KYC & Identity Documents */}
      {activeTab === "documents" && (
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 sm:p-5 shadow-2xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--color-hairline)]">
            <h3 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedFileText size={16} className="text-teal-500" />
              <span>Identity & KYC Documentation</span>
            </h3>
            <span className="text-xs text-[var(--color-mute)]">
              {documents.length} uploaded files
            </span>
          </div>

          {/* Statutory Identity Cards: Aadhaar, Licence, Bank */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Aadhaar Card */}
            <div className="p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--color-ink)] flex items-center gap-1.5">
                  <AnimatedShieldCheck size={14} className="text-sky-500" />
                  Aadhaar Number
                </span>
                {user.aadhaar_number && canRevealDocs && (
                  <button
                    type="button"
                    onClick={() => setShowFullAadhaar(!showFullAadhaar)}
                    className="p-1 text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors cursor-pointer"
                    title={showFullAadhaar ? "Hide Aadhaar" : "Show Aadhaar"}
                  >
                    {showFullAadhaar ? <AnimatedEyeOff size={14} /> : <AnimatedEye size={14} />}
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-[var(--color-ink)]">
                  {user.aadhaar_number
                    ? showFullAadhaar
                      ? user.aadhaar_number
                      : maskAadhaar(user.aadhaar_number)
                    : "Not provided"}
                </span>
                {user.aadhaar_number && canRevealDocs && (
                  <button
                    type="button"
                    onClick={() => handleCopy(user.aadhaar_number!, "Aadhaar")}
                    className="p-1 hover:bg-[var(--color-hairline)] rounded text-[var(--color-mute)] cursor-pointer"
                  >
                    {copiedKey === "Aadhaar" ? <AnimatedCheck size={12} className="text-emerald-500" /> : <AnimatedCopy size={12} />}
                  </button>
                )}
              </div>
            </div>

            {/* Driving Licence */}
            <div className="p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--color-ink)] flex items-center gap-1.5">
                  <AnimatedCreditCard size={14} className="text-amber-500" />
                  Driving Licence
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-[var(--color-ink)]">
                  {user.license_number ? formatLicenseNumber(user.license_number) : "Not provided"}
                </span>
                {user.license_number && canRevealDocs && (
                  <button
                    type="button"
                    onClick={() => handleCopy(user.license_number!, "Licence")}
                    className="p-1 hover:bg-[var(--color-hairline)] rounded text-[var(--color-mute)] cursor-pointer"
                  >
                    {copiedKey === "Licence" ? <AnimatedCheck size={12} className="text-emerald-500" /> : <AnimatedCopy size={12} />}
                  </button>
                )}
              </div>
            </div>

            {/* Bank Details */}
            <div className="p-3.5 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[var(--color-ink)] flex items-center gap-1.5">
                  <AnimatedBuilding2 size={14} className="text-emerald-500" />
                  Banking Credentials
                </span>
              </div>
              <div className="space-y-0.5">
                <div className="font-mono font-bold text-[var(--color-ink)]">
                  {user.bank_account_number || "A/C: —"}
                </div>
                <div className="text-[11px] font-mono text-[var(--color-mute)]">
                  IFSC: {user.bank_ifsc_code || "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Uploaded Documents List */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--color-mute)]">
              Uploaded Identity & Verification Files
            </h4>

            {documents.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-[var(--color-hairline)] rounded-xl">
                <p className="text-xs text-[var(--color-mute)]">No document files uploaded for this profile yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {documents.map((doc) => {
                  const docType = documentTypes.find((t) => t.code === doc.document_type_code);
                  return (
                    <div
                      key={doc.id}
                      onClick={() => handleViewDoc(doc)}
                      className="flex items-center gap-3 p-3 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:border-[var(--color-link)]/40 hover:bg-[var(--color-canvas-elevated)] transition-all cursor-pointer group shadow-2xs"
                      title="Click to view document preview"
                    >
                      {/* Document Type Icon */}
                      {doc.mime_type === "application/pdf" ? (
                        <div className="h-10 w-10 rounded-lg bg-rose-500/10 border border-rose-500/25 flex flex-col items-center justify-center shrink-0 text-rose-600 dark:text-rose-400">
                          <FileText className="h-4 w-4" />
                          <span className="text-[8px] font-bold font-mono">PDF</span>
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-sky-500/10 border border-sky-500/25 flex flex-col items-center justify-center shrink-0 text-sky-600 dark:text-sky-400">
                          <ImageIcon className="h-4 w-4" />
                          <span className="text-[8px] font-bold font-mono">IMG</span>
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-[var(--color-ink)] group-hover:text-[var(--color-link)] transition-colors truncate">
                          {docType?.label || doc.document_type_code.toUpperCase()}
                        </p>
                        <p className="text-[10px] text-[var(--color-mute)] font-mono">
                          {doc.mime_type.split("/")[1]?.toUpperCase()} · {(Number(doc.file_size_bytes || 0) / 1024).toFixed(0)} KB · Tap to view
                        </p>
                      </div>

                      <div className="shrink-0">
                        <Button variant="ghost-sm" className="h-7 px-2 text-[10px] font-semibold">
                          View
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: Security Audit Trail */}
      {activeTab === "audit" && (
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] p-4 sm:p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--color-ink)] flex items-center gap-2">
              <AnimatedShieldCheck size={16} className="text-teal-500" />
              <span>Account Activity & Audit Logs (Recent 50)</span>
            </h3>
            <span className="text-xs text-[var(--color-mute)]">
              Showing {filteredAuditLogs.length} of {auditLogs.length} records
            </span>
          </div>

          {filteredAuditLogs.length === 0 ? (
            <div className="py-12 text-center">
              <EmptyState
                title="No Audit Records"
                description={tabSearch ? "No activity records match your search." : "No recorded audit changes for this account yet."}
              />
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-hairline)] text-xs">
              {filteredAuditLogs.map((log) => (
                <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:bg-[var(--color-hairline-soft-surface)] px-2 rounded-lg transition-colors">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-[var(--color-ink)] flex items-center gap-2">
                      <span>{log.action}</span>
                      {log.category && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--color-canvas)] border border-[var(--color-hairline)] text-[var(--color-mute)] uppercase">
                          {log.category}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--color-mute)]">
                      By {log.actor_name || "System"} ({log.actor_role || "automated"})
                    </div>
                  </div>
                  <div className="text-[10px] font-mono text-[var(--color-mute)] shrink-0">
                    {formatDate(log.created_at)} ({formatTimeAgo(log.created_at)})
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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

      {/* Toggle Status Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmToggleOpen}
        onClose={() => setConfirmToggleOpen(false)}
        title={user.status === "active" ? "Deactivate User Account" : "Activate User Account"}
        description={`Are you sure you want to mark ${user.full_name} as ${user.status === "active" ? "inactive" : "active"}?`}
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
          onSuccess={() => {
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
