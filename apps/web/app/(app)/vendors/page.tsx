import { getCurrentUser } from "@/lib/dal";
import { redirect } from "next/navigation";
import { VendorsClient } from "@/components/vendors/VendorsClient";

export default async function VendorsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <VendorsClient user={user} />;
}
