import { getCurrentUser } from "@/lib/dal";
import { redirect } from "next/navigation";
import { PurchaseOrdersClient } from "@/components/purchase/PurchaseOrdersClient";

export default async function PurchaseOrdersPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <PurchaseOrdersClient user={user} />;
}
