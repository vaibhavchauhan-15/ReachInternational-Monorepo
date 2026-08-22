import { getCurrentUser, protectDisabledRoute } from "@/lib/dal";
import { redirect } from "next/navigation";
import { PurchaseOrdersClient } from "@/components/purchase/PurchaseOrdersClient";

export default async function PurchaseOrdersPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  protectDisabledRoute(user.role);

  return <PurchaseOrdersClient user={user} />;
}
