"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button, useToast } from "@/components/ui";
import { cancelMyProfileChangeRequest } from "@/app/actions/profile";
import { formatDate } from "@/lib/format";

interface ProfilePendingBannerProps {
  requestId: string;
  createdAt?: string | null;
  targetApproverRole?: string | null;
}

export function ProfilePendingBanner({
  requestId,
  createdAt,
  targetApproverRole,
}: ProfilePendingBannerProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const approverLabel =
    targetApproverRole === "super_admin"
      ? "Super Administrator"
      : targetApproverRole === "admin"
      ? "Administrator"
      : "Manager";

  const handleWithdraw = () => {
    startTransition(async () => {
      const res = await cancelMyProfileChangeRequest(requestId);
      if (res.error) {
        toast("error", res.error);
      } else {
        toast("success", "Profile change request has been withdrawn.");
        router.refresh();
      }
    });
  };

  return (
    <div
      role="status"
      className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 space-y-2.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400 text-xs">
          <AlertTriangle size={16} className="shrink-0" />
          <span>Change Request Awaiting Approval</span>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 shrink-0">
          Pending
        </span>
      </div>

      <p className="text-xs text-[var(--color-mute)] leading-relaxed">
        Your profile update submitted on{" "}
        <strong className="text-[var(--color-ink)]">
          {createdAt ? formatDate(createdAt) : "recently"}
        </strong>{" "}
        is under review by the{" "}
        <strong className="text-[var(--color-ink)]">{approverLabel}</strong>. Current values remain in effect until approved.
      </p>

      <div className="pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleWithdraw}
          loading={isPending}
          disabled={isPending}
          icon={<RotateCcw size={13} />}
          className="text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 text-xs font-semibold cursor-pointer"
        >
          Withdraw Request
        </Button>
      </div>
    </div>
  );
}
