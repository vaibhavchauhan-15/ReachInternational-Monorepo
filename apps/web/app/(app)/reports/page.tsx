import { getCurrentUser } from "@/lib/dal";
import { redirect } from "next/navigation";
import { ReportsClient } from "@/components/reports/ReportsClient";

export default async function ReportsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <ReportsClient user={user} />;
}
