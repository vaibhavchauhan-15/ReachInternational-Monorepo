import { redirect } from "next/navigation";

export default function AssignmentLogsRedirect() {
  redirect("/operations/audit-logs");
}
