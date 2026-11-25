import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { verifySession } from "@/lib/dal";
import { getUserDetail, getMyPendingProfileRequest } from "@/lib/data/users";
import { getUserDocumentsAction, getDocumentTypesAction } from "@/app/actions/documents";
import { toProfileView } from "@/lib/profile-view";
import { ROLE_CONFIG } from "@/components/profile/UserProfileCard";
import { ProfileEditButton } from "@/components/profile/ProfileEditButton";
import { ProfilePendingBanner } from "@/components/profile/ProfilePendingBanner";
import { AadhaarProfileField } from "@/components/profile/AadhaarProfileField";
import { ProfileDocumentsSection } from "@/components/profile/ProfileDocumentsSection";
import { ProfileFieldCopyButton } from "@/components/profile/ProfileFieldCopyButton";
import {
  AnimatedBriefcase,
  AnimatedCreditCard,
  AnimatedBuilding,
  AnimatedShieldCheck,
  AnimatedMapPin,
  AnimatedPhone,
  AnimatedUser,
} from "@/components/ui/animated-icons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SECTION_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  briefcase: AnimatedBriefcase,
  "credit-card": AnimatedCreditCard,
  building: AnimatedBuilding,
  shield: AnimatedShieldCheck,
  "map-pin": AnimatedMapPin,
  phone: AnimatedPhone,
  user: AnimatedUser,
};

interface ProfilePageProps {
  searchParams?: Promise<{ edit?: string }>;
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const resolvedParams = searchParams ? await searchParams : undefined;
  const initialEditOpen = resolvedParams?.edit === "true" || resolvedParams?.edit === "1";

  const { userId } = await verifySession();
  const [user, pending, documents, documentTypes] = await Promise.all([
    getUserDetail(userId),
    getMyPendingProfileRequest(userId),
    getUserDocumentsAction(),
    getDocumentTypesAction(),
  ]);

  if (!user) {
    redirect("/login");
  }

  const view = toProfileView(user);
  const roleMeta = ROLE_CONFIG[user.role] || {
    label: user.role.replace("_", " "),
    badgeClass: "bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20",
    icon: AnimatedUser,
  };
  const RoleIcon = roleMeta.icon || AnimatedUser;

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-12 select-none">
      {/* ─── Profile Header Card ─── */}
      <div className="p-4 sm:p-5 border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] rounded-2xl shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0 flex-1">
            <div className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] text-[var(--color-canvas)] text-lg font-bold shadow-xs ring-1 ring-black/5 dark:ring-white/10">
              {view.name ? view.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg font-extrabold text-[var(--color-ink)] truncate leading-tight">
                {view.name}
              </h1>
              {/* Employee ID — premium mono chip with copy affordance */}
              {user.employee_id && (
                <div className="mt-1.5 flex items-center gap-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-hairline)] bg-[var(--color-canvas)] pl-2 pr-2.5 py-0.5">
                    <span className="text-[8px] font-bold uppercase tracking-[0.14em] text-[var(--color-mute)]">
                      ID
                    </span>
                    <span className="h-2.5 w-px bg-[var(--color-hairline)]" />
                    <span className="font-mono text-[10px] font-semibold tracking-[0.06em] text-[var(--color-ink)]">
                      {user.employee_id}
                    </span>
                  </span>
                  <ProfileFieldCopyButton value={user.employee_id} label="Employee ID" />
                </div>
              )}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${roleMeta.badgeClass}`}
                >
                  <RoleIcon size={12} />
                  <span>{roleMeta.label}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>{view.status}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center self-stretch sm:self-center sm:w-auto">
            <ProfileEditButton user={user} initialOpen={initialEditOpen} />
          </div>
        </div>
      </div>

      {/* ─── Pending Request Banner (if any) ─── */}
      {pending && (
        <ProfilePendingBanner
          requestId={pending.id}
          createdAt={pending.created_at}
          targetApproverRole={pending.target_approver_role}
        />
      )}

      {/* ─── Detail Sections Responsive 2-Col Grid ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {view.sections.map((section) => {
          const SectionIcon = SECTION_ICONS[section.iconName] || AnimatedUser;

          return (
            <section
              key={section.title}
              aria-label={section.title}
              data-hover-parent
              className="border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] rounded-2xl p-4 sm:p-5 shadow-xs transition-colors"
            >
              <div className="flex items-center gap-2 pb-2 mb-2 border-b border-[var(--color-hairline)]/60">
                <SectionIcon size={16} className="text-sky-600 dark:text-sky-400 shrink-0" />
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-mute)]">
                  {section.title}
                </h2>
              </div>
              <dl className="divide-y divide-[var(--color-hairline)]">
                {section.rows.map((row) => {
                  const isAadhaar = row.label === "Aadhaar";

                  return (
                    <div
                      key={row.label}
                      className="py-2.5 flex items-start justify-between gap-3 text-xs"
                    >
                      <dt className="text-[11px] font-medium leading-5 text-[var(--color-mute)] shrink-0 max-w-[45%]">
                        {row.label}
                      </dt>
                      <dd
                        className={`min-w-0 flex-1 leading-5 font-semibold text-[var(--color-ink)] break-words text-right flex items-center justify-end gap-1.5 select-text ${
                          row.isMonospace ? "font-mono text-[13px] tracking-tight" : ""
                        }`}
                      >
                        {isAadhaar && user.aadhaar_number ? (
                          <AadhaarProfileField
                            aadhaarNumber={user.aadhaar_number}
                            maskedFallback={row.value}
                          />
                        ) : row.href ? (
                          <Link
                            href={row.href}
                            className="text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1 font-semibold"
                          >
                            <span>{row.value}</span>
                            <ExternalLink size={12} className="shrink-0" />
                          </Link>
                        ) : (
                          <>
                            {row.badge ? (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  row.badge.variant === "warning"
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                }`}
                              >
                                {row.badge.label}
                              </span>
                            ) : (
                              <span>{row.value}</span>
                            )}
                            {row.copyable && row.copyValue && (
                              <ProfileFieldCopyButton
                                value={row.copyValue}
                                label={row.label}
                              />
                            )}
                          </>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          );
        })}
      </div>

      {/* ─── Identity Document Uploads ─── */}
      {documentTypes.length > 0 && (
        <ProfileDocumentsSection
          userId={userId}
          documentTypes={documentTypes}
          initialDocuments={documents}
        />
      )}
    </div>
  );
}
