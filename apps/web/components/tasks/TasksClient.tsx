"use client";

import React, { useState, useMemo } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FilterToolbar } from "@/components/ui/FilterToolbar";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { EnterpriseTable, ColumnDef } from "@/components/ui/EnterpriseTable";
import { TooltipWrapper } from "@/components/ui/tooltip";
import { formatDisplayDate } from "@reachinternational/utils";
import {
  CheckSquare,
  Square,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Calendar as CalendarIcon,
  Plus,
  SlidersHorizontal,
  LayoutList,
  Kanban,
  UserCheck,
  Edit,
  Eye,
  Trash2,
  Camera,
} from "lucide-react";
import { CreateTaskModal } from "./CreateTaskModal";
import { TaskDetailDrawer } from "./TaskDetailDrawer";
import { CompleteTaskModal } from "./CompleteTaskModal";
import { VerifyTaskModal } from "./VerifyTaskModal";
import { deleteTask } from "@/app/actions/tasks";
import type { Task, TaskStats, User as UserType } from "@reachinternational/types";

interface TasksClientProps {
  user: UserType;
  initialTasks: Task[];
  stats: TaskStats;
  users: Pick<UserType, "id" | "full_name" | "email" | "role">[];
}

export function TasksClient({ user, initialTasks, stats, users }: TasksClientProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [viewScope, setViewScope] = useState<"all" | "my_tasks" | "assigned_to_me">("all");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");

  // Active Filter Count calculation for FilterToolbar
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (viewScope !== "all") count++;
    if (statusFilter !== "all") count++;
    if (priorityFilter !== "all") count++;
    if (assigneeFilter !== "all") count++;
    return count;
  }, [viewScope, statusFilter, priorityFilter, assigneeFilter]);

  // Modals / Drawer controls
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<Task | null>(null);

  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [selectedTaskForComplete, setSelectedTaskForComplete] = useState<Task | null>(null);
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);

  const [selectedTaskForVerify, setSelectedTaskForVerify] = useState<Task | null>(null);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);

  const isManager = [
    "super_admin", "admin", "service_manager", "branch_manager",
    "supervisor", "hr_manager", "rental_manager", "sales_manager",
    "finance_manager", "store_manager"
  ].includes(user.role);

  // Filter Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Scope filter
      if (viewScope === "my_tasks" && t.created_by !== user.id) return false;
      if (viewScope === "assigned_to_me" && !(t.assignees || []).some((a) => a.user_id === user.id)) return false;

      // Filter toolbar
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (assigneeFilter !== "all" && !(t.assignees || []).some((a) => a.user_id === assigneeFilter)) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = t.title.toLowerCase().includes(q);
        const matchDesc = t.description?.toLowerCase().includes(q);
        const matchCode = t.task_no.toLowerCase().includes(q);
        const matchAssignee = (t.assignees || []).some((a) => a.user?.full_name?.toLowerCase().includes(q));
        if (!matchTitle && !matchDesc && !matchCode && !matchAssignee) return false;
      }

      return true;
    });
  }, [tasks, viewScope, statusFilter, priorityFilter, assigneeFilter, searchQuery, user.id]);

  const handleOpenDetail = (task: Task) => {
    setSelectedTaskForDetail(task);
    setIsDetailOpen(true);
  };

  const handleOpenEdit = (task: Task) => {
    setSelectedTaskForEdit(task);
    setIsCreateOpen(true);
  };

  const handleOpenComplete = (task: Task) => {
    setSelectedTaskForComplete(task);
    setIsCompleteOpen(true);
  };

  const handleOpenVerify = (task: Task) => {
    setSelectedTaskForVerify(task);
    setIsVerifyOpen(true);
  };

  const handleDelete = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    const res = await deleteTask(taskId);
    if (res.success) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    }
  };

  const resetFilters = () => {
    setSearchQuery("");
    setViewScope("all");
    setStatusFilter("all");
    setPriorityFilter("all");
    setAssigneeFilter("all");
  };

  const columns: ColumnDef<Task>[] = [
    {
      id: "task_no",
      header: "Task No.",
      width: "110px",
      cell: (task) => (
        <div onClick={() => handleOpenDetail(task)} className="cursor-pointer">
          <span className="text-xs font-mono font-bold text-[var(--color-link)] bg-[var(--color-link)]/10 px-2 py-0.5 rounded-full border border-[var(--color-link)]/20 hover:bg-[var(--color-link)]/20 transition-colors inline-block">
            #{task.task_no}
          </span>
        </div>
      ),
    },
    {
      id: "title",
      header: "Title & Instructions",
      width: "300px",
      cell: (task) => (
        <div
          onClick={() => handleOpenDetail(task)}
          className="cursor-pointer space-y-0.5 group"
        >
          <span className="text-xs font-bold text-[var(--color-ink)] group-hover:text-[var(--color-link)] transition-colors block leading-tight">
            {task.title}
          </span>
          {task.description && (
            <p className="text-[11px] text-[var(--color-mute)] truncate max-w-xs">{task.description}</p>
          )}
        </div>
      ),
    },
    {
      id: "priority",
      header: "Priority",
      width: "110px",
      cell: (task) => (
        <span
          className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border inline-block ${
            task.priority === "critical"
              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
              : task.priority === "high"
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
              : task.priority === "medium"
              ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          }`}
        >
          {task.priority}
        </span>
      ),
    },
    {
      id: "assignees",
      header: "Assigned Employee",
      width: "220px",
      cell: (task) => {
        const assignees = task.assignees || [];
        if (assignees.length === 0) {
          return <span className="text-xs text-[var(--color-mute)] italic">Unassigned</span>;
        }
        return (
          <div className="flex flex-col gap-1.5">
            {assignees.map((a) => {
              const fullName = a.user?.full_name || "Unknown User";
              const rawRole = a.user?.role || "";
              const formattedRole = rawRole
                ? rawRole
                    .split("_")
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(" ")
                : "";

              return (
                <div key={a.id} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-[var(--color-link)]/15 border border-[var(--color-hairline)] flex items-center justify-center text-[10px] font-bold text-[var(--color-link)] shrink-0">
                    {fullName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0 leading-tight">
                    <span className="font-semibold text-[var(--color-ink)] text-xs truncate max-w-[170px]">{fullName}</span>
                    {formattedRole && (
                      <span className="text-[10px] text-[var(--color-mute)] font-medium truncate max-w-[170px]">
                        {formattedRole}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      },
    },
    {
      id: "due_date",
      header: "Due Date",
      width: "140px",
      cell: (task) => {
        const isOverdue = task.due_date < new Date().toISOString().split("T")[0] && task.status !== "completed";
        return (
          <div className="text-xs">
            <span className={isOverdue ? "text-rose-500 font-bold" : "text-[var(--color-body)]"}>
              {formatDisplayDate(task.due_date)} {task.due_time ? `@ ${task.due_time}` : ""}
            </span>
            {isOverdue && <span className="block text-[10px] text-rose-500 font-medium">Overdue</span>}
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      width: "120px",
      cell: (task) => <Badge variant={task.status === "completed" ? "success" : task.status === "overdue" ? "error" : "info"}>{task.status.replace(/_/g, " ")}</Badge>,
    },
    {
      id: "actions",
      header: "Actions",
      width: "140px",
      cell: (task) => {
        const hasAttachments = (task.attachments || []).length > 0;
        return (
          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            <TooltipWrapper content="View Task Details" side="top">
              <button
                onClick={() => handleOpenDetail(task)}
                className="p-1 rounded text-[var(--color-mute)] hover:text-[var(--color-link)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
                aria-label="View Task Details"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
            </TooltipWrapper>
            {isManager && (
              <TooltipWrapper content="Edit Task" side="top">
                <button
                  onClick={() => handleOpenEdit(task)}
                  className="p-1 rounded text-[var(--color-mute)] hover:text-emerald-500 hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
                  aria-label="Edit Task"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
              </TooltipWrapper>
            )}
            {(task.status === "pending" || task.status === "in_progress" || task.status === "reopened") && (
              <TooltipWrapper content="Mark Task Complete" side="top">
                <button
                  onClick={() => handleOpenComplete(task)}
                  className="p-1 rounded-md border border-[var(--color-hairline)] hover:border-emerald-500 hover:bg-emerald-500/15 text-[var(--color-mute)] hover:text-emerald-500 transition-colors cursor-pointer flex items-center justify-center"
                  aria-label="Mark Task Complete"
                >
                  <Square className="w-4 h-4" />
                </button>
              </TooltipWrapper>
            )}
            {task.status === "completed" && (
              <TooltipWrapper content={hasAttachments ? "Completed with Uploaded Proof Photo" : "Completed"} side="top">
                <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center gap-1">
                  <CheckSquare className="w-4 h-4" />
                  {hasAttachments && <Camera className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />}
                </div>
              </TooltipWrapper>
            )}
            {isManager && task.status === "completed" && (
              <TooltipWrapper content="Verify Task & Review Uploaded Proof Image" side="top">
                <Button
                  variant="primary"
                  onClick={() => handleOpenVerify(task)}
                  className="text-[11px] h-7 px-2.5 py-0 ml-1 flex items-center gap-1 shrink-0"
                >
                  <Camera className="w-3 h-3" /> Verify
                </Button>
              </TooltipWrapper>
            )}
            {isManager && (
              <TooltipWrapper content="Delete Task" side="top">
                <button
                  onClick={() => handleDelete(task.id)}
                  className="p-1 rounded text-[var(--color-mute)] hover:text-rose-500 hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
                  aria-label="Delete Task"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </TooltipWrapper>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="To-Do & Task Management"
        actions={
          <Button variant="primary" onClick={() => { setSelectedTaskForEdit(null); setIsCreateOpen(true); }}>
            <Plus className="w-4 h-4 mr-1.5" /> Create To-Do / Task
          </Button>
        }
      />

      {/* Executive KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <Card className="p-3 border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <CheckSquare className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-[var(--color-mute)]">Total Tasks</p>
            <p className="text-lg font-bold text-[var(--color-ink)] tabular-nums">{stats.totalTasks}</p>
          </div>
        </Card>

        <Card className="p-3 border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-[var(--color-mute)]">Pending</p>
            <p className="text-lg font-bold text-amber-500 tabular-nums">{stats.pending}</p>
          </div>
        </Card>

        <Card className="p-3 border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-[var(--color-mute)]">In Progress</p>
            <p className="text-lg font-bold text-sky-500 tabular-nums">{stats.inProgress}</p>
          </div>
        </Card>

        <Card className="p-3 border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-[var(--color-mute)]">Completed</p>
            <p className="text-lg font-bold text-emerald-500 tabular-nums">{stats.completed}</p>
          </div>
        </Card>

        <Card className="p-3 border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-[var(--color-mute)]">Overdue</p>
            <p className="text-lg font-bold text-rose-500 tabular-nums">{stats.overdue}</p>
          </div>
        </Card>

        <Card className="p-3 border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-[var(--color-mute)]">Due Today</p>
            <p className="text-lg font-bold text-purple-500 tabular-nums">{stats.dueToday}</p>
          </div>
        </Card>

        <Card className="p-3 border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-[var(--color-mute)]">Completion %</p>
            <p className="text-lg font-bold text-[var(--color-ink)] tabular-nums">{stats.completionRate}%</p>
          </div>
        </Card>
      </div>

      {/* Reusable Filter Toolbar with View Switcher Actions */}
      <FilterToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search tasks by title, description, or assigned employee..."
        activeFilterCount={activeFilterCount}
        onResetFilters={resetFilters}
        actions={
          <div className="flex items-center gap-1 p-1 bg-[var(--color-canvas-elevated)] rounded-full border border-[var(--color-hairline)] shrink-0">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "list"
                  ? "bg-[var(--color-canvas)] text-[var(--color-ink)] shadow-xs border border-[var(--color-hairline)]"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
              title="List View"
            >
              <LayoutList className="w-3.5 h-3.5" /> List
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === "kanban"
                  ? "bg-[var(--color-canvas)] text-[var(--color-ink)] shadow-xs border border-[var(--color-hairline)]"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
              title="Kanban View"
            >
              <Kanban className="w-3.5 h-3.5" /> Kanban
            </button>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Scope Filter */}
          <SearchableSelect
            options={[
              { value: "all", label: "All Scope Tasks" },
              { value: "my_tasks", label: "My Created Tasks" },
              { value: "assigned_to_me", label: "Assigned to Me" },
            ]}
            value={viewScope}
            onChange={(val) => setViewScope(val as any)}
            placeholder="Filter Scope"
          />

          {/* Status Filter */}
          <SearchableSelect
            options={[
              { value: "all", label: "All Statuses" },
              { value: "pending", label: "Pending" },
              { value: "in_progress", label: "In Progress" },
              { value: "completed", label: "Completed" },
              { value: "overdue", label: "Overdue" },
              { value: "reopened", label: "Reopened" },
            ]}
            value={statusFilter}
            onChange={setStatusFilter}
            placeholder="Filter Status"
          />

          {/* Priority Filter */}
          <SearchableSelect
            options={[
              { value: "all", label: "All Priorities" },
              { value: "low", label: "Low Priority" },
              { value: "medium", label: "Medium Priority" },
              { value: "high", label: "High Priority" },
              { value: "critical", label: "Critical Priority" },
            ]}
            value={priorityFilter}
            onChange={setPriorityFilter}
            placeholder="Filter Priority"
          />

          {/* Assignee Filter */}
          <SearchableSelect
            options={[
              { value: "all", label: "All Employees" },
              ...users.map((u) => ({ value: u.id, label: `${u.full_name} (${u.role.replace(/_/g, " ")})` })),
            ]}
            value={assigneeFilter}
            onChange={setAssigneeFilter}
            placeholder="Filter Employee"
          />
        </div>
      </FilterToolbar>

      {/* Main View Display */}
      {viewMode === "list" && (
        <>
          {/* Desktop Enterprise Data Table */}
          <div className="hidden sm:block">
            <EnterpriseTable
              data={filteredTasks}
              columns={columns}
              onRowClick={(task) => handleOpenDetail(task)}
              emptyMessage="No tasks found"
              emptyDescription="There are no tasks matching your selected filters."
            />
          </div>

          {/* Mobile Touch Card View */}
          <div className="block sm:hidden space-y-3">
            {filteredTasks.length === 0 ? (
              <Card className="p-6 text-center text-xs text-[var(--color-mute)]">
                No tasks match your active filters.
              </Card>
            ) : (
              filteredTasks.map((task) => {
                const assignees = task.assignees || [];
                const isOverdue = task.due_date < new Date().toISOString().split("T")[0] && task.status !== "completed";
                const hasAttachments = (task.attachments || []).length > 0;

                return (
                  <Card
                    key={task.id}
                    onClick={() => handleOpenDetail(task)}
                    className="p-4 bg-[var(--color-canvas-elevated)] border-[var(--color-hairline)] space-y-3 cursor-pointer hover:border-[var(--color-link)]/40 transition-all shadow-xs"
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-[var(--color-link)] bg-[var(--color-link)]/10 px-2 py-0.5 rounded-full border border-[var(--color-link)]/20">
                        #{task.task_no}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                            task.priority === "critical"
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                              : task.priority === "high"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              : task.priority === "medium"
                              ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                              : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                          }`}
                        >
                          {task.priority}
                        </span>
                        <Badge variant={task.status === "completed" ? "success" : task.status === "overdue" ? "error" : "info"}>
                          {task.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </div>

                    {/* Title & Description */}
                    <div>
                      <h4 className="text-sm font-bold text-[var(--color-ink)] leading-snug">{task.title}</h4>
                      {task.description && (
                        <p className="text-xs text-[var(--color-mute)] line-clamp-2 mt-0.5">{task.description}</p>
                      )}
                    </div>

                    {/* Assigned Employee */}
                    {assignees.length > 0 && (
                      <div className="flex items-center gap-2 pt-1">
                        <div className="w-6 h-6 rounded-full bg-[var(--color-link)]/15 border border-[var(--color-hairline)] flex items-center justify-center text-[10px] font-bold text-[var(--color-link)] shrink-0">
                          {assignees[0].user?.full_name?.charAt(0).toUpperCase() || "U"}
                        </div>
                        <span className="text-xs font-semibold text-[var(--color-ink)] truncate">
                          {assignees[0].user?.full_name}
                        </span>
                        {assignees.length > 1 && (
                          <span className="text-[10px] text-[var(--color-mute)] font-medium">
                            +{assignees.length - 1} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* Footer Row with Due Date & Action Buttons */}
                    <div className="flex items-center justify-between pt-2 border-t border-[var(--color-hairline)] text-xs">
                      <div className="flex items-center gap-1">
                        <span className={isOverdue ? "text-rose-500 font-bold" : "text-[var(--color-body)]"}>
                          Due: {formatDisplayDate(task.due_date)}
                        </span>
                        {isOverdue && <span className="text-[10px] text-rose-500 font-bold ml-1">Overdue</span>}
                      </div>

                      {/* Action Triggers */}
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {(task.status === "pending" || task.status === "in_progress" || task.status === "reopened") && (
                          <button
                            onClick={() => handleOpenComplete(task)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px] border border-emerald-500/20 active:scale-95 transition-all"
                          >
                            Complete
                          </button>
                        )}
                        {isManager && task.status === "completed" && (
                          <button
                            onClick={() => handleOpenVerify(task)}
                            className="px-2.5 py-1 rounded-lg bg-sky-600 text-white font-semibold text-[11px] flex items-center gap-1 active:scale-95 transition-all"
                          >
                            <Camera className="w-3 h-3" /> Verify
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </>
      )}

      {/* Kanban Board View */}
      {viewMode === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { status: "pending", title: "Pending", color: "border-amber-500/40" },
            { status: "in_progress", title: "In Progress", color: "border-sky-500/40" },
            { status: "completed", title: "Completed", color: "border-emerald-500/40" },
            { status: "overdue", title: "Overdue", color: "border-rose-500/40" },
          ].map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.status);
            return (
              <div key={col.status} className={`bg-[var(--color-canvas-elevated)] p-3.5 rounded-xl border ${col.color} space-y-3 shadow-xs`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">{col.title}</h3>
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-[var(--color-canvas)] text-[var(--color-body)] border border-[var(--color-hairline)]">
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                  {colTasks.map((t) => {
                    const assignees = t.assignees || [];
                    const isOverdue = t.due_date < new Date().toISOString().split("T")[0] && t.status !== "completed";

                    return (
                      <Card
                        key={t.id}
                        onClick={() => handleOpenDetail(t)}
                        className="p-3.5 bg-[var(--color-canvas)] border-[var(--color-hairline)] hover:border-[var(--color-link)]/40 hover:shadow-sm cursor-pointer space-y-2.5 transition-all"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-mono text-[var(--color-link)] font-bold bg-[var(--color-link)]/10 px-2 py-0.5 rounded-full border border-[var(--color-link)]/20">#{t.task_no}</span>
                          <span
                            className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                              t.priority === "critical"
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                : t.priority === "high"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                : t.priority === "medium"
                                ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            }`}
                          >
                            {t.priority}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-[var(--color-ink)] leading-snug">{t.title}</h4>

                        {/* Assigned Employee Details */}
                        {assignees.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            {assignees.slice(0, 2).map((a) => {
                              const fullName = a.user?.full_name || "Unknown";
                              const rawRole = a.user?.role || "";
                              const formattedRole = rawRole
                                ? rawRole
                                    .split("_")
                                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                                    .join(" ")
                                : "";

                              return (
                                <div key={a.id} className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-[var(--color-link)]/15 border border-[var(--color-hairline)] flex items-center justify-center text-[9px] font-bold text-[var(--color-link)] shrink-0">
                                    {fullName.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex flex-col min-w-0 leading-tight">
                                    <span className="font-semibold text-[var(--color-ink)] text-[11px] truncate max-w-[170px]">{fullName}</span>
                                    {formattedRole && (
                                      <span className="text-[10px] text-[var(--color-mute)] font-medium truncate max-w-[170px]">
                                        {formattedRole}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                            {assignees.length > 2 && (
                              <p className="text-[10px] text-[var(--color-mute)] italic pl-5">+{assignees.length - 2} more assignees</p>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-[var(--color-mute)] pt-2 border-t border-[var(--color-hairline)]">
                          <span className={isOverdue ? "text-rose-500 font-bold" : "text-[var(--color-body)]"}>
                            Due: {formatDisplayDate(t.due_date)}
                          </span>
                          <span className="text-[var(--color-link)] font-semibold text-[10px]">
                            {t.comments?.length ? `${t.comments.length} comments` : "View details"}
                          </span>
                        </div>
                      </Card>
                    );
                  })}
                  {colTasks.length === 0 && (
                    <p className="text-xs text-[var(--color-mute)] italic text-center py-4">No tasks</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      <CreateTaskModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        users={users}
        initialTask={selectedTaskForEdit}
        onSuccess={() => window.location.reload()}
      />

      {/* Task Detail Drawer */}
      <TaskDetailDrawer
        task={selectedTaskForDetail}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        currentUser={user}
        onOpenEdit={(t) => { setIsDetailOpen(false); handleOpenEdit(t); }}
        onOpenComplete={(t) => { setIsDetailOpen(false); handleOpenComplete(t); }}
        onOpenVerify={(t) => { setIsDetailOpen(false); handleOpenVerify(t); }}
      />

      {/* Complete Modal */}
      {selectedTaskForComplete && (
        <CompleteTaskModal
          isOpen={isCompleteOpen}
          onClose={() => setIsCompleteOpen(false)}
          task={selectedTaskForComplete}
          onSuccess={() => window.location.reload()}
        />
      )}

      {/* Verify Modal */}
      {selectedTaskForVerify && (
        <VerifyTaskModal
          isOpen={isVerifyOpen}
          onClose={() => setIsVerifyOpen(false)}
          task={selectedTaskForVerify}
          onSuccess={() => window.location.reload()}
        />
      )}
    </div>
  );
}

