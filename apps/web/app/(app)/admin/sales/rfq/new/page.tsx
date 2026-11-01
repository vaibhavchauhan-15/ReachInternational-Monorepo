import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { getSlimEquipmentList } from "@/lib/queries/rfq";
import { getEquipmentCategories } from "@/lib/queries/equipment";
import { ManualRfqClient } from "./ManualRfqClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "New Manual RFQ | Reach International Sales",
  description: "Record phone call, WhatsApp, walk-in or verbal equipment quote requests.",
};

export default async function NewManualRfqPage() {
  await requireRole("super_admin", "admin", "sales");

  const [slimEquipment, categories] = await Promise.all([
    getSlimEquipmentList(),
    getEquipmentCategories(),
  ]);

  const categoryOptions = categories.map((c) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <ManualRfqClient
        equipmentList={slimEquipment}
        categories={categoryOptions}
      />
    </div>
  );
}
