import { redirect } from "next/navigation";

interface DashboardLogsPageProps {
  searchParams: Promise<{
    [key: string]: string | undefined;
  }>;
}

export default async function DashboardLogsPage({ searchParams }: DashboardLogsPageProps) {
  const params = await searchParams;
  const queryString = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
  ).toString();

  redirect(queryString ? `/audit-logs?${queryString}` : "/audit-logs");
}
