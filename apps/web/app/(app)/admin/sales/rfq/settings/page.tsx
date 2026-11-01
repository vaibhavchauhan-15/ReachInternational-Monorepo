import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { getBusinessProfile } from "@/lib/queries/rfq";
import { RfqSettingsClient } from "./RfqSettingsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "RFQ Business Settings | Reach International Admin",
  description: "Configure legal entity, tax parameters, and quotation templates.",
};

export default async function RfqSettingsPage() {
  await requireRole("super_admin", "admin");
  const businessProfile = await getBusinessProfile();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <RfqSettingsClient initialProfile={businessProfile} />
    </div>
  );
}
