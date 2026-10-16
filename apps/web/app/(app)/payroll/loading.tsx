import { SkeletonHeader, SkeletonKPI, SkeletonTable } from "@/components/ui/Skeleton";

export default function PayrollLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <SkeletonHeader hasEyebrow hasSubtitle hasAction />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SkeletonKPI count={4} />
      </div>
      <SkeletonTable columns={6} rows={8} />
    </div>
  );
}
