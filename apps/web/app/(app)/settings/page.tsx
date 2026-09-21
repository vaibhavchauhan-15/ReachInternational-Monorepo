import { redirect } from "next/navigation";
import { verifySession, getCurrentUser } from "@/lib/dal";
import { getUserDetail } from "@/lib/data/users";
import { SettingsClient } from "@/components/settings/SettingsClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function SettingsPage() {
  const { userId } = await verifySession();
  const [user, profileDetail] = await Promise.all([
    getCurrentUser(),
    getUserDetail(userId),
  ]);

  if (!user) {
    redirect("/login");
  }

  return <SettingsClient user={user} profileDetail={profileDetail} />;
}
