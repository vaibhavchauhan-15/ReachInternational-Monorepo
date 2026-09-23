import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { getRoleHomeRoute } from "@reachinternational/permissions";
import { OnboardingClient } from "./OnboardingClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OnboardingPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // If user already has complete_profile === true or 'yes', redirect directly to role Home
  if (user.complete_profile === true || user.complete_profile === "yes") {
    redirect(getRoleHomeRoute(user.role));
  }


  return <OnboardingClient user={user} />;
}
