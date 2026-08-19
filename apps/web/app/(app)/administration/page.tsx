import { requireRole } from "@/lib/dal";
import { AdminClient } from "@/components/admin/AdminClient";

export default async function AdministrationPage() {
  const user = await requireRole("admin", "super_admin");

  return <AdminClient user={user} />;
}
