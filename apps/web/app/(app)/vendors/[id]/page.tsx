import { getCurrentUser } from "@/lib/dal";
import { redirect } from "next/navigation";
import { VendorDetailClient } from "@/components/vendors/VendorDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VendorDetailPage({ params }: PageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  return <VendorDetailClient user={user} vendorId={id} />;
}
