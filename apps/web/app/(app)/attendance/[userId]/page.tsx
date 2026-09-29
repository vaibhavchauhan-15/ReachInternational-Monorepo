import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireRole } from "@/lib/dal";
import { resolveUserId, getUserById } from "@/lib/data/users";
import { getAttendanceDetailAction } from "@/app/actions/attendance";
import { EmptyState } from "@/components/ui";
import { AttendanceDetailClient } from "./AttendanceDetailClient";

interface AttendanceDetailPageProps {
  params: Promise<{ userId: string }>;
  searchParams?: Promise<{ month?: string }>;
}

export async function generateMetadata(props: AttendanceDetailPageProps): Promise<Metadata> {
  const { userId: rawUserId } = await props.params;
  const canonicalId = await resolveUserId(decodeURIComponent(rawUserId));
  if (!canonicalId) {
    return {
      title: "Employee Not Found | ReachInternational Attendance",
    };
  }

  const user = await getUserById(canonicalId);
  const empCode = user?.employee_id || user?.id.slice(0, 8) || "";
  const name = user?.full_name || "Employee";

  return {
    title: `${name} (${empCode}) | Attendance Detail | ReachInternational`,
    description: `Daily attendance breakdown, punch timings, and machine telemetry logs for ${name}.`,
  };
}

export default async function AttendanceDetailPage({
  params,
  searchParams,
}: AttendanceDetailPageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  const { userId: rawUserId } = await params;
  const sp = searchParams ? await searchParams : {};

  const canonicalUserId = await resolveUserId(decodeURIComponent(rawUserId));
  const normalizedRole = (currentUser.role || "").toLowerCase().trim();

  // Strict RBAC:
  // If the user is an operator, they are strictly allowed to see ONLY their own attendance!
  if (normalizedRole === "operator") {
    if (!canonicalUserId || canonicalUserId.toLowerCase() !== currentUser.id.toLowerCase()) {
      // Operator tried to access someone else's attendance or invalid ID -> Redirect to their own attendance hub!
      const monthQuery = sp.month ? `?month=${sp.month}` : "";
      redirect(`/attendance${monthQuery}`);
    }
  } else {
    // Non-operators must be super_admin, admin, hr, manager, or supervisor
    await requireRole("super_admin", "admin", "hr", "manager", "supervisor");
  }

  if (!canonicalUserId) {
    return (
      <div className="py-16 max-w-xl mx-auto px-4">
        <EmptyState
          title="Employee Not Found"
          description="The requested employee could not be found, has been removed, or you do not have permission to view their attendance."
          action={
            <Link
              href="/attendance"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm bg-[var(--color-ink)] text-[var(--color-on-primary)] text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Back to Attendance
            </Link>
          }
        />
      </div>
    );
  }

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + 1;

  if (sp.month && /^\d{4}-\d{2}$/.test(sp.month)) {
    const [y, m] = sp.month.split("-").map(Number);
    year = y;
    month = m;
  }

  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  const data = await getAttendanceDetailAction(canonicalUserId, year, month);

  return (
    <AttendanceDetailClient
      data={data}
      currentMonth={monthStr}
      userRole={currentUser.role}
      isSelf={currentUser.id === canonicalUserId}
    />
  );
}

