import { redirect } from "next/navigation";
import { getCurrentUser, requirePermission } from "@/lib/dal";
import { getAssignmentAuditLogs } from "@/lib/queries/assignments";
import { AssignmentAuditLogsClient } from "@/components/operations/AssignmentAuditLogsClient";

export const metadata = {
  title: "Assignment History & Audit Logs | ReachInternational",
  description: "Chronological audit trail of operator equipment assignments and shift timings.",
};

export default async function OperationsAuditLogsPage() {
  await requirePermission("machine.view");
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role === "operator") {
    redirect("/operations?tab=entry");
  }

  const { records, metrics } = await getAssignmentAuditLogs();

  return (
    <AssignmentAuditLogsClient
      initialRecords={records}
      metrics={metrics}
    />
  );
}
