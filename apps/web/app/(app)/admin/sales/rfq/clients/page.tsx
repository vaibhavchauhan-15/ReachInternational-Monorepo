import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import { getCompaniesWithStats } from "@/lib/queries/rfq";
import { ClientsDirectoryClient } from "./ClientsDirectoryClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "RFQ Client Accounts | Reach International Sales",
  description: "Directory of client accounts and organization stakeholders established through quote requests.",
};

export default async function RfqClientsPage() {
  const user = await requireRole("super_admin", "admin", "sales");
  const companies = await getCompaniesWithStats();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <ClientsDirectoryClient
        companies={companies}
        currentRole={user.role}
      />
    </div>
  );
}
