import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { AppShellClient } from "@/components/layout/AppShellClient";
import { ToastProvider } from "@/components/ui";

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

  return (
    <ToastProvider>
      <AppShellClient user={user}>{children}</AppShellClient>
    </ToastProvider>
  );
}