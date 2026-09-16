"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Phone, MapPin, Clock } from "lucide-react";
import { AnimatedShieldAlert } from "@/components/ui/animated-icons";
import { Button } from "@/components/ui";
import { formatTinyRelativeTime } from "@reachinternational/utils";
import type { User } from "@/lib/types/database";
import {
  getPendingRoleBadge,
  getInitials,
  getRoleAvatarStyle,
} from "./users-helpers";

export interface PendingApprovalsSectionProps {
  pendingUsers: User[];
  onApprove: (userId: string) => Promise<void>;
  onReject: (userId: string) => Promise<void>;
  onApproveAll: () => Promise<void>;
  onRejectAllConfirm: () => void;
  onSelectUser: (user: User) => void;
  loadingState: { type: string; id: string } | null;
  isBulkApproving: boolean;
  isBulkRejecting: boolean;
}

export function PendingApprovalsSection({
  pendingUsers,
  onApprove,
  onReject,
  onApproveAll,
  onRejectAllConfirm,
  onSelectUser,
  loadingState,
  isBulkApproving,
  isBulkRejecting,
}: PendingApprovalsSectionProps) {
  if (pendingUsers.length === 0) return null;

  return (
    <div
      id="pending-approvals-section"
      className="relative overflow-hidden rounded-2xl border border-amber-500/25 dark:border-amber-500/20 bg-gradient-to-b from-amber-500/[0.04] via-[var(--color-canvas-elevated)] to-[var(--color-canvas-elevated)] dark:from-amber-950/[0.18] dark:via-[var(--color-canvas-elevated)] dark:to-[var(--color-canvas-elevated)] p-4 sm:p-5 shadow-xs transition-all"
    >
      {/* Subtle Ambient Highlight at the Top Border */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/60 dark:via-amber-400/50 to-transparent pointer-events-none" />

      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3.5 border-b border-amber-500/15 dark:border-amber-500/10">
        <div className="flex items-center gap-3">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 shrink-0 shadow-xs">
            <AnimatedShieldAlert size={18} />
            <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-[var(--color-ink)] tracking-tight">
                Pending User Approvals
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                {pendingUsers.length} Pending
              </span>
            </div>
            <p className="text-xs text-[var(--color-mute)] mt-0.5">
              Review and authorize registration requests before granting system access
            </p>
          </div>
        </div>

        {/* Optimized Parallel Batch Actions */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0 w-full sm:w-auto">
          <Button
            variant="success-sm"
            onClick={onApproveAll}
            loading={isBulkApproving}
            className="h-9 sm:h-8 px-3.5 flex-1 sm:flex-initial text-xs font-semibold rounded-md sm:rounded-sm shadow-xs inline-flex items-center justify-center active:scale-95 transition-all cursor-pointer"
            title={`Accept and approve all ${pendingUsers.length} pending registration requests`}
          >
            Accept All ({pendingUsers.length})
          </Button>
          <Button
            variant="danger-sm"
            onClick={onRejectAllConfirm}
            loading={isBulkRejecting}
            className="h-9 sm:h-8 px-3 flex-1 sm:flex-initial text-xs font-semibold rounded-md sm:rounded-sm shadow-xs inline-flex items-center justify-center active:scale-95 transition-all cursor-pointer bg-[var(--color-canvas-elevated)] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 hover:border-rose-300 dark:hover:border-rose-700"
            title={`Reject all ${pendingUsers.length} pending registration requests`}
          >
            Reject All
          </Button>
        </div>
      </div>

      {/* Responsive Grid of Pending User Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <AnimatePresence mode="popLayout">
          {pendingUsers.map((pUser) => (
            <motion.div
              key={pUser.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92, y: -8, transition: { duration: 0.2, ease: "easeOut" } }}
              whileHover={{ y: -2 }}
              transition={{
                type: "spring",
                stiffness: 380,
                damping: 28,
                layout: { duration: 0.25, ease: "easeOut" },
              }}
              onClick={() => onSelectUser(pUser)}
              className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 p-4 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] shadow-xs hover:border-amber-500/40 hover:shadow-md dark:hover:shadow-amber-950/25 transition-all duration-200 group overflow-hidden border-l-[3px] border-l-amber-500 dark:border-l-amber-400 cursor-pointer"
            >
              {/* Top Hairline Sheen on Hover */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/50 dark:via-amber-400/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

              <div className="flex items-start sm:items-center gap-3.5 min-w-0 pr-1 flex-1">
                {/* Avatar with Role-Themed Gradient and Live Status Pip */}
                <div className={`relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${getRoleAvatarStyle(pUser.role)} font-bold text-sm border shadow-xs group-hover:scale-105 transition-transform duration-200 select-none`}>
                  <span>{getInitials(pUser.full_name)}</span>
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500 ring-2 ring-[var(--color-canvas-elevated)]"></span>
                  </span>
                </div>

                {/* User Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[var(--color-ink)] truncate tracking-tight group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors" title={pUser.full_name}>
                      {pUser.full_name}
                    </span>
                    {getPendingRoleBadge(pUser.role)}
                    {pUser.created_at && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/25 text-[10px] sm:text-[11px] font-mono font-semibold text-amber-800 dark:text-amber-300 shadow-2xs shrink-0 select-none"
                        title={new Date(pUser.created_at).toLocaleString()}
                      >
                        <Clock size={11} className="shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>Registered {formatTinyRelativeTime(pUser.created_at)}</span>
                      </span>
                    )}
                  </div>

                  {/* Contact Badges Row */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--color-mute)] mt-1.5">
                    {pUser.phone && (
                      <span className="inline-flex items-center gap-1 font-mono hover:text-[var(--color-ink)] transition-colors">
                        <Phone size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>{pUser.phone}</span>
                      </span>
                    )}
                    {pUser.email && (
                      <span className="inline-flex items-center gap-1 truncate max-w-[200px] hover:text-[var(--color-ink)] transition-colors" title={pUser.email}>
                        <Mail size={12} className="shrink-0" />
                        <span className="truncate">{pUser.email}</span>
                      </span>
                    )}
                    {(pUser.city || pUser.state) && (
                      <span className="inline-flex items-center gap-1 text-[var(--color-mute)] truncate max-w-[180px]">
                        <MapPin size={12} className="shrink-0 text-teal-600 dark:text-teal-400" />
                        <span className="truncate">{[pUser.city, pUser.state].filter(Boolean).join(", ")}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div
                className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[var(--color-hairline)] justify-end"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="success-sm"
                  size="sm"
                  loading={loadingState?.type === "approve" && loadingState?.id === pUser.id}
                  disabled={loadingState !== null}
                  onClick={() => onApprove(pUser.id)}
                  className="h-8 px-3 text-xs font-semibold rounded-md shadow-xs active:scale-95 transition-all cursor-pointer"
                  title="Approve user registration"
                >
                  Approve
                </Button>
                <Button
                  variant="danger-sm"
                  size="sm"
                  loading={loadingState?.type === "reject" && loadingState?.id === pUser.id}
                  disabled={loadingState !== null}
                  onClick={() => onReject(pUser.id)}
                  className="h-8 px-3 text-xs font-semibold rounded-md shadow-xs active:scale-95 transition-all cursor-pointer bg-[var(--color-canvas-elevated)] hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60 hover:border-rose-300 dark:hover:border-rose-700"
                  title="Decline and remove registration request"
                >
                  Reject
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
