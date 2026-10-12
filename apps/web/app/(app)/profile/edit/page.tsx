import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, User } from "lucide-react";
import { verifySession } from "@/lib/dal";
import { getUserDetail } from "@/lib/data/users";
import { ProfileEditForm } from "@/components/profile/ProfileEditForm";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "Edit Profile | Reach International",
  description: "Update personal details, shift timings, and official identity documents",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function ProfileEditPage() {
  const { userId } = await verifySession();
  const user = await getUserDetail(userId);

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12 select-none">
      {/* ─── Back Navigation & Page Header ─── */}
      <div className="space-y-3">
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-mute)] hover:text-[var(--color-ink)] transition-colors cursor-pointer group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Back to Profile</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] rounded-2xl shadow-xs">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] text-[var(--color-canvas)] text-base font-bold shadow-xs ring-1 ring-black/5 dark:ring-white/10">
              {user.full_name ? user.full_name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-extrabold text-[var(--color-ink)] truncate leading-tight flex items-center gap-2">
                <span>Edit Profile</span>
                {user.employee_id && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[var(--color-hairline)] text-[var(--color-mute)] border border-[var(--color-hairline)]">
                    {user.employee_id}
                  </span>
                )}
              </h1>
              <p className="text-xs text-[var(--color-mute)] mt-0.5">
                Update your personal details.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Reusable Profile Edit Form ─── */}
      <div className="p-4 sm:p-6 border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] rounded-2xl shadow-xs">
        <ProfileEditForm user={user} isModal={false} />
      </div>
    </div>
  );
}
