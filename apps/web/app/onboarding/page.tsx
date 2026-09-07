import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { OnboardingClient } from "./OnboardingClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OnboardingPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // If user already has complete_profile === 'yes', redirect directly to dashboard
  if (user.complete_profile === "yes") {
    if (user.role === "operator") {
      redirect("/operations?tab=entry");
    }
    redirect("/machines");
  }

  return <OnboardingClient user={user} />;
}
