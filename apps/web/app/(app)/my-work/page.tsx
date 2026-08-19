import { getCurrentUser } from "@/lib/dal";
import { redirect } from "next/navigation";
import { MyWorkClient } from "@/components/my-work/MyWorkClient";
import { getMyWorkData } from "@/lib/queries/my-work";

export default async function MyWorkPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const initialData = await getMyWorkData(user.id, user.role, user.branch_id);

  return <MyWorkClient user={user} initialData={initialData} />;
}

