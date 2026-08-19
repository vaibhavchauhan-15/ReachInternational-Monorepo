import { getCurrentUser } from "@/lib/dal";
import { redirect } from "next/navigation";
import { ClientDetailClient } from "@/components/crm/ClientDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ClientDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  return <ClientDetailClient user={user} clientId={id} />;
}
