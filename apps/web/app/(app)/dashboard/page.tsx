import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (user.role === "operator") {
    redirect("/operations?tab=entry");
  }
  redirect("/machines");
}