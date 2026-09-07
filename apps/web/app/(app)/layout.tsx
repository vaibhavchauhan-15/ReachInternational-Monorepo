import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser, isProfileIncomplete } from "@/lib/dal";
import { AppShellClient } from "@/components/layout/AppShellClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

  // Fast zero-latency profile completion check:
  // If complete_profile === 'yes', skip immediately (0 CPU overhead).
  // Only check completeness if complete_profile !== 'yes'.
  if (user.complete_profile !== "yes" && isProfileIncomplete(user)) {
    redirect("/onboarding");
  }

  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get("reachinternational_sidebar_collapsed")?.value;
  const defaultCollapsed = sidebarCookie === "true";

  return (
    <AppShellClient user={user} defaultCollapsed={defaultCollapsed}>
      {children}
    </AppShellClient>
  );
}