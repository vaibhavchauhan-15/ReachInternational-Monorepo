import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/dal";
import { getRfqById, getSalesUsers } from "@/lib/queries/rfq";
import { RfqDetailClient } from "./RfqDetailClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RfqDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: RfqDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const rfq = await getRfqById(id);
  if (!rfq) return { title: "RFQ Not Found | Reach International" };

  return {
    title: `${rfq.rfq_number} — ${rfq.company?.name || rfq.contact.full_name} | Reach International`,
    description: `RFQ detail and quotation editor for ${rfq.rfq_number}`,
  };
}

export default async function RfqDetailPage({ params }: RfqDetailPageProps) {
  // Enforce strict RBAC: only super_admin, admin, sales
  const user = await requireRole("super_admin", "admin", "sales");
  const { id } = await params;

  const [rfq, salesUsers] = await Promise.all([
    getRfqById(id),
    getSalesUsers(),
  ]);

  if (!rfq) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <RfqDetailClient
        rfq={rfq}
        salesUsers={salesUsers}
        currentRole={user.role}
      />
    </div>
  );
}
