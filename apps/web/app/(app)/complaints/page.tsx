import { redirect } from "next/navigation";

export default function ComplaintsPage() {
  redirect("/machines?tab=complaints");
}
