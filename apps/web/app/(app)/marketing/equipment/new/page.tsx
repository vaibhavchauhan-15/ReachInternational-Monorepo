import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { getEquipmentFilterOptions } from "@/lib/data/equipment-admin";
import { EquipmentEditorFormClient } from "@/components/equipment-admin/EquipmentEditorFormClient";

export default async function NewEquipmentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowedRoles = ["super_admin", "admin", "manager"];
  if (!allowedRoles.includes(user.role)) {
    redirect("/dashboard");
  }

  const filterOptions = await getEquipmentFilterOptions();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <EquipmentEditorFormClient
        brands={filterOptions.brands}
        categories={filterOptions.categories}
        specDefinitions={filterOptions.specDefinitions}
      />
    </div>
  );
}
