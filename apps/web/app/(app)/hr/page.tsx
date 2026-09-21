import { requireRole } from "@/lib/dal";
import { getHRPayrollData } from "@/app/actions/hr";
import { HRPayrollClient } from "./HRPayrollClient";

export const metadata = {
  title: "HR Payroll | ReachInternational",
  description: "Operator monthly payroll and overtime compensation calculation module.",
};

interface HRPageProps {
  searchParams?: Promise<{
    month?: string;
  }>;
}

export default async function HRPayrollPage({ searchParams }: HRPageProps) {
  const user = await requireRole("super_admin", "admin", "manager", "hr");
  const params = searchParams ? await searchParams : {};

  // Default to current month YYYY-MM if not provided
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const effectiveMonth = params.month && /^\d{4}-\d{2}$/.test(params.month)
    ? params.month
    : currentMonthStr;

  const payrollData = await getHRPayrollData(`${effectiveMonth}-01`);

  return (
    <HRPayrollClient
      initialData={payrollData}
      currentMonth={effectiveMonth}
      userRole={user.role}
    />
  );
}
