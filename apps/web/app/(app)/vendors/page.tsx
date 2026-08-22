import { getCurrentUser, protectDisabledRoute } from "@/lib/dal";
import { redirect } from "next/navigation";
import { VendorsClient } from "@/components/vendors/VendorsClient";

export default async function VendorsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  protectDisabledRoute(user.role);

  return <VendorsClient user={user} />;
}
