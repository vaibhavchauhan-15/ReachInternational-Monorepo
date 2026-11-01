import type { Metadata } from "next";
import { requireRole } from "@/lib/dal";
import {
  getRfqList,
  getRfqDashboardStats,
  getSalesUsers,
} from "@/lib/queries/rfq";
import { RfqDashboardClient } from "./RfqDashboardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Quote Requests — Sales Pipeline | Reach International",
  description: "Manage incoming equipment RFQs, commercial feasibility, and quotation versions.",
};

export default async function AdminRfqDashboardPage() {
  // Enforce strict RBAC: only super_admin, admin, sales are permitted
  const user = await requireRole("super_admin", "admin", "sales");

  const [rfqResult, stats, salesUsers] = await Promise.all([
    getRfqList({ limit: 100 }),
    getRfqDashboardStats(),
    getSalesUsers(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <RfqDashboardClient
        initialItems={rfqResult.items}
        initialStats={stats}
        salesUsers={salesUsers}
        currentRole={user.role}
      />
    </div>
  );
}
