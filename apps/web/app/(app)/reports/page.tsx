import { getCurrentUser, protectDisabledRoute } from "@/lib/dal";
import { redirect } from "next/navigation";
import { ReportsClient } from "@/components/reports/ReportsClient";

export default async function ReportsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  protectDisabledRoute(user.role);

  return <ReportsClient user={user} />;
}
