import { getCurrentUser } from "@/lib/dal";
import { redirect } from "next/navigation";
import { getTasks, getTaskDashboardStats, getAllEmployeesForAssignment } from "@/lib/queries/tasks";
import { TasksClient } from "@/components/tasks/TasksClient";

export default async function TasksPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const [initialTasks, stats, users] = await Promise.all([
    getTasks(user.id, user.role, user.branch_id),
    getTaskDashboardStats(user.id, user.role, user.branch_id),
    getAllEmployeesForAssignment(),
  ]);

  return (
    <TasksClient
      user={user}
      initialTasks={initialTasks}
      stats={stats}
      users={users}
    />
  );
}
