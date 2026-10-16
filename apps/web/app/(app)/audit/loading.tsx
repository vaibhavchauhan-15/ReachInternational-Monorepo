import { SkeletonHeader, SkeletonTable } from "@/components/ui/Skeleton";

export default function AuditLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <SkeletonHeader hasEyebrow hasSubtitle />
      <SkeletonTable columns={5} rows={10} />
    </div>
  );
}
