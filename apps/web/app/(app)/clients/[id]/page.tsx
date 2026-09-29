import { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, requireRole } from "@/lib/dal";
import {
  resolveClientId,
  getClientDetail,
  getClientDetailLocation,
  getClientSummary,
  getClientMachines,
  getClientRunningLogs,
  getClientAssignments,
  getClientHistory,
  getClientAuditLogs,
  getClientShiftCodes,
} from "@/lib/data/clients";
import { EmptyState } from "@/components/ui";
import { ClientDetailClient } from "./ClientDetailClient";

export async function generateMetadata(props: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: rawId } = await props.params;
  const clientId = await resolveClientId(decodeURIComponent(rawId));
  if (!clientId) {
    return {
      title: "Client Not Found | ReachInternational CRM",
    };
  }
  const detail = await getClientDetail(clientId);
  const companyName = detail.client?.company_name || detail.client?.code || "Client";
  return {
    title: `${companyName} (${detail.client?.code || ""}) | Client Profile | ReachInternational CRM`,
    description: `Detailed operational overview, deployed fleet machinery, operator assignments, and shift running logs for ${companyName}.`,
  };
}

export default async function ClientDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  await requireRole("super_admin", "admin", "manager", "supervisor");

  const { id: rawId } = await props.params;
  const clientId = await resolveClientId(decodeURIComponent(rawId));

  if (!clientId) {
    return (
      <div className="py-16 max-w-xl mx-auto px-4">
        <EmptyState
          title="Client Account Not Found"
          description="The requested client identifier doesn't exist, has been removed, or you don't have permission to view it."
          action={
            <Link
              href="/clients"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm bg-[var(--color-ink)] text-[var(--color-on-primary)] text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Back to Client Directory
            </Link>
          }
        />
      </div>
    );
  }

  // High-performance concurrent queries: all light section lookups in parallel
  const [
    detailRes,
    locationData,
    summaryData,
    machines,
    logs,
    assignments,
    history,
    auditLogs,
    shiftCodes,
  ] = await Promise.all([
    getClientDetail(clientId),
    getClientDetailLocation(clientId),
    getClientSummary(clientId),
    getClientMachines(clientId),
    getClientRunningLogs(clientId, 50),
    getClientAssignments(clientId),
    getClientHistory(clientId),
    getClientAuditLogs(clientId, 50),
    getClientShiftCodes(clientId),
  ]);

  if (!detailRes.client) {
    return (
      <div className="py-16 max-w-xl mx-auto px-4">
        <EmptyState
          title="Client Account Not Found"
          description="The requested client identifier doesn't exist, has been removed, or you don't have permission to view it."
          action={
            <Link
              href="/clients"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-sm bg-[var(--color-ink)] text-[var(--color-on-primary)] text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              Back to Client Directory
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <ClientDetailClient
      client={detailRes.client}
      locationData={locationData}
      summaryData={summaryData}
      initialMachines={machines}
      initialLogs={logs}
      initialAssignments={assignments}
      initialHistory={history}
      initialAuditLogs={auditLogs}
      initialShiftCodes={shiftCodes}
      currentUserRole={user.role}
    />
  );
}
