"use client";

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TooltipWrapper } from "@/components/ui/tooltip";
import {
  X,
  Calendar,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Paperclip,
  MessageSquare,
  Send,
  Copy,
  Check,
  Edit,
  ExternalLink,
  ShieldCheck,
  Tag,
} from "lucide-react";
import { getStatusBadgeConfig } from "@reachinternational/design-tokens";
import { formatDate as formatDisplayDate } from "@reachinternational/utils";
import { addTaskComment } from "@/app/actions/tasks";
import type { Task, User as UserType } from "@reachinternational/types";

interface TaskDetailDrawerProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserType;
  onOpenEdit?: (task: Task) => void;
  onOpenComplete?: (task: Task) => void;
  onOpenVerify?: (task: Task) => void;
}

export function TaskDetailDrawer({
  task,
  isOpen,
  onClose,
  currentUser,
  onOpenEdit,
  onOpenComplete,
  onOpenVerify,
}: TaskDetailDrawerProps) {
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [localComments, setLocalComments] = useState(task?.comments || []);
  const [copiedTaskNo, setCopiedTaskNo] = useState(false);

  useEffect(() => {
    setLocalComments(task?.comments || []);
  }, [task]);

  // Handle ESC key press to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!task) return null;

  const badgeConfig = getStatusBadgeConfig(task.status);
  const isManager = [
    "super_admin", "admin", "service_manager", "branch_manager",
    "supervisor", "hr_manager", "rental_manager", "sales_manager",
    "finance_manager", "store_manager"
  ].includes(currentUser.role);

  const isAssignee = (task.assignees || []).some((a) => a.user_id === currentUser.id);
  const isOverdue = task.due_date < new Date().toISOString().split("T")[0] && task.status !== "completed";

  const handleCopyTaskNo = () => {
    if (!task) return;
    navigator.clipboard.writeText(`#${task.task_no}`);
    setCopiedTaskNo(true);
    setTimeout(() => setCopiedTaskNo(false), 2000);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setPostingComment(true);
    const res = await addTaskComment(task.id, commentText);
    setPostingComment(false);

    if (res.success && res.comment) {
      setLocalComments((prev) => [
        ...prev,
        {
          ...res.comment,
          user: { id: currentUser.id, full_name: currentUser.full_name, role: currentUser.role },
        },
      ]);
      setCommentText("");
    }
  };

  const formatRoleName = (role?: string) => {
    if (!role) return "";
    return role
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
          className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 backdrop-blur-xs flex justify-end overflow-hidden"
        >
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="w-full sm:max-w-xl md:max-w-2xl bg-[var(--color-canvas)] border-l border-[var(--color-hairline)] shadow-2xl flex flex-col h-full overflow-hidden text-[var(--color-ink)]"
          >
            {/* Drawer Header */}
            <div className="shrink-0 p-4 sm:px-6 border-b border-[var(--color-hairline)] flex items-center justify-between bg-[var(--color-canvas-elevated)] z-10">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <button
                  onClick={handleCopyTaskNo}
                  className="px-2.5 py-1 text-xs font-mono font-bold rounded bg-[var(--color-link)]/10 text-[var(--color-link)] border border-[var(--color-link)]/20 hover:bg-[var(--color-link)]/20 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Click to copy task number"
                >
                  #{task.task_no}
                  {copiedTaskNo ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3 opacity-60" />}
                </button>
                <Badge variant={task.status === "completed" ? "success" : task.status === "overdue" ? "error" : "info"}>
                  {badgeConfig.label}
                </Badge>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                    task.priority === "critical"
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                      : task.priority === "high"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                      : task.priority === "medium"
                      ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  }`}
                >
                  {task.priority} Priority
                </span>
                {isOverdue && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> Overdue
                  </span>
                )}
              </div>

              <TooltipWrapper content="Close (Esc)" side="left">
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer shrink-0"
                  aria-label="Close Task Details"
                >
                  <X className="w-5 h-5" />
                </button>
              </TooltipWrapper>
            </div>

            {/* Scrollable Content Body - Single scroll container (no nested scrollbars) */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 min-h-0">
              {/* Title & Description Section */}
              <div className="space-y-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--color-ink)] leading-snug">
                  {task.title}
                </h2>
                <div className="text-xs sm:text-sm text-[var(--color-body)] whitespace-pre-wrap bg-[var(--color-canvas-elevated)] p-4 rounded-xl border border-[var(--color-hairline)] leading-relaxed">
                  {task.description || <span className="italic text-[var(--color-mute)]">No description provided.</span>}
                </div>
              </div>

              {/* Responsive Quick Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] space-y-1">
                  <span className="text-[var(--color-mute)] text-[11px] flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-[var(--color-link)] shrink-0" /> Due Date
                  </span>
                  <span className={`font-semibold block ${isOverdue ? "text-rose-500 font-bold" : "text-[var(--color-ink)]"}`}>
                    {formatDisplayDate(task.due_date)}
                    {task.due_time ? <span className="text-[11px] font-normal block text-[var(--color-mute)]">@ {task.due_time}</span> : null}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] space-y-1">
                  <span className="text-[var(--color-mute)] text-[11px] flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Created By
                  </span>
                  <span className="font-semibold text-[var(--color-ink)] block truncate">
                    {task.creator?.full_name || "Manager"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] space-y-1">
                  <span className="text-[var(--color-mute)] text-[11px] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" /> Reminder
                  </span>
                  <span className="font-semibold text-[var(--color-ink)] block capitalize truncate">
                    {task.reminder_offset && task.reminder_offset !== "none" ? task.reminder_offset : "None"}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] space-y-1">
                  <span className="text-[var(--color-mute)] text-[11px] flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-purple-500 shrink-0" /> Created At
                  </span>
                  <span className="font-semibold text-[var(--color-ink)] block">
                    {formatDisplayDate(task.created_at)}
                  </span>
                </div>
              </div>

              {/* Assigned Employees */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] flex items-center gap-1.5">
                  <User className="w-4 h-4 text-[var(--color-link)]" /> Assigned Employees ({(task.assignees || []).length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(task.assignees || []).map((a) => {
                    const name = a.user?.full_name || "Unknown";
                    const role = formatRoleName(a.user?.role);
                    return (
                      <div
                        key={a.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] hover:border-[var(--color-hairline-soft-surface)] transition-all"
                      >
                        <div className="w-8 h-8 rounded-full bg-[var(--color-link)]/15 border border-[var(--color-link)]/30 flex items-center justify-center text-xs font-bold text-[var(--color-link)] shrink-0">
                          {name.charAt(0).toUpperCase()}
                        </div>
                        <div className="truncate min-w-0">
                          <p className="text-xs font-bold text-[var(--color-ink)] truncate">{name}</p>
                          {role && <p className="text-[11px] text-[var(--color-mute)] font-medium truncate">{role}</p>}
                        </div>
                      </div>
                    );
                  })}
                  {(task.assignees || []).length === 0 && (
                    <div className="p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] text-xs text-[var(--color-mute)] italic">
                      No employees assigned to this task.
                    </div>
                  )}
                </div>
              </div>

              {/* Completion Information Banner */}
              {task.status === "completed" && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-2 text-xs">
                  <div className="flex items-center justify-between font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Task Marked Completed
                    </span>
                    <span>{task.completed_at ? formatDisplayDate(task.completed_at) : ""}</span>
                  </div>
                  {task.completion_notes && (
                    <p className="text-[var(--color-body)] italic bg-emerald-500/5 p-2.5 rounded-lg border border-emerald-500/15">
                      "{task.completion_notes}"
                    </p>
                  )}
                  {task.verifier && (
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Verified by: {task.verifier.full_name}
                    </p>
                  )}
                </div>
              )}

              {/* Reopened Information Banner */}
              {task.status === "reopened" && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-1.5 text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                    <RotateCcw className="w-4 h-4" /> Reopened by Manager
                  </div>
                  <p className="text-[var(--color-body)]">
                    <span className="font-semibold">Reason:</span> {task.reopen_reason || "Needs revision or further work."}
                  </p>
                </div>
              )}

              {/* Attachments & Proofs */}
              {(task.attachments || []).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] flex items-center gap-1.5">
                    <Paperclip className="w-4 h-4 text-purple-500" /> Attachments & Completion Proofs ({(task.attachments || []).length})
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(task.attachments || []).map((att) => (
                      <a
                        key={att.id}
                        href={att.file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] hover:border-[var(--color-link)]/40 text-xs text-[var(--color-link)] transition-all group"
                      >
                        <div className="flex items-center gap-2 truncate min-w-0 pr-2">
                          <Paperclip className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate font-medium group-hover:underline">{att.file_name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="info">{att.file_type}</Badge>
                          <ExternalLink className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Comment Discussion Thread (Smooth single-scroll flow, no inner scroll container) */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-[var(--color-link)]" /> Discussion & Activity ({localComments.length})
                </h3>

                <div className="space-y-2.5">
                  {localComments.map((c) => {
                    const authorName = c.user?.full_name || "User";
                    const authorRole = formatRoleName(c.user?.role);
                    return (
                      <div
                        key={c.id}
                        className="p-3.5 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[var(--color-mute)] text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-[var(--color-ink)]">{authorName}</span>
                            {authorRole && <span className="text-[10px] text-[var(--color-mute)]">({authorRole})</span>}
                          </div>
                          <span>
                            {new Date(c.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}{" "}
                            {new Date(c.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-[var(--color-body)] leading-relaxed whitespace-pre-wrap">{c.comment}</p>
                      </div>
                    );
                  })}
                  {localComments.length === 0 && (
                    <div className="p-4 rounded-xl bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] text-center text-xs text-[var(--color-mute)] italic">
                      No comments or updates yet. Type below to start a discussion.
                    </div>
                  )}
                </div>

                {/* Comment Form */}
                <form onSubmit={handlePostComment} className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Type an update, instruction, or comment..."
                    className="flex-1 px-3.5 py-2.5 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-xl focus:outline-none focus:border-[var(--color-link)] text-[var(--color-ink)] placeholder-[var(--color-mute)] transition-colors"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    loading={postingComment}
                    disabled={postingComment || !commentText.trim()}
                    className="px-4 shrink-0 rounded-xl"
                  >
                    <Send className="w-3.5 h-3.5 mr-1" /> Send
                  </Button>
                </form>
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="shrink-0 p-4 sm:px-6 border-t border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex flex-wrap items-center justify-between gap-3 z-10">
              <Button variant="secondary" onClick={onClose} className="text-xs">
                Close
              </Button>
              <div className="flex items-center gap-2 flex-wrap">
                {isManager && (
                  <Button variant="secondary" onClick={() => onOpenEdit?.(task)} className="text-xs">
                    <Edit className="w-3.5 h-3.5 mr-1.5" /> Edit Task
                  </Button>
                )}
                {(isAssignee || isManager) && (task.status === "pending" || task.status === "in_progress" || task.status === "reopened") && (
                  <Button variant="primary" onClick={() => onOpenComplete?.(task)} className="text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Complete Task
                  </Button>
                )}
                {isManager && task.status === "completed" && (
                  <Button variant="primary" onClick={() => onOpenVerify?.(task)} className="text-xs">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Verify Completion
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
