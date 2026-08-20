"use client";

import React, { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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
} from "lucide-react";
import { getStatusBadgeConfig } from "@servicecentric/design-tokens";
import { addTaskComment } from "@/app/actions/tasks";
import type { Task, User as UserType } from "@servicecentric/types";

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

  React.useEffect(() => {
    setLocalComments(task?.comments || []);
  }, [task]);

  if (!isOpen || !task) return null;

  const badgeConfig = getStatusBadgeConfig(task.status);
  const isManager = [
    "super_admin", "admin", "service_manager", "branch_manager",
    "supervisor", "hr_manager", "rental_manager", "sales_manager",
    "finance_manager", "store_manager"
  ].includes(currentUser.role);

  const isAssignee = (task.assignees || []).some((a) => a.user_id === currentUser.id);

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

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 dark:bg-black/70 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-2xl bg-[var(--color-canvas)] border-l border-[var(--color-hairline)] shadow-2xl flex flex-col h-full overflow-hidden text-[var(--color-ink)]">
        {/* Header */}
        <div className="p-4 border-b border-[var(--color-hairline)] flex items-center justify-between bg-[var(--color-canvas-elevated)]">
          <div className="flex items-center gap-3">
            <div className="px-2.5 py-1 text-xs font-mono font-bold rounded bg-[var(--color-link)]/10 text-[var(--color-link)] border border-[var(--color-link)]/20">
              #{task.task_no}
            </div>
            <Badge variant="info">{badgeConfig.label}</Badge>
            <span
              className={`text-xs font-bold uppercase px-2 py-0.5 rounded border ${
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
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--color-mute)] hover:text-[var(--color-ink)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Title & Description */}
          <div>
            <h2 className="text-xl font-bold text-[var(--color-ink)] mb-2">{task.title}</h2>
            <p className="text-sm text-[var(--color-body)] whitespace-pre-wrap bg-[var(--color-canvas-elevated)] p-3 rounded-lg border border-[var(--color-hairline)]">
              {task.description || "No description provided."}
            </p>
          </div>

          {/* Quick Details Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs bg-[var(--color-canvas-elevated)] p-3.5 rounded-xl border border-[var(--color-hairline)]">
            <div>
              <span className="text-[var(--color-mute)] block mb-0.5">Due Date:</span>
              <span className="font-semibold text-[var(--color-ink)] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-[var(--color-link)]" />
                {task.due_date} {task.due_time ? `@ ${task.due_time}` : ""}
              </span>
            </div>
            <div>
              <span className="text-[var(--color-mute)] block mb-0.5">Created By:</span>
              <span className="font-semibold text-[var(--color-ink)] flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-emerald-500" />
                {task.creator?.full_name || "Manager"}
              </span>
            </div>
            <div>
              <span className="text-[var(--color-mute)] block mb-0.5">Reminder Offset:</span>
              <span className="font-semibold text-[var(--color-ink)] capitalize">
                {task.reminder_offset && task.reminder_offset !== "none" ? task.reminder_offset : "None"}
              </span>
            </div>
            <div>
              <span className="text-[var(--color-mute)] block mb-0.5">Created At:</span>
              <span className="font-semibold text-[var(--color-ink)]">
                {new Date(task.created_at).toLocaleDateString("en-GB")}
              </span>
            </div>
          </div>

          {/* Assigned Employees */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-2 flex items-center gap-1.5">
              <User className="w-4 h-4 text-[var(--color-link)]" /> Assigned Employees ({(task.assignees || []).length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(task.assignees || []).map((a) => (
                <div key={a.id} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)]">
                  <div className="w-7 h-7 rounded-full bg-[var(--color-link)]/10 border border-[var(--color-link)]/20 flex items-center justify-center text-xs font-bold text-[var(--color-link)]">
                    {a.user?.full_name?.charAt(0) || "U"}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-medium text-[var(--color-ink)] truncate">{a.user?.full_name}</p>
                    <p className="text-[10px] text-[var(--color-mute)] capitalize">{a.user?.role?.replace(/_/g, " ")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Completion Information */}
          {task.status === "completed" && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Task Marked Completed</span>
                <span>{task.completed_at ? new Date(task.completed_at).toLocaleString("en-GB") : ""}</span>
              </div>
              {task.completion_notes && (
                <p className="text-xs text-[var(--color-body)] italic">"{task.completion_notes}"</p>
              )}
              {task.verifier && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Verified by: {task.verifier.full_name}</p>
              )}
            </div>
          )}

          {/* Reopened Information */}
          {task.status === "reopened" && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1 text-xs">
              <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                <RotateCcw className="w-4 h-4" /> Reopened by Manager
              </div>
              <p className="text-[var(--color-body)]">Reason: {task.reopen_reason || "Needs revision"}</p>
            </div>
          )}

          {/* Completion Proof Attachments */}
          {(task.attachments || []).length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-2 flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-purple-500" /> Attachments & Proofs ({(task.attachments || []).length})
              </h3>
              <div className="space-y-1.5">
                {(task.attachments || []).map((att) => (
                  <a
                    key={att.id}
                    href={att.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between p-2.5 rounded-lg bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] hover:border-[var(--color-link)]/40 text-xs text-[var(--color-link)] transition-colors"
                  >
                    <span className="truncate">{att.file_name}</span>
                    <Badge variant="info">{att.file_type}</Badge>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Comment Discussion Thread */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-3 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-[var(--color-link)]" /> Discussion & Comments ({localComments.length})
            </h3>
            <div className="space-y-2.5 mb-3 max-h-48 overflow-y-auto pr-1">
              {localComments.map((c) => (
                <div key={c.id} className="p-3 rounded-lg bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] text-xs space-y-1">
                  <div className="flex items-center justify-between text-[var(--color-mute)] text-[11px]">
                    <span className="font-semibold text-[var(--color-ink)]">{c.user?.full_name || "User"}</span>
                    <span>{new Date(c.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <p className="text-[var(--color-body)] leading-relaxed">{c.comment}</p>
                </div>
              ))}
              {localComments.length === 0 && (
                <p className="text-xs text-[var(--color-mute)] italic">No comments yet. Start a discussion below.</p>
              )}
            </div>

            {/* Comment Form */}
            <form onSubmit={handlePostComment} className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Type a comment or instruction..."
                className="flex-1 px-3 py-2 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-lg focus:outline-none focus:border-[var(--color-ink)] text-[var(--color-ink)] placeholder-[var(--color-mute)]"
              />
              <Button type="submit" variant="primary" loading={postingComment} disabled={postingComment || !commentText.trim()}>
                <Send className="w-3.5 h-3.5" />
              </Button>
            </form>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 border-t border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isManager && (
              <Button variant="secondary" onClick={() => onOpenEdit?.(task)}>
                Edit Task
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(isAssignee || isManager) && (task.status === "pending" || task.status === "in_progress" || task.status === "reopened") && (
              <Button variant="primary" onClick={() => onOpenComplete?.(task)}>
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> Complete Task
              </Button>
            )}
            {isManager && task.status === "completed" && (
              <Button variant="primary" onClick={() => onOpenVerify?.(task)}>
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> Verify Completion
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
