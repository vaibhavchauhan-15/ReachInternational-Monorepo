import { requireRole } from "@/lib/dal";
import { getApprovalsListDAL, getApprovalCountsDAL } from "@/lib/dal/approvals";
import { getAllApproverRoles } from "@reachinternational/permissions";
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
  // Route guard: derived dynamically from permissions approver pool roles
  // Satisfies requireRole("admin") and other approver pool roles
  const approverRoles = getAllApproverRoles();
  const user = await requireRole("admin", ...approverRoles.filter((r) => r !== "admin"));

  const sp = await searchParams;
  const initialStatus = (sp.status as any) || "pending";
  const initialType = sp.type || undefined;
  const selectedId = sp.id || null;

  const [approvalsRes, { data: initialCounts }] = await Promise.all([
    getApprovalsListDAL({
      status: initialStatus,
      type_key: initialType,
      limit: 20,
    }),
    getApprovalCountsDAL(),
  ]);

  return (
    <ApprovalsClientShell
      currentUser={user}
      initialItems={approvalsRes.data || []}
      initialCursor={approvalsRes.next_cursor || null}
      initialHasMore={approvalsRes.has_more}
      initialPendingTotal={approvalsRes.pending_total}
      initialCounts={initialCounts || { total: 0, by_type: {} }}
      initialStatus={initialStatus}
      initialType={initialType}
      selectedRequestId={selectedId}
    />
  );
}
