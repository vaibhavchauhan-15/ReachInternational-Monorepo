import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import {
  getEquipmentAdminDetail,
  getEquipmentFilterOptions,
} from "@/lib/data/equipment-admin";
import { EquipmentEditorFormClient } from "@/components/equipment-admin/EquipmentEditorFormClient";

interface EditEquipmentPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditEquipmentPage({ params }: EditEquipmentPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const allowedRoles = ["super_admin", "admin", "manager"];
  if (!allowedRoles.includes(user.role)) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const [model, filterOptions] = await Promise.all([
    getEquipmentAdminDetail(id),
    getEquipmentFilterOptions(),
  ]);

  if (!model) {
    notFound();
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <EquipmentEditorFormClient
        initialModel={model}
        brands={filterOptions.brands}
        categories={filterOptions.categories}
        specDefinitions={filterOptions.specDefinitions}
      />
    </div>
  );
}
