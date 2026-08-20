"use client";

import React, { useState, useMemo } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FilterToolbar } from "@/components/ui/FilterToolbar";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { EnterpriseTable, ColumnDef } from "@/components/ui/EnterpriseTable";
import {
  CheckSquare,
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
} from "lucide-react";
import { CreateTaskModal } from "./CreateTaskModal";
import { TaskDetailDrawer } from "./TaskDetailDrawer";
import { CompleteTaskModal } from "./CompleteTaskModal";
import { VerifyTaskModal } from "./VerifyTaskModal";
import { deleteTask } from "@/app/actions/tasks";
import type { Task, TaskStats, User as UserType } from "@servicecentric/types";

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
      id: "title",
      header: "Task No / Title",
      cell: (task) => (
        <div
          onClick={() => handleOpenDetail(task)}
          className="cursor-pointer hover:underline"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-[var(--color-link)]">#{task.task_no}</span>
            <span className="text-xs font-bold text-[var(--color-ink)]">{task.title}</span>
          </div>
          {task.description && (
            <p className="text-[11px] text-[var(--color-mute)] truncate max-w-sm">{task.description}</p>
          )}
        </div>
      ),
    },
    {
      id: "priority",
      header: "Priority",
      cell: (task) => (
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
          {task.priority}
        </span>
      ),
    },
    {
      id: "assignees",
      header: "Assigned To",
      cell: (task) => {
        const assignees = task.assignees || [];
        if (assignees.length === 0) return <span className="text-xs text-[var(--color-mute)]">Unassigned</span>;
        return (
          <div className="flex items-center -space-x-1.5 overflow-hidden">
            {assignees.slice(0, 3).map((a) => (
              <div
                key={a.id}
                title={a.user?.full_name}
                className="w-6 h-6 rounded-full bg-[var(--color-link)]/20 border border-[var(--color-hairline)] flex items-center justify-center text-[10px] font-bold text-[var(--color-link)]"
              >
                {a.user?.full_name?.charAt(0) || "U"}
              </div>
            ))}
            {assignees.length > 3 && (
              <span className="text-[10px] text-[var(--color-mute)] pl-2">+{assignees.length - 3}</span>
            )}
          </div>
        );
      },
    },
    {
      id: "due_date",
      header: "Due Date",
      cell: (task) => {
        const isOverdue = task.due_date < new Date().toISOString().split("T")[0] && task.status !== "completed";
        return (
          <div className="text-xs">
            <span className={isOverdue ? "text-rose-500 font-bold" : "text-[var(--color-body)]"}>
              {task.due_date} {task.due_time ? `@ ${task.due_time}` : ""}
            </span>
            {isOverdue && <span className="block text-[10px] text-rose-500 font-medium">Overdue</span>}
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      cell: (task) => <Badge variant={task.status === "completed" ? "success" : task.status === "overdue" ? "error" : "info"}>{task.status.replace(/_/g, " ")}</Badge>,
    },
    {
      id: "actions",
      header: "Actions",
      cell: (task) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => handleOpenDetail(task)}
            className="p-1 rounded text-[var(--color-mute)] hover:text-[var(--color-link)] hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
            title="View Task Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {isManager && (
            <button
              onClick={() => handleOpenEdit(task)}
              className="p-1 rounded text-[var(--color-mute)] hover:text-emerald-500 hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
              title="Edit Task"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
          )}
          {(task.status === "pending" || task.status === "in_progress" || task.status === "reopened") && (
            <Button
              variant="secondary"
              onClick={() => handleOpenComplete(task)}
              className="text-[11px] h-7 px-2 py-0"
            >
              Complete
            </Button>
          )}
          {isManager && task.status === "completed" && (
            <Button
              variant="primary"
              onClick={() => handleOpenVerify(task)}
              className="text-[11px] h-7 px-2 py-0"
            >
              Verify
            </Button>
          )}
          {isManager && (
            <button
              onClick={() => handleDelete(task.id)}
              className="p-1 rounded text-[var(--color-mute)] hover:text-rose-500 hover:bg-[var(--color-hairline-soft-surface)] transition-colors cursor-pointer"
              title="Delete Task"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="To-Do & Task Management"
        description="Boss-to-employee task assignment, daily workload tracking, completion verification, & discussions"
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
          <div className="flex items-center gap-1 p-1 bg-[var(--color-canvas-elevated)] rounded-lg border border-[var(--color-hairline)] shrink-0">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === "list"
                  ? "bg-[var(--color-canvas)] text-[var(--color-ink)] shadow-xs border border-[var(--color-hairline)] font-bold"
                  : "text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              }`}
              title="List View"
            >
              <LayoutList className="w-3.5 h-3.5" /> List
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`p-1.5 rounded text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer ${
                viewMode === "kanban"
                  ? "bg-[var(--color-canvas)] text-[var(--color-ink)] shadow-xs border border-[var(--color-hairline)] font-bold"
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
        <Card className="p-0 border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] overflow-hidden">
          <EnterpriseTable
            data={filteredTasks}
            columns={columns}
          />
        </Card>
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
              <div key={col.status} className={`bg-[var(--color-canvas-elevated)] p-3 rounded-xl border ${col.color} space-y-3`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink)]">{col.title}</h3>
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-[var(--color-canvas)] text-[var(--color-body)] border border-[var(--color-hairline)]">
                    {colTasks.length}
                  </span>
                </div>

                <div className="space-y-2.5 max-h-[600px] overflow-y-auto pr-1">
                  {colTasks.map((t) => (
                    <Card
                      key={t.id}
                      onClick={() => handleOpenDetail(t)}
                      className="p-3 bg-[var(--color-canvas)] border-[var(--color-hairline)] hover:border-[var(--color-link)]/40 cursor-pointer space-y-2"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono text-[var(--color-link)] font-bold">#{t.task_no}</span>
                        <span className="font-bold text-[var(--color-mute)] uppercase">{t.priority}</span>
                      </div>
                      <h4 className="text-xs font-bold text-[var(--color-ink)]">{t.title}</h4>
                      <div className="flex items-center justify-between text-[11px] text-[var(--color-mute)] pt-1 border-t border-[var(--color-hairline)]">
                        <span>Due: {t.due_date}</span>
                        <span className="text-[var(--color-emerald)] font-medium">{(t.assignees || []).length} assigned</span>
                      </div>
                    </Card>
                  ))}
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
