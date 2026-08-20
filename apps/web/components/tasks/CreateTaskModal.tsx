"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Calendar, Clock, User as UserIcon, AlertCircle, Bell, Trash2 } from "lucide-react";
import { createTask, updateTask, deleteTask } from "@/app/actions/tasks";
import type { Task, User } from "@servicecentric/types";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: Pick<User, "id" | "full_name" | "email" | "role">[];
  initialTask?: Task | null;
  onSuccess?: () => void;
}

export function CreateTaskModal({
  isOpen,
  onClose,
  users,
  initialTask,
  onSuccess,
}: CreateTaskModalProps) {
  const isEditing = !!initialTask;

  const [title, setTitle] = useState(initialTask?.title || "");
  const [description, setDescription] = useState(initialTask?.description || "");
  const [dueDate, setDueDate] = useState(initialTask?.due_date || new Date().toISOString().split("T")[0]);
  const [dueTime, setDueTime] = useState(initialTask?.due_time || "");
  const [priority, setPriority] = useState<string>(initialTask?.priority || "medium");
  const [reminderOffset, setReminderOffset] = useState<string>(initialTask?.reminder_offset || "none");
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>(
    initialTask?.assignees?.map((a) => a.user_id) || []
  );
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const toggleAssignee = (userId: string) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg("Task title is required");
      return;
    }
    if (!dueDate) {
      setErrorMsg("Due date is required");
      return;
    }
    if (selectedAssigneeIds.length === 0) {
      setErrorMsg("Please assign task to at least one employee");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    if (isEditing && initialTask) {
      const res = await updateTask(initialTask.id, {
        title,
        description,
        due_date: dueDate,
        due_time: dueTime || undefined,
        priority: priority as any,
        reminder_offset: reminderOffset as any,
        assignee_ids: selectedAssigneeIds,
      });
      setLoading(false);
      if (res.success) {
        onSuccess?.();
        onClose();
      } else {
        setErrorMsg(res.error || "Failed to update task");
      }
    } else {
      const res = await createTask({
        title,
        description,
        due_date: dueDate,
        due_time: dueTime || undefined,
        priority: priority as any,
        reminder_offset: reminderOffset as any,
        assignee_ids: selectedAssigneeIds,
      });
      setLoading(false);
      if (res.success) {
        onSuccess?.();
        onClose();
      } else {
        setErrorMsg(res.error || "Failed to create task");
      }
    }
  };

  const handleDelete = async () => {
    if (!initialTask) return;
    if (!confirm("Are you sure you want to delete this task?")) return;
    setLoading(true);
    const res = await deleteTask(initialTask.id);
    setLoading(false);
    if (res.success) {
      onSuccess?.();
      onClose();
    } else {
      setErrorMsg(res.error || "Failed to delete task");
    }
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Task #${initialTask.task_no}` : "Create To-Do / Task"}
      footer={
        <div className="flex items-center justify-between w-full">
          {isEditing ? (
            <Button
              type="button"
              variant="danger-sm"
              onClick={handleDelete}
              loading={loading}
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Delete Task
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={onClose} loading={loading}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} loading={loading} variant="primary">
              {loading ? "Saving..." : isEditing ? "Save Changes" : "Save Task"}
            </Button>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-[var(--color-ink)]">
        {errorMsg && (
          <div className="p-3 text-sm text-rose-600 dark:text-rose-400 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Task Title */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-1">
            Task Title <span className="text-rose-500">*</span>
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter task title..."
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-1">
            Description / Instructions
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter task instructions, specifications, or notes..."
            rows={3}
            className="w-full px-3 py-2 text-sm bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-lg focus:outline-none focus:border-[var(--color-ink)] text-[var(--color-ink)] placeholder-[var(--color-mute)]"
          />
        </div>

        {/* Date and Time Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Due Date <span className="text-rose-500">*</span>
            </label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Due Time (Optional)
            </label>
            <Input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
            />
          </div>
        </div>

        {/* Assign To Multi-Employee Selector */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-1 flex items-center gap-1">
            <UserIcon className="w-3.5 h-3.5" /> Assign To Employee(s) <span className="text-rose-500">*</span>
          </label>
          <div className="max-h-40 overflow-y-auto p-2 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-lg space-y-1.5">
            {users.map((u) => {
              const isSelected = selectedAssigneeIds.includes(u.id);
              return (
                <div
                  key={u.id}
                  onClick={() => toggleAssignee(u.id)}
                  className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
                    isSelected ? "bg-[var(--color-link)]/10 border border-[var(--color-link)]/40" : "hover:bg-[var(--color-hairline-soft-surface)]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[var(--color-link)]/20 border border-[var(--color-link)]/30 flex items-center justify-center text-xs font-bold text-[var(--color-link)]">
                      {u.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[var(--color-ink)]">{u.full_name}</p>
                      <p className="text-[10px] text-[var(--color-mute)] capitalize">{u.role.replace(/_/g, " ")}</p>
                    </div>
                  </div>
                  <Badge variant={isSelected ? "success" : "neutral"}>
                    {isSelected ? "Assigned" : "Select"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Priority & Reminder Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-1">
              Priority
            </label>
            <Select
              value={priority}
              onChange={(val) => setPriority(val)}
              options={[
                { value: "low", label: "Low Priority" },
                { value: "medium", label: "Medium Priority" },
                { value: "high", label: "High Priority" },
                { value: "critical", label: "Critical Priority" },
              ]}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-1 flex items-center gap-1">
              <Bell className="w-3.5 h-3.5" /> Reminder
            </label>
            <Select
              value={reminderOffset}
              onChange={(val) => setReminderOffset(val)}
              options={[
                { value: "none", label: "No Reminder" },
                { value: "10m", label: "10 Minutes Before" },
                { value: "30m", label: "30 Minutes Before" },
                { value: "1h", label: "1 Hour Before" },
                { value: "1d", label: "1 Day Before" },
              ]}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
