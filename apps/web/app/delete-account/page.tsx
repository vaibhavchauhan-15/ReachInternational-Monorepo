import { Metadata } from "next";
import { cookies } from "next/headers";
import {
  BRAND_NAME,
  BRAND_WEBSITE,
} from "@/lib/brand";
import { getCurrentUserOrNull } from "@/lib/dal";
import { getMyPendingAccountDeletionRequestAction } from "@/app/actions/account-deletion";
import {
  DeleteAccountClient,
  type PendingAccountDeletionRecord,
} from "./DeleteAccountClient";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import type { User as UserType } from "@/lib/types/database";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Delete Account & Personal Data — REACH INTERNATIONAL",
  description:
    "Official Account Deletion Request Page for Reach International mobile application and enterprise platform.",
  alternates: {
    canonical: `${BRAND_WEBSITE}/delete-account`,
  },
  openGraph: {
    title: "Delete Account & Personal Data — REACH INTERNATIONAL",
    description:
      "Submit an official account deletion and personal identity records erasure request.",
    type: "website",
    url: `${BRAND_WEBSITE}/delete-account`,
    siteName: BRAND_NAME,
  },
};

export default async function DeleteAccountPage() {
  const currentUser: UserType | null = await getCurrentUserOrNull();
  const cookieStore = await cookies();
  const sidebarCookie = cookieStore.get("reachinternational_sidebar_collapsed")?.value;
  const defaultCollapsed = sidebarCookie === "true";

  let initialPendingRequest: PendingAccountDeletionRecord | null = null;
  if (currentUser) {
    try {
      const pending = await getMyPendingAccountDeletionRequestAction();
      if (pending) {
        initialPendingRequest = pending as PendingAccountDeletionRecord;
      }
    } catch {}
  }

  return (
    <LegalPageShell
      user={currentUser}
      defaultCollapsed={defaultCollapsed}
      title="Delete Account"
      lastUpdated="September 21, 2026"
    >
      <DeleteAccountClient
        currentUser={currentUser}
        initialPendingRequest={initialPendingRequest}
      />
    </LegalPageShell>
  );
}
