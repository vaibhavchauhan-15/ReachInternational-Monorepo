import { redirect } from "next/navigation";

interface DashboardLogsPageProps {
  searchParams: Promise<{
    [key: string]: string | undefined;
  }>;
}

export default async function DashboardLogsPage({ searchParams }: DashboardLogsPageProps) {
  const params = await searchParams;
  const searchEntries = Object.entries(params).filter(([k, v]) => v !== undefined && k !== "tab") as [string, string][];
  const queryStr = new URLSearchParams(searchEntries).toString();

  redirect(`/operations${queryStr ? `?${queryStr}` : ""}`);
}
