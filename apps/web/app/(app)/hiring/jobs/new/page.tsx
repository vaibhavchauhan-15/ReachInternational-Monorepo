import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { getJobFilterOptions } from "@/lib/data/careers";
import { JobEditorForm } from "@/components/hiring/JobEditorForm";

export default async function NewJobPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canManage = ["super_admin", "admin", "hr"].includes(user.role);
  if (!canManage) {
    redirect("/hiring/jobs");
  }

  const filterOptions = await getJobFilterOptions();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <JobEditorForm
        departments={filterOptions.departments}
        states={filterOptions.states}
        isEditing={false}
      />
    </div>
  );
}
