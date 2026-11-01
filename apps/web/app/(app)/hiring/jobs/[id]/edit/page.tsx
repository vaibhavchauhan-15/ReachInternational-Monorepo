import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { getJobDetailByIdOrCode, getJobFilterOptions } from "@/lib/data/careers";
import { JobEditorForm } from "@/components/hiring/JobEditorForm";

interface EditJobPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditJobPage({ params }: EditJobPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canManage = ["super_admin", "admin", "hr"].includes(user.role);
  if (!canManage) {
    redirect("/hiring/jobs");
  }

  const { id } = await params;
  const [job, filterOptions] = await Promise.all([
    getJobDetailByIdOrCode(id),
    getJobFilterOptions(),
  ]);

  if (!job) {
    notFound();
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <JobEditorForm
        initialJob={job}
        departments={filterOptions.departments}
        states={filterOptions.states}
        isEditing={true}
      />
    </div>
  );
}
