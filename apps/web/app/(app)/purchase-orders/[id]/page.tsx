import { getCurrentUser } from "@/lib/dal";
import { redirect } from "next/navigation";
import { PODetailClient } from "@/components/purchase/PODetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PODetailPage({ params }: PageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  return <PODetailClient user={user} poId={id} />;
}
