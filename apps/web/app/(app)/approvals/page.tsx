import { redirect } from "next/navigation";
import { getCurrentUser, requireRole } from "@/lib/dal";
import { getApprovalsListDAL, getApprovalCountsDAL } from "@/lib/dal/approvals";
import { ApprovalsClientShell } from "./ApprovalsClientShell";

export const metadata = {
  title: "Approvals & Verifications | Reach International",
  description: "Unified approvals queue and audit trail for user onboarding, documents, profile changes, and fleet operations.",
};

export const dynamic = "force-dynamic";

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; id?: string }>;
}) {
  // Authorize view: strictly admin users (super_admin, admin)
  const user = await requireRole("admin");

  const sp = await searchParams;
  const initialStatus = (sp.status as any) || "pending";
  const initialType = sp.type || undefined;
  const selectedId = sp.id || null;

  const [{ data: initialItems }, { data: initialCounts }] = await Promise.all([
    getApprovalsListDAL({
      status: initialStatus,
      type_key: initialType,
      limit: 25,
    }),
    getApprovalCountsDAL(),
  ]);

  return (
    <ApprovalsClientShell
      currentUser={user}
      initialItems={initialItems || []}
      initialCounts={initialCounts || { total: 0, by_type: {} }}
      initialStatus={initialStatus}
      initialType={initialType}
      selectedRequestId={selectedId}
    />
  );
}
