import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { AppShellClient } from "@/components/layout/AppShellClient";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.status === "inactive") {
    redirect("/login");
  }

  if (user.status === "pending") {
    redirect("/login");
  }

  return <AppShellClient user={user}>{children}</AppShellClient>;
}