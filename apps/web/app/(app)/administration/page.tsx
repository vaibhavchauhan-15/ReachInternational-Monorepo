import { requireRole, protectDisabledRoute } from "@/lib/dal";
import { AdminClient } from "@/components/admin/AdminClient";

export default async function AdministrationPage() {
  const user = await requireRole("admin", "super_admin");
  protectDisabledRoute(user.role);

  return <AdminClient user={user} />;
}
