import { getCurrentUser, protectDisabledRoute } from "@/lib/dal";
import { redirect } from "next/navigation";
import { ChallansClient } from "@/components/challans/ChallansClient";

export default async function ChallansPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  protectDisabledRoute(user.role);

  return <ChallansClient user={user} />;
}
