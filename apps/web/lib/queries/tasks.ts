import "server-only";
import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Task, TaskFilterParams, TaskStats, User } from "@reachinternational/types";

export const getTasks = cache(async (
  userId: string,
  userRole: string,
  branchId: string | null,
  params: TaskFilterParams = {}
): Promise<Task[]> => {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("tasks")
    .select(`
      *,
      creator:users!tasks_created_by_fkey(id, full_name, email, role),
      completer:users!tasks_completed_by_fkey(id, full_name, role),
      verifier:users!tasks_verified_by_fkey(id, full_name, role),
      assignees:task_assignees(
        id, task_id, user_id, assigned_at, assigned_by,
        user:users!task_assignees_user_id_fkey(id, full_name, email, role)
      ),
      attachments:task_attachments(id, task_id, file_name, file_url, file_type, uploaded_by, created_at),
      comments:task_comments(id, task_id, user_id, comment, parent_id, created_at, updated_at, user:users!task_comments_user_id_fkey(id, full_name, role))
    `);

  // Role scoping: Employees only see tasks created by them or assigned to them
  const isManager = [
    "super_admin", "admin", "service_manager", "branch_manager",
    "supervisor", "hr_manager", "rental_manager", "sales_manager",
    "finance_manager", "store_manager"
  ].includes(userRole);

  if (!isManager) {
    query = query.or(`created_by.eq.${userId}`);
  }

  // Filter tabs
  if (params.tab === "my_tasks") {
    query = query.eq("created_by", userId);
  } else if (params.tab === "assigned_to_me") {
    // Handled via client filter or assignees join
  } else if (params.tab === "completed") {
    query = query.eq("status", "completed");
  } else if (params.tab === "pending") {
    query = query.eq("status", "pending");
  } else if (params.tab === "in_progress") {
    query = query.eq("status", "in_progress");
  } else if (params.tab === "overdue") {
    query = query.or(`status.eq.overdue,and(due_date.lt.${new Date().toISOString().split('T')[0]},status.in.(pending,in_progress))`);
  }

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  if (params.priority && params.priority !== "all") {
    query = query.eq("priority", params.priority);
  }

  if (params.dueDate) {
    query = query.eq("due_date", params.dueDate);
  }

  const sortBy = params.sortBy || "due_date";
  const sortOrder = params.sortOrder || "asc";
  query = query.order(sortBy, { ascending: sortOrder === "asc" });

  const { data, error } = await query;
  if (error) {
    console.error("[DAL] Error fetching tasks:", error);
    return [];
  }

  let tasks = (data || []) as Task[];

  // Post-filter tab "assigned_to_me" if specified
  if (params.tab === "assigned_to_me") {
    tasks = tasks.filter((t) => (t.assignees || []).some((a) => a.user_id === userId));
  }

  // Search filter (title or assignee name)
  if (params.search && params.search.trim() !== "") {
    const term = params.search.toLowerCase().trim();
    tasks = tasks.filter((t) => 
      t.title.toLowerCase().includes(term) ||
      (t.description && t.description.toLowerCase().includes(term)) ||
      (t.assignees || []).some((a) => a.user?.full_name?.toLowerCase().includes(term))
    );
  }

  return tasks;
});

export const getTaskById = cache(async (taskId: string): Promise<Task | null> => {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      creator:users!tasks_created_by_fkey(id, full_name, email, role),
      completer:users!tasks_completed_by_fkey(id, full_name, role),
      verifier:users!tasks_verified_by_fkey(id, full_name, role),
      assignees:task_assignees(
        id, task_id, user_id, assigned_at, assigned_by,
        user:users!task_assignees_user_id_fkey(id, full_name, email, role)
      ),
      attachments:task_attachments(id, task_id, file_name, file_url, file_type, uploaded_by, created_at),
      comments:task_comments(id, task_id, user_id, comment, parent_id, created_at, updated_at, user:users!task_comments_user_id_fkey(id, full_name, role)),
      activity_logs:task_activity_logs(id, task_id, actor_id, action, details, created_at, actor:users!task_activity_logs_actor_id_fkey(id, full_name, role))
    `)
    .eq("id", taskId)
    .single();

  if (error || !data) {
    console.error("[DAL] Error fetching task by ID:", error);
    return null;
  }

  return data as Task;
});

export const getTaskDashboardStats = cache(async (
  userId: string,
  userRole: string,
  branchId: string | null
): Promise<TaskStats> => {
  const tasks = await getTasks(userId, userRole, branchId);
  const todayStr = new Date().toISOString().split("T")[0];

  const totalTasks = tasks.length;
  const pending = tasks.filter((t) => t.status === "pending").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const completed = tasks.filter((t) => t.status === "completed").length;
  const overdue = tasks.filter((t) => t.status === "overdue" || (t.due_date < todayStr && (t.status === "pending" || t.status === "in_progress"))).length;
  const dueToday = tasks.filter((t) => t.due_date === todayStr).length;
  const highPriority = tasks.filter((t) => t.priority === "high" || t.priority === "critical").length;
  const completionRate = totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0;

  return {
    totalTasks,
    pending,
    inProgress,
    completed,
    overdue,
    dueToday,
    highPriority,
    completionRate,
  };
});

export const getAllEmployeesForAssignment = cache(async (): Promise<Pick<User, "id" | "full_name" | "email" | "role">[]> => {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, role")
    .order("full_name", { ascending: true });

  if (error) {
    console.error("[DAL] Error fetching employees for assignment:", error);
    return [];
  }

  return data || [];
});
