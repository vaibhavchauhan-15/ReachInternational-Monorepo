import { requireRole } from "@/lib/dal";
import { getAttendanceDetailAction } from "@/app/actions/attendance";
import { AttendanceDetailClient } from "./AttendanceDetailClient";

export const metadata = {
  title: "Employee Attendance Detail | ReachInternational",
  description: "Daily attendance breakdown for an individual operator.",
};

interface AttendanceDetailPageProps {
  params: Promise<{ userId: string }>;
  searchParams?: Promise<{ month?: string }>;
}

export default async function AttendanceDetailPage({
  params,
  searchParams,
}: AttendanceDetailPageProps) {
  await requireRole("super_admin", "admin", "hr");

  const { userId } = await params;
  const sp = searchParams ? await searchParams : {};

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;

  if (sp.month && /^\d{4}-\d{2}$/.test(sp.month)) {
    const [y, m] = sp.month.split("-").map(Number);
    year = y;
    month = m;
  }

  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  const data = await getAttendanceDetailAction(userId, year, month);

  return <AttendanceDetailClient data={data} currentMonth={monthStr} />;
}
