import { redirect } from "next/navigation";
import { requireRole, getCurrentUser } from "@/lib/dal";
import { getAttendanceSummaryAction, getAttendanceDetailAction } from "@/app/actions/attendance";
import { AttendanceClient } from "./AttendanceClient";
import { AttendanceDetailClient } from "./[userId]/AttendanceDetailClient";

export const metadata = {
  title: "Attendance | ReachInternational",
  description: "Monthly operator attendance tracking derived from machine operation logs.",
};

interface AttendancePageProps {
  searchParams?: Promise<{
    month?: string;
    page?: string;
    status?: string;
    search?: string;
    overtime?: string;
    state?: string;
    sortBy?: string;
  }>;
}

export default async function AttendancePage({ searchParams }: AttendancePageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const params = searchParams ? await searchParams : {};
  const normalizedRole = (user.role || "").toLowerCase().trim();

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Parse month param: "2026-09" → { year: 2026, month: 9 }
  let year = currentYear;
  let month = currentMonth;
  if (params.month && /^\d{4}-\d{2}$/.test(params.month)) {
    const [y, m] = params.month.split("-").map(Number);
    year = y;
    month = m;
  }
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;

  // Strict RBAC & Zero-Redirect Self Rendering:
  // Operators can STRICTLY ONLY view their own attendance record.
  // Directly render AttendanceDetailClient for the operator right on /attendance.
  // This eliminates redirect chains, avoids router bounces to /dashboard,
  // and keeps the Attendance sidebar nav link active.
  if (normalizedRole === "operator") {
    const initialData = await getAttendanceDetailAction(user.id, year, month);
    return (
      <AttendanceDetailClient
        data={initialData}
        currentMonth={monthStr}
        userRole={user.role}
        isSelf={true}
      />
    );
  }

  // Management roles: super_admin, admin, hr, manager, supervisor
  await requireRole("super_admin", "admin", "hr", "manager", "supervisor");

  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);

  const initialData = await getAttendanceSummaryAction(year, month, {
    status: params.status || null,
    search: params.search || null,
    overtime: params.overtime || null,
    state: params.state || null,
    sortBy: params.sortBy || null,
    page,
    pageSize: 25,
  });

  return (
    <AttendanceClient
      initialData={initialData}
      currentMonth={monthStr}
      currentPage={page}
      userRole={user.role}
    />
  );
}
