import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import {
  getNavForRole,
  labelFor,
} from "@reachinternational/permissions";
import type { UserRole } from "@reachinternational/types";
import { MorePageClient } from "@/components/navigation/MorePageClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MorePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const role = user.role as UserRole;
  const { more } = getNavForRole(role);

  // Serialize overflow items for the client component
  const overflowItems = more.map((i) => ({
    key: i.key,
    label: labelFor(i, role),
    href: i.href,
    icon: i.icon,
  }));

  return (
    <MorePageClient
      user={{
        full_name: user.full_name,
        email: user.email || "",
        role: user.role,
      }}
      overflowItems={overflowItems}
    />
  );
}
