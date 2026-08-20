"use client";

import React, { useState, useRef, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Calendar,
  Clock,
  User as UserIcon,
  AlertCircle,
  Bell,
  Trash2,
  Search,
  ChevronDown,
  X,
  Check,
  Sparkles,
  Users,
  ShieldCheck,
  Wand2
} from "lucide-react";
import { createTask, updateTask, deleteTask } from "@/app/actions/tasks";
import type { Task, User } from "@reachinternational/types";
import { summarizeTaskTitle } from "@reachinternational/utils";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: Pick<User, "id" | "full_name" | "email" | "role">[];
  initialTask?: Task | null;
  onSuccess?: () => void;
}

// Helper to format role-based access level for employees
function getRoleBadgeProps(role: string): { label: string; variant: "error" | "warning" | "info" | "success" | "neutral" } {
  const normalized = role.toLowerCase();
  if (normalized.includes("admin")) {
    return { label: "Admin", variant: "error" };
  }
  if (normalized.includes("manager") || normalized.includes("supervisor")) {
    const formatted = role.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    return { label: formatted, variant: "warning" };
  }
  if (normalized.includes("engineer") || normalized.includes("technician")) {
    const formatted = role.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
    return { label: formatted, variant: "info" };
  }
  if (normalized.includes("operator")) {
    return { label: "Operator", variant: "success" };
  }
  if (normalized.includes("client")) {
    return { label: "Client", variant: "neutral" };
  }
  return { label: role.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()), variant: "neutral" };
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
  const [dueDate, setDueDate] = useState(
    initialTask?.due_date || new Date().toISOString().split("T")[0]
  );
  const [dueTime, setDueTime] = useState(initialTask?.due_time || "");
  const [priority, setPriority] = useState<string>(initialTask?.priority || "medium");
  const [reminderOffset, setReminderOffset] = useState<string>(
    initialTask?.reminder_offset || "none"
  );
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>(
    initialTask?.assignees?.map((a) => a.user_id) || []
  );

  // Employee Dropdown Selector state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleCategory, setRoleCategory] = useState<string>("all");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [autoFillNotice, setAutoFillNotice] = useState(false);

  // Click outside to close employee dropdown selector
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleAssignee = (userId: string) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAllFiltered = (filteredUsers: Pick<User, "id" | "full_name" | "email" | "role">[]) => {
    const filteredIds = filteredUsers.map((u) => u.id);
    const newSelected = Array.from(new Set([...selectedAssigneeIds, ...filteredIds]));
    setSelectedAssigneeIds(newSelected);
  };

  const handleClearSelection = () => {
    setSelectedAssigneeIds([]);
  };

  // Summarize description and auto-fill title
  const handleSummarizeTitle = () => {
    if (!description.trim()) {
      setErrorMsg("Please enter a description first to generate title summary");
      return;
    }

    const summarized = summarizeTaskTitle(description);
    setTitle(summarized);
    setAutoFillNotice(true);
    setErrorMsg("");
    setTimeout(() => setAutoFillNotice(false), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMsg("Task description / instructions is required");
      return;
    }

    // Auto-summarize description to fill short title if title is empty on save
    let finalTitle = title.trim();
    if (!finalTitle) {
      finalTitle = summarizeTaskTitle(description);
      setTitle(finalTitle);
      setAutoFillNotice(true);
      setTimeout(() => setAutoFillNotice(false), 3000);
    }

    if (!finalTitle) {
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
        title: finalTitle,
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
        title: finalTitle,
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

  // Filter employees for dropdown
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      u.full_name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (roleCategory === "admin") return u.role.includes("admin");
    if (roleCategory === "manager") return u.role.includes("manager") || u.role.includes("supervisor");
    if (roleCategory === "engineer") return u.role.includes("engineer") || u.role.includes("technician");
    if (roleCategory === "operator") return u.role.includes("operator");
    if (roleCategory === "client") return u.role.includes("client");

    return true;
  });

  const selectedUsers = users.filter((u) => selectedAssigneeIds.includes(u.id));

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

        {autoFillNotice && (
          <div className="p-2.5 text-xs text-emerald-600 dark:text-emerald-400 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>Task title auto-summarized from description instructions!</span>
          </div>
        )}

        {/* Description (Mandatory) */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)]">
              Description / Instructions <span className="text-rose-500">*</span>
            </label>
            <button
              type="button"
              onClick={handleSummarizeTitle}
              disabled={!description.trim()}
              title="Auto-fill title based on description summary"
              className={`text-xs font-medium inline-flex items-center gap-1 px-2 py-0.5 rounded transition-all border ${
                description.trim()
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 cursor-pointer"
                  : "bg-gray-500/5 border-gray-500/10 text-gray-400 cursor-not-allowed"
              }`}
            >
              <Wand2 className="w-3 h-3" />
              <span>Auto-fill Title</span>
            </button>
          </div>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (errorMsg) setErrorMsg("");
            }}
            placeholder="Enter detailed task instructions, scope of work, or notes (Required)..."
            rows={3}
            required
            className="w-full px-3 py-2 text-sm bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-lg focus:outline-none focus:border-[var(--color-ink)] text-[var(--color-ink)] placeholder-[var(--color-mute)]"
          />
        </div>

        {/* Task Title */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)]">
              Task Title <span className="text-rose-500">*</span>
            </label>
          </div>
          <Input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errorMsg) setErrorMsg("");
            }}
            placeholder="Enter task title or click 'Auto-fill Title' above..."
            required
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

        {/* Assign To Multi-Employee Searchable Dropdown Selector */}
        <div className="relative" ref={dropdownRef}>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-mute)] mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <UserIcon className="w-3.5 h-3.5" /> Assign To Employee(s) <span className="text-rose-500">*</span>
            </span>
            <span className="text-[11px] font-normal text-[var(--color-mute)]">
              {selectedAssigneeIds.length} selected
            </span>
          </label>

          {/* Trigger Container */}
          <div
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`min-h-[42px] p-2 bg-[var(--color-canvas)] border rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
              isDropdownOpen
                ? "border-[var(--color-ink)] ring-1 ring-[var(--color-ink)]"
                : "border-[var(--color-hairline)] hover:border-[var(--color-mute)]"
            }`}
          >
            <div className="flex flex-wrap items-center gap-1.5 flex-1 pr-2">
              {selectedUsers.length === 0 ? (
                <span className="text-sm text-[var(--color-mute)] px-1">
                  Select employee(s) by name, email, or role...
                </span>
              ) : (
                selectedUsers.map((u) => {
                  const roleProps = getRoleBadgeProps(u.role);
                  return (
                    <span
                      key={u.id}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-[var(--color-link)]/10 text-[var(--color-ink)] border border-[var(--color-link)]/30"
                    >
                      <span className="w-4 h-4 rounded-full bg-[var(--color-link)]/20 text-[var(--color-link)] font-bold flex items-center justify-center text-[10px]">
                        {u.full_name.charAt(0).toUpperCase()}
                      </span>
                      <span>{u.full_name}</span>
                      <Badge variant={roleProps.variant} className="text-[9px] px-1 py-0 h-4">
                        {roleProps.label}
                      </Badge>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAssignee(u.id);
                        }}
                        className="hover:text-rose-500 text-[var(--color-mute)] transition-colors ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  );
                })
              )}
            </div>
            <ChevronDown
              className={`w-4 h-4 text-[var(--color-mute)] shrink-0 transition-transform ${
                isDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </div>

          {/* Searchable Dropdown Popover */}
          {isDropdownOpen && (
            <div className="absolute z-50 left-0 right-0 mt-1 bg-[var(--color-canvas-elevated)] border border-[var(--color-hairline)] rounded-xl shadow-2xl p-3 space-y-2.5 max-h-80 flex flex-col">
              {/* Search Box & Controls */}
              <div className="space-y-2 shrink-0">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--color-mute)]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search employee by name, email, or role..."
                    className="w-full pl-9 pr-8 py-1.5 text-xs bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-lg text-[var(--color-ink)] placeholder-[var(--color-mute)] focus:outline-none focus:border-[var(--color-ink)]"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-2.5 text-[var(--color-mute)] hover:text-[var(--color-ink)]"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Role Filter Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none text-[11px]">
                  {[
                    { id: "all", label: "All Roles" },
                    { id: "admin", label: "Admins" },
                    { id: "manager", label: "Managers" },
                    { id: "engineer", label: "Engineers" },
                    { id: "operator", label: "Operators" },
                    { id: "client", label: "Clients" },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setRoleCategory(tab.id)}
                      className={`px-2 py-0.5 rounded-full whitespace-nowrap transition-colors font-medium ${
                        roleCategory === tab.id
                          ? "bg-[var(--color-ink)] text-[var(--color-canvas)]"
                          : "bg-[var(--color-canvas)] text-[var(--color-mute)] border border-[var(--color-hairline)] hover:text-[var(--color-ink)]"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Quick Action Bar */}
                <div className="flex items-center justify-between text-[11px] text-[var(--color-mute)] pt-1 border-t border-[var(--color-hairline)]">
                  <span>
                    Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> employees
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectAllFiltered(filteredUsers)}
                      className="text-[var(--color-link)] hover:underline font-medium"
                    >
                      Select All Filtered
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      className="text-rose-500 hover:underline font-medium"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>

              {/* Employee Scroll List with Role-Based Badges */}
              <div className="overflow-y-auto flex-1 space-y-1 pr-1 border-t border-[var(--color-hairline)] pt-2">
                {filteredUsers.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[var(--color-mute)]">
                    No matching employees found for "{searchQuery}"
                  </div>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelected = selectedAssigneeIds.includes(u.id);
                    const roleProps = getRoleBadgeProps(u.role);
                    return (
                      <div
                        key={u.id}
                        onClick={() => toggleAssignee(u.id)}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[var(--color-link)]/10 border border-[var(--color-link)]/40"
                            : "hover:bg-[var(--color-canvas)] border border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              isSelected
                                ? "bg-[var(--color-link)] text-white"
                                : "bg-[var(--color-hairline-soft-surface)] text-[var(--color-ink)]"
                            }`}
                          >
                            {u.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-medium text-[var(--color-ink)] truncate">
                                {u.full_name}
                              </p>
                              <Badge variant={roleProps.variant} className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                                {roleProps.label}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-[var(--color-mute)] truncate">
                              {u.email}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isSelected ? (
                            <div className="w-5 h-5 rounded-full bg-[var(--color-link)] text-white flex items-center justify-center">
                              <Check className="w-3.5 h-3.5" />
                            </div>
                          ) : (
                            <div className="w-5 h-5 rounded-full border border-[var(--color-hairline)]" />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
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

