import { getCurrentUser, protectDisabledRoute } from "@/lib/dal";
import { redirect } from "next/navigation";
import { DocumentsClient } from "@/components/documents/DocumentsClient";

export default async function DocumentsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  protectDisabledRoute(user.role);

  return <DocumentsClient user={user} />;
}
