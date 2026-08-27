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
    redirect("/login?error=profile_not_found");
  }

  if (user.status === "inactive") {
    redirect("/login?error=account_inactive");
  }

  if (user.status === "pending") {
    redirect("/login?error=account_pending");
  }

  return <AppShellClient user={user}>{children}</AppShellClient>;
}